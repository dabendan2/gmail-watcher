#!/bin/bash
set -e

# 1. 執行部署前檢查
bash deploy/precheck.sh
[ -f .env ] && export $(grep -v '^#' .env | xargs)

# 2. 確保工作區乾淨
if [ -n "$(git status --porcelain)" ]; then
    echo "❌ 錯誤：工作區尚有未提交的改動，請先 commit 再部署。"
    exit 1
fi

export REACT_APP_GIT_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
echo "開始部署 gmail-watcher (SHA: $REACT_APP_GIT_SHA)..."

# 3. 服務更新
echo "正在啟動服務..."
pgrep -f "src/index.js" | xargs -r kill -9
npm install --silent
nohup env PORT="${PORT}" GIT_SHA="$REACT_APP_GIT_SHA" node src/index.js > logs/server.log 2>&1 &
sleep 3

# 4. 執行部署後驗證
bash deploy/postcheck.sh
