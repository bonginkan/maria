/**
 * History Service - Mode Usage History and Analytics Microservice
 * Handles tracking, storing, and analyzing mode usage patterns
 */

import { BaseService } from '../../core/BaseService.js';
import { ServiceEvent } from '../../core/types.js';
import { Service } from '../../core/decorators/service.decorator.js';
import { EventHandler } from '../../core/decorators/event.decorator.js';

export interface HistoryEntry {
  id: string;
  sessionId: string;
  userId: string;
  modeId: string;
  fromMode?: string;
  action: 'activate' | 'deactivate' | 'transition';
  timestamp: number;
  duration?: number;
  context: any;
  confidence?: number;
  reason?: string;
  metadata?: any;
}

export interface SessionSummary {
  sessionId: string;
  userId: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  totalModeTransitions: number;
  uniqueModesUsed: string[];
  mostUsedMode: string;
  averageConfidence: number;
  productivity: number;
}

export interface UserAnalytics {
  userId: string;
  totalSessions: number;
  totalDuration: number;
  averageSessionDuration: number;
  modePreferences: { modeId: string; percentage: number }[];
  peakUsageHours: number[];
  productivityTrends: { date: string; score: number }[];
  learningProgress: number;
}

export interface HistoryQuery {
  sessionId?: string;
  userId?: string;
  modeId?: string;
  fromDate?: number;
  toDate?: number;
  action?: string;
  limit?: number;
  offset?: number;
}

@Service({
  id: 'history-service',
  version: '1.0.0',
  description: 'Mode usage history and analytics service',
  dependencies: [],
  startupOrder: 4,
})
export class HistoryService extends BaseService {
  public readonly id = 'history-service';
  public readonly version = '1.0.0';

  private entries: HistoryEntry[] = [];
  private sessions: Map<string, SessionSummary> = new Map();
  private userAnalytics: Map<string, UserAnalytics> = new Map();
  private retentionDays = 90; // Keep history for 90 days
  private maxEntries = 10000; // Maximum entries in memory

  async onInitialize(): Promise<void> {
    console.log(`[${this.id}] Initializing History Service...`);
    await this.loadExistingHistory();
    await this.startCleanupScheduler();
    console.log(`[${this.id}] History Service initialized with ${this.entries.length} entries`);
  }

  async onStart(): Promise<void> {
    console.log(`[${this.id}] Starting History Service...`);
    this.emitServiceEvent('history:ready', {
      service: this.id,
      totalEntries: this.entries.length,
      totalSessions: this.sessions.size,
      totalUsers: this.userAnalytics.size,
    });
  }

  async onStop(): Promise<void> {
    console.log(`[${this.id}] Stopping History Service...`);
    await this.persistHistory();
  }

  /**
   * Record a history entry
   */
  async recordEntry(entry: Omit<HistoryEntry, 'id' | 'timestamp'>): Promise<string> {
    const historyEntry: HistoryEntry = {
      ...entry,
      id: this.generateId(),
      timestamp: Date.now(),
    };

    this.entries.push(historyEntry);

    // Update session summary
    await this.updateSessionSummary(historyEntry);

    // Update user analytics
    await this.updateUserAnalytics(historyEntry);

    // Enforce limits
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }

