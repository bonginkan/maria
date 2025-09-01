/**
 * Event Bus System for MARIA Phase 3
 * High-performance, typed event system with _middleware, filtering, and observability
 */

import { EventEmitter } from "node:events";
import { Logger } from "../utils/logger";

// Core Event Interfaces
export interface DomainEvent {
  readonly eventId: string;
  readonly eventType: string;
  readonly aggregateId: string;
  readonly timestamp: Date;
  readonly version: number;
  readonly correlationId?: string;
  readonly causationId?: string;
  readonly metadata: EventMetadata;
  readonly payload: Record<string, any>;
}

export interface EventMetadata {
  source: string;
  userId?: string;
  sessionId?: string;
  traceId?: string;
  tags: string[];
  priority: EventPriority;
  retryable: boolean;
  ttl?: number;
}

export type EventPriority = "low" | "normal" | "high" | "critical";

export interface EventHandler<TEvent extends DomainEvent = DomainEvent> {
  handle(event: TEvent): Promise<void> | void;
  readonly name: string;
  readonly priority?: number;
  readonly async?: boolean;
  readonly errorStrategy?: ErrorStrategy;
}

export type ErrorStrategy =
  | "ignore"
  | "retry"
  | "dead-letter"
  | "circuit-breaker";

export interface EventSubscription {
  eventType: string;
  handler: EventHandler;
  filter?: EventFilter;
  _middleware?: EventMiddleware[];
  options: SubscriptionOptions;
}

export interface SubscriptionOptions {
  once?: boolean;
  priority?: number;
  async?: boolean;
  _maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
  deadLetterQueue?: boolean;
}

export interface EventFilter {
  (event: DomainEvent): boolean;
}

export interface EventMiddleware {
  (event: DomainEvent, next: () => Promise<void>): Promise<void>;
  readonly name: string;
  readonly priority?: number;
}

export interface IEventBus {
  publish<TEvent extends DomainEvent>(event: TEvent): Promise<void>;
  publishBatch<TEvent extends DomainEvent>(events: TEvent[]): Promise<void>;

  subscribe<TEvent extends DomainEvent>(
    eventType: string,
    handler: EventHandler<TEvent>,
    options?: SubscriptionOptions,
  ): string;

  subscribeToAll(_handler: EventHandler, options?: SubscriptionOptions): string;
  unsubscribe(_subscriptionId: string): void;

  addMiddleware(_middleware: EventMiddleware): void;
  removeMiddleware(middlewareName: string): void;

  getMetrics(): EventBusMetrics;
  dispose(): Promise<void>;
}

// Event Bus Implementation
export class EventBus extends EventEmitter implements IEventBus {
  private subscriptions = new Map<string, EventSubscription>();
  private _middleware: EventMiddleware[] = [];
  private deadLetterQueue: DomainEvent[] = [];
  private metrics: EventBusMetricsCollector;
  private logger: Logger;
  private disposed = false;
  private processingQueue: ProcessingQueue;

  constructor() {
    super();
    this.setMaxListeners(1000); // High limit for microservices
    this.logger = new Logger("EventBus");
    this.metrics = new EventBusMetricsCollector();
    this.processingQueue = new ProcessingQueue();

    // Setup error handling
    this.on("error", (error) => {
      this.logger.error("EventBus error:", error);
      this.metrics.recordError(error);
    });

    // Setup cleanup
    process.on("SIGINT", () => this.dispose());
    process.on("SIGTERM", () => this.dispose());
  }

