import { EventEmitter } from "node:events";

export interface DashboardWidget {
  id: string;
  type: "chart" | "metric" | "status" | "table" | "gauge" | "heatmap";
  title: string;
  position: { x: number; y: number; width: number; height: number };
  config: unknown;
  refreshInterval: number; // ms
}

export interface ChartConfig {
  type: "line" | "bar" | "pie" | "area";
  dataSource: string; // Query or metric name
  timeRange: "5m" | "15m" | "1h" | "6h" | "24h";
  aggregation: "avg" | "sum" | "min" | "max" | "count";
  colors: string[];
}

export interface MetricConfig {
  metricName: string;
  format: "number" | "percentage" | "bytes" | "duration";
  threshold?: { warning: number; critical: number };
  sparkline: boolean;
}

export interface StatusConfig {
  components: string[];
  showDetails: boolean;
  compactMode: boolean;
}

export interface TableConfig {
  dataSource: string;
  columns: Array<{
    name: string;
    key: string;
    format?: string;
    sortable?: boolean;
  }>;
  pageSize: number;
}

export interface GaugeConfig {
  metricName: string;
  min: number;
  max: number;
  thresholds: Array<{ value: number; color: string }>;
  unit: string;
}

export interface HeatmapConfig {
  dataSource: string;
  xAxis: string;
  yAxis: string;
  valueField: string;
  colorScale: string[];
}

export interface DashboardLayout {
  id: string;
  name: string;
  description: string;
  widgets: DashboardWidget[];
  settings: {
    autoRefresh: boolean;
    refreshInterval: number;
    theme: "light" | "dark" | "auto";
  };
}

export interface MetricsDashboardOptions {
  telemetryAdapter: any; // TelemetryAdapter reference
  updateInterval: number;
  maxDataPoints: number;
  enableAnimations: boolean;
  theme: "light" | "dark" | "auto";
}

export class MetricsDashboard extends EventEmitter {
  private readonly _options: MetricsDashboardOptions;
  private readonly _layouts = new Map<string, DashboardLayout>();
  private readonly _widgetData = new Map<string, unknown>();
  private readonly _updateTimers = new Map<string, NodeJS.Timeout>();
  private _currentLayout?: DashboardLayout;
  private _isStarted = false;

  constructor(options: Partial<MetricsDashboardOptions> = {}) {
    super();

    this._options = {
      telemetryAdapter: null,
      updateInterval: 5000, // 5 seconds
      maxDataPoints: 100,
      enableAnimations: true,
      theme: "auto",
      ...options,
    };

    this._setupDefaultLayouts();
  }

  start(): void {
    if (this._isStarted) return;

    this._isStarted = true;
    this._startWidgetUpdates();
    this.emit("dashboard_started");
  }

  stop(): void {
    if (!this._isStarted) return;

    this._isStarted = false;
    this._stopWidgetUpdates();
    this.emit("dashboard_stopped");
  }

  createLayout(layout: Omit<DashboardLayout, "id">): string {
    const id = this._generateId();
    const fullLayout: DashboardLayout = { ...layout, id };

    this._layouts.set(id, fullLayout);
    this.emit("layout_created", { id, layout: fullLayout });

    return id;
  }

  getLayout(id: string): DashboardLayout | undefined {
    return this._layouts.get(id);
  }

  getAllLayouts(): DashboardLayout[] {
    return Array.from(this._layouts.values());
  }

  setCurrentLayout(id: string): void {
    const layout = this._layouts.get(id);
    if (!layout) {
      throw new Error(`Layout not found: ${id}`);
    }

    this._currentLayout = layout;
    this._updateWidgetTimers();
    this.emit("layout_changed", { id, layout });
  }

  getCurrentLayout(): DashboardLayout | undefined {
    return this._currentLayout;
  }

  addWidget(layoutId: string, widget: Omit<DashboardWidget, "id">): string {
    const layout = this._layouts.get(layoutId);
    if (!layout) {
      throw new Error(`Layout not found: ${layoutId}`);
    }

    const widgetId = this._generateId();
    const fullWidget: DashboardWidget = { ...widget, id: widgetId };

    layout.widgets.push(fullWidget);

    if (this._currentLayout?.id === layoutId) {
      this._startWidgetUpdate(fullWidget);
    }

    this.emit("widget_added", { layoutId, widget: fullWidget });
    return widgetId;
  }

