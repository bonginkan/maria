/**
 * Workflow Engine for Multimodal Intelligence Orchestration
 * Manages complex multi-step operations with compensation and rollback
 *
 * Features:
 * - DAG-based workflow execution
 * - Automatic compensation on failure
 * - Distributed tracing support
 * - Circuit breaker integration
 * - Caching and memoization
 */

import { EventEmitter } from "node:events";
import {
  MultimodalInput,
  ProcessedOutput,
  ProcessingMode,
  ModalityType,
} from "../core/types.js";
import { ProcessorRegistry } from "../processors/registry.js";
import { MetricsCollector } from "../monitoring/metrics-collector.js";
import { 
  ProductionTelemetryIntegration, 
  TelemetrySpan,
  DEFAULT_DEVELOPMENT_CONFIG 
} from "../monitoring/ProductionTelemetryIntegration.js";

export interface WorkflowStep {
  id: string;
  name: string;
  type: "process" | "transform" | "aggregate" | "validate" | "branch";
  modalityType?: ModalityType;
  dependencies: string[]; // Step IDs this step depends on
  retryPolicy?: RetryPolicy;
  compensationHandler?: CompensationHandler;
  timeout?: number;
  cache?: CacheConfig;
  metadata?: Record<string, any>;
}

export interface RetryPolicy {
  maxAttempts: number;
  backoffMultiplier: number;
  initialDelayMs: number;
  maxDelayMs: number;
  retryableErrors?: string[];
}

export interface CompensationHandler {
  type: "rollback" | "compensate" | "ignore";
  handler?: (context: WorkflowContext, error: Error) => Promise<void>;
  timeout?: number;
}

export interface CacheConfig {
  enabled: boolean;
  ttlMs: number;
  keyGenerator?: (input: any) => string;
  scope: "step" | "workflow" | "global";
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  version: string;
  steps: WorkflowStep[];
  globalTimeout?: number;
  maxParallelism?: number;
  circuitBreaker?: CircuitBreakerConfig;
  tracing?: TracingConfig;
}

export interface CircuitBreakerConfig {
  enabled: boolean;
  errorThreshold: number; // Percentage
  volumeThreshold: number; // Minimum requests
  sleepWindowMs: number;
  bucketSizeMs: number;
}

export interface TracingConfig {
  enabled: boolean;
  serviceName: string;
  samplingRate: number; // 0-1
  propagateContext: boolean;
}

export interface WorkflowContext {
  workflowId: string;
  executionId: string;
  startTime: number;
  inputs: Map<string, any>;
  outputs: Map<string, any>;
  errors: Map<string, Error>;
  metadata: Map<string, any>;
  traceContext?: TraceContext;
  abortSignal?: AbortSignal;
}

export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  baggage?: Map<string, string>;
}

export interface WorkflowResult {
  executionId: string;
  status: "completed" | "failed" | "cancelled" | "timeout" | "paused" | "running";
  outputs: Map<string, any>;
  errors?: Map<string, Error>;
  duration: number;
  stepResults: Map<string, StepResult>;
  compensationResults?: Map<string, CompensationResult>;
}

export interface WorkflowStatus {
  executionId: string;
  workflowId: string;
  status: "running" | "paused" | "completed" | "failed" | "cancelled";
  startTime: Date;
  lastUpdate: Date;
  currentStep?: string;
  completedSteps: string[];
  totalSteps: number;
  progress: number; // 0-1
  estimatedTimeRemaining?: number;
}

export interface WorkflowInfo {
  executionId: string;
  workflowId: string;
  status: WorkflowStatus['status'];
  startTime: Date;
  duration?: number;
  stepCount: number;
  completedStepCount: number;
}

export interface StepResult {
  stepId: string;
  status: "success" | "failed" | "skipped" | "cancelled";
  startTime: number;
  endTime: number;
  output?: any;
  error?: Error;
  retries: number;
  cached: boolean;
}

export interface CompensationResult {
  stepId: string;
  status: "success" | "failed" | "skipped";
  duration: number;
  error?: Error;
}

/**
 * Main Workflow Engine implementation
 */
export class WorkflowEngine extends EventEmitter {
  private readonly registry: ProcessorRegistry;
  private readonly metrics: MetricsCollector;
  private readonly workflows = new Map<string, WorkflowDefinition>();
  private readonly executionContexts = new Map<string, WorkflowContext>();
  private readonly cache = new Map<string, { value: any; expires: number }>();
  private readonly circuitBreakers = new Map<string, CircuitBreaker>();
  
