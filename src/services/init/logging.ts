/**
 * Logging Module with TTY/JSON Support
 * Provides progress tracking, spinners, and structured logging for CLI
 */

import process from "node:process";
import chalk from "chalk";

type LogLevel =
  | "info"
  | "warn"
  | "error"
  | "success"
  | "start"
  | "progress"
  | "done";

export interface LogEvent {
  ts: string;
  level: LogLevel;
  task?: string;
  msg?: string;
  data?: Record<string, unknown>;
  progress?: {
    current: number;
    total: number;
    pct: number;
  };
}

// Spinner frames for TTY mode
const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

interface Spinner {
  text: string;
  frame: number;
  timer?: NodeJS.Timeout;
  active: boolean;
  start(): void;
  stop(symbol?: string): void;
  update(text: string): void;
}

interface ProgressBar {
  total: number;
  current: number;
  width: number;
  active: boolean;
  startTime: number;
  update(current: number): void;
  stop(): void;
}

/**
 * Create a simple spinner for TTY mode
 */
function createSpinner(text: string): Spinner {
  let frame = 0;
  let active = false;
  let timer: NodeJS.Timeout | undefined;

  const render = () => {
    const f = SPINNER_FRAMES[(frame = (frame + 1) % SPINNER_FRAMES.length)];
    process.stdout.write(`\r ${chalk.cyan(f)} ${text}`);
  };

  return {
    text,
    frame,
    active,
    start() {
      if (active) return;
      active = true;
      render();
      timer = setInterval(render, 80);
    },
    stop(symbol = "✔") {
      if (!active) return;
      active = false;
      if (timer) clearInterval(timer);
      const finalSymbol =
        symbol === "✔"
          ? chalk.green(symbol)
          : symbol === "⚠"
            ? chalk.yellow(symbol)
            : symbol === "✖"
              ? chalk.red(symbol)
              : symbol;
      process.stdout.write(`\r ${finalSymbol} ${text}\n`);
    },
    update(newText: string) {
      text = newText;
    },
  };
}

/**
 * Create a progress bar for TTY mode
 */
function createProgressBar(total: number, width = 24): ProgressBar {
  let current = 0;
  let active = true;
  const startTime = Date.now();

  const draw = () => {
    const pct = Math.min(1, current / total);
    const filled = Math.round(pct * width);
    const bar = "█".repeat(filled) + "░".repeat(width - filled);
    const pctStr = (pct * 100).toFixed(0).padStart(3, " ");
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const rate = elapsed > 0 ? Math.floor(current / elapsed) : 0;

    process.stdout.write(
      `\r   ${chalk.cyan("[" + bar + "]")} ${chalk.bold(pctStr + "%")} ` +
        `(${current}/${total}) ${chalk.gray(`${rate}/s`)}`,
    );
  };

  return {
    total,
    current,
    width,
    active,
    startTime,
    update(n: number) {
      current = Math.min(n, total);
      draw();
      if (current >= total) {
        this.stop();
      }
    },
    stop() {
      if (!active) return;
      active = false;
      process.stdout.write("\n");
    },
  };
}

/**
 * Enhanced Logger with TTY and JSON support
 */
export class Logger {
  private jsonMode = false;
  private events: LogEvent[] = [];
  private spinners = new Map<string, Spinner>();
  private progressBars = new Map<string, ProgressBar>();
  private taskStartTimes = new Map<string, number>();
  private silent = false;

  constructor(opts?: { json?: boolean; silent?: boolean }) {
    this.jsonMode = !!opts?.json || process.env.CI === "true";
    this.silent = !!opts?.silent;
  }

  /**
   * Create logger instance
   */
  static async create(opts?: {
    json?: boolean;
    silent?: boolean;
  }): Promise<Logger> {
    return new Logger(opts);
  }

  /**
   * Emit log event
   */
  emit(event: Partial<LogEvent>): void {
    if (this.silent) return;

    const e: LogEvent = {
      ts: new Date().toISOString(),
      level: event.level || "info",
      ...event,
    };

    if (this.jsonMode) {
      // JSON mode - structured output for CI/CD
      this.events.push(e);
      process.stdout.write(JSON.stringify(e) + "\n");
    } else {
      // TTY mode - pretty output with colors and animations
      this.handleTTYOutput(e);
    }
  }

