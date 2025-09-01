/**
 * Model Selector v2 - Model Registry
 * Provider-agnostic model management and filtering system
 */

import { EventEmitter } from "node:events";
import type {
  ModelInfo,
  ModelFilter,
  RegistryHealth,
  HealthStatus,
  Capability,
  AvailabilityStatus,
} from "../types/index";

export class ModelRegistry extends EventEmitter {
  private models: Map<string, ModelInfo> = new Map();
  private providerHealth: Map<string, HealthStatus> = new Map();
  private lastUpdate: Date = new Date();
  private cache: Map<
    string,
    { result: ModelInfo[]; timestamp: number; ttl: number }
  > = new Map();

  constructor(private config = { cacheTTL: 60000 }) {
    // 1 minute default cache
    super();
  }

  /**
   * Replace all models in registry (single source of truth)
   */
  replaceAll(models: ModelInfo[]): void {
    this.models.clear();
    this.providerHealth.clear();
    this.cache.clear();

    const providerCounts = new Map<string, number>();
    const providerLatencies = new Map<string, number[]>();

    models.forEach((model) => {
      // Store model
      this.models.set(model.id, model);

      // Track provider health metrics
      const count = providerCounts.get(model.provider) || 0;
      providerCounts.set(model.provider, count + 1);

      const latencies = providerLatencies.get(model.provider) || [];
      latencies.push(model.latencyMs);
      providerLatencies.set(model.provider, latencies);

      // Update provider health status
      this.updateProviderHealth(model.provider, {
        status: model.availability,
        latencyMs: model.latencyMs,
        lastCheck: new Date(),
      });
    });

    this.lastUpdate = new Date();

    this.emit("models_updated", {
      totalModels: models.length,
      providers: Array.from(providerCounts.keys()),
      timestamp: this.lastUpdate,
    });
  }

  /**
   * Add or update single model
   */
  addModel(model: ModelInfo): void {
    this.models.set(model.id, model);
    this.updateProviderHealth(model.provider, {
      status: model.availability,
      latencyMs: model.latencyMs,
      lastCheck: new Date(),
    });

    // Invalidate relevant cache entries
    this.invalidateCache(model.provider);

    this.emit("model_added", { modelId: model.id, provider: model.provider });
  }

  /**
   * Remove model from registry
   */
  removeModel(modelId: string): boolean {
    const model = this.models.get(modelId);
    if (!model) return false;

    this.models.delete(modelId);
    this.invalidateCache(model.provider);

    this.emit("model_removed", { modelId, provider: model.provider });
    return true;
  }

  /**
   * List models with filtering and caching
   */
  list(filters: ModelFilter = {}): ModelInfo[] {
    const cacheKey = this.generateCacheKey(filters);
    const cached = this.cache.get(cacheKey);

    // Return cached result if valid
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.result;
    }

    // Filter models
    let result = Array.from(this.models.values());

    // Apply filters
    if (filters.provider) {
      result = result.filter((m) => m.provider === filters.provider);
    }

    if (filters.capability) {
      result = result.filter((m) =>
        m.capabilities.includes(filters.capability!),
      );
    }

    if (filters.maxLatency !== undefined) {
      result = result.filter((m) => m.latencyMs <= filters.maxLatency!);
    }

    if (filters.maxCost !== undefined) {
      result = result.filter(
        (m) => (m.price.input + m.price.output) / 2 <= filters.maxCost!,
      );
    }

    // Sort by health status and latency
    result.sort((a, b) => {
      // Healthy models first
      const aHealth = this.getProviderHealthScore(a.provider);
      const bHealth = this.getProviderHealthScore(b.provider);
      if (aHealth !== bHealth) return bHealth - aHealth;

      // Then by latency
      return a.latencyMs - b.latencyMs;
    });

    // Cache result
    this.cache.set(cacheKey, {
      result,
      timestamp: Date.now(),
      ttl: this.config.cacheTTL,
    });

