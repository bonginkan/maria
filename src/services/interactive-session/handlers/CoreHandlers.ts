/**
 * Core Handlers for Interactive Session
 *
 * Essential command handlers for basic session operations
 * Includes help, clear, exit, version, and history commands
 */

import chalk from "chalk";
import { performance } from "perf_hooks";
import { CommandHandler, CommandResult } from "../types";

/**
 * Help command handler
 * Shows available commands and usage information
 */
export class HelpHandler implements CommandHandler {
  private registry: any;

  constructor(registry: any) {
    this.registry = registry;
  }

  async execute(args: string[]): Promise<CommandResult> {
    const startTime = performance.now();

    // Get available commands from registry
    const commands = this.registry.getCommands();

    let message = chalk.cyan(`🤖 MARIA v3.5.0 - Available Commands\n\n`);

    // Group commands by category
    const categories = {
      core: ["/help", "/clear", "/exit", "/version", "/history"],
      conversation: ["/chat", "/context", "/memory"],
      development: ["/code", "/test", "/review", "/debug", "/deploy"],
      business: ["/business", "/pilot", "/dashboard"],
      system: ["/status", "/config", "/logs", "/approve"],
    };

    for (const [category, cmds] of Object.entries(categories)) {
      message += chalk.yellow(`\n${category.toUpperCase()}:\n`);
      for (const cmd of cmds) {
        if (commands.includes(cmd)) {
          message += `  ${chalk.green(cmd.padEnd(15))} - ${this.getCommandDescription(cmd)}\n`;
        }
      }
    }

    message += chalk.gray(
      `\nType '/help <command>' for detailed information about a specific command.`,
    );

    const processingTime = performance.now() - startTime;

    return {
      success: true,
      message,
      data: { commands, categories },
      metadata: {
        processingTime,
        timestamp: new Date(),
      },
    };
  }

  private getCommandDescription(command: string): string {
    const descriptions: Record<string, string> = {
      "/help": "Show this help message",
      "/clear": "Clear the terminal screen",
      "/exit": "Exit the interactive session",
      "/version": "Show version information",
      "/history": "Show command history",
      "/chat": "Start a conversation",
      "/context": "Manage conversation context",
      "/memory": "Manage memory system",
      "/code": "Natural language code operations",
      "/test": "Run tests and validation",
      "/review": "Code review operations",
      "/debug": "Debug and troubleshoot",
      "/deploy": "Deployment operations",
      "/business": "Business operations",
      "/pilot": "Pilot team management",
      "/dashboard": "Business dashboards",
      "/status": "System status",
      "/config": "Configuration management",
      "/logs": "View system logs",
      "/approve": "Approval management",
    };

    return descriptions[command] || "No description available";
  }
}

/**
 * Clear command handler
 * Clears the terminal screen
 */
export class ClearHandler implements CommandHandler {
  async execute(args: string[]): Promise<CommandResult> {
    const startTime = performance.now();

    // Clear screen using ANSI escape codes
    process.stdout.write("\x1b[2J\x1b[0f");

    const processingTime = performance.now() - startTime;

    return {
      success: true,
      message: chalk.gray("Terminal cleared."),
      metadata: {
        processingTime,
        timestamp: new Date(),
      },
    };
  }
}

/**
 * Exit command handler
 * Exits the interactive session gracefully
 */
export class ExitHandler implements CommandHandler {
  async execute(args: string[]): Promise<CommandResult> {
    const startTime = performance.now();

    const message = chalk.yellow("👋 Goodbye! Thank you for using MARIA.\n");

    // Emit exit event
    process.emit("SIGTERM" as any);

    const processingTime = performance.now() - startTime;

    return {
      success: true,
      message,
      metadata: {
        processingTime,
        timestamp: new Date(),
        action: "exit",
      },
    };
  }
}

/**
 * Version command handler
 * Shows version and system information
 */
export class VersionHandler implements CommandHandler {
  async execute(args: string[]): Promise<CommandResult> {
    const startTime = performance.now();

    const packageInfo = {
      name: "@bonginkan/maria",
      version: "3.5.0",
      node: process.version,
      platform: process.platform,
      arch: process.arch,
    };

    let message = chalk.cyan("🚀 MARIA System Information\n\n");
    message += chalk.white(`  Version:  ${chalk.green(packageInfo.version)}\n`);
    message += chalk.white(`  Package:  ${chalk.green(packageInfo.name)}\n`);
    message += chalk.white(`  Node:     ${chalk.green(packageInfo.node)}\n`);
    message += chalk.white(
      `  Platform: ${chalk.green(packageInfo.platform)}\n`,
    );
    message += chalk.white(`  Arch:     ${chalk.green(packageInfo.arch)}\n`);
    message += chalk.gray(`\n  Build:    Production\n`);
    message += chalk.gray(`  License:  MIT\n`);

    const processingTime = performance.now() - startTime;

    return {
      success: true,
      message,
      data: packageInfo,
      metadata: {
        processingTime,
        timestamp: new Date(),
      },
    };
  }
}

/**
 * History command handler
 * Shows command history for the session
 */
export class HistoryHandler implements CommandHandler {
  private history: string[] = [];

  async execute(args: string[]): Promise<CommandResult> {
    const startTime = performance.now();

    // Parse arguments
    const limit = args[0] ? parseInt(args[0], 10) : 10;

    // Add current command to history
    if (args.join(" ")) {
      this.history.push(`/history ${args.join(" ")}`);
    } else {
      this.history.push("/history");
    }

    // Get recent history
    const recent = this.history.slice(-limit);
    let message = chalk.cyan(`📜 Command History (last ${recent.length}):\n\n`);

    recent.forEach((cmd, index) => {
      const num = this.history.length - recent.length + index + 1;
      message +=
        chalk.gray(`  ${num.toString().padStart(3)}: `) +
        chalk.white(cmd) +
        "\n";
    });

    if (recent.length === 0) {
      message = chalk.gray("No command history available.");
    }

    const processingTime = performance.now() - startTime;

    return {
      success: true,
      message,
      data: { history: recent, total: this.history.length },
      metadata: {
        processingTime,
        timestamp: new Date(),
      },
    };
  }

  addToHistory(command: string): void {
    this.history.push(command);
    // Keep history limited to prevent memory issues
    if (this.history.length > 1000) {
      this.history = this.history.slice(-500);
    }
  }
}

// Export as CoreHandlers namespace
export const CoreHandlers = {
  HelpHandler,
  ClearHandler,
  ExitHandler,
  VersionHandler,
  HistoryHandler,
};

/**
 * Register all core handlers
 */
export function registerCoreHandlers(registry: any): void {
  const helpHandler = new HelpHandler(registry);
  const clearHandler = new ClearHandler();
  const exitHandler = new ExitHandler();
  const versionHandler = new VersionHandler();
  const historyHandler = new HistoryHandler();

  // Register with appropriate deadlines
  registry.register("/help", helpHandler, 5000, ["help", "?"]);
  registry.register("/clear", clearHandler, 5000, ["clear", "cls"]);
  registry.register("/exit", exitHandler, 1000, ["exit", "quit", "bye"]);
  registry.register("/version", versionHandler, 2000, ["version", "ver"]);
  registry.register("/history", historyHandler, 2000, ["history", "hist"]);

  // Export for external use
  return {
    helpHandler,
    clearHandler,
    exitHandler,
    versionHandler,
    historyHandler,
  };
}
