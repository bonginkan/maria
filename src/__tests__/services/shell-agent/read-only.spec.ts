// src/services/shell-agent/__tests__/read-only.spec.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { ShellExecutor } from "../../shell-executor";
import { validatePlan } from "../../shell-plan";
import type { ShellPlan } from "../../shell-plan";

let tmpDir: string;
let executor: ShellExecutor;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "maria-shell-readonly-"));
  executor = new ShellExecutor({ workspaceRoot: tmpDir });

  // Create test structure
  await fs.mkdir(path.join(tmpDir, "src"));
  await fs.writeFile(
    path.join(tmpDir, "README.md"),
    "# Test Project\n\nThis is a test project for MARIA.\n\n## Features\n\n- Feature A\n- Feature B",
  );
  await fs.writeFile(
    path.join(tmpDir, "package.json"),
    '{\n  "name": "test",\n  "version": "1.0.0"\n}',
  );
  await fs.writeFile(
    path.join(tmpDir, "src", "index.ts"),
    'export function hello() {\n  return "Hello, World!";\n}\n\nexport const _config = { debug: true };',
  );
  await fs.writeFile(
    path.join(tmpDir, "src", "utils.ts"),
    "export function add(_a: number, b: number) {\n  return a + b;\n}",
  );
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => void 0);
});

describe("ShellExecutor read operations", () => {
  it("reads file content with preview limit", async () => {
    const _plan: ShellPlan = {
      intent: "read",
      steps: [{ op: "read", args: ["README.md"], previewLimit: 50 }],
      safety: {
        readOnly: true,
        allowPaths: ["**"],
        denyPaths: [],
        timeLimitMs: 5000,
        sizeLimitBytes: 10000,
      },
    };

    const _result = await executor.execute(_plan);

    expect(_result.ok).toBe(true);
    expect(_result.artifacts).toHaveLength(1);
    expect(_result.artifacts[0].preview).toContain("# Test Project");
    expect(_result.artifacts[0].preview!.length).toBeLessThanOrEqual(50);
  });

  it("lists directory contents safely", async () => {
    const _plan: ShellPlan = {
      intent: "read",
      steps: [{ op: "read", args: ["src"] }],
      safety: {
        readOnly: true,
        allowPaths: ["**"],
        denyPaths: [],
        timeLimitMs: 5000,
        sizeLimitBytes: 10000,
      },
    };

    const _result = await executor.execute(_plan);

    expect(_result.ok).toBe(true);
    expect(_result.artifacts[0].preview).toContain("index.ts");
    expect(_result.artifacts[0].preview).toContain("utils.ts");
    expect(
      _result.artifacts[0].preview?.split("\n").length,
    ).toBeLessThanOrEqual(200); // Directory limit
  });

  it("enforces size budget across operations", async () => {
    const _plan: ShellPlan = {
      intent: "read",
      steps: [
        { op: "read", args: ["README.md"] },
        { op: "read", args: ["package.json"] },
        { op: "read", args: ["src/index.ts"] },
      ],
      safety: {
        readOnly: true,
        allowPaths: ["**"],
        denyPaths: [],
        timeLimitMs: 5000,
        sizeLimitBytes: 50, // Very small budget
      },
    };

    const _result = await executor.execute(_plan);

    // Should fail due to size budget
    expect(_result.ok).toBe(false);
    expect(_result.report).toContain("budget exceeded");
  });

  it("handles non-existent files gracefully", async () => {
    const _plan: ShellPlan = {
      intent: "read",
      steps: [{ op: "read", args: ["nonexistent.txt"] }],
      safety: {
        readOnly: true,
        allowPaths: ["**"],
        denyPaths: [],
        timeLimitMs: 5000,
        sizeLimitBytes: 10000,
      },
    };

    const _result = await executor.execute(_plan);

    expect(_result.ok).toBe(false);
    expect(_result.report).toContain("failed");
  });
});

