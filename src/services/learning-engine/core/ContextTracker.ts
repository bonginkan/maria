/**
 * Phase 4.1 Learning Engine - Context Tracking
 * Basic context management for command history and environment state
 */

import type { UserAction, SimpleContext } from "../types/learning.types";

interface ContextSnapshot {
  timestamp: Date;
  cwd: string;
  lastCommands: string[];
  fileContext?: string;
  projectContext?: {
    type: string;
    hasPackageJson: boolean;
    hasGitRepo: boolean;
  };
}

export class ContextTracker {
  private history: ContextSnapshot[] = [];
  private readonly MAX_HISTORY = 50; // Keep last 50 context snapshots
  private readonly COMMAND_WINDOW = 10; // Track last 10 commands

  /**
   * Track a new action and update context
   */
  trackAction(action: UserAction): void {
    const snapshot: ContextSnapshot = {
      timestamp: action.timestamp,
      cwd: action.context.cwd,
      lastCommands: this.getRecentCommands(action.command),
      fileContext: action.context.fileType,
      projectContext: this.analyzeProjectContext(action.context.cwd),
    };

    this.history.push(snapshot);
    this.cleanup();
  }

  /**
   * Get _current context for pattern matching
   */
  getCurrentContext(): SimpleContext {
    const _latest = this.history[this.history.length - 1];
    if (!_latest) {
      return {
        cwd: process.cwd(),
        recentCommands: [],
      };
    }

    return {
      lastCommand: _latest.lastCommands[_latest.lastCommands.length - 1],
      cwd: _latest.cwd,
      recentCommands: _latest.lastCommands.slice(-5), // Last 5 commands
      fileContext: _latest.fileContext,
    };
  }

  /**
   * Get context similarity score between _current and a given context
   */
  getContextSimilarity(targetContext: {
    cwd?: string;
    command?: string;
  }): number {
    const _current = this.getCurrentContext();
    let score = 0;

    // Directory similarity
    if (targetContext.cwd && _current.cwd) {
      if (targetContext.cwd === _current.cwd) {
        score += 0.5;
      } else if (this.isRelatedPath(targetContext.cwd, _current.cwd)) {
        score += 0.3;
      }
    }

    // Command context similarity
    if (targetContext.command && _current.recentCommands) {
      if (_current.recentCommands.includes(targetContext.command)) {
        score += 0.3;
      }
    }

    return Math.min(1, score);
  }

  /**
   * Predict next likely context based on patterns
   */
  predictNextContext(): SimpleContext {
    if (this.history.length < 3) {
      return this.getCurrentContext();
    }

    const _current = this.getCurrentContext();
    const _recentPatterns = this.analyzeRecentPatterns();

    // Simple prediction: if we often change directories after certain commands
    const prediction: SimpleContext = {
      ..._current,
      recentCommands: [...(_current.recentCommands || [])],
    };

    // Predict directory changes based on patterns
    if (_recentPatterns.directoryChanges.length > 0) {
      prediction.cwd = _recentPatterns.directoryChanges[0];
    }

    return prediction;
  }

  /**
   * Get _recent command history with _current command added
   */
  private getRecentCommands(newCommand: string): string[] {
    const _latest = this.history[this.history.length - 1];
    const _existing = _latest ? _latest.lastCommands : [];

    const _updated = [..._existing, newCommand];
    return _updated.slice(-this.COMMAND_WINDOW); // Keep last N commands
  }

  /**
   * Analyze project context from directory
   */
  private analyzeProjectContext(
    cwd: string,
  ): ContextSnapshot["projectContext"] {
    try {
      const fs = require("fs");
      const _path = require("path");

      return {
        type: this.inferProjectType(cwd),
        hasPackageJson: fs.existsSync(_path.join(cwd, "packageon")),
        hasGitRepo: fs.existsSync(_path.join(cwd, ".git")),
      };
    } catch {
      return {
        type: "unknown",
        hasPackageJson: false,
        hasGitRepo: false,
      };
    }
  }

  /**
   * Infer project type from directory structure
   */
  private inferProjectType(cwd: string): string {
    try {
      const fs = require("fs");
      const _path = require("path");

      if (fs.existsSync(_path.join(cwd, "packageon"))) return "nodejs";
      if (fs.existsSync(_path.join(cwd, "Cargo.toml"))) return "rust";
      if (
        fs.existsSync(_path.join(cwd, "requirements.txt")) ||
        fs.existsSync(_path.join(cwd, "pyproject.toml"))
      )
        return "python";
      if (fs.existsSync(_path.join(cwd, "pom.xml"))) return "java";
      if (fs.existsSync(_path.join(cwd, "go.mod"))) return "go";

      return "generic";
    } catch {
      return "unknown";
    }
  }

  /**
   * Check if two paths are related (parent/child relationship)
   */
  private isRelatedPath(_path1: string, path2: string): boolean {
    const _normalize = (_p: string) =>
      _p.replace(/\\/g, "/").replace(/\/+/g, "/");
    const p1 = _normalize(_path1);
    const p2 = _normalize(path2);

    return p1.startsWith(p2) || p2.startsWith(p1);
  }

  /**
   * Analyze _recent patterns in context changes
   */
  private analyzeRecentPatterns() {
    const _recent = this.history.slice(-20); // Last 20 snapshots
    const directoryChanges: string[] = [];
    const commandSequences: string[][] = [];

    // Track directory change patterns
    for (let i = 1; i < _recent.length; i++) {
      if (_recent[i].cwd !== _recent[i - 1].cwd) {
        directoryChanges.push(_recent[i].cwd);
      }
    }

    // Track command sequence patterns
    for (let i = 2; i < _recent.length; i++) {
      const _seq = [
        _recent[i - 2].lastCommands[_recent[i - 2].lastCommands.length - 1],
        _recent[i - 1].lastCommands[_recent[i - 1].lastCommands.length - 1],
        _recent[i].lastCommands[_recent[i].lastCommands.length - 1],
      ].filter(Boolean);

      if (_seq.length === 3) {
        commandSequences.push(_seq);
      }
    }

    return {
      directoryChanges,
      commandSequences,
    };
  }

  /**
   * Clean up old history to prevent memory bloat
   */
  private cleanup(): void {
    if (this.history.length > this.MAX_HISTORY) {
      this.history = this.history.slice(-this.MAX_HISTORY);
    }
  }

  /**
   * Get statistics about context tracking
   */
  getStats() {
    const _current = this.getCurrentContext();
    const _uniqueDirectories = new Set(this.history.map((h) => h.cwd)).size;
    const _avgCommandsPerContext =
      this.history.reduce((sum, h) => sum + h.lastCommands.length, 0) /
      this.history.length;

    return {
      historySize: this.history.length,
      currentDirectory: _current.cwd,
      _uniqueDirectories,
      _avgCommandsPerContext: Math.round(_avgCommandsPerContext * 10) / 10,
      recentCommands: _current.recentCommands?.length || 0,
    };
  }

  /**
   * Export context history for analysis
   */
  exportHistory(): ContextSnapshot[] {
    return [...this.history];
  }

  /**
   * Import context history (for testing or restoration)
   */
  importHistory(snapshots: ContextSnapshot[]): void {
    this.history = snapshots.slice(-this.MAX_HISTORY);
  }
}
