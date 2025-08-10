# MARIA CODE - Advanced AI Development CLI

<div align="center">
  <img src="https://github.com/bonginkan/maria/blob/main/logo.png?raw=true" alt="MARIA CODE Logo" width="200"/>
  
  **🤖 Advanced AGI Development Assistant by Bonginkan Inc.**
  
  [![npm version](https://img.shields.io/npm/v/@bonginkan/maria.svg)](https://www.npmjs.com/package/@bonginkan/maria)
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  [![Node.js Version](https://img.shields.io/node/v/@bonginkan/maria.svg)](https://nodejs.org)
  [![Downloads](https://img.shields.io/npm/dm/@bonginkan/maria.svg)](https://www.npmjs.com/package/@bonginkan/maria)
</div>

## 🚀 Quick Start

```bash
# Install globally
npm install -g @bonginkan/maria

# Start MARIA
maria

# Or use the shorthand
mc
```

## ✨ Features

### 🧠 Intelligent AI Routing
- **Automatic Model Selection**: Chooses the best AI model based on your task
- **Multi-Provider Support**: OpenAI, Anthropic, Google, Groq, and local models
- **Privacy-First**: Prioritizes local models for sensitive data
- **Smart Fallback**: Automatically switches providers if one fails

### 💻 Core Commands

#### Code Generation
```bash
mc code "Create a REST API with authentication" --language typescript
mc code "Binary search algorithm" --output search.py --style documented
```

#### Vision Analysis
```bash
mc vision screenshot.png "What components do you see?"
mc vision diagram.jpg --extract objects --format json
```

#### Code Review
```bash
mc review src/ --severity warning --suggestions
mc review --diff --framework react
```

#### Test Generation
```bash
mc test src/ --framework jest --coverage
mc test utils.py --type unit --mocks
```

#### Smart Commits
```bash
mc commit --type conventional --scope api
mc commit --interactive --push
```

### 🎯 Interactive Mode

Once inside MARIA, you have access to 40+ slash commands:

```bash
# Model Management
/model              # Interactive model selector
/switch gpt-4o      # Quick switch to GPT-4
/recommend code     # Get model recommendations

# Development
/code              # Generate code
/review            # Review code
/test              # Generate tests
/commit            # Create commits

# Utilities
/clear             # Clear context
/export            # Export conversation
/help              # Show all commands
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file in your project root:

```bash
# Cloud Providers (Optional)
OPENAI_API_KEY=your_key
ANTHROPIC_API_KEY=your_key
GOOGLE_API_KEY=your_key
GROQ_API_KEY=your_key

# Local Models (Auto-detected)
LMSTUDIO_BASE_URL=http://localhost:1234
OLLAMA_BASE_URL=http://localhost:11434
```

### Zero Configuration

MARIA works out of the box without any configuration:
- Auto-detects local LLM servers (LM Studio, Ollama, vLLM)
- Falls back to free-tier cloud models
- Learns your preferences over time

## 🤖 Supported Models

### Cloud Models
- **OpenAI**: GPT-4o, GPT-4-turbo (128K context)
- **Anthropic**: Claude 3 Opus/Sonnet (200K context)
- **Google**: Gemini 2.5 Pro (128K context)
- **Groq**: Mixtral, Llama 3 (32K context)

### Local Models (Privacy-First)
- **LM Studio**: Any GGUF model
- **Ollama**: 100+ models available
- **vLLM**: High-performance inference

## 📚 Advanced Features

### Task-Based Routing
MARIA automatically selects the best model for your task:
- **Code Generation**: Prefers models with large context windows
- **Vision Tasks**: Routes to vision-capable models
- **Translation**: Selects multilingual models
- **Creative Writing**: Uses more creative models

### Natural Language Understanding
```bash
# Natural language commands work too!
"Create a new API endpoint" → Generates code
"Fix this bug" → Analyzes and suggests fixes
"Make this faster" → Performance optimization
```

## 🛠️ Development

### Building from Source

```bash
# Clone the repository
git clone https://github.com/bonginkan/maria.git
cd maria

# Install dependencies
pnpm install

# Build the project
pnpm build

# Run locally
pnpm dev
```

### Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## 📊 Performance

- **Startup Time**: < 3 seconds
- **Model Switching**: Instant
- **Context Window**: Up to 200K tokens
- **Fallback Success**: 99.9%

## 🔒 Security & Privacy

- **Local-First**: Prioritizes local models for sensitive data
- **No Telemetry**: We don't collect any usage data
- **Secure Storage**: API keys stored securely
- **Open Source**: Full transparency

## 📝 License

MIT License - see [LICENSE](LICENSE) for details.

## 🤝 Support

- **Website**: [bonginkan.ai](https://bonginkan.ai/)
- **Email**: info@bonginkan.ai
- **GitHub Issues**: [Report bugs](https://github.com/bonginkan/maria/issues)
- **Discord**: [Join our community](https://discord.gg/maria-dev)

## 🏢 About Bonginkan Inc.

MARIA CODE is developed by **Bonginkan Inc.**, a leader in AGI development and AI-powered developer tools.

- Website: [bonginkan.ai](https://bonginkan.ai)
- GitHub: [@bonginkan](https://github.com/bonginkan)
- Twitter: [@bonginkan](https://twitter.com/bonginkan)

---

<div align="center">
  <strong>Built with ❤️ by Bonginkan Inc.</strong>
  <br>
  <sub>Making AI development accessible to everyone</sub>
</div>