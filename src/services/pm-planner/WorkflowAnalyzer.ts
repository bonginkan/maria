/**
 * WorkflowAnalyzer - Business flow analysis and WBS generation
 * Analyzes issues, PRs, and notes to extract PM insights
 */

import { DataSources } from "./DataSources";
import {
  AnalysisOptions,
  AnalysisReport,
  WBSItem,
  ProjectRisk,
  ProjectDependency,
  DifferentialAnalysis,
} from "./types";

export class WorkflowAnalyzer {
  private dataSources: DataSources;

  constructor() {
    this.dataSources = new DataSources();
  }

  /**
   * Run comprehensive workflow analysis
   */
  async run(options: AnalysisOptions): Promise<AnalysisReport> {
    // Collect data from various sources
    const data = await this.dataSources.getData(options);

    // Extract WBS items from issues and PRs
    const wbs = this.extractWBSItems(data.issues, data.prs, data.documents);

    // Analyze dependencies
    const dependencies = this.analyzeDependencies(wbs, data.issues, data.prs);

    // Identify risks
    const risks = this.extractRisks(data.issues, data.prs, data.documents);

    // Generate analysis summary
    const analysis = this.generateAnalysisSummary(wbs, risks);

    // Extract basis information
    const basis = this.extractBasisInformation(
      data.issues,
      data.prs,
      data.documents,
    );

    return {
      wbs,
      dependencies,
      risks,
      sources: data.sources,
      generatedAt: new Date(),
      analysis,
      basis,
    };
  }

  /**
   * Run differential analysis for updates
   */
  async runDifferential(options: {
    since?: string;
  }): Promise<DifferentialAnalysis> {
    return await this.dataSources.getDifferentialData(options.since);
  }

  /**
   * Extract WBS items from data sources
   */
  private extractWBSItems(
    issues: any[],
    prs: any[],
    documents: any[],
  ): WBSItem[] {
    const wbsItems: WBSItem[] = [];

    // Extract from issues
    issues.forEach((issue, index) => {
      const priority = this.extractPriorityFromLabels(issue.labels);
      const estimatedHours = this.estimateHoursFromIssue(issue);

      wbsItems.push({
        id: `issue-${issue.id}`,
        title: issue.title,
        description: issue.body?.slice(0, 200) || "No description",
        estimatedHours,
        dependencies: [],
        assignee: issue.assignee,
        priority,
        status: issue.state === "open" ? "pending" : "completed",
        startDate: new Date(issue.created_at),
        endDate:
          issue.state === "closed" ? new Date(issue.updated_at) : undefined,
      });
    });

    // Extract from PRs
    prs.forEach((pr) => {
      if (pr.state === "open") {
        wbsItems.push({
          id: `pr-${pr.id}`,
          title: `Review: ${pr.title}`,
          description: pr.body?.slice(0, 200) || "No description",
          estimatedHours: this.estimateHoursFromPR(pr),
          dependencies: [],
          assignee: pr.assignee,
          priority: this.extractPriorityFromLabels(pr.labels),
          status: "in_progress",
          startDate: new Date(pr.created_at),
        });
      }
    });

    // Add inferred tasks from documents
    documents.forEach((doc, index) => {
      const tasks = this.extractTasksFromDocument(doc);
      wbsItems.push(...tasks);
    });

    // Add default project management tasks if none exist
    if (wbsItems.length === 0) {
      wbsItems.push(
        {
          id: "planning-001",
          title: "Requirements Analysis",
          description: "Analyze and document detailed requirements",
          estimatedHours: 8,
          dependencies: [],
          priority: "high",
          status: "pending",
        },
        {
          id: "planning-002",
          title: "Technical Design",
          description: "Create technical architecture and design",
          estimatedHours: 16,
          dependencies: ["planning-001"],
          priority: "high",
          status: "pending",
        },
        {
          id: "implementation-001",
          title: "Core Implementation",
          description: "Implement main functionality",
          estimatedHours: 32,
          dependencies: ["planning-002"],
          priority: "critical",
          status: "pending",
        },
      );
    }

    return wbsItems;
  }

