/**
 * History Service - Mode Usage History and Analytics Microservice
 * Handles tracking, storing, and analyzing mode usage patterns
 */

import { BaseService } from "../../core/BaseService";
import { ServiceEvent } from "../../core/types";
import { Service } from "../../core/decorators/service.decorator";
import { EventHandler } from "../../core/decorators/event.decorator";

export interface HistoryEntry {
  id: string;
  sessionId: string;
  userId: string;
  modeId: string;
  fromMode?: string;
  action: "activate" | "deactivate" | "transition";
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
  _totalDuration: number;
  averageSessionDuration: number;
  _modePreferences: { modeId: string; percentage: number }[];
  _peakUsageHours: number[];
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
  _limit?: number;
  _offset?: number;
}

@Service({
  id: "history-service",
  version: "1.0.0",
  description: "Mode usage history and _analytics service",
  dependencies: [],
  startupOrder: 4,
})
export class HistoryService extends BaseService {
  public readonly id = "history-service";
  public readonly version = "1.0.0";

  private _entries: HistoryEntry[] = [];
  private sessions: Map<string, SessionSummary> = new Map();
  private userAnalytics: Map<string, UserAnalytics> = new Map();
  private retentionDays = 90; // Keep history for 90 days
  private maxEntries = 10000; // Maximum _entries in memory

  async onInitialize(): Promise<void> {
    console.log(`[${this.id}] Initializing History Service...`);
    await this.loadExistingHistory();
    await this.startCleanupScheduler();
    console.log(
      `[${this.id}] History Service initialized with ${this.entries.length} _entries`,
    );
  }