  // Phase 3 enhancements
  private readonly pausedWorkflows = new Map<string, {
    context: WorkflowContext;
    pausedAt: Date;
    currentStepIndex: number;
  }>();
  private readonly workflowStatuses = new Map<string, WorkflowStatus>();
  private readonly activeExecutions = new Map<string, {
    promise: Promise<WorkflowResult>;
    controller: AbortController;
  }>();
  
  // Production telemetry integration
  private readonly telemetry: ProductionTelemetryIntegration;
  private readonly workflowSpans = new Map<string, TelemetrySpan>();

  constructor(registry: ProcessorRegistry, metrics: MetricsCollector, telemetryConfig?: any) {
    super();
    this.registry = registry;
    this.metrics = metrics;
    this.telemetry = new ProductionTelemetryIntegration(telemetryConfig || DEFAULT_DEVELOPMENT_CONFIG);
    this.startCacheCleanup();
    this.initializeTelemetry();
  }

  /**
   * Initialize telemetry system
   */
  private async initializeTelemetry(): Promise<void> {
    try {
      await this.telemetry.initialize();
      this.emit('telemetry.initialized');
    } catch (error) {
      this.emit('telemetry.error', error);
    }
  }

  /**
   * Register a workflow definition
   */
  registerWorkflow(definition: WorkflowDefinition): void {
    this.validateWorkflowDefinition(definition);
    this.workflows.set(definition.id, definition);

    // Initialize circuit breaker if configured
    if (definition.circuitBreaker?.enabled) {
      this.circuitBreakers.set(
        definition.id,
        new CircuitBreaker(definition.circuitBreaker),
      );
    }

    this.emit("workflow.registered", {
      workflowId: definition.id,
      name: definition.name,
      version: definition.version,
    });
  }

  /**
   * Execute a workflow with given inputs
   */
  async executeWorkflow(
    workflowId: string,
    inputs: Map<string, any>,
    options?: {
      abortSignal?: AbortSignal;
      traceContext?: TraceContext;
      metadata?: Record<string, any>;
    },
  ): Promise<WorkflowResult> {
    const startTime = Date.now();
    const definition = this.workflows.get(workflowId);

    if (!definition) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    // Check circuit breaker
    const circuitBreaker = this.circuitBreakers.get(workflowId);
    if (circuitBreaker && !circuitBreaker.allowRequest()) {
      throw new Error(`Circuit breaker open for workflow ${workflowId}`);
    }

    // Create execution context
    const executionId = this.generateExecutionId();
    const context: WorkflowContext = {
      workflowId,
      executionId,
      startTime,
      inputs,
      outputs: new Map(),
      errors: new Map(),
      metadata: new Map(Object.entries(options?.metadata || {})),
      traceContext: options?.traceContext || this.createTraceContext(),
      abortSignal: options?.abortSignal,
    };

    this.executionContexts.set(executionId, context);

    try {
      // Start telemetry span for workflow
      const workflowSpan = this.telemetry.startWorkflowSpan(
        workflowId, 
        executionId
      );
      this.workflowSpans.set(executionId, workflowSpan);

      // Record workflow start metrics
      this.telemetry.recordWorkflowMetric(workflowId, executionId, 'started', 1);

      // Start tracing span if enabled
      if (definition.tracing?.enabled) {
        this.startTraceSpan(context, definition);
      }

      // Build execution plan (DAG resolution)
      const executionPlan = this.buildExecutionPlan(definition);

      // Execute workflow steps
      const stepResults = await this.executeSteps(
        executionPlan,
        context,
        definition,
      );

      // Record success metrics
      const duration = Date.now() - startTime;
      this.metrics.recordLatency(`workflow.${workflowId}`, duration);
      this.metrics.recordSuccess(`workflow.${workflowId}`);

      // Record telemetry metrics
      this.telemetry.recordLatency('workflow_execution', duration, {
        workflow_type: workflowId,
        execution_id: executionId,
        status: 'success'
      });
      this.telemetry.recordWorkflowMetric(workflowId, executionId, 'completed', 1);
      this.telemetry.recordThroughput('workflow_execution', 1, {
        workflow_type: workflowId,
        status: 'success'
      });

      // Finish telemetry span
      const completedWorkflowSpan = this.workflowSpans.get(executionId);
      if (completedWorkflowSpan) {
        this.telemetry.finishSpan(completedWorkflowSpan.spanId, true);
        this.workflowSpans.delete(executionId);
      }

      // Update circuit breaker
      circuitBreaker?.recordSuccess();

      return {
        executionId,
        status: "completed",
        outputs: context.outputs,
        duration,
        stepResults,
      };
    } catch (error) {
      // Handle workflow failure
      const duration = Date.now() - startTime;
      this.metrics.recordError(`workflow.${workflowId}`, error as Error);

      // Record telemetry for failure
      this.telemetry.recordLatency('workflow_execution', duration, {
        workflow_type: workflowId,
        execution_id: executionId,
        status: 'error'
      });
      this.telemetry.recordWorkflowMetric(workflowId, executionId, 'failed', 1);
      this.telemetry.recordThroughput('workflow_execution', 1, {
        workflow_type: workflowId,
        status: 'error'
      });

      // Finish telemetry span with error
      const errorWorkflowSpan = this.workflowSpans.get(executionId);
      if (errorWorkflowSpan) {
        this.telemetry.logSpanEvent(
          errorWorkflowSpan.spanId,
          'error',
          `Workflow failed: ${(error as Error).message}`,
          { error_type: (error as Error).name }
        );
        this.telemetry.finishSpan(errorWorkflowSpan.spanId, false, error as Error);
        this.workflowSpans.delete(executionId);
      }

      // Update circuit breaker
      circuitBreaker?.recordFailure();

      // Execute compensation if needed
      const compensationResults = await this.executeCompensation(
        context,
        definition,
      );

      return {
        executionId,
        status: "failed",
        outputs: context.outputs,
        errors: context.errors,
        duration,
        stepResults: new Map(),
        compensationResults,
      };
    } finally {
      // Cleanup
      this.executionContexts.delete(executionId);

      // End tracing span
      if (definition.tracing?.enabled) {
        this.endTraceSpan(context);
      }

      // Final telemetry cleanup if span still exists
      const workflowSpan = this.workflowSpans.get(executionId);
      if (workflowSpan) {
        this.telemetry.finishSpan(workflowSpan.spanId, false);
        this.workflowSpans.delete(executionId);
      }
    }
  }

