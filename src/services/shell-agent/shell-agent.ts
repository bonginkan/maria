// src/services/shell-agent/shell-agent.ts
import * as fs from "fs/promises";
import {
  ShellExecutor,
  ExecResult,
  createSecureExecutor,
} from "./shell-executor.js";
import {
  ShellPlan,
  NLRequest,
  _validatePlan,
  createSafePlan,
  _NLRequestZ,
} from "./shell-plan.js";
import { assertSafeTokensInPlan } from "./shell-plan.js";
import { PatchEngine, PatchPlan, PatchOperation } from "./patch-engine.js";
import { ApprovalSystem, ApprovalConfig } from "./approval-system.js";
import {
  AutonomousEngine,
  _AutonomousConfig,
  PatchSuggestion,
} from "./autonomous-engine.js";
import { AIPatchGenerator, GenerationContext } from "./ai-patch-generator.js";

/**
 * Configuration for ShellAgent
 */
export interface ShellAgentConfig {
  workspaceRoot: string;
  phase?: "A" | "B" | "C"; // Current implementation phase
  enableEdit?: boolean; // Phase B+ feature
  autoApprove?: boolean; // Phase C feature
  maxExecutionTime?: number; // Custom timeout
  enableLearning?: boolean; // Phase C learning feature
  minConfidence?: number; // Phase C confidence threshold
  batchMode?: boolean; // Phase C batch processing
}

/**
 * Result from ShellAgent execution
 */
export interface ShellAgentResult {
  success: boolean;
  plan: ShellPlan;
  execution: ExecResult;
  formatted: string; // Combined human-readable output
  metadata: {
    phase: string;
    intent: string;
    planGenerationTime: number;
    executionTime: number;
    securityLevel: "safe" | "moderate" | "restricted";
  };
}

/**
 * Main Shell Agent class for natural language to shell operation conversion
 * Implements Phase A (read-only) functionality with multi-layer security
 */
export class ShellAgent {
  private config: Required<ShellAgentConfig>;
  private executor: ShellExecutor;
  private patchEngine: PatchEngine;
  private approvalSystem: ApprovalSystem;
  private autonomousEngine?: AutonomousEngine;
  private aiGenerator?: AIPatchGenerator;

  constructor(config: ShellAgentConfig) {
    this.config = {
      workspaceRoot: config.workspaceRoot,
      phase: config.phase ?? "A",
      enableEdit: config.enableEdit ?? false,
      autoApprove: config.autoApprove ?? false,
      maxExecutionTime: config.maxExecutionTime ?? 10000,
      enableLearning: config.enableLearning ?? false,
      minConfidence: config.minConfidence ?? 0.8,
      batchMode: config.batchMode ?? false,
    };

    // Create secure executor
    this.executor = createSecureExecutor(this.config.workspaceRoot);

    // Initialize Phase B components
    this.patchEngine = new PatchEngine();
    this.approvalSystem = new ApprovalSystem();

    // Initialize Phase C components if enabled
    if (this.config.phase === "C") {
      this.autonomousEngine = new AutonomousEngine({
        enableLearning: this.config.enableLearning,
        minConfidence: this.config.minConfidence,
        batchMode: this.config.batchMode,
        autoApprove: this.config.autoApprove,
      });
      this.aiGenerator = new AIPatchGenerator();
    }

    // Phase validation
    if (this.config.phase === "A" && this.config.enableEdit) {
      throw new Error("Phase A does not support edit operations");
    }
  }

  /**
   * Execute natural language request with full security validation
   */
  async run(request: NLRequest): Promise<ShellAgentResult> {
    const startTime = Date.now();

    // Validate input request
    const validatedRequest = _NLRequestZ.parse(request);

    try {
      // Generate execution plan from natural language
      const planStartTime = Date.now();
      const plan = await this.generatePlan(validatedRequest);
      const planGenerationTime = Date.now() - planStartTime;

      // Execute plan with security constraints
      const execution = await this.executor.execute(plan, {
        dryRun: validatedRequest.dryRun ?? false,
        enableEdit: this.config.enableEdit,
        autoApprove: this.config.autoApprove,
        timeLimit: this.config.maxExecutionTime,
      });

      // Format combined result
      const formatted = this.formatResult(plan, execution, validatedRequest);

      return {
        success: execution.success,
        plan,
        execution,
        formatted,
        metadata: {
          phase: this.config.phase,
          intent: plan.intent,
          planGenerationTime,
          executionTime: execution.totalExecutionTime,
          securityLevel: execution.metadata.securityLevel,
        },
      };
    } catch (error) {
      // Handle planning or execution errors
      const errorPlan = createSafePlan("other", [], { readOnly: true });

      return {
        success: false,
        plan: errorPlan,
        execution: {
          success: false,
          results: [],
          totalExecutionTime: Date.now() - startTime,
          formatted: `❌ Shell operation failed: ${(error as Error).message}`,
          metadata: {
            timestamp: new Date().toISOString(),
            securityLevel: "restricted",
            resourceUsage: {
              filesRead: 0,
              bytesProcessed: 0,
              operationsExecuted: 0,
            },
          },
        },
        formatted: `❌ Shell operation failed: ${(error as Error).message}`,
        metadata: {
          phase: this.config.phase,
          intent: "error",
          planGenerationTime: 0,
          executionTime: Date.now() - startTime,
          securityLevel: "restricted",
        },
      };
    }
  }

