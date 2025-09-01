/**
 * Feature Flag Controller for Gradual SystemCommand Rollout
 *
 * SOW Phase 3.3 v2.1 Week 5-6 Implementation:
 * - Progressive rollout: 25% → 50% → 75% → 100%
 * - A/B testing with statistical significance
 * - Automatic rollback on performance degradation
 * - Real-time health monitoring
 * - User-based and command-based targeting
 */

import { logger } from "../../../utils/logger";
import { systemCommandMetrics } from "../monitoring/MetricsCollector";
import crypto from "crypto";

export interface FeatureFlagConfig {
  rolloutPercentage: number; // 0-100, current rollout percentage
  targetingStrategy: "user" | "command" | "session" | "random";
  enabledCommands: string[]; // Specific commands enabled for V2
  disabledCommands: string[]; // Commands forced to V1
  healthThresholds: HealthThresholds;
  rollbackSettings: RollbackSettings;
  testingConfig: ABTestConfig;
}

export interface HealthThresholds {
  maxErrorRate: number; // 0-1, trigger rollback if exceeded
  maxLatencyMs: number; // Max acceptable latency
  minSuccessRate: number; // 0-1, minimum success rate
  maxMemoryGrowthMB: number; // Max memory increase
  evaluationWindowMs: number; // Health check window
}

export interface RollbackSettings {
  enabled: boolean;
  autoRollbackOnFailure: boolean;
  manualApprovalRequired: boolean;
  gracePeriodMs: number; // Grace period before rollback
  notificationChannels: string[];
}

export interface ABTestConfig {
  enabled: boolean;
  controlGroup: "v1" | "v2"; // Which version is control
  treatmentGroup: "v1" | "v2"; // Which version is treatment
  sampleSize: number; // Required sample size for significance
  confidenceLevel: number; // 0-1, statistical confidence (0.95 = 95%)
  metrics: string[]; // Metrics to track for A/B test
}

export interface RolloutStatus {
  phase: "planning" | "rollout" | "monitoring" | "complete" | "rolling_back";
  currentPercentage: number;
  targetPercentage: number;
  health: "healthy" | "degraded" | "critical";
  statistics: RolloutStatistics;
  lastUpdated: number;
  monotonicLastUpdated: number;
}

export interface RolloutStatistics {
  v1Stats: CommandVersionStats;
  v2Stats: CommandVersionStats;
  abTestResults?: ABTestResults;
  healthMetrics: HealthMetrics;
}

export interface CommandVersionStats {
  totalExecutions: number;
  successRate: number;
  avgLatencyMs: number;
  errorCount: number;
  timeoutCount: number;
  memoryUsageMB: number;
  throughputPerSec: number;
}

export interface ABTestResults {
  sampleSizeV1: number;
  sampleSizeV2: number;
  statisticalSignificance: number; // 0-1
  pValue: number;
  winningVersion?: "v1" | "v2";
  confidenceInterval: [number, number];
  effect: "positive" | "negative" | "neutral";
}

export interface HealthMetrics {
  errorRate: number;
  avgLatencyMs: number;
  successRate: number;
  memoryGrowthMB: number;
  lastHealthCheck: number;
  trend: "improving" | "stable" | "degrading";
}

export class FeatureFlagController {
  private config: FeatureFlagConfig;
  private status: RolloutStatus;
  private readonly userCache = new Map<string, boolean>(); // User -> should use V2
  private readonly commandCache = new Map<string, boolean>(); // Command -> should use V2
  private readonly healthHistory: HealthMetrics[] = [];
  private readonly MAX_HISTORY = 100;

  private monitoringInterval?: NodeJS.Timeout;
  private readonly hashSalt = crypto.randomBytes(16).toString("hex");

  constructor(initialConfig?: Partial<FeatureFlagConfig>) {
    this.config = this.mergeWithDefaults(initialConfig || {});
    this.status = this.initializeStatus();
    this.startHealthMonitoring();
  }

