/**
 * /help command - Enhanced with Ready/Preview/Unavailable grouping
 * Honest UX that shows functional vs preview features
 */

import { withPublicPipe, type CommandContext, type CommandResult } from '../../shared/secure-pipe.js';

interface CommandInfo {
  name: string;
  description: string;
  category: string;
  status: 'READY' | 'PARTIAL' | 'BROKEN';
  type?: 'functional' | 'stub';
  isPreview?: boolean;
  planRequired?: 'free' | 'starter' | 'pro' | 'ultra';
}

class HelpCommandImpl {
  public readonly metadata = {
    name: 'help',
    description: 'Show available commands grouped by status',
    category: 'core',
    aliases: ['h', '?'],
    version: '3.0.0',
    type: 'functional' as const,
    planRequired: 'free' as const,
    isPreview: false,
    owner: 'core@maria',
    slo: { p95Ms: 200 },
    telemetry: true
  };

  async execute(args: string[], context: CommandContext): Promise<CommandResult> {
    const showAll = args.includes('--all');
    const quickstart = args.includes('--quickstart');
    const category = this.extractCategory(args);
    
    if (quickstart) {
      return this.showQuickstart(context);
    }
    
    const commands = this.loadCommands();
    
    if (category) {
      return this.showCategory(commands, category, context);
    }
    
    return this.showGroupedCommands(commands, showAll, context);
  }

  private extractCategory(args: string[]): string | null {
    for (const arg of args) {
      if (['core', 'system', 'business', 'multimodal', 'code'].includes(arg)) {
        return arg;
      }
    }
    return null;
  }

  private loadCommands(): CommandInfo[] {
    // In production, this would load from actual manifest
    return [
      // Core Commands (Functional)
      { name: 'help', description: 'Show this help', category: 'core', status: 'READY', type: 'functional' },
      { name: 'login', description: 'Authenticate with Maria', category: 'core', status: 'READY', type: 'functional' },
      { name: 'logout', description: 'Sign out', category: 'core', status: 'READY', type: 'functional' },
      { name: 'usage', description: 'Check quota and usage', category: 'core', status: 'READY', type: 'functional' },
      { name: 'plan', description: 'Show current plan', category: 'core', status: 'READY', type: 'functional' },
      
      // System Commands (Functional)  
      { name: 'status', description: 'System health checks', category: 'system', status: 'READY', type: 'functional' },
      { name: 'doctor', description: 'Run diagnostics', category: 'system', status: 'READY', type: 'functional' },
      
      // Code Commands (Functional)
      { name: 'code', description: 'AI coding assistant', category: 'code', status: 'READY', type: 'functional' },
      
      // Business Commands (Mixed)
      { name: 'sales-dashboard', description: 'Sales metrics dashboard', category: 'business', status: 'READY', type: 'functional', planRequired: 'starter' },
      { name: 'battlecard', description: 'Competitive analysis', category: 'business', status: 'READY', type: 'stub', isPreview: true, planRequired: 'pro' },
      
      // Multimodal Commands (Previews)
      { name: 'image', description: 'Generate images', category: 'multimodal', status: 'READY', type: 'stub', isPreview: true, planRequired: 'pro' },
      { name: 'video', description: 'Generate videos', category: 'multimodal', status: 'READY', type: 'stub', isPreview: true, planRequired: 'pro' },
      { name: 'voice', description: 'Text-to-speech', category: 'multimodal', status: 'READY', type: 'stub', isPreview: true, planRequired: 'pro' },
      
      // Unavailable Commands
      { name: 'broken-cmd', description: 'Broken command', category: 'system', status: 'BROKEN' },
    ];
  }

  private showQuickstart(context: CommandContext): CommandResult {
    const isAuthenticated = !!context.user?.id;
    
    let output = '';
    
    if (!isAuthenticated) {
      output = `🚀 Quick Start Guide
═══════════════════════════════════════

Welcome to MARIA! Get started in 3 steps:

1️⃣ Authenticate
   /login

2️⃣ Check your status  
   /status

3️⃣ Start coding
   /code "create a REST API"

💡 Need help? Type /help
📊 Check usage: /usage
🎯 See all commands: /help --all`;
    } else {
      const plan = context.user.plan || 'free';
      output = `🚀 Welcome back!
═══════════════════════════════════════

Plan: ${plan.toUpperCase()} • Quick Commands:

🔧 System:     /status, /doctor
💻 Code:       /code
📊 Business:   /sales-dashboard
🎨 Creative:   /image, /video, /voice (🧪 Preview)

💡 Tip: Use /help [category] for detailed help
📈 Check quota: /usage`;
    }
    
    return {
      success: true,
      output,
      requiresInput: false,
      endReason: 'success'
    };
  }