  /**
   * Build execution plan from workflow definition
   */
  private buildExecutionPlan(definition: WorkflowDefinition): WorkflowStep[][] {
    const steps = definition.steps;
    const levels: WorkflowStep[][] = [];
    const executed = new Set<string>();

    while (executed.size < steps.length) {
      const level: WorkflowStep[] = [];

      for (const step of steps) {
        if (!executed.has(step.id)) {
          // Check if all dependencies are executed
          const dependenciesMet = step.dependencies.every((dep) =>
            executed.has(dep),
          );

          if (dependenciesMet) {
            level.push(step);
          }
        }
      }

      if (level.length === 0 && executed.size < steps.length) {
        throw new Error("Circular dependency detected in workflow");
      }

      for (const step of level) {
        executed.add(step.id);
      }

      if (level.length > 0) {
        levels.push(level);
      }
    }

    return levels;
  }

  /**
   * Execute workflow steps according to plan
   */
  private async executeSteps(
    executionPlan: WorkflowStep[][],
    context: WorkflowContext,
    definition: WorkflowDefinition,
  ): Promise<Map<string, StepResult>> {
    const results = new Map<string, StepResult>();
    const maxParallelism = definition.maxParallelism || 5;

    for (const level of executionPlan) {
      // Check for cancellation
      if (context.abortSignal?.aborted) {
        throw new Error("Workflow cancelled");
      }

      // Execute steps in parallel (with limit)
      const chunks = this.chunkArray(level, maxParallelism);

      for (const chunk of chunks) {
        const stepPromises = chunk.map((step) =>
          this.executeStep(step, context, definition),
        );

        const stepResults = await Promise.allSettled(stepPromises);

        // Process results
        for (let i = 0; i < chunk.length; i++) {
          const step = chunk[i];
          const result = stepResults[i];

          if (result.status === "fulfilled") {
            results.set(step.id, result.value);
            context.outputs.set(step.id, result.value.output);
          } else {
            const error = result.reason as Error;
            context.errors.set(step.id, error);

            // Check if error is retryable
            if (!this.isRetryableError(error, step)) {
              throw error; // Fail fast for non-retryable errors
            }
          }
        }
      }
    }

    return results;
  }

