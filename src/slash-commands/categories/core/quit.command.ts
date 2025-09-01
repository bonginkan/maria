/**
 * Quit Command
 * Exit the MARIA CLI application
 */

import { BaseCommand } from "../../base-command";
import {
  CommandArgs,
  CommandContext,
  CommandResult,
} from "../../../types/command.types";
import chalk from "chalk";

export class QuitCommand extends BaseCommand {
  name = "quit";
  description = "Exit the MARIA CLI application";
  category = "core";
  aliases = ["exit", "q"];

  async execute(
    args: CommandArgs,
    context: CommandContext
  ): Promise<CommandResult> {
    const output: string[] = [];
    output.push('');
    output.push(chalk.cyan.bold('👋 Goodbye!'));
    output.push(chalk.gray('═'.repeat(30)));
    output.push('');
    output.push(chalk.white('Thank you for using MARIA v3.8.0'));
    output.push(chalk.white('Your session has been saved.'));
    output.push('');
    output.push(chalk.blue('💬 Join our Discord: https://discord.gg/SMSmSGcEQy'));
    output.push(chalk.blue('⭐ Star us on GitHub: https://github.com/bonginkan/maria'));
    output.push('');
    
    // Trigger process exit after displaying message
    setTimeout(() => {
      process.exit(0);
    }, 100);
    
    return {
      success: true,
      message: output.join('\n'),
      requiresInput: false,
      autoRetry: false,
    };
  }
}

export const meta = {
  name: 'quit',
  category: 'core',
  description: 'Exit the MARIA CLI application',
  aliases: ['exit', 'q'],
  usage: '/quit',
  examples: [
    '/quit'
  ],
  deps: []
};