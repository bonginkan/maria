/**
 * Hot Cache - High-performance in-memory cache with change notification
 * Provides fast access to frequently accessed data with automatic invalidation
 */

import { EventEmitter } from 'events';

export interface CacheEntry<T> {
  key: string;
  value: T;
  version: string;
  cachedAt: Date;
  lastAccessedAt: Date;
  hitCount: number;
  expiresAt?: Date;
  tags: string[];
}

export interface CacheConfig {
  /** Maximum number of entries to keep in cache */
  maxSize: number;
  /** Default TTL for cache entries in milliseconds */
  defaultTtlMs: number;
  /** Whether to enable LRU eviction */
  enableLru: boolean;
  /** Whether to enable automatic refresh of expiring entries */
  enableAutoRefresh: boolean;
  /** Callback interval for auto-refresh in milliseconds */
  autoRefreshIntervalMs: number;
  /** Threshold for triggering auto-refresh (ratio of TTL) */
  autoRefreshThreshold: number;
}

export interface CacheStats {
  totalEntries: number;
  hitCount: number;
  missCount: number;
  evictionCount: number;
  hitRate: number;
  averageAge: number;
  memoryUsage: number;
  topHitKeys: Array<{ key: string; hitCount: number }>;
}

export interface CacheRefreshRequest<T> {
  key: string;
  currentEntry: CacheEntry<T>;
  refreshCallback: () => Promise<T>;
}

export class HotCache<T = any> extends EventEmitter {
  private readonly cache = new Map<string, CacheEntry<T>>();
  private readonly versionMap = new Map<string, string>(); // key -> latest version
  private readonly tagIndex = new Map<string, Set<string>>(); // tag -> keys
  private readonly refreshCallbacks = new Map<string, () => Promise<T>>();
  
  private hitCount = 0;
  private missCount = 0;
  private evictionCount = 0;
  private autoRefreshTimer?: NodeJS.Timeout;
  
  constructor(
    private readonly config: CacheConfig = {
      maxSize: 1000,
      defaultTtlMs: 300000, // 5 minutes
      enableLru: true,
      enableAutoRefresh: true,
      autoRefreshIntervalMs: 60000, // 1 minute
      autoRefreshThreshold: 0.8 // Refresh when 80% of TTL has passed
    }
  ) {
    super();
    
    if (this.config.enableAutoRefresh) {
      this.startAutoRefresh();
    }
  }

  /**
   * Set a value in the cache with optional TTL and tags
   */
  set(
    key: string, 
    value: T, 
    options: {
      ttlMs?: number;
      version?: string;
      tags?: string[];
      refreshCallback?: () => Promise<T>;
    } = {}
  ): void {
    const now = new Date();
    const ttl = options.ttlMs || this.config.defaultTtlMs;
    const version = options.version || Date.now().toString();
    const tags = options.tags || [];

    // Update version tracking
    this.versionMap.set(key, version);

    // Create cache entry
    const entry: CacheEntry<T> = {
      key,
      value,
      version,
      cachedAt: now,
      lastAccessedAt: now,
      hitCount: 0,
      expiresAt: ttl > 0 ? new Date(now.getTime() + ttl) : undefined,
      tags
    };

    // Remove old entry if exists (for cleanup)
    const oldEntry = this.cache.get(key);
    if (oldEntry) {
      this.removeFromTagIndex(key, oldEntry.tags);
    }

    // Add to cache
    this.cache.set(key, entry);
    
    // Update tag index
    this.addToTagIndex(key, tags);
    
    // Store refresh callback if provided
    if (options.refreshCallback) {
      this.refreshCallbacks.set(key, options.refreshCallback);
    }

    // Enforce size limit
    this.enforceMaxSize();

    this.emit('entrySet', {
      key,
      version,
      ttlMs: ttl,
      tags,
      hasRefreshCallback: !!options.refreshCallback
    });
  }

