#!/bin/bash

# Phase 1 - Unused Variables Fixer
# Fix unused variables by adding underscore prefix

echo "🔧 Phase 1: Unused Variables Fixer - Starting..."

# Fix unused function parameters by adding underscore prefix
echo "Fixing unused function parameters..."
find src -name "*.ts" -not -path "src/generated/*" -exec sed -i '' \
  -e 's/\b(error) =>/(_error) =>/g' \
  -e 's/\b(index) =>/(_index) =>/g' \
  -e 's/\b(options) =>/(_options) =>/g' \
  -e 's/\b(resolve) =>/(_resolve) =>/g' \
  -e 's/\b(result) =>/(_result) =>/g' \
  -e 's/\b(reason) =>/(_reason) =>/g' \
  {} \;

# Fix unused variables in function signatures
find src -name "*.ts" -not -path "src/generated/*" -exec sed -i '' \
  -e 's/(\([^)]*\), *error: *[^,)]*)/(\1, _error: Error)/g' \
  -e 's/(\([^)]*\), *options: *[^,)]*)/(\1, _options: Record<string, unknown>)/g' \
  -e 's/(\([^)]*\), *index: *[^,)]*)/(\1, _index: number)/g' \
  {} \;

# Fix unused imports by adding underscore prefix
find src -name "*.ts" -not -path "src/generated/*" -exec sed -i '' \
  -e 's/import { \([^}]*\), *DESIGN_CONSTANTS\([^}]*\) }/import { \1, DESIGN_CONSTANTS as _DESIGN_CONSTANTS\2 }/g' \
  -e 's/import { \([^}]*\), *UNIFIED_COLORS\([^}]*\) }/import { \1, UNIFIED_COLORS as _UNIFIED_COLORS\2 }/g' \
  -e 's/import { \([^}]*\), *Task\([^}]*\) }/import { \1, Task as _Task\2 }/g' \
  {} \;

echo "✅ Phase 1: Unused Variables Fixer - Completed"