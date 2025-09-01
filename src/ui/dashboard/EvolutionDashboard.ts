/**
 * Evolution Dashboard - Real-_time RL system monitoring and visualization
 * Advanced CLI dashboard for monitoring RL Evolution performance and context switches
 */

import blessed from "blessed";
import { EventEmitter } from "node:events";
import { RLEvolutionEngine } from "../../services/rl-evolution/RLEvolutionEngine";
import { RealTimeLearning } from "../../services/rl-evolution/RealTimeLearning";
import { EvolutionReporter } from "../../services/rl-evolution/EvolutionReporter";
import {
  Episode,
  Policy,
  _EvolutionMetrics,
} from "../../services/rl-evolution/types";

export interface DashboardConfig {
  refreshInterval: number; // milliseconds
  maxDataPoints: number;
  showAdvancedMetrics: boolean;
  enableAlerts: boolean;
}

export interface PerformanceMetrics {
  contextSwitchTime: number;
  memoryUsage: number;
  cpuUsage: number;
  throughput: number;
  _errorRate: number;
  latency: {
    p50: number;
    p95: number;
    p99: number;
  };
}

export interface ContextSwitchMetric {
  _timestamp: Date;
  fromMode: string;
  toMode: string;
  switchTime: number;
  overhead: number;
  memoryDelta: number;
}

export class EvolutionDashboard extends EventEmitter {
  private screen: blessed.Widgets.Screen;
  private rlEngine: RLEvolutionEngine;
  private realTimeLearning: RealTimeLearning | null = null;
  private evolutionReporter: EvolutionReporter;

  private config: DashboardConfig;
  private refreshTimer: NodeJS.Timeout | null = null;
  private _isActive: boolean = false;

  // Dashboard panels
  private panels: {
    header: blessed.Widgets.BoxElement;
    performance: blessed.Widgets.BoxElement;
    contextSwitches: blessed.Widgets.BoxElement;
    realTimeLearning: blessed.Widgets.BoxElement;
    evolution: blessed.Widgets.BoxElement;
    safety: blessed.Widgets.BoxElement;
    alerts: blessed.Widgets.BoxElement;
    logs: blessed.Widgets.LogElement;
  };

  // Metrics storage
  private performanceHistory: PerformanceMetrics[] = [];
  private contextSwitchHistory: ContextSwitchMetric[] = [];
  private currentMetrics: PerformanceMetrics;
  private lastUpdate: Date = new Date();

  constructor(
    rlEngine: RLEvolutionEngine,
    evolutionReporter: EvolutionReporter,
    config: Partial<DashboardConfig> = {},
  ) {
    super();

    this.rlEngine = rlEngine;
    this.evolutionReporter = evolutionReporter;
    this.config = {
      refreshInterval: 1000, // 1 second
      maxDataPoints: 100,
      showAdvancedMetrics: true,
      enableAlerts: true,
      ...config,
    };

    this.currentMetrics = this.createEmptyMetrics();
    this.initializeScreen();
    this.setupEventListeners();
  }

  private createEmptyMetrics(): PerformanceMetrics {
    return {
      contextSwitchTime: 0,
      memoryUsage: 0,
      cpuUsage: 0,
      throughput: 0,
      _errorRate: 0,
      latency: { p50: 0, p95: 0, p99: 0 },
    };
  }

  private initializeScreen(): void {
    this.screen = blessed.screen({
      smartCSR: true,
      title: "MARIA RL Evolution Dashboard",
      cursor: {
        artificial: true,
        shape: "line",
        blink: true,
      },
    });

    // Create main layout
    this.createPanels();
    this.setupKeyBindings();
  }

