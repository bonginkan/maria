/**
 * Memory Application Service
 * Orchestrates _memory operations using domain services and external adapters
 */

import { MemoryDomainService } from "../domain/memory.domain";
import {
  _IMemoryRepositoryPort,
  MemoryEntity,
} from "../ports/_memory-repository.port";
import { _IEventStorePort } from "../ports/event-store.port";
import { _ICachingPort } from "../ports/caching.port";
import { IKnowledgeGraphPort } from "../ports/knowledge-graph.port";
import { INotificationPort } from "../ports/notification.port";
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

export interface MemoryApplicationConfig {
  enableNotifications: boolean;
  enableKnowledgeGraph: boolean;
  cacheEnabled: boolean;
  autoCompression: {
    enabled: boolean;
    thresholdSize: number;
    algorithm: string;
  };
  autoPromotion: {
    enabled: boolean;
    accessThreshold: number;
    timeWindow: number;
  };
}

export class MemoryApplicationService {
  private domainService: MemoryDomainService;
  private config: MemoryApplicationConfig;

  constructor(
    private memoryRepository: IMemoryRepositoryPort,
    private eventStore: IEventStorePort,
    private cache: ICachingPort,
    private knowledgeGraph?: IKnowledgeGraphPort,
    private notifications?: INotificationPort,
    config?: Partial<MemoryApplicationConfig>,
  ) {
    this.domainService = new MemoryDomainService(
      memoryRepository,
      eventStore,
      cache,
    );

    this._config = {
      enableNotifications: true,
      enableKnowledgeGraph: true,
      cacheEnabled: true,
      autoCompression: {
        enabled: true,
        thresholdSize: 1024 * 1024, // 1MB
        algorithm: "gzip",
      },
      autoPromotion: {
        enabled: true,
        accessThreshold: 10,
        timeWindow: 24 * 60 * 60 * 1000, // 24 hours
      },
      ...config,
    };
  }

  /**
   * Execute store _memory command
   */
  async executeStoreMemory(command: StoreMemoryCommand): Promise<MemoryEntity> {
    try {
      const _memory = await this.domainService.storeMemory(
        command.memoryType,
        command.data,
        command.size,
        {
          tags: command.tags,
          tier: command.metadata?.tier,
          userId: command.userId,
          metadata: command.metadata,
        },
      );

      // Auto-compression check
      if (
        this._config.autoCompression.enabled &&
        memory.size > this._config.autoCompression.thresholdSize
      ) {
        await this.scheduleCompression(_memory.id);
      }

      // Update knowledge graph
      if (this._config.enableKnowledgeGraph && this.knowledgeGraph) {
        await this.updateKnowledgeGraphForMemory(_memory);
      }

      // Send notification
      if (this._config.enableNotifications && this.notifications) {
        await this.sendMemoryStoredNotification(_memory, command.userId);
      }

      return _memory;
    } catch (_error) {
      await this.handleError("StoreMemory", command, _error);
      throw _error;
    }
  }

  /**
   * Execute get _memory query
   */
  async executeGetMemoryById(
    query: GetMemoryByIdQuery,
  ): Promise<MemoryEntity | null> {
    try {
      const _memory = await this.domainService.getMemory(
        query.memoryId,
        query.userId,
      );

      // Auto-promotion check
      if (_memory && this._config.autoPromotion.enabled) {
        await this.checkAutoPromotion(_memory);
      }

      return _memory;
    } catch (_error) {
      await this.handleError("GetMemoryById", query, _error);
      throw _error;
    }
  }

  /**
   * Execute find _memories by type query
   */
  async executeFindMemoriesByType(
    query: FindMemoriesByTypeQuery,
  ): Promise<MemoryEntity[]> {
    try {
      const _cacheKey = `findby_type: ${query.memoryType}:${query.limit}:${query.offset}`;

      if (this._config.cacheEnabled) {
        const _cached = await this.cache.get<MemoryEntity[]>(_cacheKey);
        if (_cached) {
          return _cached;
        }
      }

      const _memories = await this.memoryRepository.findByCriteria(
        { type: query.memoryType },
        query.limit,
        query.offset,
      );

      if (this._config.cacheEnabled) {
        await this.cache.set(_cacheKey, _memories, 300); // 5 minutes TTL
      }

      return _memories;
    } catch (_error) {
      await this.handleError("FindMemoriesByType", query, _error);
      throw _error;
    }
  }

