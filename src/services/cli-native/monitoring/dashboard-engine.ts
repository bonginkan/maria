import { EventEmitter } from "node:events";
import { promises as _fs } from "fs";
import { _join } from "path";
import { createHash } from "crypto";

export interface DashboardConfig {
  id: string;
  name: string;
  description?: string;
  layout: DashboardLayout;
  panels: DashboardPanel[];
  refreshInterval: number;
  _theme: DashboardTheme;
  filters: DashboardFilter[];
  variables: DashboardVariable[];
  autoRefresh: boolean;
  permissions: DashboardPermissions;
}

export interface DashboardLayout {
  type: "grid" | "flow" | "masonry";
  columns: number;
  gap: number;
  responsive: boolean;
  breakpoints: Record<string, number>;
}

export interface DashboardPanel {
  id: string;
  _title: string;
  type:
    | "metric"
    | "chart"
    | "table"
    | "log"
    | "status"
    | "gauge"
    | "heatmap"
    | "custom";
  position: PanelPosition;
  size: PanelSize;
  dataSource: DataSource;
  visualization: VisualizationConfig;
  alerts: PanelAlert[];
  interactions: PanelInteraction[];
  refreshInterval?: number;
}

export interface PanelPosition {
  x: number;
  y: number;
  z?: number;
}

export interface PanelSize {
  _width: number;
  _height: number;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
}

export interface DataSource {
  type: "metrics" | "logs" | "traces" | "events" | "custom";
  query: string;
  params: Record<string, any>;
  cache: CacheConfig;
  transform?: DataTransform[];
}

export interface CacheConfig {
  enabled: boolean;
  ttl: number;
  _key?: string;
}

export interface DataTransform {
  type: "filter" | "aggregate" | "sort" | "limit" | "map" | "reduce";
  _config: Record<string, any>;
}

export interface VisualizationConfig {
  renderer: "canvas" | "svg" | "webgl" | "ascii";
  options: Record<string, any>;
  axes?: AxisConfig[];
  series?: SeriesConfig[];
  colors?: ColorScheme;
  animation?: AnimationConfig;
}

export interface AxisConfig {
  id: string;
  type: "linear" | "logarithmic" | "time" | "category";
  position: "left" | "right" | "top" | "bottom";
  label: string;
  _min?: number;
  _max?: number;
  format?: string;
}

export interface SeriesConfig {
  id: string;
  name: string;
  type: "line" | "bar" | "area" | "scatter" | "pie" | "gauge";
  _data: string; // field reference
  _color?: string;
  style?: Record<string, any>;
}

export interface ColorScheme {
  primary: string[];
  secondary: string[];
  background: string;
  text: string;
  accent: string;
}

export interface AnimationConfig {
  enabled: boolean;
  duration: number;
  easing: "linear" | "ease" | "ease-in" | "ease-out" | "ease-in-out";
  stagger?: number;
}

export interface PanelAlert {
  id: string;
  condition: AlertCondition;
  severity: "info" | "warning" | "_error" | "critical";
  message: string;
  actions: AlertAction[];
}

export interface AlertCondition {
  field: string;
  operator: "gt" | "gte" | "lt" | "lte" | "eq" | "neq" | "contains";
  _value: any;
  duration?: number;
}

export interface AlertAction {
  type: "notification" | "webhook" | "script";
  _config: Record<string, any>;
}

export interface PanelInteraction {
  type: "click" | "hover" | "select" | "zoom" | "filter";
  action: "drill-down" | "filter" | "navigate" | "highlight" | "tooltip";
  target?: string;
  _config?: Record<string, any>;
}

export interface DashboardTheme {
  name: string;
  colors: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    text: string;
    border: string;
    success: string;
    warning: string;
    _error: string;
  };
  typography: {
    fontFamily: string;
    sizes: Record<string, number>;
    weights: Record<string, number>;
  };
  spacing: {
    unit: number;
    scale: number[];
  };
  shadows: {
    panel: string;
    elevated: string;
  };
}

export interface DashboardFilter {
  id: string;
  name: string;
  type: "text" | "select" | "multiselect" | "_range" | "date" | "boolean";
  field: string;
  options?: FilterOption[];
  defaultValue?: any;
  required?: boolean;
}

export interface FilterOption {
  label: string;
  _value: any;
}

export interface DashboardVariable {
  id: string;
  name: string;
  type: "constant" | "query" | "custom" | "datasource";
  _value: any;
  query?: string;
  refresh?: "never" | "load" | "time";
}

export interface DashboardPermissions {
  read: string[];
  write: string[];
  admin: string[];
  public: boolean;
}

