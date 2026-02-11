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

### 3. 環境變數
複製 `.env.example` 並設定：
```env
PORT=3000
GMAIL_TOPIC_NAME=projects/your-project-id/topics/your-topic-name
GMAIL_SUBSCRIPTION_NAME=your-subscription-name
```

## 執行與部署

### 本地執行
```bash
npm install
npm start
```

### 自動化部署
使用部署腳本進行 Pre-check (測試)、服務重啟與 Post-check (健康檢查)：
```bash
bash deploy/deploy.sh
```

## Hook 開發指南

Hook 應為可執行腳本 (如 Node.js)，規範如下：

1.  **輸入**：從 `stdin` 讀取 JSON 字串。
    ```json
    [
      {
        "id": "msg_id",
        "snippet": "email snippet...",
        "payload": { ... }
      }
    ]
    ```
2.  **輸出**：
    *   正常日誌請輸出至 `stdout`。
    *   錯誤日誌請輸出至 `stderr`。
    *   Watcher 會自動加上 `[HookName]` 前綴並記錄。
3.  **環境變數**：
    *   `LOG_DIR`: 指向統一的日誌目錄路徑。

## 測試

專案包含完整的測試套件 (Jest)：
- **Unit Tests**: 驗證各模組邏輯。
- **Integration Tests**: 驗證 API 端點與完整流程。
- **Concurrency Tests**: 確保訊息處理的循序性。

執行測試：
```bash
npm test
```

## 日誌位置
- `logs/gmail.log`: 包含 Watcher 系統日誌、Pub/Sub 事件與所有 Hooks 的執行輸出。
