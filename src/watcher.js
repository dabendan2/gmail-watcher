const { PubSub } = require('@google-cloud/pubsub');
const fs = require('fs');
const path = require('path');
const http = require('http');

class GmailWatcher {
    constructor(config = {}) {
        this.gitSha = config.gitSha || 'development';
        this.projectId = config.projectId;
        this.subscriptionName = config.subscriptionName;
        this.port = config.port;
        this.logDir = config.logDir || path.join(__dirname, '../logs');
        
        if (this.projectId) {
            this.pubsub = new PubSub({ projectId: this.projectId });
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

    start() {
        if (!this.port) {
            throw new Error('PORT is not defined');
        }

        this.server = this.createApp().listen(this.port, () => {
            console.log(`Health check server listening on port ${this.port}`);
        });

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
    }
}

module.exports = GmailWatcher;
