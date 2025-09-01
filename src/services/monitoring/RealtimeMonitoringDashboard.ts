/**
 * Real-time Monitoring Dashboard
 * Phase 4.0 Week 2: Enterprise monitoring with <100ms update latency
 * Features: Security metrics, performance tracking, system health
 */

import { EventEmitter } from "node:events";
import { WebSocket, WebSocketServer } from "ws";
import { createServer } from "http";
import * as path from "path";

export interface DashboardConfig {
  port: number;
  updateInterval: number; // milliseconds, target <100ms
  retentionPeriod: number; // days, default 90
  alertThresholds: AlertThresholds;
  enableHistorical: boolean;
  enableExports: boolean;
  authentication: {
    enabled: boolean;
    secret?: string;
    sessionTimeout?: number;
  };
}

export interface AlertThresholds {
  cpuUsage: number; // percentage
  memoryUsage: number; // percentage
  responseTime: number; // milliseconds
  errorRate: number; // percentage
  securityEvents: number; // count per minute
  diskUsage: number; // percentage
}

export interface SystemMetrics {
  timestamp: Date;
  cpu: {
    usage: number;
    cores: number;
    loadAverage: number[];
  };
  memory: {
    used: number;
    total: number;
    heap: number;
    external: number;
  };
  network: {
    bytesIn: number;
    bytesOut: number;
    connectionsActive: number;
  };
  disk: {
    used: number;
    total: number;
    readOps: number;
    writeOps: number;
  };
}

export interface SecurityMetrics {
  timestamp: Date;
  authentication: {
    successful: number;
    failed: number;
    blocked: number;
  };
  authorization: {
    granted: number;
    denied: number;
    violations: number;
  };
  encryption: {
    operations: number;
    keyRotations: number;
    failures: number;
  };
  threats: {
    detected: number;
    blocked: number;
    severity: "low" | "medium" | "high" | "critical";
  };
}

export interface PerformanceMetrics {
  timestamp: Date;
  requests: {
    total: number;
    successful: number;
    failed: number;
    avgResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
  };
  database: {
    connections: number;
    queries: number;
    avgQueryTime: number;
    slowQueries: number;
  };
  cache: {
    hits: number;
    misses: number;
    hitRate: number;
    evictions: number;
  };
  compression: {
    operations: number;
    ratio: number;
    throughput: number; // MB/s
  };
}

export interface DashboardMetrics {
  system: SystemMetrics;
  security: SecurityMetrics;
  performance: PerformanceMetrics;
}

export interface Alert {
  id: string;
  timestamp: Date;
  severity: "info" | "warning" | "error" | "critical";
  category: "system" | "security" | "performance" | "business";
  title: string;
  description: string;
  source: string;
  threshold?: number;
  currentValue?: number;
  resolved: boolean;
  resolvedAt?: Date;
  acknowledgedBy?: string;
}

export interface DashboardClient {
  id: string;
  ws: WebSocket;
  authenticated: boolean;
  lastActivity: Date;
  subscriptions: string[];
}

/**
 * Real-time Monitoring Dashboard
 * Provides live system, security, and performance metrics
 */
export class RealtimeMonitoringDashboard extends EventEmitter {
  private config: DashboardConfig;
  private server: WebSocketServer | null = null;
  private httpServer: any = null;
  private clients: Map<string, DashboardClient> = new Map();
  private metricsHistory: Map<string, DashboardMetrics[]> = new Map();
  private activeAlerts: Map<string, Alert> = new Map();
  private updateTimer: NodeJS.Timeout | null = null;

  private currentMetrics: DashboardMetrics = {
    system: this.getEmptySystemMetrics(),
    security: this.getEmptySecurityMetrics(),
    performance: this.getEmptyPerformanceMetrics(),
  };

  constructor(config: DashboardConfig) {
    super();
    this.config = this.validateConfig(config);
  }

