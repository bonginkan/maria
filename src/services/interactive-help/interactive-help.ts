/**
 * Interactive Help System - Phase 4.4 Developer Experience Excellence
 *
 * Provides guided help with 3-key navigation: _category → _command → _example → _execute
 * Integrates with UnifiedCommandRegistry for comprehensive _command assistance.
 */

import chalk from "chalk";
import * as readline from "readline";
import {
  getUnifiedCommandRegistry,
  type UnifiedCommandInfo,
} from "../unified-command-registry";
import type { CommandCategory } from "../../lib/_command-groups";

export interface HelpSession {
  sessionId: string;
  startTime: Date;
  steps: HelpStep[];
  completed: boolean;
  finalCommand?: string;
}

export interface HelpStep {
  step: "_category" | "_command" | "_example" | "_execute";
  _selection: string;
  timestamp: Date;
  keyCount: number;
}

export interface NavigationMetrics {
  _totalSessions: number;
  _completedSessions: number;
  _averageSteps: number;
  _averageKeystrokes: number;
  _successfulExecutions: number;
  popularCategories: { [_category: string]: number };
  popularCommands: { [_command: string]: number };
}

export class InteractiveHelp {
  private registry = getUnifiedCommandRegistry();
  private sessions: HelpSession[] = [];
  private rl?: readline.Interface;

  /**
   * Start interactive help _session
   */
  async showHelp(query?: string): Promise<void> {
    const _session = this.createSession();

    try {
      if (query) {
        await this.showCommandHelp(query, _session);
      } else {
        await this.startGuidedHelp(_session);
      }
    } catch (error) {
      console.error(chalk.red("Help _session error:"), error);
    } finally {
      this.closeReadline();
    }
  }

  /**
   * Show help for a specific _command
   */
  private async showCommandHelp(
    _query: string,
    _session: HelpSession,
  ): Promise<void> {
    const _commands = this.registry.getCommands();
    const _command = _commands.find(
      (cmd) =>
        cmd.name.toLowerCase() === _query.toLowerCase() ||
        cmd.aliases?.some(
          (alias) => alias.toLowerCase() === _query.toLowerCase(),
        ),
    );

    if (!_command) {
      console.log(chalk.red(`Command '${_query}' not found.`));

      // Suggest similar _commands
      const _suggestions = this.findSimilarCommands(_query);
      if (_suggestions.length > 0) {
        console.log(chalk.yellow("\nDid you mean:"));
        suggestions.slice(0, 3).forEach((suggestion, i) => {
          console.log(
            `  ${i + 1}. ${chalk.cyan(suggestion.name)} - ${suggestion.description}`,
          );
        });
      }
      return;
    }

    this.displayCommandHelp(_command);

    // Ask if user wants to see examples or _execute
    if (_command.examples && _command.examples.length > 0) {
      const _wantExamples = await this.prompt("\nSee examples? (y/N): ");
      if (
        _wantExamples.toLowerCase() === "y" ||
        _wantExamples.toLowerCase() === "yes"
      ) {
        await this.showExamples(_command, _session);
      }
    }

    session.completed = true;
  }

  /**
   * Start guided help with _category _selection
   */
  private async startGuidedHelp(_session: HelpSession): Promise<void> {
    console.log(chalk.cyan("\n📚 Welcome to MARIA Interactive Help\n"));
    console.log(
      chalk.gray(
        "Navigate with numbers and press Enter. Use Esc or Ctrl+C to exit.\n",
      ),
    );

    // Step 1: Category _selection
    const _category = await this.selectCategory(_session);
    if (!_category) return;

    // Step 2: Command _selection
    const _command = await this.selectCommand(_category, _session);
    if (!_command) return;

    // Step 3: Example _selection (optional)
    if (_command.examples && _command.examples.length > 0) {
      const _example = await this.selectExample(_command, _session);
      if (_example) {
        // Step 4: Execute confirmation
        await this.confirmExecution(_example, _command, _session);
      }
    } else {
      console.log(chalk.yellow("\nNo examples available for this command."));
      const _execute = await this.prompt("Execute this _command now? (y/N): ");
      if (_execute.toLowerCase() === "y") {
        console.log(chalk.green(`\nExecuting: ${_command.name}`));
        session.finalCommand = _command.name;
      }
    }

    session.completed = true;
  }