  /**
   * Generate execution plan from natural language
   * Currently uses rule-based approach for Phase A
   */
  private async generatePlan(request: NLRequest): Promise<ShellPlan> {
    const text = request.text.toLowerCase().trim();

    // Rule-based intent classification for Phase A
    if (this.isReadIntent(text)) {
      return this.createReadPlan(request);
    } else if (this.isSearchIntent(text)) {
      return this.createSearchPlan(request);
    } else if (this.isEditIntent(text)) {
      if (this.config.phase === "A") {
        throw new Error(
          "Edit operations are not available in Phase A (read-only mode)",
        );
      }
      return this.createEditPlan(request);
    } else {
      throw new Error(
        "Could not understand the request. Please use clearer language for file operations.",
      );
    }
  }

  /**
   * Classify if request is a read operation
   */
  private isReadIntent(text: string): boolean {
    const readKeywords = [
      "show",
      "display",
      "read",
      "view",
      "see",
      "look at",
      "check",
      "list",
      "contents",
      "files",
      "directories",
      "dir",
      "表示",
      "見る",
      "確認",
      "読む",
      "ファイル",
      "ディレクトリ",
    ];

    return readKeywords.some((keyword) => text.includes(keyword));
  }

  /**
   * Classify if request is a search operation
   */
  private isSearchIntent(text: string): boolean {
    const searchKeywords = [
      "search",
      "find",
      "grep",
      "look for",
      "contains",
      "match",
      "pattern",
      "locate",
      "where",
      "検索",
      "探す",
      "含む",
      "みつける",
    ];

    return searchKeywords.some((keyword) => text.includes(keyword));
  }

  /**
   * Classify if request is an edit operation
   */
  private isEditIntent(text: string): boolean {
    const editKeywords = [
      "edit",
      "change",
      "modify",
      "update",
      "replace",
      "fix",
      "correct",
      "alter",
      "write",
      "編集",
      "変更",
      "修正",
      "更新",
      "書く",
    ];

    return editKeywords.some((keyword) => text.includes(keyword));
  }

  /**
   * Create execution plan for read operations
   */
  private createReadPlan(request: NLRequest): ShellPlan {
    const text = request.text.toLowerCase();

    // Extract target from natural language
    let target = "."; // Default to current directory

    // Simple pattern matching for common file/directory references
    if (text.includes("readme")) target = "README.md";
    else if (text.includes("package.json")) target = "package.json";
    else if (text.includes("src")) target = "src";
    else if (text.includes("test")) target = "test";
    else if (text.includes("tsconfig")) target = "tsconfig.json";

    // Extract specific paths in quotes
    const quotedMatch = text.match(/["']([^"']+)["']/);
    if (quotedMatch) target = quotedMatch[1];

    const plan = createSafePlan(
      "read",
      [
        {
          op: "read",
          args: [target],
          comment: `Reading: ${target}`,
          previewLimit: 5000,
        },
      ],
      {
        readOnly: true,
        allowPaths: [
          "src/**",
          "README.md",
          "package.json",
          "tsconfig.json",
          ".",
        ],
        denyPaths: [".git/**", "node_modules/**"],
      },
    );

    // Security validation
    assertSafeTokensInPlan(plan);

    return plan;
  }

  /**
   * Create execution plan for search operations
   */
  private createSearchPlan(request: NLRequest): ShellPlan {
    const text = request.text;

    // Extract search pattern and target
    let pattern = "export"; // Default pattern
    let target = "."; // Default to current directory

    // Pattern extraction from natural language
    const quotedPatterns = text.match(/["']([^"']+)["']/g);
    if (quotedPatterns && quotedPatterns.length >= 1) {
      pattern = quotedPatterns[0].slice(1, -1); // Remove quotes
    } else {
      // Simple keyword extraction
      if (text.includes("export")) pattern = "export";
      else if (text.includes("import")) pattern = "import";
      else if (text.includes("function")) pattern = "function";
      else if (text.includes("class")) pattern = "class";
    }

    // Target extraction
    if (text.includes("src")) target = "src";
    else if (text.includes("test")) target = "test";

    const plan = createSafePlan(
      "search",
      [
        {
          op: "search",
          args: [pattern, target],
          comment: `Searching for '${pattern}' in ${target}`,
          previewLimit: 10000,
        },
      ],
      {
        readOnly: true,
        allowPaths: ["src/**", "test/**", "."],
        denyPaths: [".git/**", "node_modules/**"],
      },
    );

    // Security validation
    assertSafeTokensInPlan(plan);

    return plan;
  }

