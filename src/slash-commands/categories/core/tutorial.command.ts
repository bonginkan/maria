/**
 * Tutorial Command
 * Interactive MARIA tutorial and onboarding
 */

import { BaseCommand } from "../../base-command";
import {
  CommandArgs,
  CommandContext,
  CommandResult,
} from "../../../types/command.types";
import chalk from "chalk";

export class TutorialCommand extends BaseCommand {
  name = "tutorial";
  description = "Interactive MARIA tutorial and onboarding";
  category = "core";
  aliases = ["learn", "onboard"];

  async execute(
    args: CommandArgs,
    context: CommandContext
  ): Promise<CommandResult> {
    const lesson = args.parsed?.positional?.[0] as string;
    
    switch (lesson?.toLowerCase()) {
      case 'basics':
      case '1':
        return this.showBasicsTutorial();
      case 'code':
      case '2':
        return this.showCodeTutorial();
      case 'advanced':
      case '3':
        return this.showAdvancedTutorial();
      default:
        return this.showTutorialMenu();
    }
  }

  private showTutorialMenu(): CommandResult {
    const output: string[] = [];
    
    output.push('');
    output.push(chalk.cyan.bold('🎓 MARIA Interactive Tutorial'));
    output.push(chalk.gray('═'.repeat(35)));
    output.push('');
    
    output.push(chalk.white('Welcome to MARIA! Choose your learning path:'));
    output.push('');
    
    output.push(chalk.white.bold('📚 Tutorial Lessons:'));
    output.push('  /tutorial basics    - Essential commands and navigation');
    output.push('  /tutorial code      - Natural language coding with /code');
    output.push('  /tutorial advanced  - AI features and enterprise tools');
    output.push('');
    
    output.push(chalk.white.bold('🚀 Quick Start:'));
    output.push('  1. Try /help to see all commands');
    output.push('  2. Use /version to check your MARIA version');
    output.push('  3. Run /setup to configure your preferences');
    output.push('  4. Test /code with: /code create hello world function');
    output.push('');
    
    output.push(chalk.white.bold('💡 Pro Tips:'));
    output.push('  • Most commands have aliases: /h for /help');
    output.push('  • Use /shortcuts to see all keyboard shortcuts');
    output.push('  • Type /docs for comprehensive documentation');
    output.push('  • Join Discord for community support');
    output.push('');
    
    output.push(chalk.white.bold('🔗 Resources:'));
    output.push(chalk.blue('  Documentation: https://maria-code.ai/docs'));
    output.push(chalk.blue('  Discord Community: https://discord.gg/SMSmSGcEQy'));
    output.push(chalk.blue('  Video Tutorials: https://maria-code.ai/tutorials'));
    output.push('');
    
    output.push(chalk.green('Ready to learn? Pick a lesson above! 🎯'));
    output.push('');
    
    return {
      success: true,
      message: output.join('\n'),
      requiresInput: false,
      autoRetry: false,
    };
  }

  private showBasicsTutorial(): CommandResult {
    const output: string[] = [];
    
    output.push('');
    output.push(chalk.cyan.bold('📚 Lesson 1: MARIA Basics'));
    output.push(chalk.gray('═'.repeat(30)));
    output.push('');
    
    output.push(chalk.white.bold('🎯 Essential Commands:'));
    output.push('');
    
    output.push(chalk.green('1. Getting Help:'));
    output.push('   /help           - Show all available commands');
    output.push('   /help core      - Show commands in core category');
    output.push('   /docs           - Access detailed documentation');
    output.push('');
    
    output.push(chalk.green('2. System Information:'));
    output.push('   /version        - Check MARIA version');
    output.push('   /status         - System health and status');
    output.push('   /whoami         - Your user information');
    output.push('');
    
    output.push(chalk.green('3. Configuration:'));
    output.push('   /setup          - Initial configuration wizard');
    output.push('   /config         - View/manage settings');
    output.push('');
    
    output.push(chalk.green('4. Navigation:'));
    output.push('   /clear          - Clear the screen');
    output.push('   /quit           - Exit MARIA');
    output.push('');
    
    output.push(chalk.white.bold('✨ Try These Now:'));
    output.push('  1. Run: /version');
    output.push('  2. Run: /status');
    output.push('  3. Run: /help system');
    output.push('');
    
    output.push(chalk.blue('Next: /tutorial code to learn natural language coding!'));
    output.push('');
    
    return {
      success: true,
      message: output.join('\n'),
      requiresInput: false,
      autoRetry: false,
    };
  }