  /**
   * Determine if a command execution should use SystemCommand
   */
  shouldUseV2(context: {
    commandName: string;
    userId?: string;
    sessionId?: string;
    metadata?: Record<string, any>;
  }): boolean {
    // Check if command is explicitly disabled for V2
    if (this.config.disabledCommands.includes(context.commandName)) {
      return false;
    }

    // Check if command is explicitly enabled for V2
    if (this.config.enabledCommands.includes(context.commandName)) {
      return true;
    }

    // If we're in rollback phase, use V1
    if (this.status.phase === "rolling_back") {
      return false;
    }

    // Apply targeting strategy
    return this.applyTargetingStrategy(context);
  }

  /**
   * Record execution result for health monitoring and A/B testing
   */
  recordExecution(
    version: "v1" | "v2",
    commandName: string,
    result: {
      success: boolean;
      latencyMs: number;
      error?: string;
      memoryUsageMB?: number;
      userId?: string;
    },
  ): void {
    const stats =
      version === "v1"
        ? this.status.statistics.v1Stats
        : this.status.statistics.v2Stats;

    // Update statistics
    stats.totalExecutions++;

    if (result.success) {
      stats.successRate = this.updateRollingAverage(
        stats.successRate,
        1,
        stats.totalExecutions,
      );
    } else {
      stats.errorCount++;
      stats.successRate = this.updateRollingAverage(
        stats.successRate,
        0,
        stats.totalExecutions,
      );
    }

    // Update latency
    stats.avgLatencyMs = this.updateRollingAverage(
      stats.avgLatencyMs,
      result.latencyMs,
      stats.totalExecutions,
    );

    // Update memory usage if provided
    if (result.memoryUsageMB) {
      stats.memoryUsageMB = this.updateRollingAverage(
        stats.memoryUsageMB,
        result.memoryUsageMB,
        stats.totalExecutions,
      );
    }

    // Update A/B test results if enabled
    if (this.config.testingConfig.enabled) {
      this.updateABTestResults();
    }

    // Check health after recording
    this.checkHealth();
  }

  /**
   * Get current rollout status
   */
  getStatus(): RolloutStatus {
    return {
      ...this.status,
      lastUpdated: Date.now(),
      monotonicLastUpdated: performance.now(),
    };
  }

  /**
   * Manually set rollout percentage (with safety checks)
   */
  async setRolloutPercentage(percentage: number): Promise<boolean> {
    if (percentage < 0 || percentage > 100) {
      throw new Error("Rollout percentage must be between 0 and 100");
    }

    // Check if we can safely increase rollout
    if (percentage > this.config.rolloutPercentage) {
      const healthOk = this.isHealthy();
      if (!healthOk) {
        logger.warn("Cannot increase rollout percentage: health check failed");
        return false;
      }
    }

    const oldPercentage = this.config.rolloutPercentage;
    this.config.rolloutPercentage = percentage;
    this.status.currentPercentage = percentage;
    this.status.targetPercentage = percentage;

    // Clear caches to force re-evaluation
    this.clearCaches();

    logger.info("Rollout percentage updated", {
      from: oldPercentage,
      to: percentage,
      health: this.status.health,
    });

    return true;
  }

  /**
   * Execute automatic rollout progression (25% → 50% → 75% → 100%)
   */
  async executeProgressiveRollout(): Promise<void> {
    const phases = [25, 50, 75, 100];
    const currentIndex = phases.findIndex(
      (p) => p >= this.config.rolloutPercentage,
    );

    if (currentIndex === -1 || currentIndex === phases.length - 1) {
      logger.info("Progressive rollout complete or no next phase available");
      return;
    }

    const nextPhase = phases[currentIndex];

    logger.info("Starting progressive rollout phase", {
      current: this.config.rolloutPercentage,
      target: nextPhase,
    });

    // Check health before progression
    const healthOk = await this.waitForHealthStabilization();
    if (!healthOk) {
      logger.error("Health check failed - aborting rollout progression");
      await this.triggerRollback("Health degradation detected");
      return;
    }

    // Execute rollout
    const success = await this.setRolloutPercentage(nextPhase);
    if (!success) {
      logger.error("Failed to set rollout percentage");
      return;
    }

    // Monitor for grace period
    await this.monitorGracePeriod();

    // Schedule next phase if not at 100%
    if (nextPhase < 100) {
      setTimeout(() => this.executeProgressiveRollout(), 300000); // 5 minutes between phases
    } else {
      this.status.phase = "complete";
      logger.info("Progressive rollout completed successfully");
    }
  }

