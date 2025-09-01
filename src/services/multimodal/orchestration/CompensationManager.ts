/**
 * Compensation Manager for Workflow Orchestration
 * Handles rollback and compensation strategies for failed operations
 *
 * Features:
 * - Saga pattern implementation
 * - Automatic compensation ordering
 * - Partial rollback support
 * - Compensation state tracking
 * - Dead letter queue for failed compensations
 */

import { EventEmitter } from "node:events";
import { WorkflowContext } from "./WorkflowEngine.js";
import { MetricsCollector } from "../monitoring/metrics-collector.js";

export interface CompensationAction {
  id: string;
  stepId: string;
  type: "rollback" | "compensate" | "retry" | "skip";
  handler: (context: CompensationContext) => Promise<void>;
  timeout?: number;
  retryPolicy?: {
    maxAttempts: number;
    delayMs: number;
  };
  dependencies?: string[]; // Other compensation actions this depends on
  metadata?: Record<string, any>;
}

export interface CompensationContext {
  workflowContext: WorkflowContext;
  stepOutput?: any;
  error: Error;
  attempt: number;
  metadata: Map<string, any>;
}

export interface CompensationStrategy {
  type: "sequential" | "parallel" | "selective";
  order: "reverse" | "forward" | "custom";
  continueOnError: boolean;
  maxParallelism?: number;
  selector?: (
    action: CompensationAction,
    context: CompensationContext,
  ) => boolean;
}

export interface CompensationResult {
  actionId: string;
  status: "success" | "failed" | "skipped" | "timeout";
  duration: number;
  error?: Error;
  retries: number;
}

export interface CompensationReport {
  totalActions: number;
  successful: number;
  failed: number;
  skipped: number;
  duration: number;
  results: CompensationResult[];
  deadLetterQueue: FailedCompensation[];
}

export interface FailedCompensation {
  actionId: string;
  context: CompensationContext;
  error: Error;
  timestamp: Date;
  retryCount: number;
}

/**
 * Manages compensation and rollback operations
 */
export class CompensationManager extends EventEmitter {
  private readonly metrics: MetricsCollector;
  private readonly compensationActions = new Map<
    string,
    CompensationAction[]
  >();
  private readonly executionHistory = new Map<string, CompensationResult[]>();
  private readonly deadLetterQueue: FailedCompensation[] = [];
  private readonly maxDeadLetterSize = 1000;

  constructor(metrics: MetricsCollector) {
    super();
    this.metrics = metrics;
  }

  /**
   * Register compensation actions for a workflow
   */
  registerCompensation(
    workflowId: string,
    actions: CompensationAction[],
  ): void {
    this.validateCompensationActions(actions);
    this.compensationActions.set(workflowId, actions);

    this.emit("compensation.registered", {
      workflowId,
      actionCount: actions.length,
    });
  }

  /**
   * Execute compensation for a failed workflow
   */
  async executeCompensation(
    workflowId: string,
    context: WorkflowContext,
    error: Error,
    strategy?: CompensationStrategy,
  ): Promise<CompensationReport> {
    const startTime = Date.now();
    const actions = this.compensationActions.get(workflowId) || [];

    if (actions.length === 0) {
      return this.createEmptyReport();
    }

    const effectiveStrategy = strategy || this.getDefaultStrategy();
    const results: CompensationResult[] = [];

    try {
      // Filter actions based on strategy
      const actionsToExecute = this.filterActions(
        actions,
        context,
        effectiveStrategy,
      );

      // Order actions based on strategy
      const orderedActions = this.orderActions(
        actionsToExecute,
        effectiveStrategy,
      );

      // Execute compensation actions
      if (effectiveStrategy.type === "parallel") {
        const parallelResults = await this.executeParallel(
          orderedActions,
          context,
          error,
          effectiveStrategy,
        );
        results.push(...parallelResults);
      } else {
        const sequentialResults = await this.executeSequential(
          orderedActions,
          context,
          error,
          effectiveStrategy,
        );
        results.push(...sequentialResults);
      }

      // Store execution history
      this.executionHistory.set(context.executionId, results);

      // Generate report
      return this.generateReport(results, Date.now() - startTime);
    } catch (compensationError) {
      this.emit("compensation.failed", {
        workflowId,
        error: compensationError,
        partialResults: results,
      });

      throw compensationError;
    }
  }

  /**
   * Execute compensation actions sequentially
   */
  private async executeSequential(
    actions: CompensationAction[],
    workflowContext: WorkflowContext,
    error: Error,
    strategy: CompensationStrategy,
  ): Promise<CompensationResult[]> {
    const results: CompensationResult[] = [];

    for (const action of actions) {
      const result = await this.executeAction(action, workflowContext, error);
      results.push(result);

      // Check if we should continue on error
      if (result.status === "failed" && !strategy.continueOnError) {
        break;
      }
    }

    return results;
  }

