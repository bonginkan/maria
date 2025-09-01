/**
 * Usage Command
 * Display usage statistics and remaining quotas
 */

import { BaseCommand } from "../../base-command.js";
import {
  CommandArgs,
  CommandContext,
  CommandResult,
  CommandExample,
} from "../../types";
import { displayUsageSummary, generateTelemetryReport } from "../../../middleware/command-middleware.js";
import { planRateLimiters } from "../../../middleware/rate-limiter.js";
import chalk from "chalk";

export class UsageCommand extends BaseCommand {
  name = "usage";
  category = "system" as const;
  description = "Display your usage statistics and remaining quotas";
  usage = "/usage [options]";
  
  examples: CommandExample[] = [
    {
      input: "/usage",
      description: "Show current month's usage summary",
    },
    {
      input: "/usage --detailed",
      description: "Show detailed usage breakdown",
    },
    {
      input: "/usage --telemetry",
      description: "Show telemetry metrics",
    },
  ];

  async execute(
    commandArgs: CommandArgs,
    context: CommandContext,
  ): Promise<CommandResult> {
    const userId = context.userId || 'anonymous';
    const planId = context.planId || 'free';
    
    // Parse options
    const options = this.parseOptions(commandArgs.raw);
    
    try {
      if (options.telemetry) {
        // Show telemetry report
        const report = generateTelemetryReport(3600000); // Last hour
        console.log(report);
        return this.success("");
      }
      
      if (options.rate) {
        // Show rate limit status
        const rateResult = await planRateLimiters.checkLimit(userId, planId);
        
        console.log(chalk.cyan("⏱️  Rate Limit Status\n"));
        console.log(chalk.gray(`Plan: ${chalk.white(planId.toUpperCase())}`));
        console.log(chalk.gray(`Status: ${rateResult.allowed ? chalk.green('Ready') : chalk.red('Limited')}`));
        console.log(chalk.gray(`Remaining: ${chalk.white(rateResult.remainingRequests)} requests`));
        
        if (!rateResult.allowed && rateResult.retryAfter) {
          console.log(chalk.yellow(`\nRetry after: ${rateResult.retryAfter} seconds`));
        }
        
        const resetTime = new Date(rateResult.resetTime);
        console.log(chalk.gray(`\nResets at: ${chalk.white(resetTime.toLocaleTimeString())}`));
        
        return this.success("");
      }
      
      // Default: Show usage summary
      const summary = await displayUsageSummary(userId, planId);
      console.log(summary);
      
      // Add upgrade prompt for FREE users
      if (planId === 'free') {
        console.log(chalk.cyan("\n💡 Upgrade to Pro for:"));
        console.log(chalk.gray("  • 10x more requests (1000/month)"));
        console.log(chalk.gray("  • 4x more images (100/month)"));
        console.log(chalk.gray("  • 4x more videos (20/month)"));
        console.log(chalk.gray("  • Faster rate limits (5 req/sec)"));
        console.log(chalk.gray("  • Premium models access"));
        console.log(chalk.cyan("\n  Join waitlist: /upgrade"));
      }
      
      // Show quick tips
      console.log(chalk.gray("\n📖 Quick Tips:"));
      console.log(chalk.gray("  • /usage --rate     Check rate limit status"));
      console.log(chalk.gray("  • /usage --telemetry Show system metrics"));
      console.log(chalk.gray("  • /help              See all commands"));
      console.log(chalk.gray("  • /model             See available models"));
      
      return this.success("");
      
    } catch (error) {
      console.error("Error fetching usage:", error);
      return this.error("Failed to fetch usage data");
    }
  }
  
  private parseOptions(args: string[]): any {
    const options: any = {};
    
    for (const arg of args) {
      if (arg === '--detailed' || arg === '-d') {
        options.detailed = true;
      } else if (arg === '--telemetry' || arg === '-t') {
        options.telemetry = true;
      } else if (arg === '--rate' || arg === '-r') {
        options.rate = true;
      }
    }
    
    return options;
  }
}

export const meta = {
  name: 'usage',
  category: 'system',
  description: 'Display your usage statistics and remaining quotas',
  aliases: [],
  usage: '/usage [--detailed] [--telemetry] [--rate]',
  examples: [
    '/usage',
    '/usage --detailed',
    '/usage --telemetry',
    '/usage --rate'
  ],
  deps: []
};

export default UsageCommand;