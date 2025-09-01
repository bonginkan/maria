/**
 * Command Readiness Contract Types
 * Phase 1: Contract-based READY definition
 * 
 * Defines the contract that all READY commands must satisfy
 */

export interface CommandReadinessContract {
  /**
   * Execution mode support
   */
  executionModes: {
    tty: boolean;        // Works in TTY (interactive terminal) mode
    nonTty: boolean;     // Works in non-TTY mode
    pipe: boolean;       // Works when output is piped
    ci: boolean;         // Works in CI environment
  };
  
  /**
   * Performance requirements
   */
  performance: {
    maxResponseTime: number;  // Maximum response time in ms (default: 2000)
    timeout: number;          // Command timeout in ms (default: 10000)
    memoryLimit?: number;     // Maximum memory usage in MB
  };
  
  /**
   * Output format contract
   */
  output: {
    format: 'CommandResultV2' | 'legacy' | 'mixed';
    requiresInput: boolean;      // Must be false for READY
    endReason: ('success' | 'error' | 'cancelled')[];
    hasCleanOutput: boolean;     // No UI decorations in non-TTY mode
    supportsStreaming?: boolean; // Supports streaming output
  };
  
  /**
   * Dependency requirements
   */
  dependencies: {
    required: DependencyType[];
    optional?: DependencyType[];
    available: boolean;
    blockReason?: BlockReason;
  };
  
  /**
   * Documentation requirements
   */
  documentation: {
    hasHelp: boolean;
    hasExamples: boolean;
    hasDescription: boolean;
    hasUsage: boolean;
  };
  
  /**
   * Error handling
   */
  errorHandling: {
    gracefulFailure: boolean;   // Handles errors without crashing
    informativeErrors: boolean; // Provides helpful error messages
    rollbackCapable?: boolean;  // Can rollback on failure
  };
}

/**
 * Command status classification
 */
export enum CommandStatus {
  READY = 'READY',                   // Fully functional, meets all contracts
  PARTIAL = 'PARTIAL',               // Core features work, some limitations
  BLOCKED = 'BLOCKED',               // Dependencies unavailable
  BROKEN = 'BROKEN',                 // Implementation issues
  DEPRECATED = 'DEPRECATED',         // Scheduled for removal
  EXPERIMENTAL = 'EXPERIMENTAL',     // Under development
  UNKNOWN = 'UNKNOWN'                // Not yet tested
}

/**
 * Dependency types
 */
export type DependencyType = 
  | 'filesystem'
  | 'network'
  | 'api-key'
  | 'provider'
  | 'database'
  | 'git'
  | 'docker'
  | 'npm'
  | 'external-service'
  | string;  // Allow custom dependency types

/**
 * Reasons for blocking
 */
export type BlockReason = 
  | 'missing_api_key'
  | 'service_down'
  | 'not_configured'
  | 'permission_denied'
  | 'network_unavailable'
  | 'dependency_missing'
  | 'version_mismatch';

/**
 * Test result for a single command
 */
export interface CommandTestResult {
  command: string;
  status: CommandStatus;
  contract: Partial<CommandReadinessContract>;
  testsPassed: TestOutcome[];
  testsFailed: TestOutcome[];
  testsSkipped: TestOutcome[];
  metadata: {
    testedAt: string;
    duration: number;
    environment: TestEnvironment;
  };
  issues?: Issue[];
  recommendation?: string;
}

/**
 * Individual test outcome
 */
export interface TestOutcome {
  test: string;
  category: TestCategory;
  passed: boolean;
  duration: number;
  error?: string;
  details?: any;
}

/**
 * Test categories
 */
export type TestCategory = 
  | 'execution'
  | 'performance'
  | 'output'
  | 'dependencies'
  | 'documentation'
  | 'error-handling'
  | 'mode-compatibility';

/**
 * Test environment details
 */
export interface TestEnvironment {
  mode: 'tty' | 'non-tty' | 'pipe' | 'ci';
  platform: NodeJS.Platform;
  nodeVersion: string;
  cwd: string;
  env: Record<string, string | undefined>;
}

/**
 * Issue found during testing
 */
export interface Issue {
  severity: 'critical' | 'major' | 'minor' | 'trivial';
  category: string;
  description: string;
  reproducible: boolean;
  fixEstimate?: string;
}

/**
 * Command inventory entry
 */
export interface CommandInventoryEntry {
  name: string;
  aliases: string[];
  category: string;
  subcategory?: string;
  description?: string;
  filePath: string;
  status: CommandStatus;
  lastTested?: string;
  contract?: Partial<CommandReadinessContract>;
  testResults?: CommandTestResult;
}

/**
 * READY manifest for help system
 */
export interface ReadyManifest {
  version: string;
  generated: string;
  stats: {
    total: number;
    ready: number;
    readyPercentage: number;
    partial: number;
    blocked: number;
    broken: number;
    deprecated: number;
    experimental: number;
    unknown: number;
  };
  commands: ReadyCommand[];
}

/**
 * Ready command entry for help system
 */
export interface ReadyCommand {
  name: string;
  category: string;
  aliases?: string[];
  description: string;
  usage: string;
  examples?: string[];
  status: CommandStatus.READY;
  contract: {
    tty: boolean;
    nonTty: boolean;
    pipe: boolean;
    maxResponseTime: number;
  };
}

/**
 * Contract validation result
 */
export interface ContractValidation {
  valid: boolean;
  violations: ContractViolation[];
  warnings: string[];
}

/**
 * Contract violation details
 */
export interface ContractViolation {
  rule: string;
  expected: any;
  actual: any;
  severity: 'error' | 'warning';
  message: string;
}

/**
 * Type guard for READY status
 */
export function isReady(status: CommandStatus): status is CommandStatus.READY {
  return status === CommandStatus.READY;
}

/**
 * Type guard for blocking statuses
 */
export function isBlocked(status: CommandStatus): boolean {
  return status === CommandStatus.BLOCKED || status === CommandStatus.BROKEN;
}

/**
 * Type guard for CommandResultV2 format
 */
export function isCommandResultV2(result: any): boolean {
  return (
    result &&
    typeof result === 'object' &&
    'endReason' in result &&
    'requiresInput' in result &&
    ('messages' in result || 'output' in result)
  );
}

/**
 * Default READY contract requirements
 */
export const DEFAULT_READY_CONTRACT: CommandReadinessContract = {
  executionModes: {
    tty: true,
    nonTty: true,
    pipe: true,
    ci: true
  },
  performance: {
    maxResponseTime: 2000,
    timeout: 10000
  },
  output: {
    format: 'CommandResultV2',
    requiresInput: false,
    endReason: ['success', 'error', 'cancelled'],
    hasCleanOutput: true
  },
  dependencies: {
    required: [],
    available: true
  },
  documentation: {
    hasHelp: true,
    hasExamples: true,
    hasDescription: true,
    hasUsage: true
  },
  errorHandling: {
    gracefulFailure: true,
    informativeErrors: true
  }
};