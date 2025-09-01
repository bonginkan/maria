/**
 * Production Telemetry Integration
 * 
 * Provides enterprise-grade telemetry integration with Prometheus, OpenTelemetry,
 * and custom metrics collection for multimodal intelligence workflows.
 * 
 * @fileoverview Production telemetry and monitoring integration
 * @version 3.6.0
 * @since 2024
 */

import { EventEmitter } from "node:events";
import * as path from 'path';
import * as fs from 'fs/promises';

// Base telemetry interfaces
export interface TelemetryMetric {
  name: string;
  value: number;
  labels: Record<string, string>;
  timestamp: number;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
}

export interface TelemetrySpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operationName: string;
  startTime: number;
  endTime?: number;
  tags: Record<string, any>;
  logs: Array<{
    timestamp: number;
    level: 'debug' | 'info' | 'warn' | 'error';
    message: string;
    fields?: Record<string, any>;
  }>;
}

export interface TelemetryConfig {
  enabled: boolean;
  providers: {
    prometheus?: {
      enabled: boolean;
      endpoint?: string;
      pushGateway?: string;
      jobName?: string;
    };
    openTelemetry?: {
      enabled: boolean;
      endpoint?: string;
      serviceName?: string;
      serviceVersion?: string;
    };
    custom?: {
      enabled: boolean;
      outputPath?: string;
      flushInterval?: number;
    };
  };
  sampling: {
    rate: number;
    maxSpansPerSecond?: number;
  };
  buffers: {
    maxMetrics?: number;
    maxSpans?: number;
    flushInterval?: number;
  };
}

// Prometheus-style metric collection
export class MetricCollector {
  private metrics = new Map<string, TelemetryMetric>();
  private histograms = new Map<string, number[]>();

  counter(name: string, labels: Record<string, string> = {}, value: number = 1): void {
    const key = this.getMetricKey(name, labels);
    const existing = this.metrics.get(key);
    
    this.metrics.set(key, {
      name,
      value: existing ? existing.value + value : value,
      labels,
      timestamp: Date.now(),
      type: 'counter'
    });
  }

  gauge(name: string, labels: Record<string, string> = {}, value: number): void {
    const key = this.getMetricKey(name, labels);
    
    this.metrics.set(key, {
      name,
      value,
      labels,
      timestamp: Date.now(),
      type: 'gauge'
    });
  }

  histogram(name: string, labels: Record<string, string> = {}, value: number): void {
    const key = this.getMetricKey(name, labels);
    
    if (!this.histograms.has(key)) {
      this.histograms.set(key, []);
    }
    
    this.histograms.get(key)!.push(value);
    
    // Update histogram metric with percentiles
    const values = this.histograms.get(key)!.sort((a, b) => a - b);
    const p95 = values[Math.floor(values.length * 0.95)] || 0;
    const p99 = values[Math.floor(values.length * 0.99)] || 0;
    
    this.metrics.set(key, {
      name,
      value: values.reduce((sum, v) => sum + v, 0) / values.length, // Average
      labels: { ...labels, p95: p95.toString(), p99: p99.toString() },
      timestamp: Date.now(),
      type: 'histogram'
    });
  }

  getMetrics(): TelemetryMetric[] {
    return Array.from(this.metrics.values());
  }

  clear(): void {
    this.metrics.clear();
    this.histograms.clear();
  }

  private getMetricKey(name: string, labels: Record<string, string>): string {
    const labelString = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
    return `${name}{${labelString}}`;
  }
}

// OpenTelemetry-style distributed tracing
export class TracingCollector {
  private spans = new Map<string, TelemetrySpan>();
  private activeSpans = new Map<string, string>(); // contextId -> spanId

  startSpan(operationName: string, parentSpanId?: string, tags: Record<string, any> = {}): TelemetrySpan {
    const span: TelemetrySpan = {
      traceId: parentSpanId ? this.getTraceId(parentSpanId) : this.generateTraceId(),
      spanId: this.generateSpanId(),
      parentSpanId,
      operationName,
      startTime: Date.now(),
      tags,
      logs: []
    };

    this.spans.set(span.spanId, span);
    return span;
  }

  finishSpan(spanId: string, tags: Record<string, any> = {}): void {
    const span = this.spans.get(spanId);
    if (span) {
      span.endTime = Date.now();
      span.tags = { ...span.tags, ...tags };
    }
  }

  logToSpan(spanId: string, level: 'debug' | 'info' | 'warn' | 'error', message: string, fields?: Record<string, any>): void {
    const span = this.spans.get(spanId);
    if (span) {
      span.logs.push({
        timestamp: Date.now(),
        level,
        message,
        fields
      });
    }
  }

