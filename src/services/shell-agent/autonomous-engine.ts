/**
 * Autonomous Engine - Phase C autonomous execution system
 * AI-driven patch generation with confidence-based auto-approval
 */

import { _z } from "zod";
import { PatchPlan, PatchOperation } from "./patch-engine";
import { ApprovalSystem } from "./approval-system";
import { _ShellPlan } from "./shell-plan";
import * as _fs from "fs/promises";
import * as _path from "path";

// Confidence levels for autonomous operations
export enum ConfidenceLevel {
  LOW = "low", // < 0.5 - Always require approval
  MEDIUM = "medium", // 0.5-0.8 - Approval based on risk
  HIGH = "high", // 0.8-0.95 - Auto-approve low risk
  VERY_HIGH = "very_high", // > 0.95 - Auto-approve most operations
}

// Risk assessment for operations
export enum _RiskLevel {
  MINIMAL = "minimal", // Comments, whitespace, formatting
  LOW = "low", // Non-breaking changes, additions
  MEDIUM = "medium", // Modifications to existing code
  HIGH = "high", // Core logic changes, deletions
  CRITICAL = "critical", // System files, security-related
}

// Learning data from user approvals
export interface ApprovalHistory {
  operation: PatchOperation;
  approved: boolean;
  confidence: number;
  risk: RiskLevel;
  timestamp: string;
  userFeedback?: string;
}

// Autonomous execution configuration
export interface AutonomousConfig {
  enableLearning?: boolean;
  minConfidence?: number; // Minimum confidence for auto-approval
  maxRisk?: RiskLevel; // Maximum risk level for auto-approval
  batchMode?: boolean; // Process multiple operations
  dryRun?: boolean; // Simulate without applying
  learningRate?: number; // How fast to adapt from feedback
}

// AI-generated patch suggestion
export interface PatchSuggestion {
  plan: PatchPlan;
  confidence: number;
  risk: RiskLevel;
  reasoning: string;
  alternatives?: PatchPlan[];
  metadata: {
    model?: string;
    temperature?: number;
    timestamp: string;
  };
}

// Batch operation plan
export interface BatchPlan {
  id: string;
  description: string;
  operations: PatchSuggestion[];
  totalConfidence: number;
  maxRisk: RiskLevel;
  requiresApproval: boolean;
}

export class AutonomousEngine {
  private approvalHistory: ApprovalHistory[] = [];
  private confidenceThresholds: Map<RiskLevel, number>;
  private patternDatabase: Map<
    string,
    { confidence: number; approvalRate: number }
  >;
  private approvalSystem: ApprovalSystem;

  constructor(private config: AutonomousConfig = {}) {
    this.config = {
      enableLearning: config.enableLearning ?? true,
      minConfidence: config.minConfidence ?? 0.8,
      maxRisk: config.maxRisk ?? RiskLevel.MEDIUM,
      batchMode: config.batchMode ?? false,
      dryRun: config.dryRun ?? false,
      learningRate: config.learningRate ?? 0.1,
    };

    // Initialize confidence thresholds per risk level
    this.confidenceThresholds = new Map([
      [RiskLevel.MINIMAL, 0.5],
      [RiskLevel.LOW, 0.7],
      [RiskLevel.MEDIUM, 0.85],
      [RiskLevel.HIGH, 0.95],
      [RiskLevel.CRITICAL, 0.99],
    ]);

    // Initialize pattern database for learning
    this.patternDatabase = new Map();

    // Initialize approval system
    this.approvalSystem = new ApprovalSystem();
  }

