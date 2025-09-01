/**
 * ForgetCommandV2
 * Enhanced memory deletion command using V2 architecture
 * Provides selective memory removal with safety features
 */

import type { SlashCommandV2 } from "../SlashCommandHandler";
import type {
  CommandContext,
  CommandResult,
  MemoryQuery,
} from "../../types/enhanced-context";
import { throwIfAborted, safeAsync } from "../utils/abort-helpers";
import { CommandTracer, traced } from "../utils/tracing";
import { ResultAdapter } from "../adapters/ResultAdapter";
import { ProgressManager } from "../utils/ui-throttling";

interface ForgetOptions {
  pattern: string;
  tags?: string[];
  olderThan?: number; // days
  importance?: "low" | "normal" | "high";
  maxImportance?: number;
  confirm: boolean;
  dryRun: boolean;
  preserveHigh: boolean;
}

export class ForgetCommandV2 implements SlashCommandV2 {
  name = "forget";
  aliases = ["delete", "remove"];
  description =
    "Selectively remove memories with safety features and confirmation";
  category = "memory";

  async execute(context: CommandContext): Promise<CommandResult> {
    const { deps, args, signal } = context;
    const { memory, ui } = deps;

    const tracer = new CommandTracer(context);
    const progress = new ProgressManager(ui, signal);
    const startedAt = Date.now();

    try {
      tracer.startSpan("forget_command_execution", {
        argsCount: args.length,
      });

      await progress.update(0, "Processing forget request...");
      throwIfAborted(signal);

      // Parse options
      const options = this.parseOptions(args);
      const validation = this.validateOptions(options);

      if (!validation.valid) {
        return ResultAdapter.errorResult(
          new Error(validation.error),
          "Invalid forget command options",
        );
      }

      await progress.update(20, "Finding memories to remove...");
      throwIfAborted(signal);

      // Build query to find matching memories
      const searchQuery: MemoryQuery = {
        query: options.pattern,
        tags: options.tags,
        maxAge: options.olderThan,
        limit: 1000, // Get many for review
        userId: context.options.userId,
      };

      // Find matching memories
      const candidateMemories = await traced(
        tracer,
        "find_memories_to_forget",
        async () => {
          return await memory.query(searchQuery, { signal });
        },
      );

      throwIfAborted(signal);

      // Apply additional filters
      let memoriesToForget = candidateMemories;

      // Filter by importance
      if (options.importance) {
        const targetImportance = this.importanceToNumber(options.importance);
        memoriesToForget = memoriesToForget.filter(
          (m) =>
            Math.abs((m.metadata.importance || 0.5) - targetImportance) < 0.2,
        );
      }

      if (options.maxImportance !== undefined) {
        memoriesToForget = memoriesToForget.filter(
          (m) => (m.metadata.importance || 0.5) <= options.maxImportance!,
        );
      }

      // Preserve high importance memories if requested
      if (options.preserveHigh) {
        memoriesToForget = memoriesToForget.filter(
          (m) => (m.metadata.importance || 0.5) < 0.8,
        );
      }

      if (memoriesToForget.length === 0) {
        return {
          success: true,
          messages: [
            {
              role: "assistant",
              content: "🔍 No memories found matching your criteria to forget.",
            },
          ],
          data: {
            pattern: options.pattern,
            found: 0,
            removed: 0,
            preserved: candidateMemories.length,
          },
        };
      }

      await progress.update(40, "Reviewing memories for deletion...");
      throwIfAborted(signal);

      // Show what would be deleted
      const preview = this.formatDeletionPreview(memoriesToForget, options);

      // Dry run - just show what would be deleted
      if (options.dryRun) {
        return {
          success: true,
          messages: [
            {
              role: "assistant",
              content: `🔍 **DRY RUN** - Would delete ${memoriesToForget.length} memories:\n\n${preview}\n\n💡 Remove --dry-run to actually delete these memories.`,
            },
          ],
          data: {
            pattern: options.pattern,
            found: memoriesToForget.length,
            dryRun: true,
            memories: memoriesToForget.map((m) => ({
              id: m.id,
              tags: m.metadata.tags,
              importance: m.metadata.importance,
              timestamp: m.metadata.timestamp,
            })),
          },
        };
      }

      // Confirmation required for destructive operations
      if (!options.confirm) {
        const confirmationPrompt = `⚠️ **CONFIRM DELETION**\n\n${preview}\n\nThis will permanently delete ${memoriesToForget.length} memories. Continue?`;

        const confirmed = await ui.confirm(confirmationPrompt, { signal });

        if (!confirmed) {
          return {
            success: false,
            messages: [
              {
                role: "assistant",
                content: "❌ Deletion cancelled by user.",
              },
            ],
            data: {
              pattern: options.pattern,
              cancelled: true,
            },
          };
        }
      }

      await progress.update(70, "Deleting memories...");
      throwIfAborted(signal);

      // Perform deletion with batching for safety
      let deletedCount = 0;
      const errors: string[] = [];
      const batchSize = 10;

      for (let i = 0; i < memoriesToForget.length; i += batchSize) {
        throwIfAborted(signal);

        const batch = memoriesToForget.slice(i, i + batchSize);

        for (const memoryToDelete of batch) {
          try {
            // Delete individual memory (implementation would depend on memory system)
            await memory.clear(
              {
                query: memoryToDelete.id, // Assuming we can delete by ID
              },
              { signal },
            );

            deletedCount++;
          } catch (error) {
            errors.push(
              `Failed to delete memory ${memoryToDelete.id}: ${error}`,
            );
          }
        }

        // Update progress
        const progressPercent =
          70 + (30 * (i + batchSize)) / memoriesToForget.length;
        await progress.update(
          progressPercent,
          `Deleted ${deletedCount}/${memoriesToForget.length} memories...`,
        );
      }

      await progress.update(100, "Deletion completed");

      // Build result message
      let message = `🗑️ Successfully deleted ${deletedCount} memories`;

      if (errors.length > 0) {
        message += `\n⚠️ ${errors.length} errors occurred during deletion`;
      }

      if (options.preserveHigh) {
        const preservedCount =
          candidateMemories.length - memoriesToForget.length;
        if (preservedCount > 0) {
          message += `\n🛡️ Preserved ${preservedCount} high-importance memories`;
        }
      }

      const result: CommandResult = {
        success: errors.length < memoriesToForget.length / 2, // Success if < 50% errors
        messages: [
          {
            role: "assistant",
            content: message,
          },
        ],
        data: {
          pattern: options.pattern,
          found: memoriesToForget.length,
          deleted: deletedCount,
          errors: errors.length,
          preserved: candidateMemories.length - memoriesToForget.length,
          tags: options.tags,
          olderThan: options.olderThan,
        },
        metrics: {
          startTime: startedAt,
          endTime: Date.now(),
          duration: Date.now() - startedAt,
          memoryAccess: candidateMemories.length,
          providerCalls: 0,
        },
      };

      tracer.complete(result);
      return result;
    } catch (error) {
      return ResultAdapter.errorResult(error, "Failed to forget memories");
    } finally {
      await safeAsync(() => progress.complete("Done"), undefined);
    }
  }

