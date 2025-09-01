/**
 * Filename UX Orchestrator
 * Coordinates all UX components for the complete filename inference experience
 */

import { 
  FilenameCandidate, 
  SaveOperation, 
  SaveResult, 
  SaveMode, 
  PlanFileSaveConfig,
  ProjectContext
} from './types/filename-inference.types';

import { FilenameInferenceService } from './FilenameInferenceService';
import { SaveModeDecider, SaveModeOptions, EnvironmentContext } from './modes/SaveModeDecider';
import { FilenameSelector, SelectionOptions } from './ui/FilenameSelector';
import { DryRunMode, DryRunOptions } from './modes/DryRunMode';
import { UndoManager } from './modes/UndoManager';
import { PlanEnforcer } from './security/PlanEnforcer';
import { filenameInferenceTelemetry } from './telemetry/FilenameInferenceTelemetry';

import * as fs from 'node:fs';
import * as path from 'node:path';

export interface UXOptions {
  saveMode?: SaveModeOptions;
  selection?: SelectionOptions;
  dryRun?: DryRunOptions;
  verbose?: boolean;
  skipBackup?: boolean;
}

export interface UXResult extends SaveResult {
  mode: SaveMode;
  selectionTime?: number;
  undoId?: string;
  warnings: string[];
}

export class FilenameUXOrchestrator {
  private inferenceService: FilenameInferenceService;
  private saveModeDecider: SaveModeDecider;
  private filenameSelector: FilenameSelector;
  private dryRunMode: DryRunMode;
  private undoManager: UndoManager;
  private planEnforcer: PlanEnforcer;

  constructor(projectRoot: string) {
    this.inferenceService = new FilenameInferenceService();
    this.saveModeDecider = new SaveModeDecider();
    this.filenameSelector = new FilenameSelector();
    this.dryRunMode = new DryRunMode();
    this.undoManager = new UndoManager();
    this.planEnforcer = new PlanEnforcer(projectRoot);
  }

  /**
   * Main orchestration method - handles the complete UX flow
   */
  async orchestrate(
    prompt: string,
    code: string,
    context: ProjectContext,
    planConfig?: PlanFileSaveConfig,
    options: UXOptions = {}
  ): Promise<UXResult> {
    const startTime = Date.now();
    const warnings: string[] = [];

    try {
      // Step 1: Inference
      if (options.verbose) {
        console.log('🔍 Analyzing filename options...');
      }
      
      const inferenceResult = await this.inferenceService.inferFilename(
        prompt,
        code,
        context
      );

      const bestCandidate = inferenceResult.candidates[0];
      if (!bestCandidate) {
        return {
          success: false,
          error: 'No filename candidates generated',
          mode: 'dry-run',
          warnings
        };
      }

      // Step 2: Determine save mode
      const mode = this.saveModeDecider.decide(
        bestCandidate.confidence,
        options.saveMode
      );

      // Record save mode decision telemetry
      const decision = this.saveModeDecider.createDecisionSummary(
        mode,
        bestCandidate.confidence,
        options.saveMode
      );
      filenameInferenceTelemetry.recordSaveModeDecision(
        bestCandidate.confidence,
        mode,
        decision.reason
      );

      if (options.verbose) {
        console.log(`💡 ${decision.explanation}`);
      }

      // Step 3: Execute based on mode
      switch (mode) {
        case 'immediate':
          return await this.executeImmediate(
            bestCandidate,
            code,
            context,
            planConfig,
            options,
            warnings
          );

        case 'interactive':
          return await this.executeInteractive(
            inferenceResult.candidates,
            code,
            context,
            planConfig,
            options,
            warnings
          );

        case 'dry-run':
          return await this.executeDryRun(
            inferenceResult.candidates,
            code,
            planConfig,
            options,
            warnings
          );

        default:
          throw new Error(`Unknown save mode: ${mode}`);
      }

    } catch (error) {
      return {
        success: false,
        error: `Orchestration failed: ${(error as Error).message}`,
        mode: 'dry-run',
        warnings
      };
    }
  }

