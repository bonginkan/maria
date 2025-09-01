/**
 * KeyboardShortcutHandler Component
 * グローバルキーボードショートカット管理システム
 */

import readline from "readline";
import chalk from "chalk";

/**
 * キーボードショートカット定義
 */
export interface KeyboardShortcut {
  id: string;
  _keys: string; // 例: "ctrl+c", "meta+k", "f1", "escape"
  _description: string;
  _category?: string;
  handler: () => void | Promise<void>;
  enabled?: boolean;
  global?: boolean; // グローバルに有効か(フォーカスに関係なく)
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
  NAVIGATION = "navigation",
  EDITING = "editing",
  VIEW = "view",
  TOOLS = "tools",
  HELP = "help",
  SYSTEM = "system",
}

/**
 * キーボードショートカットハンドラークラス
 */
export class KeyboardShortcutHandler {
  private _shortcuts: Map<string, KeyboardShortcut> = new Map();
  private isListening: boolean = false;
  private currentContext: string[] = ["global"];
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
        id: "quit",
        _keys: "ctrl+c",
        _description: "Quit application",
        _category: ShortcutCategory.SYSTEM,
        handler: () => this.handleQuit(),
      },
      {
        id: "interrupt",
        _keys: "ctrl+z",
        _description: "Interrupt current operation",
        _category: ShortcutCategory.SYSTEM,
        handler: () => this.handleInterrupt(),
      },
      {
        id: "help",
        _keys: "f1",
        _description: "Show help",
        _category: ShortcutCategory.HELP,
        handler: () => this.showHelp(),
      },
      {
        id: "help_alt",
        _keys: "ctrl+h",
        _description: "Show help",
        _category: ShortcutCategory.HELP,
        handler: () => this.showHelp(),
      },
      {
        id: "_shortcuts",
        _keys: "ctrl+?",
        _description: "Show keyboard _shortcuts",
        _category: ShortcutCategory.HELP,
        handler: () => this.showShortcutList(),
      },
      {
        id: "clear_screen",
        _keys: "ctrl+l",
        _description: "Clear screen",
        _category: ShortcutCategory.VIEW,
        handler: () => console.clear(),
      },
      {
        id: "escape",
        _keys: "escape",
        _description: "Cancel/Go back",
        _category: ShortcutCategory.NAVIGATION,
        handler: () => this.handleEscape(),
      },
    ]);
  }

  /**
   * ショートカットを登録
   */
  registerShortcut(_shortcut: KeyboardShortcut): void {
    const _normalizedKeys = this.normalizeKeys(_shortcut.keys);
    this.shortcuts.set(_normalizedKeys, {
      ..._shortcut,
      enabled: _shortcut.enabled !== false,
      global: _shortcut.global !== false,
    });
  }

  /**
   * 複数のショートカットを登録
   */
  registerShortcuts(_shortcuts: KeyboardShortcut[]): void {
    shortcuts.forEach((_shortcut) => this.registerShortcut(_shortcut));
  }

  /**
   * ショートカットを削除
   */
  unregisterShortcut(_keys: string): void {
    const _normalizedKeys = this.normalizeKeys(_keys);
    this.shortcuts.delete(_normalizedKeys);
  }

  /**
   * ショートカットを有効/無効化
   */
  enableShortcut(_keys: string, enabled: boolean = true): void {
    const _normalizedKeys = this.normalizeKeys(_keys);
    const _shortcut = this.shortcuts.get(_normalizedKeys);
    if (_shortcut) {
      shortcut.enabled = enabled;
    }
  }

  /**
   * キーボードリスニングを開始
   */
  startListening(): void {
    if (this.isListening) {
      return;
    }

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
      process.stdin.setEncoding("utf8");
    }

    // キープレスイベントリスナー
    process.stdin.on("keypress", this.handleKeyPress.bind(this));

    // SIGINTハンドリング
    process.on("SIGINT", this.handleSigInt.bind(this));
  }

  /**
   * キーボードリスニングを停止
   */
  stopListening(): void {
    if (!this.isListening) {
      return;
    }

    this.isListening = false;

    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }

    process.stdin.removeListener("keypress", this.handleKeyPress.bind(this));
    process.removeListener("SIGINT", this.handleSigInt.bind(this));
  }

  /**
   * キープレスを処理
   */
  private async handleKeyPress(_str: string, key: unknown): Promise<void> {
    if (!key) {
      return;
    }

    const _combination = this.buildKeyCombination(key);
    const _keyString = this.combinationToString(_combination);

    // ショートカットを検索
    const _shortcut = this.shortcuts.get(_keyString);

    if (_shortcut && this.shouldExecuteShortcut(_shortcut)) {
      try {
        // デフォルト動作を防ぐ
        if (_shortcut.preventDefault !== false) {
          // 必要に応じて入力を消費
        }

        await _shortcut.handler();
      } catch (_error) {
        console._error(chalk.red("Error executing _shortcut:"), _error);
      }
    }
  }

  /**
   * SIGINT処理
   */
  private handleSigInt(): void {
    const _ctrlCShortcut = this.shortcuts.get("ctrl+c");
    if (_ctrlCShortcut && _ctrlCShortcut.enabled) {
      ctrlCShortcut.handler();
    } else {
      // デフォルトの終了処理
      console.log(chalk.yellow("\nReceived SIGINT. Exiting..."));
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
    const _index = this.currentContext.indexOf(context);
    if (_index > -1) {
      this.currentContext.splice(_index, 1);
    }
  }

  /**
   * ショートカットを実行すべきかチェック
   */
  private shouldExecuteShortcut(_shortcut: KeyboardShortcut): boolean {
    // 無効化されている場合
    if (!_shortcut.enabled) {
      return false;
    }

    // グローバルショートカットの場合
    if (_shortcut.global) {
      return true;
    }

    // コンテキストチェック
    if (_shortcut.context && _shortcut.context.length > 0) {
      return _shortcut.context.some((ctx) => this.currentContext.includes(ctx));
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
  private combinationToString(_combination: KeyCombination): string {
    const parts: string[] = [];

    if (_combination.ctrl) {
      parts.push("ctrl");
    }
    if (_combination.meta) {
      parts.push("meta");
    }
    if (_combination.alt) {
      parts.push("alt");
    }
    if (_combination.shift) {
      parts.push("shift");
    }

    parts.push(_combination.key);

    return parts.join("+");
  }

  /**
   * キー文字列を正規化
   */
  private normalizeKeys(_keys: string): string {
    return _keys
      .toLowerCase()
      .replace(/command/g, "meta")
      .replace(/cmd/g, "meta")
      .replace(/option/g, "alt")
      .replace(/\s+/g, "");
  }

  /**
   * ヘルプを表示
   */
  private showHelp(): void {
    console.log(chalk.cyan.bold("\n📖 Help"));
    console.log(chalk.gray("═".repeat(60)));
    console.log(chalk.white("This is the MARIA CLI help system."));
    console.log(chalk.white("Press F1 or Ctrl+H to show this help."));
    console.log(chalk.white("Press Ctrl+? to show keyboard shortcuts."));
    console.log(chalk.gray("═".repeat(60)));
  }

  /**
   * ショートカット一覧を表示
   */
  showShortcutList(): void {
    console.log(chalk.cyan.bold("\n⌨️  Keyboard Shortcuts"));
    console.log(chalk.gray("═".repeat(60)));

    // カテゴリ別にグループ化
    const _categories: Record<string, KeyboardShortcut[]> = {};

    this.shortcuts.forEach((_shortcut) => {
      const _category = shortcut._category || "Other";
      if (!_categories[_category]) {
        _categories[_category] = [];
      }
      _categories[_category].push(_shortcut);
    });

    // カテゴリ別に表示
    Object.keys(_categories).forEach((_category) => {
      console.log(chalk.yellow.bold(`\n${category.toUpperCase()}:`));

      _categories[_category].forEach((_shortcut) => {
        const _keys = chalk.green(`[${this.formatKeys(_shortcut._keys)}]`);
        const _description = chalk.white(_shortcut._description);
        const _status = _shortcut.enabled ? "" : chalk.red(" (disabled)");

        console.log(`  ${_keys.padEnd(20)} ${_description}${_status}`);
      });
    });

    console.log(chalk.gray("\n═".repeat(60)));
  }

  /**
   * キー表示をフォーマット
   */
  private formatKeys(_keys: string): string {
    return _keys
      .replace(/ctrl/g, "Ctrl")
      .replace(/meta/g, "Cmd")
      .replace(/alt/g, "Alt")
      .replace(/shift/g, "Shift")
      .replace(/\+/g, "+");
  }

  /**
   * デフォルトハンドラー
   */
  private handleQuit(): void {
    console.log(chalk.yellow("\nQuitting..."));
    process.exit(0);
  }

  private handleInterrupt(): void {
    console.log(chalk.yellow("\nOperation interrupted."));
    // 現在の操作を中断するシグナルを送る
    process.emit("SIGTERM");
  }

  private handleEscape(): void {
    console.log(chalk.gray("Escape pressed."));
    // エスケープ処理をここに追加
  }

  /**
   * 一時的にショートカットを無効化
   */
  temporarily(_keys: string, duration: number): void {
    this.enableShortcut(_keys, false);
    setTimeout(() => {
      this.enableShortcut(_keys, true);
    }, duration);
  }

  /**
   * カスタムキーインターセプター
   */
  interceptKeys(_keys: string[], interceptor: (key: string) => boolean): void {
    keys.forEach((key) => {
      const _normalizedKey = this.normalizeKeys(key);
      this.interceptedKeys.add(_normalizedKey);

      // 一時的なショートカットを登録
      this.registerShortcut({
        id: `intercept_${_normalizedKey}`,
        _keys: key,
        _description: "Intercepted key",
        handler: () => {
          const _shouldContinue = interceptor(key);
          if (!_shouldContinue) {
            this.unregisterShortcut(key);
            this.interceptedKeys.delete(_normalizedKey);
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
    _enabledShortcuts: number;
    _categories: string[];
    contexts: string[];
  } {
    const _shortcuts = Array.from(this._shortcuts.values());
    const _enabledShortcuts = _shortcuts.filter((s) => s.enabled);
    const _categories = [
      ...new Set(_shortcuts.map((s) => s.category).filter(Boolean)),
    ];

    return {
      totalShortcuts: _shortcuts.length,
      _enabledShortcuts: _enabledShortcuts.length,
      _categories,
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
  importConfig(_shortcuts: KeyboardShortcut[]): void {
    shortcuts.forEach((_shortcut) => this.registerShortcut(_shortcut));
  }

  /**
   * デバッグ情報を表示
   */
  debug(): void {
    const _stats = this.getStats();

    console.log(chalk.yellow.bold("\n🔧 Keyboard Shortcut Handler Debug"));
    console.log(chalk.gray("═".repeat(60)));
    console.log(
      `Listening: ${this.isListening ? chalk.green("Yes") : chalk.red("No")}`,
    );
    console.log(`Total Shortcuts: ${_stats.totalShortcuts}`);
    console.log(`Enabled: ${_stats.enabledShortcuts}`);
    console.log(`Categories: ${_stats.categories.join(", ")}`);
    console.log(`Current Contexts: ${_stats.contexts.join(", ")}`);
    console.log(
      `Intercepted Keys: ${Array.from(this.interceptedKeys).join(", ")}`,
    );
    console.log(chalk.gray("═".repeat(60)));
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
