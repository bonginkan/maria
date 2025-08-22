/**
 * MARIA CODE Health Monitoring System
 * Real-time monitoring of AI providers and system health
 */

import { EventEmitter } from 'events';
import { IAIProvider } from '../providers/ai-provider.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'critical' | 'offline';
  uptime: number; // milliseconds
  lastCheck: Date;
  responseTime: number;
  error?: string;
}

export interface ProviderHealth {
  name: string;
  type: 'local' | 'cloud';
  health: HealthStatus;
  metadata: {
    models: string[];
    endpoint?: string;
    lastRequest?: Date;
    totalRequests: number;
    errorRate: number;
    averageResponseTime: number;
  };
}

export interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'critical';
  providers: ProviderHealth[];
  recommendations: HealthRecommendation[];
  lastUpdate: Date;
  uptime: number;
}

export interface HealthRecommendation {
  type: 'warning' | 'error' | 'info' | 'action';
  message: string;
  provider?: string;
  action?: {
    type: 'restart' | 'reconfigure' | 'update' | 'contact-support';
    command?: string;
  };
}

export interface HealthCheckConfig {
  interval: number; // milliseconds
  timeout: number; // milliseconds
  retryAttempts: number;
  thresholds: {
    responseTimeWarning: number;
    responseTimeCritical: number;
    errorRateWarning: number;
    errorRateCritical: number;
  };
}

export class HealthMonitor extends EventEmitter {
  private providers: Map<string, IAIProvider> = new Map();
  private healthData: Map<string, ProviderHealth> = new Map();
  private config: HealthCheckConfig;
  private checkInterval?: NodeJS.Timeout;
  private isRunning = false;
  private startTime = Date.now();

  constructor(config?: Partial<HealthCheckConfig>) {
    super();

    this.config = {
      interval: 60000, // 1 minute
      timeout: 10000, // 10 seconds
      retryAttempts: 3,
      thresholds: {
        responseTimeWarning: 2000, // 2 seconds
        responseTimeCritical: 5000, // 5 seconds
        errorRateWarning: 0.1, // 10%
        errorRateCritical: 0.25, // 25%
      },
      ...config,
    };
  }

  /**
   * Register providers to monitor
   */
  registerProvider(name: string, provider: IAIProvider): void {
    this.providers.set(name, provider);

    // Initialize health data
    this.healthData.set(name, {
      name,
      type: this.isLocalProvider(name) ? 'local' : 'cloud',
      health: {
        status: 'offline',
        uptime: 0,
        lastCheck: new Date(),
        responseTime: 0,
      },
      metadata: {
        models: provider.getModels(),
        totalRequests: 0,
        errorRate: 0,
        averageResponseTime: 0,
      },
    });
  }

  /**
   * Start health monitoring
   */
  start(): void {
    if (this.isRunning) {return;}

    this.isRunning = true;
    this.startTime = Date.now();

    // Initial health check
    this.performHealthCheck();

    // Schedule periodic checks
    this.checkInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.config.interval);

