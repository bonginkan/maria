# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

**MARIA Platform v1.8.5** - Enterprise-grade AI development CLI with revolutionary dual-layer memory system, complete local LLM integration, and comprehensive code quality analysis platform. This proprietary platform operates under a dual-license model (free personal use, paid enterprise licensing).

### Core Architecture

- **Proprietary Technology**: Source code (`src/`) is proprietary and not distributed publicly
- **Compiled Distribution**: NPM package `@bonginkan/maria` contains only compiled JavaScript binaries
- **Entry Points**: `src/cli.ts` (Commander.js CLI), `src/services/interactive-session.ts` (chat interface)
- **Build System**: tsup for CJS bundling with React DevTools externalized

## Essential Commands

### Development Workflow
```bash
pnpm build              # Build CLI using tsup
pnpm dev                # Watch mode development
pnpm clean              # Remove dist/ directory

# Quality assurance (ZERO errors/warnings policy)
pnpm lint --max-warnings 0    # ESLint with zero warnings enforced
pnpm type-check               # TypeScript type checking
pnpm test                     # Run tests
pnpm test:coverage           # Tests with coverage

# Local testing
npm link                     # Global CLI installation
maria --version             # Test CLI functionality
maria                        # Interactive mode (Default - no 'chat' needed!)
```

### Package Publishing
```bash
cd maria-oss
npm version patch           # Version bump
npm publish --otp=<code>   # Publish to npm
```

### Local AI Setup
```bash
./scripts/auto-start-llm.sh start    # Start LM Studio
./scripts/health-monitor.sh check    # System diagnostics
maria setup-ollama                   # Install Ollama
maria setup-vllm                     # Install vLLM
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

### 🤖 Intelligence Systems

1. **Intelligent Router** (`src/services/intelligent-router/`)
   - 5-language natural language understanding (EN/JA/ZH/KO/VI)
   - 95%+ intent recognition accuracy
   - Automatic command routing from conversation

2. **Internal Mode System** (`src/services/internal-mode/`)
   - 50 cognitive states (✽ Thinking…, ✽ Debugging…, etc.)
   - Real-time mode switching based on context
   - Multi-language support with complete localization

3. **Dual-Layer Memory System** (`src/services/memory-system/`)
   - System 1: Fast pattern recognition and cache
   - System 2: Deep reasoning traces and decision trees
   - Context-aware intelligence across all commands
   - <50ms memory operations with 60% startup optimization

4. **Multi-Agent Orchestration** (`src/services/multi-agent-orchestrator.ts`)
   - DeepCode integration for paper-to-code transformation
   - 8+ specialized agents with parallel execution
   - RAG-enhanced workflow processing

### 🏗️ Command Infrastructure

- **30+ Slash Commands**: Complete development toolkit in `src/commands/`
- **Memory-Enhanced Commands**: `/code-memory`, `/bug-memory`, `/lint-memory`, `/typecheck-memory`
- **Code Quality Platform**: `/bug`, `/lint`, `/typecheck`, `/security-review` (Phase 6 Complete)
- **Advanced AI Tools**: `/coderag` (vector search), `/document` (multi-format processing)
- **Local AI Integration**: `/setup-ollama`, `/setup-vllm` for privacy-first development

### 📐 Command Implementation Pattern

```typescript
// src/commands/[command].ts
export default function register[Command]Command(program: Command) {
  program
    .command('commandname')
    .description('Command description')
    .option('--option <value>', 'Option description')
    .action(async (options) => {
      // Implementation
    });
}
```

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

## Recent Improvements (v1.8.5)

- **Memory System Integration**: Dual-layer architecture with personalized learning
- **Local AI Detection**: Automatic setup for Ollama, vLLM, LM Studio
- **Default Command**: `maria` starts interactive mode directly
- **Model Selection**: Fixed freezing issues with `/model` command
- **Interrupt System**: Stop AI responses mid-stream with new input