describe("ShellExecutor search operations", () => {
  it("searches for patterns in single file", async () => {
    const _plan: ShellPlan = {
      intent: "search",
      steps: [{ op: "search", args: ["export", "src/index.ts"] }],
      safety: {
        readOnly: true,
        allowPaths: ["**"],
        denyPaths: [],
        timeLimitMs: 5000,
        sizeLimitBytes: 10000,
      },
    };

    const _result = await executor.execute(_plan);

    expect(_result.ok).toBe(true);
    expect(_result.artifacts[0].preview).toContain("export function hello");
    expect(_result.artifacts[0].preview).toContain("export const config");
    expect(_result.artifacts[0].preview).toContain("src/index.ts:1:"); // Line numbers
  });

  it("supports regex patterns", async () => {
    const _plan: ShellPlan = {
      intent: "search",
      steps: [{ op: "search", args: ["/function\\s+\\w+/", "src/index.ts"] }],
      safety: {
        readOnly: true,
        allowPaths: ["**"],
        denyPaths: [],
        timeLimitMs: 5000,
        sizeLimitBytes: 10000,
      },
    };

    const _result = await executor.execute(_plan);

    expect(_result.ok).toBe(true);
    expect(_result.artifacts[0].preview).toContain("function hello");
  });

  it("limits search results to prevent DoS", async () => {
    // Create file with many matches
    const _manyMatches = Array(50).fill("export const _item").join("\n");
    await fs.writeFile(path.join(tmpDir, "many.ts"), _manyMatches);

    const _plan: ShellPlan = {
      intent: "search",
      steps: [{ op: "search", args: ["export", "many.ts"] }],
      safety: {
        readOnly: true,
        allowPaths: ["**"],
        denyPaths: [],
        timeLimitMs: 5000,
        sizeLimitBytes: 10000,
      },
    };

    const _result = await executor.execute(_plan);

    expect(_result.ok).toBe(true);
    // Should be limited to reasonable number of results
    const _lines = _result.artifacts[0].preview!.split("\n");
    expect(_lines.length).toBeLessThanOrEqual(20); // Match limit per file
  });

  it("searches directory for common files", async () => {
    const _plan: ShellPlan = {
      intent: "search",
      steps: [{ op: "search", args: ["test", "."] }],
      safety: {
        readOnly: true,
        allowPaths: ["**"],
        denyPaths: [],
        timeLimitMs: 5000,
        sizeLimitBytes: 10000,
      },
    };

    const _result = await executor.execute(_plan);

    expect(_result.ok).toBe(true);
    // Should find 'test' in package.json and README.md
    expect(_result.artifacts[0].preview).toMatch(/(package\.json|README\.md)/);
  });
});

describe("ShellExecutor security enforcement", () => {
  it("skips mutating operations in read-only mode", async () => {
    const _plan: ShellPlan = {
      intent: "edit",
      steps: [
        { op: "read", args: ["README.md"] },
        { op: "patch", args: ["README.md", "some-patch"] },
      ],
      safety: {
        readOnly: true,
        allowPaths: ["**"],
        denyPaths: [],
        timeLimitMs: 5000,
        sizeLimitBytes: 10000,
      },
    };

    const _result = await executor.execute(_plan);

    expect(_result.ok).toBe(true);
    expect(_result.artifacts).toHaveLength(2);
    expect(_result.artifacts[0].preview).toContain("# Test Project"); // read executed
    expect(_result.artifacts[1].preview).toBe("skipped (read-only mode)"); // patch skipped
  });

  it("validates plans reject mutating steps under readOnly", () => {
    const _plan = {
      intent: "edit",
      steps: [{ op: "patch", args: ["file.txt"] }],
      safety: {
        readOnly: true,
        allowPaths: ["**"],
        denyPaths: [],
        timeLimitMs: 5000,
        sizeLimitBytes: 10000,
      },
    };

    expect(() => validatePlan(_plan, { workspaceRoot: tmpDir })).toThrow(
      /mutating step under readOnly/,
    );
  });

  it("measures performance within acceptable limits", async () => {
    const _start = Date.now();

    const _plan: ShellPlan = {
      intent: "read",
      steps: [{ op: "read", args: ["README.md"] }],
      safety: {
        readOnly: true,
        allowPaths: ["**"],
        denyPaths: [],
        timeLimitMs: 5000,
        sizeLimitBytes: 10000,
      },
    };

    const _result = await executor.execute(_plan);
    const _duration = Date.now() - _start;

    expect(_result.ok).toBe(true);
    expect(_duration).toBeLessThan(500); // < 500ms requirement
  });
});
