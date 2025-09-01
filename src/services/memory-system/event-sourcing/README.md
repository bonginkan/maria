# Event Sourcing Implementation

## Overview

This directory contains the complete Event Sourcing implementation for the Ultra Memory System. Event Sourcing provides an audit trail of all changes, enables time-travel debugging, and supports complex event-driven architectures.

## Architecture

### Core Components

1. **Domain Events** (`domain-event.ts`)
   - Base `DomainEvent` class for all events
   - Memory-specific events (Store, Compress, Retrieve, Promote, Evict)
   - Event registry for deserialization

2. **Event Store** (`event-store.ts`)
   - SQLite-based persistence with WAL mode
   - Event replay capabilities
   - Snapshot management
   - Event subscription system

3. **Aggregates** (`aggregate-root.ts`)
   - `AggregateRoot` base class
   - `MemoryAggregate` for memory domain logic
   - Event-driven state mutations

4. **Repository** (`event-repository.ts`)
   - Load/Save aggregates using events
   - Automatic snapshot creation
   - Query methods for finding memories

5. **Event Bus Integration** (`event-bus-integration.ts`)
   - Bridge between Event Store and application Event Bus
   - Command execution middleware
   - Event replay functionality

## Usage

### Basic Setup

```typescript
import { createEventSourcingSystem } from './event-sourcing';

// Initialize the system
const eventSystem = createEventSourcingSystem({
  dbPath: './data/events.db',
  snapshotFrequency: 100,
  enableWAL: true,
  enableCompression: false
});

// Create a memory
const memory = await eventSystem.createMemory(
  'code-pattern',
  { pattern: 'singleton', language: 'typescript' },
  2048
);

// Retrieve a memory
const retrieved = await eventSystem.getMemory(memory.id);

// Find memories by type
const codePatterns = await eventSystem.findMemoriesByType('code-pattern');

// Get most accessed memories
const popular = await eventSystem.getMostAccessedMemories(10);
```

### Working with Aggregates

```typescript
import { MemoryAggregate } from './aggregate-root';
import { MemoryRepository } from './event-repository';

// Create new aggregate
const aggregate = new MemoryAggregate();

// Store memory
aggregate.storeMemory('user-preference', { theme: 'dark' }, 512);

// Compress context
aggregate.compressContext(10000, 1000, 'lz4');

// Record retrieval
aggregate.recordRetrieval(25, true, 'L0');

// Promote to higher tier
aggregate.promoteMemory('L0', 'L1', 'frequent-access');

// Save to repository
await repository.save(aggregate);
```

### Event Replay

```typescript
// Replay events from last 24 hours
const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
const now = new Date();

await eventSystem.replayEvents(yesterday, now);

// Subscribe to specific events
eventStore.subscribe('MemoryStoredEvent', async (event) => {
  console.log('Memory stored:', event);
});
```

### Snapshots

```typescript
// Manually create snapshot
await repository.createSnapshot(aggregateId);

// Cleanup old snapshots (keep latest 3)
await eventStore.cleanupSnapshots(3);

// Load aggregate from snapshot
const aggregate = await repository.getById(aggregateId);
// Automatically uses latest snapshot if available
```

## Database Schema

### Events Table
- `event_id`: Unique event identifier
- `aggregate_id`: Aggregate the event belongs to
- `event_type`: Type of domain event
- `version`: Event version in aggregate
- `timestamp`: When event occurred
- `payload`: Event-specific data (JSON)
- `metadata`: Additional context

### Snapshots Table
- `aggregate_id`: Aggregate identifier
- `version`: Aggregate version at snapshot
- `data`: Serialized aggregate state
- `timestamp`: When snapshot was created

### Event Streams Table
- `aggregate_id`: Aggregate identifier
- `current_version`: Latest event version
- `event_count`: Total events for aggregate
- `last_snapshot_version`: Version of latest snapshot

## Performance Considerations

1. **WAL Mode**: Enabled by default for better concurrency
2. **Indexing**: Automatic indexes on aggregate_id, timestamp, event_type
3. **Snapshots**: Created every N events (configurable)
4. **Compression**: Optional payload compression for large events
5. **Memory Cache**: 64MB SQLite cache for faster queries

## Testing

```bash
# Run event sourcing tests
pnpm test src/services/memory-system/event-sourcing/tests

# Run with coverage
pnpm test:coverage src/services/memory-system/event-sourcing/tests
```

## Migration from Existing System

1. **Gradual Migration**: Run event sourcing alongside existing system
2. **Event Generation**: Generate events from current state
3. **Validation**: Compare event-sourced state with existing state
4. **Cutover**: Switch to event sourcing when validated

## Best Practices

1. **Event Naming**: Use past tense (MemoryStored, not StoreMemory)
2. **Event Size**: Keep events small, store references not full data
3. **Snapshots**: Create snapshots for aggregates with many events
4. **Projections**: Build read models for queries
5. **Event Versioning**: Plan for event schema evolution

## Monitoring

```typescript
// Get system statistics
const stats = await eventSystem.getStatistics();
console.log(`Total events: ${stats.totalEvents}`);
console.log(`Total aggregates: ${stats.totalAggregates}`);
console.log(`Database size: ${stats.databaseSize} bytes`);
```

## Next Steps

- [ ] Implement CQRS pattern for read/write separation
- [ ] Add event versioning and upcasting
- [ ] Create projection system for read models
- [ ] Implement distributed event streaming
- [ ] Add event sourcing dashboard UI