  /**
   * Start the monitoring dashboard
   */
  async start(): Promise<void> {
    try {
      // Create HTTP server for WebSocket upgrade
      this.httpServer = createServer();

      // Create WebSocket server
      this.server = new WebSocketServer({
        server: this.httpServer,
        path: "/dashboard",
      });

      // Set up WebSocket handlers
      this.server.on("connection", (ws, request) => {
        this.handleConnection(ws, request);
      });

      // Start HTTP server
      await new Promise<void>((resolve, reject) => {
        this.httpServer!.listen(this.config.port, (err: any) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Start metrics collection
      this.startMetricsCollection();

      this.emit("dashboard_started", {
        port: this.config.port,
        updateInterval: this.config.updateInterval,
      });
    } catch (error) {
      this.emit("startup_error", error);
      throw error;
    }
  }

  /**
   * Stop the monitoring dashboard
   */
  async stop(): Promise<void> {
    // Stop metrics collection
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }

    // Close all client connections
    for (const [clientId, client] of this.clients) {
      client.ws.close(1000, "Server shutting down");
    }
    this.clients.clear();

    // Close WebSocket server
    if (this.server) {
      this.server.close();
      this.server = null;
    }

    // Close HTTP server
    if (this.httpServer) {
      await new Promise<void>((resolve) => {
        this.httpServer!.close(() => resolve());
      });
      this.httpServer = null;
    }

    this.emit("dashboard_stopped");
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: WebSocket, request: any): void {
    const clientId = this.generateClientId();
    const client: DashboardClient = {
      id: clientId,
      ws,
      authenticated: !this.config.authentication.enabled,
      lastActivity: new Date(),
      subscriptions: [],
    };

    this.clients.set(clientId, client);

    // Send initial data
    if (client.authenticated) {
      this.sendInitialData(client);
    }

    // Set up message handlers
    ws.on("message", (data) => {
      this.handleMessage(client, data);
    });

    ws.on("close", () => {
      this.clients.delete(clientId);
      this.emit("client_disconnected", { clientId });
    });

    ws.on("error", (error) => {
      this.emit("client_error", { clientId, error });
    });

    this.emit("client_connected", {
      clientId,
      authenticated: client.authenticated,
    });
  }

  /**
   * Handle WebSocket messages
   */
  private handleMessage(client: DashboardClient, data: any): void {
    try {
      const message = JSON.parse(data.toString());
      client.lastActivity = new Date();

      switch (message.type) {
        case "authenticate":
          this.handleAuthentication(client, message.payload);
          break;
        case "subscribe":
          this.handleSubscription(client, message.payload);
          break;
        case "unsubscribe":
          this.handleUnsubscription(client, message.payload);
          break;
        case "acknowledge_alert":
          this.handleAlertAcknowledgment(client, message.payload);
          break;
        case "export_data":
          this.handleDataExport(client, message.payload);
          break;
        default:
          this.sendError(client, "Unknown message type");
      }
    } catch (error) {
      this.sendError(client, "Invalid message format");
    }
  }

  /**
   * Start metrics collection and broadcasting
   */
  private startMetricsCollection(): void {
    this.updateTimer = setInterval(async () => {
      try {
        // Collect current metrics
        await this.collectMetrics();

        // Check for alerts
        this.checkAlerts();

        // Broadcast to clients
        this.broadcastMetrics();

        // Store historical data
        this.storeHistoricalData();
      } catch (error) {
        this.emit("metrics_collection_error", error);
      }
    }, this.config.updateInterval);
  }

  /**
   * Collect system, security, and performance metrics
   */
  private async collectMetrics(): Promise<void> {
    const timestamp = new Date();

    // System metrics
    this.currentMetrics.system = {
      timestamp,
      cpu: await this.getCpuMetrics(),
      memory: this.getMemoryMetrics(),
      network: await this.getNetworkMetrics(),
      disk: await this.getDiskMetrics(),
    };

    // Security metrics
    this.currentMetrics.security = {
      timestamp,
      authentication: await this.getAuthMetrics(),
      authorization: await this.getAuthzMetrics(),
      encryption: await this.getEncryptionMetrics(),
      threats: await this.getThreatMetrics(),
    };

    // Performance metrics
    this.currentMetrics.performance = {
      timestamp,
      requests: await this.getRequestMetrics(),
      database: await this.getDatabaseMetrics(),
      cache: await this.getCacheMetrics(),
      compression: await this.getCompressionMetrics(),
    };
  }

  /**
   * Check metrics against alert thresholds
   */
  private checkAlerts(): void {
    const metrics = this.currentMetrics;
    const thresholds = this.config.alertThresholds;

    // CPU usage alert
    if (metrics.system.cpu.usage > thresholds.cpuUsage) {
      this.createAlert({
        severity: "warning",
        category: "system",
        title: "High CPU Usage",
        description: `CPU usage is ${metrics.system.cpu.usage}%`,
        source: "system_monitor",
        threshold: thresholds.cpuUsage,
        currentValue: metrics.system.cpu.usage,
      });
    }

    // Memory usage alert
    const memoryUsage =
      (metrics.system.memory.used / metrics.system.memory.total) * 100;
    if (memoryUsage > thresholds.memoryUsage) {
      this.createAlert({
        severity: "warning",
        category: "system",
        title: "High Memory Usage",
        description: `Memory usage is ${memoryUsage.toFixed(1)}%`,
        source: "system_monitor",
        threshold: thresholds.memoryUsage,
        currentValue: memoryUsage,
      });
    }

    // Response time alert
    if (
      metrics.performance.requests.avgResponseTime > thresholds.responseTime
    ) {
      this.createAlert({
        severity: "error",
        category: "performance",
        title: "High Response Time",
        description: `Average response time is ${metrics.performance.requests.avgResponseTime}ms`,
        source: "performance_monitor",
        threshold: thresholds.responseTime,
        currentValue: metrics.performance.requests.avgResponseTime,
      });
    }

    // Error rate alert
    const errorRate =
      (metrics.performance.requests.failed /
        metrics.performance.requests.total) *
      100;
    if (errorRate > thresholds.errorRate) {
      this.createAlert({
        severity: "error",
        category: "performance",
        title: "High Error Rate",
        description: `Error rate is ${errorRate.toFixed(1)}%`,
        source: "performance_monitor",
        threshold: thresholds.errorRate,
        currentValue: errorRate,
      });
    }

    // Security events alert
    if (metrics.security.threats.detected > thresholds.securityEvents) {
      this.createAlert({
        severity: "critical",
        category: "security",
        title: "Security Threats Detected",
        description: `${metrics.security.threats.detected} threats detected`,
        source: "security_monitor",
        threshold: thresholds.securityEvents,
        currentValue: metrics.security.threats.detected,
      });
    }
  }

  /**
   * Create new alert
   */
  private createAlert(alertData: Partial<Alert>): void {
    const alert: Alert = {
      id: this.generateAlertId(),
      timestamp: new Date(),
      severity: alertData.severity || "info",
      category: alertData.category || "system",
      title: alertData.title || "Alert",
      description: alertData.description || "",
      source: alertData.source || "dashboard",
      threshold: alertData.threshold,
      currentValue: alertData.currentValue,
      resolved: false,
    };

    this.activeAlerts.set(alert.id, alert);

    // Broadcast alert to clients
    this.broadcast({
      type: "alert",
      data: alert,
    });

    this.emit("alert_created", alert);
  }

  /**
   * Broadcast metrics to all authenticated clients
   */
  private broadcastMetrics(): void {
    const message = {
      type: "metrics_update",
      data: this.currentMetrics,
      timestamp: new Date(),
    };

    this.broadcast(message);
  }

  /**
   * Broadcast message to subscribed clients
   */
  private broadcast(message: any): void {
    const messageStr = JSON.stringify(message);

    for (const [clientId, client] of this.clients) {
      if (client.authenticated && client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(messageStr);
        } catch (error) {
          this.emit("broadcast_error", { clientId, error });
        }
      }
    }
  }

  /**
   * Store historical metrics data
   */
  private storeHistoricalData(): void {
    if (!this.config.enableHistorical) return;

    const today = new Date().toISOString().split("T")[0];
    let dayHistory = this.metricsHistory.get(today);

    if (!dayHistory) {
      dayHistory = [];
      this.metricsHistory.set(today, dayHistory);
    }

    dayHistory.push({ ...this.currentMetrics });

    // Cleanup old data
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionPeriod);

    for (const [date, history] of this.metricsHistory) {
      if (new Date(date) < cutoffDate) {
        this.metricsHistory.delete(date);
      }
    }
  }

