/**
 * Performance Command
 * Display system performance metrics and analysis
 */

import { BaseCommand } from "../../base-command";
import {
  CommandArgs,
  CommandContext,
  CommandResult,
} from "../../../types/command.types";
import chalk from "chalk";
import os from "os";

export class PerformanceCommand extends BaseCommand {
  name = "performance";
  description = "Display system performance metrics and analysis";
  category = "system";
  aliases = ["perf", "metrics", "stats"];

  async execute(
    args: CommandArgs,
    context: CommandContext
  ): Promise<CommandResult> {
    const level = args.parsed?.positional?.[0] as string;
    
    switch (level?.toLowerCase()) {
      case 'cpu':
        return this.showCpuPerformance();
      case 'memory':
      case 'mem':
        return this.showMemoryPerformance();
      case 'full':
        return this.showFullPerformance();
      default:
        return this.showBasicPerformance();
    }
  }

  private showBasicPerformance(): CommandResult {
    const output: string[] = [];
    const memUsage = process.memoryUsage();
    const cpus = os.cpus();
    const loadAvg = os.loadavg();
    
    output.push('');
    output.push(chalk.cyan.bold('📊 Performance Overview'));
    output.push(chalk.gray('═'.repeat(30)));
    output.push('');
    
    // CPU Overview
    output.push(chalk.white('⚡ CPU:'));
    output.push(`  Model: ${chalk.green(cpus[0]?.model.substring(0, 40) + '...' || 'Unknown')}`);
    output.push(`  Cores: ${chalk.green(cpus.length.toString())}`);
    output.push(`  Speed: ${chalk.green((cpus[0]?.speed || 0) + ' MHz')}`);
    output.push('');
    
    // Load Average (Unix only)
    if (os.platform() !== 'win32') {
      output.push(chalk.white('📈 Load Average:'));
      output.push(`  1min: ${chalk.green(loadAvg[0].toFixed(2))} | 5min: ${chalk.green(loadAvg[1].toFixed(2))} | 15min: ${chalk.green(loadAvg[2].toFixed(2))}`);
      
      const load1 = loadAvg[0];
      const healthColor = load1 > cpus.length * 0.8 ? chalk.red : load1 > cpus.length * 0.5 ? chalk.yellow : chalk.green;
      output.push(`  Status: ${healthColor(this.getLoadStatus(load1, cpus.length))}`);
      output.push('');
    }
    
    // Memory Overview
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memPercent = (usedMem / totalMem * 100).toFixed(1);
    
    output.push(chalk.white('💾 System Memory:'));
    output.push(`  Used: ${chalk.green((usedMem / 1024 / 1024 / 1024).toFixed(1) + 'GB')} (${memPercent}%)`);
    output.push(`  Total: ${chalk.green((totalMem / 1024 / 1024 / 1024).toFixed(1) + 'GB')}`);
    
    const memColor = parseFloat(memPercent) > 90 ? chalk.red : parseFloat(memPercent) > 75 ? chalk.yellow : chalk.green;
    output.push(`  Status: ${memColor(this.getMemoryStatus(parseFloat(memPercent)))}`);
    output.push('');
    
    // Process Memory
    output.push(chalk.white('🔧 MARIA Process:'));
    output.push(`  Heap: ${chalk.green((memUsage.heapUsed / 1024 / 1024).toFixed(1) + 'MB')}`);
    output.push(`  RSS: ${chalk.green((memUsage.rss / 1024 / 1024).toFixed(1) + 'MB')}`);
    output.push(`  Uptime: ${chalk.green(Math.floor(process.uptime()) + 's')}`);
    output.push('');
    
    output.push(chalk.gray('Use /perf [cpu|memory|full] for detailed metrics'));
    output.push('');
    
    return {
      success: true,
      message: output.join('\n'),
      requiresInput: false,
      autoRetry: false,
    };
  }

