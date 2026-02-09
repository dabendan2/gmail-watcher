#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '../logs');
const LOG_FILE = path.join(LOG_DIR, 'netflix.log');
const HISTORY_FILE = path.join(LOG_DIR, 'netflix-history.json');

function logSync(message) {
    const timestamp = new Date().toISOString();
    fs.appendFileSync(LOG_FILE, `[PID:${process.pid}] ${timestamp} - ${message}\n`);
}

function isAlreadyProcessed(link) {
    if (!fs.existsSync(HISTORY_FILE)) return false;
    const history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
    return history.includes(link);
}

function saveToHistory(link) {
    let history = [];
    if (fs.existsSync(HISTORY_FILE)) {
        history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
    }
    history.push(link);
    // 保持最近 100 筆紀錄
    if (history.length > 100) history.shift();
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
}

/**
 * Netflix Verification Hook (Puppeteer)
 */
async function run() {
    if (!fs.existsSync(LOG_DIR)) {
        fs.mkdirSync(LOG_DIR, { recursive: true });
    }

    try {
        // 檢查 Puppeteer 是否可用
        let puppeteer;
        try {
            puppeteer = require('puppeteer');
        } catch (e) {
            logSync(`關鍵錯誤: 無法載入 puppeteer 套件，請執行 npm install puppeteer。詳細資訊: ${e.message}`);
            return;
        }

        const input = process.argv[2];
        if (!input) return;

        logSync("偵測到郵件通知，啟動 Netflix Puppeteer 驗證程序...");
        
        // 1. 搜尋最新郵件 (重要資訊：如何更新 Netflix 同戶裝置)
        const searchCmd = 'gog gmail messages search "from:netflix.com 如何更新 Netflix 同戶裝置" --max 1 --json';
        const searchOutput = execSync(searchCmd, { encoding: 'utf-8' });
        let searchData;
        try {
            searchData = JSON.parse(searchOutput);
        } catch (e) {
            logSync(`gog search 解析失敗，原始輸出: ${searchOutput}`);
            throw e;
        }
        const messages = searchData.messages || [];
        
        if (messages.length === 0) {
            logSync("未找到相關郵件");
            return;
        }

        const messageId = messages[0].id;
        
        // 2. 取得郵件內容並提取連結
        const getCmd = `gog gmail get ${messageId} --json`;
        const getOutput = execSync(getCmd, { encoding: 'utf-8' });
        let message;
        try {
            message = JSON.parse(getOutput);
        } catch (e) {
            logSync(`gog get 解析失敗，原始輸出: ${getOutput}`);
            throw e;
        }
        const body = message.body || '';
        
        // 提取連結 (update-primary-location 或包含 cta 的連結)
        const linkRegex = /https:\/\/www\.netflix\.com\/[^\s]*update-primary-location[^\s]*nftoken=[^\s\]"]+/;
        const match = body.match(linkRegex);
        
        if (!match) {
            logSync("未能在郵件中提取驗證連結");
            return;
        }
        
        const verifyLink = match[0];
        
        // 檢查是否已處理過
        if (isAlreadyProcessed(verifyLink)) {
            logSync(`連結已處理過，跳過: ${verifyLink}`);
            return;
        }
        
        logSync(`提取新連結: ${verifyLink}`);

        // 3. 使用 Puppeteer 點擊
        const browser = await puppeteer.launch({ 
            headless: "new",
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        
        logSync("瀏覽器已啟動，導航至連結...");
        await page.goto(verifyLink, { waitUntil: 'networkidle0' });
        
        // 尋找並點擊「確認更新」或類似按鈕
        const buttonSelector = 'button, a[role="button"]';
        const buttons = await page.$$(buttonSelector);
        let clicked = false;

        for (const button of buttons) {
            const text = await page.evaluate(el => el.innerText, button);
            if (text.includes('確認更新') || text.includes('Confirm Update') || text.includes('是的，是我本人')) {
                logSync(`找到按鈕: "${text}"，執行點擊...`);
                await button.click();
                clicked = true;
                break;
            }
        }

        if (clicked) {
            logSync("點擊執行，監控頁面回應...");
            
            // 使用 Promise.race 同時監控多個可能的結果元素，大幅縮短等待時間
            await Promise.race([
                page.waitForSelector('[data-uia="upl-success"]', { timeout: 10000 }), // 成功 / 已更新過
                page.waitForSelector('[data-uia="header"]', { timeout: 10000 }),      // 失敗 (導向登入)
                page.waitForSelector('[data-uia="upl-error"]', { timeout: 10000 })   // 失敗 (錯誤頁面)
            ]).catch(() => logSync("等待結果超時，嘗試擷取當前頁面..."));

            const finalContent = await page.evaluate(() => document.body.innerText);
            logSync(`點擊處理完成。最後頁面內容摘要: ${finalContent.substring(0, 200).replace(/\n/g, ' ')}...`);
            saveToHistory(verifyLink);
        } else {
            const pageContent = await page.evaluate(() => document.body.innerText);
            logSync(`未找到符合條件的確認按鈕。頁面內容摘要: ${pageContent.substring(0, 200).replace(/\n/g, ' ')}...`);
        }

        await browser.close();
        logSync("程序執行完畢");

    } catch (error) {
        logSync(`執行過程發生異常: ${error.stack || error.message}`);
    }
}

run();
