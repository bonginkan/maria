/**
 * Mode Plugins - Phase 3 Cognitive Mode Plugin System
 * Export all mode plugins and plugin framework components
 */

// Plugin Framework
export {
  BaseModePlugin,
  ModeCategory,
  ModeContext,
  ModeResult,
  ModeDisplayConfig,
  ModeTrigger,
  ModeTransition,
} from './BaseModePlugin';
export { ModePluginRegistry, PluginMetadata, ModeSelection } from './ModePluginRegistry';
export {
  ModeTransitionEngine,
  TransitionRequest,
  TransitionResult,
  SessionState,
} from './ModeTransitionEngine';

// Reasoning Mode Plugins
export { ThinkingMode } from './modes/ThinkingMode';
export { AnalyzingMode } from './modes/AnalyzingMode';

// Creative Mode Plugins
export { BrainstormingMode } from './modes/BrainstormingMode';

// Additional Mode Plugins (to be implemented)
// export { CalculatingMode } from './modes/CalculatingMode';
// export { PlanningMode } from './modes/PlanningMode';
// export { DecidingMode } from './modes/DecidingMode';
// export { SolvingMode } from './modes/SolvingMode';
// export { DesigningMode } from './modes/DesigningMode';
// export { InnovatingMode } from './modes/InnovatingMode';
// export { ImaginingMode } from './modes/ImaginingMode';
// export { ComposingMode } from './modes/ComposingMode';
// export { StorytellingMode } from './modes/StorytellingMode';
// export { ResearchingMode } from './modes/ResearchingMode';
// export { InvestigatingMode } from './modes/InvestigatingMode';
// export { ComparingMode } from './modes/ComparingMode';
// export { EvaluatingMode } from './modes/EvaluatingMode';
// export { ReviewingMode } from './modes/ReviewingMode';
// export { AuditingMode } from './modes/AuditingMode';
// export { TestingMode } from './modes/TestingMode';
// export { DebuggingMode } from './modes/DebuggingMode';

/**
 * Mode Plugin Categories and their plugins
 */
export const MODE_CATEGORIES = {
  reasoning: ['thinking', 'analyzing', 'calculating', 'planning', 'deciding', 'solving'],
  creative: ['brainstorming', 'designing', 'innovating', 'imagining', 'composing', 'storytelling'],
  analytical: [
    'researching',
    'investigating',
    'comparing',
    'evaluating',
    'reviewing',
    'auditing',
    'testing',
    'debugging',
  ],
  structural: [
    'organizing',
    'architecting',
    'systemizing',
    'structuring',
    'modeling',
    'mapping',
    'categorizing',
    'hierarchizing',
  ],
  validation: [
    'verifying',
    'validating',
    'confirming',
    'checking',
    'inspecting',
    'assuring',
    'certifying',
    'approving',
  ],
  contemplative: [
    'reflecting',
    'meditating',
    'pondering',
    'contemplating',
    'introspecting',
    'philosophizing',
  ],
  intensive: ['focusing', 'concentrating', 'deep-working', 'immersing'],
  learning: ['studying', 'acquiring'],
  collaborative: ['coordinating', 'facilitating'],
} as const;

/**
 * Default mode plugin configurations
 */
export const DEFAULT_MODE_CONFIGS = {
  confidenceThreshold: 0.7,
  transitionTimeout: 5000,
  maxConcurrentModes: 1,
  enableModeHistory: true,
  enableTransitionAnimations: true,
} as const;
