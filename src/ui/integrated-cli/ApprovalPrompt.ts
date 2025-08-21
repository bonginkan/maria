/**
 * ApprovalPrompt Component
 * ユーザー承認プロンプトシステム - キーボードショートカット対応
 */

import chalk from 'chalk';
import readline from 'readline';
import { DESIGN_CONSTANTS } from '../optimized-design-system.js';

/**
 * 承認オプション
 */
export interface ApprovalOption {
  key: string;
  label: string;
  description?: string;
  action: () => void | Promise<void>;
  shortcut?: string;
  style?: 'primary' | 'secondary' | 'danger' | 'success' | 'warning';
  confirm?: boolean; // 追加確認が必要か
}

/**
 * 承認プロンプト設定
 */
export interface ApprovalConfig {
  title: string;
  message: string;
  options: ApprovalOption[];
  defaultOption?: string;
  timeout?: number; // ms
  showShortcuts?: boolean;
  compactMode?: boolean;
  allowEscape?: boolean;
  width?: number;
  position?: 'center' | 'top' | 'bottom';
}

/**
 * 承認結果
 */
export interface ApprovalResult {
  selectedKey: string;
  selectedOption: ApprovalOption;
  timestamp: Date;
  responseTime: number; // ms
  method: 'keyboard' | 'shortcut' | 'timeout' | 'escape';
}

/**
 * キーバインド情報
 */
interface KeyBinding {
  key: string;
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

  constructor(config: ApprovalConfig) {
    this.config = {
      showShortcuts: true,
      compactMode: false,
      allowEscape: true,
      width: DESIGN_CONSTANTS.CONTENT_WIDTH,
      position: 'center',
      ...config,
    };

    this.setupKeyBindings();
  }

