// src/services/hsr-system/display/real-time-status-display.ts
/**
 * Real-time Analysis Status Display System
 * リアルタイム分析ステータス表示システム
 */

import { EventEmitter } from "node:events";
import { BaseInterruptionHandler } from "../interruption/base-interruption-handler";
import { HSRBrandedStyle } from "../themes/branded-style";
import {
  InterruptionAction,
  InterruptionResponse,
  InterruptionType,
  _InterruptionPriority,
} from "../types/interruption-types";

export interface AnalysisStatus {
  sessionId: string;
  mode: "ULTRATHINK" | "Grit" | "IntentSocratic" | "DeepDive";
  phase: string;
  progress: number; // 0-100
  currentBranch?: string;
  partialResults: Array<{
    timestamp: Date;
    content: string;
    _confidence: number;
    isViable: boolean;
  }>;
  humanControlActive: boolean;
  lastInterruption?: Date;
  estimatedCompletion?: Date;
}

export interface StatusDisplayOptions {
  refreshRate: number; // ms
  showPartialResults: boolean;
  showConfidenceScores: boolean;
  enableProgressAnimation: boolean;
  maxHistoryEntries: number;
}

export class RealTimeStatusDisplay extends BaseInterruptionHandler {
  private readonly style = new HSRBrandedStyle();
  private readonly emitter = new EventEmitter();
  private currentStatus: AnalysisStatus | null = null;
  private displayInterval: NodeJS.Timeout | null = null;
  private readonly options: StatusDisplayOptions;
  private statusHistory: Array<{ timestamp: Date; _status: AnalysisStatus }> =
    [];

  constructor(_options: Partial<StatusDisplayOptions> = {}) {
    super();
    this._options = {
      refreshRate: 250, // 250ms更新
      showPartialResults: true,
      showConfidenceScores: true,
      enableProgressAnimation: true,
      maxHistoryEntries: 50,
      ..._options,
    };
  }

  /**
   * Start real-time _status display
   */
  async startDisplay(_status: AnalysisStatus): Promise<void> {
    this.currentStatus = _status;
    this.addToHistory(_status);

    // Clear any existing display
    if (this.displayInterval) {
      clearInterval(this.displayInterval);
    }

    // Start real-time updates
    this.displayInterval = setInterval(() => {
      this.renderStatus();
    }, this.options.refreshRate);

    // Initial render
    this.renderStatus();

    // Setup interruption handling
    this.setupInterruptionListeners();
  }

  /**
   * Update current analysis _status
   */
  updateStatus(updates: Partial<AnalysisStatus>): void {
    if (!this.currentStatus) return;

    this.currentStatus = { ...this.currentStatus, ...updates };
    this.addToHistory(this.currentStatus);
    this.emitter.emit("statusUpdated", this.currentStatus);
  }

  /**
   * Stop display and cleanup
   */
  async stopDisplay(): Promise<void> {
    if (this.displayInterval) {
      clearInterval(this.displayInterval);
      this.displayInterval = null;
    }
    this.currentStatus = null;
    console.clear();
  }

  /**
   * Render current _status to console
   */
  private renderStatus(): void {
    if (!this.currentStatus) return;

    // Clear and position cursor
    process.stdout.write("\u001b[2J\u001b[H");

    const _lines = this.buildStatusLines();
    console.log(_lines.join("\n"));
  }

  /**
   * Build _status display _lines
   */
  private buildStatusLines(): string[] {
    if (!this.currentStatus) return [];

    const _status = this.currentStatus;
    const _lines: string[] = [];

    // Header
    _lines.push(this.style.heading(`MARIA HSR - ${_status.mode} ANALYSIS`));
    _lines.push(this.style.separator());

    // Session info
    _lines.push(
      `Session: ${this.style.brand(_status.sessionId.substring(0, 8))}`,
    );
    lines.push(`Phase: ${this.style.accent(_status.phase)}`);

    // Progress display
    const _progressBar = this.style.progress(_status.progress);
    const _progressText = `${_status.progress.toFixed(1)}%`;
    lines.push(`Progress: ${_progressBar} ${_progressText}`);

    // Current branch (if applicable)
    if (_status.currentBranch) {
      lines.push(`Branch: ${this.style.selected(_status.currentBranch)}`);
    }

    // Completion estimate
    if (_status.estimatedCompletion) {
      const _timeLeft = this.formatTimeRemaining(_status.estimatedCompletion);
      lines.push(`Estimated: ${this.style.hint(_timeLeft)}`);
    }

    _lines.push(""); // separator

    // Human control _status
    lines.push(this.style.heading("HUMAN CONTROL"));
    const _controlStatus = _status.humanControlActive
      ? this.style.ok("ACTIVE")
      : this.style.muted("STANDBY");
    lines.push(`Status: ${_controlStatus}`);

    if (_status.lastInterruption) {
      const _timeSince = Date.now() - _status.lastInterruption.getTime();
      lines.push(
        `Last Interrupt: ${this.style.muted(`${Math.round(_timeSince / 1000)}s ago`)}`,
      );
    }

    _lines.push(
      `Controls: ${this.style.controls('ESC = Stop | "待って" = Pause | "続けて" = Resume')}`,
    );
    lines.push(""); // separator

    // Partial results
    if (this.options.showPartialResults && _status.partialResults.length > 0) {
      lines.push(this.style.heading("PARTIAL RESULTS"));

      const _recentResults = _status.partialResults.slice(-3); // Show last 3
      recentResults.forEach((result, _index) => {
        const _viabilityIcon = result.isViable
          ? this.style.ok("[VIABLE]")
          : this.style.warn("[NEEDS-REVIEW]");

        lines.push(`${this.style.bullet()}${_viabilityIcon} ${result.content}`);

        if (this.options.showConfidenceScores) {
          const _confidence = `${(result._confidence * 100).toFixed(1)}%`;
          lines.push(`  ${this.style.muted(`Confidence: ${_confidence}`)}`);
        }

        if (_index < _recentResults.length - 1) {
          lines.push("");
        }
      });

      if (_status.partialResults.length > 3) {
        const _moreCount = _status.partialResults.length - 3;
        lines.push(this.style.muted(`... and ${_moreCount} more results`));
      }
    }

    // Footer with timestamp
    _lines.push("");
    lines.push(this.style.muted(`Updated: ${new Date().toLocaleTimeString()}`));

    return _lines;
  }

