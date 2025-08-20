# MARIA CODE - /model機能修正SOW
> **Statement of Work for Model Selection Critical Issues**

## 🎯 問題分析

### 現状の実装レベル
- ✅ **UI/UX**: 完璧 (100%)
- ✅ **モデル表示**: 完璧 (100%) 
- ✅ **選択機能**: 完璧 (100%)
- ❌ **ローカル起動**: 未実装 (0%)
- ❌ **AI統合**: 不完全 (30%)

### クリティカルな不備
1. **ローカルモデル選択時の自動起動がない**
   - LM Studio APIコールが未実装
   - モデルローディング機能がない
   - エラーハンドリングが不十分

2. **AIプロバイダー統合が不完全**
   - モデル切り替え時のプロバイダー変更が未実装
   - `/code`, `/test`等への即時反映がない
   - 実際のAI機能が使用できない

## 🚀 修正実装計画

### Phase 1: ローカルモデル自動起動 [Critical - 即日実装]

#### 1.1 LM Studio統合機能
```typescript
class LMStudioManager {
  async loadModel(modelId: string): Promise<boolean> {
    // LM Studio API経由でモデルをロード
    const response = await fetch('http://localhost:1234/v1/models/load', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        model: modelId,
        context_length: 32768,
        gpu_layers: -1 
      })
    });
    
    return response.ok;
  }

  async checkStatus(): Promise<string[]> {
    // 現在ロード済みのモデル一覧
    const response = await fetch('http://localhost:1234/v1/models');
    const data = await response.json();
    return data.data.map(m => m.id);
  }

  async unloadModel(modelId: string): Promise<void> {
    // 古いモデルをアンロード
    await fetch(`http://localhost:1234/v1/models/unload`, {
      method: 'POST',
      body: JSON.stringify({ model: modelId })
    });
  }
}
```

#### 1.2 showInteractiveModelSelector修正
```typescript
// 427行目のEnter処理を拡張
} else if (key.name === 'return') {
  const selectedModel = models[selectedIndex];
  this.currentModel = selectedModel.id;
  
  // ローカルモデルの場合は自動起動
  if (selectedModel.type === 'local') {
    console.log(chalk.yellow(`🔄 Loading ${selectedModel.name}...`));
    
    const lmStudio = new LMStudioManager();
    const success = await lmStudio.loadModel(selectedModel.id);
    
    if (success) {
      console.log(chalk.green(`✅ ${selectedModel.name} loaded successfully`));
    } else {
      console.log(chalk.red(`❌ Failed to load ${selectedModel.name}`));
      console.log(chalk.gray('Make sure LM Studio is running on localhost:1234'));
      return;
    }
  }
  
  // AIプロバイダー切り替え
  await this.switchAIProvider(selectedModel);
  
  // クリーンアップ...
}
```

### Phase 2: AIプロバイダー統合 [Critical - 即日実装]

#### 2.1 プロバイダー管理クラス
```typescript
class AIProviderManager {
  private providers = new Map();
  private currentProvider: AIProvider;

  constructor() {
    // 各プロバイダーを初期化
    this.providers.set('openai', new OpenAIProvider());
    this.providers.set('anthropic', new AnthropicProvider()); 
    this.providers.set('google', new GoogleProvider());
    this.providers.set('lmstudio', new LMStudioProvider());
  }

  async switchProvider(modelId: string, modelType: string) {
    if (modelType === 'local') {
      this.currentProvider = this.providers.get('lmstudio');
      await this.currentProvider.setModel(modelId);
    } else if (modelId.startsWith('gpt')) {
      this.currentProvider = this.providers.get('openai');
      await this.currentProvider.setModel(modelId);
    } else if (modelId.startsWith('claude')) {
      this.currentProvider = this.providers.get('anthropic');
      await this.currentProvider.setModel(modelId);  
    } else if (modelId.startsWith('gemini')) {
      this.currentProvider = this.providers.get('google');
      await this.currentProvider.setModel(modelId);
    }
  }

  getCurrentProvider(): AIProvider {
    return this.currentProvider;
  }
}
```

#### 2.2 MariaCLI統合
```typescript
class MariaCLI {
  private aiProviderManager = new AIProviderManager();
  
  async switchAIProvider(selectedModel) {
    await this.aiProviderManager.switchProvider(
      selectedModel.id, 
      selectedModel.type
    );
    
    console.log(chalk.green(`🤖 AI Provider switched to ${selectedModel.provider}`));
    console.log(chalk.cyan(`Ready for /code, /test, and other AI commands`));
  }

