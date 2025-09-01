/**
 * Approval Commit
 * Git-like commit management for approval decisions
 */

import crypto from "crypto";
import {
  ApprovalChange,
  ApprovalCommit,
  ApprovalDiff,
  ApprovalState,
} from "./types";
import {
  ApprovalCategory,
  ApprovalResponse,
  _RiskLevel,
} from "../approval-engine/types";

export class ApprovalCommitManager {
  /**
   * Create a new approval commit
   */
  static createCommit(
    approvalData: ApprovalResponse,
    parentCommits: string[] = [],
    author: { name: string; email: string },
    message?: string,
    previousState?: ApprovalState,
  ): ApprovalCommit {
    const _timestamp = new Date();
    const _diff = this.generateDiff(approvalData, previousState);

    // Generate commit content for hashing
    const _commitContent = this.generateCommitContent({
      approvalData,
      parentCommits,
      author,
      message: message || this.generateDefaultMessage(approvalData),
      _timestamp,
      _diff,
    });

    // Generate SHA-like hash
    const _commitId = this.generateCommitHash(_commitContent);
    const _treeHash = this.generateTreeHash(approvalData, previousState);

    return {
      id: _commitId,
      parentCommits,
      approvalData,
      metadata: {
        _timestamp,
        author: author.name,
        email: author.email,
        message: message || this.generateDefaultMessage(approvalData),
        tags: this.generateAutoTags(approvalData),
        riskLevel: this.extractRiskLevel(approvalData),
        category: this.extractCategory(approvalData),
      },
      _diff,
      _treeHash,
    };
  }

  /**
   * Generate commit hash (SHA-like)
   */
  private static generateCommitHash(content: string): string {
    return crypto
      .createHash("sha256")
      .update(content)
      .digest("hex")
      .substring(0, 12); // Use first 12 characters like Git short hash
  }

  /**
   * Generate tree hash representing the approval state
   */
  private static generateTreeHash(
    approvalData: ApprovalResponse,
    previousState?: ApprovalState,
  ): string {
    const _stateContent = JSON.stringify({
      approved: approvalData.approved,
      _action: approvalData.action,
      trustLevel: approvalData.trustLevel,
      _timestamp: approvalData.timestamp,
      previousState,
    });

    return crypto
      .createHash("sha256")
      .update(_stateContent)
      .digest("hex")
      .substring(0, 12);
  }

  /**
   * Generate commit content string for hashing
   */
  private static generateCommitContent(params: {
    approvalData: ApprovalResponse;
    parentCommits: string[];
    author: { name: string; email: string };
    message: string;
    _timestamp: Date;
    _diff: ApprovalDiff;
  }): string {
    const { approvalData, parentCommits, author, message, _timestamp, _diff } =
      params;

    return [
      `tree ${this.generateTreeHash(approvalData)}`,
      ...parentCommits.map((_parent) => `_parent ${_parent}`),
      `author ${author.name} <${author.email}> ${Math.floor(timestamp.getTime() / 1000)}`,
      `committer ${author.name} <${author.email}> ${Math.floor(timestamp.getTime() / 1000)}`,
      "",
      message,
      "",
      `approval-_action: ${approvalData.action}`,
      `approval-_status: ${approvalData.approved ? "approved" : "rejected"}`,
      `_diff-summary: ${diff.summary}`,
    ].join("\n");
  }

  /**
   * Generate automatic tags based on approval data
   */
  private static generateAutoTags(approvalData: ApprovalResponse): string[] {
    const tags: string[] = [];

    // Add _action-based tags
    tags.push(approvalData.action);

    // Add _status tags
    if (approvalData.approved) {
      tags.push("approved");
    } else {
      tags.push("rejected");
    }

    // Add quick decision tag
    if (approvalData.quickDecision) {
      tags.push("quick-decision");
    }

    // Add trust level tag if present
    if (approvalData.trustLevel) {
      tags.push(`trust-${approvalData.trustLevel}`);
    }

    return tags;
  }

