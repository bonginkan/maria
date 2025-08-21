/**
 * Approval Commit
 * Git-like commit management for approval decisions
 */

import crypto from 'crypto';
import { ApprovalCommit, ApprovalDiff, ApprovalState, ApprovalChange } from './types';
import { ApprovalResponse, RiskLevel, ApprovalCategory } from '../approval-engine/types';

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
    const timestamp = new Date();
    const diff = this.generateDiff(approvalData, previousState);

    // Generate commit content for hashing
    const commitContent = this.generateCommitContent({
      approvalData,
      parentCommits,
      author,
      message: message || this.generateDefaultMessage(approvalData),
      timestamp,
      diff,
    });

    // Generate SHA-like hash
    const commitId = this.generateCommitHash(commitContent);
    const treeHash = this.generateTreeHash(approvalData, previousState);

    return {
      id: commitId,
      parentCommits,
      approvalData,
      metadata: {
        timestamp,
        author: author.name,
        email: author.email,
        message: message || this.generateDefaultMessage(approvalData),
        tags: this.generateAutoTags(approvalData),
        riskLevel: this.extractRiskLevel(approvalData),
        category: this.extractCategory(approvalData),
      },
      diff,
      treeHash,
    };
  }

  /**
   * Generate commit hash (SHA-like)
   */
  private static generateCommitHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex').substring(0, 12); // Use first 12 characters like Git short hash
  }

  /**
   * Generate tree hash representing the approval state
   */
  private static generateTreeHash(
    approvalData: ApprovalResponse,
    previousState?: ApprovalState,
  ): string {
    const stateContent = JSON.stringify({
      approved: approvalData.approved,
      action: approvalData.action,
      trustLevel: approvalData.trustLevel,
      timestamp: approvalData.timestamp,
      previousState,
    });

    return crypto.createHash('sha256').update(stateContent).digest('hex').substring(0, 12);
  }

  /**
   * Generate commit content string for hashing
   */
  private static generateCommitContent(params: {
    approvalData: ApprovalResponse;
    parentCommits: string[];
    author: { name: string; email: string };
    message: string;
    timestamp: Date;
    diff: ApprovalDiff;
  }): string {
    const { approvalData, parentCommits, author, message, timestamp, diff } = params;

    return [
      `tree ${this.generateTreeHash(approvalData)}`,
      ...parentCommits.map((parent) => `parent ${parent}`),
      `author ${author.name} <${author.email}> ${Math.floor(timestamp.getTime() / 1000)}`,
      `committer ${author.name} <${author.email}> ${Math.floor(timestamp.getTime() / 1000)}`,
      '',
      message,
      '',
      `approval-action: ${approvalData.action}`,
      `approval-status: ${approvalData.approved ? 'approved' : 'rejected'}`,
      `diff-summary: ${diff.summary}`,
    ].join('\n');
  }

  /**
   * Generate automatic tags based on approval data
   */
  private static generateAutoTags(approvalData: ApprovalResponse): string[] {
    const tags: string[] = [];

    // Add action-based tags
    tags.push(approvalData.action);

    // Add status tags
    if (approvalData.approved) {
      tags.push('approved');
    } else {
      tags.push('rejected');
    }

    // Add quick decision tag
    if (approvalData.quickDecision) {
      tags.push('quick-decision');
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
    // For now, infer from action and comments
    if (
      approvalData.comments?.includes('critical') ||
      approvalData.comments?.includes('security')
    ) {
      return 'critical';
    }
    if (approvalData.comments?.includes('high')) {
      return 'high';
    }
    if (approvalData.comments?.includes('medium')) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Extract category from approval data (simplified for now)
   */
  private static extractCategory(approvalData: ApprovalResponse): ApprovalCategory {
    // This would typically come from the original request
    // For now, infer from comments
    if (approvalData.comments?.includes('security')) {
      return 'security';
    }
    if (approvalData.comments?.includes('architecture')) {
      return 'architecture';
    }
    if (approvalData.comments?.includes('performance')) {
      return 'performance';
    }
    if (approvalData.comments?.includes('refactor')) {
      return 'refactoring';
    }
    return 'implementation';
  }

  /**
   * Generate default commit message
   */
  private static generateDefaultMessage(approvalData: ApprovalResponse): string {
    const action = approvalData.action;
    const status = approvalData.approved ? 'approved' : 'rejected';

    if (action === 'trust') {
      return `Grant trust: Auto-approve similar requests (${approvalData.trustLevel})`;
    }

    if (action === 'review') {
      return `Request review: Additional validation required`;
    }

    const baseMessage = `${action.charAt(0).toUpperCase() + action.slice(1)}: ${status}`;

    if (approvalData.comments) {
      return `${baseMessage}\n\n${approvalData.comments}`;
    }

    return baseMessage;
  }

  /**
   * Generate diff between approval states
   */
  private static generateDiff(
    approvalData: ApprovalResponse,
    previousState?: ApprovalState,
  ): ApprovalDiff {
    const changes: ApprovalChange[] = [];
    const before: Partial<ApprovalState> = previousState || {};
    const after: Partial<ApprovalState> = this.createNewState(approvalData, previousState);

    // Detect trust level changes
    if (
      approvalData.trustLevel &&
      (!previousState || previousState.trustLevel !== approvalData.trustLevel)
    ) {
      changes.push({
        path: 'trust-level',
        operation: previousState?.trustLevel ? 'modify' : 'add',
        oldValue: previousState?.trustLevel,
        newValue: approvalData.trustLevel,
        description: `Trust level ${previousState?.trustLevel ? 'changed' : 'set'} to ${approvalData.trustLevel}`,
      });
    }

    // Detect approval status changes
    changes.push({
      path: 'approval-status',
      operation: 'add',
      newValue: approvalData.approved,
      description: `Request ${approvalData.approved ? 'approved' : 'rejected'}`,
    });

    // Detect action type
    changes.push({
      path: 'approval-action',
      operation: 'add',
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
      trustLevel: 'learning',
      autoApprovalCategories: [],
      approvedRequests: [],
      rejectedRequests: [],
      policies: {},
    };

    const newState = { ...base };

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

    return newState;
  }

  /**
   * Determine the type of change
   */
  private static determineChangeType(approvalData: ApprovalResponse): ApprovalDiff['type'] {
    if (approvalData.action === 'trust') {
      return 'trust-change';
    }
    if (approvalData.approved) {
      return 'approval';
    }
    return 'rejection';
  }

  /**
   * Generate diff summary
   */
  private static generateDiffSummary(changes: ApprovalChange[]): string {
    if (changes.length === 0) {
      return 'No changes';
    }

    const descriptions = changes.map((change) => change.description);
    return descriptions.join(', ');
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
      return `${commit.id} ${commit.metadata.message.split('\n')[0]}`;
    }

    const lines: string[] = [];

    // Commit header
    lines.push(`commit ${commit.id}`);

    if (commit.parentCommits.length > 0) {
      lines.push(
        `Parent${commit.parentCommits.length > 1 ? 's' : ''}: ${commit.parentCommits.join(' ')}`,
      );
    }

    lines.push(`Author: ${commit.metadata.author} <${commit.metadata.email}>`);
    lines.push(`Date: ${commit.metadata.timestamp.toISOString()}`);

    if (showTags && commit.metadata.tags.length > 0) {
      lines.push(`Tags: ${commit.metadata.tags.join(', ')}`);
    }

    // Risk and category info
    lines.push(`Risk: ${commit.metadata.riskLevel}, Category: ${commit.metadata.category}`);

    // Commit message
    lines.push('');
    lines.push(`    ${commit.metadata.message.replace(/\n/g, '\n    ')}`);

    // Diff information
    if (showDiff) {
      lines.push('');
      lines.push('Changes:');
      commit.diff.changes.forEach((change) => {
        lines.push(`    ${change.operation}: ${change.description}`);
      });
    }

    return lines.join('\n');
  }

  /**
   * Parse commit ID to extract timestamp and validate format
   */
  static parseCommitId(commitId: string): { timestamp: number; valid: boolean } {
    if (!commitId || commitId.length !== 12) {
      return { timestamp: 0, valid: false };
    }

    // For now, just validate it's a valid hex string
    const valid = /^[0-9a-f]{12}$/i.test(commitId);
    return { timestamp: Date.now(), valid };
  }

  /**
   * Compare two commits for ordering
   */
  static compareCommits(a: ApprovalCommit, b: ApprovalCommit): number {
    return b.metadata.timestamp.getTime() - a.metadata.timestamp.getTime();
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
    const ancestors1 = this.getAncestors(commit1, allCommits);
    const ancestors2 = this.getAncestors(commit2, allCommits);

    for (const ancestor of ancestors1) {
      if (ancestors2.includes(ancestor)) {
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
    const queue = [...commit.parentCommits];

    while (queue.length > 0) {
      const parentId = queue.shift()!;
      if (ancestors.includes(parentId)) continue;

      ancestors.push(parentId);
      const parent = allCommits.get(parentId);
      if (parent) {
        queue.push(...parent.parentCommits);
      }
    }

    return ancestors;
  }
}