  /**
   * Trigger automatic rollback
   */
  async triggerRollback(reason: string): Promise<void> {
    if (!this.config.rollbackSettings.enabled) {
      logger.warn("Rollback triggered but disabled in config", { reason });
      return;
    }

    this.status.phase = "rolling_back";

    logger.error("Triggering automatic rollback", { reason });

    // Set rollout to 0% (full V1)
    this.config.rolloutPercentage = 0;
    this.status.currentPercentage = 0;
    this.status.targetPercentage = 0;
    this.clearCaches();

    // Send notifications if configured
    await this.sendRollbackNotifications(reason);

    // Wait for grace period
    if (this.config.rollbackSettings.gracePeriodMs > 0) {
      await new Promise((resolve) =>
        setTimeout(resolve, this.config.rollbackSettings.gracePeriodMs),
      );
    }

    logger.info("Rollback completed", { reason });
  }

  /**
   * Get A/B test results if testing is enabled
   */
  getABTestResults(): ABTestResults | undefined {
    return this.status.statistics.abTestResults;
  }

  /**
   * Apply targeting strategy to determine V2 usage
   */
  private applyTargetingStrategy(context: {
    commandName: string;
    userId?: string;
    sessionId?: string;
  }): boolean {
    const rolloutPercentage = this.config.rolloutPercentage;

    if (rolloutPercentage === 0) return false;
    if (rolloutPercentage === 100) return true;

    switch (this.config.targetingStrategy) {
      case "user":
        return this.isUserInRollout(context.userId || "anonymous");

      case "command":
        return this.isCommandInRollout(context.commandName);

      case "session":
        return this.isSessionInRollout(context.sessionId || "anonymous");

      case "random":
      default:
        return Math.random() * 100 < rolloutPercentage;
    }
  }

  /**
   * Determine if user should be in rollout (consistent hash-based)
   */
  private isUserInRollout(userId: string): boolean {
    const cacheKey = `user:${userId}`;

    if (this.userCache.has(cacheKey)) {
      return this.userCache.get(cacheKey)!;
    }

    // Use consistent hashing for stable user assignment
    const hash = crypto
      .createHash("sha256")
      .update(`${userId}:${this.hashSalt}`)
      .digest("hex");

    const hashValue = parseInt(hash.slice(0, 8), 16);
    const bucket = hashValue % 100;
    const inRollout = bucket < this.config.rolloutPercentage;

    this.userCache.set(cacheKey, inRollout);
    return inRollout;
  }

  /**
   * Determine if command should be in rollout
   */
  private isCommandInRollout(commandName: string): boolean {
    const cacheKey = `command:${commandName}`;

    if (this.commandCache.has(cacheKey)) {
      return this.commandCache.get(cacheKey)!;
    }

    const hash = crypto
      .createHash("sha256")
      .update(`${commandName}:${this.hashSalt}`)
      .digest("hex");

    const hashValue = parseInt(hash.slice(0, 8), 16);
    const bucket = hashValue % 100;
    const inRollout = bucket < this.config.rolloutPercentage;

    this.commandCache.set(cacheKey, inRollout);
    return inRollout;
  }

  /**
   * Determine if session should be in rollout
   */
  private isSessionInRollout(sessionId: string): boolean {
    const hash = crypto
      .createHash("sha256")
      .update(`${sessionId}:${this.hashSalt}`)
      .digest("hex");

    const hashValue = parseInt(hash.slice(0, 8), 16);
    const bucket = hashValue % 100;
    return bucket < this.config.rolloutPercentage;
  }

  /**
   * Check system health and trigger rollback if necessary
   */
  private checkHealth(): void {
    const health = this.calculateHealthMetrics();
    this.healthHistory.push(health);

    if (this.healthHistory.length > this.MAX_HISTORY) {
      this.healthHistory.shift();
    }

    // Update status
    this.status.statistics.healthMetrics = health;
    this.status.health = this.determineHealthStatus(health);

    // Check for automatic rollback conditions
    if (
      this.config.rollbackSettings.autoRollbackOnFailure &&
      this.shouldTriggerRollback(health)
    ) {
      this.triggerRollback("Automatic rollback due to health degradation");
    }
  }

