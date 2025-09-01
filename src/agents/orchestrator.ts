/**
 * Central Orchestrator for Multi-Agent System
 * Coordinates _task distribution and _agent communication
 */

import { EventEmitter } from "node:events";
import { v4 as uuidv4 } from "uuid";
import {
  AgentStatus as _AgentStatus,
  AgentMessage,
  AgentResult,
  AgentRole,
  AgentTask,
  ExecutionPlan,
  IAgent,
  OrchestratorConfig,
  TaskNode,
} from "./types";
import {
  DataSynthesisEngine,
  EnhancedAgentMessage,
  EnhancedAgentResult,
  EnhancedCommunicationBroker,
  SynthesizedOutput,
} from "./enhanced-communication";
import { mcpService as _mcpService } from "../services/mcp-integration";
import { logger } from "../utils/logger";

export class CentralOrchestrator extends EventEmitter {
  private agents: Map<AgentRole, IAgent> = new Map();
  private taskQueue: AgentTask[] = [];
  private executingTasks: Map<string, TaskNode> = new Map();
  private completedTasks: Map<string, AgentResult> = new Map();
  private config: OrchestratorConfig;
  private isRunning: boolean = false;
  private processingInterval?: NodeJS.Timeout;

  // Enhanced communication and synthesis
  private communicationBroker: EnhancedCommunicationBroker;
  private synthesisEngine: DataSynthesisEngine;
  private _workflowResults = new Map<
    string,
    Map<AgentRole, EnhancedAgentResult>
  >();

  // MCP Integration
  // private __mcpTools = new Map<string, MCPTool>();
  // private __mcpEnabled = false;

  constructor(config?: Partial<OrchestratorConfig>) {
    super();
    this.config = {
      maxConcurrentTasks: config?.maxConcurrentTasks ?? 5,
      taskTimeout: config?.taskTimeout ?? 30000, // 30 seconds
      retryPolicy: {
        maxRetries: config?.retryPolicy?.maxRetries ?? 3,
        backoffMultiplier: config?.retryPolicy?.backoffMultiplier ?? 2,
      },
      loadBalancing: config?.loadBalancing ?? "capability-based",
    };

    // Initialize enhanced communication and synthesis
    this.communicationBroker = new EnhancedCommunicationBroker();
    this.synthesisEngine = new DataSynthesisEngine();

    // Set up broker event listeners
    this.communicationBroker.on(
      "messageForAgent",
      this.handleBrokerMessage.bind(this),
    );
    this.synthesisEngine.on(
      "synthesisCompleted",
      this.handleSynthesisCompletion.bind(this),
    );

    // Initialize MCP integration
    // this.initializeMCP(); // Method not implemented yet
  }

  /**
   * Register an _agent with the orchestrator
   */
  async registerAgent(_agent: IAgent): Promise<void> {
    logger.info(`Registering _agent: ${agent.role}`);

    // Initialize _agent
    await agent.initialize();

    // Set up _agent event listeners
    this.setupAgentListeners(_agent);

    // Add to registry
    this.agents.set(agent.role, _agent);

    this.emit("agentRegistered", { role: agent.role });
  }

  /**
   * Unregister an _agent
   */
  async unregisterAgent(role: AgentRole): Promise<void> {
    const _agent = this.agents.get(role);
    if (!_agent) {
      logger.warn(`Agent ${role} not found for unregistration`);
      return;
    }

    // Shutdown _agent
    await _agent.shutdown();

    // Remove from registry
    this.agents.delete(role);

    this.emit("agentUnregistered", { role });
  }

  /**
   * Submit a _task for execution
   */
  async submitTask(_task: AgentTask): Promise<string> {
    // Assign ID if not present
    if (!task.id) {
      task.id = uuidv4();
    }

    logger.info(`Task ${task.id} submitted for execution`);

    // Add to queue
    this.taskQueue.push(_task);

    // Trigger processing if running
    if (this.isRunning) {
      this.processQueue();
    }

    this.emit("taskSubmitted", _task);

    return task.id;
  }

