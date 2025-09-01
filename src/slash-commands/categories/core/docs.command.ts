/**
 * Documentation Command
 * Quick access to MARIA documentation and resources
 */

import { BaseCommand } from "../../base-command";
import {
  CommandArgs,
  CommandContext,
  CommandResult,
} from "../../../types/command.types";
import { logger } from "../../../utils/logger";
import chalk from "chalk";

export class DocsCommand extends BaseCommand {
  name = "docs";
  description = "Quick access to MARIA documentation and resources";
  category = "core";
  aliases = ["documentation", "guide", "manual"];

  async execute(
    args: CommandArgs,
    context: CommandContext
  ): Promise<CommandResult> {
    try {
      const topic = args.parsed?.positional?.[0] as string;
      
      if (topic) {
        return this.showTopicDocs(topic);
      }
      
      return this.showGeneralDocs();
    } catch (error) {
      logger.error("Docs command failed:", error);
      return {
        success: false,
        message: `Failed to load documentation: ${error instanceof Error ? error.message : 'Unknown error'}`,
        requiresInput: false,
        autoRetry: false,
      };
    }
  }

  private showGeneralDocs(): CommandResult {
    const output: string[] = [];
    
    output.push('');
    output.push(chalk.cyan.bold('📚 MARIA Documentation'));
    output.push(chalk.gray('═'.repeat(40)));
    output.push('');
    
    output.push(chalk.white('🎯 Quick Start:'));
    output.push('  /help              - Show all available commands');
    output.push('  /code <task>       - Natural language code operations');
    output.push('  /image <prompt>    - Generate images with AI');
    output.push('  /setup             - Configure your environment');
    output.push('');
    
    output.push(chalk.white('📖 Documentation Topics:'));
    output.push('  /docs commands     - Command reference');
    output.push('  /docs features     - Feature overview');
    output.push('  /docs api          - API documentation');
    output.push('  /docs examples     - Usage examples');
    output.push('');
    
    output.push(chalk.white('🔗 Resources:'));
    output.push(chalk.blue('  Website: https://maria-code.ai'));
    output.push(chalk.blue('  Discord: https://discord.gg/SMSmSGcEQy'));
    output.push(chalk.blue('  GitHub: https://github.com/bonginkan/maria'));
    output.push('');
    
    return {
      success: true,
      message: output.join('\n'),
      requiresInput: false,
      autoRetry: false,
    };
  }

  private showTopicDocs(topic: string): CommandResult {
    const topics: Record<string, () => string[]> = {
      commands: () => [
        '📋 Command Categories:',
        '  • core - Essential system commands',
        '  • code - Natural language code operations',
        '  • ai - AI model management',
        '  • memory - Knowledge and context management',
        '  • multimodal - Image, video, voice generation',
        '  • business - Sales and analytics tools',
        '',
        'Use /help [category] for specific commands'
      ],
      
      features: () => [
        '⭐ Key Features:',
        '  • /code - Revolutionary natural language coding',
        '  • Graph RAG - Advanced knowledge retrieval',
        '  • Dual Memory - System 1 & System 2 architecture',
        '  • Multimodal AI - Images, videos, voice',
        '  • Enterprise Tools - Sales dashboards & analytics',
        '  • Plan Management - FREE/PRO/ULTRA tiers'
      ],
      
      api: () => [
        '🔌 API Integration:',
        '  • Multiple AI providers supported',
        '  • Rate limiting and quotas',
        '  • Authentication & authorization',
        '  • Real-time streaming responses',
        '',
        'Configure with /setup or /model commands'
      ],
      
      examples: () => [
        '💡 Usage Examples:',
        '  /code create a REST API',
        '  /image a futuristic cityscape',
        '  /memory remember this is important',
        '  /business dashboard --live',
        '  /gpu status',
        '',
        'Pro tip: Use natural language for /code commands!'
      ]
    };
    
    const content = topics[topic.toLowerCase()];
    if (!content) {
      return {
        success: false,
        message: `Unknown documentation topic: ${topic}. Available topics: ${Object.keys(topics).join(', ')}`,
        requiresInput: false,
        autoRetry: false,
      };
    }
    
    const output: string[] = [];
    output.push('');
    output.push(chalk.cyan.bold(`📚 ${topic.charAt(0).toUpperCase() + topic.slice(1)} Documentation`));
    output.push(chalk.gray('═'.repeat(40)));
    output.push('');
    output.push(...content().map(line => chalk.white(line)));
    output.push('');
    
    return {
      success: true,
      message: output.join('\n'),
      requiresInput: false,
      autoRetry: false,
    };
  }

  async handleError(error: Error): Promise<CommandResult> {
    return {
      success: false,
      message: `Documentation command failed: ${error.message}`,
      requiresInput: false,
      autoRetry: false,
    };
  }
}

export const meta = {
  name: 'docs',
  category: 'core',
  description: 'Quick access to MARIA documentation and resources',
  aliases: ['documentation', 'guide', 'manual'],
  usage: '/docs [topic]',
  examples: [
    '/docs',
    '/docs commands',
    '/docs features',
    '/docs examples'
  ],
  deps: []
};