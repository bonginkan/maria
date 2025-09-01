/**
 * Event Sourcing - Domain Event Base Classes
 * Core _event infrastructure for Ultra Memory System
 */

import { v4 as uuidv4 } from "uuid";

/**
 * Base class for all domain events in the system
 */
export abstract class DomainEvent {
  readonly eventId: string;
  readonly aggregateId: string;
  readonly timestamp: Date;
  readonly version: number;
  readonly eventType: string;
  readonly userId?: string;
  readonly correlationId?: string;
  readonly causationId?: string;
  readonly metadata: Record<string, any>;

  constructor(
    aggregateId: string,
    version: number,
    metadata: Record<string, any> = {},
  ) {
    this.eventId = uuidv4();
    this.aggregateId = aggregateId;
    this.timestamp = new Date();
    this.version = version;
    this.eventType = this.constructor.name;
    this.metadata = metadata;
  }

  /**
   * Serialize _event to JSON for storage
   */
  toJSON(): EventData {
    return {
      eventId: this.eventId,
      aggregateId: this.aggregateId,
      timestamp: this.timestamp.toISOString(),
      version: this.version,
      eventType: this.eventType,
      userId: this.userId,
      correlationId: this.correlationId,
      causationId: this.causationId,
      metadata: this.metadata,
      payload: this.getPayload(),
    };
  }

  /**
   * Get _event-specific payload
   */
  protected abstract getPayload(): any;
}

/**
 * Serialized _event data structure
 */
export interface EventData {
  eventId: string;
  aggregateId: string;
  timestamp: string;
  version: number;
  eventType: string;
  userId?: string;
  correlationId?: string;
  causationId?: string;
  metadata: Record<string, any>;
  payload: any;
}

/**
 * Event metadata for tracking and correlation
 */
export interface EventMetadata {
  userId?: string;
  correlationId?: string;
  causationId?: string;
  [key: string]: any;
}

/**
 * Aggregate snapshot for optimization
 */
export interface AggregateSnapshot {
  aggregateId: string;
  version: number;
  data: any;
  timestamp: Date;
  checksum?: string;
}

/**
 * Event stream position marker
 */
export interface EventStreamPosition {
  aggregateId: string;
  version: number;
  globalPosition?: number;
  timestamp: Date;
}

// Memory-specific domain events

/**
 * Event fired when memory is stored
 */
export class MemoryStoredEvent extends DomainEvent {
  constructor(
    aggregateId: string,
    version: number,
    public readonly memoryType: string,
    public readonly data: unknown,
    public readonly size: number,
    metadata: Record<string, any> = {},
  ) {
    super(aggregateId, version, metadata);
  }

  protected getPayload() {
    return {
      memoryType: this.memoryType,
      data: this.data,
      size: this.size,
    };
  }
}

/**
 * Event fired when context is compressed
 */
export class ContextCompressedEvent extends DomainEvent {
  constructor(
    aggregateId: string,
    version: number,
    public readonly originalSize: number,
    public readonly compressedSize: number,
    public readonly compressionRatio: number,
    public readonly algorithm: string,
    metadata: Record<string, any> = {},
  ) {
    super(aggregateId, version, metadata);
  }

  protected getPayload() {
    return {
      originalSize: this.originalSize,
      compressedSize: this.compressedSize,
      compressionRatio: this.compressionRatio,
      algorithm: this.algorithm,
    };
  }
}

/**
 * Event fired when memory is retrieved
 */
export class MemoryRetrievedEvent extends DomainEvent {
  constructor(
    aggregateId: string,
    version: number,
    public readonly retrievalTime: number,
    public readonly cacheHit: boolean,
    public readonly tier: string,
    metadata: Record<string, any> = {},
  ) {
    super(aggregateId, version, metadata);
  }

  protected getPayload() {
    return {
      retrievalTime: this.retrievalTime,
      cacheHit: this.cacheHit,
      tier: this.tier,
    };
  }
}

/**
 * Event fired when knowledge graph is updated
 */
export class KnowledgeGraphUpdatedEvent extends DomainEvent {
  constructor(
    aggregateId: string,
    version: number,
    public readonly nodesAdded: number,
    public readonly edgesAdded: number,
    public readonly nodesRemoved: number,
    public readonly edgesRemoved: number,
    metadata: Record<string, any> = {},
  ) {
    super(aggregateId, version, metadata);
  }

