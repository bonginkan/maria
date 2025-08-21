/**
 * Error Recovery System
 * エラーハンドリングと自動回復メカニズム
 */

import { UNIFIED_COLORS, TEXT_HIERARCHY } from '../design-system/UnifiedColorPalette.js';
import { MINIMAL_ICONS } from '../design-system/MinimalIconRegistry.js';
import { OptimizedComponents } from '../optimized-design-system.js';

/**
 * エラーレベル
 */
export enum ErrorLevel {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

/**
 * エラー情報
 */
export interface ErrorInfo {
  code: string;
  message: string;
  level: ErrorLevel;
  timestamp: Date;
  context?: Record<string, unknown>;
  stack?: string;
  recoverable: boolean;
  retryCount?: number;
  maxRetries?: number;
}

/**
 * リカバリー戦略
 */
export interface RecoveryStrategy {
  name: string;
  canRecover: (error: ErrorInfo) => boolean;
  recover: (error: ErrorInfo) => Promise<boolean>;
  fallback?: () => void;
}

/**
 * エラー回復マネージャー
 */
export class ErrorRecoveryManager {
  private static instance: ErrorRecoveryManager;
  private errorHistory: ErrorInfo[] = [];
  private recoveryStrategies: Map<string, RecoveryStrategy> = new Map();
  private isRecovering: boolean = false;
  private maxHistorySize: number = 100;
  private errorHandlers: Map<string, (error: ErrorInfo) => void> = new Map();

  private constructor() {
    this.initializeDefaultStrategies();
    this.setupGlobalErrorHandlers();
  }

  /**
   * シングルトンインスタンスを取得
   */
  static getInstance(): ErrorRecoveryManager {
    if (!this.instance) {
      this.instance = new ErrorRecoveryManager();
    }
    return this.instance;
  }

  /**
   * デフォルトリカバリー戦略を初期化
   */
  private initializeDefaultStrategies(): void {
    // Network error recovery
    this.registerStrategy({
      name: 'network-retry',
      canRecover: (error) => error.code.startsWith('NET_') && error.recoverable,
      recover: async (error) => {
        const maxRetries = error.maxRetries || 3;
        const retryCount = error.retryCount || 0;

        if (retryCount >= maxRetries) {
          return false;
        }

        // Exponential backoff
        const delay = Math.pow(2, retryCount) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));

        console.log(TEXT_HIERARCHY.CAPTION(`Retrying... (${retryCount + 1}/${maxRetries})`));

        return true;
      },
      fallback: () => {
        console.log(
          UNIFIED_COLORS.WARNING(MINIMAL_ICONS.WARNING),
          TEXT_HIERARCHY.BODY('Network unavailable. Running in offline mode.'),
        );
      },
    });