  /**
   * Send initial data to new client
   */
  private sendInitialData(client: DashboardClient): void {
    // Send current metrics
    client.ws.send(
      JSON.stringify({
        type: "initial_metrics",
        data: this.currentMetrics,
      }),
    );

    // Send active alerts
    client.ws.send(
      JSON.stringify({
        type: "active_alerts",
        data: Array.from(this.activeAlerts.values()),
      }),
    );

    // Send configuration
    client.ws.send(
      JSON.stringify({
        type: "dashboard_config",
        data: {
          updateInterval: this.config.updateInterval,
          retentionPeriod: this.config.retentionPeriod,
          features: {
            historical: this.config.enableHistorical,
            exports: this.config.enableExports,
          },
        },
      }),
    );
  }

  /**
   * Metric collection methods (placeholder implementations)
   */
  private async getCpuMetrics() {
    // In production, use actual system monitoring
    return {
      usage: Math.random() * 100,
      cores: 8,
      loadAverage: [1.0, 1.5, 2.0],
    };
  }

  private getMemoryMetrics() {
    const memUsage = process.memoryUsage();
    return {
      used: memUsage.rss,
      total: memUsage.rss * 4, // Simplified
      heap: memUsage.heapUsed,
      external: memUsage.external,
    };
  }

  private async getNetworkMetrics() {
    return {
      bytesIn: Math.floor(Math.random() * 1000000),
      bytesOut: Math.floor(Math.random() * 1000000),
      connectionsActive: this.clients.size,
    };
  }

