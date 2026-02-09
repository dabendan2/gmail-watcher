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

    test('should continue queue if a hook fails (non-zero exit)', async () => {
        const failHookPath = path.join(hooksDir, 'fail-hook.sh');
        const nextHookPath = path.join(hooksDir, 'next-hook.js');
        const nextLogPath = path.join(__dirname, '../next-hook.log');

        fs.writeFileSync(failHookPath, '#!/bin/bash\nexit 1');
        fs.chmodSync(failHookPath, '755');
        fs.writeFileSync(nextHookPath, `require("fs").writeFileSync("${nextLogPath}", "ok")`);

        const watcher = new GmailWatcher({ port: 9997 });
        watcher.logNotification({ id: 'test' });

        await watcher.hookQueue;
        
        expect(fs.readFileSync(nextLogPath, 'utf8')).toBe('ok');

        if (fs.existsSync(failHookPath)) fs.unlinkSync(failHookPath);
        if (fs.existsSync(nextHookPath)) fs.unlinkSync(nextHookPath);
        if (fs.existsSync(nextLogPath)) fs.unlinkSync(nextLogPath);
    });

    test('should proceed after timeout if hook hangs', async () => {
        const hangHookPath = path.join(hooksDir, 'hang-hook.js');
        // 建立一個永不結束的 hook
        fs.writeFileSync(hangHookPath, 'setInterval(() => {}, 1000);');
        
        const watcher = new GmailWatcher({ port: 9996 });
        
        // 為了測試，我們暫時修改這個 instance 的 timeout
        const originalLogNotification = watcher.logNotification;
        watcher.logNotification = function(data) {
            this.hookQueue = this.hookQueue.then(() => {
                return new Promise((resolve) => {
                    const timeout = setTimeout(() => resolve(), 500); // 測試用 0.5s timeout
                    this.runHooks(data, () => {
                        clearTimeout(timeout);
                        resolve();
                    });
                });
            });
        };

        const startTime = Date.now();
        watcher.logNotification({ id: 'hang' });
        await watcher.hookQueue;
        const duration = Date.now() - startTime;

        expect(duration).toBeGreaterThanOrEqual(500);
        expect(duration).toBeLessThan(2000); // 確保沒等滿 30s

        if (fs.existsSync(hangHookPath)) fs.unlinkSync(hangHookPath);
    });
});
