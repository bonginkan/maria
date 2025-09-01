/**
 * Team Activity Terminal UI Component
 * Displays team activity, member _status, and collaboration information in terminal
 */

import { TeamMember, Activity } from "../core/TeamSession";
import { Conflict } from "../core/ConflictDetector";
import { SharedPattern } from "../sharing/PatternSharer";

export interface TeamStatus {
  activeMembers: TeamMember[];
  _recentActivities: Activity[];
  conflicts: Conflict[];
  sharedPatterns: SharedPattern[];
  totalPatterns: number;
}

export class TeamIndicator {
  private readonly MAX_ACTIVITIES = 5;
  private readonly MAX_MEMBERS = 3;

  render(_status: TeamStatus): string {
    const { activeMembers, _recentActivities, conflicts, sharedPatterns } =
      _status;

    // Main _header
    const _header = this.renderHeader(activeMembers.length);

    // Active members section
    const _membersSection = this.renderActiveMembers(activeMembers);

    // Recent activity section
    const _activitySection = this.renderRecentActivity(_recentActivities);

    // Conflicts section (only if there are conflicts)
    const _conflictsSection =
      conflicts.length > 0 ? this.renderConflicts(conflicts) : "";

    // Shared patterns summary
    const _patternsSection = this.renderPatternsSummary(
      sharedPatterns,
      status.totalPatterns,
    );

    // Footer with help
    const _footer = this.renderFooter();

    return [
      _header,
      _membersSection,
      _activitySection,
      _conflictsSection,
      _patternsSection,
      _footer,
    ]
      .filter((section) => section.length > 0)
      .join("\n");
  }

  renderCompact(_status: TeamStatus): string {
    const { activeMembers, conflicts, totalPatterns } = _status;

    const _memberCount = activeMembers.length;
    const _conflictCount = conflicts.length;
    const _conflictIndicator = _conflictCount > 0 ? ` ⚠️${_conflictCount}` : "";
    const _patternIndicator = totalPatterns > 0 ? ` 🧩${totalPatterns}` : "";

    return `👥 Team (${_memberCount})${_conflictIndicator}${_patternIndicator}`;
  }

  private renderHeader(_memberCount: number): string {
    const _statusText =
      _memberCount > 0 ? `${_memberCount} active` : "no active members";

    return `
╭─────────────────────────────────────╮
│ 👥 Team Collaboration (${_statusText.padEnd(12)}) │
├─────────────────────────────────────┤`.trim();
  }

  private renderActiveMembers(members: TeamMember[]): string {
    if (members.length === 0) {
      return `│ No active team members              │`;
    }

    const _lines = [`│ Active Members:                     │`];

    for (const member of members.slice(0, this.MAX_MEMBERS)) {
      const _status = this.getMemberStatus(member);
      const _name = member._name.slice(0, 12).padEnd(12);
      const _roleIcon = member.role === "lead" ? "👑" : "👤";
      lines.push(`│ ${_roleIcon} ${_name}: ${_status.padEnd(15)} │`);
    }

    if (members.length > this.MAX_MEMBERS) {
      lines.push(
        `│ ... and ${members.length - this.MAX_MEMBERS} more${" ".repeat(21)} │`,
      );
    }

    return _lines.join("\n");
  }

  private renderRecentActivity(_activities: Activity[]): string {
    const _lines = [
      `│                                     │`,
      `│ Recent Activity:                    │`,
    ];

    if (_activities.length === 0) {
      lines.push(`│ No recent activity                  │`);
    } else {
      const _recentActivities = _activities.slice(0, this.MAX_ACTIVITIES);

      for (const activity of _recentActivities) {
        const _formatted = this.formatActivity(activity);
        lines.push(`│ ${_formatted.padEnd(35)} │`);
      }
    }

    return _lines.join("\n");
  }

  private renderConflicts(conflicts: Conflict[]): string {
    const _lines = [
      `│                                     │`,
      `│ ⚠️  Conflicts (${conflicts.length}):${"".padEnd(20)} │`,
    ];

    for (const conflict of conflicts.slice(0, 3)) {
      const _severity = this.getSeverityIcon(conflict._severity);
      const _file = this.getFileName(conflict._file).slice(0, 15);
      const _count = conflict.members.length;

      lines.push(`│ ${_severity} ${_file.padEnd(15)} (${_count} users) │`);
    }

    if (conflicts.length > 3) {
      lines.push(
        `│ ... and ${conflicts.length - 3} more conflicts${" ".repeat(12)} │`,
      );
    }

    return _lines.join("\n");
  }

