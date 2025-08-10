# Changelog

All notable changes to MARIA CODE will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0-alpha.1] - 2025-08-10

### 🎉 Initial Alpha Release

#### Added
- **Core Commands**
  - `mc code` - AI-powered code generation with intelligent model selection
  - `mc vision` - Image analysis using vision-capable providers
  - `mc review` - Comprehensive code review with suggestions
  - `mc test` - AI-powered test generation (unit/integration/e2e)
  - `mc commit` - Enhanced AI commit messages with Git integration
  - `mc chat` - Interactive chat with 40+ slash commands

- **AI Provider Support**
  - OpenAI (GPT-4o, GPT-4-turbo)
  - Anthropic (Claude 3 Opus/Sonnet)
  - Google (Gemini 2.5 Pro)
  - Groq (Mixtral, Llama 3)
  - LM Studio (Local models with 32K context)
  - Ollama (100+ local models)
  - vLLM (High-performance inference)

- **Intelligent Features**
  - Automatic model selection based on task type
  - Privacy-first with local model prioritization
  - Smart fallback mechanism
  - Context window management (up to 200K tokens)
  - Natural language understanding

- **Interactive Mode**
  - 40+ slash commands for various operations
  - Model management and switching
  - Session management and export
  - Real-time status and metrics

- **Developer Experience**
  - Zero-configuration setup
  - Auto-detection of local LLM servers
  - Progress indicators and feedback
  - Comprehensive error handling

#### Technical Details
- Built with TypeScript
- React-based interactive CLI using Ink
- Commander.js for command parsing
- Support for Node.js 18+

#### Known Issues
- Windows support is experimental
- Some local models may require manual configuration
- Video/Image generation commands require additional setup

### Contributors
- Bongin (@bonginkan) - Lead Developer, Bonginkan Inc.

---

## Previous Development (Pre-Alpha)

### Phase 4 (2025-08-10)
- Implemented core MVP commands
- Integrated AI routing system
- Added multi-provider support

### Phase 3 (2025-02-10)
- Removed external dependencies
- Created local storage services
- Single package structure

### Phase 2 (2025-02-01)
- Context window management
- Memory optimization
- Session persistence

### Phase 1 (2025-01-31)
- CLI foundation with 38 slash commands
- UI/UX implementation
- Build system setup

---

For more details, visit [GitHub Releases](https://github.com/bonginkan/maria/releases)