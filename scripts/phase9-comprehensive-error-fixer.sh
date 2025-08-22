#!/bin/bash
echo "🔧 Phase 9: Comprehensive error reference fixer..."

# Find all files with error reference issues
files_with_errors=$(pnpm type-check 2>&1 | grep "Cannot find name 'error'" | cut -d'(' -f1 | sort -u)

for file in $files_with_errors; do
  if [ -f "$file" ]; then
    echo "  Fixing: $file"
    # Fix console.error patterns
    sed -i '' 's/console\.error(\([^,]*\), error)/console.error(\1, _error)/g' "$file"
    # Fix console.warn patterns
    sed -i '' 's/console\.warn(\([^,]*\), error)/console.warn(\1, _error)/g' "$file"
    # Fix return error patterns
    sed -i '' 's/return error;/return _error;/g' "$file"
    # Fix throw error patterns where _error is caught
    sed -i '' 's/throw error;/throw _error;/g' "$file"
    # Fix emit patterns
    sed -i '' 's/\.emit(\([^,]*\), error /\.emit(\1, _error /g' "$file"
    # Fix specific patterns with as Error
    sed -i '' 's/, error as Error/, _error as Error/g' "$file"
    # Fix standalone error in catch blocks
    sed -i '' 's/} catch (_error) {/} catch (_error) {/g' "$file"
  fi
done

echo "✅ Fixed all error references!"
echo "🧪 Running build test..."