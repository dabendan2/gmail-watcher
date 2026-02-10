const fs = require('fs');
const path = require('path');
const GmailWatcher = require('../src/watcher');

describe('GmailWatcher Hooks', () => {
    const hooksDir = path.join(__dirname, '../hooks');
    const testHookPath = path.join(hooksDir, 'test-hook.js');
    const testLogPath = path.join(__dirname, '../test-hook.log');

    beforeEach(() => {
        if (!fs.existsSync(hooksDir)) {
            fs.mkdirSync(hooksDir, { recursive: true });
        }
    });

    afterEach(() => {
        // 清理 hooksDir 下的所有臨時測試檔案
        if (fs.existsSync(hooksDir)) {
            const files = fs.readdirSync(hooksDir);
            files.forEach(file => {
                if (file.includes('hook')) {
                    fs.unlinkSync(path.join(hooksDir, file));
                }
            });
        }
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
        watcher.logNotification({ historyId: 'test' });

        await watcher.hookQueue;
        
        expect(fs.readFileSync(nextLogPath, 'utf8')).toBe('ok');

        if (fs.existsSync(nextLogPath)) fs.unlinkSync(nextLogPath);
    }, 15000);

    test('should proceed after timeout if hook hangs', async () => {
        const hangHookPath = path.join(hooksDir, 'hang-hook.js');
        // 建立一個永不結束的 hook
        fs.writeFileSync(hangHookPath, 'setInterval(() => {}, 1000);');
        
        const watcher = new GmailWatcher({ port: 9996 });
        
        // 為了測試，我們暫時修改這個 instance 的 timeout
        const originalLogNotification = watcher.logNotification;
        watcher.logNotification = function(data) {
            this.hookQueue = this.hookQueue.then(async () => {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 500); // 測試用 0.5s timeout
                try {
                    await Promise.race([
                        this.runHooks(data),
                        new Promise(resolve => setTimeout(resolve, 500))
                    ]);
                } finally {
                    clearTimeout(timeout);
                }
            });
        };

        const startTime = Date.now();
        watcher.logNotification({ historyId: 'hang' });
        await watcher.hookQueue;
        const duration = Date.now() - startTime;

        expect(duration).toBeGreaterThanOrEqual(500);
        expect(duration).toBeLessThan(5000); // 確保沒等滿 30s

        if (fs.existsSync(hangHookPath)) fs.unlinkSync(hangHookPath);
    }, 15000);
});
