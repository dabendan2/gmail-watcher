/**
 * @file GmailClient.js
 * @description Wrapper class for Gmail API interactions, handling authentication and message fetching.
 */

const { google } = require('googleapis');
const fs = require('fs');

class GmailClient {
    /**
     * @param {string} tokenPath - Path to the token.json file.
     * @param {string} credentialsPath - Path to the credentials.json file.
     */
    constructor(tokenPath, credentialsPath) {
        this.tokenPath = tokenPath;
        this.credentialsPath = credentialsPath;
        this.client = null;
        this.auth = null;
    }

    /**
     * Initializes and returns the Gmail API client.
     * @returns {Promise<{client: object, auth: object}>} The Gmail client and auth object.
     * @throws {Error} If credentials or token files are missing.
     */
    async getClient() {
        if (this.client) return { client: this.client, auth: this.auth };

        if (!fs.existsSync(this.tokenPath) || !fs.existsSync(this.credentialsPath)) {
            throw new Error('Missing token.json or credentials.json');
        }

        const credentials = JSON.parse(fs.readFileSync(this.credentialsPath));
        const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
        this.auth = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
        
        const token = JSON.parse(fs.readFileSync(this.tokenPath));
        this.auth.setCredentials(token);

        this.client = google.gmail({ version: 'v1', auth: this.auth });
        return { client: this.client, auth: this.auth };
    }

    /**
     * Sets up a push notification watch on the user's inbox.
     * @param {string} topicName - The Pub/Sub topic name.
     * @returns {Promise<object>} The watch response data.
     */
    async watch(topicName) {
        const { client } = await this.getClient();
        return await client.users.watch({
            userId: 'me',
            requestBody: {
                topicName: topicName,
                labelIds: ['INBOX']
            }
        });
    }

    /**
     * Fetches full message details for a list of message IDs.
     * @param {Array<{id: string}>} messageIds - Array of message objects with IDs.
     * @returns {Promise<Array<object>>} Array of full message objects.
     */
    async fetchFullMessages(messageIds) {
        if (!messageIds || messageIds.length === 0) return [];
        
        const { client } = await this.getClient();
        const messages = [];

        for (const msg of messageIds) {
            try {
                const res = await client.users.messages.get({
                    userId: 'me',
                    id: msg.id
                });
                messages.push(res.data);
            } catch (e) {
                console.error(`Failed to fetch message ${msg.id}: ${e.message}`);
            }
        }
        return messages;
    }

    /**
     * Retrieves the history of changes since a specific history ID.
     * @param {string} startHistoryId - The history ID to start fetching from.
     * @returns {Promise<Array<{id: string}>>} Array of message IDs added since the history ID.
     */
    async getHistory(startHistoryId) {
        const { client } = await this.getClient();
        const messageIds = [];
        
        try {
            const historyRes = await client.users.history.list({
                userId: 'me',
                startHistoryId: startHistoryId,
                historyTypes: ['messageAdded']
            });
            
            if (historyRes.data.history) {
                for (const historyItem of historyRes.data.history) {
                    if (historyItem.messagesAdded) {
                        for (const msgAdded of historyItem.messagesAdded) {
                            messageIds.push({ id: msgAdded.message.id });
                        }
                    }
                }
            }
        } catch (e) {
             throw new Error(`History list failed: ${e.message}`);
        }
        return messageIds;
    }

    /**
     * Lists recent unread messages.
     * @param {number} maxResults - Maximum number of messages to return.
     * @returns {Promise<Array<object>>} Array of message objects (IDs only).
     */
    async listUnreadMessages(maxResults = 10) {
        const { client } = await this.getClient();
        const res = await client.users.messages.list({
            userId: 'me',
            q: 'is:unread',
            maxResults: maxResults
        });
        return res.data.messages || [];
    }
}

module.exports = GmailClient;
