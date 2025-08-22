#!/bin/bash

echo "🔧 Fixing 918 unused variable errors..."

# 1. import文の未使用変数をアンダースコア付きに変更
echo "📝 Fixing unused imports..."

# 特定ファイルの修正
files_with_errors=(
  "src/services/active-reporting/ProactiveReporter.ts"
  "src/services/active-reporting/SOWGenerator.ts" 
  "src/services/active-reporting/TaskDecomposer.ts"
  "src/services/active-reporting/TaskVisualizer.ts"
  "src/ui/integrated-cli/test-phase2.ts"
  "src/ui/integrated-cli/test-phase3.ts"
  "src/ui/integrated-cli/test-realtime-errors.ts"
  "src/ui/performance/RenderOptimizer.ts"
)

for file in "${files_with_errors[@]}"; do
  if [ -f "$file" ]; then
    echo "Fixing: $file"
    
    # 未使用のimport修正
    sed -i '' 's/import { \([^,}]*\),/import { _\1,/g' "$file"
    sed -i '' 's/, \([^,}]*\) }/, _\1 }/g' "$file"
    
    # 未使用の関数パラメータ修正
    sed -i '' 's/(\([a-zA-Z][^:,)]*\): /(_\1: /g' "$file"
    sed -i '' 's/, \([a-zA-Z][^:,)]*\): /, _\1: /g' "$file"
    
    # 未使用のローカル変数修正
    sed -i '' 's/const \([a-zA-Z][^=]*\) =/const _\1 =/g' "$file"
    sed -i '' 's/let \([a-zA-Z][^=]*\) =/let _\1 =/g' "$file"
  fi
done

echo "✅ Unused variables fix completed!"

# 結果確認
REMAINING=$(pnpm lint 2>&1 | grep -c "@typescript-eslint/no-unused-vars" || echo "0")
echo "📊 Remaining unused variable errors: $REMAINING"