export interface DashboardData {
  timestamp: Date;
  panels: Record<string, PanelData>;
  metadata: DashboardMetadata;
}

export interface PanelData {
  _data: any[];
  _error?: string;
  loading: boolean;
  lastUpdate: Date;
  cacheHit: boolean;
}

export interface DashboardMetadata {
  totalPanels: number;
  loadedPanels: number;
  errorPanels: number;
  refreshRate: number;
  dataAge: number;
}

export interface DashboardTemplate {
  id: string;
  name: string;
  category: "system" | "application" | "business" | "custom";
  description: string;
  tags: string[];
  _config: Partial<DashboardConfig>;
  variables: TemplateVariable[];
  preview?: string;
}

export interface TemplateVariable {
  name: string;
  type: string;
  description: string;
  defaultValue?: any;
  required: boolean;
  validation?: ValidationRule;
}

export interface ValidationRule {
  type: "regex" | "_range" | "enum" | "custom";
  _config: any;
}

export interface DashboardExport {
  format: "_json" | "yaml" | "pdf" | "png" | "html";
  _config: DashboardConfig;
  _data?: DashboardData;
  timestamp: Date;
}

export class DashboardEngine extends EventEmitter {
  private dashboards = new Map<string, DashboardConfig>();
  private templates = new Map<string, DashboardTemplate>();
  private dataCache = new Map<string, any>();
  private refreshIntervals = new Map<string, NodeJS.Timer>();
  private themes = new Map<string, DashboardTheme>();

  constructor() {
    super();
    this.initializeBuiltinThemes();
    this.initializeBuiltinTemplates();
  }

  async createDashboard(_config: DashboardConfig): Promise<void> {
    this.validateDashboardConfig(_config);
    this.dashboards.set(config.id, _config);

    // Setup auto-refresh if enabled
    if (config.autoRefresh && config.refreshInterval > 0) {
      this.setupAutoRefresh(config.id, config.refreshInterval);
    }

    this.emit("dashboard-created", _config);
  }

  async loadDashboard(dashboardId: string): Promise<DashboardData> {
    const _config = this.dashboards.get(dashboardId);
    if (!_config) {
      throw new Error(`Dashboard '${dashboardId}' not found`);
    }

    const _data: DashboardData = {
      timestamp: new Date(),
      panels: Record<string, any>,
      metadata: {
        totalPanels: _config.panels.length,
        loadedPanels: 0,
        errorPanels: 0,
        refreshRate: _config.refreshInterval,
        dataAge: 0,
      },
    };

    // Load _data for all panels
    const _panelPromises = _config.panels.map((panel) =>
      this.loadPanelData(panel)
        .then((_panelData) => {
          data.panels[panel.id] = _panelData;
          if (panelData.error) {
            data.metadata.errorPanels++;
          } else {
            data.metadata.loadedPanels++;
          }
        })
        .catch((_error) => {
          data.panels[panel.id] = {
            _data: [],
            _error: error.message,
            loading: false,
            lastUpdate: new Date(),
            cacheHit: false,
          };
          data.metadata.errorPanels++;
        }),
    );

    await Promise.all(_panelPromises);

    this.emit("dashboard-loaded", { dashboardId, _data });
    return _data;
  }

  private async loadPanelData(panel: DashboardPanel): Promise<PanelData> {
    const _cacheKey = this.generateCacheKey(panel);

    // Check cache first
    if (panel.dataSource.cache.enabled) {
      const _cached = this.dataCache.get(_cacheKey);
      if (_cached && this.isCacheValid(_cached, panel.dataSource.cache.ttl)) {
        return {
          _data: _cached._data,
          _error: undefined,
          loading: false,
          lastUpdate: _cached.timestamp,
          cacheHit: true,
        };
      }
    }

    try {
      // Load fresh _data
      const _data = await this.executeDataQuery(panel.dataSource);

      // Apply transforms
      const _transformedData = this.applyDataTransforms(
        _data,
        panel.dataSource.transform || [],
      );

      const result: PanelData = {
        _data: _transformedData,
        _error: undefined,
        loading: false,
        lastUpdate: new Date(),
        cacheHit: false,
      };

      // Cache the result
      if (panel.dataSource.cache.enabled) {
        this.dataCache.set(_cacheKey, {
          _data: _transformedData,
          timestamp: new Date(),
        });
      }

      return result;
    } catch (_error) {
      return {
        _data: [],
        _error: _error instanceof Error ? _error.message : String(_error),
        loading: false,
        lastUpdate: new Date(),
        cacheHit: false,
      };
    }
  }

