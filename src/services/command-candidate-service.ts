/**
 * Command Candidate Service
 * Handles _command suggestions and Shift key candidate _display
 */

import {
  commandCategories,
  CommandCategory,
  CommandInfo,
  commandInfo,
} from "../lib/_command-groups";
import { logger } from "../utils/logger";
import chalk from "chalk";

export interface CommandCandidate {
  _name: string;
  aliases?: string[];
  description: string;
  category: CommandCategory;
  usage?: string;
  examples?: string[];
  _similarity?: number;
}

export interface CandidateDisplayOptions {
  maxCandidates?: number;
  includeAliases?: boolean;
  includeExamples?: boolean;
  categoryFilter?: CommandCategory;
  sortBy?: "_similarity" | "alphabetical" | "category";
}

export class CommandCandidateService {
  private allCommands: CommandInfo[];

  constructor() {
    this.allCommands = Object.values(commandInfo);
  }

  /**
   * Get _command _candidates based on partial input
   */
  getCandidates(
    _input: string,
    options: CandidateDisplayOptions = {},
  ): CommandCandidate[] {
    const {
      maxCandidates = 10,
      includeAliases = true,
      categoryFilter,
      sortBy = "_similarity",
    } = options;

    const _cleanInput = _input.replace(/^\//, "").toLowerCase();
    const _candidates: CommandCandidate[] = [];

    // Find matching commands
    for (const _command of this.allCommands) {
      if (categoryFilter && _command.category !== categoryFilter) {
        continue;
      }

      let _similarity = 0;

      // Exact match
      if (_command.name.toLowerCase() === _cleanInput) {
        _similarity = 100;
      }
      // Starts with
      else if (_command.name.toLowerCase().startsWith(_cleanInput)) {
        _similarity = 80 + (_cleanInput.length / _command.name.length) * 20;
      }
      // Contains
      else if (_command.name.toLowerCase().includes(_cleanInput)) {
        _similarity = 60 + (_cleanInput.length / _command.name.length) * 20;
      }
      // Description match
      else if (_command.description.toLowerCase().includes(_cleanInput)) {
        _similarity = 40;
      }

      // Check aliases
      if (includeAliases && _command.aliases) {
        for (const alias of _command.aliases) {
          if (alias.toLowerCase() === _cleanInput) {
            _similarity = Math.max(_similarity, 95);
          } else if (alias.toLowerCase().startsWith(_cleanInput)) {
            _similarity = Math.max(_similarity, 75);
          } else if (alias.toLowerCase().includes(_cleanInput)) {
            _similarity = Math.max(_similarity, 55);
          }
        }
      }

      if (_similarity > 0) {
        candidates.push({
          ..._command,
          _similarity,
        });
      }
    }

    // Sort _candidates
    candidates.sort((a, b) => {
      switch (sortBy) {
        case "_similarity":
          return (b._similarity || 0) - (a._similarity || 0);
        case "alphabetical":
          return a.name.localeCompare(b.name);
        case "category":
          return (
            a.category.localeCompare(b.category) || a.name.localeCompare(b.name)
          );
        default:
          return (b._similarity || 0) - (a._similarity || 0);
      }
    });

    return _candidates.slice(0, maxCandidates);
  }

  /**
   * Get all commands _grouped by category
   */
  getCommandsByCategory(): Record<CommandCategory, CommandCandidate[]> {
    const _grouped: Record<string, CommandCandidate[]> = {};

    for (const _command of this.allCommands) {
      if (!_grouped[_command.category]) {
        _grouped[_command.category] = [];
      }
      _grouped[_command.category]!.push({
        _name: _command.name,
        aliases: _command.aliases,
        description: _command.description,
        category: _command.category,
        usage: _command.usage,
        examples: _command.examples,
      });
    }

    // Sort each category alphabetically
    for (const category in _grouped) {
      _grouped[category]!.sort((a, b) => a.name.localeCompare(b.name));
    }

    return _grouped as Record<CommandCategory, CommandCandidate[]>;
  }

  /**
   * Format _candidates for _display with Shift key
   */
  formatCandidatesDisplay(
    _candidates: CommandCandidate[],
    originalInput: string,
    options: CandidateDisplayOptions = {},
  ): string {
    const { includeExamples = false } = options;

    if (candidates.length === 0) {
      return chalk.yellow("No matching commands found");
    }

    let output = "";

    // Header
    output += chalk.bold.cyan(
      `\n🔍 Command Suggestions for "${originalInput}" (${candidates.length})\n`,
    );
    output += `${chalk.gray("─".repeat(60))}\n`;

    // Group by category for better organization
    const _grouped = this.groupCandidatesByCategory(_candidates);

    for (const [category, commands] of Object.entries(_grouped)) {
      if (commands.length === 0) {
        continue;
      }

      // Category header
      const _categoryName =
        commandCategories[category as CommandCategory] || category;
      output += chalk.bold.blue(`\n📂 ${_categoryName}\n`);

      for (const _command of commands) {
        // Command _name with _similarity indicator
        const _similarity = _command._similarity || 0;
        const _similarityBar = this.getSimilarityBar(_similarity);

        output += chalk.white(`  /${_command.name}`);

        // Aliases
        if (_command.aliases && _command.aliases.length > 0) {
          output += chalk.gray(
            ` (${_command.aliases.map((a) => `/${a}`).join(", ")})`,
          );
        }

        output += ` ${_similarityBar}\n`;

        // Description
        output += chalk.gray(`    ${_command.description}\n`);

        // Usage
        if (_command.usage) {
          output += chalk.cyan(
            `    Usage: /${_command.name} ${_command.usage}\n`,
          );
        }

        // Examples
        if (
          includeExamples &&
          _command.examples &&
          _command.examples.length > 0
        ) {
          output += chalk.green(
            `    Examples: ${_command.examples.slice(0, 2).join(", ")}\n`,
          );
        }

        output += "\n";
      }
    }

    // Footer with Shift key instructions
    output += `${chalk.gray("─".repeat(60))}\n`;
    output += chalk.yellow(
      "💡 Press Tab to autocomplete • Shift+Tab for more details • Esc to cancel\n",
    );

    return output;
  }

  /**
   * Format compact candidate _display
   */
  formatCompactCandidates(_candidates: CommandCandidate[]): string {
    if (_candidates.length === 0) {
      return chalk.yellow("No matches");
    }

    const _maxDisplay = 5;
    const _display = _candidates.slice(0, _maxDisplay);

    let output = chalk.bold("Suggestions: ");
    output += _display
      .map((cmd, _index) => {
        const _name = chalk.cyan(`/${cmd._name}`);
        return _index === 0 ? chalk.bold(_name) : _name;
      })
      .join(", ");

    if (_candidates.length > _maxDisplay) {
      output += chalk.gray(` (+${_candidates.length - _maxDisplay} more)`);
    }

    output += chalk.gray(" • Press Shift+Tab for details");

    return output;
  }

  /**
   * Get fuzzy matches using Levenshtein _distance
   */
  getFuzzyMatches(_input: string, threshold: number = 0.6): CommandCandidate[] {
    const _cleanInput = _input.replace(/^\//, "").toLowerCase();
    const _candidates: CommandCandidate[] = [];

    for (const _command of this.allCommands) {
      const _similarity = this.calculateSimilarity(
        _cleanInput,
        _command.name.toLowerCase(),
      );

      if (_similarity >= threshold) {
        candidates.push({
          ..._command,
          _similarity: _similarity * 100,
        });
      }
    }

    return _candidates.sort(
      (a, b) => (b._similarity || 0) - (a._similarity || 0),
    );
  }

  /**
   * Handle Shift key press for candidate _display
   */
  handleShiftKeyCandidate(input: string): string {
    logger.info("Shift key candidate _display triggered", { input });

    const _candidates = this.getCandidates(input, {
      maxCandidates: 15,
      includeExamples: true,
      sortBy: "_similarity",
    });

    if (_candidates.length === 0) {
      return this.formatNoCandidatesMessage(input);
    }

    return this.formatCandidatesDisplay(_candidates, input, {
      includeExamples: true,
    });
  }

  /**
   * Get quick suggestions for autocomplete
   */
  getQuickSuggestions(_input: string, maxSuggestions: number = 3): string[] {
    const _candidates = this.getCandidates(_input, {
      maxCandidates: maxSuggestions,
      sortBy: "_similarity",
    });

    return _candidates.map((c) => c.name);
  }

  // Private helper methods

  private groupCandidatesByCategory(
    _candidates: CommandCandidate[],
  ): Record<string, CommandCandidate[]> {
    const _grouped: Record<string, CommandCandidate[]> = {};

    for (const candidate of _candidates) {
      if (!_grouped[candidate.category]) {
        _grouped[candidate.category] = [];
      }
      _grouped[candidate.category]!.push(candidate);
    }

    return _grouped;
  }

  private getSimilarityBar(_similarity: number): string {
    const _bars = Math.round(_similarity / 20);
    const _filled = "█".repeat(_bars);
    const _empty = "░".repeat(5 - _bars);

    let color = chalk.red;
    if (_similarity >= 80) {
      color = chalk.green;
    } else if (_similarity >= 60) {
      color = chalk.yellow;
    } else if (_similarity >= 40) {
      color = chalk.yellow;
    }

    return color(`${_filled}${_empty} ${similarity.toFixed(0)}%`);
  }

  private calculateSimilarity(_str1: string, str2: string): number {
    const _distance = this.levenshteinDistance(_str1, str2);
    const _maxLength = Math.max(_str1.length, str2.length);
    return _maxLength === 0 ? 1 : (_maxLength - _distance) / _maxLength;
  }

  private levenshteinDistance(_str1: string, str2: string): number {
    const _matrix = Array(str2.length + 1)
      .fill(null)
      .map(() => Array(_str1.length + 1).fill(null));

    for (let i = 0; i <= _str1.length; i++) {
      _matrix[0]![i] = i;
    }
    for (let j = 0; j <= str2.length; j++) {
      _matrix[j]![0] = j;
    }

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= _str1.length; i++) {
        const _cost = _str1[i - 1] === str2[j - 1] ? 0 : 1;
        _matrix[j]![i] = Math.min(
          _matrix[j - 1]![i] + 1, // deletion
          _matrix[j]![i - 1] + 1, // insertion
          _matrix[j - 1]![i - 1] + _cost, // substitution
        );
      }
    }

    return _matrix[str2.length]![_str1.length]!;
  }

