#!/bin/bash

echo "🔧 Fixing all remaining any type warnings..."

# Fix commands/analyze.ts
sed -i.bak 's/chunk: any/chunk: unknown/g' src/commands/analyze.ts && rm src/commands/analyze.ts.bak

# Fix commands/auto-improve.tsx
sed -i.bak 's/config: any/config: Record<string, unknown>/g' src/commands/auto-improve.tsx && rm src/commands/auto-improve.tsx.bak

# Fix commands/bug.ts
sed -i.bak 's/bug: any/bug: unknown/g' src/commands/bug.ts && rm src/commands/bug.ts.bak

# Fix commands/slides-v2.tsx
sed -i.bak 's/slide: any/slide: unknown/g' src/commands/slides-v2.tsx && rm src/commands/slides-v2.tsx.bak

# Fix commands/status-enhanced.ts
sed -i.bak 's/(resource: any)/(resource: unknown)/g' src/commands/status-enhanced.ts && rm src/commands/status-enhanced.ts.bak

# Fix components/AgentManager.tsx
sed -i.bak 's/agent: any/agent: unknown/g' src/components/AgentManager.tsx && rm src/components/AgentManager.tsx.bak

# Fix components/ChatInterface-v2.tsx and ChatInterface.tsx
sed -i.bak 's/messages: any/messages: unknown/g' src/components/ChatInterface*.tsx && rm src/components/ChatInterface*.tsx.bak

# Fix components/ConfigPanel.tsx
sed -i.bak 's/: any\[\]/: unknown[]/g' src/components/ConfigPanel.tsx && rm src/components/ConfigPanel.tsx.bak
sed -i.bak 's/: any)/: unknown)/g' src/components/ConfigPanel.tsx && rm src/components/ConfigPanel.tsx.bak

# Fix components/MCPManager.tsx
sed -i.bak 's/tool: any/tool: unknown/g' src/components/MCPManager.tsx && rm src/components/MCPManager.tsx.bak

# Fix components/ModelSelector.tsx
sed -i.bak 's/model: any/model: unknown/g' src/components/ModelSelector.tsx && rm src/components/ModelSelector.tsx.bak

# Fix config/config-manager.ts
sed -i.bak 's/: any\[\]/: unknown[]/g' src/config/config-manager.ts && rm src/config/config-manager.ts.bak
sed -i.bak 's/value: any/value: unknown/g' src/config/config-manager.ts && rm src/config/config-manager.ts.bak

# Fix services files
sed -i.bak 's/: any)/: unknown)/g' src/services/*.ts && rm src/services/*.ts.bak
sed -i.bak 's/data: any/data: unknown/g' src/services/*.ts && rm src/services/*.ts.bak
sed -i.bak 's/response: any/response: unknown/g' src/services/*.ts && rm src/services/*.ts.bak
sed -i.bak 's/error: any/error: unknown/g' src/services/*.ts && rm src/services/*.ts.bak
sed -i.bak 's/result: any/result: unknown/g' src/services/*.ts && rm src/services/*.ts.bak

# Fix intelligent-router files
sed -i.bak 's/: any\[\]/: unknown[]/g' src/services/intelligent-router/*.ts && rm src/services/intelligent-router/*.ts.bak
sed -i.bak 's/: any)/: unknown)/g' src/services/intelligent-router/*.ts && rm src/services/intelligent-router/*.ts.bak

echo "✅ Replaced any types with unknown"

# Run ESLint fix
echo "🔧 Running ESLint..."
pnpm lint --fix || true

echo "📊 Final check..."
WARNINGS=$(pnpm lint 2>&1 | grep "warning" | wc -l)
ERRORS=$(pnpm lint 2>&1 | grep "error" | wc -l)

echo "✅ Complete: $ERRORS errors, $WARNINGS warnings remaining"