  private async getDiskMetrics() {
    return {
      used: Math.floor(Math.random() * 1000000000),
      total: 1000000000,
      readOps: Math.floor(Math.random() * 1000),
      writeOps: Math.floor(Math.random() * 1000),
    };
  }

  private async getAuthMetrics() {
    return {
      successful: Math.floor(Math.random() * 100),
      failed: Math.floor(Math.random() * 10),
      blocked: Math.floor(Math.random() * 5),
    };
  }

  private async getAuthzMetrics() {
    return {
      granted: Math.floor(Math.random() * 100),
      denied: Math.floor(Math.random() * 10),
      violations: Math.floor(Math.random() * 3),
    };
  }

  private async getEncryptionMetrics() {
    return {
      operations: Math.floor(Math.random() * 1000),
      keyRotations: Math.floor(Math.random() * 5),
      failures: Math.floor(Math.random() * 2),
    };
  }

  private async getThreatMetrics() {
    return {
      detected: Math.floor(Math.random() * 10),
      blocked: Math.floor(Math.random() * 8),
      severity: ["low", "medium", "high", "critical"][
        Math.floor(Math.random() * 4)
      ] as any,
    };
  }

  private async getRequestMetrics() {
    const total = Math.floor(Math.random() * 1000) + 100;
    const failed = Math.floor(Math.random() * 50);
    return {
      total,
      successful: total - failed,
      failed,
      avgResponseTime: Math.floor(Math.random() * 200) + 10,
      p95ResponseTime: Math.floor(Math.random() * 500) + 50,
      p99ResponseTime: Math.floor(Math.random() * 1000) + 100,
    };
  }

  private async getDatabaseMetrics() {
    return {
      connections: Math.floor(Math.random() * 50) + 5,
      queries: Math.floor(Math.random() * 1000) + 100,
      avgQueryTime: Math.floor(Math.random() * 100) + 5,
      slowQueries: Math.floor(Math.random() * 10),
    };
  }

  private async getCacheMetrics() {
    const hits = Math.floor(Math.random() * 1000) + 100;
    const misses = Math.floor(Math.random() * 200) + 10;
    return {
      hits,
      misses,
      hitRate: (hits / (hits + misses)) * 100,
      evictions: Math.floor(Math.random() * 50),
    };
  }

  private async getCompressionMetrics() {
    return {
      operations: Math.floor(Math.random() * 500) + 50,
      ratio: 0.65 + Math.random() * 0.2, // 65-85%
      throughput: Math.floor(Math.random() * 500) + 100, // MB/s
    };
  }

