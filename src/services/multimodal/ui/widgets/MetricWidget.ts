/**
 * Metric Widget for displaying numerical metrics with sparklines
 */

import { BaseWidget, WidgetOptions } from './BaseWidget.js';

export interface MetricData {
  value: number;
  timestamp: Date;
}

export interface MetricConfig {
  id: string;
  label: string;
  unit?: string;
  format?: 'number' | 'percentage' | 'bytes' | 'duration' | 'custom';
  formatter?: (value: number) => string;
  thresholds?: {
    warning?: number;
    critical?: number;
  };
  sparkline?: boolean;
  trend?: boolean;
}

export interface MetricWidgetState {
  metrics: Map<string, {
    config: MetricConfig;
    data: MetricData[];
    current: number;
    previous: number;
  }>;
  sparklineLength: number;
  showTrends: boolean;
}

export interface MetricWidgetOptions extends WidgetOptions {
  sparklineLength?: number;
  showTrends?: boolean;
}

export class MetricWidget extends BaseWidget<MetricWidgetState> {
  private updateTimer?: NodeJS.Timeout;

  constructor(
    screen: any,
    options: MetricWidgetOptions
  ) {
    const initialState: MetricWidgetState = {
      metrics: new Map(),
      sparklineLength: options.sparklineLength || 20,
      showTrends: options.showTrends !== false
    };

    super(screen, options, initialState);
  }

  protected onMount(): void {
    // Auto-refresh metrics display
    this.updateTimer = setInterval(() => {
      this.render();
    }, 1000);
  }

