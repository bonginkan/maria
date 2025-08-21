import { BaseCommand } from '../base-command';
import { Command, RequireAuth, RateLimit, Validate } from '../decorators';
import { CommandContext, CommandOptions, CommandResult } from '../types';
import { z } from 'zod';
import chalk from 'chalk';
import { logger } from '../../utils/logger';
import { ConfigManagerService } from '../../services/config-manager';
import { FileSystemService } from '../../services/file-system-service';
import path from 'path';
import os from 'os';

const configSchema = z.object({
  get: z.string().optional(),
  set: z.string().optional(),
  value: z.any().optional(),
  list: z.boolean().optional().default(false),
  reset: z.boolean().optional().default(false),
  edit: z.boolean().optional().default(false),
  global: z.boolean().optional().default(false),
  local: z.boolean().optional().default(false),
  export: z.string().optional(),
  import: z.string().optional(),
  validate: z.boolean().optional().default(false),
});

export type ConfigOptions = z.infer<typeof configSchema>;

/**
 * Configuration Management Command
 *
 * Features:
 * - Get/Set configuration values
 * - List all configurations
 * - Reset to defaults
 * - Edit config file directly
 * - Global vs Local configs
 * - Import/Export configurations
 * - Config validation
 */
@Command({
  name: 'config',
  aliases: ['cfg', 'settings', 'conf'],
  description: 'Manage MARIA configuration',
  category: 'configuration',
  priority: 85,
  version: '2.0.0',
})
@RequireAuth({ level: 'basic' })
@RateLimit(50, '1m')
@Validate(configSchema)
export class ConfigCommand extends BaseCommand<ConfigOptions> {
  private configManager: ConfigManagerService;
  private fileSystem: FileSystemService;

  private readonly configKeys = {
    // AI Settings
    defaultModel: {
      type: 'string',
      description: 'Default AI model',
      default: 'gpt-4',
      validate: (v: unknown) => typeof v === 'string',
    },
    temperature: {
      type: 'number',
      description: 'AI temperature (0-2)',
      default: 0.7,
      validate: (v: unknown) => typeof v === 'number' && v >= 0 && v <= 2,
    },
    maxTokens: {
      type: 'number',
      description: 'Max tokens per request',
      default: 2000,
      validate: (v: unknown) => typeof v === 'number' && v > 0,
    },
    stream: {
      type: 'boolean',
      description: 'Stream AI responses',
      default: true,
      validate: (v: unknown) => typeof v === 'boolean',
    },

    // UI Settings
    theme: {
      type: 'string',
      description: 'UI theme',
      default: 'dark',
      validate: (v: unknown) => ['dark', 'light', 'auto'].includes(v),
    },
    colors: {
      type: 'boolean',
      description: 'Enable colored output',
      default: true,
      validate: (v: unknown) => typeof v === 'boolean',
    },
    animations: {
      type: 'boolean',
      description: 'Enable animations',
      default: true,
      validate: (v: unknown) => typeof v === 'boolean',
    },

    // Developer Settings
    debug: {
      type: 'boolean',
      description: 'Debug mode',
      default: false,
      validate: (v: unknown) => typeof v === 'boolean',
    },
    verbose: {
      type: 'boolean',
      description: 'Verbose output',
      default: false,
      validate: (v: unknown) => typeof v === 'boolean',
    },
    telemetry: {
      type: 'boolean',
      description: 'Send telemetry data',
      default: true,
      validate: (v: unknown) => typeof v === 'boolean',
    },

    // Project Settings
    projectPath: {
      type: 'string',
      description: 'Default project path',
      default: process.cwd(),
      validate: (v: unknown) => typeof v === 'string',
    },
    autoSave: {
      type: 'boolean',
      description: 'Auto-save generated code',
      default: false,
      validate: (v: unknown) => typeof v === 'boolean',
    },
    autoFormat: {
      type: 'boolean',
      description: 'Auto-format code',
      default: true,
      validate: (v: unknown) => typeof v === 'boolean',
    },

    // API Keys (sensitive)
    openaiKey: {
      type: 'string',
      description: 'OpenAI API key',
      default: '',
      sensitive: true,
      validate: (v: unknown) => typeof v === 'string',
    },
    anthropicKey: {
      type: 'string',
      description: 'Anthropic API key',
      default: '',
      sensitive: true,
      validate: (v: unknown) => typeof v === 'string',
    },
    googleKey: {
      type: 'string',
      description: 'Google AI API key',
      default: '',
      sensitive: true,
      validate: (v: unknown) => typeof v === 'string',
    },
  };

