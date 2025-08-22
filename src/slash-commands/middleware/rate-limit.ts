/**
 * Rate Limiting Middleware
 * Handles rate limiting for commands
 */

import { CommandContext, CommandResult, IMiddleware, ISlashCommand } from '../types';
import { logger } from '../../utils/logger';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export class RateLimitMiddleware implements IMiddleware {
  name = 'rate-limit';
  priority = 15; // Run after auth, before validation

  private limits = new Map<string, Map<string, RateLimitEntry>>();

  async execute(
    command: ISlashCommand,
    _args: unknown,
    context: CommandContext,
    next: () => Promise<CommandResult>,
  ): Promise<CommandResult> {
    // Check if command has rate limiting
    if (!command.rateLimit) {
      return next();
    }

    const userId = context.user?.id || context.session.id;
    const limitKey = `${command.name}:${userId}`;

    // Get or create rate limit entry
    const commandLimits = this.limits.get(command.name) || new Map();
    const userLimit = commandLimits.get(userId);

    const now = Date.now();
    const windowMs = this.parseWindow(command.rateLimit.window);

    // Check if we need to reset the window
    if (!userLimit || userLimit.resetAt < now) {
      // Start new window
      commandLimits.set(userId, {
        count: 1,
        resetAt: now + windowMs,
      });
      this.limits.set(command.name, commandLimits);

      // Continue execution
      return next();
    }

    // Check if rate limit exceeded
    if (userLimit.count >= command.rateLimit.requests) {
      const retryAfter = Math.ceil((userLimit.resetAt - now) / 1000);

      logger.warn(`Rate limit exceeded for ${limitKey}`, {
        count: userLimit.count,
        limit: command.rateLimit.requests,
        retryAfter,
      });

      return {
        success: false,
        message: `⏱️ Rate limit exceeded`,
        data: {
          error: `Too many requests. Please wait ${retryAfter} seconds before trying again.`,
          retryAfter,
          limit: command.rateLimit.requests,
          window: command.rateLimit.window,
        },
      };
    }

    // Increment counter
    userLimit.count++;

    // Continue execution
    return next();
  }

  private parseWindow(window: string): number {
    const units: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };

    const match = window.match(/^(\d+)([smhd])$/);
    if (!match) {
      logger.warn(`Invalid rate limit window: ${window}, defaulting to 1 minute`);
      return 60000;
    }

    const [, num, unit] = match;
    const value = parseInt(num || '60', 10);
    const multiplier = unit ? units[unit] || 60000 : 60000;

    return value * multiplier;
  }

  /**
   * Clear rate limits for a specific user or command
   */
  clearLimits(command?: string, userId?: string): void {
    if (command && userId) {
      const commandLimits = this.limits.get(command);
      if (commandLimits) {
        commandLimits.delete(userId);
      }
    } else if (command) {
      this.limits.delete(command);
    } else {
      this.limits.clear();
    }
  }

  /**
   * Get current limit status for a user
   */
  getStatus(
    command: string,
    userId: string,
  ): {
    remaining: number;
    resetAt: number;
    limit: number;
  } | null {
    const commandLimits = this.limits.get(command);
    if (!commandLimits) {
      return null;
    }

    const userLimit = commandLimits.get(userId);
    if (!userLimit) {
      return null;
    }

    const cmd = { rateLimit: { requests: 10 } }; // Default

    return {
      remaining: Math.max(0, (cmd.rateLimit?.requests || 10) - userLimit.count),
      resetAt: userLimit.resetAt,
      limit: cmd.rateLimit?.requests || 10,
    };
  }
}

export const rateLimitMiddleware = new RateLimitMiddleware();
