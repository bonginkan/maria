/**
 * BigQuerySink - Structured event logging to BigQuery
 * Exports telemetry data for analytics and monitoring
 */

export interface BigQueryEvent {
  eventId: string;
  eventType: 'plan' | 'execute' | 'rollback' | 'error' | 'recovery';
  timestamp: string;
  sessionId: string;
  userId?: string;
  
  // Core metrics
  taskType?: string;
  operation?: string;
  success: boolean;
  durationMs?: number;
  
  // Model metrics
  modelUsed?: string;
  tokensUsed?: number;
  tokenCost?: number;
  
  // Risk & governance
  riskLevel?: 'low' | 'medium' | 'high';
  requiresApproval?: boolean;
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  
  // Error details
  errorCode?: string;
  errorMessage?: string;
  stackTrace?: string;
  recoveryStrategy?: 'auto_fix' | 'rollback' | 'manual';
  
  // Metadata
  projectId?: string;
  repoDigest?: string;
  branchName?: string;
  filesAffected?: string[];
  locChanged?: number;
}

export interface BigQuerySchema {
  tableName: string;
  dataset: string;
  fields: Array<{
    name: string;
    type: 'STRING' | 'INTEGER' | 'FLOAT' | 'TIMESTAMP' | 'BOOLEAN' | 'ARRAY';
    mode: 'REQUIRED' | 'NULLABLE' | 'REPEATED';
  }>;
}

