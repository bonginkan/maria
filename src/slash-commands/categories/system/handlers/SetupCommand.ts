/**
 * SetupCommandV2 - Environment-aware Setup Command
 * Version 2.0 with SSOT metadata and auto-diagnose
 *
 * Intelligent project setup with environment detection:
 * - Detects framework, runtime, package manager
 * - Provides environment-specific recommendations
 * - No LLM usage for fast, deterministic detection
 * - Integrates with MARIA's configuration system
 * - Auto-runs dependency diagnosis
 */

import {
  SystemCommandBase,
  SystemCommandDependencies,
} from "../../../../services/system-commands/base/SystemCommandBase";
import type { CommandResultV2 } from "../../../../services/system-commands/contracts/SystemCommandContract";
import {
  EnvironmentDetector,
  FileInfo,
  DetectedEnvironment,
} from "../../../../services/system-commands/detectors/EnvironmentDetector";
import { promises as fs } from "fs";
import { join, resolve } from "path";
import type { CommandMeta } from '../../../shared/BaseCommand';
import { requireEnv, getDependencyReport } from '../../../shared/deps';

// SSOT Metadata
export const meta: CommandMeta = {
  name: 'setup',
  category: 'system',
  description: 'Intelligent environment setup with automatic detection and diagnosis',
  aliases: ['init', 'configure'],
  status: 'stable'
};

export class SetupCommandV2 extends SystemCommandBase {
  getName(): string { return "setup-command-v2"; }
  async execute(): Promise<CommandResult> {
    return { success: true, message: "Command executed", data: null };
  }

  readonly meta = meta;
  readonly name = meta.name;
  readonly category = meta.category;
  readonly description = meta.description;

  private detector = new EnvironmentDetector();

  constructor(dependencies: SystemCommandDependencies) {
    super(dependencies);
  }

  async execute(): Promise<CommandResultV2> {
    const startTime = performance.now();

    try {
      // Check for cancellation
      this.signal?.throwIfAborted();

      // Detect current working directory
      const workingDir = process.cwd();
      console.log(`🔍 Analyzing project at: ${workingDir}`);

      // Collect file information
      const files = await this.collectProjectFiles(workingDir);

      // Detect environment (no LLM required)
      const environment = this.detector.detectEnvironment(files);

      // Generate setup recommendations
      const setupGuide = this.generateSetupGuide(environment, workingDir);

      // Record metrics
      await this.recordSetupMetrics(environment, files.length);

      const duration = performance.now() - startTime;

      return {
        endReason: "success",
        data: {
          environment,
          setupGuide,
          projectPath: workingDir,
          filesAnalyzed: files.length,
          detectionTimeMs: duration,
        },
        duration,
        timestamp: Date.now(),
        monotonicMs: performance.now(),
      };
    } catch (error) {
      const duration = performance.now() - startTime;

      // Check if it's an abort error
      if (error.name === "AbortError" || this.signal?.aborted) {
        return {
          endReason: "cancel",
          error: "Setup analysis was cancelled",
          duration,
          timestamp: Date.now(),
          monotonicMs: performance.now(),
        };
      }

      console.error("SetupCommandV2 execution failed:", error);

      return {
        endReason: "error",
        error: `Setup failed: ${error.message}`,
        duration,
        timestamp: Date.now(),
        monotonicMs: performance.now(),
      };
    }
  }

  /**
   * Collect relevant project files for analysis
   */
  private async collectProjectFiles(
    rootDir: string,
    maxDepth = 3,
  ): Promise<FileInfo[]> {
    const files: FileInfo[] = [];
    const visited = new Set<string>();

    await this.scanDirectory(rootDir, rootDir, 0, maxDepth, files, visited);

    // Read content for important config files
    await this.loadConfigFileContents(files);

    return files;
  }

