/**
 * Self-Healing System Type Definitions
 * Core types for the MARIA self-healing doctor system
 */

// ============================================
// Core Types
// ============================================

/**
 * Types of issues that can be detected and fixed
 */
export type IssueType =
  | "CONFIG_MISSING" // Configuration file missing (.env.local)
  | "CACHE_CORRUPT" // Cache files corrupted
  | "MODEL_INVALID" // Model configuration invalid
  | "DEPS_MISSING" // Dependencies not installed
  | "PERMISSION_ERROR" // File permission issues
  | "PROVIDER_DOWN" // AI provider not accessible
  | "VERSION_MISMATCH"; // Version compatibility issues

/**
 * Risk calculation with quantified impact and probability
 */
export interface RiskCalculation {
  impact: "low" | "medium" | "high"; // Impact if issue occurs
  probability: "rare" | "possible" | "likely"; // Likelihood of occurrence
  score: number; // Calculated risk score (0.0-1.0)
}

/**
 * Issue detected during diagnosis
 */
export interface Issue {
  id: string;
  type: IssueType;
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  context: Record<string, any>;
  details?: Record<string, any>;
  detectedAt: Date;
  suggestion?: string;
  category?: string;
}

// ============================================
// Recipe Types
// ============================================

/**
 * Action types supported by the healing system
 */
export type ActionType =
  | "file:ensure" // Ensure file exists
  | "file:appendUnique" // Append unique lines to file
  | "file:backup" // Create file backup
  | "file:restore" // Restore from backup
  | "file:chmod" // Change file permissions
  | "file:check" // Check file existence
  | "file:exists" // Verify file exists
  | "file:checkPermissions" // Check file permissions
  | "config:backup" // Backup configuration
  | "config:setDefault" // Set default configuration
  | "config:restore" // Restore configuration
  | "cache:purge" // Remove cache files
  | "cache:warmup" // Pre-populate cache
  | "cache:check" // Check cache health
  | "cache:healthy" // Verify cache is healthy
  | "shell:execute" // Execute shell command
  | "model:check" // Check model availability
  | "model:listAvailable" // List available models
  | "model:set" // Set active model
  | "custom"; // Custom action

/**
 * Individual action to be executed
 */
export interface FixAction {
  type: ActionType;
  args: Record<string, any>;
  timeout?: number; // Action timeout in ms
  retryCount?: number; // Number of retries
}

/**
 * Recipe for fixing a specific issue
 */
export interface FixRecipe {
  id: string;
  name: string;
  description: string;
  match: {
    issueType: IssueType;
    conditions?: Record<string, any>;
  };
  risk: RiskCalculation;
  requiresApproval: boolean;
  timeout: number;
  dependsOn?: string[]; // Recipe dependencies
  allowedCommands?: string[]; // Whitelisted shell commands
  actions: {
    dryRun: FixAction[]; // Actions for preview
    apply: FixAction[]; // Actions to apply fix
    verify: FixAction[]; // Actions to verify fix
    rollback?: FixAction[]; // Actions to rollback if needed
  };
}

// ============================================
// Execution Types
// ============================================

/**
 * Options for executing healing plan
 */
export interface ExecuteOptions {
  dryRun?: boolean; // Preview changes without applying
  riskLevel?: number; // Maximum acceptable risk (0.0-1.0)
  force?: boolean; // Skip approval prompts
  timeout?: number; // Overall execution timeout
}

/**
 * Healing plan generated from issues
 */
export interface HealingPlan {
  id: string;
  createdAt: Date;
  issueIds: string[];
  recipeIds: string[];
  actions: FixAction[];
  risk: RiskCalculation;
  estimatedDuration: number;
  requiresApproval: boolean;

  // Legacy compatibility
  issues?: Issue[];
  recipes?: FixRecipe[];
  totalRisk?: RiskCalculation;
}

/**
 * Preview of changes for dry-run
 */
export interface HealingPreview {
  plan: HealingPlan;
  actions: Array<{
    recipe: string;
    description: string;
    risk: RiskCalculation;
    changes?: Array<{
      type: "create" | "modify" | "delete";
      path: string;
      preview?: string;
    }>;
  }>;
  wouldApply: number;
  wouldSkip: number;
}

