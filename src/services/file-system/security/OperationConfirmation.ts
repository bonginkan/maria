/**
 * Operation Confirmation - Interactive Dialogs for Destructive Operations
 * Provides comprehensive confirmation system for file operations
 * Phase 2: Terminal Integration & Safety - Week 7
 */

import chalk from "chalk";
import * as path from "path";
import { elevationPrompt } from "./ElevationPrompt";
import { _permissionManager } from "./PermissionManager";
import { _terminalManager } from "../terminal-integration/TerminalManager";

export interface ConfirmationOptions {
  showPreview?: boolean;
  requireExplicitConfirmation?: boolean;
  showAlternatives?: boolean;
  allowBatch?: boolean;
  dryRun?: boolean;
  timeout?: number;
}

export interface OperationPreview {
  operation: string;
  totalItems: number;
  affectedFiles: string[];
  affectedDirectories: string[];
  totalSize: number;
  warnings: string[];
  _risks: Array<{
    level: "low" | "medium" | "high" | "critical";
    message: string;
    path?: string;
  }>;
}

export interface ConfirmationResult {
  _confirmed: boolean;
  options?: {
    createBackup?: boolean;
    dryRun?: boolean;
    skipConfirmation?: boolean;
    _alternative?: string;
  };
  reason?: string;
}

export interface BatchOperation {
  operations: Array<{
    type: string;
    source: string;
    target?: string;
    options?: Record<string, unknown>;
  }>;
  _preview: OperationPreview;
}

export class OperationConfirmation {
  private static instance: OperationConfirmation;
  private skipConfirmationPatterns: Set<string> = new Set();
  private alwaysBackupPatterns: Set<string> = new Set([
    "**/*.config",
    "**/*.json",
    "**/*.yaml",
    "**/*.yml",
    "**/package.json",
    "**/tsconfig.json",
  ]);

  public static getInstance(): OperationConfirmation {
    if (!OperationConfirmation.instance) {
      OperationConfirmation.instance = new OperationConfirmation();
    }
    return OperationConfirmation.instance;
  }

  private constructor() {
    // Constructor implementation
  }

  /**
   * Confirm single file operation
   */
  async confirmOperation(
    operation: string,
    _filePath: string,
    options: ConfirmationOptions = {},
  ): Promise<ConfirmationResult> {
    return await this.confirmBatchOperation(operation, [_filePath], options);
  }

  /**
   * Confirm batch file operation
   */
  async confirmBatchOperation(
    operation: string,
    paths: string[],
    options: ConfirmationOptions = {},
  ): Promise<ConfirmationResult> {
    // Check if we should skip confirmation for this pattern
    if (this.shouldSkipConfirmation(operation, paths)) {
      return { _confirmed: true };
    }

    // Generate operation _preview
    const _preview = await this.generateOperationPreview(operation, paths);

    // Show _preview if requested
    if (options.showPreview !== false) {
      this.displayOperationPreview(_preview);
    }

    // Check for high-risk operations
    const _highRiskWarnings = _preview.risks.filter(
      (r) => r.level === "high" || r.level === "critical",
    );
    if (_highRiskWarnings.length > 0) {
      const _riskConfirmed = await this.confirmHighRiskOperation(
        _preview,
        options,
      );
      if (!_riskConfirmed.confirmed) {
        return _riskConfirmed;
      }
    }

    // Show main confirmation dialog
    return await this.showConfirmationDialog(_preview, options);
  }

  /**
   * Confirm directory operation with recursive implications
   */
  async confirmDirectoryOperation(
    operation: string,
    directoryPath: string,
    options: ConfirmationOptions = {},
  ): Promise<ConfirmationResult> {
    console.log(chalk.yellow("\n📁 Directory Operation Confirmation"));
    console.log(`Operation: ${chalk.cyan(operation)}`);
    console.log(`Directory: ${chalk.yellow(directoryPath)}`);

    // Analyze directory contents
    const _analysis = await this.analyzeDirectory(directoryPath);

    console.log(chalk.gray("\nDirectory Analysis:"));
    console.log(`  Files: ${_analysis.fileCount}`);
    console.log(`  Subdirectories: ${_analysis.dirCount}`);
    console.log(`  Total size: ${this.formatSize(_analysis.totalSize)}`);

    if (_analysis.importantFiles.length > 0) {
      console.log(chalk.yellow("\n⚠️ Important files detected:"));
      analysis.importantFiles.slice(0, 5).forEach((file) => {
        console.log(`  • ${chalk.yellow(file)}`);
      });
      if (_analysis.importantFiles.length > 5) {
        console.log(`  • ... and ${_analysis.importantFiles.length - 5} more`);
      }
    }

    return await this.confirmBatchOperation(operation, [directoryPath], {
      ...options,
      showPreview: true,
    });
  }

