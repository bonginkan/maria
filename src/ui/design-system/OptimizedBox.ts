/**
 * Optimized Box Component
 * 効率的なボックス表示システム - ピクセルパーフェクト設計
 * 画面ずれを完全に防ぐ厳密な幅管理
 */

import {
  type Alignment,
  type LayoutConfig,
  LayoutManager,
} from "./LayoutManager.js";
import {
  BRAND_COLORS,
  LAYOUT_COLORS,
  SEMANTIC_COLORS,
} from "./UnifiedColorPalette.js";

// ボックススタイル定義
export type BoxStyle = "light" | "heavy" | "double" | "rounded" | "minimal";
export type BoxPadding = "none" | "small" | "medium" | "large";
export type BoxTheme =
  | "default"
  | "primary"
  | "success"
  | "warning"
  | "error"
  | "info"
  | "brand";

// ボックス設定インターフェース
export interface BoxOptions {
  width?: number;
  height?: number;
  _padding?: BoxPadding | number;
  style?: BoxStyle;
  theme?: BoxTheme;
  _title?: string;
  titleAlignment?: Alignment;
  contentAlignment?: Alignment;
  shadow?: boolean;
  responsive?: boolean;
}

// ボックスコンテンツ定義
export interface BoxContent {
  _lines: string[];
  metadata?: Record<string, unknown>;
}

/**
 * 最適化ボックスクラス
 */
export class OptimizedBox {
  private config: LayoutConfig;
  private options: Required<BoxOptions>;

  constructor(_options: BoxOptions = {}) {
    this.config = LayoutManager.getCurrentConfig();

    // デフォルト設定
    this._options = {
      width: _options.width || this.config.contentWidth,
      height: _options.height || 0, // 自動計算
      _padding: _options.padding || "medium",
      style: _options.style || "light",
      theme: _options.theme || "default",
      _title: _options.title || "",
      titleAlignment: _options.titleAlignment || "center",
      contentAlignment: _options.contentAlignment || "left",
      shadow: _options.shadow || false,
      responsive: _options.responsive !== false,
    };

    // レスポンシブ調整
    if (this._options.responsive) {
      this.adjustForCurrentLayout();
    }
  }

  /**
   * ボックス描画(メイン関数)
   */
  render(content: string[] | BoxContent): void {
    const _lines = Array.isArray(content) ? content : content._lines;
    const _processedLines = this.processContent(_lines);

    this._renderBox(_processedLines);
  }

  /**
   * 静的メソッド:シンプルボックス
   */
  static simple(_content: string[], options: BoxOptions = {}): void {
    const _box = new OptimizedBox(options);
    box.render(_content);
  }

  /**
   * 静的メソッド:タイトル付きボックス
   */
  static withTitle(
    _title: string,
    content: string[],
    options: BoxOptions = {},
  ): void {
    const _box = new OptimizedBox({ ...options, _title });
    box.render(content);
  }

  /**
   * 静的メソッド:ステータスボックス
   */
  static status(
    status: "success" | "error" | "warning" | "info",
    content: string[],
    options: BoxOptions = {},
  ): void {
    const _themeMap = {
      success: "success" as BoxTheme,
      error: "error" as BoxTheme,
      warning: "warning" as BoxTheme,
      info: "info" as BoxTheme,
    };

    const _box = new OptimizedBox({
      ...options,
      theme: _themeMap[status],
      style: "heavy",
    });
    box.render(content);
  }

  /**
   * 静的メソッド:ブランドボックス(MARIA CODE用)
   */
  static brand(_content: string[], options: BoxOptions = {}): void {
    const _box = new OptimizedBox({
      ...options,
      theme: "brand",
      style: "heavy",
    });
    box.render(_content);
  }

  /**
   * レイアウト調整
   */
  private adjustForCurrentLayout(): void {
    this.config = LayoutManager.getCurrentConfig();

    // コンパクトモードでの調整
    if (this.config.mode === "compact") {
      this.options.width = Math.min(
        this.options.width,
        this.config.contentWidth,
      );
      this.options.padding =
        typeof this.options.padding === "string"
          ? "small"
          : Math.max(1, this.options.padding - 1);
    }

    // ワイドモードでの調整
    if (
      this.config.mode === "wide" &&
      this.options.width === this.config.contentWidth
    ) {
      this.options.width = this.config.contentWidth;
    }
  }

  /**
   * コンテンツ処理
   */
  private processContent(_lines: string[]): string[] {
    const _padding = this.getPaddingSize();
    const _contentWidth = this.options.width - 2 - _padding * 2; // ボーダーとパディング分

    return _lines.map((line) =>
      LayoutManager.alignText(
        line,
        _contentWidth,
        this.options.contentAlignment,
      ),
    );
  }

  /**
   * ボックス描画実装
   */
  private _renderBox(contentLines: string[]): void {
    const { width } = this.options;
    const _padding = this.getPaddingSize();
    const _colorFn = this.getThemeColor();
    const _border = this.getBorderChars();

    // 上ボーダー(タイトル付き)
    this.renderTopBorder(_colorFn, _border, width);

    // 上パディング
    this.renderPaddingLines(_padding, width, _colorFn, _border.vertical);

    // コンテンツ行
    contentLines.forEach((line) => {
      const _paddedLine = " ".repeat(_padding) + line + " ".repeat(_padding);
      console.log(
        _colorFn(_border.vertical) + _paddedLine + _colorFn(_border.vertical),
      );
    });

    // 下パディング
    this.renderPaddingLines(_padding, width, _colorFn, _border.vertical);

    // 下ボーダー
    console.log(
      _colorFn(
        _border.bottomLeft +
          _border.horizontal.repeat(width - 2) +
          _border.bottomRight,
      ),
    );

    // シャドウ効果(オプション)
    if (this.options.shadow) {
      this.renderShadow(width);
    }
  }

