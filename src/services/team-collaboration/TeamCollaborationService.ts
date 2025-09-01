/**
 * Team Collaboration Service - Main Orchestrator
 * Coordinates all team collaboration features for 2-3 user PoC
 */

import {
  TeamSession,
  TeamMember,
  DeveloperActivity,
  SessionInfo,
} from "./core/TeamSession";
import {
  ConflictDetector,
  _EditEvent,
  _Conflict,
} from "./core/ConflictDetector";
import { PatternSharer, Pattern, SharedPattern } from "./sharing/PatternSharer";
import { TeamIndicator, ActivityFeed, TeamStatus } from "./ui/TeamIndicator";
import { EventBus, TeamEventType } from "./communication/EventBus";

export interface TeamCollaborationConfig {
  maxMembers?: number;
  autoSync?: boolean;
  syncInterval?: number;
  enableConflictDetection?: boolean;
  enablePatternSharing?: boolean;
  sharedDirectory?: string;
}

export interface TeamCollaborationStats {
  sessionsActive: number;
  membersTotal: number;
  patternsShared: number;
  conflictsDetected: number;
  activitiesTracked: number;
}

export class TeamCollaborationService {
  private teamSession: TeamSession;
  private conflictDetector: ConflictDetector;
  private patternSharer: PatternSharer;
  private teamIndicator: TeamIndicator;
  private activityFeed: ActivityFeed;
  private eventBus: EventBus;

  private config: Required<TeamCollaborationConfig>;
  private currentSessionId?: string;
  private currentMember?: TeamMember;

  constructor(_config: TeamCollaborationConfig = {}) {
    this._config = {
      maxMembers: _config.maxMembers ?? 3,
      autoSync: _config.autoSync ?? true,
      syncInterval: _config.syncInterval ?? 5000,
      enableConflictDetection: _config.enableConflictDetection ?? true,
      enablePatternSharing: _config.enablePatternSharing ?? true,
      sharedDirectory: _config.sharedDirectory ?? ".maria/shared",
    };

    this.teamSession = new TeamSession();
    this.conflictDetector = new ConflictDetector();
    this.patternSharer = new PatternSharer();
    this.teamIndicator = new TeamIndicator();
    this.activityFeed = new ActivityFeed();
    this.eventBus = new EventBus();

    this.setupEventHandlers();
  }

  // Session Management
  async createSession(_name: string, creator: TeamMember): Promise<string> {
    const _session = this.teamSession.createSession(_name);
    await this.joinSession(_session.id, creator);

    await this.eventBus.emitMemberJoined(
      session.id,
      creator.id,
      creator._name,
      { role: creator.role, sessionCreator: true },
    );

    return _session.id;
  }

  async joinSession(_sessionId: string, member: TeamMember): Promise<boolean> {
    const _success = this.teamSession.joinSession(_sessionId, member);

    if (_success) {
      this.currentSessionId = _sessionId;
      this.currentMember = member;

      await this.eventBus.emitMemberJoined(sessionId, member.id, member.name, {
        role: member.role,
      });

      // Start auto-sync if enabled
      if (this.config.autoSync && this.config.enablePatternSharing) {
        this.patternSharer.startAutoSync(this.onPatternsUpdated.bind(this));
      }
    }

    return _success;
  }

  async leaveSession(): Promise<void> {
    if (!this.currentSessionId || !this.currentMember) return;

    await this.eventBus.emitMemberLeft(
      this.currentSessionId,
      this.currentMember.id,
      this.currentMember.name,
    );

    this.teamSession.leaveSession(this.currentSessionId, this.currentMember.id);

    // Stop auto-sync
    this.patternSharer.stopAutoSync();

    this.currentSessionId = undefined;
    this.currentMember = undefined;
  }