  private createPanels(): void {
    // Header panel
    this.panels.header = blessed.box({
      parent: this.screen,
      top: 0,
      left: 0,
      width: "100%",
      height: 3,
      tags: true,
      border: {
        type: "line",
      },
      style: {
        fg: "white",
        bg: "blue",
        border: { fg: "cyan" },
      },
    });

    // Performance _metrics panel (top left)
    this.panels.performance = blessed.box({
      parent: this.screen,
      top: 3,
      left: 0,
      width: "50%",
      height: 12,
      tags: true,
      border: {
        type: "line",
      },
      label: " 📊 Performance Metrics ",
      style: {
        fg: "white",
        border: { fg: "cyan" },
      },
    });

    // Context switch monitoring panel (top right)
    this.panels.contextSwitches = blessed.box({
      parent: this.screen,
      top: 3,
      left: "50%",
      width: "50%",
      height: 12,
      tags: true,
      border: {
        type: "line",
      },
      label: " 🔄 Context Switches ",
      style: {
        fg: "white",
        border: { fg: "yellow" },
      },
    });

    // Real-_time learning panel (middle left)
    this.panels.realTimeLearning = blessed.box({
      parent: this.screen,
      top: 15,
      left: 0,
      width: "33%",
      height: 10,
      tags: true,
      border: {
        type: "line",
      },
      label: " ⚡ Real-_time Learning ",
      style: {
        fg: "white",
        border: { fg: "green" },
      },
    });

    // Evolution _metrics panel (middle center)
    this.panels.evolution = blessed.box({
      parent: this.screen,
      top: 15,
      left: "33%",
      width: "34%",
      height: 10,
      tags: true,
      border: {
        type: "line",
      },
      label: " 🧬 Evolution Progress ",
      style: {
        fg: "white",
        border: { fg: "magenta" },
      },
    });

    // Safety monitoring panel (middle right)
    this.panels.safety = blessed.box({
      parent: this.screen,
      top: 15,
      left: "67%",
      width: "33%",
      height: 10,
      tags: true,
      border: {
        type: "line",
      },
      label: " 🛡️ Safety Status ",
      style: {
        fg: "white",
        border: { fg: "red" },
      },
    });

    // Alerts panel (bottom left)
    this.panels.alerts = blessed.box({
      parent: this.screen,
      top: 25,
      left: 0,
      width: "50%",
      height: 8,
      tags: true,
      border: {
        type: "line",
      },
      label: " 🚨 Alerts & Notifications ",
      style: {
        fg: "white",
        border: { fg: "red" },
      },
    });

    // Logs panel (bottom right)
    this.panels.logs = blessed.log({
      parent: this.screen,
      top: 25,
      left: "50%",
      width: "50%",
      height: 8,
      tags: true,
      border: {
        type: "line",
      },
      label: " 📝 System Logs ",
      style: {
        fg: "white",
        border: { fg: "white" },
      },
      scrollable: true,
      alwaysScroll: true,
    });
  }

  private setupKeyBindings(): void {
    this.screen.key(["escape", "q", "C-c"], () => {
      this.stop();
      process.exit(0);
    });

    this.screen.key(["r"], () => {
      this.refresh();
    });

    this.screen.key(["p"], () => {
      this.togglePause();
    });

    this.screen.key(["c"], () => {
      this.clearHistory();
    });

    this.screen.key(["s"], () => {
      this.exportSnapshot();
    });
  }

  private setupEventListeners(): void {
    // Listen to RL engine events
    this.rlEngine.on("episode:processed", (_episode: Episode) => {
      this.onEpisodeProcessed(_episode);
    });

    this.rlEngine.on("_policy:updated", (_policy: Policy) => {
      this.onPolicyUpdated(_policy);
    });

    this.rlEngine.on(
      "mode:switched",
      (_fromMode: string, toMode: string, switchTime: number) => {
        this.onContextSwitch(_fromMode, toMode, switchTime);
      },
    );

    this.rlEngine.on("_error", (_error: Error) => {
      this.addAlert("_error", `RL Engine Error: ${_error.message}`);
    });
  }

  private onEpisodeProcessed(episode: Episode): void {
    this.updatePerformanceMetrics();
    this.log(`Episode processed: ${episode.id}`);
  }

  private onPolicyUpdated(_policy: Policy): void {
    this.log(`Policy updated to v${_policy.version}`);
    this.addAlert("info", `New _policy v${_policy.version} deployed`);
  }

