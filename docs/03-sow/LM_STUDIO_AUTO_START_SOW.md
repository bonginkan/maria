# LM Studio Auto-Start with Progress Bar - Statement of Work (SOW)

## 現在のステータス分析

### 現在の動作

起動時に以下のメッセージが表示される:

```
LM Studio server not reachable
Ollama server not reachable
vLLM server not reachable
```

これらのメッセージは各プロバイダーの初期化時に、サービスが利用できない場合に`console.warn`で出力されています。

### 問題点

1. **ユーザー体験の問題**
   - エラーメッセージのように見える
   - サービスが起動中なのか、利用不可なのか不明確
   - 自動起動の進捗が見えない

2. **技術的な問題**
   - サービスの起動プロセスが非同期で追跡困難
   - 起動の進捗状況が表示されない
   - 成功/失敗の判定が曖昧

## 提案する解決策

### Phase 1: スマートな起動状態表示

#### 1.1 サービス検出と状態表示

```typescript
interface ServiceStatus {
  name: string;
  status: 'checking' | 'starting' | 'running' | 'failed' | 'not-installed';
  progress?: number;
  message?: string;
}
```

#### 1.2 進捗表示の実装

- ASCII プログレスバーで起動進捗を表示
- 各サービスの状態をリアルタイム更新
- 成功/失敗を色分けして表示

### Phase 2: 自動起動機能の強化

#### 2.1 LM Studio 自動起動フロー

1. **検出** - LM Studio のインストール確認
2. **起動** - サーバーの自動起動
3. **待機** - ポート確認とヘルスチェック
4. **モデル読み込み** - 利用可能なモデルの自動ロード
5. **完了通知** - 成功/失敗の明確な表示

#### 2.2 フォールバック戦略

1. LM Studio → Ollama → vLLM の順で試行
2. すべて失敗した場合はクラウドAPIに自動切り替え
3. ユーザーに明確な状態通知

## 実装詳細

### 1. 新しいサービス起動マネージャー (src/services/llm-startup-manager.ts)

```typescript
export class LLMStartupManager {
  private services: ServiceStatus[] = [];

  async initializeServices(): Promise<void> {
    // LM Studio, Ollama, vLLM の起動を管理
    await this.startWithProgress();
  }

  private async startWithProgress(): Promise<void> {
    // プログレスバー付きで起動
  }
}
```

### 2. プログレスバー表示コンポーネント (src/components/ServiceStartupProgress.ts)

```typescript
export class ServiceStartupProgress {
  displayProgress(service: string, progress: number): void {
    // ASCII プログレスバーを表示
    // [████████░░░░░░░░░░░░] 40% - Starting LM Studio...
  }

  displayStatus(service: string, status: ServiceStatus): void {
    // ✅ LM Studio - Running (GPT-OSS 20B loaded)
    // ⏳ Ollama - Starting...
    // ❌ vLLM - Not installed
  }
}
```

### 3. 起動画面の改善

#### 起動時の表示例:

```
╔══════════════════════════════════════════════════════════╗
║                   MARIA CODE                              ║
║        AI-Powered Development Platform                    ║
╚══════════════════════════════════════════════════════════╝

🚀 Initializing AI Services...

Local AI Services:
─────────────────────────────────────────────────────────────
LM Studio    [████████████████████] 100% ✅ Running
             └─ Model: GPT-OSS 20B (8K context)

Ollama       [░░░░░░░░░░░░░░░░░░░░]   0% ⚠️  Not installed
             └─ Skipping...

vLLM         [░░░░░░░░░░░░░░░░░░░░]   0% ⚠️  Not installed
             └─ Skipping...

Cloud Services:
─────────────────────────────────────────────────────────────
OpenAI       ✅ Available (GPT-5)
Anthropic    ✅ Available (Claude Opus 4.1)
Google AI    ✅ Available (Gemini 2.5 Pro)

🎉 Ready! Using LM Studio (GPT-OSS 20B) as primary provider

Welcome to MARIA CODE Interactive Chat
Type /help to see all 40+ commands
```

## 実装優先順位

### Priority 1: 即座の改善 (10分)

1. エラーメッセージを情報メッセージに変更
2. シンプルな状態表示を追加

### Priority 2: プログレスバー実装 (30分)

1. ASCII プログレスバー表示
2. サービス起動の進捗追跡
3. リアルタイム更新

### Priority 3: 自動起動強化 (20分)

1. LM Studio 自動起動の改善
2. モデル自動ロード
3. フォールバック処理

## 期待される成果

### ユーザー体験の改善

- ✅ 起動状態が明確に分かる
- ✅ プログレスバーで進捗を確認できる
- ✅ どのサービスが利用可能か一目瞭然
- ✅ エラーではなく情報として表示

### 技術的な改善

- ✅ サービス起動の自動化
- ✅ 適切なフォールバック処理
- ✅ 非同期処理の適切な管理
- ✅ 起動時間の最適化

## 成功基準

1. **明確な状態表示**: ユーザーが現在の状態を理解できる
2. **プログレス表示**: 起動の進捗が視覚的に分かる
3. **自動起動**: LM Studio が自動的に起動する
4. **エラーハンドリング**: 失敗時も適切に処理される
5. **高速起動**: 3秒以内に利用可能になる

## リスクと対策

### リスク

- LM Studio CLIが利用できない環境
- ポート競合の可能性
- モデルファイルが存在しない

### 対策

- 適切なエラーメッセージと代替案の提示
- ポート設定の柔軟性
- クラウドAPIへの自動フォールバック

## 実装スケジュール

- **Phase 1**: 10分 - メッセージ改善と基本的な状態表示
- **Phase 2**: 30分 - プログレスバー実装
- **Phase 3**: 20分 - 自動起動機能の強化
- **Phase 4**: 10分 - テストと調整

## 完了条件

- [ ] エラーメッセージが情報メッセージに変更される
- [ ] プログレスバーが表示される
- [ ] LM Studio が自動起動する
- [ ] 起動状態が明確に表示される
- [ ] フォールバック処理が動作する
