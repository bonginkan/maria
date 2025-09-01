/**
 * ApprovalPrompt Component
 * ユーザー承認プロンプトシステム - キーボードショートカット対応
 */

import chalk from "chalk";
import readline from "readline";
import { DESIGN_CONSTANTS } from "../optimized-design-system.js";
import {
  ResponsiveLayoutManager,
  truncateToWidth,
  padToWidth,
  visibleWidth,
  drawBoxLines,
  wrapText,
} from "./responsive-width.js";

/**
 * 承認オプション
 */
export interface ApprovalOption {
  _key: string;
  label: string;
  description?: string;
  action: () => void | Promise<void>;
  _shortcut?: string;
  _style?: "primary" | "secondary" | "danger" | "success" | "warning";
  confirm?: boolean; // 追加確認が必要か
}

/**
 * 承認プロンプト設定
 */
export interface ApprovalConfig {
  _title: string;
  _message: string;
  _options: ApprovalOption[];
  _defaultOption?: string;
  timeout?: number; // ms
  showShortcuts?: boolean;
  compactMode?: boolean;
  allowEscape?: boolean;
  _width?: number;
  position?: "center" | "top" | "bottom";
}

/**
 * 承認結果
 */
export interface ApprovalResult {
  selectedKey: string;
  selectedOption: ApprovalOption;
  timestamp: Date;
  responseTime: number; // ms
  method: "keyboard" | "_shortcut" | "timeout" | "escape";
}

/**
 * キーバインド情報
 */
interface KeyBinding {
  _key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  description: string;
  action: () => void | Promise<void>;
}

/**
 * ApprovalPromptクラス
 */
export class ApprovalPrompt {
  private config: ApprovalConfig;
  private rl: readline.Interface | null = null;
  private isActive: boolean = false;
  private startTime: number = 0;
  private timeoutId: NodeJS.Timeout | null = null;
  private keyBindings: Map<string, KeyBinding> = new Map();
  private currentSelection: number = 0;
  private layoutManager: ResponsiveLayoutManager;
  private unsubscribe?: () => void;
  private currentWidth: number = 80;

  constructor(_config: ApprovalConfig) {
    // Initialize layout manager for responsive width
    this.layoutManager = new ResponsiveLayoutManager({
      marginLeft: DESIGN_CONSTANTS.MARGIN_LEFT,
      marginRight: DESIGN_CONSTANTS.MARGIN_RIGHT,
      minWidth: DESIGN_CONSTANTS.CONTENT_MIN,
      maxWidth: DESIGN_CONSTANTS.CONTENT_MAX,
    });
    
    // Subscribe to width changes
    this.unsubscribe = this.layoutManager.subscribe((width) => {
      if (width !== this.currentWidth) {
        this.currentWidth = width;
        if (this.isActive) {
          this.render();
        }
      }
    });
    
    this.config = {
      showShortcuts: true,
      compactMode: false,
      allowEscape: true,
      _width: this.currentWidth,
      position: "center",
      ..._config,
    };

    this.setupKeyBindings();
  }