  /**
   * Analyze dependencies between WBS items
   */
  private analyzeDependencies(
    wbs: WBSItem[],
    issues: any[],
    prs: any[],
  ): ProjectDependency[] {
    const dependencies: ProjectDependency[] = [];

    // Analyze explicit dependencies from WBS
    wbs.forEach((item) => {
      item.dependencies.forEach((depId) => {
        dependencies.push({
          id: `dep-${item.id}-${depId}`,
          from: depId,
          to: item.id,
          type: "finish_to_start",
          description: `${depId} must complete before ${item.id}`,
          isExternal: false,
        });
      });
    });

    // Infer dependencies from PR relationships
    prs.forEach((pr) => {
      if (pr.body?.includes("depends on") || pr.body?.includes("blocked by")) {
        dependencies.push({
          id: `pr-dep-${pr.id}`,
          from: "external-dependency",
          to: `pr-${pr.id}`,
          type: "finish_to_start",
          description: "External dependency identified in PR",
          isExternal: true,
        });
      }
    });

    return dependencies;
  }

  /**
   * Extract risks from issues and documents
   */
  private extractRisks(
    issues: any[],
    prs: any[],
    documents: any[],
  ): ProjectRisk[] {
    const risks: ProjectRisk[] = [];

    // Risk keywords to look for
    const riskKeywords = [
      "risk",
      "blocker",
      "blocked",
      "concern",
      "issue",
      "problem",
      "dependency",
      "constraint",
      "limitation",
      "challenge",
    ];

    // Extract from issues
    issues.forEach((issue) => {
      const hasRiskKeywords = riskKeywords.some(
        (keyword) =>
          issue.title.toLowerCase().includes(keyword) ||
          issue.body?.toLowerCase().includes(keyword),
      );

      if (
        hasRiskKeywords ||
        issue.labels.some((label: string) =>
          ["bug", "blocked", "high-priority"].includes(label),
        )
      ) {
        risks.push({
          id: `risk-issue-${issue.id}`,
          description: issue.title,
          impact: this.assessImpactFromLabels(issue.labels),
          probability: "medium",
          mitigation: "Monitor closely and address proactively",
          owner: issue.assignee || "unassigned",
          category: this.categorizeRisk(issue.title, issue.body),
        });
      }
    });

    // Extract from documents
    documents.forEach((doc) => {
      const content = doc.content.toLowerCase();
      if (riskKeywords.some((keyword) => content.includes(keyword))) {
        risks.push({
          id: `risk-doc-${Math.random().toString(36).substr(2, 9)}`,
          description: `Risk identified in ${doc.path}`,
          impact: "medium",
          probability: "medium",
          mitigation: "Review document for specific mitigation strategies",
          owner: "pm",
          category: "external",
        });
      }
    });

    // Add default risks based on complexity
    risks.push({
      id: "risk-timeline",
      description: "Timeline overrun due to unforeseen complexity",
      impact: "high",
      probability: "medium",
      mitigation: "Regular progress monitoring and buffer time allocation",
      owner: "pm",
      category: "timeline",
    });

    return risks;
  }

  /**
   * Generate analysis summary
   */
  private generateAnalysisSummary(wbs: WBSItem[], risks: ProjectRisk[]) {
    const totalHours = wbs.reduce((sum, item) => sum + item.estimatedHours, 0);
    const criticalPath = this.calculateCriticalPath(wbs);
    const riskLevel = this.assessOverallRiskLevel(risks);
    const complexity = this.assessComplexity(wbs, risks);

    return {
      totalEstimatedHours: totalHours,
      criticalPath,
      riskLevel,
      complexity,
    };
  }

  /**
   * Extract basis information for SOW generation
   */
  private extractBasisInformation(
    issues: any[],
    prs: any[],
    documents: any[],
  ): string[] {
    const basis: string[] = [];

    issues.forEach((issue) => {
      basis.push(`Issue #${issue.id}: ${issue.title}`);
    });

    prs.forEach((pr) => {
      basis.push(`PR #${pr.id}: ${pr.title}`);
    });

    documents.forEach((doc) => {
      basis.push(`Document: ${doc.path}`);
    });

    return basis.slice(0, 10); // Limit to top 10 items
  }

