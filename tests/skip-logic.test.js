const GmailWatcher = require('../src/watcher');
const fs = require('fs');
const path = require('path');

describe('GmailWatcher Skip Logic', () => {
    let watcher;
    const logFile = path.join(__dirname, '../logs/gmail.log');

    beforeEach(() => {
        watcher = new GmailWatcher({ port: 9995 });
        // Mock logNotification to track if it's called
        watcher.logNotification = jest.fn();
    });

    test('should skip when historyId is missing', () => {
        const message = {
            data: Buffer.from(JSON.stringify({ emailAddress: 'test@example.com' })).toString('base64'),
            ack: jest.fn()
        };

        watcher.handleMessage(message);

        expect(watcher.logNotification).not.toHaveBeenCalled();
        expect(message.ack).toHaveBeenCalled();
    });

    test('should proceed when historyId is present', () => {
        const message = {
            data: Buffer.from(JSON.stringify({ emailAddress: 'test@example.com', historyId: '12345' })).toString('base64'),
            ack: jest.fn()
        };

        watcher.handleMessage(message);

        expect(watcher.logNotification).toHaveBeenCalledWith({
            emailAddress: 'test@example.com',
            historyId: '12345'
        });
        expect(message.ack).toHaveBeenCalled();
    });
});
