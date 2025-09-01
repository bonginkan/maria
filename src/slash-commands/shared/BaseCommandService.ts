/**
 * Base Command Service
 * Abstract base class for all command services
 */

import { BaseCommand } from "../base-command";
import {
  CommandArgs,
  CommandContext,
  CommandResult,
  CommandCategory,
} from "../types";
import { logger as _logger } from "../../utils/logger";
const logger = _logger;

export abstract class BaseCommandService {
  protected handlers: Map<string, BaseCommand> = new Map();
  abstract readonly category: CommandCategory;

  constructor() {
    this.registerHandlers();
  }

  /**
   * Register all handlers for this service
   * Must be implemented by subclasses
   */
  abstract registerHandlers(): void;

  /**
   * Execute a command within this service
   */
  async executeCommand(
    command: string,
    args: CommandArgs,
    context: CommandContext,
  ): Promise<CommandResult> {
    const _handler = this.handlers.get(command);

    if (!_handler) {
      return {
        success: false,
        message: `Command not found in ${this.category} service: ${command}`,
        data: {
          availableCommands: Array.from(this.handlers.keys()),
          suggestions: this.getSuggestions(command),
        },
      };
    }

    try {
      // Validate command arguments
      if (_handler.validate) {
        const _validation = await _handler.validate(args);
        if (!_validation.success) {
          return {
            success: false,
            message: _validation.error || "Command _validation failed",
            data: { suggestions: _validation.suggestions },
          };
        }
      }

      // Execute the command
      const _result = await _handler.execute(args, context);

      // Log successful execution
      logger.info(`Command executed successfully: ${command}`, {
        service: this.category,
        executionTime: _result.metadata?.executionTime,
      });

      return _result;
    } catch (error) {
      logger.error(`Command execution failed: ${command}`, {
        service: this.category,
        error: error instanceof Error ? error.message : "Unknown error",
      });

      return {
        success: false,
        message: `Command execution failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        data: { error },
      };
    }
  }

  /**
   * Get all _commands available in this service
   */
  getAvailableCommands(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Check if a command exists in this service
   */
  hasCommand(command: string): boolean {
    return this.handlers.has(command);
  }

  /**
   * Get command suggestions for similar _commands
   */
  protected getSuggestions(input: string): string[] {
    const _commands = Array.from(this.handlers.keys());
    const suggestions: string[] = [];

    for (const command of _commands) {
      if (
        command.toLowerCase().includes(input.toLowerCase()) ||
        input.toLowerCase().includes(command.toLowerCase())
      ) {
        suggestions.push(command);
      }
    }

    return suggestions.slice(0, 3);
  }

  /**
   * Initialize the service
   * Called when service is registered
   */
  async initialize(): Promise<void> {
    logger.info(`Initializing ${this.category} command service`);

    // Initialize all handlers
    for (const [name, _handler] of this.handlers) {
      if (_handler.initialize) {
        await _handler.initialize();
        logger.debug(`Initialized command _handler: ${name}`);
      }
    }

    logger.info(
      `${this.category} service initialized with ${this.handlers.size} _commands`,
    );
  }

  /**
   * Cleanup service resources
   */
  async cleanup(): Promise<void> {
    logger.info(`Cleaning up ${this.category} command service`);

    for (const [name, _handler] of this.handlers) {
      if (_handler.cleanup) {
        await _handler.cleanup();
        logger.debug(`Cleaned up command _handler: ${name}`);
      }
    }

    this.handlers.clear();
  }

  /**
   * Get service metadata
   */
  getServiceInfo() {
    return {
      category: this.category,
      commandCount: this.handlers.size,
      _commands: this.getAvailableCommands(),
    };
  }
}
