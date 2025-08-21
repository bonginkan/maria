/**
 * Elevation Prompt - Interactive Security Validation System
 * Provides secure prompts for sudo/elevation operations with validation
 * Phase 2: Terminal Integration & Safety - Week 6
 */

import * as readline from 'readline';
import chalk from 'chalk';
import { permissionManager, ElevationRequest, PermissionInfo } from './PermissionManager';
import { terminalManager } from '../terminal-integration/TerminalManager';

export interface PromptOptions {
  timeout?: number;
  allowCancel?: boolean;
  showAlternatives?: boolean;
  requireReason?: boolean;
}

export interface PromptResult {
  approved: boolean;
  reason?: string;
  alternative?: string;
  rememberChoice?: boolean;
}

export interface SecurityContext {
  operation: string;
  path: string;
  permissions: PermissionInfo;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  alternatives: string[];
}

export class ElevationPrompt {
  private static instance: ElevationPrompt;
  private rl: readline.Interface | null = null;
  private rememberedChoices: Map<string, boolean> = new Map();

  public static getInstance(): ElevationPrompt {
    if (!ElevationPrompt.instance) {
      ElevationPrompt.instance = new ElevationPrompt();
    }
    return ElevationPrompt.instance;
  }

  private constructor() {
    this.initializeReadline();
  }

  /**
   * Show elevation prompt with security validation
   */
  async promptForElevation(
    request: ElevationRequest,
    options: PromptOptions = {},
  ): Promise<PromptResult> {
    // Check if we've already made a decision for this type of operation
    const cacheKey = `${request.operation}:${request.path}`;
    if (this.rememberedChoices.has(cacheKey)) {
      const remembered = this.rememberedChoices.get(cacheKey)!;
      console.log(chalk.gray(`Using remembered choice: ${remembered ? 'APPROVED' : 'DENIED'}`));
      return { approved: remembered };
    }

    // Build security context
    const context = await this.buildSecurityContext(request);

    // Show security assessment
    this.displaySecurityAssessment(context);

    // Show the main prompt
    const result = await this.showInteractivePrompt(request, context, options);

    // Remember choice if requested
    if (result.rememberChoice) {
      this.rememberedChoices.set(cacheKey, result.approved);
    }

    return result;
  }

  /**
   * Show operation confirmation dialog
   */
  async confirmOperation(
    operation: string,
    paths: string[],
    options: PromptOptions = {},
  ): Promise<boolean> {
    console.log(chalk.yellow('\n⚠️  Operation Confirmation Required'));
    console.log(`Operation: ${chalk.cyan(operation)}`);
    console.log(`Targets: ${paths.length} item(s)`);

    if (paths.length <= 5) {
      paths.forEach((p) => console.log(`  • ${chalk.gray(p)}`));
    } else {
      paths.slice(0, 3).forEach((p) => console.log(`  • ${chalk.gray(p)}`));
      console.log(`  • ${chalk.gray(`... and ${paths.length - 3} more`)}`);
    }

    const dangerous = this.assessOperationDanger(operation, paths);
    if (dangerous.isDangerous) {
      console.log(chalk.red(`\n🚨 Warning: ${dangerous.reason}`));
      if (dangerous.recommendation) {
        console.log(chalk.yellow(`💡 Recommendation: ${dangerous.recommendation}`));
      }
    }

    return await this.askYesNo('\nProceed with this operation?', false, options.timeout);
  }

  /**
   * Prompt for operation reason
   */
  async promptForReason(operation: string, path: string): Promise<string | null> {
    console.log(chalk.blue('\n📝 Reason Required'));
    console.log(`Please provide a reason for ${chalk.cyan(operation)} on ${chalk.yellow(path)}:`);

    if (!this.rl) {
      this.initializeReadline();
    }

    return new Promise((resolve) => {
      this.rl!.question('Reason: ', (answer) => {
        const reason = answer.trim();
        if (reason.length < 5) {
          console.log(chalk.red('Reason too short. Please provide a meaningful explanation.'));
          resolve(null);
        } else {
          resolve(reason);
        }
      });
    });
  }

  /**
   * Clear remembered choices
   */
  clearRememberedChoices(): void {
    this.rememberedChoices.clear();
    console.log(chalk.green('✅ Cleared all remembered security choices'));
  }

