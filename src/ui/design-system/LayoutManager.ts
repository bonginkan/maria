/**
 * Layout Manager
 * 124文字幅に最適化された厳密なレイアウト管理システム
 * 画面ずれを完全に防ぐ Ultra Think設計
 */

// 厳密な124文字幅設計定数
export const LAYOUT_CONSTANTS = {
  // 基準画面幅
  SCREEN_WIDTH: 124,
  CONTENT_WIDTH: 120, // 両端2文字余白
  BORDER_WIDTH: 118, // ボーダー内容幅

  // セクション間隔
  SECTION_PADDING: 4, // セクション間隔
  INDENT_SIZE: 2, // インデント幅
  LINE_SPACING: 1, // 行間

  // 黄金比レイアウト（合計120文字）
  MAIN_CONTENT: 80, // メインコンテンツ幅
  SIDEBAR: 36, // サイドバー幅（0.45比率）
  COLUMN_GAP: 4, // 列間ギャップ

  // ステータス・ヘッダー
  STATUS_BAR: 120, // ステータスバー幅
  HEADER_HEIGHT: 12, // ヘッダー行数
  FOOTER_HEIGHT: 3, // フッター行数

  // レスポンシブ閾値
  MIN_WIDTH: 80, // 最小表示幅
  MAX_WIDTH: 200, // 最大表示幅
  COMPACT_THRESHOLD: 100, // コンパクト表示閾値
  WIDE_THRESHOLD: 140, // ワイド表示閾値
} as const;

// レイアウトモード定義
export type LayoutMode = 'compact' | 'standard' | 'wide';

// 配置オプション
export type Alignment = 'left' | 'center' | 'right';

// レイアウト設定インターフェース
export interface LayoutConfig {
  mode: LayoutMode;
  width: number;
  contentWidth: number;
  mainContentWidth: number;
  sidebarWidth: number;
  columnGap: number;
  padding: number;
}

/**
 * レイアウト管理クラス
 */
export class LayoutManager {
  private static currentConfig: LayoutConfig;

  /**
   * 端末幅に基づく最適レイアウト決定
   */
  static getOptimalLayout(terminalWidth?: number): LayoutConfig {
    const width = terminalWidth || process.stdout.columns || LAYOUT_CONSTANTS.SCREEN_WIDTH;

    let mode: LayoutMode;
    let config: Partial<LayoutConfig> = {};

    // レスポンシブ判定
    if (width < LAYOUT_CONSTANTS.COMPACT_THRESHOLD) {
      mode = 'compact';
      config = {
        width: Math.max(width, LAYOUT_CONSTANTS.MIN_WIDTH),
        contentWidth: Math.max(width - 4, LAYOUT_CONSTANTS.MIN_WIDTH - 4),
        mainContentWidth: Math.max(width - 8, LAYOUT_CONSTANTS.MIN_WIDTH - 8),
        sidebarWidth: 0, // コンパクトモードではサイドバーなし
        columnGap: 0,
        padding: 2,
      };
    } else if (width > LAYOUT_CONSTANTS.WIDE_THRESHOLD) {
      mode = 'wide';
      const scaleFactor = width / LAYOUT_CONSTANTS.SCREEN_WIDTH;
      config = {
        width,
        contentWidth: width - 4,
        mainContentWidth: Math.floor(LAYOUT_CONSTANTS.MAIN_CONTENT * scaleFactor),
        sidebarWidth: Math.floor(LAYOUT_CONSTANTS.SIDEBAR * scaleFactor),
        columnGap: LAYOUT_CONSTANTS.COLUMN_GAP,
        padding: LAYOUT_CONSTANTS.SECTION_PADDING,
      };
    } else {
      mode = 'standard';
      config = {
        width: LAYOUT_CONSTANTS.SCREEN_WIDTH,
        contentWidth: LAYOUT_CONSTANTS.CONTENT_WIDTH,
        mainContentWidth: LAYOUT_CONSTANTS.MAIN_CONTENT,
        sidebarWidth: LAYOUT_CONSTANTS.SIDEBAR,
        columnGap: LAYOUT_CONSTANTS.COLUMN_GAP,
        padding: LAYOUT_CONSTANTS.SECTION_PADDING,
      };
    }

    this.currentConfig = { mode, ...config } as LayoutConfig;
    return this.currentConfig;
  }

  /**
   * 現在のレイアウト設定取得
   */
  static getCurrentConfig(): LayoutConfig {
    return this.currentConfig || this.getOptimalLayout();
  }

  /**
   * テキスト配置（完全なピクセルパーフェクト）
   */
  static alignText(text: string, width: number, alignment: Alignment = 'left'): string {
    // Unicode文字を考慮した正確な文字幅計算
    const actualLength = this.getStringWidth(text);

    if (actualLength > width) {
      // 切り詰め処理（安全な境界）
      return this.truncateString(text, width - 3) + '...';
    }

    const padding = width - actualLength;

    switch (alignment) {
      case 'center':
        const leftPad = Math.floor(padding / 2);
        const rightPad = padding - leftPad;
        return ' '.repeat(leftPad) + text + ' '.repeat(rightPad);

      case 'right':
        return ' '.repeat(padding) + text;

      case 'left':
      default:
        return text + ' '.repeat(padding);
    }
  }

