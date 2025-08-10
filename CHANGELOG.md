# Changelog

All notable changes to MARIA will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-08-10

### Added
- 🚀 **Initial Release** - MARIA Intelligent CLI Assistant
- 🔒 **Privacy-First Design** - Local LLM support with offline capabilities
- 🧠 **Multi-Model Support** - 60+ models across 8 AI providers
- ⚡ **Zero Configuration** - Automatic provider detection and setup
- 🎯 **Intelligent Routing** - Task-based provider and model selection
- 🛡️ **Health Monitoring** - Real-time system and provider status monitoring
- 🌐 **Multilingual Support** - English, Japanese, Chinese language support
- 💰 **Cost Optimization** - Smart routing to minimize API costs

### Supported Providers
- **Cloud Providers**: OpenAI (GPT-5, GPT-4o, o1), Anthropic (Claude 4.1, 3.5), Google (Gemini 2.5), Groq (Llama 3.3), xAI Grok
- **Local Providers**: LM Studio, Ollama, vLLM

### Core Features
- Interactive chat sessions with streaming responses
- One-shot commands for quick tasks
- Vision analysis capabilities
- Code generation with language detection
- System health monitoring and recommendations
- Configurable priority modes (privacy-first, performance, cost-effective, auto)
- Comprehensive setup wizard
- Real-time provider health checks

### Technical Highlights
- TypeScript-first implementation
- Zero external dependencies for core functionality  
- Modular provider architecture
- Comprehensive error handling and fallback mechanisms
- Cross-platform support (Windows, macOS, Linux)
- ESM module support
- Tree-shaking optimized build

### Initial Models Supported
- **OpenAI**: GPT-5, GPT-5 Mini, GPT-4o, GPT-4o Mini, o1, o1-mini
- **Anthropic**: Claude Opus 4.1, Claude Opus 4, Claude Sonnet 4, Claude 3.5 Sonnet, Claude 3.5 Haiku
- **Google**: Gemini 2.5 Pro, Gemini 2.5 Flash, Gemini 1.5 Pro/Flash
- **Groq**: Llama 3.3 70B, Llama 3.2 90B Vision, Mixtral 8x7B, Gemma 2 9B
- **Grok**: Grok 2, Grok 2 Mini
- **Local Models**: GPT-OSS 120B/20B, Qwen 2.5 VL/32B, Llama 3.2, Code Llama, Japanese Stable LM

## [Unreleased]

### Planned Features
- Video generation support (Wan 2.2 integration)
- Image generation support (Qwen-Image integration)
- Plugin system for custom providers
- Advanced conversation memory
- Team collaboration features
- Docker containerization
- Web interface option
- API server mode

---

For more information about upcoming features, see our [roadmap](https://github.com/bonginkan/maria/projects).