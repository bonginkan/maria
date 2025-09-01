/**
 * Code Quality Types and Interfaces
 * Core type definitions for error parsing, validation, and reporting
 */

export type IssueSource =
  | "tsc"
  | "eslint"
  | "vitest"
  | "jest"
  | "node"
  | "webpack"
  | "vite"
  | "unknown";

export type CodeIntent =
  | "CREATE" // 新規作成
  | "MODIFY" // 既存修正
  | "FIX_ERROR" // エラー修復
  | "REFACTOR" // リファクタリング
  | "TEST" // テスト生成
  | "DOC" // ドキュメント生成
  | "EXPLAIN"; // コード解説

export interface ErrorFingerprint {
  id?: string; // Stable hash for deduplication
  source?: IssueSource; // Error source system
  file: string; // File path (absolute or relative)
  line: number; // Line number (1-based)
  column: number; // Column number (1-based)
  endLine?: number; // End line for multi-line errors
  endColumn?: number; // End column
  ruleId?: string; // ESLint rule, Jest test name, etc.
  rule?: string; // Alternative to ruleId
  code?: string; // TS error code (TS2345), webpack code, etc.
  message: string; // Error message
  raw?: string; // Original error line/block
  stack?: string[]; // Stack trace lines (for runtime errors)
  severity: "error" | "warning" | "info";
  fixable?: boolean; // Can be auto-fixed
  suggestions?: string[]; // Suggested fixes
  category: string; // Error category (TYPE_ERROR, LINT_ERROR, etc.)
  fingerprint: string; // Unique identifier for deduplication
  testName?: string; // For test failures
}

export interface StageResult {
  ok: boolean; // Stage passed
  tookMs: number; // Execution time in milliseconds
  errors?: ErrorFingerprint[];
  warnings?: ErrorFingerprint[];
  stdout?: string; // Raw stdout output
  stderr?: string; // Raw stderr output
  skipped?: boolean; // Stage was skipped
  skipReason?: string; // Why it was skipped
}

export interface GateReport {
  pass: boolean; // Overall gate passed
  stages: {
    format?: StageResult; // Prettier formatting
    eslint?: StageResult; // ESLint validation
    typecheck?: StageResult; // TypeScript compilation
    test?: StageResult; // Test execution
    build?: StageResult; // Build process
    security?: StageResult; // Security scanning
  };
  errors: ErrorFingerprint[]; // All errors collected
  warnings: ErrorFingerprint[]; // All warnings collected
  durationMs: number; // Total execution time
  timestamp: string; // ISO timestamp
  metadata?: {
    filesChecked?: number;
    linesAnalyzed?: number;
    testsRun?: number;
    coverage?: number;
  };
}

export interface Patch {
  file: string; // Target file path
  startLine: number; // Start line (1-based)
  endLine: number; // End line (inclusive)
  oldContent: string; // Original content
  newContent: string; // Replacement content
  reason: string; // Why this change is needed
  confidence?: number; // Confidence score (0-1)
  alternative?: Patch; // Alternative fix option
}

export interface ValidationOptions {
  cwd?: string; // Working directory
  timeoutMs?: number; // Per-stage timeout
  eslintTargets?: string[]; // Files/dirs to lint
  testCmd?: "vitest" | "jest" | "npm test";
  passWithNoTests?: boolean; // Pass if no tests found
  formatter?: "prettier" | "biome" | "none";
  skipStages?: Array<keyof GateReport["stages"]>;
  parallel?: boolean; // Run stages in parallel
}

export interface GrepSnippet {
  file: string; // File path
  line: number; // Line number
  text: string; // Line content
  match?: string; // Matched portion
  contextBefore?: string[]; // Lines before match
  contextAfter?: string[]; // Lines after match
  score?: number; // Relevance score
}

export interface RepoContext {
  snippets: GrepSnippet[]; // Collected code snippets
  totalHits: number; // Total matches found
  searchMethod: "ripgrep" | "native" | "ast";
  searchTimeMs?: number;
  cacheHit: boolean;
}

// Error Classification Types
export enum ErrorCategory {
  TYPE_ERROR = "type",
  SYNTAX_ERROR = "syntax",
  LINT_ERROR = "lint",
  TEST_FAILURE = "test",
  RUNTIME_ERROR = "runtime",
  BUILD_ERROR = "build",
  SECURITY_ISSUE = "security",
  DEPENDENCY_ERROR = "dependency",
}

export enum RepairStrategy {
  ADD_TYPE = "add-type",
  FIX_IMPORT = "fix-import",
  RENAME_VARIABLE = "rename-var",
  ADD_NULL_CHECK = "null-check",
  FIX_ASYNC = "fix-async",
  ADD_MISSING_PROP = "add-prop",
  REMOVE_UNUSED = "remove-unused",
  UPDATE_DEPENDENCY = "update-dep",
  REGENERATE = "regenerate",
  MANUAL_FIX = "manual",
}

export interface ClassifiedError {
  fingerprint: ErrorFingerprint;
  category: ErrorCategory;
  difficulty: "trivial" | "easy" | "medium" | "hard" | "complex";
  strategy: RepairStrategy;
  priority: number; // 1-10, higher = more urgent
  estimatedEffort?: number; // Minutes to fix
}

// Execution Safety Types
export interface ExecOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  sandbox?: boolean;
  dryRun?: boolean;
  stdin?: string;
}

export interface ExecResult {
  code: number | null;
  stdout: string;
  stderr: string;
  signal?: NodeJS.Signals;
  timedOut?: boolean;
  duration?: number;
}

// Model Selection Types
export interface ModelSelectionCriteria {
  intent: CodeIntent;
  complexity: "low" | "medium" | "high";
  contextSize: number;
  needsVision?: boolean;
  priority?: "speed" | "accuracy" | "creativity" | "cost";
  budget?: "economy" | "standard" | "premium";
}

export interface ModelSelection {
  model: string;
  reason: string;
  estimatedCost?: number;
  estimatedTokens?: number;
  confidence?: number;
}

// Patch operation for code changes
export interface PatchOperation {
  type: "insert" | "delete" | "replace";
  startLine?: number;
  endLine?: number;
  content: string;
  description?: string;
}

// Code change specifications
export interface ChangeSpec {
  id?: string; // Unique change ID
  file: string; // Target file path
  type:
    | "CREATE"
    | "MODIFY"
    | "DELETE"
    | "FIX_ERROR"
    | "REFACTOR"
    | "ADD_FEATURE"
    | "TEST";
  description: string; // What the change does
  content?: string; // Full content for CREATE
  patch?: PatchOperation[]; // Patch operations
  validation?: {
    confidence: number;
    issues: string[];
  };
  timestamp?: number; // When the change was planned
}

// Validation result with three-value system
export interface ValidationResult {
  valid: boolean; // Legacy compatibility
  result?: "pass" | "softFail" | "hardFail"; // Three-value system
  errors: ErrorFingerprint[];
  executionTime: number;
  metadata?: {
    totalErrors: number;
    byCategory: Record<string, number>;
    bySeverity: Record<string, number>;
  };
}
