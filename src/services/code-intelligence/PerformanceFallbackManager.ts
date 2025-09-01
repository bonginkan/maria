/**
 * Performance Fallback Manager - Enterprise Performance Monitoring and Fallback
 * Week 1-2 Implementation: Comprehensive fallback strategies and performance tracking
 */

import { EventEmitter } from 'events';

export interface PerformanceMetrics {
  operation: string;
  duration: number;
  success: boolean;
  timestamp: number;
  memoryUsage?: number;
  fallbackUsed?: boolean;
  error?: string;
}

export interface FallbackStrategy {
  name: string;
  timeout: number;
  maxRetries: number;
  priority: number;
  execute: () => Promise<any>;
}

export interface PerformanceThresholds {
  warning: number;
  critical: number;
  timeout: number;
}

export interface SystemHealth {
  overallHealth: 'healthy' | 'degraded' | 'critical';
  metrics: {
    averageResponseTime: number;
    errorRate: number;
    fallbackRate: number;
    memoryUsage: number;
    activeOperations: number;
  };
  lastUpdated: number;
}

/**
 * Enterprise performance monitoring and fallback management
 * Implements SOW requirements for performance guarantees and safety
 */
export class PerformanceFallbackManager extends EventEmitter {
  private metrics: PerformanceMetrics[] = [];
  private activeOperations = new Map<string, { startTime: number; operation: string }>();
  private fallbackStrategies = new Map<string, FallbackStrategy[]>();
  
  private readonly MAX_METRICS_HISTORY = 1000;
  private readonly HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
  
  private healthCheckTimer?: NodeJS.Timeout;
  private systemHealth: SystemHealth;

  // Performance thresholds
  private readonly THRESHOLDS: Record<string, PerformanceThresholds> = {
    'ast_operation': { warning: 5000, critical: 10000, timeout: 15000 },
    'context_request': { warning: 100, critical: 500, timeout: 2000 },
    'file_parsing': { warning: 1000, critical: 3000, timeout: 5000 },
    'validation': { warning: 8000, critical: 15000, timeout: 30000 },
    'refactoring': { warning: 5000, critical: 12000, timeout: 20000 }
  };

  constructor() {
    super();
    
    this.systemHealth = {
      overallHealth: 'healthy',
      metrics: {
        averageResponseTime: 0,
        errorRate: 0,
        fallbackRate: 0,
        memoryUsage: 0,
        activeOperations: 0
      },
      lastUpdated: Date.now()
    };

    this.startHealthMonitoring();
    this.setupFallbackStrategies();
  }

  /**
   * Execute operation with fallback support
   * Core method implementing performance guarantees
   */
  async executeWithFallback<T>(
    operationType: string,
    primary: () => Promise<T>,
    fallbacks?: (() => Promise<T>)[]
  ): Promise<T> {
    const operationId = this.generateOperationId();
    const startTime = Date.now();
    
    this.trackOperationStart(operationId, operationType);
    
    try {
      // Try primary operation with timeout
      const threshold = this.THRESHOLDS[operationType] || this.THRESHOLDS.ast_operation;
      
      const result = await Promise.race([
        primary(),
        this.createTimeoutPromise<T>(threshold.timeout, `${operationType} timeout`)
      ]);

      const duration = Date.now() - startTime;
      this.recordMetric({
        operation: operationType,
        duration,
        success: true,
        timestamp: startTime,
        memoryUsage: this.getCurrentMemoryUsage(),
        fallbackUsed: false
      });

      this.checkPerformanceThreshold(operationType, duration);
      
      return result;

    } catch (error) {
      console.warn(`Primary ${operationType} failed:`, error);
      
      // Try fallback strategies
      if (fallbacks && fallbacks.length > 0) {
        for (let i = 0; i < fallbacks.length; i++) {
          try {
            const fallbackResult = await fallbacks[i]();
            
            const duration = Date.now() - startTime;
            this.recordMetric({
              operation: operationType,
              duration,
              success: true,
              timestamp: startTime,
              memoryUsage: this.getCurrentMemoryUsage(),
              fallbackUsed: true
            });

            console.log(`✅ Fallback ${i + 1} succeeded for ${operationType}`);
            return fallbackResult;

          } catch (fallbackError) {
            console.warn(`Fallback ${i + 1} failed for ${operationType}:`, fallbackError);
            continue;
          }
        }
      }

      // All strategies failed
      const duration = Date.now() - startTime;
      this.recordMetric({
        operation: operationType,
        duration,
        success: false,
        timestamp: startTime,
        memoryUsage: this.getCurrentMemoryUsage(),
        fallbackUsed: !!fallbacks && fallbacks.length > 0,
        error: error instanceof Error ? error.message : String(error)
      });

      throw error;

    } finally {
      this.trackOperationEnd(operationId);
    }
  }

