const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const netflixHook = require('../hooks/netflix-verify.js');

// Mock puppeteer
jest.mock('puppeteer', () => ({
    launch: jest.fn().mockResolvedValue({
        newPage: jest.fn().mockResolvedValue({
            goto: jest.fn().mockResolvedValue(),
            $$: jest.fn().mockResolvedValue([]),
            evaluate: jest.fn().mockResolvedValue('Confirm Update'),
            waitForSelector: jest.fn().mockResolvedValue(),
            close: jest.fn().mockResolvedValue(),
        }),
        close: jest.fn().mockResolvedValue(),
    }),
}));

describe('Netflix Hook Input Processing', () => {
    let originalStdin;

    beforeEach(() => {
        jest.resetModules();
        originalStdin = process.stdin;
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        Object.defineProperty(process, 'stdin', { value: originalStdin, configurable: true });
        jest.restoreAllMocks();
    });

    test('should extract link from JSON input via stdin', async () => {
        const inputData = JSON.stringify({
            payload: {
                headers: [
                    { name: 'From', value: 'info@netflix.com' },
                    { name: 'Subject', value: '如何更新 Netflix 同戶裝置' }
                ],
                body: {
                    data: Buffer.from('https://www.netflix.com/update-primary-location?nftoken=test_token').toString('base64')
                }
            }
        });

        // Mock stdin
        const mockStdin = new Readable();
        mockStdin._read = () => {};
        mockStdin.push(inputData);
        mockStdin.push(null);

        Object.defineProperty(process, 'stdin', { value: mockStdin, configurable: true });

        // Run the hook explicitly
        await netflixHook.run();

        expect(console.log).toHaveBeenCalledWith(expect.stringContaining('提取新連結'));
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining('https://www.netflix.com/update-primary-location?nftoken=test_token'));
    });
});
