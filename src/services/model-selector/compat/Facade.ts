/**
 * Model Selector v2 - Compatibility Facade
 * Provides backward compatibility with existing v1 interface
 */

import { EventEmitter } from "node:events";
import { ModelSelectorEngine } from "../core/ModelSelectorEngine";
import { ModelRegistry } from "../core/ModelRegistry";
import { RecommendationEngine } from "../core/RecommendationEngine";
import type {
  ModelInfo,
  ModelFilter,
  LegacyOptions,
  RecommendationContext,
} from "../types/index";

export interface LegacyModelChoice {
  name: string;
  value: string;
  group: string;
}

/**
 * Facade that adapts v2 engine to v1 interface for seamless migration
 */
export class ModelSelectorV2Facade extends EventEmitter {
  private engine: ModelSelectorEngine;
  private registry: ModelRegistry;

  constructor(
    options: {
      engine?: ModelSelectorEngine;
      registry?: ModelRegistry;
    } = {},
  ) {
    super();

    // Create default instances if not provided
    this.registry = options.registry || new ModelRegistry();
    this.engine =
      options.engine ||
      new ModelSelectorEngine({
        registry: this.registry,
        recommendationEngine: new RecommendationEngine(),
      });

    this.setupEventForwarding();
  }

  /**
   * Legacy interface: open model selection UI
   * Adapts to new v2 engine while maintaining old interface contract
   */
  async open(options: LegacyOptions = {}): Promise<string | null> {
    try {
      // Convert legacy filters to v2 format
      const filters = this.convertLegacyFilters(options.filters || {});

      // Get available models
      const models = this.engine.list(filters);

      if (models.length === 0) {
        this.emitLegacyEvent("no_models_found", { filters });
        return null;
      }

      // Get recommendations if task is specified
      let recommendedModels = models;
      if (options.task) {
        const context: RecommendationContext = {
          task: options.task,
          candidates: models,
          budget: this.inferBudgetFromTask(options.task),
          latencyRequirement: this.inferLatencyFromTask(options.task),
        };

        const recommendations = await this.engine.recommend(context);

        if (recommendations.length > 0) {
          recommendedModels = recommendations;
          this.emitLegacyEvent("recommendations_available", {
            count: recommendations.length,
            topConfidence: recommendations[0].confidence,
          });
        }
      }

      // For facade, return the top recommendation automatically
      // In real v2 UI, user would interact with the selection
      const selected = recommendedModels[0];

      if (selected) {
        // Record the selection in v2 engine
        await this.engine.select(selected.id);

        // Emit legacy-compatible events
        this.emitLegacyEvent("model_selected", {
          modelId: selected.id,
          modelName: selected.name,
          provider: selected.provider,
        });

        return selected.id;
      }

      return null;
    } catch (error) {
      this.emitLegacyEvent("selection_error", {
        error: error.message,
        options,
      });

      throw error;
    }
  }

  /**
   * Legacy interface: show model selection with specific models
   */
  async show(choices: LegacyModelChoice[]): Promise<string | null> {
    try {
      // Convert legacy choices to v2 ModelInfo format
      const models = this.convertLegacyChoices(choices);

      if (models.length === 0) {
        return null;
      }

      // Use first model as default selection for facade
      const selected = models[0];

      await this.engine.select(selected.id);

      this.emitLegacyEvent("legacy_selection_made", {
        modelId: selected.id,
        totalChoices: choices.length,
      });

      return selected.id; // Return model ID (consistent with other methods)
    } catch (error) {
      this.emitLegacyEvent("legacy_selection_error", {
        error: error.message,
        choiceCount: choices.length,
      });

      return null;
    }
  }

  /**
   * Legacy interface: get current selection
   */
  getCurrentSelection(): {
    id?: string;
    name?: string;
    provider?: string;
  } | null {
    const selected = this.engine.getSelected();

    if (!selected) return null;

    return {
      id: selected.id,
      name: selected.name,
      provider: selected.provider,
    };
  }

  /**
   * Legacy interface: check if model is available
   */
  async isModelAvailable(modelId: string): Promise<boolean> {
    const model = this.engine.getModel(modelId);
    return model?.availability === "healthy" || false;
  }

  /**
   * Legacy interface: get model list in old format
   */
  getLegacyModelList(): LegacyModelChoice[] {
    const models = this.engine.list({});

    return models.map((model) => ({
      name: model.name,
      value: model.id,
      group: model.provider,
    }));
  }

  /**
   * Legacy interface: emit events with old names for compatibility
   */
  onLegacyEvent(eventName: string, handler: (data: any) => void): void {
    this.on(eventName, handler);
  }