  constructor() {
    super();
    this.configManager = ConfigManagerService.getInstance();
    this.fileSystem = new FileSystemService();
  }

  async execute(
    args: string[],
    options: ConfigOptions,
    context: CommandContext,
  ): Promise<CommandResult> {
    try {
      this.emit('start', { command: 'config', options });

      // Handle different operations
      if (options.list) {
        return await this.listConfigs(options);
      }

      if (options.get) {
        return await this.getConfig(options.get, options);
      }

      if (options.set) {
        return await this.setConfig(options.set, options.value, options);
      }

      if (options.reset) {
        return await this.resetConfigs(options);
      }

      if (options.edit) {
        return await this.editConfig(options);
      }

      if (options.export) {
        return await this.exportConfigs(options.export, options);
      }

      if (options.import) {
        return await this.importConfigs(options.import, options);
      }

      if (options.validate) {
        return await this.validateConfigs(options);
      }

      // Default: show config menu
      return await this.showConfigMenu();
    } catch (error) {
      this.emit('error', { error });
      logger.error(chalk.red(`Config command failed: ${error.message}`));
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private async listConfigs(options: ConfigOptions): Promise<CommandResult> {
    const scope = this.getConfigScope(options);
    const configs = await this.configManager.getAll(scope);

    console.log(
      chalk.bold.blue(`\n⚙️  ${scope === 'global' ? 'Global' : 'Local'} Configuration\n`),
    );

    // Group configs by category
    const grouped = this.groupConfigsByCategory(configs);

    for (const [category, items] of Object.entries(grouped)) {
      console.log(chalk.bold.cyan(`${category}:`));

      for (const [key, value] of Object.entries(items)) {
        const configDef = this.configKeys[key];
        const displayValue = configDef?.sensitive ? '********' : JSON.stringify(value);
        const description = configDef?.description || '';

        console.log(
          `  ${chalk.white(key.padEnd(20))} ${chalk.green(displayValue.padEnd(20))} ${chalk.gray(description)}`,
        );
      }
      console.log();
    }

    return {
      success: true,
      data: configs,
    };
  }

  private groupConfigsByCategory(
    configs: Record<string, unknown>,
  ): Record<string, Record<string, unknown>> {
    const categories: Record<string, Record<string, unknown>> = {
      'AI Settings': {},
      'UI Settings': {},
      'Developer Settings': {},
      'Project Settings': {},
      'API Keys': {},
      Other: {},
    };

    for (const [key, value] of Object.entries(configs)) {
      let category = 'Other';

      if (key.includes('Key')) {
        category = 'API Keys';
      } else if (['defaultModel', 'temperature', 'maxTokens', 'stream'].includes(key)) {
        category = 'AI Settings';
      } else if (['theme', 'colors', 'animations'].includes(key)) {
        category = 'UI Settings';
      } else if (['debug', 'verbose', 'telemetry'].includes(key)) {
        category = 'Developer Settings';
      } else if (['projectPath', 'autoSave', 'autoFormat'].includes(key)) {
        category = 'Project Settings';
      }

      categories[category][key] = value;
    }

    // Remove empty categories
    return Object.fromEntries(
      Object.entries(categories).filter(([_, items]) => Object.keys(items).length > 0),
    );
  }

  private async getConfig(key: string, options: ConfigOptions): Promise<CommandResult> {
    const scope = this.getConfigScope(options);
    const value = await this.configManager.get(key, scope);

    if (value === undefined) {
      logger.warn(chalk.yellow(`Config key not found: ${key}`));
      return {
        success: false,
        data: { message: `Config key not found: ${key}` },
      };
    }

    const configDef = this.configKeys[key];
    const displayValue = configDef?.sensitive ? '********' : JSON.stringify(value);

    console.log(chalk.cyan(`${key}:`), chalk.green(displayValue));

    if (configDef?.description) {
      console.log(chalk.gray(`Description: ${configDef.description}`));
    }

    return {
      success: true,
      data: { [key]: value },
    };
  }

  private async setConfig(
    key: string,
    value: unknown,
    options: ConfigOptions,
  ): Promise<CommandResult> {
    const configDef = this.configKeys[key];

    if (!configDef) {
      const proceed = await this.promptConfirm(
        `Unknown config key "${key}". Do you want to set it anyway?`,
      );

      if (!proceed) {
        return {
          success: false,
          data: { message: 'Operation cancelled' },
        };
      }
    }

    // Parse value based on type
    let parsedValue = value;
    if (configDef) {
      parsedValue = this.parseValue(value, configDef.type);

      // Validate
      if (!configDef.validate(parsedValue)) {
        throw new Error(`Invalid value for ${key}: ${value}`);
      }
    }

    const scope = this.getConfigScope(options);
    await this.configManager.set(key, parsedValue, scope);

    const displayValue = configDef?.sensitive ? '********' : JSON.stringify(parsedValue);
    logger.info(chalk.green(`✅ Config set: ${key} = ${displayValue}`));

    return {
      success: true,
      data: { [key]: parsedValue },
    };
  }

  private parseValue(value: unknown, type: string): unknown {
    switch (type) {
      case 'boolean':
        return value === 'true' || value === true;
      case 'number':
        return parseFloat(value);
      case 'string':
        return String(value);
      default:
        return value;
    }
  }

  private async resetConfigs(options: ConfigOptions): Promise<CommandResult> {
    const proceed = await this.promptConfirm(
      'Are you sure you want to reset all configurations to defaults?',
    );

    if (!proceed) {
      return {
        success: false,
        data: { message: 'Reset cancelled' },
      };
    }

    const scope = this.getConfigScope(options);

    // Reset to defaults
    for (const [key, def] of Object.entries(this.configKeys)) {
      await this.configManager.set(key, def.default, scope);
    }

    logger.info(chalk.green('✅ Configuration reset to defaults'));

    return {
      success: true,
      data: { message: 'Configuration reset to defaults' },
    };
  }

  private async editConfig(options: ConfigOptions): Promise<CommandResult> {
    const scope = this.getConfigScope(options);
    const configPath = this.getConfigPath(scope);

    logger.info(chalk.blue(`Opening config file: ${configPath}`));

    // Open in default editor
    const { exec } = require('child_process');
    const editor = process.env.EDITOR || 'nano';

    return new Promise((resolve) => {
      exec(`${editor} ${configPath}`, (error: unknown) => {
        if (error) {
          logger.error(chalk.red(`Failed to open editor: ${error.message}`));
          resolve({
            success: false,
            error: error.message,
          });
        } else {
          logger.info(chalk.green('✅ Config file edited'));
          resolve({
            success: true,
            data: { message: 'Config file edited' },
          });
        }
      });
    });
  }

  private async exportConfigs(exportPath: string, options: ConfigOptions): Promise<CommandResult> {
    const scope = this.getConfigScope(options);
    const configs = await this.configManager.getAll(scope);

    // Remove sensitive data if not explicitly requested
    const exportData = { ...configs };
    for (const [key, def] of Object.entries(this.configKeys)) {
      if (def.sensitive && !options.value) {
        delete exportData[key];
      }
    }

    await this.fileSystem.writeFile(exportPath, JSON.stringify(exportData, null, 2));

    logger.info(chalk.green(`✅ Configuration exported to: ${exportPath}`));

    return {
      success: true,
      data: {
        path: exportPath,
        configCount: Object.keys(exportData).length,
      },
    };
  }

  private async importConfigs(importPath: string, options: ConfigOptions): Promise<CommandResult> {
    const content = await this.fileSystem.readFile(importPath);

    if (!content) {
      throw new Error(`Could not read file: ${importPath}`);
    }

    let configs: Record<string, unknown>;
    try {
      configs = JSON.parse(content);
    } catch (error) {
      throw new Error('Invalid JSON in config file');
    }

    const scope = this.getConfigScope(options);
    let imported = 0;
    let skipped = 0;

    for (const [key, value] of Object.entries(configs)) {
      const configDef = this.configKeys[key];

      if (configDef && configDef.validate(value)) {
        await this.configManager.set(key, value, scope);
        imported++;
      } else {
        logger.warn(chalk.yellow(`Skipped invalid config: ${key}`));
        skipped++;
      }
    }

    logger.info(chalk.green(`✅ Imported ${imported} configs, skipped ${skipped}`));

    return {
      success: true,
      data: {
        imported,
        skipped,
        total: imported + skipped,
      },
    };
  }

  private async validateConfigs(options: ConfigOptions): Promise<CommandResult> {
    const scope = this.getConfigScope(options);
    const configs = await this.configManager.getAll(scope);

    const issues: string[] = [];
    let valid = 0;
    let invalid = 0;

    for (const [key, value] of Object.entries(configs)) {
      const configDef = this.configKeys[key];

      if (!configDef) {
        issues.push(`Unknown config key: ${key}`);
        invalid++;
      } else if (!configDef.validate(value)) {
        issues.push(`Invalid value for ${key}: ${JSON.stringify(value)}`);
        invalid++;
      } else {
        valid++;
      }
    }

    if (issues.length > 0) {
      console.log(chalk.yellow('\n⚠️  Configuration Issues:\n'));
      issues.forEach((issue) => console.log(chalk.red(`  • ${issue}`)));
    } else {
      console.log(chalk.green('\n✅ All configurations are valid'));
    }

    console.log(chalk.gray(`\nValid: ${valid}, Invalid: ${invalid}`));

    return {
      success: invalid === 0,
      data: {
        valid,
        invalid,
        issues,
      },
    };
  }

  private async showConfigMenu(): Promise<CommandResult> {
    console.log(chalk.bold.blue('\n⚙️  Configuration Management\n'));

    const options = [
      '1. List all configurations',
      '2. Get a config value',
      '3. Set a config value',
      '4. Reset to defaults',
      '5. Edit config file',
      '6. Export configurations',
      '7. Import configurations',
      '8. Validate configurations',
    ];

    options.forEach((opt) => console.log(chalk.cyan(opt)));

    console.log(chalk.gray('\nUse /config <option> to select'));
    console.log(chalk.gray('Example: /config list'));

    return {
      success: true,
      data: { menu: true },
    };
  }

  private getConfigScope(options: ConfigOptions): 'global' | 'local' {
    if (options.global) return 'global';
    if (options.local) return 'local';
    return 'global'; // Default to global
  }

  private getConfigPath(scope: 'global' | 'local'): string {
    if (scope === 'global') {
      return path.join(os.homedir(), '.maria', 'config.json');
    } else {
      return path.join(process.cwd(), '.maria-config.json');
    }
  }

  private async promptConfirm(message: string): Promise<boolean> {
    // This would be replaced with actual prompt implementation
    console.log(chalk.yellow(message));
    return true; // For now, always confirm
  }

  async help(): Promise<string> {
    return `
${chalk.bold.blue('Configuration Management')}

${chalk.yellow('Usage:')}
  /config                       # Show config menu
  /config list                  # List all configs
  /config get <key>             # Get config value
  /config set <key> <value>     # Set config value
  /config reset                 # Reset to defaults
  /config edit                  # Edit config file
  /config export <path>         # Export configs
  /config import <path>         # Import configs
  /config validate              # Validate configs

${chalk.yellow('Options:')}
  --global              Use global config (default)
  --local               Use local project config

${chalk.yellow('Examples:')}
  /config list
  /config get defaultModel
  /config set temperature 0.8
  /config set theme dark
  /config reset --local
  /config export ./my-config.json
  /config import ./shared-config.json

${chalk.yellow('Config Keys:')}
  ${Object.entries(this.configKeys)
    .map(([key, def]) => `• ${key} (${def.type}): ${def.description}`)
    .join('\n  ')}
    `;
  }
}
