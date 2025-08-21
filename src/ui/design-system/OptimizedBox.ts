/**
 * Optimized Box Component
 * 効率的なボックス表示システム - ピクセルパーフェクト設計
 * 画面ずれを完全に防ぐ厳密な幅管理
 */

import { LayoutManager, type LayoutConfig, type Alignment } from './LayoutManager.js';
import { SEMANTIC_COLORS, BRAND_COLORS, LAYOUT_COLORS } from './UnifiedColorPalette.js';

// ボックススタイル定義
export type BoxStyle = 'light' | 'heavy' | 'double' | 'rounded' | 'minimal';
export type BoxPadding = 'none' | 'small' | 'medium' | 'large';
export type BoxTheme = 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info' | 'brand';

// ボックス設定インターフェース
export interface BoxOptions {
  width?: number;
  height?: number;
  padding?: BoxPadding | number;
  style?: BoxStyle;
  theme?: BoxTheme;
  title?: string;
  titleAlignment?: Alignment;
  contentAlignment?: Alignment;
  shadow?: boolean;
  responsive?: boolean;
}

// ボックスコンテンツ定義
export interface BoxContent {
  lines: string[];
  metadata?: Record<string, unknown>;
}

/**
 * 最適化ボックスクラス
 */
export class OptimizedBox {
  private config: LayoutConfig;
  private options: Required<BoxOptions>;

  constructor(options: BoxOptions = {}) {
    this.config = LayoutManager.getCurrentConfig();

    // デフォルト設定
    this.options = {
      width: options.width || this.config.contentWidth,
      height: options.height || 0, // 自動計算
      padding: options.padding || 'medium',
      style: options.style || 'light',
      theme: options.theme || 'default',
      title: options.title || '',
      titleAlignment: options.titleAlignment || 'center',
      contentAlignment: options.contentAlignment || 'left',
      shadow: options.shadow || false,
      responsive: options.responsive !== false,
    };

    // レスポンシブ調整
    if (this.options.responsive) {
      this.adjustForCurrentLayout();
    }
  }

  /**
   * ボックス描画（メイン関数）
   */
  render(content: string[] | BoxContent): void {
    const lines = Array.isArray(content) ? content : content.lines;
    const processedLines = this.processContent(lines);

    this.renderBox(processedLines);
  }

  /**
   * 静的メソッド：シンプルボックス
   */
  static simple(content: string[], options: BoxOptions = {}): void {
    const box = new OptimizedBox(options);
    box.render(content);
  }

  /**
   * 静的メソッド：タイトル付きボックス
   */
  static withTitle(title: string, content: string[], options: BoxOptions = {}): void {
    const box = new OptimizedBox({ ...options, title });
    box.render(content);
  }

  /**
   * 静的メソッド：ステータスボックス
   */
  static status(
    status: 'success' | 'error' | 'warning' | 'info',
    content: string[],
    options: BoxOptions = {},
  ): void {
    const themeMap = {
      success: 'success' as BoxTheme,
      error: 'error' as BoxTheme,
      warning: 'warning' as BoxTheme,
      info: 'info' as BoxTheme,
    };

    const box = new OptimizedBox({
      ...options,
      theme: themeMap[status],
      style: 'heavy',
    });
    box.render(content);
  }

  /**
   * 静的メソッド：ブランドボックス（MARIA CODE用）
   */
  static brand(content: string[], options: BoxOptions = {}): void {
    const box = new OptimizedBox({
      ...options,
      theme: 'brand',
      style: 'heavy',
    });
    box.render(content);
  }

  /**
   * レイアウト調整
   */
  private adjustForCurrentLayout(): void {
    this.config = LayoutManager.getCurrentConfig();

    // コンパクトモードでの調整
    if (this.config.mode === 'compact') {
      this.options.width = Math.min(this.options.width, this.config.contentWidth);
      this.options.padding =
        typeof this.options.padding === 'string' ? 'small' : Math.max(1, this.options.padding - 1);
    }

    // ワイドモードでの調整
    if (this.config.mode === 'wide' && this.options.width === this.config.contentWidth) {
      this.options.width = this.config.contentWidth;
    }
  }

  /**
   * コンテンツ処理
   */
  private processContent(lines: string[]): string[] {
    const padding = this.getPaddingSize();
    const contentWidth = this.options.width - 2 - padding * 2; // ボーダーとパディング分

    return lines.map((line) =>
      LayoutManager.alignText(line, contentWidth, this.options.contentAlignment),
    );
  }

  /**
   * ボックス描画実装
   */
  private renderBox(contentLines: string[]): void {
    const { width } = this.options;
    const padding = this.getPaddingSize();
    const colorFn = this.getThemeColor();
    const border = this.getBorderChars();

    // 上ボーダー（タイトル付き）
    this.renderTopBorder(colorFn, border, width);

    // 上パディング
    this.renderPaddingLines(padding, width, colorFn, border.vertical);

    // コンテンツ行
    contentLines.forEach((line) => {
      const paddedLine = ' '.repeat(padding) + line + ' '.repeat(padding);
      console.log(colorFn(border.vertical) + paddedLine + colorFn(border.vertical));
    });

    // 下パディング
    this.renderPaddingLines(padding, width, colorFn, border.vertical);

    // 下ボーダー
    console.log(
      colorFn(border.bottomLeft + border.horizontal.repeat(width - 2) + border.bottomRight),
    );

    // シャドウ効果（オプション）
    if (this.options.shadow) {
      this.renderShadow(width);
    }
  }

