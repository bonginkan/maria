/**
 * Delta Detection Module
 * Detects changes using git, mtime, or state-based comparison
 */

import * as fs from "fs/promises";
import * as path from "path";
import * as crypto from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";
import { globby } from "globby";

const execFileAsync = promisify(execFile);

export interface DeltaOptions {
  since: string; // "git:HEAD~1" | "YYYY-MM-DD" | "state"
  budgetMs?: number; // Time budget for scanning
  include?: string[]; // Glob patterns to include
  exclude?: string[]; // Glob patterns to exclude
  maxFiles?: number; // Maximum files to process
}

export interface DeltaResult {
  mode: "git" | "mtime" | "state" | "watch";
  changed: string[]; // Files that were modified/added
  deleted: string[]; // Files that were deleted
  ref?: string; // Git reference if applicable
  since?: string; // Date if applicable
  nowHashes?: Record<string, string>; // Current file hashes for state update
  stats: {
    scanTime: number;
    totalFiles: number;
    changedFiles: number;
    deletedFiles: number;
  };
}

export interface FileEntry {
  file: string;
  mtime?: Date;
  hash?: string;
  size?: number;
}

export interface StateSnapshot {
  version: string;
  root: string;
  lastRunAt: string;
  snapshot?: {
    fileHashes?: Record<string, string>;
    filesCount?: number;
  };
}

export class DeltaDetector {
  private startTime = 0;

  /**
   * Detect changes based on the specified method
   */
  async detectDelta(root: string, options: DeltaOptions): Promise<DeltaResult> {
    this.startTime = Date.now();

    // Parse the since option
    if (options.since.startsWith("git:")) {
      return this.detectByGit(root, options.since.slice(4), options);
    }

    if (options.since.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return this.detectByMtime(root, new Date(options.since), options);
    }

    if (options.since === "state") {
      return this.detectByState(root, options);
    }

    if (options.since === "watch") {
      // Watch mode would be implemented with file watchers
      return this.detectByWatch(root, options);
    }

    // Default to state-based detection
    return this.detectByState(root, options);
  }

  /**
   * Detect changes using git diff
   */
  private async detectByGit(
    root: string,
    ref: string,
    options: DeltaOptions,
  ): Promise<DeltaResult> {
    try {
      // Get list of changed files from git
      const { stdout } = await execFileAsync(
        "git",
        ["diff", "--name-status", ref],
        { cwd: root },
      );

      const changes = stdout
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [status, ...rest] = line.split(/\s+/);
          const file = rest.join(" ");
          return { status, file: path.resolve(root, file) };
        });

      // Filter by include/exclude patterns
      const filtered = await this.filterFiles(
        changes.map((c) => c.file),
        root,
        options,
      );

      const filteredSet = new Set(filtered);
      const filteredChanges = changes.filter((c) => filteredSet.has(c.file));

      // Separate deleted and modified files
      const deleted = filteredChanges
        .filter((c) => c.status === "D")
        .map((c) => path.relative(root, c.file));

      const changed = filteredChanges
        .filter((c) => c.status !== "D")
        .map((c) => path.relative(root, c.file));

