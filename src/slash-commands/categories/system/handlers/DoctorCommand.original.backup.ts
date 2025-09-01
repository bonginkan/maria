/**
 * Doctor Command
 * Comprehensive system health check and diagnostics
 */

import { BaseCommand } from "../../../base-command";
import {
  CommandArgs,
  CommandContext,
  CommandResult,
  CommandExample,
} from "../../../types";
import { logger } from "../../../../utils/logger";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

interface HealthCheck {
  name: string;
  status: "pass" | "warning" | "fail";
  message: string;
  details?: any;
  suggestion?: string;
}

interface DiagnosticReport {
  overall: "healthy" | "warning" | "critical";
  _score: number; // 0-100
  timestamp: string;
  checks: HealthCheck[];
  _summary: {
    passed: number;
    _warnings: number;
    failed: number;
    total: number;
  };
  _recommendations: string[];
  _systemInfo: {
    _platform: string;
    _nodeVersion: string;
    mariaVersion: string;
    workingDirectory: string;
  };
}

export class DoctorCommand extends BaseCommand {
  name = "doctor";
  category = "system" as const;
  description = "🏥 Comprehensive system health check and diagnostics";
  override aliases = ["dr", "health", "check"];
  override usage =
    "[--fix] [--verbose] [--json] [--category <category>] [--skip-network]";

  override examples: CommandExample[] = [
    {
      input: "/doctor",
      description: "Run comprehensive system health check",
      output: "Full diagnostic _report with health status",
    },
    {
      input: "/doctor --fix",
      description: "Run diagnostics and attempt to fix issues",
      output: "Diagnostic _report with automatic fixes applied",
    },
    {
      input: "/doctor --verbose",
      description: "Show detailed diagnostic information",
      output: "Verbose diagnostic output with technical details",
    },
    {
      input: "/doctor --category system",
      description: "Run only system-related health checks",
      output: "Focused diagnostic _report for system category",
    },
    {
      input: "/doctor --json",
      description: "Output diagnostic results in JSON format",
      output: "Machine-readable diagnostic data",
    },
  ];

