/**
 * Complete Decision Logger for reproducibility and observability
 * Handles structured logging, BigQuery integration, and reproduction capabilities
 */

import { EventEmitter } from 'events';
import { createHash } from 'crypto';
import type { 
  CompleteRoutingLog,
  PolicySnapshot,
  PoolSnapshot,
  ProviderHealthSnapshot,
  CandidateEvaluation,
  TTFBBreakdown,
  CostCalculationDetails,
  ABTestExecution,
  PIIRedactionSummary,
  ActualPerformanceMetrics
} from './types/DecisionLog.js';
import type { ProcessedTaskInput } from './types/TaskInput.js';
import type { RoutingDecisionResult } from './RoutingDecision.js';

export interface LogStorageConfig {
  bigQueryDataset: string;
  bigQueryTable: string;
  localBackupEnabled: boolean;
  localBackupPath?: string;
  retentionMonths: number;
  encryptionEnabled: boolean;
}

export interface LogQueryOptions {
  traceId?: string;
  userIdHash?: string;
  modelId?: string;
  providerId?: string;
  timeRange?: {
    startDate: Date;
    endDate: Date;
  };
  successOnly?: boolean;
  limit?: number;
  offset?: number;
}

export interface LogAnalytics {
  totalDecisions: number;
  successRate: number;
  averageTTFBMs: number;
  averageCostUsd: number;
  topModels: Array<{ modelId: string; count: number; successRate: number }>;
  commonFailureReasons: Array<{ reason: string; count: number }>;
  avgConfidenceScore: number;
  piiRedactionStats: {
    totalRedactions: number;
    commonTypes: Array<{ type: string; count: number }>;
  };
}

export class CompleteDecisionLogger extends EventEmitter {
  private readonly logBuffer = new Map<string, CompleteRoutingLog>();
  private readonly maxBufferSize = 1000;
  private flushTimer?: NodeJS.Timeout;
  
  constructor(
    private readonly bigQueryClient: any, // Will be injected
    private readonly storageConfig: LogStorageConfig,
    private readonly options: {
      flushIntervalMs: number;
      batchSize: number;
      enableLocalBackup: boolean;
    } = {
      flushIntervalMs: 30000, // 30 seconds
      batchSize: 100,
      enableLocalBackup: true
    }
  ) {
    super();
    this.startAutoFlush();
  }

  /**
   * Log a complete routing decision
   */
  async logRoutingDecision(
    task: ProcessedTaskInput,
    decision: RoutingDecisionResult,
    ttfbBreakdown: TTFBBreakdown,
    piiRedactionSummary: PIIRedactionSummary
  ): Promise<void> {
    try {
      const log: CompleteRoutingLog = {
        traceId: task.traceId,
        userIdHash: task.session.userId ? this.hashUserId(task.session.userId) : undefined,
        idempotencyKey: task.idempotencyKey,
        
        task: {
          kind: task.task.kind,
          subtype: task.task.subtype,
          tokensIn: task.task.tokensIn,
          longContext: task.task.longContext,
          modality: task.task.modality,
          latencyBudgetMs: task.hints.latencyBudgetMs || 2000,
          costTier: task.hints.costTier || 'mid'
        },
        
        policySnapshot: this.createPolicySnapshot(decision.reasoning.policyMatch),
        poolSnapshot: this.createPoolSnapshot(decision.reasoning.candidateEvaluation),
        healthSnapshot: this.createHealthSnapshot(decision.reasoning.candidateEvaluation),
        
        candidateModels: decision.reasoning.candidateEvaluation.map(this.mapCandidateToEvaluation),
        
        selected: {
          modelId: decision.selectedModel.id,
          providerId: decision.selectedModel.providerId,
          reasons: this.extractSelectionReasons(decision),
          confidence: decision.selectedModel.confidence,
          generationParams: decision.generationParams
        },
        
        fallbackChain: [],
        
        ttfbBreakdown,
        
        costCalculation: this.calculateCostDetails(task, decision),
        
        abTestInfo: decision.metadata.abTestInfo ? this.mapABTestInfo(decision.metadata.abTestInfo) : undefined,
        
        piiRedactionSummary,
        
        routedAt: decision.metadata.decisionTimestamp
      };

      // Add to buffer
      this.logBuffer.set(task.traceId, log);
      
      // Check if buffer is full and needs immediate flush
      if (this.logBuffer.size >= this.maxBufferSize) {
        await this.flushLogs();
      }

      this.emit('decisionLogged', { traceId: task.traceId, bufferSize: this.logBuffer.size });
    } catch (error) {
      this.emit('loggingError', { traceId: task.traceId, error });
      throw error;
    }
  }

