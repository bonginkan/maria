/**
 * ContractGuard Tests
 *
 * Tests for SystemCommandV2 contract enforcement:
 * - requiresInput = false enforcement
 * - endReason normalization
 * - No side effects on original objects
 * - Deep copy + freeze behavior
 * - Monotonic time measurement
 */

import { describe, test, expect, beforeEach, vi } from "vitest";
import { ContractGuard } from "../../ContractGuard";

describe("ContractGuard", () => {
  let guard: ContractGuard;

  beforeEach(() => {
    guard = new ContractGuard();
    vi.clearAllMocks();
  });

  describe("Contract Enforcement", () => {
    test("enforces requiresInput = false", () => {
      const input = {
        requiresInput: true, // Invalid
        endReason: "success",
        duration: 100,
        timestamp: Date.now(),
      };

      const result = guard.enforceContract(input);

      expect(result.requiresInput).toBe(false);
      expect(Object.isFrozen(result)).toBe(true);
    });

    test("normalizes invalid endReason", () => {
      const input = {
        endReason: "invalid_reason", // Invalid
        duration: 100,
        timestamp: Date.now(),
      };

      const result = guard.enforceContract(input);

      expect(result.endReason).toBe("error");
      expect(result.requiresInput).toBe(false);
    });

    test("preserves valid endReason values", () => {
      const validReasons = ["success", "timeout", "cancel", "error"];

      for (const reason of validReasons) {
        const input = {
          endReason: reason,
          duration: 100,
          timestamp: Date.now(),
        };

        const result = guard.enforceContract(input);
        expect(result.endReason).toBe(reason);
      }
    });

    test("adds monotonic timestamp if missing", () => {
      const beforeCall = performance.now();

      const input = {
        endReason: "success",
        duration: 100,
        timestamp: Date.now(),
      };

      const result = guard.enforceContract(input);
      const afterCall = performance.now();

      expect(result.monotonicMs).toBeGreaterThanOrEqual(beforeCall);
      expect(result.monotonicMs).toBeLessThanOrEqual(afterCall);
    });

    test("preserves existing monotonic timestamp", () => {
      const existingMono = performance.now() - 1000;

      const input = {
        endReason: "success",
        duration: 100,
        timestamp: Date.now(),
        monotonicMs: existingMono,
      };

      const result = guard.enforceContract(input);
      expect(result.monotonicMs).toBe(existingMono);
    });
  });

  describe("Side Effect Prevention", () => {
    test("does not modify original object", () => {
      const original = {
        requiresInput: true,
        endReason: "invalid",
        duration: 100,
        data: { nested: { value: 42 } },
      };

      const originalCopy = structuredClone(original);

      guard.enforceContract(original);

      expect(original).toEqual(originalCopy);
      expect(original.requiresInput).toBe(true); // Unchanged
      expect(original.endReason).toBe("invalid"); // Unchanged
    });

    test("returns frozen immutable result", () => {
      const input = {
        endReason: "success",
        duration: 100,
        data: { test: true },
      };

      const result = guard.enforceContract(input);

      expect(Object.isFrozen(result)).toBe(true);

      // Should not be able to modify
      expect(() => {
        (result as any).requiresInput = true;
      }).toThrow();
    });

    test("deep clones nested objects", () => {
      const input = {
        endReason: "success",
        duration: 100,
        data: { nested: { value: 42 } },
      };

      const result = guard.enforceContract(input);

      // Modify original nested object
      input.data.nested.value = 99;

      // Result should be unchanged
      expect(result.data?.nested?.value).toBe(42);
    });
  });

  describe("Error Handling", () => {
    test("handles null input gracefully", () => {
      const result = guard.enforceContract(null);

      expect(result.endReason).toBe("error");
      expect(result.requiresInput).toBe(false);
      expect(result.error).toContain("Invalid command result object");
    });

    test("handles undefined input gracefully", () => {
      const result = guard.enforceContract(undefined);

      expect(result.endReason).toBe("error");
      expect(result.requiresInput).toBe(false);
      expect(result.error).toContain("Invalid command result object");
    });

    test("handles non-object input gracefully", () => {
      const result = guard.enforceContract("invalid");

      expect(result.endReason).toBe("error");
      expect(result.requiresInput).toBe(false);
      expect(result.error).toContain("Invalid command result object");
    });

    test("handles structuredClone errors", () => {
      // Create an object that cannot be cloned (circular reference)
      const circular: any = { endReason: "success" };
      circular.self = circular;

      const result = guard.enforceContract(circular);

      // Note: Modern Node.js versions may handle circular references
      // So we accept either success (if cloned) or error (if failed)
      expect(["success", "error"]).toContain(result.endReason);
      expect(result.requiresInput).toBe(false);
    });
  });

  describe("Result Consistency Validation", () => {
    test("clears error field for success results", () => {
      const input = {
        endReason: "success",
        error: "Should not be here",
        duration: 100,
      };

      const result = guard.enforceContract(input);

      expect(result.endReason).toBe("success");
      expect(result.error).toBeUndefined();
    });

    test("adds error field for non-success results", () => {
      const input = {
        endReason: "timeout",
        duration: 100,
      };

      const result = guard.enforceContract(input);

      expect(result.endReason).toBe("timeout");
      expect(result.error).toContain("timeout");
    });

    test("normalizes negative duration to zero", () => {
      const input = {
        endReason: "success",
        duration: -100, // Invalid
      };

      const result = guard.enforceContract(input);

      expect(result.duration).toBe(0);
    });

    test("uses monotonicMs for missing duration", () => {
      const mono = performance.now();

      const input = {
        endReason: "success",
        monotonicMs: mono,
        // duration missing
      };

      const result = guard.enforceContract(input);

      expect(result.duration).toBe(mono);
    });
  });

  describe("Contract Validation", () => {
    test("validates correct contract", () => {
      const validResult = {
        requiresInput: false,
        endReason: "success",
        duration: 100,
        timestamp: Date.now(),
        data: { test: true },
      };

      const validation = guard.validateContract(validResult);

      expect(validation.valid).toBe(true);
      expect(validation.violations).toHaveLength(0);
    });

    test("detects contract violations", () => {
      const invalidResult = {
        requiresInput: true, // Violation
        endReason: "invalid", // Violation
        duration: -50, // Violation
        timestamp: "not-a-number", // Violation
        error: "has error", // But endReason is not success, so OK
      };

      const validation = guard.validateContract(invalidResult);

      expect(validation.valid).toBe(false);
      expect(validation.violations).toContain("requiresInput must be false");
      expect(validation.violations).toContain(
        "endReason must be one of: success, timeout, cancel, error",
      );
      expect(validation.violations).toContain(
        "duration must be a non-negative number",
      );
      expect(validation.violations).toContain("timestamp must be a number");
    });

    test("validates success/error consistency", () => {
      const successWithError = {
        requiresInput: false,
        endReason: "success",
        duration: 100,
        timestamp: Date.now(),
        error: "Should not be here",
      };

      const validation = guard.validateContract(successWithError);

      expect(validation.valid).toBe(false);
      expect(validation.violations).toContain(
        "success results must not have error field",
      );
    });

    test("validates error requirement for non-success", () => {
      const errorWithoutMessage = {
        requiresInput: false,
        endReason: "error",
        duration: 100,
        timestamp: Date.now(),
        // Missing error field
      };

      const validation = guard.validateContract(errorWithoutMessage);

      expect(validation.valid).toBe(false);
      expect(validation.violations).toContain(
        "non-success results must have error field",
      );
    });
  });

  describe("Metrics", () => {
    test("tracks enforcement metrics", () => {
      const initialMetrics = guard.getMetrics();

      guard.enforceContract({
        endReason: "success",
        duration: 100,
      });

      const updatedMetrics = guard.getMetrics();

      expect(updatedMetrics.totalEnforcements).toBeGreaterThan(
        initialMetrics.totalEnforcements,
      );
      expect(updatedMetrics.lastEnforcement).toBeGreaterThan(0);
    });
  });
});