  // Helper methods

  private extractPriorityFromLabels(
    labels: string[],
  ): "low" | "medium" | "high" | "critical" {
    if (labels.includes("critical") || labels.includes("urgent"))
      return "critical";
    if (labels.includes("high-priority") || labels.includes("important"))
      return "high";
    if (labels.includes("low-priority") || labels.includes("nice-to-have"))
      return "low";
    return "medium";
  }

  private estimateHoursFromIssue(issue: any): number {
    // Simple heuristic based on title length and labels
    let baseHours = 8;

    if (issue.labels.includes("bug")) baseHours = 4;
    if (issue.labels.includes("enhancement")) baseHours = 16;
    if (issue.labels.includes("feature")) baseHours = 24;
    if (issue.labels.includes("epic")) baseHours = 40;

    return baseHours;
  }

  private estimateHoursFromPR(pr: any): number {
    // Estimate review time based on PR complexity
    return 2; // Default review time
  }

  private extractTasksFromDocument(doc: any): WBSItem[] {
    const tasks: WBSItem[] = [];

    // Look for task patterns in markdown
    const taskPattern = /^[-\*]\s*\[\s*\]\s*(.+)/gm;
    const matches = doc.content.matchAll(taskPattern);

    for (const match of matches) {
      tasks.push({
        id: `doc-task-${Math.random().toString(36).substr(2, 9)}`,
        title: match[1].trim(),
        description: `Task from ${doc.path}`,
        estimatedHours: 4,
        dependencies: [],
        priority: "medium",
        status: "pending",
      });
    }

    return tasks;
  }

  private assessImpactFromLabels(
    labels: string[],
  ): "low" | "medium" | "high" | "critical" {
    if (labels.includes("critical") || labels.includes("security"))
      return "critical";
    if (labels.includes("high-impact") || labels.includes("performance"))
      return "high";
    if (labels.includes("low-impact")) return "low";
    return "medium";
  }

  private categorizeRisk(
    title: string,
    body?: string,
  ): "technical" | "resource" | "timeline" | "quality" | "external" {
    const content = (title + " " + (body || "")).toLowerCase();

    if (
      content.includes("technical") ||
      content.includes("architecture") ||
      content.includes("performance")
    )
      return "technical";
    if (
      content.includes("resource") ||
      content.includes("capacity") ||
      content.includes("staffing")
    )
      return "resource";
    if (
      content.includes("timeline") ||
      content.includes("schedule") ||
      content.includes("deadline")
    )
      return "timeline";
    if (
      content.includes("quality") ||
      content.includes("testing") ||
      content.includes("bug")
    )
      return "quality";

    return "external";
  }

  private calculateCriticalPath(wbs: WBSItem[]): string[] {
    // Simple critical path calculation - find longest dependency chain
    const dependencyMap = new Map<string, string[]>();

    wbs.forEach((item) => {
      dependencyMap.set(item.id, item.dependencies);
    });

    // For now, return items with highest estimated hours
    return wbs
      .sort((a, b) => b.estimatedHours - a.estimatedHours)
      .slice(0, 3)
      .map((item) => item.id);
  }

  private assessOverallRiskLevel(
    risks: ProjectRisk[],
  ): "low" | "medium" | "high" {
    const criticalRisks = risks.filter((r) => r.impact === "critical").length;
    const highRisks = risks.filter((r) => r.impact === "high").length;

    if (criticalRisks > 0) return "high";
    if (highRisks > 2) return "high";
    if (risks.length > 5) return "medium";

    return "low";
  }

  private assessComplexity(
    wbs: WBSItem[],
    risks: ProjectRisk[],
  ): "simple" | "moderate" | "complex" | "very_complex" {
    const totalHours = wbs.reduce((sum, item) => sum + item.estimatedHours, 0);
    const highRisks = risks.filter(
      (r) => r.impact === "high" || r.impact === "critical",
    ).length;

    if (totalHours > 200 || highRisks > 3) return "very_complex";
    if (totalHours > 100 || highRisks > 1) return "complex";
    if (totalHours > 40 || risks.length > 2) return "moderate";

    return "simple";
  }
}
