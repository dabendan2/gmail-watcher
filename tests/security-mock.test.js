const { PubSub } = require('@google-cloud/pubsub');
const { google } = require('googleapis');
const GmailWatcher = require('../src/watcher');
const fs = require('fs');
const path = require('path');

// Mock Google Modules
jest.mock('@google-cloud/pubsub');
jest.mock('googleapis');
jest.mock('fs');

describe('GmailWatcher Secure Mock Tests', () => {
    let watcher;
    const mockConfig = {
        projectId: 'mock-project',
        subscriptionName: 'mock-sub',
        port: 4002,
        logDir: '/mock/logs'
    };

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Setup fs mocks for auth files
        fs.existsSync.mockImplementation((p) => {
            if (p.includes('token.json') || p.includes('credentials.json')) return true;
            return false;
        });
        fs.readFileSync.mockImplementation((p) => {
            if (p.includes('credentials.json')) {
                return JSON.stringify({
                    installed: {
                        client_secret: 'sec',
                        client_id: 'id',
                        redirect_uris: ['http://localhost']
                    }
                });
            }
            if (p.includes('token.json')) return JSON.stringify({ access_token: 'abc' });
            return '';
        });

        watcher = new GmailWatcher(mockConfig);
    });

    test('renewWatch should initialize PubSub and Gmail watch with OAuth2', async () => {
        const mockOAuth2Client = {
            setCredentials: jest.fn()
        };
        google.auth.OAuth2.mockReturnValue(mockOAuth2Client);

        const mockSubscription = {
            on: jest.fn(),
            close: jest.fn().mockResolvedValue()
        };
        const mockPubSubInstance = {
            subscription: jest.fn().mockReturnValue(mockSubscription)
        };
        PubSub.mockReturnValue(mockPubSubInstance);

        const mockGmail = {
            users: {
                watch: jest.fn().mockResolvedValue({
                    data: { expiration: '1234567890' }
                })
            }
        };
        google.gmail.mockReturnValue(mockGmail);

        await watcher.renewWatch();

        // Verify OAuth2 setup
        expect(google.auth.OAuth2).toHaveBeenCalled();
        expect(mockOAuth2Client.setCredentials).toHaveBeenCalledWith({ access_token: 'abc' });

        // Verify PubSub initialization
        expect(PubSub).toHaveBeenCalledWith(expect.objectContaining({
            projectId: 'mock-project',
            authClient: mockOAuth2Client
        }));
        expect(mockPubSubInstance.subscription).toHaveBeenCalledWith('mock-sub');
        expect(mockSubscription.on).toHaveBeenCalledWith('message', expect.any(Function));

        // Verify Gmail watch call
        expect(mockGmail.users.watch).toHaveBeenCalledWith({
            userId: 'me',
            requestBody: {
                topicName: `projects/mock-project/topics/gmail-notifications`,
                labelIds: ['INBOX']
            }
        });
    });

    test('renewWatch should handle missing credentials gracefully', async () => {
        fs.existsSync.mockReturnValue(false); // Simulate missing files
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
        
        await watcher.renewWatch();
        
        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Missing token.json or credentials.json'));
        consoleErrorSpy.mockRestore();
    });
});
