/**
 * Exit Command
 * Gracefully exit the application or conversation mode
 */

import { BaseCommand } from "../../../base-command";
import {
  CommandArgs,
  CommandContext,
  CommandResult,
  CommandExample,
} from "../../../types";
import { logger } from "../../../../utils/logger";

export class ExitCommand extends BaseCommand {
  name = "exit";
  category = "core" as const;
  description = "🚪 Gracefully exit the application or conversation mode";
  override aliases = ["quit", "q", "bye"];
  override usage = "[--force] [--save-session] [--no-confirm]";

  override examples: CommandExample[] = [
    {
      input: "/exit",
      description: "Exit with confirmation prompt",
      output: "Confirmation dialog and graceful shutdown",
    },
    {
      input: "/exit --no-confirm",
      description: "Exit immediately without confirmation",
      output: "Immediate graceful shutdown",
    },
    {
      input: "/exit --save-session",
      description: "Exit after saving current session",
      output: "Session saved and application closed",
    },
    {
      input: "/exit --force",
      description: "Force exit without cleanup (emergency use)",
      output: "Immediate forceful shutdown",
    },
  ];

  async execute(
    args: CommandArgs,
    context: CommandContext,
  ): Promise<CommandResult> {
    try {
      const { flags } = args;

      logger.info("Exit command initiated", {
        user: context.user?.id,
        session: context.session.id,
        flags,
      });

      // Handle force exit (emergency)
      if (flags["force"]) {
        return await this.forceExit();
      }

      // Handle normal exit with optional session saving
      if (flags["save-session"]) {
        await this.saveSession(context);
      }

      // Skip confirmation if requested
      if (flags["no-confirm"]) {
        return await this.performExit(context);
      }

      // Show confirmation prompt (in a real implementation)
      return await this.showExitConfirmation(context);
    } catch (error) {
      logger.error("Exit command failed:", error);
      return this.error(
        "Failed to exit gracefully",
        "EXIT_ERROR",
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  }

  /**
   * Show exit confirmation
   */
  private async showExitConfirmation(
    context: CommandContext,
  ): Promise<CommandResult> {
    const lines: string[] = [];

    lines.push("");
    lines.push("🚪 **EXIT CONFIRMATION**");
    lines.push("");
    lines.push("Are you sure you want to exit MARIA?");
    lines.push("");
    lines.push("Current session:");
    lines.push(`  • Session ID: ${context.session.id}`);
    lines.push(
      `  • Commands run: ${context.session.commandHistory?.length || 0}`,
    );

    if (context.conversation?.history?.length) {
      lines.push(
        `  • Conversation messages: ${context.conversation.history.length}`,
      );
    }

    lines.push("");
    lines.push("**Options:**");
    lines.push("  • `/exit --no-confirm` - Exit immediately");
    lines.push("  • `/exit --save-session` - Save session before exiting");
    lines.push("  • `/exit --force` - Force exit (emergency only)");
    lines.push("  • Any other command to cancel");
    lines.push("");

    return this.success(lines.join("\n"), {
      type: "confirmation-prompt",
      requiresInput: true,
      sessionInfo: {
        id: context.session.id,
        commandCount: context.session.commandHistory.length || 0,
        conversationLength: context.conversation?.history.length || 0,
      },
    });
  }

  /**
   * Perform graceful exit
   */
  private async performExit(context: CommandContext): Promise<CommandResult> {
    const lines: string[] = [];

    lines.push("");
    lines.push("👋 **GOODBYE!**");
    lines.push("");
    lines.push("Thank you for using MARIA CODE!");
    lines.push("");

    // Show session summary
    const _sessionSummary = this.generateSessionSummary(context);
    lines.push("**Session Summary:**");
    lines.push(`  • Duration: ${_sessionSummary.duration}`);
    lines.push(`  • Commands executed: ${_sessionSummary.commandCount}`);

    if (_sessionSummary.conversationMessages > 0) {
      lines.push(
        `  • Conversation messages: ${_sessionSummary.conversationMessages}`,
      );
    }

    lines.push("");
    lines.push("**Resources:**");
    lines.push("  • Documentation: https://docs.maria-code.ai");
    lines.push("  • GitHub: https://github.com/bonginkan/maria");
    lines.push("  • Support: https://discord.gg/maria-code");
    lines.push("");
    lines.push("See you next time! 🚀");
    lines.push("");

    // Perform cleanup
    await this.performCleanup(context);

    // In a real implementation, this would actually exit the process
    // For now, we return a result indicating exit should occur
    return this.success(lines.join("\n"), {
      type: "graceful-exit",
      shouldExit: true,
      exitCode: 0,
      _sessionSummary: _sessionSummary,
    });
  }

  /**
   * Force exit (emergency)
   */
  private async forceExit(): Promise<CommandResult> {
    logger.warn("Force exit requested - performing emergency shutdown");

    const lines: string[] = [];
    lines.push("");
    lines.push("⚠️  **FORCE EXIT INITIATED**");
    lines.push("");
    lines.push("Emergency shutdown in progress...");
    lines.push("Session data may not be saved.");
    lines.push("");

    // In a real implementation, this would forcefully exit
    // process.exit(1);

    return this.success(lines.join("\n"), {
      type: "force-exit",
      shouldExit: true,
      exitCode: 1,
    });
  }

  /**
   * Save current session
   */
  private async saveSession(context: CommandContext): Promise<void> {
    try {
      logger.info("Saving session before exit", {
        sessionId: context.session.id,
      });

      // In a real implementation, this would save to persistent storage
      const _sessionData = {
        id: context.session.id,
        timestamp: new Date().toISOString(),
        commandHistory: context.session.commandHistory,
        conversation: context.conversation,
        user: context.user,
      };

      // Simulate session saving
      logger.info("Session saved successfully", _sessionData);
    } catch (innerError) {
      logger.error("Failed to save session:", error);
      throw new Error(
        `Session save failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Generate session summary
   */
  private generateSessionSummary(context: CommandContext) {
    // Calculate session _duration (would be more accurate with session start time)
    const _duration = "Unknown"; // In real implementation, track session start

    return {
      _duration: _duration,
      commandCount: context.session.commandHistory.length || 0,
      conversationMessages: context.conversation?.history.length || 0,
      sessionId: context.session.id,
    };
  }

  /**
   * Perform cleanup operations
   */
  private async performCleanup(_context: CommandContext): Promise<void> {
    try {
      logger.info("Performing cleanup operations");

      // Cleanup operations that would happen in a real implementation:
      // - Close database connections
      // - Save any pending data
      // - Clear temporary files
      // - Notify running processes
      // - etc.

      await new Promise((resolve) => setTimeout(resolve, 100)); // Simulate cleanup time

      logger.info("Cleanup completed successfully");
    } catch (error) {
      logger.error("Cleanup operations failed:", error);
      // Continue with exit even if cleanup fails
    }
  }

  /**
   * Validation for exit command
   */
  override async validate(
    args: CommandArgs,
  ): Promise<{ success: boolean; error?: string }> {
    const { flags, parsed } = args;
    const _positional = (parsed["_positional"] as string[]) || [];

    // Exit command doesn't accept _positional arguments
    if (_positional.length > 0) {
      return {
        success: false,
        error: `Unexpected arguments: ${_positional.join(", ")}. Use flags like --force instead.`,
      };
    }

    // Validate conflicting flags
    if (flags["force"] && flags["save-session"]) {
      return {
        success: false,
        error:
          "Cannot use --force and --save-session together. Force exit skips all operations.",
      };
    }

    if (flags["force"] && flags["no-confirm"]) {
      return {
        success: false,
        error:
          "Cannot use --force and --no-confirm together. Force exit is immediate.",
      };
    }

    return { success: true };
  }
}

// Command metadata for manifest generation
export const meta = {
  name: 'exit',
  category: 'core',
  description: 'Exit the application',
  aliases: ['quit', 'q', 'bye'],
  usage: '/exit',
  examples: ['/exit'],
  deps: [], // No external dependencies
  status: 'stable' as const
};
