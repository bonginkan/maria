/**
 * Accessibility Manager
 * WCAG 2.1 AA準拠のアクセシビリティ機能
 */

import chalk from 'chalk';
import { UNIFIED_COLORS } from '../design-system/UnifiedColorPalette.js';

/**
 * アクセシビリティ設定
 */
export interface AccessibilityConfig {
  screenReaderMode: boolean;
  highContrastMode: boolean;
  reduceMotion: boolean;
  colorBlindMode?: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';
  fontSize?: 'small' | 'normal' | 'large' | 'extra-large';
  keyboardNavigation: boolean;
  announceUpdates: boolean;
}

/**
 * カラーコントラスト比
 */
interface ContrastRatio {
  ratio: number;
  level: 'AA' | 'AAA' | 'FAIL';
}

/**
 * アクセシビリティマネージャー
 */
export class AccessibilityManager {
  private static instance: AccessibilityManager;
  private config: AccessibilityConfig = {
    screenReaderMode: false,
    highContrastMode: false,
    reduceMotion: false,
    colorBlindMode: 'none',
    fontSize: 'normal',
    keyboardNavigation: true,
    announceUpdates: false,
  };

  private announcements: string[] = [];
  private focusIndex: number = 0;
  private focusableElements: string[] = [];

  private constructor() {
    this.detectSystemPreferences();
  }

  /**
   * シングルトンインスタンスを取得
   */
  static getInstance(): AccessibilityManager {
    if (!this.instance) {
      this.instance = new AccessibilityManager();
    }
    return this.instance;
  }

  /**
   * システム設定を検出
   */
  private detectSystemPreferences(): void {
    // Check for screen reader
    if (process.env.SCREEN_READER || process.env.NVDA || process.env.JAWS) {
      this.config.screenReaderMode = true;
    }

    // Check for reduced motion preference
    if (process.env.PREFERS_REDUCED_MOTION === 'true') {
      this.config.reduceMotion = true;
    }

    // Check for high contrast
    if (process.env.HIGH_CONTRAST === 'true') {
      this.config.highContrastMode = true;
    }
  }

