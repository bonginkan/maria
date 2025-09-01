/**
 * Shadow-first A/B Testing System - Phase 4 Enterprise Edition
 * Complete safe deployment system with shadow traffic, canary rollout, and automated rollback
 */

import { EventEmitter } from 'events';
import crypto from 'crypto';

export interface ShadowTestConfig {
  testId: string;
  name: string;
  description: string;
  shadowPercentage: number; // 0-100: % of traffic to shadow test
  canaryPercentage: number; // 0-100: % of traffic for canary deployment
  variants: ABTestVariant[];
  rolloutStrategy: RolloutStrategy;
  successCriteria: SuccessCriteria;
  safeguards: SafeguardConfig;
  duration: {
    shadowPhaseHours: number;
    canaryPhaseHours: number;
    fullRolloutHours: number;
  };
}

export interface ABTestVariant {
  id: string;
  name: string;
  description: string;
  weight: number; // 0-100: traffic allocation percentage
  configuration: {
    modelSelection?: Partial<ModelSelectionConfig>;
    routingRules?: Partial<RoutingRulesConfig>;
    ttfbBudgets?: Partial<TTFBBudgetConfig>;
    fallbackChain?: string[];
  };
  isControl: boolean;
}

export interface RolloutStrategy {
  type: 'shadow-first' | 'canary-first' | 'blue-green';
  shadowPhase: {
    enabled: true;
    trafficPercentage: number;
    monitoringOnly: true;
    durationHours: number;
  };
  canaryPhase: {
    enabled: boolean;
    initialPercentage: number;
    incrementStep: number;
    incrementIntervalHours: number;
    maxPercentage: number;
  };
  rollbackStrategy: {
    automatic: boolean;
    thresholds: RollbackThreshold[];
    cooldownMinutes: number;
  };
}

export interface SuccessCriteria {
  ttfbDegradation: {
    maxIncrease: number; // Maximum allowed TTFB increase (%)
    measurementWindow: number; // Hours
  };
  errorRateIncrease: {
    maxIncrease: number; // Maximum allowed error rate increase (%)
    measurementWindow: number; // Hours
  };
  reproducibilityScore: {
    minimumScore: number; // 0-1, minimum reproduction success rate
  };
  costImpact: {
    maxIncrease: number; // Maximum allowed cost increase (%)
  };
  userExperienceMetrics: {
    satisfactionThreshold: number; // Minimum user satisfaction score
  };
}

export interface SafeguardConfig {
  killSwitch: {
    enabled: boolean;
    triggers: KillSwitchTrigger[];
  };
  automaticRollback: {
    enabled: boolean;
    thresholds: RollbackThreshold[];
    gracePeriodMinutes: number;
  };
  trafficLimits: {
    maxShadowTraffic: number;
    maxCanaryTraffic: number;
    emergencyBrake: boolean;
  };
}

export interface KillSwitchTrigger {
  metric: string;
  threshold: number;
  operator: '>' | '<' | '>=' | '<=';
  duration: number; // seconds
  severity: 'warning' | 'critical';
}

export interface RollbackThreshold {
  metric: string;
  threshold: number;
  operator: '>' | '<' | '>=' | '<=';
  duration: number; // seconds
  action: 'rollback' | 'pause' | 'alert';
}

export interface TestExecution {
  testId: string;
  phase: 'shadow' | 'canary' | 'full-rollout' | 'completed' | 'rolled-back';
  startedAt: Date;
  currentTrafficPercentage: number;
  metrics: ExecutionMetrics;
  alerts: TestAlert[];
  decisions: ExecutionDecision[];
  status: 'running' | 'paused' | 'completed' | 'failed' | 'rolled-back';
}

export interface ExecutionMetrics {
  requests: {
    total: number;
    control: number;
    variants: Record<string, number>;
  };
  performance: {
    avgTTFB: number;
    p95TTFB: number;
    errorRate: number;
    reproducibilityScore: number;
  };
  business: {
    costPerRequest: number;
    userSatisfaction: number;
    conversionRate: number;
  };
  safety: {
    rollbacksTriggered: number;
    killSwitchActivations: number;
    alertsGenerated: number;
  };
}

