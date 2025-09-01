/**
 * Examples Command
 * Show practical usage examples for MARIA commands
 */

import { BaseCommand } from "../../base-command";
import {
  CommandArgs,
  CommandContext,
  CommandResult,
} from "../../../types/command.types";
import chalk from "chalk";

export class ExamplesCommand extends BaseCommand {
  name = "examples";
  description = "Show practical usage examples for MARIA commands";
  category = "core";
  aliases = ["demo", "samples"];

  async execute(
    args: CommandArgs,
    context: CommandContext
  ): Promise<CommandResult> {
    const category = args.parsed?.positional?.[0] as string;
    
    switch (category?.toLowerCase()) {
      case 'code':
        return this.showCodeExamples();
      case 'ai':
        return this.showAIExamples();
      case 'system':
        return this.showSystemExamples();
      case 'business':
        return this.showBusinessExamples();
      default:
        return this.showAllExamples();
    }
  }

  private showAllExamples(): CommandResult {
    const output: string[] = [];
    
    output.push('');
    output.push(chalk.cyan.bold('💡 MARIA Usage Examples'));
    output.push(chalk.gray('═'.repeat(30)));
    output.push('');
    
    output.push(chalk.white('🚀 Quick Start Examples:'));
    output.push('');
    
    output.push(chalk.green('1. Getting Started:'));
    output.push('   /help                    # Show all commands');
    output.push('   /version                 # Check your version');
    output.push('   /setup                   # Configure MARIA');
    output.push('   /tutorial basics         # Interactive tutorial');
    output.push('');
    
    output.push(chalk.green('2. Natural Language Coding:'));
    output.push('   /code create a React login component');
    output.push('   /code fix TypeScript errors in this file');
    output.push('   /code add authentication to my Express app');
    output.push('   /code generate unit tests for calculator.js');
    output.push('');
    
    output.push(chalk.green('3. System Information:'));
    output.push('   /status                  # System health check');
    output.push('   /performance cpu         # CPU performance metrics');
    output.push('   /network test            # Test connectivity');
    output.push('   /debug memory            # Memory analysis');
    output.push('');
    
    output.push(chalk.green('4. AI & Memory:'));
    output.push('   /remember project uses React 18 and TypeScript');
    output.push('   /recall what framework are we using?');
    output.push('   /image a futuristic city at sunset');
    output.push('   /search knowledge about authentication patterns');
    output.push('');
    
    output.push(chalk.white.bold('📚 Detailed Examples by Category:'));
    output.push('  /examples code          - Code generation examples');
    output.push('  /examples ai            - AI and multimodal examples');
    output.push('  /examples system        - System management examples');
    output.push('  /examples business      - Business operations examples');
    output.push('');
    
    output.push(chalk.blue('💬 Need help? Join Discord: https://discord.gg/SMSmSGcEQy'));
    output.push('');
    
    return {
      success: true,
      message: output.join('\n'),
      requiresInput: false,
      autoRetry: false,
    };
  }

  private showCodeExamples(): CommandResult {
    const output: string[] = [];
    
    output.push('');
    output.push(chalk.cyan.bold('💻 Code Generation Examples'));
    output.push(chalk.gray('═'.repeat(35)));
    output.push('');
    
    output.push(chalk.white.bold('🔨 Creating New Code:'));
    output.push('');
    output.push('  ' + chalk.green('/code create a REST API for user management'));
    output.push('  ' + chalk.gray('→ Generates Express.js routes, middleware, and validation'));
    output.push('');
    output.push('  ' + chalk.green('/code create a React component for product cards'));
    output.push('  ' + chalk.gray('→ Creates TypeScript React component with props'));
    output.push('');
    output.push('  ' + chalk.green('/code generate unit tests for my calculator function'));
    output.push('  ' + chalk.gray('→ Creates Jest/Vitest tests with edge cases'));
    output.push('');
    
    output.push(chalk.white.bold('🔧 Fixing & Improving Code:'));
    output.push('');
    output.push('  ' + chalk.green('/code fix the TypeScript errors in src/utils.ts'));
    output.push('  ' + chalk.gray('→ Analyzes and fixes type errors'));
    output.push('');
    output.push('  ' + chalk.green('/code refactor this function to use async/await'));
    output.push('  ' + chalk.gray('→ Converts Promise chains to modern async syntax'));
    output.push('');
    output.push('  ' + chalk.green('/code optimize this database query for performance'));
    output.push('  ' + chalk.gray('→ Suggests indexes, query improvements'));
    output.push('');
    
    output.push(chalk.white.bold('➕ Adding Features:'));
    output.push('');
    output.push('  ' + chalk.green('/code add JWT authentication to my Express server'));
    output.push('  ' + chalk.gray('→ Adds auth middleware, token validation, routes'));
    output.push('');
    output.push('  ' + chalk.green('/code add TypeScript types to this JavaScript project'));
    output.push('  ' + chalk.gray('→ Converts JS to TS with proper typing'));
    output.push('');
    
    output.push(chalk.white.bold('🎯 Pro Tips:'));
    output.push('  • Be specific about your tech stack');
    output.push('  • Mention coding standards or patterns you prefer');
    output.push('  • Include context about your project structure');
    output.push('  • Use /code --dry-run to preview changes first');
    output.push('');
    
    return {
      success: true,
      message: output.join('\n'),
      requiresInput: false,
      autoRetry: false,
    };
  }

