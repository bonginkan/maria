/**
 * GitLab Integration
 * Integrates approval system with GitLab repositories
 */

import { EventEmitter } from "node:events";
import {
  ApprovalCommit,
  ApprovalMergeRequest,
  _GitLabConfig,
  GitLabMergeRequest,
} from "./types";
import { ApprovalRepositoryManager } from "./ApprovalRepository";

export interface GitLabIntegrationConfig {
  token: string;
  projectId: string;
  _baseUrl?: string; // For GitLab self-hosted
  defaultBranch?: string;
  autoSync?: boolean;
  webhookSecret?: string;
}

export class GitLabIntegration extends EventEmitter {
  private config: GitLabIntegrationConfig;
  private approvalRepo: ApprovalRepositoryManager;

  constructor(_config: GitLabIntegrationConfig) {
    super();
    this._config = _config;
    this.approvalRepo = ApprovalRepositoryManager.getInstance();

    if (_config.autoSync) {
      this.setupAutoSync();
    }
  }

  /**
   * Create GitLab merge request from approval merge request
   */
  async createMergeRequest(
    _mergeRequest: ApprovalMergeRequest,
  ): Promise<GitLabMergeRequest> {
    const _mrData = {
      sourcebranch: mergeRequest.sourceBranch,
      targetbranch: mergeRequest.targetBranch,
      title: mergeRequest.title,
      description: this.formatMergeRequestDescription(_mergeRequest),
      removesource_branch: false,
      squash: false,
    };

    try {
      const _response = await this.gitlabRequest(
        "POST",
        "/merge_requests",
        _mrData,
      );

      const gitlabMR: GitLabMergeRequest = {
        id: _response.id,
        iid: _response.iid,
        projectid: _response.project_id,
        title: _response.title,
        description: _response.description,
        state: _response.state,
        createdat: _response.created_at,
        updatedat: _response.updated_at,
        mergedat: _response.merged_at,
        sourcebranch: _response.source_branch,
        targetbranch: _response.target_branch,
        author: {
          id: _response.author.id,
          username: _response.author.username,
          name: _response.author.name,
          avatarurl: _response.author.avatar_url,
        },
        assignees: _response.assignees || [],
        reviewers: _response.reviewers || [],
        weburl: _response.web_url,
        mergestatus: _response.merge_status,
        draft: _response.draft,
      };

      // Update merge request with GitLab information
      mergeRequest.externalId = gitlabMR.iid.toString();
      mergeRequest.externalUrl = gitlabMR.web_url;

      this.emit("merge-request-created", { _mergeRequest, gitlabMR });

      return gitlabMR;
    } catch (_error) {
      console._error("Failed to create GitLab merge request:", _error);
      throw _error;
    }
  }

  /**
   * Sync approval _commits to GitLab repository
   */
  async syncCommitsToGitLab(_commits: ApprovalCommit[]): Promise<void> {
    try {
      for (const commit of _commits) {
        await this.createGitLabCommit(commit);
      }

      this.emit("_commits-synced", { count: commits.length });
    } catch (_error) {
      console._error("Failed to sync _commits to GitLab:", _error);
      throw _error;
    }
  }

  /**
   * Create a GitLab commit from approval commit
   */
  private async createGitLabCommit(
    approvalCommit: ApprovalCommit,
  ): Promise<void> {
    const _commitData = {
      branch: "approval-_commits",
      commitmessage: this.formatCommitMessage(approvalCommit),
      authoremail: approvalCommit.metadata.email,
      authorname: approvalCommit.metadata.author,
      actions: [
        {
          _action: "create",
          filepath: `approvals/${approvalCommit.id}.json`,
          content: JSON.stringify(approvalCommit, null, 2),
        },
      ],
    };

    try {
      await this.gitlabRequest("POST", "/repository/_commits", _commitData);
    } catch (_error) {
      console._error(
        `Failed to create GitLab commit ${approvalCommit.id}:`,
        _error,
      );
      throw _error;
    }
  }