  async generateCode(prompt) {
    // 現在のプロバイダーを使用
    const provider = this.aiProviderManager.getCurrentProvider();
    const result = await provider.generateCode(prompt);
    // ... 既存のコード生成ロジック
  }
}
```

### Phase 3: エラーハンドリング強化 [High - 1日以内]

#### 3.1 接続チェック機能
```typescript
async checkLMStudioConnection(): Promise<boolean> {
  try {
    const response = await fetch('http://localhost:1234/health', { 
      timeout: 2000 
    });
    return response.ok;
  } catch {
    return false;
  }
}

async validateModelSelection(selectedModel) {
  if (selectedModel.type === 'local') {
    const isConnected = await this.checkLMStudioConnection();
    
    if (!isConnected) {
      console.log(chalk.red('❌ LM Studio is not running'));
      console.log(chalk.yellow('💡 Please start LM Studio and try again'));
      console.log(chalk.gray('   1. Open LM Studio'));
      console.log(chalk.gray('   2. Start Local Server (port 1234)'));
      console.log(chalk.gray('   3. Return here and select model'));
      return false;
    }
  }
  
  return true;
}
```

## 📋 実装チェックリスト

### Critical Issues (今すぐ実装)
- [ ] **LM Studio API統合**
  - [ ] モデルロード機能
  - [ ] ステータス確認
  - [ ] エラーハンドリング

- [ ] **AIプロバイダー切り替え**
  - [ ] プロバイダーマネージャー作成
  - [ ] モデル選択時の自動切り替え
  - [ ] 現在プロバイダーの表示

- [ ] **即時AI利用**
  - [ ] `/code`でのプロバイダー使用
  - [ ] `/test`でのプロバイダー使用
  - [ ] 全コマンドでの一貫性

### High Priority (24時間以内)
- [ ] **接続チェック機能**
  - [ ] LM Studio起動確認
  - [ ] ヘルスチェック実装
  - [ ] 自動復旧機能

- [ ] **ユーザーフィードバック強化**
  - [ ] ローディング表示改善
  - [ ] エラーメッセージ詳細化
  - [ ] 成功時の明確な通知

### Medium Priority (3日以内)
- [ ] **パフォーマンス最適化**
  - [ ] モデルのプリロード
  - [ ] 切り替え時間短縮
  - [ ] メモリ使用量最適化

## 🚨 リスク分析

### 高リスク
1. **LM Studio依存性**: ローカル環境での動作保証
2. **モデルローディング時間**: 大きなモデルで数分かかる可能性
3. **メモリ使用量**: 120GBモデルは高性能GPU必須

### 対策
1. **フォールバック機能**: ローカル失敗時はクラウドモデル提案
2. **プログレス表示**: ローディング状況を詳細表示
3. **システム要件チェック**: 事前にハードウェア要件確認

## 💰 実装コスト

### 工数見積もり
- **LM Studio統合**: 8時間
- **AIプロバイダー統合**: 6時間  
- **エラーハンドリング**: 4時間
- **テスト・デバッグ**: 6時間
- **合計**: 24時間 (3人日)

### ROI分析
- **現在のUX問題**: モデル選択が機能しない (致命的)
- **修正後の価値**: 完全なローカル・クラウド統合
- **ユーザー満足度**: +400% (0%→100%)

## 🎯 成功基準

### 機能テスト
1. **ローカルモデル選択**
   - [ ] LM Studioでモデルが自動ロードされる
   - [ ] ローディング状況が表示される
   - [ ] 成功・失敗が明確に通知される

2. **クラウドモデル選択**
   - [ ] 即座に切り替わる
   - [ ] APIキーが正しく設定される
   - [ ] プロバイダーが切り替わる

3. **AI機能統合**
   - [ ] `/code`で選択したモデルが使われる
   - [ ] `/test`で選択したモデルが使われる
   - [ ] すべてのAI機能で一貫性がある

### パフォーマンステスト
- [ ] ローカル切り替え: < 30秒
- [ ] クラウド切り替え: < 3秒
- [ ] メモリ使用量: 適切な範囲
- [ ] エラー回復: < 5秒

## 🚀 Next Steps

### 即日実装順序
1. **LMStudioManager作成** (2時間)
2. **showInteractiveModelSelector修正** (3時間)
3. **AIProviderManager作成** (3時間)
4. **統合テスト** (2時間)

### デバッグ・最適化
1. **エラーケーステスト** (4時間)
2. **パフォーマンスチューニング** (2時間)
3. **ドキュメント更新** (1時間)

---

**優先度**: 🔴 CRITICAL  
**緊急度**: ⚡ IMMEDIATE  
**影響度**: 🌟 HIGH IMPACT  
**実装期限**: 24時間以内

この修正により、MARIAの`/model`機能は完全に動作し、ユーザーはローカル・クラウドモデルを自由に切り替えて即座にAI機能を利用できるようになります。