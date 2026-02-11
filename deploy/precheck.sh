#!/bin/bash
set -e

echo "執行 Pre-check..."

# 1. 驗證 credentials.json 存在
if [ ! -f credentials.json ]; then
    echo "❌ 錯誤：找不到 credentials.json 檔案。"
    echo "請確保已放置 GCP 憑證檔案。"
    exit 1
fi

echo "Pre-check 已通過。"