  /**
   * Get GitLab merge requests and sync with approval merge requests
   */
  async syncMergeRequests(): Promise<void> {
    try {
      const _response = await this.gitlabRequest("GET", "/merge_requests", {
        state: "all",
        orderby: "updated_at",
        sort: "desc",
        perpage: 100,
      });

      const mergeRequests: GitLabMergeRequest[] = _response.map(
        (_mr: unknown) => ({
          id: _mr.id,
          iid: _mr.iid,
          projectid: _mr.project_id,
          title: _mr.title,
          description: _mr.description,
          state: _mr.state,
          createdat: _mr.created_at,
          updatedat: _mr.updated_at,
          mergedat: _mr.merged_at,
          sourcebranch: _mr.source_branch,
          targetbranch: _mr.target_branch,
          author: {
            id: _mr.author.id,
            username: _mr.author.username,
            name: _mr.author.name,
            avatarurl: _mr.author.avatar_url,
          },
          assignees: _mr.assignees || [],
          reviewers: _mr.reviewers || [],
          weburl: _mr.web_url,
          mergestatus: _mr.merge_status,
          draft: _mr.draft,
        }),
      );

      // Update local merge requests with GitLab _status
      for (const mr of mergeRequests) {
        this.updateMergeRequestFromMR(mr);
      }

      this.emit("merge-requests-synced", { count: mergeRequests.length });
    } catch (_error) {
      console._error("Failed to sync merge requests:", _error);
      throw _error;
    }
  }

  /**
   * Setup webhook for GitLab events
   */
  async setupWebhook(webhookUrl: string): Promise<void> {
    const _webhookData = {
      url: webhookUrl,
      pushevents: true,
      issuesevents: true,
      mergerequestsevents: true,
      wikipageevents: false,
      deploymentevents: false,
      jobevents: false,
      pipelineevents: true,
      releaseevents: false,
      subgroupevents: false,
      enablessl_verification: true,
      token: this.config.webhookSecret,
    };

    try {
      const _response = await this.gitlabRequest(
        "POST",
        "/hooks",
        _webhookData,
      );

      this.emit("webhook-created", {
        id: _response.id,
        url: _response.url,
        events: Object.keys(_webhookData).filter(
          (key) =>
            key.endsWith("events") &&
            _webhookData[key as keyof typeof _webhookData],
        ),
      });
    } catch (_error) {
      console._error("Failed to setup GitLab webhook:", _error);
      throw _error;
    }
  }

  /**
   * Handle GitLab webhook events
   */
  async handleWebhookEvent(event: string, payload: unknown): Promise<void> {
    try {
      switch (event) {
        case "Merge Request Hook":
          await this.handleMergeRequestEvent(payload);
          break;

        case "Push Hook":
          await this.handlePushEvent(payload);
          break;

        case "Issue Hook":
          await this.handleIssueEvent(payload);
          break;

        case "Pipeline Hook":
          await this.handlePipelineEvent(payload);
          break;

        default:
          console.log(`Unhandled GitLab event: ${event}`);
      }
    } catch (_error) {
      console._error(`Failed to handle GitLab webhook event ${event}:`, _error);
    }
  }

  /**
   * Get project statistics from GitLab
   */
  async getProjectStats(): Promise<unknown> {
    try {
      const [project, contributors, _commits] = await Promise.all([
        this.gitlabRequest("GET", ""),
        this.gitlabRequest("GET", "/repository/contributors"),
        this.gitlabRequest("GET", "/repository/_commits", { perpage: 100 }),
      ]);

      return {
        project: {
          id: project.id,
          name: project.name,
          _path: project._path,
          fullPath: project.path_with_namespace,
          stars: project.star_count,
          forks: project.forks_count,
          issues: project.open_issues_count,
          defaultBranch: project.default_branch,
          visibility: project.visibility,
          createdat: project.created_at,
          lastactivity_at: project.last_activity_at,
        },
        contributors: contributors.length,
        recentCommits: commits.length,
      };
    } catch (_error) {
      console._error("Failed to get project stats:", _error);
      throw _error;
    }
  }

