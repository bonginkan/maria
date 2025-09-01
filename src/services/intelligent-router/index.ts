/**
 * Intelligent Router Service - Public API
 *
 * This is the only entry point for external consumers.
 * Internal implementation details are not exposed.
 */

// Public API - Application layer only
export { IntelligentRouterService } from "./app/IntelligentRouterService";
export { FallbackRouter } from "./app/FallbackRouter";

// Domain types only (not implementations)
export type {
  RoutingDecision,
  Intent,
  Language,
  RouteResult,
  RouterConfig,
  RoutingContext,
} from "./domain/types";

// Port interfaces for dependency injection
export type {
  INlpProcessor,
  ILanguageDetector,
  IIntentClassifier,
  IParameterExtractor,
} from "./ports";

// Re-export port types
export type {
  LanguageResult,
  ClassificationResult,
  ExtractedParameters,
  ValidationResult,
} from "./ports";

/**
 * @deprecated Use IntelligentRouterService instead
 * Will be removed in v2.3.0
 */
export { IntelligentRouterService as IntelligentRouter } from "./app/IntelligentRouterService";

// Internal modules are not exported
// Use ESLint rules to prevent direct imports
