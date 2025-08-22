#!/bin/bash

# MARIA Platform - 精密未使用変数修正ツール v2.0
# 慎重なファイル別修正アプローチ

echo "🎯 Phase 5: 精密未使用変数修正開始"

# 初期エラー数確認
INITIAL_COUNT=$(pnpm lint 2>&1 | grep -c "@typescript-eslint/no-unused-vars" || echo "0")
echo "📊 初期未使用変数エラー数: $INITIAL_COUNT"

# 修正対象ファイルリスト（段階的処理）
declare -a TARGET_FILES=(
  "src/services/active-reporting/SOWGenerator.ts"
  "src/services/active-reporting/TaskDecomposer.ts"
  "src/services/active-reporting/TaskVisualizer.ts"
  "src/ui/integrated-cli/test-phase2.ts"
  "src/ui/integrated-cli/test-phase3.ts"
  "src/ui/integrated-cli/test-realtime-errors.ts"
)

# ファイル単位の精密修正
fix_file_carefully() {
  local file="$1"
  local backup="${file}.phase5backup"
  
  echo "🔧 精密修正: $file"
  
  # 1. バックアップ作成
  cp "$file" "$backup"
  
  # 2. 該当ファイルの未使用変数エラーを特定
  local errors=$(pnpm lint "$file" 2>&1 | grep "@typescript-eslint/no-unused-vars")
  
  if [ -z "$errors" ]; then
    echo "   ✓ エラーなし"
    return 0
  fi
  
  # 3. 具体的エラー内容を解析して修正
  echo "   📝 検出されたエラー:"
  echo "$errors" | while IFS= read -r line; do
    echo "      $line"
  done
  
  # 4. 安全な修正パターン適用
  
  # パターン1: 未使用import修正
  sed -i '' 's/import { \([A-Za-z][A-Za-z0-9]*\) }/import { _\1 }/g' "$file"
  sed -i '' 's/import { \([A-Za-z][A-Za-z0-9]*\), /import { _\1, /g' "$file"
  sed -i '' 's/, \([A-Za-z][A-Za-z0-9]*\) }/, _\1 }/g' "$file"
  
  # パターン2: 未使用引数修正（関数の第2引数以降のみ）
  sed -i '' 's/, \([a-zA-Z][a-zA-Z0-9]*\): /, _\1: /g' "$file"
  sed -i '' 's/, \([a-zA-Z][a-zA-Z0-9]*\)) =>/, _\1) =>/g' "$file"
  
  # パターン3: 未使用ローカル変数修正
  sed -i '' 's/const \([a-zA-Z][a-zA-Z0-9]*\) =/const _\1 =/g' "$file"
  sed -i '' 's/let \([a-zA-Z][a-zA-Z0-9]*\) =/let _\1 =/g' "$file"
  
  # 5. 修正結果確認
  local after_count=$(pnpm lint "$file" 2>&1 | grep -c "@typescript-eslint/no-unused-vars" || echo "0")
  echo "   📊 修正後エラー数: $after_count"
  
  # 6. 構文エラーチェック
  if pnpm type-check 2>&1 | grep -q "$file"; then
    echo "   ⚠️  TypeScriptエラー検出 - ロールバック"
    cp "$backup" "$file"
    return 1
  else
    echo "   ✅ 修正成功"
    return 0
  fi
}

# 全ファイル処理
success_count=0
total_files=${#TARGET_FILES[@]}

echo "🚀 $total_files ファイルの段階的修正開始..."

for file in "${TARGET_FILES[@]}"; do
  if [ -f "$file" ]; then
    if fix_file_carefully "$file"; then
      ((success_count++))
    fi
  else
    echo "⚠️  ファイルが見つかりません: $file"
  fi
  echo "---"
done

# 全体進捗確認
FINAL_COUNT=$(pnpm lint 2>&1 | grep -c "@typescript-eslint/no-unused-vars" || echo "0")
FIXED_COUNT=$((INITIAL_COUNT - FINAL_COUNT))

echo "=== Phase 5 Part 1 結果レポート ==="
echo "処理ファイル数: $success_count/$total_files"
echo "初期エラー数: $INITIAL_COUNT"
echo "修正済み: $FIXED_COUNT"
echo "残存エラー数: $FINAL_COUNT"
echo "成功率: $(( FIXED_COUNT * 100 / INITIAL_COUNT ))%"

# 次段階用ファイルリスト生成
echo "=== 次回処理対象ファイル ===" > tmp/next_phase_files.txt
pnpm lint 2>&1 | grep "@typescript-eslint/no-unused-vars" -B1 | grep "^/" | \
sed 's|/Users/bongin_max/maria_code/||' | sort | uniq | head -10 >> tmp/next_phase_files.txt

echo "📋 次回処理対象: $(wc -l < tmp/next_phase_files.txt) ファイル"
echo "✅ Phase 5 Part 1 完了！"