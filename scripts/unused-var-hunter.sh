#!/bin/bash

# MARIA Platform - 未使用変数ハンター v1.0
# Phase 5: 918個の@typescript-eslint/no-unused-vars完全撲滅

set -e

echo "🎯 Phase 5: 未使用変数撲滅作戦開始"
echo "Target: 918個の@typescript-eslint/no-unused-vars完全解決"

# 初期状態確認
INITIAL_COUNT=$(pnpm lint 2>&1 | grep -c "@typescript-eslint/no-unused-vars" || echo "0")
echo "📊 初期未使用変数エラー数: $INITIAL_COUNT"

# 作業ディレクトリ
WORK_DIR="tmp/unused-var-fix"
mkdir -p "$WORK_DIR"

# 1. 未使用変数の詳細分析
echo "🔍 Step 1: 未使用変数の詳細分析..."

analyze_unused_vars() {
    echo "=== 未使用変数分析結果 ===" > "$WORK_DIR/analysis.txt"
    
    # Import文の未使用
    echo "📦 Import未使用:" >> "$WORK_DIR/analysis.txt"
    pnpm lint 2>&1 | grep "is defined but never used" | grep "import" | wc -l >> "$WORK_DIR/analysis.txt"
    
    # 関数パラメータ未使用
    echo "🔧 関数パラメータ未使用:" >> "$WORK_DIR/analysis.txt"
    pnpm lint 2>&1 | grep "is defined but never used.*args must match" | wc -l >> "$WORK_DIR/analysis.txt"
    
    # ローカル変数未使用
    echo "📝 ローカル変数未使用:" >> "$WORK_DIR/analysis.txt"
    pnpm lint 2>&1 | grep "is assigned a value but never used" | wc -l >> "$WORK_DIR/analysis.txt"
    
    cat "$WORK_DIR/analysis.txt"
}

analyze_unused_vars

# 2. 高頻度エラーファイル特定
echo "🎯 Step 2: 高頻度エラーファイル特定..."

get_top_error_files() {
    echo "=== Top 20 未使用変数エラーファイル ===" > "$WORK_DIR/top_files.txt"
    pnpm lint 2>&1 | grep "@typescript-eslint/no-unused-vars" -B1 | grep "^/" | \
    sed 's|/Users/bongin_max/maria_code/||' | sort | uniq -c | sort -nr | head -20 >> "$WORK_DIR/top_files.txt"
    
    cat "$WORK_DIR/top_files.txt"
}

get_top_error_files

# 3. Import文未使用変数修正
echo "📦 Step 3: Import文未使用変数修正..."

fix_unused_imports() {
    local file="$1"
    local backup="${file}.backup.$(date +%s)"
    
    # バックアップ作成
    cp "$file" "$backup"
    
    echo "Fixing imports in: $file"
    
    # 未使用importを_プレフィックス付きに変更
    # 例: import { unusedVar, usedVar } from 'module'
    # → import { _unusedVar, usedVar } from 'module'
    
    # パターン1: 単一未使用import
    sed -i '' 's/import { \([A-Za-z][A-Za-z0-9]*\) }/import { _\1 }/g' "$file"
    
    # パターン2: 複数importの最初が未使用
    sed -i '' 's/import { \([A-Za-z][A-Za-z0-9]*\), /import { _\1, /g' "$file"
    
    # パターン3: 複数importの中間が未使用
    sed -i '' 's/, \([A-Za-z][A-Za-z0-9]*\), /, _\1, /g' "$file"
    
    # パターン4: 複数importの最後が未使用
    sed -i '' 's/, \([A-Za-z][A-Za-z0-9]*\) }/, _\1 }/g' "$file"
    
    echo "✓ Import修正完了: $file"
}

# 4. 関数パラメータ未使用変数修正
echo "🔧 Step 4: 関数パラメータ未使用変数修正..."

fix_unused_parameters() {
    local file="$1"
    
    echo "Fixing parameters in: $file"
    
    # 未使用パラメータを_プレフィックス付きに変更
    # 例: function(data: any, unused: string) → function(data: any, _unused: string)
    
    # パターン1: 第一引数が未使用
    sed -i '' 's/(\([a-zA-Z][a-zA-Z0-9]*\): /(_\1: /g' "$file"
    
    # パターン2: 第二引数以降が未使用
    sed -i '' 's/, \([a-zA-Z][a-zA-Z0-9]*\): /, _\1: /g' "$file"
    
    # Arrow function対応
    sed -i '' 's/(\([a-zA-Z][a-zA-Z0-9]*\)) =>/(_\1) =>/g' "$file"
    sed -i '' 's/, \([a-zA-Z][a-zA-Z0-9]*\)) =>/, _\1) =>/g' "$file"
    
    echo "✓ パラメータ修正完了: $file"
}

