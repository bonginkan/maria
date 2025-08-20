/**
 * Interactive Help Command Selector
 * Arrow key navigation for slash commands with immediate execution
 */

import * as readline from 'readline';
import chalk from 'chalk';
import { commandCategories, getCommandsByCategory, CommandCategory } from '../lib/command-groups';

interface CommandOption {
  name: string;
  category: string;
  description: string;
  usage?: string;
  examples?: string[];
  aliases?: string[];
}

export class InteractiveHelpSelector {
  private commands: CommandOption[] = [];
  private selectedIndex = 0;
  private rl: readline.Interface;
  private searchMode = false;
  private searchQuery = '';
  private filteredCommands: CommandOption[] = [];

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });

    // Enable raw mode for arrow key detection
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    readline.emitKeypressEvents(process.stdin, this.rl);
  }

  async initialize(): Promise<void> {
    // Build comprehensive command list
    this.commands = [];

    // Get all commands from all categories
    Object.entries(commandCategories).forEach(([categoryKey, categoryName]) => {
      const category = categoryKey as CommandCategory;
      const categoryCommands = getCommandsByCategory(category);

      categoryCommands.forEach((cmd) => {
        this.commands.push({
          name: cmd.name,
          category: categoryName,
          description: cmd.description,
          usage: cmd.usage,
          examples: cmd.examples,
          aliases: cmd.aliases,
        });
      });
    });

    // Sort commands alphabetically
    this.commands.sort((a, b) => a.name.localeCompare(b.name));
    this.filteredCommands = [...this.commands];
  }

  async selectCommand(): Promise<string | null> {
    return new Promise((resolve) => {
      this.render();

      process.stdin.on('keypress', (chunk, key) => {
        if (this.searchMode) {
          this.handleSearchInput(chunk, key, resolve);
        } else {
          this.handleNavigationInput(key, resolve);
        }
      });
    });
  }

  private handleNavigationInput(
    key: { name?: string; ctrl?: boolean; sequence?: string },
    resolve: (value: string | null) => void,
  ): void {
    if (key.name === 'up') {
      this.selectedIndex = Math.max(0, this.selectedIndex - 1);
      this.render();
    } else if (key.name === 'down') {
      this.selectedIndex = Math.min(this.getActiveCommands().length - 1, this.selectedIndex + 1);
      this.render();
    } else if (key.name === 'return') {
      const selected = this.getActiveCommands()[this.selectedIndex];
      if (selected) {
        console.log(chalk.green(`\n✅ Executing: ${selected.name}`));
        this.cleanup();
        resolve(selected.name);
      } else {
        this.cleanup();
        resolve(null);
      }
    } else if (key.name === 'escape' || (key.ctrl && key.name === 'c')) {
      this.cleanup();
      resolve(null);
    } else if (key.name === 'slash' || key.sequence === '/') {
      // Start search mode
      this.searchMode = true;
      this.searchQuery = '/';
      this.render();
    } else if (key.name === 'space' || key.sequence === ' ') {
      // Show detailed help for selected command
      this.showDetailedHelp();
    } else if (key.sequence && /^[a-zA-Z0-9]$/.test(key.sequence)) {
      // Start search mode with the typed character
      this.searchMode = true;
      this.searchQuery = key.sequence;
      this.filterCommands();
      this.selectedIndex = 0;
      this.render();
    }
  }

  private handleSearchInput(
    _chunk: unknown,
    key: { name?: string; ctrl?: boolean; sequence?: string },
    resolve: (value: string | null) => void,
  ): void {
    if (key.name === 'escape' || (key.ctrl && key.name === 'c')) {
      this.cleanup();
      resolve(null);
    } else if (key.name === 'return') {
      if (this.filteredCommands.length > 0 && this.selectedIndex < this.filteredCommands.length) {
        const selected = this.filteredCommands[this.selectedIndex];
        if (selected) {
          console.log(chalk.green(`\n✅ Executing: ${selected.name}`));
          this.cleanup();
          resolve(selected.name);
        } else {
          this.cleanup();
          resolve(null);
        }
      } else {
        this.searchMode = false;
        this.searchQuery = '';
        this.filteredCommands = [...this.commands];
        this.selectedIndex = 0;
        this.render();
      }
    } else if (key.name === 'backspace') {
      if (this.searchQuery.length > 0) {
        this.searchQuery = this.searchQuery.slice(0, -1);
        this.filterCommands();
        this.selectedIndex = 0;
        this.render();
      }
      if (this.searchQuery.length === 0) {
        this.searchMode = false;
        this.filteredCommands = [...this.commands];
        this.render();
      }
    } else if (key.name === 'up') {
      this.selectedIndex = Math.max(0, this.selectedIndex - 1);
      this.render();
    } else if (key.name === 'down') {
      this.selectedIndex = Math.min(this.filteredCommands.length - 1, this.selectedIndex + 1);
      this.render();
    } else if (
      key.sequence &&
      key.sequence.length === 1 &&
      /^[a-zA-Z0-9/\-_]$/.test(key.sequence)
    ) {
      this.searchQuery += key.sequence;
      this.filterCommands();
      this.selectedIndex = 0;
      this.render();
    }
  }

  private filterCommands(): void {
    const query = this.searchQuery.toLowerCase();
    this.filteredCommands = this.commands.filter(
      (cmd) =>
        cmd.name.toLowerCase().includes(query) ||
        cmd.description.toLowerCase().includes(query) ||
        cmd.category.toLowerCase().includes(query) ||
        (cmd.aliases && cmd.aliases.some((alias) => alias.toLowerCase().includes(query))),
    );
  }

  private getActiveCommands(): CommandOption[] {
    return this.searchMode ? this.filteredCommands : this.commands;
  }

  private render(): void {
    console.clear();

    if (this.searchMode) {
      console.log(chalk.bold.cyan('🔍 Search Commands'));
      console.log(chalk.gray('Type to filter, ↑↓ to navigate, Enter to select, ESC to cancel'));
      console.log(chalk.yellow(`Search: ${this.searchQuery}${chalk.gray('_')}\n`));
    } else {
      console.log(chalk.bold.cyan('📚 MARIA Command Help'));
      console.log(
        chalk.gray(
          '↑↓ arrows to navigate, Enter to execute, Space for details, Type to search, ESC to cancel',
        ),
      );
      console.log();
    }

    const activeCommands = this.getActiveCommands();

    if (activeCommands.length === 0) {
      console.log(chalk.red('No commands found matching your search.'));
      return;
    }

    // Group commands by category for better organization
    const grouped = activeCommands.reduce(
      (acc, cmd) => {
        if (!acc[cmd.category]) {
          acc[cmd.category] = [];
        }
        acc[cmd.category]!.push(cmd);
        return acc;
      },
      {} as Record<string, CommandOption[]>,
    );

    let currentIndex = 0;

    Object.entries(grouped).forEach(([category, commands], categoryIndex) => {
      if (!this.searchMode && categoryIndex > 0) {
        console.log(); // Add spacing between categories
      }

      if (!this.searchMode) {
        console.log(chalk.bold.blue(`📁 ${category}`));
      }

      commands.forEach((cmd) => {
        const isSelected = currentIndex === this.selectedIndex;
        const prefix = isSelected ? chalk.cyan('▶ ') : '  ';
        const name = chalk.bold(cmd.name);
        const description = chalk.dim(cmd.description);

        let line = `${prefix}${name} - ${description}`;

        if (isSelected) {
          line = chalk.bgBlue(chalk.white(line));
        }

        console.log(line);

        // Show usage if selected and not in search mode
        if (isSelected && !this.searchMode && cmd.usage) {
          console.log(chalk.gray(`      Usage: ${cmd.usage}`));
        }

        currentIndex++;
      });
    });

    // Status bar
    console.log(chalk.gray('\n─'.repeat(60)));
    console.log(
      chalk.gray(
        `Commands: ${activeCommands.length}/${this.commands.length} | Space: Details | Enter: Execute | ESC: Cancel`,
      ),
    );
  }

  private showDetailedHelp(): void {
    const selected = this.getActiveCommands()[this.selectedIndex];
    if (!selected) return;

    console.clear();
    console.log(chalk.bold.cyan(`📖 Detailed Help: ${selected.name}\n`));
    console.log(chalk.yellow(`Category: ${selected.category}`));
    console.log(chalk.white(`Description: ${selected.description}\n`));

    if (selected.usage) {
      console.log(chalk.green('Usage:'));
      console.log(chalk.white(`  ${selected.usage}\n`));
    }

    if (selected.examples && selected.examples.length > 0) {
      console.log(chalk.green('Examples:'));
      selected.examples.forEach((example) => {
        console.log(chalk.white(`  ${example}`));
      });
      console.log();
    }

    if (selected.aliases && selected.aliases.length > 0) {
      console.log(chalk.green('Aliases:'));
      selected.aliases.forEach((alias) => {
        console.log(chalk.white(`  ${alias}`));
      });
      console.log();
    }

    console.log(chalk.gray('Press any key to return to the command list...'));

    // Wait for any key press
    process.stdin.once('keypress', () => {
      this.render();
    });
  }

  private cleanup(): void {
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
    process.stdin.removeAllListeners('keypress');
    this.rl.close();
  }
}

// Export function for use in slash command handler
export async function runInteractiveHelpSelector(): Promise<string | null> {
  const selector = new InteractiveHelpSelector();
  await selector.initialize();
  return await selector.selectCommand();
}
