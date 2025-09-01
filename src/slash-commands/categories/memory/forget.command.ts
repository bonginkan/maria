/**
 * Forget Command
 * Remove memories from persistent storage
 */

import { BaseCommand } from "../../base-command";
import { CommandArgs, CommandContext, CommandResult } from "../../types";
import { RememberCommand } from "./remember.command";
import { logger } from "../../../utils/logger";
import { trackCommand, withQuotaFooter } from "../../shared/telemetry-helper.js";
import { getUserPlan } from "../../../services/subscription/subscription-manager.js";

export class ForgetCommand extends BaseCommand {
  name = "forget";
  category = "memory" as const;
  description = "Remove memories from persistent storage";

  private rememberCommand: RememberCommand;

  constructor() {
    super();
    this.rememberCommand = new RememberCommand();
  }

  async execute(
    _args: CommandArgs,
    _context: CommandContext,
  ): Promise<CommandResult> {
    const startTime = Date.now();
    try {
      // Get pattern to forget
      const pattern = _args.parsed._positional?.join(" ") || "";

      // Parse optional flags
      const tag =
        (typeof _args.flags["tag"] === "string" ? _args.flags["tag"] : null) ||
        undefined;
      const olderThan = parseInt(_args.flags["older-than"] as string) || 0;
      const confirm = _args.flags["confirm"] || false;

      // Search for memories to forget
      const memories = await this.rememberCommand.searchMemories(pattern, tag);

      // Filter by age if specified
      let toForget = memories;
      if (olderThan > 0) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - olderThan);

        toForget = memories.filter((m) => {
          return new Date(m.timestamp) < cutoffDate;
        });
      }

      if (toForget.length === 0) {
        return this.success(
          withQuotaFooter("🔍 No memories found to forget", _context.quotaLeft),
          {
            pattern,
            tag,
            olderThan,
            found: 0,
          }
        );
      }

      // Show what will be forgotten and ask for confirmation if not forced
      if (!confirm) {
        let response = `⚠️ Found ${toForget.length} memor${toForget.length === 1 ? "y" : "ies"} to forget:\n\n`;

        for (const memory of toForget.slice(0, 5)) {
          response += `• [${memory.tag}] ${memory.content.substring(0, 50)}${memory.content.length > 50 ? "..." : ""}\n`;
        }

        if (toForget.length > 5) {
          response += `• ... and ${toForget.length - 5} more\n`;
        }

        response +=
          "\n**Use --confirm flag to permanently forget these memories**";

        return this.success(
          withQuotaFooter(response, _context.quotaLeft),
          {
            pattern,
            tag,
            olderThan,
            found: toForget.length,
            confirmed: false,
          }
        );
      }

      // Actually forget the memories
      let forgottenCount = 0;
      for (const memory of toForget) {
        try {
          await this.forgetMemory(memory.id);
          forgottenCount++;
        } catch (error) {
          logger.error(`Failed to forget memory ${memory.id}`, error);
        }
      }

      logger.info("Memories forgotten", {
        pattern,
        tag,
        olderThan,
        attempted: toForget.length,
        forgotten: forgottenCount,
      });

      // Track successful operation
      await trackCommand({
        cmd: 'forget',
        status: 'success',
        latencyMs: Date.now() - startTime,
        plan: getUserPlan(),
        quotaLeft: _context.quotaLeft || 999
      });

      const message = `🗑️ Forgotten ${forgottenCount} memor${forgottenCount === 1 ? "y" : "ies"}`;
      return this.success(
        withQuotaFooter(message, _context.quotaLeft),
        {
          pattern,
          tag,
          olderThan,
          forgotten: forgottenCount,
        },
      );
    } catch (error) {
      logger.error("Failed to forget memories", error);

      // Track failed operation
      await trackCommand({
        cmd: 'forget',
        status: 'error',
        latencyMs: Date.now() - startTime,
        plan: getUserPlan(),
        quotaLeft: _context.quotaLeft || 999
      });

      return this.error(
        "Failed to forget memories",
        "FORGET_ERROR",
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  }

  private async forgetMemory(memoryId: string): Promise<void> {
    // Access the memory store through RememberCommand
    // In a real implementation, we would have a shared memory service
    const memoryStore = (this.rememberCommand as any).memoryStore as Map<
      string,
      any
    >;

    if (memoryStore.has(memoryId)) {
      const memory = memoryStore.get(memoryId);

      // Remove from tag index
      const tagKey = `tag:${memory.tag}`;
      if (memoryStore.has(tagKey)) {
        const tagMemories = memoryStore.get(tagKey);
        const index = tagMemories.indexOf(memoryId);
        if (index > -1) {
          tagMemories.splice(index, 1);
        }
      }

      // Remove the memory itself
      memoryStore.delete(memoryId);

      // Persist changes
      await (this.rememberCommand as any).persistMemories();
    }
  }

  override async validate(
    args: CommandArgs,
  ): Promise<{ success: boolean; error?: string }> {
    // Check if pattern is provided when confirm is set
    const pattern = args.parsed._positional?.join(" ") || "";
    const confirm = args.flags["confirm"];

    if (
      confirm &&
      !pattern &&
      !args.flags["tag"] &&
      !args.flags["older-than"]
    ) {
      return {
        success: false,
        error:
          "Please provide a pattern, tag, or older-than flag to specify what to forget",
      };
    }

    // Validate older-than if provided
    const olderThan = args.flags["older-than"];
    if (olderThan && (isNaN(Number(olderThan)) || Number(olderThan) < 1)) {
      return {
        success: false,
        error: "older-than must be a positive number of days",
      };
    }

    return { success: true };
  }
}

// Command metadata for manifest generation
export const meta = {
  name: 'forget',
  category: 'memory',
  description: 'Remove memories from persistent storage',
  aliases: [],
  usage: '/forget <pattern> [--tag=<tag>] [--older-than=<days>] [--confirm]',
  examples: [
    '/forget "old data"',
    '/forget --tag=temp --confirm',
    '/forget --older-than=30 --confirm'
  ],
  deps: [], // No external dependencies
  status: 'stable' as const
};
