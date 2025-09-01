/**
 * Event Store Implementation with SQLite Persistence
 * Core persistence layer for event sourcing
 */

import Database from "better-sqlite3";
import * as path from "path";
import * as fs from "fs";
import { EventEmitter } from "node:events";
import {
  DomainEvent,
  EventData,
  AggregateSnapshot,
  EventStreamPosition,
  EventRegistry,
} from "./domain-event";

/**
 * Event Store configuration
 */
export interface EventStoreConfig {
  dbPath: string;
  snapshotFrequency?: number; // Create snapshot every N events
  maxEventsPerAggregate?: number; // Max events before requiring snapshot
  enableWAL?: boolean; // Enable Write-Ahead Logging for better performance
  enableCompression?: boolean; // Compress event payloads
  vacuumOnStartup?: boolean; // Run VACUUM on startup
}

/**
 * Event filter for queries
 */
export interface EventFilter {
  aggregateId?: string;
  eventTypes?: string[];
  fromVersion?: number;
  toVersion?: number;
  fromTimestamp?: Date;
  toTimestamp?: Date;
  metadata?: Record<string, any>;
}

/**
 * Event Store implementation with SQLite backend
 */
export class _EventStore extends EventEmitter {
  private db: Database.Database;
  private config: Required<EventStoreConfig>;
  private isInitialized = false;
  private eventHandlers = new Map<
    string,
    ((event: DomainEvent) => Promise<void>)[]
  >();

  constructor(_config: EventStoreConfig) {
    super();

    this._config = {
      dbPath: _config.dbPath,
      snapshotFrequency: _config.snapshotFrequency ?? 100,
      maxEventsPerAggregate: _config.maxEventsPerAggregate ?? 1000,
      enableWAL: _config.enableWAL ?? true,
      enableCompression: _config.enableCompression ?? false,
      vacuumOnStartup: _config.vacuumOnStartup ?? false,
    };

    this.ensureDirectoryExists();
    this.initializeDatabase();
  }

  /**
   * Ensure the database directory exists
   */
  private ensureDirectoryExists(): void {
    const _dir = path.dirname(this.config.dbPath);
    if (!fs.existsSync(_dir)) {
      fs.mkdirSync(_dir, { recursive: true });
    }
  }

  /**
   * Initialize database and create schema
   */
  private initializeDatabase(): void {
    try {
      this.db = new Database(this.config.dbPath);

      // Enable WAL mode for better concurrency
      if (this.config.enableWAL) {
        this.db.pragma("journal_mode = WAL");
      }

      // Optimize SQLite settings
      this.db.pragma("synchronous = NORMAL");
      this.db.pragma("cache_size = -64000"); // 64MB cache
      this.db.pragma("temp_store = MEMORY");
      this.db.pragma("mmap_size = 30000000000"); // 30GB mmap

      this.createSchema();

      // Run VACUUM if configured
      if (this.config.vacuumOnStartup) {
        this.db.exec("VACUUM");
      }

      this.isInitialized = true;
    } catch (_error) {
      console._error("Failed to initialize EventStore database:", _error);
      throw new Error(`EventStore initialization failed: ${_error}`);
    }
  }

  /**
   * Create database schema
   */
  private createSchema(): void {
    // Events table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id TEXT UNIQUE NOT NULL,
        aggregate_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        version INTEGER NOT NULL,
        timestamp INTEGER NOT NULL,
        user_id TEXT,
        correlation_id TEXT,
        causation_id TEXT,
        metadata TEXT,
        _payload TEXT NOT NULL,
        checksum TEXT,
        created_at INTEGER DEFAULT (unixepoch('now') * 1000),
        UNIQUE(aggregate_id, version)
      );

