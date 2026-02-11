/**
 * @file watcher.js
 * @description Main entry point for the Gmail Watcher service. 
 * Orchestrates Pub/Sub notifications, Gmail API fetching, and Hook execution.
 */

const { PubSub } = require('@google-cloud/pubsub');
const fs = require('fs');
const path = require('path');
const http = require('http');
const GmailClient = require('./GmailClient');
const HookRunner = require('./HookRunner');

class GmailWatcher {
    /**
     * @param {object} config - Configuration object.
     * @param {string} config.gitSha - Git SHA for health check (optional).
     * @param {string} config.projectId - Google Cloud Project ID.
     * @param {string} config.subscriptionName - Pub/Sub subscription name.
     * @param {string} config.topicName - Pub/Sub topic name (optional).
     * @param {number} config.port - Port for the health check server.
     * @param {string} config.logDir - Directory for logs.
     */
    constructor(config = {}) {
        this.gitSha = config.gitSha || 'development';
        this.projectId = config.projectId;
        this.subscriptionName = config.subscriptionName;
        this.topicName = config.topicName || `projects/${this.projectId}/topics/gmail-notifications`;
        this.port = config.port;
        this.logDir = config.logDir || path.join(__dirname, '../logs');
        this.tokenPath = path.join(__dirname, '../token.json');
        this.credentialsPath = path.join(__dirname, '../credentials.json');
        
        // Ensure log directory exists
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }

        this.gmailClient = new GmailClient(this.tokenPath, this.credentialsPath);
        
        this.hookRunner = new HookRunner(
            path.join(__dirname, '../hooks'),
            this.logDir,
            this.log.bind(this)
        );

        this.lastHistoryId = null;

