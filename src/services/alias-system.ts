/**
 * Alias System for Command Shortcuts
 * Provides customizable command aliases for efficiency
 */

import { readConfig, writeConfig } from "../utils/config";
import { logger as _logger } from "../utils/logger";
const logger = _logger;
import { getCommandInfo } from "../lib/command-groups";

export interface CommandAlias {
  alias: string;
  command: string;
  description?: string;
  args?: string[];
  createdAt: Date;
  usageCount: number;
}

export interface AliasConfig {
  aliases: CommandAlias[];
  reservedAliases: string[];
}

export class AliasSystem {
  private static instance: AliasSystem;
  private aliases: Map<string, CommandAlias> = new Map();
  private builtInAliases: Map<string, CommandAlias> = new Map();
  private reservedWords = new Set([
    "exit",
    "quit",
    "help",
    "clear",
    "status",
    "login",
    "logout",
    "init",
    "_config",
  ]);

  private constructor() {
    this.initializeBuiltInAliases();
    this.loadUserAliases();
  }

  public static getInstance(): AliasSystem {
    if (!AliasSystem.instance) {
      AliasSystem.instance = new AliasSystem();
    }
    return AliasSystem.instance;
  }

  /**
   * Initialize built-in aliases
   */
  private initializeBuiltInAliases(): void {
    const builtIn: Array<{
      alias: string;
      command: string;
      description: string;
    }> = [
      // Short forms for common commands
      { alias: "/s", command: "/status", description: "Quick status check" },
      { alias: "/c", command: "/_config", description: "Quick _config access" },
      { alias: "/h", command: "/help", description: "Quick help" },
      { alias: "/i", command: "/init", description: "Quick project init" },
      { alias: "/x", command: "/exit", description: "Quick exit" },

      // Power user shortcuts
      { alias: "/sg", command: "/suggest", description: "Get suggestions" },
      { alias: "/ch", command: "/chain", description: "Run command chain" },
      { alias: "/cls", command: "/clear", description: "Clear screen" },
      { alias: "/cmp", command: "/compact", description: "Compact memory" },

      // Development shortcuts
      { alias: "/r", command: "/review", description: "PR review" },
      { alias: "/t", command: "/test", description: "Run tests" },
      { alias: "/d", command: "/dev", description: "Development mode" },
      { alias: "/b", command: "/bug", description: "Report bug" },

      // Git shortcuts
      { alias: "/cm", command: "/commit", description: "Git commit" },
      { alias: "/pr", command: "/pr-comments", description: "PR comments" },
    ];

    builtIn.forEach(({ alias, command, description }) => {
      this.builtInAliases.set(alias, {
        alias,
        command,
        description,
        createdAt: new Date(),
        usageCount: 0,
      });
    });
  }

  /**
   * Load user-defined aliases from _config
   */
  private async loadUserAliases(): Promise<void> {
    try {
      const _config = await readConfig();
      if (_config.aliases) {
        _config.aliases.forEach((alias) => {
          this.aliases.set(alias.alias, {
            ...alias,
            createdAt: new Date(alias.createdAt),
          });
        });
      }
    } catch {
      logger.debug("No user aliases found, starting with defaults");
    }
  }

  /**
   * Save aliases to _config
   */
  private async saveAliases(): Promise<void> {
    try {
      const _config = await readConfig();
      _config["aliases"] = Array.from(this.aliases.values()).map((alias) => ({
        ...alias,
        createdAt: alias.createdAt.toISOString(),
      }));
      await writeConfig(_config);
    } catch (_error: unknown) {
      logger.error("Failed to save aliases:", _error);
    }
  }

  /**
   * Create a new alias
   */
  async createAlias(
    alias: string,
    command: string,
    description?: string,
    args?: string[],
  ): Promise<{ success: boolean; message: string }> {
    // Validate alias
    if (!alias.startsWith("/")) {
      return {
        success: false,
        message: "Alias must start with /",
      };
    }

    if (alias.length < 2) {
      return {
        success: false,
        message: "Alias must be at least 2 characters long",
      };
    }

    if (this.reservedWords.has(alias.substring(1))) {
      return {
        success: false,
        message: `"${alias}" is a reserved word and cannot be used as an alias`,
      };
    }

    // Check if alias already exists
    if (this.aliases.has(alias) || this.builtInAliases.has(alias)) {
      return {
        success: false,
        message: `Alias "${alias}" already exists`,
      };
    }

    // Validate command
    const _commandInfo = getCommandInfo(command);
    if (!_commandInfo) {
      return {
        success: false,
        message: `Command "${command}" does not exist`,
      };
    }

    // Create alias
    const newAlias: CommandAlias = {
      alias,
      command,
      description: description || `Alias for ${command}`,
      args,
      createdAt: new Date(),
      usageCount: 0,
    };

    this.aliases.set(alias, newAlias);
    await this.saveAliases();

    return {
      success: true,
      message: `Alias "${alias}" → "${command}" created successfully`,
    };
  }

