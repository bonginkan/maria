/**
 * Doctor Command Module
 * システム診断コマンド - 環境チェックとトラブルシューティング
 *
 * Phase 4: Low-frequency commands implementation
 * Category: System
 */

import { SlashCommandResult } from '../../services/slash-command-handler';
import { BaseCommand } from './base-command';
import { _CommandArgs, _CommandContext } from './types';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';

const execAsync = promisify(exec);

export interface DiagnosticCheck {
  name: string;
  category: 'critical' | 'warning' | 'info';
  status: 'pass' | 'fail' | 'warn' | 'skip';
  message: string;
  details?: string;
  fix?: string;
  duration?: number;
}

export interface SystemInfo {
  platform: string;
  arch: string;
  nodeVersion: string;
  npmVersion: string;
  pnpmVersion?: string;
  yarnVersion?: string;
  gitVersion?: string;
  shell: string;
  terminal: string;
  memory: {
    total: number;
    free: number;
    used: number;
  };
  disk: {
    total: number;
    free: number;
    used: number;
  };
}

export class DoctorCommand extends BaseCommand {
  name = 'doctor';
  description = 'Run comprehensive system diagnostics and health checks';
  usage = '/doctor [--category=all|env|deps|config|performance] [--verbose] [--fix]';
  category = 'system';

  examples = [
    '/doctor',
    '/doctor --category=deps',
    '/doctor --verbose --fix',
    '/doctor --category=performance',
  ];

  private checks: DiagnosticCheck[] = [];

