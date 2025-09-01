/**
 * Main Multimodal Intelligence Dashboard
 * Integrates all widgets and provides real-time monitoring
 */

import blessed from 'blessed';
import { EventEmitter } from "node:events";
import { ChartWidget, ChartWidgetOptions } from './widgets/ChartWidget.js';
import { StatusWidget, StatusWidgetOptions } from './widgets/StatusWidget.js';
import { MetricWidget, MetricWidgetOptions } from './widgets/MetricWidget.js';
import { BaseWidget } from './widgets/BaseWidget.js';

export interface DashboardConfig {
  title?: string;
  refreshRate?: number;
  enableMouse?: boolean;
  enableKeyboard?: boolean;
  autoHide?: boolean;
  theme?: 'default' | 'dark' | 'light' | 'matrix';
}

export interface LayoutConfig {
  type: 'grid' | 'flex' | 'tabs';
  rows?: number;
  columns?: number;
  widgets: WidgetLayout[];
}

export interface WidgetLayout {
  id: string;
  type: 'chart' | 'status' | 'metric';
  position: {
    x: number | string;
    y: number | string;
    width: number | string;
    height: number | string;
  };
  config: ChartWidgetOptions | StatusWidgetOptions | MetricWidgetOptions;
}

export class MultimodalDashboard extends EventEmitter {
  private screen: blessed.Widgets.Screen;
  private widgets = new Map<string, BaseWidget>();
  private isRunning = false;
  private updateInterval?: NodeJS.Timeout;
  private keyboardHandlers = new Map<string, () => void>();
  
  constructor(
    private config: DashboardConfig = {},
    private layout: LayoutConfig
  ) {
    super();
    this.initializeScreen();
    this.setupGlobalKeyHandlers();
  }

  private initializeScreen(): void {
    this.screen = blessed.screen({
      smartCSR: true,
      title: this.config.title || 'MARIA Multimodal Intelligence Dashboard',
      fullUnicode: true,
      mouse: this.config.enableMouse !== false,
      style: this.getThemeStyle()
    });

    // Global screen event handlers
    this.screen.key(['escape', 'q', 'C-c'], () => {
      this.destroy();
      process.exit(0);
    });
  }

  private getThemeStyle() {
    switch (this.config.theme) {
      case 'dark':
        return { fg: '#ffffff', bg: '#000000' };
      case 'light':
        return { fg: '#000000', bg: '#ffffff' };
      case 'matrix':
        return { fg: '#00ff00', bg: '#000000' };
      default:
        return { fg: 'white', bg: 'black' };
    }
  }

  private setupGlobalKeyHandlers(): void {
    // Help
    this.addKeyHandler('h', () => this.showHelp());
    
    // Refresh
    this.addKeyHandler('r', () => this.refresh());
    
    // Toggle widgets
    this.addKeyHandler('1', () => this.toggleWidget('confidence-chart'));
    this.addKeyHandler('2', () => this.toggleWidget('provider-status'));
    this.addKeyHandler('3', () => this.toggleWidget('system-metrics'));
    
    // Layout switching
    this.addKeyHandler('tab', () => this.focusNextWidget());
    this.addKeyHandler('S-tab', () => this.focusPrevWidget());
  }

  addKeyHandler(key: string, handler: () => void): void {
    this.keyboardHandlers.set(key, handler);
    this.screen.key([key], handler);
  }

