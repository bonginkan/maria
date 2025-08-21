#!/bin/bash

# MARIA Platform - Phase 6: Any型精密修正ツール
# 段階的精密修正アプローチ - Individual file processing with verification

set -e

LOG_FILE="/tmp/any-type-fixer.log"
SUCCESS_COUNT=0
FAILURE_COUNT=0

echo "🎯 Phase 6: Any型精密修正ツール開始" | tee "$LOG_FILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$LOG_FILE"

# TypeScript型変換パターン定義
declare -A TYPE_PATTERNS=(
    ["simple_any"]='s/: any([^A-Za-z])/: unknown\1/g'
    ["any_array"]='s/: any\[\]/: unknown[]/g'
    ["generic_any"]='s/<any>/<unknown>/g'
    ["function_any"]='s/: any\)/: unknown)/g'
    ["object_any"]='s/Record<string, any>/Record<string, unknown>/g'
    ["type_assertion"]='s/ as any/ as unknown/g'
    ["variable_any"]='s/let ([a-zA-Z_][a-zA-Z0-9_]*): any/let \1: unknown/g'
    ["const_any"]='s/const ([a-zA-Z_][a-zA-Z0-9_]*): any/const \1: unknown/g'
)

# ファイル別修正関数
fix_file() {
    local file="$1"
    local temp_file="${file}.tmp"
    local backup_file="${file}.backup"
    
    echo "🔧 Processing: $file" | tee -a "$LOG_FILE"
    
    # バックアップ作成
    cp "$file" "$backup_file"
    cp "$file" "$temp_file"
    
    # 段階的パターン適用
    local patterns_applied=0
    for pattern_name in "${!TYPE_PATTERNS[@]}"; do
        local pattern="${TYPE_PATTERNS[$pattern_name]}"
        
        # パターン適用前後でファイル比較
        local before_hash=$(md5sum "$temp_file" | cut -d' ' -f1)
        sed -i.bak "$pattern" "$temp_file"
        local after_hash=$(md5sum "$temp_file" | cut -d' ' -f1)
        
        if [[ "$before_hash" != "$after_hash" ]]; then
            echo "  ✓ Applied pattern: $pattern_name" | tee -a "$LOG_FILE"
            ((patterns_applied++))
            rm -f "${temp_file}.bak"
        else
            rm -f "${temp_file}.bak"
        fi
    done
    
    if [[ $patterns_applied -gt 0 ]]; then
        # TypeScript検証
        echo "  🔍 TypeScript validation..." | tee -a "$LOG_FILE"
        if npx tsc --noEmit --skipLibCheck "$temp_file" 2>/dev/null; then
            # ESLint検証
            echo "  🔍 ESLint validation..." | tee -a "$LOG_FILE"
            if npx eslint "$temp_file" --quiet 2>/dev/null; then
                # 成功: 変更を適用
                mv "$temp_file" "$file"
                rm -f "$backup_file"
                echo "  ✅ Successfully fixed ($patterns_applied patterns applied)" | tee -a "$LOG_FILE"
                ((SUCCESS_COUNT++))
                return 0
            else
                echo "  ❌ ESLint validation failed" | tee -a "$LOG_FILE"
            fi
        else
            echo "  ❌ TypeScript validation failed" | tee -a "$LOG_FILE"
        fi
    fi
    
    # 失敗: バックアップから復元
    mv "$backup_file" "$file"
    rm -f "$temp_file"
    echo "  ⚠️  No safe changes applied" | tee -a "$LOG_FILE"
    ((FAILURE_COUNT++))
    return 1
}

# 高優先度ファイルリスト (1つのエラーを持つファイル)
HIGH_PRIORITY_FILES=(
    "src/utils/ui.ts"
    "src/ui/design-system/MinimalIconRegistry.ts"
    "src/ui/design-system/OptimizedBox.ts"
    "src/ui/design-system/LayoutManager.ts"
    "src/ui/design-system/ResponsiveRenderer.ts"
    "src/services/ai-driven-project-analysis.ts"
    "src/services/approval-git/GitHubIntegration.ts"
    "src/commands/approval-git.ts"
    "src/commands/auto-improve.ts"
    "src/index.ts"
)

# Phase 6-1: 高優先度ファイル処理
echo ""
echo "📋 Phase 6-1: 高優先度ファイル処理 (${#HIGH_PRIORITY_FILES[@]} files)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

for file in "${HIGH_PRIORITY_FILES[@]}"; do
    if [[ -f "$file" ]]; then
        fix_file "$file"
        echo ""
    else
        echo "⚠️  File not found: $file" | tee -a "$LOG_FILE"
    fi
done

# 結果レポート
echo ""
echo "📊 Phase 6-1 実行結果レポート"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 成功: $SUCCESS_COUNT files"
echo "❌ 失敗: $FAILURE_COUNT files"
echo "📈 成功率: $(( SUCCESS_COUNT * 100 / (SUCCESS_COUNT + FAILURE_COUNT) ))%"
echo ""
echo "📝 詳細ログ: $LOG_FILE"

# ESLint再チェック
echo ""
echo "🔍 修正後ESLintチェック実行中..."
pnpm lint --quiet | grep "@typescript-eslint/no-explicit-any" | wc -l | xargs -I {} echo "残りAny型エラー: {} 個"