import { EventEmitter } from "node:events";
import { LRUCache } from "lru-cache";

export interface CacheConfig {
  maxSize: number; // Maximum number of entries
  ttl: number; // Time to live in milliseconds
  enableCompression: boolean;
  compressionThreshold: number; // Minimum size in bytes to compress
}

export interface PerformanceConfig {
  cache: CacheConfig;
  pooling: {
    enabled: boolean;
    maxConnections: number;
    idleTimeout: number;
    acquireTimeout: number;
  };
  batching: {
    enabled: boolean;
    maxBatchSize: number;
    batchTimeout: number; // ms to wait for batch to fill
    enableSimilarityGrouping: boolean;
  };
  circuitBreaker: {
    enabled: boolean;
    failureThreshold: number;
    recoveryTimeout: number;
    healthCheckInterval: number;
  };
  memoryManagement: {
    enableGC: boolean;
    gcInterval: number;
    maxMemoryUsage: number; // MB
    memoryCheckInterval: number;
  };
}

export interface PerformanceMetrics {
  cache: {
    hitRate: number;
    missRate: number;
    evictionRate: number;
    compressionRatio: number;
  };
  pooling: {
    activeConnections: number;
    idleConnections: number;
    queuedRequests: number;
  };
  batching: {
    avgBatchSize: number;
    batchingRate: number; // % of requests that were batched
    avgBatchWaitTime: number;
  };
  circuitBreaker: {
    state: "closed" | "open" | "half-open";
    failureCount: number;
    successCount: number;
  };
  memory: {
    heapUsed: number; // MB
    heapTotal: number; // MB
    external: number; // MB
    gcCount: number;
  };
}

export interface CacheEntry {
  key: string;
  value: unknown;
  compressed: boolean;
  createdAt: Date;
  lastAccessed: Date;
  accessCount: number;
  size: number; // bytes
}

export interface BatchRequest {
  id: string;
  operation: unknown;
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
  timestamp: Date;
  similarity?: number;
}

export interface CircuitBreakerState {
  state: "closed" | "open" | "half-open";
  failureCount: number;
  successCount: number;
  lastFailureTime?: Date;
  lastSuccessTime?: Date;
}

export class MultimodalPerformanceOptimizer extends EventEmitter {
  private readonly _config: PerformanceConfig;
  private readonly _cache: LRUCache<string, CacheEntry>;
  private readonly _batchQueue = new Map<string, BatchRequest[]>();
  private readonly _circuitBreaker = new Map<string, CircuitBreakerState>();
  private readonly _connectionPool = new Map<string, any>();

  private readonly _metrics = {
    cache: {
      hits: 0,
      misses: 0,
      evictions: 0,
      totalSize: 0,
      compressedSize: 0,
    },
    batching: { totalRequests: 0, batchedRequests: 0, totalBatchWaitTime: 0 },
    circuitBreaker: { totalRequests: 0, rejectedRequests: 0 },
    memory: { gcCount: 0, lastGcTime: 0 },
  };

  private _batchTimer?: NodeJS.Timeout;
  private _memoryTimer?: NodeJS.Timeout;
  private _circuitBreakerTimer?: NodeJS.Timeout;
  private _initialized = false;

  constructor(config: Partial<PerformanceConfig> = {}) {
    super();

    this._config = this._mergeConfig(config);

    this._cache = new LRUCache<string, CacheEntry>({
      max: this._config.cache.maxSize,
      ttl: this._config.cache.ttl,
      dispose: (entry) => {
        this._metrics.cache.evictions++;
        this.emit("cache_eviction", { key: entry.key, size: entry.size });
      },
      updateAgeOnGet: true,
    });
  }

