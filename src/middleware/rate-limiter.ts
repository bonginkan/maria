/**
 * Rate Limiter Middleware for FREE Plan
 * Implements sliding window rate limiting with memory store
 */

import { CommandContext } from '../types/command.types';

export interface RateLimitConfig {
  requestsPerSecond: number;
  burstSize?: number;
  windowMs?: number;
  message?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remainingRequests: number;
  resetTime: number;
  retryAfter?: number;
  message?: string;
}

/**
 * In-memory store for rate limit tracking
 * In production, use Redis or similar
 */
class RateLimitStore {
  private requests: Map<string, number[]> = new Map();
  private lastCleanup: number = Date.now();
  private readonly CLEANUP_INTERVAL = 60000; // Clean up every minute
  
  /**
   * Record a request for a user
   */
  recordRequest(userId: string): void {
    const now = Date.now();
    
    // Periodic cleanup
    if (now - this.lastCleanup > this.CLEANUP_INTERVAL) {
      this.cleanup();
      this.lastCleanup = now;
    }
    
    const userRequests = this.requests.get(userId) || [];
    userRequests.push(now);
    this.requests.set(userId, userRequests);
  }
  
  /**
   * Get recent requests for a user within window
   */
  getRecentRequests(userId: string, windowMs: number): number[] {
    const now = Date.now();
    const cutoff = now - windowMs;
    
    const userRequests = this.requests.get(userId) || [];
    const recentRequests = userRequests.filter(timestamp => timestamp > cutoff);
    
    // Update stored requests to only keep recent ones
    if (recentRequests.length !== userRequests.length) {
      this.requests.set(userId, recentRequests);
    }
    
    return recentRequests;
  }
  
  /**
   * Clean up old request records
   */
  private cleanup(): void {
    const now = Date.now();
    const maxAge = 300000; // Keep 5 minutes of history
    const cutoff = now - maxAge;
    
    for (const [userId, requests] of this.requests.entries()) {
      const recentRequests = requests.filter(timestamp => timestamp > cutoff);
      
      if (recentRequests.length === 0) {
        this.requests.delete(userId);
      } else if (recentRequests.length !== requests.length) {
        this.requests.set(userId, recentRequests);
      }
    }
  }
  
  /**
   * Clear all data for a user
   */
  clearUser(userId: string): void {
    this.requests.delete(userId);
  }
  
  /**
   * Get store statistics
   */
  getStats(): { users: number; totalRequests: number } {
    let totalRequests = 0;
    
    for (const requests of this.requests.values()) {
      totalRequests += requests.length;
    }
    
    return {
      users: this.requests.size,
      totalRequests
    };
  }
}

/**
 * Rate Limiter implementation
 */
export class RateLimiter {
  private store: RateLimitStore;
  private config: RateLimitConfig;
  
  constructor(config: RateLimitConfig) {
    this.store = new RateLimitStore();
    this.config = {
      ...config,
      windowMs: config.windowMs || 1000, // Default 1 second window
      burstSize: config.burstSize || Math.ceil(config.requestsPerSecond * 1.5),
      message: config.message || 'Rate limit exceeded. Please wait before trying again.'
    };
  }
  
  /**
   * Check if request is allowed for user
   */
  async checkLimit(userId: string): Promise<RateLimitResult> {
    const now = Date.now();
    const windowMs = this.config.windowMs!;
    
    // Get recent requests in window
    const recentRequests = this.store.getRecentRequests(userId, windowMs);
    
    // Calculate allowed requests
    const maxRequests = Math.floor(this.config.requestsPerSecond * (windowMs / 1000));
    const burstAllowed = Math.min(this.config.burstSize!, maxRequests * 2);
    
    // Check if under limit
    if (recentRequests.length < maxRequests) {
      // Request allowed
      this.store.recordRequest(userId);
      
      return {
        allowed: true,
        remainingRequests: maxRequests - recentRequests.length - 1,
        resetTime: now + windowMs
      };
    }
    
    // Check burst allowance
    if (recentRequests.length < burstAllowed) {
      // Calculate if enough time has passed for token replenishment
      const oldestRequest = recentRequests.length > 0 ? Math.min(...recentRequests) : now;
      const timeSinceOldest = now - oldestRequest;
      const tokensReplenished = Math.floor(timeSinceOldest / (1000 / this.config.requestsPerSecond));
      
      if (tokensReplenished > 0) {
        // Some tokens replenished, allow request
        this.store.recordRequest(userId);
        
        return {
          allowed: true,
          remainingRequests: Math.max(0, maxRequests - recentRequests.length - 1),
          resetTime: oldestRequest + windowMs
        };
      }
    }
    
    // Rate limit exceeded
    const oldestRequest = recentRequests.length > 0 ? Math.min(...recentRequests) : now;
    const resetTime = oldestRequest + windowMs;
    const retryAfter = Math.max(0, resetTime - now);
    
    return {
      allowed: false,
      remainingRequests: 0,
      resetTime,
      retryAfter: Math.ceil(retryAfter / 1000), // Convert to seconds
      message: this.config.message
    };
  }
  
