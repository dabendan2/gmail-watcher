/**
 * @file watcher.js
 * @description Main logic for Gmail Pub/Sub monitoring and hook execution.
 */

const fs = require('fs');
const path = require('path');
const { PubSub } = require('@google-cloud/pubsub');
const GmailClient = require('./GmailClient');
const HookRunner = require('./HookRunner');

class GmailWatcher {
  constructor(options) {
    this.workdir = options.workdir || options.logDir; // Handle both variants
    this.topicName = options.topicName;
    this.subscriptionName = options.subscriptionName;
    this.hooksDir = path.join(this.workdir, 'hooks');
    this.logDir = this.workdir;
    this.tokenPath = options.tokenPath || path.join(this.workdir, 'token.json');
    this.credentialsPath = options.credentialsPath || path.join(this.workdir, 'credentials.json');

    this.gmail = new GmailClient(this.tokenPath, this.credentialsPath);
    this.hookRunner = new HookRunner(this.hooksDir, this.logDir, this.log.bind(this));
    this.pubsub = new PubSub({ 
      projectId: options.projectId,
      keyFilename: this.credentialsPath,
      authClient: this.gmail.auth
    });
    this.subscription = null;
  }

  log(source, message) {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] [${source}] ${message}\n`;
    
    // Log to console (captured by service.log)
    console.log(logLine.trim());

    // Log specifically to gmail.log
    const gmailLogPath = path.join(this.workdir, 'gmail.log');
    fs.appendFileSync(gmailLogPath, logLine);
  }

  async start() {
    this.log('Watcher', 'Starting Gmail Watcher...');

    try {
      // 1. Initial Gmail Watch
      const { auth } = await this.gmail.getClient();
      
      // Re-initialize PubSub with the verified auth client
      this.pubsub = new PubSub({ 
        projectId: this.pubsub.projectId,
        authClient: auth
      });

      await this.gmail.watch(this.topicName);
      this.log('Watcher', `Gmail watch set for topic: ${this.topicName}`);

      // 2. Setup Pub/Sub Subscription
      this.subscription = this.pubsub.subscription(this.subscriptionName);
      
      this.subscription.on('message', this.handleMessage.bind(this));
      this.subscription.on('error', error => {
        this.log('Watcher', `Subscription error: ${error.message}`);
        process.exit(1);
      });

      this.log('Watcher', `Listening for messages on: ${this.subscriptionName}`);
    } catch (error) {
      this.log('Watcher', `Start failed: ${error.message}`);
      throw error;
    }
  }

  async handleMessage(message) {
    this.log('Watcher', `Received message ID: ${message.id}`);
    
    try {
      const data = JSON.parse(message.data.toString());
      const { emailAddress, historyId } = data;

      this.log('Watcher', `Processing update for ${emailAddress} (History ID: ${historyId})`);

      // Fetch changes since historyId
      const messageIds = await this.gmail.getHistory(historyId);
      
      if (messageIds.length > 0) {
        this.log('Watcher', `Found ${messageIds.length} new messages.`);
        const fullMessages = await this.gmail.fetchFullMessages(messageIds);
        await this.hookRunner.run(fullMessages);
      } else {
        this.log('Watcher', 'No new messages found in history.');
      }

      message.ack();
    } catch (error) {
      this.log('Watcher', `Handle message failed: ${error.message}`);
      message.nack();
    }
  }

  async stop() {
    this.log('Watcher', 'Stopping...');
    if (this.subscription) {
      await this.subscription.close();
    }
  }
}

module.exports = GmailWatcher;
