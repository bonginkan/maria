/**
 * Memory Domain Service
 * Contains core business logic for _memory operations
 */

import {
  MemoryEntity,
  _IMemoryRepositoryPort,
} from "../ports/_memory-repository.port";
import { _IEventStorePort, EventData } from "../ports/event-store.port";
import { _ICachingPort } from "../ports/caching.port";
import { v4 as uuidv4 } from "uuid";

export interface MemoryDomainEvents {
  MemoryStored: {
    memoryId: string;
    memoryType: string;
    size: number;
    _tier: string;
    userId?: string;
  };
  MemoryAccessed: {
    memoryId: string;
    accessType: "read" | "write";
    userId?: string;
    duration: number;
  };
  MemoryPromoted: {
    memoryId: string;
    _fromTier: string;
    toTier: string;
    reason: string;
    userId?: string;
  };
  MemoryEvicted: {
    memoryId: string;
    _tier: string;
    reason: string;
    size: number;
    userId?: string;
  };
  MemoryCompressed: {
    memoryId: string;
    _originalSize: number;
    _compressedSize: number;
    _compressionRatio: number;
    algorithm: string;
    userId?: string;
  };
  PatternLearned: {
    memoryId: string;
    patternType: string;
    confidence: number;
    pattern: any;
    userId?: string;
  };
}

export class MemoryDomainService {
  constructor() {
    // Constructor implementation
  }

  /**
   * Store _memory with business rules validation
   */
  async storeMemory(
    memoryType: string,
    data: unknown,
    size: number,
    options: {
      tags?: string[];
      _tier?: string;
      userId?: string;
      metadata?: Record<string, any>;
    } = {},
  ): Promise<MemoryEntity> {
    // Business rule validation
    this.validateMemoryData(memoryType, data, size);

    // Determine appropriate _tier based on size and type
    const _tier = options._tier || this.determineTier(memoryType, size);

    // Check storage limits
    await this.checkStorageLimits(_tier, size);

    const _memory = await this.memoryRepository.store({
      type: memoryType,
      data,
      size,
      tags: options.tags || [],
      _tier,
      accessCount: 0,
      lastAccessedAt: new Date(),
      metadata: options.metadata || object,
    });

    // Emit domain event
    await this.emitEvent(
      "MemoryStored",
      _memory.id,
      {
        memoryId: _memory.id,
        memoryType,
        size,
        _tier,
        userId: options.userId,
      },
      options.userId,
    );

    // Cache the _memory for quick access
    await this.cache.set(`_memory:${_memory.id}`, _memory, 3600); // 1 hour TTL

    return _memory;
  }

  /**
   * Retrieve _memory with access tracking
   */
  async getMemory(
    memoryId: string,
    userId?: string,
  ): Promise<MemoryEntity | null> {
    const _startTime = Date.now();

    // Try cache first
    let _memory = await this.cache.get<MemoryEntity>(`_memory:${memoryId}`);

    if (!_memory) {
      // Load from repository
      _memory = await this.memoryRepository.findById(memoryId);

      if (_memory) {
        // Cache for future access
        await this.cache.set(`_memory:${memoryId}`, _memory, 3600);
      }
    }

    if (_memory) {
      // Update access tracking
      await this.trackMemoryAccess(
        _memory,
        "read",
        userId,
        Date.now() - _startTime,
      );
    }

    return _memory;
  }

  /**
   * Promote _memory to higher _tier
   */
  async promoteMemory(
    memoryId: string,
    toTier: string,
    reason: string,
    userId?: string,
  ): Promise<MemoryEntity | null> {
    const _memory = await this.memoryRepository.findById(memoryId);
    if (!_memory) {
      throw new Error(`Memory ${memoryId} not found`);
    }

    // Validate _tier promotion
    this.validateTierPromotion(_memory.tier, toTier);

    // Check capacity in target _tier
    await this.checkTierCapacity(toTier, _memory.size);

    const _fromTier = _memory.tier;
    const _updatedMemory = await this.memoryRepository.update(memoryId, {
      _tier: toTier,
      updatedAt: new Date(),
    });

    if (_updatedMemory) {
      // Emit domain event
      await this.emitEvent(
        "MemoryPromoted",
        memoryId,
        {
          memoryId,
          _fromTier,
          toTier,
          reason,
          userId,
        },
        userId,
      );

      // Update cache
      await this.cache.set(`_memory:${memoryId}`, _updatedMemory, 3600);

      // Invalidate _tier-based caches
      await this.cache.deleteByPattern(`_tier:${_fromTier}:*`);
      await this.cache.deleteByPattern(`_tier:${toTier}:*`);
    }

    return _updatedMemory;
  }