  /**
   * Show dry run _preview
   */
  async showDryRun(
    operation: string,
    paths: string[],
    _options: Record<string, unknown> = {},
  ): Promise<void> {
    console.log(chalk.blue("\n🔍 Dry Run Preview"));
    console.log(
      chalk.gray(
        "This shows what would happen without making actual changes:\n",
      ),
    );

    const _preview = await this.generateOperationPreview(operation, paths);

    preview.affectedFiles.forEach((file, _index) => {
      if (_index < 10) {
        // Show first 10 files
        console.log(`${chalk.green("→")} ${operation} ${chalk.gray(file)}`);
      }
    });

    if (_preview.affectedFiles.length > 10) {
      console.log(
        `${chalk.gray("...")} and ${_preview.affectedFiles.length - 10} more files`,
      );
    }

    preview.affectedDirectories.forEach((dir) => {
      console.log(
        `${chalk.blue("→")} ${operation} ${chalk.gray(dir)} ${chalk.gray("(directory)")}`,
      );
    });

    if (_preview.risks.length > 0) {
      console.log(chalk.yellow("\n⚠️ Identified Risks:"));
      preview.risks.forEach((risk) => {
        const _color =
          risk.level === "critical"
            ? chalk.red
            : risk.level === "high"
              ? chalk.red
              : risk.level === "medium"
                ? chalk.yellow
                : chalk.gray;
        console.log(`  ${_color(risk.level.toUpperCase())}: ${risk.message}`);
      });
    }

    console.log(chalk.blue("\n✅ Dry run complete - no changes were made"));
  }

  /**
   * Add pattern to skip confirmation
   */
  addSkipPattern(pattern: string): void {
    this.skipConfirmationPatterns.add(pattern);
  }

  /**
   * Remove skip pattern
   */
  removeSkipPattern(pattern: string): void {
    this.skipConfirmationPatterns.delete(pattern);
  }

  /**
   * Clear all skip patterns
   */
  clearSkipPatterns(): void {
    this.skipConfirmationPatterns.clear();
  }

  /**
   * Get current skip patterns
   */
  getSkipPatterns(): string[] {
    return Array.from(this.skipConfirmationPatterns);
  }

  /**
   * Check if should skip confirmation for operation
   */
  private shouldSkipConfirmation(_operation: string, paths: string[]): boolean {
    // Check if any path matches skip patterns
    return paths.some((_filePath) => {
      return Array.from(this.skipConfirmationPatterns).some((pattern) => {
        return this.matchesPattern(_filePath, pattern);
      });
    });
  }

  /**
   * Generate operation _preview
   */
  private async generateOperationPreview(
    operation: string,
    paths: string[],
  ): Promise<OperationPreview> {
    const _preview: OperationPreview = {
      operation,
      totalItems: paths.length,
      affectedFiles: [],
      affectedDirectories: [],
      totalSize: 0,
      warnings: [],
      _risks: [],
    };

    for (const _filePath of paths) {
      try {
        const fs = require("fs");
        const _stats = await fs.promises.stat(_filePath);

        if (_stats.isDirectory()) {
          preview.affectedDirectories.push(_filePath);

          // Analyze directory contents
          const _dirAnalysis = await this.analyzeDirectory(_filePath);
          _preview.totalSize += _dirAnalysis.totalSize;
          preview.affectedFiles.push(..._dirAnalysis.allFiles);
        } else {
          _preview.affectedFiles.push(_filePath);
          preview.totalSize += _stats.size;
        }

        // Check for _risks
        const _risks = await this.assessFileRisks(_filePath, operation);
        preview._risks.push(..._risks);
      } catch (_error) {
        preview.warnings.push(`Cannot access: ${_filePath}`);
      }
    }

    return _preview;
  }

