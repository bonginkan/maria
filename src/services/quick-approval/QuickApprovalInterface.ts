/**
 * Quick Approval Interface
 * Handles keyboard shortcuts and quick approval workflows for Human-in-the-Loop system
 */

import { EventEmitter } from 'events';
import chalk from 'chalk';
import {
  ApprovalAction,
  ApprovalRequest,
  ApprovalResponse,
  TrustLevel,
} from '../approval-engine/types';
import { ApprovalEngine } from '../approval-engine/ApprovalEngine';

export interface QuickApprovalOptions {
  showJapanese?: boolean;
  showShortcuts?: boolean;
  autoTimeout?: number;
  defaultAction?: ApprovalAction;
}

export interface QuickApprovalChoice {
  key: string;
  action: ApprovalAction;
  label: string;
  labelJa: string;
  description: string;
  trustLevel?: TrustLevel;
}

export class QuickApprovalInterface extends EventEmitter {
  private static instance: QuickApprovalInterface;
  private approvalEngine: ApprovalEngine;
  private currentRequest: ApprovalRequest | null = null;
  private keyListeners: Map<string, () => void> = new Map();
  private isActive = false;

  // Quick approval choices with Japanese translations
  private readonly quickChoices: QuickApprovalChoice[] = [
    {
      key: 'shift+tab',
      action: 'approve',
      label: 'Quick Approve',
      labelJa: 'いいよ',
      description: 'Approve this action quickly',
    },
    {
      key: 'ctrl+y',
      action: 'approve',
      label: 'Yes, Approve',
      labelJa: 'はい、承認',
      description: 'Approve with confirmation',
    },
    {
      key: 'ctrl+n',
      action: 'reject',
      label: 'No, Reject',
      labelJa: 'いいえ、拒否',
      description: 'Reject this action',
    },
    {
      key: 'ctrl+t',
      action: 'trust',
      label: 'Trust & Auto-approve',
      labelJa: '任せる',
      description: 'Trust AI and auto-approve similar requests',
      trustLevel: TrustLevel.COLLABORATIVE,
    },
    {
      key: 'ctrl+r',
      action: 'review',
      label: 'Request Review',
      labelJa: 'レビュー要求',
      description: 'Request additional review',
    },
  ];

  private constructor() {
    super();
    this.approvalEngine = ApprovalEngine.getInstance();
    this.setupEventListeners();
  }

  static getInstance(): QuickApprovalInterface {
    if (!QuickApprovalInterface.instance) {
      QuickApprovalInterface.instance = new QuickApprovalInterface();
    }
    return QuickApprovalInterface.instance;
  }

  /**
   * Show approval request with quick options
   */
  async showApprovalRequest(
    request: ApprovalRequest,
    options: QuickApprovalOptions = {},
  ): Promise<ApprovalResponse> {
    this.currentRequest = request;
    this.isActive = true;

    try {
      // Display approval request
      this.displayApprovalRequest(request, options);

      // Setup keyboard listeners
      this.setupKeyboardListeners();

      // Wait for user response
      const response = await this.waitForUserResponse(options.autoTimeout);

      return response;
    } finally {
      this.cleanup();
    }
  }

