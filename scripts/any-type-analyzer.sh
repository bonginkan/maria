#!/bin/bash

# Phase 6: Any型撲滅作戦 - 詳細分析ツール
# TypeScript型安全性完全達成のための戦略的分析

echo "🔬 Phase 6: Any型撲滅作戦 - 詳細分析開始"

# 作業ディレクトリ準備
WORK_DIR="tmp/phase6-any-analysis"
mkdir -p "$WORK_DIR"

# 現在のAny型エラー数確認
TOTAL_ANY_ERRORS=$(pnpm lint 2>&1 | grep -c "@typescript-eslint/no-explicit-any" || echo "0")
echo "📊 現在のAny型エラー数: $TOTAL_ANY_ERRORS"

# 1. ファイル別Any型エラー分布分析
echo "🎯 Step 1: ファイル別Any型エラー分布分析..."

analyze_file_distribution() {
    echo "=== Any型エラー ファイル別分布 ===" > "$WORK_DIR/file_distribution.txt"
    
    pnpm lint 2>&1 | grep "@typescript-eslint/no-explicit-any" -B1 | grep "^/" | \
    sed 's|/Users/bongin_max/maria_code/||' | sort | uniq -c | sort -nr > "$WORK_DIR/file_counts.txt"
    
    echo "Top 15 Any型エラー集中ファイル:" >> "$WORK_DIR/file_distribution.txt"
    head -15 "$WORK_DIR/file_counts.txt" >> "$WORK_DIR/file_distribution.txt"
    
    cat "$WORK_DIR/file_distribution.txt"
}

analyze_file_distribution

# 2. Any型使用パターン分析
echo "🔍 Step 2: Any型使用パターン分析..."

analyze_usage_patterns() {
    echo "=== Any型使用パターン分析 ===" > "$WORK_DIR/usage_patterns.txt"
    
    # パターン1: 関数パラメータでのany使用
    PARAM_COUNT=$(pnpm lint 2>&1 | grep "@typescript-eslint/no-explicit-any" | \
    xargs -I {} sh -c 'pnpm lint 2>&1' | grep -c ": any)" || echo "0")
    echo "1. 関数パラメータany: $PARAM_COUNT 箇所" >> "$WORK_DIR/usage_patterns.txt"
    
    # パターン2: 戻り値でのany使用  
    RETURN_COUNT=$(pnpm lint 2>&1 | grep "@typescript-eslint/no-explicit-any" | \
    xargs -I {} sh -c 'pnpm lint 2>&1' | grep -c "): any" || echo "0")
    echo "2. 戻り値any: $RETURN_COUNT 箇所" >> "$WORK_DIR/usage_patterns.txt"
    
    # パターン3: 変数宣言でのany使用
    VAR_COUNT=$(pnpm lint 2>&1 | grep "@typescript-eslint/no-explicit-any" | \
    xargs -I {} sh -c 'pnpm lint 2>&1' | grep -c ": any" || echo "0")
    echo "3. 変数宣言any: $VAR_COUNT 箇所" >> "$WORK_DIR/usage_patterns.txt"
    
    # パターン4: ジェネリックでのany使用
    GENERIC_COUNT=$(pnpm lint 2>&1 | grep "@typescript-eslint/no-explicit-any" | \
    xargs -I {} sh -c 'pnpm lint 2>&1' | grep -c "<any>" || echo "0")
    echo "4. ジェネリックany: $GENERIC_COUNT 箇所" >> "$WORK_DIR/usage_patterns.txt"
    
    cat "$WORK_DIR/usage_patterns.txt"
}

analyze_usage_patterns

# 3. カテゴリ別分類
echo "📂 Step 3: カテゴリ別分類..."

categorize_any_types() {
    echo "=== Any型カテゴリ別分類 ===" > "$WORK_DIR/categories.txt"
    
    # UI Components
    UI_COUNT=$(pnpm lint 2>&1 | grep "@typescript-eslint/no-explicit-any" -B1 | grep "src/ui" | wc -l)
    echo "UI Components: $UI_COUNT 箇所" >> "$WORK_DIR/categories.txt"
    
    # Services  
    SERVICE_COUNT=$(pnpm lint 2>&1 | grep "@typescript-eslint/no-explicit-any" -B1 | grep "src/services" | wc -l)
    echo "Services: $SERVICE_COUNT 箇所" >> "$WORK_DIR/categories.txt"
    
    # Commands
    CMD_COUNT=$(pnpm lint 2>&1 | grep "@typescript-eslint/no-explicit-any" -B1 | grep "src/commands" | wc -l)
    echo "Commands: $CMD_COUNT 箇所" >> "$WORK_DIR/categories.txt"
    
    # Utils
    UTIL_COUNT=$(pnpm lint 2>&1 | grep "@typescript-eslint/no-explicit-any" -B1 | grep "src/utils" | wc -l)
    echo "Utils: $UTIL_COUNT 箇所" >> "$WORK_DIR/categories.txt"
    
    # Types
    TYPE_COUNT=$(pnpm lint 2>&1 | grep "@typescript-eslint/no-explicit-any" -B1 | grep "src/types" | wc -l)
    echo "Types: $TYPE_COUNT 箇所" >> "$WORK_DIR/categories.txt"
    
    cat "$WORK_DIR/categories.txt"
}

categorize_any_types

# 4. 修正優先度マトリックス作成
echo "⭐ Step 4: 修正優先度マトリックス作成..."

