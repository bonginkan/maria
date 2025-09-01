// src/services/interactive-session/display/InputBox.ts
// Interactive input box with visual feedback

import chalk from "chalk";
import { DisplayManager } from "./DisplayManager";
import * as FormatUtils from "./FormatUtils";

export interface InputBoxOptions {
  title?: string;
  prompt?: string;
  placeholder?: string;
  width?: number;
  borderStyle?: "single" | "double" | "round";
  borderColor?: typeof chalk;
  showHints?: boolean;
}

export interface InputBoxHint {
  key: string;
  action: string;
}

/**
 * InputBox - Visual input component
 * - Rounded box display
 * - Visual feedback
 * - Hint display
 * - Pure rendering (no direct console access)
 */
export class InputBox {
  private display: DisplayManager;
  private options: Required<InputBoxOptions>;
  private defaultHints: InputBoxHint[] = [
    { key: "Enter", action: "Submit" },
    { key: "Esc", action: "Cancel" },
    { key: "Tab", action: "Complete" },
  ];

  constructor(display: DisplayManager, options: InputBoxOptions = {}) {
    this.display = display;
    this.options = {
      title: options.title ?? "Input",
      prompt: options.prompt ?? "> ",
      placeholder: options.placeholder ?? "Type here...",
      width: options.width ?? 90,
      borderStyle: options.borderStyle ?? "round",
      borderColor: options.borderColor ?? chalk.cyan,
      showHints: options.showHints ?? true,
    };
  }

  /**
   * Render the input box (pure function)
   * @param currentInput - Current input value
   * @param cursorPosition - Cursor position in input
   * @returns Formatted box string
   */
  render(currentInput: string = "", cursorPosition: number = 0): string {
    const lines: string[] = [];
    const { width, borderStyle, borderColor } = this.options;

    // Border characters
    const borders = {
      single: { tl: "┌", tr: "┐", bl: "└", br: "┘", h: "─", v: "│" },
      double: { tl: "╔", tr: "╗", bl: "╚", br: "╝", h: "═", v: "║" },
      round: { tl: "╭", tr: "╮", bl: "╰", br: "╯", h: "─", v: "│" },
    };

    const b = borders[borderStyle];

    // Title bar
    const titleText = ` ${this.options.title} `;
    const titlePadding = Math.max(0, width - titleText.length - 2);
    const titleLine =
      borderColor(b.tl) +
      borderColor(b.h.repeat(Math.floor(titlePadding / 2))) +
      chalk.bold(titleText) +
      borderColor(b.h.repeat(Math.ceil(titlePadding / 2))) +
      borderColor(b.tr);

    lines.push(titleLine);

    // Empty line
    lines.push(borderColor(b.v) + " ".repeat(width) + borderColor(b.v));

    // Input line
    const inputDisplay = currentInput || chalk.gray(this.options.placeholder);
    const inputWithCursor = this.addCursor(inputDisplay, cursorPosition);
    const inputLine =
      borderColor(b.v) +
      " " +
      this.options.prompt +
      inputWithCursor.padEnd(width - this.options.prompt.length - 1) +
      borderColor(b.v);

    lines.push(inputLine);

    // Empty line
    lines.push(borderColor(b.v) + " ".repeat(width) + borderColor(b.v));

    // Hints line (if enabled)
    if (this.options.showHints) {
      const hints = this.formatHints();
      const hintsLine =
        borderColor(b.v) +
        " " +
        chalk.gray(hints).padEnd(width - 1) +
        borderColor(b.v);

      lines.push(hintsLine);
    }

    // Bottom border
    lines.push(
      borderColor(b.bl) + borderColor(b.h.repeat(width)) + borderColor(b.br),
    );

    return lines.join("\n");
  }

  /**
   * Display the input box
   * @param currentInput - Current input value
   * @param cursorPosition - Cursor position
   */
  show(currentInput: string = "", cursorPosition: number = 0): void {
    const rendered = this.render(currentInput, cursorPosition);

    // Clear previous display
    if (this.display.isTTYMode) {
      // Move up to overwrite previous box
      const lineCount = this.options.showHints ? 6 : 5;
      for (let i = 0; i < lineCount; i++) {
        process.stdout.write("\x1B[1A"); // Move up one line
        this.display.clearLine();
      }
    }

    // Display new box
    this.display.writeLine(rendered);
  }

  /**
   * Clear the input box
   */
  clear(): void {
    if (!this.display.isTTYMode) return;

    const lineCount = this.options.showHints ? 6 : 5;
    for (let i = 0; i < lineCount; i++) {
      process.stdout.write("\x1B[1A");
      this.display.clearLine();
    }
  }

  /**
   * Update options
   * @param options - New options
   */
  updateOptions(options: Partial<InputBoxOptions>): void {
    Object.assign(this.options, options);
  }

  /**
   * Add visual cursor to input string
   * @param text - Input text
   * @param position - Cursor position
   * @returns Text with cursor
   */
  private addCursor(text: string, position: number): string {
    if (position < 0 || position > text.length) {
      position = text.length;
    }

    const before = text.slice(0, position);
    const at = text[position] || " ";
    const after = text.slice(position + 1);

    // Blinking cursor effect (using inverse colors)
    const cursor = chalk.inverse(at);

    return before + cursor + after;
  }

  /**
   * Format hints for display
   * @returns Formatted hints string
   */
  private formatHints(): string {
    const hints = this.defaultHints
      .map((h) => `${chalk.bold(h.key)}: ${h.action}`)
      .join("  ");

    return FormatUtils.truncate(hints, this.options.width - 2);
  }

  /**
   * Create a static input box string (for non-interactive display)
   * @param title - Box title
   * @param content - Box content
   * @param options - Display options
   * @returns Formatted box string
   */
  static createStatic(
    title: string,
    content: string,
    options: Partial<InputBoxOptions> = {},
  ): string {
    const width = options.width ?? 90;
    const borderStyle = options.borderStyle ?? "round";
    const borderColor = options.borderColor ?? chalk.cyan;

    const borders = {
      single: { tl: "┌", tr: "┐", bl: "└", br: "┘", h: "─", v: "│" },
      double: { tl: "╔", tr: "╗", bl: "╚", br: "╝", h: "═", v: "║" },
      round: { tl: "╭", tr: "╮", bl: "╰", br: "╯", h: "─", v: "│" },
    };

    const b = borders[borderStyle];
    const lines: string[] = [];

    // Top border with title
    const titleText = ` ${title} `;
    const titlePadding = Math.max(0, width - titleText.length - 2);
    lines.push(
      borderColor(b.tl) +
        borderColor(b.h.repeat(Math.floor(titlePadding / 2))) +
        chalk.bold(titleText) +
        borderColor(b.h.repeat(Math.ceil(titlePadding / 2))) +
        borderColor(b.tr),
    );

    // Content lines
    const contentLines = content.split("\n");
    for (const line of contentLines) {
      const paddedLine = " " + line.padEnd(width - 1);
      lines.push(borderColor(b.v) + paddedLine + borderColor(b.v));
    }

    // Bottom border
    lines.push(
      borderColor(b.bl) + borderColor(b.h.repeat(width)) + borderColor(b.br),
    );

    return lines.join("\n");
  }
}
