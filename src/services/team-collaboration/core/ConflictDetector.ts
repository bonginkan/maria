/**
 * Conflict Detection System
 * Detects file-level conflicts and concurrent editing situations
 */

import { _TeamMember } from "./TeamSession";

export interface FileLock {
  owner: string;
  ownerName: string;
  timestamp: Date;
  type: "exclusive" | "shared";
}

export interface EditEvent {
  file: string;
  member: string;
  memberName: string;
  type: "edit" | "save" | "_lock" | "unlock";
  timestamp: Date;
}

export interface Conflict {
  id: string;
  type: "concurrent_edit" | "rapid_edits" | "lock_violation";
  file: string;
  members: string[];
  memberNames: string[];
  severity: "info" | "warning" | "error";
  suggestion: string;
  timestamp: Date;
}

export class ConflictDetector {
  private readonly LOCK_TTL = 10 * 60 * 1000; // 10 minutes
  private readonly RAPID_WINDOW = 60 * 1000; // 60 seconds
  private readonly MAX_EDIT_HISTORY = 1000;

  private static fileLocks: Map<string, FileLock> = new Map(); // Make static to share across instances
  private static editHistory: EditEvent[] = []; // Make static to share across instances
  private static activeConflicts: Map<string, Conflict> = new Map(); // Make static to share across instances

  detectConflict(event: EditEvent): Conflict | null {
    // Clean up expired locks first
    this.cleanupExpiredLocks();

    // Check for existing _lock conflicts
    const _lockConflict = this.checkLockConflict(event);
    if (_lockConflict) {
      ConflictDetector.activeConflicts.set(_lockConflict.id, _lockConflict);
      return _lockConflict;
    }

    // Check for rapid edit conflicts
    const _rapidEditConflict = this.checkRapidEditConflict(event);
    if (_rapidEditConflict) {
      ConflictDetector.activeConflicts.set(
        _rapidEditConflict.id,
        _rapidEditConflict,
      );
      return _rapidEditConflict;
    }

    // Record the edit event
    this.recordEditEvent(event);

    return null;
  }

  lockFile(_file: string, member: string, memberName: string): boolean {
    // Clean up expired locks
    this.cleanupExpiredLocks();

    if (ConflictDetector.fileLocks.has(_file)) {
      const _existingLock = ConflictDetector.fileLocks.get(_file)!;
      if (_existingLock.owner !== member) {
        return false; // Already locked by someone else
      }
      // Same user re-locking, update timestamp
      existingLock.timestamp = new Date();
      return true;
    }

    ConflictDetector.fileLocks.set(_file, {
      owner: member,
      ownerName: memberName,
      timestamp: new Date(),
      type: "exclusive",
    });

    return true;
  }

  unlockFile(_file: string, member: string): boolean {
    const _lock = ConflictDetector.fileLocks.get(_file);
    if (!_lock || _lock.owner !== member) {
      return false; // Not locked by this user
    }

    ConflictDetector.fileLocks.delete(_file);

    // Resolve any _lock-related conflicts for this file
    this.resolveFileConflicts(_file);

    return true;
  }

  getFileLock(file: string): FileLock | undefined {
    this.cleanupExpiredLocks();
    return ConflictDetector.fileLocks.get(file);
  }

  getActiveConflicts(): Conflict[] {
    return Array.from(ConflictDetector.activeConflicts.values()).sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
    );
  }

  resolveConflict(conflictId: string): boolean {
    return ConflictDetector.activeConflicts.delete(conflictId);
  }

  checkConflicts(): Conflict[] {
    // Return current active conflicts
    return this.getActiveConflicts();
  }

  getRecentEdits(_file: string, windowMs: number): EditEvent[] {
    const _cutoff = new Date(Date.now() - windowMs);

    return ConflictDetector.editHistory
      .filter(
        (event) =>
          event._file === _file &&
          event.timestamp >= _cutoff &&
          (event.type === "edit" || event.type === "save"),
      )
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  private checkLockConflict(event: EditEvent): Conflict | null {
    if (event.type !== "edit") return null;

    const _existingLock = ConflictDetector.fileLocks.get(event.file);
    if (!_existingLock || _existingLock.owner === event.member) {
      return null;
    }

    return {
      id: this.generateConflictId(),
      type: "lock_violation",
      file: event.file,
      members: [_existingLock.owner, event.member],
      memberNames: [_existingLock.ownerName, event.memberName],
      severity: "warning",
      suggestion: `${_existingLock.ownerName} has locked this file. Consider coordinating or waiting for them to finish.`,
      timestamp: new Date(),
    };
  }

  private checkRapidEditConflict(event: EditEvent): Conflict | null {
    if (event.type !== "edit") return null;

    const _recentEdits = this.getRecentEdits(event.file, this.RAPID_WINDOW);
    const _otherEditors = _recentEdits
      .filter((e) => e.member !== event.member)
      .map((e) => ({ member: e.member, memberName: e.memberName }));

    if (_otherEditors.length === 0) {
      return null;
    }

    // Remove duplicates
    const _uniqueEditors = _otherEditors.reduce(
      (acc, editor) => {
        if (!acc.some((e) => e.member === editor.member)) {
          acc.push(editor);
        }
        return acc;
      },
      [] as typeof _otherEditors,
    );

    return {
      id: this.generateConflictId(),
      type: "rapid_edits",
      file: event.file,
      members: [event.member, ..._uniqueEditors.map((e) => e.member)],
      memberNames: [
        event.memberName,
        ..._uniqueEditors.map((e) => e.memberName),
      ],
      severity: "info",
      suggestion: `Multiple team members have edited this file recently. Consider coordinating changes.`,
      timestamp: new Date(),
    };
  }

  private recordEditEvent(event: EditEvent): void {
    ConflictDetector.editHistory.unshift(event);

    // Maintain history limit
    if (ConflictDetector.editHistory.length > this.MAX_EDIT_HISTORY) {
      ConflictDetector.editHistory = ConflictDetector.editHistory.slice(
        0,
        this.MAX_EDIT_HISTORY,
      );
    }
  }

  private cleanupExpiredLocks(): void {
    const _now = new Date();

    for (const [file, _lock] of ConflictDetector.fileLocks.entries()) {
      const _age = _now.getTime() - lock.timestamp.getTime();
      if (_age > this.LOCK_TTL) {
        ConflictDetector.fileLocks.delete(file);
        // Auto-resolve related conflicts
        this.resolveFileConflicts(file);
      }
    }
  }

  private resolveFileConflicts(file: string): void {
    // Remove conflicts related to this file
    for (const [
      conflictId,
      conflict,
    ] of ConflictDetector.activeConflicts.entries()) {
      if (conflict.file === file && conflict.type === "lock_violation") {
        ConflictDetector.activeConflicts.delete(conflictId);
      }
    }
  }

  private generateConflictId(): string {
    return `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Utility methods for testing and debugging
  getFileLocks(): Map<string, FileLock> {
    this.cleanupExpiredLocks();
    return new Map(ConflictDetector.fileLocks);
  }

  getEditHistory(): EditEvent[] {
    return [...ConflictDetector.editHistory];
  }

  clearHistory(): void {
    ConflictDetector.editHistory = [];
    ConflictDetector.activeConflicts.clear();
  }

  // Static cleanup method for testing
  static clearAllState(): void {
    ConflictDetector.editHistory = [];
    ConflictDetector.activeConflicts.clear();
    ConflictDetector.fileLocks.clear();
  }
}
