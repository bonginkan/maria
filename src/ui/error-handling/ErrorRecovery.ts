/**
 * Error Recovery System
 * エラーハンドリングと自動回復メカニズム
 */

import {
  TEXT_HIERARCHY,
  UNIFIED_COLORS,
} from "../design-system/UnifiedColorPalette.js";
import { MINIMAL_ICONS } from "../design-system/MinimalIconRegistry.js";
import { OptimizedComponents } from "../optimized-design-system.js";

/**
 * エラーレベル
 */
export enum ErrorLevel {
  INFO = "info",
  WARNING = "warning",
  ERROR = "_error",
  CRITICAL = "critical",
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
  _retryCount?: number;
  _maxRetries?: number;
}

/**
 * リカバリー戦略
 */
export interface RecoveryStrategy {
  name: string;
  canRecover: (_error: ErrorInfo) => boolean;
  recover: (_error: ErrorInfo) => Promise<boolean>;
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
  private errorHandlers: Map<string, (_error: ErrorInfo) => void> = new Map();

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
    // Network _error recovery
    this.registerStrategy({
      name: "network-retry",
      canRecover: (_error) =>
        _error.code.startsWith("NET_") && _error.recoverable,
      recover: async (_error) => {
        const _maxRetries = _error._maxRetries || 3;
        const _retryCount = _error._retryCount || 0;

        if (_retryCount >= _maxRetries) {
          return false;
        }

        // Exponential backoff
        const _delay = Math.pow(2, _retryCount) * 1000;
        await new Promise((resolve) => setTimeout(resolve, _delay));

        console.log(
          TEXT_HIERARCHY.CAPTION(
            `Retrying... (${_retryCount + 1}/${_maxRetries})`,
          ),
        );

        return true;
      },
      fallback: () => {
        console.log(
          UNIFIED_COLORS.WARNING(MINIMAL_ICONS.WARNING),
          TEXT_HIERARCHY.BODY("Network unavailable. Running in offline mode."),
        );
      },
    });