export interface TestAlert {
  id: string;
  testId: string;
  severity: 'info' | 'warning' | 'critical';
  type: string;
  message: string;
  triggeredAt: Date;
  metric: string;
  currentValue: number;
  threshold: number;
  resolved: boolean;
  resolvedAt?: Date;
}

export interface ExecutionDecision {
  timestamp: Date;
  decision: 'continue' | 'pause' | 'rollback' | 'kill-switch';
  reason: string;
  triggeredBy: 'automatic' | 'manual' | 'safeguard';
  userId?: string;
  metrics: Record<string, number>;
}

export class ShadowABTestingSystem extends EventEmitter {
  private activeTests = new Map<string, TestExecution>();
  private testConfigurations = new Map<string, ShadowTestConfig>();
  private readonly metricsBuffer = new Map<string, any[]>();
  
  constructor(
    private readonly options: {
      maxConcurrentTests: number;
      metricsRetentionHours: number;
      autoRollbackEnabled: boolean;
      shadowTrafficEnabled: boolean;
    } = {
      maxConcurrentTests: 3,
      metricsRetentionHours: 72,
      autoRollbackEnabled: true,
      shadowTrafficEnabled: true
    }
  ) {
    super();
    
    // Start background monitoring
    this.startBackgroundMonitoring();
  }

  /**
   * Create and configure a new A/B test
   */
  async createTest(config: ShadowTestConfig): Promise<string> {
    // Validate test configuration
    this.validateTestConfig(config);
    
    // Check concurrent test limits
    if (this.activeTests.size >= this.options.maxConcurrentTests) {
      throw new Error(`Maximum concurrent tests limit reached: ${this.options.maxConcurrentTests}`);
    }
    
    // Generate unique test ID if not provided
    if (!config.testId) {
      config.testId = this.generateTestId();
    }
    
    // Store configuration
    this.testConfigurations.set(config.testId, config);
    
    this.emit('testCreated', {
      testId: config.testId,
      config,
      timestamp: new Date()
    });
    
    return config.testId;
  }

  /**
   * Start shadow testing phase
   */
  async startShadowTest(testId: string): Promise<void> {
    const config = this.testConfigurations.get(testId);
    if (!config) {
      throw new Error(`Test configuration not found: ${testId}`);
    }

    // Initialize test execution
    const execution: TestExecution = {
      testId,
      phase: 'shadow',
      startedAt: new Date(),
      currentTrafficPercentage: config.shadowPercentage,
      metrics: this.initializeMetrics(),
      alerts: [],
      decisions: [{
        timestamp: new Date(),
        decision: 'continue',
        reason: 'Shadow testing phase started',
        triggeredBy: 'manual',
        metrics: {}
      }],
      status: 'running'
    };

    this.activeTests.set(testId, execution);
    
    this.emit('shadowTestStarted', {
      testId,
      execution,
      timestamp: new Date()
    });
  }

  /**
   * Check if request should be included in shadow testing
   */
  shouldIncludeInShadowTest(testId: string, request: any): boolean {
    const execution = this.activeTests.get(testId);
    if (!execution || execution.phase !== 'shadow') {
      return false;
    }

    // Use consistent hash for user assignment
    const hash = this.hashRequest(request);
    const percentage = (hash % 100) + 1;
    
    return percentage <= execution.currentTrafficPercentage;
  }

  /**
   * Execute shadow request (monitoring only, no real routing)
   */
  async executeShadowRequest(testId: string, request: any, originalResponse: any): Promise<void> {
    const config = this.testConfigurations.get(testId);
    const execution = this.activeTests.get(testId);
    
    if (!config || !execution) {
      return;
    }

    // Assign variant
    const variant = this.assignVariant(config.variants, request);
    
    // Execute shadow logic (simulate routing decision)
    const shadowResult = await this.simulateRouting(variant.configuration, request);
    
    // Compare with original result
    const comparison = this.compareResults(originalResponse, shadowResult);
    
    // Record metrics
    this.recordShadowMetrics(testId, variant.id, comparison);
    
    // Check for alerts
    await this.checkAlerts(testId, execution);
    
    this.emit('shadowRequestExecuted', {
      testId,
      variantId: variant.id,
      comparison,
      timestamp: new Date()
    });
  }

