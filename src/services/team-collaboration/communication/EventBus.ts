/**
 * Team Event Communication Bus
 * Handles local event distribution for team collaboration
 */

export type TeamEventType =
  | "member_joined"
  | "member_left"
  | "activity_reported"
  | "pattern_shared"
  | "pattern_adopted"
  | "conflict_detected"
  | "conflict_resolved"
  | "file_locked"
  | "file_unlocked";

export interface TeamEvent {
  id: string;
  type: TeamEventType;
  sessionId: string;
  memberId: string;
  memberName: string;
  data: Record<string, unknown>;
  timestamp: Date;
}

export type EventHandler = (event: TeamEvent) => void | Promise<void>;

export class EventBus {
  private _handlers: Map<TeamEventType, EventHandler[]> = new Map();
  private allHandlers: EventHandler[] = [];
  private eventHistory: TeamEvent[] = [];
  private readonly MAX_HISTORY = 1000;

  on(eventType: TeamEventType, handler: EventHandler): () => void {
    if (!this._handlers.has(eventType)) {
      this._handlers.set(eventType, []);
    }

    this._handlers.get(eventType)!.push(handler);

    // Return unsubscribe function
    return () => {
      const _handlers = this._handlers.get(eventType);
      if (_handlers) {
        const _index = _handlers.indexOf(handler);
        if (_index > -1) {
          _handlers.splice(_index, 1);
        }
      }
    };
  }

  onAny(handler: EventHandler): () => void {
    this.allHandlers.push(handler);

    return () => {
      const _index = this.allHandlers.indexOf(handler);
      if (_index > -1) {
        this.allHandlers.splice(_index, 1);
      }
    };
  }

  async emit(event: Omit<TeamEvent, "id" | "timestamp">): Promise<void> {
    const fullEvent: TeamEvent = {
      ...event,
      id: this.generateEventId(),
      timestamp: new Date(),
    };

    // Add to history
    this.eventHistory.unshift(fullEvent);
    if (this.eventHistory.length > this.MAX_HISTORY) {
      this.eventHistory = this.eventHistory.slice(0, this.MAX_HISTORY);
    }

    // Notify type-specific _handlers
    const _handlers = this._handlers.get(event.type) || [];
    const _promises = _handlers.map((handler) =>
      this.safeHandlerCall(handler, fullEvent),
    );

    // Notify global _handlers
    const _globalPromises = this.allHandlers.map((handler) =>
      this.safeHandlerCall(handler, fullEvent),
    );

    // Wait for all _handlers to complete
    await Promise.all([..._promises, ..._globalPromises]);
  }

  getEventHistory(
    eventType?: TeamEventType,
    sessionId?: string,
    limit: number = 50,
  ): TeamEvent[] {
    let filtered = this.eventHistory;

    if (eventType) {
      filtered = filtered.filter((event) => event.type === eventType);
    }

    if (sessionId) {
      filtered = filtered.filter((event) => event.sessionId === sessionId);
    }

    return filtered.slice(0, limit);
  }

  getEventsByMember(_memberId: string, limit: number = 20): TeamEvent[] {
    return this.eventHistory
      .filter((event) => event._memberId === _memberId)
      .slice(0, limit);
  }

  clearHistory(): void {
    this.eventHistory = [];
  }

  removeAllHandlers(): void {
    this.handlers.clear();
    this.allHandlers = [];
  }

  // Convenience methods for common events
  async emitMemberJoined(
    sessionId: string,
    memberId: string,
    memberName: string,
    data: Record<string, unknown> = {},
  ): Promise<void> {
    await this.emit({
      type: "member_joined",
      sessionId,
      memberId,
      memberName,
      data,
    });
  }

  async emitMemberLeft(
    sessionId: string,
    memberId: string,
    memberName: string,
    data: Record<string, unknown> = {},
  ): Promise<void> {
    await this.emit({
      type: "member_left",
      sessionId,
      memberId,
      memberName,
      data,
    });
  }

  async emitActivityReported(
    sessionId: string,
    memberId: string,
    memberName: string,
    activity: Record<string, unknown>,
  ): Promise<void> {
    await this.emit({
      type: "activity_reported",
      sessionId,
      memberId,
      memberName,
      data: { activity },
    });
  }

  async emitPatternShared(
    sessionId: string,
    memberId: string,
    memberName: string,
    patternId: string,
    pattern: Record<string, unknown>,
  ): Promise<void> {
    await this.emit({
      type: "pattern_shared",
      sessionId,
      memberId,
      memberName,
      data: { patternId, pattern },
    });
  }

  async emitPatternAdopted(
    sessionId: string,
    memberId: string,
    memberName: string,
    patternId: string,
    originalAuthor: string,
  ): Promise<void> {
    await this.emit({
      type: "pattern_adopted",
      sessionId,
      memberId,
      memberName,
      data: { patternId, originalAuthor },
    });
  }

  async emitConflictDetected(
    sessionId: string,
    memberId: string,
    memberName: string,
    conflict: Record<string, unknown>,
  ): Promise<void> {
    await this.emit({
      type: "conflict_detected",
      sessionId,
      memberId,
      memberName,
      data: { conflict },
    });
  }

  async emitConflictResolved(
    sessionId: string,
    memberId: string,
    memberName: string,
    conflictId: string,
    resolution: Record<string, unknown>,
  ): Promise<void> {
    await this.emit({
      type: "conflict_resolved",
      sessionId,
      memberId,
      memberName,
      data: { conflictId, resolution },
    });
  }

  async emitFileLocked(
    sessionId: string,
    memberId: string,
    memberName: string,
    _filePath: string,
  ): Promise<void> {
    await this.emit({
      type: "file_locked",
      sessionId,
      memberId,
      memberName,
      data: { _filePath },
    });
  }

  async emitFileUnlocked(
    sessionId: string,
    memberId: string,
    memberName: string,
    _filePath: string,
  ): Promise<void> {
    await this.emit({
      type: "file_unlocked",
      sessionId,
      memberId,
      memberName,
      data: { _filePath },
    });
  }

  private async safeHandlerCall(
    _handler: EventHandler,
    event: TeamEvent,
  ): Promise<void> {
    try {
      await _handler(_event);
    } catch (error) {
      console.error(`Event handler error for ${event.type}:`, error);
      // Don't rethrow - other _handlers should still run
    }
  }

  private generateEventId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Statistics and monitoring
  getEventStats(): {
    totalEvents: number;
    eventsByType: Record<string, number>;
    recentActivity: number; // Events in last 5 minutes
  } {
    const eventsByType: Record<string, number> = {};
    const _fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    let recentActivity = 0;

    for (const event of this.eventHistory) {
      // Count by type
      eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;

      // Count recent activity
      if (event.timestamp >= _fiveMinutesAgo) {
        recentActivity++;
      }
    }

    return {
      totalEvents: this.eventHistory.length,
      eventsByType,
      recentActivity,
    };
  }

  // Debug utilities
  debugInfo(): {
    handlerCounts: Record<string, number>;
    globalHandlers: number;
    historySize: number;
    stats: ReturnType<typeof this.getEventStats>;
  } {
    const handlerCounts: Record<string, number> = {};

    for (const [eventType, _handlers] of this.handlers.entries()) {
      handlerCounts[eventType] = handlers.length;
    }

    return {
      handlerCounts,
      globalHandlers: this.allHandlers.length,
      historySize: this.eventHistory.length,
      stats: this.getEventStats(),
    };
  }
}
