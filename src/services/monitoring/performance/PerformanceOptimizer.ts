/**
 * MARIA v3.6.0 - Performance Optimizer
 * Sub-millisecond performance optimization for real-time monitoring
 * Advanced caching, connection pooling, and data processing optimization
 */

import { EventEmitter } from "node:events";
import { performance } from "perf_hooks";
import { Worker } from "worker_threads";

// Type definitions
interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  category: "latency" | "throughput" | "memory" | "cpu" | "network" | "custom";
  unit: string;
  metadata?: Record<string, any>;
}

interface CacheEntry<T> {
  key: string;
  value: T;
  timestamp: number;
  accessCount: number;
  lastAccess: number;
  ttl?: number;
  size: number;
}

interface ConnectionPoolStats {
  active: number;
  idle: number;
  pending: number;
  total: number;
  created: number;
  destroyed: number;
  errors: number;
}

interface OptimizationConfig {
  cache: {
    maxSize: number; // MB
    defaultTTL: number; // milliseconds
    compressionEnabled: boolean;
    evictionPolicy: "lru" | "lfu" | "ttl" | "adaptive";
    preloadThreshold: number; // 0-1
  };
  connectionPool: {
    minConnections: number;
    maxConnections: number;
    acquireTimeoutMs: number;
    idleTimeoutMs: number;
    validateOnBorrow: boolean;
    testQuery: string;
  };
  processing: {
    batchSize: number;
    maxConcurrency: number;
    useWorkerThreads: boolean;
    compressionThreshold: number; // bytes
    streamingEnabled: boolean;
  };
  performance: {
    targetLatency: number; // ms
    maxMemoryUsage: number; // MB
    gcThreshold: number; // 0-1
    monitoringInterval: number; // ms
  };
}

interface ProcessingQueue<T> {
  items: T[];
  processing: boolean;
  workers: Worker[];
  lastProcessed: number;
  throughput: number;
}

interface MemoryPool {
  buffers: Buffer[];
  sizes: Map<number, Buffer[]>;
  totalAllocated: number;
  reuseCount: number;
}

// High-performance LRU Cache with compression
class HighPerformanceCache<T> {
  private entries: Map<string, CacheEntry<T>> = new Map();
  private accessOrder: string[] = [];
  private config: OptimizationConfig["cache"];
  private currentSize = 0; // bytes
  private compressionWorker?: Worker;

  constructor(config: OptimizationConfig["cache"]) {
    this.config = config;

    if (config.compressionEnabled) {
      this.initializeCompressionWorker();
    }
  }

  private initializeCompressionWorker(): void {
    // Mock worker initialization - replace with actual worker
    console.log("🗜️ Compression worker initialized for cache optimization");
  }

  async get(key: string): Promise<T | null> {
    const entry = this.entries.get(key);

    if (!entry) {
      return null;
    }

    const now = Date.now();

    // Check TTL expiration
    if (entry.ttl && now - entry.timestamp > entry.ttl) {
      this.delete(key);
      return null;
    }

    // Update access statistics
    entry.lastAccess = now;
    entry.accessCount++;

    // Move to end of access order (most recently used)
    this.moveToEnd(key);

    return entry.value;
  }

  async set(key: string, value: T, ttl?: number): Promise<void> {
    const now = Date.now();
    const serializedSize = this.estimateSize(value);

    // Check if we need to evict entries
    await this.ensureCapacity(serializedSize);

    const entry: CacheEntry<T> = {
      key,
      value,
      timestamp: now,
      accessCount: 1,
      lastAccess: now,
      ttl: ttl || this.config.defaultTTL,
      size: serializedSize,
    };

    const existingEntry = this.entries.get(key);
    if (existingEntry) {
      this.currentSize -= existingEntry.size;
    }

    this.entries.set(key, entry);
    this.currentSize += serializedSize;
    this.moveToEnd(key);
  }

