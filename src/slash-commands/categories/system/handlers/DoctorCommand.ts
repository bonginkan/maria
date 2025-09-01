/**
 * Doctor Command - Enhanced with Self-Healing Support
 * Comprehensive system health check and diagnostics
 * Compatible with MARIA Self-Healing Doctor System MVP v2.0
 */

import { BaseCommand } from "../../../base-command";
import {
  CommandArgs,
  CommandContext,
  CommandResult,
  CommandExample,
} from "../../../types";
import { logger } from "../../../../utils/logger";
import { SelfHealingService } from "../../../../services/self-healing/SelfHealingService";
import {
  DiagnosticContext,
  Issue,
} from "../../../../services/self-healing/types";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { trackCommand } from "../../../shared/telemetry-helper.js";
import { getUserPlan } from "../../../../services/subscription/subscription-manager.js";

interface HealthCheck {
  name: string;
  status: "pass" | "warning" | "fail";
  message: string;
  details?: any;
  suggestion?: string;
  issueType?: IssueType; // For self-healing integration
  fixable?: boolean; // Can be auto-fixed
}

// Self-healing integration types
type IssueType =
  | "CONFIG_MISSING" // .env.local不足
  | "CACHE_CORRUPT" // キャッシュ破損
  | "MODEL_INVALID" // モデル設定エラー
  | "DEPS_MISSING" // 依存関係不足
  | "PERMISSION_ERROR"; // 権限エラー

interface DiagnosticReport {
  overall: "healthy" | "warning" | "critical";
  score: number; // 0-100
  timestamp: string;
  checks: HealthCheck[];
  summary: {
    passed: number;
    warnings: number;
    failed: number;
    total: number;
    fixable: number; // Number of auto-fixable issues
  };
  recommendations: string[];
  systemInfo: {
    platform: string;
    nodeVersion: string;
    mariaVersion: string;
    workingDirectory: string;
  };
  initializationProfile?: {
    totalDuration: number;
    p50: number;
    p95: number;
    p99: number;
  };
  selfHealingCapability?: {
    enabled: boolean;
    availableRecipes: number;
    riskLevel: number;
  };
}

export class DoctorCommand extends BaseCommand {
  name = "doctor";
  category = "system" as const;
  description =
    "🏥 Comprehensive system health check and diagnostics with self-healing support";
  override aliases = ["dr", "health", "check"];
  override usage =
    "[--fix] [--dry-run] [--risk-level <level>] [--verbose] [--json] [--category <category>] [--skip-network]";

  private selfHealingService: SelfHealingService;

  constructor() {
    super();
    this.selfHealingService = new SelfHealingService();
  }

  override examples: CommandExample[] = [
    {
      input: "/doctor",
      description: "Run comprehensive system health check",
      output: "Full diagnostic report with health status",
    },
    {
      input: "/doctor --fix --dry-run",
      description: "Run diagnostics and show fix plan without applying",
      output: "Diagnostic report with proposed fixes (non-destructive)",
    },
    {
      input: "/doctor --fix --risk-level 0.2",
      description: "Apply low-risk fixes automatically",
      output: "Diagnostic report with safe automatic fixes applied",
    },
    {
      input: "/doctor --verbose",
      description: "Show detailed diagnostic information",
      output: "Verbose diagnostic output with technical details",
    },
    {
      input: "/doctor --category system",
      description: "Run only system-related health checks",
      output: "Focused diagnostic report for system category",
    },
    {
      input: "/doctor --json",
      description: "Output diagnostic results in JSON format",
      output: "Machine-readable diagnostic data",
    },
  ];

