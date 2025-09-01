/**
 * Fact extraction and warning generation from scan findings
 */

import * as fs from "fs";
import * as path from "path";
import type { InitFinding, InitSummary, Warning, PackageInfo } from "./types";

// Dangerous script patterns with scoring
const DANGEROUS_PATTERNS = [
  { pattern: /\brm\s+-rf\b/, weight: 0.4, desc: "destructive deletion" },
  { pattern: /\bsudo\b\s+(?!-k)/, weight: 0.4, desc: "privilege escalation" },
  {
    pattern: /\b(curl|wget)\b.*https?:/i,
    weight: 0.3,
    desc: "external download",
  },
  { pattern: /\bchmod\s+[0-7]{3}\b/, weight: 0.25, desc: "permission change" },
  { pattern: /\bsh\b\s+-c\b/, weight: 0.3, desc: "shell execution" },
  { pattern: /\bbash\b.*-c/, weight: 0.3, desc: "bash execution" },
  { pattern: /\beval\b\s*\(/, weight: 0.3, desc: "code evaluation" },
];

/**
 * Calculate danger score for a script (0-1 scale)
 */
function calculateDangerScore(script: string, scriptName?: string): number {
  // Remove pseudo-comments and normalize
  const cleanScript = script.replace(/#.*$/gm, "").trim();

  let score = 0;
  for (const { pattern, weight } of DANGEROUS_PATTERNS) {
    if (pattern.test(cleanScript)) {
      score += weight;
    }
  }

  // Boost score for postinstall hooks
  if (scriptName === "postinstall") {
    score += 0.2;
  }

  return Math.min(score, 1);
}

/**
 * Check bin alignment with dist directory
 */
function checkBinAlignment(pkg: any, cwd: string): Warning[] {
  const warnings: Warning[] = [];

  if (!pkg.bin) return warnings;

  const type = pkg.type;
  const bin = typeof pkg.bin === "string" ? { [pkg.name]: pkg.bin } : pkg.bin;

  for (const [name, rel] of Object.entries(bin)) {
    const binPath = rel as string;

    // Check if bin file exists in source
    const srcPath = path.join(cwd, binPath);
    if (!fs.existsSync(srcPath)) {
      // Try to guess dist counterpart
      const distGuess = path.join(
        cwd,
        "dist",
        binPath.replace(/^src\//, "").replace(/^bin\//, "bin/"),
      );
      const distCjsGuess = distGuess
        .replace(/\.ts$/, ".cjs")
        .replace(/\.js$/, ".cjs");

      if (!fs.existsSync(distGuess) && !fs.existsSync(distCjsGuess)) {
        warnings.push({
          id: "bin.missing",
          level: "medium",
          file: "package.json",
          message: `bin "${name}" points to "${binPath}" - ensure build emits dist counterpart`,
        });
      }
    }
  }

  // Check ESM/CJS mixing
  if (type === "module" && pkg.main && /$2.cjs$/.test(pkg.main)) {
    warnings.push({
      id: "esm.cjs.mixed",
      level: "medium",
      file: "package.json",
      message: "type:module with CJS main detected",
    });
  }

  return warnings;
}

/**
 * Check for TypeScript alias usage
 */
function hasTypeScriptAliases(findings: InitFinding[]): boolean {
  const tsconfig = findings.find((f) => f.file === "tsconfig.json")?.head ?? "";
  return /"baseUrl"\s*:/.test(tsconfig) && /"paths"\s*:/.test(tsconfig);
}

/**
 * Check for missing quality gates
 */
function checkQualityGates(pkg: PackageInfo): Warning[] {
  const warnings: Warning[] = [];
  const scripts = pkg.scripts;

  // Missing test:smoke
  if (!scripts.includes("test:smoke") && !scripts.includes("smoke")) {
    warnings.push({
      id: "script.missing.smoke",
      level: "low",
      file: "package.json",
      message: "Missing test:smoke script - add for CI validation",
    });
  }

  // Missing lint:strict
  if (
    !scripts.includes("lint:strict") &&
    !scripts.some((s) => s.includes("strict"))
  ) {
    warnings.push({
      id: "script.missing.lint-strict",
      level: "low",
      file: "package.json",
      message: "Missing lint:strict script - add for quality gates",
    });
  }

  // Missing type-check
  if (!scripts.includes("type-check") && !scripts.includes("typecheck")) {
    warnings.push({
      id: "script.missing.type-check",
      level: "low",
      file: "package.json",
      message: "Missing type-check script - add for CI validation",
    });
  }

  return warnings;
}

/**
 * Check for config file presence
 */
function checkConfigFiles(findings: InitFinding[]): Warning[] {
  const warnings: Warning[] = [];
  const configFiles = findings
    .filter((f) => f.kind === "config")
    .map((f) => f.file);

  // Missing vitest config
  if (!configFiles.some((f) => f.startsWith("vitest.config"))) {
    warnings.push({
      id: "config.missing.vitest",
      level: "low",
      file: ".",
      message: "No vitest.config found - add minimal config to run smoke tests",
    });
  }

  // Missing ESLint config
  if (!configFiles.some((f) => f.startsWith(".eslintrc"))) {
    warnings.push({
      id: "config.missing.eslint",
      level: "low",
      file: ".",
      message: "ESLint config not found - consider adding strict rules for CI",
    });
  }

  return warnings;
}

/**
 * Analyze package.json scripts for dangers
 */
function analyzeScripts(pkg: PackageInfo): Warning[] {
  const warnings: Warning[] = [];

  if (!pkg.scripts) return warnings;

  for (const scriptName of pkg.scripts) {
    // Note: pkg.scripts here is just the array of script names from our extraction
    // We would need the actual script content from the meta to analyze
    // This is a simplified version - full implementation would need script content
  }

  // Check postinstall specifically
  if (pkg.hasPostinstall) {
    warnings.push({
      id: "script.postinstall.review",
      level: "medium",
      file: "package.json",
      message: "postinstall script detected - review for security risks",
    });
  }

  return warnings;
}

/**
 * Extract package information from findings
 */
function extractPackageInfo(findings: InitFinding[]): PackageInfo {
  const pkgFinding = findings.find((f) => f.file === "package.json");

  if (!pkgFinding?.meta) {
    return {
      scripts: [],
      hasPostinstall: false,
    };
  }

  const meta = pkgFinding.meta;

  return {
    name: meta.name,
    version: meta.version,
    type: meta.type,
    scripts: meta.scripts ? Object.keys(meta.scripts) : [],
    hasPostinstall: !!meta.scripts?.postinstall,
    bin: meta.bin,
    main: meta.main,
    exports: meta.exports,
    dependencies: meta.dependencies || [],
    devDependencies: meta.devDependencies || [],
    workspaces: meta.workspaces,
  };
}

/**
 * Collect all warnings from various checks
 */
function collectWarnings(
  pkg: PackageInfo,
  findings: InitFinding[],
  cwd: string,
): Warning[] {
  const warnings: Warning[] = [];

  // Script analysis
  warnings.push(...analyzeScripts(pkg));

  // Bin alignment check
  warnings.push(...checkBinAlignment(pkg, cwd));

  // Quality gates check
  warnings.push(...checkQualityGates(pkg));

  // Config files check
  warnings.push(...checkConfigFiles(findings));

  // TypeScript aliases warning
  if (hasTypeScriptAliases(findings)) {
    warnings.push({
      id: "tsconfig.aliases",
      level: "low",
      file: "tsconfig.json",
      message:
        "tsconfig uses baseUrl/paths - ensure test/build/ts-node loaders resolve aliases consistently",
    });
  }

  // Monorepo detection
  if (pkg.workspaces) {
    warnings.push({
      id: "monorepo.detected",
      level: "low",
      file: "package.json",
      message: "monorepo detected - consider using workspace-specific analysis",
    });
  }

  return warnings;
}

/**
 * Remove duplicate items from array
 */
function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

/**
 * Main summarization function
 */
export function summarize(
  findings: InitFinding[],
  cwd: string = process.cwd(),
): InitSummary {
  const pkg = extractPackageInfo(findings);
  const warnings = collectWarnings(pkg, findings, cwd);

  // Extract entries and configs
  const entries = uniq(
    findings.filter((f) => f.kind === "entry").map((f) => f.file),
  );
  const configs = uniq(
    findings.filter((f) => f.kind === "config").map((f) => f.file),
  );

  // Count scripts
  const scriptsSearchResult = findings.find((f) => f.file === "scripts/**");
  const scriptsCount = scriptsSearchResult?.meta?.totalFiles ?? 0;

  return {
    package: pkg,
    entries,
    configs,
    scriptsCount,
    warnings,
  };
}
