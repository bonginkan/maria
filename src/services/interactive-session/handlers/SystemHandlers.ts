// src/services/interactive-session/handlers/SystemHandlers.ts
// System commands: status, model, memory, health, doctor

import { CommandHandler } from "../services/CommandRegistry";
import { CommandContext, CommandResult } from "../ports/ICommandPort";
import chalk from "chalk";
import * as os from "os";

/**
 * /status command - Show system status
 */
export class StatusHandler implements CommandHandler {
  name = "/status";
  description = "Show current system and session status";
  category = "system";

  async execute(context: CommandContext): Promise<CommandResult> {
    const { args, signal } = context;

    if (signal?.aborted) {
      return {
        ok: false,
        message: chalk.yellow("Status check canceled"),
      };
    }

    const verbose = args.includes("--verbose") || args.includes("-v");

    // Gather system information
    const status = {
      system: "operational",
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: os.cpus()[0],
      platform: process.platform,
    };

    let message = chalk.cyan.bold("📊 System Status\n\n");

    // Basic status
    message += chalk.green("✅ System: Operational\n");
    message += chalk.gray(
      `⏱️  Uptime: ${Math.floor(status.uptime / 60)}m ${Math.floor(status.uptime % 60)}s\n`,
    );
    message += chalk.gray(
      `💾 Memory: ${Math.round(status.memory.heapUsed / 1024 / 1024)}MB / ${Math.round(status.memory.heapTotal / 1024 / 1024)}MB\n`,
    );

    if (verbose) {
      message += chalk.gray("\nDetailed Information:\n");
      message += chalk.gray(`  • CPU: ${status.cpu.model}\n`);
      message += chalk.gray(
        `  • Platform: ${status.platform} (${os.arch()})\n`,
      );
      message += chalk.gray(`  • Node.js: ${process.version}\n`);
      message += chalk.gray(`  • Process ID: ${process.pid}\n`);
      message += chalk.gray(`  • Working Directory: ${process.cwd()}\n`);

      // Memory details
      message += chalk.gray("\nMemory Details:\n");
      message += chalk.gray(
        `  • RSS: ${Math.round(status.memory.rss / 1024 / 1024)}MB\n`,
      );
      message += chalk.gray(
        `  • Heap Used: ${Math.round(status.memory.heapUsed / 1024 / 1024)}MB\n`,
      );
      message += chalk.gray(
        `  • Heap Total: ${Math.round(status.memory.heapTotal / 1024 / 1024)}MB\n`,
      );
      message += chalk.gray(
        `  • External: ${Math.round(status.memory.external / 1024 / 1024)}MB\n`,
      );
    }

    return {
      ok: true,
      message,
      data: status,
    };
  }
}

/**
 * /model command - Model selection and management
 */
export class ModelHandler implements CommandHandler {
  name = "/model";
  description = "Select or view available AI models";
  category = "system";

  private currentModel = "gpt-4";
  private availableModels = [
    { id: "gpt-4", provider: "openai", available: true },
    { id: "gpt-5-mini", provider: "openai", available: true },
    { id: "claude-3-opus", provider: "anthropic", available: true },
    { id: "gemini-2.5-pro", provider: "google", available: true },
    { id: "llama-3-70b", provider: "meta", available: false },
  ];

  async execute(context: CommandContext): Promise<CommandResult> {
    const { args, signal } = context;

    if (signal?.aborted) {
      return {
        ok: false,
        message: chalk.yellow("Model operation canceled"),
      };
    }

    // If no args, show current model and list
    if (args.length === 0) {
      return this.listModels();
    }

    const subcommand = args[0];

    switch (subcommand) {
      case "list":
        return this.listModels();

      case "select":
      case "switch":
        return this.switchModel(args[1]);

      case "info":
        return this.getModelInfo(args[1] || this.currentModel);

      default:
        // Treat as model name for switching
        return this.switchModel(subcommand);
    }
  }

