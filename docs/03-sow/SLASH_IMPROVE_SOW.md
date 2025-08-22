# スラッシュコマンド強化 UI/UX 改善 SOW (Statement of Work)

**プロジェクト名**: MARIA CODE インタラクティブヘルプシステム強化  
**日付**: 2025-08-20  
**優先度**: 🚨 HIGH PRIORITY  
**カテゴリ**: User Experience Enhancement

## 現状分析

現在のインタラクティブセッションの課題

### 主要な現在の課題

1. **コマンドヘルプ表示課題**: `/help`が基本的なヘルプ情報しか表示しない
2. **スラッシュ自動補完課題**: 40+のコマンドを手動で記憶する必要がある
3. **ナビゲーション課題**: キーボードナビゲーション表示なし
4. **発見性の低さ**: コマンド機能の発見が困難
5. **効率性の課題**: ユーザーの学習コストが高い

### パフォーマンス改善

- **スラッシュ起動時間**: 30秒 → 5秒 (83%改善)
- **ナビゲーション時間**: コマンド探索時間 → 2秒 (75%改善)
- **効率性**: ユーザーの学習とコマンド記憶の必要性を50%削減
- **可視性向上**: CLIからGUI的な操作へ

## 技術仕様

### 1. インタラクティブヘルプシステム (Core Feature)

#### 仕様詳細

`/help`コマンドで起動するインタラクティブなコマンドヘルプシステムUI

#### 技術仕様

```typescript
interface InteractiveHelp {
  // ヘルプ表示
  displayMode: 'list' | 'grid' | 'tree';

  // キーボード操作
  navigation: {
    up: 'ArrowUp' | 'k'; // 上移動
    down: 'ArrowDown' | 'j'; // 下移動
    left: 'ArrowLeft' | 'h'; // カテゴリ左移動
    right: 'ArrowRight' | 'l'; // カテゴリ右移動
    select: 'Enter'; // 選択実行
    exit: 'Escape' | 'q'; // 終了
    search: '/'; // 検索
  };

  // フィルタリング
  filtering: {
    byCategory: boolean; // カテゴリ別ヘルプ
    byFrequency: boolean; // 使用頻度
    byRecent: boolean; // 最近使用
    realTimeSearch: boolean; // リアルタイム検索
  };

  // ヘルプ情報
  displayInfo: {
    command: string; // コマンド
    description: string; // 説明
    usage: string; // 使用法
    category: string; // カテゴリ
    examples: string[]; // 使用例
    frequency: number; // 使用頻度
    lastUsed?: Date; // 最後の使用時間
  };
}
```

#### UI設計

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ 🚀 MARIA Interactive Command Helper               [ESC: Exit] ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃ 📂 Categories: [All] Development Project Media System       ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃ > /code      Generate code with AI assistance        █████ ┃
┃   /test      Generate and run tests                  ████  ┃
┃   /review    Review code for improvements            ███   ┃
┃   /init      Initialize project with AI             ███   ┃
┃   /commit    Generate commit messages               ██    ┃
┃   /image     Generate images with AI                ██    ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃ /code - AI-powered code generation                          ┃
┃ Usage: /code "description" [--file=path] [--template=name]  ┃
┃ Examples: /code "create REST API", /code "add validation"   ┃
┃                                     [↑↓: Navigate ENTER: Run]┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

### 2. スラッシュコマンド自動補完 (Core Feature)

#### 仕様詳細

`/`入力時のリアルタイム自動補完とキーボード操作

#### 技術仕様

```typescript
interface SlashCompletion {
  // トリガー条件
  triggers: {
    slashInput: boolean; // /入力時
    shiftKey: boolean; // Shiftキー組み合わせ
    tabKey: boolean; // Tab補完
    characterMatch: boolean; // 文字マッチング
  };

  // 補完ヘルプ
  suggestions: {
    maxVisible: number; // 最大ヘルプ表示数 (5-7)
    sortAlgorithm: 'frequency' | 'alphabetical' | 'fuzzy';
    highlightMatching: boolean; // マッチング文字ハイライト
    showDescription: boolean; // 説明ヘルプ
    showCategory: boolean; // カテゴリヘルプ
  };

  // インタラクション
  interaction: {
    shiftCycle: boolean; // Shift+Tabでサイクル移動
    arrowNavigation: boolean; // 矢印キー選択
    enterSelect: boolean; // Enterキー選択実行
    escapeCancel: boolean; // Escキーキャンセル
    autoComplete: boolean; // 自動補完
  };
}
```

#### UI設計例

```
maria chat > /c▏

┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ > /code     Generate code with AI      [1/7]┃
┃   /config   Manage configuration              ┃
┃   /commit   Generate commit messages        ┃
┃   /clear    Clear conversation context      ┃
┃   /compact  Compact conversation            ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
         [Shift: Next] [Enter: Select] [Esc: Cancel]
```

