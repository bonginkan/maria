/**
 * CQRS Read Models
 * Optimized read-only data structures for queries
 */

import { IReadModel, IEventProjection } from "./interfaces";
import { DomainEvent } from "../event-sourcing/domain-event";
import { _MemoryState } from "../event-sourcing/aggregate-root";

/**
 * Memory read model for optimized queries
 */
export interface MemoryReadModel {
  id: string;
  memoryType: string;
  size: number;
  tier: string;
  accessCount: number;
  lastAccessed: Date;
  compressionRatio: number;
  isCompressed: boolean;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  // Optimized for search
  searchableContent: string;
  // Denormalized data for quick access
  metadata: {
    patterns: Array<{
      type: string;
      confidence: number;
      frequency: number;
    }>;
    graphStats?: {
      nodesAdded: number;
      edgesAdded: number;
      nodesRemoved: number;
      edgesRemoved: number;
    };
  };
}

/**
 * Memory statistics read model
 */
export interface MemoryStatisticsReadModel {
  id: string;
  totalMemories: number;
  totalSize: number;
  compressionSavings: number;
  tierDistribution: Record<string, number>;
  typeDistribution: Record<string, number>;
  accessPatterns: {
    hourly: number[];
    daily: number[];
    topAccessed: Array<{
      memoryId: string;
      accessCount: number;
    }>;
  };
  lastUpdated: Date;
}

/**
 * Knowledge graph read model
 */
export interface KnowledgeGraphReadModel {
  id: string;
  nodes: Array<{
    id: string;
    type: string;
    properties: Record<string, any>;
  }>;
  edges: Array<{
    from: string;
    to: string;
    type: string;
    weight: number;
    properties: Record<string, any>;
  }>;
  metrics: {
    nodeCount: number;
    edgeCount: number;
    averageConnections: number;
    clustering: number;
  };
  lastUpdated: Date;
}

/**
 * Base read model implementation
 */
export abstract class BaseReadModel implements IReadModel {
  abstract readonly name: string;
  abstract readonly version: number;

  protected lastProcessedEventId: string | null = null;

  abstract project(_event: DomainEvent): Promise<void>;
  abstract reset(): Promise<void>;

  async getLastProcessedEventId(): Promise<string | null> {
    return this.lastProcessedEventId;
  }

  async setLastProcessedEventId(eventId: string): Promise<void> {
    this.lastProcessedEventId = eventId;
  }
}

/**
 * In-_memory read model store
 */
export class InMemoryReadModelStore {
  private _memories = new Map<string, MemoryReadModel>();
  private statistics: MemoryStatisticsReadModel | null = null;
  private knowledgeGraphs = new Map<string, KnowledgeGraphReadModel>();

  // Memory operations
  async saveMemory(_memory: MemoryReadModel): Promise<void> {
    this.memories.set(memory.id, _memory);
  }

  async getMemory(id: string): Promise<MemoryReadModel | null> {
    return this.memories.get(id) || null;
  }

  async findMemoriesByType(memoryType: string): Promise<MemoryReadModel[]> {
    const results: MemoryReadModel[] = [];
    for (const _memory of this.memories.values()) {
      if (_memory.memoryType === memoryType) {
        results.push(_memory);
      }
    }
    return results;
  }

  async findMemoriesByTier(tier: string): Promise<MemoryReadModel[]> {
    const results: MemoryReadModel[] = [];
    for (const _memory of this.memories.values()) {
      if (_memory.tier === tier) {
        results.push(_memory);
      }
    }
    return results;
  }

  async searchMemories(
    _searchTerm: string,
    fields: string[] = ["searchableContent"],
  ): Promise<MemoryReadModel[]> {
    const results: MemoryReadModel[] = [];
    const _term = _searchTerm.toLowerCase();

    for (const _memory of this.memories.values()) {
      let matches = false;

      for (const field of fields) {
        switch (field) {
          case "searchableContent":
            if (_memory.searchableContent.toLowerCase().includes(_term)) {
              matches = true;
            }
            break;
          case "tags":
            if (_memory.tags.some((tag) => tag.toLowerCase().includes(_term))) {
              matches = true;
            }
            break;
          case "memoryType":
            if (_memory.memoryType.toLowerCase().includes(_term)) {
              matches = true;
            }
            break;
        }

        if (matches) {
          results.push(_memory);
          break;
        }
      }
    }

    return results;
  }

