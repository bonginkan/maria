/**
 * Upgrade Command
 * Interactive plan upgrade flow with feature comparison
 */

import { BaseCommand } from "../../base-command.js";
import {
  CommandArgs,
  CommandContext,
  CommandResult,
} from "../../../types/command.types.js";
import { renderFeatureComparison } from "../../../ui/components/plan-aware-ui.js";
import { getUserPlan, upgradePlan, Plan } from "../../../services/subscription/subscription-manager.js";
import chalk from 'chalk';

export class UpgradeCommand extends BaseCommand {
  name = "upgrade";
  description = "Upgrade your subscription plan";
  category = "system";
  aliases = ["pro", "ultra", "premium", "subscribe"];

  async execute(
    args: CommandArgs,
    context: CommandContext
  ): Promise<CommandResult> {
    const { plan, compare } = args as {
      plan?: string;
      compare?: boolean;
    };

    const currentPlan = getUserPlan();

    // Show comparison if requested
    if (compare) {
      return {
        success: true,
        message: renderFeatureComparison(),
        requiresInput: false,
        autoRetry: false,
      };
    }

    // If no plan specified, show interactive selector
    if (!plan) {
      return this.showInteractiveUpgrade(currentPlan);
    }

    // Process upgrade
    const targetPlan = plan.toUpperCase() as Plan;
    if (!['PRO', 'ULTRA'].includes(targetPlan)) {
      return {
        success: false,
        message: `Invalid plan: ${plan}. Choose 'pro' or 'ultra'.`,
        requiresInput: false,
        autoRetry: false,
      };
    }

    return this.processUpgrade(currentPlan, targetPlan);
  }

  private async showInteractiveUpgrade(currentPlan: Plan): Promise<CommandResult> {
    const output: string[] = [];
    
    output.push('');
    output.push(chalk.bold.cyan('💎 Upgrade Your Plan'));
    output.push('');
    output.push(chalk.gray('Current Plan: ') + this.getPlanBadge(currentPlan));
    output.push('');
    output.push(chalk.gray('─'.repeat(60)));
    output.push('');
    
    if (currentPlan === 'FREE') {
      // Show both PRO and ULTRA options
      output.push(chalk.bold.yellow('🌟 PRO Plan - $29/month'));
      output.push(chalk.gray('Perfect for professional developers'));
      output.push('');
      output.push('  ✅ 500 code operations/month');
      output.push('  ✅ 100 HD images/month');
      output.push('  ✅ 25 videos/month');
      output.push('  ✅ 5 requests/second rate limit');
      output.push('  ✅ Advanced AI models');
      output.push('  ✅ Priority support');
      output.push('');
      output.push(chalk.cyan('  Upgrade: /upgrade pro'));
      output.push('');
      output.push(chalk.gray('─'.repeat(60)));
      output.push('');
      output.push(chalk.bold.magenta('🚀 ULTRA Plan - $99/month'));
      output.push(chalk.gray('For teams and power users'));
      output.push('');
      output.push('  ✅ Unlimited code operations');
      output.push('  ✅ 500 HD images/month');
      output.push('  ✅ 100 videos/month');
      output.push('  ✅ 10 requests/second rate limit');
      output.push('  ✅ Custom AI models');
      output.push('  ✅ API access');
      output.push('  ✅ Team collaboration');
      output.push('  ✅ Dedicated support');
      output.push('');
      output.push(chalk.cyan('  Upgrade: /upgrade ultra'));
    } else if (currentPlan === 'PRO') {
      // Show ULTRA upgrade
      output.push(chalk.bold.magenta('🚀 Upgrade to ULTRA - $99/month'));
      output.push(chalk.gray('Unlock unlimited potential'));
      output.push('');
      output.push('  ✅ Unlimited code operations (vs 500)');
      output.push('  ✅ 500 HD images/month (vs 100)');
      output.push('  ✅ 100 videos/month (vs 25)');
      output.push('  ✅ 10 requests/second (vs 5)');
      output.push('  ✅ Custom AI models');
      output.push('  ✅ API access');
      output.push('  ✅ Team collaboration');
      output.push('  ✅ Dedicated support');
      output.push('');
      output.push(chalk.cyan('  Upgrade: /upgrade ultra'));
    } else {
      output.push(chalk.green('✨ You have the ULTRA plan!'));
      output.push('');
      output.push('You already have access to all features:');
      output.push('  • Unlimited code operations');
      output.push('  • Maximum rate limits');
      output.push('  • All premium features');
      output.push('  • Dedicated support');
    }
    
    output.push('');
    output.push(chalk.gray('─'.repeat(60)));
    output.push('');
    output.push(chalk.gray('Compare all plans: /upgrade --compare'));
    output.push('');
    
    return {
      success: true,
      message: output.join('\n'),
      requiresInput: false,
      autoRetry: false,
    };
  }