      CREATE INDEX IF NOT EXISTS idx_events_aggregate_id 
        ON events(aggregate_id);
      CREATE INDEX IF NOT EXISTS idx_events_timestamp 
        ON events(timestamp);
      CREATE INDEX IF NOT EXISTS idx_events_event_type 
        ON events(event_type);
      CREATE INDEX IF NOT EXISTS idx_events_correlation_id 
        ON events(correlation_id);
    `);

    // Snapshots table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        aggregate_id TEXT NOT NULL,
        version INTEGER NOT NULL,
        data TEXT NOT NULL,
        checksum TEXT,
        timestamp INTEGER NOT NULL,
        created_at INTEGER DEFAULT (unixepoch('now') * 1000),
        UNIQUE(aggregate_id, version)
      );

      CREATE INDEX IF NOT EXISTS idx_snapshots_aggregate_id 
        ON snapshots(aggregate_id);
      CREATE INDEX IF NOT EXISTS idx_snapshots_version 
        ON snapshots(aggregate_id, version DESC);
    `);

    // Event streams table for tracking positions
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS event_streams (
        aggregate_id TEXT PRIMARY KEY,
        current_version INTEGER NOT NULL DEFAULT 0,
        last_event_id TEXT,
        last_snapshot_version INTEGER DEFAULT 0,
        event_count INTEGER DEFAULT 0,
        updated_at INTEGER DEFAULT (unixepoch('now') * 1000)
      );
    `);

    // Projections table for read models
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS projections (
        id TEXT PRIMARY KEY,
        projection_type TEXT NOT NULL,
        data TEXT NOT NULL,
        version INTEGER NOT NULL,
        updated_at INTEGER DEFAULT (unixepoch('now') * 1000)
      );

      CREATE INDEX IF NOT EXISTS idx_projections_type 
        ON projections(projection_type);
    `);
  }

  /**
   * Append events to the store
   */
  async append(events: DomainEvent[]): Promise<void> {
    if (!this.isInitialized) {
      throw new Error("EventStore not initialized");
    }

    if (events.length === 0) return;

    const _transaction = this.db._transaction(() => {
      for (const event of events) {
        // Serialize event
        const _eventData = event.toJSON();
        const _payload = this.config.enableCompression
          ? this.compress(JSON.stringify(_eventData._payload))
          : JSON.stringify(_eventData._payload);

        // Insert event
        const _stmt = this.db.prepare(`
          INSERT INTO events (
            event_id, aggregate_id, event_type, version, timestamp,
            user_id, correlation_id, causation_id, metadata, _payload
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
          _eventData.eventId,
          _eventData.aggregateId,
          _eventData.eventType,
          eventData.version,
          new Date(_eventData.timestamp).getTime(),
          _eventData.userId || null,
          _eventData.correlationId || null,
          eventData.causationId || null,
          JSON.stringify(_eventData.metadata),
          _payload,
        );

        // Update event stream
        this.updateEventStream(event.aggregateId, event.version, event.eventId);

        // Check if snapshot is needed
        this.checkSnapshotRequired(event.aggregateId, event.version);
      }
    });

    try {
      _transaction();

      // Publish events to subscribers
      await this.publishEvents(events);
    } catch (_error) {
      console._error("Failed to append events:", _error);
      throw new Error(`Failed to append events: ${_error}`);
    }
  }

  /**
   * Get events for an aggregate
   */
  async getEvents(
    aggregateId: string,
    fromVersion?: number,
    toVersion?: number,
  ): Promise<DomainEvent[]> {
    if (!this.isInitialized) {
      throw new Error("EventStore not initialized");
    }

    let query = "SELECT * FROM events WHERE aggregate_id = ?";
    const params: any[] = [aggregateId];

    if (fromVersion !== undefined) {
      query += " AND version >= ?";
      params.push(fromVersion);
    }

    if (toVersion !== undefined) {
      query += " AND version <= ?";
      params.push(toVersion);
    }

    query += " ORDER BY version ASC";

    const _stmt = this.db.prepare(query);
    const _rows = _stmt.all(...params);

    return _rows.map((_row) => this.deserializeEvent(_row));
  }

  /**
   * Get events by filter
   */
  async getEventsByFilter(filter: EventFilter): Promise<DomainEvent[]> {
    if (!this.isInitialized) {
      throw new Error("EventStore not initialized");
    }

    let query = "SELECT * FROM events WHERE 1=1";
    const params: any[] = [];

    if (filter.aggregateId) {
      query += " AND aggregate_id = ?";
      params.push(filter.aggregateId);
    }

    if (filter.eventTypes && filter.eventTypes.length > 0) {
      const _placeholders = filter.eventTypes.map(() => "?").join(",");
      query += ` AND event_type IN (${_placeholders})`;
      params.push(...filter.eventTypes);
    }

    if (filter.fromVersion !== undefined) {
      query += " AND version >= ?";
      params.push(filter.fromVersion);
    }

    if (filter.toVersion !== undefined) {
      query += " AND version <= ?";
      params.push(filter.toVersion);
    }

    if (filter.fromTimestamp) {
      query += " AND timestamp >= ?";
      params.push(filter.fromTimestamp.getTime());
    }

    if (filter.toTimestamp) {
      query += " AND timestamp <= ?";
      params.push(filter.toTimestamp.getTime());
    }

    query += " ORDER BY timestamp ASC, version ASC";

    const _stmt = this.db.prepare(query);
    const _rows = _stmt.all(...params);

    return _rows.map((_row) => this.deserializeEvent(_row));
  }

  /**
   * Replay events in a time range
   */
  async *replay(_from: Date, to: Date): AsyncIterable<DomainEvent> {
    if (!this.isInitialized) {
      throw new Error("EventStore not initialized");
    }

    const _stmt = this.db.prepare(`
      SELECT * FROM events 
      WHERE timestamp >= ? AND timestamp <= ?
      ORDER BY timestamp ASC, id ASC
    `);

    const _iterator = _stmt.iterate(_from.getTime(), to.getTime());

    for (const _row of _iterator) {
      yield this.deserializeEvent(_row);
    }
  }

  /**
   * Get latest snapshot for an aggregate
   */
  async getSnapshot(aggregateId: string): Promise<AggregateSnapshot | null> {
    if (!this.isInitialized) {
      throw new Error("EventStore not initialized");
    }

    const _stmt = this.db.prepare(`
      SELECT * FROM snapshots 
      WHERE aggregate_id = ? 
      ORDER BY version DESC 
      LIMIT 1
    `);

    const _row = _stmt.get(aggregateId);

    if (!_row) {
      return null;
    }

    return {
      aggregateId: _row.aggregate_id,
      version: _row.version,
      data: JSON.parse(_row.data),
      timestamp: new Date(_row.timestamp),
      checksum: _row.checksum,
    };
  }

  /**
   * Create a snapshot
   */
  async createSnapshot(snapshot: AggregateSnapshot): Promise<void> {
    if (!this.isInitialized) {
      throw new Error("EventStore not initialized");
    }

    const _stmt = this.db.prepare(`
      INSERT OR REPLACE INTO snapshots (
        aggregate_id, version, data, checksum, timestamp
      ) VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(
      snapshot.aggregateId,
      snapshot.version,
      JSON.stringify(snapshot.data),
      snapshot.checksum || null,
      snapshot.timestamp.getTime(),
    );

    // Update event stream snapshot version
    const _updateStmt = this.db.prepare(`
      UPDATE event_streams 
      SET last_snapshot_version = ? 
      WHERE aggregate_id = ?
    `);

    updateStmt.run(snapshot.version, snapshot.aggregateId);
  }

  /**
   * Get current version for an aggregate
   */
  async getCurrentVersion(aggregateId: string): Promise<number> {
    if (!this.isInitialized) {
      throw new Error("EventStore not initialized");
    }

    const _stmt = this.db.prepare(`
      SELECT current_version FROM event_streams 
      WHERE aggregate_id = ?
    `);

    const _row = _stmt.get(aggregateId);
    return _row ? _row.current_version : 0;
  }

  /**
   * Get event stream position
   */
  async getStreamPosition(
    aggregateId: string,
  ): Promise<EventStreamPosition | null> {
    if (!this.isInitialized) {
      throw new Error("EventStore not initialized");
    }

    const _stmt = this.db.prepare(`
      SELECT * FROM event_streams 
      WHERE aggregate_id = ?
    `);

    const _row = _stmt.get(aggregateId);

    if (!_row) {
      return null;
    }

    return {
      aggregateId: _row.aggregate_id,
      version: _row.current_version,
      timestamp: new Date(_row.updated_at),
    };
  }

  /**
   * Subscribe to events
   */
  subscribe(
    _eventType: string,
    handler: (event: DomainEvent) => Promise<void>,
  ): void {
    const _handlers = this.eventHandlers.get(_eventType) || [];
    handlers.push(handler);
    this.eventHandlers.set(_eventType, _handlers);
  }

  /**
   * Unsubscribe from events
   */
  unsubscribe(
    _eventType: string,
    handler: (event: DomainEvent) => Promise<void>,
  ): void {
    const _handlers = this.eventHandlers.get(_eventType) || [];
    const _index = _handlers.indexOf(handler);
    if (_index > -1) {
      handlers.splice(_index, 1);
      this.eventHandlers.set(_eventType, _handlers);
    }
  }

  /**
   * Publish events to subscribers
   */
  private async publishEvents(events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      // Emit to EventEmitter listeners
      this.emit("event", event);
      this.emit(event.eventType, event);

      // Call registered _handlers
      const _handlers = this.eventHandlers.get(event.eventType) || [];
      const _allHandlers = this.eventHandlers.get("*") || [];

      for (const handler of [..._handlers, ..._allHandlers]) {
        try {
          await handler(event);
        } catch (_error) {
          console._error(
            `Error in event handler for ${event.eventType}:`,
            _error,
          );
        }
      }
    }
  }

  /**
   * Update event stream tracking
   */
  private updateEventStream(
    _aggregateId: string,
    version: number,
    eventId: string,
  ): void {
    const _stmt = this.db.prepare(`
      INSERT INTO event_streams (aggregate_id, current_version, last_event_id, event_count)
      VALUES (?, ?, ?, 1)
      ON CONFLICT(aggregate_id) DO UPDATE SET
        current_version = ?,
        last_event_id = ?,
        event_count = event_count + 1,
        updated_at = unixepoch('now') * 1000
    `);

    stmt.run(_aggregateId, version, eventId, version, eventId);
  }

  /**
   * Check if snapshot is required
   */
  private checkSnapshotRequired(_aggregateId: string, version: number): void {
    if (version % this.config.snapshotFrequency === 0) {
      // Emit event for snapshot creation (handled asynchronously)
      this.emit("snapshot-required", { _aggregateId, version });
    }
  }

  /**
   * Deserialize event from database _row
   */
  private deserializeEvent(_row: unknown): DomainEvent {
    const _eventData: EventData = {
      eventId: _row.event_id,
      aggregateId: _row.aggregate_id,
      eventType: _row.event_type,
      version: _row.version,
      timestamp: new Date(_row.timestamp).toISOString(),
      userId: _row.user_id,
      correlationId: _row.correlation_id,
      causationId: _row.causation_id,
      metadata: JSON.parse(_row.metadata || "{}"),
      _payload: this.config.enableCompression
        ? JSON.parse(this.decompress(_row.payload))
        : JSON.parse(_row.payload),
    };

    return EventRegistry.deserialize(_eventData);
  }

  /**
   * Compress data (placeholder - implement actual compression)
   */
  private compress(data: string): string {
    // TODO: Implement actual compression (e.g., using lz4)
    return data;
  }

  /**
   * Decompress data (placeholder - implement actual decompression)
   */
  private decompress(data: string): string {
    // TODO: Implement actual decompression (e.g., using lz4)
    return data;
  }

  /**
   * Get database statistics
   */
  async getStatistics(): Promise<any> {
    if (!this.isInitialized) {
      throw new Error("EventStore not initialized");
    }

    const _stats = {
      totalEvents: this.db.prepare("SELECT COUNT(*) as count FROM events").get()
        .count,
      totalSnapshots: this.db
        .prepare("SELECT COUNT(*) as count FROM snapshots")
        .get().count,
      totalAggregates: this.db
        .prepare("SELECT COUNT(*) as count FROM event_streams")
        .get().count,
      oldestEvent: this.db
        .prepare("SELECT MIN(timestamp) as ts FROM events")
        .get().ts,
      newestEvent: this.db
        .prepare("SELECT MAX(timestamp) as ts FROM events")
        .get().ts,
      databaseSize: fs.statSync(this.config.dbPath).size,
    };

    return _stats;
  }

  /**
   * Clean up old snapshots
   */
  async cleanupSnapshots(keepLatest: number = 3): Promise<number> {
    if (!this.isInitialized) {
      throw new Error("EventStore not initialized");
    }

    const _stmt = this.db.prepare(`
      DELETE FROM snapshots
      WHERE (aggregate_id, version) NOT IN (
        SELECT aggregate_id, version
        FROM (
          SELECT aggregate_id, version,
                 ROW_NUMBER() OVER (PARTITION BY aggregate_id ORDER BY version DESC) as rn
          FROM snapshots
        )
        WHERE rn <= ?
      )
    `);

    const _result = _stmt.run(keepLatest);
    return _result.changes;
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.isInitialized = false;
    }
  }
}
