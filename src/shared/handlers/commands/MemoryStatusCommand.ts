/**
 * MemoryStatusCommandV2
 * Enhanced memory system analytics and status reporting
 * Provides comprehensive insights into memory usage and health
 */

import type { SlashCommandV2 } from "../SlashCommandHandler";
import type {
  CommandContext,
  CommandResult,
} from "../../types/enhanced-context";
import { throwIfAborted, safeAsync } from "../utils/abort-helpers";
import { CommandTracer, traced } from "../utils/tracing";
import { ResultAdapter } from "../adapters/ResultAdapter";
import { ProgressManager } from "../utils/ui-throttling";

interface StatusOptions {
  format: "detailed" | "summary" | "json";
  includeBreakdown: boolean;
  includeTrends: boolean;
  includeHealth: boolean;
}

interface MemoryHealth {
  status: "healthy" | "warning" | "critical";
  score: number; // 0-100
  issues: string[];
  recommendations: string[];
}

export class MemoryStatusCommandV2 implements SlashCommandV2 {
  name = "memory-status";
  aliases = ["mem-status", "status"];
  description = "Display comprehensive memory system status and analytics";
  category = "memory";

  async execute(context: CommandContext): Promise<CommandResult> {
    const { deps, args, signal } = context;
    const { memory, ui } = deps;

    const tracer = new CommandTracer(context);
    const progress = new ProgressManager(ui, signal);
    const startedAt = Date.now();

    try {
      tracer.startSpan("memory_status_execution");

      await progress.update(0, "Gathering memory statistics...");
      throwIfAborted(signal);

      // Parse options
      const options = this.parseOptions(args);

      // Get basic memory statistics
      const stats = await traced(tracer, "get_memory_stats", async () => {
        return await memory.getStats({ signal });
      });

      throwIfAborted(signal);
      await progress.update(30, "Analyzing memory health...");

      // Analyze memory health
      const health = await traced(tracer, "analyze_memory_health", async () => {
        return await this.analyzeMemoryHealth(stats, memory, signal);
      });

      throwIfAborted(signal);
      await progress.update(60, "Generating breakdown analysis...");

      // Get detailed breakdowns if requested
      let breakdownData = null;
      if (options.includeBreakdown) {
        breakdownData = await traced(
          tracer,
          "get_memory_breakdown",
          async () => {
            return await this.getMemoryBreakdown(memory, signal);
          },
        );
      }

      throwIfAborted(signal);
      await progress.update(90, "Formatting status report...");

      // Format the status report
      const statusReport = this.formatStatusReport(
        stats,
        health,
        breakdownData,
        options,
      );

      await progress.update(100, "Status report generated");

      const result: CommandResult = {
        success: true,
        messages: [
          {
            role: "assistant",
            content: statusReport,
          },
        ],
        data: {
          stats,
          health,
          breakdown: breakdownData,
          format: options.format,
          timestamp: new Date().toISOString(),
        },
        metrics: {
          startTime: startedAt,
          endTime: Date.now(),
          duration: Date.now() - startedAt,
          memoryAccess: 1,
          providerCalls: 0,
        },
      };

      tracer.complete(result);
      return result;
    } catch (error) {
      return ResultAdapter.errorResult(
        error,
        "Failed to retrieve memory status",
      );
    } finally {
      await safeAsync(() => progress.complete("Done"), undefined);
    }
  }

  /**
   * Parse command options
   */
  private parseOptions(args: string[]): StatusOptions {
    const options: StatusOptions = {
      format: "detailed",
      includeBreakdown: true,
      includeTrends: false,
      includeHealth: true,
    };

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      if (arg.startsWith("--")) {
        const [key, value] = arg.slice(2).split("=");

        switch (key) {
          case "format":
            const formatValue = value || args[i + 1];
            if (
              formatValue &&
              ["detailed", "summary", "json"].includes(formatValue)
            ) {
              options.format = formatValue as StatusOptions["format"];
              if (!value) i++;
            }
            break;

          case "no-breakdown":
            options.includeBreakdown = false;
            break;

          case "breakdown":
            options.includeBreakdown = true;
            break;

          case "trends":
            options.includeTrends = true;
            break;

          case "no-health":
            options.includeHealth = false;
            break;

          case "health":
            options.includeHealth = true;
            break;
        }
      }
    }

