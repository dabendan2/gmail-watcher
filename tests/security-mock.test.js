const { PubSub } = require('@google-cloud/pubsub');
const { google } = require('googleapis');
const GmailWatcher = require('../src/core/watcher');
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
            // Allow logging directory
            if (p.includes('/mock/logs')) return true;
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
        fs.mkdirSync.mockImplementation(() => {});

        watcher = new GmailWatcher(mockConfig);
        // Spy on internal logger to suppress console/fs
        jest.spyOn(watcher, 'log').mockImplementation(() => {});
    });

    test('start should initialize PubSub and Gmail watch with OAuth2', async () => {
        const mockOAuth2Client = {
            setCredentials: jest.fn()
        };
        google.auth.OAuth2.mockReturnValue(mockOAuth2Client);

        const mockSubscription = {
            on: jest.fn(),
            close: jest.fn().mockResolvedValue(),
            removeAllListeners: jest.fn()
        };
        
        const mockPubSubInstance = {
            subscription: jest.fn().mockReturnValue(mockSubscription),
            projectId: 'mock-project'
        };
        // Ensure ALL calls return an instance with projectId
        PubSub.mockImplementation(() => mockPubSubInstance);

        // Re-create watcher so it picks up the mocked PubSub with projectId from constructor
        watcher = new GmailWatcher(mockConfig);
        jest.spyOn(watcher, 'log').mockImplementation(() => {});

        const mockGmail = {
            users: {
                watch: jest.fn().mockResolvedValue({
                    data: { expiration: '1234567890', historyId: '12345' }
                }),
                messages: {
                    list: jest.fn().mockResolvedValue({ data: { messages: [] } })
                }
            }
        };
        google.gmail.mockReturnValue(mockGmail);
        
        // Mock getClient explicitly if needed, but since we mock googleapis, GmailClient usage of it should work.
        // However, start() calls this.gmail.getClient() then new PubSub({ authClient: auth })
        
        watcher.topicName = 'projects/mock-project/topics/gmail-notifications';

        await watcher.start();

        // Verify OAuth2 setup
        expect(google.auth.OAuth2).toHaveBeenCalled();
        // It's called inside GmailClient constructor or getClient
        
        // Verify PubSub initialization (second one in start())
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

    test('start should handle missing credentials gracefully', async () => {
        // If files are missing, GmailClient throws.
        // start() catches and rethrows.
        fs.existsSync.mockReturnValue(false); // Simulate missing files
        
        await expect(watcher.start()).rejects.toThrow();
        
        expect(watcher.log).toHaveBeenCalledWith('Watcher', expect.stringContaining('Start failed'));
    });
});
