/**
 * Production-ready Rate Limit Middleware
 * Fixes: First-call false positive, Infinity/Invalid Date errors
 */

import type { Request, Response, NextFunction } from 'express';
import { getAuth } from 'firebase-admin/auth';

// In-memory store (TODO: Replace with Redis for multi-instance)
const rateLimitStore = new Map<string, { lastAt: number }>();

// Rate limit configurations per endpoint and plan
interface RateLimitConfig {
  windowMs: number;
  requests: number;
}

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  '/image:FREE': { windowMs: 3000, requests: 1 },        // 1 req per 3s
  '/video:FREE': { windowMs: 15000, requests: 1 },       // 1 req per 15s
  '/code:FREE': { windowMs: 1000, requests: 1 },         // 1 req per 1s
  '/chat:FREE': { windowMs: 500, requests: 1 },          // 2 req per sec
  
  '/image:STARTER': { windowMs: 1000, requests: 1 },     // 1 req per 1s
  '/video:STARTER': { windowMs: 5000, requests: 1 },     // 1 req per 5s
  '/code:STARTER': { windowMs: 500, requests: 1 },       // 2 req per sec
  
  '/image:PRO': { windowMs: 100, requests: 1 },          // 10 req per sec
  '/video:PRO': { windowMs: 1000, requests: 1 },         // 1 req per sec
  '/code:PRO': { windowMs: 100, requests: 1 },           // 10 req per sec
  
  'default': { windowMs: 1000, requests: 1 }             // Fallback
};

/**
 * Get rate limit config for specific endpoint and plan
 */
function getRateLimitConfig(endpoint: string, plan: string): RateLimitConfig {
  const key = `${endpoint}:${plan.toUpperCase()}`;
  return RATE_LIMITS[key] || RATE_LIMITS.default;
}

/**
 * Extract endpoint category from request path
 */
function getEndpointCategory(path: string): string {
  if (path.includes('/image')) return '/image';
  if (path.includes('/video')) return '/video';
  if (path.includes('/code')) return '/code';
  if (path.includes('/chat')) return '/chat';
  return 'default';
}

/**
 * Main rate limit middleware
 */
export async function rateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // 1. Identify user (from JWT or API key)
    const authHeader = req.headers.authorization;
    const bearer = authHeader?.split(' ')[1];
    
    let userId = 'anonymous';
    let userPlan = 'FREE';
    
    if (bearer) {
      try {
        const decodedToken = await getAuth().verifyIdToken(bearer);
        userId = decodedToken.uid;
        // TODO: Fetch actual plan from Firestore
        userPlan = (req as any).user?.plan || 'FREE';
      } catch {
        // Invalid token, treat as anonymous
      }
    } else if (req.headers['x-api-key']) {
      userId = `apikey:${req.headers['x-api-key']}`;
      // TODO: Resolve plan from API key
    }
    
    // 2. Determine endpoint category
    const endpoint = getEndpointCategory(req.path);
    
    // 3. Get rate limit config
    const config = getRateLimitConfig(endpoint, userPlan);
    
    // 4. Build unique key for this user-endpoint combination
    const rateLimitKey = `${userId}:${endpoint}`;
    
    // 5. Check rate limit
    const now = Date.now();
    const userRecord = rateLimitStore.get(rateLimitKey);
    
    // First request - always allow
    if (!userRecord || typeof userRecord.lastAt !== 'number') {
      rateLimitStore.set(rateLimitKey, { lastAt: now });
      return next();
    }
    
    // Calculate time elapsed since last request
    const elapsedMs = now - userRecord.lastAt;
    const remainingMs = Math.max(0, config.windowMs - elapsedMs);
    
    // If window hasn't passed, reject
    if (remainingMs > 0) {
      // Ensure clean, bounded values for response
      const retryAfterSeconds = Math.max(1, Math.ceil(remainingMs / 1000));
      const resetAt = new Date(now + remainingMs);
      
      return res.status(429).json({
        error: 'rate_limit_exceeded',
        message: `Rate limit exceeded for ${endpoint} endpoint`,
        details: {
          endpoint,
          plan: userPlan,
          limit: `${config.requests} request per ${config.windowMs / 1000} seconds`,
          retryAfterSeconds,
          resetAt: resetAt.toISOString()
        },
        hint: userPlan === 'FREE' 
          ? `Free plan limit: ${config.requests} request per ${config.windowMs / 1000}s. Upgrade at https://maria.ai/upgrade`
          : `Please wait ${retryAfterSeconds} seconds before retrying.`
      });
    }
    
    // Window has passed - allow and update timestamp
    rateLimitStore.set(rateLimitKey, { lastAt: now });
    return next();
    
  } catch (error) {
    // Fail open - don't block users on rate limiter errors
    console.error('[RateLimit] Error in middleware:', error);
    return next();
  }
}

/**
 * Clear rate limit for specific user (e.g., after upgrade)
 */
export function clearUserRateLimit(userId: string): void {
  const keysToDelete: string[] = [];
  
  rateLimitStore.forEach((_, key) => {
    if (key.startsWith(`${userId}:`)) {
      keysToDelete.push(key);
    }
  });
  
  keysToDelete.forEach(key => rateLimitStore.delete(key));
}

/**
 * Periodic cleanup of old entries (prevent memory leak)
 */
export function startRateLimitCleanup(): void {
  setInterval(() => {
    const now = Date.now();
    const maxAge = 60 * 60 * 1000; // 1 hour
    
    rateLimitStore.forEach((value, key) => {
      if (now - value.lastAt > maxAge) {
        rateLimitStore.delete(key);
      }
    });
  }, 10 * 60 * 1000); // Run every 10 minutes
}