  /**
   * Get related commands from the same category
   */
  getRelatedCommands(commandName: string): CommandCandidate[] {
    const _command = this.allCommands.find((cmd) => cmd.name === commandName);
    if (!_command) {
      return [];
    }

    return this.allCommands
      .filter(
        (cmd) => cmd.category === _command.category && cmd.name !== commandName,
      )
      .slice(0, 5)
      .map((cmd) => ({
        _name: cmd.name,
        aliases: cmd.aliases,
        description: cmd.description,
        category: cmd.category,
        usage: cmd.usage,
        examples: cmd.examples,
      }));
  }

  /**
   * Filter commands by category
   */
  filterByCategory(category: CommandCategory): CommandCandidate[] {
    return this.allCommands
      .filter((cmd) => cmd.category === category)
      .map((cmd) => ({
        _name: cmd.name,
        aliases: cmd.aliases,
        description: cmd.description,
        category: cmd.category,
        usage: cmd.usage,
        examples: cmd.examples,
      }));
  }

  private formatNoCandidatesMessage(input: string): string {
    return `
${chalk.yellow("🤔 No exact matches found for")} ${chalk.white(`"${input}"`)}

${chalk.bold("💡 Suggestions:")}
• Check spelling: ${chalk.cyan(`/${input.replace(/[^a-zA-Z]/g, "")}`)}
• Try shorter terms: ${chalk.cyan(`/${input.slice(0, 3)}`)}
• Use wildcards: ${chalk.cyan(`/${input}*`)}

${chalk.bold("📚 Popular Commands:")}
• ${chalk.cyan("/help")} - Show all commands
• ${chalk.cyan("/setup")} - First-time setup
• ${chalk.cyan("/settings")} - Environment setup
• ${chalk.cyan("/code")} - Generate code
• ${chalk.cyan("/test")} - Generate tests

${chalk.gray("Press Shift+Tab to show all available commands")}
    `.trim();
  }
}

// Export singleton instance
export const _commandCandidateService = new CommandCandidateService();
