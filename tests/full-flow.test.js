const GmailWatcher = require('../src/core/watcher');
const fs = require('fs');
const path = require('path');

const os = require('os');

describe('GmailWatcher Full Flow Verification', () => {
    let watcher;
    const testLogDir = path.join(os.tmpdir(), `flow-test-logs-${Date.now()}`);

    beforeEach(() => {
        if (!fs.existsSync(testLogDir)) fs.mkdirSync(testLogDir, { recursive: true });
        
        // Mock appendFile to be safe
        jest.spyOn(fs, 'appendFileSync').mockImplementation(() => {});

        watcher = new GmailWatcher({ logDir: testLogDir });
        watcher.log = jest.fn();
    });

    test('should fetch full message content and pass it to hooks', async () => {
        const mockMessages = [
            { id: 'msg1', snippet: 'Test snippet', payload: { body: { data: 'base64data' } } }
        ];

        // Setup initial history
        watcher.lastHistoryId = 'old-history-id';

        // Mock GmailClient behavior on watcher.gmail property
        watcher.gmail.getHistory = jest.fn().mockResolvedValue([{ id: 'msg1' }]);
        
        // Mock fetchFullMessages to return our specific content
        const fetchSpy = watcher.gmail.fetchFullMessages = jest.fn()
            .mockResolvedValue(mockMessages);
            
        // Mock HookRunner to intercept what it receives
        const hookRunSpy = jest.spyOn(watcher.hookRunner, 'run')
            .mockResolvedValue();

        // Simulate incoming notification
        const message = {
            data: Buffer.from(JSON.stringify({ historyId: 'new-history-id', emailAddress: 'me' })),
            ack: jest.fn(),
            nack: jest.fn(),
            id: 'msg-id-flow'
        };

        await watcher.handleMessage(message);

        // Verification 1: fetchFullMessages was called with correct ID
        expect(fetchSpy).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ id: 'msg1' })]));

        // Verification 2: hookRunner.run received exactly what fetchFullMessages returned
        expect(hookRunSpy).toHaveBeenCalledWith(mockMessages);
    });
});
