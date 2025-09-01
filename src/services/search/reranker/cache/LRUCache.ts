/**
 * LRU (Least Recently Used) Cache Implementation
 * Phase 4.2: High-performance caching for reranking results
 */

interface CacheEntry<T> {
  key: string;
  value: T;
  timestamp: number;
  hits: number;
}

interface CacheOptions {
  maxSize: number;
  ttl?: number; // Time to live in milliseconds
  onEvict?: (key: string, value: any) => void;
}

export class LRUCache<T> {
  private cache: Map<string, CacheEntry<T>>;
  private options: Required<CacheOptions>;
  private stats: {
    hits: number;
    misses: number;
    evictions: number;
    sets: number;
  };

  constructor(options: CacheOptions) {
    this.cache = new Map();
    this.options = {
      maxSize: options.maxSize,
      ttl: options.ttl || Infinity,
      onEvict:
        options.onEvict ||
        (() => {
          // Implementation pending
        }),
    };

    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      sets: 0,
    };
  }

  /**
   * Get a value from cache
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return undefined;
    }

    // Check TTL
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.stats.misses++;
      return undefined;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    entry.hits++;
    entry.timestamp = Date.now();
    this.cache.set(key, entry);

    this.stats.hits++;
    return entry.value;
  }

  /**
   * Set a value in cache
   */
  set(key: string, value: T): void {
    // Check if key exists (for updating)
    const existing = this.cache.get(key);

    if (existing) {
      // Update existing entry
      this.cache.delete(key);
      existing.value = value;
      existing.timestamp = Date.now();
      existing.hits = 0;
      this.cache.set(key, existing);
    } else {
      // Check size limit
      if (this.cache.size >= this.options.maxSize) {
        this.evictLRU();
      }

      // Add new entry
      const entry: CacheEntry<T> = {
        key,
        value,
        timestamp: Date.now(),
        hits: 0,
      };

      this.cache.set(key, entry);
    }

    this.stats.sets++;
  }

  /**
   * Check if key exists in cache
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (this.isExpired(entry)) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete a key from cache
   */
  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (entry) {
      this.options.onEvict(key, entry.value);
      return this.cache.delete(key);
    }
    return false;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    for (const [key, entry] of this.cache.entries()) {
      this.options.onEvict(key, entry.value);
    }
    this.cache.clear();
    this.resetStats();
  }

  /**
   * Get cache size
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Get all keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get all values
   */
  values(): T[] {
    const values: T[] = [];
    for (const entry of this.cache.values()) {
      if (!this.isExpired(entry)) {
        values.push(entry.value);
      }
    }
    return values;
  }

  /**
   * Get cache statistics
   */
  getStats(): typeof this.stats & { size: number; evictions?: number } {
    return {
      ...this.stats,
      size: this.cache.size,
    };
  }

  /**
   * Get cache hit rate
   */
  getHitRate(): number {
    const total = this.stats.hits + this.stats.misses;
    if (total === 0) return 0;
    return this.stats.hits / total;
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      sets: 0,
    };
  }

  /**
   * Check if entry is expired
   */
  private isExpired(entry: CacheEntry<T>): boolean {
    if (this.options.ttl === Infinity) return false;
    return Date.now() - entry.timestamp > this.options.ttl;
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    // Map maintains insertion order, so first entry is oldest
    const firstKey = this.cache.keys().next().value;

    if (firstKey !== undefined) {
      const entry = this.cache.get(firstKey);
      if (entry) {
        this.options.onEvict(firstKey, entry.value);
      }
      this.cache.delete(firstKey);
      this.stats.evictions++;
    }
  }

  /**
   * Clean up expired entries
   */
  cleanupExpired(): number {
    let cleaned = 0;
    const _now = Date._now();

    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        this.options.onEvict(key, entry.value);
        this.cache.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Get cache memory estimate (rough)
   */
  getMemoryEstimate(): number {
    // Rough estimate: assume each entry uses ~1KB average
    return this.cache.size * 1024;
  }

  /**
   * Serialize cache to JSON
   */
  toJSON(): Array<{ key: string; value: T; timestamp: number; hits: number }> {
    const entries: Array<{
      key: string;
      value: T;
      timestamp: number;
      hits: number;
    }> = [];

    for (const [_key, entry] of this.cache.entries()) {
      if (!this.isExpired(entry)) {
        entries.push({
          key: entry.key,
          value: entry.value,
          timestamp: entry.timestamp,
          hits: entry.hits,
        });
      }
    }

    return entries;
  }

  /**
   * Load cache from JSON
   */
  fromJSON(
    data: Array<{ key: string; value: T; timestamp: number; hits: number }>,
  ): void {
    this.clear();

    for (const _item of data) {
      const entry: CacheEntry<T> = {
        key: _item.key,
        value: _item.value,
        timestamp: _item.timestamp,
        hits: _item.hits,
      };

      if (!this.isExpired(entry)) {
        this.cache.set(_item.key, entry);
      }
    }
  }
}