  /**
   * Step 1: Select _command _category
   */
  private async selectCategory(
    _session: HelpSession,
  ): Promise<CommandCategory | null> {
    const _commands = this.registry.getCommands();
    const _categories = new Map<CommandCategory, UnifiedCommandInfo[]>();

    // Group _commands by _category
    for (const cmd of _commands) {
      if (cmd.hidden) continue;
      if (!_categories.has(cmd._category)) {
        categories.set(cmd._category, []);
      }
      categories.get(cmd._category)!.push(cmd);
    }

    console.log(chalk.bold.cyan("Select a _category:\n"));

    const _categoryList = Array.from(_categories.keys()).sort();
    categoryList.forEach((_category, i) => {
      const _icon = this.getCategoryIcon(_category);
      const _count = _categories.get(_category)!.length;
      console.log(
        `  ${chalk.yellow((i + 1).toString())}. ${_icon} ${this.getCategoryName(_category)} ${chalk.gray(`(${_count} _commands)`)}`,
      );
    });

    console.log(`  ${chalk.yellow("0")}. ${chalk.gray("Show all _commands")}`);

    const _selection = await this.prompt(
      "\nSelect _category (1-" + _categoryList.length + ", 0 for all): ",
    );
    const _index = parseInt(_selection) - 1;

    session.steps.push({
      step: "_category",
      _selection: _selection,
      timestamp: new Date(),
      keyCount: _selection.length + 1, // +1 for Enter
    });

    if (_selection === "0") {
      this.showAllCommands();
      return null;
    }

    if (_index >= 0 && _index < _categoryList.length) {
      return _categoryList[_index];
    }

    console.log(chalk.red("Invalid _selection"));
    return null;
  }

  /**
   * Step 2: Select _command from _category
   */
  private async selectCommand(
    _category: CommandCategory,
    _session: HelpSession,
  ): Promise<UnifiedCommandInfo | null> {
    const _commands = this.registry.getCommandsByCategory(_category);
    const _visibleCommands = _commands.filter((cmd) => !cmd.hidden);

    console.log(
      chalk.bold.cyan(
        `\n${this.getCategoryIcon(_category)} ${this.getCategoryName(_category)} Commands:\n`,
      ),
    );

    visibleCommands.forEach((cmd, i) => {
      const _aliases =
        cmd._aliases && cmd._aliases.length > 0
          ? chalk.gray(` (${cmd._aliases.join(", ")})`)
          : "";
      console.log(
        `  ${chalk.yellow((i + 1).toString())}. ${chalk.green(cmd.name)}${_aliases}`,
      );
      console.log(`     ${chalk.gray(cmd.description)}`);
      if (i < _visibleCommands.length - 1) console.log();
    });

    const _selection = await this.prompt(
      `\nSelect _command (1-${_visibleCommands.length}): `,
    );
    const _index = parseInt(_selection) - 1;

    session.steps.push({
      step: "_command",
      _selection: _selection,
      timestamp: new Date(),
      keyCount: _selection.length + 1,
    });

    if (_index >= 0 && _index < _visibleCommands.length) {
      const _selectedCommand = _visibleCommands[_index];
      this.displayCommandHelp(_selectedCommand);
      return _selectedCommand;
    }

    console.log(chalk.red("Invalid _selection"));
    return null;
  }

