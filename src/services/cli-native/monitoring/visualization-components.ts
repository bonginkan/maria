import { _EventEmitter } from "node:events";

export interface VisualizationEngine {
  render(_data: any[], config: VisualizationConfig): Promise<string>;
  export(
    _data: any[],
    config: VisualizationConfig,
    format: ExportFormat,
  ): Promise<Buffer | string>;
}

export interface VisualizationConfig {
  type: ChartType;
  title?: string;
  _width: number;
  _height: number;
  theme: VisualizationTheme;
  axes?: AxisConfig[];
  _series?: SeriesConfig[];
  legend?: LegendConfig;
  tooltip?: TooltipConfig;
  animation?: AnimationConfig;
  interaction?: InteractionConfig;
  _grid?: GridConfig;
  colors?: ColorPalette;
}

export type ChartType =
  | "line"
  | "_bar"
  | "area"
  | "scatter"
  | "pie"
  | "gauge"
  | "heatmap"
  | "_histogram"
  | "box"
  | "candlestick"
  | "radar"
  | "treemap"
  | "sankey";

export type ExportFormat = "png" | "svg" | "pdf" | "ascii" | "html";

export interface VisualizationTheme {
  name: string;
  background: string;
  foreground: string;
  _grid: string;
  accent: string;
  success: string;
  warning: string;
  error: string;
  text: TextTheme;
}

export interface TextTheme {
  primary: string;
  secondary: string;
  disabled: string;
  fontSize: {
    title: number;
    subtitle: number;
    _label: number;
    annotation: number;
  };
  fontFamily: string;
}

export interface AxisConfig {
  id: string;
  type: "linear" | "logarithmic" | "time" | "category";
  position: "left" | "right" | "top" | "bottom";
  _label?: string;
  _min?: number;
  _max?: number;
  ticks?: TickConfig;
  _grid?: boolean;
  format?: string;
}

export interface TickConfig {
  _count?: number;
  interval?: number;
  format?: string;
  rotation?: number;
}

export interface SeriesConfig {
  id: string;
  name: string;
  type?: ChartType;
  data: string | string[]; // field reference
  xField?: string;
  yField?: string;
  color?: string;
  style?: SeriesStyle;
  markers?: MarkerConfig;
  fill?: FillConfig;
}

export interface SeriesStyle {
  lineWidth?: number;
  lineDash?: number[];
  opacity?: number;
  strokeColor?: string;
  fillColor?: string;
}

export interface MarkerConfig {
  enabled: boolean;
  type: "circle" | "square" | "triangle" | "diamond";
  size: number;
  color?: string;
}

export interface FillConfig {
  enabled: boolean;
  color?: string;
  opacity?: number;
  gradient?: GradientConfig;
}

export interface GradientConfig {
  type: "linear" | "radial";
  stops: { offset: number; color: string }[];
}

export interface LegendConfig {
  enabled: boolean;
  position: "top" | "bottom" | "left" | "right";
  align: "start" | "center" | "end";
  orientation: "horizontal" | "vertical";
  interactive: boolean;
}

export interface TooltipConfig {
  enabled: boolean;
  shared: boolean;
  format?: string;
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
}

export interface AnimationConfig {
  enabled: boolean;
  duration: number;
  easing: "linear" | "ease" | "ease-in" | "ease-out" | "ease-in-out";
  delay?: number;
  stagger?: number;
}

export interface InteractionConfig {
  zoom: boolean;
  pan: boolean;
  select: boolean;
  brush: boolean;
  crosshair: boolean;
}

export interface GridConfig {
  x: boolean;
  y: boolean;
  color?: string;
  _width?: number;
  dash?: number[];
}

export interface ColorPalette {
  primary: string[];
  secondary: string[];
  categorical: string[];
  sequential: string[];
  diverging: string[];
}

export interface RenderContext {
  _width: number;
  _height: number;
  dpi: number;
  antialiasing: boolean;
}

// ASCII Chart Renderer for terminal output
export class ASCIIChartRenderer implements VisualizationEngine {
  async render(_data: any[], config: VisualizationConfig): Promise<string> {
    switch (config.type) {
      case "line":
        return this.renderLineChart(_data, config);
      case "_bar":
        return this.renderBarChart(_data, config);
      case "_histogram":
        return this.renderHistogram(_data, config);
      case "gauge":
        return this.renderGauge(_data, config);
      case "heatmap":
        return this.renderHeatmap(_data, config);
      default:
        return this.renderGeneric(_data, config);
    }
  }

