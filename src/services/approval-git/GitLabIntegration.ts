/**
 * GitLab Integration
 * Integrates approval system with GitLab repositories
 */

import { EventEmitter } from 'events';
import { ApprovalCommit, ApprovalMergeRequest, GitLabConfig, GitLabMergeRequest } from './types';
import { ApprovalRepositoryManager } from './ApprovalRepository';

export interface GitLabIntegrationConfig {
  token: string;
  projectId: string;
  baseUrl?: string; // For GitLab self-hosted
  defaultBranch?: string;
  autoSync?: boolean;
  webhookSecret?: string;
}

export class GitLabIntegration extends EventEmitter {
  private config: GitLabIntegrationConfig;
  private approvalRepo: ApprovalRepositoryManager;

  constructor(config: GitLabIntegrationConfig) {
    super();
    this.config = config;
    this.approvalRepo = ApprovalRepositoryManager.getInstance();

    if (config.autoSync) {
      this.setupAutoSync();
    }
  }

  /**
   * Create GitLab merge request from approval merge request
   */
  async createMergeRequest(mergeRequest: ApprovalMergeRequest): Promise<GitLabMergeRequest> {
    const mrData = {
      source_branch: mergeRequest.sourceBranch,
      target_branch: mergeRequest.targetBranch,
      title: mergeRequest.title,
      description: this.formatMergeRequestDescription(mergeRequest),
      remove_source_branch: false,
      squash: false,
    };

    try {
      const response = await this.gitlabRequest('POST', '/merge_requests', mrData);

      const gitlabMR: GitLabMergeRequest = {
        id: response.id,
        iid: response.iid,
        project_id: response.project_id,
        title: response.title,
        description: response.description,
        state: response.state,
        created_at: response.created_at,
        updated_at: response.updated_at,
        merged_at: response.merged_at,
        source_branch: response.source_branch,
        target_branch: response.target_branch,
        author: {
          id: response.author.id,
          username: response.author.username,
          name: response.author.name,
          avatar_url: response.author.avatar_url,
        },
        assignees: response.assignees || [],
        reviewers: response.reviewers || [],
        web_url: response.web_url,
        merge_status: response.merge_status,
        draft: response.draft,
      };

      // Update merge request with GitLab information
      mergeRequest.externalId = gitlabMR.iid.toString();
      mergeRequest.externalUrl = gitlabMR.web_url;

      this.emit('merge-request-created', { mergeRequest, gitlabMR });

      return gitlabMR;
    } catch (error) {
      console.error('Failed to create GitLab merge request:', error);
      throw error;
    }
  }

  /**
   * Sync approval commits to GitLab repository
   */
  async syncCommitsToGitLab(commits: ApprovalCommit[]): Promise<void> {
    try {
      for (const commit of commits) {
        await this.createGitLabCommit(commit);
      }

      this.emit('commits-synced', { count: commits.length });
    } catch (error) {
      console.error('Failed to sync commits to GitLab:', error);
      throw error;
    }
  }

  /**
   * Create a GitLab commit from approval commit
   */
  private async createGitLabCommit(approvalCommit: ApprovalCommit): Promise<void> {
    const commitData = {
      branch: 'approval-commits',
      commit_message: this.formatCommitMessage(approvalCommit),
      author_email: approvalCommit.metadata.email,
      author_name: approvalCommit.metadata.author,
      actions: [
        {
          action: 'create',
          file_path: `approvals/${approvalCommit.id}.json`,
          content: JSON.stringify(approvalCommit, null, 2),
        },
      ],
    };

    try {
      await this.gitlabRequest('POST', '/repository/commits', commitData);
    } catch (error) {
      console.error(`Failed to create GitLab commit ${approvalCommit.id}:`, error);
      throw error;
    }
  }

