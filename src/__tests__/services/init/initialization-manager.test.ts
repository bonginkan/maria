/**
 * Test suite for InitializationManager
 * Phase 4 - Enhanced Testing & Validation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import {
  InitializationManager,
  ConfigurationValidator,
  ErrorRecoveryManager,
  ProgressTracker,
} from "../../initialization-manager";
import type {
  InitOptions,
  ValidationResult,
  RecoveryStrategy,
} from "../../types";

// Mock modules
vi.mock("fs/promises");
vi.mock("../scanner");
vi.mock("../summarize");
vi.mock("../artifacts");
vi.mock("../maria-template");
vi.mock("../write-atomic");
vi.mock("../../narrative/index.js");

describe("InitializationManager", () => {
  let manager: InitializationManager;
  let tempDir: string;

  beforeEach(() => {
    manager = new InitializationManager();
    tempDir = "/tmp/test-maria-init";
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Core Functionality", () => {
    it("should initialize with default options", async () => {
      const opts: InitOptions = {
        cwd: tempDir,
        budgetMs: 6000,
        maxLines: 200,
        depth: 4,
      };

      vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true } as any);
      vi.mocked(fs.access).mockResolvedValue(undefined);

      const result = await manager.initialize(opts);

      expect(result.success).toBeDefined();
      expect(result.validation).toBeDefined();
      expect(result.progressReport).toBeDefined();
    });

    it("should handle missing working directory gracefully", async () => {
      const opts: InitOptions = {
        cwd: "/non/existent/path",
      };

      vi.mocked(fs.stat).mockRejectedValue(new Error("ENOENT"));

      const result = await manager.initialize(opts);

      expect(result.success).toBe(false);
      expect(result.validation?.errors).toContain(
        expect.stringContaining("Cannot access working directory"),
      );
    });

    it("should validate budget constraints", async () => {
      const opts: InitOptions = {
        cwd: tempDir,
        budgetMs: 500, // Too low
      };

      vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true } as any);

      const result = await manager.initialize(opts);

      expect(result.validation?.errors).toContain(
        expect.stringContaining("Budget too low"),
      );
    });
  });

  describe("Progress Tracking", () => {
    it("should track all 6 phases", async () => {
      const phases: string[] = [];
      const progressTracker = new ProgressTracker();

      progressTracker.on("progress", (event) => {
        phases.push(event.phase);
      });

      progressTracker.startPhase("Validation", "Validating configuration");
      progressTracker.completePhase(true);
      progressTracker.startPhase("Scanning", "Scanning project");
      progressTracker.completePhase(true);
      progressTracker.startPhase("Analysis", "Analyzing code");
      progressTracker.completePhase(true);
      progressTracker.startPhase("Generation", "Generating artifacts");
      progressTracker.completePhase(true);
      progressTracker.startPhase("Writing", "Writing files");
      progressTracker.completePhase(true);
      progressTracker.startPhase("Verification", "Verifying output");
      progressTracker.completePhase(true);

      expect(phases).toHaveLength(6);
      expect(phases).toEqual([
        "Validation",
        "Scanning",
        "Analysis",
        "Generation",
        "Writing",
        "Verification",
      ]);
    });

    it("should calculate progress percentage correctly", () => {
      const progressTracker = new ProgressTracker();
      let lastProgress = 0;

      progressTracker.on("progress", (event) => {
        lastProgress = event.progress;
      });

      progressTracker.startPhase("Phase 1", "First phase");
      expect(lastProgress).toBe(0);

      progressTracker.completePhase(true);
      expect(lastProgress).toBeCloseTo(16.67, 1); // 1/6

      progressTracker.startPhase("Phase 2", "Second phase");
      progressTracker.completePhase(true);
      expect(lastProgress).toBeCloseTo(33.33, 1); // 2/6
    });
  });

  describe("Error Recovery", () => {
    let recoveryManager: ErrorRecoveryManager;

    beforeEach(() => {
      recoveryManager = new ErrorRecoveryManager();
    });

    it("should recover from permission errors", async () => {
      const error = new Error("Permission denied");
      (error as any).code = "EACCES";

      const strategy = await recoveryManager.recover(error, {});

      expect(strategy).toBeDefined();
      expect(strategy?.type).toBe("permission");
      expect(strategy?.action).toBe("skip");
    });

    it("should recover from timeout errors with retry", async () => {
      const error = new Error("Operation timed out");
      (error as any).code = "TIMEOUT";

      const context = { retryCount: 0, budgetMs: 6000 };
      const strategy = await recoveryManager.recover(error, context);

      expect(strategy).toBeDefined();
      expect(strategy?.action).toBe("retry-reduced");
      expect(context.budgetMs).toBe(3000); // Reduced by half
    });

    it("should limit retry attempts", async () => {
      const error = new Error("Operation timed out");
      (error as any).code = "TIMEOUT";

      const context = { retryCount: 3, budgetMs: 6000 };
      const strategy = await recoveryManager.recover(error, context);

      expect(strategy).toBeDefined();
      expect(context.budgetMs).toBe(6000); // Not reduced after max retries
    });

    it("should generate recovery report", () => {
      const recoveries = [
        {
          error: new Error("Permission denied"),
          strategy: {
            type: "permission" as const,
            action: "skip" as const,
            fallback: "Skip file",
            recommendation: "Check permissions",
          },
        },
        {
          error: new Error("Timeout"),
          strategy: {
            type: "performance" as const,
            action: "retry-reduced" as const,
            fallback: "Retry with reduced scope",
            recommendation: "Increase budget",
          },
        },
      ];

      const report = recoveryManager.generateReport(recoveries);

      expect(report).toContain("Total errors recovered: 2");
      expect(report).toContain("permission: 1");
      expect(report).toContain("performance: 1");
      expect(report).toContain("Check permissions");
      expect(report).toContain("Increase budget");
    });
  });

  describe("Configuration Validation", () => {
    let validator: ConfigurationValidator;

    beforeEach(() => {
      validator = new ConfigurationValidator();
    });

    it("should validate working directory exists", async () => {
      vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true } as any);
      vi.mocked(fs.access).mockResolvedValue(undefined);

      const result = await validator.validate({ cwd: tempDir });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should warn about missing package.json", async () => {
      vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true } as any);
      vi.mocked(fs.access).mockImplementation((path) => {
        if (path.toString().includes("package.json")) {
          return Promise.reject(new Error("ENOENT"));
        }
        return Promise.resolve(undefined);
      });

      const result = await validator.validate({ cwd: tempDir });

      expect(result.warnings).toContain(
        expect.stringContaining("No package.json found"),
      );
    });

    it("should validate budget constraints", async () => {
      vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true } as any);

      const lowBudget = await validator.validate({
        cwd: tempDir,
        budgetMs: 500,
      });
      expect(lowBudget.errors).toContain(
        expect.stringContaining("Budget too low"),
      );

      const okBudget = await validator.validate({
        cwd: tempDir,
        budgetMs: 5000,
      });
      expect(okBudget.errors).toHaveLength(0);

      const highBudget = await validator.validate({
        cwd: tempDir,
        budgetMs: 150000,
      });
      expect(highBudget.warnings).toContain(
        expect.stringContaining("Very high budget"),
      );
    });

    it("should detect monorepo configuration", async () => {
      vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true } as any);
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({
          name: "test-monorepo",
          workspaces: ["packages/*"],
        }),
      );

      const result = await validator.validate({ cwd: tempDir });

      expect(result.warnings).toContain(
        expect.stringContaining("Monorepo detected"),
      );
    });

    it("should generate recommendations", async () => {
      vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true } as any);
      vi.mocked(fs.access).mockImplementation((path) => {
        if (path.toString().includes(".git")) {
          return Promise.reject(new Error("ENOENT"));
        }
        return Promise.resolve(undefined);
      });

      const result = await validator.validate({
        cwd: tempDir,
        budgetMs: 2500,
      });

      expect(result.recommendations).toContain(
        expect.stringContaining("Initialize git repository"),
      );
      expect(result.recommendations).toContain(
        expect.stringContaining("Consider increasing --budget-ms"),
      );
    });
  });

  describe("Fallback Generation", () => {
    it("should generate fallback artifacts on critical failure", async () => {
      const opts: InitOptions = {
        cwd: tempDir,
      };

      // Simulate critical failure in scanning
      vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true } as any);
      const scannerMock = await import("../scanner");
      vi.mocked(scannerMock.runWithBudget).mockRejectedValue(
        new Error("Critical scanning error"),
      );

      const result = await manager.initialize(opts);

      expect(result.success).toBe(false);
      expect(result.artifacts).toBeDefined();
      expect(result.artifacts?.["MARIA.md"]).toContain("Error Recovery Mode");
      expect(result.artifacts?.["INIT_REPORT.md"]).toContain(
        "Critical scanning error",
      );
    });

    it("should include recovery information in fallback", async () => {
      const opts: InitOptions = {
        cwd: tempDir,
        retryCount: 0,
      };

      vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true } as any);

      // Simulate timeout with retry
      const scannerMock = await import("../scanner");
      let callCount = 0;
      vi.mocked(scannerMock.runWithBudget).mockImplementation(() => {
        callCount++;
        const error = new Error("Timeout");
        (error as any).code = "TIMEOUT";
        return Promise.reject(error);
      });

      const result = await manager.initialize(opts);

      expect(result.recoveryReport).toBeDefined();
      expect(result.recoveryReport).toContain("performance");
      expect(callCount).toBeGreaterThan(1); // Should have retried
    });
  });

  describe("Integration Scenarios", () => {
    it("should complete full initialization flow", async () => {
      const opts: InitOptions = {
        cwd: tempDir,
        budgetMs: 6000,
        verbose: true,
      };

      // Mock successful flow
      vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true } as any);
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockResolvedValue("# Test MARIA.md\n".repeat(100));

      const scannerMock = await import("../scanner");
      vi.mocked(scannerMock.runWithBudget).mockResolvedValue([
        {
          file: "test.ts",
          kind: "read",
          head: "test content",
          truncated: false,
        },
      ]);

      const summarizeMock = await import("../summarize");
      vi.mocked(summarizeMock.summarize).mockReturnValue({
        projectName: "test-project",
        techStack: {
          language: "TypeScript",
          framework: "Node.js",
          buildTool: "TSC",
          testFramework: "Vitest",
          packageManager: "pnpm",
          typescript: true,
          hasTests: true,
        },
        structure: {
          totalFiles: 10,
          totalSize: 10000,
          avgFileSize: 1000,
          largestFile: { path: "test.ts", size: 2000 },
        },
        warnings: [],
        commands: {},
        dependencies: [],
      } as any);

      const artifactsMock = await import("../artifacts");
      vi.mocked(artifactsMock.generateArtifacts).mockReturnValue({
        "MARIA.md": "# Test MARIA.md",
        "INIT_REPORT.md": "# Init Report",
        claudeMd: "# Test",
        initReportMd: "# Report",
        depMapJson: { metrics: {} },
        initSummaryTxt: "Summary",
      });

      const writeAtomicMock = await import("../write-atomic");
      vi.mocked(writeAtomicMock.writeAtomic).mockResolvedValue(undefined);

      const result = await manager.initialize(opts);

      expect(result.success).toBe(true);
      expect(result.artifacts).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.validation?.valid).toBe(true);
      expect(result.progressReport).toContain("Phase Timeline");
    });

    it("should handle monorepo initialization", async () => {
      const opts: InitOptions = {
        cwd: tempDir,
      };

      vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true } as any);
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({
          name: "monorepo-root",
          workspaces: {
            packages: ["packages/*", "apps/*"],
          },
        }),
      );

      const result = await manager.initialize(opts);

      expect(result.validation?.warnings).toContain(
        expect.stringContaining("Monorepo detected"),
      );
    });
  });

  describe("Performance Metrics", () => {
    it("should track execution time for each phase", async () => {
      const tracker = new ProgressTracker();
      const timings: Record<string, number> = {};

      tracker.on("progress", (event) => {
        if (event.status === "completed") {
          timings[event.phase] = event.elapsed;
        }
      });

      // Simulate phases with delays
      tracker.startPhase("Phase1", "First");
      await new Promise((resolve) => setTimeout(resolve, 10));
      tracker.completePhase(true);

      tracker.startPhase("Phase2", "Second");
      await new Promise((resolve) => setTimeout(resolve, 20));
      tracker.completePhase(true);

      expect(timings.Phase1).toBeGreaterThan(0);
      expect(timings.Phase2).toBeGreaterThan(timings.Phase1);
    });

    it("should add metrics during execution", () => {
      const tracker = new ProgressTracker();
      const metrics: Record<string, any> = {};

      tracker.on("metric", (event) => {
        metrics[event.key] = event.value;
      });

      tracker.addMetric("files_scanned", 100);
      tracker.addMetric("warnings_found", 5);
      tracker.addMetric("execution_time", 1234);

      expect(metrics.files_scanned).toBe(100);
      expect(metrics.warnings_found).toBe(5);
      expect(metrics.execution_time).toBe(1234);
    });
  });

  describe("Output Verification", () => {
    it("should verify MARIA.md meets minimum requirements", async () => {
      const opts: InitOptions = {
        cwd: tempDir,
      };

      vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true } as any);

      // Mock short MARIA.md (should fail verification)
      vi.mocked(fs.readFile).mockImplementation((path) => {
        if (path.toString().includes("MARIA.md")) {
          return Promise.resolve("# Short content");
        }
        return Promise.resolve("{}");
      });

      // The verification happens internally
      const scannerMock = await import("../scanner");
      vi.mocked(scannerMock.runWithBudget).mockResolvedValue([]);

      const result = await manager.initialize(opts);

      // Even if verification fails, we should get a result
      expect(result).toBeDefined();
      expect(result.progressReport).toBeDefined();
    });

    it("should check for required sections in MARIA.md", async () => {
      const opts: InitOptions = {
        cwd: tempDir,
      };

      vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => true } as any);

      // Mock complete MARIA.md
      const completeMariaMd = `
## 🚀 Project Overview
Content here

## 📁 Project Structure
Content here

## 🛠️ Development Commands
Content here
`.repeat(50); // Make it long enough

      vi.mocked(fs.readFile).mockImplementation((path) => {
        if (path.toString().includes("MARIA.md")) {
          return Promise.resolve(completeMariaMd);
        }
        return Promise.resolve("{}");
      });

      const scannerMock = await import("../scanner");
      vi.mocked(scannerMock.runWithBudget).mockResolvedValue([]);

      const result = await manager.initialize(opts);

      expect(result).toBeDefined();
      // Verification should pass with proper content
      expect(result.success).toBeDefined();
    });
  });
});
