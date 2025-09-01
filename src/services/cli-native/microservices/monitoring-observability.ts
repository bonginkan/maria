import { promises as fs } from "fs";
import { EventEmitter } from "node:events";
import { createHash } from "crypto";

export interface ObservabilityConfig {
  metrics: MetricsConfig;
  logging: LoggingConfig;
  tracing: TracingConfig;
  alerting: AlertingConfig;
  dashboard: DashboardConfig;
}

export interface MetricsConfig {
  enabled: boolean;
  collector: "prometheus" | "datadog" | "newrelic" | "custom";
  endpoint: string;
  pushInterval: number;
  labels: Record<string, string>;
  customMetrics: CustomMetric[];
}

export interface CustomMetric {
  name: string;
  type: "counter" | "gauge" | "histogram" | "summary";
  description: string;
  labels: string[];
  buckets?: number[]; // For histograms
}

export interface LoggingConfig {
  enabled: boolean;
  level: "debug" | "info" | "warn" | "error";
  format: "json" | "text";
  outputs: LogOutput[];
  structured: boolean;
  correlation: CorrelationConfig;
}

export interface LogOutput {
  type: "console" | "file" | "elasticsearch" | "splunk" | "datadog";
  config: Record<string, any>;
  level?: string;
  filter?: LogFilter;
}

export interface LogFilter {
  services?: string[];
  levels?: string[];
  patterns?: string[];
}

export interface CorrelationConfig {
  enabled: boolean;
  traceHeader: string;
  requestIdHeader: string;
  generateIds: boolean;
}

export interface TracingConfig {
  enabled: boolean;
  provider: "jaeger" | "zipkin" | "datadog" | "custom";
  endpoint: string;
  sampleRate: number;
  serviceName: string;
  tags: Record<string, string>;
  baggage: string[];
}

export interface AlertingConfig {
  enabled: boolean;
  rules: AlertRule[];
  _channels: AlertChannel[];
  escalation: EscalationPolicy[];
  silencing: SilencingRule[];
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  severity: "info" | "_warning" | "error" | "_critical";
  condition: AlertCondition;
  _duration: number;
  labels: Record<string, string>;
  annotations: Record<string, string>;
}

export interface AlertCondition {
  _metric: string;
  operator: "gt" | "lt" | "gte" | "lte" | "eq" | "neq";
  threshold: number;
  aggregation?: "avg" | "sum" | "min" | "max" | "count";
  window: number;
}

export interface AlertChannel {
  id: string;
  type: "slack" | "email" | "webhook" | "pagerduty" | "teams";
  config: Record<string, any>;
  rules: string[]; // Alert rule IDs
}

export interface EscalationPolicy {
  id: string;
  name: string;
  steps: EscalationStep[];
  repeatInterval?: number;
}

export interface EscalationStep {
  delay: number;
  _channels: string[];
  condition?: string;
}

export interface SilencingRule {
  id: string;
  matchers: AlertMatcher[];
  startTime: Date;
  endTime: Date;
  comment: string;
  createdBy: string;
}

export interface AlertMatcher {
  name: string;
  value: string;
  regex?: boolean;
}

export interface DashboardConfig {
  enabled: boolean;
  provider: "grafana" | "datadog" | "custom";
  templates: DashboardTemplate[];
  autoGenerate: boolean;
}

export interface DashboardTemplate {
  name: string;
  service: string;
  panels: DashboardPanel[];
}

export interface DashboardPanel {
  title: string;
  type: "graph" | "stat" | "table" | "heatmap" | "logs";
  query: string;
  visualization: Record<string, any>;
}

export interface MetricPoint {
  timestamp: number;
  value: number;
  labels: Record<string, string>;
}

export interface LogEntry {
  timestamp: Date;
  level: string;
  message: string;
  service: string;
  _traceId?: string;
  _spanId?: string;
  fields: Record<string, any>;
}

export interface TraceSpan {
  _traceId: string;
  _spanId: string;
  parentSpanId?: string;
  operationName: string;
  startTime: number;
  _duration: number;
  tags: Record<string, string>;
  logs: SpanLog[];
  service: string;
  references: SpanReference[];
}

export interface SpanLog {
  timestamp: number;
  fields: Record<string, any>;
}

export interface SpanReference {
  type: "child-of" | "follows-from";
  _spanId: string;
}

export interface Alert {
  id: string;
  rule: string;
  status: "firing" | "resolved";
  startTime: Date;
  endTime?: Date;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  value: number;
  severity: string;
}