  /**
   * Middleware function for command execution
   */
  async middleware(
    userId: string,
    next: () => Promise<any>
  ): Promise<any> {
    const result = await this.checkLimit(userId);
    
    if (!result.allowed) {
      throw new RateLimitError(
        result.message!,
        result.retryAfter!,
        result.resetTime
      );
    }
    
    return next();
  }
  
  /**
   * Reset rate limit for a user
   */
  reset(userId: string): void {
    this.store.clearUser(userId);
  }
  
  /**
   * Get current statistics
   */
  getStats(): any {
    return {
      config: this.config,
      store: this.store.getStats()
    };
  }
}

/**
 * Rate limit error class
 */
export class RateLimitError extends Error {
  public readonly retryAfter: number;
  public readonly resetTime: number;
  
  constructor(message: string, retryAfter: number, resetTime: number) {
    super(message);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
    this.resetTime = resetTime;
  }
}

/**
 * Plan-specific rate limiters
 */
export class PlanRateLimiters {
  private limiters: Map<string, RateLimiter> = new Map();
  
  constructor() {
    // Initialize rate limiters for each plan
    this.limiters.set('free', new RateLimiter({
      requestsPerSecond: 0.33, // 1 request per 3 seconds
      burstSize: 2,
      windowMs: 3000,
      message: 'FREE plan: Max 1 request per 3 seconds. Upgrade for faster access: /upgrade'
    }));
    
    this.limiters.set('starter', new RateLimiter({
      requestsPerSecond: 1, // 1 request per second
      burstSize: 5,
      windowMs: 1000,
      message: 'STARTER plan: Max 1 request per second.'
    }));
    
    this.limiters.set('pro', new RateLimiter({
      requestsPerSecond: 5, // 5 requests per second
      burstSize: 10,
      windowMs: 1000,
      message: 'PRO plan: Max 5 requests per second.'
    }));
    
    this.limiters.set('ultra', new RateLimiter({
      requestsPerSecond: 10, // 10 requests per second
      burstSize: 20,
      windowMs: 1000,
      message: 'ULTRA plan: Max 10 requests per second.'
    }));
  }
  
  /**
   * Get rate limiter for a plan
   */
  getLimiter(planId: string): RateLimiter {
    return this.limiters.get(planId) || this.limiters.get('free')!;
  }
  
  /**
   * Check rate limit for a user
   */
  async checkLimit(userId: string, planId: string): Promise<RateLimitResult> {
    const limiter = this.getLimiter(planId);
    return limiter.checkLimit(userId);
  }
  
  /**
   * Apply rate limiting middleware
   */
  async applyLimit(
    context: CommandContext,
    planId: string,
    next: () => Promise<any>
  ): Promise<any> {
    const userId = context.userId || 'anonymous';
    const limiter = this.getLimiter(planId);
    
    try {
      return await limiter.middleware(userId, next);
    } catch (error) {
      if (error instanceof RateLimitError) {
        // Format nice error message
        const waitTime = error.retryAfter;
        const resetDate = new Date(error.resetTime);
        
        console.error(`
⏱️ Rate Limit Exceeded

${error.message}

Please wait ${waitTime} second${waitTime !== 1 ? 's' : ''} before trying again.
Reset at: ${resetDate.toLocaleTimeString()}

💡 Tip: Upgrade your plan for faster access and higher limits.
        `);
        
        throw error;
      }
      
      throw error;
    }
  }
  
  /**
   * Get all statistics
   */
  getAllStats(): any {
    const stats: any = {};
    
    for (const [planId, limiter] of this.limiters.entries()) {
      stats[planId] = limiter.getStats();
    }
    
    return stats;
  }
}

// Export singleton instance
export const planRateLimiters = new PlanRateLimiters();