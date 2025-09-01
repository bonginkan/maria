/**
 * RememberCommandV2
 * Enhanced memory storage command using V2 architecture
 * Provides intelligent memory management with schema validation
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

type ImportanceLevel = "low" | "normal" | "high";

interface RememberOptions {
  content: string;
  tags: string[];
  importance: ImportanceLevel;
  type?: string;
  expiresIn?: number; // days
}

export class RememberCommandV2 implements SlashCommandV2 {
  name = "remember";
  aliases = ["mem", "save"];
  description =
    "Store important information in persistent memory with intelligent categorization";
  category = "memory";

  async execute(context: CommandContext): Promise<CommandResult> {
    const { deps, args, signal } = context;
    const { memory, ui } = deps;

    const tracer = new CommandTracer(context);
    const progress = new ProgressManager(ui, signal);
    const startedAt = Date.now();

    try {
      tracer.startSpan("remember_command_execution", {
        argsCount: args.length,
      });

      await progress.update(0, "Processing remember request...");
      throwIfAborted(signal);

      // Parse and validate options
      const options = this.parseOptions(args);
      const validation = this.validateOptions(options);

      if (!validation.valid) {
        return ResultAdapter.errorResult(
          new Error(validation.error),
          "Invalid remember command options",
        );
      }

      await progress.update(30, "Analyzing content...");
      throwIfAborted(signal);

      // Check for duplicate content
      const duplicateCheck = await traced(
        tracer,
        "check_duplicates",
        async () => {
          return await memory.query(
            {
              query: options.content.substring(0, 100), // Use first 100 chars for similarity
              limit: 3,
              minImportance: 0.1,
            },
            { signal },
          );
        },
      );

      let isDuplicate = false;
      let existingMemoryId: string | undefined;

      if (duplicateCheck.length > 0) {
        // Simple duplicate detection based on content similarity
        for (const existing of duplicateCheck) {
          if (
            this.calculateSimilarity(
              options.content,
              existing.content as string,
            ) > 0.8
          ) {
            isDuplicate = true;
            existingMemoryId = existing.id;
            break;
          }
        }
      }

      await progress.update(60, "Storing memory...");
      throwIfAborted(signal);

      let memoryId: string;
      let action: "stored" | "updated" = "stored";

      if (isDuplicate && existingMemoryId) {
        // Update existing memory with new tags/importance
        const enhancedMemory: MemoryContent = validateMemoryContent({
          type: options.type || "user.memory",
          content: {
            text: options.content,
            originalContent: options.content,
            enhancedAt: new Date().toISOString(),
          },
          metadata: {
            timestamp: new Date().toISOString(),
            importance: this.importanceToNumber(options.importance),
            type: options.type || "user.memory",
            tags: [...new Set([...options.tags, "updated"])], // Merge tags
            userId: context.options.userId,
            sessionId: context.options.sessionId,
            traceId: tracer.getTraceId(),
            originalId: existingMemoryId,
            expiresAt: options.expiresIn
              ? new Date(
                  Date.now() + options.expiresIn * 24 * 60 * 60 * 1000,
                ).toISOString()
              : undefined,
          },
        });

        memoryId = await memory.store(enhancedMemory, { signal });
        action = "updated";
      } else {
        // Store new memory
        const newMemory: MemoryContent = validateMemoryContent({
          type: options.type || "user.memory",
          content: {
            text: options.content,
            wordCount: options.content.split(/\s+/).length,
            characterCount: options.content.length,
            extractedEntities: await this.extractEntities(options.content),
            language: this.detectLanguage(options.content),
          },
          metadata: {
            timestamp: new Date().toISOString(),
            importance: this.importanceToNumber(options.importance),
            type: options.type || "user.memory",
            tags: options.tags,
            userId: context.options.userId,
            sessionId: context.options.sessionId,
            traceId: tracer.getTraceId(),
            expiresAt: options.expiresIn
              ? new Date(
                  Date.now() + options.expiresIn * 24 * 60 * 60 * 1000,
                ).toISOString()
              : undefined,
          },
        });

        memoryId = await memory.store(newMemory, { signal });
      }

      await progress.update(90, "Finalizing storage...");
      throwIfAborted(signal);

      // Get final memory stats
      const stats = await traced(tracer, "get_memory_stats", async () => {
        return await memory.getStats({ signal });
      });

      await progress.update(100, "Memory stored successfully");

      // Build response message
      const truncatedContent =
        options.content.length > 50
          ? options.content.substring(0, 50) + "..."
          : options.content;

      const statusIcon = action === "updated" ? "🔄" : "💾";
      const actionText = action === "updated" ? "Updated memory" : "Remembered";

      let message = `${statusIcon} ${actionText}: "${truncatedContent}"`;

      if (options.tags.length > 0) {
        message += `\n🏷️ Tags: ${options.tags.join(", ")}`;
      }

      if (options.importance !== "normal") {
        message += `\n⭐ Importance: ${options.importance}`;
      }

      if (isDuplicate) {
        message += "\n📋 Similar memory found and enhanced";
      }

      const result: CommandResult = {
        success: true,
        messages: [
          {
            role: "assistant",
            content: message,
          },
        ],
        data: {
          memoryId,
          action,
          tags: options.tags,
          importance: options.importance,
          isDuplicate,
          contentLength: options.content.length,
          totalMemories: stats.total,
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
      return ResultAdapter.errorResult(error, "Failed to store memory");
    } finally {
      await safeAsync(() => progress.complete("Done"), undefined);
    }
  }

  /**
   * Parse command arguments into structured options
   */
  private parseOptions(args: string[]): RememberOptions {
    const options: RememberOptions = {
      content: "",
      tags: ["general"],
      importance: "normal",
      type: undefined,
      expiresIn: undefined,
    };

    const contentArgs: string[] = [];

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
              i++; // Skip next argument
            }
            break;

          case "importance":
            if (value && ["low", "normal", "high"].includes(value)) {
              options.importance = value as ImportanceLevel;
            } else if (
              args[i + 1] &&
              ["low", "normal", "high"].includes(args[i + 1])
            ) {
              options.importance = args[i + 1] as ImportanceLevel;
              i++; // Skip next argument
            }
            break;

          case "type":
            if (value) {
              options.type = value;
            } else if (args[i + 1] && !args[i + 1].startsWith("--")) {
              options.type = args[i + 1];
              i++; // Skip next argument
            }
            break;

          case "expires-in":
          case "expires":
            const expiryValue = value || args[i + 1];
            const days = parseInt(expiryValue);
            if (!isNaN(days) && days > 0) {
              options.expiresIn = days;
              if (!value) i++; // Skip next argument if used
            }
            break;
        }
      } else {
        contentArgs.push(arg);
      }
    }

    options.content = contentArgs.join(" ").trim();

    // Auto-detect importance from content
    if (options.importance === "normal") {
      options.importance = this.detectImportance(options.content);
    }

    // Auto-generate tags from content
    if (options.tags.length === 1 && options.tags[0] === "general") {
      options.tags = this.generateTags(options.content);
    }

    return options;
  }

  /**
   * Validate remember options
   */
  private validateOptions(options: RememberOptions): {
    valid: boolean;
    error?: string;
  } {
    if (!options.content) {
      return {
        valid: false,
        error:
          "Please provide content to remember. Usage: /remember <content> [--tag=<tags>] [--importance=high|normal|low]",
      };
    }

    if (options.content.length > 10000) {
      return {
        valid: false,
        error:
          "Content is too long (maximum 10,000 characters). Consider breaking it into smaller memories.",
      };
    }

    if (options.tags.some((tag) => tag.length > 50)) {
      return {
        valid: false,
        error: "Tag names must be 50 characters or less",
      };
    }

    if (
      options.expiresIn &&
      (options.expiresIn < 1 || options.expiresIn > 3650)
    ) {
      return {
        valid: false,
        error: "Expiration must be between 1 and 3650 days (10 years)",
      };
    }

    return { valid: true };
  }

  /**
   * Convert importance level to numeric value
   */
  private importanceToNumber(importance: ImportanceLevel): number {
    switch (importance) {
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
   * Auto-detect importance from content
   */
  private detectImportance(content: string): ImportanceLevel {
    const lowerContent = content.toLowerCase();

    // High importance indicators
    const highIndicators = [
      "important",
      "critical",
      "urgent",
      "key",
      "essential",
      "remember this",
      "don't forget",
      "crucial",
      "vital",
      "password",
      "api key",
      "secret",
    ];

    // Low importance indicators
    const lowIndicators = [
      "maybe",
      "perhaps",
      "might",
      "could be",
      "not sure",
      "temporary",
      "just a note",
      "fyi",
      "by the way",
    ];

    if (highIndicators.some((indicator) => lowerContent.includes(indicator))) {
      return "high";
    }

    if (lowIndicators.some((indicator) => lowerContent.includes(indicator))) {
      return "low";
    }

    return "normal";
  }

  /**
   * Auto-generate tags from content
   */
  private generateTags(content: string): string[] {
    const words = content.toLowerCase().split(/\s+/);
    const tags = new Set<string>();

    // Technical terms
    const techTerms = [
      "api",
      "database",
      "server",
      "code",
      "function",
      "class",
      "bug",
      "error",
      "typescript",
      "javascript",
      "python",
      "react",
      "node",
      "sql",
      "git",
    ];

    // Project terms
    const projectTerms = [
      "project",
      "task",
      "todo",
      "deadline",
      "meeting",
      "client",
      "feature",
      "requirement",
      "specification",
      "design",
      "implementation",
    ];

    // Check for technical content
    if (techTerms.some((term) => words.includes(term))) {
      tags.add("technical");
    }

    // Check for project content
    if (projectTerms.some((term) => words.includes(term))) {
      tags.add("project");
    }

    // Add specific terms found
    for (const word of words) {
      if (techTerms.includes(word) || projectTerms.includes(word)) {
        tags.add(word);
      }
    }

    // Default tag if nothing detected
    if (tags.size === 0) {
      tags.add("general");
    }

    return Array.from(tags).slice(0, 5); // Limit to 5 tags
  }

  /**
   * Extract entities from content (simplified implementation)
   */
  private async extractEntities(content: string): Promise<string[]> {
    const entities: string[] = [];

    // Simple entity extraction patterns
    const patterns = [
      /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g, // Names
      /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, // IP addresses
      /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g, // Emails
      /https?:\/\/[^\s]+/g, // URLs
    ];

    for (const pattern of patterns) {
      const matches = content.match(pattern);
      if (matches) {
        entities.push(...matches);
      }
    }

    return [...new Set(entities)].slice(0, 10); // Dedupe and limit
  }

  /**
   * Detect content language (simplified)
   */
  private detectLanguage(content: string): string {
    // Very basic language detection
    const japanesePattern = /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/;
    const chinesePattern = /[\u4e00-\u9fff]/;
    const koreanPattern = /[\uac00-\ud7af]/;

    if (japanesePattern.test(content)) return "ja";
    if (chinesePattern.test(content)) return "zh";
    if (koreanPattern.test(content)) return "ko";

    return "en"; // Default to English
  }

  /**
   * Calculate content similarity (simplified)
   */
  private calculateSimilarity(text1: string, text2: string): number {
    if (text1 === text2) return 1.0;

    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter((x) => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size; // Jaccard similarity
  }
}

/**
 * Factory function
 */
export function createRememberCommand(): SlashCommandV2 {
  return new RememberCommandV2();
}
