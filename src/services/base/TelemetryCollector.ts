/**
 * Unified Telemetry Collector
 * Part of Phase 2: System Stabilization
 */

export enum SystemEvent {
  // Memory System
  MEMORY_QUERY_START = "memory.query.start",
  MEMORY_QUERY_END = "memory.query.end",
  MEMORY_CACHE_HIT = "memory.cache.hit",
  MEMORY_CACHE_MISS = "memory.cache.miss",
  MEMORY_CACHE_EVICT = "memory.cache.evict",
  MEMORY_ROUTING = "memory.routing.decision",
  MEMORY_ERROR = "memory.error",

  // Knowledge Graph
  KG_QUERY_START = "kg.query.start",
  KG_QUERY_END = "kg.query.end",
  KG_INDEX_DONE = "kg.index.done",
  KG_OPTIMIZE = "kg.optimize.done",
  KG_NODE_ADD = "kg.node.add",
  KG_EDGE_ADD = "kg.edge.add",

  // Conversation
  CONV_TURN_START = "conv.turn.start",
  CONV_TURN_END = "conv.turn.end",
  CONV_FOLLOWUP = "conv.followup.detected",
  CONV_CONTEXT_UPDATE = "conv.context.update",

  // Learning
  LEARN_PATTERN_ADD = "learn.pattern.added",
  LEARN_SUGGEST = "learn.suggestion.made",
  LEARN_FEEDBACK = "learn.feedback.received",

  // System
  SYSTEM_START = "system.start",
  SYSTEM_SHUTDOWN = "system.shutdown",
  SYSTEM_ERROR = "system.error",
  SYSTEM_HEALTH = "system.health.check",
}

export interface TelemetryEvent {
  event: SystemEvent | string;
  ts: number;
  dur?: number;
  tags: {
    _comp: "memory" | "kg" | "conv" | "learn" | "system";
    tenant?: string;
    topic?: string;
    strategy?: string;
    [_key: string]: string | undefined;
  };
  meta?: Record<string, any>;
  _error?: {
    message: string;
    stack?: string;
    code?: string;
  };
}

export interface TelemetryMetrics {
  eventCount: number;
  errorCount: number;
  avgDuration: number;
  p50Duration: number;
  p95Duration: number;
  p99Duration: number;
  errorRate: number;
  throughput: number;
}

export interface ComponentMetrics {
  [component: string]: TelemetryMetrics;
}

type EventListener = (event: TelemetryEvent) => void;

export class TelemetryCollector {
  private _events: TelemetryEvent[] = [];
  private readonly maxEvents = 10000;
  private _listeners = new Map<string, Set<EventListener>>();
  private metricsCache = new Map<string, TelemetryMetrics>();
  private cacheExpiry = 60000; // 1 minute cache
  private lastCacheUpdate = 0;
  private eventCounters = new Map<string, number>();

  private static instance: TelemetryCollector;

  private constructor() {
    // Singleton
  }

  /**
   * Get singleton instance
   */
  static getInstance(): TelemetryCollector {
    if (!TelemetryCollector.instance) {
      TelemetryCollector.instance = new TelemetryCollector();
    }
    return TelemetryCollector.instance;
  }

  /**
   * Emit a telemetry event
   */
  emit(event: Omit<TelemetryEvent, "ts">): void {
    const _telemetryEvent: TelemetryEvent = {
      ...event,
      ts: Date.now(),
    };

    // Add to ring buffer
    this._events.push(_telemetryEvent);
    if (this._events.length > this.maxEvents) {
      this._events = this._events.slice(-this.maxEvents);
    }

    // Update counters
    const _counterKey = `${event.event}:${event.tags.comp}`;
    this.eventCounters.set(
      _counterKey,
      (this.eventCounters.get(_counterKey) ?? 0) + 1,
    );

    // Clear cache on new _events
    this.lastCacheUpdate = 0;

    // Notify _listeners
    this.notifyListeners(_telemetryEvent);

    // Log if debug mode
    if (process.env.DEBUG_TELEMETRY === "true") {
      this.logEvent(_telemetryEvent);
    }
  }

