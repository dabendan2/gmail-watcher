const GmailWatcher = require('../src/watcher');
const fs = require('fs');
const path = require('path');

describe('GmailWatcher Full Flow Verification', () => {
    let watcher;
    const testLogDir = path.join(__dirname, 'flow-test-logs');

    beforeEach(() => {
        if (!fs.existsSync(testLogDir)) fs.mkdirSync(testLogDir);
        watcher = new GmailWatcher({ logDir: testLogDir });
        watcher.log = jest.fn();
    });

    afterEach(() => {
        try { fs.rmSync(testLogDir, { recursive: true, force: true }); } catch (e) {}
    });

    test('should fetch full message content and pass it to hooks', async () => {
        const mockMessages = [
            { id: 'msg1', snippet: 'Test snippet', payload: { body: { data: 'base64data' } } }
        ];

        // Mock GmailClient behavior
        jest.spyOn(watcher.gmailClient, 'getClient').mockResolvedValue({ 
            client: { 
                users: { 
                    history: { 
                        list: jest.fn().mockResolvedValue({ 
                            data: { history: [{ messagesAdded: [{ message: { id: 'msg1' } }] }] } 
                        }) 
                    } 
                } 
            }, 
            auth: {} 
        });
        
        // Mock fetchFullMessages to return our specific content
        const fetchSpy = jest.spyOn(watcher.gmailClient, 'fetchFullMessages')
            .mockResolvedValue(mockMessages);
            
        // Mock HookRunner to intercept what it receives
        const hookRunSpy = jest.spyOn(watcher.hookRunner, 'run')
            .mockResolvedValue();

        // Simulate incoming notification
        const message = {
            data: Buffer.from(JSON.stringify({ historyId: 'new-history-id' })).toString('base64'),
            ack: jest.fn()
        };
        watcher.lastHistoryId = 'old-history-id';

        await watcher.handleMessage(message);

        // Verification 1: fetchFullMessages was called with correct ID
        expect(fetchSpy).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ id: 'msg1' })]));

        // Verification 2: hookRunner.run received exactly what fetchFullMessages returned
        expect(hookRunSpy).toHaveBeenCalledWith(mockMessages);
    });
});