  // Publishing methods
  async publish<TEvent extends DomainEvent>(event: TEvent): Promise<void> {
    this.validateNotDisposed();
    this.validateEvent(event);

    const _startTime = performance.now();

    try {
      this.logger.debug(`Publishing event: ${event.eventType}`, {
        eventId: event.eventId,
        aggregateId: event.aggregateId,
        correlationId: event.correlationId,
      });

      this.metrics.recordEventPublished(event.eventType);

      // Apply _middleware pipeline
      await this.applyMiddleware(event);

      // Find matching subscriptions
      const _matchingSubscriptions = this.findMatchingSubscriptions(event);

      if (_matchingSubscriptions.length === 0) {
        this.logger.warn(`No handlers found for event: ${event.eventType}`);
        this.metrics.recordEventWithNoHandlers(event.eventType);
        return;
      }

      // Process subscriptions
      await this.processSubscriptions(event, _matchingSubscriptions);

      const _duration = performance.now() - _startTime;
      this.metrics.recordEventProcessed(
        event.eventType,
        _duration,
        _matchingSubscriptions.length,
      );

      this.emit("event:published", {
        event,
        handlerCount: _matchingSubscriptions.length,
        _duration,
      });
    } catch (error) {
      const _duration = performance.now() - _startTime;
      this.logger.error(`Error publishing event ${event.eventType}:`, error);
      this.metrics.recordEventError(event.eventType, error);

      this.emit("event:_failed", { event, error, _duration });
      throw new EventPublicationError(
        `Failed to publish event ${event.eventType}: ${error.message}`,
        error,
      );
    }
  }

  async publishBatch<TEvent extends DomainEvent>(
    events: TEvent[],
  ): Promise<void> {
    this.validateNotDisposed();

    if (events.length === 0) return;

    this.logger.debug(`Publishing batch of ${events.length} events`);

    const _startTime = performance.now();
    const _results = await Promise.allSettled(
      events.map((event) => this.publish(event)),
    );

    const _successful = _results.filter((r) => r.status === "fulfilled").length;
    const _failed = _results.length - _successful;

    const _duration = performance.now() - _startTime;
    this.metrics.recordBatchProcessed(
      events.length,
      _successful,
      _failed,
      _duration,
    );

    if (_failed > 0) {
      this.logger.warn(
        `Batch publish completed with ${_failed} failures out of ${events.length} events`,
      );
    }
  }

  // Subscription methods
  subscribe<TEvent extends DomainEvent>(
    eventType: string,
    handler: EventHandler<TEvent>,
    options: SubscriptionOptions = {},
  ): string {
    this.validateNotDisposed();

    const _subscriptionId = this.generateSubscriptionId();
    const _subscription: EventSubscription = {
      eventType,
      _handler: _handler as EventHandler,
      options: { ...this.getDefaultSubscriptionOptions(), ...options },
    };

    this.subscriptions.set(_subscriptionId, _subscription);

    this.logger.debug(`Subscribed to event: ${eventType}`, {
      _subscriptionId,
      handlerName: _handler.name,
      options,
    });

    this.metrics.recordSubscription(eventType);
    this.emit("_subscription:added", {
      _subscriptionId,
      eventType,
      handlerName: _handler.name,
    });

    return _subscriptionId;
  }

  subscribeToAll(
    _handler: EventHandler,
    options: SubscriptionOptions = {},
  ): string {
    return this.subscribe("*", _handler, options);
  }

  unsubscribe(_subscriptionId: string): void {
    const _subscription = this.subscriptions.get(_subscriptionId);

    if (_subscription) {
      this.subscriptions.delete(_subscriptionId);
      this.metrics.recordUnsubscription(_subscription.eventType);

      this.logger.debug(`Unsubscribed: ${_subscriptionId}`, {
        eventType: _subscription.eventType,
        handlerName: _subscription._handler.name,
      });

      this.emit("_subscription:removed", {
        _subscriptionId,
        eventType: _subscription.eventType,
      });
    }
  }

  // Middleware management
  addMiddleware(_middleware: EventMiddleware): void {
    this._middleware.push(_middleware);
    this._middleware.sort((a, b) => (a.priority || 0) - (b.priority || 0));

    this.logger.debug(`Added _middleware: ${_middleware.name}`, {
      priority: _middleware.priority,
      totalMiddleware: this._middleware.length,
    });
  }

  removeMiddleware(middlewareName: string): void {
    const _index = this._middleware.findIndex((m) => m.name === middlewareName);

    if (_index >= 0) {
      this._middleware.splice(_index, 1);
      this.logger.debug(`Removed _middleware: ${middlewareName}`);
    }
  }

  // Private methods
  private async applyMiddleware(event: DomainEvent): Promise<void> {
    if (this._middleware.length === 0) return;

    let _index = 0;

    const _executeNext = async (): Promise<void> => {
      if (_index >= this._middleware.length) return;

      const _middleware = this._middleware[_index++];
      await _middleware(event, _executeNext);
    };

    await _executeNext();
  }

