#!/bin/bash

# Phase 2 - TypeScript Error Fixer
# Fix common TypeScript errors systematically

echo "🔧 Phase 2: TypeScript Error Fixer - Starting..."

# Fix 'Cannot find name options' errors in CLI commands
echo "Fixing 'options' variable scope issues..."
find src -name "*.ts" -not -path "src/generated/*" -exec sed -i '' \
  -e 's/const config = await loadConfig(options);/const config = await loadConfig(_options);/g' \
  -e 's/, options\.language//, _options.language/g' \
  -e 's/options\.verbose/_options.verbose/g' \
  -e 's/options\.backup/_options.backup/g' \
  -e 's/options\.dryRun/_options.dryRun/g' \
  -e 's/options\.force/_options.force/g' \
  -e 's/options\.recursive/_options.recursive/g' \
  {} \;

# Fix 'Cannot find name index' errors in forEach loops
echo "Fixing 'index' variable scope issues..."
find src -name "*.ts" -not -path "src/generated/*" -exec sed -i '' \
  -e 's/console\.log(chalk\.yellow(`\\nPath ${index + 1}/console\.log(chalk\.yellow(`\\nPath ${_index + 1}/g' \
  -e 's/console\.log(chalk\.yellow(`\\nCommunity ${index + 1}/console\.log(chalk\.yellow(`\\nCommunity ${_index + 1}/g' \
  -e 's/console\.log(chalk\.yellow(`\\n${index + 1}\./console\.log(chalk\.yellow(`\\n${_index + 1}\./g' \
  {} \;

# Fix undefined object access with optional chaining
echo "Adding null safety checks..."
find src -name "*.ts" -not -path "src/generated/*" -exec sed -i '' \
  -e 's/blocker\.description/blocker?.description/g' \
  -e 's/blocker\.severity/blocker?.severity/g' \
  -e 's/priorityColor(priority)/priorityColor?.(priority)/g' \
  {} \;

# Fix unknown type assertions
echo "Fixing unknown type assertions..."
find src -name "*.ts" -not -path "src/generated/*" -exec sed -i '' \
  -e 's/blocker as unknown/(blocker as Record<string, unknown>)/g' \
  -e 's/priorityColor as unknown/(priorityColor as ((p: string) => string) | undefined)/g' \
  {} \;

echo "✅ Phase 2: TypeScript Error Fixer - Completed"