  removeWidget(layoutId: string, widgetId: string): void {
    const layout = this._layouts.get(layoutId);
    if (!layout) {
      throw new Error(`Layout not found: ${layoutId}`);
    }

    const index = layout.widgets.findIndex((w) => w.id === widgetId);
    if (index === -1) {
      throw new Error(`Widget not found: ${widgetId}`);
    }

    layout.widgets.splice(index, 1);
    this._stopWidgetUpdate(widgetId);
    this._widgetData.delete(widgetId);

    this.emit("widget_removed", { layoutId, widgetId });
  }

  updateWidget(
    layoutId: string,
    widgetId: string,
    updates: Partial<DashboardWidget>,
  ): void {
    const layout = this._layouts.get(layoutId);
    if (!layout) {
      throw new Error(`Layout not found: ${layoutId}`);
    }

    const widget = layout.widgets.find((w) => w.id === widgetId);
    if (!widget) {
      throw new Error(`Widget not found: ${widgetId}`);
    }

    Object.assign(widget, updates);

    // Restart widget update if refresh interval changed
    if (updates.refreshInterval && this._currentLayout?.id === layoutId) {
      this._stopWidgetUpdate(widgetId);
      this._startWidgetUpdate(widget);
    }

    this.emit("widget_updated", { layoutId, widgetId, widget });
  }

  getWidgetData(widgetId: string): unknown {
    return this._widgetData.get(widgetId);
  }

  async renderDashboard(): Promise<string> {
    if (!this._currentLayout) {
      return "No dashboard layout selected";
    }

    const layout = this._currentLayout;
    const widgets = await Promise.all(
      layout.widgets.map(async (widget) => {
        const data = await this._generateWidgetData(widget);
        return this._renderWidget(widget, data);
      }),
    );

    return this._renderLayout(layout, widgets);
  }

  exportLayout(layoutId: string): DashboardLayout {
    const layout = this._layouts.get(layoutId);
    if (!layout) {
      throw new Error(`Layout not found: ${layoutId}`);
    }
    return JSON.parse(JSON.stringify(layout));
  }

  importLayout(layoutData: DashboardLayout): string {
    const id = this._generateId();
    const layout = { ...layoutData, id };

    this._layouts.set(id, layout);
    this.emit("layout_imported", { id, layout });

    return id;
  }

  private _setupDefaultLayouts(): void {
    // System Overview Layout
    const systemOverview: DashboardLayout = {
      id: "system-overview",
      name: "System Overview",
      description: "High-level system health and performance metrics",
      widgets: [
        {
          id: "system-health-status",
          type: "status",
          title: "System Health",
          position: { x: 0, y: 0, width: 4, height: 2 },
          config: {
            components: ["queue", "engine", "storage", "network", "memory"],
            showDetails: true,
            compactMode: false,
          } as StatusConfig,
          refreshInterval: 30000,
        },
        {
          id: "queue-metrics-chart",
          type: "chart",
          title: "Queue Performance",
          position: { x: 4, y: 0, width: 8, height: 4 },
          config: {
            type: "line",
            dataSource: "queue.current_size,queue.avg_wait_time",
            timeRange: "1h",
            aggregation: "avg",
            colors: ["#3b82f6", "#ef4444"],
          } as ChartConfig,
          refreshInterval: 5000,
        },
        {
          id: "confidence-gauge",
          type: "gauge",
          title: "AI Confidence Score",
          position: { x: 0, y: 2, width: 4, height: 3 },
          config: {
            metricName: "ai.confidence.score",
            min: 0,
            max: 1,
            thresholds: [
              { value: 0.8, color: "#22c55e" },
              { value: 0.6, color: "#fbbf24" },
              { value: 0.3, color: "#ef4444" },
            ],
            unit: "",
          } as GaugeConfig,
          refreshInterval: 10000,
        },
        {
          id: "storage-table",
          type: "table",
          title: "Recent Operations",
          position: { x: 0, y: 5, width: 12, height: 4 },
          config: {
            dataSource: "recent_operations",
            columns: [
              { name: "Operation", key: "operation", sortable: true },
              { name: "Provider", key: "provider", sortable: true },
              {
                name: "Duration",
                key: "duration",
                format: "duration",
                sortable: true,
              },
              { name: "Status", key: "status", sortable: true },
              {
                name: "Timestamp",
                key: "timestamp",
                format: "datetime",
                sortable: true,
              },
            ],
            pageSize: 10,
          } as TableConfig,
          refreshInterval: 15000,
        },
      ],
      settings: {
        autoRefresh: true,
        refreshInterval: 30000,
        theme: "auto",
      },
    };

    // Performance Analysis Layout
    const performanceAnalysis: DashboardLayout = {
      id: "performance-analysis",
      name: "Performance Analysis",
      description: "Detailed performance metrics and trends",
      widgets: [
        {
          id: "response-time-heatmap",
          type: "heatmap",
          title: "Response Time Heatmap",
          position: { x: 0, y: 0, width: 6, height: 4 },
          config: {
            dataSource: "response_times",
            xAxis: "hour",
            yAxis: "provider",
            valueField: "avg_response_time",
            colorScale: ["#22c55e", "#fbbf24", "#ef4444"],
          } as HeatmapConfig,
          refreshInterval: 60000,
        },
        {
          id: "throughput-chart",
          type: "chart",
          title: "Throughput Trends",
          position: { x: 6, y: 0, width: 6, height: 4 },
          config: {
            type: "area",
            dataSource: "system.health.*.throughput",
            timeRange: "6h",
            aggregation: "sum",
            colors: ["#8b5cf6", "#06b6d4", "#84cc16", "#f59e0b"],
          } as ChartConfig,
          refreshInterval: 30000,
        },
      ],
      settings: {
        autoRefresh: true,
        refreshInterval: 60000,
        theme: "dark",
      },
    };

    this._layouts.set(systemOverview.id, systemOverview);
    this._layouts.set(performanceAnalysis.id, performanceAnalysis);
    this._currentLayout = systemOverview;
  }