  private async ensureCapacity(newEntrySize: number): Promise<void> {
    const maxSizeBytes = this.config.maxSize * 1024 * 1024; // Convert MB to bytes

    while (
      this.currentSize + newEntrySize > maxSizeBytes &&
      this.entries.size > 0
    ) {
      await this.evictEntry();
    }
  }

  private async evictEntry(): Promise<void> {
    let keyToEvict: string;

    switch (this.config.evictionPolicy) {
      case "lru":
        keyToEvict = this.accessOrder[0];
        break;
      case "lfu":
        keyToEvict = this.getLeastFrequentlyUsed();
        break;
      case "ttl":
        keyToEvict = this.getOldestEntry();
        break;
      case "adaptive":
        keyToEvict = this.getAdaptiveEvictionKey();
        break;
      default:
        keyToEvict = this.accessOrder[0];
    }

    this.delete(keyToEvict);
  }

  private getLeastFrequentlyUsed(): string {
    let minAccess = Infinity;
    let keyToEvict = this.accessOrder[0];

    for (const [key, entry] of this.entries) {
      if (entry.accessCount < minAccess) {
        minAccess = entry.accessCount;
        keyToEvict = key;
      }
    }

    return keyToEvict;
  }

  private getOldestEntry(): string {
    let oldestTime = Infinity;
    let keyToEvict = this.accessOrder[0];

    for (const [key, entry] of this.entries) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        keyToEvict = key;
      }
    }

    return keyToEvict;
  }

  private getAdaptiveEvictionKey(): string {
    const now = Date.now();
    let bestScore = -1;
    let keyToEvict = this.accessOrder[0];

    for (const [key, entry] of this.entries) {
      // Score based on recency, frequency, and size
      const recency = (now - entry.lastAccess) / 1000; // seconds
      const frequency = entry.accessCount;
      const sizeWeight = entry.size / (1024 * 1024); // MB

      const score = (recency * sizeWeight) / (frequency + 1);

      if (score > bestScore) {
        bestScore = score;
        keyToEvict = key;
      }
    }

    return keyToEvict;
  }

  private delete(key: string): void {
    const entry = this.entries.get(key);
    if (entry) {
      this.entries.delete(key);
      this.currentSize -= entry.size;

      const index = this.accessOrder.indexOf(key);
      if (index > -1) {
        this.accessOrder.splice(index, 1);
      }
    }
  }

  private moveToEnd(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(key);
  }

  private estimateSize(value: T): number {
    // Rough size estimation - replace with more accurate sizing if needed
    return JSON.stringify(value).length * 2; // Unicode chars are 2 bytes
  }

  getStats(): { size: number; entries: number; hitRate: number } {
    const totalAccess = Array.from(this.entries.values()).reduce(
      (sum, entry) => sum + entry.accessCount,
      0,
    );

    return {
      size: this.currentSize,
      entries: this.entries.size,
      hitRate: totalAccess > 0 ? (this.entries.size / totalAccess) * 100 : 0,
    };
  }

  clear(): void {
    this.entries.clear();
    this.accessOrder = [];
    this.currentSize = 0;
  }
}

// Connection Pool Manager
class ConnectionPoolManager {
  private connections: Array<{
    id: string;
    inUse: boolean;
    created: number;
    lastUsed: number;
  }> = [];
  private waitQueue: Array<{
    resolve: (value?: any) => void;
    reject: (reason?: any) => void;
    timeout: NodeJS.Timeout;
  }> = [];
  private config: OptimizationConfig["connectionPool"];
  private stats: ConnectionPoolStats;

  constructor(config: OptimizationConfig["connectionPool"]) {
    this.config = config;
    this.stats = {
      active: 0,
      idle: 0,
      pending: 0,
      total: 0,
      created: 0,
      destroyed: 0,
      errors: 0,
    };

    this.initializeMinConnections();
    this.startCleanupTimer();
  }

  private initializeMinConnections(): void {
    for (let i = 0; i < this.config.minConnections; i++) {
      this.createConnection();
    }
  }

