/**
 * Memory Status Command
 * Show memory usage statistics and health
 */

import { BaseCommand } from "../../base-command";
import { CommandArgs, CommandContext, CommandResult } from "../../types";
import { ChatContextService } from "../../../services/chat-context.service";
import { RememberCommand } from "./remember.command";
import { logger } from "../../../utils/logger";
import { trackCommand, withQuotaFooter } from "../../shared/telemetry-helper.js";
import { getUserPlan } from "../../../services/subscription/subscription-manager.js";

export class MemoryStatusCommand extends BaseCommand {
  name = "memory-status";
  category = "memory" as const;
  description = "Show memory usage statistics and health";
  aliases = ["memory", "mem-status"];

  private chatContext: ChatContextService;
  private rememberCommand: RememberCommand;

  constructor() {
    super();
    this.chatContext = ChatContextService.getInstance();
    this.rememberCommand = new RememberCommand();
  }

  async execute(
    _args: CommandArgs,
    _context: CommandContext,
  ): Promise<CommandResult> {
    const startTime = Date.now();
    try {
      // Get current context stats
      const contextStats = this.chatContext.getStats();

      // Get persistent memory stats
      const memoryStore = (this.rememberCommand as any).memoryStore as Map<
        string,
        any
      >;
      const persistentStats = this.getPersistentMemoryStats(memoryStore);

      // Get token usage indicator
      const tokenIndicator = this.chatContext.getTokenUsageIndicator();

      // Build response
      let response = "📊 **Memory Status Report**\n\n";

      // Current session
      response += "**Current Session:**\n";
      response += tokenIndicator + "\n";
      response += `• Messages in context: ${contextStats.messagesInWindow}\n`;
      response += `• Total messages: ${contextStats.totalMessages}\n`;
      response += `• Compressions: ${contextStats.compressedCount}\n\n`;

      // Persistent memory
      response += "**Persistent Memory:**\n";
      response += `• Total memories: ${persistentStats.totalMemories}\n`;
      response += `• By importance: ⭐ High: ${persistentStats.highImportance}, `;
      response += `Normal: ${persistentStats.normalImportance}, `;
      response += `Low: ${persistentStats.lowImportance}\n`;
      response += `• Tags: ${persistentStats.tags.join(", ") || "none"}\n`;
      response += `• Storage size: ${this.formatBytes(persistentStats.storageSize)}\n\n`;

      // Memory health
      response += "**Health Indicators:**\n";
      const health = this.calculateHealth(contextStats, persistentStats);
      response += `• Token efficiency: ${health.tokenEfficiency}\n`;
      response += `• Memory utilization: ${health.memoryUtilization}\n`;
      response += `• Compression effectiveness: ${health.compressionEffectiveness}\n`;

      // Recommendations
      if (health.recommendations.length > 0) {
        response += "\n**Recommendations:**\n";
        for (const rec of health.recommendations) {
          response += `• ${rec}\n`;
        }
      }

      logger.info("Memory status retrieved", {
        contextStats,
        persistentStats,
        health,
      });

      // Track successful operation
      await trackCommand({
        cmd: 'memory-status',
        status: 'success',
        latencyMs: Date.now() - startTime,
        plan: getUserPlan(),
        quotaLeft: _context.quotaLeft || 999
      });

      return this.success(withQuotaFooter(response, _context.quotaLeft), {
        context: contextStats,
        persistent: persistentStats,
        health,
      });
    } catch (error) {
      logger.error("Failed to get memory status", error);

      // Track failed operation
      await trackCommand({
        cmd: 'memory-status',
        status: 'error',
        latencyMs: Date.now() - startTime,
        plan: getUserPlan(),
        quotaLeft: _context.quotaLeft || 999
      });

      return this.error(
        "Failed to retrieve memory status",
        "STATUS_ERROR",
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  }

  private getPersistentMemoryStats(memoryStore: Map<string, any>): any {
    const stats = {
      totalMemories: 0,
      highImportance: 0,
      normalImportance: 0,
      lowImportance: 0,
      tags: new Set<string>(),
      storageSize: 0,
      oldestMemory: null as any,
      newestMemory: null as any,
    };

    // Handle case where memoryStore is undefined or null
    if (!memoryStore || typeof memoryStore.entries !== 'function') {
      return {
        ...stats,
        tags: Array.from(stats.tags)
      };
    }

    for (const [key, value] of memoryStore.entries()) {
      if (key.startsWith("mem_")) {
        stats.totalMemories++;

        // Count by importance
        switch (value.importance) {
          case "high":
            stats.highImportance++;
            break;
          case "normal":
            stats.normalImportance++;
            break;
          case "low":
            stats.lowImportance++;
            break;
        }

        // Collect tags
        if (value.tag) {
          stats.tags.add(value.tag);
        }

        // Track oldest/newest
        if (
          !stats.oldestMemory ||
          new Date(value.timestamp) < new Date(stats.oldestMemory.timestamp)
        ) {
          stats.oldestMemory = value;
        }
        if (
          !stats.newestMemory ||
          new Date(value.timestamp) > new Date(stats.newestMemory.timestamp)
        ) {
          stats.newestMemory = value;
        }

        // Estimate storage size
        stats.storageSize += JSON.stringify(value).length;
      }
    }

    return {
      ...stats,
      tags: Array.from(stats.tags),
    };
  }

  private calculateHealth(contextStats: any, persistentStats: any): any {
    const recommendations: string[] = [];

    // Token efficiency
    const tokenUsage = contextStats.usagePercentage;
    let tokenEfficiency = "🟢 Good";
    if (tokenUsage > 80) {
      tokenEfficiency = "🔴 Critical";
      recommendations.push(
        "Consider clearing old conversations with /clear --preserve=important",
      );
    } else if (tokenUsage > 60) {
      tokenEfficiency = "🟡 Warning";
      recommendations.push(
        "Token usage is getting high, consider using /clear --mode=display",
      );
    }

    // Memory utilization
    const memoryCount = persistentStats.totalMemories;
    let memoryUtilization = "🟢 Good";
    if (memoryCount > 1000) {
      memoryUtilization = "🟡 High";
      recommendations.push(
        "Consider forgetting old memories with /forget --older-than=30",
      );
    }

    // Compression effectiveness
    const compressionCount = contextStats.compressedCount;
    let compressionEffectiveness = "🟢 Effective";
    if (compressionCount > 10) {
      compressionEffectiveness = "🟡 Frequent";
      recommendations.push(
        "Frequent compressions detected, consider shorter sessions",
      );
    }

    // Add recommendations based on usage patterns
    if (
      persistentStats.highImportance === 0 &&
      persistentStats.totalMemories > 0
    ) {
      recommendations.push(
        "Use --importance=high flag for critical information",
      );
    }

    if (
      persistentStats.tags.length === 0 &&
      persistentStats.totalMemories > 0
    ) {
      recommendations.push("Use --tag flag to organize memories better");
    }

    return {
      tokenEfficiency,
      memoryUtilization,
      compressionEffectiveness,
      recommendations,
    };
  }

  private formatBytes(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} B`;
    } else if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(2)} KB`;
    } else {
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }
  }

  override async validate(
    _args: CommandArgs,
  ): Promise<{ success: boolean; error?: string }> {
    // No validation needed for status command
    return { success: true };
  }
}

// Command metadata for manifest generation
export const meta = {
  name: 'memory-status',
  category: 'memory',
  description: 'Show memory usage statistics and health',
  aliases: ['mem-status'],
  usage: '/memory-status',
  examples: ['/memory-status'],
  deps: [], // No external dependencies
  status: 'stable' as const
};
