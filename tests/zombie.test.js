const HookRunner = require('../src/core/HookRunner');
const path = require('path');
const fs = require('fs');
const { spawn, execSync } = require('child_process');

describe('Zombie Process Prevention', () => {
    const hooksDir = path.join(__dirname, 'fixtures');
    const logDir = path.join(__dirname, 'logs');
    let runner;
    let loggerMock;

    beforeAll(() => {
        if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);
    });

    beforeEach(() => {
        loggerMock = jest.fn();
        // Short timeout for test
        runner = new HookRunner(hooksDir, logDir, loggerMock, 1000);
        
        // Mock getHooks to return only our stubborn hook
        jest.spyOn(runner, 'getHooks').mockReturnValue(['stubborn-hook.js']);
    });

    afterEach(() => {
        // Cleanup any leftover stubborn hooks
        try {
            // Find processes running stubborn-hook.js and kill -9 them
            const output = execSync("pgrep -f stubborn-hook.js || true").toString();
            if (output) {
                const pids = output.split('\n').filter(Boolean);
                pids.forEach(pid => {
                    try { process.kill(pid, 'SIGKILL'); } catch(e) {}
                });
            }
        } catch (e) {}
    });

    test('should eventually kill a process that ignores SIGTERM', async () => {
        // This test runs the actual HookRunner with a real process spawn
        const promise = runner.run([{ id: 'test' }]);
        
        // Wait for timeout (1000ms) + force kill delay (5000ms) + generous buffer for kernel cleanup
        await new Promise(resolve => setTimeout(resolve, 9000));

        // Debug: check logs
        console.log('Logger calls:', loggerMock.mock.calls);

        // Check if process is still running
        let runningPids = execSync("pgrep -f stubborn-hook.js || true").toString().trim();
        
        if (runningPids) {
            try {
                // Verify if they really exist using ps. 
                // If ps fails (exit code 1), it means the PID is gone.
                // We use replace to handle multiple pids if any.
                execSync(`ps -fp ${runningPids.replace(/\n/g, ',')}`, { stdio: 'ignore' });
            } catch(e) {
                // If ps fails, the process is effectively gone (race condition in pgrep vs process table)
                runningPids = '';
            }
        }
        
        // If logic is correct (Zombie prevention), pid should be empty (killed).
        expect(runningPids).toBe('');
    }, 15000); // Increased Test timeout
});
