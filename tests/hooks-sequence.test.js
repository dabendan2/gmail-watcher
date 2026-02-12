const fs = require('fs');
const path = require('path');
const GmailWatcher = require('../src/core/watcher');
const child_process = require('child_process');
const { EventEmitter } = require('events');

jest.mock('child_process');

describe('GmailWatcher Hooks Sequence', () => {
    let watcher;
    const testLogDir = path.join(__dirname, 'test-logs-seq');

    beforeEach(() => {
        // Mock fs to prevent actual file writes from HookRunner logger
        jest.spyOn(fs, 'appendFileSync').mockImplementation(() => {});
        jest.spyOn(fs, 'mkdirSync').mockImplementation(() => {});

        watcher = new GmailWatcher({ logDir: testLogDir });
        jest.spyOn(watcher, 'log').mockImplementation(() => {});
        
        // Mock file system to simulate hooks
        jest.spyOn(fs, 'readdirSync').mockReturnValue(['hook1.js', 'hook2.js']);
        jest.spyOn(fs, 'statSync').mockReturnValue({ isFile: () => true });
        jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('hooks should execute sequentially', async () => {
        const executionLog = [];
        
        // Mock spawn implementation
        child_process.spawn.mockImplementation((cmd, args) => {
            const hookName = args[0].includes('hook1') ? 'hook1' : 'hook2';
            executionLog.push(`start:${hookName}`);
            
            const mockChild = new EventEmitter();
            mockChild.stdout = new EventEmitter();
            mockChild.stderr = new EventEmitter();
            mockChild.stdin = { 
                write: jest.fn(), 
                end: jest.fn() 
            };
            mockChild.kill = jest.fn();
            mockChild.killed = false;

            // Simulate process finishing after a delay
            const delay = hookName === 'hook1' ? 50 : 10;
            setTimeout(() => {
                executionLog.push(`end:${hookName}`);
                mockChild.emit('close', 0);
            }, delay);

            return mockChild;
        });

        await watcher.hookRunner.run([{ id: '123' }]);

        expect(executionLog).toEqual([
            'start:hook1',
            'end:hook1',
            'start:hook2',
            'end:hook2'
        ]);
    });
});
