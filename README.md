# Gmail Watcher

基於 Google Cloud Pub/Sub 的 Gmail 即時監控服務。

## 功能
- 即時監控 Gmail 新郵件通知
- 支援 Google Cloud Pub/Sub 整合
- 支援自定義 Hook 擴展功能
- 內建健康檢查 (Health Check) 端點

## 認證設定
1. 在 [Google Cloud Console](https://console.cloud.google.com/) 建立 OAuth 2.0 用戶端 ID。
2. 下載 JSON 認證檔案，更名為 `credentials.json` 並放置於專案根目錄。
3. 執行認證指令：`node src/auth.js`。
4. 點擊產生的網頁連結進行授權，並將授權碼貼回終端機。
5. 成功後會自動生成 `token.json`，之後服務即可正常啟動。

## 自定義 Hooks
您可以將自定義腳本放置於 `hooks/` 目錄中。當服務收到 Gmail 通知時，會自動執行該目錄下的所有腳本。
- 腳本執行時，郵件通知資料（JSON 格式）會作為第一個參數傳入。
- `hooks/` 目錄預設已加入 `.gitignore`，不會上傳至版本控制。

## 環境變數
- `GOOGLE_PROJECT_ID`: Google Cloud 專案 ID
- `GMAIL_SUBSCRIPTION_NAME`: Pub/Sub 訂閱名稱
- `GMAIL_TOPIC_NAME`: Pub/Sub 主題名稱
- `PORT`: 服務監聽埠號

## 快速開始
1. 安裝依賴：`npm install`
2. 設定 `.env` 檔案
3. 啟動服務：`npm start`

## 部署
執行 `deploy/deploy.sh` 進行自動化部署與驗證。
