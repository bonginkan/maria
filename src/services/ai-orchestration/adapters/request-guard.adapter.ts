/**
 * Request Guard Adapter
 *
 * サーキットブレーカー・リトライ・レート制限を実装したrequest-guardを
 * IRequestGuardインターフェースに適合
 */

import { IRequestGuard, GuardError } from "../ports";
import {
  RequestGuard,
  CircuitBreakerConfig,
  RetryConfig,
  RateLimitConfig,
  GuardMetrics,
  _CircuitState,
  getRequestGuard,
} from "../request-guard";

/**
 * Request Guard Adapter
 * 既存のRequestGuardをIRequestGuardインターフェースに適合
 */
export class RequestGuardAdapter implements IRequestGuard {
  private guard: RequestGuard;

  // デフォルト設定(安全側)
  private defaultConfig = {
    maxRetries: 2, // 最大2回リトライ(合計3回試行)
    backoff: {
      baseDelayMs: 1000, // 初回1秒
      maxDelayMs: 2500, // 最大2.5秒(フィードバックで推奨)
      multiplier: 2, // 2倍ずつ増加
    },
    circuitBreaker: {
      failureThreshold: 5, // 5回失敗で開放
      recoveryTimeoutMs: 30000, // 30秒後に再試行
      successThreshold: 3, // 3回成功で閉鎖
    },
    rateLimit: {
      requestsPerMinute: 60, // 1分間に60リクエストまで
      burstLimit: 10, // バースト10リクエストまで
    },
  };

  constructor(guard?: RequestGuard) {
    this.guard = guard || getRequestGuard();
  }

  /**
   * 設定オプションの変換
   */
  private buildExecuteOptions(
    key: string,
    opts?: {
      maxRetries?: number;
      backoff?: {
        baseDelayMs?: number;
        maxDelayMs?: number;
        multiplier?: number;
      };
      skipRateLimit?: boolean;
    },
  ) {
    // リトライ設定
    const retryConfig: Partial<RetryConfig> = {
      maxRetries: opts?.maxRetries ?? this.defaultConfig.maxRetries,
      baseDelayMs:
        opts?.backoff?.baseDelayMs ?? this.defaultConfig.backoff.baseDelayMs,
      maxDelayMs:
        opts?.backoff?.maxDelayMs ?? this.defaultConfig.backoff.maxDelayMs,
      backoffMultiplier:
        opts?.backoff?.multiplier ?? this.defaultConfig.backoff.multiplier,
    };

    // サーキットブレーカー設定(キーに基づいてカスタマイズ可能)
    const circuitConfig: Partial<CircuitBreakerConfig> =
      this.getCircuitConfigForKey(key);

    // レート制限設定(キーに基づいてカスタマイズ可能)
    const rateLimitConfig: Partial<RateLimitConfig> =
      this.getRateLimitConfigForKey(key);

    return {
      _retryConfig: retryConfig,
      circuitConfig,
      rateLimitConfig,
      skipRateLimit: opts?.skipRateLimit || false,
    };
  }

  /**
   * キーに基づくサーキットブレーカー設定
   */
  private getCircuitConfigForKey(key: string): Partial<CircuitBreakerConfig> {
    // プロバイダ別のカスタム設定
    if (key.startsWith("groq:")) {
      // Groqは高速だが不安定な場合があるので、より寛容に
      return {
        failureThreshold: 10,
        recoveryTimeoutMs: 15000,
        successThreshold: 2,
      };
    }

    if (key.startsWith("ollama:") || key.startsWith("vllm:")) {
      // ローカルモデルは安定しているが遅い場合がある
      return {
        failureThreshold: 3,
        recoveryTimeoutMs: 60000,
        successThreshold: 1,
      };
    }

    // デフォルト設定
    return this.defaultConfig.circuitBreaker;
  }

