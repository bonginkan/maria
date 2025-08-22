# MARIA CODE Development Guide

## 🔧 Development Environment

### Required Node.js Version
- **Minimum**: Node.js 18.0.0
- **Recommended**: Node.js 20.0.0 or higher
- **Tested with**: Node.js 20.x, 22.x, 24.x

### Version Management
The project includes automatic Node.js version checking:

1. **`.nvmrc`** - For nvm users
2. **`.node-version`** - For nodenv users
3. **Runtime check** - Automatic version validation on CLI startup

```bash
# Using nvm
nvm use

# Using nodenv
nodenv install
```

## 📋 Code Quality Standards

### Lint Configuration
The project uses ESLint with TypeScript support and enforces:
- **Maximum allowed errors**: 100 (CI/CD will fail above this)
- **Node.js version compatibility**: >=18.0.0
- **TypeScript strict mode**: Enabled for type safety

### Running Lint Checks
```bash
# Check for lint errors
pnpm lint

# Auto-fix fixable issues
pnpm lint:fix

# Type checking
pnpm typecheck
```

### Pre-commit Hooks
Automatic quality checks run before each commit:
- ESLint with auto-fix
- Prettier formatting
- Error count validation

### CI/CD Quality Gates
GitHub Actions enforces:
1. **Lint check** - Maximum 100 errors allowed
2. **Type check** - Must pass (warnings allowed)
3. **Build** - Must complete successfully
4. **Tests** - All tests must pass

## 🚀 Development Workflow

### Setup
```bash
# Install dependencies
pnpm install

# Build the project
pnpm build

# Run in development mode
pnpm dev
```

### Testing
```bash
# Run tests
pnpm test

# Run tests with coverage
pnpm test:coverage
```

### Debugging Version Issues
If you encounter version-related issues:

```bash
# Check current Node.js version
node --version

# The CLI will show version info on startup
./bin/maria --version

# Output:
# ────────────────────────────────────────────────────────────
# 🔍 Node.js Version Check
# ────────────────────────────────────────────────────────────
# ✅ Node.js v20.0.0 is supported
# ────────────────────────────────────────────────────────────
```

## 📊 Current Code Quality Status

As of latest update:
- **Total Issues**: ~450 (72 errors, 378 warnings)
- **Improvement from initial**: 66.1% reduction
- **CI/CD Status**: ✅ Passing with acceptable error count

## 🔄 Continuous Improvement

The project follows a gradual improvement approach:
1. **Phase 1**: Critical error fixes ✅
2. **Phase 2**: Type safety improvements (ongoing)
3. **Phase 3**: Warning reduction (planned)
4. **Phase 4**: Zero errors goal (future)

## 📝 Contributing

When contributing:
1. Ensure Node.js 18+ is installed
2. Run `pnpm lint` before committing
3. Fix any new errors introduced
4. Keep error count below 100
5. Add tests for new features

## 🛠️ Troubleshooting

### Common Issues

**Issue**: "Node.js version X is not supported"
```bash
# Solution: Upgrade Node.js
nvm install 20
nvm use 20
```

**Issue**: "Too many lint errors"
```bash
# Solution: Run auto-fix first
pnpm lint:fix

# Then manually fix remaining issues
pnpm lint
```

**Issue**: "Build fails with type errors"
```bash
# Solution: Check TypeScript errors
pnpm typecheck

# Fix type issues in reported files
```

## 📚 Resources

- [ESLint Configuration](./.eslintrc.js)
- [TypeScript Config](./tsconfig.json)
- [CI/CD Workflows](./.github/workflows/)
- [Node.js Compatibility](https://nodejs.org/en/about/releases/)