  private findMatchingSubscriptions(event: DomainEvent): EventSubscription[] {
    const subscriptions: EventSubscription[] = [];

    for (const _subscription of this.subscriptions.values()) {
      // Check event type match
      if (
        _subscription.eventType !== "*" &&
        _subscription.eventType !== event.eventType
      ) {
        continue;
      }

      // Apply filters if present
      if (_subscription.filter && !_subscription.filter(event)) {
        continue;
      }

      subscriptions.push(_subscription);
    }

    // Sort by priority
    return subscriptions.sort(
      (a, b) => (b.options.priority || 0) - (a.options.priority || 0),
    );
  }

  private async processSubscriptions(
    event: DomainEvent,
    subscriptions: EventSubscription[],
  ): Promise<void> {
    const _synchronousHandlers = subscriptions.filter((s) => !s.options.async);
    const _asynchronousHandlers = subscriptions.filter((s) => s.options.async);

    // Process synchronous handlers sequentially
    for (const _subscription of _synchronousHandlers) {
      await this.processSubscription(event, _subscription);
    }

    // Process asynchronous handlers in parallel
    if (_asynchronousHandlers.length > 0) {
      await Promise.allSettled(
        asynchronousHandlers.map((_subscription) =>
          this.processSubscription(event, _subscription),
        ),
      );
    }
  }

  private async processSubscription(
    event: DomainEvent,
    _subscription: EventSubscription,
  ): Promise<void> {
    const _startTime = performance.now();
    let attempts = 0;
    const _maxRetries = subscription.options._maxRetries || 0;

    while (attempts <= _maxRetries) {
      try {
        // Apply timeout if specified
        if (subscription.options.timeout) {
          await this.withTimeout(
            () => subscription._handler.handle(event),
            subscription.options.timeout,
          );
        } else {
          await subscription._handler.handle(event);
        }

        const _duration = performance.now() - _startTime;
        this.metrics.recordHandlerSuccess(
          subscription.eventType,
          subscription._handler.name,
          _duration,
        );

        // Remove one-time subscriptions
        if (subscription.options.once) {
          const _subscriptionId = this.findSubscriptionId(_subscription);
          if (_subscriptionId) {
            this.unsubscribe(_subscriptionId);
          }
        }

        return; // Success - exit retry loop
      } catch (innerError) {
        attempts++;
        const _duration = performance.now() - _startTime;

        this.logger.error(
          `Handler ${subscription._handler.name} _failed (attempt ${attempts}):`,
          error,
        );
        this.metrics.recordHandlerError(
          subscription.eventType,
          subscription._handler.name,
          error,
        );

        if (attempts <= _maxRetries) {
          // Wait before retry
          const _delay = subscription.options.retryDelay || 1000;
          await new Promise((resolve) => setTimeout(resolve, _delay));
        } else {
          // All retries exhausted
          if (subscription.options.deadLetterQueue) {
            this.deadLetterQueue.push(event);
          }

          this.emit("handler:_failed", {
            event,
            _handler: subscription._handler.name,
            error: "",
            attempts,
            _duration,
          });

          // Don't re-throw if error strategy is 'ignore'
          if (subscription._handler.errorStrategy !== "ignore") {
            throw new EventHandlingError(
              `Handler ${subscription._handler.name} _failed after ${attempts} attempts: ${error.message}`,
              error,
            );
          }
        }
      }
    }
  }

