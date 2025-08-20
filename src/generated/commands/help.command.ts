/**
 * Help Command Module
 * ヘルプコマンド - 包括的なヘルプとドキュメンテーションシステム
 * 
 * Phase 4: Low-frequency commands implementation
 * Category: Information
 */

import { SlashCommandResult } from '../../services/slash-command-handler';
import { BaseCommand } from './base-command';
import { CommandArgs, CommandContext } from './types';
import chalk from 'chalk';

export interface HelpTopic {
  name: string;
  title: string;
  description: string;
  category: string;
  content: string;
  examples?: string[];
  seeAlso?: string[];
  keywords?: string[];
}

export class HelpCommand extends BaseCommand {
  name = 'help';
  description = 'Show comprehensive help and documentation';
  usage = '/help [topic|command] [--category=<category>] [--search=<term>]';
  category = 'information';
  
  examples = [
    '/help',
    '/help code',
    '/help --category=development',
    '/help --search=git',
    '/help getting-started'
  ];

  async execute(args: CommandArgs, context: CommandContext): Promise<SlashCommandResult> {
    try {
      const [topic, ...extraArgs] = args.args;
      const category = args.flags.category as string;
      const searchTerm = args.flags.search as string;

      if (searchTerm) {
        return await this.searchHelp(searchTerm);
      }

      if (category) {
        return await this.showCategoryHelp(category);
      }

      if (topic) {
        return await this.showTopicHelp(topic);
      }

      return await this.showMainHelp();
    } catch (error) {
      return {
        success: false,
        message: `Help command error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  private async showMainHelp(): Promise<SlashCommandResult> {
    let message = `\n${chalk.bold('🚀 MARIA CODE - AI Development Assistant')}\n\n`;
    
    message += `${chalk.blue('Welcome to MARIA!')} Your intelligent coding companion powered by advanced AI.\n\n`;
    
    message += `${chalk.bold('📋 Quick Start:')}\n`;
    message += `  ${chalk.blue('maria chat')}     → Start interactive session\n`;
    message += `  ${chalk.blue('/code')} "task"   → Generate code\n`;
    message += `  ${chalk.blue('/test')}          → Generate tests\n`;
    message += `  ${chalk.blue('/review')}        → Review code\n`;
    message += `  ${chalk.blue('/init')}          → Initialize project\n\n`;
    
    message += `${chalk.bold('📚 Help Topics:')}\n`;
    const topics = this.getHelpTopics();
    const categories = this.groupTopicsByCategory(topics);
    
    Object.entries(categories).forEach(([cat, catTopics]) => {
      message += `\n  ${chalk.bold.yellow(cat.toUpperCase())}:\n`;
      catTopics.slice(0, 5).forEach(topic => {
        message += `    ${chalk.blue(topic.name.padEnd(15))} ${topic.description}\n`;
      });
      if (catTopics.length > 5) {
        message += chalk.gray(`    ... and ${catTopics.length - 5} more\n`);
      }
    });
    
    message += `\n${chalk.bold('🔍 Search & Navigation:')}\n`;
    message += `  ${chalk.blue('/help <command>')}           → Help for specific command\n`;
    message += `  ${chalk.blue('/help --category=dev')}      → Show development commands\n`;
    message += `  ${chalk.blue('/help --search=git')}        → Search help content\n`;
    message += `  ${chalk.blue('/help getting-started')}     → Beginner's guide\n\n`;
    
    message += `${chalk.bold('🛠️ System Commands:')}\n`;
    message += `  ${chalk.blue('/status')}        → System status and diagnostics\n`;
    message += `  ${chalk.blue('/config')}        → Configuration management\n`;
    message += `  ${chalk.blue('/doctor')}        → Health check and troubleshooting\n`;
    message += `  ${chalk.blue('/version')}       → Version information\n\n`;
    
    message += `${chalk.bold('💡 Pro Tips:')}\n`;
    message += `  • Use ${chalk.code('Tab')} for auto-completion\n`;
    message += `  • Use ${chalk.code('Ctrl+C')} to interrupt operations\n`;
    message += `  • Use ${chalk.code('/clear')} to reset conversation context\n`;
    message += `  • Type naturally - MARIA understands intent!\n\n`;
    
    message += `${chalk.bold('🌟 Key Features:')}\n`;
    message += `  • ${chalk.green('✓')} Multi-model AI support (GPT-4, Claude, Gemini, etc.)\n`;
    message += `  • ${chalk.green('✓')} Natural language → Code generation\n`;
    message += `  • ${chalk.green('✓')} Intelligent code review and testing\n`;
    message += `  • ${chalk.green('✓')} Project initialization and templates\n`;
    message += `  • ${chalk.green('✓')} Git integration and automation\n`;
    message += `  • ${chalk.green('✓')} Media generation (images, videos)\n\n`;
    
    message += chalk.blue('💬 Need more help? Just ask: "How do I...?" or "Can you help me with...?"');
    
    return { success: true, message };
  }

  private async showTopicHelp(topic: string): Promise<SlashCommandResult> {
    const topics = this.getHelpTopics();
    const helpTopic = topics.find(t => 
      t.name.toLowerCase() === topic.toLowerCase() ||
      t.keywords?.some(k => k.toLowerCase() === topic.toLowerCase())
    );
    
    if (!helpTopic) {
      // Try to find command help
      return await this.showCommandHelp(topic);
    }
    
    let message = `\n${chalk.bold(`📖 ${helpTopic.title}`)}\n\n`;
    message += `${helpTopic.content}\n`;
    
    if (helpTopic.examples && helpTopic.examples.length > 0) {
      message += `\n${chalk.bold('Examples:')}\n`;
      helpTopic.examples.forEach(example => {
        message += `  ${chalk.blue(example)}\n`;
      });
    }
    
    if (helpTopic.seeAlso && helpTopic.seeAlso.length > 0) {
      message += `\n${chalk.bold('See Also:')}\n`;
      helpTopic.seeAlso.forEach(related => {
        message += `  ${chalk.blue(`/help ${related}`)}\n`;
      });
    }
    
    return { success: true, message };
  }

  private async showCommandHelp(commandName: string): Promise<SlashCommandResult> {
    const commands = this.getAllCommands();
    const command = commands.find(c => c.name.toLowerCase() === commandName.toLowerCase());
    
    if (!command) {
      return {
        success: false,
        message: `No help found for "${commandName}". Use \`/help\` to see all available topics and commands.`
      };
    }
    
    let message = `\n${chalk.bold(`/${command.name}`)} - ${command.description}\n\n`;
    
    message += `${chalk.bold('Usage:')}\n`;
    message += `  ${chalk.blue(command.usage)}\n\n`;
    
    message += `${chalk.bold('Category:')} ${command.category}\n\n`;
    
    if (command.examples && command.examples.length > 0) {
      message += `${chalk.bold('Examples:')}\n`;
      command.examples.forEach(example => {
        message += `  ${chalk.blue(example)}\n`;
      });
      message += '\n';
    }
    
    // Add specific help for certain commands
    const specificHelp = this.getSpecificCommandHelp(command.name);
    if (specificHelp) {
      message += specificHelp;
    }
    
    return { success: true, message };
  }

  private async showCategoryHelp(category: string): Promise<SlashCommandResult> {
    const commands = this.getAllCommands();
    const categoryCommands = commands.filter(c => 
      c.category.toLowerCase().includes(category.toLowerCase())
    );
    
    if (categoryCommands.length === 0) {
      const availableCategories = [...new Set(commands.map(c => c.category))];
      return {
        success: false,
        message: `No commands found in category "${category}".\n\n` +
                 `Available categories: ${availableCategories.join(', ')}`
      };
    }
    
    let message = `\n${chalk.bold(`📂 ${category.charAt(0).toUpperCase() + category.slice(1)} Commands`)}\n\n`;
    
    categoryCommands.forEach(command => {
      message += `${chalk.blue(`/${command.name}`.padEnd(20))} ${command.description}\n`;
    });
    
    message += `\n${chalk.bold('Usage:')}\n`;
    message += `Use ${chalk.blue('/help <command>')} for detailed help on any command.\n`;
    message += `Example: ${chalk.blue(`/help ${categoryCommands[0]?.name}`)}`;
    
    return { success: true, message };
  }

  private async searchHelp(searchTerm: string): Promise<SlashCommandResult> {
    const topics = this.getHelpTopics();
    const commands = this.getAllCommands();
    const term = searchTerm.toLowerCase();
    
    // Search in topics
    const matchingTopics = topics.filter(topic =>
      topic.name.toLowerCase().includes(term) ||
      topic.title.toLowerCase().includes(term) ||
      topic.description.toLowerCase().includes(term) ||
      topic.content.toLowerCase().includes(term) ||
      topic.keywords?.some(k => k.toLowerCase().includes(term))
    );
    
    // Search in commands
    const matchingCommands = commands.filter(command =>
      command.name.toLowerCase().includes(term) ||
      command.description.toLowerCase().includes(term) ||
      command.usage.toLowerCase().includes(term) ||
      command.examples?.some(e => e.toLowerCase().includes(term))
    );
    
    if (matchingTopics.length === 0 && matchingCommands.length === 0) {
      return {
        success: false,
        message: `No help content found for "${searchTerm}".\n\n` +
                 `${chalk.blue('💡 Try:')} Use broader search terms or browse categories with ${chalk.code('/help --category=<category>')}`
      };
    }
    
    let message = `\n${chalk.bold(`🔍 Search Results for "${searchTerm}"`)}\n\n`;
    
    if (matchingTopics.length > 0) {
      message += `${chalk.bold('Help Topics:')}\n`;
      matchingTopics.forEach(topic => {
        message += `  ${chalk.blue(topic.name.padEnd(20))} ${topic.description}\n`;
      });
      message += '\n';
    }
    
    if (matchingCommands.length > 0) {
      message += `${chalk.bold('Commands:')}\n`;
      matchingCommands.forEach(command => {
        message += `  ${chalk.blue(`/${command.name}`.padEnd(20))} ${command.description}\n`;
      });
      message += '\n';
    }
    
    const totalResults = matchingTopics.length + matchingCommands.length;
    message += chalk.gray(`Found ${totalResults} result${totalResults !== 1 ? 's' : ''}\n\n`);
    message += `${chalk.blue('💡 Tip:')} Use ${chalk.code(`/help <topic>`)} for detailed information`;
    
    return { success: true, message };
  }

  private getHelpTopics(): HelpTopic[] {
    return [
      {
        name: 'getting-started',
        title: 'Getting Started with MARIA',
        description: 'Complete beginner\'s guide',
        category: 'basics',
        content: `${chalk.bold('Welcome to MARIA CODE!')} 🎉\n\n` +
                 `MARIA is your intelligent AI development assistant that helps you write code, review changes, generate tests, and much more.\n\n` +
                 `${chalk.bold('First Steps:')}\n` +
                 `1. Start an interactive session: ${chalk.code('maria chat')}\n` +
                 `2. Initialize a project: ${chalk.code('/init')}\n` +
                 `3. Generate your first code: ${chalk.code('/code "create a hello world function"')}\n` +
                 `4. Review and test: ${chalk.code('/test')} and ${chalk.code('/review')}\n\n` +
                 `${chalk.bold('Natural Language Interface:')}\n` +
                 `MARIA understands natural language! You can say things like:\n` +
                 `• "Create a REST API for user management"\n` +
                 `• "Add tests for the authentication module"\n` +
                 `• "Review this code for security issues"\n` +
                 `• "Generate a React component for a login form"\n\n` +
                 `${chalk.bold('Key Features:')}\n` +
                 `• Multi-model AI support (GPT-4, Claude, Gemini, local models)\n` +
                 `• Intelligent code generation and review\n` +
                 `• Automated testing and documentation\n` +
                 `• Git integration and project management\n` +
                 `• Media generation (images, videos)\n` +
                 `• Extensive customization options`,
        examples: [
          'maria chat',
          '/init',
          '/code "create a function to calculate fibonacci"',
          '/test',
          '/help commands'
        ],
        seeAlso: ['commands', 'configuration', 'models'],
        keywords: ['tutorial', 'beginner', 'start', 'introduction']
      },
      
      {
        name: 'commands',
        title: 'Command Reference',
        description: 'Complete list of available commands',
        category: 'reference',
        content: `MARIA provides 40+ slash commands organized into categories:\n\n` +
                 `${chalk.bold('🔧 Core Development:')}\n` +
                 `• ${chalk.blue('/code')} - AI-powered code generation\n` +
                 `• ${chalk.blue('/test')} - Generate and run tests\n` +
                 `• ${chalk.blue('/review')} - Code review and analysis\n` +
                 `• ${chalk.blue('/bug')} - Bug detection and fixing\n\n` +
                 `${chalk.bold('📁 Project Management:')}\n` +
                 `• ${chalk.blue('/init')} - Initialize project with AI guidance\n` +
                 `• ${chalk.blue('/commit')} - Generate commit messages\n` +
                 `• ${chalk.blue('/deploy')} - Deployment assistance\n` +
                 `• ${chalk.blue('/memory')} - Manage project memory\n\n` +
                 `${chalk.bold('🎨 Media Generation:')}\n` +
                 `• ${chalk.blue('/image')} - Generate images with AI\n` +
                 `• ${chalk.blue('/video')} - Create videos with AI\n` +
                 `• ${chalk.blue('/avatar')} - Generate avatar animations\n\n` +
                 `${chalk.bold('⚙️ Configuration:')}\n` +
                 `• ${chalk.blue('/config')} - Manage settings\n` +
                 `• ${chalk.blue('/settings')} - Advanced settings management\n` +
                 `• ${chalk.blue('/setup')} - Initial setup wizard\n` +
                 `• ${chalk.blue('/model')} - Switch AI models\n` +
                 `• ${chalk.blue('/permissions')} - Manage permissions\n` +
                 `• ${chalk.blue('/hooks')} - Development workflow hooks\n\n` +
                 `${chalk.bold('🛠️ System:')}\n` +
                 `• ${chalk.blue('/status')} - System information\n` +
                 `• ${chalk.blue('/doctor')} - Health diagnostics\n` +
                 `• ${chalk.blue('/terminal-setup')} - Terminal optimization\n` +
                 `• ${chalk.blue('/vim')} - Vim mode toggle`,
        examples: [
          '/help <command-name>',
          '/help --category=development',
          '/help --search=git'
        ],
        seeAlso: ['getting-started', 'configuration'],
        keywords: ['reference', 'list', 'all']
      },
      
      {
        name: 'models',
        title: 'AI Models and Providers',
        description: 'Guide to available AI models',
        category: 'configuration',
        content: `MARIA supports multiple AI providers and models:\n\n` +
                 `${chalk.bold('☁️ Cloud Models:')}\n` +
                 `• ${chalk.blue('OpenAI:')} GPT-4, GPT-4 Turbo, GPT-3.5 Turbo\n` +
                 `• ${chalk.blue('Anthropic:')} Claude-3 Opus, Sonnet, Haiku\n` +
                 `• ${chalk.blue('Google:')} Gemini Pro, Gemini Ultra\n` +
                 `• ${chalk.blue('Groq:')} Llama-3.1, Mixtral (ultra-fast inference)\n` +
                 `• ${chalk.blue('xAI:')} Grok with real-time web data\n\n` +
                 `${chalk.bold('🏠 Local Models:')}\n` +
                 `• ${chalk.blue('LM Studio:')} Run models locally with privacy\n` +
                 `• ${chalk.blue('Ollama:')} Easy local model management\n` +
                 `• ${chalk.blue('vLLM:')} High-performance local inference\n\n` +
                 `${chalk.bold('Model Selection:')}\n` +
                 `• ${chalk.blue('Speed:')} Groq > GPT-3.5 > Local > GPT-4 > Claude\n` +
                 `• ${chalk.blue('Quality:')} GPT-4/Claude > Gemini > Local > GPT-3.5\n` +
                 `• ${chalk.blue('Privacy:')} Local > Cloud (encrypted)\n` +
                 `• ${chalk.blue('Cost:')} Local (free) > GPT-3.5 > Groq > Others\n\n` +
                 `${chalk.bold('Switching Models:')}\n` +
                 `Use ${chalk.code('/model')} to see available models and switch between them.\n` +
                 `MARIA automatically selects the best model based on your task.`,
        examples: [
          '/model',
          '/model list',
          '/model gpt-4',
          '/config set default-model claude-3-opus'
        ],
        seeAlso: ['configuration', 'performance'],
        keywords: ['ai', 'provider', 'gpt', 'claude', 'gemini', 'local']
      },
      
      {
        name: 'configuration',
        title: 'Configuration Guide',
        description: 'How to configure and customize MARIA',
        category: 'configuration',
        content: `MARIA can be extensively customized to match your workflow:\n\n` +
                 `${chalk.bold('🏠 Configuration Files:')}\n` +
                 `• ${chalk.blue('~/.maria/config.json')} - Global settings\n` +
                 `• ${chalk.blue('.maria-code.toml')} - Project-specific config\n` +
                 `• ${chalk.blue('MARIA.md')} - AI development guidance\n\n` +
                 `${chalk.bold('⚙️ Key Settings:')}\n` +
                 `• ${chalk.blue('Default Model:')} Your preferred AI model\n` +
                 `• ${chalk.blue('Auto-save:')} Automatically save generated code\n` +
                 `• ${chalk.blue('Git Integration:')} Auto-commit, hooks, etc.\n` +
                 `• ${chalk.blue('Code Style:')} Formatting preferences\n` +
                 `• ${chalk.blue('API Keys:')} Secure credential storage\n\n` +
                 `${chalk.bold('🎨 Customization Options:')}\n` +
                 `• Custom prompts and templates\n` +
                 `• Workflow automation with hooks\n` +
                 `• Terminal themes and layouts\n` +
                 `• Vim mode keybindings\n` +
                 `• Project-specific AI behavior\n\n` +
                 `${chalk.bold('💡 Best Practices:')}\n` +
                 `• Use project configs for team consistency\n` +
                 `• Set up API keys in environment variables\n` +
                 `• Configure git hooks for quality checks\n` +
                 `• Customize prompts for domain-specific tasks`,
        examples: [
          '/config',
          '/config set default-model gpt-4',
          '/hooks add pre-commit "pnpm lint"',
          '/terminal-setup profile maria'
        ],
        seeAlso: ['getting-started', 'models', 'hooks'],
        keywords: ['settings', 'customize', 'preferences']
      },
      
      {
        name: 'troubleshooting',
        title: 'Troubleshooting Guide',
        description: 'Common issues and solutions',
        category: 'support',
        content: `${chalk.bold('🔧 Common Issues and Solutions:')}\n\n` +
                 `${chalk.bold('Installation Problems:')}\n` +
                 `• ${chalk.blue('Command not found:')} Run ${chalk.code('npm install -g @bonginkan/maria')}\n` +
                 `• ${chalk.blue('Permission errors:')} Use ${chalk.code('sudo')} or fix npm permissions\n` +
                 `• ${chalk.blue('Version conflicts:')} Use ${chalk.code('/migrate-installer cleanup')}\n\n` +
                 `${chalk.bold('API and Model Issues:')}\n` +
                 `• ${chalk.blue('API key errors:')} Check ${chalk.code('.env')} file and key validity\n` +
                 `• ${chalk.blue('Rate limits:')} Switch models or wait before retrying\n` +
                 `• ${chalk.blue('Connection timeout:')} Check internet and firewall\n\n` +
                 `${chalk.bold('Performance Issues:')}\n` +
                 `• ${chalk.blue('Slow responses:')} Use faster models like Groq or GPT-3.5\n` +
                 `• ${chalk.blue('High memory usage:')} Restart MARIA or clear context\n` +
                 `• ${chalk.blue('Long startup:')} Check for hung processes\n\n` +
                 `${chalk.bold('🏥 Diagnostic Tools:')}\n` +
                 `• ${chalk.code('/doctor')} - Comprehensive health check\n` +
                 `• ${chalk.code('/status')} - System status and diagnostics\n` +
                 `• ${chalk.code('/version')} - Version and build information\n` +
                 `• ${chalk.code('/config')} - Configuration validation\n\n` +
                 `${chalk.bold('🆘 Getting Help:')}\n` +
                 `• Check GitHub Issues: github.com/bonginkan/maria\n` +
                 `• Join Discord: discord.gg/maria-code\n` +
                 `• Email support: support@bonginkan.ai`,
        examples: [
          '/doctor',
          '/doctor --verbose --fix',
          '/status --verbose',
          '/migrate-installer detect'
        ],
        seeAlso: ['getting-started', 'configuration'],
        keywords: ['fix', 'error', 'problem', 'issue', 'debug']
      }
    ];
  }

  private getAllCommands() {
    return [
      // Core commands
      { name: 'code', description: 'Generate code with AI assistance', category: 'development', usage: '/code "task description"', examples: ['/code "create a REST API"', '/code "add error handling"'] },
      { name: 'test', description: 'Generate and run tests', category: 'development', usage: '/test [file]', examples: ['/test', '/test src/auth.ts'] },
      { name: 'review', description: 'Review code for issues and improvements', category: 'development', usage: '/review [file|pr]', examples: ['/review', '/review --pr=123'] },
      { name: 'bug', description: 'Detect and fix bugs', category: 'development', usage: '/bug [file]', examples: ['/bug', '/bug src/utils.ts'] },
      
      // Project management
      { name: 'init', description: 'Initialize project with AI guidance', category: 'project', usage: '/init [type]', examples: ['/init', '/init react'] },
      { name: 'commit', description: 'Generate commit messages', category: 'project', usage: '/commit', examples: ['/commit'] },
      { name: 'deploy', description: 'Deploy application with guidance', category: 'project', usage: '/deploy [platform]', examples: ['/deploy vercel'] },
      { name: 'memory', description: 'Manage project memory and context', category: 'project', usage: '/memory [view|edit|clear]', examples: ['/memory view'] },
      
      // Media
      { name: 'image', description: 'Generate images with AI', category: 'media', usage: '/image "description"', examples: ['/image "sunset over mountains"'] },
      { name: 'video', description: 'Create videos with AI', category: 'media', usage: '/video "description"', examples: ['/video "product demo"'] },
      
      // Configuration
      { name: 'config', description: 'Manage configuration settings', category: 'configuration', usage: '/config [get|set|list]', examples: ['/config list'] },
      { name: 'settings', description: 'Advanced settings management', category: 'configuration', usage: '/settings [view|edit|reset]', examples: ['/settings view'] },
      { name: 'setup', description: 'Initial setup and configuration wizard', category: 'configuration', usage: '/setup [quick|advanced|reset]', examples: ['/setup quick'] },
      { name: 'model', description: 'Switch AI models', category: 'configuration', usage: '/model [list|<model-name>]', examples: ['/model gpt-4'] },
      { name: 'permissions', description: 'Manage permissions', category: 'configuration', usage: '/permissions [list|grant|revoke]', examples: ['/permissions list'] },
      
      // System
      { name: 'status', description: 'Show system status', category: 'system', usage: '/status', examples: ['/status'] },
      { name: 'doctor', description: 'Run health diagnostics', category: 'system', usage: '/doctor [category]', examples: ['/doctor --verbose'] },
      { name: 'version', description: 'Show version information', category: 'system', usage: '/version', examples: ['/version'] },
      
      // Interface
      { name: 'vim', description: 'Toggle Vim mode', category: 'interface', usage: '/vim [on|off|status]', examples: ['/vim on'] },
      { name: 'clear', description: 'Clear conversation context', category: 'interface', usage: '/clear', examples: ['/clear'] },
      { name: 'exit', description: 'Exit MARIA', category: 'interface', usage: '/exit', examples: ['/exit'] },
    ];
  }

  private groupTopicsByCategory(topics: HelpTopic[]): Record<string, HelpTopic[]> {
    return topics.reduce((groups, topic) => {
      const category = topic.category;
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(topic);
      return groups;
    }, {} as Record<string, HelpTopic[]>);
  }

  private getSpecificCommandHelp(commandName: string): string | null {
    const specificHelp: Record<string, string> = {
      'code': `${chalk.bold('Code Generation Tips:')}\n` +
              `• Be specific about requirements and constraints\n` +
              `• Mention the programming language and framework\n` +
              `• Include examples of desired input/output\n` +
              `• Specify coding style preferences\n\n` +
              `${chalk.bold('Advanced Usage:')}\n` +
              `• Use --file to include context from existing files\n` +
              `• Use --template to apply project templates\n` +
              `• Use --review to include code review feedback\n`,
      
      'model': `${chalk.bold('Available Providers:')}\n` +
               `• ${chalk.blue('openai')}: GPT-4, GPT-4 Turbo, GPT-3.5\n` +
               `• ${chalk.blue('anthropic')}: Claude-3 Opus, Sonnet, Haiku\n` +
               `• ${chalk.blue('google')}: Gemini Pro, Gemini Ultra\n` +
               `• ${chalk.blue('groq')}: Ultra-fast Llama and Mixtral models\n` +
               `• ${chalk.blue('lmstudio')}: Local models via LM Studio\n` +
               `• ${chalk.blue('ollama')}: Local models via Ollama\n\n` +
               `${chalk.bold('Model Selection Tips:')}\n` +
               `• Use GPT-4 or Claude for complex reasoning\n` +
               `• Use Groq for speed-critical tasks\n` +
               `• Use local models for privacy-sensitive work\n`,
      
      'init': `${chalk.bold('Project Types:')}\n` +
              `• ${chalk.blue('react')}: React application with TypeScript\n` +
              `• ${chalk.blue('node')}: Node.js backend with Express\n` +
              `• ${chalk.blue('python')}: Python project with best practices\n` +
              `• ${chalk.blue('nextjs')}: Full-stack Next.js application\n` +
              `• ${chalk.blue('cli')}: Command-line tool with TypeScript\n\n` +
              `${chalk.bold('What /init Creates:')}\n` +
              `• Project structure and configuration files\n` +
              `• MARIA.md development guidance document\n` +
              `• .maria-code.toml project configuration\n` +
              `• CI/CD pipeline and development scripts\n`,
      
      'settings': `${chalk.bold('Settings Categories:')}\n` +
                  `• ${chalk.blue('General')}: Basic preferences and defaults\n` +
                  `• ${chalk.blue('AI Models')}: Model selection and parameters\n` +
                  `• ${chalk.blue('Interface')}: UI themes and layout options\n` +
                  `• ${chalk.blue('Development')}: Coding style and tools\n` +
                  `• ${chalk.blue('Security')}: API keys and access control\n` +
                  `• ${chalk.blue('Performance')}: Cache and optimization settings\n\n` +
                  `${chalk.bold('Advanced Features:')}\n` +
                  `• Import/export configuration profiles\n` +
                  `• Environment-specific settings\n` +
                  `• Team collaboration preferences\n` +
                  `• Custom prompt templates\n` +
                  `• Workflow automation rules\n\n` +
                  `${chalk.bold('Common Operations:')}\n` +
                  `• ${chalk.blue('/settings view')}: Show current configuration\n` +
                  `• ${chalk.blue('/settings edit <category>')}: Modify settings\n` +
                  `• ${chalk.blue('/settings reset')}: Restore defaults\n`,
      
      'setup': `${chalk.bold('Setup Modes:')}\n` +
               `• ${chalk.blue('Quick Setup')}: Essential configuration in 2 minutes\n` +
               `• ${chalk.blue('Advanced Setup')}: Complete customization wizard\n` +
               `• ${chalk.blue('Team Setup')}: Multi-user environment configuration\n` +
               `• ${chalk.blue('Migration Setup')}: Import from other tools\n\n` +
               `${chalk.bold('Quick Setup Includes:')}\n` +
               `• API key configuration (OpenAI, Anthropic, etc.)\n` +
               `• Default AI model selection\n` +
               `• Basic preferences (theme, language, etc.)\n` +
               `• Development environment detection\n` +
               `• Git integration setup\n\n` +
               `${chalk.bold('Advanced Setup Adds:')}\n` +
               `• Custom prompt engineering\n` +
               `• Workflow automation configuration\n` +
               `• Security and permission settings\n` +
               `• Performance optimization\n` +
               `• Third-party tool integrations\n\n` +
               `${chalk.bold('Usage Tips:')}\n` +
               `• Run setup wizard after first installation\n` +
               `• Use quick setup for getting started fast\n` +
               `• Re-run setup when switching projects\n`,
    };
    
    return specificHelp[commandName] || null;
  }
}