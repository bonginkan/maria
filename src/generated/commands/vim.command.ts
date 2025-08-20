/**
 * Vim Command Module
 * Vimモードコマンド - Vimキーバインディングの切り替え
 * 
 * Phase 4: Low-frequency commands implementation
 * Category: Interface
 */

import { SlashCommandResult } from '../../services/slash-command-handler';
import { BaseCommand } from './base-command';
import { CommandArgs, CommandContext } from './types';
import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';

export interface VimConfig {
  enabled: boolean;
  keyBindings: Record<string, string>;
  modes: {
    normal: boolean;
    insert: boolean;
    visual: boolean;
    command: boolean;
  };
  preferences: {
    showMode: boolean;
    escapeKey: string;
    leader: string;
    timeout: number;
  };
}

export interface VimKeyMapping {
  key: string;
  mode: 'normal' | 'insert' | 'visual' | 'command' | 'any';
  action: string;
  description: string;
}

export class VimCommand extends BaseCommand {
  name = 'vim';
  description = 'Toggle Vim mode keybindings and navigation';
  usage = '/vim [on|off|status|config|keys|help] [options]';
  category = 'interface';
  
  examples = [
    '/vim on',
    '/vim off',
    '/vim status',
    '/vim keys --mode=normal',
    '/vim config --leader=","'
  ];

  private configPath = path.join(process.cwd(), '.maria', 'vim-config.json');

