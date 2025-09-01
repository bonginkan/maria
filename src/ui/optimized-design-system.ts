/**
 * Optimized Design System
 * 124文字画面幅に最適化された統一デザインシステム
 */

import chalk from "chalk";

// Responsive design constants
export const DESIGN_CONSTANTS = {
  // Legacy fixed width constants (deprecated, kept for compatibility)
  SCREENWIDTH: 124,
  BORDERWIDTH: 118,
  SECTIONPADDING: 4,
  INDENTSIZE: 2,
  
  // Responsive width configuration
  CONTENT_MIN: 40,    // Minimum content width
  CONTENT_MAX: 200,   // Maximum content width
  MARGIN_LEFT: 5,     // Left margin
  MARGIN_RIGHT: 5,    // Right margin
  
  // Dynamic calculations based on actual width
  MAINCONTENT: 80,    // Default main content width
  SIDEBAR: 36,        // Default sidebar width
  STATUSBAR: 120,     // Default status bar width
  
  // Backward compatibility getter (deprecated)
  get CONTENTWIDTH() {
    if (process.env.NODE_ENV !== 'test') {
      console.warn('DESIGN_CONSTANTS.CONTENTWIDTH is deprecated. Use getResponsiveWidth() from responsive-width module');
    }
    return 120; // Return legacy default
  },
  
  // Backward compatibility getter (deprecated)
  get CONTENT_WIDTH() {
    if (process.env.NODE_ENV !== 'test') {
      console.warn('DESIGN_CONSTANTS.CONTENT_WIDTH is deprecated. Use getResponsiveWidth() from responsive-width module');
    }
    return 120; // Return legacy default
  }
} as const;

// ミニマルアイコンシステム(必要最小限の6個のみ)
export const MINIMAL_ICONS = {
  SUCCESS: "✓", // シンプルなチェック
  ERROR: "✗", // シンプルなX
  WARNING: "!", // 感嘆符のみ
  INFO: "i", // 小文字i
  LOADING: "◯", // シンプルな円
  ARROW: "→", // 右矢印
} as const;

// 統一色彩システム(7色パレット)
export const UNIFIED_COLORS = {
  // Primary Colors (メイン4色)
  PRIMARY: chalk.cyan, // メインアクション、ヘッダー
  SUCCESS: chalk.green, // 成功状態、完了
  WARNING: chalk.yellow, // 警告、注意
  ERROR: chalk.red, // エラー、失敗

  // Secondary Colors (補助3色)
  INFO: chalk.blue, // 情報表示
  MUTED: chalk.gray, // 補助情報、メタデータ
  ACCENT: chalk.magenta, // アクセント、ブランド
} as const;

// テキスト階層システム
export const TEXT_HIERARCHY = {
  TITLE: chalk.bold.cyan,
  SUBTITLE: chalk.cyan,
  BODY: chalk.white,
  CAPTION: chalk.gray,
  DISABLED: chalk.dim.gray,
} as const;

// レイアウトヘルパー関数
export class LayoutHelpers {
  /**
   * テキストを指定幅で中央配置
   */
  static centerText(
    text: string,
    width: number,
    colorFn?: (...args: unknown[]) => unknown,
  ): string {
    const padding = Math.max(0, Math.floor((width - text.length) / 2));
    const rightPadding = Math.max(0, width - text.length - padding);
    const coloredText = colorFn ? colorFn(text) : text;
    return " ".repeat(padding) + coloredText + " ".repeat(rightPadding);
  }

  /**
   * テキストを左寄せで指定幅にパッド
   */
  static leftPad(text: string, width: number): string {
    return text.padEnd(width).slice(0, width);
  }

  /**
   * テキストを右寄せで指定幅にパッド
   */
  static rightPad(text: string, width: number): string {
    return text.padStart(width).slice(-width);
  }

  /**
   * 水平区切り線を生成
   */
  static horizontalRule(
    width: number = DESIGN_CONSTANTS.CONTENT_WIDTH,
    char: string = "─",
  ): string {
    return char.repeat(width);
  }

  /**
   * ボックスボーダーを生成
   */
  static boxBorder(
    width: number,
    style: "light" | "heavy" = "light",
  ): { top: string; bottom: string; sides: string } {
    const chars =
      style === "heavy"
        ? {
            topLeft: "╔",
            topRight: "╗",
            bottomLeft: "╚",
            bottomRight: "╝",
            horizontal: "═",
            vertical: "║",
          }
        : {
            topLeft: "┌",
            topRight: "┐",
            bottomLeft: "└",
            bottomRight: "┘",
            horizontal: "─",
            vertical: "│",
          };

    const horizontal = chars.horizontal.repeat(width - 2);

    return {
      top: `${chars.topLeft}${horizontal}${chars.topRight}`,
      bottom: `${chars.bottomLeft}${horizontal}${chars.bottomRight}`,
      sides: chars.vertical,
    };
  }
}