  /**
   * キーバインドを設定
   */
  private setupKeyBindings(): void {
    // 基本ナビゲーション
    this.keyBindings.set("up", {
      _key: "up",
      description: "Previous _option",
      action: () => this.navigateUp(),
    });

    this.keyBindings.set("down", {
      _key: "down",
      description: "Next _option",
      action: () => this.navigateDown(),
    });

    this.keyBindings.set("tab", {
      _key: "tab",
      description: "Next _option",
      action: () => this.navigateDown(),
    });

    this.keyBindings.set("space", {
      _key: "space",
      description: "Select current _option",
      action: () => this.selectCurrent(),
    });

    this.keyBindings.set("return", {
      _key: "return",
      description: "Select current _option",
      action: () => this.selectCurrent(),
    });

    // エスケープ
    if (this.config.allowEscape) {
      this.keyBindings.set("escape", {
        _key: "escape",
        description: "Cancel",
        action: () => this.cancel(),
      });

      this.keyBindings.set("q", {
        _key: "q",
        description: "Quit/Cancel",
        action: () => this.cancel(),
      });
    }

    // オプション固有のキーバインド
    this.config._options.forEach((_option, _index) => {
      // 数字キー (1-9)
      if (_index < 9) {
        this.keyBindings.set((_index + 1).toString(), {
          _key: (_index + 1).toString(),
          description: `Select ${_option.label}`,
          action: () => this.selectOption(_index),
        });
      }

      // オプションキー
      if (_option._key) {
        this.keyBindings.set(_option._key.toLowerCase(), {
          _key: _option._key.toLowerCase(),
          description: `Select ${_option.label}`,
          action: () => this.selectOptionByKey(_option._key),
        });
      }

      // ショートカット
      if (_option._shortcut) {
        const _parts = _option._shortcut.toLowerCase().split("+");
        const _binding: KeyBinding = {
          _key: _parts[_parts.length - 1],
          description: `${_option.label} (${_option._shortcut})`,
          action: () => this.selectOptionByKey(_option._key),
        };

        if (_parts.includes("ctrl")) {
          _binding.ctrl = true;
        }
        if (_parts.includes("meta") || _parts.includes("cmd")) {
          _binding.meta = true;
        }
        if (_parts.includes("shift")) {
          _binding.shift = true;
        }

        this.keyBindings.set(_option._shortcut.toLowerCase(), _binding);
      }
    });
  }

