/**
 * Progress Tracker Service
 * タスクの進捗を追跡・管理する
 */

import { EventEmitter } from 'events';
import { Task } from './auto-mode-controller';
import { logger } from '../utils/logger';

export interface ProgressUpdate {
  missionId: string;
  overall: number;
  phase: string;
  currentTask: string;
  tasksCompleted: number;
  totalTasks: number;
  estimatedTimeRemaining: number;
  message?: string;
}

interface MissionProgress {
  missionId: string;
  tasks: Map<string, TaskProgress>;
  startTime: Date;
  completedTasks: number;
  totalTasks: number;
}

interface TaskProgress {
  taskId: string;
  status: Task['status'];
  progress: number;
  startTime?: Date;
  endTime?: Date;
  duration?: number;
}

export class ProgressTracker extends EventEmitter {
  private missions: Map<string, MissionProgress> = new Map();
  private updateInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.startUpdateInterval();
  }

  /**
   * ミッションの追跡を開始
   */
  startTracking(missionId: string, tasks: Task[]): void {
    const taskMap = new Map<string, TaskProgress>();

    tasks.forEach((task) => {
      taskMap.set(task.id, {
        taskId: task.id,
        status: task.status,
        progress: 0,
      });
    });

    this.missions.set(missionId, {
      missionId,
      tasks: taskMap,
      startTime: new Date(),
      completedTasks: 0,
      totalTasks: tasks.length,
    });

    logger.info(`Started tracking mission: ${missionId} with ${tasks.length} tasks`);
  }

  /**
   * タスクの進捗を更新
   */
  updateTask(
    missionId: string,
    taskId: string,
    update: Partial<Task> & { progress?: number },
  ): void {
    const mission = this.missions.get(missionId);
    if (!mission) {
      logger.warn(`Mission ${missionId} not found for progress update`);
      return;
    }

    const taskProgress = mission.tasks.get(taskId);
    if (!taskProgress) {
      logger.warn(`Task ${taskId} not found in mission ${missionId}`);
      return;
    }

    // ステータス更新
    if (update.status) {
      const wasCompleted = taskProgress.status === 'completed';
      taskProgress.status = update.status;

      // 開始時刻記録
      if (update.status === 'in_progress' && !taskProgress.startTime) {
        taskProgress.startTime = new Date();
      }

      // 完了時の処理
      if (update.status === 'completed' && !wasCompleted) {
        taskProgress.endTime = new Date();
        taskProgress.progress = 100;
        mission.completedTasks++;

        if (taskProgress.startTime) {
          taskProgress.duration = taskProgress.endTime.getTime() - taskProgress.startTime.getTime();
        }
      }
    }

    // 進捗率更新
    if ('progress' in update && typeof update.progress === 'number') {
      taskProgress.progress = update.progress;
    }

    // 進捗イベントを発行
    this.emitProgress(missionId);
  }

  /**
   * 現在の進捗を取得
   */
  getProgress(missionId: string): ProgressUpdate | null {
    const mission = this.missions.get(missionId);
    if (!mission) {
      return null;
    }

    const currentTask = this.getCurrentTask(mission);
    const overall = this.calculateOverallProgress(mission);
    const estimatedTimeRemaining = this.estimateTimeRemaining(mission);

    return {
      missionId,
      overall,
      phase: this.getCurrentPhase(mission),
      currentTask: currentTask?.taskId || 'None',
      tasksCompleted: mission.completedTasks,
      totalTasks: mission.totalTasks,
      estimatedTimeRemaining,
      message: this.generateProgressMessage(mission, currentTask),
    };
  }

  /**
   * ミッション追跡を終了
   */
  stopTracking(missionId: string): void {
    this.missions.delete(missionId);
    logger.info(`Stopped tracking mission: ${missionId}`);
  }

  /**
   * 現在実行中のタスクを取得
   */
  private getCurrentTask(mission: MissionProgress): TaskProgress | undefined {
    return Array.from(mission.tasks.values()).find((task) => task.status === 'in_progress');
  }

  /**
   * 現在のフェーズを判定
   */
  private getCurrentPhase(mission: MissionProgress): string {
    const completionRate = mission.completedTasks / mission.totalTasks;

    if (completionRate === 0) {
      return '開始';
    } else if (completionRate < 0.25) {
      return '初期段階';
    } else if (completionRate < 0.5) {
      return '前半';
    } else if (completionRate < 0.75) {
      return '後半';
    } else if (completionRate < 1) {
      return '最終段階';
    } else {
      return '完了';
    }
  }

  /**
   * 全体の進捗率を計算
   */
  private calculateOverallProgress(mission: MissionProgress): number {
    if (mission.totalTasks === 0) return 0;

    let totalProgress = 0;
    mission.tasks.forEach((task) => {
      if (task.status === 'completed') {
        totalProgress += 100;
      } else if (task.status === 'in_progress') {
        totalProgress += task.progress;
      }
    });

    return Math.round(totalProgress / mission.totalTasks);
  }

  /**
   * 残り時間を推定
   */
  private estimateTimeRemaining(mission: MissionProgress): number {
    const completedTasks = Array.from(mission.tasks.values()).filter(
      (task) => task.status === 'completed' && task.duration,
    );

    if (completedTasks.length === 0) {
      // デフォルト推定（1タスク5分）
      return (mission.totalTasks - mission.completedTasks) * 5 * 60 * 1000;
    }

    // 完了済みタスクの平均時間から推定
    const avgDuration =
      completedTasks.reduce((sum, task) => sum + (task.duration || 0), 0) / completedTasks.length;

    const remainingTasks = mission.totalTasks - mission.completedTasks;
    return Math.round(avgDuration * remainingTasks);
  }

  /**
   * 進捗メッセージを生成
   */
  private generateProgressMessage(mission: MissionProgress, currentTask?: TaskProgress): string {
    if (mission.completedTasks === mission.totalTasks) {
      return 'すべてのタスクが完了しました！';
    }

    if (currentTask) {
      return `タスク「${currentTask.taskId}」を実行中...`;
    }

    if (mission.completedTasks === 0) {
      return 'ミッションを開始しています...';
    }

    return `${mission.completedTasks}/${mission.totalTasks} タスク完了`;
  }

  /**
   * 進捗イベントを発行
   */
  private emitProgress(missionId: string): void {
    const progress = this.getProgress(missionId);
    if (progress) {
      this.emit('update', progress);
    }
  }

  /**
   * 定期的な進捗更新を開始
   */
  private startUpdateInterval(): void {
    this.updateInterval = setInterval(() => {
      this.missions.forEach((mission, missionId) => {
        // 実行中のタスクがある場合のみ更新
        const hasActiveTasks = Array.from(mission.tasks.values()).some(
          (task) => task.status === 'in_progress',
        );

        if (hasActiveTasks) {
          this.emitProgress(missionId);
        }
      });
    }, 2000); // 2秒ごとに更新
  }

  /**
   * クリーンアップ
   */
  destroy(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    this.missions.clear();
    this.removeAllListeners();
  }

  /**
   * ミッションの統計情報を取得
   */
  getMissionStats(missionId: string): MissionStats | null {
    const mission = this.missions.get(missionId);
    if (!mission) {
      return null;
    }

    const elapsedTime = Date.now() - mission.startTime.getTime();
    const completedTasks = Array.from(mission.tasks.values()).filter(
      (task) => task.status === 'completed',
    );

    const totalDuration = completedTasks.reduce((sum, task) => sum + (task.duration || 0), 0);

    const avgTaskDuration = completedTasks.length > 0 ? totalDuration / completedTasks.length : 0;

    return {
      missionId,
      startTime: mission.startTime,
      elapsedTime,
      completedTasks: mission.completedTasks,
      totalTasks: mission.totalTasks,
      averageTaskDuration: avgTaskDuration,
      estimatedTotalTime: avgTaskDuration * mission.totalTasks,
      completionRate: mission.completedTasks / mission.totalTasks,
    };
  }
}

interface MissionStats {
  missionId: string;
  startTime: Date;
  elapsedTime: number;
  completedTasks: number;
  totalTasks: number;
  averageTaskDuration: number;
  estimatedTotalTime: number;
  completionRate: number;
}
