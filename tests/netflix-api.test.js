const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 模擬 googleapis
jest.mock('googleapis');
jest.mock('fs', () => ({
    ...jest.requireActual('fs'),
    existsSync: jest.fn(),
    readFileSync: jest.fn(),
    appendFileSync: jest.fn(),
    mkdirSync: jest.fn(),
    writeFileSync: jest.fn(),
}));

// 模擬 puppeteer (避免在測試中啟動瀏覽器)
jest.mock('puppeteer', () => ({
    launch: jest.fn().mockResolvedValue({
        newPage: jest.fn().mockResolvedValue({
            goto: jest.fn().mockResolvedValue(),
            $$: jest.fn().mockResolvedValue([]),
            evaluate: jest.fn().mockResolvedValue(''),
            close: jest.fn().mockResolvedValue(),
        }),
        close: jest.fn().mockResolvedValue(),
    }),
}));

describe('Netflix Hook API Refactor Tests', () => {
    const hookPath = path.join(__dirname, '../hooks/netflix-verify.js');
    let mockGmail;

    beforeEach(() => {
        jest.clearAllMocks();
        
        // 模擬憑證檔案存在
        fs.existsSync.mockImplementation((p) => {
            if (p.includes('token.json') || p.includes('credentials.json')) return true;
            if (p.includes('netflix-history.json')) return false;
            return true;
        });

        fs.readFileSync.mockImplementation((p) => {
            if (p.includes('credentials.json')) {
                return JSON.stringify({ installed: { client_secret: 's', client_id: 'i', redirect_uris: ['u'] } });
            }
            if (p.includes('token.json')) return JSON.stringify({ access_token: 't' });
            return '';
        });

        // 模擬 Gmail API
        mockGmail = {
            users: {
                messages: {
                    list: jest.fn().mockResolvedValue({
                        data: { messages: [{ id: 'msg123' }] }
                    }),
                    get: jest.fn().mockResolvedValue({
                        data: {
                            payload: {
                                body: {
                                    data: Buffer.from('https://www.netflix.com/update-primary-location?nftoken=test_token').toString('base64')
                                }
                            }
                        }
                    })
                }
            }
        };
        google.gmail.mockReturnValue(mockGmail);
        google.auth.OAuth2.mockReturnValue({
            setCredentials: jest.fn()
        });
    });

    test('should fetch and extract link using Gmail API', async () => {
        // 直接 require hook 執行 (假設 hook 匯出了 run 或我們可以用其他方式觸發)
        // 由於 hook 是 IIFE 且依賴 process.argv，我們需要模擬環境
        const originalArgv = process.argv;
        process.argv = ['node', hookPath, '{"historyId":"123"}'];

        // 重新加載 hook 以執行
        jest.isolateModules(() => {
            require('../hooks/netflix-verify.js');
        });

        // 驗證 API 調用 (使用 setImmediate 確保非同步程序啟動)
        await new Promise(resolve => setImmediate(resolve));

        expect(mockGmail.users.messages.list).toHaveBeenCalledWith(expect.objectContaining({
            q: expect.stringContaining('netflix.com')
        }));
        expect(mockGmail.users.messages.get).toHaveBeenCalledWith(expect.objectContaining({
            id: 'msg123'
        }));

        process.argv = originalArgv;
    });
});
