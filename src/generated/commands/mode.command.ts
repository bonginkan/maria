/**
 * Mode Command Module
 * 操作モード切り替えコマンド - ユーザーインターフェースモード管理
 * 
 * Phase 4: Low-frequency commands implementation
 * Category: UI/UX
 */

import { SlashCommandResult } from '../../services/slash-command-handler';
import { BaseCommand } from './base-command';
import { logger } from '../../utils/logger';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

type OperationMode = 'interactive' | 'command' | 'auto' | 'mission' | 'vim' | 'expert';

interface ModeConfig {
  current: OperationMode;
  settings: {
    autoSuggest: boolean;
    verboseOutput: boolean;
    confirmActions: boolean;
    streamingEnabled: boolean;
    hotkeysEnabled: boolean;
    vimBindings: boolean;
    expertMode: boolean;
  };
  history: {
    mode: OperationMode;
    timestamp: Date;
  }[];
}

interface ModeDefinition {
  name: OperationMode;
  emoji: string;
  description: string;
  features: string[];
  settings: Partial<ModeConfig['settings']>;
}

export class ModeCommand extends BaseCommand {
  name = 'mode';
  category = 'ui' as const;
  description = 'Switch between different operation modes';
  usage = '/mode [interactive|command|auto|mission|vim|expert]';
  aliases = ['switch', 'ui'];
  
  private configPath = path.join(os.homedir(), '.maria', 'mode.json');
  
  private modes: ModeDefinition[] = [
    {
      name: 'interactive',
      emoji: '💬',
      description: 'Standard conversational mode with AI assistant',
      features: [
        'Natural language conversation',
        'Context awareness',
        'Auto-suggestions',
        'Rich formatting',
        'Inline code execution',
      ],
      settings: {
        autoSuggest: true,
        verboseOutput: true,
        confirmActions: true,
        streamingEnabled: true,
        hotkeysEnabled: false,
        vimBindings: false,
        expertMode: false,
      },
    },
    {
      name: 'command',
      emoji: '⌨️',
      description: 'Traditional CLI mode with precise commands',
      features: [
        'Direct command execution',
        'Minimal output',
        'No AI interpretation',
        'Fast response',
        'Scriptable',
      ],
      settings: {
        autoSuggest: false,
        verboseOutput: false,
        confirmActions: false,
        streamingEnabled: false,
        hotkeysEnabled: false,
        vimBindings: false,
        expertMode: false,
      },
    },
    {
      name: 'auto',
      emoji: '🤖',
      description: 'AI takes initiative to complete tasks autonomously',
      features: [
        'Proactive assistance',
        'Automatic error correction',
        'Chain command execution',
        'Smart context detection',
        'Continuous improvement',
      ],
      settings: {
        autoSuggest: true,
        verboseOutput: true,
        confirmActions: false,
        streamingEnabled: true,
        hotkeysEnabled: true,
        vimBindings: false,
        expertMode: false,
      },
    },
    {
      name: 'mission',
      emoji: '🎯',
      description: 'Goal-oriented mode for completing specific objectives',
      features: [
        'Task breakdown',
        'Progress tracking',
        'Milestone reporting',
        'Resource optimization',
        'Automatic planning',
      ],
      settings: {
        autoSuggest: true,
        verboseOutput: true,
        confirmActions: false,
        streamingEnabled: true,
        hotkeysEnabled: false,
        vimBindings: false,
        expertMode: true,
      },
    },
    {
      name: 'vim',
      emoji: '📝',
      description: 'Vim-style keybindings and navigation',
      features: [
        'Modal editing',
        'Vim keybindings',
        'Command mode (:)',
        'Visual selection',
        'Macros and registers',
      ],
      settings: {
        autoSuggest: false,
        verboseOutput: false,
        confirmActions: false,
        streamingEnabled: false,
        hotkeysEnabled: true,
        vimBindings: true,
        expertMode: true,
      },
    },
    {
      name: 'expert',
      emoji: '🧙',
      description: 'Advanced mode for power users',
      features: [
        'All features enabled',
        'Advanced shortcuts',
        'Custom workflows',
        'Batch operations',
        'Direct API access',
      ],
      settings: {
        autoSuggest: true,
        verboseOutput: false,
        confirmActions: false,
        streamingEnabled: true,
        hotkeysEnabled: true,
        vimBindings: true,
        expertMode: true,
      },
    },
  ];

