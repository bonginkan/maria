/**
 * Git-like Approval History System - Type Definitions
 * Git-inspired approval versioning and workflow management
 */

import {
  ApprovalResponse,
  // ApprovalRequest, // Currently unused
  RiskLevel,
  ApprovalCategory,
} from '../approval-engine/types';

// Git-like approval commit
export interface ApprovalCommit {
  id: string; // SHA-like hash for the commit
  parentCommits: string[]; // Previous approval states (supports merges)
  approvalData: ApprovalResponse;
  metadata: {
    timestamp: Date;
    author: string;
    email: string;
    message: string; // Approval commit message
    tags: string[]; // e.g., ["security-review", "architecture"]
    riskLevel: RiskLevel;
    category: ApprovalCategory;
  };
  diff: ApprovalDiff; // Changes from previous state
  treeHash: string; // Hash of the approval tree state
}

// Diff representation for approval changes
export interface ApprovalDiff {
  type: 'approval' | 'rejection' | 'trust-change' | 'policy-update';
  before: Partial<ApprovalState>;
  after: Partial<ApprovalState>;
  changes: ApprovalChange[];
  summary: string;
}

export interface ApprovalChange {
  path: string; // e.g., "trust-level", "auto-approval-categories"
  operation: 'add' | 'remove' | 'modify';
  oldValue?: unknown;
  newValue?: unknown;
  description: string;
}

export interface ApprovalState {
  trustLevel: string;
  autoApprovalCategories: string[];
  approvedRequests: string[];
  rejectedRequests: string[];
  policies: Record<string, unknown>;
}

// Git-like branch for approval workflows
export interface ApprovalBranch {
  name: string; // e.g., "feature/auth-system", "hotfix/security"
  head: string; // Current commit ID
  baseCommit: string; // Base commit for the branch
  approvalPath: ApprovalCommit[];
  mergeRequests: ApprovalMergeRequest[];
  protected: boolean; // Branch protection rules
  createdAt: Date;
  lastActivity: Date;
}

// Merge request for approval workflows
export interface ApprovalMergeRequest {
  id: string;
  title: string;
  description: string;
  sourceBranch: string;
  targetBranch: string;
  commits: string[]; // Commit IDs to be merged
  approvals: ApprovalReview[];
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'merged' | 'closed';

  // External integration
  githubPrNumber?: number; // GitHub PR integration
  gitlabMrId?: number; // GitLab MR integration

  // Metadata
  author: string;
  assignees: string[];
  reviewers: string[];
  labels: string[];
  milestone?: string;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  mergedAt?: Date;
  closedAt?: Date;
}

// Review for merge requests
export interface ApprovalReview {
  id: string;
  reviewer: string;
  status: 'pending' | 'approved' | 'changes-requested' | 'commented';
  comments: ApprovalComment[];
  timestamp: Date;
}

export interface ApprovalComment {
  id: string;
  author: string;
  content: string;
  timestamp: Date;
  resolved?: boolean;
}

// Git-like repository for approvals
export interface ApprovalRepository {
  id: string;
  name: string;
  branches: Map<string, ApprovalBranch>;
  commits: Map<string, ApprovalCommit>;
  tags: Map<string, string>; // Tag name -> commit ID
  remotes: GitRemoteIntegration[];
  config: ApprovalRepoConfig;

  // Repository metadata
  defaultBranch: string;
  createdAt: Date;
  lastActivity: Date;
}

// Configuration for approval repository
export interface ApprovalRepoConfig {
  remote: {
    origin?: GitRemoteConfig;
    upstream?: GitRemoteConfig;
  };
  branches: {
    main: string; // Default main branch
    protected: string[]; // Protected branch names
    autoMerge: boolean; // Auto-merge approved MRs
  };
  integration: {
    github?: GitHubConfig;
    gitlab?: GitLabConfig;
  };
  policies: ApprovalPolicies;
}

// Remote configuration
export interface GitRemoteConfig {
  url: string;
  type: 'github' | 'gitlab' | 'generic';
  credentials?: {
    token?: string;
    username?: string;
    email?: string;
  };
}

// GitHub integration configuration
export interface GitHubConfig {
  owner: string;
  repo: string;
  token: string;
  webhookUrl?: string;
  autoCreatePR: boolean;
  prTemplate?: string;
  labelMappings: Record<RiskLevel, string[]>;
}

// GitLab integration configuration
export interface GitLabConfig {
  projectId: number | string;
  token: string;
  instanceUrl?: string; // For self-hosted GitLab
  webhookUrl?: string;
  autoCreateMR: boolean;
  mrTemplate?: string;
  labelMappings: Record<RiskLevel, string[]>;
}

