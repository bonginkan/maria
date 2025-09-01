/**
 * Update Slash Command
 * Incremental codebase updates using Graph RAG
 */

import { BaseCommand } from "../../../base-command";
import {
  CommandArgs,
  CommandContext,
  CommandResult,
  CommandExample,
} from "../../../types";
import {
  executeUpdate,
  showUpdateHelp,
} from "../../../../commands/unified/update";
import { logger } from "../../../../utils/logger";
import chalk from "chalk";

export class UpdateCommand extends BaseCommand {
  name = "update";
  category = "core" as const;
  description =
    "🔄 Incremental codebase updates with Graph RAG delta detection";
  override aliases = ["up", "refresh"];
  override usage = "[--since <ref>] [--dry-run] [--verbose] [--json]";

  override examples: CommandExample[] = [
    {
      input: "/update",
      description: "Update using saved state (default)",
      output: "Incremental analysis of changed files",
    },
    {
      input: "/update --since git:HEAD~1",
      description: "Update files changed in last commit",
      output: "Git-based delta detection and processing",
    },
    {
      input: "/update --since 2025-08-26",
      description: "Update files modified since specific date",
      output: "Time-based delta detection and processing",
    },
    {
      input: "/update --dry-run --verbose",
      description: "Preview changes without applying them",
      output: "Detailed preview of what would be updated",
    },
    {
      input: "/update --json > changes.json",
      description: "Export changes to JSON format",
      output: "Structured JSON output for CI/CD integration",
    },
  ];

  async execute(
    args: CommandArgs,
    context: CommandContext,
  ): Promise<CommandResult> {
    try {
      const { options, parsed } = args;
      const positional = (parsed["_positional"] as string[]) || [];

      // Handle help request
      if (options["help"] || positional.includes("help")) {
        showUpdateHelp();
        return this.success("Update command help displayed");
      }

      // Build arguments for unified update command
      const updateArgs: string[] = [];

      // Handle --since option
      if (options["since"]) {
        updateArgs.push("--since", options["since"] as string);
      }

      // Handle flags
      if (options["dry-run"] || options["dry"]) {
        updateArgs.push("--dry-run");
      }

      if (options["verbose"] || options["v"]) {
        updateArgs.push("--verbose");
      }

      if (options["json"]) {
        updateArgs.push("--json");
      }

      if (options["parallel"]) {
        updateArgs.push(`--parallel=${options["parallel"]}`);
      }

      if (options["budget-ms"]) {
        updateArgs.push(`--budget-ms=${options["budget-ms"]}`);
      }

      // Show starting message
      if (!options["json"]) {
        console.log(chalk.blue("🔄 Starting incremental update..."));
        console.log(
          chalk.gray(
            `Arguments: ${updateArgs.length > 0 ? updateArgs.join(" ") : "default"}`,
          ),
        );
      }

      // Execute unified update command
      const result = await executeUpdate(
        updateArgs,
        context,
        context.memoryEngine,
      );

      if (result === true) {
        return this.success("Update completed successfully", {
          type: "incremental-update",
          args: updateArgs,
        });
      } else if (result === "exit") {
        return this.success("Update operation cancelled by user");
      } else {
        return this.error(
          "Update failed",
          "UPDATE_FAILED",
          "The incremental update process encountered an error",
        );
      }
    } catch (error) {
      logger.error("Update command failed:", error);
      return this.error(
        "Update command failed",
        "UPDATE_ERROR",
        error instanceof Error ? error.message : "Unknown error occurred",
      );
    }
  }

  /**
   * Show additional information about delta detection methods
   */
  private showDeltaMethods(): void {
    console.log(chalk.bold("\n📖 Delta Detection Methods\n"));

    console.log(chalk.blue("1. State-based (default):"));
    console.log("   Uses saved file hashes from .maria/state.json");
    console.log("   Example: /update (or /update --since state)\n");

    console.log(chalk.blue("2. Git-based:"));
    console.log("   Compares against git references");
    console.log("   Examples:");
    console.log("   • /update --since git:HEAD~1    (last commit)");
    console.log("   • /update --since git:HEAD~5    (last 5 commits)");
    console.log("   • /update --since git:main      (since main branch)\n");

    console.log(chalk.blue("3. Time-based:"));
    console.log("   Compares file modification times");
    console.log("   Examples:");
    console.log("   • /update --since 2025-08-26");
    console.log('   • /update --since "2025-08-26 10:30"');
    console.log("   • /update --since 1724668800    (Unix timestamp)\n");
  }

  /**
   * Validate command options
   */
  private validateOptions(options: Record<string, unknown>): string[] {
    const errors: string[] = [];

    // Validate --since format
    if (options["since"]) {
      const since = options["since"] as string;
      if (!since.match(/^(git:|state$|\d{4}-\d{2}-\d{2}|\d+$)/)) {
        errors.push(
          "Invalid --since format. Use: git:REF, YYYY-MM-DD, state, or Unix timestamp",
        );
      }
    }

    // Validate --parallel
    if (options["parallel"]) {
      const parallel = parseInt(options["parallel"] as string);
      if (isNaN(parallel) || parallel < 1 || parallel > 16) {
        errors.push("--parallel must be a number between 1 and 16");
      }
    }

    // Validate --budget-ms
    if (options["budget-ms"]) {
      const budget = parseInt(options["budget-ms"] as string);
      if (isNaN(budget) || budget < 1000) {
        errors.push("--budget-ms must be at least 1000 milliseconds");
      }
    }

    return errors;
  }
}

// Command metadata for manifest generation
export const meta = {
  name: 'update',
  category: 'core',
  description: 'Update project dependencies, configurations, and system components',
  aliases: ['up', 'refresh'],
  usage: '/update [target] [options]',
  examples: [
    '/update',
    '/update --deps',
    '/update --config',
    '/update --system'
  ],
  deps: [], // No external dependencies
  status: 'stable' as const
};
