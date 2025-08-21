/**
 * KeyboardShortcutHandler Component
 * グローバルキーボードショートカット管理システム
 */

import readline from 'readline';
import chalk from 'chalk';

/**
 * キーボードショートカット定義
 */
export interface KeyboardShortcut {
  id: string;
  keys: string; // 例: "ctrl+c", "meta+k", "f1", "escape"
  description: string;
  category?: string;
  handler: () => void | Promise<void>;
  enabled?: boolean;
  global?: boolean; // グローバルに有効か（フォーカスに関係なく）
  preventDefault?: boolean;
  context?: string[]; // 特定のコンテキストでのみ有効
}

/**
 * キー組み合わせ
 */
interface KeyCombination {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
}

/**
 * ショートカットカテゴリ
 */
export enum ShortcutCategory {
  NAVIGATION = 'navigation',
  EDITING = 'editing',
  VIEW = 'view',
  TOOLS = 'tools',
  HELP = 'help',
  SYSTEM = 'system',
}

/**
 * キーボードショートカットハンドラークラス
 */
export class KeyboardShortcutHandler {
  private shortcuts: Map<string, KeyboardShortcut> = new Map();
  private isListening: boolean = false;
  private currentContext: string[] = ['global'];
  private interceptedKeys: Set<string> = new Set();
  private rl: readline.Interface | null = null;

  constructor() {
    this.setupDefaultShortcuts();
  }

  /**
   * デフォルトショートカットを設定
   */
  private setupDefaultShortcuts(): void {
    this.registerShortcuts([
      {
        id: 'quit',
        keys: 'ctrl+c',
        description: 'Quit application',
        category: ShortcutCategory.SYSTEM,
        handler: () => this.handleQuit(),
      },
      {
        id: 'interrupt',
        keys: 'ctrl+z',
        description: 'Interrupt current operation',
        category: ShortcutCategory.SYSTEM,
        handler: () => this.handleInterrupt(),
      },
      {
        id: 'help',
        keys: 'f1',
        description: 'Show help',
        category: ShortcutCategory.HELP,
        handler: () => this.showHelp(),
      },
      {
        id: 'help_alt',
        keys: 'ctrl+h',
        description: 'Show help',
        category: ShortcutCategory.HELP,
        handler: () => this.showHelp(),
      },
      {
        id: 'shortcuts',
        keys: 'ctrl+?',
        description: 'Show keyboard shortcuts',
        category: ShortcutCategory.HELP,
        handler: () => this.showShortcutList(),
      },
      {
        id: 'clear_screen',
        keys: 'ctrl+l',
        description: 'Clear screen',
        category: ShortcutCategory.VIEW,
        handler: () => console.clear(),
      },
      {
        id: 'escape',
        keys: 'escape',
        description: 'Cancel/Go back',
        category: ShortcutCategory.NAVIGATION,
        handler: () => this.handleEscape(),
      },
    ]);
  }

  /**
   * ショートカットを登録
   */
  registerShortcut(shortcut: KeyboardShortcut): void {
    const normalizedKeys = this.normalizeKeys(shortcut.keys);
    this.shortcuts.set(normalizedKeys, {
      ...shortcut,
      enabled: shortcut.enabled !== false,
      global: shortcut.global !== false,
    });
  }

  /**
   * 複数のショートカットを登録
   */
  registerShortcuts(shortcuts: KeyboardShortcut[]): void {
    shortcuts.forEach((shortcut) => this.registerShortcut(shortcut));
  }

  /**
   * ショートカットを削除
   */
  unregisterShortcut(keys: string): void {
    const normalizedKeys = this.normalizeKeys(keys);
    this.shortcuts.delete(normalizedKeys);
  }

  /**
   * ショートカットを有効/無効化
   */
  enableShortcut(keys: string, enabled: boolean = true): void {
    const normalizedKeys = this.normalizeKeys(keys);
    const shortcut = this.shortcuts.get(normalizedKeys);
    if (shortcut) {
      shortcut.enabled = enabled;
    }
  }

