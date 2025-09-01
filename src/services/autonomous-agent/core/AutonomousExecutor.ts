/**
 * AutonomousExecutor - Safe-by-default AI execution engine
 * Implements 3-mode execution: dry-run, diff-only, read-write
 */

import { v4 as uuid } from 'uuid';
import { PolicyEngine } from '../security/PolicyEngine';
import { SandboxExecutor } from './SandboxExecutor';
import { RollbackManager } from './RollbackManager';
import { AuditLogger } from '../security/AuditLogger';
import { ElevationManager } from '../security/ElevationManager';
import { IntentAnalyzer } from './IntentAnalyzer';
import { PlanGenerator } from './PlanGenerator';
import { RiskAssessor } from '../security/RiskAssessor';
import { LearningEngine } from '../intelligence/LearningEngine';
import { ContextAnalyzer } from '../intelligence/ContextAnalyzer';
import { OptimizationEngine } from '../intelligence/OptimizationEngine';

export type ExecutionMode = 'dry-run' | 'diff-only' | 'read-write';

export interface ExecutionOptions {
  mode?: ExecutionMode;
  feature?: string;
  autoApprove?: boolean;
  timeout?: number;
  enableNetwork?: boolean;
}

export interface OperationContext {
  operationId: string;
  planId: string;
  sessionId: string;
  mode: ExecutionMode;
  workingDirectory: string;
  timestamp: string;
  actor: 'agent' | 'user';
  policy: PolicySnapshot;
  elevationToken?: {
    token: string;
    expiresAt: string;
    approvedBy: string;
  };
  gitCommit?: string;
  gitBranch?: string;
  tags: {
    environment: 'development' | 'staging' | 'production';
    feature: string;
    priority: string;
    source: string;
    risk: 'low' | 'medium' | 'high' | 'critical' | 'blocked';
  };
}

export interface ExecutionResult {
  success: boolean;
  mode: ExecutionMode;
  operationId: string;
  planId: string;
  message: string;
  plan?: ExecutionPlan;
  preview?: Preview;
  diffs?: Diff[];
  results?: StepResult[];
  checkpoint?: Checkpoint;
  error?: string;
}

export interface ExecutionPlan {
  id: string;
  intent: string;
  description: string;
  steps: PlannedOperation[];
  reasoning: string[];
  rationale: string;
  risk: RiskAssessment;
  policyResult: PolicyResult;
  estimatedDuration: number;
}

export interface PlannedOperation {
  type: 'writeFile' | 'editFile' | 'deleteFile' | 'execCommand' | 'networkRequest';
  path?: string;
  content?: string;
  command?: string;
  url?: string;
  method?: string;
  requiresNetwork?: boolean;
  estimatedRisk: 'low' | 'medium' | 'high' | 'critical';
}

export class AutonomousExecutor {
  private readonly sessionId: string;
  private policyEngine: PolicyEngine;
  private sandboxExecutor: SandboxExecutor;
  private rollbackManager: RollbackManager;
  private auditLogger: AuditLogger;
  private elevationManager: ElevationManager;
  private intentAnalyzer: IntentAnalyzer;
  private planGenerator: PlanGenerator;
  private riskAssessor: RiskAssessor;
  private learningEngine: LearningEngine;
  private contextAnalyzer: ContextAnalyzer;
  private optimizationEngine: OptimizationEngine;

  constructor() {
    this.sessionId = uuid();
    this.policyEngine = new PolicyEngine();
    this.sandboxExecutor = new SandboxExecutor({ type: 'firejail' });
    this.rollbackManager = new RollbackManager();
    this.auditLogger = new AuditLogger();
    this.elevationManager = new ElevationManager();
    this.intentAnalyzer = new IntentAnalyzer();
    this.planGenerator = new PlanGenerator();
    this.riskAssessor = new RiskAssessor();
    this.learningEngine = new LearningEngine();
    this.contextAnalyzer = new ContextAnalyzer();
    this.optimizationEngine = new OptimizationEngine();
  }

