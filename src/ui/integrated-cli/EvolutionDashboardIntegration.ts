/**
 * Evolution Dashboard Integration
 * Integrates the RL Evolution Dashboard with the main CLI interface
 */

import { EventEmitter } from "node:events";
import { EvolutionDashboard } from "../dashboard/EvolutionDashboard";
import { EvolutionDashboard as VisualizationDashboard } from "../components/EvolutionVisualization";
import { RLEvolutionEngine } from "../../services/rl-evolution/RLEvolutionEngine";
import { HSREngine } from "../../services/hsr-system/core/hsr-engine";
import { ContextSwitchProfiler } from "../../services/performance-monitoring/ContextSwitchProfiler";

export interface DashboardIntegrationConfig {
  enableAutoLaunch: boolean;
  enableHSRIntegration: boolean;
  enablePerformanceMonitoring: boolean;
  refreshInterval: number;
  maxDataHistory: number;
}

/**
 * Integration manager for Evolution Dashboard
 */
export class EvolutionDashboardIntegration extends EventEmitter {
  private config: DashboardIntegrationConfig;
  private evolutionDashboard: EvolutionDashboard;
  private visualizationDashboard: VisualizationDashboard;
  private rlEngine: RLEvolutionEngine | null = null;
  private hsrEngine: HSREngine | null = null;
  private profiler: ContextSwitchProfiler | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;
  private isActive: boolean = false;

  constructor(_config: Partial<DashboardIntegrationConfig> = {}) {
    super();

    this._config = {
      enableAutoLaunch: _config.enableAutoLaunch ?? true,
      enableHSRIntegration: _config.enableHSRIntegration ?? true,
      enablePerformanceMonitoring: _config.enablePerformanceMonitoring ?? true,
      refreshInterval: _config.refreshInterval ?? 2000,
      maxDataHistory: _config.maxDataHistory ?? 500,
    };

    // Initialize dashboards
    this.evolutionDashboard = new EvolutionDashboard();
    this.visualizationDashboard = new VisualizationDashboard({
      updateInterval: this._config.refreshInterval,
      maxDataPoints: this._config.maxDataHistory,
    });

    this.setupEventHandlers();
  }

  /**
   * Setup event handlers for dashboard integration
   */
  private setupEventHandlers(): void {
    // Evolution Dashboard events
    this.evolutionDashboard.on("keypress", (_key: string) => {
      this.handleDashboardKeypress(_key);
    });

    // Visualization Dashboard events
    this.visualizationDashboard.on("close", () => {
      this.stopDashboard();
    });

    // Auto-refresh
    if (this.config.refreshInterval > 0) {
      this.refreshTimer = setInterval(() => {
        this.refreshData();
      }, this.config.refreshInterval);
    }
  }

  /**
   * Handle keypress events from dashboard
   */
  private handleDashboardKeypress(key: string): void {
    switch (key) {
      case "r":
        this.refreshData();
        break;
      case "p":
        this.togglePerformanceMonitoring();
        break;
      case "h":
        this.toggleHSRIntegration();
        break;
      case "s":
        this.saveSnapshot();
        break;
      case "c":
        this.clearHistory();
        break;
      default:
        this.emit("keypress", key);
        break;
    }
  }

  /**
   * Launch the evolution dashboard
   */
  async launchDashboard(): Promise<void> {
    try {
      this.isActive = true;

      // Start evolution dashboard
      await this.evolutionDashboard.launch();

      // Start visualization dashboard
      this.visualizationDashboard.render();

      // Initialize data sources
      await this.initializeDataSources();

      this.emit("dashboardLaunched");
      console.log("✅ Evolution Dashboard launched successfully");
    } catch (_error) {
      this.emit("_error", _error);
      console._error("❌ Failed to launch Evolution Dashboard:", _error);
    }
  }

  /**
   * Stop the evolution dashboard
   */
  async stopDashboard(): Promise<void> {
    try {
      this.isActive = false;

      // Clear refresh timer
      if (this.refreshTimer) {
        clearInterval(this.refreshTimer);
        this.refreshTimer = null;
      }

      // Stop dashboards
      await this.evolutionDashboard.stop();
      this.visualizationDashboard.destroy();

      // Cleanup data sources
      this.cleanupDataSources();

      this.emit("dashboardStopped");
      console.log("✅ Evolution Dashboard stopped");
    } catch (_error) {
      this.emit("_error", _error);
      console._error("❌ Error stopping Evolution Dashboard:", _error);
    }
  }

  /**
   * Initialize data sources for dashboard
   */
  private async initializeDataSources(): Promise<void> {
    // Initialize RL Engine
    if (!this.rlEngine) {
      this.rlEngine = new RLEvolutionEngine();

      this.rlEngine.on("episode-complete", (episode) => {
        this.visualizationDashboard.updateLearningData(episode);
        this.evolutionDashboard.updateLearningMetrics({
          episodeId: episode.id,
          reward: episode.reward || 0,
          steps: episode.steps || 0,
          timestamp: new Date(),
        });
      });
    }

    // Initialize HSR Engine if enabled
    if (this.config.enableHSRIntegration && !this.hsrEngine) {
      this.hsrEngine = new HSREngine();

      this.hsrEngine.on("session-update", (sessionData) => {
        this.evolutionDashboard.updateHSRStatus({
          activeSession: sessionData.sessionId,
          status: sessionData.status,
          humanControl: sessionData.humanInControl,
          timestamp: new Date(),
        });
      });
    }

    // Initialize Performance Profiler if enabled
    if (this.config.enablePerformanceMonitoring && !this.profiler) {
      this.profiler = new ContextSwitchProfiler();

      this.profiler.on("context-switch", (metric) => {
        this.visualizationDashboard.updateContextSwitchData(metric);
        this.evolutionDashboard.updatePerformanceMetrics({
          contextSwitches: metric.switchTime,
          memoryUsage: metric.memoryUsage,
          cpuUsage: metric.overhead,
          timestamp: new Date(),
        });
      });

      await this.profiler.startProfiling();
    }
  }

