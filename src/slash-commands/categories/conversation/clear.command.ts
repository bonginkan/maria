/**
 * Clear Command v2.1  
 * Clear screen + session memory with one-line confirmation
 */

import { BaseCommand } from '../../base-command';
import { CommandArgs, CommandContext, CommandResult, CommandExample } from '../../types';
import { trackCommand, withQuotaFooter } from '../../shared/telemetry-helper.js';
import { getUserPlan } from '../../../services/subscription/subscription-manager.js';
import chalk from 'chalk';

export class ClearCommand extends BaseCommand {
  name = 'clear';
  category = 'conversation' as const;
  description = 'Clear conversation context';
  aliases = ['cls'];
  usage = '';

  override examples: CommandExample[] = [
    {
      input: '/clear',
      description: 'Clear screen and conversation context',
      output: '✅ Cleared · context reset',
    },
  ];

  async execute(args: CommandArgs, context: CommandContext): Promise<CommandResult> {
    const startTime = Date.now();
    try {
      // Clear the terminal screen
      process.stdout.write('\x1b[2J\x1b[3J\x1b[H');
      
      // Clear session memory if available
      if (context.session) {
        // Reset conversation context
        if (context.session.conversationHistory) {
          context.session.conversationHistory = [];
        }
        if (context.session.context) {
          context.session.context = {};
        }
        if (context.session.messages) {
          context.session.messages = [];
        }
      }
      
      // Track successful operation
      await trackCommand({
        cmd: 'clear',
        status: 'success',
        latencyMs: Date.now() - startTime,
        plan: getUserPlan(),
        quotaLeft: context.quotaLeft || 999
      });
      
      // One-line confirmation as specified in plan
      const message = chalk.green('✅ Cleared') + chalk.gray(' · context reset');
      return this.success(withQuotaFooter(message, context.quotaLeft));
    } catch (error) {
      // Track failed operation
      await trackCommand({
        cmd: 'clear',
        status: 'error',
        latencyMs: Date.now() - startTime,
        plan: getUserPlan(),
        quotaLeft: context.quotaLeft || 999
      });
      
      // Fallback - just clear screen
      process.stdout.write('\x1b[2J\x1b[3J\x1b[H');
      return this.success(chalk.green('✅ Cleared'));
    }
  }
}

export const meta = {
  name: 'clear',
  category: 'conversation',
  description: 'Clear conversation context',
  aliases: ['cls'],
  usage: '',
  examples: [
    '/clear'
  ],
  deps: []
};