/**
 * CommandRegistry - Central command registration and discovery
 * - Manages command metadata and aliases
 * - Provides command discovery and help generation
 * - Supports command categorization and fuzzy search
 */

import type { CommandHandler } from "./CommandRouter";

export interface CommandMetadata {
  name: string;
  description: string;
  usage?: string;
  category?: string;
  aliases?: string[];
  examples?: string[];
  deprecated?: boolean;
  hidden?: boolean;
}

export interface RegisteredCommand {
  command: string;
  handler: CommandHandler;
  metadata: CommandMetadata;
}

export class CommandRegistry {
  private commands = new Map<string, RegisteredCommand>();
  private aliases = new Map<string, string>();
  private categories = new Map<string, Set<string>>();

  /**
   * Register a command with metadata
   */
  register(
    command: string,
    handler: CommandHandler,
    metadata: Partial<CommandMetadata> = {},
  ): void {
    if (!command.startsWith("/")) {
      throw new Error(`Command must start with '/': received "${command}"`);
    }

    if (this.commands.has(command)) {
      throw new Error(`Command already registered: ${command}`);
    }

    // Check for alias conflicts
    if (this.aliases.has(command)) {
      throw new Error(`Command conflicts with existing alias: ${command}`);
    }

    const fullMetadata: CommandMetadata = {
      name: command,
      description: metadata.description ?? "No description available",
      ...metadata,
    };

    // Register the command
    this.commands.set(command, {
      command,
      handler,
      metadata: fullMetadata,
    });

    // Register aliases
    if (fullMetadata.aliases) {
      for (const alias of fullMetadata.aliases) {
        if (this.aliases.has(alias) || this.commands.has(alias)) {
          throw new Error(
            `Alias conflicts with existing command or alias: ${alias}`,
          );
        }
        this.aliases.set(alias, command);
      }
    }

    // Register to category
    if (fullMetadata.category) {
      if (!this.categories.has(fullMetadata.category)) {
        this.categories.set(fullMetadata.category, new Set());
      }
      this.categories.get(fullMetadata.category)!.add(command);
    }
  }

  /**
   * Get a command by name or alias
   */
  get(commandOrAlias: string): RegisteredCommand | undefined {
    // Direct command lookup
    const direct = this.commands.get(commandOrAlias);
    if (direct) return direct;

    // Alias lookup
    const actualCommand = this.aliases.get(commandOrAlias);
    if (actualCommand) {
      return this.commands.get(actualCommand);
    }

    return undefined;
  }

  /**
   * Get command handler directly
   */
  getHandler(commandOrAlias: string): CommandHandler | undefined {
    return this.get(commandOrAlias)?.handler;
  }

  /**
   * Get command metadata
   */
  getMetadata(commandOrAlias: string): CommandMetadata | undefined {
    return this.get(commandOrAlias)?.metadata;
  }

  /**
   * Check if command exists
   */
  has(commandOrAlias: string): boolean {
    return (
      this.commands.has(commandOrAlias) || this.aliases.has(commandOrAlias)
    );
  }

  /**
   * List all commands
   */
  list(
    options: {
      includeHidden?: boolean;
      includeDeprecated?: boolean;
      category?: string;
    } = {},
  ): RegisteredCommand[] {
    let commands = Array.from(this.commands.values());

    // Filter by category
    if (options.category) {
      const categoryCommands = this.categories.get(options.category);
      if (categoryCommands) {
        commands = commands.filter((cmd) => categoryCommands.has(cmd.command));
      } else {
        return [];
      }
    }

    // Filter hidden
    if (!options.includeHidden) {
      commands = commands.filter((cmd) => !cmd.metadata.hidden);
    }

    // Filter deprecated
    if (!options.includeDeprecated) {
      commands = commands.filter((cmd) => !cmd.metadata.deprecated);
    }

    return commands;
  }

  /**
   * Get all categories
   */
  getCategories(): string[] {
    return Array.from(this.categories.keys()).sort();
  }

  /**
   * Get commands by category
   */
  getByCategory(category: string): RegisteredCommand[] {
    const categoryCommands = this.categories.get(category);
    if (!categoryCommands) return [];

    return Array.from(categoryCommands)
      .map((cmd) => this.commands.get(cmd))
      .filter((cmd): cmd is RegisteredCommand => cmd !== undefined)
      .filter((cmd) => !cmd.metadata.hidden);
  }

