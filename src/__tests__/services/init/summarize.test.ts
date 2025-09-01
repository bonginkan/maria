import { describe, it, expect } from "vitest";
import { summarize } from "../../summarize";
import type { InitFinding } from "../../types";

describe("Package Info Extraction", () => {
  it("extracts basic package information", () => {
    const findings: InitFinding[] = [
      {
        file: "package.json",
        kind: "read",
        head: '{"name": "@test/pkg", "version": "1.0.0"}',
        meta: {
          name: "@test/pkg",
          version: "1.0.0",
          type: "module",
          scripts: { build: "tsup", test: "vitest" },
          bin: { cli: "bin/cli.js" },
          main: "dist/index.js",
        },
      },
    ];

    const summary = summarize(findings, "/test/cwd");

    expect(summary.package.name).toBe("@test/pkg");
    expect(summary.package.version).toBe("1.0.0");
    expect(summary.package.type).toBe("module");
    expect(summary.package.scripts).toEqual(["build", "test"]);
    expect(summary.package.bin).toEqual({ cli: "bin/cli.js" });
    expect(summary.package.main).toBe("dist/index.js");
  });

  it("handles missing package.json", () => {
    const findings: InitFinding[] = [];

    const summary = summarize(findings);

    expect(summary.package.name).toBeUndefined();
    expect(summary.package.scripts).toEqual([]);
    expect(summary.package.hasPostinstall).toBe(false);
  });

  it("detects postinstall hooks", () => {
    const findings: InitFinding[] = [
      {
        file: "package.json",
        kind: "read",
        head: "{}",
        meta: {
          scripts: { postinstall: "node setup.js" },
        },
      },
    ];

    const summary = summarize(findings);

    expect(summary.package.hasPostinstall).toBe(true);
    expect(summary.warnings).toContainEqual(
      expect.objectContaining({
        id: "script.postinstall.review",
        level: "medium",
      }),
    );
  });
});

describe("Warning Generation", () => {
  it("warns about missing quality gates", () => {
    const findings: InitFinding[] = [
      {
        file: "package.json",
        kind: "read",
        head: "{}",
        meta: {
          scripts: { build: "tsup", test: "vitest" }, // Missing smoke, lint:strict, type-check
        },
      },
    ];

    const summary = summarize(findings);

    const warningIds = summary.warnings.map((w) => w.id);
    expect(warningIds).toContain("script.missing.smoke");
    expect(warningIds).toContain("script.missing.lint-strict");
    expect(warningIds).toContain("script.missing.type-check");
  });

  it("warns about missing config files", () => {
    const findings: InitFinding[] = [
      {
        file: "package.json",
        kind: "read",
        head: "{}",
        meta: Record<string, any>,
      },
      // No vitest.config or .eslintrc files
    ];

    const summary = summarize(findings);

    const warningIds = summary.warnings.map((w) => w.id);
    expect(warningIds).toContain("config.missing.vitest");
    expect(warningIds).toContain("config.missing.eslint");
  });

  it("detects TypeScript aliases", () => {
    const findings: InitFinding[] = [
      {
        file: "tsconfig.json",
        kind: "config",
        head: `{
          "compilerOptions": {
            "baseUrl": "src",
            "paths": {
              "@/*": ["*"]
            }
          }
        }`,
      },
    ];

    const summary = summarize(findings);

    expect(summary.warnings).toContainEqual(
      expect.objectContaining({
        id: "tsconfig.aliases",
        level: "low",
        message: expect.stringContaining("baseUrl/paths"),
      }),
    );
  });

  it("warns about ESM/CJS mixing", () => {
    const findings: InitFinding[] = [
      {
        file: "package.json",
        kind: "read",
        head: "{}",
        meta: {
          type: "module",
          main: "dist/index.cjs", // CJS main with ESM type
        },
      },
    ];

    const summary = summarize(findings);

    expect(summary.warnings).toContainEqual(
      expect.objectContaining({
        id: "esm.cjs.mixed",
        level: "medium",
      }),
    );
  });

  it("detects monorepos", () => {
    const findings: InitFinding[] = [
      {
        file: "package.json",
        kind: "read",
        head: "{}",
        meta: {
          workspaces: ["packages/*"],
        },
      },
    ];

    const summary = summarize(findings);

    expect(summary.warnings).toContainEqual(
      expect.objectContaining({
        id: "monorepo.detected",
        level: "low",
      }),
    );
  });
});

describe("Structure Analysis", () => {
  it("categorizes files correctly", () => {
    const findings: InitFinding[] = [
      { file: "package.json", kind: "read", head: "{}" },
      { file: "tsconfig.json", kind: "config", head: "{}" },
      { file: ".eslintrc.js", kind: "config", head: "" },
      { file: "src/index.ts", kind: "entry", head: "" },
      { file: "src/cli.ts", kind: "entry", head: "" },
      {
        file: "scripts/**",
        kind: "search",
        head: "",
        meta: { totalFiles: 15 },
      },
    ];

    const summary = summarize(findings);

    expect(summary.entries).toEqual(["src/index.ts", "src/cli.ts"]);
    expect(summary.configs).toContain("tsconfig.json");
    expect(summary.configs).toContain(".eslintrc.js");
    expect(summary.scriptsCount).toBe(15);
  });

  it("deduplicates entries and configs", () => {
    const findings: InitFinding[] = [
      { file: "tsconfig.json", kind: "config", head: "{}" },
      { file: "tsconfig.json", kind: "config", head: "{}" }, // duplicate
      { file: "src/index.ts", kind: "entry", head: "" },
      { file: "src/index.ts", kind: "entry", head: "" }, // duplicate
    ];

    const summary = summarize(findings);

    expect(summary.configs).toEqual(["tsconfig.json"]);
    expect(summary.entries).toEqual(["src/index.ts"]);
  });
});

describe("Bin Alignment Checking", () => {
  // Note: This requires mocking fs.existsSync for full testing
  it("warns about missing bin targets", () => {
    const findings: InitFinding[] = [
      {
        file: "package.json",
        kind: "read",
        head: "{}",
        meta: {
          bin: { maria: "bin/maria" },
        },
      },
    ];

    // Mock fs.existsSync to return false
    const originalExistsSync = require("fs").existsSync;
    require("fs").existsSync = () => false;

    try {
      const summary = summarize(findings, "/test/cwd");

      expect(summary.warnings).toContainEqual(
        expect.objectContaining({
          id: "bin.missing",
          level: "medium",
          message: expect.stringContaining(
            "ensure build emits dist counterpart",
          ),
        }),
      );
    } finally {
      require("fs").existsSync = originalExistsSync;
    }
  });
});
