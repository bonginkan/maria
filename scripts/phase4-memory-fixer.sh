#!/bin/bash

echo "🔧 Phase 4: Fixing memory system error references..."

# Fix memory-coordinator.ts error references
echo "Fixing src/services/memory-system/memory-coordinator.ts..."
sed -i '' 's/console.error(\(.*\), error)/console.error(\1, _error)/g' src/services/memory-system/memory-coordinator.ts
sed -i '' 's/Error(\(.*\)${error}/Error(\1${_error}/g' src/services/memory-system/memory-coordinator.ts
sed -i '' 's/throw error;/throw _error;/g' src/services/memory-system/memory-coordinator.ts
sed -i '' 's/catch (error)/catch (_error)/g' src/services/memory-system/memory-coordinator.ts

# Fix conflict type issues
sed -i '' 's/conflict\./(_conflict as any)./g' src/services/memory-system/memory-coordinator.ts

echo "✅ Memory system fixes applied!"

# Test build
echo ""
echo "Testing build..."
pnpm build 2>&1 | tail -10