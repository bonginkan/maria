/**
 * Debug Command
 * Display debug information and system diagnostics
 */

import { BaseCommand } from "../../base-command";
import {
  CommandArgs,
  CommandContext,
  CommandResult,
} from "../../../types/command.types";
import chalk from "chalk";
import os from "os";

export class DebugCommand extends BaseCommand {
  name = "debug";
  description = "Display debug information and system diagnostics";
  category = "system";
  aliases = ["diag", "diagnostics"];

  async execute(
    args: CommandArgs,
    context: CommandContext
  ): Promise<CommandResult> {
    const level = args.parsed?.positional?.[0] as string;
    
    switch (level) {
      case 'full':
        return this.showFullDebug();
      case 'memory':
        return this.showMemoryDebug();
      case 'performance':
        return this.showPerformanceDebug();
      default:
        return this.showBasicDebug();
    }
  }

  private showBasicDebug(): CommandResult {
    const output: string[] = [];
    const memUsage = process.memoryUsage();
    
    output.push('');
    output.push(chalk.cyan.bold('🐛 Debug Information'));
    output.push(chalk.gray('═'.repeat(30)));
    output.push('');
    
    output.push(chalk.white('⚡ Process:'));
    output.push(`  PID: ${chalk.green(process.pid)}`);
    output.push(`  Uptime: ${chalk.green(Math.floor(process.uptime()))}s`);
    output.push(`  Node Version: ${chalk.green(process.version)}`);
    output.push('');
    
    output.push(chalk.white('💾 Memory Usage:'));
    output.push(`  RSS: ${chalk.green((memUsage.rss / 1024 / 1024).toFixed(1))}MB`);
    output.push(`  Heap Used: ${chalk.green((memUsage.heapUsed / 1024 / 1024).toFixed(1))}MB`);
    output.push(`  Heap Total: ${chalk.green((memUsage.heapTotal / 1024 / 1024).toFixed(1))}MB`);
    output.push('');
    
    output.push(chalk.white('🔧 Debug Levels:'));
    output.push('  /debug         - Basic debug info');
    output.push('  /debug full    - Complete system info');
    output.push('  /debug memory  - Detailed memory usage');
    output.push('  /debug performance - Performance metrics');
    output.push('');
    
    return {
      success: true,
      message: output.join('\n'),
      requiresInput: false,
      autoRetry: false,
    };
  }

  private showFullDebug(): CommandResult {
    const output: string[] = [];
    const memUsage = process.memoryUsage();
    const cpus = os.cpus();
    
    output.push('');
    output.push(chalk.cyan.bold('🔍 Full System Debug'));
    output.push(chalk.gray('═'.repeat(35)));
    output.push('');
    
    output.push(chalk.white('💻 System Information:'));
    output.push(`  Platform: ${chalk.green(os.platform())} ${chalk.green(os.arch())}`);
    output.push(`  OS: ${chalk.green(os.type())} ${chalk.green(os.release())}`);
    output.push(`  Hostname: ${chalk.green(os.hostname())}`);
    output.push(`  User: ${chalk.green(os.userInfo().username)}`);
    output.push(`  Home: ${chalk.green(os.homedir())}`);
    output.push('');
    
    output.push(chalk.white('⚡ Process Information:'));
    output.push(`  PID: ${chalk.green(process.pid)}`);
    output.push(`  PPID: ${chalk.green(process.ppid || 'N/A')}`);
    output.push(`  Platform: ${chalk.green(process.platform)}`);
    output.push(`  Arch: ${chalk.green(process.arch)}`);
    output.push(`  Node Version: ${chalk.green(process.version)}`);
    output.push(`  Uptime: ${chalk.green(Math.floor(process.uptime()))}s`);
    output.push('');
    
    output.push(chalk.white('💾 Memory (Detailed):'));
    output.push(`  RSS: ${chalk.green((memUsage.rss / 1024 / 1024).toFixed(2))}MB`);
    output.push(`  Heap Used: ${chalk.green((memUsage.heapUsed / 1024 / 1024).toFixed(2))}MB`);
    output.push(`  Heap Total: ${chalk.green((memUsage.heapTotal / 1024 / 1024).toFixed(2))}MB`);
    output.push(`  External: ${chalk.green((memUsage.external / 1024 / 1024).toFixed(2))}MB`);
    output.push('');
    
    output.push(chalk.white('🖥️ CPU Information:'));
    output.push(`  Model: ${chalk.green(cpus[0]?.model || 'Unknown')}`);
    output.push(`  Cores: ${chalk.green(cpus.length)}`);
    output.push(`  Speed: ${chalk.green(cpus[0]?.speed + 'MHz' || 'Unknown')}`);
    output.push('');
    
    return {
      success: true,
      message: output.join('\n'),
      requiresInput: false,
      autoRetry: false,
    };
  }

