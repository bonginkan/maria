/**
 * Emotional Intelligence System
 * AI駆動の感情認識と適応的ユーザーサポート
 */

import {
  getMessageColor as _getMessageColor,
  getStatusIcon as _getStatusIcon,
} from "../utils/color-theme";

export interface EmotionalState {
  energy: number; // 0-100 (疲労度逆転)
  frustration: number; // 0-100
  confidence: number; // 0-100
  focus: number; // 0-100
  mood: "excellent" | "good" | "neutral" | "tired" | "frustrated";
  productivity: number; // 0-100
}

export interface UserActivity {
  timestamp: Date;
  command: string;
  success: boolean;
  duration: number; // ms
  errorMessage?: string;
  retryCount?: number;
}

export interface EmotionalResponse {
  type:
    | "encouragement"
    | "break-suggestion"
    | "productivity-tip"
    | "celebration"
    | "focus-help";
  message: string;
  emoji: string;
  priority: "low" | "medium" | "high";
  timing: "immediate" | "after-task" | "session-end";
  actionable?: {
    text: string;
    action?: () => void;
  };
}

export interface ProductivityMetrics {
  tasksCompleted: number;
  averageTaskTime: number;
  _errorRate: number;
  streakCount: number;
  timeInFlow: number; // minutes
  breaksTaken: number;
}

export class EmotionalIntelligence {
  private currentState: EmotionalState;
  private activityHistory: UserActivity[] = [];
  private lastBreakSuggestion: Date = new Date();
  private sessionStart: Date = new Date();
  private consecutiveErrors: number = 0;
  private consecutiveSuccesses: number = 0;
  private focusStartTime?: Date;

  constructor() {
    this.currentState = {
      energy: 80,
      frustration: 10,
      confidence: 70,
      focus: 60,
      mood: "good",
      productivity: 70,
    };
  }

  /**
   * ユーザーアクティビティを分析して感情状態を更新
   */
  analyzeActivity(activity: UserActivity): EmotionalResponse[] {
    this.activityHistory.push(activity);
    this.updateEmotionalState(activity);

    const responses: EmotionalResponse[] = [];

    // 1. 成功・失敗パターンの分析
    const _performanceResponse = this.analyzePerformance(activity);
    if (_performanceResponse) {
      responses.push(_performanceResponse);
    }

    // 2. 疲労度の検出
    const _fatigueResponse = this.detectFatigue();
    if (_fatigueResponse) {
      responses.push(_fatigueResponse);
    }

    // 3. フラストレーションの検出
    const _frustrationResponse = this.detectFrustration();
    if (_frustrationResponse) {
      responses.push(_frustrationResponse);
    }

    // 4. 生産性の分析
    const _productivityResponse = this.analyzeProductivity();
    if (_productivityResponse) {
      responses.push(_productivityResponse);
    }

    // 5. フロー状態の検出
    const _flowResponse = this.detectFlowState();
    if (_flowResponse) {
      responses.push(_flowResponse);
    }

    return responses;
  }

  /**
   * パフォーマンス分析
   */
  private analyzePerformance(activity: UserActivity): EmotionalResponse | null {
    if (activity.success) {
      this.consecutiveSuccesses++;
      this.consecutiveErrors = 0;

      // 連続成功の祝福
      if (this.consecutiveSuccesses >= 3) {
        return {
          type: "celebration",
          message: this.getSuccessMessage(this.consecutiveSuccesses),
          emoji: this.getSuccessEmoji(this.consecutiveSuccesses),
          priority: "medium",
          timing: "immediate",
        };
      }
    } else {
      this.consecutiveErrors++;
      this.consecutiveSuccesses = 0;

      // 連続エラーのサポート
      if (this.consecutiveErrors >= 2) {
        return {
          type: "encouragement",
          message: this.getErrorSupportMessage(this.consecutiveErrors),
          emoji: "💪",
          priority: "high",
          timing: "immediate",
          actionable: {
            text: "Get help with this command",
          },
        };
      }
    }

    return null;
  }

  /**
   * 疲労度検出
   */
  private detectFatigue(): EmotionalResponse | null {
    const _sessionDuration = Date.now() - this.sessionStart.getTime();
    const _hoursSinceStart = _sessionDuration / (1000 * 60 * 60);

    // 2時間以上の連続作業
    if (_hoursSinceStart >= 2) {
      const _timeSinceLastBreak =
        Date.now() - this.lastBreakSuggestion.getTime();
      const _minutesSinceLastBreak = _timeSinceLastBreak / (1000 * 60);

      if (_minutesSinceLastBreak >= 30) {
        this.lastBreakSuggestion = new Date();
        return {
          type: "break-suggestion",
          message: this.getBreakSuggestionMessage(_hoursSinceStart),
          emoji: "☕",
          priority: "high",
          timing: "after-task",
          actionable: {
            text: "Take a 10-minute break",
          },
        };
      }
    }

    // 夜間作業の警告
    const _hour = new Date().getHours();
    if ((_hour >= 22 || _hour <= 5) && this.activityHistory.length > 5) {
      return {
        type: "break-suggestion",
        message:
          "Working late can affect code quality. Consider wrapping up soon! 🌙",
        emoji: "🌙",
        priority: "medium",
        timing: "immediate",
      };
    }

    return null;
  }

