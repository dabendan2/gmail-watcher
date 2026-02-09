const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 這裡我們不直接 require netflix-verify.js 因為它是個立即執行的腳本
// 我們建立一個測試專用的檔案來驗證其內部的 Regex 邏輯
describe('Netflix Hook Logic (Regex & Extraction)', () => {
    const linkRegex = /https:\/\/www\.netflix\.com\/[^\s]*update-primary-location[^\s]*nftoken=[^\s\]"]+/;

    test('should correctly extract verification link from email body', () => {
        const mockBody = `
            您好，
            請點擊以下連結更新您的同戶裝置：
            https://www.netflix.com/account/update-primary-location?nftoken=TEST_TOKEN_123&lnktrk=EVO
            謝謝。
        `;
        const match = mockBody.match(linkRegex);
        expect(match).toBeTruthy();
        expect(match[0]).toBe('https://www.netflix.com/account/update-primary-location?nftoken=TEST_TOKEN_123&lnktrk=EVO');
    });

    test('should handle links with complex query parameters', () => {
        const mockBody = 'Click here: https://www.netflix.com/account/update-primary-location?nftoken=ABC-123_456=&g=789&lnktrk=EVO&operation=update . Done.';
        const match = mockBody.match(linkRegex);
        expect(match).toBeTruthy();
        expect(match[0]).toBe('https://www.netflix.com/account/update-primary-location?nftoken=ABC-123_456=&g=789&lnktrk=EVO&operation=update');
    });

    test('should not match invalid links', () => {
        const mockBody = 'https://www.netflix.com/browse?nftoken=123'; // Missing update-primary-location
        const match = mockBody.match(linkRegex);
        expect(match).toBeNull();
    });
});
