#!/bin/bash

# Fix common unknown type patterns across the codebase

echo "🔧 Starting Phase 4: Comprehensive Unknown Type Fixes"

# Fix catch block error handling patterns
echo "📝 Fixing catch block error patterns..."
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' \
  -e 's/catch (error)/catch (error: unknown)/g' \
  -e 's/catch (e)/catch (e: unknown)/g' \
  -e 's/catch (err)/catch (err: unknown)/g' \
  -e 's/catch (ex)/catch (ex: unknown)/g'

# Fix common error access patterns
echo "📝 Fixing error property access patterns..."
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' \
  -e 's/error\.message/((error as Error).message || String(error))/g' \
  -e 's/e\.message/((e as Error).message || String(e))/g' \
  -e 's/err\.message/((err as Error).message || String(err))/g'

# Fix JSON.parse results
echo "📝 Adding types to JSON.parse results..."
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' \
  -e 's/JSON\.parse(\([^)]*\))/JSON.parse(\1) as Record<string, unknown>/g'

# Fix forEach and map callbacks with unknown
echo "📝 Fixing array callback patterns..."
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' \
  -e 's/\.forEach((item: unknown/\.forEach((item/g' \
  -e 's/\.map((item: unknown/\.map((item/g' \
  -e 's/\.filter((item: unknown/\.filter((item/g'

echo "✅ Phase 4 fixes applied. Running typecheck..."
pnpm typecheck 2>&1 | grep "error TS" | wc -l