  /**
   * Helper methods
   */
  private validateConfig(config: DashboardConfig): DashboardConfig {
    return {
      ...config,
      updateInterval: Math.max(config.updateInterval, 50), // Min 50ms
      retentionPeriod: Math.max(config.retentionPeriod, 1), // Min 1 day
      alertThresholds: {
        cpuUsage: 80,
        memoryUsage: 85,
        responseTime: 1000,
        errorRate: 5,
        securityEvents: 10,
        diskUsage: 90,
        ...config.alertThresholds,
      },
    };
  }

  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getEmptySystemMetrics(): SystemMetrics {
    return {
      timestamp: new Date(),
      cpu: { usage: 0, cores: 0, loadAverage: [] },
      memory: { used: 0, total: 0, heap: 0, external: 0 },
      network: { bytesIn: 0, bytesOut: 0, connectionsActive: 0 },
      disk: { used: 0, total: 0, readOps: 0, writeOps: 0 },
    };
  }

  private getEmptySecurityMetrics(): SecurityMetrics {
    return {
      timestamp: new Date(),
      authentication: { successful: 0, failed: 0, blocked: 0 },
      authorization: { granted: 0, denied: 0, violations: 0 },
      encryption: { operations: 0, keyRotations: 0, failures: 0 },
      threats: { detected: 0, blocked: 0, severity: "low" },
    };
  }

  private getEmptyPerformanceMetrics(): PerformanceMetrics {
    return {
      timestamp: new Date(),
      requests: {
        total: 0,
        successful: 0,
        failed: 0,
        avgResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
      },
      database: { connections: 0, queries: 0, avgQueryTime: 0, slowQueries: 0 },
      cache: { hits: 0, misses: 0, hitRate: 0, evictions: 0 },
      compression: { operations: 0, ratio: 0, throughput: 0 },
    };
  }

  private handleAuthentication(client: DashboardClient, payload: any): void {
    // Placeholder authentication logic
    if (
      this.config.authentication.enabled &&
      payload.token === this.config.authentication.secret
    ) {
      client.authenticated = true;
      this.sendInitialData(client);
      client.ws.send(JSON.stringify({ type: "auth_success" }));
    } else if (!this.config.authentication.enabled) {
      client.authenticated = true;
      this.sendInitialData(client);
    } else {
      client.ws.send(
        JSON.stringify({ type: "auth_failed", message: "Invalid token" }),
      );
    }
  }

  private handleSubscription(client: DashboardClient, payload: any): void {
    // Handle subscription to specific metric types
    if (payload.channels && Array.isArray(payload.channels)) {
      client.subscriptions.push(...payload.channels);
    }
  }

  private handleUnsubscription(client: DashboardClient, payload: any): void {
    // Handle unsubscription
    if (payload.channels && Array.isArray(payload.channels)) {
      client.subscriptions = client.subscriptions.filter(
        (sub) => !payload.channels.includes(sub),
      );
    }
  }

  private handleAlertAcknowledgment(
    client: DashboardClient,
    payload: any,
  ): void {
    const alert = this.activeAlerts.get(payload.alertId);
    if (alert) {
      alert.acknowledgedBy = client.id;
      alert.resolved = true;
      alert.resolvedAt = new Date();
    }
  }

  private handleDataExport(client: DashboardClient, payload: any): void {
    if (!this.config.enableExports) {
      this.sendError(client, "Data export not enabled");
      return;
    }

    // Export historical data (placeholder)
    const exportData = {
      format: payload.format || "json",
      data: Array.from(this.metricsHistory.entries()),
      generatedAt: new Date(),
    };

    client.ws.send(
      JSON.stringify({
        type: "export_data",
        data: exportData,
      }),
    );
  }

  private sendError(client: DashboardClient, message: string): void {
    client.ws.send(
      JSON.stringify({
        type: "error",
        message,
      }),
    );
  }
}

/**
 * Factory function to create monitoring dashboard
 */
export function createRealtimeMonitoringDashboard(
  config: DashboardConfig,
): RealtimeMonitoringDashboard {
  return new RealtimeMonitoringDashboard(config);
}
