/**
 * Unified Command Registry
 * Bridges the gap between legacy command-registry.ts and slash-_commands system
 * Provides a single point of command registration and execution
 */

import chalk from "chalk";
import type { MariaAI } from "../maria-ai";
import type { DualMemoryEngine } from "./memory-system/dual-memory-engine";
import type { MemoryCoordinator } from "./memory-system/memory-coordinator";
import { CommandRegistry as LegacyRegistry } from "./command-registry";
import { SlashCommandHandler } from "../shared/adapters/LegacySlashCommandAdapter";
import type { _CommandInfo, CommandCategory } from "../lib/command-groups";
import { DEFAULT_CONFIG } from "../config/defaults";
import { getAppNameWithVersion } from "../utils/version";

// Import unified _commands
import { executeInit } from "../_commands/unified/init";
import { executeHelp } from "../_commands/unified/help";
import { executeStatus } from "../_commands/unified/status";

export interface UnifiedCommandInfo {
  name: string;
  description: string;
  category: CommandCategory;
  handler: CommandHandler;
  _aliases?: string[];
  usage?: string;
  examples?: string[];
  hidden?: boolean;
}

export type CommandHandler = (
  args: string[],
  maria: MariaAI,
  memoryEngine?: DualMemoryEngine | null,
  memoryCoordinator?: MemoryCoordinator | null,
) => Promise<boolean | "exit">;

export class UnifiedCommandRegistry {
  private _commands = new Map<string, UnifiedCommandInfo>();
  private _aliases = new Map<string, string>();
  private legacyRegistry: LegacyRegistry;
  private slashCommandHandler: SlashCommandHandler;
  private appConfig: typeof DEFAULT_CONFIG;

  constructor() {
    this.legacyRegistry = new LegacyRegistry();
    this.slashCommandHandler = SlashCommandHandler.getInstance();
    this.appConfig = DEFAULT_CONFIG;

    // Initialize with built-in _commands
    this.registerBuiltInCommands();
  }

  /**
   * Register a command in the unified registry
   */
  register(_commandInfo: UnifiedCommandInfo): void {
    this._commands.set(commandInfo.name, _commandInfo);

    // Register _aliases
    if (commandInfo._aliases) {
      for (const alias of commandInfo._aliases) {
        this._aliases.set(alias, commandInfo.name);
      }
    }

    console.debug(
      chalk.gray(
        `📝 Registered command: ${commandInfo.name} (${commandInfo.category})`,
      ),
    );
  }

  /**
   * Execute a command through the unified system
   */
  async execute(
    command: string,
    args: string[] = [],
    maria: MariaAI,
    memoryEngine?: DualMemoryEngine | null,
    memoryCoordinator?: MemoryCoordinator | null,
  ): Promise<boolean | "exit"> {
    // Remove leading slash if present
    const _cleanCommand = command.startsWith("/") ? command.slice(1) : command;

    // Try unified registry first
    const _actualCommand = this._aliases.get(_cleanCommand) || _cleanCommand;
    const _commandInfo = this._commands.get(_actualCommand);

    if (_commandInfo) {
      try {
        console.debug(
          chalk.gray(`🔧 Executing unified command: ${_actualCommand}`),
        );
        return await _commandInfo.handler(
          args,
          maria,
          memoryEngine,
          memoryCoordinator,
        );
      } catch (error) {
        console.error(
          chalk.red(`⚠️ Unified command error for '${_cleanCommand}':`),
          error,
        );
        return true; // Continue session despite error
      }
    }

    // Fallback to slash command handler
    if (command.startsWith("/")) {
      try {
        console.debug(chalk.gray(`🔀 Fallback to slash command: ${command}`));
        const _context = {
          userId: "default",
          sessionId: Date.now().toString(),
          timestamp: new Date(),
          metadata: {
            lastAIResponse: "",
          },
        };

        const _result = await this.slashCommandHandler.handleCommand(
          command,
          args,
          _context,
        );
        return _result.success;
      } catch (innerError) {
        console.error(
          chalk.red(`⚠️ Slash command error for '${command}':`),
          error,
        );
        return true; // Continue session
      }
    }

    // Fallback to legacy registry
    try {
      console.debug(
        chalk.gray(`🔄 Fallback to legacy command: ${_cleanCommand}`),
      );
      return await this.legacyRegistry.execute(
        _cleanCommand,
        args,
        maria,
        memoryEngine,
        memoryCoordinator,
      );
    } catch (error) {
      console.error(
        chalk.red(`⚠️ Legacy command error for '${_cleanCommand}':`),
        error,
      );
      return false; // Command not found
    }
  }

