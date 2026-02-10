#!/bin/bash
set -e

# 1. 驗證 .env 檔案存在且所有變數皆有值
echo "正在執行 Pre-check: 檢查環境變數..."
if [ ! -f .env ]; then
    echo "❌ 錯誤：找不到 .env 檔案。"
    exit 1
fi

# 讀取所有非註解行，並驗證其值不為空
while read -r line || [ -n "$line" ]; do
    var_name=$(echo "$line" | cut -d'=' -f1)
    var_value=$(echo "$line" | cut -d'=' -f2-)
    if [ -z "$var_value" ]; then
        echo "❌ 錯誤：變數 $var_name 在 .env 中未定義值。"
        exit 1
    fi
done <<< "$(grep -v '^#' .env | grep '=')"

# 2. 檢查硬編碼變數 (透過 git grep 自動排除 .gitignore 檔案)
echo "正在執行 Pre-check: 檢查硬編碼變數..."
ENV_VALUES=$(grep -v '^#' .env | grep '=' | cut -d'=' -f2- | grep -v '^$' | sed "s/['\"]//g")

while read -r val; do
    [ -z "$val" ] && continue
    # 僅檢查受 Git 追蹤的檔案，排除 .env 及本地健康檢查端點
    if git grep -F "$val" -- . ':(exclude).env' | grep -v "http://localhost:[0-9]*/gmail/health" | grep -q .; then
        echo "❌ 錯誤：偵測到硬編碼敏感資訊 \"$val\" 存在於受追蹤檔案中："
        git grep -F "$val" -- . ':(exclude).env' | grep -v "http://localhost:[0-9]*/gmail/health"
        exit 1
    fi
done <<< "$ENV_VALUES"

echo "正在執行 Pre-check: 執行單元測試..."
npm test -- --forceExit || (echo "❌ 錯誤：單元測試未全數通過。" && exit 1)

echo "Pre-check 已通過。"
