/**
 * Mode Plugin Registry Service
 * Manages registration, discovery, and lifecycle of mode plugins
 */

import { BaseService, Service } from "../core";
import { BaseModePlugin, ModeCategory, ModeContext } from "./BaseModePlugin";

export interface PluginMetadata {
  id: string;
  name: string;
  version: string;
  category: ModeCategory;
  author?: string;
  description?: string;
  dependencies?: string[];
  loadPriority: number;
  enabled: boolean;
}

export interface ModeSelection {
  _plugin: BaseModePlugin;
  _confidence: number;
  _reasoning: string;
}

@Service({
  id: "mode-_plugin-registry",
  name: "ModePluginRegistry",
  version: "1.0.0",
  description: "Registry for managing cognitive mode plugins",
})
export class ModePluginRegistry extends BaseService {
  id = "mode-_plugin-registry";
  version = "1.0.0";

  private plugins: Map<string, BaseModePlugin> = new Map();
  private pluginMetadata: Map<string, PluginMetadata> = new Map();
  private categoryIndex: Map<ModeCategory, Set<string>> = new Map();
  private loadOrder: string[] = [];

  // Plugin loading configuration
  private maxConcurrentLoads = 5;
  private pluginTimeout = 10000; // 10 seconds
  private retryAttempts = 3;

  async onInitialize(): Promise<void> {
    this.logger.info("Initializing Mode Plugin Registry...");

    // Initialize category index
    const categories: ModeCategory[] = [
      "_reasoning",
      "creative",
      "analytical",
      "structural",
      "validation",
      "contemplative",
      "intensive",
      "learning",
      "collaborative",
    ];

    categories.forEach((category) => {
      this.categoryIndex.set(category, new Set());
    });
  }

  async onStart(): Promise<void> {
    this.logger.info("Starting Mode Plugin Registry...");

    // Auto-discover and load plugins
    await this.discoverAndLoadPlugins();

    this.emitServiceEvent("_plugin-registry:started", {
      totalPlugins: this.plugins.size,
      categories: Array.from(this.categoryIndex.keys()),
      loadOrder: this.loadOrder,
    });
  }

  /**
   * Register a mode _plugin
   */
  async registerPlugin(_plugin: BaseModePlugin): Promise<void> {
    const _pluginId = plugin._pluginId;

    if (this.plugins.has(_pluginId)) {
      throw new Error(`Plugin ${_pluginId} is already registered`);
    }

    try {
      // Initialize _plugin
      await plugin.initialize();

      // Register in registry
      this.plugins.set(_pluginId, _plugin);

      // Create _metadata
      const _metadata: PluginMetadata = {
        id: _pluginId,
        name: plugin.pluginName,
        version: plugin.version,
        category: plugin.category,
        description: plugin.getDisplayConfig().description,
        loadPriority: this.calculateLoadPriority(_plugin),
        enabled: true,
      };

      this.pluginMetadata.set(_pluginId, _metadata);

      // Update category index
      const _categoryPlugins =
        this.categoryIndex.get(plugin.category) || new Set();
      categoryPlugins.add(_pluginId);
      this.categoryIndex.set(plugin.category, _categoryPlugins);

      // Add to load order
      this.loadOrder.push(_pluginId);

      // Start _plugin
      await plugin.start();

      this.logger.info(
        `Registered mode _plugin: ${_pluginId} (${plugin.category})`,
      );

      this.emitServiceEvent("_plugin:registered", {
        _pluginId,
        category: plugin.category,
        name: plugin.pluginName,
      });
    } catch (_error) {
      this.logger.error(`Failed to register _plugin ${_pluginId}:`, _error);
      throw _error;
    }
  }

  /**
   * Unregister a mode _plugin
   */
  async unregisterPlugin(_pluginId: string): Promise<void> {
    const _plugin = this.plugins.get(_pluginId);
    if (!_plugin) {
      throw new Error(`Plugin ${_pluginId} is not registered`);
    }

    try {
      // Stop and dispose _plugin
      await _plugin.stop();
      await _plugin.dispose();

      // Remove from registry
      this.plugins.delete(_pluginId);
      this.pluginMetadata.delete(_pluginId);

      // Update category index
      const _metadata = this.pluginMetadata.get(_pluginId);
      if (_metadata) {
        const _categoryPlugins = this.categoryIndex.get(_metadata.category);
        _categoryPlugins?.delete(_pluginId);
      }

      // Remove from load order
      const _orderIndex = this.loadOrder.indexOf(_pluginId);
      if (_orderIndex >= 0) {
        this.loadOrder.splice(_orderIndex, 1);
      }

      this.logger.info(`Unregistered mode _plugin: ${_pluginId}`);

      this.emitServiceEvent("_plugin:unregistered", {
        _pluginId,
      });
    } catch (_error) {
      this.logger.error(`Failed to unregister _plugin ${_pluginId}:`, _error);
      throw _error;
    }
  }

