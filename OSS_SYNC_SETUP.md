# 🔄 OSS Auto-Sync Setup Guide

This guide explains how to set up automatic synchronization from `maria_code` (full development) to `maria` (OSS distribution).

## 📋 Overview

When you push changes to the `main` branch of `maria_code`, the GitHub Actions workflow automatically:
1. Filters out internal/private files
2. Prepares OSS-ready distribution files
3. Pushes to the `maria` OSS repository
4. Optionally triggers NPM release workflow

## 🔧 Setup Instructions

### Step 1: Create Personal Access Token (PAT)

1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Name it: `OSS_SYNC_TOKEN`
4. Select scopes:
   - `repo` (Full control of private repositories)
   - `workflow` (Update GitHub Action workflows)
5. Generate and copy the token

### Step 2: Add Secret to maria_code Repository

1. Go to `https://github.com/bonginkan/maria_code/settings/secrets/actions`
2. Click "New repository secret"
3. Add the following secret:
   - **Name**: `OSS_SYNC_TOKEN`
   - **Value**: [Paste your PAT from Step 1]

### Step 3: Verify Workflow File

Ensure `.github/workflows/sync-to-oss.yml` exists in `maria_code` repository.

### Step 4: Configure OSS Repository

1. Ensure `maria` repository exists at `https://github.com/bonginkan/maria`
2. Set repository visibility to Public
3. Add NPM_TOKEN secret for automatic publishing (optional)

## 🚀 How It Works

### Automatic Sync Triggers

The sync workflow triggers when:
- ✅ Push to `main` branch in `maria_code`
- ✅ Changes in relevant files (excludes internal paths)
- ✅ Manual trigger via GitHub Actions UI

### Files Included in Sync

```json
{
  "included": [
    "packages/code-cli/src/**",  // CLI source code
    "packages/code-cli/dist/**", // Built CLI files
    "bin/**",                     // CLI entry points
    "scripts/post-install.js",   // NPM post-install script
    "README.md",                  // Documentation
    "CHANGELOG.md",              // Version history
    "LICENSE",                   // License file
    "package.json"               // Package configuration (cleaned)
  ]
}
```

### Files Excluded from Sync

```json
{
  "excluded": [
    "maria-code-lp/**",          // Landing page (internal)
    "packages/studio-app/**",    // Web app (internal)
    "packages/core-api/**",      // API server (internal)
    "infra/**",                  // Infrastructure code
    "*.internal.md",             // Internal documentation
    ".env*",                     // Environment files
    "models/**",                 // AI models
    "outputs/**"                 // Generated outputs
  ]
}
```

## 📊 Testing the Sync

### Manual Test

1. Make a test change in `maria_code`:
   ```bash
   echo "# Test sync" >> README.md
   git add README.md
   git commit -m "test: verify OSS sync workflow"
   git push origin main
   ```

2. Check GitHub Actions:
   - Go to `https://github.com/bonginkan/maria_code/actions`
   - Look for "🔄 Sync to OSS Repository" workflow
   - Verify it runs successfully

3. Verify in OSS repository:
   - Go to `https://github.com/bonginkan/maria`
   - Check that changes appear in main branch
   - Verify commit message includes sync information

### Manual Trigger

1. Go to `https://github.com/bonginkan/maria_code/actions/workflows/sync-to-oss.yml`
2. Click "Run workflow"
3. Select branch: `main`
4. Optional: Set `force` to `true` to sync even without changes
5. Click "Run workflow"

## 🎯 Release Workflow Integration

### Automatic Release Trigger

When commit message contains `release:`:
```bash
git commit -m "release: v1.0.3 - New features"
git push origin main
```

This will:
1. Sync files to `maria` repository
2. Trigger release workflow in `maria`
3. Create GitHub Release
4. Publish to NPM

### Version Tagging Strategy

- **Stable**: `release: v1.0.0` → NPM `@latest` tag
- **Alpha**: `release: v1.0.0-alpha.1` → NPM `@alpha` tag  
- **Beta**: `release: v1.0.0-beta.1` → NPM `@beta` tag

## 🛠️ Troubleshooting

### Common Issues

1. **Permission Denied**
   - Verify PAT has correct scopes
   - Check token hasn't expired
   - Ensure token has access to both repositories

2. **Sync Not Triggering**
   - Check if changes are in excluded paths
   - Verify workflow file is in `.github/workflows/`
   - Check GitHub Actions is enabled

3. **Files Missing in OSS**
   - Review `oss-sync-config.json` include paths
   - Check if files exist in source location
   - Verify file patterns match

### Debug Mode

Add debug output to workflow:
```yaml
- name: Debug
  run: |
    echo "Source files:"
    ls -la packages/code-cli/
    echo "OSS files:"
    ls -la /tmp/maria-oss/
```

## 📈 Monitoring

### Workflow Status Badge

Add to README.md:
```markdown
[![OSS Sync](https://github.com/bonginkan/maria_code/actions/workflows/sync-to-oss.yml/badge.svg)](https://github.com/bonginkan/maria_code/actions/workflows/sync-to-oss.yml)
```

### Notifications

Set up notifications in GitHub:
1. Go to Settings → Notifications
2. Enable workflow run notifications
3. Choose email or GitHub mobile app

## 🔒 Security Considerations

1. **Token Security**
   - Use fine-grained PATs when possible
   - Rotate tokens regularly (every 90 days)
   - Never commit tokens to repository

2. **Secret Management**
   - Use GitHub Secrets for all sensitive data
   - Limit secret access to required workflows
   - Audit secret usage regularly

3. **Repository Protection**
   - Enable branch protection on `main`
   - Require PR reviews for sensitive changes
   - Enable signed commits

## 📚 Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Personal Access Tokens Guide](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token)
- [GitHub Secrets Management](https://docs.github.com/en/actions/security-guides/encrypted-secrets)

---

**Last Updated**: August 10, 2025  
**Maintained by**: Bonginkan Inc. Development Team

For issues or questions, contact: dev@bonginkan.ai