  /**
   * Check if command exists in any system
   */
  has(command: string): boolean {
    const _cleanCommand = command.startsWith("/") ? command.slice(1) : command;

    return (
      this._commands.has(_cleanCommand) ||
      this._aliases.has(_cleanCommand) ||
      this.legacyRegistry.has(_cleanCommand) ||
      this.isSlashCommandAvailable(command)
    );
  }

  /**
   * Check if slash command is available (simplified check)
   */
  private isSlashCommandAvailable(command: string): boolean {
    // Basic check for common slash _commands
    const _commonSlashCommands = [
      "/save",
      "/saveto",
      "/code",
      "/test",
      "/review",
      "/image",
      "/video",
      "/init",
      "/add-dir",
      "/model",
      "/config",
      "/status",
      "/doctor",
      "/mode",
      "/setup",
      "/upgrade",
      "/login",
      "/logout",
    ];

    return _commonSlashCommands.includes(command);
  }

  /**
   * Get all available _commands
   */
  getCommands(): UnifiedCommandInfo[] {
    return Array.from(this._commands.values()).sort(
      (a, b) =>
        a.category.localeCompare(b.category) || a.name.localeCompare(b.name),
    );
  }

  /**
   * Get _commands by category
   */
  getCommandsByCategory(category: CommandCategory): UnifiedCommandInfo[] {
    return Array.from(this._commands.values())
      .filter((cmd) => cmd.category === category)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Get help information for a command
   */
  getHelp(command: string): string {
    const _cleanCommand = command.startsWith("/") ? command.slice(1) : command;
    const _actualCommand = this.aliases.get(_cleanCommand) || _cleanCommand;
    const _commandInfo = this.commands.get(_actualCommand);

    if (!_commandInfo) {
      return chalk.red(`Command '${_cleanCommand}' not found`);
    }

    let help =
      chalk.cyan(`/${_commandInfo.name}`) + " - " + _commandInfo.description;

    if (_commandInfo.usage) {
      help += "\n" + chalk.gray("Usage: ") + _commandInfo.usage;
    }

    if (_commandInfo._aliases && _commandInfo._aliases.length > 0) {
      help +=
        "\n" +
        chalk.gray("Aliases: ") +
        _commandInfo._aliases.map((a: string) => `/${a}`).join(", ");
    }

    if (_commandInfo.examples && _commandInfo.examples.length > 0) {
      help += "\n" + chalk.gray("Examples:");
      for (const example of _commandInfo.examples) {
        help += "\n  " + chalk.dim(example);
      }
    }

    return help;
  }

  /**
   * Register built-in _commands
   */
  private registerBuiltInCommands(): void {
    // Core _commands
    this.register({
      name: "help",
      description: "Show help information and command list",
      category: "core",
      _aliases: ["h", "?"],
      usage:
        "/help [command|category] [--category <category>] [--search <term>]",
      examples: [
        "/help",
        "/help /init",
        "/help --category core",
        '/help --search "config"',
      ],
      handler: executeHelp,
    });

    this.register({
      name: "exit",
      description: "Exit MARIA",
      category: "core",
      _aliases: ["quit", "q"],
      usage: "/exit",
      examples: ["/exit"],
      handler: async () => {
        console.log(chalk.yellow("👋 Goodbye!"));
        return "exit";
      },
    });

    this.register({
      name: "clear",
      description: "Clear the screen",
      category: "core",
      _aliases: ["cls"],
      usage: "/clear",
      examples: ["/clear"],
      handler: async () => {
        process.stdout.write("\u001b[2J\u001b[3J\u001b[H");
        return true;
      },
    });

    // System _commands
    this.register({
      name: "version",
      description: "Show MARIA version",
      category: "system",
      _aliases: ["v"],
      usage: "/version",
      examples: ["/version"],
      handler: async () => {
        console.log(getAppNameWithVersion());
        return true;
      },
    });

    this.register({
      name: "status",
      description: "Display comprehensive system status and health information",
      category: "system",
      _aliases: ["st", "info", "sys"],
      usage: "/status [--detailed] [--json]",
      examples: ["/status", "/status --detailed", "/status --json"],
      handler: executeStatus,
    });

    // Unified project _commands
    this.register({
      name: "init",
      description: "Initialize MARIA configuration for the project",
      category: "configuration",
      _aliases: ["initialize", "setup"],
      usage: "/init [--force] [--no-interactive]",
      examples: ["/init", "/init --force", "/init --no-interactive"],
      handler: executeInit,
    });

    console.log(chalk.green("✅ Built-in _commands registered"));
  }

  /**
   * Show all available _commands grouped by category
   */
  private showAllCommands(): void {
    const _commands = this.getCommands();
    const _categories = new Map<CommandCategory, UnifiedCommandInfo[]>();

    // Group _commands by category
    for (const cmd of _commands) {
      if (!_categories.has(cmd.category)) {
        _categories.set(cmd.category, []);
      }
      _categories.get(cmd.category)!.push(cmd);
    }

    console.log(chalk.cyan("\n📚 Available Commands:\n"));

    // Display _commands by category
    for (const [category, categoryCommands] of _categories) {
      if (
        categoryCommands.length === 0 ||
        categoryCommands.every((cmd) => cmd.hidden)
      ) {
        continue;
      }

      console.log(
        chalk.bold.magenta(
          `${this.getCategoryIcon(category)} ${this.getCategoryName(category)}`,
        ),
      );

      for (const cmd of categoryCommands) {
        if (cmd.hidden) continue;

        const _aliases = cmd._aliases
          ? chalk.gray(
              ` (${cmd._aliases.map((a: string) => `/${a}`).join(", ")})`,
            )
          : "";
        console.log(
          `  ${chalk.cyan(`/${cmd.name}`)}${_aliases} - ${cmd.description}`,
        );
      }

      console.log();
    }

    console.log(chalk.gray("💡 Use /help <command> for detailed information"));
  }

  /**
   * Get category icon
   */
  private getCategoryIcon(category: CommandCategory): string {
    const _icons = {
      core: "📝",
      generation: "🚀",
      analysis: "🔍",
      quality: "🛡️",
      development: "⚙️",
      workflow: "🔄",
      configuration: "📋",
      auth: "🔐",
      media: "🎨",
      integration: "🔗",
      system: "🏥",
      optimization: "⚡",
      creative: "🎨",
      implementation: "🔧",
      evolution: "🧠",
      monitoring: "📊",
      file: "📁",
      "coding-agent": "🤖",
    };
    return _icons[category] || "📝";
  }

  /**
   * Get category display name
   */
  private getCategoryName(category: CommandCategory): string {
    const _names = {
      core: "Core Commands",
      generation: "Content Generation",
      analysis: "Analysis & Review",
      quality: "Code Quality",
      development: "Development Tools",
      workflow: "Workflow Automation",
      configuration: "Configuration",
      auth: "Authentication",
      media: "Media Generation",
      integration: "Integration",
      system: "System & Diagnostics",
      optimization: "Performance Optimization",
      creative: "Creative Tools",
      implementation: "Implementation Utilities",
      evolution: "RL Evolution",
      monitoring: "Monitoring",
      file: "File Operations",
      "coding-agent": "Coding Agent",
    };
    return _names[category] || category;
  }
}

// Singleton instance
let unifiedRegistryInstance: UnifiedCommandRegistry | null = null;

export function getUnifiedCommandRegistry(): UnifiedCommandRegistry {
  if (!unifiedRegistryInstance) {
    unifiedRegistryInstance = new UnifiedCommandRegistry();
  }
  return unifiedRegistryInstance;
}