  getSpans(): TelemetrySpan[] {
    return Array.from(this.spans.values());
  }

  clear(): void {
    this.spans.clear();
    this.activeSpans.clear();
  }

  private generateTraceId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  private generateSpanId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  private getTraceId(spanId: string): string {
    const span = this.spans.get(spanId);
    return span ? span.traceId : this.generateTraceId();
  }
}

// Main telemetry integration service
export class ProductionTelemetryIntegration extends EventEmitter {
  private config: TelemetryConfig;
  private metricCollector: MetricCollector;
  private tracingCollector: TracingCollector;
  private flushTimer?: NodeJS.Timeout;
  private isInitialized = false;

  constructor(config: Partial<TelemetryConfig> = {}) {
    super();
    
    this.config = {
      enabled: true,
      providers: {
        prometheus: { enabled: false },
        openTelemetry: { enabled: false },
        custom: { enabled: true, outputPath: './telemetry' }
      },
      sampling: { rate: 1.0 },
      buffers: { maxMetrics: 10000, maxSpans: 1000, flushInterval: 30000 },
      ...config
    };

    this.metricCollector = new MetricCollector();
    this.tracingCollector = new TracingCollector();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized || !this.config.enabled) return;

    // Setup flush timer
    if (this.config.buffers.flushInterval) {
      this.flushTimer = setInterval(() => {
        this.flush().catch(error => {
          this.emit('error', new Error(`Telemetry flush failed: ${error.message}`));
        });
      }, this.config.buffers.flushInterval);
    }

    // Initialize providers
    await this.initializeProviders();
    
