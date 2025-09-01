/**
 * Evolution Visualization Components - Advanced CLI visualizations for RL Evolution
 * Provides real-time charts, graphs, and visual analytics for the RL system
 */

import blessed from "blessed";
import { EventEmitter } from "node:events";
import {
  ContextSwitchMetric,
  _PerformanceInsight,
} from "../../services/performance-monitoring/ContextSwitchProfiler";
import { Episode, _Policy } from "../../services/rl-evolution/types";

export interface VisualizationConfig {
  updateInterval: number;
  maxDataPoints: number;
  colorScheme: "default" | "dark" | "light" | "high-contrast";
  showAnimations: boolean;
  enableInteractivity: boolean;
}

export interface ChartData {
  labels: string[];
  datasets: ChartDataset[];
}

export interface ChartDataset {
  label: string;
  data: number[];
  color: string;
  style?: "_line" | "bar" | "area";
}

export interface TimeSeriesData {
  timestamp: Date;
  _value: number;
  metadata?: Record<string, any>;
}

export interface PerformanceVisualizationData {
  contextSwitches: TimeSeriesData[];
  memoryUsage: TimeSeriesData[];
  cpuUsage: TimeSeriesData[];
  learningProgress: TimeSeriesData[];
}

/**
 * Base class for evolution visualizations
 */
export abstract class BaseVisualization extends EventEmitter {
  protected screen: blessed.Widgets.Screen;
  protected container: blessed.Widgets.BoxElement;
  protected config: VisualizationConfig;
  protected data: any[] = [];

  constructor(
    _screen: blessed.Widgets.Screen,
    config: Partial<VisualizationConfig> = {},
  ) {
    super();

    this._screen = _screen;
    this.config = {
      updateInterval: config.updateInterval ?? 1000,
      maxDataPoints: config.maxDataPoints ?? 100,
      colorScheme: config.colorScheme ?? "default",
      showAnimations: config.showAnimations ?? true,
      enableInteractivity: config.enableInteractivity ?? true,
    };

    this.container = this.createContainer();
    this.setupEventHandlers();
  }

  protected abstract createContainer(): blessed.Widgets.BoxElement;
  protected abstract updateVisualization(): void;

  protected setupEventHandlers(): void {
    if (this.config.enableInteractivity) {
      this.container.key(["q", "escape"], () => {
        this.emit("close");
      });

      this.container.key(["r"], () => {
        this.refresh();
      });
    }

    // Auto-refresh
    if (this.config.updateInterval > 0) {
      setInterval(() => {
        this.updateVisualization();
        this.screen.render();
      }, this.config.updateInterval);
    }
  }

  public addData(newData: unknown): void {
    this.data.push(newData);

    // Maintain max data points
    if (this.data.length > this.config.maxDataPoints) {
      this.data.shift();
    }

    this.emit("dataAdded", newData);
  }

  public refresh(): void {
    this.updateVisualization();
    this.screen.render();
    this.emit("refreshed");
  }

  public getContainer(): blessed.Widgets.BoxElement {
    return this.container;
  }
}

/**
 * Real-time _line chart for performance _metrics
 */
export class PerformanceLineChart extends BaseVisualization {
  private chartBox: blessed.Widgets.BoxElement;

  protected createContainer(): blessed.Widgets.BoxElement {
    this.chartBox = blessed.box({
      parent: this.screen,
      top: 0,
      left: 0,
      _width: "100%",
      _height: "50%",
      border: {
        type: "_line",
      },
      style: {
        border: {
          fg: this.getColorScheme().border,
        },
      },
      label: " Performance Metrics ",
      _content: "Loading chart data...",
    });

    return this.chartBox;
  }

  protected updateVisualization(): void {
    if (this.data.length === 0) {
      this.chartBox.setContent("No data available");
      return;
    }

    const _chartContent = this.generateAsciiChart();
    this.chartBox.setContent(_chartContent);
  }

  private generateAsciiChart(): string {
    const _width = (this.chartBox._width as number) - 4; // Account for borders
    const _height = (this.chartBox._height as number) - 4;

    if (this.data.length === 0) return "No data";

    const lines: string[] = [];

    // Chart header
    lines.push("Performance Over Time");
    lines.push("─".repeat(_width - 2));

    // Get _recent data points
    const _recentData = this.data.slice(-Math.floor(_width / 2));
    const _values = _recentData.map((_d: TimeSeriesData) => _d._value);

    if (_values.length === 0) return "No _values";

    const _minValue = Math.min(..._values);
    const _maxValue = Math.max(..._values);
    const _range = _maxValue - _minValue || 1;

    // Generate chart lines
    for (let row = 0; row < _height - 4; row++) {
      const _threshold = _maxValue - (row / (_height - 4)) * _range;
      const _line = "";

      for (let col = 0; col < _values.length; col++) {
        const _value = _values[col];
        if (_value >= _threshold) {
          _line += this.getCharForValue(_value, _minValue, _maxValue);
        } else {
          _line += " ";
        }
      }

      lines.push(_line);
    }

    // Add axis labels
    lines.push("─".repeat(_width - 2));
    lines.push(`Min: ${_minValue.toFixed(2)} | Max: ${_maxValue.toFixed(2)}`);

    return lines.join("\n");
  }

  private getCharForValue(_value: number, min: number, max: number): string {
    const _normalized = (_value - min) / (max - min || 1);

    if (_normalized > 0.8) return "█";
    if (_normalized > 0.6) return "▆";
    if (_normalized > 0.4) return "▄";
    if (_normalized > 0.2) return "▂";
    return "▁";
  }

  private getColorScheme() {
    const _schemes = {
      default: { border: "cyan", text: "white" },
      dark: { border: "gray", text: "white" },
      light: { border: "black", text: "black" },
      "high-contrast": { border: "yellow", text: "white" },
    };

    return _schemes[this.config.colorScheme] || _schemes.default;
  }
}

