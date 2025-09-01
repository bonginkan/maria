import { describe, it, expect, vi, beforeEach } from "vitest";
import { runWithBudget, safeRead } from "../../scanner";
import type { Task } from "../../types";

describe("Budget Management", () => {
  beforeEach(() => {
    vi.clearAllTimers();
    vi.useFakeTimers();
  });

  it("completes within budget for fast tasks", async () => {
    const fastTask: Task = async () => [
      { file: "test.js", kind: "config", head: "test content" },
    ];

    const start = Date.now();
    const result = await runWithBudget([fastTask], 1000, 500);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(1000);
    expect(result).toHaveLength(1);
    expect(result[0].file).toBe("test.js");
  });

  it("skips tasks when budget exhausted", async () => {
    const slowTask: Task = async () => {
      await new Promise((resolve) => setTimeout(resolve, 800));
      return [{ file: "slow.js", kind: "config", head: "slow content" }];
    };

    const fastTask: Task = async () => [
      { file: "fast.js", kind: "config", head: "fast content" },
    ];

    const result = await runWithBudget([slowTask, fastTask], 500, 200);

    // Should have timeout/skip entries
    expect(result.some((f) => f.meta?.skipped === "timeout")).toBe(true);
  });

  it("enforces per-step timeout", async () => {
    const hangingTask: Task = async ({ signal }) => {
      await new Promise((resolvePromise, reject) => {
        signal.addEventListener("abort", () => reject(new Error("Aborted")));
        setTimeout(resolve, 1000); // Longer than per-step limit
      });
      return [];
    };

    const result = await runWithBudget([hangingTask], 2000, 300);

    expect(result.some((f) => f.meta?.skipped === "timeout")).toBe(true);
  });

  it("handles task errors gracefully", async () => {
    const errorTask: Task = async () => {
      throw new Error("Task failed");
    };

    const goodTask: Task = async () => [
      { file: "good.js", kind: "config", head: "good" },
    ];

    const result = await runWithBudget([errorTask, goodTask], 1000, 500);

    expect(result).toHaveLength(2);
    expect(result[0].meta?.skipped).toBe("error");
    expect(result[1].file).toBe("good.js");
  });
});

describe("Safe File Reading", () => {
  it("handles non-existent files", async () => {
    const result = await safeRead("/nonexistent/file.txt");

    expect(result.head).toBe("");
    expect(result.truncated).toBe(true);
    expect(result.meta?.reason).toBe("error");
  });

  it("skips sensitive files", async () => {
    const sensitiveFiles = [".env", ".env.local", "secrets.key", "private.pem"];

    for (const file of sensitiveFiles) {
      const result = await safeRead(file);
      expect(result.meta?.reason).toBe("sensitive");
      expect(result.head).toBe("");
      expect(result.truncated).toBe(true);
    }
  });

  it("skips binary files", async () => {
    const binaryFiles = ["image.png", "doc.pdf", "archive.zip", "binary.exe"];

    for (const file of binaryFiles) {
      const result = await safeRead(file);
      expect(result.meta?.reason).toBe("binary");
      expect(result.head).toBe("");
      expect(result.truncated).toBe(true);
    }
  });

  it("normalizes line endings and removes BOM", async () => {
    // Mock fs.readFile to return content with CRLF and BOM
    const mockContent = '\uFEFF{\r\n  "name": "test"\r\n}';
    vi.doMock("fs/promises", () => ({
      readFile: vi.fn().mockResolvedValue(Buffer.from(mockContent)),
      stat: vi.fn().mockResolvedValue({ size: mockContent.length }),
    }));

    const result = await safeRead("package.json");

    expect(result.head).toBe('{\n  "name": "test"\n}');
    expect(result.truncated).toBe(false);
  });

  it("truncates long files with head and tail", async () => {
    const lines = Array.from({ length: 1000 }, (_, i) => `line ${i + 1}`);
    const content = lines.join("\n");

    vi.doMock("fs/promises", () => ({
      readFile: vi.fn().mockResolvedValue(Buffer.from(content)),
      stat: vi.fn().mockResolvedValue({ size: content.length }),
    }));

    const result = await safeRead("large.txt", 512 * 1024, 100);

    expect(result.truncated).toBe(true);
    expect(result.head).toContain("line 1");
    expect(result.head).toContain("line 1000");
    expect(result.head).toContain("... (truncated");
    expect(result.meta?.totalLines).toBe(1000);
  });

  it("respects file size limits", async () => {
    const largeSize = 1024 * 1024; // 1MB

    vi.doMock("fs/promises", () => ({
      stat: vi.fn().mockResolvedValue({ size: largeSize }),
    }));

    const result = await safeRead("huge.txt", 512 * 1024);

    expect(result.head).toBe("");
    expect(result.truncated).toBe(true);
    expect(result.meta?.reason).toBe("size");
    expect(result.meta?.size).toBe(largeSize);
  });

  it("handles abort signals", async () => {
    const controller = new AbortController();

    vi.doMock("fs/promises", () => ({
      readFile: vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return Buffer.from("content");
      }),
      stat: vi.fn().mockResolvedValue({ size: 100 }),
    }));

    // Abort after 50ms
    setTimeout(() => controller.abort(), 50);

    const result = await safeRead(
      "file.txt",
      512 * 1024,
      200,
      controller.signal,
    );

    expect(result.head).toBe("");
    expect(result.truncated).toBe(true);
    expect(result.meta?.reason).toBe("error");
  });
});
