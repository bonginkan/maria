/**
 * Event Repository
 * Repository pattern for loading and saving aggregates with event sourcing
 */

import { _EventStore } from "./event-store";
import { AggregateRoot, MemoryAggregate } from "./_aggregate-root";
import {
  DomainEvent,
  AggregateSnapshot,
  SnapshotCreatedEvent,
} from "./domain-event";

/**
 * Repository configuration
 */
export interface RepositoryConfig {
  eventStore: EventStore;
  snapshotFrequency?: number;
  enableAutoSnapshot?: boolean;
}

/**
 * Generic repository for event-sourced aggregates
 */
export abstract class EventRepository<T extends AggregateRoot> {
  protected eventStore: EventStore;
  protected snapshotFrequency: number;
  protected enableAutoSnapshot: boolean;

  constructor(_config: RepositoryConfig) {
    this.eventStore = _config.eventStore;
    this.snapshotFrequency = _config.snapshotFrequency ?? 100;
    this.enableAutoSnapshot = _config.enableAutoSnapshot ?? true;

    // Listen for _snapshot requirements
    if (this.enableAutoSnapshot) {
      this.eventStore.on("_snapshot-required", async (data) => {
        await this.createSnapshot(data.aggregateId);
      });
    }
  }

  /**
   * Get _aggregate by ID
   */
  async getById(id: string): Promise<T | null> {
    // Try to load from _snapshot first
    const _snapshot = await this.eventStore.getSnapshot(id);

    let _aggregate: T;
    let fromVersion = 0;

    if (_snapshot) {
      // Create _aggregate from _snapshot
      _aggregate = this.createAggregate(id);
      fromVersion = _snapshot.version + 1;

      // Load _events after _snapshot
      const _events = await this.eventStore.getEvents(id, fromVersion);
      aggregate.loadFromSnapshot(_snapshot, _events);
    } else {
      // Load all _events
      const _events = await this.eventStore.getEvents(id);

      if (_events.length === 0) {
        return null;
      }

      _aggregate = this.createAggregate(id);
      aggregate.loadFromHistory(_events);
    }

    return _aggregate;
  }

  /**
   * Save _aggregate
   */
  async save(_aggregate: T): Promise<void> {
    const _events = aggregate.getUncommittedEvents();

    if (_events.length === 0) {
      return; // No changes to save
    }

    // Append _events to store
    await this.eventStore.append(_events);

    // Mark _events as committed
    aggregate.markEventsAsCommitted();

    // Check if _snapshot is needed
    if (this.shouldCreateSnapshot(_aggregate)) {
      await this.createSnapshot(aggregate.id);
    }
  }

  /**
   * Create new _aggregate
   */
  async create(id?: string): Promise<T> {
    const _aggregate = this.createAggregate(id);
    return _aggregate;
  }

  /**
   * Delete _aggregate (soft delete via event)
   */
  async delete(id: string): Promise<void> {
    const _aggregate = await this.getById(id);
    if (_aggregate) {
      // Implementation depends on domain requirements
      // Usually involves applying a "deleted" event
      await this.save(_aggregate);
    }
  }

  /**
   * Check if _aggregate exists
   */
  async exists(id: string): Promise<boolean> {
    const _version = await this.eventStore.getCurrentVersion(id);
    return _version > 0;
  }

  /**
   * Get _aggregate at specific _version
   */
  async getAtVersion(_id: string, _version: number): Promise<T | null> {
    const _events = await this.eventStore.getEvents(_id, 0, _version);

    if (_events.length === 0) {
      return null;
    }

    const _aggregate = this.createAggregate(_id);
    aggregate.loadFromHistory(_events);

    return _aggregate;
  }

  /**
   * Get _aggregate history
   */
  async getHistory(id: string): Promise<DomainEvent[]> {
    return await this.eventStore.getEvents(id);
  }

  /**
   * Create _snapshot for an _aggregate
   */
  async createSnapshot(aggregateId: string): Promise<void> {
    const _aggregate = await this.getById(aggregateId);

    if (!_aggregate) {
      throw new Error(`Aggregate ${aggregateId} not found`);
    }

    const _snapshot: AggregateSnapshot = {
      aggregateId: _aggregate.id,
      _version: _aggregate.version,
      data: _aggregate.toSnapshot(),
      timestamp: new Date(),
    };

    await this.eventStore.createSnapshot(_snapshot);

    // Record _snapshot creation event
    const _snapshotEvent = new SnapshotCreatedEvent(
      aggregateId,
      aggregate.version,
      JSON.stringify(_snapshot.data).length,
      aggregate.version,
    );

    await this.eventStore.append([_snapshotEvent]);
  }