  private showAIExamples(): CommandResult {
    const output: string[] = [];
    
    output.push('');
    output.push(chalk.cyan.bold('🤖 AI & Multimodal Examples'));
    output.push(chalk.gray('═'.repeat(35)));
    output.push('');
    
    output.push(chalk.white.bold('🧠 Memory System:'));
    output.push('');
    output.push('  ' + chalk.green('/remember our API uses GraphQL with Apollo Server'));
    output.push('  ' + chalk.gray('→ Stores project context for future reference'));
    output.push('');
    output.push('  ' + chalk.green('/recall what database are we using for authentication?'));
    output.push('  ' + chalk.gray('→ Retrieves relevant stored information'));
    output.push('');
    output.push('  ' + chalk.green('/forget the old Redux implementation details'));
    output.push('  ' + chalk.gray('→ Removes outdated information'));
    output.push('');
    
    output.push(chalk.white.bold('🎨 Image Generation:'));
    output.push('');
    output.push('  ' + chalk.green('/image a modern dashboard UI design, clean and minimal'));
    output.push('  ' + chalk.gray('→ Generates UI mockup using Imagen 4.0'));
    output.push('');
    output.push('  ' + chalk.green('/image logo for a tech startup, blue gradient, modern font'));
    output.push('  ' + chalk.gray('→ Creates professional logo design'));
    output.push('');
    
    output.push(chalk.white.bold('🎥 Video Generation (Pro+):'));
    output.push('');
    output.push('  ' + chalk.green('/video product demo showing app features in 30 seconds'));
    output.push('  ' + chalk.gray('→ Creates marketing video using Veo 2.0'));
    output.push('');
    
    output.push(chalk.white.bold('🔍 Graph RAG Search:'));
    output.push('');
    output.push('  ' + chalk.green('/search best practices for React state management'));
    output.push('  ' + chalk.gray('→ Semantic search across knowledge graph'));
    output.push('');
    output.push('  ' + chalk.green('/search authentication patterns in Node.js'));
    output.push('  ' + chalk.gray('→ Finds relevant code patterns and documentation'));
    output.push('');
    
    output.push(chalk.white.bold('📊 Evaluation:'));
    output.push('');
    output.push('  ' + chalk.green('/evaluate code quality of my React components'));
    output.push('  ' + chalk.gray('→ Analyzes architecture, performance, best practices'));
    output.push('');
    
    return {
      success: true,
      message: output.join('\n'),
      requiresInput: false,
      autoRetry: false,
    };
  }