  async initialize(): Promise<void> {
    if (this._initialized) return;

    try {
      this.emit("initializing");

      // Start batching timer
      if (this._config.batching.enabled) {
        this._startBatchingTimer();
      }

      // Start memory management
      if (this._config.memoryManagement.enableGC) {
        this._startMemoryManagement();
      }

      // Start circuit breaker health checks
      if (this._config.circuitBreaker.enabled) {
        this._startCircuitBreakerHealthChecks();
      }

      this._initialized = true;
      this.emit("initialized");
    } catch (error) {
      this.emit("initialization_error", error);
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    this.emit("shutting_down");

    // Clear timers
    if (this._batchTimer) {
      clearInterval(this._batchTimer);
    }
    if (this._memoryTimer) {
      clearInterval(this._memoryTimer);
    }
    if (this._circuitBreakerTimer) {
      clearInterval(this._circuitBreakerTimer);
    }

    // Process remaining batches
    await this._flushAllBatches();

    // Close connection pools
    for (const [provider, pool] of this._connectionPool.entries()) {
      if (pool.close) {
        await pool.close();
      }
    }

    // Clear cache
    this._cache.clear();

    this.emit("shutdown_complete");
  }

  // Cache Operations
  async get(key: string): Promise<unknown> {
    const entry = this._cache.get(key);

    if (entry) {
      entry.lastAccessed = new Date();
      entry.accessCount++;
      this._metrics.cache.hits++;

      let value = entry.value;
      if (entry.compressed) {
        value = await this._decompress(value as string);
      }

      this.emit("cache_hit", { key, size: entry.size });
      return value;
    }

    this._metrics.cache.misses++;
    this.emit("cache_miss", { key });
    return undefined;
  }

  async set(key: string, value: unknown): Promise<void> {
    const serialized = JSON.stringify(value);
    let finalValue: unknown = serialized;
    let compressed = false;
    let size = Buffer.byteLength(serialized, "utf8");

    // Compress if enabled and size exceeds threshold
    if (
      this._config.cache.enableCompression &&
      size > this._config.cache.compressionThreshold
    ) {
      try {
        const compressedValue = await this._compress(serialized);
        const compressedSize = Buffer.byteLength(compressedValue, "utf8");

        if (compressedSize < size * 0.8) {
          // Only use compression if it saves at least 20%
          finalValue = compressedValue;
          compressed = true;
          this._metrics.cache.compressedSize += compressedSize;
          size = compressedSize;
        }
      } catch (error) {
        // Fall back to uncompressed if compression fails
        this.emit("compression_error", { key, error });
      }
    }

    this._metrics.cache.totalSize += size;

    const entry: CacheEntry = {
      key,
      value: finalValue,
      compressed,
      createdAt: new Date(),
      lastAccessed: new Date(),
      accessCount: 1,
      size,
    };

    this._cache.set(key, entry);
    this.emit("cache_set", { key, compressed, size });
  }

  async delete(key: string): Promise<boolean> {
    const entry = this._cache.get(key);
    if (entry) {
      this._metrics.cache.totalSize -= entry.size;
      this._cache.delete(key);
      this.emit("cache_delete", { key, size: entry.size });
      return true;
    }
    return false;
  }

  // Batching Operations
  async batchExecute<T>(
    batchKey: string,
    operation: unknown,
    executor: (batch: unknown[]) => Promise<T[]>,
  ): Promise<T> {
    if (!this._config.batching.enabled) {
      // Execute immediately if batching is disabled
      const results = await executor([operation]);
      return results[0];
    }

    return new Promise<T>((resolve, reject) => {
      const request: BatchRequest = {
        id: this._generateId(),
        operation,
        resolve: resolve as (result: unknown) => void,
        reject,
        timestamp: new Date(),
      };

      // Add similarity score if grouping is enabled
      if (this._config.batching.enableSimilarityGrouping) {
        request.similarity = this._calculateOperationSimilarity(
          operation,
          batchKey,
        );
      }

      // Add to batch queue
      if (!this._batchQueue.has(batchKey)) {
        this._batchQueue.set(batchKey, []);
      }

      const batch = this._batchQueue.get(batchKey)!;
      batch.push(request);

      this._metrics.batching.totalRequests++;

      // Execute immediately if batch is full
      if (batch.length >= this._config.batching.maxBatchSize) {
        this._executeBatch(batchKey, executor);
      }
    });
  }

  // Circuit Breaker Operations
  async executeWithCircuitBreaker<T>(
    providerKey: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    if (!this._config.circuitBreaker.enabled) {
      return operation();
    }

    const breaker = this._getCircuitBreaker(providerKey);

    if (breaker.state === "open") {
      if (this._shouldTryHalfOpen(breaker)) {
        breaker.state = "half-open";
        this.emit("circuit_breaker_half_open", { provider: providerKey });
      } else {
        this._metrics.circuitBreaker.rejectedRequests++;
        throw new Error(`Circuit breaker is OPEN for provider: ${providerKey}`);
      }
    }

    this._metrics.circuitBreaker.totalRequests++;

    try {
      const result = await operation();
      this._recordCircuitBreakerSuccess(breaker, providerKey);
      return result;
    } catch (error) {
      this._recordCircuitBreakerFailure(breaker, providerKey);
      throw error;
    }
  }

  // Connection Pooling
  async getConnection(provider: string): Promise<any> {
    if (!this._config.pooling.enabled) {
      return null; // Let provider handle its own connections
    }

    let pool = this._connectionPool.get(provider);

    if (!pool) {
      pool = this._createConnectionPool(provider);
      this._connectionPool.set(provider, pool);
    }

    return pool.acquire();
  }

  async releaseConnection(provider: string, connection: any): Promise<void> {
    if (!this._config.pooling.enabled) return;

    const pool = this._connectionPool.get(provider);
    if (pool && connection) {
      pool.release(connection);
    }
  }

  // Performance Metrics
  getMetrics(): PerformanceMetrics {
    const memUsage = process.memoryUsage();

    return {
      cache: {
        hitRate:
          this._metrics.cache.hits /
          Math.max(this._metrics.cache.hits + this._metrics.cache.misses, 1),
        missRate:
          this._metrics.cache.misses /
          Math.max(this._metrics.cache.hits + this._metrics.cache.misses, 1),
        evictionRate:
          this._metrics.cache.evictions / Math.max(this._cache.size, 1),
        compressionRatio:
          this._metrics.cache.compressedSize /
          Math.max(this._metrics.cache.totalSize, 1),
      },
      pooling: {
        activeConnections: this._getTotalActiveConnections(),
        idleConnections: this._getTotalIdleConnections(),
        queuedRequests: this._getTotalQueuedRequests(),
      },
      batching: {
        avgBatchSize: this._calculateAverageBatchSize(),
        batchingRate:
          this._metrics.batching.batchedRequests /
          Math.max(this._metrics.batching.totalRequests, 1),
        avgBatchWaitTime:
          this._metrics.batching.totalBatchWaitTime /
          Math.max(this._metrics.batching.batchedRequests, 1),
      },
      circuitBreaker: {
        state: this._getMostCriticalCircuitBreakerState(),
        failureCount: this._getTotalCircuitBreakerFailures(),
        successCount: this._getTotalCircuitBreakerSuccesses(),
      },
      memory: {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024),
        gcCount: this._metrics.memory.gcCount,
      },
    };
  }

