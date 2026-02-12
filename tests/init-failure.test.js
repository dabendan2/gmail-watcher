const GmailWatcher = require('../src/core/watcher');
const fs = require('fs');

jest.mock('../src/core/GmailClient');
jest.mock('../src/core/HookRunner');
jest.mock('@google-cloud/pubsub');

describe('Initialization Failure', () => {
    let watcher;
    const mockGmail = {
        getHistory: jest.fn(),
        fetchFullMessages: jest.fn(),
        watch: jest.fn(),
        listUnreadMessages: jest.fn().mockResolvedValue([]),
        getClient: jest.fn().mockResolvedValue({ auth: {} })
    };

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Mock fs
        jest.spyOn(fs, 'existsSync').mockReturnValue(true);
        jest.spyOn(fs, 'readdirSync').mockReturnValue([]);
        jest.spyOn(fs, 'statSync').mockReturnValue({ isFile: () => false });
        jest.spyOn(fs, 'mkdirSync').mockImplementation(() => {});
        jest.spyOn(fs, 'appendFileSync').mockImplementation(() => {});
        
        jest.spyOn(GmailWatcher.prototype, 'log').mockImplementation(() => {});

        const GmailClient = require('../src/core/GmailClient');
        GmailClient.mockImplementation(() => mockGmail);

        watcher = new GmailWatcher({ logDir: '/tmp' });
    });

    test('should throw and log debug info if historyId is missing in watch response', async () => {
        // Mock watch response MISSING historyId
        const badResponse = { expiration: '123456', weirdField: 'foobar' };
        mockGmail.watch.mockResolvedValue(badResponse);
        
        await expect(watcher.start()).rejects.toThrow();
        
        // We expect the error message or log to contain the stringified response
        expect(watcher.log).toHaveBeenCalledWith('Watcher', expect.stringContaining(JSON.stringify(badResponse)));
    });
});