/**
 * Result of action execution
 */
export interface ActionResult {
  success: boolean;
  action: FixAction;
  duration: number;
  output?: any;
  error?: string;
}

/**
 * Result of healing execution
 */
export interface HealResult {
  success: boolean;
  message: string;
  details: {
    planId?: string;
    executedAt?: Date;
    recipesApplied: string[];
    recipesFailed: string[];
    recipesSkipped: string[];
    actions: ActionResult[];
    duration: number;
    checkpointId?: string;
  };

  // Legacy compatibility
  planId?: string;
  executedAt?: Date;
  recipesApplied?: string[];
  recipesFailed?: string[];
  recipesSkipped?: string[];
  actions?: ActionResult[];
  changes?: any[];
  duration?: number;
  checkpointId?: string;
}

/**
 * Verification result after healing
 */
export interface VerificationResult {
  success: boolean;
  issuesResolved: string[];
  issuesRemaining: string[];
  newIssues: string[];
  verificationActions: ActionResult[];
}

// ============================================
// State Management Types
// ============================================

/**
 * State checkpoint for rollback
 */
export interface StateCheckpoint {
  id: string;
  timestamp: Date;
  files: Map<string, Buffer>; // File backups
  configs: Map<string, any>; // Configuration backups
  metadata: Record<string, any>;
}

/**
 * Difference between states
 */
export interface StateDiff {
  filesAdded: string[];
  filesModified: string[];
  filesDeleted: string[];
  configsChanged: string[];
  totalChanges: number;
}

// ============================================
// Audit & Monitoring Types
// ============================================

/**
 * Audit log entry
 */
export interface AuditEntry {
  timestamp: Date;
  action: string;
  recipe: string;
  risk: RiskCalculation;
  status: "success" | "failed" | "skipped";
  duration: number;
  changes?: any; // Masked for sensitive data
  error?: string;
  rollbackAvailable: boolean;
  user?: string;
  sessionId?: string;
}

/**
 * Health metrics for monitoring
 */
export interface HealthMetrics {
  totalIssuesDetected: number;
  autoFixedCount: number;
  manualFixedCount: number;
  failedFixCount: number;
  averageFixTime: number; // milliseconds
  rollbackCount: number;
  successRate: number; // percentage (0-100)
  mttr: number; // Mean Time To Recovery in ms
}

/**
 * Diagnostic context for issue detection
 */
export interface DiagnosticContext {
  cwd: string;
  environment?: Record<string, string>;
  session?: any;
  user?: any;
}

// ============================================
// Risk Constants
// ============================================

/**
 * Risk level thresholds for automation
 */
export const RISK_THRESHOLDS = {
  AUTO_EXECUTE: 0.2, // Below this: automatic execution
  REQUIRE_APPROVAL: 0.5, // Below this: requires approval
  SUGGEST_ONLY: 1.0, // Above 0.50: only suggest, don't execute
} as const;

/**
 * Risk matrix for calculating scores
 */
export const RISK_MATRIX: Record<string, Record<string, number>> = {
  low: {
    rare: 0.02,
    possible: 0.06,
    likely: 0.1,
  },
  medium: {
    rare: 0.05,
    possible: 0.15,
    likely: 0.25,
  },
  high: {
    rare: 0.1,
    possible: 0.3,
    likely: 0.5,
  },
};

/**
 * Calculate risk score from impact and probability
 */
export function calculateRiskScore(
  impact: RiskCalculation["impact"],
  probability: RiskCalculation["probability"],
): number {
  return RISK_MATRIX[impact]?.[probability] ?? 1.0;
}

/**
 * Determine if action requires approval based on risk
 */
export function requiresApproval(risk: RiskCalculation): boolean {
  return (
    risk.score > RISK_THRESHOLDS.AUTO_EXECUTE &&
    risk.score <= RISK_THRESHOLDS.REQUIRE_APPROVAL
  );
}

/**
 * Determine if action should be suggestion only
 */
export function isSuggestionOnly(risk: RiskCalculation): boolean {
  return risk.score > RISK_THRESHOLDS.REQUIRE_APPROVAL;
}