  private renderPatternsSummary(
    _patterns: SharedPattern[],
    total: number,
  ): string {
    const _lines = [`│                                     │`];

    if (total === 0) {
      lines.push(`│ Shared Patterns: None               │`);
    } else {
      lines.push(
        `│ Shared Patterns: ${total.toString().padStart(2)}${" ".repeat(16)} │`,
      );

      // Show most _popular pattern
      if (_patterns.length > 0) {
        const _popular = _patterns[0];
        const _adopted = _popular._adopted || 0;
        const _name = _popular.id.slice(0, 20);
        lines.push(`│ Most Popular: ${_name.padEnd(20)} │`);
        if (_adopted > 0) {
          lines.push(`│ (_adopted ${_adopted} times)${" ".repeat(16)} │`);
        }
      }
    }

    return _lines.join("\n");
  }

  private renderFooter(): string {
    return `│                                     │
╰─────────────────────────────────────╯
  💡 Use /team-help for collaboration commands`;
  }

  private getMemberStatus(member: TeamMember): string {
    const _now = new Date();
    const _timeSinceActivity = _now.getTime() - member.lastActivity.getTime();

    if (member.currentFiles.length > 0) {
      const _fileName = this.getFileName(member.currentFiles[0]);
      return `editing ${_fileName.slice(0, 8)}`;
    }

    if (_timeSinceActivity < 60 * 1000) {
      // Less than 1 minute
      return "active";
    } else if (_timeSinceActivity < 5 * 60 * 1000) {
      // Less than 5 _minutes
      return "recent";
    } else {
      return "idle";
    }
  }

  private formatActivity(activity: Activity): string {
    const _time = this.getRelativeTime(activity.timestamp);
    const _icon = this.getActivityIcon(activity.type);
    const _name = activity.memberName.slice(0, 8);
    const _action = activity.description.slice(0, 15);

    return `${_icon}${_name}: ${_action} ${_time}`;
  }

  private getActivityIcon(type: string): string {
    const icons: Record<string, string> = {
      edit: "✏️ ",
      save: "💾 ",
      patternlearned: "🧩 ",
      command: "⚡ ",
      join: "👋 ",
      leave: "👋 ",
      conflict: "⚠️ ",
      patternshared: "📤 ",
      patternadopted: "📥 ",
    };
    return icons[type] || "• ";
  }

  private getSeverityIcon(_severity: string): string {
    const icons: Record<string, string> = {
      error: "🚨",
      warning: "⚠️ ",
      info: "ℹ️ ",
    };
    return icons[_severity] || "• ";
  }

  private getRelativeTime(timestamp: Date): string {
    const _now = new Date();
    const _diff = _now.getTime() - timestamp.getTime();
    const _seconds = Math.floor(_diff / 1000);
    const _minutes = Math.floor(_seconds / 60);
    const _hours = Math.floor(_minutes / 60);

    if (_seconds < 60) {
      return "_now";
    } else if (_minutes < 60) {
      return `${_minutes}m`;
    } else if (_hours < 24) {
      return `${_hours}h`;
    } else {
      return `${Math.floor(_hours / 24)}d`;
    }
  }

  private getFileName(_filePath: string): string {
    return _filePath.split("/").pop() || _filePath;
  }
}

export class ActivityFeed {
  private _activities: Activity[] = [];
  private readonly MAX_ACTIVITIES = 50;

  addActivity(activity: Activity): void {
    this.activities.unshift(activity);

    if (this.activities.length > this.MAX_ACTIVITIES) {
      this.activities = this.activities.slice(0, this.MAX_ACTIVITIES);
    }
  }

  getActivities(limit?: number): Activity[] {
    return this.activities.slice(0, limit || this.activities.length);
  }

  getActivitiesByMember(_memberId: string, limit?: number): Activity[] {
    return this.activities
      .filter((activity) => activity._memberId === _memberId)
      .slice(0, limit || this.activities.length);
  }

  getActivitiesByType(_type: string, limit?: number): Activity[] {
    return this.activities
      .filter((activity) => activity._type === _type)
      .slice(0, limit || this.activities.length);
  }

  clear(): void {
    this.activities = [];
  }

  renderFeed(limit: number = 10): string {
    const _activities = this.getActivities(limit);

    if (_activities.length === 0) {
      return "No _activities yet";
    }

    const _lines = [`Activity Feed (${_activities.length} items):`];
    lines.push("─".repeat(40));

    for (const activity of _activities) {
      const _time = activity.timestamp.toLocaleTimeString();
      const _icon = this.getActivityIcon(activity.type);
      lines.push(
        `${_icon} ${_time} - ${activity.memberName}: ${activity.description}`,
      );
    }

    return _lines.join("\n");
  }

  private getActivityIcon(type: string): string {
    const icons: Record<string, string> = {
      edit: "✏️",
      save: "💾",
      patternlearned: "🧩",
      command: "⚡",
      join: "👋",
      leave: "👋",
      conflict: "⚠️",
    };
    return icons[type] || "•";
  }
}
