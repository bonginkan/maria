/**
 * Dry Run Mode
 * Provides preview of what would happen without actually creating files
 */

import { 
  FilenameCandidate, 
  SaveOperation, 
  SaveResult,
  PlanFileSaveConfig 
} from '../types/filename-inference.types';
import * as path from 'node:path';
import * as fs from 'node:fs';

export interface DryRunResult {
  wouldCreate: boolean;
  targetPath: string;
  conflictsWith?: string;
  sizeEstimate: string;
  permissions: 'ok' | 'denied' | 'unknown';
  planCompliance: 'allowed' | 'forbidden' | 'warning';
  recommendations: string[];
}

export interface DryRunOptions {
  showContent?: boolean;
  showConflicts?: boolean;
  showPermissions?: boolean;
  showPlanCompliance?: boolean;
  verboseOutput?: boolean;
}

export class DryRunMode {
  private readonly colors = {
    cyan: (text: string) => `\x1b[36m${text}\x1b[0m`,
    gray: (text: string) => `\x1b[90m${text}\x1b[0m`,
    yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
    green: (text: string) => `\x1b[32m${text}\x1b[0m`,
    red: (text: string) => `\x1b[31m${text}\x1b[0m`,
    bold: (text: string) => `\x1b[1m${text}\x1b[0m`,
    dim: (text: string) => `\x1b[2m${text}\x1b[0m`
  };

  /**
   * Performs a dry run analysis of save operations
   */
  async performDryRun(
    candidates: FilenameCandidate[],
    content: string,
    planConfig?: PlanFileSaveConfig,
    options: DryRunOptions = {}
  ): Promise<DryRunResult[]> {
    const results: DryRunResult[] = [];

    for (const candidate of candidates) {
      const result = await this.analyzeSingleCandidate(
        candidate,
        content,
        planConfig,
        options
      );
      results.push(result);
    }

    return results;
  }

  /**
   * Analyzes a single candidate for dry run
   */
  private async analyzeSingleCandidate(
    candidate: FilenameCandidate,
    content: string,
    planConfig?: PlanFileSaveConfig,
    options: DryRunOptions = {}
  ): Promise<DryRunResult> {
    const targetPath = path.resolve(candidate.path);
    
    // Check for conflicts
    const conflictsWith = this.checkConflicts(targetPath);
    
    // Check permissions
    const permissions = await this.checkPermissions(targetPath);
    
    // Check plan compliance
    const planCompliance = this.checkPlanCompliance(
      candidate.extension,
      content,
      planConfig
    );
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(
      candidate,
      conflictsWith,
      permissions,
      planCompliance
    );

    return {
      wouldCreate: true,
      targetPath,
      conflictsWith,
      sizeEstimate: this.formatSize(content.length),
      permissions,
      planCompliance,
      recommendations
    };
  }

  /**
   * Checks for file conflicts
   */
  private checkConflicts(targetPath: string): string | undefined {
    if (fs.existsSync(targetPath)) {
      try {
        const stats = fs.statSync(targetPath);
        const modifiedTime = stats.mtime.toLocaleDateString();
        const size = this.formatSize(stats.size);
        return `Existing file (${size}, modified ${modifiedTime})`;
      } catch {
        return 'Existing file (details unavailable)';
      }
    }
    return undefined;
  }

  /**
   * Checks directory permissions
   */
  private async checkPermissions(targetPath: string): Promise<'ok' | 'denied' | 'unknown'> {
    const directory = path.dirname(targetPath);
    
    try {
      // Check if directory exists and is writable
      if (!fs.existsSync(directory)) {
        // Try to create directory to test permissions
        return 'unknown'; // Would need to create parent dirs
      }

      // Test write access by attempting to create a temp file
      const testFile = path.join(directory, '.maria-test-' + Date.now());
      try {
        fs.writeFileSync(testFile, '');
        fs.unlinkSync(testFile);
        return 'ok';
      } catch {
        return 'denied';
      }
    } catch {
      return 'unknown';
    }
  }

  /**
   * Checks compliance with plan restrictions
   */
  private checkPlanCompliance(
    extension: string,
    content: string,
    planConfig?: PlanFileSaveConfig
  ): 'allowed' | 'forbidden' | 'warning' {
    if (!planConfig) return 'allowed';

    const ext = extension.toLowerCase().replace(/^\./, '');
    
    // Check extension allowlist
    if (!planConfig.fileSave.allowExtensions.includes(ext)) {
      return 'forbidden';
    }

    // Check file size
    const sizeMB = content.length / (1024 * 1024);
    if (sizeMB > planConfig.fileSave.maxFileSizeMB) {
      return 'forbidden';
    }

    // All checks pass
    return 'allowed';
  }