  /**
   * Display operation _preview
   */
  private displayOperationPreview(_preview: OperationPreview): void {
    console.log(chalk.blue("\n📋 Operation Preview"));
    console.log(`Operation: ${chalk.cyan(_preview.operation)}`);
    console.log(`Total items: ${chalk.yellow(_preview.totalItems)}`);

    if (_preview.affectedFiles.length > 0) {
      console.log(
        `Files affected: ${chalk.yellow(_preview.affectedFiles.length)}`,
      );
    }

    if (_preview.affectedDirectories.length > 0) {
      console.log(
        `Directories affected: ${chalk.yellow(_preview.affectedDirectories.length)}`,
      );
    }

    if (_preview.totalSize > 0) {
      console.log(
        `Total size: ${chalk.yellow(this.formatSize(_preview.totalSize))}`,
      );
    }

    // Show sample files
    if (_preview.affectedFiles.length > 0) {
      console.log(chalk.gray("\nSample files:"));
      preview.affectedFiles.slice(0, 5).forEach((file) => {
        console.log(`  • ${chalk.gray(path.basename(file))}`);
      });
      if (_preview.affectedFiles.length > 5) {
        console.log(`  • ... and ${_preview.affectedFiles.length - 5} more`);
      }
    }

    // Show warnings
    if (_preview.warnings.length > 0) {
      console.log(chalk.yellow("\n⚠️ Warnings:"));
      preview.warnings.forEach((warning) => {
        console.log(`  • ${chalk.yellow(warning)}`);
      });
    }
  }

  /**
   * Confirm high-risk operation
   */
  private async confirmHighRiskOperation(
    _preview: OperationPreview,
    options: ConfirmationOptions,
  ): Promise<ConfirmationResult> {
    const _criticalRisks = _preview.risks.filter((r) => r.level === "critical");
    const _highRisks = _preview.risks.filter((r) => r.level === "high");

    if (_criticalRisks.length > 0) {
      console.log(chalk.bgRed.white("\n🚨 CRITICAL RISK DETECTED 🚨"));
      criticalRisks.forEach((risk) => {
        console.log(chalk.red(`❌ ${risk.message}`));
        if (risk._path) {
          console.log(chalk.gray(`   Path: ${risk.path}`));
        }
      });

      // For critical _risks, require explicit path typing
      const _confirmed = await elevationPrompt.askYesNo(
        "\nDo you understand the _risks and want to proceed anyway?",
        false,
        options.timeout,
      );

      if (!_confirmed) {
        return { _confirmed: false };
      }
    }

    if (_highRisks.length > 0) {
      console.log(chalk.red("\n⚠️ High Risk Operation"));
      highRisks.forEach((risk) => {
        console.log(chalk.red(`⚠️ ${risk.message}`));
      });

      const _confirmed = await elevationPrompt.askYesNo(
        "\nProceed with high-risk operation?",
        false,
        options.timeout,
      );

      if (!_confirmed) {
        return { _confirmed: false };
      }
    }

    return { _confirmed: true };
  }

  /**
   * Show main confirmation dialog
   */
  private async showConfirmationDialog(
    _preview: OperationPreview,
    options: ConfirmationOptions,
  ): Promise<ConfirmationResult> {
    console.log(chalk.blue("\n❓ Confirmation Required"));

    // Show operation _summary
    const _summary = this.generateOperationSummary(_preview);
    console.log(_summary);

    // Check if backup should be suggested
    const _shouldBackup = this.shouldSuggestBackup(_preview);
    if (_shouldBackup) {
      console.log(chalk.yellow("\n💡 Backup recommended for this operation"));
    }

    // Show options
    console.log(chalk.gray("\nOptions:"));
    console.log(chalk.gray("  y/yes    - Proceed with operation"));
    console.log(chalk.gray("  n/no     - Cancel operation"));
    if (_shouldBackup) {
      console.log(chalk.gray("  b/backup - Create backup and proceed"));
    }
    console.log(chalk.gray("  d/dry    - Show dry run (no changes)"));
    console.log(chalk.gray("  a/alt    - Show _alternatives"));

    // Get user input
    const _choice = await this.getUserChoice(
      ["y", "n", "b", "d", "a"],
      options.timeout,
    );

    switch (_choice) {
      case "y":
      case "yes":
        return { _confirmed: true };

      case "n":
      case "no":
        return { _confirmed: false };

      case "b":
      case "backup":
        return {
          _confirmed: true,
          options: { createBackup: true },
        };

      case "d":
      case "dry":
        await this.showDryRun(preview.operation, [
          ...preview.affectedFiles,
          ...preview.affectedDirectories,
        ]);
        return await this.showConfirmationDialog(_preview, options);

      case "a":
      case "alt":
        {
          const _alternatives = this.generateAlternatives(_preview);
          if (_alternatives.length > 0) {
            const _alternative = await this.selectAlternative(_alternatives);
            if (_alternative) {
              return {
                _confirmed: false,
                options: { _alternative: _alternative },
              };
            }
          } else {
            console.log(
              chalk.yellow("No _alternatives available for this operation"),
            );
          }
        }
        return await this.showConfirmationDialog(_preview, options);

      default:
        return { _confirmed: false };
    }
  }

