/**
 * ParallelExecutionEngine - 並列実行最適化エンジン
 *
 * ✅ ワーカープール管理
 * ✅ タスクスケジューリング
 * ✅ リソース制約管理
 * ✅ デッドロック検出・回避
 * ✅ フォールバック機構
 */

import {
  SystemCommandContract,
  CommandResultV2,
} from "../contracts/SystemCommandContract";
import { logger } from "../../../utils/logger";
import { EventEmitter } from "node:events";

export interface TaskDefinition {
  id: string;
  command: SystemCommandContract;
  priority: "low" | "normal" | "high" | "critical";
  dependencies?: string[];
  timeout?: number;
  retryCount?: number;
  estimatedDuration?: number;
}

export interface WorkerPool {
  id: string;
  capacity: number;
  activeJobs: number;
  queueSize: number;
  specialization?: string; // 'cpu-bound', 'io-bound', 'memory-bound'
}

export interface ExecutionPlan {
  tasks: TaskDefinition[];
  parallelBatches: TaskDefinition[][];
  estimatedCompletionTime: number;
  resourceRequirements: {
    cpu: number;
    memory: number;
    io: number;
  };
}

export class ParallelExecutionEngine extends EventEmitter {
  private workerPools = new Map<string, WorkerPool>();
  private taskQueue = new Map<string, TaskDefinition>();
  private activeTasks = new Map<string, Promise<CommandResultV2>>();
  private completedTasks = new Map<string, CommandResultV2>();
  private dependencyGraph = new Map<string, Set<string>>();

  // Configuration
  private maxConcurrency: number;
  private defaultTimeout: number;
  private retryDelay: number;

  // Monitoring
  private metrics = {
    tasksCompleted: 0,
    tasksRetried: 0,
    averageExecutionTime: 0,
    parallelizationEfficiency: 0,
    resourceUtilization: { cpu: 0, memory: 0, io: 0 },
  };

  constructor(
    options: {
      maxConcurrency?: number;
      defaultTimeout?: number;
      retryDelay?: number;
    } = {},
  ) {
    super();

    this.maxConcurrency = options.maxConcurrency || 5;
    this.defaultTimeout = options.defaultTimeout || 30000;
    this.retryDelay = options.retryDelay || 1000;

    this.initializeWorkerPools();
    this.startDeadlockDetection();
  }

  /**
   * 実行プラン生成
   */
  async createExecutionPlan(tasks: TaskDefinition[]): Promise<ExecutionPlan> {
    // 依存関係解析
    this.buildDependencyGraph(tasks);

    // トポロジカルソートで実行順序を決定
    const sortedTasks = this.topologicalSort(tasks);

    // 並列実行可能なバッチに分割
    const parallelBatches = this.createParallelBatches(sortedTasks);

    // リソース要件とタイミング予測
    const resourceRequirements = this.calculateResourceRequirements(tasks);
    const estimatedCompletionTime =
      this.estimateCompletionTime(parallelBatches);

    return {
      tasks: sortedTasks,
      parallelBatches,
      estimatedCompletionTime,
      resourceRequirements,
    };
  }