  /**
   * Display approval request UI
   */
  private displayApprovalRequest(request: ApprovalRequest, options: QuickApprovalOptions): void {
    // Clear screen for better visibility
    console.clear();

    // Top border with attention-grabbing pattern
    console.log(`\n${  chalk.red(`┏${  '━'.repeat(78)  }┓`)}`);
    console.log(
      chalk.red('┃') +
        chalk.bgYellow.black.bold(`${' '.repeat(24)  }🤝 APPROVAL REQUEST${  ' '.repeat(24)}`) +
        chalk.red(' ┃'),
    );
    console.log(
      chalk.red('┃') +
        chalk.bgYellow.black.bold(
          `${' '.repeat(20)  }重要な決定が必要です (Important Decision)${  ' '.repeat(17)}`,
        ) +
        chalk.red(' ┃'),
    );
    console.log(chalk.red(`┗${  '━'.repeat(78)  }┛`));
    console.log('');

    // Main content box
    console.log(chalk.cyan(`┌${  '─'.repeat(78)  }┐`));
    console.log(
      chalk.cyan('│') + chalk.white(` 📋 Request Details:${  ' '.repeat(56)}`) + chalk.cyan('│'),
    );
    console.log(chalk.cyan(`├${  '─'.repeat(78)  }┤`));

    // Display request details with better formatting
    const themeDisplay = `Theme: ${chalk.bold.white(request.themeId)}`;
    console.log(
      `${chalk.cyan('│')  } ${themeDisplay}${' '.repeat(77 - themeDisplay.length)}${  chalk.cyan('│')}`,
    );

    const contextDisplay = `Context: ${chalk.white(request.context.description || 'No description')}`;
    const contextTrimmed =
      contextDisplay.length > 75 ? `${contextDisplay.substring(0, 72)  }...` : contextDisplay;
    console.log(
      `${chalk.cyan('│') 
        } ${contextTrimmed}${' '.repeat(77 - contextTrimmed.length)}${ 
        chalk.cyan('│')}`,
    );

    const riskDisplay = `Risk Level: ${this.formatRiskLevel(request.riskAssessment)}`;
    console.log(
      `${chalk.cyan('│')  } ${riskDisplay}${' '.repeat(77 - riskDisplay.length)}${  chalk.cyan('│')}`,
    );

    const timeDisplay = `Estimated Time: ${chalk.white(request.estimatedTime)}`;
    console.log(
      `${chalk.cyan('│')  } ${timeDisplay}${' '.repeat(77 - timeDisplay.length)}${  chalk.cyan('│')}`,
    );

    if (request.rationale) {
      console.log(chalk.cyan(`├${  '─'.repeat(78)  }┤`));
      const rationaleLines = request.rationale.match(/.{1,75}/g) || [request.rationale];
      rationaleLines.forEach((line, index) => {
        const prefix = index === 0 ? 'Rationale: ' : '           ';
        const display = `${prefix}${chalk.white(line)}`;
        console.log(
          `${chalk.cyan('│')  } ${display}${' '.repeat(77 - display.length)}${  chalk.cyan('│')}`,
        );
      });
    }

    // Display proposed actions in a box
    if (request.proposedActions && request.proposedActions.length > 0) {
      console.log(chalk.cyan(`├${  '─'.repeat(78)  }┤`));
      console.log(
        chalk.cyan('│') + chalk.white(` 📝 Proposed Actions:${  ' '.repeat(56)}`) + chalk.cyan('│'),
      );
      request.proposedActions.forEach((action, index) => {
        const actionText = `  ${index + 1}. ${action.description || action.type}`;
        const trimmed = actionText.length > 76 ? `${actionText.substring(0, 73)  }...` : actionText;
        console.log(
          `${chalk.cyan('│') 
            } ${chalk.gray(trimmed)}${' '.repeat(77 - trimmed.length)}${ 
            chalk.cyan('│')}`,
        );
      });
    }

    // Display dependencies if any
    if (request.dependencies && request.dependencies.length > 0) {
      console.log(chalk.cyan(`├${  '─'.repeat(78)  }┤`));
      const depDisplay = `Dependencies: ${chalk.white(request.dependencies.join(', '))}`;
      const depTrimmed = depDisplay.length > 75 ? `${depDisplay.substring(0, 72)  }...` : depDisplay;
      console.log(
        `${chalk.cyan('│')  } ${depTrimmed}${' '.repeat(77 - depTrimmed.length)}${  chalk.cyan('│')}`,
      );
    }

    console.log(chalk.cyan(`└${  '─'.repeat(78)  }┘`));

    // Security warning box if applicable
    if (request.securityImpact) {
      console.log('');
      console.log(chalk.red(`┌${  '─'.repeat(78)  }┐`));
      console.log(
        chalk.red('│') +
          chalk.bgRed.white.bold(
            ` ⚠️  SECURITY IMPACT DETECTED - EXTRA CAUTION REQUIRED ⚠️ ${  ' '.repeat(19)}`,
          ) +
          chalk.red('│'),
      );
      console.log(chalk.red(`└${  '─'.repeat(78)  }┘`));
    }

    console.log('');

    // Quick choices box with emphasis
    console.log(chalk.magenta(`┌${  '─'.repeat(78)  }┐`));
    console.log(
      chalk.magenta('│') +
        chalk.bgMagenta.white.bold(
          ` ⚡ Quick Approval Options (キーボードショートカット):${  ' '.repeat(27)}`,
        ) +
        chalk.magenta('│'),
    );
    console.log(chalk.magenta(`├${  '─'.repeat(78)  }┤`));

    // Display quick choices with enhanced formatting
    this.quickChoices.forEach((choice) => {
      const label = options.showJapanese ? choice.labelJa : choice.label;
      const keyDisplay = this.formatKeyBinding(choice.key);
      const trustInfo = choice.trustLevel ? chalk.gray(` (${choice.trustLevel})`) : '';

      const choiceText = `${keyDisplay} ${chalk.bold.white(label)}${trustInfo} - ${chalk.gray(choice.description)}`;
      console.log(
        `${chalk.magenta('│') 
          } ${choiceText}${' '.repeat(77 - choiceText.length)}${ 
          chalk.magenta('│')}`,
      );
    });

    console.log(chalk.magenta(`└${  '─'.repeat(78)  }┘`));

    // Instructions with emphasis
    console.log('');
    console.log(chalk.bgBlue.white.bold(' 📌 Instructions: '));
    console.log(chalk.blue('• Press any of the above keys to make your choice'));
    console.log(chalk.blue('• Press ESC to cancel this approval request'));
    console.log(chalk.blue('• Your choice will be processed immediately'));
    console.log('');

    // Blinking prompt for attention (simulate with repeated characters)
    console.log(chalk.yellow.bold('>>> Waiting for your input... <<<'));
  }

