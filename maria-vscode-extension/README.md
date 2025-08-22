# MARIA AI Assistant for VS Code

Enterprise-grade AI development platform for VS Code and Cursor - Natural language code generation, bug analysis, and intelligent assistance.

## Features

### Core AI Capabilities
- **Code Generation**: Generate code from natural language descriptions
- **Bug Analysis**: Detect and fix bugs with AI-powered analysis
- **Security Review**: OWASP Top 10 vulnerability detection
- **Type Checking**: Type safety analysis and suggestions
- **Lint Analysis**: Code quality and style improvements
- **Test Generation**: Automatic unit test creation

### Advanced Features
- **50 Internal Cognitive Modes**: Automatic context-aware mode switching
- **Multi-Provider Support**: OpenAI, Anthropic, Google, Local LLMs
- **Language Server Protocol**: Deep IDE integration
- **WebView Chat Interface**: Interactive AI assistant
- **Real-time Diagnostics**: Instant code analysis
- **Code Actions**: Quick fixes and refactoring

## Installation

### From VS Code Marketplace
1. Open VS Code
2. Go to Extensions (Cmd+Shift+X)
3. Search for "MARIA AI Assistant"
4. Click Install

### From VSIX Package
```bash
code --install-extension maria-ai-assistant-1.0.0.vsix
```

## Configuration

### Basic Setup
```json
{
  "maria.apiKey": "your-api-key",
  "maria.provider": "openai",
  "maria.model": "gpt-4",
  "maria.enableDiagnostics": true
}
```

### Enterprise Setup
```json
{
  "maria.enterprise.licenseKey": "ENT-XXXX-XXXX-XXXX-XXXX",
  "maria.enterprise.serverUrl": "https://license.bonginkan.ai"
}
```

## Usage

### Chat Interface
- Open MARIA chat: `Cmd+Shift+M`
- Type naturally or use slash commands
- Get instant AI assistance

### Commands
- **Generate Code**: `Cmd+Shift+G`
- **Analyze Bugs**: Right-click → MARIA → Analyze Bugs
- **Security Review**: Command Palette → MARIA: Security Review
- **Type Check**: Command Palette → MARIA: Type Check

### Slash Commands in Editor
```
/code - Generate code
/bug - Analyze bugs
/lint - Check code quality
/typecheck - Type safety analysis
/security - Security review
/explain - Explain code
/improve - Improve code
/test - Generate tests
```

## Requirements

- VS Code 1.74.0 or higher
- Node.js 16.x or higher
- Internet connection for cloud providers
- API key for chosen AI provider

## Supported Languages

- JavaScript/TypeScript
- Python
- Java
- C/C++
- C#
- Go
- Rust
- And more...

## License

### Personal Edition (Free)
- Personal, non-commercial use
- Basic AI features
- Community support

### Enterprise Edition ($49/month/user)
- Commercial use
- All 50 cognitive modes
- Priority support
- SLA guarantees
- Team collaboration

## Support

- **Documentation**: https://docs.maria.bonginkan.ai
- **Issues**: https://github.com/bonginkan/maria-vscode/issues
- **Enterprise**: enterprise@bonginkan.ai
- **Discord**: https://discord.gg/maria-ai

## Privacy

MARIA respects your privacy:
- No code is stored on our servers
- API calls are encrypted
- Telemetry is optional
- GDPR compliant

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for release history.

---

**MARIA AI Assistant** - Revolutionizing development with AI  
Copyright © 2025 Bonginkan AI. All rights reserved.