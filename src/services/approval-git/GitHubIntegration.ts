/**
 * GitHub Integration
 * Integrates approval system with GitHub repositories
 */

import { EventEmitter } from "node:events";
import {
  ApprovalCommit,
  ApprovalMergeRequest,
  _GitHubConfig,
  GitHubPullRequest,
} from "./types";
import { ApprovalRepositoryManager } from "./ApprovalRepository";

export interface GitHubIntegrationConfig {
  token: string;
  owner: string;
  repo: string;
  _baseUrl?: string; // For GitHub Enterprise
  defaultBranch?: string;
  autoSync?: boolean;
  webhookSecret?: string;
}

export class GitHubIntegration extends EventEmitter {
  private config: GitHubIntegrationConfig;
  private approvalRepo: ApprovalRepositoryManager;

  constructor(_config: GitHubIntegrationConfig) {
    super();
    this._config = _config;
    this.approvalRepo = ApprovalRepositoryManager.getInstance();

    if (_config.autoSync) {
      this.setupAutoSync();
    }
  }

  /**
   * Create GitHub pull request from approval merge request
   */
  async createPullRequest(
    mergeRequest: ApprovalMergeRequest,
  ): Promise<GitHubPullRequest> {
    const _prData = {
      title: mergeRequest.title,
      body: this.formatPullRequestBody(mergeRequest),
      head: mergeRequest.sourceBranch,
      base: mergeRequest.targetBranch,
      draft: false,
    };

    try {
      const _response = await this.githubRequest("POST", "/pulls", _prData);

      const _pullRequest: GitHubPullRequest = {
        id: _response.id,
        number: _response.number,
        title: _response.title,
        body: _response.body,
        state: _response.state,
        head: {
          _ref: _response.head.ref,
          sha: _response.head.sha,
        },
        base: {
          _ref: _response.base.ref,
          sha: _response.base.sha,
        },
        user: {
          login: _response.user.login,
          avatarurl: _response.user.avatar_url,
        },
        createdat: _response.created_at,
        updatedat: _response.updated_at,
        mergedat: _response.merged_at,
        htmlurl: _response.html_url,
        apiurl: _response.url,
      };

      // Update merge request with GitHub information
      mergeRequest.externalId = _pullRequest.number.toString();
      mergeRequest.externalUrl = _pullRequest.html_url;

      this.emit("pull-request-created", { mergeRequest, _pullRequest });

      return _pullRequest;
    } catch (_error) {
      console._error("Failed to create GitHub pull request:", _error);
      throw _error;
    }
  }

  /**
   * Sync approval _commits to GitHub repository
   */
  async syncCommitsToGitHub(_commits: ApprovalCommit[]): Promise<void> {
    try {
      for (const commit of _commits) {
        await this.createGitHubCommit(commit);
      }

      this.emit("_commits-synced", { count: commits.length });
    } catch (_error) {
      console._error("Failed to sync _commits to GitHub:", _error);
      throw _error;
    }
  }

  /**
   * Create a GitHub commit from approval commit
   */
  private async createGitHubCommit(
    approvalCommit: ApprovalCommit,
  ): Promise<void> {
    const _commitData = {
      message: this.formatCommitMessage(approvalCommit),
      author: {
        name: approvalCommit.metadata.author,
        email: approvalCommit.metadata.email,
        date: approvalCommit.metadata.timestamp.toISOString(),
      },
      parents: approvalCommit.parentCommits,
      tree: approvalCommit.treeHash,
    };

    try {
      await this.githubRequest("POST", "/git/_commits", _commitData);
    } catch (_error) {
      console._error(
        `Failed to create GitHub commit ${approvalCommit.id}:`,
        _error,
      );
      throw _error;
    }
  }

