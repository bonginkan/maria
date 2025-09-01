/**
 * Mock EventStore for testing environments
 * Avoids SQLite native binding issues during tests
 */

import { EventEmitter } from "node:events";
import {
  DomainEvent,
  _EventData,
  AggregateSnapshot,
  EventFilter,
} from "../domain-event";

export interface MockEventStoreConfig {
  dbPath: string;
  snapshotFrequency?: number;
  maxEventsPerAggregate?: number;
  enableWAL?: boolean;
  enableCompression?: boolean;
  vacuumOnStartup?: boolean;
}

/**
 * In-memory mock implementation of EventStore
 */
export class _EventStore extends EventEmitter {
  private _events: Map<string, DomainEvent[]> = new Map();
  private snapshots: Map<string, AggregateSnapshot> = new Map();
  private config: Required<MockEventStoreConfig>;
  private isInitialized = true; // Always initialized for mock

  constructor(_config: MockEventStoreConfig) {
    super();

    this._config = {
      dbPath: _config.dbPath || ":memory:",
      snapshotFrequency: _config.snapshotFrequency ?? 100,
      maxEventsPerAggregate: _config.maxEventsPerAggregate ?? 1000,
      enableWAL: _config.enableWAL ?? true,
      enableCompression: _config.enableCompression ?? false,
      vacuumOnStartup: _config.vacuumOnStartup ?? false,
    };

    console.log("Mock EventStore initialized for testing");
  }

  /**
   * Store a single event
   */
  async storeEvent(_aggregateId: string, event: DomainEvent): Promise<void> {
    if (!this._events.has(_aggregateId)) {
      this._events.set(_aggregateId, []);
    }

    const _events = this._events.get(_aggregateId)!;
    events.push(event);

    this.emit("eventStored", event);
  }

  /**
   * Store multiple _events atomically
   */
  async storeEvents(
    _aggregateId: string,
    _events: DomainEvent[],
  ): Promise<void> {
    for (const event of _events) {
      await this.storeEvent(_aggregateId, event);
    }
  }

  /**
   * Get _events for an aggregate
   */
  async getEvents(
    _aggregateId: string,
    fromVersion?: number,
  ): Promise<DomainEvent[]> {
    const _events = this._events.get(_aggregateId) || [];

    if (fromVersion !== undefined) {
      return _events.filter((e) => e.version > fromVersion);
    }

    return [..._events];
  }

  /**
   * Query _events with filter
   */
  async queryEvents(filter: EventFilter): Promise<DomainEvent[]> {
    let allEvents: DomainEvent[] = [];

    // Collect all _events
    for (const [aggregateId, _events] of this.events) {
      if (!filter.aggregateId || filter.aggregateId === aggregateId) {
        allEvents.push(...events);
      }
    }

    // Apply filters
    if (filter.eventTypes) {
      allEvents = allEvents.filter((e) =>
        filter.eventTypes!.includes(e.eventType),
      );
    }

    if (filter.fromVersion) {
      allEvents = allEvents.filter((e) => e.version >= filter.fromVersion!);
    }

    if (filter.toVersion) {
      allEvents = allEvents.filter((e) => e.version <= filter.toVersion!);
    }

    if (filter.fromTimestamp) {
      allEvents = allEvents.filter((e) => e.timestamp >= filter.fromTimestamp!);
    }

    if (filter.toTimestamp) {
      allEvents = allEvents.filter((e) => e.timestamp <= filter.toTimestamp!);
    }

    return allEvents;
  }

  /**
   * Store snapshot
   */
  async storeSnapshot(
    _aggregateId: string,
    snapshot: AggregateSnapshot,
  ): Promise<void> {
    this.snapshots.set(_aggregateId, snapshot);
    this.emit("snapshotStored", snapshot);
  }

  /**
   * Get latest snapshot
   */
  async getLatestSnapshot(
    aggregateId: string,
  ): Promise<AggregateSnapshot | null> {
    return this.snapshots.get(aggregateId) || null;
  }

  /**
   * Get aggregate version
   */
  async getAggregateVersion(aggregateId: string): Promise<number> {
    const _events = this._events.get(aggregateId) || [];
    return _events.length > 0 ? Math.max(..._events.map((e) => e.version)) : 0;
  }

  /**
   * Subscribe to event types
   */
  subscribeToEvents(
    _eventTypes: string[],
    handler: (event: DomainEvent) => Promise<void>,
  ): void {
    this.on("eventStored", async (event: DomainEvent) => {
      if (_eventTypes.includes(event.eventType)) {
        await handler(event);
      }
    });
  }

  /**
   * Check if initialized
   */
  isEventStoreInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Get statistics
   */
  getStatistics(): unknown {
    let totalEvents = 0;
    for (const _events of this._events.values()) {
      totalEvents += _events.length;
    }

    return {
      totalEvents,
      totalAggregates: this._events.size,
      totalSnapshots: this.snapshots.size,
      dbPath: this.config.dbPath,
      inMemory: true,
    };
  }

  /**
   * Close store (no-op for mock)
   */
  async close(): Promise<void> {
    this.events.clear();
    this.snapshots.clear();
    this.emit("closed");
  }

  /**
   * Clear all data
   */
  async clear(): Promise<void> {
    this.events.clear();
    this.snapshots.clear();
  }
}

export default EventStore;
