# CLI Design Chalk Optimization SOW (Statement of Work)

**プロジェクト**: MARIA CODE CLI の UI/UX 最適化 - 124文字幅レスポンシブデザイン  
**日付**: 2025-08-21  
**優先度**: LEVEL 4 CRITICAL PRIORITY  
**範囲**: Revolutionary UI/UX Enhancement

## プロジェクト概要

### 目標

MARIA CODE の124文字幅レスポンシブ設計を導入し、統一されたCLI設計システムによる次世代的な体験の実現。

### 課題解決

1. **レスポンシブ設計**: 端末幅80-200文字対応
2. **色彩統一**: 統一された色彩システム全体
3. **記号最適化**: chalk の効率的な使用
4. **UX向上**: モダンなUXの実装
5. **アニメーション**: スムーズなレスポンス

### 技術要求

- **設計基準幅**: 124文字幅を基本ベース
- **最小表示幅**: 80文字でも表示可能
- **色彩設計**: 統一された色彩システム運用
- **目標UX**: Apple/Google級のCLI設計

## 設計仕様

### 1. 124文字レスポンシブ基準

```typescript
const DESIGN_CONSTANTS = {
  SCREEN_WIDTH: 124,
  CONTENT_WIDTH: 120, // 余白2文字分
  BORDER_WIDTH: 118, // ボーダー内幅
  SECTION_PADDING: 4, // セクション余白
  INDENT_SIZE: 2, // インデント幅

  // 2列レイアウト比率
  MAIN_CONTENT: 80, // メインコンテンツ幅
  SIDEBAR: 36, // サイドバー幅（MAIN_CONTENT * 0.45）
  STATUS_BAR: 120, // ステータスバー幅
};
```

### 2. 最小記号セット

```typescript
const MINIMAL_ICONS = {
  // Core System Icons (6個)
  SUCCESS: '✓', // 成功表示のみ
  ERROR: '✗', // エラー表示
  WARNING: '!', // 警告
  INFO: 'i', // 情報
  LOADING: '⠋', // ローディング表示
  ARROW: '→', // 矢印

  // 禁止記号 (表示問題)
  FORBIDDEN: [
    '🚀',
    '🎉',
    '🎨',
    '📊',
    '🔧',
    '⚡',
    '🎯',
    '🔥',
    '🌟',
    '💫',
    '⭐',
    '🎪',
    '🎭',
    '🎨',
    '🔮',
    '🎲',
    '🎯',
    '🎪',
    '🎭',
    '🏆',
    '🎯',
    '🎪',
    '🎭',
    '🎪',
  ],
};
```

### 3. 統一色彩システム

```typescript
const UNIFIED_COLOR_SYSTEM = {
  // Primary Colors (主要4色)
  PRIMARY: chalk.cyan, // プライマリブルー
  SUCCESS: chalk.green, // 成功緑
  WARNING: chalk.yellow, // 警告黄
  ERROR: chalk.red, // エラー赤

  // Secondary Colors (補助3色)
  INFO: chalk.blue, // 情報青
  MUTED: chalk.gray, // 補助グレー
  ACCENT: chalk.magenta, // アクセントマゼンタ

  // Text Hierarchy (テキスト階層)
  TITLE: chalk.bold.cyan,
  SUBTITLE: chalk.cyan,
  BODY: chalk.white,
  CAPTION: chalk.gray,
  DISABLED: chalk.dim.gray,
};
```

## 実装レイアウト

### 1. ヘッダーレンダリング (12行)

```typescript
function renderOptimizedHeader(): void {
  const width = 124;
  const border = '═'.repeat(width - 2);

  console.log(chalk.cyan(`╔${border}╗`));
  console.log(chalk.cyan('║') + ' '.repeat(width - 2) + chalk.cyan('║'));

  // MARIAロゴ - 中央配置
  const logo = 'MARIA CODE';
  const logoPosition = Math.floor((width - logo.length) / 2) - 1;
  console.log(
    chalk.cyan('║') +
      ' '.repeat(logoPosition) +
      chalk.bold.magenta(logo) +
      ' '.repeat(width - logoPosition - logo.length - 2) +
      chalk.cyan('║'),
  );

  // サブタイトル
  const subtitle = 'AI-Powered Development Platform';
  const subtitlePosition = Math.floor((width - subtitle.length) / 2) - 1;
  console.log(
    chalk.cyan('║') +
      ' '.repeat(subtitlePosition) +
      chalk.gray(subtitle) +
      ' '.repeat(width - subtitlePosition - subtitle.length - 2) +
      chalk.cyan('║'),
  );

  console.log(chalk.cyan('║') + ' '.repeat(width - 2) + chalk.cyan('║'));
  console.log(chalk.cyan(`╚${border}╝`));
}
```

