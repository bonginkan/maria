/**
 * Setup Command Module
 * セットアップコマンド - 初期設定と設定ウィザード
 *
 * Phase 4: Configuration commands implementation
 * Category: Configuration
 */

import { SlashCommandResult } from '../../services/slash-command-handler';
import { BaseCommand } from './base-command';
import { _CommandArgs, _CommandContext } from './types';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';
import os from 'os';

const execAsync = promisify(exec);

export interface SetupProfile {
  name: string;
  description: string;
  steps: SetupStep[];
  estimatedTime: number;
  prerequisites?: string[];
}

export interface SetupStep {
  id: string;
  title: string;
  description: string;
  type: 'check' | 'configure' | 'install' | 'validate';
  required: boolean;
  commands?: string[];
  validation?: string;
  skipCondition?: string;
}

export interface SetupState {
  profile: string;
  currentStep: number;
  completedSteps: string[];
  skippedSteps: string[];
  configuration: Record<string, unknown>;
  startTime: string;
}

export class SetupCommand extends BaseCommand {
  name = 'setup';
  description = 'Initial setup and configuration wizard';
  usage = '/setup [quick|advanced|team|reset|status|resume] [options]';
  category = 'configuration';

  examples = [
    '/setup quick',
    '/setup advanced',
    '/setup team --members=5',
    '/setup status',
    '/setup reset --confirm',
  ];

  private setupStatePath = path.join(os.homedir(), '.maria', 'setup-state.json');
  private configPath = path.join(os.homedir(), '.maria', 'config.json');

