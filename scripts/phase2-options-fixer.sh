#!/bin/bash

# Phase 2 - Options Variable Scope Fixer
# Fix all options variable scope issues

echo "🔧 Phase 2: Options Variable Scope Fixer - Starting..."

# Fix CLI options scope issues
echo "Fixing CLI options scope issues..."
sed -i '' 's/options:/options/g' src/cli.ts
sed -i '' '59s/_options: Record<string, unknown>/options: Record<string, unknown>/' src/cli.ts
sed -i '' '69s/_options: Record<string, unknown>/options: Record<string, unknown>/' src/cli.ts
sed -i '' '78s/_options: Record<string, unknown>/options: Record<string, unknown>/' src/cli.ts

# Fix approval-git options scope issues
echo "Fixing approval-git options scope issues..."
sed -i '' 's/_options: Record<string, unknown>/options: Record<string, unknown>/g' src/commands/approval-git.ts

# Fix analyze command options scope issues
echo "Fixing analyze command options scope issues..."
sed -i '' 's/_options: Record<string, unknown>/options: Record<string, unknown>/g' src/commands/analyze.ts

# Fix unused variables in analyze.ts
sed -i '' 's/, index: number/, _index: number/g' src/commands/analyze.ts
sed -i '' 's/${index + 1}/${_index + 1}/g' src/commands/analyze.ts

echo "✅ Phase 2: Options Variable Scope Fixer - Completed"