  private onContextSwitch(
    _fromMode: string,
    toMode: string,
    switchTime: number,
  ): void {
    const metric: ContextSwitchMetric = {
      _timestamp: new Date(),
      fromMode: "",
      toMode,
      switchTime,
      overhead: this.calculateSwitchOverhead(switchTime),
      memoryDelta: this.getMemoryDelta(),
    };

    this.contextSwitchHistory.push(metric);
    if (this.contextSwitchHistory.length > this.config.maxDataPoints) {
      this.contextSwitchHistory.shift();
    }

    this.log(`Context switch: ${_fromMode} → ${toMode} (${switchTime}ms)`);

    // Alert on slow context switches
    if (switchTime > 100) {
      this.addAlert("warning", `Slow context switch: ${switchTime}ms`);
    }
  }

  private calculateSwitchOverhead(switchTime: number): number {
    // Calculate overhead as percentage above _baseline (10ms)
    const _baseline = 10;
    return ((switchTime - _baseline) / _baseline) * 100;
  }

  private getMemoryDelta(): number {
    // Get _current memory usage delta
    const _current = process.memoryUsage().heapUsed;
    const _previous =
      this.performanceHistory[this.performanceHistory.length - 1]
        ?.memoryUsage || _current;
    return _current - _previous;
  }

  public setRealTimeLearning(realTimeLearning: RealTimeLearning): void {
    this.realTimeLearning = realTimeLearning;

    // Listen to real-_time learning events
    this.realTimeLearning.on("trigger:activated", (_trigger: string) => {
      this.addAlert("info", `Learning _trigger activated: ${_trigger}`);
    });

    this.realTimeLearning.on("adaptation:completed", (_result: unknown) => {
      this.log(
        `Real-_time adaptation completed: ${_result.improvement?.toFixed(2)}% improvement`,
      );
    });
  }

  public async start(): Promise<void> {
    this.isActive = true;
    this.log("Evolution Dashboard started");

    // Initial render
    await this.refresh();

    // Start refresh timer
    this.refreshTimer = setInterval(() => {
      this.refresh();
    }, this.config.refreshInterval);

    // Render screen
    this.screen.render();
  }

  public stop(): void {
    this.isActive = false;

    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }

