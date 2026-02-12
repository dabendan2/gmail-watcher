const serviceCommand = require('../src/cli/service');
const fs = require('fs');
const path = require('path');

jest.mock('fs');
// Mock process.kill so we don't kill random processes
jest.spyOn(process, 'kill').mockImplementation(() => {});

describe('CLI Commands Unit Tests', () => {
    let mockProgram;
    let commands = {};
    
    beforeEach(() => {
        jest.clearAllMocks();
        
        // Setup mock program to capture commands
        const createMockCommand = (name) => ({
            description: jest.fn().mockReturnThis(),
            option: jest.fn().mockReturnThis(),
            action: jest.fn((fn) => { commands[name] = fn; return createMockCommand(name); }),
            command: jest.fn((subName) => {
                const fullName = name ? `${name}:${subName}` : subName;
                return createMockCommand(fullName);
            })
        });

        mockProgram = {
            command: jest.fn((name) => {
                // service command returns a builder, we need to capture subcommands
                return {
                    description: jest.fn().mockReturnThis(),
                    command: jest.fn((subName) => createMockCommand(subName))
                };
            })
        };
        
        // Mock console
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
        
        // Initialize
        serviceCommand(mockProgram);
    });

    test('status should report stopped if pid file missing', () => {
        fs.existsSync.mockReturnValue(false);
        
        // invoke status action
        commands['status']({}, { context: { workdir: '/tmp' } });
        
        expect(console.log).toHaveBeenCalledWith('Service is stopped');
    });

    test('status should report running if pid exists and process alive', () => {
        fs.existsSync.mockReturnValue(true);
        fs.readFileSync.mockReturnValue('12345');
        process.kill.mockImplementation(() => true); // Success
        
        commands['status']({}, { context: { workdir: '/tmp' } });
        
        expect(console.log).toHaveBeenCalledWith('Service is running (PID: 12345)');
    });

    test('status should clean stale pid file if process dead', () => {
        fs.existsSync.mockReturnValue(true);
        fs.readFileSync.mockReturnValue('12345');
        process.kill.mockImplementation(() => { throw new Error('ESRCH'); });
        
        commands['status']({}, { context: { workdir: '/tmp' } });
        
        expect(fs.unlinkSync).toHaveBeenCalled();
    });

    test('stop should kill process and remove pid file', () => {
        fs.existsSync.mockReturnValue(true);
        fs.readFileSync.mockReturnValue('12345');
        process.kill.mockImplementation(() => true);
        
        commands['stop']({}, { context: { workdir: '/tmp' } });
        
        expect(process.kill).toHaveBeenCalledWith('12345', 'SIGTERM');
        expect(fs.unlinkSync).toHaveBeenCalled();
        expect(console.log).toHaveBeenCalledWith('Service stopped (PID: 12345)');
    });

    test('clean-logs should truncate log files', () => {
        fs.existsSync.mockReturnValue(true); // both files exist
        
        commands['clean-logs']({}, { context: { workdir: '/tmp' } });
        
        expect(fs.truncateSync).toHaveBeenCalledTimes(1); // Only service.log (gmail.log removed)
        expect(console.log).toHaveBeenCalledWith('Logs cleared.');
    });
});
