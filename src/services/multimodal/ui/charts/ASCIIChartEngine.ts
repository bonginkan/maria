/**
 * Advanced ASCII Chart Rendering Engine
 * Supports multiple chart types with high-quality terminal graphics
 */

export interface ChartData {
  labels: string[];
  datasets: ChartDataset[];
}

export interface ChartDataset {
  label: string;
  data: number[];
  color?: string;
  style?: 'solid' | 'dotted' | 'dashed';
}

export interface HeatmapData {
  x: string[];
  y: string[];
  values: number[][];
  colorScale?: 'grayscale' | 'thermal' | 'viridis';
}

export interface ChartOptions {
  width?: number;
  height?: number;
  title?: string;
  showAxes?: boolean;
  showLegend?: boolean;
  showGrid?: boolean;
  colors?: string[];
  animation?: boolean;
}

export class ASCIIChartEngine {
  private static readonly CHART_CHARS = {
    // Line chart characters
    line: {
      horizontal: '─',
      vertical: '│',
      point: '●',
      dot: '·',
      intersection: '┼'
    },
    
    // Bar chart characters
    bar: {
      full: '█',
      threeFourths: '▉',
      half: '▌',
      quarter: '▎',
      eighth: '▏'
    },
    
    // Area chart characters
    area: {
      top: '▀',
      bottom: '▄',
      full: '█',
      gradient: ['░', '▒', '▓', '█']
    },
    
    // Pie chart characters
    pie: {
      sectors: ['◐', '◑', '◒', '◓'],
      fill: '█',
      empty: '░'
    },
    
    // Border characters
    border: {
      topLeft: '┌',
      topRight: '┐',
      bottomLeft: '└',
      bottomRight: '┘',
      horizontal: '─',
      vertical: '│',
      cross: '┼'
    }
  };

  private static readonly COLORS = {
    red: 'red-fg',
    green: 'green-fg',
    blue: 'blue-fg',
    yellow: 'yellow-fg',
    magenta: 'magenta-fg',
    cyan: 'cyan-fg',
    white: 'white-fg'
  };

  renderLineChart(data: ChartData, options: ChartOptions = {}): string[] {
    const width = options.width || 60;
    const height = options.height || 20;
    const showAxes = options.showAxes !== false;
    const showGrid = options.showGrid !== false;
    
    const lines: string[] = [];
    
    // Add title
    if (options.title) {
      lines.push(`{center}{bold}${options.title}{/bold}{/center}`);
      lines.push('');
    }
    
    // Calculate data ranges
    const allValues = data.datasets.flatMap(d => d.data);
    const minValue = Math.min(...allValues);
    const maxValue = Math.max(...allValues);
    const range = maxValue - minValue || 1;
    
    // Create drawing grid
    const grid = this.createGrid(width, height);
    
    // Draw grid lines if enabled
    if (showGrid) {
      this.drawGrid(grid, width, height);
    }
    
    // Draw datasets
    data.datasets.forEach((dataset, datasetIndex) => {
      const color = this.getColor(dataset.color, datasetIndex);
      this.drawLineDataset(grid, dataset, minValue, range, width, height, color);
    });
    
    // Convert grid to strings
    for (let y = 0; y < height; y++) {
      lines.push(grid[y].join(''));
    }
    
    // Add axes
    if (showAxes) {
      lines.push(...this.renderAxes(data, minValue, maxValue, width));
    }
    
    // Add legend
    if (options.showLegend && data.datasets.length > 1) {
      lines.push('');
      lines.push(...this.renderLegend(data.datasets));
    }
    
    return lines;
  }

  renderBarChart(data: ChartData, options: ChartOptions = {}): string[] {
    const width = options.width || 60;
    const height = options.height || 20;
    const barWidth = Math.max(1, Math.floor(width / data.labels.length));
    
    const lines: string[] = [];
    
    // Add title
    if (options.title) {
      lines.push(`{center}{bold}${options.title}{/bold}{/center}`);
      lines.push('');
    }
    
    // Calculate data range
    const allValues = data.datasets.flatMap(d => d.data);
    const minValue = Math.min(0, Math.min(...allValues));
    const maxValue = Math.max(...allValues);
    const range = maxValue - minValue || 1;
    
    // Create bars
    for (let y = 0; y < height; y++) {
      let line = '';
      
      for (let i = 0; i < data.labels.length; i++) {
        const value = data.datasets[0]?.data[i] || 0;
        const normalizedValue = (value - minValue) / range;
        const barHeight = Math.floor(normalizedValue * height);
        
        let barSegment = '';
        for (let j = 0; j < barWidth; j++) {
          if (barHeight >= (height - y)) {
            barSegment += ASCIIChartEngine.CHART_CHARS.bar.full;
          } else {
            barSegment += ' ';
          }
        }
        
        line += barSegment;
      }
      
      lines.push(line);
    }
    
    // Add labels
    let labelLine = '';
    for (let i = 0; i < data.labels.length; i++) {
      const label = data.labels[i].substring(0, barWidth);
      labelLine += label.padEnd(barWidth);
    }
    lines.push(labelLine);
    
    return lines;
  }