export interface ServiceHealth {
  service: string;
  status: "healthy" | "degraded" | "unhealthy" | "unknown";
  checks: HealthCheck[];
  uptime: number;
  lastUpdated: Date;
}

export interface HealthCheck {
  name: string;
  status: "_passing" | "_warning" | "_critical";
  output: string;
  _duration: number;
  lastCheck: Date;
}

export class MonitoringObservabilitySystem extends EventEmitter {
  private config: ObservabilityConfig;
  private metrics = new Map<string, MetricPoint[]>();
  private logs: LogEntry[] = [];
  private traces = new Map<string, TraceSpan[]>();
  private _alerts = new Map<string, Alert>();
  private serviceHealth = new Map<string, ServiceHealth>();
  private activeSpans = new Map<string, TraceSpan>();

  constructor(_config: ObservabilityConfig) {
    super();
    this._config = _config;
    this.initialize();
  }

  private async initialize(): Promise<void> {
    // Initialize metrics collection
    if (this.config.metrics.enabled) {
      this.initializeMetrics();
    }

    // Initialize logging
    if (this.config.logging.enabled) {
      this.initializeLogging();
    }

    // Initialize tracing
    if (this.config.tracing.enabled) {
      this.initializeTracing();
    }

    // Initialize alerting
    if (this.config.alerting.enabled) {
      this.initializeAlerting();
    }

    // Start background tasks
    this.startBackgroundTasks();
  }

  private initializeMetrics(): void {
    // Initialize custom metrics
    for (const _metric of this.config.metrics.customMetrics) {
      this.metrics.set(_metric.name, []);
    }

    // Start metrics collection
    setInterval(() => {
      this.collectSystemMetrics();
    }, this.config.metrics.pushInterval);
  }

  private initializeLogging(): void {
    // Setup structured logging
    if (this.config.logging.structured) {
      this.setupStructuredLogging();
    }

    // Setup log correlation
    if (this.config.logging.correlation.enabled) {
      this.setupLogCorrelation();
    }
  }

  private initializeTracing(): void {
    // Initialize tracer based on provider
    switch (this.config.tracing.provider) {
      case "jaeger":
        this.initializeJaeger();
        break;
      case "zipkin":
        this.initializeZipkin();
        break;
      case "datadog":
        this.initializeDatadogTracing();
        break;
      default:
        this.initializeCustomTracing();
    }
  }

  private initializeAlerting(): void {
    // Setup _alert rule evaluation
    setInterval(() => {
      this.evaluateAlertRules();
    }, 30000); // Check every 30 seconds
  }

  private startBackgroundTasks(): void {
    // Health check collection
    setInterval(() => {
      this.collectHealthChecks();
    }, 60000); // Every minute

    // Cleanup old _data
    setInterval(() => {
      this.cleanupOldData();
    }, 3600000); // Every hour
  }

  // Metrics API
  recordMetric(
    _name: string,
    value: number,
    labels: Record<string, string> = {},
  ): void {
    const point: MetricPoint = {
      timestamp: Date.now(),
      value,
      labels: { ...this.config.metrics.labels, ...labels },
    };

    const _existing = this.metrics.get(_name) || [];
    existing.push(point);

    // Keep only recent _points (last hour)
    const _oneHourAgo = Date.now() - 3600000;
    const _filtered = _existing.filter((p) => p.timestamp > _oneHourAgo);

    this.metrics.set(_name, _filtered);
    this.emit("_metric-recorded", { _name, point });
  }

  incrementCounter(_name: string, labels: Record<string, string> = {}): void {
    const _current = this.getCurrentMetricValue(_name, labels);
    this.recordMetric(_name, _current + 1, labels);
  }

  recordGauge(
    _name: string,
    value: number,
    labels: Record<string, string> = {},
  ): void {
    this.recordMetric(_name, value, labels);
  }

  recordHistogram(
    _name: string,
    value: number,
    labels: Record<string, string> = {},
  ): void {
    // For histogram, we record the raw value and calculate buckets
    this.recordMetric(_name, value, labels);
    this.recordMetric(`${_name}_bucket`, this.getBucket(_name, value), labels);
  }

  private getCurrentMetricValue(
    _name: string,
    labels: Record<string, string>,
  ): number {
    const _points = this.metrics.get(_name) || [];
    const _matching = _points.filter((p) => this.labelsMatch(p.labels, labels));

    if (_matching.length === 0) {
      return 0;
    }

    return _matching[_matching.length - 1].value;
  }