### 2. ステータスバー (3行)

```typescript
function renderStatusBar(status: SystemStatus): void {
  const width = 120;

  // 空行
  console.log(chalk.gray('─'.repeat(width)));

  // 左・中央・右の3列レイアウト
  const leftInfo = `Mode: ${status.mode}`;
  const centerInfo = `${status.aiProvider} ${status.modelName}`;
  const rightInfo = `${status.activeConnections} active`;

  const leftPad = 0;
  const centerPad = Math.floor((width - centerInfo.length) / 2);
  const rightPad = width - rightInfo.length;

  const statusLine =
    chalk.info(leftInfo).padEnd(centerPad) +
    chalk.primary(centerInfo).padEnd(rightPad - centerPad - leftInfo.length) +
    chalk.muted(rightInfo);

  console.log(statusLine);
  console.log(chalk.gray('─'.repeat(width)));
}
```

### 3. メインコンテンツ

```typescript
function renderMainContent(): void {
  const contentWidth = 80;
  const sidebarWidth = 36;
  const gap = 4;

  // 2列レイアウト
  console.log(
    renderContentColumn(contentWidth) + ' '.repeat(gap) + renderSidebarColumn(sidebarWidth),
  );
}

function renderContentColumn(width: number): string {
  return [
    chalk.title('Available Commands').padEnd(width),
    chalk.gray('─'.repeat(width)),
    formatCommandList(COMMANDS, width),
  ].join('\n');
}

function renderSidebarColumn(width: number): string {
  return [
    chalk.subtitle('Quick Actions').padEnd(width),
    chalk.gray('─'.repeat(width)),
    formatQuickActions(QUICK_ACTIONS, width),
  ].join('\n');
}
```

## 最適化コンポーネント

### 1. 効率ボックス表示

```typescript
class OptimizedBox {
  static render(content: string, options: BoxOptions): void {
    const width = options.width || 120;
    const padding = options.padding || 2;
    const innerWidth = width - padding * 2 - 2;

    // ボーダー表示
    const border = options.style === 'thick' ? '═' : '─';
    const corner = options.style === 'thick' ? ['╔', '╗', '╚', '╝'] : ['┌', '┐', '└', '┘'];

    console.log(chalk.primary(`${corner[0]}${border.repeat(width - 2)}${corner[1]}`));

    // コンテンツ表示
    content.split('\n').forEach((line) => {
      const paddedLine =
        ' '.repeat(padding) + line.slice(0, innerWidth).padEnd(innerWidth) + ' '.repeat(padding);
      console.log(chalk.primary('║') + paddedLine + chalk.primary('║'));
    });

    console.log(chalk.primary(`${corner[2]}${border.repeat(width - 2)}${corner[3]}`));
  }
}
```

### 2. プログレスバー表示

```typescript
class OptimizedProgress {
  static render(progress: number, width: number = 60): void {
    const filled = Math.floor((progress / 100) * width);
    const empty = width - filled;

    const bar = chalk.success('█'.repeat(filled)) + chalk.muted('░'.repeat(empty));

    const percentage = chalk.body(`${progress}%`).padStart(5);

    console.log(`${bar} ${percentage}`);
  }
}
```

### 3. テーブル表示

```typescript
class OptimizedTable {
  static render(data: TableData[], headers: string[], maxWidth: number = 120): void {
    const columnWidths = this.calculateOptimalWidths(data, headers, maxWidth);

    // ヘッダー行
    const headerRow = headers
      .map((header, i) => chalk.title(header).padEnd(columnWidths[i]))
      .join('  ');

    console.log(headerRow);
    console.log(chalk.gray('─'.repeat(maxWidth)));

    // データ行
    data.forEach((row) => {
      const dataRow = headers
        .map((header, i) => chalk.body(String(row[header] || '')).padEnd(columnWidths[i]))
        .join('  ');

      console.log(dataRow);
    });
  }

  private static calculateOptimalWidths(
    data: TableData[],
    headers: string[],
    maxWidth: number,
  ): number[] {
    // 列数計算
    const totalCols = headers.length;
    const separatorWidth = (totalCols - 1) * 3; // '  ' separators
    const availableWidth = maxWidth - separatorWidth;

    // 等幅配分
    return headers.map((header) => Math.floor(availableWidth / totalCols));
  }
}
```

