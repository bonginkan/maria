/**
 * Filename Selector
 * Interactive UI for selecting from filename candidates
 */

import { FilenameCandidate, UserCancelledError } from '../types/filename-inference.types';
import * as path from 'node:path';

// Mock prompts for testing - in real implementation would use actual prompts library
interface PromptsResponse {
  choice: number;
  customName?: string;
}

export interface SelectionOptions {
  maxCandidates?: number;
  showConfidence?: boolean;
  showReasoning?: boolean;
  allowCustom?: boolean;
  allowCancel?: boolean;
}

export interface SelectionResult {
  selectedPath: string;
  isCustom: boolean;
  cancelled: boolean;
  selectionTime: number;
}

export class FilenameSelector {
  private readonly colors = {
    cyan: (text: string) => `\x1b[36m${text}\x1b[0m`,
    gray: (text: string) => `\x1b[90m${text}\x1b[0m`,
    yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
    green: (text: string) => `\x1b[32m${text}\x1b[0m`,
    red: (text: string) => `\x1b[31m${text}\x1b[0m`,
    bold: (text: string) => `\x1b[1m${text}\x1b[0m`
  };

  /**
   * Presents candidates to user and gets selection
   */
  async selectFromCandidates(
    candidates: FilenameCandidate[],
    code: string,
    options: SelectionOptions = {}
  ): Promise<SelectionResult> {
    const startTime = Date.now();
    
    // Configure options with defaults
    const config = {
      maxCandidates: 5,
      showConfidence: true,
      showReasoning: true,
      allowCustom: true,
      allowCancel: true,
      ...options
    };

    // Limit candidates
    const displayCandidates = candidates.slice(0, config.maxCandidates);

    // Display header
    this.displaySelectionHeader(displayCandidates.length);

    // Display candidates
    this.displayCandidates(displayCandidates, config);

    // Display code preview if short enough
    if (code.length < 300) {
      this.displayCodePreview(code);
    }

    // Get user selection
    try {
      const response = await this.promptForSelection(displayCandidates, config);
      
      const selectionTime = Date.now() - startTime;

      // Handle different selection types
      if (response.choice === -2) {
        return {
          selectedPath: '',
          isCustom: false,
          cancelled: true,
          selectionTime
        };
      }

      if (response.choice === -1) {
        // Custom name
        const customName = await this.promptForCustomName();
        return {
          selectedPath: customName,
          isCustom: true,
          cancelled: false,
          selectionTime
        };
      }

      // Regular selection
      const selected = displayCandidates[response.choice];
      return {
        selectedPath: selected.path,
        isCustom: false,
        cancelled: false,
        selectionTime
      };

    } catch (error) {
      // Handle Ctrl+C or other cancellation
      return {
        selectedPath: '',
        isCustom: false,
        cancelled: true,
        selectionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Displays the selection header
   */
  private displaySelectionHeader(count: number): void {
    console.log('\n' + this.colors.bold('📁 Choose filename:'));
    console.log(this.colors.gray(`Found ${count} candidate${count === 1 ? '' : 's'}:`));
    console.log('');
  }

  /**
   * Displays filename candidates
   */
  private displayCandidates(candidates: FilenameCandidate[], config: SelectionOptions): void {
    candidates.forEach((candidate, index) => {
      const number = this.colors.cyan(`  ${index + 1})`);
      const filename = this.colors.bold(candidate.filename);
      const directory = candidate.directory ? 
        this.colors.gray(` in ${candidate.directory}/`) : '';

      let line = `${number} ${filename}${directory}`;

      if (config.showConfidence) {
        const confidenceBar = this.getConfidenceBar(candidate.confidence);
        const confidencePercent = Math.round(candidate.confidence * 100);
        line += ` ${confidenceBar} ${confidencePercent}%`;
      }

      console.log(line);

      if (config.showReasoning && candidate.reasoning) {
        console.log(this.colors.gray(`     ${candidate.reasoning}`));
      }

      console.log('');
    });
  }

  /**
   * Creates a visual confidence bar
   */
  private getConfidenceBar(confidence: number): string {
    const bars = Math.round(confidence * 10);
    const filled = '█'.repeat(bars);
    const empty = '░'.repeat(10 - bars);
    
    let color = this.colors.red;
    if (confidence >= 0.9) color = this.colors.green;
    else if (confidence >= 0.7) color = this.colors.yellow;

    return color(filled) + this.colors.gray(empty);
  }

  /**
   * Displays a preview of the code
   */
  private displayCodePreview(code: string): void {
    console.log(this.colors.gray('📝 Code preview:'));
    const lines = code.split('\n').slice(0, 5);
    lines.forEach(line => {
      const truncated = line.length > 60 ? line.slice(0, 57) + '...' : line;
      console.log(this.colors.gray(`   ${truncated}`));
    });
    if (code.split('\n').length > 5) {
      console.log(this.colors.gray('   ...'));
    }
    console.log('');
  }

  /**
   * Prompts user for selection (mock implementation)
   */
  private async promptForSelection(
    candidates: FilenameCandidate[],
    config: SelectionOptions
  ): Promise<PromptsResponse> {
    // In a real implementation, this would use a library like 'prompts'
    // For now, returning mock data for testing

    const choices = [
      ...candidates.map((c, i) => ({
        title: `${c.filename} (${Math.round(c.confidence * 100)}%)`,
        value: i
      }))
    ];

    if (config.allowCustom) {
      choices.push({ title: '💾 Enter custom name...', value: -1 });
    }

    if (config.allowCancel) {
      choices.push({ title: '❌ Cancel', value: -2 });
    }

    // Mock: return first choice for testing
    // In real implementation:
    /*
    const prompts = require('prompts');
    const response = await prompts({
      type: 'select',
      name: 'choice',
      message: 'Select filename:',
      choices,
      initial: 0
    });
    return response;
    */

    return { choice: 0 }; // Mock selection
  }

  /**
   * Prompts for custom filename
   */
  private async promptForCustomName(): Promise<string> {
    // In a real implementation:
    /*
    const prompts = require('prompts');
    const response = await prompts({
      type: 'text',
      name: 'customName',
      message: 'Enter filename:',
      validate: (value: string) => {
        if (!value.trim()) return 'Filename cannot be empty';
        if (!/\.[a-zA-Z0-9]+$/.test(value)) return 'Filename must have an extension';
        return true;
      }
    });
    return response.customName || '';
    */

    return 'custom-file.js'; // Mock
  }

  /**
   * Displays selection summary
   */
  displaySelectionSummary(result: SelectionResult): void {
    if (result.cancelled) {
      console.log(this.colors.yellow('⚠️  Operation cancelled by user'));
      return;
    }

    const filename = path.basename(result.selectedPath);
    const directory = path.dirname(result.selectedPath);
    
    if (result.isCustom) {
      console.log(this.colors.green(`✅ Custom filename: ${filename}`));
    } else {
      console.log(this.colors.green(`✅ Selected: ${filename}`));
    }

    if (directory && directory !== '.') {
      console.log(this.colors.gray(`   Directory: ${directory}/`));
    }

    console.log(this.colors.gray(`   Selection time: ${result.selectionTime}ms`));
    console.log('');
  }

  /**
   * Shows confidence explanation
   */
  showConfidenceExplanation(): void {
    console.log(this.colors.gray('\nConfidence levels:'));
    console.log(this.colors.green('█████████░ 90%+') + this.colors.gray(' - High confidence (auto-save)'));
    console.log(this.colors.yellow('██████░░░░ 60%+') + this.colors.gray(' - Medium confidence (user choice)'));
    console.log(this.colors.red('███░░░░░░░ 30%+') + this.colors.gray(' - Low confidence (suggestions only)'));
  }

  /**
   * Creates a non-interactive selection for testing/CI
   */
  selectFirstCandidate(candidates: FilenameCandidate[]): SelectionResult {
    if (candidates.length === 0) {
      return {
        selectedPath: 'default.txt',
        isCustom: false,
        cancelled: false,
        selectionTime: 0
      };
    }

    return {
      selectedPath: candidates[0].path,
      isCustom: false,
      cancelled: false,
      selectionTime: 0
    };
  }

  /**
   * Validates a filename input
   */
  static validateFilename(filename: string): { valid: boolean; error?: string } {
    if (!filename.trim()) {
      return { valid: false, error: 'Filename cannot be empty' };
    }

    if (filename.includes('/') || filename.includes('\\')) {
      return { valid: false, error: 'Filename cannot contain path separators' };
    }

    if (!/\.[a-zA-Z0-9]+$/.test(filename)) {
      return { valid: false, error: 'Filename must have a valid extension' };
    }

    if (/[<>:"|?*\x00-\x1F]/.test(filename)) {
      return { valid: false, error: 'Filename contains invalid characters' };
    }

    if (filename.length > 255) {
      return { valid: false, error: 'Filename too long (max 255 characters)' };
    }

    return { valid: true };
  }
}