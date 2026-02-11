# Gmail Watcher

基於 Google Cloud Pub/Sub 的 Gmail 即時監控服務，支援自動化 Hook 擴展與 Puppeteer 自動化流程。

## 系統架構

本專案採用模組化設計，主要由以下元件組成：

- **Watcher (`src/watcher.js`)**：核心協調者。負責管理 Pub/Sub 訂閱生命週期、處理訊息佇列 (`processQueue`) 以確保循序執行，並協調 Gmail API 與 Hooks。
- **GmailClient (`src/GmailClient.js`)**：封裝 Google API 交互邏輯，包括認證、Watch Renewal、History 查詢與完整訊息獲取。
- **HookRunner (`src/HookRunner.js`)**：負責子進程管理。將獲取的郵件內容通過 `stdin` 傳遞給 Hooks，並統一收集 `stdout`/`stderr` 至主日誌。

## 主要功能

1.  **即時監控**：透過 Google Cloud Pub/Sub Push/Pull 接收 Gmail 變更通知。
2.  **自動化處理**：
    *   **啟動檢查**：服務啟動時自動抓取最近 10 封未讀郵件。
    *   **即時觸發**：收到通知後，自動查詢 History 變更並提取完整郵件內容。
3.  **Hooks 機制**：
    *   放置於 `hooks/` 目錄下的腳本會被自動執行。
    *   **資料流**：郵件內容 (JSON Array) 經由 **Stdin** 傳入 Hook。
    *   **日誌**：Hooks 的輸出由 Watcher 統一加上標籤 (Tag) 後寫入 `logs/gmail.log`。
4.  **Netflix 自動驗證** (`hooks/netflix-verify.js`)：
    *   自動偵測 Netflix 同戶裝置驗證郵件。
    *   使用 Puppeteer 無頭瀏覽器自動點擊確認連結。
    *   智慧偵測連結失效（如導向登入頁面）並記錄日誌。

## 安裝與設定

### 1. 環境需求
- Node.js v18+
- Google Cloud Project (啟用 Gmail API, Pub/Sub API)

### 2. 認證設定
1. 在 [Google Cloud Console](https://console.cloud.google.com/) 下載 OAuth 2.0 憑證，儲存為 `credentials.json`。
2. 執行認證腳本：
   ```bash
   node src/auth.js
   ```
3. 跟隨指示完成授權，系統將生成 `token.json`。
   *注意：Scope 包含 `https://www.googleapis.com/auth/gmail.modify` 以支援自動化操作。*

### 4. 部署與同步
使用部署腳本自動完成 Pre-check、服務重啟與 Hooks 同步：
```bash
bash deploy/deploy.sh
```
部署時會自動將專案目錄下的 `hooks/` 同步至工作區 (預設為 `~/.gmail-watcher/hooks/`)。

## Hooks 擴展指南

您可以自定義 Hook 來處理特定郵件：

1.  **建立腳本**：在 `hooks/` 目錄下建立 `.js` 或其他可執行檔案。
2.  **實作邏輯**：
    *   從 **Stdin** 讀取郵件內容（JSON 陣列）。
    *   將日誌輸出至 **Stdout**，錯誤輸出至 **Stderr**。
3.  **依賴套件**：若 Hook 需要特定 npm 套件（如 Puppeteer），請確保已在專案根目錄安裝並在 Hook 中使用絕對路徑或相對專案根目錄的路徑引用。
4.  **範例樣板**：
    ```javascript
    #!/usr/bin/env node
    process.stdin.on('data', (data) => {
      const messages = JSON.parse(data);
      messages.forEach(msg => {
        console.log(`處理郵件: ${msg.id}`);
        // 您的邏輯...
      });
    });
    ```
5.  **部署**：執行 `bash deploy/deploy.sh`，腳本會自動同步並設定執行權限。

## 日誌位置
- `logs/gmail.log`: 包含 Watcher 系統日誌、Pub/Sub 事件與所有 Hooks 的執行輸出。
