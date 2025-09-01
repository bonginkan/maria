/**
 * MemoryEngine
 * Enhanced memory engine with advanced features for V2 architecture
 * Provides intelligent storage, retrieval, and management capabilities
 */

import type {
  MemoryContent,
  MemoryQuery,
  MemoryResult,
  MemoryStats,
} from "../../../shared/types/enhanced-context";
import { validateMemoryContent } from "../../../shared/types/enhanced-context";

export interface MemoryEngineOptions {
  maxMemories: number;
  maxSizeBytes: number;
  compressionThreshold: number;
  indexingEnabled: boolean;
  searchEngine: "simple" | "vector" | "hybrid";
  persistenceLayer: "memory" | "sqlite" | "external";
}

export interface SearchIndex {
  wordIndex: Map<string, Set<string>>; // word -> memory IDs
  tagIndex: Map<string, Set<string>>; // tag -> memory IDs
  typeIndex: Map<string, Set<string>>; // type -> memory IDs
  importanceIndex: Map<number, Set<string>>; // importance bucket -> memory IDs
  dateIndex: Map<string, Set<string>>; // date bucket -> memory IDs
}

export class MemoryEngine {
  private memories: Map<string, MemoryContent> = new Map();
  private searchIndex: SearchIndex;
  private options: MemoryEngineOptions;
  private stats: MemoryStats;
  private nextId = 1;

  constructor(options: Partial<MemoryEngineOptions> = {}) {
    this.options = {
      maxMemories: 10000,
      maxSizeBytes: 100 * 1024 * 1024, // 100MB
      compressionThreshold: 0.8,
      indexingEnabled: true,
      searchEngine: "hybrid",
      persistenceLayer: "memory",
      ...options,
    };

    this.searchIndex = {
      wordIndex: new Map(),
      tagIndex: new Map(),
      typeIndex: new Map(),
      importanceIndex: new Map(),
      dateIndex: new Map(),
    };

    this.stats = this.initializeStats();
  }

  /**
   * Store a memory with enhanced features
   */
  async store(
    content: MemoryContent,
    options?: { signal?: AbortSignal },
  ): Promise<string> {
    // Validate content
    const validatedContent = validateMemoryContent(content);

    // Generate unique ID
    const memoryId = this.generateId();

    // Check capacity limits
    await this.enforceCapacityLimits();

    // Store memory
    this.memories.set(memoryId, validatedContent);

    // Update search indexes
    if (this.options.indexingEnabled) {
      this.updateSearchIndexes(memoryId, validatedContent);
    }

    // Update statistics
    this.updateStats(validatedContent, "add");

    return memoryId;
  }

  /**
   * Query memories with advanced search capabilities
   */
  async query(
    query: MemoryQuery,
    options?: { signal?: AbortSignal },
  ): Promise<MemoryResult[]> {
    let candidates = new Set<string>();

    // Different search strategies based on query
    if (query.query && query.query.trim()) {
      // Text search
      const textCandidates = this.searchByText(query.query);
      this.addToSet(candidates, textCandidates);
    }

    if (query.tags && query.tags.length > 0) {
      // Tag search
      const tagCandidates = this.searchByTags(query.tags);
      if (candidates.size === 0) {
        this.addToSet(candidates, tagCandidates);
      } else {
        // Intersection with existing candidates
        candidates = this.intersectSets(candidates, tagCandidates);
      }
    }

    if (query.type) {
      // Type search
      const typeCandidates = this.searchByType(query.type);
      if (candidates.size === 0) {
        this.addToSet(candidates, typeCandidates);
      } else {
        candidates = this.intersectSets(candidates, typeCandidates);
      }
    }

    // If no specific criteria, get all memories
    if (candidates.size === 0 && !query.query && !query.tags && !query.type) {
      candidates = new Set(this.memories.keys());
    }

    // Convert to MemoryResult objects
    const results: MemoryResult[] = [];
    for (const memoryId of candidates) {
      const memory = this.memories.get(memoryId);
      if (!memory) continue;

      // Apply filters
      if (!this.passesFilters(memory, query)) continue;

      // Calculate relevance score
      const score = this.calculateRelevanceScore(memory, query);

      results.push({
        id: memoryId,
        content: memory.content,
        metadata: memory.metadata,
        score,
        source: "L2", // Memory engine level
      });
    }

    // Sort by score and apply limit
    results.sort((a, b) => (b.score || 0) - (a.score || 0));

    return query.limit ? results.slice(0, query.limit) : results;
  }

