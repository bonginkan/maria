/**
 * Dashboard Command - Launch Evolution monitoring dashboard
 * Provides real-time visualization of RL system performance
 */

import { CommandArgs, CommandContext, CommandResult } from "../../types";
import { RLEvolutionEngine } from "../../../services/rl-evolution/RLEvolutionEngine";
import { RealTimeLearning } from "../../../services/rl-evolution/RealTimeLearning";
import { EvolutionReporter } from "../../../services/rl-evolution/EvolutionReporter";
import EvolutionDashboard, {
  DashboardConfig,
} from "../../../ui/dashboard/EvolutionDashboard";
import { Logger } from "../../../utils/logger";

export class DashboardCommand {
  private static instance: DashboardCommand;
  private activeDashboard: EvolutionDashboard | null = null;

  public static getInstance(): DashboardCommand {
    if (!DashboardCommand.instance) {
      DashboardCommand.instance = new DashboardCommand();
    }
    return DashboardCommand.instance;
  }

  async handle(
    _args: CommandArgs,
    context: CommandContext,
  ): Promise<CommandResult> {
    try {
      const _subcommand = _args._subcommand || "launch";

      switch (_subcommand) {
        case "launch":
        case "start":
          return await this.launchDashboard(_args, context);

        case "stop":
        case "close":
          return await this.stopDashboard(_args, context);

        case "status":
          return await this.getDashboardStatus(_args, context);

        case "_config":
          return await this.configureDashboard(_args, context);

        case "export":
          return await this.exportDashboardData(_args, context);

        default:
          return {
            success: false,
            message: `Unknown dashboard _subcommand: ${_subcommand}`,
            data: {
              availableCommands: [
                "launch/start - Launch the evolution dashboard",
                "stop/close - Stop the active dashboard",
                "status - Show dashboard status",
                "_config - Configure dashboard settings",
                "export - Export dashboard data",
              ],
            },
          };
      }
    } catch (_error: unknown) {
      Logger._error("Dashboard command failed:", _error);
      return {
        success: false,
        message: `Dashboard command failed: ${_error.message}`,
        _error: _error.message,
      };
    }
  }

  private async launchDashboard(
    _args: CommandArgs,
    context: CommandContext,
  ): Promise<CommandResult> {
    if (this.activeDashboard) {
      return {
        success: false,
        message:
          "Dashboard is already active. Use `/dashboard stop` to close it first.",
        data: {
          status: "already_active",
        },
      };
    }

    try {
      // Get or create RL engine instance
      const _rlEngine = await this.getRLEngine(context);
      const _evolutionReporter = await this.getEvolutionReporter(context);

      // Parse dashboard configuration
      const _config = this.parseDashboardConfig(_args);

      // Create dashboard
      this.activeDashboard = new EvolutionDashboard(
        _rlEngine,
        _evolutionReporter,
        _config,
      );

      // Set up real-time learning if available
      const _realTimeLearning = await this.getRealTimeLearning(
        context,
        _rlEngine,
      );
      if (_realTimeLearning) {
        this.activeDashboard.setRealTimeLearning(_realTimeLearning);
      }

      // Set up event handlers
      this.setupDashboardEventHandlers();

      // Start dashboard
      await this.activeDashboard.start();

      Logger.info("Evolution Dashboard launched successfully");

      return {
        success: true,
        message:
          "Evolution Dashboard launched successfully! Press ESC or Ctrl+C to exit.",
        data: {
          status: "launched",
          _config,
          keyBindings: {
            "ESC/Q/Ctrl+C": "Exit dashboard",
            R: "Refresh now",
            P: "Toggle pause",
            C: "Clear history",
            S: "Export snapshot",
          },
          panels: [
            "Performance Metrics",
            "Context Switches",
            "Real-time Learning",
            "Evolution Progress",
            "Safety Status",
            "Alerts & Notifications",
            "System Logs",
          ],
        },
      };
    } catch (_error: unknown) {
      Logger._error("Failed to launch dashboard:", _error);
      return {
        success: false,
        message: `Failed to launch dashboard: ${_error.message}`,
        _error: _error.message,
      };
    }
  }

  private async stopDashboard(
    _args: CommandArgs,
    _context: CommandContext,
  ): Promise<CommandResult> {
    if (!this.activeDashboard) {
      return {
        success: false,
        message: "No active dashboard to stop.",
        data: {
          status: "not_active",
        },
      };
    }

    try {
      this.activeDashboard.stop();
      this.activeDashboard = null;

      Logger.info("Evolution Dashboard stopped");

      return {
        success: true,
        message: "Evolution Dashboard stopped successfully",
        data: {
          status: "stopped",
        },
      };
    } catch (_error: unknown) {
      Logger._error("Failed to stop dashboard:", _error);
      return {
        success: false,
        message: `Failed to stop dashboard: ${_error.message}`,
        _error: _error.message,
      };
    }
  }