  /**
   * AST processing fallback (ts-morph → TypeScript Compiler API)
   */
  async processASTWithFallback<T>(
    file: string,
    tsMorphOperation: () => Promise<T>,
    compilerApiOperation: () => Promise<T>
  ): Promise<T> {
    return this.executeWithFallback(
      'ast_operation',
      tsMorphOperation,
      [compilerApiOperation]
    );
  }

  /**
   * Context request with caching fallback
   */
  async getContextWithFallback<T>(
    file: string,
    freshOperation: () => Promise<T>,
    cachedOperation: () => Promise<T>,
    minimalOperation: () => Promise<T>
  ): Promise<T> {
    return this.executeWithFallback(
      'context_request',
      freshOperation,
      [cachedOperation, minimalOperation]
    );
  }

  /**
   * Validation with progressive levels
   */
  async validateWithFallback<T>(
    level: 'P1' | 'P2' | 'P3',
    fullValidation: () => Promise<T>,
    reducedValidation: () => Promise<T>,
    minimalValidation: () => Promise<T>
  ): Promise<T> {
    const fallbacks = level === 'P3' 
      ? [reducedValidation, minimalValidation]
      : level === 'P2' 
        ? [minimalValidation]
        : [];

    return this.executeWithFallback(
      'validation',
      fullValidation,
      fallbacks
    );
  }

  /**
   * Setup predefined fallback strategies
   */
  private setupFallbackStrategies(): void {
    // AST parsing fallbacks
    this.fallbackStrategies.set('ast_parsing', [
      {
        name: 'ts-morph',
        timeout: 10000,
        maxRetries: 2,
        priority: 1,
        execute: async () => { throw new Error('Implementation needed'); }
      },
      {
        name: 'typescript_compiler_api',
        timeout: 15000,
        maxRetries: 1,
        priority: 2,
        execute: async () => { throw new Error('Implementation needed'); }
      },
      {
        name: 'regex_based',
        timeout: 2000,
        maxRetries: 1,
        priority: 3,
        execute: async () => { throw new Error('Implementation needed'); }
      }
    ]);

    // Context resolution fallbacks
    this.fallbackStrategies.set('context_resolution', [
      {
        name: 'full_ast_analysis',
        timeout: 5000,
        maxRetries: 1,
        priority: 1,
        execute: async () => { throw new Error('Implementation needed'); }
      },
      {
        name: 'cached_analysis',
        timeout: 1000,
        maxRetries: 2,
        priority: 2,
        execute: async () => { throw new Error('Implementation needed'); }
      },
      {
        name: 'basic_text_analysis',
        timeout: 500,
        maxRetries: 1,
        priority: 3,
        execute: async () => { throw new Error('Implementation needed'); }
      }
    ]);
  }

