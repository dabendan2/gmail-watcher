#!/bin/bash
# deploy/postcheck.sh

echo "Running Post-check..."

# 1. 檢查程序是否運行 (簡單邏輯)
if ! pgrep -f "node src/index.js" > /dev/null; then
    echo "Warning: gmail-watcher process not detected."
fi

# 2. 檢查日誌目錄與檔案
if [ ! -d logs ] || [ ! -f logs/gmail.log ]; then
    echo "Info: Logs directory or gmail.log not initialized yet."
fi

echo "Post-check complete."
exit 0
