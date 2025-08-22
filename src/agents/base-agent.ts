/**
 * Base Agent Implementation
 * Foundation for all specialized agents in the system
 */

import { EventEmitter } from 'events';
import {
  AgentMessage,
  AgentMetrics,
  AgentResult,
  AgentRole,
  AgentStatus,
  AgentTask,
  IAgent,
} from './types';
import { logger } from '../utils/logger';

export abstract class BaseAgent extends EventEmitter implements IAgent {
  public readonly role: AgentRole;
  public status: AgentStatus = AgentStatus.IDLE;
  public capabilities: string[] = [];

  protected metrics: AgentMetrics = {
    tasksCompleted: 0,
    tasksFailed: 0,
    averageResponseTime: 0,
    currentLoad: 0,
    lastActive: new Date(),
  };

  private responseTimes: number[] = [];
  private readonly maxMetricHistory = 100;

  constructor(role: AgentRole, capabilities: string[]) {
    super();
    this.role = role;
    this.capabilities = capabilities;
  }

  /**
   * Initialize the agent
   */
  async initialize(): Promise<void> {
    logger.info(`Initializing agent: ${this.role}`);
    this.status = AgentStatus.IDLE;
    await this.onInitialize();
    this.emit('initialized', { agent: this.role });
  }

  /**
   * Check if agent can handle a specific task
   */
  canHandle(task: AgentTask): boolean {
    // Check if agent has required capabilities
    const hasCapabilities = task.requiredCapabilities.includes(this.role);

    // Check if agent is available
    const isAvailable = this.status === AgentStatus.IDLE || this.status === AgentStatus.WAITING;

    // Check custom conditions
    const customCheck = this.checkCustomCapabilities(task);

    return hasCapabilities && isAvailable && customCheck;
  }

  /**
   * Execute a task
   */
  async execute(task: AgentTask): Promise<AgentResult> {
    const startTime = Date.now();
    this.status = AgentStatus.PROCESSING;
    this.metrics.currentLoad++;

    logger.debug(`Agent ${this.role} executing task ${task.id}`);

    try {
      // Validate task
      this.validateTask(task);

      // Execute task-specific logic
      const output = await this.performTask(task);

      // Update metrics
      const duration = Date.now() - startTime;
      this.updateMetrics(duration, true);

      const result: AgentResult = {
        taskId: task.id,
        agentRole: this.role,
        status: 'success',
        output,
        duration,
        metadata: this.gatherMetadata(task),
      };

      this.emit('taskCompleted', result);
      return result;
    } catch (error) {
      // Handle errors
      const duration = Date.now() - startTime;
      this.updateMetrics(duration, false);

      logger.error(`Agent ${this.role} failed task ${task.id}:`, error);

      const result: AgentResult = {
        taskId: task.id,
        agentRole: this.role,
        status: 'failure',
        error: error instanceof Error ? error : new Error(String(error)),
        duration,
      };

      this.emit('taskFailed', result);
      return result;
    } finally {
      this.status = AgentStatus.IDLE;
      this.metrics.currentLoad = Math.max(0, this.metrics.currentLoad - 1);
    }
  }

  /**
   * Send a message to other agents or orchestrator
   */
  async sendMessage(message: AgentMessage): Promise<void> {
    message.from = this.role;
    message.timestamp = new Date();

    logger.debug(`Agent ${this.role} sending message to ${message.to}`);
    this.emit('messageSent', message);

    // Message will be handled by orchestrator
    await this.onMessageSent(message);
  }

  /**
   * Receive a message from other agents or orchestrator
   */
  async receiveMessage(message: AgentMessage): Promise<void> {
    logger.debug(`Agent ${this.role} received message from ${message.from}`);

    // Process message based on type
    switch (message.type) {
      case 'request':
        await this.handleRequest(message);
        break;
      case 'response':
        await this.handleResponse(message);
        break;
      case 'notification':
        await this.handleNotification(message);
        break;
      case 'error':
        await this.handleError(message);
        break;
    }

    this.emit('messageReceived', message);
  }

  /**
   * Shutdown the agent
   */
  async shutdown(): Promise<void> {
    logger.info(`Shutting down agent: ${this.role}`);
    this.status = AgentStatus.IDLE;
    await this.onShutdown();
    this.emit('shutdown', { agent: this.role });
    this.removeAllListeners();
  }

  /**
   * Get current agent status
   */
  getStatus(): AgentStatus {
    return this.status;
  }

  /**
   * Get agent metrics
   */
  getMetrics(): AgentMetrics {
    return { ...this.metrics };
  }

  // Protected abstract methods for subclasses
  protected abstract onInitialize(): Promise<void>;
  protected abstract performTask(task: AgentTask): Promise<unknown>;
  protected abstract onShutdown(): Promise<void>;
  protected abstract checkCustomCapabilities(task: AgentTask): boolean;

  // Protected helper methods
  protected validateTask(task: AgentTask): void {
    if (!task.id || !task.type) {
      throw new Error('Invalid task: missing required fields');
    }

    if (task.deadline && new Date(task.deadline) < new Date()) {
      throw new Error('Task deadline has already passed');
    }
  }

  protected gatherMetadata(task: AgentTask): Record<string, unknown> {
    return {
      agentRole: this.role,
      taskType: task.type,
      priority: task.priority,
      timestamp: new Date().toISOString(),
    };
  }

  protected updateMetrics(duration: number, success: boolean): void {
    if (success) {
      this.metrics.tasksCompleted++;
    } else {
      this.metrics.tasksFailed++;
    }

    // Update average response time
    this.responseTimes.push(duration);
    if (this.responseTimes.length > this.maxMetricHistory) {
      this.responseTimes.shift();
    }

    const sum = this.responseTimes.reduce((a, b) => a + b, 0);
    this.metrics.averageResponseTime = sum / this.responseTimes.length;
    this.metrics.lastActive = new Date();
  }

  // Message handling methods
  protected async handleRequest(message: AgentMessage): Promise<void> {
    await this.onMessageReceived(message);
  }

  protected async handleResponse(message: AgentMessage): Promise<void> {
    await this.onMessageReceived(message);
  }

  protected async handleNotification(message: AgentMessage): Promise<void> {
    await this.onMessageReceived(message);
  }

  protected async handleError(message: AgentMessage): Promise<void> {
    logger.error(`Agent ${this.role} received error message:`, message.payload);
    await this.onMessageReceived(message);
  }

  // Optional hooks for subclasses
  protected async onMessageSent(_message: AgentMessage): Promise<void> {
    // Override in subclass if needed
  }

  protected async onMessageReceived(_message: AgentMessage): Promise<void> {
    // Override in subclass if needed
  }
}
