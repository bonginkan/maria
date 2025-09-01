// src/services/shell-agent/patch-approval.ts
import readline from "node:readline";
import chalk from "chalk";
import { PatchApplier, PatchResult, UnifiedDiff, FindReplace } from "./patch";

/**
 * Patch approval options
 */
export interface ApprovalOptions {
  autoApprove?: boolean;
  timeout?: number; // ms
  showLineNumbers?: boolean;
  compactMode?: boolean;
}

/**
 * Approval decision
 */
export interface ApprovalDecision {
  _approved: boolean;
  method: "user" | "auto" | "timeout";
  timestamp: Date;
  responseTime: number; // ms
}

/**
 * Interactive patch approval interface
 */
export class PatchApprovalInterface {
  private applier: PatchApplier;
  private options: ApprovalOptions;

  constructor(_applier: PatchApplier, options: ApprovalOptions = {}) {
    this._applier = _applier;
    this.options = {
      autoApprove: false,
      timeout: 30000, // 30 seconds default
      showLineNumbers: true,
      compactMode: false,
      ...options,
    };
  }

  /**
   * Request approval for unified diff patch
   */
  async requestUnifiedDiffApproval(
    diff: UnifiedDiff,
  ): Promise<ApprovalDecision> {
    const _startTime = Date.now();

    // Auto-approve if configured
    if (this.options.autoApprove) {
      return {
        _approved: true,
        method: "auto",
        timestamp: new Date(),
        responseTime: Date.now() - _startTime,
      };
    }

    // Display colored diff
    console.log("");
    console.log(chalk.yellow("🔍 Patch Review Required"));
    console.log("");
    console.log(this.applier.generateColoredDiff(diff));
    console.log("");

    // Show summary
    const _totalHunks = diff.hunks.length;
    const _totalAdditions = diff.hunks.reduce(
      (sum, hunk) =>
        sum + hunk.lines.filter((line) => line.type === "+").length,
      0,
    );
    const _totalDeletions = diff.hunks.reduce(
      (sum, hunk) =>
        sum + hunk.lines.filter((line) => line.type === "-").length,
      0,
    );

    console.log(chalk.blue("📊 Summary:"));
    console.log(`  • Hunks: ${_totalHunks}`);
    console.log(`  • ${chalk.green(`+${_totalAdditions} additions`)}`);
    console.log(`  • ${chalk.red(`-${_totalDeletions} deletions`)}`);
    console.log("");

    // Request approval
    return await this.promptForApproval(_startTime);
  }

  /**
   * Request approval for find/replace operations
   */
  async requestFindReplaceApproval(
    _operation: FindReplace,
    targetFile: string,
    _previewContent?: string,
  ): Promise<ApprovalDecision> {
    const _startTime = Date.now();

    // Auto-approve if configured
    if (this.options.autoApprove) {
      return {
        _approved: true,
        method: "auto",
        timestamp: new Date(),
        responseTime: Date.now() - _startTime,
      };
    }

    // Display find/replace operations
    console.log("");
    console.log(chalk.yellow("🔍 Find/Replace Operations Review Required"));
    console.log("");
    console.log(chalk.cyan("=".repeat(60)));
    console.log(chalk.yellow(`📄 Target File: ${targetFile}`));
    console.log(chalk.cyan("=".repeat(60)));

    for (let i = 0; i < _operation.finds.length; i++) {
      const _findReplace = _operation.finds[i];
      console.log("");
      console.log(chalk.blue(`🔄 Operation ${i + 1}:`));

      if (_findReplace.line) {
        console.log(chalk.gray(`   Line ~${_findReplace.line}`));
      }

      console.log(chalk.red(`   Find:    "${_findReplace.search}"`));
      console.log(chalk.green(`   Replace: "${_findReplace.replace}"`));

      if (_findReplace.context) {
        console.log(chalk.gray(`   Context: "${_findReplace.context}"`));
      }
    }

    // Show preview if available
    if (_previewContent) {
      console.log("");
      console.log(chalk.blue("👁️  Preview:"));
      console.log(chalk.gray("─".repeat(40)));
      const _lines = previewContent.split("\n");
      const _previewLines = _lines.slice(0, 10); // Show first 10 _lines

      for (let i = 0; i < _previewLines.length; i++) {
        const _lineNum = this.options.showLineNumbers
          ? `${i + 1}: `.padStart(4)
          : "";
        console.log(chalk.gray(_lineNum + _previewLines[i]));
      }

      if (_lines.length > 10) {
        console.log(chalk.gray(`... and ${_lines.length - 10} more _lines`));
      }
      console.log(chalk.gray("─".repeat(40)));
    }

    console.log("");

    // Show summary
    console.log(chalk.blue("📊 Summary:"));
    console.log(`  • Operations: ${_operation.finds.length}`);
    console.log(`  • Target: ${targetFile}`);
    console.log("");

    // Request approval
    return await this.promptForApproval(_startTime);
  }