  /**
   * Main execution entry point
   */
  async execute(
    intent: string,
    options: ExecutionOptions = {}
  ): Promise<ExecutionResult> {
    // 1. Create execution context
    const context = await this.createContext(options);
    
    // 2. Start audit logging
    await this.auditLogger.logStart(context, intent);
    
    try {
      // 3. Analyze project context (Phase 2 Intelligence)
      const projectContext = await this.contextAnalyzer.analyzeProject();
      
      // 4. Analyze intent and generate plan
      const analysis = await this.intentAnalyzer.analyze(intent);
      const plan = await this.planGenerator.generate(analysis, context);
      
      // 5. Learning prediction and plan optimization (Phase 2 Intelligence)
      const prediction = await this.learningEngine.predict(plan, context);
      const optimization = await this.optimizationEngine.optimize(
        plan, 
        context, 
        projectContext
      );
      
      // Apply optimization if it improves performance
      const finalPlan = optimization.estimatedSpeedup > 1.1 ? optimization.optimizedPlan : plan;
      
      // 6. Assess risk
      const riskAssessment = await this.riskAssessor.assess(finalPlan, context);
      finalPlan.risk = riskAssessment;
      context.tags.risk = riskAssessment.level;
      
      // 7. Evaluate policy
      const policyResult = await this.policyEngine.evaluatePlan(finalPlan, context);
      finalPlan.policyResult = policyResult;
      
      // 8. Check if blocked
      if (policyResult.risk === 'blocked' || !policyResult.allow) {
        return this.createBlockedResult(context, finalPlan, policyResult.reason);
      }
      
      // 9. Handle approval if needed
      if (policyResult.requiresApproval && context.mode === 'read-write') {
        const approval = await this.requestApproval(finalPlan, context);
        if (!approval.approved) {
          return this.createRejectedResult(context, finalPlan, 'User rejected the operation');
        }
        
        // Create elevation token
        context.elevationToken = await this.elevationManager.createToken(
          approval.approvedBy,
          600 // 10 minutes TTL
        );
      }
      
      // 10. Execute based on mode
      const result = await this.executeByMode(finalPlan, context);
      
      // 11. Learn from execution results (Phase 2 Intelligence)
      await this.learningEngine.learn(finalPlan, context, {
        approved: policyResult.allow || false,
        executed: result.success,
        successful: result.success,
        userFeedback: result.success ? 'positive' : 'negative'
      });
      
      // 12. Log success
      await this.auditLogger.logSuccess(context, result);
      
      return result;
      
    } catch (error) {
      // 10. Handle errors
      await this.handleError(error as Error, context);
      throw error;
      
    } finally {
      // 11. Clean up
      await this.cleanup(context);
    }
  }

  /**
   * Create execution context
   */
  private async createContext(options: ExecutionOptions): Promise<OperationContext> {
    const policy = await this.policyEngine.getCurrentPolicy();
    
    return {
      operationId: uuid(),
      planId: uuid(),
      sessionId: this.sessionId,
      mode: options.mode || policy.modes.default || 'dry-run',
      workingDirectory: process.cwd(),
      timestamp: new Date().toISOString(),
      actor: 'agent',
      policy,
      tags: {
        environment: (process.env.NODE_ENV as any) || 'development',
        feature: options.feature || 'general',
        priority: 'medium',
        source: 'user-request',
        risk: 'low'
      }
    };
  }

  /**
   * Execute based on mode
   */
  private async executeByMode(
    plan: ExecutionPlan,
    context: OperationContext
  ): Promise<ExecutionResult> {
    switch (context.mode) {
      case 'dry-run':
        return await this.executeDryRun(plan, context);
      
      case 'diff-only':
        return await this.executeDiffOnly(plan, context);
      
      case 'read-write':
        return await this.executeReadWrite(plan, context);
      
      default:
        throw new Error(`Unknown execution mode: ${context.mode}`);
    }
  }

