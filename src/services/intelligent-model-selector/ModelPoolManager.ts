/**
 * Model Pool Manager with hysteresis-based health monitoring
 * Handles model pool management, health tracking, and circuit breaker functionality
 */

import { EventEmitter } from 'events';
import type {
  ModelPool,
  ModelDefinition,
  ProviderHealthStatus,
  ModelHealthMetrics
} from './types/ModelPool.js';

export interface CircuitBreakerState {
  status: 'closed' | 'open' | 'half_open';
  failureCount: number;
  consecutiveSuccesses: number;
  lastFailureTime: number;
  enteredStateAt: number;
  minStayDurationMs: number;
  totalRequests: number;
  totalFailures: number;
}

export interface ModelSelectionCandidate {
  model: ModelDefinition;
  healthScore: number;
  circuitState: CircuitBreakerState;
  selectionScore: number;
  reasons: string[];
  available: boolean;
}

export interface HealthCheckResult {
  modelId: string;
  providerId: string;
  success: boolean;
  latencyMs: number;
  error?: string;
  timestamp: Date;
}

export class ModelPoolManager extends EventEmitter {
  private readonly poolCache = new Map<string, { pool: ModelPool; cachedAt: Date; version: string }>();
  private readonly healthStates = new Map<string, ProviderHealthStatus>();
  private readonly circuitBreakers = new Map<string, CircuitBreakerState>();
  private readonly healthCheckInterval = 30000; // 30 seconds
  private healthCheckTimer?: NodeJS.Timeout;

  constructor(
    private readonly firestoreClient: any,
    private readonly options: {
      circuitBreakerConfig: {
        failureThreshold: number;
        successThreshold: number;
        timeoutMs: number;
        minStayDurationMs: number;
      };
      healthCheckConfig: {
        intervalMs: number;
        timeoutMs: number;
        retryAttempts: number;
      };
    } = {
      circuitBreakerConfig: {
        failureThreshold: 5,
        successThreshold: 3,
        timeoutMs: 30000,
        minStayDurationMs: 30000
      },
      healthCheckConfig: {
        intervalMs: 30000,
        timeoutMs: 5000,
        retryAttempts: 2
      }
    }
  ) {
    super();
  }

  /**
   * Initialize the pool manager
   */
  async initialize(): Promise<void> {
    // Start health monitoring
    await this.startHealthMonitoring();
    this.emit('initialized');
  }

  /**
   * Get model pool with caching
   */
  async getModelPool(poolId: string): Promise<ModelPool> {
    const cached = this.poolCache.get(poolId);
    
    if (cached && this.isPoolCacheValid(cached)) {
      return cached.pool;
    }

    const pool = await this.loadPoolFromFirestore(poolId);
    this.updatePoolCache(poolId, pool);
    
    return pool;
  }

  /**
   * Select best available models from pool with runaway prevention
   */
  async selectModelsFromPool(
    poolId: string,
    requirements: {
      modality: string;
      maxCost: number;
      maxLatencyMs: number;
      minQualityScore: number;
      requiredCapabilities?: string[];
      excludeModels?: string[];
    },
    previousAttempts: string[] = []
  ): Promise<ModelSelectionCandidate[]> {
    const pool = await this.getModelPool(poolId);
    const candidates: ModelSelectionCandidate[] = [];

    for (const model of pool.models) {
      // Skip if already attempted (runaway prevention)
      if (previousAttempts.includes(model.id)) {
        continue;
      }

      // Skip if explicitly excluded
      if (requirements.excludeModels?.includes(model.id)) {
        continue;
      }

      // Basic filtering
      if (model.modality !== requirements.modality) {
        continue;
      }

      if (model.performance.qualityScore < requirements.minQualityScore) {
        continue;
      }

      // Check required capabilities
      if (requirements.requiredCapabilities) {
        const hasAllCapabilities = requirements.requiredCapabilities.every(cap =>
          this.modelHasCapability(model, cap)
        );
        if (!hasAllCapabilities) {
          continue;
        }
      }

      // Get health and circuit breaker state
      const healthScore = this.getModelHealthScore(model.id);
      const circuitState = this.getCircuitBreakerState(model.id);
      
      // Check if model is available (circuit breaker logic with hysteresis)
      const available = this.isModelAvailable(model.id, circuitState);

      // Calculate selection score
      const selectionScore = this.calculateSelectionScore(model, healthScore, requirements);
      const reasons = this.generateSelectionReasons(model, healthScore, circuitState, requirements);

      candidates.push({
        model,
        healthScore,
        circuitState,
        selectionScore,
        reasons,
        available
      });
    }

    // Sort by selection score (higher is better)
    candidates.sort((a, b) => b.selectionScore - a.selectionScore);

    // Emit selection event for monitoring
    this.emit('modelsSelected', {
      poolId,
      totalCandidates: pool.models.length,
      availableCandidates: candidates.filter(c => c.available).length,
      topModel: candidates.find(c => c.available)?.model.id
    });

    return candidates;
  }

