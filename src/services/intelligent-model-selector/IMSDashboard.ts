/**
 * IMS Dashboard - Phase 3 Real-time Monitoring Dashboard
 * Provides comprehensive visualization of IMS performance with heatmaps and analytics
 * Real-time monitoring with WebSocket support for live updates
 */

import { EventEmitter } from 'events';
import type { Server } from 'http';
import type { AdvancedTTFBMonitor, TTFBHeatmapData, TTFBAlert } from './AdvancedTTFBMonitor.js';
import type { GoldenDatasetMonitor, DailyReproductionReport } from './GoldenDatasetMonitor.js';
import type { CompleteDecisionLogger } from './CompleteDecisionLogger.js';
import type { AdminAPI } from './AdminAPI.js';

export interface DashboardConfig {
  server: {
    port: number;
    host: string;
    enableWebSocket: boolean;
  };
  features: {
    enableTTFBHeatmaps: boolean;
    enableReproductionCharts: boolean;
    enableRealTimeAlerts: boolean;
    enablePerformanceTrends: boolean;
  };
  updateIntervals: {
    heatmapUpdateMs: number;    // How often to update heatmaps (default: 5000ms)
    metricsUpdateMs: number;    // How often to update metrics (default: 2000ms)
    alertCheckMs: number;       // How often to check alerts (default: 1000ms)
  };
  retention: {
    realtimeDataPoints: number; // How many real-time data points to keep (default: 1000)
    historicalDays: number;     // How many days of historical data to show (default: 30)
  };
}

export interface DashboardMetrics {
  timestamp: number;
  
  // Overall system health
  systemHealth: {
    status: 'healthy' | 'degraded' | 'critical';
    overallScore: number; // 0-1
    activeAlerts: number;
    reproductionRate: number; // 0-1
  };
  
  // TTFB Performance
  ttfbMetrics: {
    current: {
      auth: number;
      cache: number;
      rules: number;
      select: number;
      flush: number;
      total: number;
    };
    budgetCompliance: {
      auth: boolean;
      cache: boolean;
      rules: boolean;
      select: boolean;
      flush: boolean;
      total: boolean;
    };
    trends: {
      improving: string[];
      degrading: string[];
    };
  };
  
  // Decision Quality
  decisionMetrics: {
    totalDecisions: number;
    successRate: number;
    averageConfidence: number;
    fallbackRate: number;
    topModels: Array<{
      modelId: string;
      count: number;
      successRate: number;
    }>;
  };
  
  // Cost Analysis
  costMetrics: {
    totalCostUsd: number;
    averageCostPerRequest: number;
    costTrends: {
      hourly: number[];
      daily: number[];
    };
    savingsFromOptimization: number;
  };
}

export interface HeatmapVisualization {
  title: string;
  timeRange: { start: number; end: number };
  data: Array<{
    timestamp: number;
    component: string;
    value: number;
    status: 'good' | 'warning' | 'critical';
  }>;
  thresholds: {
    warning: number;
    critical: number;
  };
}

export interface ReproductionChart {
  title: string;
  timeRange: { start: number; end: number };
  data: Array<{
    date: string;
    reproductionRate: number;
    totalTests: number;
    failedTests: number;
    categories: Record<string, {
      rate: number;
      count: number;
    }>;
  }>;
}

export class IMSDashboard extends EventEmitter {
  private server?: Server;
  private wsServer?: any; // WebSocket server
  private connectedClients = new Set<any>();
  
  private readonly realtimeMetrics: DashboardMetrics[] = [];
  private metricsUpdateTimer?: NodeJS.Timeout;
  private heatmapUpdateTimer?: NodeJS.Timeout;
  private alertCheckTimer?: NodeJS.Timeout;

  constructor(
    private readonly config: DashboardConfig,
    private readonly dependencies: {
      ttfbMonitor: AdvancedTTFBMonitor;
      goldenDatasetMonitor: GoldenDatasetMonitor;
      decisionLogger: CompleteDecisionLogger;
      adminAPI: AdminAPI;
    }
  ) {
    super();
    
    this.setupEventListeners();
  }