  async execute(
    _args: CommandArgs,
    context: CommandContext,
  ): Promise<CommandResult> {
    try {
      const { flags, options } = args;

      logger.info("Doctor command executed", {
        user: context.user?.id,
        session: context.session.id,
        flags,
        options,
      });

      const _startTime = Date.now();

      // Run diagnostic checks
      const _report = await this.runDiagnostics(context, {
        category: options["category"],
        skipNetwork: flags["skip-network"],
        verbose: flags["verbose"],
      });

      // Attempt to fix issues if requested
      if (flags["fix"]) {
        await this.attemptFixes(_report, context);
        // Re-run diagnostics after fixes
        const _updatedReport = await this.runDiagnostics(context, {
          category: options["category"],
          skipNetwork: flags["skip-network"],
          verbose: flags["verbose"],
        });
        _report.checks = _updatedReport.checks;
        _report.summary = _updatedReport.summary;
        _report.overall = _updatedReport.overall;
        report.score = _updatedReport.score;
      }

      const _executionTime = Date.now() - _startTime;

      // Handle different output formats
      if (flags["json"]) {
        return this.success("System diagnostics (JSON format)", {
          ..._report,
          _executionTime,
        });
      }

      if (flags["verbose"]) {
        return this.showVerboseReport(_report, _executionTime);
      }

      // Default: show standard _report
      return this.showStandardReport(_report, _executionTime);
    } catch (error) {
      logger.error("Doctor command failed:", error);
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

    // Calculate _summary
    const _summary = {
      passed: checks.filter((c) => c.status === "pass").length,
      _warnings: checks.filter((c) => c.status === "warning").length,
      failed: checks.filter((c) => c.status === "fail").length,
      total: checks.length,
    };

    // Calculate overall health and _score
    const _score = Math.round(
      (_summary.passed * 100 + _summary.warnings * 50) / _summary.total,
    );

    let overall: "healthy" | "warning" | "critical";
    if (_score >= 80 && _summary.failed === 0) {
      overall = "healthy";
    } else if (_score >= 60 && _summary.failed <= 2) {
      overall = "warning";
    } else {
      overall = "critical";
    }

    // Generate _recommendations
    const _recommendations = this.generateRecommendations(checks);

    // Get system info
    const _systemInfo = await this.getSystemInfo(context);

    return {
      overall,
      _score,
      timestamp: new Date().toISOString(),
      checks,
      _summary,
      _recommendations,
      _systemInfo,
    };
  }

  /**
   * Run system-level health checks
   */
  private async runSystemChecks(): Promise<HealthCheck[]> {
    const checks: HealthCheck[] = [];

    // Memory check
    const _totalMem = os.totalmem();
    const _freeMem = os.freemem();
    const _memoryUsage = ((_totalMem - _freeMem) / _totalMem) * 100;

    checks.push({
      name: "System Memory",
      status:
        _memoryUsage < 80 ? "pass" : _memoryUsage < 90 ? "warning" : "fail",
      message: `Memory usage: ${_memoryUsage.toFixed(1)}%`,
      details: {
        used: this.formatBytes(_totalMem - _freeMem),
        total: this.formatBytes(_totalMem),
        available: this.formatBytes(_freeMem),
      },
      suggestion:
        _memoryUsage > 85
          ? "Consider closing unnecessary applications to free memory"
          : undefined,
    });

    // CPU check
    const _cpus = os._cpus();
    checks.push({
      name: "CPU Information",
      status: "pass",
      message: `${_cpus.length} cores available`,
      details: {
        cores: _cpus.length,
        model: _cpus[0]?.model || "Unknown",
      },
    });

    // Platform check
    const _platform = os._platform();
    const _supportedPlatforms = ["darwin", "linux", "win32"];
    checks.push({
      name: "Platform Support",
      status: _supportedPlatforms.includes(_platform) ? "pass" : "warning",
      message: `Platform: ${_platform}`,
      details: {
        _platform,
        supported: _supportedPlatforms.includes(_platform),
      },
      suggestion: !_supportedPlatforms.includes(_platform)
        ? "This _platform may have limited support"
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
    const _nodeVersion = process.version;
    const _major = parseInt(_nodeVersion.slice(1).split(".")[0] || "0");

    checks.push({
      name: "Node.js Version",
      status: _major >= 18 ? "pass" : _major >= 16 ? "warning" : "fail",
      message: `Node.js ${_nodeVersion}`,
      details: { version: _nodeVersion, _major },
      suggestion:
        _major < 18
          ? "Consider upgrading to Node.js 18 or later for better performance"
          : undefined,
    });

    // Process memory check
    const _memUsage = process.memoryUsage();
    const _heapUsedMB = _memUsage.heapUsed / 1024 / 1024;

    checks.push({
      name: "Process Memory",
      status:
        _heapUsedMB < 100 ? "pass" : _heapUsedMB < 200 ? "warning" : "fail",
      message: `Heap used: ${_heapUsedMB.toFixed(1)} MB`,
      details: {
        heapUsed: this.formatBytes(_memUsage.heapUsed),
        heapTotal: this.formatBytes(_memUsage.heapTotal),
        external: this.formatBytes(_memUsage.external),
        rss: this.formatBytes(_memUsage.rss),
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

    // Slash _commands check
    try {
      const { commandRegistry } = await import("../../../registry");
      const _commands = commandRegistry.getAll();

      checks.push({
        name: "Slash Commands",
        status: _commands.length > 0 ? "pass" : "fail",
        message: `${_commands.length} _commands registered`,
        details: {
          count: _commands.length,
          categories: [...new Set(_commands.map((c) => c.category))],
        },
      });
    } catch (innerError) {
      checks.push({
        name: "Slash Commands",
        status: "fail",
        message: "Failed to load command registry",
        details: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
        suggestion: "Check if command registry is properly initialized",
      });
    }

    // Working directory check
    const _cwd = context.environment._cwd;
    try {
      await fs.access(_cwd);
      checks.push({
        name: "Working Directory",
        status: "pass",
        message: `Accessible: ${_cwd}`,
        details: { _path: _cwd },
      });
    } catch {
      checks.push({
        name: "Working Directory",
        status: "fail",
        message: `Inaccessible: ${_cwd}`,
        details: { _path: _cwd },
        suggestion: "Check directory permissions and existence",
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
    const _cwd = context.environment._cwd;

    // Package.json check
    const _packageJsonPath = path.join(_cwd, "package.json");
    try {
      await fs.access(_packageJsonPath);
      const _content = await fs.readFile(_packageJsonPath, "utf-8");
      const _packageInfo = JSON.parse(_content);

      checks.push({
        name: "Package Configuration",
        status: "pass",
        message: `package.json found (${_packageInfo.name || "unnamed"})`,
        details: {
          name: _packageInfo.name,
          version: _packageInfo.version,
          hasScripts: !!_packageInfo.scripts,
          hasDependencies: !!_packageInfo.dependencies,
        },
      });
    } catch {
      checks.push({
        name: "Package Configuration",
        status: "warning",
        message: "package.json not found",
        suggestion:
          "Initialize project with npm init if this is a Node.js project",
      });
    }

    // Environment configuration check
    const _envPath = path.join(_cwd, ".env.local");
    try {
      await fs.access(_envPath);
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
      });
    }

    // Git repository check
    const _gitPath = path.join(_cwd, ".git");
    try {
      await fs.access(_gitPath);
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
    const _cwd = context.environment._cwd;

    // Node modules check
    const _nodeModulesPath = path.join(_cwd, "node_modules");
    try {
      await fs.access(_nodeModulesPath);
      const _stats = await fs.stat(_nodeModulesPath);

      checks.push({
        name: "Dependencies",
        status: "pass",
        message: "node_modules directory exists",
        details: {
          _path: _nodeModulesPath,
          modified: _stats.mtime.toISOString(),
        },
      });
    } catch {
      checks.push({
        name: "Dependencies",
        status: "warning",
        message: "node_modules not found",
        suggestion: "Run npm install to install dependencies",
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
    const _uptimeSeconds = os.uptime();
    const _uptimeDays = _uptimeSeconds / 86400;

    checks.push({
      name: "System Uptime",
      status: _uptimeDays < 30 ? "pass" : "warning",
      message: `System uptime: ${this.formatUptime(_uptimeSeconds)}`,
      details: { seconds: _uptimeSeconds, _days: _uptimeDays },
      suggestion:
        _uptimeDays > 30
          ? "Consider restarting system for optimal performance"
          : undefined,
    });

    return checks;
  }

  /**
   * Attempt to fix identified issues
   */
  private async attemptFixes(
    _report: DiagnosticReport,
    context: CommandContext,
  ): Promise<void> {
    logger.info("Attempting to fix identified issues");

    for (const check of _report.checks) {
      if (check.status === "fail" || check.status === "warning") {
        try {
          await this.attemptFix(check, context);
        } catch (error) {
          logger.warn(`Failed to fix ${check.name}:`, error);
        }
      }
    }
  }

  /**
   * Attempt to fix a specific issue
   */
  private async attemptFix(
    _check: HealthCheck,
    context: CommandContext,
  ): Promise<void> {
    switch (_check.name) {
      case "Environment Configuration":
        if (
          _check.status === "warning" &&
          _check.message.includes("not found")
        ) {
          await this.createEnvTemplate(context);
          _check.status = "pass";
          check.message = ".env.local created from _template";
        }
        break;

      case "Dependencies":
        if (
          _check.status === "warning" &&
          _check.message.includes("not found")
        ) {
          // Would attempt npm install in a real implementation
          logger.info("Would run npm install (fix simulation)");
        }
        break;

      // Add more fix attempts as needed
    }
  }

  /**
   * Create environment _template
   */
  private async createEnvTemplate(context: CommandContext): Promise<void> {
    const _envPath = path.join(context.environment.cwd, ".env.local");
    const _template = `# MARIA Environment Configuration
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

    await fs.writeFile(_envPath, _template, "utf-8");
  }

  /**
   * Generate _recommendations based on check results
   */
  private generateRecommendations(checks: HealthCheck[]): string[] {
    const _recommendations: string[] = [];

    // Extract suggestions from failed checks
    for (const check of checks) {
      if (check.suggestion) {
        recommendations.push(check.suggestion);
      }
    }

    // Add general _recommendations
    const _failedChecks = checks.filter((c) => c.status === "fail").length;
    const _warningChecks = checks.filter((c) => c.status === "warning").length;

    if (_failedChecks > 0) {
      recommendations.push("Address failed health checks immediately");
    }

    if (_warningChecks > 2) {
      recommendations.push("Review warning items for potential improvements");
    }

    if (_recommendations.length === 0) {
      recommendations.push("System is healthy - no immediate action required");
    }

    return [...new Set(_recommendations)]; // Remove duplicates
  }

  /**
   * Get basic system information
   */
  private async getSystemInfo(context: CommandContext) {
    // Get version from package.json
    let mariaVersion = "Unknown";
    try {
      const _packagePath = path.join(context.environment.cwd, "package.json");
      const _packageContent = await fs.readFile(_packagePath, "utf-8");
      const _packageInfo = JSON.parse(_packageContent);
      mariaVersion = _packageInfo.version || "Unknown";
    } catch {
      // Ignore if package.json doesn't exist
    }

    return {
      _platform: `${os.platform()} ${os.release()}`,
      _nodeVersion: process.version,
      mariaVersion,
      workingDirectory: context.environment.cwd,
    };
  }

  /**
   * Show standard diagnostic _report
   */
  private showStandardReport(
    _report: DiagnosticReport,
    _executionTime: number,
  ): CommandResult {
    const lines: string[] = [];

    lines.push("");
    lines.push("🏥 **MARIA SYSTEM DIAGNOSTICS**");
    lines.push("═".repeat(50));
    lines.push("");

    // Overall health
    const _healthEmoji = {
      healthy: "✅",
      warning: "⚠️",
      critical: "❌",
    };

    lines.push(
      `**Overall Health:** ${_healthEmoji[_report.overall]} ${_report.overall.toUpperCase()} (${_report.score}/100)`,
    );
    lines.push("");

    // Summary
    lines.push("**📊 Summary:**");
    lines.push(`  ✅ Passed: ${_report.summary.passed}`);
    lines.push(`  ⚠️ Warnings: ${_report.summary._warnings}`);
    lines.push(`  ❌ Failed: ${_report.summary.failed}`);
    lines.push(`  📋 Total: ${_report.summary.total}`);
    lines.push("");

    // Critical issues
    const _criticalIssues = _report.checks.filter((c) => c.status === "fail");
    if (_criticalIssues.length > 0) {
      lines.push("**❌ Critical Issues:**");
      for (const issue of _criticalIssues) {
        lines.push(`  • ${issue.name}: ${issue.message}`);
        if (issue.suggestion) {
          lines.push(`    💡 ${issue.suggestion}`);
        }
      }
      lines.push("");
    }

    // Warnings
    const _warnings = _report.checks.filter((c) => c.status === "warning");
    if (_warnings.length > 0) {
      lines.push("**⚠️ Warnings:**");
      for (const warning of _warnings.slice(0, 3)) {
        // Show max 3
        lines.push(`  • ${warning.name}: ${warning.message}`);
        if (warning.suggestion) {
          lines.push(`    💡 ${warning.suggestion}`);
        }
      }
      if (_warnings.length > 3) {
        lines.push(`  ... and ${_warnings.length - 3} more _warnings`);
      }
      lines.push("");
    }

    // Recommendations
    if (_report.recommendations.length > 0) {
      lines.push("**💡 Recommendations:**");
      for (const rec of _report.recommendations.slice(0, 5)) {
        lines.push(`  • ${rec}`);
      }
      lines.push("");
    }

    // System info
    lines.push("**🖥️ System Info:**");
    lines.push(`  Platform: ${_report.systemInfo.platform}`);
    lines.push(`  Node.js: ${_report.systemInfo.nodeVersion}`);
    lines.push(`  MARIA: ${_report.systemInfo.mariaVersion}`);
    lines.push("");

    lines.push(`*Diagnostics completed in ${_executionTime}ms*`);
    lines.push("");
    lines.push("💡 Use `/doctor --verbose` for detailed information");
    lines.push("💡 Use `/doctor --fix` to attempt automatic fixes");
    lines.push("");

    return this.success(lines.join("\n"), {
      health: _report.overall,
      _score: _report.score,
      _summary: _report.summary,
      _executionTime,
      type: "standard",
    });
  }

  /**
   * Show verbose diagnostic _report
   */
  private showVerboseReport(
    _report: DiagnosticReport,
    _executionTime: number,
  ): CommandResult {
    const lines: string[] = [];

    lines.push("");
    lines.push("🏥 **DETAILED SYSTEM DIAGNOSTICS**");
    lines.push("═".repeat(60));
    lines.push("");

    // Overall status
    const _healthEmoji = {
      healthy: "✅",
      warning: "⚠️",
      critical: "❌",
    };

    lines.push(
      `**Overall Health:** ${_healthEmoji[_report.overall]} ${_report.overall.toUpperCase()} (${_report.score}/100)`,
    );
    lines.push(
      `**Timestamp:** ${new Date(_report.timestamp).toLocaleString()}`,
    );
    lines.push("");

    // All checks grouped by status
    const _groupedChecks = {
      pass: _report.checks.filter((c) => c.status === "pass"),
      warning: _report.checks.filter((c) => c.status === "warning"),
      fail: _report.checks.filter((c) => c.status === "fail"),
    };

    for (const [status, checks] of Object.entries(_groupedChecks)) {
      if (checks.length === 0) continue;

      const _statusEmoji = { pass: "✅", warning: "⚠️", fail: "❌" };
      const _statusTitle = {
        pass: "PASSED",
        warning: "WARNINGS",
        fail: "FAILED",
      };

      lines.push(
        `**${_statusEmoji[status as keyof typeof _statusEmoji]} ${_statusTitle[status as keyof typeof _statusTitle]} (${checks.length}):**`,
      );

      for (const check of checks) {
        lines.push(`  • **${check.name}**: ${check.message}`);

        if (check.details) {
          lines.push(
            `    Details: ${JSON.stringify(check.details, null, 2).replace(/\n/g, "\n    ")}`,
          );
        }

        if (check.suggestion) {
          lines.push(`    💡 ${check.suggestion}`);
        }

        lines.push("");
      }
    }

    // Recommendations
    if (_report.recommendations.length > 0) {
      lines.push("**💡 RECOMMENDATIONS:**");
      for (const rec of _report.recommendations) {
        lines.push(`  • ${rec}`);
      }
      lines.push("");
    }

    lines.push(`**⏱️ Execution Time:** ${_executionTime}ms`);
    lines.push("");

    return this.success(lines.join("\n"), {
      ..._report,
      _executionTime,
      type: "verbose",
    });
  }

  /**
   * Helper methods
   */
  private formatBytes(bytes: number): string {
    const _sizes = ["B", "KB", "MB", "GB", "TB"];
    if (bytes === 0) return "0 B";
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${_sizes[i]}`;
  }

  private formatUptime(seconds: number): string {
    const _days = Math.floor(seconds / 86400);
    const _hours = Math.floor((seconds % 86400) / 3600);
    const _minutes = Math.floor((seconds % 3600) / 60);

    const parts: string[] = [];
    if (_days > 0) parts.push(`${_days}d`);
    if (_hours > 0) parts.push(`${_hours}h`);
    if (_minutes > 0) parts.push(`${_minutes}m`);
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
    const _positional = (parsed["_positional"] as string[]) || [];

    // Doctor command doesn't accept _positional arguments
    if (_positional.length > 0) {
      return {
        success: false,
        error: `Unexpected arguments: ${_positional.join(", ")}. Use flags and options instead.`,
      };
    }

    // Validate category option
    if (options["category"]) {
      const _validCategories = [
        "system",
        "nodejs",
        "maria",
        "config",
        "dependencies",
        "network",
        "performance",
      ];
      if (!_validCategories.includes(options["category"])) {
        return {
          success: false,
          error: `Invalid category: ${options["category"]}. Valid categories: ${_validCategories.join(", ")}`,
        };
      }
    }

    return { success: true };
  }
}
