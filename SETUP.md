# 🚀 MARIA Platform Setup Guide

Complete setup instructions for MARIA Platform v1.6.4 "Algorithm Education Revolution"

## 📋 System Requirements

### Minimum Requirements
- **Node.js**: 18.0.0 or higher (up to 22.x)
- **npm**: 8.0.0 or higher
- **Operating System**: macOS, Linux, Windows
- **Terminal**: Any modern terminal application
- **Memory**: 512MB available RAM
- **Storage**: 100MB disk space

### Recommended Setup
- **Node.js**: 20.x LTS
- **Terminal**: iTerm2 (macOS), Windows Terminal, or VS Code integrated terminal
- **Shell**: bash, zsh, fish, or PowerShell
- **Memory**: 1GB+ available RAM for optimal performance

## 🛠️ Installation Methods

### Method 1: NPM Global Installation (Recommended)

```bash
# Install globally via npm
npm install -g @bonginkan/maria

# Verify installation
maria --version
# Expected output: MARIA Platform v1.6.4 "Algorithm Education Revolution"

# Test interactive mode
maria
# Should start interactive CLI with welcome message
```

### Method 2: Alternative Package Managers

```bash
# Using Yarn
yarn global add @bonginkan/maria

# Using pnpm
pnpm add -g @bonginkan/maria

# Using npx (temporary usage)
npx @bonginkan/maria
```

### Method 3: Local Project Installation

```bash
# Install in project
npm install @bonginkan/maria

# Run locally
npx maria

# Or add to package.json scripts
{
  "scripts": {
    "ai": "maria"
  }
}
```

## ⚡ Quick Start Guide

### 1. First Launch
```bash
# Start MARIA interactive mode
maria

# You should see:
# 🤖 MARIA Platform v1.6.4 "Algorithm Education Revolution"
# Interactive AI Development CLI with Complete CS Curriculum
```

### 2. Basic Commands
```bash
# Within interactive mode, try these commands:
> /help                          # Show all 36+ commands
> /status                        # Check system status
> /model                         # Configure AI providers
> /sort quicksort --visualize    # Try algorithm education
> /code "hello world function"   # AI code generation
> /exit                          # Exit MARIA
```

### 3. Algorithm Education
```bash
# Start learning algorithms
> /sort quicksort               # Interactive quicksort tutorial
> /learn algorithms             # Complete CS curriculum
> /benchmark sorting            # Performance analysis
> /algorithm complexity         # Big O notation guide
```

## 🔧 Configuration

### AI Model Setup (Optional)

MARIA works out of the box with default models, but you can configure additional AI providers:

```bash
# Start MARIA and configure models
maria
> /model

# Available options:
# - OpenAI GPT models (API key required)
# - Anthropic Claude (API key required) 
# - Google Gemini (API key required)
# - Local LLMs (LM Studio, Ollama)
# - Groq models (API key required)
```

### Environment Variables (Optional)

Create a `.env` file in your project or set system environment variables:

```bash
# AI Provider API Keys (optional)
OPENAI_API_KEY=sk-your-key-here
ANTHROPIC_API_KEY=sk-ant-your-key-here
GOOGLE_AI_API_KEY=your-google-key-here
GROQ_API_KEY=gsk-your-groq-key-here

# Local AI Models (optional)
LMSTUDIO_API_URL=http://localhost:1234
OLLAMA_API_URL=http://localhost:11434
```

## 🎓 Learning Path

### For Students & Beginners
1. Start with basic installation: `npm install -g @bonginkan/maria`
2. Launch interactive mode: `maria`
3. Try algorithm education: `/sort quicksort --visualize`
4. Explore help system: `/help`
5. Learn coding basics: `/code "simple function"`

### For Developers
1. Install MARIA: `npm install -g @bonginkan/maria`
2. Configure preferred AI model: `/model`
3. Try development commands: `/code`, `/bug`, `/lint`
4. Explore advanced features: `/status`, `/mode internal`
5. Integrate with workflow: Use MARIA for coding assistance

### For Educators
1. Install for classroom use: `npm install -g @bonginkan/maria`
2. Explore algorithm curriculum: `/learn algorithms`
3. Use visualization tools: `/sort --visualize`
4. Create lesson plans with `/help` command reference
5. Demonstrate CS concepts with interactive examples

## 🐛 Troubleshooting

### Common Issues

#### Permission Errors
```bash
# If you get permission errors on macOS/Linux:
sudo npm install -g @bonginkan/maria

# Or use npm prefix:
npm config set prefix ~/.npm-global
export PATH=~/.npm-global/bin:$PATH
npm install -g @bonginkan/maria
```

#### Node.js Version Issues
```bash
# Check Node.js version
node --version

# If version is too old, update Node.js:
# Visit https://nodejs.org/ for latest LTS version
```

#### Command Not Found
```bash
# Check if MARIA is in PATH
which maria

# If not found, try:
npm list -g @bonginkan/maria

# Reinstall if necessary:
npm uninstall -g @bonginkan/maria
npm install -g @bonginkan/maria
```

#### Interactive Mode Issues
```bash
# If interactive mode doesn't start:
maria --help

# Check for terminal compatibility:
echo $TERM

# Try different terminal or shell
```

### Getting Help

1. **Built-in Help**: Use `/help` within MARIA
2. **Version Check**: Run `maria --version`
3. **System Status**: Use `/status` command
4. **GitHub Issues**: [Report issues](https://github.com/bonginkan/maria/issues)
5. **NPM Package**: [View on npmjs.com](https://www.npmjs.com/package/@bonginkan/maria)

## 📚 Next Steps

After successful setup:

1. **Explore Commands**: Try all 36+ slash commands with `/help`
2. **Algorithm Learning**: Deep dive into CS curriculum with `/learn`
3. **AI Development**: Use AI assistance for coding projects
4. **Performance Analysis**: Benchmark algorithms with built-in tools
5. **Advanced Features**: Explore 50 cognitive AI modes with `/mode internal`

## 🌟 Pro Tips

- **Quick Access**: Create shell alias: `alias ai="maria"`
- **Project Integration**: Add MARIA to project's package.json
- **Learning Schedule**: Dedicate 15 minutes daily to algorithm education
- **Experiment**: Try different AI models to find your preference
- **Share**: Introduce MARIA to your team for collaborative development

---

**Welcome to the Algorithm Education Revolution! 🎓✨**

Start your journey: `maria` and type `/help` to explore all possibilities.