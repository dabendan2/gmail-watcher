#!/bin/bash
set -e

echo "執行 Pre-check..."

# 1. 檢查基本依賴
if ! command -v node &> /dev/null; then
    echo "❌ 錯誤：未安裝 Node.js"
    exit 1
fi

# 2. 語法檢查 (Linting / Basic syntax check)
echo "檢查程式碼語法..."
find src -name "*.js" | xargs -n 1 node -c

echo "Pre-check 已通過。"
