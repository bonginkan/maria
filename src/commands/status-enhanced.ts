/**
 * MARIA CODE CLI - Enhanced Status Command
 *
 * Example implementation using the new unified design system
 * and architecture components.
 */

import { BaseCommand } from '../ui/base-command';
import { ProgressIndicator } from '../ui/progress-indicator';
import { MariaConfig, readConfig } from '../utils/config';
import type { CommandCategory } from '../lib/command-groups';
import * as os from 'os';

// Local type definitions for missing UI system types
interface CommandContext {
  args: string[];
  userId?: string;
  projectPath?: string;
  projectType?: string;
  options: Record<string, unknown>;
  recentCommands: string[];
}

interface ExtendedConfig extends MariaConfig {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

interface CommandResult {
  success: boolean;
  message: string;
  data?: unknown;
  category?: string;
  severity?: string;
  visualElements?: unknown[];
  actions?: unknown[];
  relatedCommands?: string[];
}

interface CommandExample {
  description: string;
  command: string;
  output?: string;
}

// Unused but kept for future use
// const CommandCategory = {
//   User: 'user' as const,
//   System: 'system' as const,
//   Debug: 'debug' as const
// };

// type Severity = 'info' | 'warning' | 'error' | 'success';

interface ArgumentSchema {
  name?: string;
  type?: string;
  required?: boolean;
  arguments?: Array<{
    name: string;
    type: string;
    enum?: string[];
    default?: unknown;
    description?: string;
    required?: boolean;
  }>;
  allowExtraArgs?: boolean;
}

interface TreeNode {
  label: string;
  children?: TreeNode[];
  value?: string;
  expanded?: boolean;
}

const showSteps = (title: string, steps: string[]): ProgressIndicator => {
  console.log(title);
  steps.forEach((step) => console.log(`• ${step}`));

  // Return a mock ProgressIndicator that satisfies the interface
  return new ProgressIndicator({ message: title, total: steps.length });
};

// Status data structure
interface SystemStatus {
  user: {
    isAuthenticated: boolean;
    userId?: string;
    plan: 'free' | 'pro' | 'max';
    credits: number;
    loginTime?: Date;
  };
  system: {
    version: string;
    mode: string;
    apiUrl: string;
    sandboxStatus: 'ready' | 'starting' | 'stopped' | 'error';
    uptime: number;
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
  };
  project?: {
    path: string;
    type: 'node' | 'python' | 'rust' | 'go' | 'unknown';
    initialized: boolean;
    files: number;
    lastScan?: Date;
  };
  ai: {
    model: string;
    temperature: number;
    maxTokens: number;
    provider: 'gemini' | 'grok' | 'openai';
    apiKeySet: boolean;
  };
  session: {
    startTime: Date;
    messagesCount: number;
    tokensUsed: number;
    estimatedCost: number;
  };
}

/**
 * Enhanced status command with rich display
 */
export class StatusEnhancedCommand extends BaseCommand {
  name = '/status';
  category = 'core' as CommandCategory;
  description = 'Display comprehensive system status and session information';
  aliases = ['/s', '/info'];

  protected getSchema(): ArgumentSchema {
    return {
      arguments: [
        {
          name: 'format',
          type: 'enum',
          enum: ['full', 'compact', 'json', 'tree'],
          default: 'full',
          description: 'Output format for status display',
        },
        {
          name: 'section',
          type: 'enum',
          enum: ['all', 'user', 'system', 'project', 'ai', 'session'],
          default: 'all',
          description: 'Specific section to display',
        },
        {
          name: 'refresh',
          type: 'boolean',
          default: false,
          description: 'Auto-refresh status every 5 seconds',
        },
      ],
      allowExtraArgs: false,
    };
  }