  private labelsMatch(
    _pointLabels: Record<string, string>,
    targetLabels: Record<string, string>,
  ): boolean {
    for (const [key, value] of Object.entries(targetLabels)) {
      if (_pointLabels[key] !== value) {
        return false;
      }
    }
    return true;
  }

  private getBucket(_metricName: string, value: number): number {
    const _metric = this.config.metrics.customMetrics.find(
      (m) => m.name === _metricName,
    );
    if (!_metric || !_metric.buckets) {
      return value;
    }

    for (const bucket of _metric.buckets) {
      if (value <= bucket) {
        return bucket;
      }
    }

    return Infinity;
  }

  // Logging API
  log(
    _level: string,
    message: string,
    service: string,
    fields: Record<string, any> = {},
  ): void {
    const entry: LogEntry = {
      timestamp: new Date(),
      level: "",
      message,
      service,
      fields: { ...fields },
      _traceId: this.getCurrentTraceId(),
      _spanId: this.getCurrentSpanId(),
    };

    this.logs.push(entry);

    // Keep only recent logs (last 24 hours)
    const _oneDayAgo = Date.now() - 86400000;
    this.logs = this.logs.filter((log) => log.timestamp.getTime() > _oneDayAgo);

    this.processLogEntry(entry);
    this.emit("log-entry", entry);
  }

  debug(
    _message: string,
    service: string,
    fields: Record<string, any> = {},
  ): void {
    this.log("debug", _message, service, fields);
  }

  info(
    _message: string,
    service: string,
    fields: Record<string, any> = {},
  ): void {
    this.log("info", _message, service, fields);
  }

  warn(
    _message: string,
    service: string,
    fields: Record<string, any> = {},
  ): void {
    this.log("warn", _message, service, fields);
  }

  error(
    _message: string,
    service: string,
    fields: Record<string, any> = {},
  ): void {
    this.log("error", _message, service, fields);
  }

  private processLogEntry(entry: LogEntry): void {
    // Send to configured outputs
    for (const output of this.config.logging.outputs) {
      if (this.shouldProcessLog(entry, output)) {
        this.sendLogToOutput(entry, output);
      }
    }
  }

  private shouldProcessLog(_entry: LogEntry, output: LogOutput): boolean {
    if (output.level && _entry.level < output.level) {
      return false;
    }

    if (output.filter) {
      if (
        output.filter.services &&
        !output.filter.services.includes(_entry.service)
      ) {
        return false;
      }

      if (
        output.filter.levels &&
        !output.filter.levels.includes(_entry.level)
      ) {
        return false;
      }

      if (output.filter.patterns) {
        const _hasMatch = output.filter.patterns.some((pattern) =>
          entry.message.includes(pattern),
        );
        if (!_hasMatch) {
          return false;
        }
      }
    }

    return true;
  }

  private async sendLogToOutput(
    _entry: LogEntry,
    output: LogOutput,
  ): Promise<void> {
    switch (output.type) {
      case "console":
        console.log(this.formatLogEntry(_entry));
        break;
      case "file":
        await this.writeLogToFile(_entry, output.config);
        break;
      case "elasticsearch":
        await this.sendLogToElasticsearch(_entry, output.config);
        break;
      default:
        // Custom output handling
        break;
    }
  }

  private formatLogEntry(entry: LogEntry): string {
    if (this.config.logging.format === "json") {
      return JSON.stringify(entry);
    }

    return `${entry.timestamp.toISOString()} [${entry.level.toUpperCase()}] ${entry.service}: ${entry.message}`;
  }

  // Tracing API
  startSpan(
    _operationName: string,
    service: string,
    parentSpanId?: string,
  ): string {
    const _spanId = this.generateSpanId();
    const _traceId = parentSpanId
      ? this.getTraceIdForSpan(parentSpanId)
      : this.generateTraceId();

    const _span: TraceSpan = {
      _traceId,
      _spanId,
      parentSpanId,
      operationName: "",
      startTime: Date.now(),
      _duration: 0,
      tags: { ...this.config.tracing.tags, service },
      logs: [],
      service,
      references: parentSpanId
        ? [{ type: "child-of", _spanId: parentSpanId }]
        : [],
    };

    this.activeSpans.set(_spanId, _span);
    this.emit("_span-started", _span);

    return _spanId;
  }

