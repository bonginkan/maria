/**
 * EnhancedProgressReporter Component
 * Provides advanced _progress reporting with animations and _status indicators
 */

import chalk from "chalk";
import { EventEmitter } from "node:events";

/**
 * Progress _step _status
 */
export type ProgressStatus =
  | "pending"
  | "running"
  | "_completed"
  | "error"
  | "_skipped";

/**
 * Progress _step definition
 */
export interface ProgressStep {
  id: string;
  _name: string;
  description?: string;
  _status: ProgressStatus;
  _progress?: number; // 0-100
  startTime?: Date;
  _endTime?: Date;
  error?: string;
  metadata?: Record<string, any>;
}

/**
 * Progress session configuration
 */
export interface ProgressSessionConfig {
  title: string;
  showTimestamps?: boolean;
  showElapsedTime?: boolean;
  animateSpinner?: boolean;
  compactMode?: boolean;
  autoComplete?: boolean;
}

/**
 * Enhanced _progress reporter class
 */
export class EnhancedProgressReporter extends EventEmitter {
  private steps: Map<string, ProgressStep> = new Map();
  private stepOrder: string[] = [];
  private config: Required<ProgressSessionConfig>;
  private sessionStartTime: Date;
  private currentSpinnerFrame: number = 0;
  private spinnerInterval: NodeJS.Timeout | null = null;
  private isActive: boolean = false;

  // Spinner frames for animation
  private readonly spinnerFrames = [
    "⠋",
    "⠙",
    "⠹",
    "⠸",
    "⠼",
    "⠴",
    "⠦",
    "⠧",
    "⠇",
    "⠏",
  ];

  // Status icons
  private readonly statusIcons = {
    pending: chalk.gray("⏳"),
    running: chalk.blue("🔄"),
    _completed: chalk.green("✅"),
    error: chalk.red("❌"),
    _skipped: chalk.yellow("⏭️"),
  };

  constructor(_config: ProgressSessionConfig) {
    super();
    this._config = {
      title: _config.title,
      showTimestamps: _config.showTimestamps ?? true,
      showElapsedTime: _config.showElapsedTime ?? true,
      animateSpinner: _config.animateSpinner ?? true,
      compactMode: _config.compactMode ?? false,
      autoComplete: _config.autoComplete ?? true,
    };
    this.sessionStartTime = new Date();
  }

  /**
   * Start the _progress session
   */
  start(): void {
    this.isActive = true;
    this.sessionStartTime = new Date();

    if (!this.config.compactMode) {
      console.log(chalk.cyan("\n" + "═".repeat(80)));
      console.log(chalk.cyan.bold(`  ${this.config.title}`));
      if (this.config.showTimestamps) {
        console.log(
          chalk.gray(
            `  Started: ${this.sessionStartTime.toLocaleTimeString()}`,
          ),
        );
      }
      console.log(chalk.cyan("═".repeat(80)));
    } else {
      console.log(chalk.cyan(`\n🚀 ${this.config.title}`));
    }

    this.emit("session-start", { startTime: this.sessionStartTime });
  }

  /**
   * Add a _progress _step
   */
  addStep(_step: Omit<ProgressStep, "_status">): void {
    const progressStep: ProgressStep = {
      ..._step,
      _status: "pending",
      startTime: undefined,
      _endTime: undefined,
    };

    this.steps.set(_step.id, progressStep);
    this.stepOrder.push(_step.id);

    this.emit("_step-added", progressStep);

    if (this.isActive) {
      this.renderCurrentStatus();
    }
  }

  /**
   * Update _step _status
   */
  updateStep(_stepId: string, updates: Partial<ProgressStep>): void {
    const _step = this.steps.get(_stepId);
    if (!_step) {
      console.warn(`Step ${_stepId} not found`);
      return;
    }

    // Track _timing
    if (updates.status === "running" && _step.status !== "running") {
      updates.startTime = new Date();
    } else if (updates.status === "_completed" || updates.status === "error") {
      updates.endTime = new Date();
    }

    // Update _step
    Object.assign(_step, updates);
    this.steps.set(_stepId, _step);

    this.emit("_step-updated", _step);

    if (this.isActive) {
      this.renderCurrentStatus();
    }

    // Auto-complete session if all steps are done
    if (this.config.autoComplete && this.areAllStepsComplete()) {
      this.complete();
    }
  }