## アニメーション機能

### 1. タイプライター

```typescript
class OptimizedAnimations {
  static async typewriter(text: string, speed: number = 50): Promise<void> {
    for (const char of text) {
      process.stdout.write(chalk.primary(char));
      await new Promise((resolve) => setTimeout(resolve, speed));
    }
    console.log();
  }

  static spinner(message: string): SpinnerController {
    const frames = ['⠋', '⠙', '⠹', '⠸'];
    let frameIndex = 0;

    const interval = setInterval(() => {
      process.stdout.write(`\r${chalk.info(frames[frameIndex])} ${chalk.body(message)}`);
      frameIndex = (frameIndex + 1) % frames.length;
    }, 100);

    return {
      stop: () => {
        clearInterval(interval);
        process.stdout.write(`\r${chalk.success('✓')} ${chalk.body(message)}\n`);
      },
    };
  }
}
```

### 2. レスポンシブ対応

```typescript
class ResponsiveRenderer {
  static getOptimalLayout(contentType: string): LayoutConfig {
    const terminalWidth = process.stdout.columns || 124;

    if (terminalWidth < 100) {
      return COMPACT_LAYOUT;
    } else if (terminalWidth < 140) {
      return STANDARD_LAYOUT;
    } else {
      return WIDE_LAYOUT;
    }
  }

  static renderAdaptive(content: RenderableContent): void {
    const layout = this.getOptimalLayout(content.type);
    content.render(layout);
  }
}
```

## 実装スケジュール

### Phase 1: 基盤構築 (3日)

#### Day 1: コンポーネント作成

- [x] `OptimizedDesignSystem.ts` - 統一デザインシステム
- [x] `MinimalIconRegistry.ts` - 最小記号セット
- [x] `UnifiedColorPalette.ts` - 統一色彩システム

#### Day 2: レイアウト管理システム

- [ ] `LayoutManager.ts` - 124文字幅レイアウト管理
- [ ] `OptimizedBox.ts` - 効率ボックス表示システム
- [ ] `ResponsiveRenderer.ts` - レスポンシブ対応システム

#### Day 3: UI統合

- [ ] 既存`ui.ts`の置き換え更新
- [ ] `interactive-session.ts`の対応
- [ ] 全体システムの124文字幅対応

### Phase 2: 機能 (4日)

#### Day 1-2: コンポーネント機能

- [ ] MARIAロゴの中央配置更新
- [ ] ステータスバーのUX向上
- [ ] 統一レスポンシブ対応コンポーネント

#### Day 3-4: アニメーション機能

- [ ] タイプライター機能実装
- [ ] レスポンシブ対応の動作機能
- [ ] 滑らかな効果対応の

### Phase 3: 品質向上 (2日)

#### Day 1: 対応最適化

- [ ] 全レスポンシブ機能の対応確認
- [ ] 色彩システム調整
- [ ] プログレス表示効率化

#### Day 2: UX最適化

- [ ] 操作感
- [ ] エラー処理
- [ ] 最終表示機能調整

## 具体的最適化例

### 1. 現在の`printWelcome()`

```typescript
// 現在: 62文字幅 + 固定表示システム
console.log(chalk.magenta('╔══════════════════════════════════════════════════════════╗'));

//  : 124文字幅 + 動的コンポーネント
function printOptimizedWelcome(): void {
  const width = 124;
  const border = '═'.repeat(width - 2);

  console.log(chalk.cyan(`╔${border}╗`));
  console.log(
    chalk.cyan('║') + centerText('MARIA CODE', width - 2, chalk.bold.magenta) + chalk.cyan('║'),
  );
  console.log(
    chalk.cyan('║') +
      centerText('AI-Powered Development Platform', width - 2, chalk.gray) +
      chalk.cyan('║'),
  );
  console.log(chalk.cyan(`╚${border}╝`));

  // ステータス対応表示
  console.log();
  console.log(
    chalk.primary('Ready ') + chalk.muted('→ ') + chalk.body('Type naturally or use /help'),
  );
  console.log();
}
```

### 2. プロバイダー対応の