  /**
   * Clear memories based on criteria
   */
  async clear(
    filter?: MemoryQuery,
    options?: { signal?: AbortSignal },
  ): Promise<void> {
    if (!filter) {
      // Clear all
      this.memories.clear();
      this.resetSearchIndexes();
      this.stats = this.initializeStats();
      return;
    }

    // Find memories to delete
    const toDelete = await this.query(filter, options);

    // Remove them
    for (const result of toDelete) {
      const memory = this.memories.get(result.id);
      if (memory) {
        this.memories.delete(result.id);
        this.removeFromSearchIndexes(result.id, memory);
        this.updateStats(memory, "remove");
      }
    }
  }

  /**
   * Get comprehensive memory statistics
   */
  async getStats(options?: { signal?: AbortSignal }): Promise<MemoryStats> {
    // Recalculate dynamic stats
    this.stats.total = this.memories.size;

    const importanceSum = Array.from(this.memories.values()).reduce(
      (sum, mem) => sum + mem.metadata.importance,
      0,
    );
    this.stats.avgImportance =
      this.memories.size > 0 ? importanceSum / this.memories.size : 0;

    // Calculate size
    this.stats.totalSize = this.calculateTotalSize();

    // Find oldest and newest
    const timestamps = Array.from(this.memories.values())
      .map((mem) => mem.metadata.timestamp)
      .sort();

    if (timestamps.length > 0) {
      this.stats.oldestTimestamp = timestamps[0];
      this.stats.newestTimestamp = timestamps[timestamps.length - 1];
    }

    return { ...this.stats };
  }

  /**
   * Generate unique memory ID
   */
  private generateId(): string {
    return `mem_${this.nextId++}_${Date.now()}`;
  }

  /**
   * Enforce capacity limits
   */
  private async enforceCapacityLimits(): Promise<void> {
    // Check memory count limit
    if (this.memories.size >= this.options.maxMemories) {
      await this.evictOldestMemories(
        Math.floor(this.options.maxMemories * 0.1),
      );
    }

    // Check size limit
    const currentSize = this.calculateTotalSize();
    if (currentSize >= this.options.maxSizeBytes) {
      await this.evictLargestMemories(Math.floor(this.memories.size * 0.1));
    }
  }

  /**
   * Evict oldest memories
   */
  private async evictOldestMemories(count: number): Promise<void> {
    const memoriesWithDates = Array.from(this.memories.entries())
      .map(([id, memory]) => ({
        id,
        memory,
        timestamp: new Date(memory.metadata.timestamp).getTime(),
      }))
      .sort((a, b) => a.timestamp - b.timestamp);

    for (let i = 0; i < count && i < memoriesWithDates.length; i++) {
      const { id, memory } = memoriesWithDates[i];
      this.memories.delete(id);
      this.removeFromSearchIndexes(id, memory);
      this.updateStats(memory, "remove");
    }
  }

  /**
   * Evict largest memories
   */
  private async evictLargestMemories(count: number): Promise<void> {
    const memoriesWithSizes = Array.from(this.memories.entries())
      .map(([id, memory]) => ({
        id,
        memory,
        size: this.calculateMemorySize(memory),
      }))
      .sort((a, b) => b.size - a.size);

    for (let i = 0; i < count && i < memoriesWithSizes.length; i++) {
      const { id, memory } = memoriesWithSizes[i];
      this.memories.delete(id);
      this.removeFromSearchIndexes(id, memory);
      this.updateStats(memory, "remove");
    }
  }

  /**
   * Calculate total memory size
   */
  private calculateTotalSize(): number {
    let total = 0;
    for (const memory of this.memories.values()) {
      total += this.calculateMemorySize(memory);
    }
    return total;
  }

  /**
   * Calculate individual memory size
   */
  private calculateMemorySize(memory: MemoryContent): number {
    return JSON.stringify(memory).length * 2; // Rough Unicode estimate
  }

