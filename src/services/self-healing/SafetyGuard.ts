/**
 * Safety Guard
 * Enforces safety constraints and limits for self-healing operations
 */

import { logger } from "../../utils/logger";
import { FixAction, HealingPlan } from "./types";

export interface SafetyConstraints {
  maxExecutionTime: number; // Maximum time for entire plan (ms)
  maxActionTime: number; // Maximum time per action (ms)
  maxRetries: number; // Maximum retry attempts per action
  maxFileOperations: number; // Maximum file operations per plan
  maxShellCommands: number; // Maximum shell commands per plan
  maxCacheOperations: number; // Maximum cache operations per plan
  allowedPaths: string[]; // Allowed path prefixes
  blockedPaths: string[]; // Blocked path prefixes
  maxRiskScore: number; // Maximum allowed risk score
}

export const DEFAULT_SAFETY_CONSTRAINTS: SafetyConstraints = {
  maxExecutionTime: 300000, // 5 minutes
  maxActionTime: 60000, // 1 minute per action
  maxRetries: 3,
  maxFileOperations: 20,
  maxShellCommands: 5,
  maxCacheOperations: 10,
  allowedPaths: [process.cwd(), require("os").homedir() + "/.maria"],
  blockedPaths: [
    "/etc",
    "/usr",
    "/bin",
    "/sbin",
    "/var",
    "/System",
    "/Applications",
  ],
  maxRiskScore: 0.3, // Only low-medium risk operations
};

export class SafetyGuard {
  private constraints: SafetyConstraints;
  private startTime?: number;
  private actionCounts: Map<string, number> = new Map();

  constructor(constraints: Partial<SafetyConstraints> = {}) {
    this.constraints = { ...DEFAULT_SAFETY_CONSTRAINTS, ...constraints };
  }

  /**
   * Validate a healing plan before execution
   */
  validatePlan(plan: HealingPlan): { valid: boolean; violations: string[] } {
    const violations: string[] = [];

    // Check overall risk score
    if (plan.risk.score > this.constraints.maxRiskScore) {
      violations.push(
        `Plan risk score ${plan.risk.score} exceeds maximum ${this.constraints.maxRiskScore}`,
      );
    }

    // Count action types
    const actionCounts = this.countActionTypes(plan.actions);

    if (actionCounts.file > this.constraints.maxFileOperations) {
      violations.push(
        `Plan has ${actionCounts.file} file operations, exceeds limit of ${this.constraints.maxFileOperations}`,
      );
    }

    if (actionCounts.shell > this.constraints.maxShellCommands) {
      violations.push(
        `Plan has ${actionCounts.shell} shell commands, exceeds limit of ${this.constraints.maxShellCommands}`,
      );
    }

    if (actionCounts.cache > this.constraints.maxCacheOperations) {
      violations.push(
        `Plan has ${actionCounts.cache} cache operations, exceeds limit of ${this.constraints.maxCacheOperations}`,
      );
    }

    // Validate paths in actions
    const pathViolations = this.validateActionPaths(plan.actions);
    violations.push(...pathViolations);

    return {
      valid: violations.length === 0,
      violations,
    };
  }

  /**
   * Validate an individual action before execution
   */
  validateAction(action: FixAction): { valid: boolean; violations: string[] } {
    const violations: string[] = [];
    const [category] = action.type.split(":");

    // Check if we've exceeded action limits
    const currentCount = this.actionCounts.get(category) || 0;
    const limit = this.getActionLimit(category);

    if (currentCount >= limit) {
      violations.push(`Exceeded ${category} action limit of ${limit}`);
    }

    // Validate paths if action involves file operations
    if (action.args.path) {
      const pathValid = this.validatePath(action.args.path);
      if (!pathValid) {
        violations.push(`Invalid path: ${action.args.path}`);
      }
    }

    if (action.args.paths && Array.isArray(action.args.paths)) {
      for (const path of action.args.paths) {
        if (!this.validatePath(path)) {
          violations.push(`Invalid path: ${path}`);
        }
      }
    }

    return {
      valid: violations.length === 0,
      violations,
    };
  }

