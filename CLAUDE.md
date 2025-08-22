# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

**MARIA Platform v2.0.0 "Memory Intelligence Edition"** - Revolutionary AI development CLI with breakthrough dual-layer memory system, enhanced interactive experience, complete local LLM integration, and enterprise-grade memory intelligence. This repository contains the proprietary source code for MARIA Platform.

### Core Architecture

- **Entry Points**: `src/cli.ts` (Commander.js CLI), `src/services/interactive-session.ts` (chat interface)
- **Core AI Engine**: `src/maria-ai.ts` with provider management and intelligent routing
- **Memory System**: `src/services/memory-system/` (dual-layer architecture with System1/System2)
- **Build System**: tsup for CJS bundling with React DevTools externalized
- **Distribution**: NPM package `@bonginkan/maria` with compiled binaries only

## Essential Commands

### Development Workflow (ZERO ERROR POLICY)
```bash
# Build and development
pnpm build                    # Build CLI using tsup
pnpm dev                      # Watch mode development  
pnpm clean                    # Remove dist/ directory

# Quality assurance (CRITICAL - ALL must pass)
pnpm lint --max-warnings 0   # ESLint with zero warnings enforced
pnpm type-check               # TypeScript type checking (strict mode)
pnpm test                     # Run vitest tests
pnpm test:coverage            # Tests with coverage reporting

# Combined quality check (run before commits)
pnpm lint --max-warnings 0 && pnpm type-check && pnpm test && pnpm build

# Local testing
npm link                      # Global CLI installation
maria --version              # Test CLI functionality
maria                         # Interactive mode (default command)
```

### Memory System Testing (v2.0.0)
```bash
# Test memory system functionality
node -e "const {DualMemoryEngine} = require('./dist/index.js'); console.log('Memory system loaded')"
maria                         # Interactive mode tests memory integration
/memory status                # View dual-layer memory statistics
/memory preferences           # Check learned user preferences
/memory context              # Show current project understanding
/memory clear                # Reset memory state if needed
/memory help                 # Memory system documentation
```

### Package Publishing
```bash
# Version management
pnpm version patch            # Bump version
pnpm version:sync             # Sync versions across packages
pnpm publish                  # Publish to npm

# Release channels
pnpm release:latest           # Latest stable release
pnpm release:alpha            # Alpha channel
pnpm release:beta             # Beta channel
```

### Local AI System Setup
```bash
./scripts/auto-start-llm.sh start    # Auto-start LM Studio
./scripts/health-monitor.sh check    # System health diagnostics
maria setup-ollama                   # Install/configure Ollama
maria setup-vllm                     # Install/configure vLLM
```

## 🎨 CLI Design System - 124-Character Framework

MARIA implements a revolutionary terminal UI design based on the [CLI Design Optimization SOW](./docs/03-sow/CLI_DESIGN_CHALK_OPTIMIZATION_SOW.md):

### Design Constants
```typescript
const DESIGN_CONSTANTS = {
  SCREEN_WIDTH: 124,       // Optimal design width
  CONTENT_WIDTH: 120,      // Content area (2-character margins)
  BORDER_WIDTH: 118,       // Inner border dimensions
  MAIN_CONTENT: 80,        // Primary content column
  SIDEBAR: 36,             // Secondary content (45% ratio)
};
```

### Unified Color System (7 Colors Only)
```typescript
const UNIFIED_COLOR_SYSTEM = {
  PRIMARY: chalk.cyan,     // Primary interface elements
  SUCCESS: chalk.green,    // Success states
  WARNING: chalk.yellow,   // Warnings
  ERROR: chalk.red,        // Errors
  INFO: chalk.blue,        // Information
  MUTED: chalk.gray,       // Secondary text
  ACCENT: chalk.magenta,   // Brand accents
};
```

### Minimal Icon System (6 Core Symbols)
- **Core Set**: `✓` Success • `✗` Error • `!` Warning • `i` Info • `⠋` Loading • `→` Arrow
- **FORBIDDEN**: All emoji (🚀 🎉 🎨 etc.) for terminal compatibility
- **Unicode Safety**: Carefully selected symbols for cross-platform display

## High-Level Architecture

### 🧠 Revolutionary Dual-Layer Memory System (Core Innovation)

**Location**: `src/services/memory-system/`

The memory system is MARIA's defining feature, implementing a cognitive psychology-inspired dual-layer architecture:

#### System 1 Memory (`system1-memory.ts`)
- **Fast, Intuitive Processing**: <50ms memory operations
- **Pattern Recognition**: Code patterns, user preferences, interaction history
- **Cache Management**: LRU caching with automatic cleanup (max 1000 nodes)
- **Knowledge Graph**: Concept relationships and semantic connections
- **Pattern Library**: Code templates, anti-patterns, best practices

