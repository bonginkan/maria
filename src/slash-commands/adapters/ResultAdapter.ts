import { z } from "zod";
import {
  _CommandResult,
  CommandResultSchema,
  ErrorCode,
} from "../types/command.types";

export type LegacyResult = {
  _success?: boolean;
  _message?: string;
  _data?: unknown;
  component?: string;
  // Handle mixed format keys
  success?: boolean;
  message?: string;
  data?: unknown;
};

export type NormalizedResult = {
  success: boolean;
  message: string;
  data?: unknown;
  component?: string;
  error?: string;
  metadata?: Record<string, unknown>;
};

/**
 * ResultAdapter: Normalizes and validates command results
 * Provides backward compatibility with legacy result formats
 */
export class ResultAdapter {
  /**
   * Normalize any result-like object to NormalizedResult
   * Handles both new and legacy formats with runtime validation
   */
  static normalize(result: unknown): NormalizedResult {
    try {
      // First, try to parse as a standard CommandResult
      if (result && typeof result === "object") {
        // Check if it's already a valid CommandResult
        if ("success" in result && "message" in result) {
          try {
            return CommandResultSchema.parse(result);
          } catch {
            // Fall through to legacy handling
          }
        }

        // Handle legacy format
        const normalized = this.normalizeLegacy(result);
        return CommandResultSchema.parse(normalized);
      }

      // Handle non-object results
      return this.createErrorResult(
        "Invalid command result format",
        ErrorCode.INTERNAL_ERROR,
        { originalResult: result },
      );
    } catch (error) {
      // Fallback for any parsing errors
      return this.createErrorResult(
        "Failed to normalize command result",
        ErrorCode.INTERNAL_ERROR,
        { error: error instanceof Error ? error.message : String(error) },
      );
    }
  }

  /**
   * Convert legacy format to standard format
   */
  private static normalizeLegacy(result: any): NormalizedResult {
    // Extract the main data content
    let data: unknown = undefined;

    // Check for various data field patterns
    if ("data" in result && result.data !== undefined) {
      data = result.data;
    } else if ("_data" in result && result._data !== undefined) {
      data = result._data;
    } else if ("args" in result && result.args !== undefined) {
      // Include args as part of data
      data = { args: result.args };
    } else {
      // Collect any extra fields as data
      const { success, _success, message, _message, component, ...rest } =
        result;
      if (Object.keys(rest).length > 0) {
        data = rest;
      }
    }

    return {
      success: Boolean(result.success ?? result._success ?? true),
      message: String(result.message ?? result._message ?? ""),
      ...(data !== undefined && { data }),
      ...(result.component && { component: result.component }),
    };
  }

  /**
   * Create a standard success result
   */
  static createSuccess(
    message: string,
    data?: any,
    metadata?: Record<string, any>,
  ): NormalizedResult {
    return {
      success: true,
      message,
      ...(data !== undefined && { data }),
      ...(metadata && { metadata }),
    };
  }

  /**
   * Create a standard error result
   */
  static createErrorResult(
    message: string,
    code?: ErrorCode,
    details?: any,
  ): NormalizedResult {
    return {
      success: false,
      message,
      error: code || ErrorCode.INTERNAL_ERROR,
      ...(details && { data: details }),
    };
  }

  /**
   * Type guard: check if result is normalized
   */
  static isNormalized(x: any): x is NormalizedResult {
    return (
      x &&
      typeof x === "object" &&
      typeof x.success === "boolean" &&
      typeof x.message === "string"
    );
  }

  /**
   * Validate and return errors if invalid
   */
  static validate(result: any): { valid: boolean; errors?: z.ZodError } {
    try {
      CommandResultSchema.parse(result);
      return { valid: true };
    } catch (innerError) {
      if (error instanceof z.ZodError) {
        return { valid: false, errors: error };
      }
      return { valid: false };
    }
  }

  /**
   * Normalize multiple results
   */
  static normalizeAll(items: unknown[]): NormalizedResult[] {
    return items.map(ResultAdapter.normalize);
  }

  /**
   * Merge multiple results (for batch operations)
   */
  static merge(results: NormalizedResult[]): NormalizedResult {
    if (results.length === 0) {
      return this.createSuccess("No results to merge");
    }

    const allSuccess = results.every((r) => r.success);
    const messages = results.map((r) => r.message).filter(Boolean);
    const data = results.filter((r) => r.data !== undefined).map((r) => r.data);

    return {
      success: allSuccess,
      message: messages.join("\n"),
      ...(data.length > 0 && { data }),
    };
  }

  /**
   * Convert NormalizedResult to legacy format (for backward compatibility)
   */
  static toLegacy(result: NormalizedResult): LegacyResult {
    return {
      _success: result.success,
      _message: result.message,
      success: result.success,
      message: result.message,
      ...(result.data !== undefined && {
        data: result.data,
        _data: result.data,
      }),
      ...(result.component && { component: result.component }),
    };
  }
}

/**
 * Helper function for existing code migration
 */
export function normalizeResult(r: unknown): NormalizedResult {
  return ResultAdapter.normalize(r);
}
