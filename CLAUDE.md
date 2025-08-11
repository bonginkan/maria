# CLAUDE.md - AI開発ガイド & Claude Code統合仕様

> このファイルは、Claude Code (claude.ai/code) がこのリポジトリで作業する際のガイダンスを提供します。
> また、社内開発者向けの完全な技術仕様書としても機能します。

## 🏗️ リポジトリステータス

**MARIA PLATFORM** - AI駆動開発プラットフォーム (100% TypeScript, pnpm monorepo)
- **Web**: MARIA STUDIO (Next.js 15 + React 19 RC)
- **CLI**: MARIA CODE (Advanced AGI by Bonginkan Inc.)
- **Backend**: Vertex AI + Graph RAG + Self-Refine

### 🎉 v1.0.5 NPM公開完了！世界中で利用可能に！✨

**MARIA CLI** が npm パッケージとして正式公開されました：

#### 🌍 インストール方法
```bash
# npmからクリーンインストール
npm install -g @bonginkan/maria
# Result: added 3 packages in 159ms (警告ゼロ！)

# 動作確認
maria --version
# Result: 🚀 MARIA CODE CLI - Command Mode

# 使用開始
maria chat    # インタラクティブモード
mc chat      # エイリアスも使用可能
```

#### 📦 Package Quality Achievements
- ✅ **NPM公開済み**: https://www.npmjs.com/package/@bonginkan/maria
- ✅ **依存関係の大幅最適化**: 30個 → 2個 (chalk, commander のみ)
- ✅ **非推奨パッケージ完全除去**: lodash.isequal, node-domexception 削除
- ✅ **ビルドサイズ最適化**: 20.1KB unpackedSize
- ✅ **警告ゼロ**: 非推奨警告・セキュリティ問題なし
- ✅ **インストール高速**: 159ms でインストール完了
- ✅ **Node.js v22互換性**: 全Node.jsバージョン対応

#### 🚀 Distribution Details
- **Package Name**: `@bonginkan/maria`
- **Latest Version**: 1.0.5
- **Registry**: https://registry.npmjs.org/@bonginkan/maria
- **Total Versions**: 8 (alpha版含む)
- **Publisher**: bongin <t@bonginkan.ai>

#### 📈 バージョン管理

##### ⚠️ 重要: NPM_TOKENの設定（必須）

npm publishを実行するためには、事前にNPM_TOKENをGitHub Secretsに設定する必要があります。

**NPM_TOKEN設定手順:**
```bash
# 1. npm.comでトークンを生成
1. https://www.npmjs.com にログイン
2. アカウントメニュー → Access Tokens
3. "Generate New Token" → "Classic Token"
4. Type: "Automation" を選択
5. トークンをコピー

# 2. GitHubリポジトリに追加
1. https://github.com/bonginkan/maria_code/settings/secrets/actions
2. "New repository secret" をクリック
3. Name: NPM_TOKEN
4. Secret: [コピーしたnpmトークン]
5. "Add secret" をクリック
```

**OSS_SYNC_TOKEN設定手順（OSS同期用）:**
```bash
# GitHub Personal Access Token を生成
1. https://github.com/settings/tokens/new
2. Note: "OSS Sync Token"
3. Expiration: 90 days (または適切な期間)
4. Scopes: ✅ repo (full control)
5. "Generate token" をクリック
6. トークンをコピー

# GitHubリポジトリに追加
1. https://github.com/bonginkan/maria_code/settings/secrets/actions
2. "New repository secret" をクリック
3. Name: OSS_SYNC_TOKEN
4. Secret: [コピーしたGitHubトークン]
5. "Add secret" をクリック
```

**設定確認:**
```bash
# Secretsが追加されたか確認
gh secret list --repo bonginkan/maria_code

# ワークフローを再実行
gh workflow run ci-cd.yml --ref main
gh workflow run sync-to-oss.yml --ref main
```

**バージョン更新とリリース:**
```bash
# パッチバージョン更新（1.0.5 → 1.0.6）
npm version patch
npm publish --otp=YOUR_OTP

# マイナーバージョン更新（1.0.5 → 1.1.0）
npm version minor
npm publish --otp=YOUR_OTP

# メジャーバージョン更新（1.0.5 → 2.0.0）
npm version major
npm publish --otp=YOUR_OTP
```