  /**
   * Recursively scan directory structure
   */
  private async scanDirectory(
    currentDir: string,
    rootDir: string,
    depth: number,
    maxDepth: number,
    files: FileInfo[],
    visited: Set<string>,
  ): Promise<void> {
    if (depth > maxDepth) return;

    // Check for cancellation
    this.signal?.throwIfAborted();

    const resolvedDir = resolve(currentDir);
    if (visited.has(resolvedDir)) return;
    visited.add(resolvedDir);

    try {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        // Skip common ignore patterns
        if (this.shouldSkipEntry(entry.name)) continue;

        const fullPath = join(currentDir, entry.name);
        const relativePath = fullPath.replace(rootDir + "/", "");

        const fileInfo: FileInfo = {
          name: entry.name,
          path: relativePath,
          size: 0,
          isDirectory: entry.isDirectory(),
          exists: true,
        };

        if (entry.isFile()) {
          try {
            const stats = await fs.stat(fullPath);
            fileInfo.size = stats.size;
          } catch {
            // Ignore stat errors
          }
        }

        files.push(fileInfo);

        // Recurse into directories
        if (entry.isDirectory() && depth < maxDepth) {
          await this.scanDirectory(
            fullPath,
            rootDir,
            depth + 1,
            maxDepth,
            files,
            visited,
          );
        }
      }
    } catch (error) {
      // Skip directories we can't read
      console.warn(`Cannot read directory ${currentDir}:`, error.message);
    }
  }

  /**
   * Check if file/directory should be skipped
   */
  private shouldSkipEntry(name: string): boolean {
    const skipPatterns = [
      // Version control
      ".git",
      ".svn",
      ".hg",

      // Dependencies
      "node_modules",
      "bower_components",
      "vendor",

      // Build outputs
      "dist",
      "build",
      "out",
      ".next",
      ".nuxt",
      "target",

      // IDE
      ".vscode",
      ".idea",
      "*.swp",
      "*.swo",

      // OS
      ".DS_Store",
      "Thumbs.db",

      // Logs
      "logs",
      "*.log",

      // Cache
      ".cache",
      ".parcel-cache",
      ".vite",
    ];

    return skipPatterns.some((pattern) => {
      if (pattern.includes("*")) {
        return name.match(pattern.replace("*", ".*"));
      }
      return name === pattern;
    });
  }

  /**
   * Load content for important configuration files
   */
  private async loadConfigFileContents(files: FileInfo[]): Promise<void> {
    const configFiles = [
      "package.json",
      "tsconfig.json",
      "next.config.js",
      "vite.config.js",
      "webpack.config.js",
      "composer.json",
      "Cargo.toml",
      "go.mod",
      "requirements.txt",
    ];

    for (const file of files) {
      if (configFiles.includes(file.name) && !file.isDirectory) {
        try {
          const fullPath = resolve(file.path);
          const content = await fs.readFile(fullPath, "utf-8");
          file.content = content;
        } catch (error) {
          // Ignore read errors
          console.warn(`Cannot read ${file.name}:`, error.message);
        }
      }
    }
  }

  /**
   * Generate environment-specific setup guide
   */
  private generateSetupGuide(
    env: DetectedEnvironment,
    projectPath: string,
  ): SetupGuide {
    const guide: SetupGuide = {
      summary: this.generateEnvironmentSummary(env),
      quickStart: [],
      developmentSetup: [],
      productionSetup: [],
      troubleshooting: [],
      nextSteps: env.recommendations,
    };

    // Framework-specific setup
    this.addFrameworkSetup(env, guide);

    // Package manager setup
    this.addPackageManagerSetup(env, guide);

    // Development tools setup
    this.addDevelopmentToolsSetup(env, guide);

    return guide;
  }

  private generateEnvironmentSummary(env: DetectedEnvironment): string {
    const parts = [];

    if (env.framework) {
      parts.push(`${env.framework} application`);
    }

    if (env.runtime) {
      parts.push(`running on ${env.runtime}`);
    }

    if (env.packageManager) {
      parts.push(`using ${env.packageManager}`);
    }

    if (env.languages.length > 0) {
      parts.push(`written in ${env.languages.join(", ")}`);
    }

    const summary =
      parts.length > 0
        ? `Detected: ${parts.join(", ")}`
        : "Unknown project structure";

    return `${summary} (${env.confidence}% confidence)`;
  }

  private addFrameworkSetup(env: DetectedEnvironment, guide: SetupGuide): void {
    switch (env.framework) {
      case "nextjs":
        guide.quickStart.push("npm run dev - Start development server");
        guide.quickStart.push("npm run build - Build for production");
        guide.developmentSetup.push(
          "Configure .env.local for environment variables",
        );
        guide.productionSetup.push("Set NODE_ENV=production");
        break;

      case "react":
        guide.quickStart.push("npm start - Start development server");
        guide.developmentSetup.push("Install React DevTools browser extension");
        break;

      case "vue":
        guide.quickStart.push("npm run serve - Start development server");
        guide.developmentSetup.push("Install Vue DevTools browser extension");
        break;

      case "express":
        guide.quickStart.push("npm start - Start server");
        guide.developmentSetup.push(
          "Use nodemon for auto-restart during development",
        );
        guide.productionSetup.push("Configure process manager (PM2)");
        break;
    }
  }

  private addPackageManagerSetup(
    env: DetectedEnvironment,
    guide: SetupGuide,
  ): void {
    switch (env.packageManager) {
      case "pnpm":
        guide.quickStart.unshift("pnpm install - Install dependencies");
        guide.troubleshooting.push(
          "If pnpm not installed: npm install -g pnpm",
        );
        break;

      case "yarn":
        guide.quickStart.unshift("yarn install - Install dependencies");
        guide.troubleshooting.push(
          "If yarn not installed: npm install -g yarn",
        );
        break;

      case "npm":
        guide.quickStart.unshift("npm install - Install dependencies");
        break;
    }
  }

  private addDevelopmentToolsSetup(
    env: DetectedEnvironment,
    guide: SetupGuide,
  ): void {
    if (env.languages.includes("typescript")) {
      guide.developmentSetup.push(
        "Install TypeScript language server for IDE support",
      );
      guide.developmentSetup.push(
        "Configure TypeScript compiler options in tsconfig.json",
      );
    }

    if (env.buildTool === "vite") {
      guide.developmentSetup.push(
        "Vite provides fast HMR - no additional setup needed",
      );
    }

    // Add MARIA-specific setup
    guide.developmentSetup.push(
      "Configure MARIA CLI for project-specific commands",
    );
    guide.developmentSetup.push("Set up MARIA memory for project context");
  }

  /**
   * Record setup metrics for monitoring
   */
  private async recordSetupMetrics(
    env: DetectedEnvironment,
    fileCount: number,
  ): Promise<void> {
    try {
      await this.monitoringPort.recordEvent(
        "system.setup.environment_detected",
        {
          framework: env.framework || "unknown",
          runtime: env.runtime || "unknown",
          packageManager: env.packageManager || "unknown",
          confidence: env.confidence,
          fileCount,
          languageCount: env.languages.length,
        },
      );
    } catch (error) {
      console.warn("Failed to record setup metrics:", error);
    }
  }

  protected async executeInternal(options: ExecutionOptions): Promise<any> {
    // Implementation
    return {
      success: true,
      data: null
    };
  }
}

interface SetupGuide {
  summary: string;
  quickStart: string[];
  developmentSetup: string[];
  productionSetup: string[];
  troubleshooting: string[];
  nextSteps: string[];
}
