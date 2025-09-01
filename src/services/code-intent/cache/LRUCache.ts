/**
 * LRU (Least Recently Used) Cache Implementation
 * Provides efficient caching with automatic eviction of least-used items
 */

export class LRUCache<K, V> {
  private maxSize: number;
  private cache: Map<K, V>;
  private accessOrder: Map<K, number>;
  private accessCounter: number;

  constructor(maxSize: number = 100) {
    this.maxSize = maxSize;
    this.cache = new Map();
    this.accessOrder = new Map();
    this.accessCounter = 0;
  }

  /**
   * Gets a value from the cache and updates access order
   */
  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Update access order
      this.accessOrder.set(key, ++this.accessCounter);
    }
    return value;
  }

  /**
   * Sets a value in the cache, evicting LRU item if necessary
   */
  set(key: K, value: V): void {
    // If already exists, just update
    if (this.cache.has(key)) {
      this.cache.set(key, value);
      this.accessOrder.set(key, ++this.accessCounter);
      return;
    }

    // If at capacity, evict LRU item
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    // Add new item
    this.cache.set(key, value);
    this.accessOrder.set(key, ++this.accessCounter);
  }

  /**
   * Checks if a key exists in the cache
   */
  has(key: K): boolean {
    return this.cache.has(key);
  }

  /**
   * Removes an item from the cache
   */
  delete(key: K): boolean {
    this.accessOrder.delete(key);
    return this.cache.delete(key);
  }

  /**
   * Clears the entire cache
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder.clear();
    this.accessCounter = 0;
  }

  /**
   * Gets the current size of the cache
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Evicts the least recently used item
   */
  private evictLRU(): void {
    let lruKey: K | undefined;
    let lruAccess = Infinity;

    for (const [key, access] of this.accessOrder.entries()) {
      if (access < lruAccess) {
        lruAccess = access;
        lruKey = key;
      }
    }

    if (lruKey !== undefined) {
      this.delete(lruKey);
    }
  }

  /**
   * Gets cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    utilization: number;
  } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      utilization: this.cache.size / this.maxSize
    };
  }

  /**
   * Gets all cached keys
   */
  keys(): K[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Gets all cached values
   */
  values(): V[] {
    return Array.from(this.cache.values());
  }
}