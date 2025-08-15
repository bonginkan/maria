# 🚀 Dynamic Auto-Versioning System

MARIA CLI uses an advanced dynamic versioning system that automatically generates unique versions for every commit, preventing NPM publish conflicts and ensuring smooth CI/CD operations.

## 🎯 Overview

The system generates versions in the format: `{base-version}-alpha.{commit-count}.{timestamp}[.{branch-name}]`

### Examples:

- **Main branch**: `1.0.6-alpha.1247.202508150142`
- **Feature branch**: `1.0.6-alpha.1248.feat-new-feature.202508150143`

## ⚙️ How It Works

### 1. **Automatic NPM Version Detection**

```bash
# Fetches latest versions from NPM
LATEST_STABLE=$(npm view @bonginkan/maria version)     # e.g., 1.0.5
LATEST_ALPHA=$(npm view @bonginkan/maria dist-tags.alpha) # e.g., 1.0.6-alpha.3
```

### 2. **Git Metadata Collection**

```bash
COMMIT_COUNT=$(git rev-list --count HEAD)    # Total commits in repo
SHORT_SHA=$(git rev-parse --short HEAD)      # e.g., a1b2c3d
BRANCH_NAME=$(git rev-parse --abbrev-ref HEAD) # e.g., main, feat/new-feature
TIMESTAMP=$(date +%Y%m%d%H%M)               # e.g., 202508150142
```

### 3. **Dynamic Version Generation**

```bash
# For main branch
BASE_VERSION="1.0.6"
NEW_VERSION="${BASE_VERSION}-alpha.${COMMIT_COUNT}.${TIMESTAMP}"

# For feature branches
NEW_VERSION="${BASE_VERSION}-alpha.${COMMIT_COUNT}.${SAFE_BRANCH_NAME}.${TIMESTAMP}"
```

### 4. **Cross-File Synchronization**

All package files are automatically synchronized:

- `package.json`
- `package-oss.json`
- `package-lock.json`

## 📚 Available Commands

### NPM Scripts

```bash
# Manual version synchronization
pnpm run version:sync

# Auto-increment alpha version + sync
pnpm run version:auto

# Generate dynamic version + sync
pnpm run version:dynamic
```

### Direct Script Usage

```bash
# Sync versions across all files
node scripts/sync-versions.js

# Generate dynamic version
node scripts/dynamic-version.js
```

## 🔄 GitHub Actions Integration

### Automatic Versioning on Main Branch

Every push to `main` triggers:

1. **Base Version Detection**
   - Fetches latest NPM versions
   - Determines highest base version

2. **Metadata Collection**
   - Git commit count
   - Current SHA
   - Timestamp generation

3. **Version Generation**
   - Creates unique alpha version
   - Updates all package files

4. **NPM Publishing**
   - Builds project
   - Publishes to NPM with alpha tag

### Workflow Steps

```yaml
- name: 📝 Dynamic Auto-versioning System
  run: |
    # Get NPM versions
    LATEST_NPM_VERSION=$(npm view @bonginkan/maria version 2>/dev/null || echo "0.0.0")
    LATEST_ALPHA=$(npm view @bonginkan/maria dist-tags.alpha 2>/dev/null || echo "0.0.0")

    # Get git metadata
    COMMIT_COUNT=$(git rev-list --count HEAD)
    TIMESTAMP=$(date +%Y%m%d%H%M)

    # Generate new version
    NEW_ALPHA_VERSION="${BASE_VERSION}-alpha.${COMMIT_COUNT}.${TIMESTAMP}"
    npm version $NEW_ALPHA_VERSION --no-git-tag-version --allow-same-version

- name: 🔄 Sync versions across all package files
  run: node scripts/sync-versions.js
```

## 🎯 Benefits

### ✅ Zero Conflicts

- **Unique Timestamps**: Every version is guaranteed unique
- **Commit Count**: Ensures version progression
- **Branch Detection**: Feature branches get distinct versions

### ✅ NPM Compatibility

- **Semantic Versioning**: Follows SemVer standards
- **Alpha Tagging**: Uses `alpha` dist-tag for pre-releases
- **Automatic Publishing**: No manual intervention required

### ✅ Developer Experience

- **Zero Configuration**: Works out of the box
- **Local Testing**: Same scripts work locally and in CI
- **Version Tracking**: Clear version history and metadata

### ✅ CI/CD Reliability

- **No Manual Updates**: Never need to bump versions manually
- **Conflict Prevention**: Impossible to have duplicate versions
- **Rollback Safety**: Easy to identify and rollback versions

## 🔧 Configuration

### Environment Variables

```bash
# Optional: Override base version detection
BASE_VERSION="1.1.0"

# Optional: Custom timestamp format
TIMESTAMP_FORMAT="%Y%m%d%H%M%S"

# Optional: Custom alpha prerelease identifier
PRERELEASE_ID="beta"
```

### Package.json Scripts

```json
{
  "scripts": {
    "version:sync": "node scripts/sync-versions.js",
    "version:auto": "npm version prerelease --preid=alpha --no-git-tag-version && npm run version:sync",
    "version:dynamic": "node scripts/dynamic-version.js && npm run version:sync"
  }
}
```

## 🚨 Troubleshooting

### Common Issues

#### Version Conflicts

```bash
# If NPM reports version already exists
npm view @bonginkan/maria versions --json

# Force re-generate version
node scripts/dynamic-version.js
```

#### Sync Failures

```bash
# Check file permissions
chmod +x scripts/*.js

# Verify package.json format
node -c package.json

# Re-sync manually
pnpm run version:sync
```

#### CI/CD Failures

```bash
# Check GitHub Secrets
echo $NPM_TOKEN | wc -c  # Should output >0

# Verify git history
git log --oneline -10

# Check workflow permissions
# Ensure GITHUB_TOKEN has write access
```

## 📊 Version History Tracking

### Example Version Progression

```
1.0.5                    # Latest stable release
1.0.6-alpha.1245.202508150130  # Feature development
1.0.6-alpha.1246.202508150131  # Bug fix
1.0.6-alpha.1247.202508150142  # Ready for release
1.0.6                    # Next stable release
```

### NPM Tags

```bash
# View all versions
npm view @bonginkan/maria versions

# View dist-tags
npm view @bonginkan/maria dist-tags

# Install specific version
npm install @bonginkan/maria@1.0.6-alpha.1247.202508150142
```

## 🔮 Future Enhancements

### Planned Features

- **Semantic Analysis**: Auto-detect major/minor/patch changes
- **Release Notes**: Auto-generate from commit messages
- **Version Validation**: Pre-publish version checks
- **Rollback Automation**: One-click version rollbacks
- **Analytics Integration**: Version usage tracking

### Advanced Configuration

- **Custom Version Schemes**: Support for different formats
- **Branch-Specific Versioning**: Different rules per branch
- **Release Channel Management**: Stable/beta/alpha channels
- **Automated Changelogs**: Git history to changelog conversion

---

**Last Updated**: 2025-08-15  
**System Version**: v2.0.0  
**Compatibility**: Node.js 18+, NPM 8+, Git 2.30+
