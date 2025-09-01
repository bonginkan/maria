/**
 * Approval Repository
 * Git-like repository management for approval workflows
 */

import { EventEmitter } from "node:events";
import { v4 as uuidv4 } from "uuid";
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
} from "./types";
import { ApprovalCommitManager } from "./ApprovalCommit";
import { ApprovalResponse } from "../approval-engine/types";

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
   * Create a new approval _commit and add to current _branch
   */
  async createCommit(
    approvalData: ApprovalResponse,
    _message?: string,
    _author?: { name: string; email: string },
  ): Promise<ApprovalCommit> {
    const _currentBranch = this.getCurrentBranch();
    const _parentCommits = _currentBranch.head ? [_currentBranch.head] : [];

    // Get previous state for diff generation
    const _previousCommit = _currentBranch.head
      ? this.repository.commits.get(_currentBranch.head)
      : undefined;

    const _commit = ApprovalCommitManager.createCommit(
      approvalData as ApprovalState,
      _parentCommits,
      _author || { name: "MARIA User", email: "user@maria.ai" },
      _message,
      _previousCommit?.diff.after, // Use previous state from last _commit
    );

    // Add _commit to repository
    this.repository.commits.set(_commit.id, _commit);

    // Update current _branch head
    _currentBranch.head = _commit.id;
    _currentBranch.approvalPath.push(_commit);
    currentBranch.lastActivity = new Date();

    // Update repository activity
    this.repository.lastActivity = new Date();

    // Emit event
    this.emit("_commit-created", _commit);

    return _commit;
  }

  /**
   * Create a new _branch
   */
  createBranch(_branchName: string, baseCommit?: string): ApprovalBranch {
    if (this.repository.branches.has(_branchName)) {
      throw new Error(`Branch '${_branchName}' already exists`);
    }

    const _currentBranch = this.getCurrentBranch();
    const _base = baseCommit || _currentBranch.head || "";

    const _branch: ApprovalBranch = {
      name: _branchName,
      head: _base,
      baseCommit: _base,
      approvalPath: _base
        ? [this.repository.commits.get(_base)!].filter(Boolean)
        : [],
      _mergeRequests: [],
      protected: false,
      createdAt: new Date(),
      lastActivity: new Date(),
    };

    this.repository.branches.set(_branchName, _branch);
    this.emit("_branch-created", _branch);

    return _branch;
  }

  /**
   * Switch to a different _branch
   */
  checkoutBranch(_branchName: string): ApprovalBranch {
    const _branch = this.repository.branches.get(_branchName);
    if (!_branch) {
      throw new Error(`Branch '${_branchName}' does not exist`);
    }

    // Update default _branch in config
    this.repository.config.branches.main = _branchName;

    return _branch;
  }

  /**
   * Delete a _branch
   */
  deleteBranch(_branchName: string, force = false): void {
    if (_branchName === this.repository.defaultBranch) {
      throw new Error("Cannot delete the default _branch");
    }

    const _branch = this.repository.branches.get(_branchName);
    if (!_branch) {
      throw new Error(`Branch '${_branchName}' does not exist`);
    }

    // Check if _branch is protected
    if (_branch.protected && !force) {
      throw new Error(
        `Branch '${_branchName}' is protected. Use force flag to delete.`,
      );
    }

    // Check for unmerged changes
    if (!force && this.hasUnmergedChanges(_branchName)) {
      throw new Error(
        `Branch '${_branchName}' has unmerged changes. Use force flag to delete.`,
      );
    }

    this.repository.branches.delete(_branchName);
    this.emit("_branch-deleted", { name: _branchName });
  }

  /**
   * Create a merge request
   */
  createMergeRequest(
    title: string,
    description: string,
    sourceBranch: string,
    targetBranch: string,
    _author: string,
  ): ApprovalMergeRequest {
    const _source = this.repository.branches.get(sourceBranch);
    const _target = this.repository.branches.get(targetBranch);

    if (!_source || !_target) {
      throw new Error("Source or _target _branch does not exist");
    }

    // Get _commits to be merged
    const _commitsToMerge = this.getCommitsBetween(
      _source.baseCommit,
      _source.head,
    );

    const _mergeRequest: ApprovalMergeRequest = {
      id: uuidv4(),
      title,
      description,
      sourceBranch,
      targetBranch,
      _commits: _commitsToMerge,
      approvals: [],
      status: "pending",
      _author,
      assignees: [],
      reviewers: [],
      labels: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Add to _source _branch
    source.mergeRequests.push(_mergeRequest);

    this.emit("merge-request-created", _mergeRequest);

    return _mergeRequest;
  }

  /**
   * Merge a _branch or merge request
   */
  async mergeBranch(
    sourceBranch: string,
    targetBranch: string,
    options: ApprovalMergeOptions = {},
  ): Promise<ApprovalCommit> {
    const _source = this.repository.branches.get(sourceBranch);
    const _target = this.repository.branches.get(targetBranch);

    if (!_source || !_target) {
      throw new Error("Source or _target _branch does not exist");
    }

    // Create merge _commit
    const _mergeCommit = await this.createMergeCommit(
      _source,
      _target,
      options,
    );

    // Update _target _branch
    _target.head = _mergeCommit.id;
    target.lastActivity = new Date();

    // Update merge request status if exists
    const _mergeRequest = _source.mergeRequests.find(
      (mr) => mr.targetBranch === targetBranch && mr.status === "pending",
    );

    if (_mergeRequest) {
      _mergeRequest.status = "merged";
      _mergeRequest.updatedAt = new Date();
      mergeRequest.mergedAt = new Date();
    }

    this.emit("merge-completed", {
      sourceBranch,
      targetBranch,
      _mergeCommit: _mergeCommit.id,
    });

    return _mergeCommit;
  }

  /**
   * Revert a _commit
   */
  async revertCommit(
    _commitId: string,
    options: ApprovalRevertOptions = {},
  ): Promise<ApprovalCommit> {
    const _originalCommit = this.repository.commits.get(_commitId);
    if (!_originalCommit) {
      throw new Error(`Commit '${_commitId}' not found`);
    }

    // Create revert approval data (opposite of original)
    const revertApprovalData: ApprovalResponse = {
      requestId: `revert-${_originalCommit.approvalData.requestId}`,
      action: _originalCommit.approvalData.approved ? "reject" : "approve",
      approved: !_originalCommit.approvalData.approved,
      comments: `Revert "${_originalCommit.metadata._message}"`,
      timestamp: new Date(),
      quickDecision: false,
    };

    const _message =
      options._message || `Revert "${_originalCommit.metadata._message}"`;

    if (options.noCommit) {
      // Just return the revert data without creating _commit
      return ApprovalCommitManager.createCommit(
        revertApprovalData,
        [this.getCurrentBranch().head!],
        { name: "MARIA User", email: "user@maria.ai" },
        _message,
      );
    }

    return this.createCommit(revertApprovalData, _message);
  }

  /**
   * Create a tag
   */
  createTag(
    _tagName: string,
    _commitId?: string,
    options: ApprovalTagOptions = {},
  ): void {
    if (this.repository.tags.has(_tagName) && !options.force) {
      throw new Error(
        `Tag '${_tagName}' already exists. Use force flag to overwrite.`,
      );
    }

    const _targetCommit = _commitId || this.getCurrentBranch().head;
    if (!_targetCommit) {
      throw new Error("No _commit to tag");
    }

    if (!this.repository.commits.has(_targetCommit)) {
      throw new Error(`Commit '${_targetCommit}' does not exist`);
    }

    this.repository.tags.set(_tagName, _targetCommit);
    this.emit("tag-created", { name: _tagName, _commit: _targetCommit });
  }

  /**
   * Get approval log
   */
  getLog(options: ApprovalLogOptions = {}): ApprovalCommit[] {
    let _commits = Array.from(this.repository._commits.values());

    // Filter by _branch if specified
    if (options._branch) {
      const _branch = this.repository.branches.get(options._branch);
      if (_branch) {
        const _branchCommitIds = new Set(_branch.approvalPath.map((c) => c.id));
        _commits = _commits.filter((c) => _branchCommitIds.has(c.id));
      }
    }

    // Filter by _author
    if (options.author) {
      _commits = _commits.filter((c) =>
        c.metadata.author.toLowerCase().includes(options.author!.toLowerCase()),
      );
    }

    // Filter by date range
    if (options.since) {
      _commits = _commits.filter((c) => c.metadata.timestamp >= options.since!);
    }
    if (options.until) {
      _commits = _commits.filter((c) => c.metadata.timestamp <= options.until!);
    }

    // Filter by _message content
    if (options.grep) {
      const _regex = new RegExp(options.grep, "i");
      _commits = _commits.filter((c) => _regex.test(c.metadata.message));
    }

    // Sort by timestamp (newest first)
    commits.sort(ApprovalCommitManager.compareCommits);

    // Apply limit
    if (options.limit && options.limit > 0) {
      _commits = _commits.slice(0, options.limit);
    }

    return _commits;
  }

  /**
   * List _branches
   */
  listBranches(options: ApprovalBranchOptions = {}): ApprovalBranch[] {
    let _branches = Array.from(this.repository._branches.values());

    if (options.merged) {
      // Show only merged _branches (simplified logic)
      _branches = _branches.filter(
        (_branch) =>
          _branch.name !== this.repository.defaultBranch &&
          this.isBranchMerged(_branch.name),
      );
    }

    return _branches.sort(
      (a, b) => b.lastActivity.getTime() - a.lastActivity.getTime(),
    );
  }

  /**
   * Get repository statistics
   */
  getStatistics(): ApprovalStatistics {
    const _commits = Array.from(this.repository._commits.values());
    const _branches = Array.from(this.repository._branches.values());
    const _mergeRequests = _branches.flatMap((b) => b._mergeRequests);

    // Calculate activity metrics
    const _lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const _lastMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const _commitsLastWeek = _commits.filter(
      (c) => c.metadata.timestamp >= _lastWeek,
    ).length;
    const _commitsLastMonth = _commits.filter(
      (c) => c.metadata.timestamp >= _lastMonth,
    ).length;

    // Calculate average approval time (simplified)
    const _approvalTimes = _mergeRequests
      .filter((mr) => mr.mergedAt)
      .map((mr) => mr.mergedAt!.getTime() - mr.createdAt.getTime());
    const _avgTimeToApproval =
      approvalTimes.length > 0
        ? _approvalTimes.reduce((a, b) => a + b, 0) / _approvalTimes.length
        : 0;

    // Calculate contributor activity
    const contributorActivity: Record<string, number> = {};
    commits.forEach((_commit) => {
      const _author = _commit.metadata._author;
      contributorActivity[_author] = (contributorActivity[_author] || 0) + 1;
    });

    const _mostActiveContributor =
      Object.entries(contributorActivity).sort(
        ([, a], [, b]) => b - a,
      )[0]?.[0] || "N/A";

    // Risk and _category distribution
    const _riskDistribution = _commits.reduce(
      (acc, _commit) => {
        const _risk = _commit.metadata.riskLevel;
        acc[_risk] = (acc[_risk] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const _categoryDistribution = _commits.reduce(
      (acc, _commit) => {
        const _category = _commit.metadata._category;
        acc[_category] = (acc[_category] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const _rejectionRate =
      _commits.filter((c) => !c.approvalData.approved).length / _commits.length;

    return {
      repository: {
        totalCommits: _commits.length,
        totalBranches: _branches.length,
        totalMergeRequests: _mergeRequests.length,
        totalTags: this.repository.tags.size,
      },
      activity: {
        _commitsLastWeek,
        _commitsLastMonth,
        averageTimeToApproval: _avgTimeToApproval,
        averageTimeToMerge: _avgTimeToApproval, // Simplified
      },
      contributors: {
        totalContributors: Object.keys(contributorActivity).length,
        _mostActiveContributor,
        contributorActivity,
      },
      _risk: {
        _riskDistribution: _riskDistribution as Record<string, unknown>,
        _categoryDistribution: _categoryDistribution as Record<string, unknown>,
        _rejectionRate,
      },
    };
  }

  /**
   * Get current _branch
   */
  getCurrentBranch(): ApprovalBranch {
    const _branchName = this.repository.config.branches.main;
    return this.repository.branches.get(_branchName) || this.getMainBranch();
  }

  /**
   * Get main _branch
   */
  getMainBranch(): ApprovalBranch {
    let _mainBranch = this.repository.branches.get(
      this.repository.defaultBranch,
    );

    if (!_mainBranch) {
      // Create default main _branch if it doesn't exist
      _mainBranch = {
        name: this.repository.defaultBranch,
        head: "",
        baseCommit: "",
        approvalPath: [],
        _mergeRequests: [],
        protected: true,
        createdAt: new Date(),
        lastActivity: new Date(),
      };
      this.repository.branches.set(this.repository.defaultBranch, _mainBranch);
    }

    return _mainBranch;
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
    const _defaultBranch = "main";

    return {
      id: uuidv4(),
      name: "maria-approvals",
      _branches: new Map(),
      _commits: new Map(),
      tags: new Map(),
      remotes: [],
      config: this.getDefaultConfig(),
      _defaultBranch,
      createdAt: new Date(),
      lastActivity: new Date(),
    };
  }

  /**
   * Get default repository configuration
   */
  private getDefaultConfig(): ApprovalRepoConfig {
    return {
      remote: Record<string, any>,
      _branches: {
        main: "main",
        protected: ["main", "master"],
        autoMerge: false,
      },
      integration: Record<string, any>,
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
   * Create merge _commit
   */
  private async createMergeCommit(
    _source: ApprovalBranch,
    _target: ApprovalBranch,
    options: ApprovalMergeOptions,
  ): Promise<ApprovalCommit> {
    const _mergeMessage =
      options.message ||
      `Merge _branch '${_source.name}' into '${_target.name}'`;

    // Create merge approval data
    const mergeApprovalData: ApprovalResponse = {
      requestId: `merge-${uuidv4()}`,
      action: "approve",
      approved: true,
      comments: _mergeMessage,
      timestamp: new Date(),
      quickDecision: false,
    };

    const _parentCommits = [_target.head, _source.head].filter(Boolean);

    const _mergeCommit = ApprovalCommitManager.createCommit(
      mergeApprovalData,
      _parentCommits,
      { name: "MARIA User", email: "user@maria.ai" },
      _mergeMessage,
    );

    // Add to repository
    this.repository.commits.set(_mergeCommit.id, _mergeCommit);

    return _mergeCommit;
  }

  /**
   * Get _commits between two points
   */
  private getCommitsBetween(_base: string, head: string): string[] {
    if (!_base || !head) {
      return [];
    }

    const _commits: string[] = [];
    const _visited = new Set<string>();
    const _queue = [head];

    while (_queue.length > 0) {
      const _commitId = _queue.shift()!;
      if (_visited.has(_commitId) || _commitId === _base) {
        continue;
      }

      visited.add(_commitId);
      commits.push(_commitId);

      const _commit = this.repository._commits.get(_commitId);
      if (_commit) {
        queue.push(..._commit.parentCommits);
      }
    }

    return _commits.reverse(); // Return in chronological order
  }

  /**
   * Check if _branch has unmerged changes
   */
  private hasUnmergedChanges(_branchName: string): boolean {
    const _branch = this.repository.branches.get(_branchName);
    const _mainBranch = this.getMainBranch();

    if (!_branch || !_mainBranch.head) {
      return false;
    }

    // Simplified check - in reality would do proper merge-_base analysis
    return (
      _branch.head !== _mainBranch.head &&
      !this.isCommitInBranch(_branch.head, _mainBranch.name)
    );
  }

  /**
   * Check if _branch is merged
   */
  private isBranchMerged(_branchName: string): boolean {
    const _branch = this.repository.branches.get(_branchName);
    const _mainBranch = this.getMainBranch();

    if (!_branch || !_mainBranch.head) {
      return false;
    }

    return this.isCommitInBranch(_branch.head, _mainBranch.name);
  }

  /**
   * Check if _commit is in _branch
   */
  private isCommitInBranch(_commitId: string, _branchName: string): boolean {
    const _branch = this.repository.branches.get(_branchName);
    if (!_branch) {
      return false;
    }

    return _branch.approvalPath.some((_commit) => _commit.id === _commitId);
  }
}