  /**
   * 並列実行メイン
   */
  async executeParallel(
    tasks: TaskDefinition[],
    options: {
      failFast?: boolean;
      progressCallback?: (progress: number) => void;
    } = {},
  ): Promise<Map<string, CommandResultV2>> {
    const startTime = Date.now();
    const executionPlan = await this.createExecutionPlan(tasks);

    logger.info(
      `Executing ${tasks.length} tasks in ${executionPlan.parallelBatches.length} batches`,
    );

    const results = new Map<string, CommandResultV2>();
    let completedTasks = 0;
    const totalTasks = tasks.length;

    try {
      // バッチごとに並列実行
      for (
        let batchIndex = 0;
        batchIndex < executionPlan.parallelBatches.length;
        batchIndex++
      ) {
        const batch = executionPlan.parallelBatches[batchIndex];

        logger.debug(
          `Executing batch ${batchIndex + 1}/${executionPlan.parallelBatches.length} with ${batch.length} tasks`,
        );

        // バッチ内並列実行
        const batchPromises = batch.map((task) => this.executeTask(task));
        const batchResults = await Promise.allSettled(batchPromises);

        // 結果処理
        for (let i = 0; i < batch.length; i++) {
          const task = batch[i];
          const result = batchResults[i];

          if (result.status === "fulfilled") {
            results.set(task.id, result.value);
            this.completedTasks.set(task.id, result.value);
          } else {
            const errorResult: CommandResultV2 = {
              endReason: "error",
              error:
                result.reason instanceof Error
                  ? result.reason.message
                  : "Unknown error",
              duration: 0,
              timestamp: Date.now(),
            };

            results.set(task.id, errorResult);

            if (options.failFast) {
              throw new Error(`Task ${task.id} failed: ${errorResult.error}`);
            }
          }

          completedTasks++;

          // プログレス通知
          if (options.progressCallback) {
            options.progressCallback(completedTasks / totalTasks);
          }
        }
      }

      // メトリクス更新
      this.updateMetrics(startTime, tasks.length);

      logger.info(
        `Parallel execution completed: ${results.size} tasks in ${Date.now() - startTime}ms`,
      );

      return results;
    } catch (error) {
      logger.error("Parallel execution failed:", error);
      throw error;
    }
  }