### リポジトリ構成
- **開発用 (Private)**: https://github.com/bonginkan/maria_code (全コード、このリポジトリ)
- **OSS配布用 (Public)**: https://github.com/bonginkan/maria (エンドユーザー向け)
- **ランディングページ**: https://maria-code.vercel.app (maria-code-lp/)

### 🌐 ランディングページ詳細
- **ローカル起動**: `cd maria-code-lp && pnpm run dev`
- **アクセス**: http://localhost:3000
- **技術スタック**: Next.js 14, TypeScript, Tailwind CSS
- **デザイン**: ダークモード、Google Material Icons、シンプルで洗練されたUI
- **自動デプロイ**: Vercel (mainブランチプッシュで自動更新)

## 🤖 MARIA CODE - AGI開発アシスタント

Bonginkan Inc.が開発する先進的なAGI (Artificial General Intelligence) です。

### 🧠 インタラクティブルーターシステム

#### コア機能
- **意図理解**: 自然言語から開発者の意図を解析
- **自動ルーティング**: 最適なコマンドとワークフローへマッピング
- **コンテキスト認識**: 会話履歴とプロジェクト状態を活用した意思決定
- **マルチステップ実行**: 複雑なタスクを実行可能なステップに分解
- **インタラプト機能**: AI処理中でも新しい指示を優先的に処理
#### インタラプト機能 ✨ NEW
AIが回答中でも、ユーザーは新たな指示を入力できます。処理中の作業を瞬時に中断し、新しい指示に対応します。

**動作仕様:**
- 処理中に新しい入力があると現在の処理を即座に中断
- 矛盾する指示の場合: 新しい指示を優先
- 追加情報の場合: 既存の処理に統合
- キーワード検出で自動判定 (「また」「さらに」「and」「also」など)

**実装内容:**
1. **処理中断メカニズム**
   - `isProcessing`フラグで処理状態を管理
   - `processingTimeout`で非同期処理を制御
   - 新しい入力で`interruptProcessing()`を呼び出し

2. **優先順位判定ロジック**
   - 追加情報キーワード検出（「また」「さらに」「and」「also」など）
   - 矛盾する場合は新しい指示を優先
   - 追加情報は既存処理に統合

3. **ユーザーフィードバック**
   - `[Interrupted - Processing new request]`
   - `[Overriding previous request]` または `[Treating as additional information]`

4. **技術詳細**
   - Ctrl+C対応: 処理中のみ中断、それ以外は終了確認
   - タイムアウト管理: clearTimeoutで確実にクリーンアップ
   - コンテキスト管理: systemロールでAIに優先順位を伝達
   - 言語対応: 日本語・英語両方のキーワードに対応

**使用例:**
```bash
# 基本的な使い方
> Create a REST API
Thinking...
> Actually, make it GraphQL  # 処理中に新しい指示

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

**内部プロンプト処理:**
```
# 新しい優先指示の場合
"User interrupted with new priority request. Focus on this new request instead."

