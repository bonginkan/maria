/**
 * Enhanced /code Command with Intelligent Filename Inference
 * Phase 4: Integrated implementation with UX orchestration
 */

import { BaseCommand, CommandMeta, CommandResult, CommandContext } from '../../shared';
import { FilenameUXOrchestrator, UXOptions } from '../../../services/code-intent/FilenameUXOrchestrator';
import { ProjectContext } from '../../../services/code-intent/types/filename-inference.types';
import { executeCode } from '../../../services/cli-auth/api-caller';
import { getFirestorePlanConfig } from '../../../services/code-intent/security/ExtensionGuard';
import * as path from 'node:path';
import * as fs from 'node:fs';

export interface CodeCommandOptions {
  // Filename inference options
  '--file'?: string;           // Explicit filename
  '--dry-run'?: boolean;       // Preview mode only
  '--force'?: boolean;         // Force save even with low confidence
  '--interactive'?: boolean;   // Force interactive mode
  '--dir'?: string;           // Target directory
  
  // Code generation options
  '--language'?: string;       // Target language
  '--framework'?: string;      // Framework to use (react, vue, etc.)
  '--style'?: string;         // Code style (functional, class, etc.)
  
  // System options
  '--verbose'?: boolean;       // Detailed output
  '--no-backup'?: boolean;     // Skip undo backup
  '--model'?: string;         // AI model selection
}

export class IntegratedCodeCommand extends BaseCommand {
  readonly meta: CommandMeta = {
    name: 'code',
    category: 'code',
    description: 'Generate code with intelligent filename inference',
    status: 'stable',
    requiresAuth: true,
    planRestrictions: []
  };

  private uxOrchestrator: FilenameUXOrchestrator;
  private projectRoot: string;

  constructor(context: CommandContext = {}) {
    super(context);
    this.projectRoot = process.cwd();
    this.uxOrchestrator = new FilenameUXOrchestrator(this.projectRoot);
  }

  async execute(): Promise<CommandResult> {
    const startTime = Date.now();
    
    try {
      // Parse arguments and options
      const { prompt, options } = this.parseArguments();
      
      if (!prompt) {
        return {
          requiresInput: true,
          endReason: 'error',
          message: 'Please provide a code generation request',
          error: 'No prompt provided'
        };
      }

      // Step 1: Generate code using AI
      if (options['--verbose']) {
        console.log('🤖 Generating code...');
      }

      const codeResult = await this.generateCode(prompt, options);
      if (!codeResult.success) {
        return {
          requiresInput: false,
          endReason: 'error',
          message: 'Failed to generate code',
          error: codeResult.error
        };
      }

      // Step 2: Prepare project context
      const projectContext = await this.buildProjectContext(options);
      
      // Step 3: Get plan configuration for user
      const planConfig = await this.getPlanConfiguration();

      // Step 4: Configure UX options
      const uxOptions = this.buildUXOptions(options);

      // Step 5: Orchestrate filename inference and save
      if (options['--verbose']) {
        console.log('📁 Determining filename...');
      }

      const result = await this.uxOrchestrator.orchestrate(
        prompt,
        codeResult.code!,
        projectContext,
        planConfig,
        uxOptions
      );

      // Step 6: Format and return result
      return this.formatResult(result, startTime, options);

    } catch (error) {
      return {
        requiresInput: false,
        endReason: 'error',
        message: `Code generation failed: ${(error as Error).message}`,
        error: (error as Error).message
      };
    }
  }

