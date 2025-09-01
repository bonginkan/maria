/**
 * MARIA Memory System - Phase 3: Event-Driven Memory Updates
 *
 * Real-time _event processing and memory synchronization
 * with automatic pattern detection and learning triggers
 */

import { EventEmitter } from "node:events";
import {
  _EventMetadata,
  MemoryEvent,
  MemoryEventType,
  _ReasoningTrace,
} from "../types/memory-interfaces";
import { KnowledgeGraphEngine } from "./knowledge-graph-engine";
import { DualMemoryEngine } from "../dual-memory-engine";

export interface EventProcessingConfig {
  batchSize: number;
  processingInterval: number;
  maxRetries: number;
  priorityThresholds: {
    critical: number;
    high: number;
    medium: number;
  };
}

export interface EventProcessor {
  type: MemoryEventType;
  _priority: number;
  process: (_event: MemoryEvent) => Promise<ProcessingResult>;
}

export interface ProcessingResult {
  success: boolean;
  memoryUpdates: MemoryUpdate[];
  graphUpdates?: GraphUpdate[];
  learningTriggers?: LearningTrigger[];
  _error?: Error;
}

export interface MemoryUpdate {
  type: "system1" | "system2" | "both";
  operation: "add" | "update" | "remove";
  target: string;
  data: unknown;
  metadata?: Record<string, unknown>;
}

export interface GraphUpdate {
  operation: "add_node" | "add_edge" | "update_node" | "remove_node";
  data: unknown;
}

export interface LearningTrigger {
  type: "pattern_detected" | "threshold_reached" | "anomaly_detected";
  data: unknown;
  action: "train" | "adapt" | "alert";
}

export interface EventStreamOptions {
  filter?: (_event: MemoryEvent) => boolean;
  transform?: (_event: MemoryEvent) => MemoryEvent;
  bufferSize?: number;
}

export interface EventStatistics {
  totalEvents: number;
  eventsByType: Map<MemoryEventType, number>;
  averageProcessingTime: number;
  _successRate: number;
  queueSize: number;
  lastProcessedTime: Date;
}

export class EventDrivenMemorySystem extends EventEmitter {
  private memoryEngine: DualMemoryEngine;
  private graphEngine: KnowledgeGraphEngine;
  private eventQueue: PriorityQueue<MemoryEvent>;
  private processors: Map<MemoryEventType, EventProcessor>;
  private processing: boolean = false;
  private config: EventProcessingConfig;
  private statistics: EventStatistics;
  private eventBuffer: Map<string, MemoryEvent[]>;
  private processingTimer?: NodeJS.Timeout;

  constructor(
    memoryEngine: DualMemoryEngine,
    graphEngine: KnowledgeGraphEngine,
    config?: Partial<EventProcessingConfig>,
  ) {
    super();
    this.memoryEngine = memoryEngine;
    this.graphEngine = graphEngine;
    this.eventQueue = new PriorityQueue();
    this.processors = new Map();
    this.eventBuffer = new Map();

    this.config = {
      batchSize: config?.batchSize || 10,
      processingInterval: config?.processingInterval || 1000,
      maxRetries: config?.maxRetries || 3,
      priorityThresholds: config?.priorityThresholds || {
        critical: 0.9,
        high: 0.7,
        medium: 0.5,
      },
    };

    this.statistics = {
      totalEvents: 0,
      eventsByType: new Map(),
      averageProcessingTime: 0,
      _successRate: 1.0,
      queueSize: 0,
      lastProcessedTime: new Date(),
    };

    this.initializeProcessors();
    this.startProcessing();
  }

  /**
   * Submit an _event for processing
   */
  async submitEvent(_event: MemoryEvent): Promise<void> {
    // Validate _event
    this.validateEvent(_event);

    // Calculate _priority
    const _priority = this.calculatePriority(_event);

    // Add to queue
    this.eventQueue.enqueue(_event, _priority);

    // Update statistics
    this.statistics.totalEvents++;
    this.statistics.eventsByType.set(
      event.type,
      (this.statistics.eventsByType.get(_event.type) || 0) + 1,
    );
    this.statistics.queueSize = this.eventQueue.size();

    // Emit _event received
    this.emit("eventReceived", _event);

    // Trigger immediate processing for critical events
    if (_priority >= this.config.priorityThresholds.critical) {
      await this.processImmediate(_event);
    }
  }