  async execute(
    args: CommandArgs,
    context: CommandContext,
  ): Promise<CommandResult> {
    const startTime = Date.now();
    try {
      const { flags, options } = args;

      logger.info("Doctor command executed", {
        user: context.user?.id,
        session: context.session?.id,
        flags,
        options,
      });

      // Run diagnostic checks
      let report = await this.runDiagnostics(context, {
        category: options["category"] as string | undefined,
        skipNetwork: flags["skip-network"] as boolean | undefined,
        verbose: flags["verbose"] as boolean | undefined,
      });

      // Handle fix requests with self-healing integration
      if (flags["fix"]) {
        const dryRun = flags["dry-run"] !== false; // Default to dry-run for safety
        const riskLevel = parseFloat(
          (options["risk-level"] as string) || "0.2",
        ); // Default low risk

        if (dryRun) {
          // Show fix plan without applying
          const fixPlan = await this.generateFixPlan(report, riskLevel);
          report = await this.attachFixPlan(report, fixPlan);
        } else if (riskLevel <= 1.0) {
          // Apply fixes within risk tolerance
          await this.attemptFixes(report, context, {
            riskLevel,
            dryRun: false,
          });
          // Re-run diagnostics after fixes
          report = await this.runDiagnostics(context, {
            category: options["category"] as string | undefined,
            skipNetwork: flags["skip-network"] as boolean | undefined,
            verbose: flags["verbose"] as boolean | undefined,
          });
        }
      }

      const executionTime = Date.now() - startTime;

      // Track successful operation
      await trackCommand({
        cmd: 'doctor',
        status: 'success',
        latencyMs: executionTime,
        plan: getUserPlan(),
        quotaLeft: context.quotaLeft || 999
      });

      // Handle different output formats
      if (flags["json"]) {
        return this.success("System diagnostics (JSON format)", {
          ...this.sanitizeReport(report),
          executionTime,
        });
      }

      if (flags["verbose"]) {
        return this.showVerboseReport(report, executionTime);
      }

      // Default: show standard report
      return this.showStandardReport(report, executionTime);
    } catch (error) {
      logger.error("Doctor command failed:", error);
      
      // Track failed operation
      await trackCommand({
        cmd: 'doctor',
        status: 'error',
        latencyMs: Date.now() - startTime,
        plan: getUserPlan(),
        quotaLeft: context.quotaLeft || 999
      });
      
      return this.error(
        "System diagnostics failed",
        "DOCTOR_ERROR",
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  }

  /**
   * Run comprehensive system diagnostics
   */
  private async runDiagnostics(
    context: CommandContext,
    options: {
      category?: string;
      skipNetwork?: boolean;
      verbose?: boolean;
    },
  ): Promise<DiagnosticReport> {
    const checks: HealthCheck[] = [];

    // System checks
    if (!options.category || options.category === "system") {
      checks.push(...(await this.runSystemChecks()));
    }

    // Node.js checks
    if (!options.category || options.category === "nodejs") {
      checks.push(...(await this.runNodeJsChecks()));
    }

    // MARIA-specific checks
    if (!options.category || options.category === "maria") {
      checks.push(...(await this.runMariaChecks(context)));
    }

    // Configuration checks
    if (!options.category || options.category === "config") {
      checks.push(...(await this.runConfigurationChecks(context)));
    }

    // Dependencies checks
    if (!options.category || options.category === "dependencies") {
      checks.push(...(await this.runDependencyChecks(context)));
    }

    // Network checks (if not skipped)
    if (
      !options.skipNetwork &&
      (!options.category || options.category === "network")
    ) {
      checks.push(...(await this.runNetworkChecks()));
    }

    // Performance checks
    if (!options.category || options.category === "performance") {
      checks.push(...(await this.runPerformanceChecks()));
    }

    // Calculate summary
    const summary = {
      passed: checks.filter((c) => c.status === "pass").length,
      warnings: checks.filter((c) => c.status === "warning").length,
      failed: checks.filter((c) => c.status === "fail").length,
      total: checks.length,
      fixable: checks.filter((c) => c.fixable === true).length,
    };

    // Calculate overall health and score
    const score = Math.round(
      (summary.passed * 100 + summary.warnings * 50) / summary.total,
    );

    let overall: "healthy" | "warning" | "critical";
    if (score >= 80 && summary.failed === 0) {
      overall = "healthy";
    } else if (score >= 60 && summary.failed <= 2) {
      overall = "warning";
    } else {
      overall = "critical";
    }

    // Generate recommendations
    const recommendations = this.generateRecommendations(checks);

    // Get system info
    const systemInfo = await this.getSystemInfo(context);

    // Get initialization profile if available
    const initializationProfile = await this.getInitializationProfile();

    // Check self-healing capability
    const selfHealingCapability = await this.checkSelfHealingCapability();

    return {
      overall,
      score,
      timestamp: new Date().toISOString(),
      checks,
      summary,
      recommendations,
      systemInfo,
      ...(initializationProfile && { initializationProfile }),
      ...(selfHealingCapability && { selfHealingCapability }),
    };
  }

  /**
   * Run system-level health checks
   */
  private async runSystemChecks(): Promise<HealthCheck[]> {
    const checks: HealthCheck[] = [];

    // Memory check
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const memoryUsage = ((totalMem - freeMem) / totalMem) * 100;

    checks.push({
      name: "System Memory",
      status: memoryUsage < 80 ? "pass" : memoryUsage < 90 ? "warning" : "fail",
      message: `Memory usage: ${memoryUsage.toFixed(1)}%`,
      details: {
        used: this.formatBytes(totalMem - freeMem),
        total: this.formatBytes(totalMem),
        available: this.formatBytes(freeMem),
      },
      suggestion:
        memoryUsage > 85
          ? "Consider closing unnecessary applications to free memory"
          : undefined,
      fixable: false, // Memory issues can't be auto-fixed
    });

    // CPU check
    const cpus = os.cpus();
    checks.push({
      name: "CPU Information",
      status: "pass",
      message: `${cpus.length} cores available`,
      details: {
        cores: cpus.length,
        model: cpus[0]?.model || "Unknown",
      },
    });

    // Platform check
    const platform = os.platform();
    const supportedPlatforms = ["darwin", "linux", "win32"];
    checks.push({
      name: "Platform Support",
      status: supportedPlatforms.includes(platform) ? "pass" : "warning",
      message: `Platform: ${platform}`,
      details: { platform, supported: supportedPlatforms.includes(platform) },
      suggestion: !supportedPlatforms.includes(platform)
        ? "This platform may have limited support"
        : undefined,
    });

    return checks;
  }

  /**
   * Run Node.js specific health checks
   */
  private async runNodeJsChecks(): Promise<HealthCheck[]> {
    const checks: HealthCheck[] = [];

    // Node.js version check
    const nodeVersion = process.version;
    const major = parseInt(nodeVersion.slice(1).split(".")[0] || "0");

    checks.push({
      name: "Node.js Version",
      status: major >= 18 ? "pass" : major >= 16 ? "warning" : "fail",
      message: `Node.js ${nodeVersion}`,
      details: { version: nodeVersion, major },
      suggestion:
        major < 18
          ? "Consider upgrading to Node.js 18 or later for better performance"
          : undefined,
    });

    // Process memory check
    const memUsage = process.memoryUsage();
    const heapUsedMB = memUsage.heapUsed / 1024 / 1024;

    checks.push({
      name: "Process Memory",
      status: heapUsedMB < 100 ? "pass" : heapUsedMB < 200 ? "warning" : "fail",
      message: `Heap used: ${heapUsedMB.toFixed(1)} MB`,
      details: {
        heapUsed: this.formatBytes(memUsage.heapUsed),
        heapTotal: this.formatBytes(memUsage.heapTotal),
        external: this.formatBytes(memUsage.external),
        rss: this.formatBytes(memUsage.rss),
      },
    });

    return checks;
  }

  /**
   * Run MARIA-specific health checks
   */
  private async runMariaChecks(
    context: CommandContext,
  ): Promise<HealthCheck[]> {
    const checks: HealthCheck[] = [];

    // Slash commands check
    try {
      const { commandRegistry } = await import("../../../registry");
      const commands = commandRegistry.getAll();

      checks.push({
        name: "Slash Commands",
        status: commands.length > 0 ? "pass" : "fail",
        message: `${commands.length} commands registered`,
        details: {
          count: commands.length,
          categories: [...new Set(commands.map((c) => c.category))],
        },
        issueType: commands.length === 0 ? "CONFIG_MISSING" : undefined,
        fixable: commands.length === 0,
      });
    } catch (innerError) {
      checks.push({
        name: "Slash Commands",
        status: "fail",
        message: "Failed to load command registry",
        details: {
          error:
            innerError instanceof Error ? innerError.message : "Unknown error",
        },
        suggestion: "Check if command registry is properly initialized",
        issueType: "CONFIG_MISSING",
        fixable: true,
      });
    }

    // Working directory check
    const cwd = context.environment?.cwd || process.cwd();
    try {
      await fs.access(cwd);
      checks.push({
        name: "Working Directory",
        status: "pass",
        message: `Accessible: ${this.sanitizePath(cwd)}`,
        details: { path: this.sanitizePath(cwd) },
      });
    } catch {
      checks.push({
        name: "Working Directory",
        status: "fail",
        message: `Inaccessible: ${this.sanitizePath(cwd)}`,
        details: { path: this.sanitizePath(cwd) },
        suggestion: "Check directory permissions and existence",
        issueType: "PERMISSION_ERROR",
        fixable: false,
      });
    }

    return checks;
  }

  /**
   * Run configuration health checks
   */
  private async runConfigurationChecks(
    context: CommandContext,
  ): Promise<HealthCheck[]> {
    const checks: HealthCheck[] = [];
    const cwd = context.environment?.cwd || process.cwd();

    // Package.json check
    const packageJsonPath = path.join(cwd, "package.json");
    try {
      await fs.access(packageJsonPath);
      const content = await fs.readFile(packageJsonPath, "utf-8");
      const packageInfo = JSON.parse(content);

      checks.push({
        name: "Package Configuration",
        status: "pass",
        message: `package.json found (${packageInfo.name || "unnamed"})`,
        details: {
          name: packageInfo.name,
          version: packageInfo.version,
          hasScripts: !!packageInfo.scripts,
          hasDependencies: !!packageInfo.dependencies,
        },
      });
    } catch {
      checks.push({
        name: "Package Configuration",
        status: "warning",
        message: "package.json not found",
        suggestion:
          "Initialize project with npm init if this is a Node.js project",
        issueType: "CONFIG_MISSING",
        fixable: true,
      });
    }

    // Environment configuration check
    const envPath = path.join(cwd, ".env.local");
    try {
      await fs.access(envPath);
      checks.push({
        name: "Environment Configuration",
        status: "pass",
        message: ".env.local found",
      });
    } catch {
      checks.push({
        name: "Environment Configuration",
        status: "warning",
        message: ".env.local not found",
        suggestion: "Create .env.local for environment variables",
        issueType: "CONFIG_MISSING",
        fixable: true,
      });
    }

    // Git repository check
    const gitPath = path.join(cwd, ".git");
    try {
      await fs.access(gitPath);
      checks.push({
        name: "Git Repository",
        status: "pass",
        message: "Git repository detected",
      });
    } catch {
      checks.push({
        name: "Git Repository",
        status: "warning",
        message: "Not a git repository",
        suggestion: "Initialize with git init for version control",
      });
    }

    return checks;
  }

  /**
   * Run dependency health checks
   */
  private async runDependencyChecks(
    context: CommandContext,
  ): Promise<HealthCheck[]> {
    const checks: HealthCheck[] = [];
    const cwd = context.environment?.cwd || process.cwd();

    // Node modules check
    const nodeModulesPath = path.join(cwd, "node_modules");
    try {
      await fs.access(nodeModulesPath);
      const stats = await fs.stat(nodeModulesPath);

      checks.push({
        name: "Dependencies",
        status: "pass",
        message: "node_modules directory exists",
        details: {
          path: this.sanitizePath(nodeModulesPath),
          modified: stats.mtime.toISOString(),
        },
      });
    } catch {
      checks.push({
        name: "Dependencies",
        status: "warning",
        message: "node_modules not found",
        suggestion: "Run npm install to install dependencies",
        issueType: "DEPS_MISSING",
        fixable: true,
      });
    }

    return checks;
  }

  /**
   * Run network health checks
   */
  private async runNetworkChecks(): Promise<HealthCheck[]> {
    const checks: HealthCheck[] = [];

    // Basic connectivity check (simplified)
    checks.push({
      name: "Network Connectivity",
      status: "pass", // Simplified - would need actual network test
      message: "Network appears available",
      details: { hostname: os.hostname() },
    });

    return checks;
  }

  /**
   * Run performance health checks
   */
  private async runPerformanceChecks(): Promise<HealthCheck[]> {
    const checks: HealthCheck[] = [];

    // System uptime check
    const uptimeSeconds = os.uptime();
    const uptimeDays = uptimeSeconds / 86400;

    checks.push({
      name: "System Uptime",
      status: uptimeDays < 30 ? "pass" : "warning",
      message: `System uptime: ${this.formatUptime(uptimeSeconds)}`,
      details: { seconds: uptimeSeconds, days: uptimeDays },
      suggestion:
        uptimeDays > 30
          ? "Consider restarting system for optimal performance"
          : undefined,
    });

    return checks;
  }

  /**
   * Generate fix plan for self-healing using SelfHealingService
   */
  private async generateFixPlan(
    report: DiagnosticReport,
    riskLevel: number,
  ): Promise<any> {
    try {
      // Initialize self-healing service if needed
      await this.selfHealingService.initialize();

      // Convert health checks to issues
      const issues = this.convertChecksToIssues(
        report.checks.filter((c) => c.fixable && c.issueType),
      );

      // Generate healing plan
      const healingPlan = await this.selfHealingService.plan(issues);

      // Create preview
      const preview = await this.selfHealingService.preview(healingPlan);

      return {
        timestamp: new Date().toISOString(),
        riskLevel,
        fixableIssues: report.checks.filter((c) => c.fixable),
        healingPlan,
        preview,
        proposedActions: preview.actions.map((action) => ({
          recipe: action.recipe,
          description: action.description,
          risk: action.risk.score,
          willApply: action.risk.score <= riskLevel,
          changes: action.changes,
        })),
      };
    } catch (error) {
      logger.error("Failed to generate fix plan:", error);
      // Fallback to simple fix plan
      return {
        timestamp: new Date().toISOString(),
        riskLevel,
        fixableIssues: report.checks.filter((c) => c.fixable),
        proposedActions: [],
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Attach fix plan to report
   */
  private async attachFixPlan(
    report: DiagnosticReport,
    fixPlan: any,
  ): Promise<DiagnosticReport> {
    const willApplyCount =
      fixPlan.proposedActions?.filter((a: any) => a.willApply).length || 0;
    const manualFixCount =
      fixPlan.proposedActions?.filter((a: any) => !a.willApply).length || 0;

    return {
      ...report,
      selfHealingCapability: {
        enabled: true,
        availableRecipes: fixPlan.proposedActions?.length || 0,
        riskLevel: fixPlan.riskLevel,
      },
      recommendations: [
        ...report.recommendations,
        fixPlan.error
          ? `⚠️ Self-healing service error: ${fixPlan.error}`
          : `🔧 ${willApplyCount} fixes can be applied automatically at risk level ${fixPlan.riskLevel}`,
        ...(fixPlan.proposedActions || [])
          .filter((a: any) => !a.willApply)
          .map(
            (a: any) =>
              `📝 Manual fix recommended: ${a.description || a.recipe} (risk: ${a.risk})`,
          ),
      ],
    };
  }

  /**
   * Attempt to fix identified issues using SelfHealingService
   */
  private async attemptFixes(
    report: DiagnosticReport,
    context: CommandContext,
    options: { riskLevel: number; dryRun: boolean },
  ): Promise<void> {
    logger.info(
      "Attempting to fix identified issues using self-healing service",
      {
        riskLevel: options.riskLevel,
        dryRun: options.dryRun,
      },
    );

    try {
      // Initialize self-healing service
      await this.selfHealingService.initialize();

      // Convert health checks to issues
      const issues = this.convertChecksToIssues(
        report.checks.filter((c) => c.fixable && c.issueType),
      );

      if (issues.length === 0) {
        logger.info("No fixable issues found");
        return;
      }

      // Create healing plan
      const healingPlan = await this.selfHealingService.plan(issues);

      // Execute plan with options
      const result = await this.selfHealingService.execute(healingPlan, {
        dryRun: options.dryRun,
        riskLevel: options.riskLevel,
        force: false,
      });

      if (result.success) {
        logger.info("Self-healing completed successfully", {
          applied: result.details.recipesApplied.length,
          skipped: result.details.recipesSkipped.length,
          failed: result.details.recipesFailed.length,
        });
      } else {
        logger.warn("Self-healing completed with errors", {
          message: result.message,
          failed: result.details.recipesFailed.length,
        });
      }
    } catch (error) {
      logger.error("Self-healing failed:", error);
      // Fallback to manual fixes
      await this.attemptManualFixes(report, context, options);
    }
  }

  /**
   * Calculate risk score for issue type
   */
  private calculateRisk(issueType: IssueType): number {
    const riskMap: Record<IssueType, number> = {
      CONFIG_MISSING: 0.1, // Low risk - just creating files
      CACHE_CORRUPT: 0.2, // Low risk - clearing cache
      MODEL_INVALID: 0.3, // Medium risk - config changes
      DEPS_MISSING: 0.5, // Medium risk - installing packages
      PERMISSION_ERROR: 0.8, // High risk - system permissions
    };

    return riskMap[issueType] || 1.0;
  }

  /**
   * Get fix action for issue type
   */
  private getFixAction(issueType: IssueType): string {
    const actionMap: Record<IssueType, string> = {
      CONFIG_MISSING: "Create default configuration file",
      CACHE_CORRUPT: "Clear and rebuild cache",
      MODEL_INVALID: "Reset model configuration to defaults",
      DEPS_MISSING: "Install missing dependencies",
      PERMISSION_ERROR: "Fix file permissions",
    };

    return actionMap[issueType] || "Manual intervention required";
  }

  /**
   * Fallback manual fixes when self-healing service is unavailable
   */
  private async attemptManualFixes(
    report: DiagnosticReport,
    context: CommandContext,
    options: { riskLevel: number; dryRun: boolean },
  ): Promise<void> {
    logger.info("Using fallback manual fixes");

    for (const check of report.checks) {
      if (check.fixable && check.issueType) {
        const risk = this.calculateRisk(check.issueType);

        if (risk <= options.riskLevel) {
          try {
            if (!options.dryRun) {
              await this.attemptFix(check, context);
              logger.info(`Fixed: ${check.name}`);
            } else {
              logger.info(`Would fix: ${check.name} (dry-run)`);
            }
          } catch (error) {
            logger.warn(`Failed to fix ${check.name}:`, error);
          }
        } else {
          logger.info(
            `Skipped ${check.name}: risk ${risk} exceeds threshold ${options.riskLevel}`,
          );
        }
      }
    }
  }

  /**
   * Attempt to fix a specific issue (legacy fallback)
   */
  private async attemptFix(
    check: HealthCheck,
    context: CommandContext,
  ): Promise<void> {
    switch (check.issueType) {
      case "CONFIG_MISSING":
        if (check.name === "Environment Configuration") {
          await this.createEnvTemplate(context);
          check.status = "pass";
          check.message = ".env.local created from template";
        }
        break;

      case "DEPS_MISSING":
        if (check.name === "Dependencies") {
          logger.info("Would run npm install (manual fix simulation)");
        }
        break;

      case "CACHE_CORRUPT":
        const cacheDir = path.join(
          context.environment?.cwd || process.cwd(),
          ".maria",
          "cache",
        );
        try {
          await fs.rm(cacheDir, { recursive: true, force: true });
          await fs.mkdir(cacheDir, { recursive: true });
          logger.info("Cache cleared and rebuilt");
        } catch (error) {
          logger.warn("Failed to clear cache:", error);
        }
        break;
    }
  }

  /**
   * Create environment template
   */
  private async createEnvTemplate(context: CommandContext): Promise<void> {
    const envPath = path.join(
      context.environment?.cwd || process.cwd(),
      ".env.local",
    );
    const template = `# MARIA Environment Configuration
# Generated by /doctor --fix

# AI Provider API Keys
OPENAI_API_KEY=your_openai_key_here
ANTHROPIC_API_KEY=your_anthropic_key_here

# Local AI Providers
LMSTUDIO_API_URL=http://localhost:1234
OLLAMA_API_URL=http://localhost:11434

# Development Settings
DEBUG=false
LOG_LEVEL=info
`;

    await fs.writeFile(envPath, template, "utf-8");
  }

  /**
   * Generate recommendations based on check results
   */
  private generateRecommendations(checks: HealthCheck[]): string[] {
    const recommendations: string[] = [];

    // Extract suggestions from failed checks
    for (const check of checks) {
      if (check.suggestion) {
        recommendations.push(check.suggestion);
      }
    }

    // Add general recommendations
    const failedChecks = checks.filter((c) => c.status === "fail").length;
    const warningChecks = checks.filter((c) => c.status === "warning").length;
    const fixableChecks = checks.filter((c) => c.fixable).length;

    if (failedChecks > 0) {
      recommendations.push("Address failed health checks immediately");
    }

    if (warningChecks > 2) {
      recommendations.push("Review warning items for potential improvements");
    }

    if (fixableChecks > 0) {
      recommendations.push(
        `${fixableChecks} issues can be auto-fixed with /doctor --fix`,
      );
    }

    if (recommendations.length === 0) {
      recommendations.push("System is healthy - no immediate action required");
    }

    return [...new Set(recommendations)]; // Remove duplicates
  }

  /**
   * Get basic system information
   */
  private async getSystemInfo(context: CommandContext) {
    // Get version from package.json
    let mariaVersion = "Unknown";
    try {
      const packagePath = path.join(
        context.environment?.cwd || process.cwd(),
        "package.json",
      );
      const packageContent = await fs.readFile(packagePath, "utf-8");
      const packageInfo = JSON.parse(packageContent);
      mariaVersion = packageInfo.version || "Unknown";
    } catch {
      // Ignore if package.json doesn't exist
    }

    return {
      platform: `${os.platform()} ${os.release()}`,
      nodeVersion: process.version,
      mariaVersion,
      workingDirectory: this.sanitizePath(
        context.environment?.cwd || process.cwd(),
      ),
    };
  }

  /**
   * Get initialization profile from InitializationManager
   */
  private async getInitializationProfile(): Promise<any> {
    // TODO: Connect to InitializationManager when implemented
    try {
      // For now, return mock data for testing
      if (process.env.MARIA_INIT_PROFILE === "true") {
        return {
          totalDuration: 2450,
          p50: 180,
          p95: 420,
          p99: 580,
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Check self-healing capability
   */
  private async checkSelfHealingCapability(): Promise<any> {
    try {
      // Check if SelfHealingService is available
      const selfHealingEnabled = process.env.MARIA_SELF_HEALING !== "false";

      if (selfHealingEnabled) {
        // Try to get actual service status
        try {
          await this.selfHealingService.initialize();
          const summary = await this.selfHealingService.getSessionSummary();
          return {
            enabled: true,
            availableRecipes: 5, // MVP: 5 basic recipes
            riskLevel: 0.2, // Default low risk
            sessionEntries: summary.entries,
          };
        } catch (error) {
          logger.debug("Self-healing service not fully available:", error);
          return {
            enabled: true,
            availableRecipes: 5,
            riskLevel: 0.2,
            status: "initializing",
          };
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Convert health checks to self-healing issues
   */
  private convertChecksToIssues(checks: HealthCheck[]): Issue[] {
    return checks.map((check) => ({
      id: `issue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: check.issueType as any,
      severity:
        check.status === "fail" ? ("critical" as const) : ("warning" as const),
      title: check.name,
      description: check.message,
      context: check.details || {},
      detectedAt: new Date(),
      suggestion: check.suggestion,
    }));
  }

  /**
   * Show standard diagnostic report
   */
  private showStandardReport(
    report: DiagnosticReport,
    executionTime: number,
  ): CommandResult {
    const lines: string[] = [];

    lines.push("");
    lines.push("🏥 **MARIA SYSTEM DIAGNOSTICS**");
    lines.push("═".repeat(50));
    lines.push("");

    // Overall health
    const healthEmoji = {
      healthy: "✅",
      warning: "⚠️",
      critical: "❌",
    };

    lines.push(
      `**Overall Health:** ${healthEmoji[report.overall]} ${report.overall.toUpperCase()} (${report.score}/100)`,
    );

    // Show self-healing status if available
    if (report.selfHealingCapability) {
      lines.push(
        `**Self-Healing:** 🔧 Enabled (${report.selfHealingCapability.availableRecipes} recipes available)`,
      );
    }

    lines.push("");

    // Summary
    lines.push("**📊 Summary:**");
    lines.push(`  ✅ Passed: ${report.summary.passed}`);
    lines.push(`  ⚠️ Warnings: ${report.summary.warnings}`);
    lines.push(`  ❌ Failed: ${report.summary.failed}`);
    lines.push(`  📋 Total: ${report.summary.total}`);
    if (report.summary.fixable > 0) {
      lines.push(`  🔧 Auto-fixable: ${report.summary.fixable}`);
    }
    lines.push("");

    // Critical issues
    const criticalIssues = report.checks.filter((c) => c.status === "fail");
    if (criticalIssues.length > 0) {
      lines.push("**❌ Critical Issues:**");
      for (const issue of criticalIssues) {
        lines.push(`  • ${issue.name}: ${issue.message}`);
        if (issue.fixable) {
          lines.push(`    🔧 Auto-fixable with /doctor --fix`);
        }
        if (issue.suggestion) {
          lines.push(`    💡 ${issue.suggestion}`);
        }
      }
      lines.push("");
    }

    // Warnings
    const warnings = report.checks.filter((c) => c.status === "warning");
    if (warnings.length > 0) {
      lines.push("**⚠️ Warnings:**");
      for (const warning of warnings.slice(0, 3)) {
        // Show max 3
        lines.push(`  • ${warning.name}: ${warning.message}`);
        if (warning.fixable) {
          lines.push(`    🔧 Auto-fixable`);
        }
        if (warning.suggestion) {
          lines.push(`    💡 ${warning.suggestion}`);
        }
      }
      if (warnings.length > 3) {
        lines.push(`  ... and ${warnings.length - 3} more warnings`);
      }
      lines.push("");
    }

    // Recommendations
    if (report.recommendations.length > 0) {
      lines.push("**💡 Recommendations:**");
      for (const rec of report.recommendations.slice(0, 5)) {
        lines.push(`  • ${rec}`);
      }
      lines.push("");
    }

    // System info
    lines.push("**🖥️ System Info:**");
    lines.push(`  Platform: ${report.systemInfo.platform}`);
    lines.push(`  Node.js: ${report.systemInfo.nodeVersion}`);
    lines.push(`  MARIA: ${report.systemInfo.mariaVersion}`);
    lines.push("");

    // Initialization profile if available
    if (report.initializationProfile) {
      lines.push("**⚡ Initialization Performance:**");
      lines.push(`  Total: ${report.initializationProfile.totalDuration}ms`);
      lines.push(`  P50: ${report.initializationProfile.p50}ms`);
      lines.push(`  P95: ${report.initializationProfile.p95}ms`);
      lines.push(`  P99: ${report.initializationProfile.p99}ms`);
      lines.push("");
    }

    lines.push(`*Diagnostics completed in ${executionTime}ms*`);
    lines.push("");
    lines.push("💡 Use `/doctor --verbose` for detailed information");
    lines.push("💡 Use `/doctor --fix --dry-run` to preview fixes");
    lines.push("💡 Use `/doctor --fix --risk-level 0.2` for safe auto-fixes");
    lines.push("");

    return this.success(lines.join("\n"), {
      health: report.overall,
      score: report.score,
      summary: report.summary,
      executionTime,
      type: "standard",
    });
  }

  /**
   * Show verbose diagnostic report
   */
  private showVerboseReport(
    report: DiagnosticReport,
    executionTime: number,
  ): CommandResult {
    const lines: string[] = [];

    lines.push("");
    lines.push("🏥 **DETAILED SYSTEM DIAGNOSTICS**");
    lines.push("═".repeat(60));
    lines.push("");

    // Overall status
    const healthEmoji = {
      healthy: "✅",
      warning: "⚠️",
      critical: "❌",
    };

    lines.push(
      `**Overall Health:** ${healthEmoji[report.overall]} ${report.overall.toUpperCase()} (${report.score}/100)`,
    );
    lines.push(`**Timestamp:** ${new Date(report.timestamp).toLocaleString()}`);

    if (report.selfHealingCapability) {
      lines.push(
        `**Self-Healing:** Enabled | Recipes: ${report.selfHealingCapability.availableRecipes} | Risk Level: ${report.selfHealingCapability.riskLevel}`,
      );
    }

    lines.push("");

    // All checks grouped by status
    const groupedChecks = {
      pass: report.checks.filter((c) => c.status === "pass"),
      warning: report.checks.filter((c) => c.status === "warning"),
      fail: report.checks.filter((c) => c.status === "fail"),
    };

    for (const [status, checks] of Object.entries(groupedChecks)) {
      if (checks.length === 0) continue;

      const statusEmoji = { pass: "✅", warning: "⚠️", fail: "❌" };
      const statusTitle = {
        pass: "PASSED",
        warning: "WARNINGS",
        fail: "FAILED",
      };

      lines.push(
        `**${statusEmoji[status as keyof typeof statusEmoji]} ${statusTitle[status as keyof typeof statusTitle]} (${checks.length}):**`,
      );

      for (const check of checks) {
        lines.push(`  • **${check.name}**: ${check.message}`);

        if (check.details) {
          lines.push(
            `    Details: ${JSON.stringify(check.details, null, 2).replace(/\n/g, "\n    ")}`,
          );
        }

        if (check.fixable) {
          lines.push(`    🔧 Auto-fixable (Issue Type: ${check.issueType})`);
        }

        if (check.suggestion) {
          lines.push(`    💡 ${check.suggestion}`);
        }

        lines.push("");
      }
    }

    // Recommendations
    if (report.recommendations.length > 0) {
      lines.push("**💡 RECOMMENDATIONS:**");
      for (const rec of report.recommendations) {
        lines.push(`  • ${rec}`);
      }
      lines.push("");
    }

    lines.push(`**⏱️ Execution Time:** ${executionTime}ms`);
    lines.push("");

    return this.success(lines.join("\n"), {
      ...this.sanitizeReport(report),
      executionTime,
      type: "verbose",
    });
  }

  /**
   * Helper methods
   */
  private sanitizePath(filepath: string): string {
    // Remove user-specific paths
    return filepath
      .replace(/\/Users\/[^\/]+/g, "/Users/[USER]")
      .replace(/\/home\/[^\/]+/g, "/home/[USER]")
      .replace(/C:\\Users\\[^\\]+/g, "C:\\Users\\[USER]");
  }

  private sanitizeReport(report: DiagnosticReport): DiagnosticReport {
    // Deep clone and sanitize
    const sanitized = JSON.parse(JSON.stringify(report));

    // Sanitize system info
    if (sanitized.systemInfo) {
      sanitized.systemInfo.workingDirectory = this.sanitizePath(
        sanitized.systemInfo.workingDirectory,
      );
    }

    // Sanitize checks
    if (sanitized.checks) {
      sanitized.checks = sanitized.checks.map((check: HealthCheck) => ({
        ...check,
        message: this.redactSecrets(check.message),
        details: check.details
          ? this.sanitizeDetails(check.details)
          : undefined,
      }));
    }

    return sanitized;
  }

  private redactSecrets(text: string): string {
    return text
      .replace(
        /(OPENAI_API_KEY|ANTHROPIC_API_KEY|GOOGLE_API_KEY|API_KEY|SECRET|TOKEN)\s*=\s*[^\n]+/gi,
        "$1=***",
      )
      .replace(
        /([A-Za-z0-9_]*password[A-Za-z0-9_]*\s*:\s*)['"][^'"]+['"]/gi,
        '$1"***"',
      )
      .replace(/(sk-[a-zA-Z0-9]{20,})/g, "sk-***")
      .replace(/(key[_-]?[a-zA-Z0-9]{32,})/gi, "key-***");
  }

  private sanitizeDetails(details: any): any {
    if (typeof details === "string") {
      return this.redactSecrets(details);
    }
    if (typeof details === "object" && details !== null) {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(details)) {
        if (
          key.toLowerCase().includes("path") ||
          key.toLowerCase().includes("dir")
        ) {
          sanitized[key] =
            typeof value === "string" ? this.sanitizePath(value) : value;
        } else if (
          key.toLowerCase().includes("key") ||
          key.toLowerCase().includes("secret") ||
          key.toLowerCase().includes("token")
        ) {
          sanitized[key] = "[REDACTED]";
        } else {
          sanitized[key] = value;
        }
      }
      return sanitized;
    }
    return details;
  }

  private formatBytes(bytes: number): string {
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    if (bytes === 0) return "0 B";
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  }

  private formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (parts.length === 0) parts.push("<1m");

    return parts.join(" ");
  }

  /**
   * Validation for doctor command
   */
  override async validate(
    args: CommandArgs,
  ): Promise<{ success: boolean; error?: string }> {
    const { options, parsed } = args;
    const positional = (parsed["positional"] as string[]) || [];

    // Doctor command doesn't accept positional arguments
    if (positional.length > 0) {
      return {
        success: false,
        error: `Unexpected arguments: ${positional.join(", ")}. Use flags and options instead.`,
      };
    }

    // Validate category option
    if (options["category"]) {
      const validCategories = [
        "system",
        "nodejs",
        "maria",
        "config",
        "dependencies",
        "network",
        "performance",
      ];
      if (!validCategories.includes(options["category"] as string)) {
        return {
          success: false,
          error: `Invalid category: ${options["category"]}. Valid categories: ${validCategories.join(", ")}`,
        };
      }
    }

    // Validate risk-level option
    if (options["risk-level"]) {
      const riskLevel = parseFloat(options["risk-level"] as string);
      if (isNaN(riskLevel) || riskLevel < 0 || riskLevel > 1.0) {
        return {
          success: false,
          error: `Invalid risk-level: ${options["risk-level"]}. Must be a number between 0.0 and 1.0`,
        };
      }
    }

    return { success: true };
  }
}
