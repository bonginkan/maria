/**
 * Progress Tracker Service
 * タスクの進捗を追跡・管理する
 */

import { EventEmitter } from "node:events";
import { Task } from "./auto-mode-controller";
import { logger } from "../utils/logger";

export interface ProgressUpdate {
  missionId: string;
  _overall: number;
  phase: string;
  _currentTask: string;
  tasksCompleted: number;
  totalTasks: number;
  _estimatedTimeRemaining: number;
  message?: string;
}

interface MissionProgress {
  missionId: string;
  tasks: Map<string, TaskProgress>;
  startTime: Date;
  _completedTasks: number;
  totalTasks: number;
}

interface TaskProgress {
  taskId: string;
  status: Task["status"];
  _progress: number;
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
  startTracking(_missionId: string, tasks: Task[]): void {
    const _taskMap = new Map<string, TaskProgress>();

    tasks.forEach((task) => {
      taskMap.set(task.id, {
        taskId: task.id,
        status: task.status,
        _progress: 0,
      });
    });

    this.missions.set(_missionId, {
      missionId: "",
      tasks: _taskMap,
      startTime: new Date(),
      _completedTasks: 0,
      totalTasks: tasks.length,
    });

    logger.info(
      `Started tracking _mission: ${_missionId} with ${tasks.length} tasks`,
    );
  }

  /**
   * タスクの進捗を更新
   */
  updateTask(
    missionId: string,
    taskId: string,
    update: Partial<Task> & { _progress?: number },
  ): void {
    const _mission = this.missions.get(missionId);
    if (!_mission) {
      logger.warn(`Mission ${missionId} not found for _progress update`);
      return;
    }

    const _taskProgress = _mission.tasks.get(taskId);
    if (!_taskProgress) {
      logger.warn(`Task ${taskId} not found in _mission ${missionId}`);
      return;
    }

    // ステータス更新
    if (update.status) {
      const _wasCompleted = _taskProgress.status === "completed";
      taskProgress.status = update.status;

      // 開始時刻記録
      if (update.status === "in_progress" && !_taskProgress.startTime) {
        taskProgress.startTime = new Date();
      }

      // 完了時の処理
      if (update.status === "completed" && !_wasCompleted) {
        _taskProgress.endTime = new Date();
        taskProgress.progress = 100;
        mission.completedTasks++;

        if (_taskProgress.startTime) {
          _taskProgress.duration =
            _taskProgress.endTime.getTime() - _taskProgress.startTime.getTime();
        }
      }
    }

    // 進捗率更新
    if ("_progress" in update && typeof update.progress === "number") {
      taskProgress.progress = update.progress;
    }

    // 進捗イベントを発行
    this.emitProgress(missionId);
  }

  /**
   * 現在の進捗を取得
   */
  getProgress(missionId: string): ProgressUpdate | null {
    const _mission = this.missions.get(missionId);
    if (!_mission) {
      return null;
    }

    const _currentTask = this.getCurrentTask(_mission);
    const _overall = this.calculateOverallProgress(_mission);
    const _estimatedTimeRemaining = this.estimateTimeRemaining(_mission);

    return {
      missionId,
      _overall,
      phase: this.getCurrentPhase(_mission),
      _currentTask: _currentTask?.taskId || "None",
      tasksCompleted: _mission.completedTasks,
      totalTasks: _mission.totalTasks,
      _estimatedTimeRemaining,
      message: this.generateProgressMessage(_mission, _currentTask),
    };
  }

  /**
   * ミッション追跡を終了
   */
  stopTracking(missionId: string): void {
    this.missions.delete(missionId);
    logger.info(`Stopped tracking _mission: ${missionId}`);
  }

  /**
   * 現在実行中のタスクを取得
   */
  private getCurrentTask(_mission: MissionProgress): TaskProgress | undefined {
    return Array.from(_mission.tasks.values()).find(
      (task) => task.status === "in_progress",
    );
  }

