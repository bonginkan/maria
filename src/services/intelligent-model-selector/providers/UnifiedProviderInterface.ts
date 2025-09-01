/**
 * Unified Provider Interface - Standardizes interaction with AI providers
 * Provides consistent API across different providers with error handling and monitoring
 */

import { EventEmitter } from 'events';
import type { TaskInput } from '../types/TaskInput.js';
import type { HysteresisHealthChecker } from '../HysteresisHealthChecker.js';
import type { RunawayPreventionCircuitBreaker } from '../RunawayPreventionCircuitBreaker.js';

export interface ProviderConfig {
  id: string;
  name: string;
  endpoint: string;
  apiKey: string;
  models: string[];
  capabilities: string[];
  rateLimit: {
    requestsPerMinute: number;
    tokensPerMinute: number;
    concurrent: number;
  };
  pricing: {
    inputTokenPrice: number;
    outputTokenPrice: number;
    currency: string;
  };
  healthCheckEndpoint?: string;
  timeoutMs: number;
  retryConfig: {
    maxRetries: number;
    backoffMs: number;
    retryableStatusCodes: number[];
  };
}

export interface ProviderRequest {
  taskInput: TaskInput;
  modelId: string;
  generationParams: {
    temperature: number;
    topP: number;
    maxTokens: number;
    seed?: number;
    stop?: string[];
  };
  streamingEnabled: boolean;
}

export interface ProviderResponse {
  success: boolean;
  data?: {
    content: string;
    model: string;
    usage: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
    finishReason: string;
    metadata?: any;
  };
  error?: {
    code: string;
    message: string;
    statusCode: number;
    retryable: boolean;
    rateLimited: boolean;
  };
  metrics: {
    latencyMs: number;
    ttfbMs: number;
    tokensPerSecond: number;
    costUsd: number;
  };
  headers: Record<string, string>;
}

export interface ProviderHealth {
  providerId: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latencyP95Ms: number;
  errorRate5Min: number;
  availableModels: string[];
  unavailableModels: string[];
  lastHealthCheck: Date;
  healthScore: number; // 0-1
}

export class UnifiedProviderInterface extends EventEmitter {
  private readonly providers = new Map<string, ProviderAdapter>();
  private readonly providerConfigs = new Map<string, ProviderConfig>();
  
  constructor(
    private readonly dependencies: {
      healthChecker: HysteresisHealthChecker;
      circuitBreaker: RunawayPreventionCircuitBreaker;
    }
  ) {
    super();
    
    // Start health monitoring
    setInterval(() => this.performHealthChecks(), 30000); // Every 30 seconds
  }

  /**
   * Register a provider with its configuration
   */
  registerProvider(config: ProviderConfig, adapter: ProviderAdapter): void {
    this.providerConfigs.set(config.id, config);
    this.providers.set(config.id, adapter);
    
    adapter.on('response', (metrics) => this.recordProviderMetrics(config.id, metrics));
    adapter.on('error', (error) => this.recordProviderError(config.id, error));
    
    this.emit('providerRegistered', { providerId: config.id, models: config.models });
  }

  /**
   * Execute request through provider with circuit breaker protection
   */
  async executeRequest(
    providerId: string,
    modelId: string,
    request: ProviderRequest
  ): Promise<ProviderResponse> {
    const provider = this.providers.get(providerId);
    const config = this.providerConfigs.get(providerId);
    
    if (!provider || !config) {
      throw new Error(`Provider not found: ${providerId}`);
    }

    // Check circuit breaker
    const circuitState = this.dependencies.circuitBreaker.getCircuitState(`${providerId}:${modelId}`);
    if (circuitState.status === 'open') {
      const error = new Error(`Circuit breaker open for ${providerId}:${modelId}`);
      (error as any).code = 'CIRCUIT_BREAKER_OPEN';
      (error as any).retryable = false;
      throw error;
    }

    const startTime = Date.now();
    let ttfbMs = 0;
    
    try {
      // Execute request with timeout and monitoring
      const response = await Promise.race([
        this.executeWithMonitoring(provider, request, providerId, modelId),
        this.timeoutPromise(config.timeoutMs)
      ]);

      ttfbMs = Date.now() - startTime;
      
      // Record success
      this.dependencies.circuitBreaker.recordSuccess(`${providerId}:${modelId}`, request.taskInput.traceId);
      this.dependencies.healthChecker.recordMetric(providerId, { value: 0.9 }, modelId);
      
      // Calculate metrics
      const metrics = this.calculateResponseMetrics(response, startTime, ttfbMs, request);
      
      return {
        success: true,
        data: response,
        metrics,
        headers: response.headers || {}
      };

    } catch (error: any) {
      const errorInfo = this.normalizeError(error);
      
      // Record failure
      this.dependencies.circuitBreaker.recordFailure(
        `${providerId}:${modelId}`,
        errorInfo.message,
        request.taskInput.traceId
      );
      
      const healthValue = errorInfo.retryable ? 0.3 : 0.1; // Temporary vs permanent failures
      this.dependencies.healthChecker.recordMetric(providerId, { value: healthValue }, modelId);

      return {
        success: false,
        error: errorInfo,
        metrics: {
          latencyMs: Date.now() - startTime,
          ttfbMs: ttfbMs || Date.now() - startTime,
          tokensPerSecond: 0,
          costUsd: 0
        },
        headers: error.headers || {}
      };
    }
  }

