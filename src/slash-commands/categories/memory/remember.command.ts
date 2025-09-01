/**
 * Remember Command
 * Stores important information in persistent memory
 */

import { BaseCommand } from "../../base-command";
import { CommandArgs, CommandContext, CommandResult } from "../../types";
import { ChatContextService } from "../../../services/chat-context.service";
import {
  QuickPersistence,
  Importance,
  StoredMemory,
} from "../../../services/memory-system/quick-persistence";
import { logger } from "../../../utils/logger";
import { trackCommand, withQuotaFooter } from "../../shared/telemetry-helper.js";
import { getUserPlan } from "../../../services/subscription/subscription-manager.js";

export class RememberCommand extends BaseCommand {
  name = "remember";
  category = "memory" as const;
  description = "Store important information in persistent memory";

  private chatContext: ChatContextService;

  constructor() {
    super();
    this.chatContext = ChatContextService.getInstance();
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
      // Get the content to remember
      const content = _args.parsed._positional?.join(" ") || "";

      if (!content) {
        return this.error(
          "Please provide content to remember",
          "NO_CONTENT",
          "Usage: /remember <content> [--tag=<tag>] [--importance=high]",
        );
      }

      // Parse optional flags
      const tags = (
        typeof _args.flags["tag"] === "string" ? _args.flags["tag"] : "general"
      ).split(",");
      const importance = (
        typeof _args.flags["importance"] === "string"
          ? _args.flags["importance"]
          : "normal"
      ) as Importance;

      // Validate importance
      if (!["high", "normal", "low"].includes(importance)) {
        return this.error(
          "Invalid importance level",
          "INVALID_IMPORTANCE",
          "Importance must be one of: high, normal, low",
        );
      }

      // Store using QuickPersistence
      const storedMemory = await QuickPersistence.save({
        userId: context.user?.id || "anonymous",
        content,
        tags,
        importance,
      });

      // Add to current context with special marker
      await this.chatContext.addMessage({
        role: "system",
        content: `[REMEMBER:${tags.join(",")}:${importance}] ${content}`,
        metadata: {
          type: "memory",
          memoryId: storedMemory.id,
          tags,
          importance,
        },
      });

      logger.info("Memory stored", {
        id: storedMemory.id,
        tags,
        importance,
        contentLength: content.length,
        isDuplicate: storedMemory.accessCount > 0,
      });

      // Track successful operation
      await trackCommand({
        cmd: 'remember',
        status: 'success',
        latencyMs: Date.now() - startTime,
        plan: getUserPlan(),
        quotaLeft: context.quotaLeft || 999
      });

      const message = `💾 Remembered: "${content.substring(0, 50)}${content.length > 50 ? "..." : ""}"`;      
      return this.success(
        withQuotaFooter(message, context.quotaLeft),
        {
          memoryId: storedMemory.id,
          tags,
          importance,
          stored: true,
          isDuplicate: storedMemory.accessCount > 0,
        },
      );
    } catch (error) {
      logger.error("Failed to remember content", error);

      // Track failed operation
      await trackCommand({
        cmd: 'remember',
        status: 'error',
        latencyMs: Date.now() - startTime,
        plan: getUserPlan(),
        quotaLeft: context.quotaLeft || 999
      });

      return this.error(
        "Failed to store memory",
        "REMEMBER_ERROR",
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  }

  public async searchMemories(
    query: string,
    tags?: string[],
    userId?: string,
  ): Promise<StoredMemory[]> {
    // Use the userId from the command context if not provided
    const effectiveUserId = userId || "anonymous";

    const results = await QuickPersistence.recall({
      q: query,
      tags,
      userId: effectiveUserId,
      limit: 100, // Get more results for better filtering
    });

    return results;
  }

  override async validate(
    args: CommandArgs,
  ): Promise<{ success: boolean; error?: string }> {
    // Check if content is provided
    const content = args.parsed._positional?.join(" ") || "";

    if (!content && !args.flags["help"]) {
      return {
        success: false,
        error: "Please provide content to remember",
      };
    }

    // Validate importance flag if provided
    const importance = args.flags["importance"];
    if (
      importance &&
      !["high", "normal", "low"].includes(importance as string)
    ) {
      return {
        success: false,
        error: "Importance must be one of: high, normal, low",
      };
    }

    return { success: true };
  }
}

// Command metadata for manifest generation
export const meta = {
  name: 'remember',
  category: 'memory',
  description: 'Store important information in persistent memory',
  aliases: [],
  usage: '/remember <content> [--tag=<tag>] [--importance=<level>]',
  examples: [
    '/remember "API endpoint is /api/v1/users"',
    '/remember "Database password is in .env" --importance=high --tag=security'
  ],
  deps: [], // No external dependencies
  status: 'stable' as const
};
