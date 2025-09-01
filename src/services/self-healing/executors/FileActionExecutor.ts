/**
 * File Action Executor
 * Handles file system operations for self-healing
 */

import { FixAction } from "../types";
import { logger } from "../../../utils/logger";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

export class FileActionExecutor {
  private readonly ALLOWED_PATHS = [
    process.cwd(),
    path.join(os.homedir(), ".maria"),
  ];

  /**
   * Execute file action
   */
  async execute(action: FixAction, options: { dryRun: boolean }): Promise<any> {
    const { type, args } = action;
    const [, operation] = type.split(":");

    switch (operation) {
      case "ensure":
        return this.ensureFile(args.path, options);

      case "appendUnique":
        return this.appendUnique(args.path, args.lines || [args.line], options);

      case "backup":
        return this.backupFile(
          args.path,
          args.backupPath,
          args.optional,
          options,
        );

      case "restore":
        return this.restoreFile(
          args.path,
          args.backupPath,
          args.optional,
          options,
        );

      case "chmod":
        return this.changePermissions(
          args.path,
          args.mode,
          args.optional,
          options,
        );

      case "check":
        return this.checkFile(args.path, options);

      case "exists":
        return this.fileExists(args.path, options);

      case "checkPermissions":
        return this.checkPermissions(
          args.path,
          args.expectedMode,
          args.optional,
          options,
        );

      default:
        throw new Error(`Unknown file operation: ${operation}`);
    }
  }

  /**
   * Ensure file exists (create if it doesn't)
   */
  private async ensureFile(
    filePath: string,
    options: { dryRun: boolean },
  ): Promise<any> {
    const resolvedPath = this.resolvePath(filePath);
    this.validatePath(resolvedPath);

    if (options.dryRun) {
      return { action: "would_create", path: resolvedPath };
    }

    try {
      await fs.access(resolvedPath);
      return { action: "already_exists", path: resolvedPath };
    } catch {
      // File doesn't exist, create it
      await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
      await fs.writeFile(resolvedPath, "", "utf-8");
      logger.info(`Created file: ${resolvedPath}`);
      return { action: "created", path: resolvedPath };
    }
  }

  /**
   * Append unique lines to file
   */
  private async appendUnique(
    filePath: string,
    lines: string[],
    options: { dryRun: boolean },
  ): Promise<any> {
    const resolvedPath = this.resolvePath(filePath);
    this.validatePath(resolvedPath);

    let existingContent = "";
    try {
      existingContent = await fs.readFile(resolvedPath, "utf-8");
    } catch {
      // File doesn't exist, will be created
    }

    const existingLines = existingContent.split("\n");
    const linesToAdd = lines.filter((line) => !existingLines.includes(line));

    if (options.dryRun) {
      return {
        action: "would_append",
        path: resolvedPath,
        linesToAdd: linesToAdd.length,
        lines: linesToAdd,
      };
    }

    if (linesToAdd.length > 0) {
      const newContent =
        existingContent +
        (existingContent ? "\n" : "") +
        linesToAdd.join("\n") +
        "\n";
      await fs.writeFile(resolvedPath, newContent, "utf-8");
      logger.info(`Appended ${linesToAdd.length} lines to ${resolvedPath}`);
    }

    return {
      action: "appended",
      path: resolvedPath,
      linesAdded: linesToAdd.length,
    };
  }

  /**
   * Create backup of file
   */
  private async backupFile(
    filePath: string,
    backupPath?: string,
    optional = false,
    options: { dryRun: boolean } = { dryRun: false },
  ): Promise<any> {
    const resolvedPath = this.resolvePath(filePath);
    this.validatePath(resolvedPath);

    const backupFilePath = backupPath || `${resolvedPath}.bak`;
    this.validatePath(backupFilePath);

    try {
      await fs.access(resolvedPath);
    } catch {
      if (optional) {
        return {
          action: "skipped",
          reason: "file_not_found",
          path: resolvedPath,
        };
      }
      throw new Error(`File not found: ${resolvedPath}`);
    }

    if (options.dryRun) {
      return {
        action: "would_backup",
        source: resolvedPath,
        destination: backupFilePath,
      };
    }

    await fs.copyFile(resolvedPath, backupFilePath);
    logger.info(`Backed up ${resolvedPath} to ${backupFilePath}`);

    return {
      action: "backed_up",
      source: resolvedPath,
      destination: backupFilePath,
    };
  }

