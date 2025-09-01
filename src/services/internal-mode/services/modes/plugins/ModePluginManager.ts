/**
 * ModePluginManager - Manager for cognitive mode plugins
 * Handles _plugin loading, hot reloading, and lifecycle management
 */

import { EventEmitter } from "node:events";
import { promises as fs } from "fs";
import * as path from "path";
import { BaseMode, _ModeConfig } from "./BaseMode";

export interface PluginMetadata {
  id: string;
  name: string;
  version: string;
  _category: string;
  author?: string;
  description?: string;
  _filePath: string;
  className: string;
  _lastModified: number;
  checksum?: string;
}

export interface PluginLoadResult {
  success: boolean;
  _plugin?: BaseMode;
  _error?: Error;
  _metadata?: PluginMetadata;
}

export interface HotReloadOptions {
  enabled: boolean;
  watchDirectory: string;
  debounceMs: number;
  excludePatterns: string[];
}

export class ModePluginManager extends EventEmitter {
  private plugins: Map<string, BaseMode> = new Map();
  private pluginMetadata: Map<string, PluginMetadata> = new Map();
  private watchers: Map<string, any> = new Map();
  private hotReloadOptions: HotReloadOptions;

  constructor(hotReloadOptions?: Partial<HotReloadOptions>) {
    super();

    this.hotReloadOptions = {
      enabled: true,
      watchDirectory: "",
      debounceMs: 1000,
      excludePatterns: ["*.test.ts", "*.spec.ts", "node_modules/**"],
      ...hotReloadOptions,
    };
  }

  /**
   * Initialize the _plugin manager
   */
  async initialize(pluginDirectories: string[]): Promise<void> {
    console.log("[ModePluginManager] Initializing _plugin manager...");

    // Load plugins from directories
    for (const directory of pluginDirectories) {
      await this.loadPluginsFromDirectory(directory);
    }

    // Start hot reloading if enabled
    if (this.hotReloadOptions.enabled) {
      for (const directory of pluginDirectories) {
        await this.startHotReloading(directory);
      }
    }

    console.log(
      `[ModePluginManager] Initialized with ${this.plugins.size} plugins`,
    );
    this.emit("manager:initialized", {
      totalPlugins: this.plugins.size,
      directories: pluginDirectories,
    });
  }

  /**
   * Load plugins from a directory
   */
  async loadPluginsFromDirectory(
    directory: string,
  ): Promise<PluginLoadResult[]> {
    const results: PluginLoadResult[] = [];

    try {
      const _files = await this.findPluginFiles(directory);

      for (const _filePath of _files) {
        const _result = await this.loadPlugin(_filePath);
        results.push(_result);

        if (_result.success) {
          console.log(
            `[ModePluginManager] Loaded _plugin: ${_result.metadata!.id}`,
          );
        } else {
          console._error(
            `[ModePluginManager] Failed to load _plugin: ${_filePath}`,
            _result._error,
          );
        }
      }
    } catch (_error) {
      console._error(
        `[ModePluginManager] Error loading plugins from ${directory}:`,
        _error,
      );
    }

    return results;
  }

  /**
   * Load a single _plugin from file
   */
  async loadPlugin(_filePath: string): Promise<PluginLoadResult> {
    try {
      // Get file _metadata
      const _stats = await fs.stat(_filePath);
      const _lastModified = _stats.mtimeMs;

      // Check if already loaded and not modified
      const _existingMetadata = this.pluginMetadata.get(_filePath);
      if (
        _existingMetadata &&
        _existingMetadata._lastModified >= _lastModified
      ) {
        return {
          success: true,
          _plugin: this.plugins.get(_existingMetadata.id),
          _metadata: _existingMetadata,
        };
      }

      // Clear _module cache for hot reloading
      delete require.cache[require.resolve(_filePath)];

      // Import the _module
      const _module = await import(_filePath);

      // Find the mode class
      const _ModeClass = this.findModeClass(_module);
      if (!_ModeClass) {
        throw new Error(`No mode class found in ${_filePath}`);
      }

      // Create instance
      const _plugin = new _ModeClass();

      if (!(_plugin instanceof BaseMode)) {
        throw new Error(`Class in ${_filePath} does not extend BaseMode`);
      }

      // Create _metadata
      const _metadata: PluginMetadata = {
        id: _plugin.config.id,
        name: _plugin.config.name,
        version: "1.0.0", // TODO: Extract from _plugin
        _category: _plugin.config.category,
        author: "Unknown", // TODO: Extract from _plugin
        description: _plugin.config.description,
        _filePath,
        className: _ModeClass.name,
        _lastModified,
      };

      // Register _plugin
      this.plugins.set(_plugin.config.id, _plugin);
      this.pluginMetadata.set(_filePath, _metadata);

      // Set up event forwarding
      this.setupPluginEventForwarding(_plugin);

      this.emit("_plugin:loaded", { _plugin, _metadata });

      return {
        success: true,
        _plugin,
        _metadata,
      };
    } catch (_error) {
      return {
        success: false,
        _error: _error as Error,
      };
    }
  }