  /**
   * Generate patch suggestion from natural language using AI
   */
  async generatePatchSuggestion(
    request: string,
    context?: { currentFile?: string; recentChanges?: string[] },
  ): Promise<PatchSuggestion> {
    // Analyze request intent
    const intent = this.analyzeIntent(request);

    // Assess risk level
    const risk = this.assessRisk(intent, context);

    // Generate patch operations
    const operations = await this.generateOperations(request, intent, context);

    // Calculate confidence based on patterns and history
    const confidence = this.calculateConfidence(operations, risk);

    // Create patch plan
    const plan: PatchPlan = {
      description: `AI-generated patch: ${request}`,
      operations,
      requiresApproval: this.shouldRequireApproval(confidence, risk),
      transactionId: `auto-${Date.now()}`,
    };

    // Generate reasoning
    const reasoning = this.generateReasoning(
      intent,
      operations,
      confidence,
      risk,
    );

    return {
      plan,
      confidence,
      risk,
      reasoning,
      metadata: {
        model: "gpt-4",
        temperature: 0.3,
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Analyze intent from natural language
   */
  private analyzeIntent(request: string): {
    action: "add" | "modify" | "delete" | "refactor" | "fix";
    scope: "line" | "function" | "file" | "project";
    urgency: "low" | "medium" | "high";
  } {
    const lower = request.toLowerCase();

    // Determine action
    let action: "add" | "modify" | "delete" | "refactor" | "fix" = "modify";
    if (lower.includes("add") || lower.includes("create")) action = "add";
    else if (lower.includes("delete") || lower.includes("remove"))
      action = "delete";
    else if (lower.includes("refactor") || lower.includes("restructure"))
      action = "refactor";
    else if (
      lower.includes("fix") ||
      lower.includes("bug") ||
      lower.includes("error")
    )
      action = "fix";

    // Determine scope
    let scope: "line" | "function" | "file" | "project" = "line";
    if (lower.includes("function") || lower.includes("method"))
      scope = "function";
    else if (lower.includes("file") || lower.includes("module")) scope = "file";
    else if (lower.includes("project") || lower.includes("all"))
      scope = "project";

    // Determine urgency
    let urgency: "low" | "medium" | "high" = "medium";
    if (
      lower.includes("urgent") ||
      lower.includes("critical") ||
      lower.includes("asap")
    )
      urgency = "high";
    else if (lower.includes("when possible") || lower.includes("low priority"))
      urgency = "low";

    return { action, scope, urgency };
  }

  /**
   * Assess risk level of operations
   */
  private assessRisk(
    intent: ReturnType<typeof this.analyzeIntent>,
    context?: { currentFile?: string; recentChanges?: string[] },
  ): RiskLevel {
    // Critical files always high risk
    if (context?.currentFile) {
      const critical = [
        "package.json",
        "tsconfig.json",
        ".env",
        "auth",
        "security",
        "payment",
        "database",
      ];
      if (critical.some((c) => context.currentFile!.includes(c))) {
        return RiskLevel.CRITICAL;
      }
    }

    // Risk matrix based on action and scope
    const riskMatrix: Record<string, Record<string, RiskLevel>> = {
      add: {
        line: RiskLevel.LOW,
        function: RiskLevel.LOW,
        file: RiskLevel.MEDIUM,
        project: RiskLevel.HIGH,
      },
      modify: {
        line: RiskLevel.MEDIUM,
        function: RiskLevel.MEDIUM,
        file: RiskLevel.HIGH,
        project: RiskLevel.CRITICAL,
      },
      delete: {
        line: RiskLevel.MEDIUM,
        function: RiskLevel.HIGH,
        file: RiskLevel.CRITICAL,
        project: RiskLevel.CRITICAL,
      },
      refactor: {
        line: RiskLevel.MEDIUM,
        function: RiskLevel.HIGH,
        file: RiskLevel.HIGH,
        project: RiskLevel.CRITICAL,
      },
      fix: {
        line: RiskLevel.LOW,
        function: RiskLevel.MEDIUM,
        file: RiskLevel.MEDIUM,
        project: RiskLevel.HIGH,
      },
    };

    return riskMatrix[intent.action][intent.scope] || RiskLevel.MEDIUM;
  }

  /**
   * Generate patch operations from request
   */
  private async generateOperations(
    request: string,
    intent: ReturnType<typeof this.analyzeIntent>,
    context?: { currentFile?: string; recentChanges?: string[] },
  ): Promise<PatchOperation[]> {
    const operations: PatchOperation[] = [];

    // Simple pattern-based generation for Phase C PoC
    // In production, this would use LLM for complex generation

    if (intent.action === "add") {
      // Extract what to add and where
      const addMatch = request.match(/add\s+["']([^"']+)["']\s+to\s+([^\s]+)/i);
      if (addMatch) {
        operations.push({
          type: "append",
          file: addMatch[2],
          content: addMatch[1] + "\n",
        });
      }
    } else if (intent.action === "modify") {
      // Extract find/replace patterns
      const replaceMatch = request.match(
        /replace\s+["']([^"']+)["']\s+with\s+["']([^"']+)["']/i,
      );
      if (replaceMatch) {
        const file = context?.currentFile || this.extractFileName(request);
        if (file) {
          operations.push({
            type: "find_replace",
            file,
            find: replaceMatch[1],
            replace: replaceMatch[2],
          });
        }
      }
    } else if (intent.action === "delete") {
      // Extract deletion target
      const deleteMatch = request.match(
        /delete\s+lines?\s+(\d+)(?:-(\d+))?\s+from\s+([^\s]+)/i,
      );
      if (deleteMatch) {
        operations.push({
          type: "delete_lines",
          file: deleteMatch[3],
          startLine: parseInt(deleteMatch[1]),
          endLine: parseInt(deleteMatch[2] || deleteMatch[1]),
        });
      }
    } else if (intent.action === "fix") {
      // Common fix patterns
      if (request.includes("syntax") || request.includes("typo")) {
        // Would use AI to detect and fix syntax errors
        const file = context?.currentFile || this.extractFileName(request);
        if (file) {
          operations.push({
            type: "find_replace",
            file,
            find: "cosnt", // Common typo
            replace: "const",
          });
        }
      }
    }

    return operations;
  }

  /**
   * Extract file name from request
   */
  private extractFileName(request: string): string | null {
    const fileMatch = request.match(/(?:in|from|to)\s+([^\s]+\.\w+)/);
    return fileMatch ? fileMatch[1] : null;
  }

  /**
   * Calculate confidence based on patterns and history
   */
  private calculateConfidence(
    operations: PatchOperation[],
    risk: RiskLevel,
  ): number {
    let baseConfidence = 0.7; // Base confidence for AI generation

    // Adjust based on operation complexity
    if (operations.length === 0) return 0;
    if (operations.length === 1) baseConfidence += 0.1;
    if (operations.length > 5) baseConfidence -= 0.2;

    // Adjust based on risk
    const riskAdjustment: Record<RiskLevel, number> = {
      [RiskLevel.MINIMAL]: 0.2,
      [RiskLevel.LOW]: 0.1,
      [RiskLevel.MEDIUM]: 0,
      [RiskLevel.HIGH]: -0.1,
      [RiskLevel.CRITICAL]: -0.3,
    };
    baseConfidence += riskAdjustment[risk];

    // Learn from history
    if (this.config.enableLearning) {
      const pattern = this.getOperationPattern(operations);
      const learned = this.patternDatabase.get(pattern);
      if (learned) {
        // Weighted average with historical approval rate
        baseConfidence = baseConfidence * 0.7 + learned.confidence * 0.3;
      }
    }

    // Clamp to valid range
    return Math.max(0, Math.min(1, baseConfidence));
  }

  /**
   * Generate operation pattern for learning
   */
  private getOperationPattern(operations: PatchOperation[]): string {
    return operations
      .map((op) => `${op.type}:${op.file?.split(".").pop()}`)
      .sort()
      .join("|");
  }

  /**
   * Determine if approval is required
   */
  private shouldRequireApproval(confidence: number, risk: RiskLevel): boolean {
    // Always require approval in dry run mode
    if (this.config.dryRun) return true;

    // Check against minimum confidence
    if (confidence < this.config.minConfidence!) return true;

    // Check against maximum risk
    const riskOrder = [
      RiskLevel.MINIMAL,
      RiskLevel.LOW,
      RiskLevel.MEDIUM,
      RiskLevel.HIGH,
      RiskLevel.CRITICAL,
    ];
    const maxRiskIndex = riskOrder.indexOf(this.config.maxRisk!);
    const currentRiskIndex = riskOrder.indexOf(risk);
    if (currentRiskIndex > maxRiskIndex) return true;

    // Check against risk-specific thresholds
    const threshold = this.confidenceThresholds.get(risk) || 0.99;
    return confidence < threshold;
  }

  /**
   * Generate reasoning explanation
   */
  private generateReasoning(
    intent: ReturnType<typeof this.analyzeIntent>,
    operations: PatchOperation[],
    confidence: number,
    risk: RiskLevel,
  ): string {
    const lines: string[] = [];

    lines.push(`Intent: ${intent.action} operation at ${intent.scope} scope`);
    lines.push(`Risk Level: ${risk} (${this.getRiskDescription(risk)})`);
    lines.push(`Confidence: ${(confidence * 100).toFixed(1)}%`);
    lines.push(`Operations: ${operations.length} planned changes`);

    if (confidence < 0.7) {
      lines.push("⚠️ Low confidence - manual review strongly recommended");
    } else if (confidence > 0.9) {
      lines.push("✅ High confidence - changes appear safe");
    }

    if (risk === RiskLevel.CRITICAL) {
      lines.push("🔴 Critical risk - affects system-critical files");
    }

    return lines.join("\n");
  }

  /**
   * Get risk level description
   */
  private getRiskDescription(risk: RiskLevel): string {
    const descriptions: Record<RiskLevel, string> = {
      [RiskLevel.MINIMAL]: "cosmetic changes only",
      [RiskLevel.LOW]: "non-breaking additions",
      [RiskLevel.MEDIUM]: "modifications to existing code",
      [RiskLevel.HIGH]: "core logic changes",
      [RiskLevel.CRITICAL]: "system-critical modifications",
    };
    return descriptions[risk];
  }

  /**
   * Execute autonomous patch with optional approval
   */
  async executeAutonomousPatch(suggestion: PatchSuggestion): Promise<{
    success: boolean;
    executed: boolean;
    message: string;
  }> {
    // Check if approval is required
    if (suggestion.plan.requiresApproval) {
      console.log("📋 Approval required for autonomous execution");
      console.log(suggestion.reasoning);

      const approval = await this.approvalSystem.requestApproval(
        suggestion.plan,
        {
          autoApprove: false,
          colorize: true,
          showLineNumbers: true,
        },
      );

      if (!approval.approved) {
        // Learn from rejection
        if (this.config.enableLearning) {
          this.recordApproval(suggestion, false);
        }

        return {
          success: false,
          executed: false,
          message: "Operation rejected by user",
        };
      }

      // Learn from approval
      if (this.config.enableLearning) {
        this.recordApproval(suggestion, true);
      }
    } else {
      console.log("✅ Auto-executing with high confidence");
      console.log(suggestion.reasoning);
    }

    // Execute the patch plan
    if (!this.config.dryRun) {
      await this.approvalSystem.executeApprovedPlan(suggestion.plan);

      return {
        success: true,
        executed: true,
        message: "Autonomous execution completed successfully",
      };
    } else {
      return {
        success: true,
        executed: false,
        message: "Dry run completed - no changes applied",
      };
    }
  }

  /**
   * Record approval decision for learning
   */
  private recordApproval(suggestion: PatchSuggestion, approved: boolean): void {
    // Record in history
    for (const operation of suggestion.plan.operations) {
      this.approvalHistory.push({
        operation,
        approved,
        confidence: suggestion.confidence,
        risk: suggestion.risk,
        timestamp: new Date().toISOString(),
      });
    }

    // Update pattern database
    const pattern = this.getOperationPattern(suggestion.plan.operations);
    const current = this.patternDatabase.get(pattern) || {
      confidence: suggestion.confidence,
      approvalRate: approved ? 1 : 0,
    };

    // Update with exponential moving average
    const alpha = this.config.learningRate!;
    const newApprovalRate =
      current.approvalRate * (1 - alpha) + (approved ? 1 : 0) * alpha;
    const newConfidence =
      current.confidence * (1 - alpha) + suggestion.confidence * alpha;

    this.patternDatabase.set(pattern, {
      confidence: newConfidence,
      approvalRate: newApprovalRate,
    });
  }

  /**
   * Process batch operations
   */
  async processBatch(requests: string[]): Promise<{
    total: number;
    succeeded: number;
    failed: number;
    results: Array<{ request: string; success: boolean; message: string }>;
  }> {
    const results: Array<{
      request: string;
      success: boolean;
      message: string;
    }> = [];
    let succeeded = 0;
    let failed = 0;

    console.log(`📦 Processing batch of ${requests.length} operations`);

    for (const request of requests) {
      try {
        // Generate suggestion
        const suggestion = await this.generatePatchSuggestion(request);

        // Execute with appropriate approval
        const result = await this.executeAutonomousPatch(suggestion);

        if (result.success) {
          succeeded++;
          results.push({
            request,
            success: true,
            message: result.message,
          });
        } else {
          failed++;
          results.push({
            request,
            success: false,
            message: result.message,
          });
        }
      } catch (error) {
        failed++;
        results.push({
          request,
          success: false,
          message: `Error: ${(error as Error).message}`,
        });
      }
    }

    return {
      total: requests.length,
      succeeded,
      failed,
      results,
    };
  }

  /**
   * Get learning statistics
   */
  getLearningStats(): {
    totalApprovals: number;
    approvalRate: number;
    confidenceImprovement: number;
    topPatterns: Array<{ pattern: string; approvalRate: number }>;
  } {
    const total = this.approvalHistory.length;
    const approved = this.approvalHistory.filter((h) => h.approved).length;
    const approvalRate = total > 0 ? approved / total : 0;

    // Calculate confidence improvement over time
    const recentHistory = this.approvalHistory.slice(-10);
    const oldHistory = this.approvalHistory.slice(0, 10);
    const recentConfidence =
      recentHistory.reduce((sum, h) => sum + h.confidence, 0) /
        recentHistory.length || 0;
    const oldConfidence =
      oldHistory.reduce((sum, h) => sum + h.confidence, 0) /
        oldHistory.length || 0;
    const confidenceImprovement = recentConfidence - oldConfidence;

    // Get top patterns
    const topPatterns = Array.from(this.patternDatabase.entries())
      .sort((a, b) => b[1].approvalRate - a[1].approvalRate)
      .slice(0, 5)
      .map(([pattern, data]) => ({
        pattern,
        approvalRate: data.approvalRate,
      }));

    return {
      totalApprovals: total,
      approvalRate,
      confidenceImprovement,
      topPatterns,
    };
  }

  /**
   * Export learning data for persistence
   */
  exportLearningData(): string {
    return JSON.stringify(
      {
        approvalHistory: this.approvalHistory,
        patternDatabase: Array.from(this.patternDatabase.entries()),
        timestamp: new Date().toISOString(),
      },
      null,
      2,
    );
  }

  /**
   * Import learning data
   */
  importLearningData(data: string): void {
    try {
      const parsed = JSON.parse(data);
      this.approvalHistory = parsed.approvalHistory || [];
      this.patternDatabase = new Map(parsed.patternDatabase || []);
    } catch (innerError) {
      console.error("Failed to import learning data:", error);
    }
  }
}
