/**
 * Enhanced Error Handler
 * Provides comprehensive error handling with recovery suggestions
 */

import { 
  SecurityError, 
  PlanViolationError, 
  PermissionError, 
  UserCancelledError,
  SaveResult,
  FilenameCandidate
} from './types/filename-inference.types';
import * as path from 'node:path';
import * as fs from 'node:fs';

export interface ErrorContext {
  operation: string;
  prompt?: string;
  candidates?: FilenameCandidate[];
  planId: string;
  projectRoot: string;
}

export interface ErrorResponse {
  success: false;
  error: string;
  errorType: string;
  recoveryOptions: RecoveryOption[];
  suggestions: string[];
  nextSteps: string[];
}

export interface RecoveryOption {
  action: string;
  command: string;
  description: string;
}

export class ErrorHandler {
  private readonly colors = {
    red: (text: string) => `\x1b[31m${text}\x1b[0m`,
    yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
    cyan: (text: string) => `\x1b[36m${text}\x1b[0m`,
    gray: (text: string) => `\x1b[90m${text}\x1b[0m`,
    bold: (text: string) => `\x1b[1m${text}\x1b[0m`
  };

  /**
   * Handles various error types and provides recovery options
   */
  async handleError(error: Error, context: ErrorContext): Promise<ErrorResponse> {
    console.error(`${this.colors.red('❌ Error:')} ${error.message}`);
    
    if (error instanceof SecurityError) {
      return this.handleSecurityError(error, context);
    }
    
    if (error instanceof PlanViolationError) {
      return this.handlePlanViolationError(error, context);
    }
    
    if (error instanceof PermissionError) {
      return this.handlePermissionError(error, context);
    }
    
    if (error instanceof UserCancelledError) {
      return this.handleUserCancelledError(error, context);
    }
    
    // Handle Node.js errors
    if ((error as any).code) {
      return this.handleSystemError(error, context);
    }
    
    // Generic error handling
    return this.handleGenericError(error, context);
  }

  /**
   * Handles security-related errors
   */
  private handleSecurityError(error: SecurityError, context: ErrorContext): ErrorResponse {
    const recoveryOptions: RecoveryOption[] = [];
    const suggestions: string[] = [];

    if (error.message.includes('Path traversal')) {
      suggestions.push('Use relative paths within the project directory');
      suggestions.push('Avoid using .. in file paths');
      recoveryOptions.push({
        action: 'Use safe path',
        command: '/code --name=safe-filename.js your request',
        description: 'Specify a safe filename explicitly'
      });
    }

    if (error.message.includes('Reserved filename')) {
      suggestions.push('Choose a different filename');
      suggestions.push('Avoid system reserved names (CON, PRN, AUX, etc.)');
      recoveryOptions.push({
        action: 'Use different name',
        command: '/code --interactive your request',
        description: 'Choose from alternative filenames'
      });
    }

    return {
      success: false,
      error: error.message,
      errorType: 'SecurityError',
      recoveryOptions,
      suggestions,
      nextSteps: [
        'Review the filename for security issues',
        'Use --name flag to specify a safe filename',
        'Run with --dry-run to preview safe options'
      ]
    };
  }

  /**
   * Handles plan violation errors
   */
  private handlePlanViolationError(error: PlanViolationError, context: ErrorContext): ErrorResponse {
    const recoveryOptions: RecoveryOption[] = [];
    const suggestions: string[] = [];

    if (error.message.includes('not allowed')) {
      suggestions.push(`Upgrade to a higher plan for more file types`);
      suggestions.push('Use an allowed file extension');
      
      // Get allowed extensions for the plan
      recoveryOptions.push({
        action: 'View allowed extensions',
        command: '/plan info',
        description: 'See what file types are allowed in your plan'
      });
      
      recoveryOptions.push({
        action: 'Try different extension',
        command: '/code --dry-run your request',
        description: 'Preview alternative file extensions'
      });
    }

    if (error.message.includes('exceeds') && error.message.includes('limit')) {
      suggestions.push('Reduce file size or split into multiple files');
      suggestions.push('Upgrade to a plan with higher file size limits');
      
      recoveryOptions.push({
        action: 'Split into smaller files',
        command: '/code --interactive your request',
        description: 'Generate smaller, more focused files'
      });
    }

    return {
      success: false,
      error: error.message,
      errorType: 'PlanViolationError',
      recoveryOptions,
      suggestions,
      nextSteps: [
        'Check your current plan limits',
        'Consider upgrading your plan',
        'Modify request to fit plan constraints'
      ]
    };
  }