  /**
   * Record model performance for health tracking
   */
  recordModelPerformance(
    modelId: string,
    result: {
      success: boolean;
      latencyMs: number;
      costUsd: number;
      error?: string;
    }
  ): void {
    const circuitState = this.getCircuitBreakerState(modelId);
    circuitState.totalRequests++;

    if (result.success) {
      this.recordSuccess(modelId, result.latencyMs, result.costUsd);
    } else {
      this.recordFailure(modelId, result.error || 'Unknown error');
    }

    this.updateProviderHealthMetrics(modelId, result);
    this.emit('performanceRecorded', { modelId, result });
  }

  /**
   * Get current health status for a model
   */
  getModelHealthScore(modelId: string): number {
    const providerId = this.extractProviderId(modelId);
    const healthStatus = this.healthStates.get(providerId);
    
    if (!healthStatus) {
      return 0.5; // Default neutral score
    }

    const modelMetrics = healthStatus.modelMetrics[modelId];
    if (!modelMetrics) {
      return healthStatus.healthScore;
    }

    // Calculate composite health score
    const successRateScore = modelMetrics.successRate;
    const latencyScore = Math.max(0, 1 - (modelMetrics.avgLatencyMs / 5000)); // Normalized to 5s
    const recentActivityScore = this.calculateRecentActivityScore(modelMetrics);
    
    return (successRateScore * 0.5 + latencyScore * 0.3 + recentActivityScore * 0.2);
  }

  /**
   * Force circuit breaker state for testing/emergency
   */
  setCircuitBreakerState(modelId: string, state: 'closed' | 'open' | 'half_open'): void {
    const circuitState = this.getCircuitBreakerState(modelId);
    circuitState.status = state;
    circuitState.enteredStateAt = Date.now();
    
    // Set appropriate min stay duration
    switch (state) {
      case 'open':
        circuitState.minStayDurationMs = this.options.circuitBreakerConfig.minStayDurationMs;
        break;
      case 'half_open':
        circuitState.minStayDurationMs = 10000; // 10 seconds
        break;
      case 'closed':
        circuitState.minStayDurationMs = 0;
        break;
    }

    this.emit('circuitBreakerStateChanged', { modelId, state });
  }

  /**
   * Get detailed health report
   */
  getHealthReport(): {
    providers: Record<string, ProviderHealthStatus>;
    circuitBreakers: Record<string, CircuitBreakerState>;
    summary: {
      totalModels: number;
      healthyModels: number;
      degradedModels: number;
      unavailableModels: number;
    };
  } {
    const providers = Object.fromEntries(this.healthStates.entries());
    const circuitBreakers = Object.fromEntries(this.circuitBreakers.entries());
    
    const allModelIds = new Set([
      ...this.healthStates.values().flatMap(h => Object.keys(h.modelMetrics)),
      ...this.circuitBreakers.keys()
    ]);

    let healthyModels = 0;
    let degradedModels = 0;
    let unavailableModels = 0;

    for (const modelId of allModelIds) {
      const healthScore = this.getModelHealthScore(modelId);
      const circuitState = this.getCircuitBreakerState(modelId);
      
      if (circuitState.status === 'open') {
        unavailableModels++;
      } else if (healthScore > 0.8) {
        healthyModels++;
      } else {
        degradedModels++;
      }
    }

    return {
      providers,
      circuitBreakers,
      summary: {
        totalModels: allModelIds.size,
        healthyModels,
        degradedModels,
        unavailableModels
      }
    };
  }