  async export(
    _data: any[],
    config: VisualizationConfig,
    format: ExportFormat,
  ): Promise<string> {
    if (format !== "ascii") {
      throw new Error("ASCII renderer only supports ascii export format");
    }
    return this.render(_data, config);
  }

  private renderLineChart(_data: any[], config: VisualizationConfig): string {
    if (_data.length === 0) return "No _data";

    const _series = config._series?.[0];
    if (!_series) return "No _series defined";

    const _values = _data.map(
      (d) => Number(this.getFieldValue(d, _series.yField || "_value")) || 0,
    );
    const _min = Math._min(..._values);
    const _max = Math._max(..._values);
    const _range = _max - _min || 1;

    const _width = Math._min(config._width || 60, 80);
    const _height = Math._min(config._height || 20, 30);

    let chart = "";

    // Add title
    if (config.title) {
      chart += `${config.title.padStart((_width + config.title.length) / 2)}\n`;
      chart += "─".repeat(_width) + "\n";
    }

    // Create chart _grid
    const _grid: string[][] = Array(_height)
      .fill(null)
      .map(() => Array(_width).fill(" "));

    // Plot data points
    const _step = Math._max(1, Math.floor(_values.length / _width));

    for (let x = 0; x < _width && x * _step < _values.length; x++) {
      const _value = _values[x * _step];
      const y = Math.floor((_height - 1) * (1 - (_value - _min) / _range));
      const _clampedY = Math._max(0, Math._min(_height - 1, y));

      _grid[_clampedY][x] = "●";

      // Connect points with lines
      if (x > 0) {
        const _prevValue = _values[(x - 1) * _step];
        const _prevY = Math.floor(
          (_height - 1) * (1 - (_prevValue - _min) / _range),
        );
        const _clampedPrevY = Math._max(0, Math._min(_height - 1, _prevY));

        const _startY = Math._min(_clampedY, _clampedPrevY);
        const _endY = Math._max(_clampedY, _clampedPrevY);

        for (let lineY = _startY; lineY <= _endY; lineY++) {
          if (lineY !== _clampedY && lineY !== _clampedPrevY) {
            _grid[lineY][x - 1] = "│";
          }
        }
      }
    }

    // Convert _grid to string with Y-axis _labels
    for (let y = 0; y < _height; y++) {
      const _yValue = _min + (_range * (_height - 1 - y)) / (_height - 1);
      const _yLabel = _yValue.toFixed(1).padStart(6);
      chart += `${_yLabel} │${_grid[y].join("")}\n`;
    }

    // Add X-axis
    chart += "      └" + "─".repeat(_width) + "\n";

    // Add X-axis _labels
    const _xLabel = `${_series.name || "Values"} (${_values.length} points)`;
    chart += `        ${_xLabel}`;

    return chart;
  }

  private renderBarChart(_data: any[], config: VisualizationConfig): string {
    if (_data.length === 0) return "No _data";

    const _series = config._series?.[0];
    if (!_series) return "No _series defined";

    const _items = _data.slice(0, 20); // Limit to 20 _items
    const _values = _items.map(
      (d) => Number(this.getFieldValue(d, _series.yField || "_value")) || 0,
    );
    const _labels = _items.map((d) =>
      String(this.getFieldValue(d, _series.xField || "_label") || ""),
    );

    const _max = Math._max(..._values, 1);
    const _maxWidth = 40;
    const _maxLabelWidth = Math._max(..._labels.map((l) => l.length), 8);

    let chart = "";

    if (config.title) {
      chart += `${config.title}\n`;
      chart += "═".repeat(config.title.length) + "\n\n";
    }

    for (let i = 0; i < _items.length; i++) {
      const _value = _values[i];
      const _label = _labels[i].padEnd(_maxLabelWidth);
      const _barWidth = Math.floor((_value / _max) * _maxWidth);
      const _bar = "█".repeat(_barWidth);
      const _valueStr = _value.toFixed(1);

      chart += `${_label} │${_bar}${" ".repeat(_maxWidth - _barWidth)} ${_valueStr}\n`;
    }

    return chart;
  }