    this.emitServiceEvent('history:entry_recorded', { entry: historyEntry });
    return historyEntry.id;
  }

  /**
   * Query history entries
   */
  async queryHistory(query: HistoryQuery = {}): Promise<HistoryEntry[]> {
    let filtered = this.entries;

    // Apply filters
    if (query.sessionId) {
      filtered = filtered.filter((e) => e.sessionId === query.sessionId);
    }
    if (query.userId) {
      filtered = filtered.filter((e) => e.userId === query.userId);
    }
    if (query.modeId) {
      filtered = filtered.filter((e) => e.modeId === query.modeId);
    }
    if (query.action) {
      filtered = filtered.filter((e) => e.action === query.action);
    }
    if (query.fromDate) {
      filtered = filtered.filter((e) => e.timestamp >= query.fromDate!);
    }
    if (query.toDate) {
      filtered = filtered.filter((e) => e.timestamp <= query.toDate!);
    }

    // Sort by timestamp (newest first)
    filtered.sort((a, b) => b.timestamp - a.timestamp);

    // Apply pagination
    const offset = query.offset || 0;
    const limit = query.limit || 100;

    return filtered.slice(offset, offset + limit);
  }

  /**
   * Get session summary
   */
  async getSessionSummary(sessionId: string): Promise<SessionSummary | undefined> {
    return this.sessions.get(sessionId);
  }

  /**
   * Get all sessions for a user
   */
  async getUserSessions(userId: string, limit: number = 50): Promise<SessionSummary[]> {
    return Array.from(this.sessions.values())
      .filter((session) => session.userId === userId)
      .sort((a, b) => b.startTime - a.startTime)
      .slice(0, limit);
  }

  /**
   * Get user analytics
   */
  async getUserAnalytics(userId: string): Promise<UserAnalytics | undefined> {
    const analytics = this.userAnalytics.get(userId);
    if (analytics) {
      // Update analytics with latest data
      await this.calculateUserAnalytics(userId);
      return this.userAnalytics.get(userId);
    }
    return undefined;
  }

  /**
   * Get mode usage statistics
   */
  async getModeStatistics(
    modeId?: string,
    timeframe?: { from: number; to: number },
  ): Promise<unknown> {
    let relevantEntries = this.entries;

    if (timeframe) {
      relevantEntries = relevantEntries.filter(
        (e) => e.timestamp >= timeframe.from && e.timestamp <= timeframe.to,
      );
    }

    if (modeId) {
      relevantEntries = relevantEntries.filter((e) => e.modeId === modeId);

      return {
        modeId,
        totalUsage: relevantEntries.length,
        totalDuration: relevantEntries.reduce((sum, e) => sum + (e.duration || 0), 0),
        averageDuration: this.calculateAverageDuration(relevantEntries),
        averageConfidence: this.calculateAverageConfidence(relevantEntries),
        usageByHour: this.calculateUsageByHour(relevantEntries),
        usageByDay: this.calculateUsageByDay(relevantEntries),
      };
    } else {
      // Overall statistics
      const modeStats = new Map<string, any>();

      for (const entry of relevantEntries) {
        if (!modeStats.has(entry.modeId)) {
          modeStats.set(entry.modeId, {
            modeId: entry.modeId,
            count: 0,
            totalDuration: 0,
            totalConfidence: 0,
            confidenceCount: 0,
          });
        }

        const stats = modeStats.get(entry.modeId)!;
        stats.count++;
        stats.totalDuration += entry.duration || 0;

        if (entry.confidence !== undefined) {
          stats.totalConfidence += entry.confidence;
          stats.confidenceCount++;
        }
      }

      return Array.from(modeStats.values()).map((stats) => ({
        ...stats,
        averageDuration: stats.totalDuration / stats.count,
        averageConfidence:
          stats.confidenceCount > 0 ? stats.totalConfidence / stats.confidenceCount : 0,
      }));
    }
  }

  /**
   * Export history data
   */
  async exportHistory(format: 'json' | 'csv' = 'json', query?: HistoryQuery): Promise<string> {
    const entries = await this.queryHistory(query);

    if (format === 'json') {
      return JSON.stringify(entries, null, 2);
    } else if (format === 'csv') {
      const headers = [
        'id',
        'sessionId',
        'userId',
        'modeId',
        'action',
        'timestamp',
        'duration',
        'confidence',
      ];
      const rows = entries.map((entry) => [
        entry.id,
        entry.sessionId,
        entry.userId,
        entry.modeId,
        entry.action,
        entry.timestamp,
        entry.duration || '',
        entry.confidence || '',
      ]);

      return [headers, ...rows].map((row) => row.join(',')).join('\n');
    }

    throw new Error(`Unsupported export format: ${format}`);
  }

  /**
   * Clear old history entries
   */
  async clearOldHistory(): Promise<number> {
    const cutoffTime = Date.now() - this.retentionDays * 24 * 60 * 60 * 1000;
    const originalLength = this.entries.length;

    this.entries = this.entries.filter((entry) => entry.timestamp > cutoffTime);

    const removedCount = originalLength - this.entries.length;
    this.emitServiceEvent('history:cleanup_completed', {
      removedCount,
      retentionDays: this.retentionDays,
    });

    return removedCount;
  }

  /**
   * Update session summary
   */
  private async updateSessionSummary(entry: HistoryEntry): Promise<void> {
    let summary = this.sessions.get(entry.sessionId);

    if (!summary) {
      summary = {
        sessionId: entry.sessionId,
        userId: entry.userId,
        startTime: entry.timestamp,
        totalModeTransitions: 0,
        uniqueModesUsed: [],
        mostUsedMode: '',
        averageConfidence: 0,
        productivity: 0,
      };
      this.sessions.set(entry.sessionId, summary);
    }

    // Update summary
    if (entry.action === 'transition') {
      summary.totalModeTransitions++;
    }

    if (!summary.uniqueModesUsed.includes(entry.modeId)) {
      summary.uniqueModesUsed.push(entry.modeId);
    }

    // Calculate most used mode
    const modeCounts = new Map<string, number>();
    const sessionEntries = this.entries.filter((e) => e.sessionId === entry.sessionId);

    for (const e of sessionEntries) {
      modeCounts.set(e.modeId, (modeCounts.get(e.modeId) || 0) + 1);
    }

    let maxCount = 0;
    for (const [modeId, count] of modeCounts) {
      if (count > maxCount) {
        maxCount = count;
        summary.mostUsedMode = modeId;
      }
    }

    // Calculate average confidence
    const confidenceEntries = sessionEntries.filter((e) => e.confidence !== undefined);
    if (confidenceEntries.length > 0) {
      summary.averageConfidence =
        confidenceEntries.reduce((sum, e) => sum + e.confidence!, 0) / confidenceEntries.length;
    }

    this.sessions.set(entry.sessionId, summary);
  }

  /**
   * Update user analytics
   */
  private async updateUserAnalytics(entry: HistoryEntry): Promise<void> {
    await this.calculateUserAnalytics(entry.userId);
  }

  /**
   * Calculate comprehensive user analytics
   */
  private async calculateUserAnalytics(userId: string): Promise<void> {
    const userEntries = this.entries.filter((e) => e.userId === userId);
    const userSessions = Array.from(this.sessions.values()).filter((s) => s.userId === userId);

    if (userEntries.length === 0) {return;}

    // Calculate mode preferences
    const modeUsage = new Map<string, number>();
    for (const entry of userEntries) {
      modeUsage.set(entry.modeId, (modeUsage.get(entry.modeId) || 0) + 1);
    }

    const totalUsage = userEntries.length;
    const modePreferences = Array.from(modeUsage.entries())
      .map(([modeId, count]) => ({
        modeId,
        percentage: (count / totalUsage) * 100,
      }))
      .sort((a, b) => b.percentage - a.percentage);

    // Calculate peak usage hours
    const hourlyUsage = new Array(24).fill(0);
    for (const entry of userEntries) {
      const hour = new Date(entry.timestamp).getHours();
      hourlyUsage[hour]++;
    }

    const maxUsage = Math.max(...hourlyUsage);
    const peakUsageHours = hourlyUsage
      .map((count, hour) => ({ hour, count }))
      .filter((item) => item.count >= maxUsage * 0.8)
      .map((item) => item.hour);

    // Calculate total session duration
    const totalDuration = userSessions.reduce((sum, session) => {
      return sum + (session.duration || 0);
    }, 0);

    const analytics: UserAnalytics = {
      userId,
      totalSessions: userSessions.length,
      totalDuration,
      averageSessionDuration: totalDuration / Math.max(userSessions.length, 1),
      modePreferences,
      peakUsageHours,
      productivityTrends: [], // Future: Calculate based on task completion
      learningProgress: this.calculateLearningProgress(userEntries),
    };

    this.userAnalytics.set(userId, analytics);
  }

  /**
   * Calculate learning progress based on confidence trends
   */
  private calculateLearningProgress(entries: HistoryEntry[]): number {
    const confidenceEntries = entries
      .filter((e) => e.confidence !== undefined)
      .sort((a, b) => a.timestamp - b.timestamp);

    if (confidenceEntries.length < 2) {return 0;}

    // Calculate trend in confidence over time
    const recentEntries = confidenceEntries.slice(-20); // Last 20 entries
    const earlyEntries = confidenceEntries.slice(0, 20); // First 20 entries

    const recentAvg =
      recentEntries.reduce((sum, e) => sum + e.confidence!, 0) / recentEntries.length;
    const earlyAvg = earlyEntries.reduce((sum, e) => sum + e.confidence!, 0) / earlyEntries.length;

    return Math.max(0, Math.min(100, (recentAvg - earlyAvg) * 100));
  }

  /**
   * Calculate average duration from entries
   */
  private calculateAverageDuration(entries: HistoryEntry[]): number {
    const durationsEntries = entries.filter((e) => e.duration !== undefined);
    if (durationsEntries.length === 0) {return 0;}

    return durationsEntries.reduce((sum, e) => sum + e.duration!, 0) / durationsEntries.length;
  }

  /**
   * Calculate average confidence from entries
   */
  private calculateAverageConfidence(entries: HistoryEntry[]): number {
    const confidenceEntries = entries.filter((e) => e.confidence !== undefined);
    if (confidenceEntries.length === 0) {return 0;}

    return confidenceEntries.reduce((sum, e) => sum + e.confidence!, 0) / confidenceEntries.length;
  }

  /**
   * Calculate usage by hour of day
   */
  private calculateUsageByHour(entries: HistoryEntry[]): number[] {
    const hourlyUsage = new Array(24).fill(0);
    for (const entry of entries) {
      const hour = new Date(entry.timestamp).getHours();
      hourlyUsage[hour]++;
    }
    return hourlyUsage;
  }

  /**
   * Calculate usage by day of week
   */
  private calculateUsageByDay(entries: HistoryEntry[]): number[] {
    const dailyUsage = new Array(7).fill(0);
    for (const entry of entries) {
      const day = new Date(entry.timestamp).getDay();
      dailyUsage[day]++;
    }
    return dailyUsage;
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `hist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Load existing history from storage
   */
  private async loadExistingHistory(): Promise<void> {
    // Future: Load from persistent storage (file, database)
    console.log(`[${this.id}] Loading existing history placeholder`);
  }

  /**
   * Persist history to storage
   */
  private async persistHistory(): Promise<void> {
    // Future: Save to persistent storage
    console.log(`[${this.id}] Persisting history placeholder`);
  }

  /**
   * Start cleanup scheduler
   */
  private async startCleanupScheduler(): Promise<void> {
    // Run cleanup every 24 hours
    setInterval(
      async () => {
        await this.clearOldHistory();
      },
      24 * 60 * 60 * 1000,
    );
  }

  @EventHandler('mode:transition')
  async handleModeTransition(event: ServiceEvent): Promise<void> {
    const { transition } = event.data;

    await this.recordEntry({
      sessionId: transition.sessionId,
      userId: transition.userId,
      modeId: transition.toMode,
      fromMode: transition.fromMode,
      action: 'transition',
      context: { reason: transition.reason },
      confidence: transition.confidence,
      reason: transition.reason,
    });
  }

  @EventHandler('session:started')
  async handleSessionStarted(event: ServiceEvent): Promise<void> {
    const { sessionId, userId } = event.data;

    await this.recordEntry({
      sessionId,
      userId: userId || 'unknown',
      modeId: 'thinking',
      action: 'activate',
      context: { type: 'session_start' },
    });
  }

  @EventHandler('session:ended')
  async handleSessionEnded(event: ServiceEvent): Promise<void> {
    const { sessionId, userId } = event.data;

    // Update session end time and duration
    const summary = this.sessions.get(sessionId);
    if (summary) {
      summary.endTime = Date.now();
      summary.duration = summary.endTime - summary.startTime;
      this.sessions.set(sessionId, summary);
    }

    await this.recordEntry({
      sessionId,
      userId: userId || 'unknown',
      modeId: this.getCurrentMode(sessionId),
      action: 'deactivate',
      context: { type: 'session_end' },
    });
  }

  /**
   * Get current mode for session (placeholder)
   */
  private getCurrentMode(sessionId: string): string {
    // This would normally query the ModeService
    return 'thinking';
  }

  /**
   * Get service statistics
   */
  async getStatistics(): Promise<unknown> {
    return {
      service: this.id,
      totalEntries: this.entries.length,
      totalSessions: this.sessions.size,
      totalUsers: this.userAnalytics.size,
      retentionDays: this.retentionDays,
      oldestEntry:
        this.entries.length > 0 ? Math.min(...this.entries.map((e) => e.timestamp)) : null,
      newestEntry:
        this.entries.length > 0 ? Math.max(...this.entries.map((e) => e.timestamp)) : null,
      uptime: Date.now() - this.startTime.getTime(),
    };
  }
}
