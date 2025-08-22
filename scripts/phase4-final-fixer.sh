#!/bin/bash

echo "🔧 Phase 4 Final: Fixing remaining TypeScript errors (TS1005)..."

# Fix TS1005 errors - These are likely generic constraint issues
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📝 Fixing TS1005 errors (generic constraints)..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Fix batch-execution.ts
echo "  Fixing src/services/batch-execution.ts..."
sed -i '' 's/<T extends unknown>/<T>/g' src/services/batch-execution.ts

# Fix BaseService.ts  
echo "  Fixing src/services/internal-mode-v2/core/BaseService.ts..."
sed -i '' 's/<T extends unknown>/<T>/g' src/services/internal-mode-v2/core/BaseService.ts

# Fix dual-memory-engine.ts
echo "  Fixing src/services/memory-system/dual-memory-engine.ts..."
sed -i '' 's/<T extends unknown>/<T>/g' src/services/memory-system/dual-memory-engine.ts

# Fix ErrorRecovery.ts
echo "  Fixing src/ui/error-handling/ErrorRecovery.ts..."
sed -i '' 's/<T extends unknown>/<T>/g' src/ui/error-handling/ErrorRecovery.ts

# Fix import-helper.ts
echo "  Fixing src/utils/import-helper.ts..."
sed -i '' 's/<T extends unknown>/<T>/g' src/utils/import-helper.ts

echo ""
echo "✅ Phase 4 Final fixes complete!"
echo ""

# Validate the fixes
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Validation Results:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Count TypeScript errors
echo -n "TypeScript errors: "
pnpm type-check 2>&1 | grep "error TS" | wc -l

# Count lint errors
echo -n "Lint errors: "
pnpm lint 2>&1 | grep "problems" | head -1

# Try to build
echo ""
echo "Testing build..."
pnpm build 2>&1 | tail -5

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"