const fs = require('fs');
const path = require('path');
const netflixHook = require('../hooks/netflix-verify.js');

// Mock external dependencies
jest.mock('puppeteer', () => ({
    launch: jest.fn().mockResolvedValue({
        newPage: jest.fn().mockResolvedValue({
            goto: jest.fn().mockResolvedValue(),
            $$: jest.fn().mockResolvedValue([]),
            evaluate: jest.fn().mockResolvedValue('page content'),
            waitForSelector: jest.fn().mockResolvedValue(),
            close: jest.fn().mockResolvedValue(),
        }),
        close: jest.fn().mockResolvedValue(),
    }),
}));

describe('Netflix Hook Skip Logic', () => {
    const { isAlreadyProcessed, saveToHistory, processMessage, HISTORY_FILE } = netflixHook;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
        
        // Clean up history file mock
        if (fs.existsSync(HISTORY_FILE)) {
            try { fs.unlinkSync(HISTORY_FILE); } catch(e) {}
        }
    });

    test('Skip Stage 1: Filter by Sender/Subject', async () => {
        const msg = { 
            payload: { 
                headers: [
                    { name: 'From', value: 'spam@example.com' },
                    { name: 'Subject', value: 'Not Netflix' }
                ] 
            } 
        };
        await processMessage(msg);
        
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining('收到郵件: Not Netflix'));
        // Should NOT reach "偵測到符合條件"
        expect(console.log).not.toHaveBeenCalledWith(expect.stringContaining('偵測到符合條件'));
    });

    test('Skip Stage 2: Filter by Content (No Link)', async () => {
        const msg = { 
            payload: { 
                headers: [
                    { name: 'From', value: 'info@netflix.com' },
                    { name: 'Subject', value: '如何更新 Netflix 同戶裝置' }
                ],
                body: { data: Buffer.from('No link here').toString('base64') }
            } 
        };
        await processMessage(msg);
        
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining('偵測到符合條件'));
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining('未能在郵件中提取驗證連結'));
        // Should NOT reach "提取新連結"
        expect(console.log).not.toHaveBeenCalledWith(expect.stringContaining('提取新連結'));
    });

    test('Skip Stage 3: Filter by History (Duplicate)', async () => {
        const link = 'https://www.netflix.com/update-primary-location?nftoken=duplicate_token';
        const msg = { 
            payload: { 
                headers: [
                    { name: 'From', value: 'info@netflix.com' },
                    { name: 'Subject', value: '如何更新 Netflix 同戶裝置' }
                ],
                body: { data: Buffer.from(`Link: ${link}`).toString('base64') }
            } 
        };

        // Pre-populate history
        saveToHistory(link);

        await processMessage(msg);
        
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining('偵測到符合條件'));
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining('連結已處理過，跳過'));
        // Should NOT reach "提取新連結" (which implies processing starts)
        expect(console.log).not.toHaveBeenCalledWith(expect.stringContaining('提取新連結'));
    });

    test('Success: Process Valid New Link', async () => {
        const link = 'https://www.netflix.com/update-primary-location?nftoken=new_token';
        const msg = { 
            payload: { 
                headers: [
                    { name: 'From', value: 'info@netflix.com' },
                    { name: 'Subject', value: '如何更新 Netflix 同戶裝置' }
                ],
                body: { data: Buffer.from(`Link: ${link}`).toString('base64') }
            } 
        };

        await processMessage(msg);
        
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining('偵測到符合條件'));
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining('提取新連結'));
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining('瀏覽器已啟動'));
    });
});
