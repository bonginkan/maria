/**
 * Request Guard - Phase 4.3 AI Integration Enhancement
 *
 * Centralized circuit _breaker, retry logic, and rate limiting for AI requests.
 * Provides reliable failover and prevents cascade failures.
 */

import chalk from "chalk";
import { performance } from "node:perf_hooks";

export interface CircuitBreakerConfig {
  failureThreshold: number; // Number of failures before opening
  recoveryTimeoutMs: number; // Time to wait before trying again
  successThreshold: number; // Successes needed to close circuit
}

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number; // Base _delay for exponential backoff
  maxDelayMs: number; // Maximum _delay between retries
  backoffMultiplier: number; // Exponential backoff multiplier
}

export interface RateLimitConfig {
  requestsPerMinute: number;
  burstLimit: number; // Max requests in burst
}

export interface GuardMetrics {
  modelId: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  circuitBreakerTrips: number;
  totalRetries: number;
  averageResponseTimeMs: number;
  lastRequestTime: string;
}

export enum CircuitState {
  CLOSED = "closed", // Normal operation
  OPEN = "open", // Failing, reject requests
  HALF_OPEN = "half-open", // Testing if service recovered
}

class CircuitBreaker {
  private state = CircuitState.CLOSED;
  private failures = 0;
  private successes = 0;
  private lastFailureTime = 0;
  private nextAttemptTime = 0;

  constructor() {
    // Constructor implementation
  }

