# SOW: LM Studio自動起動機能

## 概要
MARIA CODE CLI起動時にLM Studioを自動的に起動し、ローカルAIモデルをシームレスに利用可能にする機能を実装します。

## 背景
現在、MARIA CODE起動時に以下のエラーメッセージが表示されます：
- "LM Studio server not reachable"
- "Ollama server not reachable"
- "vLLM server not reachable"

ユーザーは手動でLM Studioを起動する必要があり、開発フローに摩擦が生じています。

## ビジネス価値
- **開発者体験の向上**: 手動起動の手間を削減
- **即座の利用可能性**: CLIとローカルAIの統合体験
- **エラー削減**: 接続エラーによる混乱を防止
- **生産性向上**: セットアップ時間を5分から10秒に短縮

## 技術仕様

### 1. 起動検出システム
```typescript
interface LMStudioManager {
  isRunning(): Promise<boolean>;
  start(): Promise<void>;
  waitForReady(): Promise<void>;
  loadModel(modelName: string): Promise<void>;
  getStatus(): Promise<LMStudioStatus>;
}
```

### 2. 実装内容

#### Phase 1: 基本自動起動（1週間）
- LM Studio実行ファイルパスの自動検出
- プロセス起動とヘルスチェック
- リトライロジック実装
- エラーハンドリング

#### Phase 2: インテリジェント管理（1週間）
- モデル自動ロード
- リソース使用量監視
- 起動オプション設定
- 優雅なシャットダウン

#### Phase 3: 高度な統合（1週間）
- 複数モデルの事前ロード
- コンテキストに応じたモデル選択
- パフォーマンス最適化
- ユーザー設定の永続化

### 3. ファイル構造
```
src/services/
├── lmstudio-manager.ts      # メイン管理クラス
├── lmstudio-detector.ts     # パス検出ロジック
├── lmstudio-health.ts       # ヘルスチェック
└── lmstudio-config.ts       # 設定管理

src/hooks/
└── use-lmstudio.ts          # React Hook

scripts/
├── setup-lmstudio.sh        # セットアップスクリプト
└── verify-lmstudio.sh       # 検証スクリプト
```

### 4. 設定ファイル
```toml
# .maria-code.toml
[lmstudio]
enabled = true
auto_start = true
startup_timeout = 30000
health_check_interval = 5000
default_model = "gpt-oss-20b"
context_length = 32768

[lmstudio.paths]
mac = "/Applications/LM Studio.app/Contents/MacOS/LM Studio"
windows = "C:\\Program Files\\LM Studio\\LM Studio.exe"
linux = "/opt/lmstudio/lmstudio"

[lmstudio.models]
preload = ["gpt-oss-20b", "mistral-7b-v0.3"]
max_concurrent = 2
```

### 5. 実装例

```typescript
// src/services/lmstudio-manager.ts
import { spawn, ChildProcess } from 'child_process';
import { existsSync } from 'fs';
import axios from 'axios';

export class LMStudioManager {
  private process: ChildProcess | null = null;
  private config: LMStudioConfig;
  private retryCount = 0;
  private maxRetries = 3;
  
  constructor(config: LMStudioConfig) {
    this.config = config;
  }
  
  async start(): Promise<void> {
    if (await this.isRunning()) {
      console.log('✅ LM Studio is already running');
      return;
    }
    
    const execPath = this.detectExecutablePath();
    if (!execPath) {
      throw new Error('LM Studio executable not found');
    }
    
    console.log('🚀 Starting LM Studio...');
    
    this.process = spawn(execPath, ['--headless'], {
      detached: true,
      stdio: 'ignore'
    });
    
    await this.waitForReady();
    await this.loadDefaultModel();
    
    console.log('✨ LM Studio is ready!');
  }
  
  private async isRunning(): Promise<boolean> {
    try {
      const response = await axios.get('http://localhost:1234/v1/models', {
        timeout: 1000
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }
  
  private async waitForReady(): Promise<void> {
    const startTime = Date.now();
    const timeout = this.config.startupTimeout || 30000;
    
    while (Date.now() - startTime < timeout) {
      if (await this.isRunning()) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    throw new Error('LM Studio startup timeout');
  }
  
  private detectExecutablePath(): string | null {
    const platform = process.platform;
    const paths = this.config.paths;
    
    let execPath: string | null = null;
    
    switch (platform) {
      case 'darwin':
        execPath = paths.mac;
        break;
      case 'win32':
        execPath = paths.windows;
        break;
      case 'linux':
        execPath = paths.linux;
        break;
    }
    
    if (execPath && existsSync(execPath)) {
      return execPath;
    }
    
    // Fallback: 環境変数やPATHから検索
    return this.searchInPath();
  }
  
  async loadDefaultModel(): Promise<void> {
    const modelName = this.config.defaultModel;
    if (!modelName) return;
    
    try {
      await axios.post('http://localhost:1234/v1/models/load', {
        model: modelName,
        context_length: this.config.contextLength || 32768
      });
    } catch (error) {
      console.warn(`Failed to load default model: ${modelName}`);
    }
  }
}
```

