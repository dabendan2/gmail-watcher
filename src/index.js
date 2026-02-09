const { PubSub } = require('@google-cloud/pubsub');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pubsub = new PubSub({ projectId: process.env.GOOGLE_PROJECT_ID });
const subscriptionName = process.env.GMAIL_SUBSCRIPTION_NAME;
const logDir = path.join(__dirname, '..', process.env.LOG_DIR || 'logs');

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