  /**
   * Parse command arguments
   */
  private parseOptions(args: string[]): ForgetOptions {
    const options: ForgetOptions = {
      pattern: "",
      tags: undefined,
      olderThan: undefined,
      importance: undefined,
      maxImportance: undefined,
      confirm: false,
      dryRun: false,
      preserveHigh: true, // Default to preserving high importance
    };

    const patternArgs: string[] = [];

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      if (arg.startsWith("--")) {
        const [key, value] = arg.slice(2).split("=");

        switch (key) {
          case "tag":
          case "tags":
            if (value) {
              options.tags = value.split(",").map((t) => t.trim());
            } else if (args[i + 1] && !args[i + 1].startsWith("--")) {
              options.tags = args[i + 1].split(",").map((t) => t.trim());
              i++;
            }
            break;

          case "older-than":
          case "age":
            const ageValue = value || args[i + 1];
            const age = parseInt(ageValue);
            if (!isNaN(age) && age > 0) {
              options.olderThan = age;
              if (!value) i++;
            }
            break;

          case "importance":
            const importanceValue = value || args[i + 1];
            if (
              importanceValue &&
              ["low", "normal", "high"].includes(importanceValue)
            ) {
              options.importance = importanceValue as "low" | "normal" | "high";
              if (!value) i++;
            }
            break;

          case "max-importance":
            const maxImportanceValue = value || args[i + 1];
            const maxImportance = parseFloat(maxImportanceValue);
            if (
              !isNaN(maxImportance) &&
              maxImportance >= 0 &&
              maxImportance <= 1
            ) {
              options.maxImportance = maxImportance;
              if (!value) i++;
            }
            break;

          case "confirm":
          case "yes":
            options.confirm = true;
            break;

          case "dry-run":
          case "preview":
            options.dryRun = true;
            break;

          case "preserve-high":
            options.preserveHigh = true;
            break;

          case "no-preserve":
          case "no-preserve-high":
            options.preserveHigh = false;
            break;
        }
      } else {
        patternArgs.push(arg);
      }
    }