  /**
   * Create execution plan for edit operations (Phase B)
   */
  private createEditPlan(request: NLRequest): ShellPlan {
    if (this.config.phase === "A") {
      throw new Error("Edit operations require Phase B or higher");
    }

    const text = request.text.toLowerCase();

    // For Phase B, create a plan that will generate a patch
    const plan = createSafePlan(
      "edit",
      [
        {
          op: "patch",
          args: [text],
          comment: `Generating patch for: ${text}`,
          previewLimit: 0,
        },
      ],
      {
        readOnly: false,
        allowPaths: ["src/**", "*.ts", "*.js", "*.json"],
        denyPaths: [".git/**", "node_modules/**", "*.lock"],
      },
    );

    return plan;
  }

  /**
   * Execute patch operation with approval (Phase B)
   */
  async executePatch(request: NLRequest): Promise<{
    success: boolean;
    message: string;
    patchPlan?: PatchPlan;
  }> {
    if (this.config.phase === "A") {
      return {
        success: false,
        message: "Patch operations require Phase B or higher",
      };
    }

    try {
      // Generate patch plan from natural language
      const patchPlan = await this.generatePatchPlan(request);

      // Request approval if not auto-approved
      const approvalConfig: ApprovalConfig = {
        autoApprove: this.config.autoApprove,
        colorize: true,
        showLineNumbers: true,
      };

      const result = await this.approvalSystem.approveAndExecute(
        patchPlan,
        approvalConfig,
      );

      return {
        success: result.success,
        message: result.message,
        patchPlan: result.success ? patchPlan : undefined,
      };
    } catch (innerError) {
      return {
        success: false,
        message: `Patch operation failed: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Generate patch plan from natural language (Phase B)
   */
  private async generatePatchPlan(request: NLRequest): Promise<PatchPlan> {
    const text = request.text.toLowerCase();
    const operations: PatchOperation[] = [];

    // Parse natural language to determine patch operations
    if (text.includes("replace") || text.includes("change")) {
      // Find/replace operation
      const findMatch = text.match(/replace\s+["']([^"']+)["']/);
      const withMatch = text.match(/with\s+["']([^"']+)["']/);
      const fileMatch = text.match(/in\s+([^\s]+)/);

      if (findMatch && withMatch && fileMatch) {
        operations.push({
          type: "find_replace",
          file: fileMatch[1],
          find: findMatch[1],
          replace: withMatch[1],
        });
      }
    } else if (text.includes("add") || text.includes("append")) {
      // Append operation
      const contentMatch = text.match(/["']([^"']+)["']/);
      const fileMatch = text.match(/to\s+([^\s]+)/);

      if (contentMatch && fileMatch) {
        operations.push({
          type: "append",
          file: fileMatch[1],
          content: contentMatch[1] + "\n",
        });
      }
    } else if (text.includes("delete") || text.includes("remove")) {
      // Delete lines operation
      const linesMatch = text.match(/lines?\s+(\d+)(?:-(\d+))?/);
      const fileMatch = text.match(/from\s+([^\s]+)/);

      if (linesMatch && fileMatch) {
        operations.push({
          type: "delete_lines",
          file: fileMatch[1],
          startLine: parseInt(linesMatch[1]),
          endLine: parseInt(linesMatch[2] || linesMatch[1]),
        });
      }
    }

    // Create patch plan
    const patchPlan: PatchPlan = {
      description: `Patch operation: ${request.text}`,
      operations,
      requiresApproval: !this.config.autoApprove,
      transactionId: `patch-${Date.now()}`,
    };

    return patchPlan;
  }

  /**
   * Execute autonomous operation (Phase C)
   */
  async executeAutonomous(request: NLRequest): Promise<{
    success: boolean;
    message: string;
    suggestion?: PatchSuggestion;
    learningStats?: any;
  }> {
    if (this.config.phase !== "C") {
      return {
        success: false,
        message: "Autonomous execution requires Phase C",
      };
    }

    if (!this.autonomousEngine || !this.aiGenerator) {
      return {
        success: false,
        message: "Autonomous components not initialized",
      };
    }

    try {
      // Analyze current context
      const context: GenerationContext = {
        targetDescription: request.text,
        constraints: [
          "maintain backward compatibility",
          "follow existing code style",
        ],
      };

      // If file is specified, analyze it
      const fileMatch = request.text.match(/(?:in|from|to)\s+([^\s]+\.\w+)/);
      if (fileMatch) {
        const _filePath = fileMatch[1];
        try {
          const content = await fs.readFile(_filePath, "utf-8");
          context.currentCode = content;
          context.codeAnalysis = await this.aiGenerator.analyzeCode(
            _filePath,
            content,
          );
        } catch (error) {
          // File might not exist yet, that's okay
        }
      }

      // Generate AI-driven _modification
      const _modification =
        await this.aiGenerator.generateModification(context);

      // Convert to patch suggestion
      const suggestion = await this.autonomousEngine.generatePatchSuggestion(
        request.text,
        context,
      );

      // Execute with autonomous approval logic
      const result =
        await this.autonomousEngine.executeAutonomousPatch(suggestion);

      // Get learning statistics if enabled
      const learningStats = this.config.enableLearning
        ? this.autonomousEngine.getLearningStats()
        : undefined;

      return {
        success: result.success,
        message: result.message,
        suggestion,
        learningStats,
      };
    } catch (innerError) {
      return {
        success: false,
        message: `Autonomous execution failed: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Execute batch operations (Phase C)
   */
  async executeBatch(requests: string[]): Promise<{
    success: boolean;
    total: number;
    succeeded: number;
    failed: number;
    results: Array<{ request: string; success: boolean; message: string }>;
  }> {
    if (this.config.phase !== "C") {
      return {
        success: false,
        total: requests.length,
        succeeded: 0,
        failed: requests.length,
        results: requests.map((r) => ({
          request: r,
          success: false,
          message: "Batch processing requires Phase C",
        })),
      };
    }

    if (!this.autonomousEngine) {
      return {
        success: false,
        total: requests.length,
        succeeded: 0,
        failed: requests.length,
        results: requests.map((r) => ({
          request: r,
          success: false,
          message: "Autonomous engine not initialized",
        })),
      };
    }

    // Process batch with autonomous engine
    const batchResult = await this.autonomousEngine.processBatch(requests);

    return {
      success: batchResult.succeeded > 0,
      ...batchResult,
    };
  }

  /**
   * Export learning data (Phase C)
   */
  exportLearning(): string | null {
    if (this.config.phase !== "C" || !this.autonomousEngine) {
      return null;
    }
    return this.autonomousEngine.exportLearningData();
  }

  /**
   * Import learning data (Phase C)
   */
  importLearning(data: string): boolean {
    if (this.config.phase !== "C" || !this.autonomousEngine) {
      return false;
    }
    try {
      this.autonomousEngine.importLearningData(data);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Format combined result for user display
   */
  private formatResult(
    plan: ShellPlan,
    execution: ExecResult,
    request: NLRequest,
  ): string {
    const lines: string[] = [];

    // Header with operation summary
    lines.push(
      `🐚 Shell Agent (Phase ${this.config.phase}) - ${plan.intent.toUpperCase()} Operation`,
    );
    lines.push(`📝 Request: "${request.text}"`);
    lines.push(`⏱️  Executed in ${execution.totalExecutionTime}ms`);
    lines.push("");

    // Plan details
    lines.push("📋 Execution Plan:");
    for (const [i, step] of plan.steps.entries()) {
      lines.push(`  ${i + 1}. ${step.op}: ${step.args.join(" ")}`);
      if (step.comment) {
        lines.push(`     └─ ${step.comment}`);
      }
    }
    lines.push("");

    // Security info
    lines.push("🔒 Security Status:");
    lines.push(`  • Level: ${execution.metadata.securityLevel}`);
    lines.push(`  • Read-only: ${plan.safety.readOnly ? "Yes" : "No"}`);
    lines.push(
      `  • Resources: ${execution.metadata.resourceUsage.filesRead} files, ${execution.metadata.resourceUsage.bytesProcessed} bytes`,
    );
    lines.push("");

    // Execution results
    if (execution.success) {
      lines.push("✅ Results:");
      lines.push(execution.formatted);
    } else {
      lines.push("❌ Execution Failed:");
      lines.push(execution.formatted);
    }

    return lines.join("\n");
  }
}

/**
 * Factory function for creating ShellAgent instances
 */
export function createShellAgent(workspaceRoot: string): ShellAgent {
  return new ShellAgent({
    workspaceRoot,
    phase: "A", // Phase A (read-only) for initial implementation
    enableEdit: false,
    autoApprove: false,
  });
}

/**
 * Convenience function for quick shell operations
 */
export async function executeShellCommand(
  workspaceRoot: string,
  naturalLanguageRequest: string,
): Promise<ShellAgentResult> {
  const agent = createShellAgent(workspaceRoot);

  return await agent.run({
    text: naturalLanguageRequest,
    tenantId: "default",
    userId: "default",
    cwd: workspaceRoot,
  });
}