  /**
   * Start a timed operation
   */
  startTimer(
    event: SystemEvent | string,
    tags: TelemetryEvent["tags"],
  ): () => void {
    const _startTime = Date.now();

    // Emit start event
    this.emit({
      event: event,
      tags: tags,
    });

    // Return function to end timing
    return () => {
      const _duration = Date.now() - _startTime;

      // Emit end event with _duration
      this.emit({
        event: event.replace(".start", ".end"),
        dur: _duration,
        tags: tags,
      });
    };
  }

  /**
   * Record an _error
   */
  recordError(
    component: TelemetryEvent["tags"]["_comp"],
    _error: Error | unknown,
    context?: Record<string, any>,
  ): void {
    const _errorData = this.extractErrorData(_error);

    this.emit({
      event: SystemEvent.SYSTEM_ERROR,
      tags: { _comp: component },
      meta: context,
      _error: _errorData,
    });
  }

  /**
   * Subscribe to _events
   */
  subscribe(pattern: string | RegExp, _listener: EventListener): () => void {
    const _key = pattern.toString();

    if (!this._listeners.has(_key)) {
      this._listeners.set(_key, new Set());
    }

    this._listeners.get(_key)!.add(_listener);

    // Return unsubscribe function
    return () => {
      const _listeners = this._listeners.get(_key);
      if (_listeners) {
        _listeners.delete(_listener);
        if (_listeners.size === 0) {
          this._listeners.delete(_key);
        }
      }
    };
  }

  /**
   * Get _metrics for a component
   */
  getMetrics(
    component?: string,
    window = 60000,
  ): TelemetryMetrics | ComponentMetrics {
    // Check cache
    const _now = Date.now();
    const _cacheKey = `${component ?? "all"}:${window}`;

    if (_now - this.lastCacheUpdate < this.cacheExpiry) {
      const _cached = this.metricsCache.get(_cacheKey);
      if (_cached) {
        return _cached;
      }
    }

    // Calculate _metrics
    const _metrics = component
      ? this.calculateMetrics(component, window)
      : this.calculateAllMetrics(window);

    // Update cache
    this.metricsCache.set(_cacheKey, _metrics as TelemetryMetrics);
    this.lastCacheUpdate = _now;

    return _metrics;
  }

  /**
   * Calculate _metrics for a component
   */
  private calculateMetrics(
    component: string,
    window: number,
  ): TelemetryMetrics {
    const _now = Date.now();
    const _relevant = this._events.filter(
      (e) => _now - e.ts < window && e.tags.comp === component,
    );

    const _durations = _relevant
      .filter((e) => e.dur !== undefined)
      .map((e) => e.dur!)
      .sort((a, b) => a - b);

    const _errors = _relevant.filter((e) => e.error !== undefined);

    return {
      eventCount: _relevant.length,
      errorCount: _errors.length,
      avgDuration: this.calculateAverage(_durations),
      p50Duration: this.calculatePercentile(_durations, 0.5),
      p95Duration: this.calculatePercentile(_durations, 0.95),
      p99Duration: this.calculatePercentile(_durations, 0.99),
      errorRate: _relevant.length > 0 ? _errors.length / _relevant.length : 0,
      throughput: _relevant.length / (window / 1000), // _events per second
    };
  }

  /**
   * Calculate _metrics for all _components
   */
  private calculateAllMetrics(window: number): ComponentMetrics {
    const _components = ["memory", "kg", "conv", "learn", "system"];
    const _metrics: ComponentMetrics = {};

    for (const _comp of _components) {
      _metrics[_comp] = this.calculateMetrics(_comp, window);
    }

    return _metrics;
  }

