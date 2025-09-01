/**
 * Unified Update Command
 * Incremental codebase updates with Graph RAG
 */

import chalk from "chalk";
import { UpdateCommand } from "../../services/init/update.command";
import type { DualMemoryEngine } from "../../services/memory-system/dual-memory-engine";
import type { KnowledgeGraphService } from "../../services/knowledge-graph/KnowledgeGraphService";

export interface UpdateOptions {
  root?: string;
  since?: string;
  json?: boolean;
  verbose?: boolean;
  dryRun?: boolean;
  parallel?: number;
  budgetMs?: number;
}

/**
 * Execute update command
 */
export async function executeUpdate(
  args: string[] = [],
  _maria?: unknown,
  _memoryEngine?: DualMemoryEngine | null,
): Promise<boolean | "exit"> {
  try {
    console.log(chalk.blue("🔄 Starting incremental update analysis..."));

    // Parse command line options
    const options = parseUpdateOptions(args);

    // Initialize knowledge graph service if available
    let knowledgeGraph: KnowledgeGraphService | undefined;
    try {
      const { KnowledgeGraphService } = await import(
        "../../services/knowledge-graph/KnowledgeGraphService"
      );
      knowledgeGraph = new KnowledgeGraphService({
        enableRAG: true,
        enablePersistence: true,
        analysisRootDir: process.cwd(),
      });
      await knowledgeGraph.initialize();
    } catch (error) {
      console.log(
        chalk.yellow(
          "⚠️ Knowledge Graph service not available, continuing with basic analysis",
        ),
      );
    }

    // Create and execute update command
    const updateCommand = new UpdateCommand(knowledgeGraph, _memoryEngine);
    const result = await updateCommand.execute(options);

    if (result.success) {
      if (
        result.delta.added === 0 &&
        result.delta.modified === 0 &&
        result.delta.deleted === 0
      ) {
        console.log(chalk.green("\n✅ No changes detected since last update"));
        console.log(chalk.gray(`📊 Checked: ${result.delta.unchanged} files`));
      } else {
        console.log(
          chalk.green("\n🎉 Incremental update completed successfully!"),
        );
        console.log(
          chalk.gray(
            `📊 Changes: +${result.delta.added} ~${result.delta.modified} -${result.delta.deleted}`,
          ),
        );
        console.log(
          chalk.gray(`📈 Nodes updated: ${result.stats.nodesUpdated}`),
        );
        console.log(
          chalk.gray(`🔗 Edges updated: ${result.stats.edgesUpdated}`),
        );
        console.log(
          chalk.gray(`⏱️ Time: ${(result.stats.timeMs / 1000).toFixed(2)}s`),
        );

        if (options.dryRun) {
          console.log(
            chalk.yellow("\n💡 Dry run completed - no changes were applied"),
          );
        } else {
          console.log(
            chalk.green("\n✅ MARIA.md has been updated with latest changes"),
          );
        }
      }

      if (result.warnings.length > 0) {
        console.log(chalk.yellow(`\n⚠️ Warnings: ${result.warnings.length}`));
        result.warnings
          .slice(0, 3)
          .forEach((w) => console.log(chalk.yellow(`  • ${w}`)));
      }

      // Show recent changes if any
      if (result.changes.length > 0 && options.verbose) {
        console.log(chalk.gray("\n📝 Recent changes:"));
        result.changes.slice(0, 5).forEach((change) => {
          const icon =
            change.type === "added"
              ? chalk.green("+")
              : change.type === "modified"
                ? chalk.yellow("~")
                : chalk.red("-");
          console.log(chalk.gray(`  ${icon} ${change.path}`));
        });
        if (result.changes.length > 5) {
          console.log(
            chalk.gray(`  ... and ${result.changes.length - 5} more`),
          );
        }
      }

      return true;
    } else {
      console.error(chalk.red("❌ Update analysis failed"));
      if (result.warnings.length > 0) {
        result.warnings.forEach((w) => console.error(chalk.red(`  • ${w}`)));
      }
      return false;
    }
  } catch (error: any) {
    console.error(chalk.red("❌ Update failed:"), error.message);
    return false;
  }
}

/**
 * Parse update command line options
 */
function parseUpdateOptions(args: string[]): UpdateOptions {
  // Find --since option
  let since = "state"; // default
  const sinceIndex = args.findIndex((arg) => arg === "--since");
  if (sinceIndex >= 0 && args[sinceIndex + 1]) {
    since = args[sinceIndex + 1];
  }

  // Also check for --since=value format
  const sinceArg = args.find((arg) => arg.startsWith("--since="));
  if (sinceArg) {
    since = sinceArg.split("=")[1];
  }

  return {
    root: process.cwd(),
    since,
    json: args.includes("--json"),
    verbose: args.includes("--verbose") || args.includes("-v"),
    dryRun: args.includes("--dry-run") || args.includes("--dry"),
    parallel: args.find((arg) => arg.startsWith("--parallel="))?.split("=")[1]
      ? parseInt(
          args.find((arg) => arg.startsWith("--parallel="))!.split("=")[1],
        )
      : 4,
    budgetMs: args.find((arg) => arg.startsWith("--budget-ms="))?.split("=")[1]
      ? parseInt(
          args.find((arg) => arg.startsWith("--budget-ms="))!.split("=")[1],
        )
      : 10000,
  };
}

/**
 * Show help for update command
 */
export function showUpdateHelp(): void {
  console.log(
    chalk.bold("\n📖 MARIA /update - Incremental Codebase Updates\n"),
  );

  console.log(chalk.blue("Usage:"));
  console.log("  maria /update [options]\n");

  console.log(chalk.blue("Delta Detection:"));
  console.log("  --since git:HEAD~1     Update files changed in last commit");
  console.log(
    "  --since git:main       Update files changed since main branch",
  );
  console.log("  --since 2025-08-26     Update files modified since date");
  console.log(
    "  --since state          Update based on saved state (default)\n",
  );

  console.log(chalk.blue("Options:"));
  console.log("  --dry-run             Preview changes without applying");
  console.log("  --verbose, -v         Show detailed progress");
  console.log("  --json                Output structured JSON");
  console.log(
    "  --parallel=N          Process N files in parallel (default: 4)",
  );
  console.log(
    "  --budget-ms=N         Time budget in milliseconds (default: 10000)\n",
  );

  console.log(chalk.blue("Examples:"));
  console.log(
    "  maria /update                          # Update using saved state",
  );
  console.log(
    "  maria /update --since git:HEAD~3       # Update last 3 commits",
  );
  console.log(
    "  maria /update --since 2025-08-20 -v    # Update since date (verbose)",
  );
  console.log(
    "  maria /update --dry-run                 # Preview without changes",
  );
  console.log("  maria /update --json > changes.json     # Export to JSON\n");
}
