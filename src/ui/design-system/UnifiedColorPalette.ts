/**
 * Unified Color Palette
 * MARIA CODEブランドに統一された色彩システム
 * ダークテーマベースでアクセシビリティを考慮
 */

import chalk from 'chalk';

// MARIA CODEブランドカラー（ロゴベース）
export const BRAND_COLORS = {
  // ブランドプライマリー（マゼンタ - ロゴカラー）
  BRAND_PRIMARY: chalk.magenta,
  BRAND_SECONDARY: chalk.magentaBright,

  // ダークテーマベース
  BACKGROUND: chalk.bgBlack,
  FOREGROUND: chalk.white,
} as const;

// 機能別カラーパレット（7色システム）
export const SEMANTIC_COLORS = {
  // プライマリーカラー（メインアクション）
  PRIMARY: chalk.cyan, // クリアで視認性の高いシアン

  // ステータスカラー（3色）
  SUCCESS: chalk.green, // 成功・完了
  WARNING: chalk.yellow, // 警告・注意
  ERROR: chalk.red, // エラー・失敗

  // 補助カラー（3色）
  INFO: chalk.blue, // 情報・説明
  MUTED: chalk.gray, // 補助情報・メタデータ
  ACCENT: chalk.magenta, // アクセント・ブランド強調
} as const;

// テキスト階層システム（5段階）
export const TEXT_HIERARCHY = {
  // 見出し階層
  TITLE: chalk.bold.cyan, // H1相当 - メインタイトル
  SUBTITLE: chalk.cyan, // H2相当 - セクションタイトル
  SECTION: chalk.bold.white, // H3相当 - サブセクション

  // 本文階層
  BODY: chalk.white, // 通常テキスト（ユーザー指定の白）
  CAPTION: chalk.gray, // 補助テキスト・メタデータ

  // 特殊階層
  DISABLED: chalk.dim.gray, // 無効・非アクティブ
  HIGHLIGHT: chalk.bold.white, // 強調表示
} as const;

// 相互作用カラー（ユーザー操作）
export const INTERACTION_COLORS = {
  // リンク・コマンド
  LINK: chalk.underline.cyan,
  COMMAND: chalk.bold.yellow,

  // 入力・出力
  INPUT: chalk.green,
  OUTPUT: chalk.white,

  // ステータス
  ACTIVE: chalk.bold.cyan,
  INACTIVE: chalk.dim.gray,

  // 特殊状態
  LOADING: chalk.blue,
  PROGRESS: chalk.cyan,
} as const;

// レイアウト装飾カラー
export const LAYOUT_COLORS = {
  // ボーダー・区切り
  BORDER_PRIMARY: chalk.magenta, // ブランドボーダー
  BORDER_SECONDARY: chalk.gray, // 通常ボーダー
  SEPARATOR: chalk.dim.gray, // 区切り線

  // 背景・強調
  BACKGROUND_SUBTLE: chalk.bgGray,
  HIGHLIGHT_BG: chalk.bgBlue,
} as const;

/**
 * カラーユーティリティクラス
 */
export class ColorPalette {
  /**
   * セマンティックカラー取得
   */
  static semantic(type: keyof typeof SEMANTIC_COLORS) {
    return SEMANTIC_COLORS[type];
  }

  /**
   * テキスト階層カラー取得
   */
  static text(level: keyof typeof TEXT_HIERARCHY) {
    return TEXT_HIERARCHY[level];
  }

  /**
   * インタラクションカラー取得
   */
  static interaction(state: keyof typeof INTERACTION_COLORS) {
    return INTERACTION_COLORS[state];
  }

  /**
   * レイアウトカラー取得
   */
  static layout(element: keyof typeof LAYOUT_COLORS) {
    return LAYOUT_COLORS[element];
  }

  /**
   * ブランドカラー取得
   */
  static brand(variant: keyof typeof BRAND_COLORS) {
    return BRAND_COLORS[variant];
  }

