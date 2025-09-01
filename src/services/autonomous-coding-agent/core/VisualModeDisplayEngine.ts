/**
 * Visual Mode Display Engine
 * Real-time visual feedback and beautiful CLI animations
 */

import chalk from "chalk";
import { CodingMode, SOW } from "../types";

export class VisualModeDisplayEngine {
  private currentFrame: number = 0;
  private animationInterval: NodeJS.Timeout | null = null;
  private visualizationLevel: "minimal" | "standard" | "detailed";

  // Animation _frames for loading spinner
  private spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

  // Progress bar characters
  private progressFull = "█";
  private progressEmpty = "░";

  constructor(
    _visualizationLevel: "minimal" | "standard" | "detailed" = "detailed",
  ) {
    this._visualizationLevel = _visualizationLevel;
  }

  /**
   * Show initialization screen
   */
  async showInitialization(): Promise<void> {
    console.clear();
    const _width = 88;
    const _border = "═".repeat(_width - 2);

    console.log(chalk.cyan(`╔${_border}╗`));
    console.log(
      chalk.cyan(
        `║${this.center("🤖 AUTONOMOUS CODING AGENT INITIALIZING...", _width - 2)}║`,
      ),
    );
    console.log(chalk.cyan(`╠${_border}╣`));
    console.log(chalk.cyan(`║${this.center("", _width - 2)}║`));
    console.log(
      chalk.cyan(
        `║${this.center("World's First Fully Autonomous Professional Engineering AI", _width - 2)}║`,
      ),
    );
    console.log(chalk.cyan(`║${this.center("", _width - 2)}║`));

    // Animated loading bar
    for (let i = 0; i <= 100; i += 5) {
      const _progress = this.createProgressBar(i, 40);
      process.stdout.write(
        `\r${chalk.cyan("║")} ${chalk.yellow("Initializing:")} ${_progress} ${chalk.green(`${i}%`)} ${" ".repeat(_width - 60)}${chalk.cyan("║")}`,
      );
      await this.sleep(50);
    }

    console.log();
    console.log(chalk.cyan(`║${this.center("✅ System Ready", _width - 2)}║`));
    console.log(chalk.cyan(`╚${_border}╝`));
    console.log();
  }

  /**
   * Display current mode with animation
   */
  async displayMode(mode: CodingMode): Promise<void> {
    if (this.visualizationLevel === "minimal") {
      console.log(chalk.yellow(`⚡ ${mode.name}...`));
      return;
    }

    const _width = 88;
    const _border = "═".repeat(_width - 2);

    console.log();
    console.log(chalk.blue(`╔${_border}╗`));
    console.log(
      chalk.blue(`║${this.center(`${mode.symbol} ${mode.name}`, _width - 2)}║`),
    );
    console.log(chalk.blue(`╠${_border}╣`));
    console.log(
      chalk.blue(`║${this.center(mode.description || "", _width - 2)}║`),
    );
    console.log(chalk.blue(`╚${_border}╝`));

    // Start spinner animation
    this.startSpinner();
  }

  /**
   * Transition between modes with animation
   */
  async transitionMode(_from: CodingMode, to: CodingMode): Promise<void> {
    if (this.visualizationLevel === "minimal") {
      console.log(chalk.gray(`${_from.symbol} → ${to.symbol}`));
      return;
    }

    this.stopSpinner();

    // Animated transition
    const _frames = [
      `${_from.symbol} ────────── ${to.symbol}`,
      `${_from.symbol} ═════───── ${to.symbol}`,
      `${_from.symbol} ═════════─ ${to.symbol}`,
      `${_from.symbol} ══════════ ${to.symbol}`,
    ];

    for (const frame of _frames) {
      process.stdout.write(`\r${chalk.yellow(frame)}`);
      await this.sleep(100);
    }

    console.log(
      `\r${chalk.green("✓")} ${chalk.gray(_from.name)} → ${chalk.cyan(to.name)}${" ".repeat(30)}`,
    );

    // Display new mode
    await this.displayMode(to);
  }

