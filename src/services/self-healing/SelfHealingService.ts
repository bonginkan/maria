/**
 * Self-Healing Service
 * Core orchestration for diagnosis, planning, execution, and verification
 */

import { logger } from "../../utils/logger";
import {
  Issue,
  IssueType,
  FixRecipe,
  HealingPlan,
  HealingPreview,
  HealResult,
  VerificationResult,
  ExecuteOptions,
  DiagnosticContext,
  StateCheckpoint,
  ActionResult,
  calculateRiskScore,
  requiresApproval,
  isSuggestionOnly,
  RISK_THRESHOLDS,
} from "./types";
import { RecipeRegistry } from "./recipes/RecipeRegistry";
import { StateManager } from "./StateManager";
import { SafetyGuard } from "./SafetyGuard";
import { AuditLogger } from "./AuditLogger";
import { FileActionExecutor } from "./executors/FileActionExecutor";
import { ConfigActionExecutor } from "./executors/ConfigActionExecutor";
import { CacheActionExecutor } from "./executors/CacheActionExecutor";
import { ShellActionExecutor } from "./executors/ShellActionExecutor";
import * as path from "path";
import * as fs from "fs/promises";

export class SelfHealingService {
  private recipeRegistry: RecipeRegistry;
  private stateManager: StateManager;
  private safetyGuard: SafetyGuard;
  private auditLogger: AuditLogger;

  // Executors
  private fileExecutor: FileActionExecutor;
  private configExecutor: ConfigActionExecutor;
  private cacheExecutor: CacheActionExecutor;
  private shellExecutor: ShellActionExecutor;