  /**
   * 上ボーダー描画（タイトル対応）
   */
  private renderTopBorder(colorFn: Function, border: any, width: number): void {
    if (this.options.title) {
      const titleWidth = width - 4; // ボーダーと余白分
      const title = LayoutManager.alignText(
        this.options.title,
        titleWidth,
        this.options.titleAlignment,
      );

      // タイトル付きボーダー
      console.log(
        colorFn(border.topLeft + border.horizontal + title + border.horizontal + border.topRight),
      );
    } else {
      // 通常のボーダー
      console.log(colorFn(border.topLeft + border.horizontal.repeat(width - 2) + border.topRight));
    }
  }

  /**
   * パディング行描画
   */
  private renderPaddingLines(
    padding: number,
    width: number,
    colorFn: Function,
    vertical: string,
  ): void {
    for (let i = 0; i < padding; i++) {
      console.log(colorFn(vertical) + ' '.repeat(width - 2) + colorFn(vertical));
    }
  }

  /**
   * シャドウ効果描画
   */
  private renderShadow(width: number): void {
    const shadowChar = '▓';
    const shadowColor = SEMANTIC_COLORS.MUTED;

    // 右側と下側にシャドウ
    console.log(' ' + shadowColor(shadowChar.repeat(width)));
    console.log(shadowColor(shadowChar.repeat(width + 1)));
  }

  /**
   * パディングサイズ計算
   */
  private getPaddingSize(): number {
    if (typeof this.options.padding === 'number') {
      return this.options.padding;
    }

    const paddingMap = {
      none: 0,
      small: 1,
      medium: 2,
      large: 3,
    };

    return paddingMap[this.options.padding];
  }

  /**
   * テーマカラー取得
   */
  private getThemeColor(): Function {
    const themeMap = {
      default: LAYOUT_COLORS.BORDER_SECONDARY,
      primary: SEMANTIC_COLORS.PRIMARY,
      success: SEMANTIC_COLORS.SUCCESS,
      warning: SEMANTIC_COLORS.WARNING,
      error: SEMANTIC_COLORS.ERROR,
      info: SEMANTIC_COLORS.INFO,
      brand: BRAND_COLORS.BRAND_PRIMARY,
    };

    return themeMap[this.options.theme];
  }

  /**
   * ボーダー文字取得
   */
  private getBorderChars(): {
    topLeft: string;
    topRight: string;
    bottomLeft: string;
    bottomRight: string;
    horizontal: string;
    vertical: string;
  } {
    const borderMap = {
      light: {
        topLeft: '┌',
        topRight: '┐',
        bottomLeft: '└',
        bottomRight: '┘',
        horizontal: '─',
        vertical: '│',
      },
      heavy: {
        topLeft: '╔',
        topRight: '╗',
        bottomLeft: '╚',
        bottomRight: '╝',
        horizontal: '═',
        vertical: '║',
      },
      double: {
        topLeft: '╔',
        topRight: '╗',
        bottomLeft: '╚',
        bottomRight: '╝',
        horizontal: '═',
        vertical: '║',
      },
      rounded: {
        topLeft: '╭',
        topRight: '╮',
        bottomLeft: '╰',
        bottomRight: '╯',
        horizontal: '─',
        vertical: '│',
      },
      minimal: {
        topLeft: '+',
        topRight: '+',
        bottomLeft: '+',
        bottomRight: '+',
        horizontal: '-',
        vertical: '|',
      },
    };

    return borderMap[this.options.style];
  }

  /**
   * ボックス設定バリデーション
   */
  static validateOptions(options: BoxOptions): {
    isValid: boolean;
    warnings: string[];
  } {
    const warnings: string[] = [];

    // 幅チェック
    if (options.width && options.width < 10) {
      warnings.push('幅が小さすぎます（最小10文字推奨）');
    }

    // パディングチェック
    if (typeof options.padding === 'number' && options.padding < 0) {
      warnings.push('パディングは0以上である必要があります');
    }

    return {
      isValid: warnings.length === 0,
      warnings,
    };
  }

  /**
   * プリセットボックススタイル
   */
  static presets = {
    /**
     * ヘッダーボックス
     */
    header: (content: string[], title?: string): void => {
      OptimizedBox.withTitle(title || 'Header', content, {
        theme: 'brand',
        style: 'heavy',
        padding: 'large',
        titleAlignment: 'center',
      });
    },

    /**
     * 警告ボックス
     */
    warning: (content: string[]): void => {
      OptimizedBox.status('warning', content, {
        style: 'heavy',
        padding: 'medium',
      });
    },

    /**
     * 情報ボックス
     */
    info: (content: string[]): void => {
      OptimizedBox.status('info', content, {
        style: 'light',
        padding: 'small',
      });
    },

    /**
     * コードボックス
     */
    code: (content: string[]): void => {
      OptimizedBox.simple(content, {
        style: 'minimal',
        padding: 'medium',
        theme: 'default',
      });
    },
  };
}

// 便利な短縮関数
export const renderBox = OptimizedBox.simple;
export const renderTitleBox = OptimizedBox.withTitle;
export const renderStatusBox = OptimizedBox.status;
export const renderBrandBox = OptimizedBox.brand;

export default OptimizedBox;
