const GmailWatcher = require('../src/core/watcher');
const fs = require('fs');
const path = require('path');
const child_process = require('child_process');
const { EventEmitter } = require('events');

jest.mock('child_process');

describe('Watcher Concurrency', () => {
    let watcher;
    const testLogDir = path.join(__dirname, 'concurrency-logs');

    beforeEach(() => {
        // Setup mocks
        jest.spyOn(fs, 'existsSync').mockReturnValue(true);
        jest.spyOn(fs, 'readdirSync').mockReturnValue(['hook.js']);
        jest.spyOn(fs, 'statSync').mockReturnValue({ isFile: () => true });
        jest.spyOn(fs, 'mkdirSync').mockImplementation(() => {});
        jest.spyOn(fs, 'appendFileSync').mockImplementation(() => {});
        
        watcher = new GmailWatcher({ logDir: testLogDir });
        watcher.log = jest.fn();

        // Mock GmailClient to return messages immediately
        jest.spyOn(watcher.gmailClient, 'getClient').mockResolvedValue({ client: {}, auth: {} });
        jest.spyOn(watcher.gmailClient, 'getHistory').mockResolvedValue([{ id: 'msg1' }]);
        jest.spyOn(watcher.gmailClient, 'fetchFullMessages').mockResolvedValue([{ id: 'msg1' }]);
        watcher.lastHistoryId = '123';
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('should process concurrent messages sequentially', async () => {
        let spawnCount = 0;
        const spawnEvents = new EventEmitter();
        const children = [];

        child_process.spawn.mockImplementation(() => {
            spawnCount++;
            spawnEvents.emit('spawned', spawnCount);
            
            const mockChild = new EventEmitter();
            mockChild.stdout = new EventEmitter();
            mockChild.stderr = new EventEmitter();
            mockChild.stdin = { write: jest.fn(), end: jest.fn() };
            mockChild.kill = jest.fn();
            mockChild.killed = false;
            
            children.push(mockChild);
            return mockChild;
        });

        // Simulate 2 concurrent messages
        const msg1 = { data: Buffer.from(JSON.stringify({ historyId: 'A' })).toString('base64'), ack: jest.fn() };
        const msg2 = { data: Buffer.from(JSON.stringify({ historyId: 'B' })).toString('base64'), ack: jest.fn() };

        // Fire both without awaiting immediately (simulate concurrency)
        const p1 = watcher.handleMessage(msg1);
        const p2 = watcher.handleMessage(msg2);

        // Wait for first spawn
        await new Promise(resolve => spawnEvents.once('spawned', resolve));

        // At this point, if sequential, spawnCount should be 1.
        // If parallel, it might race to 2, or be 1 but the second call initiates soon.
        // We assert strictly: logic should wait.
        
        expect(spawnCount).toBe(1);

        // Allow microtasks to process to ensure the second one had a chance to start if it wasn't blocked
        await new Promise(resolve => setImmediate(resolve));
        expect(spawnCount).toBe(1); // Still 1

        // Finish first process
        children[0].emit('close', 0);

        // Wait for second execution
        await new Promise(resolve => spawnEvents.once('spawned', resolve));
        
        expect(spawnCount).toBe(2);

        // Finish second process
        children[1].emit('close', 0);

        await Promise.all([p1, p2]);
    });
});
