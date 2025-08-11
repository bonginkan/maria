# 🏗️ MARIA Platform - Internal Development Repository

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-blue)](https://www.typescriptlang.org/)
[![pnpm](https://img.shields.io/badge/pnpm-10.14%2B-orange)](https://pnpm.io/)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green)](https://nodejs.org/)
[![GCP](https://img.shields.io/badge/GCP-Integrated-4285F4)](https://cloud.google.com/)
[![Neo4j](https://img.shields.io/badge/Neo4j-AuraDS-008CC1)](https://neo4j.com/)

> ⚠️ **社内開発用プライベートリポジトリ** - Bonginkan Inc. Internal Use Only

## 📋 目次

1. [概要](#概要)
2. [アーキテクチャ](#アーキテクチャ)
3. [開発環境セットアップ](#開発環境セットアップ)
4. [プロジェクト構造](#プロジェクト構造)
5. [開発コマンド一覧](#開発コマンド一覧)
6. [機能詳細](#機能詳細)
7. [AI統合](#ai統合)
8. [インフラストラクチャ](#インフラストラクチャ)
9. [デプロイメント](#デプロイメント)
10. [トラブルシューティング](#トラブルシューティング)

## 概要

**MARIA Platform**は、Bonginkan Inc.が開発する次世代AI開発プラットフォームです。

### 🎯 3つの主要プロダクト

1. **MARIA CODE** (`/src`, `/dist`, `/bin`)
   - 40+のインタラクティブコマンドを持つCLIツール
   - 22+ AIモデル対応（OpenAI, Anthropic, Google, xAI, Groq, Local LLMs）
   - 自然言語によるコード生成・レビュー・テスト
   - 🧠 **インテリジェントルーティング**: 自然言語を内部で適切なスラッシュコマンドに自動変換
   - ⚡ **インタラプト機能**: AI処理中でも新しい指示を即座に受付・優先処理

2. **MARIA STUDIO** (`packages/studio-app`)
   - Next.js 15 + React 19 RCベースのWebアプリケーション
   - リアルタイムコラボレーション機能
   - Paper/Slides/DevOpsエディタ

3. **MARIA API** (`packages/core-api`)
   - tRPC APIサーバー（7 routers実装済み）
   - Neo4j Graph Database統合
   - Firebase Auth + RBAC

### 🔗 関連リポジトリ

- **OSS配布用**: https://github.com/bonginkan/maria (公開リポジトリ)
- **開発用**: https://github.com/bonginkan/maria_code (このリポジトリ)
- **ランディングページ**: https://maria-code.vercel.app

## アーキテクチャ

```mermaid
graph TB
    subgraph "Frontend"
        A[MARIA STUDIO<br/>Next.js 15 App] 
        B[MARIA CODE CLI<br/>TypeScript/Ink]
        C[Landing Page<br/>Next.js]
    end
    
    subgraph "Backend"
        D[tRPC API<br/>Cloud Run]
        E[AI Agents<br/>LangGraph]
        F[Dataflow Jobs<br/>Apache Beam]
    end
    
    subgraph "Data Layer"
        G[Firestore<br/>Real-time State]
        H[Spanner<br/>Version Control]
        I[Neo4j AuraDS<br/>Graph RAG]
        J[BigQuery<br/>Analytics]
    end
    
    subgraph "AI Services"
        K[Vertex AI<br/>Gemini 2.5 Pro/Flash]
        L[OpenAI API<br/>GPT-5/o3]
        M[Anthropic<br/>Claude Opus 4.1]
        N[xAI<br/>Grok 4]
        O[Groq<br/>Llama 3.1 70B + Mixtral 8x22B]
        P[Local LLMs<br/>LM Studio]
    end
    
    A --> D
    B --> D
    D --> E
    D --> G
    D --> H
    D --> I
    E --> K
    E --> L
    E --> M
    E --> N
    E --> O
    B --> P
    F --> J
```

## 開発環境セットアップ

### 必要要件

- **Node.js**: 18.0.0以上
- **pnpm**: 10.14.0以上
- **Git**: 2.30以上
- **Docker**: 20.10以上（オプション）
- **GCP Account**: Cloud機能用
- **Firebase Project**: 認証用

### 初期セットアップ

```bash
# リポジトリのクローン
git clone https://github.com/bonginkan/maria_code.git
cd maria_code

# 依存関係のインストール
pnpm install

# 環境変数の設定
cp .env.example .env.local
# .env.localを編集して必要な値を設定

# ビルド
pnpm build

# 開発サーバー起動
pnpm dev
```

### MARIAコマンドのグローバルインストール

```bash
# ローカルでビルド
pnpm build

# グローバルにリンク
npm link

# 動作確認
maria --version
maria chat
```

## 🌐 ランディングページ

OSS配布用の美しいランディングページが用意されています。

### ローカル起動方法
```bash
# ランディングページディレクトリへ移動
cd maria-code-lp

# 依存関係インストール
pnpm install

# 開発サーバー起動
pnpm run dev

# ブラウザでアクセス
# http://localhost:3000
```

### デプロイ済みURL
- **Production**: https://maria-code.vercel.app
- **自動デプロイ**: Vercel (mainブランチ)

### 特徴
- ダークモードのシンプルなデザイン
- Google Material Icons使用
- Next.js 14 + TypeScript
- レスポンシブ対応
- 40+コマンドの詳細な説明
- インストール手順のワンクリックコピー

## プロジェクト構造

```
maria_code/
├── 📁 src/                        # MARIA CODE CLIソースコード
│   ├── bin/                       # CLIエントリポイント
│   ├── cli.ts                     # メインCLIロジック
│   ├── commands/                  # CLIコマンド実装
│   │   ├── chat.ts               # インタラクティブチャット
│   │   ├── code.tsx              # AIコード生成
│   │   ├── vision.tsx            # 画像解析
│   │   ├── review.tsx            # コードレビュー
│   │   ├── test.ts               # テスト生成
│   │   ├── video.tsx             # ビデオ生成
│   │   └── image.tsx             # 画像生成
│   ├── components/                # React/Inkコンポーネント
│   ├── providers/                 # AIプロバイダー実装
│   │   ├── openai-provider.ts
│   │   ├── anthropic-provider.ts
│   │   ├── google-provider.ts
│   │   ├── groq-provider.ts
│   │   └── lmstudio-provider.ts
│   ├── services/                  # ビジネスロジック
│   │   ├── ai-router.ts         # AIモデル選択
│   │   ├── slash-command-handler.ts
│   │   ├── chat-context.service.ts
│   │   ├── interactive-session.ts
│   │   └── intelligent-router/  # 🧠 インテリジェントルーティング (全Phase実装済み✅)
│   │       ├── intent-classifier.ts    # 自然言語→コマンド変換エンジン
│   │       ├── command-dispatcher.ts   # 内部コマンド実行制御
│   │       ├── context-manager.ts      # 会話履歴とプロジェクト状態管理
│   │       ├── interrupt-handler.ts    # 処理中断と優先度制御
│   │       ├── priority-queue.ts       # タスクキューと並列実行管理
│   │       ├── stream-processor.ts     # ストリーミングレスポンス処理
│   │       ├── learning-engine.ts      # 学習エンジン（Phase 3）
│   │       ├── multimodal-handler.ts   # マルチモーダル対応（Phase 4）
│   │       └── index.ts                # 統合モジュール
│   └── utils/                     # ユーティリティ
│
├── 📁 dist/                       # ビルド済みCLI
│   ├── cli.js                    # メインCLIバンドル
│   └── index.js                  # エクスポート
│
├── 📁 bin/                        # 実行可能ファイル
│   └── maria                     # CLIエントリポイント
│
├── 📁 packages/                   # pnpmワークスペース
│   ├── studio-app/               # Next.js Webアプリ
│   │   ├── app/                 # App Router
│   │   ├── components/          # UIコンポーネント
│   │   └── lib/                 # ライブラリ
│   ├── code-cli/                # CLI追加機能
│   ├── core-api/                # tRPC APIサーバー
│   │   ├── routers/            # APIエンドポイント
│   │   └── services/           # ビジネスロジック
│   ├── ai-agents/              # AIエージェント
│   ├── dataflow-jobs/          # バッチ処理
│   └── shared/                 # 共有ライブラリ
│
├── 📁 maria-code-lp/             # ランディングページ
│   ├── app/                     # Next.js App Router
│   └── components/              # UIコンポーネント
│
├── 📁 maria-oss/                 # OSS配布用パッケージ
│   ├── README.md               # エンドユーザー向け
│   ├── package.json            # npm公開用
│   └── dist/                   # 配布用ビルド
│
├── 📁 infra/                     # インフラストラクチャ
│   ├── terraform/              # IaC定義
│   │   ├── gcp/               # GCPリソース
│   │   └── neo4j/             # Neo4j設定
│   └── pipelines/             # CI/CDパイプライン
│
├── 📁 scripts/                   # 開発スクリプト
│   ├── setup-wizard.sh        # セットアップウィザード
│   ├── health-monitor.sh      # ヘルスチェック
│   └── auto-start-llm.sh      # LLM自動起動
│
├── 📁 .github/                   # GitHub設定
│   ├── workflows/             # GitHub Actions
│   │   ├── ci-cd.yml         # CI/CDパイプライン
│   │   ├── sync-to-oss.yml   # OSS同期
│   │   └── release.yml       # リリース自動化
│   └── CODEOWNERS            # コードオーナー
│
├── 📄 package.json              # ルートパッケージ
├── 📄 pnpm-workspace.yaml       # モノレポ設定
├── 📄 turbo.json               # Turborepo設定
├── 📄 tsconfig.json            # TypeScript設定
├── 📄 .env.example             # 環境変数テンプレート
├── 📄 CLAUDE.md                # AI開発ガイド
└── 📄 README.md                # このファイル
```

## 開発コマンド一覧

### 🚀 基本コマンド

```bash
# 開発サーバー
pnpm dev              # 全サービス起動
pnpm dev:studio       # Studio + API起動
pnpm dev:api         # APIのみ起動
pnpm dev:cli         # CLIウォッチモード

# ビルド
pnpm build           # 全パッケージビルド
pnpm build:studio    # Studioビルド
pnpm build:cli       # CLIビルド
pnpm build:oss       # OSS配布用ビルド

# テスト
pnpm test            # 全テスト実行
pnpm test:coverage   # カバレッジ付きテスト
pnpm test:cli        # CLIテストのみ
pnpm test:e2e        # E2Eテスト

# コード品質
pnpm lint            # ESLintチェック
pnpm lint:fix        # ESLint自動修正
pnpm typecheck       # TypeScriptチェック
pnpm format          # Prettier整形
pnpm contract:all    # 契約検証
```

### 🎯 MARIA CLIコマンド（40+）

#### 基本コマンド
```bash
maria init           # プロジェクト初期化
maria chat           # インタラクティブモード起動
maria code "prompt"  # AIコード生成
maria vision img.png # 画像解析
maria review         # コードレビュー
maria test           # テスト生成
maria commit         # AIコミットメッセージ
maria deploy         # デプロイ実行
```

#### 🧠 インテリジェントルーティング (自動変換)
```bash
# 自然言語入力 → 内部で適切なコマンドを自動実行
"動画を作って"           → /video
"画像を生成"             → /image  
"このバグを修正"         → /code fix
"テスト書いて"           → /test
"レビューして"           → /review
"コミットして"           → /commit
```

#### メディア生成
```bash
maria video "プロンプト"  # AI動画生成
maria image "プロンプト"  # AI画像生成
```

#### インタラクティブモードのスラッシュコマンド
```bash
# ユーザー管理
/login              # ログイン
/logout             # ログアウト
/status             # ステータス表示
/mode               # モード切替

# 設定・環境
/config             # 設定パネル
/model              # ✅ AIモデル選択（完璧に実装済み）
/permissions        # 権限管理
/hooks              # フック設定
/doctor             # システム診断

# プロジェクト管理
/init               # MARIA.md初期化
/add-dir            # ディレクトリ追加
/memory             # メモリ編集
/export             # エクスポート

# 会話・コスト
/clear              # 履歴クリア
/compact            # 要約
/resume             # 再開
/cost               # コスト表示

# 開発支援
/review             # PRレビュー
/pr-comments        # PRコメント取得
/bug                # バグ報告
/release-notes      # リリースノート

# メディア生成
/video              # 動画生成
/image              # 画像生成

# UI
/vim                # Vimモード
/help               # ヘルプ
/exit               # 終了
```

### 🔧 開発用スクリプト

```bash
# セットアップ
./scripts/setup-wizard.sh        # 初期設定ウィザード
./scripts/health-monitor.sh check # ヘルスチェック

# LLM管理
./scripts/auto-start-llm.sh start   # LM Studio起動
./scripts/auto-start-llm.sh status  # ステータス確認

# ComfyUI (動画生成用)
./scripts/setup-comfyui.sh       # ComfyUIセットアップ
./scripts/start-comfyui.sh       # ComfyUI起動

# テスト
./scripts/test-media-generation.sh # メディア生成テスト
pnpm test:cli:all                  # 全CLIテスト
```

## 機能詳細

### 🤖 MARIA CODE CLI

#### 🎯 最大の特徴: 40個のスラッシュコマンド

`maria`コマンドで即座にインタラクティブチャット開始。すべての機能がスラッシュコマンドで操作可能。

#### ✅ 全Phase実装完了！インテリジェントルーティングシステム

##### 📂 実装済みモジュール

**Phase 1: 内部スラッシュコマンド自動起動** ✅
1. `intent-classifier.ts` - 自然言語→コマンド変換エンジン
2. `command-dispatcher.ts` - 内部コマンド実行制御
3. `context-manager.ts` - 会話履歴とプロジェクト状態管理

**Phase 2: インタラプト&リアルタイム処理** ✅
4. `interrupt-handler.ts` - 処理中断と優先度制御
5. `priority-queue.ts` - タスクキューと並列実行管理
6. `stream-processor.ts` - ストリーミングレスポンス処理

**Phase 3: アダプティブラーニング** ✅
7. `learning-engine.ts` - ユーザーの使用パターンを学習し最適化

**Phase 4: マルチモーダル対応** ✅
8. `multimodal-handler.ts` - 音声・画像・ジェスチャー入力対応

##### 🚀 実装済み機能

**自然言語→コマンド自動変換:**
- "動画を作って" → `/video`
- "画像を生成" → `/image`
- "バグ修正" → `/code fix`
- "テスト書いて" → `/test`

**リアルタイム処理:**
- Ctrl+C対応の処理中断
- 優先度ベースのタスクキュー
- ストリーミングレスポンス
- バックプレッシャー制御

**コンテキスト認識:**
- プロジェクトタイプ自動検出
- 会話履歴の継続性維持
- ユーザープロファイル学習
- エラーパターン記録

**Phase 3: 学習エンジン機能:**
- 使用パターン記録とコマンド成功率追跡
- 頻発エラーの検出と修正提案
- 生産性の高い時間帯を特定
- コンテキストから次のコマンドを予測
- 使用頻度に基づく自動補完強化
- 実行時間の長いコマンドを検出し最適化

**Phase 4: マルチモーダル機能:**
- 🎤 音声入力: ウェイクワード検出、音声→テキスト変換
- 📸 画像解析: スクリーンショット、スケッチ、フローチャート→コード生成
- 📁 ドラッグ&ドロップ: ファイルタイプ自動検出とバッチ処理
- 👆 ジェスチャー認識: スワイプ、ピンチ、タップをコマンドに変換
- 🎨 UIモックアップ→React: 画像からコンポーネント自動生成

```bash
maria        # 美しいASCIIロゴと共にインタラクティブチャット開始
             # 入力欄から40個のスラッシュコマンドを即座に実行可能
```

**主要なスラッシュコマンド:**
- `/code` - AIコード生成
- `/test` - テスト生成・実行
- `/review` - コードレビュー
- `/video` - AI動画生成
- `/image` - AI画像生成
- `/init` - プロジェクト初期化
- `/help` - 全40コマンド表示

#### インタラクティブルーターシステム
- **自然言語理解**: 開発者の意図を解析し最適なコマンドにルーティング
- **コンテキスト認識**: 会話履歴とプロジェクト状態を利用
- **マルチステップ実行**: 複雑なタスクを実行可能なステップに分解
- **オートモード**: 自然言語→自動コマンド実行
- **インタラプト機能**: AI処理中でも新しい指示を即座に優先処理 ✨ NEW

#### インタラプト機能 ✨ NEW
AI回答中でも新しい指示を入力可能。処理を中断し、新しい指示を優先的に実行します。

**✅ 実装内容:**

1. **処理中断メカニズム**
   - `isProcessing`フラグで処理状態を管理
   - `processingTimeout`で非同期処理を制御
   - 新しい入力で`interruptProcessing()`を呼び出し

2. **優先順位判定ロジック**
   - 追加情報キーワード検出（「また」「さらに」「and」「also」など）
   - 矛盾する場合は新しい指示を優先
   - 追加情報は既存処理に統合

3. **AIへのプロンプト調整**
   ```
   // 優先指示の場合
   "User interrupted with new priority request. Focus on this new request instead."
   
   // 追加情報の場合
   "User provided additional information. Incorporate this with the previous request."
   ```

4. **ユーザーフィードバック**
   - `[Interrupted - Processing new request]`
   - `[Overriding previous request]` または `[Treating as additional information]`

**📝 使用方法:**

```bash
# 基本的な使い方
> Create a REST API for users
Thinking...
> Actually, make it GraphQL instead  # 処理中に新しい指示
[Interrupted - Processing new request]
[Overriding previous request]
Based on your new request: Creating GraphQL API...

# 追加情報の場合
> Create a user authentication system
Thinking...
> Also add OAuth support  # "also"で追加と判定
[Interrupted - Processing new request]
[Treating as additional information]
Considering the additional info: Creating auth system with OAuth...
```

**🔧 技術詳細:**
- Ctrl+C対応: 処理中のみ中断、それ以外は終了確認
- タイムアウト管理: clearTimeoutで確実にクリーンアップ
- コンテキスト管理: systemロールでAIに優先順位を伝達
- 言語対応: 日本語・英語両方のキーワードに対応

#### ベースナレッジシステム
- **プロジェクト理解**: コードベース構造、依存関係、パターンを学習
- **セマンティック検索**: コードとドキュメントの自然言語クエリ
- **パターンメモリー**: 一般的なコードパターンの認識と提案
- **永続学習**: セッション間で知識を.maria-memory.mdに保持

#### 📋 MARIA.md - AI開発設計書

`/init`コマンドで自動生成される、プロジェクトの包括的な開発設計書。

**特徴:**
- **自動解析**: コードベース全体を解析し、プロジェクトの意図を理解
- **配置**: プロジェクトルートに`MARIA.md`として生成
- **Claude Code互換**: CLAUDE.mdと同様の形式でAIアシスタントにコンテキスト提供

**生成される内容:**
- プロジェクトの目的と概要
- アーキテクチャ設計
- 開発指針とベストプラクティス
- SOW (Statement of Work)
- 技術スタック詳細
- API仕様
- データベース設計
- テスト戦略
- デプロイメント手順

**使用方法:**
```bash
maria        # インタラクティブモード起動
/init        # MARIA.md自動生成
```

#### 🚀 /model 機能 - 完璧実装済み ✅

**MARIA CODEの最重要機能の一つ：AIモデル選択機能**

##### 🔧 実装内容詳細

**ローカルモデル選択時のフロー**

1. ✅ LM Studio接続確認 (localhost:1234)
2. ✅ 接続失敗時の詳細なエラー指示
3. ✅ モデル自動ローディング（プログレス表示付き）
4. ✅ ローディング成功/失敗の明確な通知
5. ✅ AIプロバイダーのlmstudioへの切り替え

**クラウドモデル選択時のフロー**

1. ✅ モデルIDからプロバイダー自動判定
   - gpt-*, o3 → openai
   - claude-* → anthropic
   - gemini-* → google
   - grok-* → xai
   - llama-*, mixtral-* → groq
2. ✅ 即座にプロバイダー切り替え
3. ✅ ステータス表示でプロバイダー確認

**AI即時利用統合**

- ✅ /codeコマンド: 選択したプロバイダーで即座にコード生成
- ✅ /testコマンド: 選択したプロバイダーで即座にテスト生成
- ✅ /statusコマンド: プロバイダー状況を詳細表示

##### 🧪 動作確認

**成功テスト**

- ✅ 構文チェック: パス
- ✅ CLI起動: 正常
- ✅ インタラクティブUI: 実装済み
- ✅ モデル表示: 完璧
- ✅ 選択機能: 上下キー + Enter
- ✅ 現在モデル表示: *マーク

**実装済みユーザーエクスペリエンス**

```bash
# ローカルモデル選択時
🔄 Switching to GPT-OSS 120B (LM Studio)...
🔍 Checking LM Studio connection...
✅ LM Studio connected
🚀 Loading GPT-OSS 120B...
   This may take a few moments for large models...
✅ GPT-OSS 120B loaded successfully

🤖 AI Provider Status:
   Provider: lmstudio
   Model: gpt-oss-120b

🚀 Ready for /code, /test, and other AI commands
```

##### 📊 実装達成率

| 機能              | 実装状況     | 達成率  |
|-----------------|----------|------|
| 1. 表示           | ✅ 完璧     | 100% |
| 2. 現在モデル表示      | ✅ 完璧     | 100% |
| 3. 選択（上下+Enter） | ✅ 完璧     | 100% |
| 4. 即時切り替え       | ✅ 完璧     | 100% |
| 5. ローカル即時起動     | ✅ 新規実装完了 | 100% |
| 6. AI即時利用       | ✅ 新規実装完了 | 100% |

##### 🎯 結果

MARIA CODEの/model機能は現在完璧に動作します！

- ✅ 全6項目完全実装
- ✅ エラーハンドリング完備
- ✅ ユーザーフィードバック充実
- ✅ プロダクション品質

ユーザーはクラウドとローカルモデルを自由に選択し、即座にAI機能(/code, /test等)を利用できます。LM Studioが起動していない場合も明確な指示が表示され、ユーザーエクスペリエンスが大幅に向上しました。

#### AIモデル設定 - August 2025 Latest ✨
```typescript
// クラウドモデル (10モデル)
const cloudModels = {
  openai: {
    'gpt-5': { context: 256000, use: '🔥 Latest flagship - 最高性能' },
    'gpt-5-mini': { context: 128000, use: '軽量・高速版' },
    'o3': { context: 128000, use: '🧠 推論特化モデル' }
  },
  anthropic: {
    'claude-opus-4.1': { context: 200000, use: '🎯 最新Claude - 長文処理' },
    'claude-4-sonnet': { context: 200000, use: '⚡ コーディング特化' }
  },
  google: {
    'gemini-2.5-pro': { context: 1000000, use: '🚀 推論強化・マルチモーダル' },
    'gemini-2.5-flash': { context: 1000000, use: '⚡ 適応思考・費用対効果' },
    'gemini-2.5-flash-lite': { context: 1000000, use: '💨 高スループット' }
  },
  xai: {
    'grok-4': { context: 128000, use: '🤖 リアルタイムWeb情報' }
  },
  meta: {
    'llama-4-405b': { context: 128000, use: '🦙 GPT-5競合・オープンソース' }
  },
  mistral: {
    'mistral-large-3': { context: 128000, use: '🇫🇷 ヨーロッパAI' }
  }
}

// ローカルモデル (12モデル) - 全て32Kコンテキスト設定済み
const localModels = {
  lmstudio: {
    'qwen-3-72b': { context: 32768, vram: '~36GB', use: '🏆 最高のローカルモデル' },
    'deepseek-v3-67b': { context: 32768, vram: '~34GB', use: '🔍 コード特化' },
    'code-llama-70b': { context: 32768, vram: '~35GB', use: '💻 Meta製コーディング' },
    'phi-4-14b': { context: 32768, vram: '~8GB', use: '🎯 Microsoft効率モデル' },
    'llama-4-8b': { context: 32768, vram: '~5GB', use: '🦙 小型だが高性能' },
    'mistral-7b-v0.3': { context: 32768, vram: '~4GB', use: '⚡ 超高速推論' }
  },
  ollama: {
    'qwen2.5-vl': { context: 8192, vram: '~8GB', use: '📸 ビジョンタスク特化' }
  }
}
```

### 🌐 MARIA STUDIO

#### 技術スタック
- **Frontend**: Next.js 15 (App Router) + React 19 RC
- **Styling**: Tailwind CSS + shadcn/ui
- **State**: Zustand + React Query
- **Auth**: Firebase Auth + カスタムRBAC

#### 主要機能
1. **Paper Editor**: アカデミック論文作成
2. **Slides Editor**: プレゼンテーション作成
3. **DevOps Console**: インフラ管理
4. **Graph Viewer**: Neo4j Bloom統合

### 🔌 MARIA API

#### tRPCルーター (7実装済み)
```typescript
// packages/core-api/routers/
auth        // 認証、プロファイル、設定、チーム管理
papers      // Paper CRUD、バージョン管理、共同編集
slides      // プレゼンテーションCRUD、AI生成、Google Slides統合
projects    // プロジェクト管理、メンバー管理、統計
chat        // AIチャットセッション、履歴管理
conversation // RTF分析、タスクプラン作成、SOW生成
graph       // Neo4j統合、Bloom統合
```

#### セキュリティ
- Firebase Auth認証
- RBAC (admin/editor/viewer)
- Rate Limiting
- IP制限
- CORS設定

## AI統合

### 🎬 動画生成 (Wan 2.2)

```bash
# Text-to-Video
maria video "夕焼けの中を走る赤いスポーツカー" --model wan22-14b

# Image-to-Video
maria video "カメラがゆっくりズームアウト" --input-image photo.jpg

# 高品質設定
maria video "二匹の猫がダンス" --resolution 1080p --fps 30 --frames 81
```

### 🖼️ 画像生成 (Qwen-Image)

```bash
# 基本生成
maria image "未来都市の夜景、ネオン、サイバーパンク"

# スタイル指定
maria image "賢い老魔法使いの肖像" --style photorealistic --size 1024x1024

# バッチ生成
maria image "ロゴデザインコンセプト" --batch 4 --variations 3
```

### 🧠 コンテキスト管理

```typescript
// ChatContextService設定
const contextService = ChatContextService.getInstance({
  maxTokens: 128000,           // コンテキストサイズ
  compressionThreshold: 0.8,   // 圧縮開始閾値
  summaryTokenLimit: 2000,     // 最大要約サイズ
  persistPath: '~/.maria/context'
});

// /clearコマンドオプション
/clear              # 通常クリア（統計表示付き）
/clear --soft       # 表示のみクリア（コンテキスト保持）
/clear --hard       # 完全リセット
/clear --summary    # 要約生成してクリア
```

## インフラストラクチャ

### GCPリソース

```hcl
// infra/terraform/gcp/main.tf
resource "google_project" "maria_code" {
  name       = "maria-code"
  project_id = "maria-code"
}

// Cloud Run
resource "google_cloud_run_service" "api" {
  name     = "maria-api"
  location = "asia-northeast1"
}

// Vertex AI
resource "google_vertex_ai_endpoint" "gemini" {
  display_name = "maria-gemini-endpoint"
  model        = "gemini-2.5-pro"
}

// Firestore
resource "google_firestore_database" "main" {
  name        = "maria-firestore"
  location_id = "asia-northeast1"
}
```

### Neo4j AuraDS

```typescript
// Neo4j設定
const neo4jConfig = {
  instanceId: "4234c1a0",
  uri: "neo4j+s://4234c1a0.databases.neo4j.io",
  constraints: 5,
  indexes: 14
}

// JWT認証 (15分有効)
const jwtConfig = {
  secret: process.env.NEO4J_BLOOM_JWT_SECRET,
  expiresIn: '15m',
  algorithm: 'HS256'
}
```

## デプロイメント

### 🚀 環境別デプロイ

```bash
# 開発環境
pnpm deploy:dev

# ステージング環境
pnpm deploy:staging

# 本番環境
pnpm deploy:prod

# Cloud Buildトリガー
gcloud builds submit --config=cloudbuild.yaml
```

### 📦 OSS配布

```bash
# OSS用ビルド
pnpm build:oss

# mariaリポジトリへ同期 (自動)
# mainブランチへのpush時に.github/workflows/sync-to-oss.ymlが実行

# 手動同期
gh workflow run sync-to-oss.yml

# npm公開
pnpm publish:oss
```

### 🔄 CI/CDパイプライン

```yaml
# .github/workflows/ci-cd.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm build
```

## トラブルシューティング

### よくある問題と解決方法

#### 1. mariaコマンドが動作しない

```bash
# 権限を確認
chmod +x bin/maria

# パスを確認
which maria

# エイリアスを設定
alias maria='/Users/bongin_max/maria_code/bin/maria'

# ビルドを再実行
pnpm build
```

#### 2. punycode deprecation警告

```bash
# bin/mariaで既に対応済み
# NODE_NO_WARNINGS=1が設定されている
```

#### 3. LM Studioが接続できない

```bash
# LM Studioが起動しているか確認
curl http://localhost:1234/v1/models

# 自動起動スクリプトを使用
./scripts/auto-start-llm.sh start
```

#### 4. TypeScriptエラー

```bash
# 型チェック
pnpm typecheck

# node_modulesを再インストール
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

#### 5. ビルドエラー

```bash
# クリーンビルド
pnpm clean
pnpm build

# Turboキャッシュをクリア
rm -rf .turbo
pnpm build
```

## 📚 追加ドキュメント

- [CLAUDE.md](./CLAUDE.md) - AI開発ガイド
- [CONTRIBUTING.md](./CONTRIBUTING.md) - コントリビューションガイド
- [SECURITY.md](./SECURITY.md) - セキュリティポリシー
- [CHANGELOG.md](./CHANGELOG.md) - 変更履歴

## 🔐 セキュリティ

### 環境変数管理

```bash
# 必須環境変数
OPENAI_API_KEY=            # OpenAI APIキー
ANTHROPIC_API_KEY=          # Anthropic APIキー
GOOGLE_AI_API_KEY=          # Google AI APIキー
GROQ_API_KEY=              # Groq APIキー

# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=

# Neo4j
NEO4J_URI=
NEO4J_USER=
NEO4J_PASSWORD=
NEO4J_BLOOM_JWT_SECRET=

# GCP
MARIA_PROJECT_ID=maria-code
VERTEX_TOKEN=
```

### アクセス制御

- GitHub Branch Protection設定済み
- CODEOWNERS設定済み
- 2段階認証必須
- 署名付きコミット推奨

## 📞 サポート

### 社内連絡先

- **開発チーム**: dev@bonginkan.ai
- **インフラチーム**: infra@bonginkan.ai
- **セキュリティチーム**: security@bonginkan.ai

### 緊急時対応

1. **システム障害**: PagerDutyアラート
2. **セキュリティインシデント**: security@bonginkan.ai
3. **データ損失**: バックアップからの復旧手順書参照

## 📈 メトリクス・モニタリング

### ダッシュボード

- **Grafana**: https://grafana.bonginkan.ai/maria
- **Sentry**: https://sentry.bonginkan.ai/maria
- **CloudWatch**: AWS Console

### 主要メトリクス

- API応答時間: < 200ms (p95)
- CLI起動時間: < 2秒
- AI生成時間: < 10秒 (コード生成)
- エラー率: < 0.1%

## 🎯 今後のロードマップ

### Phase 6 (2025 Q1)
- [ ] VSCode Extension開発
- [ ] JetBrains IDE統合
- [ ] GitHub Copilot競合機能

### Phase 7 (2025 Q2)
- [ ] エンタープライズ機能
- [ ] オンプレミス対応
- [ ] SAML/SSO統合

### Phase 8 (2025 Q3)
- [ ] マルチテナント対応
- [ ] API Rate Limiting強化
- [ ] 監査ログ機能

---

**MARIA Platform** - AI-Powered Development Platform  
© 2025 Bonginkan Inc. All rights reserved.  
Internal Use Only - Proprietary and Confidential