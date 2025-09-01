/**
 * Unified Intent Mapping Types
 * Integration layer for all MARIA intent recognition systems
 */

import { InternalMode } from "../../../ui/integrated-cli/ModeIndicator";

/**
 * Core operation types across all MARIA systems
 */
export type _OperationType =
  | "file"
  | "linux"
  | "document"
  | "code"
  | "system"
  | "maria";

/**
 * Risk levels from LinuxIntelligenceEngine
 */
export type _RiskLevel = "SAFE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

/**
 * Task complexity levels
 */
export type ComplexityLevel =
  | "simple"
  | "moderate"
  | "complex"
  | "very_complex";

/**
 * Mode trigger types from ModeRecognitionEngine
 */
export type ModeTriggerType = "intent" | "context" | "situation" | "pattern";

/**
 * Linux command categories from LinuxIntelligenceEngine
 */
export type LinuxCategory = "file" | "service" | "network" | "user" | "package";

/**
 * Unified operation intent
 */
export interface UnifiedOperationIntent {
  type: OperationType;
  action: string;
  target?: string;
  parameters: Record<string, any>;
  generatedContent?: string;
  implicitSave?: boolean;
}

/**
 * Command intent from IntelligentRouterService
 */
export interface CommandIntent {
  command: string;
  confidence: number;
  parameters: Record<string, unknown>;
  originalInput: string;
  language: string;
  alternatives?: Array<{
    command: string;
    confidence: number;
  }>;
  reasoning?: string[];
}

/**
 * Linux operation intent from LinuxIntelligenceEngine
 */
export interface LinuxIntent {
  action: string;
  target: string;
  category: LinuxCategory;
  confidence: number;
  riskLevel: RiskLevel;
  commands?: string[];
}

/**
 * Internal mode recognition result
 */
export interface InternalModeIntent {
  mode: InternalMode;
  confidence: number;
  triggeredBy: ModeTriggerType[];
  reasoning?: string[];
}

/**
 * Task analysis from Active Reporting
 */
export interface TaskIntent {
  primary: string;
  secondary: string[];
  complexity: ComplexityLevel;
  implicitRequirements: string[];
  capabilities?: string[];
  risks?: string[];
}

/**
 * NLP processing results
 */
export interface NLPEntities {
  language: string;
  tokens: string[];
  keywords: string[];
  entities: {
    files?: string[];
    urls?: string[];
    commands?: string[];
    codeBlocks?: string[];
    frameworks?: string[];
  };
  sentiment?: "positive" | "neutral" | "negative";
}

/**
 * Unified intent mapping combining all systems
 */
export interface UnifiedIntentMapping {
  // Core operation intent
  operation: UnifiedOperationIntent;

  // From IntelligentRouterService
  commandIntent?: CommandIntent;

  // From LinuxIntelligenceEngine
  linuxIntent?: LinuxIntent;

  // From ModeRecognitionEngine
  internalMode?: InternalModeIntent;

  // From Active Reporting IntentAnalyzer
  taskIntent?: TaskIntent;

  // From NaturalLanguageProcessor
  nlpEntities?: NLPEntities;

  // Overall confidence score
  confidence: number;

  // Combined risk assessment
  riskLevel: RiskLevel;

  // Timestamp
  timestamp: Date;

  // Original user input
  originalInput: string;
}

/**
 * Context evaluation result
 */
export interface ContextEvaluation {
  workingDirectory: string;
  projectType: string;
  gitStatus?: {
    branch: string;
    hasChanges: boolean;
    untrackedFiles: string[];
  };
  recentActions: Array<{
    action: string;
    timestamp: Date;
    success: boolean;
  }>;
  currentMode?: InternalMode;
  existingFiles: string[];
  riskLevel: RiskLevel;
  userPreferences?: Record<string, any>;
}

/**
 * Validation result for operations
 */
export interface ValidationResult {
  canProceed: boolean;
  requiresConfirmation: boolean;
  requiresBackup: boolean;
  riskLevel: RiskLevel;
  mitigations?: string[];
  warnings?: string[];
  blockedReason?: string;
}

/**
 * Execution result
 */
export interface ExecutionResult {
  success: boolean;
  operation: UnifiedOperationIntent;
  result?: any;
  error?: Error;
  duration: number;
  backupPath?: string;
  rollbackAvailable: boolean;
}

/**
 * Action handler type
 */
export type ActionHandler = (
  _intent: UnifiedIntentMapping,
) => Promise<ExecutionResult>;

/**
 * Pattern recognition result
 */
export interface PatternMatch {
  pattern: RegExp;
  match: RegExpMatchArray;
  category: string;
  action: string;
  confidence: number;
}

/**
 * Language-specific intent result
 */
export interface IntentResult {
  action: string;
  type: OperationType;
  target?: string;
  parameters?: Record<string, any>;
  implicitSave?: boolean;
  confidence: number;
  language: string;
}
