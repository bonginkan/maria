/**
 * HelpCommandV2
 * Migrated help command using V2 architecture
 * Drop-in replacement for legacy HelpCommand with enhanced features
 */

import type { SlashCommandV2 } from "../SlashCommandHandler";
import type {
  CommandContext,
  CommandResult,
} from "../../types/enhanced-context";
import { throwIfAborted, safeAsync } from "../utils/abort-helpers";
import { CommandTracer, traced } from "../utils/tracing";
import { ResultAdapter } from "../adapters/ResultAdapter";
import { ProgressManager } from "../utils/ui-throttling";

interface CommandInfo {
  name: string;
  category: string;
  description: string;
  usage?: string;
  aliases?: string[];
  examples?: Array<{
    input: string;
    description: string;
    output?: string;
  }>;
}

export class HelpCommandV2 implements SlashCommandV2 {
  name = "help";
  aliases = ["h", "?"];
  description = "📚 Display help information for commands and system usage";
  category = "core";

  private commandRegistry: Map<string, CommandInfo> = new Map();

  constructor() {
    this.initializeCommandRegistry();
  }

  async execute(context: CommandContext): Promise<CommandResult> {
    const { deps, args, signal } = context;
    const { ui } = deps;

    const tracer = new CommandTracer(context);
    const progress = new ProgressManager(ui, signal);
    const startedAt = Date.now();

    try {
      tracer.startSpan("help_command_execution", {
        args: args.length,
        command: args[0] || "general",
      });

      await progress.update(0, "Loading help information...");
      throwIfAborted(signal);

      // Parse arguments
      const commandName = args[0];
      const options = this.parseOptions(args.slice(1));

      // Determine help type and execute
      let helpResult: CommandResult;

      if (commandName && !commandName.startsWith("--")) {
        // Specific command help
        helpResult = await traced(tracer, "show_command_help", () =>
          this.showCommandHelp(commandName, context),
        );
      } else if (options.category) {
        // Category help
        helpResult = await traced(tracer, "show_category_help", () =>
          this.showCategoryHelp(options.category!, context),
        );
      } else if (options.search) {
        // Search help
        helpResult = await traced(tracer, "search_commands", () =>
          this.searchCommands(options.search!, context),
        );
      } else {
        // General help
        helpResult = await traced(tracer, "show_general_help", () =>
          this.showGeneralHelp(context),
        );
      }

      throwIfAborted(signal);
      await progress.update(100, "Help information loaded");

      // Add execution metrics
      helpResult.metrics = {
        startTime: startedAt,
        endTime: Date.now(),
        duration: Date.now() - startedAt,
        memoryAccess: 0,
        providerCalls: 0,
      };

      tracer.complete(helpResult);
      return helpResult;
    } catch (error) {
      return ResultAdapter.errorResult(
        error,
        "Failed to display help information",
      );
    } finally {
      await safeAsync(() => progress.complete("Done"), undefined);
    }
  }

  /**
   * Show help for a specific command
   */
  private async showCommandHelp(
    commandName: string,
    context: CommandContext,
  ): Promise<CommandResult> {
    const { signal } = context;
    throwIfAborted(signal);

    // Clean command name
    const cleanName = commandName.startsWith("/")
      ? commandName.slice(1)
      : commandName;

    // Look up command info
    const commandInfo = this.commandRegistry.get(cleanName);

    if (!commandInfo) {
      const suggestions = this.getCommandSuggestions(cleanName);
      return {
        success: false,
        error: `Command not found: /${cleanName}`,
        messages: [
          {
            role: "assistant",
            content:
              suggestions.length > 0
                ? `Command "/${cleanName}" not found. Did you mean: ${suggestions.join(", ")}?`
                : `Command "/${cleanName}" not found. Use /help to see all available commands.`,
          },
        ],
      };
    }

    // Format detailed help
    const helpText = this.formatCommandHelp(commandInfo);

    return {
      success: true,
      messages: [
        {
          role: "assistant",
          content: helpText,
        },
      ],
      data: {
        command: cleanName,
        type: "command-specific",
        category: commandInfo.category,
      },
    };
  }

