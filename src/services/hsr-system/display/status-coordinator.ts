// src/services/hsr-system/display/status-coordinator.ts
/**
 * Status Display Coordinator
 * ステータス表示コーディネーター - ULTRATHINK統合
 */

import { EventEmitter } from "node:events";
import {
  RealTimeStatusDisplay,
  AnalysisStatus,
} from "./real-time-status-display";
import { TerminalStatusMonitor } from "./terminal-status-monitor";
import {
  StatusSnapshot,
  AnalysisMetrics,
  HumanInteractionMetrics,
  AnalysisPhaseInfo,
} from "../types/status-types";
import { BaseInterruptionHandler } from "../interruption/base-interruption-handler";
import {
  InterruptionAction,
  InterruptionResponse,
} from "../types/interruption-types";

export interface StatusCoordinatorConfig {
  displayMode: "REAL_TIME" | "TERMINAL" | "BOTH";
  autoStart: boolean;
  enableKeyboardControls: boolean;
  updateFrequency: number;
  preserveHistory: boolean;
}

export interface ULTRATHINKAnalysisSession {
  sessionId: string;
  mode: "ULTRATHINK" | "Grit" | "IntentSocratic";
  totalBranches: number;
  completedBranches: number;
  currentBranch?: string;
  phases: AnalysisPhaseInfo[];
  currentPhaseIndex: number;
  startTime: Date;
  estimatedCompletion?: Date;
  partialResults: any[];
}

export class StatusCoordinator extends BaseInterruptionHandler {
  private readonly emitter = new EventEmitter();
  private readonly config: StatusCoordinatorConfig;

  private realTimeDisplay?: RealTimeStatusDisplay;
  private terminalMonitor?: TerminalStatusMonitor;
  private currentSession: ULTRATHINKAnalysisSession | null = null;
  private currentSnapshot: StatusSnapshot | null = null;

  private metrics: AnalysisMetrics;
  private humanMetrics: HumanInteractionMetrics;
  private isActive = false;
  private statusUpdateInterval: NodeJS.Timeout | null = null;

  constructor(_config: Partial<StatusCoordinatorConfig> = {}) {
    super();

    this._config = {
      displayMode: "BOTH",
      autoStart: true,
      enableKeyboardControls: true,
      updateFrequency: 250,
      preserveHistory: true,
      ..._config,
    };

    this.metrics = this.initializeMetrics();
    this.humanMetrics = this.initializeHumanMetrics();
  }

  /**
   * Start coordinated status display for ULTRATHINK _session
   */
  async startStatusDisplay(_session: ULTRATHINKAnalysisSession): Promise<void> {
    this.currentSession = _session;
    this.isActive = true;

    // Initialize display components based on mode
    await this.initializeDisplayComponents();

    // Create initial snapshot
    this.currentSnapshot = this.createStatusSnapshot();

    // Start displays
    if (
      this.realTimeDisplay &&
      ["REAL_TIME", "BOTH"].includes(this.config.displayMode)
    ) {
      const _analysisStatus = this.convertSnapshotToAnalysisStatus(
        this.currentSnapshot,
      );
      await this.realTimeDisplay.startDisplay(_analysisStatus);
    }

    if (
      this.terminalMonitor &&
      ["TERMINAL", "BOTH"].includes(this.config.displayMode)
    ) {
      await this.terminalMonitor.startMonitoring(this.currentSnapshot);
    }

    // Start update loop
    this.startUpdateLoop();

    // Setup interruption handling
    this.setupInterruptionHandling();
  }

  /**
   * Stop all status displays
   */
  async stopStatusDisplay(): Promise<void> {
    this.isActive = false;

    if (this.statusUpdateInterval) {
      clearInterval(this.statusUpdateInterval);
      this.statusUpdateInterval = null;
    }

    if (this.realTimeDisplay) {
      await this.realTimeDisplay.stopDisplay();
    }

    if (this.terminalMonitor) {
      await this.terminalMonitor.stopMonitoring();
    }

    this.currentSession = null;
    this.currentSnapshot = null;
  }

