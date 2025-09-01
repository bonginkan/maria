/**
 * Active Reporting Engine - Core of the ホウレンソウ (Hokoku-Soudan-Renraku) System
 * Implements real-time status reporting, consultation, and communication
 */

import { EventEmitter } from "node:events";
import chalk from "chalk";

// Types
export interface StatusReport {
  id: string;
  timestamp: number;
  _operation: string;
  status: "started" | "in_progress" | "completed" | "failed" | "cancelled";
  progress?: number;
  details?: any;
  duration?: number;
  metadata?: Record<string, any>;
}

export interface ConsultationRequest {
  id: string;
  type: "decision" | "confirmation" | "recommendation";
  message: string;
  options?: string[];
  context?: any;
  priority: "low" | "medium" | "high" | "critical";
  _timeout?: number;
}

export interface CommunicationMessage {
  id: string;
  type: "info" | "warning" | "error" | "success" | "notification";
  message: string;
  source?: string;
  target?: string | string[];
  priority: "low" | "medium" | "high";
  persistent?: boolean;
}

export interface OperationMetrics {
  totalOperations: number;
  successRate: number;
  averageDuration: number;
  activeOperations: number;
  failureReasons: Record<string, number>;
  performanceTrend: "improving" | "stable" | "degrading";
}

/**
 * Main Reporting Engine implementing ホウレンソウ principles
 */
export class ReportingEngine extends EventEmitter {
  private static instance: ReportingEngine;
  private operations: Map<string, StatusReport> = new Map();
  private consultations: Map<string, ConsultationRequest> = new Map();
  private metrics: OperationMetrics;
  private startTime: number;
  private isActive: boolean = true;

  private constructor() {
    super();
    this.startTime = Date.now();
    this.metrics = {
      totalOperations: 0,
      successRate: 100,
      averageDuration: 0,
      activeOperations: 0,
      failureReasons: Record<string, any>,
      performanceTrend: "stable",
    };
  }

  public static getInstance(): ReportingEngine {
    if (!ReportingEngine.instance) {
      ReportingEngine.instance = new ReportingEngine();
    }
    return ReportingEngine.instance;
  }

  /**
   * 報告 (Hokoku) - Report status of operations
   */
  public reportStatus(
    _report: Omit<StatusReport, "id" | "timestamp">,
  ): StatusReport {
    const fullReport: StatusReport = {
      ..._report,
      id: this.generateId(),
      timestamp: Date.now(),
    };

    // Track _operation
    if (_report.status === "started") {
      this.operations.set(fullReport.id, fullReport);
      this.metrics.activeOperations++;
      this.metrics.totalOperations++;
    } else if (_report.status === "completed" || _report.status === "failed") {
      const _startReport = this.operations.get(fullReport.id);
      if (_startReport) {
        fullReport.duration = Date.now() - _startReport.timestamp;
        this.updateMetrics(fullReport);
      }
      this.metrics.activeOperations--;
    }

    // Emit event
    this.emit("report", fullReport);

    // Display in terminal if active
    if (this.isActive) {
      this.displayReport(fullReport);
    }

    return fullReport;
  }

  /**
   * 相談 (Soudan) - Consult for decisions
   */
  public async consult(
    _request: Omit<ConsultationRequest, "id">,
  ): Promise<string | null> {
    const fullRequest: ConsultationRequest = {
      ..._request,
      id: this.generateId(),
    };

    this.consultations.set(fullRequest.id, fullRequest);
    this.emit("consultation", fullRequest);

    if (this.isActive) {
      this.displayConsultation(fullRequest);
    }

    // Wait for response with _timeout
    return new Promise((resolve) => {
      const _timeout = setTimeout(() => {
        this.consultations.delete(fullRequest.id);
        resolve(null);
      }, fullRequest._timeout || 30000);

      this.once(`consultation:${fullRequest.id}`, (_response: string) => {
        clearTimeout(_timeout);
        this.consultations.delete(fullRequest.id);
        resolve(_response);
      });
    });
  }

  /**
   * 連絡 (Renraku) - Communicate information
   */
  public communicate(_message: Omit<CommunicationMessage, "id">): void {
    const fullMessage: CommunicationMessage = {
      ..._message,
      id: this.generateId(),
    };

    this.emit("communication", fullMessage);

    if (this.isActive) {
      this.displayCommunication(fullMessage);
    }
  }

  /**
   * Track progress of ongoing operations
   */
  public trackProgress(_operationId: string, progress: number): void {
    const _operation = this.operations.get(_operationId);
    if (_operation) {
      _operation.progress = Math.min(100, Math.max(0, progress));
      operation.status = "in_progress";

      this.emit("progress", { _operationId, progress: _operation.progress });

      if (this.isActive) {
        this.displayProgress(_operationId, _operation.progress);
      }
    }
  }

  /**
   * Get current metrics
   */
  public getMetrics(): OperationMetrics {
    return { ...this.metrics };
  }

