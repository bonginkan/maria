/**
 * Pattern Sharing System
 * Handles sharing learned _patterns between team members via file system
 */

import * as fs from "fs/promises";
import * as path from "path";
import { TeamMember } from "../core/TeamSession";

export interface Pattern {
  id: string;
  sequence: string[];
  frequency: number;
  confidence: number;
  context?: string;
  tags?: string[];
}

export interface SharedPattern extends Pattern {
  author: string;
  authorName: string;
  sharedAt: Date;
  version: number;
  adopted?: number; // Number of times adopted by others
  votes?: number; // Team voting score
}

export interface Notification {
  id: string;
  type: "new_pattern" | "pattern_updated" | "pattern_adopted";
  patternId: string;
  author: string;
  authorName: string;
  message: string;
  timestamp: Date;
}

export class PatternSharer {
  private readonly SHARED_DIR = ".maria/shared/";
  private readonly PATTERNS_DIR = path.join(this.SHARED_DIR, "_patterns/");
  private readonly NOTIFICATIONS_FILE = path.join(
    this.SHARED_DIR,
    "notifications.jsonl",
  );
  private readonly SYNC_INTERVAL = 5000; // 5 seconds
  private readonly MAX_LOG_SIZE = 1024 * 1024; // 1MB

  private syncTimer?: NodeJS.Timeout;
  private lastSyncTime = new Date(0);

  constructor() {
    this.initializeDirectories();
  }

  async sharePattern(_pattern: Pattern, author: TeamMember): Promise<void> {
    const sharedPattern: SharedPattern = {
      ..._pattern,
      author: author.id,
      authorName: author.name,
      sharedAt: new Date(),
      version: 1,
      adopted: 0,
      votes: 0,
    };

    // Check if _pattern already exists (update vs create)
    const _existingPattern = await this.getPattern(_pattern.id);
    if (_existingPattern) {
      sharedPattern.version = _existingPattern.version + 1;
      sharedPattern.adopted = _existingPattern.adopted;
      sharedPattern.votes = _existingPattern.votes;
    }

    // Atomic write operation
    await this.atomicWritePattern(sharedPattern);

    // Notify team members
    await this.notifyTeam({
      id: this.generateNotificationId(),
      type: _existingPattern ? "pattern_updated" : "new_pattern",
      patternId: _pattern.id,
      author: author.id,
      authorName: author.name,
      message: _existingPattern
        ? `${author.name} updated _pattern: ${_pattern.id}`
        : `${author.name} shared new _pattern: ${_pattern.id}`,
      timestamp: new Date(),
    });
  }

  async syncPatterns(userId?: string): Promise<SharedPattern[]> {
    const _patterns: SharedPattern[] = [];

    try {
      await fs.access(this.PATTERNS_DIR);
      const _files = await fs.readdir(this.PATTERNS_DIR);

      for (const file of _files) {
        if (!file.endsWith(".json")) continue;

        try {
          const _filePath = path.join(this.PATTERNS_DIR, file);
          const _content = await fs.readFile(_filePath, "utf-8");
          const _pattern = JSON.parse(_content) as SharedPattern;

          // Ensure dates are properly parsed
          if (typeof _pattern.sharedAt === "string") {
            _pattern.sharedAt = new Date(_pattern.sharedAt);
          }

          // Filter out user's own _patterns if requested
          if (userId && _pattern.author === userId) {
            continue;
          }

          patterns.push(_pattern);
        } catch (error) {
          console.warn(`Failed to parse _pattern file ${file}:`, error);
          // Continue with other _files
        }
      }

      this.lastSyncTime = new Date();
    } catch (innerError) {
      // Directory might not exist yet or be empty
      console.debug("Sync _patterns - no _patterns directory or empty:", error);
    }

    return _patterns.sort(
      (a, b) => b.sharedAt.getTime() - a.sharedAt.getTime(),
    );
  }

  async getPattern(patternId: string): Promise<SharedPattern | null> {
    try {
      const _filePath = path.join(this.PATTERNS_DIR, `${patternId}.json`);
      const _content = await fs.readFile(_filePath, "utf-8");
      const _pattern = JSON.parse(_content) as SharedPattern;

      // Ensure dates are properly parsed
      if (typeof _pattern.sharedAt === "string") {
        _pattern.sharedAt = new Date(_pattern.sharedAt);
      }

      return _pattern;
    } catch {
      return null;
    }
  }