  /**
   * Get all available providers and their health status
   */
  async getProviderHealth(): Promise<ProviderHealth[]> {
    const healthResults: ProviderHealth[] = [];
    
    for (const [providerId, config] of this.providerConfigs.entries()) {
      const assessment = this.dependencies.healthChecker.getHealthAssessment(providerId);
      
      const health: ProviderHealth = {
        providerId,
        status: assessment?.healthState.status || 'healthy',
        latencyP95Ms: assessment?.healthState.metricHistory
          .map(m => m.value * 1000) // Convert to ms
          .sort((a, b) => a - b)[Math.floor(assessment.healthState.metricHistory.length * 0.95)] || 1000,
        errorRate5Min: this.calculateRecentErrorRate(providerId),
        availableModels: config.models.filter(m => this.isModelAvailable(providerId, m)),
        unavailableModels: config.models.filter(m => !this.isModelAvailable(providerId, m)),
        lastHealthCheck: new Date(),
        healthScore: assessment?.healthState.score || 1.0
      };
      
      healthResults.push(health);
    }
    
    return healthResults;
  }

  /**
   * Stream response with adaptive quality control
   */
  async *streamResponse(
    providerId: string,
    modelId: string,
    request: ProviderRequest
  ): AsyncGenerator<{ type: 'token' | 'error' | 'done'; data: any }> {
    const provider = this.providers.get(providerId);
    
    if (!provider) {
      yield { type: 'error', data: { code: 'PROVIDER_NOT_FOUND', message: `Provider ${providerId} not found` } };
      return;
    }

    try {
      const streamRequest = { ...request, streamingEnabled: true };
      const stream = await provider.streamRequest(streamRequest);
      
      for await (const chunk of stream) {
        // Record metrics for each chunk
        this.recordStreamingMetrics(providerId, modelId, chunk);
        yield { type: 'token', data: chunk };
      }
      
      yield { type: 'done', data: { providerId, modelId } };
      
    } catch (error) {
      const errorInfo = this.normalizeError(error);
      yield { type: 'error', data: errorInfo };
    }
  }

  /**
   * Get specific provider configuration (sanitized)
   */
  getProviderConfig(providerId: string): Partial<ProviderConfig> | null {
    const config = this.providerConfigs.get(providerId);
    if (!config) return null;

    // Return sanitized config without sensitive data
    return {
      id: config.id,
      name: config.name,
      models: config.models,
      capabilities: config.capabilities,
      rateLimit: config.rateLimit,
      pricing: config.pricing
    };
  }

  /**
   * Validate provider request before execution
   */
  validateRequest(providerId: string, modelId: string, request: ProviderRequest): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    const config = this.providerConfigs.get(providerId);
    
    if (!config) {
      errors.push(`Provider ${providerId} not configured`);
      return { valid: false, errors };
    }

    // Model availability check
    if (!config.models.includes(modelId)) {
      errors.push(`Model ${modelId} not supported by provider ${providerId}`);
    }

    // Rate limit check (simplified)
    if (request.generationParams.maxTokens > 32000) {
      errors.push('Maximum token limit exceeded');
    }

