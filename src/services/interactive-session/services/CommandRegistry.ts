// src/services/interactive-session/services/CommandRegistry.ts
// Command registration and execution with deadline support

import { CommandContext, CommandResult } from "../ports/ICommandPort";

export interface CommandHandler {
  name: string;
  description?: string;
  category?: string;
  execute(context: CommandContext): Promise<CommandResult>;
}

export interface CommandRegistration {
  handler: CommandHandler;
  deadlineMs: number;
  aliases?: string[];
}

export class CommandRegistry {
  private handlers = new Map<string, CommandRegistration>();
  private aliases = new Map<string, string>();

  /**
   * Register a command handler
   * @param name - Primary command name
   * @param handler - Command handler implementation
   * @param deadlineMs - Command-specific timeout (default 15000ms)
   * @param aliases - Alternative names for the command
   */
  register(
    name: string,
    handler: CommandHandler,
    deadlineMs = 15000,
    aliases: string[] = [],
  ): void {
    const normalizedName = this.normalize(name);

    // Register primary name
    this.handlers.set(normalizedName, {
      handler,
      deadlineMs,
      aliases,
    });

    // Register aliases
    for (const alias of aliases) {
      this.aliases.set(this.normalize(alias), normalizedName);
    }
  }

  /**
   * Execute a command by name
   * @param name - Command name (or alias)
   * @param context - Execution context
   * @returns Command result
   */
  async execute(name: string, context: CommandContext): Promise<CommandResult> {
    const normalizedName = this.normalize(name);
    const actualName = this.aliases.get(normalizedName) || normalizedName;
    const registration = this.handlers.get(actualName);

    if (!registration) {
      return {
        ok: false,
        message: `Unknown command: ${name}`,
      };
    }

    // Apply command-specific deadline if not already set
    if (!context.signal && registration.deadlineMs > 0) {
      const controller = new AbortController();
      const timer = setTimeout(
        () => controller.abort(),
        registration.deadlineMs,
      );

      try {
        const result = await registration.handler.execute({
          ...context,
          signal: controller.signal,
        });
        clearTimeout(timer);
        return result;
      } catch (error) {
        clearTimeout(timer);
        throw error;
      }
    }

    // Execute with existing signal or no deadline
    return registration.handler.execute(context);
  }

  /**
   * Check if a command exists
   * @param name - Command name to check
   * @returns true if command exists
   */
  exists(name: string): boolean {
    const normalizedName = this.normalize(name);
    return (
      this.handlers.has(normalizedName) || this.aliases.has(normalizedName)
    );
  }

  /**
   * Get all registered command names
   * @returns Array of command names
   */
  getCommands(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Get commands by category
   * @param category - Category to filter by
   * @returns Array of commands in the category
   */
  getCommandsByCategory(category: string): CommandHandler[] {
    const commands: CommandHandler[] = [];

    for (const registration of this.handlers.values()) {
      if (registration.handler.category === category) {
        commands.push(registration.handler);
      }
    }

    return commands;
  }

  /**
   * Get all categories
   * @returns Array of unique categories
   */
  getCategories(): string[] {
    const categories = new Set<string>();

    for (const registration of this.handlers.values()) {
      if (registration.handler.category) {
        categories.add(registration.handler.category);
      }
    }

    return Array.from(categories);
  }

  /**
   * Get command help text
   * @param name - Command name
   * @returns Help text or null if not found
   */
  getHelp(name: string): string | null {
    const normalizedName = this.normalize(name);
    const actualName = this.aliases.get(normalizedName) || normalizedName;
    const registration = this.handlers.get(actualName);

    if (!registration) {
      return null;
    }

    const { handler, aliases } = registration;
    let help = `${handler.name}`;

    if (handler.description) {
      help += ` - ${handler.description}`;
    }

    if (aliases && aliases.length > 0) {
      help += `\nAliases: ${aliases.join(", ")}`;
    }

    return help;
  }

  /**
   * Get deadline for a command
   * @param name - Command name
   * @returns Deadline in milliseconds or null if not found
   */
  getDeadline(name: string): number | null {
    const normalizedName = this.normalize(name);
    const actualName = this.aliases.get(normalizedName) || normalizedName;
    const registration = this.handlers.get(actualName);

    return registration ? registration.deadlineMs : null;
  }

  /**
   * Normalize command name for case-insensitive lookup
   */
  private normalize(name: string): string {
    // Remove leading slash if present and convert to lowercase
    return name.replace(/^\//, "").toLowerCase().trim();
  }

  /**
   * Clear all registered commands (for testing)
   */
  clear(): void {
    this.handlers.clear();
    this.aliases.clear();
  }
}
