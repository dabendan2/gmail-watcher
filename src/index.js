const { PubSub } = require('@google-cloud/pubsub');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const GIT_SHA = process.env.GIT_SHA || 'development';
console.log(`Starting gmail-watcher version: ${GIT_SHA}`);

const pubsub = new PubSub({ projectId: process.env.GOOGLE_PROJECT_ID });
const subscriptionName = process.env.GMAIL_SUBSCRIPTION_NAME;
const logDir = path.join(__dirname, '../logs');

// 健康檢查服務 (Post-check 使用)
const http = require('http');
const PORT = process.env.PORT;
if (!PORT) {
    console.error('ERROR: PORT is not defined in environment variables.');
    process.exit(1);
}
http.createServer((req, res) => {
    if (req.url === '/gmail/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', gitSha: GIT_SHA }));
    } else {
        res.writeHead(404);
        res.end();
    }
}).listen(PORT, () => {
    console.log(`Health check server listening on port ${PORT}`);
});

if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
}

const messageHandler = (message) => {
    const data = JSON.parse(Buffer.from(message.data, 'base64').toString());
    const logEntry = `${new Date().toISOString()} - Gmail Notification: ${JSON.stringify(data)}\n`;
    
    fs.appendFileSync(path.join(logDir, 'gmail.log'), logEntry);
    message.ack();
};

const subscription = pubsub.subscription(subscriptionName);
subscription.on('message', messageHandler);
subscription.on('error', error => {
    console.error(`ERROR: ${error.message}`);
});

console.log(`Listening for Gmail notifications on ${subscriptionName}...`);