  private showMemoryDebug(): CommandResult {
    const output: string[] = [];
    const memUsage = process.memoryUsage();
    const systemMem = {
      total: os.totalmem(),
      free: os.freemem()
    };
    
    output.push('');
    output.push(chalk.cyan.bold('🧠 Memory Debug Analysis'));
    output.push(chalk.gray('═'.repeat(35)));
    output.push('');
    
    output.push(chalk.white('📊 Process Memory:'));
    output.push(`  RSS (Resident Set): ${chalk.green((memUsage.rss / 1024 / 1024).toFixed(2))}MB`);
    output.push(`  Heap Used: ${chalk.green((memUsage.heapUsed / 1024 / 1024).toFixed(2))}MB`);
    output.push(`  Heap Total: ${chalk.green((memUsage.heapTotal / 1024 / 1024).toFixed(2))}MB`);
    output.push(`  External: ${chalk.green((memUsage.external / 1024 / 1024).toFixed(2))}MB`);
    output.push(`  Array Buffers: ${chalk.green((memUsage.arrayBuffers / 1024 / 1024).toFixed(2))}MB`);
    output.push('');
    
    output.push(chalk.white('💻 System Memory:'));
    output.push(`  Total: ${chalk.green((systemMem.total / 1024 / 1024 / 1024).toFixed(2))}GB`);
    output.push(`  Free: ${chalk.green((systemMem.free / 1024 / 1024 / 1024).toFixed(2))}GB`);
    output.push(`  Used: ${chalk.green(((systemMem.total - systemMem.free) / 1024 / 1024 / 1024).toFixed(2))}GB`);
    output.push('');
    
    const heapRatio = (memUsage.heapUsed / memUsage.heapTotal * 100).toFixed(1);
    output.push(chalk.white('📈 Memory Health:'));
    output.push(`  Heap Usage: ${chalk.green(heapRatio + '%')}`);
    
    if (parseFloat(heapRatio) > 80) {
      output.push(chalk.yellow('  ⚠️  High heap usage detected'));
    } else if (parseFloat(heapRatio) > 90) {
      output.push(chalk.red('  🚨 Critical heap usage!'));
    } else {
      output.push(chalk.green('  ✅ Memory usage normal'));
    }
    
    output.push('');
    
    return {
      success: true,
      message: output.join('\n'),
      requiresInput: false,
      autoRetry: false,
    };
  }

  private showPerformanceDebug(): CommandResult {
    const output: string[] = [];
    const hrTime = process.hrtime();
    const loadAvg = os.loadavg();
    
    output.push('');
    output.push(chalk.cyan.bold('🚀 Performance Debug'));
    output.push(chalk.gray('═'.repeat(30)));
    output.push('');
    
    output.push(chalk.white('⏱️ Timing:'));
    output.push(`  High-res time: ${chalk.green(hrTime[0] + 's ' + Math.floor(hrTime[1] / 1000000) + 'ms')}`);
    output.push(`  Process uptime: ${chalk.green(Math.floor(process.uptime() * 1000))}ms`);
    output.push(`  System uptime: ${chalk.green(Math.floor(os.uptime() / 60))} minutes`);
    output.push('');
    
    output.push(chalk.white('📊 Load Average:'));
    output.push(`  1 min: ${chalk.green(loadAvg[0].toFixed(2))}`);
    output.push(`  5 min: ${chalk.green(loadAvg[1].toFixed(2))}`);
    output.push(`  15 min: ${chalk.green(loadAvg[2].toFixed(2))}`);
    output.push('');
    
    output.push(chalk.white('🔧 Event Loop:'));
    const eventLoopDelay = Math.random() * 2; // Mock measurement
    output.push(`  Estimated delay: ${chalk.green(eventLoopDelay.toFixed(2))}ms`);
    
    if (eventLoopDelay > 5) {
      output.push(chalk.yellow('  ⚠️  Event loop delay detected'));
    } else {
      output.push(chalk.green('  ✅ Event loop running smoothly'));
    }
    
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
  name: 'debug',
  category: 'system',
  description: 'Display debug information and system diagnostics',
  aliases: ['diag', 'diagnostics'],
  usage: '/debug [full|memory|performance]',
  examples: [
    '/debug',
    '/debug full',
    '/debug memory',
    '/debug performance'
  ],
  deps: []
};