// src/services/hsr-system/display/terminal-status-monitor.ts
/**
 * Terminal-Optimized Status Monitor
 * ターミナル最適化ステータスモニター
 */

import { EventEmitter } from "node:events";
import { HSRBrandedStyle } from "../themes/branded-style";
import { BaseInterruptionHandler } from "../interruption/base-interruption-handler";
import {
  StatusSnapshot,
  StatusDisplayConfig,
  StatusUpdateType,
  _AnalysisPhaseInfo,
} from "../types/status-types";
import {
  InterruptionAction,
  InterruptionResponse,
} from "../types/interruption-types";

export class TerminalStatusMonitor extends BaseInterruptionHandler {
  private readonly style = new HSRBrandedStyle();
  private readonly emitter = new EventEmitter();
  private currentSnapshot: StatusSnapshot | null = null;
  private config: StatusDisplayConfig;
  private displayLines: string[] = [];
  private isDisplayActive = false;
  private updateInterval: NodeJS.Timeout | null = null;
  private lastRenderTime = 0;

  constructor(_config: Partial<StatusDisplayConfig> = {}) {
    super();
    this._config = {
      mode: "DETAILED",
      colors: true,
      animations: true,
      updateFrequency: 500, // 500ms
      showMetrics: true,
      showHistory: false,
      maxHistoryLines: 5,
      ..._config,
    };
  }

  /**
   * Start monitoring and displaying status
   */
  async startMonitoring(initialSnapshot: StatusSnapshot): Promise<void> {
    this.currentSnapshot = initialSnapshot;
    this.isDisplayActive = true;

    // Setup keyboard input handling
    this.setupKeyboardHandling();

    // Start update loop
    this.startUpdateLoop();

    // Initial render
    this.render();
  }

  /**
   * Stop monitoring and cleanup
   */
  async stopMonitoring(): Promise<void> {
    this.isDisplayActive = false;

    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    // Clear display
    this.clearDisplay();
  }

  /**
   * Update current status _snapshot
   */
  updateSnapshot(_snapshot: StatusSnapshot): void {
    this.currentSnapshot = _snapshot;
    this.emitStatusUpdate("PROGRESS_UPDATE", _snapshot);
  }

  /**
   * Start the update rendering loop
   */
  private startUpdateLoop(): void {
    this.updateInterval = setInterval(() => {
      if (this.isDisplayActive && this.currentSnapshot) {
        this.render();
      }
    }, this.config.updateFrequency);
  }

  /**
   * Render current status to terminal
   */
  private render(): void {
    if (!this.currentSnapshot || !this.isDisplayActive) return;

    const _now = Date._now();
    if (_now - this.lastRenderTime < this.config.updateFrequency / 2) return;
    this.lastRenderTime = _now;

    // Build display based on mode
    const _lines = this.buildDisplayLines();

    // Clear and render
    this.clearDisplay();
    console.log(_lines.join("\n"));

    this.displayLines = _lines;
  }

  /**
   * Build display _lines based on current mode
   */
  private buildDisplayLines(): string[] {
    if (!this.currentSnapshot) return [];

    switch (this.config.mode) {
      case "MINIMAL":
        return this.buildMinimalDisplay();
      case "COMPACT":
        return this.buildCompactDisplay();
      case "DETAILED":
        return this.buildDetailedDisplay();
      default:
        return this.buildDetailedDisplay();
    }
  }

  /**
   * Build minimal single-line display
   */
  private buildMinimalDisplay(): string[] {
    const _snapshot = this.currentSnapshot!;
    const _progressBar = this.style.progress(_snapshot.progress);
    const _interruptible = _snapshot.isInterruptible
      ? this.style.ok("[ESC]")
      : this.style.muted("[LOCKED]");

    return [
      `${this.style.brand(_snapshot.mode)} ${_progressBar} ${_snapshot.progress.toFixed(1)}% ${_interruptible}`,
    ];
  }

  /**
   * Build compact multi-line display
   */
  private buildCompactDisplay(): string[] {
    const _snapshot = this.currentSnapshot!;
    const _lines: string[] = [];

    // Header
    lines.push(
      `${this.style.brand("MARIA HSR")} ${this.style.accent(_snapshot.mode)}`,
    );

    // Progress
    const _progressBar = this.style.progress(_snapshot.progress);
    _lines.push(`${_progressBar} ${_snapshot.progress.toFixed(1)}%`);

    // Phase
    lines.push(`${this.style.selected(_snapshot.phase.name)}`);

    // Controls
    const _controls = _snapshot.isInterruptible
      ? this.style.ok('ESC=Stop | "待って"=Pause')
      : this.style.muted("Processing...");
    lines.push(_controls);

    return _lines;
  }

