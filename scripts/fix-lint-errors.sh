#!/bin/bash

echo "🔧 Starting comprehensive lint fix..."

# Create common types file
cat > src/types/common.ts << 'EOF'
// Common type definitions to replace 'any'

export interface CommandParameter {
  name: string;
  value: string | number | boolean | unknown[] | Record<string, unknown>;
  type?: 'string' | 'number' | 'boolean' | 'array' | 'object';
}

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  status: number;
}

export interface ErrorDetails {
  message: string;
  code?: string;
  stack?: string;
}

export interface ConfigValue {
  key: string;
  value: string | number | boolean | Record<string, unknown>;
}

export type UnknownRecord = Record<string, unknown>;
export type UnknownArray = unknown[];
export type AnyFunction = (...args: unknown[]) => unknown;
export type AsyncFunction<T = unknown> = (...args: unknown[]) => Promise<T>;
EOF

echo "✅ Created common types file"

# Fix all @ts-ignore to @ts-expect-error
echo "🔧 Fixing @ts-ignore comments..."
find src -name "*.ts" -o -name "*.tsx" | while read file; do
  sed -i.bak 's/@ts-ignore/@ts-expect-error/g' "$file" && rm "${file}.bak"
done

# Fix unused variables by prefixing with _
echo "🔧 Fixing unused variables..."
# This is complex and needs manual review, so we'll just list them
echo "Files with unused variables that need manual fix:"
pnpm lint 2>&1 | grep "is defined but never used\|is assigned a value but never used" | cut -d':' -f1 | sort -u

# Fix case declarations
echo "🔧 Fixing case declarations..."
find src -name "*.ts" -o -name "*.tsx" | while read file; do
  # This needs careful manual fixing to avoid breaking code
  echo "Check $file for case declarations that need block scope"
done

# Replace common any patterns
echo "🔧 Replacing common any patterns..."

# Fix catch error any
find src -name "*.ts" -o -name "*.tsx" | while read file; do
  sed -i.bak 's/catch (error: any)/catch (error)/g' "$file" && rm "${file}.bak"
done

# Fix Record<string, any>
find src -name "*.ts" -o -name "*.tsx" | while read file; do
  sed -i.bak 's/Record<string, any>/Record<string, unknown>/g' "$file" && rm "${file}.bak"
done

# Fix : any[] patterns
find src -name "*.ts" -o -name "*.tsx" | while read file; do
  sed -i.bak 's/: any\[\]/: unknown[]/g' "$file" && rm "${file}.bak"
done

# Fix Promise<any>
find src -name "*.ts" -o -name "*.tsx" | while read file; do
  sed -i.bak 's/Promise<any>/Promise<unknown>/g' "$file" && rm "${file}.bak"
done

echo "🔧 Running ESLint auto-fix..."
pnpm lint --fix

echo "📊 Remaining issues:"
pnpm lint 2>&1 | tail -10

echo "✅ Automated fixes complete. Manual review needed for remaining issues."