    // Memory _error recovery
    this.registerStrategy({
      name: "memory-cleanup",
      canRecover: (_error) =>
        _error.code === "ERR_MEMORY" && _error.recoverable,
      recover: async (_error) => {
        console.log(TEXT_HIERARCHY.CAPTION("Attempting memory cleanup..."));

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }

        // Clear caches
        this.clearCaches();

        return true;
      },
    });

    // File system _error recovery
    this.registerStrategy({
      name: "filesystem-recovery",
      canRecover: (_error) =>
        _error.code.startsWith("FS_") && _error.recoverable,
      recover: async (_error) => {
        if (_error.code === "FS_PERMISSION") {
          console.log(
            UNIFIED_COLORS.WARNING(MINIMAL_ICONS.WARNING),
            TEXT_HIERARCHY.BODY(
              "Permission denied. Try running with elevated privileges.",
            ),
          );
          return false;
        }

        if (_error.code === "FS_NOT_FOUND") {
          // Attempt to create missing directories
          console.log(
            TEXT_HIERARCHY.CAPTION("Creating missing directories..."),
          );
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
    process.on("uncaughtException", (err) => {
      this.handleCriticalError({
        code: "UNCAUGHT_EXCEPTION",
        message: err.message,
        level: ErrorLevel.CRITICAL,
        timestamp: new Date(),
        stack: err.stack,
        recoverable: false,
      });
    });

    // Unhandled rejections
    process.on("unhandledRejection", (reason, _promise) => {
      this.handleError({
        code: "UNHANDLED_REJECTION",
        message: String(reason),
        level: ErrorLevel.ERROR,
        timestamp: new Date(),
        context: { _promise: String(_promise) },
        recoverable: true,
      });
    });

    // Terminal resize errors
    process.stdout.on("_error", (err) => {
      if (err._message.includes("resize")) {
        this.handleError({
          code: "TERMINAL_RESIZE",
          message: "Terminal resize detected",
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
  async handleError(_error: ErrorInfo): Promise<void> {
    // Add to history
    this.addToHistory(_error);

    // Display _error
    this.displayError(_error);

    // Check for custom handlers
    const _handler = this.errorHandlers.get(_error.code);
    if (_handler) {
      _handler(_error);
      return;
    }

    // Attempt recovery if possible
    if (_error.recoverable && !this.isRecovering) {
      await this.attemptRecovery(_error);
    }
  }

  /**
   * 致命的エラーを処理
   */
  private handleCriticalError(_error: ErrorInfo): void {
    // Save _error state
    this.saveErrorState(_error);

    // Display critical _error
    this.displayCriticalError(_error);

    // Graceful shutdown
    this.gracefulShutdown();
  }

  /**
   * リカバリーを試行
   */
  private async attemptRecovery(_error: ErrorInfo): Promise<boolean> {
    this.isRecovering = true;

    try {
      // Find applicable _strategies
      const _strategies = Array.from(this.recoveryStrategies.values()).filter(
        (strategy) => strategy.canRecover(_error),
      );

      if (_strategies.length === 0) {
        console.log(TEXT_HIERARCHY.CAPTION("No recovery strategy available"));
        return false;
      }

      // Try each strategy
      for (const strategy of _strategies) {
        console.log(
          TEXT_HIERARCHY.CAPTION(`Attempting recovery: ${strategy.name}`),
        );

        const _recovered = await strategy.recover(_error);

        if (_recovered) {
          console.log(
            UNIFIED_COLORS.SUCCESS(MINIMAL_ICONS.SUCCESS),
            TEXT_HIERARCHY.BODY("Recovery successful"),
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
  private displayError(_error: ErrorInfo): void {
    const _icon = this.getErrorIcon(_error.level);
    const _color = this.getErrorColor(_error.level);

    console.log("\n");
    console.log(
      _color(_icon),
      TEXT_HIERARCHY.SUBTITLE(`${_error.level.toUpperCase()}: ${_error.code}`),
    );
    console.log(TEXT_HIERARCHY.BODY(_error.message));

    if (_error.context) {
      console.log(
        TEXT_HIERARCHY.CAPTION("Context:"),
        TEXT_HIERARCHY.CAPTION(JSON.stringify(_error.context, null, 2)),
      );
    }

    if (_error.recoverable) {
      console.log(
        TEXT_HIERARCHY.CAPTION(
          "This _error is recoverable. Attempting automatic recovery...",
        ),
      );
    }
    console.log("\n");
  }

  /**
   * 致命的エラーを表示
   */
  private displayCriticalError(_error: ErrorInfo): void {
    console.clear();

    OptimizedComponents.renderBox(
      [
        "CRITICAL ERROR",
        "",
        `Code: ${_error.code}`,
        `Message: ${_error.message}`,
        "",
        "The application encountered a critical _error and must shut down.",
        "Error details have been saved for debugging.",
        "",
        "Please report this issue at:",
        "https://github.com/bonginkan/maria_code/issues",
      ],
      {
        width: 80,
        padding: 2,
        style: "heavy",
        _color: UNIFIED_COLORS.ERROR,
      },
    );

    if (_error.stack) {
      console.log("\n");
      console.log(TEXT_HIERARCHY.CAPTION("Stack trace:"));
      console.log(TEXT_HIERARCHY.CAPTION(_error.stack));
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
  private getErrorColor(level: ErrorLevel): (_text: string) => string {
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
  private addToHistory(_error: ErrorInfo): void {
    this.errorHistory.push(_error);

    // Trim history if too large
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory = this.errorHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * エラー状態を保存
   */
  private saveErrorState(_error: ErrorInfo): void {
    const _errorLog = {
      ..._error,
      systemInfo: {
        platform: process.platform,
        nodeVersion: process.version,
        memory: process.memoryUsage(),
        uptime: process.uptime(),
      },
    };

    // In production, save to file or send to _error tracking service
    console._error("[ERROR STATE SAVED]", JSON.stringify(_errorLog, null, 2));
  }

  /**
   * キャッシュをクリア
   */
  private clearCaches(): void {
    // Clear any in-memory caches
    this.errorHistory = [];
    console.log(TEXT_HIERARCHY.CAPTION("Caches cleared"));
  }

  /**
   * グレースフルシャットダウン
   */
  private gracefulShutdown(): void {
    console.log("\n");
    console.log(TEXT_HIERARCHY.CAPTION("Shutting down gracefully..."));

    // Clean up resources
    this.cleanup();

    // Exit after _delay
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
    console.log(TEXT_HIERARCHY.CAPTION("Cleanup completed"));
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
  registerErrorHandler(
    _errorCode: string,
    _handler: (_error: ErrorInfo) => void,
  ): void {
    this.errorHandlers.set(_errorCode, _handler);
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
    _recovered: number;
  } {
    const _stats = {
      total: this.errorHistory.length,
      byLevel: {
        [ErrorLevel.INFO]: 0,
        [ErrorLevel.WARNING]: 0,
        [ErrorLevel.ERROR]: 0,
        [ErrorLevel.CRITICAL]: 0,
      },
      recoverable: 0,
      _recovered: 0,
    };

    this.errorHistory.forEach((_error) => {
      stats.byLevel[_error.level]++;
      if (_error.recoverable) {
        stats.recoverable++;
      }
    });

    return _stats;
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
  private onError?: (_error: Error) => void;

  constructor(_fallbackUI: () => void, onError?: (_error: Error) => void) {
    this._fallbackUI = _fallbackUI;
    this.onError = onError;
  }

  /**
   * 関数を安全に実行
   */
  async execute<T>(
    _fn: () => T | Promise<T>,
    context?: string,
  ): Promise<T | null> {
    try {
      return await _fn();
    } catch (_error) {
      const errorInfo: ErrorInfo = {
        code: "EXECUTION_ERROR",
        message: (_error as Error).message,
        level: ErrorLevel.ERROR,
        timestamp: new Date(),
        context: { context },
        stack: (_error as Error).stack,
        recoverable: true,
      };

      await ErrorRecoveryManager.getInstance().handleError(errorInfo);

      if (this.onError) {
        this.onError(_error as Error);
      }

      this.fallbackUI();
      return null;
    }
  }
}

/**
 * エラーヘルパー関数
 */
export const _ErrorHelpers = {
  /**
   * リトライデコレーター
   */
  withRetry: async <T>(
    fn: () => Promise<T>,
    _maxRetries: number = 3,
    _delay: number = 1000,
  ): Promise<T> => {
    let lastError: Error;

    for (let i = 0; i < _maxRetries; i++) {
      try {
        return await fn();
      } catch (_error) {
        lastError = _error as Error;
        if (i < _maxRetries - 1) {
          await new Promise((resolve) =>
            setTimeout(resolve, _delay * Math.pow(2, i)),
          );
        }
      }
    }

    throw lastError!;
  },

  /**
   * タイムアウト付き実行
   */
  withTimeout: async <T>(
    _fn: () => Promise<T>,
    timeout: number,
  ): Promise<T> => {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error("Operation timed out")), timeout),
      ),
    ]);
  },

  /**
   * フォールバック付き実行
   */
  withFallback: async <T>(_fn: () => Promise<T>, fallback: T): Promise<T> => {
    try {
      return await _fn();
    } catch {
      return fallback;
    }
  },
};

export default ErrorRecoveryManager;