  /**
   * Create timeout promise
   */
  private createTimeoutPromise<T>(timeout: number, message: string): Promise<T> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(message));
      }, timeout);
    });
  }

  /**
   * Record performance metric
   */
  private recordMetric(metric: PerformanceMetrics): void {
    this.metrics.push(metric);
    
    // Limit history size
    if (this.metrics.length > this.MAX_METRICS_HISTORY) {
      this.metrics = this.metrics.slice(-this.MAX_METRICS_HISTORY);
    }
    
    this.emit('metric', metric);
    
    // Update system health
    this.updateSystemHealth();
  }

  /**
   * Check if performance exceeds thresholds
   */
  private checkPerformanceThreshold(operation: string, duration: number): void {
    const threshold = this.THRESHOLDS[operation];
    if (!threshold) return;

    if (duration > threshold.critical) {
      this.emit('performance-critical', {
        operation,
        duration,
        threshold: threshold.critical
      });
      console.error(`🚨 CRITICAL: ${operation} took ${duration}ms (threshold: ${threshold.critical}ms)`);
    } else if (duration > threshold.warning) {
      this.emit('performance-warning', {
        operation,
        duration,
        threshold: threshold.warning
      });
      console.warn(`⚠️ WARNING: ${operation} took ${duration}ms (threshold: ${threshold.warning}ms)`);
    }
  }

  /**
   * Track operation lifecycle
   */
  private trackOperationStart(id: string, operation: string): void {
    this.activeOperations.set(id, {
      startTime: Date.now(),
      operation
    });
  }

  private trackOperationEnd(id: string): void {
    this.activeOperations.delete(id);
  }

  /**
   * Generate unique operation ID
   */
  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get current memory usage
   */
  private getCurrentMemoryUsage(): number {
    return process.memoryUsage().heapUsed;
  }

  /**
   * Update system health metrics
   */
  private updateSystemHealth(): void {
    const recentMetrics = this.getRecentMetrics(300000); // Last 5 minutes
    
    if (recentMetrics.length === 0) {
      return;
    }

    const successful = recentMetrics.filter(m => m.success);
    const failed = recentMetrics.filter(m => !m.success);
    const withFallback = recentMetrics.filter(m => m.fallbackUsed);

    const metrics = {
      averageResponseTime: successful.reduce((sum, m) => sum + m.duration, 0) / Math.max(successful.length, 1),
      errorRate: failed.length / recentMetrics.length,
      fallbackRate: withFallback.length / recentMetrics.length,
      memoryUsage: this.getCurrentMemoryUsage(),
      activeOperations: this.activeOperations.size
    };

    // Determine overall health
    let overallHealth: 'healthy' | 'degraded' | 'critical';
    
    if (metrics.errorRate > 0.2 || metrics.averageResponseTime > 5000) {
      overallHealth = 'critical';
    } else if (metrics.errorRate > 0.1 || metrics.fallbackRate > 0.3 || metrics.averageResponseTime > 2000) {
      overallHealth = 'degraded';
    } else {
      overallHealth = 'healthy';
    }

    this.systemHealth = {
      overallHealth,
      metrics,
      lastUpdated: Date.now()
    };

    this.emit('health-update', this.systemHealth);
  }

  /**
   * Get recent metrics within time window
   */
  private getRecentMetrics(windowMs: number): PerformanceMetrics[] {
    const cutoff = Date.now() - windowMs;
    return this.metrics.filter(m => m.timestamp >= cutoff);
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    this.healthCheckTimer = setInterval(() => {
      this.updateSystemHealth();
      this.performHealthCheck();
    }, this.HEALTH_CHECK_INTERVAL);
  }

  /**
   * Perform comprehensive health check
   */
  private performHealthCheck(): void {
    const health = this.systemHealth;
    
    // Log health status periodically
    console.log(`🏥 System Health: ${health.overallHealth.toUpperCase()}`);
    console.log(`   - Avg Response Time: ${Math.round(health.metrics.averageResponseTime)}ms`);
    console.log(`   - Error Rate: ${(health.metrics.errorRate * 100).toFixed(1)}%`);
    console.log(`   - Fallback Rate: ${(health.metrics.fallbackRate * 100).toFixed(1)}%`);
    console.log(`   - Memory Usage: ${Math.round(health.metrics.memoryUsage / 1024 / 1024)}MB`);
    console.log(`   - Active Operations: ${health.metrics.activeOperations}`);
    
    // Trigger cleanup if needed
    if (health.metrics.memoryUsage > 500 * 1024 * 1024) { // > 500MB
      this.emit('memory-pressure');
      console.warn('⚠️ High memory usage detected, consider cleanup');
    }
    
    // Alert on degraded performance
    if (health.overallHealth === 'critical') {
      this.emit('system-critical');
      console.error('🚨 System performance is critical, fallback strategies active');
    }
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(operation?: string): {
    totalOperations: number;
    successRate: number;
    averageResponseTime: number;
    fallbackRate: number;
    recentErrors: string[];
  } {
    const relevantMetrics = operation 
      ? this.metrics.filter(m => m.operation === operation)
      : this.metrics;
    
    const successful = relevantMetrics.filter(m => m.success);
    const withFallback = relevantMetrics.filter(m => m.fallbackUsed);
    const recentErrors = relevantMetrics
      .filter(m => !m.success && m.error)
      .slice(-10)
      .map(m => m.error!);

    return {
      totalOperations: relevantMetrics.length,
      successRate: relevantMetrics.length > 0 ? successful.length / relevantMetrics.length : 0,
      averageResponseTime: successful.length > 0 
        ? successful.reduce((sum, m) => sum + m.duration, 0) / successful.length 
        : 0,
      fallbackRate: relevantMetrics.length > 0 ? withFallback.length / relevantMetrics.length : 0,
      recentErrors
    };
  }

  /**
   * Get system health
   */
  getSystemHealth(): SystemHealth {
    return { ...this.systemHealth };
  }

  /**
   * Get all metrics (for debugging)
   */
  getAllMetrics(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  /**
   * Clear metrics history
   */
  clearMetrics(): void {
    this.metrics = [];
    this.updateSystemHealth();
  }

  /**
   * Emergency fallback - disable complex operations
   */
  enableEmergencyMode(): void {
    console.warn('🚨 EMERGENCY MODE: Disabling complex operations');
    
    // Override thresholds to very low values
    Object.keys(this.THRESHOLDS).forEach(key => {
      this.THRESHOLDS[key] = {
        warning: 100,
        critical: 500,
        timeout: 1000
      };
    });
    
    this.emit('emergency-mode-enabled');
  }

  /**
   * Disable emergency mode
   */
  disableEmergencyMode(): void {
    console.log('✅ Emergency mode disabled, restoring normal thresholds');
    
    // Restore original thresholds
    this.THRESHOLDS.ast_operation = { warning: 5000, critical: 10000, timeout: 15000 };
    this.THRESHOLDS.context_request = { warning: 100, critical: 500, timeout: 2000 };
    this.THRESHOLDS.file_parsing = { warning: 1000, critical: 3000, timeout: 5000 };
    this.THRESHOLDS.validation = { warning: 8000, critical: 15000, timeout: 30000 };
    this.THRESHOLDS.refactoring = { warning: 5000, critical: 12000, timeout: 20000 };
    
    this.emit('emergency-mode-disabled');
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    
    this.metrics = [];
    this.activeOperations.clear();
    this.fallbackStrategies.clear();
  }
}

/**
 * Kill switch system for emergency shutdown
 */
export class SafetyKillSwitch {
  private readonly KILL_SWITCH_ENV = 'MARIA_CODE_AST_DISABLE';
  private readonly ERROR_RATE_THRESHOLD = 0.5; // 50%
  private readonly MEMORY_THRESHOLD = 1024 * 1024 * 1024; // 1GB
  
  private isKillSwitchActive = false;

  constructor(private performanceManager: PerformanceFallbackManager) {
    // Monitor performance for automatic kill switch
    performanceManager.on('system-critical', () => {
      this.checkAutoKillSwitch();
    });
  }

  /**
   * Check if kill switch should be activated
   */
  async checkKillSwitch(): Promise<boolean> {
    // Manual environment variable kill switch
    if (process.env[this.KILL_SWITCH_ENV] === '1') {
      console.warn('🛑 AST operations disabled via environment variable');
      return true;
    }

    // Server-side kill switch (would check API in real implementation)
    const serverKillSwitch = await this.checkServerKillSwitch();
    if (serverKillSwitch) {
      console.warn('🛑 AST operations disabled via server kill switch');
      return true;
    }

    // Automatic kill switch based on system health
    if (this.isKillSwitchActive) {
      console.warn('🛑 AST operations disabled via automatic kill switch');
      return true;
    }

    return false;
  }

  /**
   * Check server-side kill switch
   */
  private async checkServerKillSwitch(): Promise<boolean> {
    try {
      // In a real implementation, this would check an API endpoint
      // For now, return false
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Check if automatic kill switch should activate
   */
  private checkAutoKillSwitch(): void {
    const stats = this.performanceManager.getPerformanceStats();
    const health = this.performanceManager.getSystemHealth();
    
    // Activate kill switch if error rate too high or memory usage critical
    if (stats.successRate < (1 - this.ERROR_RATE_THRESHOLD) || 
        health.metrics.memoryUsage > this.MEMORY_THRESHOLD) {
      
      this.activateKillSwitch();
    }
  }

  /**
   * Activate kill switch
   */
  private activateKillSwitch(): void {
    if (this.isKillSwitchActive) return;
    
    this.isKillSwitchActive = true;
    console.error('🚨 KILL SWITCH ACTIVATED - System performance critical');
    
    // Enable emergency mode
    this.performanceManager.enableEmergencyMode();
    
    // Alert monitoring systems
    this.performanceManager.emit('kill-switch-activated', {
      reason: 'automatic',
      timestamp: Date.now(),
      systemHealth: this.performanceManager.getSystemHealth()
    });
  }

  /**
   * Deactivate kill switch
   */
  deactivateKillSwitch(): void {
    if (!this.isKillSwitchActive) return;
    
    this.isKillSwitchActive = false;
    console.log('✅ Kill switch deactivated');
    
    this.performanceManager.disableEmergencyMode();
    this.performanceManager.emit('kill-switch-deactivated');
  }

  /**
   * Fallback to safe mode
   */
  async fallbackToSafeMode(): Promise<void> {
    console.info('🔒 Falling back to safe mode - text operations only');
    
    // In a real implementation, this would:
    // 1. Disable AST operations
    // 2. Enable basic text operations only
    // 3. Alert monitoring systems
    
    this.performanceManager.emit('safe-mode-activated');
  }
}

// Export singleton instances
export const performanceFallbackManager = new PerformanceFallbackManager();
export const safetyKillSwitch = new SafetyKillSwitch(performanceFallbackManager);