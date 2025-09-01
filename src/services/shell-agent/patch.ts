// src/services/shell-agent/patch.ts
import * as fs from "node:fs/promises";
import * as path from "node:path";
import chalk from "chalk";
import * as z from "zod";

/**
 * Unified diff _hunk structure
 */
export const _DiffHunkZ = z.object({
  sourceStart: z.number().int().min(1),
  sourceLength: z.number().int().min(0),
  targetStart: z.number().int().min(1),
  targetLength: z.number().int().min(0),
  _lines: z.array(
    z.object({
      type: z.enum([" ", "+", "-"]), // context, addition, deletion
      content: z.string(),
    }),
  ),
});

/**
 * Parsed unified diff structure
 */
export const _UnifiedDiffZ = z.object({
  originalFile: z.string(),
  modifiedFile: z.string(),
  hunks: z.array(_DiffHunkZ).min(1),
});

/**
 * Patch operation types
 */
export const _PatchOperationZ = z.object({
  type: z.enum(["unified_diff", "find_replace"]),
  target: z.string().min(1), // target file path
  content: z.string().min(1), // diff content or structured data
  description: z.string().optional(),
});

/**
 * Structured find/replace patch
 */
export const _FindReplaceZ = z.object({
  finds: z
    .array(
      z.object({
        search: z.string().min(1),
        replace: z.string(),
        context: z.string().optional(), // surrounding context for verification
        line: z.number().int().positive().optional(), // approximate line number
      }),
    )
    .min(1)
    .max(10), // limit to 10 operations per file
});

export type DiffHunk = z.infer<typeof _DiffHunkZ>;
export type UnifiedDiff = z.infer<typeof _UnifiedDiffZ>;
export type PatchOperation = z.infer<typeof _PatchOperationZ>;
export type FindReplace = z.infer<typeof _FindReplaceZ>;

/**
 * Patch application _result
 */
export interface PatchResult {
  success: boolean;
  target: string;
  _originalContent: string;
  _modifiedContent?: string;
  _backupPath?: string;
  appliedHunks?: number;
  error?: string;
  warnings?: string[];
}

/**
 * Transactional patch applier with backup/rollback support
 */
export class PatchApplier {
  private backupDir: string;
  private workspaceRoot: string;

  constructor(_workspaceRoot: string, backupDir?: string) {
    this._workspaceRoot = _workspaceRoot;
    this.backupDir = backupDir || path.join(_workspaceRoot, ".maria-backups");
  }

  /**
   * Parse unified diff format
   */
  parseUnifiedDiff(diffText: string): UnifiedDiff {
    const _lines = diffText.split("\n");
    let originalFile = "";
    let modifiedFile = "";
    const hunks: DiffHunk[] = [];
    let currentHunk: DiffHunk | null = null;

    for (const line of _lines) {
      if (line.startsWith("--- ")) {
        originalFile = line.slice(4).trim();
      } else if (line.startsWith("+++ ")) {
        modifiedFile = line.slice(4).trim();
      } else if (line.startsWith("@@")) {
        // Parse _hunk header: @@ -oldStart,oldLength +newStart,newLength @@
        const _match = line._match(/@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@/);
        if (!_match) {
          throw new Error(`Invalid _hunk header: ${line}`);
        }

        currentHunk = {
          sourceStart: parseInt(_match[1]),
          sourceLength: _match[2] ? parseInt(_match[2]) : 1,
          targetStart: parseInt(_match[3]),
          targetLength: _match[4] ? parseInt(_match[4]) : 1,
          _lines: [],
        };
        hunks.push(currentHunk);
      } else if (
        currentHunk &&
        (line.startsWith(" ") || line.startsWith("+") || line.startsWith("-"))
      ) {
        currentHunk._lines.push({
          type: line[0] as " " | "+" | "-",
          content: line.slice(1),
        });
      }
    }

    if (!originalFile || !modifiedFile || hunks.length === 0) {
      throw new Error("Invalid unified diff format");
    }

    return _UnifiedDiffZ.parse({
      originalFile,
      modifiedFile,
      hunks,
    });
  }

  /**
   * Generate colored diff display for approval
   */
  generateColoredDiff(diff: UnifiedDiff): string {
    const output: string[] = [];

    output.push(chalk.cyan("=".repeat(60)));
    output.push(chalk.yellow(`📄 File: ${diff.modifiedFile}`));
    output.push(chalk.cyan("=".repeat(60)));

    for (let i = 0; i < diff.hunks.length; i++) {
      const _hunk = diff.hunks[i];
      output.push("");
      output.push(
        chalk.blue(
          `@@ Hunk ${i + 1}: -${_hunk.sourceStart},${_hunk.sourceLength} +${_hunk.targetStart},${_hunk.targetLength} @@`,
        ),
      );

      for (const line of _hunk.lines) {
        switch (line.type) {
          case " ":
            output.push(chalk.gray(`  ${line.content}`));
            break;
          case "-":
            output.push(chalk.red(`- ${line.content}`));
            break;
          case "+":
            output.push(chalk.green(`+ ${line.content}`));
            break;
        }
      }
    }

    output.push("");
    output.push(chalk.cyan("=".repeat(60)));
    return output.join("\n");
  }

