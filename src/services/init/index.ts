/**
 * Main orchestrator for the /init command with intelligent scanning
 */

import * as fs from "fs/promises";
import * as path from "path";
import chalk from "chalk";
import {
  runWithBudget,
  scanRoot,
  scanBuild,
  scanQuality,
  scanScripts,
  scanEntries,
} from "./scanner";
import { summarize } from "./summarize";
import { generateArtifacts } from "./artifacts";
import type {
  InitOptions,
  InitFinding,
  InitSummary,
  InitArtifacts,
} from "./types";
import { scanPhaseA, isMonorepo } from "./phase-a";
import { generateVisualInsights } from "./insights-tables";
import { generateDeepAppendix } from "./deep-appendix";
import { generateMariaMd, generateFallbackMariaMd } from "./maria-template";
import { writeAtomic } from "./write-atomic";
import { createReporter, type NarrativeReporter } from "../narrative/index.js";
import { RunIdGenerator } from "../narrative/utils/RunIdGenerator.js";
import {
  InitializationManager,
  runInitWithManager,
} from "./initialization-manager";

/**
 * Parse CLI flags into options
 */
function parseFlags(
  argv: string[],
): Partial<InitOptions & { manager?: boolean }> {
  const set = new Set(argv);
  const get = (name: string) =>
    argv
      .find((a) => a.startsWith(`${name}=`))
      ?.split("=")
      .slice(1)
      .join("=") ?? undefined;

  return {
    force: set.has("--force"),
    json: set.has("--json"),
    verbose: set.has("--verbose"),
    noScripts: set.has("--no-scripts"),
    scan: set.has("--scan"),
    merge: set.has("--merge"),
    manager: set.has("--manager")
      ? true
      : set.has("--no-manager")
        ? false
        : undefined,
    budgetMs: get("--budget-ms") ? parseInt(get("--budget-ms")!) : undefined,
    maxLines: get("--max-lines") ? parseInt(get("--max-lines")!) : undefined,
    depth: get("--depth") ? parseInt(get("--depth")!) : undefined,
  };
}

/**
 * Check if file exists
 */
