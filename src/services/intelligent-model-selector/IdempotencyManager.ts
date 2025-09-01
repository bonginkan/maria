/**
 * Idempotency Manager - Ensures duplicate requests produce consistent results
 * Handles request deduplication, result caching, and idempotency key management
 */

import { EventEmitter } from 'events';
import { createHash } from 'crypto';

export interface IdempotentRequest {
  idempotencyKey: string;
  traceId: string;
  requestHash: string;
  userId?: string;
  createdAt: Date;
  expiresAt: Date;
}

export interface IdempotentResponse {
  traceId: string;
  result: any;
  statusCode: number;
  headers?: Record<string, string>;
  metadata: {
    generatedAt: Date;
    expiresAt: Date;
    hitCount: number;
    lastHitAt: Date;
  };
}

export interface IdempotencyConfig {
  /** Default TTL for idempotency keys in milliseconds */
  defaultTtlMs: number;
  /** Maximum size of in-memory cache */
  maxCacheSize: number;
  /** Interval for cleanup of expired entries */
  cleanupIntervalMs: number;
  /** Whether to enable request content hashing for additional verification */
  enableContentHashing: boolean;
  /** Whether to enable persistence to external storage */
  enablePersistence: boolean;
  /** Maximum request body size to hash (in bytes) */
  maxHashSize: number;
}

export interface DuplicateRequestInfo {
  originalTraceId: string;
  duplicateTraceId: string;
  idempotencyKey: string;
  timeSinceOriginal: number;
  requestMatches: boolean;
}

export class IdempotencyManager extends EventEmitter {
  private readonly requestCache = new Map<string, IdempotentRequest>();
  private readonly responseCache = new Map<string, IdempotentResponse>();
  private readonly cleanupTimer: NodeJS.Timeout;
  private readonly requestContentHashes = new Map<string, string>();

  constructor(
    private readonly config: IdempotencyConfig = {
      defaultTtlMs: 3600000, // 1 hour
      maxCacheSize: 10000,
      cleanupIntervalMs: 300000, // 5 minutes
      enableContentHashing: true,
      enablePersistence: false,
      maxHashSize: 1048576 // 1MB
    }
  ) {
    super();
    
    // Start periodic cleanup
    this.cleanupTimer = setInterval(() => {
      this.performCleanup();
    }, this.config.cleanupIntervalMs);
  }

  /**
   * Register a new idempotent request
   * Returns information about duplicate detection
   */
  registerRequest(
    idempotencyKey: string,
    traceId: string,
    requestContent?: any,
    userId?: string,
    customTtlMs?: number
  ): {
    isDuplicate: boolean;
    duplicateInfo?: DuplicateRequestInfo;
  } {
    if (!this.isValidIdempotencyKey(idempotencyKey)) {
      throw new Error('Invalid idempotency key format');
    }

    const now = new Date();
    const ttl = customTtlMs || this.config.defaultTtlMs;
    const expiresAt = new Date(now.getTime() + ttl);
    
    // Check if we've seen this idempotency key before
    const existingRequest = this.requestCache.get(idempotencyKey);
    
    if (existingRequest) {
      // Check if the existing request has expired
      if (existingRequest.expiresAt < now) {
        // Expired, treat as new request
        this.requestCache.delete(idempotencyKey);
        this.responseCache.delete(idempotencyKey);
        this.requestContentHashes.delete(idempotencyKey);
      } else {
        // Active duplicate detected
        const requestMatches = this.verifyRequestMatch(idempotencyKey, requestContent);
        
        const duplicateInfo: DuplicateRequestInfo = {
          originalTraceId: existingRequest.traceId,
          duplicateTraceId: traceId,
          idempotencyKey,
          timeSinceOriginal: now.getTime() - existingRequest.createdAt.getTime(),
          requestMatches
        };

        this.emit('duplicateRequestDetected', duplicateInfo);
        
        return {
          isDuplicate: true,
          duplicateInfo
        };
      }
    }

    // Store the request content hash if enabled
    if (this.config.enableContentHashing && requestContent) {
      const contentHash = this.hashRequestContent(requestContent);
      this.requestContentHashes.set(idempotencyKey, contentHash);
    }

    // Register new request
    const request: IdempotentRequest = {
      idempotencyKey,
      traceId,
      requestHash: this.hashRequestContent(requestContent || {}),
      userId,
      createdAt: now,
      expiresAt
    };

    this.requestCache.set(idempotencyKey, request);
    
    // Enforce cache size limits
    this.enforceMaxCacheSize();

    this.emit('requestRegistered', {
      idempotencyKey,
      traceId,
      userId,
      expiresAt
    });

    return {
      isDuplicate: false
    };
  }

