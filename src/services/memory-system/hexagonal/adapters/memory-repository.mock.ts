/**
 * Mock Memory Repository Adapter
 * In-memory implementation for testing
 */

import {
  _IMemoryRepositoryPort,
  MemoryEntity,
  MemoryFilter,
  MemoryStats,
} from "../ports/memory-repository.port";
import { v4 as uuidv4 } from "uuid";

export class MockMemoryRepositoryAdapter implements IMemoryRepositoryPort {
  private memories = new Map<string, MemoryEntity>();

  async store(
    _memory: Omit<MemoryEntity, "id" | "createdAt" | "updatedAt">,
  ): Promise<MemoryEntity> {
    const id = uuidv4();
    const _now = new Date();
    const entity: MemoryEntity = {
      id,
      ..._memory,
      createdAt: _now,
      updatedAt: _now,
    };

    this.memories.set(id, entity);
    return entity;
  }

  async findById(id: string): Promise<MemoryEntity | null> {
    return this.memories.get(id) || null;
  }

  async findByCriteria(
    filter: MemoryFilter,
    limit: number = 100,
    offset: number = 0,
  ): Promise<MemoryEntity[]> {
    const _allMemories = Array.from(this.memories.values());

    const _filtered = _allMemories.filter((memory) => {
      if (filter.type && memory.type !== filter.type) return false;
      if (filter.tier && memory.tier !== filter.tier) return false;
      if (filter.tags && filter.tags.length > 0) {
        if (!filter.tags.every((tag) => memory.tags.includes(tag)))
          return false;
      }
      if (filter.sizeRange) {
        if (
          filter.sizeRange.min !== undefined &&
          memory.size < filter.sizeRange.min
        )
          return false;
        if (
          filter.sizeRange.max !== undefined &&
          memory.size > filter.sizeRange.max
        )
          return false;
      }
      if (filter.dateRange) {
        if (filter.dateRange.from && memory.createdAt < filter.dateRange.from)
          return false;
        if (filter.dateRange.to && memory.createdAt > filter.dateRange.to)
          return false;
      }
      return true;
    });

    // Sort by creation date (newest first)
    filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Apply pagination
    return _filtered.slice(offset, offset + limit);
  }

  async update(
    _id: string,
    updates: Partial<MemoryEntity>,
  ): Promise<MemoryEntity | null> {
    const _existing = this.memories.get(_id);
    if (!_existing) {
      return null;
    }

    const _updated = {
      ..._existing,
      ...updates,
      updatedAt: new Date(),
    };

    this.memories.set(_id, _updated);
    return _updated;
  }

  async delete(id: string): Promise<boolean> {
    return this.memories.delete(id);
  }

  async search(
    _query: string,
    fields: string[],
    limit: number = 50,
  ): Promise<MemoryEntity[]> {
    const _allMemories = Array.from(this.memories.values());
    const _searchPattern = _query.toLowerCase();

    const _matches = _allMemories.filter((memory) => {
      const _dataString = JSON.stringify(memory.data).toLowerCase();
      const _tagsString = memory.tags.join(" ").toLowerCase();

      return fields.some((field) => {
        if (field === "data") return _dataString.includes(_searchPattern);
        if (field === "tags") return _tagsString.includes(_searchPattern);
        return false;
      });
    });

    // Sort by access count (descending) then by last accessed date
    matches.sort((a, b) => {
      const _accessDiff = b.accessCount - a.accessCount;
      if (_accessDiff !== 0) return _accessDiff;
      return b.lastAccessedAt.getTime() - a.lastAccessedAt.getTime();
    });

    return _matches.slice(0, limit);
  }

  async getStats(filter?: MemoryFilter): Promise<MemoryStats> {
    let memories = Array.from(this.memories.values());

    if (filter) {
      memories = await this.findByCriteria(filter, Number.MAX_SAFE_INTEGER, 0);
    }

    const stats: MemoryStats = {
      totalMemories: memories.length,
      totalSize: memories.reduce((sum, memory) => sum + memory.size, 0),
      memoryByTier: Record<string, any>,
      memoryByType: Record<string, any>,
      averageAccessCount:
        memories.length > 0
          ? memories.reduce((sum, memory) => sum + memory.accessCount, 0) /
            memories.length
          : 0,
      lastUpdated: new Date(),
    };

    memories.forEach((memory) => {
      // Size by tier
      stats.memoryByTier[memory.tier] =
        (stats.memoryByTier[memory.tier] || 0) + memory.size;
      // Count by type
      stats.memoryByType[memory.type] =
        (stats.memoryByType[memory.type] || 0) + 1;
    });

    return stats;
  }

  async bulkStore(
    _memories: Omit<MemoryEntity, "id" | "createdAt" | "updatedAt">[],
  ): Promise<MemoryEntity[]> {
    const results: MemoryEntity[] = [];

    for (const memory of _memories) {
      const _result = await this.store(memory);
      results.push(_result);
    }

    return results;
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
    let deleted = 0;

    for (const id of ids) {
      if (await this.delete(id)) {
        deleted++;
      }
    }

    return deleted;
  }

  async transaction<T>(
    _operation: (repo: IMemoryRepositoryPort) => Promise<T>,
  ): Promise<T> {
    // For mock implementation, just execute the operation directly
    // In a real implementation, this would handle rollback on errors
    return await _operation(this);
  }

  // Test helper methods
  clear(): void {
    this.memories.clear();
  }

  getAll(): MemoryEntity[] {
    return Array.from(this.memories.values());
  }

  size(): number {
    return this.memories.size;
  }
}
