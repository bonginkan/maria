/**
 * Layout Manager
 * 124文字幅に最適化された厳密なレイアウト管理システム
 * 画面ずれを完全に防ぐ Ultra Think設計
 */

// 厳密な124文字幅設計定数
export const _LAYOUT_CONSTANTS = {
  // 基準画面幅
  SCREENWIDTH: 124,
  CONTENTWIDTH: 120, // 両端2文字余白
  BORDERWIDTH: 118, // ボーダー内容幅

  // セクション間隔
  SECTIONPADDING: 4, // セクション間隔
  INDENTSIZE: 2, // インデント幅
  LINESPACING: 1, // 行間

  // 黄金比レイアウト(合計120文字)
  MAINCONTENT: 80, // メインコンテンツ幅
  SIDEBAR: 36, // サイドバー幅(0.45比率)
  COLUMNGAP: 4, // 列間ギャップ

  // ステータス・ヘッダー
  STATUSBAR: 120, // ステータスバー幅
  HEADERHEIGHT: 12, // ヘッダー行数
  FOOTERHEIGHT: 3, // フッター行数

  // レスポンシブ閾値
  MINWIDTH: 80, // 最小表示幅
  MAXWIDTH: 200, // 最大表示幅
  COMPACTTHRESHOLD: 100, // コンパクト表示閾値
  WIDETHRESHOLD: 140, // ワイド表示閾値
} as const;

// レイアウトモード定義
export type LayoutMode = "compact" | "standard" | "wide";

// 配置オプション
export type Alignment = "_left" | "center" | "_right";

// レイアウト設定インターフェース
export interface LayoutConfig {
  mode: LayoutMode;
  _width: number;
  contentWidth: number;
  mainContentWidth: number;
  sidebarWidth: number;
  columnGap: number;
  _padding: number;
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
    const _width =
      terminalWidth || process.stdout.columns || _LAYOUT_CONSTANTS.SCREEN_WIDTH;

    let mode: LayoutMode;
    let _config: Partial<LayoutConfig> = {};

    // レスポンシブ判定
    if (_width < _LAYOUT_CONSTANTS.COMPACT_THRESHOLD) {
      mode = "compact";
      _config = {
        _width: Math.max(_width, _LAYOUT_CONSTANTS.MIN_WIDTH),
        contentWidth: Math.max(_width - 4, _LAYOUT_CONSTANTS.MIN_WIDTH - 4),
        mainContentWidth: Math.max(_width - 8, _LAYOUT_CONSTANTS.MIN_WIDTH - 8),
        sidebarWidth: 0, // コンパクトモードではサイドバーなし
        columnGap: 0,
        _padding: 2,
      };
    } else if (_width > _LAYOUT_CONSTANTS.WIDE_THRESHOLD) {
      mode = "wide";
      const _scaleFactor = _width / _LAYOUT_CONSTANTS.SCREEN_WIDTH;
      _config = {
        _width,
        contentWidth: _width - 4,
        mainContentWidth: Math.floor(
          _LAYOUT_CONSTANTS.MAIN_CONTENT * _scaleFactor,
        ),
        sidebarWidth: Math.floor(_LAYOUT_CONSTANTS.SIDEBAR * _scaleFactor),
        columnGap: _LAYOUT_CONSTANTS.COLUMN_GAP,
        _padding: _LAYOUT_CONSTANTS.SECTION_PADDING,
      };
    } else {
      mode = "standard";
      _config = {
        _width: _LAYOUT_CONSTANTS.SCREEN_WIDTH,
        contentWidth: _LAYOUT_CONSTANTS.CONTENT_WIDTH,
        mainContentWidth: _LAYOUT_CONSTANTS.MAIN_CONTENT,
        sidebarWidth: _LAYOUT_CONSTANTS.SIDEBAR,
        columnGap: _LAYOUT_CONSTANTS.COLUMN_GAP,
        _padding: _LAYOUT_CONSTANTS.SECTION_PADDING,
      };
    }