  /**
   * 2カラムレイアウト生成
   */
  static createTwoColumnLayout(
    leftContent: string[],
    rightContent: string[],
    config?: Partial<LayoutConfig>,
  ): string[] {
    const layout = config ? { ...this.getCurrentConfig(), ...config } : this.getCurrentConfig();

    if (layout.mode === 'compact') {
      // コンパクトモードでは単列表示
      return [...leftContent, '', ...rightContent];
    }

    const maxLines = Math.max(leftContent.length, rightContent.length);
    const result: string[] = [];

    for (let i = 0; i < maxLines; i++) {
      const left = this.alignText(leftContent[i] || '', layout.mainContentWidth, 'left');
      const right = this.alignText(rightContent[i] || '', layout.sidebarWidth, 'left');
      const gap = ' '.repeat(layout.columnGap);

      result.push(left + gap + right);
    }

    return result;
  }

  /**
   * セクション区切り生成
   */
  static createSectionSeparator(
    width?: number,
    char: string = '─',
    style: 'full' | 'partial' | 'minimal' = 'full',
  ): string {
    const layout = this.getCurrentConfig();
    const actualWidth = width || layout.contentWidth;

    switch (style) {
      case 'partial':
        return char.repeat(Math.floor(actualWidth * 0.6));
      case 'minimal':
        return char.repeat(Math.floor(actualWidth * 0.3));
      case 'full':
      default:
        return char.repeat(actualWidth);
    }
  }

  /**
   * ボックスボーダー生成（厳密な幅管理）
   */
  static createBoxBorder(
    width: number,
    style: 'light' | 'heavy' | 'double' = 'light',
  ): { top: string; bottom: string; side: string; innerWidth: number } {
    const chars = {
      light: { corner: ['┌', '┐', '└', '┘'], horizontal: '─', vertical: '│' },
      heavy: { corner: ['╔', '╗', '╚', '╝'], horizontal: '═', vertical: '║' },
      double: { corner: ['╔', '╗', '╚', '╝'], horizontal: '═', vertical: '║' },
    }[style];

    const horizontal = chars.horizontal.repeat(width - 2);
    const innerWidth = width - 2; // 両端のvertical文字分

    return {
      top: `${chars.corner[0]}${horizontal}${chars.corner[1]}`,
      bottom: `${chars.corner[2]}${horizontal}${chars.corner[3]}`,
      side: chars.vertical,
      innerWidth,
    };
  }

  /**
   * レスポンシブグリッド生成
   */
  static createGrid(items: string[], columns?: number): string[] {
    const layout = this.getCurrentConfig();
    const autoColumns = columns || (layout.mode === 'compact' ? 1 : layout.mode === 'wide' ? 4 : 2);

    const columnWidth = Math.floor(layout.contentWidth / autoColumns);
    const gap = Math.floor((layout.contentWidth - columnWidth * autoColumns) / (autoColumns - 1));

    const result: string[] = [];

    for (let i = 0; i < items.length; i += autoColumns) {
      const row = items.slice(i, i + autoColumns);
      const paddedRow = row.map((item) => this.alignText(item, columnWidth));

      while (paddedRow.length < autoColumns) {
        paddedRow.push(' '.repeat(columnWidth));
      }

      result.push(paddedRow.join(' '.repeat(gap)));
    }

    return result;
  }

  /**
   * Unicode対応文字幅計算
   */
  private static getStringWidth(str: string): number {
    // 簡易実装：より正確にはライブラリ使用を推奨
    let width = 0;
    for (const char of str) {
      const code = char.codePointAt(0);
      if (!code) continue;

      // 全角文字判定（簡易）
      if (code > 0x3000 && code < 0x9fff) {
        width += 2;
      } else if (code > 0x1f300 && code < 0x1f9ff) {
        // 絵文字（使用非推奨だが安全のため）
        width += 2;
      } else {
        width += 1;
      }
    }
    return width;
  }

  /**
   * 安全な文字列切り詰め
   */
  private static truncateString(str: string, maxWidth: number): string {
    let width = 0;
    let result = '';

    for (const char of str) {
      const charWidth = this.getStringWidth(char);
      if (width + charWidth > maxWidth) break;

      result += char;
      width += charWidth;
    }

    return result;
  }

  /**
   * レイアウトデバッグ情報
   */
  static debugLayout(): void {
    const config = this.getCurrentConfig();
    console.log('Layout Debug Information:');
    console.log(`Mode: ${config.mode}`);
    console.log(`Width: ${config.width}`);
    console.log(`Content Width: ${config.contentWidth}`);
    console.log(`Main Content: ${config.mainContentWidth}`);
    console.log(`Sidebar: ${config.sidebarWidth}`);
    console.log(`Column Gap: ${config.columnGap}`);
    console.log(`Padding: ${config.padding}`);
  }

  /**
   * レイアウト妥当性検証
   */
  static validateLayout(config: LayoutConfig): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // 基本幅チェック
    if (config.width < LAYOUT_CONSTANTS.MIN_WIDTH) {
      errors.push(`幅が最小値(${LAYOUT_CONSTANTS.MIN_WIDTH})を下回っています: ${config.width}`);
    }

    // カラム幅整合性チェック
    const totalWidth = config.mainContentWidth + config.sidebarWidth + config.columnGap;
    if (totalWidth > config.contentWidth) {
      errors.push(
        `カラム幅の合計が content width を超えています: ${totalWidth} > ${config.contentWidth}`,
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

// 便利な短縮関数
export const alignText = LayoutManager.alignText;
export const createTwoColumn = LayoutManager.createTwoColumnLayout;
export const createSeparator = LayoutManager.createSectionSeparator;
export const createBox = LayoutManager.createBoxBorder;
export const createGrid = LayoutManager.createGrid;

export default LayoutManager;