```typescript
// 現在: 固定幅表示統一なし
console.log(`  ${chalk.green('✓')} OpenAI ${chalk.gray('(GPT-5, GPT-4)')}`);

//  : 統一幅表示システム
function renderCleanStatus(providers: Provider[]): void {
  console.log(chalk.subtitle('AI Providers'));
  console.log(chalk.gray('─'.repeat(40)));

  providers.forEach((provider) => {
    const status = provider.available ? chalk.success('✓') : chalk.muted('○');
    const name = chalk.body(provider.name.padEnd(12));
    const models = chalk.caption(`(${provider.models.join(', ')})`);

    console.log(`${status} ${name} ${models}`);
  });
}
```

### 3. コマンド表示の

```typescript
// 現在: UX向上要なし
console.log(chalk.green('40+ Slash Commands Available') + ' - Type /help');

//  : UX向上表示カテゴリー統一
function renderOptimizedHelp(): void {
  const categories = groupCommandsByCategory(COMMANDS);
  const leftWidth = 60;
  const rightWidth = 60;

  Object.entries(categories).forEach(([category, commands]) => {
    console.log(chalk.title(category));
    console.log(chalk.gray('─'.repeat(leftWidth)));

    commands.forEach((cmd) => {
      const nameCol = chalk.primary(cmd.name).padEnd(20);
      const descCol = chalk.body(cmd.description);
      console.log(`${nameCol} ${descCol}`);
    });

    console.log();
  });
}
```

## 成功指標

### UX Metrics

- **表示速度**: 50%短縮「端末起動から表示完了の 」
- **プログレス表示**: 80%向上「UXの向上」
- **ユーザー満足度**: 9/10「滑らかな表示効果」
- **操作性**: 30%向上「エラー削減効果」

### Technical Metrics

- **対応 完成度**: 100%全レスポンシブ機能対応
- **プログレス表示**: <50ms対応速度
- **メモリ使用**: <5MBUI関連のメモリ使用
- **アクセシビリティ**: WCAG 2.1 AA準拠

### Design Quality

- **カラーコントラスト**: 4.5:1以上「WCAG準拠」
- **UX向上**: 効率的システムの対応状況管理」
- **表示階層**: 明確5段階のUI階層
- **記号 完成度**: 100%統一基準目標記号表示完了」

## ファイル構成

### 新規作成ファイル

```
src/ui/
   design-system/
      OptimizedDesignSystem.ts     # 統一デザインシステム
      MinimalIconRegistry.ts       # 最小記号セット
      UnifiedColorPalette.ts       # 統一色彩システム
      LayoutConstants.ts           # 124文字幅定数
   components/
      OptimizedBox.ts              #  効率ボックス
      OptimizedTable.ts            #  テーブル
      OptimizedProgress.ts         #  プログレス
      ResponsiveRenderer.ts        # レスポンシブ対応
   animations/
      OptimizedAnimations.ts       # アニメーション
      TransitionEffects.ts         # トランジション
   layouts/
       LayoutManager.ts             # レイアウト管理
       HeaderRenderer.ts            # ヘッダー
       StatusBarRenderer.ts         # ステータスバー
```

### 更新対象ファイル

```
更新対象:
   src/utils/ui.ts                  # 全体更新対象
   src/services/interactive-session.ts  # 対応
   src/ui/design-system.ts          # 124文字幅対応
   全chalk使用ファイル更新        # 統一 システム引用
```

## チェックリスト

### 設計要件

- [ ] 124文字レスポンシブ機能の統一対応
- [ ] 最小記号セット6個実装
- [ ] 統一色彩システム7色システム実装
- [ ] レスポンシブ対応80-200文字幅対応
- [ ] アニメーション機能実装
- [ ] プログレス表示効率化

### 技術要件

- [ ] TypeScript型安全性: 100%
- [ ] 対応最適化: 全レスポンシブ
- [ ] アクセシビリティ: WCAG AA準拠
- [ ] パフォーマンス: <50ms
- [ ] メモリ使用: <5MB UI関連

### UX要件

- [ ] 操作感表示の操作性
- [ ] 統一UX階層
- [ ] ユーザー満足度: 9/10以上
- [ ] 操作性: 30%向上

---

**プロジェクトID**: MARIA-CLI-DESIGN-OPTIMIZATION-2025-001  
**担当者**: Claude Code  
**発注者**: Bonginkan Inc.  
**納期**: 2025年8月21日完了 (9日間)

**MARIA CODE CLI - 次世代UI/UX最適化プロジェクト**