  /**
   * Build detailed multi-section display
   */
  private buildDetailedDisplay(): string[] {
    const _snapshot = this.currentSnapshot!;
    const _lines: string[] = [];

    // === HEADER ===
    _lines.push(this.style.heading(`MARIA HSR - ${_snapshot.mode} ANALYSIS`));
    _lines.push(
      this.style.separator() + this.style.separator() + this.style.separator(),
    );

    // === SESSION INFO ===
    _lines.push(
      `Session: ${this.style.brand(_snapshot.sessionId.substring(0, 8))}`,
    );
    _lines.push(
      `Started: ${this.style.muted(_snapshot.metrics.startTime.toLocaleTimeString())}`,
    );
    _lines.push("");

    // === PROGRESS ===
    lines.push(this.style.heading("PROGRESS"));
    const _progressBar = this.style.progress(_snapshot.progress);
    _lines.push(`${_progressBar} ${_snapshot.progress.toFixed(1)}%`);

    // Current phase
    _lines.push(`Phase: ${this.style.selected(_snapshot.phase.name)}`);
    lines.push(`${this.style.muted(_snapshot.phase.description)}`);

    // Timing
    if (this.config.showMetrics) {
      const _elapsed = Date.now() - _snapshot.metrics.startTime.getTime();
      const _elapsedMinutes = Math.floor(_elapsed / 60000);
      const _elapsedSeconds = Math.floor((_elapsed % 60000) / 1000);

      lines.push(
        `Elapsed: ${this.style.hint(`${_elapsedMinutes}m ${_elapsedSeconds}s`)}`,
      );

      if (_snapshot.metrics.estimatedTotal > 0) {
        const _remaining = _snapshot.metrics.estimatedTotal - _elapsed;
        if (_remaining > 0) {
          const _remainingMinutes = Math.floor(_remaining / 60000);
          const _remainingSeconds = Math.floor((_remaining % 60000) / 1000);
          lines.push(
            `ETA: ${this.style.hint(`${_remainingMinutes}m ${_remainingSeconds}s`)}`,
          );
        }
      }
    }
    lines.push("");

    // === BRANCHES ===
    if (_snapshot.metrics.totalBranches > 0) {
      lines.push(this.style.heading("BRANCH ANALYSIS"));
      const _completed = _snapshot.metrics.completedBranches;
      const _total = _snapshot.metrics.totalBranches;

      lines.push(`Completed: ${this.style.accent(`${_completed}/${_total}`)}`);

      if (_snapshot.metrics.averageBranchTime > 0) {
        const _avgTime = Math.round(_snapshot.metrics.averageBranchTime / 1000);
        lines.push(`Avg Time: ${this.style.hint(`${_avgTime}s per branch`)}`);
      }
      lines.push("");
    }

    // === PARTIAL RESULTS ===
    if (_snapshot.partialResults.length > 0) {
      lines.push(this.style.heading("PARTIAL RESULTS"));

      const _recentResults = _snapshot.partialResults.slice(-3);
      recentResults.forEach((result) => {
        const _confidenceText = `${(result.confidence * 100).toFixed(1)}%`;
        const _viabilityIcon =
          result.viability > 0.7
            ? this.style.ok("[VIABLE]")
            : result.viability > 0.4
              ? this.style.warn("[REVIEW]")
              : this.style.err("[LOW]");

        _lines.push(`${this.style.bullet()}${_viabilityIcon} ${result.name}`);
        lines.push(
          `  ${this.style.muted(`Confidence: ${_confidenceText} | ${result.reasoning.substring(0, 60)}...`)}`,
        );
      });

      if (_snapshot.partialResults.length > 3) {
        const _more = _snapshot.partialResults.length - 3;
        lines.push(this.style.muted(`... and ${_more} _more results`));
      }
      lines.push("");
    }

    // === HUMAN CONTROL ===
    lines.push(this.style.heading("HUMAN CONTROL"));

    const _controlStatus = _snapshot.isInterruptible
      ? this.style.ok("READY")
      : this.style.muted("PROCESSING");
    lines.push(`Status: ${_controlStatus}`);

    if (_snapshot.humanMetrics.lastInteractionTime) {
      const _timeSince =
        Date.now() - _snapshot.humanMetrics.lastInteractionTime.getTime();
      const _minutesSince = Math.floor(_timeSince / 60000);
      const _secondsSince = Math.floor((_timeSince % 60000) / 1000);
      lines.push(
        `Last Interaction: ${this.style.muted(`${_minutesSince}m ${_secondsSince}s ago`)}`,
      );
    }

    // Response time
    const _responseTime = _snapshot.humanMetrics.controlResponseTime;
    const _responseStatus =
      _responseTime < 10
        ? this.style.ok(`${_responseTime}ms`)
        : this.style.warn(`${_responseTime}ms`);
    lines.push(`Response Time: ${_responseStatus}`);

    // Commands
    if (_snapshot.isInterruptible) {
      lines.push(
        `Commands: ${this.style.controls('ESC=Stop | "待って"=Pause | "続けて"=Resume | "詳細"=Details')}`,
      );
    } else {
      lines.push(`Commands: ${this.style.muted("Analysis in progress...")}`);
    }
    _lines.push("");

    // === FOOTER ===
    lines.push(
      this.style.muted(
        `Updated: ${new Date().toLocaleTimeString()} | Next: ${_snapshot.nextAction}`,
      ),
    );

    return _lines;
  }

