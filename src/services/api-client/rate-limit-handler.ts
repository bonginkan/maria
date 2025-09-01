/**
 * Rate Limit Error Handler for CLI
 * Provides clean, user-friendly error messages
 */

import chalk from 'chalk';

interface RateLimitError {
  error: string;
  message: string;
  route?: string;
  plan?: string;
  limit?: number;
  remaining?: number;
  retryAfter?: number;
  resetAt?: number;
  hint?: string;
  // Legacy support
  details?: {
    endpoint: string;
    plan: string;
    limit: string;
    retryAfterSeconds: number;
    resetAt: string;
  };
}

/**
 * Handle 429 rate limit responses with clean messaging
 */
export function handleRateLimitError(error: RateLimitError): void {
  console.log();
  console.log(chalk.yellow('⏱️  Rate Limit Exceeded'));
  console.log(chalk.gray('━'.repeat(50)));
  
  // Support both new schema and legacy format
  const route = error.route || error.details?.endpoint || 'API';
  const plan = error.plan || error.details?.plan || 'Unknown';
  const limit = error.limit || (error.details?.limit ? parseInt(error.details.limit) : null);
  const retryAfter = error.retryAfter || error.details?.retryAfterSeconds;
  const resetAt = error.resetAt || (error.details?.resetAt ? Date.parse(error.details.resetAt) : null);
  
  // Validate and format retry time
  const waitTime = Number.isFinite(retryAfter) 
    ? `${retryAfter} second${retryAfter > 1 ? 's' : ''}`
    : 'a few seconds';
  
  // Validate and format reset time
  let resetTime = '';
  if (resetAt && Number.isFinite(resetAt)) {
    const resetDate = new Date(resetAt);
    const now = new Date();
    const diffMs = resetDate.getTime() - now.getTime();
    
    if (diffMs > 0 && diffMs < 60000) {
      resetTime = `in ${Math.ceil(diffMs / 1000)} seconds`;
    } else if (diffMs > 0) {
      resetTime = `at ${resetDate.toLocaleTimeString()}`;
    }
  }
  
  console.log(chalk.white(`Plan: ${chalk.bold(plan)}`));
  console.log(chalk.white(`Endpoint: ${chalk.bold(route)}`));
  if (limit !== null) {
    console.log(chalk.white(`Limit: ${chalk.bold(limit)} requests`));
  }
  if (error.remaining !== undefined) {
    console.log(chalk.white(`Remaining: ${chalk.bold(error.remaining)} requests`));
  }
  console.log();
  console.log(chalk.cyan(`Please wait ${chalk.bold(waitTime)} before trying again`));
  
  if (resetTime) {
    console.log(chalk.gray(`Rate limit resets ${resetTime}`));
  }
  
  if (error.hint) {
    console.log();
    console.log(chalk.magenta('💡 ' + error.hint));
  }
  
  console.log(chalk.gray('━'.repeat(50)));
  console.log();
}

/**
 * Parse and validate rate limit response
 */
export async function parseRateLimitResponse(response: Response): Promise<RateLimitError | null> {
  if (response.status !== 429) {
    return null;
  }
  
  // Extract standard headers if available
  const rateLimitInfo = {
    limit: parseInt(response.headers.get('RateLimit-Limit') || '0') || undefined,
    remaining: parseInt(response.headers.get('RateLimit-Remaining') || '0') || undefined,
    resetAt: parseInt(response.headers.get('RateLimit-Reset') || '0') || undefined,
    retryAfter: parseInt(response.headers.get('Retry-After') || '0') || undefined
  };
  
  try {
    const data = await response.json();
    
    // Support new consistent schema
    if (data.error === 'rate_limited' || data.error === 'rate_limit_exceeded') {
      return {
        ...data,
        // Merge header info if not in body
        limit: data.limit || rateLimitInfo.limit,
        remaining: data.remaining || rateLimitInfo.remaining,
        resetAt: data.resetAt || rateLimitInfo.resetAt,
        retryAfter: data.retryAfter || rateLimitInfo.retryAfter
      } as RateLimitError;
    }
    
    // Fallback for unexpected format
    return {
      error: 'rate_limited',
      message: data.message || 'Rate limit exceeded. Please wait and try again.',
      hint: data.hint || 'Consider upgrading your plan for higher limits.',
      ...rateLimitInfo
    };
  } catch {
    // Failed to parse JSON - use headers only
    return {
      error: 'rate_limited',
      message: 'Rate limit exceeded. Please wait and try again.',
      hint: 'Consider upgrading your plan for higher limits.',
      ...rateLimitInfo
    };
  }
}

/**
 * Calculate optimal retry strategy
 */
export function calculateRetryStrategy(retryAfterSeconds?: number): {
  shouldRetry: boolean;
  delayMs: number;
  attempt: number;
} {
  const maxRetries = 3;
  const baseDelay = 1000;
  
  if (!retryAfterSeconds || !Number.isFinite(retryAfterSeconds)) {
    // Default exponential backoff
    return {
      shouldRetry: true,
      delayMs: baseDelay,
      attempt: 1
    };
  }
  
  // Use server-provided retry time
  const delayMs = Math.min(retryAfterSeconds * 1000, 30000); // Cap at 30 seconds
  
  return {
    shouldRetry: delayMs <= 10000, // Only auto-retry if under 10 seconds
    delayMs,
    attempt: 1
  };
}