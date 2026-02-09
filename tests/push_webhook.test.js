const request = require('supertest');
const fs = require('fs');
const path = require('path');
const GmailWatcher = require('../src/watcher');

describe('GmailWatcher Push Webhook', () => {
    let watcher;
    const logDir = path.join(__dirname, 'test_logs');
    const logFile = path.join(logDir, 'gmail.log');

    beforeEach(() => {
        if (fs.existsSync(logFile)) fs.unlinkSync(logFile);
        if (fs.existsSync(logDir)) fs.rmdirSync(logDir);
        
        watcher = new GmailWatcher({
            port: 3101,
            logDir: logDir
        });
    });

    afterEach(() => {
        if (fs.existsSync(logFile)) fs.unlinkSync(logFile);
        if (fs.existsSync(logDir)) fs.rmdirSync(logDir);
    });

    test('should process and log push notification data', async () => {
        const pushData = {
            message: {
                data: Buffer.from(JSON.stringify({
                    emailAddress: 'test@example.com',
                    historyId: '12345'
                })).toString('base64'),
                messageId: '99999'
            }
        };

        const response = await request(watcher.createApp())
            .post('/gmail/webhook')
            .send(pushData);

        expect(response.status).toBe(200);
        
        const logContent = fs.readFileSync(logFile, 'utf8');
        expect(logContent).toContain('test@example.com');
        expect(logContent).toContain('12345');
    });
});
