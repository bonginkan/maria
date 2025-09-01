// src/services/interactive-session/display/DisplayManager.ts
// Centralized display management with OS-specific handling

import * as os from "os";
import chalk from "chalk";
import { SpinnerManager } from "./SpinnerManager";
import * as FormatUtils from "./FormatUtils";

export interface DisplayOptions {
  enableColors?: boolean;
  enableEmoji?: boolean;
  enableAnimations?: boolean;
  theme?: "light" | "dark" | "auto";
}

export interface CursorState {
  visible: boolean;
  position?: { x: number; y: number };
}

/**
 * DisplayManager - Centralized display management
 * - OS-specific control sequences
 * - Cursor management
 * - ANSI control safety
 * - Theme support
 */
export class DisplayManager {
  private spinnerManager: SpinnerManager;
  private platform: NodeJS.Platform;
  private isWindows: boolean;
  private isTTY: boolean;
  private options: Required<DisplayOptions>;
  private cursorState: CursorState = { visible: true };

  constructor(options: DisplayOptions = {}) {
    this.spinnerManager = SpinnerManager.getInstance();
    this.platform = os.platform();
    this.isWindows = this.platform === "win32";
    this.isTTY = process.stdout.isTTY || false;

    this.options = {
      enableColors: options.enableColors ?? this.isTTY,
      enableEmoji: options.enableEmoji ?? !this.isWindows,
      enableAnimations: options.enableAnimations ?? this.isTTY,
      theme: options.theme ?? "auto",
    };

    // Configure chalk based on options
    if (!this.options.enableColors) {
      chalk.level = 0;
    }

    // Setup cleanup handlers
    this.setupCleanupHandlers();
  }

  /**
   * Clear the terminal screen
   */
  clear(): void {
    if (!this.isTTY) {
      console.log("\n".repeat(10)); // Fallback for non-TTY
      return;
    }

    if (this.isWindows) {
      // Windows-specific clear
      process.stdout.write("\x1B[2J\x1B[0f");
    } else {
      // Unix-like clear
      console.clear();
    }
  }

  /**
   * Move cursor to position
   * @param x - Column (0-based)
   * @param y - Row (0-based)
   */
  moveCursor(x: number, y: number): void {
    if (!this.isTTY) return;

    // ANSI escape sequence to move cursor
    process.stdout.write(`\x1B[${y + 1};${x + 1}H`);
    this.cursorState.position = { x, y };
  }

  /**
   * Show or hide cursor
   * @param visible - Whether to show cursor
   */
  setCursorVisible(visible: boolean): void {
    if (!this.isTTY) return;

    if (visible) {
      process.stdout.write("\x1B[?25h"); // Show cursor
    } else {
      process.stdout.write("\x1B[?25l"); // Hide cursor
    }

    this.cursorState.visible = visible;
  }

  /**
   * Save current cursor position
   */
  saveCursorPosition(): void {
    if (!this.isTTY) return;
    process.stdout.write("\x1B[s");
  }

  /**
   * Restore saved cursor position
   */
  restoreCursorPosition(): void {
    if (!this.isTTY) return;
    process.stdout.write("\x1B[u");
  }

  /**
   * Clear current line
   */
  clearLine(): void {
    if (!this.isTTY) return;
    process.stdout.write("\x1B[2K\r");
  }

  /**
   * Clear from cursor to end of line
   */
  clearToEndOfLine(): void {
    if (!this.isTTY) return;
    process.stdout.write("\x1B[K");
  }

  /**
   * Write text at current position
   * @param text - Text to write
   */
  write(text: string): void {
    process.stdout.write(text);
  }

  /**
   * Write line with newline
   * @param text - Text to write
   */
  writeLine(text: string = ""): void {
    console.log(text);
  }

  /**
   * Print formatted message
   * @param message - Message to print
   * @param type - Message type for styling
   */
  print(
    message: string,
    type: "normal" | "success" | "error" | "warning" | "info" = "normal",
  ): void {
    let formatted: string;

    switch (type) {
      case "success":
        formatted = FormatUtils.formatSuccess(message);
        break;
      case "error":
        formatted = FormatUtils.formatError(message);
        break;
      case "warning":
        formatted = FormatUtils.formatWarning(message);
        break;
      case "info":
        formatted = FormatUtils.formatInfo(message);
        break;
      default:
        formatted = message;
    }

    this.writeLine(formatted);
  }