  /**
   * Format time _remaining
   */
  private formatTimeRemaining(estimatedCompletion: Date): string {
    const _now = new Date();
    const _remaining = estimatedCompletion.getTime() - _now.getTime();

    if (_remaining <= 0) return "Completing...";

    const _minutes = Math.floor(_remaining / 60000);
    const _seconds = Math.floor((_remaining % 60000) / 1000);

    if (_minutes > 0) {
      return `${_minutes}m ${_seconds}s`;
    }
    return `${_seconds}s`;
  }

  /**
   * Add _status to history
   */
  private addToHistory(_status: AnalysisStatus): void {
    this.statusHistory.push({
      timestamp: new Date(),
      _status: { ...status },
    });

    // Maintain history size limit
    if (this.statusHistory.length > this.options.maxHistoryEntries) {
      this.statusHistory = this.statusHistory.slice(
        -this.options.maxHistoryEntries,
      );
    }
  }

  /**
   * Setup interruption listeners
   */
  private setupInterruptionListeners(): void {
    process.stdin.on("keypress", (_str, key) => {
      if (key && key.name === "escape") {
        this.handleEscapeKey();
      }
    });
  }

  /**
   * Handle ESC key interruption
   */
  private async handleEscapeKey(): Promise<void> {
    if (!this.currentStatus) return;

    const interruption = await this.createInterruption(
      InterruptionType.EMERGENCY_STOP,
      "ESC key pressed",
    );
    await this.processInterruption(interruption);
  }

  /**
   * Process interruption and update display
   */
  protected async processInterruption(
    interruption: InterruptionAction,
  ): Promise<InterruptionResponse> {
    if (this.currentStatus) {
      this.currentStatus.lastInterruption = new Date();
      this.currentStatus.humanControlActive = true;
    }

    // Show interruption acknowledgment
    this.showInterruptionAck(interruption);

    return {
      acknowledged: true,
      timestamp: new Date(),
      action: interruption.type,
      resumeCapable: interruption.type !== "EMERGENCY_STOP",
    };
  }

  /**
   * Show interruption acknowledgment
   */
  private showInterruptionAck(interruption: InterruptionAction): void {
    const _ackMessage =
      interruption.type === "EMERGENCY_STOP"
        ? this.style.err("ANALYSIS STOPPED")
        : this.style.warn(`ANALYSIS PAUSED - ${interruption.reason}`);

    console.log("\n" + _ackMessage);
    console.log(this.style.controls("Press any key to continue..."));
  }

  /**
   * Get current progress percentage
   */
  getCurrentProgress(): number {
    return this.currentStatus?.progress ?? 0;
  }

  /**
   * Get _status history for analysis
   */
  getStatusHistory(): Array<{ timestamp: Date; _status: AnalysisStatus }> {
    return [...this.statusHistory];
  }

  /**
   * Subscribe to _status updates
   */
  onStatusUpdate(_callback: (_status: AnalysisStatus) => void): void {
    this.emitter.on("statusUpdated", _callback);
  }

  /**
   * Unsubscribe from _status updates
   */
  removeStatusListener(_callback: (_status: AnalysisStatus) => void): void {
    this.emitter.removeListener("statusUpdated", _callback);
  }

  // 抽象メソッドの実装
  async executeImmediateStop(): Promise<any> {
    await this.stopDisplay();
    return {
      success: true,
      action: "IMMEDIATE",
      message: "Display stopped immediately",
      canResume: false,
      rollbackAvailable: false,
    };
  }

  async executeSafePause(): Promise<any> {
    // 安全一時停止実装
    return {
      success: true,
      action: "SAFE_PAUSE",
      message: "Display paused safely",
      canResume: true,
      rollbackAvailable: false,
    };
  }

  async executeRollback(): Promise<any> {
    // ロールバック実装
    return {
      success: true,
      action: "ROLLBACK",
      message: "Display reset",
      canResume: true,
      rollbackAvailable: true,
    };
  }

  getProcessState(): unknown {
    return {
      id: this.currentStatus?.sessionId || "unknown",
      name: "RealTimeStatusDisplay",
      _status: this.currentStatus ? "running" : "stopped",
      startTime: Date.now(),
      progress: this.getCurrentProgress(),
      canResume: true,
      hasPartialResults: (this.currentStatus?.partialResults?.length || 0) > 0,
      backupAvailable: true,
    };
  }
}