  /**
   * フラストレーション検出
   */
  private detectFrustration(): EmotionalResponse | null {
    const _recentActivities = this.getRecentActivities(10); // 直近10アクティビティ
    const _errorRate =
      _recentActivities.filter((a) => !a.success).length /
      _recentActivities.length;

    if (_errorRate >= 0.6) {
      return {
        type: "encouragement",
        message:
          "Having a tough time? Even the best developers face challenges. Take a step back and try a different approach! 🧘♂️",
        emoji: "🧘♂️",
        priority: "high",
        timing: "immediate",
        actionable: {
          text: "Get debugging tips",
        },
      };
    }

    // 同じコマンドの連続失敗
    const _lastCommand =
      this.activityHistory[this.activityHistory.length - 1]?.command;
    const _sameCommandFailures = _recentActivities.filter(
      (a) => a.command === _lastCommand && !a.success,
    ).length;

    if (_sameCommandFailures >= 3) {
      return {
        type: "focus-help",
        message: `Struggling with ${_lastCommand}? Let me help you troubleshoot this! 🔍`,
        emoji: "🔍",
        priority: "high",
        timing: "immediate",
        actionable: {
          text: `Get help with ${_lastCommand}`,
        },
      };
    }

    return null;
  }

  /**
   * 生産性分析
   */
  private analyzeProductivity(): EmotionalResponse | null {
    const _metrics = this.calculateProductivityMetrics();

    // 高い生産性の認識
    if (_metrics.tasksCompleted >= 5 && _metrics.errorRate < 0.2) {
      return {
        type: "celebration",
        message: `Impressive! You've completed ${_metrics.tasksCompleted} tasks with excellent quality! 🚀`,
        emoji: "🚀",
        priority: "medium",
        timing: "after-task",
      };
    }

    // 生産性向上のヒント
    if (_metrics.averageTaskTime > 300000 && _metrics.errorRate > 0.4) {
      // 5分以上 + 高エラー率
      return {
        type: "productivity-tip",
        message:
          "Take your time! Quality over speed leads to better results in the long run 🎯",
        emoji: "🎯",
        priority: "low",
        timing: "session-end",
      };
    }

    return null;
  }

  /**
   * フロー状態検出
   */
  private detectFlowState(): EmotionalResponse | null {
    const _recentActivities = this.getRecentActivities(5);

    // フロー状態の条件: 連続成功 + 短いタスク時間 + 高い集中度
    const _allSuccessful = _recentActivities.every((a) => a.success);
    const _averageTime =
      _recentActivities.reduce((sum, a) => sum + a.duration, 0) /
      _recentActivities.length;
    const _isFlowTime = _averageTime < 60000 && _averageTime > 10000; // 10秒-1分

    if (_allSuccessful && _isFlowTime && _recentActivities.length >= 3) {
      if (!this.focusStartTime) {
        this.focusStartTime = new Date();
      }

      const _flowDuration = Date.now() - this.focusStartTime.getTime();
      const _flowMinutes = _flowDuration / (1000 * 60);

      if (_flowMinutes >= 30) {
        // 30分のフロー状態
        return {
          type: "celebration",
          message: `You're in the zone! 🔥 ${Math.floor(_flowMinutes)} minutes of pure productivity!`,
          emoji: "🔥",
          priority: "low",
          timing: "immediate",
        };
      }
    } else {
      this.focusStartTime = undefined;
    }

    return null;
  }

  /**
   * 感情状態の更新
   */
  private updateEmotionalState(activity: UserActivity): void {
    if (activity.success) {
      this.currentState.confidence = Math.min(
        100,
        this.currentState.confidence + 5,
      );
      this.currentState.frustration = Math.max(
        0,
        this.currentState.frustration - 10,
      );
      this.currentState.productivity = Math.min(
        100,
        this.currentState.productivity + 3,
      );
    } else {
      this.currentState.confidence = Math.max(
        0,
        this.currentState.confidence - 3,
      );
      this.currentState.frustration = Math.min(
        100,
        this.currentState.frustration + 15,
      );
      this.currentState.productivity = Math.max(
        0,
        this.currentState.productivity - 5,
      );
    }

    // エネルギー(疲労度)の更新
    const _sessionDuration = Date.now() - this.sessionStart.getTime();
    const _hoursSinceStart = _sessionDuration / (1000 * 60 * 60);
    this.currentState.energy = Math.max(0, 100 - _hoursSinceStart * 15);

    // 集中度の更新
    const _recentSuccessRate = this.getRecentSuccessRate();
    this.currentState.focus = Math.min(100, _recentSuccessRate * 100);

    // 全体的な気分の更新
    this.currentState.mood = this.calculateMood();
  }