  private async getDashboardStatus(
    _args: CommandArgs,
    _context: CommandContext,
  ): Promise<CommandResult> {
    const _isActive = this.activeDashboard !== null;

    if (!_isActive) {
      return {
        success: true,
        message: "No dashboard currently active",
        data: {
          status: "inactive",
          lastActive: null,
        },
      };
    }

    const _metrics = this.activeDashboard.getCurrentMetrics();
    const _contextSwitchHistory =
      this.activeDashboard.getContextSwitchHistory();

    return {
      success: true,
      message: "Dashboard is active and monitoring",
      data: {
        status: "active",
        currentMetrics: _metrics,
        recentContextSwitches: _contextSwitchHistory.slice(-5),
        panels: {
          performance: "📊 Real-time performance monitoring",
          contextSwitches: "🔄 Context switch overhead tracking",
          _realTimeLearning: "⚡ Live learning adaptation",
          evolution: "🧬 RL system evolution progress",
          safety: "🛡️ Safety validation status",
          alerts: "🚨 System alerts and notifications",
          logs: "📝 Detailed system logging",
        },
      },
    };
  }

  private async configureDashboard(
    _args: CommandArgs,
    _context: CommandContext,
  ): Promise<CommandResult> {
    const _config = this.parseDashboardConfig(_args);

    return {
      success: true,
      message: "Dashboard configuration updated",
      data: {
        _config,
        status: "configured",
      },
    };
  }

  private async exportDashboardData(
    _args: CommandArgs,
    _context: CommandContext,
  ): Promise<CommandResult> {
    if (!this.activeDashboard) {
      return {
        success: false,
        message: "No active dashboard to export data from",
        data: {
          status: "not_active",
        },
      };
    }

    try {
      const _format = _args.options?.["_format"] || "json";
      const _includeHistory = _args.options?.["include-history"] !== false;

      const _exportData = {
        timestamp: new Date(),
        currentMetrics: this.activeDashboard.getCurrentMetrics(),
        _contextSwitchHistory: _includeHistory
          ? this.activeDashboard.getContextSwitchHistory()
          : this.activeDashboard.getContextSwitchHistory().slice(-10),
        exportFormat: _format,
        dashboardVersion: "1.0.0",
      };

      const _filename = `evolution-dashboard-export-${Date.now()}.${_format}`;

      return {
        success: true,
        message: `Dashboard data exported successfully`,
        data: {
          _filename,
          _format,
          recordCount: {
            contextSwitches: _exportData.contextSwitchHistory.length,
            exportSize: JSON.stringify(_exportData).length,
          },
          _exportData: _format === "preview" ? _exportData : undefined,
        },
      };
    } catch (_error: unknown) {
      Logger._error("Failed to export dashboard data:", _error);
      return {
        success: false,
        message: `Failed to export dashboard data: ${_error.message}`,
        _error: _error.message,
      };
    }
  }

  private parseDashboardConfig(args: CommandArgs): Partial<DashboardConfig> {
    const _config: Partial<DashboardConfig> = {};

    if (args.options?.["refresh"]) {
      const _interval = parseInt(args.options["refresh"] as string, 10);
      if (!isNaN(_interval) && _interval >= 100) {
        config.refreshInterval = _interval;
      }
    }

    if (args.options?.["max-data"]) {
      const _maxData = parseInt(args.options["max-data"] as string, 10);
      if (!isNaN(_maxData) && _maxData > 0) {
        config.maxDataPoints = _maxData;
      }
    }

    if (args.options?.["advanced"] !== undefined) {
      config.showAdvancedMetrics = args.options["advanced"] === "true";
    }

    if (args.options?.["alerts"] !== undefined) {
      config.enableAlerts = args.options["alerts"] === "true";
    }

    return _config;
  }

  private async getRLEngine(
    _context: CommandContext,
  ): Promise<RLEvolutionEngine> {
    return new RLEvolutionEngine({
      learningRate: 0.001,
      batchSize: 16,
      replayBufferSize: 1000,
      updateFrequency: "on-demand",
    });
  }

  private async getEvolutionReporter(
    _context: CommandContext,
  ): Promise<EvolutionReporter> {
    const _reporter = new EvolutionReporter();
    await _reporter.initialize();
    return _reporter;
  }

  private async getRealTimeLearning(
    _context: CommandContext,
    _rlEngine: RLEvolutionEngine,
  ): Promise<RealTimeLearning | null> {
    try {
      return new RealTimeLearning(_rlEngine, {
        enabled: true,
        mode: "balanced",
        updateFrequency: 5,
      });
    } catch (_error: unknown) {
      Logger.warn(
        "Could not initialize real-time learning for dashboard:",
        _error.message,
      );
      return null;
    }
  }

  private setupDashboardEventHandlers(): void {
    if (!this.activeDashboard) return;

    this.activeDashboard.on("stopped", () => {
      Logger.info("Dashboard stopped by user");
      this.activeDashboard = null;
    });

    this.activeDashboard.on("_error", (_error: Error) => {
      Logger.error("Dashboard _error:", _error);
    });
  }

  public getActiveDashboard(): EvolutionDashboard | null {
    return this.activeDashboard;
  }
}

export default DashboardCommand;
