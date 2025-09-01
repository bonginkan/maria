/**
 * Memory Repository Adapter
 * Concrete implementation of memory storage using SQLite
 */

import { Database } from "sqlite3";
import {
  _IMemoryRepositoryPort,
  MemoryEntity,
  MemoryFilter,
  MemoryStats,
} from "../ports/memory-repository.port";
import { v4 as uuidv4 } from "uuid";

export class SQLiteMemoryRepositoryAdapter implements IMemoryRepositoryPort {
  private db: Database;
  private initialized: boolean = false;

  constructor(_dbPath: string = "memory.db") {
    this.db = new Database(_dbPath);
  }

  async initialize(): Promise<void> {
    if (this.initialized) return Promise.resolve();

    return new Promise((resolvePromise, reject) => {
      this.db.serialize(() => {
        this.db.run(
          `
          CREATE TABLE IF NOT EXISTS memories (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL,
            data TEXT NOT NULL,
            size INTEGER NOT NULL,
            tags TEXT NOT NULL,
            tier TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            access_count INTEGER DEFAULT 0,
            last_accessed_at TEXT NOT NULL,
            metadata TEXT NOT NULL
          )
        `,
          (err) => {
            if (err) {
              reject(err);
              return;
            }

            // Create indexes
            this.db.run(
              "CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type)",
            );
            this.db.run(
              "CREATE INDEX IF NOT EXISTS idx_memories_tier ON memories(tier)",
            );
            this.db.run(
              "CREATE INDEX IF NOT EXISTS idx_memories_created_at ON memories(created_at)",
            );
            this.db.run(
              "CREATE INDEX IF NOT EXISTS idx_memories_access_count ON memories(access_count)",
            );

            this.initialized = true;
            resolve();
          },
        );
      });
    });
  }

