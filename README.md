# Gmail Watcher 🦾

基於 Google Cloud Pub/Sub 的 Gmail 即時監控服務，支援自動化 Hook 擴展與 CLI 一鍵維運。

---

## 🚀 快速上手 (Quick Start)

### 1. GCP 雲端設定
1. **建立專案**：在 [GCP Console](https://console.cloud.google.com/) 啟用 **Gmail API** 與 **Cloud Pub/Sub API**。
2. **設定 Pub/Sub**：
   - 建立一個 Topic (例如 `gmail-watch-topic`) 並勾選 "Add a default subscription"。
   - 在 Topic 的 **Permissions** 加入 `gmail-api-push@system.gserviceaccount.com` 為 **Pub/Sub Publisher**。
   - 複製 Topic 與 Subscription 的完整路徑 (`projects/...`)。
3. **認證設定**：
   - 在 **APIs & Services > Credentials** 建立 **OAuth client ID (Desktop app)** 並下載 JSON 檔案。

### 2. 初始化與啟動
```bash
# 設定 Pub/Sub 參數
gmail-watcher config set topic "你的Topic路徑"
gmail-watcher config set subscription "你的Sub路徑"

# 匯入憑證並登入 (請依照瀏覽器指示完成授權)
gmail-watcher auth login --creds path/to/credentials.json

# 啟動服務 (背景執行)
gmail-watcher service start -d
```

---

## 🛠 維運與除錯 (Ops & Debugging)

### 服務管理
- **啟動服務**：`gmail-watcher service start [-d]` (預設前台執行，使用 `-d` 進入背景)
- **停止服務**：`gmail-watcher service stop`
- **查看狀態**：`gmail-watcher service status`
- **追蹤日誌**：`gmail-watcher service logs [-f]` (使用 `-f` 持續追蹤)
- **清理日誌**：`gmail-watcher service clean-logs`

### 故障排除 (Troubleshooting)
若服務未正常啟動，請查看日誌並尋找以下標籤：
- `[Config Error]`：參數設定缺失，請檢查 `config list`。
- `[Auth Error]`：憑證或權杖失效，請重新執行 `auth login`。
- `[Gmail API Error]`：GCP 權限有誤，請確認 **Pub/Sub Publisher** 角色已授權給 Gmail API。

### 配置與認證
- **參數設定**：`gmail-watcher config set <key> <value>`
- **列出配置**：`gmail-watcher config list`
- **認證登入**：`gmail-watcher auth login [--creds <path>]`
- **認證狀態**：`gmail-watcher auth status`
- **撤銷認證**：`gmail-watcher auth revoke`

### 全域選項
- **指定工作目錄**：`gmail-watcher --workdir <path> <command...>` (預設: `~/.gmail-watcher`)
- **查看版本**：`gmail-watcher -v`

---

## 🔌 Hooks 擴展指南 (For Humans & AI Agents)

本服務會自動執行 `~/.gmail-watcher/hooks/` 下的所有可執行腳本。

### Hook 工作規範
1. **輸入 (Input)**：郵件資料會以 JSON 陣列形式經由 `stdin` 傳入。
2. **輸出 (Output)**：請將日誌輸出至 `stdout`，錯誤輸出至 `stderr`。
3. **路徑引用**：若使用 `puppeteer` 等套件，請確保使用絕對路徑。

### 標準樣板 (Node.js)
```javascript
#!/usr/bin/env node
/**
 * 檔案位置: ~/.gmail-watcher/hooks/my-hook.js
 * 記得執行: chmod +x ~/.gmail-watcher/hooks/my-hook.js
 */
process.stdin.on('data', (data) => {
  try {
    const messages = JSON.parse(data);
    messages.forEach(msg => {
      console.log(`[Processing] ID: ${msg.id} | Snippet: ${msg.snippet}`);
      // 在此實作您的自動化邏輯
    });
  } catch (e) {
    console.error(`[Hook Error] ${e.message}`);
  }
});
```

---

## 🤖 機器人維運資訊 (For AI Agents)
- **工作區路徑**: `~/.gmail-watcher/` (儲存 config, logs, tokens)
- **Hooks 位置**: `~/.gmail-watcher/hooks/`
- **日誌檔案**: `service.log` (啟動日誌) 與 `gmail.log` (運行日誌)
- **自動化建議**: 優先透過 `gmail-watcher service logs` 獲取結構化錯誤標籤進行自我修正。
