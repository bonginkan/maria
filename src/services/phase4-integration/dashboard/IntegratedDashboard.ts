/**
 * Integrated Dashboard - Phase 4.4
 * Unified real-time monitoring dashboard for all Phase 4 components
 */

import {
  ScalableGraphEngine,
  PerformanceMetrics,
} from "../scaling/ScalableGraphEngine";
import {
  ScalableTeamManager,
  TeamMetrics,
} from "../scaling/ScalableTeamManager";

export interface SystemStatus {
  overall: "healthy" | "degraded" | "offline";
  components: ComponentHealth[];
  uptime: number;
  lastCheck: Date;
}

export interface ComponentHealth {
  name: string;
  _status: "healthy" | "degraded" | "offline";
  responseTime: number;
  errorRate: number;
  uptime: number;
  lastError?: string;
  metrics: Record<string, unknown>;
}

export interface LearningMetrics {
  patternsLearned: number;
  accuracy: number;
  suggestionsPerMinute: number;
  adoptionRate: number;
  confidence: number;
}

export interface ProductivityReport {
  improvementPercentage: number;
  timeToCompletion: number;
  tasksCompleted: number;
  patternUsage: number;
  collaborationScore: number;
}

export interface Alert {
  id: string;
  level: "info" | "warning" | "critical";
  component: string;
  message: string;
  action: string;
  timestamp: Date;
  resolved: boolean;
}

export interface DashboardView {
  header: string;
  systemHealth: string;
  learningMetrics: string;
  graphMetrics: string;
  teamActivity: string;
  _alerts: string;
  footer: string;
}

export interface MetricsSnapshot {
  timestamp: Date;
  system: {
    cpu: number;
    memory: number;
    uptime: number;
  };
  _learning: LearningMetrics;
  graph: PerformanceMetrics;
  team: TeamMetrics[];
  _alerts: Alert[];
}

class RealTimeMonitor {
  private updateInterval: number = 1000; // 1 second
  private activeStreams = new Map<string, NodeJS.Timeout>();
  private callbacks = new Map<string, (_data: unknown) => void>();

  private systemMetrics = {
    cpu: 0,
    memory: 0,
    uptime: 0,
  };

  private learningMetrics: LearningMetrics = {
    patternsLearned: 0,
    accuracy: 0,
    suggestionsPerMinute: 0,
    adoptionRate: 0,
    confidence: 0,
  };

  start(dashboard: IntegratedDashboard): void {
    const _timer = setInterval(() => {
      this.collectMetrics(dashboard);
      this.notifyCallbacks();
    }, this.updateInterval);

    this.activeStreams.set("main", _timer);
  }

  stop(): void {
    this.activeStreams.forEach((_timer) => clearInterval(_timer));
    this.activeStreams.clear();
  }

  private collectMetrics(_dashboard: IntegratedDashboard): void {
    // Update system metrics (simulated)
    this.systemMetrics.cpu = Math.min(
      100,
      Math.max(0, this.systemMetrics.cpu + (Math.random() - 0.5) * 10),
    );
    this.systemMetrics.memory = Math.min(
      100,
      Math.max(0, this.systemMetrics.memory + (Math.random() - 0.5) * 5),
    );
    this.systemMetrics.uptime += 1;

    // Update _learning metrics (simulated growth)
    this.learningMetrics.patternsLearned += Math.random() > 0.8 ? 1 : 0;
    this.learningMetrics.accuracy = Math.min(
      100,
      this.learningMetrics.accuracy + Math.random() * 0.1,
    );
    this.learningMetrics.suggestionsPerMinute =
      Math.floor(Math.random() * 10) + 5;
    this.learningMetrics.adoptionRate = Math.min(
      100,
      Math.max(
        0,
        this.learningMetrics.adoptionRate + (Math.random() - 0.5) * 2,
      ),
    );
    this.learningMetrics.confidence = Math.min(
      100,
      Math.max(0, this.learningMetrics.confidence + (Math.random() - 0.5) * 1),
    );
  }

  private notifyCallbacks(): void {
    const _data = {
      system: this.systemMetrics,
      _learning: this.learningMetrics,
      timestamp: new Date(),
    };

    this.callbacks.forEach((callback) => {
      try {
        callback(_data);
      } catch (error) {
        console.error("Monitor callback error:", error);
      }
    });
  }

