# 🚀 Intelligent Router SOW (Statement of Work)

**プロジェクト**: MARIA CODE Intelligent Router - 自然言語によるスラッシュコマンド自動起動システム  
**日付**: 2025-08-20  
**優先度**: 🔴 CRITICAL PRIORITY  
**カテゴリ**: Next-Generation UX Enhancement

## 🎯 概要

### ビジョン

MARIAが自然言語を理解し、ユーザーの意図を解釈して適切なスラッシュコマンドを自動的に起動する、次世代のインテリジェントルーターシステムを実装する。

### 現状の課題

1. **明示的コマンド入力**: ユーザーは `/code`, `/image` などを明示的に入力する必要がある
2. **学習曲線**: 新規ユーザーは全コマンドを覚える必要がある
3. **作業効率**: 自然な会話フローが途切れる
4. **多言語対応**: 英語以外の言語でのコマンド実行が困難

### 目標達成後の世界

- **自然言語理解**: 「コードを書いて」→ `/code` 自動起動
- **多言語対応**: 日本語、中国語、韓国語など複数言語での自然な指示
- **コンテキスト認識**: 文脈から最適なコマンドを推測
- **学習機能**: ユーザーパターンを学習して精度向上

## 🏗️ アーキテクチャ設計

### コアコンポーネント

```typescript
interface IntelligentRouter {
  // 自然言語処理エンジン
  nlpEngine: {
    languageDetection: LanguageDetector; // 言語自動検出
    intentExtraction: IntentExtractor; // 意図抽出
    contextAnalyzer: ContextAnalyzer; // 文脈分析
    confidenceScorer: ConfidenceScorer; // 信頼度スコアリング
  };

  // コマンドマッピングシステム
  commandMapping: {
    naturalPhrases: Map<string, CommandInfo>; // 自然言語フレーズマップ
    multilingualDict: MultilingualDictionary; // 多言語辞書
    synonymRegistry: SynonymRegistry; // 同義語レジストリ
    contextualRules: ContextualRules[]; // 文脈ルール
  };

  // 学習・適応システム
  learningSystem: {
    userPatterns: UserPatternAnalyzer; // ユーザーパターン分析
    feedbackLoop: FeedbackProcessor; // フィードバックループ
    accuracyTracker: AccuracyMetrics; // 精度追跡
    modelUpdater: ModelUpdater; // モデル更新
  };

  // 実行エンジン
  executionEngine: {
    commandRouter: CommandRouter; // コマンドルーティング
    parameterExtractor: ParameterExtractor; // パラメータ抽出
    confirmationDialog: ConfirmationUI; // 確認ダイアログ
    fallbackHandler: FallbackHandler; // フォールバック処理
  };
}
```

## 📋 機能仕様

### 1. 自然言語マッピング定義

#### コードコマンド (`/code`)

```typescript
const codeCommandMappings = {
  japanese: [
    'コードを書いて',
    '実装して',
    'プログラムを作って',
    '関数を書いて',
    'クラスを作成',
    'メソッドを追加',
  ],
  english: [
    'write code',
    'implement',
    'create function',
    'build class',
    'add method',
    'generate code',
  ],
  chinese: ['写代码', '实现', '创建函数', '构建类', '添加方法'],
  korean: ['코드 작성', '구현해줘', '함수 만들어', '클래스 생성'],
};
```

#### 画像生成コマンド (`/image`)

```typescript
const imageCommandMappings = {
  japanese: [
    '画像を生成',
    'イメージを作って',
    '絵を描いて',
    'ビジュアルを作成',
    '図を生成',
    'イラストを',
  ],
  english: [
    'create image',
    'generate picture',
    'make visual',
    'draw illustration',
    'produce graphic',
  ],
  chinese: ['生成图像', '创建图片', '画一幅画', '制作插图'],
  korean: ['이미지 생성', '그림 그려줘', '일러스트 만들어'],
};
```

#### ビデオ生成コマンド (`/video`)