  async execute(args: CommandArgs, context: CommandContext): Promise<SlashCommandResult> {
    try {
      const [mode = 'status', ...extraArgs] = args.args;

      await this.ensureDirectories();

      switch (mode.toLowerCase()) {
        case 'quick':
          return await this.startQuickSetup(args.flags);

        case 'advanced':
          return await this.startAdvancedSetup(args.flags);

        case 'team':
          return await this.startTeamSetup(args.flags);

        case 'migration':
        case 'migrate':
          return await this.startMigrationSetup(args.flags);

        case 'status':
          return await this.showSetupStatus();

        case 'resume':
          return await this.resumeSetup();

        case 'reset':
          return await this.resetSetup(args.flags);

        case 'profiles':
        case 'list':
          return await this.listProfiles();

        case 'validate':
          return await this.validateSetup();

        case 'export':
          return await this.exportSetup(extraArgs[0]);

        default:
          return {
            success: false,
            message: `Unknown setup mode: ${mode}. Use: quick, advanced, team, migration, status, resume, reset, profiles, validate, export`,
          };
      }
    } catch (error) {
      return {
        success: false,
        message: `Setup command error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  private async ensureDirectories(): Promise<void> {
    const mariaDir = path.dirname(this.setupStatePath);
    try {
      await fs.access(mariaDir);
    } catch {
      await fs.mkdir(mariaDir, { recursive: true });
    }
  }

  private getSetupProfiles(): Record<string, SetupProfile> {
    return {
      quick: {
        name: 'Quick Setup',
        description: 'Essential configuration to get started in 2-3 minutes',
        estimatedTime: 180000, // 3 minutes
        steps: [
          {
            id: 'welcome',
            title: 'Welcome to MARIA',
            description: 'Introduction and setup overview',
            type: 'check',
            required: true,
          },
          {
            id: 'api-keys',
            title: 'Configure API Keys',
            description: 'Set up AI provider API keys (OpenAI, Anthropic, etc.)',
            type: 'configure',
            required: true,
            validation: 'checkApiKeys',
          },
          {
            id: 'default-model',
            title: 'Select Default AI Model',
            description: 'Choose your preferred AI model for code generation',
            type: 'configure',
            required: true,
          },
          {
            id: 'basic-preferences',
            title: 'Basic Preferences',
            description: 'Theme, language, and essential settings',
            type: 'configure',
            required: false,
          },
          {
            id: 'git-integration',
            title: 'Git Integration',
            description: 'Configure git user and integration preferences',
            type: 'configure',
            required: false,
            validation: 'checkGitConfig',
          },
          {
            id: 'completion',
            title: 'Setup Complete',
            description: 'Finalize configuration and next steps',
            type: 'validate',
            required: true,
          },
        ],
      },

      advanced: {
        name: 'Advanced Setup',
        description: 'Complete configuration with all features and customizations',
        estimatedTime: 900000, // 15 minutes
        steps: [
          {
            id: 'welcome',
            title: 'Advanced Setup Welcome',
            description: 'Comprehensive configuration overview',
            type: 'check',
            required: true,
          },
          {
            id: 'environment-detection',
            title: 'Environment Detection',
            description: 'Detect development environment and tools',
            type: 'check',
            required: true,
            commands: ['node --version', 'npm --version', 'git --version'],
          },
          {
            id: 'api-configuration',
            title: 'AI Provider Configuration',
            description: 'Configure all AI providers with advanced settings',
            type: 'configure',
            required: true,
          },
          {
            id: 'model-preferences',
            title: 'AI Model Preferences',
            description: 'Set up model selection rules and fallbacks',
            type: 'configure',
            required: true,
          },
          {
            id: 'development-settings',
            title: 'Development Environment',
            description: 'Code style, linting, formatting, and tool integration',
            type: 'configure',
            required: false,
          },
          {
            id: 'security-settings',
            title: 'Security Configuration',
            description: 'API key storage, encryption, and access controls',
            type: 'configure',
            required: true,
          },
          {
            id: 'performance-tuning',
            title: 'Performance Optimization',
            description: 'Cache settings, memory limits, and performance tweaks',
            type: 'configure',
            required: false,
          },
          {
            id: 'workflow-automation',
            title: 'Workflow Automation',
            description: 'Set up hooks, templates, and automation rules',
            type: 'configure',
            required: false,
          },
          {
            id: 'integrations',
            title: 'Third-party Integrations',
            description: 'Configure IDE extensions, terminal setup, and external tools',
            type: 'configure',
            required: false,
          },
          {
            id: 'validation',
            title: 'Configuration Validation',
            description: 'Validate all settings and run connectivity tests',
            type: 'validate',
            required: true,
          },
        ],
      },

      team: {
        name: 'Team Setup',
        description: 'Multi-user environment configuration for teams',
        estimatedTime: 600000, // 10 minutes
        prerequisites: ['Git repository', 'Team lead permissions'],
        steps: [
          {
            id: 'team-info',
            title: 'Team Information',
            description: 'Configure team size, roles, and shared settings',
            type: 'configure',
            required: true,
          },
          {
            id: 'shared-config',
            title: 'Shared Configuration',
            description: 'Set up team-wide coding standards and preferences',
            type: 'configure',
            required: true,
          },
          {
            id: 'permissions',
            title: 'Access Control',
            description: 'Configure user roles and permissions',
            type: 'configure',
            required: true,
          },
          {
            id: 'collaboration-tools',
            title: 'Collaboration Integration',
            description: 'Set up Slack, Discord, or other team communication tools',
            type: 'configure',
            required: false,
          },
          {
            id: 'deployment',
            title: 'Team Configuration Deployment',
            description: 'Deploy shared configuration to team members',
            type: 'install',
            required: true,
          },
        ],
      },

      migration: {
        name: 'Migration Setup',
        description: 'Import configuration from other AI coding tools',
        estimatedTime: 300000, // 5 minutes
        steps: [
          {
            id: 'source-detection',
            title: 'Detect Existing Tools',
            description: 'Scan for GitHub Copilot, Cursor, Codeium, and other AI tools',
            type: 'check',
            required: true,
          },
          {
            id: 'data-import',
            title: 'Import Configuration',
            description: 'Import settings, preferences, and API keys',
            type: 'configure',
            required: true,
          },
          {
            id: 'migration-validation',
            title: 'Validate Migration',
            description: 'Test imported configuration and fix conflicts',
            type: 'validate',
            required: true,
          },
        ],
      },
    };
  }

  private async startQuickSetup(flags: Record<string, unknown>): Promise<SlashCommandResult> {
    const profile = this.getSetupProfiles().quick;

    // Initialize setup state
    const setupState: SetupState = {
      profile: 'quick',
      currentStep: 0,
      completedSteps: [],
      skippedSteps: [],
      configuration: {},
      startTime: new Date().toISOString(),
    };

    await this.saveSetupState(setupState);

    let message = `\n${chalk.bold('🚀 MARIA Quick Setup')}\n\n`;
    message += `${chalk.blue('Time Estimate:')} ${Math.ceil(profile.estimatedTime / 60000)} minutes\n`;
    message += `${chalk.blue('Steps:')} ${profile.steps.length}\n\n`;

    message += `${chalk.bold('What will be configured:')}\n`;
    profile.steps.forEach((step, index) => {
      const icon = step.required ? chalk.red('●') : chalk.gray('○');
      message += `  ${icon} ${step.title}\n`;
    });

    message += `\n${chalk.bold('🎯 Step 1:')} ${profile.steps[0].title}\n`;
    message += `${profile.steps[0].description}\n\n`;

    message += `${chalk.yellow('⚠️  Interactive setup wizard is not yet implemented.')}\n`;
    message += `${chalk.blue('For now, manually configure with:')}\n\n`;

    message += `${chalk.bold('Essential Commands:')}\n`;
    message += `• Set API key: ${chalk.code('export OPENAI_API_KEY=your-key')}\n`;
    message += `• Choose model: ${chalk.code('/model gpt-4')}\n`;
    message += `• Basic config: ${chalk.code('/config set theme dark')}\n`;
    message += `• Git setup: ${chalk.code('git config --global user.name "Your Name"')}\n\n`;

    message += `${chalk.blue('💡 Alternative:')} Use ${chalk.code('/settings')} for detailed configuration\n`;
    message += `${chalk.blue('📋 Track progress:')} Use ${chalk.code('/setup status')} to see setup progress`;

    return { success: true, _message };
  }

  private async startAdvancedSetup(flags: Record<string, unknown>): Promise<SlashCommandResult> {
    const profile = this.getSetupProfiles().advanced;

    let message = `\n${chalk.bold('⚡ MARIA Advanced Setup')}\n\n`;
    message += `${chalk.blue('Time Estimate:')} ${Math.ceil(profile.estimatedTime / 60000)} minutes\n`;
    message += `${chalk.blue('Steps:')} ${profile.steps.length}\n\n`;

    message += `${chalk.bold('Comprehensive Configuration Includes:')}\n`;
    message += `• Complete AI provider setup with fallbacks\n`;
    message += `• Development environment optimization\n`;
    message += `• Security and encryption configuration\n`;
    message += `• Performance tuning and caching\n`;
    message += `• Workflow automation and hooks\n`;
    message += `• Third-party tool integrations\n\n`;

    message += `${chalk.yellow('⚠️  Advanced setup wizard coming soon!')}\n`;
    message += `${chalk.blue('Current options:')}\n`;
    message += `• Use ${chalk.code('/settings wizard --mode=advanced')}\n`;
    message += `• Manual configuration with ${chalk.code('/settings edit <category>')}\n`;
    message += `• Import from file with ${chalk.code('/settings import <file>')}\n\n`;

    message += `${chalk.bold('Pro Tips for Advanced Setup:')}\n`;
    message += `1. Start with ${chalk.code('/doctor')} to check your environment\n`;
    message += `2. Use ${chalk.code('/settings view')} to see all available options\n`;
    message += `3. Configure API keys in environment variables for security\n`;
    message += `4. Set up git hooks with ${chalk.code('/hooks')} for quality control\n`;
    message += `5. Use ${chalk.code('/terminal-setup')} for optimal terminal experience`;

    return { success: true, _message };
  }

  private async startTeamSetup(flags: Record<string, unknown>): Promise<SlashCommandResult> {
    const members = parseInt(flags.members as string) || 5;

    let message = `\n${chalk.bold('👥 MARIA Team Setup')}\n\n`;
    message += `${chalk.blue('Team Size:')} ${members} members\n`;
    message += `${chalk.blue('Setup Type:')} Collaborative development environment\n\n`;

    message += `${chalk.bold('Team Setup Features:')}\n`;
    message += `• Shared coding standards and style guides\n`;
    message += `• Centralized API key management\n`;
    message += `• Role-based access controls\n`;
    message += `• Shared templates and workflows\n`;
    message += `• Team collaboration integrations\n`;
    message += `• Synchronized project configurations\n\n`;

    message += `${chalk.yellow('⚠️  Team setup requires MARIA Enterprise')}\n`;
    message += `${chalk.blue('Contact:')} enterprise@bonginkan.ai for team licenses\n\n`;

    message += `${chalk.bold('Team Configuration Preview:')}\n`;
    message += `1. Create shared ${chalk.code('.maria-team.toml')} configuration\n`;
    message += `2. Set up team member roles and permissions\n`;
    message += `3. Configure shared AI model preferences\n`;
    message += `4. Deploy configuration to all team members\n`;
    message += `5. Set up team communication webhooks\n\n`;

    message += `${chalk.blue('💡 Individual Setup:')} Use ${chalk.code('/setup quick')} for personal configuration`;

    return { success: true, _message };
  }

  private async startMigrationSetup(flags: Record<string, unknown>): Promise<SlashCommandResult> {
    let message = `\n${chalk.bold('📦 MARIA Migration Setup')}\n\n`;

    message += `${chalk.bold('Supported Migration Sources:')}\n`;
    message += `• ${chalk.blue('GitHub Copilot')}: Settings and preferences\n`;
    message += `• ${chalk.blue('Cursor')}: AI model configurations\n`;
    message += `• ${chalk.blue('Codeium')}: API keys and settings\n`;
    message += `• ${chalk.blue('TabNine')}: Code completion preferences\n`;
    message += `• ${chalk.blue('VS Code Extensions')}: AI-related extension settings\n\n`;

    // Check for existing tools
    const detectedTools = await this.detectExistingTools();

    if (detectedTools.length > 0) {
      message += `${chalk.green('✅ Detected Tools:')}\n`;
      detectedTools.forEach((tool) => {
        message += `  • ${tool.name} - ${tool.configPath}\n`;
      });
      message += '\n';
    } else {
      message += `${chalk.gray('🔍 No compatible tools detected in standard locations')}\n\n`;
    }

    message += `${chalk.bold('Migration Process:')}\n`;
    message += `1. ${chalk.blue('Scan')}: Detect installed AI coding tools\n`;
    message += `2. ${chalk.blue('Analyze')}: Parse configuration files\n`;
    message += `3. ${chalk.blue('Map')}: Convert settings to MARIA format\n`;
    message += `4. ${chalk.blue('Import')}: Apply migrated configuration\n`;
    message += `5. ${chalk.blue('Validate')}: Test imported settings\n\n`;

    message += `${chalk.yellow('⚠️  Automatic migration coming soon!')}\n`;
    message += `${chalk.blue('Manual Migration:')}\n`;
    message += `• Export settings from your current tool\n`;
    message += `• Use ${chalk.code('/settings import <file>')} to import\n`;
    message += `• Adjust settings with ${chalk.code('/settings edit <category>')}\n\n`;

    message += `${chalk.blue('💡 Need help?')} Use ${chalk.code('/help migration')} for detailed migration guides`;

    return { success: true, _message };
  }

  private async detectExistingTools(): Promise<Array<{ name: string; configPath: string }>> {
    const tools = [];
    const homeDir = os.homedir();

    const toolPaths = [
      {
        name: 'GitHub Copilot',
        path: path.join(homeDir, '.vscode', 'extensions'),
        pattern: '*copilot*',
      },
      { name: 'Cursor', path: path.join(homeDir, '.cursor'), pattern: 'config.json' },
      { name: 'Codeium', path: path.join(homeDir, '.codeium'), pattern: 'config.json' },
      { name: 'TabNine', path: path.join(homeDir, '.tabnine'), pattern: 'config' },
    ];

    for (const tool of toolPaths) {
      try {
        await fs.access(tool.path);
        tools.push({ name: tool.name, configPath: tool.path });
      } catch {
        // Tool not found
      }
    }

    return tools;
  }

  private async showSetupStatus(): Promise<SlashCommandResult> {
    let message = `\n${chalk.bold('📊 MARIA Setup Status')}\n\n`;

    // Check if setup was run before
    let setupState: SetupState | null = null;
    try {
      const content = await fs.readFile(this.setupStatePath, 'utf-8');
      setupState = JSON.parse(content);
    } catch {
      // No setup state found
    }

    if (!setupState) {
      message += `${chalk.yellow('⚠️  No setup has been run yet')}\n\n`;
      message += `${chalk.bold('Available Setup Options:')}\n`;
      const profiles = this.getSetupProfiles();
      Object.entries(profiles).forEach(([key, profile]) => {
        message += `• ${chalk.blue(`/setup ${key}`)} - ${profile.description}\n`;
      });

      message += `\n${chalk.blue('💡 Recommendation:')} Start with ${chalk.code('/setup quick')} for essential configuration`;

      return { success: true, _message };
    }

    const profile = this.getSetupProfiles()[setupState.profile];
    const completionPercentage = Math.round(
      (setupState.completedSteps.length / profile.steps.length) * 100,
    );

    message += `${chalk.blue('Current Profile:')} ${profile.name}\n`;
    message += `${chalk.blue('Progress:')} ${completionPercentage}% (${setupState.completedSteps.length}/${profile.steps.length} steps)\n`;
    message += `${chalk.blue('Started:')} ${new Date(setupState.startTime).toLocaleString()}\n\n`;

    // Show step progress
    message += `${chalk.bold('Step Progress:')}\n`;
    profile.steps.forEach((step, index) => {
      let status: string;
      if (setupState.completedSteps.includes(step.id)) {
        status = chalk.green('✅');
      } else if (setupState.skippedSteps.includes(step.id)) {
        status = chalk.yellow('⏭️');
      } else if (index === setupState.currentStep) {
        status = chalk.blue('▶️');
      } else {
        status = chalk.gray('⏸️');
      }

      message += `  ${status} ${step.title}\n`;
    });

    if (completionPercentage < 100) {
      message += `\n${chalk.blue('💡 Resume:')} Use ${chalk.code('/setup resume')} to continue setup`;
    } else {
      message += `\n${chalk.green('🎉 Setup completed!')} Your MARIA configuration is ready`;
    }

    return { success: true, _message };
  }

  private async resumeSetup(): Promise<SlashCommandResult> {
    try {
      const content = await fs.readFile(this.setupStatePath, 'utf-8');
      const setupState: SetupState = JSON.parse(content);

      const profile = this.getSetupProfiles()[setupState.profile];
      const currentStep = profile.steps[setupState.currentStep];

      if (!currentStep) {
        return {
          success: true,
          message: `✅ Setup is already complete! All steps have been finished.`,
        };
      }

      let message = `\n${chalk.bold('🔄 Resuming Setup')}\n\n`;
      message += `${chalk.blue('Profile:')} ${profile.name}\n`;
      message += `${chalk.blue('Current Step:')} ${currentStep.title}\n`;
      message += `${chalk.blue('Description:')} ${currentStep.description}\n\n`;

      message += `${chalk.yellow('⚠️  Interactive setup wizard not yet implemented')}\n`;
      message += `${chalk.blue('Manual completion:')} Complete the step manually, then run ${chalk.code('/setup status')} to track progress`;

      return { success: true, _message };
    } catch {
      return {
        success: false,
        message: 'No setup in progress. Start a new setup with /setup quick or /setup advanced',
      };
    }
  }

  private async resetSetup(flags: Record<string, unknown>): Promise<SlashCommandResult> {
    if (!flags.confirm) {
      return {
        success: false,
        message: 'Reset requires confirmation. Use --confirm flag to proceed.',
      };
    }

    try {
      await fs.unlink(this.setupStatePath);
      return {
        success: true,
        message:
          '✅ Setup state reset. You can now run a fresh setup with /setup quick or /setup advanced',
      };
    } catch {
      return {
        success: true,
        message: '✅ No setup state to reset. Ready for fresh setup.',
      };
    }
  }

  private async listProfiles(): Promise<SlashCommandResult> {
    const profiles = this.getSetupProfiles();

    let message = `\n${chalk.bold('📋 Available Setup Profiles')}\n\n`;

    Object.entries(profiles).forEach(([key, profile]) => {
      const timeMinutes = Math.ceil(profile.estimatedTime / 60000);
      message += `${chalk.bold.blue(profile.name)} (${chalk.code(`/setup ${key}`)})\n`;
      message += `  ${profile.description}\n`;
      message += `  ${chalk.gray(`⏱️  ~${timeMinutes} minutes • ${profile.steps.length} steps`)}\n`;

      if (profile.prerequisites) {
        message += `  ${chalk.yellow('Prerequisites:')} ${profile.prerequisites.join(', ')}\n`;
      }

      message += '\n';
    });

    message += `${chalk.blue('💡 Recommendation:')}\n`;
    message += `• First-time users: ${chalk.code('/setup quick')}\n`;
    message += `• Power users: ${chalk.code('/setup advanced')}\n`;
    message += `• Teams: ${chalk.code('/setup team')}`;

    return { success: true, _message };
  }

  private async validateSetup(): Promise<SlashCommandResult> {
    const validations = [];

    // Check for configuration files
    try {
      await fs.access(this.configPath);
      validations.push({
        item: 'Configuration file',
        status: 'pass',
        message: 'Found .maria/config.json',
      });
    } catch {
      validations.push({
        item: 'Configuration file',
        status: 'fail',
        message: 'Missing configuration file',
      });
    }

    // Check for API keys
    const hasApiKeys =
      process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.GOOGLE_AI_API_KEY;
    validations.push({
      item: 'API Keys',
      status: hasApiKeys ? 'pass' : 'warn',
      message: hasApiKeys ? 'API keys configured' : 'No API keys found in environment',
    });

    // Check git configuration
    try {
      await execAsync('git config user.name');
      validations.push({
        item: 'Git configuration',
        status: 'pass',
        message: 'Git user configured',
      });
    } catch {
      validations.push({
        item: 'Git configuration',
        status: 'warn',
        message: 'Git user not configured',
      });
    }

    let message = `\n${chalk.bold('🔍 Setup Validation')}\n\n`;

    const passCount = validations.filter((v) => v.status === 'pass').length;
    const total = validations.length;

    validations.forEach((validation) => {
      const icon = {
        pass: chalk.green('✅'),
        warn: chalk.yellow('⚠️'),
        fail: chalk.red('❌'),
      }[validation.status];

      message += `${icon} ${validation.item}: ${validation.message}\n`;
    });

    message += `\n${chalk.bold('Overall Status:')} ${passCount}/${total} checks passed\n`;

    if (passCount === total) {
      message += `${chalk.green('🎉 Setup validation passed! Your MARIA environment is ready.')}`;
    } else {
      message += `${chalk.yellow('⚠️  Some issues found. Consider running setup to fix them.')}\n`;
      message += `${chalk.blue('💡 Quick fix:')} ${chalk.code('/setup quick')}`;
    }

    return { success: passCount === total, _message };
  }

  private async exportSetup(fileName?: string): Promise<SlashCommandResult> {
    try {
      const setupState = await fs.readFile(this.setupStatePath, 'utf-8');
      const config = await fs.readFile(this.configPath, 'utf-8');

      const exportData = {
        setupState: JSON.parse(setupState),
        configuration: JSON.parse(config),
        exportDate: new Date().toISOString(),
        mariaVersion: '1.0.0', // This would come from package.json
      };

      const exportPath = fileName || `maria-setup-${new Date().toISOString().split('T')[0]}.json`;
      await fs.writeFile(exportPath, JSON.stringify(exportData, null, 2));

      return {
        success: true,
        message: `✅ Setup configuration exported to: ${exportPath}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Export failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  private async saveSetupState(state: SetupState): Promise<void> {
    await fs.writeFile(this.setupStatePath, JSON.stringify(state, null, 2));
  }
}