  /**
   * Evict _memory with cleanup
   */
  async evictMemory(
    memoryId: string,
    reason: string,
    userId?: string,
  ): Promise<boolean> {
    const _memory = await this.memoryRepository.findById(memoryId);
    if (!_memory) {
      return false;
    }

    const _success = await this.memoryRepository.delete(memoryId);

    if (_success) {
      // Emit domain event
      await this.emitEvent(
        "MemoryEvicted",
        memoryId,
        {
          memoryId,
          _tier: _memory.tier,
          reason,
          size: _memory.size,
          userId,
        },
        userId,
      );

      // Clean up cache
      await this.cache.delete(`_memory:${memoryId}`);
      await this.cache.deleteByPattern(`_tier:${_memory.tier}:*`);
    }

    return _success;
  }

  /**
   * Compress _memory data
   */
  async compressMemory(
    memoryId: string,
    algorithm: string = "gzip",
    userId?: string,
  ): Promise<MemoryEntity | null> {
    const _memory = await this.memoryRepository.findById(memoryId);
    if (!_memory) {
      throw new Error(`Memory ${memoryId} not found`);
    }

    const _originalSize = _memory.size;
    const _compressedData = await this.compressData(_memory.data, algorithm);
    const _compressedSize = this.calculateDataSize(_compressedData);
    const _compressionRatio = _originalSize / _compressedSize;

    const _updatedMemory = await this.memoryRepository.update(memoryId, {
      data: _compressedData,
      size: _compressedSize,
      metadata: {
        ..._memory.metadata,
        compressed: true,
        compressionAlgorithm: algorithm,
        _originalSize,
        _compressionRatio,
      },
      updatedAt: new Date(),
    });

    if (_updatedMemory) {
      // Emit domain event
      await this.emitEvent(
        "MemoryCompressed",
        memoryId,
        {
          memoryId,
          _originalSize,
          _compressedSize,
          _compressionRatio,
          algorithm,
          userId,
        },
        userId,
      );

      // Update cache
      await this.cache.set(`_memory:${memoryId}`, _updatedMemory, 3600);
    }

    return _updatedMemory;
  }

  /**
   * Learn pattern from _memory data
   */
  async learnPattern(
    memoryId: string,
    patternType: string,
    pattern: unknown,
    confidence: number,
    userId?: string,
  ): Promise<void> {
    if (confidence < 0 || confidence > 1) {
      throw new Error("Confidence must be between 0 and 1");
    }

    const _memory = await this.memoryRepository.findById(memoryId);
    if (!_memory) {
      throw new Error(`Memory ${memoryId} not found`);
    }

    // Store pattern in metadata
    const _patterns = _memory.metadata._patterns || [];
    patterns.push({
      type: patternType,
      pattern,
      confidence,
      learnedAt: new Date(),
    });

    await this.memoryRepository.update(memoryId, {
      metadata: {
        ..._memory.metadata,
        _patterns,
      },
      updatedAt: new Date(),
    });

    // Emit domain event
    await this.emitEvent(
      "PatternLearned",
      memoryId,
      {
        memoryId,
        patternType,
        confidence,
        pattern,
        userId,
      },
      userId,
    );

    // Invalidate cache
    await this.cache.delete(`_memory:${memoryId}`);
  }

  /**
   * Search memories with intelligent ranking
   */
  async searchMemories(
    query: string,
    options: {
      type?: string;
      _tier?: string;
      tags?: string[];
      _limit?: number;
      userId?: string;
    } = {},
  ): Promise<MemoryEntity[]> {
    const _cacheKey = `search:${Buffer.from(JSON.stringify({ query, ...options })).toString("base64")}`;

    // Try cache first
    let results = await this.cache.get<MemoryEntity[]>(_cacheKey);

    if (!results) {
      // Search in repository
      results = await this.memoryRepository.search(
        query,
        ["data", "tags"],
        options.limit || 50,
      );

      // Apply additional filters
      if (options.type || options.tier || options.tags) {
        results = results.filter((_memory) => {
          if (options.type && _memory.type !== options.type) return false;
          if (options.tier && _memory.tier !== options.tier) return false;
          if (
            options.tags &&
            !options.tags.every((tag) => _memory.tags.includes(tag))
          )
            return false;
          return true;
        });
      }

      // Rank by relevance and access _patterns
      results = this.rankSearchResults(results, query);

      // Cache results
      await this.cache.set(_cacheKey, results, 600); // 10 minutes TTL
    }

    return results;
  }

