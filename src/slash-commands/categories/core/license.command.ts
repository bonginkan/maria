/**
 * License Command
 * Display MARIA license information and terms
 */

import { BaseCommand } from "../../base-command";
import {
  CommandArgs,
  CommandContext,
  CommandResult,
} from "../../../types/command.types";
import chalk from "chalk";

export class LicenseCommand extends BaseCommand {
  name = "license";
  description = "Display MARIA license information and terms";
  category = "core";
  aliases = ["legal", "terms"];

  async execute(
    args: CommandArgs,
    context: CommandContext
  ): Promise<CommandResult> {
    const output: string[] = [];
    
    output.push('');
    output.push(chalk.cyan.bold('📄 MARIA License Information'));
    output.push(chalk.gray('═'.repeat(40)));
    output.push('');
    
    output.push(chalk.white.bold('MIT License'));
    output.push('');
    output.push(chalk.white('Copyright (c) 2024 Bonginkan'));
    output.push('');
    
    output.push(chalk.white('Permission is hereby granted, free of charge, to any person'));
    output.push(chalk.white('obtaining a copy of this software and associated documentation'));
    output.push(chalk.white('files (the "Software"), to deal in the Software without'));
    output.push(chalk.white('restriction, including without limitation the rights to use,'));
    output.push(chalk.white('copy, modify, merge, publish, distribute, sublicense, and/or'));
    output.push(chalk.white('sell copies of the Software, and to permit persons to whom'));
    output.push(chalk.white('the Software is furnished to do so, subject to the following'));
    output.push(chalk.white('conditions:'));
    output.push('');
    
    output.push(chalk.white('The above copyright notice and this permission notice shall'));
    output.push(chalk.white('be included in all copies or substantial portions of the'));
    output.push(chalk.white('Software.'));
    output.push('');
    
    output.push(chalk.yellow.bold('THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY'));
    output.push(chalk.yellow.bold('KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE'));
    output.push(chalk.yellow.bold('WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR'));
    output.push(chalk.yellow.bold('PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS'));
    output.push(chalk.yellow.bold('OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR'));
    output.push(chalk.yellow.bold('OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR'));
    output.push(chalk.yellow.bold('OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE'));
    output.push(chalk.yellow.bold('SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.'));
    output.push('');
    
    output.push(chalk.white('🔗 Links:'));
    output.push(chalk.blue('  Full License: https://github.com/bonginkan/maria/blob/main/LICENSE'));
    output.push(chalk.blue('  Privacy Policy: https://maria-code.ai/privacy'));
    output.push(chalk.blue('  Terms of Service: https://maria-code.ai/terms'));
    output.push('');
    
    output.push(chalk.white('📞 Contact:'));
    output.push(chalk.blue('  Email: legal@bonginkan.ai'));
    output.push(chalk.blue('  Website: https://bonginkan.ai'));
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
  name: 'license',
  category: 'core',
  description: 'Display MARIA license information and terms',
  aliases: ['legal', 'terms'],
  usage: '/license',
  examples: [
    '/license'
  ],
  deps: []
};