  /**
   * Parses command arguments and extracts options
   */
  private parseArguments(): { prompt: string; options: CodeCommandOptions } {
    const args = this.context.args || [];
    const options: CodeCommandOptions = {};
    const promptParts: string[] = [];

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      if (arg.startsWith('--')) {
        const option = arg as keyof CodeCommandOptions;
        
        // Boolean options
        if (['--dry-run', '--force', '--interactive', '--verbose', '--no-backup'].includes(arg)) {
          (options as any)[option] = true;
        } 
        // Value options
        else if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
          (options as any)[option] = args[i + 1];
          i++; // Skip next argument as it's the value
        }
      } else {
        promptParts.push(arg);
      }
    }

    return {
      prompt: promptParts.join(' '),
      options
    };
  }

  /**
   * Generates code using AI service
   */
  private async generateCode(
    prompt: string, 
    options: CodeCommandOptions
  ): Promise<{ success: boolean; code?: string; error?: string }> {
    try {
      // Build enhanced prompt with options
      let enhancedPrompt = prompt;
      
      if (options['--language']) {
        enhancedPrompt += `\n\nPlease use ${options['--language']} programming language.`;
      }
      
      if (options['--framework']) {
        enhancedPrompt += `\nUse the ${options['--framework']} framework.`;
      }
      
      if (options['--style']) {
        enhancedPrompt += `\nUse ${options['--style']} coding style.`;
      }

      // Call AI service
      const result = await executeCode({
        prompt: enhancedPrompt,
        model: options['--model'] || 'claude-3-5-sonnet-20241022',
        context: this.context
      });

      if (!result.success) {
        return { success: false, error: result.error };
      }

      return { success: true, code: result.code };

    } catch (error) {
      return { 
        success: false, 
        error: `AI generation failed: ${(error as Error).message}` 
      };
    }
  }

  /**
   * Builds project context for filename inference
   */
  private async buildProjectContext(options: CodeCommandOptions): Promise<ProjectContext> {
    const context: ProjectContext = {
      root: this.projectRoot,
      directory: options['--dir'] ? path.resolve(options['--dir']) : this.projectRoot,
      existingFiles: [],
      planId: this.context.user?.planId || 'FREE'
    };

    // Detect project type and framework
    try {
      const packageJsonPath = path.join(this.projectRoot, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        
        // Detect framework
        if (packageJson.dependencies?.react || packageJson.devDependencies?.react) {
          context.framework = 'react';
        } else if (packageJson.dependencies?.vue || packageJson.devDependencies?.vue) {
          context.framework = 'vue';
        } else if (packageJson.dependencies?.angular || packageJson.devDependencies?.angular) {
          context.framework = 'angular';
        }
        
        // Detect language
        if (packageJson.dependencies?.typescript || packageJson.devDependencies?.typescript) {
          context.language = 'typescript';
        } else {
          context.language = 'javascript';
        }
      }

      // Scan existing files for context
      if (context.directory && fs.existsSync(context.directory)) {
        const files = fs.readdirSync(context.directory);
        context.existingFiles = files.filter(f => 
          !f.startsWith('.') && 
          /\.(js|ts|jsx|tsx|py|java|go|rs)$/.test(f)
        ).slice(0, 20); // Limit for performance
      }

    } catch (error) {
      // Continue with minimal context if scanning fails
      console.warn('Failed to build full project context:', error);
    }

    return context;
  }

  /**
   * Gets plan configuration for the current user
   */
  private async getPlanConfiguration(): Promise<any> {
    try {
      const planId = this.context.user?.planId || 'FREE';
      return await getFirestorePlanConfig(planId);
    } catch (error) {
      console.warn('Failed to load plan config, using defaults:', error);
      // Return default FREE plan config
      return {
        fileSave: {
          allowExtensions: ['txt', 'md', 'html', 'css', 'js'],
          maxFileSizeMB: 0.1,
          defaultDir: '.'
        },
        naming: {
          convention: 'kebab-case'
        },
        dirs: {}
      };
    }
  }

  /**
   * Builds UX options from command options
   */
  private buildUXOptions(options: CodeCommandOptions): UXOptions {
    const uxOptions: UXOptions = {};

    // Save mode options
    uxOptions.saveMode = {
      dryRun: options['--dry-run'],
      force: options['--force'],
      interactive: options['--interactive']
    };

    // Selection options
    uxOptions.selection = {
      showConfidence: true,
      showReasoning: options['--verbose'],
      allowCustom: true,
      allowCancel: true
    };

    // Dry run options
    uxOptions.dryRun = {
      showConflicts: true,
      showPermissions: options['--verbose'],
      showPlanCompliance: true,
      verboseOutput: options['--verbose']
    };

    // General options
    uxOptions.verbose = options['--verbose'];
    uxOptions.skipBackup = options['--no-backup'];

    return uxOptions;
  }

  /**
   * Formats the final result for user display
   */
  private formatResult(
    result: any,
    startTime: number,
    options: CodeCommandOptions
  ): CommandResult {
    const duration = Date.now() - startTime;

    if (!result.success) {
      return {
        requiresInput: false,
        endReason: 'error',
        message: result.error || 'Unknown error occurred',
        error: result.error
      };
    }

    // Success response
    let message = '';
    
    if (result.mode === 'dry-run') {
      message = '🔍 Dry-run completed - no files created\n';
      if (result.suggested && result.suggested.length > 0) {
        message += `Suggested filename: ${result.suggested[0].filename}`;
      }
    } else {
      const filename = path.basename(result.path || 'unknown');
      message = `✅ Code saved as: ${filename}`;
      
      if (result.undoId) {
        message += '\n💾 Backup created - use /undo to revert';
      }

      if (result.selectionTime) {
        message += `\n⏱️  Selection time: ${result.selectionTime}ms`;
      }
    }

    // Add warnings if any
    if (result.warnings && result.warnings.length > 0) {
      message += '\n⚠️  Warnings:\n' + result.warnings.map((w: string) => `  • ${w}`).join('\n');
    }

    if (options['--verbose']) {
      message += `\n🕒 Total time: ${duration}ms`;
      message += `\n📊 Mode: ${result.mode}`;
    }

    return {
      requiresInput: false,
      endReason: 'success',
      message,
      data: {
        path: result.path,
        mode: result.mode,
        undoId: result.undoId,
        duration
      }
    };
  }

  /**
   * Handles undo functionality
   */
  async handleUndo(): Promise<CommandResult> {
    const result = await this.uxOrchestrator.undo();
    
    return {
      requiresInput: false,
      endReason: result.success ? 'success' : 'error',
      message: result.success ? 
        '✅ Last operation undone successfully' : 
        `❌ Undo failed: ${result.error}`,
      error: result.error
    };
  }

  /**
   * Shows undo history
   */
  showUndoHistory(): CommandResult {
    this.uxOrchestrator.showUndoHistory();
    
    return {
      requiresInput: false,
      endReason: 'success',
      message: 'Undo history displayed above'
    };
  }

  /**
   * Shows help for the integrated command
   */
  showHelp(): string {
    return `
🤖 /code - Intelligent Code Generation with Smart Filenames

USAGE:
  /code <request> [options]

FILENAME OPTIONS:
  --file <name>      Explicit filename (e.g., --file UserCard.tsx)
  --dir <path>       Target directory (e.g., --dir src/components)
  --dry-run          Preview only, don't create files
  --force            Force save even with low confidence
  --interactive      Always show filename selection UI
  --no-backup        Skip creating undo backup

CODE OPTIONS:
  --language <lang>  Target language (js, ts, py, go, etc.)
  --framework <fw>   Framework (react, vue, express, etc.)
  --style <style>    Code style (functional, class, modern)
  --model <model>    AI model to use

SYSTEM OPTIONS:
  --verbose          Show detailed progress and decisions
  
EXAMPLES:
  /code create a user card component
  /code build an API endpoint for user registration --language typescript
  /code --dry-run create a login form --framework react
  /code generate utility functions --file utils.ts --force
  /code create auth middleware --dir src/middleware --verbose

CONFIDENCE MODES:
  High (90%+):    Auto-save immediately
  Medium (70%+):  Interactive selection UI  
  Low (<70%):     Dry-run preview only

UNDO OPERATIONS:
  /undo              Undo last file operation
  /undo history      Show recent operations
`;
  }
}

/**
 * Export default command instance
 */
export default IntegratedCodeCommand;