  /**
   * Show all commands in a category
   */
  private async showCategoryHelp(
    category: string,
    context: CommandContext,
  ): Promise<CommandResult> {
    const { signal } = context;
    throwIfAborted(signal);

    const commands = this.getCommandsByCategory(category);

    if (commands.length === 0) {
      const availableCategories = this.getAvailableCategories();
      return {
        success: false,
        error: `No commands found in category: ${category}`,
        messages: [
          {
            role: "assistant",
            content: `Category "${category}" not found. Available categories: ${availableCategories.join(", ")}`,
          },
        ],
      };
    }

    const helpText = this.formatCategoryHelp(category, commands);

    return {
      success: true,
      messages: [
        {
          role: "assistant",
          content: helpText,
        },
      ],
      data: {
        category,
        commandCount: commands.length,
        type: "category-specific",
      },
    };
  }

  /**
   * Search commands by keyword
   */
  private async searchCommands(
    searchTerm: string,
    context: CommandContext,
  ): Promise<CommandResult> {
    const { signal } = context;
    throwIfAborted(signal);

    const matches = this.searchCommandRegistry(searchTerm);

    if (matches.length === 0) {
      return {
        success: false,
        error: `No commands found matching: "${searchTerm}"`,
        messages: [
          {
            role: "assistant",
            content: `No commands found matching "${searchTerm}". Try a different search term or use /help to see all commands.`,
          },
        ],
      };
    }

    const helpText = this.formatSearchResults(searchTerm, matches);

    return {
      success: true,
      messages: [
        {
          role: "assistant",
          content: helpText,
        },
      ],
      data: {
        searchTerm,
        matchCount: matches.length,
        type: "search-results",
      },
    };
  }

  /**
   * Show general help overview
   */
  private async showGeneralHelp(
    context: CommandContext,
  ): Promise<CommandResult> {
    const { signal } = context;
    throwIfAborted(signal);

    const categories = this.groupCommandsByCategory();
    const helpText = this.formatGeneralHelp(categories);

    return {
      success: true,
      messages: [
        {
          role: "assistant",
          content: helpText,
        },
      ],
      data: {
        totalCommands: this.commandRegistry.size,
        categories: Object.keys(categories),
        type: "general-overview",
      },
    };
  }

  /**
   * Initialize command registry with known commands
   */
  private initializeCommandRegistry(): void {
    // Core commands
    this.commandRegistry.set("help", {
      name: "help",
      category: "core",
      description: "Display help information for commands and system usage",
      usage: "[command] [--category <category>] [--search <term>]",
      aliases: ["h", "?"],
      examples: [
        { input: "/help", description: "Show general help overview" },
        {
          input: "/help clear",
          description: "Show detailed help for clear command",
        },
        {
          input: "/help --category core",
          description: "Show all core commands",
        },
        {
          input: '/help --search "memory"',
          description: "Search for memory-related commands",
        },
      ],
    });

    this.commandRegistry.set("clear", {
      name: "clear",
      category: "conversation",
      description:
        "Clear the conversation context with advanced memory preservation options",
      usage: "[--all] [--mode=display|session] [--preserve=<tags>] [--export]",
      aliases: ["cls", "reset"],
      examples: [
        { input: "/clear", description: "Clear current conversation" },
        {
          input: "/clear --mode=display",
          description: "Clear display only, preserve memory",
        },
        {
          input: "/clear --preserve=important,project",
          description: "Clear but preserve tagged memories",
        },
        {
          input: "/clear --export",
          description: "Export memories before clearing",
        },
      ],
    });

    // Memory commands
    this.commandRegistry.set("remember", {
      name: "remember",
      category: "memory",
      description: "Store information in persistent memory",
      usage: "<content> [--tag=<tag>] [--importance=high|medium|low]",
    });

    this.commandRegistry.set("recall", {
      name: "recall",
      category: "memory",
      description: "Retrieve stored memories",
      usage: "<query> [--limit=10] [--type=<type>]",
    });

    this.commandRegistry.set("forget", {
      name: "forget",
      category: "memory",
      description: "Remove memories matching pattern",
      usage: "<pattern> [--older-than=<days>] [--confirm]",
    });

    // System commands
    this.commandRegistry.set("setup", {
      name: "setup",
      category: "system",
      description: "Configure MARIA environment and settings",
      usage: "[--reset] [--provider=<name>] [--advanced]",
    });

    // Code command
    this.commandRegistry.set("code", {
      name: "code",
      category: "code",
      description: "Natural language code operations with AST intelligence",
      usage: "<intent> [--dry-run] [--file=<path>]",
      examples: [
        {
          input: "/code create a REST API for users",
          description: "Generate REST API code",
        },
        {
          input: "/code fix TypeScript errors",
          description: "Analyze and fix TS errors",
        },
        {
          input: "/code refactor this function --file=src/utils.ts",
          description: "Refactor specific file",
        },
      ],
    });
  }

