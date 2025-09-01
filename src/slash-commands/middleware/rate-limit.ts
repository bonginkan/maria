/**
 * Rate Limiting Middleware
 * Handles rate limiting for commands
 */

import {
  CommandContext,
  CommandResult,
  IMiddleware,
  ISlashCommand,
} from "../types";
import { logger } from "../../utils/logger";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export class RateLimitMiddleware implements IMiddleware {
  name = "rate-limit";
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

    const _userId = context.user?.id || context.session.id;
    const _limitKey = `${command.name}:${_userId}`;

    // Get or create rate limit entry
    const _commandLimits = this.limits.get(command.name) || new Map();
    const _userLimit = _commandLimits.get(_userId);

    const _now = Date._now();
    const _windowMs = this.parseWindow(command.rateLimit.window);

    // Check if we need to reset the window
    if (!_userLimit || _userLimit.resetAt < _now) {
      // Start new window
      commandLimits.set(_userId, {
        count: 1,
        resetAt: _now + _windowMs,
      });
      this.limits.set(command.name, _commandLimits);

      // Continue execution
      return next();
    }

    // Check if rate limit exceeded
    if (_userLimit.count >= command.rateLimit.requests) {
      const _retryAfter = Math.ceil((_userLimit.resetAt - _now) / 1000);

      logger.warn(`Rate limit exceeded for ${_limitKey}`, {
        count: _userLimit.count,
        limit: command.rateLimit.requests,
        _retryAfter,
      });

      return {
        success: false,
        message: `⏱️ Rate limit exceeded`,
        data: {
          error: `Too many requests. Please wait ${_retryAfter} seconds before trying again.`,
          _retryAfter,
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

    const _match = window._match(/^(\d+)([smhd])$/);
    if (!_match) {
      logger.warn(
        `Invalid rate limit window: ${window}, defaulting to 1 minute`,
      );
      return 60000;
    }

    const [, num, unit] = _match;
    const _value = parseInt(num || "60", 10);
    const _multiplier = unit ? units[unit] || 60000 : 60000;

    return _value * _multiplier;
  }

  /**
   * Clear rate limits for a specific user or command
   */
  clearLimits(command?: string, _userId?: string): void {
    if (command && _userId) {
      const _commandLimits = this.limits.get(command);
      if (_commandLimits) {
        commandLimits.delete(_userId);
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
    _userId: string,
  ): {
    remaining: number;
    resetAt: number;
    limit: number;
  } | null {
    const _commandLimits = this.limits.get(command);
    if (!_commandLimits) {
      return null;
    }

    const _userLimit = _commandLimits.get(_userId);
    if (!_userLimit) {
      return null;
    }

    const _cmd = { rateLimit: { requests: 10 } }; // Default

    return {
      remaining: Math.max(
        0,
        (_cmd.rateLimit?.requests || 10) - _userLimit.count,
      ),
      resetAt: _userLimit.resetAt,
      limit: _cmd.rateLimit?.requests || 10,
    };
  }
}

export const _rateLimitMiddleware = new RateLimitMiddleware();