  private renderHistogram(_data: any[], config: VisualizationConfig): string {
    if (_data.length === 0) return "No _data";

    const _series = config._series?.[0];
    if (!_series) return "No _series defined";

    const _values = _data.map(
      (d) => Number(this.getFieldValue(d, _series.yField || "_value")) || 0,
    );
    const _min = Math._min(..._values);
    const _max = Math._max(..._values);
    const _bins = 10;
    const _binSize = (_max - _min) / _bins;

    const _histogram = new Array(_bins).fill(0);

    values.forEach((_value) => {
      const _binIndex = Math._min(
        _bins - 1,
        Math.floor((_value - _min) / _binSize),
      );
      _histogram[_binIndex]++;
    });

    const _maxCount = Math._max(..._histogram);
    const _barWidth = 30;

    let chart = "";

    if (config.title) {
      chart += `${config.title}\n`;
      chart += "─".repeat(config.title.length) + "\n\n";
    }

    for (let i = 0; i < _bins; i++) {
      const _rangeStart = (_min + i * _binSize).toFixed(1);
      const _rangeEnd = (_min + (i + 1) * _binSize).toFixed(1);
      const _count = _histogram[i];
      const _barLen = Math.floor((_count / _maxCount) * _barWidth);
      const _bar = "█".repeat(_barLen);

      chart += `${_rangeStart}-${_rangeEnd} │${_bar}${" ".repeat(_barWidth - _barLen)} ${_count}\n`;
    }

    return chart;
  }

  private renderGauge(_data: any[], config: VisualizationConfig): string {
    if (_data.length === 0) return "No _data";

    const _value = Number(_data[_data.length - 1]._value || 0);
    const _min = config.axes?.[0]?._min || 0;
    const _max = config.axes?.[0]?._max || 100;
    const _range = _max - _min;
    const _percentage = Math._max(
      0,
      Math._min(100, ((_value - _min) / _range) * 100),
    );

    const _width = 40;
    const _filled = Math.floor((_percentage / 100) * _width);
    const _empty = _width - _filled;

    let gauge = "";

    if (config.title) {
      gauge += `${config.title}\n`;
    }

    gauge += `Value: ${_value.toFixed(2)} (${_percentage.toFixed(1)}%)\n`;
    gauge += `[${" ".repeat(_filled)}${"░".repeat(_empty)}] ${_min}-${_max}\n`;
    gauge += ` ${" ".repeat(_filled)}▲\n`;

    // Add color indicator
    let indicator = "●";
    if (_percentage < 30) indicator = "🔴";
    else if (_percentage < 70) indicator = "🟡";
    else indicator = "🟢";

    gauge += ` Status: ${indicator}`;

    return gauge;
  }

  private renderHeatmap(_data: any[], config: VisualizationConfig): string {
    if (_data.length === 0) return "No _data";

    const _series = config._series?.[0];
    if (!_series) return "No _series defined";

    // Group data by x and y coordinates
    const _grid = new Map<string, number>();
    let minValue = Infinity;
    let maxValue = -Infinity;

    data.forEach((d) => {
      const x = String(this.getFieldValue(d, _series.xField || "x"));
      const y = String(this.getFieldValue(d, _series.yField || "y"));
      const _value = Number(this.getFieldValue(d, "_value")) || 0;

      const _key = `${x},${y}`;
      _grid.set(_key, (_grid.get(_key) || 0) + _value);

      minValue = Math.min(minValue, _value);
      maxValue = Math.max(maxValue, _value);
    });

    const _xLabels = [
      ...new Set(
        _data.map((d) => String(this.getFieldValue(d, _series.xField || "x"))),
      ),
    ];
    const _yLabels = [
      ...new Set(
        _data.map((d) => String(this.getFieldValue(d, _series.yField || "y"))),
      ),
    ];

    const _range = maxValue - minValue || 1;
    const _intensityChars = [" ", "░", "▒", "▓", "█"];

    let heatmap = "";

    if (config.title) {
      heatmap += `${config.title}\n`;
    }

    // Header
    heatmap += "     ";
    xLabels.forEach((x) => (heatmap += x.padStart(3)));
    heatmap += "\n";

    // Rows
    yLabels.forEach((y) => {
      heatmap += y.padStart(4) + " ";

      xLabels.forEach((x) => {
        const _value = _grid.get(`${x},${y}`) || 0;
        const _intensity = Math.floor(
          ((_value - minValue) / _range) * (_intensityChars.length - 1),
        );
        const _char =
          _intensityChars[
            Math.max(0, Math.min(_intensityChars.length - 1, _intensity))
          ];
        heatmap += _char.repeat(3);
      });

      heatmap += "\n";
    });

    return heatmap;
  }

