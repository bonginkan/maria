#!/bin/bash

echo "🔧 Fixing all remaining specific any warnings..."

# Fix auto-improve.tsx - lines 338 and 608
sed -i.bak 's/(promptConfig: any)/(promptConfig: unknown)/g' src/commands/auto-improve.tsx && rm src/commands/auto-improve.tsx.bak
sed -i.bak 's/(projectConfig: any)/(projectConfig: unknown)/g' src/commands/auto-improve.tsx && rm src/commands/auto-improve.tsx.bak

# Fix bug.ts - line 343
sed -i.bak 's/(issue: any)/(issue: unknown)/g' src/commands/bug.ts && rm src/commands/bug.ts.bak

# Fix slides-v2.tsx - line 228
sed -i.bak 's/(slides: any)/(slides: unknown)/g' src/commands/slides-v2.tsx && rm src/commands/slides-v2.tsx.bak

# Fix status-enhanced.ts - line 429
sed -i.bak 's/(analytics: any)/(analytics: unknown)/g' src/commands/status-enhanced.ts && rm src/commands/status-enhanced.ts.bak

# Fix AgentManager.tsx - line 310
sed -i.bak 's/(agentConfig: any)/(agentConfig: unknown)/g' src/components/AgentManager.tsx && rm src/components/AgentManager.tsx.bak

# Fix ChatInterface-v2.tsx - line 57
sed -i.bak 's/messages: any\[\]/messages: unknown[]/g' src/components/ChatInterface-v2.tsx && rm src/components/ChatInterface-v2.tsx.bak

# Fix ChatInterface.tsx - line 55
sed -i.bak 's/Record<string, any>/Record<string, unknown>/g' src/components/ChatInterface.tsx && rm src/components/ChatInterface.tsx.bak

# Fix ConfigPanel.tsx - lines 70, 73, 76
sed -i.bak 's/value: any/value: unknown/g' src/components/ConfigPanel.tsx && rm src/components/ConfigPanel.tsx.bak
sed -i.bak 's/settings: any/settings: unknown/g' src/components/ConfigPanel.tsx && rm src/components/ConfigPanel.tsx.bak
sed -i.bak 's/config: any/config: unknown/g' src/components/ConfigPanel.tsx && rm src/components/ConfigPanel.tsx.bak

# Fix MCPManager.tsx - line 336
sed -i.bak 's/(server: any)/(server: unknown)/g' src/components/MCPManager.tsx && rm src/components/MCPManager.tsx.bak

# Fix ModelSelector.tsx - line 249  
sed -i.bak 's/(selectedModel: any)/(selectedModel: unknown)/g' src/components/ModelSelector.tsx && rm src/components/ModelSelector.tsx.bak

# Fix config-manager.ts - lines 56, 60
sed -i.bak 's/configs: any\[\]/configs: unknown[]/g' src/config/config-manager.ts && rm src/config/config-manager.ts.bak
sed -i.bak 's/item: any/item: unknown/g' src/config/config-manager.ts && rm src/config/config-manager.ts.bak

# Fix ai-chat-service-v2.ts - line 451
sed -i.bak 's/e: any/e: unknown/g' src/services/ai-chat-service-v2.ts && rm src/services/ai-chat-service-v2.ts.bak

# Fix chat-context.service.ts - lines 301, 306
sed -i.bak 's/(context: any)/(context: unknown)/g' src/services/chat-context.service.ts && rm src/services/chat-context.service.ts.bak
sed -i.bak 's/(messages: any)/(messages: unknown)/g' src/services/chat-context.service.ts && rm src/services/chat-context.service.ts.bak

# Fix huggingface-service.ts - line 237
sed -i.bak 's/(modelInfo: any)/(modelInfo: unknown)/g' src/services/huggingface-service.ts && rm src/services/huggingface-service.ts.bak

# Fix intelligent-router/index.ts - line 74
sed -i.bak 's/(routerConfig: any)/(routerConfig: unknown)/g' src/services/intelligent-router/index.ts && rm src/services/intelligent-router/index.ts.bak

# Fix multimodal-handler.ts - lines 349, 555, 629, 642
sed -i.bak 's/(audioBuffer: any)/(audioBuffer: unknown)/g' src/services/intelligent-router/multimodal-handler.ts && rm src/services/intelligent-router/multimodal-handler.ts.bak
sed -i.bak 's/(imageBuffer: any)/(imageBuffer: unknown)/g' src/services/intelligent-router/multimodal-handler.ts && rm src/services/intelligent-router/multimodal-handler.ts.bak
sed -i.bak 's/(gestureData: any)/(gestureData: unknown)/g' src/services/intelligent-router/multimodal-handler.ts && rm src/services/intelligent-router/multimodal-handler.ts.bak
sed -i.bak 's/(uiData: any)/(uiData: unknown)/g' src/services/intelligent-router/multimodal-handler.ts && rm src/services/intelligent-router/multimodal-handler.ts.bak

# Fix stream-processor.ts - line 474
sed -i.bak 's/(streamData: any)/(streamData: unknown)/g' src/services/intelligent-router/stream-processor.ts && rm src/services/intelligent-router/stream-processor.ts.bak

# Fix interactive-session.ts - lines 73, 128
sed -i.bak 's/session: any/session: unknown/g' src/services/interactive-session.ts && rm src/services/interactive-session.ts.bak
sed -i.bak 's/state: any/state: unknown/g' src/services/interactive-session.ts && rm src/services/interactive-session.ts.bak

# Fix learning-engine.ts - line 605
sed -i.bak 's/data: any/data: unknown/g' src/services/learning-engine.ts && rm src/services/learning-engine.ts.bak

# Fix local-auth.service.ts - line 79
sed -i.bak 's/(user: any)/(user: unknown)/g' src/services/local-auth.service.ts && rm src/services/local-auth.service.ts.bak

# Fix local/auth.ts - line 140
sed -i.bak 's/(authData: any)/(authData: unknown)/g' src/services/local/auth.ts && rm src/services/local/auth.ts.bak

# Fix neo4j.service.ts - lines 223, 301
sed -i.bak 's/(result: any)/(result: unknown)/g' src/services/neo4j.service.ts && rm src/services/neo4j.service.ts.bak
sed -i.bak 's/(node: any)/(node: unknown)/g' src/services/neo4j.service.ts && rm src/services/neo4j.service.ts.bak

echo "✅ All any types replaced with unknown"

# Run lint to check
echo "📊 Running final lint check..."
pnpm lint 2>&1 | tail -10

echo "✅ Complete!"