  /**
   * Display a box around content
   * @param content - Content to box
   * @param options - Box options
   */
  box(
    content: string,
    options: {
      padding?: number;
      borderStyle?: "single" | "double" | "round";
      borderColor?: typeof chalk;
    } = {},
  ): void {
    const {
      padding = 1,
      borderStyle = "single",
      borderColor = chalk.gray,
    } = options;

    const lines = content.split("\n");
    const maxLength = Math.max(...lines.map((l) => l.length));
    const paddedWidth = maxLength + padding * 2;

    // Border characters
    const borders = {
      single: { tl: "┌", tr: "┐", bl: "└", br: "┘", h: "─", v: "│" },
      double: { tl: "╔", tr: "╗", bl: "╚", br: "╝", h: "═", v: "║" },
      round: { tl: "╭", tr: "╮", bl: "╰", br: "╯", h: "─", v: "│" },
    };

    const b = borders[borderStyle];
    const pad = " ".repeat(padding);

    // Top border
    this.writeLine(borderColor(b.tl + b.h.repeat(paddedWidth) + b.tr));

    // Padding lines
    for (let i = 0; i < padding; i++) {
      this.writeLine(
        borderColor(b.v) + " ".repeat(paddedWidth) + borderColor(b.v),
      );
    }

    // Content lines
    for (const line of lines) {
      const paddedLine = pad + line.padEnd(maxLength) + pad;
      this.writeLine(borderColor(b.v) + paddedLine + borderColor(b.v));
    }

    // Padding lines
    for (let i = 0; i < padding; i++) {
      this.writeLine(
        borderColor(b.v) + " ".repeat(paddedWidth) + borderColor(b.v),
      );
    }

    // Bottom border
    this.writeLine(borderColor(b.bl + b.h.repeat(paddedWidth) + b.br));
  }

  /**
   * Display a table
   * @param headers - Column headers
   * @param rows - Data rows
   * @param options - Table options
   */
  table(
    headers: string[],
    rows: string[][],
    options?: Parameters<typeof FormatUtils.formatTable>[2],
  ): void {
    const table = FormatUtils.formatTable(headers, rows, options);
    this.writeLine(table);
  }

  /**
   * Display a progress bar
   * @param current - Current value
   * @param total - Total value
   * @param label - Optional label
   */
  progress(current: number, total: number, label?: string): void {
    this.clearLine();

    const bar = FormatUtils.formatProgressBar(current, total);
    const prefix = label ? `${label}: ` : "";

    this.write(prefix + bar);
  }

  /**
   * Start a spinner
   * @param text - Spinner text
   * @returns Spinner ID
   */
  startSpinner(text?: string): string {
    if (!this.options.enableAnimations) {
      this.writeLine(chalk.gray(`⊙ ${text || "Processing..."}`));
      return "no-animation";
    }

    return this.spinnerManager.start({ text });
  }

  /**
   * Stop a spinner
   * @param id - Spinner ID
   * @param reason - Stop reason
   */
  stopSpinner(
    id: string,
    reason: "success" | "fail" | "warn" | "info" = "success",
  ): void {
    if (id === "no-animation") return;
    this.spinnerManager.stop(id, reason);
  }

  /**
   * Stop all spinners
   */
  stopAllSpinners(): void {
    this.spinnerManager.stopAll();
  }

  /**
   * Display with animation (if enabled)
   * @param frames - Animation frames
   * @param intervalMs - Interval between frames
   */
  async animate(frames: string[], intervalMs = 100): Promise<void> {
    if (!this.options.enableAnimations) {
      this.writeLine(frames[frames.length - 1]);
      return;
    }

    for (const frame of frames) {
      this.clearLine();
      this.write(frame);
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
    this.writeLine();
  }

  /**
   * Get emoji or fallback
   * @param emoji - Emoji character
   * @param fallback - Fallback character
   * @returns Emoji or fallback based on platform
   */
  emoji(emoji: string, fallback: string): string {
    return this.options.enableEmoji ? emoji : fallback;
  }

  /**
   * Setup cleanup handlers to restore terminal state
   */
  private setupCleanupHandlers(): void {
    const cleanup = () => {
      this.stopAllSpinners();
      this.setCursorVisible(true);
      this.clearLine();
    };

    process.on("exit", cleanup);
    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);
    process.on("uncaughtException", (error) => {
      cleanup();
      console.error("Uncaught exception:", error);
      process.exit(1);
    });
  }

  /**
   * Get platform-specific newline
   */
  get newline(): string {
    return this.isWindows ? "\r\n" : "\n";
  }

  /**
   * Check if colors are enabled
   */
  get colorsEnabled(): boolean {
    return this.options.enableColors;
  }

  /**
   * Check if running in TTY
   */
  get isTTYMode(): boolean {
    return this.isTTY;
  }

  /**
   * Get current platform
   */
  get currentPlatform(): NodeJS.Platform {
    return this.platform;
  }
}