```typescript
const videoCommandMappings = {
  japanese: ['動画を作って', 'ビデオを生成', 'アニメーションを', 'ムービーを作成', '動画を出力'],
  english: ['create video', 'generate animation', 'make movie', 'produce clip', 'render video'],
  chinese: ['创建视频', '生成动画', '制作影片'],
  korean: ['비디오 생성', '동영상 만들어', '애니메이션 제작'],
};
```

### 2. 意図認識アルゴリズム

```typescript
class IntentRecognizer {
  async recognizeIntent(input: string): Promise<CommandIntent> {
    // 1. 言語検出
    const language = await this.detectLanguage(input);

    // 2. トークン化と正規化
    const tokens = this.tokenize(input, language);
    const normalized = this.normalize(tokens);

    // 3. キーワードマッチング
    const keywordScores = this.calculateKeywordScores(normalized);

    // 4. 文脈分析
    const contextScore = this.analyzeContext(input);

    // 5. 機械学習モデル推論
    const mlPrediction = await this.mlModel.predict(input);

    // 6. 総合スコア計算
    const finalScore = this.combineScores({
      keyword: keywordScores,
      context: contextScore,
      ml: mlPrediction,
    });

    // 7. 信頼度閾値チェック
    if (finalScore.confidence > CONFIDENCE_THRESHOLD) {
      return {
        command: finalScore.command,
        confidence: finalScore.confidence,
        parameters: this.extractParameters(input, finalScore.command),
      };
    }

    return null; // 通常の会話として処理
  }
}
```

### 3. パラメータ抽出システム

```typescript
class ParameterExtractor {
  extractParameters(input: string, command: string): CommandParameters {
    switch (command) {
      case '/code':
        return {
          description: this.extractCodeDescription(input),
          language: this.detectProgrammingLanguage(input),
          template: this.identifyTemplate(input),
        };

      case '/image':
        return {
          prompt: this.extractImagePrompt(input),
          style: this.detectArtStyle(input),
          dimensions: this.extractDimensions(input),
        };

      case '/video':
        return {
          description: this.extractVideoDescription(input),
          duration: this.extractDuration(input),
          format: this.detectVideoFormat(input),
        };

      default:
        return this.genericParameterExtraction(input);
    }
  }
}
```

## 🎮 ユーザー体験フロー

### 基本フロー

```
ユーザー: "Reactコンポーネントを実装して"
    ↓
[言語検出: 日本語]
    ↓
[意図認識: /code コマンド (confidence: 0.95)]
    ↓
[パラメータ抽出: description="Reactコンポーネント", language="typescript"]
    ↓
[自動実行: /code "Reactコンポーネント" --language=typescript]
    ↓
MARIAレスポンス: "Reactコンポーネントを生成します..."
```

### 曖昧性解決フロー

```
ユーザー: "プレゼンテーション資料を作って"
    ↓
[複数候補検出]
    ↓
MARIA: "どのような資料を作成しますか？"
  1. スライド資料を生成 (/slides)
  2. マークダウン文書を作成 (/document)
  3. 画像資料を生成 (/image)
    ↓
ユーザー選択または追加情報提供
```

## 📊 実装フェーズ

### ✅ Phase 1: 基礎インフラ (完了 - 2025/08/20)

#### Day 1-2: コアエンジン開発 ✅

- [x] `IntelligentRouterService.ts` - メインルーティングサービス
- [x] `NaturalLanguageProcessor.ts` - 自然言語処理エンジン
- [x] `IntentRecognizer.ts` - 意図認識システム

#### Day 3-4: 多言語対応 ✅

- [x] `MultilingualDictionary.ts` - 多言語辞書実装
- [x] `LanguageDetector.ts` - 言語自動検出（5言語対応: ja, en, cn, ko, vn）
- [x] `ParameterExtractor.ts` - パラメータ抽出システム
- [x] `CommandMappings.ts` - 全29コマンド+/langコマンドマッピング完了
- [x] `UserPatternAnalyzer.ts` - ユーザーパターン学習システム

