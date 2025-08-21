#!/bin/bash

# エラーの多いファイルトップ10を特定
echo "🔍 Top 10 files with most lint errors:"

pnpm lint 2>&1 | grep "^/Users" | sed 's|/Users/bongin_max/maria_code/||' | sort | uniq -c | sort -nr | head -10

echo ""
echo "📊 Error type distribution:"

pnpm lint 2>&1 | grep -E "error|warning" | grep -o '@typescript-eslint/[a-z-]*\|no-[a-z-]*\|prefer-[a-z-]*' | sort | uniq -c | sort -nr