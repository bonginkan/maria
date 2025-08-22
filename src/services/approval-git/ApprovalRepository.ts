/**
 * Approval Repository
 * Git-like repository management for approval workflows
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
  ApprovalRepository,
  ApprovalBranch,
  ApprovalCommit,
  ApprovalMergeRequest,
  ApprovalRepoConfig,
  ApprovalStatistics,
  // ApprovalGitEvents, // Currently unused
  ApprovalLogOptions,
  ApprovalBranchOptions,
  ApprovalMergeOptions,
  ApprovalRevertOptions,
  ApprovalTagOptions,
} from './types';
import { ApprovalCommitManager } from './ApprovalCommit';
import { ApprovalResponse } from '../approval-engine/types';

export class ApprovalRepositoryManager extends EventEmitter {
  private static instance: ApprovalRepositoryManager;
  private repository: ApprovalRepository;

  private constructor() {
    super();
    this.repository = this.createDefaultRepository();
  }

  static getInstance(): ApprovalRepositoryManager {
    if (!ApprovalRepositoryManager.instance) {
      ApprovalRepositoryManager.instance = new ApprovalRepositoryManager();
    }
    return ApprovalRepositoryManager.instance;
  }

  /**
   * Create a new approval commit and add to current branch
   */
  async createCommit(
    approvalData: ApprovalResponse,
    message?: string,
    author?: { name: string; email: string },
  ): Promise<ApprovalCommit> {
    const currentBranch = this.getCurrentBranch();
    const parentCommits = currentBranch.head ? [currentBranch.head] : [];

    // Get previous state for diff generation
    const previousCommit = currentBranch.head
      ? this.repository.commits.get(currentBranch.head)
      : undefined;

    const commit = ApprovalCommitManager.createCommit(
      approvalData as ApprovalState,
      parentCommits,
      author || { name: 'MARIA User', email: 'user@maria.ai' },
      message,
      previousCommit?.diff.after, // Use previous state from last commit
    );

    // Add commit to repository
    this.repository.commits.set(commit.id, commit);

    // Update current branch head
    currentBranch.head = commit.id;
    currentBranch.approvalPath.push(commit);
    currentBranch.lastActivity = new Date();

    // Update repository activity
    this.repository.lastActivity = new Date();

    // Emit event
    this.emit('commit-created', commit);

    return commit;
  }

  /**
   * Create a new branch
   */
  createBranch(branchName: string, baseCommit?: string): ApprovalBranch {
    if (this.repository.branches.has(branchName)) {
      throw new Error(`Branch '${branchName}' already exists`);
    }

    const currentBranch = this.getCurrentBranch();
    const base = baseCommit || currentBranch.head || '';

    const branch: ApprovalBranch = {
      name: branchName,
      head: base,
      baseCommit: base,
      approvalPath: base ? [this.repository.commits.get(base)!].filter(Boolean) : [],
      mergeRequests: [],
      protected: false,
      createdAt: new Date(),
      lastActivity: new Date(),
    };

    this.repository.branches.set(branchName, branch);
    this.emit('branch-created', branch);

    return branch;
  }

  /**
   * Switch to a different branch
   */
  checkoutBranch(branchName: string): ApprovalBranch {
    const branch = this.repository.branches.get(branchName);
    if (!branch) {
      throw new Error(`Branch '${branchName}' does not exist`);
    }

    // Update default branch in config
    this.repository.config.branches.main = branchName;

    return branch;
  }

  /**
   * Delete a branch
   */
  deleteBranch(branchName: string, force = false): void {
    if (branchName === this.repository.defaultBranch) {
      throw new Error('Cannot delete the default branch');
    }

    const branch = this.repository.branches.get(branchName);
    if (!branch) {
      throw new Error(`Branch '${branchName}' does not exist`);
    }

    // Check if branch is protected
    if (branch.protected && !force) {
      throw new Error(`Branch '${branchName}' is protected. Use force flag to delete.`);
    }

    // Check for unmerged changes
    if (!force && this.hasUnmergedChanges(branchName)) {
      throw new Error(`Branch '${branchName}' has unmerged changes. Use force flag to delete.`);
    }

    this.repository.branches.delete(branchName);
    this.emit('branch-deleted', { name: branchName });
  }

  /**
   * Create a merge request
   */
  createMergeRequest(
    title: string,
    description: string,
    sourceBranch: string,
    targetBranch: string,
    author: string,
  ): ApprovalMergeRequest {
    const source = this.repository.branches.get(sourceBranch);
    const target = this.repository.branches.get(targetBranch);

    if (!source || !target) {
      throw new Error('Source or target branch does not exist');
    }

    // Get commits to be merged
    const commitsToMerge = this.getCommitsBetween(source.baseCommit, source.head);

    const mergeRequest: ApprovalMergeRequest = {
      id: uuidv4(),
      title,
      description,
      sourceBranch,
      targetBranch,
      commits: commitsToMerge,
      approvals: [],
      status: 'pending',
      author,
      assignees: [],
      reviewers: [],
      labels: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Add to source branch
    source.mergeRequests.push(mergeRequest);

    this.emit('merge-request-created', mergeRequest);

    return mergeRequest;
  }

  /**
   * Merge a branch or merge request
   */
  async mergeBranch(
    sourceBranch: string,
    targetBranch: string,
    options: ApprovalMergeOptions = {},
  ): Promise<ApprovalCommit> {
    const source = this.repository.branches.get(sourceBranch);
    const target = this.repository.branches.get(targetBranch);

    if (!source || !target) {
      throw new Error('Source or target branch does not exist');
    }

    // Create merge commit
    const mergeCommit = await this.createMergeCommit(source, target, options);

    // Update target branch
    target.head = mergeCommit.id;
    target.lastActivity = new Date();

    // Update merge request status if exists
    const mergeRequest = source.mergeRequests.find(
      (mr) => mr.targetBranch === targetBranch && mr.status === 'pending',
    );

    if (mergeRequest) {
      mergeRequest.status = 'merged';
      mergeRequest.updatedAt = new Date();
      mergeRequest.mergedAt = new Date();
    }

    this.emit('merge-completed', {
      sourceBranch,
      targetBranch,
      mergeCommit: mergeCommit.id,
    });

    return mergeCommit;
  }

  /**
   * Revert a commit
   */
  async revertCommit(
    commitId: string,
    options: ApprovalRevertOptions = {},
  ): Promise<ApprovalCommit> {
    const originalCommit = this.repository.commits.get(commitId);
    if (!originalCommit) {
      throw new Error(`Commit '${commitId}' not found`);
    }

    // Create revert approval data (opposite of original)
    const revertApprovalData: ApprovalResponse = {
      requestId: `revert-${originalCommit.approvalData.requestId}`,
      action: originalCommit.approvalData.approved ? 'reject' : 'approve',
      approved: !originalCommit.approvalData.approved,
      comments: `Revert "${originalCommit.metadata.message}"`,
      timestamp: new Date(),
      quickDecision: false,
    };

    const message = options.message || `Revert "${originalCommit.metadata.message}"`;

    if (options.noCommit) {
      // Just return the revert data without creating commit
      return ApprovalCommitManager.createCommit(
        revertApprovalData,
        [this.getCurrentBranch().head!],
        { name: 'MARIA User', email: 'user@maria.ai' },
        message,
      );
    }

    return this.createCommit(revertApprovalData, message);
  }

  /**
   * Create a tag
   */
  createTag(tagName: string, commitId?: string, options: ApprovalTagOptions = {}): void {
    if (this.repository.tags.has(tagName) && !options.force) {
      throw new Error(`Tag '${tagName}' already exists. Use force flag to overwrite.`);
    }

    const targetCommit = commitId || this.getCurrentBranch().head;
    if (!targetCommit) {
      throw new Error('No commit to tag');
    }

    if (!this.repository.commits.has(targetCommit)) {
      throw new Error(`Commit '${targetCommit}' does not exist`);
    }

    this.repository.tags.set(tagName, targetCommit);
    this.emit('tag-created', { name: tagName, commit: targetCommit });
  }

  /**
   * Get approval log
   */
  getLog(options: ApprovalLogOptions = {}): ApprovalCommit[] {
    let commits = Array.from(this.repository.commits.values());

    // Filter by branch if specified
    if (options.branch) {
      const branch = this.repository.branches.get(options.branch);
      if (branch) {
        const branchCommitIds = new Set(branch.approvalPath.map((c) => c.id));
        commits = commits.filter((c) => branchCommitIds.has(c.id));
      }
    }

    // Filter by author
    if (options.author) {
      commits = commits.filter((c) =>
        c.metadata.author.toLowerCase().includes(options.author!.toLowerCase()),
      );
    }

    // Filter by date range
    if (options.since) {
      commits = commits.filter((c) => c.metadata.timestamp >= options.since!);
    }
    if (options.until) {
      commits = commits.filter((c) => c.metadata.timestamp <= options.until!);
    }

    // Filter by message content
    if (options.grep) {
      const regex = new RegExp(options.grep, 'i');
      commits = commits.filter((c) => regex.test(c.metadata.message));
    }

    // Sort by timestamp (newest first)
    commits.sort(ApprovalCommitManager.compareCommits);

    // Apply limit
    if (options.limit && options.limit > 0) {
      commits = commits.slice(0, options.limit);
    }

    return commits;
  }

  /**
   * List branches
   */
  listBranches(options: ApprovalBranchOptions = {}): ApprovalBranch[] {
    let branches = Array.from(this.repository.branches.values());

    if (options.merged) {
      // Show only merged branches (simplified logic)
      branches = branches.filter(
        (branch) =>
          branch.name !== this.repository.defaultBranch && this.isBranchMerged(branch.name),
      );
    }

    return branches.sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
  }

  /**
   * Get repository statistics
   */
  getStatistics(): ApprovalStatistics {
    const commits = Array.from(this.repository.commits.values());
    const branches = Array.from(this.repository.branches.values());
    const mergeRequests = branches.flatMap((b) => b.mergeRequests);

    // Calculate activity metrics
    const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const lastMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const commitsLastWeek = commits.filter((c) => c.metadata.timestamp >= lastWeek).length;
    const commitsLastMonth = commits.filter((c) => c.metadata.timestamp >= lastMonth).length;

    // Calculate average approval time (simplified)
    const approvalTimes = mergeRequests
      .filter((mr) => mr.mergedAt)
      .map((mr) => mr.mergedAt!.getTime() - mr.createdAt.getTime());
    const avgTimeToApproval =
      approvalTimes.length > 0
        ? approvalTimes.reduce((a, b) => a + b, 0) / approvalTimes.length
        : 0;

    // Calculate contributor activity
    const contributorActivity: Record<string, number> = {};
    commits.forEach((commit) => {
      const author = commit.metadata.author;
      contributorActivity[author] = (contributorActivity[author] || 0) + 1;
    });

    const mostActiveContributor =
      Object.entries(contributorActivity).sort(([, a], [, b]) => b - a)[0]?.[0] || 'N/A';

    // Risk and category distribution
    const riskDistribution = commits.reduce(
      (acc, commit) => {
        const risk = commit.metadata.riskLevel;
        acc[risk] = (acc[risk] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const categoryDistribution = commits.reduce(
      (acc, commit) => {
        const category = commit.metadata.category;
        acc[category] = (acc[category] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const rejectionRate = commits.filter((c) => !c.approvalData.approved).length / commits.length;

    return {
      repository: {
        totalCommits: commits.length,
        totalBranches: branches.length,
        totalMergeRequests: mergeRequests.length,
        totalTags: this.repository.tags.size,
      },
      activity: {
        commitsLastWeek,
        commitsLastMonth,
        averageTimeToApproval: avgTimeToApproval,
        averageTimeToMerge: avgTimeToApproval, // Simplified
      },
      contributors: {
        totalContributors: Object.keys(contributorActivity).length,
        mostActiveContributor,
        contributorActivity,
      },
      risk: {
        riskDistribution: riskDistribution as Record<string, unknown>,
        categoryDistribution: categoryDistribution as Record<string, unknown>,
        rejectionRate,
      },
    };
  }

  /**
   * Get current branch
   */
  getCurrentBranch(): ApprovalBranch {
    const branchName = this.repository.config.branches.main;
    return this.repository.branches.get(branchName) || this.getMainBranch();
  }

  /**
   * Get main branch
   */
  getMainBranch(): ApprovalBranch {
    let mainBranch = this.repository.branches.get(this.repository.defaultBranch);

    if (!mainBranch) {
      // Create default main branch if it doesn't exist
      mainBranch = {
        name: this.repository.defaultBranch,
        head: '',
        baseCommit: '',
        approvalPath: [],
        mergeRequests: [],
        protected: true,
        createdAt: new Date(),
        lastActivity: new Date(),
      };
      this.repository.branches.set(this.repository.defaultBranch, mainBranch);
    }

    return mainBranch;
  }

  /**
   * Get repository configuration
   */
  getConfig(): ApprovalRepoConfig {
    return { ...this.repository.config };
  }

  /**
   * Update repository configuration
   */
  updateConfig(config: Partial<ApprovalRepoConfig>): void {
    this.repository.config = { ...this.repository.config, ...config };
  }

  /**
   * Export repository data
   */
  exportRepository(): ApprovalRepository {
    return JSON.parse(JSON.stringify(this.repository));
  }

  /**
   * Create default repository
   */
  private createDefaultRepository(): ApprovalRepository {
    const defaultBranch = 'main';

    return {
      id: uuidv4(),
      name: 'maria-approvals',
      branches: new Map(),
      commits: new Map(),
      tags: new Map(),
      remotes: [],
      config: this.getDefaultConfig(),
      defaultBranch,
      createdAt: new Date(),
      lastActivity: new Date(),
    };
  }

  /**
   * Get default repository configuration
   */
  private getDefaultConfig(): ApprovalRepoConfig {
    return {
      remote: {},
      branches: {
        main: 'main',
        protected: ['main', 'master'],
        autoMerge: false,
      },
      integration: {},
      policies: {
        branchProtection: {
          requireApproval: true,
          minimumApprovals: 1,
          requireCodeOwnerReview: false,
          dismissStaleReviews: false,
          restrictPushes: true,
        },
        mergeRequirements: {
          requireLinearHistory: false,
          allowMergeCommits: true,
          allowSquashMerge: true,
          allowRebaseMerge: true,
          deleteHeadBranches: false,
        },
        autoApproval: {
          enabled: true,
          conditions: [],
        },
      },
    };
  }

  /**
   * Create merge commit
   */
  private async createMergeCommit(
    source: ApprovalBranch,
    target: ApprovalBranch,
    options: ApprovalMergeOptions,
  ): Promise<ApprovalCommit> {
    const mergeMessage = options.message || `Merge branch '${source.name}' into '${target.name}'`;

    // Create merge approval data
    const mergeApprovalData: ApprovalResponse = {
      requestId: `merge-${uuidv4()}`,
      action: 'approve',
      approved: true,
      comments: mergeMessage,
      timestamp: new Date(),
      quickDecision: false,
    };

    const parentCommits = [target.head, source.head].filter(Boolean);

    const mergeCommit = ApprovalCommitManager.createCommit(
      mergeApprovalData,
      parentCommits,
      { name: 'MARIA User', email: 'user@maria.ai' },
      mergeMessage,
    );

    // Add to repository
    this.repository.commits.set(mergeCommit.id, mergeCommit);

    return mergeCommit;
  }

  /**
   * Get commits between two points
   */
  private getCommitsBetween(base: string, head: string): string[] {
    if (!base || !head) {return [];}

    const commits: string[] = [];
    const visited = new Set<string>();
    const queue = [head];

    while (queue.length > 0) {
      const commitId = queue.shift()!;
      if (visited.has(commitId) || commitId === base) {continue;}

      visited.add(commitId);
      commits.push(commitId);

      const commit = this.repository.commits.get(commitId);
      if (commit) {
        queue.push(...commit.parentCommits);
      }
    }

    return commits.reverse(); // Return in chronological order
  }

  /**
   * Check if branch has unmerged changes
   */
  private hasUnmergedChanges(branchName: string): boolean {
    const branch = this.repository.branches.get(branchName);
    const mainBranch = this.getMainBranch();

    if (!branch || !mainBranch.head) {return false;}

    // Simplified check - in reality would do proper merge-base analysis
    return branch.head !== mainBranch.head && !this.isCommitInBranch(branch.head, mainBranch.name);
  }

  /**
   * Check if branch is merged
   */
  private isBranchMerged(branchName: string): boolean {
    const branch = this.repository.branches.get(branchName);
    const mainBranch = this.getMainBranch();

    if (!branch || !mainBranch.head) {return false;}

    return this.isCommitInBranch(branch.head, mainBranch.name);
  }

  /**
   * Check if commit is in branch
   */
  private isCommitInBranch(commitId: string, branchName: string): boolean {
    const branch = this.repository.branches.get(branchName);
    if (!branch) {return false;}

    return branch.approvalPath.some((commit) => commit.id === commitId);
  }
}