  /**
   * Update ULTRATHINK _session _progress
   */
  updateULTRATHINKProgress(updates: {
    completedBranches?: number;
    currentBranch?: string;
    currentPhaseIndex?: number;
    partialResults?: any[];
    estimatedCompletion?: Date;
  }): void {
    if (!this.currentSession) return;

    // Update _session
    Object.assign(this.currentSession, updates);

    // Update metrics
    this.updateAnalysisMetrics();

    // Create new snapshot
    this.currentSnapshot = this.createStatusSnapshot();

    // Update displays
    this.updateDisplays();

    // Emit update event
    this.emitStatusUpdate();
  }

  /**
   * Report human interaction
   */
  reportHumanInteraction(
    _type: "INTERRUPTION" | "COMMAND" | "DECISION",
    data: unknown,
  ): void {
    this.humanMetrics.lastInteractionTime = new Date();
    this.humanMetrics.interruptionCount++;

    if (_type === "COMMAND" && Array.isArray(data.commands)) {
      this.humanMetrics.naturalLanguageCommands.push(...data.commands);
    }

    // Update snapshot
    if (this.currentSnapshot) {
      this.currentSnapshot.humanMetrics = { ...this.humanMetrics };
      this.updateDisplays();
    }
  }

  /**
   * Initialize display components
   */
  private async initializeDisplayComponents(): Promise<void> {
    if (["REAL_TIME", "BOTH"].includes(this.config.displayMode)) {
      this.realTimeDisplay = new RealTimeStatusDisplay({
        refreshRate: this.config.updateFrequency,
        showPartialResults: true,
        showConfidenceScores: true,
        enableProgressAnimation: true,
        maxHistoryEntries: this.config.preserveHistory ? 100 : 10,
      });
    }

    if (["TERMINAL", "BOTH"].includes(this.config.displayMode)) {
      this.terminalMonitor = new TerminalStatusMonitor({
        mode: "DETAILED",
        colors: true,
        animations: true,
        updateFrequency: this.config.updateFrequency,
        showMetrics: true,
        showHistory: this.config.preserveHistory,
      });
    }
  }

  /**
   * Create status snapshot from current _session
   */
  private createStatusSnapshot(): StatusSnapshot {
    if (!this.currentSession) {
      throw new Error("No active _session");
    }

    const _session = this.currentSession;
    const _progress = this.calculateOverallProgress();
    const _currentPhase =
      _session.phases[_session.currentPhaseIndex] || _session.phases[0];

    return {
      timestamp: new Date(),
      sessionId: _session.sessionId,
      mode: _session.mode,
      phase: _currentPhase,
      _progress,
      metrics: { ...this.metrics },
      humanMetrics: { ...this.humanMetrics },
      partialResults: _session.partialResults.map((result) => ({
        branchId: result.branchId || "unknown",
        name: result.name || "Analysis Result",
        confidence: result.confidence || 0.5,
        viability: result.viability || 0.5,
        reasoning: result.reasoning || "No reasoning provided",
        partialResult: result,
        humanReviewRequired: result.humanReviewRequired || false,
        completionTime: result.timestamp || new Date(),
      })),
      isInterruptible: true,
      nextAction: this.determineNextAction(),
    };
  }

  /**
   * Convert snapshot to analysis status for RealTimeDisplay
   */
  private convertSnapshotToAnalysisStatus(
    snapshot: StatusSnapshot,
  ): AnalysisStatus {
    return {
      sessionId: snapshot.sessionId,
      mode: snapshot.mode as any,
      phase: snapshot.phase.name,
      _progress: snapshot.progress,
      currentBranch: this.currentSession?.currentBranch,
      partialResults: snapshot.partialResults.map((result) => ({
        timestamp: result.completionTime,
        content: result.name,
        confidence: result.confidence,
        isViable: result.viability > 0.6,
      })),
      humanControlActive: snapshot.humanMetrics.lastInteractionTime
        ? Date.now() - snapshot.humanMetrics.lastInteractionTime.getTime() <
          30000
        : false,
      lastInterruption: snapshot.humanMetrics.lastInteractionTime,
      estimatedCompletion: this.currentSession?.estimatedCompletion,
    };
  }