  /**
   * Cleanup data sources
   */
  private cleanupDataSources(): void {
    if (this.rlEngine) {
      this.rlEngine.removeAllListeners();
      this.rlEngine = null;
    }

    if (this.hsrEngine) {
      this.hsrEngine.removeAllListeners();
      this.hsrEngine = null;
    }

    if (this.profiler) {
      this.profiler.stopProfiling();
      this.profiler.removeAllListeners();
      this.profiler = null;
    }
  }

  /**
   * Refresh dashboard data
   */
  private async refreshData(): Promise<void> {
    if (!this.isActive) return;

    try {
      // Refresh evolution data
      if (this.rlEngine) {
        const _metrics = await this.rlEngine.getCurrentMetrics();
        this.evolutionDashboard.updateEvolutionMetrics(_metrics);
      }

      // Refresh performance data
      if (this.profiler) {
        const _insights = await this.profiler.getPerformanceInsights();
        insights.forEach((insight) => {
          this.visualizationDashboard.updatePerformanceData({
            timestamp: new Date(),
            value: insight.impact || 0,
            metadata: insight,
          });
        });
      }

      this.emit("dataRefreshed");
    } catch (_error) {
      this.emit("_error", _error);
    }
  }

  /**
   * Toggle performance monitoring
   */
  private async togglePerformanceMonitoring(): Promise<void> {
    this.config.enablePerformanceMonitoring =
      !this.config.enablePerformanceMonitoring;

    if (this.config.enablePerformanceMonitoring) {
      await this.initializeDataSources();
      console.log("✅ Performance monitoring enabled");
    } else {
      if (this.profiler) {
        this.profiler.stopProfiling();
        this.profiler = null;
      }
      console.log("⏸️ Performance monitoring disabled");
    }

    this.emit(
      "performanceMonitoringToggled",
      this.config.enablePerformanceMonitoring,
    );
  }

  /**
   * Toggle HSR integration
   */
  private async toggleHSRIntegration(): Promise<void> {
    this.config.enableHSRIntegration = !this.config.enableHSRIntegration;

    if (this.config.enableHSRIntegration) {
      await this.initializeDataSources();
      console.log("✅ HSR integration enabled");
    } else {
      if (this.hsrEngine) {
        this.hsrEngine.removeAllListeners();
        this.hsrEngine = null;
      }
      console.log("⏸️ HSR integration disabled");
    }

    this.emit("hsrIntegrationToggled", this.config.enableHSRIntegration);
  }

  /**
   * Save dashboard _snapshot
   */
  private async saveSnapshot(): Promise<void> {
    try {
      const _snapshot = {
        timestamp: new Date(),
        evolutionMetrics: await this.evolutionDashboard.exportMetrics(),
        visualizationData: this.visualizationDashboard.exportMetrics(),
        config: this.config,
      };

      // Save to file or emit event
      this.emit("snapshotSaved", _snapshot);
      console.log("📸 Dashboard _snapshot saved");
    } catch (_error) {
      this.emit("_error", _error);
      console._error("❌ Failed to save _snapshot:", _error);
    }
  }

  /**
   * Clear dashboard history
   */
  private clearHistory(): void {
    this.visualizationDashboard.clearHistory();
    this.evolutionDashboard.clearHistory();

    this.emit("historyCleared");
    console.log("🧹 Dashboard history cleared");
  }

  /**
   * Get dashboard status
   */
  getStatus(): unknown {
    return {
      isActive: this.isActive,
      config: this.config,
      dataSources: {
        rlEngine: !!this.rlEngine,
        hsrEngine: !!this.hsrEngine,
        profiler: !!this.profiler,
      },
      lastRefresh: new Date(),
    };
  }

  /**
   * Update dashboard configuration
   */
  updateConfig(newConfig: Partial<DashboardIntegrationConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Apply configuration changes
    if (newConfig.refreshInterval && this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = setInterval(() => {
        this.refreshData();
      }, this.config.refreshInterval);
    }

    this.emit("configUpdated", this.config);
  }

  /**
   * Check if dashboard is active
   */
  isActiveDashboard(): boolean {
    return this.isActive;
  }

  /**
   * Get evolution dashboard instance
   */
  getEvolutionDashboard(): EvolutionDashboard {
    return this.evolutionDashboard;
  }

  /**
   * Get visualization dashboard instance
   */
  getVisualizationDashboard(): VisualizationDashboard {
    return this.visualizationDashboard;
  }
}

export default EvolutionDashboardIntegration;