  /**
   * Legacy interface: remove event handlers
   */
  offLegacyEvent(eventName: string, handler?: (data: any) => void): void {
    if (handler) {
      this.off(eventName, handler);
    } else {
      this.removeAllListeners(eventName);
    }
  }

  // Private helper methods

  private setupEventForwarding(): void {
    // Forward v2 engine events as legacy-compatible events
    this.engine.on("model_selected", (data) => {
      this.emitLegacyEvent("selection_confirmed", data);
    });

    this.engine.on("models_listed", (data) => {
      this.emitLegacyEvent("models_loaded", data);
    });

    this.engine.on("recommendations_generated", (data) => {
      this.emitLegacyEvent("suggestions_ready", data);
    });

    this.engine.on("selection_error", (data) => {
      this.emitLegacyEvent("operation_failed", data);
    });

    // Forward registry events
    this.registry.on("models_updated", (data) => {
      this.emitLegacyEvent("registry_refreshed", data);
    });
  }

  private convertLegacyFilters(filters: Record<string, any>): ModelFilter {
    const v2Filters: ModelFilter = {};

    // Map common legacy filter names to v2 equivalents
    if (filters.provider || filters.providerId) {
      v2Filters.provider = filters.provider || filters.providerId;
    }

    if (filters.capability || filters.type) {
      v2Filters.capability = filters.capability || filters.type;
    }

    if (filters.maxLatency || filters.latency) {
      v2Filters.maxLatency = filters.maxLatency || filters.latency;
    }

    if (filters.maxCost || filters.budget || filters.cost) {
      v2Filters.maxCost = filters.maxCost || filters.budget || filters.cost;
    }

    return v2Filters;
  }

  private convertLegacyChoices(choices: LegacyModelChoice[]): ModelInfo[] {
    return choices.map((choice) => ({
      id: choice.value,
      name: choice.name,
      provider: choice.group,
      latencyMs: 200, // Default values for legacy choices
      price: {
        input: 5,
        output: 10,
        currency: "USD/1Mtok",
      },
      capabilities: ["text"] as const,
      availability: "healthy" as const,
      metadata: {
        legacyChoice: true,
        originalName: choice.name,
      },
    }));
  }

  private inferBudgetFromTask(task: string): "low" | "medium" | "high" {
    const taskLower = task.toLowerCase();

    if (
      taskLower.includes("quick") ||
      taskLower.includes("simple") ||
      taskLower.includes("basic")
    ) {
      return "low";
    }

    if (
      taskLower.includes("complex") ||
      taskLower.includes("detailed") ||
      taskLower.includes("advanced")
    ) {
      return "high";
    }

    return "medium";
  }

  private inferLatencyFromTask(task: string): "low" | "medium" | "high" {
    const taskLower = task.toLowerCase();

    if (
      taskLower.includes("fast") ||
      taskLower.includes("quick") ||
      taskLower.includes("urgent")
    ) {
      return "low";
    }

    if (
      taskLower.includes("batch") ||
      taskLower.includes("background") ||
      taskLower.includes("offline")
    ) {
      return "high";
    }

    return "medium";
  }

  private emitLegacyEvent(eventName: string, data: any): void {
    // Emit both legacy and new event names for maximum compatibility
    this.emit(eventName, data);
    this.emit(`legacy_${eventName}`, data);

    // Log in development for debugging
    if (process.env.NODE_ENV === "development") {
      console.log(`[Facade] Legacy event: ${eventName}`, data);
    }
  }

  /**
   * Get facade health and compatibility status
   */
  getCompatibilityStatus(): {
    facadeVersion: string;
    engineVersion: string;
    compatible: boolean;
    legacyEventsSupported: string[];
    v2FeaturesAvailable: string[];
  } {
    return {
      facadeVersion: "2.0.0",
      engineVersion: "2.0.0",
      compatible: true,
      legacyEventsSupported: [
        "selection_confirmed",
        "models_loaded",
        "suggestions_ready",
        "operation_failed",
        "registry_refreshed",
      ],
      v2FeaturesAvailable: [
        "recommendations",
        "health_monitoring",
        "audit_logging",
        "performance_metrics",
      ],
    };
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    // Emit destroy event before removing listeners
    this.emitLegacyEvent("facade_destroyed", {
      timestamp: new Date(),
    });

    // Clean up listeners after emitting final event
    this.removeAllListeners();

    // Don't destroy the engine/registry as they might be shared
  }
}

export default ModelSelectorV2Facade;