  /**
   * Update log with actual performance metrics after execution
   */
  async updateLogWithActualMetrics(
    traceId: string,
    actualMetrics: ActualPerformanceMetrics
  ): Promise<void> {
    const log = this.logBuffer.get(traceId);
    if (!log) {
      // Try to fetch from storage if not in buffer
      const storedLog = await this.getDecisionLog(traceId);
      if (storedLog) {
        storedLog.actualMetrics = actualMetrics;
        await this.persistLog(storedLog);
        return;
      }
      throw new Error(`Log not found for traceId: ${traceId}`);
    }

    log.actualMetrics = actualMetrics;
    
    // Update cost calculation with actual values
    if (actualMetrics.actualTokens && actualMetrics.finalCostUsd) {
      log.costCalculation.actual = {
        inputTokens: actualMetrics.actualTokens.input,
        outputTokens: actualMetrics.actualTokens.output,
        actualCostUsd: actualMetrics.finalCostUsd
      };
    }

    this.emit('logUpdatedWithActuals', { traceId, actualMetrics });
  }

  /**
   * Log fallback attempt
   */
  async logFallbackAttempt(
    traceId: string,
    fallbackAttempt: {
      modelId: string;
      reason: string;
      failureDetails: any;
      attemptedAt: string;
      durationMs: number;
      succeeded: boolean;
    }
  ): Promise<void> {
    const log = this.logBuffer.get(traceId);
    if (!log) {
      this.emit('fallbackLogError', { traceId, reason: 'Log not found in buffer' });
      return;
    }

    log.fallbackChain.push({
      modelId: fallbackAttempt.modelId,
      reason: fallbackAttempt.reason as any,
      failureDetails: fallbackAttempt.failureDetails,
      attemptedAt: fallbackAttempt.attemptedAt,
      durationMs: fallbackAttempt.durationMs,
      succeeded: fallbackAttempt.succeeded
    });

    this.emit('fallbackLogged', { traceId, fallbackCount: log.fallbackChain.length });
  }

  /**
   * Get complete decision log by trace ID
   */
  async getDecisionLog(traceId: string): Promise<CompleteRoutingLog | null> {
    // Check buffer first
    const bufferedLog = this.logBuffer.get(traceId);
    if (bufferedLog) {
      return bufferedLog;
    }

    // Query from BigQuery
    try {
      const query = `
        SELECT *
        FROM \`${this.storageConfig.bigQueryDataset}.${this.storageConfig.bigQueryTable}\`
        WHERE traceId = @traceId
        ORDER BY routedAt DESC
        LIMIT 1
      `;

      const [rows] = await this.bigQueryClient.query({
        query,
        params: { traceId }
      });

      if (rows.length === 0) {
        return null;
      }

      return this.deserializeLogFromBigQuery(rows[0]);
    } catch (error) {
      this.emit('queryError', { traceId, error });
      throw error;
    }
  }