  private showSystemExamples(): CommandResult {
    const output: string[] = [];
    
    output.push('');
    output.push(chalk.cyan.bold('🖥️ System Management Examples'));
    output.push(chalk.gray('═'.repeat(35)));
    output.push('');
    
    output.push(chalk.white.bold('🔍 Monitoring & Diagnostics:'));
    output.push('');
    output.push('  ' + chalk.green('/status'));
    output.push('  ' + chalk.gray('→ Complete system health overview'));
    output.push('');
    output.push('  ' + chalk.green('/performance full'));
    output.push('  ' + chalk.gray('→ Detailed CPU, memory, and load analysis'));
    output.push('');
    output.push('  ' + chalk.green('/debug memory'));
    output.push('  ' + chalk.gray('→ Memory usage analysis and health check'));
    output.push('');
    output.push('  ' + chalk.green('/network test'));
    output.push('  ' + chalk.gray('→ Connectivity test to AI providers and services'));
    output.push('');
    
    output.push(chalk.white.bold('📊 Resource Monitoring:'));
    output.push('');
    output.push('  ' + chalk.green('/uptime'));
    output.push('  ' + chalk.gray('→ System and process uptime with load averages'));
    output.push('');
    output.push('  ' + chalk.green('/disk'));
    output.push('  ' + chalk.gray('→ Disk usage and MARIA storage information'));
    output.push('');
    output.push('  ' + chalk.green('/processes maria'));
    output.push('  ' + chalk.gray('→ Detailed MARIA process information'));
    output.push('');
    
    output.push(chalk.white.bold('🔧 Configuration:'));
    output.push('');
    output.push('  ' + chalk.green('/env node'));
    output.push('  ' + chalk.gray('→ Filter environment variables related to Node.js'));
    output.push('');
    output.push('  ' + chalk.green('/config show'));
    output.push('  ' + chalk.gray('→ Display current MARIA configuration'));
    output.push('');
    output.push('  ' + chalk.green('/setup'));
    output.push('  ' + chalk.gray('→ Interactive configuration wizard'));
    output.push('');
    
    output.push(chalk.white.bold('🚨 Troubleshooting:'));
    output.push('');
    output.push('  ' + chalk.green('/doctor'));
    output.push('  ' + chalk.gray('→ System diagnostics and health checks'));
    output.push('');
    output.push('  ' + chalk.green('/ping'));
    output.push('  ' + chalk.gray('→ Test MARIA responsiveness'));
    output.push('');
    
    return {
      success: true,
      message: output.join('\n'),
      requiresInput: false,
      autoRetry: false,
    };
  }

  private showBusinessExamples(): CommandResult {
    const output: string[] = [];
    
    output.push('');
    output.push(chalk.cyan.bold('💼 Business Operations Examples'));
    output.push(chalk.gray('═'.repeat(35)));
    output.push('');
    
    output.push(chalk.white.bold('📊 Analytics & Dashboards:'));
    output.push('');
    output.push('  ' + chalk.green('/business dashboard --live'));
    output.push('  ' + chalk.gray('→ Real-time sales and performance dashboard'));
    output.push('');
    output.push('  ' + chalk.green('/business analytics monthly'));
    output.push('  ' + chalk.gray('→ Monthly business performance reports'));
    output.push('');
    
    output.push(chalk.white.bold('🎯 Competitive Analysis:'));
    output.push('');
    output.push('  ' + chalk.green('/business battlecard OpenAI'));
    output.push('  ' + chalk.gray('→ Competitive analysis vs OpenAI'));
    output.push('');
    output.push('  ' + chalk.green('/business battlecard --industry SaaS'));
    output.push('  ' + chalk.gray('→ Industry-wide competitive landscape'));
    output.push('');
    
    output.push(chalk.white.bold('👥 Team Management:'));
    output.push('');
    output.push('  ' + chalk.green('/business pilot setup'));
    output.push('  ' + chalk.gray('→ Configure 5-person pilot team automation'));
    output.push('');
    output.push('  ' + chalk.green('/business team performance'));
    output.push('  ' + chalk.gray('→ Team productivity and KPI tracking'));
    output.push('');
    
    output.push(chalk.white.bold('💰 Revenue Operations:'));
    output.push('');
    output.push('  ' + chalk.green('/auth usage'));
    output.push('  ' + chalk.gray('→ Current plan usage and quota status'));
    output.push('');
    output.push('  ' + chalk.green('/auth plan upgrade'));
    output.push('  ' + chalk.gray('→ View and manage subscription plans'));
    output.push('');
    
    output.push(chalk.yellow.bold('⚠️  Note: Business commands require Pro+ subscription'));
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
  name: 'examples',
  category: 'core',
  description: 'Show practical usage examples for MARIA commands',
  aliases: ['demo', 'samples'],
  usage: '/examples [code|ai|system|business]',
  examples: [
    '/examples',
    '/examples code',
    '/examples ai',
    '/examples system'
  ],
  deps: []
};