  // Cache Management
  async clearCache(): Promise<void> {
    this._cache.clear();
    this._metrics.cache = {
      hits: 0,
      misses: 0,
      evictions: 0,
      totalSize: 0,
      compressedSize: 0,
    };
    this.emit("cache_cleared");
  }

  async optimizeCache(): Promise<void> {
    // Remove least accessed entries if memory usage is high
    const memUsage = process.memoryUsage();
    const memUsageMB = memUsage.heapUsed / 1024 / 1024;

    if (memUsageMB > this._config.memoryManagement.maxMemoryUsage * 0.8) {
      const entries = Array.from(this._cache.entries())
        .map(([key, entry]) => ({ key, entry }))
        .sort((a, b) => a.entry.accessCount - b.entry.accessCount);

      const toRemove = Math.ceil(entries.length * 0.2); // Remove 20% of entries

      for (let i = 0; i < toRemove && i < entries.length; i++) {
        this._cache.delete(entries[i].key);
      }

      this.emit("cache_optimized", { removedEntries: toRemove });
    }
  }

  private _mergeConfig(config: Partial<PerformanceConfig>): PerformanceConfig {
    return {
      cache: {
        maxSize: 1000,
        ttl: 300000, // 5 minutes
        enableCompression: true,
        compressionThreshold: 1024, // 1KB
        ...config.cache,
      },
      pooling: {
        enabled: true,
        maxConnections: 10,
        idleTimeout: 30000,
        acquireTimeout: 10000,
        ...config.pooling,
      },
      batching: {
        enabled: true,
        maxBatchSize: 5,
        batchTimeout: 100, // 100ms
        enableSimilarityGrouping: true,
        ...config.batching,
      },
      circuitBreaker: {
        enabled: true,
        failureThreshold: 5,
        recoveryTimeout: 60000, // 1 minute
        healthCheckInterval: 30000,
        ...config.circuitBreaker,
      },
      memoryManagement: {
        enableGC: true,
        gcInterval: 60000, // 1 minute
        maxMemoryUsage: 512, // MB
        memoryCheckInterval: 30000,
        ...config.memoryManagement,
      },
    };
  }