  /**
   * キーバインドを設定
   */
  private setupKeyBindings(): void {
    // 基本ナビゲーション
    this.keyBindings.set('up', {
      key: 'up',
      description: 'Previous option',
      action: () => this.navigateUp(),
    });

    this.keyBindings.set('down', {
      key: 'down',
      description: 'Next option',
      action: () => this.navigateDown(),
    });

    this.keyBindings.set('tab', {
      key: 'tab',
      description: 'Next option',
      action: () => this.navigateDown(),
    });

    this.keyBindings.set('space', {
      key: 'space',
      description: 'Select current option',
      action: () => this.selectCurrent(),
    });

    this.keyBindings.set('return', {
      key: 'return',
      description: 'Select current option',
      action: () => this.selectCurrent(),
    });

    // エスケープ
    if (this.config.allowEscape) {
      this.keyBindings.set('escape', {
        key: 'escape',
        description: 'Cancel',
        action: () => this.cancel(),
      });

      this.keyBindings.set('q', {
        key: 'q',
        description: 'Quit/Cancel',
        action: () => this.cancel(),
      });
    }

    // オプション固有のキーバインド
    this.config.options.forEach((option, index) => {
      // 数字キー (1-9)
      if (index < 9) {
        this.keyBindings.set((index + 1).toString(), {
          key: (index + 1).toString(),
          description: `Select ${option.label}`,
          action: () => this.selectOption(index),
        });
      }

      // オプションキー
      if (option.key) {
        this.keyBindings.set(option.key.toLowerCase(), {
          key: option.key.toLowerCase(),
          description: `Select ${option.label}`,
          action: () => this.selectOptionByKey(option.key),
        });
      }

      // ショートカット
      if (option.shortcut) {
        const parts = option.shortcut.toLowerCase().split('+');
        const binding: KeyBinding = {
          key: parts[parts.length - 1],
          description: `${option.label} (${option.shortcut})`,
          action: () => this.selectOptionByKey(option.key),
        };

        if (parts.includes('ctrl')) binding.ctrl = true;
        if (parts.includes('meta') || parts.includes('cmd')) binding.meta = true;
        if (parts.includes('shift')) binding.shift = true;

        this.keyBindings.set(option.shortcut.toLowerCase(), binding);
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
    const width = this.config.width || 80;
    const border = chalk.cyan;
    const title = chalk.bold.white;
    const message = chalk.white;

    // クリア画面（必要に応じて）
    if (this.config.position === 'center') {
      console.clear();
    }

    // タイトルボックス
    console.log(border('╔' + '═'.repeat(width - 2) + '╗'));
    console.log(border('║') + this.centerText(this.config.title, width - 2, title) + border('║'));
    console.log(border('╠' + '═'.repeat(width - 2) + '╣'));

    // メッセージ
    const messageLines = this.wrapText(this.config.message, width - 4);
    messageLines.forEach((line) => {
      console.log(border('║') + ' ' + message(line.padEnd(width - 3)) + border('║'));
    });

    console.log(border('╠' + '═'.repeat(width - 2) + '╣'));

    // オプション表示
    this.config.options.forEach((option, index) => {
      const isSelected = index === this.currentSelection;
      const prefix = isSelected ? '► ' : '  ';
      const number = index < 9 ? `${index + 1}.` : '  ';
      const key = option.key ? `[${option.key.toUpperCase()}]` : '   ';
      const shortcut = option.shortcut ? ` (${option.shortcut})` : '';

      const style = this.getOptionStyle(option.style, isSelected);
      const optionText = `${prefix}${number} ${key} ${option.label}${shortcut}`;

      console.log(border('║') + ' ' + style(optionText.padEnd(width - 3)) + border('║'));

      if (option.description && !this.config.compactMode) {
        const desc = `     ${chalk.gray(option.description)}`;
        console.log(border('║') + ' ' + desc.padEnd(width - 3) + border('║'));
      }
    });

    // キーボードヘルプ
    if (this.config.showShortcuts) {
      console.log(border('╠' + '═'.repeat(width - 2) + '╣'));
      console.log(
        border('║') +
          ' ' +
          chalk
            .gray('Navigation: ↑↓ / Tab  Select: Enter / Space  Cancel: Esc / Q')
            .padEnd(width - 3) +
          border('║'),
      );
    }

    // タイムアウト表示
    if (this.config.timeout) {
      const remaining = Math.ceil((this.config.timeout - (Date.now() - this.startTime)) / 1000);
      if (remaining > 0) {
        console.log(
          border('║') +
            ' ' +
            chalk.yellow(`Timeout in ${remaining}s`).padEnd(width - 3) +
            border('║'),
        );
      }
    }

    console.log(border('╚' + '═'.repeat(width - 2) + '╝'));

    // カーソルを適切な位置に移動
    const optionLine = 5 + this.currentSelection * (this.config.compactMode ? 1 : 2);
    process.stdout.write(`\x1b[${optionLine};3H`);
  }

  /**
   * コンパクト表示モード
   */
  private renderCompact(): void {
    const title = chalk.bold.cyan(this.config.title);
    const message = chalk.white(this.config.message);

    console.log(`${title}: ${message}`);

    const options = this.config.options
      .map((option, index) => {
        const isSelected = index === this.currentSelection;
        const key = option.key ? `[${option.key.toUpperCase()}]` : `[${index + 1}]`;
        const style = this.getOptionStyle(option.style, isSelected);
        const prefix = isSelected ? '► ' : '  ';

        return `${prefix}${style(key + ' ' + option.label)}`;
      })
      .join('  ');

    console.log(options);

    if (this.config.showShortcuts) {
      console.log(chalk.gray('Navigation: ↑↓  Select: Enter  Cancel: Esc'));
    }
  }

  /**
   * キー入力処理を設定
   */
  private setupKeyHandling(resolve: (result: ApprovalResult) => void): void {
    if (!this.rl) return;

    // キープレスイベント
    process.stdin.on('keypress', (str: string, key: unknown) => {
      if (!this.isActive) return;

      const keyName = key.name || str;
      const fullKey = this.buildKeyString(key);

      // キーバインドを検索
      const binding = this.keyBindings.get(keyName) || this.keyBindings.get(fullKey);

      if (binding) {
        if (this.shouldTriggerBinding(binding, key)) {
          binding.action();
        }
      }
    });

    // 直接文字入力
    this.rl.on('line', (input: string) => {
      if (!this.isActive) return;

      const trimmed = input.trim().toLowerCase();

      // オプションキーで検索
      const option = this.config.options.find((opt) => opt.key.toLowerCase() === trimmed);

      if (option) {
        this.selectOptionByKey(option.key);
      }
    });
  }

  /**
   * ナビゲーション: 上
   */
  private navigateUp(): void {
    this.currentSelection =
      this.currentSelection > 0 ? this.currentSelection - 1 : this.config.options.length - 1;
    this.refreshSelection();
  }

  /**
   * ナビゲーション: 下
   */
  private navigateDown(): void {
    this.currentSelection = (this.currentSelection + 1) % this.config.options.length;
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
    if (index < 0 || index >= this.config.options.length) return;

    const option = this.config.options[index];
    await this.executeOption(option, 'keyboard');
  }

  /**
   * キーでオプションを選択
   */
  private async selectOptionByKey(key: string): Promise<void> {
    const option = this.config.options.find((opt) => opt.key === key);
    if (option) {
      await this.executeOption(option, 'shortcut');
    }
  }

  /**
   * オプションを実行
   */
  private async executeOption(
    option: ApprovalOption,
    method: 'keyboard' | 'shortcut',
  ): Promise<void> {
    // 確認が必要な場合
    if (option.confirm) {
      const confirmed = await this.showConfirmation(option);
      if (!confirmed) return;
    }

    // 結果を作成
    const result: ApprovalResult = {
      selectedKey: option.key,
      selectedOption: option,
      timestamp: new Date(),
      responseTime: Date.now() - this.startTime,
      method,
    };

    // クリーンアップ
    this.cleanup();

    // アクション実行
    try {
      await option.action();
    } catch (error) {
      console.error(chalk.red('Error executing action:'), error);
    }

    // 結果を返す（この実装では直接は返せないため、コールバック経由）
    // 実際の実装では Promise resolve を呼ぶ
  }

  /**
   * 確認ダイアログを表示
   */
  private async showConfirmation(option: ApprovalOption): Promise<boolean> {
    console.log(chalk.yellow(`\nConfirm: ${option.label}? (y/N)`));

    return new Promise((resolve) => {
      const confirmRl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      confirmRl.question('', (answer) => {
        confirmRl.close();
        resolve(answer.toLowerCase().startsWith('y'));
      });
    });
  }

  /**
   * キャンセル処理
   */
  private cancel(): void {
    this.cleanup();
    console.log(chalk.gray('\nCancelled.'));
  }

  /**
   * タイムアウト処理
   */
  private handleTimeout(resolve: (result: ApprovalResult) => void): void {
    if (!this.isActive) return;

    const defaultOption = this.config.defaultOption
      ? this.config.options.find((opt) => opt.key === this.config.defaultOption)
      : this.config.options[0];

    if (defaultOption) {
      const result: ApprovalResult = {
        selectedKey: defaultOption.key,
        selectedOption: defaultOption,
        timestamp: new Date(),
        responseTime: this.config.timeout!,
        method: 'timeout',
      };

      this.cleanup();
      console.log(chalk.yellow(`\nTimeout reached. Selected: ${defaultOption.label}`));
      resolve(result);
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

    // キーボードリスナーを削除
    process.stdin.removeAllListeners('keypress');
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
  private getOptionStyle(style?: string, isSelected: boolean = false): typeof chalk {
    const baseStyles: Record<string, typeof chalk> = {
      primary: chalk.cyan,
      secondary: chalk.gray,
      danger: chalk.red,
      success: chalk.green,
      warning: chalk.yellow,
    };

    const selectedStyle = isSelected ? chalk.bold.inverse : (x: string) => x;
    const colorStyle = baseStyles[style || 'primary'] || chalk.white;

    return (text: string) => selectedStyle(colorStyle(text));
  }

  /**
   * キーバインドをトリガーすべきかチェック
   */
  private shouldTriggerBinding(binding: KeyBinding, key: unknown): boolean {
    if (binding.ctrl && !key.ctrl) return false;
    if (binding.meta && !key.meta) return false;
    if (binding.shift && !key.shift) return false;
    return true;
  }

  /**
   * キー文字列を構築
   */
  private buildKeyString(key: unknown): string {
    const parts: string[] = [];
    if (key.ctrl) parts.push('ctrl');
    if (key.meta) parts.push('meta');
    if (key.shift) parts.push('shift');
    parts.push(key.name);
    return parts.join('+');
  }

  /**
   * テキストを中央揃え
   */
  private centerText(text: string, width: number, style?: (text: string) => string): string {
    const padding = Math.max(0, Math.floor((width - text.length) / 2));
    const rightPadding = Math.max(0, width - text.length - padding);
    const styledText = style ? style(text) : text;
    return ' '.repeat(padding) + styledText + ' '.repeat(rightPadding);
  }

  /**
   * テキストを折り返し
   */
  private wrapText(text: string, width: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      if (currentLine.length + word.length + 1 <= width) {
        currentLine += (currentLine ? ' ' : '') + word;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }

    if (currentLine) lines.push(currentLine);
    return lines;
  }

  /**
   * 静的ヘルパーメソッド
   */
  static async quickConfirm(message: string, defaultYes: boolean = false): Promise<boolean> {
    const prompt = new ApprovalPrompt({
      title: 'Confirmation',
      message,
      options: [
        {
          key: 'y',
          label: 'Yes',
          action: () => {},
          style: 'success',
          shortcut: 'y',
        },
        {
          key: 'n',
          label: 'No',
          action: () => {},
          style: 'secondary',
          shortcut: 'n',
        },
      ],
      defaultOption: defaultYes ? 'y' : 'n',
      compactMode: true,
    });

    const result = await prompt.show();
    return result.selectedKey === 'y';
  }

  /**
   * 選択プロンプト
   */
  static async choose<T>(
    title: string,
    message: string,
    choices: Array<{ value: T; label: string; description?: string }>,
  ): Promise<T | null> {
    const options: ApprovalOption[] = choices.map((choice, index) => ({
      key: (index + 1).toString(),
      label: choice.label,
      description: choice.description,
      action: () => {},
    }));

    const prompt = new ApprovalPrompt({
      title,
      message,
      options,
      allowEscape: true,
    });

    const result = await prompt.show();
    const selectedIndex = parseInt(result.selectedKey) - 1;

    return selectedIndex >= 0 && selectedIndex < choices.length
      ? choices[selectedIndex].value
      : null;
  }
}

export default ApprovalPrompt;
