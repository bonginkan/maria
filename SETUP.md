# 🚀 MARIA Platform Setup Guide

Complete setup instructions for MARIA Platform v1.6.6 "Algorithm Education Revolution" - Lightweight OSS Distribution

## 📋 System Requirements

### Minimum Requirements
- **Node.js**: 18.0.0 or higher (up to 22.x)
- **npm**: 8.0.0 or higher
- **Operating System**: macOS, Linux, Windows
- **Terminal**: Any modern terminal application
- **Memory**: 256MB available RAM
- **Storage**: 50MB disk space

### Recommended Setup
- **Node.js**: 20.x LTS
- **Terminal**: iTerm2 (macOS), Windows Terminal, or VS Code integrated terminal
- **Shell**: bash, zsh, fish, or PowerShell
- **Memory**: 512MB+ available RAM for optimal performance

## 🛠️ Installation Methods

### Method 1: NPM Global Installation (Recommended)

```bash
# Install globally via npm
npm install -g @bonginkan/maria

# Verify installation
maria --version
# Expected output: MARIA Platform v1.6.6 "Algorithm Education Revolution"

# Test basic functionality
maria status
# Should show OSS distribution status
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
# Install in specific project
npm install @bonginkan/maria

# Run locally
npx maria

# Or add to package.json scripts
{
  "scripts": {
    "maria": "maria"
  }
}
```

## ⚡ Quick Start Guide

### 1. First Launch
```bash
# Start MARIA (basic commands available)
maria

# Available commands:
maria chat        # Interactive mode
maria version     # Version information
maria status      # System status
```

### 2. Basic Commands
```bash
# Interactive mode
maria chat

# Check version
maria --version

# System status  
maria status
```

### 3. OSS Distribution Features
```bash
# This OSS version provides:
# - Basic CLI framework
# - Interactive mode foundation
# - Educational platform base
# - Minimal dependencies (2 only)
# - Setup documentation
```

## 🔧 Configuration

### No Configuration Required
MARIA OSS works out of the box with zero configuration:

- **No API Keys**: OSS version doesn't require external AI services
- **No Environment Variables**: Works immediately after installation
- **No Additional Setup**: Ready to use with `maria` command

### Lightweight Architecture
```bash
# Check installed dependencies
npm list -g @bonginkan/maria

# Should show only:
# ├── chalk@5.3.0 (terminal colors)
# └── commander@12.0.0 (CLI framework)
```

## 🎯 Usage Examples

### Basic CLI Usage
```bash
# Start MARIA
maria

# Interactive mode
maria chat

# Version check
maria --version

# System information
maria status
```

### Educational Foundation
```bash
# MARIA OSS provides the foundation for:
# - Algorithm education platforms
# - Interactive CLI development
# - Educational tool development
# - Minimal AI assistant frameworks
```

## 🐛 Troubleshooting

### Common Issues

#### Installation Problems
```bash
# Clear npm cache if installation fails
npm cache clean --force

# Reinstall
npm uninstall -g @bonginkan/maria
npm install -g @bonginkan/maria
```

#### Permission Errors (macOS/Linux)
```bash
# If you get permission errors:
sudo npm install -g @bonginkan/maria

# Or configure npm to use a different directory:
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
export PATH=~/.npm-global/bin:$PATH
npm install -g @bonginkan/maria
```

#### Node.js Version Issues
```bash
# Check Node.js version
node --version

# If version is incompatible, update Node.js:
# Visit https://nodejs.org/ for latest LTS
```

#### Command Not Found
```bash
# Verify installation
npm list -g @bonginkan/maria

# Check PATH
echo $PATH

# Reinstall if needed
npm uninstall -g @bonginkan/maria
npm install -g @bonginkan/maria
```

### Windows-Specific Issues
```bash
# If using Windows and PowerShell execution policy blocks scripts:
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Or use Command Prompt instead of PowerShell
```

## 📊 Verification

### Installation Verification
```bash
# 1. Check version
maria --version
# Should output: MARIA Platform v1.6.6 "Algorithm Education Revolution"

# 2. Check status
maria status
# Should show: ✅ MARIA OSS Distribution

# 3. Test interactive mode
maria chat
# Should start interactive CLI

# 4. Verify dependencies
npm list -g @bonginkan/maria --depth=1
# Should show minimal dependency tree
```

### Performance Check
```bash
# Installation size check
npm list -g @bonginkan/maria --depth=0
# Should be lightweight installation

# Startup time test
time maria --version
# Should be fast (<1 second)
```

## 🌟 Next Steps

### For Students
1. **Explore Commands**: Try `maria chat` and basic commands
2. **Learn CLI Patterns**: Study the minimal, clean CLI implementation
3. **Educational Use**: Use as foundation for algorithm education projects
4. **Documentation**: Read through setup guides and command reference

### For Developers
1. **Integration**: Integrate MARIA OSS into development workflows
2. **Extension**: Build upon the minimal foundation
3. **Learning**: Study TypeScript CLI development patterns
4. **Contribution**: Consider contributing to the open source version

### For Educators
1. **Curriculum Integration**: Use as teaching tool for CLI development
2. **Student Projects**: Assign MARIA-based projects
3. **Algorithm Education**: Build algorithm visualization tools
4. **Computer Science**: Demonstrate professional CLI development

## 📚 Additional Resources

### Documentation
- **[README.md](./README.md)** - Overview and quick start
- **[GETTING_STARTED.md](./GETTING_STARTED.md)** - Detailed getting started guide
- **[COMMANDS.md](./COMMANDS.md)** - Command reference

### Support Channels
1. **GitHub Issues**: [Report problems](https://github.com/bonginkan/maria/issues)
2. **NPM Package**: [View package details](https://www.npmjs.com/package/@bonginkan/maria)
3. **Full Platform**: [Upgrade information](https://maria-code.vercel.app)

### Development Resources
```bash
# Build from source
git clone https://github.com/bonginkan/maria.git
cd maria/maria-oss
pnpm install
pnpm build
```

## 💡 Pro Tips

### Efficient Usage
- **Alias Creation**: Create shell alias `alias m="maria"` for quick access
- **PATH Integration**: Ensure npm global bin is in your PATH
- **Terminal Compatibility**: Works best with modern terminal applications
- **Documentation Reading**: Keep documentation handy for reference

### Best Practices
- **Regular Updates**: Keep package updated with `npm update -g @bonginkan/maria`
- **Clean Installation**: Uninstall/reinstall if experiencing issues
- **Version Tracking**: Always verify version after updates
- **Minimal Dependencies**: Appreciate the lightweight design philosophy

---

**Welcome to MARIA Platform v1.6.6 "Algorithm Education Revolution"! 🎓✨**

Start your lightweight AI CLI journey: `maria` and explore the minimal, powerful foundation.