    // Task compatibility check
    const requiredCapability = this.getRequiredCapability(request.taskInput.task.kind);
    if (!config.capabilities.includes(requiredCapability)) {
      errors.push(`Provider ${providerId} does not support ${requiredCapability}`);
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Private methods
   */

  private async executeWithMonitoring(
    provider: ProviderAdapter,
    request: ProviderRequest,
    providerId: string,
    modelId: string
  ): Promise<any> {
    // Add monitoring metadata to request
    const monitoredRequest = {
      ...request,
      metadata: {
        ...request.metadata,
        providerId,
        modelId,
        startTime: Date.now(),
        traceId: request.taskInput.traceId
      }
    };

    return await provider.executeRequest(monitoredRequest);
  }

  private timeoutPromise(timeoutMs: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        const error = new Error(`Request timeout after ${timeoutMs}ms`);
        (error as any).code = 'TIMEOUT';
        (error as any).retryable = true;
        reject(error);
      }, timeoutMs);
    });
  }

  private normalizeError(error: any): ProviderResponse['error'] {
    return {
      code: error.code || 'UNKNOWN_ERROR',
      message: error.message || 'Unknown error occurred',
      statusCode: error.statusCode || 500,
      retryable: this.isRetryableError(error),
      rateLimited: this.isRateLimitError(error)
    };
  }

  private isRetryableError(error: any): boolean {
    const retryableCodes = ['TIMEOUT', 'CONNECTION_ERROR', 'SERVER_ERROR'];
    const retryableStatusCodes = [429, 500, 502, 503, 504];
    
    return retryableCodes.includes(error.code) || 
           retryableStatusCodes.includes(error.statusCode);
  }

  private isRateLimitError(error: any): boolean {
    return error.statusCode === 429 || 
           error.code === 'RATE_LIMIT_EXCEEDED' ||
           (error.message && error.message.toLowerCase().includes('rate limit'));
  }

  private calculateResponseMetrics(
    response: any,
    startTime: number,
    ttfbMs: number,
    request: ProviderRequest
  ): ProviderResponse['metrics'] {
    const totalLatency = Date.now() - startTime;
    const tokensPerSecond = response.usage?.totalTokens 
      ? response.usage.totalTokens / (totalLatency / 1000)
      : 0;
    
    // Rough cost calculation
    const inputCost = (response.usage?.promptTokens || 0) * 0.0005 / 1000;
    const outputCost = (response.usage?.completionTokens || 0) * 0.0015 / 1000;
    
    return {
      latencyMs: totalLatency,
      ttfbMs,
      tokensPerSecond,
      costUsd: inputCost + outputCost
    };
  }

  private calculateRecentErrorRate(providerId: string): number {
    // This would calculate from recent metrics
    // For now, return a mock value
    return 0.05; // 5% error rate
  }

  private isModelAvailable(providerId: string, modelId: string): boolean {
    const circuitState = this.dependencies.circuitBreaker.getCircuitState(`${providerId}:${modelId}`);
    return circuitState.status !== 'open';
  }

  private getRequiredCapability(taskKind: string): string {
    const capabilityMap: Record<string, string> = {
      'chat': 'text-generation',
      'code': 'code-generation',
      'image': 'image-generation',
      'audio': 'audio-generation'
    };
    
    return capabilityMap[taskKind] || 'text-generation';
  }

  private recordProviderMetrics(providerId: string, metrics: any): void {
    this.emit('providerMetrics', { providerId, metrics });
  }

  private recordProviderError(providerId: string, error: any): void {
    this.emit('providerError', { providerId, error });
  }

  private recordStreamingMetrics(providerId: string, modelId: string, chunk: any): void {
    this.emit('streamingMetrics', { providerId, modelId, chunk });
  }

  private async performHealthChecks(): Promise<void> {
    for (const [providerId, config] of this.providerConfigs.entries()) {
      try {
        const healthScore = await this.checkProviderHealth(providerId, config);
        this.dependencies.healthChecker.recordMetric(providerId, { value: healthScore });
      } catch (error) {
        this.dependencies.healthChecker.recordMetric(providerId, { value: 0.1 });
      }
    }
  }

  private async checkProviderHealth(providerId: string, config: ProviderConfig): Promise<number> {
    if (!config.healthCheckEndpoint) {
      return 0.8; // Assume healthy if no health check endpoint
    }

    try {
      const startTime = Date.now();
      // Mock health check - would make actual HTTP request
      await new Promise(resolve => setTimeout(resolve, 50));
      const latency = Date.now() - startTime;
      
      // Score based on latency: <100ms = 1.0, <500ms = 0.8, >500ms = 0.5
      if (latency < 100) return 1.0;
      if (latency < 500) return 0.8;
      return 0.5;
      
    } catch (error) {
      return 0.1;
    }
  }

  /**
   * Cleanup method
   */
  cleanup(): void {
    for (const provider of this.providers.values()) {
      if (provider.cleanup) {
        provider.cleanup();
      }
    }
    
    this.providers.clear();
    this.providerConfigs.clear();
    this.emit('cleanup');
  }
}

/**
 * Abstract base class for provider adapters
 */
export abstract class ProviderAdapter extends EventEmitter {
  constructor(protected config: ProviderConfig) {
    super();
  }

  abstract executeRequest(request: ProviderRequest): Promise<any>;
  abstract streamRequest(request: ProviderRequest): AsyncIterable<any>;
  
  cleanup?(): void;
}