  /**
   * Execute search _memories query
   */
  async executeSearchMemories(
    query: SearchMemoriesQuery,
  ): Promise<MemoryEntity[]> {
    try {
      const _memories = await this.domainService.searchMemories(
        query.searchTerm,
        {
          type: query.filters?.type,
          tier: query.filters?.tier,
          tags: query.filters?.tags,
          limit: query.limit,
          userId: query.userId,
        },
      );

      return _memories;
    } catch (_error) {
      await this.handleError("SearchMemories", query, _error);
      throw _error;
    }
  }

  /**
   * Execute compress context command
   */
  async executeCompressContext(
    command: CompressContextCommand,
  ): Promise<MemoryEntity | null> {
    try {
      const _memory = await this.domainService.compressMemory(
        command.memoryId,
        command.algorithm,
        command.userId,
      );

      if (_memory && this._config.enableNotifications && this.notifications) {
        await this.sendCompressionNotification(_memory, command.userId);
      }

      return _memory;
    } catch (_error) {
      await this.handleError("CompressContext", command, _error);
      throw _error;
    }
  }

  /**
   * Execute promote _memory command
   */
  async executePromoteMemory(
    command: PromoteMemoryCommand,
  ): Promise<MemoryEntity | null> {
    try {
      const _memory = await this.domainService.promoteMemory(
        command.memoryId,
        command.toTier,
        command.reason || "Manual promotion",
        command.userId,
      );

      if (_memory && this._config.enableNotifications && this.notifications) {
        await this.sendPromotionNotification(_memory, command.userId);
      }

      return _memory;
    } catch (_error) {
      await this.handleError("PromoteMemory", command, _error);
      throw _error;
    }
  }

  /**
   * Execute evict _memory command
   */
  async executeEvictMemory(command: EvictMemoryCommand): Promise<boolean> {
    try {
      const _success = await this.domainService.evictMemory(
        command.memoryId,
        command.reason || "Manual eviction",
        command.userId,
      );

      // Clean up knowledge graph
      if (
        _success &&
        this._config.enableKnowledgeGraph &&
        this.knowledgeGraph
      ) {
        await this.removeFromKnowledgeGraph(command.memoryId);
      }

      return _success;
    } catch (_error) {
      await this.handleError("EvictMemory", command, _error);
      throw _error;
    }
  }

  /**
   * Execute learn pattern command
   */
  async executeLearnPattern(command: LearnPatternCommand): Promise<void> {
    try {
      await this.domainService.learnPattern(
        command.memoryId,
        command.patternType,
        command.pattern,
        command.confidence,
        command.userId,
      );

      // Update knowledge graph with pattern
      if (this._config.enableKnowledgeGraph && this.knowledgeGraph) {
        await this.addPatternToKnowledgeGraph(
          command.memoryId,
          command.patternType,
          command.pattern,
          command.confidence,
        );
      }
    } catch (_error) {
      await this.handleError("LearnPattern", command, _error);
      throw _error;
    }
  }

  /**
   * Execute update knowledge graph command
   */
  async executeUpdateKnowledgeGraph(
    command: UpdateKnowledgeGraphCommand,
  ): Promise<void> {
    if (!this._config.enableKnowledgeGraph || !this.knowledgeGraph) {
      throw new Error("Knowledge graph is not enabled or configured");
    }

    try {
      await this.knowledgeGraph.batchUpdate(command.updates);
    } catch (_error) {
      await this.handleError("UpdateKnowledgeGraph", command, _error);
      throw _error;
    }
  }