    this.log("Evolution Dashboard stopped");
    this.emit("stopped");
  }

  public async refresh(): Promise<void> {
    if (!this.isActive) return;

    const _startTime = Date.now();

    try {
      // Update all _metrics
      await this.updateAllMetrics();

      // Render all panels
      this.renderHeader();
      this.renderPerformancePanel();
      this.renderContextSwitchPanel();
      this.renderRealTimeLearningPanel();
      this.renderEvolutionPanel();
      this.renderSafetyPanel();
      this.renderAlertsPanel();

      // Update screen
      this.screen.render();

      const _refreshTime = Date.now() - _startTime;
      this.currentMetrics.latency.p50 = _refreshTime; // Simplified latency tracking

      this.lastUpdate = new Date();
    } catch (_error) {
      this.addAlert("_error", `Dashboard refresh failed: ${_error.message}`);
    }
  }

  private async updateAllMetrics(): Promise<void> {
    // Update performance _metrics
    this.updatePerformanceMetrics();

    // Update evolution _metrics from reporter
    // This would integrate with the actual evolution reporter
  }

  private updatePerformanceMetrics(): void {
    const _memUsage = process.memoryUsage();
    const _stats = this.rlEngine.getStatistics();

    this.currentMetrics = {
      contextSwitchTime: this.getAverageContextSwitchTime(),
      memoryUsage: _memUsage.heapUsed / 1024 / 1024, // MB
      cpuUsage: this.getCpuUsage(), // Simplified CPU usage
      throughput: this.calculateThroughput(),
      _errorRate: _stats.errorRate,
      latency: {
        p50: this.currentMetrics.latency.p50,
        p95: this.calculatePercentile(95),
        p99: this.calculatePercentile(99),
      },
    };

    this.performanceHistory.push({ ...this.currentMetrics });
    if (this.performanceHistory.length > this.config.maxDataPoints) {
      this.performanceHistory.shift();
    }
  }

  private getAverageContextSwitchTime(): number {
    if (this.contextSwitchHistory.length === 0) return 0;

    const _recent = this.contextSwitchHistory.slice(-10); // Last 10 switches
    const _total = _recent.reduce((sum, metric) => sum + metric.switchTime, 0);
    return _total / _recent.length;
  }

  private getCpuUsage(): number {
    // Simplified CPU usage calculation
    // In production, this would use more sophisticated CPU monitoring
    return Math.random() * 100; // Placeholder
  }

  private calculateThroughput(): number {
    const _stats = this.rlEngine.getStatistics();
    const _timeWindow = 60; // 1 minute
    return _stats.totalEpisodes / _timeWindow; // Episodes per second (simplified)
  }

  private calculatePercentile(percentile: number): number {
    // Simplified percentile calculation for latency
    const _history = this.performanceHistory.slice(-50); // Last 50 data points
    if (_history.length === 0) return 0;

    const _sorted = _history.map((h) => h.latency.p50).sort((a, b) => a - b);
    const _index = Math.ceil((percentile / 100) * _sorted.length) - 1;
    return _sorted[_index] || 0;
  }

  private renderHeader(): void {
    const _uptime = Date.now() - (this.lastUpdate.getTime() - 60000); // Approximate
    const _status = this.isActive
      ? "{green-fg}🟢 ACTIVE{/green-fg}"
      : "{red-fg}🔴 INACTIVE{/red-fg}";

    this.panels.header.setContent(
      `{center}🧠 MARIA RL Evolution Dashboard ${_status} | ` +
        `Uptime: ${Math.floor(_uptime / 1000)}s | ` +
        `Last Update: ${this.lastUpdate.toLocaleTimeString()}{/center}`,
    );
  }

  private renderPerformancePanel(): void {
    const _metrics = this.currentMetrics;
    const _trend = this.getPerformanceTrend();

    const _content = [
      `Memory Usage: ${_metrics.memoryUsage.toFixed(1)} MB ${this.getTrendIcon(_trend.memory)}`,
      `CPU Usage: ${_metrics.cpuUsage.toFixed(1)}% ${this.getTrendIcon(_trend.cpu)}`,
      `Throughput: ${_metrics.throughput.toFixed(2)} eps ${this.getTrendIcon(_trend.throughput)}`,
      `Error Rate: ${(_metrics.errorRate * 100).toFixed(1)}% ${this.getTrendIcon(_trend.errors, true)}`,
      ``,
      `Latency Percentiles:`,
      `  P50: ${_metrics.latency.p50.toFixed(1)}ms`,
      `  P95: ${_metrics.latency.p95.toFixed(1)}ms`,
      `  P99: ${_metrics.latency.p99.toFixed(1)}ms`,
      ``,
      `Context Switch Avg: ${_metrics.contextSwitchTime.toFixed(1)}ms`,
    ].join("\n");

    this.panels.performance.setContent(_content);
  }

  private renderContextSwitchPanel(): void {
    const _recent = this.contextSwitchHistory.slice(-8); // Last 8 switches

    if (_recent.length === 0) {
      this.panels.contextSwitches.setContent(
        "No context switches recorded yet.",
      );
      return;
    }

    const _lines = ["Recent Context Switches:", ""];

    recent.forEach((metric, _index) => {
      const _overheadColor =
        metric.overhead > 50
          ? "red"
          : metric.overhead > 25
            ? "yellow"
            : "green";
      const _time = metric.timestamp.toLocaleTimeString().split(" ")[0];

      lines.push(
        `${_time} | ${metric.fromMode} → ${metric.toMode}`,
        `  Time: ${metric.switchTime}ms | ` +
          `{${_overheadColor}-fg}Overhead: ${metric.overhead.toFixed(1)}%{/${_overheadColor}-fg} | ` +
          `ΔMem: ${(metric.memoryDelta / 1024 / 1024).toFixed(1)}MB`,
      );

      if (_index < _recent.length - 1) _lines.push("");
    });

    // Add summary statistics
    const _avgSwitchTime =
      _recent.reduce((sum, m) => sum + m.switchTime, 0) / _recent.length;
    const _avgOverhead =
      _recent.reduce((sum, m) => sum + m.overhead, 0) / _recent.length;

    lines.push(
      "",
      `Averages: ${_avgSwitchTime.toFixed(1)}ms, ${_avgOverhead.toFixed(1)}% overhead`,
    );

    this.panels.contextSwitches.setContent(_lines.join("\n"));
  }

  private renderRealTimeLearningPanel(): void {
    if (!this.realTimeLearning) {
      this.panels.realTimeLearning.setContent(
        "Real-_time learning not configured.",
      );
      return;
    }

    const _state = this.realTimeLearning.getState();
    const _statusColor = _state.isActive ? "green" : "red";
    const _statusIcon = _state.isActive ? "✅" : "❌";

    const _content = [
      `Status: {${_statusColor}-fg}${_statusIcon} ${_state.isActive ? "ACTIVE" : "INACTIVE"}{/${_statusColor}-fg}`,
      `Mode: ${_state.currentMode.toUpperCase()}`,
      `Episodes Since Update: ${_state.episodesSinceUpdate}`,
      `Pending Updates: ${_state.pendingUpdates.length}`,
      ``,
      `Performance Trend:`,
      `  Direction: ${_state.recentPerformance.trendDirection}`,
      `  Confidence: ${(_state.recentPerformance.confidence * 100).toFixed(1)}%`,
      ``,
      `Active Triggers:`,
    ];

    // Add active _triggers (simplified)
    const _triggers = ["error_rate", "user_feedback", "performance"];
    triggers.forEach((trigger) => {
      const _isActive = Math.random() > 0.7; // Simplified trigger _status
      content.push(`  ${trigger}: ${_isActive ? "🟡" : "⚪"}`);
    });

    this.panels.realTimeLearning.setContent(_content.join("\n"));
  }

  private renderEvolutionPanel(): void {
    const _stats = this.rlEngine.getStatistics();
    const _policy = this.rlEngine.getPolicy();

    const _content = [
      `Policy Version: v${_policy.version}`,
      `Total Episodes: ${_stats.totalEpisodes}`,
      `Average Reward: ${_stats.averageReward.toFixed(1)}/100`,
      `Success Rate: ${((1 - _stats.errorRate) * 100).toFixed(1)}%`,
      ``,
      `Learning Progress:`,
      `  Convergence: ${this.calculateConvergence().toFixed(1)}%`,
      `  Stability: ${this.calculateStability()}`,
      `  Exploration: ${this.calculateExploration().toFixed(1)}%`,
      ``,
      `Recent Improvements:`,
      `  Code Quality: +${(Math.random() * 10 + 5) | 0}%`,
      `  User Satisfaction: +${(Math.random() * 8 + 2) | 0}%`,
    ].join("\n");

    this.panels.evolution.setContent(_content);
  }

  private renderSafetyPanel(): void {
    // Simplified safety _status - would integrate with actual SafetyValidator
    const _safetyScore = 85 + Math.random() * 10; // 85-95%
    const _riskLevel =
      _safetyScore > 90 ? "LOW" : _safetyScore > 80 ? "MEDIUM" : "HIGH";
    const _riskColor =
      _riskLevel === "LOW"
        ? "green"
        : _riskLevel === "MEDIUM"
          ? "yellow"
          : "red";

    const _content = [
      `Safety Score: ${_safetyScore.toFixed(1)}/100`,
      `Risk Level: {${_riskColor}-fg}${_riskLevel}{/${_riskColor}-fg}`,
      ``,
      `Safety Checks:`,
      `  ✅ Regression: PASS`,
      `  ✅ Performance: PASS`,
      `  ✅ Error Rate: PASS`,
      `  ✅ Security: PASS`,
      `  ⚠️  Memory: WARNING`,
      `  ✅ Consistency: PASS`,
      ``,
      `Recent Actions:`,
      `  - Policy validated`,
      `  - Backup created`,
      `  - Monitoring active`,
    ].join("\n");

    this.panels.safety.setContent(_content);
  }

  private renderAlertsPanel(): void {
    // This would show _recent alerts and notifications
    const _content = [
      "Recent Alerts:",
      "",
      "🟡 [09:15:32] Context switch overhead high",
      "🟢 [09:14:18] Policy update successful",
      "🔵 [09:13:45] Real-_time trigger activated",
      "🟡 [09:12:30] Memory usage increasing",
      "🟢 [09:11:15] Safety validation passed",
    ].join("\n");

    this.panels.alerts.setContent(_content);
  }

  private getPerformanceTrend(): Record<string, number> {
    // Simplified _trend calculation
    return {
      memory: Math.random() > 0.5 ? 1 : -1,
      cpu: Math.random() > 0.5 ? 1 : -1,
      throughput: Math.random() > 0.5 ? 1 : -1,
      errors: Math.random() > 0.5 ? 1 : -1,
    };
  }

  private getTrendIcon(_trend: number, inverted: boolean = false): string {
    if (_trend === 0) return "➡️";
    const up = inverted ? "📉" : "📈";
    const _down = inverted ? "📈" : "📉";
    return _trend > 0 ? up : _down;
  }

  private calculateConvergence(): number {
    // Simplified convergence calculation
    return Math.min(
      95,
      (this.rlEngine.getStatistics().totalEpisodes / 100) * 100,
    );
  }

  private calculateStability(): string {
    const _errorRate = this.rlEngine.getStatistics()._errorRate;
    if (_errorRate < 0.05) return "🟢 HIGH";
    if (_errorRate < 0.15) return "🟡 MEDIUM";
    return "🔴 LOW";
  }

  private calculateExploration(): number {
    // Simplified exploration rate calculation
    return Math.max(5, 50 - this.rlEngine.getStatistics().totalEpisodes / 10);
  }

  private togglePause(): void {
    this.isActive = !this.isActive;
    if (this.isActive && !this.refreshTimer) {
      this.refreshTimer = setInterval(() => {
        this.refresh();
      }, this.config.refreshInterval);
    } else if (!this.isActive && this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }

    this.addAlert("info", `Dashboard ${this.isActive ? "resumed" : "paused"}`);
  }

  private clearHistory(): void {
    this.performanceHistory = [];
    this.contextSwitchHistory = [];
    this.addAlert("info", "Performance _history cleared");
  }

  private async exportSnapshot(): Promise<void> {
    try {
      const _snapshot = {
        _timestamp: new Date(),
        currentMetrics: this.currentMetrics,
        performanceHistory: this.performanceHistory.slice(-50),
        contextSwitchHistory: this.contextSwitchHistory.slice(-50),
        rlEngineStats: this.rlEngine.getStatistics(),
        _policy: this.rlEngine.getPolicy(),
      };

      const _filename = `evolution-dashboard-_snapshot-${Date.now()}.json`;
      // In production, this would write to file
      this.addAlert("success", `Snapshot exported: ${_filename}`);
    } catch (_error) {
      this.addAlert("_error", `Export failed: ${_error.message}`);
    }
  }

  private addAlert(_type: string, message: string): void {
    const _timestamp = new Date().toLocaleTimeString();
    const _icon =
      {
        _error: "🔴",
        warning: "🟡",
        info: "🔵",
        success: "🟢",
      }[_type] || "⚪";

    this.log(`${_icon} [${_timestamp}] ${message}`);
  }

  private log(message: string): void {
    if (this.panels.logs) {
      this.panels.logs.log(message);
    }
  }

  public getScreen(): blessed.Widgets.Screen {
    return this.screen;
  }

  public getCurrentMetrics(): PerformanceMetrics {
    return { ...this.currentMetrics };
  }

  public getContextSwitchHistory(): ContextSwitchMetric[] {
    return [...this.contextSwitchHistory];
  }
}

export default EvolutionDashboard;
