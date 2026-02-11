const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

describe('Service Signal and Lifecycle Tests', () => {
    const testWorkdir = path.join(os.tmpdir(), `gmail-watcher-signal-test-${Date.now()}`);
    const daemonPath = path.resolve(__dirname, '../src/daemon.js');

    beforeAll(() => {
        if (!fs.existsSync(testWorkdir)) fs.mkdirSync(testWorkdir, { recursive: true });
        fs.writeFileSync(path.join(testWorkdir, 'config.json'), JSON.stringify({
            topic: 'projects/test/topics/test',
            subscription: 'projects/test/subscriptions/test'
        }));
        fs.writeFileSync(path.join(testWorkdir, 'credentials.json'), JSON.stringify({
            installed: { project_id: 'test-project' }
        }));
    });

    afterAll(() => {
        if (fs.existsSync(testWorkdir)) fs.rmSync(testWorkdir, { recursive: true, force: true });
    });

    test('Daemon should log SIGTERM and exit', (done) => {
        const child = spawn('node', [daemonPath, '--workdir', testWorkdir], {
            stdio: ['ignore', 'pipe', 'pipe']
        });

        let output = '';

        const handleData = (data) => {
            output += data.toString();
            // Once it's initialized (even if it errors on auth), send SIGTERM
            if (output.includes('Starting') || output.includes('Error')) {
                child.kill('SIGTERM');
            }
        };

        child.stdout.on('data', handleData);
        child.stderr.on('data', handleData);

        child.on('exit', (code, signal) => {
            // Check if SIGTERM was handled and logged
            const handled = output.includes('SIGTERM');
            expect(handled).toBe(true);
            done();
        });

        setTimeout(() => {
            if (!child.killed) child.kill('SIGKILL');
            done();
        }, 8000);
    }, 15000);
});
