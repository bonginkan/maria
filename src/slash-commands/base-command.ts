/**
 * Base Command Class
 * Abstract base class for all slash commands
 */

import {
  ISlashCommand,
  CommandArgs,
  CommandContext,
  CommandResult,
  CommandCategory,
  CommandMetadata,
  CommandPermission,
  CommandExample,
  ValidationResult,
} from './types';
import { logger } from '../utils/logger';

export abstract class BaseCommand implements ISlashCommand {
  // Required properties - must be set by subclasses
  abstract name: string;
  abstract category: CommandCategory;
  abstract description: string;

  // Optional properties with defaults
  aliases?: string[] = [];
  usage: string = '';
  examples: CommandExample[] = [];
  permissions?: CommandPermission;
  middleware?: string[] = [];
  rateLimit?: {
    requests: number;
    window: string;
  };

  // Metadata with defaults
  metadata: CommandMetadata = {
    version: '1.0.0',
    author: 'MARIA Team',
    deprecated: false,
    experimental: false,
  };

  // Cache for frequently used data
  private cache: Map<string, { data: unknown; expires: number }> = new Map();

  /**
   * Initialize the command (called once when registered)
   */
  async initialize(): Promise<void> {
    // Override in subclasses for custom initialization
    logger.debug(`Initializing command: ${this.name}`);
  }

  /**
   * Validate command arguments
   */
  async validate(_args: CommandArgs): Promise<ValidationResult> {
    // Basic validation - override for custom validation
    return { success: true };
  }

  /**
   * Execute the command - must be implemented by subclasses
   */
  abstract execute(args: CommandArgs, context: CommandContext): Promise<CommandResult>;

  /**
   * Cleanup resources (called when command is unregistered)
   */
  async cleanup(): Promise<void> {
    this.cache.clear();
    logger.debug(`Cleanup command: ${this.name}`);
  }

  /**
   * Rollback on error - override for custom rollback logic
   */
  async rollback(_context: CommandContext, error: Error): Promise<void> {
    logger.error(`Rollback for ${this.name}:`, error);
  }

  // Helper methods for subclasses

  /**
   * Parse command arguments into structured format
   */
  protected parseArgs(raw: string[]): CommandArgs {
    const args: CommandArgs = {
      raw,
      parsed: {},
      flags: {},
      options: {},
    };

    for (let i = 0; i < raw.length; i++) {
      const arg = raw[i];
      if (!arg) continue;

      // Parse flags (--flag or -f)
      if (arg.startsWith('--')) {
        const key = arg.slice(2);
        const nextArg = raw[i + 1];

        if (nextArg && !nextArg.startsWith('-')) {
          args.options[key] = nextArg;
          i++; // Skip next arg
        } else {
          args.flags[key] = true;
        }
      } else if (arg && arg.startsWith('-') && arg.length === 2) {
        args.flags[arg.slice(1)] = true;
      } else {
        // Regular argument
        if (!args.parsed['positional']) {
          args.parsed['positional'] = [];
        }
        (args.parsed['positional'] as string[]).push(arg);
      }
    }

    return args;
  }

  /**
   * Create a success response
   */
  protected success(
    message: string,
    data?: unknown,
    metadata?: Partial<CommandResult['metadata']>,
  ): CommandResult {
    return {
      success: true,
      message,
      data,
      metadata: {
        executionTime: Date.now(),
        commandVersion: this.metadata.version,
        ...metadata,
      },
    };
  }

  /**
   * Create an error response
   */
  protected error(message: string, code?: string, details?: unknown): CommandResult {
    return {
      success: false,
      message,
      data: { code, details },
      metadata: {
        executionTime: Date.now(),
        commandVersion: this.metadata.version,
      },
    };
  }

  /**
   * Cache data with TTL
   */
  protected setCache(key: string, data: unknown, ttlSeconds: number = 60): void {
    this.cache.set(key, {
      data,
      expires: Date.now() + ttlSeconds * 1000,
    });
  }