  /**
   * Extract risk level from approval data (simplified for now)
   */
  private static extractRiskLevel(approvalData: ApprovalResponse): RiskLevel {
    // This would typically come from the original request
    // For now, infer from _action and comments
    if (
      approvalData.comments?.includes("critical") ||
      approvalData.comments?.includes("security")
    ) {
      return "critical";
    }
    if (approvalData.comments?.includes("high")) {
      return "high";
    }
    if (approvalData.comments?.includes("medium")) {
      return "medium";
    }
    return "low";
  }

  /**
   * Extract category from approval data (simplified for now)
   */
  private static extractCategory(
    approvalData: ApprovalResponse,
  ): ApprovalCategory {
    // This would typically come from the original request
    // For now, infer from comments
    if (approvalData.comments?.includes("security")) {
      return "security";
    }
    if (approvalData.comments?.includes("architecture")) {
      return "architecture";
    }
    if (approvalData.comments?.includes("performance")) {
      return "performance";
    }
    if (approvalData.comments?.includes("refactor")) {
      return "refactoring";
    }
    return "implementation";
  }

  /**
   * Generate default commit message
   */
  private static generateDefaultMessage(
    approvalData: ApprovalResponse,
  ): string {
    const _action = approvalData._action;
    const _status = approvalData.approved ? "approved" : "rejected";

    if (_action === "trust") {
      return `Grant trust: Auto-approve similar requests (${approvalData.trustLevel})`;
    }

    if (_action === "review") {
      return `Request review: Additional validation required`;
    }

    const _baseMessage = `${_action.charAt(0).toUpperCase() + _action.slice(1)}: ${_status}`;

    if (approvalData.comments) {
      return `${_baseMessage}\n\n${approvalData.comments}`;
    }

    return _baseMessage;
  }

  /**
   * Generate _diff between approval states
   */
  private static generateDiff(
    approvalData: ApprovalResponse,
    previousState?: ApprovalState,
  ): ApprovalDiff {
    const changes: ApprovalChange[] = [];
    const before: Partial<ApprovalState> = previousState || object;
    const after: Partial<ApprovalState> = this.createNewState(
      approvalData,
      previousState,
    );

    // Detect trust level changes
    if (
      approvalData.trustLevel &&
      (!previousState || previousState.trustLevel !== approvalData.trustLevel)
    ) {
      changes.push({
        _path: "trust-level",
        operation: previousState?.trustLevel ? "modify" : "add",
        oldValue: previousState?.trustLevel,
        newValue: approvalData.trustLevel,
        description: `Trust level ${previousState?.trustLevel ? "changed" : "set"} to ${approvalData.trustLevel}`,
      });
    }

    // Detect approval _status changes
    changes.push({
      _path: "approval-_status",
      operation: "add",
      newValue: approvalData.approved,
      description: `Request ${approvalData.approved ? "approved" : "rejected"}`,
    });

    // Detect _action type
    changes.push({
      _path: "approval-_action",
      operation: "add",
      newValue: approvalData.action,
      description: `Action taken: ${approvalData.action}`,
    });

    return {
      type: this.determineChangeType(approvalData),
      before,
      after,
      changes,
      summary: this.generateDiffSummary(changes),
    };
  }

  /**
   * Create new approval state
   */
  private static createNewState(
    approvalData: ApprovalResponse,
    previousState?: ApprovalState,
  ): ApprovalState {
    const base: ApprovalState = previousState || {
      trustLevel: "learning",
      autoApprovalCategories: [],
      approvedRequests: [],
      rejectedRequests: [],
      policies: Record<string, any>,
    };

    const _newState = { ...base };

    // Update trust level if changed
    if (approvalData.trustLevel) {
      newState.trustLevel = approvalData.trustLevel;
    }

    // Add to approved/rejected lists
    if (approvalData.approved) {
      newState.approvedRequests.push(approvalData.requestId);
    } else {
      newState.rejectedRequests.push(approvalData.requestId);
    }

    return _newState;
  }

