/**
 * Command Guards - Unified auth/plan/quota/rate limit checks
 * Standardized guard system for V2 slash commands
 */

import { authRequired, planUpgradeRequired, quotaExceeded, rateLimitHit, type NormalizedError } from './error-normalizer.js';

export interface GuardContext {
  user?: { id: string; email?: string; plan?: string };
  command: string;
  quotaInfo?: { remaining: number; resetTime?: Date };
  rateLimitInfo?: { retryAfter: number };
}

export type GuardResult = { allowed: true } | NormalizedError;

/**
 * Check authentication requirement
 */
export function withAuth(context: GuardContext): GuardResult {
  if (!context.user?.id) {
    return authRequired(context.command);
  }
  return { allowed: true };
}

/**
 * Check plan requirement  
 */
export function withPlan(requiredPlan: string, context: GuardContext): GuardResult {
  const userPlan = context.user?.plan || "free";
  
  // Plan hierarchy: free < starter < pro < enterprise
  const planLevels = { "free": 0, "starter": 1, "pro": 2, "enterprise": 3 };
  const userLevel = planLevels[userPlan as keyof typeof planLevels] ?? 0;
  const requiredLevel = planLevels[requiredPlan as keyof typeof planLevels] ?? 3;
  
  if (userLevel < requiredLevel) {
    return planUpgradeRequired(context.command, userPlan);
  }
  
  return { allowed: true };
}

/**
 * Check quota limits
 */
export function withQuota(context: GuardContext): GuardResult {
  const quota = context.quotaInfo;
  
  if (quota && quota.remaining <= 0) {
    return quotaExceeded(quota.remaining, quota.resetTime);
  }
  
  return { allowed: true };
}

/**
 * Check rate limits
 */
export function withRateLimit(context: GuardContext): GuardResult {
  const rateLimit = context.rateLimitInfo;
  
  if (rateLimit && rateLimit.retryAfter > 0) {
    // Ensure finite number (no Infinity/NaN)
    const retryAfter = Math.min(300, Math.max(1, Math.floor(rateLimit.retryAfter)));
    return rateLimitHit(retryAfter);
  }
  
  return { allowed: true };
}

/**
 * Apply all guards in sequence
 */
export function applyAllGuards(
  guards: Array<(ctx: GuardContext) => GuardResult>,
  context: GuardContext
): GuardResult {
  for (const guard of guards) {
    const result = guard(context);
    if (!('allowed' in result)) {
      return result; // Return first failure
    }
  }
  return { allowed: true };
}

/**
 * Common guard combinations
 */
export const Guards = {
  /** Free tier commands (auth only) */
  free: (ctx: GuardContext) => applyAllGuards([withAuth], ctx),
  
  /** Starter plan commands */
  starter: (ctx: GuardContext) => applyAllGuards([
    withAuth, 
    (ctx) => withPlan("starter", ctx), 
    withQuota, 
    withRateLimit
  ], ctx),
  
  /** Pro plan commands */
  pro: (ctx: GuardContext) => applyAllGuards([
    withAuth, 
    (ctx) => withPlan("pro", ctx), 
    withQuota, 
    withRateLimit
  ], ctx),
  
  /** Enterprise commands */
  enterprise: (ctx: GuardContext) => applyAllGuards([
    withAuth, 
    (ctx) => withPlan("enterprise", ctx), 
    withQuota, 
    withRateLimit
  ], ctx),
  
  /** Public commands (no guards) */
  public: () => ({ allowed: true } as const)
};