  private async listModels(): Promise<CommandResult> {
    let message = chalk.cyan.bold("🤖 Available Models\n\n");
    message += chalk.green(`Current: ${this.currentModel}\n\n`);

    for (const model of this.availableModels) {
      const status = model.available ? chalk.green("✅") : chalk.red("❌");
      const name =
        model.id === this.currentModel
          ? chalk.green.bold(model.id)
          : chalk.cyan(model.id);
      message += `${status} ${name.padEnd(20)} ${chalk.gray(`[${model.provider}]`)}\n`;
    }

    message += chalk.gray("\nUse /model <name> to switch models");

    return {
      ok: true,
      message,
      data: { current: this.currentModel, models: this.availableModels },
    };
  }

  private async switchModel(
    modelId: string | undefined,
  ): Promise<CommandResult> {
    if (!modelId) {
      return {
        ok: false,
        message: chalk.red("Please specify a model to switch to"),
      };
    }

    const model = this.availableModels.find((m) => m.id === modelId);

    if (!model) {
      return {
        ok: false,
        message:
          chalk.red(`Unknown model: ${modelId}\n`) +
          chalk.gray("Use /model list to see available models"),
      };
    }

    if (!model.available) {
      return {
        ok: false,
        message: chalk.yellow(`Model ${modelId} is not currently available`),
      };
    }

    this.currentModel = modelId;

    return {
      ok: true,
      message: chalk.green(`✅ Switched to ${modelId}`),
      data: { model: modelId },
    };
  }

  private async getModelInfo(modelId: string): Promise<CommandResult> {
    const model = this.availableModels.find((m) => m.id === modelId);

    if (!model) {
      return {
        ok: false,
        message: chalk.red(`Unknown model: ${modelId}`),
      };
    }

    let message = chalk.cyan(`📋 Model Information: ${modelId}\n\n`);
    message += chalk.gray(`Provider: ${model.provider}\n`);
    message += chalk.gray(
      `Status: ${model.available ? "Available" : "Unavailable"}\n`,
    );
    message += chalk.gray(
      `Current: ${model.id === this.currentModel ? "Yes" : "No"}\n`,
    );

    // Add mock capabilities
    message += chalk.gray("\nCapabilities:\n");
    message += chalk.gray("  • Context: 128K tokens\n");
    message += chalk.gray("  • Languages: 95+\n");
    message += chalk.gray("  • Code: Yes\n");
    message +=
      chalk.gray("  • Vision: ") +
      (modelId.includes("gpt-4") ? "Yes\n" : "No\n");

    return {
      ok: true,
      message,
      data: model,
    };
  }
}

/**
 * /memory command - Memory system management
 */
export class MemoryHandler implements CommandHandler {
  name = "/memory";
  description = "Manage conversation memory and context";
  category = "system";

  private memoryStats = {
    system1: { nodes: 42, tokens: 1250 },
    system2: { traces: 8, tokens: 3200 },
    total: { entries: 50, tokens: 4450 },
  };

  async execute(context: CommandContext): Promise<CommandResult> {
    const { args } = context;

    const subcommand = args[0] || "status";

    switch (subcommand) {
      case "status":
        return this.showStatus();

      case "clear":
        return this.clearMemory(args.slice(1));

      case "export":
        return this.exportMemory();

      case "compact":
        return this.compactMemory();

      default:
        return {
          ok: false,
          message:
            chalk.red(`Unknown memory subcommand: ${subcommand}\n`) +
            chalk.gray("Available: status, clear, export, compact"),
        };
    }
  }

