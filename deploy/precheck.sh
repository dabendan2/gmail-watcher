#!/bin/bash
# deploy/precheck.sh

echo "Running Pre-check..."

# 1. 偵測硬編碼敏感資訊
if grep -rE "localhost|http://127.0.0.1" src/ --exclude-dir=node_modules; then
    echo "Error: Hardcoded localhost found in src/"
    exit 1
fi

# 2. 檢查環境變數同步
if [ ! -f .env ]; then
    echo "Error: .env file missing"
    exit 1
fi

# 3. 檢查必要變數
REQUIRED_VARS=("GOOGLE_PROJECT_ID" "GMAIL_SUBSCRIPTION_NAME")
for var in "${REQUIRED_VARS[@]}"; do
    if ! grep -q "$var" .env; then
        echo "Error: Missing $var in .env"
        exit 1
    fi
done

echo "Pre-check passed."
exit 0
