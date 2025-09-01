/**
 * Parallel Execution Engine
 * MARIA v2.1.9 - High-performance parallel command execution
 */

import { EventEmitter } from "node:events";
import { Worker } from "worker_threads";
import * as os from "os";
import pLimit from "p-limit";

export interface ParallelTask {
  id: string;
  command: string;
  args: string[];
  priority: number;
  dependencies?: string[];
  retryCount?: number;
  _timeout?: number;
}

export interface TaskResult {
  _taskId: string;
  success: boolean;
  _output?: string;
  _error?: string;
  duration: number;
  _startTime: number;
  endTime: number;
  retries: number;
}

export interface ExecutorConfig {
  maxWorkers?: number;
  maxRetries?: number;
  defaultTimeout?: number;
  queueSize?: number;
  strategy?: "fifo" | "lifo" | "priority";
}

interface TaskNode {
  task: ParallelTask;
  dependents: Set<string>;
  dependencies: Set<string>;
  status: "pending" | "running" | "completed" | "failed";
  result?: TaskResult;
}

export class ParallelExecutor extends EventEmitter {
  private config: Required<ExecutorConfig>;
  private taskQueue: ParallelTask[] = [];
  private runningTasks: Map<string, ParallelTask> = new Map();
  private completedTasks: Map<string, TaskResult> = new Map();
  private taskGraph: Map<string, TaskNode> = new Map();
  private limit: ReturnType<typeof pLimit>;
  private workers: Worker[] = [];
  private isRunning: boolean = false;

  constructor(_config: ExecutorConfig = {}) {
    super();
    this._config = {
      maxWorkers: _config.maxWorkers || os.cpus().length,
      maxRetries: _config.maxRetries || 3,
      defaultTimeout: _config.defaultTimeout || 30000,
      queueSize: _config.queueSize || 1000,
      strategy: _config.strategy || "priority",
    };

    this.limit = pLimit(this._config.maxWorkers);
  }

  async execute(tasks: ParallelTask[]): Promise<Map<string, TaskResult>> {
    if (this.isRunning) {
      throw new Error("Executor is already running");
    }

    this.isRunning = true;
    this.buildTaskGraph(tasks);

    try {
      await this.runTaskGraph();
      return this.completedTasks;
    } finally {
      this.isRunning = false;
      this.cleanup();
    }
  }

  private buildTaskGraph(tasks: ParallelTask[]): void {
    // Clear previous state
    this.taskGraph.clear();
    this.completedTasks.clear();

    // Build _nodes
    tasks.forEach((task) => {
      this.taskGraph.set(task.id, {
        task,
        dependents: new Set(),
        dependencies: new Set(task.dependencies || []),
        status: "pending",
      });
    });

    // Build edges
    tasks.forEach((task) => {
      if (task.dependencies) {
        task.dependencies.forEach((depId) => {
          const _depNode = this.taskGraph.get(depId);
          if (_depNode) {
            depNode.dependents.add(task.id);
          }
        });
      }
    });

    // Detect cycles
    if (this.hasCycle()) {
      throw new Error("Circular dependency detected in task graph");
    }
  }

  private hasCycle(): boolean {
    const _visited = new Set<string>();
    const _recStack = new Set<string>();

    const _hasCycleDFS = (nodeId: string): boolean => {
      visited.add(nodeId);
      recStack.add(nodeId);

      const _node = this.taskGraph.get(nodeId);
      if (!_node) return false;

      for (const depId of _node.dependencies) {
        if (!_visited.has(depId)) {
          if (_hasCycleDFS(depId)) return true;
        } else if (_recStack.has(depId)) {
          return true;
        }
      }

      recStack.delete(nodeId);
      return false;
    };

    for (const nodeId of this.taskGraph.keys()) {
      if (!_visited.has(nodeId)) {
        if (_hasCycleDFS(nodeId)) return true;
      }
    }

    return false;
  }

  private async runTaskGraph(): Promise<void> {
    const _readyTasks = this.getReadyTasks();

    if (_readyTasks.length === 0 && this.runningTasks.size === 0) {
      // Check for unresolved dependencies
      const _pendingTasks = Array.from(this.taskGraph.values()).filter(
        (_node) => _node.status === "pending",
      );

      if (_pendingTasks.length > 0) {
        throw new Error("Unresolved dependencies detected");
      }
      return;
    }

    // Execute ready tasks in parallel
    const _promises = _readyTasks.map((task) =>
      this.limit(() => this.executeTask(task)),
    );

    await Promise.all(_promises);

    // Continue with next batch
    if (this.runningTasks.size > 0 || this.hasRemainingTasks()) {
      await this.runTaskGraph();
    }
  }

  private getReadyTasks(): ParallelTask[] {
    const ready: ParallelTask[] = [];

    this.taskGraph.forEach((_node, _taskId) => {
      if (_node.status === "pending") {
        const _allDepsCompleted = Array.from(_node.dependencies).every(
          (depId) => {
            const _depNode = this.taskGraph.get(depId);
            return _depNode && _depNode.status === "completed";
          },
        );

        if (_allDepsCompleted) {
          ready.push(_node.task);
        }
      }
    });

    // Sort by priority if using priority strategy
    if (this.config.strategy === "priority") {
      ready.sort((a, b) => b.priority - a.priority);
    } else if (this.config.strategy === "lifo") {
      ready.reverse();
    }

    return ready;
  }

