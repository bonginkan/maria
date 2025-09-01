/**
 * Modern Help Command - With Free Plan Information
 * Shows available commands and plan-specific information
 */

import { BaseCommand, CommandMeta, CommandResult, CommandContext } from '../../shared/BaseCommand';
import { User } from '../../../services/cli-auth';
import chalk from 'chalk';

export class HelpCommand extends BaseCommand {
  readonly meta: CommandMeta = {
    name: 'help',
    description: 'Show available commands and usage information',
    category: 'core',
    aliases: ['h'],
    requiresAuth: false, // Help is always available
    status: 'stable'
  };

  async execute(): Promise<CommandResult> {
    const args = this.context.args || [];
    const subcommand = args[0];

    if (subcommand === 'pricing') {
      return this.showPricing();
    }

    if (subcommand) {
      return this.showCommandHelp(subcommand);
    }

    return this.showGeneralHelp();
  }

  /**
   * Show general help with plan information
   */
  private async showGeneralHelp(): Promise<CommandResult> {
    const user = await this.checkAuth();
    
    console.log(chalk.cyan.bold('\n🚀 MARIA CODE - AI-Powered Development Assistant'));
    console.log(chalk.gray('═'.repeat(50)));

    if (user) {
      const planColor = user.plan === 'FREE' ? chalk.green : chalk.cyan;
      const requestsLeft = user.usage.requestLimit - user.usage.requests;
      const usageColor = requestsLeft > 20 ? chalk.green : requestsLeft > 5 ? chalk.yellow : chalk.red;
      
      console.log(chalk.white(`👤 User: ${chalk.cyan(user.email)} | Plan: ${planColor(user.plan)}`));
      console.log(chalk.white(`📊 Usage: ${usageColor(`${requestsLeft}/${user.usage.requestLimit} requests left`)}`));
      console.log(chalk.gray(`⏰ Resets: ${user.usage.resetDate}`));
    } else {
      console.log(chalk.yellow('🔐 Not authenticated - Run /login to get started'));
    }

    console.log(chalk.white('\n🏃 Quick Start'));
    console.log(chalk.gray('  /login              - Sign in and start using MARIA'));
    if (!user) {
      console.log(chalk.gray('  /help pricing       - See available plans'));
    }

    console.log(chalk.white('\n💻 AI & Code (Free Plan)'));
    console.log(chalk.gray('  /code               - Generate code with AI'));
    console.log(chalk.gray('  /search             - Search and analyze code'));

    if (user?.plan !== 'FREE') {
      console.log(chalk.white('\n🎨 Multimodal (Pro+)'));
      console.log(chalk.gray('  /image              - Generate or analyze images'));
      console.log(chalk.gray('  /video              - Generate or analyze videos'));
      console.log(chalk.gray('  /voice              - Voice input or synthesis'));
    } else {
      console.log(chalk.white('\n🎨 Multimodal (Coming Soon)'));
      console.log(chalk.gray('  /image              - 🔒 Generate or analyze images'));
      console.log(chalk.gray('  /video              - 🔒 Generate or analyze videos'));
      console.log(chalk.gray('  /voice              - 🔒 Voice input or synthesis'));
      console.log(chalk.yellow('  Upgrade coming soon for multimodal features!'));
    }

    console.log(chalk.white('\n⚙️ System'));
    console.log(chalk.gray('  /status             - Show system status'));
    console.log(chalk.gray('  /version (/v)       - Show version'));
    console.log(chalk.gray('  /logout             - Sign out'));
    console.log(chalk.gray('  /help [command]     - Show details for a command'));

    if (user?.plan === 'FREE') {
      console.log(chalk.white('\n💡 Free Plan Benefits'));
      console.log(chalk.gray('  • 100 requests per month'));
      console.log(chalk.gray('  • Gemini Flash Lite, 2.0 Flash, 1.5 Flash models'));
      console.log(chalk.gray('  • Code generation and search'));
      console.log(chalk.gray('  • Community support'));
      console.log(chalk.yellow('  • Upgrade coming soon!'));
    }

    console.log(chalk.white('\n🔗 Links'));
    console.log(chalk.gray('  GitHub:   https://github.com/bonginkan/maria'));
    console.log(chalk.gray('  Support:  https://discord.gg/SMSmSGcEQy'));
    if (user?.plan === 'FREE') {
      console.log(chalk.gray('  Waitlist: https://maria.dev/waitlist'));
    }

    console.log(''); // Add spacing

    return this.success('Help displayed', {
      authenticated: !!user,
      plan: user?.plan || null,
      requestsLeft: user ? user.usage.requestLimit - user.usage.requests : null
    });
  }

