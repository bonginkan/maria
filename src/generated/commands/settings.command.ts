/**
 * Settings Command Module
 * 設定コマンド - 高度な設定管理システム
 *
 * Phase 4: Configuration commands implementation
 * Category: Configuration
 */

import { SlashCommandResult } from '../../services/slash-command-handler';
import { BaseCommand } from './base-command';
import { CommandArgs, CommandContext } from './types';
import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import os from 'os';
// Environment variable templates and utilities integrated directly

export interface SettingsConfig {
  general: {
    language: string;
    theme: 'light' | 'dark' | 'auto';
    autoSave: boolean;
    telemetry: boolean;
    updates: 'auto' | 'manual' | 'notify';
  };
  aiModels: {
    defaultProvider: string;
    defaultModel: string;
    temperature: number;
    maxTokens: number;
    timeout: number;
    fallbackModel: string;
  };
  interface: {
    colorScheme: string;
    fontSize: number;
    fontFamily: string;
    animations: boolean;
    compactMode: boolean;
    showLineNumbers: boolean;
  };
  development: {
    codingStyle: string;
    autoFormat: boolean;
    lintOnSave: boolean;
    autoImports: boolean;
    gitIntegration: boolean;
    testRunner: string;
  };
  security: {
    apiKeyStorage: 'env' | 'config' | 'keychain';
    encryptConfig: boolean;
    sessionTimeout: number;
    allowRemoteAccess: boolean;
    auditLog: boolean;
  };
  performance: {
    cacheEnabled: boolean;
    cacheTTL: number;
    maxCacheSize: string;
    preloadModels: boolean;
    backgroundUpdates: boolean;
    lowMemoryMode: boolean;
  };
  advanced: {
    debugMode: boolean;
    experimentalFeatures: boolean;
    customPrompts: Record<string, string>;
    webhooks: Array<{
      url: string;
      events: string[];
      enabled: boolean;
    }>;
  };
}

export class SettingsCommand extends BaseCommand {
  name = 'settings';
  description = 'Advanced settings management and configuration';
  usage = '/settings [view|edit|reset|import|export|search] [category] [options]';
  category = 'configuration';

  examples = [
    '/settings view',
    '/settings edit general',
    '/settings reset --confirm',
    '/settings export my-config.json',
    '/settings search theme',
  ];

  private configPath = path.join(os.homedir(), '.maria', 'settings.json');
  private backupDir = path.join(os.homedir(), '.maria', 'backups');

