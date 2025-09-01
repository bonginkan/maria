/**
 * Mock Event Store Adapter
 * In-memory implementation for testing
 */

import {
  _IEventStorePort,
  EventData,
  EventFilter,
  Snapshot,
  EventStats,
} from "../ports/event-store.port";
import { v4 as uuidv4 } from "uuid";

export class MockEventStoreAdapter implements IEventStorePort {
  private events = new Map<string, EventData>();
  private _snapshots = new Map<string, Snapshot[]>();
  private eventsByAggregate = new Map<string, EventData[]>();

  async appendEvents(
    aggregateId: string,
    events: Omit<EventData, "eventId" | "timestamp">[],
    expectedVersion?: number,
  ): Promise<EventData[]> {
    const results: EventData[] = [];
    const _existingEvents = this.eventsByAggregate.get(aggregateId) || [];

    if (
      expectedVersion !== undefined &&
      _existingEvents.length !== expectedVersion
    ) {
      throw new Error(
        `Concurrency conflict. Expected version ${expectedVersion}, but aggregate has ${_existingEvents.length} events`,
      );
    }

    for (const eventData of events) {
      const event: EventData = {
        eventId: uuidv4(),
        timestamp: new Date(),
        ...eventData,
      };

      this.events.set(event.eventId, event);

      const _aggregateEvents = this.eventsByAggregate.get(aggregateId) || [];
      aggregateEvents.push(event);
      this.eventsByAggregate.set(aggregateId, _aggregateEvents);

      results.push(event);
    }

    return results;
  }

  async getEvents(
    aggregateId: string,
    fromVersion?: number,
    toVersion?: number,
  ): Promise<EventData[]> {
    const _aggregateEvents = this.eventsByAggregate.get(aggregateId) || [];

    let filtered = _aggregateEvents;

    if (fromVersion !== undefined) {
      filtered = filtered.slice(fromVersion);
    }

    if (toVersion !== undefined) {
      filtered = filtered.slice(0, toVersion - (fromVersion || 0));
    }

    return filtered;
  }

  async getEventsByFilter(
    filter: EventFilter,
    limit: number = 100,
    offset: number = 0,
  ): Promise<EventData[]> {
    let allEvents = Array.from(this.events.values());

    // Apply filters
    if (filter.aggregateId) {
      allEvents = allEvents.filter(
        (event) => event.aggregateId === filter.aggregateId,
      );
    }

    if (filter.eventTypes && filter.eventTypes.length > 0) {
      allEvents = allEvents.filter((event) =>
        filter.eventTypes!.includes(event.eventType),
      );
    }

    if (filter.fromVersion !== undefined) {
      allEvents = allEvents.filter(
        (event) => event.eventVersion >= filter.fromVersion!,
      );
    }

    if (filter.toVersion !== undefined) {
      allEvents = allEvents.filter(
        (event) => event.eventVersion <= filter.toVersion!,
      );
    }

    if (filter.fromTimestamp) {
      allEvents = allEvents.filter(
        (event) => event.timestamp >= filter.fromTimestamp!,
      );
    }

    if (filter.toTimestamp) {
      allEvents = allEvents.filter(
        (event) => event.timestamp <= filter.toTimestamp!,
      );
    }

    if (filter.userId) {
      allEvents = allEvents.filter((event) => event.userId === filter.userId);
    }

    // Sort by timestamp
    allEvents.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Apply pagination
    return allEvents.slice(offset, offset + limit);
  }

  async getEventsFromTimestamp(
    _timestamp: Date,
    limit: number = 100,
  ): Promise<EventData[]> {
    return await this.getEventsByFilter(
      { fromTimestamp: _timestamp },
      limit,
      0,
    );
  }

  async saveSnapshot(
    _snapshot: Omit<Snapshot, "timestamp">,
  ): Promise<Snapshot> {
    const savedSnapshot: Snapshot = {
      ..._snapshot,
      timestamp: new Date(),
    };

    const _aggregateSnapshots = this.snapshots.get(_snapshot.aggregateId) || [];
    _aggregateSnapshots.push(savedSnapshot);
    aggregateSnapshots.sort((a, b) => b.aggregateVersion - a.aggregateVersion);
    this.snapshots.set(_snapshot.aggregateId, _aggregateSnapshots);

    return savedSnapshot;
  }