    return result;
  }

  /**
   * Get specific model by ID
   */
  getModel(modelId: string): ModelInfo | undefined {
    return this.models.get(modelId);
  }

  /**
   * Get models by provider
   */
  getByProvider(providerId: string): ModelInfo[] {
    return this.list({ provider: providerId });
  }

  /**
   * Get models by capability
   */
  getByCapability(capability: Capability): ModelInfo[] {
    return this.list({ capability });
  }

  /**
   * Get healthy models only
   */
  getHealthyModels(): ModelInfo[] {
    return Array.from(this.models.values()).filter((model) => {
      const health = this.providerHealth.get(model.provider);
      return health?.status === "healthy";
    });
  }

  /**
   * Get registry health summary
   */
  health(): RegistryHealth {
    const allProviders = Array.from(this.providerHealth.keys());
    const healthyProviders = allProviders.filter((provider) => {
      const health = this.providerHealth.get(provider);
      return health?.status === "healthy";
    });

    const allLatencies = Array.from(this.providerHealth.values())
      .map((h) => h.latencyMs)
      .filter((l) => l > 0)
      .sort((a, b) => a - b);

    return {
      providers: allProviders,
      totalModels: this.models.size,
      healthyProviders: healthyProviders.length,
      latency: {
        p50: this.percentile(allLatencies, 0.5),
        p95: this.percentile(allLatencies, 0.95),
      },
      lastUpdate: this.lastUpdate,
    };
  }

  /**
   * Get provider health status
   */
  getProviderHealth(providerId: string): HealthStatus | undefined {
    return this.providerHealth.get(providerId);
  }

  /**
   * Update provider health status
   */
  updateProviderHealth(providerId: string, health: HealthStatus): void {
    const existing = this.providerHealth.get(providerId);
    const updated = { ...existing, ...health };

    this.providerHealth.set(providerId, updated);

    this.emit("provider_health_updated", {
      providerId,
      status: updated.status,
      latency: updated.latencyMs,
    });
  }

  /**
   * Clear all cached results
   */
  clearCache(): void {
    this.cache.clear();
    this.emit("cache_cleared");
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; hitRate: number } {
    // This would be enhanced with actual hit/miss tracking
    return {
      size: this.cache.size,
      hitRate: 0, // TODO: implement hit rate tracking
    };
  }

  // Private helper methods

  private generateCacheKey(filters: ModelFilter): string {
    return JSON.stringify(filters);
  }

  private invalidateCache(providerId?: string): void {
    if (!providerId) {
      this.cache.clear();
      return;
    }

    // Remove cache entries that might include this provider
    for (const [key, _] of this.cache) {
      const filters = JSON.parse(key) as ModelFilter;
      if (!filters.provider || filters.provider === providerId) {
        this.cache.delete(key);
      }
    }
  }

  private getProviderHealthScore(providerId: string): number {
    const health = this.providerHealth.get(providerId);
    if (!health) return 0;

    switch (health.status) {
      case "healthy":
        return 3;
      case "degraded":
        return 2;
      case "unavailable":
        return 1;
      default:
        return 0;
    }
  }

  private percentile(values: number[], p: number): number {
    if (values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Advanced filtering with scoring
   */
  search(query: {
    text?: string;
    filters?: ModelFilter;
    limit?: number;
    includeScore?: boolean;
  }): ModelInfo[] | Array<ModelInfo & { score?: number }> {
    let models = this.list(query.filters || {});

    // Text search
    if (query.text) {
      const searchTerm = query.text.toLowerCase();
      models = models.filter(
        (model) =>
          model.name.toLowerCase().includes(searchTerm) ||
          model.provider.toLowerCase().includes(searchTerm) ||
          model.capabilities.some((cap) =>
            cap.toLowerCase().includes(searchTerm),
          ),
      );
    }

    // Apply limit
    if (query.limit) {
      models = models.slice(0, query.limit);
    }

    return models;
  }

  /**
   * Get usage statistics
   */
  getStats(): {
    totalModels: number;
    byProvider: Record<string, number>;
    byCapability: Record<string, number>;
    healthDistribution: Record<AvailabilityStatus, number>;
  } {
    const allModels = Array.from(this.models.values());

    const byProvider: Record<string, number> = {};
    const byCapability: Record<string, number> = {};
    const healthDistribution: Record<AvailabilityStatus, number> = {
      healthy: 0,
      degraded: 0,
      unavailable: 0,
    };

    allModels.forEach((model) => {
      // Count by provider
      byProvider[model.provider] = (byProvider[model.provider] || 0) + 1;

      // Count by capability
      model.capabilities.forEach((cap) => {
        byCapability[cap] = (byCapability[cap] || 0) + 1;
      });

      // Count by health status
      healthDistribution[model.availability]++;
    });

    return {
      totalModels: allModels.length,
      byProvider,
      byCapability,
      healthDistribution,
    };
  }
}
