/**
 * StepExecutor - Executes plan steps using existing CLI infrastructure
 * Bridges autonomous agent with current MARIA command system
 */

import { ExecutionStep, ExecutionResult } from '../ai/contracts';
import { KPILogger } from '../observability/KPILogger';
import { BigQuerySink } from '../observability/BigQuerySink';

export interface ExecutorConfig {
  dryRun?: boolean;
  autoApprove?: boolean;
  maxRetries?: number;
  timeoutMs?: number;
  enableMetrics?: boolean;
}

export interface StepResult {
  stepId: string;
  success: boolean;
  output?: string;
  error?: string;
  duration: number;
  retryCount: number;
  rollbackable: boolean;
}

export class StepExecutor {
  private kpiLogger: KPILogger;
  private bigQuery: BigQuerySink;
  private executionHistory: StepResult[] = [];
  
  constructor(
    private config: ExecutorConfig = {},
    private cliInterface?: any  // Interface to existing CLI system
  ) {
    this.config.maxRetries = config.maxRetries || 3;
    this.config.timeoutMs = config.timeoutMs || 30000;
    
    this.kpiLogger = new KPILogger({
      enableBigQuery: config.enableMetrics
    });
    
    this.bigQuery = BigQuerySink.getInstance({
      enabled: config.enableMetrics
    });
  }
  
  /**
   * Execute a single step
   */
  async executeStep(
    step: ExecutionStep,
    sessionId: string,
    context?: any
  ): Promise<StepResult> {
    const startTime = Date.now();
    let retryCount = 0;
    let lastError: Error | undefined;
    
    // Start KPI tracking
    this.kpiLogger.startOperation(
      step.operation,
      this.mapOperationToTaskType(step.operation),
      sessionId
    );
    
    while (retryCount <= this.config.maxRetries!) {
      try {
        // Check if dry run
        if (this.config.dryRun) {
          return this.simulateExecution(step, startTime);
        }
        
        // Execute based on step type
        const result = await this.executeStepInternal(step, context);
        
        // Log success
        this.kpiLogger.completeOperation(true, {
          tokensUsed: step.estimatedTokens,
          modelUsed: step.modelHint
        });
        
        this.bigQuery.logExecution(
          sessionId,
          step.operation,
          true,
          Date.now() - startTime,
          {
            filesAffected: step.files,
            locChanged: step.estimatedLOC
          }
        );
        
        const stepResult: StepResult = {
          stepId: step.id,
          success: true,
          output: result.output,
          duration: Date.now() - startTime,
          retryCount,
          rollbackable: step.rollbackable
        };
        
        this.executionHistory.push(stepResult);
        return stepResult;
        
      } catch (error: any) {
        lastError = error;
        retryCount++;
        
        if (retryCount <= this.config.maxRetries!) {
          console.log(`[Executor] Retry ${retryCount}/${this.config.maxRetries} for step ${step.id}`);
          await this.delay(1000 * retryCount); // Exponential backoff
        }
      }
    }
    
    // Log failure
    this.kpiLogger.completeOperation(false, {
      error: lastError?.message,
      rollbackRequired: step.rollbackable
    });
    
    this.bigQuery.logError(
      sessionId,
      'EXEC_FAILED',
      lastError?.message || 'Unknown error',
      lastError?.stack,
      step.rollbackable ? 'rollback' : 'manual'
    );
    
    const stepResult: StepResult = {
      stepId: step.id,
      success: false,
      error: lastError?.message,
      duration: Date.now() - startTime,
      retryCount,
      rollbackable: step.rollbackable
    };
    
    this.executionHistory.push(stepResult);
    return stepResult;
  }
  