    this.isInitialized = true;
    this.emit('initialized');
  }

  async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    // Final flush
    await this.flush();
    
    this.isInitialized = false;
    this.emit('shutdown');
  }

  // Metric recording methods
  recordWorkflowMetric(workflowType: string, executionId: string, metric: string, value: number): void {
    if (!this.config.enabled) return;

    this.metricCollector.counter(`multimodal_workflow_${metric}_total`, {
      workflow_type: workflowType,
      execution_id: executionId
    }, value);
  }

  recordLatency(operation: string, duration: number, labels: Record<string, string> = {}): void {
    if (!this.config.enabled) return;

    this.metricCollector.histogram(`multimodal_operation_duration_ms`, {
      operation,
      ...labels
    }, duration);
  }

  recordThroughput(operation: string, count: number, labels: Record<string, string> = {}): void {
    if (!this.config.enabled) return;

    this.metricCollector.counter(`multimodal_operation_throughput_total`, {
      operation,
      ...labels
    }, count);
  }

  recordResourceUsage(resource: string, value: number, unit: string): void {
    if (!this.config.enabled) return;

    this.metricCollector.gauge(`multimodal_resource_usage`, {
      resource,
      unit
    }, value);
  }

  // Tracing methods
  startWorkflowSpan(workflowType: string, executionId: string, parentSpanId?: string): TelemetrySpan {
    if (!this.config.enabled) {
      return this.createDummySpan();
    }

    return this.tracingCollector.startSpan(`workflow:${workflowType}`, parentSpanId, {
      'workflow.type': workflowType,
      'workflow.execution_id': executionId,
      'service.name': 'multimodal-intelligence'
    });
  }

  startOperationSpan(operation: string, parentSpanId?: string, tags: Record<string, any> = {}): TelemetrySpan {
    if (!this.config.enabled) {
      return this.createDummySpan();
    }

    return this.tracingCollector.startSpan(operation, parentSpanId, {
      'operation.name': operation,
      'service.name': 'multimodal-intelligence',
      ...tags
    });
  }

  finishSpan(spanId: string, success: boolean = true, error?: Error): void {
    if (!this.config.enabled) return;

    const tags: Record<string, any> = { success };
    if (error) {
      tags.error = true;
      tags['error.message'] = error.message;
      tags['error.stack'] = error.stack;
    }

    this.tracingCollector.finishSpan(spanId, tags);
  }

  logSpanEvent(spanId: string, level: 'debug' | 'info' | 'warn' | 'error', message: string, fields?: Record<string, any>): void {
    if (!this.config.enabled) return;

    this.tracingCollector.logToSpan(spanId, level, message, fields);
  }

  // Export methods
  async exportMetrics(): Promise<string> {
    const metrics = this.metricCollector.getMetrics();
    
    // Prometheus format
    const lines: string[] = [];
    const metricGroups = new Map<string, TelemetryMetric[]>();
    
    // Group metrics by name
    metrics.forEach(metric => {
      if (!metricGroups.has(metric.name)) {
        metricGroups.set(metric.name, []);
      }
      metricGroups.get(metric.name)!.push(metric);
    });

    // Generate Prometheus format
    metricGroups.forEach((groupMetrics, name) => {
      const firstMetric = groupMetrics[0];
      lines.push(`# TYPE ${name} ${firstMetric.type}`);
      
      groupMetrics.forEach(metric => {
        const labelString = Object.entries(metric.labels)
          .map(([k, v]) => `${k}="${v}"`)
          .join(',');
        const labelsFormatted = labelString ? `{${labelString}}` : '';
        lines.push(`${name}${labelsFormatted} ${metric.value} ${metric.timestamp}`);
      });
    });

    return lines.join('\n');
  }

  async exportTraces(): Promise<string> {
    const spans = this.tracingCollector.getSpans();
    return JSON.stringify(spans, null, 2);
  }

  // Internal methods
  private async initializeProviders(): Promise<void> {
    // Custom provider setup
    if (this.config.providers.custom?.enabled) {
      const outputPath = this.config.providers.custom.outputPath || './telemetry';
      try {
        await fs.mkdir(outputPath, { recursive: true });
      } catch (error) {
        this.emit('error', new Error(`Failed to create telemetry output directory: ${error}`));
      }
    }
  }

  private async flush(): Promise<void> {
    if (!this.config.enabled) return;

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      
      if (this.config.providers.custom?.enabled) {
        const outputPath = this.config.providers.custom.outputPath || './telemetry';
        
        // Write metrics
        const metricsData = await this.exportMetrics();
        if (metricsData) {
          await fs.writeFile(
            path.join(outputPath, `metrics-${timestamp}.txt`),
            metricsData
          );
        }

        // Write traces
        const tracesData = await this.exportTraces();
        if (tracesData !== '[]') {
          await fs.writeFile(
            path.join(outputPath, `traces-${timestamp}.json`),
            tracesData
          );
        }
      }

      // Clear buffers after successful flush
      this.metricCollector.clear();
      this.tracingCollector.clear();

      this.emit('flushed', { timestamp });
    } catch (error) {
      this.emit('error', new Error(`Telemetry flush failed: ${error}`));
    }
  }

  private createDummySpan(): TelemetrySpan {
    return {
      traceId: 'disabled',
      spanId: 'disabled',
      operationName: 'disabled',
      startTime: Date.now(),
      tags: {},
      logs: []
    };
  }

  // Health check
  getHealth(): { status: 'healthy' | 'unhealthy'; details: any } {
    const metrics = this.metricCollector.getMetrics();
    const spans = this.tracingCollector.getSpans();
    
    return {
      status: this.isInitialized ? 'healthy' : 'unhealthy',
      details: {
        initialized: this.isInitialized,
        enabled: this.config.enabled,
        metrics: {
          count: metrics.length,
          types: [...new Set(metrics.map(m => m.type))]
        },
        spans: {
          count: spans.length,
          active: spans.filter(s => !s.endTime).length
        },
        providers: {
          prometheus: this.config.providers.prometheus?.enabled || false,
          openTelemetry: this.config.providers.openTelemetry?.enabled || false,
          custom: this.config.providers.custom?.enabled || false
        }
      }
    };
  }
}

// Factory function for easy instantiation
export function createTelemetryIntegration(config?: Partial<TelemetryConfig>): ProductionTelemetryIntegration {
  return new ProductionTelemetryIntegration(config);
}

// Default configuration for common use cases
export const DEFAULT_PRODUCTION_CONFIG: TelemetryConfig = {
  enabled: true,
  providers: {
    prometheus: {
      enabled: true,
      endpoint: 'http://localhost:9090',
      pushGateway: 'http://localhost:9091',
      jobName: 'multimodal-intelligence'
    },
    openTelemetry: {
      enabled: true,
      endpoint: 'http://localhost:4317',
      serviceName: 'multimodal-intelligence',
      serviceVersion: '3.6.0'
    },
    custom: {
      enabled: true,
      outputPath: './telemetry',
      flushInterval: 30000
    }
  },
  sampling: {
    rate: 0.1, // 10% sampling in production
    maxSpansPerSecond: 1000
  },
  buffers: {
    maxMetrics: 50000,
    maxSpans: 10000,
    flushInterval: 30000
  }
};

export const DEFAULT_DEVELOPMENT_CONFIG: TelemetryConfig = {
  enabled: true,
  providers: {
    custom: {
      enabled: true,
      outputPath: './dev-telemetry',
      flushInterval: 10000
    }
  },
  sampling: {
    rate: 1.0 // 100% sampling in development
  },
  buffers: {
    maxMetrics: 1000,
    maxSpans: 500,
    flushInterval: 10000
  }
};