  renderAreaChart(data: ChartData, options: ChartOptions = {}): string[] {
    const width = options.width || 60;
    const height = options.height || 20;
    
    const lines: string[] = [];
    
    // Add title
    if (options.title) {
      lines.push(`{center}{bold}${options.title}{/bold}{/center}`);
      lines.push('');
    }
    
    // Calculate data range
    const allValues = data.datasets.flatMap(d => d.data);
    const minValue = Math.min(0, Math.min(...allValues));
    const maxValue = Math.max(...allValues);
    const range = maxValue - minValue || 1;
    
    // Create drawing grid
    const grid = this.createGrid(width, height);
    
    // Draw area for each dataset
    data.datasets.forEach((dataset, datasetIndex) => {
      this.drawAreaDataset(grid, dataset, minValue, range, width, height, datasetIndex);
    });
    
    // Convert grid to strings
    for (let y = 0; y < height; y++) {
      lines.push(grid[y].join(''));
    }
    
    return lines;
  }

  renderPieChart(data: ChartData, options: ChartOptions = {}): string[] {
    const size = Math.min(options.width || 30, options.height || 15);
    const radius = Math.floor(size / 2) - 1;
    const centerX = radius;
    const centerY = radius;
    
    const lines: string[] = [];
    
    // Add title
    if (options.title) {
      lines.push(`{center}{bold}${options.title}{/bold}{/center}`);
      lines.push('');
    }
    
    // Calculate percentages
    const values = data.datasets[0]?.data || [];
    const total = values.reduce((sum, v) => sum + v, 0);
    const percentages = values.map(v => v / total);
    
    // Create circle grid
    const grid = this.createGrid(size, size);
    
    // Draw pie sections
    let currentAngle = 0;
    percentages.forEach((percentage, index) => {
      const sectionAngle = percentage * 2 * Math.PI;
      const color = this.getColor(data.datasets[0]?.color, index);
      
      this.drawPieSection(grid, centerX, centerY, radius, currentAngle, currentAngle + sectionAngle, index);
      currentAngle += sectionAngle;
    });
    
    // Convert grid to strings
    for (let y = 0; y < size; y++) {
      lines.push(grid[y].join(''));
    }
    
    // Add legend with percentages
    lines.push('');
    for (let i = 0; i < data.labels.length && i < values.length; i++) {
      const percentage = ((values[i] / total) * 100).toFixed(1);
      const color = this.getColor(data.datasets[0]?.color, i);
      lines.push(`{${color}}█{/${color}} ${data.labels[i]}: ${percentage}%`);
    }
    
    return lines;
  }

  renderHeatmap(data: HeatmapData, options: ChartOptions = {}): string[] {
    const width = options.width || Math.min(60, data.x.length * 2);
    const height = options.height || Math.min(20, data.y.length);
    
    const lines: string[] = [];
    
    // Add title
    if (options.title) {
      lines.push(`{center}{bold}${options.title}{/bold}{/center}`);
      lines.push('');
    }
    
    // Calculate value range
    const allValues = data.values.flat();
    const minValue = Math.min(...allValues);
    const maxValue = Math.max(...allValues);
    const range = maxValue - minValue || 1;
    
    // Render heatmap
    for (let y = 0; y < data.y.length; y++) {
      let line = data.y[y].substring(0, 8).padEnd(8) + ' ';
      
      for (let x = 0; x < data.x.length; x++) {
        const value = data.values[y]?.[x] || 0;
        const intensity = (value - minValue) / range;
        const char = this.getHeatmapChar(intensity, data.colorScale);
        line += char + char; // Double width for better visibility
      }
      
      lines.push(line);
    }
    
    // Add x-axis labels
    let xAxisLine = ''.padEnd(9);
    for (let x = 0; x < data.x.length; x++) {
      const label = data.x[x].substring(0, 2);
      xAxisLine += label.padEnd(2);
    }
    lines.push(xAxisLine);
    
    // Add color scale legend
    lines.push('');
    lines.push(`Scale: ${minValue.toFixed(2)} ${this.getColorScaleBar(data.colorScale)} ${maxValue.toFixed(2)}`);
    
    return lines;
  }

  private createGrid(width: number, height: number): string[][] {
    return Array(height).fill(null).map(() => Array(width).fill(' '));
  }

  private drawGrid(grid: string[][], width: number, height: number): void {
    // Horizontal grid lines
    for (let y = 0; y < height; y += Math.floor(height / 4)) {
      for (let x = 0; x < width; x++) {
        if (grid[y][x] === ' ') {
          grid[y][x] = ASCIIChartEngine.CHART_CHARS.line.horizontal;
        }
      }
    }
    
    // Vertical grid lines
    for (let x = 0; x < width; x += Math.floor(width / 6)) {
      for (let y = 0; y < height; y++) {
        if (grid[y][x] === ' ') {
          grid[y][x] = ASCIIChartEngine.CHART_CHARS.line.vertical;
        } else if (grid[y][x] === ASCIIChartEngine.CHART_CHARS.line.horizontal) {
          grid[y][x] = ASCIIChartEngine.CHART_CHARS.line.intersection;
        }
      }
    }
  }