  /**
   * Execute in dry-run mode (preview only)
   */
  private async executeDryRun(
    plan: ExecutionPlan,
    context: OperationContext
  ): Promise<ExecutionResult> {
    const preview = await this.generatePreview(plan);
    
    return {
      success: true,
      mode: 'dry-run',
      operationId: context.operationId,
      planId: context.planId,
      message: 'Dry-run completed. No changes were made.',
      plan,
      preview
    };
  }

  /**
   * Execute in diff-only mode (show differences)
   */
  private async executeDiffOnly(
    plan: ExecutionPlan,
    context: OperationContext
  ): Promise<ExecutionResult> {
    const diffs = await this.generateDiffs(plan);
    
    return {
      success: true,
      mode: 'diff-only',
      operationId: context.operationId,
      planId: context.planId,
      message: 'Diff generation completed. No changes were made.',
      plan,
      diffs
    };
  }

  /**
   * Execute in read-write mode (actual changes)
   */
  private async executeReadWrite(
    plan: ExecutionPlan,
    context: OperationContext
  ): Promise<ExecutionResult> {
    // 1. Create checkpoint before execution
    const checkpoint = await this.rollbackManager.createCheckpoint(
      context,
      `Executing plan: ${plan.description}`
    );
    
    try {
      // 2. Execute each step
      const results: StepResult[] = [];
      
      for (const [index, step] of plan.steps.entries()) {
        // Validate step against policy
        const stepPolicy = await this.policyEngine.evaluateOperation(step, context);
        if (!stepPolicy.allow) {
          throw new Error(`Step ${index + 1} blocked by policy: ${stepPolicy.reason}`);
        }
        
        // Execute in sandbox
        const result = await this.sandboxExecutor.execute(
          step,
          context,
          { 
            enableNetwork: step.requiresNetwork || false,
            timeout: 30000 // 30 seconds per step
          }
        );
        
        results.push(result);
        
        // Fail fast on error
        if (!result.success) {
          throw new Error(`Step ${index + 1} failed: ${result.error}`);
        }
      }
      
      // 3. Create success checkpoint
      await this.rollbackManager.createCheckpoint(
        context,
        `Successfully completed: ${plan.description}`
      );
      
      return {
        success: true,
        mode: 'read-write',
        operationId: context.operationId,
        planId: context.planId,
        message: 'Execution completed successfully.',
        plan,
        results,
        checkpoint
      };
      
    } catch (error) {
      // 4. Rollback on failure
      await this.rollbackManager.rollback(
        checkpoint.id,
        `Execution failed: ${(error as Error).message}`
      );
      
      return {
        success: false,
        mode: 'read-write',
        operationId: context.operationId,
        planId: context.planId,
        message: `Execution failed and was rolled back: ${(error as Error).message}`,
        plan,
        checkpoint,
        error: (error as Error).message
      };
    }
  }

  /**
   * Generate preview for dry-run
   */
  private async generatePreview(plan: ExecutionPlan): Promise<Preview> {
    const preview: Preview = {
      summary: plan.description,
      rationale: plan.rationale,
      steps: plan.steps.map(step => ({
        type: step.type,
        description: this.describeStep(step),
        risk: step.estimatedRisk
      })),
      estimatedDuration: plan.estimatedDuration,
      risk: plan.risk
    };
    
    return preview;
  }

  /**
   * Generate diffs for diff-only mode
   */
  private async generateDiffs(plan: ExecutionPlan): Promise<Diff[]> {
    const diffs: Diff[] = [];
    
    for (const step of plan.steps) {
      if (step.type === 'writeFile' || step.type === 'editFile') {
        const diff = await this.calculateDiff(step);
        if (diff) {
          diffs.push(diff);
        }
      }
    }
    
    return diffs;
  }

  /**
   * Calculate diff for a file operation
   */
  private async calculateDiff(step: PlannedOperation): Promise<Diff | null> {
    if (!step.path) return null;
    
    // This would integrate with git diff or similar
    return {
      path: step.path,
      type: step.type === 'writeFile' ? 'create' : 'modify',
      additions: 0,
      deletions: 0,
      changes: []
    };
  }

