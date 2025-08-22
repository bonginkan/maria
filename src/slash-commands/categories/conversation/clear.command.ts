/**
 * Clear Command
 * Clears the conversation context
 */

import { BaseCommand } from '../../base-command';
import { CommandArgs, CommandContext, CommandResult } from '../../types';
// import { Command, Alias, Usage, Example } from '../../decorators';
import { ChatContextService } from '../../../services/chat-context.service';
import { logger } from '../../../utils/logger';

// @Command({
//   name: 'clear',
//   category: 'conversation',
//   description: 'Clear the conversation context and start fresh',
// })
// @Alias('cls', 'reset')
// @Usage('[--all] [--keep-settings]')
// @Example('/clear', 'Clear current conversation')
// @Example('/clear --all', 'Clear all conversations and history')
// @Example('/clear --keep-settings', 'Clear conversation but keep settings')
export class ClearCommand extends BaseCommand {
  name = 'clear';
  category = 'conversation' as const;
  description = 'Clear the conversation context and start fresh';

  private chatContext: ChatContextService;

  constructor() {
    super();
    this.chatContext = ChatContextService.getInstance();
  }

  async execute(args: CommandArgs, context: CommandContext): Promise<CommandResult> {
    try {
      const clearAll = args.flags['all'] || false;
      const keepSettings = args.flags['keep-settings'] || false;

      // Determine what to clear
      const clearOptions = {
        conversation: true,
        history: clearAll,
        settings: !keepSettings,
        cache: clearAll,
      };

      // Log the clear action
      logger.info('Clearing conversation context', {
        options: clearOptions,
        user: context.user?.id,
        session: context.session.id,
      });

      // Clear conversation history
      if (clearOptions.conversation) {
        await this.clearConversation(context);
      }

      // Clear all history if requested
      if (clearOptions.history) {
        await this.clearAllHistory(context);
      }

      // Clear settings if not keeping them
      if (clearOptions.settings && !keepSettings) {
        await this.clearSettings(context);
      }

      // Clear cache if clearing all
      if (clearOptions.cache) {
        await this.clearCache();
      }

      // Build response message
      const clearedItems: string[] = [];
      if (clearOptions.conversation) {clearedItems.push('conversation');}
      if (clearOptions.history) {clearedItems.push('all history');}
      if (clearOptions.settings && !keepSettings) {clearedItems.push('settings');}
      if (clearOptions.cache) {clearedItems.push('cache');}

      const message = this.buildSuccessMessage(clearedItems);

      return this.success(message, {
        cleared: clearedItems,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Failed to clear conversation', error);

      return this.error(
        'Failed to clear conversation context',
        'CLEAR_ERROR',
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }

  private async clearConversation(context: CommandContext): Promise<void> {
    // Clear current conversation from context
    if (context.conversation) {
      context.conversation.history = [];
      // context.conversation.systemContext = '';
    }

    // Clear from chat context service
    await this.chatContext.clearContext();

    logger.debug('Cleared current conversation');
  }

  private async clearAllHistory(context: CommandContext): Promise<void> {
    // Clear all conversation history
    if (context.session) {
      context.session.commandHistory = [];
    }

    // Clear from persistent storage if available
    // TODO: Implement persistent storage clearing

    logger.debug('Cleared all conversation history');
  }

  private async clearSettings(_context: CommandContext): Promise<void> {
    // Clear user-specific settings
    // This would typically clear model preferences, etc.
    // TODO: Implement settings clearing based on your settings structure

    logger.debug('Cleared user settings');
  }

  private async clearCache(): Promise<void> {
    // Clear command cache
    this.cleanup();

    // Clear any global caches
    // TODO: Implement global cache clearing

    logger.debug('Cleared all caches');
  }

  private buildSuccessMessage(clearedItems: string[]): string {
    if (clearedItems.length === 0) {
      return '✅ Nothing to clear';
    }

    if (clearedItems.includes('all history')) {
      return '🧹 All conversation history and data cleared. Starting fresh!';
    }

    if (clearedItems.length === 1 && clearedItems[0] === 'conversation') {
      return '✨ Conversation cleared. Ready for a fresh start!';
    }

    return `✅ Cleared: ${clearedItems.join(', ')}`;
  }

  override async validate(args: CommandArgs): Promise<{ success: boolean; error?: string }> {
    // Check for conflicting flags
    if (args.flags['all'] && args.flags['keep-settings']) {
      return {
        success: false,
        error: 'Cannot use --all and --keep-settings together',
      };
    }

    // Validate no unexpected arguments
    const positional = (args.parsed['positional'] as string[]) || [];
    if (positional.length > 0) {
      return {
        success: false,
        error: `Unexpected arguments: ${positional.join(', ')}`,
      };
    }

    return { success: true };
  }
}