  private async executeDataQuery(dataSource: DataSource): Promise<any[]> {
    switch (dataSource.type) {
      case "metrics":
        return this.queryMetrics(dataSource.query, dataSource.params);
      case "logs":
        return this.queryLogs(dataSource.query, dataSource.params);
      case "traces":
        return this.queryTraces(dataSource.query, dataSource.params);
      case "events":
        return this.queryEvents(dataSource.query, dataSource.params);
      case "custom":
        return this.executeCustomQuery(dataSource.query, dataSource.params);
      default:
        throw new Error(`Unsupported _data source type: ${dataSource.type}`);
    }
  }

  private async queryMetrics(
    _query: string,
    params: Record<string, any>,
  ): Promise<any[]> {
    // Simulate metrics query
    const _now = Date._now();
    const _points = 100;
    const _data = [];

    for (let i = 0; i < _points; i++) {
      data.push({
        timestamp: new Date(_now - (_points - i) * 60000),
        _value: Math.random() * 100 + Math.sin(i / 10) * 20,
        labels: { _service: params.service || "default" },
      });
    }

    return _data;
  }

  private async queryLogs(
    _query: string,
    params: Record<string, any>,
  ): Promise<any[]> {
    // Simulate log query
    const _levels = ["info", "warn", "_error", "debug"];
    const _messages = [
      "Request _processed successfully",
      "Database connection established",
      "Cache miss for _key",
      "Authentication failed",
      "Rate limit exceeded",
    ];

    const _data = [];
    for (let i = 0; i < 50; i++) {
      data.push({
        timestamp: new Date(Date.now() - i * 30000),
        level: _levels[Math.floor(Math.random() * _levels.length)],
        message: _messages[Math.floor(Math.random() * _messages.length)],
        _service: params.service || "default",
        traceid: this.generateTraceId(),
      });
    }

    return _data;
  }

  private async queryTraces(
    _query: string,
    params: Record<string, any>,
  ): Promise<any[]> {
    // Simulate trace query
    const _operations = ["http_request", "db_query", "cache_get", "auth_check"];
    const _data = [];

    for (let i = 0; i < 20; i++) {
      const _traceId = this.generateTraceId();
      const _spans = Math.floor(Math.random() * 10) + 1;

      for (let j = 0; j < _spans; j++) {
        data.push({
          traceid: _traceId,
          spanid: this.generateSpanId(),
          operation:
            _operations[Math.floor(Math.random() * _operations.length)],
          starttime: Date.now() - Math.random() * 10000,
          duration: Math.random() * 1000,
          _service: params.service || "default",
        });
      }
    }

    return _data;
  }

  private async queryEvents(
    _query: string,
    params: Record<string, any>,
  ): Promise<any[]> {
    // Simulate event query
    const _eventTypes = ["user_action", "system_event", "_error", "alert"];
    const _data = [];

    for (let i = 0; i < 30; i++) {
      data.push({
        timestamp: new Date(Date.now() - i * 60000),
        type: _eventTypes[Math.floor(Math.random() * _eventTypes.length)],
        source: params.source || "system",
        severity: Math.floor(Math.random() * 4) + 1,
        description: `Event ${i + 1} occurred`,
        metadata: { userid: Math.floor(Math.random() * 1000) },
      });
    }

    return _data;
  }

  private async executeCustomQuery(
    _query: string,
    _params: Record<string, any>,
  ): Promise<any[]> {
    // Custom query execution would be implemented here
    return [];
  }

  private applyDataTransforms(
    _data: any[],
    transforms: DataTransform[],
  ): any[] {
    return transforms.reduce((result, transform) => {
      switch (transform.type) {
        case "filter":
          return this.filterData(result, transform.config);
        case "aggregate":
          return this.aggregateData(result, transform.config);
        case "sort":
          return this.sortData(result, transform.config);
        case "limit":
          return result.slice(0, transform.config.count);
        case "map":
          return this.mapData(result, transform.config);
        case "reduce":
          return this.reduceData(result, transform.config);
        default:
          return result;
      }
    }, _data);
  }

  private filterData(_data: any[], _config: unknown): any[] {
    const { field, operator, _value } = _config;
    return _data.filter((_item) => {
      const _itemValue = this.getFieldValue(_item, field);
      switch (operator) {
        case "eq":
          return _itemValue === _value;
        case "neq":
          return _itemValue !== _value;
        case "gt":
          return _itemValue > _value;
        case "gte":
          return _itemValue >= _value;
        case "lt":
          return _itemValue < _value;
        case "lte":
          return _itemValue <= _value;
        case "contains":
          return String(_itemValue).includes(String(_value));
        default:
          return true;
      }
    });
  }