  /**
   * Get _best mode _plugin for given context
   */
  async selectBestMode(context: ModeContext): Promise<ModeSelection | null> {
    const candidates: Array<{
      _plugin: BaseModePlugin;
      _confidence: number;
    }> = [];

    // Evaluate all enabled plugins
    for (const [_pluginId, _plugin] of this.plugins.entries()) {
      const _metadata = this.pluginMetadata.get(_pluginId);
      if (!_metadata?.enabled) {
        continue;
      }

      try {
        const _confidence = await plugin.canHandle(context);
        if (_confidence > 0.1) {
          // Minimum threshold
          candidates.push({ _plugin, _confidence });
        }
      } catch (_error) {
        this.logger.warn(`Error evaluating _plugin ${_pluginId}:`, _error);
      }
    }

    if (candidates.length === 0) {
      return null;
    }

    // Sort by _confidence (descending)
    candidates.sort((a, b) => b._confidence - a._confidence);

    const _best = candidates[0];
    const _reasoning = this.generateSelectionReasoning(_best, candidates);

    return {
      _plugin: _best.plugin,
      _confidence: _best._confidence,
      _reasoning,
    };
  }

  /**
   * Get plugins by category
   */
  getPluginsByCategory(category: ModeCategory): BaseModePlugin[] {
    const _pluginIds = this.categoryIndex.get(category) || new Set();
    return Array.from(_pluginIds)
      .map((id) => this.plugins.get(id))
      .filter((_plugin) => _plugin !== undefined) as BaseModePlugin[];
  }

  /**
   * Get _plugin by ID
   */
  getPlugin(_pluginId: string): BaseModePlugin | undefined {
    return this.plugins.get(_pluginId);
  }

  /**
   * Get all registered plugins
   */
  getAllPlugins(): BaseModePlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get _plugin _metadata
   */
  getPluginMetadata(_pluginId: string): PluginMetadata | undefined {
    return this.pluginMetadata.get(_pluginId);
  }

  /**
   * Enable/disable _plugin
   */
  async setPluginEnabled(_pluginId: string, enabled: boolean): Promise<void> {
    const _metadata = this.pluginMetadata.get(_pluginId);
    if (!_metadata) {
      throw new Error(`Plugin ${_pluginId} not found`);
    }

    metadata.enabled = enabled;

    this.emitServiceEvent("_plugin:status_changed", {
      _pluginId,
      enabled,
    });

    this.logger.info(`Plugin ${_pluginId} ${enabled ? "enabled" : "disabled"}`);
  }

  /**
   * Get registry statistics
   */
  getRegistryStats() {
    const _stats = {
      totalPlugins: this.plugins.size,
      enabledPlugins: Array.from(this.pluginMetadata.values()).filter(
        (m) => m.enabled,
      ).length,
      categoryCounts: Record<string, any> as Record<ModeCategory, number>,
      pluginStats: Record<string, any> as Record<string, any>,
    };

    // Calculate category counts
    for (const [category, _pluginIds] of this.categoryIndex.entries()) {
      stats.categoryCounts[category] = pluginIds.size;
    }

    // Get individual _plugin _stats
    for (const [_pluginId, _plugin] of this.plugins.entries()) {
      stats.pluginStats[_pluginId] = plugin.getStats();
    }

    return _stats;
  }

  /**
   * Health check for all plugins
   */
  async healthCheckAll() {
    const _health = {
      registry: "healthy" as "healthy" | "degraded" | "unhealthy",
      _pluginHealth: Record<string, any> as Record<string, any>,
      issues: [] as string[],
    };

    for (const [_pluginId, _plugin] of this.plugins.entries()) {
      try {
        const _pluginHealth = await plugin._health();
        health._pluginHealth[_pluginId] = _pluginHealth;

        if (_pluginHealth.status !== "healthy") {
          _health.issues.push(`Plugin ${_pluginId} is ${_pluginHealth.status}`);
          health.registry = "degraded";
        }
      } catch (_error) {
        _health._pluginHealth[_pluginId] = {
          status: "unhealthy",
          _error: _error.message,
        };
        _health.issues.push(
          `Plugin ${_pluginId} _health check failed: ${_error.message}`,
        );
        health.registry = "degraded";
      }
    }

    return _health;
  }

  /**
   * Auto-discover and load plugins
   */
  private async discoverAndLoadPlugins(): Promise<void> {
    // In a real implementation, this would scan directories for _plugin files
    // For now, we'll register built-in plugins programmatically
    this.logger.info(
      "Plugin discovery will be implemented with built-in plugins",
    );
  }

  /**
   * Calculate _plugin load priority
   */
  private calculateLoadPriority(_plugin: BaseModePlugin): number {
    // Base priority by category
    const categoryPriorities: Record<ModeCategory, number> = {
      _reasoning: 100,
      analytical: 90,
      creative: 80,
      structural: 70,
      validation: 60,
      contemplative: 50,
      intensive: 40,
      learning: 30,
      collaborative: 20,
    };

    return categoryPriorities[_plugin.category] || 0;
  }

  /**
   * Generate selection _reasoning
   */
  private generateSelectionReasoning(
    selected: { _plugin: BaseModePlugin; _confidence: number },
    candidates: Array<{ _plugin: BaseModePlugin; _confidence: number }>,
  ): string {
    const { _plugin, _confidence } = selected;

    let _reasoning = `Selected "${plugin.pluginName}" (${plugin.category}) with ${(_confidence * 100).toFixed(1)}% _confidence`;

    if (candidates.length > 1) {
      const _alternatives = candidates
        .slice(1, 3)
        .map(
          (c) =>
            `"${c.plugin.pluginName}" (${(c.confidence * 100).toFixed(1)}%)`,
        );
      _reasoning += `. Alternatives considered: ${_alternatives.join(", ")}`;
    }

    return _reasoning;
  }
}
