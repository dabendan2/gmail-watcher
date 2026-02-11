#!/bin/bash
set -e

echo "執行部署後驗證 (Post-check)..."

# 1. 使用 CLI 檢查服務狀態
if ! gmail-watcher service status | grep -q "Service is running"; then
    echo "❌ 服務未正常啟動，請檢查日誌："
    gmail-watcher service logs --lines 20
    exit 1
fi

# 2. 驗證版本 (Git SHA)
EXPECTED_SHA=$(git rev-parse --short HEAD)
RUNNING_SHA=$(gmail-watcher --version)

if [ "$EXPECTED_SHA" != "$RUNNING_SHA" ]; then
    echo "⚠️ 警訊：版本 SHA 不符 (預期: $EXPECTED_SHA, 運行中: $RUNNING_SHA)"
    # 這裡僅警告不退出，因為可能是開發環境與執行環境的 SHA 取得方式不同
fi

echo "✅ 服務狀態正常。"
echo "Post-check 已完成。"