  /**
   * Format key binding for display
   */
  private formatKeyBinding(key: string): string {
    const keyMap: Record<string, string> = {
      'shift+tab': '⇧ Tab',
      'ctrl+y': '⌃ Y',
      'ctrl+n': '⌃ N',
      'ctrl+t': '⌃ T',
      'ctrl+r': '⌃ R',
    };

    const formatted = keyMap[key] || key;

    // Make keyboard shortcuts more prominent with colored backgrounds
    const colorMap: Record<string, any> = {
      'shift+tab': chalk.bgGreen.black.bold,
      'ctrl+y': chalk.bgBlue.white.bold,
      'ctrl+n': chalk.bgRed.white.bold,
      'ctrl+t': chalk.bgMagenta.white.bold,
      'ctrl+r': chalk.bgYellow.black.bold,
    };

    const colorFunc = colorMap[key] || chalk.bgCyan.black.bold;
    return colorFunc(` ${formatted} `);
  }

  /**
   * Format risk level with colors
   */
  private formatRiskLevel(risk: string): string {
    switch (risk.toLowerCase()) {
      case 'critical':
        return chalk.red.bold('CRITICAL');
      case 'high':
        return chalk.red('HIGH');
      case 'medium':
        return chalk.yellow('MEDIUM');
      case 'low':
        return chalk.green('LOW');
      default:
        return chalk.white(risk);
    }
  }

  /**
   * Setup keyboard listeners
   */
  private setupKeyboardListeners(): void {
    if (typeof process !== 'undefined' && process.stdin) {
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding('utf8');

      // Create listener function
      const keyListener = (key: string) => {
        this.handleKeyPress(key);
      };

      process.stdin.on('data', keyListener);
      this.keyListeners.set('stdin', () => {
        process.stdin.off('data', keyListener);
        if (process.stdin.setRawMode) {
          process.stdin.setRawMode(false);
        }
      });
    }
  }

  /**
   * Handle key press events
   */
  private handleKeyPress(key: string): void {
    if (!this.isActive || !this.currentRequest) {return;}

    // Handle escape key
    if (key === '\u001b') {
      // ESC key
      this.emit('approval-cancelled', this.currentRequest.id);
      return;
    }

    // Handle Ctrl+C
    if (key === '\u0003') {
      // Ctrl+C
      console.log(`\n${  chalk.red('Approval cancelled by user')}`);
      this.emit('approval-cancelled', this.currentRequest.id);
      return;
    }

    // Detect special key combinations
    let keyCombo = '';

    // Shift+Tab detection (key code 25 in raw mode)
    if (key.charCodeAt(0) === 25) {
      keyCombo = 'shift+tab';
    }
    // Ctrl key combinations
    else if (key.charCodeAt(0) <= 26) {
      const ctrlChar = String.fromCharCode(key.charCodeAt(0) + 96);
      keyCombo = `ctrl+${ctrlChar}`;
    }

    // Find matching choice
    const choice = this.quickChoices.find((c) => c.key === keyCombo);
    if (choice) {
      this.handleQuickChoice(choice);
    }
  }

