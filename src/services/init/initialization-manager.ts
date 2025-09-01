/**
 * InitializationManager - Central orchestrator for init command with self-healing capabilities
 * Phase 2 Implementation: Configuration validation, error recovery, and progress tracking
 */

import * as path from "path";
import * as fs from "fs/promises";
import chalk from "chalk";
import { EventEmitter } from "node:events";
import type {
  InitOptions,
  InitFinding,
  InitSummary,
  InitArtifacts,
  ValidationResult,
  RecoveryStrategy,
  ProgressEvent,
} from "./types";
import { runWithBudget } from "./scanner";
import { summarize } from "./summarize";
import { generateArtifacts } from "./artifacts";
import { writeAtomic } from "./write-atomic";
import { generateMariaMd, generateFallbackMariaMd } from "./maria-template";
import { createReporter, type NarrativeReporter } from "../narrative/index.js";
import { RunIdGenerator } from "../narrative/utils/RunIdGenerator.js";

/**
 * Configuration validator for init command
 */
export class ConfigurationValidator {
  private errors: string[] = [];
  private warnings: string[] = [];

  /**
   * Validate initialization options
   */
  async validate(opts: InitOptions): Promise<ValidationResult> {
    this.errors = [];
    this.warnings = [];

    // Validate working directory
    await this.validateWorkingDirectory(opts.cwd || process.cwd());

    // Validate budget constraints
    this.validateBudgetConstraints(opts);

    // Validate file limits
    this.validateFileLimits(opts);

    // Check for required tools
    await this.validateRequiredTools();

    // Check for monorepo configuration
    await this.validateMonorepoConfig(opts.cwd || process.cwd());

    return {
      valid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
      recommendations: this.generateRecommendations(),
    };
  }

  private async validateWorkingDirectory(cwd: string): Promise<void> {
    try {
      const stats = await fs.stat(cwd);
      if (!stats.isDirectory()) {
        this.errors.push(`Working directory is not a directory: ${cwd}`);
      }

      // Check for package.json
      const packagePath = path.join(cwd, "package.json");
      try {
        await fs.access(packagePath);
      } catch {
        this.warnings.push("No package.json found in working directory");
      }

      // Check for git repository
      const gitPath = path.join(cwd, ".git");
      try {
        await fs.access(gitPath);
      } catch {
        this.warnings.push(
          "Not a git repository - some features may be limited",
        );
      }
    } catch (error) {
      this.errors.push(`Cannot access working directory: ${cwd}`);
    }
  }

  private validateBudgetConstraints(opts: InitOptions): void {
    const budget = opts.budgetMs || 6000;

    if (budget < 1000) {
      this.errors.push("Budget too low (< 1000ms) - may not complete scan");
    } else if (budget < 3000) {
      this.warnings.push("Low budget (< 3000ms) - may skip some files");
    }

    if (budget > 120000) {
      this.warnings.push(
        "Very high budget (> 120s) - consider optimizing scan strategy",
      );
    }
  }

  private validateFileLimits(opts: InitOptions): void {
    const maxLines = opts.maxLines || 200;
    const depth = opts.depth || 4;

    if (maxLines < 50) {
      this.warnings.push("Low line limit (< 50) - may miss important content");
    }

    if (depth > 10) {
      this.warnings.push("High depth (> 10) - may impact performance");
    }
  }

  private async validateRequiredTools(): Promise<void> {
    // Check for Node.js version
    const nodeVersion = process.version;
    const major = parseInt(nodeVersion.split(".")[0].substring(1));
    if (major < 20) {
      this.warnings.push(
        `Node.js ${nodeVersion} detected - recommend v20.10.0+`,
      );
    }

    // Check for pnpm
    try {
      const { execSync } = await import("child_process");
      execSync("pnpm --version", { stdio: "ignore" });
    } catch {
      this.warnings.push("pnpm not found - some features may be limited");
    }
  }

  private async validateMonorepoConfig(cwd: string): Promise<void> {
    try {
      const packagePath = path.join(cwd, "package.json");
      const content = await fs.readFile(packagePath, "utf-8");
      const pkg = JSON.parse(content);

      if (pkg.workspaces) {
        this.warnings.push(
          "Monorepo detected - ensure adequate budget for workspace scanning",
        );
      }
    } catch {
      // Not a critical error
    }
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];

    if (this.warnings.some((w) => w.includes("budget"))) {
      recommendations.push(
        "Consider increasing --budget-ms for comprehensive scanning",
      );
    }