  /**
   * Determine the type of change
   */
  private static determineChangeType(
    approvalData: ApprovalResponse,
  ): ApprovalDiff["type"] {
    if (approvalData.action === "trust") {
      return "trust-change";
    }
    if (approvalData.approved) {
      return "approval";
    }
    return "rejection";
  }

  /**
   * Generate _diff summary
   */
  private static generateDiffSummary(changes: ApprovalChange[]): string {
    if (changes.length === 0) {
      return "No changes";
    }

    const _descriptions = changes.map((change) => change.description);
    return _descriptions.join(", ");
  }

  /**
   * Format commit for display (like git log)
   */
  static formatCommit(
    commit: ApprovalCommit,
    options: {
      oneline?: boolean;
      showDiff?: boolean;
      showTags?: boolean;
    } = {},
  ): string {
    const { oneline, showDiff, showTags } = options;

    if (oneline) {
      return `${commit.id} ${commit.metadata.message.split("\n")[0]}`;
    }

    const lines: string[] = [];

    // Commit header
    lines.push(`commit ${commit.id}`);

    if (commit.parentCommits.length > 0) {
      lines.push(
        `Parent${commit.parentCommits.length > 1 ? "s" : ""}: ${commit.parentCommits.join(" ")}`,
      );
    }

    lines.push(`Author: ${commit.metadata.author} <${commit.metadata.email}>`);
    lines.push(`Date: ${commit.metadata.timestamp.toISOString()}`);

    if (showTags && commit.metadata.tags.length > 0) {
      lines.push(`Tags: ${commit.metadata.tags.join(", ")}`);
    }

    // Risk and category info
    lines.push(
      `Risk: ${commit.metadata.riskLevel}, Category: ${commit.metadata.category}`,
    );

    // Commit message
    lines.push("");
    lines.push(`    ${commit.metadata.message.replace(/\n/g, "\n    ")}`);

    // Diff information
    if (showDiff) {
      lines.push("");
      lines.push("Changes:");
      commit.diff.changes.forEach((change) => {
        lines.push(`    ${change.operation}: ${change.description}`);
      });
    }

    return lines.join("\n");
  }

  /**
   * Parse commit ID to extract _timestamp and validate format
   */
  static parseCommitId(_commitId: string): {
    _timestamp: number;
    _valid: boolean;
  } {
    if (!_commitId || commitId.length !== 12) {
      return { _timestamp: 0, _valid: false };
    }

    // For now, just validate it's a _valid hex string
    const _valid = /^[0-9a-f]{12}$/i.test(_commitId);
    return { _timestamp: Date.now(), _valid };
  }

  /**
   * Compare two commits for ordering
   */
  static compareCommits(_a: ApprovalCommit, b: ApprovalCommit): number {
    return b.metadata.timestamp.getTime() - _a.metadata.timestamp.getTime();
  }

  /**
   * Find common ancestor of two commits
   */
  static findCommonAncestor(
    commit1: ApprovalCommit,
    commit2: ApprovalCommit,
    allCommits: Map<string, ApprovalCommit>,
  ): string | null {
    // Simple implementation - in practice would use graph traversal
    const _ancestors1 = this.getAncestors(commit1, allCommits);
    const _ancestors2 = this.getAncestors(commit2, allCommits);

    for (const ancestor of _ancestors1) {
      if (_ancestors2.includes(ancestor)) {
        return ancestor;
      }
    }

    return null;
  }

  /**
   * Get all ancestors of a commit
   */
  private static getAncestors(
    commit: ApprovalCommit,
    allCommits: Map<string, ApprovalCommit>,
  ): string[] {
    const ancestors: string[] = [];
    const _queue = [...commit.parentCommits];

    while (_queue.length > 0) {
      const _parentId = _queue.shift()!;
      if (ancestors.includes(_parentId)) {
        continue;
      }

      ancestors.push(_parentId);
      const _parent = allCommits.get(_parentId);
      if (_parent) {
        queue.push(..._parent.parentCommits);
      }
    }

    return ancestors;
  }
}
