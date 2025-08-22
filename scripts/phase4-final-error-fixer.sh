#!/bin/bash

echo "🔧 Phase 4 Final: Fixing all remaining error references..."

# Find all files with undefined 'error' references
files_with_errors=$(pnpm type-check 2>&1 | grep "Cannot find name 'error'" | cut -d'(' -f1 | sort -u)

for file in $files_with_errors; do
  if [ -f "$file" ]; then
    echo "  Fixing: $file"
    # Replace error with _error in catch blocks and console statements
    sed -i '' 's/} catch (error)/} catch (_error)/g' "$file"
    sed -i '' 's/console\.\(error\|warn\|log\)(\(.*\), error)/console.\1(\2, _error)/g' "$file"
    sed -i '' 's/Error(\(.*\)${error}/Error(\1${_error}/g' "$file"
    sed -i '' 's/throw error;/throw _error;/g' "$file"
    sed -i '' 's/error instanceof/\_error instanceof/g' "$file"
    sed -i '' 's/error\.message/_error.message/g' "$file"
  fi
done

echo "✅ All error references fixed!"

# Test build
echo ""
echo "Final build test..."
pnpm build 2>&1 | tail -5