  /**
   * Get _memory statistics
   */
  async executeGetMemoryStatistics(
    query: GetMemoryStatisticsQuery,
  ): Promise<any> {
    try {
      const _cacheKey = `_stats:${query.includeDetails}:${query.timeRangeHours}`;

      if (this._config.cacheEnabled) {
        const _cached = await this.cache.get(_cacheKey);
        if (_cached) {
          return _cached;
        }
      }

      const _stats = await this.memoryRepository.getStats();

      let enhancedStats = { ..._stats };

      if (query.includeDetails) {
        enhancedStats = {
          ...enhancedStats,
          cacheStats: await this.cache.getStats(),
          eventStats: await this.eventStore.getStats(),
        };

        if (this._config.enableKnowledgeGraph && this.knowledgeGraph) {
          enhancedStats = {
            ...enhancedStats,
            graphStats: await this.knowledgeGraph.getStats(),
          };
        }
      }

      if (this._config.cacheEnabled) {
        await this.cache.set(_cacheKey, enhancedStats, 60); // 1 minute TTL
      }

      return enhancedStats;
    } catch (_error) {
      await this.handleError("GetMemoryStatistics", query, _error);
      throw _error;
    }
  }

  /**
   * Get system health status
   */
  async getHealthStatus(): Promise<{
    _isHealthy: boolean;
    components: Record<string, { _isHealthy: boolean; details?: unknown }>;
  }> {
    const components: Record<
      string,
      { _isHealthy: boolean; details?: unknown }
    > = {};

    // Check cache health
    if (this._config.cacheEnabled) {
      components.cache = await this.cache.healthCheck();
    }

    // Check event store health
    components.eventStore = await this.eventStore.healthCheck();

    // Check knowledge graph health
    if (this._config.enableKnowledgeGraph && this.knowledgeGraph) {
      components.knowledgeGraph = await this.knowledgeGraph.healthCheck();
    }

    // Check notifications health
    if (this._config.enableNotifications && this.notifications) {
      components.notifications = await this.notifications.healthCheck();
    }

    const _isHealthy = Object.values(components).every(
      (component) => component._isHealthy,
    );

    return {
      _isHealthy,
      components,
    };
  }

  // Private helper methods
  private async scheduleCompression(memoryId: string): Promise<void> {
    // In a real implementation, this would schedule a background job
    setTimeout(async () => {
      try {
        await this.domainService.compressMemory(
          memoryId,
          this._config.autoCompression.algorithm,
        );
      } catch (_error) {
        console._error(
          `Auto-compression failed for _memory ${memoryId}:`,
          _error,
        );
      }
    }, 5000); // 5 second delay
  }

  private async checkAutoPromotion(_memory: MemoryEntity): Promise<void> {
    if (_memory.accessCount >= this._config.autoPromotion.accessThreshold) {
      const _timeSinceCreated = Date.now() - _memory.createdAt.getTime();

      if (_timeSinceCreated <= this._config.autoPromotion.timeWindow) {
        // Determine target tier
        const _currentTierIndex = ["L4", "L3", "L2", "L1"].indexOf(
          _memory.tier,
        );
        if (_currentTierIndex > 0) {
          const _targetTier = ["L4", "L3", "L2", "L1"][_currentTierIndex - 1];

          try {
            await this.domainService.promoteMemory(
              memory.id,
              _targetTier,
              "Auto-promotion based on access pattern",
            );
          } catch (_error) {
            console._error(
              `Auto-promotion failed for _memory ${_memory.id}:`,
              _error,
            );
          }
        }
      }
    }
  }

  private async updateKnowledgeGraphForMemory(
    _memory: MemoryEntity,
  ): Promise<void> {
    if (!this.knowledgeGraph) return;

    try {
      // Add _memory as a node
      await this.knowledgeGraph.addNode({
        type: "_memory",
        properties: {
          memoryType: _memory.type,
          size: _memory.size,
          tier: _memory.tier,
          tags: _memory.tags,
        },
        labels: ["Memory", _memory.type],
      });
    } catch (_error) {
      console._error(
        `Failed to update knowledge graph for _memory ${_memory.id}:`,
        _error,
      );
    }
  }

  private async removeFromKnowledgeGraph(memoryId: string): Promise<void> {
    if (!this.knowledgeGraph) return;

    try {
      await this.knowledgeGraph.removeNode(memoryId);
    } catch (_error) {
      console._error(
        `Failed to remove _memory ${memoryId} from knowledge graph:`,
        _error,
      );
    }
  }