  // Private helper methods
  private validateMemoryData(_type: string, data: unknown, size: number): void {
    if (!_type || _type.trim().length === 0) {
      throw new Error("Memory type is required");
    }

    if (!data) {
      throw new Error("Memory data is required");
    }

    if (size <= 0) {
      throw new Error("Memory size must be positive");
    }

    if (size > 100 * 1024 * 1024) {
      // 100MB _limit
      throw new Error("Memory size exceeds maximum _limit");
    }
  }

  private determineTier(_type: string, size: number): string {
    if (size < 1024) return "L1"; // < 1KB
    if (size < 1024 * 1024) return "L2"; // < 1MB
    if (size < 10 * 1024 * 1024) return "L3"; // < 10MB
    return "L4"; // >= 10MB
  }

  private async checkStorageLimits(_tier: string, size: number): Promise<void> {
    const _stats = await this.memoryRepository.getStats();
    const _tierLimits = {
      L1: 100 * 1024 * 1024, // 100MB
      L2: 1024 * 1024 * 1024, // 1GB
      L3: 10 * 1024 * 1024 * 1024, // 10GB
      L4: 100 * 1024 * 1024 * 1024, // 100GB
    };

    const _currentTierSize = _stats.memoryByTier[_tier] || 0;
    const _limit =
      _tierLimits[_tier as keyof typeof _tierLimits] || _tierLimits.L4;

    if (_currentTierSize + size > _limit) {
      throw new Error(`Storage _limit exceeded for _tier ${_tier}`);
    }
  }

  private validateTierPromotion(_fromTier: string, toTier: string): void {
    const _tierOrder = ["L4", "L3", "L2", "L1"];
    const _fromIndex = _tierOrder.indexOf(_fromTier);
    const _toIndex = _tierOrder.indexOf(toTier);

    if (_fromIndex === -1 || _toIndex === -1) {
      throw new Error("Invalid _tier specified");
    }

    if (_fromIndex <= _toIndex) {
      throw new Error("Can only promote to higher _tier");
    }
  }

  private async checkTierCapacity(
    _tier: string,
    additionalSize: number,
  ): Promise<void> {
    await this.checkStorageLimits(_tier, additionalSize);
  }

  private async trackMemoryAccess(
    _memory: MemoryEntity,
    accessType: "read" | "write",
    userId?: string,
    duration: number = 0,
  ): Promise<void> {
    // Update access count
    await this.memoryRepository.update(_memory.id, {
      accessCount: _memory.accessCount + 1,
      lastAccessedAt: new Date(),
    });

    // Emit access event
    await this.emitEvent(
      "MemoryAccessed",
      _memory.id,
      {
        memoryId: _memory.id,
        accessType,
        userId,
        duration,
      },
      userId,
    );
  }

  private async compressData(_data: unknown, algorithm: string): Promise<any> {
    // Placeholder for compression logic
    // In real implementation, use actual compression libraries
    return {
      compressed: true,
      algorithm,
      _data: JSON.stringify(_data),
    };
  }

  private calculateDataSize(data: unknown): number {
    return JSON.stringify(data).length;
  }

  private rankSearchResults(
    _results: MemoryEntity[],
    _query: string,
  ): MemoryEntity[] {
    return _results.sort((a, b) => {
      // Rank by access count (higher is better)
      const _accessScore = b.accessCount - a.accessCount;

      // Rank by recency (newer is better)
      const _recencyScore =
        b.lastAccessedAt.getTime() - a.lastAccessedAt.getTime();

      // Combine scores
      return _accessScore * 0.7 + _recencyScore * 0.3;
    });
  }

  private async emitEvent<T extends keyof MemoryDomainEvents>(
    eventType: T,
    aggregateId: string,
    eventData: MemoryDomainEvents[T],
    userId?: string,
  ): Promise<void> {
    const event: Omit<EventData, "eventId" | "timestamp"> = {
      aggregateId,
      eventType,
      eventVersion: 1,
      eventData,
      metadata: {
        source: "MemoryDomainService",
        userId,
      },
      userId,
      correlationId: uuidv4(),
    };

    await this.eventStore.appendEvents(aggregateId, [event]);
  }
}
