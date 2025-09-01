/**
 * Minimal test suite for internal-mode shim
 * Ensures safe migration to v2
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as shim from "../../index";

describe("Internal Mode Shim Tests", () => {
  let consoleWarnSpy: any;

  beforeEach(() => {
    // Mock console.warn to capture deprecation warnings
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {
      // Implementation pending
    });
    // Reset environment variable
    delete process.env.MARIA_INTERNAL_MODE_SHIM;
    delete process.env.NODE_ENV;
    // Reset global warning flag
    delete (globalThis as any).__maria_internal_mode_warned__;
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  describe("Deprecation Warning", () => {
    it("should show deprecation warning on first use", async () => {
      // Reset module to clear warning state
      vi.resetModules();
      const { _InternalModeUtils } = await import("../index");

      // Trigger any utility function
      try {
        await _InternalModeUtils.resetSystem();
      } catch {
        // Expected to fail, we're just testing the warning
      }

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('DEPRECATED: use "internal-mode-v2"'),
      );
    });

    it("should only show warning once across multiple calls", async () => {
      vi.resetModules();
      const { _InternalModeUtils } = await import("../index");

      // Multiple calls
      try {
        await _InternalModeUtils.resetSystem();
        await _InternalModeUtils.quickRecognize("test");
        await _InternalModeUtils.getCurrentModeDisplay();
      } catch {
        // Expected to fail
      }

      // Warning should only appear once
      const deprecationCalls = consoleWarnSpy.mock.calls.filter((call: any[]) =>
        call[0]?.includes("DEPRECATED"),
      );
      expect(deprecationCalls.length).toBe(1);
    });
  });

  describe("Language Code Normalization", () => {
    it("should use standard language code zh instead of cn", () => {
      expect(shim._SUPPORTED_LANGUAGES).not.toContain("cn");
      expect(shim._SUPPORTED_LANGUAGES).toContain("zh");
    });

    it("should have all expected language codes", () => {
      expect(shim._SUPPORTED_LANGUAGES).toEqual(["en", "ja", "zh", "ko", "vn"]);
    });
  });

  describe("Environment Variable Control", () => {
    it("should block shim when MARIA_INTERNAL_MODE_SHIM=off", async () => {
      process.env.MARIA_INTERNAL_MODE_SHIM = "off";

      expect(shim.isShimDisabled()).toBe(true);

      // All utility functions should throw when shim is disabled
      await expect(shim._InternalModeUtils.initializeSystem()).rejects.toThrow(
        "Shim disabled by MARIA_INTERNAL_MODE_SHIM=off",
      );

      await expect(
        shim._InternalModeUtils.quickRecognize("test"),
      ).rejects.toThrow("Shim disabled by MARIA_INTERNAL_MODE_SHIM=off");

      await expect(
        shim._InternalModeUtils.getCurrentModeDisplay(),
      ).rejects.toThrow("Shim disabled by MARIA_INTERNAL_MODE_SHIM=off");

      await expect(shim._InternalModeUtils.resetSystem()).rejects.toThrow(
        "Shim disabled by MARIA_INTERNAL_MODE_SHIM=off",
      );
    });

    it("should allow shim when environment variable is not set", () => {
      delete process.env.MARIA_INTERNAL_MODE_SHIM;
      expect(shim.isShimDisabled()).toBe(false);
    });
  });

  describe("Type Safety", () => {
    it("should export all required types", () => {
      // Check that types are exported (will fail TypeScript compilation if not)
      const _typeExports: any = shim;

      // These are type exports, so we just check the main exports exist
      expect(typeof shim._InternalModeUtils).toBe("object");
      expect(typeof shim._InternalModeUtils.initializeSystem).toBe("function");
      expect(typeof shim._InternalModeUtils.quickRecognize).toBe("function");
      expect(typeof shim._InternalModeUtils.getCurrentModeDisplay).toBe(
        "function",
      );
      expect(typeof shim._InternalModeUtils.resetSystem).toBe("function");
    });

    it("should have proper async function signatures", () => {
      // Check that functions return promises
      expect(shim._InternalModeUtils.initializeSystem()).toBeInstanceOf(
        Promise,
      );
      expect(shim._InternalModeUtils.quickRecognize("test")).toBeInstanceOf(
        Promise,
      );
      expect(shim._InternalModeUtils.getCurrentModeDisplay()).toBeInstanceOf(
        Promise,
      );
      expect(shim._InternalModeUtils.resetSystem()).toBeInstanceOf(Promise);
    });
  });

  describe("Side Effect Control", () => {
    it("should not output anything on import alone", async () => {
      // Import should not trigger warnings
      delete (globalThis as any).__maria_internal_mode_warned__;
      consoleWarnSpy.mockClear();

      // Just importing should not warn
      await import("../index");

      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it("should suppress warnings in test environment", async () => {
      process.env.NODE_ENV = "test";
      delete (globalThis as any).__maria_internal_mode_warned__;

      try {
        await shim._InternalModeUtils.resetSystem();
      } catch {
        // Expected to fail
      }

      // Should not warn in test environment
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });

  describe("API Safety", () => {
    it("quickRecognize should handle various inputs safely", async () => {
      // Should not throw for valid inputs
      const promise1 = shim._InternalModeUtils.quickRecognize("analyze this");
      const promise2 = shim._InternalModeUtils.quickRecognize("", {});
      const promise3 = shim._InternalModeUtils.quickRecognize(
        "test",
        undefined,
      );

      // All should return promises
      expect(promise1).toBeInstanceOf(Promise);
      expect(promise2).toBeInstanceOf(Promise);
      expect(promise3).toBeInstanceOf(Promise);
    });

    it("getCurrentModeDisplay should support language parameter", async () => {
      const promise1 = shim._InternalModeUtils.getCurrentModeDisplay();
      const promise2 = shim._InternalModeUtils.getCurrentModeDisplay("ja");
      const promise3 = shim._InternalModeUtils.getCurrentModeDisplay("zh");

      // All should return promises
      expect(promise1).toBeInstanceOf(Promise);
      expect(promise2).toBeInstanceOf(Promise);
      expect(promise3).toBeInstanceOf(Promise);
    });
  });

  describe("Backwards Compatibility", () => {
    it("should export all legacy service classes", () => {
      // Check that all legacy exports exist
      expect(shim.InternalModeService).toBeDefined();
      expect(shim.getInternalModeService).toBeDefined();
      expect(shim.resetInternalModeService).toBeDefined();
      expect(shim.ModeDefinitionRegistry).toBeDefined();
      expect(shim.getModeRegistry).toBeDefined();
      expect(shim.resetModeRegistry).toBeDefined();
      expect(shim.ModeRecognitionEngine).toBeDefined();
      expect(shim.ModeDisplayManager).toBeDefined();
      expect(shim.ModeHistoryTracker).toBeDefined();
    });

    it("should export version and config constants", () => {
      expect(shim._INTERNAL_MODE_VERSION).toBe("1.0.0");
      expect(shim._DEFAULT_CONFIG).toBeDefined();
      expect(shim._DEFAULT_CONFIG.confidenceThreshold).toBe(0.85);
      expect(shim._DEFAULT_CONFIG.defaultLanguage).toBe("en");
      expect(shim._DEFAULT_CONFIG.supportedLanguages).toEqual(
        shim._SUPPORTED_LANGUAGES,
      );
    });
  });
});
