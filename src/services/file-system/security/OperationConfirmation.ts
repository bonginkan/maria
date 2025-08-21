/**
 * Operation Confirmation - Interactive Dialogs for Destructive Operations
 * Provides comprehensive confirmation system for file operations
 * Phase 2: Terminal Integration & Safety - Week 7
 */

import chalk from 'chalk';
import * as path from 'path';
import { elevationPrompt } from './ElevationPrompt';
import { permissionManager } from './PermissionManager';
import { terminalManager } from '../terminal-integration/TerminalManager';

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
  risks: Array<{
    level: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    path?: string;
  }>;
}

export interface ConfirmationResult {
  confirmed: boolean;
  options?: {
    createBackup?: boolean;
    dryRun?: boolean;
    skipConfirmation?: boolean;
    alternative?: string;
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
  preview: OperationPreview;
}

export class OperationConfirmation {
  private static instance: OperationConfirmation;
  private skipConfirmationPatterns: Set<string> = new Set();
  private alwaysBackupPatterns: Set<string> = new Set([
    '**/*.config',
    '**/*.json',
    '**/*.yaml',
    '**/*.yml',
    '**/package.json',
    '**/tsconfig.json',
  ]);

  public static getInstance(): OperationConfirmation {
    if (!OperationConfirmation.instance) {
      OperationConfirmation.instance = new OperationConfirmation();
    }
    return OperationConfirmation.instance;
  }

  private constructor() {}

  /**
   * Confirm single file operation
   */
  async confirmOperation(
    operation: string,
    filePath: string,
    options: ConfirmationOptions = {},
  ): Promise<ConfirmationResult> {
    return await this.confirmBatchOperation(operation, [filePath], options);
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
      return { confirmed: true };
    }

    // Generate operation preview
    const preview = await this.generateOperationPreview(operation, paths);

    // Show preview if requested
    if (options.showPreview !== false) {
      this.displayOperationPreview(preview);
    }

    // Check for high-risk operations
    const highRiskWarnings = preview.risks.filter(
      (r) => r.level === 'high' || r.level === 'critical',
    );
    if (highRiskWarnings.length > 0) {
      const riskConfirmed = await this.confirmHighRiskOperation(preview, options);
      if (!riskConfirmed.confirmed) {
        return riskConfirmed;
      }
    }

    // Show main confirmation dialog
    return await this.showConfirmationDialog(preview, options);
  }

  /**
   * Confirm directory operation with recursive implications
   */
  async confirmDirectoryOperation(
    operation: string,
    directoryPath: string,
    options: ConfirmationOptions = {},
  ): Promise<ConfirmationResult> {
    console.log(chalk.yellow('\n📁 Directory Operation Confirmation'));
    console.log(`Operation: ${chalk.cyan(operation)}`);
    console.log(`Directory: ${chalk.yellow(directoryPath)}`);

    // Analyze directory contents
    const analysis = await this.analyzeDirectory(directoryPath);

    console.log(chalk.gray('\nDirectory Analysis:'));
    console.log(`  Files: ${analysis.fileCount}`);
    console.log(`  Subdirectories: ${analysis.dirCount}`);
    console.log(`  Total size: ${this.formatSize(analysis.totalSize)}`);

    if (analysis.importantFiles.length > 0) {
      console.log(chalk.yellow('\n⚠️ Important files detected:'));
      analysis.importantFiles.slice(0, 5).forEach((file) => {
        console.log(`  • ${chalk.yellow(file)}`);
      });
      if (analysis.importantFiles.length > 5) {
        console.log(`  • ... and ${analysis.importantFiles.length - 5} more`);
      }
    }

    return await this.confirmBatchOperation(operation, [directoryPath], {
      ...options,
      showPreview: true,
    });
  }