  /**
   * Get cached data
   */
  protected getCache<T = unknown>(key: string): T | null {
    const cached = this.cache.get(key);

    if (!cached) {
      return null;
    }

    if (cached.expires < Date.now()) {
      this.cache.delete(key);
      return null;
    }

    return cached.data as T;
  }

  /**
   * Check if user has required permissions
   */
  protected async checkPermissions(context: CommandContext): Promise<ValidationResult> {
    if (!this.permissions) {
      return { success: true };
    }

    const { requiresAuth, requiresPremium, role } = this.permissions;

    // Check authentication
    if (requiresAuth && !context.user) {
      return {
        success: false,
        error: 'Authentication required',
        suggestions: ['Run /login to authenticate'],
      };
    }

    // Check role
    if (role && context.user?.role !== role) {
      return {
        success: false,
        error: `Required role: ${role}`,
        suggestions: [`Contact admin for ${role} access`],
      };
    }

    // Check premium
    if (requiresPremium) {
      // TODO: Implement premium check
      logger.warn('Premium check not implemented');
    }

    return { success: true };
  }

  /**
   * Format help text for this command
   */
  formatHelp(): string {
    const lines: string[] = [];

    // Header
    lines.push(`📘 ${this.name.toUpperCase()}`);
    lines.push('─'.repeat(40));

    // Description
    lines.push(`\n${this.description}\n`);

    // Usage
    if (this.usage) {
      lines.push('**Usage:**');
      lines.push(`  /${this.name} ${this.usage}\n`);
    }

    // Aliases
    if (this.aliases && this.aliases.length > 0) {
      lines.push('**Aliases:**');
      lines.push(`  ${this.aliases.map((a) => `/${a}`).join(', ')}\n`);
    }

    // Examples
    if (this.examples.length > 0) {
      lines.push('**Examples:**');
      this.examples.forEach((ex) => {
        lines.push(`  ${ex.input}`);
        lines.push(`    ${ex.description}`);
        if (ex.output) {
          lines.push(`    → ${ex.output}`);
        }
      });
      lines.push('');
    }

    // Permissions
    if (this.permissions) {
      lines.push('**Requirements:**');
      if (this.permissions.requiresAuth) {
        lines.push('  • Authentication required');
      }
      if (this.permissions.role) {
        lines.push(`  • Role: ${this.permissions.role}`);
      }
      if (this.permissions.requiresPremium) {
        lines.push('  • Premium subscription');
      }
      lines.push('');
    }

    // Metadata
    if (this.metadata.experimental) {
      lines.push('⚠️  **Experimental Feature**');
    }
    if (this.metadata.deprecated) {
      lines.push(`⚠️  **Deprecated** - Use ${this.metadata.replacedBy || 'alternative'} instead`);
    }

    return lines.join('\n');
  }

  /**
   * Log command execution
   */
  protected logExecution(args: CommandArgs, context: CommandContext, result: CommandResult): void {
    const logData = {
      command: this.name,
      args: args.raw,
      user: context.user?.id,
      success: result.success,
      executionTime: result.metadata?.executionTime,
    };

    if (result.success) {
      logger.info('Command executed', logData);
    } else {
      logger.error('Command failed', { ...logData, error: result.message });
    }
  }
}

/**
 * Simple command implementation helper
 * For commands that don't need complex logic
 */
export function createSimpleCommand(
  config: {
    name: string;
    category: CommandCategory;
    description: string;
    handler: (args: CommandArgs, context: CommandContext) => Promise<CommandResult>;
  } & Partial<ISlashCommand>,
): BaseCommand {
  return new (class extends BaseCommand {
    name = config.name;
    category = config.category;
    description = config.description;
    override aliases = config.aliases;
    override usage = config.usage || '';
    override examples = config.examples || [];
    override permissions = config.permissions;
    override metadata = config.metadata || {
      version: '1.0.0',
      author: 'MARIA Team',
    };

    async execute(args: CommandArgs, context: CommandContext): Promise<CommandResult> {
      return config.handler(args, context);
    }
  })();
}