# 追加情報の場合
"User provided additional information. Incorporate this with the previous request."
```

#### ルーティング例
```typescript
// 自然言語 → コマンド変換
"動画を作って" → 内部で /video を自動実行
"画像を生成" → 内部で /image を自動実行
"このバグを修正" → 内部で /code fix を自動実行
"テスト書いて" → 内部で /test を自動実行
"レビューして" → 内部で /review を自動実行
"新しいAPIを作成" → 内部で /code "REST API" を自動実行
"ユーザー管理のREST API" → 内部で /code "REST API with CRUD operations" を自動実行
```

#### ✅ 全Phase実装完了！

##### 📂 実装済みモジュール

**Phase 1**: 内部スラッシュコマンド自動起動 [Critical] ✅
- `intent-classifier.ts` - 自然言語→コマンド変換エンジン
- `command-dispatcher.ts` - 内部コマンド実行制御
- `context-manager.ts` - 会話履歴とプロジェクト状態管理

**Phase 2**: インタラプト&リアルタイム処理 [High] ✅
- `interrupt-handler.ts` - 処理中断と優先度制御
- `priority-queue.ts` - タスクキューと並列実行管理
- `stream-processor.ts` - ストリーミングレスポンス処理

**Phase 3**: アダプティブラーニング [Medium] ✅
- `learning-engine.ts` - ユーザーの使用パターンを学習し最適化

**Phase 4**: マルチモーダル対応 [Medium] ✅
- `multimodal-handler.ts` - 音声・画像・ジェスチャー入力対応

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

**Phase 3: 学習エンジン機能:** ✅
- 使用パターン記録とコマンド成功率追跡
- 頻発エラーの検出と修正提案
- 生産性の高い時間帯を特定
- コンテキストから次のコマンドを予測
- 使用頻度に基づく自動補完強化
- 実行時間の長いコマンドを検出し最適化

**Phase 4: マルチモーダル機能:** ✅
- 🎤 音声入力: ウェイクワード検出、音声→テキスト変換
- 📸 画像解析: スクリーンショット、スケッチ、フローチャート→コード生成
- 📁 ドラッグ&ドロップ: ファイルタイプ自動検出とバッチ処理
- 👆 ジェスチャー認識: スワイプ、ピンチ、タップをコマンドに変換
- 🎨 UIモックアップ→React: 画像からコンポーネント自動生成

**Phase 5-9**: 今後の実装予定
- Phase 5: コラボレーション機能
- Phase 6: パフォーマンス最適化
- Phase 7: セキュリティ&プライバシー
- Phase 8: ゲーミフィケーション
- Phase 9: 次世代機能（BCI、AR/VR、量子コンピューティング）

### 🎨 Phase 14: 革新的CLI UI/UX改善 - ターミナル体験の再発明 ✨ NEW

#### 🌟 プロレベルのCLI UI/UX設計

**1. モダン入力エクスペリエンス**
- 白枠の視覚的入力フィールド（背景: #1a1a1a, 枠線: #404040）
- Enterキー押下時の明確な表示
- リアルタイムライブプレビュー
- インテリジェント候補表示
- 音声入力サポート

**2. フルスクリーン最適化**
- 左右マージン最小化（5px以下）
- ターミナル幅98%活用
- レスポンシブ対応
- 動的幅調整

**3. インテリジェント・リアクション**
- コンテキスト認識型フィードバック
- エラー予測・リアルタイム警告
- 感情的インテリジェンス（疲労度、励まし）
- 処理時間推定表示

**4. ビジュアルエンハンスメント**
- 体系的カラーコーディング（Tailwind CSS準拠）
- アイコン・エモジ活用
- マイクロインタラクション
- 60fps維持のパフォーマンス

#### 🎨 具体的UI改善例

**Before/After比較:**
1. **入力フィールドのモダン化** - 従来のシンプル入力→視覚的に美しい白枠フィールド
2. **コマンド候補の視覚化** - テキストのみ→アイコン付きカラフル候補
3. **処理状況の詳細表示** - 単純な"Thinking..."→プログレスバー+ETA表示
4. **エラー表示の大幅改善** - 基本的なエラー→場所特定、修正提案、自動修正オプション
5. **成功フィードバックの強化** - 基本的な完了→ファイル詳細、次のステップ、品質スコア

#### 💼 包括的な実装SOW

**4週間のスプリント計画:**
- **Sprint 1**: 基礎UI改善（$8,000）
- **Sprint 2**: インテリジェント・リアクション（$12,000）
- **Sprint 3**: ビジュアル強化（$10,000）
- **Sprint 4**: 最適化・統合（$9,000）

**総投資**: $54,000  
**ROI**: 18日で回収（月間+$95,000の収益向上）

#### 🏆 世界最高級のCLI体験

**競合優位性:**
- GitHub CLI, Vercel CLI, AWS CLIを大きく上回る体験
- エンタープライズUI品質（コンシューマーアプリレベル）
- AI駆動の感情認識
- アクセシビリティAA準拠
- 画面使用効率85%以上

**期待効果:**
- ユーザー満足度 +300%向上
- コマンド発見時間 70%短縮
- 新規ユーザー定着率 80%改善
- エラー理解度 150%向上

#### 🌟 「これがMARIA CODEを選ぶ理由」

この包括的なSOWにより、MARIAは：
1. ハリウッド映画レベルのCLI体験を提供
2. 5分で基本操作マスター可能な学習性
3. 先読みAIによる思考支援
4. エラー時も挫折しない回復力
5. プロが認める品質の出力

ユーザーが「やっぱりMARIA CODEじゃないとダメ」と心から納得する、他では味わえない極上のCLI体験を実現します。
### 📚 ベースナレッジシステム

#### 知識管理機能
- **プロジェクト理解**: コードベース構造、依存関係、パターンを学習
- **セマンティック検索**: コードとドキュメントに対する自然言語クエリ
- **パターンメモリー**: 一般的なコードパターンの認識と提案
- **永続学習**: セッション間で知識を.maria-memory.mdに保持

### 📋 MARIA.md - AI開発設計書

`/init`コマンドで生成される、プロジェクトのAI開発設計書です。Claude CodeのCLAUDE.mdと同様の役割を果たします。

#### MARIA.mdの特徴
- **自動生成**: コードベース全体を解析して自動生成
- **配置場所**: プロジェクトルートディレクトリ
- **内容**: 
  - プロジェクトの目的と概要
  - アーキテクチャ設計
  - 開発指針とベストプラクティス
  - SOW (Statement of Work)
  - 技術スタック詳細
  - API仕様
  - データベース設計
  - テスト戦略
  - デプロイメント手順

#### MARIA.md生成プロセス
1. コードベース全体をスキャン
2. ファイル構造、依存関係、パターンを解析
3. README、package.json、設定ファイルから情報抽出
4. AIがプロジェクトの意図を理解
5. 包括的な開発設計書を生成

#### MARIA.mdの活用方法
- 新規開発者のオンボーディング
- AIアシスタントへのコンテキスト提供
- プロジェクトの技術的判断基準
- コードレビューの基準書

#### 知識ファイル構造
```
~/.maria/
├── memory/
│   ├── .maria-memory.md      # 永続的な学習データ
│   ├── patterns.json         # コードパターン
│   └── context/              # セッションコンテキスト
├── config/
│   ├── .maria-code.toml      # プロジェクト設定
│   └── providers.json        # AIプロバイダー設定
└── cache/                    # 一時キャッシュ
```

### 🔄 AIモデル設定 - August 2025 Latest ✨

#### クラウドモデル (22+ Models)
```typescript
const cloudModels = {
  openai: {
    'gpt-5': { 
      context: 256000, 
      use: '🔥 最新フラッグシップモデル - 最高性能',
      cost: '$0.015/1K tokens',
      bestFor: ['最高品質コード生成', '複雑な問題解決', '創作']
    },
    'gpt-5-mini': { 
      context: 128000, 
      use: '軽量・高速版 - 日常タスク最適',
      cost: '$0.005/1K tokens',
      bestFor: ['高速処理', 'チャット', '簡単なコード']
    },
    'o3': { 
      context: 128000, 
      use: '🧠 推論特化モデル - 論理的思考',
      cost: '$0.02/1K tokens',
      bestFor: ['数学', '論理推論', 'アルゴリズム設計']
    }
  },
  anthropic: {
    'claude-opus-4.1': { 
      context: 200000, 
      use: '🎯 最新Claude - 長文処理・創作',
      cost: '$0.02/1K tokens',
      bestFor: ['長文ドキュメント', '創作', '複雑分析']
    },
    'claude-4-sonnet': { 
      context: 200000, 
      use: '⚡ コーディング特化 - バランス型',
      cost: '$0.008/1K tokens',
      bestFor: ['コード生成', 'レビュー', '技術文書']
    }
  },
  google: {
    'gemini-2.5-pro': { 
      context: 1000000, 
      use: '🚀 推論強化・マルチモーダル',
      cost: '$0.002/1K tokens',
      bestFor: ['画像・動画分析', '大量データ処理', '研究']
    },
    'gemini-2.5-flash': { 
      context: 1000000, 
      use: '⚡ 適応思考・費用対効果',
      cost: '$0.001/1K tokens',
      bestFor: ['リアルタイム処理', '高頻度タスク']
    },
    'gemini-2.5-flash-lite': { 
      context: 1000000, 
      use: '💨 高スループット・最速処理',
      cost: '$0.0005/1K tokens',
      bestFor: ['大量バッチ処理', '超高速応答']
    }
  },
  xai: {
    'grok-4': { 
      context: 128000, 
      use: '🤖 リアルタイムWeb情報統合',
      cost: '$0.01/1K tokens',
      bestFor: ['最新情報', 'Web検索連携', 'ニュース分析']
    }
  },
  groq: {
    'llama-3.1-70b': { 
      context: 128000, 
      use: '🦙 超高速推論・オープンソース',
      cost: '$0.002/1K tokens',
      bestFor: ['高速処理', 'リアルタイム推論', 'コスト効率']
    },
    'mixtral-8x22b': { 
      context: 64000, 
      use: '🇫🇷 高速ヨーロッパAI・多言語対応',
      cost: '$0.003/1K tokens',
      bestFor: ['多言語処理', '高速推論', '文化的理解']
    }
  }
}
```

#### ローカルモデル (LM Studio) - 全て32Kコンテキスト設定済み
```typescript
const localModels = {
  lmstudio: {
    'gpt-oss-120b': { 
      context: 32768, 
      vram: '~63.39GB', 
      use: '🏆 最大級ローカルモデル - MXFP4精度',
      performance: 'M3 Ultra: ~5 tokens/sec'
    },
    'gpt-oss-20b': { 
      context: 32768, 
      vram: '~12.11GB', 
      use: '🚀 高速ローカルモデル - MXFP4精度',
      performance: 'M3 Pro: ~15 tokens/sec'
    },
    'qwen-3-moe-30b': { 
      context: 32768, 
      vram: '~18.56GB', 
      use: '🧠 MoE効率モデル - Q4_K_M',
      performance: 'M3 Max: ~12 tokens/sec'
    },
    'mistral-7b-v0.3': { 
      context: 32768, 
      vram: '~4.37GB', 
      use: '⚡ 超高速推論 - Q4_K_M',
      performance: 'M3: ~40 tokens/sec'
    }
  },
  ollama: {
    'qwen2.5-vl': { 
      context: 8192, 
      vram: '~8GB', 
      use: '📸 ビジョンタスク特化 - 画像理解',
      performance: 'M3 Pro: ~15 tokens/sec'
    }
  }
}
```

### 🚀 高度な機能

#### 動作モード
- **Auto Mode**: 自然言語 → 自動コマンド実行
- **Mission Mode**: 最小限の監督で自律的にタスク完了
- **Learning Mode**: コーディングスタイルと好みに適応
- **Collaboration Mode**: リアルタイムで協働作業

#### インテリジェント機能
- **自動エラー修正**: TypeScript/ESLintエラーを自動検出・修正
- **テスト自動生成**: コード変更に基づいてテストを生成
- **PR自動作成**: コミット、プッシュ、PR作成まで自動化
- **依存関係管理**: package.jsonの自動更新

## 📦 完全なプロジェクト構造

```
maria_code/
├── 📁 src/                        # MARIA CODE CLIソースコード
│   ├── bin/                       # CLIエントリポイント
│   │   └── maria.ts              # メインエントリ
│   ├── cli.ts                    # CLIコアロジック
│   ├── commands/                 # コマンド実装 (40+)
│   │   ├── chat.ts              # インタラクティブチャット
│   │   ├── code.tsx             # AIコード生成
│   │   ├── vision.tsx           # 画像解析
│   │   ├── review.tsx           # コードレビュー
│   │   ├── test.ts              # テスト生成
│   │   ├── commit.ts            # AIコミット
│   │   ├── video.tsx            # 動画生成 (Wan 2.2)
│   │   ├── image.tsx            # 画像生成 (Qwen)
│   │   ├── init.ts              # プロジェクト初期化
│   │   ├── deploy.ts            # デプロイ管理
│   │   └── [30+ more commands]
│   ├── components/               # React/Inkコンポーネント
│   │   ├── App.tsx              # メインアプリ
│   │   ├── ChatInterface.tsx    # チャットUI
│   │   ├── CommandInput.tsx     # コマンド入力
│   │   ├── ModelSelector.tsx    # モデル選択
│   │   └── [20+ components]
│   ├── providers/               # AIプロバイダー実装
│   │   ├── base-provider.ts    # 基底クラス
│   │   ├── openai-provider.ts
│   │   ├── anthropic-provider.ts
│   │   ├── google-provider.ts
│   │   ├── groq-provider.ts
│   │   ├── lmstudio-provider.ts
│   │   ├── ollama-provider.ts
│   │   └── vllm-provider.ts
│   ├── services/                # ビジネスロジック
│   │   ├── ai-router.ts        # AIモデル選択ロジック
│   │   ├── slash-command-handler.ts # /コマンド処理
│   │   ├── chat-context.service.ts  # コンテキスト管理
│   │   ├── interactive-session.ts   # セッション管理
│   │   ├── intelligent-router.ts    # 自然言語ルーティング
│   │   ├── auto-mode-controller.ts  # 自動実行
│   │   ├── hotkey-manager.ts        # ホットキー
│   │   └── [30+ services]
│   └── utils/                   # ユーティリティ
│       ├── logger.ts           # ロギング
│       ├── config.ts           # 設定管理
│       └── ui.ts               # UI ヘルパー
│
├── 📁 dist/                      # ビルド済みファイル
│   ├── cli.js                   # バンドル済みCLI
│   ├── index.js                 # エクスポート
│   └── [map files]
│
├── 📁 bin/                       # 実行可能ファイル
│   └── maria                    # シェルスクリプト
│
├── 📁 packages/                  # pnpmワークスペース
│   ├── studio-app/              # MARIA STUDIO
│   │   ├── app/                # Next.js App Router
│   │   ├── components/         # UIコンポーネント
│   │   └── lib/                # ライブラリ
│   ├── core-api/               # tRPC APIサーバー
│   │   ├── routers/           # 7 routers
│   │   └── services/          # ビジネスロジック
│   ├── ai-agents/             # AIエージェント
│   ├── dataflow-jobs/         # バッチ処理
│   └── shared/                # 共有ライブラリ
│
├── 📁 maria-code-lp/            # ランディングページ
├── 📁 maria-oss/                # OSS配布パッケージ
├── 📁 infra/                    # インフラ定義
├── 📁 scripts/                  # 開発スクリプト
└── 📁 .github/                  # GitHub設定
```

## 🛠️ 開発環境セットアップ

### 必要要件
```yaml
Runtime:
  - Node.js: 18.0.0+
  - pnpm: 10.14.0+
  - Git: 2.30+