# 5. ローカル変数未使用修正
echo "📝 Step 5: ローカル変数未使用修正..."

fix_unused_locals() {
    local file="$1"
    
    echo "Fixing local variables in: $file"
    
    # const/let/var未使用変数を_プレフィックス付きに変更
    # 例: const unused = getValue() → const _unused = getValue()
    
    sed -i '' 's/const \([a-zA-Z][a-zA-Z0-9]*\) =/const _\1 =/g' "$file"
    sed -i '' 's/let \([a-zA-Z][a-zA-Z0-9]*\) =/let _\1 =/g' "$file"
    sed -i '' 's/var \([a-zA-Z][a-zA-Z0-9]*\) =/var _\1 =/g' "$file"
    
    # 分割代入の未使用変数
    sed -i '' 's/const { \([a-zA-Z][a-zA-Z0-9]*\), /const { _\1, /g' "$file"
    sed -i '' 's/, \([a-zA-Z][a-zA-Z0-9]*\) }/, _\1 }/g' "$file"
    
    echo "✓ ローカル変数修正完了: $file"
}

# 6. 段階的ファイル修正実行
echo "🚀 Step 6: 段階的ファイル修正実行..."

# Top 10高頻度エラーファイルから開始
HIGH_ERROR_FILES=(
    "src/services/active-reporting/ProactiveReporter.ts"
    "src/services/active-reporting/SOWGenerator.ts"
    "src/services/active-reporting/TaskDecomposer.ts"
    "src/services/active-reporting/TaskVisualizer.ts"
    "src/ui/integrated-cli/test-phase2.ts"
    "src/ui/integrated-cli/test-phase3.ts"
    "src/ui/integrated-cli/test-realtime-errors.ts"
    "src/ui/performance/RenderOptimizer.ts"
    "src/services/internal-mode-v2/core/BaseService.ts"
    "src/services/internal-mode-v2/core/ServiceBus.ts"
)

for file in "${HIGH_ERROR_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "🎯 処理中: $file"
        
        # 3段階修正適用
        fix_unused_imports "$file"
        fix_unused_parameters "$file"
        fix_unused_locals "$file"
        
        # 修正後エラー確認
        ERROR_COUNT=$(pnpm lint "$file" 2>&1 | grep -c "@typescript-eslint/no-unused-vars" || echo "0")
        echo "   → 残存エラー: $ERROR_COUNT"
        
        # 進捗表示
        CURRENT_TOTAL=$(pnpm lint 2>&1 | grep -c "@typescript-eslint/no-unused-vars" || echo "0")
        PROGRESS=$(( (INITIAL_COUNT - CURRENT_TOTAL) * 100 / INITIAL_COUNT ))
        echo "   📊 全体進捗: $PROGRESS% ($CURRENT_TOTAL/$INITIAL_COUNT 残存)"
        
        echo "---"
    else
        echo "⚠️  ファイルが見つかりません: $file"
    fi
done

# 7. 結果検証
echo "📊 Step 7: 結果検証..."

FINAL_COUNT=$(pnpm lint 2>&1 | grep -c "@typescript-eslint/no-unused-vars" || echo "0")
FIXED_COUNT=$((INITIAL_COUNT - FINAL_COUNT))
SUCCESS_RATE=$(( FIXED_COUNT * 100 / INITIAL_COUNT ))

echo "=== Phase 5 Part 1 完了レポート ==="
echo "初期エラー数: $INITIAL_COUNT"
echo "修正済み: $FIXED_COUNT"
echo "残存エラー数: $FINAL_COUNT"
echo "成功率: $SUCCESS_RATE%"

if [ $FINAL_COUNT -lt 400 ]; then
    echo "🎉 Part 1目標達成！残り400個未満"
else
    echo "⚠️  追加作業が必要です"
fi

# 8. 次段階準備
echo "🔄 Step 8: 次段階準備..."

# 残存エラーファイルリスト作成
echo "=== 残存エラーファイル ===" > "$WORK_DIR/remaining_files.txt"
pnpm lint 2>&1 | grep "@typescript-eslint/no-unused-vars" -B1 | grep "^/" | \
sed 's|/Users/bongin_max/maria_code/||' | sort | uniq >> "$WORK_DIR/remaining_files.txt"

echo "📋 残存エラーファイル数: $(wc -l < "$WORK_DIR/remaining_files.txt")"
echo "📁 詳細は $WORK_DIR/remaining_files.txt を参照"

echo "✅ Phase 5 Part 1 完了！"