/**
 * Command Candidate Service
 * Handles command suggestions and Shift key candidate display
 */

import {
  commandInfo,
  commandCategories,
  CommandCategory,
  CommandInfo,
} from '../lib/command-groups';
import { logger } from '../utils/logger';
import chalk from 'chalk';

export interface CommandCandidate {
  name: string;
  aliases?: string[];
  description: string;
  category: CommandCategory;
  usage?: string;
  examples?: string[];
  similarity?: number;
}

export interface CandidateDisplayOptions {
  maxCandidates?: number;
  includeAliases?: boolean;
  includeExamples?: boolean;
  categoryFilter?: CommandCategory;
  sortBy?: 'similarity' | 'alphabetical' | 'category';
}

export class CommandCandidateService {
  private allCommands: CommandInfo[];

  constructor() {
    this.allCommands = Object.values(commandInfo);
  }

  /**
   * Get command candidates based on partial input
   */
  getCandidates(input: string, options: CandidateDisplayOptions = {}): CommandCandidate[] {
    const {
      maxCandidates = 10,
      includeAliases = true,
      categoryFilter,
      sortBy = 'similarity',
    } = options;

    const cleanInput = input.replace(/^\//, '').toLowerCase();
    const candidates: CommandCandidate[] = [];

    // Find matching commands
    for (const command of this.allCommands) {
      if (categoryFilter && command.category !== categoryFilter) {
        continue;
      }

      let similarity = 0;

      // Exact match
      if (command.name.toLowerCase() === cleanInput) {
        similarity = 100;
      }
      // Starts with
      else if (command.name.toLowerCase().startsWith(cleanInput)) {
        similarity = 80 + (cleanInput.length / command.name.length) * 20;
      }
      // Contains
      else if (command.name.toLowerCase().includes(cleanInput)) {
        similarity = 60 + (cleanInput.length / command.name.length) * 20;
      }
      // Description match
      else if (command.description.toLowerCase().includes(cleanInput)) {
        similarity = 40;
      }

      // Check aliases
      if (includeAliases && command.aliases) {
        for (const alias of command.aliases) {
          if (alias.toLowerCase() === cleanInput) {
            similarity = Math.max(similarity, 95);
          } else if (alias.toLowerCase().startsWith(cleanInput)) {
            similarity = Math.max(similarity, 75);
          } else if (alias.toLowerCase().includes(cleanInput)) {
            similarity = Math.max(similarity, 55);
          }
        }
      }

      if (similarity > 0) {
        candidates.push({
          ...command,
          similarity,
        });
      }
    }

    // Sort candidates
    candidates.sort((a, b) => {
      switch (sortBy) {
        case 'similarity':
          return (b.similarity || 0) - (a.similarity || 0);
        case 'alphabetical':
          return a.name.localeCompare(b.name);
        case 'category':
          return a.category.localeCompare(b.category) || a.name.localeCompare(b.name);
        default:
          return (b.similarity || 0) - (a.similarity || 0);
      }
    });

    return candidates.slice(0, maxCandidates);
  }

  /**
   * Get all commands grouped by category
   */
  getCommandsByCategory(): Record<CommandCategory, CommandCandidate[]> {
    const grouped: Record<string, CommandCandidate[]> = {};

    for (const command of this.allCommands) {
      if (!grouped[command.category]) {
        grouped[command.category] = [];
      }
      grouped[command.category]!.push({
        name: command.name,
        aliases: command.aliases,
        description: command.description,
        category: command.category,
        usage: command.usage,
        examples: command.examples,
      });
    }

    // Sort each category alphabetically
    for (const category in grouped) {
      grouped[category]!.sort((a, b) => a.name.localeCompare(b.name));
    }

    return grouped as Record<CommandCategory, CommandCandidate[]>;
  }

  /**
   * Format candidates for display with Shift key
   */
  formatCandidatesDisplay(
    candidates: CommandCandidate[],
    originalInput: string,
    options: CandidateDisplayOptions = {},
  ): string {
    const { includeExamples = false } = options;

    if (candidates.length === 0) {
      return chalk.yellow('No matching commands found');
    }

    let output = '';

    // Header
    output += chalk.bold.cyan(
      `\n🔍 Command Suggestions for "${originalInput}" (${candidates.length})\n`,
    );
    output += chalk.gray('─'.repeat(60)) + '\n';

    // Group by category for better organization
    const grouped = this.groupCandidatesByCategory(candidates);

    for (const [category, commands] of Object.entries(grouped)) {
      if (commands.length === 0) continue;

      // Category header
      const categoryName = commandCategories[category as CommandCategory] || category;
      output += chalk.bold.blue(`\n📂 ${categoryName}\n`);

      for (const command of commands) {
        // Command name with similarity indicator
        const similarity = command.similarity || 0;
        const similarityBar = this.getSimilarityBar(similarity);

        output += chalk.white(`  /${command.name}`);

        // Aliases
        if (command.aliases && command.aliases.length > 0) {
          output += chalk.gray(` (${command.aliases.map((a) => `/${a}`).join(', ')})`);
        }

        output += ` ${similarityBar}\n`;

        // Description
        output += chalk.gray(`    ${command.description}\n`);

        // Usage
        if (command.usage) {
          output += chalk.cyan(`    Usage: /${command.name} ${command.usage}\n`);
        }

        // Examples
        if (includeExamples && command.examples && command.examples.length > 0) {
          output += chalk.green(`    Examples: ${command.examples.slice(0, 2).join(', ')}\n`);
        }

        output += '\n';
      }
    }

    // Footer with Shift key instructions
    output += chalk.gray('─'.repeat(60)) + '\n';
    output += chalk.yellow(
      '💡 Press Tab to autocomplete • Shift+Tab for more details • Esc to cancel\n',
    );

    return output;
  }

  /**
   * Format compact candidate display
   */
  formatCompactCandidates(candidates: CommandCandidate[]): string {
    if (candidates.length === 0) {
      return chalk.yellow('No matches');
    }

    const maxDisplay = 5;
    const display = candidates.slice(0, maxDisplay);

    let output = chalk.bold('Suggestions: ');
    output += display
      .map((cmd, index) => {
        const name = chalk.cyan(`/${cmd.name}`);
        return index === 0 ? chalk.bold(name) : name;
      })
      .join(', ');

    if (candidates.length > maxDisplay) {
      output += chalk.gray(` (+${candidates.length - maxDisplay} more)`);
    }

    output += chalk.gray(' • Press Shift+Tab for details');

    return output;
  }

  /**
   * Get fuzzy matches using Levenshtein distance
   */
  getFuzzyMatches(input: string, threshold: number = 0.6): CommandCandidate[] {
    const cleanInput = input.replace(/^\//, '').toLowerCase();
    const candidates: CommandCandidate[] = [];

    for (const command of this.allCommands) {
      const similarity = this.calculateSimilarity(cleanInput, command.name.toLowerCase());

      if (similarity >= threshold) {
        candidates.push({
          ...command,
          similarity: similarity * 100,
        });
      }
    }

    return candidates.sort((a, b) => (b.similarity || 0) - (a.similarity || 0));
  }

  /**
   * Handle Shift key press for candidate display
   */
  handleShiftKeyCandidate(input: string): string {
    logger.info('Shift key candidate display triggered', { input });

    const candidates = this.getCandidates(input, {
      maxCandidates: 15,
      includeExamples: true,
      sortBy: 'similarity',
    });

    if (candidates.length === 0) {
      return this.formatNoCandidatesMessage(input);
    }

    return this.formatCandidatesDisplay(candidates, input, {
      includeExamples: true,
    });
  }

  /**
   * Get quick suggestions for autocomplete
   */
  getQuickSuggestions(input: string, maxSuggestions: number = 3): string[] {
    const candidates = this.getCandidates(input, {
      maxCandidates: maxSuggestions,
      sortBy: 'similarity',
    });

    return candidates.map((c) => c.name);
  }

  // Private helper methods

  private groupCandidatesByCategory(
    candidates: CommandCandidate[],
  ): Record<string, CommandCandidate[]> {
    const grouped: Record<string, CommandCandidate[]> = {};

    for (const candidate of candidates) {
      if (!grouped[candidate.category]) {
        grouped[candidate.category] = [];
      }
      grouped[candidate.category]!.push(candidate);
    }

    return grouped;
  }

  private getSimilarityBar(similarity: number): string {
    const bars = Math.round(similarity / 20);
    const filled = '█'.repeat(bars);
    const empty = '░'.repeat(5 - bars);

    let color = chalk.red;
    if (similarity >= 80) color = chalk.green;
    else if (similarity >= 60) color = chalk.yellow;
    else if (similarity >= 40) color = chalk.yellow;

    return color(`${filled}${empty} ${similarity.toFixed(0)}%`);
  }

  private calculateSimilarity(str1: string, str2: string): number {
    const distance = this.levenshteinDistance(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);
    return maxLength === 0 ? 1 : (maxLength - distance) / maxLength;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1)
      .fill(null)
      .map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0]![i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j]![0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j]![i] = Math.min(
          matrix[j - 1]![i] + 1, // deletion
          matrix[j]![i - 1] + 1, // insertion
          matrix[j - 1]![i - 1] + cost, // substitution
        );
      }
    }

    return matrix[str2.length]![str1.length]!;
  }

  /**
   * Get related commands from the same category
   */
  getRelatedCommands(commandName: string): CommandCandidate[] {
    const command = this.allCommands.find((cmd) => cmd.name === commandName);
    if (!command) return [];

    return this.allCommands
      .filter((cmd) => cmd.category === command.category && cmd.name !== commandName)
      .slice(0, 5)
      .map((cmd) => ({
        name: cmd.name,
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
        name: cmd.name,
        aliases: cmd.aliases,
        description: cmd.description,
        category: cmd.category,
        usage: cmd.usage,
        examples: cmd.examples,
      }));
  }

  private formatNoCandidatesMessage(input: string): string {
    return `
${chalk.yellow('🤔 No exact matches found for')} ${chalk.white(`"${input}"`)}

${chalk.bold('💡 Suggestions:')}
• Check spelling: ${chalk.cyan('/' + input.replace(/[^a-zA-Z]/g, ''))}
• Try shorter terms: ${chalk.cyan('/' + input.slice(0, 3))}
• Use wildcards: ${chalk.cyan('/' + input + '*')}

${chalk.bold('📚 Popular Commands:')}
• ${chalk.cyan('/help')} - Show all commands
• ${chalk.cyan('/setup')} - First-time setup
• ${chalk.cyan('/settings')} - Environment setup
• ${chalk.cyan('/code')} - Generate code
• ${chalk.cyan('/test')} - Generate tests

${chalk.gray('Press Shift+Tab to show all available commands')}
    `.trim();
  }
}

// Export singleton instance
export const commandCandidateService = new CommandCandidateService();