  /**
   * Execute a single workflow step
   */
  private async executeStep(
    step: WorkflowStep,
    context: WorkflowContext,
    definition: WorkflowDefinition,
  ): Promise<StepResult> {
    const startTime = Date.now();
    let retries = 0;
    const cached = false;
    let lastError: Error | undefined;

    // Start telemetry span for step
    const parentSpan = this.workflowSpans.get(context.executionId);
    const stepSpan = this.telemetry.startOperationSpan(
      `step:${step.name}`,
      parentSpan?.spanId,
      {
        'step.id': step.id,
        'step.type': step.type,
        'step.modality': step.modalityType || 'none'
      }
    );

    // Check cache if enabled
    if (step.cache?.enabled) {
      const cacheKey = this.generateCacheKey(step, context);
      const cachedResult = this.getCachedValue(cacheKey);

      if (cachedResult !== undefined) {
        return {
          stepId: step.id,
          status: "success",
          startTime,
          endTime: Date.now(),
          output: cachedResult,
          retries: 0,
          cached: true,
        };
      }
    }

    // Execute with retry policy
    const maxAttempts = step.retryPolicy?.maxAttempts || 1;

    while (retries < maxAttempts) {
      try {
        // Create step-specific abort signal with timeout
        const stepAbortController = new AbortController();
        const timeout = step.timeout || definition.globalTimeout || 30000;

        const timeoutId = setTimeout(() => {
          stepAbortController.abort();
        }, timeout);

        // Link to parent abort signal
        if (context.abortSignal) {
          context.abortSignal.addEventListener("abort", () => {
            stepAbortController.abort();
          });
        }

        // Execute step based on type
        const output = await this.executeStepLogic(
          step,
          context,
          stepAbortController.signal,
        );

        clearTimeout(timeoutId);

        // Cache result if configured
        if (step.cache?.enabled) {
          const cacheKey = this.generateCacheKey(step, context);
          this.setCachedValue(cacheKey, output, step.cache.ttlMs);
        }

        const endTime = Date.now();
        const duration = endTime - startTime;

        // Record step success metrics
        this.telemetry.recordLatency('step_execution', duration, {
          step_id: step.id,
          step_type: step.type,
          workflow_id: context.workflowId,
          execution_id: context.executionId,
          status: 'success',
          retries: retries.toString(),
          cached: cached.toString()
        });

        // Log success to span
        this.telemetry.logSpanEvent(
          stepSpan.spanId,
          'info',
          `Step completed successfully`,
          { 
            output_size: JSON.stringify(output).length,
            retries,
            cached
          }
        );

        // Finish telemetry span
        this.telemetry.finishSpan(stepSpan.spanId, true);

        return {
          stepId: step.id,
          status: "success",
          startTime,
          endTime,
          output,
          retries,
          cached,
        };
      } catch (error) {
        lastError = error as Error;
        retries++;

        if (retries < maxAttempts) {
          // Calculate backoff delay
          const delay = this.calculateBackoffDelay(retries, step.retryPolicy);
          await this.delay(delay);
        }
      }
    }

    // All retries exhausted
    const endTime = Date.now();
    const duration = endTime - startTime;

    // Record step failure metrics
    this.telemetry.recordLatency('step_execution', duration, {
      step_id: step.id,
      step_type: step.type,
      workflow_id: context.workflowId,
      execution_id: context.executionId,
      status: 'error',
      retries: retries.toString(),
      error_type: lastError?.name || 'unknown'
    });

    // Log failure to span
    this.telemetry.logSpanEvent(
      stepSpan.spanId,
      'error',
      `Step failed after ${retries} retries: ${lastError?.message || 'unknown error'}`,
      { 
        retries,
        error_name: lastError?.name,
        error_stack: lastError?.stack
      }
    );

    // Finish telemetry span with error
    this.telemetry.finishSpan(stepSpan.spanId, false, lastError);

    return {
      stepId: step.id,
      status: "failed",
      startTime,
      endTime,
      error: lastError,
      retries,
      cached: false,
    };
  }

  /**
   * Execute step-specific logic
   */
  private async executeStepLogic(
    step: WorkflowStep,
    context: WorkflowContext,
    signal: AbortSignal,
  ): Promise<any> {
    switch (step.type) {
      case "process":
        return this.executeProcessStep(step, context, signal);

      case "transform":
        return this.executeTransformStep(step, context, signal);

      case "aggregate":
        return this.executeAggregateStep(step, context, signal);

      case "validate":
        return this.executeValidateStep(step, context, signal);

      case "branch":
        return this.executeBranchStep(step, context, signal);

      default:
        throw new Error(`Unknown step type: ${step.type}`);
    }
  }

