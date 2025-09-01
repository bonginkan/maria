/**
 * System Status Command
 * Display current system status and health information
 */

import { BaseCommand } from "../../base-command";
import {
  CommandArgs,
  CommandContext,
  CommandResult,
} from "../../../types/command.types";
import { logger } from "../../../utils/logger";
import chalk from "chalk";
import os from "os";

export class StatusCommand extends BaseCommand {
  name = "status";
  description = "Display current system status and health information";
  category = "system";
  aliases = ["health", "info"];

  async execute(
    args: CommandArgs,
    context: CommandContext
  ): Promise<CommandResult> {
    try {
      const systemInfo = this.getSystemInfo();
      const healthStatus = this.getHealthStatus();
      
      const output: string[] = [];
      
      output.push('');
      output.push(chalk.cyan.bold('🔧 MARIA System Status'));
      output.push(chalk.gray('═'.repeat(40)));
      output.push('');
      
      // System Information
      output.push(chalk.white('📊 System Information:'));
      output.push(`  Platform: ${systemInfo.platform}`);
      output.push(`  Node.js: ${systemInfo.nodeVersion}`);
      output.push(`  Memory: ${systemInfo.memory.used}MB / ${systemInfo.memory.total}MB`);
      output.push(`  Uptime: ${systemInfo.uptime}`);
      output.push('');
      
      // Health Status
      output.push(chalk.white('💚 Health Status:'));
      output.push(`  Core System: ${healthStatus.core ? '✅' : '❌'}`);
      output.push(`  Commands: ${healthStatus.commands ? '✅' : '❌'}`);
      output.push(`  Memory: ${healthStatus.memory ? '✅' : '❌'}`);
      output.push('');
      
      output.push(chalk.green('🎯 System is operational'));
      
      return {
        success: true,
        message: output.join('\n'),
        requiresInput: false,
        autoRetry: false,
      };
    } catch (error) {
      logger.error("Status command failed:", error);
      return {
        success: false,
        message: `Failed to get system status: ${error instanceof Error ? error.message : 'Unknown error'}`,
        requiresInput: false,
        autoRetry: false,
      };
    }
  }

  private getSystemInfo() {
    const totalMem = Math.round(os.totalmem() / 1024 / 1024);
    const freeMem = Math.round(os.freemem() / 1024 / 1024);
    const usedMem = totalMem - freeMem;
    
    return {
      platform: `${os.platform()} ${os.arch()}`,
      nodeVersion: process.version,
      memory: {
        total: totalMem,
        used: usedMem,
        free: freeMem
      },
      uptime: this.formatUptime(os.uptime())
    };
  }

  private getHealthStatus() {
    return {
      core: true, // System is running
      commands: true, // Commands are accessible
      memory: os.freemem() > 100 * 1024 * 1024 // At least 100MB free
    };
  }

  private formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }

  async handleError(error: Error): Promise<CommandResult> {
    return {
      success: false,
      message: `System status check failed: ${error.message}`,
      requiresInput: false,
      autoRetry: false,
    };
  }
}

export const meta = {
  name: 'status',
  category: 'system',
  description: 'Display current system status and health information',
  aliases: ['health', 'info'],
  usage: '/status',
  examples: [
    '/status'
  ],
  deps: []
};