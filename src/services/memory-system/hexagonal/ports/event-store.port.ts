/**
 * Event Store Port
 * Defines the contract for event sourcing operations
 */

export interface EventData {
  eventId: string;
  aggregateId: string;
  eventType: string;
  eventVersion: number;
  eventData: any;
  metadata: Record<string, any>;
  timestamp: Date;
  userId?: string;
  correlationId?: string;
}

export interface EventFilter {
  aggregateId?: string;
  eventTypes?: string[];
  fromVersion?: number;
  toVersion?: number;
  fromTimestamp?: Date;
  toTimestamp?: Date;
  userId?: string;
}

export interface Snapshot {
  aggregateId: string;
  aggregateVersion: number;
  snapshotVersion: number;
  snapshotData: any;
  timestamp: Date;
}

export interface EventStats {
  totalEvents: number;
  eventsByType: Record<string, number>;
  eventsByAggregate: Record<string, number>;
  averageEventsPerDay: number;
  oldestEvent?: Date;
  newestEvent?: Date;
}

/**
 * Primary port for event storage operations
 */
export interface _IEventStorePort {
  /**
   * Append events to the stream
   */
  appendEvents(
    aggregateId: string,
    events: Omit<EventData, "eventId" | "timestamp">[],
    expectedVersion?: number,
  ): Promise<EventData[]>;

  /**
   * Get events for an aggregate
   */
  getEvents(
    aggregateId: string,
    fromVersion?: number,
    toVersion?: number,
  ): Promise<EventData[]>;

  /**
   * Get events by filter criteria
   */
  getEventsByFilter(
    filter: EventFilter,
    limit?: number,
    offset?: number,
  ): Promise<EventData[]>;

  /**
   * Get all events from a specific timestamp
   */
  getEventsFromTimestamp(
    _timestamp: Date,
    limit?: number,
  ): Promise<EventData[]>;

  /**
   * Store snapshot
   */
  saveSnapshot(_snapshot: Omit<Snapshot, "timestamp">): Promise<Snapshot>;

  /**
   * Get latest snapshot for aggregate
   */
  getLatestSnapshot(aggregateId: string): Promise<Snapshot | null>;

  /**
   * Get snapshot by version
   */
  getSnapshot(
    _aggregateId: string,
    maxVersion: number,
  ): Promise<Snapshot | null>;

  /**
   * Delete old snapshots (keep only latest N)
   */
  cleanupSnapshots(_aggregateId: string, keepCount: number): Promise<number>;

  /**
   * Get event statistics
   */
  getStats(filter?: EventFilter): Promise<EventStats>;

  /**
   * Replay events for rebuilding projections
   */
  replayEvents(
    fromTimestamp?: Date,
    eventTypes?: string[],
    batchSize?: number,
  ): AsyncIterableIterator<EventData[]>;

  /**
   * Transaction support for atomic operations
   */
  transaction<T>(
    _operation: (store: IEventStorePort) => Promise<T>,
  ): Promise<T>;

  /**
   * Health check
   */
  healthCheck(): Promise<{ isHealthy: boolean; details?: Record<string, any> }>;
}
