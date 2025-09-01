/**
 * Real-time Chart Widget
 * Displays time-series data with ASCII art charts
 */

import { BaseWidget, WidgetOptions } from './BaseWidget.js';

export interface ChartData {
  value: number;
  timestamp: Date;
  label?: string;
}

export interface ChartWidgetState {
  data: ChartData[];
  maxPoints: number;
  autoScale: boolean;
  minValue?: number;
  maxValue?: number;
  showGrid: boolean;
  showLabels: boolean;
}

export interface ChartWidgetOptions extends WidgetOptions {
  maxPoints?: number;
  autoScale?: boolean;
  minValue?: number;
  maxValue?: number;
  showGrid?: boolean;
  showLabels?: boolean;
  chartType?: 'line' | 'bar' | 'area';
}

export class ChartWidget extends BaseWidget<ChartWidgetState> {
  private chartType: 'line' | 'bar' | 'area';
  private updateInterval?: NodeJS.Timeout;

  constructor(
    screen: any,
    options: ChartWidgetOptions
  ) {
    const initialState: ChartWidgetState = {
      data: [],
      maxPoints: options.maxPoints || 50,
      autoScale: options.autoScale !== false,
      minValue: options.minValue,
      maxValue: options.maxValue,
      showGrid: options.showGrid !== false,
      showLabels: options.showLabels !== false
    };

    super(screen, options, initialState);
    this.chartType = options.chartType || 'line';
  }

  protected onMount(): void {
    // Start auto-refresh
    this.updateInterval = setInterval(() => {
      this.render();
    }, 200); // 5fps updates
  }

  protected onUnmount(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
  }

  // Public API
  addDataPoint(point: ChartData): void {
    const newData = [...this.getState().data, point];
    
    // Limit to maxPoints
    if (newData.length > this.getState().maxPoints) {
      newData.shift();
    }

    this.setState({ data: newData });
  }

  addValue(value: number, label?: string): void {
    this.addDataPoint({
      value,
      timestamp: new Date(),
      label
    });
  }

  clearData(): void {
    this.setState({ data: [] });
  }

  setMaxPoints(maxPoints: number): void {
    this.setState({ maxPoints });
  }

  render(): void {
    const state = this.getState();
    
    if (state.data.length === 0) {
      this.setContent('No data available');
      return;
    }

    let content = '';

    // Title and stats
    const latest = state.data[state.data.length - 1];
    const min = Math.min(...state.data.map(d => d.value));
    const max = Math.max(...state.data.map(d => d.value));
    const avg = state.data.reduce((sum, d) => sum + d.value, 0) / state.data.length;

    content += `{bold}${this.options.title || 'Chart'}{/bold}\n`;
    content += '━'.repeat(this.width - 4) + '\n';
    content += `Current: {bold}{green-fg}${latest.value.toFixed(2)}{/green-fg}{/bold}`;
    content += ` | Avg: ${avg.toFixed(2)} | Range: ${min.toFixed(2)}-${max.toFixed(2)}\n\n`;

    // Generate chart
    const chartLines = this.generateChart(state.data);
    content += chartLines.join('\n');

    // Time axis
    if (state.showLabels) {
      const oldestTime = state.data[0].timestamp;
      const newestTime = latest.timestamp;
      content += '\n';
      content += `{dim}${oldestTime.toLocaleTimeString()}`;
      const padding = this.width - oldestTime.toLocaleTimeString().length - newestTime.toLocaleTimeString().length - 8;
      content += ' '.repeat(Math.max(0, padding));
      content += `${newestTime.toLocaleTimeString()}{/dim}`;
    }

    this.setContent(content);
  }

