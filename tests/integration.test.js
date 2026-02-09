const request = require('supertest');
const GmailWatcher = require('../src/watcher');
const fs = require('fs');
const path = require('path');

describe('GmailWatcher Integration Tests', () => {
    let watcher;
    let app;
    const PORT = 3999;
    const testLogDir = path.join(__dirname, 'integration-logs');

    beforeAll(() => {
        watcher = new GmailWatcher({
            gitSha: 'int-test-sha',
            port: PORT,
            logDir: testLogDir
        });
        app = watcher.createApp();
    });

    afterAll(() => {
        if (fs.existsSync(testLogDir)) {
            fs.rmSync(testLogDir, { recursive: true, force: true });
        }
    });

    test('Full API flow: health and webhook', async () => {
        const healthRes = await request(app).get('/gmail/health');
        expect(healthRes.status).toBe(200);
        expect(healthRes.body.status).toBe('ok');

        const webhookRes = await request(app).get('/gmail/webhook');
        expect(webhookRes.status).toBe(200);
        expect(webhookRes.text).toBe('Webhook received');

        const nonExistentRes = await request(app).get('/gmail/not-found');
        expect(nonExistentRes.status).toBe(404);
    });

    test('End-to-end logging flow', () => {
        const testData = { event: 'test_event', timestamp: Date.now() };
        const message = {
            data: Buffer.from(JSON.stringify(testData)).toString('base64'),
            ack: jest.fn()
        };

        watcher.handleMessage(message);

        const logPath = path.join(testLogDir, 'gmail.log');
        expect(fs.existsSync(logPath)).toBe(true);
        const logs = fs.readFileSync(logPath, 'utf8');
        expect(logs).toContain(JSON.stringify(testData));
    });
});