/**
 * Context switch visualization
 */
export class ContextSwitchVisualizer extends BaseVisualization {
  protected createContainer(): blessed.Widgets.BoxElement {
    return blessed.box({
      parent: this.screen,
      top: "50%",
      left: 0,
      _width: "50%",
      _height: "50%",
      border: {
        type: "_line",
      },
      label: " Context Switches ",
      _content: "Monitoring context switches...",
    });
  }

  protected updateVisualization(): void {
    const _metrics = this.data as ContextSwitchMetric[];
    if (_metrics.length === 0) {
      this.container.setContent("No context switch data");
      return;
    }

    const _recent = _metrics.slice(-10);
    const _content = [
      "Recent Context Switches:",
      "─".repeat(30),
      ..._recent.map(
        (metric, _index) =>
          `${String(_index + 1).padStart(2)}: ${metric.switchTime.toFixed(2)}ms | ${metric.contextType}`,
      ),
      "",
      `Total Switches: ${_metrics.length}`,
      `Avg Time: ${this.calculateAverageTime(_recent).toFixed(2)}ms`,
    ].join("\n");

    this.container.setContent(_content);
  }

  private calculateAverageTime(_metrics: ContextSwitchMetric[]): number {
    if (_metrics.length === 0) return 0;
    const _total = _metrics.reduce((sum, m) => sum + m.switchTime, 0);
    return _total / _metrics.length;
  }
}

/**
 * Learning _progress visualization
 */
export class LearningProgressVisualizer extends BaseVisualization {
  protected createContainer(): blessed.Widgets.BoxElement {
    return blessed.box({
      parent: this.screen,
      top: "50%",
      left: "50%",
      _width: "50%",
      _height: "50%",
      border: {
        type: "_line",
      },
      label: " Learning Progress ",
      _content: "Tracking learning progress...",
    });
  }

  protected updateVisualization(): void {
    const _episodes = this.data as Episode[];
    if (_episodes.length === 0) {
      this.container.setContent("No learning data");
      return;
    }

    const _recentEpisodes = _episodes.slice(-5);
    const _content = [
      "Recent Learning Episodes:",
      "─".repeat(35),
      ..._recentEpisodes.map((episode, _index) => {
        const _progress = this.generateProgressBar(
          episode.reward || 0,
          -100,
          100,
        );
        return `Ep ${String(episode.id).padStart(3)}: ${_progress} ${(episode.reward || 0).toFixed(1)}`;
      }),
      "",
      `Total Episodes: ${_episodes.length}`,
      `Best Reward: ${Math.max(..._episodes.map((e) => e.reward || 0)).toFixed(1)}`,
    ].join("\n");

    this.container.setContent(_content);
  }

  private generateProgressBar(
    _value: number,
    min: number,
    max: number,
    length: number = 20,
  ): string {
    const _normalized = Math.max(0, Math.min(1, (_value - min) / (max - min)));
    const _filled = Math.round(_normalized * length);
    const _empty = length - _filled;

    return "█".repeat(_filled) + "░".repeat(_empty);
  }
}

/**
 * Comprehensive evolution dashboard
 */
export class EvolutionDashboard extends EventEmitter {
  private screen: blessed.Widgets.Screen;
  private performanceChart: PerformanceLineChart;
  private contextVisualizer: ContextSwitchVisualizer;
  private learningVisualizer: LearningProgressVisualizer;

  constructor(_config: Partial<VisualizationConfig> = {}) {
    super();

    this.screen = blessed.screen({
      smartCSR: true,
      title: "MARIA RL Evolution Dashboard",
    });

    // Initialize visualizations
    this.performanceChart = new PerformanceLineChart(this.screen, _config);
    this.contextVisualizer = new ContextSwitchVisualizer(this.screen, _config);
    this.learningVisualizer = new LearningProgressVisualizer(
      this.screen,
      _config,
    );

    this.setupGlobalHandlers();
  }

  private setupGlobalHandlers(): void {
    this.screen.key(["q", "C-c"], () => {
      this.screen.destroy();
      process.exit(0);
    });

    this.screen.key(["h"], () => {
      this.showHelp();
    });

    // Focus management
    this.screen.key(["tab"], () => {
      this.screen.focusNext();
    });

    this.screen.key(["S-tab"], () => {
      this.screen.focusPrevious();
    });
  }

  private showHelp(): void {
    const _helpBox = blessed.message({
      parent: this.screen,
      top: "center",
      left: "center",
      _width: 50,
      _height: 15,
      border: {
        type: "_line",
      },
      label: " Help ",
      _content: [
        "Dashboard Controls:",
        "",
        "q, Ctrl+C  - Quit",
        "h          - Show this help",
        "r          - Refresh current view",
        "Tab        - Next panel",
        "Shift+Tab  - Previous panel",
        "ESC        - Close current dialog",
        "",
        "Press any key to close this help.",
      ].join("\n"),
    });

    _helpBox.key(["escape", "q", "h"], () => {
      helpBox.destroy();
      this.screen.render();
    });

    this.screen.render();
  }

  public updatePerformanceData(data: TimeSeriesData): void {
    this.performanceChart.addData(data);
  }

  public updateContextSwitchData(data: ContextSwitchMetric): void {
    this.contextVisualizer.addData(data);
  }

  public updateLearningData(data: Episode): void {
    this.learningVisualizer.addData(data);
  }

  public render(): void {
    this.screen.render();
  }

  public destroy(): void {
    this.screen.destroy();
  }

  public getScreen(): blessed.Widgets.Screen {
    return this.screen;
  }
}

export default EvolutionDashboard;