  /**
   * Handle quick choice selection
   */
  private async handleQuickChoice(choice: QuickApprovalChoice): Promise<void> {
    if (!this.currentRequest) {return;}

    // Clear the waiting prompt and show selection
    console.clear();

    // Show dramatic selection confirmation
    console.log(`\n${  chalk.bgGreen.black.bold(`┌${  '─'.repeat(78)  }┐`)}`);
    console.log(
      chalk.bgGreen.black.bold('│') +
        chalk.bgGreen.black.bold(` ✓ CHOICE SELECTED / 選択完了:${  ' '.repeat(47)}`) +
        chalk.bgGreen.black.bold('│'),
    );
    console.log(chalk.bgGreen.black.bold(`├${  '─'.repeat(78)  }┤`));
    const choiceText = `${choice.label} (${choice.labelJa})`;
    const padding = ' '.repeat(Math.max(0, 76 - choiceText.length));
    console.log(
      chalk.bgGreen.black.bold('│') +
        chalk.bgGreen.black.bold(` ${choiceText}${padding}`) +
        chalk.bgGreen.black.bold('│'),
    );
    console.log(chalk.bgGreen.black.bold(`└${  '─'.repeat(78)  }┘`));

    console.log(chalk.yellow('\n🔄 Processing your approval decision...'));

    try {
      // Process approval response
      const response = await this.approvalEngine.processApprovalResponse(
        this.currentRequest.id,
        choice.action,
        `Quick approval: ${choice.label}`,
        choice.trustLevel,
      );

      // Mark as quick decision
      response.quickDecision = true;

      // Show success message with box
      console.log(`\n${  chalk.bgGreen.black(`┌${  '─'.repeat(78)  }┐`)}`);
      console.log(
        chalk.bgGreen.black('│') +
          chalk.bgGreen.black(
            ` 🎉 APPROVAL PROCESSED SUCCESSFULLY / 承認処理完了!${  ' '.repeat(32)}`,
          ) +
          chalk.bgGreen.black('│'),
      );
      console.log(chalk.bgGreen.black(`└${  '─'.repeat(78)  }┘`));

      if (choice.trustLevel) {
        console.log(chalk.blue(`\n✨ Trust level updated: ${choice.trustLevel}`));
      }

      this.emit('approval-response', response);
    } catch (error) {
      // Show error message with dramatic box
      console.log(`\n${  chalk.bgRed.white.bold(`┌${  '─'.repeat(78)  }┐`)}`);
      console.log(
        chalk.bgRed.white.bold('│') +
          chalk.bgRed.white.bold(
            ` ❌ ERROR PROCESSING APPROVAL / 承認処理エラー${  ' '.repeat(35)}`,
          ) +
          chalk.bgRed.white.bold('│'),
      );
      console.log(chalk.bgRed.white.bold(`└${  '─'.repeat(78)  }┘`));
      console.error(chalk.red('\nError details:'), error);
      this.emit('approval-error', error);
    }
  }

  /**
   * Wait for user response with optional timeout
   */
  private waitForUserResponse(timeout?: number): Promise<ApprovalResponse> {
    return new Promise((resolve, reject) => {
      let timeoutId: NodeJS.Timeout | null = null;

      // Setup timeout if specified
      if (timeout && timeout > 0) {
        timeoutId = setTimeout(() => {
          console.log(`\n${  chalk.yellow('⏰ Approval request timed out - auto-approving...')}`);
          this.handleTimeoutResponse(resolve);
        }, timeout);
      }

      // Listen for approval response
      const responseHandler = (response: ApprovalResponse) => {
        if (timeoutId) {clearTimeout(timeoutId);}
        resolve(response);
      };

      const errorHandler = (error: Error) => {
        if (timeoutId) {clearTimeout(timeoutId);}
        reject(error);
      };

      const cancelHandler = () => {
        if (timeoutId) {clearTimeout(timeoutId);}
        reject(new Error('Approval cancelled by user'));
      };

      this.once('approval-response', responseHandler);
      this.once('approval-error', errorHandler);
      this.once('approval-cancelled', cancelHandler);
    });
  }

  /**
   * Handle timeout response
   */
  private async handleTimeoutResponse(resolve: (value: ApprovalResponse) => void): Promise<void> {
    if (!this.currentRequest) {return;}

    try {
      const response = await this.approvalEngine.processApprovalResponse(
        this.currentRequest.id,
        'approve',
        'Auto-approved due to timeout',
      );

      response.quickDecision = true;
      resolve(response);
    } catch (error) {
      console.error(chalk.red('Error processing timeout approval:'), error);
    }
  }

  /**
   * Setup event listeners for the approval engine
   */
  private setupEventListeners(): void {
    this.approvalEngine.on('approval-requested', (request: ApprovalRequest) => {
      this.emit('approval-requested', request);
    });

    this.approvalEngine.on('trust-level-changed', (event) => {
      console.log(chalk.blue(`✨ Trust level changed: ${event.oldLevel} → ${event.newLevel}`));
      console.log(chalk.gray(`Reason: ${event.reason}`));
    });
  }

  /**
   * Get available quick choices
   */
  getQuickChoices(): QuickApprovalChoice[] {
    return [...this.quickChoices];
  }

  /**
   * Check if interface is currently active
   */
  isCurrentlyActive(): boolean {
    return this.isActive;
  }

  /**
   * Get current approval request
   */
  getCurrentRequest(): ApprovalRequest | null {
    return this.currentRequest;
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    this.isActive = false;
    this.currentRequest = null;

    // Remove all key listeners
    this.keyListeners.forEach((cleanup) => cleanup());
    this.keyListeners.clear();

    // Remove all event listeners
    this.removeAllListeners('approval-response');
    this.removeAllListeners('approval-error');
    this.removeAllListeners('approval-cancelled');
  }

  /**
   * Shutdown the interface
   */
  shutdown(): void {
    this.cleanup();
    this.removeAllListeners();
  }
}
