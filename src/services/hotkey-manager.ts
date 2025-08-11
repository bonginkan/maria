/**
 * Hotkey Manager
 * Manages keyboard shortcuts for quick command execution
 */

import { SlashCommandHandler } from './slash-command-handler';
import { ConversationContext } from '../types/conversation';
import { logger } from '../utils/logger';
import chalk from 'chalk';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export interface HotkeyBinding {
  key: string;
  modifiers: string[];
  command: string;
  args?: string[];
  description?: string;
  enabled: boolean;
}

export interface HotkeyConfig {
  bindings: HotkeyBinding[];
  globalEnabled: boolean;
}

export class HotkeyManager {
  private static instance: HotkeyManager;
  private bindings: Map<string, HotkeyBinding> = new Map();
  private commandHandler: SlashCommandHandler | null = null;
  private configPath: string;
  private isEnabled = true;
  // private activeKeys: Set<string> = new Set(); // Reserved for future use

  private constructor() {
    // Initialize commandHandler lazily to avoid circular dependency
    this.configPath = join(homedir(), '.maria', 'hotkeys.json');
    this.loadBindings();
    this.initializeDefaultBindings();
  }

  private getCommandHandler(): SlashCommandHandler {
    if (!this.commandHandler) {
      this.commandHandler = SlashCommandHandler.getInstance();
    }
    return this.commandHandler;
  }

  public static getInstance(): HotkeyManager {
    if (!HotkeyManager.instance) {
      HotkeyManager.instance = new HotkeyManager();
    }
    return HotkeyManager.instance;
  }

  /**
   * Initialize default hotkey bindings
   */
  private initializeDefaultBindings(): void {
    const defaults: HotkeyBinding[] = [
      {
        key: 's',
        modifiers: ['ctrl'],
        command: '/status',
        description: 'Show system status',
        enabled: true,
      },
      {
        key: 'h',
        modifiers: ['ctrl'],
        command: '/help',
        description: 'Show help',
        enabled: true,
      },
      {
        key: 'l',
        modifiers: ['ctrl'],
        command: '/clear',
        description: 'Clear screen',
        enabled: true,
      },
      {
        key: 'e',
        modifiers: ['ctrl'],
        command: '/export',
        args: ['--clipboard'],
        description: 'Export to clipboard',
        enabled: true,
      },
      {
        key: 't',
        modifiers: ['ctrl'],
        command: '/test',
        description: 'Run tests',
        enabled: true,
      },
      {
        key: 'd',
        modifiers: ['ctrl'],
        command: '/doctor',
        description: 'System diagnostics',
        enabled: true,
      },
      {
        key: 'p',
        modifiers: ['ctrl', 'shift'],
        command: '/pr-comments',
        description: 'Show PR comments',
        enabled: true,
      },
      {
        key: 'r',
        modifiers: ['ctrl', 'shift'],
        command: '/review',
        description: 'Run PR review',
        enabled: true,
      },
      {
        key: 'a',
        modifiers: ['ctrl'],
        command: '/agents',
        description: 'Manage agents',
        enabled: true,
      },
      {
        key: 'm',
        modifiers: ['ctrl'],
        command: '/mode',
        args: ['research'],
        description: 'Switch to research mode',
        enabled: true,
      },
    ];

    // Add defaults if not already bound
    defaults.forEach((binding) => {
      const key = this.getBindingKey(binding);
      if (!this.bindings.has(key)) {
        this.bindings.set(key, binding);
      }
    });
  }

  /**
   * Get unique key for binding
   */
  private getBindingKey(binding: HotkeyBinding): string {
    const modifiers = [...binding.modifiers].sort().join('+');
    return modifiers ? `${modifiers}+${binding.key}` : binding.key;
  }

  /**
   * Process keypress event
   */
  async processKeypress(
    key: any,
    context: ConversationContext,
  ): Promise<{ handled: boolean; result?: any }> {
    if (!this.isEnabled || !key) {
      return { handled: false };
    }

    // Build key combination string
    const modifiers: string[] = [];
    if (key.ctrl) modifiers.push('ctrl');
    if (key.shift) modifiers.push('shift');
    if (key.meta) modifiers.push('meta');
    if (key.alt) modifiers.push('alt');

    const keyName = key.name || key.sequence;
    if (!keyName) return { handled: false };

    const bindingKey = modifiers.length > 0 ? `${modifiers.sort().join('+')}+${keyName}` : keyName;

    // Check if we have a binding for this key
    const binding = this.bindings.get(bindingKey);
    if (!binding || !binding.enabled) {
      return { handled: false };
    }

    // Execute the command
    try {
      logger.info(`Hotkey triggered: ${bindingKey} -> ${binding.command}`);

      const result = await this.getCommandHandler().handleCommand(
        binding.command,
        binding.args || [],
        context,
      );

      return { handled: true, result };
    } catch (error) {
      logger.error('Error executing hotkey command:', error);
      return {
        handled: true,
        result: {
          success: false,
          message: `Error executing hotkey: ${error}`,
        },
      };
    }
  }

  /**
   * Add or update hotkey binding
   */
  addBinding(binding: HotkeyBinding): { success: boolean; message: string } {
    const key = this.getBindingKey(binding);

    // Check for conflicts
    const existing = this.bindings.get(key);
    if (existing && existing.command !== binding.command) {
      return {
        success: false,
        message: `Key combination already bound to ${existing.command}`,
      };
    }

    this.bindings.set(key, binding);
    this.saveBindings();

    return {
      success: true,
      message: `Hotkey ${key} bound to ${binding.command}`,
    };
  }