  /**
   * Start the dashboard server
   */
  async startServer(): Promise<void> {
    const express = await import('express');
    const http = await import('http');
    
    const app = express.default();
    app.use(express.default.json());
    app.use(express.default.static('public')); // Serve static dashboard files
    
    // API endpoints
    this.setupAPIRoutes(app);
    
    this.server = http.createServer(app);
    
    if (this.config.server.enableWebSocket) {
      await this.setupWebSocket();
    }
    
    return new Promise((resolve, reject) => {
      this.server!.listen(this.config.server.port, this.config.server.host, () => {
        this.emit('serverStarted', {
          host: this.config.server.host,
          port: this.config.server.port,
          webSocketEnabled: this.config.server.enableWebSocket
        });
        
        this.startUpdateTimers();
        resolve();
      });
      
      this.server!.on('error', reject);
    });
  }

  /**
   * Setup API routes for the dashboard
   */
  private setupAPIRoutes(app: any): void {
    // Real-time metrics endpoint
    app.get('/api/metrics/realtime', (req: any, res: any) => {
      const latest = this.realtimeMetrics[this.realtimeMetrics.length - 1];
      res.json(latest || this.getEmptyMetrics());
    });
    
    // Historical metrics endpoint
    app.get('/api/metrics/historical', (req: any, res: any) => {
      const hours = parseInt(req.query.hours) || 24;
      const cutoff = Date.now() - (hours * 3600000);
      const historicalData = this.realtimeMetrics.filter(m => m.timestamp > cutoff);
      res.json(historicalData);
    });
    
    // TTFB heatmap data
    app.get('/api/heatmap/ttfb', (req: any, res: any) => {
      const timeRange = parseInt(req.query.timeRange) || 3600000; // 1 hour default
      const heatmapData = this.dependencies.ttfbMonitor.getHeatmapData(timeRange);
      const visualization = this.transformToHeatmapVisualization(heatmapData);
      res.json(visualization);
    });
    
    // Reproduction rate chart
    app.get('/api/charts/reproduction', (req: any, res: any) => {
      const days = parseInt(req.query.days) || 7;
      const chartData = this.generateReproductionChart(days);
      res.json(chartData);
    });
    
    // Active alerts
    app.get('/api/alerts/active', (req: any, res: any) => {
      const alerts = this.dependencies.ttfbMonitor.getCurrentAlerts();
      res.json(alerts);
    });
    
    // System health summary
    app.get('/api/health/summary', (req: any, res: any) => {
      const summary = this.generateHealthSummary();
      res.json(summary);
    });
    
    // Performance recommendations
    app.get('/api/recommendations', (req: any, res: any) => {
      const ttfbRecommendations = this.dependencies.ttfbMonitor.generateOptimizationRecommendations();
      const dailyReport = this.dependencies.goldenDatasetMonitor.getDailyReport();
      
      const combinedRecommendations = {
        performance: ttfbRecommendations,
        reproduction: dailyReport?.recommendations || { immediate: [], shortTerm: [], longTerm: [] }
      };
      
      res.json(combinedRecommendations);
    });
    
    // Decision analytics
    app.get('/api/analytics/decisions', async (req: any, res: any) => {
      try {
        const timeRange = {
          startDate: new Date(Date.now() - (24 * 3600000)), // 24 hours ago
          endDate: new Date()
        };
        const analytics = await this.dependencies.decisionLogger.generateAnalytics(timeRange);
        res.json(analytics);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
  }

  /**
   * Setup WebSocket for real-time updates
   */
  private async setupWebSocket(): Promise<void> {
    const { Server: SocketIOServer } = await import('socket.io');
    
    this.wsServer = new SocketIOServer(this.server, {
      cors: {
        origin: "*", // Configure appropriately for production
        methods: ["GET", "POST"]
      }
    });
    
    this.wsServer.on('connection', (socket: any) => {
      this.connectedClients.add(socket);
      
      // Send current data to new client
      const currentMetrics = this.realtimeMetrics[this.realtimeMetrics.length - 1];
      if (currentMetrics) {
        socket.emit('metrics:update', currentMetrics);
      }
      
      socket.on('disconnect', () => {
        this.connectedClients.delete(socket);
      });
      
      // Handle client requests for specific data
      socket.on('request:heatmap', (params: any) => {
        const heatmapData = this.dependencies.ttfbMonitor.getHeatmapData(params.timeRange || 3600000);
        const visualization = this.transformToHeatmapVisualization(heatmapData);
        socket.emit('heatmap:update', visualization);
      });
      
      socket.on('request:alerts', () => {
        const alerts = this.dependencies.ttfbMonitor.getCurrentAlerts();
        socket.emit('alerts:update', alerts);
      });
    });
    
    this.emit('webSocketReady', { connectedClients: 0 });
  }

  /**
   * Setup event listeners for real-time updates
   */
  private setupEventListeners(): void {
    // Listen for TTFB measurements
    this.dependencies.ttfbMonitor.on('measurementRecorded', (data) => {
      this.broadcastToClients('ttfb:measurement', data);
    });
    
    // Listen for alerts
    this.dependencies.ttfbMonitor.on('alertTriggered', (alert: TTFBAlert) => {
      this.broadcastToClients('alert:new', alert);
      this.emit('alertReceived', alert);
    });
    
    // Listen for trend changes
    this.dependencies.ttfbMonitor.on('trendDegradation', (trend) => {
      this.broadcastToClients('trend:degradation', trend);
    });
    
    // Listen for daily test results
    this.dependencies.goldenDatasetMonitor.on('dailyTestsCompleted', (report: DailyReproductionReport) => {
      this.broadcastToClients('reproduction:dailyReport', report);
      this.emit('dailyReportReceived', report);
    });
    
    // Listen for individual test completions
    this.dependencies.goldenDatasetMonitor.on('testCaseCompleted', (result) => {
      this.broadcastToClients('reproduction:testCompleted', result);
    });
  }

  /**
   * Start update timers for real-time metrics
   */
  private startUpdateTimers(): void {
    // Update metrics regularly
    this.metricsUpdateTimer = setInterval(() => {
      const metrics = this.generateCurrentMetrics();
      this.realtimeMetrics.push(metrics);
      
      // Keep only recent metrics
      if (this.realtimeMetrics.length > this.config.retention.realtimeDataPoints) {
        this.realtimeMetrics.shift();
      }
      
      this.broadcastToClients('metrics:update', metrics);
    }, this.config.updateIntervals.metricsUpdateMs);
    
    // Update heatmaps
    if (this.config.features.enableTTFBHeatmaps) {
      this.heatmapUpdateTimer = setInterval(() => {
        const heatmapData = this.dependencies.ttfbMonitor.getHeatmapData();
        const visualization = this.transformToHeatmapVisualization(heatmapData);
        this.broadcastToClients('heatmap:update', visualization);
      }, this.config.updateIntervals.heatmapUpdateMs);
    }
    
    // Check alerts
    if (this.config.features.enableRealTimeAlerts) {
      this.alertCheckTimer = setInterval(() => {
        const alerts = this.dependencies.ttfbMonitor.getCurrentAlerts();
        this.broadcastToClients('alerts:update', alerts);
      }, this.config.updateIntervals.alertCheckMs);
    }
  }

  /**
   * Generate current metrics snapshot
   */
  private generateCurrentMetrics(): DashboardMetrics {
    const ttfbSummary = this.dependencies.ttfbMonitor.getPerformanceSummary();
    const reproductionReport = this.dependencies.goldenDatasetMonitor.getDailyReport();
    const alerts = this.dependencies.ttfbMonitor.getCurrentAlerts();
    
    // Calculate system health score
    const ttfbScore = ttfbSummary.overall.budgetComplianceRate;
    const reproductionScore = reproductionReport?.summary.overallHealthScore || 1.0;
    const alertPenalty = Math.min(alerts.length * 0.1, 0.5); // Max 50% penalty for alerts
    const overallScore = Math.max(0, (ttfbScore + reproductionScore) / 2 - alertPenalty);
    
    let systemStatus: 'healthy' | 'degraded' | 'critical';
    if (overallScore > 0.8) systemStatus = 'healthy';
    else if (overallScore > 0.6) systemStatus = 'degraded';
    else systemStatus = 'critical';

    return {
      timestamp: Date.now(),
      systemHealth: {
        status: systemStatus,
        overallScore,
        activeAlerts: alerts.length,
        reproductionRate: reproductionScore
      },
      ttfbMetrics: {
        current: {
          auth: ttfbSummary.byComponent.auth?.averageLatency || 0,
          cache: ttfbSummary.byComponent.cache?.averageLatency || 0,
          rules: ttfbSummary.byComponent.rules?.averageLatency || 0,
          select: ttfbSummary.byComponent.select?.averageLatency || 0,
          flush: ttfbSummary.byComponent.flush?.averageLatency || 0,
          total: ttfbSummary.overall.averageLatency
        },
        budgetCompliance: {
          auth: (ttfbSummary.byComponent.auth?.budgetComplianceRate || 1.0) > 0.8,
          cache: (ttfbSummary.byComponent.cache?.budgetComplianceRate || 1.0) > 0.8,
          rules: (ttfbSummary.byComponent.rules?.budgetComplianceRate || 1.0) > 0.8,
          select: (ttfbSummary.byComponent.select?.budgetComplianceRate || 1.0) > 0.8,
          flush: (ttfbSummary.byComponent.flush?.budgetComplianceRate || 1.0) > 0.8,
          total: ttfbSummary.overall.budgetComplianceRate > 0.8
        },
        trends: {
          improving: Object.entries(ttfbSummary.byComponent)
            .filter(([, metrics]) => metrics.trend === 'improving')
            .map(([component]) => component),
          degrading: Object.entries(ttfbSummary.byComponent)
            .filter(([, metrics]) => metrics.trend === 'degrading')
            .map(([component]) => component)
        }
      },
      decisionMetrics: {
        totalDecisions: ttfbSummary.overall.totalMeasurements,
        successRate: 0.95, // Would come from actual success tracking
        averageConfidence: 0.85, // Would come from decision confidence scores
        fallbackRate: 0.05, // Would come from fallback usage tracking
        topModels: [] // Would come from model usage analytics
      },
      costMetrics: {
        totalCostUsd: 0, // Would come from cost tracking
        averageCostPerRequest: 0.002, // Would come from cost analytics
        costTrends: {
          hourly: new Array(24).fill(0.1), // Mock data
          daily: new Array(7).fill(2.4) // Mock data
        },
        savingsFromOptimization: 0.25 // Would come from optimization tracking
      }
    };
  }

  /**
   * Transform TTFB heatmap data for visualization
   */
  private transformToHeatmapVisualization(heatmapData: TTFBHeatmapData): HeatmapVisualization[] {
    const components = ['auth', 'cache', 'rules', 'select', 'flush', 'total'];
    const visualizations: HeatmapVisualization[] = [];
    
    for (const component of components) {
      const data = heatmapData.timeSlots.flatMap(slot => 
        slot[component as keyof typeof slot].map((value: number) => ({
          timestamp: slot.timestamp,
          component,
          value,
          status: this.getStatusFromValue(value, component) as 'good' | 'warning' | 'critical'
        }))
      );
      
      visualizations.push({
        title: `${component.toUpperCase()} Performance Heatmap`,
        timeRange: {
          start: Math.min(...heatmapData.timeSlots.map(s => s.timestamp)),
          end: Math.max(...heatmapData.timeSlots.map(s => s.timestamp))
        },
        data,
        thresholds: this.getThresholds(component)
      });
    }
    
    return visualizations;
  }

  private getStatusFromValue(value: number, component: string): string {
    const thresholds = this.getThresholds(component);
    if (value > thresholds.critical) return 'critical';
    if (value > thresholds.warning) return 'warning';
    return 'good';
  }

  private getThresholds(component: string): { warning: number; critical: number } {
    const baseThresholds: Record<string, { warning: number; critical: number }> = {
      auth: { warning: 50, critical: 80 },
      cache: { warning: 25, critical: 40 },
      rules: { warning: 15, critical: 25 },
      select: { warning: 15, critical: 25 },
      flush: { warning: 150, critical: 200 },
      total: { warning: 600, critical: 800 }
    };
    
    return baseThresholds[component] || { warning: 100, critical: 200 };
  }

  /**
   * Generate reproduction rate chart data
   */
  private generateReproductionChart(days: number): ReproductionChart {
    const chartData = [];
    const today = new Date();
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today.getTime() - (i * 86400000));
      const dateStr = date.toISOString().split('T')[0];
      const report = this.dependencies.goldenDatasetMonitor.getDailyReport(dateStr);
      
      if (report) {
        chartData.push({
          date: dateStr,
          reproductionRate: report.summary.overallHealthScore,
          totalTests: report.summary.totalTests,
          failedTests: report.summary.failedTests,
          categories: report.byCategory
        });
      } else {
        // Fill with default data if no report available
        chartData.push({
          date: dateStr,
          reproductionRate: 1.0,
          totalTests: 0,
          failedTests: 0,
          categories: {}
        });
      }
    }
    
    return {
      title: 'Reproduction Rate Trends',
      timeRange: {
        start: chartData[0]?.date ? new Date(chartData[0].date).getTime() : Date.now(),
        end: chartData[chartData.length - 1]?.date ? new Date(chartData[chartData.length - 1].date).getTime() : Date.now()
      },
      data: chartData
    };
  }

  /**
   * Generate system health summary
   */
  private generateHealthSummary(): {
    overall: { status: string; score: number };
    components: Record<string, { status: string; score: number; issues: string[] }>;
    uptime: number;
    lastUpdate: number;
  } {
    const currentMetrics = this.realtimeMetrics[this.realtimeMetrics.length - 1] || this.getEmptyMetrics();
    
    return {
      overall: {
        status: currentMetrics.systemHealth.status,
        score: currentMetrics.systemHealth.overallScore
      },
      components: {
        ttfb: {
          status: currentMetrics.systemHealth.status,
          score: currentMetrics.ttfbMetrics.budgetCompliance.total ? 1.0 : 0.5,
          issues: currentMetrics.ttfbMetrics.trends.degrading.map(c => `${c} component degrading`)
        },
        reproduction: {
          status: currentMetrics.systemHealth.reproductionRate > 0.9 ? 'healthy' : 'degraded',
          score: currentMetrics.systemHealth.reproductionRate,
          issues: []
        },
        alerts: {
          status: currentMetrics.systemHealth.activeAlerts === 0 ? 'healthy' : 'warning',
          score: Math.max(0, 1.0 - (currentMetrics.systemHealth.activeAlerts * 0.2)),
          issues: [`${currentMetrics.systemHealth.activeAlerts} active alerts`]
        }
      },
      uptime: Date.now() - (this.realtimeMetrics[0]?.timestamp || Date.now()), // Rough uptime
      lastUpdate: currentMetrics.timestamp
    };
  }

  /**
   * Broadcast data to all connected WebSocket clients
   */
  private broadcastToClients(event: string, data: any): void {
    if (!this.wsServer) return;
    
    this.wsServer.emit(event, data);
    this.emit('dataBroadcast', { event, clientCount: this.connectedClients.size });
  }

  /**
   * Get empty metrics structure
   */
  private getEmptyMetrics(): DashboardMetrics {
    return {
      timestamp: Date.now(),
      systemHealth: {
        status: 'healthy',
        overallScore: 1.0,
        activeAlerts: 0,
        reproductionRate: 1.0
      },
      ttfbMetrics: {
        current: { auth: 0, cache: 0, rules: 0, select: 0, flush: 0, total: 0 },
        budgetCompliance: { auth: true, cache: true, rules: true, select: true, flush: true, total: true },
        trends: { improving: [], degrading: [] }
      },
      decisionMetrics: {
        totalDecisions: 0,
        successRate: 1.0,
        averageConfidence: 1.0,
        fallbackRate: 0,
        topModels: []
      },
      costMetrics: {
        totalCostUsd: 0,
        averageCostPerRequest: 0,
        costTrends: { hourly: [], daily: [] },
        savingsFromOptimization: 0
      }
    };
  }

  /**
   * Stop the dashboard server
   */
  async stopServer(): Promise<void> {
    // Clear timers
    if (this.metricsUpdateTimer) {
      clearInterval(this.metricsUpdateTimer);
      this.metricsUpdateTimer = undefined;
    }
    
    if (this.heatmapUpdateTimer) {
      clearInterval(this.heatmapUpdateTimer);
      this.heatmapUpdateTimer = undefined;
    }
    
    if (this.alertCheckTimer) {
      clearInterval(this.alertCheckTimer);
      this.alertCheckTimer = undefined;
    }
    
    // Close WebSocket server
    if (this.wsServer) {
      this.wsServer.close();
      this.wsServer = undefined;
    }
    
    // Close HTTP server
    if (this.server) {
      return new Promise((resolve) => {
        this.server!.close(() => {
          this.server = undefined;
          this.emit('serverStopped');
          resolve();
        });
      });
    }
    // If no server to close, return resolved promise
    return Promise.resolve();
  }

  /**
   * Get current dashboard statistics
   */
  getDashboardStats(): {
    connectedClients: number;
    metricsBufferSize: number;
    uptime: number;
    totalBroadcasts: number;
  } {
    return {
      connectedClients: this.connectedClients.size,
      metricsBufferSize: this.realtimeMetrics.length,
      uptime: this.realtimeMetrics.length > 0 ? 
        Date.now() - this.realtimeMetrics[0].timestamp : 0,
      totalBroadcasts: 0 // Would track in real implementation
    };
  }

  /**
   * Cleanup method
   */
  async cleanup(): Promise<void> {
    await this.stopServer();
    this.connectedClients.clear();
    this.realtimeMetrics.length = 0;
    this.emit('cleanup');
  }
}