  protected getPayload() {
    return {
      nodesAdded: this.nodesAdded,
      edgesAdded: this.edgesAdded,
      nodesRemoved: this.nodesRemoved,
      edgesRemoved: this.edgesRemoved,
    };
  }
}

/**
 * Event fired when pattern is learned
 */
export class PatternLearnedEvent extends DomainEvent {
  constructor(
    aggregateId: string,
    version: number,
    public readonly patternType: string,
    public readonly confidence: number,
    public readonly frequency: number,
    public readonly pattern: unknown,
    metadata: Record<string, any> = {},
  ) {
    super(aggregateId, version, metadata);
  }

  protected getPayload() {
    return {
      patternType: this.patternType,
      confidence: this.confidence,
      frequency: this.frequency,
      pattern: this.pattern,
    };
  }
}

/**
 * Event fired when memory tier is promoted
 */
export class MemoryPromotedEvent extends DomainEvent {
  constructor(
    aggregateId: string,
    version: number,
    public readonly fromTier: string,
    public readonly toTier: string,
    public readonly reason: string,
    public readonly accessCount: number,
    metadata: Record<string, any> = {},
  ) {
    super(aggregateId, version, metadata);
  }

  protected getPayload() {
    return {
      fromTier: this.fromTier,
      toTier: this.toTier,
      reason: this.reason,
      accessCount: this.accessCount,
    };
  }
}

/**
 * Event fired when memory is evicted
 */
export class MemoryEvictedEvent extends DomainEvent {
  constructor(
    aggregateId: string,
    version: number,
    public readonly tier: string,
    public readonly reason: string,
    public readonly age: number,
    public readonly lastAccessed: Date,
    metadata: Record<string, any> = {},
  ) {
    super(aggregateId, version, metadata);
  }

  protected getPayload() {
    return {
      tier: this.tier,
      reason: this.reason,
      age: this.age,
      lastAccessed: this.lastAccessed.toISOString(),
    };
  }
}

/**
 * Event fired when snapshot is created
 */
export class SnapshotCreatedEvent extends DomainEvent {
  constructor(
    aggregateId: string,
    version: number,
    public readonly snapshotSize: number,
    public readonly eventsConsolidated: number,
    metadata: Record<string, any> = {},
  ) {
    super(aggregateId, version, metadata);
  }

  protected getPayload() {
    return {
      snapshotSize: this.snapshotSize,
      eventsConsolidated: this.eventsConsolidated,
    };
  }
}

/**
 * Registry for _event deserialization
 */
export class EventRegistry {
  private static eventTypes = new Map<string, typeof DomainEvent>();

  static register(_eventType: string, eventClass: typeof DomainEvent): void {
    this.eventTypes.set(_eventType, eventClass);
  }

  static deserialize(data: EventData): DomainEvent {
    const _EventClass = this.eventTypes.get(data.eventType);
    if (!_EventClass) {
      throw new Error(`Unknown _event type: ${data.eventType}`);
    }

    const _event = Object.create(_EventClass.prototype);
    Object.assign(_event, {
      ...data,
      timestamp: new Date(data.timestamp),
    });

    // Restore payload properties
    if (data.payload) {
      Object.assign(_event, data.payload);
    }

    return _event;
  }

  static initialize(): void {
    // Register all known _event types
    this.register("MemoryStoredEvent", MemoryStoredEvent as any);
    this.register("ContextCompressedEvent", ContextCompressedEvent as any);
    this.register("MemoryRetrievedEvent", MemoryRetrievedEvent as any);
    this.register(
      "KnowledgeGraphUpdatedEvent",
      KnowledgeGraphUpdatedEvent as any,
    );
    this.register("PatternLearnedEvent", PatternLearnedEvent as any);
    this.register("MemoryPromotedEvent", MemoryPromotedEvent as any);
    this.register("MemoryEvictedEvent", MemoryEvictedEvent as any);
    this.register("SnapshotCreatedEvent", SnapshotCreatedEvent as any);
  }
}

// Initialize registry on module load
EventRegistry.initialize();