    options.pattern = patternArgs.join(" ").trim();
    return options;
  }

  /**
   * Validate forget options
   */
  private validateOptions(options: ForgetOptions): {
    valid: boolean;
    error?: string;
  } {
    if (
      !options.pattern &&
      !options.tags &&
      !options.olderThan &&
      !options.importance
    ) {
      return {
        valid: false,
        error:
          "Please specify what to forget. Usage: /forget <pattern> [options] or use filters like --tags, --older-than, etc.",
      };
    }

    if (
      options.olderThan !== undefined &&
      (options.olderThan < 1 || options.olderThan > 3650)
    ) {
      return {
        valid: false,
        error: "Age filter must be between 1 and 3650 days",
      };
    }

    if (
      options.maxImportance !== undefined &&
      (options.maxImportance < 0 || options.maxImportance > 1)
    ) {
      return {
        valid: false,
        error: "Maximum importance must be between 0 and 1",
      };
    }

    return { valid: true };
  }

  /**
   * Convert importance level to number
   */
  private importanceToNumber(importance: string): number {
    switch (importance.toLowerCase()) {
      case "low":
        return 0.3;
      case "normal":
        return 0.6;
      case "high":
        return 0.9;
      default:
        return 0.6;
    }
  }

  /**
   * Format deletion preview
   */
  private formatDeletionPreview(
    memories: any[],
    options: ForgetOptions,
  ): string {
    const lines: string[] = [];

    // Group by importance for better overview
    const byImportance = {
      high: memories.filter((m) => (m.metadata.importance || 0.5) >= 0.8),
      normal: memories.filter(
        (m) =>
          (m.metadata.importance || 0.5) >= 0.4 &&
          (m.metadata.importance || 0.5) < 0.8,
      ),
      low: memories.filter((m) => (m.metadata.importance || 0.5) < 0.4),
    };

    if (byImportance.high.length > 0) {
      lines.push(`⭐ **High Importance (${byImportance.high.length}):**`);
      for (const memory of byImportance.high.slice(0, 3)) {
        lines.push(
          `  • ${this.truncateContent(memory.content)} (${this.formatDate(memory.metadata.timestamp)})`,
        );
      }
      if (byImportance.high.length > 3) {
        lines.push(`  • ... and ${byImportance.high.length - 3} more`);
      }
      lines.push("");
    }

    if (byImportance.normal.length > 0) {
      lines.push(`📌 **Normal Importance (${byImportance.normal.length}):**`);
      for (const memory of byImportance.normal.slice(0, 2)) {
        lines.push(
          `  • ${this.truncateContent(memory.content)} (${this.formatDate(memory.metadata.timestamp)})`,
        );
      }
      if (byImportance.normal.length > 2) {
        lines.push(`  • ... and ${byImportance.normal.length - 2} more`);
      }
      lines.push("");
    }

    if (byImportance.low.length > 0) {
      lines.push(`📝 **Low Importance (${byImportance.low.length}):**`);
      if (byImportance.low.length <= 5) {
        for (const memory of byImportance.low) {
          lines.push(
            `  • ${this.truncateContent(memory.content)} (${this.formatDate(memory.metadata.timestamp)})`,
          );
        }
      } else {
        lines.push(`  • ${byImportance.low.length} low importance memories`);
      }
      lines.push("");
    }

    return lines.join("\n");
  }

  /**
   * Truncate content for preview
   */
  private truncateContent(content: any): string {
    const text =
      typeof content === "object"
        ? content.text || content.originalContent || JSON.stringify(content)
        : content;

    return text.length > 60 ? text.substring(0, 60) + "..." : text;
  }

  /**
   * Format date for display
   */
  private formatDate(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (diffDays === 0) return "today";
    if (diffDays === 1) return "yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  }
}

/**
 * Factory function
 */
export function createForgetCommand(): SlashCommandV2 {
  return new ForgetCommandV2();
}
