/**
 * Feedback Command
 * Provide feedback and report issues
 */

import { BaseCommand } from "../../base-command";
import {
  CommandArgs,
  CommandContext,
  CommandResult,
} from "../../../types/command.types";
import chalk from "chalk";

export class FeedbackCommand extends BaseCommand {
  name = "feedback";
  description = "Provide feedback and report issues";
  category = "core";
  aliases = ["report", "bug", "suggestion"];

  async execute(
    args: CommandArgs,
    context: CommandContext
  ): Promise<CommandResult> {
    const type = args.parsed?.positional?.[0] as string;
    
    switch (type?.toLowerCase()) {
      case 'bug':
        return this.showBugReport();
      case 'feature':
      case 'suggestion':
        return this.showFeatureRequest();
      case 'support':
        return this.showSupport();
      default:
        return this.showGeneralFeedback();
    }
  }

  private showGeneralFeedback(): CommandResult {
    const output: string[] = [];
    
    output.push('');
    output.push(chalk.cyan.bold('💬 MARIA Feedback & Support'));
    output.push(chalk.gray('═'.repeat(35)));
    output.push('');
    
    output.push(chalk.white('🎯 We value your feedback! Choose how to contribute:'));
    output.push('');
    
    output.push(chalk.white('🐛 Report Issues:'));
    output.push('  /feedback bug        - Report bugs and errors');
    output.push(chalk.blue('  GitHub Issues: https://github.com/bonginkan/maria/issues'));
    output.push('');
    
    output.push(chalk.white('💡 Request Features:'));
    output.push('  /feedback feature    - Suggest new features');
    output.push(chalk.blue('  Feature Requests: https://github.com/bonginkan/maria/discussions'));
    output.push('');
    
    output.push(chalk.white('❓ Get Support:'));
    output.push('  /feedback support    - Get help and support');
    output.push(chalk.blue('  Discord Community: https://discord.gg/SMSmSGcEQy'));
    output.push('');
    
    output.push(chalk.white('📧 Direct Contact:'));
    output.push(chalk.blue('  Email: feedback@bonginkan.ai'));
    output.push(chalk.blue('  Website: https://maria-code.ai/contact'));
    output.push('');
    
    output.push(chalk.green('Thank you for helping make MARIA better! 🚀'));
    output.push('');
    
    return {
      success: true,
      message: output.join('\n'),
      requiresInput: false,
      autoRetry: false,
    };
  }

  private showBugReport(): CommandResult {
    const output: string[] = [];
    
    output.push('');
    output.push(chalk.red.bold('🐛 Bug Report Guide'));
    output.push(chalk.gray('═'.repeat(25)));
    output.push('');
    
    output.push(chalk.white('When reporting bugs, please include:'));
    output.push('');
    
    output.push(chalk.white('📋 Essential Information:'));
    output.push('  • MARIA version (/version)');
    output.push('  • Operating system and version');
    output.push('  • Node.js version');
    output.push('  • Command that caused the issue');
    output.push('  • Full error message or output');
    output.push('');
    
    output.push(chalk.white('🔍 Steps to Reproduce:'));
    output.push('  1. What you were trying to do');
    output.push('  2. Exact steps taken');
    output.push('  3. What you expected to happen');
    output.push('  4. What actually happened');
    output.push('');
    
    output.push(chalk.white('📤 Where to Report:'));
    output.push(chalk.blue('  GitHub Issues: https://github.com/bonginkan/maria/issues/new'));
    output.push(chalk.blue('  Discord: https://discord.gg/SMSmSGcEQy #bug-reports'));
    output.push(chalk.blue('  Email: bugs@bonginkan.ai'));
    output.push('');
    
    return {
      success: true,
      message: output.join('\n'),
      requiresInput: false,
      autoRetry: false,
    };
  }

  private showFeatureRequest(): CommandResult {
    const output: string[] = [];
    
    output.push('');
    output.push(chalk.green.bold('💡 Feature Request Guide'));
    output.push(chalk.gray('═'.repeat(30)));
    output.push('');
    
    output.push(chalk.white('We love new ideas! When suggesting features:'));
    output.push('');
    
    output.push(chalk.white('🎯 Describe Your Idea:'));
    output.push('  • What problem does it solve?');
    output.push('  • How would it work?');
    output.push('  • Who would benefit from it?');
    output.push('  • Any examples from other tools?');
    output.push('');
    
    output.push(chalk.white('💭 Use Cases:'));
    output.push('  • Provide specific scenarios');
    output.push('  • Show workflow improvements');
    output.push('  • Mention frequency of use');
    output.push('');
    
    output.push(chalk.white('📤 Submit Your Request:'));
    output.push(chalk.blue('  GitHub Discussions: https://github.com/bonginkan/maria/discussions'));
    output.push(chalk.blue('  Discord: https://discord.gg/SMSmSGcEQy #feature-requests'));
    output.push(chalk.blue('  Email: features@bonginkan.ai'));
    output.push('');
    
    return {
      success: true,
      message: output.join('\n'),
      requiresInput: false,
      autoRetry: false,
    };
  }

  private showSupport(): CommandResult {
    const output: string[] = [];
    
    output.push('');
    output.push(chalk.blue.bold('❓ Get Support & Help'));
    output.push(chalk.gray('═'.repeat(25)));
    output.push('');
    
    output.push(chalk.white('🚀 Quick Help:'));
    output.push('  /help           - Show all commands');
    output.push('  /docs           - Access documentation');
    output.push('  /version        - Check your version');
    output.push('  /doctor         - System diagnostics');
    output.push('');
    
    output.push(chalk.white('👥 Community Support:'));
    output.push(chalk.blue('  Discord: https://discord.gg/SMSmSGcEQy'));
    output.push('  • #general-help channel');
    output.push('  • #beginner-questions');
    output.push('  • #advanced-usage');
    output.push('');
    
    output.push(chalk.white('📚 Resources:'));
    output.push(chalk.blue('  Documentation: https://maria-code.ai/docs'));
    output.push(chalk.blue('  GitHub Wiki: https://github.com/bonginkan/maria/wiki'));
    output.push(chalk.blue('  Video Tutorials: https://maria-code.ai/tutorials'));
    output.push('');
    
    output.push(chalk.white('💼 Enterprise Support:'));
    output.push(chalk.blue('  Email: enterprise@bonginkan.ai'));
    output.push(chalk.blue('  Priority Support: https://maria-code.ai/enterprise'));
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
  name: 'feedback',
  category: 'core',
  description: 'Provide feedback and report issues',
  aliases: ['report', 'bug', 'suggestion'],
  usage: '/feedback [bug|feature|support]',
  examples: [
    '/feedback',
    '/feedback bug',
    '/feedback feature',
    '/feedback support'
  ],
  deps: []
};