  /**
   * Interactive approval prompt
   */
  private async promptForApproval(
    _startTime: number,
  ): Promise<ApprovalDecision> {
    return new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      let timeoutId: NodeJS.Timeout | undefined;
      let resolved = false;

      const _handleResponse = (
        _approved: boolean,
        method: "user" | "timeout",
      ) => {
        if (resolved) return;
        resolved = true;

        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        rl.close();

        resolve({
          _approved,
          method,
          timestamp: new Date(),
          responseTime: Date.now() - _startTime,
        });
      };

      // Set timeout if configured
      if (this.options.timeout && this.options.timeout > 0) {
        timeoutId = setTimeout(() => {
          console.log("");
          console.log(chalk.yellow("⏰ Timeout reached. Patch rejected."));
          _handleResponse(false, "timeout");
        }, this.options.timeout);
      }

      // Display prompt
      const _promptText =
        chalk.yellow("❓ Apply this patch? ") +
        chalk.gray("(") +
        chalk.green("y") +
        chalk.gray("/") +
        chalk.red("n") +
        chalk.gray("/") +
        chalk.blue("v") +
        chalk.gray(" for verbose) ");

      rl.question(_promptText, (answer) => {
        const _response = answer.toLowerCase().trim();

        switch (_response) {
          case "y":
          case "yes":
          case "apply":
            console.log(chalk.green("✅ Patch _approved for application"));
            _handleResponse(true, "user");
            break;

          case "n":
          case "no":
          case "reject":
          case "cancel":
            console.log(chalk.red("❌ Patch rejected"));
            _handleResponse(false, "user");
            break;

          case "v":
          case "verbose":
            // Show additional details and re-prompt
            this.showVerboseInfo();
            setTimeout(() => {
              if (!resolved) {
                rl.question(_promptText, (retryAnswer) => {
                  const _retryResponse = retryAnswer.toLowerCase().trim();
                  if (["y", "yes", "apply"].includes(_retryResponse)) {
                    console.log(
                      chalk.green("✅ Patch _approved for application"),
                    );
                    _handleResponse(true, "user");
                  } else {
                    console.log(chalk.red("❌ Patch rejected"));
                    _handleResponse(false, "user");
                  }
                });
              }
            }, 100);
            break;

          default:
            console.log(
              chalk.yellow("Please answer y(es), n(o), or v(erbose)"),
            );
            setTimeout(() => {
              if (!resolved) {
                rl.question(_promptText, (retryAnswer) => {
                  const _retryResponse = retryAnswer.toLowerCase().trim();
                  if (["y", "yes", "apply"].includes(_retryResponse)) {
                    console.log(
                      chalk.green("✅ Patch _approved for application"),
                    );
                    _handleResponse(true, "user");
                  } else {
                    console.log(chalk.red("❌ Patch rejected"));
                    _handleResponse(false, "user");
                  }
                });
              }
            }, 100);
            break;
        }
      });

      // Handle Ctrl+C
      rl.on("SIGINT", () => {
        console.log("");
        console.log(chalk.red("❌ Patch rejected (interrupted)"));
        _handleResponse(false, "user");
      });
    });
  }

  /**
   * Show verbose information about the patch
   */
  private showVerboseInfo(): void {
    console.log("");
    console.log(chalk.blue("🔍 Verbose Information:"));
    console.log(chalk.gray("─".repeat(40)));
    console.log(`• Backup will be created automatically`);
    console.log(`• Changes can be rolled back if needed`);
    console.log(`• Fuzzy matching supports ±5 line offsets`);
    console.log(`• Context verification prevents incorrect application`);
    console.log(`• All operations are logged for audit`);
    console.log(chalk.gray("─".repeat(40)));
    console.log("");
  }

  /**
   * Handle patch application with approval workflow
   */
  async applyWithApproval(
    _diff: UnifiedDiff,
    targetPath: string,
  ): Promise<{
    _result: PatchResult;
    _approved: ApprovalDecision;
  }> {
    // Request approval
    const _approved = await this.requestUnifiedDiffApproval(_diff);

    if (!_approved._approved) {
      return {
        _result: {
          success: false,
          target: targetPath,
          originalContent: "",
          error: `Patch rejected by ${_approved.method}`,
        },
        _approved,
      };
    }

    // Apply the patch
    console.log(chalk.blue("🔧 Applying patch..."));
    const _result = await this.applier.applyUnifiedDiff(_diff, targetPath);

    if (_result.success) {
      // Commit the changes
      await this.applier.commitPatch(_result);
      console.log(chalk.green("✅ Patch applied successfully"));

      if (_result.warnings && _result.warnings.length > 0) {
        console.log(chalk.yellow("⚠️  Warnings:"));
        for (const warning of _result.warnings) {
          console.log(chalk.yellow(`   • ${warning}`));
        }
      }
    } else {
      console.log(chalk.red("❌ Patch application failed"));
    }

    return { _result, _approved };
  }

  /**
   * Handle find/replace application with approval workflow
   */
  async applyFindReplaceWithApproval(
    _operation: FindReplace,
    targetPath: string,
  ): Promise<{
    _result: PatchResult;
    _approved: ApprovalDecision;
  }> {
    // Generate preview content for approval
    const _previewResult = await this.applier.applyFindReplace(
      _operation,
      targetPath,
    );
    const _previewContent = _previewResult.success
      ? _previewResult.modifiedContent
      : undefined;

    // Request approval
    const _approved = await this.requestFindReplaceApproval(
      _operation,
      targetPath,
      _previewContent,
    );

    if (!_approved._approved) {
      return {
        _result: {
          success: false,
          target: targetPath,
          originalContent: "",
          error: `Find/replace rejected by ${_approved.method}`,
        },
        _approved,
      };
    }

    // Apply the operations
    console.log(chalk.blue("🔧 Applying find/replace operations..."));
    const _result = await this.applier.applyFindReplace(_operation, targetPath);

    if (_result.success) {
      // Commit the changes
      await this.applier.commitPatch(_result);
      console.log(
        chalk.green("✅ Find/replace operations applied successfully"),
      );

      if (_result.warnings && _result.warnings.length > 0) {
        console.log(chalk.yellow("⚠️  Warnings:"));
        for (const warning of _result.warnings) {
          console.log(chalk.yellow(`   • ${warning}`));
        }
      }
    } else {
      console.log(chalk.red("❌ Find/replace operations failed"));
    }

    return { _result, _approved };
  }

  /**
   * Update approval options
   */
  updateOptions(options: Partial<ApprovalOptions>): void {
    this.options = { ...this.options, ...options };
  }
}
