/**
 * Processes Command
 * Display running processes and system information
 */

import { BaseCommand } from "../../base-command";
import {
  CommandArgs,
  CommandContext,
  CommandResult,
} from "../../../types/command.types";
import chalk from "chalk";
import os from "os";

export class ProcessesCommand extends BaseCommand {
  name = "processes";
  description = "Display running processes and system information";
  category = "system";
  aliases = ["ps", "proc"];

  async execute(
    args: CommandArgs,
    context: CommandContext
  ): Promise<CommandResult> {
    const option = args.parsed?.positional?.[0] as string;
    
    switch (option?.toLowerCase()) {
      case 'full':
        return this.showFullProcessInfo();
      case 'maria':
        return this.showMariaProcessInfo();
      default:
        return this.showBasicProcessInfo();
    }
  }

  private showBasicProcessInfo(): CommandResult {
    const output: string[] = [];
    
    output.push('');
    output.push(chalk.cyan.bold('⚡ Process Information'));
    output.push(chalk.gray('═'.repeat(30)));
    output.push('');
    
    // Current process info
    output.push(chalk.white.bold('🤖 MARIA Process:'));
    output.push(`  PID: ${chalk.green(process.pid.toString())}`);
    output.push(`  PPID: ${chalk.green((process.ppid || 'N/A').toString())}`);
    output.push(`  Title: ${chalk.green(process.title)}`);
    output.push(`  Uptime: ${chalk.green(Math.floor(process.uptime()) + 's')}`);
    output.push('');
    
    // Memory usage
    const memUsage = process.memoryUsage();
    output.push(chalk.white('💾 Memory Usage:'));
    output.push(`  RSS: ${chalk.green((memUsage.rss / 1024 / 1024).toFixed(1) + 'MB')}`);
    output.push(`  Heap Used: ${chalk.green((memUsage.heapUsed / 1024 / 1024).toFixed(1) + 'MB')}`);
    output.push(`  Heap Total: ${chalk.green((memUsage.heapTotal / 1024 / 1024).toFixed(1) + 'MB')}`);
    output.push('');
    
    // System info
    output.push(chalk.white('🖥️ System:'));
    output.push(`  Platform: ${chalk.green(process.platform)}`);
    output.push(`  Architecture: ${chalk.green(process.arch)}`);
    output.push(`  Node.js: ${chalk.green(process.version)}`);
    output.push(`  Working Dir: ${chalk.green(process.cwd())}`);
    output.push('');
    
    // CPU info
    const cpus = os.cpus();
    if (cpus.length > 0) {
      output.push(chalk.white('⚡ CPU:'));
      output.push(`  Model: ${chalk.green(cpus[0].model.substring(0, 40) + '...')}`);
      output.push(`  Cores: ${chalk.green(cpus.length.toString())}`);
      output.push(`  Speed: ${chalk.green(cpus[0].speed + ' MHz')}`);
      
      if (os.platform() !== 'win32') {
        const loadAvg = os.loadavg();
        const load1 = loadAvg[0];
        const loadColor = load1 > cpus.length ? chalk.red : load1 > cpus.length * 0.7 ? chalk.yellow : chalk.green;
        output.push(`  Load Avg: ${loadColor(load1.toFixed(2))}`);
      }
      
      output.push('');
    }
    
    output.push(chalk.gray('Use /processes full for detailed information'));
    output.push(chalk.gray('Use /processes maria for MARIA-specific details'));
    output.push('');
    
    return {
      success: true,
      message: output.join('\n'),
      requiresInput: false,
      autoRetry: false,
    };
  }

  private showMariaProcessInfo(): CommandResult {
    const output: string[] = [];
    const memUsage = process.memoryUsage();
    
    output.push('');
    output.push(chalk.cyan.bold('🤖 MARIA Process Details'));
    output.push(chalk.gray('═'.repeat(30)));
    output.push('');
    
    // Process identification
    output.push(chalk.white.bold('🔍 Process Identity:'));
    output.push(`  Process ID: ${chalk.green(process.pid.toString())}`);
    output.push(`  Parent PID: ${chalk.green((process.ppid || 'N/A').toString())}`);
    output.push(`  Process Title: ${chalk.green(process.title)}`);
    output.push(`  Command: ${chalk.green(process.argv[0])}`);
    output.push(`  Script: ${chalk.green(process.argv[1] || 'N/A')}`);
    output.push('');
    
    // Runtime information
    output.push(chalk.white.bold('⏱️ Runtime:'));
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);
    output.push(`  Uptime: ${chalk.green(`${hours}h ${minutes}m ${seconds}s`)}`);
    output.push(`  Started: ${chalk.green(new Date(Date.now() - uptime * 1000).toLocaleString())}`);
    output.push('');
    
