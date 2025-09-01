/**
 * Usage Tracker for FREE Plan
 * Tracks and enforces usage limits for all resources
 */

import * as fs from 'fs';
import * as path from 'path';

export interface UsageRecord {
  userId: string;
  period: string; // YYYY-MM format
  buckets: {
    req: number;
    tokens: number;
    code: number;
    attachment: number;
    image: number;
    video: number;
  };
  details: {
    models: Record<string, number>;
    commands: Record<string, number>;
    errors: Record<string, number>;
  };
  lastUpdated: number;
}

export interface ConsumptionRequest {
  userId: string;
  type: 'req' | 'tokens' | 'code' | 'image' | 'video' | 'attachment';
  amount: number;
  metadata?: {
    model?: string;
    command?: string;
    tokensUsed?: number;
    error?: string;
  };
}

export interface UsageCheckResult {
  allowed: boolean;
  current: number;
  limit: number;
  remaining: number;
  periodEnd: Date;
  message?: string;
}

/**
 * File-based usage store (for development)
 * In production, use Firestore or similar
 */
class UsageStore {
  private dataDir: string;
  private cache: Map<string, UsageRecord> = new Map();
  
  constructor(dataDir: string = './data/usage') {
    this.dataDir = dataDir;
    this.ensureDataDir();
  }
  
  private ensureDataDir(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }
  
  private getUserPeriodKey(userId: string, period?: string): string {
    const p = period || this.getCurrentPeriod();
    return `${userId}_${p}`;
  }
  
  private getCurrentPeriod(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
  
  private getFilePath(key: string): string {
    return path.join(this.dataDir, `${key}.json`);
  }
  
  async getUsage(userId: string, period?: string): Promise<UsageRecord> {
    const key = this.getUserPeriodKey(userId, period);
    
    // Check cache
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }
    
    // Check file
    const filePath = this.getFilePath(key);
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      this.cache.set(key, data);
      return data;
    }
    
    // Create new record
    const newRecord: UsageRecord = {
      userId,
      period: period || this.getCurrentPeriod(),
      buckets: {
        req: 0,
        tokens: 0,
        code: 0,
        attachment: 0,
        image: 0,
        video: 0
      },
      details: {
        models: {},
        commands: {},
        errors: {}
      },
      lastUpdated: Date.now()
    };
    
    this.cache.set(key, newRecord);
    this.saveRecord(key, newRecord);
    
    return newRecord;
  }
  
  async updateUsage(
    userId: string,
    updates: Partial<UsageRecord>,
    period?: string
  ): Promise<UsageRecord> {
    const record = await this.getUsage(userId, period);
    
    // Merge updates
    if (updates.buckets) {
      Object.assign(record.buckets, updates.buckets);
    }
    
    if (updates.details) {
      if (updates.details.models) {
        Object.assign(record.details.models, updates.details.models);
      }
      if (updates.details.commands) {
        Object.assign(record.details.commands, updates.details.commands);
      }
      if (updates.details.errors) {
        Object.assign(record.details.errors, updates.details.errors);
      }
    }
    
    record.lastUpdated = Date.now();
    
    // Save
    const key = this.getUserPeriodKey(userId, period);
    this.cache.set(key, record);
    this.saveRecord(key, record);
    
    return record;
  }
  
  async incrementUsage(
    userId: string,
    bucket: keyof UsageRecord['buckets'],
    amount: number = 1,
    period?: string
  ): Promise<UsageRecord> {
    const record = await this.getUsage(userId, period);
    record.buckets[bucket] += amount;
    record.lastUpdated = Date.now();
    
    const key = this.getUserPeriodKey(userId, period);
    this.cache.set(key, record);
    this.saveRecord(key, record);
    
    return record;
  }
  
  private saveRecord(key: string, record: UsageRecord): void {
    const filePath = this.getFilePath(key);
    fs.writeFileSync(filePath, JSON.stringify(record, null, 2));
  }
  
  async clearCache(): Promise<void> {
    this.cache.clear();
  }
}

/**
 * Main Usage Tracker
 */
export class UsageTracker {
  private store: UsageStore;
  private planLimits: Map<string, any> = new Map();
  
  constructor(storeDir?: string) {
    this.store = new UsageStore(storeDir);
    this.loadPlanLimits();
  }
  
