/**
 * Unified Shell Command - Natural language to safe shell operations
 * Integrates with shell-agent system for Phase A (read-only) functionality
 */

import chalk from "chalk";
import { createShellAgent } from "../../services/shell-agent/shell-agent.js";

export async function handler(...args: string[]): Promise<void> {
  try {
    const instruction = args.join(" ").trim();

    if (!instruction) {
      showUsage();
      return;
    }

    console.log(chalk.blue(`\n🐚 Processing: ${chalk.cyan(instruction)}`));
    console.log(chalk.gray("⏳ Analyzing request..."));

    // Create shell agent for current workspace
    const agent = createShellAgent(process.cwd());

    // Execute natural language request
    const result = await agent.run({
      text: instruction,
      tenantId: "cli",
      userId: "user",
      cwd: process.cwd(),
      dryRun: args.includes("--dry-run"),
    });

    // Display formatted result
    if (result.success) {
      console.log(result.formatted);
    } else {
      console.log(result.formatted);
      process.exitCode = 1;
    }

    // Show metadata in verbose mode
    if (args.includes("--verbose")) {
      console.log(chalk.gray("\n📊 Execution Metadata:"));
      console.log(chalk.gray(`  Phase: ${result.metadata.phase}`));
      console.log(chalk.gray(`  Intent: ${result.metadata.intent}`));
      console.log(
        chalk.gray(`  Security Level: ${result.metadata.securityLevel}`),
      );
      console.log(
        chalk.gray(
          `  Plan Generation: ${result.metadata.planGenerationTime}ms`,
        ),
      );
      console.log(
        chalk.gray(`  Execution Time: ${result.metadata.executionTime}ms`),
      );
    }
  } catch (error) {
    console.error(
      chalk.red("❌ Shell operation failed:"),
      (error as Error).message,
    );
    process.exitCode = 1;
  }
}

function showUsage(): void {
  console.log(
    chalk.cyan("\n📖 Usage: /shell <natural_language_instruction> [options]"),
  );
  console.log(chalk.gray("\nPhase A Examples (Read-only operations):"));
  console.log(chalk.gray('  /shell "show contents of README"'));
  console.log(chalk.gray('  /shell "list TypeScript files in src directory"'));
  console.log(
    chalk.gray('  /shell "search for TODO comments in source files"'),
  );
  console.log(chalk.gray('  /shell "display package.json file"'));

  console.log(chalk.gray("\nOptions:"));
  console.log(
    chalk.gray("  --dry-run    Preview operations without execution"),
  );
  console.log(chalk.gray("  --verbose    Show detailed execution metadata"));

  console.log(
    chalk.green("\n✅ Current Status: Phase A (Read-only) Implemented"),
  );
  console.log(chalk.gray("Available features:"));
  console.log(chalk.gray("  • Safe file reading with size limits"));
  console.log(chalk.gray("  • Pattern searching in files/directories"));
  console.log(chalk.gray("  • Multi-layer security with sandbox protection"));
  console.log(
    chalk.gray("  • Natural language to shell operation translation"),
  );

  console.log(chalk.gray("\n🔜 Coming in Phase B:"));
  console.log(chalk.gray("  • File editing with approval system"));
  console.log(chalk.gray("  • Patch-based modifications"));
  console.log(chalk.gray("  • Interactive approval workflows"));
}
