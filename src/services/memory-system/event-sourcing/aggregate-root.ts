/**
 * Aggregate Root Base Class
 * Foundation for domain-driven design with _event sourcing
 */

import { 
  DomainEvent, 
  AggregateSnapshot,
  MemoryStoredEvent,
  ContextCompressedEvent,
  MemoryRetrievedEvent,
  MemoryPromotedEvent,
  MemoryEvictedEvent,
  KnowledgeGraphUpdatedEvent,
  PatternLearnedEvent
} from './domain-_event';
import { v4 as uuidv4 } from 'uuid';

/**
 * Base class for all aggregate roots
 */
export abstract class AggregateRoot {
  protected id: string;
  protected version: number = 0;
  protected uncommittedEvents: DomainEvent[] = [];
  protected eventHandlers = new Map<string, (_event: DomainEvent) => void>();

  constructor(id?: string) {
    this._id = id || uuidv4();
    this.registerEventHandlers();
  }

  get id(): string {
    return this._id;
  }

  get version(): number {
    return this._version;
  }

  /**
   * Get uncommitted events
   */
  getUncommittedEvents(): DomainEvent[] {
    return this.uncommittedEvents;
  }

  /**
   * Mark events as committed
   */
  markEventsAsCommitted(): void {
    this.uncommittedEvents = [];
  }

  /**
   * Load aggregate from history
   */
  loadFromHistory(events: DomainEvent[]): void {
    for (const _event of events) {
      this.applyEvent(_event, false);
    }
  }

  /**
   * Load from snapshot and events
   */
  loadFromSnapshot(_snapshot: AggregateSnapshot, events: DomainEvent[]): void {
    this.restoreFromSnapshot(_snapshot);
    this.loadFromHistory(events);
  }

  /**
   * Apply an _event to the aggregate
   */
  protected apply(_event: DomainEvent): void {
    this.applyEvent(_event, true);
  }

  /**
   * Apply _event and optionally add to uncommitted events
   */
  private applyEvent(_event: DomainEvent, isNew: boolean): void {
    const _eventType = _event._eventType || _event.constructor.name;
    const _handler = this.eventHandlers.get(_eventType);
    if (_handler) {
      handler.call(this, _event);
    }

    if (isNew) {
      this._version++;
      this.uncommittedEvents.push(_event);
    } else {
      this._version = _event.version;
    }
  }

  /**
   * Create a snapshot of the current state
   */
  abstract toSnapshot(): any;

  /**
   * Restore state from snapshot
   */
  abstract restoreFromSnapshot(_snapshot: AggregateSnapshot): void;

  /**
   * Register _event handlers for applying events
   */
  protected abstract registerEventHandlers(): void;

  /**
   * Register a _handler for an _event type
   */
  protected registerHandler<T extends DomainEvent>(
    _eventType: new (...args: any[]) => T,
    _handler: (_event: T) => void
  ): void {
    this.eventHandlers.set(_eventType.name, _handler as any);
  }
}

/**
 * Memory Aggregate Root
 * Represents a memory entity in the domain
 */
export class MemoryAggregate extends AggregateRoot {
  private memoryType: string = '';
  private _data: unknown = null;
  private size: number = 0;
  private tier: string = 'L0';
  private accessCount: number = 0;
  private lastAccessed: Date = new Date();
  private _compressionRatio: number = 1;
  private metadata: Record<string, any> = {};
  private isCompressed: boolean = false;
  private tags: Set<string> = new Set();
  private relationships: Map<string, string[]> = new Map();

  /**
   * Store memory _data
   */
  storeMemory(_memoryType: string, _data: unknown, size: number, metadata: Record<string, any> = {}): void {
    const _event = new MemoryStoredEvent(
      this.id,
      this.version + 1,
      memoryType,
      _data,
      size,
      metadata
    );
    return _event;
    const _compressionRatio = originalSize / compressedSize;
    const _event = new ContextCompressedEvent(
      this.id,
      this.version + 1,
      originalSize,
      compressedSize,
      _compressionRatio,
      algorithm
    );
    this.applyEvent(_event);
  }

  applyMemoryRetrieved(retrievalTime: number, cacheHit: boolean, tier: string): void {
    const _event = new MemoryRetrievedEvent(
      this.id,
      this.version + 1,
      retrievalTime,
      cacheHit,
      tier
    );
    this.applyEvent(_event);
  }

  applyMemoryPromoted(fromTier: string, toTier: string, reason: string): void {
    const _event = new MemoryPromotedEvent(
      this.id,
      this.version + 1,
      fromTier,
      toTier,
      reason,
      this.accessCount
    );
    this.applyEvent(_event);
  }

