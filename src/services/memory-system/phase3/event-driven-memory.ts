/**
 * MARIA Memory System - Phase 3: Event-Driven Memory Updates
 *
 * Real-time event processing and memory synchronization
 * with automatic pattern detection and learning triggers
 */

import { EventEmitter } from 'events';
import {
  EventMetadata,
  MemoryEvent,
  MemoryEventType,
  ReasoningTrace,
} from '../types/memory-interfaces';
import { KnowledgeGraphEngine } from './knowledge-graph-engine';
import { DualMemoryEngine } from '../dual-memory-engine';

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
  priority: number;
  process: (event: MemoryEvent) => Promise<ProcessingResult>;
}

export interface ProcessingResult {
  success: boolean;
  memoryUpdates: MemoryUpdate[];
  graphUpdates?: GraphUpdate[];
  learningTriggers?: LearningTrigger[];
  error?: Error;
}

export interface MemoryUpdate {
  type: 'system1' | 'system2' | 'both';
  operation: 'add' | 'update' | 'remove';
  target: string;
  data: unknown;
  metadata?: Record<string, unknown>;
}

export interface GraphUpdate {
  operation: 'add_node' | 'add_edge' | 'update_node' | 'remove_node';
  data: unknown;
}

export interface LearningTrigger {
  type: 'pattern_detected' | 'threshold_reached' | 'anomaly_detected';
  data: unknown;
  action: 'train' | 'adapt' | 'alert';
}

export interface EventStreamOptions {
  filter?: (event: MemoryEvent) => boolean;
  transform?: (event: MemoryEvent) => MemoryEvent;
  bufferSize?: number;
}