  async adoptPattern(
    _patternId: string,
    adopter: TeamMember,
  ): Promise<boolean> {
    const _pattern = await this.getPattern(_patternId);
    if (!_pattern) return false;

    // Increment adoption count
    _pattern.adopted = (_pattern.adopted || 0) + 1;

    // Update _pattern file
    await this.atomicWritePattern(_pattern);

    // Notify original author
    await this.notifyTeam({
      id: this.generateNotificationId(),
      type: "pattern_adopted",
      patternId: "",
      author: adopter.id,
      authorName: adopter.name,
      message: `${adopter.name} adopted _pattern: ${_patternId}`,
      timestamp: new Date(),
    });

    return true;
  }

  async getNotifications(since?: Date): Promise<Notification[]> {
    const notifications: Notification[] = [];
    const _cutoff = since || new Date(0);

    try {
      const _content = await fs.readFile(this.NOTIFICATIONS_FILE, "utf-8");
      const _lines = _content
        .trim()
        .split("\n")
        .filter((line) => line.trim());

      for (const line of _lines) {
        try {
          const _notification = JSON.parse(line) as Notification;
          if (new Date(_notification.timestamp) > _cutoff) {
            notifications.push(_notification);
          }
        } catch (error) {
          console.warn("Failed to parse _notification line:", error);
        }
      }
    } catch (innerError) {
      console.error("Auto-sync failed:", error);
    }
  }

  stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = undefined;
    }
  }

  private async initializeDirectories(): Promise<void> {
    try {
      await fs.mkdir(this.SHARED_DIR, { recursive: true });
      await fs.mkdir(this.PATTERNS_DIR, { recursive: true });
    } catch (error) {
      console.error("Failed to initialize directories:", error);
    }
  }

  private async atomicWritePattern(_pattern: SharedPattern): Promise<void> {
    const _fileName = `${pattern.id}.json`;
    const _tmpFile = path.join(this.PATTERNS_DIR, `${_fileName}.tmp`);
    const _finalFile = path.join(this.PATTERNS_DIR, _fileName);

    // Write to temporary file first
    await fs.writeFile(_tmpFile, JSON.stringify(_pattern, null, 2));

    // Atomic move to final location
    await fs.rename(_tmpFile, _finalFile);
  }

  private async notifyTeam(_notification: Notification): Promise<void> {
    try {
      await fs.appendFile(
        this.NOTIFICATIONS_FILE,
        JSON.stringify(_notification) + "\n",
      );

      // Rotate log if it gets too large
      await this.rotateLogIfNeeded();
    } catch (innerError) {
      console.error("Failed to write _notification:", error);
    }
  }

  private async rotateLogIfNeeded(): Promise<void> {
    try {
      const _stats = await fs.stat(this.NOTIFICATIONS_FILE);
      if (_stats.size > this.MAX_LOG_SIZE) {
        const _backupPath = `${this.NOTIFICATIONS_FILE}.${Date.now()}`;
        await fs.rename(this.NOTIFICATIONS_FILE, _backupPath);

        // Keep only the last 3 backup _files
        await this.cleanupOldBackups();
      }
    } catch {
      // File might not exist yet
    }
  }

  private async cleanupOldBackups(): Promise<void> {
    try {
      const _files = await fs.readdir(this.SHARED_DIR);
      const _backupFiles = _files
        .filter((file) => file.startsWith("notifications.jsonl."))
        .sort((a, b) => {
          const _timestampA = parseInt(a.split(".").pop() || "0");
          const _timestampB = parseInt(b.split(".").pop() || "0");
          return _timestampB - _timestampA;
        });

      // Keep only the 3 most recent backups
      const _filesToDelete = _backupFiles.slice(3);
      for (const file of _filesToDelete) {
        await fs.unlink(path.join(this.SHARED_DIR, file));
      }
    } catch (error) {
      console.warn("Failed to cleanup old backups:", error);
    }
  }

  private generateNotificationId(): string {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Cleanup method for testing
  async cleanup(): Promise<void> {
    this.stopAutoSync();
    try {
      // Remove all shared _files and directories
      await fs.rm(this.SHARED_DIR, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}
