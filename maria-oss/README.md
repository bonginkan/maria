# MARIA CODE - Advanced AGI Development Assistant

[![npm version](https://img.shields.io/npm/v/@bonginkan/maria.svg)](https://www.npmjs.com/package/@bonginkan/maria)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green)](https://nodejs.org/)

🤖 **MARIA CODE** is an advanced AGI (Artificial General Intelligence) development assistant that brings senior engineer-level capabilities to your terminal. With support for 14+ AI models, intelligent routing, and comprehensive development tools, MARIA transforms how you write, review, and deploy code.

## 🚀 Quick Start

```bash
# Install globally
npm install -g @bonginkan/maria@latest

# Initialize in your project
maria init

# Start interactive mode
maria chat
```

## ✨ Key Features

### 🧠 Interactive Router System
- **Natural Language Understanding**: Interprets developer intentions and automatically routes to optimal commands
- **Context Awareness**: Uses conversation history and project state for intelligent decision making
- **Multi-Step Execution**: Decomposes complex tasks into executable steps
- **Auto Mode**: Natural language → Automatic command execution

### 🤖 Multi-Model AI Support
- **Cloud Providers**: OpenAI GPT-4o, Anthropic Claude, Google Gemini, Groq
- **Local Models**: LM Studio, vLLM, Ollama (GPT-OSS, Qwen, Mistral)
- **Automatic Fallback**: Seamlessly switches between providers
- **Task-Based Selection**: Chooses optimal model for each task type

### 🎬 Media Generation
- **Video Generation**: Text-to-Video and Image-to-Video with Wan 2.2
- **Image Generation**: High-quality images with Qwen-Image
- **Batch Processing**: Generate multiple variations
- **Resolution Control**: 720p/1080p video, up to 1024x1024 images

### ⚡ Development Tools
- **Code Generation**: Create entire features with context awareness
- **Code Review**: Comprehensive analysis with actionable suggestions
- **Test Generation**: Unit, integration, and E2E tests
- **Smart Commits**: AI-generated conventional commit messages

## 📚 Commands

### Core Commands
```bash
maria init              # Initialize MARIA in your project
maria chat              # Interactive mode (40+ slash commands)
maria code "prompt"     # Generate code with AI
maria vision image.png  # Analyze images with vision models
maria review            # Review code changes
maria test              # Generate tests
maria commit            # Create AI commit messages
```

### Media Generation
```bash
maria video "A futuristic city"     # Generate AI video
maria image "Abstract art"         # Generate AI image
```

### Interactive Slash Commands
In `maria chat` mode, use these commands:

- `/help` - Show all commands
- `/status` - System status
- `/model` - Select AI model
- `/clear` - Clear conversation
- `/config` - Configuration panel
- `/video` - Generate video
- `/image` - Generate image
- `/pr-comments` - Analyze PR comments
- `/review` - Execute PR review
- `/exit` - Exit interactive mode

## 🔧 Configuration

MARIA uses `.maria-code.toml` for configuration:

```toml
[project]
name = "my-project"
type = "typescript"

[ai]
default_provider = "openai"
fallback_provider = "local"

[ai.providers.openai]
api_key = "${OPENAI_API_KEY}"
model = "gpt-4o"

[ai.providers.local]
endpoint = "http://localhost:1234"
model = "gpt-oss-20b"
```

## 🌟 Example Usage

### Create a REST API
```bash
maria code "Create a REST API with user authentication" --language typescript
```

### Generate Tests
```bash
maria test src/ --framework jest --coverage
```

### AI Video Generation
```bash
maria video "A red sports car racing through mountains" --model wan22-14b
```

### Code Review
```bash
maria review --diff --suggestions --severity warning
```

## 📦 Installation Options

```bash
# Latest stable
npm install -g @bonginkan/maria@latest

# Development version
npm install -g @bonginkan/maria@alpha

# Beta version
npm install -g @bonginkan/maria@beta

# Run without installing
npx @bonginkan/maria@latest
```

## 🔌 AI Provider Setup

### OpenAI
```bash
export OPENAI_API_KEY=your_key
```

### Anthropic
```bash
export ANTHROPIC_API_KEY=your_key
```

### Local Models (LM Studio)
1. Download [LM Studio](https://lmstudio.ai)
2. Load a model (e.g., GPT-OSS, Mistral)
3. Start the server
4. MARIA auto-detects at `http://localhost:1234`

## 🎯 Use Cases

### For Developers
- Generate boilerplate code instantly
- Review code for best practices
- Create comprehensive test suites
- Debug complex issues with AI assistance

### For Teams
- Standardize commit messages
- Automate code reviews
- Generate documentation
- Create consistent APIs

### For Learning
- Understand new codebases quickly
- Learn best practices
- Get explanations for complex code
- Practice with AI pair programming

## 🛠️ System Requirements

- **Node.js**: 18.0.0 or higher
- **OS**: macOS, Linux, Windows (WSL recommended)
- **Memory**: 4GB RAM minimum (8GB+ for local models)
- **Storage**: 500MB for CLI, varies for local models

## 🤝 Contributing

We welcome contributions! See [Contributing Guide](https://github.com/bonginkan/maria/blob/main/CONTRIBUTING.md) for details.

## 📄 License

MIT License - see [LICENSE](https://github.com/bonginkan/maria/blob/main/LICENSE) for details.

## 🔗 Links

- [GitHub Repository](https://github.com/bonginkan/maria)
- [NPM Package](https://www.npmjs.com/package/@bonginkan/maria)
- [Documentation](https://maria-code.vercel.app)
- [Report Issues](https://github.com/bonginkan/maria/issues)

## 💬 Support

- Email: maria@bonginkan.ai
- GitHub Issues: [Create an issue](https://github.com/bonginkan/maria/issues/new)

---

**MARIA CODE** - Your AI-Powered Senior Engineer in the Terminal  
© 2025 Bonginkan Inc. All rights reserved.
