/**
 * Mode Plugin Registry Service
 * Manages registration, discovery, and lifecycle of mode plugins
 */

import { BaseService, Service } from '../core';
import { BaseModePlugin, ModeCategory, ModeContext } from './BaseModePlugin';

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
  plugin: BaseModePlugin;
  confidence: number;
  reasoning: string;
}

@Service({
  id: 'mode-plugin-registry',
  name: 'ModePluginRegistry',
  version: '1.0.0',
  description: 'Registry for managing cognitive mode plugins',
})
export class ModePluginRegistry extends BaseService {
  id = 'mode-plugin-registry';
  version = '1.0.0';

  private plugins: Map<string, BaseModePlugin> = new Map();
  private pluginMetadata: Map<string, PluginMetadata> = new Map();
  private categoryIndex: Map<ModeCategory, Set<string>> = new Map();
  private loadOrder: string[] = [];

  // Plugin loading configuration
  private maxConcurrentLoads = 5;
  private pluginTimeout = 10000; // 10 seconds
  private retryAttempts = 3;

  async onInitialize(): Promise<void> {
    this.logger.info('Initializing Mode Plugin Registry...');

    // Initialize category index
    const categories: ModeCategory[] = [
      'reasoning',
      'creative',
      'analytical',
      'structural',
      'validation',
      'contemplative',
      'intensive',
      'learning',
      'collaborative',
    ];

    categories.forEach((category) => {
      this.categoryIndex.set(category, new Set());
    });
  }

  async onStart(): Promise<void> {
    this.logger.info('Starting Mode Plugin Registry...');

    // Auto-discover and load plugins
    await this.discoverAndLoadPlugins();

    this.emitServiceEvent('plugin-registry:started', {
      totalPlugins: this.plugins.size,
      categories: Array.from(this.categoryIndex.keys()),
      loadOrder: this.loadOrder,
    });
  }

  /**
   * Register a mode plugin
   */
  async registerPlugin(plugin: BaseModePlugin): Promise<void> {
    const pluginId = plugin.pluginId;

    if (this.plugins.has(pluginId)) {
      throw new Error(`Plugin ${pluginId} is already registered`);
    }

    try {
      // Initialize plugin
      await plugin.initialize();

      // Register in registry
      this.plugins.set(pluginId, plugin);

      // Create metadata
      const metadata: PluginMetadata = {
        id: pluginId,
        name: plugin.pluginName,
        version: plugin.version,
        category: plugin.category,
        description: plugin.getDisplayConfig().description,
        loadPriority: this.calculateLoadPriority(plugin),
        enabled: true,
      };

      this.pluginMetadata.set(pluginId, metadata);

      // Update category index
      const categoryPlugins = this.categoryIndex.get(plugin.category) || new Set();
      categoryPlugins.add(pluginId);
      this.categoryIndex.set(plugin.category, categoryPlugins);

      // Add to load order
      this.loadOrder.push(pluginId);

      // Start plugin
      await plugin.start();

      this.logger.info(`Registered mode plugin: ${pluginId} (${plugin.category})`);

      this.emitServiceEvent('plugin:registered', {
        pluginId,
        category: plugin.category,
        name: plugin.pluginName,
      });
    } catch (error) {
      this.logger.error(`Failed to register plugin ${pluginId}:`, error);
      throw error;
    }
  }