  /**
   * Restore file from backup
   */
  private async restoreFile(
    filePath: string,
    backupPath: string,
    optional = false,
    options: { dryRun: boolean },
  ): Promise<any> {
    const resolvedPath = this.resolvePath(filePath);
    const backupFilePath = this.resolvePath(backupPath);

    this.validatePath(resolvedPath);
    this.validatePath(backupFilePath);

    try {
      await fs.access(backupFilePath);
    } catch {
      if (optional) {
        return {
          action: "skipped",
          reason: "backup_not_found",
          backupPath: backupFilePath,
        };
      }
      throw new Error(`Backup file not found: ${backupFilePath}`);
    }

    if (options.dryRun) {
      return {
        action: "would_restore",
        source: backupFilePath,
        destination: resolvedPath,
      };
    }

    await fs.copyFile(backupFilePath, resolvedPath);

    // Clean up backup file
    try {
      await fs.unlink(backupFilePath);
    } catch {
      // Ignore cleanup errors
    }

    logger.info(`Restored ${resolvedPath} from ${backupFilePath}`);

    return {
      action: "restored",
      source: backupFilePath,
      destination: resolvedPath,
    };
  }

  /**
   * Change file permissions
   */
  private async changePermissions(
    filePath: string,
    mode: string,
    optional = false,
    options: { dryRun: boolean },
  ): Promise<any> {
    const resolvedPath = this.resolvePath(filePath);
    this.validatePath(resolvedPath);

    try {
      await fs.access(resolvedPath);
    } catch {
      if (optional) {
        return {
          action: "skipped",
          reason: "file_not_found",
          path: resolvedPath,
        };
      }
      throw new Error(`File not found: ${resolvedPath}`);
    }

    const numericMode = parseInt(mode, 8);

    if (options.dryRun) {
      return {
        action: "would_chmod",
        path: resolvedPath,
        mode: mode,
      };
    }

    await fs.chmod(resolvedPath, numericMode);
    logger.info(`Changed permissions of ${resolvedPath} to ${mode}`);

    return {
      action: "chmod",
      path: resolvedPath,
      mode: mode,
    };
  }

  /**
   * Check if file exists and get basic info
   */
  private async checkFile(
    filePath: string,
    options: { dryRun: boolean },
  ): Promise<any> {
    const resolvedPath = this.resolvePath(filePath);
    this.validatePath(resolvedPath);

    try {
      const stats = await fs.stat(resolvedPath);
      return {
        action: "checked",
        path: resolvedPath,
        exists: true,
        size: stats.size,
        mode: (stats.mode & parseInt("777", 8)).toString(8),
        modified: stats.mtime.toISOString(),
      };
    } catch {
      return {
        action: "checked",
        path: resolvedPath,
        exists: false,
      };
    }
  }

  /**
   * Simple file existence check
   */
  private async fileExists(
    filePath: string,
    options: { dryRun: boolean },
  ): Promise<any> {
    const resolvedPath = this.resolvePath(filePath);
    this.validatePath(resolvedPath);

    try {
      await fs.access(resolvedPath);
      return { action: "exists", path: resolvedPath, result: true };
    } catch {
      return { action: "exists", path: resolvedPath, result: false };
    }
  }

  /**
   * Check file permissions
   */
  private async checkPermissions(
    filePath: string,
    expectedMode: string,
    optional = false,
    options: { dryRun: boolean },
  ): Promise<any> {
    const resolvedPath = this.resolvePath(filePath);
    this.validatePath(resolvedPath);

    try {
      const stats = await fs.stat(resolvedPath);
      const actualMode = (stats.mode & parseInt("777", 8)).toString(8);
      const matches = actualMode === expectedMode;

      return {
        action: "check_permissions",
        path: resolvedPath,
        expectedMode,
        actualMode,
        matches,
      };
    } catch {
      if (optional) {
        return {
          action: "check_permissions",
          path: resolvedPath,
          result: "skipped",
          reason: "file_not_found",
        };
      }
      throw new Error(`File not found: ${resolvedPath}`);
    }
  }

  /**
   * Resolve tilde and relative paths
   */
  private resolvePath(filePath: string): string {
    if (filePath.startsWith("~/")) {
      return path.join(os.homedir(), filePath.slice(2));
    }

    if (path.isAbsolute(filePath)) {
      return filePath;
    }

    return path.resolve(process.cwd(), filePath);
  }

  /**
   * Validate path is within allowed directories
   */
  private validatePath(filePath: string): void {
    const resolvedPath = path.resolve(filePath);

    for (const allowedPath of this.ALLOWED_PATHS) {
      const allowedResolved = path.resolve(allowedPath);
      if (resolvedPath.startsWith(allowedResolved)) {
        return;
      }
    }

    throw new Error(`Path not allowed: ${resolvedPath}`);
  }
}
