/**
 * SystemCommandAdapter
 *
 * Adapts SystemCommand instances to work with SlashCommandRouter
 * - Enforces contracts via ContractGuard
 * - Provides legacy compatibility
 * - Handles timeout/abort signal integration
 */

import type { Handler } from "../SlashCommandRouter";
import type { HandlerContext } from "../../shared/types/context";
import type { CommandResult } from "../../shared/types/result";
import type { SystemCommandBase } from "../../services/system-commands/base/SystemCommandBase";
import { contractGuard } from "./ContractGuard";

export class SystemCommandAdapter {
  /**
   * Adapt a SystemCommand to SlashCommandRouter Handler interface
   */
  static adaptCommand(command: SystemCommandBase): Handler {
    return async (
      args: string[],
      ctx: HandlerContext,
    ): Promise<CommandResult> => {
      const startMono = performance.now();

      try {
        // Apply timeout from context
        if (ctx.deadline) {
          command.deadlineAt = ctx.deadline;
        }

        // Apply abort signal from context
        if (ctx.signal) {
          command.signal = ctx.signal;
        }

        // Execute the SystemCommand
        const v2Result = await command.execute();

        // Enforce contract (no side effects on original result)
        const guardedResult = contractGuard.enforceContract(v2Result);

        // Convert to legacy CommandResult format
        const legacyResult = SystemCommandAdapter.convertToLegacyFormat(
          guardedResult,
          performance.now() - startMono,
        );

        // Update metrics
        SystemCommandAdapter.updateMetrics(
          performance.now() - startMono,
          false,
        );

        return legacyResult;
      } catch (error) {
        // Handle errors with contract enforcement
        const errorResult = contractGuard.enforceContract({
          endReason: "error",
          error: error.message || "SystemCommand execution failed",
          duration: performance.now() - startMono,
          timestamp: Date.now(),
          monotonicMs: performance.now(),
        });

        // Update metrics for error case
        SystemCommandAdapter.updateMetrics(
          performance.now() - startMono,
          true,
        );

        return SystemCommandAdapter.convertToLegacyFormat(
          errorResult,
          performance.now() - startMono,
        );
      }
    };
  }

  /**
   * Convert CommandResultV2 to legacy CommandResult format
   * Maintains backward compatibility with existing router infrastructure
   */
  private static convertToLegacyFormat(
    v2Result: any,
    totalDurationMs: number,
  ): CommandResult {
    const isSuccess = v2Result.endReason === "success";

    return {
      // Primary fields
      ok: isSuccess,
      message:
        v2Result.error ||
        v2Result.data?.message ||
        v2Result.data?.output ||
        "Command completed",
      requiresInput: false, // Always false for SystemCommand

      // V2 fields
      endReason: v2Result.endReason,
      duration: v2Result.duration,
      timestamp: v2Result.timestamp,

      // Data payload
      data: v2Result.data,
      error: v2Result.error,

      // Legacy compatibility fields
      success: isSuccess,
      _success: isSuccess,
      _message: v2Result.error || v2Result.data?.message || "Command completed",

      // Router metrics
      totalDurationMs,
      monotonicMs: v2Result.monotonicMs,

      // System command metadata
      commandType: "system-v2",
      contractEnforced: true,

      // Additional error context
      ...(v2Result.error && { error: v2Result.error }),
    };
  }

  /**
   * Create a batch adapter for multiple SystemCommand instances
   */
  static adaptCommands(
    commands: Record<string, SystemCommandBase>,
  ): Record<string, Handler> {
    const adapted: Record<string, Handler> = {};

    for (const [name, command] of Object.entries(commands)) {
      adapted[name] = this.adaptCommand(command);
    }

    return adapted;
  }

  /**
   * Validate that a SystemCommand instance is properly configured
   */
  static validateCommand(command: SystemCommandBase): {
    valid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    // Check required properties
    if (!command.name) {
      issues.push("Command must have a name");
    }

    if (!command.category) {
      issues.push("Command must have a category");
    }

    if (!command.description) {
      issues.push("Command must have a description");
    }

    // Check contract compliance
    if (command.requiresInput !== false) {
      issues.push("Command must have requiresInput = false");
    }

    // Check execute method
    if (typeof command.execute !== "function") {
      issues.push("Command must implement execute method");
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  /**
   * Get adapter metrics for monitoring
   */
  static getMetrics(): SystemCommandAdapterMetrics {
    return {
      contractGuardMetrics: contractGuard.getMetrics(),
      totalAdaptions: SystemCommandAdapter.totalAdaptions,
      totalExecutions: SystemCommandAdapter.totalExecutions,
      totalErrors: SystemCommandAdapter.totalErrors,
      avgExecutionMs:
        SystemCommandAdapter.totalExecutionMs /
        Math.max(1, SystemCommandAdapter.totalExecutions),
    };
  }

  // Metrics tracking
  private static totalAdaptions = 0;
  private static totalExecutions = 0;
  private static totalErrors = 0;
  private static totalExecutionMs = 0;

  /**
   * Update adapter metrics
   */
  private static updateMetrics(executionMs: number, hadError: boolean): void {
    this.totalExecutions++;
    this.totalExecutionMs += executionMs;
    if (hadError) this.totalErrors++;
  }
}

export interface SystemCommandAdapterMetrics {
  contractGuardMetrics: any;
  totalAdaptions: number;
  totalExecutions: number;
  totalErrors: number;
  avgExecutionMs: number;
}