    if (this.warnings.some((w) => w.includes("git"))) {
      recommendations.push(
        "Initialize git repository for full feature support",
      );
    }

    if (this.warnings.some((w) => w.includes("pnpm"))) {
      recommendations.push("Install pnpm for optimal dependency management");
    }

    return recommendations;
  }
}

/**
 * Error recovery manager for init command
 */
export class ErrorRecoveryManager {
  private recoveryStrategies: Map<string, RecoveryStrategy> = new Map();

  constructor() {
    this.initializeStrategies();
  }

  private initializeStrategies(): void {
    // File access errors
    this.recoveryStrategies.set("EACCES", {
      type: "permission",
      action: "skip",
      fallback: "Continue with accessible files",
      recommendation: "Check file permissions",
    });

    // File not found
    this.recoveryStrategies.set("ENOENT", {
      type: "missing",
      action: "ignore",
      fallback: "Skip missing file",
      recommendation: "Verify file paths",
    });

    // Timeout errors
    this.recoveryStrategies.set("TIMEOUT", {
      type: "performance",
      action: "retry-reduced",
      fallback: "Reduce scope and retry",
      recommendation: "Increase --budget-ms or reduce scan depth",
    });

    // Parse errors
    this.recoveryStrategies.set("PARSE_ERROR", {
      type: "syntax",
      action: "skip-parse",
      fallback: "Skip parsing, use basic analysis",
      recommendation: "Fix syntax errors in source files",
    });

    // Memory errors
    this.recoveryStrategies.set("ENOMEM", {
      type: "resource",
      action: "reduce-batch",
      fallback: "Process files in smaller batches",
      recommendation: "Reduce --parallel or increase system memory",
    });
  }

  /**
   * Attempt to recover from error
   */
  async recover(error: Error, context: any): Promise<RecoveryStrategy | null> {
    const errorCode = (error as any).code || error.name;
    const strategy = this.recoveryStrategies.get(errorCode);

    if (!strategy) {
      // Check for partial matches
      for (const [key, strat] of this.recoveryStrategies) {
        if (error.message?.includes(key)) {
          return strat;
        }
      }
      return null;
    }

    // Apply recovery based on strategy
    switch (strategy.action) {
      case "retry-reduced":
        if (context.retryCount < 3) {
          context.budgetMs = Math.floor((context.budgetMs || 6000) * 0.5);
          context.retryCount = (context.retryCount || 0) + 1;
          return strategy;
        }
        break;

      case "reduce-batch":
        context.batchSize = Math.max(
          1,
          Math.floor((context.batchSize || 10) * 0.5),
        );
        return strategy;

      case "skip":
      case "skip-parse":
      case "ignore":
        return strategy;
    }

    return strategy;
  }

  /**
   * Generate recovery report
   */
  generateReport(
    recoveries: Array<{ error: Error; strategy: RecoveryStrategy }>,
  ): string {
    if (recoveries.length === 0) {
      return "No errors encountered during initialization.";
    }

    const grouped = new Map<string, number>();
    recoveries.forEach((r) => {
      const key = r.strategy.type;
      grouped.set(key, (grouped.get(key) || 0) + 1);
    });

    let report = "## Error Recovery Summary\n\n";
    report += `Total errors recovered: ${recoveries.length}\n\n`;

    for (const [type, count] of grouped) {
      report += `- ${type}: ${count} occurrences\n`;
    }

    report += "\n### Recommendations:\n";
    const uniqueRecs = new Set(
      recoveries.map((r) => r.strategy.recommendation),
    );
    for (const rec of uniqueRecs) {
      report += `- ${rec}\n`;
    }

    return report;
  }
}

/**
 * Progress tracker for init command
 */
export class ProgressTracker extends EventEmitter {
  private startTime: number = Date.now();
  private phases: Map<string, { start: number; end?: number; status: string }> =
    new Map();
  private currentPhase: string = "";
  private totalPhases: number = 6;
  private completedPhases: number = 0;
  private reporter?: NarrativeReporter;

  constructor(reporter?: NarrativeReporter) {
    super();
    this.reporter = reporter;
  }