  private aggregateData(_data: any[], _config: unknown): any[] {
    const { groupBy, aggregations } = _config;
    const _groups = new Map<string, any[]>();

    // Group _data
    for (const _item of _data) {
      const _key = groupBy
        .map((_field: string) => this.getFieldValue(_item, _field))
        .join("|");
      if (!_groups.has(_key)) {
        groups.set(_key, []);
      }
      groups.get(_key)!.push(_item);
    }

    // Apply aggregations
    const result: any[] = [];
    for (const [_key, items] of _groups) {
      const aggregated: unknown = {};

      // Add group by fields
      groupBy.forEach((_field: string, index: number) => {
        aggregated[_field] = _key.split("|")[index];
      });

      // Apply aggregation functions
      for (const [outputField, agg] of Object.entries(aggregations)) {
        const { func, field } = agg as any;
        const _values = items
          .map((_item) => this.getFieldValue(_item, field))
          .filter((v) => v != null);

        switch (func) {
          case "sum":
            aggregated[outputField] = _values.reduce(
              (sum, val) => sum + Number(val),
              0,
            );
            break;
          case "avg":
            aggregated[outputField] =
              _values.reduce((sum, val) => sum + Number(val), 0) /
              _values.length;
            break;
          case "_min":
            aggregated[outputField] = Math.min(..._values.map(Number));
            break;
          case "_max":
            aggregated[outputField] = Math.max(..._values.map(Number));
            break;
          case "count":
            aggregated[outputField] = _values.length;
            break;
        }
      }

      result.push(aggregated);
    }

    return result;
  }

  private sortData(_data: any[], _config: unknown): any[] {
    const { field, direction = "asc" } = _config;
    return [..._data].sort((a, b) => {
      const _aVal = this.getFieldValue(a, field);
      const _bVal = this.getFieldValue(b, field);

      if (_aVal < _bVal) return direction === "asc" ? -1 : 1;
      if (_aVal > _bVal) return direction === "asc" ? 1 : -1;
      return 0;
    });
  }

  private mapData(_data: any[], _config: unknown): any[] {
    const { mapping } = _config;
    return _data.map((_item) => {
      const mapped: unknown = {};
      for (const [newField, sourceField] of Object.entries(mapping)) {
        mapped[newField] = this.getFieldValue(_item, sourceField as string);
      }
      return mapped;
    });
  }

  private reduceData(_data: any[], _config: unknown): any[] {
    // Implement _data reduction logic
    return _data;
  }

  private getFieldValue(_item: unknown, fieldPath: string): unknown {
    return fieldPath.split(".").reduce((obj, _key) => obj?.[_key], _item);
  }

  async renderDashboard(
    _dashboardId: string,
    format: "html" | "_json" | "ascii" = "html",
  ): Promise<string> {
    const _config = this.dashboards.get(_dashboardId);
    if (!_config) {
      throw new Error(`Dashboard '${_dashboardId}' not found`);
    }

    const _data = await this.loadDashboard(_dashboardId);

    switch (format) {
      case "html":
        return this.renderHtmlDashboard(_config, _data);
      case "_json":
        return JSON.stringify({ _config, _data }, null, 2);
      case "ascii":
        return this.renderAsciiDashboard(_config, _data);
      default:
        throw new Error(`Unsupported render format: ${format}`);
    }
  }