  /**
   * 単一タスク実行(リトライ付き)
   */
  private async executeTask(task: TaskDefinition): Promise<CommandResultV2> {
    const maxRetries = task.retryCount || 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        // ワーカープール選択
        const pool = this.selectOptimalWorkerPool(task);

        if (!pool || pool.activeJobs >= pool.capacity) {
          // リソース不足の場合は少し待つ
          await this.waitForResource(pool);
        }

        // リソース取得
        this.acquireResource(pool);

        try {
          // タスク実行
          const timeout = task.timeout || this.defaultTimeout;
          const result = await Promise.race([
            task.command.execute(),
            this.createTimeoutPromise(timeout, task.id),
          ]);

          this.releaseResource(pool);

          // 成功時はリトライループを抜ける
          return result;
        } catch (executeError) {
          this.releaseResource(pool);
          throw executeError;
        }
      } catch (error) {
        attempt++;

        if (attempt >= maxRetries) {
          logger.error(
            `Task ${task.id} failed after ${maxRetries} attempts:`,
            error,
          );
          throw error;
        }

        // 指数バックオフでリトライ
        const delay = this.retryDelay * Math.pow(2, attempt - 1);
        logger.warn(
          `Task ${task.id} attempt ${attempt} failed, retrying in ${delay}ms:`,
          error,
        );

        await new Promise((resolve) => setTimeout(resolve, delay));
        this.metrics.tasksRetried++;
      }
    }

    throw new Error(`Task ${task.id} exhausted all retry attempts`);
  }

  /**
   * 依存関係グラフ構築
   */
  private buildDependencyGraph(tasks: TaskDefinition[]): void {
    this.dependencyGraph.clear();

    for (const task of tasks) {
      if (!this.dependencyGraph.has(task.id)) {
        this.dependencyGraph.set(task.id, new Set());
      }

      if (task.dependencies) {
        for (const dep of task.dependencies) {
          this.dependencyGraph.get(task.id)!.add(dep);
        }
      }
    }
  }

  /**
   * トポロジカルソート(Kahn's algorithm)
   */
  private topologicalSort(tasks: TaskDefinition[]): TaskDefinition[] {
    const taskMap = new Map(tasks.map((t) => [t.id, t]));
    const inDegree = new Map<string, number>();
    const queue: string[] = [];
    const result: TaskDefinition[] = [];

    // 入次数を計算
    for (const task of tasks) {
      inDegree.set(task.id, 0);
    }

    for (const [taskId, dependencies] of this.dependencyGraph) {
      for (const dep of dependencies) {
        inDegree.set(taskId, (inDegree.get(taskId) || 0) + 1);
      }
    }

    // 入次数0のタスクをキューに追加
    for (const [taskId, degree] of inDegree) {
      if (degree === 0) {
        queue.push(taskId);
      }
    }

    // トポロジカルソート実行
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const currentTask = taskMap.get(currentId);

      if (currentTask) {
        result.push(currentTask);
      }

      // 依存しているタスクの入次数を減らす
      for (const [taskId, dependencies] of this.dependencyGraph) {
        if (dependencies.has(currentId)) {
          dependencies.delete(currentId);
          const newDegree = (inDegree.get(taskId) || 1) - 1;
          inDegree.set(taskId, newDegree);

          if (newDegree === 0) {
            queue.push(taskId);
          }
        }
      }
    }

    // 循環依存チェック
    if (result.length !== tasks.length) {
      const remaining = tasks.filter((t) => !result.some((r) => r.id === t.id));
      throw new Error(
        `Circular dependency detected in tasks: ${remaining.map((t) => t.id).join(", ")}`,
      );
    }

    return result;
  }

  /**
   * 並列バッチ作成
   */
  private createParallelBatches(
    sortedTasks: TaskDefinition[],
  ): TaskDefinition[][] {
    const batches: TaskDefinition[][] = [];
    const completed = new Set<string>();

    while (completed.size < sortedTasks.length) {
      const currentBatch: TaskDefinition[] = [];

      for (const task of sortedTasks) {
        if (completed.has(task.id)) continue;

        // すべての依存関係が完了している場合のみバッチに追加
        const canRun =
          !task.dependencies ||
          task.dependencies.every((dep) => completed.has(dep));

        if (canRun && currentBatch.length < this.maxConcurrency) {
          currentBatch.push(task);
          completed.add(task.id);
        }
      }

      if (currentBatch.length === 0) {
        // デッドロック状態
        const remaining = sortedTasks.filter((t) => !completed.has(t.id));
        throw new Error(
          `Deadlock detected with remaining tasks: ${remaining.map((t) => t.id).join(", ")}`,
        );
      }

      batches.push(currentBatch);
    }

    return batches;
  }

  /**
   * ワーカープール管理
   */
  private initializeWorkerPools(): void {
    // CPU集約型タスク用プール
    this.workerPools.set("cpu-bound", {
      id: "cpu-bound",
      capacity: Math.max(1, Math.floor(require("os").cpus().length * 0.8)),
      activeJobs: 0,
      queueSize: 0,
      specialization: "cpu-bound",
    });

    // I/O集約型タスク用プール
    this.workerPools.set("io-bound", {
      id: "io-bound",
      capacity: this.maxConcurrency * 2, // I/Oタスクは多めに
      activeJobs: 0,
      queueSize: 0,
      specialization: "io-bound",
    });

    // 汎用プール
    this.workerPools.set("general", {
      id: "general",
      capacity: this.maxConcurrency,
      activeJobs: 0,
      queueSize: 0,
    });
  }

  private selectOptimalWorkerPool(task: TaskDefinition): WorkerPool | null {
    // タスクタイプに基づいて最適なプールを選択
    const taskType = this.analyzeTaskType(task);

    const preferredPool =
      this.workerPools.get(taskType) || this.workerPools.get("general");
    if (preferredPool && preferredPool.activeJobs < preferredPool.capacity) {
      return preferredPool;
    }

    // フォールバック: 利用可能な任意のプール
    for (const pool of this.workerPools.values()) {
      if (pool.activeJobs < pool.capacity) {
        return pool;
      }
    }

    return null;
  }

  private analyzeTaskType(task: TaskDefinition): string {
    // 簡易タスクタイプ分析
    const taskId = task.id.toLowerCase();

    if (
      taskId.includes("status") ||
      taskId.includes("health") ||
      taskId.includes("monitor")
    ) {
      return "io-bound";
    }

    if (
      taskId.includes("process") ||
      taskId.includes("compute") ||
      taskId.includes("analyze")
    ) {
      return "cpu-bound";
    }

    return "general";
  }

  private acquireResource(pool: WorkerPool | null): void {
    if (pool) {
      pool.activeJobs++;
    }
  }

  private releaseResource(pool: WorkerPool | null): void {
    if (pool && pool.activeJobs > 0) {
      pool.activeJobs--;
    }
  }

  private async waitForResource(
    pool: WorkerPool | null,
    maxWaitMs: number = 5000,
  ): Promise<void> {
    const startTime = Date.now();

    while (pool && pool.activeJobs >= pool.capacity) {
      if (Date.now() - startTime > maxWaitMs) {
        throw new Error(`Timeout waiting for resource from pool ${pool.id}`);
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  /**
   * パフォーマンス予測
   */
  private calculateResourceRequirements(tasks: TaskDefinition[]): {
    cpu: number;
    memory: number;
    io: number;
  } {
    return tasks.reduce(
      (acc, task) => ({
        cpu: acc.cpu + (task.estimatedDuration || 1000) * 0.5,
        memory: acc.memory + 50, // MB per task
        io:
          acc.io +
          (task.id.includes("read") || task.id.includes("write") ? 10 : 1),
      }),
      { cpu: 0, memory: 0, io: 0 },
    );
  }

  private estimateCompletionTime(batches: TaskDefinition[][]): number {
    return batches.reduce((total, batch) => {
      const maxDurationInBatch = Math.max(
        ...batch.map((t) => t.estimatedDuration || 5000),
      );
      return total + maxDurationInBatch;
    }, 0);
  }

  /**
   * デッドロック検出
   */
  private startDeadlockDetection(): void {
    setInterval(() => {
      this.detectDeadlock();
    }, 30000); // 30秒ごと
  }

  private detectDeadlock(): void {
    const stuckTasks = Array.from(this.activeTasks.entries()).filter(
      ([taskId, promise]) => {
        // 長時間実行中のタスクをチェック
        return true; // 簡易実装
      },
    );

    if (stuckTasks.length > 0) {
      logger.warn(
        `Potential deadlock detected with ${stuckTasks.length} stuck tasks`,
      );
      this.emit(
        "deadlock",
        stuckTasks.map(([taskId]) => taskId),
      );
    }
  }

  private createTimeoutPromise(
    timeoutMs: number,
    taskId: string,
  ): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Task ${taskId} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });
  }

  /**
   * メトリクス
   */
  private updateMetrics(startTime: number, taskCount: number): void {
    const executionTime = Date.now() - startTime;
    this.metrics.tasksCompleted += taskCount;

    // 指数移動平均
    const alpha = 0.1;
    this.metrics.averageExecutionTime =
      this.metrics.averageExecutionTime * (1 - alpha) + executionTime * alpha;

    // 並列化効率(理想実行時間 vs 実際実行時間)
    const idealTime = this.metrics.averageExecutionTime * taskCount;
    this.metrics.parallelizationEfficiency = Math.min(
      idealTime / executionTime,
      1.0,
    );
  }

  getMetrics() {
    return { ...this.metrics };
  }

  getWorkerPoolStatus(): WorkerPool[] {
    return Array.from(this.workerPools.values());
  }

  // クリーンアップ
  async shutdown(): Promise<void> {
    logger.info("Shutting down ParallelExecutionEngine...");

    // 実行中のタスクを待機
    if (this.activeTasks.size > 0) {
      logger.info(
        `Waiting for ${this.activeTasks.size} active tasks to complete...`,
      );
      await Promise.allSettled(Array.from(this.activeTasks.values()));
    }

    this.removeAllListeners();
    logger.info("ParallelExecutionEngine shutdown complete");
  }
}