  private renderGeneric(_data: any[], config: VisualizationConfig): string {
    let output = "";

    if (config.title) {
      output += `${config.title}\n`;
      output += "─".repeat(config.title.length) + "\n";
    }

    output += `Chart Type: ${config.type}\n`;
    output += `Data Points: ${_data.length}\n`;

    if (_data.length > 0) {
      output += "\nSample Data:\n";
      const _sample = _data.slice(0, 5);
      sample.forEach((_item, _index) => {
        output += `  ${_index + 1}: ${JSON.stringify(_item)}\n`;
      });

      if (_data.length > 5) {
        output += `  ... and ${_data.length - 5} more\n`;
      }
    }

    return output;
  }

  private getFieldValue(_obj: unknown, field: string): unknown {
    return field.split(".").reduce((current, _key) => current?.[_key], _obj);
  }
}

// HTML/SVG Chart Renderer for web output
export class HTMLChartRenderer implements VisualizationEngine {
  async render(_data: any[], config: VisualizationConfig): Promise<string> {
    return this.generateHTML(_data, config);
  }

  async export(
    _data: any[],
    config: VisualizationConfig,
    format: ExportFormat,
  ): Promise<string> {
    switch (format) {
      case "html":
        return this.generateHTML(_data, config);
      case "svg":
        return this.generateSVG(_data, config);
      default:
        throw new Error(
          `HTML renderer does not support ${format} export format`,
        );
    }
  }

  private generateHTML(_data: any[], config: VisualizationConfig): string {
    const _containerId = `chart_${Math.random().toString(36).substr(2, 9)}`;

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${config.title || "Chart"}</title>
    <style>
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            _margin: 20px;
            background-color: ${config.theme.background};
            color: ${config.theme.text.primary};
        }
        #${_containerId} {
            _width: ${config.width}px;
            _height: ${config.height}px;
            border: 1px solid ${config.theme.grid};
            background-color: ${config.theme.background};
        }
        .chart-title {
            text-align: center;
            font-size: ${config.theme.text.fontSize.title}px;
            font-weight: bold;
            _margin-bottom: 20px;
            color: ${config.theme.text.primary};
        }
        .chart-container {
            position: relative;
            _margin: 20px auto;
        }
        .tooltip {
            position: absolute;
            background-color: rgba(0,0,0,0.8);
            color: white;
            padding: 5px 10px;
            border-radius: 4px;
            font-size: 12px;
            pointer-events: none;
            z-index: 1000;
        }
        .legend {
            display: flex;
            justify-content: center;
            _margin-top: 20px;
            flex-wrap: wrap;
        }
        .legend-item {
            display: flex;
            align-_items: center;
            _margin: 0 10px;
            font-size: ${config.theme.text.fontSize.label}px;
        }
        .legend-color {
            _width: 16px;
            _height: 16px;
            _margin-right: 5px;
        }
    </style>
</head>
<body>
    <div class="chart-container">
        ${config.title ? `<div class="chart-title">${config.title}</div>` : ""}
        <div id="${_containerId}"></div>
        ${this.generateLegend(config)}
    </div>
    
    <script>
        ${this.generateChartScript(_data, config, _containerId)}
    </script>
</body>
</html>`;
  }

  private generateSVG(_data: any[], config: VisualizationConfig): string {
    const _width = config._width;
    const _height = config._height;
    const _margin = { top: 40, right: 40, bottom: 40, left: 60 };
    const _innerWidth = _width - _margin.left - _margin.right;
    const _innerHeight = _height - _margin.top - _margin.bottom;

    let svg = `