  /**
   * Get a value from the cache
   */
  get(key: string): CacheEntry<T> | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.missCount++;
      this.emit('cacheMiss', { key });
      return null;
    }

    // Check expiration
    if (entry.expiresAt && entry.expiresAt < new Date()) {
      this.remove(key);
      this.missCount++;
      this.emit('cacheExpired', { key, expiredAt: entry.expiresAt });
      return null;
    }

    // Update access statistics
    entry.lastAccessedAt = new Date();
    entry.hitCount++;
    this.hitCount++;

    this.emit('cacheHit', { 
      key, 
      hitCount: entry.hitCount, 
      version: entry.version 
    });

    return { ...entry }; // Return copy to prevent external mutation
  }

  /**
   * Get value only, not the full entry
   */
  getValue(key: string): T | null {
    const entry = this.get(key);
    return entry ? entry.value : null;
  }

  /**
   * Check if a key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    if (entry.expiresAt && entry.expiresAt < new Date()) {
      this.remove(key);
      return false;
    }
    
    return true;
  }

  /**
   * Remove a specific key from the cache
   */
  remove(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    this.cache.delete(key);
    this.versionMap.delete(key);
    this.refreshCallbacks.delete(key);
    this.removeFromTagIndex(key, entry.tags);

    this.emit('entryRemoved', { key, reason: 'manual' });
    return true;
  }

  /**
   * Remove all entries with a specific tag
   */
  removeByTag(tag: string): number {
    const keysWithTag = this.tagIndex.get(tag);
    if (!keysWithTag) return 0;

    let removedCount = 0;
    for (const key of keysWithTag) {
      if (this.remove(key)) {
        removedCount++;
      }
    }

    this.emit('entriesRemovedByTag', { tag, removedCount });
    return removedCount;
  }

  /**
   * Invalidate entries by version check
   */
  invalidateByVersion(key: string, newVersion: string): boolean {
    const currentVersion = this.versionMap.get(key);
    
    if (currentVersion && currentVersion !== newVersion) {
      this.remove(key);
      this.emit('versionInvalidation', { 
        key, 
        oldVersion: currentVersion, 
        newVersion 
      });
      return true;
    }
    
    return false;
  }

  /**
   * Bulk invalidation by multiple version checks
   */
  bulkInvalidateByVersion(versionMap: Record<string, string>): {
    invalidated: string[];
    unchanged: string[];
  } {
    const invalidated: string[] = [];
    const unchanged: string[] = [];

    for (const [key, newVersion] of Object.entries(versionMap)) {
      if (this.invalidateByVersion(key, newVersion)) {
        invalidated.push(key);
      } else {
        unchanged.push(key);
      }
    }

    if (invalidated.length > 0) {
      this.emit('bulkVersionInvalidation', {
        invalidatedCount: invalidated.length,
        unchangedCount: unchanged.length
      });
    }

    return { invalidated, unchanged };
  }

  /**
   * Get all keys with a specific tag
   */
  getKeysByTag(tag: string): string[] {
    const keysWithTag = this.tagIndex.get(tag);
    return keysWithTag ? Array.from(keysWithTag) : [];
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const entries = Array.from(this.cache.values());
    const now = new Date();
    
    // Calculate average age
    const totalAge = entries.reduce((sum, entry) => 
      sum + (now.getTime() - entry.cachedAt.getTime()), 0
    );
    const averageAge = entries.length > 0 ? totalAge / entries.length : 0;
    
    // Get top hit keys
    const topHitKeys = entries
      .sort((a, b) => b.hitCount - a.hitCount)
      .slice(0, 10)
      .map(entry => ({ key: entry.key, hitCount: entry.hitCount }));
    
    // Estimate memory usage (rough calculation)
    const memoryUsage = entries.reduce((sum, entry) => {
      const keySize = entry.key.length * 2; // UTF-16
      const valueSize = JSON.stringify(entry.value).length * 2;
      const metadataSize = 200; // Rough estimate for dates, numbers, etc.
      return sum + keySize + valueSize + metadataSize;
    }, 0);

    const totalRequests = this.hitCount + this.missCount;
    const hitRate = totalRequests > 0 ? this.hitCount / totalRequests : 0;

    return {
      totalEntries: entries.length,
      hitCount: this.hitCount,
      missCount: this.missCount,
      evictionCount: this.evictionCount,
      hitRate,
      averageAge,
      memoryUsage,
      topHitKeys
    };
  }

  /**
   * Clear all entries from the cache
   */
  clear(): void {
    const entryCount = this.cache.size;
    
    this.cache.clear();
    this.versionMap.clear();
    this.tagIndex.clear();
    this.refreshCallbacks.clear();
    
    // Reset statistics
    this.hitCount = 0;
    this.missCount = 0;
    this.evictionCount = 0;

    this.emit('cacheCleared', { entriesRemoved: entryCount });
  }

  /**
   * Get all cache keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Manually trigger refresh for entries close to expiration
   */
  async refreshExpiringEntries(): Promise<{
    refreshed: string[];
    failed: string[];
  }> {
    const refreshed: string[] = [];
    const failed: string[] = [];
    
    if (!this.config.enableAutoRefresh) {
      return { refreshed, failed };
    }

    const now = new Date();
    const entries = Array.from(this.cache.entries());

    for (const [key, entry] of entries) {
      if (!entry.expiresAt || !this.refreshCallbacks.has(key)) {
        continue;
      }

      const timeToExpiration = entry.expiresAt.getTime() - now.getTime();
      const ttl = entry.expiresAt.getTime() - entry.cachedAt.getTime();
      const refreshThreshold = ttl * this.config.autoRefreshThreshold;

      if (timeToExpiration <= refreshThreshold && timeToExpiration > 0) {
        try {
          const refreshCallback = this.refreshCallbacks.get(key)!;
          const newValue = await refreshCallback();
          
          // Update the cache entry with new value and extended TTL
          this.set(key, newValue, {
            ttlMs: this.config.defaultTtlMs,
            version: Date.now().toString(),
            tags: entry.tags,
            refreshCallback
          });
          
          refreshed.push(key);
          
          this.emit('entryRefreshed', { 
            key, 
            oldVersion: entry.version,
            timeToExpiration 
          });
        } catch (error) {
          failed.push(key);
          this.emit('refreshFailed', { key, error });
        }
      }
    }

    return { refreshed, failed };
  }

  /**
   * Private methods
   */

  private enforceMaxSize(): void {
    if (this.cache.size <= this.config.maxSize) {
      return;
    }

    let entriesToRemove = this.cache.size - this.config.maxSize + 1;
    
    if (this.config.enableLru) {
      // LRU eviction: remove least recently used entries
      const entries = Array.from(this.cache.entries())
        .sort(([, a], [, b]) => a.lastAccessedAt.getTime() - b.lastAccessedAt.getTime());

      for (let i = 0; i < entriesToRemove && i < entries.length; i++) {
        const [key, entry] = entries[i];
        this.cache.delete(key);
        this.versionMap.delete(key);
        this.refreshCallbacks.delete(key);
        this.removeFromTagIndex(key, entry.tags);
        this.evictionCount++;
        
        this.emit('entryEvicted', { 
          key, 
          reason: 'lru',
          lastAccessed: entry.lastAccessedAt 
        });
      }
    } else {
      // Simple FIFO eviction: remove oldest entries by cache time
      const entries = Array.from(this.cache.entries())
        .sort(([, a], [, b]) => a.cachedAt.getTime() - b.cachedAt.getTime());

      for (let i = 0; i < entriesToRemove && i < entries.length; i++) {
        const [key, entry] = entries[i];
        this.cache.delete(key);
        this.versionMap.delete(key);
        this.refreshCallbacks.delete(key);
        this.removeFromTagIndex(key, entry.tags);
        this.evictionCount++;
        
        this.emit('entryEvicted', { 
          key, 
          reason: 'fifo',
          cachedAt: entry.cachedAt 
        });
      }
    }
  }

  private addToTagIndex(key: string, tags: string[]): void {
    for (const tag of tags) {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)!.add(key);
    }
  }

  private removeFromTagIndex(key: string, tags: string[]): void {
    for (const tag of tags) {
      const keysWithTag = this.tagIndex.get(tag);
      if (keysWithTag) {
        keysWithTag.delete(key);
        if (keysWithTag.size === 0) {
          this.tagIndex.delete(tag);
        }
      }
    }
  }

  private startAutoRefresh(): void {
    this.autoRefreshTimer = setInterval(async () => {
      try {
        const result = await this.refreshExpiringEntries();
        
        if (result.refreshed.length > 0 || result.failed.length > 0) {
          this.emit('autoRefreshCompleted', {
            refreshed: result.refreshed.length,
            failed: result.failed.length,
            timestamp: new Date()
          });
        }
      } catch (error) {
        this.emit('autoRefreshError', { error });
      }
    }, this.config.autoRefreshIntervalMs);
  }

  /**
   * Cleanup method
   */
  cleanup(): void {
    if (this.autoRefreshTimer) {
      clearInterval(this.autoRefreshTimer);
      this.autoRefreshTimer = undefined;
    }
    
    this.clear();
    this.emit('cleanup');
  }
}