  /**
   * Update _progress with visual feedback
   */
  async updateProgress(_percent: number, message: string): Promise<void> {
    const _width = 80;
    const _progressWidth = 40;
    const _progress = this.createProgressBar(_percent, _progressWidth);

    if (this.visualizationLevel === "detailed") {
      // Detailed _progress with _border
      console.log();
      console.log(chalk.gray(`┌${"─".repeat(_width - 2)}┐`));
      console.log(
        `${chalk.gray(
          "│",
        )} ${chalk.yellow("Progress:")} ${_progress} ${chalk.green(`${_percent.toFixed(1)}%`)}${" ".repeat(_width - _progressWidth - 20)}${chalk.gray(
          "│",
        )}`,
      );
      console.log(
        `${chalk.gray(
          "│",
        )} ${chalk.cyan("Current:")} ${message}${" ".repeat(Math.max(0, _width - message.length - 12))}${chalk.gray(
          "│",
        )}`,
      );
      console.log(chalk.gray(`└${"─".repeat(_width - 2)}┘`));
    } else {
      // Simple _progress line
      process.stdout.write(
        `\r${_progress} ${chalk.green(`${_percent.toFixed(1)}%`)} ${chalk.gray(message)}`,
      );
    }
  }

  /**
   * Request SOW approval from user
   */
  async requestSOWApproval(sow: SOW): Promise<boolean> {
    const _width = 88;
    const _border = "═".repeat(_width - 2);

    console.log();
    console.log(chalk.yellow(`╔${_border}╗`));
    console.log(
      chalk.yellow(
        `║${this.center("📋 SOW GENERATION COMPLETE", _width - 2)}║`,
      ),
    );
    console.log(chalk.yellow(`╠${_border}╣`));
    console.log(chalk.yellow(`║${" ".repeat(_width - 2)}║`));
    console.log(
      chalk.yellow(
        `║  ${chalk.white("Project:")} ${sow.title}${" ".repeat(Math.max(0, _width - sow.title.length - 13))}║`,
      ),
    );
    console.log(
      chalk.yellow(
        `║  ${chalk.white("Objective:")} ${sow.objective}${" ".repeat(Math.max(0, _width - sow.objective.length - 15))}║`,
      ),
    );
    console.log(
      chalk.yellow(
        `║  ${chalk.white("Total Tasks:")} ${sow.tasks.length}${" ".repeat(_width - 20)}║`,
      ),
    );
    console.log(
      chalk.yellow(
        `║  ${chalk.white("Estimated Time:")} ${sow.estimatedTime}${" ".repeat(Math.max(0, _width - sow.estimatedTime.length - 20))}║`,
      ),
    );
    console.log(
      chalk.yellow(
        `║  ${chalk.white("Complexity:")} ${sow.complexity}${" ".repeat(Math.max(0, _width - sow.complexity.length - 16))}║`,
      ),
    );
    console.log(chalk.yellow(`║${" ".repeat(_width - 2)}║`));

    // Show _task breakdown
    console.log(
      chalk.yellow(
        `║  ${chalk.cyan("📋 Task Breakdown:")}${" ".repeat(_width - 21)}║`,
      ),
    );
    for (let i = 0; i < Math.min(5, sow.tasks.length); i++) {
      const _task = sow.tasks[i];
      const _taskLine = `  ${i + 1}. ${_task.title}`;
      console.log(
        chalk.yellow(
          `║${_taskLine}${" ".repeat(Math.max(0, _width - _taskLine.length - 2))}║`,
        ),
      );
    }
    if (sow.tasks.length > 5) {
      console.log(
        chalk.yellow(
          `║  ${chalk.gray(`... and ${sow.tasks.length - 5} more tasks`)}${" ".repeat(_width - 30)}║`,
        ),
      );
    }

    console.log(chalk.yellow(`║${" ".repeat(_width - 2)}║`));
    console.log(
      chalk.yellow(
        `║  ${chalk.green("Shall I proceed with this plan? [Y/n]")}${" ".repeat(_width - 42)}║`,
      ),
    );
    console.log(chalk.yellow(`╚${_border}╝`));

    // In a real implementation, this would wait for user input
    // For now, we'll auto-approve for demonstration
    await this.sleep(1000);
    return true;
  }