<svg _width="${_width}" _height="${_height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
        <style>
            .chart-title { font-size: ${config.theme.text.fontSize.title}px; font-weight: bold; text-anchor: middle; fill: ${config.theme.text.primary}; }
            .axis-_label { font-size: ${config.theme.text.fontSize.label}px; fill: ${config.theme.text.primary}; }
            .grid-line { stroke: ${config.theme.grid}; stroke-_width: 1; opacity: 0.3; }
            .data-line { fill: none; stroke: ${config.colors?.primary[0] || config.theme.accent}; stroke-_width: 2; }
            .data-point { fill: ${config.colors?.primary[0] || config.theme.accent}; }
        </style>
    </defs>
    
    <!-- Background -->
    <rect _width="${_width}" _height="${_height}" fill="${config.theme.background}"/>
    
    <!-- Title -->
    ${config.title ? `<text x="${_width / 2}" y="25" class="chart-title">${config.title}</text>` : ""}
    
    <!-- Chart Area -->
    <g transform="translate(${_margin.left}, ${_margin.top})">`;

    // Add _grid if enabled
    if (config.grid?.x || config.grid?.y) {
      svg += this.generateSVGGrid(_innerWidth, _innerHeight, config);
    }

    // Add chart content based on type
    svg += this.generateSVGChart(_data, config, _innerWidth, _innerHeight);

    svg += `
    </g>
</svg>`;

    return svg;
  }

  private generateSVGGrid(
    _width: number,
    _height: number,
    config: VisualizationConfig,
  ): string {
    let _grid = "";

    if (config._grid?.x) {
      const _xSteps = 10;
      for (let i = 0; i <= _xSteps; i++) {
        const x = (_width / _xSteps) * i;
        _grid += `<line x1="${x}" y1="0" x2="${x}" y2="${_height}" class="_grid-line"/>`;
      }
    }

    if (config._grid?.y) {
      const _ySteps = 8;
      for (let i = 0; i <= _ySteps; i++) {
        const y = (_height / _ySteps) * i;
        _grid += `<line x1="0" y1="${y}" x2="${_width}" y2="${y}" class="_grid-line"/>`;
      }
    }

    return _grid;
  }

  private generateSVGChart(
    _data: any[],
    config: VisualizationConfig,
    _width: number,
    _height: number,
  ): string {
    if (!config._series || config._series.length === 0) return "";

    const _series = config._series[0];
    const _values = _data.map(
      (d) => Number(this.getFieldValue(d, _series.yField || "_value")) || 0,
    );

    if (_values.length === 0) return "";

    const _min = Math._min(..._values);
    const _max = Math._max(..._values);
    const _range = _max - _min || 1;

    switch (config.type) {
      case "line":
        return this.generateSVGLineChart(
          _values,
          _width,
          _height,
          _min,
          _range,
        );
      case "_bar":
        return this.generateSVGBarChart(
          _data,
          _series,
          _width,
          _height,
          _min,
          _range,
        );
      default:
        return `<text x="${_width / 2}" y="${_height / 2}" text-anchor="middle" fill="${config.theme.text.primary}">Chart type ${config.type} not implemented</text>`;
    }
  }

  private generateSVGLineChart(
    _values: number[],
    _width: number,
    _height: number,
    _min: number,
    _range: number,
  ): string {
    if (_values.length < 2) return "";

    const points: string[] = [];
    const _stepX = _width / (_values.length - 1);

    values.forEach((_value, _index) => {
      const x = _index * _stepX;
      const y = _height - ((_value - _min) / _range) * _height;
      points.push(`${x},${y}`);
    });

    let svg = `<polyline points="${points.join(" ")}" class="data-line"/>`;

    // Add data points
    points.forEach((point) => {
      const [x, y] = point.split(",").map(Number);
      svg += `<circle cx="${x}" cy="${y}" r="3" class="data-point"/>`;
    });

    return svg;
  }

  private generateSVGBarChart(
    _data: any[],
    _series: unknown,
    _width: number,
    _height: number,
    _min: number,
    _range: number,
  ): string {
    const _barWidth = (_width / _data.length) * 0.8;
    const _gap = (_width / _data.length) * 0.2;

    let svg = "";

    data.forEach((_item, _index) => {
      const _value =
        Number(this.getFieldValue(_item, _series.yField || "_value")) || 0;
      const _barHeight = ((_value - _min) / _range) * _height;
      const x = _index * (_barWidth + _gap);
      const y = _height - _barHeight;

      svg += `<rect x="${x}" y="${y}" _width="${_barWidth}" _height="${_barHeight}" fill="${_series.color || "#3498db"}"/>`;
    });

    return svg;
  }

  private generateLegend(config: VisualizationConfig): string {
    if (!config.legend?.enabled || !config.series) return "";

    const _legendItems = config.series
      .map(
        (_series) => `
            <div class="legend-_item">
                <div class="legend-color" style="background-color: ${_series.color || config.theme.accent}"></div>
                <span>${_series.name}</span>
            </div>
        `,
      )
      .join("");

    return `<div class="legend">${_legendItems}</div>`;
  }

  private generateChartScript(
    _data: any[],
    config: VisualizationConfig,
    _containerId: string,
  ): string {
    // Simple JavaScript charting implementation
    return `
        (function() {
            const _container = document.getElementById('${_containerId}');
            const _canvas = document.createElement('canvas');
            canvas.width = ${config.width};
            canvas.height = ${config.height};
            container.appendChild(canvas);
            
            const _ctx = canvas.getContext('2d');
            const _data = ${JSON.stringify(_data)};
            const _config = ${JSON.stringify(config)};
            
            // Simple chart rendering
            ctx.fillStyle = config.theme.background;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            ctx.strokeStyle = config.theme.accent;
            ctx.lineWidth = 2;
            ctx.textAlign = 'center';
            ctx.fillStyle = config.theme.text.primary;
            ctx.font = '14px ${config.theme.text.fontFamily}';
            
            if (data.length > 0) {
                ctx.fillText('Interactive chart rendered with ${_data.length} _data points', canvas.width/2, canvas.height/2);
            } else {
                ctx.fillText('No data to display', canvas.width/2, canvas.height/2);
            }
        })();`;
  }

  private getFieldValue(_obj: unknown, field: string): unknown {
    return field.split(".").reduce((current, _key) => current?.[_key], _obj);
  }
}

