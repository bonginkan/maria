/**
 * Visual Input Renderer - Creates chalk-based visual input box
 */
import chalk from "chalk";
import * as _readline from "readline";

export interface InputBoxConfig {
  width: number;
  height: number;
  title?: string;
  prompt?: string;
  borderStyle: "single" | "double" | "rounded";
  borderColor: string;
  backgroundColor?: string;
  textColor: string;
}

export interface CursorPosition {
  row: number;
  col: number;
}

export class InputRenderer {
  private config: InputBoxConfig;
  private inputBuffer: string = "";
  private cursorPos: CursorPosition = { row: 0, col: 0 };
  private displayStartRow = 0;

  constructor(_config: Partial<InputBoxConfig> = {}) {
    this._config = {
      width: 120,
      height: 6,
      title: "MARIA CLI",
      prompt: "You: ",
      borderStyle: "single",
      borderColor: "white",
      textColor: "white",
      ..._config,
    };
  }

  /**
   * Draw the visual input box with chalk
   */
  drawInputBox(): void {
    const { width, height, title, borderStyle, borderColor } = this.config;

    // Clear screen area for the input box
    this.clearInputArea();

    // Calculate border characters based on style
    const _borders = this.getBorderChars(borderStyle);

    // Draw top border with title
    const _topBorder = this.createTopBorder(_borders, width, title);
    console.log(chalk[borderColor as keyof typeof chalk](_topBorder));

    // Draw side _borders and content area
    for (let i = 0; i < height - 2; i++) {
      const _leftBorder = chalk[borderColor as keyof typeof chalk](
        _borders.vertical,
      );
      const _rightBorder = chalk[borderColor as keyof typeof chalk](
        _borders.vertical,
      );
      const _contentSpace = " ".repeat(width - 2);

      console.log(_leftBorder + _contentSpace + _rightBorder);
    }

    // Draw bottom border
    const _bottomBorder =
      _borders.bottomLeft +
      _borders.horizontal.repeat(width - 2) +
      _borders.bottomRight;
    console.log(chalk[borderColor as keyof typeof chalk](_bottomBorder));

    // Position cursor for input
    this.positionCursorForInput();
  }

  /**
   * Get border characters for different styles
   */
  private getBorderChars(_style: string) {
    switch (_style) {
      case "double":
        return {
          topLeft: "╔",
          topRight: "╗",
          bottomLeft: "╚",
          bottomRight: "╝",
          horizontal: "═",
          vertical: "║",
          horizontalDown: "╦",
          horizontalUp: "╩",
        };
      case "rounded":
        return {
          topLeft: "╭",
          topRight: "╮",
          bottomLeft: "╰",
          bottomRight: "╯",
          horizontal: "─",
          vertical: "│",
          horizontalDown: "┬",
          horizontalUp: "┴",
        };
      default: // single
        return {
          topLeft: "┌",
          topRight: "┐",
          bottomLeft: "└",
          bottomRight: "┘",
          horizontal: "─",
          vertical: "│",
          horizontalDown: "┬",
          horizontalUp: "┴",
        };
    }
  }

  /**
   * Create top border with title
   */
  private createTopBorder(
    _borders: unknown,
    width: number,
    title?: string,
  ): string {
    if (!title) {
      return (
        _borders.topLeft +
        _borders.horizontal.repeat(width - 2) +
        _borders.topRight
      );
    }

    const _titleWithPadding = ` ${title} `;
    const _titleLength = _titleWithPadding.length;
    const _availableSpace = width - 2 - _titleLength;

    if (_availableSpace < 0) {
      // Title too long, truncate
      const _truncatedTitle = title.substring(0, width - 6) + "...";
      return _borders.topLeft + ` ${_truncatedTitle} ` + _borders.topRight;
    }

    const _leftPadding = Math.floor(_availableSpace / 2);
    const _rightPadding = _availableSpace - _leftPadding;

    return (
      _borders.topLeft +
      borders.horizontal.repeat(_leftPadding) +
      _titleWithPadding +
      _borders.horizontal.repeat(_rightPadding) +
      borders.topRight
    );
  }