  async execute(args: CommandArgs, context: CommandContext): Promise<SlashCommandResult> {
    try {
      const [action = 'status', ...actionArgs] = args.args;

      await this.ensureConfigDir();

      switch (action.toLowerCase()) {
        case 'on':
        case 'enable':
          return await this.enableVimMode(args.flags);
        
        case 'off':
        case 'disable':
          return await this.disableVimMode();
        
        case 'status':
          return await this.showStatus();
        
        case 'config':
        case 'configure':
          return await this.configureVim(args.flags);
        
        case 'keys':
        case 'bindings':
          return await this.showKeyBindings(args.flags);
        
        case 'help':
        case 'guide':
          return await this.showHelp();
        
        case 'reset':
          return await this.resetToDefaults();
        
        case 'export':
          return await this.exportConfig(actionArgs);
        
        case 'import':
          return await this.importConfig(actionArgs);
        
        case 'test':
          return await this.testBindings();
        
        default:
          return {
            success: false,
            message: `Unknown vim action: ${action}. Use: on, off, status, config, keys, help, reset, export, import, test`
          };
      }
    } catch (error) {
      return {
        success: false,
        message: `Vim command error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  private async ensureConfigDir(): Promise<void> {
    const configDir = path.dirname(this.configPath);
    try {
      await fs.access(configDir);
    } catch {
      await fs.mkdir(configDir, { recursive: true });
    }
  }

  private async loadConfig(): Promise<VimConfig> {
    try {
      const content = await fs.readFile(this.configPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return this.getDefaultConfig();
    }
  }

  private async saveConfig(config: VimConfig): Promise<void> {
    await fs.writeFile(this.configPath, JSON.stringify(config, null, 2));
  }

  private getDefaultConfig(): VimConfig {
    return {
      enabled: false,
      keyBindings: {
        // Navigation
        'h': 'cursor-left',
        'j': 'cursor-down', 
        'k': 'cursor-up',
        'l': 'cursor-right',
        '0': 'line-start',
        '$': 'line-end',
        'gg': 'document-start',
        'G': 'document-end',
        'w': 'word-forward',
        'b': 'word-backward',
        'e': 'word-end',
        
        // Editing
        'i': 'insert-before',
        'a': 'insert-after',
        'I': 'insert-line-start',
        'A': 'insert-line-end',
        'o': 'new-line-after',
        'O': 'new-line-before',
        'x': 'delete-char',
        'dd': 'delete-line',
        'yy': 'copy-line',
        'p': 'paste-after',
        'P': 'paste-before',
        'u': 'undo',
        'Ctrl+r': 'redo',
        
        // Search and replace
        '/': 'search-forward',
        '?': 'search-backward',
        'n': 'search-next',
        'N': 'search-previous',
        ':': 'command-mode',
        
        // Visual mode
        'v': 'visual-char',
        'V': 'visual-line',
        'Ctrl+v': 'visual-block'
      },
      modes: {
        normal: true,
        insert: true,
        visual: true,
        command: true
      },
      preferences: {
        showMode: true,
        escapeKey: 'Escape',
        leader: '\\',
        timeout: 1000
      }
    };
  }

  private async enableVimMode(flags: Record<string, unknown>): Promise<SlashCommandResult> {
    const config = await this.loadConfig();
    const wasEnabled = config.enabled;
    
    config.enabled = true;
    
    // Apply any configuration flags
    if (flags.leader) {
      config.preferences.leader = flags.leader as string;
    }
    
    if (flags['show-mode'] !== undefined) {
      config.preferences.showMode = Boolean(flags['show-mode']);
    }
    
    if (flags.timeout) {
      config.preferences.timeout = parseInt(flags.timeout as string) || 1000;
    }
    
    await this.saveConfig(config);
    
    let message = `✅ Vim mode ${wasEnabled ? 'updated' : 'enabled'}!\n\n`;
    
    message += `${chalk.bold('Current Configuration:')}\n`;
    message += `  Mode Display: ${config.preferences.showMode ? chalk.green('On') : chalk.gray('Off')}\n`;
    message += `  Leader Key: ${chalk.blue(config.preferences.leader)}\n`;
    message += `  Escape Key: ${chalk.blue(config.preferences.escapeKey)}\n`;
    message += `  Timeout: ${config.preferences.timeout}ms\n\n`;
    
    message += `${chalk.bold('Enabled Modes:')}\n`;
    Object.entries(config.modes).forEach(([mode, enabled]) => {
      const status = enabled ? chalk.green('✓') : chalk.gray('✗');
      message += `  ${status} ${mode}\n`;
    });
    
    message += `\n${chalk.blue('💡 Tips:')}\n`;
    message += `• Press ${chalk.code('Escape')} to enter normal mode\n`;
    message += `• Use ${chalk.code('/vim keys')} to see all keybindings\n`;
    message += `• Use ${chalk.code('/vim help')} for a quick guide\n`;
    message += `• Press ${chalk.code('i')} to enter insert mode`;
    
    return { success: true, message };
  }

  private async disableVimMode(): Promise<SlashCommandResult> {
    const config = await this.loadConfig();
    
    if (!config.enabled) {
      return {
        success: true,
        message: 'Vim mode is already disabled.'
      };
    }
    
    config.enabled = false;
    await this.saveConfig(config);
    
    return {
      success: true,
      message: `✅ Vim mode disabled!\n\n` +
               `Standard keybindings have been restored.\n` +
               `Use \`/vim on\` to re-enable Vim mode.`
    };
  }

  private async showStatus(): Promise<SlashCommandResult> {
    const config = await this.loadConfig();
    
    let message = `\n${chalk.bold('⚡ Vim Mode Status')}\n\n`;
    
    const statusColor = config.enabled ? chalk.green : chalk.gray;
    const statusText = config.enabled ? 'ENABLED' : 'DISABLED';
    message += `${chalk.blue('Status:')} ${statusColor(statusText)}\n\n`;
    
    if (config.enabled) {
      message += `${chalk.bold('Configuration:')}\n`;
      message += `  Mode Display: ${config.preferences.showMode ? chalk.green('On') : chalk.gray('Off')}\n`;
      message += `  Leader Key: ${chalk.blue(config.preferences.leader)}\n`;
      message += `  Escape Key: ${chalk.blue(config.preferences.escapeKey)}\n`;
      message += `  Key Timeout: ${config.preferences.timeout}ms\n\n`;
      
      message += `${chalk.bold('Enabled Modes:')}\n`;
      Object.entries(config.modes).forEach(([mode, enabled]) => {
        const status = enabled ? chalk.green('✓') : chalk.gray('✗');
        message += `  ${status} ${mode.charAt(0).toUpperCase() + mode.slice(1)}\n`;
      });
      
      const bindingCount = Object.keys(config.keyBindings).length;
      message += `\n${chalk.bold('Key Bindings:')} ${bindingCount} configured\n`;
      message += `${chalk.blue('💡 Tip:')} Use \`/vim keys\` to view all bindings`;
    } else {
      message += `${chalk.blue('💡 Enable with:')} /vim on\n`;
      message += `${chalk.blue('📖 Learn more:')} /vim help`;
    }
    
    return { success: true, message };
  }

  private async configureVim(flags: Record<string, unknown>): Promise<SlashCommandResult> {
    const config = await this.loadConfig();
    let changed = false;
    let changes: string[] = [];
    
    // Update leader key
    if (flags.leader) {
      const newLeader = flags.leader as string;
      config.preferences.leader = newLeader;
      changes.push(`Leader key: ${newLeader}`);
      changed = true;
    }
    
    // Update escape key
    if (flags.escape) {
      const newEscape = flags.escape as string;
      config.preferences.escapeKey = newEscape;
      changes.push(`Escape key: ${newEscape}`);
      changed = true;
    }
    
    // Update timeout
    if (flags.timeout) {
      const newTimeout = parseInt(flags.timeout as string);
      if (!isNaN(newTimeout) && newTimeout > 0) {
        config.preferences.timeout = newTimeout;
        changes.push(`Key timeout: ${newTimeout}ms`);
        changed = true;
      }
    }
    
    // Update mode display
    if (flags['show-mode'] !== undefined) {
      const showMode = Boolean(flags['show-mode']);
      config.preferences.showMode = showMode;
      changes.push(`Mode display: ${showMode ? 'On' : 'Off'}`);
      changed = true;
    }
    
    // Toggle specific modes
    const modes = ['normal', 'insert', 'visual', 'command'];
    for (const mode of modes) {
      if (flags[mode] !== undefined) {
        const enabled = Boolean(flags[mode]);
        config.modes[mode as keyof typeof config.modes] = enabled;
        changes.push(`${mode} mode: ${enabled ? 'Enabled' : 'Disabled'}`);
        changed = true;
      }
    }
    
    if (!changed) {
      return {
        success: false,
        message: 'No configuration changes specified. Available options: --leader, --escape, --timeout, --show-mode, --normal, --insert, --visual, --command'
      };
    }
    
    await this.saveConfig(config);
    
    let message = `✅ Vim configuration updated!\n\n`;
    message += `${chalk.bold('Changes made:')}\n`;
    changes.forEach(change => {
      message += `  • ${change}\n`;
    });
    
    if (config.enabled) {
      message += `\n${chalk.blue('💡 Changes are active immediately')}`;
    } else {
      message += `\n${chalk.yellow('⚠️  Vim mode is disabled. Use \`/vim on\` to enable')`;
    }
    
    return { success: true, message };
  }

  private async showKeyBindings(flags: Record<string, unknown>): Promise<SlashCommandResult> {
    const config = await this.loadConfig();
    const mode = flags.mode as string;
    
    if (!config.enabled) {
      return {
        success: false,
        message: 'Vim mode is disabled. Enable it first with `/vim on`'
      };
    }
    
    const keyMappings = this.getKeyMappings();
    
    let message = `\n${chalk.bold('⌨️  Vim Key Bindings')}\n`;
    
    if (mode) {
      message += `Filtered by mode: ${chalk.blue(mode)}\n`;
    }
    
    message += `Total bindings: ${Object.keys(config.keyBindings).length}\n\n`;
    
    // Group bindings by category
    const categories = {
      'Navigation': ['h', 'j', 'k', 'l', '0', '$', 'gg', 'G', 'w', 'b', 'e'],
      'Editing': ['i', 'a', 'I', 'A', 'o', 'O', 'x', 'dd', 'yy', 'p', 'P', 'u', 'Ctrl+r'],
      'Search': ['/', '?', 'n', 'N'],
      'Visual': ['v', 'V', 'Ctrl+v'],
      'Command': [':']
    };
    
    for (const [category, keys] of Object.entries(categories)) {
      const categoryBindings = keys.filter(key => config.keyBindings[key]);
      
      if (categoryBindings.length > 0) {
        message += `${chalk.bold(category)}:\n`;
        
        categoryBindings.forEach(key => {
          const mapping = keyMappings.find(m => m.key === key);
          const action = config.keyBindings[key];
          const description = mapping?.description || action;
          
          message += `  ${chalk.blue(key.padEnd(8))} → ${description}\n`;
        });
        
        message += '\n';
      }
    }
    
    message += `${chalk.blue('💡 Tips:')}\n`;
    message += `• Use ${chalk.code(config.preferences.leader)} as leader key for custom commands\n`;
    message += `• Press ${chalk.code(config.preferences.escapeKey)} to return to normal mode\n`;
    message += `• Key sequences timeout after ${config.preferences.timeout}ms`;
    
    return { success: true, message };
  }

  private getKeyMappings(): VimKeyMapping[] {
    return [
      // Navigation
      { key: 'h', mode: 'normal', action: 'cursor-left', description: 'Move cursor left' },
      { key: 'j', mode: 'normal', action: 'cursor-down', description: 'Move cursor down' },
      { key: 'k', mode: 'normal', action: 'cursor-up', description: 'Move cursor up' },
      { key: 'l', mode: 'normal', action: 'cursor-right', description: 'Move cursor right' },
      { key: '0', mode: 'normal', action: 'line-start', description: 'Go to beginning of line' },
      { key: '$', mode: 'normal', action: 'line-end', description: 'Go to end of line' },
      { key: 'gg', mode: 'normal', action: 'document-start', description: 'Go to first line' },
      { key: 'G', mode: 'normal', action: 'document-end', description: 'Go to last line' },
      { key: 'w', mode: 'normal', action: 'word-forward', description: 'Move to next word' },
      { key: 'b', mode: 'normal', action: 'word-backward', description: 'Move to previous word' },
      
      // Editing
      { key: 'i', mode: 'normal', action: 'insert-before', description: 'Insert before cursor' },
      { key: 'a', mode: 'normal', action: 'insert-after', description: 'Insert after cursor' },
      { key: 'o', mode: 'normal', action: 'new-line-after', description: 'New line below' },
      { key: 'O', mode: 'normal', action: 'new-line-before', description: 'New line above' },
      { key: 'x', mode: 'normal', action: 'delete-char', description: 'Delete character' },
      { key: 'dd', mode: 'normal', action: 'delete-line', description: 'Delete entire line' },
      { key: 'yy', mode: 'normal', action: 'copy-line', description: 'Copy entire line' },
      { key: 'p', mode: 'normal', action: 'paste-after', description: 'Paste after cursor' },
      { key: 'u', mode: 'normal', action: 'undo', description: 'Undo last change' },
      
      // Search
      { key: '/', mode: 'normal', action: 'search-forward', description: 'Search forward' },
      { key: '?', mode: 'normal', action: 'search-backward', description: 'Search backward' },
      { key: 'n', mode: 'normal', action: 'search-next', description: 'Next search result' },
      { key: 'N', mode: 'normal', action: 'search-previous', description: 'Previous search result' },
      
      // Visual
      { key: 'v', mode: 'normal', action: 'visual-char', description: 'Visual character mode' },
      { key: 'V', mode: 'normal', action: 'visual-line', description: 'Visual line mode' },
      
      // Command
      { key: ':', mode: 'normal', action: 'command-mode', description: 'Enter command mode' }
    ];
  }

  private async showHelp(): Promise<SlashCommandResult> {
    let message = `\n${chalk.bold('📖 Vim Mode Quick Guide')}\n\n`;
    
    message += `${chalk.bold('Modes:')}\n`;
    message += `  ${chalk.blue('Normal:')} Navigation and commands (default)\n`;
    message += `  ${chalk.blue('Insert:')} Text input (press 'i' to enter)\n`;
    message += `  ${chalk.blue('Visual:')} Text selection (press 'v' to enter)\n`;
    message += `  ${chalk.blue('Command:')} Execute commands (press ':' to enter)\n\n`;
    
    message += `${chalk.bold('Essential Keys:')}\n`;
    message += `  ${chalk.blue('Escape:')} Return to normal mode\n`;
    message += `  ${chalk.blue('i:')} Enter insert mode\n`;
    message += `  ${chalk.blue('hjkl:')} Navigate (left/down/up/right)\n`;
    message += `  ${chalk.blue('0/$:')} Beginning/end of line\n`;
    message += `  ${chalk.blue('gg/G:')} First/last line\n`;
    message += `  ${chalk.blue('dd:')} Delete line\n`;
    message += `  ${chalk.blue('yy:')} Copy line\n`;
    message += `  ${chalk.blue('p:')} Paste\n`;
    message += `  ${chalk.blue('u:')} Undo\n`;
    message += `  ${chalk.blue('/:')} Search\n\n`;
    
    message += `${chalk.bold('MARIA-Specific:')}\n`;
    message += `• All MARIA commands work normally in command mode\n`;
    message += `• Use ${chalk.code('/vim keys')} to see all bindings\n`;
    message += `• Use ${chalk.code('/vim config')} to customize settings\n`;
    message += `• Use ${chalk.code('/vim off')} to disable vim mode\n\n`;
    
    message += `${chalk.blue('💡 Pro Tips:')}\n`;
    message += `• Start with basic navigation (hjkl) and insertion (i)\n`;
    message += `• Practice one command at a time\n`;
    message += `• Use visual mode (v) for precise selections\n`;
    message += `• Customize leader key for personal shortcuts`;
    
    return { success: true, message };
  }

  private async resetToDefaults(): Promise<SlashCommandResult> {
    const defaultConfig = this.getDefaultConfig();
    await this.saveConfig(defaultConfig);
    
    return {
      success: true,
      message: `✅ Vim configuration reset to defaults!\n\n` +
               `All key bindings and preferences have been restored.\n` +
               `Vim mode is ${defaultConfig.enabled ? 'enabled' : 'disabled'}.\n\n` +
               `Use \`/vim status\` to see current configuration.`
    };
  }

  private async exportConfig(args: string[]): Promise<SlashCommandResult> {
    const exportPath = args[0] || 'vim-config-export.json';
    const config = await this.loadConfig();
    
    await fs.writeFile(exportPath, JSON.stringify(config, null, 2));
    
    return {
      success: true,
      message: `✅ Vim configuration exported to ${exportPath}`
    };
  }

  private async importConfig(args: string[]): Promise<SlashCommandResult> {
    if (args.length === 0) {
      return {
        success: false,
        message: 'Usage: /vim import <config-file>'
      };
    }
    
    try {
      const content = await fs.readFile(args[0], 'utf-8');
      const importedConfig: VimConfig = JSON.parse(content);
      
      // Validate config structure
      if (!importedConfig.keyBindings || !importedConfig.modes || !importedConfig.preferences) {
        return {
          success: false,
          message: 'Invalid vim configuration file format'
        };
      }
      
      await this.saveConfig(importedConfig);
      
      return {
        success: true,
        message: `✅ Vim configuration imported from ${args[0]}\n` +
                 `Status: ${importedConfig.enabled ? 'Enabled' : 'Disabled'}`
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to import configuration: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  private async testBindings(): Promise<SlashCommandResult> {
    const config = await this.loadConfig();
    
    if (!config.enabled) {
      return {
        success: false,
        message: 'Vim mode is disabled. Enable it first with `/vim on`'
      };
    }
    
    const testKeys = ['h', 'j', 'k', 'l', 'i', 'u', 'dd', 'yy'];
    let message = `\n${chalk.bold('🧪 Testing Key Bindings')}\n\n`;
    
    let allWorking = true;
    
    for (const key of testKeys) {
      const binding = config.keyBindings[key];
      const status = binding ? chalk.green('✓') : chalk.red('✗');
      
      message += `${status} ${chalk.blue(key.padEnd(4))} → ${binding || 'Not bound'}\n`;
      
      if (!binding) {
        allWorking = false;
      }
    }
    
    message += `\n${chalk.bold('Result:')} ${allWorking ? 
      chalk.green('All test bindings are working!') : 
      chalk.yellow('Some bindings may need attention')}\n`;
    
    message += `\n${chalk.blue('💡 Note:')} This is a configuration test only.\n`;
    message += `Actual key handling depends on your terminal and system.`;
    
    return { success: allWorking, message };
  }
}