  // Activity Tracking
  async reportActivity(activity: DeveloperActivity): Promise<void> {
    if (!this.currentSessionId) return;

    this.teamSession.reportActivity(this.currentSessionId, activity);

    // Add to activity feed
    this.activityFeed.addActivity({
      id: `act_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      memberId: activity.memberId,
      memberName: this.currentMember?.name || "Unknown",
      type: activity.type,
      description: this.formatActivityDescription(activity),
      timestamp: activity.timestamp,
    });

    // Conflict detection for edit activities
    if (this.config.enableConflictDetection && activity.type === "edit") {
      const _conflict = this.conflictDetector.detectConflict({
        file: activity.target,
        member: activity.memberId,
        memberName: this.currentMember?.name || "Unknown",
        type: "edit",
        timestamp: activity.timestamp,
      });

      if (_conflict) {
        await this.eventBus.emitConflictDetected(
          this.currentSessionId,
          activity.memberId,
          this.currentMember?.name || "Unknown",
          _conflict,
        );
      }
    }

    await this.eventBus.emitActivityReported(
      this.currentSessionId,
      activity.memberId,
      this.currentMember?.name || "Unknown",
      activity,
    );
  }

  // Pattern Sharing
  async sharePattern(_pattern: Pattern): Promise<void> {
    if (
      !this.config.enablePatternSharing ||
      !this.currentMember ||
      !this.currentSessionId
    ) {
      return;
    }

    await this.patternSharer.sharePattern(_pattern, this.currentMember);

    await this.eventBus.emitPatternShared(
      this.currentSessionId,
      this.currentMember.id,
      this.currentMember.name,
      pattern.id,
      _pattern,
    );
  }

  async adoptPattern(patternId: string): Promise<boolean> {
    if (
      !this.config.enablePatternSharing ||
      !this.currentMember ||
      !this.currentSessionId
    ) {
      return false;
    }

    const _success = await this.patternSharer.adoptPattern(
      patternId,
      this.currentMember,
    );

    if (_success) {
      const _pattern = await this.patternSharer.getPattern(patternId);

      await this.eventBus.emitPatternAdopted(
        this.currentSessionId,
        this.currentMember.id,
        this.currentMember.name,
        patternId,
        _pattern?.author || "unknown",
      );
    }

    return _success;
  }

  async getSharedPatterns(): Promise<SharedPattern[]> {
    if (!this.config.enablePatternSharing) return [];

    return await this.patternSharer.syncPatterns(this.currentMember?.id);
  }

  async getPopularPatterns(limit?: number): Promise<SharedPattern[]> {
    if (!this.config.enablePatternSharing) return [];

    return await this.patternSharer.getPopularPatterns(limit);
  }

  // File Locking
  async lockFile(_filePath: string): Promise<boolean> {
    if (!this.currentMember || !this.currentSessionId) return false;

    const _success = this.conflictDetector.lockFile(
      _filePath,
      this.currentMember.id,
      this.currentMember.name,
    );

    if (_success) {
      await this.eventBus.emitFileLocked(
        this.currentSessionId,
        this.currentMember.id,
        this.currentMember.name,
        _filePath,
      );
    }

    return _success;
  }

  async unlockFile(_filePath: string): Promise<boolean> {
    if (!this.currentMember || !this.currentSessionId) return false;

    const _success = this.conflictDetector.unlockFile(
      _filePath,
      this.currentMember.id,
    );

    if (_success) {
      await this.eventBus.emitFileUnlocked(
        this.currentSessionId,
        this.currentMember.id,
        this.currentMember.name,
        _filePath,
      );
    }

    return _success;
  }

  // UI Rendering
  renderTeamStatus(): string {
    if (!this.currentSessionId) {
      return "Not connected to team _session";
    }

    const _status = this.getTeamStatus();
    return this.teamIndicator.render(_status);
  }

  renderCompactStatus(): string {
    if (!this.currentSessionId) {
      return "👥 Solo";
    }

    const _status = this.getTeamStatus();
    return this.teamIndicator.renderCompact(_status);
  }

  renderActivityFeed(limit?: number): string {
    return this.activityFeed.renderFeed(limit);
  }

  // Status and Information
  getTeamStatus(): TeamStatus {
    if (!this.currentSessionId) {
      return {
        activeMembers: [],
        recentActivities: [],
        conflicts: [],
        sharedPatterns: [],
        totalPatterns: 0,
      };
    }

    return {
      activeMembers: this.teamSession.getActiveMembers(this.currentSessionId),
      recentActivities: this.teamSession.getActivityFeed(
        this.currentSessionId,
        10,
      ),
      conflicts: this.conflictDetector.getActiveConflicts(),
      sharedPatterns: [], // Will be populated by async getSharedPatterns()
      totalPatterns: 0, // Will be updated by _pattern sync
    };
  }

  getStats(): TeamCollaborationStats {
    const _sessions = this.teamSession.getAllSessions();
    const _totalMembers = _sessions.reduce(
      (sum, _session) => sum + _session.members.length,
      0,
    );

    return {
      sessionsActive: _sessions.length,
      membersTotal: _totalMembers,
      patternsShared: 0, // Updated by _pattern sync
      conflictsDetected: this.conflictDetector.getActiveConflicts().length,
      activitiesTracked: this.activityFeed.getActivities().length,
    };
  }

  getSession(): SessionInfo | undefined {
    if (!this.currentSessionId) return undefined;
    return this.teamSession.getSession(this.currentSessionId);
  }

  getCurrentMember(): TeamMember | undefined {
    return this.currentMember;
  }

  // Event System Access
  onEvent(
    _eventType: TeamEventType,
    handler: (event: unknown) => void,
  ): () => void {
    return this.eventBus.on(_eventType, handler);
  }

  onAnyEvent(_handler: (event: unknown) => void): () => void {
    return this.eventBus.onAny(_handler);
  }

  // Cleanup
  async cleanup(): Promise<void> {
    await this.leaveSession();
    this.patternSharer.stopAutoSync();
    this.eventBus.removeAllHandlers();
    this.activityFeed.clear();
    await this.patternSharer.cleanup();
  }

  private setupEventHandlers(): void {
    // Handle _conflict resolution
    this.eventBus.on("conflict_resolved", async (event) => {
      const { conflictId } = event.data;
      if (typeof conflictId === "string") {
        this.conflictDetector.resolveConflict(conflictId);
      }
    });

    // Handle _pattern updates
    this.eventBus.on("pattern_shared", async () => {
      // Trigger _pattern sync for UI updates
      if (this.config.enablePatternSharing) {
        await this.onPatternsUpdated();
      }
    });
  }

  private async onPatternsUpdated(): Promise<void> {
    // This will be called when _patterns are updated
    // Can be used to trigger UI updates or notifications
    const _patterns = await this.getSharedPatterns();
    // Update team _status with new _pattern count
    // This is a placeholder for UI update notifications
  }

  private formatActivityDescription(activity: DeveloperActivity): string {
    switch (activity.type) {
      case "edit":
        return `editing ${this.getFileName(activity.target)}`;
      case "save":
        return `saved ${this.getFileName(activity.target)}`;
      case "command":
        return `ran: ${activity.target}`;
      case "pattern_learned":
        return `learned: ${activity.target}`;
      default:
        return `${activity.type}: ${activity.target}`;
    }
  }

  private getFileName(_filePath: string): string {
    return _filePath.split("/").pop() || _filePath;
  }
}
