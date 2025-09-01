/**
 * SlashCommandHandler
 * Refactored slash command handler using port/adapter pattern
 * Provides dependency injection and clean separation of concerns
 */

import type {
  ProviderPort,
  MemoryPort,
  ContextPort,
  UiPort,
  CommandContext,
  CommandResult,
  CommandOptions,
  Message,
} from "../types/context";

export interface SlashCommandV2 {
  name: string;
  aliases?: string[];
  description: string;
  category: string;
  execute: (context: CommandContext) => Promise<CommandResult>;
}

export interface HandlerDependencies {
  provider: ProviderPort;
  memory: MemoryPort;
  context: ContextPort;
  ui: UiPort;
}

export class SlashCommandHandler {
  private commands: Map<string, SlashCommandV2> = new Map();
  private aliases: Map<string, string> = new Map();

  constructor(private deps: HandlerDependencies) {}

  /**
   * Register a command
   */
  register(command: SlashCommandV2): void {
    // Register main command name
    this.commands.set(command.name, command);

    // Register aliases
    if (command.aliases) {
      for (const alias of command.aliases) {
        this.aliases.set(alias, command.name);
      }
    }
  }

  /**
   * Execute a command with timeout support
   */
  async execute(
    commandName: string,
    args: string[],
    options: CommandOptions = {},
  ): Promise<CommandResult> {
    // Resolve command name (check aliases)
    const resolvedName = this.aliases.get(commandName) || commandName;
    const command = this.commands.get(resolvedName);

    if (!command) {
      return {
        success: false,
        error: `Unknown command: ${commandName}`,
        messages: [],
      };
    }

    // Create command context with dependencies
    const context: CommandContext = {
      command: commandName,
      args,
      options,
      deps: this.deps,
      signal: options.signal,
    };

    try {
      // Execute with timeout if specified
      if (options.timeout) {
        return await this.executeWithTimeout(command, context, options.timeout);
      }

      // Execute normally
      return await command.execute(context);
    } catch (error) {
      // Handle errors gracefully
      if (error instanceof Error && error.name === "AbortError") {
        return {
          success: false,
          error: "Command execution timed out",
          messages: [],
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        messages: [],
      };
    }
  }

  /**
   * Execute command with timeout
   */
  private async executeWithTimeout(
    command: SlashCommandV2,
    context: CommandContext,
    timeout: number,
  ): Promise<CommandResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      // Add abort signal to context
      const contextWithSignal: CommandContext = {
        ...context,
        signal: controller.signal,
      };

      const result = await command.execute(contextWithSignal);
      clearTimeout(timeoutId);
      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * List all registered commands
   */
  listCommands(): SlashCommandV2[] {
    return Array.from(this.commands.values());
  }

  /**
   * Get command by name
   */
  getCommand(name: string): SlashCommandV2 | undefined {
    const resolvedName = this.aliases.get(name) || name;
    return this.commands.get(resolvedName);
  }

  /**
   * Search commands by pattern
   */
  searchCommands(pattern: string): SlashCommandV2[] {
    const lowercasePattern = pattern.toLowerCase();
    return this.listCommands().filter(
      (cmd) =>
        cmd.name.toLowerCase().includes(lowercasePattern) ||
        cmd.description.toLowerCase().includes(lowercasePattern),
    );
  }

  /**
   * Get commands by category
   */
  getCommandsByCategory(category: string): SlashCommandV2[] {
    return this.listCommands().filter((cmd) => cmd.category === category);
  }

  /**
   * Get all categories
   */
  getCategories(): string[] {
    const categories = new Set<string>();
    for (const command of this.commands.values()) {
      categories.add(command.category);
    }
    return Array.from(categories);
  }

  /**
   * Validate command arguments
   */
  validateArgs(commandName: string, args: string[]): boolean {
    const command = this.getCommand(commandName);
    if (!command) return false;

    // Add validation logic here based on command requirements
    // For now, return true
    return true;
  }

  /**
   * Create a helper context for testing
   */
  static createTestContext(
    deps: HandlerDependencies,
    overrides?: Partial<CommandContext>,
  ): CommandContext {
    return {
      command: "test",
      args: [],
      options: {},
      deps,
      signal: undefined,
      ...overrides,
    };
  }
}

/**
 * Factory function to create handler with dependencies
 */
export function createSlashCommandHandler(
  deps: HandlerDependencies,
): SlashCommandHandler {
  return new SlashCommandHandler(deps);
}

/**
 * Helper to convert legacy commands to V2 format
 */
export function convertLegacyCommand(
  legacyCommand: any,
  executeWrapper: (context: CommandContext) => Promise<CommandResult>,
): SlashCommandV2 {
  return {
    name: legacyCommand.name,
    aliases: legacyCommand.aliases,
    description: legacyCommand.description,
    category: legacyCommand.category || "general",
    execute: executeWrapper,
  };
}

// ✅ Dual export support for CJS/ESM compatibility
export type { SlashCommandV2 as SlashCommand };
export default SlashCommandHandler;