  protected onUnmount(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
    }
  }

  // Public API
  addMetric(config: MetricConfig): void {
    const state = this.getState();
    const metrics = new Map(state.metrics);
    
    metrics.set(config.id, {
      config,
      data: [],
      current: 0,
      previous: 0
    });

    this.setState({ metrics });
  }

  updateMetric(id: string, value: number): void {
    const state = this.getState();
    const metrics = new Map(state.metrics);
    const metric = metrics.get(id);

    if (!metric) return;

    const now = new Date();
    const newData = [...metric.data, { value, timestamp: now }];
    
    // Keep only recent data points for sparkline
    if (newData.length > state.sparklineLength) {
      newData.shift();
    }

    metrics.set(id, {
      ...metric,
      data: newData,
      previous: metric.current,
      current: value
    });

    this.setState({ metrics });
  }

  removeMetric(id: string): void {
    const state = this.getState();
    const metrics = new Map(state.metrics);
    metrics.delete(id);
    this.setState({ metrics });
  }

  clearMetrics(): void {
    this.setState({ metrics: new Map() });
  }

  render(): void {
    const state = this.getState();
    
    if (state.metrics.size === 0) {
      this.setContent('No metrics configured');
      return;
    }

    let content = '';

    // Header
    content += `{bold}${this.options.title || 'Metrics Dashboard'}{/bold}\n`;
    content += '━'.repeat(this.width - 4) + '\n\n';

    // Render each metric
    const metricEntries = Array.from(state.metrics.entries());
    const metricsPerRow = Math.floor((this.width - 4) / 25); // Approximate width per metric
    
    for (let i = 0; i < metricEntries.length; i += metricsPerRow) {
      const rowMetrics = metricEntries.slice(i, i + metricsPerRow);
      content += this.renderMetricRow(rowMetrics);
      content += '\n\n';
    }

    this.setContent(content);
  }

  private renderMetricRow(metrics: Array<[string, any]>): string {
    const state = this.getState();
    const lines: string[] = ['', '', '', '', '', '']; // 6 lines per row

    for (let i = 0; i < metrics.length; i++) {
      const [id, metric] = metrics[i];
      const metricLines = this.renderSingleMetric(metric);
      
      // Add to each line with padding
      for (let j = 0; j < lines.length; j++) {
        if (i > 0) lines[j] += '  '; // Padding between metrics
        lines[j] += metricLines[j] || '';
      }
    }

    return lines.join('\n');
  }

  private renderSingleMetric(metric: any): string[] {
    const { config, data, current, previous } = metric;
    const lines: string[] = [];
    const width = 22; // Fixed width per metric

    // Line 1: Label
    lines.push(`{bold}${config.label.substring(0, width)}{/bold}`.padEnd(width));

    // Line 2: Current value with color based on thresholds
    const formattedValue = this.formatValue(current, config);
    const valueColor = this.getValueColor(current, config);
    const valueDisplay = `{${valueColor}}${formattedValue}{/${valueColor}}`;
    lines.push(valueDisplay.padEnd(width));

    // Line 3: Trend indicator
    if (this.getState().showTrends && previous !== current) {
      const trend = current > previous ? '↑' : current < previous ? '↓' : '→';
      const trendColor = current > previous ? 'green-fg' : current < previous ? 'red-fg' : 'yellow-fg';
      const change = Math.abs(current - previous);
      const changeFormatted = this.formatValue(change, config);
      lines.push(`{${trendColor}}${trend} ${changeFormatted}{/${trendColor}}`.padEnd(width));
    } else {
      lines.push(''.padEnd(width));
    }

    // Line 4: Sparkline
    if (config.sparkline !== false && data.length > 1) {
      const sparkline = this.generateSparkline(data.map(d => d.value));
      lines.push(sparkline.substring(0, width).padEnd(width));
    } else {
      lines.push(''.padEnd(width));
    }

    // Line 5: Min/Max/Avg
    if (data.length > 0) {
      const values = data.map(d => d.value);
      const min = Math.min(...values);
      const max = Math.max(...values);
      const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
      
      const stats = `${min.toFixed(1)}/${avg.toFixed(1)}/${max.toFixed(1)}`;
      lines.push(`{dim}${stats.substring(0, width)}{/dim}`.padEnd(width));
    } else {
      lines.push(''.padEnd(width));
    }

    // Line 6: Empty for spacing
    lines.push(''.padEnd(width));

    return lines;
  }

  private formatValue(value: number, config: MetricConfig): string {
    if (config.formatter) {
      return config.formatter(value);
    }

    switch (config.format) {
      case 'percentage':
        return `${(value * 100).toFixed(1)}%`;
      case 'bytes':
        return this.formatBytes(value);
      case 'duration':
        return this.formatDuration(value);
      case 'number':
      default:
        if (value >= 1000000) {
          return `${(value / 1000000).toFixed(1)}M`;
        } else if (value >= 1000) {
          return `${(value / 1000).toFixed(1)}K`;
        } else {
          return value.toFixed(2);
        }
    }
  }

  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)}${units[unitIndex]}`;
  }

  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
    return `${(ms / 3600000).toFixed(1)}h`;
  }

  private getValueColor(value: number, config: MetricConfig): string {
    if (config.thresholds) {
      if (config.thresholds.critical !== undefined && value >= config.thresholds.critical) {
        return 'red-fg';
      }
      if (config.thresholds.warning !== undefined && value >= config.thresholds.warning) {
        return 'yellow-fg';
      }
    }
    return 'green-fg';
  }

  private generateSparkline(values: number[]): string {
    if (values.length < 2) return '';
    
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    
    if (range === 0) return '─'.repeat(Math.min(values.length, 20));

    const sparkChars = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
    let sparkline = '';

    for (const value of values.slice(-20)) { // Last 20 points
      const normalized = (value - min) / range;
      const index = Math.floor(normalized * (sparkChars.length - 1));
      sparkline += sparkChars[Math.max(0, Math.min(index, sparkChars.length - 1))];
    }

    return sparkline;
  }

  // Convenience methods for common metrics
  static createCPUMetric(): MetricConfig {
    return {
      id: 'cpu',
      label: 'CPU Usage',
      format: 'percentage',
      thresholds: { warning: 0.7, critical: 0.9 },
      sparkline: true,
      trend: true
    };
  }

  static createMemoryMetric(): MetricConfig {
    return {
      id: 'memory',
      label: 'Memory',
      format: 'bytes',
      thresholds: { warning: 1024 * 1024 * 100, critical: 1024 * 1024 * 200 },
      sparkline: true,
      trend: true
    };
  }

  static createLatencyMetric(): MetricConfig {
    return {
      id: 'latency',
      label: 'Response Time',
      format: 'duration',
      thresholds: { warning: 1000, critical: 5000 },
      sparkline: true,
      trend: true
    };
  }

  static createConfidenceMetric(): MetricConfig {
    return {
      id: 'confidence',
      label: 'Confidence',
      format: 'percentage',
      thresholds: { warning: 0.6, critical: 0.3 },
      sparkline: true,
      trend: true
    };
  }
}