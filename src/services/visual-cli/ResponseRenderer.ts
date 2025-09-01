/**
 * Response Renderer - Displays AI responses outside the input box area
 */
import chalk from "chalk";
import { TEXT_HIERARCHY } from "../../ui/design-system/UnifiedColorPalette";

export interface ResponseConfig {
  maxWidth: number;
  showProgress: boolean;
  showModes: boolean;
  enableColors: boolean;
  responsePrefix: string;
}

export interface ProgressStep {
  id: string;
  description: string;
  status: "pending" | "processing" | "completed" | "failed";
  details?: string;
  _timestamp: Date;
}

export class ResponseRenderer {
  private config: ResponseConfig;
  private currentSteps: Map<string, ProgressStep> = new Map();
  private responseArea = { startRow: 0, height: 0 };

  constructor(_config: Partial<ResponseConfig> = {}) {
    this._config = {
      maxWidth: 100,
      showProgress: true,
      showModes: true,
      enableColors: true,
      responsePrefix: "MARIA: ",
      ..._config,
    };
  }

  /**
   * Initialize response area below input box
   */
  initializeResponseArea(inputBoxHeight: number): void {
    this.responseArea.startRow = inputBoxHeight + 2;
    this.moveToResponseArea();
    console.log(chalk.gray("─".repeat(this.config.maxWidth)));
  }

  /**
   * Move cursor to response area
   */
  private moveToResponseArea(): void {
    process.stdout.write(`\u001b[${this.responseArea.startRow};1H`);
  }

  /**
   * Display progress step
   */
  displayProgressStep(step: ProgressStep): void {
    if (!this.config.showProgress) return;

    this.currentSteps.set(step.id, step);
    this.moveToResponseArea();

    const _icon = this.getStatusIcon(step.status);
    const _statusColor = this.getStatusColor(step.status);
    const _timestamp = step._timestamp.toLocaleTimeString();

    console.log(
      `${_icon} ${_statusColor(step.description)} ${chalk.gray(`(${_timestamp})`)}`,
    );

    if (step.details) {
      console.log(chalk.gray(`   ${step.details}`));
    }
  }

  /**
   * Update existing progress step
   */
  updateProgressStep(_stepId: string, updates: Partial<ProgressStep>): void {
    const _existingStep = this.currentSteps.get(_stepId);
    if (!_existingStep) return;

    const updatedStep: ProgressStep = {
      ..._existingStep,
      ...updates,
      _timestamp: new Date(),
    };

    this.currentSteps.set(_stepId, updatedStep);
    this.displayProgressStep(updatedStep);
  }

  /**
   * Start AI response display
   */
  startResponse(mode?: { symbol: string; name: string }): void {
    this.moveToResponseArea();
    console.log(); // Add spacing

    // Show header with mode indicator
    let header = TEXT_HIERARCHY.SUBTITLE(this.config.responsePrefix);

    if (this.config.showModes && mode) {
      header += chalk.dim(`[${mode.symbol} ${mode.name}] `);
    }

    process.stdout.write(header);
  }

  /**
   * Stream response content
   */
  streamContent(_chunk: string, isFirstChunk: boolean = false): void {
    if (isFirstChunk) {
      process.stdout.write("\n"); // New line before response content
    }
    process.stdout.write(_chunk);
  }

  /**
   * Complete response display
   */
  completeResponse(): void {
    console.log("\n");
    this.showCompletionSummary();
  }

  /**
   * Display error message
   */
  displayError(_error: string, details?: string): void {
    this.moveToResponseArea();
    console.log();
    console.log(chalk.red(`❌ Error: ${_error}`));

    if (details) {
      console.log(chalk.gray(`   ${details}`));
    }

    console.log();
  }

  /**
   * Display warning message
   */
  displayWarning(_warning: string, details?: string): void {
    this.moveToResponseArea();
    console.log(chalk.yellow(`⚠️ Warning: ${_warning}`));

    if (details) {
      console.log(chalk.gray(`   ${details}`));
    }
  }

  /**
   * Display info message
   */
  displayInfo(_info: string, details?: string): void {
    this.moveToResponseArea();
    console.log(chalk.blue(`ℹ️ ${_info}`));

    if (details) {
      console.log(chalk.gray(`   ${details}`));
    }
  }

