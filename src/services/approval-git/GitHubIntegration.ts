/**
 * GitHub Integration
 * Integrates approval system with GitHub repositories
 */

import { EventEmitter } from 'events';
import { ApprovalCommit, ApprovalMergeRequest, GitHubConfig, GitHubPullRequest } from './types';
import { ApprovalRepositoryManager } from './ApprovalRepository';

export interface GitHubIntegrationConfig {
  token: string;
  owner: string;
  repo: string;
  baseUrl?: string; // For GitHub Enterprise
  defaultBranch?: string;
  autoSync?: boolean;
  webhookSecret?: string;
}

export class GitHubIntegration extends EventEmitter {
  private config: GitHubIntegrationConfig;
  private approvalRepo: ApprovalRepositoryManager;

  constructor(config: GitHubIntegrationConfig) {
    super();
    this.config = config;
    this.approvalRepo = ApprovalRepositoryManager.getInstance();

    if (config.autoSync) {
      this.setupAutoSync();
    }
  }

  /**
   * Create GitHub pull request from approval merge request
   */
  async createPullRequest(mergeRequest: ApprovalMergeRequest): Promise<GitHubPullRequest> {
    const prData = {
      title: mergeRequest.title,
      body: this.formatPullRequestBody(mergeRequest),
      head: mergeRequest.sourceBranch,
      base: mergeRequest.targetBranch,
      draft: false,
    };

    try {
      const response = await this.githubRequest('POST', '/pulls', prData);

      const pullRequest: GitHubPullRequest = {
        id: response.id,
        number: response.number,
        title: response.title,
        body: response.body,
        state: response.state,
        head: {
          ref: response.head.ref,
          sha: response.head.sha,
        },
        base: {
          ref: response.base.ref,
          sha: response.base.sha,
        },
        user: {
          login: response.user.login,
          avatar_url: response.user.avatar_url,
        },
        created_at: response.created_at,
        updated_at: response.updated_at,
        merged_at: response.merged_at,
        html_url: response.html_url,
        api_url: response.url,
      };

      // Update merge request with GitHub information
      mergeRequest.externalId = pullRequest.number.toString();
      mergeRequest.externalUrl = pullRequest.html_url;

      this.emit('pull-request-created', { mergeRequest, pullRequest });

      return pullRequest;
    } catch (error) {
      console.error('Failed to create GitHub pull request:', error);
      throw error;
    }
  }

  /**
   * Sync approval commits to GitHub repository
   */
  async syncCommitsToGitHub(commits: ApprovalCommit[]): Promise<void> {
    try {
      for (const commit of commits) {
        await this.createGitHubCommit(commit);
      }

      this.emit('commits-synced', { count: commits.length });
    } catch (error) {
      console.error('Failed to sync commits to GitHub:', error);
      throw error;
    }
  }

  /**
   * Create a GitHub commit from approval commit
   */
  private async createGitHubCommit(approvalCommit: ApprovalCommit): Promise<void> {
    const commitData = {
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
      await this.githubRequest('POST', '/git/commits', commitData);
    } catch (error) {
      console.error(`Failed to create GitHub commit ${approvalCommit.id}:`, error);
      throw error;
    }
  }

  /**
   * Get GitHub pull requests and sync with approval merge requests
   */
  async syncPullRequests(): Promise<void> {
    try {
      const response = await this.githubRequest('GET', '/pulls', {
        state: 'all',
        sort: 'updated',
        direction: 'desc',
      });

      const pullRequests: GitHubPullRequest[] = response.map((pr: unknown) => ({
        id: pr.id,
        number: pr.number,
        title: pr.title,
        body: pr.body,
        state: pr.state,
        head: {
          ref: pr.head.ref,
          sha: pr.head.sha,
        },
        base: {
          ref: pr.base.ref,
          sha: pr.base.sha,
        },
        user: {
          login: pr.user.login,
          avatar_url: pr.user.avatar_url,
        },
        created_at: pr.created_at,
        updated_at: pr.updated_at,
        merged_at: pr.merged_at,
        html_url: pr.html_url,
        api_url: pr.url,
      }));

      // Update local merge requests with GitHub status
      for (const pr of pullRequests) {
        this.updateMergeRequestFromPR(pr);
      }

      this.emit('pull-requests-synced', { count: pullRequests.length });
    } catch (error) {
      console.error('Failed to sync pull requests:', error);
      throw error;
    }
  }

  /**
   * Setup webhook for GitHub events
   */
  async setupWebhook(webhookUrl: string): Promise<void> {
    const webhookData = {
      name: 'web',
      active: true,
      events: ['pull_request', 'pull_request_review', 'push', 'issues', 'issue_comment'],
      config: {
        url: webhookUrl,
        content_type: 'json',
        secret: this.config.webhookSecret,
        insecure_ssl: '0',
      },
    };

    try {
      const response = await this.githubRequest('POST', '/hooks', webhookData);

      this.emit('webhook-created', {
        id: response.id,
        url: response.config.url,
        events: response.events,
      });
    } catch (error) {
      console.error('Failed to setup GitHub webhook:', error);
      throw error;
    }
  }

  /**
   * Handle GitHub webhook events
   */
  async handleWebhookEvent(event: string, payload: unknown): Promise<void> {
    try {
      switch (event) {
        case 'pull_request':
          await this.handlePullRequestEvent(payload);
          break;

        case 'pull_request_review':
          await this.handlePullRequestReviewEvent(payload);
          break;

        case 'push':
          await this.handlePushEvent(payload);
          break;

        case 'issues':
          await this.handleIssuesEvent(payload);
          break;

        default:
          console.log(`Unhandled GitHub event: ${event}`);
      }
    } catch (error) {
      console.error(`Failed to handle GitHub webhook event ${event}:`, error);
    }
  }