  /**
   * Execute compensation for failed workflow
   */
  private async executeCompensation(
    context: WorkflowContext,
    definition: WorkflowDefinition,
  ): Promise<Map<string, CompensationResult>> {
    const results = new Map<string, CompensationResult>();
    const executedSteps = Array.from(context.outputs.keys());

    // Execute compensation in reverse order
    for (const stepId of executedSteps.reverse()) {
      const step = definition.steps.find((s) => s.id === stepId);

      if (step?.compensationHandler) {
        const startTime = Date.now();

        try {
          if (step.compensationHandler.handler) {
            await step.compensationHandler.handler(
              context,
              context.errors.get(stepId) || new Error("Unknown error"),
            );
          }

          results.set(stepId, {
            stepId,
            status: "success",
            duration: Date.now() - startTime,
          });
        } catch (error) {
          results.set(stepId, {
            stepId,
            status: "failed",
            duration: Date.now() - startTime,
            error: error as Error,
          });
        }
      }
    }

    return results;
  }

  // Helper methods

  private validateWorkflowDefinition(definition: WorkflowDefinition): void {
    // Check for duplicate step IDs
    const stepIds = new Set<string>();
    for (const step of definition.steps) {
      if (stepIds.has(step.id)) {
        throw new Error(`Duplicate step ID: ${step.id}`);
      }
      stepIds.add(step.id);
    }

    // Validate dependencies
    for (const step of definition.steps) {
      for (const dep of step.dependencies) {
        if (!stepIds.has(dep)) {
          throw new Error(`Unknown dependency ${dep} in step ${step.id}`);
        }
      }
    }
  }

  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private createTraceContext(): TraceContext {
    return {
      traceId: this.generateTraceId(),
      spanId: this.generateSpanId(),
    };
  }

