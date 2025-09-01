/**
 * Dynamic Help Command V2
 * Phase 3: Shows only contract-validated READY commands
 */

import { BaseCommand } from "../../base-command.js";
import {
  CommandArgs,
  CommandContext, 
  CommandResult,
  CommandExample,
} from "../../../types/command.types.js";
import { ReadyCommandsService, CommandSearchResult, CategoryInfo } from "../../../services/help/ReadyCommandsService.js";
import { ReadyCommand } from "../../../types/CommandReadiness.js";

export class HelpCommand extends BaseCommand {
  name = "help";
  category = "core" as const;
  description = "📚 Display help for contract-validated READY commands only";
  aliases = ["h", "?"];
  usage = "[command] [--category <category>] [--search <term>] [--stats] [--quickstart]";

  private readyService: ReadyCommandsService;

  constructor() {
    super();
    this.readyService = new ReadyCommandsService();
  }

  examples: CommandExample[] = [
    {
      input: "/help",
      description: "Show READY commands organized by category",
      output: "Contract-validated commands with performance info",
    },
    {
      input: "/help code",
      description: "Show detailed help for the code command",
      output: "Usage, examples, and contract info for /code",
    },
    {
      input: "/help --category core", 
      description: "Show all READY commands in core category",
      output: "List of core READY commands with performance metrics",
    },
    {
      input: '/help --search "config"',
      description: "Search READY commands for configuration",
      output: 'READY commands matching "config" with match scores',
    },
    {
      input: "/help --stats",
      description: "Show READY command statistics",
      output: "Performance stats and command counts",
    },
    {
      input: "/help --quickstart",
      description: "Show essential commands for getting started",
      output: "Most important READY commands for new users",
    },
  ];