  /**
   * Get repository statistics from GitHub
   */
  async getRepositoryStats(): Promise<unknown> {
    try {
      const [repo, contributors, commits] = await Promise.all([
        this.githubRequest('GET', ''),
        this.githubRequest('GET', '/contributors'),
        this.githubRequest('GET', '/commits', { per_page: 100 }),
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
          created_at: repo.created_at,
          updated_at: repo.updated_at,
        },
        contributors: contributors.length,
        recentCommits: commits.length,
      };
    } catch (error) {
      console.error('Failed to get repository stats:', error);
      throw error;
    }
  }

  /**
   * Format pull request body with approval information
   */
  private formatPullRequestBody(mergeRequest: ApprovalMergeRequest): string {
    const lines = [
      `## 🤝 Approval Merge Request`,
      '',
      `**Description:** ${mergeRequest.description}`,
      '',
      `**Source Branch:** \`${mergeRequest.sourceBranch}\``,
      `**Target Branch:** \`${mergeRequest.targetBranch}\``,
      `**Author:** ${mergeRequest.author}`,
      '',
      `### 📋 Approval Commits (${mergeRequest.commits.length})`,
      '',
    ];

    // Add commit information
    mergeRequest.commits.forEach((commitId, index) => {
      lines.push(`${index + 1}. \`${commitId.substring(0, 7)}\``);
    });

    lines.push('');
    lines.push('### 🔍 Approvals');
    lines.push('');

    if (mergeRequest.approvals.length > 0) {
      mergeRequest.approvals.forEach((approval) => {
        const status = approval.approved ? '✅' : '❌';
        lines.push(`- ${status} **${approval.reviewer}**: ${approval.comments || 'No comments'}`);
      });
    } else {
      lines.push('_No approvals yet_');
    }

    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('🤖 *Generated by MARIA Approval System*');

    return lines.join('\n');
  }

  /**
   * Format commit message for GitHub
   */
  private formatCommitMessage(commit: ApprovalCommit): string {
    const lines = [
      commit.metadata.message,
      '',
      `Approval-ID: ${commit.id}`,
      `Risk-Level: ${commit.metadata.riskLevel}`,
      `Category: ${commit.metadata.category}`,
    ];

    if (commit.metadata.tags.length > 0) {
      lines.push(`Tags: ${commit.metadata.tags.join(', ')}`);
    }

    lines.push('');
    lines.push('Generated by MARIA Approval System');

    return lines.join('\n');
  }

  /**
   * Make authenticated GitHub API request
   */
  private async githubRequest(method: string, endpoint: string, data?: unknown): Promise<unknown> {
    const baseUrl = this.config.baseUrl || 'https://api.github.com';
    const url = `${baseUrl}/repos/${this.config.owner}/${this.config.repo}${endpoint}`;

    const options: RequestInit = {
      method,
      headers: {
        Authorization: `token ${this.config.token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'MARIA-Approval-System/1.0',
      },
    };

    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      options.body = JSON.stringify(data);
    } else if (data && method === 'GET') {
      const params = new URLSearchParams(data);
      url += `?${params.toString()}`;
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`GitHub API error (${response.status}): ${error}`);
    }

    return response.json();
  }

  /**
   * Handle pull request webhook events
   */
  private async handlePullRequestEvent(payload: unknown): Promise<void> {
    const action = payload.action;
    const pullRequest = payload.pull_request;

    console.log(`GitHub PR ${action}: #${pullRequest.number} - ${pullRequest.title}`);

    // Update local merge request status
    if (action === 'closed' && pullRequest.merged) {
      this.updateMergeRequestStatus(pullRequest.number, 'merged');
    } else if (action === 'closed') {
      this.updateMergeRequestStatus(pullRequest.number, 'closed');
    } else if (action === 'opened') {
      this.updateMergeRequestStatus(pullRequest.number, 'open');
    }

    this.emit('pull-request-updated', { action, pullRequest });
  }

  /**
   * Handle pull request review webhook events
   */
  private async handlePullRequestReviewEvent(payload: unknown): Promise<void> {
    const review = payload.review;
    const pullRequest = payload.pull_request;

    console.log(
      `GitHub PR Review: #${pullRequest.number} - ${review.state} by ${review.user.login}`,
    );

    this.emit('pull-request-review', { review, pullRequest });
  }

  /**
   * Handle push webhook events
   */
  private async handlePushEvent(payload: unknown): Promise<void> {
    const ref = payload.ref;
    const commits = payload.commits;

    console.log(`GitHub Push: ${commits.length} commits to ${ref}`);

    this.emit('repository-push', { ref, commits });
  }

  /**
   * Handle issues webhook events
   */
  private async handleIssuesEvent(payload: unknown): Promise<void> {
    const action = payload.action;
    const issue = payload.issue;

    console.log(`GitHub Issue ${action}: #${issue.number} - ${issue.title}`);

    this.emit('issue-updated', { action, issue });
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
   * Update merge request status
   */
  private updateMergeRequestStatus(prNumber: number, status: string): void {
    // This would update the local merge request status
    console.log(`Updating merge request status for PR #${prNumber}: ${status}`);
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
        } catch (error) {
          console.error('Auto-sync failed:', error);
        }
      },
      5 * 60 * 1000,
    );

    console.log('GitHub auto-sync enabled (5 minute intervals)');
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
