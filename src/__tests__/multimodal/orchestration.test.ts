/**
 * Orchestration Layer Test Suite
 * Validates workflow engine, compensation, and template functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  WorkflowEngine,
  WorkflowDefinition,
  WorkflowStep,
} from "../../services/multimodal/orchestration/WorkflowEngine.js";
import {
  CompensationManager,
  CompensationAction,
} from "../../services/multimodal/orchestration/CompensationManager.js";
import {
  WorkflowTemplates,
  PreBuiltWorkflows,
  WorkflowValidator,
} from "../../services/multimodal/orchestration/WorkflowTemplates.js";
import { ProcessorRegistry } from "../../services/multimodal/processors/registry.js";
import { MetricsCollector } from "../../services/multimodal/monitoring/metrics-collector.js";
import { TextProcessor } from "../../services/multimodal/processors/text.js";

describe("Workflow Engine Tests", () => {
  let engine: WorkflowEngine;
  let registry: ProcessorRegistry;
  let metrics: MetricsCollector;

  beforeEach(async () => {
    // Setup dependencies
    registry = new ProcessorRegistry({
      maxConcurrentRequests: 10,
      processorTimeout: 30000,
      enableHealthMonitoring: true,
      enableLoadBalancing: true,
    });

    metrics = new MetricsCollector();

    // Register a test processor
    const textProcessor = new TextProcessor();
    await registry.registerProcessor(textProcessor);

    engine = new WorkflowEngine(registry, metrics);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Workflow Registration and Validation", () => {
    it("should register a valid workflow", () => {
      const workflow: WorkflowDefinition = {
        id: "test_workflow",
        name: "Test Workflow",
        version: "1.0.0",
        steps: [
          {
            id: "step1",
            name: "Step 1",
            type: "process",
            modalityType: "text" as any,
            dependencies: [],
          },
        ],
      };

      expect(() => engine.registerWorkflow(workflow)).not.toThrow();
    });

    it("should reject workflow with duplicate step IDs", () => {
      const workflow: WorkflowDefinition = {
        id: "invalid_workflow",
        name: "Invalid Workflow",
        version: "1.0.0",
        steps: [
          {
            id: "step1",
            name: "Step 1",
            type: "process",
            dependencies: [],
          },
          {
            id: "step1", // Duplicate
            name: "Step 1 Duplicate",
            type: "process",
            dependencies: [],
          },
        ],
      };

      expect(() => engine.registerWorkflow(workflow)).toThrow(
        "Duplicate step ID",
      );
    });

    it("should detect circular dependencies", () => {
      const workflow: WorkflowDefinition = {
        id: "circular_workflow",
        name: "Circular Workflow",
        version: "1.0.0",
        steps: [
          {
            id: "step1",
            name: "Step 1",
            type: "process",
            dependencies: ["step3"],
          },
          {
            id: "step2",
            name: "Step 2",
            type: "process",
            dependencies: ["step1"],
          },
          {
            id: "step3",
            name: "Step 3",
            type: "process",
            dependencies: ["step2"],
          },
        ],
      };

      const validation = WorkflowValidator.validate(workflow);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain(
        "Workflow contains circular dependencies",
      );
    });
  });

  describe("Workflow Execution", () => {
    it("should execute a simple sequential workflow", async () => {
      const workflow = WorkflowTemplates.createSequentialPipeline({
        name: "Test Sequential",
        steps: [
          { id: "step1", name: "Process Text", modalityType: "text" },
          { id: "step2", name: "Transform", modalityType: "text" },
        ],
      });

      engine.registerWorkflow(workflow);

      const inputs = new Map([["default", { data: "test input" }]]);
      const result = await engine.executeWorkflow(workflow.id, inputs);

      expect(result.status).toBe("completed");
      expect(result.executionId).toBeDefined();
      expect(result.duration).toBeGreaterThan(0);
    });

    it("should execute parallel steps concurrently", async () => {
      const workflow = WorkflowTemplates.createParallelAnalysis({
        name: "Test Parallel",
        modalities: ["text", "code", "structured"],
      });

      engine.registerWorkflow(workflow);

      const inputs = new Map([["default", { data: "test input" }]]);
      const startTime = Date.now();
      const result = await engine.executeWorkflow(workflow.id, inputs);
      const duration = Date.now() - startTime;

      expect(result.status).toBe("completed");
      // Parallel execution should be faster than sequential
      expect(duration).toBeLessThan(3000); // Assuming each step takes ~1s
    });

    it("should handle workflow cancellation", async () => {
      const workflow: WorkflowDefinition = {
        id: "cancellable_workflow",
        name: "Cancellable Workflow",
        version: "1.0.0",
        steps: [
          {
            id: "long_running",
            name: "Long Running Step",
            type: "process",
            modalityType: "text" as any,
            dependencies: [],
            timeout: 10000,
          },
        ],
      };

      engine.registerWorkflow(workflow);

      const abortController = new AbortController();
      const inputs = new Map([["default", { data: "test" }]]);

      // Start workflow and cancel after 100ms
      const workflowPromise = engine.executeWorkflow(workflow.id, inputs, {
        abortSignal: abortController.signal,
      });

      setTimeout(() => abortController.abort(), 100);

      await expect(workflowPromise).rejects.toThrow("cancelled");
    });

    it("should respect step timeout", async () => {
      const workflow: WorkflowDefinition = {
        id: "timeout_workflow",
        name: "Timeout Workflow",
        version: "1.0.0",
        steps: [
          {
            id: "timeout_step",
            name: "Timeout Step",
            type: "process",
            dependencies: [],
            timeout: 100, // Very short timeout
          },
        ],
      };

      engine.registerWorkflow(workflow);
      const inputs = new Map([["default", { data: "test" }]]);

      const result = await engine.executeWorkflow(workflow.id, inputs);

      // Should handle timeout gracefully
      expect(["completed", "failed"]).toContain(result.status);
    });
  });

  describe("Caching Functionality", () => {
    it("should cache step results when enabled", async () => {
      const workflow: WorkflowDefinition = {
        id: "cached_workflow",
        name: "Cached Workflow",
        version: "1.0.0",
        steps: [
          {
            id: "cached_step",
            name: "Cached Step",
            type: "process",
            modalityType: "text" as any,
            dependencies: [],
            cache: {
              enabled: true,
              ttlMs: 60000,
              scope: "workflow",
            },
          },
        ],
      };

      engine.registerWorkflow(workflow);
      const inputs = new Map([["default", { data: "test" }]]);

      // First execution
      const result1 = await engine.executeWorkflow(workflow.id, inputs);
      const duration1 = result1.duration;

      // Second execution (should hit cache)
      const result2 = await engine.executeWorkflow(workflow.id, inputs);
      const duration2 = result2.duration;

      expect(result2.status).toBe("completed");
      expect(duration2).toBeLessThan(duration1); // Cached execution should be faster
    });
  });

  describe("Retry Policy", () => {
    it("should retry failed steps according to policy", async () => {
      let attemptCount = 0;

      const workflow: WorkflowDefinition = {
        id: "retry_workflow",
        name: "Retry Workflow",
        version: "1.0.0",
        steps: [
          {
            id: "flaky_step",
            name: "Flaky Step",
            type: "process",
            dependencies: [],
            retryPolicy: {
              maxAttempts: 3,
              backoffMultiplier: 2,
              initialDelayMs: 100,
              maxDelayMs: 1000,
              retryableErrors: ["TEMPORARY"],
            },
          },
        ],
      };

      // Mock flaky processor that fails first 2 attempts
      const originalProcess = registry.processInput;
      registry.processInput = vi.fn(async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error("TEMPORARY failure");
        }
        return { id: "test", success: true } as any;
      });

      engine.registerWorkflow(workflow);
      const inputs = new Map([["default", { data: "test" }]]);

      const result = await engine.executeWorkflow(workflow.id, inputs);

      expect(attemptCount).toBe(3);
      expect(result.status).toBe("completed");

      registry.processInput = originalProcess;
    });
  });
});

describe("Compensation Manager Tests", () => {
  let compensationManager: CompensationManager;
  let metrics: MetricsCollector;

  beforeEach(() => {
    metrics = new MetricsCollector();
    compensationManager = new CompensationManager(metrics);
  });

  describe("Compensation Actions", () => {
    it("should execute compensation in reverse order", async () => {
      const executionOrder: string[] = [];

      const actions: CompensationAction[] = [
        {
          id: "comp1",
          stepId: "step1",
          type: "rollback",
          handler: async () => {
            executionOrder.push("comp1");
          },
        },
        {
          id: "comp2",
          stepId: "step2",
          type: "rollback",
          handler: async () => {
            executionOrder.push("comp2");
          },
        },
        {
          id: "comp3",
          stepId: "step3",
          type: "rollback",
          handler: async () => {
            executionOrder.push("comp3");
          },
        },
      ];

      compensationManager.registerCompensation("test_workflow", actions);

      const mockContext: any = {
        workflowId: "test_workflow",
        executionId: "exec123",
        outputs: new Map([
          ["step1", "output1"],
          ["step2", "output2"],
          ["step3", "output3"],
        ]),
        errors: new Map(),
      };

      const result = await compensationManager.executeCompensation(
        "test_workflow",
        mockContext,
        new Error("Test error"),
        { type: "sequential", order: "reverse", continueOnError: true },
      );

      expect(executionOrder).toEqual(["comp3", "comp2", "comp1"]);
      expect(result.successful).toBe(3);
      expect(result.failed).toBe(0);
    });

    it("should handle compensation failures gracefully", async () => {
      const actions: CompensationAction[] = [
        {
          id: "comp1",
          stepId: "step1",
          type: "rollback",
          handler: async () => {
            throw new Error("Compensation failed");
          },
          retryPolicy: {
            maxAttempts: 2,
            delayMs: 100,
          },
        },
      ];

      compensationManager.registerCompensation("test_workflow", actions);

      const mockContext: any = {
        workflowId: "test_workflow",
        executionId: "exec123",
        outputs: new Map([["step1", "output1"]]),
        errors: new Map(),
      };

      const result = await compensationManager.executeCompensation(
        "test_workflow",
        mockContext,
        new Error("Test error"),
      );

      expect(result.failed).toBe(1);
      expect(result.deadLetterQueue.length).toBe(1);
    });

    it("should support parallel compensation execution", async () => {
      const startTimes: Record<string, number> = {};

      const actions: CompensationAction[] = Array.from(
        { length: 5 },
        (_, i) => ({
          id: `comp${i}`,
          stepId: `step${i}`,
          type: "rollback" as const,
          handler: async () => {
            startTimes[`comp${i}`] = Date.now();
            await new Promise((resolve) => setTimeout(resolve, 100));
          },
        }),
      );

      compensationManager.registerCompensation("test_workflow", actions);

      const mockContext: any = {
        workflowId: "test_workflow",
        executionId: "exec123",
        outputs: new Map(actions.map((a) => [a.stepId, `output_${a.stepId}`])),
        errors: new Map(),
      };

      const result = await compensationManager.executeCompensation(
        "test_workflow",
        mockContext,
        new Error("Test error"),
        {
          type: "parallel",
          order: "reverse",
          continueOnError: true,
          maxParallelism: 3,
        },
      );

      expect(result.successful).toBe(5);

      // Check that actions were executed in parallel (within batches)
      const times = Object.values(startTimes);
      const maxTimeDiff = Math.max(...times) - Math.min(...times);
      expect(maxTimeDiff).toBeLessThan(300); // Should complete within ~200ms for parallel execution
    });
  });

  describe("Saga Pattern", () => {
    it("should implement saga pattern correctly", async () => {
      const executed: string[] = [];
      const compensated: string[] = [];

      const saga = compensationManager.createSagaCompensation([
        {
          id: "tx1",
          execute: async () => {
            executed.push("tx1");
            return "result1";
          },
          compensate: async () => {
            compensated.push("tx1");
          },
        },
        {
          id: "tx2",
          execute: async () => {
            executed.push("tx2");
            throw new Error("Transaction failed");
          },
          compensate: async () => {
            compensated.push("tx2");
          },
        },
        {
          id: "tx3",
          execute: async () => {
            executed.push("tx3");
            return "result3";
          },
          compensate: async () => {
            compensated.push("tx3");
          },
        },
      ]);

      await expect(saga.execute()).rejects.toThrow("Transaction failed");

      expect(executed).toEqual(["tx1", "tx2"]);
      expect(compensated).toEqual(["tx1"]); // Only tx1 should be compensated
    });
  });

  describe("Dead Letter Queue", () => {
    it("should retry failed compensations from dead letter queue", async () => {
      let attemptCount = 0;

      const actions: CompensationAction[] = [
        {
          id: "flaky_comp",
          stepId: "step1",
          type: "rollback",
          handler: async () => {
            attemptCount++;
            if (attemptCount < 2) {
              throw new Error("Temporary failure");
            }
          },
        },
      ];

      compensationManager.registerCompensation("test_workflow", actions);

      const mockContext: any = {
        workflowId: "test_workflow",
        executionId: "exec123",
        outputs: new Map([["step1", "output1"]]),
        errors: new Map(),
      };

      // First execution fails
      await compensationManager.executeCompensation(
        "test_workflow",
        mockContext,
        new Error("Test error"),
      );

      expect(attemptCount).toBe(1);

      // Retry from dead letter queue
      const retryResults = await compensationManager.retryDeadLetterQueue();

      expect(retryResults.size).toBe(1);
      expect(retryResults.get("flaky_comp")?.status).toBe("success");
      expect(attemptCount).toBe(2);
    });
  });
});

describe("Workflow Templates Tests", () => {
  describe("Template Creation", () => {
    it("should create sequential pipeline template", () => {
      const template = WorkflowTemplates.createSequentialPipeline({
        name: "Test Pipeline",
        steps: [
          { id: "step1", name: "Step 1", modalityType: "text" },
          { id: "step2", name: "Step 2", modalityType: "code" },
        ],
        enableCache: true,
      });

      expect(template.steps).toHaveLength(2);
      expect(template.steps[1].dependencies).toEqual(["step1"]);
      expect(template.steps[0].cache).toBeDefined();
    });

    it("should create parallel analysis template", () => {
      const template = WorkflowTemplates.createParallelAnalysis({
        name: "Multi-Modal Analysis",
        modalities: ["text", "image", "audio"],
        aggregationStrategy: "vote",
      });

      // Should have 3 processing steps + 1 aggregation step
      expect(template.steps).toHaveLength(4);

      const aggregationStep = template.steps.find(
        (s) => s.type === "aggregate",
      );
      expect(aggregationStep?.dependencies).toHaveLength(3);
    });

    it("should create map-reduce template", () => {
      const template = WorkflowTemplates.createMapReduce({
        name: "Batch Processing",
        splitStrategy: "chunk",
        chunkSize: 100,
        mapFunction: "process",
        reduceFunction: "aggregate",
        parallelism: 5,
      });

      const mapSteps = template.steps.filter((s) => s.id.startsWith("map_"));
      expect(mapSteps).toHaveLength(5);

      const reduceStep = template.steps.find((s) => s.id === "reduce_results");
      expect(reduceStep?.dependencies).toHaveLength(5);
    });

    it("should create scatter-gather template", () => {
      const template = WorkflowTemplates.createScatterGather({
        name: "Fast Response",
        processors: [
          { id: "fast", modalityType: "text" },
          { id: "accurate", modalityType: "text" },
        ],
        gatherStrategy: "first",
        timeout: 5000,
      });

      const scatterSteps = template.steps.filter((s) =>
        s.id.startsWith("scatter_"),
      );
      expect(scatterSteps).toHaveLength(2);
      expect(scatterSteps[0].timeout).toBe(5000);
    });

    it("should create enrichment pipeline template", () => {
      const template = WorkflowTemplates.createEnrichmentPipeline({
        name: "Content Enrichment",
        enrichmentSteps: [
          {
            id: "entities",
            name: "Extract Entities",
            modalityType: "text",
            required: true,
            enrichmentField: "entities",
          },
          {
            id: "sentiment",
            name: "Analyze Sentiment",
            modalityType: "text",
            required: false,
            enrichmentField: "sentiment",
          },
        ],
      });

      // Base + 2 enrichment + aggregation = 4 steps
      expect(template.steps).toHaveLength(4);

      const finalStep = template.steps[template.steps.length - 1];
      expect(finalStep.cache?.ttlMs).toBe(10 * 60 * 1000); // 10 minutes
    });
  });

  describe("Template Validation", () => {
    it("should validate pre-built workflows", () => {
      const textAnalysis = PreBuiltWorkflows.TEXT_ANALYSIS;
      const validation = WorkflowValidator.validate(textAnalysis);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it("should detect missing required fields", () => {
      const invalidWorkflow: any = {
        steps: [],
      };

      const validation = WorkflowValidator.validate(invalidWorkflow);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain("Workflow ID is required");
      expect(validation.errors).toContain("Workflow name is required");
    });

    it("should warn about missing timeout", () => {
      const workflow: WorkflowDefinition = {
        id: "test",
        name: "Test",
        version: "1.0.0",
        steps: [
          {
            id: "step1",
            name: "Step 1",
            type: "process",
            dependencies: [],
          },
        ],
      };

      const validation = WorkflowValidator.validate(workflow);

      expect(validation.warnings).toContain("No global timeout configured");
    });
  });

  describe("Compensation Action Generation", () => {
    it("should generate compensation actions from workflow", () => {
      const workflow = WorkflowTemplates.createSequentialPipeline({
        name: "Test Pipeline",
        steps: [
          { id: "step1", name: "Step 1", modalityType: "text" },
          { id: "step2", name: "Step 2", modalityType: "text" },
        ],
      });

      const compensationActions =
        WorkflowTemplates.createCompensationActions(workflow);

      expect(compensationActions).toHaveLength(2);
      expect(compensationActions[0].type).toBe("rollback");
      expect(compensationActions[0].stepId).toBe("step1");
    });
  });
});

describe("Integration Tests", () => {
  let engine: WorkflowEngine;
  let compensationManager: CompensationManager;
  let registry: ProcessorRegistry;
  let metrics: MetricsCollector;

  beforeEach(async () => {
    registry = new ProcessorRegistry({
      maxConcurrentRequests: 10,
      processorTimeout: 30000,
      enableHealthMonitoring: true,
      enableLoadBalancing: true,
    });

    metrics = new MetricsCollector();
    engine = new WorkflowEngine(registry, metrics);
    compensationManager = new CompensationManager(metrics);

    // Register test processor
    const textProcessor = new TextProcessor();
    await registry.registerProcessor(textProcessor);
  });

  it("should execute workflow with automatic compensation on failure", async () => {
    const compensationExecuted = { step1: false, step2: false };

    const workflow: WorkflowDefinition = {
      id: "test_with_compensation",
      name: "Test with Compensation",
      version: "1.0.0",
      steps: [
        {
          id: "step1",
          name: "Step 1",
          type: "process",
          modalityType: "text" as any,
          dependencies: [],
          compensationHandler: {
            type: "rollback",
            handler: async () => {
              compensationExecuted.step1 = true;
            },
          },
        },
        {
          id: "step2",
          name: "Step 2 (will fail)",
          type: "process",
          dependencies: ["step1"],
          compensationHandler: {
            type: "rollback",
            handler: async () => {
              compensationExecuted.step2 = true;
            },
          },
        },
      ],
    };

    // Mock step2 to fail
    const originalProcess = registry.processInput;
    let callCount = 0;
    registry.processInput = vi.fn(async (input) => {
      callCount++;
      if (callCount === 2) {
        throw new Error("Step 2 failed");
      }
      return { id: "test", success: true } as any;
    });

    engine.registerWorkflow(workflow);

    const inputs = new Map([["default", { data: "test" }]]);
    const result = await engine.executeWorkflow(workflow.id, inputs);

    expect(result.status).toBe("failed");
    expect(result.compensationResults).toBeDefined();

    // Only step1 should be compensated (step2 failed before completion)
    expect(compensationExecuted.step1).toBe(true);
    expect(compensationExecuted.step2).toBe(false);

    registry.processInput = originalProcess;
  });

  it("should handle complex workflow with all features", async () => {
    // Use pre-built document enrichment workflow
    const workflow = PreBuiltWorkflows.DOCUMENT_ENRICHMENT;
    engine.registerWorkflow(workflow);

    const inputs = new Map([
      [
        "default",
        {
          data: "This is a test document for enrichment pipeline.",
          type: "text",
        },
      ],
    ]);

    const result = await engine.executeWorkflow(workflow.id, inputs);

    expect(result.status).toBe("completed");
    expect(result.outputs.size).toBeGreaterThan(0);

    // Check that caching is working
    const cachedResult = await engine.executeWorkflow(workflow.id, inputs);
    expect(cachedResult.duration).toBeLessThan(result.duration);
  });
});
