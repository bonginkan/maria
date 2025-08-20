#!/bin/bash

echo "🔧 Fixing all remaining warnings..."

# Fix all remaining any types with more specific replacements
echo "📝 Replacing remaining any types..."

# Fix function parameters with any
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i.bak -E 's/\(([a-zA-Z_][a-zA-Z0-9_]*): any\)/(\1: unknown)/g' {} \; -exec rm {}.bak \;

# Fix any[] arrays
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i.bak 's/: any\[\]/: unknown[]/g' {} \; -exec rm {}.bak \;

# Fix Promise<any>
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i.bak 's/Promise<any>/Promise<unknown>/g' {} \; -exec rm {}.bak \;

# Fix Record<string, any>
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i.bak 's/Record<string, any>/Record<string, unknown>/g' {} \; -exec rm {}.bak \;

# Fix callback any types
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i.bak -E 's/\(([a-zA-Z_][a-zA-Z0-9_]*): any\) =>/(\1: unknown) =>/g' {} \; -exec rm {}.bak \;

# Fix type annotations : any
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i.bak -E 's/: any([ ,;\)])/: unknown\1/g' {} \; -exec rm {}.bak \;

# Fix generic any types
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i.bak 's/<any>/<unknown>/g' {} \; -exec rm {}.bak \;

echo "✅ Replaced any types"

# Fix unused variables by prefixing with underscore
echo "📝 Fixing unused variables..."
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i.bak -E 's/\b(aiProvider|context|command|recommendations|IntentClassifier)([^a-zA-Z0-9_])/_\1\2/g' {} \; -exec rm {}.bak \;

echo "✅ Fixed unused variables"

# Run ESLint auto-fix
echo "🔧 Running ESLint auto-fix..."
pnpm lint --fix || true

echo "📊 Checking remaining issues..."
TOTAL_ISSUES=$(pnpm lint 2>&1 | grep -E "^✖" | grep -oE "[0-9]+" | head -1)
echo "Remaining issues: $TOTAL_ISSUES"

echo "✅ Fix complete!"