  /**
   * Executes immediate save mode
   */
  private async executeImmediate(
    candidate: FilenameCandidate,
    code: string,
    context: ProjectContext,
    planConfig?: PlanFileSaveConfig,
    options: UXOptions = {},
    warnings: string[] = []
  ): Promise<UXResult> {
    if (options.verbose) {
      console.log(`💾 Saving immediately: ${candidate.filename}`);
    }

    const saveResult = await this.saveFile(
      candidate,
      code,
      context,
      planConfig,
      options
    );

    return {
      ...saveResult,
      mode: 'immediate',
      warnings
    };
  }

  /**
   * Executes interactive selection mode
   */
  private async executeInteractive(
    candidates: FilenameCandidate[],
    code: string,
    context: ProjectContext,
    planConfig?: PlanFileSaveConfig,
    options: UXOptions = {},
    warnings: string[] = []
  ): Promise<UXResult> {
    if (options.verbose) {
      console.log('🎯 Interactive mode: Please select filename...');
    }

    try {
      const selectionResult = await this.filenameSelector.selectFromCandidates(
        candidates,
        code,
        options.selection
      );

      if (selectionResult.cancelled) {
        return {
          success: false,
          error: 'User cancelled selection',
          mode: 'interactive',
          selectionTime: selectionResult.selectionTime,
          warnings
        };
      }

      // Find the selected candidate or create custom one
      let selectedCandidate: FilenameCandidate;
      if (selectionResult.isCustom) {
        selectedCandidate = this.createCustomCandidate(
          selectionResult.selectedPath,
          context
        );
      } else {
        selectedCandidate = candidates.find(c => c.path === selectionResult.selectedPath) 
          || candidates[0];
      }

      const saveResult = await this.saveFile(
        selectedCandidate,
        code,
        context,
        planConfig,
        options
      );

      return {
        ...saveResult,
        mode: 'interactive',
        selectionTime: selectionResult.selectionTime,
        warnings
      };

    } catch (error) {
      return {
        success: false,
        error: `Interactive selection failed: ${(error as Error).message}`,
        mode: 'interactive',
        warnings
      };
    }
  }

  /**
   * Executes dry-run mode
   */
  private async executeDryRun(
    candidates: FilenameCandidate[],
    code: string,
    planConfig?: PlanFileSaveConfig,
    options: UXOptions = {},
    warnings: string[] = []
  ): Promise<UXResult> {
    if (options.verbose) {
      console.log('🔍 Dry-run mode: Analyzing what would happen...');
    }

    try {
      const dryRunResults = await this.dryRunMode.performDryRun(
        candidates,
        code,
        planConfig,
        options.dryRun
      );

      // Display results if verbose
      if (options.verbose) {
        this.dryRunMode.displayDryRunResults(dryRunResults, options.dryRun);
        this.dryRunMode.displaySummary(dryRunResults);
      }

      const saveResult = this.dryRunMode.toDryRunSaveResult(dryRunResults);

      return {
        ...saveResult,
        mode: 'dry-run',
        warnings
      };

    } catch (error) {
      return {
        success: false,
        error: `Dry-run failed: ${(error as Error).message}`,
        mode: 'dry-run',
        warnings
      };
    }
  }

