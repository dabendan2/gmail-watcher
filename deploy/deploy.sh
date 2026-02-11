#!/bin/bash
set -e

# 1. 執行部署前檢查 (保持現有邏輯)
bash deploy/precheck.sh

# 2. 確保工作區乾淨
if [ -n "$(git status --porcelain)" ]; then
    echo "❌ 錯誤：工作區尚有未提交的改動，請先 commit 再部署。"
    exit 1
fi

GIT_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
echo "開始部署 gmail-watcher (SHA: $GIT_SHA)..."

# 3. 服務更新：透過 CLI 介面操作
# 連結 CLI 到系統路徑 (若尚未連結)
if ! command -v gmail-watcher &> /dev/null; then
    echo "連結 gmail-watcher CLI..."
    npm link
fi

# 停止舊服務
echo "正在停止舊服務..."
gmail-watcher service stop || echo "服務未運行或停止失敗"

# 安裝依賴
echo "安裝依賴..."
npm install --silent

# 啟動新服務
echo "正在啟動服務..."
# 使用 -d (daemon) 模式啟動
gmail-watcher service start -d

# 等待服務啟動
sleep 3

# 4. 執行部署後驗證
bash deploy/postcheck.sh