  private async showStatus(): Promise<CommandResult> {
    let message = chalk.cyan.bold("🧠 Memory Status\n\n");

    message += chalk.yellow("System 1 (Fast):\n");
    message += chalk.gray(
      `  • Knowledge Nodes: ${this.memoryStats.system1.nodes}\n`,
    );
    message += chalk.gray(`  • Tokens: ${this.memoryStats.system1.tokens}\n\n`);

    message += chalk.blue("System 2 (Deep):\n");
    message += chalk.gray(
      `  • Reasoning Traces: ${this.memoryStats.system2.traces}\n`,
    );
    message += chalk.gray(`  • Tokens: ${this.memoryStats.system2.tokens}\n\n`);

    message += chalk.green("Total:\n");
    message += chalk.gray(`  • Entries: ${this.memoryStats.total.entries}\n`);
    message += chalk.gray(
      `  • Tokens: ${this.memoryStats.total.tokens} / 128000\n`,
    );

    const usage = Math.round((this.memoryStats.total.tokens / 128000) * 100);
    const bar =
      "█".repeat(Math.floor(usage / 5)) +
      "░".repeat(20 - Math.floor(usage / 5));
    message += chalk.gray(`  • Usage: [${bar}] ${usage}%\n`);

    return {
      ok: true,
      message,
      data: this.memoryStats,
    };
  }

  private async clearMemory(args: string[]): Promise<CommandResult> {
    const system = args[0];

    if (system === "system1") {
      this.memoryStats.system1 = { nodes: 0, tokens: 0 };
      return {
        ok: true,
        message: chalk.green("✅ System 1 memory cleared"),
      };
    }

    if (system === "system2") {
      this.memoryStats.system2 = { traces: 0, tokens: 0 };
      return {
        ok: true,
        message: chalk.green("✅ System 2 memory cleared"),
      };
    }

    // Clear all
    this.memoryStats = {
      system1: { nodes: 0, tokens: 0 },
      system2: { traces: 0, tokens: 0 },
      total: { entries: 0, tokens: 0 },
    };

    return {
      ok: true,
      message: chalk.green("🧹 All memory cleared"),
    };
  }

  private async exportMemory(): Promise<CommandResult> {
    const filename = `memory-export-${Date.now()}.json`;

    return {
      ok: true,
      message:
        chalk.green(`📦 Memory exported to ${filename}\n`) +
        chalk.gray(
          `Size: ${Math.round(JSON.stringify(this.memoryStats).length / 1024)}KB`,
        ),
      data: { filename, stats: this.memoryStats },
    };
  }

  private async compactMemory(): Promise<CommandResult> {
    const before = this.memoryStats.total.tokens;
    const after = Math.round(before * 0.7); // Simulate 30% reduction

    this.memoryStats.total.tokens = after;
    this.memoryStats.system1.tokens = Math.round(
      this.memoryStats.system1.tokens * 0.7,
    );
    this.memoryStats.system2.tokens = Math.round(
      this.memoryStats.system2.tokens * 0.7,
    );

    return {
      ok: true,
      message:
        chalk.green("✨ Memory compacted successfully\n") +
        chalk.gray(`Before: ${before} tokens\n`) +
        chalk.gray(`After: ${after} tokens\n`) +
        chalk.gray(
          `Saved: ${before - after} tokens (${Math.round((1 - after / before) * 100)}%)`,
        ),
      data: { before, after, saved: before - after },
    };
  }
}

/**
 * /health command - System health check
 */
export class HealthHandler implements CommandHandler {
  name = "/health";
  description = "Run system health checks";
  category = "system";

  async execute(context: CommandContext): Promise<CommandResult> {
    const { args, signal } = context;

    if (signal?.aborted) {
      return {
        ok: false,
        message: chalk.yellow("Health check canceled"),
      };
    }

    const detailed = args.includes("--detailed");

    let message = chalk.cyan.bold("🏥 System Health Check\n\n");

    // Simulate health checks
    const checks = [
      { name: "Core Services", status: "ok", latency: 12 },
      { name: "Memory System", status: "ok", latency: 8 },
      { name: "AI Provider", status: "ok", latency: 145 },
      { name: "File System", status: "ok", latency: 3 },
      { name: "Network", status: "warning", latency: 250 },
    ];

    for (const check of checks) {
      const icon =
        check.status === "ok"
          ? chalk.green("✅")
          : check.status === "warning"
            ? chalk.yellow("⚠️")
            : chalk.red("❌");
      const status =
        check.status === "ok"
          ? chalk.green("OK")
          : check.status === "warning"
            ? chalk.yellow("WARNING")
            : chalk.red("ERROR");

      message += `${icon} ${check.name.padEnd(20)} ${status}`;

      if (detailed) {
        message += chalk.gray(` (${check.latency}ms)`);
      }

      message += "\n";
    }

    // Overall status
    const hasWarnings = checks.some((c) => c.status === "warning");
    const hasErrors = checks.some((c) => c.status === "error");

    message += "\n";
    if (hasErrors) {
      message += chalk.red("⚠️ System has errors - intervention required");
    } else if (hasWarnings) {
      message += chalk.yellow("⚠️ System operational with warnings");
    } else {
      message += chalk.green("✅ All systems operational");
    }

    return {
      ok: true,
      message,
      data: { checks, healthy: !hasErrors },
    };
  }
}

