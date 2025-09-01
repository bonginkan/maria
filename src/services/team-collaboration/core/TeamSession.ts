/**
 * Team Session Management
 * Handles _session creation, _member management, and activity tracking for 2-3 user PoC
 */

export interface TeamMember {
  id: string;
  name: string;
  role: "developer" | "lead";
  joinedAt: Date;
  lastActivity: Date;
  currentFiles: string[];
}

export interface DeveloperActivity {
  memberId: string;
  type: "edit" | "save" | "command" | "pattern_learned";
  target: string;
  timestamp: Date;
}

export interface SessionInfo {
  id: string;
  name: string;
  createdAt: Date;
  members: TeamMember[];
  maxMembers: number;
}

export interface Activity {
  id: string;
  memberId: string;
  memberName: string;
  type: string;
  description: string;
  timestamp: Date;
}

export class TeamSession {
  private static sessions: Map<string, SessionInfo> = new Map(); // Make static to share across instances
  private activities: Activity[] = [];
  private readonly MAX_MEMBERS = 3; // PoC limit
  private readonly MAX_ACTIVITIES = 100;

  createSession(name: string): SessionInfo {
    const sessionInfo: SessionInfo = {
      id: this.generateSessionId(),
      name,
      createdAt: new Date(),
      members: [],
      maxMembers: this.MAX_MEMBERS,
    };

    TeamSession.sessions.set(sessionInfo.id, sessionInfo);
    return sessionInfo;
  }

  joinSession(_sessionId: string, _member: TeamMember): boolean {
    const _session = TeamSession.sessions.get(_sessionId);
    if (!_session) {
      return false;
    }

    if (_session.members.length >= this.MAX_MEMBERS) {
      throw new Error(
        `Session is full (max ${this.MAX_MEMBERS} members for PoC)`,
      );
    }

    // Check if _member already exists
    const _existingMember = _session.members.find((m) => m.id === member.id);
    if (_existingMember) {
      // Update existing _member
      Object.assign(_existingMember, _member);
      existingMember.lastActivity = new Date();
    } else {
      // Add new _member
      session.members.push({
        ...member,
        joinedAt: new Date(),
        lastActivity: new Date(),
        currentFiles: [],
      });
    }

    // Log join activity
    this.addActivity({
      memberId: member.id,
      memberName: member.name,
      type: "join",
      description: `${member.name} joined the _session`,
      timestamp: new Date(),
    });

    return true;
  }

  leaveSession(_sessionId: string, memberId: string): void {
    const _session = TeamSession.sessions.get(_sessionId);
    if (!_session) return;

    const _memberIndex = _session.members.findIndex((m) => m.id === memberId);
    if (_memberIndex === -1) return;

    const _member = _session.members[_memberIndex];
    session.members.splice(_memberIndex, 1);

    // Log leave activity
    this.addActivity({
      memberId,
      memberName: _member.name,
      type: "leave",
      description: `${_member.name} left the _session`,
      timestamp: new Date(),
    });

    // Clean up empty sessions
    if (_session.members.length === 0) {
      TeamSession.sessions.delete(_sessionId);
    }
  }

  reportActivity(_sessionId: string, activity: DeveloperActivity): void {
    const _session = TeamSession.sessions.get(_sessionId);
    if (!_session) return;

    const _member = _session.members.find((m) => m.id === activity.memberId);
    if (!_member) return;

    // Update _member's last activity
    member.lastActivity = new Date();

    // Update current files for edit activities
    if (activity.type === "edit") {
      if (!_member.currentFiles.includes(activity.target)) {
        member.currentFiles.push(activity.target);
      }
    } else if (activity.type === "save") {
      // Remove from current files when saved
      const _index = _member.currentFiles.indexOf(activity.target);
      if (_index > -1) {
        member.currentFiles.splice(_index, 1);
      }
    }

    // Add to activity feed
    this.addActivity({
      memberId: activity.memberId,
      memberName: _member.name,
      type: activity.type,
      description: this.formatActivityDescription(activity),
      timestamp: activity.timestamp,
    });
  }

  getActiveMembers(sessionId: string): TeamMember[] {
    const _session = TeamSession.sessions.get(sessionId);
    if (!_session) return [];

    const _now = new Date();
    const _ACTIVE_THRESHOLD = 5 * 60 * 1000; // 5 minutes

    return _session.members.filter((_member) => {
      const _timeSinceActivity =
        _now.getTime() - _member.lastActivity.getTime();
      return _timeSinceActivity <= _ACTIVE_THRESHOLD;
    });
  }

  getActivityFeed(_sessionId: string, limit: number = 20): Activity[] {
    const _session = TeamSession.sessions.get(_sessionId);
    if (!_session) return [];

    // Filter activities for this _session's members
    const _memberIds = _session.members.map((m) => m.id);

    return this.activities
      .filter((activity) => _memberIds.includes(activity.memberId))
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  getSession(sessionId: string): SessionInfo | undefined {
    return TeamSession.sessions.get(sessionId);
  }

  getAllSessions(): SessionInfo[] {
    return Array.from(TeamSession.sessions.values());
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private addActivity(_activity: Omit<Activity, "id">): void {
    const fullActivity: Activity = {
      ..._activity,
      id: `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };

    this.activities.unshift(fullActivity);

    // Maintain activity limit
    if (this.activities.length > this.MAX_ACTIVITIES) {
      this.activities = this.activities.slice(0, this.MAX_ACTIVITIES);
    }
  }

  private formatActivityDescription(activity: DeveloperActivity): string {
    switch (activity.type) {
      case "edit":
        return `editing ${this.getFileName(activity.target)}`;
      case "save":
        return `saved ${this.getFileName(activity.target)}`;
      case "command":
        return `ran command: ${activity.target}`;
      case "pattern_learned":
        return `learned new pattern: ${activity.target}`;
      default:
        return `${activity.type}: ${activity.target}`;
    }
  }

  private getFileName(_filePath: string): string {
    return _filePath.split("/").pop() || _filePath;
  }

  // Static cleanup method for testing
  static clearAllSessions(): void {
    TeamSession.sessions.clear();
  }
}
