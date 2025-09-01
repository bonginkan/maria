/**
 * Hexagonal Memory Service
 * Main orchestrator that integrates all hexagonal architecture components
 */

import { MemoryApplicationService } from "../application/memory-application.service";
import {
  DIContainer,
  configureDI,
  initializeUltraMemorySystem,
} from "./dependency-injection";
import {
  StoreMemoryCommand,
  CompressContextCommand,
  PromoteMemoryCommand,
  EvictMemoryCommand,
  LearnPatternCommand,
  _UpdateKnowledgeGraphCommand,
} from "../../cqrs/commands";
import {
  GetMemoryByIdQuery,
  FindMemoriesByTypeQuery,
  SearchMemoriesQuery,
  GetMemoryStatisticsQuery,
  _GetMemoryAccessPatternsQuery,
} from "../../cqrs/queries";
import { MemoryEntity } from "../ports/memory-repository.port";

export interface HexagonalMemoryServiceConfig {
  database?: {
    memoryDbPath?: string;
    eventDbPath?: string;
  };
  cache?: {
    maxSize?: number;
    enabled?: boolean;
  };
  features?: {
    knowledgeGraph?: boolean;
    notifications?: boolean;
  };
  autoOptimization?: {
    compression?: boolean;
    promotion?: boolean;
  };
}

export class HexagonalMemoryService {
  private applicationService: MemoryApplicationService;
  private container: DIContainer;
  private initialized: boolean = false;

  constructor(private config: HexagonalMemoryServiceConfig = {}) {
    this.container = configureDI({
      database: this.config.database,
      cache: this.config.cache,
      features: this.config.features,
      memory: {
        enableKnowledgeGraph: this.config.features?.knowledgeGraph || false,
        enableNotifications: this.config.features?.notifications || false,
        cacheEnabled: this.config.cache?.enabled !== false,
        autoCompression: {
          enabled: this.config.autoOptimization?.compression !== false,
          thresholdSize: 1024 * 1024, // 1MB
          algorithm: "gzip",
        },
        autoPromotion: {
          enabled: this.config.autoOptimization?.promotion !== false,
          accessThreshold: 10,
          timeWindow: 24 * 60 * 60 * 1000, // 24 hours
        },
      },
    });
  }

  /**
   * Initialize the hexagonal memory system
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      this.applicationService = await initializeUltraMemorySystem({
        database: this.config.database,
        cache: this.config.cache,
        features: this.config.features,
      });

      this.initialized = true;
    } catch (_error) {
      throw new Error(
        `Failed to initialize hexagonal memory system: ${_error.message}`,
      );
    }
  }

  /**
   * Store memory with automatic optimization
   */
  async storeMemory(
    memoryType: string,
    data: unknown,
    options: {
      tags?: string[];
      tier?: string;
      userId?: string;
      metadata?: Record<string, any>;
    } = {},
  ): Promise<MemoryEntity> {
    this.ensureInitialized();

    const _size = this.calculateDataSize(data);

    const _command = new StoreMemoryCommand(
      this.generateId(),
      memoryType,
      data,
      _size,
      options.tags,
      options.userId,
      this.generateCorrelationId(),
      options.metadata,
    );

    return await this.applicationService.executeStoreMemory(_command);
  }

  /**
   * Retrieve memory by ID
   */
  async getMemory(
    _memoryId: string,
    userId?: string,
  ): Promise<MemoryEntity | null> {
    this.ensureInitialized();

    const _query = new GetMemoryByIdQuery(
      memoryId,
      false, // includeMeta
      userId,
      this.generateCorrelationId(),
    );

    return await this.applicationService.executeGetMemoryById(_query);
  }

  /**
   * Find memories by type
   */
  async findMemoriesByType(
    memoryType: string,
    options: {
      limit?: number;
      offset?: number;
      userId?: string;
    } = {},
  ): Promise<MemoryEntity[]> {
    this.ensureInitialized();

    const _query = new FindMemoriesByTypeQuery(
      memoryType,
      options.limit || 100,
      options.offset || 0,
      options.userId,
      this.generateCorrelationId(),
    );

    return await this.applicationService.executeFindMemoriesByType(_query);
  }