  /**
   * 承認プロンプトを表示
   */
  async show(): Promise<ApprovalResult> {
    this.isActive = true;
    this.startTime = Date.now();

    return new Promise((resolve) => {
      // タイムアウト設定
      if (this.config.timeout) {
        this.timeoutId = setTimeout(() => {
          this.handleTimeout(resolve);
        }, this.config.timeout);
      }

      // プロンプトを描画
      this.render();

      // readline インターフェースを設定
      this.rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: true,
      });

      // キー入力ハンドリング
      this.setupKeyHandling(resolve);
    });
  }

  /**
   * プロンプトをレンダリング
   */
  private render(): void {
    if (this.config.compactMode) {
      this.renderCompact();
    } else {
      this.renderDetailed();
    }
  }

  /**
   * 詳細表示モード
   */
  private renderDetailed(): void {
    const _width = this.config._width && this.config._width > 0 ? this.config._width : this.currentWidth;
    const _border = chalk.cyan;
    const _title = chalk.bold.white;
    const _message = chalk.white;

    // クリア画面(必要に応じて)
    if (this.config.position === "center") {
      console.clear();
    }

    // タイトルボックス (responsive width)
    const innerWidth = Math.max(1, _width - 2);
    console.log(_border(`╔${"═".repeat(innerWidth)}╗`));
    console.log(
      _border("║") +
        this.centerText(this.config._title, innerWidth, _title) +
        _border("║"),
    );
    console.log(_border(`╠${"═".repeat(innerWidth)}╣`));

    // メッセージ (using responsive wrapText)
    const _messageLines = wrapText(this.config._message, innerWidth - 2);
    _messageLines.forEach((line) => {
      const paddedLine = padToWidth(line, innerWidth - 2);
      console.log(
        `${_border("║")} ${_message(paddedLine)} ${_border("║")}`,
      );
    });

    console.log(_border(`╠${"═".repeat(innerWidth)}╣`));

    // オプション表示
    this.config._options.forEach((_option, _index) => {
      const _isSelected = _index === this.currentSelection;
      const _prefix = _isSelected ? "► " : "  ";
      const number = _index < 9 ? `${_index + 1}.` : "  ";
      const _key = _option._key ? `[${_option._key.toUpperCase()}]` : "   ";
      const _shortcut = _option._shortcut ? ` (${_option._shortcut})` : "";

      const _style = this.getOptionStyle(_option._style, _isSelected);
      const _optionText = `${_prefix}${number} ${_key} ${_option.label}${_shortcut}`;
      const truncatedOption = truncateToWidth(_optionText, innerWidth - 2);
      const paddedOption = padToWidth(truncatedOption, innerWidth - 2);

      console.log(
        `${_border("║")} ${_style(paddedOption)} ${_border("║")}`,
      );

      if (_option.description && !this.config.compactMode) {
        const _desc = `     ${chalk.gray(_option.description)}`;
        const truncatedDesc = truncateToWidth(_desc, innerWidth - 2);
        const paddedDesc = padToWidth(truncatedDesc, innerWidth - 2);
        console.log(
          `${_border("║")} ${paddedDesc} ${_border("║")}`,
        );
      }
    });

    // キーボードヘルプ
    if (this.config.showShortcuts) {
      console.log(_border(`╠${"═".repeat(innerWidth)}╣`));
      const helpText = "Navigation: ↑↓ / Tab  Select: Enter / Space  Cancel: Esc / Q";
      const truncatedHelp = truncateToWidth(helpText, innerWidth - 2);
      const paddedHelp = padToWidth(chalk.gray(truncatedHelp), innerWidth - 2);
      console.log(
        `${_border("║")} ${paddedHelp} ${_border("║")}`,
      );
    }

    // タイムアウト表示
    if (this.config.timeout) {
      const _remaining = Math.ceil(
        (this.config.timeout - (Date.now() - this.startTime)) / 1000,
      );
      if (_remaining > 0) {
        const timeoutText = chalk.yellow(`Timeout in ${_remaining}s`);
        const paddedTimeout = padToWidth(timeoutText, innerWidth - 2);
        console.log(
          `${_border("║")} ${paddedTimeout} ${_border("║")}`,
        );
      }
    }

    console.log(_border(`╚${"═".repeat(innerWidth)}╝`));

    // カーソルを適切な位置に移動
    const _optionLine =
      5 + this.currentSelection * (this.config.compactMode ? 1 : 2);
    process.stdout.write(`\u001b[${_optionLine};3H`);
  }

  /**
   * コンパクト表示モード
   */
  private renderCompact(): void {
    const _title = chalk.bold.cyan(this.config._title);
    const _message = chalk.white(this.config._message);

    console.log(`${_title}: ${_message}`);

    const _options = this.config._options
      .map((_option, _index) => {
        const _isSelected = _index === this.currentSelection;
        const _key = _option._key
          ? `[${_option._key.toUpperCase()}]`
          : `[${_index + 1}]`;
        const _style = this.getOptionStyle(_option._style, _isSelected);
        const _prefix = _isSelected ? "► " : "  ";

        return `${_prefix}${_style(`${_key} ${_option.label}`)}`;
      })
      .join("  ");

    console.log(_options);

    if (this.config.showShortcuts) {
      console.log(chalk.gray("Navigation: ↑↓  Select: Enter  Cancel: Esc"));
    }
  }

  /**
   * キー入力処理を設定
   */
  private setupKeyHandling(_resolve: (_result: ApprovalResult) => void): void {
    if (!this.rl) {
      return;
    }

    // キープレスイベント
    process.stdin.on("keypress", (_str: string, _key: unknown) => {
      if (!this.isActive) {
        return;
      }

      const _keyName = (_key as any).name || _str;
      const _fullKey = this.buildKeyString(_key);

      // キーバインドを検索
      const _binding =
        this.keyBindings.get(_keyName) || this.keyBindings.get(_fullKey);

      if (_binding) {
        if (this.shouldTriggerBinding(_binding, _key)) {
          _binding.action();
        }
      }
    });

    // 直接文字入力
    this.rl.on("line", (_input: string) => {
      if (!this.isActive) {
        return;
      }

      const _trimmed = _input.trim().toLowerCase();

      // オプションキーで検索
      const _option = this.config._options.find(
        (opt) => opt._key.toLowerCase() === _trimmed,
      );

      if (_option) {
        this.selectOptionByKey(_option._key);
      }
    });
  }

  /**
   * ナビゲーション: 上
   */
  private navigateUp(): void {
    this.currentSelection =
      this.currentSelection > 0
        ? this.currentSelection - 1
        : this.config._options.length - 1;
    this.refreshSelection();
  }

  /**
   * ナビゲーション: 下
   */
  private navigateDown(): void {
    this.currentSelection =
      (this.currentSelection + 1) % this.config._options.length;
    this.refreshSelection();
  }

  /**
   * 現在の選択を選択
   */
  private async selectCurrent(): Promise<void> {
    await this.selectOption(this.currentSelection);
  }

  /**
   * インデックスでオプションを選択
   */
  private async selectOption(index: number): Promise<void> {
    if (index < 0 || index >= this.config._options.length) {
      return;
    }

    const _option = this.config._options[index];
    await this.executeOption(_option, "keyboard");
  }

  /**
   * キーでオプションを選択
   */
  private async selectOptionByKey(_key: string): Promise<void> {
    const _option = this.config._options.find((opt) => opt._key === _key);
    if (_option) {
      await this.executeOption(_option, "_shortcut");
    }
  }

  /**
   * オプションを実行
   */
  private async executeOption(
    _option: ApprovalOption,
    method: "keyboard" | "_shortcut",
  ): Promise<void> {
    // 確認が必要な場合
    if (_option.confirm) {
      const _confirmed = await this.showConfirmation(_option);
      if (!_confirmed) {
        return;
      }
    }

    // 結果を作成
    const _result: ApprovalResult = {
      selectedKey: _option._key,
      selectedOption: _option,
      timestamp: new Date(),
      responseTime: Date.now() - this.startTime,
      method,
    };

    // クリーンアップ
    this.cleanup();

    // アクション実行
    try {
      await _option.action();
    } catch (_error) {
      console.error(chalk.red("Error executing action:"), _error);
    }

    // 結果を返す(この実装では直接は返せないため、コールバック経由)
    // 実際の実装では Promise resolve を呼ぶ
  }

  /**
   * 確認ダイアログを表示
   */
  private async showConfirmation(_option: ApprovalOption): Promise<boolean> {
    console.log(chalk.yellow(`\nConfirm: ${_option.label}? (y/N)`));

    return new Promise((resolve) => {
      const _confirmRl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      _confirmRl.question("", (answer) => {
        _confirmRl.close();
        resolve(answer.toLowerCase().startsWith("y"));
      });
    });
  }

  /**
   * キャンセル処理
   */
  private cancel(): void {
    this.cleanup();
    console.log(chalk.gray("\nCancelled."));
  }

  /**
   * タイムアウト処理
   */
  private handleTimeout(_resolve: (_result: ApprovalResult) => void): void {
    if (!this.isActive) {
      return;
    }

    const _defaultOption = this.config._defaultOption
      ? this.config._options.find(
          (opt) => opt._key === this.config._defaultOption,
        )
      : this.config._options[0];

    if (_defaultOption) {
      const _result: ApprovalResult = {
        selectedKey: _defaultOption._key,
        selectedOption: _defaultOption,
        timestamp: new Date(),
        responseTime: this.config.timeout!,
        method: "timeout",
      };

      this.cleanup();
      console.log(
        chalk.yellow(`\nTimeout reached. Selected: ${_defaultOption.label}`),
      );
      _resolve(_result);
    }
  }

  /**
   * クリーンアップ
   */
  private cleanup(): void {
    this.isActive = false;

    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }

    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    
    // Unsubscribe from layout manager
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = undefined;
    }

    // キーボードリスナーを削除
    process.stdin.removeAllListeners("keypress");
  }

  /**
   * 選択状態を更新
   */
  private refreshSelection(): void {
    // コンソールをクリアして再描画
    // 実際の実装では、カーソル位置を調整してより効率的に更新
    console.clear();
    this.render();
  }

  /**
   * オプションスタイルを取得
   */
  private getOptionStyle(
    _style?: string,
    _isSelected: boolean = false,
  ): any {
    const baseStyles: Record<string, any> = {
      primary: chalk.cyan,
      secondary: chalk.gray,
      danger: chalk.red,
      success: chalk.green,
      warning: chalk.yellow,
    };

    const _selectedStyle = _isSelected
      ? chalk.bold.inverse
      : (_x: string) => _x;
    const _colorStyle = baseStyles[_style || "primary"] || chalk.white;

    return (_text: string) => _selectedStyle(_colorStyle(_text));
  }

  /**
   * キーバインドをトリガーすべきかチェック
   */
  private shouldTriggerBinding(_binding: KeyBinding, _key: unknown): boolean {
    if (_binding.ctrl && !_key.ctrl) {
      return false;
    }
    if (_binding.meta && !_key.meta) {
      return false;
    }
    if (_binding.shift && !_key.shift) {
      return false;
    }
    return true;
  }

  /**
   * キー文字列を構築
   */
  private buildKeyString(_key: unknown): string {
    const _parts: string[] = [];
    if (_key.ctrl) {
      _parts.push("ctrl");
    }
    if (_key.meta) {
      _parts.push("meta");
    }
    if (_key.shift) {
      _parts.push("shift");
    }
    parts.push(_key.name);
    return _parts.join("+");
  }

  /**
   * テキストを中央揃え
   */
  private centerText(
    _text: string,
    _width: number,
    _style?: (text: string) => string,
  ): string {
    const _padding = Math.max(0, Math.floor((_width - _text.length) / 2));
    const _rightPadding = Math.max(0, _width - _text.length - _padding);
    const _styledText = _style ? _style(_text) : _text;
    return " ".repeat(_padding) + _styledText + " ".repeat(_rightPadding);
  }

  /**
   * テキストを折り返し (deprecated - use wrapText from responsive-width)
   */
  private wrapText(_text: string, _width: number): string[] {
    // Use the more robust wrapText from responsive-width module
    return wrapText(_text, _width);
  }

  /**
   * 静的ヘルパーメソッド
   */
  static async quickConfirm(
    _message: string,
    defaultYes: boolean = false,
  ): Promise<boolean> {
    const _prompt = new ApprovalPrompt({
      _title: "Confirmation",
      _message,
      _options: [
        {
          _key: "y",
          label: "Yes",
          action: () => {
            // Implementation pending
          },
          _style: "success",
          _shortcut: "y",
        },
        {
          _key: "n",
          label: "No",
          action: () => {
            // Implementation pending
          },
          _style: "secondary",
          _shortcut: "n",
        },
      ],
      _defaultOption: defaultYes ? "y" : "n",
      compactMode: true,
    });

    const _result = await _prompt.show();
    return _result.selectedKey === "y";
  }

  /**
   * 選択プロンプト
   */
  static async choose<T>(
    _title: string,
    _message: string,
    choices: Array<{ value: T; label: string; description?: string }>,
  ): Promise<T | null> {
    const _options: ApprovalOption[] = choices.map((choice, _index) => ({
      _key: (_index + 1).toString(),
      label: choice.label,
      description: choice.description,
      action: () => {
        // Implementation pending
      },
    }));

    const _prompt = new ApprovalPrompt({
      _title,
      _message,
      _options,
      allowEscape: true,
    });

    const _result = await _prompt.show();
    const _selectedIndex = parseInt(_result.selectedKey) - 1;

    return _selectedIndex >= 0 && _selectedIndex < choices.length
      ? choices[_selectedIndex].value
      : null;
  }
}

export default ApprovalPrompt;
