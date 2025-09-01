/**
 * Telemetry Helper for Command Tracking
 * Provides consistent telemetry across all commands
 */

import type { CommandResult } from '../types';

export interface TelemetryData {
  cmd: string;
  status: 'success' | 'error' | 'shielded' | 'rate_limited';
  latencyMs: number;
  plan: string;
  quotaLeft: number;
  errorType?: string;
  args?: string[];
}

/**
 * Track command execution
 * Non-blocking, fails silently to not impact UX
 */
export async function trackCommand(data: TelemetryData): Promise<void> {
  try {
    // Non-blocking fetch to telemetry endpoint
    fetch('/v1/telemetry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version,
        environment: process.env.NODE_ENV
      })
    }).catch(() => {
      // Silently fail - telemetry should never break the CLI
    });
  } catch {
    // Silently fail
  }
}

/**
 * Command execution wrapper with telemetry
 */
export async function withTelemetry<T extends CommandResult>(
  commandName: string,
  args: string[],
  userPlan: string,
  quotaLeft: number,
  executor: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();
  let status: TelemetryData['status'] = 'success';
  let errorType: string | undefined;

  try {
    const result = await executor();
    
    // Determine status from result
    if (!result.success) {
      if (result.endReason === 'not_available') {
        status = 'shielded';
      } else if (result.endReason === 'rate_limited') {
        status = 'rate_limited';
      } else {
        status = 'error';
        errorType = result.endReason;
      }
    }

    return result;
  } catch (error) {
    status = 'error';
    errorType = error instanceof Error ? error.name : 'UnknownError';
    throw error;
  } finally {
    // Always track, even on error
    const latencyMs = Date.now() - startTime;
    
    trackCommand({
      cmd: commandName,
      status,
      latencyMs,
      plan: userPlan,
      quotaLeft,
      errorType,
      args: args.slice(0, 3) // Limit args for privacy
    });
  }
}

/**
 * Format quota footer for command output
 */
export function formatQuotaFooter(quotaLeft: number, resetDate: string): string {
  return `ℹ ${quotaLeft} req left · Reset: ${resetDate}`;
}

/**
 * Add quota footer to success message
 */
export function withQuotaFooter(
  message: string,
  quotaLeft: number,
  resetDate: string = getNextMonthStart()
): string {
  const footer = formatQuotaFooter(quotaLeft, resetDate);
  return `${message}\n${footer}`;
}

/**
 * Get next month start date
 */
function getNextMonthStart(): string {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return nextMonth.toISOString().split('T')[0];
}

/**
 * Format compact file path
 */
export function compactPath(absolutePath: string): string {
  const cwd = process.cwd();
  if (absolutePath.startsWith(cwd)) {
    return '.' + absolutePath.slice(cwd.length);
  }
  
  const home = process.env.HOME || process.env.USERPROFILE;
  if (home && absolutePath.startsWith(home)) {
    return '~' + absolutePath.slice(home.length);
  }
  
  return absolutePath;
}

/**
 * Format single-line error message (no stack traces)
 */
export function formatError(error: unknown): string {
  if (error instanceof Error) {
    // Common user-facing errors
    if (error.message.includes('ENOENT')) {
      return '❌ File not found';
    }
    if (error.message.includes('EACCES')) {
      return '❌ Permission denied';
    }
    if (error.message.includes('ETIMEDOUT')) {
      return '❌ Request timed out';
    }
    
    // Generic error - no stack trace
    return `❌ ${error.message.split('\n')[0]}`;
  }
  
  return '❌ An error occurred';
}

/**
 * Calculate wait time from rate limit headers
 */
export function calculateWaitTime(headers: Headers): number {
  // Try Retry-After first (seconds)
  const retryAfter = headers.get('Retry-After');
  if (retryAfter) {
    const seconds = parseInt(retryAfter, 10);
    if (!isNaN(seconds) && isFinite(seconds)) {
      return seconds;
    }
  }
  
  // Try X-RateLimit-Reset (timestamp)
  const resetTime = headers.get('X-RateLimit-Reset');
  if (resetTime) {
    const resetMs = parseInt(resetTime, 10) * 1000;
    if (!isNaN(resetMs) && isFinite(resetMs)) {
      const waitMs = Math.max(0, resetMs - Date.now());
      return Math.ceil(waitMs / 1000);
    }
  }
  
  // Default wait time
  return 3;
}