  /**
   * Start a new phase
   */
  startPhase(name: string, description: string): void {
    this.currentPhase = name;
    this.phases.set(name, {
      start: Date.now(),
      status: "in-progress",
    });

    const progress: ProgressEvent = {
      phase: name,
      description,
      progress: (this.completedPhases / this.totalPhases) * 100,
      elapsed: Date.now() - this.startTime,
      status: "in-progress",
    };

    this.emit("progress", progress);

    if (this.reporter) {
      this.reporter.step(
        `Phase ${this.completedPhases + 1}/${this.totalPhases}: ${name}`,
        description,
        `phase.${name.toLowerCase().replace(/\s+/g, "_")}`,
      );
    }
  }

  /**
   * Complete current phase
   */
  completePhase(success: boolean = true, message?: string): void {
    if (!this.currentPhase) return;

    const phase = this.phases.get(this.currentPhase);
    if (phase) {
      phase.end = Date.now();
      phase.status = success ? "completed" : "failed";
    }

    this.completedPhases++;

    const progress: ProgressEvent = {
      phase: this.currentPhase,
      description: message || "",
      progress: (this.completedPhases / this.totalPhases) * 100,
      elapsed: Date.now() - this.startTime,
      status: success ? "completed" : "failed",
    };

    this.emit("progress", progress);

    if (this.reporter && message) {
      if (success) {
        this.reporter.info(message);
      } else {
        this.reporter.warn(message);
      }
    }

    this.currentPhase = "";
  }

  /**
   * Add metric
   */
  addMetric(key: string, value: any): void {
    this.emit("metric", { key, value, timestamp: Date.now() });
  }

  /**
   * Generate progress report
   */
  generateReport(): string {
    const totalTime = Date.now() - this.startTime;
    let report = "## Progress Report\n\n";

    report += `Total execution time: ${(totalTime / 1000).toFixed(2)}s\n`;
    report += `Phases completed: ${this.completedPhases}/${this.totalPhases}\n\n`;

    report += "### Phase Timeline:\n";
    for (const [name, phase] of this.phases) {
      const duration = phase.end
        ? phase.end - phase.start
        : Date.now() - phase.start;
      const status =
        phase.status === "completed"
          ? "✅"
          : phase.status === "failed"
            ? "❌"
            : "⏳";
      report += `- ${status} ${name}: ${(duration / 1000).toFixed(2)}s\n`;
    }

    return report;
  }
}

/**
 * Main InitializationManager class
 */
export class InitializationManager {
  private validator: ConfigurationValidator;
  private recoveryManager: ErrorRecoveryManager;
  private progressTracker: ProgressTracker;
  private reporter?: NarrativeReporter;
  private recoveries: Array<{ error: Error; strategy: RecoveryStrategy }> = [];

  constructor() {
    this.validator = new ConfigurationValidator();
    this.recoveryManager = new ErrorRecoveryManager();
    this.progressTracker = new ProgressTracker();
  }

  /**
   * Initialize with options
   */
  async initialize(opts: InitOptions = {}): Promise<{
    success: boolean;
    artifacts?: InitArtifacts;
    summary?: InitSummary;
    validation?: ValidationResult;
    recoveryReport?: string;
    progressReport?: string;
  }> {
    const startTime = Date.now();

    try {
      // Phase 0: Setup reporter
      const runId = RunIdGenerator.getInstance().generate("init");
      this.reporter = createReporter({
        mode: opts.json
          ? "json"
          : process.env.MARIA_INIT_QUIET
            ? "null"
            : "tty",
        runId,
        verbose: opts.verbose,
        compactThreshold: 100,
      });
      this.progressTracker = new ProgressTracker(this.reporter);

      // Phase 1: Validation
      this.progressTracker.startPhase(
        "Validation",
        "Validating configuration and environment",
      );
      const validation = await this.validator.validate(opts);

      if (!validation.valid) {
        this.progressTracker.completePhase(false, "Validation failed");
        return {
          success: false,
          validation,
          progressReport: this.progressTracker.generateReport(),
        };
      }
      this.progressTracker.completePhase(true, "Configuration validated");

      // Phase 2: Scanning
      this.progressTracker.startPhase(
        "Scanning",
        "Analyzing project structure",
      );
      const findings = await this.performScan(opts);
      this.progressTracker.completePhase(
        true,
        `Scanned ${findings.length} items`,
      );

      // Phase 3: Analysis
      this.progressTracker.startPhase("Analysis", "Building knowledge graph");
      const summary = await this.performAnalysis(findings, opts);
      this.progressTracker.completePhase(true, "Analysis completed");

      // Phase 4: Artifact Generation
      this.progressTracker.startPhase(
        "Generation",
        "Generating documentation artifacts",
      );
      const artifacts = await this.generateArtifacts(
        summary,
        findings,
        startTime,
        opts,
      );
      this.progressTracker.completePhase(true, "Artifacts generated");

      // Phase 5: Writing
      this.progressTracker.startPhase("Writing", "Writing files to disk");
      await this.writeArtifacts(artifacts, opts);
      this.progressTracker.completePhase(true, "Files written successfully");

      // Phase 6: Verification
      this.progressTracker.startPhase(
        "Verification",
        "Verifying output quality",
      );
      const verified = await this.verifyOutput(opts);
      this.progressTracker.completePhase(
        verified,
        verified ? "Output verified" : "Verification failed",
      );

      return {
        success: true,
        artifacts,
        summary,
        validation,
        recoveryReport: this.recoveryManager.generateReport(this.recoveries),
        progressReport: this.progressTracker.generateReport(),
      };
    } catch (error: any) {
      // Attempt recovery
      const strategy = await this.recoveryManager.recover(error, opts);
      if (strategy) {
        this.recoveries.push({ error, strategy });

        if (strategy.action === "retry-reduced" && opts.retryCount < 3) {
          // Retry with reduced scope
          return this.initialize(opts);
        }
      }

      // Generate fallback if critical failure
      if (opts.cwd) {
        const fallbackArtifacts = await this.generateFallbackArtifacts(
          error,
          opts,
        );
        return {
          success: false,
          artifacts: fallbackArtifacts,
          recoveryReport: this.recoveryManager.generateReport(this.recoveries),
          progressReport: this.progressTracker.generateReport(),
        };
      }

      throw error;
    }
  }