  /**
   * Private methods
   */

  private async loadPoolFromFirestore(poolId: string): Promise<ModelPool> {
    try {
      const docRef = this.firestoreClient
        .collection('ims')
        .doc('pools')
        .collection('active')
        .doc(poolId);
      
      const doc = await docRef.get();
      
      if (!doc.exists) {
        throw new Error(`Pool ${poolId} not found`);
      }

      const data = doc.data();
      return {
        ...data,
        createdAt: data.createdAt?.toDate() || new Date()
      } as ModelPool;
    } catch (error) {
      this.emit('poolLoadError', { poolId, error });
      throw error;
    }
  }

  private updatePoolCache(poolId: string, pool: ModelPool): void {
    this.poolCache.set(poolId, {
      pool,
      cachedAt: new Date(),
      version: pool.version
    });
  }

  private isPoolCacheValid(cached: { pool: ModelPool; cachedAt: Date }): boolean {
    const age = Date.now() - cached.cachedAt.getTime();
    return age < 300000; // 5 minutes
  }

  private getCircuitBreakerState(modelId: string): CircuitBreakerState {
    if (!this.circuitBreakers.has(modelId)) {
      this.circuitBreakers.set(modelId, {
        status: 'closed',
        failureCount: 0,
        consecutiveSuccesses: 0,
        lastFailureTime: 0,
        enteredStateAt: Date.now(),
        minStayDurationMs: 0,
        totalRequests: 0,
        totalFailures: 0
      });
    }
    
    return this.circuitBreakers.get(modelId)!;
  }

  private isModelAvailable(modelId: string, circuitState: CircuitBreakerState): boolean {
    const now = Date.now();
    const timeSinceStateChange = now - circuitState.enteredStateAt;
    
    switch (circuitState.status) {
      case 'closed':
        return true;
        
      case 'open':
        // Check if minimum stay duration has passed
        if (timeSinceStateChange < circuitState.minStayDurationMs) {
          return false;
        }
        // Transition to half-open
        this.transitionCircuitBreaker(modelId, 'half_open');
        return true;
        
      case 'half_open':
        // Allow limited requests in half-open state
        return Math.random() < 0.1; // 10% chance
        
      default:
        return false;
    }
  }

  private recordSuccess(modelId: string, latencyMs: number, costUsd: number): void {
    const circuitState = this.getCircuitBreakerState(modelId);
    circuitState.consecutiveSuccesses++;
    circuitState.failureCount = Math.max(0, circuitState.failureCount - 1);
    
    // Hysteresis: require multiple consecutive successes to close circuit
    if (circuitState.status === 'half_open' && 
        circuitState.consecutiveSuccesses >= this.options.circuitBreakerConfig.successThreshold) {
      this.transitionCircuitBreaker(modelId, 'closed');
    }
  }

  private recordFailure(modelId: string, error: string): void {
    const circuitState = this.getCircuitBreakerState(modelId);
    circuitState.failureCount++;
    circuitState.totalFailures++;
    circuitState.lastFailureTime = Date.now();
    circuitState.consecutiveSuccesses = 0;
    
    // Open circuit breaker if failure threshold exceeded
    if (circuitState.status === 'closed' && 
        circuitState.failureCount >= this.options.circuitBreakerConfig.failureThreshold) {
      this.transitionCircuitBreaker(modelId, 'open');
    } else if (circuitState.status === 'half_open') {
      // Any failure in half-open state reopens the circuit
      this.transitionCircuitBreaker(modelId, 'open');
    }
  }

