const request = require('supertest');
const GmailWatcher = require('../src/core/watcher');
const fs = require('fs');
const path = require('path');
const child_process = require('child_process');
const { EventEmitter } = require('events');

jest.mock('child_process');

describe('GmailWatcher PubSub Tests', () => {
    let watcher;
    const PORT = 3998;
    const testLogDir = path.join(__dirname, 'pubsub-test-logs');

    beforeAll(() => {
        // Mock fs to prevent actual file writes
        jest.spyOn(fs, 'appendFileSync').mockImplementation(() => {});
        jest.spyOn(fs, 'mkdirSync').mockImplementation(() => {});

        watcher = new GmailWatcher({
            gitSha: 'test-sha',
            port: PORT,
            logDir: testLogDir
        });
        // Mock internal logger
        watcher.log = jest.fn();
    });

    afterAll(() => {
        if (fs.existsSync(testLogDir)) {
            try {
                fs.rmSync(testLogDir, { recursive: true, force: true });
            } catch (e) {}
        }
    });

    test('should process valid PubSub message and trigger processing', async () => {
        const testPayload = { emailAddress: 'test@example.com', historyId: '9999' };
        // message.data is buffer
        const message = {
            data: Buffer.from(JSON.stringify(testPayload)),
            ack: jest.fn(),
            id: 'msg-id-pubsub'
        };

        // Mock dependencies
        // Use watcher.gmail instead of watcher.gmailClient
        // And we need to mock the methods directly if they are instance methods
        watcher.gmail.getHistory = jest.fn().mockResolvedValue([]);
        watcher.gmail.fetchFullMessages = jest.fn().mockResolvedValue([]);
        // hookRunner.run is already mocked or spyOn-able
        jest.spyOn(watcher.hookRunner, 'run').mockResolvedValue();

        await watcher.handleMessage(message);

        expect(watcher.log).toHaveBeenCalledWith('Watcher', expect.stringContaining('Processing update'));
        expect(message.ack).toHaveBeenCalled();
    });

    test('should run hooks when notification is received', async () => {
        const testWatcher = new GmailWatcher({ logDir: testLogDir });
        testWatcher.log = jest.fn();

        // Mock spawn to simulate hook success
        child_process.spawn.mockImplementation(() => {
            const mockChild = new EventEmitter();
            mockChild.stdout = new EventEmitter();
            mockChild.stderr = new EventEmitter();
            mockChild.stdin = { write: jest.fn(), end: jest.fn() };
            mockChild.kill = jest.fn();
            mockChild.killed = false;
            
            setTimeout(() => mockChild.emit('close', 0), 10);
            return mockChild;
        });

        // Mock fs to find a hook
        jest.spyOn(fs, 'readdirSync').mockReturnValue(['test-hook.js']);
        jest.spyOn(fs, 'statSync').mockReturnValue({ isFile: () => true });
        jest.spyOn(fs, 'existsSync').mockReturnValue(true);

        await testWatcher.hookRunner.run([{ id: 'msg1' }]);
        
        expect(child_process.spawn).toHaveBeenCalled();
    });
});