  private async withTimeout<T>(
    _operation: () => Promise<T>,
    timeoutMs: number,
  ): Promise<T> {
    return Promise.race([
      _operation(),
      new Promise<T>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new EventTimeoutError(`Operation timed out after ${timeoutMs}ms`),
            ),
          timeoutMs,
        ),
      ),
    ]);
  }

  private findSubscriptionId(
    targetSubscription: EventSubscription,
  ): string | undefined {
    for (const [id, _subscription] of this.subscriptions) {
      if (_subscription === targetSubscription) {
        return id;
      }
    }
    return undefined;
  }

  private validateNotDisposed(): void {
    if (this.disposed) {
      throw new EventBusDisposedError("EventBus has been disposed");
    }
  }

  private validateEvent(event: DomainEvent): void {
    if (!event.eventId || !event.eventType || !event.aggregateId) {
      throw new InvalidEventError(
        "Event must have eventId, eventType, and aggregateId",
      );
    }
  }

  private generateSubscriptionId(): string {
    return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getDefaultSubscriptionOptions(): SubscriptionOptions {
    return {
      once: false,
      priority: 0,
      async: false,
      _maxRetries: 0,
      retryDelay: 1000,
      timeout: undefined,
      deadLetterQueue: false,
    };
  }

  // Metrics and diagnostics
  getMetrics(): EventBusMetrics {
    return this.metrics.getMetrics();
  }

  getDiagnostics(): EventBusDiagnostics {
    return {
      subscriptionsCount: this.subscriptions.size,
      middlewareCount: this._middleware.length,
      deadLetterQueueSize: this.deadLetterQueue.length,
      processingQueueSize: this.processingQueue.size(),
      disposed: this.disposed,
      listenerCount: this.listenerCount("event:published"),
    };
  }

  // Cleanup
  async dispose(): Promise<void> {
    if (this.disposed) return;

    this.logger.info("Disposing EventBus...");

    // Clear all subscriptions
    this.subscriptions.clear();

    // Clear _middleware
    this._middleware = [];

    // Clear dead letter queue (optionally persist first)
    this.deadLetterQueue = [];

    // Dispose processing queue
    await this.processingQueue.dispose();

    // Remove all listeners
    this.removeAllListeners();

    this.disposed = true;
    this.logger.info("EventBus disposed successfully");
  }
}

// Processing Queue for handling async operations
class ProcessingQueue {
  private queue: Array<() => Promise<void>> = [];
  private processing = false;
  private disposed = false;

  async add(_operation: () => Promise<void>): Promise<void> {
    if (this.disposed) return;

    this.queue.push(_operation);

    if (!this.processing) {
      await this.process();
    }
  }

  private async process(): Promise<void> {
    this.processing = true;

    while (this.queue.length > 0 && !this.disposed) {
      const _operation = this.queue.shift();
      if (_operation) {
        try {
          await _operation();
        } catch (error) {
          // Log error but continue processing
          console.error("Processing queue error:", error);
        }
      }
    }

    this.processing = false;
  }

  size(): number {
    return this.queue.length;
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    this.queue = [];
  }
}

// Metrics Collection
class EventBusMetricsCollector {
  private metrics = {
    eventsPublished: new Map<string, number>(),
    eventsProcessed: new Map<string, number>(),
    eventErrors: new Map<string, number>(),
    handlerExecutions: new Map<string, { count: number; totalTime: number }>(),
    handlerErrors: new Map<string, number>(),
    subscriptions: new Map<string, number>(),
    batchesProcessed: 0,
    eventsWithNoHandlers: 0,
    totalErrors: 0,
  };

  recordEventPublished(eventType: string): void {
    this.metrics.eventsPublished.set(
      eventType,
      (this.metrics.eventsPublished.get(eventType) || 0) + 1,
    );
  }

  recordEventProcessed(
    _eventType: string,
    _duration: number,
    _handlerCount: number,
  ): void {
    this.metrics.eventsProcessed.set(
      eventType,
      (this.metrics.eventsProcessed.get(_eventType) || 0) + 1,
    );
  }

  recordEventError(_eventType: string, _error: Error): void {
    this.metrics.eventErrors.set(
      eventType,
      (this.metrics.eventErrors.get(_eventType) || 0) + 1,
    );
    this.metrics.totalErrors++;
  }

  recordHandlerSuccess(
    _eventType: string,
    handlerName: string,
    _duration: number,
  ): void {
    const _key = `${_eventType}:${handlerName}`;
    const _current = this.metrics.handlerExecutions.get(_key) || {
      count: 0,
      totalTime: 0,
    };

    this.metrics.handlerExecutions.set(_key, {
      count: _current.count + 1,
      totalTime: _current.totalTime + _duration,
    });
  }

  recordHandlerError(
    _eventType: string,
    handlerName: string,
    _error: Error,
  ): void {
    const _key = `${_eventType}:${handlerName}`;
    this.metrics.handlerErrors.set(
      _key,
      (this.metrics.handlerErrors.get(_key) || 0) + 1,
    );
  }