  /**
   * Generates recommendations based on analysis
   */
  private generateRecommendations(
    candidate: FilenameCandidate,
    conflictsWith?: string,
    permissions: 'ok' | 'denied' | 'unknown' = 'unknown',
    planCompliance: 'allowed' | 'forbidden' | 'warning' = 'allowed'
  ): string[] {
    const recommendations: string[] = [];

    if (conflictsWith) {
      recommendations.push('File already exists - would be overwritten');
    }

    if (permissions === 'denied') {
      recommendations.push('Permission denied - check directory permissions');
    } else if (permissions === 'unknown') {
      recommendations.push('Unable to verify permissions - directory may not exist');
    }

    if (planCompliance === 'forbidden') {
      recommendations.push('Violates plan restrictions - upgrade plan or choose different extension');
    }

    if (candidate.confidence < 0.7) {
      recommendations.push('Low confidence - consider providing more specific instructions');
    }

    if (recommendations.length === 0) {
      recommendations.push('Ready to create file');
    }

    return recommendations;
  }

  /**
   * Displays dry run results in a user-friendly format
   */
  displayDryRunResults(
    results: DryRunResult[],
    options: DryRunOptions = {}
  ): void {
    console.log('\n' + this.colors.bold('🔍 Dry Run Preview') + ' (no files will be created)');
    console.log(this.colors.gray('─'.repeat(50)));

    results.forEach((result, index) => {
      console.log(`\n${this.colors.cyan(`${index + 1}.`)} ${this.colors.bold(path.basename(result.targetPath))}`);
      console.log(`   ${this.colors.gray('Path:')} ${result.targetPath}`);
      console.log(`   ${this.colors.gray('Size:')} ${result.sizeEstimate}`);
      
      // Show status
      const status = this.getStatusString(result);
      console.log(`   ${this.colors.gray('Status:')} ${status}`);

      // Show conflicts
      if (result.conflictsWith) {
        console.log(`   ${this.colors.yellow('⚠️  Conflict:')} ${result.conflictsWith}`);
      }

      // Show recommendations
      if (result.recommendations.length > 0) {
        console.log(`   ${this.colors.gray('Notes:')}`);
        result.recommendations.forEach(rec => {
          const icon = rec.includes('error') || rec.includes('denied') ? '❌' : 
                      rec.includes('warning') || rec.includes('conflict') ? '⚠️' : '💡';
          console.log(`     ${icon} ${rec}`);
        });
      }
    });

    console.log('\n' + this.colors.gray('Use --force to proceed with file creation'));
  }

  /**
   * Gets a colored status string
   */
  private getStatusString(result: DryRunResult): string {
    if (result.planCompliance === 'forbidden') {
      return this.colors.red('❌ Plan restriction');
    }

    if (result.permissions === 'denied') {
      return this.colors.red('❌ Permission denied');
    }

    if (result.conflictsWith) {
      return this.colors.yellow('⚠️  Would overwrite');
    }

    if (result.permissions === 'unknown') {
      return this.colors.yellow('⚠️  Directory missing');
    }

    return this.colors.green('✅ Ready to create');
  }

  /**
   * Formats file size in human-readable format
   */
  private formatSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  /**
   * Creates a summary of what would happen
   */
  createSummary(results: DryRunResult[]): {
    totalFiles: number;
    conflicts: number;
    permissionIssues: number;
    planViolations: number;
    readyToCreate: number;
    totalSize: string;
  } {
    return {
      totalFiles: results.length,
      conflicts: results.filter(r => r.conflictsWith).length,
      permissionIssues: results.filter(r => r.permissions === 'denied').length,
      planViolations: results.filter(r => r.planCompliance === 'forbidden').length,
      readyToCreate: results.filter(r => 
        !r.conflictsWith && 
        r.permissions === 'ok' && 
        r.planCompliance === 'allowed'
      ).length,
      totalSize: this.formatSize(results.reduce((sum, r) => 
        sum + parseInt(r.sizeEstimate), 0
      ))
    };
  }

  /**
   * Displays a compact summary
   */
  displaySummary(results: DryRunResult[]): void {
    const summary = this.createSummary(results);
    
    console.log('\n' + this.colors.bold('📋 Summary:'));
    console.log(`   Files to create: ${summary.totalFiles}`);
    console.log(`   Ready: ${this.colors.green(summary.readyToCreate.toString())}`);
    
    if (summary.conflicts > 0) {
      console.log(`   Conflicts: ${this.colors.yellow(summary.conflicts.toString())}`);
    }
    
    if (summary.permissionIssues > 0) {
      console.log(`   Permission issues: ${this.colors.red(summary.permissionIssues.toString())}`);
    }
    
    if (summary.planViolations > 0) {
      console.log(`   Plan violations: ${this.colors.red(summary.planViolations.toString())}`);
    }
  }

  /**
   * Converts dry run result to a save result format
   */
  toDryRunSaveResult(results: DryRunResult[]): SaveResult {
    const suggestions = results.map(r => ({
      path: r.targetPath,
      filename: path.basename(r.targetPath),
      extension: path.extname(r.targetPath),
      directory: path.dirname(r.targetPath),
      confidence: 0.8, // Dry run doesn't have confidence
      reasoning: 'Dry run preview',
      source: 'dry-run' as const
    }));

    return {
      success: true,
      dryRun: true,
      suggested: suggestions
    };
  }
}