/**
 * Code Intent Module Exports
 * Central export point for the filename inference system
 */

// Main services
export { FilenameInferenceService } from './FilenameInferenceService';
export { FilenameUXOrchestrator } from './FilenameUXOrchestrator';

// Analyzers
export { ExplicitAnalyzer } from './analyzers/ExplicitAnalyzer';
export { ContextualAnalyzer } from './analyzers/ContextualAnalyzer';
export { SemanticAnalyzer } from './analyzers/SemanticAnalyzer';
export { ProjectConventionAnalyzer } from './analyzers/ProjectConventionAnalyzer';
export { ExtensionDetector } from './analyzers/ExtensionDetector';

// Security components
export {
  PathSecurityValidator,
  ExtensionGuard,
  CollisionResolver,
  PlanEnforcer
} from './security';

// UX components
export { SaveModeDecider } from './modes/SaveModeDecider';
export { FilenameSelector } from './ui/FilenameSelector';
export { DryRunMode } from './modes/DryRunMode';
export { UndoManager } from './modes/UndoManager';

// Cache
export { LRUCache } from './cache/LRUCache';

// Telemetry
export { filenameInferenceTelemetry, FilenameInferenceTelemetry } from './telemetry/FilenameInferenceTelemetry';

// Types
export type {
  FilenameCandidate,
  InferenceResult,
  SaveOperation,
  SaveResult,
  SaveMode,
  ProjectContext,
  PlanFileSaveConfig,
  NamingConvention,
  ExtensionResult,
  InferenceSource
} from './types/filename-inference.types';

// UX Types
export type { SaveModeOptions, EnvironmentContext } from './modes/SaveModeDecider';
export type { SelectionOptions, SelectionResult } from './ui/FilenameSelector';
export type { DryRunOptions, DryRunResult } from './modes/DryRunMode';
export type { UndoableOperation, UndoResult } from './modes/UndoManager';
export type { UXOptions, UXResult } from './FilenameUXOrchestrator';

// Error types
export {
  SecurityError,
  PlanViolationError,
  PermissionError,
  UserCancelledError
} from './types/filename-inference.types';