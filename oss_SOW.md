# VS Code AI Agent npm OSS 開発SOW（Statement of Work）

**Version**: 1.0.0  
**Date**: 2025-08-21  
**Project**: VS Code AI Agent npm OSS Package  
**Status**: Planning  
**Timeline**: 14 weeks (4 phases)

## Executive Summary

VS Code内で動作するAIエージェントのコアをnpm OSSとして公開し、開発者の生産性を革新的に向上させるプラットフォームを構築します。MARIAプラットフォームの技術を基盤として、エンタープライズグレードのコード理解・編集支援機能を提供します。

## 1. プロジェクト概要

### 目的
- VS Code内で動作するAIエージェントのコアをnpm OSSとして公開
- ローカル/リポジトリ内のコード理解・編集支援（説明、リファクタ、テスト生成、検索、修正提案）
- 拡張性のための明確なインターフェース設計（モデルプロバイダ、ツール、メモリ、UI）

### 成果物
- `@your-org/agent-core`: TypeScript製のエージェントコアnpmパッケージ（OSS）
- `vscode-ai-agent`: VS Code拡張（OSS、agent-coreを利用）
- 完全なドキュメント（README、CONTRIBUTING、API Documentation）
- CI/CD パイプライン（GitHub Actions）

### 対象外（初期バージョン）
- リモートコード実行（任意コマンドの無制限実行）
- マルチエージェント協調
- 大規模RAG運用
- サーバサイド/クラウド常駐エージェント

## 2. 技術アーキテクチャ

### 技術スタック
```yaml
Runtime:
  - Node.js: 18+
  - TypeScript: 5.3+
  
Build:
  - tsup: バンドリング
  - esbuild: VS Code拡張のバンドル
  
Testing:
  - Vitest: ユニットテスト
  - @vscode/test-electron: E2Eテスト
  
Quality:
  - ESLint: コード品質
  - Prettier: フォーマット
  - TypeDoc: APIドキュメント
  
LLM Support:
  - OpenAI API
  - Anthropic API
  - Ollama (ローカル)
  - LM Studio (ローカル)
```

### コアアーキテクチャ

```typescript
// agent-core アーキテクチャ
interface AgentCore {
  // Model Provider Layer
  providers: {
    ModelProvider: interface
    OpenAIProvider: class
    AnthropicProvider: class
    OllamaProvider: class
  }
  
  // Tool System
  tools: {
    Tool: interface
    FileSystemTool: class
    CodeAnalysisTool: class
    SearchTool: class
    RefactorTool: class
  }
  
  // Agent Engine
  engine: {
    Agent: class
    PlanningEngine: class
    ExecutionEngine: class
    MemorySystem: class
  }
  
  // Safety & Security
  safety: {
    PermissionManager: class
    SandboxExecutor: class
    AuditLogger: class
  }
}
```

### VS Code拡張アーキテクチャ

```typescript
interface VSCodeExtension {
  // Commands
  commands: {
    explainCode: Command
    generateTests: Command
    refactorCode: Command
    fixBugs: Command
    searchCodebase: Command
  }
  
  // UI Components
  ui: {
    ChatWebview: WebviewPanel
    CodeLens: CodeLensProvider
    StatusBar: StatusBarItem
    QuickPick: QuickPickProvider
  }
  
  // Integration
  integration: {
    WorkspaceFS: FileSystemProvider
    GitIntegration: SourceControlProvider
    TerminalBridge: TerminalLinkProvider
    DiagnosticsBridge: DiagnosticCollection
  }
}
```

## 3. 実装計画

### Phase 1: 基盤構築（週1-3）

#### Week 1: プロジェクト初期化
- [ ] モノレポ構造のセットアップ
- [ ] TypeScript設定
- [ ] ESLint/Prettier設定
- [ ] 基本的なビルドパイプライン

#### Week 2: Agent Core 基本実装
- [ ] ModelProvider インターフェース
- [ ] Tool インターフェース
- [ ] 基本的なAgent実装
- [ ] Memory システムの基礎