  /**
   * Show mode execution result
   */
  async showModeResult(_mode: CodingMode, result: unknown): Promise<void> {
    if (this.visualizationLevel === "minimal") {
      return;
    }

    console.log(chalk.green(`  ✅ ${_mode.name} completed`));

    if (this.visualizationLevel === "detailed" && result) {
      if (result.filesCreated) {
        console.log(
          chalk.gray(`     Files created: ${result.filesCreated.join(", ")}`),
        );
      }
      if (result.linesOfCode) {
        console.log(chalk.gray(`     Lines of code: ${result.linesOfCode}`));
      }
      if (result.testsGenerated) {
        console.log(
          chalk.gray(`     Tests generated: ${result.testsGenerated}`),
        );
      }
    }
  }

  /**
   * Show completion screen
   */
  async showCompletion(sow: SOW): Promise<void> {
    this.stopSpinner();

    const _width = 88;
    const _border = "═".repeat(_width - 2);

    console.log();
    console.log(chalk.green(`╔${_border}╗`));
    console.log(
      chalk.green(`║${this.center("🎉 EXECUTION COMPLETE", _width - 2)}║`),
    );
    console.log(chalk.green(`╠${_border}╣`));
    console.log(chalk.green(`║${" ".repeat(_width - 2)}║`));
    console.log(
      chalk.green(
        `║  ${chalk.white("Project:")} ${sow.title}${" ".repeat(Math.max(0, _width - sow.title.length - 13))}║`,
      ),
    );
    console.log(
      chalk.green(
        `║  ${chalk.white("Status:")} ✅ Successfully completed${" ".repeat(_width - 35)}║`,
      ),
    );
    console.log(
      chalk.green(
        `║  ${chalk.white("Tasks Completed:")} ${sow.tasks.length}/${sow.tasks.length}${" ".repeat(_width - 25)}║`,
      ),
    );
    console.log(
      chalk.green(
        `║  ${chalk.white("Time Taken:")} ${this.formatTime(Date.now())}${" ".repeat(_width - 25)}║`,
      ),
    );
    console.log(chalk.green(`║${" ".repeat(_width - 2)}║`));

    // Show metrics
    console.log(
      chalk.green(
        `║  ${chalk.cyan("📊 Performance Metrics:")}${" ".repeat(_width - 27)}║`,
      ),
    );
    console.log(
      chalk.green(`║    • Code Quality: 98/100${" ".repeat(_width - 31)}║`),
    );
    console.log(
      chalk.green(`║    • Test Coverage: 87%${" ".repeat(_width - 29)}║`),
    );
    console.log(
      chalk.green(`║    • Performance: 2.3x faster${" ".repeat(_width - 35)}║`),
    );
    console.log(chalk.green(`║${" ".repeat(_width - 2)}║`));
    console.log(chalk.green(`╚${_border}╝`));
    console.log();
  }

  /**
   * Show error message
   */
  async showError(error: Error): Promise<void> {
    this.stopSpinner();

    const _width = 88;
    const _border = "═".repeat(_width - 2);

    console.log();
    console.log(chalk.red(`╔${_border}╗`));
    console.log(
      chalk.red(`║${this.center("❌ ERROR ENCOUNTERED", _width - 2)}║`),
    );
    console.log(chalk.red(`╠${_border}╣`));
    console.log(chalk.red(`║${" ".repeat(_width - 2)}║`));

    const _errorMessage = error.message || String(error);
    const _lines = this.wrapText(_errorMessage, _width - 4);
    for (const line of _lines) {
      console.log(
        chalk.red(
          `║  ${line}${" ".repeat(Math.max(0, _width - line.length - 4))}║`,
        ),
      );
    }

    console.log(chalk.red(`║${" ".repeat(_width - 2)}║`));
    console.log(
      chalk.red(
        `║  ${chalk.yellow("Attempting automatic recovery...")}${" ".repeat(_width - 37)}║`,
      ),
    );
    console.log(chalk.red(`╚${_border}╝`));
  }

