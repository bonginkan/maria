// src/services/interactive-session/display/StatusDisplay.ts
// Status display components with pure rendering

import chalk from "chalk";
import * as FormatUtils from "./FormatUtils";

export interface SystemStatus {
  operational: boolean;
  uptime: number;
  memory: {
    used: number;
    total: number;
  };
  cpu: {
    usage: number;
    cores: number;
  };
  errors: number;
  warnings: number;
}

export interface MemoryStatus {
  system1: {
    nodes: number;
    tokens: number;
    maxNodes: number;
    maxTokens: number;
  };
  system2: {
    traces: number;
    tokens: number;
    maxTraces: number;
    maxTokens: number;
  };
  total: {
    tokens: number;
    maxTokens: number;
  };
}

export interface ModelStatus {
  current: string;
  available: Array<{
    id: string;
    provider: string;
    available: boolean;
    capabilities?: string[];
  }>;
}

/**
 * StatusDisplay - Pure functions for rendering status information
 * All functions return strings, no console.log or side effects
 */
export class StatusDisplay {
  /**
   * Render system status
   * @param status - System status data
   * @param detailed - Show detailed information
   * @returns Formatted status string
   */
  static renderSystemStatus(status: SystemStatus, detailed = false): string {
    const lines: string[] = [];

    // Header
    lines.push(chalk.cyan.bold("📊 System Status"));
    lines.push("");

    // Operational status
    const statusIcon = status.operational ? "✅" : "❌";
    const statusText = status.operational ? "Operational" : "Issues Detected";
    const statusColor = status.operational ? chalk.green : chalk.red;
    lines.push(`${statusIcon} Status: ${statusColor(statusText)}`);

    // Uptime
    lines.push(
      `⏱️  Uptime: ${FormatUtils.formatDuration(status.uptime * 1000)}`,
    );

    // Memory
    const memoryUsage = (status.memory.used / status.memory.total) * 100;
    const memoryBar = FormatUtils.formatProgressBar(
      status.memory.used,
      status.memory.total,
      15,
    );
    lines.push(
      `💾 Memory: ${FormatUtils.formatBytes(status.memory.used)} / ${FormatUtils.formatBytes(status.memory.total)} ${memoryBar}`,
    );

    // CPU
    const cpuBar = FormatUtils.formatProgressBar(status.cpu.usage, 100, 15);
    lines.push(
      `🖥️  CPU: ${status.cpu.usage.toFixed(1)}% ${cpuBar} (${status.cpu.cores} cores)`,
    );

    // Errors and warnings
    if (status.errors > 0 || status.warnings > 0) {
      lines.push("");
      if (status.errors > 0) {
        lines.push(chalk.red(`❌ Errors: ${status.errors}`));
      }
      if (status.warnings > 0) {
        lines.push(chalk.yellow(`⚠️  Warnings: ${status.warnings}`));
      }
    }

    if (detailed) {
      lines.push("");
      lines.push(chalk.gray("Detailed Information:"));

      const details = FormatUtils.formatKeyValue(
        {
          "Process ID": process.pid,
          "Node Version": process.version,
          Platform: process.platform,
          Architecture: process.arch,
          "Working Directory": process.cwd(),
        },
        {
          keyColor: chalk.gray,
          valueColor: chalk.white,
        },
      );

      lines.push(details);
    }

    return lines.join("\n");
  }

  /**
   * Render memory status
   * @param status - Memory status data
   * @returns Formatted memory status string
   */
  static renderMemoryStatus(status: MemoryStatus): string {
    const lines: string[] = [];

    // Header
    lines.push(chalk.cyan.bold("🧠 Memory Status"));
    lines.push("");

    // System 1
    lines.push(chalk.yellow("System 1 (Fast):"));
    const s1NodeBar = FormatUtils.formatProgressBar(
      status.system1.nodes,
      status.system1.maxNodes,
      15,
    );
    lines.push(
      `  • Nodes: ${status.system1.nodes}/${status.system1.maxNodes} ${s1NodeBar}`,
    );

    const s1TokenBar = FormatUtils.formatProgressBar(
      status.system1.tokens,
      status.system1.maxTokens,
      15,
    );
    lines.push(
      `  • Tokens: ${status.system1.tokens}/${status.system1.maxTokens} ${s1TokenBar}`,
    );
    lines.push("");

    // System 2
    lines.push(chalk.blue("System 2 (Deep):"));
    const s2TraceBar = FormatUtils.formatProgressBar(
      status.system2.traces,
      status.system2.maxTraces,
      15,
    );
    lines.push(
      `  • Traces: ${status.system2.traces}/${status.system2.maxTraces} ${s2TraceBar}`,
    );

    const s2TokenBar = FormatUtils.formatProgressBar(
      status.system2.tokens,
      status.system2.maxTokens,
      15,
    );
    lines.push(
      `  • Tokens: ${status.system2.tokens}/${status.system2.maxTokens} ${s2TokenBar}`,
    );
    lines.push("");

    // Total
    lines.push(chalk.green("Total:"));
    const totalBar = FormatUtils.formatProgressBar(
      status.total.tokens,
      status.total.maxTokens,
      20,
    );
    lines.push(`  • Tokens: ${status.total.tokens}/${status.total.maxTokens}`);
    lines.push(`  • Usage: ${totalBar}`);

    // Usage percentage
    const usage = (status.total.tokens / status.total.maxTokens) * 100;
    const usageColor =
      usage > 80 ? chalk.red : usage > 60 ? chalk.yellow : chalk.green;
    lines.push(
      `  • ${usageColor(FormatUtils.formatPercentage(usage / 100, 1))} utilized`,
    );

    return lines.join("\n");
  }