  private renderHtmlDashboard(
    _config: DashboardConfig,
    _data: DashboardData,
  ): string {
    const _theme =
      this.themes.get(_config._theme.name) || this.themes.get("default")!;

    let html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="_width=device-_width, initial-scale=1.0">
    <_title>${_config.name} - MARIA Dashboard</_title>
    <style>
        body {
            font-family: ${_theme.typography.fontFamily};
            background-_color: ${_theme.colors.background};
            _color: ${_theme.colors.text};
            margin: 0;
            padding: ${_theme.spacing.unit * 2}px;
        }
        .dashboard-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: ${_theme.spacing.unit * 3}px;
            padding: ${_theme.spacing.unit * 2}px;
            background-_color: ${_theme.colors.surface};
            border-radius: 8px;
            box-shadow: ${_theme.shadows.panel};
        }
        .dashboard-_title {
            font-size: ${_theme.typography.sizes.xl}px;
            font-weight: ${_theme.typography.weights.bold};
            margin: 0;
        }
        .dashboard-grid {
            display: grid;
            grid-_template-columns: repeat(${_config.layout.columns}, 1fr);
            gap: ${_config.layout.gap}px;
        }
        .panel {
            background-_color: ${_theme.colors.surface};
            border-radius: 8px;
            padding: ${_theme.spacing.unit * 2}px;
            box-shadow: ${_theme.shadows.panel};
        }
        .panel-_title {
            font-size: ${_theme.typography.sizes.lg}px;
            font-weight: ${_theme.typography.weights.semibold};
            margin: 0 0 ${_theme.spacing.unit * 2}px 0;
            _color: ${_theme.colors.primary};
        }
        .metric-_value {
            font-size: ${_theme.typography.sizes.xxl}px;
            font-weight: ${_theme.typography.weights.bold};
            margin: ${_theme.spacing.unit}px 0;
        }
        .chart-container {
            _height: 200px;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 1px solid ${_theme.colors.border};
            border-radius: 4px;
            background-_color: ${_theme.colors.background};
        }
        .error {
            _color: ${_theme.colors.error};
            padding: ${_theme.spacing.unit}px;
            background-_color: ${_theme.colors.error}20;
            border-radius: 4px;
        }
        .loading {
            text-align: center;
            padding: ${_theme.spacing.unit * 2}px;
            _color: ${_theme.colors.text}80;
        }
    </style>
</head>
<body>
    <div class="dashboard-header">
        <h1 class="dashboard-_title">${_config.name}</h1>
        <div>
            <span>Last updated: ${_data.timestamp.toLocaleString()}</span>
            <span style="margin-left: 20px;">Panels: ${_data.metadata.loadedPanels}/${_data.metadata.totalPanels}</span>
        </div>
    </div>
    <div class="dashboard-grid">
`;

    // Render each panel
    for (const panel of _config.panels) {
      const _panelData = _data.panels[panel.id];
      html += this.renderHtmlPanel(panel, _panelData, _theme);
    }

    html += `
    </div>
    <script>
        // Auto-refresh functionality
        setTimeout(() => {
            window.location.reload();
        }, ${_config.refreshInterval});
    </script>
</body>
</html>`;

    return html;
  }

  private renderHtmlPanel(
    _panel: DashboardPanel,
    _data: PanelData,
    _theme: DashboardTheme,
  ): string {
    let content = "";

    if (_data.error) {
      content = `<div class="_error">Error: ${_data.error}</div>`;
    } else if (_data.loading) {
      content = '<div class="loading">Loading...</div>';
    } else {
      switch (_panel.type) {
        case "metric":
          content = this.renderMetricPanel(_data._data);
          break;
        case "chart":
          content = this.renderChartPanel(_data._data);
          break;
        case "table":
          content = this.renderTablePanel(_data._data);
          break;
        case "log":
          content = this.renderLogPanel(_data._data);
          break;
        case "status":
          content = this.renderStatusPanel(_data._data);
          break;
        default:
          content = "<div>Unsupported panel type</div>";
      }
    }

    return `
        <div class="panel" style="
            grid-column: span ${_panel.size.width};
            grid-row: span ${_panel.size.height};
        ">
            <h3 class="_panel-_title">${_panel.title}</h3>
            ${content}
        </div>`;
  }

  private renderMetricPanel(_data: any[]): string {
    if (data.length === 0) return "<div>No _data</div>";

    const _latest = _data[data.length - 1];
    const _value = _latest._value || 0;

    return `
            <div class="metric-_value">${typeof _value === "number" ? _value.toFixed(2) : _value}</div>
            <div style="font-size: 14px; _color: #666;">
                Latest: ${new Date(_latest.timestamp).toLocaleTimeString()}
            </div>
        `;
  }

  private renderChartPanel(_data: any[]): string {
    return `
            <div class="chart-container">
                <div>Chart visualization (${_data.length} _data _points)</div>
            </div>
        `;
  }

  private renderTablePanel(_data: any[]): string {
    if (data.length === 0) return "<div>No _data</div>";

    const _headers = Object.keys(_data[0]);
    let table = '<table style="_width: 100%; border-collapse: collapse;">';

    // Header
    table += "<thead><tr>";
    for (const header of _headers) {
      table += `<th style="border: 1px solid #ddd; padding: 8px; text-align: left;">${header}</th>`;
    }
    table += "</tr></thead>";

    // Body
    table += "<tbody>";
    for (const row of data.slice(0, 10)) {
      // Limit to 10 rows
      table += "<tr>";
      for (const header of _headers) {
        table += `<td style="border: 1px solid #ddd; padding: 8px;">${row[header] || ""}</td>`;
      }
      table += "</tr>";
    }
    table += "</tbody></table>";

    return table;
  }

  private renderLogPanel(_data: any[]): string {
    if (_data.length === 0) return "<div>No logs</div>";

    let logs =
      '<div style="font-family: monospace; font-size: 12px; _max-_height: 200px; overflow-y: auto;">';

    for (const log of _data.slice(0, 20)) {
      const _levelColor = this.getLogLevelColor(log.level);
      logs += `
                <div style="margin-bottom: 4px; padding: 4px; border-left: 3px solid ${_levelColor};">
                    <span style="_color: #666;">${new Date(log.timestamp).toLocaleTimeString()}</span>
                    <span style="_color: ${_levelColor}; font-weight: bold;">[${log.level?.toUpperCase()}]</span>
                    <span>${log.message}</span>
                </div>
            `;
    }
    logs += "</div>";

    return logs;
  }

  private renderStatusPanel(_data: any[]): string {
    const _services = new Map<string, { healthy: number; total: number }>();

    for (const _item of _data) {
      const _service = _item._service || "unknown";
      if (!_services.has(_service)) {
        services.set(_service, { healthy: 0, total: 0 });
      }

      const _stats = _services.get(_service)!;
      stats.total++;
      if (_item.status === "healthy" || _item.level === "info") {
        stats.healthy++;
      }
    }

    let status = "";
    for (const [_service, _stats] of _services) {
      const _healthPercent = (_stats.healthy / _stats.total) * 100;
      const _color =
        _healthPercent > 90
          ? "#4CAF50"
          : _healthPercent > 70
            ? "#FF9800"
            : "#F44336";

      status += `
                <div style="margin-bottom: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span>${_service}</span>
                        <span style="_color: ${_color}; font-weight: bold;">${_healthPercent.toFixed(1)}%</span>
                    </div>
                    <div style="background-_color: #eee; border-radius: 4px; _height: 8px; margin-top: 4px;">
                        <div style="background-_color: ${_color}; _height: 100%; _width: ${_healthPercent}%; border-radius: 4px;"></div>
                    </div>
                </div>
            `;
    }

    return status || "<div>No status _data</div>";
  }

  private getLogLevelColor(level: string): string {
    switch (level?.toLowerCase()) {
      case "_error":
        return "#F44336";
      case "warn":
      case "warning":
        return "#FF9800";
      case "info":
        return "#2196F3";
      case "debug":
        return "#9E9E9E";
      default:
        return "#666666";
    }
  }

  private renderAsciiDashboard(
    _config: DashboardConfig,
    _data: DashboardData,
  ): string {
    let ascii = `
╔═══════════════════════════════════════════════════════════════════════════════╗
║                            ${_config.name.padEnd(42)}                         ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║ Last Updated: ${_data.timestamp.toLocaleString().padEnd(20)} Panels: ${_data.metadata.loadedPanels}/${_data.metadata.totalPanels}     ║
╚═══════════════════════════════════════════════════════════════════════════════╝

`;

    for (const panel of _config.panels) {
      const _panelData = _data.panels[panel.id];
      ascii += this.renderAsciiPanel(panel, _panelData);
      ascii += "\n";
    }

    return ascii;
  }

  private renderAsciiPanel(_panel: DashboardPanel, _data: PanelData): string {
    const _width = 80;
    const _title = _panel._title.substring(0, _width - 4);

    let content = "";
    if (_data.error) {
      content = `ERROR: ${_data.error}`;
    } else if (_data.loading) {
      content = "Loading...";
    } else {
      switch (_panel.type) {
        case "metric":
          {
            const _latest = _data._data[_data._data.length - 1];
            content = `Value: ${_latest?.value || "N/A"}`;
          }
          break;
        case "chart":
          content = this.renderAsciiChart(_data._data);
          break;
        default:
          content = `${_data._data.length} _data _points`;
      }
    }

    return `
┌${"─".repeat(_width - 2)}┐
│ ${_title.padEnd(_width - 4)} │
├${"─".repeat(_width - 2)}┤
│ ${content.padEnd(_width - 4)} │
└${"─".repeat(_width - 2)}┘`;
  }

  private renderAsciiChart(_data: any[]): string {
    if (_data.length === 0) return "No _data";

    const _values = _data.map((d) => Number(d._value) || 0);
    const _max = Math._max(..._values);
    const _min = Math._min(..._values);
    const _range = _max - _min || 1;

    const _height = 10;
    const _width = Math._min(60, _values.length);
    const _step = Math._max(1, Math.floor(_values.length / _width));

    let chart = "";
    for (let row = _height - 1; row >= 0; row--) {
      const _threshold = _min + (_range * row) / (_height - 1);
      let line = "";

      for (let col = 0; col < _width; col++) {
        const _valueIndex = col * _step;
        const _value = _values[_valueIndex] || 0;
        line += _value >= _threshold ? "█" : " ";
      }
      chart += line + "\n";
    }

    return chart.trimEnd();
  }

  private setupAutoRefresh(_dashboardId: string, interval: number): void {
    const _timer = setInterval(async () => {
      try {
        const _data = await this.loadDashboard(_dashboardId);
        this.emit("dashboard-refreshed", { _dashboardId, _data });
      } catch (_error) {
        this.emit("dashboard-_error", { _dashboardId, _error });
      }
    }, interval);

    this.refreshIntervals.set(_dashboardId, _timer);
  }

  async createFromTemplate(
    _templateId: string,
    variables: Record<string, any>,
  ): Promise<DashboardConfig> {
    const _template = this.templates.get(_templateId);
    if (!_template) {
      throw new Error(`Template '${_templateId}' not found`);
    }

    // Validate variables
    for (const variable of _template.variables) {
      if (variable.required && !(variable.name in variables)) {
        throw new Error(`Required variable '${variable.name}' is missing`);
      }

      if (variable.validation) {
        this.validateVariable(variables[variable.name], variable.validation);
      }
    }

    // Apply variables to _template
    const _config = this.applyTemplatVariables(_template._config, variables);
    config.id = this.generateDashboardId();

    await this.createDashboard(_config as DashboardConfig);
    return _config as DashboardConfig;
  }

  private applyTemplatVariables(
    _config: unknown,
    variables: Record<string, any>,
  ): unknown {
    const _json = JSON.stringify(_config);
    const _processed = _json.replace(/\$\{(\w+)\}/g, (match, varName) => {
      return variables[varName] !== undefined ? variables[varName] : match;
    });
    return JSON.parse(_processed);
  }

  private validateVariable(_value: unknown, rule: ValidationRule): void {
    switch (rule.type) {
      case "regex":
        if (!new RegExp(rule.config.pattern).test(String(_value))) {
          throw new Error(
            `Value does not match pattern: ${rule.config.pattern}`,
          );
        }
        break;
      case "_range":
        {
          const _num = Number(_value);
          if (_num < rule.config.min || _num > rule.config.max) {
            throw new Error(
              `Value must be between ${rule.config.min} and ${rule.config.max}`,
            );
          }
        }
        break;
      case "enum":
        if (!rule.config.values.includes(_value)) {
          throw new Error(
            `Value must be one of: ${rule.config.values.join(", ")}`,
          );
        }
        break;
    }
  }

  // Utility methods
  private validateDashboardConfig(_config: DashboardConfig): void {
    if (!_config.id || !_config.name) {
      throw new Error("Dashboard must have id and name");
    }

    if (!_config.panels || _config.panels.length === 0) {
      throw new Error("Dashboard must have at least one panel");
    }
  }

  private generateCacheKey(panel: DashboardPanel): string {
    return createHash("sha256")
      .update(
        JSON.stringify({
          panelId: panel.id,
          query: panel.dataSource.query,
          params: panel.dataSource.params,
        }),
      )
      .digest("hex");
  }

  private isCacheValid(_cached: unknown, ttl: number): boolean {
    return Date.now() - _cached.timestamp.getTime() < ttl * 1000;
  }

  private generateTraceId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  private generateSpanId(): string {
    return Math.random().toString(36).substring(2, 10);
  }

  private generateDashboardId(): string {
    return `dashboard_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private initializeBuiltinThemes(): void {
    this.themes.set("default", {
      name: "default",
      colors: {
        primary: "#2196F3",
        secondary: "#FF9800",
        background: "#fafafa",
        surface: "#ffffff",
        text: "#212121",
        border: "#e0e0e0",
        success: "#4CAF50",
        warning: "#FF9800",
        _error: "#F44336",
      },
      typography: {
        fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
        sizes: { xs: 12, sm: 14, md: 16, lg: 18, xl: 24, xxl: 32 },
        weights: { normal: 400, semibold: 600, bold: 700 },
      },
      spacing: {
        unit: 8,
        scale: [0, 4, 8, 12, 16, 24, 32, 48],
      },
      shadows: {
        panel: "0 2px 4px rgba(0,0,0,0.1)",
        elevated: "0 4px 8px rgba(0,0,0,0.15)",
      },
    });

    this.themes.set("dark", {
      name: "dark",
      colors: {
        primary: "#90CAF9",
        secondary: "#FFB74D",
        background: "#121212",
        surface: "#1e1e1e",
        text: "#ffffff",
        border: "#333333",
        success: "#81C784",
        warning: "#FFB74D",
        _error: "#E57373",
      },
      typography: {
        fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
        sizes: { xs: 12, sm: 14, md: 16, lg: 18, xl: 24, xxl: 32 },
        weights: { normal: 400, semibold: 600, bold: 700 },
      },
      spacing: {
        unit: 8,
        scale: [0, 4, 8, 12, 16, 24, 32, 48],
      },
      shadows: {
        panel: "0 2px 4px rgba(0,0,0,0.3)",
        elevated: "0 4px 8px rgba(0,0,0,0.4)",
      },
    });
  }