  /**
   * Calculate overall _progress percentage
   */
  private calculateOverallProgress(): number {
    if (!this.currentSession) return 0;

    const _session = this.currentSession;

    // Base _progress from completed branches
    const _branchProgress =
      _session.totalBranches > 0
        ? (_session.completedBranches / _session.totalBranches) * 80
        : 0;

    // Additional _progress from current phase
    const _phaseProgress =
      _session.phases.length > 0
        ? (_session.currentPhaseIndex / _session.phases.length) * 20
        : 0;

    return Math.min(100, _branchProgress + _phaseProgress);
  }

  /**
   * Update analysis metrics
   */
  private updateAnalysisMetrics(): void {
    if (!this.currentSession) return;

    const _session = this.currentSession;
    const _now = new Date();

    this.metrics.totalBranches = _session.totalBranches;
    this.metrics.completedBranches = _session.completedBranches;

    if (_session.completedBranches > 0) {
      const _elapsed = _now.getTime() - _session.startTime.getTime();
      this.metrics.averageBranchTime = _elapsed / _session.completedBranches;

      if (_session.totalBranches > _session.completedBranches) {
        const _remaining = _session.totalBranches - _session.completedBranches;
        this.metrics.estimatedTotal =
          _elapsed + _remaining * this.metrics.averageBranchTime;
      }
    }

    // Update confidence and viability
    if (_session.partialResults.length > 0) {
      const _results = _session.partialResults;
      this.metrics.confidence =
        _results.reduce((sum, r) => sum + (r.confidence || 0.5), 0) /
        _results.length;
      this.metrics.viabilityScore =
        _results.reduce((sum, r) => sum + (r.viability || 0.5), 0) /
        _results.length;
    }
  }

  /**
   * Determine next action based on current state
   */
  private determineNextAction(): string {
    if (!this.currentSession) return "Initialize _session";

    const _session = this.currentSession;

    if (_session.currentBranch) {
      return `Analyzing branch: ${_session.currentBranch}`;
    }

    if (_session.currentPhaseIndex < _session.phases.length) {
      const _currentPhase = _session.phases[_session.currentPhaseIndex];
      return `${_currentPhase.name}: ${_currentPhase.description}`;
    }

    return "Completing analysis";
  }

  /**
   * Update all active displays
   */
  private updateDisplays(): void {
    if (!this.currentSnapshot) return;

    if (this.realTimeDisplay) {
      const _analysisStatus = this.convertSnapshotToAnalysisStatus(
        this.currentSnapshot,
      );
      this.realTimeDisplay.updateStatus(_analysisStatus);
    }

    if (this.terminalMonitor) {
      this.terminalMonitor.updateSnapshot(this.currentSnapshot);
    }
  }

  /**
   * Start update loop
   */
  private startUpdateLoop(): void {
    this.statusUpdateInterval = setInterval(() => {
      if (this.isActive && this.currentSession) {
        this.updateAnalysisMetrics();
        this.currentSnapshot = this.createStatusSnapshot();
        this.updateDisplays();
      }
    }, this.config.updateFrequency);
  }

  /**
   * Setup interruption handling
   */
  private setupInterruptionHandling(): void {
    if (this.realTimeDisplay) {
      this.realTimeDisplay.onStatusUpdate((_status) => {
        this.emitStatusUpdate();
      });
    }

    if (this.terminalMonitor) {
      this.terminalMonitor.onStatusUpdate((update) => {
        this.handleDisplayInterruption(update);
      });
    }
  }

