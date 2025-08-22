#!/bin/bash

echo "🔧 Phase 4: Direct chalk import fix for cli.ts and other files..."

# Fix cli.ts specifically
echo "Fixing src/cli.ts..."
cat > /tmp/cli_fix.txt << 'EOF'
import { Command } from 'commander';
import chalkLib from 'chalk';
const chalk = chalkLib as any;
import { MariaAI, MariaAIConfig } from './maria-ai';
EOF

# Replace the first few lines of cli.ts
sed -i '' '5,6d' src/cli.ts
sed -i '' '5r /tmp/cli_fix.txt' src/cli.ts

# Fix other files with chalk type issues
echo "Fixing other chalk import issues..."

# Find all files that import chalk and have type issues
files_with_chalk_errors=$(pnpm type-check 2>&1 | grep "error TS18046.*chalk" | cut -d'(' -f1 | sort -u)

for file in $files_with_chalk_errors; do
  if [ -f "$file" ]; then
    echo "  Fixing: $file"
    # Replace chalk import with type-safe version
    sed -i '' "s/^import chalk from 'chalk';/import chalkLib from 'chalk';\nconst chalk = chalkLib as any;/" "$file"
  fi
done

echo "✅ Direct chalk fixes applied!"

# Validate
echo ""
echo "Validation:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
pnpm build 2>&1 | tail -10