  /**
   * キーボードリスニングを開始
   */
  startListening(): void {
    if (this.isListening) return;

    this.isListening = true;

    // readline インターフェースを設定
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });

    // キー入力の生データを受け取る
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
      process.stdin.setEncoding('utf8');
    }

    // キープレスイベントリスナー
    process.stdin.on('keypress', this.handleKeyPress.bind(this));

    // SIGINTハンドリング
    process.on('SIGINT', this.handleSigInt.bind(this));
  }

  /**
   * キーボードリスニングを停止
   */
  stopListening(): void {
    if (!this.isListening) return;

    this.isListening = false;

    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }

    process.stdin.removeListener('keypress', this.handleKeyPress.bind(this));
    process.removeListener('SIGINT', this.handleSigInt.bind(this));
  }

  /**
   * キープレスを処理
   */
  private async handleKeyPress(str: string, key: unknown): Promise<void> {
    if (!key) return;

    const combination = this.buildKeyCombination(key);
    const keyString = this.combinationToString(combination);

    // ショートカットを検索
    const shortcut = this.shortcuts.get(keyString);

    if (shortcut && this.shouldExecuteShortcut(shortcut)) {
      try {
        // デフォルト動作を防ぐ
        if (shortcut.preventDefault !== false) {
          // 必要に応じて入力を消費
        }

        await shortcut.handler();
      } catch (error) {
        console.error(chalk.red('Error executing shortcut:'), error);
      }
    }
  }

  /**
   * SIGINT処理
   */
  private handleSigInt(): void {
    const ctrlCShortcut = this.shortcuts.get('ctrl+c');
    if (ctrlCShortcut && ctrlCShortcut.enabled) {
      ctrlCShortcut.handler();
    } else {
      // デフォルトの終了処理
      console.log(chalk.yellow('\nReceived SIGINT. Exiting...'));
      process.exit(0);
    }
  }

  /**
   * コンテキストを設定
   */
  setContext(context: string | string[]): void {
    this.currentContext = Array.isArray(context) ? context : [context];
  }

  /**
   * コンテキストを追加
   */
  pushContext(context: string): void {
    if (!this.currentContext.includes(context)) {
      this.currentContext.push(context);
    }
  }

  /**
   * コンテキストを削除
   */
  popContext(context: string): void {
    const index = this.currentContext.indexOf(context);
    if (index > -1) {
      this.currentContext.splice(index, 1);
    }
  }

  /**
   * ショートカットを実行すべきかチェック
   */
  private shouldExecuteShortcut(shortcut: KeyboardShortcut): boolean {
    // 無効化されている場合
    if (!shortcut.enabled) return false;

    // グローバルショートカットの場合
    if (shortcut.global) return true;

    // コンテキストチェック
    if (shortcut.context && shortcut.context.length > 0) {
      return shortcut.context.some((ctx) => this.currentContext.includes(ctx));
    }

    return true;
  }

  /**
   * キーの組み合わせを構築
   */
  private buildKeyCombination(key: unknown): KeyCombination {
    return {
      key: key.name || key.sequence,
      ctrl: key.ctrl || false,
      meta: key.meta || false,
      shift: key.shift || false,
      alt: key.alt || false,
    };
  }

  /**
   * キー組み合わせを文字列に変換
   */
  private combinationToString(combination: KeyCombination): string {
    const parts: string[] = [];

    if (combination.ctrl) parts.push('ctrl');
    if (combination.meta) parts.push('meta');
    if (combination.alt) parts.push('alt');
    if (combination.shift) parts.push('shift');

    parts.push(combination.key);

    return parts.join('+');
  }

  /**
   * キー文字列を正規化
   */
  private normalizeKeys(keys: string): string {
    return keys
      .toLowerCase()
      .replace(/command/g, 'meta')
      .replace(/cmd/g, 'meta')
      .replace(/option/g, 'alt')
      .replace(/\s+/g, '');
  }

  /**
   * ヘルプを表示
   */
  private showHelp(): void {
    console.log(chalk.cyan.bold('\n📖 Help'));
    console.log(chalk.gray('═'.repeat(60)));
    console.log(chalk.white('This is the MARIA CLI help system.'));
    console.log(chalk.white('Press F1 or Ctrl+H to show this help.'));
    console.log(chalk.white('Press Ctrl+? to show keyboard shortcuts.'));
    console.log(chalk.gray('═'.repeat(60)));
  }

  /**
   * ショートカット一覧を表示
   */
  showShortcutList(): void {
    console.log(chalk.cyan.bold('\n⌨️  Keyboard Shortcuts'));
    console.log(chalk.gray('═'.repeat(60)));

    // カテゴリ別にグループ化
    const categories: Record<string, KeyboardShortcut[]> = {};

    this.shortcuts.forEach((shortcut) => {
      const category = shortcut.category || 'Other';
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push(shortcut);
    });

    // カテゴリ別に表示
    Object.keys(categories).forEach((category) => {
      console.log(chalk.yellow.bold(`\n${category.toUpperCase()}:`));

      categories[category].forEach((shortcut) => {
        const keys = chalk.green(`[${this.formatKeys(shortcut.keys)}]`);
        const description = chalk.white(shortcut.description);
        const status = shortcut.enabled ? '' : chalk.red(' (disabled)');

        console.log(`  ${keys.padEnd(20)} ${description}${status}`);
      });
    });

    console.log(chalk.gray('\n═'.repeat(60)));
  }

  /**
   * キー表示をフォーマット
   */
  private formatKeys(keys: string): string {
    return keys
      .replace(/ctrl/g, 'Ctrl')
      .replace(/meta/g, 'Cmd')
      .replace(/alt/g, 'Alt')
      .replace(/shift/g, 'Shift')
      .replace(/\+/g, '+');
  }

  /**
   * デフォルトハンドラー
   */
  private handleQuit(): void {
    console.log(chalk.yellow('\nQuitting...'));
    process.exit(0);
  }

  private handleInterrupt(): void {
    console.log(chalk.yellow('\nOperation interrupted.'));
    // 現在の操作を中断するシグナルを送る
    process.emit('SIGTERM');
  }

  private handleEscape(): void {
    console.log(chalk.gray('Escape pressed.'));
    // エスケープ処理をここに追加
  }

  /**
   * 一時的にショートカットを無効化
   */
  temporarily(keys: string, duration: number): void {
    this.enableShortcut(keys, false);
    setTimeout(() => {
      this.enableShortcut(keys, true);
    }, duration);
  }

  /**
   * カスタムキーインターセプター
   */
  interceptKeys(keys: string[], interceptor: (key: string) => boolean): void {
    keys.forEach((key) => {
      const normalizedKey = this.normalizeKeys(key);
      this.interceptedKeys.add(normalizedKey);

      // 一時的なショートカットを登録
      this.registerShortcut({
        id: `intercept_${normalizedKey}`,
        keys: key,
        description: 'Intercepted key',
        handler: () => {
          const shouldContinue = interceptor(key);
          if (!shouldContinue) {
            this.unregisterShortcut(key);
            this.interceptedKeys.delete(normalizedKey);
          }
        },
      });
    });
  }

  /**
   * 統計情報を取得
   */
  getStats(): {
    totalShortcuts: number;
    enabledShortcuts: number;
    categories: string[];
    contexts: string[];
  } {
    const shortcuts = Array.from(this.shortcuts.values());
    const enabledShortcuts = shortcuts.filter((s) => s.enabled);
    const categories = [...new Set(shortcuts.map((s) => s.category).filter(Boolean))];

    return {
      totalShortcuts: shortcuts.length,
      enabledShortcuts: enabledShortcuts.length,
      categories,
      contexts: this.currentContext,
    };
  }

  /**
   * 設定をエクスポート
   */
  exportConfig(): KeyboardShortcut[] {
    return Array.from(this.shortcuts.values());
  }

  /**
   * 設定をインポート
   */
  importConfig(shortcuts: KeyboardShortcut[]): void {
    shortcuts.forEach((shortcut) => this.registerShortcut(shortcut));
  }

  /**
   * デバッグ情報を表示
   */
  debug(): void {
    const stats = this.getStats();

    console.log(chalk.yellow.bold('\n🔧 Keyboard Shortcut Handler Debug'));
    console.log(chalk.gray('═'.repeat(60)));
    console.log(`Listening: ${this.isListening ? chalk.green('Yes') : chalk.red('No')}`);
    console.log(`Total Shortcuts: ${stats.totalShortcuts}`);
    console.log(`Enabled: ${stats.enabledShortcuts}`);
    console.log(`Categories: ${stats.categories.join(', ')}`);
    console.log(`Current Contexts: ${stats.contexts.join(', ')}`);
    console.log(`Intercepted Keys: ${Array.from(this.interceptedKeys).join(', ')}`);
    console.log(chalk.gray('═'.repeat(60)));
  }

  /**
   * クリーンアップ
   */
  destroy(): void {
    this.stopListening();
    this.shortcuts.clear();
    this.interceptedKeys.clear();
  }
}

export default KeyboardShortcutHandler;
