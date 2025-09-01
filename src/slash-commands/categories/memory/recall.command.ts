/**
 * Recall Command
 * Retrieve stored memories from persistent storage
 */

import { BaseCommand } from "../../base-command";
import { CommandArgs, CommandContext, CommandResult } from "../../types";
import {
  QuickPersistence,
  StoredMemory,
} from "../../../services/memory-system/quick-persistence";
import { logger } from "../../../utils/logger";
import { trackCommand, withQuotaFooter } from "../../shared/telemetry-helper.js";
import { getUserPlan } from "../../../services/subscription/subscription-manager.js";

export class RecallCommand extends BaseCommand {
  name = "recall";
  category = "memory" as const;
  description = "Retrieve stored memories from persistent storage";

  constructor() {
    super();
    QuickPersistence.init().catch((err) => {
      logger.error("Failed to initialize QuickPersistence", err);
    });
  }

  async execute(
    _args: CommandArgs,
    context: CommandContext,
  ): Promise<CommandResult> {
    const startTime = Date.now();
    try {
      // Get search query
      const query = _args.parsed._positional?.join(" ") || "";

      // Parse optional flags
      const tags = _args.flags["tag"]
        ? (typeof _args.flags["tag"] === "string"
            ? _args.flags["tag"]
            : ""
          ).split(",")
        : undefined;
      const limit = parseInt(_args.flags["limit"] as string) || 10;
      const userId = context.user?.id || "anonymous";

      // Search memories using QuickPersistence
      const memories = await QuickPersistence.recall({
        q: query,
        tags,
        userId,
        limit: limit * 2, // Get more for better filtering
      });

      if (memories.length === 0) {
        return this.success(
          withQuotaFooter("🔍 No memories found matching your query", context.quotaLeft),
          {
            query,
            tags,
            found: 0,
          }
        );
      }

      // Limit results
      const limitedMemories = memories.slice(0, limit);

      // Format results
      let response = `📚 Found ${memories.length} memor${memories.length === 1 ? "y" : "ies"}:\n\n`;

      for (const memory of limitedMemories) {
        const date = new Date(memory.createdAt);
        const formattedDate =
          date.toLocaleDateString() + " " + date.toLocaleTimeString();

        response += `**[${memory.tags.join(", ")}]** `;
        if (memory.importance === "high") {
          response += "⭐ ";
        }
        response += `${memory.content}\n`;
        response += `   _${formattedDate}`;
        if (memory.accessCount && memory.accessCount > 1) {
          response += ` (accessed ${memory.accessCount} times)`;
        }
        response += `_\n\n`;
      }

      if (memories.length > limit) {
        response += `\n_Showing ${limit} of ${memories.length} results. Use --limit=<n> to see more._`;
      }

      logger.info("Memories recalled", {
        query,
        tags,
        found: memories.length,
        shown: limitedMemories.length,
      });

      // Track successful operation
      await trackCommand({
        cmd: 'recall',
        status: 'success',
        latencyMs: Date.now() - startTime,
        plan: getUserPlan(),
        quotaLeft: context.quotaLeft || 999
      });

      return this.success(withQuotaFooter(response, context.quotaLeft), {
        query,
        tags,
        found: memories.length,
        shown: limitedMemories.length,
        memories: limitedMemories.map((m) => ({
          id: m.id,
          tags: m.tags,
          importance: m.importance,
          createdAt: m.createdAt,
          accessCount: m.accessCount,
        })),
      });
    } catch (error) {
      logger.error("Failed to recall memories", error);

      // Track failed operation
      await trackCommand({
        cmd: 'recall',
        status: 'error',
        latencyMs: Date.now() - startTime,
        plan: getUserPlan(),
        quotaLeft: context.quotaLeft || 999
      });

      return this.error(
        "Failed to retrieve memories",
        "RECALL_ERROR",
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  }

  override async validate(
    args: CommandArgs,
  ): Promise<{ success: boolean; error?: string }> {
    // Validate limit if provided
    const limit = args.flags["limit"];
    if (limit && (isNaN(Number(limit)) || Number(limit) < 1)) {
      return {
        success: false,
        error: "Limit must be a positive number",
      };
    }

    return { success: true };
  }
}

// Command metadata for manifest generation
export const meta = {
  name: 'recall',
  category: 'memory',
  description: 'Retrieve stored memories from persistent storage',
  aliases: [],
  usage: '/recall [query] [--tag=<tag>] [--limit=<n>]',
  examples: [
    '/recall API',
    '/recall --tag=security',
    '/recall database --limit=5'
  ],
  deps: [], // No external dependencies
  status: 'stable' as const
};
