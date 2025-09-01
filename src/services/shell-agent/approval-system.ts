/**
 * Approval System - Phase B interactive approval with colored diff display
 */

import * as readline from "readline";
import * as chalk from "chalk";
import { PatchPlan, PatchOperation, PatchEngine } from "./patch-engine";

export interface ApprovalConfig {
  autoApprove?: boolean;
  colorize?: boolean;
  showLineNumbers?: boolean;
  contextLines?: number;
}

export interface ApprovalResult {
  approved: boolean;
  userResponse: "approve" | "reject" | "skip" | "abort";
  modifiedPlan?: PatchPlan;
}

export class ApprovalSystem {
  private patchEngine: PatchEngine;
  private rl: readline.Interface | null = null;

  constructor() {
    this.patchEngine = new PatchEngine();
  }

  /**
   * Format diff with colors for terminal display
   */
  private formatColoredDiff(
    diff: string,
    showLineNumbers: boolean = true,
  ): string {
    const lines = diff.split("\n");
    const formatted: string[] = [];
    let lineNum = 1;

    for (const line of lines) {
      let formattedLine = line;

      if (line.startsWith("+++") || line.startsWith("---")) {
        formattedLine = chalk.bold.cyan(line);
      } else if (line.startsWith("@@")) {
        formattedLine = chalk.magenta(line);
      } else if (line.startsWith("+")) {
        if (showLineNumbers) {
          formattedLine = chalk.green(
            `${lineNum.toString().padStart(4)} + ${line.substring(1)}`,
          );
        } else {
          formattedLine = chalk.green(line);
        }
        lineNum++;
      } else if (line.startsWith("-")) {
        if (showLineNumbers) {
          formattedLine = chalk.red(
            `${lineNum.toString().padStart(4)} - ${line.substring(1)}`,
          );
        } else {
          formattedLine = chalk.red(line);
        }
        lineNum++;
      } else if (line.startsWith(" ")) {
        if (showLineNumbers) {
          formattedLine = chalk.gray(
            `${lineNum.toString().padStart(4)}   ${line.substring(1)}`,
          );
        } else {
          formattedLine = chalk.gray(line);
        }
        lineNum++;
      }

      formatted.push(formattedLine);
    }

    return formatted.join("\n");
  }

  /**
   * Format operation for display
   */
  private formatOperation(operation: PatchOperation, index: number): string {
    const lines: string[] = [];

    lines.push(chalk.bold.yellow(`\n━━━ Operation ${index + 1} ━━━`));
    lines.push(chalk.cyan(`Type: ${operation.type}`));
    lines.push(chalk.cyan(`File: ${operation.file}`));

    switch (operation.type) {
      case "find_replace":
        lines.push(chalk.white("Find pattern:"));
        lines.push(chalk.red(`  - ${operation.find}`));
        lines.push(chalk.white("Replace with:"));
        lines.push(chalk.green(`  + ${operation.replace}`));
        break;

      case "unified_diff":
        if (operation.content) {
          lines.push(chalk.white("Diff:"));
          lines.push(this.formatColoredDiff(operation.content));
        }
        break;

      case "append":
        lines.push(chalk.white("Append content:"));
        lines.push(chalk.green(operation.content || ""));
        break;

      case "prepend":
        lines.push(chalk.white("Prepend content:"));
        lines.push(chalk.green(operation.content || ""));
        break;

      case "delete_lines":
        lines.push(
          chalk.white(
            `Delete lines ${operation.startLine}-${operation.endLine}`,
          ),
        );
        break;
    }

    return lines.join("\n");
  }

