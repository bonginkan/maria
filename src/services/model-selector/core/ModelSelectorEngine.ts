/**
 * Model Selector v2 - Main Engine
 * Core orchestration layer for model selection operations
 */

import { EventEmitter } from "node:events";
import { ModelRegistry } from "./ModelRegistry";
import { RecommendationEngine } from "./RecommendationEngine";
import type {
  ModelInfo,
  ModelFilter,
  RecommendationContext,
  ModelRecommendation,
  ModelSelectorEvent,
  ModelSelectorConfig,
  AuditEvent,
} from "../types/index";

export interface ModelSelectorEngineOptions {
  registry: ModelRegistry;
  recommendationEngine?: RecommendationEngine;
  config?: Partial<ModelSelectorConfig>;
}

export class ModelSelectorEngine extends EventEmitter {
  private registry: ModelRegistry;
  private recommendationEngine: RecommendationEngine;
  private config: ModelSelectorConfig;
  private selectedModel?: ModelInfo;
  private operationCount = 0;

  constructor(options: ModelSelectorEngineOptions) {
    super();

    this.registry = options.registry;
    this.recommendationEngine =
      options.recommendationEngine || new RecommendationEngine();

    this.config = {
      recommendation: {
        historyWeight: 0.3,
        latencyWeight: 0.4,
        costWeight: 0.3,
        qualityWeight: 0.0,
      },
      cache: {
        enabled: true,
        ttl: 60000,
        maxEntries: 1000,
      },
      security: {
        rbacEnabled: false,
        auditEnabled: true,
      },
      ...options.config,
    };

    this.setupEventHandlers();
  }

  /**
   * Select a specific model by ID
   */
  async select(
    modelId: string,
    context?: { userId?: string; sessionId?: string },
  ): Promise<void> {
    const startTime = performance.now();
    const operationId = this.generateOperationId();

    try {
      // Security check (if enabled)
      if (this.config.security.rbacEnabled && context?.userId) {
        const allowed = await this.checkModelAccess(context.userId, modelId);
        if (!allowed) {
          throw new Error(`Access denied for model: ${modelId}`);
        }
      }

      // Get model info
      const model = this.registry.getModel(modelId);
      if (!model) {
        throw new Error(`Model not found: ${modelId}`);
      }

      // Check model availability
      if (model.availability === "unavailable") {
        throw new Error(`Model unavailable: ${modelId}`);
      }

      // Store selection
      this.selectedModel = model;
      const duration = performance.now() - startTime;

      // Emit events
      const event: ModelSelectorEvent = {
        type: "select",
        modelId,
        timestamp: new Date(),
        duration,
        success: true,
      };

      this.emit("model_selected", {
        modelId,
        modelName: model.name,
        provider: model.provider,
        latency: model.latencyMs,
        operationId,
      });

      this.emitMetrics(event);

      // Audit log
      if (this.config.security.auditEnabled) {
        await this.auditLog({
          event: "model.select",
          userId: context?.userId,
          modelId,
          provider: model.provider,
          timestamp: new Date(),
          metadata: { operationId, duration },
        });
      }
    } catch (error) {
      const duration = performance.now() - startTime;

      const event: ModelSelectorEvent = {
        type: "select",
        modelId,
        timestamp: new Date(),
        duration,
        success: false,
        error: error.message,
      };

      this.emitMetrics(event);

      this.emit("selection_error", {
        modelId,
        error: error.message,
        operationId,
      });

      throw error;
    }
  }

  /**
   * List available models with filtering
   */
  list(filters: ModelFilter = {}): ModelInfo[] {
    const startTime = performance.now();
    const operationId = this.generateOperationId();

    try {
      const models = this.registry.list(filters);
      const duration = performance.now() - startTime;

      const event: ModelSelectorEvent = {
        type: "list",
        filters,
        timestamp: new Date(),
        duration,
        success: true,
      };

      this.emitMetrics(event);

      this.emit("models_listed", {
        count: models.length,
        filters,
        operationId,
        duration,
      });

      return models;
    } catch (error) {
      const duration = performance.now() - startTime;

      const event: ModelSelectorEvent = {
        type: "list",
        filters,
        timestamp: new Date(),
        duration,
        success: false,
        error: error.message,
      };

      this.emitMetrics(event);

      this.emit("list_error", {
        error: error.message,
        filters,
        operationId,
      });

      return []; // Return empty array on error
    }
  }

  /**
   * Get model recommendations based on context
   */
  async recommend(
    context: RecommendationContext,
  ): Promise<ModelRecommendation[]> {
    const startTime = performance.now();
    const operationId = this.generateOperationId();

    try {
      // Get candidates if not provided
      if (!context.candidates || context.candidates.length === 0) {
        context.candidates = this.registry.getHealthyModels();
      }

      const recommendations =
        await this.recommendationEngine.recommendModels(context);
      const duration = performance.now() - startTime;

      const event: ModelSelectorEvent = {
        type: "recommend",
        context,
        timestamp: new Date(),
        duration,
        success: true,
      };

      this.emitMetrics(event);

      this.emit("recommendations_generated", {
        count: recommendations.length,
        topConfidence: recommendations[0]?.confidence || 0,
        task: context.task,
        operationId,
        duration,
      });

      // Audit log
      if (this.config.security.auditEnabled) {
        await this.auditLog({
          event: "model.recommend",
          userId: context.userId,
          timestamp: new Date(),
          metadata: {
            operationId,
            task: context.task,
            recommendationCount: recommendations.length,
            topModel: recommendations[0]?.id,
          },
        });
      }

      return recommendations;
    } catch (error) {
      const duration = performance.now() - startTime;

      const event: ModelSelectorEvent = {
        type: "recommend",
        context,
        timestamp: new Date(),
        duration,
        success: false,
        error: error.message,
      };

      this.emitMetrics(event);

      this.emit("recommendation_error", {
        error: error.message,
        task: context.task,
        operationId,
      });

      return [];
    }
  }

