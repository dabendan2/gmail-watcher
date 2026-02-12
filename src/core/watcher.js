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
    this.messageQueue = Promise.resolve(); // Queue for sequential processing
    this.lastHistoryId = null;
  }

  log(source, message) {
    const now = new Date();
    const timestamp = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`;
    const logLine = `[${timestamp}] [${source}] ${message}\n`;
    
    // Log to console (captured by service.log)
    console.log(logLine.trim());

    // Log specifically to gmail.log - REMOVED to avoid duplication
    // const gmailLogPath = path.join(this.workdir, 'gmail.log');
    // fs.appendFileSync(gmailLogPath, logLine);
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

      const watchRes = await this.gmail.watch(this.topicName);
      if (watchRes.historyId) {
          this.lastHistoryId = watchRes.historyId;
          this.log('Watcher', `Initial history ID: ${this.lastHistoryId}`);
      } else {
          this.log('Watcher', `CRITICAL: Missing historyId in watch response: ${JSON.stringify(watchRes)}`);
          throw new Error('Failed to obtain initial historyId from Gmail API');
      }
      this.log('Watcher', `Gmail watch set for topic: ${this.topicName}`);

      // 1.5. Process initial unread messages (top 10)
      this.log('Watcher', 'Fetching initial unread messages...');
      const unreadIds = await this.gmail.listUnreadMessages(10);
      if (unreadIds.length > 0) {
        this.log('Watcher', `Found ${unreadIds.length} initial unread messages.`);
        const fullMessages = await this.gmail.fetchFullMessages(unreadIds);
        await this.hookRunner.run(fullMessages);
      } else {
        this.log('Watcher', 'No initial unread messages found.');
      }

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
    this.messageQueue = this.messageQueue.then(async () => {
      try {
        const data = JSON.parse(message.data.toString());
        const { historyId } = data;
        
        if (!historyId) {
            throw new Error('Missing historyId in message data');
        }
  
        this.log('Watcher', `Processing update (History ID: ${historyId})`);
  
        // Fetch changes since lastHistoryId (or current if not set)
        const startId = this.lastHistoryId || historyId;
        
        // If startId is same as new ID, there's nothing to fetch (or it's the very first message and we have no history)
        // But Google Docs say: historyId in push notification is the *new* ID.
        // So we want changes from *last* to *new*.
        
        // Only fetch if we have a previous ID and it's different
        let messageIds = [];
        if (startId && startId !== historyId) {
             messageIds = await this.gmail.getHistory(startId);
        } else if (!this.lastHistoryId) {
             // Fallback: if we don't have last ID (restart?), maybe just fetch new ID?
             // Actually, getHistory(historyId) returns changes *after* historyId.
             // If we pass the NEW historyId, we get nothing.
             // So if we missed the init, we might miss this batch.
             this.log('Watcher', 'No previous history ID found. Skipping history sync for this batch.');
        }

        // Update lastHistoryId
        this.lastHistoryId = historyId;
        
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
    });

    return this.messageQueue;
  }

  async stop() {
    this.log('Watcher', 'Stopping...');
    if (this.subscription) {
      await this.subscription.close();
    }
  }
}

module.exports = GmailWatcher;