  /**
   * Update search indexes when adding memory
   */
  private updateSearchIndexes(memoryId: string, memory: MemoryContent): void {
    // Word index
    const words = this.extractWords(memory);
    for (const word of words) {
      if (!this.searchIndex.wordIndex.has(word)) {
        this.searchIndex.wordIndex.set(word, new Set());
      }
      this.searchIndex.wordIndex.get(word)!.add(memoryId);
    }

    // Tag index
    if (memory.metadata.tags) {
      for (const tag of memory.metadata.tags) {
        if (!this.searchIndex.tagIndex.has(tag)) {
          this.searchIndex.tagIndex.set(tag, new Set());
        }
        this.searchIndex.tagIndex.get(tag)!.add(memoryId);
      }
    }

    // Type index
    const type = memory.metadata.type;
    if (!this.searchIndex.typeIndex.has(type)) {
      this.searchIndex.typeIndex.set(type, new Set());
    }
    this.searchIndex.typeIndex.get(type)!.add(memoryId);

    // Importance index (bucketed)
    const importanceBucket = Math.floor(memory.metadata.importance * 10) / 10;
    if (!this.searchIndex.importanceIndex.has(importanceBucket)) {
      this.searchIndex.importanceIndex.set(importanceBucket, new Set());
    }
    this.searchIndex.importanceIndex.get(importanceBucket)!.add(memoryId);

    // Date index (daily buckets)
    const date = new Date(memory.metadata.timestamp)
      .toISOString()
      .split("T")[0];
    if (!this.searchIndex.dateIndex.has(date)) {
      this.searchIndex.dateIndex.set(date, new Set());
    }
    this.searchIndex.dateIndex.get(date)!.add(memoryId);
  }

  /**
   * Remove from search indexes when deleting memory
   */
  private removeFromSearchIndexes(
    memoryId: string,
    memory: MemoryContent,
  ): void {
    // Word index
    const words = this.extractWords(memory);
    for (const word of words) {
      const wordSet = this.searchIndex.wordIndex.get(word);
      if (wordSet) {
        wordSet.delete(memoryId);
        if (wordSet.size === 0) {
          this.searchIndex.wordIndex.delete(word);
        }
      }
    }

    // Tag index
    if (memory.metadata.tags) {
      for (const tag of memory.metadata.tags) {
        const tagSet = this.searchIndex.tagIndex.get(tag);
        if (tagSet) {
          tagSet.delete(memoryId);
          if (tagSet.size === 0) {
            this.searchIndex.tagIndex.delete(tag);
          }
        }
      }
    }

    // Type index
    const typeSet = this.searchIndex.typeIndex.get(memory.metadata.type);
    if (typeSet) {
      typeSet.delete(memoryId);
      if (typeSet.size === 0) {
        this.searchIndex.typeIndex.delete(memory.metadata.type);
      }
    }

    // Importance index
    const importanceBucket = Math.floor(memory.metadata.importance * 10) / 10;
    const importanceSet =
      this.searchIndex.importanceIndex.get(importanceBucket);
    if (importanceSet) {
      importanceSet.delete(memoryId);
      if (importanceSet.size === 0) {
        this.searchIndex.importanceIndex.delete(importanceBucket);
      }
    }

    // Date index
    const date = new Date(memory.metadata.timestamp)
      .toISOString()
      .split("T")[0];
    const dateSet = this.searchIndex.dateIndex.get(date);
    if (dateSet) {
      dateSet.delete(memoryId);
      if (dateSet.size === 0) {
        this.searchIndex.dateIndex.delete(date);
      }
    }
  }

  /**
   * Reset all search indexes
   */
  private resetSearchIndexes(): void {
    this.searchIndex.wordIndex.clear();
    this.searchIndex.tagIndex.clear();
    this.searchIndex.typeIndex.clear();
    this.searchIndex.importanceIndex.clear();
    this.searchIndex.dateIndex.clear();
  }

  /**
   * Extract searchable words from memory content
   */
  private extractWords(memory: MemoryContent): Set<string> {
    const words = new Set<string>();

    // Extract from content
    const contentText =
      typeof memory.content === "object"
        ? JSON.stringify(memory.content).toLowerCase()
        : String(memory.content).toLowerCase();

    // Simple word extraction
    const wordMatches = contentText.match(/\b\w+\b/g);
    if (wordMatches) {
      for (const word of wordMatches) {
        if (word.length >= 3) {
          // Skip very short words
          words.add(word);
        }
      }
    }

    return words;
  }

  /**
   * Search by text using word index
   */
  private searchByText(query: string): Set<string> {
    const queryWords = query.toLowerCase().match(/\b\w+\b/g) || [];
    const results = new Set<string>();

    for (const word of queryWords) {
      const wordResults = this.searchIndex.wordIndex.get(word);
      if (wordResults) {
        this.addToSet(results, wordResults);
      }
    }

    return results;
  }