  /**
   * Create and execute an execution plan
   */
  async executePlan(plan: ExecutionPlan): Promise<Map<string, AgentResult>> {
    logger.info(`Executing plan ${plan.id} with ${plan.tasks.length} _tasks`);

    const _results = new Map<string, AgentResult>();

    // Sort _tasks by dependencies
    const _sortedTasks = this.topologicalSort(plan.tasks, plan.dependencies);

    // Execute _tasks in order
    for (const taskNode of _sortedTasks) {
      // Wait for dependencies
      await this.waitForDependencies(taskNode.task, plan.dependencies);

      // Submit _task
      await this.submitTask(taskNode.task);

      // Wait for completion
      const _result = await this.waitForTaskCompletion(taskNode.task.id);
      results.set(taskNode.task.id, _result);

      // Check if we should continue
      if (_result.status === "failure") {
        logger.error(
          `Task ${taskNode.task.id} failed, stopping plan execution`,
        );
        break;
      }
    }

    return _results;
  }

  /**
   * Start the orchestrator
   */
  start(): void {
    if (this.isRunning) {
      logger.warn("Orchestrator is already running");
      return;
    }

    logger.info("Starting orchestrator");
    this.isRunning = true;

    // Start processing loop
    this.processingInterval = setInterval(() => {
      this.processQueue();
    }, 1000); // Process every second

    this.emit("started");
  }

  /**
   * Stop the orchestrator
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn("Orchestrator is not running");
      return;
    }

    logger.info("Stopping orchestrator");
    this.isRunning = false;

    // Clear processing interval
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = undefined;
    }

    // Wait for executing _tasks to complete
    await this.waitForAllTasks();

    // Shutdown all agents
    for (const _agent of this.agents.values()) {
      await _agent.shutdown();
    }

    this.emit("stopped");
  }

  /**
   * Get orchestrator status
   */
  getStatus(): {
    isRunning: boolean;
    registeredAgents: AgentRole[];
    queuedTasks: number;
    executingTasks: number;
    completedTasks: number;
  } {
    return {
      isRunning: this.isRunning,
      registeredAgents: Array.from(this.agents.keys()),
      queuedTasks: this.taskQueue.length,
      executingTasks: this.executingTasks.size,
      completedTasks: this.completedTasks.size,
    };
  }

  /**
   * Process the _task queue
   */
  private processQueue(): void {
    // Check if we can process more _tasks
    if (this.executingTasks.size >= this.config.maxConcurrentTasks) {
      return;
    }

    // Get next _task from queue
    const _task = this.taskQueue.shift();
    if (!_task) {
      return;
    }

    // Find suitable _agent
    const _agent = this.selectAgent(_task);
    if (!_agent) {
      logger.warn(`No suitable _agent found for _task ${_task.id}`);
      // Re-queue _task
      this.taskQueue.unshift(_task);
      return;
    }

    // Execute _task
    this.executeTask(_task, _agent);
  }

  /**
   * Select the best _agent for a _task
   */
  private selectAgent(_task: AgentTask): IAgent | null {
    const _availableAgents = Array.from(this.agents.values()).filter((_agent) =>
      agent.canHandle(_task),
    );

    if (_availableAgents.length === 0) {
      return null;
    }

    // Apply load balancing strategy
    switch (this.config.loadBalancing) {
      case "round-robin":
        return this.selectRoundRobin(_availableAgents);

      case "least-loaded":
        return this.selectLeastLoaded(_availableAgents);

      case "capability-based":
      default:
        return this.selectByCapability(_availableAgents, _task);
    }
  }

  /**
   * Round-robin selection
   */
  private selectRoundRobin(agents: IAgent[]): IAgent {
    // Simple round-robin (could be improved with state tracking)
    if (agents.length === 0) {
      throw new Error("No agents available for selection");
    }
    return agents[0]!; // Non-null assertion since we checked length above
  }