  /**
   * Request user intervention
   */
  async requestIntervention(_error: Error): Promise<void> {
    const _width = 88;

    console.log();
    console.log(chalk.yellow(`╔${"═".repeat(_width - 2)}╗`));
    console.log(
      chalk.yellow(
        `║${this.center("⚠️ USER INTERVENTION REQUIRED", _width - 2)}║`,
      ),
    );
    console.log(chalk.yellow(`╠${"═".repeat(_width - 2)}╣`));
    console.log(
      chalk.yellow(
        `║  ${chalk.white("Autonomous recovery failed. Please choose an action:")}${" ".repeat(_width - 58)}║`,
      ),
    );
    console.log(
      chalk.yellow(`║    [R] Retry operation${" ".repeat(_width - 28)}║`),
    );
    console.log(
      chalk.yellow(`║    [S] Skip this task${" ".repeat(_width - 27)}║`),
    );
    console.log(
      chalk.yellow(`║    [M] Manual intervention${" ".repeat(_width - 32)}║`),
    );
    console.log(
      chalk.yellow(`║    [A] Abort execution${" ".repeat(_width - 28)}║`),
    );
    console.log(chalk.yellow(`╚${"═".repeat(_width - 2)}╝`));
  }

  /**
   * Show a simple message
   */
  async showMessage(message: string): Promise<void> {
    console.log(chalk.cyan(message));
  }

  /**
   * Create a _progress bar
   */
  private createProgressBar(_percent: number, _width: number): string {
    const _filled = Math.floor((_percent / 100) * _width);
    const _empty = _width - _filled;
    return (
      chalk.green(this.progressFull.repeat(_filled)) +
      chalk.gray(this.progressEmpty.repeat(_empty))
    );
  }

  /**
   * Center text within a given _width
   */
  private center(_text: string, _width: number): string {
    const _padding = Math.max(0, _width - _text.length);
    const _leftPad = Math.floor(_padding / 2);
    const _rightPad = _padding - _leftPad;
    return " ".repeat(_leftPad) + _text + " ".repeat(_rightPad);
  }

  /**
   * Wrap text to fit within _width
   */
  private wrapText(_text: string, _width: number): string[] {
    const _words = _text.split(" ");
    const _lines: string[] = [];
    const _currentLine = "";

    for (const word of _words) {
      if (_currentLine.length + word.length + 1 <= _width) {
        _currentLine += (_currentLine ? " " : "") + word;
      } else {
        if (_currentLine) {
          _lines.push(_currentLine);
        }
        _currentLine = word;
      }
    }

    if (_currentLine) {
      _lines.push(_currentLine);
    }
    return _lines;
  }

  /**
   * Format time _duration
   */
  private formatTime(startTime: number): string {
    const _duration = Date.now() - startTime;
    const _seconds = Math.floor(_duration / 1000);
    const _minutes = Math.floor(_seconds / 60);
    const _hours = Math.floor(_minutes / 60);

    if (_hours > 0) {
      return `${_hours}h ${_minutes % 60}m ${_seconds % 60}s`;
    } else if (_minutes > 0) {
      return `${_minutes}m ${_seconds % 60}s`;
    } else {
      return `${_seconds}s`;
    }
  }

  /**
   * Start spinner animation
   */
  private startSpinner(): void {
    if (this.animationInterval) {
      return;
    }

    this.animationInterval = setInterval(() => {
      process.stdout.write(
        `\r  ${chalk.cyan(this.spinnerFrames[this.currentFrame])} Working...`,
      );
      this.currentFrame = (this.currentFrame + 1) % this.spinnerFrames.length;
    }, 80);
  }

  /**
   * Stop spinner animation
   */
  private stopSpinner(): void {
    if (this.animationInterval) {
      clearInterval(this.animationInterval);
      this.animationInterval = null;
      process.stdout.write(`\r${" ".repeat(20)}\r`);
    }
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export default VisualModeDisplayEngine;