### 6. CLIへの統合

```typescript
// src/cli.ts への追加
import { LMStudioManager } from './services/lmstudio-manager';

class MariaCLI {
  private lmStudioManager: LMStudioManager;
  
  async initialize() {
    // 既存の初期化コード...
    
    // LM Studio自動起動
    if (this.config.lmstudio?.enabled && this.config.lmstudio?.auto_start) {
      try {
        this.lmStudioManager = new LMStudioManager(this.config.lmstudio);
        await this.lmStudioManager.start();
      } catch (error) {
        console.warn('LM Studio auto-start failed:', error.message);
        // 失敗してもCLIは続行
      }
    }
    
    // 残りの初期化...
  }
}
```

## ユーザー体験

### Before（現在）
```bash
$ maria
> LM Studio server not reachable  # エラー
> Ollama server not reachable      # エラー
> vLLM server not reachable        # エラー
> # ユーザーが手動でLM Studioを起動する必要がある
```

### After（実装後）
```bash
$ maria
🚀 Starting LM Studio...
⏳ Loading model: gpt-oss-20b (32K context)...
✨ LM Studio is ready!

╔═══════════════════════════════════════════════╗
║  MARIA CODE - Local AI Ready                 ║
╚═══════════════════════════════════════════════╝

> # すぐに使用可能
```

## 実装スケジュール

| フェーズ | 期間 | 内容 | 成果物 |
|---------|------|------|--------|
| Phase 1 | 1週間 | 基本自動起動 | - 自動起動機能<br>- ヘルスチェック<br>- エラーハンドリング |
| Phase 2 | 1週間 | インテリジェント管理 | - モデル自動ロード<br>- リソース監視<br>- 設定管理 |
| Phase 3 | 1週間 | 高度な統合 | - マルチモデル対応<br>- パフォーマンス最適化<br>- ユーザー設定 |

## 投資とROI

### コスト
- 開発工数: 3週間 × $5,000/週 = $15,000
- テスト・QA: $3,000
- ドキュメント: $2,000
- **合計: $20,000**

### リターン
- 開発者時間節約: 5分/日 × 1000ユーザー × 250日 = 20,833時間/年
- 金銭価値: 20,833時間 × $50/時間 = $1,041,650/年
- **ROI: 5,208%**

## リスクと対策

| リスク | 影響度 | 対策 |
|--------|--------|------|
| LM Studioの更新による互換性問題 | 中 | バージョン検出とフォールバック |
| 起動失敗によるCLIブロック | 高 | タイムアウトと手動モード |
| リソース消費 | 中 | オプトイン設定と監視 |
| プラットフォーム差異 | 低 | 各OSでのテスト自動化 |

## 成功指標

- ✅ 起動成功率 > 95%
- ✅ 平均起動時間 < 10秒
- ✅ ユーザー満足度 > 90%
- ✅ エラー報告 < 1%
- ✅ 手動介入必要性 < 5%

## まとめ

LM Studio自動起動機能により、MARIA CODEはより統合された開発体験を提供します。ローカルAIとクラウドAIのハイブリッド利用が自然に行え、開発者の生産性が大幅に向上します。

3週間の投資で、年間100万ドル以上の価値を生み出す、極めて高ROIな機能改善です。