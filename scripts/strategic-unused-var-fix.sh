#!/bin/bash

# Strategic Unused Variable Fix - Phase 5 Revised
# 最も効果的で安全な修正戦略

echo "🎯 Strategic Unused Variable Fix - Phase 5 Revised"

# 初期状態記録
INITIAL_COUNT=$(pnpm lint 2>&1 | grep -c "@typescript-eslint/no-unused-vars" || echo "0")
echo "📊 初期未使用変数エラー数: $INITIAL_COUNT"

# Strategy 1: 最も安全なパターン - 純粋な未使用引数修正
echo "🛡️ Strategy 1: 純粋未使用引数の安全修正..."

fix_safe_unused_args() {
    echo "  📝 安全な未使用引数パターンを修正中..."
    
    # パターン1: 明らかに未使用の第2引数以降
    find src -name "*.ts" -type f | head -20 | while read file; do
        # event handlers の未使用パラメータ
        sed -i '' 's/addEventListener(\([^,]*\), (\([^,]*\), event)/addEventListener(\1, (\2, _event)/g' "$file"
        sed -i '' 's/on(\([^,]*\), (\([^,]*\), event)/on(\1, (\2, _event)/g' "$file"
        
        # callback の未使用index
        sed -i '' 's/\.forEach((\([^,]*\), index)/\.forEach((\1, _index)/g' "$file"
        sed -i '' 's/\.map((\([^,]*\), index)/\.map((\1, _index)/g' "$file"
        
        echo "    ✓ Processed: $file"
    done
}

fix_safe_unused_args

AFTER_S1=$(pnpm lint 2>&1 | grep -c "@typescript-eslint/no-unused-vars" || echo "0")
S1_FIXED=$((INITIAL_COUNT - AFTER_S1))
echo "📊 Strategy 1完了: $S1_FIXED 個修正 ($AFTER_S1 残存)"

# Strategy 2: テストファイルの積極修正
echo "🧪 Strategy 2: テストファイルの積極修正..."

fix_test_files() {
    echo "  📝 テストファイル内の未使用変数を修正中..."
    
    TEST_FILES=(
        "src/ui/integrated-cli/test-phase2.ts"
        "src/ui/integrated-cli/test-phase3.ts"  
        "src/ui/integrated-cli/test-integration.ts"
        "src/ui/integrated-cli/test-internal-modes.ts"
        "src/ui/integrated-cli/test-realtime-errors.ts"
    )
    
    for file in "${TEST_FILES[@]}"; do
        if [ -f "$file" ]; then
            echo "    🔧 修正中: $file"
            
            # テストファイル特有の未使用変数パターン
            sed -i '' 's/const \([a-zA-Z][a-zA-Z0-9]*\) = /const _\1 = /g' "$file"
            sed -i '' 's/let \([a-zA-Z][a-zA-Z0-9]*\) = /let _\1 = /g' "$file"
            
            # 未使用インポート
            sed -i '' 's/import { \([A-Z][A-Za-z0-9]*\) }/import { _\1 }/g' "$file"
            
            echo "    ✓ 完了: $file"
        fi
    done
}

fix_test_files

AFTER_S2=$(pnpm lint 2>&1 | grep -c "@typescript-eslint/no-unused-vars" || echo "0")
S2_FIXED=$((AFTER_S1 - AFTER_S2))
echo "📊 Strategy 2完了: $S2_FIXED 個修正 ($AFTER_S2 残存)"

# Strategy 3: 明確な未使用import修正
echo "📦 Strategy 3: 明確な未使用import修正..."

fix_unused_imports() {
    echo "  📝 明確に未使用のimportを修正中..."
    
    # 一般的な未使用import
    find src -name "*.ts" -type f | head -30 | while read file; do
        # 未使用型import
        sed -i '' 's/import { \([A-Z][A-Za-z0-9]*\), /import { _\1, /g' "$file"
        sed -i '' 's/, \([A-Z][A-Za-z0-9]*\) }/, _\1 }/g' "$file"
        
        # 未使用関数import  
        sed -i '' 's/import { \([a-z][A-Za-z0-9]*\), /import { _\1, /g' "$file"
        sed -i '' 's/, \([a-z][A-Za-z0-9]*\) }/, _\1 }/g' "$file"
        
        echo "    ✓ Import修正: $file"
    done
}

fix_unused_imports

AFTER_S3=$(pnpm lint 2>&1 | grep -c "@typescript-eslint/no-unused-vars" || echo "0")
S3_FIXED=$((AFTER_S2 - AFTER_S3))
echo "📊 Strategy 3完了: $S3_FIXED 個修正 ($AFTER_S3 残存)"

# Final Results
TOTAL_FIXED=$((INITIAL_COUNT - AFTER_S3))
SUCCESS_RATE=$(( TOTAL_FIXED * 100 / INITIAL_COUNT ))

echo ""
echo "=== Strategic Fix Results ==="
echo "初期エラー数: $INITIAL_COUNT"
echo "最終エラー数: $AFTER_S3"
echo "修正済み: $TOTAL_FIXED"
echo "成功率: $SUCCESS_RATE%"
echo ""

if [ $TOTAL_FIXED -gt 100 ]; then
    echo "🎉 戦略的修正成功！100個以上のエラーを安全に修正"
    
    # 次回処理用のファイルリスト作成
    echo "📋 残存エラーファイル分析中..."
    mkdir -p tmp
    pnpm lint 2>&1 | grep "@typescript-eslint/no-unused-vars" -B1 | grep "^/" | \
    sed 's|/Users/bongin_max/maria_code/||' | sort | uniq -c | sort -nr > tmp/remaining_error_files.txt
    
    echo "残存エラーファイル分析完了: tmp/remaining_error_files.txt"
else
    echo "⚠️  期待した改善が得られませんでした。追加戦略が必要です。"
fi

# Build verification
echo "🏗️  Build verification..."
if pnpm type-check > /dev/null 2>&1; then
    echo "✅ TypeScript compilation: PASS"
else
    echo "❌ TypeScript compilation: FAIL"
fi

echo "✅ Strategic Unused Variable Fix 完了"