  /**
   * Show current security context
   */
  showSecurityStatus(): void {
    console.log(chalk.blue('\n🔒 Security Status'));
    console.log(`Platform: ${process.platform}`);
    console.log(`User: ${process.env.USER || process.env.USERNAME || 'unknown'}`);
    console.log(`Remembered choices: ${this.rememberedChoices.size}`);

    permissionManager.hasSudoAccess().then((hasSudo) => {
      console.log(`Elevation available: ${hasSudo ? chalk.green('Yes') : chalk.red('No')}`);
    });
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }
  }

  /**
   * Build security context for the request
   */
  private async buildSecurityContext(request: ElevationRequest): Promise<SecurityContext> {
    const permissions = await permissionManager.checkPermissions(request.path, request.operation);
    const validation = permissionManager.validateOperation(request.operation, request.path);

    // Assess risk level
    let riskLevel: SecurityContext['riskLevel'] = 'low';

    if (validation.needsElevation) {
      riskLevel = 'high';
    }

    if (request.operation === 'delete' || request.operation === 'rm') {
      riskLevel = 'high';
    }

    if (
      request.path.includes('/System') ||
      request.path.includes('/etc') ||
      request.path.includes('C:\\Windows')
    ) {
      riskLevel = 'critical';
    }

    // Generate alternatives
    const alternatives = this.generateAlternatives(request);

    return {
      operation: request.operation,
      path: request.path,
      permissions,
      riskLevel,
      alternatives,
    };
  }

  /**
   * Display security assessment
   */
  private displaySecurityAssessment(context: SecurityContext): void {
    console.log(chalk.blue('\n🔍 Security Assessment'));

    // Risk level indicator
    const riskColors = {
      low: chalk.green,
      medium: chalk.yellow,
      high: chalk.red,
      critical: chalk.bgRed.white,
    };

    const riskColor = riskColors[context.riskLevel];
    console.log(`Risk Level: ${riskColor(context.riskLevel.toUpperCase())}`);

    // Permission info
    console.log(
      `Current Permissions: ${context.permissions.mode} (${context.permissions.owner}:${context.permissions.group})`,
    );
    console.log(
      `Access: R:${context.permissions.readable ? '✓' : '✗'} W:${context.permissions.writable ? '✓' : '✗'} X:${context.permissions.executable ? '✓' : '✗'}`,
    );

    // Show alternatives if available
    if (context.alternatives.length > 0) {
      console.log(chalk.green('\n💡 Safer Alternatives:'));
      context.alternatives.forEach((alt, index) => {
        console.log(`  ${index + 1}. ${alt}`);
      });
    }

    // Show warnings based on risk level
    switch (context.riskLevel) {
      case 'critical':
        console.log(
          chalk.bgRed.white(
            '\n🚨 CRITICAL: This operation affects system files and may damage your system!',
          ),
        );
        break;
      case 'high':
        console.log(
          chalk.red('\n⚠️  HIGH RISK: This operation may cause data loss or security issues'),
        );
        break;
      case 'medium':
        console.log(chalk.yellow('\n⚠️  MEDIUM RISK: Please proceed with caution'));
        break;
    }
  }

  /**
   * Show interactive prompt
   */
  private async showInteractivePrompt(
    request: ElevationRequest,
    context: SecurityContext,
    options: PromptOptions,
  ): Promise<PromptResult> {
    console.log(chalk.blue('\n🔐 Elevation Request'));
    console.log(`Operation: ${chalk.cyan(request.operation)}`);
    console.log(`Target: ${chalk.yellow(request.path)}`);
    console.log(`Reason: ${request.reason}`);

    if (!this.rl) {
      this.initializeReadline();
    }

    // For critical operations, require explicit typing
    if (context.riskLevel === 'critical') {
      return await this.handleCriticalPrompt(request, context);
    }

    // Standard prompt with options
    console.log(chalk.gray('\nOptions:'));
    console.log(chalk.gray('  y/yes    - Approve this operation'));
    console.log(chalk.gray('  n/no     - Deny this operation'));
    if (context.alternatives.length > 0) {
      console.log(chalk.gray('  a/alt    - Choose alternative'));
    }
    if (options.allowCancel !== false) {
      console.log(chalk.gray('  c/cancel - Cancel operation'));
    }
    console.log(chalk.gray('  r/reason - Provide additional reason'));
    console.log(chalk.gray('  s/status - Show security status'));

    return new Promise((resolve) => {
      const askPrompt = () => {
        this.rl!.question(chalk.blue('\nDecision [y/n/a/c/r/s]: '), async (answer) => {
          const choice = answer.toLowerCase().trim();

          switch (choice) {
            case 'y':
            case 'yes':
              resolve({ approved: true });
              break;

            case 'n':
            case 'no':
              resolve({ approved: false });
              break;

            case 'a':
            case 'alt':
              if (context.alternatives.length > 0) {
                const alternative = await this.selectAlternative(context.alternatives);
                resolve({ approved: false, alternative });
              } else {
                console.log(chalk.yellow('No alternatives available'));
                askPrompt();
              }
              break;

            case 'c':
            case 'cancel':
              if (options.allowCancel !== false) {
                resolve({ approved: false });
              } else {
                console.log(chalk.yellow('Cancel not allowed for this operation'));
                askPrompt();
              }
              break;

            case 'r':
            case 'reason':
              const reason = await this.promptForReason(request.operation, request.path);
              if (reason) {
                console.log(chalk.green(`Additional reason recorded: ${reason}`));
              }
              askPrompt();
              break;

            case 's':
            case 'status':
              this.showSecurityStatus();
              askPrompt();
              break;

            default:
              console.log(chalk.red('Invalid choice. Please enter y, n, a, c, r, or s'));
              askPrompt();
          }
        });
      };

      askPrompt();

      // Set timeout if specified
      if (options.timeout) {
        setTimeout(() => {
          console.log(chalk.red('\n⏰ Prompt timed out - denying operation'));
          resolve({ approved: false });
        }, options.timeout);
      }
    });
  }

  /**
   * Handle critical operations that require explicit confirmation
   */
  private async handleCriticalPrompt(
    request: ElevationRequest,
    context: SecurityContext,
  ): Promise<PromptResult> {
    console.log(chalk.bgRed.white('\n🚨 CRITICAL OPERATION CONFIRMATION REQUIRED 🚨'));
    console.log(chalk.red('This operation may permanently damage your system or cause data loss.'));
    console.log(chalk.red('You must type the full path to confirm:'));
    console.log(chalk.yellow(`Required: ${request.path}`));

    return new Promise((resolve) => {
      this.rl!.question(chalk.red('\nType the full path to confirm: '), (answer) => {
        if (answer.trim() === request.path) {
          console.log(chalk.yellow('Path confirmed. Proceeding with extreme caution...'));
          resolve({ approved: true });
        } else {
          console.log(chalk.red('❌ Path mismatch. Operation denied for safety.'));
          resolve({ approved: false });
        }
      });
    });
  }

  /**
   * Select from alternative options
   */
  private async selectAlternative(alternatives: string[]): Promise<string | undefined> {
    console.log(chalk.green('\n💡 Select an alternative:'));
    alternatives.forEach((alt, index) => {
      console.log(`  ${index + 1}. ${alt}`);
    });

    return new Promise((resolve) => {
      this.rl!.question('Choose alternative (number): ', (answer) => {
        const choice = parseInt(answer.trim());
        if (choice >= 1 && choice <= alternatives.length) {
          resolve(alternatives[choice - 1]);
        } else {
          console.log(chalk.red('Invalid choice'));
          resolve(undefined);
        }
      });
    });
  }

  /**
   * Generate alternative suggestions
   */
  private generateAlternatives(request: ElevationRequest): string[] {
    const alternatives: string[] = [];

    switch (request.operation) {
      case 'delete':
      case 'rm':
        alternatives.push('Move to trash/recycle bin instead');
        alternatives.push('Create backup before deletion');
        alternatives.push('Use safer rm with confirmation prompts');
        break;

      case 'write':
        alternatives.push('Write to user directory instead');
        alternatives.push('Create backup of existing file first');
        alternatives.push('Use temporary file and atomic move');
        break;

      case 'chmod':
      case 'chown':
        alternatives.push('Check if current permissions are sufficient');
        alternatives.push('Use more restrictive permissions');
        alternatives.push('Apply changes to copy in user directory');
        break;
    }

    if (request.alternative) {
      alternatives.unshift(request.alternative);
    }

    return alternatives;
  }

  /**
   * Assess danger level of operation
   */
  private assessOperationDanger(
    operation: string,
    paths: string[],
  ): {
    isDangerous: boolean;
    reason?: string;
    recommendation?: string;
  } {
    // Check for dangerous patterns
    const systemPaths = paths.filter(
      (p) =>
        p.includes('/System') ||
        p.includes('/etc') ||
        p.includes('C:\\Windows') ||
        p.includes('/usr/bin'),
    );

    if (systemPaths.length > 0) {
      return {
        isDangerous: true,
        reason: 'Operation targets system files',
        recommendation: 'Consider if this operation is really necessary',
      };
    }

    const homeFiles = paths.filter((p) => p.includes('.ssh') || p.includes('.gnupg'));
    if (homeFiles.length > 0 && operation === 'delete') {
      return {
        isDangerous: true,
        reason: 'Operation targets security-sensitive files',
        recommendation: 'Create backup before proceeding',
      };
    }

    if (operation === 'delete' && paths.length > 100) {
      return {
        isDangerous: true,
        reason: 'Mass deletion operation',
        recommendation: 'Consider doing this in smaller batches',
      };
    }

    return { isDangerous: false };
  }

  /**
   * Simple yes/no question
   */
  private async askYesNo(
    question: string,
    defaultValue: boolean = false,
    timeout?: number,
  ): Promise<boolean> {
    if (!this.rl) {
      this.initializeReadline();
    }

    return new Promise((resolve) => {
      const defaultText = defaultValue ? '[Y/n]' : '[y/N]';

      this.rl!.question(`${question} ${defaultText}: `, (answer) => {
        const choice = answer.toLowerCase().trim();

        if (choice === '') {
          resolve(defaultValue);
        } else if (choice === 'y' || choice === 'yes') {
          resolve(true);
        } else if (choice === 'n' || choice === 'no') {
          resolve(false);
        } else {
          console.log(chalk.red('Please answer yes or no'));
          this.askYesNo(question, defaultValue, timeout).then(resolve);
        }
      });

      if (timeout) {
        setTimeout(() => {
          console.log(chalk.red('\n⏰ Question timed out'));
          resolve(defaultValue);
        }, timeout);
      }
    });
  }

  /**
   * Initialize readline interface
   */
  private initializeReadline(): void {
    if (this.rl) {
      return;
    }

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });

    // Handle cleanup on exit
    process.on('SIGINT', () => {
      this.dispose();
      process.exit(0);
    });
  }
}

export const elevationPrompt = ElevationPrompt.getInstance();