#### System 2 Memory (`system2-memory.ts`)  
- **Deliberate, Analytical Processing**: Deep reasoning traces
- **Quality Assessment**: Code quality metrics and improvement suggestions
- **Decision Trees**: Complex decision-making context preservation
- **Enhancement Proposals**: Automated improvement recommendations
- **Reflection System**: Learning from past interactions and mistakes

#### Memory Coordinator (`memory-coordinator.ts`)
- **Cross-System Synchronization**: Orchestrates System 1 ↔ System 2 communication
- **Conflict Resolution**: Handles inconsistencies between memory layers
- **Performance Optimization**: Memory usage optimization and background processing
- **Adaptive Learning**: User behavior pattern analysis and adaptation

#### Dual Memory Engine (`dual-memory-engine.ts`)
- **Unified Interface**: Single API for all memory operations
- **Intelligent Routing**: Determines optimal memory system per query type
- **Context Awareness**: Maintains conversation context across sessions
- **Performance Metrics**: <50ms average latency, 60% startup optimization

### 🤖 AI Provider Architecture

**Core Engine**: `src/maria-ai.ts`
- **Multi-Provider Support**: OpenAI, Anthropic, Google, Groq, Local LLMs
- **Intelligent Routing**: Automatic provider selection based on query type
- **Health Monitoring**: Real-time provider status and failover
- **Memory Integration**: Seamless memory system integration across all providers

**Provider Management**: `src/providers/`
- **Base Provider** (`base-provider.ts`): Common provider interface
- **Local AI Support**: LM Studio, Ollama, vLLM integration
- **Cloud Providers**: GPT, Claude, Gemini, Grok support
- **Configuration**: Dynamic provider discovery and configuration

### 🎯 Interactive Session Architecture

**Entry Point**: `src/services/interactive-session.ts`
- **Readline Interface**: Advanced terminal input handling
- **Command Processing**: Slash command routing and execution
- **Memory Integration**: Automatic context preservation
- **Real-time AI**: Streaming responses with interrupt handling
- **Error Recovery**: Graceful error handling and recovery

### 🏗️ Command Infrastructure

**Command Registry**: `src/commands/`
- **40+ Commands**: Complete development toolkit
- **Memory-Enhanced**: All commands integrate with memory system
- **Standard Pattern**: Consistent command implementation across all features

#### Key Command Categories (v2.0.0 Enhanced):
- **Development**: `/code` (fixed workflow), `/bug`, `/lint`, `/typecheck`
- **AI Tools**: `/coderag`, `/document`, `/paper`
- **Local AI**: `/setup-ollama`, `/setup-vllm`
- **Memory System**: `/memory status`, `/memory preferences`, `/memory context`, `/memory clear`, `/memory help`
- **Quality**: `/security-review`, `/bug-analysis`
- **Interactive**: `/model` (arrow navigation), improved UX across all commands

#### Command Implementation Pattern:
```typescript
// src/commands/[command].ts
export default function register[Command]Command(program: Command) {
  program
    .command('commandname')
    .description('Command description')
    .option('--option <value>', 'Option description')
    .action(async (options) => {
      // Memory-aware implementation
      // Error handling with recovery
      // Streaming output support
    });
}
```

### 🧠 Intelligence Systems

#### Intelligent Router (`src/services/intelligent-router/`)
- **5-Language NLU**: English, Japanese, Chinese, Korean, Vietnamese
- **95%+ Intent Recognition**: Natural language → command mapping
- **Context Preservation**: Maintains conversation flow
- **Learning Engine**: Adapts to user patterns

#### Internal Mode System (`src/services/internal-mode/`)
- **50+ Cognitive States**: ✽ Thinking…, ✽ Debugging…, ✽ Analyzing…
- **Real-time Switching**: Context-aware mode transitions
- **Multi-language Support**: Localized mode descriptions
- **Memory Integration**: Mode history and pattern learning

## Code Quality Standards

**CRITICAL**: Zero-Error Policy - All code must pass before committing:
```bash
pnpm lint --max-warnings 0 && pnpm type-check && pnpm test && pnpm build
```

- ESLint errors: 0 (blocking)
- ESLint warnings: 0 (blocking)
- TypeScript errors: 0 (blocking)
- Failed tests: 0 (blocking)
- Build failures: 0 (blocking)

## Development Guidelines

- **ALWAYS** prefer editing existing files over creating new ones
- **NEVER** proactively create documentation files (*.md) unless explicitly requested
- Only use emojis if explicitly requested by the user
- Follow existing patterns in similar commands/services
- Maintain consistency with the unified color system and minimal icon set
- Use relative imports within the codebase
- Target ES2022 with strict TypeScript mode

## AI Model Configuration