  protected getExamples(): CommandExample[] {
    return [
      {
        command: '/status',
        description: 'Show full system status',
        output: 'Displays all status sections with detailed information',
      },
      {
        command: '/status --format compact',
        description: 'Show compact status summary',
        output: 'Displays condensed status information',
      },
      {
        command: '/status --section ai',
        description: 'Show only AI configuration status',
        output: 'Displays AI model settings and configuration',
      },
      {
        command: '/status --format json',
        description: 'Output status as JSON',
        output: 'Returns raw JSON data for programmatic use',
      },
    ];
  }

  protected getRelatedCommands(): string[] {
    return ['/login', '/config', '/doctor', '/cost', '/mode'];
  }

  protected getTips(): string[] {
    return [
      'Use /s as a shortcut for /status',
      'The --refresh flag will update the display every 5 seconds',
      'JSON format is useful for scripting and automation',
      'Run /doctor if you see any errors in the status',
    ];
  }

  protected async validateArgs(
    _args: string[],
  ): Promise<{ valid: boolean; parsed?: { format: string; section: string; refresh: boolean } }> {
    // Simple validation - just return defaults for this example
    return {
      valid: true,
      parsed: {
        format: 'full',
        section: 'all',
        refresh: false,
      },
    };
  }

  async execute(args: string[], context: CommandContext): Promise<CommandResult> {
    const parsedArgs = await this.validateArgs(args);
    if (!parsedArgs.valid || !parsedArgs.parsed) {
      throw new Error('Invalid arguments');
    }

    const { format, section, refresh } = parsedArgs.parsed;

    // Show progress for data collection
    const progress = showSteps('Collecting system status...', [
      'User authentication',
      'System information',
      'Project analysis',
      'AI configuration',
      'Session metrics',
    ]);

    try {
      // Collect status data
      const status = await this.collectStatus(context, progress);

      // Filter by section if requested
      const filteredStatus =
        section === 'all' ? status : { [section]: status[section as keyof SystemStatus] };

      // Format based on requested format
      let formattedOutput: unknown;
      switch (format) {
        case 'compact':
          formattedOutput = this.formatCompact(filteredStatus as SystemStatus);
          break;
        case 'json':
          formattedOutput = filteredStatus;
          break;
        case 'tree':
          formattedOutput = this.formatTree(filteredStatus as SystemStatus);
          break;
        default:
          formattedOutput = this.formatFull(filteredStatus as SystemStatus);
      }

      progress.stop('✅ Status collected successfully');

      // Handle refresh mode
      if (refresh && format !== 'json') {
        this.startAutoRefresh();
      }

      return {
        success: true,
        message: 'System status',
        data: formattedOutput,
        category: 'user',
        severity: 'info',
        visualElements: this.createVisualElements(status),
        actions: this.getRecommendedActions(status),
        relatedCommands: this.getRelatedCommands(),
      };
    } catch (error: unknown) {
      progress.stop('❌ Failed to collect status');
      throw error;
    }
  }

  private async collectStatus(
    context: CommandContext,
    progress: ProgressIndicator,
  ): Promise<SystemStatus> {
    const config = await readConfig();

    // Step 1: User authentication
    progress.addStep({
      name: 'User authentication',
      status: 'running',
    });

    const userStatus = await this.getUserStatus(context);

    progress.addStep({
      name: 'User authentication',
      status: 'completed',
    });

    // Step 2: System information
    progress.addStep({
      name: 'System information',
      status: 'running',
    });

    const systemStatus = await this.getSystemStatus(config);

    progress.addStep({
      name: 'System information',
      status: 'completed',
    });

    // Step 3: Project analysis
    progress.addStep({
      name: 'Project analysis',
      status: 'running',
    });

    const projectStatus = await this.getProjectStatus(context);

    progress.addStep({
      name: 'Project analysis',
      status: projectStatus ? 'completed' : 'failed',
    });

    // Step 4: AI configuration
    progress.addStep({
      name: 'AI configuration',
      status: 'running',
    });

    const aiStatus = await this.getAIStatus(config);

    progress.addStep({
      name: 'AI configuration',
      status: 'completed',
    });

    // Step 5: Session metrics
    progress.addStep({
      name: 'Session metrics',
      status: 'running',
    });

    const sessionStatus = await this.getSessionStatus(context);

    progress.addStep({
      name: 'Session metrics',
      status: 'completed',
    });

    return {
      user: userStatus,
      system: systemStatus,
      project: projectStatus,
      ai: aiStatus,
      session: sessionStatus,
    };
  }