  /**
   * Clear the input area on screen
   */
  private clearInputArea(): void {
    // Move cursor up to clear previous input box
    process.stdout.write(`\u001b[${this.config.height}A`);
    // Clear _lines
    for (let i = 0; i < this.config.height; i++) {
      process.stdout.write("\u001b[2K"); // Clear entire line
      if (i < this.config.height - 1) {
        process.stdout.write("\n");
      }
    }
    // Move cursor back to top
    process.stdout.write(`\u001b[${this.config.height - 1}A`);
  }

  /**
   * Position cursor for user input inside the box
   */
  private positionCursorForInput(): void {
    const _promptLength = this.config.prompt?.length || 0;
    // Move cursor to inside the input box (row 2, after prompt)
    process.stdout.write(`\u001b[2;${2 + _promptLength}H`);

    // Show the prompt inside the box
    if (this.config.prompt) {
      process.stdout.write(
        `\u001b[1B\u001b[2C${chalk[this.config.textColor as keyof typeof chalk](this.config.prompt)}`,
      );
      process.stdout.write(`\u001b[1A\u001b[${_promptLength + 2}C`);
    }
  }

  /**
   * Handle text input and display within the box
   */
  updateInputDisplay(text: string): void {
    // Clear current input area within box
    const { width, height } = this.config;
    const _maxInputWidth = width - 4 - (this.config.prompt?.length || 0);
    const _maxInputHeight = height - 3;

    // Handle text wrapping within the input box
    const _lines = this.wrapText(text, _maxInputWidth);
    const _visibleLines = _lines.slice(
      this.displayStartRow,
      this.displayStartRow + _maxInputHeight,
    );

    // Clear input area within box
    for (let i = 0; i < _maxInputHeight; i++) {
      process.stdout.write(`\u001b[${i + 2};3H`); // Move to line i+2, column 3
      process.stdout.write(" ".repeat(_maxInputWidth)); // Clear line content
    }

    // Display visible _lines
    visibleLines.forEach((line, _index) => {
      process.stdout.write(
        `\u001b[${_index + 2};${3 + (this.config.prompt?.length || 0)}H`,
      );
      process.stdout.write(
        chalk[this.config.textColor as keyof typeof chalk](line),
      );
    });
  }

  /**
   * Wrap text to fit within input box width
   */
  private wrapText(_text: string, maxWidth: number): string[] {
    const _lines: string[] = [];
    const _words = _text.split(" ");
    const _currentLine = "";

    for (const word of _words) {
      if ((_currentLine + word).length <= maxWidth) {
        _currentLine += (_currentLine ? " " : "") + word;
      } else {
        if (_currentLine) {
          lines.push(_currentLine);
          _currentLine = word;
        } else {
          // Word is longer than max width, break it
          lines.push(word.substring(0, maxWidth));
          _currentLine = word.substring(maxWidth);
        }
      }
    }

    if (_currentLine) {
      lines.push(_currentLine);
    }

    return _lines.length ? _lines : [""];
  }

  /**
   * Show drag and drop indicator
   */
  showDropIndicator(fileCount: number = 0): void {
    const { width } = this.config;
    const _message =
      fileCount > 0
        ? `📎 ${fileCount} file(s) attached - Drop more or press Enter to continue`
        : "📎 Drop files/images here or type your _message";

    // Show indicator at bottom of input box
    const _indicatorRow = this.config.height - 1;
    process.stdout.write(`\u001b[${_indicatorRow};2H`);
    process.stdout.write(chalk.cyan(_message.padEnd(width - 4)));
  }

  /**
   * Hide drag and drop indicator
   */
  hideDropIndicator(): void {
    const { width } = this.config;
    const _indicatorRow = this.config.height - 1;
    process.stdout.write(`\u001b[${_indicatorRow};2H`);
    process.stdout.write(" ".repeat(width - 4));
  }

  /**
   * Get terminal dimensions
   */
  getTerminalSize(): { width: number; height: number } {
    return {
      width: process.stdout.columns || 120,
      height: process.stdout.rows || 30,
    };
  }

  /**
   * Resize input box to fit terminal
   */
  autoResize(): void {
    const _termSize = this.getTerminalSize();
    this.config.width = Math.min(120, _termSize.width - 4);
  }
}