  /**
   * Show pricing information for free plan users
   */
  private showPricing(): CommandResult {
    console.log(chalk.cyan.bold('\n💳 Pricing Plans'));
    console.log(chalk.gray('═'.repeat(50)));

    // FREE Plan (Current)
    console.log(chalk.green.bold('FREE       $0/month     100 req · 3 models · Community support'));
    console.log(chalk.green('           ✅ Active — Start now with Gemini Flash Lite / 2.0 Flash / 1.5 Flash'));
    console.log('');

    // Coming Soon Plans
    console.log(chalk.gray.bold('STARTER    $20/month    2,000 req · 4 models · Email support'));
    console.log(chalk.gray('           🔒 Coming Soon — Join Waitlist → https://maria.dev/waitlist'));
    console.log('');

    console.log(chalk.gray.bold('PRO        $39/month    6,000 req · 5 models · Priority support'));
    console.log(chalk.gray('           🔒 Coming Soon — Join Waitlist → https://maria.dev/waitlist'));
    console.log('');

    console.log(chalk.gray.bold('ULTRA      $99/month    10,000 req · 10 models · Premium support'));
    console.log(chalk.gray('           🔒 Coming Soon — Join Waitlist → https://maria.dev/waitlist'));
    console.log('');

    console.log(chalk.yellow('💡 Currently launching with Free plan only'));
    console.log(chalk.yellow('   Join the waitlist to get early access to paid plans!'));
    console.log('');

    return this.success('Pricing displayed');
  }

  /**
   * Show help for specific command
   */
  private showCommandHelp(command: string): CommandResult {
    const commandHelp = {
      'login': {
        description: 'Authenticate with MARIA using OAuth2',
        usage: '/login [--device] [--force]',
        options: [
          '--device  Use device code flow for headless environments',
          '--force   Force re-authentication'
        ],
        examples: [
          '/login                  # Standard browser login',
          '/login --device         # Device code for SSH/headless',
          '/login status           # Check authentication status'
        ]
      },
      'code': {
        description: 'Generate code with AI assistance',
        usage: '/code <prompt>',
        planReq: 'Available in Free plan',
        examples: [
          '/code create a REST API endpoint',
          '/code implement binary search in Python',
          '/code React component for user profile'
        ]
      },
      'logout': {
        description: 'Sign out from MARIA',
        usage: '/logout [--force] [--all]',
        options: [
          '--force  Force logout even if errors occur',
          '--all    Logout from all devices'
        ],
        examples: [
          '/logout           # Standard logout',
          '/logout --all     # Logout from all devices'
        ]
      }
    };

    const help = commandHelp[command as keyof typeof commandHelp];
    
    if (!help) {
      console.log(chalk.yellow(`\n⚠️  Unknown command: ${command}`));
      console.log(chalk.gray('Use /help to see all available commands'));
      return this.error('Unknown command', 'UNKNOWN_COMMAND');
    }

    console.log(chalk.cyan.bold(`\n📖 Help: /${command}`));
    console.log(chalk.gray('═'.repeat(50)));
    console.log(chalk.white(`Description: ${help.description}`));
    console.log(chalk.white(`Usage: ${chalk.cyan(help.usage)}`));
    
    if ('planReq' in help) {
      console.log(chalk.white(`Plan: ${chalk.green(help.planReq)}`));
    }

    if ('options' in help && help.options) {
      console.log(chalk.white('\nOptions:'));
      help.options.forEach(option => {
        console.log(chalk.gray(`  ${option}`));
      });
    }

    if (help.examples) {
      console.log(chalk.white('\nExamples:'));
      help.examples.forEach(example => {
        console.log(chalk.gray(`  ${example}`));
      });
    }

    console.log(''); // Add spacing

    return this.success(`Help for ${command} displayed`);
  }
}

export const meta = {
  name: 'help',
  category: 'core',
  description: 'Show available commands and usage information',
  aliases: ['h'],
  usage: '/help [command|pricing]',
  examples: [
    '/help',
    '/help code',
    '/help pricing'
  ],
  deps: []
};