  private async getUserStatus(context: CommandContext): Promise<SystemStatus['user']> {
    // Simulate fetching user status
    return {
      isAuthenticated: !!context.userId,
      userId: context.userId,
      plan: 'pro',
      credits: 1000,
      loginTime: new Date(Date.now() - 3600000), // 1 hour ago
    };
  }

  private async getSystemStatus(config: ExtendedConfig): Promise<SystemStatus['system']> {
    const memoryUsage = process.memoryUsage();
    const totalMemory = os.totalmem();

    return {
      version: '2.5.3',
      mode: config.defaultMode || 'chat',
      apiUrl: config.apiUrl || 'http://localhost:8080',
      sandboxStatus: 'ready',
      uptime: process.uptime(),
      memory: {
        used: memoryUsage.heapUsed,
        total: totalMemory,
        percentage: (memoryUsage.heapUsed / totalMemory) * 100,
      },
    };
  }

  private async getProjectStatus(
    context: CommandContext,
  ): Promise<SystemStatus['project'] | undefined> {
    if (!context.projectPath) {return undefined;}

    return {
      path: context.projectPath,
      type: (context.projectType as 'node' | 'python' | 'rust' | 'go' | 'unknown') || 'unknown',
      initialized: true,
      files: 156, // Mock data
      lastScan: new Date(Date.now() - 300000), // 5 minutes ago
    };
  }

  private async getAIStatus(config: ExtendedConfig): Promise<SystemStatus['ai']> {
    return {
      model: config.model || 'gemini-2.5-pro',
      temperature: config.temperature || 0.7,
      maxTokens: config.maxTokens || 4096,
      provider: 'gemini',
      apiKeySet: !!process.env['GEMINI_API_KEY'],
    };
  }

  private async getSessionStatus(context: CommandContext): Promise<SystemStatus['session']> {
    return {
      startTime: new Date(Date.now() - 7200000), // 2 hours ago
      messagesCount: context.recentCommands.length * 2, // Approximate
      tokensUsed: 15420,
      estimatedCost: 0.0308,
    };
  }

  private formatFull(status: SystemStatus): unknown {
    // Use ResponseFormatter for rich display
    const tables: unknown[] = [];

    // User section
    if (status.user) {
      tables.push({
        title: 'User Information',
        data: [
          { Property: 'Authenticated', Value: status.user.isAuthenticated ? 'Yes' : 'No' },
          { Property: 'User ID', Value: status.user.userId || 'Not logged in' },
          { Property: 'Plan', Value: status.user.plan.toUpperCase() },
          { Property: 'Credits', Value: status.user.credits },
          {
            Property: 'Login Time',
            Value: status.user.loginTime ? this.formatTime(status.user.loginTime) : 'N/A',
          },
        ],
      });
    }

    // System section
    if (status.system) {
      tables.push({
        title: 'System Information',
        data: [
          { Property: 'Version', Value: status.system.version },
          { Property: 'Mode', Value: status.system.mode },
          { Property: 'API URL', Value: status.system.apiUrl },
          { Property: 'Sandbox', Value: status.system.sandboxStatus },
          { Property: 'Uptime', Value: this.formatDuration(status.system.uptime * 1000) },
          {
            Property: 'Memory',
            Value: `${Math.round(status.system.memory.used / 1024 / 1024)}MB / ${Math.round(status.system.memory.total / 1024 / 1024)}MB (${status.system.memory.percentage.toFixed(1)}%)`,
          },
        ],
      });
    }

    // Add other sections...

    return { tables, format: 'full' };
  }