  /**
   * Execute compensation actions in parallel
   */
  private async executeParallel(
    actions: CompensationAction[],
    workflowContext: WorkflowContext,
    error: Error,
    strategy: CompensationStrategy,
  ): Promise<CompensationResult[]> {
    const maxParallelism = strategy.maxParallelism || 5;
    const results: CompensationResult[] = [];

    // Execute in batches
    for (let i = 0; i < actions.length; i += maxParallelism) {
      const batch = actions.slice(i, i + maxParallelism);

      const batchPromises = batch.map((action) =>
        this.executeAction(action, workflowContext, error),
      );

      const batchResults = await Promise.allSettled(batchPromises);

      for (let j = 0; j < batchResults.length; j++) {
        const result = batchResults[j];

        if (result.status === "fulfilled") {
          results.push(result.value);
        } else {
          // Create failed result
          results.push({
            actionId: batch[j].id,
            status: "failed",
            duration: 0,
            error: result.reason,
            retries: 0,
          });

          if (!strategy.continueOnError) {
            return results;
          }
        }
      }
    }

    return results;
  }

  /**
   * Execute a single compensation action
   */
  private async executeAction(
    action: CompensationAction,
    workflowContext: WorkflowContext,
    error: Error,
  ): Promise<CompensationResult> {
    const startTime = Date.now();
    let retries = 0;
    let lastError: Error | undefined;

    const maxAttempts = action.retryPolicy?.maxAttempts || 1;

    while (retries < maxAttempts) {
      try {
        // Create compensation context
        const compensationContext: CompensationContext = {
          workflowContext,
          stepOutput: workflowContext.outputs.get(action.stepId),
          error,
          attempt: retries + 1,
          metadata: new Map(Object.entries(action.metadata || {})),
        };

        // Execute with timeout if specified
        if (action.timeout) {
          await this.executeWithTimeout(
            action.handler(compensationContext),
            action.timeout,
          );
        } else {
          await action.handler(compensationContext);
        }

        // Record success metrics
        this.metrics.recordSuccess(`compensation.${action.id}`);

        return {
          actionId: action.id,
          status: "success",
          duration: Date.now() - startTime,
          retries,
        };
      } catch (actionError) {
        lastError = actionError as Error;
        retries++;

        if (retries < maxAttempts && action.retryPolicy) {
          await this.delay(action.retryPolicy.delayMs);
        }
      }
    }

    // All retries exhausted - add to dead letter queue
    this.addToDeadLetterQueue({
      actionId: action.id,
      context: {
        workflowContext,
        stepOutput: workflowContext.outputs.get(action.stepId),
        error,
        attempt: retries,
        metadata: new Map(),
      },
      error: lastError!,
      timestamp: new Date(),
      retryCount: retries,
    });

    // Record failure metrics
    this.metrics.recordError(`compensation.${action.id}`, lastError!);

    return {
      actionId: action.id,
      status: "failed",
      duration: Date.now() - startTime,
      error: lastError,
      retries,
    };
  }

  /**
   * Create compensation rollback chain
   */
  createRollbackChain(
    steps: Array<{ id: string; rollback: () => Promise<void> }>,
  ): CompensationAction[] {
    const actions: CompensationAction[] = [];

    // Create rollback actions in reverse order
    for (let i = steps.length - 1; i >= 0; i--) {
      const step = steps[i];

      actions.push({
        id: `rollback_${step.id}`,
        stepId: step.id,
        type: "rollback",
        handler: async (context) => {
          await step.rollback();
        },
      });
    }

    return actions;
  }

  /**
   * Create saga compensation pattern
   */
  createSagaCompensation(
    transactions: Array<{
      id: string;
      execute: () => Promise<any>;
      compensate: () => Promise<void>;
    }>,
  ): { execute: () => Promise<any[]>; compensate: () => Promise<void> } {
    return {
      execute: async () => {
        const results: any[] = [];
        const executed: number[] = [];

        try {
          for (let i = 0; i < transactions.length; i++) {
            const result = await transactions[i].execute();
            results.push(result);
            executed.push(i);
          }
          return results;
        } catch (error) {
          // Compensate in reverse order
          for (let i = executed.length - 1; i >= 0; i--) {
            try {
              await transactions[executed[i]].compensate();
            } catch (compensationError) {
              // Log but continue compensation
              this.emit("saga.compensation.error", {
                transactionId: transactions[executed[i]].id,
                error: compensationError,
              });
            }
          }
          throw error;
        }
      },

      compensate: async () => {
        // Full compensation
        for (let i = transactions.length - 1; i >= 0; i--) {
          await transactions[i].compensate();
        }
      },
    };
  }

