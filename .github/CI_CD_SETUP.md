# 🚀 CI/CD Setup Guide

## 📋 GitHub Secrets 設定

CI/CDパイプラインを動作させるために、以下のSecretsをGitHubリポジトリに設定する必要があります。

### 必要なSecrets

1. **`NPM_TOKEN`** - npm公開用のアクセストークン

### 🔧 NPM_TOKEN の取得方法

1. **npm.com にログイン**
   ```bash
   npm login
   ```

2. **Access Token作成**
   - https://www.npmjs.com/settings/tokens にアクセス
   - "Generate New Token" をクリック
   - "Automation" を選択（CI/CD用）
   - トークンをコピー

3. **GitHubに設定**
   - GitHub リポジトリ → Settings → Secrets and variables → Actions
   - "New repository secret" をクリック
   - Name: `NPM_TOKEN`
   - Value: コピーしたnpmトークン

## 🔄 CI/CDワークフロー

### 1. 自動公開 (Auto Publish)
- **トリガー**: `main`ブランチへのpush
- **動作**: 
  - ビルド&テスト実行
  - alphaバージョン自動インクリメント
  - npm registryに公開 (`@alpha`タグ)
  - GitHubリリース作成

### 2. 手動公開 (Manual Publish)
- **トリガー**: GitHub Actions手動実行
- **動作**:
  - ビルド&テスト実行
  - 指定したタグ(alpha/beta/latest)で公開

### 3. PRチェック (PR Quality Check)
- **トリガー**: プルリクエスト作成時
- **動作**:
  - ビルドチェック
  - Lintチェック 
  -型チェック
  - パッケージサイズチェック

## 📦 公開フロー

### 開発フロー
```bash
# 1. 開発ブランチで作業
git checkout -b feature/new-feature
# ... development work ...

# 2. PRを作成（自動でPRチェック実行）
git push origin feature/new-feature

# 3. mainにマージ（自動でalpha版公開）
# GitHub UIでPRをマージ
```

### リリースフロー
```bash
# 1. 安定版リリースの準備
git checkout main
git pull origin main

# 2. 手動でlatestタグ公開
# GitHub Actions → "CI/CD Pipeline" → "Run workflow"
# Tag: "latest" を選択
```

## 🎯 使用方法

### インストール

```bash
# Latest alpha (自動公開)
npm install -g @bonginkan/maria@alpha

# Latest stable (手動公開)
npm install -g @bonginkan/maria@latest

# 特定バージョン
npm install -g @bonginkan/maria@1.0.0-alpha.2
```

### CLI使用

```bash
# インタラクティブCLI起動
maria

# チャットモード
mc chat

# バージョン確認
maria --version
```

## 🔍 トラブルシューティング

### 公開が失敗する場合
1. **NPM_TOKEN**が正しく設定されているか確認
2. npmアカウントに`@bonginkan/maria`パッケージの公開権限があるか確認
3. 2FA設定の場合、Automation tokenを使用しているか確認

### ビルドが失敗する場合
1. `pnpm install`が正常に実行されるか確認
2. TypeScriptエラーがないか確認
3. ESLintエラーがないか確認

## 📊 モニタリング

- **GitHub Actions**: リポジトリの"Actions"タブで実行状況確認
- **npm**: https://www.npmjs.com/package/@bonginkan/maria でパッケージ状況確認
- **ダウンロード数**: npmjs.comで統計確認可能

---
🤖 Powered by GitHub Actions & npm