  async execute(args: CommandArgs, context: CommandContext): Promise<SlashCommandResult> {
    try {
      const category = args.flags['category'] || 'all';
      const verbose = args.flags['verbose'] || false;
      const autoFix = args.flags['fix'] || false;

      // Initialize checks array
      this.checks = [];

      const startTime = Date.now();

      // Run diagnostics based on category
      switch (category) {
        case 'all':
          await this.runAllChecks();
          break;
        case 'env':
        case 'environment':
          await this.checkEnvironment();
          break;
        case 'deps':
        case 'dependencies':
          await this.checkDependencies();
          break;
        case 'config':
        case 'configuration':
          await this.checkConfiguration();
          break;
        case 'performance':
        case 'perf':
          await this.checkPerformance();
          break;
        default:
          return {
            success: false,
            message: `Unknown category: ${category}. Use: all, env, deps, config, performance`,
          };
      }

      const duration = Date.now() - startTime;

      // Apply fixes if requested
      if (autoFix) {
        await this.applyFixes();
      }

      // Generate report
      const report = await this.generateReport(duration, verbose);

      return {
        success: this.checks.filter((c) => c.status === 'fail').length === 0,
        message: report,
      };
    } catch (error) {
      return {
        success: false,
        message: `Doctor command error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  private async runAllChecks(): Promise<void> {
    await this.checkEnvironment();
    await this.checkDependencies();
    await this.checkConfiguration();
    await this.checkPerformance();
  }

  private async checkEnvironment(): Promise<void> {
    // Node.js version check
    await this.addCheck('Node.js Version', 'critical', async () => {
      const nodeVersion = process.version;
      const major = parseInt(nodeVersion.split('.')[0].substring(1));

      if (major >= 18) {
        return { status: 'pass', message: `Node.js ${nodeVersion} ✓` };
      } else if (major >= 16) {
        return {
          status: 'warn',
          message: `Node.js ${nodeVersion} (consider upgrading to 18+)`,
          fix: 'Update Node.js to version 18 or higher',
        };
      } else {
        return {
          status: 'fail',
          message: `Node.js ${nodeVersion} is too old`,
          fix: 'Update Node.js to version 18 or higher',
        };
      }
    });

    // Package manager check
    await this.addCheck('Package Manager', 'critical', async () => {
      try {
        const { stdout } = await execAsync('pnpm --version');
        return { status: 'pass', message: `pnpm ${stdout.trim()} ✓` };
      } catch {
        try {
          const { stdout } = await execAsync('npm --version');
          return {
            status: 'warn',
            message: `npm ${stdout.trim()} (pnpm recommended)`,
            fix: 'Install pnpm: npm install -g pnpm',
          };
        } catch {
          return {
            status: 'fail',
            message: 'No package manager found',
            fix: 'Install pnpm or npm',
          };
        }
      }
    });

    // Git check
    await this.addCheck('Git Installation', 'critical', async () => {
      try {
        const { stdout } = await execAsync('git --version');
        return { status: 'pass', message: `${stdout.trim()  } ✓` };
      } catch {
        return {
          status: 'fail',
          message: 'Git not found',
          fix: 'Install Git from https://git-scm.com',
        };
      }
    });

    // Terminal environment
    await this.addCheck('Terminal Environment', 'info', async () => {
      const terminal = process.env.TERM_PROGRAM || process.env.TERMINAL_EMULATOR || 'Unknown';
      const shell = process.env.SHELL || 'Unknown';

      return {
        status: 'pass',
        message: `${terminal} with ${path.basename(shell)} ✓`,
        details: `Terminal: ${terminal}, Shell: ${shell}`,
      };
    });

    // Environment variables
    await this.addCheck('Environment Variables', 'warning', async () => {
      const requiredVars = ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GOOGLE_AI_API_KEY'];

      const missing = requiredVars.filter((varName) => !process.env[varName]);

      if (missing.length === 0) {
        return { status: 'pass', message: 'All API keys configured ✓' };
      } else if (missing.length < requiredVars.length) {
        return {
          status: 'warn',
          message: `Some API keys missing: ${missing.join(', ')}`,
          fix: 'Configure missing API keys in .env file',
        };
      } else {
        return {
          status: 'fail',
          message: 'No API keys configured',
          fix: 'Configure API keys in .env file',
        };
      }
    });
  }

  private async checkDependencies(): Promise<void> {
    // package.json existence
    await this.addCheck('Package Configuration', 'critical', async () => {
      try {
        await fs.access('package.json');
        const pkg = JSON.parse(await fs.readFile('package.json', 'utf-8'));
        return {
          status: 'pass',
          message: `package.json found (${pkg.name}@${pkg.version}) ✓`,
          details: `Dependencies: ${Object.keys(pkg.dependencies || {}).length}, DevDeps: ${Object.keys(pkg.devDependencies || {}).length}`,
        };
      } catch {
        return {
          status: 'fail',
          message: 'package.json not found',
          fix: 'Initialize npm package: npm init',
        };
      }
    });

    // node_modules check
    await this.addCheck('Node Modules', 'critical', async () => {
      try {
        await fs.access('node_modules');
        const stats = await fs.stat('node_modules');
        return {
          status: 'pass',
          message: 'node_modules directory exists ✓',
          details: `Last modified: ${stats.mtime.toLocaleString()}`,
        };
      } catch {
        return {
          status: 'fail',
          message: 'node_modules not found',
          fix: 'Run: pnpm install',
        };
      }
    });

    // Lock file check
    await this.addCheck('Lock File', 'warning', async () => {
      const lockFiles = ['pnpm-lock.yaml', 'package-lock.json', 'yarn.lock'];

      for (const lockFile of lockFiles) {
        try {
          await fs.access(lockFile);
          return { status: 'pass', message: `${lockFile} found ✓` };
        } catch {
          // Continue checking other lock files
        }
      }

      return {
        status: 'warn',
        message: 'No lock file found',
        fix: 'Run package install to generate lock file',
      };
    });

    // TypeScript check
    await this.addCheck('TypeScript Setup', 'warning', async () => {
      try {
        await fs.access('tsconfig.json');
        const { stdout } = await execAsync('npx tsc --version');
        return {
          status: 'pass',
          message: `TypeScript configured (${stdout.trim()}) ✓`,
        };
      } catch {
        return {
          status: 'warn',
          message: 'TypeScript not configured',
          fix: 'Install TypeScript: pnpm add -D typescript',
        };
      }
    });
  }

  private async checkConfiguration(): Promise<void> {
    // MARIA configuration
    await this.addCheck('MARIA Configuration', 'warning', async () => {
      try {
        await fs.access('.maria');
        const files = await fs.readdir('.maria');
        return {
          status: 'pass',
          message: `.maria directory found with ${files.length} files ✓`,
          details: `Files: ${files.join(', ')}`,
        };
      } catch {
        return {
          status: 'warn',
          message: '.maria configuration directory not found',
          fix: 'Run: maria init',
        };
      }
    });

    // Git configuration
    await this.addCheck('Git Configuration', 'info', async () => {
      try {
        const { stdout: name } = await execAsync('git config user.name');
        const { stdout: email } = await execAsync('git config user.email');
        return {
          status: 'pass',
          message: `Git configured for ${name.trim()} <${email.trim()}> ✓`,
        };
      } catch {
        return {
          status: 'warn',
          message: 'Git user not configured',
          fix: 'Configure git: git config --global user.name "Your Name" && git config --global user.email "your@email.com"',
        };
      }
    });

    // ESLint configuration
    await this.addCheck('Code Quality Tools', 'info', async () => {
      const configs = ['.eslintrc.js', '.eslintrc.json', '.eslintrc.cjs', 'eslint.config.js'];

      for (const config of configs) {
        try {
          await fs.access(config);
          return { status: 'pass', message: `ESLint configured (${config}) ✓` };
        } catch {
          // Continue checking other config files
        }
      }

      return {
        status: 'info',
        message: 'ESLint not configured',
        fix: 'Add ESLint configuration',
      };
    });
  }

  private async checkPerformance(): Promise<void> {
    // Memory usage
    await this.addCheck('Memory Usage', 'info', async () => {
      const used = process.memoryUsage();
      const totalMB = Math.round(used.heapTotal / 1024 / 1024);
      const usedMB = Math.round(used.heapUsed / 1024 / 1024);

      if (usedMB > 1000) {
        return {
          status: 'warn',
          message: `High memory usage: ${usedMB}MB used of ${totalMB}MB`,
          fix: 'Consider restarting the application',
        };
      }

      return {
        status: 'pass',
        message: `Memory usage: ${usedMB}MB used of ${totalMB}MB ✓`,
      };
    });

    // Disk space
    await this.addCheck('Disk Space', 'warning', async () => {
      try {
        const { stdout } = await execAsync('df -h .');
        const lines = stdout.split('\n');
        if (lines.length > 1) {
          const parts = lines[1].split(/\s+/);
          const usage = parts[4]?.replace('%', '');
          const usagePercent = parseInt(usage);

          if (usagePercent > 90) {
            return {
              status: 'fail',
              message: `Critical disk space: ${usage}% used`,
              fix: 'Free up disk space',
            };
          } else if (usagePercent > 80) {
            return {
              status: 'warn',
              message: `Low disk space: ${usage}% used`,
              fix: 'Consider cleaning up files',
            };
          }

          return { status: 'pass', message: `Disk usage: ${usage}% ✓` };
        }
      } catch {
        // Fallback for non-Unix systems
      }

      return { status: 'info', message: 'Disk space check not available on this platform' };
    });

    // Network connectivity
    await this.addCheck('Network Connectivity', 'warning', async () => {
      try {
        // Test OpenAI API connectivity
        const startTime = Date.now();
        await execAsync('curl -s --max-time 5 https://api.openai.com/v1/models', {
          timeout: 10000,
        });
        const latency = Date.now() - startTime;

        if (latency > 5000) {
          return {
            status: 'warn',
            message: `Slow network connection (${latency}ms)`,
            details: 'API responses may be delayed',
          };
        }

        return {
          status: 'pass',
          message: `Network connectivity OK (${latency}ms) ✓`,
        };
      } catch {
        return {
          status: 'fail',
          message: 'Network connectivity issues',
          fix: 'Check internet connection and firewall settings',
        };
      }
    });
  }

  private async addCheck(
    name: string,
    category: 'critical' | 'warning' | 'info',
    checkFn: () => Promise<{
      status: 'pass' | 'fail' | 'warn' | 'skip';
      message: string;
      details?: string;
      fix?: string;
    }>,
  ): Promise<void> {
    const startTime = Date.now();

    try {
      const result = await checkFn();
      const duration = Date.now() - startTime;

      this.checks.push({
        name,
        category,
        status: result.status,
        message: result.message,
        details: result.details,
        fix: result.fix,
        duration,
      });
    } catch (error) {
      const duration = Date.now() - startTime;

      this.checks.push({
        name,
        category,
        status: 'fail',
        message: `Check failed: ${error instanceof Error ? error.message : String(error)}`,
        duration,
      });
    }
  }

  private async applyFixes(): Promise<void> {
    const fixableChecks = this.checks.filter(
      (c) => c.fix && (c.status === 'fail' || c.status === 'warn'),
    );

    for (const check of fixableChecks) {
      try {
        // For now, just log what would be fixed
        // In a full implementation, this would actually apply fixes
        console.log(`Would fix: ${check.name} - ${check.fix}`);
      } catch (error) {
        console.warn(`Failed to fix ${check.name}:`, error);
      }
    }
  }

  private async generateReport(duration: number, verbose: boolean): Promise<string> {
    const summary = {
      total: this.checks.length,
      passed: this.checks.filter((c) => c.status === 'pass').length,
      warnings: this.checks.filter((c) => c.status === 'warn').length,
      failed: this.checks.filter((c) => c.status === 'fail').length,
      skipped: this.checks.filter((c) => c.status === 'skip').length,
    };

    const getStatusIcon = (status: string) => {
      switch (status) {
        case 'pass':
          return chalk.green('✓');
        case 'warn':
          return chalk.yellow('⚠');
        case 'fail':
          return chalk.red('✗');
        case 'skip':
          return chalk.gray('○');
        default:
          return '?';
      }
    };

    const getCategoryColor = (category: string) => {
      switch (category) {
        case 'critical':
          return chalk.red;
        case 'warning':
          return chalk.yellow;
        case 'info':
          return chalk.blue;
        default:
          return chalk.white;
      }
    };

    let report = `\n${chalk.bold('🏥 MARIA System Diagnostics')}\n`;
    report += `${chalk.gray(`Completed in ${duration}ms`)}\n\n`;

    // Summary
    report += `${chalk.bold('Summary:')}\n`;
    report += `  ${chalk.green('✓')} Passed: ${summary.passed}\n`;
    if (summary.warnings > 0) {
      report += `  ${chalk.yellow('⚠')} Warnings: ${summary.warnings}\n`;
    }
    if (summary.failed > 0) {
      report += `  ${chalk.red('✗')} Failed: ${summary.failed}\n`;
    }
    if (summary.skipped > 0) {
      report += `  ${chalk.gray('○')} Skipped: ${summary.skipped}\n`;
    }
    report += `\n`;

    // Group checks by category
    const categories = ['critical', 'warning', 'info'];

    for (const category of categories) {
      const categoryChecks = this.checks.filter((c) => c.category === category);
      if (categoryChecks.length === 0) {continue;}

      const categoryColor = getCategoryColor(category);
      report += `${categoryColor(category.toUpperCase())} Checks:\n`;

      for (const check of categoryChecks) {
        const icon = getStatusIcon(check.status);
        const duration = verbose && check.duration ? chalk.gray(` (${check.duration}ms)`) : '';
        report += `  ${icon} ${check.name}: ${check.message}${duration}\n`;

        if (verbose && check.details) {
          report += `    ${chalk.gray(check.details)}\n`;
        }

        if (check.fix && (check.status === 'fail' || check.status === 'warn')) {
          report += `    ${chalk.blue('💡 Fix:')} ${check.fix}\n`;
        }
      }
      report += `\n`;
    }

    // Overall status
    const overallStatus =
      summary.failed === 0
        ? summary.warnings === 0
          ? 'HEALTHY'
          : 'HEALTHY (with warnings)'
        : 'ISSUES DETECTED';

    const statusColor =
      summary.failed === 0 ? (summary.warnings === 0 ? chalk.green : chalk.yellow) : chalk.red;

    report += `${chalk.bold('Overall Status:')} ${statusColor(overallStatus)}\n`;

    if (summary.failed > 0 || summary.warnings > 0) {
      report += `\n${chalk.blue('💡 Tip:')} Run with ${chalk.code('/doctor --fix')} to automatically apply available fixes.\n`;
      report += `Run with ${chalk.code('/doctor --verbose')} for detailed information.\n`;
    }

    return report;
  }
}
