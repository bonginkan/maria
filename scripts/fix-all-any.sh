#!/bin/bash

echo "🔧 Fixing ALL remaining any warnings with sed..."

# Fix each file individually with exact replacements
echo "Fixing auto-improve.tsx..."
sed -i '' '338s/: any/: Record<string, unknown>/g' src/commands/auto-improve.tsx
sed -i '' '608s/: any/: Record<string, unknown>/g' src/commands/auto-improve.tsx

echo "Fixing bug.ts..."
sed -i '' '343s/: any/: unknown/g' src/commands/bug.ts

echo "Fixing slides-v2.tsx..."
sed -i '' '228s/: any/: unknown/g' src/commands/slides-v2.tsx

echo "Fixing status-enhanced.ts..."
sed -i '' '429s/: any/: unknown/g' src/commands/status-enhanced.ts

echo "Fixing AgentManager.tsx..."
sed -i '' '310s/: any/: unknown/g' src/components/AgentManager.tsx

echo "Fixing ChatInterface-v2.tsx..."
sed -i '' '57s/: any/: unknown/g' src/components/ChatInterface-v2.tsx

echo "Fixing ChatInterface.tsx..."
sed -i '' '55s/, any>/, unknown>/g' src/components/ChatInterface.tsx

echo "Fixing ConfigPanel.tsx..."
sed -i '' '70s/: any/: unknown/g' src/components/ConfigPanel.tsx
sed -i '' '73s/: any/: unknown/g' src/components/ConfigPanel.tsx
sed -i '' '76s/: any/: unknown/g' src/components/ConfigPanel.tsx

echo "Fixing MCPManager.tsx..."
sed -i '' '336s/: any/: unknown/g' src/components/MCPManager.tsx

echo "Fixing ModelSelector.tsx..."
sed -i '' '249s/: any/: unknown/g' src/components/ModelSelector.tsx

echo "Fixing config-manager.ts..."
sed -i '' '56s/: any/: unknown/g' src/config/config-manager.ts
sed -i '' '60s/: any/: unknown/g' src/config/config-manager.ts

echo "Fixing ai-chat-service-v2.ts..."
sed -i '' '451s/: any/: unknown/g' src/services/ai-chat-service-v2.ts

echo "Fixing chat-context.service.ts..."
sed -i '' '301s/: any/: unknown/g' src/services/chat-context.service.ts
sed -i '' '306s/: any/: unknown/g' src/services/chat-context.service.ts

echo "Fixing huggingface-service.ts..."
sed -i '' '237s/: any/: unknown/g' src/services/huggingface-service.ts

echo "Fixing intelligent-router/index.ts..."
sed -i '' '74s/: any/: unknown/g' src/services/intelligent-router/index.ts

echo "Fixing multimodal-handler.ts..."
sed -i '' '349s/: any/: unknown/g' src/services/intelligent-router/multimodal-handler.ts
sed -i '' '555s/: any/: unknown/g' src/services/intelligent-router/multimodal-handler.ts
sed -i '' '629s/: any/: unknown/g' src/services/intelligent-router/multimodal-handler.ts
sed -i '' '642s/: any/: unknown/g' src/services/intelligent-router/multimodal-handler.ts

echo "Fixing stream-processor.ts..."
sed -i '' '474s/: any/: unknown/g' src/services/intelligent-router/stream-processor.ts

echo "Fixing interactive-session.ts..."
sed -i '' '73s/: any/: unknown/g' src/services/interactive-session.ts
sed -i '' '128s/: any/: unknown/g' src/services/interactive-session.ts

echo "Fixing learning-engine.ts..."
sed -i '' '605s/: any/: unknown/g' src/services/learning-engine.ts

echo "Fixing local-auth.service.ts..."
sed -i '' '79s/: any/: unknown/g' src/services/local-auth.service.ts

echo "Fixing local/auth.ts..."
sed -i '' '140s/: any/: unknown/g' src/services/local/auth.ts

echo "Fixing neo4j.service.ts..."
sed -i '' '223s/: any/: unknown/g' src/services/neo4j.service.ts
sed -i '' '301s/: any/: unknown/g' src/services/neo4j.service.ts

echo "Fixing slash-command-handler.ts parsing error..."
echo "}" >> src/services/slash-command-handler.ts

echo "✅ All any warnings fixed!"

# Run lint to verify
echo "📊 Verifying..."
pnpm lint 2>&1 | grep "warning.*no-explicit-any" | wc -l