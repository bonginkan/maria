/**
 * /enhanced-help command - Advanced help with interactive features
 * Functional implementation using Guard templates
 */

import { createFunctionalCommand } from '../../../lib/guard-templates.js';
import type { CommandContext, CommandResult } from '../../shared/secure-pipe.js';

async function enhancedHelpExecutor(
  args: string[], 
  context: CommandContext
): Promise<CommandResult> {
  try {
    const category = args[0];
    const showAll = args.includes('--all') || args.includes('-a');
    const interactive = args.includes('--interactive') || args.includes('-i');
    
    if (interactive) {
      return {
        success: true,
        output: `🚀 Interactive Help Mode

Welcome to Maria CLI Enhanced Help!

📚 What would you like help with?
  1️⃣  Getting Started (setup, first commands)
  2️⃣  Core Commands (help, version, status)
  3️⃣  System Tools (doctor, performance, debug)
  4️⃣  AI Features (code generation, analysis)
  5️⃣  Business Tools (dashboards, reports)
  6️⃣  Configuration (setup, preferences)
  7️⃣  Troubleshooting (common issues)
  
💡 Select a number or type a specific topic
📖 Use /help <category> for detailed category help
🔍 Use /help --search <term> to search commands`,
        requiresInput: true,
        endReason: 'success'
      };
    }
    
    if (category) {
      return getCategoryHelp(category, showAll);
    }
    
    return {
      success: true,
      output: `🎯 Enhanced Help - Maria CLI v3.8.0

📊 Command Status: 50+ READY commands available
🎨 Interactive Mode: /enhanced-help --interactive

🔥 Quick Start:
  /status          - Check system health
  /doctor          - Diagnose issues  
  /code <request>  - Natural language coding
  /upgrade         - Upgrade your plan
  
📋 Categories (use /enhanced-help <category>):
  • core          - Essential CLI operations (15 commands)
  • system        - Monitoring & diagnostics (12 commands)
  • auth          - Authentication & plans (4 commands) 
  • memory        - Knowledge management (4 commands)
  • code          - AI code operations (3 commands)
  • business      - Analytics & dashboards (2 commands)
  • config        - Settings & preferences (5 commands)
  
🎯 Smart Features:
  • Natural language command routing
  • Context-aware suggestions
  • Predictive help recommendations
  • Error recovery assistance
  
💡 Pro Tips:
  • Use TAB for command completion
  • Type partial commands for suggestions  
  • Commands adapt to your usage patterns
  • All READY commands are production-tested
  
🔗 Resources:
  📖 Full docs: /docs
  💬 Community: https://discord.gg/SMSmSGcEQy
  🐛 Issues: /feedback`,
      requiresInput: false,
      endReason: 'success'
    };
  } catch (error) {
    return {
      success: false,
      error: `❌ Enhanced help failed: ${error.message}`,
      requiresInput: false,
      endReason: 'error'
    };
  }
}

function getCategoryHelp(category: string, showAll: boolean): CommandResult {
  const categoryInfo = {
    core: {
      description: 'Essential CLI operations and information',
      commands: [
        'help - Show command help',
        'version - CLI version info',
        'status - System health check',
        'about - About Maria CLI',
        'docs - Open documentation',
        'examples - Command examples',
        'shortcuts - Keyboard shortcuts',
        'tutorial - Interactive tutorial',
        'feedback - Send feedback',
        'quit - Exit CLI'
      ]
    },
    system: {
      description: 'System monitoring, diagnostics, and administration',
      commands: [
        'doctor - Diagnose and fix issues',
        'performance - Performance monitoring',
        'debug - Debug information',
        'processes - Running processes',
        'network - Network diagnostics',
        'disk - Disk usage info',
        'env - Environment variables',
        'ping - Connectivity test'
      ]
    },
    auth: {
      description: 'Authentication and subscription management',
      commands: [
        'login - Sign into your account',
        'logout - Sign out',
        'plan - Show subscription plan',
        'usage - API usage statistics'
      ]
    },
    code: {
      description: 'AI-powered code generation and analysis',
      commands: [
        'code - Natural language coding',
        'analyze - Code analysis',
        'generate - Code generation'
      ]
    }
  };
  
  const info = categoryInfo[category as keyof typeof categoryInfo];
  
  if (!info) {
    return {
      success: false,
      error: `❌ Unknown category: ${category}`,
      output: `Available categories: ${Object.keys(categoryInfo).join(', ')}`,
      requiresInput: false,
      endReason: 'error'
    };
  }
  
  return {
    success: true,
    output: `📚 ${category.toUpperCase()} Commands

${info.description}

${info.commands.map(cmd => `  /${cmd}`).join('\n')}

💡 Use /<command> --help for detailed command help
🔍 Use /enhanced-help --interactive for guided assistance`,
    requiresInput: false,
    endReason: 'success'
  };
}

export const enhancedHelpCommand = createFunctionalCommand(
  'enhanced-help',
  'core',
  'Advanced help system with interactive features',
  enhancedHelpExecutor
);

// Export metadata and execute for command registry
export const metadata = {
  name: 'enhanced-help',
  description: 'Advanced help system with interactive features',
  category: 'core',
  version: '1.0.0',
  type: 'functional' as const,
  planRequired: 'free' as const,
  isPreview: false
};

export async function execute(context: any): Promise<any> {
  return await enhancedHelpExecutor(context.args || [], context);
}

export default enhancedHelpCommand;