  /**
   * Create an _event stream with filtering and transformation
   */
  createEventStream(options?: EventStreamOptions): EventStream {
    return new EventStream(this, options);
  }

  /**
   * Register a custom _event _processor
   */
  registerProcessor(_processor: EventProcessor): void {
    this.processors.set(processor.type, _processor);
    this.emit("processorRegistered", processor.type);
  }

  /**
   * Get current statistics
   */
  getStatistics(): EventStatistics {
    return { ...this.statistics };
  }

  /**
   * Process events in batch
   */
  private async processBatch(): Promise<void> {
    if (this.processing || this.eventQueue.isEmpty()) {
      return;
    }

    this.processing = true;
    const batch: MemoryEvent[] = [];
    const _startTime = Date.now();

    // Dequeue batch
    for (
      let i = 0;
      i < this.config.batchSize && !this.eventQueue.isEmpty();
      i++
    ) {
      batch.push(this.eventQueue.dequeue()!);
    }

    // Process events in parallel
    const _results = await Promise.allSettled(
      batch.map((_event) => this.processEvent(_event)),
    );

    // Handle _results
    let successCount = 0;
    for (let i = 0; i < _results.length; i++) {
      const _result = _results[i];
      const _event = batch[i];

      if (_result.status === "fulfilled" && _result.value.success) {
        successCount++;
        await this.applyMemoryUpdates(_result.value);
        this.emit("eventProcessed", _event, _result.value);
      } else {
        const _error =
          _result.status === "rejected"
            ? _result.reason
            : (_result as any).value?._error;

        this.emit("eventError", _event, _error);

        // Retry if needed
        if (this.shouldRetry(_event)) {
          await this.submitEvent(_event);
        }
      }
    }

    // Update statistics
    const _processingTime = Date.now() - _startTime;
    this.updateStatistics(batch.length, successCount, _processingTime);

    this.processing = false;
    this.statistics.queueSize = this.eventQueue.size();
  }

  /**
   * Process a single _event
   */
  private async processEvent(_event: MemoryEvent): Promise<ProcessingResult> {
    const _processor = this.processors.get(_event.type);

    if (!_processor) {
      return this.defaultProcessor(_event);
    }

    try {
      return await _processor.process(_event);
    } catch (_error) {
      return {
        success: false,
        memoryUpdates: [],
        _error: _error as Error,
      };
    }
  }

  /**
   * Default _processor for unregistered _event types
   */
  private async defaultProcessor(
    _event: MemoryEvent,
  ): Promise<ProcessingResult> {
    const memoryUpdates: MemoryUpdate[] = [];
    const graphUpdates: GraphUpdate[] = [];
    const learningTriggers: LearningTrigger[] = [];

    // Extract entities from _event data if it's text
    if (typeof _event.data === "string") {
      const _extraction = await this.graphEngine.extractEntities(_event.data);

      if (_extraction.entities.length > 0) {
        await this.graphEngine.addToGraph(_extraction);

        graphUpdates.push({
          operation: "add_node",
          data: _extraction,
        });
      }
    }

    // Store _event in System 1 memory for fast access
    memoryUpdates.push({
      type: "system1",
      operation: "add",
      target: "pastInteractions",
      data: _event,
      metadata: { timestamp: _event.timestamp },
    });

    // If there's reasoning, store in System 2
    if (_event.reasoning) {
      memoryUpdates.push({
        type: "system2",
        operation: "add",
        target: "reasoningTraces",
        data: _event.reasoning,
        metadata: { eventId: _event.id },
      });
    }

    // Check for learning triggers
    if (this.detectPattern(_event)) {
      learningTriggers.push({
        type: "pattern_detected",
        data: _event,
        action: "adapt",
      });
    }

    return {
      success: true,
      memoryUpdates,
      graphUpdates,
      learningTriggers,
    };
  }