  /**
   * Check if _snapshot should be created
   */
  protected shouldCreateSnapshot(_aggregate: T): boolean {
    if (!this.enableAutoSnapshot) {
      return false;
    }

    return _aggregate.version % this.snapshotFrequency === 0;
  }

  /**
   * Create a new _aggregate instance
   */
  protected abstract createAggregate(_id?: string): T;
}

/**
 * Memory Repository
 * Repository for Memory aggregates
 */
export class _MemoryRepository extends EventRepository<MemoryAggregate> {
  protected createAggregate(id?: string): MemoryAggregate {
    return new MemoryAggregate(id);
  }

  /**
   * Find memories by type
   */
  async findByType(memoryType: string): Promise<MemoryAggregate[]> {
    // This would typically use a read model/projection
    // For now, we'll use event filtering
    const _events = await this.eventStore.getEventsByFilter({
      eventTypes: ["MemoryStoredEvent"],
    });

    const _aggregateIds = new Set<string>();
    for (const event of _events) {
      if ((event as any).memoryType === memoryType) {
        aggregateIds.add(event.aggregateId);
      }
    }

    const aggregates: MemoryAggregate[] = [];
    for (const id of _aggregateIds) {
      const _aggregate = await this.getById(id);
      if (_aggregate) {
        aggregates.push(_aggregate);
      }
    }

    return aggregates;
  }

  /**
   * Find memories by tier
   */
  async findByTier(tier: string): Promise<MemoryAggregate[]> {
    // Similar to findByType, would use read model in production
    const _events = await this.eventStore.getEventsByFilter({
      eventTypes: ["MemoryPromotedEvent", "MemoryStoredEvent"],
    });

    const _tierMap = new Map<string, string>();

    // Build current tier map from _events
    for (const event of _events) {
      if (event.eventType === "MemoryStoredEvent") {
        tierMap.set(event.aggregateId, "L0"); // Default tier
      } else if (event.eventType === "MemoryPromotedEvent") {
        tierMap.set(event.aggregateId, (event as any).toTier);
      }
    }

    const aggregates: MemoryAggregate[] = [];
    for (const [id, currentTier] of _tierMap) {
      if (currentTier === tier) {
        const _aggregate = await this.getById(id);
        if (_aggregate) {
          aggregates.push(_aggregate);
        }
      }
    }

    return aggregates;
  }

  /**
   * Get most accessed memories
   */
  async getMostAccessed(limit: number = 10): Promise<MemoryAggregate[]> {
    const _events = await this.eventStore.getEventsByFilter({
      eventTypes: ["MemoryRetrievedEvent"],
    });

    // Count access per _aggregate
    const _accessCount = new Map<string, number>();
    for (const event of _events) {
      const _count = _accessCount.get(event.aggregateId) || 0;
      accessCount.set(event.aggregateId, _count + 1);
    }

    // Sort by access _count
    const _sorted = Array.from(_accessCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);

    const aggregates: MemoryAggregate[] = [];
    for (const [id] of _sorted) {
      const _aggregate = await this.getById(id);
      if (_aggregate) {
        aggregates.push(_aggregate);
      }
    }

    return aggregates;
  }

  /**
   * Clean up old memories
   */
  async cleanupOldMemories(olderThan: Date): Promise<number> {
    const _events = await this.eventStore.getEventsByFilter({
      toTimestamp: olderThan,
      eventTypes: ["MemoryStoredEvent"],
    });

    const _aggregateIds = new Set<string>();
    for (const event of _events) {
      aggregateIds.add(event.aggregateId);
    }

    let evictedCount = 0;
    for (const id of _aggregateIds) {
      const _aggregate = await this.getById(id);
      if (_aggregate) {
        _aggregate.evictMemory(_aggregate.getState().tier, "Age-based cleanup");
        await this.save(_aggregate);
        evictedCount++;
      }
    }

    return evictedCount;
  }
}
