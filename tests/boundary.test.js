const GmailClient = require('../src/core/GmailClient');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

jest.mock('googleapis');
jest.mock('fs');

describe('GmailClient Boundary and Error Handling', () => {
    let client;
    const tokenPath = '/tmp/token.json';
    const credsPath = '/tmp/credentials.json';

    beforeEach(() => {
        client = new GmailClient(tokenPath, credsPath);
        fs.existsSync.mockReturnValue(true);
        fs.readFileSync.mockReturnValue(JSON.stringify({
            installed: { 
                client_id: 'id', 
                client_secret: 'secret', 
                redirect_uris: ['http://localhost'],
                project_id: 'test-project'
            }
        }));
        
        google.auth.OAuth2.mockImplementation(() => ({
            setCredentials: jest.fn()
        }));
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('watch() should throw error if topic is missing', async () => {
        await expect(client.watch(null)).rejects.toThrow("[Config Error] 'topic' is not set");
    });

    test('getClient() should throw specific error if credentials are missing', async () => {
        fs.existsSync.mockReturnValue(false);
        await expect(client.getClient()).rejects.toThrow('[Auth Error] Credentials missing');
    });

    test('listUnreadMessages() should handle API empty response', async () => {
        const mockGmail = {
            users: {
                messages: {
                    list: jest.fn().mockResolvedValue({ data: {} })
                }
            }
        };
        google.gmail.mockReturnValue(mockGmail);
        
        const messages = await client.listUnreadMessages();
        expect(messages).toEqual([]);
    });

    test('fetchFullMessages() should handle partial API failures', async () => {
        const mockGmail = {
            users: {
                messages: {
                    get: jest.fn().mockRejectedValue(new Error('API Limit Exceeded'))
                }
            }
        };
        google.gmail.mockReturnValue(mockGmail);
        
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        const messages = await client.fetchFullMessages([{ id: 'msg1' }]);
        
        expect(messages).toEqual([]);
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('API Limit Exceeded'));
        consoleSpy.mockRestore();
    });
});