  async store(
    _memory: Omit<MemoryEntity, "id" | "createdAt" | "updatedAt">,
  ): Promise<MemoryEntity> {
    await this.initialize();

    const id = uuidv4();
    const _now = new Date().toISOString();
    const entity: MemoryEntity = {
      id,
      ..._memory,
      createdAt: new Date(_now),
      updatedAt: new Date(_now),
    };

    return new Promise((resolvePromise, reject) => {
      const _stmt = this.db.prepare(`
        INSERT INTO memories (
          id, type, data, size, tags, tier, created_at, updated_at,
          access_count, last_accessed_at, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        id,
        entity.type,
        JSON.stringify(entity.data),
        entity.size,
        JSON.stringify(entity.tags),
        entity.tier,
        _now,
        _now,
        entity.accessCount,
        entity.lastAccessedAt.toISOString(),
        JSON.stringify(entity.metadata),
        function (err) {
          if (err) {
            reject(err);
            return;
          }
          resolve(entity);
        },
      );

      stmt.finalize();
    });
  }

  async findById(id: string): Promise<MemoryEntity | null> {
    await this.initialize();

    return new Promise((resolvePromise, reject) => {
      this.db.get(
        "SELECT * FROM memories WHERE id = ?",
        [id],
        (err, row: unknown) => {
          if (err) {
            reject(err);
            return;
          }

          if (!row) {
            resolve(null);
            return;
          }

          resolve(this.mapRowToEntity(row));
        },
      );
    });
  }

  async findByCriteria(
    filter: MemoryFilter,
    limit: number = 100,
    offset: number = 0,
  ): Promise<MemoryEntity[]> {
    await this.initialize();

    const { query, _params } = this.buildFilterQuery(filter, limit, offset);

    return new Promise((resolvePromise, reject) => {
      this.db.all(query, _params, (err, rows: any[]) => {
        if (err) {
          reject(err);
          return;
        }

        const _entities = rows.map((row) => this.mapRowToEntity(row));
        resolve(_entities);
      });
    });
  }

  async update(
    _id: string,
    updates: Partial<MemoryEntity>,
  ): Promise<MemoryEntity | null> {
    await this.initialize();

    const _existing = await this.findById(_id);
    if (!_existing) {
      return null;
    }

    const _updated = {
      ..._existing,
      ...updates,
      updatedAt: new Date(),
    };

    return new Promise((resolvePromise, reject) => {
      const _stmt = this.db.prepare(`
        UPDATE memories SET
          type = ?, data = ?, size = ?, tags = ?, tier = ?,
          updated_at = ?, access_count = ?, last_accessed_at = ?, metadata = ?
        WHERE id = ?
      `);

      stmt.run(
        updated.type,
        JSON.stringify(_updated.data),
        updated.size,
        JSON.stringify(_updated.tags),
        _updated.tier,
        _updated.updatedAt.toISOString(),
        _updated.accessCount,
        updated.lastAccessedAt.toISOString(),
        JSON.stringify(_updated.metadata),
        id,
        function (err) {
          if (err) {
            reject(err);
            return;
          }
          resolve(_updated);
        },
      );

      stmt.finalize();
    });
  }

  async delete(id: string): Promise<boolean> {
    await this.initialize();

    return new Promise((resolvePromise, reject) => {
      this.db.run("DELETE FROM memories WHERE id = ?", [id], function (err) {
        if (err) {
          reject(err);
          return;
        }
        resolve(this.changes > 0);
      });
    });
  }

  async search(
    _query: string,
    fields: string[],
    limit: number = 50,
  ): Promise<MemoryEntity[]> {
    await this.initialize();

    const _searchPattern = `%${_query.toLowerCase()}%`;
    const _fieldConditions = fields
      .map(() => "LOWER(data) LIKE ?")
      .join(" OR ");

    const _sql = `
      SELECT * FROM memories 
      WHERE ${_fieldConditions}
      ORDER BY access_count DESC, last_accessed_at DESC
      LIMIT ?
    `;

    const _params = [...fields.map(() => _searchPattern), limit];

    return new Promise((resolvePromise, reject) => {
      this.db.all(_sql, _params, (err, rows: any[]) => {
        if (err) {
          reject(err);
          return;
        }

        const _entities = rows.map((row) => this.mapRowToEntity(row));
        resolve(_entities);
      });
    });
  }

  async getStats(filter?: MemoryFilter): Promise<MemoryStats> {
    await this.initialize();

    let baseQuery = "SELECT * FROM memories";
    const _params: any[] = [];

    if (filter) {
      const { query: filterQuery, _params: filterParams } =
        this.buildFilterQuery(filter);
      baseQuery = filterQuery.replace(/LIMIT \d+ OFFSET \d+$/, "");
      params.push(...filterParams);
    }

    return new Promise((resolvePromise, reject) => {
      this.db.all(baseQuery, _params, (err, rows: any[]) => {
        if (err) {
          reject(err);
          return;
        }

        const stats: MemoryStats = {
          totalMemories: rows.length,
          totalSize: rows.reduce((sum, row) => sum + row.size, 0),
          memoryByTier: Record<string, any>,
          memoryByType: Record<string, any>,
          averageAccessCount:
            rows.length > 0
              ? rows.reduce((sum, row) => sum + row.access_count, 0) /
                rows.length
              : 0,
          lastUpdated: new Date(),
        };

        rows.forEach((row) => {
          stats.memoryByTier[row.tier] =
            (stats.memoryByTier[row.tier] || 0) + row.size;
          stats.memoryByType[row.type] =
            (stats.memoryByType[row.type] || 0) + 1;
        });

        resolve(stats);
      });
    });
  }

  async bulkStore(
    _memories: Omit<MemoryEntity, "id" | "createdAt" | "updatedAt">[],
  ): Promise<MemoryEntity[]> {
    await this.initialize();

    const results: MemoryEntity[] = [];

    return new Promise((resolvePromise, reject) => {
      this.db.serialize(() => {
        this.db.run("BEGIN TRANSACTION");

        const _stmt = this.db.prepare(`
          INSERT INTO memories (
            id, type, data, size, tags, tier, created_at, updated_at,
            access_count, last_accessed_at, metadata
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        memories.forEach((memory) => {
          const id = uuidv4();
          const _now = new Date().toISOString();
          const entity: MemoryEntity = {
            id,
            ...memory,
            createdAt: new Date(_now),
            updatedAt: new Date(_now),
          };

          stmt.run(
            id,
            entity.type,
            JSON.stringify(entity.data),
            entity.size,
            JSON.stringify(entity.tags),
            entity.tier,
            _now,
            _now,
            entity.accessCount,
            entity.lastAccessedAt.toISOString(),
            JSON.stringify(entity.metadata),
          );

          results.push(entity);
        });

        stmt.finalize();

        this.db.run("COMMIT", (err) => {
          if (err) {
            this.db.run("ROLLBACK");
            reject(err);
            return;
          }
          resolve(results);
        });
      });
    });
  }

