# Gmail Watcher

基於 Google Cloud Pub/Sub 的 Gmail 即時監控服務，支援自動化 Hook 擴展。

## 主要功能

1.  **即時監控**：透過 Google Cloud Pub/Sub 接收 Gmail 變更通知。
2.  **啟動檢查**：服務啟動時自動處理最近 10 封未讀郵件。
3.  **Hooks 機制**：自動執行工作區 `hooks/` 目錄下的腳本，並將郵件內容經由 Stdin 傳入。

## GCP 設定指南

要運行此服務，您需要在 Google Cloud Console 完成以下設定：

### 1. 建立專案與啟用 API
1. 前往 [Google Cloud Console](https://console.cloud.google.com/) 並建立新專案。
2. 啟用以下 API：
   - **Gmail API**
   - **Cloud Pub/Sub API**

### 2. 設定 Pub/Sub
1. 前往 **Pub/Sub > Topics**，點擊 **Create Topic**。
   - Topic ID 例如：`gmail-watch-topic`。
   - 勾選 "Add a default subscription"。
2. 前往該 Topic 的 **Permissions** 頁籤：
   - 點擊 **Add Principal**。
   - 輸入：`gmail-api-push@system.gserviceaccount.com`。
   - 角色選擇：**Pub/Sub Publisher**。
   - 這允許 Gmail API 向此 Topic 發送通知。
3. 複製 Topic 與 Subscription 的完整路徑（格式如 `projects/...`）。

### 3. 配置服務
使用 CLI 設定 Pub/Sub 參數：
```bash
gmail-watcher config set topic "projects/your-project-id/topics/your-topic-name"
gmail-watcher config set subscription "projects/your-project-id/subscriptions/your-sub-name"
```

### 4. 認證與登入
1. 前往 **APIs & Services > OAuth consent screen**：
   - 選擇 **External**，填寫必要資訊。
   - 在 **Scopes** 中加入 `https://www.googleapis.com/auth/gmail.modify`。
2. 前往 **Credentials**，點擊 **Create Credentials > OAuth client ID**：
   - Application type 選擇 **Desktop app**，下載產生的 JSON 檔案。
3. 使用 CLI 匯入憑證並完成登入：
   ```bash
   gmail-watcher auth login --creds path/to/your/downloaded_json.json
   ```
   *授權說明：*
   - 執行後會顯示授權網址，請在瀏覽器開啟。
   - 若顯示「Google 尚未驗證應用程式」，請點擊 **「進階」** 並選擇 **「前往（不安全）」**。
   - 若最終頁面顯示「無法連線」，請直接 **複製該頁面的完整網址 (URL)** 並貼回終端機。

## CLI 操作指南

安裝後即可使用 `gmail-watcher` 指令管理服務：

### 服務管理
- **啟動服務**：`gmail-watcher service start -d`
- **停止服務**：`gmail-watcher service stop`
- **查看狀態**：`gmail-watcher service status`
- **追蹤日誌**：`gmail-watcher service logs -f`
- **清理日誌**：`gmail-watcher service clean-logs`

### 服務檢查與除錯
執行 `gmail-watcher service start -d` 後，請務必確認服務是否正常運行：
1. **檢查狀態**：執行 `gmail-watcher service status`，若顯示 `Service is not running`，代表啟動失敗。
2. **查看錯誤**：若啟動失敗，請立即檢查日誌：`gmail-watcher service logs`。
   - 日誌中若出現 `[Config Error]`，代表參數設定缺失（如 topic/subscription）。
   - 日誌中若出現 `[Auth Error]`，代表憑證或權杖失效，請重新執行 `auth login`。
   - 日誌中若出現 `[Gmail API Error]`，代表 GCP 權限設定有誤（如 Pub/Sub Publisher 權限）。

### 配置管理
- **查看設定**：`gmail-watcher config list`
- **設定參數**：`gmail-watcher config set <key> <value>`

## Hooks 擴展指南

您可以自定義 Hook 來處理特定郵件，只需操作工作區目錄：

1.  **進入目錄**：預設為 `~/.gmail-watcher/hooks/`。
2.  **建立腳本**：建立可執行檔案（如 `my-hook.js`）。
3.  **實作邏輯**：從 **Stdin** 讀取郵件內容（JSON 陣列），並將結果輸出至 **Stdout**。
4.  **設定權限**：執行 `chmod +x <hook_file>`。
5.  **套用變更**：執行 `gmail-watcher service stop` 與 `start` 重啟服務。