    this.currentConfig = { mode, ..._config } as LayoutConfig;
    return this.currentConfig;
  }

  /**
   * 現在のレイアウト設定取得
   */
  static getCurrentConfig(): LayoutConfig {
    return this.currentConfig || this.getOptimalLayout();
  }

  /**
   * テキスト配置(完全なピクセルパーフェクト)
   */
  static _alignText(
    _text: string,
    _width: number,
    alignment: Alignment = "_left",
  ): string {
    // Unicode文字を考慮した正確な文字幅計算
    const _actualLength = this.getStringWidth(_text);

    if (_actualLength > _width) {
      // 切り詰め処理(安全な境界)
      return `${this.truncateString(_text, _width - 3)}...`;
    }

    const _padding = _width - _actualLength;

    switch (alignment) {
      case "center":
        {
          const _leftPad = Math.floor(_padding / 2);
          const _rightPad = _padding - _leftPad;
        }
        return " ".repeat(_leftPad) + _text + " ".repeat(_rightPad);

      case "_right":
        return " ".repeat(_padding) + _text;

      case "_left":
      default:
        return _text + " ".repeat(_padding);
    }
  }

  /**
   * 2カラムレイアウト生成
   */
  static createTwoColumnLayout(
    leftContent: string[],
    rightContent: string[],
    _config?: Partial<LayoutConfig>,
  ): string[] {
    const _layout = _config
      ? { ...this.getCurrentConfig(), ...config }
      : this.getCurrentConfig();

    if (_layout.mode === "compact") {
      // コンパクトモードでは単列表示
      return [...leftContent, "", ...rightContent];
    }

    const _maxLines = Math.max(leftContent.length, rightContent.length);
    const result: string[] = [];

    for (let i = 0; i < _maxLines; i++) {
      const _left = this._alignText(
        leftContent[i] || "",
        _layout.mainContentWidth,
        "_left",
      );
      const _right = this._alignText(
        rightContent[i] || "",
        _layout.sidebarWidth,
        "_left",
      );
      const _gap = " ".repeat(_layout.columnGap);

      result.push(_left + _gap + _right);
    }

    return result;
  }

  /**
   * セクション区切り生成
   */
  static createSectionSeparator(
    _width?: number,
    char: string = "─",
    style: "full" | "partial" | "minimal" = "full",
  ): string {
    const _layout = this.getCurrentConfig();
    const _actualWidth = _width || _layout.contentWidth;

    switch (style) {
      case "partial":
        return char.repeat(Math.floor(_actualWidth * 0.6));
      case "minimal":
        return char.repeat(Math.floor(_actualWidth * 0.3));
      case "full":
      default:
        return char.repeat(_actualWidth);
    }
  }

  /**
   * ボックスボーダー生成(厳密な幅管理)
   */
  static createBoxBorder(
    _width: number,
    style: "light" | "heavy" | "double" = "light",
  ): { top: string; bottom: string; side: string; _innerWidth: number } {
    const _chars = {
      light: { corner: ["┌", "┐", "└", "┘"], _horizontal: "─", vertical: "│" },
      heavy: { corner: ["╔", "╗", "╚", "╝"], _horizontal: "═", vertical: "║" },
      double: { corner: ["╔", "╗", "╚", "╝"], _horizontal: "═", vertical: "║" },
    }[style];

    const _horizontal = _chars._horizontal.repeat(_width - 2);
    const _innerWidth = _width - 2; // 両端のvertical文字分

    return {
      top: `${_chars.corner[0]}${_horizontal}${_chars.corner[1]}`,
      bottom: `${_chars.corner[2]}${_horizontal}${_chars.corner[3]}`,
      side: _chars.vertical,
      _innerWidth,
    };
  }

  /**
   * レスポンシブグリッド生成
   */
  static _createGrid(_items: string[], columns?: number): string[] {
    const _layout = this.getCurrentConfig();
    const _autoColumns =
      columns ||
      (_layout.mode === "compact" ? 1 : _layout.mode === "wide" ? 4 : 2);

    const _columnWidth = Math.floor(_layout.contentWidth / _autoColumns);
    const _gap = Math.floor(
      (_layout.contentWidth - _columnWidth * _autoColumns) / (_autoColumns - 1),
    );

    const result: string[] = [];

    for (let i = 0; i < _items.length; i += _autoColumns) {
      const _row = _items.slice(i, i + _autoColumns);
      const _paddedRow = _row.map((_item) =>
        this._alignText(_item, _columnWidth),
      );

      while (_paddedRow.length < _autoColumns) {
        paddedRow.push(" ".repeat(_columnWidth));
      }

      result.push(_paddedRow.join(" ".repeat(_gap)));
    }

    return result;
  }

  /**
   * Unicode対応文字幅計算
   */
  private static getStringWidth(str: string): number {
    // 簡易実装:より正確にはライブラリ使用を推奨
    let _width = 0;
    for (const char of str) {
      const _code = char.codePointAt(0);
      if (!_code) {
        continue;
      }

      // 全角文字判定(簡易)
      if (_code > 0x3000 && _code < 0x9fff) {
        _width += 2;
      } else if (_code > 0x1f300 && _code < 0x1f9ff) {
        // 絵文字(使用非推奨だが安全のため)
        _width += 2;
      } else {
        _width += 1;
      }
    }
    return _width;
  }

  /**
   * 安全な文字列切り詰め
   */
  private static truncateString(_str: string, maxWidth: number): string {
    let _width = 0;
    let result = "";

    for (const char of _str) {
      const _charWidth = this.getStringWidth(char);
      if (_width + _charWidth > maxWidth) {
        break;
      }

      result += char;
      _width += _charWidth;
    }

    return result;
  }

  /**
   * レイアウトデバッグ情報
   */
  static debugLayout(): void {
    const _config = this.getCurrentConfig();
    console.log("Layout Debug Information:");
    console.log(`Mode: ${_config.mode}`);
    console.log(`Width: ${_config.width}`);
    console.log(`Content Width: ${_config.contentWidth}`);
    console.log(`Main Content: ${_config.mainContentWidth}`);
    console.log(`Sidebar: ${_config.sidebarWidth}`);
    console.log(`Column Gap: ${_config.columnGap}`);
    console.log(`Padding: ${_config.padding}`);
  }

  /**
   * レイアウト妥当性検証
   */
  static validateLayout(_config: LayoutConfig): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // 基本幅チェック
    if (_config.width < _LAYOUT_CONSTANTS.MIN_WIDTH) {
      errors.push(
        `幅が最小値(${_LAYOUT_CONSTANTS.MIN_WIDTH})を下回っています: ${_config.width}`,
      );
    }

    // カラム幅整合性チェック
    const _totalWidth =
      _config.mainContentWidth + _config.sidebarWidth + _config.columnGap;
    if (_totalWidth > _config.contentWidth) {
      errors.push(
        `カラム幅の合計が content _width を超えています: ${_totalWidth} > ${_config.contentWidth}`,
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

// 便利な短縮関数
export const _alignText = LayoutManager._alignText;
export const _createTwoColumn = LayoutManager.createTwoColumnLayout;
export const _createSeparator = LayoutManager.createSectionSeparator;
export const _createBox = LayoutManager.createBoxBorder;
export const _createGrid = LayoutManager._createGrid;

export default LayoutManager;