  /**
   * Display success message
   */
  displaySuccess(_success: string, details?: string): void {
    this.moveToResponseArea();
    console.log(chalk.green(`✅ ${_success}`));

    if (details) {
      console.log(chalk.gray(`   ${details}`));
    }
  }

  /**
   * Show processing animation
   */
  showProcessingAnimation(message: string): NodeJS.Timeout {
    const _frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
    let frame = 0;

    return setInterval(() => {
      this.moveToResponseArea();
      process.stdout.write(`\r${chalk.cyan(_frames[frame])} ${message}   `);
      frame = (frame + 1) % _frames.length;
    }, 100);
  }

  /**
   * Stop processing animation
   */
  stopProcessingAnimation(interval: NodeJS.Timeout): void {
    clearInterval(interval);
    this.moveToResponseArea();
    process.stdout.write("\r" + " ".repeat(50) + "\r"); // Clear line
  }

  /**
   * Display reference processing status
   */
  displayReferenceStatus(
    references: { name: string; status: string; details?: string }[],
  ): void {
    if (references.length === 0) return;

    this.moveToResponseArea();
    console.log(chalk.blue("\n📎 Reference Processing:"));

    references.forEach((ref) => {
      const _statusIcon =
        ref.status === "completed"
          ? "✅"
          : ref.status === "processing"
            ? "🔄"
            : "❌";
      console.log(`  ${_statusIcon} ${ref.name}`);

      if (ref.details) {
        console.log(chalk.gray(`     ${ref.details}`));
      }
    });

    console.log();
  }

  /**
   * Display task breakdown
   */
  displayTaskBreakdown(
    tasks: { name: string; status: string; progress?: number }[],
  ): void {
    this.moveToResponseArea();
    console.log(chalk.blue("\n📋 Task Breakdown:"));

    tasks.forEach((task, _index) => {
      const _statusIcon = this.getTaskStatusIcon(task.status);
      const _statusColor = this.getStatusColor(task.status);

      let line = `  ${_index + 1}. ${_statusIcon} ${_statusColor(task.name)}`;

      if (task.progress !== undefined) {
        const _progressBar = this.createProgressBar(task.progress);
        line += ` ${_progressBar} ${task.progress}%`;
      }

      console.log(line);
    });

    console.log();
  }

  /**
   * Create a simple progress bar
   */
  private createProgressBar(_percentage: number, width: number = 20): string {
    const _filled = Math.round((_percentage / 100) * width);
    const _empty = width - _filled;
    return `[${"█".repeat(_filled)}${" ".repeat(_empty)}]`;
  }

  /**
   * Get status _icon based on status
   */
  private getStatusIcon(status: string): string {
    switch (status) {
      case "completed":
        return "✅";
      case "processing":
        return "🔄";
      case "failed":
        return "❌";
      case "pending":
        return "⏳";
      default:
        return "📋";
    }
  }

  /**
   * Get task status _icon
   */
  private getTaskStatusIcon(status: string): string {
    switch (status) {
      case "completed":
        return "✅";
      case "processing":
        return "⚡";
      case "failed":
        return "❌";
      case "pending":
        return "📝";
      default:
        return "📋";
    }
  }

  /**
   * Get status color function
   */
  private getStatusColor(status: string): (_text: string) => string {
    switch (status) {
      case "completed":
        return chalk.green;
      case "processing":
        return chalk.yellow;
      case "failed":
        return chalk.red;
      case "pending":
        return chalk.gray;
      default:
        return chalk.white;
    }
  }

  /**
   * Show completion summary
   */
  private showCompletionSummary(): void {
    const _completedSteps = Array.from(this.currentSteps.values()).filter(
      (step) => step.status === "completed",
    );

    if (_completedSteps.length > 0) {
      console.log(
        chalk.gray(`📊 Completed ${_completedSteps.length} processing steps`),
      );
    }

    // Clear steps for next response
    this.currentSteps.clear();
  }

  /**
   * Clear response area
   */
  clearResponseArea(): void {
    this.moveToResponseArea();
    // Clear multiple lines
    for (let i = 0; i < 20; i++) {
      process.stdout.write("\u001b[2K"); // Clear line
      if (i < 19) process.stdout.write("\n");
    }
    // Move back to start
    process.stdout.write(`\u001b[20A`);
  }

  /**
   * Set response area configuration
   */
  setConfig(config: Partial<ResponseConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): ResponseConfig {
    return { ...this.config };
  }
}