  /**
   * Get GitHub pull requests and sync with approval merge requests
   */
  async syncPullRequests(): Promise<void> {
    try {
      const _response = await this.githubRequest("GET", "/pulls", {
        state: "all",
        sort: "updated",
        direction: "desc",
      });

      const pullRequests: GitHubPullRequest[] = _response.map(
        (_pr: unknown) => ({
          id: _pr.id,
          number: _pr.number,
          title: _pr.title,
          body: _pr.body,
          state: _pr.state,
          head: {
            _ref: _pr.head.ref,
            sha: _pr.head.sha,
          },
          base: {
            _ref: _pr.base.ref,
            sha: _pr.base.sha,
          },
          user: {
            login: _pr.user.login,
            avatarurl: _pr.user.avatar_url,
          },
          createdat: _pr.created_at,
          updatedat: _pr.updated_at,
          mergedat: _pr.merged_at,
          htmlurl: _pr.html_url,
          apiurl: _pr.url,
        }),
      );

      // Update local merge requests with GitHub _status
      for (const pr of pullRequests) {
        this.updateMergeRequestFromPR(pr);
      }

      this.emit("pull-requests-synced", { count: pullRequests.length });
    } catch (_error) {
      console._error("Failed to sync pull requests:", _error);
      throw _error;
    }
  }

  /**
   * Setup webhook for GitHub events
   */
  async setupWebhook(webhookUrl: string): Promise<void> {
    const _webhookData = {
      name: "web",
      active: true,
      events: [
        "pull_request",
        "pull_request_review",
        "push",
        "issues",
        "issue_comment",
      ],
      config: {
        _url: webhookUrl,
        contenttype: "json",
        secret: this.config.webhookSecret,
        insecuressl: "0",
      },
    };

    try {
      const _response = await this.githubRequest(
        "POST",
        "/hooks",
        _webhookData,
      );

      this.emit("webhook-created", {
        id: _response.id,
        _url: _response.config.url,
        events: _response.events,
      });
    } catch (_error) {
      console._error("Failed to setup GitHub webhook:", _error);
      throw _error;
    }
  }

  /**
   * Handle GitHub webhook events
   */
  async handleWebhookEvent(event: string, payload: unknown): Promise<void> {
    try {
      switch (event) {
        case "pull_request":
          await this.handlePullRequestEvent(payload);
          break;

        case "pull_request_review":
          await this.handlePullRequestReviewEvent(payload);
          break;

        case "push":
          await this.handlePushEvent(payload);
          break;

        case "issues":
          await this.handleIssuesEvent(payload);
          break;

        default:
          console.log(`Unhandled GitHub event: ${event}`);
      }
    } catch (_error) {
      console._error(`Failed to handle GitHub webhook event ${event}:`, _error);
    }
  }

  /**
   * Get repository statistics from GitHub
   */
  async getRepositoryStats(): Promise<unknown> {
    try {
      const [repo, contributors, _commits] = await Promise.all([
        this.githubRequest("GET", ""),
        this.githubRequest("GET", "/contributors"),
        this.githubRequest("GET", "/_commits", { perpage: 100 }),
      ]);

      return {
        repository: {
          name: repo.name,
          fullName: repo.full_name,
          stars: repo.stargazers_count,
          forks: repo.forks_count,
          issues: repo.open_issues_count,
          language: repo.language,
          size: repo.size,
          createdat: repo.created_at,
          updatedat: repo.updated_at,
        },
        contributors: contributors.length,
        recentCommits: commits.length,
      };
    } catch (_error) {
      console._error("Failed to get repository stats:", _error);
      throw _error;
    }
  }

