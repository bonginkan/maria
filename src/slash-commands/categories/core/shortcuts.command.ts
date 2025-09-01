/**
 * Shortcuts Command
 * Display keyboard shortcuts and aliases
 */

import { BaseCommand } from "../../base-command";
import {
  CommandArgs,
  CommandContext,
  CommandResult,
} from "../../../types/command.types";
import chalk from "chalk";

export class ShortcutsCommand extends BaseCommand {
  name = "shortcuts";
  description = "Display keyboard shortcuts and command aliases";
  category = "core";
  aliases = ["hotkeys", "keys", "aliases"];

  async execute(
    args: CommandArgs,
    context: CommandContext
  ): Promise<CommandResult> {
    const category = args.parsed?.positional?.[0] as string;
    
    switch (category?.toLowerCase()) {
      case 'core':
        return this.showCoreShortcuts();
      case 'system':
        return this.showSystemShortcuts();
      case 'code':
        return this.showCodeShortcuts();
      default:
        return this.showAllShortcuts();
    }
  }

  private showAllShortcuts(): CommandResult {
    const output: string[] = [];
    
    output.push('');
    output.push(chalk.cyan.bold('⌨️ MARIA Shortcuts & Aliases'));
    output.push(chalk.gray('═'.repeat(35)));
    output.push('');
    
    output.push(chalk.white.bold('🎯 Most Used Commands:'));
    output.push('  /help → /h              - Quick help');
    output.push('  /version → /v           - Version info');
    output.push('  /quit → /q → /exit      - Exit MARIA');
    output.push('  /clear → /cls           - Clear screen');
    output.push('  /code → /c              - Natural language coding');
    output.push('');
    
    output.push(chalk.white.bold('🔧 System Commands:'));
    output.push('  /status → /health       - System status');
    output.push('  /debug → /diag          - Debug information');
    output.push('  /ping → /test           - Test responsiveness');
    output.push('  /uptime → /runtime      - System uptime');
    output.push('  /performance → /perf    - Performance metrics');
    output.push('');
    
    output.push(chalk.white.bold('📚 Information Commands:'));
    output.push('  /docs → /documentation  - Access docs');
    output.push('  /about → /info          - About MARIA');
    output.push('  /license → /legal       - License info');
    output.push('  /changelog → /history   - Version history');
    output.push('  /credits → /thanks      - Acknowledgments');
    output.push('');
    
    output.push(chalk.white.bold('⚙️ Configuration:'));
    output.push('  /config → /settings     - Configuration');
    output.push('  /setup                  - Initial setup');
    output.push('  /env → /environment     - Environment vars');
    output.push('');
    
    output.push(chalk.white.bold('💬 Support & Feedback:'));
    output.push('  /feedback → /report     - Submit feedback');
    output.push('  /feedback bug → /bug    - Report bugs');
    output.push('');
    
    output.push(chalk.gray('Use /shortcuts [category] for specific shortcuts:'));
    output.push(chalk.gray('  core, system, code'));
    output.push('');
    
    return {
      success: true,
      message: output.join('\n'),
      requiresInput: false,
      autoRetry: false,
    };
  }

  private showCoreShortcuts(): CommandResult {
    const output: string[] = [];
    
    output.push('');
    output.push(chalk.cyan.bold('🎯 Core Command Shortcuts'));
    output.push(chalk.gray('═'.repeat(30)));
    output.push('');
    
    output.push(chalk.white('📋 Essential Commands:'));
    output.push('  /help → /h');
    output.push('  /version → /v');
    output.push('  /quit → /q → /exit');
    output.push('  /clear → /cls');
    output.push('');
    
    output.push(chalk.white('📚 Information:'));
    output.push('  /docs → /documentation → /guide → /manual');
    output.push('  /about → /info');
    output.push('  /license → /legal → /terms');
    output.push('  /changelog → /history → /changes → /releases');
    output.push('  /credits → /thanks → /acknowledgments');
    output.push('');
    
    output.push(chalk.white('⚙️ Configuration:'));
    output.push('  /config → /settings → /conf');
    output.push('  /shortcuts → /hotkeys → /keys → /aliases');
    output.push('');
    
    output.push(chalk.white('💬 Support:'));
    output.push('  /feedback → /report → /bug → /suggestion');
    output.push('');
    
    return {
      success: true,
      message: output.join('\n'),
      requiresInput: false,
      autoRetry: false,
    };
  }

  private showSystemShortcuts(): CommandResult {
    const output: string[] = [];
    
    output.push('');
    output.push(chalk.cyan.bold('🖥️ System Command Shortcuts'));
    output.push(chalk.gray('═'.repeat(30)));
    output.push('');
    
    output.push(chalk.white('📊 Monitoring:'));
    output.push('  /status → /health → /info');
    output.push('  /debug → /diag → /diagnostics');
    output.push('  /performance → /perf → /metrics → /stats');
    output.push('  /uptime → /runtime');
    output.push('');
    
    output.push(chalk.white('🔍 Information:'));
    output.push('  /env → /environment → /vars');
    output.push('  /ping → /test');
    output.push('  /whoami → /who → /me');
    output.push('  /time → /clock → /date');
    output.push('');
    
    output.push(chalk.white('🛠️ System Tools:'));
    output.push('  /setup (no aliases)');
    output.push('  /upgrade (no aliases)');
    output.push('');
    
    return {
      success: true,
      message: output.join('\n'),
      requiresInput: false,
      autoRetry: false,
    };
  }

  private showCodeShortcuts(): CommandResult {
    const output: string[] = [];
    
    output.push('');
    output.push(chalk.cyan.bold('💻 Code Command Shortcuts'));
    output.push(chalk.gray('═'.repeat(30)));
    output.push('');
    
    output.push(chalk.white('🤖 Natural Language Coding:'));
    output.push('  /code → /c');
    output.push('');
    
    output.push(chalk.white('🧠 Memory & Knowledge:'));
    output.push('  /remember (no aliases)');
    output.push('  /recall (no aliases)');
    output.push('  /forget (no aliases)');
    output.push('  /memory-status (no aliases)');
    output.push('');
    
    output.push(chalk.white('🔍 Search & Analysis:'));
    output.push('  /search (GraphRAG - no aliases)');
    output.push('  /evaluate (no aliases)');
    output.push('');
    
    output.push(chalk.white('💬 Conversation:'));
    output.push('  /clear → /cls');
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
  name: 'shortcuts',
  category: 'core',
  description: 'Display keyboard shortcuts and command aliases',
  aliases: ['hotkeys', 'keys', 'aliases'],
  usage: '/shortcuts [core|system|code]',
  examples: [
    '/shortcuts',
    '/shortcuts core',
    '/shortcuts system',
    '/shortcuts code'
  ],
  deps: []
};