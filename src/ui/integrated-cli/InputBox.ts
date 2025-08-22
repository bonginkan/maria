/**
 * InputBox Component
 * ユーザー入力用の白枠チョークボックス
 */

import chalk from 'chalk';
import readline from 'readline';
import { DESIGN_CONSTANTS } from '../optimized-design-system.js';

/**
 * チョークボックス文字
 */
const CHALK_BOX_CHARS = {
  TOP_LEFT: '┌',
  TOP_RIGHT: '┐',
  BOTTOM_LEFT: '└',
  BOTTOM_RIGHT: '┘',
  HORIZONTAL: '─',
  VERTICAL: '│',
  PROMPT: '>',
} as const;

/**
 * 入力ボックス設定
 */
export interface InputBoxConfig {
  width?: number;
  promptSymbol?: string;
  promptColor?: typeof chalk;
  borderColor?: typeof chalk;
  textColor?: typeof chalk;
  multiline?: boolean;
  placeholder?: string;
}

/**
 * 入力ボックスクラス
 */
export class InputBox {
  private config: Required<InputBoxConfig>;
  private rl: readline.Interface | null = null;
  private currentInput: string = '';
  private isActive: boolean = false;
  private cursorPosition: number = 0;

  constructor(config: InputBoxConfig = {}) {
    this.config = {
      width: config.width || DESIGN_CONSTANTS.CONTENT_WIDTH,
      promptSymbol: config.promptSymbol || CHALK_BOX_CHARS.PROMPT,
      promptColor: config.promptColor || chalk.cyan,
      borderColor: config.borderColor || chalk.white,
      textColor: config.textColor || chalk.white,
      multiline: config.multiline || false,
      placeholder: config.placeholder || 'Type your command or question here...',
    };
  }

  /**
   * 入力ボックスを描画
   */
  render(value: string = ''): void {
    const width = this.config.width;
    const border = this.config.borderColor;
    const prompt = this.config.promptColor;
    const text = this.config.textColor;

    // Clear previous render
    if (this.isActive) {
      this.clearBox();
    }

    // Top border
    console.log(
      border(
        CHALK_BOX_CHARS.TOP_LEFT +
          CHALK_BOX_CHARS.HORIZONTAL.repeat(width - 2) +
          CHALK_BOX_CHARS.TOP_RIGHT,
      ),
    );

    // Empty line for padding
    console.log(
      border(CHALK_BOX_CHARS.VERTICAL) + ' '.repeat(width - 2) + border(CHALK_BOX_CHARS.VERTICAL),
    );

    // Input line with prompt
    const promptStr = prompt(` ${this.config.promptSymbol} `);
    const inputValue = value || this.currentInput;
    const displayText = inputValue || chalk.gray(this.config.placeholder);
    const maxTextWidth = width - 6; // Account for borders, prompt, and spacing

    const truncatedText =
      displayText.length > maxTextWidth
        ? `${displayText.substring(0, maxTextWidth - 3)  }...`
        : displayText;

    const textLine = promptStr + text(truncatedText);
    const padding = width - this.stripAnsi(promptStr + truncatedText).length - 2;

    console.log(
      border(CHALK_BOX_CHARS.VERTICAL) +
        textLine +
        ' '.repeat(Math.max(0, padding)) +
        border(CHALK_BOX_CHARS.VERTICAL),
    );

    // Empty line for padding
    console.log(
      border(CHALK_BOX_CHARS.VERTICAL) + ' '.repeat(width - 2) + border(CHALK_BOX_CHARS.VERTICAL),
    );

    // Bottom border
    console.log(
      border(
        CHALK_BOX_CHARS.BOTTOM_LEFT +
          CHALK_BOX_CHARS.HORIZONTAL.repeat(width - 2) +
          CHALK_BOX_CHARS.BOTTOM_RIGHT,
      ),
    );

    this.isActive = true;
  }

