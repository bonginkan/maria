/**
 * Error Normalizer - Unified error formatting for all slash commands
 * Ensures consistent UX across V2 migration
 */

export interface NormalizedError {
  success: false;
  message: string;
  code: string;
  guidance?: string;
  action?: string;
  retryAfter?: number;
}

/**
 * Auth error - 401
 */
export function authRequired(command?: string): NormalizedError {
  return {
    success: false,
    message: "🔐 Authentication required",
    code: "AUTH_REQUIRED",
    guidance: `Run: /login`,
    action: "/login"
  };
}

/**
 * Plan upgrade needed - 403
 */
export function planUpgradeRequired(feature: string, currentPlan = "free"): NormalizedError {
  return {
    success: false,
    message: `🔒 ${feature} not available on ${currentPlan} plan`,
    code: "PLAN_UPGRADE_REQUIRED", 
    guidance: "Upgrade your plan to access this feature",
    action: "/upgrade"
  };
}

/**
 * Quota exceeded - 402
 */
export function quotaExceeded(remaining = 0, resetTime?: Date): NormalizedError {
  const resetMsg = resetTime ? ` (resets ${resetTime.toLocaleTimeString()})` : "";
  return {
    success: false,
    message: `⚡ Quota exceeded - ${remaining} requests remaining${resetMsg}`,
    code: "QUOTA_EXCEEDED",
    guidance: "Upgrade plan or wait for quota reset",
    action: "/billing"
  };
}

/**
 * Rate limit hit - 429
 */
export function rateLimitHit(retryAfter: number): NormalizedError {
  const seconds = Math.max(1, Math.floor(retryAfter));
  const timeStr = seconds > 60 ? `${Math.ceil(seconds/60)}m` : `${seconds}s`;
  
  return {
    success: false,
    message: `🚦 Rate limit exceeded - retry in ${timeStr}`,
    code: "RATE_LIMIT_HIT",
    guidance: `Wait ${timeStr} before retrying`,
    retryAfter: seconds
  };
}

/**
 * Command temporarily unavailable
 */
export function commandUnavailable(command: string, reason = "maintenance"): NormalizedError {
  return {
    success: false,
    message: `🚧 ${command} temporarily unavailable`,
    code: "COMMAND_UNAVAILABLE",
    guidance: `${reason} - try /help for alternatives`
  };
}

/**
 * Enterprise feature coming soon
 */
export function enterpriseComingSoon(feature: string): NormalizedError {
  return {
    success: false,
    message: `🚀 ${feature} - Enterprise feature coming soon`,
    code: "ENTERPRISE_COMING_SOON",
    guidance: "Join waitlist for early access",
    action: "https://maria-code.ai/enterprise"
  };
}

/**
 * Generic command error with structured format
 */
export function commandError(command: string, error: string | Error): NormalizedError {
  const message = error instanceof Error ? error.message : error;
  return {
    success: false,
    message: `❌ ${command} failed: ${message}`,
    code: "COMMAND_ERROR",
    guidance: "Check command syntax with /help"
  };
}

/**
 * Validation error for command arguments
 */
export function validationError(command: string, issue: string): NormalizedError {
  return {
    success: false,
    message: `⚠️ Invalid ${command} arguments: ${issue}`,
    code: "VALIDATION_ERROR",
    guidance: `Check usage: /help ${command}`
  };
}