const GmailWatcher = require('../src/core/watcher');
const { PubSub } = require('@google-cloud/pubsub');
const fs = require('fs');
const path = require('path');
const os = require('os');

jest.mock('@google-cloud/pubsub');
jest.mock('../src/core/GmailClient');

describe('GmailWatcher Initialization Diagnostics', () => {
    const workdir = path.join(os.tmpdir(), `tmp-auth-test-${Date.now()}`);

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
        // When new PubSub is called, it returns an object.
        // We can mock the implementation of the constructor or prototype.
        // jest.mock('@google-cloud/pubsub') returns automatic mock where PubSub is a mock constructor.
        
        // We need to spy on the constructor to capture the instance or mock implementation.
        PubSub.mockImplementation((options) => {
            return {
                projectId: options.projectId,
                authClient: options.authClient,
                subscription: jest.fn().mockReturnValue(mockSubscription),
                // Add auth property if the test expects it (though PubSub usually doesn't expose auth like this directly unless we mock it so)
                auth: { authClient: options.authClient }
            };
        });

        const watcher = new GmailWatcher({
            projectId: 'test-project',
            subscriptionName: 'test-sub',
            topicName: 'test-topic',
            workdir: workdir,
            credentialsPath: path.join(workdir, 'credentials.json'),
            tokenPath: path.join(workdir, 'token.json')
        });

        // Mock GmailClient methods
        watcher.gmail.getClient = jest.fn().mockResolvedValue({ 
            client: {}, 
            auth: mockAuth 
        });
        watcher.gmail.watch = jest.fn().mockResolvedValue({});
        watcher.gmail.listUnreadMessages = jest.fn().mockResolvedValue([]);

        await watcher.start();

        // Check if pubsub was re-initialized with new auth
        // The last call to PubSub constructor should have authClient: mockAuth
        expect(PubSub).toHaveBeenLastCalledWith(expect.objectContaining({
            authClient: mockAuth
        }));
    });
});