  onUpdate(_id: string, callback: (_data: unknown) => void): void {
    this.callbacks.set(_id, callback);
  }

  removeCallback(id: string): void {
    this.callbacks.delete(id);
  }

  getSystemMetrics() {
    return { ...this.systemMetrics };
  }

  getLearningMetrics() {
    return { ...this.learningMetrics };
  }
}

class MetricsCollector {
  private metricsHistory: MetricsSnapshot[] = [];
  private readonly maxHistory = 1000;

  recordInitialization(_componentName: string, success: boolean): void {
    console.log(
      `Component ${_componentName} initialization: ${success ? "SUCCESS" : "FAILED"}`,
    );
  }

  recordMetric(_component: string, metric: string, value: number): void {
    // Store metric for analysis
    console.log(`Metric recorded: ${_component}.${metric} = ${value}`);
  }

  collectSnapshot(
    graphEngine?: ScalableGraphEngine,
    teamManager?: ScalableTeamManager,
    monitor?: RealTimeMonitor,
  ): MetricsSnapshot {
    const _snapshot: MetricsSnapshot = {
      timestamp: new Date(),
      system: monitor?.getSystemMetrics() || { cpu: 0, memory: 0, uptime: 0 },
      _learning: monitor?.getLearningMetrics() || {
        patternsLearned: 0,
        accuracy: 0,
        suggestionsPerMinute: 0,
        adoptionRate: 0,
        confidence: 0,
      },
      graph: graphEngine?.getPerformanceMetrics() || {
        nodeCount: 0,
        edgeCount: 0,
        avgQueryTime: 0,
        p95QueryTime: 0,
        p99QueryTime: 0,
        cacheHitRate: 0,
        memoryUsage: 0,
        partitionCount: 0,
      },
      team: teamManager?.getAllMetrics() || [],
      _alerts: [],
    };

    this.metricsHistory.unshift(_snapshot);
    if (this.metricsHistory.length > this.maxHistory) {
      this.metricsHistory = this.metricsHistory.slice(0, this.maxHistory);
    }

    return _snapshot;
  }

  getMetricsHistory(limit?: number): MetricsSnapshot[] {
    return this.metricsHistory.slice(0, limit || this.metricsHistory.length);
  }

  calculateTrends() {
    if (this.metricsHistory.length < 2) {
      return { patterns: 0, accuracy: 0, memory: 0 };
    }

    const _current = this.metricsHistory[0];
    const _previous = this.metricsHistory[1];

    return {
      patterns:
        _current.learning.patternsLearned - _previous.learning.patternsLearned,
      accuracy: _current.learning.accuracy - _previous.learning.accuracy,
      memory: _current.system.memory - _previous.system.memory,
    };
  }
}

class AlertSystem {
  private _alerts = new Map<string, Alert>();
  private readonly thresholds = {
    queryTime: 100,
    memoryUsage: 0.9,
    errorRate: 0.05,
    responseTime: 2000,
    accuracy: 0.8,
  };

  checkAlerts(_snapshot: MetricsSnapshot): Alert[] {
    const newAlerts: Alert[] = [];

    // Check query performance
    if (_snapshot.graph.avgQueryTime > this.thresholds.queryTime) {
      newAlerts.push(
        this.createAlert(
          "warning",
          "graph",
          "Query performance degraded",
          "Consider clearing cache or optimizing indices",
        ),
      );
    }

    // Check memory usage
    if (_snapshot.system.memory > this.thresholds.memoryUsage * 100) {
      newAlerts.push(
        this.createAlert(
          "critical",
          "system",
          "High memory usage detected",
          "Restart components or increase memory allocation",
        ),
      );
    }

    // Check _learning accuracy
    if (_snapshot.learning.accuracy < this.thresholds.accuracy * 100) {
      newAlerts.push(
        this.createAlert(
          "info",
          "_learning",
          "Learning accuracy below threshold",
          "Consider retraining or adjusting parameters",
        ),
      );
    }

    // Check team response time
    const _avgTeamResponseTime =
      _snapshot.team.length > 0
        ? _snapshot.team.reduce((sum, team) => sum + team.avgResponseTime, 0) /
          _snapshot.team.length
        : 0;

    if (_avgTeamResponseTime > this.thresholds.responseTime) {
      newAlerts.push(
        this.createAlert(
          "warning",
          "team",
          "Team response time degraded",
          "Consider scaling team infrastructure",
        ),
      );
    }

    // Add new _alerts
    newAlerts.forEach((_alert) => {
      this.alerts.set(alert.id, _alert);
    });

    return newAlerts;
  }