Optional:
  - Docker: 20.10+
  - LM Studio: Latest
  - ComfyUI: For video generation
  
Cloud Accounts:
  - GCP Project
  - Firebase Project
  - OpenAI/Anthropic/Google API keys
```

### 初期セットアップ手順

```bash
# 1. リポジトリクローン
git clone https://github.com/bonginkan/maria_code.git
cd maria_code

# 2. 依存関係インストール
pnpm install

# 3. 環境変数設定
cp .env.example .env.local
# 必須の環境変数を設定

# 4. ビルド
pnpm build

# 5. グローバルインストール (開発用)
npm link

# 6. 動作確認
maria --version
maria chat
```

## 🎯 開発コマンド完全リファレンス

### 基本開発コマンド
```bash
# 開発サーバー
pnpm dev              # 全サービス起動
pnpm dev:studio       # Studio + API
pnpm dev:api         # APIのみ
pnpm dev:cli         # CLIウォッチモード

# ビルド
pnpm build           # 全パッケージ
pnpm build:studio    # Studioのみ
pnpm build:cli       # CLIのみ
pnpm build:oss       # OSS配布用

# テスト
pnpm test            # 全テスト
pnpm test:coverage   # カバレッジ付き
pnpm test:cli        # CLIテスト
pnpm test:cli:all    # 全38コマンドテスト
pnpm test:e2e        # E2Eテスト

