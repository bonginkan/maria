/**
 * Provider Health Monitor v1.0
 * Real-time health monitoring for AI providers
 * Phase 2 implementation
 */

import type { ProviderId } from '../../../providers/config';
import type { ProviderHealth } from '../../../providers/config';
import { UnifiedAIProviderManager } from '../../../providers/manager';
import { FirestoreHealthStatusDocument } from '../schemas/FirestoreSchemas';

export interface HealthMonitorConfig {
  providerManager: UnifiedAIProviderManager;
  checkIntervalMs?: number;
  timeoutMs?: number;
  failureThreshold?: number;
  successThreshold?: number;
  enableAutoRecovery?: boolean;
  firestoreEnabled?: boolean;
}

export interface ProviderHealthStatus {
  providerId: ProviderId;
  modelId: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  metrics: HealthMetrics;
  lastCheck: number;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  circuitBreakerState: 'closed' | 'open' | 'half_open';
}

export interface HealthMetrics {
  latencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  successRate: number;
  requestCount: number;
  errorCount: number;
  avgTokensPerSecond: number;
}

export class ProviderHealthMonitor {
  private readonly config: Required<HealthMonitorConfig>;
  private readonly healthStatus = new Map<string, ProviderHealthStatus>();
  private readonly metricsHistory = new Map<string, HealthMetrics[]>();
  private checkInterval?: NodeJS.Timeout;
  private isRunning = false;

  constructor(config: HealthMonitorConfig) {
    this.config = {
      providerManager: config.providerManager,
      checkIntervalMs: config.checkIntervalMs ?? 30000, // 30 seconds
      timeoutMs: config.timeoutMs ?? 5000, // 5 seconds
      failureThreshold: config.failureThreshold ?? 3,
      successThreshold: config.successThreshold ?? 2,
      enableAutoRecovery: config.enableAutoRecovery ?? true,
      firestoreEnabled: config.firestoreEnabled ?? false
    };
  }

  /**
   * Start health monitoring
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    
    // Initial health check
    await this.checkAllProviders();
    
    // Schedule periodic checks
    this.checkInterval = setInterval(
      () => this.checkAllProviders(),
      this.config.checkIntervalMs
    );
  }

  /**
   * Stop health monitoring
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
    }
    this.isRunning = false;
  }

  /**
   * Check health of all registered providers
   */
  private async checkAllProviders(): Promise<void> {
    const providers = this.getRegisteredProviders();
    
    await Promise.all(
      providers.map(providerId => this.checkProvider(providerId))
    );
  }

  /**
   * Check health of a specific provider
   */
  async checkProvider(providerId: ProviderId): Promise<ProviderHealthStatus> {
    const startTime = Date.now();
    const modelId = `${providerId}:default`;
    
    try {
      const provider = this.config.providerManager.getProvider(providerId);
      
      if (!provider) {
        return this.updateHealthStatus(modelId, {
          providerId,
          modelId,
          status: 'unknown',
          metrics: this.getDefaultMetrics(),
          lastCheck: Date.now(),
          consecutiveFailures: 0,
          consecutiveSuccesses: 0,
          circuitBreakerState: 'closed'
        });
      }

      // Perform health check with timeout
      const healthPromise = provider.health();
      const timeoutPromise = new Promise<ProviderHealth>((_, reject) => {
        setTimeout(() => reject(new Error('Health check timeout')), this.config.timeoutMs);
      });

      const health = await Promise.race([healthPromise, timeoutPromise]) as ProviderHealth;
      const latencyMs = Date.now() - startTime;

      // Update metrics
      const metrics = await this.calculateMetrics(modelId, health, latencyMs);
      
      // Determine status based on health check
      const status = this.determineStatus(health, metrics);
      
      // Get current status for consecutive counters
      const currentStatus = this.healthStatus.get(modelId);
      let consecutiveFailures = currentStatus?.consecutiveFailures ?? 0;
      let consecutiveSuccesses = currentStatus?.consecutiveSuccesses ?? 0;
      
      if (health.ok) {
        consecutiveSuccesses++;
        consecutiveFailures = 0;
      } else {
        consecutiveFailures++;
        consecutiveSuccesses = 0;
      }

      // Determine circuit breaker state
      const circuitBreakerState = this.determineCircuitBreakerState(
        consecutiveFailures,
        consecutiveSuccesses,
        currentStatus?.circuitBreakerState ?? 'closed'
      );

      const newStatus: ProviderHealthStatus = {
        providerId,
        modelId,
        status,
        metrics,
        lastCheck: Date.now(),
        consecutiveFailures,
        consecutiveSuccesses,
        circuitBreakerState
      };

      return this.updateHealthStatus(modelId, newStatus);
    } catch (error) {
      // Health check failed
      const currentStatus = this.healthStatus.get(modelId);
      const consecutiveFailures = (currentStatus?.consecutiveFailures ?? 0) + 1;
      
      const newStatus: ProviderHealthStatus = {
        providerId,
        modelId,
        status: 'unhealthy',
        metrics: this.getDefaultMetrics(),
        lastCheck: Date.now(),
        consecutiveFailures,
        consecutiveSuccesses: 0,
        circuitBreakerState: consecutiveFailures >= this.config.failureThreshold ? 'open' : 'closed'
      };

      return this.updateHealthStatus(modelId, newStatus);
    }
  }

