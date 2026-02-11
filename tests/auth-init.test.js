const GmailWatcher = require('../src/core/watcher');
const { PubSub } = require('@google-cloud/pubsub');
const fs = require('fs');
const path = require('path');

jest.mock('@google-cloud/pubsub');
jest.mock('../src/core/GmailClient');

describe('GmailWatcher Initialization Diagnostics', () => {
    const workdir = path.join(__dirname, 'tmp-auth-test');

    beforeAll(() => {
        if (!fs.existsSync(workdir)) fs.mkdirSync(workdir, { recursive: true });
    });

    afterAll(() => {
        fs.rmSync(workdir, { recursive: true, force: true });
    });

    test('PubSub should be updated with the auth client from GmailClient during start', async () => {
        const mockAuth = { some: 'auth-object' };
        const mockSubscription = { on: jest.fn() };
        
        // Mock PubSub instance methods
        PubSub.prototype.subscription = jest.fn().mockReturnValue(mockSubscription);

        const watcher = new GmailWatcher({
            projectId: 'test-project',
            subscriptionName: 'test-sub',
            topicName: 'test-topic',
            workdir: workdir,
            credentialsPath: path.join(workdir, 'credentials.json'),
            tokenPath: path.join(workdir, 'token.json')
        });

        // Ensure pubsub.auth exists for the test
        watcher.pubsub.auth = {};

        // Mock GmailClient methods
        watcher.gmail.getClient = jest.fn().mockResolvedValue({ 
            client: {}, 
            auth: mockAuth 
        });
        watcher.gmail.watch = jest.fn().mockResolvedValue({});

        await watcher.start();

        // Check if pubsub.auth.authClient was set to mockAuth
        expect(watcher.pubsub.auth.authClient).toBe(mockAuth);
    });
});