# コード品質
pnpm lint            # ESLint
pnpm lint:fix        # 自動修正
pnpm typecheck       # TypeScript
pnpm format          # Prettier
pnpm contract:all    # 契約検証
```

### MARIA CLIコマンド (40+)

#### 基本コマンド
```bash
maria init                    # プロジェクト初期化
maria chat                    # インタラクティブモード
maria code "prompt"           # コード生成
maria vision image.png        # 画像解析
maria review                  # コードレビュー
maria test                    # テスト生成
maria commit                  # AIコミット
maria deploy                  # デプロイ
maria graph                   # グラフ表示
```

#### メディア生成
```bash
# 動画生成 (Wan 2.2)
maria video "赤いスポーツカー" --model wan22-14b
maria video "ズームアウト" --input-image photo.jpg

# 画像生成 (Qwen-Image)
maria image "未来都市" --style photorealistic
maria image "ロゴデザイン" --batch 4
```

#### インタラクティブモード - スラッシュコマンド (40コマンド)

**MARIAの最大の特徴**: `maria`で即座にインタラクティブチャット開始、すべての機能がスラッシュコマンドで操作可能

##### コア機能 (2)
```bash
/code               # AIコード生成
/test               # テスト生成・実行
```

##### ユーザー管理 (5)
```bash
/login              # サインイン
/logout             # サインアウト
/status             # ステータス表示
/mode               # モード切替
/upgrade            # プランアップグレード
```

##### 設定・環境 (6)
```bash
/config             # 設定パネル
/model              # モデル選択
/permissions        # 権限管理
/hooks              # フック設定
/doctor             # システム診断
/terminal-setup     # ターミナル設定
```

##### プロジェクト管理 (4)
```bash
/init               # MARIA.md生成 - AI開発設計書作成
/add-dir            # ディレクトリ追加
/memory             # メモリ編集
/export             # エクスポート
```

##### エージェント・統合 (2)
```bash
/agents             # エージェント管理
/mcp                # MCPサーバー管理
```

##### 会話・コスト (4)
```bash
/clear              # コンテキストクリア - 会話をリセット
/compact            # 要約
/resume             # 再開
/cost               # コスト表示
```

##### 開発支援 (4)
```bash
/review             # PRレビュー
/pr-comments        # PRコメント取得
/bug                # バグ報告
/release-notes      # リリースノート
```

##### UI切替 (3)
```bash
/vim                # Vimモード
/help               # ヘルプ
/exit               # 終了
```

##### インフラ移行 (1)
```bash
/migrate-installer  # インストール方法移行
```

##### メディア生成 (2)
```bash
/video              # AI動画生成
/image              # AI画像生成
```

##### バージョン管理 (1)
```bash
/version            # バージョン情報
```

##### その他隠しコマンド (6+)
```bash
/hotkey             # ホットキー管理
/alias              # エイリアス設定
/template           # テンプレート管理
/workflow           # ワークフロー実行
/batch              # バッチ処理
/debug              # デバッグモード
```

## 🔧 技術スタック詳細

### Runtime & Build
- **Node.js**: 20 LTS
- **TypeScript**: 5.3.3
- **tsup**: バンドラー
- **Turbo**: モノレポビルド

### Frontend (MARIA STUDIO)
- **Next.js**: 15.4 (App Router)
- **React**: 19 RC
- **Tailwind CSS**: 3.4
- **shadcn/ui**: UIコンポーネント
- **Zustand**: 状態管理
- **React Query**: データフェッチング

### CLI (MARIA CODE)
- **Ink**: 4.4 (React for CLI)
- **Commander**: CLIフレームワーク
- **Chalk**: 色付き出力
- **Figlet**: ASCIIアート

### Backend
- **tRPC**: 型安全API
- **Firebase**: 認証・Firestore
- **Neo4j**: グラフDB
- **Spanner**: バージョン管理

### AI Integration
- **OpenAI SDK**: GPT-4統合
- **Anthropic SDK**: Claude統合
- **Google AI SDK**: Gemini統合
- **Groq SDK**: 高速推論
- **LangChain**: エージェント

### Infrastructure
- **GCP**: Cloud Run, Vertex AI
- **Terraform**: IaC
- **GitHub Actions**: CI/CD
- **Docker**: コンテナ化

## 🔐 環境変数完全リスト

```bash
# AI Provider Keys (必須)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_AI_API_KEY=AIza...
GROQ_API_KEY=gsk_...