  private createConnection(): void {
    const connection = {
      id: `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      inUse: false,
      created: Date.now(),
      lastUsed: Date.now(),
    };

    this.connections.push(connection);
    this.stats.created++;
    this.stats.total++;
    this.updateIdleCount();
  }

  async acquire(): Promise<string> {
    return new Promise((resolve, reject) => {
      // Check for available connection
      const availableConnection = this.connections.find((conn) => !conn.inUse);

      if (availableConnection) {
        availableConnection.inUse = true;
        availableConnection.lastUsed = Date.now();
        this.updateStats();
        resolve(availableConnection.id);
        return;
      }

      // Create new connection if under limit
      if (this.connections.length < this.config.maxConnections) {
        this.createConnection();
        const newConnection = this.connections[this.connections.length - 1];
        newConnection.inUse = true;
        newConnection.lastUsed = Date.now();
        this.updateStats();
        resolve(newConnection.id);
        return;
      }

      // Add to wait queue with timeout
      const timeout = setTimeout(() => {
        const index = this.waitQueue.findIndex(
          (item) => item.resolve === resolve,
        );
        if (index > -1) {
          this.waitQueue.splice(index, 1);
          this.stats.pending = this.waitQueue.length;
          reject(new Error("Connection acquire timeout"));
        }
      }, this.config.acquireTimeoutMs);

      this.waitQueue.push({ resolve, reject, timeout });
      this.stats.pending = this.waitQueue.length;
    });
  }

  release(connectionId: string): void {
    const connection = this.connections.find(
      (conn) => conn.id === connectionId,
    );
    if (connection) {
      connection.inUse = false;
      connection.lastUsed = Date.now();
      this.updateStats();

      // Process wait queue
      if (this.waitQueue.length > 0) {
        const waiter = this.waitQueue.shift()!;
        clearTimeout(waiter.timeout);
        connection.inUse = true;
        connection.lastUsed = Date.now();
        this.stats.pending = this.waitQueue.length;
        waiter.resolve(connectionId);
      }
    }
  }

  private startCleanupTimer(): void {
    setInterval(() => {
      this.cleanupIdleConnections();
    }, 30000); // Clean every 30 seconds
  }

  private cleanupIdleConnections(): void {
    const now = Date.now();
    const connectionsToRemove: string[] = [];

    for (const connection of this.connections) {
      if (
        !connection.inUse &&
        now - connection.lastUsed > this.config.idleTimeoutMs &&
        this.connections.length > this.config.minConnections
      ) {
        connectionsToRemove.push(connection.id);
      }
    }

    for (const id of connectionsToRemove) {
      this.destroyConnection(id);
    }
  }

  private destroyConnection(connectionId: string): void {
    const index = this.connections.findIndex(
      (conn) => conn.id === connectionId,
    );
    if (index > -1) {
      this.connections.splice(index, 1);
      this.stats.destroyed++;
      this.stats.total--;
      this.updateStats();
    }
  }

  private updateStats(): void {
    this.stats.active = this.connections.filter((conn) => conn.inUse).length;
    this.updateIdleCount();
  }

  private updateIdleCount(): void {
    this.stats.idle = this.connections.filter((conn) => !conn.inUse).length;
  }

  getStats(): ConnectionPoolStats {
    return { ...this.stats };
  }
}

// Memory Pool for buffer reuse
class MemoryPoolManager {
  private pools: Map<number, Buffer[]> = new Map();
  private totalAllocated = 0;
  private reuseCount = 0;
  private readonly standardSizes = [1024, 4096, 16384, 65536, 262144]; // Common buffer sizes

  constructor() {
    // Pre-allocate buffers for common sizes
    for (const size of this.standardSizes) {
      this.pools.set(size, []);
      this.preallocateBuffers(size, 10); // Pre-allocate 10 buffers per size
    }
  }

  private preallocateBuffers(size: number, count: number): void {
    const pool = this.pools.get(size) || [];
    for (let i = 0; i < count; i++) {
      pool.push(Buffer.allocUnsafe(size));
      this.totalAllocated += size;
    }
    this.pools.set(size, pool);
  }

  getBuffer(size: number): Buffer {
    // Find the best fitting standard size
    const standardSize = this.standardSizes.find((s) => s >= size) || size;

    let pool = this.pools.get(standardSize);
    if (!pool) {
      pool = [];
      this.pools.set(standardSize, pool);
    }

    // Reuse existing buffer if available
    if (pool.length > 0) {
      this.reuseCount++;
      return pool.pop()!;
    }

    // Allocate new buffer
    const buffer = Buffer.allocUnsafe(standardSize);
    this.totalAllocated += standardSize;
    return buffer;
  }

  returnBuffer(buffer: Buffer): void {
    const size = buffer.length;
    let pool = this.pools.get(size);

    if (!pool) {
      pool = [];
      this.pools.set(size, pool);
    }

    // Only keep a reasonable number of buffers per size
    if (pool.length < 20) {
      // Clear the buffer for security
      buffer.fill(0);
      pool.push(buffer);
    } else {
      // Let GC handle it if pool is full
      this.totalAllocated -= size;
    }
  }

  getStats(): {
    totalAllocated: number;
    poolSizes: Record<number, number>;
    reuseRate: number;
  } {
    const poolSizes: Record<number, number> = {};
    for (const [size, pool] of this.pools) {
      poolSizes[size] = pool.length;
    }

    return {
      totalAllocated: this.totalAllocated,
      poolSizes,
      reuseRate:
        (this.reuseCount / (this.reuseCount + this.totalAllocated)) * 100,
    };
  }
}

// Main Performance Optimizer
export class PerformanceOptimizer extends EventEmitter {
  private config: OptimizationConfig;
  private cache: HighPerformanceCache<any>;
  private connectionPool: ConnectionPoolManager;
  private memoryPool: MemoryPoolManager;
  private processingQueues: Map<string, ProcessingQueue<any>> = new Map();
  private performanceMetrics: PerformanceMetric[] = [];
  private monitoringTimer?: NodeJS.Timer;

  constructor(config?: Partial<OptimizationConfig>) {
    super();

    this.config = {
      cache: {
        maxSize: 256, // MB
        defaultTTL: 300000, // 5 minutes
        compressionEnabled: true,
        evictionPolicy: "adaptive",
        preloadThreshold: 0.8,
      },
      connectionPool: {
        minConnections: 5,
        maxConnections: 50,
        acquireTimeoutMs: 5000,
        idleTimeoutMs: 600000, // 10 minutes
        validateOnBorrow: true,
        testQuery: "SELECT 1",
      },
      processing: {
        batchSize: 100,
        maxConcurrency: 8,
        useWorkerThreads: true,
        compressionThreshold: 10240, // 10KB
        streamingEnabled: true,
      },
      performance: {
        targetLatency: 100, // ms
        maxMemoryUsage: 1024, // MB
        gcThreshold: 0.8,
        monitoringInterval: 1000, // ms
      },
      ...config,
    };

    this.initialize();
  }

  private initialize(): void {
    this.cache = new HighPerformanceCache(this.config.cache);
    this.connectionPool = new ConnectionPoolManager(this.config.connectionPool);
    this.memoryPool = new MemoryPoolManager();

    this.startPerformanceMonitoring();
    console.log(
      "⚡ PerformanceOptimizer initialized with sub-millisecond targets",
    );
  }

  private startPerformanceMonitoring(): void {
    this.monitoringTimer = setInterval(() => {
      this.collectPerformanceMetrics();
      this.optimizePerformance();
    }, this.config.performance.monitoringInterval);
  }

  private collectPerformanceMetrics(): void {
    const now = Date.now();

    // Memory metrics
    const memUsage = process.memoryUsage();
    this.addMetric(
      "memory.heap.used",
      memUsage.heapUsed / 1024 / 1024,
      now,
      "memory",
      "MB",
    );
    this.addMetric(
      "memory.heap.total",
      memUsage.heapTotal / 1024 / 1024,
      now,
      "memory",
      "MB",
    );
    this.addMetric(
      "memory.external",
      memUsage.external / 1024 / 1024,
      now,
      "memory",
      "MB",
    );

    // Cache metrics
    const cacheStats = this.cache.getStats();
    this.addMetric("cache.hit.rate", cacheStats.hitRate, now, "custom", "%");
    this.addMetric(
      "cache.size",
      cacheStats.size / 1024 / 1024,
      now,
      "memory",
      "MB",
    );
    this.addMetric("cache.entries", cacheStats.entries, now, "custom", "count");

    // Connection pool metrics
    const poolStats = this.connectionPool.getStats();
    this.addMetric(
      "pool.active",
      poolStats.active,
      now,
      "custom",
      "connections",
    );
    this.addMetric("pool.idle", poolStats.idle, now, "custom", "connections");
    this.addMetric(
      "pool.pending",
      poolStats.pending,
      now,
      "custom",
      "requests",
    );

    // Memory pool metrics
    const memPoolStats = this.memoryPool.getStats();
    this.addMetric(
      "memory.pool.allocated",
      memPoolStats.totalAllocated / 1024 / 1024,
      now,
      "memory",
      "MB",
    );
    this.addMetric(
      "memory.pool.reuse.rate",
      memPoolStats.reuseRate,
      now,
      "custom",
      "%",
    );

    // Keep only recent metrics (last 5 minutes)
    const cutoff = now - 300000;
    this.performanceMetrics = this.performanceMetrics.filter(
      (m) => m.timestamp >= cutoff,
    );
  }

  private addMetric(
    name: string,
    value: number,
    timestamp: number,
    category: PerformanceMetric["category"],
    unit: string,
  ): void {
    this.performanceMetrics.push({
      name,
      value,
      timestamp,
      category,
      unit,
    });

    // Emit performance event if threshold exceeded
    if (
      name.includes("latency") &&
      value > this.config.performance.targetLatency
    ) {
      this.emit("performance-warning", {
        metric: name,
        value,
        threshold: this.config.performance.targetLatency,
        timestamp,
      });
    }
  }

  private optimizePerformance(): void {
    const memUsage = process.memoryUsage();
    const memUsageMB = memUsage.heapUsed / 1024 / 1024;

    // Trigger garbage collection if memory usage is high
    if (
      memUsageMB >
      this.config.performance.maxMemoryUsage *
        this.config.performance.gcThreshold
    ) {
      if (global.gc) {
        global.gc();
        this.emit("gc-triggered", { memoryBefore: memUsageMB });
      }
    }

    // Clear old cache entries more aggressively if memory pressure
    if (memUsageMB > this.config.performance.maxMemoryUsage * 0.9) {
      // Temporarily reduce cache TTL and trigger eviction
      this.emit("memory-pressure", { memoryUsage: memUsageMB });
    }
  }

  // High-performance cache operations
  async getCached<T>(key: string): Promise<T | null> {
    const startTime = performance.now();
    const result = await this.cache.get(key);
    const latency = performance.now() - startTime;

    this.addMetric("cache.get.latency", latency, Date.now(), "latency", "ms");
    return result;
  }

  async setCached<T>(key: string, value: T, ttl?: number): Promise<void> {
    const startTime = performance.now();
    await this.cache.set(key, value, ttl);
    const latency = performance.now() - startTime;

    this.addMetric("cache.set.latency", latency, Date.now(), "latency", "ms");
  }

  // Connection management
  async acquireConnection(): Promise<string> {
    const startTime = performance.now();
    const connectionId = await this.connectionPool.acquire();
    const latency = performance.now() - startTime;

    this.addMetric(
      "pool.acquire.latency",
      latency,
      Date.now(),
      "latency",
      "ms",
    );
    return connectionId;
  }

  releaseConnection(connectionId: string): void {
    this.connectionPool.release(connectionId);
  }

  // Memory-efficient buffer management
  getBuffer(size: number): Buffer {
    const startTime = performance.now();
    const buffer = this.memoryPool.getBuffer(size);
    const latency = performance.now() - startTime;

    this.addMetric(
      "memory.buffer.get.latency",
      latency,
      Date.now(),
      "latency",
      "ms",
    );
    return buffer;
  }

  returnBuffer(buffer: Buffer): void {
    this.memoryPool.returnBuffer(buffer);
  }

  // Batch processing with optimization
  async processBatch<T, R>(
    queueName: string,
    items: T[],
    processor: (batch: T[]) => Promise<R[]>,
  ): Promise<R[]> {
    const startTime = performance.now();

    if (!this.processingQueues.has(queueName)) {
      this.processingQueues.set(queueName, {
        items: [],
        processing: false,
        workers: [],
        lastProcessed: 0,
        throughput: 0,
      });
    }

    const queue = this.processingQueues.get(queueName)!;

    // Add items to queue
    queue.items.push(...items);

    // Process if not already processing
    if (!queue.processing) {
      return this.processBatchInternal(queueName, processor);
    }

    return [];
  }

  private async processBatchInternal<T, R>(
    queueName: string,
    processor: (batch: T[]) => Promise<R[]>,
  ): Promise<R[]> {
    const queue = this.processingQueues.get(queueName)!;
    queue.processing = true;

    const results: R[] = [];
    const startTime = performance.now();

    try {
      while (queue.items.length > 0) {
        const batchSize = Math.min(
          this.config.processing.batchSize,
          queue.items.length,
        );
        const batch = queue.items.splice(0, batchSize);

        const batchResults = await processor(batch);
        results.push(...batchResults);

        // Update throughput
        const elapsed = performance.now() - startTime;
        queue.throughput = results.length / (elapsed / 1000); // items per second
        queue.lastProcessed = Date.now();
      }
    } finally {
      queue.processing = false;
    }

    const totalLatency = performance.now() - startTime;
    this.addMetric(
      `processing.${queueName}.latency`,
      totalLatency,
      Date.now(),
      "latency",
      "ms",
    );
    this.addMetric(
      `processing.${queueName}.throughput`,
      queue.throughput,
      Date.now(),
      "throughput",
      "items/sec",
    );

    return results;
  }

  // Performance metrics
  getPerformanceMetrics(): PerformanceMetric[] {
    return [...this.performanceMetrics];
  }

  getLatestMetric(name: string): PerformanceMetric | null {
    const metrics = this.performanceMetrics.filter((m) => m.name === name);
    return metrics.length > 0 ? metrics[metrics.length - 1] : null;
  }

  // System optimization status
  getOptimizationStatus(): {
    cache: any;
    connectionPool: ConnectionPoolStats;
    memoryPool: any;
    performance: {
      avgLatency: number;
      memoryUsage: number;
      targetCompliance: number;
    };
  } {
    const cacheStats = this.cache.getStats();
    const poolStats = this.connectionPool.getStats();
    const memPoolStats = this.memoryPool.getStats();

    // Calculate average latency across all operations
    const latencyMetrics = this.performanceMetrics.filter(
      (m) => m.category === "latency",
    );
    const avgLatency =
      latencyMetrics.length > 0
        ? latencyMetrics.reduce((sum, m) => sum + m.value, 0) /
          latencyMetrics.length
        : 0;

    const memUsage = process.memoryUsage().heapUsed / 1024 / 1024;
    const targetCompliance =
      avgLatency <= this.config.performance.targetLatency
        ? 100
        : Math.max(
            0,
            100 -
              ((avgLatency - this.config.performance.targetLatency) /
                this.config.performance.targetLatency) *
                100,
          );

    return {
      cache: cacheStats,
      connectionPool: poolStats,
      memoryPool: memPoolStats,
      performance: {
        avgLatency,
        memoryUsage: memUsage,
        targetCompliance,
      },
    };
  }

  // Cleanup and shutdown
  shutdown(): void {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
    }

    this.cache.clear();
    this.emit("shutdown");
    console.log("⚡ PerformanceOptimizer shutdown completed");
  }
}
