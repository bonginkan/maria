/**
 * DataSources - Abstraction layer for GitHub/GitLab/Local docs
 * Provides unified interface for project data collection
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { glob } from "glob";
import {
  DataSourceConfig,
  GitHubIssue,
  GitHubPR,
  LocalDocument,
  AnalysisOptions,
} from "./types";

export class DataSources {
  private config: DataSourceConfig;

  constructor(config: DataSourceConfig = {}) {
    this.config = config;
  }

  /**
   * Get all available data based on options
   */
  async getData(options: AnalysisOptions) {
    const data: {
      issues: GitHubIssue[];
      prs: GitHubPR[];
      documents: LocalDocument[];
      sources: string[];
    } = {
      issues: [],
      prs: [],
      documents: [],
      sources: [],
    };

    if (options.source === "all" || options.source === "issues") {
      data.issues = await this.getIssues(options.days);
      if (data.issues.length > 0) data.sources.push("GitHub Issues");
    }

    if (options.source === "all" || options.source === "repo") {
      data.prs = await this.getPRs(options.days);
      if (data.prs.length > 0) data.sources.push("GitHub PRs");
    }

    if (options.source === "all" || options.source === "notes") {
      data.documents = await this.getLocalDocuments(options.days);
      if (data.documents.length > 0) data.sources.push("Local Documents");
    }

    return data;
  }

  /**
   * Get GitHub issues from repository
   */
  private async getIssues(daysSince: number): Promise<GitHubIssue[]> {
    // Mock implementation - in production, use GitHub API
    const mockIssues: GitHubIssue[] = [
      {
        id: 1,
        title: "Improve search latency performance",
        body: "Current p95 latency is 2000ms, need to reduce to 1500ms",
        labels: ["performance", "search", "high-priority"],
        assignee: "developer1",
        created_at: new Date(
          Date.now() - 5 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        updated_at: new Date(
          Date.now() - 2 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        state: "open",
      },
      {
        id: 2,
        title: "GPU acceleration for reranker",
        body: "Implement CUDA/Metal support for reranking models",
        labels: ["enhancement", "gpu", "ml"],
        assignee: "ml-engineer",
        created_at: new Date(
          Date.now() - 7 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        updated_at: new Date(
          Date.now() - 1 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        state: "open",
      },
    ];

    // Filter by date
    const cutoffDate = new Date(Date.now() - daysSince * 24 * 60 * 60 * 1000);
    return mockIssues.filter(
      (issue) => new Date(issue.updated_at) > cutoffDate,
    );
  }

  /**
   * Get GitHub PRs from repository
   */
  private async getPRs(daysSince: number): Promise<GitHubPR[]> {
    // Mock implementation - in production, use GitHub API
    const mockPRs: GitHubPR[] = [
      {
        id: 10,
        title: "Add GPU memory optimization for embeddings",
        body: "Implements batch processing and memory pooling for GPU operations",
        labels: ["optimization", "gpu"],
        assignee: "gpu-dev",
        created_at: new Date(
          Date.now() - 3 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        updated_at: new Date(
          Date.now() - 1 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        state: "open",
        base: "main",
        head: "feature/gpu-optimization",
      },
      {
        id: 11,
        title: "Cross-encoder reranking implementation",
        body: "Adds cross-encoder model support for improved search relevance",
        labels: ["ml", "search", "reranking"],
        assignee: "ml-engineer",
        created_at: new Date(
          Date.now() - 6 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        updated_at: new Date(
          Date.now() - 4 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        state: "merged",
        base: "main",
        head: "feature/cross-encoder",
      },
    ];

    // Filter by date
    const cutoffDate = new Date(Date.now() - daysSince * 24 * 60 * 60 * 1000);
    return mockPRs.filter((pr) => new Date(pr.updated_at) > cutoffDate);
  }

  /**
   * Get local documents (notes, docs, etc.)
   */
  private async getLocalDocuments(daysSince: number): Promise<LocalDocument[]> {
    const documents: LocalDocument[] = [];

    try {
      // Look for common documentation patterns
      const patterns = [
        "docs/**/*.md",
        "notes/**/*.md",
        "*.md",
        "meeting-notes/**/*.md",
        "plans/**/*.md",
      ];

      const cutoffDate = new Date(Date.now() - daysSince * 24 * 60 * 60 * 1000);

      for (const pattern of patterns) {
        try {
          const files = await glob(pattern, { absolute: true });

          for (const file of files) {
            try {
              const stats = await fs.stat(file);

              // Skip if older than cutoff
              if (stats.mtime < cutoffDate) continue;

              const content = await fs.readFile(file, "utf8");
              const ext = path.extname(file).slice(1) as "md" | "txt" | "json";

              documents.push({
                path: file,
                content,
                type: ext || "txt",
                lastModified: stats.mtime,
              });
            } catch (fileError) {
              // Skip files we can't read
              continue;
            }
          }
        } catch (globError) {
          // Skip patterns that don't match
          continue;
        }
      }

      // Add mock meeting notes for demonstration
      if (documents.length === 0) {
        documents.push({
          path: "meeting-notes/2025-08-27-planning.md",
          content: `# Planning Meeting - 2025-08-27

## Objectives
- Improve search latency by 20% 
- Maintain JA language quality
- GPU acceleration for reranker

## Action Items
- [ ] Prototype GPU reranker
- [ ] Benchmark current performance
- [ ] Plan rollout strategy

## Risks
- GPU memory constraints
- JA quality regression
- Timeline pressure`,
          type: "md",
          lastModified: new Date(),
        });
      }
    } catch (error) {
      console.warn("Error reading local documents:", error);
    }

    return documents;
  }

  /**
   * Get differential data since a specific date
   */
  async getDifferentialData(since?: string) {
    const sinceDate = since
      ? new Date(since)
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const daysSince = Math.ceil(
      (Date.now() - sinceDate.getTime()) / (24 * 60 * 60 * 1000),
    );

    const data = await this.getData({ source: "all", days: daysSince });

    return {
      hasChanges:
        data.issues.length > 0 ||
        data.prs.length > 0 ||
        data.documents.length > 0,
      newIssues: data.issues,
      newPRs: data.prs,
      changedFiles: data.documents.map((d) => d.path),
      since: since,
    };
  }
}