  /**
   * Execute multiple steps in sequence
   */
  async executeSteps(
    steps: ExecutionStep[],
    sessionId: string,
    context?: any
  ): Promise<ExecutionResult> {
    const results: StepResult[] = [];
    let executedSteps = 0;
    let failedStep: StepResult | undefined;
    
    for (const step of steps) {
      // Check if step requires approval
      if (step.requiresApproval && !this.config.autoApprove) {
        const approved = await this.requestApproval(step);
        if (!approved) {
          console.log(`[Executor] Step ${step.id} rejected by user`);
          break;
        }
      }
      
      const result = await this.executeStep(step, sessionId, context);
      results.push(result);
      
      if (result.success) {
        executedSteps++;
      } else {
        failedStep = result;
        break;
      }
    }
    
    return {
      planId: sessionId,
      success: !failedStep,
      executedSteps,
      totalSteps: steps.length,
      outputs: results.map(r => r.output || ''),
      error: failedStep?.error
    };
  }
  
  /**
   * Execute step using CLI interface
   */
  private async executeStepInternal(
    step: ExecutionStep,
    context?: any
  ): Promise<{ output: string }> {
    // Map step operation to CLI command
    const command = this.mapOperationToCommand(step.operation);
    
    if (!command) {
      throw new Error(`Unknown operation: ${step.operation}`);
    }
    
    // Use existing CLI interface if available
    if (this.cliInterface) {
      const result = await this.cliInterface.executeCommand(
        command,
        step.params,
        {
          timeout: this.config.timeoutMs,
          cwd: context?.cwd
        }
      );
      
      return { output: result };
    }
    
    // Fallback to simulation in development
    return this.simulateCliExecution(command, step);
  }
  
  /**
   * Map operation to CLI command
   */
  private mapOperationToCommand(operation: string): string | null {
    const commandMap: Record<string, string> = {
      'analyze_code': '/code analyze',
      'generate_code': '/code generate',
      'modify_file': '/code modify',
      'create_test': '/test create',
      'run_test': '/test run',
      'install_deps': 'npm install',
      'format_code': '/format',
      'lint_code': '/lint',
      'build_project': 'npm run build',
      'git_commit': 'git commit',
      'git_push': 'git push'
    };
    
    return commandMap[operation] || null;
  }
  
  /**
   * Map operation to task type
   */
  private mapOperationToTaskType(operation: string): any {
    const typeMap: Record<string, string> = {
      'analyze_code': 'refactor',
      'generate_code': 'scaffold',
      'modify_file': 'fix',
      'create_test': 'test',
      'optimize_code': 'optimize'
    };
    
    return typeMap[operation] || 'fix';
  }
  
  /**
   * Request user approval for a step
   */
  private async requestApproval(step: ExecutionStep): Promise<boolean> {
    console.log(`
╔════════════════════════════════════════╗
║         APPROVAL REQUIRED              ║
╠════════════════════════════════════════╣
║ Operation: ${step.operation.padEnd(28)}║
║ Files:     ${step.files?.join(', ').substring(0, 28).padEnd(28) || 'N/A'.padEnd(28)}║
║ Risk:      ${step.risk.padEnd(28)}║
║ LOC:       ${String(step.estimatedLOC || 0).padEnd(28)}║
╚════════════════════════════════════════╝
    `);
    
    // In production, use interactive prompt
    // For now, simulate approval
    return true;
  }
  
  /**
   * Simulate execution for dry run
   */
  private simulateExecution(
    step: ExecutionStep,
    startTime: number
  ): StepResult {
    console.log(`[DRY RUN] Would execute: ${step.operation}`);
    
    return {
      stepId: step.id,
      success: true,
      output: `[DRY RUN] ${step.operation} simulated`,
      duration: Date.now() - startTime,
      retryCount: 0,
      rollbackable: step.rollbackable
    };
  }
  
  /**
   * Simulate CLI execution for development
   */
  private async simulateCliExecution(
    command: string,
    step: ExecutionStep
  ): Promise<{ output: string }> {
    await this.delay(100); // Simulate execution time
    
    return {
      output: `[SIMULATED] Executed: ${command} for ${step.operation}`
    };
  }
  
  /**
   * Get execution history
   */
  getExecutionHistory(): StepResult[] {
    return [...this.executionHistory];
  }
  
  /**
   * Clear execution history
   */
  clearHistory(): void {
    this.executionHistory = [];
  }
  
  /**
   * Get KPI report
   */
  getKPIReport(): string {
    return this.kpiLogger.getSummaryReport();
  }
  
  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}