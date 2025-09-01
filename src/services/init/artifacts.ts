/**
 * Document generation for MARIA.md and other artifacts
 */

import * as _path from "path";
import type {
  InitFinding,
  InitSummary,
  InitArtifacts,
  InitMetrics,
  Warning,
} from "./types";

/**
 * Format package bin information
 */
function formatBin(bin?: Record<string, string> | string): string {
  if (!bin) return "none";
  if (typeof bin === "string") return bin;
  return Object.entries(bin)
    .map(([k, v]) => `${k}:${v}`)
    .join(", ");
}

/**
 * Get warning emoji based on level
 */
function getWarningEmoji(level: string): string {
  switch (level) {
    case "high":
      return "🔴";
    case "medium":
      return "🟡";
    case "low":
      return "🔵";
    default:
      return "⚠️";
  }
}

/**
 * Format warnings for display
 */
function formatWarnings(warnings: Warning[]): string {
  if (warnings.length === 0) return "_No warnings detected_";

  const sorted = warnings.sort((a, b) => {
    const levelOrder = { high: 3, medium: 2, low: 1 };
    return (
      levelOrder[b.level as keyof typeof levelOrder] -
      levelOrder[a.level as keyof typeof levelOrder]
    );
  });

  return sorted
    .map(
      (w) =>
        `- ${getWarningEmoji(w.level)} **${w.level.toUpperCase()}**: ${w.message}`,
    )
    .join("\n");
}

/**
 * Generate recommended actions based on warnings
 */
function generateRecommendations(warnings: Warning[]): string[] {
  const actions: string[] = [];
  const actionMap: Record<string, string> = {
    "script.postinstall.review": "Review and secure postinstall script",
    "script.missing.smoke": "Add `test:smoke` script for basic validation",
    "script.missing.lint-strict": "Add `lint:strict` script for quality gates",
    "script.missing.type-check": "Add `type-check` script for CI validation",
    "bin.missing": "Verify bin → dist alignment after build",
    "config.missing.vitest": "Add vitest.config for test configuration",
    "config.missing.eslint": "Add ESLint configuration with strict rules",
    "tsconfig.aliases": "Align TypeScript aliases with bundler configuration",
    "esm.cjs.mixed": "Resolve ESM/CJS configuration conflicts",
    "monorepo.detected":
      "Consider workspace-specific analysis and configuration",
  };

  const seen = new Set<string>();
  for (const warning of warnings) {
    const action = actionMap[warning.id];
    if (action && !seen.has(action)) {
      actions.push(action);
      seen.add(action);
    }
  }

  // Default recommendations if none specific
  if (actions.length === 0) {
    actions.push(
      "Run smoke tests regularly for quality assurance",
      "Keep dependencies up to date",
      "Add comprehensive test coverage",
    );
  }

  return actions;
}

/**
 * Detect technology stack from package.json and configs
 */
function detectTechStack(_pkg: any, findings: InitFinding[]): string[] {
  const stack: string[] = [];

  // Runtime
  stack.push("Node.js 20+ LTS");

  // Language
  const hasTS = findings.some((f) => f.file.includes("tsconfig"));
  if (hasTS) stack.push("TypeScript");
  else stack.push("JavaScript");

  // Package manager
  if (
    findings.some((f) => f.file === "pnpm-lock.yaml" || f.file === ".npmrc")
  ) {
    stack.push("pnpm");
  } else if (findings.some((f) => f.file === "yarn.lock")) {
    stack.push("Yarn");
  } else {
    stack.push("npm");
  }

  // Build tools
  if (findings.some((f) => f.file.includes("tsup"))) stack.push("tsup");
  if (findings.some((f) => f.file.includes("vite"))) stack.push("Vite");
  if (findings.some((f) => f.file.includes("webpack"))) stack.push("Webpack");
  if (findings.some((f) => f.file.includes("rollup"))) stack.push("Rollup");

  // Testing
  if (findings.some((f) => f.file.includes("vitest"))) stack.push("Vitest");
  if (findings.some((f) => f.file.includes("jest"))) stack.push("Jest");

  // AI Integration
  stack.push("MARIA Platform");

  return stack;
}

/**
 * Calculate metrics from findings
 */
function calculateMetrics(
  findings: InitFinding[],
  startTime: number,
): InitMetrics {
  return {
    scan_ms_total: Date.now() - startTime,
    files_read: findings.filter((f) => !f.meta?.skipped && f.head).length,
    files_skipped: findings.filter((f) => f.meta?.skipped).length,
    warnings_total: 0, // Will be set by caller
    timeouts: findings.filter((f) => f.meta?.skipped === "timeout").length,
    size_truncated: findings.filter(
      (f) => f.truncated && f.meta?.reason === "size",
    ).length,
    sensitive_skipped: findings.filter((f) => f.meta?.reason === "sensitive")
      .length,
  };
}