  private showCodeTutorial(): CommandResult {
    const output: string[] = [];
    
    output.push('');
    output.push(chalk.cyan.bold('💻 Lesson 2: Natural Language Coding'));
    output.push(chalk.gray('═'.repeat(40)));
    output.push('');
    
    output.push(chalk.white.bold('🤖 Revolutionary /code Command:'));
    output.push('');
    
    output.push(chalk.green('Basic Usage:'));
    output.push('   /code create a function that adds two numbers');
    output.push('   /code fix the TypeScript errors in this file');
    output.push('   /code refactor this to use async/await');
    output.push('');
    
    output.push(chalk.green('Code Intent Types:'));
    output.push('   CREATE     - Generate new code');
    output.push('   MODIFY     - Change existing code');
    output.push('   FIX_ERROR  - Fix bugs and errors');
    output.push('   REFACTOR   - Improve code structure');
    output.push('   ADD_FEATURE- Add new functionality');
    output.push('   DELETE     - Remove code');
    output.push('   TEST       - Generate tests');
    output.push('');
    
    output.push(chalk.green('Advanced Features:'));
    output.push('   • AST-based code analysis');
    output.push('   • Parallel TypeScript & ESLint validation');
    output.push('   • SARIF/JUnit report generation');
    output.push('   • CI/IDE integration support');
    output.push('');
    
    output.push(chalk.white.bold('✨ Try These Examples:'));
    output.push('  1. /code create a React component for a login form');
    output.push('  2. /code generate unit tests for a calculator function');
    output.push('  3. /code fix any errors (paste your error here)');
    output.push('');
    
    output.push(chalk.blue('Next: /tutorial advanced for AI features and enterprise tools!'));
    output.push('');
    
    return {
      success: true,
      message: output.join('\n'),
      requiresInput: false,
      autoRetry: false,
    };
  }

  private showAdvancedTutorial(): CommandResult {
    const output: string[] = [];
    
    output.push('');
    output.push(chalk.cyan.bold('🚀 Lesson 3: Advanced AI Features'));
    output.push(chalk.gray('═'.repeat(35)));
    output.push('');
    
    output.push(chalk.white.bold('🧠 Memory System:'));
    output.push('   /remember [info]    - Store knowledge');
    output.push('   /recall [query]     - Retrieve information');
    output.push('   /forget [info]      - Remove memories');
    output.push('   /memory-status      - Check memory usage');
    output.push('');
    
    output.push(chalk.white.bold('🎨 Multimodal Generation:'));
    output.push('   /image [prompt]     - Generate images');
    output.push('   /video [prompt]     - Create videos (Pro+)');
    output.push('   /voice [text]       - Text-to-speech');
    output.push('');
    
    output.push(chalk.white.bold('💼 Business Operations:'));
    output.push('   /business battlecard - Competitive analysis');
    output.push('   /business dashboard  - Sales dashboards');
    output.push('   /business pilot      - Team automation');
    output.push('');
    
    output.push(chalk.white.bold('🔍 Graph RAG Search:'));
    output.push('   /search [query]     - Knowledge graph search');
    output.push('   /evaluate [task]    - Performance evaluation');
    output.push('');
    
    output.push(chalk.white.bold('⚡ GPU & Performance:'));
    output.push('   /gpu status         - GPU information *Local LLM only');
    output.push('   /performance        - System metrics');
    output.push('   /debug full         - Detailed diagnostics');
    output.push('');
    
    output.push(chalk.white.bold('🎓 Graduation:'));
    output.push('  Congratulations! You now know MARIA\'s key features.');
    output.push('  For more help: /docs, /feedback, or join our Discord!');
    output.push('');
    
    output.push(chalk.green('You\'re ready to master MARIA! 🏆'));
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
  name: 'tutorial',
  category: 'core',
  description: 'Interactive MARIA tutorial and onboarding',
  aliases: ['learn', 'onboard'],
  usage: '/tutorial [basics|code|advanced]',
  examples: [
    '/tutorial',
    '/tutorial basics',
    '/tutorial code',
    '/tutorial advanced'
  ],
  deps: []
};