  private async processUpgrade(currentPlan: Plan, targetPlan: Plan): Promise<CommandResult> {
    const output: string[] = [];
    
    // Check if downgrade
    const planHierarchy: Record<Plan, number> = {
      FREE: 0,
      PRO: 1,
      ULTRA: 2
    };
    
    if (planHierarchy[targetPlan] <= planHierarchy[currentPlan]) {
      output.push('');
      output.push(chalk.yellow('⚠️  Invalid Upgrade'));
      output.push('');
      output.push(`You already have the ${this.getPlanBadge(currentPlan)} plan.`);
      if (currentPlan === 'ULTRA') {
        output.push('You have access to all features!');
      } else {
        output.push(`Consider upgrading to ${targetPlan === 'PRO' ? 'ULTRA' : 'a higher plan'} for more features.`);
      }
      output.push('');
      
      return {
        success: false,
        message: output.join('\n'),
        requiresInput: false,
        autoRetry: false,
      };
    }
    
    // Simulate upgrade process
    output.push('');
    output.push(chalk.cyan('🔄 Processing upgrade...'));
    output.push('');
    output.push(`From: ${this.getPlanBadge(currentPlan)}`);
    output.push(`To: ${this.getPlanBadge(targetPlan)}`);
    output.push('');
    
    // Simulate payment flow (in production, this would integrate with Stripe)
    output.push(chalk.gray('Redirecting to payment...'));
    output.push('');
    
    // For demo, instantly upgrade
    const upgraded = upgradePlan(targetPlan);
    
    if (upgraded) {
      output.push(chalk.green('✅ Upgrade Successful!'));
      output.push('');
      output.push(`Welcome to ${this.getPlanBadge(targetPlan)}!`);
      output.push('');
      
      if (targetPlan === 'PRO') {
        output.push('You now have access to:');
        output.push('  • HD image generation');
        output.push('  • Video generation');
        output.push('  • Advanced code features');
        output.push('  • 5x faster rate limits');
        output.push('  • Priority support');
      } else if (targetPlan === 'ULTRA') {
        output.push('You now have access to:');
        output.push('  • Unlimited code operations');
        output.push('  • Batch image processing');
        output.push('  • Custom AI models');
        output.push('  • API access');
        output.push('  • Maximum rate limits');
        output.push('  • Team collaboration');
        output.push('  • Dedicated support');
      }
      
      output.push('');
      output.push(chalk.cyan('Try your new features:'));
      output.push('  /image --hd');
      output.push('  /code refactor');
      output.push('  /video generate');
      output.push('');
    } else {
      output.push(chalk.red('❌ Upgrade failed'));
      output.push('');
      output.push('Please try again or contact support.');
    }
    
    return {
      success: upgraded,
      message: output.join('\n'),
      requiresInput: false,
      autoRetry: false,
    };
  }

  private getPlanBadge(plan: Plan): string {
    const badges = {
      FREE: chalk.gray('[FREE]'),
      PRO: chalk.bgYellow.black(' PRO '),
      ULTRA: chalk.bgMagenta.white(' ULTRA ')
    };
    return badges[plan];
  }

  async handleError(error: Error): Promise<CommandResult> {
    return {
      success: false,
      message: `Failed to process upgrade: ${error.message}`,
      requiresInput: false,
      autoRetry: false,
    };
  }
}

export const meta = {
  name: 'upgrade',
  category: 'system',
  description: 'Upgrade your subscription plan',
  aliases: ['pro', 'ultra', 'premium', 'subscribe'],
  usage: '/upgrade [pro|ultra] [--compare]',
  examples: [
    '/upgrade',
    '/upgrade pro',
    '/upgrade ultra',
    '/upgrade --compare'
  ],
  deps: []
};