/**
 * Contact Command
 * Display contact information and support channels
 */

import { BaseCommand } from "../../base-command";
import {
  CommandArgs,
  CommandContext,
  CommandResult,
} from "../../../types/command.types";
import chalk from "chalk";

export class ContactCommand extends BaseCommand {
  name = "contact";
  description = "Display contact information and support channels";
  category = "core";
  aliases = ["support"];

  async execute(
    args: CommandArgs,
    context: CommandContext
  ): Promise<CommandResult> {
    const output: string[] = [];
    
    output.push('');
    output.push(chalk.cyan.bold('📞 Contact & Support'));
    output.push(chalk.gray('═'.repeat(30)));
    output.push('');
    
    output.push(chalk.white.bold('🏢 Company Information:'));
    output.push('  Company: Bonginkan');
    output.push('  Product: MARIA v3.8.0');
    output.push('  Website: https://bonginkan.ai');
    output.push('  Product Site: https://maria-code.ai');
    output.push('');
    
    output.push(chalk.white.bold('💬 Community & Support:'));
    output.push(chalk.blue('  Discord Community: https://discord.gg/SMSmSGcEQy'));
    output.push('    • #general-help - General questions');
    output.push('    • #bug-reports - Report issues');
    output.push('    • #feature-requests - Suggest improvements');
    output.push('    • #showcase - Share your projects');
    output.push('');
    
    output.push(chalk.white.bold('📧 Direct Contact:'));
    output.push(chalk.blue('  General Inquiries: info@bonginkan.ai'));
    output.push(chalk.blue('  Technical Support: support@bonginkan.ai'));
    output.push(chalk.blue('  Bug Reports: bugs@bonginkan.ai'));
    output.push(chalk.blue('  Feature Requests: features@bonginkan.ai'));
    output.push(chalk.blue('  Enterprise Sales: enterprise@bonginkan.ai'));
    output.push('');
    
    output.push(chalk.white.bold('🔗 Online Resources:'));
    output.push(chalk.blue('  GitHub Repository: https://github.com/bonginkan/maria'));
    output.push(chalk.blue('  Documentation: https://maria-code.ai/docs'));
    output.push(chalk.blue('  NPM Package: https://www.npmjs.com/package/@bonginkan/maria'));
    output.push(chalk.blue('  Status Page: https://status.maria-code.ai'));
    output.push('');
    
    output.push(chalk.white.bold('💼 Business & Partnerships:'));
    output.push(chalk.blue('  Business Development: partnerships@bonginkan.ai'));
    output.push(chalk.blue('  Media & Press: press@bonginkan.ai'));
    output.push(chalk.blue('  Legal: legal@bonginkan.ai'));
    output.push('');
    
    output.push(chalk.white.bold('📍 Response Times:'));
    output.push('  Community Discord: Real-time');
    output.push('  General Support: 24-48 hours');
    output.push('  Enterprise Support: 4-8 hours');
    output.push('  Critical Issues: 1-4 hours');
    output.push('');
    
    output.push(chalk.white.bold('🆘 Quick Help Commands:'));
    output.push('  /help              - Show all commands');
    output.push('  /docs              - Access documentation');
    output.push('  /feedback          - Submit feedback');
    output.push('  /tutorial          - Interactive learning');
    output.push('');
    
    output.push(chalk.green('We\'re here to help! Reach out anytime. 🚀'));
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
  name: 'contact',
  category: 'core',
  description: 'Display contact information and support channels',
  aliases: ['support'],
  usage: '/contact',
  examples: [
    '/contact'
  ],
  deps: []
};