  recordSubscription(eventType: string): void {
    this.metrics.subscriptions.set(
      eventType,
      (this.metrics.subscriptions.get(eventType) || 0) + 1,
    );
  }

  recordUnsubscription(eventType: string): void {
    const _current = this.metrics.subscriptions.get(eventType) || 0;
    if (_current > 0) {
      this.metrics.subscriptions.set(eventType, _current - 1);
    }
  }

  recordBatchProcessed(
    _total: number,
    _successful: number,
    _failed: number,
    _duration: number,
  ): void {
    this.metrics.batchesProcessed++;
  }

  recordEventWithNoHandlers(_eventType: string): void {
    this.metrics.eventsWithNoHandlers++;
  }

  recordError(_error: Error): void {
    this.metrics.totalErrors++;
  }

  getMetrics(): EventBusMetrics {
    return {
      eventsPublished: Object.fromEntries(this.metrics.eventsPublished),
      eventsProcessed: Object.fromEntries(this.metrics.eventsProcessed),
      eventErrors: Object.fromEntries(this.metrics.eventErrors),
      handlerExecutions: Object.fromEntries(this.metrics.handlerExecutions),
      handlerErrors: Object.fromEntries(this.metrics.handlerErrors),
      subscriptions: Object.fromEntries(this.metrics.subscriptions),
      batchesProcessed: this.metrics.batchesProcessed,
      eventsWithNoHandlers: this.metrics.eventsWithNoHandlers,
      totalErrors: this.metrics.totalErrors,
    };
  }
}

// Interfaces for metrics and diagnostics
export interface EventBusMetrics {
  eventsPublished: Record<string, number>;
  eventsProcessed: Record<string, number>;
  eventErrors: Record<string, number>;
  handlerExecutions: Record<string, { count: number; totalTime: number }>;
  handlerErrors: Record<string, number>;
  subscriptions: Record<string, number>;
  batchesProcessed: number;
  eventsWithNoHandlers: number;
  totalErrors: number;
}

export interface EventBusDiagnostics {
  subscriptionsCount: number;
  middlewareCount: number;
  deadLetterQueueSize: number;
  processingQueueSize: number;
  disposed: boolean;
  listenerCount: number;
}

// Error Classes
export class EventBusError extends Error {
  constructor(
    _message: string,
    public cause?: Error,
  ) {
    super(_message);
    this.name = "EventBusError";
  }
}

export class EventPublicationError extends EventBusError {
  constructor(_message: string, cause?: Error) {
    super(_message, cause);
    this.name = "EventPublicationError";
  }
}

export class EventHandlingError extends EventBusError {
  constructor(_message: string, cause?: Error) {
    super(_message, cause);
    this.name = "EventHandlingError";
  }
}

export class EventTimeoutError extends EventBusError {
  constructor(_message: string) {
    super(_message);
    this.name = "EventTimeoutError";
  }
}

export class EventBusDisposedError extends EventBusError {
  constructor(_message: string) {
    super(_message);
    this.name = "EventBusDisposedError";
  }
}

export class InvalidEventError extends EventBusError {
  constructor(_message: string) {
    super(_message);
    this.name = "InvalidEventError";
  }
}

// Utility functions
export function createEvent<TPayload = Record<string, any>>(
  eventType: string,
  aggregateId: string,
  payload: TPayload,
  options: Partial<EventMetadata> = {},
): DomainEvent {
  return {
    eventId: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    eventType,
    aggregateId,
    timestamp: new Date(),
    version: 1,
    payload: payload as Record<string, any>,
    metadata: {
      source: "maria-system",
      tags: [],
      priority: "normal" as EventPriority,
      retryable: true,
      ...options,
    },
  };
}

// Singleton instance
let eventBusInstance: EventBus | undefined;

export function getEventBus(): EventBus {
  if (!eventBusInstance) {
    eventBusInstance = new EventBus();
  }
  return eventBusInstance;
}

export function resetEventBus(): void {
  if (eventBusInstance) {
    eventBusInstance.dispose();
    eventBusInstance = undefined;
  }
}
