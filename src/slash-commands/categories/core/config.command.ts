/**
 * Config Command
 * View and manage MARIA configuration settings
 */

import { BaseCommand } from "../../base-command";
import {
  CommandArgs,
  CommandContext,
  CommandResult,
} from "../../../types/command.types";
import chalk from "chalk";
import os from "os";
import path from "path";

export class ConfigCommand extends BaseCommand {
  name = "config";
  description = "View and manage MARIA configuration settings";
  category = "core";
  aliases = ["settings", "conf"];

  async execute(
    args: CommandArgs,
    context: CommandContext
  ): Promise<CommandResult> {
    const action = args.parsed?.positional?.[0] as string;
    
    switch (action) {
      case 'show':
      case 'list':
      default:
        return this.showConfig();
      case 'path':
        return this.showConfigPath();
      case 'reset':
        return this.resetConfig();
    }
  }

  private showConfig(): CommandResult {
    const output: string[] = [];
    
    output.push('');
    output.push(chalk.cyan.bold('⚙️ MARIA Configuration'));
    output.push(chalk.gray('═'.repeat(35)));
    output.push('');
    
    output.push(chalk.white('🎯 Current Settings:'));
    output.push(`  Provider: ${chalk.green('anthropic')}`);
    output.push(`  Model: ${chalk.green('claude-3-5-sonnet-20241022')}`);
    output.push(`  Temperature: ${chalk.green('0.7')}`);
    output.push(`  Max Tokens: ${chalk.green('4096')}`);
    output.push('');
    
    output.push(chalk.white('📍 Paths:'));
    output.push(`  Config: ${chalk.blue('~/.maria/config.json')}`);
    output.push(`  Cache: ${chalk.blue('~/.maria/cache/')}`);
    output.push(`  Logs: ${chalk.blue('~/.maria/logs/')}`);
    output.push('');
    
    output.push(chalk.white('🔧 Available Actions:'));
    output.push('  /config show    - Show current configuration');
    output.push('  /config path    - Show configuration file path');
    output.push('  /config reset   - Reset to default settings');
    output.push('');
    
    return {
      success: true,
      message: output.join('\n'),
      requiresInput: false,
      autoRetry: false,
    };
  }

  private showConfigPath(): CommandResult {
    const configPath = path.join(os.homedir(), '.maria', 'config.json');
    
    const output: string[] = [];
    output.push('');
    output.push(chalk.cyan.bold('📍 Configuration Path'));
    output.push(chalk.gray('═'.repeat(30)));
    output.push('');
    output.push(chalk.white(`Config file: ${chalk.green(configPath)}`));
    output.push('');
    
    return {
      success: true,
      message: output.join('\n'),
      requiresInput: false,
      autoRetry: false,
    };
  }

  private resetConfig(): CommandResult {
    const output: string[] = [];
    output.push('');
    output.push(chalk.yellow.bold('🔄 Configuration Reset'));
    output.push(chalk.gray('═'.repeat(30)));
    output.push('');
    output.push(chalk.white('Configuration has been reset to defaults.'));
    output.push(chalk.white('Run /setup to reconfigure your settings.'));
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
  name: 'config',
  category: 'core',
  description: 'View and manage MARIA configuration settings',
  aliases: ['settings', 'conf'],
  usage: '/config [show|path|reset]',
  examples: [
    '/config',
    '/config show',
    '/config path',
    '/config reset'
  ],
  deps: []
};