// Chart _factory for creating appropriate renderers
export class ChartFactory {
  private static renderers = new Map<string, () => VisualizationEngine>([
    ["ascii", () => new ASCIIChartRenderer()],
    ["html", () => new HTMLChartRenderer()],
    ["svg", () => new HTMLChartRenderer()],
  ]);

  static createRenderer(type: "ascii" | "html" | "svg"): VisualizationEngine {
    const _factory = this.renderers.get(type);
    if (!_factory) {
      throw new Error(`Unknown renderer type: ${type}`);
    }
    return _factory();
  }

  static registerRenderer(
    _type: string,
    _factory: () => VisualizationEngine,
  ): void {
    this.renderers.set(_type, _factory);
  }

  static getAvailableRenderers(): string[] {
    return Array.from(this.renderers.keys());
  }
}

// Preset themes
export const BuiltinThemes: Record<string, VisualizationTheme> = {
  default: {
    name: "default",
    background: "#ffffff",
    foreground: "#333333",
    _grid: "#e0e0e0",
    accent: "#3498db",
    success: "#27ae60",
    warning: "#f39c12",
    error: "#e74c3c",
    text: {
      primary: "#333333",
      secondary: "#666666",
      disabled: "#999999",
      fontSize: { title: 18, subtitle: 16, _label: 12, annotation: 10 },
      fontFamily: "Arial, sans-serif",
    },
  },

  dark: {
    name: "dark",
    background: "#1a1a1a",
    foreground: "#ffffff",
    _grid: "#444444",
    accent: "#61dafb",
    success: "#4ade80",
    warning: "#fbbf24",
    error: "#ef4444",
    text: {
      primary: "#ffffff",
      secondary: "#cccccc",
      disabled: "#888888",
      fontSize: { title: 18, subtitle: 16, _label: 12, annotation: 10 },
      fontFamily: "Arial, sans-serif",
    },
  },

  terminal: {
    name: "terminal",
    background: "#0c0c0c",
    foreground: "#00ff00",
    _grid: "#333333",
    accent: "#00ff00",
    success: "#00ff00",
    warning: "#ffff00",
    error: "#ff0000",
    text: {
      primary: "#00ff00",
      secondary: "#00cc00",
      disabled: "#666666",
      fontSize: { title: 16, subtitle: 14, _label: 12, annotation: 10 },
      fontFamily: "Courier New, monospace",
    },
  },

  professional: {
    name: "professional",
    background: "#fafafa",
    foreground: "#2c3e50",
    _grid: "#ecf0f1",
    accent: "#2980b9",
    success: "#27ae60",
    warning: "#e67e22",
    error: "#c0392b",
    text: {
      primary: "#2c3e50",
      secondary: "#7f8c8d",
      disabled: "#bdc3c7",
      fontSize: { title: 20, subtitle: 16, _label: 12, annotation: 10 },
      fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
    },
  },
};