/**
 * Render a finding for the detailed report
 */
function renderFinding(f: InitFinding): string {
  const title = `### ${f.kind.toUpperCase()} — ${f.file}`;

  let meta = "";
  if (f.meta && Object.keys(f.meta).length > 0) {
    meta = `\n<details><summary>meta</summary>\n\n\`\`\`json\n${safeJsonStringify(f.meta)}\n\`\`\`\n</details>\n`;
  }

  let content = "";
  if (f.head) {
    content = `\n\`\`\`\n${f.head.trim()}\n\`\`\`\n`;
  } else {
    content = "\n_(no preview)_\n";
  }

  const truncInfo = f.truncated ? `\n> _truncated preview_` : "";

  return [title, meta, content, truncInfo, ""].join("\n");
}

/**
 * Safe JSON stringify with fallback
 */
function safeJsonStringify(obj: any): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return JSON.stringify({ error: "Could not serialize object" });
  }
}

/**
 * Generate MARIA.md operational guide
 */
function generateMariaMd(
  summary: InitSummary,
  findings: InitFinding[],
): string {
  const { package: pkg, entries, configs, scriptsCount, warnings } = summary;
  const timestamp = new Date().toISOString();
  const techStack = detectTechStack(pkg, findings);
  const recommendations = generateRecommendations(warnings);

  // Count source files (rough estimate)
  const sourceCount =
    findings.filter((f) => f.kind === "entry" || f.kind === "search").length +
    scriptsCount;

  return `# Project Guide (Generated by /init)

> Generated: ${timestamp}

## What is this

Auto-detected ${pkg.type === "module" ? "ESM" : "CommonJS"} project with ${sourceCount} source files.

**Project**: ${pkg.name || "Unknown Project"}  
**Version**: ${pkg.version || "0.0.0"}  
**Type**: ${pkg.type || "commonjs"}

## Technology Stack

${techStack.map((tech) => `- **${tech.split(" ")[0]}**: ${tech}`).join("\n")}

## How to run

- **Build**: \`pnpm build\`${!pkg.scripts.includes("build") ? " ⚠️ (script missing)" : ""}
- **Test**: \`pnpm test\`${!pkg.scripts.includes("test:smoke") ? " ⚠️ (missing test:smoke - add for CI)" : ""}
- **Type check**: \`pnpm type-check\`${!pkg.scripts.includes("type-check") ? " ⚠️ (not found - add for quality gates)" : ""}
- **Lint**: \`pnpm lint\`${!pkg.scripts.includes("lint:strict") ? " ⚠️ (consider adding lint:strict)" : ""}

## Entry points & outputs

- **Type**: \`${pkg.type || "commonjs"}\` ${pkg.type === "module" ? "(ESM)" : "(CommonJS)"}
- **Main**: \`${pkg.main || "not specified"}\`
- **Bin**: ${formatBin(pkg.bin)}${pkg.bin && warnings.some((w) => w.id === "bin.missing") ? " ⚠️ (ensure dist alignment)" : ""}
- **Exports**: ${pkg.exports ? "configured" : "not specified"}
- **Source entries**: ${entries.length ? entries.map((e) => `\`${e}\``).join(", ") : "none detected"}

## Conventions & boundaries

- **TypeScript aliases**: ${findings.some((f) => f.file === "tsconfig.json" && /"baseUrl"\s*:/.test(f.head || "")) ? "**DETECTED** (align with bundler)" : "**NOT USED**"}
- **ESLint**: ${configs.some((c) => c.startsWith(".eslintrc")) ? "configured" : "not found"} ${configs.some((c) => c.startsWith(".eslintrc")) ? "(consider strict rules)" : "(add for quality gates)"}
- **Test runner**: ${configs.some((c) => c.includes("vitest")) ? "Vitest configured" : configs.some((c) => c.includes("jest")) ? "Jest configured" : "not configured"}
- **Package manager**: ${pkg.workspaces ? "monorepo workspace" : "single package"}

## Known Issues (Auto-Detected)

${formatWarnings(warnings)}

## Recommended Actions

${recommendations.map((action, i) => `${i + 1}. ${action}`).join("\n")}

## Development Commands

### MARIA CODE CLI Commands
\`\`\`bash
# Initialize project analysis
maria /init

# Get help and available commands
maria /help

# Check project status
maria /status

# Advanced analysis
maria /analyze --full
\`\`\`

### Quality Gates
\`\`\`bash
# Run all quality checks
pnpm type-check && pnpm lint && pnpm test:smoke

# Build and verify
pnpm build && pnpm pack --dry-run
\`\`\`

---

*This guide was automatically generated by MARIA /init. Update manually as needed or regenerate with \`maria /init --force\`.*
`;
}

/**
 * Generate detailed analysis report
 */
