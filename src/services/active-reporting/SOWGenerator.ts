/**
 * SOW Generator - Automatic Statement of Work generation
 * Creates structured SOWs from user intents to enforce planning discipline
 */

import * as crypto from "crypto";
import {
  Deliverable,
  IntentAnalysis,
  Milestone,
  Phase,
  Risk,
  SOW,
  Task,
  TaskDecomposition,
  Timeline,
} from "./types";

export class SOWGenerator {
  private _templates: Map<string, SOWTemplate>;
  private riskMitigations: Map<string, string>;

  constructor() {
    this.templates = this.initializeTemplates();
    this.riskMitigations = this.initializeRiskMitigations();
  }

  /**
   * Initialize the generator
   */
  public async initialize(): Promise<void> {
    // Load any additional _templates or configurations
  }

  /**
   * Generate SOW from intent analysis
   */
  public async generate(
    _intent: IntentAnalysis,
    request: string,
  ): Promise<SOW> {
    const _template = this.getTemplate(_intent.primaryIntent);
    const _tasks = this.generateTasks(_intent, request);
    const _deliverables = this.generateDeliverables(_intent, _tasks);
    const _timeline = this.generateTimeline(_tasks, _deliverables);
    const _risks = this.generateRisks(_intent);
    const _assumptions = this.generateAssumptions(_intent);
    const _successCriteria = this.generateSuccessCriteria(
      _intent,
      _deliverables,
    );

    const sow: SOW = {
      id: crypto.randomUUID(),
      title: this.generateTitle(_intent, request),
      _objective: this.generateObjective(_intent, request),
      scope: this.generateScope(_intent, request),
      _deliverables,
      _timeline,
      _risks,
      _assumptions,
      _successCriteria,
      _tasks,
      approvalStatus: "draft",
      version: "1.0.0",
    };

    return sow;
  }

  /**
   * Create SOW from task decomposition
   */
  public async createFromDecomposition(
    decomposition: TaskDecomposition,
  ): Promise<SOW> {
    const _deliverables = this.extractDeliverablesFromTasks(
      decomposition.subtasks,
    );
    const _timeline = this.generateTimelineFromTasks(decomposition.subtasks);
    const _risks = this.extractRisksFromTasks(decomposition.subtasks);

    return {
      id: crypto.randomUUID(),
      title: decomposition.rootTask.title,
      _objective: decomposition.rootTask.description,
      scope: this.extractScopeFromTasks(decomposition.subtasks),
      _deliverables,
      _timeline,
      _risks,
      _assumptions: ["All dependencies are available", "No external blockers"],
      _successCriteria: [
        "All _tasks completed successfully",
        "No critical issues remaining",
      ],
      _tasks: decomposition.subtasks,
      approvalStatus: "approved",
      version: "1.0.0",
    };
  }

  /**
   * Generate title for SOW
   */
  private generateTitle(_intent: IntentAnalysis, request: string): string {
    const _action = this.getActionFromIntent(_intent.primaryIntent);
    const _subject = this.extractSubject(request);

    return `${_action}: ${_subject}`;
  }

  /**
   * Generate _objective statement
   */
  private generateObjective(_intent: IntentAnalysis, request: string): string {
    const _complexity = _intent.estimatedComplexity;
    const _approach = _intent.suggestedApproach;

    const _objective = `To ${this.getActionFromIntent(_intent.primaryIntent).toLowerCase()} `;
    _objective += `${this.extractSubject(request).toLowerCase()} `;
    _objective += `using ${_approach}. `;

    if (_intent.secondaryIntents.length > 0) {
      _objective += `This includes ${_intent.secondaryIntents.join(", ")}.`;
    }

    return _objective;
  }

  /**
   * Generate scope statements
   */
  private generateScope(_intent: IntentAnalysis, _request: string): string[] {
    const scope: string[] = [];

    // Primary scope
    scope.push(
      `Primary: ${this.getActionFromIntent(_intent.primaryIntent)} implementation`,
    );

    // Secondary scope items
    intent.secondaryIntents.forEach((secondary) => {
      scope.push(`Secondary: ${this.formatSecondaryIntent(secondary)}`);
    });

    // Implicit requirements as scope
    intent.implicitRequirements.forEach((req) => {
      scope.push(`Requirement: ${this.formatRequirement(req)}`);
    });

    // Out of scope (important for clarity)
    scope.push("Out of scope: Any work not explicitly mentioned in this SOW");

    return scope;
  }