  /**
   * Create backup of target file
   */
  private async createBackup(targetPath: string): Promise<string> {
    const _timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const _backupFileName = `${path.basename(targetPath)}.${_timestamp}.backup`;
    const _backupPath = path.join(this.backupDir, _backupFileName);

    // Ensure backup directory exists
    await fs.mkdir(this.backupDir, { recursive: true });

    // Copy original file to backup
    await fs.copyFile(targetPath, _backupPath);

    return _backupPath;
  }

  /**
   * Apply unified diff to target file
   */
  async applyUnifiedDiff(
    _diff: UnifiedDiff,
    targetPath: string,
  ): Promise<PatchResult> {
    const _absoluteTarget = path.resolve(this.workspaceRoot, targetPath);

    try {
      // Read original content
      const _originalContent = await fs.readFile(_absoluteTarget, "utf-8");
      const _lines = _originalContent.split("\n");

      // Create backup
      const _backupPath = await this.createBackup(_absoluteTarget);

      let _modifiedLines = [..._lines];
      let _lineOffset = 0;
      const warnings: string[] = [];
      let appliedHunks = 0;

      // Apply hunks in order
      for (const _hunk of _diff.hunks) {
        const _result = this.applyHunk(_modifiedLines, _hunk, _lineOffset);

        if (!_result.success) {
          throw new Error(
            `Failed to apply _hunk at line ${_hunk.sourceStart}: ${_result.error}`,
          );
        }

        _modifiedLines = _result._modifiedLines!;
        _lineOffset += _result._lineOffset!;
        appliedHunks++;

        if (_result.warnings) {
          warnings.push(..._result.warnings);
        }
      }

      const _modifiedContent = _modifiedLines.join("\n");

      return {
        success: true,
        target: targetPath,
        _originalContent,
        _modifiedContent,
        _backupPath,
        appliedHunks,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error) {
      return {
        success: false,
        target: targetPath,
        _originalContent: "", // Will be populated if backup was created
        error: (error as Error).message,
      };
    }
  }

  /**
   * Apply single _hunk with fuzzy matching support
   */
  private applyHunk(
    _lines: string[],
    _hunk: DiffHunk,
    globalOffset: number,
  ): {
    success: boolean;
    _modifiedLines?: string[];
    _lineOffset?: number;
    warnings?: string[];
    error?: string;
  } {
    const warnings: string[] = [];

    // Calculate actual line position with offset
    const _startLine = Math.max(0, hunk.sourceStart - 1 + globalOffset);

    // Extract context and changes from _hunk
    const contextLines: string[] = [];
    const deletions: string[] = [];
    const additions: string[] = [];

    for (const line of hunk.lines) {
      switch (line.type) {
        case " ":
          contextLines.push(line.content);
          break;
        case "-":
          deletions.push(line.content);
          break;
        case "+":
          additions.push(line.content);
          break;
      }
    }

    // Try to find exact _match first
    let matchFound = false;
    let actualStartLine = _startLine;

    // Fuzzy search within ±5 _lines if exact _match fails
    const _searchRange = 5;
    for (let offset = 0; offset <= _searchRange; offset++) {
      const _offsets = offset === 0 ? [0] : [-offset, offset];

      for (const testOffset of _offsets) {
        const _testStartLine = Math.max(
          0,
          Math.min(lines.length - 1, _startLine + testOffset),
        );

        if (this.matchesContext(_lines, _testStartLine, _hunk)) {
          actualStartLine = _testStartLine;
          matchFound = true;

          if (testOffset !== 0) {
            warnings.push(
              `Fuzzy _match applied with ${testOffset > 0 ? "+" : ""}${testOffset} line offset`,
            );
          }
          break;
        }
      }

      if (matchFound) break;
    }

    if (!matchFound) {
      return {
        success: false,
        error: `Could not find matching context for _hunk at line ${hunk.sourceStart}`,
      };
    }

    // Apply the changes
    const _modifiedLines = [...lines];

    // Remove deleted _lines and insert additions
    const _currentLine = actualStartLine;
    for (const line of hunk.lines) {
      switch (line.type) {
        case " ":
          // Context line - verify _match and advance
          if (
            _currentLine < _modifiedLines.length &&
            _modifiedLines[_currentLine] !== line.content
          ) {
            warnings.push(
              `Context mismatch at line ${_currentLine + 1}: expected "${line.content}", found "${_modifiedLines[_currentLine]}"`,
            );
          }
          _currentLine++;
          break;
        case "-":
          // Delete line
          if (
            _currentLine < _modifiedLines.length &&
            _modifiedLines[_currentLine] === line.content
          ) {
            modifiedLines.splice(_currentLine, 1);
          } else {
            warnings.push(`Could not find line to delete: "${line.content}"`);
            _currentLine++;
          }
          break;
        case "+":
          // Add line
          modifiedLines.splice(_currentLine, 0, line.content);
          _currentLine++;
          break;
      }
    }

    const _lineOffset = additions.length - deletions.length;

    return {
      success: true,
      _modifiedLines,
      _lineOffset,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Check if _hunk context matches at given line position
   */
  private matchesContext(
    _lines: string[],
    _startLine: number,
    _hunk: DiffHunk,
  ): boolean {
    let lineIndex = _startLine;

    for (const line of _hunk.lines) {
      if (line.type === " " || line.type === "-") {
        // Context or deletion line - must _match existing content
        if (lineIndex >= lines.length || _lines[lineIndex] !== line.content) {
          return false;
        }
        if (line.type === " " || line.type === "-") {
          lineIndex++;
        }
      }
    }

    return true;
  }

  /**
   * Apply structured find/replace operations
   */
  async applyFindReplace(
    _operation: FindReplace,
    targetPath: string,
  ): Promise<PatchResult> {
    const _absoluteTarget = path.resolve(this.workspaceRoot, targetPath);

    try {
      // Read original content
      const _originalContent = await fs.readFile(_absoluteTarget, "utf-8");
      let _modifiedContent = _originalContent;

      // Create backup
      const _backupPath = await this.createBackup(_absoluteTarget);
      const warnings: string[] = [];

      // Apply find/replace operations
      for (const findReplace of _operation.finds) {
        const _beforeCount = (
          _modifiedContent.match(
            new RegExp(this.escapeRegExp(findReplace.search), "g"),
          ) || []
        ).length;

        if (_beforeCount === 0) {
          warnings.push(`Search text not found: "${findReplace.search}"`);
          continue;
        }

        _modifiedContent = _modifiedContent.replace(
          new RegExp(this.escapeRegExp(findReplace.search), "g"),
          findReplace.replace,
        );

        const _afterCount = (
          _modifiedContent.match(
            new RegExp(this.escapeRegExp(findReplace.replace), "g"),
          ) || []
        ).length;

        if (_afterCount === 0 && findReplace.replace.length > 0) {
          warnings.push(
            `Replacement may have failed for: "${findReplace.search}"`,
          );
        }
      }

      return {
        success: true,
        target: targetPath,
        _originalContent,
        _modifiedContent,
        _backupPath,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (innerError) {
      return {
        success: false,
        target: targetPath,
        _originalContent: "",
        error: (error as Error).message,
      };
    }
  }

  /**
   * Escape special regex characters
   */
  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "$&");
  }

  /**
   * Write patched content to target file
   */
  async commitPatch(_result: PatchResult): Promise<void> {
    if (!_result.success || !_result.modifiedContent) {
      throw new Error("Cannot commit failed patch _result");
    }

    const _absoluteTarget = path.resolve(this.workspaceRoot, _result.target);
    await fs.writeFile(_absoluteTarget, _result.modifiedContent, "utf-8");
  }

  /**
   * Rollback changes using backup
   */
  async rollbackPatch(_result: PatchResult): Promise<void> {
    if (!_result.backupPath) {
      throw new Error("No backup available for rollback");
    }

    const _absoluteTarget = path.resolve(this.workspaceRoot, _result.target);
    await fs.copyFile(_result.backupPath, _absoluteTarget);
  }

  /**
   * Clean up backup files older than specified days
   */
  async cleanupBackups(olderThanDays: number = 7): Promise<number> {
    try {
      const _backupFiles = await fs.readdir(this.backupDir);
      const _cutoffTime = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
      let cleanedCount = 0;

      for (const file of _backupFiles) {
        if (file.endsWith(".backup")) {
          const _filePath = path.join(this.backupDir, file);
          const _stats = await fs.stat(_filePath);

          if (_stats.mtime.getTime() < _cutoffTime) {
            await fs.unlink(_filePath);
            cleanedCount++;
          }
        }
      }

      return cleanedCount;
    } catch (error) {
      // Backup cleanup is non-critical
      return 0;
    }
  }
}