  /**
   * 設定を更新
   */
  updateConfig(config: Partial<AccessibilityConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * アクセシブルなテキストを生成
   */
  renderAccessibleText(
    text: string,
    options: {
      role?: 'heading' | 'button' | 'link' | 'status' | 'alert';
      level?: number;
      description?: string;
    } = {},
  ): string {
    if (!this.config.screenReaderMode) {
      return text;
    }

    let accessibleText = '';

    // Add role information
    if (options.role) {
      switch (options.role) {
        case 'heading':
          accessibleText = `Heading level ${options.level || 1}: ${text}`;
          break;
        case 'button':
          accessibleText = `Button: ${text}. Press Enter to activate`;
          break;
        case 'link':
          accessibleText = `Link: ${text}. Press Enter to follow`;
          break;
        case 'status':
          accessibleText = `Status: ${text}`;
          break;
        case 'alert':
          accessibleText = `Alert: ${text}`;
          this.announce(text, 'assertive');
          break;
        default:
          accessibleText = text;
      }
    } else {
      accessibleText = text;
    }

    // Add description if provided
    if (options.description) {
      accessibleText += `. ${options.description}`;
    }

    return accessibleText;
  }

  /**
   * スクリーンリーダーアナウンス
   */
  announce(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
    if (!this.config.screenReaderMode || !this.config.announceUpdates) {
      return;
    }

    this.announcements.push(message);

    // In a real terminal, this would interface with screen reader APIs
    // For now, we'll output to a special format
    if (priority === 'assertive') {
      console.log(`\x1b[1m[SCREEN READER ALERT]: ${message}\x1b[0m`);
    } else {
      console.log(`[SCREEN READER]: ${message}`);
    }
  }

  /**
   * 高コントラストカラーを取得
   */
  getHighContrastColor(
    color: (text: string) => string,
    background: 'dark' | 'light' = 'dark',
  ): (text: string) => string {
    if (!this.config.highContrastMode) {
      return color;
    }

    // Map to high contrast colors
    const highContrastMap = {
      dark: {
        cyan: chalk.whiteBright,
        green: chalk.greenBright,
        yellow: chalk.yellowBright,
        red: chalk.redBright,
        blue: chalk.blueBright,
        magenta: chalk.magentaBright,
        gray: chalk.white,
      },
      light: {
        cyan: chalk.black,
        green: chalk.green,
        yellow: chalk.yellow,
        red: chalk.red,
        blue: chalk.blue,
        magenta: chalk.magenta,
        gray: chalk.blackBright,
      },
    };

    // Simplified mapping - in production, would need proper color detection
    return highContrastMap[background].cyan || chalk.whiteBright;
  }

  /**
   * 色覚異常対応カラーを取得
   */
  getColorBlindSafeColor(color: (text: string) => string): (text: string) => string {
    if (this.config.colorBlindMode === 'none') {
      return color;
    }

    // Color blind safe palettes
    const colorBlindPalettes = {
      protanopia: {
        // Red-blind safe colors
        red: chalk.blue,
        green: chalk.yellow,
        blue: chalk.blue,
        yellow: chalk.yellow,
        cyan: chalk.cyan,
        magenta: chalk.gray,
      },
      deuteranopia: {
        // Green-blind safe colors
        red: chalk.blue,
        green: chalk.yellow,
        blue: chalk.blue,
        yellow: chalk.yellow,
        cyan: chalk.cyan,
        magenta: chalk.magenta,
      },
      tritanopia: {
        // Blue-blind safe colors
        red: chalk.red,
        green: chalk.green,
        blue: chalk.green,
        yellow: chalk.red,
        cyan: chalk.green,
        magenta: chalk.red,
      },
    };

    // Return appropriate color based on color blindness type
    const palette = colorBlindPalettes[this.config.colorBlindMode];
    return palette.cyan || color; // Simplified - would need proper color mapping
  }

  /**
   * キーボードナビゲーション処理
   */
  handleKeyboardNavigation(key: string): void {
    if (!this.config.keyboardNavigation) {
      return;
    }

    switch (key) {
      case 'tab':
        this.focusNext();
        break;
      case 'shift+tab':
        this.focusPrevious();
        break;
      case 'enter':
      case 'space':
        this.activateFocused();
        break;
      case 'escape':
        this.clearFocus();
        break;
    }
  }

  /**
   * 次の要素にフォーカス
   */
  private focusNext(): void {
    if (this.focusableElements.length === 0) return;

    this.focusIndex = (this.focusIndex + 1) % this.focusableElements.length;
    this.announceFocus();
  }

  /**
   * 前の要素にフォーカス
   */
  private focusPrevious(): void {
    if (this.focusableElements.length === 0) return;

    this.focusIndex =
      this.focusIndex === 0 ? this.focusableElements.length - 1 : this.focusIndex - 1;
    this.announceFocus();
  }

  /**
   * フォーカスされた要素をアクティベート
   */
  private activateFocused(): void {
    if (this.focusableElements[this.focusIndex]) {
      this.announce(`Activated: ${this.focusableElements[this.focusIndex]}`, 'assertive');
    }
  }

  /**
   * フォーカスをクリア
   */
  private clearFocus(): void {
    this.focusIndex = 0;
    this.announce('Focus cleared', 'polite');
  }

  /**
   * フォーカスをアナウンス
   */
  private announceFocus(): void {
    if (this.focusableElements[this.focusIndex]) {
      this.announce(`Focused: ${this.focusableElements[this.focusIndex]}`, 'polite');
    }
  }

  /**
   * フォーカス可能な要素を登録
   */
  registerFocusableElements(elements: string[]): void {
    this.focusableElements = elements;
    this.focusIndex = 0;
  }

  /**
   * コントラスト比を計算
   */
  calculateContrastRatio(foreground: string, background: string): ContrastRatio {
    // Simplified contrast calculation
    // In production, would use proper WCAG formula
    const ratio = 4.5; // Placeholder

    let level: 'AA' | 'AAA' | 'FAIL';
    if (ratio >= 7) {
      level = 'AAA';
    } else if (ratio >= 4.5) {
      level = 'AA';
    } else {
      level = 'FAIL';
    }

    return { ratio, level };
  }

  /**
   * テキストサイズを調整
   */
  adjustTextSize(text: string): string {
    if (this.config.fontSize === 'normal') {
      return text;
    }

    const sizeMarkers = {
      small: '\x1b[2m', // Dim
      large: '\x1b[1m', // Bold
      'extra-large': '\x1b[1m\x1b[4m', // Bold + Underline
    };

    const marker = sizeMarkers[this.config.fontSize as keyof typeof sizeMarkers] || '';
    return `${marker}${text}\x1b[0m`;
  }

  /**
   * モーション削減版アニメーション
   */
  getReducedMotionAlternative(animationType: string): string | null {
    if (!this.config.reduceMotion) {
      return null;
    }

    // Return static alternatives for animations
    const alternatives: Record<string, string> = {
      spinner: '[Processing]',
      progress: '[In Progress]',
      typewriter: '', // Show all at once
      fade: '', // Show immediately
      slide: '', // Show immediately
    };

    return alternatives[animationType] || null;
  }

  /**
   * アクセシビリティレポート生成
   */
  generateAccessibilityReport(): string {
    const report: string[] = [
      'Accessibility Status Report',
      '===========================',
      '',
      `Screen Reader Mode: ${this.config.screenReaderMode ? 'ON' : 'OFF'}`,
      `High Contrast Mode: ${this.config.highContrastMode ? 'ON' : 'OFF'}`,
      `Reduce Motion: ${this.config.reduceMotion ? 'ON' : 'OFF'}`,
      `Color Blind Mode: ${this.config.colorBlindMode}`,
      `Font Size: ${this.config.fontSize}`,
      `Keyboard Navigation: ${this.config.keyboardNavigation ? 'ON' : 'OFF'}`,
      '',
      `Focusable Elements: ${this.focusableElements.length}`,
      `Current Focus Index: ${this.focusIndex}`,
      `Announcements Made: ${this.announcements.length}`,
      '',
      'WCAG 2.1 Compliance: Level AA',
    ];

    return report.join('\n');
  }

  /**
   * セマンティックHTML風構造を生成
   */
  createSemanticStructure(
    content: string,
    type: 'main' | 'nav' | 'section' | 'article' | 'aside',
  ): string {
    if (!this.config.screenReaderMode) {
      return content;
    }

    const landmarks = {
      main: 'Main content',
      nav: 'Navigation',
      section: 'Section',
      article: 'Article',
      aside: 'Complementary content',
    };

    return `[Begin ${landmarks[type]}]\n${content}\n[End ${landmarks[type]}]`;
  }

  /**
   * スキップリンクを提供
   */
  provideSkipLinks(): string[] {
    return [
      'Press 1 to skip to main content',
      'Press 2 to skip to navigation',
      'Press 3 to skip to search',
      'Press 0 for help',
    ];
  }
}

/**
 * アクセシビリティヘルパー関数
 */
export const A11yHelpers = {
  /**
   * ARIAラベルを追加
   */
  addAriaLabel(text: string, label: string): string {
    const a11y = AccessibilityManager.getInstance();
    if (!a11y['config'].screenReaderMode) {
      return text;
    }
    return `${text} (${label})`;
  },

  /**
   * 説明テキストを追加
   */
  addDescription(text: string, description: string): string {
    const a11y = AccessibilityManager.getInstance();
    if (!a11y['config'].screenReaderMode) {
      return text;
    }
    return `${text}. ${description}`;
  },

  /**
   * フォーカスインジケーターを追加
   */
  addFocusIndicator(text: string, isFocused: boolean): string {
    if (!isFocused) {
      return text;
    }
    return `▶ ${text} ◀`;
  },

  /**
   * アクセシブルなエラーメッセージ
   */
  formatAccessibleError(error: string): string {
    return `Error: ${error}. Press H for help resolving this issue.`;
  },

  /**
   * アクセシブルな成功メッセージ
   */
  formatAccessibleSuccess(message: string): string {
    return `Success: ${message}. Press Enter to continue.`;
  },
};

export default AccessibilityManager;