  private initializeBuiltinTemplates(): void {
    // System monitoring _template
    this.templates.set("system-overview", {
      id: "system-overview",
      name: "System Overview",
      category: "system",
      description: "Comprehensive system monitoring dashboard",
      tags: ["system", "monitoring", "infrastructure"],
      _config: {
        name: "System Overview - ${environment}",
        layout: {
          type: "grid",
          columns: 4,
          gap: 16,
          responsive: true,
          breakpoints: Record<string, any>,
        },
        panels: [
          {
            id: "cpu-usage",
            _title: "CPU Usage",
            type: "metric",
            position: { x: 0, y: 0 },
            size: { _width: 1, _height: 1 },
            dataSource: {
              type: "metrics",
              query: 'cpu_usage{instance="${instance}"}',
              params: Record<string, any>,
              cache: { enabled: true, ttl: 30 },
            },
            visualization: { renderer: "canvas", options: Record<string, any> },
            alerts: [],
            interactions: [],
          },
        ],
        refreshInterval: 30000,
        _theme: { name: "default" },
        filters: [],
        variables: [],
        autoRefresh: true,
        permissions: {
          read: ["*"],
          write: ["admin"],
          admin: ["admin"],
          public: true,
        },
      } as any,
      variables: [
        {
          name: "environment",
          type: "string",
          description: "Environment name (dev, staging, prod)",
          defaultValue: "production",
          required: true,
          validation: {
            type: "enum",
            _config: { _values: ["dev", "staging", "prod"] },
          },
        },
        {
          name: "instance",
          type: "string",
          description: "Instance identifier",
          defaultValue: "*",
          required: false,
        },
      ],
    });

    // Application monitoring _template
    this.templates.set("app-monitoring", {
      id: "app-monitoring",
      name: "Application Monitoring",
      category: "application",
      description: "Application performance and health monitoring",
      tags: ["application", "performance", "health"],
      _config: {
        name: "Application Monitor - ${_service}",
        layout: {
          type: "grid",
          columns: 3,
          gap: 16,
          responsive: true,
          breakpoints: Record<string, any>,
        },
        panels: [
          {
            id: "request-rate",
            _title: "Request Rate",
            type: "chart",
            position: { x: 0, y: 0 },
            size: { _width: 2, _height: 1 },
            dataSource: {
              type: "metrics",
              query: 'http_requests_total{_service="${_service}"}',
              params: Record<string, any>,
              cache: { enabled: true, ttl: 60 },
            },
            visualization: { renderer: "canvas", options: Record<string, any> },
            alerts: [],
            interactions: [],
          },
        ],
        refreshInterval: 60000,
        _theme: { name: "default" },
        filters: [],
        variables: [],
        autoRefresh: true,
        permissions: {
          read: ["*"],
          write: ["admin"],
          admin: ["admin"],
          public: false,
        },
      } as any,
      variables: [
        {
          name: "_service",
          type: "string",
          description: "Service name",
          required: true,
        },
      ],
    });
  }

