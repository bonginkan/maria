#!/bin/bash

# MARIA Platform - TypeScript any型一括修正スクリプト
# Phase 2: TypeScript型安全性向上

echo "🔧 Starting TypeScript any type fixes..."

# 1. 基本的なany型パターンを修正
echo "📝 Fixing basic any type patterns..."

for file in $(find src -name "*.ts" -o -name "*.tsx"); do
  if [ -f "$file" ]; then
    # any[] → unknown[]
    sed -i '' 's/<any\[\]>/<unknown[]>/g' "$file"
    sed -i '' 's/: any\[\]/: unknown[]/g' "$file"
    
    # Function parameters
    sed -i '' 's/: any)/: unknown)/g' "$file"
    sed -i '' 's/: any /: unknown /g' "$file"
    sed -i '' 's/: any$/: unknown/g' "$file"
    sed -i '' 's/: any,/: unknown,/g' "$file"
    
    # Generic types
    sed -i '' 's/<any>/<unknown>/g' "$file"
    
    echo "✓ Fixed: $file"
  fi
done

# 2. 特定パターンの修正
echo "📝 Fixing specific patterns..."

# Event handlers - more specific types
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/event: any/event: Event/g'
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/e: any/e: Event/g'

# Data objects - Record type
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/data: any/data: Record<string, unknown>/g'
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/config: any/config: Record<string, unknown>/g'
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/options: any/options: Record<string, unknown>/g'

# Error objects
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/error: any/error: Error/g'
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/err: any/err: Error/g'

# Promise types
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/Promise<any>/Promise<unknown>/g'

echo "✅ TypeScript any type fixes completed!"
echo "🔍 Running lint check..."

# 3. 結果確認
pnpm lint --max-warnings 0 > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "🎉 All lint errors fixed!"
else
  echo "⚠️  Some issues remain. Running detailed check..."
  pnpm lint | head -20
fi