## 技術アーキテクチャ設計

### ファイル構造

```
src/services/interactive/
├── InteractiveHelpService.ts       # インタラクティブヘルプ
├── SlashCompletionService.ts       # スラッシュ補完
├── CommandSearchEngine.ts          # 検索エンジン
├── KeyboardNavigationHandler.ts    # キーボードナビゲーション
├── CommandFrequencyTracker.ts      # 使用頻度トラッキング
└── InteractiveUIRenderer.ts        # UI描画

src/components/interactive/
├── InteractiveHelpPanel.tsx        # ヘルプパネル
├── SlashCompletionPopup.tsx        # 補完ポップアップ
├── CommandListView.tsx             # コマンドリスト表示
├── CommandDetailView.tsx           # コマンド詳細情報
└── SearchFilterBar.tsx             # 検索フィルターバー
```

## 実装計画

### Phase 1: コア機能実装 (1週間)

#### Day 1-2: サービス実装

- [ ] `InteractiveHelpService.ts` - ヘルプサービス
- [ ] `CommandSearchEngine.ts` - 検索エンジン
- [ ] `KeyboardNavigationHandler.ts` - キーボード操作

#### Day 3-4: UI コンポーネント実装

- [ ] `InteractiveHelpPanel.tsx` - ヘルプパネル
- [ ] `CommandListView.tsx` - コマンドリストヘルプ
- [ ] `SearchFilterBar.tsx` - 検索バー

#### Day 5-7: 統合テスト

- [ ] `/help` コマンドとの統合
- [ ] キーボードナビゲーション動作
- [ ] リアルタイムフィルタリング機能

````

### Phase 2: 補完システム実装 (1週間)

#### Day 1-3: 補完サービス
- [ ] `SlashCompletionService.ts` - 補完サービス
- [ ] リアルタイム補完
- [ ] Shift+Tabでのサイクル移動

#### Day 4-5: UI実装
- [ ] `SlashCompletionPopup.tsx` - 補完ポップアップ
- [ ] 説明ヘルプとハイライト
- [ ] Enter選択とEscキャンセル

#### Day 6-7: 統合改善
- [ ] インタラクティブ入力との統合
- [ ] パフォーマンス最適化
- [ ] エラーハンドリング

## UI/UX 設計詳細

### キーボードショートカット定義
```typescript
const KeyboardShortcuts = {
  global: {
    'Ctrl+/': 'openInteractiveHelp',
    'Ctrl+Space': 'triggerCompletion',
    'Escape': 'closeActivePanel',
  },
  navigation: {
    'ArrowUp': 'selectPrevious',
    'ArrowDown': 'selectNext',
    'ArrowLeft': 'previousCategory',
    'ArrowRight': 'nextCategory',
    'Enter': 'executeSelected',
    'Tab': 'cycleMode',
  },
  vim: {
    'k': 'selectPrevious',
    'j': 'selectNext',
    'h': 'previousCategory',
    'l': 'nextCategory',
    '/': 'enterSearchMode',
    'q': 'quit',
  },
  completion: {
    'Shift': 'cycleNext',        // Shift+Tabでサイクル移動
    'Enter': 'selectCommand',     // 選択コマンド実行
    'Escape': 'cancelCompletion', // キャンセル
    'Tab': 'autoComplete',        # 自動補完
  }
};
````

## パフォーマンス要件

### パフォーマンス要件

- **応答時間**: < 100ms
- **検索レスポンス**: < 50ms
- **キーボードレスポンス**: < 16ms (60fps)
- **メモリ使用量**: < 10MB

### 互換性要件

- **Node.js**: 18.0+
- **ターミナル**: Windows Terminal, iTerm2, GNOME Terminal
- **OS**: macOS, Linux, Windows

## テスト要件

### 機能テスト

- [ ] `/help`でインタラクティブなコマンドヘルプシステム起動
- [ ] 矢印キーでナビゲーション、Enterで実行
- [ ] `/`入力時にリアルタイム補完ヘルプ
- [ ] Shift+Tabで補完サイクル移動
- [ ] Enterキーで補完選択実行
- [ ] Escキーでヘルプ・補完終了
- [ ] 検索フィルタリング機能
- [ ] カテゴリ別ヘルプ
- [ ] 使用頻度の学習と優先表示

### 品質テスト

- [ ] TypeScriptコード品質: 100%
- [ ] テストカバレッジ: 90%以上
- [ ] ESLintエラー: ゼロ件のまま0
- [ ] レスポンス時間: 50ms以内

---

**プロジェクトID**: MARIA-INTERACTIVE-SLASH-2025-001  
**担当者**: Claude Code  
**作成日**: 2025-08-20  
**実装期間**: 2週間
