/**
 * PM Planner Types - Core interfaces for project management functionality
 * Based on PLAN_PM_SOW.md specification
 */

export interface WBSItem {
  id: string;
  title: string;
  description: string;
  estimatedHours: number;
  dependencies: string[];
  assignee?: string;
  priority: "low" | "medium" | "high" | "critical";
  status: "pending" | "in_progress" | "completed" | "blocked";
  startDate?: Date;
  endDate?: Date;
}

export interface ProjectRisk {
  id: string;
  description: string;
  impact: "low" | "medium" | "high" | "critical";
  probability: "low" | "medium" | "high";
  mitigation: string;
  owner: string;
  category: "technical" | "resource" | "timeline" | "quality" | "external";
}

export interface ProjectDependency {
  id: string;
  from: string; // WBS item ID or external dependency
  to: string; // WBS item ID
  type:
    | "start_to_start"
    | "start_to_finish"
    | "finish_to_start"
    | "finish_to_finish";
  description: string;
  isExternal: boolean;
}

export interface AnalysisReport {
  wbs: WBSItem[];
  dependencies: ProjectDependency[];
  risks: ProjectRisk[];
  sources: string[];
  generatedAt: Date;
  analysis: {
    totalEstimatedHours: number;
    criticalPath: string[];
    riskLevel: "low" | "medium" | "high";
    complexity: "simple" | "moderate" | "complex" | "very_complex";
  };
  basis: string[];
}

export interface SOWMetadata {
  title: string;
  prompt: string;
  basisSummary: string[];
  generatedAt: Date;
  version: string;
}

export interface SOWContent {
  content: string;
  meta: SOWMetadata;
}

export interface GanttOutput {
  mermaid: string;
  ics: string;
  metadata: {
    generatedAt: Date;
    totalTasks: number;
    duration: string;
    milestones: string[];
  };
}

export interface AnalysisOptions {
  source: "repo" | "issues" | "notes" | "all";
  days: number;
}

export interface DifferentialAnalysis {
  hasChanges: boolean;
  newIssues?: any[];
  newPRs?: any[];
  changedFiles?: string[];
  since?: string;
}

// Data source interfaces
export interface GitHubIssue {
  id: number;
  title: string;
  body: string;
  labels: string[];
  assignee?: string;
  created_at: string;
  updated_at: string;
  state: "open" | "closed";
}

export interface GitHubPR {
  id: number;
  title: string;
  body: string;
  labels: string[];
  assignee?: string;
  created_at: string;
  updated_at: string;
  state: "open" | "closed" | "merged";
  base: string;
  head: string;
}

export interface LocalDocument {
  path: string;
  content: string;
  type: "md" | "txt" | "json";
  lastModified: Date;
}

export interface DataSourceConfig {
  github?: {
    owner: string;
    repo: string;
    token?: string;
  };
  gitlab?: {
    projectId: string;
    token?: string;
    url?: string;
  };
  local?: {
    docsPath: string;
    notesPattern: string;
  };
}

export interface CalendarEvent {
  summary: string;
  description?: string;
  start: string; // ISO date string
  durationDays: number;
  location?: string;
}
