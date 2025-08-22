/**
 * Interrupt Handler Service
 * リアルタイム入力監視と処理中断メカニズム
 * Phase 2: Interrupt & Real-time Processing
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

export interface InterruptContext {
  previousRequest: string;
  newRequest: string;
  isAdditional: boolean;
  priority: 'override' | 'merge' | 'queue';
  timestamp: Date;
}

export interface ProcessingState {
  isProcessing: boolean;
  currentTask?: string;
  startTime?: Date;
  canInterrupt: boolean;
  processingTimeout?: NodeJS.Timeout;
}

export class InterruptHandler extends EventEmitter {
  private processingState: ProcessingState = {
    isProcessing: false,
    canInterrupt: true,
  };

  private interruptHistory: InterruptContext[] = [];
  private additionalKeywords = [
    'また',
    'さらに',
    'それから',
    '追加で',
    'あと',
    'also',
    'and',
    'additionally',
    'furthermore',
    'moreover',
    'plus',
    'besides',
    'as well',
    'too',
    'either',
  ];

  constructor() {
    super();
    this.setupSignalHandlers();
  }

  /**
   * Setup signal handlers for Ctrl+C
   */
  private setupSignalHandlers() {
    process.on('SIGINT', () => {
      if (this.processingState.isProcessing) {
        this.handleInterrupt('SIGINT');
      } else {
        this.handleExit();
      }
    });
  }

  /**
   * Start processing a task
   */
  startProcessing(task: string, timeout?: number): void {
    if (this.processingState.isProcessing) {
      logger.warn('Already processing a task, interrupting...');
      this.interruptProcessing();
    }

    this.processingState = {
      isProcessing: true,
      currentTask: task,
      startTime: new Date(),
      canInterrupt: true,
    };

    if (timeout) {
      this.processingState.processingTimeout = setTimeout(() => {
        this.completeProcessing();
      }, timeout);
    }

    this.emit('processing:started', {
      task,
      startTime: this.processingState.startTime,
    });

    logger.info(`Started processing: ${task}`);
  }

  /**
   * Complete current processing
   */
  completeProcessing(): void {
    if (!this.processingState.isProcessing) {
      return;
    }

    const task = this.processingState.currentTask;
    const duration = this.processingState.startTime
      ? Date.now() - this.processingState.startTime.getTime()
      : 0;

    if (this.processingState.processingTimeout) {
      clearTimeout(this.processingState.processingTimeout);
    }

    this.processingState = {
      isProcessing: false,
      canInterrupt: true,
    };

    this.emit('processing:completed', {
      task,
      duration,
    });

    logger.info(`Completed processing: ${task} (${duration}ms)`);
  }

  /**
   * Interrupt current processing
   */
  interruptProcessing(): boolean {
    if (!this.processingState.isProcessing) {
      return false;
    }

    if (!this.processingState.canInterrupt) {
      logger.warn('Current task cannot be interrupted');
      return false;
    }

    const task = this.processingState.currentTask;

    if (this.processingState.processingTimeout) {
      clearTimeout(this.processingState.processingTimeout);
    }

    this.processingState = {
      isProcessing: false,
      canInterrupt: true,
    };

    this.emit('processing:interrupted', {
      task,
      reason: 'user_interrupt',
    });

    logger.info(`Interrupted processing: ${task}`);
    return true;
  }

  /**
   * Handle new input during processing
   */
  handleNewInput(newInput: string, previousInput?: string): InterruptContext {
    const context: InterruptContext = {
      previousRequest: previousInput || '',
      newRequest: newInput,
      isAdditional: this.isAdditionalRequest(newInput),
      priority: this.determinePriority(newInput, previousInput),
      timestamp: new Date(),
    };

    this.interruptHistory.push(context);

    if (this.processingState.isProcessing) {
      this.emit('interrupt:received', context);

      if (context.priority === 'override') {
        this.interruptProcessing();
        this.emit('interrupt:override', context);
        logger.info('[Interrupted - Processing new request]');
        logger.info('[Overriding previous request]');
      } else if (context.priority === 'merge') {
        this.emit('interrupt:merge', context);
        logger.info('[Interrupted - Processing new request]');
        logger.info('[Treating as additional information]');
      } else {
        this.emit('interrupt:queue', context);
        logger.info('[Request queued for processing after current task]');
      }
    }

    return context;
  }

  /**
   * Determine if the new input is additional information
   */
  private isAdditionalRequest(input: string): boolean {
    const lowerInput = input.toLowerCase();
    return this.additionalKeywords.some((keyword) => lowerInput.includes(keyword));
  }

  /**
   * Determine priority of new request
   */
  private determinePriority(
    newInput: string,
    previousInput?: string,
  ): 'override' | 'merge' | 'queue' {
    // Check if it's additional information
    if (this.isAdditionalRequest(newInput)) {
      return 'merge';
    }

    // Check if it's a completely different topic
    if (previousInput && this.isDifferentTopic(newInput, previousInput)) {
      return 'override';
    }

    // Check if it's an urgent command
    if (this.isUrgentCommand(newInput)) {
      return 'override';
    }

    // Default to queue
    return 'queue';
  }

  /**
   * Check if the new input is about a different topic
   */
  private isDifferentTopic(newInput: string, previousInput: string): boolean {
    const newLower = newInput.toLowerCase();
    const prevLower = previousInput.toLowerCase();

    // Simple heuristic: check for common keywords
    const topics = [
      ['video', 'animation', '動画', 'アニメーション'],
      ['image', 'picture', '画像', '絵'],
      ['code', 'program', 'コード', 'プログラム'],
      ['test', 'テスト'],
      ['review', 'レビュー'],
      ['commit', 'コミット'],
    ];

    let newTopic = -1;
    let prevTopic = -1;

    for (let i = 0; i < topics.length; i++) {
      const topicKeywords = topics[i];
      if (topicKeywords && topicKeywords.some((keyword) => newLower.includes(keyword))) {
        newTopic = i;
      }
      if (topicKeywords && topicKeywords.some((keyword) => prevLower.includes(keyword))) {
        prevTopic = i;
      }
    }

    return newTopic !== -1 && prevTopic !== -1 && newTopic !== prevTopic;
  }

  /**
   * Check if the command is urgent
   */
  private isUrgentCommand(input: string): boolean {
    const urgentKeywords = [
      'stop',
      'cancel',
      'abort',
      '停止',
      'キャンセル',
      '中止',
      'urgent',
      'emergency',
      '緊急',
      'すぐに',
      'immediately',
    ];

    const lowerInput = input.toLowerCase();
    return urgentKeywords.some((keyword) => lowerInput.includes(keyword));
  }

  /**
   * Handle SIGINT interrupt
   */
  private handleInterrupt(signal: string): void {
    logger.info(`Received ${signal} during processing`);

    if (this.interruptProcessing()) {
      console.log('\n[Processing interrupted. Enter new command or /exit to quit]');
    }
  }

  /**
   * Handle exit request
   */
  private handleExit(): void {
    console.log('\nAre you sure you want to exit? (y/n)');

    process.stdin.once('data', (data) => {
      const answer = data.toString().trim().toLowerCase();
      if (answer === 'y' || answer === 'yes') {
        console.log('Goodbye!');
        process.exit(0);
      } else {
        console.log('Continuing...');
      }
    });
  }

  /**
   * Get processing state
   */
  getProcessingState(): ProcessingState {
    return { ...this.processingState };
  }

  /**
   * Check if currently processing
   */
  isProcessing(): boolean {
    return this.processingState.isProcessing;
  }

  /**
   * Set whether current task can be interrupted
   */
  setInterruptible(canInterrupt: boolean): void {
    this.processingState.canInterrupt = canInterrupt;
  }

  /**
   * Get interrupt history
   */
  getInterruptHistory(limit?: number): InterruptContext[] {
    if (limit) {
      return this.interruptHistory.slice(-limit);
    }
    return [...this.interruptHistory];
  }

  /**
   * Clear interrupt history
   */
  clearHistory(): void {
    this.interruptHistory = [];
  }

  /**
   * Generate system prompt for AI based on interrupt context
   */
  generateSystemPrompt(context: InterruptContext): string {
    if (context.priority === 'override') {
      return 'User interrupted with new priority request. Focus on this new request instead of the previous one.';
    } else if (context.priority === 'merge') {
      return 'User provided additional information. Incorporate this with the previous request to provide a comprehensive response.';
    } else {
      return 'User has queued a new request. Complete the current task first, then address the new request.';
    }
  }
}

// Export singleton instance
export const interruptHandler = new InterruptHandler();