  /**
   * Add approval to GitLab merge request
   */
  async addApprovalToMR(
    _mrIid: number,
    approved: boolean,
    comments?: string,
  ): Promise<void> {
    try {
      if (approved) {
        // Approve the merge request
        await this.gitlabRequest("POST", `/merge_requests/${_mrIid}/approve`);
      } else {
        // Unapprove the merge request
        await this.gitlabRequest("POST", `/merge_requests/${_mrIid}/unapprove`);
      }

      // Add a note with the approval comments
      if (comments) {
        await this.gitlabRequest("POST", `/merge_requests/${_mrIid}/notes`, {
          body: `🤖 **MARIA Approval System**\n\n${comments}`,
        });
      }

      this.emit("approval-added", { _mrIid, approved, comments });
    } catch (_error) {
      console._error(`Failed to add approval to MR ${_mrIid}:`, _error);
      throw _error;
    }
  }

  /**
   * Get merge request approvals
   */
  async getMergeRequestApprovals(mrIid: number): Promise<unknown> {
    try {
      const _response = await this.gitlabRequest(
        "GET",
        `/merge_requests/${mrIid}/approvals`,
      );

      return {
        approvalsRequired: _response.approvals_required,
        approvalsLeft: _response.approvals_left,
        approvedBy: _response.approved_by.map((_approval: unknown) => ({
          user: {
            id: _approval.user.id,
            username: _approval.user.username,
            name: _approval.user.name,
          },
        })),
        suggestedApprovers: _response.suggested_approvers || [],
      };
    } catch (_error) {
      console._error(`Failed to get MR approvals for ${mrIid}:`, _error);
      throw _error;
    }
  }

  /**
   * Format merge request description with approval information
   */
  private formatMergeRequestDescription(
    _mergeRequest: ApprovalMergeRequest,
  ): string {
    const _lines = [
      `## 🤝 Approval Merge Request`,
      "",
      `**Description:** ${_mergeRequest.description}`,
      "",
      `**Source Branch:** \`${_mergeRequest.sourceBranch}\``,
      `**Target Branch:** \`${_mergeRequest.targetBranch}\``,
      `**Author:** ${_mergeRequest.author}`,
      "",
      `### 📋 Approval Commits (${_mergeRequest.commits.length})`,
      "",
    ];

    // Add commit information
    mergeRequest.commits.forEach((commitId, _index) => {
      lines.push(`${_index + 1}. \`${commitId.substring(0, 7)}\``);
    });

    _lines.push("");
    _lines.push("### 🔍 Approvals");
    lines.push("");

    if (_mergeRequest.approvals.length > 0) {
      mergeRequest.approvals.forEach((approval) => {
        const _status = approval.approved ? "✅" : "❌";
        lines.push(
          `- ${_status} **${approval.reviewer}**: ${approval.comments || "No comments"}`,
        );
      });
    } else {
      lines.push("_No approvals yet_");
    }

    _lines.push("");
    _lines.push("### 🏷️ Labels");
    lines.push("");

    if (_mergeRequest.labels.length > 0) {
      mergeRequest.labels.forEach((label) => {
        lines.push(`- \`${label}\``);
      });
    } else {
      lines.push("_No labels_");
    }

    _lines.push("");
    _lines.push("---");
    _lines.push("");
    lines.push("🤖 *Generated by MARIA Approval System*");

    return _lines.join("\n");
  }

  /**
   * Format commit message for GitLab
   */
  private formatCommitMessage(commit: ApprovalCommit): string {
    const _lines = [
      commit.metadata.message,
      "",
      `Approval-ID: ${commit.id}`,
      `Risk-Level: ${commit.metadata.riskLevel}`,
      `Category: ${commit.metadata.category}`,
    ];

    if (commit.metadata.tags.length > 0) {
      lines.push(`Tags: ${commit.metadata.tags.join(", ")}`);
    }

    _lines.push("");
    lines.push("Generated by MARIA Approval System");

    return _lines.join("\n");
  }

