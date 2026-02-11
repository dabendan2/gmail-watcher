const request = require('supertest');
const GmailWatcher = require('../src/watcher');
const fs = require('fs');
const path = require('path');

// Mock dependencies to avoid actual API calls during integration tests
jest.mock('googleapis', () => {
    return {
        google: {
            auth: { OAuth2: jest.fn(() => ({ setCredentials: jest.fn() })) },
            gmail: jest.fn(() => ({
                users: {
                    history: { list: jest.fn().mockResolvedValue({ data: {} }) },
                    messages: { get: jest.fn() }
                }
            }))
        }
    };
});

describe('GmailWatcher Integration Tests', () => {
    let watcher;
    let app;
    const PORT = 3999;
    const testLogDir = path.join(__dirname, 'integration-logs');
    const originalExistsSync = fs.existsSync;
    const originalReadFileSync = fs.readFileSync;

    beforeAll(() => {
        // Setup mock auth files
        jest.spyOn(fs, 'existsSync').mockImplementation((p) => {
            if (p.includes('token.json') || p.includes('credentials.json')) return true;
            return originalExistsSync(p);
        });
        jest.spyOn(fs, 'readFileSync').mockImplementation((p) => {
            if (p.includes('credentials.json')) return JSON.stringify({ installed: { client_id: 'id' } });
            if (p.includes('token.json')) return '{}';
            return originalReadFileSync(p);
        });

        watcher = new GmailWatcher({
            gitSha: 'int-test-sha',
            port: PORT,
            logDir: testLogDir
        });
        app = watcher.createApp();
    });

    afterAll(() => {
        jest.restoreAllMocks();
        if (originalExistsSync(testLogDir)) {
            try {
                fs.rmSync(testLogDir, { recursive: true, force: true });
            } catch (e) {}
        }
    });

    test('Full API flow: health and status', async () => {
        const healthRes = await request(app).get('/gmail/health');
        expect(healthRes.status).toBe(200);
        expect(healthRes.body.status).toBe('ok');
        expect(healthRes.body.gitSha).toBe('int-test-sha');

        const nonExistentRes = await request(app).get('/gmail/not-found');
        expect(nonExistentRes.status).toBe(404);
    });
});
