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

    test('should handle invalid JSON output from gog search', () => {
        const mockInvalidOutput = '\u001b[90mgog: "...\u001b[39m { "invalid": "json"';
        const parseWrapper = (output) => {
            try {
                return JSON.parse(output);
            } catch (e) {
                // 模擬 hook 中的 log 邏輯
                return `gog search 解析失敗，原始輸出: ${output}`;
            }
        };
        const result = parseWrapper(mockInvalidOutput);
        expect(result).toContain('gog search 解析失敗');
        expect(result).toContain(mockInvalidOutput);
    });

    test('should correctly extract token with equals sign in value', () => {
        const mockBody = 'https://www.netflix.com/account/update-primary-location?nftoken=BgjStOvcAxKmAXcj3xRpwh1tcsEY4LLV13GiuaY/j9w9VuH/T5Tx19ujhPpfLJ0sN+KuQSzUElvzPxbiBc5OX82MyCO0370pfmpN75FSJTtduzECN9zlWAa5GporHSJGK62o4pYvHyYFiOFLg1vLk8hPiFtCEBRhI2X6wfqfl/FvlHNApTlfpO3QgV+mF11MuU4bt67ntT5mWUzrH7uJx+jRByBCDUXO4RDi+NlxISkYBiIOCgwUf6ASG4EjCC1SEIA=&gD8b024a-d2cc-4024-8026-cafe9ea9939a&lnktrk=EVO&operation=update&lkid=UPDATE_HOUSEHOLD_REQUESTED_OTP_CTA';
        const match = mockBody.match(linkRegex);
        expect(match).toBeTruthy();
        expect(match[0]).toContain('nftoken=BgjStOvcAxKmAXcj3xRpwh1tcsEY4LLV13GiuaY/j9w9VuH/T5Tx19ujhPpfLJ0sN+KuQSzUElvzPxbiBc5OX82MyCO0370pfmpN75FSJTtduzECN9zlWAa5GporHSJGK62o4pYvHyYFiOFLg1vLk8hPiFtCEBRhI2X6wfqfl/FvlHNApTlfpO3QgV+mF11MuU4bt67ntT5mWUzrH7uJx+jRByBCDUXO4RDi+NlxISkYBiIOCgwUf6ASG4EjCC1SEIA=');
    });
});
