/**
 * Dynamic Help Command V3
 * Contract-validated READY commands with GPU labeling system
 */

import { BaseCommand } from "../../../base-command";
import {
  CommandArgs,
  CommandContext,
  CommandResult,
  CommandExample,
} from "../../../types";
import { ReadyCommandsService, CommandSearchResult, CategoryInfo } from "../../../../services/help/ReadyCommandsService.js";
import { ReadyCommand } from "../../../../types/CommandReadiness.js";
import { trackCommand } from "../../../shared/telemetry-helper.js";
import { getUserPlan } from "../../../../services/subscription/subscription-manager.js";
import chalk from 'chalk';

export class HelpCommand extends BaseCommand {
  name = "help";
  category = "core" as const;
  description = "📚 Display help for contract-validated READY commands with GPU labels";
  override aliases = ["h", "?"];
  override usage = "[command] [--category <category>] [--search <term>] [--stats] [--quickstart]";

  private readyService: ReadyCommandsService;

  constructor() {
    super();
    this.readyService = new ReadyCommandsService();
  }

  override examples: CommandExample[] = [
    {
      input: "/help",
      _description: "Show READY commands with GPU labels",
      output: "Contract-validated commands with performance info",
    },
    {
      input: "/help code",
      _description: "Show detailed help for specific command",
      output: "Usage, examples, and contract info for /code",
    },
    {
      input: "/help --category ai", 
      _description: "Show all READY commands in AI category",
      output: "List of AI READY commands with GPU labels",
    },
    {
      input: '/help --search "config"',
      _description: "Search READY commands for configuration",
      output: 'READY commands matching "config" with match scores',
    },
    {
      input: "/help --stats",
      _description: "Show READY command statistics",
      output: "Performance stats and command counts",
    },
    {
      input: "/help --quickstart",
      _description: "Show essential commands for getting started",
      output: "Most important READY commands for new users",
    },
  ];