  /**
   * Query decision logs with filters
   */
  async queryDecisionLogs(options: LogQueryOptions): Promise<{
    logs: CompleteRoutingLog[];
    totalCount: number;
    hasMore: boolean;
  }> {
    try {
      const conditions: string[] = [];
      const params: any = {};

      if (options.traceId) {
        conditions.push('traceId = @traceId');
        params.traceId = options.traceId;
      }

      if (options.userIdHash) {
        conditions.push('userIdHash = @userIdHash');
        params.userIdHash = options.userIdHash;
      }

      if (options.modelId) {
        conditions.push('selected.modelId = @modelId');
        params.modelId = options.modelId;
      }

      if (options.providerId) {
        conditions.push('selected.providerId = @providerId');
        params.providerId = options.providerId;
      }

      if (options.timeRange) {
        conditions.push('TIMESTAMP(routedAt) BETWEEN @startDate AND @endDate');
        params.startDate = options.timeRange.startDate.toISOString();
        params.endDate = options.timeRange.endDate.toISOString();
      }

      if (options.successOnly) {
        conditions.push('(actualMetrics IS NULL OR actualMetrics.success = true)');
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const limit = options.limit || 100;
      const offset = options.offset || 0;

      const query = `
        SELECT *
        FROM \`${this.storageConfig.bigQueryDataset}.${this.storageConfig.bigQueryTable}\`
        ${whereClause}
        ORDER BY routedAt DESC
        LIMIT @limit OFFSET @offset
      `;

      const countQuery = `
        SELECT COUNT(*) as total
        FROM \`${this.storageConfig.bigQueryDataset}.${this.storageConfig.bigQueryTable}\`
        ${whereClause}
      `;

      // Execute both queries in parallel
      const [resultsPromise, countPromise] = await Promise.all([
        this.bigQueryClient.query({ query, params: { ...params, limit, offset } }),
        this.bigQueryClient.query({ query: countQuery, params })
      ]);

      const [rows] = resultsPromise;
      const [countRows] = countPromise;
      const totalCount = countRows[0].total;

      const logs = rows.map((row: any) => this.deserializeLogFromBigQuery(row));

      return {
        logs,
        totalCount,
        hasMore: offset + rows.length < totalCount
      };
    } catch (error) {
      this.emit('queryError', { options, error });
      throw error;
    }
  }

  /**
   * Generate analytics from decision logs
   */
  async generateAnalytics(timeRange: { startDate: Date; endDate: Date }): Promise<LogAnalytics> {
    try {
      const analyticsQuery = `
        SELECT
          COUNT(*) as totalDecisions,
          AVG(CASE WHEN actualMetrics.success = true THEN 1.0 ELSE 0.0 END) as successRate,
          AVG(ttfbBreakdown.totalMs) as averageTTFBMs,
          AVG(CASE WHEN actualMetrics.finalCostUsd IS NOT NULL THEN actualMetrics.finalCostUsd ELSE costCalculation.estimated.totalCostUsd END) as averageCostUsd,
          AVG(selected.confidence) as avgConfidenceScore,
          SUM(piiRedactionSummary.totalRedacted) as totalPiiRedactions
        FROM \`${this.storageConfig.bigQueryDataset}.${this.storageConfig.bigQueryTable}\`
        WHERE TIMESTAMP(routedAt) BETWEEN @startDate AND @endDate
      `;

      const topModelsQuery = `
        SELECT
          selected.modelId,
          COUNT(*) as count,
          AVG(CASE WHEN actualMetrics.success = true THEN 1.0 ELSE 0.0 END) as successRate
        FROM \`${this.storageConfig.bigQueryDataset}.${this.storageConfig.bigQueryTable}\`
        WHERE TIMESTAMP(routedAt) BETWEEN @startDate AND @endDate
        GROUP BY selected.modelId
        ORDER BY count DESC
        LIMIT 10
      `;

      const failureReasonsQuery = `
        SELECT
          actualMetrics.error.code as reason,
          COUNT(*) as count
        FROM \`${this.storageConfig.bigQueryDataset}.${this.storageConfig.bigQueryTable}\`
        WHERE TIMESTAMP(routedAt) BETWEEN @startDate AND @endDate
          AND actualMetrics.success = false
        GROUP BY actualMetrics.error.code
        ORDER BY count DESC
        LIMIT 10
      `;

      const params = {
        startDate: timeRange.startDate.toISOString(),
        endDate: timeRange.endDate.toISOString()
      };

      const [analyticsResults, topModelsResults, failureResults] = await Promise.all([
        this.bigQueryClient.query({ query: analyticsQuery, params }),
        this.bigQueryClient.query({ query: topModelsQuery, params }),
        this.bigQueryClient.query({ query: failureReasonsQuery, params })
      ]);

      const [analyticsRow] = analyticsResults[0];
      const [topModelsRows] = topModelsResults;
      const [failureRows] = failureResults;

      return {
        totalDecisions: analyticsRow.totalDecisions || 0,
        successRate: analyticsRow.successRate || 0,
        averageTTFBMs: analyticsRow.averageTTFBMs || 0,
        averageCostUsd: analyticsRow.averageCostUsd || 0,
        avgConfidenceScore: analyticsRow.avgConfidenceScore || 0,
        topModels: topModelsRows.map((row: any) => ({
          modelId: row.modelId,
          count: row.count,
          successRate: row.successRate || 0
        })),
        commonFailureReasons: failureRows.map((row: any) => ({
          reason: row.reason || 'unknown',
          count: row.count
        })),
        piiRedactionStats: {
          totalRedactions: analyticsRow.totalPiiRedactions || 0,
          commonTypes: [] // Would need additional query
        }
      };
    } catch (error) {
      this.emit('analyticsError', { timeRange, error });
      throw error;
    }
  }

  /**
   * Test reproduction capability
   */
  async testReproduction(
    traceId: string,
    routingDecisionEngine: any
  ): Promise<{
    originalDecision: CompleteRoutingLog;
    reproducedDecision: any;
    exactMatch: boolean;
    differences?: any;
  }> {
    const originalLog = await this.getDecisionLog(traceId);
    if (!originalLog) {
      throw new Error(`Decision log not found for traceId: ${traceId}`);
    }

    // Reconstruct task input from log
    const task: ProcessedTaskInput = {
      traceId: originalLog.traceId,
      idempotencyKey: originalLog.idempotencyKey,
      task: originalLog.task,
      cleanContent: { text: 'reproduction_test' }, // Placeholder
      piiRedactionReport: originalLog.piiRedactionSummary.locations,
      hints: {
        priority: 'balanced',
        latencyBudgetMs: originalLog.task.latencyBudgetMs,
        costTier: originalLog.task.costTier
      },
      session: {
        userId: originalLog.userIdHash,
        plan: 'pro', // Default for reproduction
        currentUsage: { inputTokens: 0, outputTokens: 0, monthStart: new Date() },
        requestedAt: new Date()
      }
    };

    try {
      const reproducedDecision = await routingDecisionEngine.reproduceDecision(
        task,
        originalLog.policySnapshot,
        originalLog.poolSnapshot,
        originalLog.healthSnapshot
      );

      const exactMatch = this.compareDecisions(originalLog, reproducedDecision);

      return {
        originalDecision: originalLog,
        reproducedDecision,
        exactMatch,
        differences: exactMatch ? undefined : this.calculateDifferences(originalLog, reproducedDecision)
      };
    } catch (error) {
      this.emit('reproductionTestError', { traceId, error });
      throw error;
    }
  }

  /**
   * Private methods
   */

  private startAutoFlush(): void {
    this.flushTimer = setInterval(async () => {
      if (this.logBuffer.size > 0) {
        try {
          await this.flushLogs();
        } catch (error) {
          this.emit('flushError', error);
        }
      }
    }, this.options.flushIntervalMs);
  }

  private async flushLogs(): Promise<void> {
    if (this.logBuffer.size === 0) return;

    const logsToFlush = Array.from(this.logBuffer.values());
    const batchSize = this.options.batchSize;

    // Process in batches
    for (let i = 0; i < logsToFlush.length; i += batchSize) {
      const batch = logsToFlush.slice(i, i + batchSize);
      try {
        await this.persistLogBatch(batch);
        
        // Remove from buffer after successful persistence
        for (const log of batch) {
          this.logBuffer.delete(log.traceId);
        }
      } catch (error) {
        this.emit('batchPersistError', { batchSize: batch.length, error });
        throw error;
      }
    }

    this.emit('logsFlushed', { count: logsToFlush.length });
  }

  private async persistLogBatch(logs: CompleteRoutingLog[]): Promise<void> {
    // Prepare rows for BigQuery
    const rows = logs.map(log => this.serializeLogForBigQuery(log));

    try {
      await this.bigQueryClient
        .dataset(this.storageConfig.bigQueryDataset)
        .table(this.storageConfig.bigQueryTable)
        .insert(rows);

      // Local backup if enabled
      if (this.options.enableLocalBackup && this.storageConfig.localBackupPath) {
        await this.writeLocalBackup(logs);
      }
    } catch (error) {
      this.emit('persistError', { logsCount: logs.length, error });
      throw error;
    }
  }

  private async persistLog(log: CompleteRoutingLog): Promise<void> {
    await this.persistLogBatch([log]);
  }

  private serializeLogForBigQuery(log: CompleteRoutingLog): any {
    return {
      ...log,
      // Convert complex objects to JSON strings
      policySnapshot: JSON.stringify(log.policySnapshot),
      poolSnapshot: JSON.stringify(log.poolSnapshot),
      healthSnapshot: JSON.stringify(log.healthSnapshot),
      candidateModels: JSON.stringify(log.candidateModels),
      selected: JSON.stringify(log.selected),
      fallbackChain: JSON.stringify(log.fallbackChain),
      ttfbBreakdown: JSON.stringify(log.ttfbBreakdown),
      costCalculation: JSON.stringify(log.costCalculation),
      abTestInfo: log.abTestInfo ? JSON.stringify(log.abTestInfo) : null,
      piiRedactionSummary: JSON.stringify(log.piiRedactionSummary),
      actualMetrics: log.actualMetrics ? JSON.stringify(log.actualMetrics) : null
    };
  }

  private deserializeLogFromBigQuery(row: any): CompleteRoutingLog {
    return {
      ...row,
      // Parse JSON strings back to objects
      policySnapshot: JSON.parse(row.policySnapshot),
      poolSnapshot: JSON.parse(row.poolSnapshot),
      healthSnapshot: JSON.parse(row.healthSnapshot),
      candidateModels: JSON.parse(row.candidateModels),
      selected: JSON.parse(row.selected),
      fallbackChain: JSON.parse(row.fallbackChain),
      ttfbBreakdown: JSON.parse(row.ttfbBreakdown),
      costCalculation: JSON.parse(row.costCalculation),
      abTestInfo: row.abTestInfo ? JSON.parse(row.abTestInfo) : undefined,
      piiRedactionSummary: JSON.parse(row.piiRedactionSummary),
      actualMetrics: row.actualMetrics ? JSON.parse(row.actualMetrics) : undefined
    };
  }

  private async writeLocalBackup(logs: CompleteRoutingLog[]): Promise<void> {
    if (!this.storageConfig.localBackupPath) return;

    const fs = await import('fs/promises');
    const path = await import('path');
    
    const backupDir = this.storageConfig.localBackupPath;
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `decision-logs-${timestamp}.jsonl`;
    const filepath = path.join(backupDir, filename);

    try {
      // Ensure backup directory exists
      await fs.mkdir(backupDir, { recursive: true });

      // Append logs to JSONL file
      const logLines = logs.map(log => JSON.stringify(log)).join('\n') + '\n';
      await fs.appendFile(filepath, logLines, 'utf8');
    } catch (error) {
      this.emit('localBackupError', { filepath, error });
      // Don't throw - local backup is optional
    }
  }

  private hashUserId(userId: string): string {
    return createHash('sha256').update(userId).digest('hex').substring(0, 16);
  }

  private createPolicySnapshot(policyMatch: any): PolicySnapshot {
    return {
      id: policyMatch.policyId || 'default',
      version: policyMatch.policyVersion || '1.0',
      taskMatrix: policyMatch.taskMatrix || {},
      rules: policyMatch.matchedRules || [],
      abTests: policyMatch.abTests || [],
      emergencyOverrides: policyMatch.emergencyOverrides || [],
      snapshotTakenAt: new Date().toISOString()
    };
  }

  private createPoolSnapshot(candidates: any[]): PoolSnapshot {
    return {
      id: 'default',
      version: '1.0',
      models: candidates.map(c => ({
        id: c.model.id,
        providerId: c.model.providerId,
        modelName: c.model.modelName || c.model.id,
        modality: c.model.modality,
        contextWindow: c.model.contextWindow || 4000,
        performance: c.model.performance,
        cost: c.model.cost,
        capabilities: c.model.capabilities,
        defaultParams: c.model.defaultParams
      })),
      constraints: {},
      fallbackStrategy: {},
      snapshotTakenAt: new Date().toISOString()
    };
  }

  private createHealthSnapshot(candidates: any[]): Record<string, ProviderHealthSnapshot> {
    const healthSnapshot: Record<string, ProviderHealthSnapshot> = {};
    
    for (const candidate of candidates) {
      const providerId = candidate.model.providerId;
      
      if (!healthSnapshot[providerId]) {
        healthSnapshot[providerId] = {
          providerId,
          status: 'healthy',
          healthScore: candidate.healthScore || 1.0,
          latencyP95Ms: candidate.model.performance?.estimatedTTFBMs || 1000,
          errorRate5min: 0.01,
          circuitBreakerState: candidate.circuitState?.status || 'closed',
          snapshotTakenAt: new Date().toISOString()
        };
      }
    }
    
    return healthSnapshot;
  }

  private mapCandidateToEvaluation(candidate: any): CandidateEvaluation {
    return {
      modelId: candidate.model.id,
      providerId: candidate.model.providerId,
      score: candidate.selectionScore || 0,
      scoring: {
        latencyScore: 0.8, // Would be calculated
        costScore: 0.7,
        qualityScore: candidate.model.performance?.qualityScore || 0.8,
        healthScore: candidate.healthScore || 1.0,
        capabilityScore: 1.0
      },
      reasons: candidate.reasons || [],
      estimates: {
        ttfbMs: candidate.model.performance?.estimatedTTFBMs || 1000,
        costUsd: 0.01, // Would be calculated
        qualityScore: candidate.model.performance?.qualityScore || 0.8
      },
      selectionStatus: candidate.available ? 
        (candidate.model.id === candidate.selectedModelId ? 'selected' : 'backup') : 
        'unavailable'
    };
  }

  private extractSelectionReasons(decision: RoutingDecisionResult): string[] {
    const reasons = ['Selected as optimal candidate'];
    
    if (decision.reasoning.decisionFactors) {
      for (const factor of decision.reasoning.decisionFactors) {
        if (factor.impact === 'positive') {
          reasons.push(`${factor.factor}: ${factor.description}`);
        }
      }
    }
    
    return reasons;
  }

  private calculateCostDetails(task: ProcessedTaskInput, decision: RoutingDecisionResult): CostCalculationDetails {
    const estimatedInputCost = (task.task.tokensIn / 1000000) * 0.5; // Rough estimate
    const estimatedOutputCost = (2000 / 1000000) * 1.5; // Rough estimate
    
    return {
      estimated: {
        inputTokensCost: estimatedInputCost,
        outputTokensCost: estimatedOutputCost,
        fixedCost: 0,
        totalCostUsd: decision.selectedModel.estimatedCostUsd
      },
      tierUsed: task.hints.costTier || 'mid',
      freeQuotaApplied: {
        inputTokens: 0,
        outputTokens: 0,
        totalSavedUsd: 0
      },
      quotaStatus: {
        remainingInputTokens: 10000,
        remainingOutputTokens: 10000,
        quotaResetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      }
    };
  }

  private mapABTestInfo(abTestInfo: any): ABTestExecution {
    return {
      testName: abTestInfo.testName,
      testGroup: abTestInfo.group,
      shadowOnly: abTestInfo.shadowOnly,
      testConfig: abTestInfo
    };
  }

  private compareDecisions(original: CompleteRoutingLog, reproduced: any): boolean {
    return (
      original.selected.modelId === reproduced.selectedModel.id &&
      JSON.stringify(original.selected.generationParams) === JSON.stringify(reproduced.generationParams)
    );
  }

  private calculateDifferences(original: CompleteRoutingLog, reproduced: any): any {
    return {
      modelChanged: original.selected.modelId !== reproduced.selectedModel.id,
      originalModel: original.selected.modelId,
      reproducedModel: reproduced.selectedModel.id,
      parametersDifferent: JSON.stringify(original.selected.generationParams) !== JSON.stringify(reproduced.generationParams)
    };
  }

  /**
   * Cleanup method
   */
  async cleanup(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
    
    // Final flush
    if (this.logBuffer.size > 0) {
      await this.flushLogs();
    }
    
    this.emit('cleanup');
  }
}