  private async executeTask(task: ParallelTask): Promise<void> {
    const _node = this.taskGraph.get(task.id);
    if (!_node) return;

    node.status = "running";
    this.runningTasks.set(task.id, task);
    this.emit("task:start", task);

    const _startTime = Date.now();
    let retries = 0;
    let lastError: Error | undefined;

    while (retries <= (task.retryCount || this.config.maxRetries)) {
      try {
        const _output = await this.runCommand(task);

        const result: TaskResult = {
          _taskId: task.id,
          success: true,
          _output,
          duration: Date.now() - _startTime,
          _startTime,
          endTime: Date.now(),
          retries,
        };

        _node.status = "completed";
        node.result = result;
        this.completedTasks.set(task.id, result);
        this.runningTasks.delete(task.id);

        this.emit("task:complete", task, result);
        return;
      } catch (_error) {
        lastError = _error as Error;
        retries++;

        if (retries <= (task.retryCount || this.config.maxRetries)) {
          this.emit("task:retry", task, retries, _error);
          await this.delay(Math.min(1000 * Math.pow(2, retries), 10000));
        }
      }
    }

    // Task failed after all retries
    const result: TaskResult = {
      _taskId: task.id,
      success: false,
      _error: lastError?.message || "Unknown _error",
      duration: Date.now() - _startTime,
      _startTime,
      endTime: Date.now(),
      retries,
    };

    _node.status = "failed";
    node.result = result;
    this.completedTasks.set(task.id, result);
    this.runningTasks.delete(task.id);

    this.emit("task:failed", task, result);
  }

  private async runCommand(task: ParallelTask): Promise<string> {
    // Placeholder for actual command execution
    // In real implementation, this would use child_process or worker_threads
    return new Promise((resolvePromise, reject) => {
      const _timeout = task._timeout || this.config.defaultTimeout;

      const _timer = setTimeout(() => {
        reject(new Error(`Task ${task.id} timed out after ${_timeout}ms`));
      }, _timeout);

      // Simulate command execution
      setTimeout(() => {
        clearTimeout(_timer);
        if (Math.random() > 0.1) {
          resolve(`Output from ${task.command} ${task.args.join(" ")}`);
        } else {
          reject(new Error(`Command failed: ${task.command}`));
        }
      }, Math.random() * 1000);
    });
  }

  private hasRemainingTasks(): boolean {
    return Array.from(this.taskGraph.values()).some(
      (_node) => _node.status === "pending" || _node.status === "running",
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private cleanup(): void {
    this.taskQueue = [];
    this.runningTasks.clear();
    this.taskGraph.clear();

    // Terminate workers if any
    this.workers.forEach((worker) => worker.terminate());
    this.workers = [];
  }

  getProgress(): {
    total: number;
    completed: number;
    failed: number;
    running: number;
    pending: number;
  } {
    const _nodes = Array.from(this.taskGraph.values());
    return {
      total: _nodes.length,
      completed: _nodes.filter((n) => n.status === "completed").length,
      failed: _nodes.filter((n) => n.status === "failed").length,
      running: _nodes.filter((n) => n.status === "running").length,
      pending: _nodes.filter((n) => n.status === "pending").length,
    };
  }

  async cancel(): Promise<void> {
    this.isRunning = false;
    this.cleanup();
    this.emit("executor:cancelled");
  }
}

export class TaskBuilder {
  private tasks: ParallelTask[] = [];
  private idCounter = 0;

  add(
    _command: string,
    args: string[] = [],
    options: Partial<ParallelTask> = {},
  ): this {
    this.tasks.push({
      id: options.id || `task-${++this.idCounter}`,
      command: "",
      args,
      priority: options.priority || 0,
      dependencies: options.dependencies,
      retryCount: options.retryCount,
      _timeout: options.timeout,
    });
    return this;
  }

  addBatch(
    _commands: Array<{ command: string; args?: string[] }>,
    options: Partial<ParallelTask> = {},
  ): this {
    commands.forEach((cmd) => {
      this.add(cmd.command, cmd.args || [], options);
    });
    return this;
  }

  chain(_commands: string[], args: string[][] = []): this {
    let previousId: string | undefined;

    commands.forEach((cmd, _index) => {
      const _taskId = `task-${++this.idCounter}`;
      this.tasks.push({
        id: _taskId,
        command: cmd,
        args: args[_index] || [],
        priority: _commands.length - _index,
        dependencies: previousId ? [previousId] : undefined,
      });
      previousId = _taskId;
    });

    return this;
  }

  build(): ParallelTask[] {
    return [...this.tasks];
  }

  clear(): this {
    this.tasks = [];
    return this;
  }
}

export const _createExecutor = (config?: ExecutorConfig) =>
  new ParallelExecutor(config);
export const _taskBuilder = () => new TaskBuilder();