  /**
   * Generate _tasks based on intent
   */
  private generateTasks(_intent: IntentAnalysis, _request: string): Task[] {
    const _tasks: Task[] = [];
    const _baseTime = this.estimateBaseTime(_intent.estimatedComplexity);

    // Planning phase _tasks
    tasks.push(
      this.createTask(
        "Requirements Analysis",
        "Analyze and document detailed requirements",
        "pending",
        "high",
        _baseTime * 0.1,
        [],
      ),
    );

    tasks.push(
      this.createTask(
        "Technical Design",
        "Create technical design and architecture",
        "pending",
        "high",
        _baseTime * 0.15,
        [_tasks[0].id],
      ),
    );

    // Implementation phase _tasks
    const _implementationTasks = this.generateImplementationTasks(
      _intent,
      _baseTime,
    );
    implementationTasks.forEach((task) => {
      task.dependencies = [_tasks[1].id]; // Depend on design
      tasks.push(task);
    });

    // Testing phase _tasks
    if (_intent.secondaryIntents.includes("testing_required")) {
      tasks.push(
        this.createTask(
          "Unit Testing",
          "Write and execute unit tests",
          "pending",
          "high",
          _baseTime * 0.15,
          implementationTasks.map((t) => t.id),
        ),
      );

      tasks.push(
        this.createTask(
          "Integration Testing",
          "Perform integration testing",
          "pending",
          "medium",
          _baseTime * 0.1,
          [_tasks[_tasks.length - 1].id],
        ),
      );
    }

    // Documentation phase _tasks
    if (_intent.secondaryIntents.includes("documentation_needed")) {
      tasks.push(
        this.createTask(
          "Documentation",
          "Create user and technical documentation",
          "pending",
          "medium",
          _baseTime * 0.1,
          implementationTasks.map((t) => t.id),
        ),
      );
    }

    // Review and deployment
    tasks.push(
      this.createTask(
        "Code Review",
        "Conduct thorough code review",
        "pending",
        "high",
        _baseTime * 0.05,
        implementationTasks.map((t) => t.id),
      ),
    );

    if (_intent.secondaryIntents.includes("deployment_consideration")) {
      tasks.push(
        this.createTask(
          "Deployment Preparation",
          "Prepare for deployment",
          "pending",
          "critical",
          _baseTime * 0.1,
          [_tasks[_tasks.length - 1].id],
        ),
      );
    }

    return _tasks;
  }

  /**
   * Generate implementation-specific _tasks
   */
  private generateImplementationTasks(
    _intent: IntentAnalysis,
    _baseTime: number,
  ): Task[] {
    const _tasks: Task[] = [];

    switch (_intent.primaryIntent) {
      case "implement_feature":
        tasks.push(
          this.createTask(
            "Core Implementation",
            "Implement core functionality",
            "pending",
            "critical",
            _baseTime * 0.3,
          ),
          this.createTask(
            "UI Development",
            "Create user interface",
            "pending",
            "high",
            _baseTime * 0.2,
          ),
          this.createTask(
            "API Integration",
            "Integrate with backend APIs",
            "pending",
            "high",
            _baseTime * 0.15,
          ),
        );
        break;

      case "fix_bug":
        tasks.push(
          this.createTask(
            "Bug Reproduction",
            "Reproduce and isolate bug",
            "pending",
            "critical",
            _baseTime * 0.2,
          ),
          this.createTask(
            "Root Cause Analysis",
            "Identify root cause",
            "pending",
            "critical",
            _baseTime * 0.2,
          ),
          this.createTask(
            "Fix Implementation",
            "Implement bug fix",
            "pending",
            "critical",
            _baseTime * 0.15,
          ),
          this.createTask(
            "Regression Testing",
            "Test for regressions",
            "pending",
            "high",
            _baseTime * 0.1,
          ),
        );
        break;

      case "refactor_code":
        tasks.push(
          this.createTask(
            "Code Analysis",
            "Analyze existing code structure",
            "pending",
            "high",
            _baseTime * 0.15,
          ),
          this.createTask(
            "Refactoring Plan",
            "Create refactoring plan",
            "pending",
            "high",
            _baseTime * 0.1,
          ),
          this.createTask(
            "Refactoring Implementation",
            "Implement refactoring",
            "pending",
            "high",
            _baseTime * 0.3,
          ),
          this.createTask(
            "Verification",
            "Verify functionality preserved",
            "pending",
            "critical",
            _baseTime * 0.1,
          ),
        );
        break;

      default:
        tasks.push(
          this.createTask(
            "Implementation",
            "Main implementation work",
            "pending",
            "high",
            _baseTime * 0.5,
          ),
          this.createTask(
            "Testing",
            "Test implementation",
            "pending",
            "high",
            _baseTime * 0.15,
          ),
        );
    }

    return _tasks;
  }