  private async _compress(data: string): Promise<string> {
    // Simple compression using gzip
    const zlib = await import("zlib");
    const compressed = zlib.gzipSync(Buffer.from(data, "utf8"));
    return compressed.toString("base64");
  }

  private async _decompress(data: string): Promise<string> {
    // Decompress gzipped data
    const zlib = await import("zlib");
    const compressed = Buffer.from(data, "base64");
    const decompressed = zlib.gunzipSync(compressed);
    return decompressed.toString("utf8");
  }

  private _startBatchingTimer(): void {
    this._batchTimer = setInterval(() => {
      // Execute all non-empty batches that have timed out
      for (const [batchKey, batch] of this._batchQueue.entries()) {
        if (batch.length > 0) {
          const oldestRequest = batch[0];
          const age = Date.now() - oldestRequest.timestamp.getTime();

          if (age >= this._config.batching.batchTimeout) {
            this._executeBatch(batchKey);
          }
        }
      }
    }, this._config.batching.batchTimeout / 2);
  }

  private _startMemoryManagement(): void {
    this._memoryTimer = setInterval(() => {
      const memUsage = process.memoryUsage();
      const memUsageMB = memUsage.heapUsed / 1024 / 1024;

      if (memUsageMB > this._config.memoryManagement.maxMemoryUsage) {
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
          this._metrics.memory.gcCount++;
          this._metrics.memory.lastGcTime = Date.now();
          this.emit("garbage_collection_forced", { memUsage: memUsageMB });
        }

        // Optimize cache
        this.optimizeCache();
      }
    }, this._config.memoryManagement.memoryCheckInterval);
  }

  private _startCircuitBreakerHealthChecks(): void {
    this._circuitBreakerTimer = setInterval(() => {
      for (const [provider, breaker] of this._circuitBreaker.entries()) {
        if (breaker.state === "open" && this._shouldTryHalfOpen(breaker)) {
          breaker.state = "half-open";
          this.emit("circuit_breaker_health_check", {
            provider,
            state: "half-open",
          });
        }
      }
    }, this._config.circuitBreaker.healthCheckInterval);
  }

  private async _executeBatch(
    batchKey: string,
    executor?: (batch: unknown[]) => Promise<unknown[]>,
  ): Promise<void> {
    const batch = this._batchQueue.get(batchKey);
    if (!batch || batch.length === 0) return;

    // Remove batch from queue
    this._batchQueue.set(batchKey, []);

    const operations = batch.map((req) => req.operation);
    const batchSize = batch.length;

    this._metrics.batching.batchedRequests += batchSize;

    // Calculate average wait time
    const now = Date.now();
    const totalWaitTime = batch.reduce(
      (sum, req) => sum + (now - req.timestamp.getTime()),
      0,
    );
    this._metrics.batching.totalBatchWaitTime += totalWaitTime;

    try {
      let results: unknown[];

      if (executor) {
        results = await executor(operations);
      } else {
        // Default batch execution - execute operations individually
        results = await Promise.all(
          operations.map(async (op: any) => {
            // This would need to be implemented based on specific operation types
            return { success: true, result: op };
          }),
        );
      }

      // Resolve all requests
      batch.forEach((request, index) => {
        if (index < results.length) {
          request.resolve(results[index]);
        } else {
          request.reject(new Error("Batch execution incomplete"));
        }
      });

      this.emit("batch_executed", {
        batchKey,
        size: batchSize,
        waitTime: totalWaitTime / batchSize,
      });
    } catch (error) {
      // Reject all requests
      batch.forEach((request) => {
        request.reject(error as Error);
      });

      this.emit("batch_execution_error", { batchKey, size: batchSize, error });
    }
  }

  private async _flushAllBatches(): Promise<void> {
    const flushPromises = Array.from(this._batchQueue.keys()).map((batchKey) =>
      this._executeBatch(batchKey),
    );

    await Promise.allSettled(flushPromises);
  }

  private _calculateOperationSimilarity(
    operation: unknown,
    batchKey: string,
  ): number {
    // Simple similarity calculation based on operation structure
    const existing = this._batchQueue.get(batchKey);
    if (!existing || existing.length === 0) return 1;

    const opStr = JSON.stringify(operation);
    const existingStr = JSON.stringify(existing[0].operation);

    // Calculate similarity based on string comparison
    return this._stringSimilarity(opStr, existingStr);
  }

  private _stringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1;

    const editDistance = this._levenshteinDistance(shorter, longer);
    return (longer.length - editDistance) / longer.length;
  }

  private _levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1)
      .fill(null)
      .map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const substitutionCost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + substitutionCost,
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  private _getCircuitBreaker(provider: string): CircuitBreakerState {
    if (!this._circuitBreaker.has(provider)) {
      this._circuitBreaker.set(provider, {
        state: "closed",
        failureCount: 0,
        successCount: 0,
      });
    }
    return this._circuitBreaker.get(provider)!;
  }

  private _shouldTryHalfOpen(breaker: CircuitBreakerState): boolean {
    if (!breaker.lastFailureTime) return false;

    const timeSinceLastFailure = Date.now() - breaker.lastFailureTime.getTime();
    return timeSinceLastFailure >= this._config.circuitBreaker.recoveryTimeout;
  }

  private _recordCircuitBreakerSuccess(
    breaker: CircuitBreakerState,
    provider: string,
  ): void {
    breaker.successCount++;
    breaker.lastSuccessTime = new Date();

    if (breaker.state === "half-open") {
      breaker.state = "closed";
      breaker.failureCount = 0;
      this.emit("circuit_breaker_closed", { provider });
    }
  }

  private _recordCircuitBreakerFailure(
    breaker: CircuitBreakerState,
    provider: string,
  ): void {
    breaker.failureCount++;
    breaker.lastFailureTime = new Date();

    if (breaker.failureCount >= this._config.circuitBreaker.failureThreshold) {
      breaker.state = "open";
      this.emit("circuit_breaker_opened", {
        provider,
        failureCount: breaker.failureCount,
      });
    }
  }

  private _createConnectionPool(provider: string): any {
    // Simplified connection pool - would use a proper pool library in production
    return {
      connections: [],
      activeConnections: 0,
      idleConnections: 0,
      queuedRequests: 0,

      acquire: () => {
        // Simplified acquire logic
        return new Promise((resolve) => {
          // Would implement proper connection pooling here
          resolve({ id: this._generateId(), provider });
        });
      },

      release: (connection: any) => {
        // Simplified release logic
      },

      close: async () => {
        // Close all connections
      },
    };
  }

  private _getTotalActiveConnections(): number {
    return Array.from(this._connectionPool.values()).reduce(
      (sum, pool) => sum + (pool.activeConnections || 0),
      0,
    );
  }

  private _getTotalIdleConnections(): number {
    return Array.from(this._connectionPool.values()).reduce(
      (sum, pool) => sum + (pool.idleConnections || 0),
      0,
    );
  }

  private _getTotalQueuedRequests(): number {
    return Array.from(this._connectionPool.values()).reduce(
      (sum, pool) => sum + (pool.queuedRequests || 0),
      0,
    );
  }

  private _calculateAverageBatchSize(): number {
    const totalBatches =
      this._metrics.batching.batchedRequests /
      Math.max(this._config.batching.maxBatchSize, 1);
    return totalBatches > 0
      ? this._metrics.batching.batchedRequests / totalBatches
      : 0;
  }

  private _getMostCriticalCircuitBreakerState():
    | "closed"
    | "open"
    | "half-open" {
    const states = Array.from(this._circuitBreaker.values()).map(
      (breaker) => breaker.state,
    );

    if (states.includes("open")) return "open";
    if (states.includes("half-open")) return "half-open";
    return "closed";
  }

  private _getTotalCircuitBreakerFailures(): number {
    return Array.from(this._circuitBreaker.values()).reduce(
      (sum, breaker) => sum + breaker.failureCount,
      0,
    );
  }

  private _getTotalCircuitBreakerSuccesses(): number {
    return Array.from(this._circuitBreaker.values()).reduce(
      (sum, breaker) => sum + breaker.successCount,
      0,
    );
  }

  private _generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