  /**
   * 上ボーダー描画(タイトル対応)
   */
  private renderTopBorder(
    _colorFn: (...args: any[]) => any,
    _border: unknown,
    width: number,
  ): void {
    if (this.options._title) {
      const _titleWidth = width - 4; // ボーダーと余白分
      const _title = LayoutManager.alignText(
        this.options._title,
        _titleWidth,
        this.options.titleAlignment,
      );

      // タイトル付きボーダー
      console.log(
        _colorFn(
          _border.topLeft +
            _border.horizontal +
            _title +
            _border.horizontal +
            _border.topRight,
        ),
      );
    } else {
      // 通常のボーダー
      console.log(
        _colorFn(
          _border.topLeft +
            _border.horizontal.repeat(width - 2) +
            _border.topRight,
        ),
      );
    }
  }

  /**
   * パディング行描画
   */
  private renderPaddingLines(
    _padding: number,
    width: number,
    _colorFn: (...args: any[]) => any,
    vertical: string,
  ): void {
    for (let i = 0; i < _padding; i++) {
      console.log(
        _colorFn(vertical) + " ".repeat(width - 2) + _colorFn(vertical),
      );
    }
  }

  /**
   * シャドウ効果描画
   */
  private renderShadow(width: number): void {
    const _shadowChar = "▓";
    const _shadowColor = SEMANTIC_COLORS.MUTED;

    // 右側と下側にシャドウ
    console.log(` ${_shadowColor(_shadowChar.repeat(width))}`);
    console.log(_shadowColor(_shadowChar.repeat(width + 1)));
  }

  /**
   * パディングサイズ計算
   */
  private getPaddingSize(): number {
    if (typeof this.options.padding === "number") {
      return this.options.padding;
    }

    const _paddingMap = {
      none: 0,
      small: 1,
      medium: 2,
      large: 3,
    };

    return _paddingMap[this.options.padding];
  }

  /**
   * テーマカラー取得
   */
  private getThemeColor(): (...args: any[]) => any {
    const _themeMap = {
      default: LAYOUT_COLORS.BORDER_SECONDARY,
      primary: SEMANTIC_COLORS.PRIMARY,
      success: SEMANTIC_COLORS.SUCCESS,
      warning: SEMANTIC_COLORS.WARNING,
      error: SEMANTIC_COLORS.ERROR,
      info: SEMANTIC_COLORS.INFO,
      brand: BRAND_COLORS.BRAND_PRIMARY,
    };

    return _themeMap[this.options.theme];
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
    const _borderMap = {
      light: {
        topLeft: "┌",
        topRight: "┐",
        bottomLeft: "└",
        bottomRight: "┘",
        horizontal: "─",
        vertical: "│",
      },
      heavy: {
        topLeft: "╔",
        topRight: "╗",
        bottomLeft: "╚",
        bottomRight: "╝",
        horizontal: "═",
        vertical: "║",
      },
      double: {
        topLeft: "╔",
        topRight: "╗",
        bottomLeft: "╚",
        bottomRight: "╝",
        horizontal: "═",
        vertical: "║",
      },
      rounded: {
        topLeft: "╭",
        topRight: "╮",
        bottomLeft: "╰",
        bottomRight: "╯",
        horizontal: "─",
        vertical: "│",
      },
      minimal: {
        topLeft: "+",
        topRight: "+",
        bottomLeft: "+",
        bottomRight: "+",
        horizontal: "-",
        vertical: "|",
      },
    };

    return _borderMap[this.options.style];
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
      warnings.push("幅が小さすぎます(最小10文字推奨)");
    }

    // パディングチェック
    if (typeof options.padding === "number" && options.padding < 0) {
      warnings.push("パディングは0以上である必要があります");
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
    header: (_content: string[], _title?: string): void => {
      OptimizedBox.withTitle(_title || "Header", _content, {
        theme: "brand",
        style: "heavy",
        _padding: "large",
        titleAlignment: "center",
      });
    },

    /**
     * 警告ボックス
     */
    warning: (content: string[]): void => {
      OptimizedBox.status("warning", content, {
        style: "heavy",
        _padding: "medium",
      });
    },

    /**
     * 情報ボックス
     */
    info: (content: string[]): void => {
      OptimizedBox.status("info", content, {
        style: "light",
        _padding: "small",
      });
    },

    /**
     * コードボックス
     */
    code: (content: string[]): void => {
      OptimizedBox.simple(content, {
        style: "minimal",
        _padding: "medium",
        theme: "default",
      });
    },
  };
}

// 便利な短縮関数
export const _renderBox = OptimizedBox.simple;
export const _renderTitleBox = OptimizedBox.withTitle;
export const _renderStatusBox = OptimizedBox.status;
export const _renderBrandBox = OptimizedBox.brand;

export default OptimizedBox;