export interface EventStatistics {
  totalEvents: number;
  eventsByType: Map<MemoryEventType, number>;
  averageProcessingTime: number;
  successRate: number;
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
      successRate: 1.0,
      queueSize: 0,
      lastProcessedTime: new Date(),
    };

    this.initializeProcessors();
    this.startProcessing();
  }

  /**
   * Submit an event for processing
   */
  async submitEvent(event: MemoryEvent): Promise<void> {
    // Validate event
    this.validateEvent(event);

    // Calculate priority
    const priority = this.calculatePriority(event);

    // Add to queue
    this.eventQueue.enqueue(event, priority);

    // Update statistics
    this.statistics.totalEvents++;
    this.statistics.eventsByType.set(
      event.type,
      (this.statistics.eventsByType.get(event.type) || 0) + 1,
    );
    this.statistics.queueSize = this.eventQueue.size();

    // Emit event received
    this.emit('eventReceived', event);

    // Trigger immediate processing for critical events
    if (priority >= this.config.priorityThresholds.critical) {
      await this.processImmediate(event);
    }
  }

  /**
   * Create an event stream with filtering and transformation
   */
  createEventStream(options?: EventStreamOptions): EventStream {
    return new EventStream(this, options);
  }

  /**
   * Register a custom event processor
   */
  registerProcessor(processor: EventProcessor): void {
    this.processors.set(processor.type, processor);
    this.emit('processorRegistered', processor.type);
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
    if (this.processing || this.eventQueue.isEmpty()) {return;}

    this.processing = true;
    const batch: MemoryEvent[] = [];
    const startTime = Date.now();

    // Dequeue batch
    for (let i = 0; i < this.config.batchSize && !this.eventQueue.isEmpty(); i++) {
      batch.push(this.eventQueue.dequeue()!);
    }

    // Process events in parallel
    const results = await Promise.allSettled(batch.map((event) => this.processEvent(event)));

    // Handle results
    let successCount = 0;
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const event = batch[i];

      if (result.status === 'fulfilled' && result.value.success) {
        successCount++;
        await this.applyMemoryUpdates(result.value);
        this.emit('eventProcessed', event, result.value);
      } else {
        const error = result.status === 'rejected' ? result.reason : (result as any).value?.error;

        this.emit('eventError', event, error);

        // Retry if needed
        if (this.shouldRetry(event)) {
          await this.submitEvent(event);
        }
      }
    }

    // Update statistics
    const processingTime = Date.now() - startTime;
    this.updateStatistics(batch.length, successCount, processingTime);

    this.processing = false;
    this.statistics.queueSize = this.eventQueue.size();
  }

  /**
   * Process a single event
   */
  private async processEvent(event: MemoryEvent): Promise<ProcessingResult> {
    const processor = this.processors.get(event.type);

    if (!processor) {
      return this.defaultProcessor(event);
    }

    try {
      return await processor.process(event);
    } catch (error) {
      return {
        success: false,
        memoryUpdates: [],
        error: error as Error,
      };
    }
  }

  /**
   * Default processor for unregistered event types
   */
  private async defaultProcessor(event: MemoryEvent): Promise<ProcessingResult> {
    const memoryUpdates: MemoryUpdate[] = [];
    const graphUpdates: GraphUpdate[] = [];
    const learningTriggers: LearningTrigger[] = [];

    // Extract entities from event data if it's text
    if (typeof event.data === 'string') {
      const extraction = await this.graphEngine.extractEntities(event.data);

      if (extraction.entities.length > 0) {
        await this.graphEngine.addToGraph(extraction);

        graphUpdates.push({
          operation: 'add_node',
          data: extraction,
        });
      }
    }

    // Store event in System 1 memory for fast access
    memoryUpdates.push({
      type: 'system1',
      operation: 'add',
      target: 'pastInteractions',
      data: event,
      metadata: { timestamp: event.timestamp },
    });

    // If there's reasoning, store in System 2
    if (event.reasoning) {
      memoryUpdates.push({
        type: 'system2',
        operation: 'add',
        target: 'reasoningTraces',
        data: event.reasoning,
        metadata: { eventId: event.id },
      });
    }

    // Check for learning triggers
    if (this.detectPattern(event)) {
      learningTriggers.push({
        type: 'pattern_detected',
        data: event,
        action: 'adapt',
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
   * Initialize default processors for each event type
   */
  private initializeProcessors(): void {
    // Code generation processor
    this.registerProcessor({
      type: 'code_generation',
      priority: 0.8,
      process: async (event) => {
        const code = event.data as string;
        const extraction = await this.graphEngine.extractEntities(code, {
          type: 'code_generation',
        });

        await this.graphEngine.addToGraph(extraction);

        return {
          success: true,
          memoryUpdates: [
            {
              type: 'system1',
              operation: 'add',
              target: 'codePatterns',
              data: { code, entities: extraction.entities },
            },
          ],
          graphUpdates: [
            {
              operation: 'add_node',
              data: extraction,
            },
          ],
        };
      },
    });

    // Bug fix processor
    this.registerProcessor({
      type: 'bug_fix',
      priority: 0.9,
      process: async (event) => {
        const bugData = event.data as any;

        return {
          success: true,
          memoryUpdates: [
            {
              type: 'both',
              operation: 'add',
              target: 'bugPatterns',
              data: bugData,
            },
          ],
          learningTriggers: [
            {
              type: 'pattern_detected',
              data: bugData,
              action: 'train',
            },
          ],
        };
      },
    });

    // Team interaction processor
    this.registerProcessor({
      type: 'team_interaction',
      priority: 0.6,
      process: async (event) => {
        return {
          success: true,
          memoryUpdates: [
            {
              type: 'system1',
              operation: 'add',
              target: 'teamPatterns',
              data: event.data,
            },
          ],
        };
      },
    });

    // Mode change processor
    this.registerProcessor({
      type: 'mode_change',
      priority: 0.7,
      process: async (event) => {
        const modeData = event.data as any;

        return {
          success: true,
          memoryUpdates: [
            {
              type: 'system2',
              operation: 'update',
              target: 'currentMode',
              data: modeData,
            },
          ],
          learningTriggers: [
            {
              type: 'threshold_reached',
              data: modeData,
              action: 'adapt',
            },
          ],
        };
      },
    });
  }

  /**
   * Apply memory updates from processing result
   */
  private async applyMemoryUpdates(result: ProcessingResult): Promise<void> {
    for (const update of result.memoryUpdates) {
      try {
        switch (update.type) {
          case 'system1':
            await this.memoryEngine.updateSystem1(update);
            break;
          case 'system2':
            await this.memoryEngine.updateSystem2(update);
            break;
          case 'both':
            await this.memoryEngine.updateSystem1(update);
            await this.memoryEngine.updateSystem2(update);
            break;
        }
      } catch (error) {
        this.emit('updateError', update, error);
      }
    }

    // Process learning triggers
    if (result.learningTriggers) {
      for (const trigger of result.learningTriggers) {
        this.emit('learningTrigger', trigger);
      }
    }
  }

  /**
   * Process critical event immediately
   */
  private async processImmediate(event: MemoryEvent): Promise<void> {
    const result = await this.processEvent(event);

    if (result.success) {
      await this.applyMemoryUpdates(result);
      this.emit('criticalEventProcessed', event, result);
    } else {
      this.emit('criticalEventError', event, result.error);
    }
  }

  /**
   * Calculate event priority
   */
  private calculatePriority(event: MemoryEvent): number {
    let priority = 0.5; // Base priority

    // Adjust based on metadata priority
    switch (event.metadata.priority) {
      case 'critical':
        priority = 0.95;
        break;
      case 'high':
        priority = 0.75;
        break;
      case 'medium':
        priority = 0.5;
        break;
      case 'low':
        priority = 0.25;
        break;
    }

    // Adjust based on event type
    const processor = this.processors.get(event.type);
    if (processor) {
      priority = Math.max(priority, processor.priority);
    }

    // Boost priority for events with high confidence
    if (event.metadata.confidence > 0.8) {
      priority = Math.min(1.0, priority * 1.2);
    }

    return priority;
  }

  /**
   * Validate event structure
   */
  private validateEvent(event: MemoryEvent): void {
    if (!event.id || !event.type || !event.timestamp) {
      throw new Error('Invalid event structure: missing required fields');
    }

    if (!event.metadata || typeof event.metadata !== 'object') {
      throw new Error('Invalid event metadata');
    }
  }

  /**
   * Detect patterns in events
   */
  private detectPattern(event: MemoryEvent): boolean {
    // Check event buffer for similar events
    const sessionEvents = this.eventBuffer.get(event.sessionId) || [];

    // Simple pattern detection: repeated event types
    const recentSimilar = sessionEvents.filter(
      (e) => e.type === event.type && event.timestamp.getTime() - e.timestamp.getTime() < 60000, // Within 1 minute
    );

    if (recentSimilar.length >= 3) {
      return true;
    }

    // Add event to buffer
    sessionEvents.push(event);
    if (sessionEvents.length > 100) {
      sessionEvents.shift(); // Keep buffer size limited
    }
    this.eventBuffer.set(event.sessionId, sessionEvents);

    return false;
  }

  /**
   * Check if event should be retried
   */
  private shouldRetry(event: MemoryEvent): boolean {
    const retryCount = (event as any).retryCount || 0;
    return retryCount < this.config.maxRetries;
  }

  /**
   * Update processing statistics
   */
  private updateStatistics(batchSize: number, successCount: number, processingTime: number): void {
    const successRate = successCount / batchSize;
    this.statistics.successRate = this.statistics.successRate * 0.9 + successRate * 0.1; // Weighted average

    this.statistics.averageProcessingTime =
      this.statistics.averageProcessingTime * 0.9 + processingTime * 0.1;

    this.statistics.lastProcessedTime = new Date();
  }

  /**
   * Start processing timer
   */
  private startProcessing(): void {
    this.processingTimer = setInterval(() => this.processBatch(), this.config.processingInterval);
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
  private items: Array<{ item: T; priority: number }> = [];

  enqueue(item: T, priority: number): void {
    const newItem = { item, priority };
    let added = false;

    for (let i = 0; i < this.items.length; i++) {
      if (this.items[i].priority < priority) {
        this.items.splice(i, 0, newItem);
        added = true;
        break;
      }
    }

    if (!added) {
      this.items.push(newItem);
    }
  }

  dequeue(): T | undefined {
    return this.items.shift()?.item;
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

  constructor(parent: EventDrivenMemorySystem, options?: EventStreamOptions) {
    super();
    this.parent = parent;
    this.options = options || {};

    // Subscribe to parent events
    this.parent.on('eventReceived', (event) => this.handleEvent(event));
  }

  private handleEvent(event: MemoryEvent): void {
    // Apply filter
    if (this.options.filter && !this.options.filter(event)) {
      return;
    }

    // Apply transformation
    let processedEvent = event;
    if (this.options.transform) {
      processedEvent = this.options.transform(event);
    }

    // Buffer if needed
    if (this.options.bufferSize) {
      this.buffer.push(processedEvent);

      if (this.buffer.length >= this.options.bufferSize) {
        this.emit('batch', [...this.buffer]);
        this.buffer = [];
      }
    } else {
      this.emit('data', processedEvent);
    }
  }

  flush(): void {
    if (this.buffer.length > 0) {
      this.emit('batch', [...this.buffer]);
      this.buffer = [];
    }
  }
}