  private generateTraceId(): string {
    return `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSpanId(): string {
    return `span_${Math.random().toString(36).substr(2, 9)}`;
  }

  private startTraceSpan(
    context: WorkflowContext,
    definition: WorkflowDefinition,
  ): void {
    // Implementation would integrate with OpenTelemetry or similar
    this.emit("trace.span.start", {
      traceId: context.traceContext?.traceId,
      spanId: context.traceContext?.spanId,
      operationName: `workflow.${definition.name}`,
      tags: {
        workflowId: definition.id,
        version: definition.version,
      },
    });
  }

  private endTraceSpan(context: WorkflowContext): void {
    this.emit("trace.span.end", {
      traceId: context.traceContext?.traceId,
      spanId: context.traceContext?.spanId,
    });
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private isRetryableError(error: Error, step: WorkflowStep): boolean {
    if (!step.retryPolicy?.retryableErrors) {
      return true; // Retry all errors by default
    }

    return step.retryPolicy.retryableErrors.some((pattern) =>
      error.message.includes(pattern),
    );
  }

  private calculateBackoffDelay(attempt: number, policy?: RetryPolicy): number {
    if (!policy) return 1000; // Default 1 second

    const delay =
      policy.initialDelayMs * Math.pow(policy.backoffMultiplier, attempt - 1);
    return Math.min(delay, policy.maxDelayMs);
  }

  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private generateCacheKey(
    step: WorkflowStep,
    context: WorkflowContext,
  ): string {
    if (step.cache?.keyGenerator) {
      return step.cache.keyGenerator(context.inputs);
    }

    // Default key generation
    const inputs = step.dependencies
      .map((dep) => JSON.stringify(context.outputs.get(dep)))
      .join("|");

    return `${step.id}:${inputs}`;
  }

  private getCachedValue(key: string): any {
    const entry = this.cache.get(key);
    if (entry && entry.expires > Date.now()) {
      return entry.value;
    }

    this.cache.delete(key);
    return undefined;
  }

  private setCachedValue(key: string, value: any, ttlMs: number): void {
    this.cache.set(key, {
      value,
      expires: Date.now() + ttlMs,
    });
  }

  private startCacheCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.cache) {
        if (entry.expires <= now) {
          this.cache.delete(key);
        }
      }
    }, 60000); // Clean every minute
  }

  // Step execution implementations

  private async executeProcessStep(
    step: WorkflowStep,
    context: WorkflowContext,
    signal: AbortSignal,
  ): Promise<any> {
    if (!step.modalityType) {
      throw new Error(`Process step ${step.id} requires modalityType`);
    }

    // Get input from dependencies
    const input = this.resolveStepInput(step, context);

    // Process through registry
    return await this.registry.processInput(input, {
      mode: "batch" as ProcessingMode,
      signal,
    });
  }

  private async executeTransformStep(
    step: WorkflowStep,
    context: WorkflowContext,
    signal: AbortSignal,
  ): Promise<any> {
    const input = this.resolveStepInput(step, context);

    // Apply transformation (would be customizable)
    return this.transformData(input, step.metadata);
  }

  private async executeAggregateStep(
    step: WorkflowStep,
    context: WorkflowContext,
    signal: AbortSignal,
  ): Promise<any> {
    const inputs = step.dependencies.map((dep) => context.outputs.get(dep));

    // Aggregate multiple inputs
    return this.aggregateOutputs(inputs, step.metadata);
  }

  private async executeValidateStep(
    step: WorkflowStep,
    context: WorkflowContext,
    signal: AbortSignal,
  ): Promise<any> {
    const input = this.resolveStepInput(step, context);

    // Validate data
    const isValid = this.validateData(input, step.metadata);

    if (!isValid) {
      throw new Error(`Validation failed for step ${step.id}`);
    }

    return input;
  }

  private async executeBranchStep(
    step: WorkflowStep,
    context: WorkflowContext,
    signal: AbortSignal,
  ): Promise<any> {
    const condition = step.metadata?.condition;
    const input = this.resolveStepInput(step, context);

    // Evaluate branch condition
    const branchResult = this.evaluateCondition(condition, input, context);

    return {
      branch: branchResult,
      input,
    };
  }

  private resolveStepInput(step: WorkflowStep, context: WorkflowContext): any {
    if (step.dependencies.length === 0) {
      // Use workflow inputs
      return (
        context.inputs.get("default") || context.inputs.values().next().value
      );
    } else if (step.dependencies.length === 1) {
      // Use single dependency output
      return context.outputs.get(step.dependencies[0]);
    } else {
      // Multiple dependencies - return as array
      return step.dependencies.map((dep) => context.outputs.get(dep));
    }
  }

  private transformData(data: any, metadata?: Record<string, any>): any {
    // Placeholder for transformation logic
    return data;
  }

  private aggregateOutputs(
    outputs: any[],
    metadata?: Record<string, any>,
  ): any {
    // Placeholder for aggregation logic
    return outputs;
  }

  private validateData(data: any, metadata?: Record<string, any>): boolean {
    // Placeholder for validation logic
    return true;
  }

  private evaluateCondition(
    condition: any,
    input: any,
    context: WorkflowContext,
  ): boolean {
    // Placeholder for condition evaluation
    return true;
  }

  // === Phase 3: Enhanced Orchestration Features ===

  /**
   * Pause a running workflow
   */
  async pauseWorkflow(executionId: string): Promise<void> {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) {
      throw new Error(`No active workflow execution found: ${executionId}`);
    }

    const context = this.executionContexts.get(executionId);
    if (!context) {
      throw new Error(`No context found for execution: ${executionId}`);
    }

    // Signal the workflow to pause
    execution.controller.abort();
    
    // Store paused state
    this.pausedWorkflows.set(executionId, {
      context,
      pausedAt: new Date(),
      currentStepIndex: this.getCurrentStepIndex(context)
    });

    // Update status
    const status = this.workflowStatuses.get(executionId);
    if (status) {
      status.status = 'paused';
      status.lastUpdate = new Date();
    }

    this.emit('workflow.paused', {
      executionId,
      workflowId: context.workflowId,
      pausedAt: new Date()
    });
  }

  /**
   * Resume a paused workflow
   */
  async resumeWorkflow(executionId: string): Promise<WorkflowResult> {
    const pausedWorkflow = this.pausedWorkflows.get(executionId);
    if (!pausedWorkflow) {
      throw new Error(`No paused workflow found: ${executionId}`);
    }

    const { context, currentStepIndex } = pausedWorkflow;
    
    // Remove from paused workflows
    this.pausedWorkflows.delete(executionId);
    
    // Update status
    const status = this.workflowStatuses.get(executionId);
    if (status) {
      status.status = 'running';
      status.lastUpdate = new Date();
    }

    this.emit('workflow.resumed', {
      executionId,
      workflowId: context.workflowId,
      resumedAt: new Date(),
      pausedDuration: Date.now() - pausedWorkflow.pausedAt.getTime()
    });

    // Continue execution from where it was paused
    return this.continueWorkflowExecution(context, currentStepIndex);
  }

  /**
   * Get workflow execution status
   */
  getWorkflowStatus(executionId: string): WorkflowStatus | undefined {
    return this.workflowStatuses.get(executionId);
  }

  /**
   * List all active workflow executions
   */
  listActiveWorkflows(): WorkflowInfo[] {
    const activeWorkflows: WorkflowInfo[] = [];
    
    for (const [executionId, status] of this.workflowStatuses) {
      if (['running', 'paused'].includes(status.status)) {
        activeWorkflows.push({
          executionId,
          workflowId: status.workflowId,
          status: status.status,
          startTime: status.startTime,
          stepCount: status.totalSteps,
          completedStepCount: status.completedSteps.length
        });
      }
    }
    
    return activeWorkflows;
  }

  /**
   * Get workflow execution metrics
   */
  getWorkflowMetrics(executionId?: string): {
    totalExecutions: number;
    activeExecutions: number;
    completedExecutions: number;
    failedExecutions: number;
    pausedExecutions: number;
    averageDuration: number;
    successRate: number;
  } {
    const allStatuses = Array.from(this.workflowStatuses.values());
    const filtered = executionId 
      ? allStatuses.filter(s => s.executionId === executionId)
      : allStatuses;

    const totalExecutions = filtered.length;
    const activeExecutions = filtered.filter(s => s.status === 'running').length;
    const completedExecutions = filtered.filter(s => s.status === 'completed').length;
    const failedExecutions = filtered.filter(s => s.status === 'failed').length;
    const pausedExecutions = filtered.filter(s => s.status === 'paused').length;

    const completedWorkflows = filtered.filter(s => ['completed', 'failed'].includes(s.status));
    const averageDuration = completedWorkflows.length > 0
      ? completedWorkflows.reduce((sum, s) => sum + (s.lastUpdate.getTime() - s.startTime.getTime()), 0) / completedWorkflows.length
      : 0;

    const successRate = totalExecutions > 0 ? completedExecutions / totalExecutions : 0;

    return {
      totalExecutions,
      activeExecutions,
      completedExecutions,
      failedExecutions,
      pausedExecutions,
      averageDuration,
      successRate
    };
  }

  // Helper methods
  private getCurrentStepIndex(context: WorkflowContext): number {
    // Determine current step based on completed steps
    const workflow = this.workflows.get(context.workflowId);
    if (!workflow) return 0;
    
    const completedSteps = Array.from(context.outputs.keys());
    return completedSteps.length;
  }

  private async continueWorkflowExecution(context: WorkflowContext, fromStepIndex: number): Promise<WorkflowResult> {
    const workflow = this.workflows.get(context.workflowId);
    if (!workflow) {
      throw new Error(`Workflow definition not found: ${context.workflowId}`);
    }

    // Create new abort controller for resumed execution
    const controller = new AbortController();
    const executionPromise = this.executeStepsFromIndex(workflow, context, fromStepIndex, controller.signal);
    
    this.activeExecutions.set(context.executionId, {
      promise: executionPromise,
      controller
    });

    try {
      const result = await executionPromise;
      this.activeExecutions.delete(context.executionId);
      return result;
    } catch (error) {
      this.activeExecutions.delete(context.executionId);
      throw error;
    }
  }

  private async executeStepsFromIndex(
    workflow: WorkflowDefinition,
    context: WorkflowContext,
    fromIndex: number,
    signal: AbortSignal
  ): Promise<WorkflowResult> {
    const steps = this.topologicalSort(workflow.steps);
    const remainingSteps = steps.slice(fromIndex);

    for (const step of remainingSteps) {
      if (signal.aborted) {
        // Workflow was paused or cancelled
        const status = this.workflowStatuses.get(context.executionId);
        if (status) {
          status.status = 'paused';
          status.lastUpdate = new Date();
        }
        
        return {
          executionId: context.executionId,
          status: 'paused',
          outputs: context.outputs,
          duration: Date.now() - context.startTime,
          stepResults: context.stepResults
        };
      }

      // Update status before executing step
      this.updateWorkflowProgress(context.executionId, step.id, steps.length);

      // Execute the step (reuse existing step execution logic)
      await this.executeStep(step, context);
    }

    // Mark as completed
    const status = this.workflowStatuses.get(context.executionId);
    if (status) {
      status.status = 'completed';
      status.lastUpdate = new Date();
      status.progress = 1.0;
    }

    return {
      executionId: context.executionId,
      status: 'completed',
      outputs: context.outputs,
      duration: Date.now() - context.startTime,
      stepResults: context.stepResults
    };
  }

  private updateWorkflowProgress(executionId: string, currentStepId: string, totalSteps: number): void {
    const status = this.workflowStatuses.get(executionId);
    if (status) {
      status.currentStep = currentStepId;
      if (!status.completedSteps.includes(currentStepId)) {
        status.completedSteps.push(currentStepId);
      }
      status.progress = status.completedSteps.length / totalSteps;
      status.lastUpdate = new Date();
      
      // Estimate remaining time based on average step duration
      const avgStepDuration = (Date.now() - status.startTime.getTime()) / status.completedSteps.length;
      const remainingSteps = totalSteps - status.completedSteps.length;
      status.estimatedTimeRemaining = remainingSteps * avgStepDuration;
    }
  }

  // === Production Telemetry Methods ===

  /**
   * Shutdown workflow engine and cleanup telemetry
   */
  async shutdown(): Promise<void> {
    // Cancel all active executions
    for (const [executionId, execution] of this.activeExecutions) {
      execution.controller.abort();
      
      // Finish any remaining spans
      const span = this.workflowSpans.get(executionId);
      if (span) {
        this.telemetry.finishSpan(span.spanId, false, new Error('Workflow engine shutdown'));
        this.workflowSpans.delete(executionId);
      }
    }

    // Clear all state
    this.activeExecutions.clear();
    this.pausedWorkflows.clear();
    this.workflowStatuses.clear();
    this.executionContexts.clear();

    // Shutdown telemetry
    await this.telemetry.shutdown();
    
    this.emit('shutdown');
  }

  /**
   * Get telemetry health status
   */
  getTelemetryHealth(): any {
    return this.telemetry.getHealth();
  }

  /**
   * Export telemetry data for monitoring dashboards
   */
  async exportTelemetryMetrics(): Promise<string> {
    return await this.telemetry.exportMetrics();
  }

  /**
   * Export telemetry traces for distributed tracing analysis
   */
  async exportTelemetryTraces(): Promise<string> {
    return await this.telemetry.exportTraces();
  }

  /**
   * Record custom workflow resource usage
   */
  recordResourceUsage(resource: string, value: number, unit: string): void {
    this.telemetry.recordResourceUsage(resource, value, unit);
  }
}

/**
 * Circuit Breaker implementation
 */
class CircuitBreaker {
  private readonly config: CircuitBreakerConfig;
  private readonly buckets: Map<number, { success: number; failure: number }> =
    new Map();
  private state: "closed" | "open" | "half-open" = "closed";
  private lastFailureTime = 0;

  constructor(config: CircuitBreakerConfig) {
    this.config = config;
  }

  allowRequest(): boolean {
    this.cleanOldBuckets();

    if (this.state === "open") {
      // Check if sleep window has passed
      if (Date.now() - this.lastFailureTime > this.config.sleepWindowMs) {
        this.state = "half-open";
        return true;
      }
      return false;
    }

    return true;
  }

  recordSuccess(): void {
    const bucket = this.getCurrentBucket();
    bucket.success++;

    if (this.state === "half-open") {
      this.state = "closed";
    }
  }

  recordFailure(): void {
    const bucket = this.getCurrentBucket();
    bucket.failure++;
    this.lastFailureTime = Date.now();

    // Check if circuit should open
    const stats = this.getStats();

    if (stats.total >= this.config.volumeThreshold) {
      const errorRate = (stats.failures / stats.total) * 100;

      if (errorRate >= this.config.errorThreshold) {
        this.state = "open";
      }
    }
  }

  private getCurrentBucket(): { success: number; failure: number } {
    const bucketKey = Math.floor(Date.now() / this.config.bucketSizeMs);

    if (!this.buckets.has(bucketKey)) {
      this.buckets.set(bucketKey, { success: 0, failure: 0 });
    }

    return this.buckets.get(bucketKey)!;
  }

  private getStats(): { total: number; failures: number } {
    let total = 0;
    let failures = 0;

    for (const bucket of this.buckets.values()) {
      total += bucket.success + bucket.failure;
      failures += bucket.failure;
    }

    return { total, failures };
  }

  private cleanOldBuckets(): void {
    const cutoff = Math.floor((Date.now() - 60000) / this.config.bucketSizeMs);

    for (const [key] of this.buckets) {
      if (key < cutoff) {
        this.buckets.delete(key);
      }
    }
  }
}