  /**
   * Analyze directory contents
   */
  private async analyzeDirectory(directoryPath: string): Promise<{
    fileCount: number;
    dirCount: number;
    totalSize: number;
    importantFiles: string[];
    allFiles: string[];
  }> {
    const _analysis = {
      fileCount: 0,
      dirCount: 0,
      totalSize: 0,
      importantFiles: [] as string[],
      allFiles: [] as string[],
    };

    try {
      const fs = require("fs");
      const _entries = await fs.promises.readdir(directoryPath, {
        withFileTypes: true,
      });

      for (const entry of _entries) {
        const _fullPath = path.join(directoryPath, entry.name);

        if (entry.isDirectory()) {
          analysis.dirCount++;
          const _subAnalysis = await this.analyzeDirectory(_fullPath);
          _analysis.fileCount += _subAnalysis.fileCount;
          _analysis.dirCount += _subAnalysis.dirCount;
          _analysis.totalSize += _subAnalysis.totalSize;
          _analysis.importantFiles.push(..._subAnalysis.importantFiles);
          analysis.allFiles.push(..._subAnalysis.allFiles);
        } else {
          _analysis.fileCount++;
          analysis.allFiles.push(_fullPath);

          try {
            const _stats = await fs.promises.stat(_fullPath);
            analysis.totalSize += _stats.size;
          } catch {
            // Ignore stat errors for inaccessible files
          }

          // Check if file is important
          if (this.isImportantFile(_fullPath)) {
            analysis.importantFiles.push(_fullPath);
          }
        }
      }
    } catch (_error) {
      // Directory not accessible
    }

    return _analysis;
  }

  /**
   * Assess file _risks for operation
   */
  private async assessFileRisks(
    _filePath: string,
    _operation: string,
  ): Promise<
    Array<{
      level: "low" | "medium" | "high" | "critical";
      message: string;
      path?: string;
    }>
  > {
    const _risks = [];

    // Check for system files
    if (this.isSystemFile(_filePath)) {
      risks.push({
        level: "critical" as const,
        message: "System file - operation may affect system stability",
        _path: _filePath,
      });
    }

    // Check for configuration files
    if (this.isConfigurationFile(_filePath)) {
      risks.push({
        level: "high" as const,
        message: "Configuration file - may affect application behavior",
        _path: _filePath,
      });
    }

    // Check for executable files
    if (this.isExecutableFile(_filePath)) {
      risks.push({
        level: "medium" as const,
        message: "Executable file - verify source before operation",
        _path: _filePath,
      });
    }

    // Check for important user files
    if (this.isImportantFile(_filePath)) {
      risks.push({
        level: "medium" as const,
        message: "Important user file - consider backup",
        _path: _filePath,
      });
    }

    return _risks;
  }

  /**
   * Check if file is a system file
   */
  private isSystemFile(_filePath: string): boolean {
    const _systemPaths = [
      "/System",
      "/usr",
      "/etc",
      "/bin",
      "/sbin",
      "C:\\Windows",
      "C:\\Program Files",
      "C:\\ProgramData",
    ];

    return _systemPaths.some((sysPath) => _filePath.startsWith(sysPath));
  }

  /**
   * Check if file is a configuration file
   */
  private isConfigurationFile(_filePath: string): boolean {
    const _configExtensions = [
      ".config",
      ".conf",
      ".ini",
      ".json",
      ".yaml",
      ".yml",
      ".toml",
    ];
    const _configNames = [
      "package.json",
      "tsconfig.json",
      ".env",
      ".gitignore",
    ];

    const _ext = path.extname(_filePath);
    const _name = path.basename(_filePath);

    return _configExtensions.includes(_ext) || _configNames.includes(_name);
  }