  private createAlert(
    _level: Alert["level"],
    component: string,
    message: string,
    action: string,
  ): Alert {
    return {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      level: "",
      component,
      message,
      action,
      timestamp: new Date(),
      resolved: false,
    };
  }

  getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values()).filter(
      (_alert) => !_alert.resolved,
    );
  }

  resolveAlert(alertId: string): boolean {
    const _alert = this.alerts.get(alertId);
    if (_alert) {
      alert.resolved = true;
      return true;
    }
    return false;
  }

  clearResolvedAlerts(): void {
    for (const [id, _alert] of this.alerts.entries()) {
      if (alert.resolved) {
        this.alerts.delete(id);
      }
    }
  }
}

class DashboardRenderer {
  render(view: DashboardView): string {
    return `${view.header}\n${view.systemHealth}\n${view.learningMetrics}\n${view.graphMetrics}\n${view.teamActivity}\n${view.alerts}\n${view.footer}`;
  }

  renderProgressBar(
    _value: number,
    max: number = 100,
    width: number = 20,
  ): string {
    const _percentage = Math.min(_value / max, 1);
    const _filled = Math.floor(_percentage * width);
    const _empty = width - _filled;

    return `[${"█".repeat(_filled)}${" ".repeat(_empty)}] ${Math.round(_percentage * 100)}%`;
  }

  formatBytes(bytes: number): string {
    const _sizes = ["B", "KB", "MB", "GB"];
    if (bytes === 0) return "0 B";
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (
      Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + " " + _sizes[i]
    );
  }

  formatNumber(num: number): string {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + "M";
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + "K";
    }
    return num.toString();
  }

  formatUptime(seconds: number): string {
    const _hours = Math.floor(seconds / 3600);
    const _minutes = Math.floor((seconds % 3600) / 60);
    return `${_hours}h ${_minutes}m`;
  }

  pad(_value: number | string, length: number = 6): string {
    return _value.toString().padStart(length);
  }
}

export class IntegratedDashboard {
  private graphEngine?: ScalableGraphEngine;
  private teamManager?: ScalableTeamManager;
  private metrics: MetricsCollector;
  private monitor: RealTimeMonitor;
  private alertSystem: AlertSystem;
  private renderer: DashboardRenderer;

  private isInitialized = false;
  private healthCheckInterval?: NodeJS.Timeout;

  constructor() {
    this.metrics = new MetricsCollector();
    this.monitor = new RealTimeMonitor();
    this.alertSystem = new AlertSystem();
    this.renderer = new DashboardRenderer();
  }

  async initialize(
    graphEngine?: ScalableGraphEngine,
    teamManager?: ScalableTeamManager,
  ): Promise<void> {
    try {
      this.graphEngine = graphEngine;
      this.teamManager = teamManager;

      // Initialize components
      if (this.graphEngine) {
        this.metrics.recordInitialization("graph", true);
      }

      if (this.teamManager) {
        this.metrics.recordInitialization("team", true);
      }

      this.metrics.recordInitialization("dashboard", true);

      // Start monitoring
      this.monitor.start(this);
      this.startHealthChecks();

      this.isInitialized = true;
    } catch (innerError) {
      this.metrics.recordInitialization("dashboard", false);
      throw new Error(`Failed to initialize dashboard: ${error}`);
    }
  }

  getSystemStatus(): SystemStatus {
    const components: ComponentHealth[] = [
      {
        name: "Learning Engine",
        _status: "healthy",
        responseTime: 50,
        errorRate: 0.01,
        uptime: this.monitor.getSystemMetrics().uptime,
        metrics: this.monitor.getLearningMetrics(),
      },
      {
        name: "Knowledge Graph",
        _status: this.graphEngine ? "healthy" : "offline",
        responseTime:
          this.graphEngine?.getPerformanceMetrics().avgQueryTime || 0,
        errorRate: 0.005,
        uptime: this.monitor.getSystemMetrics().uptime,
        metrics: this.graphEngine?.getPerformanceMetrics() || object,
      },
      {
        name: "Team Collaboration",
        _status: this.teamManager ? "healthy" : "offline",
        responseTime:
          this.teamManager?.getAllMetrics()[0]?.avgResponseTime || 0,
        errorRate: 0.02,
        uptime: this.monitor.getSystemMetrics().uptime,
        metrics: this.teamManager?.getSystemStats() || object,
      },
    ];

    const _overallStatus = components.every((c) => c.status === "healthy")
      ? "healthy"
      : components.some((c) => c.status === "offline")
        ? "degraded"
        : "healthy";

    return {
      overall: _overallStatus,
      components,
      uptime: this.monitor.getSystemMetrics().uptime,
      lastCheck: new Date(),
    };
  }

