/**
 * Central Orchestrator for Multi-Agent System
 * Coordinates task distribution and agent communication
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
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
} from './types';
import {
  DataSynthesisEngine,
  EnhancedAgentMessage,
  EnhancedAgentResult,
  EnhancedCommunicationBroker,
  SynthesizedOutput,
} from './enhanced-communication';
import { mcpService as _mcpService } from '../services/mcp-integration';
import { logger } from '../utils/logger';

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
  private workflowResults = new Map<string, Map<AgentRole, EnhancedAgentResult>>();

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
      loadBalancing: config?.loadBalancing ?? 'capability-based',
    };

    // Initialize enhanced communication and synthesis
    this.communicationBroker = new EnhancedCommunicationBroker();
    this.synthesisEngine = new DataSynthesisEngine();

    // Set up broker event listeners
    this.communicationBroker.on('messageForAgent', this.handleBrokerMessage.bind(this));
    this.synthesisEngine.on('synthesisCompleted', this.handleSynthesisCompletion.bind(this));

    // Initialize MCP integration
    // this.initializeMCP(); // Method not implemented yet
  }

  /**
   * Register an agent with the orchestrator
   */
  async registerAgent(agent: IAgent): Promise<void> {
    logger.info(`Registering agent: ${agent.role}`);

    // Initialize agent
    await agent.initialize();

    // Set up agent event listeners
    this.setupAgentListeners(agent);

    // Add to registry
    this.agents.set(agent.role, agent);

    this.emit('agentRegistered', { role: agent.role });
  }

  /**
   * Unregister an agent
   */
  async unregisterAgent(role: AgentRole): Promise<void> {
    const agent = this.agents.get(role);
    if (!agent) {
      logger.warn(`Agent ${role} not found for unregistration`);
      return;
    }

    // Shutdown agent
    await agent.shutdown();

    // Remove from registry
    this.agents.delete(role);

    this.emit('agentUnregistered', { role });
  }

  /**
   * Submit a task for execution
   */
  async submitTask(task: AgentTask): Promise<string> {
    // Assign ID if not present
    if (!task.id) {
      task.id = uuidv4();
    }

    logger.info(`Task ${task.id} submitted for execution`);

    // Add to queue
    this.taskQueue.push(task);

    // Trigger processing if running
    if (this.isRunning) {
      this.processQueue();
    }

    this.emit('taskSubmitted', task);

    return task.id;
  }

  /**
   * Create and execute an execution plan
   */
  async executePlan(plan: ExecutionPlan): Promise<Map<string, AgentResult>> {
    logger.info(`Executing plan ${plan.id} with ${plan.tasks.length} tasks`);

    const results = new Map<string, AgentResult>();

    // Sort tasks by dependencies
    const sortedTasks = this.topologicalSort(plan.tasks, plan.dependencies);

    // Execute tasks in order
    for (const taskNode of sortedTasks) {
      // Wait for dependencies
      await this.waitForDependencies(taskNode.task, plan.dependencies);

      // Submit task
      await this.submitTask(taskNode.task);

      // Wait for completion
      const result = await this.waitForTaskCompletion(taskNode.task.id);
      results.set(taskNode.task.id, result);

      // Check if we should continue
      if (result.status === 'failure') {
        logger.error(`Task ${taskNode.task.id} failed, stopping plan execution`);
        break;
      }
    }

    return results;
  }

  /**
   * Start the orchestrator
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('Orchestrator is already running');
      return;
    }

    logger.info('Starting orchestrator');
    this.isRunning = true;

    // Start processing loop
    this.processingInterval = setInterval(() => {
      this.processQueue();
    }, 1000); // Process every second

    this.emit('started');
  }

  /**
   * Stop the orchestrator
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Orchestrator is not running');
      return;
    }

    logger.info('Stopping orchestrator');
    this.isRunning = false;

    // Clear processing interval
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = undefined;
    }

    // Wait for executing tasks to complete
    await this.waitForAllTasks();

    // Shutdown all agents
    for (const agent of this.agents.values()) {
      await agent.shutdown();
    }

    this.emit('stopped');
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
   * Process the task queue
   */
  private processQueue(): void {
    // Check if we can process more tasks
    if (this.executingTasks.size >= this.config.maxConcurrentTasks) {
      return;
    }

    // Get next task from queue
    const task = this.taskQueue.shift();
    if (!task) {
      return;
    }

    // Find suitable agent
    const agent = this.selectAgent(task);
    if (!agent) {
      logger.warn(`No suitable agent found for task ${task.id}`);
      // Re-queue task
      this.taskQueue.unshift(task);
      return;
    }

    // Execute task
    this.executeTask(task, agent);
  }

  /**
   * Select the best agent for a task
   */
  private selectAgent(task: AgentTask): IAgent | null {
    const availableAgents = Array.from(this.agents.values()).filter((agent) =>
      agent.canHandle(task),
    );

    if (availableAgents.length === 0) {
      return null;
    }

    // Apply load balancing strategy
    switch (this.config.loadBalancing) {
      case 'round-robin':
        return this.selectRoundRobin(availableAgents);

      case 'least-loaded':
        return this.selectLeastLoaded(availableAgents);

      case 'capability-based':
      default:
        return this.selectByCapability(availableAgents, task);
    }
  }

  /**
   * Round-robin selection
   */
  private selectRoundRobin(agents: IAgent[]): IAgent {
    // Simple round-robin (could be improved with state tracking)
    if (agents.length === 0) {
      throw new Error('No agents available for selection');
    }
    return agents[0]!; // Non-null assertion since we checked length above
  }

  /**
   * Select least loaded agent
   */
  private selectLeastLoaded(agents: IAgent[]): IAgent {
    if (agents.length === 0) {
      throw new Error('No agents available for selection');
    }
    return agents.reduce((least, current) => {
      const leastMetrics = least.getMetrics();
      const currentMetrics = current.getMetrics();
      return currentMetrics.currentLoad < leastMetrics.currentLoad ? current : least;
    });
  }

  /**
   * Select agent based on capabilities
   */
  private selectByCapability(agents: IAgent[], task: AgentTask): IAgent | null {
    // Score agents based on capability match
    const scored = agents.map((agent) => {
      const score = task.requiredCapabilities.filter((cap) => agent.role === cap).length;
      return { agent, score };
    });

    // Sort by score and return best match
    scored.sort((a, b) => b.score - a.score);
    return scored[0]?.agent || null;
  }

  /**
   * Execute a task with an agent
   */
  private async executeTask(task: AgentTask, agent: IAgent): Promise<void> {
    const taskNode: TaskNode = {
      id: task.id,
      task,
      assignedAgent: agent.role,
      status: 'running',
      startTime: new Date(),
    };

    this.executingTasks.set(task.id, taskNode);

    logger.info(`Executing task ${task.id} with agent ${agent.role}`);

    try {
      // Set timeout for task execution
      const timeoutPromise = new Promise<AgentResult>((_, reject) => {
        setTimeout(() => reject(new Error('Task timeout')), this.config.taskTimeout);
      });

      // Execute task
      const result = await Promise.race([agent.execute(task), timeoutPromise]);

      // Update task node
      taskNode.status = 'completed';
      taskNode.endTime = new Date();
      taskNode.result = result;

      // Store result
      this.completedTasks.set(task.id, result);

      // Remove from executing
      this.executingTasks.delete(task.id);

      this.emit('taskCompleted', { task, result });
    } catch (error) {
      logger.error(`Task ${task.id} failed:`, error);

      // Update task node
      taskNode.status = 'failed';
      taskNode.endTime = new Date();

      // Create failure result
      const result: AgentResult = {
        taskId: task.id,
        agentRole: agent.role,
        status: 'failure',
        error: error instanceof Error ? error : new Error(String(error)),
        duration: Date.now() - (taskNode.startTime?.getTime() || Date.now()),
      };

      taskNode.result = result;

      // Store result
      this.completedTasks.set(task.id, result);

      // Remove from executing
      this.executingTasks.delete(task.id);

      // Handle retry
      if (await this.shouldRetry(task)) {
        logger.info(`Retrying task ${task.id}`);
        await this.submitTask(task);
      }

      this.emit('taskFailed', { task, error });
    }
  }

  /**
   * Check if task should be retried
   */
  private async shouldRetry(_task: AgentTask): Promise<boolean> {
    // Implementation would check retry count and policy
    // For now, return false
    return false;
  }

  /**
   * Wait for task completion
   */
  private async waitForTaskCompletion(taskId: string): Promise<AgentResult> {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        const result = this.completedTasks.get(taskId);
        if (result) {
          clearInterval(checkInterval);
          resolve(result);
        }
      }, 100);
    });
  }

  /**
   * Wait for task dependencies
   */
  private async waitForDependencies(
    task: AgentTask,
    dependencies: Map<string, string[]>,
  ): Promise<void> {
    const deps = dependencies.get(task.id);
    if (!deps || deps.length === 0) {
      return;
    }

    await Promise.all(deps.map((depId) => this.waitForTaskCompletion(depId)));
  }

  /**
   * Wait for all executing tasks
   */
  private async waitForAllTasks(): Promise<void> {
    const tasks = Array.from(this.executingTasks.keys());
    await Promise.all(tasks.map((taskId) => this.waitForTaskCompletion(taskId)));
  }

  /**
   * Topological sort for task dependencies
   */
  private topologicalSort(tasks: TaskNode[], dependencies: Map<string, string[]>): TaskNode[] {
    const sorted: TaskNode[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (taskId: string) => {
      if (visited.has(taskId)) {return;}
      if (visiting.has(taskId)) {
        throw new Error('Circular dependency detected');
      }

      visiting.add(taskId);

      const deps = dependencies.get(taskId) || [];
      for (const depId of deps) {
        visit(depId);
      }

      visiting.delete(taskId);
      visited.add(taskId);

      const task = tasks.find((t) => t.task.id === taskId);
      if (task) {
        sorted.push(task);
      }
    };

    for (const task of tasks) {
      visit(task.task.id);
    }

    return sorted;
  }

  /**
   * Setup agent event listeners
   */
  private setupAgentListeners(agent: IAgent): void {
    // Forward agent events
    const forwardEvent = (eventName: string) => {
      agent.on(eventName, (data) => {
        this.emit(`agent:${eventName}`, { agent: agent.role, data });
      });
    };

    forwardEvent('initialized');
    forwardEvent('taskCompleted');
    forwardEvent('taskFailed');
    forwardEvent('messageSent');
    forwardEvent('messageReceived');
    forwardEvent('shutdown');
  }

  /**
   * Send message between agents
   */
  async routeMessage(message: AgentMessage): Promise<void> {
    if (message.to === 'orchestrator') {
      // Handle orchestrator messages
      this.handleOrchestratorMessage(message);
    } else {
      // Route to specific agent
      const targetAgent = this.agents.get(message.to as AgentRole);
      if (targetAgent) {
        await targetAgent.receiveMessage(message);
      } else {
        logger.warn(`Target agent ${message.to} not found for message routing`);
      }
    }
  }

  /**
   * Handle messages directed to orchestrator
   */
  private handleOrchestratorMessage(message: AgentMessage): void {
    logger.debug(`Orchestrator received message from ${message.from}:`, message);
    this.emit('messageReceived', message);
  }

  /**
   * Enhanced workflow execution with result synthesis
   */
  async executeEnhancedWorkflow(
    workflowId: string,
    tasks: AgentTask[],
    userIntent: string,
  ): Promise<SynthesizedOutput> {
    logger.info(`Starting enhanced workflow ${workflowId} with ${tasks.length} tasks`);

    const workflowResults = new Map<AgentRole, EnhancedAgentResult>();

    // Execute tasks with enhanced communication
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];

      // Enhanced task execution with context
      const result = await this.executeEnhancedTask(task!, {
        workflowId,
        stepNumber: i + 1,
        previousResults: workflowResults,
        userIntent,
        totalSteps: tasks.length,
      });

      if (result.status === 'success') {
        workflowResults.set(result.agentRole, result as EnhancedAgentResult);
      } else {
        logger.error(`Enhanced task ${task!.id} failed, stopping workflow`);
        break;
      }
    }

    // Store workflow results
    this.workflowResults.set(workflowId, workflowResults);

    // Synthesize results
    const synthesizedOutput = await this.synthesisEngine.synthesizeResults(
      workflowId,
      workflowResults,
    );

    logger.info(`Enhanced workflow ${workflowId} completed with synthesis`);
    return synthesizedOutput;
  }

  /**
   * Execute task with enhanced context and communication
   */
  private async executeEnhancedTask(
    task: AgentTask,
    workflowContext: {
      workflowId: string;
      stepNumber: number;
      previousResults: Map<AgentRole, EnhancedAgentResult>;
      userIntent: string;
      totalSteps: number;
    },
  ): Promise<EnhancedAgentResult> {
    const agent = this.selectAgent(task);
    if (!agent) {
      throw new Error(`No suitable agent found for task ${task.id}`);
    }

    logger.info(`Executing enhanced task ${task.id} with agent ${agent.role}`);

    // Create enhanced message for agent
    const enhancedMessage: EnhancedAgentMessage = {
      id: uuidv4(),
      from: 'orchestrator' as AgentRole,
      to: agent.role,
      type: 'request',
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
        sharedKnowledge: this.extractSharedKnowledge(workflowContext.previousResults),
        userIntent: workflowContext.userIntent,
      },

      quality: {
        confidence: 0.9,
        validationChecks: ['input-validation', 'context-validation'],
        errorPrevention: ['timeout-handling', 'result-validation'],
      },
    };

    // Route through enhanced communication broker
    await this.communicationBroker.routeEnhancedMessage(enhancedMessage);

    // Execute task (this would be enhanced in actual implementation)
    const baseResult = await agent.execute(task);

    // Convert to enhanced result
    const enhancedResult: EnhancedAgentResult = {
      ...baseResult,
      structuredOutput: {
        primary: baseResult.output,
        auxiliary: {},
        insights: ['Task completed successfully'],
        recommendations: ['Review output for accuracy'],
      },
      forwardingData: {
        dataTransfers: new Map(),
        synthesisInstructions: ['Include in final synthesis'],
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
   * Extract shared knowledge from previous results
   */
  private extractSharedKnowledge(
    previousResults: Map<AgentRole, EnhancedAgentResult>,
  ): Record<string, unknown> {
    const sharedKnowledge: Record<string, unknown> = {};

    for (const [role, result] of previousResults) {
      sharedKnowledge[`${role}_insights`] = result.structuredOutput.insights;
      sharedKnowledge[`${role}_output`] = result.structuredOutput.primary;
    }

    return sharedKnowledge;
  }

  /**
   * Handle message from communication broker
   */
  private handleBrokerMessage(event: {
    targetAgent: AgentRole | string;
    message: EnhancedAgentMessage;
  }): void {
    logger.debug(`Broker message for ${event.targetAgent}`);
    this.emit('enhancedMessage', event);
  }

  /**
   * Handle synthesis completion
   */
  private handleSynthesisCompletion(output: SynthesizedOutput): void {
    logger.info(`Synthesis completed for workflow ${output.workflowId}`);
    this.emit('workflowSynthesized', output);
  }

  /**
   * Get enhanced orchestrator status
   */
  getEnhancedStatus(): {
    basic: ReturnType<CentralOrchestrator['getStatus']>;
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
    const basicStatus = this.getStatus();

    return {
      basic: basicStatus,
      workflows: {
        active: this.executingTasks.size,
        completed: this.workflowResults.size,
        totalResults: Array.from(this.workflowResults.values()).reduce(
          (sum, results) => sum + results.size,
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