  /**
   * Start tracking execution time
   */
  startExecution(): void {
    this.startTime = Date.now();
    this.actionCounts.clear();
    logger.debug("SafetyGuard: Started execution tracking");
  }

  /**
   * Record action execution
   */
  recordAction(action: FixAction): void {
    const [category] = action.type.split(":");
    const currentCount = this.actionCounts.get(category) || 0;
    this.actionCounts.set(category, currentCount + 1);
  }

  /**
   * Check if execution time limit is exceeded
   */
  isTimeoutExceeded(): boolean {
    if (!this.startTime) return false;
    return Date.now() - this.startTime > this.constraints.maxExecutionTime;
  }

  /**
   * Get remaining execution time
   */
  getRemainingTime(): number {
    if (!this.startTime) return this.constraints.maxExecutionTime;
    const elapsed = Date.now() - this.startTime;
    return Math.max(0, this.constraints.maxExecutionTime - elapsed);
  }

  /**
   * Get action timeout for individual action
   */
  getActionTimeout(): number {
    return Math.min(this.constraints.maxActionTime, this.getRemainingTime());
  }

  /**
   * Check if retry is allowed for action
   */
  canRetry(action: FixAction, attempts: number): boolean {
    return attempts < this.constraints.maxRetries;
  }

  /**
   * Validate file path against allowed/blocked lists
   */
  private validatePath(filePath: string): boolean {
    const path = require("path");
    const resolvedPath = path.resolve(filePath);

    // Check blocked paths first
    for (const blockedPath of this.constraints.blockedPaths) {
      if (resolvedPath.startsWith(path.resolve(blockedPath))) {
        return false;
      }
    }

    // Check allowed paths
    for (const allowedPath of this.constraints.allowedPaths) {
      if (resolvedPath.startsWith(path.resolve(allowedPath))) {
        return true;
      }
    }

    return false;
  }

  /**
   * Count actions by type in plan
   */
  private countActionTypes(actions: FixAction[]): Record<string, number> {
    const counts = { file: 0, shell: 0, cache: 0, config: 0, model: 0 };

    for (const action of actions) {
      const [category] = action.type.split(":");
      if (category in counts) {
        (counts as any)[category]++;
      }
    }

    return counts;
  }

  /**
   * Validate paths in all actions
   */
  private validateActionPaths(actions: FixAction[]): string[] {
    const violations: string[] = [];

    for (const action of actions) {
      if (action.args.path && !this.validatePath(action.args.path)) {
        violations.push(`Invalid path in ${action.type}: ${action.args.path}`);
      }

      if (action.args.paths && Array.isArray(action.args.paths)) {
        for (const path of action.args.paths) {
          if (!this.validatePath(path)) {
            violations.push(`Invalid path in ${action.type}: ${path}`);
          }
        }
      }

      if (
        action.args.configPath &&
        !this.validatePath(action.args.configPath)
      ) {
        violations.push(
          `Invalid config path in ${action.type}: ${action.args.configPath}`,
        );
      }

      if (
        action.args.backupPath &&
        !this.validatePath(action.args.backupPath)
      ) {
        violations.push(
          `Invalid backup path in ${action.type}: ${action.args.backupPath}`,
        );
      }
    }

    return violations;
  }

  /**
   * Get action limit by category
   */
  private getActionLimit(category: string): number {
    switch (category) {
      case "file":
        return this.constraints.maxFileOperations;
      case "shell":
        return this.constraints.maxShellCommands;
      case "cache":
        return this.constraints.maxCacheOperations;
      default:
        return 10; // Default limit
    }
  }

  /**
   * Get current execution statistics
   */
  getExecutionStats(): {
    elapsedTime: number;
    remainingTime: number;
    actionCounts: Record<string, number>;
    isTimedOut: boolean;
  } {
    return {
      elapsedTime: this.startTime ? Date.now() - this.startTime : 0,
      remainingTime: this.getRemainingTime(),
      actionCounts: Object.fromEntries(this.actionCounts),
      isTimedOut: this.isTimeoutExceeded(),
    };
  }

  /**
   * Reset safety guard for new execution
   */
  reset(): void {
    this.startTime = undefined;
    this.actionCounts.clear();
    logger.debug("SafetyGuard: Reset for new execution");
  }
}