    return options;
  }

  /**
   * Analyze memory system health
   */
  private async analyzeMemoryHealth(
    stats: any,
    memory: any,
    signal?: AbortSignal,
  ): Promise<MemoryHealth> {
    throwIfAborted(signal);

    const health: MemoryHealth = {
      status: "healthy",
      score: 100,
      issues: [],
      recommendations: [],
    };

    let score = 100;

    // Check total memory count
    if (stats.total > 10000) {
      health.issues.push("High memory count may impact performance");
      health.recommendations.push(
        "Consider archiving old memories or using selective cleanup",
      );
      score -= 10;
    }

    // Check average importance
    if (stats.avgImportance < 0.3) {
      health.issues.push(
        "Low average importance suggests memory quality issues",
      );
      health.recommendations.push("Review and clean up low-value memories");
      score -= 15;
    }

    // Check memory age distribution
    if (stats.oldestTimestamp && stats.newestTimestamp) {
      const oldestDate = new Date(stats.oldestTimestamp);
      const newestDate = new Date(stats.newestTimestamp);
      const ageRangeMs = newestDate.getTime() - oldestDate.getTime();
      const ageRangeDays = ageRangeMs / (1000 * 60 * 60 * 24);

      if (ageRangeDays > 365) {
        health.recommendations.push(
          "Consider implementing automatic archival for old memories",
        );
      }
    }

    // Check type distribution
    if (stats.byType) {
      const totalTypes = Object.keys(stats.byType).length;
      if (totalTypes < 2) {
        health.recommendations.push(
          "Diversify memory types for better organization",
        );
        score -= 5;
      }
    }

    // Check memory size
    if (stats.totalSize) {
      const sizeInMB = stats.totalSize / (1024 * 1024);
      if (sizeInMB > 100) {
        health.issues.push(`Large memory size (${sizeInMB.toFixed(1)}MB)`);
        health.recommendations.push(
          "Consider enabling compression for large memories",
        );
        score -= 10;
      }
    }

    // Determine overall status
    health.score = Math.max(0, score);

    if (score >= 80) {
      health.status = "healthy";
    } else if (score >= 60) {
      health.status = "warning";
    } else {
      health.status = "critical";
    }

    return health;
  }

  /**
   * Get detailed memory breakdown
   */
  private async getMemoryBreakdown(
    memory: any,
    signal?: AbortSignal,
  ): Promise<any> {
    throwIfAborted(signal);

    try {
      // Query for different memory types and categories
      const [recentMemories, importantMemories, taggedMemories] =
        await Promise.all([
          memory.query({ limit: 10, maxAge: 7 }, { signal }), // Last 7 days
          memory.query({ minImportance: 0.8, limit: 10 }, { signal }), // High importance
          memory.query({ limit: 20 }, { signal }), // General query for tag analysis
        ]);

      // Analyze tags
      const tagCounts = new Map<string, number>();
      for (const mem of taggedMemories) {
        if (mem.metadata.tags) {
          for (const tag of mem.metadata.tags) {
            tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
          }
        }
      }

      const topTags = Array.from(tagCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      return {
        recent: {
          count: recentMemories.length,
          memories: recentMemories.map((m) => ({
            id: m.id,
            content: this.truncateContent(m.content, 50),
            importance: m.metadata.importance,
            timestamp: m.metadata.timestamp,
          })),
        },
        important: {
          count: importantMemories.length,
          memories: importantMemories.map((m) => ({
            id: m.id,
            content: this.truncateContent(m.content, 60),
            importance: m.metadata.importance,
            tags: m.metadata.tags,
          })),
        },
        tags: {
          total: tagCounts.size,
          top: topTags,
        },
      };
    } catch (error) {
      console.warn("Failed to get memory breakdown:", error);
      return null;
    }
  }

  /**
   * Format the complete status report
   */
  private formatStatusReport(
    stats: any,
    health: MemoryHealth,
    breakdown: any,
    options: StatusOptions,
  ): string {
    if (options.format === "json") {
      return JSON.stringify({ stats, health, breakdown }, null, 2);
    }

    const lines: string[] = [];

    // Header
    lines.push("🧠 **MEMORY SYSTEM STATUS**");
    lines.push("═".repeat(50));
    lines.push("");

    // Health status
    if (options.includeHealth) {
      const healthIcon = this.getHealthIcon(health.status);
      lines.push(
        `${healthIcon} **System Health: ${health.status.toUpperCase()}** (${health.score}/100)`,
      );

      if (health.issues.length > 0) {
        lines.push("");
        lines.push("⚠️ **Issues:**");
        health.issues.forEach((issue) => lines.push(`  • ${issue}`));
      }

      if (health.recommendations.length > 0) {
        lines.push("");
        lines.push("💡 **Recommendations:**");
        health.recommendations.forEach((rec) => lines.push(`  • ${rec}`));
      }
      lines.push("");
    }

    // Basic statistics
    lines.push("📊 **OVERVIEW**");
    lines.push(`Total Memories: ${stats.total.toLocaleString()}`);
    lines.push(
      `Average Importance: ${(stats.avgImportance * 100).toFixed(1)}%`,
    );

    if (stats.totalSize) {
      const sizeInMB = stats.totalSize / (1024 * 1024);
      lines.push(`Storage Size: ${sizeInMB.toFixed(1)} MB`);
    }

    // Age information
    if (stats.oldestTimestamp && stats.newestTimestamp) {
      const oldestDate = new Date(stats.oldestTimestamp);
      const newestDate = new Date(stats.newestTimestamp);
      lines.push(`Oldest Memory: ${oldestDate.toLocaleDateString()}`);
      lines.push(`Newest Memory: ${newestDate.toLocaleDateString()}`);
    }

    lines.push("");

    // Type breakdown
    if (stats.byType && Object.keys(stats.byType).length > 0) {
      lines.push("📋 **MEMORY TYPES**");
      const sortedTypes = Object.entries(stats.byType).sort(
        (a, b) => (b[1] as number) - (a[1] as number),
      );

      for (const [type, count] of sortedTypes) {
        const percentage = (((count as number) / stats.total) * 100).toFixed(1);
        lines.push(`${type}: ${count} (${percentage}%)`);
      }
      lines.push("");
    }

    // Detailed breakdown
    if (options.includeBreakdown && breakdown) {
      // Recent memories
      if (breakdown.recent && breakdown.recent.count > 0) {
        lines.push("🕒 **RECENT ACTIVITY (Last 7 Days)**");
        lines.push(`${breakdown.recent.count} new memories`);

        if (
          options.format === "detailed" &&
          breakdown.recent.memories.length > 0
        ) {
          lines.push("");
          for (const memory of breakdown.recent.memories.slice(0, 3)) {
            const date = new Date(memory.timestamp).toLocaleDateString();
            const importance = this.getImportanceIcon(memory.importance);
            lines.push(`${importance} ${memory.content} (${date})`);
          }
          if (breakdown.recent.memories.length > 3) {
            lines.push(`... and ${breakdown.recent.memories.length - 3} more`);
          }
        }
        lines.push("");
      }

      // Important memories
      if (breakdown.important && breakdown.important.count > 0) {
        lines.push("⭐ **HIGH IMPORTANCE MEMORIES**");
        lines.push(
          `${breakdown.important.count} memories with high importance`,
        );

        if (
          options.format === "detailed" &&
          breakdown.important.memories.length > 0
        ) {
          lines.push("");
          for (const memory of breakdown.important.memories.slice(0, 3)) {
            const tags = memory.tags ? `[${memory.tags.join(", ")}]` : "";
            lines.push(`• ${memory.content} ${tags}`);
          }
          if (breakdown.important.memories.length > 3) {
            lines.push(
              `... and ${breakdown.important.memories.length - 3} more`,
            );
          }
        }
        lines.push("");
      }

      // Tag analysis
      if (breakdown.tags && breakdown.tags.top.length > 0) {
        lines.push("🏷️ **POPULAR TAGS**");
        for (const [tag, count] of breakdown.tags.top.slice(0, 5)) {
          lines.push(`${tag}: ${count} memories`);
        }
        if (breakdown.tags.total > 5) {
          lines.push(`... and ${breakdown.tags.total - 5} more tags`);
        }
        lines.push("");
      }
    }

    // Usage tips
    if (options.format === "detailed") {
      lines.push("💡 **MEMORY TIPS**");
      lines.push("• Use /remember --importance=high for critical information");
      lines.push("• Tag memories for better organization and retrieval");
      lines.push("• Regular cleanup with /forget keeps performance optimal");
      lines.push("• Use /recall with specific tags for targeted searches");
    }

    return lines.join("\n");
  }

  /**
   * Get health status icon
   */
  private getHealthIcon(status: string): string {
    switch (status) {
      case "healthy":
        return "✅";
      case "warning":
        return "⚠️";
      case "critical":
        return "🚨";
      default:
        return "❓";
    }
  }

  /**
   * Get importance icon
   */
  private getImportanceIcon(importance?: number): string {
    if (!importance) return "📝";

    if (importance >= 0.8) return "⭐";
    if (importance >= 0.6) return "📌";
    return "📝";
  }

  /**
   * Truncate content for display
   */
  private truncateContent(content: any, maxLength: number = 50): string {
    const text =
      typeof content === "object"
        ? content.text || content.originalContent || JSON.stringify(content)
        : content;

    return text.length > maxLength
      ? text.substring(0, maxLength) + "..."
      : text;
  }
}

/**
 * Factory function
 */
export function createMemoryStatusCommand(): SlashCommandV2 {
  return new MemoryStatusCommandV2();
}
