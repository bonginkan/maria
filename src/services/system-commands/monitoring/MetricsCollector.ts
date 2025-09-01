/**
 * SystemCommand Metrics Collector with Consistent Naming
 *
 * SOW Phase 3.3 v2.1 Week 4 Implementation:
 * - Consistent metric naming (txKBps/rxKBps/monotonicMs)
 * - Real-time collection with performance.now() timing
 * - Prometheus-compatible format
 * - Thread-safe atomic operations
 * - Interactive Session integration metrics
 */

import { logger } from "../../../utils/logger";

export interface SystemCommandMetrics {
  // Execution metrics
  execution: {
    totalCommands: number;
    successCommands: number;
    errorCommands: number;
    timeoutCommands: number;
    cancelledCommands: number;
    avgExecutionMs: number;
    p50ExecutionMs: number;
    p95ExecutionMs: number;
    p99ExecutionMs: number;
  };

  // Performance metrics with consistent naming
  performance: {
    monotonicUptimeMs: number; // performance.now() based uptime
    commandsPerSec: number; // Current throughput
    peakCommandsPerSec: number; // Peak throughput observed
    avgLatencyMs: number; // Average command latency
    errorRate: number; // 0-1 error ratio
    concurrentCommands: number; // Currently executing
    maxConcurrentCommands: number; // Peak concurrency
  };

  // Network-style metrics for command I/O
  io: {
    commandsTxPerSec: number; // Commands sent per second
    commandsRxPerSec: number; // Commands completed per second
    bytesTxKBps: number; // Data transmitted KB/s
    bytesRxKBps: number; // Data received KB/s
    totalCommandsTx: number; // Total commands sent
    totalCommandsRx: number; // Total commands received
    droppedCommands: number; // Commands dropped due to limits
  };

  // Resource utilization
  resources: {
    memoryUsageBytes: number;
    cpuUtilization: number; // 0-1
    threadCount: number;
    openFileDescriptors: number;
    queueDepth: number;
    cacheHitRate: number; // 0-1
  };

  // Session integration metrics
  session: {
    activeSessions: number;
    totalSessions: number;
    avgSessionDurationMs: number;
    sessionsWithTimeouts: number;
    sessionStateTransitions: number;
    deadlineViolations: number;
  };

  // Command type breakdown
  byCommand: Record<
    string,
    {
      executions: number;
      avgDurationMs: number;
      errorRate: number;
      lastExecutionMs: number; // performance.now() when last executed
    }
  >;

  // Time series metadata
  metadata: {
    startTimeMs: number; // Date.now() when metrics started
    startMonotonicMs: number; // performance.now() baseline
    lastUpdateMs: number; // Date.now() of last update
    lastUpdateMonotonicMs: number; // performance.now() of last update
    collectionIntervalMs: number;
    version: string;
  };
}

export interface MetricSnapshot {
  timestamp: number;
  monotonicMs: number;
  metrics: SystemCommandMetrics;
  windowMs: number;
}

export interface CommandExecutionEvent {
  commandName: string;
  sessionId?: string;
  startMonotonicMs: number;
  endMonotonicMs: number;
  endReason: "success" | "error" | "timeout" | "cancel";
  inputBytes?: number;
  outputBytes?: number;
  error?: string;
}

export class SystemCommandMetricsCollector {
  private readonly metrics: SystemCommandMetrics;
  private readonly executionHistory: number[] = []; // Recent execution times
  private readonly HISTORY_WINDOW = 1000; // Keep last 1000 executions
  private readonly UPDATE_INTERVAL_MS = 1000; // 1 second updates

  private updateInterval?: NodeJS.Timeout;
  private readonly sessionTracker = new Map<
    string,
    { startMs: number; commandCount: number }
  >();
  private readonly commandExecutions = new Map<string, number[]>(); // Command -> recent durations

  constructor() {
    this.metrics = this.initializeMetrics();
    this.startPeriodicUpdates();
  }

  /**
   * Record a command execution event
   */
  recordExecution(event: CommandExecutionEvent): void {
    const duration = event.endMonotonicMs - event.startMonotonicMs;

    // Update execution metrics atomically
    this.updateExecutionMetrics(event, duration);

    // Update performance metrics
    this.updatePerformanceMetrics(duration);

    // Update I/O metrics
    this.updateIOMetrics(event);

    // Update per-command metrics
    this.updateCommandMetrics(event.commandName, duration, event.endReason);

    // Update session metrics if applicable
    if (event.sessionId) {
      this.updateSessionMetrics(event.sessionId, event.endReason);
    }

    // Update metadata
    this.metrics.metadata.lastUpdateMs = Date.now();
    this.metrics.metadata.lastUpdateMonotonicMs = performance.now();
  }