  /**
   * Fuzzy search for commands
   */
  search(query: string, limit = 10): RegisteredCommand[] {
    const normalizedQuery = query.toLowerCase();
    const results: Array<{ command: RegisteredCommand; score: number }> = [];

    for (const cmd of this.commands.values()) {
      if (cmd.metadata.hidden) continue;

      let score = 0;
      const cmdLower = cmd.command.toLowerCase();
      const nameLower = cmd.metadata.name.toLowerCase();
      const descLower = cmd.metadata.description.toLowerCase();

      // Exact match
      if (cmdLower === normalizedQuery || nameLower === normalizedQuery) {
        score = 100;
      }
      // Starts with query
      else if (
        cmdLower.startsWith(normalizedQuery) ||
        nameLower.startsWith(normalizedQuery)
      ) {
        score = 80;
      }
      // Contains query
      else if (
        cmdLower.includes(normalizedQuery) ||
        nameLower.includes(normalizedQuery)
      ) {
        score = 60;
      }
      // Description contains query
      else if (descLower.includes(normalizedQuery)) {
        score = 40;
      }
      // Alias match
      else if (
        cmd.metadata.aliases?.some((a) =>
          a.toLowerCase().includes(normalizedQuery),
        )
      ) {
        score = 50;
      }

      if (score > 0) {
        results.push({ command: cmd, score });
      }
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((r) => r.command);
  }

  /**
   * Generate help text for all commands
   */
  generateHelp(
    options: {
      format?: "plain" | "markdown";
      showExamples?: boolean;
      showUsage?: boolean;
    } = {},
  ): string {
    const format = options.format ?? "plain";
    const categories = this.getCategories();
    const lines: string[] = [];

    if (format === "markdown") {
      lines.push("# Available Commands\n");
    } else {
      lines.push("Available Commands:\n");
    }

    for (const category of categories) {
      const commands = this.getByCategory(category);
      if (commands.length === 0) continue;

      if (format === "markdown") {
        lines.push(`## ${category}\n`);
      } else {
        lines.push(`\n${category}:`);
        lines.push("-".repeat(category.length + 1));
      }

      for (const cmd of commands) {
        const { metadata } = cmd;

        if (format === "markdown") {
          lines.push(`### \`${cmd.command}\``);
          if (metadata.aliases && metadata.aliases.length > 0) {
            lines.push(
              `**Aliases:** ${metadata.aliases.map((a) => `\`${a}\``).join(", ")}`,
            );
          }
          lines.push(`**Description:** ${metadata.description}`);

          if (options.showUsage && metadata.usage) {
            lines.push(`**Usage:** \`${metadata.usage}\``);
          }

          if (options.showExamples && metadata.examples) {
            lines.push("**Examples:**");
            for (const example of metadata.examples) {
              lines.push(`  - \`${example}\``);
            }
          }

          if (metadata.deprecated) {
            lines.push("⚠️ **DEPRECATED**");
          }
          lines.push("");
        } else {
          let cmdLine = `  ${cmd.command.padEnd(20)} - ${metadata.description}`;
          if (metadata.deprecated) {
            cmdLine += " [DEPRECATED]";
          }
          lines.push(cmdLine);

          if (metadata.aliases && metadata.aliases.length > 0) {
            lines.push(`    Aliases: ${metadata.aliases.join(", ")}`);
          }

          if (options.showUsage && metadata.usage) {
            lines.push(`    Usage: ${metadata.usage}`);
          }

          if (options.showExamples && metadata.examples) {
            lines.push("    Examples:");
            for (const example of metadata.examples) {
              lines.push(`      ${example}`);
            }
          }
        }
      }
    }

    // Add uncategorized commands
    const uncategorized = this.list({ includeHidden: false }).filter(
      (cmd) => !cmd.metadata.category,
    );

    if (uncategorized.length > 0) {
      if (format === "markdown") {
        lines.push("## Other\n");
      } else {
        lines.push("\nOther:");
        lines.push("------");
      }

      for (const cmd of uncategorized) {
        const { metadata } = cmd;
        if (format === "markdown") {
          lines.push(`- \`${cmd.command}\` - ${metadata.description}`);
        } else {
          lines.push(`  ${cmd.command.padEnd(20)} - ${metadata.description}`);
        }
      }
    }

    return lines.join("\n");
  }

  /**
   * Clear all registrations (useful for testing)
   */
  clear(): void {
    this.commands.clear();
    this.aliases.clear();
    this.categories.clear();
  }

  /**
   * Export registry data (for debugging/persistence)
   */
  export(): {
    commands: Array<{ command: string; metadata: CommandMetadata }>;
    aliases: Array<{ alias: string; command: string }>;
  } {
    return {
      commands: Array.from(this.commands.values()).map((cmd) => ({
        command: cmd.command,
        metadata: cmd.metadata,
      })),
      aliases: Array.from(this.aliases.entries()).map(([alias, command]) => ({
        alias,
        command,
      })),
    };
  }

  /**
   * Import registry data
   */
  import(data: {
    commands: Array<{
      command: string;
      handler: CommandHandler;
      metadata: CommandMetadata;
    }>;
  }): void {
    this.clear();
    for (const { command, handler, metadata } of data.commands) {
      this.register(command, handler, metadata);
    }
  }
}
