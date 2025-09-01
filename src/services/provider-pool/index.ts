/**
 * AI Provider Pool Management
 * Phase 5: Intelligent load balancing and failover for AI providers
 */

import { EventEmitter } from "node:events";

export interface ProviderInstance {
  id: string;
  type: string;
  endpoint?: string;
  apiKey?: string;
  model: string;
  maxConcurrent: number;
  currentLoad: number;
  healthy: boolean;
  lastHealthCheck: number;
  responseTime: number[];
  errorRate: number;
  priority: number;
}

export interface ProviderPoolConfig {
  maxRetries: number;
  healthCheckInterval: number;
  loadBalancingStrategy:
    | "round-robin"
    | "least-loaded"
    | "priority"
    | "fastest";
  failoverTimeout: number;
  circuitBreakerThreshold: number;
}

export interface RequestOptions {
  preferredProvider?: string;
  maxLatency?: number;
  fallbackEnabled?: boolean;
  priority?: "low" | "normal" | "high";
}

export interface PoolStatistics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  providerDistribution: Map<string, number>;
  healthyProviders: number;
  unhealthyProviders: number;
}

/**
 * Circuit breaker for provider failure handling
 */
class CircuitBreaker {
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private state: "closed" | "open" | "half-open" = "closed";

  constructor(
    private threshold: number,
    private timeout: number,
  ) {}

  recordSuccess(): void {
    this.failureCount = 0;
    this.state = "closed";
  }

  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.threshold) {
      this.state = "open";
    }
  }

  canAttempt(): boolean {
    if (this.state === "closed") return true;

    if (this.state === "open") {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = "half-open";
        return true;
      }
      return false;
    }

    return true; // half-open state
  }

  getState(): string {
    return this.state;
  }
}

/**
 * AI Provider Pool for load balancing and failover
 */
