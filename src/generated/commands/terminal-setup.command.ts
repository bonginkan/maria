/**
 * Terminal Setup Command Module
 * ターミナル設定コマンド - ターミナル環境の最適化
 * 
 * Phase 4: Low-frequency commands implementation
 * Category: Configuration
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

export interface TerminalProfile {
  name: string;
  description: string;
  settings: {
    colorScheme?: string;
    fontSize?: number;
    fontFamily?: string;
    cursorShape?: 'block' | 'line' | 'underline';
    scrollbackLines?: number;
    tabWidth?: number;
    bellStyle?: 'none' | 'visual' | 'audible';
  };
  aliases?: Record<string, string>;
  environment?: Record<string, string>;
  functions?: Record<string, string>;
}

export interface ShellConfig {
  shell: string;
  configFile: string;
  backupFile: string;
  exists: boolean;
}

export class TerminalSetupCommand extends BaseCommand {
  name = 'terminal-setup';
  description = 'Configure terminal environment for optimal MARIA experience';
  usage = '/terminal-setup [profile|aliases|shell|colors|fonts|backup|restore] [options]';
  category = 'configuration';
  
  examples = [
    '/terminal-setup profile maria',
    '/terminal-setup aliases',
    '/terminal-setup shell --detect',
    '/terminal-setup colors --theme dark',
    '/terminal-setup backup'
  ];

  private homeDir = os.homedir();
  private mariaDir = path.join(this.homeDir, '.maria');
  private backupDir = path.join(this.mariaDir, 'backups');

  async execute(args: CommandArgs, context: CommandContext): Promise<SlashCommandResult> {
    try {
      const [action = 'status', ...actionArgs] = args.args;

      await this.ensureDirectories();

      switch (action.toLowerCase()) {
        case 'status':
          return await this.showStatus();
        
        case 'profile':
          return await this.setupProfile(actionArgs);
        
        case 'aliases':
          return await this.setupAliases(actionArgs);
        
        case 'shell':
          return await this.setupShell(actionArgs, args.flags);
        
        case 'colors':
        case 'theme':
          return await this.setupColors(actionArgs, args.flags);
        
        case 'fonts':
          return await this.setupFonts(actionArgs, args.flags);
        
        case 'backup':
          return await this.backupConfigs();
        
        case 'restore':
          return await this.restoreConfigs(actionArgs);
        
        case 'reset':
          return await this.resetToDefaults();
        
        case 'install':
          return await this.installRecommendedTools();
        
        case 'export':
          return await this.exportConfig(actionArgs);
        
        case 'import':
          return await this.importConfig(actionArgs);
        
        default:
          return {
            success: false,
            message: `Unknown terminal-setup action: ${action}. Use: status, profile, aliases, shell, colors, fonts, backup, restore, reset, install, export, import`
          };
      }
    } catch (error) {
      return {
        success: false,
        message: `Terminal setup error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  private async ensureDirectories(): Promise<void> {
    for (const dir of [this.mariaDir, this.backupDir]) {
      try {
        await fs.access(dir);
      } catch {
        await fs.mkdir(dir, { recursive: true });
      }
    }
  }

  private async showStatus(): Promise<SlashCommandResult> {
    const shell = process.env.SHELL || 'unknown';
    const terminal = process.env.TERM_PROGRAM || process.env.TERMINAL_EMULATOR || 'unknown';
    const platform = process.platform;
    
    const shellConfigs = await this.detectShellConfigs();
    
    let report = `\n${chalk.bold('🖥️  Terminal Environment Status')}\n\n`;
    
    // Basic info
    report += `${chalk.blue('Platform:')} ${platform}\n`;
    report += `${chalk.blue('Terminal:')} ${terminal}\n`;
    report += `${chalk.blue('Shell:')} ${path.basename(shell)}\n\n`;
    
    // Shell configuration files
    report += `${chalk.bold('Shell Configuration Files:')}\n`;
    for (const config of shellConfigs) {
      const status = config.exists ? chalk.green('✓') : chalk.red('✗');
      report += `  ${status} ${config.configFile}\n`;
    }
    
    // MARIA aliases
    const aliases = await this.checkMariaAliases();
    report += `\n${chalk.bold('MARIA Aliases:')}\n`;
    if (aliases.length > 0) {
      aliases.forEach(alias => {
        report += `  ${chalk.green('✓')} ${alias}\n`;
      });
    } else {
      report += `  ${chalk.yellow('⚠')} No MARIA aliases found\n`;
      report += `  ${chalk.blue('💡')} Run \`/terminal-setup aliases\` to add them\n`;
    }
    
    // PATH check
    const pathCheck = await this.checkPath();
    report += `\n${chalk.bold('PATH Configuration:')}\n`;
    report += `  ${pathCheck.hasNodeModules ? chalk.green('✓') : chalk.red('✗')} ./node_modules/.bin in PATH\n`;
    report += `  ${pathCheck.hasGlobalNpm ? chalk.green('✓') : chalk.red('✗')} Global npm/pnpm in PATH\n`;
    
    return {
      success: true,
      message: report
    };
  }

  private async setupProfile(args: string[]): Promise<SlashCommandResult> {
    const profileName = args[0] || 'maria';
    
    const profiles: Record<string, TerminalProfile> = {
      maria: {
        name: 'MARIA Development',
        description: 'Optimized profile for MARIA development workflow',
        settings: {
          colorScheme: 'dark',
          fontSize: 14,
          fontFamily: 'JetBrains Mono, Fira Code, Monaco',
          cursorShape: 'line',
          scrollbackLines: 10000,
          tabWidth: 2,
          bellStyle: 'none'
        },
        aliases: {
          mc: 'maria chat',
          mcode: 'maria code',
          mtest: 'maria test',
          mreview: 'maria review',
          minit: 'maria init',
          mstatus: 'maria status',
          ll: 'ls -la',
          la: 'ls -A',
          l: 'ls -CF',
          ...: 'cd ..',
          ....: 'cd ../..',
          tree: 'find . -type d | sed -e "s/[^-][^\/]*\//  |/g" -e "s/|\([^ ]\)/|-\1/"'
        },
        environment: {
          MARIA_AUTO_UPDATE: 'true',
          MARIA_TELEMETRY: 'true',
          EDITOR: 'code'
        }
      },
      minimal: {
        name: 'Minimal MARIA',
        description: 'Minimal profile with essential MARIA commands',
        settings: {
          colorScheme: 'system',
          fontSize: 12,
          scrollbackLines: 1000
        },
        aliases: {
          mc: 'maria chat',
          m: 'maria'
        }
      }
    };

    const profile = profiles[profileName];
    if (!profile) {
      return {
        success: false,
        message: `Profile '${profileName}' not found. Available profiles: ${Object.keys(profiles).join(', ')}`
      };
    }

    // Apply the profile
    await this.applyProfile(profile);
    
    return {
      success: true,
      message: `✅ Applied terminal profile: ${profile.name}\n` +
               `Description: ${profile.description}\n\n` +
               `${chalk.blue('💡 Tip:')} Restart your terminal or run \`source ~/.bashrc\` (or equivalent) to apply changes.`
    };
  }

  private async applyProfile(profile: TerminalProfile): Promise<void> {
    // Apply aliases
    if (profile.aliases) {
      await this.addAliases(profile.aliases);
    }
    
    // Apply environment variables
    if (profile.environment) {
      await this.addEnvironmentVars(profile.environment);
    }
    
    // Save profile info
    const profilePath = path.join(this.mariaDir, 'terminal-profile.json');
    await fs.writeFile(profilePath, JSON.stringify(profile, null, 2));
  }

  private async setupAliases(args: string[]): Promise<SlashCommandResult> {
    const defaultAliases = {
      // MARIA shortcuts
      mc: 'maria chat',
      mcode: 'maria code',
      mtest: 'maria test',
      mreview: 'maria review',
      minit: 'maria init',
      mstatus: 'maria status',
      mhelp: 'maria --help',
      
      // Common shortcuts
      ll: 'ls -la',
      la: 'ls -A',
      l: 'ls -CF',
      '..': 'cd ..',
      '...': 'cd ../..',
      '....': 'cd ../../..',
      
      // Development shortcuts
      gs: 'git status',
      ga: 'git add',
      gc: 'git commit',
      gp: 'git push',
      gl: 'git log --oneline',
      gd: 'git diff',
      
      // Package management
      ni: 'pnpm install',
      nr: 'pnpm run',
      nb: 'pnpm run build',
      nt: 'pnpm run test',
      nl: 'pnpm run lint'
    };

    await this.addAliases(defaultAliases);
    
    const count = Object.keys(defaultAliases).length;
    return {
      success: true,
      message: `✅ Added ${count} aliases to your shell configuration!\n\n` +
               `${chalk.bold('MARIA aliases:')}\n` +
               `  mc → maria chat\n` +
               `  mcode → maria code\n` +
               `  mtest → maria test\n` +
               `  mreview → maria review\n\n` +
               `${chalk.blue('💡 Tip:')} Restart your terminal or run \`source ~/.bashrc\` to use the new aliases.`
    };
  }

  private async addAliases(aliases: Record<string, string>): Promise<void> {
    const shellConfigs = await this.detectShellConfigs();
    
    for (const config of shellConfigs) {
      if (!config.exists) continue;
      
      try {
        let content = await fs.readFile(config.configFile, 'utf-8');
        
        // Check if MARIA aliases section exists
        const mariaSection = '# MARIA Aliases';
        if (!content.includes(mariaSection)) {
          content += `\n\n${mariaSection}\n`;
        }
        
        // Add/update aliases
        for (const [alias, command] of Object.entries(aliases)) {
          const aliasLine = `alias ${alias}='${command}'`;
          const existingRegex = new RegExp(`^alias ${alias}=.*$`, 'm');
          
          if (existingRegex.test(content)) {
            content = content.replace(existingRegex, aliasLine);
          } else {
            content += `${aliasLine}\n`;
          }
        }
        
        await fs.writeFile(config.configFile, content);
      } catch (error) {
        console.warn(`Failed to update ${config.configFile}:`, error);
      }
    }
  }

  private async addEnvironmentVars(vars: Record<string, string>): Promise<void> {
    const shellConfigs = await this.detectShellConfigs();
    
    for (const config of shellConfigs) {
      if (!config.exists) continue;
      
      try {
        let content = await fs.readFile(config.configFile, 'utf-8');
        
        const mariaSection = '# MARIA Environment Variables';
        if (!content.includes(mariaSection)) {
          content += `\n\n${mariaSection}\n`;
        }
        
        for (const [varName, varValue] of Object.entries(vars)) {
          const exportLine = `export ${varName}='${varValue}'`;
          const existingRegex = new RegExp(`^export ${varName}=.*$`, 'm');
          
          if (existingRegex.test(content)) {
            content = content.replace(existingRegex, exportLine);
          } else {
            content += `${exportLine}\n`;
          }
        }
        
        await fs.writeFile(config.configFile, content);
      } catch (error) {
        console.warn(`Failed to update ${config.configFile}:`, error);
      }
    }
  }

  private async detectShellConfigs(): Promise<ShellConfig[]> {
    const shell = path.basename(process.env.SHELL || 'bash');
    const configs: ShellConfig[] = [];
    
    const configFiles: Record<string, string[]> = {
      bash: ['.bashrc', '.bash_profile', '.profile'],
      zsh: ['.zshrc', '.zprofile'],
      fish: ['.config/fish/config.fish'],
      csh: ['.cshrc'],
      tcsh: ['.tcshrc']
    };
    
    const shellConfigs = configFiles[shell] || configFiles.bash;
    
    for (const configFile of shellConfigs) {
      const fullPath = path.join(this.homeDir, configFile);
      const backupPath = path.join(this.backupDir, path.basename(configFile));
      
      try {
        await fs.access(fullPath);
        configs.push({
          shell,
          configFile: fullPath,
          backupFile: backupPath,
          exists: true
        });
      } catch {
        configs.push({
          shell,
          configFile: fullPath,
          backupFile: backupPath,
          exists: false
        });
      }
    }
    
    return configs;
  }

  private async checkMariaAliases(): Promise<string[]> {
    const aliases: string[] = [];
    const shellConfigs = await this.detectShellConfigs();
    
    for (const config of shellConfigs) {
      if (!config.exists) continue;
      
      try {
        const content = await fs.readFile(config.configFile, 'utf-8');
        const lines = content.split('\n');
        
        for (const line of lines) {
          if (line.includes('maria') && line.startsWith('alias ')) {
            const match = line.match(/alias (\w+)=/);
            if (match) {
              aliases.push(match[1]);
            }
          }
        }
      } catch {
        // Ignore read errors
      }
    }
    
    return [...new Set(aliases)]; // Remove duplicates
  }

  private async checkPath(): Promise<{hasNodeModules: boolean; hasGlobalNpm: boolean}> {
    const pathEnv = process.env.PATH || '';
    const paths = pathEnv.split(path.delimiter);
    
    return {
      hasNodeModules: paths.some(p => p.includes('node_modules/.bin')),
      hasGlobalNpm: paths.some(p => p.includes('npm') || p.includes('pnpm'))
    };
  }

  private async setupShell(args: string[], flags: Record<string, unknown>): Promise<SlashCommandResult> {
    if (flags.detect) {
      const shell = process.env.SHELL;
      const configs = await this.detectShellConfigs();
      
      let message = `\n${chalk.bold('Detected Shell Configuration:')}\n`;
      message += `Shell: ${shell}\n`;
      message += `Config files:\n`;
      
      configs.forEach(config => {
        const status = config.exists ? chalk.green('✓') : chalk.red('✗');
        message += `  ${status} ${config.configFile}\n`;
      });
      
      return { success: true, message };
    }
    
    return {
      success: false,
      message: 'Use --detect to show shell configuration info'
    };
  }

  private async setupColors(args: string[], flags: Record<string, unknown>): Promise<SlashCommandResult> {
    return {
      success: false,
      message: 'Color theme setup is not yet implemented. This would configure terminal color schemes.'
    };
  }

  private async setupFonts(args: string[], flags: Record<string, unknown>): Promise<SlashCommandResult> {
    return {
      success: false,
      message: 'Font setup is not yet implemented. This would recommend and configure programming fonts.'
    };
  }

  private async backupConfigs(): Promise<SlashCommandResult> {
    const configs = await this.detectShellConfigs();
    let backedUp = 0;
    
    for (const config of configs) {
      if (!config.exists) continue;
      
      try {
        await fs.copyFile(config.configFile, config.backupFile);
        backedUp++;
      } catch (error) {
        console.warn(`Failed to backup ${config.configFile}:`, error);
      }
    }
    
    if (backedUp === 0) {
      return {
        success: false,
        message: 'No configuration files found to backup.'
      };
    }
    
    return {
      success: true,
      message: `✅ Backed up ${backedUp} configuration file(s) to ${this.backupDir}`
    };
  }

  private async restoreConfigs(args: string[]): Promise<SlashCommandResult> {
    const configs = await this.detectShellConfigs();
    let restored = 0;
    
    for (const config of configs) {
      try {
        await fs.access(config.backupFile);
        await fs.copyFile(config.backupFile, config.configFile);
        restored++;
      } catch {
        // Backup doesn't exist or restore failed
      }
    }
    
    if (restored === 0) {
      return {
        success: false,
        message: 'No backup files found to restore.'
      };
    }
    
    return {
      success: true,
      message: `✅ Restored ${restored} configuration file(s) from backup.\n` +
               `${chalk.blue('💡 Tip:')} Restart your terminal to apply the restored settings.`
    };
  }

  private async resetToDefaults(): Promise<SlashCommandResult> {
    return {
      success: false,
      message: 'Reset to defaults is not yet implemented. Use restore if you have backups.'
    };
  }

  private async installRecommendedTools(): Promise<SlashCommandResult> {
    const recommendations = [
      {
        name: 'JetBrains Mono',
        description: 'Programming font with ligatures',
        install: 'Download from https://www.jetbrains.com/lp/mono/'
      },
      {
        name: 'oh-my-zsh',
        description: 'Zsh framework with themes and plugins',
        install: 'sh -c "$(curl -fsSL https://raw.github.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"'
      },
      {
        name: 'starship',
        description: 'Cross-shell prompt customizer',
        install: 'curl -sS https://starship.rs/install.sh | sh'
      }
    ];
    
    let message = `\n${chalk.bold('🛠️  Recommended Terminal Tools:')}\n\n`;
    
    recommendations.forEach((tool, index) => {
      message += `${index + 1}. ${chalk.bold(tool.name)}\n`;
      message += `   ${tool.description}\n`;
      message += `   ${chalk.gray(tool.install)}\n\n`;
    });
    
    message += `${chalk.blue('💡 Note:')} These tools are optional but can enhance your terminal experience.`;
    
    return {
      success: true,
      message
    };
  }

  private async exportConfig(args: string[]): Promise<SlashCommandResult> {
    const exportPath = args[0] || 'maria-terminal-config.json';
    
    try {
      const profilePath = path.join(this.mariaDir, 'terminal-profile.json');
      await fs.access(profilePath);
      
      const profile = JSON.parse(await fs.readFile(profilePath, 'utf-8'));
      await fs.writeFile(exportPath, JSON.stringify(profile, null, 2));
      
      return {
        success: true,
        message: `✅ Terminal configuration exported to ${exportPath}`
      };
    } catch {
      return {
        success: false,
        message: 'No terminal configuration found to export. Set up a profile first.'
      };
    }
  }

  private async importConfig(args: string[]): Promise<SlashCommandResult> {
    if (args.length === 0) {
      return {
        success: false,
        message: 'Usage: /terminal-setup import <config-file>'
      };
    }
    
    try {
      const content = await fs.readFile(args[0], 'utf-8');
      const profile: TerminalProfile = JSON.parse(content);
      
      await this.applyProfile(profile);
      
      return {
        success: true,
        message: `✅ Terminal configuration imported from ${args[0]}\n` +
                 `Applied profile: ${profile.name}`
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to import configuration: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}