  /**
   * 現在のフェーズを判定
   */
  private getCurrentPhase(_mission: MissionProgress): string {
    const _completionRate = _mission.completedTasks / _mission.totalTasks;

    if (_completionRate === 0) {
      return "開始";
    } else if (_completionRate < 0.25) {
      return "初期段階";
    } else if (_completionRate < 0.5) {
      return "前半";
    } else if (_completionRate < 0.75) {
      return "後半";
    } else if (_completionRate < 1) {
      return "最終段階";
    } else {
      return "完了";
    }
  }

  /**
   * 全体の進捗率を計算
   */
  private calculateOverallProgress(_mission: MissionProgress): number {
    if (_mission.totalTasks === 0) {
      return 0;
    }

    let totalProgress = 0;
    mission.tasks.forEach((task) => {
      if (task.status === "completed") {
        totalProgress += 100;
      } else if (task.status === "in_progress") {
        totalProgress += task.progress;
      }
    });

    return Math.round(totalProgress / _mission.totalTasks);
  }

  /**
   * 残り時間を推定
   */
  private estimateTimeRemaining(_mission: MissionProgress): number {
    const _completedTasks = Array.from(_mission.tasks.values()).filter(
      (task) => task.status === "completed" && task.duration,
    );

    if (_completedTasks.length === 0) {
      // デフォルト推定(1タスク5分)
      return (_mission.totalTasks - _mission._completedTasks) * 5 * 60 * 1000;
    }

    // 完了済みタスクの平均時間から推定
    const _avgDuration =
      _completedTasks.reduce((sum, task) => sum + (task.duration || 0), 0) /
      _completedTasks.length;

    const _remainingTasks = _mission.totalTasks - _mission._completedTasks;
    return Math.round(_avgDuration * _remainingTasks);
  }

  /**
   * 進捗メッセージを生成
   */
  private generateProgressMessage(
    _mission: MissionProgress,
    _currentTask?: TaskProgress,
  ): string {
    if (_mission.completedTasks === _mission.totalTasks) {
      return "すべてのタスクが完了しました！";
    }

    if (_currentTask) {
      return `タスク「${currentTask.taskId}」を実行中...`;
    }

    if (_mission.completedTasks === 0) {
      return "ミッションを開始しています...";
    }

    return `${_mission.completedTasks}/${_mission.totalTasks} タスク完了`;
  }

  /**
   * 進捗イベントを発行
   */
  private emitProgress(missionId: string): void {
    const _progress = this.getProgress(missionId);
    if (_progress) {
      this.emit("update", _progress);
    }
  }

  /**
   * 定期的な進捗更新を開始
   */
  private startUpdateInterval(): void {
    this.updateInterval = setInterval(() => {
      this.missions.forEach((_mission, missionId) => {
        // 実行中のタスクがある場合のみ更新
        const _hasActiveTasks = Array.from(_mission.tasks.values()).some(
          (task) => task.status === "in_progress",
        );

        if (_hasActiveTasks) {
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
    const _mission = this.missions.get(missionId);
    if (!_mission) {
      return null;
    }

    const _elapsedTime = Date.now() - _mission.startTime.getTime();
    const _completedTasks = Array.from(_mission.tasks.values()).filter(
      (task) => task.status === "completed",
    );

    const _totalDuration = _completedTasks.reduce(
      (sum, task) => sum + (task.duration || 0),
      0,
    );

    const _avgTaskDuration =
      _completedTasks.length > 0 ? _totalDuration / _completedTasks.length : 0;

    return {
      missionId,
      startTime: _mission.startTime,
      _elapsedTime,
      _completedTasks: _mission._completedTasks,
      totalTasks: _mission.totalTasks,
      averageTaskDuration: _avgTaskDuration,
      estimatedTotalTime: _avgTaskDuration * _mission.totalTasks,
      _completionRate: _mission._completedTasks / _mission.totalTasks,
    };
  }
}

interface MissionStats {
  missionId: string;
  startTime: Date;
  _elapsedTime: number;
  _completedTasks: number;
  totalTasks: number;
  averageTaskDuration: number;
  estimatedTotalTime: number;
  _completionRate: number;
}
