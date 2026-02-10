const GmailWatcher = require('./watcher');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const credentialsPath = path.join(__dirname, '../credentials.json');
let projectId = process.env.GOOGLE_PROJECT_ID;

if (!projectId && fs.existsSync(credentialsPath)) {
    const credentials = JSON.parse(fs.readFileSync(credentialsPath));
    projectId = (credentials.installed || credentials.web).project_id;
}

const watcher = new GmailWatcher({
    gitSha: process.env.GIT_SHA || 'development',
    projectId: projectId,
    subscriptionName: process.env.GMAIL_SUBSCRIPTION_NAME,
    topicName: process.env.GMAIL_TOPIC_NAME,
    port: process.env.PORT
});

watcher.start();

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log(`[PID:${process.pid}] SIGTERM signal received: closing HTTP server`);
    watcher.stop();
});
