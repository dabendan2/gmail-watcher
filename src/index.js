const GmailWatcher = require('./watcher');
require('dotenv').config();

const watcher = new GmailWatcher({
    gitSha: process.env.GIT_SHA || 'development',
    projectId: process.env.GOOGLE_PROJECT_ID,
    subscriptionName: process.env.GMAIL_SUBSCRIPTION_NAME,
    port: process.env.PORT
});

watcher.start();

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    watcher.stop();
});
