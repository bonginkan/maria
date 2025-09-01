/**
 * Uptime Command
 * Display system and process uptime information
 */

import { BaseCommand } from "../../base-command";
import {
  CommandArgs,
  CommandContext,
  CommandResult,
} from "../../../types/command.types";
import chalk from "chalk";
import os from "os";

export class UptimeCommand extends BaseCommand {
  name = "uptime";
  description = "Display system and process uptime information";
  category = "system";
  aliases = ["runtime"];

  async execute(
    args: CommandArgs,
    context: CommandContext
  ): Promise<CommandResult> {
    const systemUptimeSeconds = os.uptime();
    const processUptimeSeconds = process.uptime();
    
    const output: string[] = [];
    
    output.push('');
    output.push(chalk.cyan.bold('⏰ Uptime Information'));
    output.push(chalk.gray('═'.repeat(30)));
    output.push('');
    
    // System uptime
    const systemUptime = this.formatUptime(systemUptimeSeconds);
    output.push(chalk.white('🖥️ System Uptime:'));
    output.push(`  Total: ${chalk.green(systemUptime.formatted)}`);
    output.push(`  Since: ${chalk.green(new Date(Date.now() - systemUptimeSeconds * 1000).toLocaleString())}`);
    output.push('');
    
    // Process uptime  
    const processUptime = this.formatUptime(processUptimeSeconds);
    output.push(chalk.white('⚡ MARIA Process:'));
    output.push(`  Runtime: ${chalk.green(processUptime.formatted)}`);
    output.push(`  Started: ${chalk.green(new Date(Date.now() - processUptimeSeconds * 1000).toLocaleString())}`);
    output.push(`  PID: ${chalk.green(process.pid.toString())}`);
    output.push('');
    
    // Load averages (Unix systems only)
    if (os.platform() !== 'win32') {
      const loadAvg = os.loadavg();
      output.push(chalk.white('📊 System Load:'));
      output.push(`  1 min: ${chalk.green(loadAvg[0].toFixed(2))}`);
      output.push(`  5 min: ${chalk.green(loadAvg[1].toFixed(2))}`);
      output.push(`  15 min: ${chalk.green(loadAvg[2].toFixed(2))}`);
      output.push('');
    }
    
    // Memory info
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memUsagePercent = (usedMem / totalMem * 100).toFixed(1);
    
    output.push(chalk.white('💾 Memory Usage:'));
    output.push(`  Used: ${chalk.green((usedMem / 1024 / 1024 / 1024).toFixed(1) + 'GB')} (${memUsagePercent}%)`);
    output.push(`  Free: ${chalk.green((freeMem / 1024 / 1024 / 1024).toFixed(1) + 'GB')}`);
    output.push(`  Total: ${chalk.green((totalMem / 1024 / 1024 / 1024).toFixed(1) + 'GB')}`);
    output.push('');
    
    return {
      success: true,
      message: output.join('\n'),
      requiresInput: false,
      autoRetry: false,
    };
  }

  private formatUptime(seconds: number): { formatted: string; parts: { days: number; hours: number; minutes: number; seconds: number } } {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    const parts = { days, hours, minutes, seconds: secs };
    
    const formatParts: string[] = [];
    
    if (days > 0) {
      formatParts.push(`${days} day${days !== 1 ? 's' : ''}`);
    }
    if (hours > 0) {
      formatParts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
    }
    if (minutes > 0) {
      formatParts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
    }
    if (secs > 0 || formatParts.length === 0) {
      formatParts.push(`${secs} second${secs !== 1 ? 's' : ''}`);
    }
    
    const formatted = formatParts.join(', ');
    
    return { formatted, parts };
  }
}

export const meta = {
  name: 'uptime',
  category: 'system',
  description: 'Display system and process uptime information',
  aliases: ['runtime'],
  usage: '/uptime',
  examples: [
    '/uptime'
  ],
  deps: []
};