  /**
   * Calculate current health metrics
   */
  private calculateHealthMetrics(): HealthMetrics {
    const v2Stats = this.status.statistics.v2Stats;
    const thresholds = this.config.healthThresholds;

    return {
      errorRate: 1 - v2Stats.successRate,
      avgLatencyMs: v2Stats.avgLatencyMs,
      successRate: v2Stats.successRate,
      memoryGrowthMB: v2Stats.memoryUsageMB,
      lastHealthCheck: Date.now(),
      trend: this.calculateTrend(),
    };
  }

  /**
   * Determine if rollback should be triggered
   */
  private shouldTriggerRollback(health: HealthMetrics): boolean {
    const thresholds = this.config.healthThresholds;

    return (
      health.errorRate > thresholds.maxErrorRate ||
      health.avgLatencyMs > thresholds.maxLatencyMs ||
      health.successRate < thresholds.minSuccessRate ||
      health.memoryGrowthMB > thresholds.maxMemoryGrowthMB
    );
  }

  /**
   * Calculate health trend from recent history
   */
  private calculateTrend(): "improving" | "stable" | "degrading" {
    if (this.healthHistory.length < 3) return "stable";

    const recent = this.healthHistory.slice(-3);
    const errorRates = recent.map((h) => h.errorRate);

    const trend = errorRates[2] - errorRates[0];

    if (trend > 0.01) return "degrading";
    if (trend < -0.01) return "improving";
    return "stable";
  }

  /**
   * Update A/B test statistical analysis
   */
  private updateABTestResults(): void {
    const v1Stats = this.status.statistics.v1Stats;
    const v2Stats = this.status.statistics.v2Stats;

    if (v1Stats.totalExecutions < 30 || v2Stats.totalExecutions < 30) {
      return; // Need more samples for statistical significance
    }

    // Calculate statistical significance (simplified chi-square test)
    const totalV1 = v1Stats.totalExecutions;
    const successV1 = Math.round(totalV1 * v1Stats.successRate);

    const totalV2 = v2Stats.totalExecutions;
    const successV2 = Math.round(totalV2 * v2Stats.successRate);

    const pValue = this.calculatePValue(successV1, totalV1, successV2, totalV2);
    const significance = 1 - pValue;

    this.status.statistics.abTestResults = {
      sampleSizeV1: totalV1,
      sampleSizeV2: totalV2,
      statisticalSignificance: significance,
      pValue,
      winningVersion: v2Stats.successRate > v1Stats.successRate ? "v2" : "v1",
      confidenceInterval: this.calculateConfidenceInterval(
        v2Stats.successRate,
        totalV2,
      ),
      effect: this.determineEffect(v1Stats.successRate, v2Stats.successRate),
    };
  }

  /**
   * Simplified p-value calculation for A/B testing
   */
  private calculatePValue(
    successA: number,
    totalA: number,
    successB: number,
    totalB: number,
  ): number {
    // Simplified statistical test - in production would use proper statistical libraries
    const pA = successA / totalA;
    const pB = successB / totalB;
    const pooled = (successA + successB) / (totalA + totalB);

    const se = Math.sqrt(pooled * (1 - pooled) * (1 / totalA + 1 / totalB));
    const z = Math.abs(pA - pB) / se;

    // Approximate p-value (would use proper statistical distribution in production)
    return Math.max(0.001, 2 * (1 - this.normalCDF(z)));
  }

  /**
   * Normal CDF approximation
   */
  private normalCDF(x: number): number {
    return (
      0.5 * (1 + Math.sign(x) * Math.sqrt(1 - Math.exp((-2 * x * x) / Math.PI)))
    );
  }

  /**
   * Calculate confidence interval for success rate
   */
  private calculateConfidenceInterval(p: number, n: number): [number, number] {
    const z = 1.96; // 95% confidence
    const margin = z * Math.sqrt((p * (1 - p)) / n);
    return [Math.max(0, p - margin), Math.min(1, p + margin)];
  }

  /**
   * Determine effect magnitude
   */
  private determineEffect(
    v1Rate: number,
    v2Rate: number,
  ): "positive" | "negative" | "neutral" {
    const diff = v2Rate - v1Rate;
    if (Math.abs(diff) < 0.01) return "neutral";
    return diff > 0 ? "positive" : "negative";
  }