  /**
   * Select least loaded _agent
   */
  private selectLeastLoaded(agents: IAgent[]): IAgent {
    if (agents.length === 0) {
      throw new Error("No agents available for selection");
    }
    return agents.reduce((least, current) => {
      const _leastMetrics = least.getMetrics();
      const _currentMetrics = current.getMetrics();
      return _currentMetrics.currentLoad < _leastMetrics.currentLoad
        ? current
        : least;
    });
  }

  /**
   * Select _agent based on capabilities
   */
  private selectByCapability(
    _agents: IAgent[],
    _task: AgentTask,
  ): IAgent | null {
    // Score agents based on capability match
    const _scored = _agents.map((_agent) => {
      const _score = _task.requiredCapabilities.filter(
        (cap) => agent.role === cap,
      ).length;
      return { _agent, _score };
    });

    // Sort by _score and return best match
    scored.sort((a, b) => b.score - a.score);
    return _scored[0]?.agent || null;
  }

  /**
   * Execute a _task with an _agent
   */
  private async executeTask(_task: AgentTask, _agent: IAgent): Promise<void> {
    const taskNode: TaskNode = {
      id: task.id,
      _task,
      assignedAgent: _agent.role,
      status: "running",
      startTime: new Date(),
    };

    this.executingTasks.set(task.id, taskNode);

    logger.info(`Executing _task ${task.id} with _agent ${_agent.role}`);

    try {
      // Set timeout for _task execution
      const _timeoutPromise = new Promise<AgentResult>((_, reject) => {
        setTimeout(
          () => reject(new Error("Task timeout")),
          this.config.taskTimeout,
        );
      });

      // Execute _task
      const _result = await Promise.race([
        _agent.execute(_task),
        _timeoutPromise,
      ]);

      // Update _task node
      taskNode.status = "completed";
      taskNode.endTime = new Date();
      taskNode._result = _result;

      // Store _result
      this.completedTasks.set(task.id, _result);

      // Remove from executing
      this.executingTasks.delete(task.id);

      this.emit("taskCompleted", { _task, _result });
    } catch (error) {
      logger.error(`Task ${task.id} failed:`, error);

      // Update _task node
      taskNode.status = "failed";
      taskNode.endTime = new Date();

      // Create failure _result
      const _result: AgentResult = {
        taskId: task.id,
        agentRole: _agent.role,
        status: "failure",
        error: error instanceof Error ? error : new Error(String(error)),
        duration: Date.now() - (taskNode.startTime?.getTime() || Date.now()),
      };

      taskNode._result = _result;

      // Store _result
      this.completedTasks.set(task.id, _result);

      // Remove from executing
      this.executingTasks.delete(task.id);

      // Handle retry
      if (await this.shouldRetry(_task)) {
        logger.info(`Retrying _task ${task.id}`);
        await this.submitTask(_task);
      }

      this.emit("taskFailed", { _task, error });
    }
  }

  /**
   * Check if _task should be retried
   */
  private async shouldRetry(_task: AgentTask): Promise<boolean> {
    // Implementation would check retry count and policy
    // For now, return false
    return false;
  }

  /**
   * Wait for _task completion
   */
  private async waitForTaskCompletion(taskId: string): Promise<AgentResult> {
    return new Promise((resolve) => {
      const _checkInterval = setInterval(() => {
        const _result = this.completedTasks.get(taskId);
        if (_result) {
          clearInterval(_checkInterval);
          resolve(_result);
        }
      }, 100);
    });
  }

  /**
   * Wait for _task dependencies
   */
  private async waitForDependencies(
    _task: AgentTask,
    dependencies: Map<string, string[]>,
  ): Promise<void> {
    const _deps = dependencies.get(_task.id);
    if (!_deps || _deps.length === 0) {
      return;
    }

    await Promise.all(_deps.map((depId) => this.waitForTaskCompletion(depId)));
  }

  /**
   * Wait for all executing _tasks
   */
  private async waitForAllTasks(): Promise<void> {
    const _tasks = Array.from(this.executingTasks.keys());
    await Promise.all(
      _tasks.map((taskId) => this.waitForTaskCompletion(taskId)),
    );
  }

