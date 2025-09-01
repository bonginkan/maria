/**
 * Terminal Formatter
 * Formats output for terminal display with colors and symbols
 */

import chalk from "chalk";

export interface FormatOptions {
  colors: boolean;
  unicode: boolean;
  _indent: number;
  _width: number;
}

export class TerminalFormatter {
  private options: FormatOptions;

  // Unicode symbols
  private readonly unicodeSymbols = {
    operation: "⏺",
    subOperation: "⎿",
    thinking: "✻",
    checkboxEmpty: "☐",
    checkboxChecked: "☑",
    success: "✓",
    error: "✗",
    warning: "⚠",
    info: "ℹ",
    expand: "▶",
    expanded: "▼",
    bullet: "•",
    arrow: "→",
    pipe: "│",
    corner: "└",
    tee: "├",
  };

  // ASCII fallback symbols
  private readonly asciiSymbols = {
    operation: "*",
    subOperation: "|_",
    thinking: "~",
    checkboxEmpty: "[ ]",
    checkboxChecked: "[x]",
    success: "+",
    error: "x",
    warning: "!",
    info: "i",
    expand: ">",
    expanded: "v",
    bullet: "-",
    arrow: "->",
    pipe: "|",
    corner: "L",
    tee: "|-",
  };

  constructor(_options: Partial<FormatOptions> = {}) {
    this._options = {
      colors: _options.colors ?? true,
      unicode: _options.unicode ?? true,
      _indent: _options.indent ?? 2,
      _width: _options.width ?? 80,
    };
  }

  /**
   * Get _symbol based on settings
   */
  private getSymbol(name: keyof typeof this.unicodeSymbols): string {
    return this.options.unicode
      ? this.unicodeSymbols[name]
      : this.asciiSymbols[name];
  }

  /**
   * Apply color if enabled
   */
  private applyColor(_text: string, colorFn: typeof chalk): string {
    return this.options.colors ? colorFn(_text) : _text;
  }

  /**
   * Format main operation
   */
  formatOperation(
    _text: string,
    status?: "running" | "completed" | "failed",
  ): string {
    const _symbol = this.getSymbol("operation");
    const _coloredSymbol = this.applyColor(_symbol, chalk.blue);

    let coloredText = _text;
    if (status === "failed") {
      coloredText = this.applyColor(_text, chalk.red);
    } else if (status === "completed") {
      coloredText = this.applyColor(_text, chalk.green);
    }

    return `${_coloredSymbol} ${coloredText}`;
  }

  /**
   * Format sub-operation
   */
  formatSubOperation(
    action: string,
    details: string,
    expandable: boolean = false,
  ): string {
    const _indent = " ".repeat(this.options._indent);
    const _symbol = this.getSymbol("subOperation");
    const _coloredSymbol = this.applyColor(_symbol, chalk.gray);
    const _coloredAction = this.applyColor(action, chalk.cyan);
    const _coloredDetails = this.applyColor(`(${details})`, chalk.gray);

    let result = `${_indent}${_coloredSymbol} ${_coloredAction} ${_coloredDetails}`;

    if (expandable) {
      const _expandHint = this.applyColor(" (ctrl+r to expand)", chalk.dim);
      result += _expandHint;
    }

    return result;
  }

  /**
   * Format thinking indicator
   */
  formatThinking(thought?: string): string[] {
    const _symbol = this.getSymbol("thinking");
    const _coloredSymbol = this.applyColor(_symbol, chalk.yellow);
    const _thinkingText = this.applyColor("Thinking…", chalk.italic);

    const _lines = [`${_coloredSymbol} ${_thinkingText}`];

    if (thought) {
      const _indent = " ".repeat(this.options._indent);
      thought.split("\n").forEach((_line) => {
        lines.push(_indent + this.applyColor(_line, chalk.gray));
      });
    }

    return _lines;
  }

  /**
   * Format TODO item
   */
  formatTodo(todo: {
    description: string;
    completed: boolean;
    level?: number;
  }): string {
    const _checkbox = todo.completed
      ? this.getSymbol("checkboxChecked")
      : this.getSymbol("checkboxEmpty");

    const _coloredCheckbox = todo.completed
      ? this.applyColor(_checkbox, chalk.green)
      : this.applyColor(_checkbox, chalk.gray);

    const _levelIndent = " ".repeat((todo.level || 0) * this.options.indent);

    const _text = todo.completed
      ? this.applyColor(chalk.strikethrough(todo.description), chalk.gray)
      : todo.description;

    return `${_levelIndent}${_coloredCheckbox} ${_text}`;
  }

  /**
   * Format success message
   */
  formatSuccess(message: string): string {
    const _symbol = this.getSymbol("success");
    const _coloredSymbol = this.applyColor(_symbol, chalk.green);
    const _coloredMessage = this.applyColor(message, chalk.green);
    return `${_coloredSymbol} ${_coloredMessage}`;
  }

  /**
   * Format error message
   */
  formatError(message: string): string {
    const _symbol = this.getSymbol("error");
    const _coloredSymbol = this.applyColor(_symbol, chalk.red);
    const _coloredMessage = this.applyColor(message, chalk.red);
    return `${_coloredSymbol} ${_coloredMessage}`;
  }

