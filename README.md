# Gmail Watcher 🦾

基於 Google Cloud Pub/Sub 的 Gmail 即時監控服務，支援自動化 Hook 擴展與 CLI 一鍵維運。

---

## 📦 安裝 (Installation)

請依序執行以下指令進行安裝：

```bash
# 1. 下載專案
git clone https://github.com/your-username/gmail-watcher.git
cd gmail-watcher

# 2. 安裝相依套件
npm install

# 3. 連結全域指令 (讓 gmail-watcher 指令生效)
npm link
```

完成後，您即可在終端機直接使用 `gmail-watcher` 指令。

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
1.  **設定 Pub/Sub 參數**：
    ```bash
    gmail-watcher config set topic "你的Topic路徑"
    gmail-watcher config set subscription "你的Sub路徑"
    ```
2.  **匯入憑證並登入**：
    ```bash
    gmail-watcher auth login --creds path/to/credentials.json
    ```
    *   **複製網址**：從終端機複製以 `https://accounts.google.com/...` 開頭的完整網址至瀏覽器。
    *   **忽略警告**：看到「Google 尚未驗證」時，點擊「進階」並選擇「前往專案（不安全）」。
    *   **複製回傳網址**：授權後若瀏覽器導向 `localhost` 顯示「無法連線」屬正常現象。請**複製瀏覽器網址列的完整 URL**，貼回終端機提示處。
3.  **啟動服務**：
    ```bash
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
      // msg 物件包含 Gmail API messages.get 回傳的完整資料
      // 常用欄位如下：
      const id = msg.id;
      const threadId = msg.threadId;
      const snippet = msg.snippet; // 郵件內文摘要
      
      // 獲取標題與寄件者 (從 payload.headers)
      const headers = msg.payload.headers;
      const subject = headers.find(h => h.name === 'Subject')?.value;
      const from = headers.find(h => h.name === 'From')?.value;

      console.log(`[Processing] From: ${from} | Subject: ${subject}`);
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
