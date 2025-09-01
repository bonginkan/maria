/**
 * Time Command
 * Display current time and timezone information
 */

import { BaseCommand } from "../../base-command";
import {
  CommandArgs,
  CommandContext,
  CommandResult,
} from "../../../types/command.types";
import chalk from "chalk";

export class TimeCommand extends BaseCommand {
  name = "time";
  description = "Display current time and timezone information";
  category = "core";
  aliases = ["clock", "date"];

  async execute(
    args: CommandArgs,
    context: CommandContext
  ): Promise<CommandResult> {
    const now = new Date();
    
    const output: string[] = [];
    output.push('');
    output.push(chalk.cyan.bold('🕐 Current Time'));
    output.push(chalk.gray('═'.repeat(30)));
    output.push('');
    
    output.push(chalk.white(`Local: ${chalk.green(now.toLocaleString())}`));
    output.push(chalk.white(`UTC: ${chalk.green(now.toUTCString())}`));
    output.push(chalk.white(`ISO: ${chalk.green(now.toISOString())}`));
    output.push(chalk.white(`Timezone: ${chalk.green(Intl.DateTimeFormat().resolvedOptions().timeZone)}`));
    output.push('');
    
    return {
      success: true,
      message: output.join('\n'),
      requiresInput: false,
      autoRetry: false,
    };
  }
}

export const meta = {
  name: 'time',
  category: 'core', 
  description: 'Display current time and timezone information',
  aliases: ['clock', 'date'],
  usage: '/time',
  examples: [
    '/time'
  ],
  deps: []
};