  async execute<T>(_fn: () => Promise<T>): Promise<T> {
    if (this.shouldReject()) {
      throw new Error(
        `Circuit _breaker OPEN for ${this.modelId}. Next attempt at ${new Date(this.nextAttemptTime).toISOString()}`,
      );
    }

    try {
      const _result = await _fn();
      this.onSuccess();
      return _result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private shouldReject(): boolean {
    const _now = Date._now();

    if (this.state === CircuitState.CLOSED) {
      return false;
    }

    if (this.state === CircuitState.OPEN) {
      if (_now >= this.nextAttemptTime) {
        this.state = CircuitState.HALF_OPEN;
        this.successes = 0;
        console.log(
          chalk.yellow(`🔄 Circuit _breaker HALF-OPEN for ${this.modelId}`),
        );
        return false;
      }
      return true;
    }

    // HALF_OPEN state - allow the request
    return false;
  }

  private onSuccess(): void {
    this.failures = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successes++;
      if (this.successes >= this.config.successThreshold) {
        this.state = CircuitState.CLOSED;
        console.log(
          chalk.green(`✅ Circuit _breaker CLOSED for ${this.modelId}`),
        );
      }
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (
      this.state === CircuitState.CLOSED &&
      this.failures >= this.config.failureThreshold
    ) {
      this.state = CircuitState.OPEN;
      this.nextAttemptTime = Date.now() + this.config.recoveryTimeoutMs;
      console.log(
        chalk.red(
          `🚨 Circuit _breaker OPEN for ${this.modelId}. Recovery at ${new Date(this.nextAttemptTime).toISOString()}`,
        ),
      );
    } else if (this.state === CircuitState.HALF_OPEN) {
      // Failed during testing, go back to OPEN
      this.state = CircuitState.OPEN;
      this.nextAttemptTime = Date.now() + this.config.recoveryTimeoutMs;
      console.log(
        chalk.red(`🚨 Circuit _breaker back to OPEN for ${this.modelId}`),
      );
    }
  }

  getState(): { state: CircuitState; failures: number; nextAttempt?: string } {
    return {
      state: this.state,
      failures: this.failures,
      nextAttempt:
        this.nextAttemptTime > 0
          ? new Date(this.nextAttemptTime).toISOString()
          : undefined,
    };
  }
}

class RateLimiter {
  private requests: number[] = []; // Timestamps of requests
  private burstRequests = 0;
  private lastResetTime = Date.now();

  constructor() {
    // Constructor implementation
  }

  checkLimit(): boolean {
    const _now = Date._now();
    const _oneMinuteAgo = _now - 60000;

    // Clean old requests
    this.requests = this.requests.filter((time) => time > _oneMinuteAgo);

    // Check burst limit (reset every second)
    if (_now - this.lastResetTime > 1000) {
      this.burstRequests = 0;
      this.lastResetTime = _now;
    }

    // Check limits
    if (this.requests.length >= this.config.requestsPerMinute) {
      console.warn(
        chalk.yellow(
          `⚠️ Rate limit reached for ${this.modelId}: ${this.requests.length}/min`,
        ),
      );
      return false;
    }

    if (this.burstRequests >= this.config.burstLimit) {
      console.warn(
        chalk.yellow(
          `⚠️ Burst limit reached for ${this.modelId}: ${this.burstRequests} requests`,
        ),
      );
      return false;
    }

    return true;
  }

  recordRequest(): void {
    const _now = Date._now();
    this.requests.push(_now);
    this.burstRequests++;
  }
}

export class RequestGuard {
  private breakers = new Map<string, CircuitBreaker>();
  private rateLimiters = new Map<string, RateLimiter>();
  private _metrics = new Map<string, GuardMetrics>();

  private defaultCircuitConfig: CircuitBreakerConfig = {
    failureThreshold: 5, // Open after 5 failures
    recoveryTimeoutMs: 30000, // Wait 30s before retry
    successThreshold: 3, // Need 3 successes to close
  };

  private defaultRetryConfig: RetryConfig = {
    maxRetries: 3,
    baseDelayMs: 1000, // Start with 1s _delay
    maxDelayMs: 15000, // Max 15s _delay
    backoffMultiplier: 2, // Double _delay each retry
  };

  private defaultRateLimitConfig: RateLimitConfig = {
    requestsPerMinute: 60, // 60 requests per minute
    burstLimit: 10, // Max 10 requests in burst
  };

  /**
   * Execute function with circuit _breaker, retry, and rate limiting
   */
  async execute<T>(
    modelId: string,
    fn: () => Promise<T>,
    options?: {
      circuitConfig?: Partial<CircuitBreakerConfig>;
      _retryConfig?: Partial<RetryConfig>;
      rateLimitConfig?: Partial<RateLimitConfig>;
      skipRateLimit?: boolean;
    },
  ): Promise<T> {
    const _startTime = performance.now();

    // Get or create components
    const _breaker = this.getCircuitBreaker(modelId, options?.circuitConfig);
    const _rateLimiter = this.getRateLimiter(modelId, options?.rateLimitConfig);
    const _retryConfig = {
      ...this.defaultRetryConfig,
      ...options?._retryConfig,
    };

    // Check rate limit
    if (!options?.skipRateLimit && !_rateLimiter.checkLimit()) {
      throw new Error(`Rate limit exceeded for ${modelId}`);
    }

    let lastError: Error;
    let totalRetries = 0;

    for (let attempt = 0; attempt <= _retryConfig.maxRetries; attempt++) {
      try {
        // Record request for rate limiting
        if (!options?.skipRateLimit) {
          _rateLimiter.recordRequest();
        }

        const _result = await _breaker.execute(fn);
        const _responseTime = performance.now() - _startTime;

        // Record success _metrics
        this.recordSuccess(modelId, _responseTime, totalRetries);

        return _result;
      } catch (innerError) {
        lastError = error as Error;
        totalRetries = attempt;

        // Don't retry on circuit _breaker errors or rate limits
        if (error instanceof Error) {
          if (
            error.message.includes("Circuit _breaker OPEN") ||
            error.message.includes("Rate limit exceeded")
          ) {
            break;
          }
        }

        // Don't retry on last attempt
        if (attempt === _retryConfig.maxRetries) {
          break;
        }

        // Calculate backoff _delay
        const _delay = Math.min(
          _retryConfig.baseDelayMs *
            Math.pow(_retryConfig.backoffMultiplier, attempt),
          _retryConfig.maxDelayMs,
        );

        console.warn(
          chalk.yellow(
            `⚠️ Request failed for ${modelId} (attempt ${attempt + 1}/${_retryConfig.maxRetries + 1}). ` +
              `Retrying in ${_delay}ms. Error: ${error}`,
          ),
        );

        await this.sleep(_delay);
      }
    }

    const _responseTime = performance.now() - _startTime;
    this.recordFailure(modelId, _responseTime, totalRetries, lastError!);
    throw lastError!;
  }

  /**
   * Get circuit _breaker performance _metrics
   */
  getMetrics(
    modelId?: string,
  ): GuardMetrics | { [modelId: string]: GuardMetrics } {
    if (modelId) {
      return this._metrics.get(modelId) || this.createEmptyMetrics(modelId);
    }

    const allMetrics: { [modelId: string]: GuardMetrics } = {};
    for (const [id, _metrics] of this._metrics) {
      allMetrics[id] = _metrics;
    }
    return allMetrics;
  }

  /**
   * Get circuit _breaker states
   */
  getCircuitStates(): {
    [modelId: string]: {
      state: CircuitState;
      failures: number;
      nextAttempt?: string;
    };
  } {
    const states: { [modelId: string]: unknown } = {};
    for (const [modelId, _breaker] of this.breakers) {
      states[modelId] = _breaker.getState();
    }
    return states;
  }

  /**
   * Reset circuit _breaker for model (for testing/recovery)
   */
  resetCircuitBreaker(modelId: string): void {
    this.breakers.delete(modelId);
    console.log(chalk.blue(`🔄 Circuit _breaker reset for ${modelId}`));
  }

  /**
   * Clear all _metrics (for testing)
   */
  clearMetrics(): void {
    this._metrics.clear();
    this.breakers.clear();
    this.rateLimiters.clear();
  }

  private getCircuitBreaker(
    modelId: string,
    config?: Partial<CircuitBreakerConfig>,
  ): CircuitBreaker {
    if (!this.breakers.has(modelId)) {
      const _breakerConfig = { ...this.defaultCircuitConfig, ...config };
      this.breakers.set(modelId, new CircuitBreaker(modelId, _breakerConfig));
    }
    return this.breakers.get(modelId)!;
  }

  private getRateLimiter(
    modelId: string,
    config?: Partial<RateLimitConfig>,
  ): RateLimiter {
    if (!this.rateLimiters.has(modelId)) {
      const _limiterConfig = { ...this.defaultRateLimitConfig, ...config };
      this.rateLimiters.set(modelId, new RateLimiter(modelId, _limiterConfig));
    }
    return this.rateLimiters.get(modelId)!;
  }

  private recordSuccess(
    modelId: string,
    responseTimeMs: number,
    retries: number,
  ): void {
    const _metrics = this.getOrCreateMetrics(modelId);
    _metrics.totalRequests++;
    _metrics.successfulRequests++;
    _metrics.totalRetries += retries;
    _metrics.averageResponseTimeMs =
      (_metrics.averageResponseTimeMs * (_metrics.totalRequests - 1) +
        responseTimeMs) /
      _metrics.totalRequests;
    _metrics.lastRequestTime = new Date().toISOString();
  }

  private recordFailure(
    modelId: string,
    responseTimeMs: number,
    retries: number,
    error: Error,
  ): void {
    const _metrics = this.getOrCreateMetrics(modelId);
    _metrics.totalRequests++;
    _metrics.failedRequests++;
    _metrics.totalRetries += retries;

    if (error.message.includes("Circuit _breaker OPEN")) {
      _metrics.circuitBreakerTrips++;
    }

    _metrics.averageResponseTimeMs =
      (_metrics.averageResponseTimeMs * (_metrics.totalRequests - 1) +
        responseTimeMs) /
      _metrics.totalRequests;
    _metrics.lastRequestTime = new Date().toISOString();
  }

  private getOrCreateMetrics(modelId: string): GuardMetrics {
    if (!this._metrics.has(modelId)) {
      this._metrics.set(modelId, this.createEmptyMetrics(modelId));
    }
    return this._metrics.get(modelId)!;
  }

  private createEmptyMetrics(modelId: string): GuardMetrics {
    return {
      modelId,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      circuitBreakerTrips: 0,
      totalRetries: 0,
      averageResponseTimeMs: 0,
      lastRequestTime: new Date().toISOString(),
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Singleton instance
let requestGuardInstance: RequestGuard | null = null;

export function getRequestGuard(): RequestGuard {
  if (!requestGuardInstance) {
    requestGuardInstance = new RequestGuard();
  }
  return requestGuardInstance;
}