  /**
   * Remove hotkey binding
   */
  removeBinding(key: string): { success: boolean; message: string } {
    if (!this.bindings.has(key)) {
      return {
        success: false,
        message: `No binding found for ${key}`,
      };
    }

    const binding = this.bindings.get(key)!;
    this.bindings.delete(key);
    this.saveBindings();

    return {
      success: true,
      message: `Removed hotkey ${key} (was bound to ${binding.command})`,
    };
  }

  /**
   * Toggle hotkey binding
   */
  toggleBinding(key: string): { success: boolean; message: string } {
    const binding = this.bindings.get(key);
    if (!binding) {
      return {
        success: false,
        message: `No binding found for ${key}`,
      };
    }

    binding.enabled = !binding.enabled;
    this.saveBindings();

    return {
      success: true,
      message: `Hotkey ${key} ${binding.enabled ? 'enabled' : 'disabled'}`,
    };
  }

  /**
   * List all hotkey bindings
   */
  listBindings(): HotkeyBinding[] {
    return Array.from(this.bindings.values()).sort((a, b) => {
      // Sort by modifiers count, then by key
      const aModCount = a.modifiers.length;
      const bModCount = b.modifiers.length;
      if (aModCount !== bModCount) return aModCount - bModCount;
      return a.key.localeCompare(b.key);
    });
  }

  /**
   * Format hotkey for display
   */
  formatHotkey(binding: HotkeyBinding): string {
    const parts = [];

    // Add modifiers in consistent order
    if (binding.modifiers.includes('ctrl')) parts.push('Ctrl');
    if (binding.modifiers.includes('alt')) parts.push('Alt');
    if (binding.modifiers.includes('shift')) parts.push('Shift');
    if (binding.modifiers.includes('meta')) parts.push('Cmd/Win');

    // Add key
    parts.push(binding.key.toUpperCase());

    return parts.join('+');
  }

  /**
   * Parse hotkey string
   */
  parseHotkeyString(hotkeyStr: string): { key: string; modifiers: string[] } | null {
    const parts = hotkeyStr
      .toLowerCase()
      .split('+')
      .map((p) => p.trim());
    if (parts.length === 0) return null;

    const key = parts[parts.length - 1];
    if (!key) return null;

    const modifiers = parts
      .slice(0, -1)
      .filter((m) => ['ctrl', 'alt', 'shift', 'meta', 'cmd', 'win'].includes(m))
      .map((m) => {
        // Normalize cmd/win to meta
        if (m === 'cmd' || m === 'win') return 'meta';
        return m;
      });

    return { key, modifiers };
  }

  /**
   * Enable/disable hotkeys globally
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    logger.info(`Hotkeys ${enabled ? 'enabled' : 'disabled'} globally`);
  }

  /**
   * Check if hotkeys are enabled
   */
  isHotkeysEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Get help text for hotkeys
   */
  getHelpText(): string {
    const bindings = this.listBindings().filter((b) => b.enabled);
    if (bindings.length === 0) {
      return 'No hotkeys configured.';
    }

    let help = chalk.bold('\nAvailable Hotkeys:\n\n');

    bindings.forEach((binding) => {
      const hotkey = chalk.cyan(this.formatHotkey(binding));
      const command = chalk.yellow(binding.command);
      const args = binding.args ? chalk.gray(` ${binding.args.join(' ')}`) : '';
      const desc = binding.description ? chalk.gray(` - ${binding.description}`) : '';
      const status = !binding.enabled ? chalk.red(' [disabled]') : '';

      help += `  ${hotkey.padEnd(20)} → ${command}${args}${desc}${status}\n`;
    });

    help += `\n${chalk.gray('Use /hotkey to manage hotkeys')}\n`;
    return help;
  }

  /**
   * Export hotkey configuration
   */
  exportConfig(): HotkeyConfig {
    return {
      bindings: this.listBindings(),
      globalEnabled: this.isEnabled,
    };
  }

  /**
   * Import hotkey configuration
   */
  importConfig(config: HotkeyConfig): { success: boolean; message: string } {
    try {
      // Clear existing bindings
      this.bindings.clear();

      // Import new bindings
      config.bindings.forEach((binding) => {
        const key = this.getBindingKey(binding);
        this.bindings.set(key, binding);
      });

      this.isEnabled = config.globalEnabled !== false;
      this.saveBindings();

      return {
        success: true,
        message: `Imported ${config.bindings.length} hotkey bindings`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to import config: ${error}`,
      };
    }
  }

  /**
   * Load bindings from file
   */
  private loadBindings(): void {
    try {
      if (existsSync(this.configPath)) {
        const data = readFileSync(this.configPath, 'utf-8');
        const config: HotkeyConfig = JSON.parse(data);
        this.importConfig(config);
      }
    } catch (error) {
      logger.warn('Failed to load hotkey bindings:', error);
    }
  }

  /**
   * Save bindings to file
   */
  private saveBindings(): void {
    try {
      const config = this.exportConfig();
      const dir = join(homedir(), '.maria');

      // Ensure directory exists
      if (!existsSync(dir)) {
        require('fs').mkdirSync(dir, { recursive: true });
      }

      writeFileSync(this.configPath, JSON.stringify(config, null, 2));
    } catch (error) {
      logger.error('Failed to save hotkey bindings:', error);
    }
  }
}