    this.emit('monitoring-started');
  }

  /**
   * Stop health monitoring
   */
  stop(): void {
    if (!this.isRunning) {return;}

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
    }

    this.isRunning = false;
    this.emit('monitoring-stopped');
  }

  /**
   * Perform health check on all providers
   */
  private async performHealthCheck(): Promise<void> {
    const promises = Array.from(this.providers.entries()).map(([name, provider]) =>
      this.checkProviderHealth(name, provider),
    );

    await Promise.allSettled(promises);

    // Update overall system health
    const systemHealth = this.getSystemHealth();
    this.emit('health-updated', systemHealth);

    // Save health data
    await this.saveHealthData();
  }

  /**
   * Check health of individual provider
   */
  private async checkProviderHealth(name: string, provider: IAIProvider): Promise<void> {
    const startTime = Date.now();
    let attempts = 0;
    let lastError: Error | undefined;

    const currentHealth = this.healthData.get(name);
    if (!currentHealth) {return;}

    while (attempts < this.config.retryAttempts) {
      try {
        attempts++;

        // Test basic connectivity
        if (provider.validateConnection) {
          await Promise.race([
            provider.validateConnection(),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Timeout')), this.config.timeout),
            ),
          ]);
        } else {
          // Fallback: simple chat test
          await Promise.race([
            provider.chat([{ role: 'user', content: 'ping' }]),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Timeout')), this.config.timeout),
            ),
          ]);
        }

        // Success
        const responseTime = Date.now() - startTime;
        const now = new Date();

        currentHealth.health = {
          status: this.determineStatus(responseTime, currentHealth.metadata.errorRate),
          uptime: now.getTime() - startTime,
          lastCheck: now,
          responseTime,
        };

        // Update metadata
        this.updateMetrics(name, responseTime, true);

        this.emit('provider-healthy', name, currentHealth);
        break;
      } catch (error: unknown) {
        lastError = error instanceof Error ? error : new Error('Unknown error');

        if (attempts >= this.config.retryAttempts) {
          // All attempts failed
          const now = new Date();
          currentHealth.health = {
            status: 'offline',
            uptime: 0,
            lastCheck: now,
            responseTime: Date.now() - startTime,
            error: lastError.message,
          };

          this.updateMetrics(name, Date.now() - startTime, false);
          this.emit('provider-unhealthy', name, currentHealth, lastError);
        } else {
          // Retry
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempts));
        }
      }
    }

    this.healthData.set(name, currentHealth);
  }

  /**
   * Determine status based on response time and error rate
   */
  private determineStatus(responseTime: number, errorRate: number): HealthStatus['status'] {
    if (
      responseTime > this.config.thresholds.responseTimeCritical ||
      errorRate > this.config.thresholds.errorRateCritical
    ) {
      return 'critical';
    }

    if (
      responseTime > this.config.thresholds.responseTimeWarning ||
      errorRate > this.config.thresholds.errorRateWarning
    ) {
      return 'degraded';
    }

    return 'healthy';
  }

  /**
   * Update provider metrics
   */
  private updateMetrics(name: string, responseTime: number, success: boolean): void {
    const health = this.healthData.get(name);
    if (!health) {return;}

    const metadata = health.metadata;
    metadata.totalRequests++;

    // Update average response time
    metadata.averageResponseTime =
      (metadata.averageResponseTime * (metadata.totalRequests - 1) + responseTime) /
      metadata.totalRequests;

    // Update error rate
    const errorCount = Math.round(metadata.errorRate * (metadata.totalRequests - 1));
    const newErrorCount = errorCount + (success ? 0 : 1);
    metadata.errorRate = newErrorCount / metadata.totalRequests;

    metadata.lastRequest = new Date();
  }

  /**
   * Get overall system health
   */
  getSystemHealth(): SystemHealth {
    const providers = Array.from(this.healthData.values());
    const recommendations: HealthRecommendation[] = [];

    // Determine overall status
    let overall: SystemHealth['overall'] = 'healthy';

    const offlineProviders = providers.filter((p) => p.health.status === 'offline');
    const criticalProviders = providers.filter((p) => p.health.status === 'critical');
    const degradedProviders = providers.filter((p) => p.health.status === 'degraded');

    if (offlineProviders.length === providers.length) {
      overall = 'critical';
      recommendations.push({
        type: 'error',
        message: 'All providers are offline. Check your internet connection and API keys.',
        action: { type: 'reconfigure' },
      });
    } else if (criticalProviders.length > 0 || offlineProviders.length > providers.length / 2) {
      overall = 'critical';
    } else if (degradedProviders.length > 0) {
      overall = 'degraded';
    }

    // Generate recommendations
    recommendations.push(...this.generateRecommendations(providers));

    return {
      overall,
      providers,
      recommendations,
      lastUpdate: new Date(),
      uptime: Date.now() - this.startTime,
    };
  }

  /**
   * Generate health recommendations
   */
  private generateRecommendations(providers: ProviderHealth[]): HealthRecommendation[] {
    const recommendations: HealthRecommendation[] = [];

    for (const provider of providers) {
      const { name, health, metadata } = provider;

      // Offline provider
      if (health.status === 'offline') {
        if (provider.type === 'local') {
          recommendations.push({
            type: 'action',
            provider: name,
            message: `${name} is offline. Try restarting the local server.`,
            action: {
              type: 'restart',
              command: this.getRestartCommand(name),
            },
          });
        } else {
          recommendations.push({
            type: 'warning',
            provider: name,
            message: `${name} is offline. Check API key and network connectivity.`,
          });
        }
      }

      // High response time
      if (health.responseTime > this.config.thresholds.responseTimeCritical) {
        recommendations.push({
          type: 'warning',
          provider: name,
          message: `${name} has very high response time (${health.responseTime}ms). Consider switching to a faster provider.`,
        });
      }

      // High error rate
      if (metadata.errorRate > this.config.thresholds.errorRateWarning) {
        recommendations.push({
          type: 'warning',
          provider: name,
          message: `${name} has high error rate (${(metadata.errorRate * 100).toFixed(1)}%). Check configuration and quotas.`,
        });
      }

      // No models available
      if (metadata.models.length === 0) {
        recommendations.push({
          type: 'info',
          provider: name,
          message: `${name} has no models configured. Add models to enable functionality.`,
          action: { type: 'reconfigure' },
        });
      }
    }

    // General recommendations
    const healthyProviders = providers.filter((p) => p.health.status === 'healthy');
    if (healthyProviders.length === 0) {
      recommendations.push({
        type: 'error',
        message: 'No healthy providers available. System functionality is severely limited.',
        action: { type: 'contact-support' },
      });
    } else if (healthyProviders.length === 1) {
      recommendations.push({
        type: 'info',
        message:
          'Only one healthy provider available. Consider setting up additional providers for redundancy.',
      });
    }

    return recommendations;
  }

  /**
   * Get restart command for local provider
   */
  private getRestartCommand(providerName: string): string {
    switch (providerName) {
      case 'lmstudio':
        return 'open -a "LM Studio"';
      case 'ollama':
        return 'ollama serve';
      case 'vllm':
        return 'python -m vllm.entrypoints.api_server';
      default:
        return `# Restart ${providerName} manually`;
    }
  }

  /**
   * Save health data to disk
   */
  private async saveHealthData(): Promise<void> {
    try {
      const healthDir = join(homedir(), '.maria', 'health');
      await fs.mkdir(healthDir, { recursive: true });

      const systemHealth = this.getSystemHealth();
      const healthFile = join(healthDir, 'system-health.json');

      await fs.writeFile(
        healthFile,
        JSON.stringify(
          {
            ...systemHealth,
            config: this.config,
          },
          null,
          2,
        ),
      );
    } catch (error: unknown) {
      this.emit('error', new Error(`Failed to save health data: ${error}`));
    }
  }

  /**
   * Load health data from disk
   */
  async loadHealthData(): Promise<SystemHealth | null> {
    try {
      const healthFile = join(homedir(), '.maria', 'health', 'system-health.json');
      const data = await fs.readFile(healthFile, 'utf8');
      const parsed = JSON.parse(data) as Record<string, unknown>;

      return {
        overall: parsed['overall'] as 'healthy' | 'degraded' | 'critical',
        providers: parsed['providers'] as ProviderHealth[],
        recommendations: parsed['recommendations'] as HealthRecommendation[],
        lastUpdate: new Date(parsed['lastUpdate'] as string),
        uptime: parsed['uptime'] as number,
      };
    } catch {
      return null;
    }
  }

  /**
   * Get provider health status
   */
  getProviderHealth(name: string): ProviderHealth | null {
    return this.healthData.get(name) || null;
  }

  /**
   * Get all provider health data
   */
  getAllProviderHealth(): ProviderHealth[] {
    return Array.from(this.healthData.values());
  }

  /**
   * Check if provider is local
   */
  private isLocalProvider(name: string): boolean {
    return ['lmstudio', 'ollama', 'vllm'].includes(name);
  }

  /**
   * Update monitoring configuration
   */
  updateConfig(config: Partial<HealthCheckConfig>): void {
    this.config = { ...this.config, ...config };

    // Restart monitoring with new config
    if (this.isRunning) {
      this.stop();
      this.start();
    }
  }

  /**
   * Force health check
   */
  async forceHealthCheck(): Promise<SystemHealth> {
    await this.performHealthCheck();
    return this.getSystemHealth();
  }

  /**
   * Get monitoring statistics
   */
  getStatistics(): Record<string, unknown> {
    const providers = Array.from(this.healthData.values());

    return {
      totalProviders: providers.length,
      healthyProviders: providers.filter((p) => p.health.status === 'healthy').length,
      degradedProviders: providers.filter((p) => p.health.status === 'degraded').length,
      criticalProviders: providers.filter((p) => p.health.status === 'critical').length,
      offlineProviders: providers.filter((p) => p.health.status === 'offline').length,
      totalRequests: providers.reduce((sum, p) => sum + p.metadata.totalRequests, 0),
      averageResponseTime:
        providers.reduce((sum, p) => sum + p.metadata.averageResponseTime, 0) / providers.length ||
        0,
      averageErrorRate:
        providers.reduce((sum, p) => sum + p.metadata.errorRate, 0) / providers.length || 0,
      uptime: Date.now() - this.startTime,
      isRunning: this.isRunning,
    };
  }
}

export default HealthMonitor;
