/**
 * Environment Command
 * Display environment information and variables
 */

import { BaseCommand } from "../../base-command";
import {
  CommandArgs,
  CommandContext,
  CommandResult,
} from "../../../types/command.types";
import chalk from "chalk";
import os from "os";

export class EnvCommand extends BaseCommand {
  name = "env";
  description = "Display environment information and variables";
  category = "system";
  aliases = ["environment", "vars"];

  async execute(
    args: CommandArgs,
    context: CommandContext
  ): Promise<CommandResult> {
    const filter = args.parsed?.positional?.[0] as string;
    
    if (filter) {
      return this.showFilteredEnv(filter);
    }
    
    return this.showSystemEnv();
  }

  private showSystemEnv(): CommandResult {
    const output: string[] = [];
    
    output.push('');
    output.push(chalk.cyan.bold('🌍 Environment Information'));
    output.push(chalk.gray('═'.repeat(35)));
    output.push('');
    
    output.push(chalk.white('🖥️ System:'));
    output.push(`  Node.js: ${chalk.green(process.version)}`);
    output.push(`  Platform: ${chalk.green(os.platform())} ${chalk.green(os.arch())}`);
    output.push(`  OS: ${chalk.green(os.type())} ${chalk.green(os.release())}`);
    output.push(`  Uptime: ${chalk.green(Math.floor(os.uptime() / 60))} minutes`);
    output.push('');
    
    output.push(chalk.white('💾 Memory:'));
    const totalMem = (os.totalmem() / 1024 / 1024 / 1024).toFixed(1);
    const freeMem = (os.freemem() / 1024 / 1024 / 1024).toFixed(1);
    output.push(`  Total: ${chalk.green(totalMem + 'GB')}`);
    output.push(`  Free: ${chalk.green(freeMem + 'GB')}`);
    output.push('');
    
    output.push(chalk.white('🔧 MARIA Environment:'));
    output.push(`  NODE_ENV: ${chalk.green(process.env.NODE_ENV || 'development')}`);
    output.push(`  PWD: ${chalk.green(process.env.PWD || process.cwd())}`);
    output.push(`  Shell: ${chalk.green(process.env.SHELL || 'unknown')}`);
    output.push(`  Home: ${chalk.green(os.homedir())}`);
    output.push('');
    
    output.push(chalk.gray('Use /env [filter] to search for specific variables'));
    output.push('');
    
    return {
      success: true,
      message: output.join('\n'),
      requiresInput: false,
      autoRetry: false,
    };
  }

  private showFilteredEnv(filter: string): CommandResult {
    const output: string[] = [];
    const filteredVars: Array<[string, string]> = [];
    
    // Filter environment variables (case-insensitive)
    const filterLower = filter.toLowerCase();
    for (const [key, value] of Object.entries(process.env)) {
      if (key.toLowerCase().includes(filterLower)) {
        filteredVars.push([key, value || '']);
      }
    }
    
    output.push('');
    output.push(chalk.cyan.bold(`🔍 Environment Variables (filter: ${filter})`));
    output.push(chalk.gray('═'.repeat(40)));
    output.push('');
    
    if (filteredVars.length === 0) {
      output.push(chalk.yellow('No environment variables match the filter.'));
    } else {
      filteredVars.slice(0, 20).forEach(([key, value]) => {
        // Mask sensitive values
        const displayValue = this.isSensitiveKey(key) 
          ? '***MASKED***' 
          : value.length > 50 ? value.substring(0, 47) + '...' : value;
        
        output.push(`${chalk.white(key)}: ${chalk.green(displayValue)}`);
      });
      
      if (filteredVars.length > 20) {
        output.push('');
        output.push(chalk.gray(`... and ${filteredVars.length - 20} more`));
      }
    }
    
    output.push('');
    
    return {
      success: true,
      message: output.join('\n'),
      requiresInput: false,
      autoRetry: false,
    };
  }

  private isSensitiveKey(key: string): boolean {
    const sensitivePatterns = [
      'key', 'secret', 'token', 'password', 'pwd',
      'auth', 'credential', 'private', 'api'
    ];
    
    const keyLower = key.toLowerCase();
    return sensitivePatterns.some(pattern => keyLower.includes(pattern));
  }
}

export const meta = {
  name: 'env',
  category: 'system',
  description: 'Display environment information and variables',
  aliases: ['environment', 'vars'],
  usage: '/env [filter]',
  examples: [
    '/env',
    '/env node',
    '/env path'
  ],
  deps: []
};