  /**
   * Initialize default processors for each _event type
   */
  private initializeProcessors(): void {
    // Code generation _processor
    this.registerProcessor({
      type: "code_generation",
      _priority: 0.8,
      process: async (_event) => {
        const _code = _event.data as string;
        const _extraction = await this.graphEngine.extractEntities(_code, {
          type: "code_generation",
        });

        await this.graphEngine.addToGraph(_extraction);

        return {
          success: true,
          memoryUpdates: [
            {
              type: "system1",
              operation: "add",
              target: "codePatterns",
              data: { _code, entities: _extraction.entities },
            },
          ],
          graphUpdates: [
            {
              operation: "add_node",
              data: _extraction,
            },
          ],
        };
      },
    });

    // Bug fix _processor
    this.registerProcessor({
      type: "bug_fix",
      _priority: 0.9,
      process: async (_event) => {
        const _bugData = _event.data as any;

        return {
          success: true,
          memoryUpdates: [
            {
              type: "both",
              operation: "add",
              target: "bugPatterns",
              data: _bugData,
            },
          ],
          learningTriggers: [
            {
              type: "pattern_detected",
              data: _bugData,
              action: "train",
            },
          ],
        };
      },
    });

    // Team interaction _processor
    this.registerProcessor({
      type: "team_interaction",
      _priority: 0.6,
      process: async (_event) => {
        return {
          success: true,
          memoryUpdates: [
            {
              type: "system1",
              operation: "add",
              target: "teamPatterns",
              data: _event.data,
            },
          ],
        };
      },
    });

    // Mode change _processor
    this.registerProcessor({
      type: "mode_change",
      _priority: 0.7,
      process: async (_event) => {
        const _modeData = _event.data as any;

        return {
          success: true,
          memoryUpdates: [
            {
              type: "system2",
              operation: "update",
              target: "currentMode",
              data: _modeData,
            },
          ],
          learningTriggers: [
            {
              type: "threshold_reached",
              data: _modeData,
              action: "adapt",
            },
          ],
        };
      },
    });
  }

  /**
   * Apply memory updates from processing _result
   */
  private async applyMemoryUpdates(_result: ProcessingResult): Promise<void> {
    for (const update of _result.memoryUpdates) {
      try {
        switch (update.type) {
          case "system1":
            await this.memoryEngine.updateSystem1(update);
            break;
          case "system2":
            await this.memoryEngine.updateSystem2(update);
            break;
          case "both":
            await this.memoryEngine.updateSystem1(update);
            await this.memoryEngine.updateSystem2(update);
            break;
        }
      } catch (_error) {
        this.emit("updateError", update, _error);
      }
    }

    // Process learning triggers
    if (_result.learningTriggers) {
      for (const trigger of _result.learningTriggers) {
        this.emit("learningTrigger", trigger);
      }
    }
  }

  /**
   * Process critical _event immediately
   */
  private async processImmediate(_event: MemoryEvent): Promise<void> {
    const _result = await this.processEvent(_event);

    if (_result.success) {
      await this.applyMemoryUpdates(_result);
      this.emit("criticalEventProcessed", _event, _result);
    } else {
      this.emit("criticalEventError", _event, _result.error);
    }
  }

  /**
   * Calculate _event _priority
   */
  private calculatePriority(_event: MemoryEvent): number {
    let _priority = 0.5; // Base _priority

    // Adjust based on metadata _priority
    switch (_event.metadata._priority) {
      case "critical":
        _priority = 0.95;
        break;
      case "high":
        _priority = 0.75;
        break;
      case "medium":
        _priority = 0.5;
        break;
      case "low":
        _priority = 0.25;
        break;
    }

    // Adjust based on _event type
    const _processor = this.processors.get(_event.type);
    if (_processor) {
      _priority = Math.max(_priority, _processor._priority);
    }

    // Boost _priority for events with high confidence
    if (_event.metadata.confidence > 0.8) {
      _priority = Math.min(1.0, _priority * 1.2);
    }

    return _priority;
  }