  private _startWidgetUpdates(): void {
    if (!this._currentLayout) return;

    for (const widget of this._currentLayout.widgets) {
      this._startWidgetUpdate(widget);
    }
  }

  private _stopWidgetUpdates(): void {
    for (const timer of this._updateTimers.values()) {
      clearInterval(timer);
    }
    this._updateTimers.clear();
  }

  private _updateWidgetTimers(): void {
    this._stopWidgetUpdates();
    this._startWidgetUpdates();
  }

  private _startWidgetUpdate(widget: DashboardWidget): void {
    const timer = setInterval(async () => {
      try {
        const data = await this._generateWidgetData(widget);
        this._widgetData.set(widget.id, data);
        this.emit("widget_data_updated", { widgetId: widget.id, data });
      } catch (error) {
        this.emit("widget_update_error", { widgetId: widget.id, error });
      }
    }, widget.refreshInterval);

    this._updateTimers.set(widget.id, timer);

    // Initial data load
    this._generateWidgetData(widget)
      .then((data) => {
        this._widgetData.set(widget.id, data);
        this.emit("widget_data_updated", { widgetId: widget.id, data });
      })
      .catch((error) => {
        this.emit("widget_update_error", { widgetId: widget.id, error });
      });
  }

  private _stopWidgetUpdate(widgetId: string): void {
    const timer = this._updateTimers.get(widgetId);
    if (timer) {
      clearInterval(timer);
      this._updateTimers.delete(widgetId);
    }
  }

  private async _generateWidgetData(widget: DashboardWidget): Promise<unknown> {
    if (!this._options.telemetryAdapter) {
      return null;
    }

    switch (widget.type) {
      case "metric":
        return this._generateMetricData(widget);
      case "chart":
        return this._generateChartData(widget);
      case "status":
        return this._generateStatusData(widget);
      case "table":
        return this._generateTableData(widget);
      case "gauge":
        return this._generateGaugeData(widget);
      case "heatmap":
        return this._generateHeatmapData(widget);
      default:
        return null;
    }
  }

  private async _generateMetricData(widget: DashboardWidget): Promise<unknown> {
    const config = widget.config as MetricConfig;
    const metrics = this._options.telemetryAdapter.getMetrics(
      config.metricName,
    );

    if (metrics.length === 0) return { value: 0, trend: 0 };

    const latest = metrics[metrics.length - 1];
    const previous = metrics.length > 1 ? metrics[metrics.length - 2] : null;
    const trend = previous
      ? ((latest.value - previous.value) / previous.value) * 100
      : 0;

    return {
      value: latest.value,
      trend,
      sparkline: config.sparkline
        ? metrics.slice(-20).map((m) => m.value)
        : null,
      timestamp: latest.timestamp,
    };
  }