  /**
   * 生産性メトリクスの計算
   */
  private calculateProductivityMetrics(): ProductivityMetrics {
    const _activities = this.getRecentActivities(20);

    return {
      tasksCompleted: _activities.filter((a) => a.success).length,
      averageTaskTime:
        _activities.reduce((sum, a) => sum + a.duration, 0) /
        _activities.length,
      _errorRate:
        _activities.filter((a) => !a.success).length / _activities.length,
      streakCount: this.consecutiveSuccesses,
      timeInFlow: this.focusStartTime
        ? (Date.now() - this.focusStartTime.getTime()) / (1000 * 60)
        : 0,
      breaksTaken: 0, // 実装時に追加
    };
  }

  /**
   * 時間帯に基づく適応的メッセージ
   */
  getTimeBasedGreeting(): EmotionalResponse | null {
    const _hour = new Date().getHours();
    const _isFirstCommand = this.activityHistory.length <= 1;

    if (!_isFirstCommand) {
      return null;
    }

    if (_hour >= 6 && _hour < 10) {
      return {
        type: "encouragement",
        message: "Good morning! Ready to create something amazing today? ☀️",
        emoji: "☀️",
        priority: "low",
        timing: "immediate",
      };
    } else if (_hour >= 18 && _hour < 22) {
      return {
        type: "encouragement",
        message: "Evening coding session! Let's build something great! 🌆",
        emoji: "🌆",
        priority: "low",
        timing: "immediate",
      };
    }

    return null;
  }

  // Helper methods
  private getRecentActivities(count: number): UserActivity[] {
    return this.activityHistory.slice(-count);
  }

  private getRecentSuccessRate(): number {
    const _recent = this.getRecentActivities(10);
    if (_recent.length === 0) {
      return 0.5;
    }
    return _recent.filter((a) => a.success).length / _recent.length;
  }

  private calculateMood():
    | "excellent"
    | "good"
    | "neutral"
    | "tired"
    | "frustrated" {
    const { energy, frustration, confidence } = this.currentState;

    if (energy > 80 && frustration < 20 && confidence > 80) {
      return "excellent";
    }
    if (energy > 60 && frustration < 40 && confidence > 60) {
      return "good";
    }
    if (energy < 30 || frustration > 70) {
      return "tired";
    }
    if (frustration > 50 && confidence < 40) {
      return "frustrated";
    }
    return "neutral";
  }

  private getSuccessMessage(streak: number): string {
    const _messages = [
      "Great work! 🎉",
      "You're on fire! 🔥",
      "Excellent execution! ✨",
      "Perfect streak! 💫",
      "Unstoppable! 🚀",
      "Master at work! 👑",
    ];

    const _index = Math.min(streak - 3, _messages.length - 1);
    return _messages[_index] || "Keep up the great work!";
  }

  private getSuccessEmoji(streak: number): string {
    const _emojis = ["🎉", "🔥", "✨", "💫", "🚀", "👑"];
    const _index = Math.min(streak - 3, _emojis.length - 1);
    return _emojis[_index] || "🎉";
  }

  private getErrorSupportMessage(errorCount: number): string {
    const _messages = [
      "No worries! Every developer faces challenges. Let's debug this together! 🔍",
      "Take a deep breath. Sometimes a fresh perspective helps! 🧘♂️",
      "Persistence pays off! You've got this! 💪",
      "Even experts struggle sometimes. Keep going! 🌟",
    ];

    const _index = Math.min(errorCount - 2, _messages.length - 1);
    return _messages[_index] || "Take a deep breath, you got this!";
  }

  private getBreakSuggestionMessage(hours: number): string {
    if (hours >= 4) {
      return "You've been coding for over 4 hours! Time for a proper break ☕";
    } else if (hours >= 3) {
      return "Great focus! Consider a short break to recharge 🔋";
    } else {
      return "A quick break can boost your productivity! 🚶♂️";
    }
  }

  // Public getters
  getCurrentState(): EmotionalState {
    return { ...this.currentState };
  }

  getProductivitySummary(): ProductivityMetrics {
    return this.calculateProductivityMetrics();
  }
}
