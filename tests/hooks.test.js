const fs = require('fs');
const path = require('path');
const GmailWatcher = require('../src/watcher');

describe('GmailWatcher Hooks', () => {
    const hooksDir = path.join(__dirname, '../hooks');
    const testHookPath = path.join(hooksDir, 'test-hook.js');
    const testLogPath = path.join(__dirname, '../test-hook.log');

    beforeAll(() => {
        if (!fs.existsSync(hooksDir)) {
            fs.mkdirSync(hooksDir, { recursive: true });
        }
        // 建立一個測試用的 hook，執行時會寫入檔案
        fs.writeFileSync(testHookPath, `
            const fs = require('fs');
            const path = require('path');
            fs.writeFileSync(path.join(__dirname, '../test-hook.log'), process.argv[2]);
        `);
        fs.chmodSync(testHookPath, '755');
    });

    afterAll(() => {
        if (fs.existsSync(testHookPath)) fs.unlinkSync(testHookPath);
        if (fs.existsSync(testLogPath)) fs.unlinkSync(testLogPath);
    });

    test('should execute hooks when a notification is logged', (done) => {
        const watcher = new GmailWatcher({ port: 9999 });
        const testData = { historyId: '12345', emailAddress: 'test@example.com' };

        watcher.logNotification(testData);

        // 因為 exec 是非同步的，稍等一下再檢查結果
        setTimeout(() => {
            try {
                expect(fs.existsSync(testLogPath)).toBe(true);
                const logContent = fs.readFileSync(testLogPath, 'utf8');
                expect(JSON.parse(logContent)).toEqual(testData);
                done();
            } catch (error) {
                done(error);
            }
        }, 1000);
    });
});