  async execute(args: CommandArgs, context: CommandContext): Promise<SlashCommandResult> {
    try {
      const [action = 'view', category, ...extraArgs] = args.args;

      await this.ensureDirectories();

      switch (action.toLowerCase()) {
        case 'view':
        case 'show':
          return await this.viewSettings(category);

        case 'edit':
        case 'set':
          return await this.editSettings(category, extraArgs, args.flags);

        case 'reset':
          return await this.resetSettings(category, args.flags);

        case 'import':
          return await this.importSettings(category);

        case 'export':
          return await this.exportSettings(category);

        case 'search':
          return await this.searchSettings(category);

        case 'backup':
          return await this.backupSettings();

        case 'restore':
          return await this.restoreSettings(category);

        case 'validate':
          return await this.validateSettings();

        case 'wizard':
          return await this.startWizard(args.flags);

        case 'env':
        case 'environment':
          return await this.manageEnvironment(category, extraArgs, args.flags);

        default:
          return {
            success: false,
            message: `Unknown settings action: ${action}. Use: view, edit, reset, import, export, search, backup, restore, validate, wizard, env`,
          };
      }
    } catch (error) {
      return {
        success: false,
        message: `Settings command error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  private async ensureDirectories(): Promise<void> {
    for (const dir of [path.dirname(this.configPath), this.backupDir]) {
      try {
        await fs.access(dir);
      } catch {
        await fs.mkdir(dir, { recursive: true });
      }
    }
  }

  private async loadSettings(): Promise<SettingsConfig> {
    try {
      const content = await fs.readFile(this.configPath, 'utf-8');
      const settings = JSON.parse(content);
      return { ...this.getDefaultSettings(), ...settings };
    } catch {
      return this.getDefaultSettings();
    }
  }

  private async saveSettings(settings: SettingsConfig): Promise<void> {
    await fs.writeFile(this.configPath, JSON.stringify(settings, null, 2));
  }

  private getDefaultSettings(): SettingsConfig {
    return {
      general: {
        language: 'en',
        theme: 'dark',
        autoSave: true,
        telemetry: true,
        updates: 'notify',
      },
      aiModels: {
        defaultProvider: 'openai',
        defaultModel: 'gpt-4',
        temperature: 0.7,
        maxTokens: 2048,
        timeout: 30000,
        fallbackModel: 'gpt-3.5-turbo',
      },
      interface: {
        colorScheme: 'maria-dark',
        fontSize: 14,
        fontFamily: 'JetBrains Mono, Fira Code, Monaco',
        animations: true,
        compactMode: false,
        showLineNumbers: true,
      },
      development: {
        codingStyle: 'typescript',
        autoFormat: true,
        lintOnSave: true,
        autoImports: true,
        gitIntegration: true,
        testRunner: 'jest',
      },
      security: {
        apiKeyStorage: 'env',
        encryptConfig: false,
        sessionTimeout: 3600000,
        allowRemoteAccess: false,
        auditLog: true,
      },
      performance: {
        cacheEnabled: true,
        cacheTTL: 3600000,
        maxCacheSize: '100MB',
        preloadModels: false,
        backgroundUpdates: true,
        lowMemoryMode: false,
      },
      advanced: {
        debugMode: false,
        experimentalFeatures: false,
        customPrompts: {},
        webhooks: [],
      },
    };
  }

  private async viewSettings(category?: string): Promise<SlashCommandResult> {
    const settings = await this.loadSettings();

    let message = `\n${chalk.bold('⚙️ MARIA Settings')}\n\n`;

    if (category) {
      // Show specific category
      const categorySettings = settings[category as keyof SettingsConfig];
      if (!categorySettings) {
        return {
          success: false,
          message: `Category '${category}' not found. Available categories: ${Object.keys(settings).join(', ')}`,
        };
      }

      message += `${chalk.bold(`📂 ${category.charAt(0).toUpperCase() + category.slice(1)} Settings:`)}\n\n`;
      message += this.formatCategorySettings(category, categorySettings);
    } else {
      // Show all categories overview
      message += `Configuration file: ${chalk.gray(this.configPath)}\n\n`;

      for (const [cat, catSettings] of Object.entries(settings)) {
        const categoryName = cat.charAt(0).toUpperCase() + cat.slice(1);
        const settingsCount = Object.keys(catSettings).length;

        message += `${chalk.blue(`📂 ${categoryName}`)}\n`;
        message += `   ${settingsCount} settings configured\n`;
        message += `   Use: ${chalk.code(`/settings view ${cat}`)}\n\n`;
      }

      message += `${chalk.bold('Quick Actions:')}\n`;
      message += `• ${chalk.blue('/settings edit <category>')} - Edit specific category\n`;
      message += `• ${chalk.blue('/settings wizard')} - Guided configuration\n`;
      message += `• ${chalk.blue('/settings search <term>')} - Find settings\n`;
    }

    return { success: true, message };
  }

  private formatCategorySettings(category: string, settings: unknown): string {
    let message = '';

    if (typeof settings === 'object' && settings !== null) {
      for (const [key, value] of Object.entries(settings)) {
        const formattedKey = key.charAt(0).toUpperCase() + key.slice(1);
        let formattedValue: string;

        if (typeof value === 'boolean') {
          formattedValue = value ? chalk.green('Enabled') : chalk.red('Disabled');
        } else if (typeof value === 'string') {
          formattedValue = chalk.blue(value);
        } else if (typeof value === 'number') {
          formattedValue = chalk.yellow(value.toString());
        } else if (Array.isArray(value)) {
          formattedValue = chalk.gray(`[${value.length} items]`);
        } else {
          formattedValue = chalk.gray(JSON.stringify(value));
        }

        message += `  ${chalk.bold(formattedKey.padEnd(20))}: ${formattedValue}\n`;
      }
    }

    message += `\n${chalk.blue('💡 Edit:')} /settings edit ${category} <setting> <value>\n`;

    return message;
  }

  private async editSettings(
    category?: string,
    args: string[] = [],
    flags: Record<string, unknown> = {},
  ): Promise<SlashCommandResult> {
    if (!category) {
      return {
        success: false,
        message:
          'Usage: /settings edit <category> [setting] [value] or use /settings wizard for guided editing',
      };
    }

    const settings = await this.loadSettings();

    if (!(category in settings)) {
      return {
        success: false,
        message: `Category '${category}' not found. Available: ${Object.keys(settings).join(', ')}`,
      };
    }

    if (args.length === 0) {
      // Show editable settings in category
      const categorySettings = settings[category as keyof SettingsConfig];
      let message = `\n${chalk.bold(`📝 Editable Settings in ${category}:`)}\n\n`;

      if (typeof categorySettings === 'object' && categorySettings !== null) {
        for (const [key, value] of Object.entries(categorySettings)) {
          message += `${chalk.blue(key.padEnd(20))} = ${value} (${typeof value})\n`;
        }
      }

      message += `\n${chalk.bold('Usage:')}\n`;
      message += `/settings edit ${category} <setting> <value>\n`;
      message += `\n${chalk.bold('Example:')}\n`;
      message += `/settings edit ${category} ${Object.keys(categorySettings as Record<string, unknown>)[0]} <new-value>`;

      return { success: true, message };
    }

    if (args.length < 2) {
      return {
        success: false,
        message: 'Usage: /settings edit <category> <setting> <value>',
      };
    }

    const [settingKey, ...valueArgs] = args;
    const value = valueArgs.join(' ');

    // Update the setting
    const categorySettings = settings[category as keyof SettingsConfig] as Record<string, unknown>;

    if (!(settingKey in categorySettings)) {
      return {
        success: false,
        message: `Setting '${settingKey}' not found in ${category}. Available: ${Object.keys(categorySettings).join(', ')}`,
      };
    }

    // Convert value to appropriate type
    const currentValue = categorySettings[settingKey];
    let newValue: unknown = value;

    if (typeof currentValue === 'boolean') {
      newValue = value.toLowerCase() === 'true' || value === '1' || value.toLowerCase() === 'on';
    } else if (typeof currentValue === 'number') {
      newValue = parseInt(value) || parseFloat(value) || 0;
    }

    // Backup current settings
    if (flags.backup !== false) {
      await this.backupSettings();
    }

    // Update and save
    categorySettings[settingKey] = newValue;
    await this.saveSettings(settings);

    return {
      success: true,
      message:
        `✅ Updated ${category}.${settingKey}: ${currentValue} → ${newValue}\n\n` +
        `${chalk.blue('💡 Tip:')} Use \`/settings view ${category}\` to see all settings in this category.`,
    };
  }

  private async resetSettings(
    category?: string,
    flags: Record<string, unknown> = {},
  ): Promise<SlashCommandResult> {
    if (!flags.confirm) {
      return {
        success: false,
        message: 'Reset requires confirmation. Use --confirm flag to proceed.',
      };
    }

    // Backup before reset
    await this.backupSettings();

    if (category) {
      // Reset specific category
      const settings = await this.loadSettings();
      const defaults = this.getDefaultSettings();

      if (!(category in settings)) {
        return {
          success: false,
          message: `Category '${category}' not found.`,
        };
      }

      settings[category as keyof SettingsConfig] = defaults[category as keyof SettingsConfig];
      await this.saveSettings(settings);

      return {
        success: true,
        message: `✅ Reset ${category} settings to defaults.\nBackup saved for recovery.`,
      };
    } else {
      // Reset all settings
      const defaults = this.getDefaultSettings();
      await this.saveSettings(defaults);

      return {
        success: true,
        message: `✅ Reset all settings to defaults.\nBackup saved for recovery.`,
      };
    }
  }

  private async searchSettings(searchTerm?: string): Promise<SlashCommandResult> {
    if (!searchTerm) {
      return {
        success: false,
        message: 'Usage: /settings search <term>',
      };
    }

    const settings = await this.loadSettings();
    const results: Array<{ category: string; key: string; value: unknown }> = [];
    const term = searchTerm.toLowerCase();

    for (const [category, categorySettings] of Object.entries(settings)) {
      if (typeof categorySettings === 'object' && categorySettings !== null) {
        for (const [key, value] of Object.entries(categorySettings)) {
          if (
            category.toLowerCase().includes(term) ||
            key.toLowerCase().includes(term) ||
            String(value).toLowerCase().includes(term)
          ) {
            results.push({ category, key, value });
          }
        }
      }
    }

    if (results.length === 0) {
      return {
        success: false,
        message: `No settings found matching "${searchTerm}"`,
      };
    }

    let message = `\n${chalk.bold(`🔍 Settings Search Results for "${searchTerm}"`)} (${results.length} found)\n\n`;

    results.forEach(({ category, key, value }) => {
      message += `${chalk.blue(category)}.${chalk.bold(key)} = ${value}\n`;
      message += `  ${chalk.gray(`Edit: /settings edit ${category} ${key} <value>`)}\n\n`;
    });

    return { success: true, message };
  }

  private async backupSettings(): Promise<SlashCommandResult> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(this.backupDir, `settings-backup-${timestamp}.json`);

      const currentSettings = await fs.readFile(this.configPath, 'utf-8');
      await fs.writeFile(backupPath, currentSettings);

      return {
        success: true,
        message: `✅ Settings backed up to: ${backupPath}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Backup failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  private async restoreSettings(backupFile?: string): Promise<SlashCommandResult> {
    if (!backupFile) {
      // List available backups
      try {
        const files = await fs.readdir(this.backupDir);
        const backups = files.filter(
          (f) => f.startsWith('settings-backup-') && f.endsWith('.json'),
        );

        if (backups.length === 0) {
          return {
            success: false,
            message: 'No backup files found.',
          };
        }

        let message = `\n${chalk.bold('📦 Available Backups:')}\n\n`;
        backups.forEach((file, index) => {
          const date = file.replace('settings-backup-', '').replace('.json', '').replace(/-/g, ':');
          message += `${index + 1}. ${file} (${date})\n`;
        });

        message += `\n${chalk.blue('Usage:')} /settings restore <backup-filename>`;

        return { success: true, message };
      } catch (error) {
        return {
          success: false,
          message: `Failed to list backups: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }

    try {
      const backupPath = path.join(this.backupDir, backupFile);
      const backupContent = await fs.readFile(backupPath, 'utf-8');

      // Validate backup
      JSON.parse(backupContent);

      // Restore
      await fs.writeFile(this.configPath, backupContent);

      return {
        success: true,
        message: `✅ Settings restored from: ${backupFile}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Restore failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  private async validateSettings(): Promise<SlashCommandResult> {
    try {
      const settings = await this.loadSettings();
      const defaults = this.getDefaultSettings();
      const issues: string[] = [];

      // Check for missing categories
      for (const category of Object.keys(defaults)) {
        if (!(category in settings)) {
          issues.push(`Missing category: ${category}`);
        }
      }

      // Check for invalid values
      for (const [category, categorySettings] of Object.entries(settings)) {
        if (category in defaults) {
          const defaultCategory = defaults[category as keyof SettingsConfig] as Record<
            string,
            unknown
          >;

          if (typeof categorySettings === 'object' && categorySettings !== null) {
            for (const [key, value] of Object.entries(categorySettings)) {
              if (key in defaultCategory) {
                const expectedType = typeof defaultCategory[key];
                const actualType = typeof value;

                if (expectedType !== actualType) {
                  issues.push(`${category}.${key}: Expected ${expectedType}, got ${actualType}`);
                }
              }
            }
          }
        }
      }

      let message = `\n${chalk.bold('🔍 Settings Validation')}\n\n`;

      if (issues.length === 0) {
        message += `${chalk.green('✅ All settings are valid!')}\n`;
        message += `Configuration file: ${this.configPath}`;
      } else {
        message += `${chalk.red('❌ Found issues:')}\n\n`;
        issues.forEach((issue) => {
          message += `  • ${issue}\n`;
        });
        message += `\n${chalk.blue('💡 Fix:')} Run \`/settings reset --confirm\` to restore defaults`;
      }

      return {
        success: issues.length === 0,
        message,
      };
    } catch (error) {
      return {
        success: false,
        message: `Validation failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  private async startWizard(flags: Record<string, unknown>): Promise<SlashCommandResult> {
    const mode = (flags.mode as string) || 'basic';

    let message = `\n${chalk.bold('🧙‍♂️ Settings Configuration Wizard')}\n\n`;

    message += `${chalk.blue('Wizard Mode:')} ${mode}\n\n`;

    message += `${chalk.bold('Available Wizard Modes:')}\n`;
    message += `• ${chalk.blue('basic')}: Essential settings (5 minutes)\n`;
    message += `• ${chalk.blue('advanced')}: Complete configuration (15 minutes)\n`;
    message += `• ${chalk.blue('expert')}: All options including experimental features\n\n`;

    message += `${chalk.yellow('⚠️  Interactive wizard not yet implemented.')}\n`;
    message += `${chalk.blue('Alternative:')} Use individual /settings edit commands\n\n`;

    message += `${chalk.bold('Quick Setup Examples:')}\n`;
    message += `• ${chalk.code('/settings edit general theme dark')}\n`;
    message += `• ${chalk.code('/settings edit aiModels defaultModel claude-3-opus')}\n`;
    message += `• ${chalk.code('/settings edit development autoFormat true')}\n`;

    return { success: true, message };
  }

  private async exportSettings(fileName?: string): Promise<SlashCommandResult> {
    const exportPath = fileName || `maria-settings-${new Date().toISOString().split('T')[0]}.json`;

    try {
      const settings = await this.loadSettings();
      await fs.writeFile(exportPath, JSON.stringify(settings, null, 2));

      return {
        success: true,
        message: `✅ Settings exported to: ${exportPath}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Export failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  private async importSettings(fileName?: string): Promise<SlashCommandResult> {
    if (!fileName) {
      return {
        success: false,
        message: 'Usage: /settings import <filename>',
      };
    }

    try {
      const content = await fs.readFile(fileName, 'utf-8');
      const importedSettings = JSON.parse(content);

      // Backup current settings first
      await this.backupSettings();

      // Validate imported settings
      const defaults = this.getDefaultSettings();
      const validatedSettings = { ...defaults, ...importedSettings };

      await this.saveSettings(validatedSettings);

      return {
        success: true,
        message: `✅ Settings imported from: ${fileName}\nPrevious settings backed up for safety.`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Import failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  private async manageEnvironment(
    template?: string,
    args: string[] = [],
    flags: Record<string, unknown> = {},
  ): Promise<SlashCommandResult> {
    try {
      const action = template || 'view';

      switch (action.toLowerCase()) {
        case 'view':
        case 'show':
          return await this.viewEnvironmentVariables();

        case 'setup':
        case 'generate':
        case 'create':
          const providerType = args[0] || 'all';
          return await this.generateEnvironmentTemplate(providerType, flags);

        case 'edit':
          return await this.editEnvironmentFile();

        case 'validate':
        case 'check':
          return await this.validateEnvironmentVariables();

        case 'sample':
          return await this.generateSampleFile();

        default:
          return {
            success: false,
            message:
              `Unknown environment action: ${action}\n\n${chalk.bold('Available actions:')}\n` +
              `• ${chalk.blue('view')} - Show current environment variables\n` +
              `• ${chalk.blue('setup [provider]')} - Generate .env template (ai, firebase, database, all)\n` +
              `• ${chalk.blue('edit')} - Open .env.local for editing\n` +
              `• ${chalk.blue('validate')} - Check environment configuration\n` +
              `• ${chalk.blue('sample')} - Generate .env.local.sample file`,
          };
      }
    } catch (error) {
      return {
        success: false,
        message: `Environment management failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  private async viewEnvironmentVariables(): Promise<SlashCommandResult> {
    try {
      const envPath = path.join(process.cwd(), '.env.local');
      const envExists = await fs
        .access(envPath)
        .then(() => true)
        .catch(() => false);

      let message = `\n${chalk.bold('🔧 Environment Variables Status')}\n\n`;

      if (!envExists) {
        message += `${chalk.red('❌ No .env.local file found')}\n\n`;
        message += `${chalk.blue('💡 Quick setup:')}\n`;
        message += `• ${chalk.code('/settings env setup')} - Generate complete template\n`;
        message += `• ${chalk.code('/settings env setup ai')} - AI providers only\n`;
        message += `• ${chalk.code('/settings env sample')} - Create sample file\n`;

        return { success: false, message };
      }

      const envContent = await fs.readFile(envPath, 'utf-8');
      const envLines = envContent
        .split('\n')
        .filter((line) => line.trim() && !line.startsWith('#'));

      message += `File: ${chalk.gray(envPath)}\n`;
      message += `Variables: ${chalk.yellow(envLines.length)} configured\n\n`;

      // Categorize variables
      const categories = {
        ai: [
          'OPENAI_API_KEY',
          'ANTHROPIC_API_KEY',
          'GOOGLE_AI_API_KEY',
          'GROQ_API_KEY',
          'GROK_API_KEY',
        ],
        firebase: [
          'NEXT_PUBLIC_FIREBASE_API_KEY',
          'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
          'FIREBASE_ADMIN_CLIENT_EMAIL',
        ],
        database: ['NEO4J_URI', 'NEO4J_USER', 'NEO4J_PASSWORD'],
        local: ['LMSTUDIO_API_URL', 'OLLAMA_API_URL', 'VLLM_API_URL'],
        other: [],
      };

      for (const [category, keys] of Object.entries(categories)) {
        if (category === 'other') continue;

        const categoryVars = envLines.filter((line) => {
          const varName = line.split('=')[0];
          return keys.some((key) => varName.includes(key));
        });

        if (categoryVars.length > 0) {
          const categoryName = category.charAt(0).toUpperCase() + category.slice(1);
          message += `${chalk.bold(`📂 ${categoryName} Providers`)}\n`;

          categoryVars.forEach((line) => {
            const [key, value] = line.split('=');
            const hasValue = value && value !== 'your_key_here' && value !== '';
            message += `  ${hasValue ? '✅' : '❌'} ${key}\n`;
          });
          message += '\n';
        }
      }

      // Show other variables
      const otherVars = envLines.filter((line) => {
        const varName = line.split('=')[0];
        return !Object.values(categories)
          .flat()
          .some((key) => varName.includes(key));
      });

      if (otherVars.length > 0) {
        message += `${chalk.bold('📂 Other Variables')}\n`;
        otherVars.forEach((line) => {
          const [key] = line.split('=');
          message += `  ℹ️  ${key}\n`;
        });
      }

      return { success: true, message };
    } catch (error) {
      return {
        success: false,
        message: `Failed to read environment variables: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  private async generateEnvironmentTemplate(
    providerType: string,
    flags: Record<string, unknown>,
  ): Promise<SlashCommandResult> {
    const templates = {
      ai: {
        title: 'AI Providers',
        vars: {
          '# AI Provider API Keys': '',
          OPENAI_API_KEY: 'your_openai_key_here',
          ANTHROPIC_API_KEY: 'your_anthropic_key_here',
          GOOGLE_AI_API_KEY: 'your_google_ai_key_here',
          GROQ_API_KEY: 'your_groq_key_here',
          GROK_API_KEY: 'your_grok_key_here',
          '': '',
          '# Local AI Providers (Optional)': '',
          LMSTUDIO_API_URL: 'http://localhost:1234',
          OLLAMA_API_URL: 'http://localhost:11434',
          VLLM_API_URL: 'http://localhost:8000',
        },
      },
      firebase: {
        title: 'Firebase Configuration',
        vars: {
          '# Firebase Configuration': '',
          NEXT_PUBLIC_FIREBASE_API_KEY: 'your_firebase_api_key',
          NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'your-project.firebaseapp.com',
          NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'your-project-id',
          NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'your-project.appspot.com',
          NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: 'your_sender_id',
          NEXT_PUBLIC_FIREBASE_APP_ID: 'your_app_id',
          FIREBASE_ADMIN_CLIENT_EMAIL: 'your-service-account@your-project.iam.gserviceaccount.com',
          FIREBASE_ADMIN_PRIVATE_KEY: 'your_private_key_here',
        },
      },
      database: {
        title: 'Database Configuration',
        vars: {
          '# Neo4j Graph Database': '',
          NEO4J_URI: 'neo4j+s://your-instance.neo4j.io',
          NEO4J_USER: 'neo4j',
          NEO4J_PASSWORD: 'your_neo4j_password',
          NEO4J_BLOOM_JWT_SECRET: 'your_jwt_secret',
          '': '',
          '# Google Cloud': '',
          MARIA_PROJECT_ID: 'your-gcp-project-id',
          VERTEX_TOKEN: 'your_vertex_ai_token',
          GOOGLE_APPLICATION_CREDENTIALS: '/path/to/service-account.json',
        },
      },
    };

    let envContent = '';

    if (providerType === 'all') {
      envContent += `# MARIA CODE Environment Configuration\n`;
      envContent += `# Generated on ${new Date().toISOString()}\n`;
      envContent += `# Replace placeholder values with your actual credentials\n\n`;

      for (const template of Object.values(templates)) {
        for (const [key, value] of Object.entries(template.vars)) {
          if (key.startsWith('#') || key === '') {
            envContent += `${key}\n`;
          } else {
            envContent += `${key}=${value}\n`;
          }
        }
        envContent += '\n';
      }
    } else if (templates[providerType as keyof typeof templates]) {
      const template = templates[providerType as keyof typeof templates];
      envContent += `# ${template.title} Configuration\n`;
      envContent += `# Generated on ${new Date().toISOString()}\n\n`;

      for (const [key, value] of Object.entries(template.vars)) {
        if (key.startsWith('#') || key === '') {
          envContent += `${key}\n`;
        } else {
          envContent += `${key}=${value}\n`;
        }
      }
    } else {
      return {
        success: false,
        message: `Unknown provider type: ${providerType}\n\nAvailable types: ai, firebase, database, all`,
      };
    }

    try {
      const envPath = path.join(process.cwd(), '.env.local');
      const envExists = await fs
        .access(envPath)
        .then(() => true)
        .catch(() => false);

      if (envExists && !flags.overwrite) {
        return {
          success: false,
          message:
            `${chalk.red('⚠️  .env.local already exists')}\n\n` +
            `Use ${chalk.code('/settings env setup ' + providerType + ' --overwrite')} to replace it\n` +
            `Or ${chalk.code('/settings env sample')} to create .env.local.sample`,
        };
      }

      await fs.writeFile(envPath, envContent);

      // Update .gitignore if needed
      await this.updateGitignore();

      let message = `\n${chalk.green('✅ Environment template generated!')}\n\n`;
      message += `File: ${chalk.blue(envPath)}\n`;
      message += `Type: ${providerType === 'all' ? 'Complete' : templates[providerType as keyof typeof templates]?.title || providerType}\n\n`;
      message += `${chalk.bold('Next steps:')}\n`;
      message += `1. ${chalk.blue('Edit the file')} and replace placeholder values\n`;
      message += `2. ${chalk.blue('Get API keys')} from respective providers\n`;
      message += `3. ${chalk.blue('Test configuration')} with ${chalk.code('/settings env validate')}\n\n`;
      message += `${chalk.yellow('⚠️  Keep your API keys secure!')} The .env.local file is in .gitignore.`;

      return { success: true, message };
    } catch (error) {
      return {
        success: false,
        message: `Failed to generate template: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  private async validateEnvironmentVariables(): Promise<SlashCommandResult> {
    try {
      const envPath = path.join(process.cwd(), '.env.local');
      const envExists = await fs
        .access(envPath)
        .then(() => true)
        .catch(() => false);

      if (!envExists) {
        return {
          success: false,
          message: `${chalk.red('❌ No .env.local file found')}\n\nRun ${chalk.code('/settings env setup')} to create one.`,
        };
      }

      const envContent = await fs.readFile(envPath, 'utf-8');
      const envLines = envContent
        .split('\n')
        .filter((line) => line.trim() && !line.startsWith('#'));

      let message = `\n${chalk.bold('🔍 Environment Validation Results')}\n\n`;

      const issues: string[] = [];
      const warnings: string[] = [];
      const successes: string[] = [];

      // Check for placeholder values
      envLines.forEach((line) => {
        const [key, value] = line.split('=');
        if (!value || value.includes('your_') || value.includes('_here')) {
          issues.push(`${key}: Contains placeholder value`);
        } else if (value.length < 10 && key.includes('API_KEY')) {
          warnings.push(`${key}: Suspiciously short API key`);
        } else {
          successes.push(`${key}: Configured`);
        }
      });

      // Results summary
      message += `${chalk.green('✅ Valid:')} ${successes.length}\n`;
      message += `${chalk.yellow('⚠️  Warnings:')} ${warnings.length}\n`;
      message += `${chalk.red('❌ Issues:')} ${issues.length}\n\n`;

      if (issues.length > 0) {
        message += `${chalk.red('Issues found:')}\n`;
        issues.forEach((issue) => (message += `  • ${issue}\n`));
        message += '\n';
      }

      if (warnings.length > 0) {
        message += `${chalk.yellow('Warnings:')}\n`;
        warnings.forEach((warning) => (message += `  • ${warning}\n`));
        message += '\n';
      }

      if (successes.length > 0 && issues.length === 0) {
        message += `${chalk.green('🎉 All environment variables look good!')}\n`;
      }

      return {
        success: issues.length === 0,
        message,
      };
    } catch (error) {
      return {
        success: false,
        message: `Validation failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  private async generateSampleFile(): Promise<SlashCommandResult> {
    try {
      const samplePath = path.join(process.cwd(), '.env.local.sample');
      const envPath = path.join(process.cwd(), '.env.local');

      let sampleContent = '';

      // If .env.local exists, create sample from it
      const envExists = await fs
        .access(envPath)
        .then(() => true)
        .catch(() => false);
      if (envExists) {
        const envContent = await fs.readFile(envPath, 'utf-8');
        sampleContent = envContent.replace(/=.*/g, '=your_value_here');
        sampleContent = `# Sample Environment Configuration\n# Copy to .env.local and replace values\n\n${sampleContent}`;
      } else {
        // Generate complete sample
        sampleContent = `# MARIA CODE Environment Configuration Sample
# Copy this file to .env.local and replace the placeholder values

# AI Provider API Keys
OPENAI_API_KEY=your_openai_key_here
ANTHROPIC_API_KEY=your_anthropic_key_here
GOOGLE_AI_API_KEY=your_google_ai_key_here
GROQ_API_KEY=your_groq_key_here
GROK_API_KEY=your_grok_key_here

# Local AI Providers (Optional)
LMSTUDIO_API_URL=http://localhost:1234
OLLAMA_API_URL=http://localhost:11434
VLLM_API_URL=http://localhost:8000

# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
FIREBASE_ADMIN_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY=your_private_key_here

# Neo4j Graph Database
NEO4J_URI=neo4j+s://your-instance.neo4j.io
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_neo4j_password
NEO4J_BLOOM_JWT_SECRET=your_jwt_secret

# Google Cloud
MARIA_PROJECT_ID=your-gcp-project-id
VERTEX_TOKEN=your_vertex_ai_token
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
`;
      }

      await fs.writeFile(samplePath, sampleContent);

      return {
        success: true,
        message:
          `${chalk.green('✅ Sample file created!')}\n\n` +
          `File: ${chalk.blue(samplePath)}\n\n` +
          `${chalk.bold('Usage:')}\n` +
          `1. Copy to .env.local: ${chalk.code('cp .env.local.sample .env.local')}\n` +
          `2. Edit with your values: ${chalk.code('/settings env edit')}\n` +
          `3. Validate setup: ${chalk.code('/settings env validate')}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to create sample file: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  private async editEnvironmentFile(): Promise<SlashCommandResult> {
    const envPath = path.join(process.cwd(), '.env.local');

    return {
      success: true,
      message:
        `${chalk.blue('📝 Edit Environment Variables')}\n\n` +
        `File location: ${chalk.gray(envPath)}\n\n` +
        `${chalk.bold('Options:')}\n` +
        `• Open in your default editor\n` +
        `• Edit directly in terminal with nano/vim\n` +
        `• Use VS Code: ${chalk.code('code .env.local')}\n\n` +
        `${chalk.yellow('⚠️  Remember:')} Restart MARIA after making changes`,
    };
  }

  private async updateGitignore(): Promise<void> {
    try {
      const gitignorePath = path.join(process.cwd(), '.gitignore');
      let gitignoreContent = '';

      try {
        gitignoreContent = await fs.readFile(gitignorePath, 'utf-8');
      } catch {
        // .gitignore doesn't exist, create it
      }

      const envEntries = ['.env.local', '.env*.local'];
      const missingEntries = envEntries.filter((entry) => !gitignoreContent.includes(entry));

      if (missingEntries.length > 0) {
        gitignoreContent += '\n# Environment variables\n';
        missingEntries.forEach((entry) => {
          gitignoreContent += `${entry}\n`;
        });

        await fs.writeFile(gitignorePath, gitignoreContent);
      }
    } catch {
      // Ignore gitignore update errors
    }
  }
}