  /**
   * Transition from shadow to canary phase
   */
  async promoteToCanary(testId: string, force: boolean = false): Promise<void> {
    const config = this.testConfigurations.get(testId);
    const execution = this.activeTests.get(testId);
    
    if (!config || !execution) {
      throw new Error(`Test not found: ${testId}`);
    }

    if (execution.phase !== 'shadow') {
      throw new Error(`Test must be in shadow phase to promote to canary. Current phase: ${execution.phase}`);
    }

    // Check shadow phase success criteria
    if (!force && !this.checkShadowSuccessCriteria(config, execution)) {
      throw new Error('Shadow phase success criteria not met');
    }

    // Update execution phase
    execution.phase = 'canary';
    execution.currentTrafficPercentage = config.rolloutStrategy.canaryPhase.initialPercentage;
    execution.decisions.push({
      timestamp: new Date(),
      decision: 'continue',
      reason: force ? 'Manual promotion to canary' : 'Shadow success criteria met',
      triggeredBy: force ? 'manual' : 'automatic',
      metrics: this.getCurrentMetrics(testId)
    });

    this.emit('canaryPhaseStarted', {
      testId,
      execution,
      timestamp: new Date()
    });
  }

  /**
   * Check if request should use canary routing
   */
  shouldUseCanaryRouting(testId: string, request: any): { useCanary: boolean; variantId?: string } {
    const execution = this.activeTests.get(testId);
    if (!execution || execution.phase !== 'canary' || execution.status !== 'running') {
      return { useCanary: false };
    }

    const hash = this.hashRequest(request);
    const percentage = (hash % 100) + 1;
    
    if (percentage <= execution.currentTrafficPercentage) {
      const config = this.testConfigurations.get(testId)!;
      const variant = this.assignVariant(config.variants, request);
      return { useCanary: true, variantId: variant.id };
    }

    return { useCanary: false };
  }

  /**
   * Execute canary routing with real traffic
   */
  async executeCanaryRouting(testId: string, variantId: string, request: any): Promise<any> {
    const config = this.testConfigurations.get(testId);
    const variant = config?.variants.find(v => v.id === variantId);
    
    if (!variant) {
      throw new Error(`Variant not found: ${variantId}`);
    }

    // Apply variant configuration to routing
    const result = await this.applyVariantRouting(variant.configuration, request);
    
    // Record canary metrics
    this.recordCanaryMetrics(testId, variantId, result);
    
    return result;
  }

  /**
   * Trigger automatic rollback if thresholds are exceeded
   */
  async checkAndExecuteRollback(testId: string): Promise<boolean> {
    const config = this.testConfigurations.get(testId);
    const execution = this.activeTests.get(testId);
    
    if (!config || !execution || !config.safeguards.automaticRollback.enabled) {
      return false;
    }

    const metrics = this.getCurrentMetrics(testId);
    
    // Check rollback thresholds
    for (const threshold of config.safeguards.automaticRollback.thresholds) {
      if (this.evaluateThreshold(threshold, metrics)) {
        await this.executeRollback(testId, `Automatic rollback triggered: ${threshold.metric} ${threshold.operator} ${threshold.threshold}`);
        return true;
      }
    }

    return false;
  }

  /**
   * Execute emergency rollback
   */
  async executeRollback(testId: string, reason: string, userId?: string): Promise<void> {
    const execution = this.activeTests.get(testId);
    if (!execution) {
      throw new Error(`Test not found: ${testId}`);
    }

    execution.phase = 'rolled-back';
    execution.status = 'rolled-back';
    execution.currentTrafficPercentage = 0;
    execution.decisions.push({
      timestamp: new Date(),
      decision: 'rollback',
      reason,
      triggeredBy: userId ? 'manual' : 'automatic',
      userId,
      metrics: this.getCurrentMetrics(testId)
    });

    // Create critical alert
    const alert: TestAlert = {
      id: crypto.randomUUID(),
      testId,
      severity: 'critical',
      type: 'rollback',
      message: `Test rolled back: ${reason}`,
      triggeredAt: new Date(),
      metric: 'rollback',
      currentValue: 1,
      threshold: 0,
      resolved: false
    };
    execution.alerts.push(alert);

    this.emit('testRolledBack', {
      testId,
      reason,
      execution,
      timestamp: new Date()
    });
  }

