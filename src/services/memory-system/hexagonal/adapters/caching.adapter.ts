/**
 * Caching Adapter
 * In-memory caching implementation with LRU eviction
 */

import {
  _ICachingPort,
  CacheEntry,
  CacheStats,
  CacheFilter,
} from "../ports/caching.port";

interface LRUNode<T = any> {
  key: string;
  value: T;
  ttl?: number;
  tags?: string[];
  metadata?: Record<string, any>;
  createdAt: Date;
  _expiresAt?: Date;
  prev?: LRUNode<T>;
  next?: LRUNode<T>;
  accessCount: number;
  lastAccessedAt: Date;
}

export class InMemoryCachingAdapter implements ICachingPort {
  private cache = new Map<string, LRUNode>();
  private head: LRUNode | null = null;
  private tail: LRUNode | null = null;
  private maxSize: number;
  private _stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    totalSets: 0,
    totalDeletes: 0,
  };

  constructor(_maxSize: number = 10000) {
    this._maxSize = _maxSize;
  }

  async _set<T>(
    _key: string,
    value: T,
    ttl?: number,
    tags?: string[],
  ): Promise<void> {
    const _now = new Date();
    const _expiresAt = ttl ? new Date(_now.getTime() + ttl * 1000) : undefined;

    // Remove existing entry if it exists
    if (this.cache.has(_key)) {
      await this.delete(_key);
    }

    const _node: LRUNode<T> = {
      key: "",
      value,
      ttl,
      tags,
      createdAt: _now,
      _expiresAt,
      accessCount: 0,
      lastAccessedAt: _now,
    };

    this.cache.set(_key, _node);
    this.moveToHead(_node);

    // Check if we need to evict
    if (this.cache.size > this.maxSize) {
      await this.evictLRU();
    }

    this.stats.totalSets++;
  }

  async get<T>(key: string): Promise<T | null> {
    const _node = this.cache.get(key) as LRUNode<T> | undefined;

    if (!_node) {
      this.stats.misses++;
      return null;
    }

    // Check if expired
    if (_node.expiresAt && _node.expiresAt < new Date()) {
      await this.delete(key);
      this.stats.misses++;
      return null;
    }

    // Update access info
    _node.accessCount++;
    node.lastAccessedAt = new Date();

    // Move to head (most recently used)
    this.moveToHead(_node);

    this.stats.hits++;
    return _node.value;
  }

  async has(key: string): Promise<boolean> {
    const _node = this.cache.get(key);

    if (!_node) {
      return false;
    }

    // Check if expired
    if (_node.expiresAt && _node.expiresAt < new Date()) {
      await this.delete(key);
      return false;
    }

    return true;
  }

  async delete(key: string): Promise<boolean> {
    const _node = this.cache.get(key);

    if (!_node) {
      return false;
    }

    this.removeNode(_node);
    this.cache.delete(key);
    this.stats.totalDeletes++;

    return true;
  }

  async deleteMany(_keys: string[]): Promise<number> {
    let deleted = 0;

    for (const key of _keys) {
      if (await this.delete(key)) {
        deleted++;
      }
    }

    return deleted;
  }

  async deleteByPattern(pattern: string): Promise<number> {
    const _regex = new RegExp(pattern.replace(/\*/g, ".*"));
    const keysToDelete: string[] = [];

    for (const key of this.cache.keys()) {
      if (_regex.test(key)) {
        keysToDelete.push(key);
      }
    }

    return await this.deleteMany(keysToDelete);
  }

  async deleteByTags(tags: string[]): Promise<number> {
    const keysToDelete: string[] = [];

    for (const [key, _node] of this.cache.entries()) {
      if (node.tags && tags.some((tag) => node.tags!.includes(tag))) {
        keysToDelete.push(key);
      }
    }

    return await this.deleteMany(keysToDelete);
  }

  async getMany<T>(_keys: string[]): Promise<Array<T | null>> {
    const results: Array<T | null> = [];

    for (const key of _keys) {
      results.push(await this.get<T>(key));
    }

    return results;
  }

  async setMany<T>(
    entries: Array<{ key: string; value: T; ttl?: number; tags?: string[] }>,
  ): Promise<void> {
    for (const entry of entries) {
      await this.set(entry.key, entry.value, entry.ttl, entry.tags);
    }
  }

  async getKeys(pattern?: string): Promise<string[]> {
    const _keys = Array.from(this.cache._keys());

    if (!pattern) {
      return _keys;
    }

    const _regex = new RegExp(pattern.replace(/\*/g, ".*"));
    return _keys.filter((key) => _regex.test(key));
  }

  async getStats(): Promise<CacheStats> {
    const _totalRequests = this.stats.hits + this.stats.misses;
    const _hitRate = _totalRequests > 0 ? this.stats.hits / _totalRequests : 0;
    const _missRate =
      _totalRequests > 0 ? this.stats.misses / _totalRequests : 0;

    // Calculate memory usage (rough estimation)
    let memoryUsage = 0;
    for (const _node of this.cache.values()) {
      memoryUsage += JSON.stringify(_node.value).length;
    }

    return {
      totalKeys: this.cache.size,
      _hitRate,
      _missRate,
      memoryUsage,
      totalHits: this.stats.hits,
      totalMisses: this.stats.misses,
      evictionCount: this.stats.evictions,
    };
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.head = null;
    this.tail = null;
  }

  async clearExpired(): Promise<number> {
    const _now = new Date();
    const expiredKeys: string[] = [];

    for (const [key, _node] of this.cache.entries()) {
      if (node.expiresAt && node.expiresAt < _now) {
        expiredKeys.push(key);
      }
    }

    return await this.deleteMany(expiredKeys);
  }

  async expire(_key: string, ttl: number): Promise<boolean> {
    const _node = this.cache.get(_key);

    if (!_node) {
      return false;
    }

    _node.ttl = ttl;
    node.expiresAt = new Date(Date.now() + ttl * 1000);

    return true;
  }

  async getTTL(key: string): Promise<number | null> {
    const _node = this.cache.get(key);

    if (!_node || !_node.expiresAt) {
      return null;
    }

    const _remaining = Math.max(0, _node.expiresAt.getTime() - Date.now());
    return Math.ceil(_remaining / 1000);
  }

  async increment(_key: string, amount: number = 1): Promise<number> {
    const _current = await this.get<number>(_key);
    const _newValue = (_current || 0) + amount;
    await this.set(_key, _newValue);
    return _newValue;
  }

  async decrement(_key: string, amount: number = 1): Promise<number> {
    return await this.increment(_key, -amount);
  }

  async sadd(_key: string, ...values: string[]): Promise<number> {
    const _currentSet =
      (await this.get<Set<string>>(_key)) || new Set<string>();
    const _initialSize = _currentSet.size;

    values.forEach((value) => _currentSet.add(value));
    await this.set(_key, _currentSet);

    return _currentSet.size - _initialSize;
  }

  async srem(_key: string, ...values: string[]): Promise<number> {
    const _currentSet = await this.get<Set<string>>(_key);

    if (!_currentSet) {
      return 0;
    }

    const _initialSize = _currentSet.size;
    values.forEach((value) => _currentSet.delete(value));

    if (_currentSet.size === 0) {
      await this.delete(_key);
    } else {
      await this.set(_key, _currentSet);
    }

    return _initialSize - _currentSet.size;
  }

  async smembers(key: string): Promise<string[]> {
    const _set = await this.get<Set<string>>(key);
    return _set ? Array.from(_set) : [];
  }

  async sismember(_key: string, value: string): Promise<boolean> {
    const _set = await this.get<Set<string>>(_key);
    return _set ? _set.has(value) : false;
  }

  async getEntriesByFilter(
    _filter: CacheFilter,
    limit?: number,
  ): Promise<CacheEntry[]> {
    const entries: CacheEntry[] = [];
    const _now = new Date();

    for (const [key, _node] of this.cache.entries()) {
      // Apply filters
      if (_filter.pattern) {
        const _regex = new RegExp(_filter.pattern.replace(/\*/g, ".*"));
        if (!_regex.test(key)) continue;
      }

      if (_filter.keyPrefix && !key.startsWith(_filter.keyPrefix)) {
        continue;
      }

      if (_filter.tags && _filter.tags.length > 0) {
        if (
          !node.tags ||
          !_filter.tags.every((tag) => node.tags!.includes(tag))
        ) {
          continue;
        }
      }

      if (_filter.expired !== undefined) {
        const _isExpired = node.expiresAt && node.expiresAt < _now;
        if (_filter.expired !== _isExpired) {
          continue;
        }
      }

      entries.push({
        key: node.key,
        value: node.value,
        ttl: node.ttl,
        tags: node.tags,
        metadata: node.metadata,
        createdAt: node.createdAt,
        _expiresAt: node.expiresAt,
      });

      if (limit && entries.length >= limit) {
        break;
      }
    }

    return entries;
  }

  async warmUp(
    entries: Array<{ key: string; value: any; ttl?: number }>,
  ): Promise<void> {
    for (const entry of entries) {
      await this.set(entry.key, entry.value, entry.ttl);
    }
  }

  async healthCheck(): Promise<{
    isHealthy: boolean;
    details?: Record<string, any>;
  }> {
    const _stats = await this.getStats();

    return {
      isHealthy: true,
      details: {
        cacheSize: this.cache.size,
        maxSize: this.maxSize,
        utilization: this.cache.size / this.maxSize,
        _hitRate: _stats.hitRate,
        memoryUsage: _stats.memoryUsage,
      },
    };
  }

  // Private helper methods
  private moveToHead(_node: LRUNode): void {
    this.removeNode(_node);
    this.addToHead(_node);
  }

  private removeNode(_node: LRUNode): void {
    if (_node.prev) {
      _node.prev.next = _node.next;
    } else {
      this.head = _node.next;
    }

    if (_node.next) {
      _node.next.prev = _node.prev;
    } else {
      this.tail = _node.prev;
    }
  }

  private addToHead(_node: LRUNode): void {
    node.prev = null;
    node.next = this.head;

    if (this.head) {
      this.head.prev = _node;
    }

    this.head = _node;

    if (!this.tail) {
      this.tail = _node;
    }
  }

  private async evictLRU(): Promise<void> {
    if (!this.tail) {
      return;
    }

    const _keyToEvict = this.tail.key;
    await this.delete(_keyToEvict);
    this.stats.evictions++;
  }
}