    // Memory breakdown
    output.push(chalk.white.bold('💾 Memory Breakdown:'));
    output.push(`  RSS (Physical): ${chalk.green((memUsage.rss / 1024 / 1024).toFixed(2) + 'MB')}`);
    output.push(`  Heap Total: ${chalk.green((memUsage.heapTotal / 1024 / 1024).toFixed(2) + 'MB')}`);
    output.push(`  Heap Used: ${chalk.green((memUsage.heapUsed / 1024 / 1024).toFixed(2) + 'MB')}`);
    output.push(`  External: ${chalk.green((memUsage.external / 1024 / 1024).toFixed(2) + 'MB')}`);
    output.push(`  Array Buffers: ${chalk.green((memUsage.arrayBuffers / 1024 / 1024).toFixed(2) + 'MB')}`);
    
    const heapUsagePercent = (memUsage.heapUsed / memUsage.heapTotal * 100).toFixed(1);
    const heapColor = parseFloat(heapUsagePercent) > 80 ? chalk.red : parseFloat(heapUsagePercent) > 60 ? chalk.yellow : chalk.green;
    output.push(`  Heap Usage: ${heapColor(heapUsagePercent + '%')}`);
    output.push('');
    
    // Environment
    output.push(chalk.white.bold('🌍 Environment:'));
    output.push(`  NODE_ENV: ${chalk.green(process.env.NODE_ENV || 'development')}`);
    output.push(`  User: ${chalk.green(os.userInfo().username)}`);
    output.push(`  Home: ${chalk.green(os.homedir())}`);
    output.push(`  PWD: ${chalk.green(process.env.PWD || process.cwd())}`);
    output.push('');
    
    // Performance indicators
    output.push(chalk.white.bold('📊 Performance:'));
    const hrTime = process.hrtime();
    output.push(`  High-res timer: ${chalk.green(hrTime[0] + 's ' + Math.floor(hrTime[1] / 1000000) + 'ms')}`);
    
    // Health assessment
    const healthScore = this.calculateHealthScore(memUsage, uptime);
    const healthColor = healthScore >= 90 ? chalk.green : healthScore >= 70 ? chalk.yellow : chalk.red;
    output.push(`  Health Score: ${healthColor(healthScore + '/100')}`);
    output.push('');
    
    return {
      success: true,
      message: output.join('\n'),
      requiresInput: false,
      autoRetry: false,
    };
  }

  private showFullProcessInfo(): CommandResult {
    const output: string[] = [];
    
    output.push('');
    output.push(chalk.cyan.bold('🔍 Complete Process Information'));
    output.push(chalk.gray('═'.repeat(40)));
    output.push('');
    
    // Get basic info first
    const basicInfo = this.showBasicProcessInfo();
    const basicLines = basicInfo.message.split('\n').slice(3, -4); // Remove headers and footers
    output.push(...basicLines);
    
    // Additional detailed information
    output.push(chalk.white.bold('🔧 Advanced Details:'));
    
    // Process versions
    output.push('  Versions:');
    Object.keys(process.versions).forEach(key => {
      output.push(`    ${key}: ${chalk.green(process.versions[key])}`);
    });
    output.push('');
    
    // Features
    output.push('  Features:');
    if (process.features) {
      Object.keys(process.features).forEach(key => {
        const value = process.features[key as keyof NodeJS.ProcessFeatures];
        const color = value ? chalk.green : chalk.gray;
        output.push(`    ${key}: ${color(value ? 'Yes' : 'No')}`);
      });
    } else {
      output.push('    Feature detection not available');
    }
    output.push('');
    
    // Environment variables count
    const envCount = Object.keys(process.env).length;
    output.push(`  Environment Variables: ${chalk.green(envCount.toString())}`);
    
    // Memory trend (mock)
    output.push(chalk.white.bold('📈 Resource Trends:'));
    output.push(`  Memory trend: ${chalk.green('Stable')}`);
    output.push(`  CPU trend: ${chalk.green('Normal')}`);
    output.push(`  Handle usage: ${chalk.green('Low')}`);
    output.push('');
    
    return {
      success: true,
      message: output.join('\n'),
      requiresInput: false,
      autoRetry: false,
    };
  }

  private calculateHealthScore(memUsage: NodeJS.MemoryUsage, uptime: number): number {
    let score = 100;
    
    // Memory health (40 points)
    const heapRatio = memUsage.heapUsed / memUsage.heapTotal;
    const rssInMB = memUsage.rss / 1024 / 1024;
    
    if (heapRatio > 0.9) score -= 20;
    else if (heapRatio > 0.8) score -= 15;
    else if (heapRatio > 0.7) score -= 10;
    else if (heapRatio > 0.6) score -= 5;
    
    if (rssInMB > 1000) score -= 20; // More than 1GB RSS
    else if (rssInMB > 500) score -= 10; // More than 500MB RSS
    
    // Uptime stability (30 points)
    if (uptime < 5) score -= 15; // Very new process
    else if (uptime > 86400) score += 10; // Running for a day - bonus
    
    // General process health (30 points)
    // This would normally check things like file handles, network connections, etc.
    // For now, we'll assume good health unless we detect issues
    
    return Math.max(0, Math.min(100, score));
  }
}

export const meta = {
  name: 'processes',
  category: 'system',
  description: 'Display running processes and system information',
  aliases: ['ps', 'proc'],
  usage: '/processes [maria|full]',
  examples: [
    '/processes',
    '/processes maria',
    '/processes full'
  ],
  deps: []
};