  /**
   * Unregister a mode plugin
   */
  async unregisterPlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} is not registered`);
    }

    try {
      // Stop and dispose plugin
      await plugin.stop();
      await plugin.dispose();

      // Remove from registry
      this.plugins.delete(pluginId);
      this.pluginMetadata.delete(pluginId);

      // Update category index
      const metadata = this.pluginMetadata.get(pluginId);
      if (metadata) {
        const categoryPlugins = this.categoryIndex.get(metadata.category);
        categoryPlugins?.delete(pluginId);
      }

      // Remove from load order
      const orderIndex = this.loadOrder.indexOf(pluginId);
      if (orderIndex >= 0) {
        this.loadOrder.splice(orderIndex, 1);
      }

      this.logger.info(`Unregistered mode plugin: ${pluginId}`);

      this.emitServiceEvent('plugin:unregistered', {
        pluginId,
      });
    } catch (error) {
      this.logger.error(`Failed to unregister plugin ${pluginId}:`, error);
      throw error;
    }
  }

  /**
   * Get best mode plugin for given context
   */
  async selectBestMode(context: ModeContext): Promise<ModeSelection | null> {
    const candidates: Array<{
      plugin: BaseModePlugin;
      confidence: number;
    }> = [];

    // Evaluate all enabled plugins
    for (const [pluginId, plugin] of this.plugins.entries()) {
      const metadata = this.pluginMetadata.get(pluginId);
      if (!metadata?.enabled) continue;

      try {
        const confidence = await plugin.canHandle(context);
        if (confidence > 0.1) {
          // Minimum threshold
          candidates.push({ plugin, confidence });
        }
      } catch (error) {
        this.logger.warn(`Error evaluating plugin ${pluginId}:`, error);
      }
    }

    if (candidates.length === 0) {
      return null;
    }

    // Sort by confidence (descending)
    candidates.sort((a, b) => b.confidence - a.confidence);

    const best = candidates[0];
    const reasoning = this.generateSelectionReasoning(best, candidates);

    return {
      plugin: best.plugin,
      confidence: best.confidence,
      reasoning,
    };
  }

  /**
   * Get plugins by category
   */
  getPluginsByCategory(category: ModeCategory): BaseModePlugin[] {
    const pluginIds = this.categoryIndex.get(category) || new Set();
    return Array.from(pluginIds)
      .map((id) => this.plugins.get(id))
      .filter((plugin) => plugin !== undefined) as BaseModePlugin[];
  }

  /**
   * Get plugin by ID
   */
  getPlugin(pluginId: string): BaseModePlugin | undefined {
    return this.plugins.get(pluginId);
  }

  /**
   * Get all registered plugins
   */
  getAllPlugins(): BaseModePlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get plugin metadata
   */
  getPluginMetadata(pluginId: string): PluginMetadata | undefined {
    return this.pluginMetadata.get(pluginId);
  }

  /**
   * Enable/disable plugin
   */
  async setPluginEnabled(pluginId: string, enabled: boolean): Promise<void> {
    const metadata = this.pluginMetadata.get(pluginId);
    if (!metadata) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    metadata.enabled = enabled;

    this.emitServiceEvent('plugin:status_changed', {
      pluginId,
      enabled,
    });

    this.logger.info(`Plugin ${pluginId} ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Get registry statistics
   */
  getRegistryStats() {
    const stats = {
      totalPlugins: this.plugins.size,
      enabledPlugins: Array.from(this.pluginMetadata.values()).filter((m) => m.enabled).length,
      categoryCounts: {} as Record<ModeCategory, number>,
      pluginStats: {} as Record<string, any>,
    };

    // Calculate category counts
    for (const [category, pluginIds] of this.categoryIndex.entries()) {
      stats.categoryCounts[category] = pluginIds.size;
    }

    // Get individual plugin stats
    for (const [pluginId, plugin] of this.plugins.entries()) {
      stats.pluginStats[pluginId] = plugin.getStats();
    }

    return stats;
  }

  /**
   * Health check for all plugins
   */
  async healthCheckAll() {
    const health = {
      registry: 'healthy' as 'healthy' | 'degraded' | 'unhealthy',
      pluginHealth: {} as Record<string, any>,
      issues: [] as string[],
    };

    for (const [pluginId, plugin] of this.plugins.entries()) {
      try {
        const pluginHealth = await plugin.health();
        health.pluginHealth[pluginId] = pluginHealth;

        if (pluginHealth.status !== 'healthy') {
          health.issues.push(`Plugin ${pluginId} is ${pluginHealth.status}`);
          health.registry = 'degraded';
        }
      } catch (error) {
        health.pluginHealth[pluginId] = { status: 'unhealthy', error: error.message };
        health.issues.push(`Plugin ${pluginId} health check failed: ${error.message}`);
        health.registry = 'degraded';
      }
    }

    return health;
  }

  /**
   * Auto-discover and load plugins
   */
  private async discoverAndLoadPlugins(): Promise<void> {
    // In a real implementation, this would scan directories for plugin files
    // For now, we'll register built-in plugins programmatically
    this.logger.info('Plugin discovery will be implemented with built-in plugins');
  }

  /**
   * Calculate plugin load priority
   */
  private calculateLoadPriority(plugin: BaseModePlugin): number {
    // Base priority by category
    const categoryPriorities: Record<ModeCategory, number> = {
      reasoning: 100,
      analytical: 90,
      creative: 80,
      structural: 70,
      validation: 60,
      contemplative: 50,
      intensive: 40,
      learning: 30,
      collaborative: 20,
    };

    return categoryPriorities[plugin.category] || 0;
  }

  /**
   * Generate selection reasoning
   */
  private generateSelectionReasoning(
    selected: { plugin: BaseModePlugin; confidence: number },
    candidates: Array<{ plugin: BaseModePlugin; confidence: number }>,
  ): string {
    const { plugin, confidence } = selected;

    let reasoning = `Selected "${plugin.pluginName}" (${plugin.category}) with ${(confidence * 100).toFixed(1)}% confidence`;

    if (candidates.length > 1) {
      const alternatives = candidates
        .slice(1, 3)
        .map((c) => `"${c.plugin.pluginName}" (${(c.confidence * 100).toFixed(1)}%)`);
      reasoning += `. Alternatives considered: ${alternatives.join(', ')}`;
    }

    return reasoning;
  }
}
