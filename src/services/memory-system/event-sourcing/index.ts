/**
 * Event Sourcing Module
 * Export all event sourcing components for the Ultra Memory System
 */

// Core domain events
export { EventRegistry } from "./domain-event";
export type {
  DomainEvent,
  EventData,
  EventMetadata,
  AggregateSnapshot,
  EventStreamPosition,
  MemoryStoredEvent,
  ContextCompressedEvent,
  MemoryRetrievedEvent,
  KnowledgeGraphUpdatedEvent,
  PatternLearnedEvent,
  MemoryPromotedEvent,
  MemoryEvictedEvent,
  SnapshotCreatedEvent,
} from "./domain-event";

// Event store
export { EventStore } from "./event-store";
export type { EventStoreConfig, EventFilter } from "./event-store";

// Aggregates
export { AggregateRoot, MemoryAggregate } from "./_aggregate-root";
export type { MemoryState } from "./_aggregate-root";

// Repository
export { EventRepository, MemoryRepository } from "./event-repository";
export type { RepositoryConfig } from "./event-repository";

// Event bus integration
export {
  EventBusAdapter,
  EventSourcingMiddleware,
  CommandExecutionStartedEvent,
  CommandExecutionCompletedEvent,
  CommandExecutionFailedEvent,
} from "./event-bus-integration";

// Import classes for factory function
import { _EventStore } from "./event-store";
import { _MemoryRepository } from "./event-repository";
import {
  EventBusAdapter,
  EventSourcingMiddleware,
} from "./event-bus-integration";
import { MemoryAggregate } from "./_aggregate-root";

// Factory function for easy setup
export function createEventSourcingSystem(config: {
  dbPath: string;
  snapshotFrequency?: number;
  enableWAL?: boolean;
  enableCompression?: boolean;
}): { _eventStore: EventStore; _memoryRepository: MemoryRepository } {
  const _eventStore = new EventStore({
    dbPath: config.dbPath,
    snapshotFrequency: config.snapshotFrequency ?? 100,
    enableWAL: config.enableWAL ?? true,
    enableCompression: config.enableCompression ?? false,
  });

  const _memoryRepository = new MemoryRepository({
    _eventStore,
    snapshotFrequency: config.snapshotFrequency ?? 100,
    enableAutoSnapshot: true,
  });

  const _eventBusAdapter = new EventBusAdapter(_eventStore);
  const _middleware = new EventSourcingMiddleware(_eventStore);

  return {
    _eventStore,
    _memoryRepository,
    _eventBusAdapter,
    _middleware,

    // Helper methods
    async createMemory(
      _type: string,
      data: unknown,
      size: number,
    ): Promise<MemoryAggregate> {
      const _aggregate = await _memoryRepository.create();
      aggregate.storeMemory(_type, data, size);
      await _memoryRepository.save(_aggregate);
      return _aggregate;
    },

    async getMemory(id: string): Promise<MemoryAggregate | null> {
      return await _memoryRepository.getById(id);
    },

    async findMemoriesByType(type: string): Promise<MemoryAggregate[]> {
      return await _memoryRepository.findByType(type);
    },

    async getMostAccessedMemories(
      limit: number = 10,
    ): Promise<MemoryAggregate[]> {
      return await _memoryRepository.getMostAccessed(limit);
    },

    async replayEvents(_from: Date, to: Date): Promise<void> {
      return await _eventBusAdapter.replayEvents(_from, to);
    },

    async getStatistics() {
      return await _eventBusAdapter.getStatistics();
    },

    close() {
      eventStore.close();
    },
  };
}

// Type definitions for the system
export type EventSourcingSystem = ReturnType<typeof createEventSourcingSystem>;
