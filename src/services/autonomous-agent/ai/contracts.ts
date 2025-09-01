/**
 * AI Contracts - Stable API interface for Phase 3
 * Defines the core data structures for AI operations
 */

// Task types for intent classification
export type TaskType = "optimize" | "refactor" | "fix" | "scaffold" | "test";

// Risk levels for operations
export type RiskLevel = "low" | "medium" | "high";

// Action types for execution steps
export type ActionType = "create" | "modify" | "delete";

/**
 * Request to generate an execution plan from natural language
 */
export interface PlanRequest {
  input: string;                       // Natural language intent
  repoDigest: string;                  // Git HEAD tree hash for caching
  constraints?: {
    latencyMs?: number;                // Maximum latency budget in milliseconds
    tokenBudget?: number;              // Maximum tokens to use
    allowVision?: boolean;             // Enable image/screenshot analysis
  };
}

/**
 * Generated execution plan from AI analysis
 */
export interface ExecutionPlan {
  id: string;                          // Unique plan identifier
  task: TaskType;                      // Classified task type
  risk: RiskLevel;                     // Overall risk assessment
  steps: ExecutionStep[];              // Individual execution steps
  summary: string;                     // Human-readable summary
  estimatedTime: number;               // Estimated execution time in seconds
  totalLOC: number;                    // Total lines of code to be affected
  reasoning: string[];                 // AI reasoning for the plan
  confidence: number;                  // Confidence score (0-1)
}

/**
 * Individual step in an execution plan
 */
export interface ExecutionStep {
  idx: number;                         // Step index (0-based)
  action: ActionType;                  // Type of action to perform
  path: string;                        // File path to operate on
  preview?: string;                    // First 30 lines of code preview
  diff?: string;                       // Unified diff (optional at plan stage)
  estimatedLOC: number;                // Estimated lines of code delta
  risk: RiskLevel;                     // Risk level for this step
  requiresApproval: boolean;           // Whether manual approval is required
  reasoning: string;                   // Why this step is needed
  dependencies?: number[];             // Indices of steps this depends on
}

/**
 * Enhanced intent from natural language processing
 */
export interface EnhancedIntent {
  primaryGoal: TaskType;               // Main task to accomplish
  secondaryGoals: TaskType[];          // Additional goals identified
  targetComponents: string[];          // Identified components to modify
  suggestedApproaches: string[];       // AI-suggested implementation approaches
  estimatedComplexity: RiskLevel;      // Complexity assessment
  requiredPermissions: string[];       // Permissions needed for execution
  confidence: number;                  // Confidence in intent understanding (0-1)
}

/**
 * Result from code modification
 */
export interface ModifiedCode {
  originalCode: string;                // Original code content
  modifiedCode: string;                // Modified code content
  patch: JSONPatch | UnifiedDiff;      // Patch representation
  estimatedLOC: number;                // Lines of code changed
  confidence: number;                  // Confidence in modification (0-1)
  reasoning: string[];                 // Reasons for changes
}

/**
 * JSON Patch format (RFC 6902)
 */
export interface JSONPatch {
  op: "add" | "remove" | "replace" | "move" | "copy" | "test";
  path: string;
  value?: any;
  from?: string;
}

/**
 * Unified diff format
 */
export type UnifiedDiff = string;

/**
 * Code context for generation/modification
 */
export interface CodeContext {
  language: string;                    // Programming language
  framework?: string;                  // Framework being used
  projectStructure: ProjectStructure;  // Project layout information
  existingPatterns: CodePattern[];     // Learned code patterns
  dependencies: string[];              // Current dependencies
}

/**
 * Project structure information
 */
export interface ProjectStructure {
  rootPath: string;
  sourceDirectories: string[];
  testDirectories: string[];
  configFiles: string[];
  entryPoints: string[];
}

/**
 * Learned code pattern
 */
export interface CodePattern {
  pattern: string;                     // Pattern identifier
  frequency: number;                   // How often seen
  lastSeen: string;                    // Last occurrence timestamp
  confidence: number;                  // Confidence in pattern (0-1)
}

/**
 * Execution session information
 */
export interface ExecutionSession {
  id: string;                          // Session identifier
  planId: string;                      // Associated plan ID
  startTime: string;                   // Session start timestamp
  currentStep: number;                 // Current step index
  completedSteps: number[];            // Completed step indices
  skippedSteps: number[];              // Skipped step indices
  status: SessionStatus;               // Current session status
  checkpoints: Checkpoint[];           // Rollback checkpoints
}

/**
 * Session status
 */
export type SessionStatus = "active" | "paused" | "completed" | "aborted" | "error";

/**
 * Rollback checkpoint
 */
export interface Checkpoint {
  id: string;                          // Checkpoint identifier
  stepIndex: number;                   // Step this checkpoint was created after
  timestamp: string;                   // When checkpoint was created
  gitCommit?: string;                  // Git commit hash if available
  description: string;                 // Human-readable description
}

/**
 * Execution error information
 */
export interface ExecutionError {
  type: ErrorType;                     // Type of error
  message: string;                     // Error message
  location?: string;                   // File/line location
  step?: ExecutionStep;                // Step that caused error
  stack?: string;                      // Stack trace if available
  recoverable: boolean;                // Whether error is recoverable
}

/**
 * Error types
 */
export type ErrorType = 
  | "syntax"           // Syntax error in generated code
  | "type"            // Type error (TypeScript, etc.)
  | "runtime"         // Runtime execution error
  | "permission"      // Permission denied
  | "validation"      // Validation failure
  | "network"         // Network error
  | "timeout"         // Operation timeout
  | "unknown";        // Unknown error type

/**
 * Recovery action from error
 */
export interface RecoveryAction {
  action: "auto_fix" | "rollback" | "manual" | "abort";
  success: boolean;
  message: string;
  details?: any;
  error?: string;
}

/**
 * Recovery options presented to user
 */
export interface RecoveryOption {
  title: string;                       // Option title
  description: string;                 // Detailed description
  confidence: number;                  // Success likelihood (0-1)
  effort: "low" | "medium" | "high";   // Required effort
  strategy: "auto_fix" | "rollback" | "manual";
}

/**
 * Patch validation result
 */
export interface PatchValidation {
  safe: boolean;                       // Whether patch is safe to apply
  reason: string;                      // Reason for safety decision
  confidence: number;                  // Confidence in decision (0-1)
  reasoning?: string[];                // Detailed reasoning
  warnings?: string[];                 // Any warnings to show
}