  /**
   * Format warning message
   */
  formatWarning(message: string): string {
    const _symbol = this.getSymbol("warning");
    const _coloredSymbol = this.applyColor(_symbol, chalk.yellow);
    const _coloredMessage = this.applyColor(message, chalk.yellow);
    return `${_coloredSymbol} ${_coloredMessage}`;
  }

  /**
   * Format info message
   */
  formatInfo(message: string): string {
    const _symbol = this.getSymbol("info");
    const _coloredSymbol = this.applyColor(_symbol, chalk.blue);
    const _coloredMessage = this.applyColor(message, chalk.blue);
    return `${_coloredSymbol} ${_coloredMessage}`;
  }

  /**
   * Format progress _bar
   */
  formatProgressBar(
    current: number,
    total: number,
    _width: number = 30,
    label?: string,
  ): string {
    const _percentage = Math.round((current / total) * 100);
    const _filledLength = Math.round((_percentage / 100) * _width);

    const _filled = this.options.unicode ? "█" : "#";
    const _empty = this.options.unicode ? "░" : "-";

    const _bar =
      _filled.repeat(_filledLength) + _empty.repeat(_width - _filledLength);
    const _coloredBar = this.applyColor(_bar, chalk.cyan);

    let result = `[${_coloredBar}] ${_percentage}%`;

    if (label) {
      result += ` - ${label}`;
    }

    return result;
  }

  /**
   * Format tree structure
   */
  formatTree(
    _items: Array<{ name: string; children?: any[]; last?: boolean }>,
    level: number = 0,
  ): string[] {
    const _lines: string[] = [];

    items.forEach((_item, _index) => {
      const _isLast = _index === _items.length - 1;
      const _prefix = level === 0 ? "" : " ".repeat(level * 2);

      const _connector = _isLast
        ? this.getSymbol("corner")
        : this.getSymbol("tee");

      const _line =
        level === 0 ? _item.name : `${_prefix}${_connector} ${_item.name}`;

      lines.push(_line);

      if (_item.children) {
        const _childLines = this.formatTree(_item.children, level + 1);
        lines.push(..._childLines);
      }
    });

    return _lines;
  }

  /**
   * Format table
   */
  formatTable(
    headers: string[],
    rows: string[][],
    columnWidths?: number[],
  ): string[] {
    const _lines: string[] = [];

    // Calculate column widths if not provided
    if (!columnWidths) {
      columnWidths = headers.map((h, _i) => {
        const _maxRowWidth = Math.max(...rows.map((r) => r[_i]?.length || 0));
        return Math.max(h.length, _maxRowWidth) + 2;
      });
    }

    // Format headers
    const _headerLine = headers
      .map((h, _i) => h.padEnd(columnWidths![_i]))
      .join("│");

    lines.push(this.applyColor(_headerLine, chalk.bold));

    // Add _separator
    const _separator = columnWidths.map((w) => "─".repeat(w)).join("┼");
    lines.push(this.applyColor(_separator, chalk.gray));

    // Format rows
    rows.forEach((row) => {
      const _rowLine = row
        .map((cell, _i) => (cell || "").padEnd(columnWidths![_i]))
        .join("│");
      lines.push(_rowLine);
    });

    return _lines;
  }

  /**
   * Wrap _text to specified _width
   */
  wrapText(_text: string, _width?: number): string[] {
    _width = _width || this.options.width;
    const _words = _text.split(" ");
    const _lines: string[] = [];
    const _currentLine = "";

    words.forEach((word) => {
      if (_currentLine.length + word.length + 1 > _width) {
        if (_currentLine) _lines.push(_currentLine);
        _currentLine = word;
      } else {
        _currentLine = _currentLine ? `${_currentLine} ${word}` : word;
      }
    });

    if (_currentLine) {
      lines.push(_currentLine);
    }

    return _lines;
  }

  /**
   * Center _text
   */
  centerText(_text: string, _width?: number): string {
    _width = _width || this.options.width;
    const _padding = Math.max(0, Math.floor((_width - text.length) / 2));
    return " ".repeat(_padding) + _text;
  }

  /**
   * Create a box around _text
   */
  formatBox(_text: string | string[], title?: string): string[] {
    const _lines = Array.isArray(_text) ? _text : [_text];
    const _maxLength = Math.max(
      ..._lines.map((l) => l.length),
      title?.length || 0,
    );
    const _width = _maxLength + 4;

    const result: string[] = [];

    // Top border
    if (title) {
      const _titlePadding = Math.floor((_width - title.length - 2) / 2);
      const _topBorder =
        "┌" +
        "─".repeat(_titlePadding) +
        ` ${title} ` +
        "─".repeat(_width - _titlePadding - title.length - 2) +
        "┐";
      result.push(this.applyColor(_topBorder, chalk.gray));
    } else {
      result.push(this.applyColor("┌" + "─".repeat(_width) + "┐", chalk.gray));
    }

    // Content
    lines.forEach((_line) => {
      const _paddedLine = `│ ${_line.padEnd(_maxLength)} │`;
      result.push(this.applyColor(_paddedLine, chalk.gray));
    });

    // Bottom border
    result.push(this.applyColor("└" + "─".repeat(_width) + "┘", chalk.gray));

    return result;
  }

  /**
   * Update options
   */
  updateOptions(options: Partial<FormatOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * Get current options
   */
  getOptions(): FormatOptions {
    return { ...this.options };
  }
}