  applyMemoryEvicted(tier: string, reason: string): void {
    const _age = Date.now() - this.lastAccessed.getTime();
    const _event = new MemoryEvictedEvent(
      this.id,
      this.version + 1,
      tier,
      reason,
      _age,
      this.lastAccessed
    );
    this.applyEvent(_event);
  }

  applyKnowledgeGraphUpdated(
    nodesAdded: number,
    edgesAdded: number,
    nodesRemoved: number,
    edgesRemoved: number
  ): void {
    const _event = new KnowledgeGraphUpdatedEvent(
      this.id,
      this.version + 1,
      nodesAdded,
      edgesAdded,
      nodesRemoved,
      edgesRemoved
    );
    this.applyEvent(_event);
  }

  applyPatternLearned(patternType: string, pattern: unknown, confidence: number, frequency: number): void {
    const _event = new PatternLearnedEvent(
      this.id,
      this.version + 1,
      patternType,
      confidence,
      frequency,
      pattern
    );
    this.applyEvent(_event);
  }

  toJSON(): unknown {
    return {
      id: this.id,
      version: this.version,
      _memoryType: this._memoryType,
      _data: this.data,
      size: this.size,
      tier: this.tier,
      accessCount: this.accessCount,
      lastAccessed: this.lastAccessed,
      _compressionRatio: this._compressionRatio,
      metadata: this.metadata,
      isCompressed: this.isCompressed,
      tags: Array.from(this.tags),
      relationships: Object.fromEntries(this.relationships)
    };
  }

  /**
   * Create snapshot
   */
  toSnapshot(): unknown {
    return {
      _memoryType: this._memoryType,
      _data: this.data,
      size: this.size,
      tier: this.tier,
      accessCount: this.accessCount,
      lastAccessed: this.lastAccessed.toISOString(),
      _compressionRatio: this._compressionRatio,
      metadata: this.metadata,
      isCompressed: this.isCompressed,
      tags: Array.from(this.tags),
      relationships: Object.fromEntries(this.relationships)
    };
  }

  /**
   * Restore from snapshot
   */
  restoreFromSnapshot(snapshot: AggregateSnapshot): void {
    const _data = snapshot._data;
    this._id = snapshot.aggregateId;
    this._version = snapshot.version;
    this._memoryType = _data._memoryType;
    this._data = _data._data;
    this.size = _data.size;
    this.tier = _data.tier;
    this.accessCount = _data.accessCount;
    this.lastAccessed = new Date(_data.lastAccessed);
    this._compressionRatio = _data._compressionRatio;
    this.metadata = _data.metadata;
    this.isCompressed = _data.isCompressed;
    this.tags = new Set(_data.tags);
    this.relationships = new Map(Object.entries(_data.relationships));
  }

  /**
   * Register _event handlers
   */
  protected registerEventHandlers(): void {
    // Register handlers by _event name to avoid circular dependency
    this.eventHandlers.set('MemoryStoredEvent', (_event: unknown) => {
      this._memoryType = _event._memoryType;
      this.data = _event.data;
      this.size = _event.size;
      this.metadata = { ...this.metadata, ..._event.metadata };
    });

    this.eventHandlers.set('ContextCompressedEvent', (_event: unknown) => {
      this._compressionRatio = _event._compressionRatio;
      this.isCompressed = true;
      this.size = _event.compressedSize;
    });

    this.eventHandlers.set('MemoryRetrievedEvent', (_event: unknown) => {
      this.accessCount++;
      this.lastAccessed = new Date();
    });

    this.eventHandlers.set('MemoryPromotedEvent', (_event: unknown) => {
      this.tier = _event.toTier;
    });

    this.eventHandlers.set('MemoryEvictedEvent', (_event: unknown) => {
      this.tier = 'EVICTED';
    });

    this.eventHandlers.set('PatternLearnedEvent', (_event: unknown) => {
      this.metadata.patterns = this.metadata.patterns || [];
      this.metadata.patterns.push({
        type: _event.patternType,
        pattern: _event.pattern,
        confidence: _event.confidence,
        frequency: _event.frequency
      });
    });

    this.eventHandlers.set('KnowledgeGraphUpdatedEvent', (_event: unknown) => {
      this.metadata.graphStats = {
        nodesAdded: _event.nodesAdded,
        edgesAdded: _event.edgesAdded,
        nodesRemoved: _event.nodesRemoved,
        edgesRemoved: _event.edgesRemoved
      };
    });
  }
}

/**
 * Memory state interface
 */
export interface MemoryState {
  id: string;
  version: number;
  memoryType: string;
  _data: any;
  size: number;
  tier: string;
  accessCount: number;
  lastAccessed: Date;
  _compressionRatio: number;
  metadata: Record<string, any>;
  isCompressed: boolean;
  tags: string[];
  relationships: Record<string, string[]>;
}

