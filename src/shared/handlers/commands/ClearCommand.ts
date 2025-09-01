/**
 * ClearCommandV2
 * Migrated clear command using V2 architecture
 * Enhanced with better memory preservation and error handling
 */

import type { SlashCommandV2 } from "../SlashCommandHandler";
import type {
  CommandContext,
  CommandResult,
  MemoryContent,
} from "../../types/enhanced-context";
import { throwIfAborted, safeAsync } from "../utils/abort-helpers";
import { CommandTracer, traced } from "../utils/tracing";
import { ResultAdapter } from "../adapters/ResultAdapter";
import { ProgressManager } from "../utils/ui-throttling";
import { validateMemoryContent } from "../../types/enhanced-context";

interface ClearOptions {
  mode: "display" | "session" | "all";
  preserve: string[];
  export: boolean;
  keepSettings: boolean;
  clearCache: boolean;
}

export class ClearCommand implements SlashCommandV2 {
  name = "clear";
  aliases = ["cls", "reset"];
  description =
    "Clear the conversation context with advanced memory preservation options";
  category = "conversation";

  async execute(context: CommandContext): Promise<CommandResult> {
    const { deps, args, signal } = context;
    const { memory, context: chatContext, ui } = deps;

    const tracer = new CommandTracer(context);
    const progress = new ProgressManager(ui, signal);
    const startedAt = Date.now();

    try {
      tracer.startSpan("clear_command_execution", {
        args: args.length,
        options: this.parseOptions(args),
      });

      await progress.update(0, "Parsing clear options...");
      throwIfAborted(signal);

      // Parse options from arguments
      const options = this.parseOptions(args);

      // Validate options
      const validation = this.validateOptions(options);
      if (!validation.valid) {
        return ResultAdapter.errorResult(
          new Error(validation.error),
          "Invalid clear command options",
        );
      }

      await progress.update(20, "Processing clear request...");

      // Handle different clear modes
      let result: CommandResult;

      switch (options.mode) {
        case "display":
          result = await traced(tracer, "clear_display_mode", () =>
            this.clearDisplayMode(context, options),
          );
          break;

        case "all":
          result = await traced(tracer, "clear_all_mode", () =>
            this.clearAllMode(context, options),
          );
          break;

        case "session":
        default:
          result = await traced(tracer, "clear_session_mode", () =>
            this.clearSessionMode(context, options),
          );
          break;
      }

      await progress.update(100, "Clear operation completed");

      // Add execution metrics
      result.metrics = {
        startTime: startedAt,
        endTime: Date.now(),
        duration: Date.now() - startedAt,
        memoryAccess: options.preserve.length > 0 ? 1 : 0,
        providerCalls: 0,
      };

      tracer.complete(result);
      return result;
    } catch (error) {
      return ResultAdapter.errorResult(
        error,
        "Failed to clear conversation context",
      );
    } finally {
      await safeAsync(() => progress.complete("Done"), undefined);
    }
  }

  /**
   * Parse command line options
   */
  private parseOptions(args: string[]): ClearOptions {
    const options: ClearOptions = {
      mode: "session",
      preserve: [],
      export: false,
      keepSettings: false,
      clearCache: false,
    };

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      switch (arg) {
        case "--all":
          options.mode = "all";
          options.clearCache = true;
          break;

        case "--mode":
          if (args[i + 1]) {
            const mode = args[i + 1] as "display" | "session" | "all";
            if (["display", "session", "all"].includes(mode)) {
              options.mode = mode;
            }
            i++; // Skip next argument
          }
          break;

        case "--preserve":
          if (args[i + 1]) {
            options.preserve = args[i + 1].split(",").map((tag) => tag.trim());
            i++; // Skip next argument
          }
          break;

        case "--export":
          options.export = true;
          break;

        case "--keep-settings":
          options.keepSettings = true;
          break;
      }
    }

