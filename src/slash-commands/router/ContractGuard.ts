/**
 * ContractGuard - System Commands V2 Contract Enforcement
 *
 * Enforces immutable contracts for SystemCommand:
 * - requiresInput: false (physical enforcement)
 * - endReason: valid values only
 * - No side effects on original objects
 * - Deep copy + freeze pattern
 * - Monotonic time measurement
 */

import type { CommandResultV2 } from "../../services/system-commands/contracts/SystemCommandContract";

export class ContractGuard {
  private readonly frozenDefaults = Object.freeze({
    requiresInput: false as const,
    endReason: "success" as const,
  });

  private readonly validEndReasons = Object.freeze([
    "success",
    "timeout",
    "cancel",
    "error",
  ] as const);

  /**
   * Enforce SystemCommand contract without side effects
   * Uses deep copy + freeze pattern to prevent state mutation
   */
  enforceContract(result: any): CommandResultV2 {
    // Update metrics
    const startTime = Date.now();
    let hadViolations = false;
    let hadErrors = false;

    try {
      // Validate input
      if (!result || typeof result !== "object") {
        hadErrors = true;
        this.updateMetrics(hadViolations, hadErrors);
        return this.createErrorResult("Invalid command result object");
      }

      // Deep copy to prevent side effects on original object
      let safeResult;
      try {
        safeResult = structuredClone(result);
      } catch (cloneError) {
        // Handle circular references or non-cloneable objects
        hadErrors = true;
        this.updateMetrics(hadViolations, hadErrors);
        return this.createErrorResult(
          `Contract enforcement failed: ${cloneError.message}`,
        );
      }

      // Check for violations
      if (safeResult.requiresInput !== false) hadViolations = true;
      if (!this.validEndReasons.includes(safeResult.endReason))
        hadViolations = true;

      // Apply immutable contract defaults
      safeResult.requiresInput = this.frozenDefaults.requiresInput;

      // Normalize endReason
      if (!this.validEndReasons.includes(safeResult.endReason)) {
        console.warn(
          `Invalid endReason: ${safeResult.endReason}, normalizing to 'error'`,
        );
        safeResult.endReason = "error";
      }

      // Ensure duration is set (monotonic time measurement)
      if (typeof safeResult.duration !== "number" || safeResult.duration < 0) {
        safeResult.duration = safeResult.monotonicMs || 0;
      }

      // Add monotonic timestamp if missing
      if (!safeResult.monotonicMs) {
        safeResult.monotonicMs = performance.now();
      }

      // Ensure timestamp is set
      if (!safeResult.timestamp) {
        safeResult.timestamp = Date.now();
      }

      // Validate result consistency
      this.validateResultConsistency(safeResult);

      // Update metrics
      this.updateMetrics(hadViolations, hadErrors);

      // Freeze and return immutable result
      return Object.freeze(safeResult) as CommandResultV2;
    } catch (error) {
      console.error("ContractGuard enforcement failed:", error);
      hadErrors = true;
      this.updateMetrics(hadViolations, hadErrors);
      return this.createErrorResult(
        `Contract enforcement failed: ${error.message}`,
      );
    }
  }

  /**
   * Create a compliant error result
   */
  private createErrorResult(message: string): CommandResultV2 {
    const monotonicMs = performance.now();

    return Object.freeze({
      requiresInput: false,
      endReason: "error" as const,
      error: message,
      duration: 0,
      timestamp: Date.now(),
      monotonicMs,
    });
  }

  /**
   * Validate internal result consistency
   */
  private validateResultConsistency(result: any): void {
    // Success validation
    if (result.endReason === "success" && result.error) {
      console.warn(
        "Result marked as success but has error field, clearing error",
      );
      delete result.error;
    }

    // Error validation
    if (result.endReason !== "success" && !result.error) {
      result.error = `Command ended with reason: ${result.endReason}`;
    }

    // Duration validation
    if (result.duration < 0) {
      console.warn("Negative duration detected, normalizing to 0");
      result.duration = 0;
    }
  }

  /**
   * Validate that a result object conforms to SystemCommand contract
   * Used for testing and verification
   */
  validateContract(result: any): { valid: boolean; violations: string[] } {
    const violations: string[] = [];

    if (result.requiresInput !== false) {
      violations.push("requiresInput must be false");
    }

    if (!this.validEndReasons.includes(result.endReason)) {
      violations.push(
        `endReason must be one of: ${this.validEndReasons.join(", ")}`,
      );
    }

    if (typeof result.duration !== "number" || result.duration < 0) {
      violations.push("duration must be a non-negative number");
    }

    if (typeof result.timestamp !== "number") {
      violations.push("timestamp must be a number");
    }

    if (result.endReason === "success" && result.error) {
      violations.push("success results must not have error field");
    }

    if (result.endReason !== "success" && !result.error) {
      violations.push("non-success results must have error field");
    }

    return {
      valid: violations.length === 0,
      violations,
    };
  }

  /**
   * Get contract enforcement metrics
   */
  getMetrics(): ContractMetrics {
    return {
      totalEnforcements: this.totalEnforcements,
      violationsFixed: this.violationsFixed,
      errorsHandled: this.errorsHandled,
      lastEnforcement: this.lastEnforcement,
    };
  }

  // Metrics tracking
  private totalEnforcements = 0;
  private violationsFixed = 0;
  private errorsHandled = 0;
  private lastEnforcement = 0;

  /**
   * Update metrics (called during enforcement)
   */
  private updateMetrics(hadViolations: boolean, hadErrors: boolean): void {
    this.totalEnforcements++;
    if (hadViolations) this.violationsFixed++;
    if (hadErrors) this.errorsHandled++;
    this.lastEnforcement = Date.now();
  }
}

export interface ContractMetrics {
  totalEnforcements: number;
  violationsFixed: number;
  errorsHandled: number;
  lastEnforcement: number;
}

// Export singleton instance for consistent usage
export const contractGuard = new ContractGuard();