  /**
   * Perform scanning with error recovery
   */
  private async performScan(opts: InitOptions): Promise<InitFinding[]> {
    try {
      const { scanRoot, scanBuild, scanQuality, scanScripts, scanEntries } =
        await import("./scanner");

      const tasks = [
        await scanRoot(opts),
        await scanBuild(opts),
        await scanQuality(opts),
        ...(opts.noScripts ? [] : [await scanScripts(opts)]),
        await scanEntries(opts),
      ];

      return await runWithBudget(tasks, opts.budgetMs ?? 6000, 600);
    } catch (error: any) {
      const strategy = await this.recoveryManager.recover(error, opts);
      if (strategy) {
        this.recoveries.push({ error, strategy });
        // Return minimal findings
        return [];
      }
      throw error;
    }
  }

  /**
   * Perform analysis with error recovery
   */
  private async performAnalysis(
    findings: InitFinding[],
    opts: InitOptions,
  ): Promise<InitSummary> {
    try {
      return summarize(findings, opts.cwd || process.cwd());
    } catch (error: any) {
      const strategy = await this.recoveryManager.recover(error, opts);
      if (strategy) {
        this.recoveries.push({ error, strategy });
        // Return minimal summary
        return this.createMinimalSummary(opts);
      }
      throw error;
    }
  }

  /**
   * Generate artifacts with error recovery
   */
  private async generateArtifacts(
    summary: InitSummary,
    findings: InitFinding[],
    startTime: number,
    opts: InitOptions,
  ): Promise<InitArtifacts> {
    try {
      const artifacts = generateArtifacts(summary, findings, startTime);

      // Generate enhanced MARIA.md
      const mariaMd = await this.generateEnhancedMariaMd(summary, opts);
      artifacts["MARIA.md"] = mariaMd;

      return artifacts;
    } catch (error: any) {
      const strategy = await this.recoveryManager.recover(error, opts);
      if (strategy) {
        this.recoveries.push({ error, strategy });
        return this.generateFallbackArtifacts(error, opts);
      }
      throw error;
    }
  }

  /**
   * Generate enhanced MARIA.md
   */
  private async generateEnhancedMariaMd(
    summary: InitSummary,
    opts: InitOptions,
  ): Promise<string> {
    try {
      // Try to generate with full template
      return generateMariaMd({
        projectName:
          summary.projectName || path.basename(opts.cwd || process.cwd()),
        projectPath: opts.cwd || process.cwd(),
        timestamp: new Date().toISOString(),
        summary,
        monorepo: undefined, // Will be enhanced in future phases
        insights: undefined,
        appendix: undefined,
      });
    } catch (error) {
      // Fall back to simpler version
      return generateFallbackMariaMd({
        projectName: summary.projectName || "Unknown Project",
        error: error as Error,
      });
    }
  }