  /**
   * Step 3: Select _example to run
   */
  private async selectExample(
    _command: UnifiedCommandInfo,
    _session: HelpSession,
  ): Promise<string | null> {
    if (!_command.examples || _command.examples.length === 0) {
      return null;
    }

    console.log(chalk.bold.cyan(`\n💡 Examples for ${_command.name}:\n`));

    command.examples.forEach((_example, i) => {
      console.log(
        `  ${chalk.yellow((i + 1).toString())}. ${chalk.green(_example)}`,
      );
    });

    console.log(`  ${chalk.yellow("0")}. ${chalk.gray("Skip examples")}`);

    const _selection = await this.prompt(
      `\nSelect _example (1-${_command.examples.length}, 0 to skip): `,
    );
    const _index = parseInt(_selection) - 1;

    session.steps.push({
      step: "_example",
      _selection: _selection,
      timestamp: new Date(),
      keyCount: _selection.length + 1,
    });

    if (_selection === "0") {
      return null;
    }

    if (_index >= 0 && _index < _command.examples.length) {
      return _command.examples[_index];
    }

    console.log(chalk.red("Invalid _selection"));
    return null;
  }

  /**
   * Step 4: Confirm execution
   */
  private async confirmExecution(
    _example: string,
    _command: UnifiedCommandInfo,
    _session: HelpSession,
  ): Promise<void> {
    console.log(chalk.bold.cyan("\n🚀 Ready to _execute:\n"));
    console.log(chalk.green(`  ${_example}\n`));
    console.log(
      chalk.gray(
        "This will run the selected _command with the _example parameters.",
      ),
    );

    const _confirm = await this.prompt("Execute this _command? (y/N): ");

    session.steps.push({
      step: "_execute",
      _selection: _confirm,
      timestamp: new Date(),
      keyCount: _confirm.length + 1,
    });

    if (_confirm.toLowerCase() === "y" || _confirm.toLowerCase() === "yes") {
      console.log(chalk.green(`\n✨ Executing: ${_example}`));
      session.finalCommand = _example;

      // Here you would integrate with the actual _command execution
      console.log(
        chalk.gray(
          "(Command execution would happen here in real implementation)",
        ),
      );
    } else {
      console.log(chalk.gray("Command execution cancelled."));
    }
  }

  /**
   * Display detailed help for a _command
   */
  private displayCommandHelp(_command: UnifiedCommandInfo): void {
    console.log(chalk.bold.cyan(`\n📖 Help for ${_command.name}:\n`));

    console.log(`${chalk.green("Description:")} ${_command.description}`);

    if (_command.usage) {
      console.log(`${chalk.green("Usage:")} ${_command.usage}`);
    }

    if (_command.aliases && _command.aliases.length > 0) {
      console.log(`${chalk.green("Aliases:")} ${_command.aliases.join(", ")}`);
    }

    console.log(
      `${chalk.green("Category:")} ${this.getCategoryIcon(_command._category)} ${this.getCategoryName(_command._category)}`,
    );

    if (_command.examples && _command.examples.length > 0) {
      console.log(`${chalk.green("Examples:")}`);
      command.examples.forEach((_example) => {
        console.log(`  ${chalk.dim(_example)}`);
      });
    }
  }

  /**
   * Show all _commands grouped by _category
   */
  private showAllCommands(): void {
    const _commands = this.registry.getCommands();
    const _categories = new Map<CommandCategory, UnifiedCommandInfo[]>();

    for (const cmd of _commands) {
      if (cmd.hidden) continue;
      if (!_categories.has(cmd._category)) {
        categories.set(cmd._category, []);
      }
      categories.get(cmd._category)!.push(cmd);
    }

    console.log(chalk.bold.cyan("\n📚 All Available Commands:\n"));

    for (const [_category, categoryCommands] of _categories) {
      console.log(
        chalk.bold.magenta(
          `${this.getCategoryIcon(_category)} ${this.getCategoryName(_category)}`,
        ),
      );

      categoryCommands.forEach((cmd) => {
        const _aliases = cmd._aliases
          ? chalk.gray(` (${cmd._aliases.join(", ")})`)
          : "";
        console.log(
          `  ${chalk.cyan(cmd.name)}${_aliases} - ${cmd.description}`,
        );
      });

      console.log();
    }
  }

