#!/bin/bash
set -e

[ -f .env ] && export $(grep -v '^#' .env | xargs)
PORT="${PORT}"
if [ -z "$PORT" ]; then
    echo "❌ 錯誤：PORT 在 .env 中未定義。"
    exit 1
fi

echo "正在執行 Post-check: 驗證服務狀態..."

# 0. 確保部署後工作區仍是乾淨的
if [ -n "$(git status --porcelain)" ]; then
    echo "❌ 錯誤：部署後偵測到未提交的改動，請先 commit。"
    exit 1
fi

# 1. 驗證埠號監聽
for i in {1..5}; do
    if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null; then
        break
    fi
    echo "等待服務啟動... ($i/5)"
    sleep 2
done
lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null || (echo "❌ 服務未在埠號 $PORT 啟動" && exit 1)

# 2. 驗證健康檢查端點與 GIT_SHA
if [ -n "$REACT_APP_GIT_SHA" ]; then
    echo "正在驗證 Git SHA..."
    RESPONSE=$(curl -sf "http://localhost:$PORT/gmail/health")
    echo "$RESPONSE" | grep -q "$REACT_APP_GIT_SHA" || (echo "❌ SHA 不符: $RESPONSE" && exit 1)
    echo "✅ 健康檢查通過，版本一致。"
fi

# 3. 驗證 Webhook 端點 (使用外部 URL)
if [ -n "$WEBHOOK_URL" ]; then
    echo "正在驗證外部 Webhook 端點: $WEBHOOK_URL"
    curl -sf -o /dev/null "$WEBHOOK_URL" || (echo "❌ 外部 Webhook 端點驗證失敗: $WEBHOOK_URL" && exit 1)
    echo "✅ 外部 Webhook 端點驗證通過。"
fi

echo "Post-check 已完成。"