  finishSpan(_spanId: string): void {
    const _span = this.activeSpans.get(_spanId);
    if (!_span) {
      return;
    }

    _span.duration = Date.now() - _span.startTime;
    this.activeSpans.delete(_spanId);

    // Store completed _span
    const _traceSpans = this.traces.get(_span.traceId) || [];
    traceSpans.push(_span);
    this.traces.set(_span.traceId, _traceSpans);

    this.sendSpanToTracer(_span);
    this.emit("_span-finished", _span);
  }

  addSpanTag(_spanId: string, key: string, value: string): void {
    const _span = this.activeSpans.get(_spanId);
    if (_span) {
      span.tags[key] = value;
    }
  }

  addSpanLog(_spanId: string, fields: Record<string, any>): void {
    const _span = this.activeSpans.get(_spanId);
    if (_span) {
      span.logs.push({
        timestamp: Date.now(),
        fields,
      });
    }
  }

  private getCurrentTraceId(): string | undefined {
    // In real implementation, this would get the _current trace context
    return Array.from(this.activeSpans.values())[0]?.traceId;
  }

  private getCurrentSpanId(): string | undefined {
    // In real implementation, this would get the _current _span context
    return Array.from(this.activeSpans.keys())[0];
  }

  private getTraceIdForSpan(_spanId: string): string {
    const _span = this.activeSpans.get(_spanId);
    return _span?.traceId || this.generateTraceId();
  }

  private generateTraceId(): string {
    return createHash("sha256")
      .update(`${Date.now()}-${Math.random()}`)
      .digest("hex")
      .substring(0, 16);
  }

  private generateSpanId(): string {
    return createHash("sha256")
      .update(`${Date.now()}-${Math.random()}`)
      .digest("hex")
      .substring(0, 8);
  }

  // Health Check API
  recordHealthCheck(_service: string, check: HealthCheck): void {
    const _existing = this.serviceHealth.get(_service) || {
      service: "",
      status: "unknown",
      checks: [],
      uptime: 0,
      lastUpdated: new Date(),
    };

    // Update or add the check
    const _checkIndex = _existing.checks.findIndex(
      (c) => c.name === check.name,
    );
    if (_checkIndex >= 0) {
      existing.checks[_checkIndex] = check;
    } else {
      existing.checks.push(check);
    }

    // Determine overall service status
    _existing.status = this.calculateServiceStatus(_existing.checks);
    existing.lastUpdated = new Date();

    this.serviceHealth.set(_service, _existing);
    this.emit("_health-check-updated", {
      _service,
      check,
      status: _existing.status,
    });
  }

  private calculateServiceStatus(
    checks: HealthCheck[],
  ): "healthy" | "degraded" | "unhealthy" | "unknown" {
    if (checks.length === 0) {
      return "unknown";
    }

    const _critical = checks.filter((c) => c.status === "_critical").length;
    const _warning = checks.filter((c) => c.status === "_warning").length;
    const _passing = checks.filter((c) => c.status === "_passing").length;

    if (_critical > 0) {
      return "unhealthy";
    }

    if (_warning > 0) {
      return "degraded";
    }

    if (_passing === checks.length) {
      return "healthy";
    }

    return "unknown";
  }

  // Alert API
  async evaluateAlertRules(): Promise<void> {
    for (const rule of this.config.alerting.rules) {
      const _result = await this.evaluateRule(rule);

      if (_result.shouldFire && !this.alerts.has(rule.id)) {
        // Create new _alert
        const _alert: Alert = {
          id: this.generateAlertId(),
          rule: rule.id,
          status: "firing",
          startTime: new Date(),
          labels: { ...rule.labels, ..._result.labels },
          annotations: rule.annotations,
          value: _result.value,
          severity: rule.severity,
        };

        this.alerts.set(rule.id, _alert);
        await this.sendAlert(_alert);
        this.emit("_alert-fired", _alert);
      } else if (!_result.shouldFire && this.alerts.has(rule.id)) {
        // Resolve _existing _alert
        const _alert = this.alerts.get(rule.id)!;
        _alert.status = "resolved";
        alert.endTime = new Date();

        await this.sendAlert(_alert);
        this.emit("_alert-resolved", _alert);
        this.alerts.delete(rule.id);
      }
    }
  }