  /**
   * Get currently selected model
   */
  getSelected(): ModelInfo | undefined {
    return this.selectedModel;
  }

  /**
   * Get model by ID
   */
  getModel(modelId: string): ModelInfo | undefined {
    return this.registry.getModel(modelId);
  }

  /**
   * Search models with text query
   */
  search(query: string, filters?: ModelFilter): ModelInfo[] {
    const startTime = performance.now();

    try {
      const results = this.registry.search({
        text: query,
        filters,
        limit: 10,
      });

      const duration = performance.now() - startTime;

      this.emit("search_completed", {
        query,
        resultCount: results.length,
        duration,
      });

      return results;
    } catch (error) {
      this.emit("search_error", {
        query,
        error: error.message,
      });

      return [];
    }
  }

  /**
   * Get health status of the engine
   */
  getHealth(): {
    status: "healthy" | "degraded" | "unhealthy";
    details: {
      registry: ReturnType<ModelRegistry["health"]>;
      operations: number;
      selectedModel?: string;
      uptime: number;
    };
  } {
    const registryHealth = this.registry.health();
    const healthyRatio =
      registryHealth.healthyProviders / registryHealth.providers.length;

    let status: "healthy" | "degraded" | "unhealthy";
    if (healthyRatio >= 0.8) {
      status = "healthy";
    } else if (healthyRatio >= 0.5) {
      status = "degraded";
    } else {
      status = "unhealthy";
    }

    return {
      status,
      details: {
        registry: registryHealth,
        operations: this.operationCount,
        selectedModel: this.selectedModel?.id,
        uptime: process.uptime(),
      },
    };
  }

  /**
   * Update engine configuration
   */
  updateConfig(config: Partial<ModelSelectorConfig>): void {
    this.config = { ...this.config, ...config };

    // Update recommendation engine if config changed
    if (config.recommendation) {
      this.recommendationEngine.updateConfig(config.recommendation);
    }

    this.emit("config_updated", { config: this.config });
  }

  /**
   * Get engine statistics
   */
  getStats(): {
    operations: number;
    registry: ReturnType<ModelRegistry["getStats"]>;
    recommendations: ReturnType<RecommendationEngine["getStats"]>;
    health: ReturnType<ModelSelectorEngine["getHealth"]>;
  } {
    return {
      operations: this.operationCount,
      registry: this.registry.getStats(),
      recommendations: this.recommendationEngine.getStats(),
      health: this.getHealth(),
    };
  }

  /**
   * Record model usage for learning
   */
  async recordUsage(
    modelId: string,
    context: {
      success: boolean;
      executionTime: number;
      task?: string;
      userId?: string;
      error?: string;
    },
  ): Promise<void> {
    try {
      // Update recommendation engine history
      const recommendationContext: RecommendationContext = {
        task: context.task,
        userId: context.userId,
        candidates: [], // Not needed for history update
      };

      this.recommendationEngine.updateHistory(
        recommendationContext,
        context.success,
        context.executionTime,
      );

      // Audit log
      if (this.config.security.auditEnabled) {
        await this.auditLog({
          event: "model.usage",
          userId: context.userId,
          modelId,
          timestamp: new Date(),
          metadata: {
            success: context.success,
            executionTime: context.executionTime,
            task: context.task,
            error: context.error,
          },
        });
      }

      this.emit("usage_recorded", {
        modelId,
        success: context.success,
        executionTime: context.executionTime,
        task: context.task,
      });
    } catch (error) {
      this.emit("usage_record_error", {
        modelId,
        error: error.message,
      });
    }
  }

  // Private helper methods

  private setupEventHandlers(): void {
    // Forward registry events
    this.registry.on("models_updated", (data) => {
      this.emit("registry_updated", data);
    });

    this.registry.on("provider_health_updated", (data) => {
      this.emit("provider_health_changed", data);
    });

    // Forward recommendation engine events
    this.recommendationEngine.on("recommendations_generated", (data) => {
      this.emit("recommendation_metrics", data);
    });
  }

  private generateOperationId(): string {
    this.operationCount++;
    return `op_${Date.now()}_${this.operationCount}`;
  }

  private emitMetrics(event: ModelSelectorEvent): void {
    this.emit("metrics", event);
  }

  private async checkModelAccess(
    userId: string,
    modelId: string,
  ): Promise<boolean> {
    // TODO: Implement RBAC check
    // For MVP, always allow access
    return true;
  }

  private async auditLog(event: AuditEvent): Promise<void> {
    try {
      // For MVP, emit as event - can be captured by external audit systems
      this.emit("audit", event);

      // Simple console logging in development
      if (process.env.NODE_ENV === "development") {
        console.log("AUDIT:", JSON.stringify(event));
      }
    } catch (error) {
      // Audit logging should never fail the main operation
      this.emit("audit_error", {
        event: event.event,
        error: error.message,
      });
    }
  }
}

export default ModelSelectorEngine;