  async execute(
    args: CommandArgs,
    _context: CommandContext,
  ): Promise<CommandResult> {
    try {
      const { options, parsed } = args;
      const _positional = (parsed["_positional"] as string[]) || [];

      // Show statistics
      if (options["stats"]) {
        return await this.showStatistics();
      }

      // Show quickstart guide
      if (options["quickstart"]) {
        return await this.showQuickStart();
      }

      // Show specific command help
      if (_positional.length > 0) {
        const commandName = _positional[0];
        if (commandName) {
          return await this.showCommandHelp(commandName);
        }
      }

      // Show category help
      if (options["category"]) {
        return await this.showCategoryHelp(options["category"] as string);
      }

      // Search commands
      if (options["search"]) {
        return await this.searchCommands(options["search"] as string);
      }

      // Show general help (default)
      return await this.showGeneralHelp();

    } catch (error) {
      return this.error(
        "Failed to display help information",
        "HELP_ERROR",
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  }

  /**
   * Show general help with READY commands only
   */
  private async showGeneralHelp(): Promise<CommandResult> {
    const categories = await this.readyService.getCategories();
    const stats = await this.readyService.getStatistics();
    
    const lines: string[] = [];

    // Header
    lines.push("");
    lines.push("🚀 MARIA CODE - Contract-Validated Commands");
    lines.push("═".repeat(60));
    lines.push("");
    lines.push(`📊 **${stats.totalReady} READY Commands** (avg ${stats.avgResponseTime}ms) | **${stats.categoriesCount} Categories**`);
    lines.push("");

    // Quick access
    lines.push("**🏃♂️ Quick Access:**");
    lines.push("  /help <command>      - Detailed help for specific command");
    lines.push("  /help --quickstart   - Essential commands for new users");
    lines.push("  /help --stats        - Performance statistics");
    lines.push("  /help --search <term> - Search with fuzzy matching");
    lines.push("");

    // Categories with READY commands
    for (const category of categories) {
      lines.push(`**${category.emoji} ${category.name.toUpperCase()} (${category.count})**`);
      
      // Show first 4 commands per category
      const showCommands = category.commands.slice(0, 4);
      for (const cmd of showCommands) {
        const aliases = cmd.aliases && cmd.aliases.length > 0 
          ? ` (${cmd.aliases.map(a => `/${a}`).join(", ")})` 
          : "";
        const performance = `${cmd.contract.maxResponseTime}ms`;
        
        lines.push(`  /${cmd.name}${aliases.padEnd(15)} - ${cmd.description} [${performance}]`);
      }

      if (category.count > 4) {
        lines.push(`  ... and ${category.count - 4} more (use /help --category ${category.name})`);
      }
      lines.push("");
    }

    // Contract validation info
    lines.push("**✅ Contract Validation:**");
    lines.push("  • All commands tested for TTY/non-TTY/pipe compatibility");
    lines.push("  • Performance validated (<2s response time)");
    lines.push("  • Error handling verified");
    lines.push("  • Help documentation complete");
    lines.push("");

    // Usage tips
    lines.push("**💡 Pro Tips:**");
    lines.push("  • All listed commands are production-ready");
    lines.push("  • Response times shown are actual measurements");
    lines.push("  • Use fuzzy search: /help --search confi → finds /config");
    lines.push("  • Categories ordered by importance");
    lines.push("");

    return {
      success: true,
      message: lines.join("\n"),
      requiresInput: false,
      autoRetry: false,
    };
  }

  /**
   * Show help for specific command
   */
  private async showCommandHelp(commandName: string): Promise<CommandResult> {
    const command = await this.readyService.getCommand(commandName);
    
    if (!command) {
      // Try to suggest similar commands
      const searchResults = await this.readyService.searchCommands(commandName, 3);
      const suggestions = searchResults.map(r => `/${r.command.name}`);
      
      return {
        success: false,
        message: `READY command not found: /${commandName}`,
        requiresInput: false,
        autoRetry: false,
      };
    }

    const lines = this.formatCommandHelp(command);
    
    return {
      success: true,
      message: lines,
      requiresInput: false,
      autoRetry: false,
    };
  }

  /**
   * Format detailed help for a command
   */
  private formatCommandHelp(command: ReadyCommand): string {
    const lines: string[] = [];

    // Header
    lines.push("");
    lines.push(`📖 **/${command.name}** - ${command.description}`);
    lines.push("═".repeat(50));
    lines.push("");

    // Basic info
    lines.push("**ℹ️ Information:**");
    lines.push(`  Category: ${this.readyService['getCategoryEmoji'](command.category)} ${command.category}`);
    lines.push(`  Status: ✅ READY (contract validated)`);
    
    if (command.aliases && command.aliases.length > 0) {
      lines.push(`  Aliases: ${command.aliases.map(a => `/${a}`).join(", ")}`);
    }
    lines.push("");

    // Usage
    lines.push("**🎯 Usage:**");
    lines.push(`  ${command.usage}`);
    lines.push("");

    // Contract info
    lines.push("**📋 Contract Validation:**");
    lines.push(`  ⚡ Performance: ${command.contract.maxResponseTime}ms (tested)`);
    lines.push(`  💻 TTY Mode: ${command.contract.tty ? "✅ Supported" : "❌ Not supported"}`);
    lines.push(`  🔧 Non-TTY Mode: ${command.contract.nonTty ? "✅ Supported" : "❌ Not supported"}`);
    lines.push(`  🔀 Pipe Mode: ${command.contract.pipe ? "✅ Supported" : "❌ Not supported"}`);
    lines.push("");

    // Examples if available
    if (command.examples && command.examples.length > 0) {
      lines.push("**📝 Examples:**");
      for (const example of command.examples) {
        lines.push(`  ${example}`);
      }
      lines.push("");
    }

    // Quick tips
    lines.push("**💡 Quick Tips:**");
    lines.push(`  • This command is production-ready and fully tested`);
    lines.push(`  • Try /${command.name} --help for additional options`);
    if (command.category !== 'core') {
      lines.push(`  • See more ${command.category} commands: /help --category ${command.category}`);
    }
    lines.push("");

    return lines.join("\n");
  }

  /**
   * Show category help
   */
  private async showCategoryHelp(categoryName: string): Promise<CommandResult> {
    const commands = await this.readyService.getCommandsByCategory(categoryName);
    
    if (commands.length === 0) {
      const categories = await this.readyService.getCategories();
      const availableCategories = categories.map(c => c.name);
      
      return {
        success: false,
        message: `No READY commands in category: ${categoryName}. Available: ${availableCategories.join(", ")}`,
        requiresInput: false,
        autoRetry: false,
      };
    }

    const lines = this.formatCategoryHelp(categoryName, commands);
    
    return {
      success: true,
      message: lines,
      requiresInput: false,
      autoRetry: false,
    };
  }

  /**
   * Format category help
   */
  private formatCategoryHelp(categoryName: string, commands: ReadyCommand[]): string {
    const lines: string[] = [];
    const emoji = this.readyService['getCategoryEmoji'](categoryName);

    lines.push("");
    lines.push(`${emoji} **${categoryName.toUpperCase()} COMMANDS** (${commands.length} READY)`);
    lines.push("═".repeat(50));
    lines.push("");

    // Performance summary
    const responseTimes = commands.map(c => c.contract.maxResponseTime);
    const avgTime = Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length);
    const minTime = Math.min(...responseTimes);
    const maxTime = Math.max(...responseTimes);

    lines.push(`**📊 Performance:** ${avgTime}ms avg (${minTime}-${maxTime}ms range)`);
    lines.push("");

    // Commands
    for (const command of commands) {
      lines.push(`**/${command.name}** [${command.contract.maxResponseTime}ms]`);
      lines.push(`  ${command.description}`);
      
      if (command.aliases && command.aliases.length > 0) {
        lines.push(`  Aliases: ${command.aliases.map(a => `/${a}`).join(", ")}`);
      }
      
      // Compatibility icons
      const compat = [
        command.contract.tty ? "💻" : "",
        command.contract.nonTty ? "🔧" : "", 
        command.contract.pipe ? "🔀" : ""
      ].filter(Boolean).join(" ");
      
      if (compat) {
        lines.push(`  Modes: ${compat}`);
      }
      
      lines.push("");
    }

    return lines.join("\n");
  }

  /**
   * Search commands with fuzzy matching
   */
  private async searchCommands(searchTerm: string): Promise<CommandResult> {
    const searchResults = await this.readyService.searchCommands(searchTerm, 10);
    
    if (searchResults.length === 0) {
      return {
        success: false,
        message: `No READY commands found matching: "${searchTerm}"`,
        requiresInput: false,
        autoRetry: false,
      };
    }

    const lines = this.formatSearchResults(searchTerm, searchResults);
    
    return {
      success: true,
      message: lines,
      requiresInput: false,
      autoRetry: false,
    };
  }

  /**
   * Format search results
   */
  private formatSearchResults(searchTerm: string, results: CommandSearchResult[]): string {
    const lines: string[] = [];

    lines.push("");
    lines.push(`🔍 **SEARCH RESULTS** for "${searchTerm}" (${results.length} matches)`);
    lines.push("═".repeat(50));
    lines.push("");

    for (const result of results) {
      const cmd = result.command;
      const matchInfo = `[${result.matchScore}] ${result.matchReasons[0] || 'match'}`;
      
      lines.push(`**/${cmd.name}** (${cmd.category}) ${matchInfo}`);
      lines.push(`  ${cmd.description} [${cmd.contract.maxResponseTime}ms]`);
      
      if (result.matchReasons.length > 1) {
        lines.push(`  Matches: ${result.matchReasons.join(", ")}`);
      }
      
      lines.push("");
    }

    lines.push("**💡 Tip:** Higher scores indicate better matches");
    lines.push("");

    return lines.join("\n");
  }

  /**
   * Show quickstart guide
   */
  private async showQuickStart(): Promise<CommandResult> {
    const quickCommands = await this.readyService.getQuickStartCommands();
    
    const lines: string[] = [];

    lines.push("");
    lines.push("🚀 **MARIA QUICKSTART** - Essential Commands");
    lines.push("═".repeat(50));
    lines.push("");
    lines.push("**🎯 Get Started in 3 Steps:**");
    lines.push("");

    lines.push("**1️⃣ Configure Your AI Provider**");
    const modelCmd = quickCommands.find(c => c.name === 'model');
    if (modelCmd) {
      lines.push(`   /${modelCmd.name} - ${modelCmd.description}`);
      lines.push(`   Try: /model set provider=openai key=sk-...`);
    }
    lines.push("");

    lines.push("**2️⃣ Check System Status**");
    const statusCmd = quickCommands.find(c => c.name === 'status');
    if (statusCmd) {
      lines.push(`   /${statusCmd.name} - ${statusCmd.description}`);
      lines.push(`   Try: /status`);
    }
    lines.push("");

    lines.push("**3️⃣ Start Coding**");
    const codeCmd = quickCommands.find(c => c.name === 'code');
    if (codeCmd) {
      lines.push(`   /${codeCmd.name} - ${codeCmd.description}`);
      lines.push(`   Try: /code create a hello world function`);
    }
    lines.push("");

    // All essential commands
    lines.push("**🔧 Essential Commands:**");
    for (const cmd of quickCommands) {
      lines.push(`  /${cmd.name.padEnd(12)} - ${cmd.description} [${cmd.contract.maxResponseTime}ms]`);
    }
    lines.push("");

    lines.push("**💡 Next Steps:**");
    lines.push("  • /help --category <name> - Explore command categories");
    lines.push("  • /help --search <term> - Find specific functionality");
    lines.push("  • /help <command> - Get detailed command help");
    lines.push("");

    return {
      success: true,
      message: lines.join("\n"),
      requiresInput: false,
      autoRetry: false,
    };
  }

  /**
   * Show READY command statistics
   */
  private async showStatistics(): Promise<CommandResult> {
    const stats = await this.readyService.getStatistics();
    const categories = await this.readyService.getCategories();
    
    const lines: string[] = [];

    lines.push("");
    lines.push("📊 **READY COMMANDS STATISTICS**");
    lines.push("═".repeat(40));
    lines.push("");

    // Overall stats
    lines.push("**🎯 Overall:**");
    lines.push(`  Total READY Commands: ${stats.totalReady}`);
    lines.push(`  Categories: ${stats.categoriesCount}`);
    lines.push(`  Last Updated: ${stats.lastUpdated?.toLocaleString() || 'Unknown'}`);
    lines.push("");

    // Performance stats
    lines.push("**⚡ Performance:**");
    lines.push(`  Average Response Time: ${stats.avgResponseTime}ms`);
    lines.push(`  Fastest Command: /${stats.fastestCommand}`);
    lines.push(`  Slowest Command: /${stats.slowestCommand}`);
    lines.push("");

    // Category breakdown
    lines.push("**📋 By Category:**");
    for (const category of categories) {
      const avgTime = Math.round(
        category.commands.reduce((sum, cmd) => sum + cmd.contract.maxResponseTime, 0) / category.commands.length
      );
      lines.push(`  ${category.emoji} ${category.name.padEnd(15)}: ${category.count.toString().padStart(2)} commands (${avgTime}ms avg)`);
    }
    lines.push("");

    // Contract validation
    lines.push("**✅ Contract Validation:**");
    lines.push("  All commands tested for:");
    lines.push("  • Basic execution without crashes");
    lines.push("  • TTY/non-TTY/pipe compatibility");
    lines.push("  • Performance requirements (<2000ms)");
    lines.push("  • Error handling and help documentation");
    lines.push("");

    return {
      success: true,
      message: lines.join("\n"),
      requiresInput: false,
      autoRetry: false,
    };
  }

  async handleError(error: Error): Promise<CommandResult> {
    return {
      success: false,
      message: `Failed to show help: ${error.message}`,
      requiresInput: false,
      autoRetry: false,
    };
  }
}

export const meta = {
  name: 'help',
  category: 'core',
  description: '📚 Display help for contract-validated READY commands only',
  aliases: ['h', '?'],
  usage: '[command] [--category=<name>] [--search=<term>] [--quickstart] [--stats]',
  examples: [
    '/help',
    '/help code',
    '/help --category core',
    '/help --search config',
    '/help --quickstart',
    '/help --stats'
  ],
  deps: []
};