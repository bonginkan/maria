/**
 * Alias System for Command Shortcuts
 * Provides customizable command aliases for efficiency
 */

import { readConfig, writeConfig } from '../utils/config';
import { logger } from '../utils/logger';
import { getCommandInfo } from '../lib/command-groups';

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
    'exit',
    'quit',
    'help',
    'clear',
    'status',
    'login',
    'logout',
    'init',
    'config',
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
    const builtIn: Array<{ alias: string; command: string; description: string }> = [
      // Short forms for common commands
      { alias: '/s', command: '/status', description: 'Quick status check' },
      { alias: '/c', command: '/config', description: 'Quick config access' },
      { alias: '/h', command: '/help', description: 'Quick help' },
      { alias: '/i', command: '/init', description: 'Quick project init' },
      { alias: '/x', command: '/exit', description: 'Quick exit' },

      // Power user shortcuts
      { alias: '/sg', command: '/suggest', description: 'Get suggestions' },
      { alias: '/ch', command: '/chain', description: 'Run command chain' },
      { alias: '/cls', command: '/clear', description: 'Clear screen' },
      { alias: '/cmp', command: '/compact', description: 'Compact memory' },

      // Development shortcuts
      { alias: '/r', command: '/review', description: 'PR review' },
      { alias: '/t', command: '/test', description: 'Run tests' },
      { alias: '/d', command: '/dev', description: 'Development mode' },
      { alias: '/b', command: '/bug', description: 'Report bug' },

      // Git shortcuts
      { alias: '/cm', command: '/commit', description: 'Git commit' },
      { alias: '/pr', command: '/pr-comments', description: 'PR comments' },
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
   * Load user-defined aliases from config
   */
  private async loadUserAliases(): Promise<void> {
    try {
      const config = await readConfig();
      if (config.aliases) {
        config.aliases.forEach((alias) => {
          this.aliases.set(alias.alias, {
            ...alias,
            createdAt: new Date(alias.createdAt),
          });
        });
      }
    } catch {
      logger.debug('No user aliases found, starting with defaults');
    }
  }

  /**
   * Save aliases to config
   */
  private async saveAliases(): Promise<void> {
    try {
      const config = await readConfig();
      config['aliases'] = Array.from(this.aliases.values()).map((alias) => ({
        ...alias,
        createdAt: alias.createdAt.toISOString(),
      }));
      await writeConfig(config);
    } catch (error: unknown) {
      logger.error('Failed to save aliases:', error);
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
    if (!alias.startsWith('/')) {
      return {
        success: false,
        message: 'Alias must start with /',
      };
    }

    if (alias.length < 2) {
      return {
        success: false,
        message: 'Alias must be at least 2 characters long',
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
    const commandInfo = getCommandInfo(command);
    if (!commandInfo) {
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
  async removeAlias(alias: string): Promise<{ success: boolean; message: string }> {
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
    const parts = input.split(' ');
    const aliasName = parts[0];
    if (!aliasName) return null;

    const additionalArgs = parts.slice(1);

    // Check user aliases first
    const userAlias = this.aliases.get(aliasName);
    if (userAlias) {
      userAlias.usageCount++;
      this.saveAliases(); // Update usage count

      return {
        command: userAlias.command,
        args: [...(userAlias.args || []), ...additionalArgs],
      };
    }

    // Check built-in aliases
    const builtInAlias = this.builtInAliases.get(aliasName);
    if (builtInAlias) {
      builtInAlias.usageCount++;

      return {
        command: builtInAlias.command,
        args: [...(builtInAlias.args || []), ...additionalArgs],
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
      userAliases: Array.from(this.aliases.values()).sort((a, b) => b.usageCount - a.usageCount),
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
    const search = partialInput.toLowerCase();

    // Search in user aliases
    this.aliases.forEach((alias) => {
      if (
        alias.alias.toLowerCase().startsWith(search) ||
        alias.command.toLowerCase().includes(search)
      ) {
        suggestions.push(alias);
      }
    });

    // Search in built-in aliases
    this.builtInAliases.forEach((alias) => {
      if (
        alias.alias.toLowerCase().startsWith(search) ||
        alias.command.toLowerCase().includes(search)
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
    const allAliases = [
      ...Array.from(this.aliases.values()),
      ...Array.from(this.builtInAliases.values()),
    ];

    return allAliases
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
        version: '1.0',
      },
      null,
      2,
    );
  }

  /**
   * Import aliases from JSON
   */
  async importAliases(jsonData: string): Promise<{ success: boolean; message: string }> {
    try {
      const data = JSON.parse(jsonData) as Record<string, unknown>;

      if (!data['userAliases'] || !Array.isArray(data['userAliases'])) {
        return {
          success: false,
          message: 'Invalid alias data format',
        };
      }

      let imported = 0;
      let skipped = 0;

      for (const alias of data['userAliases']) {
        if (!this.aliases.has(alias.alias) && !this.builtInAliases.has(alias.alias)) {
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
    } catch (error: unknown) {
      return {
        success: false,
        message: `Failed to import aliases: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}
