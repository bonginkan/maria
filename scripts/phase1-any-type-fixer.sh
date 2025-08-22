#!/bin/bash

# Phase 1 - Any Type Fixer
# Systematically replace common 'any' type usage with proper types

echo "🔧 Phase 1: Any Type Fixer - Starting..."

# Fix common chalk import pattern
echo "Fixing chalk imports..."
find src -name "*.ts" -not -path "src/generated/*" -exec sed -i '' \
  -e 's/import chalkLib from '\''chalk'\'';/import chalk from '\''chalk'\'';/g' \
  -e 's/const chalk = chalkLib as any;//g' \
  {} \;

# Fix Command type imports (Commander.js)
echo "Fixing Commander.js types..."
find src -name "*.ts" -not -path "src/generated/*" -exec sed -i '' \
  -e 's/program: any/program: Command/g' \
  -e 's/options: any/options: Record<string, unknown>/g' \
  {} \;

# Fix common function parameter types
echo "Fixing function parameter types..."
find src -name "*.ts" -not -path "src/generated/*" -exec sed -i '' \
  -e 's/error: any/error: Error/g' \
  -e 's/config: any/config: Record<string, unknown>/g' \
  -e 's/data: any/data: unknown/g' \
  {} \;

# Add missing imports for Command type
echo "Adding missing Command imports..."
find src -name "*.ts" -not -path "src/generated/*" -exec grep -l "program: Command" {} \; | while read file; do
  if ! grep -q "import.*Command.*from.*commander" "$file"; then
    sed -i '' '1i\
import { Command } from '\''commander'\'';
' "$file"
  fi
done

echo "✅ Phase 1: Any Type Fixer - Completed"