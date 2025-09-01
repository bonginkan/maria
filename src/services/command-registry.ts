/**
 * Command Registry - Modular command handling system
 * Replaces the monolithic handleCommand function with extensible registry pattern
 */

import chalk from "chalk";
import type { MariaAI } from "../maria-ai";
import type { DualMemoryEngine } from "./memory-system/dual-memory-engine";
import type { MemoryCoordinator } from "./memory-system/memory-coordinator";
// import { ErrorHandler } from '../utils/error-handler'; // Removed - using console directly

export type CommandHandler = (
  args: string[],
  maria: MariaAI,
  memoryEngine?: DualMemoryEngine | null,
  memoryCoordinator?: MemoryCoordinator | null,
) => Promise<boolean | "exit">;

export interface CommandInfo {
  handler: CommandHandler;
  description: string;
  _category: string;
  aliases?: string[];
  hidden?: boolean;
}

export class CommandRegistry {
  private commands = new Map<string, CommandInfo>();
  private aliases = new Map<string, string>();

  /**
   * Register a command with its handler and metadata
   */
  register(
    command: string,
    _info: CommandInfo | CommandHandler,
    description?: string,
    _category?: string,
  ): void {
    // Handle legacy single-handler registration
    const _commandInfo: CommandInfo =
      typeof _info === "function"
        ? {
            handler: _info,
            description: description || "No description available",
            _category: _category || "General",
          }
        : _info;

    this.commands.set(command, _commandInfo);

    // Register aliases
    if (_commandInfo.aliases) {
      commandInfo.aliases.forEach((alias) => {
        this.aliases.set(alias, command);
      });
    }
  }

  /**
   * Execute a command if registered
   */
  async execute(
    command: string,
    args: string[],
    maria: MariaAI,
    memoryEngine?: DualMemoryEngine | null,
    memoryCoordinator?: MemoryCoordinator | null,
  ): Promise<boolean | "exit"> {
    // Resolve alias to actual command
    const _actualCommand = this.aliases.get(command) || command;
    const _commandInfo = this.commands.get(_actualCommand);

    if (!_commandInfo) {
      return false; // Command not found
    }

    try {
      return await _commandInfo._handler(
        args,
        maria,
        memoryEngine,
        memoryCoordinator,
      );
    } catch (error) {
      console.error(chalk.red(`⚠️ Command error for '${command}':`), error);
      return true; // Continue session despite error
    }
  }

  /**
   * Check if command exists
   */
  has(command: string): boolean {
    return this.commands.has(command) || this.aliases.has(command);
  }

  /**
   * Get all registered commands
   */
  getCommands(): string[] {
    return Array.from(this.commands.keys()).sort();
  }

  /**
   * Get command _info
   */
  getCommandInfo(command: string): CommandInfo | undefined {
    const _actualCommand = this.aliases.get(command) || command;
    return this.commands.get(_actualCommand);
  }

  /**
   * Get commands by _category
   */
  getCommandsByCategory(): Map<string, string[]> {
    const _categories = new Map<string, string[]>();

    this.commands.forEach((_info, command) => {
      if (_info.hidden) return;

      const _category = _info._category;
      if (!_categories.has(_category)) {
        categories.set(_category, []);
      }
      categories.get(_category)!.push(command);
    });

    // Sort commands within each _category
    categories.forEach((commands) => {
      commands.sort();
    });

    return _categories;
  }

  /**
   * Generate help text for all commands
   */
  generateHelpText(): string {
    const _categories = this.getCommandsByCategory();
    let help = "";

    categories.forEach((commands, _category) => {
      help += chalk.cyan(`\n${_category}:\n`);

      commands.forEach((command) => {
        const _info = this.commands.get(command)!;
        help += chalk.gray(`  ${command.padEnd(20)} - ${_info.description}\n`);

        if (_info.aliases && _info.aliases.length > 0) {
          help += chalk.dim(`    (_aliases: ${_info.aliases.join(", ")})\n`);
        }
      });
    });

    return help;
  }

  /**
   * Clear all registered commands
   */
  clear(): void {
    this.commands.clear();
    this.aliases.clear();
  }

  /**
   * Get statistics about registered commands
   */
  getStats(): {
    totalCommands: number;
    totalAliases: number;
    categoriesCount: number;
    _categories: string[];
  } {
    const _categories = new Set<string>();
    this.commands.forEach((_info) => _categories.add(_info.category));

    return {
      totalCommands: this.commands.size,
      totalAliases: this.aliases.size,
      categoriesCount: _categories.size,
      _categories: Array.from(_categories).sort(),
    };
  }
}