  /**
   * Handles file system permission errors
   */
  private handlePermissionError(error: PermissionError, context: ErrorContext): ErrorResponse {
    const recoveryOptions: RecoveryOption[] = [];
    const suggestions: string[] = [];

    suggestions.push('Check directory permissions');
    suggestions.push('Ensure you have write access to the target directory');

    // Suggest alternative directories
    const alternativeDirs = this.suggestAlternativeDirectories(context.projectRoot);
    
    alternativeDirs.forEach(dir => {
      recoveryOptions.push({
        action: `Save to ${dir}`,
        command: `/code --dir=${dir} your request`,
        description: `Try saving to ${dir} directory instead`
      });
    });

    return {
      success: false,
      error: error.message,
      errorType: 'PermissionError',
      recoveryOptions,
      suggestions,
      nextSteps: [
        'Check directory permissions with: ls -la',
        'Try a different directory',
        'Run with sudo if appropriate (be careful!)'
      ]
    };
  }

  /**
   * Handles user cancellation
   */
  private handleUserCancelledError(error: UserCancelledError, context: ErrorContext): ErrorResponse {
    return {
      success: false,
      error: 'Operation cancelled by user',
      errorType: 'UserCancelledError',
      recoveryOptions: [
        {
          action: 'Try again',
          command: `/code ${context.prompt}`,
          description: 'Run the same command again'
        },
        {
          action: 'Use dry-run first',
          command: `/code --dry-run ${context.prompt}`,
          description: 'Preview options before deciding'
        }
      ],
      suggestions: [
        'You can try the command again anytime',
        'Use --dry-run to preview results before committing'
      ],
      nextSteps: [
        'No action needed - operation was safely cancelled'
      ]
    };
  }

  /**
   * Handles system errors (EACCES, ENOENT, etc.)
   */
  private handleSystemError(error: any, context: ErrorContext): ErrorResponse {
    const recoveryOptions: RecoveryOption[] = [];
    const suggestions: string[] = [];

    switch (error.code) {
      case 'EACCES':
        suggestions.push('Permission denied - check directory permissions');
        suggestions.push('You may not have write access to this location');
        
        recoveryOptions.push({
          action: 'Try home directory',
          command: '/code --dir=~/ your request',
          description: 'Save to your home directory instead'
        });
        break;

      case 'ENOENT':
        suggestions.push('Directory does not exist');
        suggestions.push('Parent directory needs to be created first');
        
        recoveryOptions.push({
          action: 'Create in current directory',
          command: '/code --dir=. your request',
          description: 'Save in current working directory'
        });
        break;

      case 'ENOSPC':
        suggestions.push('No space left on device');
        suggestions.push('Free up disk space before retrying');
        break;

      case 'EMFILE':
        suggestions.push('Too many open files');
        suggestions.push('Close other applications and try again');
        break;

      default:
        suggestions.push(`System error: ${error.code}`);
    }

    return {
      success: false,
      error: error.message,
      errorType: 'SystemError',
      recoveryOptions,
      suggestions,
      nextSteps: [
        'Check system resources and permissions',
        'Try a different location',
        'Contact system administrator if needed'
      ]
    };
  }