#### 実装成果

- ✅ **5言語対応完了**: 日本語(ja)、英語(en)、中国語(cn)、韓国語(ko)、ベトナム語(vn)
- ✅ **全30コマンド対応**: 既存29コマンド + /lang言語切り替えコマンド
- ✅ **完全な自然言語マッピング**: 各言語で自然な表現を認識
- ✅ **学習システム実装**: ユーザーパターンの記録と最適化

### Phase 2: コマンドマッピング (5日間) 🚀 進行中

#### Day 1-3: 全コマンド対応

- [x] 30個のスラッシュコマンドすべてにマッピング定義
- [ ] 同義語・類義語登録
- [ ] 文脈ルール定義

#### Day 4-5: 高度な機能

- [ ] パラメータ抽出ロジック
- [ ] 曖昧性解決システム
- [ ] 確認ダイアログUI

### Phase 3: 学習システム (3日間)

#### Day 1-2: 学習基盤

- [ ] `UserPatternAnalyzer.ts` - パターン分析
- [ ] `FeedbackProcessor.ts` - フィードバック処理
- [ ] `ModelUpdater.ts` - モデル更新システム

#### Day 3: 最適化

- [ ] 精度測定システム
- [ ] A/Bテスト実装
- [ ] パフォーマンス最適化

## 🔧 技術スタック

### 必要技術

- **NLP**: Natural Language Processing libraries
- **ML**: TensorFlow.js or ONNX Runtime
- **言語検出**: franc, langdetect
- **トークン化**: kuromoji (日本語), jieba (中国語)
- **ベクトル化**: Word2Vec, BERT embeddings

### インフラ要件

- **レスポンス時間**: < 200ms
- **精度目標**: > 90%
- **メモリ使用**: < 100MB
- **CPU使用率**: < 5%

## 📈 成功指標

### KPI

- **意図認識精度**: 95%以上
- **レスポンス速度**: 200ms以内
- **ユーザー満足度**: 4.5/5.0以上
- **学習曲線短縮**: 50%削減

### 測定方法

- A/Bテストによる効果測定
- ユーザーフィードバック収集
- 使用パターン分析
- エラー率追跡

## 🚀 デプロイメント戦略

### ロールアウト計画

1. **Alpha**: 内部テスト (1週間)
2. **Beta**: 限定ユーザー公開 (2週間)
3. **GA**: 一般公開 (段階的ロールアウト)

### フィーチャーフラグ

```typescript
const FEATURE_FLAGS = {
  INTELLIGENT_ROUTER_ENABLED: process.env.ENABLE_INTELLIGENT_ROUTER === 'true',
  CONFIDENCE_THRESHOLD: parseFloat(process.env.CONFIDENCE_THRESHOLD || '0.85'),
  LEARNING_ENABLED: process.env.ENABLE_LEARNING === 'true',
  LANGUAGES_SUPPORTED: process.env.SUPPORTED_LANGUAGES?.split(',') || ['en', 'ja'],
};
```

## ✅ 受け入れ基準

### 機能要件

- [ ] 日本語での自然言語コマンド実行が可能
- [ ] 英語での自然言語コマンド実行が可能
- [ ] 95%以上の精度で意図認識
- [ ] 200ms以内のレスポンス時間
- [ ] すべての29コマンドに対応
- [ ] パラメータ自動抽出機能
- [ ] 曖昧性解決メカニズム
- [ ] 学習による精度向上

### 非機能要件

- [ ] TypeScriptカバレッジ: 100%
- [ ] テストカバレッジ: 90%以上
- [ ] ESLintエラー: 0
- [ ] メモリリーク: なし
- [ ] ドキュメント: 完備

---

**ドキュメントID**: MARIA-INTELLIGENT-ROUTER-2025-001  
**作成者**: Claude Code  
**承認者**: Bonginkan Inc.  
**実装予定**: 2025年8月21日〜9月3日 (約2週間)
