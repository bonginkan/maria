/**
 * Caching Port
 * Defines the contract for caching operations
 */

export interface CacheEntry<T = any> {
  key: string;
  value: T;
  ttl?: number;
  tags?: string[];
  metadata?: Record<string, any>;
  createdAt: Date;
  expiresAt?: Date;
}

export interface CacheStats {
  totalKeys: number;
  hitRate: number;
  missRate: number;
  memoryUsage: number;
  totalHits: number;
  totalMisses: number;
  evictionCount: number;
}

export interface CacheFilter {
  pattern?: string;
  tags?: string[];
  keyPrefix?: string;
  expired?: boolean;
}

/**
 * Primary port for caching operations
 */
export interface _ICachingPort {
  /**
   * Set a value in cache
   */
  set<T>(_key: string, value: T, ttl?: number, tags?: string[]): Promise<void>;

  /**
   * Get a value from cache
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * Check if key exists in cache
   */
  has(key: string): Promise<boolean>;

  /**
   * Delete a specific key
   */
  delete(key: string): Promise<boolean>;

  /**
   * Delete multiple keys
   */
  deleteMany(keys: string[]): Promise<number>;

  /**
   * Delete keys by pattern
   */
  deleteByPattern(pattern: string): Promise<number>;

  /**
   * Delete keys by tags
   */
  deleteByTags(tags: string[]): Promise<number>;

  /**
   * Get multiple values
   */
  getMany<T>(keys: string[]): Promise<Array<T | null>>;

  /**
   * Set multiple values
   */
  setMany<T>(
    entries: Array<{ _key: string; value: T; ttl?: number; tags?: string[] }>,
  ): Promise<void>;

  /**
   * Get keys matching pattern
   */
  getKeys(pattern?: string): Promise<string[]>;

  /**
   * Get cache statistics
   */
  getStats(): Promise<CacheStats>;

  /**
   * Clear all cache entries
   */
  clear(): Promise<void>;

  /**
   * Clear expired entries
   */
  clearExpired(): Promise<number>;

  /**
   * Set TTL for existing key
   */
  expire(_key: string, ttl: number): Promise<boolean>;

  /**
   * Get TTL for key
   */
  getTTL(key: string): Promise<number | null>;

  /**
   * Increment numeric value
   */
  increment(_key: string, amount?: number): Promise<number>;

  /**
   * Decrement numeric value
   */
  decrement(_key: string, amount?: number): Promise<number>;

  /**
   * Add to set
   */
  sadd(_key: string, ...values: string[]): Promise<number>;

  /**
   * Remove from set
   */
  srem(_key: string, ...values: string[]): Promise<number>;

  /**
   * Get set members
   */
  smembers(key: string): Promise<string[]>;

  /**
   * Check if member exists in set
   */
  sismember(_key: string, value: string): Promise<boolean>;

  /**
   * Get cache entries by filter
   */
  getEntriesByFilter(
    _filter: CacheFilter,
    limit?: number,
  ): Promise<CacheEntry[]>;

  /**
   * Warm up cache with data
   */
  warmUp(
    entries: Array<{ _key: string; value: any; ttl?: number }>,
  ): Promise<void>;

  /**
   * Health check
   */
  healthCheck(): Promise<{ isHealthy: boolean; details?: Record<string, any> }>;
}
