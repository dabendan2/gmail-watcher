const GmailWatcher = require('../src/core/watcher');
const fs = require('fs');
const path = require('path');

describe('GmailWatcher Skip Logic', () => {
    let watcher;

    beforeEach(() => {
        watcher = new GmailWatcher({ port: 9995 });
        // Mock internal methods
        watcher.log = jest.fn();
        // Since we moved methods to sub-objects, we spy on them
        jest.spyOn(watcher.gmailClient, 'getClient').mockResolvedValue({ client: {}, auth: {} });
        jest.spyOn(watcher.gmailClient, 'fetchFullMessages').mockResolvedValue([]);
        jest.spyOn(watcher.hookRunner, 'run').mockResolvedValue();
    });

    test('should skip when historyId is missing', async () => {
        const message = {
            data: Buffer.from(JSON.stringify({ emailAddress: 'test@example.com' })).toString('base64'),
            ack: jest.fn()
        };

        await watcher.handleMessage(message);

        expect(watcher.log).toHaveBeenCalledWith('Watcher', expect.stringContaining('Skip notification'));
        expect(message.ack).toHaveBeenCalled();
        expect(watcher.gmailClient.getClient).not.toHaveBeenCalled();
    });

    test('should proceed when historyId is present', async () => {
        const message = {
            data: Buffer.from(JSON.stringify({ emailAddress: 'test@example.com', historyId: '12345' })).toString('base64'),
            ack: jest.fn()
        };

        // Mock getClient to return a mock client that handles history.list
        const mockClient = { 
            users: { 
                history: { list: jest.fn().mockResolvedValue({ data: {} }) } 
            } 
        };
        watcher.gmailClient.getClient.mockResolvedValue({ client: mockClient });
        
        // Ensure we enter the logic block that calls getHistory/getClient
        watcher.lastHistoryId = 'existing-history-id';

        await watcher.handleMessage(message);

        expect(watcher.log).toHaveBeenCalledWith('Watcher', expect.stringContaining('Notification received'));
        expect(message.ack).toHaveBeenCalled();
        expect(watcher.gmailClient.getClient).toHaveBeenCalled();
    });
});