export class BigQuerySink {
  private static instance: BigQuerySink;
  private eventQueue: BigQueryEvent[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  
  private readonly schema: BigQuerySchema = {
    tableName: 'autonomous_agent_events',
    dataset: 'maria_telemetry',
    fields: [
      { name: 'eventId', type: 'STRING', mode: 'REQUIRED' },
      { name: 'eventType', type: 'STRING', mode: 'REQUIRED' },
      { name: 'timestamp', type: 'TIMESTAMP', mode: 'REQUIRED' },
      { name: 'sessionId', type: 'STRING', mode: 'REQUIRED' },
      { name: 'userId', type: 'STRING', mode: 'NULLABLE' },
      { name: 'taskType', type: 'STRING', mode: 'NULLABLE' },
      { name: 'operation', type: 'STRING', mode: 'NULLABLE' },
      { name: 'success', type: 'BOOLEAN', mode: 'REQUIRED' },
      { name: 'durationMs', type: 'INTEGER', mode: 'NULLABLE' },
      { name: 'modelUsed', type: 'STRING', mode: 'NULLABLE' },
      { name: 'tokensUsed', type: 'INTEGER', mode: 'NULLABLE' },
      { name: 'tokenCost', type: 'FLOAT', mode: 'NULLABLE' },
      { name: 'riskLevel', type: 'STRING', mode: 'NULLABLE' },
      { name: 'requiresApproval', type: 'BOOLEAN', mode: 'NULLABLE' },
      { name: 'approvalStatus', type: 'STRING', mode: 'NULLABLE' },
      { name: 'errorCode', type: 'STRING', mode: 'NULLABLE' },
      { name: 'errorMessage', type: 'STRING', mode: 'NULLABLE' },
      { name: 'stackTrace', type: 'STRING', mode: 'NULLABLE' },
      { name: 'recoveryStrategy', type: 'STRING', mode: 'NULLABLE' },
      { name: 'projectId', type: 'STRING', mode: 'NULLABLE' },
      { name: 'repoDigest', type: 'STRING', mode: 'NULLABLE' },
      { name: 'branchName', type: 'STRING', mode: 'NULLABLE' },
      { name: 'filesAffected', type: 'STRING', mode: 'REPEATED' },
      { name: 'locChanged', type: 'INTEGER', mode: 'NULLABLE' }
    ]
  };
  
  private constructor(
    private config: {
      batchSize?: number;
      flushIntervalMs?: number;
      enabled?: boolean;
      projectId?: string;
      credentials?: object;
    } = {}
  ) {
    this.config.batchSize = config.batchSize || 100;
    this.config.flushIntervalMs = config.flushIntervalMs || 5000;
    this.config.enabled = config.enabled ?? false;
    
    if (this.config.enabled) {
      this.initialize();
    }
  }
  
  /**
   * Get singleton instance
   */
  static getInstance(config?: any): BigQuerySink {
    if (!BigQuerySink.instance) {
      BigQuerySink.instance = new BigQuerySink(config);
    }
    return BigQuerySink.instance;
  }
  
  /**
   * Initialize BigQuery connection
   */
  private initialize(): void {
    // In production, initialize BigQuery client here
    console.log('[BigQuery] Sink initialized');
    
    // Start batch timer
    this.startBatchTimer();
  }
  
  /**
   * Log an event
   */
  logEvent(event: Partial<BigQueryEvent>): void {
    if (!this.config.enabled) {
      return;
    }
    
    const fullEvent: BigQueryEvent = {
      eventId: this.generateEventId(),
      timestamp: new Date().toISOString(),
      success: false,
      ...event
    } as BigQueryEvent;
    
    this.eventQueue.push(fullEvent);
    
    // Flush if batch size reached
    if (this.eventQueue.length >= this.config.batchSize!) {
      this.flush();
    }
  }
  
  /**
   * Log a plan generation event
   */
  logPlanGeneration(
    sessionId: string,
    taskType: string,
    success: boolean,
    durationMs: number,
    details?: Partial<BigQueryEvent>
  ): void {
    this.logEvent({
      eventType: 'plan',
      sessionId,
      taskType,
      success,
      durationMs,
      ...details
    });
  }
  
  /**
   * Log an execution event
   */
  logExecution(
    sessionId: string,
    operation: string,
    success: boolean,
    durationMs: number,
    details?: Partial<BigQueryEvent>
  ): void {
    this.logEvent({
      eventType: 'execute',
      sessionId,
      operation,
      success,
      durationMs,
      ...details
    });
  }
  
  /**
   * Log an error event
   */
  logError(
    sessionId: string,
    errorCode: string,
    errorMessage: string,
    stackTrace?: string,
    recoveryStrategy?: BigQueryEvent['recoveryStrategy']
  ): void {
    this.logEvent({
      eventType: 'error',
      sessionId,
      success: false,
      errorCode,
      errorMessage,
      stackTrace,
      recoveryStrategy
    });
  }
  
  /**
   * Log a rollback event
   */
  logRollback(
    sessionId: string,
    operation: string,
    reason: string,
    filesAffected?: string[]
  ): void {
    this.logEvent({
      eventType: 'rollback',
      sessionId,
      operation,
      success: false,
      errorMessage: reason,
      filesAffected
    });
  }
  
  /**
   * Flush events to BigQuery
   */
  private async flush(): Promise<void> {
    if (this.eventQueue.length === 0) {
      return;
    }
    
    const events = [...this.eventQueue];
    this.eventQueue = [];
    
    try {
      // In production, send to BigQuery here
      console.log(`[BigQuery] Flushing ${events.length} events`);
      
      // Simulate BigQuery insert
      await this.simulateBigQueryInsert(events);
      
    } catch (error) {
      console.error('[BigQuery] Flush failed:', error);
      // Re-queue events on failure
      this.eventQueue = [...events, ...this.eventQueue];
    }
  }
  
  /**
   * Simulate BigQuery insert (for development)
   */
  private async simulateBigQueryInsert(events: BigQueryEvent[]): Promise<void> {
    // In production, this would use the actual BigQuery client
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log(`[BigQuery] Inserted ${events.length} rows`);
        resolve();
      }, 100);
    });
  }
  
  /**
   * Start batch timer
   */
  private startBatchTimer(): void {
    this.batchTimer = setInterval(() => {
      this.flush();
    }, this.config.flushIntervalMs!);
  }
  
  /**
   * Stop batch timer
   */
  stopBatchTimer(): void {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }
  }
  
  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Get analytics query examples
   */
  getAnalyticsQueries(): Record<string, string> {
    return {
      successRate: `
        SELECT 
          DATE(timestamp) as date,
          COUNTIF(success) / COUNT(*) as success_rate
        FROM \`${this.schema.dataset}.${this.schema.tableName}\`
        WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
        GROUP BY date
        ORDER BY date DESC
      `,
      
      latencyPercentiles: `
        SELECT
          APPROX_QUANTILES(durationMs, 100)[OFFSET(50)] as p50,
          APPROX_QUANTILES(durationMs, 100)[OFFSET(95)] as p95,
          APPROX_QUANTILES(durationMs, 100)[OFFSET(99)] as p99
        FROM \`${this.schema.dataset}.${this.schema.tableName}\`
        WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 DAY)
          AND durationMs IS NOT NULL
      `,
      
      errorsByType: `
        SELECT
          errorCode,
          COUNT(*) as error_count,
          ANY_VALUE(errorMessage) as sample_message
        FROM \`${this.schema.dataset}.${this.schema.tableName}\`
        WHERE eventType = 'error'
          AND timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 DAY)
        GROUP BY errorCode
        ORDER BY error_count DESC
      `,
      
      tokenUsageByModel: `
        SELECT
          modelUsed,
          SUM(tokensUsed) as total_tokens,
          SUM(tokenCost) as total_cost,
          COUNT(*) as request_count
        FROM \`${this.schema.dataset}.${this.schema.tableName}\`
        WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
          AND modelUsed IS NOT NULL
        GROUP BY modelUsed
        ORDER BY total_tokens DESC
      `,
      
      rollbackFrequency: `
        SELECT
          DATE(timestamp) as date,
          COUNT(*) as rollback_count,
          ARRAY_AGG(DISTINCT operation IGNORE NULLS) as operations
        FROM \`${this.schema.dataset}.${this.schema.tableName}\`
        WHERE eventType = 'rollback'
          AND timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
        GROUP BY date
        ORDER BY date DESC
      `
    };
  }
}