  /**
   * Handle TTY output with spinners and progress bars
   */
  private handleTTYOutput(e: LogEvent): void {
    // Start task with spinner
    if (e.level === "start" && e.task) {
      this.taskStartTimes.set(e.task, Date.now());

      // Stop any existing spinner for this task
      const existing = this.spinners.get(e.task);
      if (existing) {
        existing.stop();
      }

      const spinner = createSpinner(e.msg || e.task);
      spinner.start();
      this.spinners.set(e.task, spinner);
      return;
    }

    // Progress update
    if (e.level === "progress" && e.task && e.progress) {
      const spinner = this.spinners.get(e.task);
      if (spinner) {
        spinner.stop();
        this.spinners.delete(e.task);
      }

      let bar = this.progressBars.get(e.task);
      if (!bar) {
        bar = createProgressBar(e.progress.total);
        this.progressBars.set(e.task, bar);
      }
      bar.update(e.progress.current);
      return;
    }

    // Complete task
    if (
      (e.level === "done" ||
        e.level === "success" ||
        e.level === "error" ||
        e.level === "warn") &&
      e.task
    ) {
      const spinner = this.spinners.get(e.task);
      if (spinner) {
        const symbol =
          e.level === "success" || e.level === "done"
            ? "✔"
            : e.level === "warn"
              ? "⚠"
              : e.level === "error"
                ? "✖"
                : "•";

        // Add timing info
        const startTime = this.taskStartTimes.get(e.task);
        let message = e.msg || spinner.text;
        if (startTime) {
          const duration = Date.now() - startTime;
          message += chalk.gray(` (${this.formatDuration(duration)})`);
          this.taskStartTimes.delete(e.task);
        }

        spinner.update(message);
        spinner.stop(symbol);
        this.spinners.delete(e.task);
      }

      const bar = this.progressBars.get(e.task);
      if (bar) {
        bar.stop();
        this.progressBars.delete(e.task);
      }

      if (!spinner && !bar && e.msg) {
        this.printMessage(e.level, e.msg);
      }
      return;
    }

    // Regular message
    if (e.msg) {
      this.printMessage(e.level, e.msg);
    }
  }

  /**
   * Print formatted message
   */
  private printMessage(level: LogLevel, msg: string): void {
    const prefix =
      level === "warn"
        ? chalk.yellow("⚠")
        : level === "error"
          ? chalk.red("✖")
          : level === "success"
            ? chalk.green("✔")
            : level === "info"
              ? chalk.blue("•")
              : "";

    const coloredMsg =
      level === "warn"
        ? chalk.yellow(msg)
        : level === "error"
          ? chalk.red(msg)
          : level === "success"
            ? chalk.green(msg)
            : msg;

    console.log(` ${prefix} ${coloredMsg}`);
  }

  /**
   * Format duration in human-readable format
   */
  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }

  // Convenience methods
  info(msg: string, data?: Record<string, unknown>): void {
    this.emit({ level: "info", msg, data });
  }

  warn(msg: string, data?: Record<string, unknown>): void {
    this.emit({ level: "warn", msg, data });
  }

  error(msg: string, data?: Record<string, unknown>): void {
    this.emit({ level: "error", msg, data });
  }

  success(msg: string, data?: Record<string, unknown>): void {
    this.emit({ level: "success", msg, data });
  }

  start(task: string, msg?: string): void {
    this.emit({ level: "start", task, msg: msg || task });
  }

  progress(task: string, current: number, total: number): void {
    this.emit({
      level: "progress",
      task,
      progress: {
        current,
        total,
        pct: total > 0 ? current / total : 0,
      },
    });
  }

  done(task: string, msg?: string): void {
    this.emit({ level: "done", task, msg });
  }

  /**
   * Get all events (for JSON mode)
   */
  getEvents(): LogEvent[] {
    return this.events;
  }

  /**
   * Print header with box drawing
   */
  header(title: string): void {
    if (this.jsonMode || this.silent) return;

    const width = Math.max(title.length + 4, 60);
    const padding = Math.floor((width - title.length - 2) / 2);
    const line = "─".repeat(width - 2);

    console.log(chalk.cyan(`╭${line}╮`));
    console.log(
      chalk.cyan("│") +
        " ".repeat(padding) +
        chalk.bold.white(title) +
        " ".repeat(width - padding - title.length - 2) +
        chalk.cyan("│"),
    );
    console.log(chalk.cyan(`╰${line}╯`));
  }

  /**
   * Print summary with stats
   */
  summary(stats: Record<string, any>): void {
    if (this.jsonMode) {
      this.emit({ level: "info", msg: "Summary", data: stats });
      return;
    }

    if (this.silent) return;

    console.log("\n" + chalk.bold("Summary:"));
    for (const [key, value] of Object.entries(stats)) {
      const formattedKey = key
        .replace(/_/g, " ")
        .replace(/\b\w/g, (l) => l.toUpperCase());
      console.log(`  ${chalk.gray(formattedKey + ":")} ${chalk.white(value)}`);
    }
  }

  /**
   * Create a section divider
   */
  section(title: string): void {
    if (this.jsonMode || this.silent) return;
    console.log("\n" + chalk.gray("▶") + " " + chalk.bold(title));
  }

  /**
   * Print a table
   */
  table(headers: string[], rows: any[][]): void {
    if (this.jsonMode) {
      this.emit({ level: "info", msg: "Table", data: { headers, rows } });
      return;
    }

    if (this.silent) return;

    // Calculate column widths
    const widths = headers.map((h, i) => {
      const values = rows.map((r) => String(r[i] || ""));
      return Math.max(h.length, ...values.map((v) => v.length));
    });

    // Print headers
    const headerRow = headers.map((h, i) => h.padEnd(widths[i])).join(" │ ");
    console.log("  " + chalk.bold(headerRow));
    console.log("  " + widths.map((w) => "─".repeat(w)).join("─┼─"));

    // Print rows
    rows.forEach((row) => {
      const formattedRow = row
        .map((cell, i) => String(cell || "").padEnd(widths[i]))
        .join(" │ ");
      console.log("  " + formattedRow);
    });
  }
}

// Export singleton for convenience
export const logger = new Logger();