  /**
   * Validate _event structure
   */
  private validateEvent(_event: MemoryEvent): void {
    if (!_event.id || !_event.type || !_event.timestamp) {
      throw new Error("Invalid _event structure: missing required fields");
    }

    if (!_event.metadata || typeof _event.metadata !== "object") {
      throw new Error("Invalid _event metadata");
    }
  }

  /**
   * Detect patterns in events
   */
  private detectPattern(_event: MemoryEvent): boolean {
    // Check _event buffer for similar events
    const _sessionEvents = this.eventBuffer.get(_event.sessionId) || [];

    // Simple pattern detection: repeated _event types
    const _recentSimilar = _sessionEvents.filter(
      (e) =>
        e.type === _event.type &&
        _event.timestamp.getTime() - e.timestamp.getTime() < 60000, // Within 1 minute
    );

    if (_recentSimilar.length >= 3) {
      return true;
    }

    // Add _event to buffer
    sessionEvents.push(_event);
    if (_sessionEvents.length > 100) {
      sessionEvents.shift(); // Keep buffer size limited
    }
    this.eventBuffer.set(_event.sessionId, _sessionEvents);

    return false;
  }

  /**
   * Check if _event should be retried
   */
  private shouldRetry(_event: MemoryEvent): boolean {
    const _retryCount = (_event as any)._retryCount || 0;
    return _retryCount < this.config.maxRetries;
  }

  /**
   * Update processing statistics
   */
  private updateStatistics(
    _batchSize: number,
    successCount: number,
    _processingTime: number,
  ): void {
    const _successRate = successCount / _batchSize;
    this.statistics._successRate =
      this.statistics._successRate * 0.9 + _successRate * 0.1; // Weighted average

    this.statistics.averageProcessingTime =
      this.statistics.averageProcessingTime * 0.9 + _processingTime * 0.1;

    this.statistics.lastProcessedTime = new Date();
  }

  /**
   * Start processing timer
   */
  private startProcessing(): void {
    this.processingTimer = setInterval(
      () => this.processBatch(),
      this.config.processingInterval,
    );
  }

  /**
   * Stop processing
   */
  stop(): void {
    if (this.processingTimer) {
      clearInterval(this.processingTimer);
      this.processingTimer = undefined;
    }
  }
}

/**
 * Priority queue implementation
 */
class PriorityQueue<T> {
  private items: Array<{ _item: T; _priority: number }> = [];

  enqueue(_item: T, _priority: number): void {
    const _newItem = { _item, _priority };
    let added = false;

    for (let i = 0; i < this.items.length; i++) {
      if (this.items[i].priority < _priority) {
        this.items.splice(i, 0, _newItem);
        added = true;
        break;
      }
    }

    if (!added) {
      this.items.push(_newItem);
    }
  }

  dequeue(): T | undefined {
    return this.items.shift()?._item;
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }

  size(): number {
    return this.items.length;
  }
}

/**
 * Event stream for reactive processing
 */
class EventStream extends EventEmitter {
  private parent: EventDrivenMemorySystem;
  private options: EventStreamOptions;
  private buffer: MemoryEvent[] = [];

  constructor(_parent: EventDrivenMemorySystem, options?: EventStreamOptions) {
    super();
    this._parent = _parent;
    this.options = options || object;

    // Subscribe to parent events
    this._parent.on("eventReceived", (_event) => this.handleEvent(_event));
  }

  private handleEvent(_event: MemoryEvent): void {
    // Apply filter
    if (this.options.filter && !this.options.filter(_event)) {
      return;
    }

    // Apply transformation
    let processedEvent = _event;
    if (this.options.transform) {
      processedEvent = this.options.transform(_event);
    }

    // Buffer if needed
    if (this.options.bufferSize) {
      this.buffer.push(processedEvent);

      if (this.buffer.length >= this.options.bufferSize) {
        this.emit("batch", [...this.buffer]);
        this.buffer = [];
      }
    } else {
      this.emit("data", processedEvent);
    }
  }

  flush(): void {
    if (this.buffer.length > 0) {
      this.emit("batch", [...this.buffer]);
      this.buffer = [];
    }
  }
}