// Approval policies for repository
export interface ApprovalPolicies {
  branchProtection: {
    requireApproval: boolean;
    minimumApprovals: number;
    requireCodeOwnerReview: boolean;
    dismissStaleReviews: boolean;
    restrictPushes: boolean;
  };
  mergeRequirements: {
    requireLinearHistory: boolean;
    allowMergeCommits: boolean;
    allowSquashMerge: boolean;
    allowRebaseMerge: boolean;
    deleteHeadBranches: boolean;
  };
  autoApproval: {
    enabled: boolean;
    conditions: AutoApprovalCondition[];
  };
}

export interface AutoApprovalCondition {
  riskLevel: RiskLevel;
  categories: ApprovalCategory[];
  authorTrustLevel: string;
  requiresTests: boolean;
  maxChangedFiles: number;
}

// Git remote integration
export interface GitRemoteIntegration {
  name: string;
  type: 'github' | 'gitlab';
  config: GitHubConfig | GitLabConfig;
  status: 'connected' | 'disconnected' | 'error';
  lastSync: Date;
  syncErrors: string[];
}

// GitHub webhook payload
export interface GitHubWebhookPayload {
  action: string;
  pull_request?: {
    number: number;
    title: string;
    body: string;
    state: string;
    user: { login: string };
    head: { ref: string };
    base: { ref: string };
  };
  repository: {
    name: string;
    full_name: string;
  };
}

// GitLab webhook payload
export interface GitLabWebhookPayload {
  event_type: string;
  merge_request?: {
    id: number;
    title: string;
    description: string;
    state: string;
    author: { name: string; email: string };
    source_branch: string;
    target_branch: string;
  };
  project: {
    id: number;
    name: string;
    path_with_namespace: string;
  };
}

// Command interfaces for CLI operations
export interface ApprovalLogOptions {
  branch?: string;
  author?: string;
  since?: Date;
  until?: Date;
  grep?: string;
  limit?: number;
  oneline?: boolean;
  graph?: boolean;
}

export interface ApprovalBranchOptions {
  create?: boolean;
  delete?: boolean;
  list?: boolean;
  remote?: boolean;
  merged?: boolean;
}

export interface ApprovalMergeOptions {
  noFF?: boolean; // No fast-forward
  squash?: boolean; // Squash commits
  message?: string; // Merge commit message
  strategy?: 'ours' | 'theirs' | 'recursive';
}

export interface ApprovalRevertOptions {
  noCommit?: boolean; // Don't create revert commit
  message?: string; // Revert commit message
}

export interface ApprovalTagOptions {
  annotated?: boolean; // Create annotated tag
  message?: string; // Tag message
  force?: boolean; // Force overwrite existing tag
}

// Additional GitHub Integration Types
export interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  head: {
    ref: string;
    sha: string;
  };
  base: {
    ref: string;
    sha: string;
  };
  user: {
    login: string;
    avatar_url: string;
  };
  created_at: string;
  updated_at: string;
  merged_at: string | null;
  html_url: string;
  api_url: string;
}

// Additional GitLab Integration Types
export interface GitLabMergeRequest {
  id: number;
  iid: number;
  project_id: number;
  title: string;
  description: string;
  state: 'opened' | 'closed' | 'merged';
  created_at: string;
  updated_at: string;
  merged_at: string | null;
  source_branch: string;
  target_branch: string;
  author: {
    id: number;
    username: string;
    name: string;
    avatar_url: string;
  };
  assignees: Array<{
    id: number;
    username: string;
    name: string;
  }>;
  reviewers: Array<{
    id: number;
    username: string;
    name: string;
  }>;
  web_url: string;
  merge_status: string;
  draft: boolean;
}

// Statistics and analytics
export interface ApprovalStatistics {
  repository: {
    totalCommits: number;
    totalBranches: number;
    totalMergeRequests: number;
    totalTags: number;
  };
  activity: {
    commitsLastWeek: number;
    commitsLastMonth: number;
    averageTimeToApproval: number;
    averageTimeToMerge: number;
  };
  contributors: {
    totalContributors: number;
    mostActiveContributor: string;
    contributorActivity: Record<string, number>;
  };
  risk: {
    riskDistribution: Record<RiskLevel, number>;
    categoryDistribution: Record<ApprovalCategory, number>;
    rejectionRate: number;
  };
}

// Events for the approval git system
export interface ApprovalGitEvents {
  'commit-created': ApprovalCommit;
  'branch-created': ApprovalBranch;
  'branch-deleted': { name: string };
  'merge-request-created': ApprovalMergeRequest;
  'merge-request-updated': ApprovalMergeRequest;
  'merge-completed': { sourceBranch: string; targetBranch: string; mergeCommit: string };
  'tag-created': { name: string; commit: string };
  'remote-synced': { remote: string; success: boolean };
  'github-pr-created': { prNumber: number; mrId: string };
  'gitlab-mr-created': { mrId: number; localMrId: string };
}