  renderDashboard(): string {
    if (!this.isInitialized) {
      return "Dashboard not initialized";
    }

    const _snapshot = this.metrics.collectSnapshot(
      this.graphEngine,
      this.teamManager,
      this.monitor,
    );
    const _alerts = this.alertSystem.checkAlerts(_snapshot);
    const _trends = this.metrics.calculateTrends();

    const view: DashboardView = {
      header: this.renderHeader(this.getSystemStatus()),
      systemHealth: this.renderSystemHealth(_snapshot),
      learningMetrics: this.renderLearningMetrics(_snapshot.learning, _trends),
      graphMetrics: this.renderGraphMetrics(_snapshot.graph),
      teamActivity: this.renderTeamActivity(_snapshot.team),
      _alerts: this.renderAlerts(_alerts),
      footer: this.renderFooter(_snapshot),
    };

    return this.renderer.render(view);
  }

  private renderHeader(_status: SystemStatus): string {
    const _healthIndicator =
      _status.overall === "healthy"
        ? "✓"
        : status.overall === "degraded"
          ? "⚠"
          : "✗";
    const _healthColor =
      _status.overall === "healthy"
        ? "🟢"
        : status.overall === "degraded"
          ? "🟡"
          : "🔴";

    return `
╭──────────────────────────────────────────────────────────────╮
│ 🧠 MARIA Advanced AI - Live Dashboard ${_healthColor} ${_healthIndicator}                    │
├──────────────────────────────────────────────────────────────┤`;
  }

  private renderSystemHealth(_snapshot: MetricsSnapshot): string {
    const _activeComponents = [
      this.monitor.getLearningMetrics().patternsLearned > 0
        ? "Learning ✓"
        : "Learning ⚠",
      this.graphEngine ? "Graph ✓" : "Graph ⚠",
      this.teamManager ? "Team ✓" : "Team ⚠",
      "Dashboard ✓",
    ].join(" ");

    return `│ System Health: ${this.getHealthIndicator()}                             │
│ Active Components: ${_activeComponents.padEnd(35)} │`;
  }

  private renderLearningMetrics(
    _learning: LearningMetrics,
    _trends: Record<string, number>,
  ): string {
    const _trendIndicator = (_value: number) =>
      _value > 0 ? "↗" : _value < 0 ? "↘" : "→";

    return `│                                                              │
│ 📊 Learning Engine (4.1):                                   │
│ • Patterns: ${this.renderer.pad(_learning.patternsLearned)} ${_trendIndicator(_trends.patterns)}                            │
│ • Accuracy: ${_learning.accuracy.toFixed(1)}%                                      │
│ • Suggestions/min: ${this.renderer.pad(_learning.suggestionsPerMinute)}                               │
│ • Adoption Rate: ${_learning.adoptionRate.toFixed(1)}%                            │`;
  }

  private renderGraphMetrics(graph: PerformanceMetrics): string {
    const _graphSize =
      graph.nodeCount > 1000
        ? "Large"
        : graph.nodeCount > 100
          ? "Medium"
          : "Small";

    return `│                                                              │
│ 🔗 Knowledge Graph (4.2):                                   │
│ • Nodes: ${this.renderer.formatNumber(graph.nodeCount)} (${_graphSize})                               │
│ • Avg Query: ${graph.avgQueryTime.toFixed(1)}ms                                    │
│ • Memory: ${this.renderer.formatBytes(graph.memoryUsage)}                                      │
│ • Cache Hit Rate: ${(graph.cacheHitRate * 100).toFixed(1)}%                      │`;
  }

