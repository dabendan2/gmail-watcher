const { PubSub } = require('@google-cloud/pubsub');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { google } = require('googleapis');

class GmailWatcher {
    constructor(config = {}) {
        this.gitSha = config.gitSha || 'development';
        this.projectId = config.projectId;
        this.subscriptionName = config.subscriptionName;
        this.topicName = config.topicName || `projects/${this.projectId}/topics/gmail-notifications`;
        this.port = config.port;
        this.logDir = config.logDir || path.join(__dirname, '../logs');
        this.tokenPath = path.join(__dirname, '../token.json');
        this.credentialsPath = path.join(__dirname, '../credentials.json');
        
        if (this.projectId) {
            this.pubsub = new PubSub({
                projectId: this.projectId,
                keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
            });
        }
    }

    async renewWatch() {
        try {
            if (!fs.existsSync(this.tokenPath) || !fs.existsSync(this.credentialsPath)) {
                console.error('Missing token.json or credentials.json. Run auth.js first.');
                return;
            }

            const credentials = JSON.parse(fs.readFileSync(this.credentialsPath));
            const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
            const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
            
            const token = JSON.parse(fs.readFileSync(this.tokenPath));
            oAuth2Client.setCredentials(token);

            const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });
            const res = await gmail.users.watch({
                userId: 'me',
                requestBody: {
                    topicName: this.topicName,
                    labelIds: ['INBOX']
                }
            });

            console.log(`Gmail watch renewed. Expiration: ${new Date(parseInt(res.data.expiration)).toISOString()}`);
        } catch (error) {
            console.error('Error renewing Gmail watch:', error.message);
        }
    }

    createApp() {
        return http.createServer((req, res) => {
            if (req.url === '/gmail/health') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'ok', gitSha: this.gitSha }));
            } else if (req.url === '/gmail/webhook') {
                res.writeHead(200);
                res.end('Webhook received');
            } else {
                res.writeHead(404);
                res.end();
            }
        });
    }

    handleMessage(message) {
        const data = JSON.parse(Buffer.from(message.data, 'base64').toString());
        const logEntry = `${new Date().toISOString()} - Gmail Notification: ${JSON.stringify(data)}\n`;
        
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
        
        fs.appendFileSync(path.join(this.logDir, 'gmail.log'), logEntry);
        if (typeof message.ack === 'function') {
            message.ack();
        }
    }

    async start() {
        if (!this.port) {
            throw new Error('PORT is not defined');
        }

        this.server = this.createApp().listen(this.port, () => {
            console.log(`Health check server listening on port ${this.port}`);
        });

        // Initial watch renewal
        await this.renewWatch();

        // Schedule renewal every 4 days (4 * 24 * 60 * 60 * 1000 ms)
        const FOUR_DAYS_MS = 4 * 24 * 60 * 60 * 1000;
        this.renewalInterval = setInterval(() => {
            console.log('Running scheduled Gmail watch renewal...');
            this.renewWatch();
        }, FOUR_DAYS_MS);

        if (this.pubsub && this.subscriptionName) {
            this.subscription = this.pubsub.subscription(this.subscriptionName);
            this.subscription.on('message', (msg) => this.handleMessage(msg));
            this.subscription.on('error', error => {
                console.error(`ERROR: ${error.message}`);
            });
            console.log(`Listening for Gmail notifications on ${this.subscriptionName}...`);
        }
    }
    
    stop() {
        if (this.server) this.server.close();
        if (this.subscription) this.subscription.close();
        if (this.renewalInterval) clearInterval(this.renewalInterval);
    }
}

module.exports = GmailWatcher;