  /**
   * Parse command options
   */
  private parseOptions(args: string[]): { category?: string; search?: string } {
    const options: { category?: string; search?: string } = {};

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg === "--category" && args[i + 1]) {
        options.category = args[i + 1];
        i++; // Skip next arg
      } else if (arg === "--search" && args[i + 1]) {
        options.search = args[i + 1];
        i++; // Skip next arg
      }
    }

    return options;
  }

  /**
   * Get commands by category
   */
  private getCommandsByCategory(category: string): CommandInfo[] {
    return Array.from(this.commandRegistry.values())
      .filter((cmd) => cmd.category === category)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Get available categories
   */
  private getAvailableCategories(): string[] {
    const categories = new Set<string>();
    for (const cmd of this.commandRegistry.values()) {
      categories.add(cmd.category);
    }
    return Array.from(categories).sort();
  }

  /**
   * Search command registry
   */
  private searchCommandRegistry(searchTerm: string): CommandInfo[] {
    const term = searchTerm.toLowerCase();
    return Array.from(this.commandRegistry.values()).filter(
      (cmd) =>
        cmd.name.toLowerCase().includes(term) ||
        cmd.description.toLowerCase().includes(term) ||
        (cmd.aliases &&
          cmd.aliases.some((alias) => alias.toLowerCase().includes(term))),
    );
  }

  /**
   * Group commands by category
   */
  private groupCommandsByCategory(): Record<string, CommandInfo[]> {
    const groups: Record<string, CommandInfo[]> = {};

    for (const cmd of this.commandRegistry.values()) {
      if (!groups[cmd.category]) {
        groups[cmd.category] = [];
      }
      groups[cmd.category]!.push(cmd);
    }

    // Sort commands within each category
    for (const category in groups) {
      groups[category]!.sort((a, b) => a.name.localeCompare(b.name));
    }

    return groups;
  }

  /**
   * Get command suggestions for typos
   */
  private getCommandSuggestions(input: string): string[] {
    const suggestions: string[] = [];
    const inputLower = input.toLowerCase();

    for (const cmd of this.commandRegistry.values()) {
      if (
        cmd.name.toLowerCase().includes(inputLower) ||
        inputLower.includes(cmd.name.toLowerCase()) ||
        this.calculateSimilarity(input, cmd.name) > 0.6
      ) {
        suggestions.push(`/${cmd.name}`);
      }
    }

    return suggestions.slice(0, 5);
  }

  /**
   * Calculate string similarity (simple implementation)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0]![j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i]![j] = matrix[i - 1]![j - 1]!;
        } else {
          matrix[i]![j] = Math.min(
            matrix[i - 1]![j - 1]! + 1, // substitution
            matrix[i]![j - 1]! + 1, // insertion
            matrix[i - 1]![j]! + 1, // deletion
          );
        }
      }
    }

    return matrix[str2.length]![str1.length]!;
  }

  /**
   * Format detailed command help
   */
  private formatCommandHelp(cmd: CommandInfo): string {
    const lines: string[] = [];

    lines.push(`📘 ${cmd.name.toUpperCase()}`);
    lines.push("─".repeat(40));
    lines.push("");
    lines.push(cmd.description);
    lines.push("");

    if (cmd.usage) {
      lines.push("**Usage:**");
      lines.push(`  /${cmd.name} ${cmd.usage}`);
      lines.push("");
    }

    if (cmd.aliases && cmd.aliases.length > 0) {
      lines.push("**Aliases:**");
      lines.push(`  ${cmd.aliases.map((a) => `/${a}`).join(", ")}`);
      lines.push("");
    }

    if (cmd.examples && cmd.examples.length > 0) {
      lines.push("**Examples:**");
      for (const example of cmd.examples) {
        lines.push(`  ${example.input}`);
        lines.push(`    ${example.description}`);
        if (example.output) {
          lines.push(`    → ${example.output}`);
        }
        lines.push("");
      }
    }

    lines.push(`**Category:** ${cmd.category}`);

    return lines.join("\n");
  }

  /**
   * Format category help
   */
  private formatCategoryHelp(
    category: string,
    commands: CommandInfo[],
  ): string {
    const lines: string[] = [];
    const categoryEmoji = this.getCategoryEmoji(category);

    lines.push(`${categoryEmoji} ${category.toUpperCase()} COMMANDS`);
    lines.push("═".repeat(40));
    lines.push("");

    for (const cmd of commands) {
      lines.push(`**/${cmd.name}**`);
      lines.push(`  ${cmd.description}`);

      if (cmd.aliases && cmd.aliases.length > 0) {
        lines.push(`  Aliases: ${cmd.aliases.map((a) => `/${a}`).join(", ")}`);
      }

      if (cmd.usage) {
        lines.push(`  Usage: /${cmd.name} ${cmd.usage}`);
      }

      lines.push("");
    }

    return lines.join("\n");
  }

  /**
   * Format search results
   */
  private formatSearchResults(
    searchTerm: string,
    matches: CommandInfo[],
  ): string {
    const lines: string[] = [];

    lines.push(`🔍 SEARCH RESULTS FOR "${searchTerm}"`);
    lines.push("═".repeat(40));
    lines.push("");
    lines.push(`Found ${matches.length} matching commands:`);
    lines.push("");

    for (const cmd of matches) {
      lines.push(`**/${cmd.name}** (${cmd.category})`);
      lines.push(`  ${cmd.description}`);

      // Highlight matching terms in description
      const highlighted = cmd.description.replace(
        new RegExp(searchTerm, "gi"),
        `**$&**`,
      );
      if (highlighted !== cmd.description) {
        lines.push(`  Match: ${highlighted}`);
      }

      lines.push("");
    }

    return lines.join("\n");
  }

  /**
   * Format general help
   */
  private formatGeneralHelp(categories: Record<string, CommandInfo[]>): string {
    const lines: string[] = [];

    lines.push("");
    lines.push("🚀 MARIA CODE - AI-Powered Development Assistant");
    lines.push("═".repeat(60));
    lines.push("");
    lines.push("📚 **COMMAND REFERENCE**");
    lines.push("");

    // Quick start
    lines.push("**🏃♂️ Quick Start:**");
    lines.push("  /help <command>     - Get detailed help for any command");
    lines.push("  /setup             - First-time environment setup");
    lines.push("  /clear             - Clear conversation context");
    lines.push("  /code <intent>     - Natural language code operations");
    lines.push("");

    // Categories
    for (const [category, commands] of Object.entries(categories)) {
      const categoryEmoji = this.getCategoryEmoji(category);
      lines.push(
        `**${categoryEmoji} ${category.toUpperCase()} (${commands.length})**`,
      );

      for (const cmd of commands.slice(0, 5)) {
        const aliases =
          cmd.aliases && cmd.aliases.length > 0
            ? ` (${cmd.aliases.map((a) => `/${a}`).join(", ")})`
            : "";
        lines.push(`  /${cmd.name}${aliases} - ${cmd.description}`);
      }

      if (commands.length > 5) {
        lines.push(`  ... and ${commands.length - 5} more commands`);
      }
      lines.push("");
    }

    // Usage tips
    lines.push("**💡 Usage Tips:**");
    lines.push(
      "  • Use /help --category <name> to see all commands in a category",
    );
    lines.push("  • Use /help --search <term> to search for specific commands");
    lines.push("  • Most commands support --help flag for quick reference");
    lines.push("  • Tab completion is available for command names and options");
    lines.push("");

    return lines.join("\n");
  }

  /**
   * Get emoji for category
   */
  private getCategoryEmoji(category: string): string {
    const emojiMap: Record<string, string> = {
      core: "⚡",
      system: "🛠️",
      conversation: "💬",
      memory: "🧠",
      code: "💻",
      ai: "🤖",
      business: "💼",
      configuration: "⚙️",
      utilities: "🔧",
      graphrag: "🔍",
      evaluation: "🧪",
      multilingual: "🌍",
      learning: "📚",
    };

    return emojiMap[category] || "📋";
  }
}

/**
 * Factory function
 */
export function createHelpCommand(): SlashCommandV2 {
  return new HelpCommandV2();
}
