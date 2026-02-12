const serviceCommand = require('../src/cli/service');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

jest.mock('child_process');
jest.mock('fs');

describe('CLI Service Start', () => {
    let mockProgram;
    let mockCommand;
    let actionFn;
    
    beforeEach(() => {
        jest.clearAllMocks();
        
        // Mock fs basics
        fs.existsSync.mockReturnValue(false); // No existing pid
        fs.openSync.mockReturnValue(1); // Mock log stream fd
        fs.writeFileSync.mockImplementation(() => {});
        
        // Mock program/command structure
        const mockStartCommand = {
            description: jest.fn().mockReturnThis(),
            option: jest.fn().mockReturnThis(),
            action: jest.fn((fn) => { actionFn = fn; return mockStartCommand; })
        };
        
        const mockOtherCommand = {
            description: jest.fn().mockReturnThis(),
            option: jest.fn().mockReturnThis(),
            action: jest.fn().mockReturnThis()
        };
        
        mockCommand = {
            description: jest.fn().mockReturnThis(),
            command: jest.fn((name) => {
                if (name === 'start') return mockStartCommand;
                return mockOtherCommand;
            }),
            option: jest.fn().mockReturnThis(),
            action: jest.fn(),
            parent: { parent: { opts: () => ({ workdir: '/tmp' }) } }
        };
        
        mockProgram = {
            command: jest.fn().mockReturnValue(mockCommand)
        };
        
        // Mock process.exit (so test doesn't die)
        jest.spyOn(process, 'exit').mockImplementation(() => {});
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
        
        // Initialize module to register commands and capture actionFn
        serviceCommand(mockProgram);
    });

    test('should fail fast if daemon logs startup error', async () => {
        // Setup spawn mocks
        const mockDaemon = new EventEmitter();
        mockDaemon.unref = jest.fn();
        mockDaemon.pid = 12345;
        
        const mockTail = new EventEmitter();
        mockTail.stdout = new EventEmitter();
        mockTail.kill = jest.fn();

        spawn.mockImplementation((cmd, args) => {
            if (cmd === 'node') return mockDaemon;
            if (cmd === 'tail') return mockTail;
            return new EventEmitter();
        });

        // Run start action
        const promise = actionFn({ daemon: true }, mockCommand);
        
        // Simulate failure logs detected by tail
        // Give the promise a tick to setup listeners
        await new Promise(r => setTimeout(r, 100));
        
        mockTail.stdout.emit('data', 'CRITICAL: Missing historyId in watch response');
        
        await promise;

        expect(mockTail.kill).toHaveBeenCalled(); // Ensure cleanup logic ran
        expect(console.error).toHaveBeenCalledWith(expect.stringContaining('啟動失敗'));
        expect(console.error).toHaveBeenCalledWith(expect.stringContaining('CRITICAL'));
        expect(process.exit).toHaveBeenCalledWith(1);
    });
});