The system supports 22+ models with intelligent routing:
- **Cloud**: GPT-5, Claude Opus 4.1, Gemini 2.5, Grok-4, Llama via Groq
- **Local**: LM Studio, Ollama (llama3.2, mistral, qwen2.5), vLLM
- **Environment Variables**: See package.json for full list of API keys

## Licensing

- **Dual-License Model**: Personal use (free) / Enterprise (paid)
- **Source Protection**: Core algorithms and AI systems remain proprietary
- **Distribution**: Only compiled binaries via NPM
- **Contact**: enterprise@bonginkan.ai for licensing inquiries

## TypeScript Configuration

**Target**: ES2022 with strict mode enabled
**Module System**: ESNext with bundler resolution
**Key Strictness Settings**:
- `noImplicitAny`: true
- `strictNullChecks`: true  
- `noUnusedLocals`: true
- `noUnusedParameters`: true
- `noImplicitReturns`: true

## Memory System Implementation Details

### System Integration Flow
1. **Interactive Session** (`src/services/interactive-session.ts`) initializes memory
2. **Memory Engine** (`dual-memory-engine.ts`) provides unified API
3. **Memory Coordinator** orchestrates cross-system communication
4. **Commands** automatically integrate with memory for context awareness

### Memory Configuration Structure
```typescript
interface MemoryConfig {
  system1: {
    maxKnowledgeNodes: 1000,
    embeddingDimension: 1536,
    cacheSize: 100,
    compressionThreshold: 0.75,
    accessDecayRate: 0.03
  },
  system2: {
    maxReasoningTraces: 100,
    qualityThreshold: 0.75,
    reflectionFrequency: 12,
    enhancementEvaluationInterval: 6
  },
  coordinator: {
    syncInterval: 5000,
    conflictResolutionStrategy: 'balanced',
    learningRate: 0.15,
    adaptationThreshold: 0.7
  }
}
```

### Testing Memory System
```bash
# API-level testing
node -e "const {DualMemoryEngine} = require('./dist/index.js'); /* test code */"

# Interactive testing (v2.0.0)  
maria
/memory status      # Shows dual-layer memory statistics
/memory preferences # View learned user preferences
/memory context     # Show current project understanding
/memory help        # Complete memory system documentation
```

## Critical Development Notes

- **NEVER** create documentation files (*.md) unless explicitly requested
- **ALWAYS** prefer editing existing files over creating new ones
- **ZERO ERROR POLICY**: All lint/type/test errors must be resolved
- **Memory Integration**: All new commands should integrate with memory system
- **Local AI Priority**: Prefer local AI solutions for privacy-first development

## Recent Major Updates (v2.0.0 "Memory Intelligence Edition")

### ✨ Enhanced Interactive Experience
- **Fixed `/code` Command**: Now properly processes subsequent input for code generation
- **Persistent "Thinking..." Display**: Shows status until AI actually starts responding
- **Interactive Model Selection**: Navigate models with ↑/↓ arrows, Enter to select
- **Immediate AI Feedback**: Real-time status indication eliminates perceived bugs
- **Improved Command Flow**: Better state management for all interactive commands

### 🧠 Revolutionary Dual-Layer Memory System v2.0
- **System 1 (Fast/Intuitive)**: Enhanced pattern recognition with 70% faster responses
- **System 2 (Deliberate/Analytical)**: Advanced reasoning traces with memory persistence
- **Cross-Session Learning**: AI assistant remembers and improves across sessions
- **Context-Aware Intelligence**: Every interaction builds comprehensive understanding
- **Personalized Adaptation**: Learns coding style, preferences, and workflows

### 🏠 Complete Local LLM Integration
- **Automatic Detection & Setup**: Auto-configures Ollama, vLLM, LM Studio
- **Enhanced Service Management**: Improved startup and health monitoring
- **Privacy-First Development**: All processing runs locally with zero cloud dependencies
- **Multi-Model Support**: Seamlessly switch between 20+ local models
- **One-Command Setup**: `maria setup-ollama` / `maria setup-vllm` for instant configuration

### 🔬 Advanced Code Generation & Analysis
- **Async Provider Initialization**: Non-blocking service startup for better performance
- **Enhanced Error Handling**: Comprehensive error recovery and user feedback
- **Memory-Enhanced Code Gen**: Learns from coding patterns and preferences
- **Context-Aware Suggestions**: Intelligent recommendations based on project history
- **Real-time Quality Analysis**: Live feedback with historical performance tracking

### 📊 Performance & Reliability
- **70% Faster Startup**: Enhanced lazy loading and optimized initialization
- **Memory Efficiency**: Intelligent memory management with automatic cleanup
- **High Availability**: Fault-tolerant design with automatic service recovery
- **Quality Assurance**: 100% test coverage with comprehensive validation
- **Production Ready**: Battle-tested with enterprise-grade reliability