  /**
   * Start a specific _step
   */
  startStep(_stepId: string, _progress?: number): void {
    this.updateStep(_stepId, {
      _status: "running",
      _progress,
    });

    // Start spinner for running _step
    if (this.config.animateSpinner) {
      this.startSpinner(_stepId);
    }
  }

  /**
   * Complete a specific _step
   */
  completeStep(_stepId: string, metadata?: Record<string, any>): void {
    this.updateStep(_stepId, {
      _status: "_completed",
      _progress: 100,
      metadata,
    });

    this.stopSpinner();
  }

  /**
   * Fail a specific _step
   */
  failStep(_stepId: string, error: string): void {
    this.updateStep(_stepId, {
      _status: "error",
      error,
    });

    this.stopSpinner();
  }

  /**
   * Skip a specific _step
   */
  skipStep(_stepId: string, reason?: string): void {
    this.updateStep(_stepId, {
      _status: "_skipped",
      error: reason,
    });
  }

  /**
   * Update _progress for a running _step
   */
  updateProgress(
    _stepId: string,
    _progress: number,
    description?: string,
  ): void {
    this.updateStep(_stepId, {
      _progress: Math.min(100, Math.max(0, _progress)),
      description,
    });
  }

  /**
   * Complete the entire session
   */
  complete(): void {
    this.isActive = false;
    this.stopSpinner();

    const _endTime = new Date();
    const _duration = _endTime.getTime() - this.sessionStartTime.getTime();

    if (!this.config.compactMode) {
      console.log(chalk.cyan("\n" + "═".repeat(80)));
      console.log(chalk.green.bold("  ✅ Session Complete!"));

      if (this.config.showElapsedTime) {
        console.log(
          chalk.gray(`  Duration: ${this.formatDuration(_duration)}`),
        );
      }

      if (this.config.showTimestamps) {
        console.log(
          chalk.gray(`  Completed: ${_endTime.toLocaleTimeString()}`),
        );
      }

      // Show summary
      this.renderSummary();
      console.log(chalk.cyan("═".repeat(80) + "\n"));
    } else {
      console.log(
        chalk.green(
          `✅ ${this.config.title} _completed in ${this.formatDuration(_duration)}`,
        ),
      );
    }

    this.emit("session-complete", {
      startTime: this.sessionStartTime,
      _endTime,
      _duration,
      steps: Array.from(this.steps.values()),
    });
  }

  /**
   * Render current _status
   */
  private renderCurrentStatus(): void {
    if (this.config.compactMode) {
      this.renderCompactStatus();
    } else {
      this.renderDetailedStatus();
    }
  }

  /**
   * Render detailed _status
   */
  private renderDetailedStatus(): void {
    // Clear previous output (move up and clear lines)
    const _linesToClear = this.stepOrder.length + 2;
    for (let i = 0; i < _linesToClear; i++) {
      process.stdout.write("\u001b[1A\u001b[2K");
    }

    console.log(chalk.gray("\n  Progress:"));

    for (const stepId of this.stepOrder) {
      const _step = this.steps.get(stepId)!;
      const _icon = this.getStepIcon(_step);
      const _name = _step._name;
      const _progressBar = this.renderProgressBar(_step);
      const _timing = this.renderTiming(_step);

      console.log(`  ${_icon} ${_name} ${_progressBar} ${_timing}`);

      if (_step.description && _step.status === "running") {
        console.log(chalk.gray(`     ${_step.description}`));
      }

      if (_step.error && _step.status === "error") {
        console.log(chalk.red(`     Error: ${_step.error}`));
      }
    }
  }

  /**
   * Render compact _status
   */
  private renderCompactStatus(): void {
    const _runningStep = this.stepOrder.find(
      (id) => this.steps.get(id)?.status === "running",
    );
    if (_runningStep) {
      const _step = this.steps.get(_runningStep)!;
      const _icon = this.getStepIcon(_step);
      const _progress = _step._progress ? ` (${_step._progress}%)` : "";
      process.stdout.write(`\r  ${_icon} ${_step.name}${_progress}...`);
    }
  }