  async getMostAccessedMemories(
    limit: number = 10,
  ): Promise<MemoryReadModel[]> {
    const _memories = Array.from(this._memories.values())
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, limit);
    return _memories;
  }

  async getAllMemories(): Promise<MemoryReadModel[]> {
    return Array.from(this.memories.values());
  }

  async deleteMemory(id: string): Promise<boolean> {
    return this.memories.delete(id);
  }

  // Statistics operations
  async saveStatistics(_stats: MemoryStatisticsReadModel): Promise<void> {
    this.statistics = _stats;
  }

  async getStatistics(): Promise<MemoryStatisticsReadModel | null> {
    return this.statistics;
  }

  // Knowledge graph operations
  async saveKnowledgeGraph(graph: KnowledgeGraphReadModel): Promise<void> {
    this.knowledgeGraphs.set(graph.id, graph);
  }

  async getKnowledgeGraph(id: string): Promise<KnowledgeGraphReadModel | null> {
    return this.knowledgeGraphs.get(id) || null;
  }

  async getAllKnowledgeGraphs(): Promise<KnowledgeGraphReadModel[]> {
    return Array.from(this.knowledgeGraphs.values());
  }

  // Utility methods
  async clear(): Promise<void> {
    this.memories.clear();
    this.statistics = null;
    this.knowledgeGraphs.clear();
  }

  getMemoryCount(): number {
    return this.memories.size;
  }

  getKnowledgeGraphCount(): number {
    return this.knowledgeGraphs.size;
  }
}

/**
 * Memory projection - converts domain events to read models
 */