  /**
   * Record session lifecycle event
   */
  recordSessionEvent(
    sessionId: string,
    event: "start" | "end" | "timeout",
  ): void {
    const now = performance.now();

    switch (event) {
      case "start":
        this.sessionTracker.set(sessionId, { startMs: now, commandCount: 0 });
        this.metrics.session.activeSessions++;
        this.metrics.session.totalSessions++;
        break;

      case "end":
      case "timeout":
        const session = this.sessionTracker.get(sessionId);
        if (session) {
          const durationMs = now - session.startMs;

          // Update average session duration
          const totalSessions = this.metrics.session.totalSessions;
          this.metrics.session.avgSessionDurationMs =
            (this.metrics.session.avgSessionDurationMs * (totalSessions - 1) +
              durationMs) /
            totalSessions;

          if (event === "timeout") {
            this.metrics.session.sessionsWithTimeouts++;
          }

          this.metrics.session.activeSessions--;
          this.sessionTracker.delete(sessionId);
        }
        break;
    }
  }

  /**
   * Record resource utilization snapshot
   */
  recordResourceUtilization(
    resources: Partial<SystemCommandMetrics["resources"]>,
  ): void {
    Object.assign(this.metrics.resources, resources);
  }

  /**
   * Get current metrics snapshot
   */
  getSnapshot(): MetricSnapshot {
    return {
      timestamp: Date.now(),
      monotonicMs: performance.now(),
      metrics: this.deepClone(this.metrics),
      windowMs: this.UPDATE_INTERVAL_MS,
    };
  }

  /**
   * Get metrics in Prometheus format
   */
  getPrometheusMetrics(): string {
    const timestamp = Date.now();
    const lines: string[] = [];

    // Execution metrics
    lines.push(`# HELP maria_commands_total Total number of commands executed`);
    lines.push(`# TYPE maria_commands_total counter`);
    lines.push(
      `maria_commands_total ${this.metrics.execution.totalCommands} ${timestamp}`,
    );

    lines.push(
      `maria_commands_success_total ${this.metrics.execution.successCommands} ${timestamp}`,
    );
    lines.push(
      `maria_commands_error_total ${this.metrics.execution.errorCommands} ${timestamp}`,
    );
    lines.push(
      `maria_commands_timeout_total ${this.metrics.execution.timeoutCommands} ${timestamp}`,
    );

    // Performance metrics with consistent naming
    lines.push(
      `# HELP maria_uptime_monotonic_ms Monotonic uptime in milliseconds`,
    );
    lines.push(`# TYPE maria_uptime_monotonic_ms counter`);
    lines.push(
      `maria_uptime_monotonic_ms ${this.metrics.performance.monotonicUptimeMs} ${timestamp}`,
    );

    lines.push(
      `maria_commands_per_sec ${this.metrics.performance.commandsPerSec} ${timestamp}`,
    );
    lines.push(
      `maria_avg_latency_ms ${this.metrics.performance.avgLatencyMs} ${timestamp}`,
    );
    lines.push(
      `maria_error_rate ${this.metrics.performance.errorRate} ${timestamp}`,
    );

    // I/O metrics with consistent naming
    lines.push(
      `# HELP maria_io_commands_tx_per_sec Commands transmitted per second`,
    );
    lines.push(`# TYPE maria_io_commands_tx_per_sec gauge`);
    lines.push(
      `maria_io_commands_tx_per_sec ${this.metrics.io.commandsTxPerSec} ${timestamp}`,
    );

    lines.push(
      `maria_io_commands_rx_per_sec ${this.metrics.io.commandsRxPerSec} ${timestamp}`,
    );
    lines.push(
      `maria_io_bytes_tx_kbps ${this.metrics.io.bytesTxKBps} ${timestamp}`,
    );
    lines.push(
      `maria_io_bytes_rx_kbps ${this.metrics.io.bytesRxKBps} ${timestamp}`,
    );

    // Resource metrics
    lines.push(
      `maria_memory_usage_bytes ${this.metrics.resources.memoryUsageBytes} ${timestamp}`,
    );
    lines.push(
      `maria_cpu_utilization ${this.metrics.resources.cpuUtilization} ${timestamp}`,
    );
    lines.push(
      `maria_concurrent_commands ${this.metrics.performance.concurrentCommands} ${timestamp}`,
    );

    // Session metrics
    lines.push(
      `maria_active_sessions ${this.metrics.session.activeSessions} ${timestamp}`,
    );
    lines.push(
      `maria_session_timeouts_total ${this.metrics.session.sessionsWithTimeouts} ${timestamp}`,
    );
    lines.push(
      `maria_deadline_violations_total ${this.metrics.session.deadlineViolations} ${timestamp}`,
    );

    // Per-command metrics
    for (const [commandName, stats] of Object.entries(this.metrics.byCommand)) {
      const labelName = commandName.replace(/[^a-zA-Z0-9_]/g, "_");
      lines.push(
        `maria_command_executions_total{command="${labelName}"} ${stats.executions} ${timestamp}`,
      );
      lines.push(
        `maria_command_avg_duration_ms{command="${labelName}"} ${stats.avgDurationMs} ${timestamp}`,
      );
      lines.push(
        `maria_command_error_rate{command="${labelName}"} ${stats.errorRate} ${timestamp}`,
      );
    }

    return lines.join("\n");
  }

