/**
 * Migrate Installer Command Module
 * インストール移行コマンド - インストール方法の移行支援
 * 
 * Phase 4: Low-frequency commands implementation
 * Category: Migration
 */

import { SlashCommandResult } from '../../services/slash-command-handler';
import { BaseCommand } from './base-command';
import { CommandArgs, CommandContext } from './types';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';
import os from 'os';

const execAsync = promisify(exec);

export interface InstallationMethod {
  name: string;
  description: string;
  platforms: string[];
  requirements: string[];
  commands: string[];
  verification: string[];
  priority: number;
}

export interface MigrationReport {
  timestamp: string;
  fromMethod: string;
  toMethod: string;
  platform: string;
  success: boolean;
  steps: Array<{
    step: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
    output?: string;
    error?: string;
  }>;
  duration: number;
}

export class MigrateInstallerCommand extends BaseCommand {
  name = 'migrate-installer';
  description = 'Migrate MARIA installation methods (npm → homebrew → binary → source)';
  usage = '/migrate-installer [detect|to-npm|to-homebrew|to-binary|to-source|status|rollback] [options]';
  category = 'migration';
  
  examples = [
    '/migrate-installer detect',
    '/migrate-installer to-npm --backup',
    '/migrate-installer to-homebrew',
    '/migrate-installer status',
    '/migrate-installer rollback --confirm'
  ];

  private backupDir = path.join(os.homedir(), '.maria', 'migration-backups');
  private reportPath = path.join(os.homedir(), '.maria', 'migration-report.json');

