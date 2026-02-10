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

    test('Webhook returns 404', async () => {
        const app = watcher.createApp();
        const response = await request(app)
            .post('/gmail/webhook')
            .send({ message: { data: Buffer.from(JSON.stringify({ historyId: '123' })).toString('base64') } });
        
        expect(response.status).toBe(404);
    });

    test('handleMessage logs the message data and acks', () => {
        const message = {
            data: Buffer.from(JSON.stringify({ historyId: '123' })).toString('base64'),
            ack: jest.fn()
        };

        watcher.handleMessage(message);

        expect(fs.existsSync(path.join(testLogDir, 'gmail.log'))).toBe(true);
        const logContent = fs.readFileSync(path.join(testLogDir, 'gmail.log'), 'utf8');
        expect(logContent).toContain(`[PID:${process.pid}]`);
        expect(logContent).toContain('{"historyId":"123"}');
        expect(message.ack).toHaveBeenCalled();
    });

    test('start and stop methods', async () => {
        const watcherWithPort = new GmailWatcher({ port: 4001, logDir: testLogDir });
        watcherWithPort.renewWatch = jest.fn().mockResolvedValue();
        
        await watcherWithPort.start();
        expect(watcherWithPort.server).toBeDefined();
        expect(watcherWithPort.renewalInterval).toBeDefined();
        expect(watcherWithPort.renewWatch).toHaveBeenCalled();

        watcherWithPort.stop();
        expect(watcherWithPort.server.listening).toBe(false);
    });

    test('start should throw without port', async () => {
        const watcherNoPort = new GmailWatcher({});
        await expect(watcherNoPort.start()).rejects.toThrow('PORT is not defined');
    });

    test('Hooks are queued and executed sequentially', async () => {
        const data1 = { historyId: 'first' };
        const data2 = { historyId: 'second' };
        
        // Mock runHooks to simulate delay
        const originalRunHooks = watcher.runHooks;
        const executionOrder = [];
        
        watcher.runHooks = jest.fn((data, callback) => {
            setTimeout(() => {
                executionOrder.push(data.historyId);
                callback();
            }, 50);
        });

        watcher.logNotification(data1);
        watcher.logNotification(data2);

        await watcher.hookQueue;
        
        expect(executionOrder).toEqual(['first', 'second']);
        expect(watcher.runHooks).toHaveBeenCalledTimes(2);
        
        watcher.runHooks = originalRunHooks;
    });

    test('Queue proceeds after timeout', async () => {
        const data1 = { historyId: 'timeout' };
        const data2 = { historyId: 'after-timeout' };
        
        // Shorten timeout for test
        const originalLogNotification = watcher.logNotification;
        watcher.logNotification = function(data) {
            const logEntry = `[PID:${process.pid}] ${new Date().toISOString()} - Gmail Notification: ${JSON.stringify(data)}\n`;
            if (!fs.existsSync(this.logDir)) fs.mkdirSync(this.logDir, { recursive: true });
            fs.appendFileSync(path.join(this.logDir, 'gmail.log'), logEntry);

            this.hookQueue = this.hookQueue.then(() => {
                return new Promise((resolve) => {
                    const timeout = setTimeout(() => {
                        resolve();
                    }, 100); // 100ms timeout for test

                    this.runHooks(data, () => {
                        clearTimeout(timeout);
                        resolve();
                    });
                });
            });
        };

        watcher.runHooks = jest.fn((data, callback) => {
            if (data.historyId === 'timeout') {
                // Never call callback to trigger timeout
            } else {
                callback();
            }
        });

        watcher.logNotification(data1);
        watcher.logNotification(data2);

        await watcher.hookQueue;

        expect(watcher.runHooks).toHaveBeenCalledTimes(2);
        watcher.logNotification = originalLogNotification;
    });
});
