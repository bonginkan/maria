/**
 * ModePluginManager - Manager for cognitive mode plugins
 * Handles plugin loading, hot reloading, and lifecycle management
 */

import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import * as path from 'path';
import { BaseMode, ModeConfig } from './BaseMode.js';

export interface PluginMetadata {
  id: string;
  name: string;
  version: string;
  category: string;
  author?: string;
  description?: string;
  filePath: string;
  className: string;
  lastModified: number;
  checksum?: string;
}

export interface PluginLoadResult {
  success: boolean;
  plugin?: BaseMode;
  error?: Error;
  metadata?: PluginMetadata;
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
      watchDirectory: '',
      debounceMs: 1000,
      excludePatterns: ['*.test.ts', '*.spec.ts', 'node_modules/**'],
      ...hotReloadOptions,
    };
  }

  /**
   * Initialize the plugin manager
   */
  async initialize(pluginDirectories: string[]): Promise<void> {
    console.log('[ModePluginManager] Initializing plugin manager...');

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

    console.log(`[ModePluginManager] Initialized with ${this.plugins.size} plugins`);
    this.emit('manager:initialized', {
      totalPlugins: this.plugins.size,
      directories: pluginDirectories,
    });
  }

  /**
   * Load plugins from a directory
   */
  async loadPluginsFromDirectory(directory: string): Promise<PluginLoadResult[]> {
    const results: PluginLoadResult[] = [];

    try {
      const files = await this.findPluginFiles(directory);

      for (const filePath of files) {
        const result = await this.loadPlugin(filePath);
        results.push(result);

        if (result.success) {
          console.log(`[ModePluginManager] Loaded plugin: ${result.metadata!.id}`);
        } else {
          console.error(`[ModePluginManager] Failed to load plugin: ${filePath}`, result.error);
        }
      }
    } catch (error) {
      console.error(`[ModePluginManager] Error loading plugins from ${directory}:`, error);
    }

    return results;
  }

  /**
   * Load a single plugin from file
   */
  async loadPlugin(filePath: string): Promise<PluginLoadResult> {
    try {
      // Get file metadata
      const stats = await fs.stat(filePath);
      const lastModified = stats.mtimeMs;

      // Check if already loaded and not modified
      const existingMetadata = this.pluginMetadata.get(filePath);
      if (existingMetadata && existingMetadata.lastModified >= lastModified) {
        return {
          success: true,
          plugin: this.plugins.get(existingMetadata.id),
          metadata: existingMetadata,
        };
      }

      // Clear module cache for hot reloading
      delete require.cache[require.resolve(filePath)];

      // Import the module
      const module = await import(filePath);

      // Find the mode class
      const ModeClass = this.findModeClass(module);
      if (!ModeClass) {
        throw new Error(`No mode class found in ${filePath}`);
      }

      // Create instance
      const plugin = new ModeClass();

      if (!(plugin instanceof BaseMode)) {
        throw new Error(`Class in ${filePath} does not extend BaseMode`);
      }

      // Create metadata
      const metadata: PluginMetadata = {
        id: plugin.config.id,
        name: plugin.config.name,
        version: '1.0.0', // TODO: Extract from plugin
        category: plugin.config.category,
        author: 'Unknown', // TODO: Extract from plugin
        description: plugin.config.description,
        filePath,
        className: ModeClass.name,
        lastModified,
      };

      // Register plugin
      this.plugins.set(plugin.config.id, plugin);
      this.pluginMetadata.set(filePath, metadata);

      // Set up event forwarding
      this.setupPluginEventForwarding(plugin);

      this.emit('plugin:loaded', { plugin, metadata });

      return {
        success: true,
        plugin,
        metadata,
      };
    } catch (error) {
      return {
        success: false,
        error: error as Error,
      };
    }
  }

  /**
   * Unload a plugin
   */
  async unloadPlugin(pluginId: string): Promise<boolean> {
    try {
      const plugin = this.plugins.get(pluginId);
      if (!plugin) {
        return false;
      }

      // Deactivate all sessions
      const status = plugin.getStatus();
      if (status.activeSessions > 0) {
        console.warn(`[ModePluginManager] Unloading plugin ${pluginId} with active sessions`);
      }

      // Remove event listeners
      plugin.removeAllListeners();

      // Remove from registry
      this.plugins.delete(pluginId);

      // Find and remove metadata
      for (const [filePath, metadata] of this.pluginMetadata) {
        if (metadata.id === pluginId) {
          this.pluginMetadata.delete(filePath);
          break;
        }
      }

      this.emit('plugin:unloaded', { pluginId });
      console.log(`[ModePluginManager] Unloaded plugin: ${pluginId}`);

      return true;
    } catch (error) {
      console.error(`[ModePluginManager] Error unloading plugin ${pluginId}:`, error);
      return false;
    }
  }

  /**
   * Reload a plugin
   */
  async reloadPlugin(pluginId: string): Promise<PluginLoadResult> {
    // Find the file path
    let filePath: string | undefined;
    for (const [path, metadata] of this.pluginMetadata) {
      if (metadata.id === pluginId) {
        filePath = path;
        break;
      }
    }

    if (!filePath) {
      return {
        success: false,
        error: new Error(`Plugin ${pluginId} not found`),
      };
    }

    // Unload existing plugin
    await this.unloadPlugin(pluginId);

    // Load the plugin again
    const result = await this.loadPlugin(filePath);

    if (result.success) {
      this.emit('plugin:reloaded', { pluginId, plugin: result.plugin });
      console.log(`[ModePluginManager] Reloaded plugin: ${pluginId}`);
    }

    return result;
  }

  /**
   * Get a plugin by ID
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
   * Get plugins by category
   */
  getPluginsByCategory(category: string): BaseMode[] {
    return Array.from(this.plugins.values()).filter(
      (plugin) => plugin.config.category === category,
    );
  }

  /**
   * Get plugin metadata
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
      const chokidar = require('chokidar');

      const watcher = chokidar.watch(directory, {
        ignored: this.hotReloadOptions.excludePatterns,
        persistent: true,
        ignoreInitial: true,
      });

      // Debounced reload function
      const debounce = (fn: Function, delay: number) => {
        let timeoutId: NodeJS.Timeout;
        return (...args: unknown[]) => {
          clearTimeout(timeoutId);
          timeoutId = setTimeout(() => fn.apply(null, args), delay);
        };
      };

      const debouncedReload = debounce(async (filePath: string) => {
        console.log(`[ModePluginManager] File changed: ${filePath}`);

        // Find plugin by file path
        const metadata = this.pluginMetadata.get(filePath);
        if (metadata) {
          await this.reloadPlugin(metadata.id);
        } else {
          // New plugin
          await this.loadPlugin(filePath);
        }
      }, this.hotReloadOptions.debounceMs);

      watcher
        .on('change', debouncedReload)
        .on('add', debouncedReload)
        .on('unlink', async (filePath: string) => {
          const metadata = this.pluginMetadata.get(filePath);
          if (metadata) {
            await this.unloadPlugin(metadata.id);
          }
        });

      this.watchers.set(directory, watcher);
      console.log(`[ModePluginManager] Hot reloading enabled for: ${directory}`);
    } catch (error) {
      console.error(`[ModePluginManager] Failed to start hot reloading for ${directory}:`, error);
    }
  }

  /**
   * Stop hot reloading
   */
  async stopHotReloading(): Promise<void> {
    for (const [directory, watcher] of this.watchers) {
      try {
        await watcher.close();
        console.log(`[ModePluginManager] Stopped watching: ${directory}`);
      } catch (error) {
        console.error(`[ModePluginManager] Error stopping watcher for ${directory}:`, error);
      }
    }
    this.watchers.clear();
  }

  /**
   * Find plugin files in directory
   */
  private async findPluginFiles(directory: string): Promise<string[]> {
    const files: string[] = [];

    try {
      const entries = await fs.readdir(directory, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(directory, entry.name);

        if (entry.isDirectory()) {
          // Recursively search subdirectories
          const subFiles = await this.findPluginFiles(fullPath);
          files.push(...subFiles);
        } else if (entry.isFile() && this.isPluginFile(entry.name)) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      console.error(`[ModePluginManager] Error reading directory ${directory}:`, error);
    }

    return files;
  }

  /**
   * Check if file is a plugin file
   */
  private isPluginFile(filename: string): boolean {
    return (
      (filename.endsWith('.mode.ts') || filename.endsWith('.mode.js')) &&
      !filename.includes('.test.') &&
      !filename.includes('.spec.')
    );
  }

  /**
   * Find the mode class in a module
   */
  private findModeClass(module: unknown): unknown {
    // Look for default export first
    if (module.default && typeof module.default === 'function') {
      return module.default;
    }

    // Look for named exports that look like mode classes
    for (const [key, value] of Object.entries(module)) {
      if (typeof value === 'function' && (key.endsWith('Mode') || key.includes('Mode'))) {
        return value;
      }
    }

    return null;
  }

  /**
   * Set up event forwarding from plugin to manager
   */
  private setupPluginEventForwarding(plugin: BaseMode): void {
    const events = [
      'mode:activated',
      'mode:deactivated',
      'mode:processed',
      'mode:error',
      'mode:config_updated',
    ];

    for (const eventType of events) {
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

    for (const plugin of this.plugins.values()) {
      const category = plugin.config.category;
      pluginsByCategory[category] = (pluginsByCategory[category] || 0) + 1;

      if (plugin.config.enabled) {
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
   * Shutdown the plugin manager
   */
  async shutdown(): Promise<void> {
    console.log('[ModePluginManager] Shutting down...');

    // Stop hot reloading
    await this.stopHotReloading();

    // Unload all plugins
    const pluginIds = Array.from(this.plugins.keys());
    for (const pluginId of pluginIds) {
      await this.unloadPlugin(pluginId);
    }

    console.log('[ModePluginManager] Shutdown complete');
  }
}
