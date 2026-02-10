#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const LOG_DIR = path.join(__dirname, '../logs');
const LOG_FILE = path.join(LOG_DIR, 'netflix.log');
const HISTORY_FILE = path.join(LOG_DIR, 'netflix-history.json');
const TOKEN_PATH = path.join(__dirname, '../token.json');
const CREDENTIALS_PATH = path.join(__dirname, '../credentials.json');

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
    if (history.length > 100) history.shift();
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
}

async function getGmailClient() {
    if (!fs.existsSync(TOKEN_PATH) || !fs.existsSync(CREDENTIALS_PATH)) {
        throw new Error('Missing Gmail credentials');
    }
    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
    const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
    oAuth2Client.setCredentials(JSON.parse(fs.readFileSync(TOKEN_PATH)));
    return google.gmail({ version: 'v1', auth: oAuth2Client });
}

async function run() {
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

    let browser;
    try {
        const input = process.argv[2];
        if (!input) return;

        logSync("偵測到郵件通知，啟動 Netflix 驗證程序 (使用 Gmail API)...");
        
        const gmail = await getGmailClient();
        
        // 1. 搜尋最新郵件
        const searchRes = await gmail.users.messages.list({
            userId: 'me',
            q: 'from:netflix.com 如何更新 Netflix 同戶裝置',
            maxResults: 1
        });
        
        const messages = searchRes.data.messages || [];
        if (messages.length === 0) {
            logSync("未找到相關郵件");
            return;
        }

        const messageId = messages[0].id;
        
        // 2. 取得郵件內容
        const msgRes = await gmail.users.messages.get({
            userId: 'me',
            id: messageId
        });
        
        // 解析 Body (可能在 parts 中或直接在 body.data)
        let body = '';
        const payload = msgRes.data.payload;
        if (payload.parts) {
            const part = payload.parts.find(p => p.mimeType === 'text/html') || payload.parts[0];
            if (part && part.body && part.body.data) {
                body = Buffer.from(part.body.data, 'base64').toString('utf-8');
            }
        } else if (payload.body && payload.body.data) {
            body = Buffer.from(payload.body.data, 'base64').toString('utf-8');
        }

        // 提取連結
        const linkRegex = /https:\/\/www\.netflix\.com\/[^\s]*update-primary-location[^\s]*nftoken=[^\s\]"]+/;
        const match = body.match(linkRegex);
        
        if (!match) {
            logSync("未能在郵件中提取驗證連結");
            return;
        }
        
        const verifyLink = match[0];
        if (isAlreadyProcessed(verifyLink)) {
            logSync(`連結已處理過，跳過: ${verifyLink}`);
            return;
        }
        
        logSync(`提取新連結: ${verifyLink}`);

        // 3. 使用 Puppeteer
        const puppeteer = require('puppeteer');
        browser = await puppeteer.launch({ 
            headless: "new",
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        
        logSync("瀏覽器已啟動，導航至連結...");
        await page.goto(verifyLink, { waitUntil: 'networkidle0' });
        
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
            await Promise.race([
                page.waitForSelector('[data-uia="upl-success"]', { timeout: 10000 }),
                page.waitForSelector('[data-uia="header"]', { timeout: 10000 }),
                page.waitForSelector('[data-uia="upl-error"]', { timeout: 10000 })
            ]).catch(() => logSync("等待結果超時"));

            const finalContent = await page.evaluate(() => document.body.innerText);
            logSync(`完成。摘要: ${finalContent.substring(0, 200).replace(/\n/g, ' ')}...`);
            saveToHistory(verifyLink);
        } else {
            const pageContent = await page.evaluate(() => document.body.innerText);
            logSync(`未找到確認按鈕。摘要: ${pageContent.substring(0, 200).replace(/\n/g, ' ')}...`);
        }

    } catch (error) {
        logSync(`執行過程發生異常: ${error.stack || error.message}`);
    } finally {
        if (browser) await browser.close();
        logSync("程序執行完畢");
    }
}

run();
