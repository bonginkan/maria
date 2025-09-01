import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { ShellExecutor, createSecureExecutor } from "../../shell-executor.js";
import { createSafePlan } from "../../shell-plan.js";
import { SANDBOX_CONFIG } from "../../sandbox.js";

describe("ShellExecutor - Read-only Operations", () => {
  let executor: ShellExecutor;
  let tempDir: string;

  beforeEach(async () => {
    // Create temporary test directory
    tempDir = path.join(__dirname, "temp-test");
    await fs.mkdir(tempDir, { recursive: true });

    // Create test files
    await fs.writeFile(
      path.join(tempDir, "README.md"),
      "# Test Project\nThis is a test project.",
    );
    await fs.writeFile(
      path.join(tempDir, "package.json"),
      JSON.stringify(
        {
          name: "test-project",
          version: "1.0.0",
          scripts: { test: "vitest" },
        },
        null,
        2,
      ),
    );

    await fs.mkdir(path.join(tempDir, "src"), { recursive: true });
    await fs.writeFile(
      path.join(tempDir, "src/index.ts"),
      'export function hello() {\n  return "hello world";\n}',
    );

    executor = createSecureExecutor(tempDir);
  });

  afterEach(async () => {
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe("File Reading", () => {
    it("should read a simple file", async () => {
      const plan = createSafePlan("read", [
        { op: "read", args: ["README.md"], previewLimit: 1000 },
      ]);

      const result = await executor.execute(plan);

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].success).toBe(true);
      expect(result.results[0].output).toContain("Test Project");
    });

    it("should list directory contents", async () => {
      const plan = createSafePlan("read", [
        { op: "read", args: ["."], previewLimit: 1000 },
      ]);

      const result = await executor.execute(plan);

      expect(result.success).toBe(true);
      expect(result.results[0].output).toContain("README.md");
      expect(result.results[0].output).toContain("package.json");
      expect(result.results[0].output).toContain("src");
    });

    it("should enforce file size limits", async () => {
      // Create a large file
      const largeContent = "x".repeat(SANDBOX_CONFIG.MAX_FILE_SIZE + 1000);
      await fs.writeFile(path.join(tempDir, "large.txt"), largeContent);

      const plan = createSafePlan("read", [
        { op: "read", args: ["large.txt"], previewLimit: 1000 },
      ]);

      const result = await executor.execute(plan);

      expect(result.success).toBe(false);
      expect(result.results[0].error).toContain("File too large");
    });
  });

  describe("Search Operations", () => {
    it("should search for patterns in files", async () => {
      const plan = createSafePlan("search", [
        { op: "search", args: ["hello", "src/index.ts"], previewLimit: 1000 },
      ]);

      const result = await executor.execute(plan);

      expect(result.success).toBe(true);
      expect(result.results[0].output).toContain("hello");
    });

    it("should search in directories", async () => {
      const plan = createSafePlan("search", [
        { op: "search", args: ["export", "src"], previewLimit: 1000 },
      ]);

      const result = await executor.execute(plan);

      expect(result.success).toBe(true);
      expect(result.results[0].output).toContain("export function hello");
    });
  });

  describe("Security Validation", () => {
    it("should reject path traversal attempts", async () => {
      const plan = createSafePlan("read", [
        { op: "read", args: ["../../../etc/passwd"], previewLimit: 1000 },
      ]);

      const result = await executor.execute(plan);

      expect(result.success).toBe(false);
      expect(result.formatted).toContain("Plan validation failed");
    });

    it("should reject operations on forbidden paths", async () => {
      const plan = createSafePlan("read", [
        { op: "read", args: [".git/config"], previewLimit: 1000 },
      ]);

      const result = await executor.execute(plan);

      expect(result.success).toBe(false);
    });

    it("should enforce step limits", async () => {
      const plan = createSafePlan(
        "read",
        Array(10)
          .fill(0)
          .map(() => ({
            op: "read" as const,
            args: ["README.md"],
            previewLimit: 100,
          })),
      );

      const result = await executor.execute(plan);

      expect(result.success).toBe(false);
      expect(result.formatted).toContain("Too many steps");
    });

    it("should enforce execution timeouts", async () => {
      const executorInner = new ShellExecutor({
        workspaceRoot: tempDir,
        timeLimit: 100,
      });

      // Mock a slow operation
      vi.spyOn(fs, "readdir").mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve([]), 200)),
      );

      const plan = createSafePlan("read", [
        { op: "read", args: ["."], previewLimit: 1000 },
      ]);

      const result = await executor.execute(plan);

      expect(result.success).toBe(false);
      expect(result.results[0].error).toContain("timeout");

      vi.restoreAllMocks();
    });
  });

  describe("Resource Management", () => {
    it("should track resource usage correctly", async () => {
      const plan = createSafePlan("read", [
        { op: "read", args: ["README.md"], previewLimit: 1000 },
        { op: "read", args: ["package.json"], previewLimit: 1000 },
      ]);

      const result = await executor.execute(plan);

      expect(result.success).toBe(true);
      expect(result.metadata.resourceUsage.filesRead).toBe(2);
      expect(result.metadata.resourceUsage.operationsExecuted).toBe(2);
      expect(result.metadata.resourceUsage.bytesProcessed).toBeGreaterThan(0);
    });
  });
});