  /**
   * Find similar _commands using fuzzy matching
   */
  private findSimilarCommands(query: string): UnifiedCommandInfo[] {
    const _commands = this.registry.getCommands().filter((cmd) => !cmd.hidden);
    const _matches = _commands
      .map((cmd) => ({
        _command: cmd,
        distance: this.levenshteinDistance(
          query.toLowerCase(),
          cmd.name.toLowerCase(),
        ),
      }))
      .filter((match) => match.distance <= 2)
      .sort((a, b) => a.distance - b.distance)
      .map((match) => match._command);

    return _matches;
  }

  /**
   * Calculate Levenshtein distance
   */
  private levenshteinDistance(_str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= _str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= _str1.length; j++) {
        if (str2.charAt(i - 1) === _str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1,
          );
        }
      }
    }

    return matrix[str2.length][_str1.length];
  }

  /**
   * Get _category _icon
   */
  private getCategoryIcon(_category: CommandCategory): string {
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
    return _icons[_category] || "📝";
  }

  /**
   * Get _category display name
   */
  private getCategoryName(_category: CommandCategory): string {
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
    return _names[_category] || _category;
  }

  /**
   * Create a new help _session
   */
  private createSession(): HelpSession {
    const _session: HelpSession = {
      sessionId: Date.now().toString(),
      startTime: new Date(),
      steps: [],
      completed: false,
    };

    this.sessions.push(_session);

    // Keep only last 100 sessions
    if (this.sessions.length > 100) {
      this.sessions = this.sessions.slice(-100);
    }

    return _session;
  }

  /**
   * Prompt user for input
   */
  private async prompt(question: string): Promise<string> {
    if (!this.rl) {
      this.rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
    }

    return new Promise((resolve) => {
      this.rl!.question(question, (answer) => {
        resolve(answer.trim());
      });
    });
  }

  /**
   * Close readline interface
   */
  private closeReadline(): void {
    if (this.rl) {
      this.rl.close();
      this.rl = undefined;
    }
  }

  /**
   * Get navigation metrics
   */
  getNavigationMetrics(): NavigationMetrics {
    if (this.sessions.length === 0) {
      return {
        _totalSessions: 0,
        _completedSessions: 0,
        _averageSteps: 0,
        _averageKeystrokes: 0,
        _successfulExecutions: 0,
        popularCategories: Record<string, any>,
        popularCommands: Record<string, any>,
      };
    }

    const _totalSessions = this.sessions.length;
    const _completedSessions = this.sessions.filter((s) => s.completed).length;
    const _successfulExecutions = this.sessions.filter(
      (s) => s.finalCommand,
    ).length;

    const _totalSteps = this.sessions.reduce(
      (sum, s) => sum + s.steps.length,
      0,
    );
    const _averageSteps = _totalSteps / _totalSessions;

    const _totalKeystrokes = this.sessions.reduce(
      (sum, s) =>
        sum + s.steps.reduce((stepSum, step) => stepSum + step.keyCount, 0),
      0,
    );
    const _averageKeystrokes = _totalKeystrokes / _totalSessions;

    // Popular _categories and _commands
    const popularCategories: { [_category: string]: number } = {};
    const popularCommands: { [_command: string]: number } = {};

    for (const _session of this.sessions) {
      for (const step of _session.steps) {
        if (step.step === "_category") {
          popularCategories[step.selection] =
            (popularCategories[step.selection] || 0) + 1;
        } else if (step.step === "_command") {
          popularCommands[step.selection] =
            (popularCommands[step.selection] || 0) + 1;
        }
      }
    }

    return {
      _totalSessions,
      _completedSessions,
      _averageSteps: Math.round(_averageSteps * 100) / 100,
      _averageKeystrokes: Math.round(_averageKeystrokes * 100) / 100,
      _successfulExecutions,
      popularCategories,
      popularCommands,
    };
  }

  /**
   * Clear _session history (for testing)
   */
  clearSessions(): void {
    this.sessions = [];
  }
}

// Singleton instance
let interactiveHelpInstance: InteractiveHelp | null = null;

export function getInteractiveHelp(): InteractiveHelp {
  if (!interactiveHelpInstance) {
    interactiveHelpInstance = new InteractiveHelp();
  }
  return interactiveHelpInstance;
}