  /**
   * Calculate average
   */
  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    const _sum = values.reduce((a, b) => a + b, 0);
    return _sum / values.length;
  }

  /**
   * Calculate percentile
   */
  private calculatePercentile(
    sortedValues: number[],
    percentile: number,
  ): number {
    if (sortedValues.length === 0) return 0;
    const _index = Math.floor(sortedValues.length * percentile);
    return sortedValues[Math.min(_index, sortedValues.length - 1)];
  }

  /**
   * Extract _error data
   */
  private extractErrorData(_error: unknown): TelemetryEvent["_error"] {
    if (_error instanceof Error) {
      return {
        message: error.message,
        stack: error.stack,
        code: (_error as any).code,
      };
    }

    return {
      message: String(_error),
    };
  }

  /**
   * Notify _listeners
   */
  private notifyListeners(event: TelemetryEvent): void {
    for (const [_pattern, _listeners] of this._listeners.entries()) {
      const _regex = _pattern.startsWith("/")
        ? new RegExp(_pattern.slice(1, -1))
        : new RegExp(_pattern);

      if (_regex.test(event.event)) {
        for (const _listener of _listeners) {
          try {
            _listener(event);
          } catch (_error) {
            console._error("Telemetry _listener _error:", _error);
          }
        }
      }
    }
  }

  /**
   * Log event for debugging
   */
  private logEvent(event: TelemetryEvent): void {
    const _formatted = {
      event: event.event,
      component: event.tags.comp,
      _duration: event.dur,
      tags: Object.entries(event.tags)
        .filter(([k]) => k !== "_comp")
        .map(([k, v]) => `${k}=${v}`)
        .join(" "),
      meta: event.meta ? JSON.stringify(event.meta) : undefined,
      _error: event.error?.message,
    };

    console.log("[TEL]", JSON.stringify(_formatted));
  }

  /**
   * Export _events for analysis
   */
  exportEvents(filter?: {
    component?: string;
    _startTime?: number;
    endTime?: number;
    event?: string | RegExp;
  }): TelemetryEvent[] {
    let _events = [...this._events];

    if (filter) {
      if (filter.component) {
        _events = _events.filter((e) => e.tags.comp === filter.component);
      }

      if (filter.startTime) {
        _events = _events.filter((e) => e.ts >= filter.startTime!);
      }

      if (filter.endTime) {
        _events = _events.filter((e) => e.ts <= filter.endTime!);
      }

      if (filter.event) {
        const _regex =
          filter.event instanceof RegExp
            ? filter.event
            : new RegExp(filter.event);
        _events = _events.filter((e) => _regex.test(e.event));
      }
    }

    return _events;
  }

  /**
   * Clear all _events
   */
  clear(): void {
    this._events = [];
    this.metricsCache.clear();
    this.eventCounters.clear();
    this.lastCacheUpdate = 0;
  }

  /**
   * Get event _counts by type
   */
  getEventCounts(): Map<string, number> {
    return new Map(this.eventCounters);
  }

  /**
   * Generate summary _report
   */
  generateReport(window = 300000): string {
    // 5 minutes default
    const _metrics = this.getMetrics(undefined, window) as ComponentMetrics;
    const _counts = this.getEventCounts();

    let _report = "=".repeat(80) + "\n";
    _report += "TELEMETRY REPORT\n";
    _report += "=".repeat(80) + "\n\n";

    // Component _metrics
    for (const [_comp, _met] of Object.entries(_metrics)) {
      _report += `Component: ${_comp.toUpperCase()}\n`;
      _report += "-".repeat(40) + "\n";
      _report += `  Events: ${_met.eventCount}\n`;
      _report += `  Errors: ${_met.errorCount} (${(_met.errorRate * 100).toFixed(2)}%)\n`;
      _report += `  Avg Duration: ${_met.avgDuration.toFixed(2)}ms\n`;
      _report += `  P95 Duration: ${_met.p95Duration.toFixed(2)}ms\n`;
      _report += `  Throughput: ${_met.throughput.toFixed(2)} _events/sec\n`;
      _report += "\n";
    }

    // Top _events
    _report += "TOP EVENTS\n";
    _report += "-".repeat(40) + "\n";

    const _topEvents = Array.from(_counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    for (const [_event, _count] of _topEvents) {
      _report += `  ${_event}: ${_count}\n`;
    }

    _report += "\n" + "=".repeat(80);

    return _report;
  }
}

// Export singleton instance
export const telemetry = TelemetryCollector.getInstance();
