#!/bin/bash
# deploy/deploy.sh

# 1. 強制檢查 Git 狀態
if [[ -n $(git status --porcelain) ]]; then
    echo "Error: Uncommitted changes detected. Please commit or stash before deploying."
    exit 1
fi

# 2. 獲取當前 GIT SHA
GIT_SHA=$(git rev-parse --short HEAD)
echo "Deploying version: $GIT_SHA"

# 3. 執行預檢
bash deploy/precheck.sh || exit 1

# 4. 啟動服務 (範例)
echo "Restarting service..."
# npm start & (或 pm2 restart)

# 5. 執行後檢
bash deploy/postcheck.sh

echo "Deployment finished."
