/**
 * KPILogger - Core metrics tracking for autonomous agent
 * Tracks success rate, latency, rollback counts, and user satisfaction
 */

export interface KPIMetrics {
  successRate: number;        // 0-100%
  avgLatencyMs: number;       // p50, p95, p99
  rollbackCount: number;      // Number of rollbacks
  tokenUsage: number;         // Total tokens consumed
  errorRecoveryRate: number;  // Auto-recovery success %
  userSatisfaction?: number;  // 1-5 rating
}

export interface OperationMetric {
  operation: string;
  taskType: 'optimize' | 'refactor' | 'fix' | 'scaffold' | 'test';
  startTime: number;
  endTime?: number;
  success: boolean;
  error?: string;
  rollbackRequired?: boolean;
  tokensUsed?: number;
  modelUsed?: string;
  userId?: string;
  sessionId: string;
}

export class KPILogger {
  private metrics: OperationMetric[] = [];
  private currentOperation: OperationMetric | null = null;
  
  constructor(
    private config: {
      maxMetrics?: number;      // Max metrics in memory
      flushInterval?: number;   // Flush interval in ms
      enableBigQuery?: boolean; // Enable BigQuery export
    } = {}
  ) {
    this.config.maxMetrics = config.maxMetrics || 1000;
    this.config.flushInterval = config.flushInterval || 60000;
    
    if (this.config.flushInterval > 0) {
      this.startAutoFlush();
    }
  }
  
  /**
   * Start tracking an operation
   */
  startOperation(
    operation: string,
    taskType: OperationMetric['taskType'],
    sessionId: string
  ): void {
    this.currentOperation = {
      operation,
      taskType,
      startTime: Date.now(),
      success: false,
      sessionId
    };
  }
  
  /**
   * Complete the current operation
   */
  completeOperation(
    success: boolean,
    details?: {
      error?: string;
      rollbackRequired?: boolean;
      tokensUsed?: number;
      modelUsed?: string;
    }
  ): void {
    if (!this.currentOperation) {
      console.warn('No operation in progress');
      return;
    }
    
    this.currentOperation.endTime = Date.now();
    this.currentOperation.success = success;
    
    if (details) {
      Object.assign(this.currentOperation, details);
    }
    
    this.metrics.push(this.currentOperation);
    this.currentOperation = null;
    
    // Trim if too many metrics
    if (this.metrics.length > this.config.maxMetrics!) {
      this.metrics = this.metrics.slice(-this.config.maxMetrics!);
    }
  }
  
  /**
   * Calculate current KPIs
   */
  getKPIs(): KPIMetrics {
    const recentMetrics = this.getRecentMetrics(100);
    
    if (recentMetrics.length === 0) {
      return {
        successRate: 0,
        avgLatencyMs: 0,
        rollbackCount: 0,
        tokenUsage: 0,
        errorRecoveryRate: 0
      };
    }
    
    const successCount = recentMetrics.filter(m => m.success).length;
    const successRate = (successCount / recentMetrics.length) * 100;
    
    const latencies = recentMetrics
      .filter(m => m.endTime)
      .map(m => m.endTime! - m.startTime);
    
    const avgLatencyMs = latencies.length > 0
      ? latencies.reduce((a, b) => a + b, 0) / latencies.length
      : 0;
    
    const rollbackCount = recentMetrics
      .filter(m => m.rollbackRequired).length;
    
    const tokenUsage = recentMetrics
      .reduce((total, m) => total + (m.tokensUsed || 0), 0);
    
    // Calculate error recovery rate
    const errorMetrics = recentMetrics.filter(m => !m.success);
    const recoveredErrors = errorMetrics.filter(m => 
      this.wasRecovered(m, recentMetrics)
    );
    const errorRecoveryRate = errorMetrics.length > 0
      ? (recoveredErrors.length / errorMetrics.length) * 100
      : 100;
    
    return {
      successRate,
      avgLatencyMs,
      rollbackCount,
      tokenUsage,
      errorRecoveryRate
    };
  }
  
  /**
   * Get latency percentiles
   */
  getLatencyPercentiles(): { p50: number; p95: number; p99: number } {
    const latencies = this.metrics
      .filter(m => m.endTime)
      .map(m => m.endTime! - m.startTime)
      .sort((a, b) => a - b);
    
    if (latencies.length === 0) {
      return { p50: 0, p95: 0, p99: 0 };
    }
    
    const p50Index = Math.floor(latencies.length * 0.5);
    const p95Index = Math.floor(latencies.length * 0.95);
    const p99Index = Math.floor(latencies.length * 0.99);
    
    return {
      p50: latencies[p50Index] || 0,
      p95: latencies[p95Index] || 0,
      p99: latencies[p99Index] || 0
    };
  }
  
  /**
   * Export metrics for BigQuery
   */
  exportForBigQuery(): object[] {
    return this.metrics.map(m => ({
      ...m,
      timestamp: new Date(m.startTime).toISOString(),
      durationMs: m.endTime ? m.endTime - m.startTime : null,
      date: new Date(m.startTime).toISOString().split('T')[0]
    }));
  }
  
  /**
   * Get recent metrics
   */
  private getRecentMetrics(count: number): OperationMetric[] {
    return this.metrics.slice(-count);
  }
  
  /**
   * Check if an error was recovered
   */
  private wasRecovered(
    errorMetric: OperationMetric,
    allMetrics: OperationMetric[]
  ): boolean {
    const errorIndex = allMetrics.indexOf(errorMetric);
    if (errorIndex === -1 || errorIndex === allMetrics.length - 1) {
      return false;
    }
    
    // Check if next operation with same session succeeded
    const nextMetric = allMetrics[errorIndex + 1];
    return nextMetric.sessionId === errorMetric.sessionId && 
           nextMetric.success;
  }
  
  /**
   * Start auto-flush timer
   */
  private startAutoFlush(): void {
    setInterval(() => {
      if (this.config.enableBigQuery && this.metrics.length > 0) {
        // In production, this would send to BigQuery
        console.log(`[KPI] Flushing ${this.metrics.length} metrics`);
        this.flush();
      }
    }, this.config.flushInterval!);
  }
  
  /**
   * Flush metrics (for BigQuery export)
   */
  private flush(): void {
    // In production, send to BigQuery here
    const exportData = this.exportForBigQuery();
    // BigQuerySink.send(exportData);
    
    // Clear old metrics after flush
    const oneHourAgo = Date.now() - 3600000;
    this.metrics = this.metrics.filter(m => m.startTime > oneHourAgo);
  }
  
  /**
   * Get summary report
   */
  getSummaryReport(): string {
    const kpis = this.getKPIs();
    const percentiles = this.getLatencyPercentiles();
    
    return `
╔════════════════════════════════════════╗
║         KPI Summary Report             ║
╠════════════════════════════════════════╣
║ Success Rate:      ${kpis.successRate.toFixed(1)}%
║ Avg Latency:       ${kpis.avgLatencyMs.toFixed(0)}ms
║ P50 Latency:       ${percentiles.p50.toFixed(0)}ms
║ P95 Latency:       ${percentiles.p95.toFixed(0)}ms
║ P99 Latency:       ${percentiles.p99.toFixed(0)}ms
║ Rollback Count:    ${kpis.rollbackCount}
║ Token Usage:       ${kpis.tokenUsage.toLocaleString()}
║ Error Recovery:    ${kpis.errorRecoveryRate.toFixed(1)}%
╚════════════════════════════════════════╝
    `.trim();
  }
}