  /**
   * Retry failed compensations from dead letter queue
   */
  async retryDeadLetterQueue(
    filter?: (item: FailedCompensation) => boolean,
  ): Promise<Map<string, CompensationResult>> {
    const results = new Map<string, CompensationResult>();
    const itemsToRetry = filter
      ? this.deadLetterQueue.filter(filter)
      : [...this.deadLetterQueue];

    for (const item of itemsToRetry) {
      const action = this.findAction(item.actionId);

      if (action) {
        const result = await this.executeAction(
          action,
          item.context.workflowContext,
          item.context.error,
        );

        results.set(item.actionId, result);

        // Remove from dead letter queue if successful
        if (result.status === "success") {
          const index = this.deadLetterQueue.indexOf(item);
          if (index > -1) {
            this.deadLetterQueue.splice(index, 1);
          }
        }
      }
    }

    return results;
  }

  /**
   * Get compensation status for a workflow execution
   */
  getCompensationStatus(executionId: string): CompensationResult[] | undefined {
    return this.executionHistory.get(executionId);
  }

  /**
   * Clear dead letter queue
   */
  clearDeadLetterQueue(): number {
    const count = this.deadLetterQueue.length;
    this.deadLetterQueue.length = 0;
    return count;
  }

  // Helper methods

  private validateCompensationActions(actions: CompensationAction[]): void {
    const ids = new Set<string>();

    for (const action of actions) {
      if (ids.has(action.id)) {
        throw new Error(`Duplicate compensation action ID: ${action.id}`);
      }
      ids.add(action.id);

      // Validate dependencies
      if (action.dependencies) {
        for (const dep of action.dependencies) {
          if (!actions.find((a) => a.id === dep)) {
            throw new Error(`Unknown dependency ${dep} in action ${action.id}`);
          }
        }
      }
    }
  }

  private filterActions(
    actions: CompensationAction[],
    context: WorkflowContext,
    strategy: CompensationStrategy,
  ): CompensationAction[] {
    if (strategy.type !== "selective" || !strategy.selector) {
      return actions;
    }

    return actions.filter((action) => {
      const compensationContext: CompensationContext = {
        workflowContext: context,
        stepOutput: context.outputs.get(action.stepId),
        error: new Error("Workflow failed"),
        attempt: 0,
        metadata: new Map(),
      };

      return strategy.selector!(action, compensationContext);
    });
  }

  private orderActions(
    actions: CompensationAction[],
    strategy: CompensationStrategy,
  ): CompensationAction[] {
    switch (strategy.order) {
      case "reverse":
        return [...actions].reverse();

      case "forward":
        return actions;

      case "custom":
        // Order by dependencies
        return this.topologicalSort(actions);

      default:
        return actions;
    }
  }

  private topologicalSort(actions: CompensationAction[]): CompensationAction[] {
    const sorted: CompensationAction[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (action: CompensationAction): void => {
      if (visited.has(action.id)) return;

      if (visiting.has(action.id)) {
        throw new Error("Circular dependency detected in compensation actions");
      }

      visiting.add(action.id);

      // Visit dependencies first
      if (action.dependencies) {
        for (const depId of action.dependencies) {
          const dep = actions.find((a) => a.id === depId);
          if (dep) {
            visit(dep);
          }
        }
      }

      visiting.delete(action.id);
      visited.add(action.id);
      sorted.push(action);
    };

    for (const action of actions) {
      visit(action);
    }

    return sorted;
  }

  private getDefaultStrategy(): CompensationStrategy {
    return {
      type: "sequential",
      order: "reverse",
      continueOnError: true,
    };
  }

  private async executeWithTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Compensation timeout after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  }

  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private addToDeadLetterQueue(item: FailedCompensation): void {
    this.deadLetterQueue.push(item);

    // Maintain max size
    if (this.deadLetterQueue.length > this.maxDeadLetterSize) {
      this.deadLetterQueue.shift();
    }

    this.emit("deadletter.added", {
      actionId: item.actionId,
      error: item.error,
      queueSize: this.deadLetterQueue.length,
    });
  }

  private findAction(actionId: string): CompensationAction | undefined {
    for (const actions of this.compensationActions.values()) {
      const action = actions.find((a) => a.id === actionId);
      if (action) {
        return action;
      }
    }
    return undefined;
  }

  private createEmptyReport(): CompensationReport {
    return {
      totalActions: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      duration: 0,
      results: [],
      deadLetterQueue: [...this.deadLetterQueue],
    };
  }

  private generateReport(
    results: CompensationResult[],
    duration: number,
  ): CompensationReport {
    const successful = results.filter((r) => r.status === "success").length;
    const failed = results.filter((r) => r.status === "failed").length;
    const skipped = results.filter((r) => r.status === "skipped").length;

    return {
      totalActions: results.length,
      successful,
      failed,
      skipped,
      duration,
      results,
      deadLetterQueue: [...this.deadLetterQueue],
    };
  }
}