  private loadPlanLimits(): void {
    // Load FREE plan limits (in production, load from Firestore)
    this.planLimits.set('free', {
      buckets: {
        req: 100,
        tokens: 150000,
        code: 20,
        attachment: 5,
        image: 25,
        video: 5
      }
    });
    
    this.planLimits.set('pro', {
      buckets: {
        req: 1000,
        tokens: 2000000,
        code: 200,
        attachment: 50,
        image: 100,
        video: 20
      }
    });
  }
  
  /**
   * Check if user can consume resources
   */
  async checkUsage(
    userId: string,
    type: keyof UsageRecord['buckets'],
    amount: number = 1,
    planId: string = 'free'
  ): Promise<UsageCheckResult> {
    const usage = await this.store.getUsage(userId);
    const limits = this.planLimits.get(planId)?.buckets || this.planLimits.get('free')!.buckets;
    
    const current = usage.buckets[type];
    const limit = limits[type];
    const wouldBe = current + amount;
    
    // Calculate period end
    const [year, month] = usage.period.split('-').map(Number);
    const periodEnd = new Date(year, month, 0); // Last day of month
    
    if (wouldBe > limit) {
      return {
        allowed: false,
        current,
        limit,
        remaining: Math.max(0, limit - current),
        periodEnd,
        message: `Monthly ${type} limit exceeded (${current}/${limit}). Resets on ${periodEnd.toLocaleDateString()}.`
      };
    }
    
    return {
      allowed: true,
      current,
      limit,
      remaining: limit - wouldBe,
      periodEnd
    };
  }
  
  /**
   * Consume resources
   */
  async consume(request: ConsumptionRequest): Promise<UsageRecord> {
    const { userId, type, amount, metadata } = request;
    
    // Update bucket
    const record = await this.store.incrementUsage(userId, type, amount);
    
    // Update details if metadata provided
    if (metadata) {
      const updates: Partial<UsageRecord> = {
        details: {
          models: {},
          commands: {},
          errors: {}
        }
      };
      
      if (metadata.model) {
        updates.details!.models![metadata.model] = 
          (record.details.models[metadata.model] || 0) + amount;
      }
      
      if (metadata.command) {
        updates.details!.commands![metadata.command] = 
          (record.details.commands[metadata.command] || 0) + 1;
      }
      
      if (metadata.error) {
        updates.details!.errors![metadata.error] = 
          (record.details.errors[metadata.error] || 0) + 1;
      }
      
      await this.store.updateUsage(userId, updates);
    }
    
    return record;
  }
  
  /**
   * Get usage summary for user
   */
  async getUsageSummary(userId: string, planId: string = 'free'): Promise<any> {
    const usage = await this.store.getUsage(userId);
    const limits = this.planLimits.get(planId)?.buckets || this.planLimits.get('free')!.buckets;
    
    const summary: any = {
      period: usage.period,
      lastUpdated: new Date(usage.lastUpdated),
      buckets: {}
    };
    
    // Calculate usage percentages
    for (const [key, value] of Object.entries(usage.buckets)) {
      const limit = limits[key];
      summary.buckets[key] = {
        used: value,
        limit,
        remaining: Math.max(0, limit - value),
        percentage: Math.round((value / limit) * 100)
      };
    }
    
    // Add top models and commands
    summary.topModels = Object.entries(usage.details.models)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([model, count]) => ({ model, count }));
    
    summary.topCommands = Object.entries(usage.details.commands)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([command, count]) => ({ command, count }));
    
    // Add error summary
    summary.errors = Object.entries(usage.details.errors)
      .map(([error, count]) => ({ error, count }));
    
    return summary;
  }
  
  /**
   * Reset usage for new period
   */
  async resetUsage(userId: string): Promise<void> {
    await this.store.clearCache();
  }
  
  /**
   * Get all users' usage for admin
   */
  async getAllUsage(period?: string): Promise<UsageRecord[]> {
    // In production, query from database
    // For now, return empty array
    return [];
  }
}

/**
 * Usage Telemetry Collector
 */
export class UsageTelemetry {
  private events: any[] = [];
  private readonly maxEvents = 10000;
  
  /**
   * Track command execution
   */
  trackCommand(
    userId: string,
    command: string,
    success: boolean,
    metadata?: any
  ): void {
    this.addEvent({
      type: 'command',
      userId,
      command,
      success,
      metadata,
      timestamp: Date.now()
    });
  }
  