  constructor() {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    this.recipeRegistry = new RecipeRegistry();
    this.stateManager = new StateManager();
    this.safetyGuard = new SafetyGuard();
    this.auditLogger = new AuditLogger(sessionId);

    this.fileExecutor = new FileActionExecutor();
    this.configExecutor = new ConfigActionExecutor();
    this.cacheExecutor = new CacheActionExecutor();
    this.shellExecutor = new ShellActionExecutor();

    // Load default recipes
    this.recipeRegistry.loadDefaultRecipes();
  }

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    await this.stateManager.initialize();
    await this.auditLogger.initialize();
    logger.debug("SelfHealingService: Initialized");
  }

  /**
   * Diagnose system issues
   */
  async diagnose(context: DiagnosticContext): Promise<Issue[]> {
    const startTime = Date.now();
    const issues: Issue[] = [];
    const timestamp = new Date();

    await this.auditLogger.logDiagnosis("started", { diagnostics: context });

    try {
      // Check for missing .env.local
      const envPath = path.join(context.cwd, ".env.local");
      try {
        await fs.access(envPath);
      } catch {
        issues.push({
          id: `env-missing-${Date.now()}`,
          type: "CONFIG_MISSING",
          severity: "warning",
          title: "Missing Environment Configuration",
          description: ".env.local file not found",
          context: { path: envPath },
          detectedAt: timestamp,
          suggestion: "Create .env.local with API keys template",
        });
      }

      // Check for missing dependencies
      const nodeModulesPath = path.join(context.cwd, "node_modules");
      try {
        await fs.access(nodeModulesPath);
      } catch {
        issues.push({
          id: `deps-missing-${Date.now()}`,
          type: "DEPS_MISSING",
          severity: "critical",
          title: "Missing Dependencies",
          description: "node_modules directory not found",
          context: { path: nodeModulesPath },
          detectedAt: timestamp,
          suggestion: "Run package manager install command",
        });
      }

      // Check cache health
      const cachePath = path.join(process.env.HOME || "", ".maria", "cache");
      try {
        const stats = await fs.stat(cachePath);
        // Simple corruption check: if cache is over 100MB, consider it potentially corrupted
        if (stats.size > 100 * 1024 * 1024) {
          issues.push({
            id: `cache-corrupt-${Date.now()}`,
            type: "CACHE_CORRUPT",
            severity: "warning",
            title: "Corrupted Cache",
            description: "Cache size exceeds healthy limits",
            context: { path: cachePath, size: stats.size },
            detectedAt: timestamp,
            suggestion: "Clear and rebuild cache",
          });
        }
      } catch {
        // Cache doesn't exist, which is fine
      }

      // Check file permissions (if .env.local exists)
      try {
        const stats = await fs.stat(envPath);
        const mode = (stats.mode & parseInt("777", 8)).toString(8);
        if (mode !== "600" && mode !== "644") {
          issues.push({
            id: `perm-error-${Date.now()}`,
            type: "PERMISSION_ERROR",
            severity: "warning",
            title: "Insecure File Permissions",
            description: ".env.local has insecure permissions",
            context: { path: envPath, currentMode: mode, expectedMode: "600" },
            detectedAt: timestamp,
            suggestion: "Set file permissions to 600",
          });
        }
      } catch {
        // File doesn't exist, already reported above
      }

      logger.info(`Diagnosis complete: ${issues.length} issues found`);

      await this.auditLogger.logDiagnosis("completed", {
        issues,
        executionTime: Date.now() - startTime,
      });
    } catch (error) {
      logger.error("Diagnosis failed:", error);

      await this.auditLogger.logDiagnosis("failed", {
        error: error instanceof Error ? error.message : "Unknown error",
        executionTime: Date.now() - startTime,
      });

      throw error;
    }

    return issues;
  }

  /**
   * Create healing plan from issues
   */
  async plan(issues: Issue[]): Promise<HealingPlan> {
    const startTime = Date.now();
    const recipes: FixRecipe[] = [];
    const processedRecipeIds = new Set<string>();

    await this.auditLogger.logPlanning("started", { issues });

    try {
      // Find matching recipes for each issue
      for (const issue of issues) {
        const matchingRecipes = this.recipeRegistry.findByIssue(issue);
        for (const recipe of matchingRecipes) {
          if (!processedRecipeIds.has(recipe.id)) {
            recipes.push(recipe);
            processedRecipeIds.add(recipe.id);
          }
        }
      }

      // Sort by risk (low to high)
      const sortedRecipes = this.recipeRegistry.sortByRisk(recipes);

      // Resolve dependencies
      const resolvedRecipes =
        this.recipeRegistry.resolveDependencies(sortedRecipes);

      // Calculate total risk
      const totalRiskScore = Math.min(
        1.0,
        resolvedRecipes.reduce((sum, r) => sum + r.risk.score, 0),
      );

      // Build complete healing plan
      const plan: HealingPlan = {
        id: `plan-${Date.now()}`,
        issueIds: issues.map((i) => i.id),
        recipeIds: resolvedRecipes.map((r) => r.id),
        createdAt: new Date(),
        actions: resolvedRecipes.flatMap((r) => r.actions.apply),
        risk: {
          impact:
            totalRiskScore > 0.5
              ? "high"
              : totalRiskScore > 0.2
                ? "medium"
                : "low",
          probability: "possible",
          score: totalRiskScore,
        },
        estimatedDuration: resolvedRecipes.reduce(
          (sum, r) => sum + r.timeout,
          0,
        ),
        requiresApproval: resolvedRecipes.some((r) => r.requiresApproval),
      };

      // Validate plan with safety guard
      const validation = this.safetyGuard.validatePlan(plan);
      if (!validation.valid) {
        const error = new Error(
          `Plan validation failed: ${validation.violations.join(", ")}`,
        );
        await this.auditLogger.logPlanning("failed", {
          issues,
          error: error.message,
          executionTime: Date.now() - startTime,
        });
        throw error;
      }

      logger.info(
        `Healing plan created with ${resolvedRecipes.length} recipes`,
      );

      await this.auditLogger.logPlanning("completed", {
        issues,
        plan,
        recipesUsed: resolvedRecipes.map((r) => r.id),
        executionTime: Date.now() - startTime,
      });

      return plan;
    } catch (error) {
      await this.auditLogger.logPlanning("failed", {
        issues,
        error: error instanceof Error ? error.message : "Unknown error",
        executionTime: Date.now() - startTime,
      });
      throw error;
    }
  }

  /**
   * Preview healing plan without executing
   */
  async preview(plan: HealingPlan): Promise<HealingPreview> {
    const preview: HealingPreview = {
      plan,
      actions: [],
      wouldApply: 0,
      wouldSkip: 0,
    };

    for (const recipe of plan.recipes) {
      const changes = [];

      // Simulate dry-run actions to gather changes
      for (const action of recipe.actions.dryRun) {
        if (action.type.startsWith("file:")) {
          changes.push({
            type: "modify" as const,
            path: action.args.path,
            preview: `Would ${action.type}: ${action.args.path}`,
          });
        }
      }

      preview.actions.push({
        recipe: recipe.id,
        description: recipe.description,
        risk: recipe.risk,
        changes,
      });

      if (recipe.risk.score <= RISK_THRESHOLDS.AUTO_EXECUTE) {
        preview.wouldApply++;
      } else {
        preview.wouldSkip++;
      }
    }

    return preview;
  }

  /**
   * Execute healing plan
   */
  async execute(
    plan: HealingPlan,
    options: ExecuteOptions = {},
  ): Promise<HealResult> {
    const {
      dryRun = true,
      riskLevel = RISK_THRESHOLDS.AUTO_EXECUTE,
      force = false,
      timeout = 30000,
    } = options;

    const result: HealResult = {
      success: true,
      message: "Healing plan executed successfully",
      details: {
        planId: plan.id,
        executedAt: new Date(),
        recipesApplied: [],
        recipesFailed: [],
        recipesSkipped: [],
        actions: [],
        duration: 0,
      },
    };

    const startTime = Date.now();
    this.safetyGuard.startExecution();

    await this.auditLogger.logExecution("started", {
      plan,
      userApproval: force,
    });

    // Create checkpoint if not dry-run
    let checkpointId: string | undefined;
    if (!dryRun) {
      checkpointId = await this.stateManager.createCheckpoint(
        plan.id,
        `Pre-execution checkpoint for ${plan.id}`,
        plan.actions,
        plan.risk.score,
      );
      result.details.checkpointId = checkpointId;
    }

    try {
      // Execute actions from the plan
      for (const action of plan.actions) {
        // Check safety constraints
        if (this.safetyGuard.isTimeoutExceeded()) {
          result.success = false;
          result.message = "Execution timeout exceeded";
          break;
        }

        const actionValidation = this.safetyGuard.validateAction(action);
        if (!actionValidation.valid) {
          logger.warn(
            `Action validation failed: ${actionValidation.violations.join(", ")}`,
          );
          result.details.recipesSkipped.push(action.type);
          continue;
        }

        // Execute action with timeout
        try {
          const actionTimeout = this.safetyGuard.getActionTimeout();
          const actionResult = await this.executeActionWithTimeout(
            action,
            { dryRun },
            actionTimeout,
          );

          this.safetyGuard.recordAction(action);
          result.details.actions.push(actionResult);

          if (actionResult.success) {
            result.details.recipesApplied.push(action.type);
          } else {
            result.details.recipesFailed.push(action.type);
            result.success = false;
          }
        } catch (error) {
          logger.error(`Action ${action.type} failed:`, error);
          result.details.recipesFailed.push(action.type);
          result.success = false;

          // Rollback on failure if not dry-run
          if (!dryRun && checkpointId) {
            await this.stateManager.rollback(checkpointId);
          }

          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          await this.auditLogger.logExecution("failed", {
            plan,
            error: errorMessage,
            executionTime: Date.now() - startTime,
          });

          throw error;
        }
      }
    } finally {
      result.details.duration = Date.now() - startTime;
      this.safetyGuard.reset();

      // Log audit entry
      const status = result.success ? "completed" : "failed";
      await this.auditLogger.logExecution(status, {
        plan,
        actions: plan.actions,
        results: result.details.actions,
        checkpointId,
        executionTime: result.details.duration,
      });
    }

    return result;
  }

  /**
   * Execute action with timeout
   */
  private async executeActionWithTimeout(
    action: any,
    options: { dryRun: boolean },
    timeout: number,
  ): Promise<ActionResult> {
    const startTime = Date.now();

    try {
      const result = await Promise.race([
        this.executeAction(action, options),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error("Action timeout")), timeout);
        }),
      ]);

      return {
        success: true,
        action,
        duration: Date.now() - startTime,
        output: result,
      };
    } catch (error) {
      return {
        success: false,
        action,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Execute a single action
   */
  private async executeAction(
    action: any,
    options: { dryRun: boolean },
  ): Promise<any> {
    // Route to appropriate executor
    const [domain, operation] = action.type.split(":");

    switch (domain) {
      case "file":
        return this.fileExecutor.execute(action, options);

      case "config":
        return this.configExecutor.execute(action, options);

      case "cache":
        return this.cacheExecutor.execute(action, options);

      case "shell":
        return this.shellExecutor.execute(action, options);

      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  /**
   * Verify healing results
   */
  async verify(result: HealResult): Promise<VerificationResult> {
    const verification: VerificationResult = {
      success: true,
      issuesResolved: [],
      issuesRemaining: [],
      newIssues: [],
      verificationActions: [],
    };

    // Re-run diagnosis to check if issues are resolved
    const context: DiagnosticContext = {
      cwd: process.cwd(),
    };

    const currentIssues = await this.diagnose(context);

    // Compare with original issues
    // This is simplified - in production would track issue IDs
    verification.issuesRemaining = currentIssues.map((i) => i.id);
    verification.success = currentIssues.length === 0;

    return verification;
  }

  /**
   * Rollback to checkpoint
   */
  async rollback(checkpointId: string): Promise<HealResult> {
    const startTime = Date.now();

    await this.auditLogger.logRollback("started", { checkpointId });

    try {
      const result = await this.stateManager.rollback(checkpointId);
      logger.info(`Rolled back to checkpoint ${checkpointId}`);

      await this.auditLogger.logRollback("completed", {
        checkpointId,
        results: result,
        executionTime: Date.now() - startTime,
      });

      return result;
    } catch (error) {
      logger.error("Rollback failed:", error);

      await this.auditLogger.logRollback("failed", {
        checkpointId,
        error: error instanceof Error ? error.message : "Unknown error",
        executionTime: Date.now() - startTime,
      });

      throw error;
    }
  }

  /**
   * Create state checkpoint
   */
  async createCheckpoint(description: string): Promise<string> {
    return this.stateManager.createCheckpoint(
      `manual_${Date.now()}`,
      description,
      [],
      0.0,
    );
  }

  /**
   * Get session summary
   */
  async getSessionSummary() {
    return this.auditLogger.getSessionSummary();
  }

  /**
   * List available checkpoints
   */
  async listCheckpoints() {
    return this.stateManager.listCheckpoints();
  }
}