  /**
   * Handles generic errors
   */
  private handleGenericError(error: Error, context: ErrorContext): ErrorResponse {
    const recoveryOptions: RecoveryOption[] = [
      {
        action: 'Try with dry-run',
        command: `/code --dry-run ${context.prompt}`,
        description: 'Preview what would happen without creating files'
      },
      {
        action: 'Use explicit filename',
        command: '/code --name=my-file.js your request',
        description: 'Specify filename explicitly to avoid inference issues'
      },
      {
        action: 'Try interactive mode',
        command: '/code --interactive your request',
        description: 'Get more control over the process'
      }
    ];

    return {
      success: false,
      error: error.message,
      errorType: 'GenericError',
      recoveryOptions,
      suggestions: [
        'Try running the command with different options',
        'Check if the request is clear and specific',
        'Use --verbose for more detailed error information'
      ],
      nextSteps: [
        'Review the error message carefully',
        'Try one of the recovery options',
        'Simplify your request if it\'s complex'
      ]
    };
  }

  /**
   * Suggests alternative directories when permissions fail
   */
  private suggestAlternativeDirectories(projectRoot: string): string[] {
    const alternatives: string[] = [];
    
    // Try common writable directories
    const candidates = [
      '.',
      'tmp',
      'temp',
      path.join(projectRoot, 'src'),
      path.join(projectRoot, 'output'),
      process.env.HOME && path.join(process.env.HOME, 'Documents'),
      process.env.TMPDIR || '/tmp'
    ].filter(Boolean) as string[];

    for (const dir of candidates) {
      try {
        if (fs.existsSync(dir)) {
          // Test write access
          const testFile = path.join(dir, '.maria-write-test');
          fs.writeFileSync(testFile, '');
          fs.unlinkSync(testFile);
          alternatives.push(dir);
        }
      } catch {
        // Directory not writable, skip
      }
    }

    return alternatives.slice(0, 3); // Return top 3 alternatives
  }

  /**
   * Displays error information in a user-friendly format
   */
  displayError(errorResponse: ErrorResponse): void {
    console.log('\n' + this.colors.red(this.colors.bold('❌ Operation Failed')));
    console.log(this.colors.gray('─'.repeat(50)));
    
    console.log(`${this.colors.bold('Error:')} ${errorResponse.error}`);
    console.log(`${this.colors.bold('Type:')} ${errorResponse.errorType}`);

    if (errorResponse.suggestions.length > 0) {
      console.log(`\n${this.colors.bold('💡 Suggestions:')}`);
      errorResponse.suggestions.forEach(suggestion => {
        console.log(`   • ${suggestion}`);
      });
    }

    if (errorResponse.recoveryOptions.length > 0) {
      console.log(`\n${this.colors.bold('🔧 Recovery Options:')}`);
      errorResponse.recoveryOptions.forEach((option, index) => {
        console.log(`   ${index + 1}. ${this.colors.cyan(option.action)}`);
        console.log(`      ${this.colors.gray(option.description)}`);
        console.log(`      ${this.colors.yellow(option.command)}`);
      });
    }

    if (errorResponse.nextSteps.length > 0) {
      console.log(`\n${this.colors.bold('📋 Next Steps:')}`);
      errorResponse.nextSteps.forEach((step, index) => {
        console.log(`   ${index + 1}. ${step}`);
      });
    }

    console.log(this.colors.gray('─'.repeat(50)));
  }

  /**
   * Creates a minimal error response for API/programmatic use
   */
  createMinimalError(error: Error, context: ErrorContext): SaveResult {
    return {
      success: false,
      error: error.message,
      suggested: context.candidates || []
    };
  }

  /**
   * Logs error details for debugging
   */
  logErrorDetails(error: Error, context: ErrorContext): void {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      error: {
        message: error.message,
        type: error.constructor.name,
        stack: error.stack
      },
      context: {
        operation: context.operation,
        prompt: context.prompt,
        planId: context.planId,
        candidateCount: context.candidates?.length || 0
      }
    };

    // In a real implementation, this would go to a logging service
    if (process.env.NODE_ENV === 'development') {
      console.debug('Error details:', JSON.stringify(logEntry, null, 2));
    }
  }
}