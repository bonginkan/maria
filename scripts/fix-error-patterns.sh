#!/bin/bash

# Fix incorrect error handling patterns

echo "Fixing incorrect error handling patterns..."

# Pattern 1: Fix ((error as Error).message || String(error))
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
  's/((error as Error)\.message || String(error))/error.message/g' {} \;

# Pattern 2: Fix error instanceof Error ? ((error as Error).message || String(error)) : String(error)
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
  's/error instanceof Error ? ((error as Error)\.message || String(error)) : String(error)/error instanceof Error ? error.message : String(error)/g' {} \;

# Pattern 3: Fix (err as Error).message || String(err)
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
  's/((err as Error)\.message || String(err))/err.message/g' {} \;

# Pattern 4: Fix err instanceof Error ? ((err as Error).message || String(err)) : String(err)
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
  's/err instanceof Error ? ((err as Error)\.message || String(err)) : String(err)/err instanceof Error ? err.message : String(err)/g' {} \;

# Pattern 5: Fix e instanceof Error ? ((e as Error).message || String(e)) : String(e)
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
  's/e instanceof Error ? ((e as Error)\.message || String(e)) : String(e)/e instanceof Error ? e.message : String(e)/g' {} \;

echo "Fixed error handling patterns"