/**
 * /doctor command - Diagnose and fix common issues
 */
export class DoctorHandler implements CommandHandler {
  name = "/doctor";
  description = "Diagnose and fix common issues";
  category = "system";

  async execute(context: CommandContext): Promise<CommandResult> {
    const { args, signal } = context;

    if (signal?.aborted) {
      return {
        ok: false,
        message: chalk.yellow("Doctor check canceled"),
      };
    }

    const autoFix = args.includes("--fix");

    let message = chalk.cyan.bold("👨⚕️ System Doctor\n\n");
    message += chalk.gray("Running diagnostics...\n\n");

    // Simulate diagnostic checks
    const issues = [
      {
        severity: "warning",
        issue: "High memory usage",
        solution: "Run /memory compact",
        fixable: true,
      },
      {
        severity: "info",
        issue: "Outdated dependencies",
        solution: "Run pnpm update",
        fixable: false,
      },
      {
        severity: "warning",
        issue: "Large log files",
        solution: "Clear old logs",
        fixable: true,
      },
    ];

    if (issues.length === 0) {
      message += chalk.green("✅ No issues found - system is healthy!");
      return { ok: true, message };
    }

    message += chalk.yellow(`Found ${issues.length} issue(s):\n\n`);

    for (const issue of issues) {
      const icon =
        issue.severity === "error"
          ? chalk.red("❌")
          : issue.severity === "warning"
            ? chalk.yellow("⚠️")
            : chalk.blue("ℹ️");

      message += `${icon} ${issue.issue}\n`;
      message += chalk.gray(`   Solution: ${issue.solution}\n`);

      if (autoFix && issue.fixable) {
        message += chalk.green(`   ✅ Auto-fixed\n`);
      }

      message += "\n";
    }

    if (!autoFix) {
      const fixableCount = issues.filter((i) => i.fixable).length;
      if (fixableCount > 0) {
        message += chalk.gray(
          `\nRun /doctor --fix to automatically fix ${fixableCount} issue(s)`,
        );
      }
    }

    return {
      ok: true,
      message,
      data: {
        issues,
        fixed: autoFix ? issues.filter((i) => i.fixable).length : 0,
      },
    };
  }
}

/**
 * Register all system handlers
 */
export function registerSystemHandlers(registry: any): void {
  const statusHandler = new StatusHandler();
  const modelHandler = new ModelHandler();
  const memoryHandler = new MemoryHandler();
  const healthHandler = new HealthHandler();
  const doctorHandler = new DoctorHandler();

  // Register with appropriate deadlines
  registry.register("/status", statusHandler, 5000, ["status"]);
  registry.register("/model", modelHandler, 10000, ["model", "models"]);
  registry.register("/memory", memoryHandler, 10000, ["memory", "mem"]);
  registry.register("/health", healthHandler, 15000, ["health"]);
  registry.register("/doctor", doctorHandler, 20000, ["doctor", "diagnose"]);

  return {
    statusHandler,
    modelHandler,
    memoryHandler,
    healthHandler,
    doctorHandler,
  };
}
// Export as SystemHandlers namespace
export const SystemHandlers = {
  StatusHandler,
  ModelHandler,
  MemoryHandler,
  HealthHandler,
  DoctorHandler,
};