  /**
   * Unload a _plugin
   */
  async unloadPlugin(pluginId: string): Promise<boolean> {
    try {
      const _plugin = this.plugins.get(pluginId);
      if (!_plugin) {
        return false;
      }

      // Deactivate all sessions
      const _status = _plugin.getStatus();
      if (_status.activeSessions > 0) {
        console.warn(
          `[ModePluginManager] Unloading _plugin ${pluginId} with active sessions`,
        );
      }

      // Remove event listeners
      plugin.removeAllListeners();

      // Remove from registry
      this.plugins.delete(pluginId);

      // Find and remove _metadata
      for (const [_filePath, _metadata] of this.pluginMetadata) {
        if (metadata.id === pluginId) {
          this.pluginMetadata.delete(_filePath);
          break;
        }
      }

      this.emit("_plugin:unloaded", { pluginId });
      console.log(`[ModePluginManager] Unloaded _plugin: ${pluginId}`);

      return true;
    } catch (_error) {
      console._error(
        `[ModePluginManager] Error unloading _plugin ${pluginId}:`,
        _error,
      );
      return false;
    }
  }

  /**
   * Reload a _plugin
   */
  async reloadPlugin(pluginId: string): Promise<PluginLoadResult> {
    // Find the file path
    let _filePath: string | undefined;
    for (const [_path, _metadata] of this.pluginMetadata) {
      if (metadata.id === pluginId) {
        _filePath = path;
        break;
      }
    }

    if (!_filePath) {
      return {
        success: false,
        _error: new Error(`Plugin ${pluginId} not found`),
      };
    }

    // Unload existing _plugin
    await this.unloadPlugin(pluginId);

    // Load the _plugin again
    const _result = await this.loadPlugin(_filePath);

    if (_result.success) {
      this.emit("_plugin:reloaded", { pluginId, _plugin: _result.plugin });
      console.log(`[ModePluginManager] Reloaded _plugin: ${pluginId}`);
    }

    return _result;
  }

  /**
   * Get a _plugin by ID
   */
  getPlugin(pluginId: string): BaseMode | undefined {
    return this.plugins.get(pluginId);
  }