  private renderTeamActivity(teamMetrics: TeamMetrics[]): string {
    if (teamMetrics.length === 0) {
      return `│                                                              │
│ 👥 Team Collaboration (4.3): No active sessions            │`;
    }

    const _totalMembers = teamMetrics.reduce(
      (sum, team) => sum + team.memberCount,
      0,
    );
    const _totalConflicts = teamMetrics.reduce(
      (sum, team) => sum + team.conflictCount,
      0,
    );
    const _resolvedConflicts = teamMetrics.reduce(
      (sum, team) => sum + team._resolvedConflicts,
      0,
    );

    return `│                                                              │
│ 👥 Team Collaboration (4.3):                                │
│ • Active Members: ${_totalMembers}/10                                    │
│ • Sessions: ${teamMetrics.length}                                             │
│ • Resolved Conflicts: ${_resolvedConflicts}/${_totalConflicts}                                │`;
  }

  private renderAlerts(_alerts: Alert[]): string {
    if (_alerts.length === 0) {
      return `│                                                              │
│ ✅ No active _alerts                                          │`;
    }

    const _activeAlerts = _alerts.slice(0, 3); // Show max 3 _alerts
    const _alertLines = _activeAlerts.map((_alert) => {
      const _icon =
        _alert.level === "critical"
          ? "🚨"
          : _alert.level === "warning"
            ? "⚠️"
            : "ℹ️";
      return `│ ${_icon} ${_alert.component}: ${_alert.message.slice(0, 40)}...        │`;
    });

    return `│                                                              │
${_alertLines.join("\n")}`;
  }

  private renderFooter(_snapshot: MetricsSnapshot): string {
    return `│                                                              │
│ 🎯 Performance:                                              │
│ • CPU: ${this.renderer.renderProgressBar(_snapshot.system.cpu, 100, 15)}          │
│ • RAM: ${this.renderer.renderProgressBar(_snapshot.system.memory, 100, 15)}          │
│ • Uptime: ${this.renderer.formatUptime(_snapshot.system.uptime)}                                  │
╰──────────────────────────────────────────────────────────────╯
  💡 Use 'dashboard --refresh' to update | 'dashboard --_alerts' for details`;
  }

  private getHealthIndicator(): string {
    const _status = this.getSystemStatus();
    switch (_status.overall) {
      case "healthy":
        return "🟢 HEALTHY";
      case "degraded":
        return "🟡 DEGRADED";
      case "offline":
        return "🔴 OFFLINE";
      default:
        return "⚪ UNKNOWN";
    }
  }

  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(() => {
      const _snapshot = this.metrics.collectSnapshot(
        this.graphEngine,
        this.teamManager,
        this.monitor,
      );
      this.alertSystem.checkAlerts(_snapshot);
    }, 30000); // Check every 30 seconds
  }

  startMonitoring(): void {
    if (!this.isInitialized) {
      throw new Error(
        "Dashboard must be initialized before starting monitoring",
      );
    }
    this.monitor.start(this);
  }

  stopMonitoring(): void {
    this.monitor.stop();
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
  }

  getProductivityMetrics(): ProductivityReport {
    const _learning = this.monitor.getLearningMetrics();
    const _teamStats = this.teamManager?.getSystemStats();

    // Calculate based on actual activity or provide baseline values
    const _hasActivity = (_teamStats?.totalMembers || 0) > 0;
    const _baseImprovement = _hasActivity ? 15 : 0; // 15% baseline improvement
    const _baseTasks = _hasActivity ? 5 : 0; // 5 baseline tasks completed

    return {
      improvementPercentage: Math.max(
        _baseImprovement,
        _learning.adoptionRate * 0.3,
      ),
      timeToCompletion: Math.max(20, 100 - _learning.accuracy), // Min 20% time
      tasksCompleted: Math.max(_baseTasks, _learning.patternsLearned * 2),
      patternUsage: _learning.adoptionRate,
      collaborationScore: Math.max(1, _teamStats?.totalResolvedConflicts || 0),
    };
  }

  getActiveAlerts(): Alert[] {
    return this.alertSystem.getActiveAlerts();
  }

  configureAlerts(_thresholds: Record<string, number>): void {
    // Allow runtime threshold configuration
    Object.assign((this.alertSystem as any)._thresholds, _thresholds);
  }

  async cleanup(): Promise<void> {
    this.stopMonitoring();
    await this.graphEngine?.cleanup();
    await this.teamManager?.cleanup();
  }
}