// 最適化されたコンポーネント
export class OptimizedComponents {
  /**
   * 美しいボックスコンポーネント
   */
  static renderBox(
    content: string[],
    options: {
      width?: number;
      padding?: number;
      style?: "light" | "heavy";
      color?: (...args: unknown[]) => unknown;
    } = {},
  ): void {
    const width = options.width || DESIGN_CONSTANTS.CONTENT_WIDTH;
    const padding = options.padding || 2;
    const color = options.color || UNIFIED_COLORS.PRIMARY;
    const innerWidth = width - padding * 2 - 2;

    const border = LayoutHelpers.boxBorder(width, options.style);

    console.log(color(border.top));

    // 空行(上パディング)
    if (padding > 0) {
      console.log(
        color(border.sides) + " ".repeat(width - 2) + color(border.sides),
      );
    }

    // コンテンツ行
    content.forEach((line) => {
      const paddedLine =
        " ".repeat(padding) +
        LayoutHelpers.leftPad(line, innerWidth) +
        " ".repeat(padding);
      console.log(color(border.sides) + paddedLine + color(border.sides));
    });

    // 空行(下パディング)
    if (padding > 0) {
      console.log(
        color(border.sides) + " ".repeat(width - 2) + color(border.sides),
      );
    }

    console.log(color(border.bottom));
  }

  /**
   * プログレスバーコンポーネント
   */
  static renderProgress(
    progress: number,
    options: {
      width?: number;
      showPercentage?: boolean;
      label?: string;
    } = {},
  ): void {
    const width = options.width || 90;
    const showPercentage = options.showPercentage !== false;

    const filled = Math.floor((progress / 100) * width);
    const empty = width - filled;

    const bar =
      UNIFIED_COLORS.SUCCESS("█".repeat(filled)) +
      UNIFIED_COLORS.MUTED("░".repeat(empty));

    let output = bar;

    if (showPercentage) {
      const percentage = TEXT_HIERARCHY.BODY(`${progress}%`).padStart(5);
      output += ` ${percentage}`;
    }

    if (options.label) {
      output = `${TEXT_HIERARCHY.CAPTION(options.label)} ${output}`;
    }

    console.log(output);
  }

  /**
   * ステータス表示コンポーネント
   */
  static renderStatus(
    status: "success" | "error" | "warning" | "info",
    message: string,
  ): void {
    const icons = {
      success: UNIFIED_COLORS.SUCCESS(MINIMAL_ICONS.SUCCESS),
      error: UNIFIED_COLORS.ERROR(MINIMAL_ICONS.ERROR),
      warning: UNIFIED_COLORS.WARNING(MINIMAL_ICONS.WARNING),
      info: UNIFIED_COLORS.INFO(MINIMAL_ICONS.INFO),
    };

    console.log(`${icons[status]} ${TEXT_HIERARCHY.BODY(message)}`);
  }

  /**
   * 2カラムレイアウト
   */
  static renderTwoColumn(
    leftContent: string[],
    rightContent: string[],
    options: { gap?: number } = {},
  ): void {
    const gap = options.gap || 4;
    const leftWidth = DESIGN_CONSTANTS.MAIN_CONTENT;
    const rightWidth = DESIGN_CONSTANTS.SIDEBAR;

    const maxLines = Math.max(leftContent.length, rightContent.length);

    for (let i = 0; i < maxLines; i++) {
      const left = LayoutHelpers.leftPad(leftContent[i] || "", leftWidth);
      const right = LayoutHelpers.leftPad(rightContent[i] || "", rightWidth);

      console.log(left + " ".repeat(gap) + right);
    }
  }

  /**
   * セクションヘッダー
   */
  static renderSectionHeader(title: string, width?: number): void {
    const contentWidth = width || DESIGN_CONSTANTS.CONTENT_WIDTH;

    console.log(TEXT_HIERARCHY.TITLE(title));
    console.log(
      UNIFIED_COLORS.MUTED(LayoutHelpers.horizontalRule(contentWidth)),
    );
  }
}

// エクスポート用の統合オブジェクト
export const OptimizedDesignSystem = {
  CONSTANTS: DESIGN_CONSTANTS,
  ICONS: MINIMAL_ICONS,
  COLORS: UNIFIED_COLORS,
  TEXT: TEXT_HIERARCHY,
  Layout: LayoutHelpers,
  Components: OptimizedComponents,
} as const;

export default OptimizedDesignSystem;