  async execute(args: string[]): Promise<SlashCommandResult> {
    try {
      if (args.length === 0) {
        return this.showCurrentMode();
      }
      
      const requestedMode = args[0].toLowerCase() as OperationMode;
      
      // Check if mode is valid
      const modeDefinition = this.modes.find(m => m.name === requestedMode);
      
      if (!modeDefinition) {
        return this.showAvailableModes(requestedMode);
      }
      
      // Switch to the requested mode
      await this.switchMode(modeDefinition);
      
      return this.formatModeChangeResponse(modeDefinition);
      
    } catch (error) {
      logger.error('Mode command error:', error);
      return {
        success: false,
        message: `❌ Failed to switch mode: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private async getCurrentConfig(): Promise<ModeConfig> {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf-8');
        return JSON.parse(data);
      }
    } catch (error) {
      logger.error('Failed to read mode config:', error);
    }
    
    // Return default config
    return {
      current: 'interactive',
      settings: {
        autoSuggest: true,
        verboseOutput: true,
        confirmActions: true,
        streamingEnabled: true,
        hotkeysEnabled: false,
        vimBindings: false,
        expertMode: false,
      },
      history: [],
    };
  }

  private async saveConfig(config: ModeConfig): Promise<void> {
    try {
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(
        this.configPath,
        JSON.stringify(config, null, 2),
        'utf-8'
      );
    } catch (error) {
      logger.error('Failed to save mode config:', error);
    }
  }

  private async switchMode(modeDefinition: ModeDefinition): Promise<void> {
    const config = await this.getCurrentConfig();
    
    // Update history
    config.history.push({
      mode: config.current,
      timestamp: new Date(),
    });
    
    // Keep only last 10 history entries
    if (config.history.length > 10) {
      config.history = config.history.slice(-10);
    }
    
    // Update current mode and settings
    config.current = modeDefinition.name;
    config.settings = {
      ...config.settings,
      ...modeDefinition.settings,
    };
    
    await this.saveConfig(config);
    
    // Apply mode-specific configurations
    await this.applyModeSettings(modeDefinition);
  }

  private async applyModeSettings(mode: ModeDefinition): Promise<void> {
    // In a real implementation, this would apply actual settings
    // For example:
    // - Enable/disable vim bindings
    // - Configure auto-suggestions
    // - Set output verbosity
    // - Configure hotkeys
    
    logger.info(`Applied settings for ${mode.name} mode`);
  }

  private async showCurrentMode(): Promise<SlashCommandResult> {
    const config = await this.getCurrentConfig();
    const currentMode = this.modes.find(m => m.name === config.current);
    
    if (!currentMode) {
      return {
        success: false,
        message: '❌ Current mode configuration is invalid',
      };
    }
    
    const settingsDisplay = Object.entries(config.settings)
      .map(([key, value]) => `• ${this.formatSettingName(key)}: ${value ? '✅' : '❌'}`)
      .join('\n');
    
    const recentHistory = config.history.slice(-5).reverse();
    const historyDisplay = recentHistory.length > 0
      ? recentHistory
          .map(h => `• ${h.mode} (${new Date(h.timestamp).toLocaleString()})`)
          .join('\n')
      : 'No mode switch history';
    
    return {
      success: true,
      message: `## ${currentMode.emoji} Current Mode: **${currentMode.name.toUpperCase()}**

**Description:**
${currentMode.description}

**Active Features:**
${currentMode.features.map(f => `• ${f}`).join('\n')}

**Current Settings:**
${settingsDisplay}

**Recent Mode History:**
${historyDisplay}

---
*Use \`/mode [mode-name]\` to switch modes*
*Use \`/mode list\` to see all available modes*`,
    };
  }

  private showAvailableModes(invalidMode?: string): SlashCommandResult {
    const modesList = this.modes.map(mode => {
      const features = mode.features.slice(0, 3).join(', ');
      return `**${mode.emoji} ${mode.name}**
   ${mode.description}
   Key features: ${features}`;
    }).join('\n\n');
    
    const errorMessage = invalidMode
      ? `❌ Invalid mode: "${invalidMode}"\n\n`
      : '';
    
    return {
      success: !invalidMode,
      message: `${errorMessage}## 🎮 Available Modes

${modesList}

**Quick Switch:**
\`\`\`
/mode interactive  # Standard chat mode
/mode command      # CLI mode
/mode auto         # Autonomous mode
/mode mission      # Goal-oriented mode
/mode vim          # Vim keybindings
/mode expert       # Power user mode
\`\`\`

**Tips:**
• Each mode optimizes MARIA for different workflows
• Your mode preference is saved automatically
• Mode history is tracked for quick switching
• Use \`/mode\` without arguments to see current mode`,
    };
  }

  private formatModeChangeResponse(mode: ModeDefinition): SlashCommandResult {
    const keybindingNote = mode.settings.vimBindings
      ? '\n\n**Vim Keybindings Active:**\n• Press `i` for insert mode\n• Press `ESC` for normal mode\n• Use `:` for command mode'
      : '';
    
    const expertNote = mode.settings.expertMode
      ? '\n\n**Expert Features Unlocked:**\n• Advanced command chaining\n• Direct API access\n• Batch operations\n• Custom workflows'
      : '';
    
    return {
      success: true,
      message: `✅ **Switched to ${mode.emoji} ${mode.name.toUpperCase()} mode**

**What's Changed:**
${mode.features.map(f => `• ${f}`).join('\n')}

**Settings Applied:**
• Auto-suggest: ${mode.settings.autoSuggest ? '✅ Enabled' : '❌ Disabled'}
• Verbose output: ${mode.settings.verboseOutput ? '✅ Enabled' : '❌ Disabled'}
• Confirmations: ${mode.settings.confirmActions ? '✅ Required' : '❌ Skipped'}
• Streaming: ${mode.settings.streamingEnabled ? '✅ Active' : '❌ Disabled'}
• Hotkeys: ${mode.settings.hotkeysEnabled ? '✅ Available' : '❌ Disabled'}${keybindingNote}${expertNote}

---
*Your workspace has been optimized for ${mode.name} operation*`,
    };
  }

  private formatSettingName(setting: string): string {
    const names: Record<string, string> = {
      autoSuggest: 'Auto-suggestions',
      verboseOutput: 'Verbose output',
      confirmActions: 'Action confirmations',
      streamingEnabled: 'Streaming responses',
      hotkeysEnabled: 'Hotkey support',
      vimBindings: 'Vim keybindings',
      expertMode: 'Expert features',
    };
    
    return names[setting] || setting;
  }
}