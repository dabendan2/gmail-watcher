const GmailWatcher = require('../src/core/watcher');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('GmailWatcher Skip Logic', () => {
    let watcher;
    const testWorkdir = path.join(os.tmpdir(), `skip-logic-test-${Date.now()}`);

    beforeEach(() => {
        if (!fs.existsSync(testWorkdir)) fs.mkdirSync(testWorkdir, { recursive: true });
        watcher = new GmailWatcher({ 
            port: 9995,
            workdir: testWorkdir,
            topicName: 'test-topic',
            subscriptionName: 'test-sub'
        });
        // Mock internal methods
        watcher.log = jest.fn();
        
        // Mock gmail client methods directly on the instance property
        watcher.gmail.getHistory = jest.fn().mockResolvedValue([]);
        watcher.gmail.fetchFullMessages = jest.fn().mockResolvedValue([]);
        watcher.hookRunner.run = jest.fn().mockResolvedValue();
    });

    afterEach(() => {
        if (fs.existsSync(testWorkdir)) fs.rmSync(testWorkdir, { recursive: true, force: true });
    });

    test('should error when historyId is missing', async () => {
        const message = {
            data: Buffer.from(JSON.stringify({ emailAddress: 'test@example.com' })),
            ack: jest.fn(),
            nack: jest.fn(),
            id: 'msg-no-history'
        };

        // If historyId is missing, getHistory is called with undefined.
        // If we mock getHistory to throw, it should nack.
        watcher.gmail.getHistory.mockRejectedValue(new Error('Missing historyId'));

        await watcher.handleMessage(message);

        expect(watcher.log).toHaveBeenCalledWith('Watcher', expect.stringContaining('Handle message failed'));
        expect(message.nack).toHaveBeenCalled();
    });

    test('should proceed when historyId is present', async () => {
        const message = {
            data: Buffer.from(JSON.stringify({ emailAddress: 'test@example.com', historyId: '12345' })),
            ack: jest.fn(),
            nack: jest.fn(),
            id: 'msg-with-history'
        };

        watcher.lastHistoryId = '10000'; // Setup

        await watcher.handleMessage(message);

        expect(watcher.log).toHaveBeenCalledWith('Watcher', expect.stringContaining('Processing update'));
        expect(message.ack).toHaveBeenCalled();
        expect(watcher.gmail.getHistory).toHaveBeenCalledWith('10000');
    });
});