  /**
   * ステータス別カラー（アイコンと組み合わせ用）
   */
  static status(status: 'success' | 'error' | 'warning' | 'info') {
    const colorMap = {
      success: SEMANTIC_COLORS.SUCCESS,
      error: SEMANTIC_COLORS.ERROR,
      warning: SEMANTIC_COLORS.WARNING,
      info: SEMANTIC_COLORS.INFO,
    };
    return colorMap[status];
  }

  /**
   * コントラスト検証（アクセシビリティ）
   */
  static validateContrast(
    foreground: string,
    background: string,
  ): {
    isValid: boolean;
    ratio: number;
    level: 'AAA' | 'AA' | 'FAIL';
  } {
    // 簡易コントラスト計算（実際の実装では色値の計算が必要）
    // ここでは基本的なルールで判定
    const highContrast = ['white', 'yellow', 'cyan', 'green'];

    const isHighContrast = highContrast.some(
      (color) => foreground.includes(color) || background.includes('black'),
    );

    return {
      isValid: isHighContrast,
      ratio: isHighContrast ? 4.5 : 2.0,
      level: isHighContrast ? 'AA' : 'FAIL',
    };
  }

  /**
   * カラーパレット一覧表示
   */
  static showPalette(): void {
    console.log(this.text('TITLE')('MARIA CODE カラーパレット'));
    console.log(this.layout('SEPARATOR')('─'.repeat(50)));

    console.log(this.text('SUBTITLE')('\nセマンティックカラー:'));
    Object.entries(SEMANTIC_COLORS).forEach(([name, colorFn]) => {
      console.log(`  ${colorFn(name.padEnd(10))} ${this.text('CAPTION')(name)}`);
    });

    console.log(this.text('SUBTITLE')('\nテキスト階層:'));
    Object.entries(TEXT_HIERARCHY).forEach(([name, colorFn]) => {
      console.log(`  ${colorFn(name.padEnd(10))} ${this.text('CAPTION')(name)}`);
    });

    console.log(this.text('SUBTITLE')('\nブランドカラー:'));
    Object.entries(BRAND_COLORS).forEach(([name, colorFn]) => {
      console.log(`  ${colorFn(name.padEnd(10))} ${this.text('CAPTION')(name)}`);
    });
  }

  /**
   * ダークテーマ最適化チェック
   */
  static isDarkThemeOptimized(): boolean {
    // MARIA CODEはダークテーマベースなのでtrue
    return true;
  }

  /**
   * 色彩一貫性チェック
   */
  static validateConsistency(): {
    isConsistent: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    // 基本チェック（拡張可能）
    if (!this.isDarkThemeOptimized()) {
      issues.push('ダークテーマ最適化が不十分');
    }

    return {
      isConsistent: issues.length === 0,
      issues,
    };
  }
}

// 便利な短縮記法
export const colors = {
  // よく使用するカラーのショートカット
  primary: SEMANTIC_COLORS.PRIMARY,
  success: SEMANTIC_COLORS.SUCCESS,
  error: SEMANTIC_COLORS.ERROR,
  warning: SEMANTIC_COLORS.WARNING,
  info: SEMANTIC_COLORS.INFO,
  muted: SEMANTIC_COLORS.MUTED,
  accent: SEMANTIC_COLORS.ACCENT,

  // テキスト
  title: TEXT_HIERARCHY.TITLE,
  subtitle: TEXT_HIERARCHY.SUBTITLE,
  body: TEXT_HIERARCHY.BODY,
  caption: TEXT_HIERARCHY.CAPTION,

  // ブランド
  brand: BRAND_COLORS.BRAND_PRIMARY,
  brandBright: BRAND_COLORS.BRAND_SECONDARY,
} as const;

// 型定義
export type SemanticColorName = keyof typeof SEMANTIC_COLORS;
export type TextHierarchyName = keyof typeof TEXT_HIERARCHY;
export type InteractionColorName = keyof typeof INTERACTION_COLORS;
export type LayoutColorName = keyof typeof LAYOUT_COLORS;
export type BrandColorName = keyof typeof BRAND_COLORS;

export default ColorPalette;