  /**
   * Calculate metrics from health check
   */
  private async calculateMetrics(
    modelId: string,
    health: ProviderHealth,
    latencyMs: number
  ): Promise<HealthMetrics> {
    // Get historical metrics
    const history = this.metricsHistory.get(modelId) ?? [];
    
    // Add current latency to history
    const newMetric: HealthMetrics = {
      latencyMs,
      p95LatencyMs: latencyMs, // Will be calculated from history
      p99LatencyMs: latencyMs, // Will be calculated from history
      successRate: health.ok ? 1 : 0,
      requestCount: 1,
      errorCount: health.ok ? 0 : 1,
      avgTokensPerSecond: 0 // Would need actual token metrics
    };

    history.push(newMetric);
    
    // Keep only last 100 data points
    if (history.length > 100) {
      history.shift();
    }
    
    this.metricsHistory.set(modelId, history);
    
    // Calculate aggregated metrics
    const latencies = history.map(h => h.latencyMs).sort((a, b) => a - b);
    const p95Index = Math.floor(latencies.length * 0.95);
    const p99Index = Math.floor(latencies.length * 0.99);
    
    const successCount = history.filter(h => h.successRate > 0).length;
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    
    return {
      latencyMs: avgLatency,
      p95LatencyMs: latencies[p95Index] ?? latencyMs,
      p99LatencyMs: latencies[p99Index] ?? latencyMs,
      successRate: successCount / history.length,
      requestCount: history.length,
      errorCount: history.length - successCount,
      avgTokensPerSecond: 0
    };
  }

  /**
   * Determine status based on health and metrics
   */
  private determineStatus(
    health: ProviderHealth,
    metrics: HealthMetrics
  ): 'healthy' | 'degraded' | 'unhealthy' | 'unknown' {
    if (!health.ok) {
      return 'unhealthy';
    }
    
    // Check for degraded conditions
    if (metrics.successRate < 0.95) {
      return 'degraded';
    }
    
    if (metrics.p95LatencyMs > 5000) {
      return 'degraded';
    }
    
    if (metrics.errorCount > 5) {
      return 'degraded';
    }
    
    return 'healthy';
  }

  /**
   * Determine circuit breaker state
   */
  private determineCircuitBreakerState(
    consecutiveFailures: number,
    consecutiveSuccesses: number,
    currentState: 'closed' | 'open' | 'half_open'
  ): 'closed' | 'open' | 'half_open' {
    // Open circuit if too many failures
    if (consecutiveFailures >= this.config.failureThreshold) {
      return 'open';
    }
    
    // If circuit is open and we have auto-recovery enabled
    if (currentState === 'open' && this.config.enableAutoRecovery) {
      // Move to half-open to test recovery
      return 'half_open';
    }
    
    // If half-open and we have enough successes, close the circuit
    if (currentState === 'half_open' && consecutiveSuccesses >= this.config.successThreshold) {
      return 'closed';
    }
    
    // If half-open but failed again, reopen
    if (currentState === 'half_open' && consecutiveFailures > 0) {
      return 'open';
    }
    
    return 'closed';
  }