  /**
   * キーに基づくレート制限設定
   */
  private getRateLimitConfigForKey(key: string): Partial<RateLimitConfig> {
    // プロバイダ別のレート制限
    if (key.startsWith("openai:")) {
      // OpenAIは比較的高いレート制限
      return {
        requestsPerMinute: 100,
        burstLimit: 20,
      };
    }

    if (key.startsWith("anthropic:")) {
      // Anthropicも高めのレート制限
      return {
        requestsPerMinute: 80,
        burstLimit: 15,
      };
    }

    if (key.startsWith("groq:")) {
      // Groqは非常に高速
      return {
        requestsPerMinute: 200,
        burstLimit: 30,
      };
    }

    // デフォルト設定
    return this.defaultConfig.rateLimit;
  }

  /**
   * ガード付き実行
   */
  async run<T>(
    key: string,
    fn: () => Promise<T>,
    opts?: {
      maxRetries?: number;
      backoff?: {
        baseDelayMs?: number;
        maxDelayMs?: number;
        multiplier?: number;
      };
      skipRateLimit?: boolean;
    },
  ): Promise<T> {
    try {
      const options = this.buildExecuteOptions(key, opts);

      console.debug(
        `[RequestGuard] Executing with key: ${key}`,
        `retries: ${options._retryConfig.maxRetries},`,
        `rateLimit: ${opts?.skipRateLimit ? "skipped" : "enabled"}`,
      );

      // RequestGuardのexecuteメソッドを呼び出し
      const result = await this.guard.execute<T>(
        key, // modelId/circuitKey
        fn, // 実行関数
        options,
      );

      return result;
    } catch (error) {
      // エラーをGuardErrorとしてラップ
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      // サーキットブレーカーが開いている場合
      if (errorMessage.includes("Circuit breaker OPEN")) {
        throw new GuardError(
          `Circuit breaker is open for ${key}. Service temporarily unavailable.`,
          {
            key,
            circuitState: "open",
            error: errorMessage,
          },
        );
      }

      // レート制限に達した場合
      if (errorMessage.includes("Rate limit exceeded")) {
        throw new GuardError(
          `Rate limit exceeded for ${key}. Please retry later.`,
          {
            key,
            rateLimitExceeded: true,
            error: errorMessage,
          },
        );
      }

      // その他のエラー
      throw new GuardError(`Request failed after retries: ${errorMessage}`, {
        key,
        options: opts,
        error,
      });
    }
  }

  /**
   * サーキット状態取得
   */
  getCircuitStates(): Record<
    string,
    {
      state: string;
      failures: number;
      nextAttempt?: string;
    }
  > {
    const states = this.guard.getCircuitStates();

    // CircuitStateを文字列に変換
    const result: Record<string, any> = {};
    for (const [key, state] of Object.entries(states)) {
      result[key] = {
        ...state,
        state: String(state.state), // CircuitState enumを文字列に
      };
    }

    return result;
  }

  /**
   * メトリクス取得
   */
  getMetrics(): Record<string, GuardMetrics> {
    const metrics = this.guard.getMetrics();

    if ("modelId" in metrics) {
      // 単一のメトリクスの場合
      return { [metrics.modelId as string]: metrics as GuardMetrics };
    }

    // 複数のメトリクスの場合
    return metrics as Record<string, GuardMetrics>;
  }

  /**
   * サーキットブレーカーリセット(テスト/復旧用)
   */
  resetCircuitBreaker(key: string): void {
    this.guard.resetCircuitBreaker(key);
    console.log(`[RequestGuard] Circuit breaker reset for ${key}`);
  }

  /**
   * メトリクスクリア(テスト用)
   */
  clearMetrics(): void {
    this.guard.clearMetrics();
    console.log("[RequestGuard] All metrics cleared");
  }
}

/**
 * ファクトリ関数
 */
export function createRequestGuardAdapter(): RequestGuardAdapter {
  return new RequestGuardAdapter();
}