  /**
   * Get active operations
   */
  public getActiveOperations(): StatusReport[] {
    return Array.from(this.operations.values()).filter(
      (op) => op.status === "started" || op.status === "in_progress",
    );
  }

  /**
   * Clear completed operations
   */
  public clearCompleted(): void {
    for (const [id, _operation] of this.operations) {
      if (operation.status === "completed" || operation.status === "failed") {
        this.operations.delete(id);
      }
    }
  }

  /**
   * Enable/disable terminal display
   */
  public setActive(active: boolean): void {
    this.isActive = active;
  }

  /**
   * Private helper methods
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private updateMetrics(report: StatusReport): void {
    if (report.status === "completed") {
      // Update success rate
      const _successCount =
        this.metrics.totalOperations * (this.metrics.successRate / 100);
      this.metrics.successRate =
        ((_successCount + 1) / this.metrics.totalOperations) * 100;
    } else if (report.status === "failed") {
      // Update failure reasons
      const _reason = report.details?.error || "unknown";
      this.metrics.failureReasons[_reason] =
        (this.metrics.failureReasons[_reason] || 0) + 1;

      // Update success rate
      const _successCount =
        this.metrics.totalOperations * (this.metrics.successRate / 100);
      this.metrics.successRate =
        (_successCount / this.metrics.totalOperations) * 100;
    }

    // Update average duration
    if (report.duration) {
      const _totalDuration =
        this.metrics.averageDuration * (this.metrics.totalOperations - 1);
      this.metrics.averageDuration =
        (_totalDuration + report.duration) / this.metrics.totalOperations;
    }

    // Determine performance trend
    this.updatePerformanceTrend();
  }

  private updatePerformanceTrend(): void {
    // Simple trend analysis based on recent operations
    const _recentOps = Array.from(this.operations.values()).slice(-10);
    if (_recentOps.length < 5) {
      this.metrics.performanceTrend = "stable";
      return;
    }

    const _recentAvg =
      _recentOps
        .filter((op) => op.duration)
        .reduce((sum, op) => sum + (op.duration || 0), 0) / _recentOps.length;

    if (_recentAvg < this.metrics.averageDuration * 0.9) {
      this.metrics.performanceTrend = "improving";
    } else if (_recentAvg > this.metrics.averageDuration * 1.1) {
      this.metrics.performanceTrend = "degrading";
    } else {
      this.metrics.performanceTrend = "stable";
    }
  }

  /**
   * Display methods for terminal output
   */
  private displayReport(report: StatusReport): void {
    const _icons = {
      started: "🚀",
      inprogress: "🔄",
      completed: "✅",
      failed: "❌",
      cancelled: "⚠️",
    };

    const _colors = {
      started: chalk.cyan,
      inprogress: chalk.yellow,
      completed: chalk.green,
      failed: chalk.red,
      cancelled: chalk.gray,
    };

    const _icon = _icons[report.status];
    const _color = _colors[report.status];

    console.log(
      _color(
        `${_icon} [報告] ${report.operation}: ${report.status}${
          report.progress ? ` (${report.progress}%)` : ""
        }${report.duration ? ` - ${report.duration}ms` : ""}`,
      ),
    );

    if (report.details && process.env.DEBUG) {
      console.log(chalk.gray(`  └─ ${JSON.stringify(report.details)}`));
    }
  }

  private displayConsultation(request: ConsultationRequest): void {
    const _priorityColors = {
      low: chalk.gray,
      medium: chalk.yellow,
      high: chalk.magenta,
      critical: chalk.red,
    };

    const _color = _priorityColors[request.priority];

    console.log(_color(`🤔 [相談] ${request.message}`));

    if (request.options) {
      request.options.forEach((option, index) => {
        console.log(chalk.cyan(`  ${index + 1}. ${option}`));
      });
    }
  }

  private displayCommunication(message: CommunicationMessage): void {
    const _icons = {
      info: "ℹ️",
      warning: "⚠️",
      error: "❌",
      success: "✅",
      notification: "📢",
    };

    const _colors = {
      info: chalk.blue,
      warning: chalk.yellow,
      error: chalk.red,
      success: chalk.green,
      notification: chalk.cyan,
    };

    const _icon = _icons[message.type];
    const _color = _colors[message.type];

    console.log(_color(`${_icon} [連絡] ${message.message}`));

    if (message.source) {
      console.log(chalk.gray(`  └─ From: ${message.source}`));
    }
  }

  private displayProgress(_operationId: string, progress: number): void {
    const _width = 30;
    const _filled = Math.floor((progress / 100) * _width);
    const _empty = _width - _filled;

    const _progressBar = "█".repeat(_filled) + "░".repeat(_empty);
    const _percentage = `${progress.toFixed(0)}%`.padStart(4);

    process.stdout.write(
      `\r🔄 [進捗] ${_progressBar} ${_percentage} (${_operationId.slice(0, 8)})`,
    );

    if (progress >= 100) {
      process.stdout.write("\n");
    }
  }
}

// Export singleton instance
export const _reportingEngine = ReportingEngine.getInstance();
