#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const LOG_DIR = process.env.LOG_DIR || path.join(__dirname, '../logs');
const HISTORY_FILE = path.join(LOG_DIR, 'netflix-history.json');

// Ensure log dir exists
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

function log(message) {
    console.log(message);
}

function errorLog(message) {
    console.error(message);
}

function isAlreadyProcessed(link) {
    if (!fs.existsSync(HISTORY_FILE)) return false;
    try {
        const history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
        return Array.isArray(history) && history.includes(link);
    } catch (e) {
        return false;
    }
}

function saveToHistory(link) {
    let history = [];
    if (fs.existsSync(HISTORY_FILE)) {
        try {
            history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
            if (!Array.isArray(history)) history = [];
        } catch (e) {
            history = [];
        }
    }
    history.push(link);
    // Keep last 100
    if (history.length > 100) history = history.slice(-100);
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
}

async function processMessage(message) {
    let subject = '';
    let from = '';
    
    if (message.payload && message.payload.headers) {
        const subjectHeader = message.payload.headers.find(h => h.name === 'Subject');
        const fromHeader = message.payload.headers.find(h => h.name === 'From');
        if (subjectHeader) subject = subjectHeader.value;
        if (fromHeader) from = fromHeader.value;
    }

    log(`收到郵件: ${subject.substring(0, 20)}...`);

    // Filter logic: from netflix.com AND subject contains "如何更新 Netflix 同戶裝置"
    if (!from.includes('netflix.com') || !subject.includes('如何更新 Netflix 同戶裝置')) {
        return;
    }

    log("偵測到符合條件的 Netflix 郵件，開始處理...");

    // Decode Body
    let body = '';
    const payload = message.payload;
    if (payload.parts) {
        const part = payload.parts.find(p => p.mimeType === 'text/html') || payload.parts[0];
        if (part && part.body && part.body.data) {
            body = Buffer.from(part.body.data, 'base64').toString('utf-8');
        }
    } else if (payload.body && payload.body.data) {
        body = Buffer.from(payload.body.data, 'base64').toString('utf-8');
    }

    if (!body) {
        log("無法解析郵件內容");
        return;
    }

    // Extract Link
    const linkRegex = /https:\/\/www\.netflix\.com\/[^\s]*update-primary-location[^\s]*nftoken=[^\s\]"]+/;
    const match = body.match(linkRegex);
    
    if (!match) {
        log("未能在郵件中提取驗證連結");
        return;
    }
    
    const verifyLink = match[0];
    if (isAlreadyProcessed(verifyLink)) {
        log(`連結已處理過，跳過: ${verifyLink}`);
        return;
    }
    
    log(`提取新連結: ${verifyLink}`);

    // Puppeteer Automation
    let browser;
    try {
        const puppeteer = require('puppeteer');
        browser = await puppeteer.launch({ 
            headless: "new",
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        
        log("瀏覽器已啟動，導航至連結...");
        await page.goto(verifyLink, { waitUntil: 'networkidle0' });
        
        const buttonSelector = 'button, a[role="button"]';
        const buttons = await page.$$(buttonSelector);
        let clicked = false;

        for (const button of buttons) {
            const text = await page.evaluate(el => el.innerText, button);
            if (text.includes('確認更新') || text.includes('Confirm Update') || text.includes('是的，是我本人')) {
                log(`找到按鈕: "${text}"，執行點擊...`);
                await button.click();
                clicked = true;
                break;
            }
        }

        if (clicked) {
            log("點擊執行，監控頁面回應...");
            await Promise.race([
                page.waitForSelector('[data-uia="upl-success"]', { timeout: 10000 }),
                page.waitForSelector('[data-uia="header"]', { timeout: 10000 }),
                page.waitForSelector('[data-uia="upl-error"]', { timeout: 10000 })
            ]).catch(() => log("等待結果超時"));

            const finalContent = await page.evaluate(() => document.body.innerText);
            log(`完成。摘要: ${finalContent.substring(0, 200).replace(/\n/g, ' ')}...`);
            saveToHistory(verifyLink);
        } else {
            const pageContent = await page.evaluate(() => document.body.innerText);
            if (pageContent.toLowerCase().includes('sign in') || pageContent.includes('Email or mobile number')) {
                log(`連結已過期（導向登入畫面）`);
            } else {
                log(`未找到確認按鈕。摘要: ${pageContent.substring(0, 200).replace(/\n/g, ' ')}...`);
            }
        }

    } catch (error) {
        errorLog(`執行 Puppeteer 發生異常: ${error.stack || error.message}`);
    } finally {
        if (browser) await browser.close();
    }
}

async function run() {
    return new Promise((resolve, reject) => {
        let inputData = '';
        
        process.stdin.setEncoding('utf8');
        
        process.stdin.on('data', function(chunk) {
            inputData += chunk;
        });
        
        process.stdin.on('end', async function() {
            if (!inputData.trim()) {
                resolve();
                return;
            }
            
            try {
                const messages = JSON.parse(inputData);
                if (Array.isArray(messages)) {
                    for (const msg of messages) {
                        await processMessage(msg);
                    }
                } else if (typeof messages === 'object') {
                    await processMessage(messages);
                }
                resolve();
            } catch (e) {
                errorLog(`解析輸入失敗: ${e.message}`);
                resolve(); // Resolve even on error to finish process
            }
        });

        process.stdin.on('error', (err) => {
            errorLog(`Stdin error: ${err.message}`);
            reject(err);
        });
    });
}

if (require.main === module) {
    run();
}

module.exports = {
    isAlreadyProcessed,
    saveToHistory,
    processMessage,
    run,
    LOG_DIR,
    HISTORY_FILE
};