# Firebase (必須)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY=

# Neo4j (必須)
NEO4J_URI=neo4j+s://...
NEO4J_USER=neo4j
NEO4J_PASSWORD=
NEO4J_BLOOM_JWT_SECRET=

# GCP (必須)
MARIA_PROJECT_ID=maria-code
VERTEX_TOKEN=
GOOGLE_APPLICATION_CREDENTIALS=

# Optional - Local Models
LMSTUDIO_API_URL=http://localhost:1234
OLLAMA_API_URL=http://localhost:11434
VLLM_API_URL=http://localhost:8000

# Optional - Media Generation
COMFYUI_API_URL=http://localhost:8188
WAN22_MODEL_PATH=~/.maria/models/wan22-14b
QWEN_IMAGE_PATH=~/.maria/models/qwen-image

# Optional - Development
DEBUG=true
LOG_LEVEL=debug
DISABLE_TELEMETRY=true
```

## 📊 開発メトリクス目標

### パフォーマンス目標
- CLI起動時間: < 2秒
- コマンド実行: < 100ms (ローカル)
- AI生成: < 10秒 (コード生成)
- ビルド時間: < 30秒 (フルビルド)

### 品質目標
- TypeScriptエラー: 0
- ESLint警告: 0
- テストカバレッジ: > 80%
- エラー率: < 0.1%

### スケーラビリティ
- 同時ユーザー: 1000+
- API応答時間: < 200ms (p95)
- データベース接続: < 100 concurrent

## 🚨 トラブルシューティング

### よくある問題と解決方法

#### 1. mariaコマンドが動作しない
```bash
# 解決策
chmod +x bin/maria
alias maria='/path/to/maria_code/bin/maria'
pnpm build && npm link
```

#### 2. TypeScriptエラー
```bash
# 解決策
rm -rf node_modules pnpm-lock.yaml
pnpm install
pnpm typecheck
```

#### 3. LM Studio接続エラー
```bash
# 解決策
curl http://localhost:1234/v1/models
./scripts/auto-start-llm.sh start
```

#### 4. ビルドエラー
```bash
# 解決策
pnpm clean
rm -rf .turbo
pnpm build
```

## 🎯 Claude Code向け特別指示

### コード生成時の規則
1. **常にTypeScriptを使用**
2. **pnpmワークスペースパターンに従う**
3. **既存のコードスタイルを模倣**
4. **エラーハンドリングを必ず実装**
5. **テストを同時に生成**

### ファイル編集時の注意
1. **既存ファイルの編集を優先**
2. **新規ファイル作成は最小限**
3. **importパスは相対パスを使用**
4. **package.jsonの依存関係を確認**

### コミット規則
```bash
# Conventional Commits形式
feat: 新機能追加
fix: バグ修正
docs: ドキュメント更新
style: コードスタイル修正
refactor: リファクタリング
test: テスト追加・修正
chore: ビルド・設定変更
```

## 📈 今後のロードマップ

### Phase 6 (2025 Q1)
- [ ] VSCode Extension
- [ ] JetBrains IDE Plugin
- [ ] GitHub Copilot統合

### Phase 7 (2025 Q2)
- [ ] エンタープライズ機能
- [ ] オンプレミス対応
- [ ] SAML/SSO統合

### Phase 8 (2025 Q3)
- [ ] マルチテナント
- [ ] 監査ログ
- [ ] コンプライアンス機能

### Phase 14 (2025 Q4) - 革新的CLI UI/UX改善
- [x] モダン入力エクスペリエンス設計完了
- [x] フルスクリーン最適化仕様策定
- [x] インテリジェント・リアクション機能設計
- [x] ビジュアルエンハンスメント仕様完成
- [ ] Sprint 1: 基礎UI改善実装（4週間）
- [ ] Sprint 2: インテリジェント・リアクション実装（4週間）
- [ ] Sprint 3: ビジュアル強化実装（4週間）
- [ ] Sprint 4: 最適化・統合（4週間）
- [ ] 世界最高級CLI体験の完成
- [ ] ユーザー満足度300%向上達成
## 📝 重要な注意事項

### してはいけないこと
- ❌ git configの更新
- ❌ 不要なファイル作成
- ❌ プライベート情報のコミット
- ❌ 依存関係の無断追加
- ❌ テストなしのコード追加

### 必ずすること
- ✅ TypeScriptの使用
- ✅ エラーハンドリング
- ✅ テストの作成
- ✅ ドキュメントの更新
- ✅ コードレビューの実施

---

**最終更新**: 2025-08-10  
**管理者**: Bonginkan Inc. Development Team  
**ステータス**: Production Ready 🚀