  /**
   * Track model usage
   */
  trackModelUsage(
    userId: string,
    model: string,
    type: 'text' | 'image' | 'video',
    tokensUsed?: number,
    latencyMs?: number
  ): void {
    this.addEvent({
      type: 'model',
      userId,
      model,
      modelType: type,
      tokensUsed,
      latencyMs,
      timestamp: Date.now()
    });
  }
  
  /**
   * Track errors
   */
  trackError(
    userId: string,
    error: string,
    context?: any
  ): void {
    this.addEvent({
      type: 'error',
      userId,
      error,
      context,
      timestamp: Date.now()
    });
  }
  
  /**
   * Track rate limits
   */
  trackRateLimit(
    userId: string,
    planId: string,
    retryAfter: number
  ): void {
    this.addEvent({
      type: 'rateLimit',
      userId,
      planId,
      retryAfter,
      timestamp: Date.now()
    });
  }
  
  /**
   * Track quota exceeded
   */
  trackQuotaExceeded(
    userId: string,
    bucketType: string,
    current: number,
    limit: number
  ): void {
    this.addEvent({
      type: 'quotaExceeded',
      userId,
      bucketType,
      current,
      limit,
      timestamp: Date.now()
    });
  }
  
  /**
   * Add event to buffer
   */
  private addEvent(event: any): void {
    this.events.push(event);
    
    // Keep only recent events
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }
    
    // Log in development
    if (process.env.NODE_ENV === 'development') {
      console.debug('[Telemetry]', event);
    }
  }
  
  /**
   * Get events for analysis
   */
  getEvents(
    filter?: { type?: string; userId?: string; since?: number }
  ): any[] {
    let filtered = [...this.events];
    
    if (filter) {
      if (filter.type) {
        filtered = filtered.filter(e => e.type === filter.type);
      }
      if (filter.userId) {
        filtered = filtered.filter(e => e.userId === filter.userId);
      }
      if (filter.since) {
        filtered = filtered.filter(e => e.timestamp >= filter.since);
      }
    }
    
    return filtered;
  }
  
  /**
   * Generate metrics report
   */
  generateMetrics(windowMs: number = 3600000): any {
    const since = Date.now() - windowMs;
    const recentEvents = this.getEvents({ since });
    
    const metrics = {
      totalEvents: recentEvents.length,
      uniqueUsers: new Set(recentEvents.map(e => e.userId)).size,
      commandSuccess: 0,
      commandFailure: 0,
      avgLatency: 0,
      errorRate: 0,
      rateLimits: 0,
      quotaExceeded: 0,
      modelUsage: {} as Record<string, number>,
      topCommands: {} as Record<string, number>
    };
    
    let totalLatency = 0;
    let latencyCount = 0;
    
    for (const event of recentEvents) {
      switch (event.type) {
        case 'command':
          if (event.success) {
            metrics.commandSuccess++;
          } else {
            metrics.commandFailure++;
          }
          metrics.topCommands[event.command] = 
            (metrics.topCommands[event.command] || 0) + 1;
          break;
          
        case 'model':
          metrics.modelUsage[event.model] = 
            (metrics.modelUsage[event.model] || 0) + 1;
          if (event.latencyMs) {
            totalLatency += event.latencyMs;
            latencyCount++;
          }
          break;
          
        case 'error':
          metrics.errorRate++;
          break;
          
        case 'rateLimit':
          metrics.rateLimits++;
          break;
          
        case 'quotaExceeded':
          metrics.quotaExceeded++;
          break;
      }
    }
    
    // Calculate averages
    if (latencyCount > 0) {
      metrics.avgLatency = Math.round(totalLatency / latencyCount);
    }
    
    const totalCommands = metrics.commandSuccess + metrics.commandFailure;
    if (totalCommands > 0) {
      metrics.errorRate = metrics.commandFailure / totalCommands;
    }
    
    return metrics;
  }
  
  /**
   * Export events for external analysis
   */
  exportEvents(format: 'json' | 'csv' = 'json'): string {
    if (format === 'json') {
      return JSON.stringify(this.events, null, 2);
    }
    
    // CSV format
    if (this.events.length === 0) return '';
    
    const headers = Object.keys(this.events[0]);
    const rows = this.events.map(event => 
      headers.map(h => JSON.stringify(event[h] || '')).join(',')
    );
    
    return [headers.join(','), ...rows].join('\n');
  }
  
  /**
   * Clear all events
   */
  clear(): void {
    this.events = [];
  }
}

// Export singleton instances
export const usageTracker = new UsageTracker();
export const usageTelemetry = new UsageTelemetry();