  /**
   * Describe a step in human-readable format
   */
  private describeStep(step: PlannedOperation): string {
    switch (step.type) {
      case 'writeFile':
        return `Create file: ${step.path}`;
      case 'editFile':
        return `Edit file: ${step.path}`;
      case 'deleteFile':
        return `Delete file: ${step.path}`;
      case 'execCommand':
        return `Execute command: ${step.command}`;
      case 'networkRequest':
        return `Network request: ${step.method} ${step.url}`;
      default:
        return 'Unknown operation';
    }
  }

  /**
   * Request user approval
   */
  private async requestApproval(
    plan: ExecutionPlan,
    context: OperationContext
  ): Promise<ApprovalResult> {
    // This would integrate with the UI or API for approval
    console.log('\n🔒 Approval Required');
    console.log(`Plan: ${plan.description}`);
    console.log(`Risk: ${plan.risk.level}`);
    console.log(`Steps: ${plan.steps.length}`);
    
    // For now, auto-reject in non-interactive mode
    return {
      approved: false,
      approvedBy: 'system',
      reason: 'Non-interactive mode - manual approval required'
    };
  }

  /**
   * Create blocked result
   */
  private createBlockedResult(
    context: OperationContext,
    plan: ExecutionPlan,
    reason: string
  ): ExecutionResult {
    return {
      success: false,
      mode: context.mode,
      operationId: context.operationId,
      planId: context.planId,
      message: `Operation blocked: ${reason}`,
      plan,
      error: reason
    };
  }

  /**
   * Create rejected result
   */
  private createRejectedResult(
    context: OperationContext,
    plan: ExecutionPlan,
    reason: string
  ): ExecutionResult {
    return {
      success: false,
      mode: context.mode,
      operationId: context.operationId,
      planId: context.planId,
      message: `Operation rejected: ${reason}`,
      plan,
      error: reason
    };
  }

  /**
   * Handle execution errors
   */
  private async handleError(error: Error, context: OperationContext): Promise<void> {
    await this.auditLogger.logError(context, error);
    
    // Additional error handling logic
    if (context.mode === 'read-write' && context.gitCommit) {
      // Attempt automatic rollback
      try {
        await this.rollbackManager.rollback(
          context.operationId,
          `Automatic rollback due to error: ${error.message}`
        );
      } catch (rollbackError) {
        console.error('Rollback failed:', rollbackError);
      }
    }
  }

  /**
   * Clean up after execution
   */
  private async cleanup(context: OperationContext): Promise<void> {
    // Revoke elevation token if exists
    if (context.elevationToken) {
      await this.elevationManager.revokeToken(context.elevationToken.token);
    }
    
    // End audit log
    await this.auditLogger.logEnd(context);
    
    // Clean up sandbox resources
    await this.sandboxExecutor.cleanup();
  }
}

// Type definitions for supporting interfaces
interface PolicySnapshot {
  id: string;
  version: string;
  modes: {
    default: ExecutionMode;
    allowedModes: ExecutionMode[];
  };
}

interface PolicyResult {
  allow: boolean;
  reason: string;
  risk: 'low' | 'medium' | 'high' | 'critical' | 'blocked';
  requiresApproval: boolean;
}

interface RiskAssessment {
  level: 'low' | 'medium' | 'high' | 'critical' | 'blocked';
  factors: string[];
  score: number;
}

interface Preview {
  summary: string;
  rationale: string;
  steps: Array<{
    type: string;
    description: string;
    risk: string;
  }>;
  estimatedDuration: number;
  risk: RiskAssessment;
}

interface Diff {
  path: string;
  type: 'create' | 'modify' | 'delete';
  additions: number;
  deletions: number;
  changes: Array<{
    line: number;
    type: 'add' | 'remove' | 'modify';
    content: string;
  }>;
}

interface StepResult {
  success: boolean;
  output?: string;
  error?: string;
  duration: number;
}

interface Checkpoint {
  id: string;
  commitHash: string;
  timestamp: string;
  description: string;
}

interface ApprovalResult {
  approved: boolean;
  approvedBy: string;
  reason: string;
}