  /**
   * 入力ボックスをアクティブ化
   */
  async activate(): Promise<string> {
    return new Promise((resolve) => {
      this.render();

      // Create readline interface
      this.rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: true,
      });

      // Move cursor to input position
      this.moveCursorToInput();

      // Handle input
      this.rl.question('', (answer) => {
        this.currentInput = answer;
        this.deactivate();
        resolve(answer);
      });

      // Handle real-time input display
      if (process.stdin.isTTY) {
        process.stdin.on('keypress', this.handleKeypress.bind(this));
      }
    });
  }

  /**
   * 入力ボックスを非アクティブ化
   */
  deactivate(): void {
    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }
    this.isActive = false;
  }

  /**
   * マルチライン入力モード
   */
  async activateMultiline(): Promise<string[]> {
    const lines: string[] = [];
    console.log(chalk.gray('(Press Ctrl+D or type "EOF" on a new line to finish)'));

    return new Promise((resolve) => {
      const collectLines = async () => {
        const line = await this.activate();

        if (line === 'EOF' || line === '') {
          resolve(lines);
        } else {
          lines.push(line);
          await collectLines();
        }
      };

      collectLines();
    });
  }

  /**
   * キー入力を処理
   */
  private handleKeypress(str: string, key: unknown): void {
    if (!this.isActive) {return;}

    // Update display in real-time
    if (key && key.name === 'backspace') {
      this.currentInput = this.currentInput.slice(0, -1);
    } else if (key && key.name === 'return') {
      // Enter pressed - handled by readline
      return;
    } else if (str && !key.ctrl && !key.meta) {
      this.currentInput += str;
    }

    // Re-render with updated input
    this.clearBox();
    this.render(this.currentInput);
    this.moveCursorToInput();
  }

  /**
   * カーソルを入力位置に移動
   */
  private moveCursorToInput(): void {
    // Move cursor up 2 lines to the input line
    process.stdout.write('\x1b[2A');
    // Move cursor to after the prompt
    const promptLength = this.stripAnsi(` ${this.config.promptSymbol} `).length + 1;
    process.stdout.write(`\x1b[${promptLength}C`);
    // Move cursor to the end of current input
    if (this.currentInput) {
      process.stdout.write(`\x1b[${this.currentInput.length}C`);
    }
  }

  /**
   * ボックスをクリア
   */
  private clearBox(): void {
    // Move up 6 lines (box height) and clear each line
    for (let i = 0; i < 6; i++) {
      process.stdout.write('\x1b[1A\x1b[2K');
    }
  }

  /**
   * ANSIコードを削除
   */
  private stripAnsi(str: string): string {
    return str.replace(/\x1b\[[0-9;]*m/g, '');
  }

  /**
   * 入力値を取得
   */
  getValue(): string {
    return this.currentInput;
  }

  /**
   * 入力値をクリア
   */
  clear(): void {
    this.currentInput = '';
    if (this.isActive) {
      this.render();
    }
  }

  /**
   * プレースホルダーを設定
   */
  setPlaceholder(placeholder: string): void {
    this.config.placeholder = placeholder;
    if (this.isActive && !this.currentInput) {
      this.render();
    }
  }

  /**
   * 入力値を設定
   */
  setValue(value: string): void {
    this.currentInput = value;
    this.cursorPosition = value.length;
    if (this.isActive) {
      this.render(value);
    }
  }

  /**
   * スタティックレンダリング（インタラクティブでない表示）
   */
  static renderStatic(content: string, config: InputBoxConfig = {}): void {
    const box = new InputBox(config);
    box.render(content);
  }

  /**
   * コンパクト入力ボックス
   */
  static renderCompact(prompt: string = '>'): void {
    const border = chalk.white;
    const promptColor = chalk.cyan;

    console.log(
      border('[') + promptColor(` ${prompt} `) + chalk.gray('_'.repeat(40)) + border(']'),
    );
  }
}

export default InputBox;