      return {
        mode: "git",
        ref,
        changed,
        deleted,
        stats: {
          scanTime: Date.now() - this.startTime,
          totalFiles: changes.length,
          changedFiles: changed.length,
          deletedFiles: deleted.length,
        },
      };
    } catch (error: any) {
      // Git not available or not a git repo
      console.warn(
        "Git detection failed, falling back to state detection:",
        error.message,
      );
      return this.detectByState(root, options);
    }
  }

  /**
   * Detect changes by modification time
   */
  private async detectByMtime(
    root: string,
    since: Date,
    options: DeltaOptions,
  ): Promise<DeltaResult> {
    const entries = await this.walkFiles(root, options);
    const changed: string[] = [];

    for (const entry of entries) {
      if (options.budgetMs && Date.now() - this.startTime > options.budgetMs) {
        break;
      }

      if (entry.mtime && entry.mtime > since) {
        changed.push(path.relative(root, entry.file));
      }

      if (options.maxFiles && changed.length >= options.maxFiles) {
        break;
      }
    }

    return {
      mode: "mtime",
      since: since.toISOString(),
      changed,
      deleted: [], // Can't detect deletions with mtime only
      stats: {
        scanTime: Date.now() - this.startTime,
        totalFiles: entries.length,
        changedFiles: changed.length,
        deletedFiles: 0,
      },
    };
  }

  /**
   * Detect changes by comparing with state.json
   */
  private async detectByState(
    root: string,
    options: DeltaOptions,
  ): Promise<DeltaResult> {
    const statePath = path.join(root, ".maria", "state.json");
    let lastHashes: Record<string, string> = {};

    // Try to load previous state
    try {
      const stateContent = await fs.readFile(statePath, "utf-8");
      const state: StateSnapshot = JSON.parse(stateContent);
      lastHashes = state.snapshot?.fileHashes || {};
    } catch {
      // No previous state, treat all files as new
      console.info("No previous state found, treating all files as new");
    }

    // Get current file list and hashes
    const entries = await this.walkFiles(root, options);
    const nowHashes: Record<string, string> = {};
    const changed: string[] = [];

    for (const entry of entries) {
      if (options.budgetMs && Date.now() - this.startTime > options.budgetMs) {
        break;
      }

      const relativePath = path.relative(root, entry.file);
      const hash = entry.hash || (await this.hashFile(entry.file));

      nowHashes[relativePath] = hash;

      // Check if file is new or changed
      if (!lastHashes[relativePath] || lastHashes[relativePath] !== hash) {
        changed.push(relativePath);
      }

      if (options.maxFiles && changed.length >= options.maxFiles) {
        break;
      }
    }

    // Find deleted files
    const currentFiles = new Set(Object.keys(nowHashes));
    const deleted = Object.keys(lastHashes).filter((f) => !currentFiles.has(f));

    return {
      mode: "state",
      changed,
      deleted,
      nowHashes,
      stats: {
        scanTime: Date.now() - this.startTime,
        totalFiles: entries.length,
        changedFiles: changed.length,
        deletedFiles: deleted.length,
      },
    };
  }

  /**
   * Detect changes in watch mode (placeholder)
   */
  private async detectByWatch(
    root: string,
    options: DeltaOptions,
  ): Promise<DeltaResult> {
    // This would integrate with file watchers like chokidar
    // For now, fall back to state detection
    console.info("Watch mode not yet implemented, using state detection");
    return this.detectByState(root, options);
  }

  /**
   * Walk directory and get file entries
   */
  private async walkFiles(
    root: string,
    options: DeltaOptions,
  ): Promise<FileEntry[]> {
    const patterns = options.include || ["**/*"];
    const ignore = [
      "**/node_modules/**",
      "**/.git/**",
      "**/dist/**",
      "**/build/**",
      "**/.maria/**",
      "**/.next/**",
      "**/coverage/**",
      ...(options.exclude || []),
    ];

    const files = await globby(patterns, {
      cwd: root,
      absolute: true,
      ignore,
      gitignore: true,
      stats: true,
    });

    const entries: FileEntry[] = [];

    for (const file of files) {
      try {
        const stat = await fs.stat(file);

        // Skip directories
        if (stat.isDirectory()) continue;

        entries.push({
          file,
          mtime: stat.mtime,
          size: stat.size,
        });
      } catch {
        // File might have been deleted during scan
        continue;
      }
    }

    return entries;
  }

  /**
   * Filter files based on include/exclude patterns
   */
  private async filterFiles(
    files: string[],
    root: string,
    options: DeltaOptions,
  ): Promise<string[]> {
    if (!options.include && !options.exclude) {
      return files;
    }

    const patterns = options.include || ["**/*"];
    const ignore = options.exclude || [];

    // Convert absolute paths to relative for matching
    const relativePaths = files.map((f) => path.relative(root, f));

    // Use globby's matching logic
    const matched = await globby(patterns, {
      cwd: root,
      ignore,
      absolute: false,
    });

    const matchedSet = new Set(matched);

    return files.filter((f, i) => matchedSet.has(relativePaths[i]));
  }

  /**
   * Calculate file hash
   */
  private async hashFile(_filePath: string): Promise<string> {
    try {
      const content = await fs.readFile(_filePath);
      return crypto.createHash("sha256").update(content).digest("hex");
    } catch {
      // File might have been deleted or inaccessible
      return "";
    }
  }

  /**
   * Update state.json with new hashes
   */
  async updateState(root: string, delta: DeltaResult): Promise<void> {
    const statePath = path.join(root, ".maria", "state.json");

    // Ensure .maria directory exists
    await fs.mkdir(path.dirname(statePath), { recursive: true });

    // Load existing state or create new
    let state: StateSnapshot;
    try {
      const content = await fs.readFile(statePath, "utf-8");
      state = JSON.parse(content);
    } catch {
      state = {
        version: "2.1.0",
        root,
        lastRunAt: new Date().toISOString(),
      };
    }

    // Update state with new information
    state.lastRunAt = new Date().toISOString();

    if (!state.snapshot) {
      state.snapshot = {};
    }

    if (delta.nowHashes) {
      state.snapshot.fileHashes = delta.nowHashes;
      state.snapshot.filesCount = Object.keys(delta.nowHashes).length;
    } else if (delta.mode === "git" || delta.mode === "mtime") {
      // For git/mtime modes, we need to update hashes for changed files
      const currentHashes = state.snapshot.fileHashes || {};

      // Remove deleted files
      delta.deleted.forEach((file) => {
        delete currentHashes[file];
      });

      // Update changed files (would need to hash them)
      for (const file of delta.changed) {
        const fullPath = path.join(root, file);
        try {
          const hash = await this.hashFile(fullPath);
          if (hash) {
            currentHashes[file] = hash;
          }
        } catch {
          // File might be inaccessible
        }
      }

      state.snapshot.fileHashes = currentHashes;
      state.snapshot.filesCount = Object.keys(currentHashes).length;
    }

    // Write updated state
    await fs.writeFile(statePath, JSON.stringify(state, null, 2), "utf-8");
  }

  /**
   * Get summary of changes for display
   */
  formatSummary(delta: DeltaResult): string {
    const lines: string[] = [];

    lines.push(`Delta Detection Summary:`);
    lines.push(`  Mode: ${delta.mode}`);

    if (delta.ref) {
      lines.push(`  Git ref: ${delta.ref}`);
    }

    if (delta.since) {
      lines.push(`  Since: ${delta.since}`);
    }

    lines.push(`  Scan time: ${delta.stats.scanTime}ms`);
    lines.push(`  Total files scanned: ${delta.stats.totalFiles}`);
    lines.push(`  Changed files: ${delta.stats.changedFiles}`);
    lines.push(`  Deleted files: ${delta.stats.deletedFiles}`);

    if (delta.changed.length > 0 && delta.changed.length <= 10) {
      lines.push(`\nChanged files:`);
      delta.changed.forEach((file) => {
        lines.push(`  + ${file}`);
      });
    } else if (delta.changed.length > 10) {
      lines.push(
        `\nChanged files (showing first 10 of ${delta.changed.length}):`,
      );
      delta.changed.slice(0, 10).forEach((file) => {
        lines.push(`  + ${file}`);
      });
      lines.push(`  ... and ${delta.changed.length - 10} more`);
    }

    if (delta.deleted.length > 0 && delta.deleted.length <= 10) {
      lines.push(`\nDeleted files:`);
      delta.deleted.forEach((file) => {
        lines.push(`  - ${file}`);
      });
    } else if (delta.deleted.length > 10) {
      lines.push(
        `\nDeleted files (showing first 10 of ${delta.deleted.length}):`,
      );
      delta.deleted.slice(0, 10).forEach((file) => {
        lines.push(`  - ${file}`);
      });
      lines.push(`  ... and ${delta.deleted.length - 10} more`);
    }

    return lines.join("\n");
  }
}

// Export singleton instance
export const deltaDetector = new DeltaDetector();
