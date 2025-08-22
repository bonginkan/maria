/**
 * Command Registry System
 * Central registry for all slash commands with auto-discovery
 */

// import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import {
  ISlashCommand,
  CommandArgs,
  CommandContext,
  CommandResult,
  CommandError,
  IMiddleware,
  MiddlewareNext,
} from './types';
// import { BaseCommand } from './base-command';
import { logger } from '../utils/logger';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export class CommandRegistry {
  private commands = new Map<string, ISlashCommand>();
  private aliases = new Map<string, string>();
  private middlewares = new Map<string, IMiddleware>();
  private rateLimits = new Map<string, Map<string, RateLimitEntry>>();
  private _initialized = false;

  private get initialized() {
    return this._initialized;
  }

  private set initialized(value: boolean) {
    this._initialized = value;
  }

  constructor() {
    this.setupDefaultMiddlewares();
  }

  /**
   * Register a command
   */
  register(command: ISlashCommand): void {
    if (this.commands.has(command.name)) {
      logger.warn(`Command ${command.name} already registered, overwriting`);
    }

    this.commands.set(command.name, command);

    // Register aliases
    if (command.aliases) {
      for (const alias of command.aliases) {
        if (this.aliases.has(alias)) {
          logger.warn(`Alias ${alias} already registered, overwriting`);
        }
        this.aliases.set(alias, command.name);
      }
    }

    logger.info(`Registered command: ${command.name}`);
  }

  /**
   * Unregister a command
   */
  unregister(name: string): boolean {
    const command = this.commands.get(name);
    if (!command) {
      return false;
    }

    // Remove aliases
    if (command.aliases) {
      for (const alias of command.aliases) {
        this.aliases.delete(alias);
      }
    }

    // Cleanup command
    if (command.cleanup) {
      command.cleanup().catch((err) => logger.error(`Error cleaning up command ${name}:`, err));
    }

    this.commands.delete(name);
    return true;
  }

  /**
   * Get a command by name or alias
   */
  get(nameOrAlias: string): ISlashCommand | undefined {
    // Remove leading slash if present
    const cleanName = nameOrAlias.startsWith('/') ? nameOrAlias.slice(1) : nameOrAlias;

    // Direct lookup
    const command = this.commands.get(cleanName);
    if (command) {
      return command;
    }

    // Alias lookup
    const actualName = this.aliases.get(cleanName);
    if (actualName) {
      return this.commands.get(actualName);
    }

    return undefined;
  }

  /**
   * Check if a command exists
   */
  has(nameOrAlias: string): boolean {
    return this.get(nameOrAlias) !== undefined;
  }

  /**
   * Get all registered commands
   */
  getAll(): ISlashCommand[] {
    return Array.from(this.commands.values());
  }

  /**
   * Get commands by category
   */
  getByCategory(category: string): ISlashCommand[] {
    return this.getAll().filter((cmd) => cmd.category === category);
  }

  /**
   * Execute a command
   */
  async execute(
    commandName: string,
    args: string[],
    context: CommandContext,
  ): Promise<CommandResult> {
    const startTime = Date.now();

    try {
      // Find command
      const command = this.get(commandName);
      if (!command) {
        return {
          success: false,
          message: `Command not found: ${commandName}`,
          data: {
            suggestions: this.getSuggestions(commandName),
          },
        };
      }

      // Parse arguments
      const parsedArgs = this.parseArguments(args);

      // Check rate limit
      if (command.rateLimit) {
        const rateLimitResult = this.checkRateLimit(command, context);
        if (!rateLimitResult.success) {
          return rateLimitResult;
        }
      }

      // Run through middleware chain
      const result = await this.runMiddlewareChain(command, parsedArgs, context, async () => {
        // Check permissions
        const permCheck = await this.checkPermissions(command, context);
        if (!permCheck.success) {
          return permCheck;
        }

        // Validate arguments
        if (command.validate) {
          const validation = await command.validate(parsedArgs);
          if (!validation.success) {
            return {
              success: false,
              message: validation.error || 'Validation failed',
              data: { suggestions: validation.suggestions },
            };
          }
        }

        // Execute command
        const result = await command.execute(parsedArgs, context);

        // Add execution metadata
        result.metadata = {
          ...result.metadata,
          executionTime: Date.now() - startTime,
          commandVersion: command.metadata.version,
        };

        return result;
      });

      // Log execution
      this.logExecution(command, parsedArgs, context, result);

      return result;
    } catch (error) {
      // Handle specific error types
      if (error instanceof CommandError) {
        return {
          success: false,
          message: error.message,
          data: {
            code: error.code,
            details: error.details,
          },
        };
      }

      // Generic error
      logger.error(`Command execution error for ${commandName}:`, error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Command execution failed',
        metadata: {
          executionTime: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * Auto-register commands from directory
   */
  async autoRegister(directory: string): Promise<void> {
    logger.info(`Auto-registering commands from ${directory}`);

    try {
      // Find all command files
      const pattern = path.join(directory, '**/*.command.{ts,js}');
      const files = await glob(pattern);

      logger.info(`Found ${files.length} command files`);

      for (const file of files) {
        try {
          // Import module
          const module = await import(file);

          // Check for default export
          if (module.default) {
            let command: ISlashCommand;

            // Handle class or instance
            if (typeof module.default === 'function') {
              // It's a class, instantiate it
              command = new module.default();
            } else {
              // It's already an instance
              command = module.default;
            }

            // Verify it's a valid command
            if (this.isValidCommand(command)) {
              // Initialize command
              if (command.initialize) {
                await command.initialize();
              }

              this.register(command);
            } else {
              logger.warn(`Invalid command in ${file}`);
            }
          }

          // Check for named exports
          for (const [key, value] of Object.entries(module)) {
            if (key !== 'default' && this.isValidCommand(value as ISlashCommand)) {
              const command = value as ISlashCommand;
              if (command.initialize) {
                await command.initialize();
              }
              this.register(command);
            }
          }
        } catch (error) {
          logger.error(`Failed to load command from ${file}:`, error);
        }
      }

      this.initialized = true;
      logger.info(`Registered ${this.commands.size} commands total`);
    } catch (error) {
      logger.error('Auto-registration failed:', error);
      throw error;
    }
  }

  /**
   * Register a middleware
   */
  registerMiddleware(middleware: IMiddleware): void {
    this.middlewares.set(middleware.name, middleware);
    logger.info(`Registered middleware: ${middleware.name}`);
  }

  // Private helper methods

  private setupDefaultMiddlewares(): void {
    // Logging middleware
    this.registerMiddleware({
      name: 'logging',
      priority: 0,
      async execute(command, args, context, next) {
        logger.debug(`Executing command: ${command.name}`, {
          args: args.raw,
          user: context.user?.id,
        });
        return next();
      },
    });

    // Error handling middleware
    this.registerMiddleware({
      name: 'error-handler',
      priority: 1,
      async execute(_command, _args, _context, next) {
        try {
          return await next();
        } catch (error) {
          logger.error(`Command ${_command.name} failed:`, error);
          throw error;
        }
      },
    });
  }

  private parseArguments(raw: string[]): CommandArgs {
    const args: CommandArgs = {
      raw,
      parsed: {},
      flags: {},
      options: {},
    };

    const positional: string[] = [];

    for (let i = 0; i < raw.length; i++) {
      const arg = raw[i];
      if (!arg) continue;

      if (arg.startsWith('--')) {
        const key = arg.slice(2);
        const nextArg = raw[i + 1];

        if (nextArg && !nextArg.startsWith('-')) {
          args.options[key] = nextArg;
          i++;
        } else {
          args.flags[key] = true;
        }
      } else if (arg && arg.startsWith('-') && arg.length === 2) {
        args.flags[arg.slice(1)] = true;
      } else if (arg) {
        positional.push(arg);
      }
    }

    if (positional.length > 0) {
      args.parsed['positional'] = positional;
    }

    return args;
  }

  private async checkPermissions(
    command: ISlashCommand,
    context: CommandContext,
  ): Promise<CommandResult> {
    if (!command.permissions) {
      return { success: true, message: '' };
    }

    const { requiresAuth, role } = command.permissions;

    if (requiresAuth && !context.user) {
      return {
        success: false,
        message: 'Authentication required',
        data: { suggestions: ['Run /login to authenticate'] },
      };
    }

    if (role && context.user?.role !== role) {
      return {
        success: false,
        message: `Insufficient permissions. Required role: ${role}`,
      };
    }

    return { success: true, message: '' };
  }

  private checkRateLimit(command: ISlashCommand, context: CommandContext): CommandResult {
    if (!command.rateLimit) {
      return { success: true, message: '' };
    }

    const userId = context.user?.id || 'anonymous';
    const commandLimits = this.rateLimits.get(command.name) || new Map();
    const userLimit = commandLimits.get(userId);

    const now = Date.now();
    const windowMs = this.parseWindow(command.rateLimit.window);

    if (!userLimit || userLimit.resetAt < now) {
      // New window
      commandLimits.set(userId, {
        count: 1,
        resetAt: now + windowMs,
      });
      this.rateLimits.set(command.name, commandLimits);
      return { success: true, message: '' };
    }

    if (userLimit.count >= command.rateLimit.requests) {
      const retryAfter = Math.ceil((userLimit.resetAt - now) / 1000);
      return {
        success: false,
        message: `Rate limit exceeded. Try again in ${retryAfter} seconds`,
        data: { retryAfter },
      };
    }

    userLimit.count++;
    return { success: true, message: '' };
  }

  private parseWindow(window: string): number {
    const match = window.match(/^(\d+)([smhd])$/);
    if (!match) {
      return 60000; // Default 1 minute
    }

    const [, num, unit] = match;
    const value = parseInt(num || '60', 10);

    switch (unit) {
      case 's':
        return value * 1000;
      case 'm':
        return value * 60 * 1000;
      case 'h':
        return value * 60 * 60 * 1000;
      case 'd':
        return value * 24 * 60 * 60 * 1000;
      default:
        return 60000;
    }
  }

  private async runMiddlewareChain(
    command: ISlashCommand,
    args: CommandArgs,
    context: CommandContext,
    execute: () => Promise<CommandResult>,
  ): Promise<CommandResult> {
    const middlewareNames = command.middleware || [];
    const middlewares = middlewareNames
      .map((name) => this.middlewares.get(name))
      .filter(Boolean) as IMiddleware[];

    // Sort by priority
    middlewares.sort((a, b) => (a.priority || 0) - (b.priority || 0));

    // Build middleware chain
    let index = 0;
    const next: MiddlewareNext = async () => {
      if (index < middlewares.length) {
        const middleware = middlewares[index++];
        return middleware ? middleware.execute(command, args, context, next) : execute();
      }
      return execute();
    };

    return next();
  }

  private getSuggestions(input: string): string[] {
    const suggestions: string[] = [];
    const cleanInput = input.replace('/', '').toLowerCase();

    // Find similar commands
    for (const [name] of this.commands) {
      if (name.toLowerCase().includes(cleanInput) || cleanInput.includes(name.toLowerCase())) {
        suggestions.push(`/${name}`);
      }
    }

    // Check aliases too
    for (const [alias] of this.aliases) {
      if (alias.toLowerCase().includes(cleanInput) || cleanInput.includes(alias.toLowerCase())) {
        suggestions.push(`/${alias}`);
      }
    }

    return suggestions.slice(0, 5); // Limit to 5 suggestions
  }

  private isValidCommand(obj: unknown): obj is ISlashCommand {
    if (!obj || typeof obj !== 'object') {
      return false;
    }

    const cmd = obj as ISlashCommand;
    return (
      typeof cmd.name === 'string' &&
      typeof cmd.category === 'string' &&
      typeof cmd.description === 'string' &&
      typeof cmd.execute === 'function'
    );
  }

  private logExecution(
    command: ISlashCommand,
    args: CommandArgs,
    context: CommandContext,
    result: CommandResult,
  ): void {
    const logData = {
      command: command.name,
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

// Singleton instance
export const commandRegistry = new CommandRegistry();
