#!/bin/bash
set -e

# 1. 確保部署後工作區仍是乾淨的
if [ -n "$(git status --porcelain)" ]; then
    echo "❌ 錯誤：部署後偵測到未提交的改動，請先 commit。"
    exit 1
fi

# 2. 使用 CLI 檢查服務狀態
echo "正在檢查服務狀態..."
if ! gmail-watcher service status | grep -q "Service is running"; then
    echo "❌ 服務未正常啟動"
    gmail-watcher service logs --lines 20
    exit 1
fi

# 3. 驗證 Git SHA
EXPECTED_SHA=$(git rev-parse --short HEAD)
RUNNING_SHA=$(gmail-watcher --version)

if [ "$EXPECTED_SHA" != "$RUNNING_SHA" ]; then
    echo "❌ 版本不符: 預期 $EXPECTED_SHA, 實際 $RUNNING_SHA"
    exit 1
fi

echo "✅ 服務運行中 (PID: $(cat ~/.gmail-watcher/service.pid))"
echo "✅ 版本一致: $RUNNING_SHA"
echo "Post-check 已完成。"