  /**
   * Get GitLab merge requests and sync with approval merge requests
   */
  async syncMergeRequests(): Promise<void> {
    try {
      const response = await this.gitlabRequest('GET', '/merge_requests', {
        state: 'all',
        order_by: 'updated_at',
        sort: 'desc',
        per_page: 100,
      });

      const mergeRequests: GitLabMergeRequest[] = response.map((mr: unknown) => ({
        id: mr.id,
        iid: mr.iid,
        project_id: mr.project_id,
        title: mr.title,
        description: mr.description,
        state: mr.state,
        created_at: mr.created_at,
        updated_at: mr.updated_at,
        merged_at: mr.merged_at,
        source_branch: mr.source_branch,
        target_branch: mr.target_branch,
        author: {
          id: mr.author.id,
          username: mr.author.username,
          name: mr.author.name,
          avatar_url: mr.author.avatar_url,
        },
        assignees: mr.assignees || [],
        reviewers: mr.reviewers || [],
        web_url: mr.web_url,
        merge_status: mr.merge_status,
        draft: mr.draft,
      }));

      // Update local merge requests with GitLab status
      for (const mr of mergeRequests) {
        this.updateMergeRequestFromMR(mr);
      }

      this.emit('merge-requests-synced', { count: mergeRequests.length });
    } catch (error) {
      console.error('Failed to sync merge requests:', error);
      throw error;
    }
  }

  /**
   * Setup webhook for GitLab events
   */
  async setupWebhook(webhookUrl: string): Promise<void> {
    const webhookData = {
      url: webhookUrl,
      pushevents: true,
      issuesevents: true,
      merge_requestsevents: true,
      wiki_pageevents: false,
      deploymentevents: false,
      jobevents: false,
      pipelineevents: true,
      releaseevents: false,
      subgroupevents: false,
      enable_ssl_verification: true,
      token: this.config.webhookSecret,
    };

    try {
      const response = await this.gitlabRequest('POST', '/hooks', webhookData);

      this.emit('webhook-created', {
        id: response.id,
        url: response.url,
        events: Object.keys(webhookData).filter(
          (key) => key.endsWith('events') && webhookData[key as keyof typeof webhookData],
        ),
      });
    } catch (error) {
      console.error('Failed to setup GitLab webhook:', error);
      throw error;
    }
  }

  /**
   * Handle GitLab webhook events
   */
  async handleWebhookEvent(event: string, payload: unknown): Promise<void> {
    try {
      switch (event) {
        case 'Merge Request Hook':
          await this.handleMergeRequestEvent(payload);
          break;

        case 'Push Hook':
          await this.handlePushEvent(payload);
          break;

        case 'Issue Hook':
          await this.handleIssueEvent(payload);
          break;

        case 'Pipeline Hook':
          await this.handlePipelineEvent(payload);
          break;

        default:
          console.log(`Unhandled GitLab event: ${event}`);
      }
    } catch (error) {
      console.error(`Failed to handle GitLab webhook event ${event}:`, error);
    }
  }

  /**
   * Get project statistics from GitLab
   */
  async getProjectStats(): Promise<unknown> {
    try {
      const [project, contributors, commits] = await Promise.all([
        this.gitlabRequest('GET', ''),
        this.gitlabRequest('GET', '/repository/contributors'),
        this.gitlabRequest('GET', '/repository/commits', { per_page: 100 }),
      ]);

      return {
        project: {
          id: project.id,
          name: project.name,
          path: project.path,
          fullPath: project.path_with_namespace,
          stars: project.star_count,
          forks: project.forks_count,
          issues: project.open_issues_count,
          defaultBranch: project.default_branch,
          visibility: project.visibility,
          created_at: project.created_at,
          last_activity_at: project.last_activity_at,
        },
        contributors: contributors.length,
        recentCommits: commits.length,
      };
    } catch (error) {
      console.error('Failed to get project stats:', error);
      throw error;
    }
  }

  /**
   * Add approval to GitLab merge request
   */
  async addApprovalToMR(mrIid: number, approved: boolean, comments?: string): Promise<void> {
    try {
      if (approved) {
        // Approve the merge request
        await this.gitlabRequest('POST', `/merge_requests/${mrIid}/approve`);
      } else {
        // Unapprove the merge request
        await this.gitlabRequest('POST', `/merge_requests/${mrIid}/unapprove`);
      }

      // Add a note with the approval comments
      if (comments) {
        await this.gitlabRequest('POST', `/merge_requests/${mrIid}/notes`, {
          body: `🤖 **MARIA Approval System**\n\n${comments}`,
        });
      }

      this.emit('approval-added', { mrIid, approved, comments });
    } catch (error) {
      console.error(`Failed to add approval to MR ${mrIid}:`, error);
      throw error;
    }
  }