  /**
   * Render model status
   * @param status - Model status data
   * @returns Formatted model status string
   */
  static renderModelStatus(status: ModelStatus): string {
    const lines: string[] = [];

    // Header
    lines.push(chalk.cyan.bold("🤖 Model Status"));
    lines.push("");

    // Current model
    lines.push(chalk.green(`Current: ${chalk.bold(status.current)}`));
    lines.push("");

    // Available models
    lines.push("Available Models:");

    const headers = ["Model", "Provider", "Status", "Capabilities"];
    const rows = status.available.map((model) => {
      const statusIcon = model.available ? "✅" : "❌";
      const capabilities = model.capabilities?.join(", ") || "-";
      return [model.id, model.provider, statusIcon, capabilities];
    });

    const table = FormatUtils.formatTable(headers, rows, {
      columnWidths: [20, 15, 8, 30],
      separator: " │ ",
      headerColor: chalk.gray,
    });

    lines.push(table);

    return lines.join("\n");
  }

  /**
   * Render health check results
   * @param checks - Array of health check results
   * @returns Formatted health check string
   */
  static renderHealthChecks(
    checks: Array<{
      name: string;
      status: "ok" | "warning" | "error";
      latency?: number;
      message?: string;
    }>,
  ): string {
    const lines: string[] = [];

    // Header
    lines.push(chalk.cyan.bold("🏥 Health Checks"));
    lines.push("");

    // Individual checks
    for (const check of checks) {
      const icon =
        check.status === "ok" ? "✅" : check.status === "warning" ? "⚠️" : "❌";

      const statusColor =
        check.status === "ok"
          ? chalk.green
          : check.status === "warning"
            ? chalk.yellow
            : chalk.red;

      let line = `${icon} ${check.name.padEnd(25)} ${statusColor(check.status.toUpperCase())}`;

      if (check.latency !== undefined) {
        const latencyColor =
          check.latency < 100
            ? chalk.green
            : check.latency < 500
              ? chalk.yellow
              : chalk.red;
        line += ` ${latencyColor(`(${check.latency}ms)`)}`;
      }

      lines.push(line);

      if (check.message) {
        lines.push(chalk.gray(`   ${check.message}`));
      }
    }

    // Summary
    lines.push("");
    const okCount = checks.filter((c) => c.status === "ok").length;
    const warningCount = checks.filter((c) => c.status === "warning").length;
    const errorCount = checks.filter((c) => c.status === "error").length;

    if (errorCount > 0) {
      lines.push(
        chalk.red(
          `⚠️ System has ${errorCount} error(s) - intervention required`,
        ),
      );
    } else if (warningCount > 0) {
      lines.push(
        chalk.yellow(`⚠️ System operational with ${warningCount} warning(s)`),
      );
    } else {
      lines.push(chalk.green("✅ All systems operational"));
    }

    return lines.join("\n");
  }

  /**
   * Render session statistics
   * @param stats - Session statistics
   * @returns Formatted statistics string
   */
  static renderSessionStats(stats: {
    turnCount: number;
    commandCount: number;
    errorCount: number;
    avgResponseTime: number;
    uptime: number;
    memoryUsed: number;
  }): string {
    const lines: string[] = [];

    // Header
    lines.push(chalk.cyan.bold("📈 Session Statistics"));
    lines.push("");

    const data = FormatUtils.formatKeyValue(
      {
        "Total Turns": stats.turnCount,
        "Commands Executed": stats.commandCount,
        Errors: stats.errorCount,
        "Avg Response Time": `${stats.avgResponseTime.toFixed(0)}ms`,
        "Session Duration": FormatUtils.formatDuration(stats.uptime),
        "Memory Usage": FormatUtils.formatBytes(stats.memoryUsed),
      },
      {
        keyWidth: 20,
        keyColor: chalk.gray,
        valueColor: chalk.white,
      },
    );

    lines.push(data);

    // Performance indicator
    lines.push("");
    const performance =
      stats.avgResponseTime < 100
        ? "Excellent"
        : stats.avgResponseTime < 500
          ? "Good"
          : stats.avgResponseTime < 1000
            ? "Fair"
            : "Poor";

    const perfColor =
      performance === "Excellent"
        ? chalk.green
        : performance === "Good"
          ? chalk.blue
          : performance === "Fair"
            ? chalk.yellow
            : chalk.red;

    lines.push(`Performance: ${perfColor(performance)}`);

    return lines.join("\n");
  }

  /**
   * Render a compact status bar
   * @param data - Status bar data
   * @returns Formatted status bar string
   */
  static renderStatusBar(data: {
    mode?: string;
    model?: string;
    memory?: number;
    latency?: number;
    time?: Date;
  }): string {
    const segments: string[] = [];

    if (data.mode) {
      segments.push(chalk.cyan(`[${data.mode}]`));
    }

    if (data.model) {
      segments.push(chalk.blue(`🤖 ${data.model}`));
    }

    if (data.memory !== undefined) {
      const memoryColor =
        data.memory > 80
          ? chalk.red
          : data.memory > 60
            ? chalk.yellow
            : chalk.green;
      segments.push(memoryColor(`💾 ${data.memory}%`));
    }

    if (data.latency !== undefined) {
      const latencyColor =
        data.latency < 100
          ? chalk.green
          : data.latency < 500
            ? chalk.yellow
            : chalk.red;
      segments.push(latencyColor(`⚡ ${data.latency}ms`));
    }

    if (data.time) {
      segments.push(
        chalk.gray(FormatUtils.formatTimestamp(data.time, "short")),
      );
    }

    return segments.join(" │ ");
  }
}