  /**
   * Search memories with intelligent ranking
   */
  async searchMemories(
    searchTerm: string,
    options: {
      searchFields?: string[];
      limit?: number;
      offset?: number;
      filters?: Record<string, any>;
      userId?: string;
    } = {},
  ): Promise<MemoryEntity[]> {
    this.ensureInitialized();

    const _query = new SearchMemoriesQuery(
      searchTerm,
      options.searchFields || ["data", "tags"],
      options.limit || 50,
      options.offset || 0,
      options.filters || object,
      options.userId,
      this.generateCorrelationId(),
    );

    return await this.applicationService.executeSearchMemories(_query);
  }

  /**
   * Compress memory data
   */
  async compressMemory(
    memoryId: string,
    algorithm: string = "gzip",
    userId?: string,
  ): Promise<MemoryEntity | null> {
    this.ensureInitialized();

    const _command = new CompressContextCommand(
      memoryId,
      algorithm,
      6, // compression level
      userId,
      this.generateCorrelationId(),
    );

    return await this.applicationService.executeCompressContext(_command);
  }

  /**
   * Promote memory to higher tier
   */
  async promoteMemory(
    memoryId: string,
    toTier: string,
    reason?: string,
    userId?: string,
  ): Promise<MemoryEntity | null> {
    this.ensureInitialized();

    const _command = new PromoteMemoryCommand(
      memoryId,
      toTier,
      reason || "Manual promotion",
      userId,
      this.generateCorrelationId(),
    );

    return await this.applicationService.executePromoteMemory(_command);
  }

  /**
   * Evict memory from system
   */
  async evictMemory(
    memoryId: string,
    reason?: string,
    userId?: string,
  ): Promise<boolean> {
    this.ensureInitialized();

    const _command = new EvictMemoryCommand(
      memoryId,
      reason || "Manual eviction",
      userId,
      this.generateCorrelationId(),
    );

    return await this.applicationService.executeEvictMemory(_command);
  }

  /**
   * Learn pattern from memory
   */
  async learnPattern(
    memoryId: string,
    patternType: string,
    pattern: unknown,
    confidence: number,
    userId?: string,
  ): Promise<void> {
    this.ensureInitialized();

    const _command = new LearnPatternCommand(
      memoryId,
      patternType,
      pattern,
      confidence,
      userId,
      this.generateCorrelationId(),
    );

    await this.applicationService.executeLearnPattern(_command);
  }

  /**
   * Get memory statistics
   */
  async getStatistics(
    options: {
      includeDetails?: boolean;
      timeRangeHours?: number;
      userId?: string;
    } = {},
  ): Promise<any> {
    this.ensureInitialized();

    const _query = new GetMemoryStatisticsQuery(
      options.includeDetails || false,
      options.timeRangeHours || 24,
      options.userId,
      this.generateCorrelationId(),
    );

    return await this.applicationService.executeGetMemoryStatistics(_query);
  }

  /**
   * Bulk store multiple memories
   */
  async bulkStoreMemories(
    memories: Array<{
      type: string;
      data: any;
      tags?: string[];
      tier?: string;
      userId?: string;
      metadata?: Record<string, any>;
    }>,
  ): Promise<MemoryEntity[]> {
    this.ensureInitialized();

    const _results: MemoryEntity[] = [];

    for (const memoryData of memories) {
      const _result = await this.storeMemory(memoryData.type, memoryData.data, {
        tags: memoryData.tags,
        tier: memoryData.tier,
        userId: memoryData.userId,
        metadata: memoryData.metadata,
      });
      results.push(_result);
    }

    return _results;
  }