  private transitionCircuitBreaker(modelId: string, newState: CircuitBreakerState['status']): void {
    const circuitState = this.getCircuitBreakerState(modelId);
    const oldState = circuitState.status;
    
    circuitState.status = newState;
    circuitState.enteredStateAt = Date.now();
    
    // Set minimum stay duration based on state
    switch (newState) {
      case 'open':
        circuitState.minStayDurationMs = this.options.circuitBreakerConfig.minStayDurationMs;
        break;
      case 'half_open':
        circuitState.minStayDurationMs = 10000; // 10 seconds
        break;
      case 'closed':
        circuitState.minStayDurationMs = 0;
        circuitState.failureCount = 0;
        break;
    }
    
    this.emit('circuitBreakerTransition', { 
      modelId, 
      from: oldState, 
      to: newState,
      failureCount: circuitState.failureCount,
      consecutiveSuccesses: circuitState.consecutiveSuccesses
    });
  }

  private calculateSelectionScore(
    model: ModelDefinition,
    healthScore: number,
    requirements: any
  ): number {
    const weights = {
      health: 0.4,
      latency: 0.25,
      cost: 0.2,
      quality: 0.15
    };

    // Health score (0-1)
    const healthComponent = healthScore * weights.health;
    
    // Latency score (inverse of estimated TTFB, normalized)
    const latencyScore = Math.max(0, 1 - (model.performance.estimatedTTFBMs / requirements.maxLatencyMs));
    const latencyComponent = latencyScore * weights.latency;
    
    // Cost score (inverse of cost, normalized)
    const estimatedCost = model.cost.inputTokensPPM * 0.001; // Rough estimate
    const costScore = Math.max(0, 1 - (estimatedCost / requirements.maxCost));
    const costComponent = costScore * weights.cost;
    
    // Quality score (directly from model)
    const qualityComponent = model.performance.qualityScore * weights.quality;
    
    return healthComponent + latencyComponent + costComponent + qualityComponent;
  }

  private generateSelectionReasons(
    model: ModelDefinition,
    healthScore: number,
    circuitState: CircuitBreakerState,
    requirements: any
  ): string[] {
    const reasons: string[] = [];
    
    reasons.push(`Health score: ${(healthScore * 100).toFixed(1)}%`);
    reasons.push(`Circuit breaker: ${circuitState.status}`);
    reasons.push(`Quality score: ${(model.performance.qualityScore * 100).toFixed(1)}%`);
    reasons.push(`Estimated TTFB: ${model.performance.estimatedTTFBMs}ms`);
    
    if (circuitState.totalRequests > 0) {
      const successRate = ((circuitState.totalRequests - circuitState.totalFailures) / circuitState.totalRequests) * 100;
      reasons.push(`Success rate: ${successRate.toFixed(1)}%`);
    }
    
    return reasons;
  }

  private modelHasCapability(model: ModelDefinition, capability: string): boolean {
    const capabilities = model.capabilities;
    
    switch (capability) {
      case 'function_calling':
        return capabilities.functionCalling;
      case 'tool_use':
        return capabilities.toolUse;
      case 'code_execution':
        return capabilities.codeExecution;
      case 'vision':
        return !!capabilities.vision;
      case 'audio':
        return !!capabilities.audio;
      case 'streaming':
        return capabilities.streaming;
      default:
        return false;
    }
  }