  private formatCompact(status: SystemStatus): string {
    const parts: string[] = [];

    if (status.user) {
      parts.push(
        `👤 ${status.user.isAuthenticated ? status.user.userId : 'Not logged in'} (${status.user.plan})`,
      );
    }

    if (status.system) {
      parts.push(
        `⚙️  v${status.system.version} | ${status.system.mode} mode | ${status.system.sandboxStatus}`,
      );
    }

    if (status.project) {
      parts.push(`📁 ${status.project.type} project | ${status.project.files} files`);
    }

    if (status.ai) {
      parts.push(`🤖 ${status.ai.model} | ${status.ai.provider}`);
    }

    if (status.session) {
      parts.push(
        `💬 ${status.session.messagesCount} messages | $${status.session.estimatedCost.toFixed(4)}`,
      );
    }

    return parts.join('\n');
  }

  private formatTree(status: SystemStatus): TreeNode {
    const root: TreeNode = {
      label: 'MARIA System Status',
      expanded: true,
      children: [],
    };

    // Add sections as tree nodes
    Object.entries(status as unknown as Record<string, unknown>).forEach(([key, value]) => {
      if (value && typeof value === 'object') {
        const node: TreeNode = {
          label: key.charAt(0).toUpperCase() + key.slice(1),
          expanded: true,
          children: this.objectToTreeNodes(value as Record<string, unknown>),
        };
        root.children!.push(node);
      }
    });

    return root;
  }

  private objectToTreeNodes(obj: Record<string, unknown>): TreeNode[] {
    return Object.entries(obj).map(([key, value]) => {
      if (typeof value === 'object' && value !== null && !(value instanceof Date)) {
        return {
          label: key,
          children: this.objectToTreeNodes(value as Record<string, unknown>),
          expanded: false,
        };
      }

      return {
        label: `${key}: ${this.formatValue(value)}`,
      };
    });
  }

  private formatValue(value: unknown): string {
    if (value instanceof Date) {
      return this.formatTime(value);
    }
    if (typeof value === 'number') {
      return value.toLocaleString();
    }
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    return String(value);
  }

  private createVisualElements(status: SystemStatus): unknown[] {
    const elements: unknown[] = [];

    // Memory usage progress bar
    if (status.system) {
      elements.push({
        type: 'progress',
        data: {
          label: 'Memory Usage',
          current: status.system.memory.used,
          total: status.system.memory.total,
          percentage: status.system.memory.percentage,
        },
      });
    }

    // Session cost chart
    if (status.session) {
      elements.push({
        type: 'chart',
        data: {
          type: 'bar',
          label: 'Session Cost',
          value: status.session.estimatedCost,
          max: 1.0, // $1 max
        },
      });
    }

    return elements;
  }

  private getRecommendedActions(status: SystemStatus): unknown[] {
    const actions: unknown[] = [];

    // Check authentication
    if (!status.user.isAuthenticated) {
      actions.push({
        command: '/login',
        description: 'Login to access all features',
        priority: 'high',
      });
    }

    // Check credits
    if (status.user.credits < 100) {
      actions.push({
        command: '/upgrade',
        description: 'Upgrade plan for more credits',
        priority: 'medium',
      });
    }

    // Check API key
    if (!status.ai.apiKeySet) {
      actions.push({
        command: '/config',
        description: 'Configure API keys for AI models',
        priority: 'high',
      });
    }

    // Check project
    if (!status.project) {
      actions.push({
        command: '/init',
        description: 'Initialize a project in current directory',
        priority: 'medium',
      });
    }

    return actions;
  }

  private startAutoRefresh(): void {
    // In a real implementation, this would set up a refresh interval
    console.log('Auto-refresh enabled. Press Ctrl+C to stop.');
  }

  private formatTime(date: Date): string {
    return date.toLocaleString();
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  }
}