  /**
   * Remove an alias
   */
  async removeAlias(
    alias: string,
  ): Promise<{ success: boolean; message: string }> {
    if (this.builtInAliases.has(alias)) {
      return {
        success: false,
        message: `Cannot remove built-in alias "${alias}"`,
      };
    }

    if (!this.aliases.has(alias)) {
      return {
        success: false,
        message: `Alias "${alias}" not found`,
      };
    }

    this.aliases.delete(alias);
    await this.saveAliases();

    return {
      success: true,
      message: `Alias "${alias}" removed successfully`,
    };
  }

  /**
   * Resolve an alias to its command
   */
  resolveAlias(input: string): { command: string; args: string[] } | null {
    const _parts = input.split(" ");
    const _aliasName = _parts[0];
    if (!_aliasName) {
      return null;
    }

    const _additionalArgs = _parts.slice(1);

    // Check user aliases first
    const _userAlias = this.aliases.get(_aliasName);
    if (_userAlias) {
      _userAlias.usageCount++;
      this.saveAliases(); // Update usage count

      return {
        command: _userAlias.command,
        args: [...(_userAlias.args || []), ..._additionalArgs],
      };
    }

    // Check built-in aliases
    const _builtInAlias = this.builtInAliases.get(_aliasName);
    if (_builtInAlias) {
      _builtInAlias.usageCount++;

      return {
        command: _builtInAlias.command,
        args: [...(_builtInAlias.args || []), ..._additionalArgs],
      };
    }

    return null;
  }

  /**
   * List all aliases
   */
  listAliases(): {
    userAliases: CommandAlias[];
    builtInAliases: CommandAlias[];
  } {
    return {
      userAliases: Array.from(this.aliases.values()).sort(
        (a, b) => b.usageCount - a.usageCount,
      ),
      builtInAliases: Array.from(this.builtInAliases.values()).sort((a, b) =>
        a.alias.localeCompare(b.alias),
      ),
    };
  }

  /**
   * Get alias suggestions based on input
   */
  getSuggestions(partialInput: string): CommandAlias[] {
    const suggestions: CommandAlias[] = [];
    const _search = partialInput.toLowerCase();

    // Search in user aliases
    this.aliases.forEach((alias) => {
      if (
        alias.alias.toLowerCase().startsWith(_search) ||
        alias.command.toLowerCase().includes(_search)
      ) {
        suggestions.push(alias);
      }
    });

    // Search in built-in aliases
    this.builtInAliases.forEach((alias) => {
      if (
        alias.alias.toLowerCase().startsWith(_search) ||
        alias.command.toLowerCase().includes(_search)
      ) {
        suggestions.push(alias);
      }
    });

    return suggestions.sort((a, b) => b.usageCount - a.usageCount).slice(0, 5);
  }

  /**
   * Get most used aliases
   */
  getMostUsedAliases(limit = 5): CommandAlias[] {
    const _allAliases = [
      ...Array.from(this.aliases.values()),
      ...Array.from(this.builtInAliases.values()),
    ];

    return _allAliases
      .filter((alias) => alias.usageCount > 0)
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, limit);
  }

  /**
   * Export aliases to JSON
   */
  exportAliases(): string {
    return JSON.stringify(
      {
        userAliases: Array.from(this.aliases.values()),
        createdAt: new Date().toISOString(),
        version: "1.0",
      },
      null,
      2,
    );
  }

  /**
   * Import aliases from JSON
   */
  async importAliases(
    jsonData: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const _data = JSON.parse(jsonData) as Record<string, unknown>;

      if (!_data["userAliases"] || !Array.isArray(_data["userAliases"])) {
        return {
          success: false,
          message: "Invalid alias _data format",
        };
      }

      let imported = 0;
      let skipped = 0;

      for (const alias of _data["userAliases"]) {
        if (
          !this.aliases.has(alias.alias) &&
          !this.builtInAliases.has(alias.alias)
        ) {
          this.aliases.set(alias.alias, {
            ...alias,
            createdAt: new Date(alias.createdAt || new Date()),
            usageCount: alias.usageCount || 0,
          });
          imported++;
        } else {
          skipped++;
        }
      }

      await this.saveAliases();

      return {
        success: true,
        message: `Imported ${imported} aliases (${skipped} skipped due to conflicts)`,
      };
    } catch (_error: unknown) {
      return {
        success: false,
        message: `Failed to import aliases: ${_error instanceof Error ? _error.message : "Unknown _error"}`,
      };
    }
  }
}
