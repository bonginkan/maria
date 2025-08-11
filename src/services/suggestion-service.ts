/**
 * Command Suggestion Service
 * Provides intelligent command suggestions based on context and execution history
 */

import { getRelatedCommands, getCommandChain } from '../lib/command-groups';

export interface CommandSuggestion {
  command: string;
  description: string;
  reason?: string;
  priority: 'high' | 'medium' | 'low';
}

export interface SuggestionContext {
  lastCommand?: string;
  lastCommandSuccess?: boolean;
  projectInitialized?: boolean;
  userLoggedIn?: boolean;
  currentMode?: string;
  sessionDuration?: number;
  commandHistory?: string[];
}

export class SuggestionService {
  private static instance: SuggestionService;
  private commandHistory: string[] = [];
  private sessionStartTime = Date.now();

  public static getInstance(): SuggestionService {
    if (!SuggestionService.instance) {
      SuggestionService.instance = new SuggestionService();
    }
    return SuggestionService.instance;
  }

  /**
   * Add command to history
   */
  addToHistory(command: string): void {
    this.commandHistory.push(command);
    // Keep only last 20 commands
    if (this.commandHistory.length > 20) {
      this.commandHistory.shift();
    }
  }

  /**
   * Get suggestions after command execution
   */
  async getSuggestionsAfterCommand(
    command: string,
    success: boolean,
  ): Promise<CommandSuggestion[]> {
    const suggestions: CommandSuggestion[] = [];

    // Check if part of a workflow
    const chain = getCommandChain(command);
    if (chain && success) {
      const currentIndex = chain.commands.indexOf(command);
      if (currentIndex !== -1 && currentIndex < chain.commands.length - 1) {
        // Suggest next command in chain
        const nextCommand = chain.commands[currentIndex + 1];
        if (nextCommand) {
          suggestions.push({
            command: nextCommand,
            description: `Next in ${chain.name} workflow`,
            reason: `Continue the ${chain.name} workflow`,
            priority: 'high',
          });
        }
      } else if (currentIndex === chain.commands.length - 1) {
        // Workflow completed, suggest next workflow commands
        chain.nextSuggestions?.forEach((cmd) => {
          suggestions.push({
            command: cmd,
            description: `Recommended after ${chain.name}`,
            priority: 'medium',
          });
        });
      }
    }

    // Get related commands
    const related = getRelatedCommands(command);
    related.forEach((rel) => {
      if (!suggestions.find((s) => s.command === rel.command)) {
        suggestions.push({
          command: rel.command,
          description: rel.description,
          reason: `Related to ${command}`,
          priority: 'medium',
        });
      }
    });

    // Context-based suggestions
    if (command === '/init' && success) {
      this.addContextualSuggestion(suggestions, '/add-dir', 'Add project directories', 'high');
      this.addContextualSuggestion(suggestions, '/memory', 'Set up AI memory', 'medium');
    }

    if (command === '/login' && success) {
      this.addContextualSuggestion(suggestions, '/upgrade', 'Upgrade your plan', 'low');
      this.addContextualSuggestion(suggestions, '/config', 'Configure settings', 'medium');
    }

    if (command === '/doctor' && !success) {
      this.addContextualSuggestion(suggestions, '/bug', 'Report the issue', 'high');
      this.addContextualSuggestion(suggestions, '/help', 'Get help', 'medium');
    }

    // Time-based suggestions
    const sessionMinutes = (Date.now() - this.sessionStartTime) / 60000;
    if (sessionMinutes > 30 && !this.commandHistory.includes('/compact')) {
      this.addContextualSuggestion(
        suggestions,
        '/compact',
        'Optimize conversation memory',
        'medium',
        'Long session detected',
      );
    }

    // Limit suggestions to top 3
    return suggestions
      .sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      })
      .slice(0, 3);
  }

  /**
   * Get contextual suggestions based on current state
   */
  async getContextualSuggestions(context: SuggestionContext): Promise<CommandSuggestion[]> {
    const suggestions: CommandSuggestion[] = [];

    // Check for common scenarios
    if (!context.userLoggedIn) {
      suggestions.push({
        command: '/login',
        description: 'Sign in to access all features',
        reason: 'Not logged in',
        priority: 'high',
      });
    }

    if (!context.projectInitialized) {
      suggestions.push({
        command: '/init',
        description: 'Initialize project',
        reason: 'No MARIA.md found',
        priority: 'high',
      });
    }

    // Mode-specific suggestions
    if (context.currentMode === 'research') {
      this.addContextualSuggestion(suggestions, '/memory', 'Save research findings', 'medium');
    }

    // History-based patterns
    const recentCommands = this.commandHistory.slice(-5);
    if (recentCommands.filter((cmd) => cmd.startsWith('/pr')).length >= 2) {
      this.addContextualSuggestion(
        suggestions,
        '/commit',
        'Commit your changes',
        'high',
        'PR activity detected',
      );
    }

    return suggestions.slice(0, 3);
  }

  /**
   * Format suggestions for display
   */
  formatSuggestions(suggestions: CommandSuggestion[]): string {
    if (suggestions.length === 0) return '';

    let output = '\n💡 Suggested next actions:\n';
    suggestions.forEach((sug) => {
      const icon = sug.priority === 'high' ? '🔥' : sug.priority === 'medium' ? '💫' : '✨';
      output += `  ${icon} ${sug.command.padEnd(15)} - ${sug.description}`;
      if (sug.reason) {
        output += ` (${sug.reason})`;
      }
      output += '\n';
    });

    return output;
  }

  /**
   * Helper to add contextual suggestion
   */
  private addContextualSuggestion(
    suggestions: CommandSuggestion[],
    command: string,
    description: string,
    priority: 'high' | 'medium' | 'low',
    reason?: string,
  ): void {
    if (!suggestions.find((s) => s.command === command)) {
      suggestions.push({ command, description, priority, reason });
    }
  }

  /**
   * Get command frequency
   */
  getCommandFrequency(): Map<string, number> {
    const frequency = new Map<string, number>();
    this.commandHistory.forEach((cmd) => {
      frequency.set(cmd, (frequency.get(cmd) || 0) + 1);
    });
    return frequency;
  }

  /**
   * Get most used commands
   */
  getMostUsedCommands(limit = 5): string[] {
    const frequency = this.getCommandFrequency();
    return Array.from(frequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([cmd]) => cmd);
  }

  /**
   * Get last command from history
   */
  getLastCommand(): string | undefined {
    return this.commandHistory[this.commandHistory.length - 1];
  }

  /**
   * Check if a command has been used
   */
  hasUsedCommand(command: string): boolean {
    return this.commandHistory.includes(command);
  }

  /**
   * Get command history
   */
  getCommandHistory(): string[] {
    return [...this.commandHistory];
  }
}