export class AIProviderPool extends EventEmitter {
  private providers: Map<string, ProviderInstance> = new Map();
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private roundRobinIndex: number = 0;
  private statistics: PoolStatistics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageResponseTime: 0,
    providerDistribution: new Map(),
    healthyProviders: 0,
    unhealthyProviders: 0,
  };

  constructor(private config: ProviderPoolConfig) {
    super();
    this.startHealthChecks();
  }

  /**
   * Register a provider in the pool
   */
  registerProvider(provider: ProviderInstance): void {
    this.providers.set(provider.id, provider);
    this.circuitBreakers.set(
      provider.id,
      new CircuitBreaker(
        this.config.circuitBreakerThreshold,
        this.config.failoverTimeout,
      ),
    );

    this.emit("provider:registered", provider);
  }

  /**
   * Execute request with automatic failover
   */
  async execute<T>(
    request: () => Promise<T>,
    options: RequestOptions = {},
  ): Promise<T> {
    this.statistics.totalRequests++;

    const availableProviders = this.getAvailableProviders(options);
    if (availableProviders.length === 0) {
      throw new Error("No available providers");
    }

    let lastError: Error | null = null;
    let attempts = 0;

    while (attempts < this.config.maxRetries && availableProviders.length > 0) {
      const provider = this.selectProvider(availableProviders, options);
      if (!provider) break;

      try {
        const startTime = Date.now();

        // Check circuit breaker
        const breaker = this.circuitBreakers.get(provider.id);
        if (!breaker?.canAttempt()) {
          availableProviders.splice(availableProviders.indexOf(provider), 1);
          continue;
        }

        // Execute request
        provider.currentLoad++;
        const result = await this.executeWithTimeout(
          request,
          options.maxLatency,
        );

        // Record success
        const responseTime = Date.now() - startTime;
        this.recordSuccess(provider, responseTime);
        breaker?.recordSuccess();

        return result;
      } catch (error) {
        lastError = error as Error;
        this.recordFailure(provider, error as Error);

        const breaker = this.circuitBreakers.get(provider.id);
        breaker?.recordFailure();

        // Remove failed provider from available list
        availableProviders.splice(availableProviders.indexOf(provider), 1);

        this.emit("provider:failed", { provider, error });

        if (options.fallbackEnabled === false) {
          throw error;
        }
      } finally {
        provider.currentLoad--;
      }

      attempts++;
    }

    this.statistics.failedRequests++;
    throw lastError || new Error("All providers failed");
  }

  /**
   * Execute with timeout
   */
  private async executeWithTimeout<T>(
    request: () => Promise<T>,
    timeout?: number,
  ): Promise<T> {
    if (!timeout) return request();

    return Promise.race([
      request(),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error("Request timeout")), timeout),
      ),
    ]);
  }

  /**
   * Get available providers based on options
   */
  private getAvailableProviders(options: RequestOptions): ProviderInstance[] {
    const providers = Array.from(this.providers.values()).filter(
      (p) => p.healthy && p.currentLoad < p.maxConcurrent,
    );

    if (options.preferredProvider) {
      const preferred = providers.find(
        (p) => p.type === options.preferredProvider,
      );
      if (preferred) {
        return [preferred, ...providers.filter((p) => p !== preferred)];
      }
    }

    return providers;
  }

  /**
   * Select provider based on load balancing strategy
   */
  private selectProvider(
    providers: ProviderInstance[],
    options: RequestOptions,
  ): ProviderInstance | null {
    if (providers.length === 0) return null;

    switch (this.config.loadBalancingStrategy) {
      case "round-robin":
        return this.selectRoundRobin(providers);

      case "least-loaded":
        return this.selectLeastLoaded(providers);

      case "priority":
        return this.selectByPriority(providers, options);

      case "fastest":
        return this.selectFastest(providers);

      default:
        return providers[0];
    }
  }

  /**
   * Round-robin selection
   */
  private selectRoundRobin(providers: ProviderInstance[]): ProviderInstance {
    const provider = providers[this.roundRobinIndex % providers.length];
    this.roundRobinIndex++;
    return provider;
  }

  /**
   * Select least loaded provider
   */
  private selectLeastLoaded(providers: ProviderInstance[]): ProviderInstance {
    return providers.reduce((prev, curr) =>
      curr.currentLoad / curr.maxConcurrent <
      prev.currentLoad / prev.maxConcurrent
        ? curr
        : prev,
    );
  }

  /**
   * Select by priority
   */
  private selectByPriority(
    providers: ProviderInstance[],
    options: RequestOptions,
  ): ProviderInstance {
    const priorityBoost = options.priority === "high" ? 10 : 0;
    return providers.sort(
      (a, b) => b.priority + priorityBoost - (a.priority + priorityBoost),
    )[0];
  }

  /**
   * Select fastest provider based on response time
   */
  private selectFastest(providers: ProviderInstance[]): ProviderInstance {
    return providers.reduce((prev, curr) => {
      const prevAvg = this.getAverageResponseTime(prev);
      const currAvg = this.getAverageResponseTime(curr);
      return currAvg < prevAvg ? curr : prev;
    });
  }

  /**
   * Get average response time for provider
   */
  private getAverageResponseTime(provider: ProviderInstance): number {
    if (provider.responseTime.length === 0) return Infinity;
    return (
      provider.responseTime.reduce((a, b) => a + b, 0) /
      provider.responseTime.length
    );
  }

  /**
   * Record successful request
   */
  private recordSuccess(
    provider: ProviderInstance,
    responseTime: number,
  ): void {
    provider.responseTime.push(responseTime);
    if (provider.responseTime.length > 100) {
      provider.responseTime.shift();
    }

    this.statistics.successfulRequests++;

    const distribution = this.statistics.providerDistribution;
    distribution.set(provider.id, (distribution.get(provider.id) || 0) + 1);

    this.updateAverageResponseTime();
    this.emit("request:success", { provider, responseTime });
  }

  /**
   * Record failed request
   */
  private recordFailure(provider: ProviderInstance, error: Error): void {
    provider.errorRate = provider.errorRate * 0.95 + 0.05;

    if (provider.errorRate > 0.5) {
      provider.healthy = false;
      this.emit("provider:unhealthy", provider);
    }

    this.emit("request:failure", { provider, error });
  }

  /**
   * Update average response time
   */
  private updateAverageResponseTime(): void {
    const allResponseTimes: number[] = [];

    for (const provider of this.providers.values()) {
      allResponseTimes.push(...provider.responseTime);
    }

    if (allResponseTimes.length > 0) {
      this.statistics.averageResponseTime =
        allResponseTimes.reduce((a, b) => a + b, 0) / allResponseTimes.length;
    }
  }

  /**
   * Perform health check on provider
   */
  private async healthCheck(provider: ProviderInstance): Promise<void> {
    try {
      const startTime = Date.now();

      // Simplified health check - would call actual provider endpoint
      const isHealthy = await this.pingProvider(provider);

      const responseTime = Date.now() - startTime;

      if (isHealthy) {
        provider.healthy = true;
        provider.errorRate = Math.max(0, provider.errorRate - 0.1);
        provider.lastHealthCheck = Date.now();

        this.emit("health:check:success", { provider, responseTime });
      } else {
        throw new Error("Health check failed");
      }
    } catch (error) {
      provider.healthy = false;
      provider.lastHealthCheck = Date.now();

      this.emit("health:check:failure", { provider, error });
    }

    this.updateHealthStatistics();
  }

  /**
   * Ping provider (simplified)
   */
  private async pingProvider(provider: ProviderInstance): Promise<boolean> {
    // This would be implemented based on provider type
    return new Promise((resolve) => {
      setTimeout(() => resolve(Math.random() > 0.1), 100);
    });
  }

  /**
   * Update health statistics
   */
  private updateHealthStatistics(): void {
    let healthy = 0;
    let unhealthy = 0;

    for (const provider of this.providers.values()) {
      if (provider.healthy) {
        healthy++;
      } else {
        unhealthy++;
      }
    }

    this.statistics.healthyProviders = healthy;
    this.statistics.unhealthyProviders = unhealthy;
  }

  /**
   * Start periodic health checks
   */
  private startHealthChecks(): void {
    setInterval(() => {
      for (const provider of this.providers.values()) {
        this.healthCheck(provider);
      }
    }, this.config.healthCheckInterval);
  }

  /**
   * Get pool statistics
   */
  getStatistics(): PoolStatistics {
    return { ...this.statistics };
  }

  /**
   * Get provider status
   */
  getProviderStatus(providerId: string): ProviderInstance | undefined {
    return this.providers.get(providerId);
  }

  /**
   * Get all providers
   */
  getAllProviders(): ProviderInstance[] {
    return Array.from(this.providers.values());
  }

  /**
   * Remove provider from pool
   */
  removeProvider(providerId: string): void {
    this.providers.delete(providerId);
    this.circuitBreakers.delete(providerId);
    this.emit("provider:removed", providerId);
  }

  /**
   * Reset pool statistics
   */
  resetStatistics(): void {
    this.statistics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      providerDistribution: new Map(),
      healthyProviders: 0,
      unhealthyProviders: 0,
    };

    for (const provider of this.providers.values()) {
      provider.responseTime = [];
      provider.errorRate = 0;
    }
  }
}

/**
 * Global provider pool instance
 */
let globalPool: AIProviderPool | null = null;

/**
 * Initialize provider pool
 */
export function initializeProviderPool(
  config?: Partial<ProviderPoolConfig>,
): AIProviderPool {
  const defaultConfig: ProviderPoolConfig = {
    maxRetries: 3,
    healthCheckInterval: 30000, // 30 seconds
    loadBalancingStrategy: "least-loaded",
    failoverTimeout: 5000, // 5 seconds
    circuitBreakerThreshold: 5,
    ...config,
  };

  globalPool = new AIProviderPool(defaultConfig);
  return globalPool;
}

/**
 * Get provider pool instance
 */
export function getProviderPool(): AIProviderPool {
  if (!globalPool) {
    return initializeProviderPool();
  }
  return globalPool;
}