  /**
   * Actually saves a file with all safety checks
   */
  private async saveFile(
    candidate: FilenameCandidate,
    code: string,
    context: ProjectContext,
    planConfig?: PlanFileSaveConfig,
    options: UXOptions = {}
  ): Promise<SaveResult> {
    const startTime = Date.now();
    
    try {
      // Create save operation
      const operation: SaveOperation = {
        type: fs.existsSync(candidate.path) ? 'overwrite' : 'create',
        filename: path.basename(candidate.path),
        path: candidate.path,
        content: code,
        planId: context.planId,
        timestamp: Date.now()
      };

      // Apply security constraints
      const safeOperation = await this.planEnforcer.enforce(operation);

      // Record for undo (before writing)
      let undoId: string | undefined;
      if (!options.skipBackup) {
        undoId = await this.undoManager.recordOperation(safeOperation);
      }

      // Ensure directory exists
      const directory = path.dirname(safeOperation.path);
      if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
      }

      // Write file
      fs.writeFileSync(safeOperation.path, safeOperation.content, 'utf-8');

      const result: SaveResult = {
        success: true,
        path: safeOperation.path,
        undoId
      };

      // Record save telemetry
      filenameInferenceTelemetry.recordSave(operation, result, Date.now() - startTime);

      if (options.verbose) {
        console.log(`✅ Saved: ${path.basename(safeOperation.path)}`);
        if (undoId) {
          console.log(`💾 Backup created for undo`);
        }
      }

      return result;

    } catch (error) {
      const result: SaveResult = {
        success: false,
        error: `Failed to save file: ${(error as Error).message}`
      };

      // Record failed save telemetry
      const operation: SaveOperation = {
        type: 'create',
        filename: path.basename(candidate.path),
        path: candidate.path,
        content: code,
        planId: context.planId,
        timestamp: Date.now()
      };
      filenameInferenceTelemetry.recordSave(operation, result, Date.now() - startTime);

      return result;
    }
  }

  /**
   * Creates a custom candidate from user input
   */
  private createCustomCandidate(
    customPath: string,
    context: ProjectContext
  ): FilenameCandidate {
    const fullPath = path.isAbsolute(customPath) 
      ? customPath 
      : path.join(context.root || '.', customPath);

    return {
      path: fullPath,
      filename: path.basename(customPath),
      extension: path.extname(customPath),
      directory: path.dirname(fullPath),
      confidence: 1.0, // User specified, so high confidence
      reasoning: 'User provided custom filename',
      source: 'explicit'
    };
  }

  /**
   * Provides undo functionality
   */
  async undo(): Promise<UXResult> {
    try {
      const result = await this.undoManager.undo();
      
      if (result.success) {
        console.log('✅ Undo completed successfully');
        if (result.operation) {
          const formatted = this.undoManager.formatOperation(result.operation);
          console.log(`   ${formatted}`);
        }
      } else {
        console.log(`❌ Undo failed: ${result.error}`);
      }

      return {
        success: result.success,
        error: result.error,
        mode: 'immediate', // Undo is immediate
        warnings: []
      };

    } catch (error) {
      return {
        success: false,
        error: `Undo operation failed: ${(error as Error).message}`,
        mode: 'immediate',
        warnings: []
      };
    }
  }

  /**
   * Shows undo history
   */
  showUndoHistory(): void {
    this.undoManager.displayHistory();
  }

  /**
   * Gets service statistics
   */
  getStats(): {
    inference: ReturnType<FilenameInferenceService['getStats']>;
    undo: ReturnType<UndoManager['getStats']>;
  } {
    return {
      inference: this.inferenceService.getStats(),
      undo: this.undoManager.getStats()
    };
  }

  /**
   * Clears all caches and history
   */
  async cleanup(): Promise<void> {
    this.inferenceService.clearCache();
    await this.undoManager.clearHistory();
  }

  /**
   * Validates UX configuration
   */
  validateOptions(options: UXOptions): string[] {
    const issues: string[] = [];

    if (options.saveMode?.dryRun && options.saveMode?.force) {
      issues.push('Cannot use --dry-run and --force together');
    }

    if (options.selection?.maxCandidates && options.selection.maxCandidates < 1) {
      issues.push('maxCandidates must be at least 1');
    }

    return issues;
  }

  /**
   * Creates a preset configuration for common use cases
   */
  static createPreset(preset: 'ci' | 'interactive' | 'safe' | 'fast'): UXOptions {
    switch (preset) {
      case 'ci':
        return {
          saveMode: { acceptFirst: true, interactive: false },
          verbose: false,
          skipBackup: true
        };

      case 'interactive':
        return {
          selection: { 
            showConfidence: true, 
            showReasoning: true,
            allowCustom: true,
            allowCancel: true
          },
          verbose: true
        };

      case 'safe':
        return {
          saveMode: { dryRun: true },
          dryRun: { 
            showConflicts: true,
            showPermissions: true,
            showPlanCompliance: true
          },
          verbose: true
        };

      case 'fast':
        return {
          saveMode: { force: true },
          verbose: false,
          skipBackup: false
        };

      default:
        return {};
    }
  }
}