        if (this.projectId) {
            this.pubsub = new PubSub({ projectId: this.projectId });
        }
    }

    /**
     * Logs a message with a timestamp and tag to the gmail.log file.
     * @param {string} tag - Tag identifying the source (e.g., 'Watcher', 'HookName').
     * @param {string} message - Message to log.
     */
    log(tag, message) {
        const timestamp = new Date().toISOString();
        const logEntry = `[PID:${process.pid}] ${timestamp} [${tag}] ${message}\n`;
        try {
            fs.appendFileSync(path.join(this.logDir, 'gmail.log'), logEntry);
        } catch (e) {
            console.error(`Failed to write to log: ${e.message}`);
        }
    }

    /**
     * Creates the HTTP server for health checks.
     * @returns {http.Server} The HTTP server instance.
     */
    createApp() {
        return http.createServer((req, res) => {
            if (req.url === '/gmail/health') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'ok', gitSha: this.gitSha }));
            } else {
                res.writeHead(404);
                res.end();
            }
        });
    }

    /**
     * Renews the Gmail push notification watch.
     * Also re-initializes the Pub/Sub subscription with updated credentials.
     */
    async renewWatch() {
        try {
            this.log('Watcher', 'Renewing Gmail watch...');
            const { auth } = await this.gmailClient.getClient();

            // Re-init PubSub with auth if needed
            if (this.projectId && this.subscriptionName) {
                this.pubsub = new PubSub({
                    projectId: this.projectId,
                    authClient: auth
                });
                
                if (this.subscription) {
                    this.subscription.removeAllListeners();
                    await this.subscription.close();
                }
                
                this.subscription = this.pubsub.subscription(this.subscriptionName);
                this.subscription.on('message', (msg) => this.handleMessage(msg));
                this.subscription.on('error', error => {
                    this.log('Watcher', `PubSub Subscription ERROR: ${error.message}`);
                });
                this.log('Watcher', `Listening for Gmail notifications on subscription: ${this.subscriptionName}...`);
            }

            const res = await this.gmailClient.watch(this.topicName);
            this.lastHistoryId = res.data.historyId;
            this.log('Watcher', `Gmail watch renewed. HistoryId: ${this.lastHistoryId}. Expiration: ${new Date(parseInt(res.data.expiration)).toISOString()}`);
        } catch (error) {
            this.log('Watcher', `Error renewing Gmail watch: ${error.message}`);
        }
    }

    /**
     * Handles incoming Pub/Sub messages.
     * Parses the message, fetches email content based on history ID, and triggers hooks.
     * @param {object} message - The Pub/Sub message object.
     */
    async handleMessage(message) {
        let data;
        try {
            data = JSON.parse(Buffer.from(message.data, 'base64').toString());
        } catch (e) {
            this.log('Watcher', 'Failed to parse PubSub message data');
            message.ack();
            return;
        }
        
        if (!data.historyId) {
            this.log('Watcher', `Skip notification without historyId: ${JSON.stringify(data)}`);
            message.ack();
            return;
        }

        this.log('Watcher', `Notification received. HistoryId: ${data.historyId}`);

        try {
            let messageIds = [];
            
            if (this.lastHistoryId) {
                try {
                    messageIds = await this.gmailClient.getHistory(this.lastHistoryId);
                } catch (e) {
                     this.log('Watcher', `History list failed (likely historyId too old), falling back: ${e.message}`);
                }
            }
            
            this.lastHistoryId = data.historyId;

            if (messageIds.length > 0) {
                 const uniqueIds = [...new Set(messageIds.map(m => m.id))].map(id => ({ id }));
                 const fullMessages = await this.gmailClient.fetchFullMessages(uniqueIds);
                 
                 // Log subjects for debugging/audit
                 fullMessages.forEach(msg => {
                    let subject = 'No Subject';
                    if (msg.payload && msg.payload.headers) {
                        const subjectHeader = msg.payload.headers.find(h => h.name === 'Subject');
                        if (subjectHeader) subject = subjectHeader.value;
                    }
                    this.log('Watcher', `Fetched email: ${subject.substring(0, 20)}...`);
                 });

                 await this.hookRunner.run(fullMessages);
            } else {
                 this.log('Watcher', 'No new messages found in history update.');
            }

        } catch (error) {
            this.log('Watcher', `Error handling message: ${error.message}`);
        } finally {
            message.ack();
        }
    }

    /**
     * Fetches and processes recent unread messages on startup.
     */
    async fetchInitialMessages() {
        this.log('Watcher', 'Fetching initial 10 unread messages...');
        try {
            const messageIds = await this.gmailClient.listUnreadMessages(10);
            if (messageIds.length > 0) {
                 const fullMessages = await this.gmailClient.fetchFullMessages(messageIds);
                 await this.hookRunner.run(fullMessages);
            } else {
                this.log('Watcher', 'No unread messages found on startup.');
            }
        } catch (e) {
            this.log('Watcher', `Initial fetch failed: ${e.message}`);
        }
    }

    /**
     * Starts the watcher service.
     * @throws {Error} If PORT is not defined.
     */
    async start() {
        if (!this.port) {
            throw new Error('PORT is not defined');
        }

        this.server = this.createApp().listen(this.port, () => {
            console.log(`[PID:${process.pid}] Health check server listening on port ${this.port}`);
        });

        await this.fetchInitialMessages();
        await this.renewWatch();

        // Schedule renewal every 4 days
        const FOUR_DAYS_MS = 4 * 24 * 60 * 60 * 1000;
        this.renewalInterval = setInterval(() => {
            this.renewWatch();
        }, FOUR_DAYS_MS);
    }
    
    /**
     * Stops the watcher service and cleans up resources.
     */
    stop() {
        if (this.server) this.server.close();
        if (this.subscription) {
            this.subscription.removeAllListeners();
            this.subscription.close();
        }
        if (this.renewalInterval) clearInterval(this.renewalInterval);
        console.log(`[PID:${process.pid}] Watcher stopped.`);
    }
}

module.exports = GmailWatcher;
