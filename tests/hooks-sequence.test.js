const fs = require('fs');
const path = require('path');
const GmailWatcher = require('../src/watcher');

describe('GmailWatcher Hooks Sequence', () => {
    let watcher;
    const logDir = path.join(__dirname, 'test-logs');
    const hooksDir = path.join(__dirname, '../hooks');

    beforeEach(() => {
        if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);
        watcher = new GmailWatcher({ logDir });
    });

    afterEach(() => {
        if (fs.existsSync(logDir)) {
            try {
                fs.rmSync(logDir, { recursive: true, force: true });
            } catch (e) {
                // Ignore cleanup errors in tests
            }
        }
    });

    test('hooks should execute sequentially (one after another)', async () => {
        const executionLog = [];
        
        // Mock child_process.exec to track execution timing
        const child_process = require('child_process');
        const originalExec = child_process.exec;
        
        jest.spyOn(child_process, 'exec').mockImplementation((cmd, callback) => {
            const hookName = cmd.includes('hook1') ? 'hook1' : 'hook2';
            executionLog.push(`start:${hookName}`);
            
            // Simulate variable execution time
            const delay = hookName === 'hook1' ? 100 : 10;
            
            setTimeout(() => {
                executionLog.push(`end:${hookName}`);
                callback(null, 'success', '');
            }, delay);
        });

        // Mock fs.readdirSync to return two fake hooks
        jest.spyOn(fs, 'readdirSync').mockReturnValue(['hook1.js', 'hook2.js']);
        jest.spyOn(fs, 'statSync').mockReturnValue({ isFile: () => true });

        // Trigger notification
        const notificationData = { historyId: '123' };
        
        // We need to wait for the hookQueue to process
        watcher.logNotification(notificationData);
        
        // Wait for the queue to finish
        await watcher.hookQueue;

        // If sequential, hook2 should start after hook1 ends
        // Expected order: start:hook1, end:hook1, start:hook2, end:hook2
        // If parallel, it might be: start:hook1, start:hook2, end:hook2, end:hook1
        expect(executionLog).toEqual([
            'start:hook1',
            'end:hook1',
            'start:hook2',
            'end:hook2'
        ]);

        child_process.exec.mockRestore();
        fs.readdirSync.mockRestore();
        fs.statSync.mockRestore();
    });
});