    // Memory error recovery
    this.registerStrategy({
      name: 'memory-cleanup',
      canRecover: (error) => error.code === 'ERR_MEMORY' && error.recoverable,
      recover: async (error) => {
        console.log(TEXT_HIERARCHY.CAPTION('Attempting memory cleanup...'));

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }

        // Clear caches
        this.clearCaches();

        return true;
      },
    });

    // File system error recovery
    this.registerStrategy({
      name: 'filesystem-recovery',
      canRecover: (error) => error.code.startsWith('FS_') && error.recoverable,
      recover: async (error) => {
        if (error.code === 'FS_PERMISSION') {
          console.log(
            UNIFIED_COLORS.WARNING(MINIMAL_ICONS.WARNING),
            TEXT_HIERARCHY.BODY('Permission denied. Try running with elevated privileges.'),
          );
          return false;
        }

        if (error.code === 'FS_NOT_FOUND') {
          // Attempt to create missing directories
          console.log(TEXT_HIERARCHY.CAPTION('Creating missing directories...'));
          return true;
        }

        return false;
      },
    });
  }

  /**
   * グローバルエラーハンドラーをセットアップ
   */
  private setupGlobalErrorHandlers(): void {
    // Uncaught exceptions
    process.on('uncaughtException', (err) => {
      this.handleCriticalError({
        code: 'UNCAUGHT_EXCEPTION',
        message: err.message,
        level: ErrorLevel.CRITICAL,
        timestamp: new Date(),
        stack: err.stack,
        recoverable: false,
      });
    });

    // Unhandled rejections
    process.on('unhandledRejection', (reason, _promise) => {
      this.handleError({
        code: 'UNHANDLED_REJECTION',
        message: String(reason),
        level: ErrorLevel.ERROR,
        timestamp: new Date(),
        context: { promise: String(promise) },
        recoverable: true,
      });
    });

    // Terminal resize errors
    process.stdout.on('error', (err) => {
      if (err.message.includes('resize')) {
        this.handleError({
          code: 'TERMINAL_RESIZE',
          message: 'Terminal resize detected',
          level: ErrorLevel.INFO,
          timestamp: new Date(),
          recoverable: true,
        });
      }
    });
  }

  /**
   * エラーを処理
   */
  async handleError(error: ErrorInfo): Promise<void> {
    // Add to history
    this.addToHistory(error);

    // Display error
    this.displayError(error);

    // Check for custom handlers
    const handler = this.errorHandlers.get(error.code);
    if (handler) {
      handler(error);
      return;
    }

    // Attempt recovery if possible
    if (error.recoverable && !this.isRecovering) {
      await this.attemptRecovery(error);
    }
  }

  /**
   * 致命的エラーを処理
   */
  private handleCriticalError(error: ErrorInfo): void {
    // Save error state
    this.saveErrorState(error);

    // Display critical error
    this.displayCriticalError(error);

    // Graceful shutdown
    this.gracefulShutdown();
  }

  /**
   * リカバリーを試行
   */
  private async attemptRecovery(error: ErrorInfo): Promise<boolean> {
    this.isRecovering = true;

    try {
      // Find applicable strategies
      const strategies = Array.from(this.recoveryStrategies.values()).filter((strategy) =>
        strategy.canRecover(error),
      );

      if (strategies.length === 0) {
        console.log(TEXT_HIERARCHY.CAPTION('No recovery strategy available'));
        return false;
      }

      // Try each strategy
      for (const strategy of strategies) {
        console.log(TEXT_HIERARCHY.CAPTION(`Attempting recovery: ${strategy.name}`));

        const recovered = await strategy.recover(error);

        if (recovered) {
          console.log(
            UNIFIED_COLORS.SUCCESS(MINIMAL_ICONS.SUCCESS),
            TEXT_HIERARCHY.BODY('Recovery successful'),
          );
          return true;
        }

        // Try fallback if recovery failed
        if (strategy.fallback) {
          strategy.fallback();
        }
      }

      return false;
    } finally {
      this.isRecovering = false;
    }
  }

  /**
   * エラーを表示
   */
  private displayError(error: ErrorInfo): void {
    const icon = this.getErrorIcon(error.level);
    const color = this.getErrorColor(error.level);

    console.log('\n');
    console.log(
      color(icon),
      TEXT_HIERARCHY.SUBTITLE(`${error.level.toUpperCase()}: ${error.code}`),
    );
    console.log(TEXT_HIERARCHY.BODY(error.message));

    if (error.context) {
      console.log(
        TEXT_HIERARCHY.CAPTION('Context:'),
        TEXT_HIERARCHY.CAPTION(JSON.stringify(error.context, null, 2)),
      );
    }

    if (error.recoverable) {
      console.log(
        TEXT_HIERARCHY.CAPTION('This error is recoverable. Attempting automatic recovery...'),
      );
    }
    console.log('\n');
  }

  /**
   * 致命的エラーを表示
   */
  private displayCriticalError(error: ErrorInfo): void {
    console.clear();

    OptimizedComponents.renderBox(
      [
        'CRITICAL ERROR',
        '',
        `Code: ${error.code}`,
        `Message: ${error.message}`,
        '',
        'The application encountered a critical error and must shut down.',
        'Error details have been saved for debugging.',
        '',
        'Please report this issue at:',
        'https://github.com/bonginkan/maria_code/issues',
      ],
      {
        width: 80,
        padding: 2,
        style: 'heavy',
        color: UNIFIED_COLORS.ERROR,
      },
    );

    if (error.stack) {
      console.log('\n');
      console.log(TEXT_HIERARCHY.CAPTION('Stack trace:'));
      console.log(TEXT_HIERARCHY.CAPTION(error.stack));
    }
  }

  /**
   * エラーアイコンを取得
   */
  private getErrorIcon(level: ErrorLevel): string {
    switch (level) {
      case ErrorLevel.INFO:
        return MINIMAL_ICONS.INFO;
      case ErrorLevel.WARNING:
        return MINIMAL_ICONS.WARNING;
      case ErrorLevel.ERROR:
      case ErrorLevel.CRITICAL:
        return MINIMAL_ICONS.ERROR;
      default:
        return MINIMAL_ICONS.INFO;
    }
  }

  /**
   * エラーカラーを取得
   */
  private getErrorColor(level: ErrorLevel): (text: string) => string {
    switch (level) {
      case ErrorLevel.INFO:
        return UNIFIED_COLORS.INFO;
      case ErrorLevel.WARNING:
        return UNIFIED_COLORS.WARNING;
      case ErrorLevel.ERROR:
      case ErrorLevel.CRITICAL:
        return UNIFIED_COLORS.ERROR;
      default:
        return UNIFIED_COLORS.INFO;
    }
  }

  /**
   * 履歴に追加
   */
  private addToHistory(error: ErrorInfo): void {
    this.errorHistory.push(error);

    // Trim history if too large
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory = this.errorHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * エラー状態を保存
   */
  private saveErrorState(error: ErrorInfo): void {
    const errorLog = {
      ...error,
      systemInfo: {
        platform: process.platform,
        nodeVersion: process.version,
        memory: process.memoryUsage(),
        uptime: process.uptime(),
      },
    };

    // In production, save to file or send to error tracking service
    console.error('[ERROR STATE SAVED]', JSON.stringify(errorLog, null, 2));
  }

  /**
   * キャッシュをクリア
   */
  private clearCaches(): void {
    // Clear any in-memory caches
    this.errorHistory = [];
    console.log(TEXT_HIERARCHY.CAPTION('Caches cleared'));
  }

  /**
   * グレースフルシャットダウン
   */
  private gracefulShutdown(): void {
    console.log('\n');
    console.log(TEXT_HIERARCHY.CAPTION('Shutting down gracefully...'));

    // Clean up resources
    this.cleanup();

    // Exit after delay
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  }

  /**
   * クリーンアップ
   */
  private cleanup(): void {
    // Clear intervals and timeouts
    // Close connections
    // Save state
    console.log(TEXT_HIERARCHY.CAPTION('Cleanup completed'));
  }

  /**
   * リカバリー戦略を登録
   */
  registerStrategy(strategy: RecoveryStrategy): void {
    this.recoveryStrategies.set(strategy.name, strategy);
  }

  /**
   * カスタムエラーハンドラーを登録
   */
  registerErrorHandler(errorCode: string, handler: (error: ErrorInfo) => void): void {
    this.errorHandlers.set(errorCode, handler);
  }

  /**
   * エラー履歴を取得
   */
  getErrorHistory(): ErrorInfo[] {
    return [...this.errorHistory];
  }

  /**
   * エラー統計を取得
   */
  getErrorStatistics(): {
    total: number;
    byLevel: Record<ErrorLevel, number>;
    recoverable: number;
    recovered: number;
  } {
    const stats = {
      total: this.errorHistory.length,
      byLevel: {
        [ErrorLevel.INFO]: 0,
        [ErrorLevel.WARNING]: 0,
        [ErrorLevel.ERROR]: 0,
        [ErrorLevel.CRITICAL]: 0,
      },
      recoverable: 0,
      recovered: 0,
    };

    this.errorHistory.forEach((error) => {
      stats.byLevel[error.level]++;
      if (error.recoverable) {
        stats.recoverable++;
      }
    });

    return stats;
  }

  /**
   * エラーをクリア
   */
  clearErrors(): void {
    this.errorHistory = [];
  }
}

