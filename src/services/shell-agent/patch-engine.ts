/**
 * Patch Engine - Phase B unified diff application system
 * Handles structured patches with approval workflow
 */

import * as fs from "fs/promises";
import * as _path from "path";
import { z } from "zod";

// Patch operation types
export const PatchOperationSchema = z.object({
  type: z.enum([
    "find_replace",
    "unified_diff",
    "append",
    "prepend",
    "delete_lines",
  ]),
  file: z.string(),
  content: z.string().optional(),
  find: z.string().optional(),
  replace: z.string().optional(),
  startLine: z.number().optional(),
  endLine: z.number().optional(),
  context: z.number().default(3),
  offset: z.number().default(5), // ±5 line offset tolerance
});

export type PatchOperation = z.infer<typeof PatchOperationSchema>;

// Patch plan with multiple operations
export const PatchPlanSchema = z.object({
  description: z.string(),
  operations: z.array(PatchOperationSchema),
  requiresApproval: z.boolean().default(true),
  transactionId: z.string(),
  rollbackData: z.record(z.string(), z.string()).optional(), // file -> original content
});

export type PatchPlan = z.infer<typeof PatchPlanSchema>;

// Unified diff parsing
interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: Array<{ type: "add" | "remove" | "context"; content: string }>;
}

export class PatchEngine {
  private rollbackStore: Map<string, string> = new Map();
  private activeTransaction: string | null = null;

  /**
   * Parse unified diff format
   */
  parseUnifiedDiff(diff: string): DiffHunk[] {
    const hunks: DiffHunk[] = [];
    const lines = diff.split("\n");
    let currentHunk: DiffHunk | null = null;

    for (const line of lines) {
      // Parse hunk header: @@ -1,7 +1,7 @@
      const hunkMatch = line.match(/^@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@/);
      if (hunkMatch) {
        currentHunk = {
          oldStart: parseInt(hunkMatch[1]),
          oldLines: parseInt(hunkMatch[2] || "1"),
          newStart: parseInt(hunkMatch[3]),
          newLines: parseInt(hunkMatch[4] || "1"),
          lines: [],
        };
        hunks.push(currentHunk);
        continue;
      }

      if (currentHunk) {
        if (line.startsWith("+")) {
          currentHunk.lines.push({ type: "add", content: line.substring(1) });
        } else if (line.startsWith("-")) {
          currentHunk.lines.push({
            type: "remove",
            content: line.substring(1),
          });
        } else if (line.startsWith(" ")) {
          currentHunk.lines.push({
            type: "context",
            content: line.substring(1),
          });
        }
      }
    }

    return hunks;
  }

  /**
   * Apply unified diff with offset tolerance
   */
  async applyUnifiedDiff(
    _filePath: string,
    diff: string,
    offsetTolerance: number = 5,
  ): Promise<{ success: boolean; applied: number; failed: number }> {
    const content = await fs.readFile(_filePath, "utf-8");
    const lines = content.split("\n");
    const hunks = this.parseUnifiedDiff(diff);

    let applied = 0;
    let failed = 0;
    const resultLines = [...lines];
    let lineOffset = 0;

    for (const hunk of hunks) {
      const targetLine = hunk.oldStart - 1 + lineOffset;

      // Try to find matching context with offset tolerance
      let matchFound = false;
      for (let offset = -offsetTolerance; offset <= offsetTolerance; offset++) {
        const testLine = targetLine + offset;
        if (testLine < 0 || testLine >= resultLines.length) continue;

        if (this.verifyHunkContext(resultLines, testLine, hunk)) {
          // Apply the hunk
          const removed: string[] = [];
          const added: string[] = [];

          for (const line of hunk.lines) {
            if (line.type === "remove") {
              removed.push(line.content);
            } else if (line.type === "add") {
              added.push(line.content);
            }
          }

          // Perform the replacement
          resultLines.splice(testLine, removed.length, ...added);
          lineOffset += added.length - removed.length;
          applied++;
          matchFound = true;
          break;
        }
      }

      if (!matchFound) {
        failed++;
      }
    }

    if (applied > 0) {
      await fs.writeFile(_filePath, resultLines.join("\n"));
    }

    return { success: failed === 0, applied, failed };
  }