  /**
   * Store response for an idempotent request
   */
  storeResponse(
    idempotencyKey: string,
    traceId: string,
    result: any,
    statusCode: number,
    headers?: Record<string, string>,
    customTtlMs?: number
  ): void {
    const request = this.requestCache.get(idempotencyKey);
    if (!request) {
      throw new Error(`No registered request found for idempotency key: ${idempotencyKey}`);
    }

    if (request.traceId !== traceId) {
      throw new Error(`Trace ID mismatch for idempotency key: ${idempotencyKey}`);
    }

    const now = new Date();
    const ttl = customTtlMs || this.config.defaultTtlMs;
    const expiresAt = new Date(now.getTime() + ttl);

    const response: IdempotentResponse = {
      traceId,
      result,
      statusCode,
      headers,
      metadata: {
        generatedAt: now,
        expiresAt,
        hitCount: 0,
        lastHitAt: now
      }
    };

    this.responseCache.set(idempotencyKey, response);
    
    this.emit('responseStored', {
      idempotencyKey,
      traceId,
      statusCode,
      expiresAt
    });
  }

  /**
   * Retrieve cached response for an idempotent request
   */
  getResponse(idempotencyKey: string): IdempotentResponse | null {
    const response = this.responseCache.get(idempotencyKey);
    
    if (!response) {
      return null;
    }

    // Check if response has expired
    if (response.metadata.expiresAt < new Date()) {
      this.responseCache.delete(idempotencyKey);
      this.requestCache.delete(idempotencyKey);
      this.requestContentHashes.delete(idempotencyKey);
      
      this.emit('responseExpired', {
        idempotencyKey,
        expiredAt: response.metadata.expiresAt
      });
      
      return null;
    }

    // Update hit metadata
    response.metadata.hitCount++;
    response.metadata.lastHitAt = new Date();

    this.emit('responseCacheHit', {
      idempotencyKey,
      traceId: response.traceId,
      hitCount: response.metadata.hitCount
    });

    return response;
  }

  /**
   * Check if a request with the given idempotency key is in progress
   */
  isRequestInProgress(idempotencyKey: string): boolean {
    const request = this.requestCache.get(idempotencyKey);
    if (!request) {
      return false;
    }

    // Check if expired
    if (request.expiresAt < new Date()) {
      return false;
    }

    // Check if response exists (if yes, request is completed)
    const response = this.responseCache.get(idempotencyKey);
    return !response || response.metadata.expiresAt < new Date();
  }