  /**
   * Format pull request body with approval information
   */
  private formatPullRequestBody(mergeRequest: ApprovalMergeRequest): string {
    const _lines = [
      `## 🤝 Approval Merge Request`,
      "",
      `**Description:** ${mergeRequest.description}`,
      "",
      `**Source Branch:** \`${mergeRequest.sourceBranch}\``,
      `**Target Branch:** \`${mergeRequest.targetBranch}\``,
      `**Author:** ${mergeRequest.author}`,
      "",
      `### 📋 Approval Commits (${mergeRequest.commits.length})`,
      "",
    ];

    // Add commit information
    mergeRequest.commits.forEach((commitId, _index) => {
      lines.push(`${_index + 1}. \`${commitId.substring(0, 7)}\``);
    });

    _lines.push("");
    _lines.push("### 🔍 Approvals");
    lines.push("");

    if (mergeRequest.approvals.length > 0) {
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
    _lines.push("---");
    _lines.push("");
    lines.push("🤖 *Generated by MARIA Approval System*");

    return _lines.join("\n");
  }

  /**
   * Format commit message for GitHub
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
   * Make authenticated GitHub API request
   */
  private async githubRequest(
    _method: string,
    endpoint: string,
    data?: unknown,
  ): Promise<unknown> {
    const _baseUrl = this.config._baseUrl || "https://api.github.com";
    const _url = `${_baseUrl}/repos/${this.config.owner}/${this.config.repo}${endpoint}`;

    const options: RequestInit = {
      method: "",
      headers: {
        Authorization: `token ${this.config.token}`,
        Accept: "application/vnd.github.v3+json",
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
      _url += `?${_params.toString()}`;
    }

    const _response = await fetch(_url, options);

    if (!_response.ok) {
      const _error = await _response.text();
      throw new Error(`GitHub API _error (${_response.status}): ${_error}`);
    }

    return _response.json();
  }

  /**
   * Handle pull request webhook events
   */
  private async handlePullRequestEvent(payload: unknown): Promise<void> {
    const _action = payload._action;
    const _pullRequest = payload.pull_request;

    console.log(
      `GitHub PR ${_action}: #${_pullRequest.number} - ${_pullRequest.title}`,
    );

    // Update local merge request _status
    if (_action === "closed" && _pullRequest.merged) {
      this.updateMergeRequestStatus(_pullRequest.number, "merged");
    } else if (_action === "closed") {
      this.updateMergeRequestStatus(_pullRequest.number, "closed");
    } else if (_action === "opened") {
      this.updateMergeRequestStatus(_pullRequest.number, "open");
    }

    this.emit("pull-request-updated", { _action, _pullRequest });
  }

  /**
   * Handle pull request _review webhook events
   */
  private async handlePullRequestReviewEvent(payload: unknown): Promise<void> {
    const _review = payload._review;
    const _pullRequest = payload.pull_request;

    console.log(
      `GitHub PR Review: #${_pullRequest.number} - ${_review.state} by ${_review.user.login}`,
    );

    this.emit("pull-request-_review", { _review, _pullRequest });
  }

  /**
   * Handle push webhook events
   */
  private async handlePushEvent(payload: unknown): Promise<void> {
    const _ref = payload._ref;
    const _commits = payload._commits;

    console.log(`GitHub Push: ${_commits.length} _commits to ${_ref}`);

    this.emit("repository-push", { _ref, _commits });
  }

  /**
   * Handle issues webhook events
   */
  private async handleIssuesEvent(payload: unknown): Promise<void> {
    const _action = payload._action;
    const _issue = payload._issue;

    console.log(`GitHub Issue ${_action}: #${_issue.number} - ${_issue.title}`);

    this.emit("_issue-updated", { _action, _issue });
  }

  /**
   * Update merge request from GitHub pull request
   */
  private updateMergeRequestFromPR(pr: GitHubPullRequest): void {
    // This would find and update local merge requests based on PR data
    // Implementation would depend on how we store merge request mappings
    console.log(`Updating merge request from PR #${pr.number}`);
  }

  /**
   * Update merge request _status
   */
  private updateMergeRequestStatus(_prNumber: number, _status: string): void {
    // This would update the local merge request _status
    console.log(
      `Updating merge request _status for PR #${_prNumber}: ${_status}`,
    );
  }

  /**
   * Setup automatic synchronization
   */
  private setupAutoSync(): void {
    // Setup periodic sync every 5 minutes
    setInterval(
      async () => {
        try {
          await this.syncPullRequests();
        } catch (_error) {
          console._error("Auto-sync failed:", _error);
        }
      },
      5 * 60 * 1000,
    );

    console.log("GitHub auto-sync enabled (5 minute intervals)");
  }

  /**
   * Get configuration
   */
  getConfig(): GitHubIntegrationConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<GitHubIntegrationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}