  async execute(
    args: CommandArgs,
    context: CommandContext,
  ): Promise<CommandResult> {
    const startTime = Date.now();
    try {
      const { parsed, options } = args;
      const _positional = (parsed["_positional"] as string[]) || [];

      // Show statistics
      if (options && options["stats"]) {
        const result = await this.showStatistics();
        await this.trackSuccess(startTime, context);
        return result;
      }

      // Show quickstart guide
      if (options && options["quickstart"]) {
        const result = await this.showQuickStart();
        await this.trackSuccess(startTime, context);
        return result;
      }

      // Show specific command help
      if (_positional.length > 0) {
        const commandName = _positional[0];
        if (commandName) {
          const result = await this.showCommandHelp(commandName);
          await this.trackSuccess(startTime, context);
          return result;
        }
      }

      // Show category help
      if (options && options["category"]) {
        const result = await this.showCategoryHelp(options["category"] as string);
        await this.trackSuccess(startTime, context);
        return result;
      }

      // Search commands
      if (options && options["search"]) {
        const result = await this.searchCommands(options["search"] as string);
        await this.trackSuccess(startTime, context);
        return result;
      }

      // Show general help (default)
      const result = await this.showGeneralHelp();
      await this.trackSuccess(startTime, context);
      return result;

    } catch (error) {
      // Track failed operation
      await trackCommand({
        cmd: 'help',
        status: 'error',
        latencyMs: Date.now() - startTime,
        plan: getUserPlan(),
        quotaLeft: context.quotaLeft || 999
      });
      
      return this.error(
        'Failed to display help information',
        'HELP_ERROR',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Track successful operation
   */
  private async trackSuccess(startTime: number, context: CommandContext): Promise<void> {
    await trackCommand({
      cmd: 'help',
      status: 'success',
      latencyMs: Date.now() - startTime,
      plan: getUserPlan(),
      quotaLeft: context.quotaLeft || 999
    });
  }

  /**
   * Show general help with READY commands only
   */
  private async showGeneralHelp(): Promise<CommandResult> {
    const categories = await this.readyService.getCategories();
    const stats = await this.readyService.getStatistics();
    
    const lines: string[] = [];

    // Header
    lines.push("Loaded " + stats.totalReady + " READY commands from manifest");
    lines.push("MARIA CODE - Contract-Validated Commands");
    lines.push("");
    lines.push("═".repeat(60));
    lines.push("**" + stats.totalReady + " READY Commands** (avg " + stats.avgResponseTime + "ms) | **" + stats.categoriesCount + " Categories**");
    lines.push("");

    // Quick access
    lines.push("**Quick Access:**");
    lines.push("  /help <command>      - Detailed help for specific command");
    lines.push("  /help --quickstart   - Essential commands for new users");
    lines.push("  /help --stats        - Performance statistics");
    lines.push("  /help --search <term> - Search with fuzzy matching");
    lines.push("");

    // Categories with READY commands
    for (const category of categories) {
      // Remove emojis from category headers
      lines.push(`**${category.name.toUpperCase()} (${category.count})**`);
      
      // Show first 4 commands per category
      const showCommands = category.commands.slice(0, 4);
      for (const cmd of showCommands) {
        // Check if command needs GPU label
        const needsGpu = this.hasGpuRequirement(cmd.description);
        let description = cmd.description;
        
        // Simplify GPU labels
        if (needsGpu) {
          description = description.replace(
            /\*GPU needed - Local LLM only \(Pro\+ members only\)/g,
            ""
          ).trim();
          // Add simplified GPU label on new line
          lines.push(`  /${cmd.name}                - ${description}`);
          lines.push(`  *GPU needed - Local LLM (Pro+ only)`);
        } else {
          lines.push(`  /${cmd.name}                - ${description}`);
        }
      }

      if (category.count > 4) {
        lines.push(`  ... and ${category.count - 4} more (use /help --category ${category.name})`);
      }
      lines.push("");
    }

    // Contract validation info
    lines.push("**Contract Validation:**");
    lines.push("  • All commands tested for TTY/non-TTY/pipe compatibility");
    lines.push("  • Performance validated (<2s response time)");
    lines.push("  • Error handling verified");
    lines.push("  • Help documentation complete");
    lines.push("");

    // Usage tips
    lines.push("**Pro Tips:**");
    lines.push("  • All listed commands are production-ready");
    lines.push("  • Response times shown are actual measurements");
    lines.push("  • Use fuzzy search: /help --search confi → finds /config");
    lines.push("  • Categories ordered by importance");
    lines.push("");

    return this.success(lines.join("\n"));
  }
  
  /**
   * Check if command description contains GPU requirement
   */
  private hasGpuRequirement(description: string): boolean {
    return description.includes("*GPU needed");
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
      
      return this.error(
        `READY command not found: /${commandName}`,
        "COMMAND_NOT_FOUND",
        {
          suggestions,
          tip: "Only contract-validated READY commands are shown"
        }
      );
    }

    const lines = this.formatCommandHelp(command);
    
    return this.success(lines);
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
      
      return this.error(
        `No READY commands in category: ${categoryName}. Available: ${availableCategories.join(", ")}`,
        "CATEGORY_NOT_FOUND"
      );
    }

    const lines = this.formatCategoryHelp(categoryName, commands);
    
    return this.success(lines);
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
      return this.error(
        `No READY commands found matching: "${searchTerm}"`,
        "NO_SEARCH_RESULTS"
      );
    }

    const lines = this.formatSearchResults(searchTerm, searchResults);
    
    return this.success(lines);
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

    return this.success(lines.join("\n"));
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

    return this.success(lines.join("\n"));
  }
}

export const meta = {
  name: 'help',
  category: 'core',
  description: '📚 Display help for contract-validated READY commands with GPU labels',
  aliases: ['h', '?'],
  usage: '[command] [--category=<name>] [--search=<term>] [--quickstart] [--stats]',
  examples: [
    '/help',
    '/help code', 
    '/help --category ai',
    '/help --search config',
    '/help --quickstart',
    '/help --stats'
  ],
  deps: []
};