  private updateProviderHealthMetrics(modelId: string, result: any): void {
    const providerId = this.extractProviderId(modelId);
    
    if (!this.healthStates.has(providerId)) {
      this.healthStates.set(providerId, {
        providerId,
        status: 'healthy',
        healthScore: 1.0,
        latency: { p50Ms: 0, p95Ms: 0, p99Ms: 0 },
        errorRates: { last5min: 0, last1hour: 0, last24hours: 0 },
        circuitBreakerState: 'closed',
        lastCheckedAt: new Date(),
        modelMetrics: {}
      });
    }

    const healthStatus = this.healthStates.get(providerId)!;
    
    if (!healthStatus.modelMetrics[modelId]) {
      healthStatus.modelMetrics[modelId] = {
        modelId,
        requestCount: 0,
        successRate: 1.0,
        avgLatencyMs: 0,
        avgCostPerRequest: 0,
        lastSuccessAt: new Date()
      };
    }

    const metrics = healthStatus.modelMetrics[modelId];
    metrics.requestCount++;
    
    // Update success rate (exponential moving average)
    const alpha = 0.1;
    metrics.successRate = alpha * (result.success ? 1 : 0) + (1 - alpha) * metrics.successRate;
    
    // Update average latency
    metrics.avgLatencyMs = alpha * result.latencyMs + (1 - alpha) * metrics.avgLatencyMs;
    
    // Update average cost
    if (result.costUsd) {
      metrics.avgCostPerRequest = alpha * result.costUsd + (1 - alpha) * metrics.avgCostPerRequest;
    }
    
    if (result.success) {
      metrics.lastSuccessAt = new Date();
    } else if (result.error) {
      metrics.lastError = {
        timestamp: new Date(),
        errorType: 'provider_error',
        errorMessage: result.error
      };
    }

    // Update overall provider health
    this.updateProviderOverallHealth(providerId);
  }

  private updateProviderOverallHealth(providerId: string): void {
    const healthStatus = this.healthStates.get(providerId)!;
    const modelMetrics = Object.values(healthStatus.modelMetrics);
    
    if (modelMetrics.length === 0) return;
    
    // Calculate overall health score
    const avgSuccessRate = modelMetrics.reduce((sum, m) => sum + m.successRate, 0) / modelMetrics.length;
    const avgLatency = modelMetrics.reduce((sum, m) => sum + m.avgLatencyMs, 0) / modelMetrics.length;
    
    // Determine status
    if (avgSuccessRate > 0.95 && avgLatency < 2000) {
      healthStatus.status = 'healthy';
    } else if (avgSuccessRate > 0.8 && avgLatency < 5000) {
      healthStatus.status = 'degraded';
    } else {
      healthStatus.status = 'unhealthy';
    }
    
    healthStatus.healthScore = avgSuccessRate * 0.7 + Math.max(0, 1 - avgLatency / 5000) * 0.3;
    healthStatus.latency.p95Ms = avgLatency * 1.2; // Rough estimate
    healthStatus.lastCheckedAt = new Date();
  }

  private calculateRecentActivityScore(metrics: ModelHealthMetrics): number {
    const now = Date.now();
    const timeSinceLastSuccess = now - metrics.lastSuccessAt.getTime();
    const hoursSinceLastSuccess = timeSinceLastSuccess / (1000 * 60 * 60);
    
    // Score decreases with time since last success
    return Math.max(0, 1 - hoursSinceLastSuccess / 24); // Full score if within 1 hour, zero after 24 hours
  }

  private extractProviderId(modelId: string): string {
    return modelId.split(':')[0];
  }

  private async startHealthMonitoring(): Promise<void> {
    this.healthCheckTimer = setInterval(async () => {
      try {
        await this.performHealthChecks();
      } catch (error) {
        this.emit('healthCheckError', error);
      }
    }, this.options.healthCheckConfig.intervalMs);
  }

  private async performHealthChecks(): Promise<void> {
    // Implement basic health checks for all known providers
    const providers = new Set(Array.from(this.circuitBreakers.keys()).map(this.extractProviderId));
    
    for (const providerId of providers) {
      try {
        await this.checkProviderHealth(providerId);
      } catch (error) {
        this.emit('providerHealthCheckFailed', { providerId, error });
      }
    }
    
    this.emit('healthCheckCompleted', { 
      providers: providers.size,
      timestamp: new Date()
    });
  }

  private async checkProviderHealth(providerId: string): Promise<void> {
    // This would integrate with actual provider health check endpoints
    // For now, we'll just update the lastCheckedAt timestamp
    const healthStatus = this.healthStates.get(providerId);
    if (healthStatus) {
      healthStatus.lastCheckedAt = new Date();
    }
  }

  /**
   * Cleanup method
   */
  async cleanup(): Promise<void> {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }
    
    this.poolCache.clear();
    this.healthStates.clear();
    this.circuitBreakers.clear();
    
    this.emit('cleanup');
  }
}