  removeKeyHandler(key: string): void {
    const handler = this.keyboardHandlers.get(key);
    if (handler) {
      this.screen.unkey([key], handler);
      this.keyboardHandlers.delete(key);
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) return;

    this.isRunning = true;
    
    // Create widgets from layout
    this.createWidgets();
    
    // Mount all widgets
    for (const widget of this.widgets.values()) {
      widget.mount();
    }

    // Start update loop
    this.startUpdateLoop();
    
    // Initial render
    this.screen.render();
    
    // Setup sample data (for demo)
    this.setupSampleData();
    
    this.emit('started');
  }

  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    
    // Stop update loop
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = undefined;
    }

    // Unmount widgets
    for (const widget of this.widgets.values()) {
      widget.unmount();
    }

    this.emit('stopped');
  }

  destroy(): void {
    this.stop();
    this.widgets.clear();
    this.screen.destroy();
    this.emit('destroyed');
  }

  private createWidgets(): void {
    for (const widgetLayout of this.layout.widgets) {
      const widget = this.createWidget(widgetLayout);
      if (widget) {
        this.widgets.set(widgetLayout.id, widget);
      }
    }
  }

  private createWidget(layout: WidgetLayout): BaseWidget | null {
    const baseOptions = {
      ...layout.config,
      x: layout.position.x,
      y: layout.position.y,
      width: layout.position.width,
      height: layout.position.height
    };

    switch (layout.type) {
      case 'chart':
        return new ChartWidget(this.screen, baseOptions as ChartWidgetOptions);
      case 'status':
        return new StatusWidget(this.screen, baseOptions as StatusWidgetOptions);
      case 'metric':
        return new MetricWidget(this.screen, baseOptions as MetricWidgetOptions);
      default:
        return null;
    }
  }

  private startUpdateLoop(): void {
    const refreshRate = this.config.refreshRate || 1000;
    
    this.updateInterval = setInterval(() => {
      this.updateData();
      this.screen.render();
    }, refreshRate);
  }

  private updateData(): void {
    // Update confidence chart
    const confidenceChart = this.widgets.get('confidence-chart') as ChartWidget;
    if (confidenceChart) {
      const confidence = 0.6 + Math.random() * 0.3;
      confidenceChart.addValue(confidence);
    }

    // Update provider status
    const statusWidget = this.widgets.get('provider-status') as StatusWidget;
    if (statusWidget) {
      const providers = [
        { id: 'openai', name: 'OpenAI GPT-4', status: 'active' as const, value: `${Math.floor(Math.random() * 200 + 50)}ms` },
        { id: 'anthropic', name: 'Anthropic Claude', status: 'active' as const, value: `${Math.floor(Math.random() * 150 + 80)}ms` },
        { id: 'google', name: 'Google Gemini', status: Math.random() > 0.8 ? 'idle' as const : 'active' as const, value: `${Math.floor(Math.random() * 300 + 100)}ms` }
      ];

      providers.forEach(provider => {
        statusWidget.updateStatus({
          ...provider,
          details: `Response time: ${provider.value}`
        });
      });
    }

    // Update system metrics
    const metricWidget = this.widgets.get('system-metrics') as MetricWidget;
    if (metricWidget) {
      // CPU usage
      metricWidget.updateMetric('cpu', Math.random() * 0.8);
      
      // Memory usage
      const memUsage = process.memoryUsage();
      metricWidget.updateMetric('memory', memUsage.heapUsed);
      
      // Response time
      metricWidget.updateMetric('latency', Math.random() * 2000 + 100);
    }

    this.emit('dataUpdated');
  }

  private setupSampleData(): void {
    // Setup confidence chart
    const confidenceChart = this.widgets.get('confidence-chart') as ChartWidget;
    if (confidenceChart) {
      // Add initial data points
      for (let i = 0; i < 20; i++) {
        const confidence = 0.6 + Math.random() * 0.3;
        confidenceChart.addValue(confidence);
      }
    }

    // Setup metrics
    const metricWidget = this.widgets.get('system-metrics') as MetricWidget;
    if (metricWidget) {
      metricWidget.addMetric(MetricWidget.createCPUMetric());
      metricWidget.addMetric(MetricWidget.createMemoryMetric());
      metricWidget.addMetric(MetricWidget.createLatencyMetric());
      metricWidget.addMetric(MetricWidget.createConfidenceMetric());
    }
  }

  private showHelp(): void {
    const helpBox = blessed.message({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: 60,
      height: 20,
      label: ' Dashboard Help ',
      content: `
{center}{bold}MARIA Multimodal Intelligence Dashboard{/bold}{/center}

{bold}Navigation:{/bold}
  h         Show this help
  r         Refresh all widgets
  q/ESC     Exit dashboard
  Tab       Focus next widget
  Shift+Tab Focus previous widget

{bold}Widget Controls:{/bold}
  1         Toggle confidence chart
  2         Toggle provider status
  3         Toggle system metrics
  
{bold}Widget-specific:{/bold}
  Enter/Space  Activate focused widget
  Mouse        Click to interact (if enabled)

{center}Press any key to close{/center}
`,
      tags: true,
      hidden: true,
      border: 'line',
      style: {
        fg: 'white',
        bg: 'blue',
        border: { fg: 'cyan' }
      }
    });

    helpBox.show();
    this.screen.render();
    
    helpBox.key(['escape', 'enter', 'q', 'h'], () => {
      helpBox.hide();
      this.screen.render();
    });
  }

  private refresh(): void {
    for (const widget of this.widgets.values()) {
      widget.forceUpdate();
    }
    this.screen.render();
    this.emit('refreshed');
  }

  private toggleWidget(id: string): void {
    const widget = this.widgets.get(id);
    if (widget) {
      if (widget.isVisible) {
        widget.hide();
      } else {
        widget.show();
      }
    }
  }

  private focusNextWidget(): void {
    const widgets = Array.from(this.widgets.values()).filter(w => w.isVisible);
    if (widgets.length === 0) return;

    const currentIndex = widgets.findIndex(w => w.isFocused);
    const nextIndex = (currentIndex + 1) % widgets.length;
    widgets[nextIndex].focus();
  }

  private focusPrevWidget(): void {
    const widgets = Array.from(this.widgets.values()).filter(w => w.isVisible);
    if (widgets.length === 0) return;

    const currentIndex = widgets.findIndex(w => w.isFocused);
    const prevIndex = currentIndex <= 0 ? widgets.length - 1 : currentIndex - 1;
    widgets[prevIndex].focus();
  }

  // Public API for external data updates
  updateConfidenceScore(score: number): void {
    const chart = this.widgets.get('confidence-chart') as ChartWidget;
    if (chart) {
      chart.addValue(score);
    }
  }

  updateProviderStatus(id: string, status: any): void {
    const statusWidget = this.widgets.get('provider-status') as StatusWidget;
    if (statusWidget) {
      statusWidget.updateStatus({ id, ...status });
    }
  }

  updateSystemMetric(id: string, value: number): void {
    const metricWidget = this.widgets.get('system-metrics') as MetricWidget;
    if (metricWidget) {
      metricWidget.updateMetric(id, value);
    }
  }

  getWidget<T extends BaseWidget>(id: string): T | undefined {
    return this.widgets.get(id) as T;
  }

  // Static factory methods for common layouts
  static createDefaultLayout(): LayoutConfig {
    return {
      type: 'grid',
      widgets: [
        {
          id: 'confidence-chart',
          type: 'chart',
          position: { x: 0, y: 3, width: '50%', height: 12 },
          config: {
            title: 'Confidence Score Trend',
            chartType: 'line',
            maxPoints: 50,
            autoScale: true,
            showGrid: true,
            showLabels: true
          }
        },
        {
          id: 'provider-status',
          type: 'status',
          position: { x: '50%', y: 3, width: '50%', height: 12 },
          config: {
            title: 'Provider Status',
            autoRefresh: true,
            showTimestamps: true
          }
        },
        {
          id: 'system-metrics',
          type: 'metric',
          position: { x: 0, y: 15, width: '100%', height: 10 },
          config: {
            title: 'System Metrics',
            sparklineLength: 20,
            showTrends: true
          }
        }
      ]
    };
  }
}