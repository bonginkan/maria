/**
 * Lazy Command Loader - Phase 4.1 Performance Optimization
 *
 * Implements dynamic command loading to reduce startup time by avoiding
 * upfront imports of all command modules. Commands are loaded on-demand
 * when first executed.
 */

import { performance } from "node:perf_hooks";
import chalk from "chalk";

export interface CommandModule {
  handler: (...args: any[]) => Promise<any>;
  [key: string]: any;
}

export interface LoadMetrics {
  commandName: string;
  loadTimeMs: number;
  fromCache: boolean;
  timestamp: string;
}

export class LazyCommandLoader {
  private cache = new Map<string, Promise<CommandModule>>();
  private metrics: LoadMetrics[] = [];
  private loadingPromises = new Map<string, Promise<CommandModule>>();

  /**
   * Load a command _module dynamically with caching
   */
  async load(commandName: string): Promise<CommandModule> {
    const _normalizedName = commandName.toLowerCase().replace(/^\//, "");
    const _startTime = performance.now();

    try {
      let modulePromise = this.cache.get(_normalizedName);
      let fromCache = true;

      if (!modulePromise) {
        fromCache = false;

        // Prevent duplicate loading of same command
        if (this.loadingPromises.has(_normalizedName)) {
          modulePromise = this.loadingPromises.get(_normalizedName)!;
        } else {
          modulePromise = this.createModuleLoader(_normalizedName);
          this.loadingPromises.set(_normalizedName, modulePromise);
          this.cache.set(_normalizedName, modulePromise);

          // Clean up loading promise after resolution
          modulePromise.finally(() => {
            this.loadingPromises.delete(_normalizedName);
          });
        }
      }

      const _module = await modulePromise;
      const _loadTime = performance.now() - _startTime;

      this.recordMetric({
        commandName: _normalizedName,
        loadTimeMs: Math.round(_loadTime * 100) / 100,
        fromCache,
        timestamp: new Date().toISOString(),
      });

      if (!fromCache) {
        console.debug(
          chalk.gray(
            `🚀 Loaded command '${_normalizedName}' in ${_loadTime.toFixed(1)}ms`,
          ),
        );
      }

      return _module;
    } catch (error) {
      // Remove failed promise from cache to allow retry
      this.cache.delete(_normalizedName);
      this.loadingPromises.delete(_normalizedName);

      const _loadTime = performance.now() - _startTime;
      console.error(
        chalk.red(
          `❌ Failed to load command '${_normalizedName}' after ${_loadTime.toFixed(1)}ms:`,
        ),
        error,
      );
      throw error;
    }
  }

  /**
   * Create dynamic import _loader for specific command
   */
  private async createModuleLoader(
    commandName: string,
  ): Promise<CommandModule> {
    // Map command names to their _module paths
    const _commandModuleMap: Record<string, () => Promise<any>> = {
      // Unified commands (Phase 3)
      init: () => import("../../commands/unified/init"),
      help: () => import("../../commands/unified/help"),
      status: () => import("../../commands/unified/status"),

      // Legacy commands (gradual migration)
      config: () => import("../../commands/config"),
      avatar: () => import("../../commands/avatar"),
      "model-interactive": () => import("../../commands/model-interactive"),
      "approval-git": () => import("../../commands/approval-git"),
      "code-memory": () => import("../../commands/code-memory"),

      // Add more command mappings as needed
    };

    const _loader = _commandModuleMap[commandName];
    if (!_loader) {
      throw new Error(`No _module mapping found for command: ${commandName}`);
    }

    try {
      return await _loader();
    } catch (innerError) {
      throw new Error(
        `Failed to import _module for command '${commandName}': ${error}`,
      );
    }
  }

  /**
   * Check if a command can be loaded (has mapping)
   */
  canLoad(commandName: string): boolean {
    const _normalizedName = commandName.toLowerCase().replace(/^\//, "");
    const _commandModuleMap = [
      "init",
      "help",
      "status",
      "config",
      "avatar",
      "model-interactive",
      "approval-git",
      "code-memory",
    ];
    return _commandModuleMap.includes(_normalizedName);
  }

  /**
   * Preload specific commands (for warm-up scenarios)
   */
  async preload(commandNames: string[]): Promise<void> {
    const _preloadPromises = commandNames.map((name) =>
      this.load(name).catch((error) => {
        console.warn(
          chalk.yellow(`⚠️ Preload failed for '${name}':`, error.message),
        );
      }),
    );

    await Promise.allSettled(_preloadPromises);
  }

  /**
   * Get loading metrics for performance analysis
   */
  getMetrics(): LoadMetrics[] {
    return [...this.metrics];
  }

  /**
   * Get performance _summary
   */
  getPerformanceSummary(): {
    totalCommands: number;
    cacheHitRate: number;
    averageLoadTimeMs: number;
    totalLoadTimeMs: number;
  } {
    if (this.metrics.length === 0) {
      return {
        totalCommands: 0,
        cacheHitRate: 0,
        averageLoadTimeMs: 0,
        totalLoadTimeMs: 0,
      };
    }

    const _cacheHits = this.metrics.filter((m) => m.fromCache).length;
    const _totalLoadTime = this.metrics.reduce(
      (sum, m) => sum + m.loadTimeMs,
      0,
    );

    return {
      totalCommands: this.metrics.length,
      cacheHitRate: Math.round((_cacheHits / this.metrics.length) * 100) / 100,
      averageLoadTimeMs:
        Math.round((_totalLoadTime / this.metrics.length) * 100) / 100,
      totalLoadTimeMs: Math.round(_totalLoadTime * 100) / 100,
    };
  }

  /**
   * Clear cache and metrics (for testing)
   */
  clear(): void {
    this.cache.clear();
    this.loadingPromises.clear();
    this.metrics = [];
  }

  /**
   * Record loading metric
   */
  private recordMetric(metric: LoadMetrics): void {
    this.metrics.push(metric);

    // Keep only last 100 metrics to prevent memory leak
    if (this.metrics.length > 100) {
      this.metrics = this.metrics.slice(-100);
    }
  }

  /**
   * Export metrics to file for analysis
   */
  async exportMetrics(_filePath: string): Promise<void> {
    const fs = await import("node:fs/promises");
    const _summary = this.getPerformanceSummary();
    const _data = {
      _summary,
      metrics: this.metrics,
      exportTime: new Date().toISOString(),
    };

    await fs.writeFile(_filePath, JSON.stringify(_data, null, 2));
  }
}

// Singleton instance for global use
let lazyLoaderInstance: LazyCommandLoader | null = null;

export function getLazyCommandLoader(): LazyCommandLoader {
  if (!lazyLoaderInstance) {
    lazyLoaderInstance = new LazyCommandLoader();
  }
  return lazyLoaderInstance;
}
