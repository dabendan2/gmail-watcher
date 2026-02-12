const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

describe('CLI Integration Tests', () => {
    const testWorkdir = path.join(os.tmpdir(), `gmail-watcher-cli-test-${Date.now()}`);
    const binPath = path.resolve(__dirname, '../bin/gmail-watcher.js');
    
    // Use a helper that returns both stdout and stderr or handles failure gracefully
    const run = (args) => {
        try {
            return execSync(`node ${binPath} --workdir ${testWorkdir} ${args}`, { encoding: 'utf8', stdio: 'pipe' });
        } catch (err) {
            return err.stderr.toString() + err.stdout.toString();
        }
    };

    beforeAll(() => {
        if (!fs.existsSync(testWorkdir)) fs.mkdirSync(testWorkdir, { recursive: true });
    });

    afterAll(() => {
        if (fs.existsSync(testWorkdir)) fs.rmSync(testWorkdir, { recursive: true, force: true });
    });

    test('config set and list should work correctly', () => {
        run('config set topic projects/test-project/topics/test-topic');
        const output = run('config list');
        expect(output).toContain('projects/test-project/topics/test-topic');
    });

    test('service status should report stopped when no pid file exists', () => {
        const output = run('service status');
        expect(output).toContain('Service is stopped');
    });

    test('auth status should report missing credentials when not logged in', () => {
        const output = run('auth status');
        expect(output).toContain('Credentials missing');
    });

    test('version command should return a version/sha', () => {
        const output = run('-v');
        expect(output.trim().length).toBeGreaterThan(0);
    });

    test('service logs should accept --lines option', () => {
        // Create a dummy log file
        fs.writeFileSync(path.join(testWorkdir, 'service.log'), 'log1\nlog2\nlog3\n');
        
        // This should fail currently because --lines is not defined
        const output = run('service logs --lines 1');
        
        // Commander throws error for unknown options
        // If it fails, output will contain "error: unknown option"
        expect(output).not.toContain('error: unknown option');
    });
});