export class MemoryProjection
  extends BaseReadModel
  implements IEventProjection<MemoryReadModel>
{
  readonly name = "MemoryProjection";
  readonly version = 1;
  readonly projectionName = "MemoryProjection";
  readonly eventTypes = [
    "MemoryStoredEvent",
    "ContextCompressedEvent",
    "MemoryRetrievedEvent",
    "MemoryPromotedEvent",
    "MemoryEvictedEvent",
    "PatternLearnedEvent",
    "KnowledgeGraphUpdatedEvent",
  ];

  constructor(private readonly store: InMemoryReadModelStore) {
    super();
  }

  async project(event: DomainEvent): Promise<void> {
    await this.when(event);
    await this.setLastProcessedEventId(event.eventId);
  }

  async when(event: DomainEvent): Promise<void> {
    switch (event.eventType) {
      case "MemoryStoredEvent":
        await this.handleMemoryStoredEvent(event as any);
        break;
      case "ContextCompressedEvent":
        await this.handleContextCompressedEvent(event as any);
        break;
      case "MemoryRetrievedEvent":
        await this.handleMemoryRetrievedEvent(event as any);
        break;
      case "MemoryPromotedEvent":
        await this.handleMemoryPromotedEvent(event as any);
        break;
      case "MemoryEvictedEvent":
        await this.handleMemoryEvictedEvent(event as any);
        break;
      case "PatternLearnedEvent":
        await this.handlePatternLearnedEvent(event as any);
        break;
      case "KnowledgeGraphUpdatedEvent":
        await this.handleKnowledgeGraphUpdatedEvent(event as any);
        break;
    }
  }

  private async handleMemoryStoredEvent(event: unknown): Promise<void> {
    const _existing = await this.store.getMemory(event.aggregateId);

    const _memory: MemoryReadModel = _existing || {
      id: event.aggregateId,
      memoryType: event.memoryType,
      size: event.size,
      tier: "L0",
      accessCount: 0,
      lastAccessed: event.timestamp,
      compressionRatio: 1,
      isCompressed: false,
      tags: [],
      createdAt: event.timestamp,
      updatedAt: event.timestamp,
      searchableContent: this.createSearchableContent(
        event.data,
        event.memoryType,
      ),
      metadata: {
        patterns: [],
      },
    };

    // Update with new data
    _memory.memoryType = event.memoryType;
    _memory.size = event.size;
    _memory.updatedAt = event.timestamp;
    memory.searchableContent = this.createSearchableContent(
      event.data,
      event.memoryType,
    );

    await this.store.saveMemory(_memory);
  }

  private async handleContextCompressedEvent(event: unknown): Promise<void> {
    const _memory = await this.store.getMemory(event.aggregateId);
    if (!_memory) return;

    _memory.size = event.compressedSize;
    _memory.compressionRatio = event.compressionRatio;
    _memory.isCompressed = true;
    memory.updatedAt = event.timestamp;

    await this.store.saveMemory(_memory);
  }

  private async handleMemoryRetrievedEvent(event: unknown): Promise<void> {
    const _memory = await this.store.getMemory(event.aggregateId);
    if (!_memory) return;

    _memory.accessCount++;
    _memory.lastAccessed = event.timestamp;
    _memory.tier = event.tier || _memory.tier;
    memory.updatedAt = event.timestamp;

    await this.store.saveMemory(_memory);
  }

  private async handleMemoryPromotedEvent(event: unknown): Promise<void> {
    const _memory = await this.store.getMemory(event.aggregateId);
    if (!_memory) return;

    _memory.tier = event.toTier;
    memory.updatedAt = event.timestamp;

    await this.store.saveMemory(_memory);
  }

  private async handleMemoryEvictedEvent(event: unknown): Promise<void> {
    const _memory = await this.store.getMemory(event.aggregateId);
    if (!_memory) return;

    _memory.tier = "EVICTED";
    memory.updatedAt = event.timestamp;

    await this.store.saveMemory(_memory);
  }

  private async handlePatternLearnedEvent(event: unknown): Promise<void> {
    const _memory = await this.store.getMemory(event.aggregateId);
    if (!_memory) return;

    _memory.metadata.patterns = _memory.metadata.patterns || [];
    memory.metadata.patterns.push({
      type: event.patternType,
      confidence: event.confidence,
      frequency: event.frequency,
    });
    memory.updatedAt = event.timestamp;

    await this.store.saveMemory(_memory);
  }

  private async handleKnowledgeGraphUpdatedEvent(
    event: unknown,
  ): Promise<void> {
    const _memory = await this.store.getMemory(event.aggregateId);
    if (!_memory) return;

    memory.metadata.graphStats = {
      nodesAdded: event.nodesAdded,
      edgesAdded: event.edgesAdded,
      nodesRemoved: event.nodesRemoved,
      edgesRemoved: event.edgesRemoved,
    };
    memory.updatedAt = event.timestamp;

    await this.store.saveMemory(_memory);
  }

  private createSearchableContent(_data: unknown, memoryType: string): string {
    // Create searchable _content from _memory data
    const _content = [memoryType];

    if (_data) {
      if (typeof _data === "string") {
        content.push(_data);
      } else if (typeof _data === "object") {
        content.push(JSON.stringify(_data));
      }
    }

    return _content.join(" ").toLowerCase();
  }

  async getProjection(id: string): Promise<MemoryReadModel | null> {
    return await this.store.getMemory(id);
  }

  async getAllProjections(): Promise<MemoryReadModel[]> {
    return await this.store.getAllMemories();
  }

  async reset(): Promise<void> {
    await this.store.clear();
    this.lastProcessedEventId = null;
  }
}

/**
 * Statistics projection - generates statistics from events
 */