#### Week 3: 初期プロバイダ実装
- [ ] OpenAI プロバイダ
- [ ] ファイル読み取りツール
- [ ] 基本的なコード解析ツール

### Phase 2: VS Code拡張開発（週4-6）

#### Week 4: 拡張基盤
- [ ] VS Code拡張のスキャフォールド
- [ ] agent-coreとの統合
- [ ] 基本コマンドの実装

#### Week 5: UI実装
- [ ] Webviewベースのチャット UI
- [ ] コマンドパレット統合
- [ ] ステータスバー表示

#### Week 6: ファイルシステム統合
- [ ] ワークスペースファイルアクセス
- [ ] コード選択範囲の取得
- [ ] エディタへの変更適用

### Phase 3: 高度な機能（週7-10）

#### Week 7: コード理解機能
- [ ] コード説明生成
- [ ] 依存関係分析
- [ ] 複雑度分析

#### Week 8: コード生成・修正
- [ ] テスト生成
- [ ] バグ修正提案
- [ ] リファクタリング提案

#### Week 9: 安全性・セキュリティ
- [ ] パーミッション管理
- [ ] 破壊的操作の確認
- [ ] 監査ログ

#### Week 10: 追加プロバイダ
- [ ] Anthropic プロバイダ
- [ ] Ollama プロバイダ
- [ ] プロバイダ切り替え機能

### Phase 4: 品質保証・公開（週11-14）

#### Week 11: テスト強化
- [ ] ユニットテスト（80%カバレッジ）
- [ ] E2Eテスト
- [ ] パフォーマンステスト

#### Week 12: ドキュメント
- [ ] APIドキュメント
- [ ] 使用ガイド
- [ ] コントリビューションガイド

#### Week 13: 最適化
- [ ] パフォーマンス最適化
- [ ] バンドルサイズ削減
- [ ] メモリ使用量最適化

#### Week 14: リリース準備
- [ ] npm公開準備
- [ ] VS Code Marketplace準備
- [ ] リリースノート作成
- [ ] v1.0.0公開

## 4. ディレクトリ構造

```
vscode-ai-agent/
├── package.json              # Workspace configuration
├── packages/
│   └── agent-core/          # npm package
│       ├── src/
│       │   ├── providers/   # AI model providers
│       │   ├── tools/       # Agent tools
│       │   ├── engine/      # Core agent engine
│       │   └── safety/      # Safety mechanisms
│       ├── tests/
│       └── package.json
├── apps/
│   └── vscode-extension/    # VS Code extension
│       ├── src/
│       │   ├── commands/    # VS Code commands
│       │   ├── ui/          # Webview and UI
│       │   └── bridge/      # Core integration
│       ├── package.json
│       └── extension.ts
├── docs/                     # Documentation
├── examples/                 # Usage examples
└── .github/
    └── workflows/           # CI/CD
```

## 5. 機能仕様

### コア機能（MVP）

#### 1. コード説明
```typescript
// ユーザーが選択したコードを説明
interface ExplainCodeRequest {
  code: string
  language: string
  context?: string[]
}

interface ExplainCodeResponse {
  explanation: string
  complexity: 'simple' | 'moderate' | 'complex'
  suggestions?: string[]
}
```

#### 2. テスト生成
```typescript
// 選択したコードのテストを生成
interface GenerateTestRequest {
  code: string
  framework?: 'jest' | 'mocha' | 'vitest'
  style?: 'unit' | 'integration'
}

interface GenerateTestResponse {
  tests: string
  coverage: number
  framework: string
}
```

#### 3. リファクタリング提案
```typescript
// コードの改善提案
interface RefactorRequest {
  code: string
  goals?: ('performance' | 'readability' | 'maintainability')[]
}

interface RefactorResponse {
  suggestions: RefactorSuggestion[]
  explanation: string
}
```

### 安全機能

#### ファイルシステム保護
- ワークスペース外へのアクセス禁止
- .gitignoreファイルの尊重
- 大容量ファイルの処理制限

#### 操作確認
- 破壊的操作前の確認ダイアログ
- Dry-runモード
- Undo/Redo対応