  /**
   * Create a single task
   */
  private createTask(
    title: string,
    description: string,
    status: Task["status"],
    priority: Task["priority"],
    estimatedTime: number,
    dependencies: string[] = [],
  ): Task {
    return {
      id: crypto.randomUUID(),
      title,
      description,
      status,
      priority,
      estimatedTime,
      dependencies,
      assignee: "ai",
      progress: 0,
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        autoGenerated: true,
      },
    };
  }

  /**
   * Generate _deliverables
   */
  private generateDeliverables(
    _intent: IntentAnalysis,
    _tasks: Task[],
  ): Deliverable[] {
    const _deliverables: Deliverable[] = [];

    // Code deliverable
    deliverables.push({
      id: crypto.randomUUID(),
      name: "Source Code",
      description: "Complete, _tested, and documented source code",
      acceptanceCriteria: [
        "Code passes all tests",
        "Code follows style guidelines",
        "No critical issues or bugs",
        "Performance requirements met",
      ],
      estimatedEffort:
        _tasks.reduce((sum, _t) => sum + (_t.estimatedTime || 0), 0) / 60,
    });

    // Documentation deliverable
    if (_intent.secondaryIntents.includes("documentation_needed")) {
      deliverables.push({
        id: crypto.randomUUID(),
        name: "Documentation",
        description: "Comprehensive documentation",
        acceptanceCriteria: [
          "API documentation complete",
          "User guide created",
          "Code comments added",
        ],
        estimatedEffort: 2,
      });
    }

    // Test deliverable
    if (_intent.secondaryIntents.includes("testing_required")) {
      deliverables.push({
        id: crypto.randomUUID(),
        name: "Test Suite",
        description: "Complete test suite with coverage",
        acceptanceCriteria: [
          "Unit tests > 80% coverage",
          "Integration tests passing",
          "No failing tests",
        ],
        estimatedEffort: 3,
      });
    }

    return _deliverables;
  }

  /**
   * Generate _timeline
   */
  private generateTimeline(
    _tasks: Task[],
    _deliverables: Deliverable[],
  ): Timeline {
    const _totalHours =
      tasks.reduce((sum, _t) => sum + (_t.estimatedTime || 0), 0) / 60;
    const _startDate = new Date();
    const _endDate = new Date(
      _startDate.getTime() + _totalHours * 60 * 60 * 1000,
    );

    const milestones: Milestone[] = [
      {
        id: crypto.randomUUID(),
        name: "Planning Complete",
        date: new Date(
          _startDate.getTime() + _totalHours * 0.2 * 60 * 60 * 1000,
        ),
        _deliverables: [],
        status: "pending",
      },
      {
        id: crypto.randomUUID(),
        name: "Implementation Complete",
        date: new Date(
          _startDate.getTime() + _totalHours * 0.7 * 60 * 60 * 1000,
        ),
        _deliverables: [_deliverables[0]?.id].filter(Boolean),
        status: "pending",
      },
      {
        id: crypto.randomUUID(),
        name: "Project Complete",
        date: _endDate,
        _deliverables: deliverables.map((d) => d.id),
        status: "pending",
      },
    ];

    const phases: Phase[] = [
      {
        id: crypto.randomUUID(),
        name: "Planning",
        _startDate,
        _endDate: milestones[0].date,
        _tasks: tasks.slice(0, 2).map((t) => t.id),
        status: "not_started",
      },
      {
        id: crypto.randomUUID(),
        name: "Implementation",
        _startDate: milestones[0].date,
        _endDate: milestones[1].date,
        _tasks: tasks.slice(2, -2).map((t) => t.id),
        status: "not_started",
      },
      {
        id: crypto.randomUUID(),
        name: "Finalization",
        _startDate: milestones[1].date,
        _endDate,
        _tasks: tasks.slice(-2).map((t) => t.id),
        status: "not_started",
      },
    ];

    return {
      _startDate,
      _endDate,
      milestones,
      phases,
    };
  }

  /**
   * Generate _risks
   */
  private generateRisks(intent: IntentAnalysis): Risk[] {
    const _risks: Risk[] = [];

    (intent.identifiedRisks || []).forEach((riskId) => {
      const _mitigation =
        this.riskMitigations.get(riskId) ||
        "Implement standard _mitigation procedures";

      risks.push({
        id: crypto.randomUUID(),
        description: this.formatRisk(riskId),
        impact: this.assessRiskImpact(riskId),
        probability: this.assessRiskProbability(intent.estimatedComplexity),
        _mitigation,
        owner: "ai",
      });
    });

    // Add default _risks based on _complexity
    if (
      intent.estimatedComplexity === "complex" ||
      intent.estimatedComplexity === "very_complex"
    ) {
      risks.push({
        id: crypto.randomUUID(),
        description: "Timeline overrun due to unexpected _complexity",
        impact: "high",
        probability: "medium",
        _mitigation: "Regular progress monitoring and early escalation",
        owner: "ai",
      });
    }

    return _risks;
  }

  /**
   * Generate _assumptions
   */
  private generateAssumptions(intent: IntentAnalysis): string[] {
    const _assumptions: string[] = [
      "All required dependencies and libraries are available",
      "Development environment is properly configured",
      "No external blockers or dependencies",
    ];

    if (intent.requiredCapabilities?.includes("api_design")) {
      assumptions.push("API endpoints are accessible and documented");
    }

    if (intent.requiredCapabilities?.includes("database_management")) {
      assumptions.push("Database access and credentials are provided");
    }

    if (intent.secondaryIntents.includes("deployment_consideration")) {
      assumptions.push("Deployment infrastructure is ready");
    }

    return _assumptions;
  }

  /**
   * Generate success criteria
   */
  private generateSuccessCriteria(
    _intent: IntentAnalysis,
    _deliverables: Deliverable[],
  ): string[] {
    const criteria: string[] = [];

    // General criteria
    criteria.push("All _deliverables completed and accepted");
    criteria.push("All _tasks marked as completed");
    criteria.push("No critical bugs or issues remaining");

    // Intent-specific criteria
    switch (_intent.primaryIntent) {
      case "implement_feature":
        criteria.push("Feature working as specified");
        criteria.push("User acceptance testing passed");
        break;
      case "fix_bug":
        criteria.push("Bug no longer reproducible");
        criteria.push("No regression issues introduced");
        break;
      case "refactor_code":
        criteria.push("Code quality metrics improved");
        criteria.push("All existing functionality preserved");
        break;
    }

    // Quality criteria
    if (_intent.implicitRequirements.includes("code_quality_standards")) {
      criteria.push("Code review approved");
      criteria.push("Coding standards met");
    }

    if (_intent.secondaryIntents.includes("testing_required")) {
      criteria.push("Test coverage > 80%");
      criteria.push("All tests passing");
    }

    return criteria;
  }

  // Helper methods

  private getTemplate(intent: string): SOWTemplate {
    return this.templates.get(intent) || this.templates.get("default")!;
  }

  private getActionFromIntent(intent: string): string {
    const actionMap: Record<string, string> = {
      implementfeature: "Feature Implementation",
      fixbug: "Bug Fix",
      refactorcode: "Code Refactoring",
      createdocumentation: "Documentation Creation",
      writetests: "Test Development",
      analyzecode: "Code Analysis",
      optimizeperformance: "Performance Optimization",
      integratesystem: "System Integration",
      deployapplication: "Application Deployment",
      configuresystem: "System Configuration",
      generaldevelopment: "Development Work",
    };

    return actionMap[intent] || "Development Task";
  }

  private extractSubject(request: string): string {
    // Simple extraction - in production, use NLP
    const _words = request.split(" ").slice(0, 10);
    return _words.join(" ");
  }

  private formatSecondaryIntent(intent: string): string {
    return intent.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  private formatRequirement(requirement: string): string {
    return requirement
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  private formatRisk(riskId: string): string {
    return riskId.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  private estimateBaseTime(_complexity: string): number {
    const timeMap: Record<string, number> = {
      simple: 120, // 2 hours
      moderate: 240, // 4 hours
      complex: 480, // 8 hours
      verycomplex: 960, // 16 hours
    };

    return timeMap[_complexity] || 240;
  }

  private assessRiskImpact(
    riskId: string,
  ): "low" | "medium" | "high" | "critical" {
    if (riskId.includes("production") || riskId.includes("security")) {
      return "critical";
    }
    if (riskId.includes("data") || riskId.includes("performance")) {
      return "high";
    }
    if (riskId.includes("integration") || riskId.includes("migration")) {
      return "medium";
    }
    return "low";
  }

  private assessRiskProbability(
    _complexity: string,
  ): "low" | "medium" | "high" {
    if (_complexity === "very_complex") {
      return "high";
    }
    if (_complexity === "complex") {
      return "medium";
    }
    return "low";
  }

  private extractDeliverablesFromTasks(_tasks: Task[]): Deliverable[] {
    // Group _tasks into _deliverables
    return [
      {
        id: crypto.randomUUID(),
        name: "Completed Implementation",
        description: "All _tasks completed successfully",
        acceptanceCriteria: ["All _tasks marked as done"],
        estimatedEffort:
          _tasks.reduce((sum, _t) => sum + (_t.estimatedTime || 0), 0) / 60,
      },
    ];
  }

  private generateTimelineFromTasks(_tasks: Task[]): Timeline {
    const _totalTime = _tasks.reduce(
      (sum, _t) => sum + (_t.estimatedTime || 0),
      0,
    );
    const _startDate = new Date();
    const _endDate = new Date(_startDate.getTime() + _totalTime * 60 * 1000);

    return {
      _startDate,
      _endDate,
      milestones: [],
      phases: [],
    };
  }

  private extractRisksFromTasks(_tasks: Task[]): Risk[] {
    return [];
  }

  private extractScopeFromTasks(_tasks: Task[]): string[] {
    return _tasks.map((t) => t.title);
  }

  private initializeTemplates(): Map<string, SOWTemplate> {
    const _templates = new Map<string, SOWTemplate>();

    // Define _templates for different intent types
    this._templates.set("default", {
      sections: [
        "_objective",
        "scope",
        "_deliverables",
        "_timeline",
        "_risks",
        "_assumptions",
        "success_criteria",
      ],
    });

    return this._templates;
  }

  private initializeRiskMitigations(): Map<string, string> {
    const _mitigations = new Map<string, string>();

    _mitigations.set(
      "production_deployment_risk",
      "Implement staged rollout with rollback plan",
    );
    _mitigations.set(
      "data_integrity_risk",
      "Create backups and implement transaction logging",
    );
    mitigations.set(
      "security_vulnerability_risk",
      "Conduct security audit and penetration testing",
    );
    mitigations.set(
      "performance_degradation_risk",
      "Implement performance monitoring and optimization",
    );
    _mitigations.set(
      "migration_failure_risk",
      "Create rollback procedures and test in staging",
    );
    mitigations.set(
      "integration_compatibility_risk",
      "Perform compatibility testing and versioning",
    );
    _mitigations.set(
      "regression_risk",
      "Implement comprehensive regression test suite",
    );
    _mitigations.set(
      "scope_creep_risk",
      "Strict change control and regular reviews",
    );
    mitigations.set(
      "timeline_overrun_risk",
      "Buffer time and parallel task execution",
    );

    return _mitigations;
  }
}

interface SOWTemplate {
  sections: string[];
}