  async onStart(): Promise<void> {
    console.log(`[${this.id}] Starting History Service...`);
    this.emitServiceEvent("history:ready", {
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
  async recordEntry(
    _entry: Omit<HistoryEntry, "id" | "timestamp">,
  ): Promise<string> {
    const historyEntry: HistoryEntry = {
      ..._entry,
      id: this.generateId(),
      timestamp: Date.now(),
    };

    this.entries.push(historyEntry);

    // Update session _summary
    await this.updateSessionSummary(historyEntry);

    // Update user _analytics
    await this.updateUserAnalytics(historyEntry);

    // Enforce limits
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }

    this.emitServiceEvent("history:entry_recorded", { _entry: historyEntry });
    return historyEntry.id;
  }

  /**
   * Query history _entries
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
    const _offset = query._offset || 0;
    const _limit = query._limit || 100;

    return filtered.slice(_offset, _offset + _limit);
  }

  /**
   * Get session _summary
   */
  async getSessionSummary(
    sessionId: string,
  ): Promise<SessionSummary | undefined> {
    return this.sessions.get(sessionId);
  }

  /**
   * Get all sessions for a user
   */
  async getUserSessions(
    _userId: string,
    _limit: number = 50,
  ): Promise<SessionSummary[]> {
    return Array.from(this.sessions.values())
      .filter((session) => session._userId === _userId)
      .sort((a, b) => b.startTime - a.startTime)
      .slice(0, _limit);
  }

  /**
   * Get user _analytics
   */
  async getUserAnalytics(userId: string): Promise<UserAnalytics | undefined> {
    const _analytics = this.userAnalytics.get(userId);
    if (_analytics) {
      // Update _analytics with latest data
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
        _totalUsage: relevantEntries.length,
        _totalDuration: relevantEntries.reduce(
          (sum, e) => sum + (e.duration || 0),
          0,
        ),
        averageDuration: this.calculateAverageDuration(relevantEntries),
        averageConfidence: this.calculateAverageConfidence(relevantEntries),
        usageByHour: this.calculateUsageByHour(relevantEntries),
        usageByDay: this.calculateUsageByDay(relevantEntries),
      };
    } else {
      // Overall statistics
      const _modeStats = new Map<string, any>();

      for (const entry of relevantEntries) {
        if (!_modeStats.has(entry.modeId)) {
          modeStats.set(entry.modeId, {
            modeId: entry.modeId,
            count: 0,
            _totalDuration: 0,
            totalConfidence: 0,
            confidenceCount: 0,
          });
        }

        const _stats = _modeStats.get(entry.modeId)!;
        _stats.count++;
        stats.totalDuration += entry.duration || 0;

        if (entry.confidence !== undefined) {
          _stats.totalConfidence += entry.confidence;
          stats.confidenceCount++;
        }
      }

      return Array.from(_modeStats.values()).map((_stats) => ({
        ..._stats,
        averageDuration: _stats.totalDuration / _stats.count,
        averageConfidence:
          _stats.confidenceCount > 0
            ? _stats.totalConfidence / _stats.confidenceCount
            : 0,
      }));
    }
  }

  /**
   * Export history data
   */
  async exportHistory(
    _format: "json" | "csv" = "json",
    query?: HistoryQuery,
  ): Promise<string> {
    const _entries = await this.queryHistory(query);

    if (_format === "json") {
      return JSON.stringify(_entries, null, 2);
    } else if (_format === "csv") {
      const _headers = [
        "id",
        "sessionId",
        "userId",
        "modeId",
        "action",
        "timestamp",
        "duration",
        "confidence",
      ];
      const _rows = _entries.map((entry) => [
        entry.id,
        entry.sessionId,
        entry.userId,
        entry.modeId,
        entry.action,
        entry.timestamp,
        entry.duration || "",
        entry.confidence || "",
      ]);

      return [_headers, ..._rows].map((row) => row.join(",")).join("\n");
    }

    throw new Error(`Unsupported export _format: ${_format}`);
  }

  /**
   * Clear old history _entries
   */
  async clearOldHistory(): Promise<number> {
    const _cutoffTime = Date.now() - this.retentionDays * 24 * 60 * 60 * 1000;
    const _originalLength = this.entries.length;

    this.entries = this.entries.filter(
      (entry) => entry.timestamp > _cutoffTime,
    );

    const _removedCount = _originalLength - this.entries.length;
    this.emitServiceEvent("history:cleanup_completed", {
      _removedCount,
      retentionDays: this.retentionDays,
    });

    return _removedCount;
  }

  /**
   * Update session _summary
   */
  private async updateSessionSummary(entry: HistoryEntry): Promise<void> {
    let _summary = this.sessions.get(entry.sessionId);

    if (!_summary) {
      _summary = {
        sessionId: entry.sessionId,
        userId: entry.userId,
        startTime: entry.timestamp,
        totalModeTransitions: 0,
        uniqueModesUsed: [],
        mostUsedMode: "",
        averageConfidence: 0,
        productivity: 0,
      };
      this.sessions.set(entry.sessionId, _summary);
    }

    // Update _summary
    if (entry.action === "transition") {
      summary.totalModeTransitions++;
    }

    if (!_summary.uniqueModesUsed.includes(entry.modeId)) {
      summary.uniqueModesUsed.push(entry.modeId);
    }

    // Calculate most used mode
    const _modeCounts = new Map<string, number>();
    const _sessionEntries = this.entries.filter(
      (e) => e.sessionId === entry.sessionId,
    );

    for (const e of _sessionEntries) {
      _modeCounts.set(e.modeId, (_modeCounts.get(e.modeId) || 0) + 1);
    }

    let maxCount = 0;
    for (const [modeId, count] of _modeCounts) {
      if (count > maxCount) {
        maxCount = count;
        summary.mostUsedMode = modeId;
      }
    }

    // Calculate average confidence
    const _confidenceEntries = _sessionEntries.filter(
      (e) => e.confidence !== undefined,
    );
    if (_confidenceEntries.length > 0) {
      summary.averageConfidence =
        _confidenceEntries.reduce((sum, e) => sum + e.confidence!, 0) /
        _confidenceEntries.length;
    }

    this.sessions.set(entry.sessionId, _summary);
  }

  /**
   * Update user _analytics
   */
  private async updateUserAnalytics(entry: HistoryEntry): Promise<void> {
    await this.calculateUserAnalytics(entry.userId);
  }

  /**
   * Calculate comprehensive user _analytics
   */
  private async calculateUserAnalytics(userId: string): Promise<void> {
    const _userEntries = this.entries.filter((e) => e.userId === userId);
    const _userSessions = Array.from(this.sessions.values()).filter(
      (s) => s.userId === userId,
    );

    if (_userEntries.length === 0) {
      return;
    }

    // Calculate mode preferences
    const _modeUsage = new Map<string, number>();
    for (const entry of _userEntries) {
      _modeUsage.set(entry.modeId, (_modeUsage.get(entry.modeId) || 0) + 1);
    }

    const _totalUsage = _userEntries.length;
    const _modePreferences = Array.from(_modeUsage.entries())
      .map(([modeId, count]) => ({
        modeId,
        percentage: (count / _totalUsage) * 100,
      }))
      .sort((a, b) => b.percentage - a.percentage);

    // Calculate peak usage hours
    const _hourlyUsage = new Array(24).fill(0);
    for (const entry of _userEntries) {
      const _hour = new Date(entry.timestamp).getHours();
      _hourlyUsage[_hour]++;
    }

    const _maxUsage = Math.max(..._hourlyUsage);
    const _peakUsageHours = _hourlyUsage
      .map((count, _hour) => ({ _hour, count }))
      .filter((_item) => _item.count >= _maxUsage * 0.8)
      .map((_item) => _item._hour);

    // Calculate total session duration
    const _totalDuration = _userSessions.reduce((sum, session) => {
      return sum + (session.duration || 0);
    }, 0);

    const _analytics: UserAnalytics = {
      userId,
      totalSessions: _userSessions.length,
      _totalDuration,
      averageSessionDuration:
        _totalDuration / Math.max(_userSessions.length, 1),
      _modePreferences,
      _peakUsageHours,
      productivityTrends: [], // Future: Calculate based on task completion
      learningProgress: this.calculateLearningProgress(_userEntries),
    };

    this.userAnalytics.set(userId, _analytics);
  }

  /**
   * Calculate learning progress based on confidence trends
   */
  private calculateLearningProgress(_entries: HistoryEntry[]): number {
    const _confidenceEntries = _entries
      .filter((e) => e.confidence !== undefined)
      .sort((a, b) => a.timestamp - b.timestamp);

    if (_confidenceEntries.length < 2) {
      return 0;
    }

    // Calculate trend in confidence over time
    const _recentEntries = _confidenceEntries.slice(-20); // Last 20 _entries
    const _earlyEntries = _confidenceEntries.slice(0, 20); // First 20 _entries

    const _recentAvg =
      _recentEntries.reduce((sum, e) => sum + e.confidence!, 0) /
      _recentEntries.length;
    const _earlyAvg =
      _earlyEntries.reduce((sum, e) => sum + e.confidence!, 0) /
      _earlyEntries.length;

    return Math.max(0, Math.min(100, (_recentAvg - _earlyAvg) * 100));
  }

  /**
   * Calculate average duration from _entries
   */
  private calculateAverageDuration(_entries: HistoryEntry[]): number {
    const _durationsEntries = _entries.filter((e) => e.duration !== undefined);
    if (_durationsEntries.length === 0) {
      return 0;
    }

    return (
      _durationsEntries.reduce((sum, e) => sum + e.duration!, 0) /
      _durationsEntries.length
    );
  }

  /**
   * Calculate average confidence from _entries
   */
  private calculateAverageConfidence(_entries: HistoryEntry[]): number {
    const _confidenceEntries = _entries.filter(
      (e) => e.confidence !== undefined,
    );
    if (_confidenceEntries.length === 0) {
      return 0;
    }

    return (
      _confidenceEntries.reduce((sum, e) => sum + e.confidence!, 0) /
      _confidenceEntries.length
    );
  }

  /**
   * Calculate usage by _hour of _day
   */
  private calculateUsageByHour(_entries: HistoryEntry[]): number[] {
    const _hourlyUsage = new Array(24).fill(0);
    for (const entry of _entries) {
      const _hour = new Date(entry.timestamp).getHours();
      _hourlyUsage[_hour]++;
    }
    return _hourlyUsage;
  }

  /**
   * Calculate usage by _day of week
   */
  private calculateUsageByDay(_entries: HistoryEntry[]): number[] {
    const _dailyUsage = new Array(7).fill(0);
    for (const entry of _entries) {
      const _day = new Date(entry.timestamp).getDay();
      _dailyUsage[_day]++;
    }
    return _dailyUsage;
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

  @EventHandler("mode:transition")
  async handleModeTransition(event: ServiceEvent): Promise<void> {
    const { transition } = event.data;

    await this.recordEntry({
      sessionId: transition.sessionId,
      userId: transition.userId,
      modeId: transition.toMode,
      fromMode: transition.fromMode,
      action: "transition",
      context: { reason: transition.reason },
      confidence: transition.confidence,
      reason: transition.reason,
    });
  }

  @EventHandler("session:started")
  async handleSessionStarted(event: ServiceEvent): Promise<void> {
    const { sessionId, userId } = event.data;

    await this.recordEntry({
      sessionId,
      userId: userId || "unknown",
      modeId: "thinking",
      action: "activate",
      context: { type: "session_start" },
    });
  }

  @EventHandler("session:ended")
  async handleSessionEnded(event: ServiceEvent): Promise<void> {
    const { sessionId, userId } = event.data;

    // Update session end time and duration
    const _summary = this.sessions.get(sessionId);
    if (_summary) {
      _summary.endTime = Date.now();
      _summary.duration = _summary.endTime - _summary.startTime;
      this.sessions.set(sessionId, _summary);
    }

    await this.recordEntry({
      sessionId,
      userId: userId || "unknown",
      modeId: this.getCurrentMode(sessionId),
      action: "deactivate",
      context: { type: "session_end" },
    });
  }

  /**
   * Get current mode for session (placeholder)
   */
  private getCurrentMode(_sessionId: string): string {
    // This would normally query the ModeService
    return "thinking";
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
        this.entries.length > 0
          ? Math.min(...this.entries.map((e) => e.timestamp))
          : null,
      newestEntry:
        this.entries.length > 0
          ? Math.max(...this.entries.map((e) => e.timestamp))
          : null,
      uptime: Date.now() - this.startTime.getTime(),
    };
  }
}