function generateInitReportMd(
  summary: InitSummary,
  findings: InitFinding[],
  metrics: InitMetrics,
): string {
  const { package: pkg, entries, configs, scriptsCount, warnings } = summary;
  const timestamp = new Date().toISOString();

  return `# INIT REPORT (Raw Findings)

Generated: ${timestamp}

## Executive Summary

- **Project**: ${pkg.name || "-"} @ ${pkg.version || "-"}
- **Type**: ${pkg.type || "commonjs"}
- **Scripts**: ${pkg.scripts.length} (postinstall: ${pkg.hasPostinstall ? "YES" : "NO"})
- **Entries**: ${entries.length}
- **Configs**: ${configs.length}
- **Scripts found**: ${scriptsCount}
- **Warnings**: ${warnings.length}

## Performance Metrics

- **Scan time**: ${metrics.scan_ms_total}ms
- **Files read**: ${metrics.files_read}
- **Files skipped**: ${metrics.files_skipped}
- **Timeouts**: ${metrics.timeouts}
- **Size truncated**: ${metrics.size_truncated}
- **Sensitive skipped**: ${metrics.sensitive_skipped}

## Warnings

${formatWarnings(warnings)}

## File Analysis Results

${findings.map(renderFinding).join("\n")}

---

*Report generated by MARIA /init scanner v3.0.0*
`;
}

/**
 * Generate machine-readable dependency map
 */
function generateDepMapJson(
  summary: InitSummary,
  _findings: InitFinding[],
  metrics: InitMetrics,
): any {
  const { package: pkg, entries, configs, scriptsCount, warnings } = summary;

  return {
    package: {
      name: pkg.name || null,
      version: pkg.version || null,
      private: pkg.name?.startsWith("@") || false,
      workspaces: pkg.workspaces || null,
      type: pkg.type || null,
      scripts: pkg.scripts.sort(),
      hasPostinstall: pkg.hasPostinstall,
      bin: pkg.bin || null,
      main: pkg.main || null,
      exports: pkg.exports || null,
      dependencies: pkg.dependencies?.length || 0,
      devDependencies: pkg.devDependencies?.length || 0,
    },
    structure: {
      entries: entries.sort(),
      configs: configs.sort(),
      scriptsCount,
    },
    warnings: warnings.map((w) => ({
      id: w.id,
      level: w.level,
      file: w.file,
      message: w.message,
      line: w.line || null,
    })),
    metrics,
    generated: new Date().toISOString(),
    generator: "maria-init-v3.0.0",
  };
}

/**
 * Generate executive summary text
 */
function generateInitSummaryTxt(
  summary: InitSummary,
  _findings: InitFinding[],
  metrics: InitMetrics,
): string {
  const { package: pkg, entries, configs, scriptsCount, warnings } = summary;
  const timestamp = new Date().toISOString();

  const lines = [
    `INIT SUMMARY — ${timestamp}`,
    `repo: ${pkg.name || "unknown"}`,
    ``,
    `package.json`,
    `  name: ${pkg.name || "-"}  version: ${pkg.version || "-"}`,
    `  type: ${pkg.type || "-"}   hasPostinstall: ${pkg.hasPostinstall}`,
    `  scripts: ${pkg.scripts.length}`,
    ``,
    `structure:`,
    `  entries: ${entries.length}`,
    `  configs: ${configs.length}`,
    `  scripts found: ${scriptsCount}`,
    ``,
    `performance:`,
    `  scan time: ${metrics.scan_ms_total}ms`,
    `  files read: ${metrics.files_read}`,
    `  files skipped: ${metrics.files_skipped} (${metrics.timeouts} timeout, ${metrics.size_truncated} size, ${metrics.sensitive_skipped} sensitive)`,
    ``,
    `warnings (${warnings.length}):`,
    ...warnings.map((w) => `  - ${w.level.toUpperCase()}: ${w.message}`),
    ``,
  ];

  if (warnings.length > 0) {
    lines.push(`immediate actions:`);
    const actions = generateRecommendations(warnings);
    lines.push(
      ...actions.slice(0, 3).map((action, i) => `  ${i + 1}. ${action}`),
    );
    if (actions.length > 3) lines.push(`  ... and ${actions.length - 3} more`);
  }

  return lines.join("\n");
}

/**
 * Generate all artifacts
 */
export function generateArtifacts(
  summary: InitSummary,
  findings: InitFinding[],
  startTime: number = Date.now(),
): InitArtifacts {
  const metrics = calculateMetrics(findings, startTime);
  metrics.warnings_total = summary.warnings.length;

  return {
    claudeMd: generateMariaMd(summary, findings),
    initReportMd: generateInitReportMd(summary, findings, metrics),
    depMapJson: generateDepMapJson(summary, findings, metrics),
    initSummaryTxt: generateInitSummaryTxt(summary, findings, metrics),
  };
}