  private showCategory(commands: CommandInfo[], category: string, context: CommandContext): CommandResult {
    const categoryCommands = commands.filter(cmd => 
      cmd.category === category && cmd.status === 'READY'
    );

    if (categoryCommands.length === 0) {
      return {
        success: false,
        error: `No commands found in category: ${category}`,
        output: `Available categories: core, system, business, multimodal, code`,
        requiresInput: false,
        endReason: 'error'
      };
    }

    let output = `${category.toUpperCase()} Commands\n`;
    output += '═'.repeat(category.length + 9) + '\n\n';
    
    for (const cmd of categoryCommands) {
      const badges = this.getCommandBadges(cmd, context);
      output += `/${cmd.name.padEnd(20)} ${cmd.description}${badges}\n`;
    }
    
    return {
      success: true,
      output,
      requiresInput: false,
      endReason: 'success'
    };
  }

  private showGroupedCommands(commands: CommandInfo[], showAll: boolean, context: CommandContext): CommandResult {
    const isAuthenticated = !!context.user?.id;
    
    // Group commands
    const functional = commands.filter(cmd => 
      cmd.status === 'READY' && cmd.type === 'functional'
    );
    const preview = commands.filter(cmd => 
      cmd.status === 'READY' && (cmd.type === 'stub' || cmd.isPreview)
    );
    const unavailable = commands.filter(cmd => 
      cmd.status === 'BROKEN' || cmd.status === 'PARTIAL'
    );

    let output = '';
    
    // Pre-login banner
    if (!isAuthenticated) {
      output = `Type /login to get started • /help --quickstart\n\n`;
    } else {
      const plan = context.user.plan || 'free';
      const quotaInfo = context.quota ? 
        `${context.quota.remaining}/${context.quota.limit} req/mo` : 
        '-- req/mo';
      output = `Plan: ${plan.toUpperCase()} • ${quotaInfo} • Models: Gemini Flash Lite\n\n`;
    }
    
    output += 'MARIA Commands\n';
    output += '══════════════════════════════════════\n\n';
    
    // Ready (Functional) Commands
    output += '✅ Ready (Functional)\n';
    output += this.formatCommandGroup(functional, context, 'core');
    output += this.formatCommandGroup(functional, context, 'system');
    output += this.formatCommandGroup(functional, context, 'code');
    output += this.formatCommandGroup(functional, context, 'business');
    
    // Preview Commands
    if (preview.length > 0) {
      output += '\n🧪 Preview (Coming Soon)\n';
      output += this.formatCommandGroup(preview, context, 'multimodal');
      output += this.formatCommandGroup(preview, context, 'business');
    }
    
    // Unavailable (only with --all)
    if (showAll && unavailable.length > 0) {
      output += '\n❌ Unavailable\n';
      output += `  ${unavailable.length} commands hidden (use --all to see)\n`;
    }
    
    // Footer
    output += '\n──────────────────────────────────────\n';
    output += 'Usage: /help [category] • /help --quickstart • /help --all\n';
    
    return {
      success: true,
      output,
      requiresInput: false,
      endReason: 'success'
    };
  }

  private formatCommandGroup(commands: CommandInfo[], context: CommandContext, category: string): string {
    const categoryCommands = commands.filter(cmd => cmd.category === category);
    
    if (categoryCommands.length === 0) {
      return '';
    }
    
    let output = `  ${category.charAt(0).toUpperCase() + category.slice(1)}:`;
    const commandList = categoryCommands.map(cmd => {
      const badges = this.getCommandBadges(cmd, context);
      return `/${cmd.name}${badges}`;
    });
    
    output += `  ${commandList.join(', ')}\n`;
    return output;
  }

  private getCommandBadges(cmd: CommandInfo, context: CommandContext): string {
    const badges: string[] = [];
    
    // Preview badge
    if (cmd.isPreview || cmd.type === 'stub') {
      badges.push('🧪');
    }
    
    // Plan requirement badge (only if user doesn't have required plan)
    if (cmd.planRequired && cmd.planRequired !== 'free') {
      const userPlan = context.user?.plan || 'free';
      const planHierarchy = { 'free': 0, 'starter': 1, 'pro': 2, 'ultra': 3 };
      
      if (planHierarchy[userPlan] < planHierarchy[cmd.planRequired]) {
        badges.push(`[${cmd.planRequired.toUpperCase()}]`);
      }
    }
    
    return badges.length > 0 ? ` ${badges.join(' ')}` : '';
  }
}

// Export with public pipe (no auth required for help)
export const HelpCommand = withPublicPipe(new HelpCommandImpl());
export default HelpCommand;