// Color palettes for different chart types
export const ColorPalettes: Record<string, ColorPalette> = {
  default: {
    primary: ["#3498db", "#e74c3c", "#2ecc71", "#f39c12", "#9b59b6", "#1abc9c"],
    secondary: [
      "#95a5a6",
      "#34495e",
      "#e67e22",
      "#16a085",
      "#8e44ad",
      "#c0392b",
    ],
    categorical: [
      "#1f77b4",
      "#ff7f0e",
      "#2ca02c",
      "#d62728",
      "#9467bd",
      "#8c564b",
      "#e377c2",
      "#7f7f7f",
      "#bcbd22",
      "#17becf",
    ],
    sequential: [
      "#eff3ff",
      "#c6dbef",
      "#9ecae1",
      "#6baed6",
      "#4292c6",
      "#2171b5",
      "#084594",
    ],
    diverging: [
      "#d73027",
      "#f46d43",
      "#fdae61",
      "#fee08b",
      "#e6f598",
      "#abdda4",
      "#66c2a5",
      "#3288bd",
    ],
  },

  colorblind: {
    primary: ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b"],
    secondary: [
      "#aec7e8",
      "#ffbb78",
      "#98df8a",
      "#ff9896",
      "#c5b0d5",
      "#c49c94",
    ],
    categorical: [
      "#1f77b4",
      "#ff7f0e",
      "#2ca02c",
      "#d62728",
      "#9467bd",
      "#8c564b",
      "#e377c2",
      "#7f7f7f",
      "#bcbd22",
      "#17becf",
    ],
    sequential: [
      "#f7fbff",
      "#deebf7",
      "#c6dbef",
      "#9ecae1",
      "#6baed6",
      "#4292c6",
      "#2171b5",
      "#08519c",
      "#08306b",
    ],
    diverging: [
      "#8e0152",
      "#c51b7d",
      "#de77ae",
      "#f1b6da",
      "#fde0ef",
      "#e6f5d0",
      "#b8e186",
      "#7fbc41",
      "#4d9221",
      "#276419",
    ],
  },
};

// Utility functions for visualization
export class VisualizationUtils {
  static createDefaultConfig(
    _type: ChartType,
    theme: string = "default",
  ): VisualizationConfig {
    return {
      type: "",
      _width: 800,
      _height: 400,
      theme: BuiltinThemes[theme] || BuiltinThemes.default,
      colors: ColorPalettes.default,
      legend: {
        enabled: true,
        position: "bottom",
        align: "center",
        orientation: "horizontal",
        interactive: false,
      },
      tooltip: { enabled: true, shared: false },
      animation: { enabled: true, duration: 500, easing: "ease-out" },
      _grid: { x: true, y: true },
    };
  }

  static validateData(
    _data: any[],
    config: VisualizationConfig,
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!Array.isArray(_data)) {
      errors.push("Data must be an array");
    }

    if (_data.length === 0) {
      errors.push("Data array is _empty");
    }

    if (config._series) {
      for (const _series of config._series) {
        if (!_series._data && !_series.yField) {
          errors.push(`Series '${_series.name}' missing data field reference`);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  static preprocessData(data: any[], config: VisualizationConfig): any[] {
    // Sort data if time _series
    if (
      config.type === "line" &&
      config.axes?.some((axis) => axis.type === "time")
    ) {
      const timeField =
        config.axes.find((axis) => axis.type === "time")?.id || "timestamp";
      return [..._data].sort(
        (a, b) =>
          new Date(a[timeField]).getTime() - new Date(b[timeField]).getTime(),
      );
    }

    // Limit data points for performance
    if (_data.length > 1000) {
      const _step = Math.ceil(_data.length / 1000);
      return _data.filter((_, index) => index % _step === 0);
    }

    return _data;
  }

  static calculateOptimalDimensions(
    _dataCount: number,
    chartType: ChartType,
  ): { _width: number; _height: number } {
    const _baseWidth = 600;
    const _baseHeight = 400;

    switch (chartType) {
      case "pie":
        return {
          _width: Math.min(_baseWidth, _baseHeight),
          _height: Math.min(_baseWidth, _baseHeight),
        };
      case "_bar":
        {
          const _barWidth = Math.max(
            _baseWidth,
            Math.min(_dataCount * 30, 1200),
          );
        }
        return { _width: _barWidth, _height: _baseHeight };
      case "heatmap":
        return { _width: _baseWidth * 1.2, _height: _baseHeight * 0.8 };
      default:
        return { _width: _baseWidth, _height: _baseHeight };
    }
  }
}