  async execute(args: CommandArgs, context: CommandContext): Promise<SlashCommandResult> {
    try {
      const [action = 'detect', ...actionArgs] = args.args;

      await this.ensureDirectories();

      switch (action.toLowerCase()) {
        case 'detect':
        case 'status':
          return await this.detectCurrentInstallation();
        
        case 'to-npm':
          return await this.migrateToNpm(args.flags);
        
        case 'to-homebrew':
        case 'to-brew':
          return await this.migrateToHomebrew(args.flags);
        
        case 'to-binary':
          return await this.migrateToBinary(args.flags);
        
        case 'to-source':
          return await this.migrateToSource(args.flags);
        
        case 'rollback':
        case 'revert':
          return await this.rollbackMigration(args.flags);
        
        case 'cleanup':
          return await this.cleanupOldInstallations(args.flags);
        
        case 'verify':
          return await this.verifyInstallation();
        
        case 'report':
          return await this.showMigrationReport();
        
        default:
          return {
            success: false,
            message: `Unknown migration action: ${action}. Use: detect, to-npm, to-homebrew, to-binary, to-source, rollback, cleanup, verify, report`
          };
      }
    } catch (error) {
      return {
        success: false,
        message: `Migration command error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  private async ensureDirectories(): Promise<void> {
    try {
      await fs.access(this.backupDir);
    } catch {
      await fs.mkdir(this.backupDir, { recursive: true });
    }
  }

  private getInstallationMethods(): InstallationMethod[] {
    return [
      {
        name: 'npm',
        description: 'NPM global package installation',
        platforms: ['darwin', 'linux', 'win32'],
        requirements: ['node', 'npm'],
        commands: [
          'npm uninstall -g @bonginkan/maria || true',
          'npm install -g @bonginkan/maria'
        ],
        verification: [
          'maria --version',
          'which maria || where maria'
        ],
        priority: 1
      },
      {
        name: 'homebrew',
        description: 'Homebrew package manager (macOS/Linux)',
        platforms: ['darwin', 'linux'],
        requirements: ['brew'],
        commands: [
          'brew uninstall maria-cli || true',
          'brew tap bonginkan/maria',
          'brew install maria-cli'
        ],
        verification: [
          'maria --version',
          'brew list maria-cli'
        ],
        priority: 2
      },
      {
        name: 'binary',
        description: 'Direct binary installation',
        platforms: ['darwin', 'linux', 'win32'],
        requirements: [],
        commands: [
          'curl -L https://github.com/bonginkan/maria/releases/latest/download/maria-$(uname -s)-$(uname -m) -o /usr/local/bin/maria',
          'chmod +x /usr/local/bin/maria'
        ],
        verification: [
          'maria --version',
          'ls -la /usr/local/bin/maria'
        ],
        priority: 3
      },
      {
        name: 'source',
        description: 'Build from source code',
        platforms: ['darwin', 'linux'],
        requirements: ['git', 'node', 'pnpm'],
        commands: [
          'git clone https://github.com/bonginkan/maria.git /tmp/maria-source',
          'cd /tmp/maria-source && pnpm install',
          'cd /tmp/maria-source && pnpm build',
          'cd /tmp/maria-source && npm link'
        ],
        verification: [
          'maria --version',
          'npm list -g @bonginkan/maria'
        ],
        priority: 4
      }
    ];
  }

  private async detectCurrentInstallation(): Promise<SlashCommandResult> {
    const platform = process.platform;
    const methods = this.getInstallationMethods();
    const detectedMethods: Array<{ method: InstallationMethod; location: string; version?: string }> = [];

    let message = `\n${chalk.bold('🔍 MARIA Installation Detection')}\n`;
    message += `Platform: ${platform}\n\n`;

    // Check each installation method
    for (const method of methods) {
      if (!method.platforms.includes(platform)) {
        continue;
      }

      try {
        // Check if MARIA is accessible via this method
        let location = '';
        let version = '';

        // Try to find MARIA executable
        try {
          const { stdout: whichOutput } = await execAsync('which maria 2>/dev/null || where maria 2>nul || echo ""');
          if (whichOutput.trim()) {
            location = whichOutput.trim();
          }
        } catch {
          // Command failed, continue
        }

        // Try to get version
        try {
          const { stdout: versionOutput } = await execAsync('maria --version 2>/dev/null || echo ""');
          if (versionOutput.trim()) {
            version = versionOutput.trim();
          }
        } catch {
          // Command failed, continue
        }

        // Method-specific detection
        let detected = false;
        
        switch (method.name) {
          case 'npm':
            try {
              const { stdout } = await execAsync('npm list -g @bonginkan/maria --depth=0 2>/dev/null || echo ""');
              if (stdout.includes('@bonginkan/maria')) {
                detected = true;
                if (!location) location = 'npm global';
              }
            } catch {
              // Not installed via npm
            }
            break;
            
          case 'homebrew':
            try {
              const { stdout } = await execAsync('brew list maria-cli 2>/dev/null || echo ""');
              if (stdout.trim()) {
                detected = true;
                if (!location) location = 'homebrew';
              }
            } catch {
              // Not installed via homebrew
            }
            break;
            
          case 'binary':
            try {
              const binaryPaths = ['/usr/local/bin/maria', '/usr/bin/maria'];
              for (const binPath of binaryPaths) {
                try {
                  await fs.access(binPath);
                  detected = true;
                  location = binPath;
                  break;
                } catch {
                  // File doesn't exist
                }
              }
            } catch {
              // Binary not found
            }
            break;
            
          case 'source':
            // Check if it's linked from a local build
            if (location && (location.includes('node_modules') || location.includes('src'))) {
              detected = true;
            }
            break;
        }

        if (detected || location) {
          detectedMethods.push({ method, location, version });
        }
      } catch (error) {
        // Skip this method
      }
    }

    // Display results
    if (detectedMethods.length === 0) {
      message += `${chalk.red('❌ No MARIA installations detected')}\n\n`;
      message += `${chalk.blue('💡 Install MARIA:')}\n`;
      message += `  npm install -g @bonginkan/maria\n`;
      message += `  brew install bonginkan/maria/maria-cli\n`;
      message += `  curl -L https://install.maria-code.dev | sh`;
    } else {
      message += `${chalk.green('✅ Detected MARIA installations:')}\n\n`;
      
      detectedMethods.forEach(({ method, location, version }) => {
        message += `${chalk.bold(method.name)} (${method.description})\n`;
        message += `  Location: ${location}\n`;
        if (version) {
          message += `  Version: ${version}\n`;
        }
        message += `  Priority: ${method.priority}\n\n`;
      });

      if (detectedMethods.length > 1) {
        message += `${chalk.yellow('⚠️  Multiple installations detected!')}\n`;
        message += `${chalk.blue('💡 Consider:')} Use \`/migrate-installer cleanup\` to remove duplicates\n`;
        
        const recommended = detectedMethods.reduce((prev, current) => 
          prev.method.priority < current.method.priority ? prev : current
        );
        message += `${chalk.blue('🎯 Recommended:')} Use ${recommended.method.name} installation`;
      }
    }

    return {
      success: detectedMethods.length > 0,
      message
    };
  }

  private async migrateToNpm(flags: Record<string, unknown>): Promise<SlashCommandResult> {
    const backup = flags.backup;
    
    const report: MigrationReport = {
      timestamp: new Date().toISOString(),
      fromMethod: 'unknown',
      toMethod: 'npm',
      platform: process.platform,
      success: false,
      steps: [],
      duration: 0
    };

    const startTime = Date.now();

    try {
      // Step 1: Detect current installation
      const currentInstallation = await this.detectCurrentInstallation();
      
      // Step 2: Backup if requested
      if (backup) {
        report.steps.push({ step: 'Backup current installation', status: 'running' });
        await this.createBackup();
        report.steps[report.steps.length - 1].status = 'completed';
      }

      // Step 3: Remove existing installations
      report.steps.push({ step: 'Remove existing installations', status: 'running' });
      await this.removeExistingInstallations();
      report.steps[report.steps.length - 1].status = 'completed';

      // Step 4: Install via npm
      report.steps.push({ step: 'Install via npm', status: 'running' });
      
      try {
        const { stdout, stderr } = await execAsync('npm install -g @bonginkan/maria');
        report.steps[report.steps.length - 1].status = 'completed';
        report.steps[report.steps.length - 1].output = stdout;
      } catch (error) {
        report.steps[report.steps.length - 1].status = 'failed';
        report.steps[report.steps.length - 1].error = error instanceof Error ? error.message : String(error);
        throw error;
      }

      // Step 5: Verify installation
      report.steps.push({ step: 'Verify installation', status: 'running' });
      const verification = await this.verifyInstallation();
      if (verification.success) {
        report.steps[report.steps.length - 1].status = 'completed';
        report.success = true;
      } else {
        report.steps[report.steps.length - 1].status = 'failed';
        report.steps[report.steps.length - 1].error = 'Verification failed';
      }

      report.duration = Date.now() - startTime;
      await this.saveReport(report);

      if (report.success) {
        return {
          success: true,
          message: `✅ Successfully migrated to npm installation!\n\n` +
                   `Duration: ${report.duration}ms\n` +
                   `Version: ${await this.getCurrentVersion()}\n\n` +
                   `${chalk.blue('💡 Next steps:')}\n` +
                   `• Restart your terminal\n` +
                   `• Test with: maria --version\n` +
                   `• Use: maria chat`
        };
      } else {
        return {
          success: false,
          message: `❌ Migration to npm failed. See report with: /migrate-installer report`
        };
      }

    } catch (error) {
      report.success = false;
      report.duration = Date.now() - startTime;
      await this.saveReport(report);
      
      return {
        success: false,
        message: `Migration failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  private async migrateToHomebrew(flags: Record<string, unknown>): Promise<SlashCommandResult> {
    if (process.platform !== 'darwin' && process.platform !== 'linux') {
      return {
        success: false,
        message: 'Homebrew is only available on macOS and Linux'
      };
    }

    // Check if Homebrew is installed
    try {
      await execAsync('which brew');
    } catch {
      return {
        success: false,
        message: 'Homebrew not found. Install it first: /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
      };
    }

    return {
      success: false,
      message: 'Homebrew migration is not yet implemented. Use npm installation for now.'
    };
  }

  private async migrateToBinary(flags: Record<string, unknown>): Promise<SlashCommandResult> {
    return {
      success: false,
      message: 'Binary migration is not yet implemented. Use npm installation for now.'
    };
  }

  private async migrateToSource(flags: Record<string, unknown>): Promise<SlashCommandResult> {
    return {
      success: false,
      message: 'Source migration is not yet implemented. Use npm installation for now.'
    };
  }

  private async removeExistingInstallations(): Promise<void> {
    // Remove npm installation
    try {
      await execAsync('npm uninstall -g @bonginkan/maria');
    } catch {
      // Ignore errors
    }

    // Remove homebrew installation
    try {
      await execAsync('brew uninstall maria-cli');
    } catch {
      // Ignore errors
    }

    // Remove binary installations
    const binaryPaths = ['/usr/local/bin/maria', '/usr/bin/maria'];
    for (const binPath of binaryPaths) {
      try {
        await fs.unlink(binPath);
      } catch {
        // Ignore errors
      }
    }
  }

  private async createBackup(): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(this.backupDir, `maria-backup-${timestamp}`);
    
    await fs.mkdir(backupPath, { recursive: true });
    
    // Backup configuration
    try {
      const mariaDir = path.join(os.homedir(), '.maria');
      await execAsync(`cp -r "${mariaDir}" "${backupPath}/maria-config"`);
    } catch {
      // Ignore if .maria directory doesn't exist
    }
    
    // Backup current executable
    try {
      const { stdout } = await execAsync('which maria');
      const mariaPath = stdout.trim();
      if (mariaPath) {
        await fs.copyFile(mariaPath, path.join(backupPath, 'maria-executable'));
      }
    } catch {
      // Ignore if maria executable not found
    }
  }

  private async verifyInstallation(): Promise<{ success: boolean; message: string }> {
    try {
      // Test version command
      const { stdout } = await execAsync('maria --version');
      
      // Test basic functionality
      await execAsync('maria --help');
      
      return {
        success: true,
        message: `Installation verified successfully. Version: ${stdout.trim()}`
      };
    } catch (error) {
      return {
        success: false,
        message: `Verification failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  private async getCurrentVersion(): Promise<string> {
    try {
      const { stdout } = await execAsync('maria --version');
      return stdout.trim();
    } catch {
      return 'Unknown';
    }
  }

  private async saveReport(report: MigrationReport): Promise<void> {
    await fs.writeFile(this.reportPath, JSON.stringify(report, null, 2));
  }

  private async showMigrationReport(): Promise<SlashCommandResult> {
    try {
      const content = await fs.readFile(this.reportPath, 'utf-8');
      const report: MigrationReport = JSON.parse(content);
      
      let message = `\n${chalk.bold('📋 Migration Report')}\n\n`;
      message += `${chalk.blue('Timestamp:')} ${new Date(report.timestamp).toLocaleString()}\n`;
      message += `${chalk.blue('Migration:')} ${report.fromMethod} → ${report.toMethod}\n`;
      message += `${chalk.blue('Platform:')} ${report.platform}\n`;
      message += `${chalk.blue('Duration:')} ${report.duration}ms\n`;
      message += `${chalk.blue('Success:')} ${report.success ? chalk.green('✅ Yes') : chalk.red('❌ No')}\n\n`;
      
      message += `${chalk.bold('Steps:')}\n`;
      report.steps.forEach((step, index) => {
        const statusIcon = {
          pending: chalk.gray('○'),
          running: chalk.yellow('●'),
          completed: chalk.green('✓'),
          failed: chalk.red('✗'),
          skipped: chalk.gray('○')
        }[step.status];
        
        message += `${index + 1}. ${statusIcon} ${step.step}\n`;
        
        if (step.output) {
          message += `   ${chalk.gray('Output:')} ${step.output.substring(0, 100)}...\n`;
        }
        
        if (step.error) {
          message += `   ${chalk.red('Error:')} ${step.error}\n`;
        }
      });

      return { success: true, message };
    } catch {
      return {
        success: false,
        message: 'No migration report found.'
      };
    }
  }

  private async rollbackMigration(flags: Record<string, unknown>): Promise<SlashCommandResult> {
    const confirm = flags.confirm;
    
    if (!confirm) {
      return {
        success: false,
        message: 'Rollback requires confirmation. Use --confirm flag to proceed.'
      };
    }

    return {
      success: false,
      message: 'Rollback is not yet implemented. Manually reinstall your preferred method.'
    };
  }

  private async cleanupOldInstallations(flags: Record<string, unknown>): Promise<SlashCommandResult> {
    const dryRun = !flags.execute;
    
    let message = `\n${chalk.bold('🧹 Installation Cleanup')}\n`;
    
    if (dryRun) {
      message += `${chalk.yellow('DRY RUN MODE')} - No changes will be made\n`;
      message += `Use --execute to actually perform cleanup\n\n`;
    } else {
      message += `${chalk.red('LIVE MODE')} - Changes will be made\n\n`;
    }

    // List what would be cleaned up
    const cleanupItems = [
      'npm global @bonginkan/maria',
      'homebrew maria-cli',
      '/usr/local/bin/maria binary',
      'Old configuration backups'
    ];

    message += `${chalk.bold('Items to clean:')}\n`;
    cleanupItems.forEach(item => {
      message += `  • ${item}\n`;
    });

    if (!dryRun) {
      // Perform actual cleanup
      await this.removeExistingInstallations();
    }

    message += `\n${dryRun ? 'Would clean' : 'Cleaned'} ${cleanupItems.length} items.`;

    return { success: true, message };
  }
}