  async getLatestSnapshot(aggregateId: string): Promise<Snapshot | null> {
    const _snapshots = this._snapshots.get(aggregateId) || [];
    return _snapshots.length > 0 ? _snapshots[0] : null;
  }

  async getSnapshot(
    _aggregateId: string,
    maxVersion: number,
  ): Promise<Snapshot | null> {
    const _snapshots = this._snapshots.get(_aggregateId) || [];
    const _validSnapshots = _snapshots.filter(
      (s) => s.aggregateVersion <= maxVersion,
    );
    return _validSnapshots.length > 0 ? _validSnapshots[0] : null;
  }

  async cleanupSnapshots(
    _aggregateId: string,
    keepCount: number,
  ): Promise<number> {
    const _snapshots = this._snapshots.get(_aggregateId) || [];
    const _toRemove = Math.max(0, _snapshots.length - keepCount);

    if (_toRemove > 0) {
      const _remaining = _snapshots.slice(0, keepCount);
      this._snapshots.set(_aggregateId, _remaining);
    }

    return _toRemove;
  }

  async getStats(filter?: EventFilter): Promise<EventStats> {
    let events = Array.from(this.events.values());

    if (filter) {
      events = await this.getEventsByFilter(filter, Number.MAX_SAFE_INTEGER, 0);
    }

    const stats: EventStats = {
      totalEvents: events.length,
      eventsByType: Record<string, any>,
      eventsByAggregate: Record<string, any>,
      averageEventsPerDay: 0,
      oldestEvent: undefined,
      newestEvent: undefined,
    };

    if (events.length > 0) {
      const _timestamps = events
        .map((e) => e.timestamp.getTime())
        .sort((a, b) => a - b);
      const _oldestTime = _timestamps[0];
      const _newestTime = _timestamps[_timestamps.length - 1];

      stats.oldestEvent = new Date(_oldestTime);
      stats.newestEvent = new Date(_newestTime);

      const _daysDifference =
        (_newestTime - _oldestTime) / (1000 * 60 * 60 * 24) || 1;
      stats.averageEventsPerDay = events.length / _daysDifference;
    }

    events.forEach((event) => {
      stats.eventsByType[event.eventType] =
        (stats.eventsByType[event.eventType] || 0) + 1;
      stats.eventsByAggregate[event.aggregateId] =
        (stats.eventsByAggregate[event.aggregateId] || 0) + 1;
    });

    return stats;
  }

  async *replayEvents(
    fromTimestamp?: Date,
    eventTypes?: string[],
    batchSize: number = 100,
  ): AsyncIterableIterator<EventData[]> {
    const filter: EventFilter = {};

    if (fromTimestamp) {
      filter.fromTimestamp = fromTimestamp;
    }

    if (eventTypes && eventTypes.length > 0) {
      filter.eventTypes = eventTypes;
    }

    let offset = 0;
    let batch: EventData[];

    do {
      batch = await this.getEventsByFilter(filter, batchSize, offset);

      if (batch.length > 0) {
        yield batch;
        offset += batch.length;
      }
    } while (batch.length === batchSize);
  }

  async transaction<T>(
    _operation: (store: IEventStorePort) => Promise<T>,
  ): Promise<T> {
    // For mock implementation, just execute the operation directly
    // In a real implementation, this would handle rollback on errors
    return await _operation(this);
  }

  async healthCheck(): Promise<{
    isHealthy: boolean;
    details?: Record<string, any>;
  }> {
    return {
      isHealthy: true,
      details: {
        totalEvents: this.events.size,
        totalAggregates: this.eventsByAggregate.size,
        totalSnapshots: Array.from(this.snapshots.values()).reduce(
          (sum, snaps) => sum + snaps.length,
          0,
        ),
      },
    };
  }

  // Test helper methods
  clear(): void {
    this.events.clear();
    this.snapshots.clear();
    this.eventsByAggregate.clear();
  }

  getAllEvents(): EventData[] {
    return Array.from(this.events.values());
  }

  getEventCount(): number {
    return this.events.size;
  }

  getAggregateEventCount(aggregateId: string): number {
    return (this.eventsByAggregate.get(aggregateId) || []).length;
  }
}
