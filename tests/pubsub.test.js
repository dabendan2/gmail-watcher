const request = require('supertest');
const GmailWatcher = require('../src/watcher');
const fs = require('fs');
const path = require('path');

describe('GmailWatcher PubSub Tests', () => {
    let watcher;
    const PORT = 3998;
    const testLogDir = path.join(__dirname, 'pubsub-test-logs');

    beforeAll(() => {
        watcher = new GmailWatcher({
            gitSha: 'test-sha',
            port: PORT,
            logDir: testLogDir
        });
    });

    afterAll(() => {
        if (fs.existsSync(testLogDir)) {
            fs.rmSync(testLogDir, { recursive: true, force: true });
        }
    });

    test('should process valid PubSub message and write to gmail.log', (done) => {
        const testPayload = { emailAddress: 'test@example.com', historyId: '9999' };
        const message = {
            data: Buffer.from(JSON.stringify(testPayload)).toString('base64'),
            ack: jest.fn()
        };

        watcher.handleMessage(message);

        // Wait a bit for async file write
        setTimeout(() => {
            const logPath = path.join(testLogDir, 'gmail.log');
            expect(fs.existsSync(logPath)).toBe(true);
            const content = fs.readFileSync(logPath, 'utf8');
            expect(content).toContain('"historyId":"9999"');
            expect(message.ack).toHaveBeenCalled();
            done();
        }, 100);
    });

    test('should run hooks when notification is received', (done) => {
        const hooksDir = path.join(__dirname, '../hooks');
        const testHook = path.join(hooksDir, 'test-hook-check.js');
        
        // Create a temporary hook that writes a marker file
        const markerFile = path.join(testLogDir, 'hook_ran.marker');
        fs.writeFileSync(testHook, `
            const fs = require('fs');
            fs.writeFileSync('${markerFile}', 'triggered');
        `);
        fs.chmodSync(testHook, '755');

        watcher.logNotification({ id: 'hook-test' });

        // logNotification returns a promise (this.hookQueue) but we check marker file
        setTimeout(() => {
            expect(fs.existsSync(markerFile)).toBe(true);
            fs.unlinkSync(testHook);
            done();
        }, 500);
    });
});
