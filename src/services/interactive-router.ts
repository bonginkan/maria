/**
 * Interactive Router Service
 * Analyzes natural language input and routes to appropriate commands
 */

import { IntentAnalyzer } from './intent-analyzer';
import { CommandMapper } from './command-mapper';
import { ConversationContext } from '../types/conversation';
import { logger } from '../utils/logger';

export interface RouteResult {
  success: boolean;
  command?: string;
  parameters?: Record<string, unknown>;
  confidence: number;
  message?: string;
  clarificationNeeded?: boolean;
  suggestions?: CommandSuggestion[];
}

export interface CommandSuggestion {
  command: string;
  confidence: number;
  parameters: Record<string, unknown>;
  description?: string;
}

export class InteractiveRouter {
  private analyzer: IntentAnalyzer;
  private mapper: CommandMapper;
  private context: ConversationContext | null = null;

  constructor() {
    this.analyzer = new IntentAnalyzer();
    this.mapper = new CommandMapper();
  }

  /**
   * Route natural language input
   */
  async route(input: string, context?: ConversationContext): Promise<RouteResult> {
    try {
      // Update context
      if (context) {
        this.context = context;
      }

      // 1. Intent analysis
      logger.debug('Analyzing intent for input:', input);
      const intent = await this.analyzer.analyze(input, this.context || undefined);

      // 2. Command mapping
      logger.debug('Mapping intent to commands:', intent);
      const suggestions = this.mapper.mapToCommands(intent);

      // 3. Confidence check
      if (intent.confidence < 0.7 || suggestions.length === 0) {
        return this.promptForClarification(suggestions, intent.confidence);
      }

      // 4. Select most appropriate command
      const bestCommand = suggestions[0];
      if (!bestCommand) {
        return this.promptForClarification(suggestions, intent.confidence);
      }

      // 5. Executability check
      if (!this.isExecutable(bestCommand)) {
        return {
          success: false,
          confidence: bestCommand.confidence,
          message: `Command ${bestCommand.command} is currently unavailable`,
          suggestions: suggestions.slice(1, 4),
        };
      }

      return {
        success: true,
        command: bestCommand.command,
        parameters: bestCommand.parameters,
        confidence: bestCommand.confidence,
        suggestions: suggestions.slice(1, 4),
      };
    } catch (error: unknown) {
      logger.error('Routing error:', error);
      return {
        success: false,
        confidence: 0,
        message: 'An error occurred during routing',
        clarificationNeeded: true,
      };
    }
  }

  /**
   * Handle cases where clarification is needed
   */
  private promptForClarification(
    suggestions: CommandSuggestion[],
    confidence: number,
  ): RouteResult {
    if (suggestions.length === 0) {
      return {
        success: false,
        confidence: 0,
        message: "I couldn't find anything I can help with. Could you please provide more details?",
        clarificationNeeded: true,
        suggestions: this.getDefaultSuggestions(),
      };
    }

    return {
      success: false,
      confidence,
      message: 'Let me confirm if I understand your request correctly:',
      clarificationNeeded: true,
      suggestions: suggestions.slice(0, 3),
    };
  }

  /**
   * Check if command is executable
   */
  private isExecutable(command: CommandSuggestion): boolean {
    // TODO: Implement permission checks, availability checks, etc.
    // Currently all commands are considered executable
    // Command parameter will be used in future implementation
    void command;
    return true;
  }

  /**
   * Default suggestions
   */
  private getDefaultSuggestions(): CommandSuggestion[] {
    return [
      {
        command: 'mc paper',
        confidence: 0.5,
        parameters: {},
        description: 'Create a paper',
      },
      {
        command: 'mc slides',
        confidence: 0.5,
        parameters: {},
        description: 'Create slides',
      },
      {
        command: 'mc chat',
        confidence: 0.5,
        parameters: {},
        description: 'Start interactive chat mode',
      },
    ];
  }

  /**
   * Clear context
   */
  clearContext(): void {
    this.context = null;
  }

  /**
   * Get current context
   */
  getContext(): ConversationContext | null {
    return this.context;
  }
}
