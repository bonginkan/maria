/**
 * Cache Action Executor
 * Handles cache operations for self-healing
 */

import { FixAction } from "../types";
import { logger } from "../../../utils/logger";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

export class CacheActionExecutor {
  private readonly CACHE_PATHS = [
    path.join(os.homedir(), ".maria", "cache"),
    path.join(process.cwd(), ".turbo"),
    path.join(process.cwd(), ".cache", "maria"),
    path.join(process.cwd(), "node_modules", ".cache"),
  ];

  /**
   * Execute cache action
   */
  async execute(action: FixAction, options: { dryRun: boolean }): Promise<any> {
    const { type, args } = action;
    const [, operation] = type.split(":");

    switch (operation) {
      case "purge":
        return this.purgePaths(args.paths || [args.path], options);

      case "warmup":
        return this.warmupCache(args.targets || [], options);

      case "check":
        return this.checkCache(args.paths || [args.path], options);

      case "healthy":
        return this.verifyCacheHealth(args.paths || [args.path], options);

      default:
        throw new Error(`Unknown cache operation: ${operation}`);
    }
  }

  /**
   * Purge cache directories
   */
  private async purgePaths(
    cachePaths: string[],
    options: { dryRun: boolean },
  ): Promise<any> {
    const results = [];

    for (const cachePath of cachePaths) {
      const resolvedPath = this.resolvePath(cachePath);

      try {
        const stats = await fs.stat(resolvedPath);

        if (options.dryRun) {
          results.push({
            action: "would_purge",
            path: resolvedPath,
            size: this.formatSize(await this.getDirectorySize(resolvedPath)),
            exists: true,
          });
          continue;
        }

        const sizeBefore = await this.getDirectorySize(resolvedPath);
        await fs.rm(resolvedPath, { recursive: true, force: true });

        // Recreate directory structure
        await fs.mkdir(resolvedPath, { recursive: true });

        logger.info(
          `Purged cache: ${resolvedPath} (${this.formatSize(sizeBefore)})`,
        );

        results.push({
          action: "purged",
          path: resolvedPath,
          sizePurged: this.formatSize(sizeBefore),
        });
      } catch (error) {
        if ((error as any).code === "ENOENT") {
          results.push({
            action: "skipped",
            path: resolvedPath,
            reason: "not_found",
          });
        } else {
          logger.warn(`Failed to purge cache ${resolvedPath}:`, error);
          results.push({
            action: "failed",
            path: resolvedPath,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }
    }

    return { action: "purge_batch", results };
  }

  /**
   * Warmup cache with essential data
   */
  private async warmupCache(
    targets: string[],
    options: { dryRun: boolean },
  ): Promise<any> {
    const results = [];

    for (const target of targets) {
      if (options.dryRun) {
        results.push({
          action: "would_warmup",
          target,
          description: this.getWarmupDescription(target),
        });
        continue;
      }

      try {
        const result = await this.warmupTarget(target);
        results.push({
          action: "warmed_up",
          target,
          ...result,
        });
      } catch (error) {
        logger.warn(`Failed to warmup ${target}:`, error);
        results.push({
          action: "warmup_failed",
          target,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return { action: "warmup_batch", results };
  }

  /**
   * Check cache health
   */
  private async checkCache(
    cachePaths: string[],
    options: { dryRun: boolean },
  ): Promise<any> {
    const results = [];

    for (const cachePath of cachePaths) {
      const resolvedPath = this.resolvePath(cachePath);

      try {
        const stats = await fs.stat(resolvedPath);
        const size = await this.getDirectorySize(resolvedPath);
        const fileCount = await this.countFiles(resolvedPath);

        // Check for corruption indicators
        const isHealthy = await this.assessCacheHealth(
          resolvedPath,
          size,
          fileCount,
        );

        results.push({
          action: "checked",
          path: resolvedPath,
          exists: true,
          size: this.formatSize(size),
          fileCount,
          healthy: isHealthy.healthy,
          issues: isHealthy.issues,
        });
      } catch (error) {
        if ((error as any).code === "ENOENT") {
          results.push({
            action: "checked",
            path: resolvedPath,
            exists: false,
          });
        } else {
          results.push({
            action: "check_failed",
            path: resolvedPath,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }
    }

    return { action: "check_batch", results };
  }

  /**
   * Verify cache is healthy after operations
   */
  private async verifyCacheHealth(
    cachePaths: string[],
    options: { dryRun: boolean },
  ): Promise<any> {
    const results = [];

    for (const cachePath of cachePaths) {
      const resolvedPath = this.resolvePath(cachePath);

      if (options.dryRun) {
        results.push({
          action: "would_verify",
          path: resolvedPath,
        });
        continue;
      }

      try {
        await fs.access(resolvedPath);
        const stats = await fs.stat(resolvedPath);

        results.push({
          action: "verified",
          path: resolvedPath,
          exists: true,
          isDirectory: stats.isDirectory(),
        });
      } catch {
        results.push({
          action: "verified",
          path: resolvedPath,
          exists: false,
        });
      }
    }

    return { action: "verify_batch", results };
  }

  /**
   * Warmup specific target
   */
  private async warmupTarget(target: string): Promise<any> {
    const cacheDir = path.join(os.homedir(), ".maria", "cache");

    switch (target) {
      case "models:list":
        // Create models cache structure
        const modelsDir = path.join(cacheDir, "models");
        await fs.mkdir(modelsDir, { recursive: true });

        // Create a basic models.json cache
        const modelsData = {
          timestamp: Date.now(),
          models: [
            { id: "gpt-4o", provider: "openai", available: true },
            { id: "claude-3-opus", provider: "anthropic", available: true },
            { id: "gemini-pro", provider: "google", available: true },
          ],
        };

        await fs.writeFile(
          path.join(modelsDir, "available.json"),
          JSON.stringify(modelsData, null, 2),
        );

        return { itemsCreated: 1, size: JSON.stringify(modelsData).length };

      case "aliases":
        // Create aliases cache
        const aliasesDir = path.join(cacheDir, "aliases");
        await fs.mkdir(aliasesDir, { recursive: true });

        const aliasesData = {
          timestamp: Date.now(),
          aliases: {
            gpt4: "gpt-4o",
            claude: "claude-3-opus",
            gemini: "gemini-pro",
          },
        };

        await fs.writeFile(
          path.join(aliasesDir, "model-aliases.json"),
          JSON.stringify(aliasesData, null, 2),
        );

        return { itemsCreated: 1, size: JSON.stringify(aliasesData).length };

      case "templates":
        // Create templates cache
        const templatesDir = path.join(cacheDir, "templates");
        await fs.mkdir(templatesDir, { recursive: true });

        const templatesData = {
          timestamp: Date.now(),
          templates: {
            "code-review": "Review this code for best practices...",
            "bug-fix": "Analyze this bug and suggest a fix...",
            "feature-spec": "Write a specification for this feature...",
          },
        };

        await fs.writeFile(
          path.join(templatesDir, "prompt-templates.json"),
          JSON.stringify(templatesData, null, 2),
        );

        return { itemsCreated: 1, size: JSON.stringify(templatesData).length };

      default:
        throw new Error(`Unknown warmup target: ${target}`);
    }
  }

  /**
   * Get warmup description
   */
  private getWarmupDescription(target: string): string {
    const descriptions: Record<string, string> = {
      "models:list": "Pre-populate available models cache",
      aliases: "Create model aliases cache",
      templates: "Initialize prompt templates cache",
    };

    return descriptions[target] || `Warmup ${target}`;
  }

  /**
   * Assess cache health
   */
  private async assessCacheHealth(
    cachePath: string,
    size: number,
    fileCount: number,
  ): Promise<{ healthy: boolean; issues: string[] }> {
    const issues: string[] = [];

    // Check for excessive size (over 500MB is suspicious)
    if (size > 500 * 1024 * 1024) {
      issues.push("Cache size exceeds healthy limits");
    }

    // Check for too many files (over 10k files)
    if (fileCount > 10000) {
      issues.push("Excessive number of cache files");
    }

    // Check for empty cache that should have content
    if (fileCount === 0 && size === 0) {
      issues.push("Cache is empty");
    }

    return {
      healthy: issues.length === 0,
      issues,
    };
  }

  /**
   * Get directory size recursively
   */
  private async getDirectorySize(dirPath: string): Promise<number> {
    let totalSize = 0;

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const entryPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          totalSize += await this.getDirectorySize(entryPath);
        } else {
          const stats = await fs.stat(entryPath);
          totalSize += stats.size;
        }
      }
    } catch {
      // Ignore errors, return 0
    }

    return totalSize;
  }

  /**
   * Count files in directory recursively
   */
  private async countFiles(dirPath: string): Promise<number> {
    let count = 0;

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const entryPath = path.join(dirPath, entry.name);
          count += await this.countFiles(entryPath);
        } else {
          count++;
        }
      }
    } catch {
      // Ignore errors, return 0
    }

    return count;
  }

  /**
   * Format size in human readable format
   */
  private formatSize(bytes: number): string {
    const units = ["B", "KB", "MB", "GB"];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * Resolve cache path
   */
  private resolvePath(cachePath: string): string {
    if (cachePath.startsWith("~/")) {
      return path.join(os.homedir(), cachePath.slice(2));
    }

    if (path.isAbsolute(cachePath)) {
      return cachePath;
    }

    return path.resolve(process.cwd(), cachePath);
  }
}
