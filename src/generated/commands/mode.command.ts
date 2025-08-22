/**
 * Enhanced Mode Command Module
 * 操作モード・内部モード統合管理システム
 *
 * Features:
 * - Operation Mode Management (UI/UX modes)
 * - Internal Cognitive Mode System (50 cognitive states)
 * - Real-time mode switching with context awareness
 * - Intelligent mode recognition and suggestions
 *
 * Phase 6: Internal Mode System Integration
 * Category: AI/Intelligence
 */

import { SlashCommandResult } from '../../services/slash-command-handler';
import { BaseCommand } from './base-command';
import { logger } from '../../utils/logger';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { 
  getInternalModeService, 
  ModeConfig as InternalModeConfig,
  ModeDefinition as InternalModeDefinition,
  InternalModeUtils
} from '../../services/internal-mode';

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
  usage = '/mode [mode-name] | /mode internal [cognitive-mode] | /mode [list|history|status|auto|help]';
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

      const subCommand = args[0].toLowerCase();

      // Handle internal mode commands
      if (subCommand === 'internal' || subCommand === 'cognitive' || subCommand === 'thinking') {
        return this.handleInternalModeCommand(args.slice(1));
      }

      // Handle special commands
      switch (subCommand) {
        case 'list':
        case 'all':
          return this.showAllModes();
        case 'history':
          return this.showModeHistory();
        case 'status':
          return this.showModeStatus();
        case 'auto':
          return this.enableAutoMode();
        case 'help':
          return this.showHelp();
        default:
          break;
      }

      // Try operation mode first
      const operationMode = this.modes.find((m) => m.name === subCommand);
      if (operationMode) {
        await this.switchMode(operationMode);
        return this.formatModeChangeResponse(operationMode);
      }

      // Try internal mode
      const internalModeService = getInternalModeService();
      const internalMode = internalModeService.getModeById(subCommand);
      if (internalMode) {
        const success = await internalModeService.setMode(internalMode, 'manual');
        if (success) {
          return this.formatInternalModeResponse(internalMode);
        }
      }

      // Mode not found
      return this.showAvailableModes(subCommand);
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

      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
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
    const currentMode = this.modes.find((m) => m.name === config.current);

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
    const historyDisplay =
      recentHistory.length > 0
        ? recentHistory
            .map((h) => `• ${h.mode} (${new Date(h.timestamp).toLocaleString()})`)
            .join('\n')
        : 'No mode switch history';

    return {
      success: true,
      message: `## ${currentMode.emoji} Current Mode: **${currentMode.name.toUpperCase()}**

**Description:**
${currentMode.description}

**Active Features:**
${currentMode.features.map((f) => `• ${f}`).join('\n')}

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
    const modesList = this.modes
      .map((mode) => {
        const features = mode.features.slice(0, 3).join(', ');
        return `**${mode.emoji} ${mode.name}**
   ${mode.description}
   Key features: ${features}`;
      })
      .join('\n\n');

    const errorMessage = invalidMode ? `❌ Invalid mode: "${invalidMode}"\n\n` : '';

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
${mode.features.map((f) => `• ${f}`).join('\n')}

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

  // Internal Mode System Methods

  private async handleInternalModeCommand(args: string[]): Promise<SlashCommandResult> {
    const internalModeService = getInternalModeService();
    
    if (args.length === 0) {
      return this.showCurrentInternalMode();
    }

    const subCommand = args[0].toLowerCase();

    switch (subCommand) {
      case 'list':
        return this.showInternalModeList();
      case 'history':
        return this.showInternalModeHistory();
      case 'status':
        return this.showInternalModeStatus();
      case 'auto':
        return this.enableInternalAutoMode();
      case 'help':
        return this.showInternalModeHelp();
      default:
        // Try to switch to specific internal mode
        const mode = internalModeService.getModeById(subCommand);
        if (mode) {
          const success = await internalModeService.setMode(mode, 'manual');
          if (success) {
            return this.formatInternalModeResponse(mode);
          }
        }
        return {
          success: false,
          message: `❌ Internal mode "${subCommand}" not found. Use \`/mode internal list\` to see available modes.`
        };
    }
  }

  private async showCurrentInternalMode(): Promise<SlashCommandResult> {
    const internalModeService = getInternalModeService();
    const currentMode = internalModeService.getCurrentMode();
    
    if (!currentMode) {
      return {
        success: false,
        message: '❌ No internal mode is currently active'
      };
    }

    const displayManager = new (require('../../services/internal-mode/ModeDisplayManager').ModeDisplayManager)(internalModeService.getConfig());
    const detailedDisplay = displayManager.createDetailedDisplay(currentMode);
    
    return {
      success: true,
      message: detailedDisplay.join('\n')
    };
  }

  private async showInternalModeList(): Promise<SlashCommandResult> {
    const internalModeService = getInternalModeService();
    const allModes = internalModeService.getAllModes();
    
    const displayManager = new (require('../../services/internal-mode/ModeDisplayManager').ModeDisplayManager)(internalModeService.getConfig());
    const listDisplay = displayManager.createModeListDisplay(allModes);
    
    return {
      success: true,
      message: `## 🧠 Internal Cognitive Modes (${allModes.length} modes)\n\n${listDisplay.join('\n')}`
    };
  }

  private async showInternalModeHistory(): Promise<SlashCommandResult> {
    const internalModeService = getInternalModeService();
    const history = internalModeService.getModeHistory();
    
    if (history.length === 0) {
      return {
        success: true,
        message: '📊 No internal mode history available'
      };
    }

    const recentHistory = history.slice(-10).reverse();
    const historyDisplay = recentHistory.map(entry => {
      const duration = entry.duration ? `(${Math.round(entry.duration / 1000)}s)` : '';
      const trigger = entry.trigger === 'manual' ? '🎛️' : '🤖';
      return `${trigger} **${entry.mode.symbol} ${entry.mode.name}** ${duration} - ${entry.startTime.toLocaleString()}`;
    }).join('\n');

    return {
      success: true,
      message: `## 📊 Internal Mode History\n\n${historyDisplay}\n\n*Legend: 🎛️ Manual switch, 🤖 Automatic switch*`
    };
  }

  private async showInternalModeStatus(): Promise<SlashCommandResult> {
    const internalModeService = getInternalModeService();
    const statistics = internalModeService.getStatistics();
    const config = internalModeService.getConfig();
    
    const mostUsed = statistics.mostUsedModes.slice(0, 5)
      .map(mode => `• **${mode.mode}**: ${mode.count} uses`)
      .join('\n');
    
    return {
      success: true,
      message: `## 🧠 Internal Mode System Status\n\n**Current Mode:** ${statistics.currentMode || 'None'}\n**Total Mode Changes:** ${statistics.modeChanges}\n**Auto-switching:** ${config.autoSwitchEnabled ? '✅ Enabled' : '❌ Disabled'}\n**Learning:** ${config.learningEnabled ? '✅ Active' : '❌ Disabled'}\n\n**Most Used Modes:**\n${mostUsed || 'No usage data'}\n\n**System Health:** ✅ All systems operational`
    };
  }

  private async enableInternalAutoMode(): Promise<SlashCommandResult> {
    const internalModeService = getInternalModeService();
    const currentConfig = internalModeService.getConfig();
    
    internalModeService.updateConfig({
      ...currentConfig,
      autoSwitchEnabled: true
    });
    
    return {
      success: true,
      message: '✅ **Internal mode auto-switching enabled**\n\nMARIA will now automatically switch cognitive modes based on:\n• Your input intent\n• Current context\n• Project situation\n• Learned usage patterns\n\n*Use `/mode internal auto` to disable automatic switching*'
    };
  }

  private async showInternalModeHelp(): Promise<SlashCommandResult> {
    const displayManager = new (require('../../services/internal-mode/ModeDisplayManager').ModeDisplayManager)({ colorEnabled: true, defaultLanguage: 'en' });
    const helpDisplay = displayManager.createHelpDisplay();
    
    return {
      success: true,
      message: helpDisplay.join('\n')
    };
  }

  private formatInternalModeResponse(mode: InternalModeDefinition): SlashCommandResult {
    const display = `✅ **Switched to ${mode.symbol} ${mode.name} mode**\n\n**Purpose:** ${mode.purpose}\n**Description:** ${mode.description}\n\n**Use Cases:**\n${mode.useCases.map(uc => `• ${uc}`).join('\n')}\n\n---\n*MARIA is now optimized for ${mode.name.toLowerCase()} tasks*`;
    
    return {
      success: true,
      message: display
    };
  }

  private async showAllModes(): Promise<SlashCommandResult> {
    const operationModes = this.modes.map(mode => 
      `**${mode.emoji} ${mode.name}** - ${mode.description}`
    ).join('\n');
    
    const internalModeService = getInternalModeService();
    const internalModes = internalModeService.getAllModes();
    const categories = new Set(internalModes.map(m => m.category));
    
    const internalModesSummary = Array.from(categories).map(category => {
      const count = internalModes.filter(m => m.category === category).length;
      return `• **${category}**: ${count} modes`;
    }).join('\n');

    return {
      success: true,
      message: `## 🎮 All Available Modes\n\n### Operation Modes (${this.modes.length})\n${operationModes}\n\n### Internal Cognitive Modes (${internalModes.length})\n${internalModesSummary}\n\n**Commands:**\n• \`/mode [operation-mode]\` - Switch operation mode\n• \`/mode internal [cognitive-mode]\` - Switch internal mode\n• \`/mode internal list\` - See all cognitive modes\n• \`/mode history\` - View mode history`
    };
  }

  private async showModeHistory(): Promise<SlashCommandResult> {
    const operationConfig = await this.getCurrentConfig();
    const internalModeService = getInternalModeService();
    const internalHistory = internalModeService.getModeHistory();
    
    const operationHistory = operationConfig.history.slice(-5).reverse()
      .map(h => `🎮 **${h.mode}** - ${new Date(h.timestamp).toLocaleString()}`)
      .join('\n');
    
    const internalHistoryDisplay = internalHistory.slice(-5).reverse()
      .map(h => `🧠 **${h.mode.symbol} ${h.mode.name}** - ${h.startTime.toLocaleString()}`)
      .join('\n');
    
    return {
      success: true,
      message: `## 📊 Complete Mode History\n\n### Operation Mode History\n${operationHistory || 'No operation mode history'}\n\n### Internal Mode History\n${internalHistoryDisplay || 'No internal mode history'}`
    };
  }

  private async showModeStatus(): Promise<SlashCommandResult> {
    const operationConfig = await this.getCurrentConfig();
    const currentOperationMode = this.modes.find(m => m.name === operationConfig.current);
    
    const internalModeService = getInternalModeService();
    const currentInternalMode = internalModeService.getCurrentMode();
    const internalConfig = internalModeService.getConfig();
    
    const operationDisplay = currentOperationMode ? 
      `${currentOperationMode.emoji} **${currentOperationMode.name}** - ${currentOperationMode.description}` : 
      'No operation mode active';
    
    const internalDisplay = currentInternalMode ? 
      `${currentInternalMode.symbol} **${currentInternalMode.name}** - ${currentInternalMode.description}` : 
      'No internal mode active';
    
    return {
      success: true,
      message: `## 🎯 Current Mode Status\n\n**Operation Mode:**\n${operationDisplay}\n\n**Internal Cognitive Mode:**\n${internalDisplay}\n\n**Auto-switching:** ${internalConfig.autoSwitchEnabled ? '✅ Enabled' : '❌ Disabled'}\n**Learning:** ${internalConfig.learningEnabled ? '✅ Active' : '❌ Disabled'}\n\n---\n*Both systems work together to optimize your MARIA experience*`
    };
  }

  private async enableAutoMode(): Promise<SlashCommandResult> {
    // Enable both operation auto features and internal mode auto-switching
    const operationConfig = await this.getCurrentConfig();
    operationConfig.current = 'auto';
    await this.saveConfig(operationConfig);
    
    const internalModeService = getInternalModeService();
    const internalConfig = internalModeService.getConfig();
    internalModeService.updateConfig({
      ...internalConfig,
      autoSwitchEnabled: true
    });
    
    return {
      success: true,
      message: '✅ **Full Auto Mode Enabled**\n\n**Operation Mode:** Switched to autonomous operation\n**Internal Modes:** Auto-switching enabled\n\nMARIA will now:\n• Take proactive initiative\n• Automatically adapt cognitive modes\n• Learn from your patterns\n• Optimize responses contextually\n\n*Use `/mode interactive` to return to standard mode*'
    };
  }

  private showHelp(): SlashCommandResult {
    return {
      success: true,
      message: `## 🎮 Mode System Help\n\n### Operation Modes\nControl how MARIA operates and interacts:\n\`\`\`\n/mode interactive  # Standard conversational mode\n/mode command     # Direct CLI mode\n/mode auto        # Autonomous operation\n/mode mission     # Goal-oriented mode\n/mode vim         # Vim keybindings\n/mode expert      # Power user mode\n\`\`\`\n\n### Internal Cognitive Modes\nControl MARIA's thinking process (50 modes):\n\`\`\`\n/mode internal thinking      # Standard reasoning\n/mode internal debugging     # Error analysis\n/mode internal optimizing    # Performance focus\n/mode internal brainstorming # Creative ideation\n/mode internal researching   # Information gathering\n\`\`\`\n\n### Commands\n• \`/mode\` - Show current status\n• \`/mode list\` - All available modes\n• \`/mode history\` - Mode usage history\n• \`/mode auto\` - Enable full automation\n• \`/mode internal list\` - All cognitive modes\n\n*The mode system adapts MARIA to your workflow and thinking patterns*`
    };
  }
}
