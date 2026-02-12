const GmailWatcher = require('../src/core/watcher');
const fs = require('fs');
const path = require('path');

jest.mock('../src/core/GmailClient');
jest.mock('../src/core/HookRunner');
jest.mock('@google-cloud/pubsub');

describe('Logging Behavior', () => {
    let watcher;
    
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(fs, 'appendFileSync').mockImplementation(() => {});
        jest.spyOn(console, 'log').mockImplementation(() => {});
        
        watcher = new GmailWatcher({ logDir: '/tmp' });
    });

    test('log() should output to console only, not to gmail.log file', () => {
        watcher.log('Test', 'Hello World');
        
        // Console.log should be called (redirected to service.log by daemon)
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Hello World'));
        
        // fs.appendFileSync should NOT be called (no duplicate file write)
        expect(fs.appendFileSync).not.toHaveBeenCalled();
    });
});
