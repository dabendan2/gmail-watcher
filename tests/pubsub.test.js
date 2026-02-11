const request = require('supertest');
const GmailWatcher = require('../src/watcher');
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
        const message = {
            data: Buffer.from(JSON.stringify(testPayload)).toString('base64'),
            ack: jest.fn()
        };

        // Mock dependencies
        jest.spyOn(watcher.gmailClient, 'getClient').mockResolvedValue({ 
            client: { 
                users: { 
                    history: { list: jest.fn().mockResolvedValue({}) },
                    messages: { get: jest.fn() }
                } 
            }, 
            auth: {} 
        });
        jest.spyOn(watcher.gmailClient, 'fetchFullMessages').mockResolvedValue([]);
        jest.spyOn(watcher.hookRunner, 'run').mockResolvedValue();

        await watcher.handleMessage(message);

        expect(watcher.log).toHaveBeenCalledWith('Watcher', expect.stringContaining('Notification received'));
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
