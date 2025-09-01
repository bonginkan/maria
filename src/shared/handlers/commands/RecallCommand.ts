/**
 * RecallCommandV2
 * Enhanced memory retrieval command using V2 architecture
 * Provides intelligent search with ranking and filtering
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

interface RecallOptions {
  query: string;
  tags?: string[];
  limit: number;
  minImportance?: number;
  maxAge?: number; // days
  includeExpired?: boolean;
  sortBy: "relevance" | "date" | "importance" | "access_count";
  format: "detailed" | "summary" | "list";
}

export class RecallCommandV2 implements SlashCommandV2 {
  name = "recall";
  aliases = ["search", "find"];
  description =
    "Retrieve stored memories with intelligent search and filtering";
  category = "memory";

  async execute(context: CommandContext): Promise<CommandResult> {
    const { deps, args, signal } = context;
    const { memory, ui } = deps;

    const tracer = new CommandTracer(context);
    const progress = new ProgressManager(ui, signal);
    const startedAt = Date.now();

    try {
      tracer.startSpan("recall_command_execution", {
        argsCount: args.length,
      });

      await progress.update(0, "Parsing search request...");
      throwIfAborted(signal);

      // Parse options
      const options = this.parseOptions(args);
      const validation = this.validateOptions(options);

      if (!validation.valid) {
        return ResultAdapter.errorResult(
          new Error(validation.error),
          "Invalid recall command options",
        );
      }

      await progress.update(20, "Searching memories...");
      throwIfAborted(signal);

      // Build memory query
      const memoryQuery: MemoryQuery = {
        query: options.query,
        tags: options.tags,
        limit: Math.min(options.limit * 2, 100), // Get extra for filtering
        minImportance: options.minImportance,
        maxAge: options.maxAge,
        userId: context.options.userId,
      };

      // Execute search
      const memories = await traced(tracer, "memory_search", async () => {
        return await memory.query(memoryQuery, { signal });
      });

      throwIfAborted(signal);
      await progress.update(60, "Processing results...");

      // Filter expired memories if requested
      let filteredMemories = memories;
      if (!options.includeExpired) {
        const now = new Date();
        filteredMemories = memories.filter((memory) => {
          if (!memory.metadata.expiresAt) return true;
          return new Date(memory.metadata.expiresAt) > now;
        });
      }

      // Sort results
      const sortedMemories = this.sortMemories(
        filteredMemories,
        options.sortBy,
      );

      // Limit final results
      const limitedMemories = sortedMemories.slice(0, options.limit);

      await progress.update(80, "Formatting results...");
      throwIfAborted(signal);

      // Format response
      const formattedResponse = await this.formatResults(
        limitedMemories,
        options,
        memories.length,
        tracer,
      );

      await progress.update(100, "Search completed");

      const result: CommandResult = {
        success: true,
        messages: [
          {
            role: "assistant",
            content: formattedResponse,
          },
        ],
        data: {
          query: options.query,
          totalFound: memories.length,
          filteredCount: filteredMemories.length,
          shown: limitedMemories.length,
          tags: options.tags,
          sortBy: options.sortBy,
          format: options.format,
          memories: limitedMemories.map((m) => ({
            id: m.id,
            tags: m.metadata.tags,
            importance: m.metadata.importance,
            timestamp: m.metadata.timestamp,
            source: m.source,
            score: m.score,
          })),
        },
        metrics: {
          startTime: startedAt,
          endTime: Date.now(),
          duration: Date.now() - startedAt,
          memoryAccess: memories.length,
          providerCalls: 0,
        },
      };

      tracer.complete(result);
      return result;
    } catch (error) {
      return ResultAdapter.errorResult(error, "Failed to retrieve memories");
    } finally {
      await safeAsync(() => progress.complete("Done"), undefined);
    }
  }

  /**
   * Parse command arguments
   */
  private parseOptions(args: string[]): RecallOptions {
    const options: RecallOptions = {
      query: "",
      tags: undefined,
      limit: 10,
      minImportance: undefined,
      maxAge: undefined,
      includeExpired: false,
      sortBy: "relevance",
      format: "detailed",
    };

    const queryArgs: string[] = [];

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

          case "limit":
            const limitValue = value || args[i + 1];
            const limit = parseInt(limitValue);
            if (!isNaN(limit) && limit > 0) {
              options.limit = Math.min(limit, 100); // Cap at 100
              if (!value) i++;
            }
            break;

          case "importance":
          case "min-importance":
            const importanceValue = value || args[i + 1];
            if (importanceValue) {
              if (["low", "normal", "high"].includes(importanceValue)) {
                options.minImportance =
                  this.importanceToNumber(importanceValue);
              } else {
                const num = parseFloat(importanceValue);
                if (!isNaN(num) && num >= 0 && num <= 1) {
                  options.minImportance = num;
                }
              }
              if (!value) i++;
            }
            break;

          case "age":
          case "max-age":
            const ageValue = value || args[i + 1];
            const age = parseInt(ageValue);
            if (!isNaN(age) && age > 0) {
              options.maxAge = age;
              if (!value) i++;
            }
            break;

          case "include-expired":
          case "expired":
            options.includeExpired = true;
            break;

          case "sort":
          case "sort-by":
            const sortValue = value || args[i + 1];
            if (
              sortValue &&
              ["relevance", "date", "importance", "access_count"].includes(
                sortValue,
              )
            ) {
              options.sortBy = sortValue as RecallOptions["sortBy"];
              if (!value) i++;
            }
            break;

          case "format":
            const formatValue = value || args[i + 1];
            if (
              formatValue &&
              ["detailed", "summary", "list"].includes(formatValue)
            ) {
              options.format = formatValue as RecallOptions["format"];
              if (!value) i++;
            }
            break;
        }
      } else {
        queryArgs.push(arg);
      }
    }

    options.query = queryArgs.join(" ").trim();
    return options;
  }

  /**
   * Validate recall options
   */
  private validateOptions(options: RecallOptions): {
    valid: boolean;
    error?: string;
  } {
    if (!options.query && !options.tags) {
      return {
        valid: false,
        error:
          "Please provide a search query or tags. Usage: /recall <query> [options]",
      };
    }

    if (options.limit < 1 || options.limit > 100) {
      return {
        valid: false,
        error: "Limit must be between 1 and 100",
      };
    }

    if (
      options.minImportance !== undefined &&
      (options.minImportance < 0 || options.minImportance > 1)
    ) {
      return {
        valid: false,
        error: "Minimum importance must be between 0 and 1",
      };
    }

    if (
      options.maxAge !== undefined &&
      (options.maxAge < 1 || options.maxAge > 3650)
    ) {
      return {
        valid: false,
        error: "Maximum age must be between 1 and 3650 days",
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
        return 0.0;
    }
  }

  /**
   * Sort memories by specified criteria
   */
  private sortMemories(
    memories: any[],
    sortBy: RecallOptions["sortBy"],
  ): any[] {
    return memories.sort((a, b) => {
      switch (sortBy) {
        case "date":
          return (
            new Date(b.metadata.timestamp).getTime() -
            new Date(a.metadata.timestamp).getTime()
          );

        case "importance":
          return (b.metadata.importance || 0) - (a.metadata.importance || 0);

        case "access_count":
          // This would require tracking access count in metadata
          return (b.metadata.accessCount || 0) - (a.metadata.accessCount || 0);

        case "relevance":
        default:
          return (b.score || 0) - (a.score || 0);
      }
    });
  }

  /**
   * Format search results
   */
  private async formatResults(
    memories: any[],
    options: RecallOptions,
    totalFound: number,
    tracer: any,
  ): Promise<string> {
    if (memories.length === 0) {
      const noResultsMsg = options.query
        ? `🔍 No memories found matching "${options.query}"`
        : "🔍 No memories found matching your criteria";

      const suggestions = [
        "• Try different keywords or broader search terms",
        "• Check if you've used the correct tags",
        "• Use --include-expired to include expired memories",
        "• Reduce --min-importance or --max-age filters",
      ];

      return `${noResultsMsg}\n\n**Search Tips:**\n${suggestions.join("\n")}`;
    }

    const lines: string[] = [];

    // Header with search summary
    const pluralMemories = totalFound === 1 ? "memory" : "memories";
    const headerIcon = this.getSearchIcon(options.sortBy);

    lines.push(
      `${headerIcon} Found ${totalFound} ${pluralMemories}${options.query ? ` for "${options.query}"` : ""}`,
    );

    if (options.tags && options.tags.length > 0) {
      lines.push(`🏷️ Tags: ${options.tags.join(", ")}`);
    }

    if (memories.length < totalFound) {
      lines.push(
        `📋 Showing top ${memories.length} results (sorted by ${options.sortBy})`,
      );
    }

    lines.push(""); // Empty line

    // Format each memory based on format option
    for (let i = 0; i < memories.length; i++) {
      const memory = memories[i];
      const formattedMemory = this.formatSingleMemory(
        memory,
        options.format,
        i + 1,
      );
      lines.push(formattedMemory);
      lines.push(""); // Separator
    }

    // Footer with tips
    if (memories.length >= options.limit && totalFound > options.limit) {
      lines.push(
        `💡 _Use --limit=${Math.min(totalFound, 50)} to see more results_`,
      );
    }

    if (options.format === "summary" && memories.length > 3) {
      lines.push(`💡 _Use --format=detailed for full content_`);
    }

    return lines.join("\n");
  }

  /**
   * Format a single memory
   */
  private formatSingleMemory(
    memory: any,
    format: string,
    index: number,
  ): string {
    const content = memory.content;
    const metadata = memory.metadata;
    const date = new Date(metadata.timestamp);
    const formattedDate =
      date.toLocaleDateString() + " " + date.toLocaleTimeString();

    // Extract actual content
    const actualContent =
      typeof content === "object"
        ? content.text || content.originalContent || JSON.stringify(content)
        : content;

    switch (format) {
      case "list":
        return `${index}. ${actualContent.substring(0, 100)}${actualContent.length > 100 ? "..." : ""}`;

      case "summary":
        const importanceIcon = this.getImportanceIcon(metadata.importance);
        const tags = metadata.tags ? `[${metadata.tags.join(", ")}]` : "";
        return `**${index}. ${importanceIcon} ${tags}**\n${actualContent.substring(0, 200)}${actualContent.length > 200 ? "..." : ""}`;

      case "detailed":
      default:
        const detailImportanceIcon = this.getImportanceIcon(
          metadata.importance,
        );
        const detailTags = metadata.tags
          ? `[${metadata.tags.join(", ")}]`
          : "[general]";
        const sourceInfo = memory.source ? ` (${memory.source})` : "";
        const scoreInfo = memory.score
          ? ` • Score: ${(memory.score * 100).toFixed(1)}%`
          : "";

        let result = `**${index}. ${detailImportanceIcon} ${detailTags}**${sourceInfo}\n`;
        result += `${actualContent}\n`;
        result += `_${formattedDate}${scoreInfo}_`;

        if (metadata.expiresAt) {
          const expiryDate = new Date(metadata.expiresAt);
          const isExpired = expiryDate < new Date();
          result += ` • ${isExpired ? "⏰ Expired" : "⏳ Expires"}: ${expiryDate.toLocaleDateString()}`;
        }

        return result;
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
   * Get search icon based on sort type
   */
  private getSearchIcon(sortBy: string): string {
    switch (sortBy) {
      case "date":
        return "📅";
      case "importance":
        return "⭐";
      case "access_count":
        return "👀";
      case "relevance":
      default:
        return "🔍";
    }
  }
}

/**
 * Factory function
 */
export function createRecallCommand(): SlashCommandV2 {
  return new RecallCommandV2();
}