#### プライバシー
- APIキーの安全な保存（VS Code SecretStorage）
- テレメトリのオプトイン
- ローカル処理優先

## 6. 品質基準

### コード品質
- TypeScript strict mode
- ESLint: 0 errors, 0 warnings
- Test coverage: 80%以上
- Bundle size: < 5MB

### パフォーマンス
- 初回起動: < 3秒
- コマンド実行: < 500ms
- メモリ使用: < 200MB

### ユーザビリティ
- 直感的なUI/UX
- 豊富なキーボードショートカット
- 多言語対応（i18n準備）

## 7. セキュリティ要件

### APIキー管理
- VS Code SecretStorageを使用
- 環境変数サポート
- キーローテーション対応

### コード実行
- サンドボックス環境
- タイムアウト設定
- リソース制限

### データ保護
- ローカル処理優先
- 送信データの最小化
- ユーザー確認必須

## 8. ライセンス・知的財産

### ライセンス
- MIT License（推奨）
- Apache 2.0（代替案）

### 依存関係
- ライセンス互換性の確認
- セキュリティ脆弱性スキャン
- 定期的な更新

## 9. リリース戦略

### バージョニング
- Semantic Versioning (SemVer)
- v0.x: ベータ版
- v1.0: 安定版

### 配布
- npm: @your-org/agent-core
- VS Code Marketplace: AI Agent Assistant

### マーケティング
- GitHub README
- デモ動画
- ブログ記事
- Twitter/X 告知

## 10. 成功指標

### 定量的指標
- npm週間ダウンロード数: 1,000+
- VS Code インストール数: 5,000+
- GitHub スター: 500+
- アクティブユーザー: 1,000+

### 定性的指標
- ユーザーフィードバック評価
- コミュニティの活発さ
- コントリビューター数
- エンタープライズ採用

## 11. リスク管理

### 技術的リスク
- **LLM APIの変更**: 抽象化レイヤーで対応
- **VS Code API変更**: 後方互換性の維持
- **パフォーマンス問題**: 段階的な最適化

### ビジネスリスク
- **競合製品**: 差別化機能の強化
- **ライセンス問題**: 事前の法的確認
- **サポート負荷**: コミュニティ主導

## 12. 実装コマンド例

### 初期セットアップ
```bash
# リポジトリ作成
git init vscode-ai-agent
cd vscode-ai-agent

# モノレポ初期化
npm init -y
npm init -w packages/agent-core
npm init -w apps/vscode-extension

# 依存関係インストール
npm i -D typescript tsup vitest @types/node
npm i -w packages/agent-core zod openai
npm i -D -w apps/vscode-extension @types/vscode esbuild

# TypeScript設定
npx tsc --init

# ビルド
npm run build

# テスト
npm test

# 公開
npm publish --workspace packages/agent-core
vsce publish
```

## 13. 継続的改善

### Phase 5以降の計画
- マルチモーダル対応（画像解析）
- リアルタイムコラボレーション
- カスタムモデルのファインチューニング
- エンタープライズ機能
- 他IDE対応（JetBrains、Sublime Text）

## 14. コミュニティ構築

### オープンソース運営
- Issue/PRテンプレート
- Code of Conduct
- Contributing Guide
- Security Policy

### エンゲージメント
- Discord/Slackコミュニティ
- 定期的なリリース
- ロードマップの公開
- コントリビューター認定

## 15. 受け入れ基準

### MVP完成条件
- [ ] agent-coreがnpmで動作
- [ ] VS Code拡張が基本機能を提供
- [ ] コード説明機能が動作
- [ ] 破壊的操作の保護機能
- [ ] ドキュメント完備
- [ ] CI/CDパイプライン稼働

### 品質基準達成
- [ ] テストカバレッジ80%以上
- [ ] ESLint 0 errors/warnings
- [ ] TypeScript strict mode
- [ ] セキュリティ脆弱性なし

---

**作成者**: MARIA Platform Team  
**最終更新**: 2025-08-21  
**ステータス**: Planning → Implementation Ready

このSOWはMARIA Platformの実績と技術を基盤として、VS Code AI Agentの開発を成功に導くための包括的な計画書です。