  private drawLineDataset(
    grid: string[][],
    dataset: ChartDataset,
    minValue: number,
    range: number,
    width: number,
    height: number,
    color: string
  ): void {
    const data = dataset.data;
    
    for (let i = 0; i < data.length && i < width; i++) {
      const value = data[i];
      const normalizedValue = (value - minValue) / range;
      const y = Math.floor((1 - normalizedValue) * (height - 1));
      const x = Math.floor((i / (data.length - 1)) * (width - 1));
      
      if (y >= 0 && y < height && x >= 0 && x < width) {
        grid[y][x] = ASCIIChartEngine.CHART_CHARS.line.point;
        
        // Connect to previous point
        if (i > 0) {
          const prevValue = data[i - 1];
          const prevNormalizedValue = (prevValue - minValue) / range;
          const prevY = Math.floor((1 - prevNormalizedValue) * (height - 1));
          const prevX = Math.floor(((i - 1) / (data.length - 1)) * (width - 1));
          
          this.drawLine(grid, prevX, prevY, x, y);
        }
      }
    }
  }

  private drawAreaDataset(
    grid: string[][],
    dataset: ChartDataset,
    minValue: number,
    range: number,
    width: number,
    height: number,
    datasetIndex: number
  ): void {
    const data = dataset.data;
    
    for (let i = 0; i < data.length; i++) {
      const value = Math.max(0, data[i]); // Area charts typically start from 0
      const normalizedValue = (value - minValue) / range;
      const barHeight = Math.floor(normalizedValue * height);
      const x = Math.floor((i / (data.length - 1)) * (width - 1));
      
      // Fill area from bottom up
      for (let y = height - barHeight; y < height; y++) {
        if (y >= 0 && y < height && x >= 0 && x < width) {
          if (y === height - barHeight) {
            grid[y][x] = ASCIIChartEngine.CHART_CHARS.area.top;
          } else {
            grid[y][x] = ASCIIChartEngine.CHART_CHARS.area.full;
          }
        }
      }
    }
  }

  private drawPieSection(
    grid: string[][],
    centerX: number,
    centerY: number,
    radius: number,
    startAngle: number,
    endAngle: number,
    sectionIndex: number
  ): void {
    const char = String(sectionIndex + 1);
    
    for (let y = 0; y < grid.length; y++) {
      for (let x = 0; x < grid[0].length; x++) {
        const dx = x - centerX;
        const dy = y - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance <= radius) {
          const angle = Math.atan2(dy, dx) + Math.PI; // Normalize to 0-2π
          if (angle >= startAngle && angle <= endAngle) {
            grid[y][x] = char;
          }
        }
      }
    }
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
          grid[y][x] = ASCIIChartEngine.CHART_CHARS.line.dot;
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

  private renderAxes(data: ChartData, minValue: number, maxValue: number, width: number): string[] {
    const lines: string[] = [];
    
    // Y-axis labels
    const ySteps = 5;
    const yStep = (maxValue - minValue) / ySteps;
    
    let axisLine = '';
    for (let i = 0; i <= ySteps; i++) {
      const value = (minValue + i * yStep).toFixed(1);
      if (i === 0) {
        axisLine += value.padStart(6);
      } else {
        axisLine += value.padStart(Math.floor(width / ySteps));
      }
    }
    lines.push(axisLine);
    
    return lines;
  }

  private renderLegend(datasets: ChartDataset[]): string[] {
    const lines: string[] = [];
    lines.push('{bold}Legend:{/bold}');
    
    datasets.forEach((dataset, index) => {
      const color = this.getColor(dataset.color, index);
      lines.push(`{${color}}█{/${color}} ${dataset.label}`);
    });
    
    return lines;
  }

  private getColor(color: string | undefined, index: number): string {
    if (color && ASCIIChartEngine.COLORS[color as keyof typeof ASCIIChartEngine.COLORS]) {
      return ASCIIChartEngine.COLORS[color as keyof typeof ASCIIChartEngine.COLORS];
    }
    
    const colorKeys = Object.keys(ASCIIChartEngine.COLORS);
    return ASCIIChartEngine.COLORS[colorKeys[index % colorKeys.length] as keyof typeof ASCIIChartEngine.COLORS];
  }

  private getHeatmapChar(intensity: number, colorScale: string = 'grayscale'): string {
    const chars = {
      grayscale: [' ', '░', '▒', '▓', '█'],
      thermal: [' ', '.', ':', ';', '#', '█'],
      viridis: [' ', '·', '∘', '○', '●', '█']
    };
    
    const scaleChars = chars[colorScale as keyof typeof chars] || chars.grayscale;
    const index = Math.floor(intensity * (scaleChars.length - 1));
    return scaleChars[Math.max(0, Math.min(index, scaleChars.length - 1))];
  }

  private getColorScaleBar(colorScale: string = 'grayscale'): string {
    const chars = {
      grayscale: '░▒▓█',
      thermal: '.:;#█',
      viridis: '·∘○●█'
    };
    
    return chars[colorScale as keyof typeof chars] || chars.grayscale;
  }
}