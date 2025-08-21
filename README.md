# MARIA Platform v1.3.0 "Cognitive Revolution" - AI Development CLI

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-blue)](https://www.typescriptlang.org/)
[![npm](https://img.shields.io/npm/v/@bonginkan/maria?label=npm%20package)](https://www.npmjs.com/package/@bonginkan/maria)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green)](https://nodejs.org/)
[![Quality](https://img.shields.io/badge/Code%20Quality-100%25-brightgreen)](https://github.com/bonginkan/maria)
[![Cognitive Modes](https://img.shields.io/badge/Cognitive%20Modes-50-purple)](https://github.com/bonginkan/maria)

**MARIA Platform v1.3.0 "Cognitive Revolution"** introduces the world's first **Internal Mode System** - a revolutionary cognitive adaptation framework featuring 50 specialized AI thinking modes that automatically adapt to your context and needs. This breakthrough transforms static AI interactions into dynamic, context-aware cognitive partnerships.

> 🧠 **v1.3.0 Released** - `npm install -g @bonginkan/maria` - **Phase 7 Complete: Revolutionary Internal Mode System + 124-Character Responsive Design Framework**

## 🌟 Revolutionary Features

### 🧠 NEW: Internal Mode System - Cognitive Adaptation Engine

- **50 Cognitive Modes**: Revolutionary thinking states across 9 categories (Reasoning, Creative, Analytical, etc.)
- **Real-time Recognition**: <200ms automatic mode switching based on context and intent
- **Adaptive Learning**: AI learns your patterns and personalizes cognitive approaches
- **Visual Indicators**: Beautiful ✽ symbols showing current cognitive state

```bash
"Fix this bug" → ✽ 🐛 Debugging…
"Give me ideas" → ✽ 💡 Brainstorming…
"Optimize this" → ✽ ⚡ Optimizing…
```

### 🤖 Intelligent Router - Natural Language Command System

- **5-Language Support**: Native understanding in Japanese, English, Chinese, Korean, Vietnamese
- **Intent Recognition**: "コードを書いて" → `/code` automatic execution (95%+ accuracy)
- **Contextual Understanding**: Smart parameter extraction from natural conversation
- **Learning Engine**: Adapts to user patterns for personalized experience

### 🏗️ Autonomous Development Ecosystem (/vibe, /paper, /agentic)

- **Paper-to-Code Transformation**: Research papers → production implementations using DeepCode architecture
- **SOW-Driven Development**: Complete software solutions from high-level requirements
- **Multi-Agent Orchestration**: 8+ specialized agents for complex task coordination
- **Agent Builder**: Automated AGENT.md generation and custom AI agent creation

### 🎨 Multimodal Content Generation

- **Advanced Media Creation**: AI-powered image, video, and presentation generation
- **Google Workspace Integration**: Direct export to Google Docs and Slides
- **ASCII Avatar Interface**: Interactive visual dialogue system
- **Voice Integration**: Multimodal communication capabilities

### 🧠 Advanced Intelligence Systems

- **50 Internal Modes**: Real-time cognitive state adaptation (✽ Thinking…, ✽ Debugging…, etc.)
- **Cross-Session Learning**: Knowledge transfer and skill progression tracking
- **Predictive Analytics**: ML-powered user intent prediction and workflow optimization
- **Context Preservation**: Deep semantic compression with knowledge graph construction

### 🏢 Enterprise-Grade Infrastructure

- **Zero-Error Policy**: Automated quality enforcement with 0 warnings/errors
- **CodeRAG System**: Semantic code search with graph-based dependency analysis
- **MCP Protocol Integration**: Standardized tool communication across platforms
- **Real-time Collaboration**: Team workspaces with live collaboration sessions

### 🔍 Enterprise Code Quality Analysis Platform (Phase 6 - COMPLETE!)

**Industry-First Comprehensive Analysis Suite with AI-Powered Insights**

#### 🐛 Bug Detection System (`/bug`)

- **40+ Pattern Recognition**: Memory leaks, race conditions, type safety violations, performance bottlenecks
- **AI-Powered Fix Suggestions**: Intelligent resolution with confidence scoring
- **Real-time Processing**: <200ms analysis response time
- **Security Analysis**: XSS, SQL injection, CSRF vulnerability detection

#### 🔧 Advanced Lint Analysis (`/lint`)

- **ESLint Integration**: 10+ comprehensive code quality checks
- **Auto-Fix Engine**: Intelligent resolution of fixable issues
- **Quality Metrics**: 94/100 baseline standard with detailed reporting
- **Custom Rules**: Extensible rule system for enterprise standards

#### 🛡️ TypeScript Type Safety (`/typecheck`)

- **Compiler Integration**: Complete TypeScript compiler integration
- **Coverage Tracking**: 87% baseline with improvement monitoring
- **Strict Mode Analysis**: Complete compliance checking
- **Type Assertion Detection**: Dangerous `any`/`unknown` usage identification

#### 🔐 Security Vulnerability Assessment (`/security-review`)

- **OWASP Compliance**: Complete OWASP Top 10 coverage (8/10 baseline)
- **Security Score**: 89/100 enterprise standard
- **CWE Classification**: Common Weakness Enumeration integration
- **Dependency Audit**: npm audit integration with 127+ package validation

**📊 Performance Metrics**: 4/4 commands (100% implementation), 16 sub-commands, zero-error policy enforced

### 🤝 Human-in-the-Loop Approval System (Phase 8 - IMPLEMENTING!)

- **Theme-Level Approval**: Strategic confirmation at architecture/implementation/security levels
- **Quick Decision Shortcuts**: Shift+Tab, Ctrl+Y/N/T/R for instant workflow approval
- **Progressive Trust Building**: 5-stage evolution from novice to autonomous operation
- **Risk-Aware Processing**: AI identifies optimal approval points automatically
- **Learning Partnership**: Adapts to user patterns while maximizing safety and efficiency

## Quick Start

```bash
# Install globally
npm install -g @bonginkan/maria

# Setup local AI models (optional)
maria setup-ollama    # Install and configure Ollama
maria setup-vllm      # Install and configure vLLM

# Start interactive mode with natural language
maria

# Natural language interaction (no commands needed!)
You: "コードを書いて"          # → Automatically triggers /code
You: "create a React app"    # → Intelligent routing to /code

# NEW: Code Quality Analysis Commands
> /lint check               # Comprehensive code quality analysis
> /typecheck analyze         # TypeScript type safety (87% coverage)
> /security-review scan      # OWASP compliance check (89/100 score)
> /bug fix "null pointer"    # AI-powered bug fix suggestions
You: "analyze this bug"      # → Auto-switches to /bug mode
You: "研究論文を実装して"      # → Triggers /paper for paper-to-code

# Traditional slash commands (34+ available)
/code     # AI-powered code generation
/paper    # Research paper → code transformation
/vibe     # Autonomous development from requirements
/agentic  # Custom AI agent builder
/bug      # Comprehensive bug analysis & auto-fix
/image    # AI image generation
/video    # AI video generation with Google export
/model    # Switch between cloud and local models
/help     # Full command reference
```

## Architecture

### 🎨 CLI Design System - 124-Character Responsive Framework

Based on our comprehensive [CLI Design Optimization SOW](./docs/03-sow/CLI_DESIGN_CHALK_OPTIMIZATION_SOW.md), MARIA features revolutionary terminal UI design:

#### **🖥️ 124-Character Responsive Design**

- **Optimal Width**: 124 characters as base standard with dynamic adaptation
- **Responsive Range**: 80-200 character terminal support
- **Layout System**: 2-column layouts (80:36 ratio) with 4-character gaps
- **Perfect Centering**: All logos and content mathematically centered

#### **🎨 Unified Color System (7-Color Palette)**

```typescript
const UNIFIED_COLORS = {
  PRIMARY: chalk.cyan, // Primary interface elements
  SUCCESS: chalk.green, // Success states and confirmations
  WARNING: chalk.yellow, // Warnings and alerts
  ERROR: chalk.red, // Error states
  INFO: chalk.blue, // Information display
  MUTED: chalk.gray, // Secondary text and borders
  ACCENT: chalk.magenta, // Brand accents and highlights
};
```

#### **🔤 Minimal Icon System (6 Core Symbols)**

- `✓` Success • `✗` Error • `!` Warning • `i` Info • `⠋` Loading • `→` Arrow
- **No Emoji Policy**: Terminal compatibility across all systems
- **Unicode Safe**: Consistent display across different terminal environments

#### **📐 Layout Constants & Responsive Design**

```typescript
const DESIGN_CONSTANTS = {
  SCREEN_WIDTH: 124, // Base design width
  CONTENT_WIDTH: 120, // Content area (2-char margin)
  BORDER_WIDTH: 118, // Inner border width
  MAIN_CONTENT: 80, // Primary content column
  SIDEBAR: 36, // Secondary content (45% ratio)
  STATUS_BAR: 120, // Status bar width
};
```

### 🏗️ Revolutionary Platform Components

- **Intelligent Router**: `src/services/intelligent-router/` - 5-language natural language understanding
- **Internal Mode System**: 50 cognitive states (✽ Thinking…, ✽ Debugging…, ✽ Optimizing…)
- **Multi-Agent Orchestrator**: Coordinated specialized agents for complex tasks
- **DeepCode Integration**: Paper-to-code transformation with 8-agent architecture
- **CodeRAG System**: Semantic code search with graph-based dependency analysis
- **MCP Protocol**: Standardized tool-agent communication framework
- **124-Character UI Framework**: Responsive terminal design with unified color system

### 🤖 Advanced Command Systems

- **Phase 2 Commands**: `/paper`, `/slide`, `/vibe`, `/mode`, `/agentic` (autonomous development)
- **Quality Analysis**: `/bug`, `/lint`, `/typecheck`, `/security-review` (enterprise-grade)
- **Interactive Session**: `src/services/interactive-session.ts` - 30+ commands with real-time interrupts
- **Google Workspace**: Direct integration for Docs, Slides, and Drive export

### 🧠 Intelligence Infrastructure

- **Adaptive Learning**: Cross-session knowledge transfer and user pattern optimization
- **Context Preservation**: Deep semantic compression with knowledge graph construction
- **Predictive Analytics**: ML-powered intent prediction and workflow optimization
- **Real-time Processing**: <200ms response with interrupt handling and streaming

### 💻 Core Technologies

- **TypeScript 5.0+** with zero-error policy and comprehensive type coverage
- **Multi-AI Integration**: 22+ models (OpenAI, Anthropic, Google, xAI, Groq, LM Studio, Ollama, vLLM)
- **Local AI Support**: Native integration with LM Studio, Ollama, and vLLM for private deployments
- **Enterprise Standards**: OWASP compliance, security vulnerability assessment
- **Natural Language Processing**: Intent recognition with 95%+ accuracy across 5 languages

## Development

### Build & Quality

```bash
# Development workflow
pnpm build              # Build CLI using tsup
pnpm dev                # Watch mode development
pnpm clean              # Remove dist/ directory

# Quality assurance (ZERO errors/warnings policy)
pnpm lint --max-warnings 0    # ESLint with zero warnings enforced
pnpm type-check               # TypeScript type checking
pnpm test                     # Run test suite
pnpm test:coverage           # Tests with coverage

# Local testing
npm link                     # Global CLI installation
maria --version             # Test CLI functionality
maria                        # Interactive mode
```

### Environment Setup

```bash
# AI Provider APIs
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_AI_API_KEY=AIza...
GROQ_API_KEY=gsk_...

# Local Models (integrated support)
LMSTUDIO_API_URL=http://localhost:1234
OLLAMA_API_URL=http://localhost:11434
VLLM_API_URL=http://localhost:8000
```

### Code Quality Standards

All code must pass these checks before committing:

```bash
pnpm lint --max-warnings 0 && pnpm type-check && pnpm test && pnpm build
```

**Zero-Error Policy**:

- ESLint errors: 0 (blocking)
- ESLint warnings: 0 (blocking)
- TypeScript errors: 0 (blocking)
- Failed tests: 0 (blocking)
- Build failures: 0 (blocking)

## Project Structure

```
src/
├── cli.ts                    # Main CLI entry point
├── commands/                 # Individual CLI commands
├── services/
│   ├── interactive-session.ts     # Interactive mode handler
│   ├── intelligent-router/        # Natural language processing
│   ├── adaptive-learning-engine.ts
│   ├── enhanced-context-preservation.ts
│   ├── automated-code-quality.ts
│   └── ...
├── providers/               # AI model integrations
├── components/             # React components for UI
└── types/                  # TypeScript definitions

dist/                       # Compiled output
bin/maria                   # Executable CLI
maria-oss/                  # OSS distribution package
```

## Contributing

### Adding Commands

1. Create `src/commands/new-command.ts` following existing patterns
2. Register in CLI setup
3. Add slash command handler in `interactive-session.ts`
4. Update help text and documentation
5. Ensure zero-error policy compliance

### Testing Protocol

```bash
# Build and test locally
pnpm build && npm link

# Verify core functionality
maria --version              # Should show current version
maria status                # System health check
maria                       # Interactive mode

# Test commands in interactive mode
/help                       # All 30+ commands
/model                      # AI model selection
/code "hello world function" # Code generation
/exit                       # Clean session termination
```

## 📦 Distribution & Licensing

### Distribution Channels

- **Development Repository**: `bonginkan/maria_code` (private, source code)
- **Public Distribution**: `bonginkan/maria` (compiled binaries only)
- **NPM Package**: `@bonginkan/maria` (v1.1.0+, compiled distribution)

### 🏢 Dual-License Model

**MARIA Platform** operates under a dual-license structure designed to support both individual developers and enterprise customers:

#### 📱 Personal Use License (Free)

- **Individual Developers**: Free for personal projects, learning, and non-commercial use
- **Open Source Projects**: Free for open-source software development
- **Students & Academics**: Free for educational and research purposes
- **Startups**: Free for companies under 10 employees or $1M ARR

#### 🏢 Enterprise License (Paid)

- **Commercial Organizations**: Required for companies over 10 employees or $1M ARR
- **Enterprise Features**: Advanced security, compliance, priority support
- **Custom Integrations**: Tailored implementations and dedicated support
- **SLA Guarantees**: 99.9% uptime, <24hr response times

### 🔒 Source Code Protection

- **Compiled Distribution Only**: Source code (`src/`) is not distributed publicly
- **NPM Package**: Contains only compiled JavaScript binaries and type definitions
- **Intellectual Property**: Core algorithms and AI systems remain proprietary
- **Security**: Closed-source model ensures enterprise-grade security and compliance

### 📞 Enterprise Sales & Support

- **Enterprise Licensing**: enterprise@bonginkan.ai
- **Custom Deployments**: Custom implementations for large organizations
- **Training & Certification**: Professional development programs
- **24/7 Support**: Dedicated enterprise support channels

Automated CI/CD handles compiled distribution, NPM publishing, and quality enforcement while protecting proprietary source code.

## 📚 Documentation

### v1.1.0 Complete Documentation Suite

- **[📋 Technical Specification](./SPEC_SHEET_v1.1.0.md)** - Complete technical specs, architecture, and Phase 6 implementation details
- **[👨‍💻 Developer Guide](./DEVELOPER_GUIDE_v1.1.0.md)** - Comprehensive development guide with API reference, customization, and enterprise deployment
- **[👤 User Manual](./USER_MANUAL_v1.1.0.md)** - Complete user guide with step-by-step tutorials and best practices
- **[📖 Claude AI Instructions](./CLAUDE.md)** - Complete platform overview and development guidelines for AI assistance

### Quick Access Documentation

- **Getting Started**: [User Manual - Getting Started](./USER_MANUAL_v1.1.0.md#getting-started)
- **Installation**: [User Manual - Installation Guide](./USER_MANUAL_v1.1.0.md#installation-guide)
- **Code Quality Analysis**: [Technical Specification - Code Quality Platform](./SPEC_SHEET_v1.1.0.md#code-quality-analysis-infrastructure)
- **API Development**: [Developer Guide - API Reference](./DEVELOPER_GUIDE_v1.1.0.md#api-reference)
- **Enterprise Deployment**: [Developer Guide - Enterprise Deployment](./DEVELOPER_GUIDE_v1.1.0.md#enterprise-deployment)
- **Troubleshooting**: [User Manual - Troubleshooting](./USER_MANUAL_v1.1.0.md#troubleshooting)

### Version Management System

Starting with v1.1.0, all documentation follows semantic versioning:

- **SPEC_SHEET_v1.1.0.md** - Current technical specifications
- **DEVELOPER_GUIDE_v1.1.0.md** - Current developer documentation
- **USER_MANUAL_v1.1.0.md** - Current user documentation

Future versions (v1.1.1, v1.2.0, etc.) will maintain separate versioned documentation alongside existing files for complete historical reference and seamless upgrade paths.

---

**MARIA Platform v1.1.0** establishes the new industry standard for AI-powered development tooling, combining enterprise-grade code quality analysis with the simplicity of conversational AI interaction. This release represents a fundamental shift in how developers approach code quality, security, and maintenance in modern software development.