export class StatisticsProjection
  extends BaseReadModel
  implements IEventProjection<MemoryStatisticsReadModel>
{
  readonly name = "StatisticsProjection";
  readonly version = 1;
  readonly projectionName = "StatisticsProjection";
  readonly eventTypes = [
    "MemoryStoredEvent",
    "ContextCompressedEvent",
    "MemoryRetrievedEvent",
    "MemoryPromotedEvent",
  ];

  private readonly STATS_ID = "global-_stats";

  constructor(private readonly store: InMemoryReadModelStore) {
    super();
  }

  async project(event: DomainEvent): Promise<void> {
    await this.when(event);
    await this.setLastProcessedEventId(event.eventId);
  }

  async when(event: DomainEvent): Promise<void> {
    const _stats = await this.getOrCreateStats();

    switch (event.eventType) {
      case "MemoryStoredEvent":
        await this.updateStatsForMemoryStored(_stats, event as any);
        break;
      case "ContextCompressedEvent":
        await this.updateStatsForCompression(_stats, event as any);
        break;
      case "MemoryRetrievedEvent":
        await this.updateStatsForRetrieval(_stats, event as any);
        break;
      case "MemoryPromotedEvent":
        await this.updateStatsForPromotion(_stats, event as any);
        break;
    }

    stats.lastUpdated = event.timestamp;
    await this.store.saveStatistics(_stats);
  }

  private async getOrCreateStats(): Promise<MemoryStatisticsReadModel> {
    let _stats = await this.store.getStatistics();

    if (!_stats) {
      _stats = {
        id: this.STATS_ID,
        totalMemories: 0,
        totalSize: 0,
        compressionSavings: 0,
        tierDistribution: Record<string, any>,
        typeDistribution: Record<string, any>,
        accessPatterns: {
          hourly: new Array(24).fill(0),
          daily: new Array(7).fill(0),
          topAccessed: [],
        },
        lastUpdated: new Date(),
      };
    }

    return _stats;
  }

  private async updateStatsForMemoryStored(
    _stats: MemoryStatisticsReadModel,
    event: unknown,
  ): Promise<void> {
    _stats.totalMemories++;
    _stats.totalSize += event.size;

    // Update type distribution
    _stats.typeDistribution[event.memoryType] =
      (_stats.typeDistribution[event.memoryType] || 0) + 1;

    // Update tier distribution (new _memories start in L0)
    _stats.tierDistribution["L0"] = (_stats.tierDistribution["L0"] || 0) + 1;
  }

  private async updateStatsForCompression(
    _stats: MemoryStatisticsReadModel,
    event: unknown,
  ): Promise<void> {
    const _savings = event.originalSize - event.compressedSize;
    _stats.compressionSavings += _savings;
    stats.totalSize -= _savings;
  }

  private async updateStatsForRetrieval(
    _stats: MemoryStatisticsReadModel,
    event: unknown,
  ): Promise<void> {
    // Update access patterns
    const _hour = event.timestamp.getHours();
    const _day = event.timestamp.getDay();

    _stats.accessPatterns.hourly[_hour]++;
    stats.accessPatterns.daily[_day]++;
  }

  private async updateStatsForPromotion(
    _stats: MemoryStatisticsReadModel,
    event: unknown,
  ): Promise<void> {
    // Update tier distribution
    _stats.tierDistribution[event.fromTier] = Math.max(
      0,
      (_stats.tierDistribution[event.fromTier] || 0) - 1,
    );
    _stats.tierDistribution[event.toTier] =
      (_stats.tierDistribution[event.toTier] || 0) + 1;
  }

  async getProjection(id: string): Promise<MemoryStatisticsReadModel | null> {
    if (id === this.STATS_ID) {
      return await this.store.getStatistics();
    }
    return null;
  }

  async getAllProjections(): Promise<MemoryStatisticsReadModel[]> {
    const _stats = await this.store.getStatistics();
    return _stats ? [_stats] : [];
  }

  async reset(): Promise<void> {
    // Create a fresh statistics model
    const _stats: MemoryStatisticsReadModel = {
      id: this.STATS_ID,
      totalMemories: 0,
      totalSize: 0,
      compressionSavings: 0,
      tierDistribution: Record<string, any>,
      typeDistribution: Record<string, any>,
      accessPatterns: {
        hourly: new Array(24).fill(0),
        daily: new Array(7).fill(0),
        topAccessed: [],
      },
      lastUpdated: new Date(),
    };

    await this.store.saveStatistics(_stats);
    this.lastProcessedEventId = null;
  }
}
