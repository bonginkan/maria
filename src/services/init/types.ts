/**
 * Type definitions for the /init command system
 */

export type InitFinding = {
  file: string;
  kind: "read" | "search" | "config" | "entry";
  head: string;
  meta?: Record<string, any>;
  truncated?: boolean;
};

export type PackageInfo = {
  name?: string;
  version?: string;
  type?: "module" | "commonjs";
  scripts: string[];
  hasPostinstall: boolean;
  bin?: Record<string, string> | string;
  main?: string;
  exports?: any;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  workspaces?: string[] | { packages: string[] };
};

export type Warning = {
  id: string;
  level: "low" | "medium" | "high";
  file: string;
  line?: number;
  message: string;
};

export type InitSummary = {
  package: PackageInfo;
  entries: string[];
  configs: string[];
  scriptsCount: number;
  warnings: Warning[];
};

export type InitOptions = {
  cwd?: string;
  budgetMs?: number;
  maxLines?: number;
  depth?: number;
  noScripts?: boolean;
  force?: boolean;
  json?: boolean;
  scan?: boolean;
  verbose?: boolean;
  merge?: boolean;
  signal?: AbortSignal;
};

export type InitArtifacts = {
  claudeMd: string;
  initReportMd: string;
  depMapJson: any;
  initSummaryTxt: string;
};

export type InitMetrics = {
  scan_ms_total: number;
  files_read: number;
  files_skipped: number;
  warnings_total: number;
  timeouts: number;
  size_truncated: number;
  sensitive_skipped: number;
};

export type Task = (opts: {
  signal: AbortSignal;
  remainMs: () => number;
}) => Promise<InitFinding[]>;

/**
 * Extended InitSummary for Phase 2
 */
export interface InitSummaryV2 {
  projectName?: string;
  projectPath?: string;
  description?: string;
  techStack: {
    language: string;
    framework: string;
    buildTool: string;
    testFramework: string;
    packageManager: string;
    typescript: boolean;
    hasTests: boolean;
  };
  structure: {
    totalFiles: number;
    totalSize: number;
    avgFileSize: number;
    largestFile: { path: string; size: number };
  };
  warnings: Array<{
    level: "low" | "medium" | "high";
    category: string;
    message: string;
    file?: string;
  }>;
  commands: Record<string, string>;
  dependencies: string[];
  package?: PackageInfo;
  entries?: string[];
  configs?: string[];
  scriptsCount?: number;
}

/**
 * Validation result for configuration checks
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  recommendations: string[];
}

/**
 * Recovery strategy for error handling
 */
export interface RecoveryStrategy {
  type: "permission" | "missing" | "performance" | "syntax" | "resource";
  action: "skip" | "ignore" | "retry-reduced" | "skip-parse" | "reduce-batch";
  fallback: string;
  recommendation: string;
}

/**
 * Progress event for tracking initialization phases
 */
export interface ProgressEvent {
  phase: string;
  description: string;
  progress: number;
  elapsed: number;
  status: "in-progress" | "completed" | "failed";
}

/**
 * Extended InitOptions with retry support
 */
export interface InitOptionsV2 {
  cwd?: string;
  budgetMs?: number;
  maxLines?: number;
  depth?: number;
  noScripts?: boolean;
  force?: boolean;
  json?: boolean;
  scan?: boolean;
  verbose?: boolean;
  merge?: boolean;
  signal?: AbortSignal;
  retryCount?: number;
  batchSize?: number;
  root?: string;
}

/**
 * Enhanced InitArtifacts with flexible structure
 */
export interface InitArtifactsV2 {
  claudeMd: string;
  initReportMd: string;
  depMapJson: any;
  initSummaryTxt: string;
  "MARIA.md"?: string;
  "INIT_REPORT.md"?: string;
  "DEPENDENCY_MAP.json"?: string;
  "INIT_SUMMARY.txt"?: string;
  [key: string]: any;
}