  /**
   * Verify hunk context matches
   */
  private verifyHunkContext(
    lines: string[],
    startLine: number,
    hunk: DiffHunk,
  ): boolean {
    let lineIndex = startLine;

    for (const hunkLine of hunk.lines) {
      if (hunkLine.type === "context" || hunkLine.type === "remove") {
        if (
          lineIndex >= lines.length ||
          lines[lineIndex] !== hunkLine.content
        ) {
          return false;
        }
        if (hunkLine.type === "remove") {
          lineIndex++;
        }
      }
      if (hunkLine.type === "context") {
        lineIndex++;
      }
    }

    return true;
  }

  /**
   * Apply find/replace operation
   */
  async applyFindReplace(
    _filePath: string,
    find: string,
    replace: string,
    options: { regex?: boolean; all?: boolean } = {},
  ): Promise<{ success: boolean; replacements: number }> {
    const content = await fs.readFile(_filePath, "utf-8");
    let newContent: string;
    let replacements = 0;

    if (options.regex) {
      const regex = new RegExp(find, options.all ? "g" : "");
      newContent = content.replace(regex, (_match) => {
        replacements++;
        return replace;
      });
    } else {
      if (options.all) {
        const escaped = find.replace(/[.*+?^${}()|[\]\\]/g, "$&");
        const regex = new RegExp(escaped, "g");
        newContent = content.replace(regex, (_match) => {
          replacements++;
          return replace;
        });
      } else {
        const index = content.indexOf(find);
        if (index !== -1) {
          newContent =
            content.substring(0, index) +
            replace +
            content.substring(index + find.length);
          replacements = 1;
        } else {
          newContent = content;
        }
      }
    }

    if (replacements > 0) {
      await fs.writeFile(_filePath, newContent);
    }

    return { success: replacements > 0, replacements };
  }

  /**
   * Start a transaction for rollback support
   */
  async startTransaction(transactionId: string): Promise<void> {
    if (this.activeTransaction) {
      throw new Error(
        `Transaction ${this.activeTransaction} is already active`,
      );
    }
    this.activeTransaction = transactionId;
    this.rollbackStore.clear();
  }

  /**
   * Save file state for rollback
   */
  async saveRollbackState(_filePath: string): Promise<void> {
    if (!this.activeTransaction) {
      throw new Error("No active transaction");
    }

    try {
      const content = await fs.readFile(_filePath, "utf-8");
      this.rollbackStore.set(_filePath, content);
    } catch (error) {
      // File might not exist yet, that's okay
      this.rollbackStore.set(_filePath, "");
    }
  }

  /**
   * Commit transaction (clear rollback data)
   */
  async commitTransaction(): Promise<void> {
    if (!this.activeTransaction) {
      throw new Error("No active transaction");
    }

    this.activeTransaction = null;
    this.rollbackStore.clear();
  }

  /**
   * Rollback transaction (restore original files)
   */
  async rollbackTransaction(): Promise<{ rolledBack: number }> {
    if (!this.activeTransaction) {
      throw new Error("No active transaction");
    }

    let rolledBack = 0;

    for (const [_filePath, originalContent] of this.rollbackStore.entries()) {
      try {
        if (originalContent === "") {
          // File didn't exist, remove it
          await fs.unlink(_filePath);
        } else {
          // Restore original content
          await fs.writeFile(_filePath, originalContent);
        }
        rolledBack++;
      } catch (innerError) {
        console.error(`Failed to rollback ${_filePath}:`, error);
      }
    }

    this.activeTransaction = null;
    this.rollbackStore.clear();

    return { rolledBack };
  }

