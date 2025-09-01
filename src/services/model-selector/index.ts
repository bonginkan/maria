/**
 * Model Selector v2 - Public API
 * Main entry point for v2 model selection system
 */

// Core components
export { ModelSelectorEngine } from "./core/ModelSelectorEngine";
export type { ModelSelectorEngineOptions } from "./core/ModelSelectorEngine";

export { ModelRegistry } from "./core/ModelRegistry";
export { RecommendationEngine } from "./core/RecommendationEngine";

// Compatibility layer
export { ModelSelectorV2Facade } from "./compat/Facade";
export type { LegacyModelChoice } from "./compat/Facade";

// Feature flags
export {
  isModelSelectorV2Enabled,
  getModelSelectorV2Config,
  logFeatureFlagUsage,
  GradualRollout,
} from "./feature-flags";

// Types
export type {
  ModelInfo,
  ModelFilter,
  RecommendationContext,
  ModelRecommendation,
  ModelUsageHistory,
  RegistryHealth,
  ProviderAdapter,
  ModelSelectorEvent,
  AuditEvent,
  ModelSelectorConfig,
  RecommendationConfig,
  PricingInfo,
  Capability,
  AvailabilityStatus,
  LegacyOptions,
} from "./types/index";

// Convenience factory function
export function createModelSelector(options: {
  models?: ModelInfo[];
  config?: Partial<ModelSelectorConfig>;
}) {
  const registry = new ModelRegistry();

  if (options.models) {
    registry.replaceAll(options.models);
  }

  const engine = new ModelSelectorEngine({
    registry,
    config: options.config,
  });

  return {
    engine,
    registry,
    facade: new ModelSelectorV2Facade({ engine, registry }),
  };
}

// Version information
export const VERSION = "2.0.0-beta";
export const BUILD_DATE = new Date().toISOString();

// Note: Removed default export to fix build issues
// Use named exports instead