  private generateChart(data: ChartData[]): string[] {
    const chartHeight = Math.max(8, Math.floor((this.height - 8) * 0.8));
    const chartWidth = Math.max(20, this.width - 6);
    
    const state = this.getState();
    let minVal = state.minValue !== undefined ? state.minValue : Math.min(...data.map(d => d.value));
    let maxVal = state.maxValue !== undefined ? state.maxValue : Math.max(...data.map(d => d.value));
    
    // Add some padding to the range
    if (state.autoScale && minVal !== maxVal) {
      const range = maxVal - minVal;
      minVal -= range * 0.1;
      maxVal += range * 0.1;
    }
    
    const lines: string[] = [];

    switch (this.chartType) {
      case 'line':
        return this.generateLineChart(data, chartWidth, chartHeight, minVal, maxVal);
      case 'bar':
        return this.generateBarChart(data, chartWidth, chartHeight, minVal, maxVal);
      case 'area':
        return this.generateAreaChart(data, chartWidth, chartHeight, minVal, maxVal);
      default:
        return this.generateLineChart(data, chartWidth, chartHeight, minVal, maxVal);
    }
  }

  private generateLineChart(data: ChartData[], width: number, height: number, minVal: number, maxVal: number): string[] {
    const lines: string[] = [];
    const range = maxVal - minVal || 1;

    // Initialize grid
    const grid: string[][] = Array(height).fill(null).map(() => Array(width).fill(' '));

    // Plot data points
    for (let i = 0; i < data.length && i < width; i++) {
      const value = data[data.length - width + i]?.value || 0;
      const normalizedValue = (value - minVal) / range;
      const y = Math.floor((1 - normalizedValue) * (height - 1));
      const x = i;

      if (y >= 0 && y < height && x >= 0 && x < width) {
        grid[y][x] = '●';
        
        // Connect to previous point with line
        if (i > 0) {
          const prevValue = data[data.length - width + i - 1]?.value || 0;
          const prevNormalizedValue = (prevValue - minVal) / range;
          const prevY = Math.floor((1 - prevNormalizedValue) * (height - 1));
          
          // Draw line between points
          this.drawLine(grid, x - 1, prevY, x, y);
        }
      }
    }

    // Convert grid to strings
    for (let y = 0; y < height; y++) {
      let line = '';
      for (let x = 0; x < width; x++) {
        line += grid[y][x];
      }
      lines.push(line);
    }

    return lines;
  }

  private generateBarChart(data: ChartData[], width: number, height: number, minVal: number, maxVal: number): string[] {
    const lines: string[] = [];
    const range = maxVal - minVal || 1;

    for (let y = 0; y < height; y++) {
      let line = '';
      for (let x = 0; x < width && x < data.length; x++) {
        const value = data[data.length - width + x]?.value || 0;
        const normalizedValue = (value - minVal) / range;
        const barHeight = Math.floor(normalizedValue * height);
        
        if (barHeight >= (height - y)) {
          line += '█';
        } else {
          line += ' ';
        }
      }
      lines.push(line);
    }

    return lines;
  }

  private generateAreaChart(data: ChartData[], width: number, height: number, minVal: number, maxVal: number): string[] {
    const lines: string[] = [];
    const range = maxVal - minVal || 1;

    // Initialize grid
    const grid: string[][] = Array(height).fill(null).map(() => Array(width).fill(' '));

    // Plot area
    for (let x = 0; x < data.length && x < width; x++) {
      const value = data[data.length - width + x]?.value || 0;
      const normalizedValue = (value - minVal) / range;
      const barHeight = Math.floor(normalizedValue * height);
      
      // Fill from bottom up
      for (let y = height - barHeight; y < height; y++) {
        if (y >= 0 && y < height) {
          grid[y][x] = y === height - barHeight ? '▀' : '█';
        }
      }
      
      // Top line
      const topY = height - barHeight;
      if (topY >= 0 && topY < height) {
        grid[topY][x] = '▀';
      }
    }

    // Convert grid to strings
    for (let y = 0; y < height; y++) {
      lines.push(grid[y].join(''));
    }

    return lines;
  }

  private drawLine(grid: string[][], x1: number, y1: number, x2: number, y2: number): void {
    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);
    const sx = x1 < x2 ? 1 : -1;
    const sy = y1 < y2 ? 1 : -1;
    let err = dx - dy;

    let x = x1;
    let y = y1;

    for (;;) {
      if (x >= 0 && x < grid[0].length && y >= 0 && y < grid.length) {
        if (grid[y][x] === ' ') {
          grid[y][x] = '·';
        }
      }

      if (x === x2 && y === y2) break;

      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }
  }
}