  /**
   * Topological sort for _task dependencies
   */
  private topologicalSort(
    _tasks: TaskNode[],
    dependencies: Map<string, string[]>,
  ): TaskNode[] {
    const sorted: TaskNode[] = [];
    const _visited = new Set<string>();
    const _visiting = new Set<string>();

    const _visit = (_taskId: string) => {
      if (_visited.has(_taskId)) {
        return;
      }
      if (_visiting.has(_taskId)) {
        throw new Error("Circular dependency detected");
      }

      visiting.add(_taskId);

      const _deps = dependencies.get(_taskId) || [];
      for (const depId of _deps) {
        _visit(depId);
      }

      visiting.delete(_taskId);
      visited.add(_taskId);

      const _task = tasks.find((t) => t._task.id === _taskId);
      if (_task) {
        sorted.push(_task);
      }
    };

    for (const _task of _tasks) {
      _visit(_task._task.id);
    }

    return sorted;
  }

  /**
   * Setup _agent event listeners
   */
  private setupAgentListeners(_agent: IAgent): void {
    // Forward _agent events
    const _forwardEvent = (_eventName: string) => {
      agent.on(_eventName, (data) => {
        this.emit(`_agent:${_eventName}`, { _agent: agent.role, data });
      });
    };

    _forwardEvent("initialized");
    _forwardEvent("taskCompleted");
    _forwardEvent("taskFailed");
    _forwardEvent("messageSent");
    _forwardEvent("messageReceived");
    _forwardEvent("shutdown");
  }

  /**
   * Send message between agents
   */
  async routeMessage(message: AgentMessage): Promise<void> {
    if (message.to === "orchestrator") {
      // Handle orchestrator messages
      this.handleOrchestratorMessage(message);
    } else {
      // Route to specific _agent
      const _targetAgent = this.agents.get(message.to as AgentRole);
      if (_targetAgent) {
        await _targetAgent.receiveMessage(message);
      } else {
        logger.warn(
          `Target _agent ${message.to} not found for message routing`,
        );
      }
    }
  }

  /**
   * Handle messages directed to orchestrator
   */
  private handleOrchestratorMessage(message: AgentMessage): void {
    logger.debug(
      `Orchestrator received message from ${message.from}:`,
      message,
    );
    this.emit("messageReceived", message);
  }

  /**
   * Enhanced workflow execution with _result synthesis
   */
  async executeEnhancedWorkflow(
    workflowId: string,
    _tasks: AgentTask[],
    userIntent: string,
  ): Promise<SynthesizedOutput> {
    logger.info(
      `Starting enhanced workflow ${workflowId} with ${tasks.length} _tasks`,
    );

    const _workflowResults = new Map<AgentRole, EnhancedAgentResult>();

    // Execute _tasks with enhanced communication
    for (let i = 0; i < tasks.length; i++) {
      const _task = _tasks[i];

      // Enhanced _task execution with context
      const _result = await this.executeEnhancedTask(_task!, {
        workflowId,
        stepNumber: i + 1,
        previousResults: _workflowResults,
        userIntent,
        totalSteps: tasks.length,
      });

      if (_result.status === "success") {
        workflowResults.set(_result.agentRole, _result as EnhancedAgentResult);
      } else {
        logger.error(`Enhanced _task ${_task!.id} failed, stopping workflow`);
        break;
      }
    }

    // Store workflow _results
    this._workflowResults.set(workflowId, _workflowResults);

    // Synthesize _results
    const _synthesizedOutput = await this.synthesisEngine.synthesizeResults(
      workflowId,
      _workflowResults,
    );

    logger.info(`Enhanced workflow ${workflowId} completed with synthesis`);
    return _synthesizedOutput;
  }