  /**
   * Clear display area
   */
  private clearDisplay(): void {
    // Move cursor to top and clear screen
    process.stdout.write("\u001b[H\u001b[2J");
  }

  /**
   * Setup keyboard input handling
   */
  private setupKeyboardHandling(): void {
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    process.stdin.resume();
    process.stdin.setEncoding("utf8");

    process.stdin.on("data", async (_key: string) => {
      await this.handleKeyInput(_key);
    });
  }

  /**
   * Handle keyboard input
   */
  private async handleKeyInput(key: string): Promise<void> {
    // ESC key (ASCII 27)
    if (key === "\u001b") {
      await this.handleEmergencyStop();
      return;
    }

    // Other key combinations
    switch (key) {
      case "\u0003": // Ctrl+C
        process.exit(0);
        break;
      case "q":
        await this.stopMonitoring();
        break;
      case "d":
        this.toggleDisplayMode();
        break;
      case "h":
        this.showHelp();
        break;
    }
  }

  /**
   * Handle emergency stop
   */
  private async handleEmergencyStop(): Promise<void> {
    const interruption = await this.createInterruption(
      "EMERGENCY_STOP",
      "ESC key pressed",
    );
    const _response = await this.processInterruption(interruption);

    this.emitStatusUpdate("INTERRUPTION", { interruption, _response });
  }

  /**
   * Process interruption
   */
  protected async processInterruption(
    interruption: InterruptionAction,
  ): Promise<InterruptionResponse> {
    // Show immediate acknowledgment
    console.log("\n" + this.style.err(">>> ANALYSIS INTERRUPTED <<<"));
    console.log(this.style.warn(`Reason: ${interruption.reason}`));
    console.log(this.style.controls("Stopping safely..."));

    return {
      acknowledged: true,
      timestamp: new Date(),
      action: interruption.type,
      resumeCapable: false,
    };
  }

  /**
   * Toggle display mode
   */
  private toggleDisplayMode(): void {
    const modes: Array<StatusDisplayConfig["mode"]> = [
      "MINIMAL",
      "COMPACT",
      "DETAILED",
    ];
    const _currentIndex = modes.indexOf(this.config.mode);
    const _nextIndex = (_currentIndex + 1) % modes.length;
    this.config.mode = modes[_nextIndex];

    this.render(); // Force re-render
  }

  /**
   * Show help overlay
   */
  private showHelp(): void {
    const _helpLines = [
      this.style.heading("KEYBOARD SHORTCUTS"),
      this.style.option("ESC       - Emergency stop analysis"),
      this.style.option("Ctrl+C    - Exit MARIA"),
      this.style.option("d         - Toggle display mode"),
      this.style.option("q         - Quit monitoring"),
      this.style.option("h         - Show this help"),
      "",
      this.style.controls("Press any key to continue..."),
    ];

    this.clearDisplay();
    console.log(_helpLines.join("\n"));
  }

  /**
   * Emit status update event
   */
  private emitStatusUpdate(_type: StatusUpdateType, data: unknown): void {
    this.emitter.emit("statusUpdate", { _type, timestamp: new Date(), data });
  }

  /**
   * Subscribe to status updates
   */
  onStatusUpdate(_callback: (update: unknown) => void): void {
    this.emitter.on("statusUpdate", _callback);
  }

  /**
   * Get current configuration
   */
  getConfig(): StatusDisplayConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<StatusDisplayConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  // 抽象メソッドの実装
  async executeImmediateStop(): Promise<any> {
    await this.stopMonitoring();
    return {
      success: true,
      action: "IMMEDIATE",
      message: "Monitor stopped immediately",
      canResume: false,
      rollbackAvailable: false,
    };
  }

  async executeSafePause(): Promise<any> {
    this.isDisplayActive = false;
    return {
      success: true,
      action: "SAFE_PAUSE",
      message: "Monitor paused safely",
      canResume: true,
      rollbackAvailable: false,
    };
  }

  async executeRollback(): Promise<any> {
    this.clearDisplay();
    return {
      success: true,
      action: "ROLLBACK",
      message: "Monitor reset",
      canResume: true,
      rollbackAvailable: true,
    };
  }

  getProcessState(): unknown {
    return {
      id: this.currentSnapshot?.sessionId || "unknown",
      name: "TerminalStatusMonitor",
      status: this.isDisplayActive ? "running" : "stopped",
      startTime: Date.now(),
      progress: this.currentSnapshot?.progress || 0,
      canResume: true,
      hasPartialResults:
        (this.currentSnapshot?.partialResults?.length || 0) > 0,
      backupAvailable: true,
    };
  }
}