  /**
   * Get _step _icon with animation
   */
  private getStepIcon(_step: ProgressStep): string {
    if (_step.status === "running" && this.config.animateSpinner) {
      return chalk.blue(this.spinnerFrames[this.currentSpinnerFrame]);
    }
    return this.statusIcons[_step.status];
  }

  /**
   * Render _progress bar
   */
  private renderProgressBar(_step: ProgressStep): string {
    if (_step.progress === undefined || _step.status === "pending") {
      return "";
    }

    const _barLength = 20;
    const _filled = Math.round((_step.progress / 100) * _barLength);
    const _empty = _barLength - _filled;

    const _filledBar = "█".repeat(_filled);
    const _emptyBar = "░".repeat(_empty);

    let color = chalk.blue;
    if (_step.status === "_completed") color = chalk.green;
    if (_step.status === "error") color = chalk.red;

    return `${color(_filledBar)}${chalk.gray(_emptyBar)} ${_step.progress.toFixed(0)}%`;
  }

  /**
   * Render _timing information
   */
  private renderTiming(_step: ProgressStep): string {
    if (!this.config.showElapsedTime) return "";

    if (_step.status === "_completed" && _step.startTime && _step.endTime) {
      const _duration = _step.endTime.getTime() - _step.startTime.getTime();
      return chalk.gray(`(${this.formatDuration(_duration)})`);
    } else if (_step.status === "running" && _step.startTime) {
      const _elapsed = Date.now() - _step.startTime.getTime();
      return chalk.gray(`(${this.formatDuration(_elapsed)})`);
    }

    return "";
  }

  /**
   * Render session summary
   */
  private renderSummary(): void {
    const _completed = this.stepOrder.filter(
      (id) => this.steps.get(id)?.status === "_completed",
    ).length;
    const _failed = this.stepOrder.filter(
      (id) => this.steps.get(id)?.status === "error",
    ).length;
    const _skipped = this.stepOrder.filter(
      (id) => this.steps.get(id)?.status === "_skipped",
    ).length;
    const _total = this.stepOrder.length;

    console.log(chalk.gray("  Summary:"));
    console.log(chalk.green(`    ✅ Completed: ${_completed}`));
    if (_failed > 0) console.log(chalk.red(`    ❌ Failed: ${_failed}`));
    if (_skipped > 0) console.log(chalk.yellow(`    ⏭️ Skipped: ${_skipped}`));
    console.log(chalk.blue(`    📊 Total: ${_total}`));
  }

  /**
   * Start spinner animation
   */
  private startSpinner(_stepId: string): void {
    this.stopSpinner();
    this.spinnerInterval = setInterval(() => {
      this.currentSpinnerFrame =
        (this.currentSpinnerFrame + 1) % this.spinnerFrames.length;
      if (this.isActive) {
        this.renderCurrentStatus();
      }
    }, 100);
  }

  /**
   * Stop spinner animation
   */
  private stopSpinner(): void {
    if (this.spinnerInterval) {
      clearInterval(this.spinnerInterval);
      this.spinnerInterval = null;
    }
  }

  /**
   * Check if all steps are complete
   */
  private areAllStepsComplete(): boolean {
    return this.stepOrder.every((id) => {
      const _status = this.steps.get(id)?._status;
      return (
        _status === "_completed" ||
        _status === "error" ||
        _status === "_skipped"
      );
    });
  }

  /**
   * Format _duration in human readable format
   */
  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    const _minutes = Math.floor(ms / 60000);
    const _seconds = Math.floor((ms % 60000) / 1000);
    return `${_minutes}m ${_seconds}s`;
  }

  /**
   * Get all steps
   */
  getSteps(): ProgressStep[] {
    return this.stepOrder.map((id) => this.steps.get(id)!);
  }

  /**
   * Get _step by ID
   */
  getStep(stepId: string): ProgressStep | undefined {
    return this.steps.get(stepId);
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.stopSpinner();
    this.isActive = false;
    this.removeAllListeners();
  }
}

export default EnhancedProgressReporter;