  /**
   * Get all active idempotency keys for a user
   */
  getUserActiveKeys(userId: string): Array<{
    idempotencyKey: string;
    traceId: string;
    createdAt: Date;
    expiresAt: Date;
    hasResponse: boolean;
  }> {
    const userKeys: Array<{
      idempotencyKey: string;
      traceId: string;
      createdAt: Date;
      expiresAt: Date;
      hasResponse: boolean;
    }> = [];

    const now = new Date();

    for (const [key, request] of this.requestCache.entries()) {
      if (request.userId === userId && request.expiresAt >= now) {
        const hasResponse = this.responseCache.has(key) && 
                           this.responseCache.get(key)!.metadata.expiresAt >= now;

        userKeys.push({
          idempotencyKey: key,
          traceId: request.traceId,
          createdAt: request.createdAt,
          expiresAt: request.expiresAt,
          hasResponse
        });
      }
    }

    return userKeys.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Manually expire an idempotency key
   */
  expireKey(idempotencyKey: string, reason?: string): boolean {
    const request = this.requestCache.get(idempotencyKey);
    const response = this.responseCache.get(idempotencyKey);
    
    if (!request && !response) {
      return false;
    }

    // Remove from all caches
    this.requestCache.delete(idempotencyKey);
    this.responseCache.delete(idempotencyKey);
    this.requestContentHashes.delete(idempotencyKey);

    this.emit('keyExpiredManually', {
      idempotencyKey,
      reason: reason || 'Manual expiration',
      hadRequest: !!request,
      hadResponse: !!response
    });

    return true;
  }

  /**
   * Get idempotency statistics
   */
  getStatistics(): {
    activeRequests: number;
    cachedResponses: number;
    cacheHitRate: number;
    averageAge: number;
    memoryUsage: {
      requests: number;
      responses: number;
      contentHashes: number;
    };
    duplicateDetectionRate: number;
  } {
    const now = new Date();
    const activeRequests = Array.from(this.requestCache.values())
      .filter(req => req.expiresAt >= now).length;
    
    const cachedResponses = Array.from(this.responseCache.values())
      .filter(res => res.metadata.expiresAt >= now).length;

    // Calculate average age
    const activeRequestsData = Array.from(this.requestCache.values())
      .filter(req => req.expiresAt >= now);
    
    const totalAge = activeRequestsData.reduce((sum, req) => 
      sum + (now.getTime() - req.createdAt.getTime()), 0);
    const averageAge = activeRequestsData.length > 0 ? totalAge / activeRequestsData.length : 0;

    // Estimate cache hit rate (would be more accurate with persistent counters)
    const totalHits = Array.from(this.responseCache.values())
      .reduce((sum, res) => sum + res.metadata.hitCount, 0);
    const cacheHitRate = activeRequests > 0 ? totalHits / (totalHits + activeRequests) : 0;

    return {
      activeRequests,
      cachedResponses,
      cacheHitRate,
      averageAge,
      memoryUsage: {
        requests: this.requestCache.size,
        responses: this.responseCache.size,
        contentHashes: this.requestContentHashes.size
      },
      duplicateDetectionRate: 0 // Would need tracking over time
    };
  }

  /**
   * Clear all expired entries immediately
   */
  clearExpired(): {
    expiredRequests: number;
    expiredResponses: number;
  } {
    const now = new Date();
    let expiredRequests = 0;
    let expiredResponses = 0;

    // Clear expired requests
    for (const [key, request] of this.requestCache.entries()) {
      if (request.expiresAt < now) {
        this.requestCache.delete(key);
        this.requestContentHashes.delete(key);
        expiredRequests++;
      }
    }

    // Clear expired responses
    for (const [key, response] of this.responseCache.entries()) {
      if (response.metadata.expiresAt < now) {
        this.responseCache.delete(key);
        expiredResponses++;
      }
    }

    this.emit('expiredEntriesCleared', {
      expiredRequests,
      expiredResponses,
      timestamp: now
    });

    return { expiredRequests, expiredResponses };
  }

  /**
   * Private methods
   */

  private isValidIdempotencyKey(key: string): boolean {
    // Basic validation: must be non-empty, reasonable length, alphanumeric + hyphens/underscores
    if (!key || key.length < 1 || key.length > 255) {
      return false;
    }

    // Must match pattern for safety
    return /^[a-zA-Z0-9\-_:.]+$/.test(key);
  }

  private hashRequestContent(content: any): string {
    if (!content) {
      return '';
    }

    try {
      const contentString = typeof content === 'string' 
        ? content 
        : JSON.stringify(content, Object.keys(content).sort());
      
      // Limit hash size for performance
      const truncatedContent = contentString.length > this.config.maxHashSize 
        ? contentString.substring(0, this.config.maxHashSize)
        : contentString;

      return createHash('sha256').update(truncatedContent).digest('hex').substring(0, 16);
    } catch (error) {
      this.emit('hashError', { error, content });
      return 'hash_error';
    }
  }

  private verifyRequestMatch(idempotencyKey: string, requestContent?: any): boolean {
    if (!this.config.enableContentHashing) {
      return true; // Skip verification if not enabled
    }

    const storedHash = this.requestContentHashes.get(idempotencyKey);
    if (!storedHash) {
      return true; // No stored hash to compare against
    }

    const currentHash = this.hashRequestContent(requestContent);
    const matches = storedHash === currentHash;

    if (!matches) {
      this.emit('requestMismatch', {
        idempotencyKey,
        storedHash,
        currentHash
      });
    }

    return matches;
  }

  private enforceMaxCacheSize(): void {
    if (this.requestCache.size <= this.config.maxCacheSize) {
      return;
    }

    // Remove oldest entries to make room
    const entries = Array.from(this.requestCache.entries())
      .sort(([, a], [, b]) => a.createdAt.getTime() - b.createdAt.getTime());

    const entriesToRemove = this.requestCache.size - this.config.maxCacheSize + 1;
    
    for (let i = 0; i < entriesToRemove; i++) {
      const [key] = entries[i];
      this.requestCache.delete(key);
      this.responseCache.delete(key);
      this.requestContentHashes.delete(key);
    }

    this.emit('cacheEviction', {
      entriesRemoved: entriesToRemove,
      currentSize: this.requestCache.size
    });
  }

  private performCleanup(): void {
    const stats = this.clearExpired();
    
    // Additional maintenance tasks
    const memoryUsage = process.memoryUsage ? process.memoryUsage() : null;
    
    this.emit('maintenanceCompleted', {
      ...stats,
      currentCacheSize: this.requestCache.size,
      memoryUsage,
      timestamp: new Date()
    });
  }

  /**
   * Cleanup method
   */
  cleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    
    this.requestCache.clear();
    this.responseCache.clear();
    this.requestContentHashes.clear();
    
    this.emit('cleanup');
  }
}