const request = require('supertest');
const GmailWatcher = require('../src/watcher');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { google } = require('googleapis');

// Mock googleapis
jest.mock('googleapis', () => {
    const mAuth = { setCredentials: jest.fn() };
    const mGmail = {
        users: {
            watch: jest.fn().mockResolvedValue({ data: { historyId: '100', expiration: '123456789' } }),
            messages: {
                get: jest.fn().mockResolvedValue({
                    data: {
                        id: 'msg1',
                        payload: { headers: [{ name: 'Subject', value: 'Test Subject' }] }
                    }
                }),
                list: jest.fn().mockResolvedValue({
                    data: { messages: [] }
                })
            },
            history: {
                list: jest.fn().mockResolvedValue({
                    data: {
                        history: [
                            { messagesAdded: [{ message: { id: 'msg1' } }] }
                        ]
                    }
                })
            }
        }
    };
    return {
        google: {
            auth: { OAuth2: jest.fn(() => mAuth) },
            gmail: jest.fn(() => mGmail)
        }
    };
});

describe('GmailWatcher Unit Tests', () => {
    let watcher;
    const testLogDir = path.join(__dirname, 'test-logs');

    beforeEach(() => {
        // Mock fs methods needed for auth check
        jest.spyOn(fs, 'existsSync').mockImplementation((p) => {
            if (p.includes('token.json') || p.includes('credentials.json')) return true;
            return false;
        });
        jest.spyOn(fs, 'readFileSync').mockReturnValue('{}');
        jest.spyOn(fs, 'mkdirSync').mockImplementation(() => {});
        jest.spyOn(fs, 'appendFileSync').mockImplementation(() => {});

        watcher = new GmailWatcher({
            gitSha: 'test-sha',
            logDir: testLogDir,
            port: 4001
        });
        
        // Suppress console logs during tests
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
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

    test('handleMessage processes valid message', async () => {
        const message = {
            data: Buffer.from(JSON.stringify({ historyId: '123' })).toString('base64'),
            ack: jest.fn()
        };

        // Mock internal delegates
        watcher.gmailClient.getClient = jest.fn().mockResolvedValue({ client: {}, auth: {} });
        watcher.gmailClient.getHistory = jest.fn().mockResolvedValue([{ id: 'msg1' }]);
        watcher.gmailClient.fetchFullMessages = jest.fn().mockResolvedValue([{ id: 'msg1' }]);
        watcher.hookRunner.run = jest.fn().mockResolvedValue();

        // Set lastHistoryId so history.list logic is triggered
        watcher.lastHistoryId = '100';

        await watcher.handleMessage(message);
        await watcher.processQueue;

        expect(message.ack).toHaveBeenCalled();
        expect(watcher.gmailClient.fetchFullMessages).toHaveBeenCalled();
        expect(watcher.hookRunner.run).toHaveBeenCalledWith([{ id: 'msg1' }]);
    });

    test('handleMessage skips missing historyId', async () => {
        const message = {
            data: Buffer.from(JSON.stringify({ some: 'data' })).toString('base64'),
            ack: jest.fn()
        };

        await watcher.handleMessage(message);
        // No queue processing expected here as it returns early

        expect(message.ack).toHaveBeenCalled();
        expect(fs.appendFileSync).not.toHaveBeenCalledWith(
            expect.stringContaining('gmail.log'), 
            expect.stringContaining('Notification received')
        );
    });

    test('handleMessage logs error on invalid JSON', async () => {
        const message = {
            data: Buffer.from('invalid-json').toString('base64'),
            ack: jest.fn()
        };
        
        await watcher.handleMessage(message);
        // No queue processing expected here
        
        expect(message.ack).toHaveBeenCalled();
        expect(fs.appendFileSync).toHaveBeenCalledWith(
            expect.stringContaining('gmail.log'),
            expect.stringContaining('Failed to parse PubSub message data')
        );
    });

    test('start initializes server and watch', async () => {
        const mockServer = {
            listen: jest.fn((port, cb) => { cb(); return mockServer; }),
            close: jest.fn()
        };
        jest.spyOn(http, 'createServer').mockReturnValue(mockServer);
        
        // Mock internal methods
        watcher.renewWatch = jest.fn().mockResolvedValue();
        watcher.fetchInitialMessages = jest.fn().mockResolvedValue();

        await watcher.start();

        expect(mockServer.listen).toHaveBeenCalledWith(4001, expect.any(Function));
        expect(watcher.renewWatch).toHaveBeenCalled();
        expect(watcher.fetchInitialMessages).toHaveBeenCalled();
    });

    test('stop closes resources', async () => {
        const mockServer = { close: jest.fn() };
        watcher.server = mockServer;
        watcher.subscription = { removeAllListeners: jest.fn(), close: jest.fn() };
        watcher.renewalInterval = setInterval(() => {}, 1000);

        watcher.stop();

        expect(mockServer.close).toHaveBeenCalled();
        expect(watcher.subscription.close).toHaveBeenCalled();
        clearInterval(watcher.renewalInterval);
    });
});
