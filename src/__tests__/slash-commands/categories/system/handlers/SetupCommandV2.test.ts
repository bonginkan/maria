/**
 * SetupCommandV2 Tests
 *
 * Tests for intelligent environment setup:
 * - File collection and filtering
 * - Environment-specific setup guides
 * - Integration with EnvironmentDetector
 * - Contract compliance
 * - Performance characteristics
 */

import { describe, test, expect, beforeEach, vi, afterEach } from "vitest";
import { SetupCommandV2 } from "../../../../SetupCommandV2";
import type { SystemCommandDependencies } from "../../../../../../../../../../../../../../services/system-commands/base/SystemCommandV2Base";
import { promises as fs } from "fs";
import { join } from "path";

// Mock filesystem
vi.mock("fs", () => ({
  promises: {
    readdir: vi.fn(),
    readFile: vi.fn(),
    stat: vi.fn(),
  },
}));

describe("SetupCommandV2", () => {
  let command: SetupCommandV2;
  let mockDependencies: SystemCommandDependencies;
  let mockFs: any;

  beforeEach(() => {
    mockFs = {
      readdir: vi.mocked(fs.readdir),
      readFile: vi.mocked(fs.readFile),
      stat: vi.mocked(fs.stat),
    };

    mockDependencies = {
      monitoringPort: {
        recordEvent: vi.fn(),
        recordLatency: vi.fn(),
        recordValue: vi.fn(),
        getSystemMetrics: vi.fn(),
        getCPUUsage: vi.fn(),
        getMemoryUsage: vi.fn(),
        getDiskUsage: vi.fn(),
        getLatencyPercentiles: vi.fn(),
        getErrorRate: vi.fn(),
        isHealthy: vi.fn(),
        getHealthSummary: vi.fn(),
      },
      providerHealthPort: {
        probeAll: vi.fn(),
        probeOne: vi.fn(),
        getHealthScore: vi.fn(),
        getOverallHealth: vi.fn(),
        clearCache: vi.fn(),
        getCacheMetrics: vi.fn(),
      },
      configPort: {
        get: vi.fn(),
        set: vi.fn(),
        delete: vi.fn(),
        list: vi.fn(),
        getLayered: vi.fn(),
        setLayer: vi.fn(),
        validate: vi.fn(),
        migrate: vi.fn(),
        applyTemplate: vi.fn(),
        listTemplates: vi.fn(),
        getHistory: vi.fn(),
        rollback: vi.fn(),
        getSchema: vi.fn(),
        getVersion: vi.fn(),
      },
      timeSeriesPort: {
        record: vi.fn(),
        recordBatch: vi.fn(),
        query: vi.fn(),
        queryMultiple: vi.fn(),
        aggregate: vi.fn(),
        getTrends: vi.fn(),
        checkThresholds: vi.fn(),
        setThreshold: vi.fn(),
        cleanup: vi.fn(),
        getStorageMetrics: vi.fn(),
      },
    };

    command = new SetupCommandV2(mockDependencies);

    // Reset filesystem mocks
    mockFs.readdir.mockClear();
    mockFs.readFile.mockClear();
    mockFs.stat.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Contract Compliance", () => {
    test("has correct contract properties", () => {
      expect(command.requiresInput).toBe(false);
      expect(command.name).toBe("setup");
      expect(command.category).toBe("system");
      expect(command.description).toContain("environment setup");
    });

    test("returns proper CommandResultV2 on success", async () => {
      // Mock successful filesystem operations
      mockFs.readdir.mockResolvedValue([
        { name: "package.json", isDirectory: () => false, isFile: () => true },
        { name: "src", isDirectory: () => true, isFile: () => false },
      ]);

      mockFs.stat.mockResolvedValue({ size: 1024 });

      mockFs.readFile.mockResolvedValue(
        JSON.stringify({
          name: "test-project",
          version: "1.0.0",
          dependencies: { react: "^18.0.0" },
        }),
      );

      const result = await command.execute();

      expect(result.endReason).toBe("success");
      expect(result.duration).toBeGreaterThan(0);
      expect(result.timestamp).toBeGreaterThan(0);
      expect(result.monotonicMs).toBeGreaterThan(0);
      expect(result.data).toBeDefined();
      expect(result.data.environment).toBeDefined();
      expect(result.data.setupGuide).toBeDefined();
    });

    test("handles timeout correctly", async () => {
      const controller = new AbortController();
      command.signal = controller.signal;

      // Mock slow operation
      mockFs.readdir.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 1000)),
      );

      // Abort after 50ms
      setTimeout(() => controller.abort(), 50);

      const result = await command.execute();

      expect(result.endReason).toBe("cancel");
      expect(result.error).toContain("cancelled");
    });

    test("handles errors gracefully", async () => {
      // Mock filesystem error
      mockFs.readdir.mockRejectedValue(new Error("Permission denied"));

      const result = await command.execute();

      expect(result.endReason).toBe("error");
      expect(result.error).toContain("Setup failed");
      expect(result.duration).toBeGreaterThan(0);
    });
  });

  describe("File Collection", () => {
    test("collects project files correctly", async () => {
      // Mock directory structure
      mockFs.readdir
        .mockResolvedValueOnce([
          {
            name: "package.json",
            isDirectory: () => false,
            isFile: () => true,
          },
          { name: "src", isDirectory: () => true, isFile: () => false },
          {
            name: "node_modules",
            isDirectory: () => true,
            isFile: () => false,
          },
        ])
        .mockResolvedValueOnce([
          { name: "index.js", isDirectory: () => false, isFile: () => true },
          { name: "components", isDirectory: () => true, isFile: () => false },
        ])
        .mockResolvedValueOnce([
          { name: "Button.js", isDirectory: () => false, isFile: () => true },
        ]);

      mockFs.stat.mockResolvedValue({ size: 500 });
      mockFs.readFile.mockResolvedValue("{}");

      const result = await command.execute();

      expect(result.endReason).toBe("success");
      expect(result.data.filesAnalyzed).toBeGreaterThan(0);

      // Should skip node_modules
      expect(mockFs.readdir).toHaveBeenCalledTimes(3); // root + src + components (not node_modules)
    });

    test("skips ignored files and directories", async () => {
      mockFs.readdir.mockResolvedValueOnce([
        { name: "src", isDirectory: () => true, isFile: () => false },
        { name: ".git", isDirectory: () => true, isFile: () => false },
        { name: "node_modules", isDirectory: () => true, isFile: () => false },
        { name: ".DS_Store", isDirectory: () => false, isFile: () => true },
        { name: "dist", isDirectory: () => true, isFile: () => false },
      ]);

      mockFs.stat.mockResolvedValue({ size: 100 });
      mockFs.readFile.mockResolvedValue("{}");

      const result = await command.execute();

      // Should only process 'src' directory
      expect(mockFs.readdir).toHaveBeenCalledTimes(2); // root + src only
    });

    test("loads config file contents", async () => {
      mockFs.readdir.mockResolvedValue([
        { name: "package.json", isDirectory: () => false, isFile: () => true },
        { name: "tsconfig.json", isDirectory: () => false, isFile: () => true },
      ]);

      mockFs.stat.mockResolvedValue({ size: 1024 });

      const packageContent = JSON.stringify({
        name: "test-project",
        dependencies: { typescript: "^4.9.0" },
      });

      const tsconfigContent = JSON.stringify({
        compilerOptions: { strict: true },
      });

      mockFs.readFile
        .mockResolvedValueOnce(packageContent)
        .mockResolvedValueOnce(tsconfigContent);

      const result = await command.execute();

      expect(result.endReason).toBe("success");
      expect(mockFs.readFile).toHaveBeenCalledWith(
        expect.stringContaining("package.json"),
        "utf-8",
      );
      expect(mockFs.readFile).toHaveBeenCalledWith(
        expect.stringContaining("tsconfig.json"),
        "utf-8",
      );
    });
  });

  describe("Environment Detection Integration", () => {
    test("detects Next.js project and generates appropriate setup", async () => {
      mockFs.readdir.mockResolvedValue([
        { name: "package.json", isDirectory: () => false, isFile: () => true },
        {
          name: "next.config.js",
          isDirectory: () => false,
          isFile: () => true,
        },
      ]);

      mockFs.stat.mockResolvedValue({ size: 1024 });

      mockFs.readFile.mockResolvedValue(
        JSON.stringify({
          name: "my-nextjs-app",
          dependencies: {
            next: "^13.0.0",
            react: "^18.0.0",
          },
        }),
      );

      const result = await command.execute();

      expect(result.endReason).toBe("success");
      expect(result.data.environment.framework).toBe("nextjs");
      expect(result.data.setupGuide.quickStart).toContain(
        expect.stringContaining("npm run dev"),
      );
      expect(result.data.setupGuide.summary).toContain("nextjs");
    });

    test("detects React project and suggests build tool", async () => {
      mockFs.readdir.mockResolvedValue([
        { name: "package.json", isDirectory: () => false, isFile: () => true },
      ]);

      mockFs.stat.mockResolvedValue({ size: 1024 });

      mockFs.readFile.mockResolvedValue(
        JSON.stringify({
          dependencies: {
            react: "^18.0.0",
            "react-dom": "^18.0.0",
          },
        }),
      );

      const result = await command.execute();

      expect(result.endReason).toBe("success");
      expect(result.data.environment.framework).toBe("react");
      expect(result.data.environment.recommendations).toContain(
        expect.stringContaining("build tool"),
      );
    });

    test("detects pnpm and provides pnpm-specific instructions", async () => {
      mockFs.readdir.mockResolvedValue([
        { name: "package.json", isDirectory: () => false, isFile: () => true },
        {
          name: "pnpm-lock.yaml",
          isDirectory: () => false,
          isFile: () => true,
        },
      ]);

      mockFs.stat.mockResolvedValue({ size: 1024 });
      mockFs.readFile.mockResolvedValue("{}");

      const result = await command.execute();

      expect(result.endReason).toBe("success");
      expect(result.data.environment.packageManager).toBe("pnpm");
      expect(result.data.setupGuide.quickStart[0]).toContain("pnpm install");
    });
  });

  describe("Setup Guide Generation", () => {
    test("generates comprehensive setup guide", async () => {
      mockFs.readdir.mockResolvedValue([
        { name: "package.json", isDirectory: () => false, isFile: () => true },
      ]);

      mockFs.stat.mockResolvedValue({ size: 1024 });

      mockFs.readFile.mockResolvedValue(
        JSON.stringify({
          name: "test-project",
          dependencies: { express: "^4.18.0" },
        }),
      );

      const result = await command.execute();

      const setupGuide = result.data.setupGuide;

      expect(setupGuide.summary).toBeDefined();
      expect(setupGuide.quickStart).toBeInstanceOf(Array);
      expect(setupGuide.developmentSetup).toBeInstanceOf(Array);
      expect(setupGuide.productionSetup).toBeInstanceOf(Array);
      expect(setupGuide.troubleshooting).toBeInstanceOf(Array);
      expect(setupGuide.nextSteps).toBeInstanceOf(Array);

      // Should contain MARIA-specific setup
      expect(setupGuide.developmentSetup).toContain(
        expect.stringContaining("MARIA"),
      );
    });

    test("provides framework-specific recommendations", async () => {
      mockFs.readdir.mockResolvedValue([
        { name: "package.json", isDirectory: () => false, isFile: () => true },
      ]);

      mockFs.stat.mockResolvedValue({ size: 1024 });

      mockFs.readFile.mockResolvedValue(
        JSON.stringify({
          dependencies: { vue: "^3.0.0" },
        }),
      );

      const result = await command.execute();

      expect(result.data.setupGuide.quickStart).toContain(
        expect.stringContaining("npm run serve"),
      );
      expect(result.data.setupGuide.developmentSetup).toContain(
        expect.stringContaining("Vue DevTools"),
      );
    });
  });

  describe("Metrics Recording", () => {
    test("records setup metrics on successful execution", async () => {
      mockFs.readdir.mockResolvedValue([
        { name: "package.json", isDirectory: () => false, isFile: () => true },
      ]);

      mockFs.stat.mockResolvedValue({ size: 1024 });
      mockFs.readFile.mockResolvedValue("{}");

      await command.execute();

      expect(mockDependencies.monitoringPort.recordEvent).toHaveBeenCalledWith(
        "system.setup.environment_detected",
        expect.objectContaining({
          framework: expect.any(String),
          runtime: expect.any(String),
          confidence: expect.any(Number),
          fileCount: expect.any(Number),
        }),
      );
    });

    test("handles metrics recording failures gracefully", async () => {
      mockFs.readdir.mockResolvedValue([]);
      mockFs.stat.mockResolvedValue({ size: 0 });

      // Mock metrics failure
      mockDependencies.monitoringPort.recordEvent.mockRejectedValue(
        new Error("Metrics service unavailable"),
      );

      const result = await command.execute();

      // Should still succeed despite metrics failure
      expect(result.endReason).toBe("success");
    });
  });

  describe("Performance", () => {
    test("completes analysis within reasonable time", async () => {
      // Mock large directory structure
      const largeDirStructure = Array.from({ length: 50 }, (_, i) => ({
        name: `file${i}.js`,
        isDirectory: () => false,
        isFile: () => true,
      }));

      mockFs.readdir.mockResolvedValue(largeDirStructure);
      mockFs.stat.mockResolvedValue({ size: 1024 });
      mockFs.readFile.mockResolvedValue("{}");

      const startTime = performance.now();
      const result = await command.execute();
      const duration = performance.now() - startTime;

      expect(result.endReason).toBe("success");
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      expect(result.data.detectionTimeMs).toBeLessThan(1000); // Detection itself should be fast
    });

    test("respects depth limits for deep directory structures", async () => {
      // Mock nested directory structure
      mockFs.readdir
        .mockResolvedValueOnce([
          { name: "level1", isDirectory: () => true, isFile: () => false },
        ])
        .mockResolvedValueOnce([
          { name: "level2", isDirectory: () => true, isFile: () => false },
        ])
        .mockResolvedValueOnce([
          { name: "level3", isDirectory: () => true, isFile: () => false },
        ])
        .mockResolvedValueOnce([
          { name: "level4", isDirectory: () => true, isFile: () => false },
        ]);

      mockFs.stat.mockResolvedValue({ size: 100 });
      mockFs.readFile.mockResolvedValue("{}");

      const result = await command.execute();

      expect(result.endReason).toBe("success");
      // Should stop at max depth (3), so 4 calls: root + level1 + level2 + level3
      expect(mockFs.readdir).toHaveBeenCalledTimes(4);
    });
  });

  describe("Error Handling", () => {
    test("handles permission errors gracefully", async () => {
      mockFs.readdir.mockRejectedValue(new Error("EACCES: permission denied"));

      const result = await command.execute();

      expect(result.endReason).toBe("error");
      expect(result.error).toContain("permission denied");
    });

    test("handles file read errors for config files", async () => {
      mockFs.readdir.mockResolvedValue([
        { name: "package.json", isDirectory: () => false, isFile: () => true },
      ]);

      mockFs.stat.mockResolvedValue({ size: 1024 });
      mockFs.readFile.mockRejectedValue(new Error("File not readable"));

      const result = await command.execute();

      // Should still succeed even if config file can't be read
      expect(result.endReason).toBe("success");
    });
  });
});