  /**
   * Update health status and optionally persist to Firestore
   */
  private async updateHealthStatus(
    modelId: string,
    status: ProviderHealthStatus
  ): Promise<ProviderHealthStatus> {
    this.healthStatus.set(modelId, status);
    
    // Persist to Firestore if enabled
    if (this.config.firestoreEnabled) {
      await this.persistToFirestore(status);
    }
    
    return status;
  }

  /**
   * Persist health status to Firestore
   */
  private async persistToFirestore(status: ProviderHealthStatus): Promise<void> {
    // This would integrate with actual Firestore
    // For now, just a placeholder
    const doc: Partial<FirestoreHealthStatusDocument> = {
      modelId: status.modelId,
      status: status.status,
      circuitBreakerState: status.circuitBreakerState,
      metrics: {
        avgLatencyMs: status.metrics.latencyMs,
        p95LatencyMs: status.metrics.p95LatencyMs,
        p99LatencyMs: status.metrics.p99LatencyMs,
        successRate: status.metrics.successRate,
        requestCount: status.metrics.requestCount,
        errorCount: status.metrics.errorCount,
        avgTokensPerSecond: status.metrics.avgTokensPerSecond
      }
    };
    
    // Firestore write would happen here
    console.log('Would persist to Firestore:', doc);
  }

  /**
   * Get default metrics for failed checks
   */
  private getDefaultMetrics(): HealthMetrics {
    return {
      latencyMs: 0,
      p95LatencyMs: 0,
      p99LatencyMs: 0,
      successRate: 0,
      requestCount: 0,
      errorCount: 1,
      avgTokensPerSecond: 0
    };
  }

  /**
   * Get list of registered providers
   */
  private getRegisteredProviders(): ProviderId[] {
    // This would get from provider manager
    // For now, return common providers
    return [
      'openai',
      'anthropic',
      'google',
      'groq',
      'grok',
      'ollama',
      'lmstudio',
      'vllm'
    ] as ProviderId[];
  }

  /**
   * Get current health status for a model
   */
  getHealthStatus(modelId: string): ProviderHealthStatus | undefined {
    return this.healthStatus.get(modelId);
  }

  /**
   * Get all health statuses
   */
  getAllHealthStatuses(): Map<string, ProviderHealthStatus> {
    return new Map(this.healthStatus);
  }

  /**
   * Check if a model is healthy
   */
  isHealthy(modelId: string): boolean {
    const status = this.healthStatus.get(modelId);
    return status?.status === 'healthy' && status?.circuitBreakerState === 'closed';
  }

  /**
   * Force refresh health check for specific provider
   */
  async refreshProvider(providerId: ProviderId): Promise<ProviderHealthStatus> {
    return this.checkProvider(providerId);
  }

  /**
   * Reset circuit breaker for a model
   */
  resetCircuitBreaker(modelId: string): void {
    const status = this.healthStatus.get(modelId);
    if (status) {
      status.circuitBreakerState = 'closed';
      status.consecutiveFailures = 0;
      status.consecutiveSuccesses = 0;
      this.healthStatus.set(modelId, status);
    }
  }

  /**
   * Get health report
   */
  getHealthReport(): {
    healthy: string[];
    degraded: string[];
    unhealthy: string[];
    unknown: string[];
    summary: {
      total: number;
      healthyCount: number;
      degradedCount: number;
      unhealthyCount: number;
      unknownCount: number;
      healthPercentage: number;
    };
  } {
    const healthy: string[] = [];
    const degraded: string[] = [];
    const unhealthy: string[] = [];
    const unknown: string[] = [];
    
    for (const [modelId, status] of this.healthStatus) {
      switch (status.status) {
        case 'healthy':
          healthy.push(modelId);
          break;
        case 'degraded':
          degraded.push(modelId);
          break;
        case 'unhealthy':
          unhealthy.push(modelId);
          break;
        case 'unknown':
          unknown.push(modelId);
          break;
      }
    }
    
    const total = this.healthStatus.size;
    const healthyCount = healthy.length;
    const degradedCount = degraded.length;
    const unhealthyCount = unhealthy.length;
    const unknownCount = unknown.length;
    
    return {
      healthy,
      degraded,
      unhealthy,
      unknown,
      summary: {
        total,
        healthyCount,
        degradedCount,
        unhealthyCount,
        unknownCount,
        healthPercentage: total > 0 ? (healthyCount / total) * 100 : 0
      }
    };
  }
}