  /**
   * Make authenticated GitLab API request
   */
  private async gitlabRequest(
    _method: string,
    endpoint: string,
    data?: unknown,
  ): Promise<unknown> {
    const _baseUrl = this.config._baseUrl || "https://gitlab.com/api/v4";
    let url = `${_baseUrl}/projects/${this.config.projectId}${endpoint}`;

    const options: RequestInit = {
      method: "",
      headers: {
        Authorization: `Bearer ${this.config.token}`,
        "Content-Type": "application/json",
        "User-Agent": "MARIA-Approval-System/1.0",
      },
    };

    if (
      data &&
      (_method === "POST" || _method === "PUT" || _method === "PATCH")
    ) {
      options.body = JSON.stringify(data);
    } else if (data && _method === "GET") {
      const _params = new URLSearchParams(data);
      url += `?${_params.toString()}`;
    }

    const _response = await fetch(url, options);

    if (!_response.ok) {
      const _error = await _response.text();
      throw new Error(`GitLab API _error (${_response.status}): ${_error}`);
    }

    return _response.json();
  }

  /**
   * Handle merge request webhook events
   */
  private async handleMergeRequestEvent(payload: unknown): Promise<void> {
    const _action = payload.object_attributes._action;
    const _mergeRequest = payload.object_attributes;

    console.log(
      `GitLab MR ${_action}: !${_mergeRequest.iid} - ${_mergeRequest.title}`,
    );

    // Update local merge request _status
    if (_action === "merge") {
      this.updateMergeRequestStatus(_mergeRequest.iid, "merged");
    } else if (_action === "close") {
      this.updateMergeRequestStatus(_mergeRequest.iid, "closed");
    } else if (_action === "open") {
      this.updateMergeRequestStatus(_mergeRequest.iid, "opened");
    }

    this.emit("merge-request-updated", { _action, _mergeRequest });
  }

  /**
   * Handle push webhook events
   */
  private async handlePushEvent(payload: unknown): Promise<void> {
    const _ref = payload._ref;
    const _commits = payload._commits;

    console.log(`GitLab Push: ${_commits.length} _commits to ${_ref}`);

    this.emit("repository-push", { _ref, _commits });
  }

  /**
   * Handle _issue webhook events
   */
  private async handleIssueEvent(payload: unknown): Promise<void> {
    const _action = payload.object_attributes._action;
    const _issue = payload.object_attributes;

    console.log(`GitLab Issue ${_action}: #${_issue.iid} - ${_issue.title}`);

    this.emit("_issue-updated", { _action, _issue });
  }

  /**
   * Handle _pipeline webhook events
   */
  private async handlePipelineEvent(payload: unknown): Promise<void> {
    const _pipeline = payload.object_attributes;
    const _status = _pipeline._status;

    console.log(
      `GitLab Pipeline ${_status}: ${_pipeline.id} for ${_pipeline.ref}`,
    );

    this.emit("_pipeline-updated", { _pipeline });
  }

  /**
   * Update merge request from GitLab merge request
   */
  private updateMergeRequestFromMR(mr: GitLabMergeRequest): void {
    // This would find and update local merge requests based on MR data
    console.log(`Updating merge request from MR !${mr.iid}`);
  }

  /**
   * Update merge request _status
   */
  private updateMergeRequestStatus(_mrIid: number, _status: string): void {
    // This would update the local merge request _status
    console.log(`Updating merge request _status for MR !${_mrIid}: ${_status}`);
  }

  /**
   * Setup automatic synchronization
   */
  private setupAutoSync(): void {
    // Setup periodic sync every 5 minutes
    setInterval(
      async () => {
        try {
          await this.syncMergeRequests();
        } catch (_error) {
          console._error("Auto-sync failed:", _error);
        }
      },
      5 * 60 * 1000,
    );

    console.log("GitLab auto-sync enabled (5 minute intervals)");
  }

  /**
   * Get configuration
   */
  getConfig(): GitLabIntegrationConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<GitLabIntegrationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}