  async bulkUpdate(
    updates: Array<{ id: string; updates: Partial<MemoryEntity> }>,
  ): Promise<MemoryEntity[]> {
    const results: MemoryEntity[] = [];

    for (const update of updates) {
      const _result = await this.update(update.id, update.updates);
      if (_result) {
        results.push(_result);
      }
    }

    return results;
  }

  async bulkDelete(ids: string[]): Promise<number> {
    await this.initialize();

    if (ids.length === 0) return 0;

    const _placeholders = ids.map(() => "?").join(", ");
    const _sql = `DELETE FROM memories WHERE id IN (${_placeholders})`;

    return new Promise((resolvePromise, reject) => {
      this.db.run(_sql, ids, function (err) {
        if (err) {
          reject(err);
          return;
        }
        resolve(this.changes);
      });
    });
  }

  async transaction<T>(
    _operation: (repo: IMemoryRepositoryPort) => Promise<T>,
  ): Promise<T> {
    await this.initialize();

    return new Promise((resolvePromise, reject) => {
      this.db.serialize(async () => {
        this.db.run("BEGIN TRANSACTION");

        try {
          const _result = await _operation(this);
          this.db.run("COMMIT", (err) => {
            if (err) {
              reject(err);
              return;
            }
            resolve(_result);
          });
        } catch (_error) {
          this.db.run("ROLLBACK", () => {
            reject(_error);
          });
        }
      });
    });
  }

  private mapRowToEntity(row: unknown): MemoryEntity {
    return {
      id: row.id,
      type: row.type,
      data: JSON.parse(row.data),
      size: row.size,
      tags: JSON.parse(row.tags),
      tier: row.tier,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      accessCount: row.access_count,
      lastAccessedAt: new Date(row.last_accessed_at),
      metadata: JSON.parse(row.metadata),
    };
  }

  private buildFilterQuery(
    _filter: MemoryFilter,
    limit?: number,
    offset?: number,
  ): { query: string; _params: any[] } {
    const conditions: string[] = [];
    const _params: any[] = [];

    if (_filter.type) {
      conditions.push("type = ?");
      params.push(_filter.type);
    }

    if (_filter.tier) {
      conditions.push("tier = ?");
      params.push(_filter.tier);
    }

    if (_filter.tags && _filter.tags.length > 0) {
      const _tagConditions = _filter.tags.map(() => "tags LIKE ?");
      conditions.push(`(${_tagConditions.join(" OR ")})`);
      params.push(..._filter.tags.map((tag) => `%"${tag}"%`));
    }

    if (_filter.sizeRange) {
      if (_filter.sizeRange.min !== undefined) {
        conditions.push("size >= ?");
        params.push(_filter.sizeRange.min);
      }
      if (_filter.sizeRange.max !== undefined) {
        conditions.push("size <= ?");
        params.push(_filter.sizeRange.max);
      }
    }

    if (_filter.dateRange) {
      if (_filter.dateRange.from) {
        conditions.push("created_at >= ?");
        params.push(_filter.dateRange.from.toISOString());
      }
      if (_filter.dateRange.to) {
        conditions.push("created_at <= ?");
        params.push(_filter.dateRange.to.toISOString());
      }
    }

    let query = "SELECT * FROM memories";
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(" AND ")}`;
    }

    query += " ORDER BY created_at DESC";

    if (limit !== undefined) {
      query += ` LIMIT ${limit}`;
      if (offset !== undefined && offset > 0) {
        query += ` OFFSET ${offset}`;
      }
    }

    return { query, _params };
  }
}