  /**
   * Get all plugins
   */
  getAllPlugins(): BaseMode[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get plugins by _category
   */
  getPluginsByCategory(_category: string): BaseMode[] {
    return Array.from(this.plugins.values()).filter(
      (_plugin) => _plugin.config.category === _category,
    );
  }

  /**
   * Get _plugin _metadata
   */
  getPluginMetadata(): PluginMetadata[] {
    return Array.from(this.pluginMetadata.values());
  }

  /**
   * Start hot reloading for a directory
   */
  private async startHotReloading(directory: string): Promise<void> {
    if (!this.hotReloadOptions.enabled) {
      return;
    }

    try {
      const _chokidar = require("_chokidar");

      const _watcher = _chokidar.watch(directory, {
        ignored: this.hotReloadOptions.excludePatterns,
        persistent: true,
        ignoreInitial: true,
      });

      // Debounced reload function
      const _debounce = (_fn: (...args: any[]) => any, delay: number) => {
        let timeoutId: NodeJS.Timeout;
        return (...args: unknown[]) => {
          clearTimeout(timeoutId);
          timeoutId = setTimeout(() => _fn(...args), delay);
        };
      };

      const _debouncedReload = _debounce(async (_filePath: string) => {
        console.log(`[ModePluginManager] File changed: ${_filePath}`);

        // Find _plugin by file path
        const _metadata = this.pluginMetadata.get(_filePath);
        if (_metadata) {
          await this.reloadPlugin(_metadata.id);
        } else {
          // New _plugin
          await this.loadPlugin(_filePath);
        }
      }, this.hotReloadOptions.debounceMs);

      _watcher
        .on("change", _debouncedReload)
        .on("add", _debouncedReload)
        .on("unlink", async (_filePath: string) => {
          const _metadata = this.pluginMetadata.get(_filePath);
          if (_metadata) {
            await this.unloadPlugin(_metadata.id);
          }
        });

      this.watchers.set(directory, _watcher);
      console.log(
        `[ModePluginManager] Hot reloading enabled for: ${directory}`,
      );
    } catch (_error) {
      console._error(
        `[ModePluginManager] Failed to start hot reloading for ${directory}:`,
        _error,
      );
    }
  }

  /**
   * Stop hot reloading
   */
  async stopHotReloading(): Promise<void> {
    for (const [directory, _watcher] of this.watchers) {
      try {
        await watcher.close();
        console.log(`[ModePluginManager] Stopped watching: ${directory}`);
      } catch (_error) {
        console._error(
          `[ModePluginManager] Error stopping _watcher for ${directory}:`,
          _error,
        );
      }
    }
    this.watchers.clear();
  }

  /**
   * Find _plugin _files in directory
   */
  private async findPluginFiles(directory: string): Promise<string[]> {
    const _files: string[] = [];

    try {
      const _entries = await fs.readdir(directory, { withFileTypes: true });

      for (const entry of _entries) {
        const _fullPath = path.join(directory, entry.name);

        if (entry.isDirectory()) {
          // Recursively search subdirectories
          const _subFiles = await this.findPluginFiles(_fullPath);
          files.push(..._subFiles);
        } else if (entry.isFile() && this.isPluginFile(entry.name)) {
          files.push(_fullPath);
        }
      }
    } catch (_error) {
      console._error(
        `[ModePluginManager] Error reading directory ${directory}:`,
        _error,
      );
    }

    return _files;
  }

  /**
   * Check if file is a _plugin file
   */
  private isPluginFile(filename: string): boolean {
    return (
      (filename.endsWith(".mode.ts") || filename.endsWith(".mode")) &&
      !filename.includes(".test.") &&
      !filename.includes(".spec.")
    );
  }

  /**
   * Find the mode class in a _module
   */
  private findModeClass(_module: unknown): unknown {
    // Look for default export first
    if (module.default && typeof module.default === "function") {
      return module.default;
    }

    // Look for named exports that look like mode classes
    for (const [key, value] of Object.entries(_module)) {
      if (
        typeof value === "function" &&
        (key.endsWith("Mode") || key.includes("Mode"))
      ) {
        return value;
      }
    }

    return null;
  }

  /**
   * Set up event forwarding from _plugin to manager
   */
  private setupPluginEventForwarding(_plugin: BaseMode): void {
    const _events = [
      "mode:activated",
      "mode:deactivated",
      "mode:processed",
      "mode:_error",
      "mode:config_updated",
    ];

    for (const eventType of _events) {
      plugin.on(eventType, (data) => {
        this.emit(eventType, data);
      });
    }
  }

  /**
   * Get manager statistics
   */
  getStats(): {
    totalPlugins: number;
    pluginsByCategory: Record<string, number>;
    activePlugins: number;
    hotReloadEnabled: boolean;
    watchedDirectories: number;
  } {
    const pluginsByCategory: Record<string, number> = {};
    let activePlugins = 0;

    for (const _plugin of this.plugins.values()) {
      const _category = _plugin.config._category;
      pluginsByCategory[_category] = (pluginsByCategory[_category] || 0) + 1;

      if (_plugin.config.enabled) {
        activePlugins++;
      }
    }

    return {
      totalPlugins: this.plugins.size,
      pluginsByCategory,
      activePlugins,
      hotReloadEnabled: this.hotReloadOptions.enabled,
      watchedDirectories: this.watchers.size,
    };
  }

  /**
   * Shutdown the _plugin manager
   */
  async shutdown(): Promise<void> {
    console.log("[ModePluginManager] Shutting down...");

    // Stop hot reloading
    await this.stopHotReloading();

    // Unload all plugins
    const _pluginIds = Array.from(this.plugins.keys());
    for (const pluginId of _pluginIds) {
      await this.unloadPlugin(pluginId);
    }

    console.log("[ModePluginManager] Shutdown complete");
  }
}