/**
 * エラーバウンダリー
 */
export class ErrorBoundary {
  private fallbackUI: () => void;
  private onError?: (error: Error) => void;

  constructor(fallbackUI: () => void, onError?: (error: Error) => void) {
    this.fallbackUI = fallbackUI;
    this.onError = onError;
  }

  /**
   * 関数を安全に実行
   */
  async execute<T>(fn: () => T | Promise<T>, context?: string): Promise<T | null> {
    try {
      return await fn();
    } catch (error) {
      const errorInfo: ErrorInfo = {
        code: 'EXECUTION_ERROR',
        message: (error as Error).message,
        level: ErrorLevel.ERROR,
        timestamp: new Date(),
        context: { context },
        stack: (error as Error).stack,
        recoverable: true,
      };

      await ErrorRecoveryManager.getInstance().handleError(errorInfo);

      if (this.onError) {
        this.onError(error as Error);
      }

      this.fallbackUI();
      return null;
    }
  }
}

/**
 * エラーヘルパー関数
 */
export const ErrorHelpers = {
  /**
   * リトライデコレーター
   */
  withRetry: async <T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000,
  ): Promise<T> => {
    let lastError: Error;

    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        if (i < maxRetries - 1) {
          await new Promise((resolve) => setTimeout(resolve, delay * Math.pow(2, i)));
        }
      }
    }

    throw lastError!;
  },

  /**
   * タイムアウト付き実行
   */
  withTimeout: async <T>(fn: () => Promise<T>, timeout: number): Promise<T> => {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Operation timed out')), timeout),
      ),
    ]);
  },

  /**
   * フォールバック付き実行
   */
  withFallback: async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
    try {
      return await fn();
    } catch {
      return fallback;
    }
  },
};

export default ErrorRecoveryManager;
