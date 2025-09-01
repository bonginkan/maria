/**
 * Phase 4.1 Learning Engine - Public API
 * Main exports for the learning engine module
 */

export { LearningEngine } from "./LearningEngine";
export { PatternDetector } from "./core/PatternDetector";
export { ContextTracker } from "./core/ContextTracker";
export { SuggestionEngine } from "./core/SuggestionEngine";
export { PatternStore } from "./storage/PatternStore";

// Export types
export type {
  UserAction,
  Pattern,
  SimpleContext,
  Suggestion,
  LearningStats,
  LearningEngineConfig,
  PatternMatchResult,
} from "./types/learning.types";
