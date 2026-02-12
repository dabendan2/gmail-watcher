const GmailWatcher = require('../src/core/watcher');
const fs = require('fs');
const path = require('path');

jest.mock('../src/core/GmailClient');
jest.mock('../src/core/HookRunner');
jest.mock('@google-cloud/pubsub'); // Mock PubSub class

describe('History ID Logic', () => {
    let watcher;
    const mockGmail = {
        getHistory: jest.fn().mockResolvedValue([]),
        fetchFullMessages: jest.fn().mockResolvedValue([]),
        watch: jest.fn(),
        listUnreadMessages: jest.fn().mockResolvedValue([]),
        getClient: jest.fn().mockResolvedValue({ auth: {} })
    };

    beforeEach(() => {
        // Clear mocks
        jest.clearAllMocks();
        
        // Mock PubSub subscription object
        const mockSubscription = {
            on: jest.fn(),
            close: jest.fn()
        };
        const { PubSub } = require('@google-cloud/pubsub');
        PubSub.mockImplementation(() => ({
            subscription: jest.fn().mockReturnValue(mockSubscription),
            projectId: 'test-project'
        }));
        
        // Mock fs stuff
        jest.spyOn(fs, 'existsSync').mockReturnValue(true);
        jest.spyOn(fs, 'readdirSync').mockReturnValue([]);
        jest.spyOn(fs, 'statSync').mockReturnValue({ isFile: () => false });
        jest.spyOn(fs, 'mkdirSync').mockImplementation(() => {});
        jest.spyOn(fs, 'appendFileSync').mockImplementation(() => {});
        
        // Mock Prototype log
        jest.spyOn(GmailWatcher.prototype, 'log').mockImplementation(() => {});

        // Inject mock gmail client
        const GmailClient = require('../src/core/GmailClient');
        GmailClient.mockImplementation(() => mockGmail);

        watcher = new GmailWatcher({ logDir: '/tmp' });
    });

    test('should query history using PREVIOUS historyId, not the new one from message', async () => {
        // Setup initial state
        watcher.lastHistoryId = '1000';
        
        const incomingHistoryId = '2000';
        const msg = { 
            data: Buffer.from(JSON.stringify({ 
                historyId: incomingHistoryId, 
                emailAddress: 'me@test.com' 
            })), 
            ack: jest.fn(),
            nack: jest.fn(),
            id: 'msg-1'
        };

        await watcher.handleMessage(msg);

        // Expectation: getHistory should be called with '1000' (last known), NOT '2000' (current)
        expect(mockGmail.getHistory).toHaveBeenCalledWith('1000');
        
        // After processing, lastHistoryId should be updated to '2000'
        expect(watcher.lastHistoryId).toBe(incomingHistoryId);
    });
    
    test('should initialize lastHistoryId on start', async () => {
        // Mock watch response to return current historyId
        mockGmail.watch.mockResolvedValue({ historyId: '500' });
        
        await watcher.start();
        
        expect(watcher.lastHistoryId).toBe('500');
    });
});