  // Helper methods
  private mergeWithDefaults(
    config: Partial<FeatureFlagConfig>,
  ): FeatureFlagConfig {
    return {
      rolloutPercentage: config.rolloutPercentage ?? 0,
      targetingStrategy: config.targetingStrategy ?? "user",
      enabledCommands: config.enabledCommands ?? [],
      disabledCommands: config.disabledCommands ?? [],
      healthThresholds: {
        maxErrorRate: 0.05,
        maxLatencyMs: 5000,
        minSuccessRate: 0.95,
        maxMemoryGrowthMB: 100,
        evaluationWindowMs: 60000,
        ...config.healthThresholds,
      },
      rollbackSettings: {
        enabled: true,
        autoRollbackOnFailure: true,
        manualApprovalRequired: false,
        gracePeriodMs: 30000,
        notificationChannels: [],
        ...config.rollbackSettings,
      },
      testingConfig: {
        enabled: true,
        controlGroup: "v1",
        treatmentGroup: "v2",
        sampleSize: 1000,
        confidenceLevel: 0.95,
        metrics: ["success_rate", "latency", "memory_usage"],
        ...config.testingConfig,
      },
    };
  }

  private initializeStatus(): RolloutStatus {
    return {
      phase: "planning",
      currentPercentage: this.config.rolloutPercentage,
      targetPercentage: this.config.rolloutPercentage,
      health: "healthy",
      statistics: {
        v1Stats: this.createEmptyStats(),
        v2Stats: this.createEmptyStats(),
        healthMetrics: {
          errorRate: 0,
          avgLatencyMs: 0,
          successRate: 1,
          memoryGrowthMB: 0,
          lastHealthCheck: Date.now(),
          trend: "stable",
        },
      },
      lastUpdated: Date.now(),
      monotonicLastUpdated: performance.now(),
    };
  }

  private createEmptyStats(): CommandVersionStats {
    return {
      totalExecutions: 0,
      successRate: 1,
      avgLatencyMs: 0,
      errorCount: 0,
      timeoutCount: 0,
      memoryUsageMB: 0,
      throughputPerSec: 0,
    };
  }

  private updateRollingAverage(
    current: number,
    newValue: number,
    count: number,
  ): number {
    return (current * (count - 1) + newValue) / count;
  }

  private clearCaches(): void {
    this.userCache.clear();
    this.commandCache.clear();
  }

  private isHealthy(): boolean {
    return this.status.health === "healthy";
  }

  private determineHealthStatus(
    health: HealthMetrics,
  ): "healthy" | "degraded" | "critical" {
    const thresholds = this.config.healthThresholds;

    if (
      health.errorRate > thresholds.maxErrorRate * 0.8 ||
      health.avgLatencyMs > thresholds.maxLatencyMs * 0.8
    ) {
      return "critical";
    }

    if (
      health.errorRate > thresholds.maxErrorRate * 0.5 ||
      health.avgLatencyMs > thresholds.maxLatencyMs * 0.5
    ) {
      return "degraded";
    }

    return "healthy";
  }

  private startHealthMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.checkHealth();
    }, this.config.healthThresholds.evaluationWindowMs);
  }

  private async waitForHealthStabilization(): Promise<boolean> {
    // Wait for health to stabilize before proceeding
    return new Promise((resolve) => {
      let checksCompleted = 0;
      const requiredChecks = 3;

      const checkInterval = setInterval(() => {
        this.checkHealth();
        checksCompleted++;

        if (checksCompleted >= requiredChecks) {
          clearInterval(checkInterval);
          resolve(this.isHealthy());
        }
      }, 10000); // Check every 10 seconds
    });
  }

  private async monitorGracePeriod(): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, this.config.rollbackSettings.gracePeriodMs);
    });
  }

  private async sendRollbackNotifications(reason: string): Promise<void> {
    // In production, would integrate with notification services
    logger.error("ROLLBACK NOTIFICATION", { reason });
  }

  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
  }
}

// Export singleton instance for consistent usage
export const featureFlagController = new FeatureFlagController();