  // Public API methods
  async exportDashboard(
    _dashboardId: string,
    format: DashboardExport["format"],
  ): Promise<DashboardExport> {
    const _config = this.dashboards.get(_dashboardId);
    if (!_config) {
      throw new Error(`Dashboard '${_dashboardId}' not found`);
    }

    const _data =
      format === "_json" ? await this.loadDashboard(_dashboardId) : undefined;

    return {
      format,
      _config,
      _data,
      timestamp: new Date(),
    };
  }

  async importDashboard(exportData: DashboardExport): Promise<void> {
    await this.createDashboard(exportData.config);
  }

  listDashboards(): DashboardConfig[] {
    return Array.from(this.dashboards.values());
  }

  listTemplates(): DashboardTemplate[] {
    return Array.from(this.templates.values());
  }

  async deleteDashboard(dashboardId: string): Promise<void> {
    // Stop auto-refresh
    const _timer = this.refreshIntervals.get(dashboardId);
    if (_timer) {
      clearInterval(_timer);
      this.refreshIntervals.delete(dashboardId);
    }

    // Remove from storage
    this.dashboards.delete(dashboardId);
    this.emit("dashboard-deleted", dashboardId);
  }

  destroy(): void {
    // Clear all timers
    for (const _timer of this.refreshIntervals.values()) {
      clearInterval(_timer);
    }
    this.refreshIntervals.clear();

    // Clear caches
    this.dataCache.clear();

    // Remove all listeners
    this.removeAllListeners();
  }
}