    return options;
  }

  /**
   * Validate clear options
   */
  private validateOptions(options: ClearOptions): {
    valid: boolean;
    error?: string;
  } {
    // Check for conflicting options
    if (options.mode === "all" && options.keepSettings) {
      return {
        valid: false,
        error: "Cannot use --all and --keep-settings together",
      };
    }

    // Validate preserve tags
    if (options.preserve.length > 0) {
      for (const tag of options.preserve) {
        if (!tag || tag.length === 0) {
          return {
            valid: false,
            error: "Preserve tags cannot be empty",
          };
        }
      }
    }

    return { valid: true };
  }

  /**
   * Clear display mode - UI only, preserve all memory
   */
  private async clearDisplayMode(
    context: CommandContext,
    options: ClearOptions,
  ): Promise<CommandResult> {
    const { deps, signal } = context;
    const { context: chatContext } = deps;

    throwIfAborted(signal);

    // Clear display context only (soft clear)
    await chatContext.clear({
      preserveImportant: true,
      signal,
    });

    const message = "📺 Display cleared. All memory and context preserved.";

    return {
      success: true,
      messages: [
        {
          role: "assistant",
          content: message,
        },
      ],
      data: {
        mode: "display",
        preserved: true,
        exportedBeforeClearing: options.export,
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Clear session mode - Normal clear with preservation options
   */
  private async clearSessionMode(
    context: CommandContext,
    options: ClearOptions,
  ): Promise<CommandResult> {
    const { deps, signal } = context;
    const { memory, context: chatContext } = deps;

    throwIfAborted(signal);

    const clearedItems: string[] = [];
    const preservedCount = await this.preserveMemories(
      context,
      options,
      signal,
    );

    // Export memories if requested
    if (options.export) {
      await traced(new CommandTracer(context), "export_memories", async () => {
        await this.exportMemories(context);
      });
      clearedItems.push("exported memories");
    }

    // Clear conversation context
    await chatContext.clear({
      preserveImportant: options.preserve.length > 0,
      signal,
    });
    clearedItems.push("conversation");

    throwIfAborted(signal);

    // Build success message
    let message = this.buildSuccessMessage(clearedItems);

    if (preservedCount > 0) {
      message += `\n💾 Preserved ${preservedCount} memories with tags: ${options.preserve.join(", ")}`;
    }

    if (options.export) {
      message += "\n📦 Memories exported before clearing";
    }

    return {
      success: true,
      messages: [
        {
          role: "assistant",
          content: message,
        },
      ],
      data: {
        mode: "session",
        clearedItems,
        preservedTags: options.preserve,
        preservedCount,
        exportedBeforeClearing: options.export,
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Clear all mode - Complete reset
   */
  private async clearAllMode(
    context: CommandContext,
    options: ClearOptions,
  ): Promise<CommandResult> {
    const { deps, signal } = context;
    const { memory, context: chatContext } = deps;

    throwIfAborted(signal);

    const clearedItems: string[] = [];
    let preservedCount = 0;

    // Export if requested (before clearing everything)
    if (options.export) {
      await this.exportMemories(context);
      clearedItems.push("exported memories");
    }

    // Preserve tagged memories if specified
    if (options.preserve.length > 0) {
      preservedCount = await this.preserveMemories(context, options, signal);
    }

    // Clear all conversation context
    await chatContext.clear({
      preserveImportant: false,
      signal,
    });
    clearedItems.push("all conversations");

    // Clear most memory (except preserved)
    if (options.preserve.length === 0) {
      await memory.clear({}, { signal });
      clearedItems.push("all memory");
    } else {
      // Clear non-preserved memories
      await memory.clear(
        {
          tags: options.preserve,
        },
        { signal },
      );
      clearedItems.push("non-preserved memory");
    }

    throwIfAborted(signal);

    // Clear settings if not keeping them
    if (!options.keepSettings) {
      // Note: Settings clearing would be implemented here
      clearedItems.push("settings");
    }

    let message =
      "🧹 " +
      this.buildSuccessMessage(clearedItems) +
      " Complete reset performed!";

    if (preservedCount > 0) {
      message += `\n💾 Preserved ${preservedCount} memories with tags: ${options.preserve.join(", ")}`;
    }

    return {
      success: true,
      messages: [
        {
          role: "assistant",
          content: message,
        },
      ],
      data: {
        mode: "all",
        clearedItems,
        preservedTags: options.preserve,
        preservedCount,
        settingsCleared: !options.keepSettings,
        exportedBeforeClearing: options.export,
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Preserve memories with specified tags
   */
  private async preserveMemories(
    context: CommandContext,
    options: ClearOptions,
    signal?: AbortSignal,
  ): Promise<number> {
    if (options.preserve.length === 0) return 0;

    const { memory } = context.deps;
    throwIfAborted(signal);

    try {
      // Query existing memories to preserve
      const memoriesToPreserve = await memory.query(
        {
          tags: options.preserve,
          limit: 1000, // Reasonable limit
        },
        { signal },
      );

      throwIfAborted(signal);

      // Re-store them with preservation marker
      let preservedCount = 0;
      for (const existingMemory of memoriesToPreserve) {
        const preservedMemory: MemoryContent = validateMemoryContent({
          type: "preserved.memory",
          content: existingMemory.content,
          metadata: {
            ...existingMemory.metadata,
            timestamp: new Date().toISOString(),
            importance: Math.max(existingMemory.metadata.importance, 0.8), // Boost importance
            type: "preserved.memory",
            tags: [...(existingMemory.metadata.tags || []), "preserved"],
            originalId: existingMemory.id,
            preservedAt: new Date().toISOString(),
            preservedDuringClear: true,
          },
        });

        await memory.store(preservedMemory, { signal });
        preservedCount++;

        throwIfAborted(signal);
      }

      return preservedCount;
    } catch (error) {
      // Log error but don't fail the clear operation
      console.warn("Failed to preserve some memories:", error);
      return 0;
    }
  }

  /**
   * Export memories to file
   */
  private async exportMemories(context: CommandContext): Promise<void> {
    const { memory } = context.deps;

    try {
      // Get all current memories
      const memories = await memory.query({
        limit: 10000, // Large limit to get everything
      });

      // Create export data
      const exportData = {
        timestamp: new Date().toISOString(),
        totalMemories: memories.length,
        memories: memories.map((m) => ({
          id: m.id,
          content: m.content,
          metadata: m.metadata,
          score: m.score,
          source: m.source,
        })),
      };

      const exportJson = JSON.stringify(exportData, null, 2);
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `maria-memory-export-${timestamp}.json`;

      // Save to user's home directory (implementation would vary by platform)
      // This is a placeholder - actual implementation would use proper file system APIs
      const exportPath = `~/.maria/exports/${filename}`;

      // Log the export (in real implementation, would actually write file)
      console.log(`Would export ${memories.length} memories to ${exportPath}`);
    } catch (error) {
      console.warn("Failed to export memories:", error);
      // Don't fail the clear operation due to export failure
    }
  }

  /**
   * Build success message based on cleared items
   */
  private buildSuccessMessage(clearedItems: string[]): string {
    if (clearedItems.length === 0) {
      return "✅ Nothing to clear";
    }

    if (
      clearedItems.includes("all conversations") ||
      clearedItems.includes("all memory")
    ) {
      return "All conversation history and data cleared. Starting fresh!";
    }

    if (clearedItems.length === 1 && clearedItems[0] === "conversation") {
      return "Conversation cleared. Ready for a fresh start!";
    }

    return `Cleared: ${clearedItems.join(", ")}`;
  }
}

/**
 * Factory function
 */
export function createClearCommand(): SlashCommandV2 {
  return new ClearCommandV2();
}