  /**
   * Handle interruption from display components
   */
  private async handleDisplayInterruption(update: unknown): Promise<void> {
    if (update.type === "INTERRUPTION") {
      this.reportHumanInteraction("INTERRUPTION", update.data);
      await this.processInterruption(update.data.interruption);
    }
  }

  /**
   * Process interruption
   */
  protected async processInterruption(
    interruption: InterruptionAction,
  ): Promise<InterruptionResponse> {
    // Update human metrics
    this.humanMetrics.controlResponseTime =
      Date.now() - (interruption.timestamp?.getTime() || Date.now());

    // Emit interruption event
    this.emitter.emit("interruption", interruption);

    return {
      acknowledged: true,
      timestamp: new Date(),
      action: interruption.type,
      resumeCapable: interruption.type !== "EMERGENCY_STOP",
    };
  }

  /**
   * Emit status update event
   */
  private emitStatusUpdate(): void {
    this.emitter.emit("statusUpdate", {
      snapshot: this.currentSnapshot,
      _session: this.currentSession,
      timestamp: new Date(),
    });
  }

  /**
   * Initialize metrics
   */
  private initializeMetrics(): AnalysisMetrics {
    return {
      startTime: new Date(),
      currentPhaseStart: new Date(),
      totalBranches: 0,
      completedBranches: 0,
      averageBranchTime: 0,
      estimatedTotal: 0,
      confidence: 0,
      viabilityScore: 0,
    };
  }

  /**
   * Initialize human metrics
   */
  private initializeHumanMetrics(): HumanInteractionMetrics {
    return {
      interruptionCount: 0,
      totalPauseTime: 0,
      lastInteractionTime: null,
      controlResponseTime: 5, // Default 5ms response
      naturalLanguageCommands: [],
    };
  }

  /**
   * Get current _session info
   */
  getCurrentSession(): ULTRATHINKAnalysisSession | null {
    return this.currentSession ? { ...this.currentSession } : null;
  }

  /**
   * Get current snapshot
   */
  getCurrentSnapshot(): StatusSnapshot | null {
    return this.currentSnapshot ? { ...this.currentSnapshot } : null;
  }

  /**
   * Subscribe to status updates
   */
  onStatusUpdate(_callback: (data: unknown) => void): void {
    this.emitter.on("statusUpdate", _callback);
  }

  /**
   * Subscribe to interruptions
   */
  onInterruption(_callback: (interruption: InterruptionAction) => void): void {
    this.emitter.on("interruption", _callback);
  }

  // 抽象メソッドの実装
  async executeImmediateStop(): Promise<any> {
    await this.stopStatusDisplay();
    return {
      success: true,
      action: "IMMEDIATE",
      message: "Status coordinator stopped immediately",
      canResume: false,
      rollbackAvailable: false,
    };
  }

  async executeSafePause(): Promise<any> {
    this.isActive = false;
    return {
      success: true,
      action: "SAFE_PAUSE",
      message: "Status coordinator paused safely",
      canResume: true,
      rollbackAvailable: false,
    };
  }

  async executeRollback(): Promise<any> {
    if (this.currentSession) {
      this.currentSession.completedBranches = 0;
      this.currentSession.currentPhaseIndex = 0;
      this.currentSession.partialResults = [];
    }
    return {
      success: true,
      action: "ROLLBACK",
      message: "Status coordinator reset",
      canResume: true,
      rollbackAvailable: true,
    };
  }

  getProcessState(): unknown {
    return {
      id: this.currentSession?.sessionId || "unknown",
      name: "StatusCoordinator",
      status: this.isActive ? "running" : "stopped",
      startTime: Date.now(),
      _progress: this.currentSnapshot?.progress || 0,
      canResume: true,
      hasPartialResults: (this.currentSession?.partialResults?.length || 0) > 0,
      backupAvailable: true,
    };
  }
}
