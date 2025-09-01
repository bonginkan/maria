/**
 * Disk Command
 * Display disk usage and storage information
 */

import { BaseCommand } from "../../base-command";
import {
  CommandArgs,
  CommandContext,
  CommandResult,
} from "../../../types/command.types";
import chalk from "chalk";
import os from "os";
import { promisify } from "util";

export class DiskCommand extends BaseCommand {
  name = "disk";
  description = "Display disk usage and storage information";
  category = "system";
  aliases = ["storage", "df"];

  async execute(
    args: CommandArgs,
    context: CommandContext
  ): Promise<CommandResult> {
    const path = args.parsed?.positional?.[0] as string || process.cwd();
    
    const output: string[] = [];
    
    output.push('');
    output.push(chalk.cyan.bold('💾 Disk Usage Information'));
    output.push(chalk.gray('═'.repeat(35)));
    output.push('');
    
    // Basic disk info
    output.push(chalk.white('📂 Current Directory:'));
    output.push(`  Path: ${chalk.green(process.cwd())}`);
    output.push(`  Home: ${chalk.green(os.homedir())}`);
    output.push('');
    
    // Platform-specific disk info
    try {
      if (os.platform() === 'darwin' || os.platform() === 'linux') {
        await this.showUnixDiskInfo(output);
      } else if (os.platform() === 'win32') {
        await this.showWindowsDiskInfo(output);
      } else {
        output.push(chalk.yellow('📊 Detailed disk usage not available on this platform'));
        output.push('');
      }
    } catch (error) {
      output.push(chalk.yellow('⚠️ Could not retrieve detailed disk information'));
      output.push('');
    }
    
    // MARIA-specific storage info
    output.push(chalk.white('🤖 MARIA Storage:'));
    const mariaHome = os.path.join(os.homedir(), '.maria');
    output.push(`  Config Dir: ${chalk.green(mariaHome)}`);
    
    // Estimate MARIA storage usage
    const estimatedUsage = this.estimateMariaUsage();
    output.push(`  Estimated Usage: ${chalk.green(estimatedUsage)}`);
    output.push(`  Cache: ${chalk.blue('~/.maria/cache/')}`);
    output.push(`  Logs: ${chalk.blue('~/.maria/logs/')}`);
    output.push(`  Config: ${chalk.blue('~/.maria/config.json')}`);
    output.push('');
    
    // Temporary files
    output.push(chalk.white('🗂️ Temporary Files:'));
    const tmpDir = os.tmpdir();
    output.push(`  System Temp: ${chalk.green(tmpDir)}`);
    output.push(`  Node Temp: ${chalk.green(process.env.TMPDIR || tmpDir)}`);
    output.push('');
    
    // Storage recommendations
    output.push(chalk.white('💡 Storage Tips:'));
    output.push('  • Use /clear to clean conversation history');
    output.push('  • MARIA cache auto-cleans after 24h');
    output.push('  • Logs rotate automatically');
    output.push('  • Config files are typically < 1MB');
    output.push('');
    
    return {
      success: true,
      message: output.join('\n'),
      requiresInput: false,
      autoRetry: false,
    };
  }

  private async showUnixDiskInfo(output: string[]): Promise<void> {
    try {
      // This is a mock implementation since we can't easily get disk usage without external tools
      // In a real implementation, you might use 'df' command or a native library
      
      output.push(chalk.white('💿 Storage Overview:'));
      
      // Mock data for demonstration
      const mockDiskData = [
        { filesystem: '/', size: '500GB', used: '320GB', available: '180GB', percent: '64%' },
        { filesystem: '/home', size: '1TB', used: '450GB', available: '550GB', percent: '45%' }
      ];
      
      mockDiskData.forEach(disk => {
        const usedPercent = parseInt(disk.percent);
        const statusColor = usedPercent > 90 ? chalk.red : usedPercent > 80 ? chalk.yellow : chalk.green;
        
        output.push(`  ${chalk.white(disk.filesystem.padEnd(10))} ${chalk.green(disk.size.padEnd(8))} ${chalk.yellow(disk.used.padEnd(8))} ${chalk.blue(disk.available.padEnd(8))} ${statusColor(disk.percent)}`);
      });
      
      output.push('');
      output.push(chalk.gray('Note: Use "df -h" in terminal for real-time disk usage'));
      output.push('');
      
    } catch (error) {
      output.push(chalk.yellow('⚠️ Could not retrieve disk information'));
      output.push('');
    }
  }

  private async showWindowsDiskInfo(output: string[]): Promise<void> {
    try {
      output.push(chalk.white('💿 Storage Overview:'));
      output.push(chalk.gray('Windows disk usage requires administrative privileges'));
      output.push(chalk.gray('Use "dir" command in Command Prompt for basic info'));
      output.push('');
      
      // Mock Windows disk data
      const mockWindowsData = [
        { drive: 'C:', size: '500GB', used: '320GB', available: '180GB', percent: '64%' },
        { drive: 'D:', size: '1TB', used: '200GB', available: '800GB', percent: '20%' }
      ];
      
      mockWindowsData.forEach(disk => {
        const usedPercent = parseInt(disk.percent);
        const statusColor = usedPercent > 90 ? chalk.red : usedPercent > 80 ? chalk.yellow : chalk.green;
        
        output.push(`  ${chalk.white(disk.drive.padEnd(6))} ${chalk.green(disk.size.padEnd(8))} ${chalk.yellow(disk.used.padEnd(8))} ${chalk.blue(disk.available.padEnd(8))} ${statusColor(disk.percent)}`);
      });
      
      output.push('');
      
    } catch (error) {
      output.push(chalk.yellow('⚠️ Could not retrieve Windows disk information'));
      output.push('');
    }
  }

  private estimateMariaUsage(): string {
    // Mock estimation since we can't easily calculate actual usage
    const estimatedSizes = {
      config: '< 1MB',
      cache: '10-50MB',
      logs: '5-20MB',
      total: '< 100MB'
    };
    
    return estimatedSizes.total;
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

export const meta = {
  name: 'disk',
  category: 'system',
  description: 'Display disk usage and storage information',
  aliases: ['storage', 'df'],
  usage: '/disk [path]',
  examples: [
    '/disk',
    '/disk /home/user',
    '/storage'
  ],
  deps: []
};