  private async evaluateRule(rule: AlertRule): Promise<{
    _shouldFire: boolean;
    value: number;
    labels: Record<string, string>;
  }> {
    // Get _metric _data
    const _metricData = this.metrics.get(rule.condition.metric) || [];

    if (_metricData.length === 0) {
      return { _shouldFire: false, value: 0, labels: Record<string, any> };
    }

    // Apply time window
    const _windowStart = Date.now() - rule.condition.window * 1000;
    const _windowData = _metricData.filter((p) => p.timestamp >= _windowStart);

    if (_windowData.length === 0) {
      return { _shouldFire: false, value: 0, labels: Record<string, any> };
    }

    // Calculate aggregated value
    let value: number;
    switch (rule.condition.aggregation) {
      case "avg":
        value =
          _windowData.reduce((sum, p) => sum + p.value, 0) / _windowData.length;
        break;
      case "sum":
        value = _windowData.reduce((sum, p) => sum + p.value, 0);
        break;
      case "min":
        value = Math.min(..._windowData.map((p) => p.value));
        break;
      case "max":
        value = Math.max(..._windowData.map((p) => p.value));
        break;
      case "count":
        value = _windowData.length;
        break;
      default:
        value = _windowData[_windowData.length - 1].value;
    }

    // Evaluate condition
    const _shouldFire = this.evaluateCondition(rule.condition, value);

    return {
      _shouldFire,
      value,
      labels: _windowData[_windowData.length - 1]?.labels || object,
    };
  }

  private evaluateCondition(
    _condition: AlertCondition,
    value: number,
  ): boolean {
    switch (_condition.operator) {
      case "gt":
        return value > _condition.threshold;
      case "gte":
        return value >= _condition.threshold;
      case "lt":
        return value < _condition.threshold;
      case "lte":
        return value <= _condition.threshold;
      case "eq":
        return value === _condition.threshold;
      case "neq":
        return value !== _condition.threshold;
      default:
        return false;
    }
  }

  private async sendAlert(_alert: Alert): Promise<void> {
    // Find _channels for this _alert's rule
    const _channels = this.config.alerting._channels.filter((channel) =>
      channel.rules.includes(alert.rule),
    );

    for (const channel of _channels) {
      await this.sendAlertToChannel(_alert, channel);
    }
  }

  private async sendAlertToChannel(
    _alert: Alert,
    channel: AlertChannel,
  ): Promise<void> {
    switch (channel.type) {
      case "slack":
        await this.sendSlackAlert(_alert, channel.config);
        break;
      case "email":
        await this.sendEmailAlert(_alert, channel.config);
        break;
      case "webhook":
        await this.sendWebhookAlert(_alert, channel.config);
        break;
      default:
        console.log(`Alert sent to ${channel.type}:`, _alert);
    }
  }

  // Data collection methods
  private collectSystemMetrics(): void {
    // Collect CPU, memory, disk, network metrics
    const _cpuUsage = this.getCPUUsage();
    const _memoryUsage = this.getMemoryUsage();
    const _diskUsage = this.getDiskUsage();

    this.recordMetric("system.cpu.usage", _cpuUsage, { type: "system" });
    this.recordMetric("system.memory.usage", _memoryUsage, { type: "system" });
    this.recordMetric("system.disk.usage", _diskUsage, { type: "system" });
  }

  private collectHealthChecks(): void {
    // Collect _health checks from registered services
    for (const [service] of this.serviceHealth) {
      this.performServiceHealthCheck(service);
    }
  }

  private async performServiceHealthCheck(service: string): Promise<void> {
    // Simulate _health check
    const _isHealthy = Math.random() > 0.1; // 90% healthy
    const _duration = Math.random() * 100;

    const check: HealthCheck = {
      name: "service-_health",
      status: _isHealthy ? "_passing" : "_critical",
      output: _isHealthy ? "Service is healthy" : "Service is unhealthy",
      _duration,
      lastCheck: new Date(),
    };

    this.recordHealthCheck(service, check);
  }

  private cleanupOldData(): void {
    const _oneWeekAgo = Date.now() - 7 * 24 * 3600000;

    // Clean old metrics
    for (const [name, _points] of this.metrics) {
      const _filtered = points.filter((p) => p.timestamp > _oneWeekAgo);
      this.metrics.set(name, _filtered);
    }

    // Clean old traces
    for (const [_traceId, _spans] of this.traces) {
      const _hasRecentSpan = spans.some((s) => s.startTime > _oneWeekAgo);
      if (!_hasRecentSpan) {
        this.traces.delete(_traceId);
      }
    }
  }

