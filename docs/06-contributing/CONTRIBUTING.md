# Contributing to MARIA CODE

First off, thank you for considering contributing to MARIA CODE! It's people like you that make MARIA CODE such a great tool.

## 🤝 Code of Conduct

By participating in this project, you are expected to uphold our Code of Conduct:
- Be respectful and inclusive
- Welcome newcomers and help them get started
- Focus on constructive criticism
- Accept feedback gracefully

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- pnpm 8+
- Git

### Development Setup

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/maria.git
   cd maria
   ```

3. Install dependencies:
   ```bash
   pnpm install
   ```

4. Build the project:
   ```bash
   pnpm build
   ```

5. Run tests:
   ```bash
   pnpm test
   ```

6. Start development mode:
   ```bash
   pnpm dev
   ```

## 📝 How to Contribute

### Reporting Bugs

Before creating bug reports, please check existing issues to avoid duplicates.

**To report a bug:**
1. Use the [bug report template](.github/ISSUE_TEMPLATE/bug_report.md)
2. Include detailed steps to reproduce
3. Provide environment information
4. Attach relevant logs

### Suggesting Features

We love feature suggestions! Please:
1. Use the [feature request template](.github/ISSUE_TEMPLATE/feature_request.md)
2. Explain the problem it solves
3. Describe your proposed solution
4. Consider alternatives

### Pull Requests

1. **Fork & Create Branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```

2. **Make Changes**
   - Write clean, documented code
   - Follow existing code style
   - Add tests for new features
   - Update documentation

3. **Test Your Changes**
   ```bash
   pnpm test
   pnpm typecheck
   pnpm lint
   ```

4. **Commit Your Changes**
   ```bash
   # We use conventional commits
   git commit -m "feat: add amazing feature"
   ```

   Commit types:
   - `feat:` New feature
   - `fix:` Bug fix
   - `docs:` Documentation changes
   - `style:` Code style changes
   - `refactor:` Code refactoring
   - `test:` Test additions/changes
   - `chore:` Maintenance tasks

5. **Push & Create PR**
   ```bash
   git push origin feature/amazing-feature
   ```
   Then create a Pull Request on GitHub.

## 🏗️ Project Structure

```
maria/
├── packages/
│   └── code-cli/          # Main CLI package
│       ├── src/
│       │   ├── commands/  # CLI commands
│       │   ├── providers/ # AI providers
│       │   ├── services/  # Core services
│       │   └── utils/     # Utilities
│       └── test/          # Tests
├── docs/                  # Documentation
└── scripts/               # Build scripts
```

## 🧪 Testing

We use Vitest for testing. Please ensure:
- All new features have tests
- All tests pass before submitting PR
- Coverage remains above 80%

Run tests:
```bash
pnpm test              # Run all tests
pnpm test:coverage     # With coverage report
pnpm test:watch        # Watch mode
```

## 📖 Documentation

- Update README.md for user-facing changes
- Add JSDoc comments for new functions
- Update CHANGELOG.md following [Keep a Changelog](https://keepachangelog.com/)

## 🎨 Code Style

We use ESLint and Prettier. Configuration is automatic:

```bash
pnpm lint        # Check linting
pnpm lint:fix    # Auto-fix issues
pnpm format      # Check formatting
pnpm format:fix  # Auto-format
```

## 🔄 Development Workflow

1. **Issue First**: Create or find an issue before starting work
2. **Branch**: Create a feature branch from `main`
3. **Develop**: Make your changes with tests
4. **Test**: Ensure all tests pass
5. **Document**: Update relevant documentation
6. **PR**: Submit a pull request
7. **Review**: Address review feedback
8. **Merge**: We'll merge once approved!

## 💡 Tips for Contributors

### First Time Contributors
- Look for issues labeled `good first issue`
- Read through existing code to understand patterns
- Ask questions in issues or discussions
- Start with documentation fixes or small features

### Adding AI Providers
1. Implement the `AIProvider` interface
2. Add provider to the registry
3. Add tests for the provider
4. Document supported models

### Adding Commands
1. Create command file in `src/commands/`
2. Register in `src/bin/mc.ts`
3. Add tests
4. Update README with usage examples

## 🤝 Community

- **Discord**: [Join our community](https://discord.gg/maria-dev)
- **Website**: [bonginkan.ai](https://bonginkan.ai/)
- **Email**: info@bonginkan.ai

## 📜 License

By contributing, you agree that your contributions will be licensed under the MIT License.

## 🙏 Recognition

Contributors will be recognized in:
- The CHANGELOG.md file
- The GitHub contributors page
- Special thanks in release notes

Thank you for contributing to MARIA CODE! 🎉

---
**Bonginkan Inc.** - Making AI development accessible to everyone