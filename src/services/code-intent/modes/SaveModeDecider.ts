/**
 * Save Mode Decider
 * Determines appropriate save mode based on confidence and context
 */

import { SaveMode } from '../types/filename-inference.types';

export interface SaveModeOptions {
  dryRun?: boolean;
  preview?: boolean;
  acceptFirst?: boolean;
  interactive?: boolean;
  force?: boolean;
}

export interface EnvironmentContext {
  isCi: boolean;
  isTty: boolean;
  isTest: boolean;
  verboseMode: boolean;
}

export class SaveModeDecider {
  private defaultThresholds = {
    immediate: 0.9,
    interactive: 0.7,
    dryRun: 0.0
  };

  /**
   * Determines the appropriate save mode based on confidence and options
   */
  decide(
    confidence: number, 
    options: SaveModeOptions = {},
    env: EnvironmentContext = this.getEnvironmentContext()
  ): SaveMode {
    // Explicit options override everything
    if (options.dryRun || options.preview) {
      return 'dry-run';
    }

    if (options.force) {
      return 'immediate';
    }

    // CI environment handling
    if (env.isCi) {
      if (options.acceptFirst || confidence >= 0.7) {
        return 'immediate';
      }
      return 'dry-run'; // Don't create files in CI unless explicitly requested
    }

    // Non-interactive environment (no TTY)
    if (!env.isTty || env.isTest) {
      return confidence >= this.defaultThresholds.interactive ? 'immediate' : 'dry-run';
    }

    // Interactive environment (normal terminal usage)
    if (options.interactive !== false) {
      if (confidence >= this.defaultThresholds.immediate) {
        return 'immediate';
      } else if (confidence >= this.defaultThresholds.interactive) {
        return 'interactive';
      }
    }

    return 'dry-run';
  }

  /**
   * Gets environment context
   */
  private getEnvironmentContext(): EnvironmentContext {
    return {
      isCi: !!(process.env.CI || process.env.CONTINUOUS_INTEGRATION || process.env.GITHUB_ACTIONS),
      isTty: !!process.stdout.isTTY,
      isTest: process.env.NODE_ENV === 'test' || !!process.env.VITEST,
      verboseMode: !!(process.env.VERBOSE || process.env.DEBUG)
    };
  }

  /**
   * Gets a human-readable explanation of why a mode was chosen
   */
  explainDecision(
    mode: SaveMode,
    confidence: number,
    options: SaveModeOptions = {},
    env: EnvironmentContext = this.getEnvironmentContext()
  ): string {
    if (options.dryRun || options.preview) {
      return 'Dry-run mode: explicitly requested via --dry-run or --preview';
    }

    if (options.force) {
      return 'Immediate mode: forced via --force option';
    }

    if (env.isCi) {
      return mode === 'immediate' 
        ? 'Immediate mode: CI environment with acceptable confidence'
        : 'Dry-run mode: CI environment, preventing file creation';
    }

    if (!env.isTty) {
      return mode === 'immediate'
        ? 'Immediate mode: non-interactive environment with good confidence'
        : 'Dry-run mode: non-interactive environment with low confidence';
    }

    switch (mode) {
      case 'immediate':
        return `Immediate mode: high confidence (${Math.round(confidence * 100)}% ≥ ${this.defaultThresholds.immediate * 100}%)`;
      case 'interactive':
        return `Interactive mode: medium confidence (${Math.round(confidence * 100)}%), user choice required`;
      case 'dry-run':
        return `Dry-run mode: low confidence (${Math.round(confidence * 100)}% < ${this.defaultThresholds.interactive * 100}%)`;
      default:
        return 'Unknown mode';
    }
  }

  /**
   * Updates confidence thresholds based on user preferences
   */
  updateThresholds(thresholds: Partial<typeof this.defaultThresholds>): void {
    this.defaultThresholds = { ...this.defaultThresholds, ...thresholds };
  }

  /**
   * Gets current confidence thresholds
   */
  getThresholds(): typeof this.defaultThresholds {
    return { ...this.defaultThresholds };
  }

  /**
   * Checks if a mode would create files
   */
  static wouldCreateFile(mode: SaveMode): boolean {
    return mode === 'immediate' || mode === 'interactive';
  }

  /**
   * Gets recommended next action for each mode
   */
  getRecommendedAction(mode: SaveMode, confidence: number): string {
    switch (mode) {
      case 'immediate':
        return 'File will be saved automatically';
      case 'interactive':
        return 'Please select from filename candidates';
      case 'dry-run':
        return confidence < 0.5 
          ? 'Consider providing more specific instructions'
          : 'Use --force to save anyway, or provide more context';
      default:
        return 'Unknown action required';
    }
  }

  /**
   * Creates a summary of the decision
   */
  createDecisionSummary(
    mode: SaveMode,
    confidence: number,
    options: SaveModeOptions = {},
    env: EnvironmentContext = this.getEnvironmentContext()
  ): {
    mode: SaveMode;
    confidence: number;
    explanation: string;
    recommendation: string;
    willCreateFile: boolean;
  } {
    return {
      mode,
      confidence,
      explanation: this.explainDecision(mode, confidence, options, env),
      recommendation: this.getRecommendedAction(mode, confidence),
      willCreateFile: SaveModeDecider.wouldCreateFile(mode)
    };
  }
}