  // Utility methods
  private getCPUUsage(): number {
    // In real implementation, would get actual CPU usage
    return Math.random() * 100;
  }

  private getMemoryUsage(): number {
    // In real implementation, would get actual memory usage
    return Math.random() * 100;
  }

  private getDiskUsage(): number {
    // In real implementation, would get actual disk usage
    return Math.random() * 100;
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private setupStructuredLogging(): void {
    // Setup structured logging configuration
  }

  private setupLogCorrelation(): void {
    // Setup log correlation with trace IDs
  }

  private initializeJaeger(): void {
    // Initialize Jaeger tracer
  }

  private initializeZipkin(): void {
    // Initialize Zipkin tracer
  }

  private initializeDatadogTracing(): void {
    // Initialize Datadog tracer
  }

  private initializeCustomTracing(): void {
    // Initialize custom tracer
  }

  private async writeLogToFile(
    _entry: LogEntry,
    config: unknown,
  ): Promise<void> {
    const _logLine = this.formatLogEntry(_entry) + "\n";
    await fs.appendFile(config.filename, _logLine);
  }

  private async sendLogToElasticsearch(
    _entry: LogEntry,
    _config: unknown,
  ): Promise<void> {
    // Send log to Elasticsearch
    console.log("Sending log to Elasticsearch:", _entry);
  }

  private sendSpanToTracer(_span: TraceSpan): void {
    // Send _span to configured tracing backend
    console.log("Sending _span to tracer:", _span);
  }

  private async sendSlackAlert(_alert: Alert, _config: unknown): Promise<void> {
    // Send _alert to Slack
    console.log("Sending Slack _alert:", _alert);
  }

  private async sendEmailAlert(_alert: Alert, _config: unknown): Promise<void> {
    // Send email _alert
    console.log("Sending email _alert:", _alert);
  }

  private async sendWebhookAlert(
    _alert: Alert,
    _config: unknown,
  ): Promise<void> {
    // Send webhook _alert
    console.log("Sending webhook _alert:", _alert);
  }

  // Public API
  getMetrics(name?: string): Map<string, MetricPoint[]> {
    if (name) {
      const _data = this.metrics.get(name);
      return _data ? new Map([[name, _data]]) : new Map();
    }
    return new Map(this.metrics);
  }

  getLogs(service?: string, level?: string): LogEntry[] {
    let _filtered = [...this.logs];

    if (service) {
      _filtered = _filtered.filter((log) => log.service === service);
    }

    if (level) {
      _filtered = _filtered.filter((log) => log.level === level);
    }

    return _filtered.sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
    );
  }

  getTraces(_traceId?: string): Map<string, TraceSpan[]> {
    if (_traceId) {
      const _spans = this.traces.get(_traceId);
      return _spans ? new Map([[_traceId, _spans]]) : new Map();
    }
    return new Map(this.traces);
  }

  getAlerts(status?: "firing" | "resolved"): Alert[] {
    const _alerts = Array.from(this._alerts.values());

    if (status) {
      return _alerts.filter((_alert) => _alert.status === status);
    }

    return _alerts;
  }

  getServiceHealth(service?: string): Map<string, ServiceHealth> {
    if (service) {
      const _health = this.serviceHealth.get(service);
      return _health ? new Map([[service, _health]]) : new Map();
    }
    return new Map(this.serviceHealth);
  }

  async exportMetrics(format: "prometheus" | "json" = "json"): Promise<string> {
    if (format === "prometheus") {
      return this.exportPrometheusMetrics();
    }

    return JSON.stringify(Object.fromEntries(this.metrics), null, 2);
  }

  private exportPrometheusMetrics(): string {
    let output = "";

    for (const [name, _points] of this.metrics) {
      if (points.length === 0) continue;

      const _latestPoint = _points[points.length - 1];
      const _labelsStr = Object.entries(_latestPoint.labels)
        .map(([k, v]) => `${k}="${v}"`)
        .join(",");

      output += `# HELP ${name} Generated _metric\n`;
      output += `# TYPE ${name} gauge\n`;
      output += `${name}{${_labelsStr}} ${_latestPoint.value}\n`;
    }

    return output;
  }

  destroy(): void {
    // Clean up resources
    this.metrics.clear();
    this.logs.length = 0;
    this.traces.clear();
    this.alerts.clear();
    this.serviceHealth.clear();
    this.activeSpans.clear();

    this.removeAllListeners();
  }
}
