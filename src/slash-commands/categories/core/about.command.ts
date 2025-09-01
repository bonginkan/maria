/**
 * About Command
 * Display information about MARIA and the team
 */

import { BaseCommand } from "../../base-command";
import {
  CommandArgs,
  CommandContext,
  CommandResult,
} from "../../../types/command.types";
import chalk from "chalk";

export class AboutCommand extends BaseCommand {
  name = "about";
  description = "Display information about MARIA and the team";
  category = "core";
  aliases = ["info"];

  async execute(
    args: CommandArgs,
    context: CommandContext
  ): Promise<CommandResult> {
    const output: string[] = [];
    
    output.push('');
    output.push(chalk.cyan.bold('🤖 About MARIA v3.8.0'));
    output.push(chalk.gray('═'.repeat(40)));
    output.push('');
    
    output.push(chalk.white.bold('MARIA - Minimal API, Maximum Power'));
    output.push('');
    
    output.push(chalk.white('🎯 Revolutionary AI Development Platform:'));
    output.push('  • Natural Language Code Operations');
    output.push('  • Graph RAG Knowledge System');
    output.push('  • Dual Memory Architecture');
    output.push('  • Enterprise-Grade Security');
    output.push('  • Multimodal AI Generation');
    output.push('');
    
    output.push(chalk.white('🌟 Key Features:'));
    output.push('  • /code - Natural language coding');
    output.push('  • 68+ Slash Commands');
    output.push('  • 8 AI Provider Support');
    output.push('  • Business Operations Suite');
    output.push('  • Real-time Streaming');
    output.push('');
    
    output.push(chalk.white('👨‍💻 Created by:'));
    output.push('  • Bonginkan Team');
    output.push('  • Enterprise AI Solutions');
    output.push('');
    
    output.push(chalk.white('🔗 Links:'));
    output.push(chalk.blue('  Website: https://maria-code.ai'));
    output.push(chalk.blue('  Company: https://bonginkan.ai'));
    output.push(chalk.blue('  Discord: https://discord.gg/SMSmSGcEQy'));
    output.push(chalk.blue('  GitHub: https://github.com/bonginkan/maria'));
    output.push(chalk.blue('  NPM: https://www.npmjs.com/package/@bonginkan/maria'));
    output.push('');
    
    output.push(chalk.white('📄 License: MIT'));
    output.push(chalk.white('🏗️ Built with: TypeScript, Node.js, React'));
    output.push('');
    
    output.push(chalk.green('Thank you for using MARIA! 🚀'));
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
  name: 'about',
  category: 'core',
  description: 'Display information about MARIA and the team',
  aliases: ['info'],
  usage: '/about',
  examples: [
    '/about'
  ],
  deps: []
};