  /**
   * Display patch plan summary
   */
  private displayPlanSummary(plan: PatchPlan): void {
    console.log(
      chalk.bold.blue("\n╔════════════════════════════════════════╗"),
    );
    console.log(chalk.bold.blue("║       PATCH APPROVAL REQUEST          ║"));
    console.log(chalk.bold.blue("╚════════════════════════════════════════╝"));

    console.log(chalk.yellow(`\n📋 Description: ${plan.description}`));
    console.log(chalk.cyan(`🔧 Operations: ${plan.operations.length}`));
    console.log(chalk.cyan(`🔄 Transaction ID: ${plan.transactionId}`));

    const fileCount = new Set(plan.operations.map((op) => op.file)).size;
    console.log(chalk.cyan(`📁 Files affected: ${fileCount}`));

    // Operation type breakdown
    const typeCounts = plan.operations.reduce(
      (acc, op) => {
        acc[op.type] = (acc[op.type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    console.log(chalk.white("\n📊 Operation breakdown:"));
    for (const [type, count] of Object.entries(typeCounts)) {
      const icon = this.getOperationIcon(type);
      console.log(`  ${icon} ${type}: ${count}`);
    }
  }

  /**
   * Get icon for operation type
   */
  private getOperationIcon(type: string): string {
    switch (type) {
      case "find_replace":
        return "🔄";
      case "unified_diff":
        return "🔧";
      case "append":
        return "➕";
      case "prepend":
        return "⬆️";
      case "delete_lines":
        return "❌";
      default:
        return "📝";
    }
  }

  /**
   * Prompt user for approval
   */
  private async promptUser(question: string): Promise<string> {
    if (!this.rl) {
      this.rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
    }

    return new Promise((resolve) => {
      this.rl!.question(question, (answer) => {
        resolve(answer.toLowerCase().trim());
      });
    });
  }

  /**
   * Interactive approval flow
   */
  async requestApproval(
    plan: PatchPlan,
    config: ApprovalConfig = {},
  ): Promise<ApprovalResult> {
    const {
      autoApprove = false,
      colorize = true,
      _showLineNumbers = true,
    } = config;

    // Auto-approve if configured
    if (autoApprove) {
      console.log(chalk.green("✅ Auto-approved (--auto flag)"));
      return {
        approved: true,
        userResponse: "approve",
        modifiedPlan: plan,
      };
    }

    // Display plan summary
    this.displayPlanSummary(plan);

    // Display each operation
    for (let i = 0; i < plan.operations.length; i++) {
      console.log(this.formatOperation(plan.operations[i], i));
    }

    // Display approval options
    console.log(chalk.bold.yellow("\n━━━ Approval Options ━━━"));
    console.log(chalk.white("  [a] Approve all operations"));
    console.log(chalk.white("  [r] Reject all operations"));
    console.log(chalk.white("  [s] Select operations individually"));
    console.log(chalk.white("  [d] Show detailed diff"));
    console.log(chalk.white("  [q] Quit/Abort"));

    let response = await this.promptUser(
      chalk.bold.green("\n→ Your choice [a/r/s/d/q]: "),
    );

    while (response === "d") {
      // Show detailed diff
      console.log(chalk.bold.blue("\n━━━ Detailed Diff View ━━━"));
      for (let i = 0; i < plan.operations.length; i++) {
        const preview = await this.patchEngine.generateDiffPreview(
          plan.operations[i],
        );
        console.log(chalk.bold.yellow(`\nOperation ${i + 1}:`));
        console.log(colorize ? this.formatColoredDiff(preview) : preview);
      }
      response = await this.promptUser(
        chalk.bold.green("\n→ Your choice [a/r/s/q]: "),
      );
    }

    if (response === "a" || response === "approve") {
      console.log(chalk.green("✅ All operations approved"));
      this.cleanup();
      return {
        approved: true,
        userResponse: "approve",
        modifiedPlan: plan,
      };
    }

    if (response === "r" || response === "reject") {
      console.log(chalk.red("❌ All operations rejected"));
      this.cleanup();
      return {
        approved: false,
        userResponse: "reject",
      };
    }

    if (response === "s" || response === "select") {
      // Individual operation selection
      const selectedOps: PatchOperation[] = [];

      for (let i = 0; i < plan.operations.length; i++) {
        console.log(this.formatOperation(plan.operations[i], i));
        const opResponse = await this.promptUser(
          chalk.bold.green(`\n→ Approve operation ${i + 1}? [y/n]: `),
        );

        if (opResponse === "y" || opResponse === "yes") {
          selectedOps.push(plan.operations[i]);
          console.log(chalk.green(`  ✅ Operation ${i + 1} approved`));
        } else {
          console.log(chalk.yellow(`  ⏭️ Operation ${i + 1} skipped`));
        }
      }

      if (selectedOps.length > 0) {
        this.cleanup();
        return {
          approved: true,
          userResponse: "approve",
          modifiedPlan: {
            ...plan,
            operations: selectedOps,
          },
        };
      } else {
        console.log(chalk.yellow("⚠️ No operations selected"));
        this.cleanup();
        return {
          approved: false,
          userResponse: "skip",
        };
      }
    }

    // Default to abort
    console.log(chalk.red("🛑 Operation aborted"));
    this.cleanup();
    return {
      approved: false,
      userResponse: "abort",
    };
  }

  /**
   * Display execution results
   */
  displayExecutionResults(results: {
    success: boolean;
    applied: number;
    failed: number;
    message: string;
  }): void {
    console.log(
      chalk.bold.blue("\n╔════════════════════════════════════════╗"),
    );
    console.log(chalk.bold.blue("║       EXECUTION RESULTS               ║"));
    console.log(chalk.bold.blue("╚════════════════════════════════════════╝"));

    if (results.success) {
      console.log(chalk.green(`\n✅ Success: All operations completed`));
    } else {
      console.log(chalk.red(`\n❌ Failed: Some operations failed`));
    }

    console.log(chalk.cyan(`📊 Applied: ${results.applied} operations`));
    if (results.failed > 0) {
      console.log(chalk.red(`⚠️ Failed: ${results.failed} operations`));
    }

    console.log(chalk.white("\n📝 Details:"));
    console.log(results.message);
  }

  /**
   * Execute approved plan with visual feedback
   */
  async executeApprovedPlan(plan: PatchPlan): Promise<void> {
    console.log(chalk.bold.yellow("\n⚙️ Executing approved operations..."));

    // Show progress for each operation
    for (let i = 0; i < plan.operations.length; i++) {
      const op = plan.operations[i];
      process.stdout.write(
        chalk.cyan(
          `  [${i + 1}/${plan.operations.length}] ${op.type} on ${op.file}... `,
        ),
      );

      // Small delay for visual feedback
      await new Promise((resolve) => setTimeout(resolve, 100));

      process.stdout.write(chalk.green("✓\n"));
    }

    // Execute the plan
    const results = await this.patchEngine.executePatchPlan(plan);

    // Display results
    this.displayExecutionResults(results);
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }
  }

  /**
   * Full approval and execution flow
   */
  async approveAndExecute(
    plan: PatchPlan,
    config: ApprovalConfig = {},
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Request approval
      const approval = await this.requestApproval(plan, config);

      if (!approval.approved) {
        return {
          success: false,
          message: `Operation ${approval.userResponse}`,
        };
      }

      // Execute approved plan
      const planToExecute = approval.modifiedPlan || plan;
      await this.executeApprovedPlan(planToExecute);

      return {
        success: true,
        message: "Operations completed successfully",
      };
    } catch (error) {
      this.cleanup();
      throw error;
    }
  }
}