async function fileExists(_filePath: string): Promise<boolean> {
  try {
    await fs.access(_filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Create backup of existing file
 */
async function safeBackup(_filePath: string): Promise<void> {
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const bakPath = `${_filePath}.bak.${stamp}`;
    await fs.copyFile(_filePath, bakPath);
    if (!process.env.MARIA_INIT_QUIET) {
      console.log(
        chalk.gray(`  ↳ backup: ${path.relative(process.cwd(), bakPath)}`),
      );
    }
  } catch {
    // Best effort backup
  }
}

/**
 * Display progress with optional verbose details
 */
function displayProgress(finding: InitFinding, verbose: boolean = false): void {
  if (process.env.MARIA_INIT_QUIET) return;
  if (process.env.INIT_LEGACY_LOG === "off") return; // Suppress legacy logs

  const icon = finding.meta?.skipped ? "⏸" : "⏺";
  const action = finding.kind === "search" ? "Search" : "Read";

  console.log(`${icon} ${action}(${finding.file})`);

  if (finding.meta?.skipped) {
    const reason =
      finding.meta.skipped === "timeout"
        ? "timeout - 600ms exceeded"
        : finding.meta.skipped === "budget-exhausted"
          ? "budget exhausted"
          : finding.meta.reason === "size"
            ? `size > 512KB`
            : finding.meta.reason === "sensitive"
              ? "sensitive file"
              : finding.meta.skipped;
    console.log(`  ⎿ Skipped (${reason})`);
  } else if (finding.head) {
    const lines = finding.head.split("\n").length;
    const truncated = finding.truncated ? " (truncated)" : "";
    console.log(
      `  ⎿ Read ${lines} lines${truncated} ${verbose ? "" : "(ctrl+r to expand)"}`,
    );
  } else if (finding.meta?.totalFiles) {
    console.log(
      `  ⎿ Found ${finding.meta.totalFiles} files, sampled ${finding.meta.totalFiles > 5 ? "5" : finding.meta.totalFiles}`,
    );
  }
}

/**
 * Write artifacts to filesystem
 */
async function writeArtifacts(
  artifacts: InitArtifacts,
  opts: InitOptions,
  cwd: string,
  reporter?: NarrativeReporter,
): Promise<void> {
  const files = [
    { name: "MARIA.md", content: artifacts.claudeMd },
    { name: "INIT_REPORT.md", content: artifacts.initReportMd },
    {
      name: "DEPENDENCY_MAP.json",
      content: JSON.stringify(artifacts.depMapJson, null, 2),
    },
    { name: "INIT_SUMMARY.txt", content: artifacts.initSummaryTxt },
  ];

  for (const { name, content } of files) {
    const _filePath = path.join(cwd, name);

    // Backup existing file if it exists and not forcing
    if ((await fileExists(_filePath)) && !opts.force) {
      await safeBackup(_filePath);
    }

    // Use atomic write for safety
    await writeAtomic(_filePath, content);

    // Report file write
    if (reporter) {
      reporter.write(name, content.length);
    }

    if (
      !opts.json &&
      !process.env.MARIA_INIT_QUIET &&
      process.env.INIT_LEGACY_LOG !== "off"
    ) {
      console.log(chalk.green(`✅ Created: ${name}`));
    }
  }
}

/**
 * Main init runner function
 */
export async function runInit(opts: InitOptions = {}): Promise<{
  findings: InitFinding[];
  summary: InitSummary;
  artifacts: InitArtifacts;
}> {
  const startTime = Date.now();
  const cwd = opts.cwd || process.cwd();

  // Create narrative reporter
  const runId = RunIdGenerator.getInstance().generate("init");
  const reporter: NarrativeReporter = createReporter({
    mode: opts.json ? "json" : process.env.MARIA_INIT_QUIET ? "null" : "tty",
    runId,
    verbose: opts.verbose,
    compactThreshold: 100,
  });

  // Show thinking phase
  if (!opts.json && !process.env.MARIA_INIT_QUIET) {
    reporter.thinking(`Analyzing project structure to generate comprehensive documentation.
This process will:
- Scan project files and dependencies
- Analyze build configuration
- Check code quality setup
- Generate MARIA.md and related artifacts`);
  }

  // Phase 1: Scanning
  reporter.step(
    "Phase 1: Scanning Codebase",
    "Analyzing project structure and dependencies",
    "phase1.scan",
  );

  if (
    !opts.json &&
    !process.env.MARIA_INIT_QUIET &&
    process.env.INIT_LEGACY_LOG !== "off"
  ) {
    console.log(chalk.blue("🚀 Analyzing project structure..."));
  }

  // Create task pipeline
  const tasks = [
    await scanRoot(opts),
    await scanBuild(opts),
    await scanQuality(opts),
    ...(opts.noScripts ? [] : [await scanScripts(opts)]),
    await scanEntries(opts),
  ];

  // Run with budget control
  const findings = await runWithBudget(tasks, opts.budgetMs ?? 6000, 600);

  // Display progress if verbose
  if (opts.verbose && !opts.json) {
    findings.forEach((finding) => displayProgress(finding, true));
  }

  // Phase 2: Enhanced Monorepo Detection
  reporter.step(
    "Phase 2: Monorepo Analysis",
    "Detecting workspace structure",
    "phase2.monorepo",
  );

  let monorepoInfo;
  try {
    if (await isMonorepo(cwd)) {
      const phaseA = await scanPhaseA(opts);
      monorepoInfo = phaseA.monorepo;
      reporter.info(
        `Detected ${monorepoInfo.type} monorepo with ${monorepoInfo.stats.totalWorkspaces} workspaces`,
      );
    }
  } catch (e) {
    reporter.warn("Monorepo detection failed, continuing as single project");
  }

  // Phase 3: Building Knowledge Graph
  reporter.step(
    "Phase 3: Building Knowledge Graph",
    "Creating relationships between components",
    "phase3.graph",
  );

  // Summarize findings
  const summary = summarize(findings, cwd);

  // Phase 4: Generate Visual Insights
  reporter.step(
    "Phase 4: Visual Analysis",
    "Creating visual insights and diagrams",
    "phase4.visual",
  );

  let visualInsights;
  try {
    visualInsights = generateVisualInsights({
      files: [],
      techStack: summary.techStack,
      monorepo: monorepoInfo,
    });
  } catch (e) {
    reporter.warn("Visual insights generation failed");
  }

  // Phase 5: Generate Deep Appendix
  reporter.step(
    "Phase 5: Deep Analysis",
    "Extracting technical details",
    "phase5.appendix",
  );

  let deepAppendix;
  try {
    deepAppendix = await generateDeepAppendix({
      files: [],
      monorepo: monorepoInfo,
      projectRoot: cwd,
    });
  } catch (e) {
    reporter.warn("Deep appendix generation failed");
  }

  // Phase 6: Generate Enhanced Artifacts
  reporter.step(
    "Phase 6: Generating Artifacts",
    "Creating documentation files",
    "phase6.artifacts",
  );

  // Generate standard artifacts
  const artifacts = generateArtifacts(summary, findings, startTime);

  // Generate enhanced MARIA.md with template
  const mariaMdContent = generateMariaMd({
    projectName: summary.projectName || path.basename(cwd),
    projectPath: cwd,
    timestamp: new Date().toISOString(),
    summary,
    monorepo: monorepoInfo,
    insights: visualInsights,
    appendix: deepAppendix,
  });

  // Override MARIA.md artifact with enhanced version
  artifacts["MARIA.md"] = mariaMdContent;

  return { findings, summary, artifacts };
}

/**
 * Execute init command (main entry point)
 */
export async function executeInit(
  argv: string[] = [],
  _maria?: unknown,
): Promise<boolean | "exit"> {
  const flags = parseFlags(argv);

  // Check if we should use the new InitializationManager
  const useManager = flags.manager !== false && !process.env.MARIA_INIT_LEGACY;

  if (useManager) {
    // Use the new Phase 2 InitializationManager
    const opts: InitOptions = {
      cwd: process.cwd(),
      budgetMs: 6000,
      maxLines: 200,
      depth: 4,
      ...flags,
    };

    return runInitWithManager(opts);
  }

  // Legacy implementation (preserved for compatibility)
  const startTime = Date.now();
  let reporter: NarrativeReporter | undefined;

  try {
    const opts: InitOptions = {
      cwd: process.cwd(),
      budgetMs: 6000,
      maxLines: 200,
      depth: 4,
      ...flags,
    };

    // Create reporter
    const runId = RunIdGenerator.getInstance().generate("init");
    reporter = createReporter({
      mode: opts.json ? "json" : process.env.MARIA_INIT_QUIET ? "null" : "tty",
      runId,
      verbose: opts.verbose,
    });

    // Set quiet mode for JSON output
    if (opts.json) {
      process.env.MARIA_INIT_QUIET = "true";
    }

    // Run the analysis
    const { _findings, summary, artifacts } = await runInit(opts);

    if (opts.json) {
      // JSON output mode for CI
      console.log(JSON.stringify(artifacts.depMapJson, null, 2));
      process.exitCode = summary.warnings.some((w) => w.level === "high")
        ? 1
        : 0;
    } else {
      // Write artifacts to filesystem
      await writeArtifacts(artifacts, opts, opts.cwd!, reporter);

      // Display summary (suppress if legacy logs are off)
      const metrics = artifacts.depMapJson.metrics;

      if (process.env.INIT_LEGACY_LOG !== "off") {
        console.log(chalk.green("\n🎉 Project analysis completed!"));

        if (opts.verbose) {
          console.log(chalk.gray("\nMetrics:"));
          console.log(chalk.gray(`  • Scan time: ${metrics.scan_ms_total}ms`));
          console.log(chalk.gray(`  • Files read: ${metrics.files_read}`));
          console.log(
            chalk.gray(
              `  • Files skipped: ${metrics.files_skipped} (${metrics.timeouts} timeout, ${metrics.size_truncated} size)`,
            ),
          );
          console.log(chalk.gray(`  • Warnings: ${summary.warnings.length}`));
        }

        console.log(chalk.gray("\nGenerated files:"));
        console.log(chalk.gray("  • MARIA.md - Project operational guide"));
        console.log(
          chalk.gray("  • INIT_REPORT.md - Detailed analysis report"),
        );
        console.log(
          chalk.gray("  • DEPENDENCY_MAP.json - Machine-readable structure"),
        );
        console.log(chalk.gray("  • INIT_SUMMARY.txt - Executive summary"));

        if (summary.warnings.length > 0) {
          console.log(
            chalk.yellow(
              `\n⚠️  Found ${summary.warnings.length} warnings - check MARIA.md for details`,
            ),
          );
        }
      }

      // Generate narrative summary
      if (reporter) {
        const elapsedTime = Date.now() - startTime;
        reporter.summary({
          "Files Scanned": metrics.files_read + metrics.files_skipped,
          "Files Indexed": metrics.files_read,
          "Files Skipped": metrics.files_skipped,
          Warnings: summary.warnings.length,
          "Artifacts Created": 4,
          "Total Time": `${(elapsedTime / 1000).toFixed(1)}s`,
        });
      }
    }

    return true;
  } catch (error: any) {
    if (!process.env.MARIA_INIT_QUIET) {
      console.error(chalk.red("❌ Error during analysis:"), error.message);
      if (process.env.DEBUG) {
        console.error(error.stack);
      }
    }
    return false;
  } finally {
    delete process.env.MARIA_INIT_QUIET;
  }
}
