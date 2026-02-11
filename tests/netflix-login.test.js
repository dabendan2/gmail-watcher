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

describe('Netflix Hook Login Redirect Logic', () => {
    const { processMessage } = netflixHook;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    test('should log "expired" when redirected to login page', async () => {
        const puppeteer = require('puppeteer');
        puppeteer.launch.mockResolvedValue({
            newPage: jest.fn().mockResolvedValue({
                goto: jest.fn(),
                $$: jest.fn().mockResolvedValue([]), // No buttons found
                evaluate: jest.fn().mockResolvedValue('Netflix Enter your info to sign in Or get started'),
                close: jest.fn()
            }),
            close: jest.fn()
        });

        const msg = { 
            payload: { 
                headers: [
                    { name: 'From', value: 'info@netflix.com' },
                    { name: 'Subject', value: '如何更新 Netflix 同戶裝置' }
                ],
                body: { data: Buffer.from('Link: https://www.netflix.com/update-primary-location?nftoken=123').toString('base64') }
            } 
        };

        await processMessage(msg);
        
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining('連結已過期（導向登入畫面）'));
    });

    test('should log "not found" summary for other content', async () => {
        const puppeteer = require('puppeteer');
        puppeteer.launch.mockResolvedValue({
            newPage: jest.fn().mockResolvedValue({
                goto: jest.fn(),
                $$: jest.fn().mockResolvedValue([]), // No buttons found
                evaluate: jest.fn().mockResolvedValue('Some other random page content'),
                close: jest.fn()
            }),
            close: jest.fn()
        });

        const msg = { 
            payload: { 
                headers: [
                    { name: 'From', value: 'info@netflix.com' },
                    { name: 'Subject', value: '如何更新 Netflix 同戶裝置' }
                ],
                body: { data: Buffer.from('Link: https://www.netflix.com/update-primary-location?nftoken=123').toString('base64') }
            } 
        };

        await processMessage(msg);
        
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining('未找到確認按鈕。摘要: Some other random page content'));
    });
});
