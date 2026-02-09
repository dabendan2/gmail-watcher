# Gmail Watcher

基於 Google Cloud Pub/Sub 的 Gmail 即時監控服務，支援自動化 Hook 擴展。

## 核心設計
- **即時性**：透過 Google Cloud Pub/Sub Push Webhook 接收 Gmail 通知。
- **擴展性**：採用 Hook 模式，收到通知後自動執行 `hooks/` 目錄下的所有腳本。
- **安全性**：內建 Pre-check 檢查敏感資訊硬編碼，Post-check 驗證部署狀態。

## 安裝與設定

### 1. 環境需求
- Node.js v18+
- [gog CLI](https://github.com/openclaw/gog) (用於 Hook 內的郵件操作)

### 2. 認證設定
1. 在 [Google Cloud Console](https://console.cloud.google.com/) 建立 OAuth 2.0 用戶端 ID。
2. 下載 JSON 認證檔案，更名為 `credentials.json` 並放置於專案根目錄。
3. 執行認證指令：`node src/auth.js`。
4. 點擊產生的網頁連結進行授權，將授權碼貼回後會生成 `token.json`。

### 3. 環境設定
請參考專案根目錄下的 `.env.example` 檔案建立您的 `.env`，並確保所有變數皆已正確填寫。
```bash
cp .env.example .env
# 編輯 .env 填入正確資訊
```

### 4. Git Hooks 設定 (選配)
若要在每次 `git commit` 時自動執行測試與檢查，請執行：
```bash
cp .git/hooks/pre-commit.sample .git/hooks/pre-commit # 若無範本請參考下方說明
# 或直接建立符號連結
ln -sf ../../deploy/precheck.sh .git/hooks/pre-commit
```

## 執行方式

### 開發模式
```bash
npm install
npm start
```

### 自動化部署
執行部署腳本，將自動完成 Pre-check、重啟服務與 Post-check 驗證：
```bash
bash deploy/deploy.sh
```

## Hook 擴展介面

任何放置在 `hooks/` 目錄下的可執行檔案（`.js`, `.sh` 等）都會在收到通知時被觸發。

### 輸入 (Arguments)
- **$1**: Gmail 通知的原始 JSON 字串。
  - 格式：`{"emailAddress": "...", "historyId": 12345}`

### 輸出 (Logging)
- 服務會捕捉 Hook 的 `stdout` 並記錄至 `logs/server.log`。
- 建議 Hook 自行維護細節日誌於 `logs/` 下。

## API 端點
- `GET /gmail/health`: 服務健康檢查。
- `GET /gmail/health`: 健康檢查端點，回傳服務狀態與當前 Git SHA。

## 日誌說明
- `logs/server.log`: 服務啟動與 Hook 執行狀況。
- `logs/gmail.log`: 接收到的通知歷史紀錄 (含 PID)。
- `logs/netflix.log`: Netflix 驗證 Hook 的詳細執行日誌。
