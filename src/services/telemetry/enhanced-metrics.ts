/**
 * Maria CLI v3.9.0 - Enhanced Telemetry Metrics System
 * Collects comprehensive metrics for command execution, user behavior, and system performance
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import * as os from 'os';

// Optional BigQuery import
let BigQuery: any;
try {
  const bigqueryModule = await import('@google-cloud/bigquery');
  BigQuery = bigqueryModule.BigQuery;
} catch {
  // BigQuery not available
}

export interface CommandMetrics {
  // Basic metrics
  commandName: string;
  category: string;
  timestamp: Date;
  executionId: string;
  sessionId: string;
  userId: string;
  
  // Performance metrics
  startTime: number;
  endTime: number;
  responseTimeMs: number;
  cpuUsagePercent: number;
  memoryUsageMB: number;
  
  // Execution details
  success: boolean;
  errorType?: string;
  errorMessage?: string;
  errorStack?: string;
  retryCount: number;
  
  // User interaction
  inputMethod: 'cli' | 'api' | 'ui' | 'automated';
  argumentsProvided: string[];
  flagsUsed: string[];
  interactiveMode: boolean;
  
  // Quality metrics
  outputSize: number;
  warningsCount: number;
  validationErrors: number;
  userFeedback?: 'positive' | 'negative' | 'neutral';
  
  // Context
  environment: 'development' | 'staging' | 'production';
  clientVersion: string;
  platform: string;
  nodeVersion: string;
  
  // Feature usage
  featuresUsed: string[];
  apiCallsMade: number;
  cacheHits: number;
  cacheMisses: number;
  
  // Business metrics
  planTier: 'free' | 'starter' | 'pro' | 'enterprise';
  organizationId?: string;
  teamSize?: number;
  monthlyUsage: number;
}

export interface SystemMetrics {
  timestamp: Date;
  cpuUsage: number;
  memoryUsage: number;
  activeConnections: number;
  queuedCommands: number;
  errorRate: number;
  avgResponseTime: number;
  throughput: number;
}

export interface UserBehaviorMetrics {
  userId: string;
  sessionId: string;
  timestamp: Date;
  
  // Session data
  sessionDuration: number;
  commandsExecuted: number;
  commandSequence: string[];
  
  // Engagement
  helpCommandsUsed: number;
  documentationViewed: boolean;
  tutorialCompleted: boolean;
  
  // Patterns
  mostUsedCommands: { command: string; count: number }[];
  peakUsageHour: number;
  avgSessionLength: number;
  
  // Satisfaction
  npsScore?: number;
  feedbackProvided: boolean;
  issuesReported: number;
}

export interface FeatureAdoptionMetrics {
  featureName: string;
  timestamp: Date;
  
  // Adoption
  totalUsers: number;
  activeUsers: number;
  newUsers: number;
  returningUsers: number;
  
  // Usage
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  avgExecutionTime: number;
  
  // Trends
  dailyGrowthRate: number;
  weeklyGrowthRate: number;
  monthlyGrowthRate: number;
  
  // Quality
  errorRate: number;
  satisfactionScore: number;
  completionRate: number;
}

export class EnhancedTelemetryService extends EventEmitter {
  private bigquery: any | null = null;
  private metricsQueue: CommandMetrics[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private sessionMetrics: Map<string, any> = new Map();
  private isEnabled: boolean;
  
  constructor(private config: {
    enabled?: boolean;
    projectId?: string;
    datasetId?: string;
    batchSize?: number;
    flushIntervalMs?: number;
    enableRealtime?: boolean;
  } = {}) {
    super();
    
    this.isEnabled = config.enabled ?? true;
    
    if (this.isEnabled && config.projectId && BigQuery) {
      this.bigquery = new BigQuery({
        projectId: config.projectId
      });
      
      // Start flush interval
      this.startFlushInterval();
    }
  }
  
  /**
   * Track command execution
   */
  public async trackCommand(
    commandName: string,
    category: string,
    context: any
  ): Promise<{ stop: () => Promise<CommandMetrics> }> {
    if (!this.isEnabled) {
      return { stop: async () => this.createEmptyMetrics(commandName, category) };
    }
    
    const startTime = performance.now();
    const executionId = this.generateExecutionId();
    const sessionId = context.sessionId || this.generateSessionId();
    const userId = context.userId || 'anonymous';
    
    // Capture initial system state
    const initialCpuUsage = process.cpuUsage();
    const initialMemory = process.memoryUsage();
    
    // Create metrics object
    const metrics: Partial<CommandMetrics> = {
      commandName,
      category,
      timestamp: new Date(),
      executionId,
      sessionId,
      userId,
      startTime,
      
      // Context
      environment: (process.env.NODE_ENV as any) || 'production',
      clientVersion: context.version || 'unknown',
      platform: os.platform(),
      nodeVersion: process.version,
      
      // User context
      inputMethod: context.inputMethod || 'cli',
      argumentsProvided: context.args || [],
      flagsUsed: context.flags || [],
      interactiveMode: context.interactive || false,
      
      // Business context
      planTier: context.planTier || 'free',
      organizationId: context.organizationId,
      teamSize: context.teamSize,
      
      // Initialize counters
      retryCount: 0,
      apiCallsMade: 0,
      cacheHits: 0,
      cacheMisses: 0,
      warningsCount: 0,
      validationErrors: 0,
      featuresUsed: []
    };
    
    // Return stop function
    return {
      stop: async () => {
        const endTime = performance.now();
        const finalCpuUsage = process.cpuUsage(initialCpuUsage);
        const finalMemory = process.memoryUsage();
        
        // Calculate metrics
        metrics.endTime = endTime;
        metrics.responseTimeMs = endTime - startTime;
        metrics.cpuUsagePercent = (finalCpuUsage.user + finalCpuUsage.system) / 1000000; // Convert to percentage
        metrics.memoryUsageMB = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;
        
        // Get monthly usage
        metrics.monthlyUsage = await this.getMonthlyUsage(userId);
        
        // Add to queue
        const completeMetrics = metrics as CommandMetrics;
        this.metricsQueue.push(completeMetrics);
        
        // Emit for real-time processing
        if (this.config.enableRealtime) {
          this.emit('command:tracked', completeMetrics);
        }
        
        // Flush if batch size reached
        if (this.metricsQueue.length >= (this.config.batchSize || 100)) {
          await this.flush();
        }
        
        return completeMetrics;
      }
    };
  }
  
  /**
   * Track feature usage
   */
  public trackFeatureUsage(featureName: string, userId: string): void {
    if (!this.isEnabled) return;
    
    this.emit('feature:used', {
      featureName,
      userId,
      timestamp: new Date()
    });
  }
  
  /**
   * Track API calls
   */
  public trackApiCall(endpoint: string, success: boolean, responseTime: number): void {
    if (!this.isEnabled) return;
    
    this.emit('api:called', {
      endpoint,
      success,
      responseTime,
      timestamp: new Date()
    });
  }
  
  /**
   * Track cache performance
   */
  public trackCache(hit: boolean, key: string): void {
    if (!this.isEnabled) return;
    
    this.emit('cache:accessed', {
      hit,
      key,
      timestamp: new Date()
    });
  }
  
  /**
   * Track user feedback
   */
  public trackFeedback(
    commandName: string,
    feedback: 'positive' | 'negative' | 'neutral',
    userId: string
  ): void {
    if (!this.isEnabled) return;
    
    this.emit('feedback:received', {
      commandName,
      feedback,
      userId,
      timestamp: new Date()
    });
  }
  
  /**
   * Track errors
   */
  public trackError(
    commandName: string,
    error: Error,
    context: any
  ): void {
    if (!this.isEnabled) return;
    
    this.emit('error:occurred', {
      commandName,
      errorType: error.name,
      errorMessage: error.message,
      errorStack: error.stack,
      context,
      timestamp: new Date()
    });
  }
  
  /**
   * Get system metrics
   */
  public getSystemMetrics(): SystemMetrics {
    const cpuUsage = os.loadavg()[0];
    const memoryUsage = (os.totalmem() - os.freemem()) / os.totalmem() * 100;
    
    // Calculate from recent metrics
    const recentMetrics = this.metricsQueue.slice(-100);
    const successfulCommands = recentMetrics.filter(m => m.success).length;
    const errorRate = recentMetrics.length > 0 
      ? (recentMetrics.length - successfulCommands) / recentMetrics.length 
      : 0;
    
    const avgResponseTime = recentMetrics.length > 0
      ? recentMetrics.reduce((sum, m) => sum + m.responseTimeMs, 0) / recentMetrics.length
      : 0;
    
    return {
      timestamp: new Date(),
      cpuUsage,
      memoryUsage,
      activeConnections: this.sessionMetrics.size,
      queuedCommands: this.metricsQueue.length,
      errorRate,
      avgResponseTime,
      throughput: recentMetrics.length
    };
  }
  
  /**
   * Get user behavior metrics
   */
  public getUserBehaviorMetrics(userId: string, sessionId: string): UserBehaviorMetrics | null {
    const session = this.sessionMetrics.get(sessionId);
    if (!session) return null;
    
    return {
      userId,
      sessionId,
      timestamp: new Date(),
      sessionDuration: Date.now() - session.startTime,
      commandsExecuted: session.commands.length,
      commandSequence: session.commands,
      helpCommandsUsed: session.commands.filter((c: string) => c.includes('help')).length,
      documentationViewed: session.docsViewed || false,
      tutorialCompleted: session.tutorialCompleted || false,
      mostUsedCommands: this.getMostUsedCommands(session.commands),
      peakUsageHour: new Date().getHours(),
      avgSessionLength: session.avgLength || 0,
      npsScore: session.npsScore,
      feedbackProvided: session.feedbackProvided || false,
      issuesReported: session.issuesReported || 0
    };
  }
  
  /**
   * Get feature adoption metrics
   */
  public async getFeatureAdoptionMetrics(featureName: string): Promise<FeatureAdoptionMetrics> {
    // This would typically query from BigQuery
    // For now, return mock data
    return {
      featureName,
      timestamp: new Date(),
      totalUsers: 1000,
      activeUsers: 750,
      newUsers: 50,
      returningUsers: 700,
      totalExecutions: 10000,
      successfulExecutions: 9500,
      failedExecutions: 500,
      avgExecutionTime: 250,
      dailyGrowthRate: 0.05,
      weeklyGrowthRate: 0.15,
      monthlyGrowthRate: 0.40,
      errorRate: 0.05,
      satisfactionScore: 0.85,
      completionRate: 0.95
    };
  }
  
  /**
   * Flush metrics to BigQuery
   */
  private async flush(): Promise<void> {
    if (this.metricsQueue.length === 0 || !this.bigquery) return;
    
    const dataset = this.bigquery.dataset(this.config.datasetId || 'telemetry');
    const table = dataset.table('command_metrics');
    
    try {
      // Insert metrics in batch
      await table.insert(this.metricsQueue);
      
      console.log(`✅ Flushed ${this.metricsQueue.length} metrics to BigQuery`);
      
      // Clear queue
      this.metricsQueue = [];
    } catch (error) {
      console.error('Failed to flush metrics:', error);
      // Keep metrics in queue for retry
    }
  }
  
  /**
   * Start flush interval
   */
  private startFlushInterval(): void {
    if (this.flushInterval) return;
    
    this.flushInterval = setInterval(
      () => this.flush(),
      this.config.flushIntervalMs || 60000 // Default 1 minute
    );
  }
  
  /**
   * Stop telemetry service
   */
  public async stop(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    
    // Final flush
    await this.flush();
  }
  
  /**
   * Generate execution ID
   */
  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Get monthly usage for user
   */
  private async getMonthlyUsage(userId: string): Promise<number> {
    // This would typically query from database
    // For now, return mock data
    return Math.floor(Math.random() * 1000);
  }
  
  /**
   * Get most used commands from array
   */
  private getMostUsedCommands(commands: string[]): { command: string; count: number }[] {
    const counts = commands.reduce((acc, cmd) => {
      acc[cmd] = (acc[cmd] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(counts)
      .map(([command, count]) => ({ command, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }
  
  /**
   * Create empty metrics for disabled telemetry
   */
  private createEmptyMetrics(commandName: string, category: string): CommandMetrics {
    return {
      commandName,
      category,
      timestamp: new Date(),
      executionId: '',
      sessionId: '',
      userId: '',
      startTime: 0,
      endTime: 0,
      responseTimeMs: 0,
      cpuUsagePercent: 0,
      memoryUsageMB: 0,
      success: true,
      retryCount: 0,
      inputMethod: 'cli',
      argumentsProvided: [],
      flagsUsed: [],
      interactiveMode: false,
      outputSize: 0,
      warningsCount: 0,
      validationErrors: 0,
      environment: 'production',
      clientVersion: '',
      platform: '',
      nodeVersion: '',
      featuresUsed: [],
      apiCallsMade: 0,
      cacheHits: 0,
      cacheMisses: 0,
      planTier: 'free',
      monthlyUsage: 0
    };
  }
}

// Export singleton instance
export const telemetryService = new EnhancedTelemetryService({
  enabled: process.env.TELEMETRY_ENABLED !== 'false',
  projectId: process.env.GOOGLE_CLOUD_PROJECT,
  datasetId: process.env.TELEMETRY_DATASET || 'maria_telemetry',
  batchSize: 100,
  flushIntervalMs: 60000,
  enableRealtime: process.env.TELEMETRY_REALTIME === 'true'
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await telemetryService.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await telemetryService.stop();
  process.exit(0);
});