create_priority_matrix() {
    echo "=== 修正優先度マトリックス ===" > "$WORK_DIR/priority_matrix.txt"
    echo "" >> "$WORK_DIR/priority_matrix.txt"
    
    echo "🔥 Priority 1 (High Impact, Easy Fix):" >> "$WORK_DIR/priority_matrix.txt"
    echo "- src/utils/ui.ts (頻繁に使用される共通ユーティリティ)" >> "$WORK_DIR/priority_matrix.txt"
    echo "- src/types/common.ts (型定義の基盤)" >> "$WORK_DIR/priority_matrix.txt"
    echo "" >> "$WORK_DIR/priority_matrix.txt"
    
    echo "⚡ Priority 2 (High Impact, Medium Fix):" >> "$WORK_DIR/priority_matrix.txt"
    echo "- src/services/active-reporting/ (アクティブレポーティング)" >> "$WORK_DIR/priority_matrix.txt"
    echo "- src/ui/performance/ (パフォーマンス関連)" >> "$WORK_DIR/priority_matrix.txt"
    echo "" >> "$WORK_DIR/priority_matrix.txt"
    
    echo "🎯 Priority 3 (Medium Impact, Easy Fix):" >> "$WORK_DIR/priority_matrix.txt"
    echo "- src/ui/integrated-cli/test-*.ts (テストファイル)" >> "$WORK_DIR/priority_matrix.txt"
    echo "- src/commands/ (コマンド個別実装)" >> "$WORK_DIR/priority_matrix.txt"
    echo "" >> "$WORK_DIR/priority_matrix.txt"
    
    echo "🔧 Priority 4 (Low Impact, Complex Fix):" >> "$WORK_DIR/priority_matrix.txt"
    echo "- src/services/memory-system/ (メモリシステム)" >> "$WORK_DIR/priority_matrix.txt"
    echo "- src/services/internal-mode-v2/ (内部モード)" >> "$WORK_DIR/priority_matrix.txt"
    
    cat "$WORK_DIR/priority_matrix.txt"
}

create_priority_matrix

# 5. 修正戦略推奨
echo "📋 Step 5: 修正戦略推奨..."

recommend_strategy() {
    echo "=== Phase 6 修正戦略推奨 ===" > "$WORK_DIR/strategy_recommendation.txt"
    echo "" >> "$WORK_DIR/strategy_recommendation.txt"
    
    echo "🎯 Week 3 目標: Priority 1-2完全修正 (200個削減目標)" >> "$WORK_DIR/strategy_recommendation.txt"
    echo "🎯 Week 4 目標: Priority 3-4完全修正 (残り234個削減)" >> "$WORK_DIR/strategy_recommendation.txt"
    echo "" >> "$WORK_DIR/strategy_recommendation.txt"
    
    echo "📝 推奨修正パターン:" >> "$WORK_DIR/strategy_recommendation.txt"
    echo "1. any → unknown (安全なデフォルト)" >> "$WORK_DIR/strategy_recommendation.txt"
    echo "2. any[] → unknown[] (配列型)" >> "$WORK_DIR/strategy_recommendation.txt"
    echo "3. Event handlers → Event | MouseEvent | KeyboardEvent" >> "$WORK_DIR/strategy_recommendation.txt"
    echo "4. API responses → Record<string, unknown>" >> "$WORK_DIR/strategy_recommendation.txt"
    echo "5. Error objects → Error | unknown" >> "$WORK_DIR/strategy_recommendation.txt"
    echo "" >> "$WORK_DIR/strategy_recommendation.txt"
    
    echo "🛠️ 修正ツール:" >> "$WORK_DIR/strategy_recommendation.txt"
    echo "- scripts/any-type-fixer.sh (自動修正)" >> "$WORK_DIR/strategy_recommendation.txt"
    echo "- scripts/any-type-validator.sh (修正検証)" >> "$WORK_DIR/strategy_recommendation.txt"
    echo "- TypeScript Language Server (IDE支援)" >> "$WORK_DIR/strategy_recommendation.txt"
    
    cat "$WORK_DIR/strategy_recommendation.txt"
}

recommend_strategy

# 6. 高頻度エラーファイル詳細
echo "📁 Step 6: 高頻度エラーファイル詳細分析..."

analyze_top_files() {
    echo "=== Top 5 Any型エラーファイル詳細 ===" > "$WORK_DIR/top_files_detail.txt"
    
    # Top 5ファイルを取得
    head -5 "$WORK_DIR/file_counts.txt" | while read count file; do
        echo "" >> "$WORK_DIR/top_files_detail.txt"
        echo "📁 $file ($count エラー)" >> "$WORK_DIR/top_files_detail.txt"
        echo "---" >> "$WORK_DIR/top_files_detail.txt"
        
        # 該当ファイルの具体的エラー行を表示
        pnpm lint "$file" 2>&1 | grep "@typescript-eslint/no-explicit-any" | head -5 >> "$WORK_DIR/top_files_detail.txt"
    done
    
    cat "$WORK_DIR/top_files_detail.txt"
}

analyze_top_files

# 最終サマリー
echo ""
echo "=== Phase 6 Any型分析完了 ==="
echo "📊 総Any型エラー: $TOTAL_ANY_ERRORS"
echo "📁 分析レポート: $WORK_DIR/"
echo "🎯 推奨開始点: Priority 1ファイルから段階的修正"
echo ""
echo "Next: scripts/any-type-fixer.sh で修正開始！"

echo "✅ Any型分析完了！"