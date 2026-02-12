const GmailClient = require('../src/core/GmailClient');
const fs = require('fs');
const { google } = require('googleapis');

jest.mock('fs');
jest.mock('googleapis');

describe('GmailClient Error Handling', () => {
    let client;
    let mockGmail;

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Mock fs for auth
        fs.existsSync.mockReturnValue(true);
        fs.readFileSync.mockImplementation((p) => {
            if (p.includes('creds')) {
                return JSON.stringify({ installed: { client_id: 'id', client_secret: 'secret', redirect_uris: ['uri'] } });
            }
            return '{}'; // token
        });

        // Mock googleapis
        mockGmail = {
            users: {
                watch: jest.fn(),
                messages: {
                    get: jest.fn(),
                    list: jest.fn()
                },
                history: {
                    list: jest.fn()
                }
            }
        };
        google.gmail.mockReturnValue(mockGmail);
        google.auth.OAuth2.mockImplementation(() => ({ setCredentials: jest.fn() }));

        client = new GmailClient('/token', '/creds');
    });

    test('watch() should throw formatted error on API failure', async () => {
        mockGmail.users.watch.mockRejectedValue(new Error('API Down'));
        await expect(client.watch('topic')).rejects.toThrow('[Gmail API Error] Watch failed: API Down');
    });

    test('listUnreadMessages() should throw formatted error on API failure', async () => {
        mockGmail.users.messages.list.mockRejectedValue(new Error('Network Error'));
        await expect(client.listUnreadMessages()).rejects.toThrow('[Gmail API Error] List unread failed: Network Error');
    });

    test('getHistory() should throw formatted error on API failure', async () => {
        mockGmail.users.history.list.mockRejectedValue(new Error('Invalid History ID'));
        await expect(client.getHistory('123')).rejects.toThrow('[Gmail API Error] History list failed: Invalid History ID');
    });

    test('fetchFullMessages() should log error but NOT throw if single message fails', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        mockGmail.users.messages.get.mockRejectedValue(new Error('Message Not Found'));
        
        const res = await client.fetchFullMessages([{ id: 'msg1' }]);
        
        expect(res).toEqual([]); // Should return empty array, not throw
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to fetch message msg1'));
    });
    
    test('getClient() should throw if credentials missing', async () => {
        fs.existsSync.mockReturnValue(false);
        // Reset client instance to force check
        client.client = null; 
        await expect(client.getClient()).rejects.toThrow('[Auth Error]');
    });
});