  /**
   * Reset all metrics (for testing)
   */
  reset(): void {
    Object.assign(this.metrics, this.initializeMetrics());
    this.executionHistory.length = 0;
    this.commandExecutions.clear();
    this.sessionTracker.clear();
  }

  /**
   * Start periodic metric updates
   */
  private startPeriodicUpdates(): void {
    this.updateInterval = setInterval(() => {
      this.updateDerivedMetrics();
      this.updateResourceMetrics();
    }, this.UPDATE_INTERVAL_MS);
  }

  /**
   * Stop periodic updates
   */
  stop(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = undefined;
    }
  }

  /**
   * Initialize metrics structure
   */
  private initializeMetrics(): SystemCommandMetrics {
    const now = performance.now();
    const timestamp = Date.now();

    return {
      execution: {
        totalCommands: 0,
        successCommands: 0,
        errorCommands: 0,
        timeoutCommands: 0,
        cancelledCommands: 0,
        avgExecutionMs: 0,
        p50ExecutionMs: 0,
        p95ExecutionMs: 0,
        p99ExecutionMs: 0,
      },
      performance: {
        monotonicUptimeMs: 0,
        commandsPerSec: 0,
        peakCommandsPerSec: 0,
        avgLatencyMs: 0,
        errorRate: 0,
        concurrentCommands: 0,
        maxConcurrentCommands: 0,
      },
      io: {
        commandsTxPerSec: 0,
        commandsRxPerSec: 0,
        bytesTxKBps: 0,
        bytesRxKBps: 0,
        totalCommandsTx: 0,
        totalCommandsRx: 0,
        droppedCommands: 0,
      },
      resources: {
        memoryUsageBytes: 0,
        cpuUtilization: 0,
        threadCount: 1,
        openFileDescriptors: 0,
        queueDepth: 0,
        cacheHitRate: 0,
      },
      session: {
        activeSessions: 0,
        totalSessions: 0,
        avgSessionDurationMs: 0,
        sessionsWithTimeouts: 0,
        sessionStateTransitions: 0,
        deadlineViolations: 0,
      },
      byCommand: {},
      metadata: {
        startTimeMs: timestamp,
        startMonotonicMs: now,
        lastUpdateMs: timestamp,
        lastUpdateMonotonicMs: now,
        collectionIntervalMs: this.UPDATE_INTERVAL_MS,
        version: "1.0.0",
      },
    };
  }

  /**
   * Update execution metrics from event
   */
  private updateExecutionMetrics(
    event: CommandExecutionEvent,
    duration: number,
  ): void {
    this.metrics.execution.totalCommands++;

    switch (event.endReason) {
      case "success":
        this.metrics.execution.successCommands++;
        break;
      case "error":
        this.metrics.execution.errorCommands++;
        break;
      case "timeout":
        this.metrics.execution.timeoutCommands++;
        break;
      case "cancel":
        this.metrics.execution.cancelledCommands++;
        break;
    }

    // Update execution time tracking
    this.executionHistory.push(duration);
    if (this.executionHistory.length > this.HISTORY_WINDOW) {
      this.executionHistory.shift();
    }

    // Update averages
    const total = this.metrics.execution.totalCommands;
    this.metrics.execution.avgExecutionMs =
      (this.metrics.execution.avgExecutionMs * (total - 1) + duration) / total;
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(duration: number): void {
    this.metrics.performance.monotonicUptimeMs =
      performance.now() - this.metrics.metadata.startMonotonicMs;

    this.metrics.performance.avgLatencyMs =
      this.metrics.execution.avgExecutionMs;

    const totalCommands = this.metrics.execution.totalCommands;
    const totalErrors =
      this.metrics.execution.errorCommands +
      this.metrics.execution.timeoutCommands;

    this.metrics.performance.errorRate =
      totalCommands > 0 ? totalErrors / totalCommands : 0;
  }

  /**
   * Update I/O metrics
   */
  private updateIOMetrics(event: CommandExecutionEvent): void {
    this.metrics.io.totalCommandsTx++;
    this.metrics.io.totalCommandsRx++;

    if (event.inputBytes) {
      this.metrics.io.bytesTxKBps += event.inputBytes / 1024;
    }

    if (event.outputBytes) {
      this.metrics.io.bytesRxKBps += event.outputBytes / 1024;
    }
  }

  /**
   * Update per-command metrics
   */
  private updateCommandMetrics(
    commandName: string,
    duration: number,
    endReason: string,
  ): void {
    if (!this.metrics.byCommand[commandName]) {
      this.metrics.byCommand[commandName] = {
        executions: 0,
        avgDurationMs: 0,
        errorRate: 0,
        lastExecutionMs: performance.now(),
      };
    }

    const cmdStats = this.metrics.byCommand[commandName];
    cmdStats.executions++;
    cmdStats.lastExecutionMs = performance.now();

    // Update average duration
    cmdStats.avgDurationMs =
      (cmdStats.avgDurationMs * (cmdStats.executions - 1) + duration) /
      cmdStats.executions;

    // Track command-specific execution times
    if (!this.commandExecutions.has(commandName)) {
      this.commandExecutions.set(commandName, []);
    }

    const executions = this.commandExecutions.get(commandName)!;
    executions.push(duration);
    if (executions.length > 100) {
      // Keep last 100 per command
      executions.shift();
    }

    // Update error rate
    if (endReason === "error") {
      const errorCount = executions.filter((d) => d < 0).length + 1; // Simplified error tracking
      cmdStats.errorRate = errorCount / cmdStats.executions;
    }
  }

  /**
   * Update session metrics
   */
  private updateSessionMetrics(sessionId: string, endReason: string): void {
    const session = this.sessionTracker.get(sessionId);
    if (session) {
      session.commandCount++;
    }

    this.metrics.session.sessionStateTransitions++;

    if (endReason === "timeout") {
      this.metrics.session.deadlineViolations++;
    }
  }

  /**
   * Update derived metrics periodically
   */
  private updateDerivedMetrics(): void {
    // Update percentiles from execution history
    if (this.executionHistory.length > 0) {
      const sorted = [...this.executionHistory].sort((a, b) => a - b);
      this.metrics.execution.p50ExecutionMs = this.getPercentile(sorted, 0.5);
      this.metrics.execution.p95ExecutionMs = this.getPercentile(sorted, 0.95);
      this.metrics.execution.p99ExecutionMs = this.getPercentile(sorted, 0.99);
    }

    // Calculate rates over time window
    const windowSec = this.UPDATE_INTERVAL_MS / 1000;
    const recentCommands = this.executionHistory.length; // Approximation

    this.metrics.performance.commandsPerSec = recentCommands / windowSec;
    this.metrics.performance.peakCommandsPerSec = Math.max(
      this.metrics.performance.peakCommandsPerSec,
      this.metrics.performance.commandsPerSec,
    );

    // Update I/O rates (convert to per-second)
    this.metrics.io.commandsTxPerSec = this.metrics.performance.commandsPerSec;
    this.metrics.io.commandsRxPerSec = this.metrics.performance.commandsPerSec;
    this.metrics.io.bytesTxKBps = this.metrics.io.bytesTxKBps / windowSec;
    this.metrics.io.bytesRxKBps = this.metrics.io.bytesRxKBps / windowSec;
  }

  /**
   * Update resource metrics
   */
  private updateResourceMetrics(): void {
    const memUsage = process.memoryUsage();
    this.metrics.resources.memoryUsageBytes = memUsage.heapUsed;

    // Approximate concurrent commands (would be more accurate with proper tracking)
    this.metrics.resources.queueDepth = this.sessionTracker.size;
  }

  /**
   * Calculate percentile from sorted array
   */
  private getPercentile(sorted: number[], percentile: number): number {
    const index = Math.ceil(sorted.length * percentile) - 1;
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
  }

  /**
   * Deep clone metrics for immutable snapshots
   */
  private deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }
}

// Export singleton instance for consistent usage across the system
export const systemCommandMetrics = new SystemCommandMetricsCollector();