  /**
   * Execute _task with enhanced context and communication
   */
  private async executeEnhancedTask(
    _task: AgentTask,
    workflowContext: {
      workflowId: string;
      stepNumber: number;
      previousResults: Map<AgentRole, EnhancedAgentResult>;
      userIntent: string;
      totalSteps: number;
    },
  ): Promise<EnhancedAgentResult> {
    const _agent = this.selectAgent(_task);
    if (!_agent) {
      throw new Error(`No suitable _agent found for _task ${task.id}`);
    }

    logger.info(
      `Executing enhanced _task ${task.id} with _agent ${_agent.role}`,
    );

    // Create enhanced message for _agent
    const enhancedMessage: EnhancedAgentMessage = {
      id: uuidv4(),
      from: "orchestrator" as AgentRole,
      to: _agent.role,
      type: "request",
      payload: task.input,
      timestamp: new Date(),
      correlationId: task.id,

      dataFlow: {
        inputSchema: { taskType: task.type, priority: task.priority },
        transformations: [],
      },

      context: {
        workflowId: workflowContext.workflowId,
        stepNumber: workflowContext.stepNumber,
        previousResults: workflowContext.previousResults,
        sharedKnowledge: this.extractSharedKnowledge(
          workflowContext.previousResults,
        ),
        userIntent: workflowContext.userIntent,
      },

      quality: {
        confidence: 0.9,
        validationChecks: ["input-validation", "context-validation"],
        errorPrevention: ["timeout-handling", "_result-validation"],
      },
    };

    // Route through enhanced communication broker
    await this.communicationBroker.routeEnhancedMessage(enhancedMessage);

    // Execute _task (this would be enhanced in actual implementation)
    const _baseResult = await _agent.execute(_task);

    // Convert to enhanced _result
    const enhancedResult: EnhancedAgentResult = {
      ..._baseResult,
      structuredOutput: {
        primary: _baseResult.output,
        auxiliary: Record<string, any>,
        insights: ["Task completed successfully"],
        recommendations: ["Review output for accuracy"],
      },
      forwardingData: {
        dataTransfers: new Map(),
        synthesisInstructions: ["Include in final synthesis"],
      },
      qualityMetrics: {
        accuracy: 0.9,
        completeness: 0.95,
        relevance: 0.9,
        coherence: 0.85,
      },
    };

    return enhancedResult;
  }

  /**
   * Extract shared knowledge from previous _results
   */
  private extractSharedKnowledge(
    previousResults: Map<AgentRole, EnhancedAgentResult>,
  ): Record<string, unknown> {
    const sharedKnowledge: Record<string, unknown> = {};

    for (const [role, _result] of previousResults) {
      sharedKnowledge[`${role}_insights`] = result.structuredOutput.insights;
      sharedKnowledge[`${role}_output`] = result.structuredOutput.primary;
    }

    return sharedKnowledge;
  }

  /**
   * Handle message from communication broker
   */
  private handleBrokerMessage(event: {
    _targetAgent: AgentRole | string;
    message: EnhancedAgentMessage;
  }): void {
    logger.debug(`Broker message for ${event.targetAgent}`);
    this.emit("enhancedMessage", event);
  }

  /**
   * Handle synthesis completion
   */
  private handleSynthesisCompletion(output: SynthesizedOutput): void {
    logger.info(`Synthesis completed for workflow ${output.workflowId}`);
    this.emit("workflowSynthesized", output);
  }

  /**
   * Get enhanced orchestrator status
   */
  getEnhancedStatus(): {
    basic: ReturnType<CentralOrchestrator["getStatus"]>;
    workflows: {
      active: number;
      completed: number;
      totalResults: number;
    };
    communication: {
      messagesRouted: number;
      synthesisRules: number;
    };
  } {
    const _basicStatus = this.getStatus();

    return {
      basic: _basicStatus,
      workflows: {
        active: this.executingTasks.size,
        completed: this.workflowResults.size,
        totalResults: Array.from(this.workflowResults.values()).reduce(
          (sum, _results) => sum + _results.size,
          0,
        ),
      },
      communication: {
        messagesRouted: 0, // Would be tracked in implementation
        synthesisRules: 2, // Default rules count
      },
    };
  }
}