  private showCpuPerformance(): CommandResult {
    const output: string[] = [];
    const cpus = os.cpus();
    const loadAvg = os.loadavg();
    
    output.push('');
    output.push(chalk.cyan.bold('⚡ CPU Performance Analysis'));
    output.push(chalk.gray('═'.repeat(35)));
    output.push('');
    
    output.push(chalk.white('🖥️ Processor Information:'));
    output.push(`  Model: ${chalk.green(cpus[0]?.model || 'Unknown')}`);
    output.push(`  Architecture: ${chalk.green(os.arch())}`);
    output.push(`  Cores: ${chalk.green(cpus.length.toString())}`);
    output.push(`  Base Speed: ${chalk.green((cpus[0]?.speed || 0) + ' MHz')}`);
    output.push('');
    
    if (os.platform() !== 'win32') {
      output.push(chalk.white('📊 Load Metrics:'));
      output.push(`  1 minute: ${chalk.green(loadAvg[0].toFixed(3))}`);
      output.push(`  5 minutes: ${chalk.green(loadAvg[1].toFixed(3))}`);
      output.push(`  15 minutes: ${chalk.green(loadAvg[2].toFixed(3))}`);
      output.push('');
      
      output.push(chalk.white('🎯 Load Analysis:'));
      const idealLoad = cpus.length;
      const currentLoad = loadAvg[0];
      const loadPercent = (currentLoad / idealLoad * 100).toFixed(1);
      
      output.push(`  Ideal Load: ${chalk.green(idealLoad.toFixed(1))}`);
      output.push(`  Current Load: ${chalk.green(currentLoad.toFixed(3))} (${loadPercent}%)`);
      output.push(`  Status: ${this.getLoadStatusColor(currentLoad, idealLoad)(this.getLoadStatus(currentLoad, idealLoad))}`);
      output.push('');
    }
    
    output.push(chalk.white('⏱️ Process Timing:'));
    const hrTime = process.hrtime();
    output.push(`  High-res time: ${chalk.green(hrTime[0] + 's ' + Math.floor(hrTime[1] / 1000000) + 'ms')}`);
    output.push(`  Process uptime: ${chalk.green(process.uptime().toFixed(2) + 's')}`);
    output.push('');
    
    return {
      success: true,
      message: output.join('\n'),
      requiresInput: false,
      autoRetry: false,
    };
  }

  private showMemoryPerformance(): CommandResult {
    const output: string[] = [];
    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    
    output.push('');
    output.push(chalk.cyan.bold('💾 Memory Performance Analysis'));
    output.push(chalk.gray('═'.repeat(35)));
    output.push('');
    
    output.push(chalk.white('🖥️ System Memory:'));
    output.push(`  Total: ${chalk.green((totalMem / 1024 / 1024 / 1024).toFixed(2) + 'GB')}`);
    output.push(`  Used: ${chalk.green((usedMem / 1024 / 1024 / 1024).toFixed(2) + 'GB')}`);
    output.push(`  Free: ${chalk.green((freeMem / 1024 / 1024 / 1024).toFixed(2) + 'GB')}`);
    output.push(`  Usage: ${chalk.green((usedMem / totalMem * 100).toFixed(1) + '%')}`);
    output.push('');
    
    output.push(chalk.white('⚡ Process Memory (MARIA):'));
    output.push(`  RSS (Physical): ${chalk.green((memUsage.rss / 1024 / 1024).toFixed(2) + 'MB')}`);
    output.push(`  Heap Total: ${chalk.green((memUsage.heapTotal / 1024 / 1024).toFixed(2) + 'MB')}`);
    output.push(`  Heap Used: ${chalk.green((memUsage.heapUsed / 1024 / 1024).toFixed(2) + 'MB')}`);
    output.push(`  External: ${chalk.green((memUsage.external / 1024 / 1024).toFixed(2) + 'MB')}`);
    output.push(`  Array Buffers: ${chalk.green((memUsage.arrayBuffers / 1024 / 1024).toFixed(2) + 'MB')}`);
    output.push('');
    
    output.push(chalk.white('📊 Memory Health:'));
    const heapRatio = (memUsage.heapUsed / memUsage.heapTotal * 100);
    const systemRatio = (usedMem / totalMem * 100);
    
    output.push(`  Heap Utilization: ${this.getMemoryStatusColor(heapRatio)(heapRatio.toFixed(1) + '%')}`);
    output.push(`  System Utilization: ${this.getMemoryStatusColor(systemRatio)(systemRatio.toFixed(1) + '%')}`);
    
    if (heapRatio > 90) {
      output.push(chalk.red('  ⚠️  High heap usage - consider restarting'));
    } else if (heapRatio > 75) {
      output.push(chalk.yellow('  ⚠️  Elevated heap usage'));
    } else {
      output.push(chalk.green('  ✅ Memory usage healthy'));
    }
    
    output.push('');
    
    return {
      success: true,
      message: output.join('\n'),
      requiresInput: false,
      autoRetry: false,
    };
  }