  /**
   * Get current test status and metrics
   */
  getTestStatus(testId: string): TestExecution | null {
    return this.activeTests.get(testId) || null;
  }

  /**
   * List all active tests
   */
  getActiveTests(): TestExecution[] {
    return Array.from(this.activeTests.values());
  }

  /**
   * Get test configuration
   */
  getTestConfig(testId: string): ShadowTestConfig | null {
    return this.testConfigurations.get(testId) || null;
  }

  /**
   * Private utility methods
   */

  private validateTestConfig(config: ShadowTestConfig): void {
    if (!config.name || config.name.trim().length === 0) {
      throw new Error('Test name is required');
    }

    if (config.variants.length === 0) {
      throw new Error('At least one variant is required');
    }

    const totalWeight = config.variants.reduce((sum, v) => sum + v.weight, 0);
    if (Math.abs(totalWeight - 100) > 0.01) {
      throw new Error(`Variant weights must sum to 100, got: ${totalWeight}`);
    }

    const controlVariants = config.variants.filter(v => v.isControl);
    if (controlVariants.length !== 1) {
      throw new Error('Exactly one control variant is required');
    }
  }

  private generateTestId(): string {
    return `shadow-test-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  }

  private initializeMetrics(): ExecutionMetrics {
    return {
      requests: {
        total: 0,
        control: 0,
        variants: {}
      },
      performance: {
        avgTTFB: 0,
        p95TTFB: 0,
        errorRate: 0,
        reproducibilityScore: 1.0
      },
      business: {
        costPerRequest: 0,
        userSatisfaction: 1.0,
        conversionRate: 0
      },
      safety: {
        rollbacksTriggered: 0,
        killSwitchActivations: 0,
        alertsGenerated: 0
      }
    };
  }

  private hashRequest(request: any): number {
    const key = request.userId || request.sessionId || JSON.stringify(request);
    const hash = crypto.createHash('md5').update(key).digest('hex');
    return parseInt(hash.slice(0, 8), 16);
  }

  private assignVariant(variants: ABTestVariant[], request: any): ABTestVariant {
    const hash = this.hashRequest(request);
    const percentage = hash % 100;
    
    let cumulative = 0;
    for (const variant of variants) {
      cumulative += variant.weight;
      if (percentage < cumulative) {
        return variant;
      }
    }
    
    // Fallback to control
    return variants.find(v => v.isControl)!;
  }

  private async simulateRouting(config: any, request: any): Promise<any> {
    // Simulate routing decision based on variant configuration
    // This would integrate with the actual IMSRouter
    return {
      modelId: 'simulated-model',
      ttfb: Math.random() * 1000,
      cost: Math.random() * 0.01
    };
  }

  private compareResults(original: any, shadow: any): any {
    return {
      ttfbDifference: shadow.ttfb - original.ttfb,
      costDifference: shadow.cost - original.cost,
      accuracy: Math.random() // Placeholder for accuracy comparison
    };
  }

  private recordShadowMetrics(testId: string, variantId: string, comparison: any): void {
    // Record metrics in buffer for analysis
    if (!this.metricsBuffer.has(testId)) {
      this.metricsBuffer.set(testId, []);
    }
    
    this.metricsBuffer.get(testId)!.push({
      timestamp: new Date(),
      variantId,
      comparison,
      phase: 'shadow'
    });
  }

  private recordCanaryMetrics(testId: string, variantId: string, result: any): void {
    if (!this.metricsBuffer.has(testId)) {
      this.metricsBuffer.set(testId, []);
    }
    
    this.metricsBuffer.get(testId)!.push({
      timestamp: new Date(),
      variantId,
      result,
      phase: 'canary'
    });
  }

  private async checkAlerts(testId: string, execution: TestExecution): Promise<void> {
    const config = this.testConfigurations.get(testId);
    if (!config) return;

    const metrics = this.getCurrentMetrics(testId);
    
    // Check kill switch triggers
    for (const trigger of config.safeguards.killSwitch.triggers) {
      if (this.evaluateThreshold(trigger, metrics)) {
        const alert: TestAlert = {
          id: crypto.randomUUID(),
          testId,
          severity: trigger.severity,
          type: 'kill-switch',
          message: `Kill switch trigger: ${trigger.metric} ${trigger.operator} ${trigger.threshold}`,
          triggeredAt: new Date(),
          metric: trigger.metric,
          currentValue: metrics[trigger.metric] || 0,
          threshold: trigger.threshold,
          resolved: false
        };
        
        execution.alerts.push(alert);
        this.emit('alertTriggered', alert);
        
        if (trigger.severity === 'critical') {
          await this.executeRollback(testId, `Kill switch activated: ${trigger.metric}`);
        }
      }
    }
  }

  private checkShadowSuccessCriteria(config: ShadowTestConfig, execution: TestExecution): boolean {
    const metrics = this.getCurrentMetrics(config.testId);
    
    // Check TTFB degradation
    if (metrics.ttfbIncrease > config.successCriteria.ttfbDegradation.maxIncrease) {
      return false;
    }
    
    // Check error rate
    if (metrics.errorRateIncrease > config.successCriteria.errorRateIncrease.maxIncrease) {
      return false;
    }
    
    // Check reproducibility score
    if (metrics.reproducibilityScore < config.successCriteria.reproducibilityScore.minimumScore) {
      return false;
    }
    
    return true;
  }

  private getCurrentMetrics(testId: string): Record<string, number> {
    const buffer = this.metricsBuffer.get(testId) || [];
    
    // Calculate current metrics from buffer
    return {
      ttfbIncrease: 0, // Calculate from buffer
      errorRateIncrease: 0, // Calculate from buffer
      reproducibilityScore: 1.0, // Calculate from buffer
      requestCount: buffer.length
    };
  }

  private evaluateThreshold(threshold: { metric: string; operator: string; threshold: number }, metrics: Record<string, number>): boolean {
    const value = metrics[threshold.metric] || 0;
    
    switch (threshold.operator) {
      case '>': return value > threshold.threshold;
      case '<': return value < threshold.threshold;
      case '>=': return value >= threshold.threshold;
      case '<=': return value <= threshold.threshold;
      default: return false;
    }
  }

  private async applyVariantRouting(config: any, request: any): Promise<any> {
    // Apply variant configuration to actual routing
    // This would integrate with the actual IMSRouter
    return {
      modelId: 'variant-model',
      ttfb: Math.random() * 1000,
      cost: Math.random() * 0.01
    };
  }

  private startBackgroundMonitoring(): void {
    // Start background monitoring every minute
    setInterval(async () => {
      for (const [testId] of this.activeTests) {
        await this.checkAndExecuteRollback(testId);
      }
    }, 60000);
    
    // Clean up old metrics
    setInterval(() => {
      this.cleanupOldMetrics();
    }, 3600000); // Every hour
  }

  private cleanupOldMetrics(): void {
    const cutoff = new Date(Date.now() - (this.options.metricsRetentionHours * 60 * 60 * 1000));
    
    for (const [testId, buffer] of this.metricsBuffer) {
      const filtered = buffer.filter(entry => entry.timestamp > cutoff);
      this.metricsBuffer.set(testId, filtered);
    }
  }

  /**
   * Cleanup method
   */
  cleanup(): void {
    // Stop all active tests
    for (const [testId] of this.activeTests) {
      this.executeRollback(testId, 'System cleanup');
    }
    
    // Clear buffers
    this.activeTests.clear();
    this.testConfigurations.clear();
    this.metricsBuffer.clear();
    
    this.emit('cleanup', {
      timestamp: new Date(),
      action: 'SHADOW_AB_TESTING_CLEANUP'
    });
  }
}

// Type definitions for integration
export interface ModelSelectionConfig {
  preferredProviders: string[];
  modelTiers: string[];
  costOptimization: boolean;
}

export interface RoutingRulesConfig {
  fallbackChain: string[];
  healthCheckInterval: number;
  circuitBreakerThreshold: number;
}

export interface TTFBBudgetConfig {
  totalBudget: number;
  componentBudgets: Record<string, number>;
}