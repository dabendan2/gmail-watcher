const fs = require('fs');
const path = require('path');
const GmailWatcher = require('../src/core/watcher');
const child_process = require('child_process');
const { EventEmitter } = require('events');

jest.mock('child_process');

describe('GmailWatcher Hooks Behavior', () => {
    let watcher;
    const testLogDir = path.join(__dirname, 'test-logs-behavior');

    beforeEach(() => {
        watcher = new GmailWatcher({ logDir: testLogDir });
        jest.spyOn(watcher, 'log').mockImplementation(() => {});
        jest.spyOn(fs, 'readdirSync').mockReturnValue(['hook1.js', 'hook2.js']);
        jest.spyOn(fs, 'statSync').mockReturnValue({ isFile: () => true });
        jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('should continue if a hook fails (non-zero exit)', async () => {
        const executionLog = [];
        
        child_process.spawn.mockImplementation((cmd, args) => {
            const hookName = args[0].includes('hook1') ? 'hook1' : 'hook2';
            const mockChild = new EventEmitter();
            mockChild.stdout = new EventEmitter();
            mockChild.stderr = new EventEmitter();
            mockChild.stdin = { write: jest.fn(), end: jest.fn() };
            mockChild.kill = jest.fn();
            mockChild.killed = false;

            setTimeout(() => {
                if (hookName === 'hook1') {
                    mockChild.emit('close', 1);
                } else {
                    executionLog.push('hook2-success');
                    mockChild.emit('close', 0);
                }
            }, 10);

            return mockChild;
        });

        await watcher.hookRunner.run([{ id: '123' }]);

        expect(executionLog).toContain('hook2-success');
    });

    test('should handle spawn errors gracefully', async () => {
        const executionLog = [];
        
        child_process.spawn.mockImplementation((cmd, args) => {
            const hookName = args[0].includes('hook1') ? 'hook1' : 'hook2';
            const mockChild = new EventEmitter();
            mockChild.stdout = new EventEmitter();
            mockChild.stderr = new EventEmitter();
            mockChild.stdin = { write: jest.fn(), end: jest.fn() };
            mockChild.kill = jest.fn();
            mockChild.killed = false;

            setTimeout(() => {
                if (hookName === 'hook1') {
                    mockChild.emit('error', new Error('Spawn failed'));
                } else {
                    executionLog.push('hook2-success');
                    mockChild.emit('close', 0);
                }
            }, 10);

            return mockChild;
        });

        await watcher.hookRunner.run([{ id: '123' }]);

        expect(executionLog).toContain('hook2-success');
    });
});