  /**
   * Get merge request approvals
   */
  async getMergeRequestApprovals(mrIid: number): Promise<unknown> {
    try {
      const response = await this.gitlabRequest('GET', `/merge_requests/${mrIid}/approvals`);

      return {
        approvalsRequired: response.approvals_required,
        approvalsLeft: response.approvals_left,
        approvedBy: response.approved_by.map((approval: unknown) => ({
          user: {
            id: approval.user.id,
            username: approval.user.username,
            name: approval.user.name,
          },
        })),
        suggestedApprovers: response.suggested_approvers || [],
      };
    } catch (error) {
      console.error(`Failed to get MR approvals for ${mrIid}:`, error);
      throw error;
    }
  }

  /**
   * Format merge request description with approval information
   */
  private formatMergeRequestDescription(mergeRequest: ApprovalMergeRequest): string {
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
    lines.push('### 🏷️ Labels');
    lines.push('');

    if (mergeRequest.labels.length > 0) {
      mergeRequest.labels.forEach((label) => {
        lines.push(`- \`${label}\``);
      });
    } else {
      lines.push('_No labels_');
    }

    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('🤖 *Generated by MARIA Approval System*');

    return lines.join('\n');
  }

  /**
   * Format commit message for GitLab
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
   * Make authenticated GitLab API request
   */
  private async gitlabRequest(method: string, endpoint: string, data?: unknown): Promise<unknown> {
    const baseUrl = this.config.baseUrl || 'https://gitlab.com/api/v4';
    let url = `${baseUrl}/projects/${this.config.projectId}${endpoint}`;

    const options: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${this.config.token}`,
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
      throw new Error(`GitLab API error (${response.status}): ${error}`);
    }

    return response.json();
  }

  /**
   * Handle merge request webhook events
   */
  private async handleMergeRequestEvent(payload: unknown): Promise<void> {
    const action = payload.object_attributes.action;
    const mergeRequest = payload.object_attributes;

    console.log(`GitLab MR ${action}: !${mergeRequest.iid} - ${mergeRequest.title}`);

    // Update local merge request status
    if (action === 'merge') {
      this.updateMergeRequestStatus(mergeRequest.iid, 'merged');
    } else if (action === 'close') {
      this.updateMergeRequestStatus(mergeRequest.iid, 'closed');
    } else if (action === 'open') {
      this.updateMergeRequestStatus(mergeRequest.iid, 'opened');
    }

    this.emit('merge-request-updated', { action, mergeRequest });
  }

  /**
   * Handle push webhook events
   */
  private async handlePushEvent(payload: unknown): Promise<void> {
    const ref = payload.ref;
    const commits = payload.commits;

    console.log(`GitLab Push: ${commits.length} commits to ${ref}`);

    this.emit('repository-push', { ref, commits });
  }

  /**
   * Handle issue webhook events
   */
  private async handleIssueEvent(payload: unknown): Promise<void> {
    const action = payload.object_attributes.action;
    const issue = payload.object_attributes;

    console.log(`GitLab Issue ${action}: #${issue.iid} - ${issue.title}`);

    this.emit('issue-updated', { action, issue });
  }

  /**
   * Handle pipeline webhook events
   */
  private async handlePipelineEvent(payload: unknown): Promise<void> {
    const pipeline = payload.object_attributes;
    const status = pipeline.status;

    console.log(`GitLab Pipeline ${status}: ${pipeline.id} for ${pipeline.ref}`);

    this.emit('pipeline-updated', { pipeline });
  }

  /**
   * Update merge request from GitLab merge request
   */
  private updateMergeRequestFromMR(mr: GitLabMergeRequest): void {
    // This would find and update local merge requests based on MR data
    console.log(`Updating merge request from MR !${mr.iid}`);
  }

  /**
   * Update merge request status
   */
  private updateMergeRequestStatus(mrIid: number, status: string): void {
    // This would update the local merge request status
    console.log(`Updating merge request status for MR !${mrIid}: ${status}`);
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
        } catch (error) {
          console.error('Auto-sync failed:', error);
        }
      },
      5 * 60 * 1000,
    );

    console.log('GitLab auto-sync enabled (5 minute intervals)');
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
