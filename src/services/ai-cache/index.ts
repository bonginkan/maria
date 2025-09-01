/**
 * AI Response Cache Service
 * Phase 5: Intelligent caching for AI responses with semantic similarity
 */

import { createHash } from "crypto";
import { EventEmitter } from "node:events";

export interface CachedResponse {
  prompt: string;
  response: string;
  provider: string;
  model: string;
  timestamp: number;
  ttl: number;
  hits: number;
  metadata?: Record<string, any>;
}

export interface CacheConfig {
  maxSize: number;
  ttlSeconds: number;
  enableSemanticSearch: boolean;
  similarityThreshold: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  hitRate: number;
}

/**
 * LRU Cache implementation for AI responses
 */
export class AIResponseCache extends EventEmitter {
  private cache: Map<string, CachedResponse> = new Map();
  private accessOrder: string[] = [];
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    size: 0,
    hitRate: 0,
  };

  constructor(private config: CacheConfig) {
    super();
    this.startCleanupTimer();
  }

  /**
   * Generate cache key from prompt
   */
  private generateKey(
    prompt: string,
    provider?: string,
    model?: string,
  ): string {
    const data = `${prompt}:${provider || "any"}:${model || "any"}`;
    return createHash("sha256").update(data).digest("hex");
  }

  /**
   * Get cached response
   */
  async get(
    prompt: string,
    provider?: string,
    model?: string,
  ): Promise<CachedResponse | null> {
    const key = this.generateKey(prompt, provider, model);

    // Check exact match
    const cached = this.cache.get(key);
    if (cached) {
      // Check TTL
      if (this.isExpired(cached)) {
        this.cache.delete(key);
        this.removeFromAccessOrder(key);
        return null;
      }

      // Update stats and access order
      cached.hits++;
      this.stats.hits++;
      this.updateHitRate();
      this.updateAccessOrder(key);

      this.emit("cache:hit", { key, cached });
      return cached;
    }

    // If semantic search is enabled, look for similar prompts
    if (this.config.enableSemanticSearch) {
      const similar = await this.findSimilar(prompt);
      if (similar) {
        this.stats.hits++;
        this.updateHitRate();
        this.emit("cache:semantic-hit", { prompt, similar });
        return similar;
      }
    }

    this.stats.misses++;
    this.updateHitRate();
    this.emit("cache:miss", { prompt });
    return null;
  }

  /**
   * Set cached response
   */
  async set(
    prompt: string,
    response: string,
    provider: string,
    model: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    const key = this.generateKey(prompt, provider, model);

    // Check cache size limit
    if (this.cache.size >= this.config.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    const cached: CachedResponse = {
      prompt,
      response,
      provider,
      model,
      timestamp: Date.now(),
      ttl: this.config.ttlSeconds * 1000,
      hits: 0,
      metadata,
    };

    this.cache.set(key, cached);
    this.updateAccessOrder(key);
    this.stats.size = this.cache.size;

    this.emit("cache:set", { key, cached });
  }

  /**
   * Find semantically similar cached response
   */
  private async findSimilar(prompt: string): Promise<CachedResponse | null> {
    // Simple similarity check - in production, use vector embeddings
    const promptWords = prompt.toLowerCase().split(/\s+/);
    let bestMatch: CachedResponse | null = null;
    let bestScore = 0;

    for (const cached of this.cache.values()) {
      if (this.isExpired(cached)) continue;

      const cachedWords = cached.prompt.toLowerCase().split(/\s+/);
      const score = this.calculateSimilarity(promptWords, cachedWords);

      if (score > this.config.similarityThreshold && score > bestScore) {
        bestScore = score;
        bestMatch = cached;
      }
    }

    return bestMatch;
  }

  /**
   * Calculate word-based similarity (simplified)
   */
  private calculateSimilarity(words1: string[], words2: string[]): number {
    const set1 = new Set(words1);
    const set2 = new Set(words2);
    const intersection = new Set([...set1].filter((x) => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
  }

  /**
   * Check if cached response is expired
   */
  private isExpired(cached: CachedResponse): boolean {
    return Date.now() - cached.timestamp > cached.ttl;
  }

  /**
   * Evict least recently used item
   */
  private evictLRU(): void {
    if (this.accessOrder.length === 0) return;

    const keyToEvict = this.accessOrder[0];
    this.cache.delete(keyToEvict);
    this.accessOrder.shift();
    this.stats.evictions++;
    this.stats.size = this.cache.size;

    this.emit("cache:evict", { key: keyToEvict });
  }

  /**
   * Update access order for LRU
   */
  private updateAccessOrder(key: string): void {
    this.removeFromAccessOrder(key);
    this.accessOrder.push(key);
  }

  /**
   * Remove key from access order
   */
  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index !== -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  /**
   * Update hit rate statistics
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  /**
   * Start cleanup timer for expired entries
   */
  private startCleanupTimer(): void {
    setInterval(() => {
      for (const [key, cached] of this.cache.entries()) {
        if (this.isExpired(cached)) {
          this.cache.delete(key);
          this.removeFromAccessOrder(key);
          this.emit("cache:expire", { key });
        }
      }
      this.stats.size = this.cache.size;
    }, 60000); // Clean up every minute
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
    this.stats.size = 0;
    this.emit("cache:clear");
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Export cache for persistence
   */
  export(): Array<[string, CachedResponse]> {
    return Array.from(this.cache.entries());
  }

  /**
   * Import cache from persistence
   */
  import(entries: Array<[string, CachedResponse]>): void {
    this.clear();
    for (const [key, value] of entries) {
      if (!this.isExpired(value)) {
        this.cache.set(key, value);
        this.accessOrder.push(key);
      }
    }
    this.stats.size = this.cache.size;
  }
}

/**
 * Global cache instance
 */
let globalCache: AIResponseCache | null = null;

/**
 * Initialize global cache
 */
export function initializeCache(
  config?: Partial<CacheConfig>,
): AIResponseCache {
  const defaultConfig: CacheConfig = {
    maxSize: 1000,
    ttlSeconds: 3600, // 1 hour
    enableSemanticSearch: true,
    similarityThreshold: 0.85,
    ...config,
  };

  globalCache = new AIResponseCache(defaultConfig);
  return globalCache;
}

/**
 * Get global cache instance
 */
export function getCache(): AIResponseCache {
  if (!globalCache) {
    return initializeCache();
  }
  return globalCache;
}