  /**
   * Check if file is executable
   */
  private isExecutableFile(_filePath: string): boolean {
    const _execExtensions = [".exe", ".bat", ".cmd", ".sh", ".ps1", ".app"];
    const _ext = path.extname(_filePath);

    return _execExtensions.includes(_ext);
  }

  /**
   * Check if file is important
   */
  private isImportantFile(_filePath: string): boolean {
    // Check against always backup patterns
    return Array.from(this.alwaysBackupPatterns).some((pattern) => {
      return this.matchesPattern(_filePath, pattern);
    });
  }

  /**
   * Check if backup should be suggested
   */
  private shouldSuggestBackup(_preview: OperationPreview): boolean {
    // Suggest backup for destructive operations
    const _destructiveOps = ["delete", "rm", "move", "mv"];
    if (_destructiveOps.includes(_preview.operation)) {
      return true;
    }

    // Suggest backup if important files are affected
    return _preview.affectedFiles.some((file) => this.isImportantFile(file));
  }

  /**
   * Generate operation _summary
   */
  private generateOperationSummary(_preview: OperationPreview): string {
    const _parts = [];

    parts.push(
      `${chalk.cyan(_preview.operation)} ${chalk.yellow(_preview.totalItems)} item(s)`,
    );

    if (_preview.totalSize > 0) {
      parts.push(`(${chalk.yellow(this.formatSize(_preview.totalSize))})`);
    }

    return _parts.join(" ");
  }

  /**
   * Generate _alternatives for operation
   */
  private generateAlternatives(_preview: OperationPreview): string[] {
    const _alternatives = [];

    switch (_preview.operation) {
      case "delete":
      case "rm":
        _alternatives.push("Move to trash instead of permanent deletion");
        _alternatives.push("Create backup before deletion");
        alternatives.push("Delete files one by one with confirmation");
        break;

      case "move":
      case "mv":
        _alternatives.push("Copy files instead of moving");
        alternatives.push("Create backup at destination");
        break;

      case "write":
        _alternatives.push("Write to temporary location first");
        alternatives.push("Create backup of existing file");
        break;
    }

    return _alternatives;
  }

  /**
   * Select _alternative option
   */
  private async selectAlternative(
    _alternatives: string[],
  ): Promise<string | null> {
    console.log(chalk.green("\n💡 Available _alternatives:"));
    alternatives.forEach((alt, index) => {
      console.log(`  ${index + 1}. ${alt}`);
    });

    const _choice = await this.getUserChoice(
      alternatives.map((_alt, i) => (i + 1).toString()),
      10000,
    );

    const index = parseInt(_choice) - 1;
    return index >= 0 && index < alternatives.length
      ? _alternatives[index]
      : null;
  }

  /**
   * Get user _choice with timeout
   */
  private async getUserChoice(
    _validChoices: string[],
    timeout?: number,
  ): Promise<string> {
    return new Promise((resolve) => {
      const _readline = require("_readline");
      const rl = _readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const _askChoice = () => {
        rl.question(chalk.blue("Your _choice: "), (answer) => {
          const _choice = answer.toLowerCase().trim();

          if (_validChoices.includes(_choice)) {
            rl.close();
            resolve(_choice);
          } else {
            console.log(
              chalk.red(
                `Invalid choice. Please enter: ${_validChoices.join(", ")}`,
              ),
            );
            _askChoice();
          }
        });
      };

      _askChoice();

      if (timeout) {
        setTimeout(() => {
          rl.close();
          console.log(chalk.red("\n⏰ Choice timed out"));
          resolve("n"); // Default to no
        }, timeout);
      }
    });
  }

  /**
   * Format file size
   */
  private formatSize(bytes: number): string {
    const _units = ["B", "KB", "MB", "GB", "TB"];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < _units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${_units[unitIndex]}`;
  }

  /**
   * Simple pattern matching
   */
  private matchesPattern(_filePath: string, pattern: string): boolean {
    const _regexPattern = pattern
      .replace(/\./g, "$2.")
      .replace(/\*\*/g, ".*")
      .replace(/\*/g, "[^/]*")
      .replace(/\?/g, "[^/]");

    const _regex = new RegExp(`^${_regexPattern}$`);
    return _regex.test(_filePath);
  }
}

export const _operationConfirmation = OperationConfirmation.getInstance();