  /**
   * Show dry run preview
   */
  async showDryRun(
    operation: string,
    paths: string[],
    options: Record<string, unknown> = {},
  ): Promise<void> {
    console.log(chalk.blue('\n🔍 Dry Run Preview'));
    console.log(chalk.gray('This shows what would happen without making actual changes:\n'));

    const preview = await this.generateOperationPreview(operation, paths);

    preview.affectedFiles.forEach((file, index) => {
      if (index < 10) {
        // Show first 10 files
        console.log(`${chalk.green('→')} ${operation} ${chalk.gray(file)}`);
      }
    });

    if (preview.affectedFiles.length > 10) {
      console.log(`${chalk.gray('...')} and ${preview.affectedFiles.length - 10} more files`);
    }

    preview.affectedDirectories.forEach((dir) => {
      console.log(
        `${chalk.blue('→')} ${operation} ${chalk.gray(dir)} ${chalk.gray('(directory)')}`,
      );
    });

    if (preview.risks.length > 0) {
      console.log(chalk.yellow('\n⚠️ Identified Risks:'));
      preview.risks.forEach((risk) => {
        const color =
          risk.level === 'critical'
            ? chalk.red
            : risk.level === 'high'
              ? chalk.red
              : risk.level === 'medium'
                ? chalk.yellow
                : chalk.gray;
        console.log(`  ${color(risk.level.toUpperCase())}: ${risk.message}`);
      });
    }

    console.log(chalk.blue('\n✅ Dry run complete - no changes were made'));
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
  private shouldSkipConfirmation(operation: string, paths: string[]): boolean {
    // Check if any path matches skip patterns
    return paths.some((filePath) => {
      return Array.from(this.skipConfirmationPatterns).some((pattern) => {
        return this.matchesPattern(filePath, pattern);
      });
    });
  }

  /**
   * Generate operation preview
   */
  private async generateOperationPreview(
    operation: string,
    paths: string[],
  ): Promise<OperationPreview> {
    const preview: OperationPreview = {
      operation,
      totalItems: paths.length,
      affectedFiles: [],
      affectedDirectories: [],
      totalSize: 0,
      warnings: [],
      risks: [],
    };

    for (const filePath of paths) {
      try {
        const fs = require('fs');
        const stats = await fs.promises.stat(filePath);

        if (stats.isDirectory()) {
          preview.affectedDirectories.push(filePath);

          // Analyze directory contents
          const dirAnalysis = await this.analyzeDirectory(filePath);
          preview.totalSize += dirAnalysis.totalSize;
          preview.affectedFiles.push(...dirAnalysis.allFiles);
        } else {
          preview.affectedFiles.push(filePath);
          preview.totalSize += stats.size;
        }

        // Check for risks
        const risks = await this.assessFileRisks(filePath, operation);
        preview.risks.push(...risks);
      } catch (error) {
        preview.warnings.push(`Cannot access: ${filePath}`);
      }
    }

    return preview;
  }

  /**
   * Display operation preview
   */
  private displayOperationPreview(preview: OperationPreview): void {
    console.log(chalk.blue('\n📋 Operation Preview'));
    console.log(`Operation: ${chalk.cyan(preview.operation)}`);
    console.log(`Total items: ${chalk.yellow(preview.totalItems)}`);

    if (preview.affectedFiles.length > 0) {
      console.log(`Files affected: ${chalk.yellow(preview.affectedFiles.length)}`);
    }

    if (preview.affectedDirectories.length > 0) {
      console.log(`Directories affected: ${chalk.yellow(preview.affectedDirectories.length)}`);
    }

    if (preview.totalSize > 0) {
      console.log(`Total size: ${chalk.yellow(this.formatSize(preview.totalSize))}`);
    }

    // Show sample files
    if (preview.affectedFiles.length > 0) {
      console.log(chalk.gray('\nSample files:'));
      preview.affectedFiles.slice(0, 5).forEach((file) => {
        console.log(`  • ${chalk.gray(path.basename(file))}`);
      });
      if (preview.affectedFiles.length > 5) {
        console.log(`  • ... and ${preview.affectedFiles.length - 5} more`);
      }
    }

    // Show warnings
    if (preview.warnings.length > 0) {
      console.log(chalk.yellow('\n⚠️ Warnings:'));
      preview.warnings.forEach((warning) => {
        console.log(`  • ${chalk.yellow(warning)}`);
      });
    }
  }

  /**
   * Confirm high-risk operation
   */
  private async confirmHighRiskOperation(
    preview: OperationPreview,
    options: ConfirmationOptions,
  ): Promise<ConfirmationResult> {
    const criticalRisks = preview.risks.filter((r) => r.level === 'critical');
    const highRisks = preview.risks.filter((r) => r.level === 'high');

    if (criticalRisks.length > 0) {
      console.log(chalk.bgRed.white('\n🚨 CRITICAL RISK DETECTED 🚨'));
      criticalRisks.forEach((risk) => {
        console.log(chalk.red(`❌ ${risk.message}`));
        if (risk.path) {
          console.log(chalk.gray(`   Path: ${risk.path}`));
        }
      });

      // For critical risks, require explicit path typing
      const confirmed = await elevationPrompt.askYesNo(
        '\nDo you understand the risks and want to proceed anyway?',
        false,
        options.timeout,
      );

      if (!confirmed) {
        return { confirmed: false };
      }
    }

    if (highRisks.length > 0) {
      console.log(chalk.red('\n⚠️ High Risk Operation'));
      highRisks.forEach((risk) => {
        console.log(chalk.red(`⚠️ ${risk.message}`));
      });

      const confirmed = await elevationPrompt.askYesNo(
        '\nProceed with high-risk operation?',
        false,
        options.timeout,
      );

      if (!confirmed) {
        return { confirmed: false };
      }
    }

    return { confirmed: true };
  }

  /**
   * Show main confirmation dialog
   */
  private async showConfirmationDialog(
    preview: OperationPreview,
    options: ConfirmationOptions,
  ): Promise<ConfirmationResult> {
    console.log(chalk.blue('\n❓ Confirmation Required'));

    // Show operation summary
    const summary = this.generateOperationSummary(preview);
    console.log(summary);

    // Check if backup should be suggested
    const shouldBackup = this.shouldSuggestBackup(preview);
    if (shouldBackup) {
      console.log(chalk.yellow('\n💡 Backup recommended for this operation'));
    }

    // Show options
    console.log(chalk.gray('\nOptions:'));
    console.log(chalk.gray('  y/yes    - Proceed with operation'));
    console.log(chalk.gray('  n/no     - Cancel operation'));
    if (shouldBackup) {
      console.log(chalk.gray('  b/backup - Create backup and proceed'));
    }
    console.log(chalk.gray('  d/dry    - Show dry run (no changes)'));
    console.log(chalk.gray('  a/alt    - Show alternatives'));

    // Get user input
    const choice = await this.getUserChoice(['y', 'n', 'b', 'd', 'a'], options.timeout);

    switch (choice) {
      case 'y':
      case 'yes':
        return { confirmed: true };

      case 'n':
      case 'no':
        return { confirmed: false };

      case 'b':
      case 'backup':
        return {
          confirmed: true,
          options: { createBackup: true },
        };

      case 'd':
      case 'dry':
        await this.showDryRun(preview.operation, [
          ...preview.affectedFiles,
          ...preview.affectedDirectories,
        ]);
        return await this.showConfirmationDialog(preview, options);

      case 'a':
      case 'alt':
        const alternatives = this.generateAlternatives(preview);
        if (alternatives.length > 0) {
          const alternative = await this.selectAlternative(alternatives);
          if (alternative) {
            return { confirmed: false, options: { alternative } };
          }
        } else {
          console.log(chalk.yellow('No alternatives available for this operation'));
        }
        return await this.showConfirmationDialog(preview, options);

      default:
        return { confirmed: false };
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
    const analysis = {
      fileCount: 0,
      dirCount: 0,
      totalSize: 0,
      importantFiles: [] as string[],
      allFiles: [] as string[],
    };

    try {
      const fs = require('fs');
      const entries = await fs.promises.readdir(directoryPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(directoryPath, entry.name);

        if (entry.isDirectory()) {
          analysis.dirCount++;
          const subAnalysis = await this.analyzeDirectory(fullPath);
          analysis.fileCount += subAnalysis.fileCount;
          analysis.dirCount += subAnalysis.dirCount;
          analysis.totalSize += subAnalysis.totalSize;
          analysis.importantFiles.push(...subAnalysis.importantFiles);
          analysis.allFiles.push(...subAnalysis.allFiles);
        } else {
          analysis.fileCount++;
          analysis.allFiles.push(fullPath);

          try {
            const stats = await fs.promises.stat(fullPath);
            analysis.totalSize += stats.size;
          } catch {
            // Ignore stat errors for inaccessible files
          }

          // Check if file is important
          if (this.isImportantFile(fullPath)) {
            analysis.importantFiles.push(fullPath);
          }
        }
      }
    } catch (error) {
      // Directory not accessible
    }

    return analysis;
  }

  /**
   * Assess file risks for operation
   */
  private async assessFileRisks(
    filePath: string,
    operation: string,
  ): Promise<
    Array<{
      level: 'low' | 'medium' | 'high' | 'critical';
      message: string;
      path?: string;
    }>
  > {
    const risks = [];

    // Check for system files
    if (this.isSystemFile(filePath)) {
      risks.push({
        level: 'critical' as const,
        message: 'System file - operation may affect system stability',
        path: filePath,
      });
    }

    // Check for configuration files
    if (this.isConfigurationFile(filePath)) {
      risks.push({
        level: 'high' as const,
        message: 'Configuration file - may affect application behavior',
        path: filePath,
      });
    }

    // Check for executable files
    if (this.isExecutableFile(filePath)) {
      risks.push({
        level: 'medium' as const,
        message: 'Executable file - verify source before operation',
        path: filePath,
      });
    }

    // Check for important user files
    if (this.isImportantFile(filePath)) {
      risks.push({
        level: 'medium' as const,
        message: 'Important user file - consider backup',
        path: filePath,
      });
    }

    return risks;
  }

  /**
   * Check if file is a system file
   */
  private isSystemFile(filePath: string): boolean {
    const systemPaths = [
      '/System',
      '/usr',
      '/etc',
      '/bin',
      '/sbin',
      'C:\\Windows',
      'C:\\Program Files',
      'C:\\ProgramData',
    ];

    return systemPaths.some((sysPath) => filePath.startsWith(sysPath));
  }

  /**
   * Check if file is a configuration file
   */
  private isConfigurationFile(filePath: string): boolean {
    const configExtensions = ['.config', '.conf', '.ini', '.json', '.yaml', '.yml', '.toml'];
    const configNames = ['package.json', 'tsconfig.json', '.env', '.gitignore'];

    const ext = path.extname(filePath);
    const name = path.basename(filePath);

    return configExtensions.includes(ext) || configNames.includes(name);
  }

  /**
   * Check if file is executable
   */
  private isExecutableFile(filePath: string): boolean {
    const execExtensions = ['.exe', '.bat', '.cmd', '.sh', '.ps1', '.app'];
    const ext = path.extname(filePath);

    return execExtensions.includes(ext);
  }

  /**
   * Check if file is important
   */
  private isImportantFile(filePath: string): boolean {
    // Check against always backup patterns
    return Array.from(this.alwaysBackupPatterns).some((pattern) => {
      return this.matchesPattern(filePath, pattern);
    });
  }

  /**
   * Check if backup should be suggested
   */
  private shouldSuggestBackup(preview: OperationPreview): boolean {
    // Suggest backup for destructive operations
    const destructiveOps = ['delete', 'rm', 'move', 'mv'];
    if (destructiveOps.includes(preview.operation)) {
      return true;
    }

    // Suggest backup if important files are affected
    return preview.affectedFiles.some((file) => this.isImportantFile(file));
  }

  /**
   * Generate operation summary
   */
  private generateOperationSummary(preview: OperationPreview): string {
    const parts = [];

    parts.push(`${chalk.cyan(preview.operation)} ${chalk.yellow(preview.totalItems)} item(s)`);

    if (preview.totalSize > 0) {
      parts.push(`(${chalk.yellow(this.formatSize(preview.totalSize))})`);
    }

    return parts.join(' ');
  }

  /**
   * Generate alternatives for operation
   */
  private generateAlternatives(preview: OperationPreview): string[] {
    const alternatives = [];

    switch (preview.operation) {
      case 'delete':
      case 'rm':
        alternatives.push('Move to trash instead of permanent deletion');
        alternatives.push('Create backup before deletion');
        alternatives.push('Delete files one by one with confirmation');
        break;

      case 'move':
      case 'mv':
        alternatives.push('Copy files instead of moving');
        alternatives.push('Create backup at destination');
        break;

      case 'write':
        alternatives.push('Write to temporary location first');
        alternatives.push('Create backup of existing file');
        break;
    }

    return alternatives;
  }

  /**
   * Select alternative option
   */
  private async selectAlternative(alternatives: string[]): Promise<string | null> {
    console.log(chalk.green('\n💡 Available alternatives:'));
    alternatives.forEach((alt, index) => {
      console.log(`  ${index + 1}. ${alt}`);
    });

    const choice = await this.getUserChoice(
      alternatives.map((_, i) => (i + 1).toString()),
      10000,
    );

    const index = parseInt(choice) - 1;
    return index >= 0 && index < alternatives.length ? alternatives[index] : null;
  }

  /**
   * Get user choice with timeout
   */
  private async getUserChoice(validChoices: string[], timeout?: number): Promise<string> {
    return new Promise((resolve) => {
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const askChoice = () => {
        rl.question(chalk.blue('Your choice: '), (answer) => {
          const choice = answer.toLowerCase().trim();

          if (validChoices.includes(choice)) {
            rl.close();
            resolve(choice);
          } else {
            console.log(chalk.red(`Invalid choice. Please enter: ${validChoices.join(', ')}`));
            askChoice();
          }
        });
      };

      askChoice();

      if (timeout) {
        setTimeout(() => {
          rl.close();
          console.log(chalk.red('\n⏰ Choice timed out'));
          resolve('n'); // Default to no
        }, timeout);
      }
    });
  }

  /**
   * Format file size
   */
  private formatSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  }

  /**
   * Simple pattern matching
   */
  private matchesPattern(filePath: string, pattern: string): boolean {
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '[^/]');

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(filePath);
  }
}

export const operationConfirmation = OperationConfirmation.getInstance();