  /**
   * Write artifacts to disk with atomic operations
   */
  private async writeArtifacts(
    artifacts: InitArtifacts,
    opts: InitOptions,
  ): Promise<void> {
    const cwd = opts.cwd || process.cwd();

    for (const [filename, content] of Object.entries(artifacts)) {
      if (typeof content === "string") {
        const filePath = path.join(cwd, filename);
        try {
          await writeAtomic(filePath, content);
          this.progressTracker.addMetric(
            `file_written_${filename}`,
            content.length,
          );
        } catch (error: any) {
          const strategy = await this.recoveryManager.recover(error, {
            filename,
          });
          if (strategy) {
            this.recoveries.push({ error, strategy });
            // Skip this file and continue
            continue;
          }
          throw error;
        }
      }
    }
  }

  /**
   * Verify output quality
   */
  private async verifyOutput(opts: InitOptions): Promise<boolean> {
    const cwd = opts.cwd || process.cwd();
    const mariaMdPath = path.join(cwd, "MARIA.md");

    try {
      const content = await fs.readFile(mariaMdPath, "utf-8");

      // Check minimum requirements
      const minLength = 2000;
      if (content.length < minLength) {
        this.reporter?.warn(
          `MARIA.md is too short (${content.length} < ${minLength})`,
        );
        return false;
      }

      // Check for required sections
      const requiredSections = [
        "## 🚀 Project Overview",
        "## 📁 Project Structure",
        "## 🛠️ Development Commands",
      ];

      for (const section of requiredSections) {
        if (!content.includes(section)) {
          this.reporter?.warn(`Missing required section: ${section}`);
          return false;
        }
      }

      return true;
    } catch (error) {
      this.reporter?.warn("Could not verify MARIA.md output");
      return false;
    }
  }

  /**
   * Create minimal summary for recovery
   */
  private createMinimalSummary(opts: InitOptions): InitSummary {
    const cwd = opts.cwd || process.cwd();
    return {
      projectName: path.basename(cwd),
      projectPath: cwd,
      description: "Project analysis incomplete due to errors",
      techStack: {
        language: "Unknown",
        framework: "Unknown",
        buildTool: "Unknown",
        testFramework: "Unknown",
        packageManager: "Unknown",
        typescript: false,
        hasTests: false,
      },
      structure: {
        totalFiles: 0,
        totalSize: 0,
        avgFileSize: 0,
        largestFile: { path: "", size: 0 },
      },
      warnings: [
        {
          level: "high",
          category: "error-recovery",
          message:
            "Analysis was incomplete due to errors. Results may be partial.",
          file: undefined,
        },
      ],
      commands: {},
      dependencies: [],
    };
  }

  /**
   * Generate fallback artifacts on critical failure
   */
  private async generateFallbackArtifacts(
    error: Error,
    opts: InitOptions,
  ): Promise<InitArtifacts> {
    const cwd = opts.cwd || process.cwd();
    const projectName = path.basename(cwd);

    const mariaMd = generateFallbackMariaMd({
      projectName,
      error,
    });

    const initReport = `# Init Report - Error Recovery Mode

## Error Details
${error.message}

## Recovery Report
${this.recoveryManager.generateReport(this.recoveries)}

## Progress Report
${this.progressTracker.generateReport()}
`;

    return {
      "MARIA.md": mariaMd,
      "INIT_REPORT.md": initReport,
      claudeMd: mariaMd,
      initReportMd: initReport,
      depMapJson: { error: error.message, recoveries: this.recoveries.length },
      initSummaryTxt: `Error during initialization: ${error.message}`,
    };
  }
}

// Export main entry point
export async function runInitWithManager(
  opts: InitOptions = {},
): Promise<boolean> {
  const manager = new InitializationManager();

  try {
    const result = await manager.initialize(opts);

    if (!opts.json && !process.env.MARIA_INIT_QUIET) {
      if (result.success) {
        console.log(chalk.green("✅ Initialization completed successfully"));
      } else {
        console.log(chalk.yellow("⚠️ Initialization completed with warnings"));
      }

      if (result.validation?.warnings.length) {
        console.log(chalk.yellow("\nWarnings:"));
        result.validation.warnings.forEach((w) => console.log(`  - ${w}`));
      }

      if (result.recoveryReport && result.recoveries?.length > 0) {
        console.log(chalk.blue("\nRecovery Report:"));
        console.log(result.recoveryReport);
      }
    }

    return result.success;
  } catch (error: any) {
    console.error(
      chalk.red("❌ Critical initialization error:"),
      error.message,
    );
    return false;
  }
}