  /**
   * Execute a patch plan
   */
  async executePatchPlan(plan: PatchPlan): Promise<{
    success: boolean;
    applied: number;
    failed: number;
    message: string;
  }> {
    // Start transaction
    await this.startTransaction(plan.transactionId);

    let applied = 0;
    let failed = 0;
    const results: string[] = [];

    try {
      for (const operation of plan.operations) {
        // Save rollback state before modifying file
        await this.saveRollbackState(operation.file);

        switch (operation.type) {
          case "unified_diff":
            if (operation.content) {
              const result = await this.applyUnifiedDiff(
                operation.file,
                operation.content,
                operation.offset,
              );
              if (result.success) {
                applied += result.applied;
                results.push(
                  `✅ Applied ${result.applied} hunks to ${operation.file}`,
                );
              } else {
                failed += result.failed;
                results.push(
                  `⚠️ Failed ${result.failed} hunks in ${operation.file}`,
                );
              }
            }
            break;

          case "find_replace":
            if (operation.find && operation.replace !== undefined) {
              const result = await this.applyFindReplace(
                operation.file,
                operation.find,
                operation.replace,
                { all: true },
              );
              if (result.success) {
                applied++;
                results.push(
                  `✅ Replaced ${result.replacements} occurrences in ${operation.file}`,
                );
              } else {
                failed++;
                results.push(`❌ No matches found in ${operation.file}`);
              }
            }
            break;

          case "append":
            if (operation.content) {
              const current = await fs
                .readFile(operation.file, "utf-8")
                .catch(() => "");
              await fs.writeFile(operation.file, current + operation.content);
              applied++;
              results.push(`✅ Appended to ${operation.file}`);
            }
            break;

          case "prepend":
            if (operation.content) {
              const current = await fs
                .readFile(operation.file, "utf-8")
                .catch(() => "");
              await fs.writeFile(operation.file, operation.content + current);
              applied++;
              results.push(`✅ Prepended to ${operation.file}`);
            }
            break;

          case "delete_lines":
            if (
              operation.startLine !== undefined &&
              operation.endLine !== undefined
            ) {
              const content = await fs.readFile(operation.file, "utf-8");
              const lines = content.split("\n");
              lines.splice(
                operation.startLine - 1,
                operation.endLine - operation.startLine + 1,
              );
              await fs.writeFile(operation.file, lines.join("\n"));
              applied++;
              results.push(
                `✅ Deleted lines ${operation.startLine}-${operation.endLine} from ${operation.file}`,
              );
            }
            break;
        }
      }

      if (failed === 0) {
        await this.commitTransaction();
        return {
          success: true,
          applied,
          failed,
          message: results.join("\n"),
        };
      } else {
        // Rollback on any failure
        const { rolledBack } = await this.rollbackTransaction();
        return {
          success: false,
          applied: 0,
          failed,
          message: `Transaction rolled back (${rolledBack} files restored)\n${results.join("\n")}`,
        };
      }
    } catch (error) {
      // Rollback on error
      await this.rollbackTransaction();
      throw error;
    }
  }

  /**
   * Generate a diff preview
   */
  async generateDiffPreview(operation: PatchOperation): Promise<string> {
    const lines: string[] = [];

    switch (operation.type) {
      case "find_replace":
        lines.push(`📝 Find/Replace in ${operation.file}`);
        lines.push(`  Find: "${operation.find}"`);
        lines.push(`  Replace: "${operation.replace}"`);
        break;

      case "unified_diff":
        lines.push(`🔧 Patch ${operation.file}`);
        if (operation.content) {
          lines.push(operation.content);
        }
        break;

      case "append":
        lines.push(`➕ Append to ${operation.file}`);
        lines.push(operation.content || "");
        break;

      case "prepend":
        lines.push(`⬆️ Prepend to ${operation.file}`);
        lines.push(operation.content || "");
        break;

      case "delete_lines":
        lines.push(
          `❌ Delete lines ${operation.startLine}-${operation.endLine} from ${operation.file}`,
        );
        break;
    }

    return lines.join("\n");
  }
}
