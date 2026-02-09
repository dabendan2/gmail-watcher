const request = require('supertest');
const GmailWatcher = require('../src/watcher');
const fs = require('fs');
const path = require('path');

describe('GmailWatcher Unit Tests', () => {
    let watcher;
    const testLogDir = path.join(__dirname, 'test-logs');

    beforeEach(() => {
        watcher = new GmailWatcher({
            gitSha: 'test-sha',
            logDir: testLogDir
        });
    });

    afterEach(() => {
        if (fs.existsSync(testLogDir)) {
            fs.rmSync(testLogDir, { recursive: true, force: true });
        }
    });

    test('Health check returns ok status and gitSha', async () => {
        const app = watcher.createApp();
        const response = await request(app).get('/gmail/health');
        
        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            status: 'ok',
            gitSha: 'test-sha'
        });
    });

    test('Webhook returns Webhook received', async () => {
        const app = watcher.createApp();
        const response = await request(app).get('/gmail/webhook');
        
        expect(response.status).toBe(200);
        expect(response.text).toBe('Webhook received');
    });

    test('handleMessage logs the message data and acks', () => {
        const message = {
            data: Buffer.from(JSON.stringify({ historyId: '123' })).toString('base64'),
            ack: jest.fn()
        };

        watcher.handleMessage(message);

        expect(fs.existsSync(path.join(testLogDir, 'gmail.log'))).toBe(true);
        const logContent = fs.readFileSync(path.join(testLogDir, 'gmail.log'), 'utf8');
        expect(logContent).toContain('{"historyId":"123"}');
        expect(message.ack).toHaveBeenCalled();
    });
});