  /**
   * Optimize memory system (compression, promotion, etc.)
   */
  async optimizeSystem(userId?: string): Promise<{
    compressed: number;
    promoted: number;
    evicted: number;
    totalOptimized: number;
  }> {
    this.ensureInitialized();

    const _stats = await this.getStatistics({ includeDetails: true, userId });
    const _results = {
      compressed: 0,
      promoted: 0,
      evicted: 0,
      totalOptimized: 0,
    };

    // Get all memories for optimization
    const _allMemories = await this.searchMemories("*", {
      limit: 1000,
      userId,
    });

    for (const memory of _allMemories) {
      try {
        // Compression optimization
        if (memory.size > 1024 * 1024 && !memory.metadata?.compressed) {
          await this.compressMemory(memory.id, "gzip", userId);
          results.compressed++;
        }

        // Promotion optimization
        if (memory.accessCount > 10 && memory.tier !== "L1") {
          const _targetTier = this.determineOptimalTier(memory);
          if (_targetTier !== memory.tier) {
            await this.promoteMemory(
              memory.id,
              _targetTier,
              "System optimization",
              userId,
            );
            results.promoted++;
          }
        }

        // Eviction for old, unused memories
        const _daysSinceLastAccess =
          (Date.now() - memory.lastAccessedAt.getTime()) /
          (1000 * 60 * 60 * 24);
        if (_daysSinceLastAccess > 30 && memory.accessCount < 2) {
          await this.evictMemory(
            memory.id,
            "System cleanup - unused for 30+ days",
            userId,
          );
          results.evicted++;
        }
      } catch (_error) {
        console._error(`Optimization failed for memory ${memory.id}:`, _error);
      }
    }

    _results.totalOptimized =
      _results.compressed + _results.promoted + _results.evicted;
    return _results;
  }

  /**
   * Get system health status
   */
  async getHealthStatus(): Promise<{
    isHealthy: boolean;
    components: Record<string, { isHealthy: boolean; details?: unknown }>;
    _systemStats?: any;
  }> {
    if (!this.initialized) {
      return {
        isHealthy: false,
        components: {
          system: {
            isHealthy: false,
            details: { _error: "System not initialized" },
          },
        },
      };
    }

    const _healthStatus = await this.applicationService.getHealthStatus();
    const _systemStats = await this.getStatistics({ includeDetails: true });

    return {
      ..._healthStatus,
      _systemStats,
    };
  }

  /**
   * Dispose resources and cleanup
   */
  async dispose(): Promise<void> {
    if (this.initialized && this.container) {
      await this.container.dispose();
      this.initialized = false;
    }
  }

  // Private helper methods
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error(
        "Hexagonal memory system not initialized. Call initialize() first.",
      );
    }
  }

  private calculateDataSize(data: unknown): number {
    try {
      return JSON.stringify(data).length;
    } catch {
      return 0;
    }
  }

  private generateId(): string {
    return `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateCorrelationId(): string {
    return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private determineOptimalTier(memory: MemoryEntity): string {
    // Simple tier optimization logic
    if (memory.accessCount > 50) return "L1";
    if (memory.accessCount > 20) return "L2";
    if (memory.accessCount > 5) return "L3";
    return "L4";
  }
}

/**
 * Factory function to create and initialize a hexagonal memory _service
 */
export async function createHexagonalMemoryService(
  config: HexagonalMemoryServiceConfig = {},
): Promise<HexagonalMemoryService> {
  const _service = new HexagonalMemoryService(config);
  await _service.initialize();
  return _service;
}

/**
 * Global singleton instance
 */
let globalHexagonalMemoryService: HexagonalMemoryService | null = null;

/**
 * Get or create the global hexagonal memory _service instance
 */
export async function getGlobalHexagonalMemoryService(
  config: HexagonalMemoryServiceConfig = {},
): Promise<HexagonalMemoryService> {
  if (!globalHexagonalMemoryService) {
    globalHexagonalMemoryService = await createHexagonalMemoryService(config);
  }
  return globalHexagonalMemoryService;
}

/**
 * Reset the global hexagonal memory _service instance
 */
export async function resetGlobalHexagonalMemoryService(): Promise<void> {
  if (globalHexagonalMemoryService) {
    await globalHexagonalMemoryService.dispose();
    globalHexagonalMemoryService = null;
  }
}