  /**
   * Search by tags
   */
  private searchByTags(tags: string[]): Set<string> {
    const results = new Set<string>();

    for (const tag of tags) {
      const tagResults = this.searchIndex.tagIndex.get(tag);
      if (tagResults) {
        this.addToSet(results, tagResults);
      }
    }

    return results;
  }

  /**
   * Search by type
   */
  private searchByType(type: string): Set<string> {
    return this.searchIndex.typeIndex.get(type) || new Set();
  }

  /**
   * Check if memory passes filters
   */
  private passesFilters(memory: MemoryContent, query: MemoryQuery): boolean {
    // Importance filter
    if (query.minImportance !== undefined) {
      if (memory.metadata.importance < query.minImportance) {
        return false;
      }
    }

    // Age filter
    if (query.maxAge !== undefined) {
      const memoryAge =
        (Date.now() - new Date(memory.metadata.timestamp).getTime()) /
        (1000 * 60 * 60 * 24);
      if (memoryAge > query.maxAge) {
        return false;
      }
    }

    // User filter
    if (query.userId && memory.metadata.userId !== query.userId) {
      return false;
    }

    return true;
  }

  /**
   * Calculate relevance score for search results
   */
  private calculateRelevanceScore(
    memory: MemoryContent,
    query: MemoryQuery,
  ): number {
    let score = memory.metadata.importance; // Base score from importance

    // Text relevance
    if (query.query) {
      const textScore = this.calculateTextRelevance(memory, query.query);
      score = score * 0.6 + textScore * 0.4;
    }

    // Recency bonus (more recent = higher score)
    const age = Date.now() - new Date(memory.metadata.timestamp).getTime();
    const maxAge = 365 * 24 * 60 * 60 * 1000; // 1 year
    const recencyFactor = 1 - Math.min(age / maxAge, 1);
    score += recencyFactor * 0.1;

    return Math.min(score, 1.0);
  }

  /**
   * Calculate text relevance score
   */
  private calculateTextRelevance(memory: MemoryContent, query: string): number {
    const contentText =
      typeof memory.content === "object"
        ? JSON.stringify(memory.content).toLowerCase()
        : String(memory.content).toLowerCase();

    const queryLower = query.toLowerCase();

    // Exact phrase match gets highest score
    if (contentText.includes(queryLower)) {
      return 1.0;
    }

    // Word overlap scoring
    const queryWords = queryLower.match(/\b\w+\b/g) || [];
    const contentWords = contentText.match(/\b\w+\b/g) || [];

    const querySet = new Set(queryWords);
    const contentSet = new Set(contentWords);

    const intersection = new Set(
      [...querySet].filter((x) => contentSet.has(x)),
    );
    const union = new Set([...querySet, ...contentSet]);

    return intersection.size / union.size; // Jaccard similarity
  }

  /**
   * Utility: Add set to another set
   */
  private addToSet<T>(target: Set<T>, source: Set<T>): void {
    for (const item of source) {
      target.add(item);
    }
  }

  /**
   * Utility: Intersect two sets
   */
  private intersectSets<T>(set1: Set<T>, set2: Set<T>): Set<T> {
    return new Set([...set1].filter((x) => set2.has(x)));
  }

  /**
   * Initialize statistics
   */
  private initializeStats(): MemoryStats {
    return {
      total: 0,
      byType: {},
      avgImportance: 0,
      oldestTimestamp: new Date().toISOString(),
      newestTimestamp: new Date().toISOString(),
      totalSize: 0,
    };
  }

  /**
   * Update statistics when adding/removing memories
   */
  private updateStats(memory: MemoryContent, action: "add" | "remove"): void {
    const multiplier = action === "add" ? 1 : -1;

    // Update type counts
    const type = memory.metadata.type;
    if (!this.stats.byType[type]) {
      this.stats.byType[type] = 0;
    }
    this.stats.byType[type] += multiplier;

    if (this.stats.byType[type] <= 0) {
      delete this.stats.byType[type];
    }
  }
}

/**
 * Factory function to create memory engine
 */
export function createMemoryEngine(
  options?: Partial<MemoryEngineOptions>,
): MemoryEngine {
  return new MemoryEngine(options);
}