  private async _generateChartData(widget: DashboardWidget): Promise<unknown> {
    const config = widget.config as ChartConfig;
    const metrics = this._options.telemetryAdapter.getMetrics(
      config.dataSource,
    );

    const timeRangeMs = this._parseTimeRange(config.timeRange);
    const cutoff = new Date(Date.now() - timeRangeMs);

    const filteredMetrics = metrics.filter((m) => m.timestamp >= cutoff);

    return {
      labels: filteredMetrics.map((m) => m.timestamp.toISOString()),
      datasets: [
        {
          label: config.dataSource,
          data: filteredMetrics.map((m) => m.value),
          borderColor: config.colors[0] || "#3b82f6",
          fill: config.type === "area",
        },
      ],
    };
  }

  private async _generateStatusData(widget: DashboardWidget): Promise<unknown> {
    const config = widget.config as StatusConfig;
    const components: Record<string, any> = {};

    for (const component of config.components) {
      const healthMetrics = this._options.telemetryAdapter.getMetrics(
        `system.health.${component}.status`,
      );
      const latest = healthMetrics[healthMetrics.length - 1];

      components[component] = {
        status: this._scoreToHealth(latest?.value ?? -1),
        lastUpdate: latest?.timestamp || new Date(),
      };
    }

    return { components };
  }

  private async _generateTableData(widget: DashboardWidget): Promise<unknown> {
    // Mock table data - in real implementation, this would query the telemetry adapter
    return {
      rows: [
        {
          operation: "text-generation",
          provider: "openai",
          duration: 1234,
          status: "success",
          timestamp: new Date(),
        },
        {
          operation: "image-analysis",
          provider: "anthropic",
          duration: 2345,
          status: "success",
          timestamp: new Date(),
        },
        {
          operation: "code-generation",
          provider: "google",
          duration: 890,
          status: "error",
          timestamp: new Date(),
        },
      ],
      total: 100,
    };
  }

  private async _generateGaugeData(widget: DashboardWidget): Promise<unknown> {
    const config = widget.config as GaugeConfig;
    const metrics = this._options.telemetryAdapter.getMetrics(
      config.metricName,
    );

    const latest = metrics[metrics.length - 1];
    return {
      value: latest?.value || 0,
      min: config.min,
      max: config.max,
      timestamp: latest?.timestamp || new Date(),
    };
  }

  private async _generateHeatmapData(
    widget: DashboardWidget,
  ): Promise<unknown> {
    // Mock heatmap data
    return {
      data: [
        { x: "00:00", y: "openai", value: 120 },
        { x: "01:00", y: "openai", value: 89 },
        { x: "00:00", y: "anthropic", value: 156 },
        { x: "01:00", y: "anthropic", value: 234 },
      ],
    };
  }

  private _renderWidget(widget: DashboardWidget, data: unknown): string {
    // Simple text-based rendering for CLI
    const header = `┌─ ${widget.title} ─────────────────────────┐`;
    const footer = `└─────────────────────────────────────────┘`;

    let content = "";

    switch (widget.type) {
      case "metric":
        const metricData = data as any;
        content = `  Value: ${metricData?.value || "N/A"}\n  Trend: ${metricData?.trend > 0 ? "↗" : metricData?.trend < 0 ? "↘" : "→"} ${Math.abs(metricData?.trend || 0).toFixed(2)}%`;
        break;
      case "status":
        const statusData = data as any;
        content = Object.entries(statusData?.components || {})
          .map(([name, info]: [string, any]) => `  ${name}: ${info.status}`)
          .join("\n");
        break;
      default:
        content = `  Data: ${JSON.stringify(data)}`;
    }

    return `${header}\n${content}\n${footer}`;
  }

  private _renderLayout(layout: DashboardLayout, widgets: string[]): string {
    const header = `╔═══ ${layout.name} ═══════════════════════════════════════════╗`;
    const footer = `╚═══════════════════════════════════════════════════════════════╝`;

    return `${header}\n\n${widgets.join("\n\n")}\n\n${footer}`;
  }

  private _parseTimeRange(timeRange: string): number {
    const unit = timeRange.slice(-1);
    const value = parseInt(timeRange.slice(0, -1));

    switch (unit) {
      case "m":
        return value * 60 * 1000;
      case "h":
        return value * 60 * 60 * 1000;
      case "d":
        return value * 24 * 60 * 60 * 1000;
      default:
        return 60 * 60 * 1000; // 1 hour default
    }
  }

  private _scoreToHealth(score: number): string {
    if (score >= 1) return "healthy";
    if (score >= 0.5) return "degraded";
    if (score >= 0) return "unhealthy";
    return "unknown";
  }

  private _generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
