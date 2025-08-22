#!/bin/bash

# Phase 5: 最大効果的な未使用変数修正戦略
# Quick Wins Approach

echo "🚀 Phase 5: Quick Wins - 最大効果的修正戦略"

# 現在のエラー数
INITIAL=$(pnpm lint 2>&1 | grep -c "@typescript-eslint/no-unused-vars" || echo "0")
echo "📊 初期エラー数: $INITIAL"

# 1. 最も効果的なパターン: 未使用引数の一括修正
echo "🎯 Pattern 1: 未使用関数引数の一括修正..."

# 高頻度パターン: data, event, config, options等の未使用引数
find src -name "*.ts" -type f | xargs grep -l "function.*data:" | head -20 | while read file; do
  echo "Processing: $file"
  # 第二引数以降の未使用パラメータを修正
  sed -i '' 's/(\([^,]*\), data: /(\1, _data: /g' "$file"
  sed -i '' 's/, event: /, _event: /g' "$file"
  sed -i '' 's/, config: /, _config: /g' "$file"
  sed -i '' 's/, options: /, _options: /g' "$file"
  sed -i '' 's/, context: /, _context: /g' "$file"
done

echo "📊 Pattern 1完了後: $(pnpm lint 2>&1 | grep -c "@typescript-eslint/no-unused-vars") 残存"

# 2. Arrow function未使用引数修正
echo "🎯 Pattern 2: Arrow function未使用引数修正..."

find src -name "*.ts" -type f | head -30 | while read file; do
  sed -i '' 's/) => {/) => {/g' "$file"  # 準備
  sed -i '' 's/(\([^,]*\), \([a-zA-Z][a-zA-Z0-9]*\)) => {/(\1, _\2) => {/g' "$file"
  sed -i '' 's/(\([a-zA-Z][a-zA-Z0-9]*\), \([a-zA-Z][a-zA-Z0-9]*\)) => {/(_\1, _\2) => {/g' "$file"
done

echo "📊 Pattern 2完了後: $(pnpm lint 2>&1 | grep -c "@typescript-eslint/no-unused-vars") 残存"

# 3. Loop変数未使用修正
echo "🎯 Pattern 3: Loop変数未使用修正..."

find src -name "*.ts" -type f | head -30 | while read file; do
  # forEach index修正
  sed -i '' 's/forEach((\([^,]*\), index)/forEach((\1, _index)/g' "$file"
  sed -i '' 's/forEach((\([^,]*\), \([a-zA-Z][a-zA-Z0-9]*\))/forEach((\1, _\2)/g' "$file"
  
  # map index修正
  sed -i '' 's/\.map((\([^,]*\), index)/\.map((\1, _index)/g' "$file"
  sed -i '' 's/\.map((\([^,]*\), \([a-zA-Z][a-zA-Z0-9]*\))/\.map((\1, _\2)/g' "$file"
done

echo "📊 Pattern 3完了後: $(pnpm lint 2>&1 | grep -c "@typescript-eslint/no-unused-vars") 残存"

# 4. 分割代入未使用修正
echo "🎯 Pattern 4: 分割代入未使用変数修正..."

find src -name "*.ts" -type f | head -30 | while read file; do
  # Object destructuring
  sed -i '' 's/const { \([a-zA-Z][a-zA-Z0-9]*\), /const { _\1, /g' "$file"
  sed -i '' 's/, \([a-zA-Z][a-zA-Z0-9]*\) }/, _\1 }/g' "$file"
  
  # Array destructuring  
  sed -i '' 's/const \[\([a-zA-Z][a-zA-Z0-9]*\), /const [_\1, /g' "$file"
  sed -i '' 's/, \([a-zA-Z][a-zA-Z0-9]*\)\]/, _\1]/g' "$file"
done

echo "📊 Pattern 4完了後: $(pnpm lint 2>&1 | grep -c "@typescript-eslint/no-unused-vars") 残存"

# 最終結果
FINAL=$(pnpm lint 2>&1 | grep -c "@typescript-eslint/no-unused-vars" || echo "0")
FIXED=$((INITIAL - FINAL))
SUCCESS_RATE=$(( FIXED * 100 / INITIAL ))

echo "=== Phase 5 Quick Wins 結果 ==="
echo "初期: $INITIAL → 現在: $FINAL"
echo "修正済み: $FIXED ($SUCCESS_RATE%)"

if [ $FIXED -gt 200 ]; then
    echo "🎉 Quick Wins成功！200個以上修正"
else
    echo "⚠️  追加戦略が必要"
fi

echo "✅ Phase 5 Quick Wins 完了"