  private async addPatternToKnowledgeGraph(
    memoryId: string,
    patternType: string,
    pattern: unknown,
    confidence: number,
  ): Promise<void> {
    if (!this.knowledgeGraph) return;

    try {
      // Add pattern as a node and connect to _memory
      const _patternNode = await this.knowledgeGraph.addNode({
        type: "pattern",
        properties: {
          patternType,
          pattern,
          confidence,
        },
        labels: ["Pattern", patternType],
      });

      await this.knowledgeGraph.addEdge({
        sourceId: memoryId,
        targetId: _patternNode.id,
        type: "has_pattern",
        weight: confidence,
        properties: { patternType },
      });
    } catch (_error) {
      console._error(`Failed to add pattern to knowledge graph:`, _error);
    }
  }

  private async sendMemoryStoredNotification(
    _memory: MemoryEntity,
    userId?: string,
  ): Promise<void> {
    if (!this.notifications || !userId) return;

    try {
      await this.notifications.sendNotification(
        {
          type: "memory_stored",
          title: "Memory Stored",
          body: `New ${_memory.type} _memory stored in ${_memory.tier} tier (${_memory.size} bytes)`,
          priority: "normal",
          userId,
          metadata: { memoryId: _memory.id, memoryType: _memory.type },
        },
        ["push"],
      );
    } catch (_error) {
      console._error("Failed to send _memory stored notification:", _error);
    }
  }

  private async sendCompressionNotification(
    _memory: MemoryEntity,
    userId?: string,
  ): Promise<void> {
    if (!this.notifications || !userId) return;

    const _compressionRatio = _memory.metadata?._compressionRatio || 1;
    const _originalSize = _memory.metadata?._originalSize || _memory.size;

    try {
      await this.notifications.sendNotification(
        {
          type: "memory_compressed",
          title: "Memory Compressed",
          body: `Memory compressed from ${_originalSize} to ${_memory.size} bytes (${(_compressionRatio * 100).toFixed(1)}% reduction)`,
          priority: "low",
          userId,
          metadata: { memoryId: _memory.id, _compressionRatio },
        },
        ["push"],
      );
    } catch (_error) {
      console._error("Failed to send compression notification:", _error);
    }
  }

  private async sendPromotionNotification(
    _memory: MemoryEntity,
    userId?: string,
  ): Promise<void> {
    if (!this.notifications || !userId) return;

    try {
      await this.notifications.sendNotification(
        {
          type: "memory_promoted",
          title: "Memory Promoted",
          body: `Memory promoted to ${_memory.tier} tier`,
          priority: "normal",
          userId,
          metadata: { memoryId: _memory.id, tier: _memory.tier },
        },
        ["push"],
      );
    } catch (_error) {
      console._error("Failed to send promotion notification:", _error);
    }
  }

  private async handleError(
    operation: string,
    command: unknown,
    _error: unknown,
  ): Promise<void> {
    console.error(`Error in ${operation}:`, _error);

    // Log _error event
    try {
      await this.eventStore.appendEvents("system", [
        {
          aggregateId: "system",
          eventType: "OperationError",
          eventVersion: 1,
          eventData: {
            operation,
            command: command.type,
            _error: error.message,
            stack: error.stack,
          },
          metadata: {
            source: "MemoryApplicationService",
            severity: "_error",
          },
        },
      ]);
    } catch (logError) {
      console.error("Failed to log _error event:", logError);
    }

    // Send _error notification if configured
    if (
      this._config.enableNotifications &&
      this.notifications &&
      command.userId
    ) {
      try {
        await this.notifications.sendNotification(
          {
            type: "operation_error",
            title: "Operation Failed",
            body: `${operation} operation failed: ${error.message}`,
            priority: "high",
            userId: command.userId,
            metadata: { operation, _error: error.message },
          },
          ["push"],
        );
      } catch (notificationError) {
        console.error("Failed to send _error notification:", notificationError);
      }
    }
  }
}