  private showFullPerformance(): CommandResult {
    const output: string[] = [];
    
    output.push('');
    output.push(chalk.cyan.bold('🚀 Complete Performance Report'));
    output.push(chalk.gray('═'.repeat(40)));
    output.push('');
    
    // Get all basic info first
    const basicReport = this.showBasicPerformance();
    const basicLines = basicReport.message.split('\n').slice(3, -3); // Remove headers and footers
    output.push(...basicLines);
    
    output.push(chalk.white('🔧 Advanced Metrics:'));
    const startTime = Date.now();
    
    // Simple performance test
    let iterations = 0;
    const testDuration = 10; // milliseconds
    const endTime = startTime + testDuration;
    
    while (Date.now() < endTime) {
      Math.sqrt(Math.random() * 1000000);
      iterations++;
    }
    
    const actualDuration = Date.now() - startTime;
    const operationsPerSecond = Math.floor((iterations / actualDuration) * 1000);
    
    output.push(`  Math Operations/sec: ${chalk.green(operationsPerSecond.toLocaleString())}`);
    output.push(`  Platform: ${chalk.green(os.platform())}`);
    output.push(`  Release: ${chalk.green(os.release())}`);
    output.push(`  Node.js: ${chalk.green(process.version)}`);
    output.push(`  V8: ${chalk.green(process.versions.v8)}`);
    output.push('');
    
    output.push(chalk.white('📈 Performance Score:'));
    const score = this.calculatePerformanceScore();
    const scoreColor = score >= 85 ? chalk.green : score >= 70 ? chalk.yellow : chalk.red;
    output.push(`  Overall: ${scoreColor(score + '/100')}`);
    output.push('');
    
    return {
      success: true,
      message: output.join('\n'),
      requiresInput: false,
      autoRetry: false,
    };
  }

  private getLoadStatus(load: number, cores: number): string {
    const ratio = load / cores;
    if (ratio < 0.5) return 'Low load';
    if (ratio < 0.8) return 'Normal load';
    if (ratio < 1.2) return 'High load';
    return 'Overloaded';
  }

  private getLoadStatusColor(load: number, cores: number) {
    const ratio = load / cores;
    if (ratio < 0.5) return chalk.green;
    if (ratio < 0.8) return chalk.green;
    if (ratio < 1.2) return chalk.yellow;
    return chalk.red;
  }

  private getMemoryStatus(percent: number): string {
    if (percent < 60) return 'Low usage';
    if (percent < 75) return 'Normal usage';
    if (percent < 90) return 'High usage';
    return 'Critical usage';
  }

  private getMemoryStatusColor(percent: number) {
    if (percent < 60) return chalk.green;
    if (percent < 75) return chalk.green;
    if (percent < 90) return chalk.yellow;
    return chalk.red;
  }

  private calculatePerformanceScore(): number {
    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const loadAvg = os.loadavg();
    const cpus = os.cpus();
    
    let score = 100;
    
    // Memory score (30 points)
    const systemMemPercent = ((totalMem - freeMem) / totalMem) * 100;
    const heapPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    
    if (systemMemPercent > 90) score -= 15;
    else if (systemMemPercent > 75) score -= 10;
    else if (systemMemPercent > 60) score -= 5;
    
    if (heapPercent > 90) score -= 15;
    else if (heapPercent > 75) score -= 10;
    else if (heapPercent > 60) score -= 5;
    
    // CPU score (40 points) - Unix only
    if (os.platform() !== 'win32' && loadAvg.length > 0) {
      const loadRatio = loadAvg[0] / cpus.length;
      if (loadRatio > 1.5) score -= 20;
      else if (loadRatio > 1.2) score -= 15;
      else if (loadRatio > 0.8) score -= 10;
      else if (loadRatio > 0.5) score -= 5;
    }
    
    // Process health (30 points)
    const processUptime = process.uptime();
    if (processUptime < 10) score -= 10; // Penalty for very new process
    
    return Math.max(0, Math.min(100, score));
  }
}

export const meta = {
  name: 'performance',
  category: 'system',
  description: 'Display system performance metrics and analysis',
  aliases: ['perf', 'metrics', 'stats'],
  usage: '/performance [cpu|memory|full]',
  examples: [
    '/performance',
    '/performance cpu',
    '/performance memory',
    '/performance full'
  ],
  deps: []
};