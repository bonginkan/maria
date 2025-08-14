/**
 * Context-Aware Feedback System
 * AI駆動のコンテキスト認識型フィードバック
 */

import { getStatusIcon, getMessageColor } from '../utils/color-theme';

export interface UserContext {
  currentCommand?: string;
  inputHistory: string[];
  errorHistory: ErrorEvent[];
  successHistory: SuccessEvent[];
  workingDirectory?: string;
  projectType?: 'react' | 'node' | 'python' | 'go' | 'rust' | 'unknown';
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  sessionDuration: number; // minutes
  commandCount: number;
  lastActivity: Date;
}

export interface ErrorEvent {
  command: string;
  error: string;
  timestamp: Date;
  resolved: boolean;
}

export interface SuccessEvent {
  command: string;
  description: string;
  timestamp: Date;
  duration: number; // ms
}

export interface FeedbackResponse {
  type: 'suggestion' | 'warning' | 'encouragement' | 'tip' | 'correction';
  message: string;
  icon: string;
  color: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  actionable?: {
    text: string;
    command?: string;
  };
}

export class ContextAwareFeedback {
  private context: UserContext;
  // @ts-ignore - Unused but planned for future pattern matching features
  private _patterns: Map<string, number> = new Map();

  constructor(initialContext?: Partial<UserContext>) {
    this.context = {
      inputHistory: [],
      errorHistory: [],
      successHistory: [],
      timeOfDay: this.getTimeOfDay(),
      sessionDuration: 0,
      commandCount: 0,
      lastActivity: new Date(),
      ...initialContext,
    };
  }

  /**
   * 入力内容に基づいてリアルタイムフィードバックを生成
   */
  analyzeInput(input: string): FeedbackResponse[] {
    const feedback: FeedbackResponse[] = [];

    // 1. コマンド認識と提案
    const commandSuggestion = this.analyzeCommand(input);
    if (commandSuggestion) {
      feedback.push(commandSuggestion);
    }

    // 2. 一般的なミス検出
    const errorPrediction = this.predictErrors(input);
    if (errorPrediction) {
      feedback.push(errorPrediction);
    }

    // 3. パフォーマンス提案
    const performanceTip = this.analyzePerformance(input);
    if (performanceTip) {
      feedback.push(performanceTip);
    }

    // 4. セキュリティチェック
    const securityWarning = this.checkSecurity(input);
    if (securityWarning) {
      feedback.push(securityWarning);
    }

    return feedback;
  }

  /**
   * コマンド認識と改善提案
   */
  private analyzeCommand(input: string): FeedbackResponse | null {
    const trimmedInput = input.trim().toLowerCase();

    // スラッシュコマンドの提案
    if (!trimmedInput.startsWith('/') && this.shouldSuggestSlashCommand(trimmedInput)) {
      const suggestedCommand = this.getSuggestedSlashCommand(trimmedInput);
      if (suggestedCommand) {
        return {
          type: 'suggestion',
          message: `Did you mean /${suggestedCommand}?`,
          icon: getStatusIcon('suggestion'),
          color: getMessageColor('info'),
          priority: 'medium',
          actionable: {
            text: `Use /${suggestedCommand}`,
            command: `/${suggestedCommand}`,
          },
        };
      }
    }

    // よくある間違いの修正
    if (trimmedInput.includes('genrate')) {
      return {
        type: 'correction',
        message: 'Did you mean "generate"?',
        icon: getStatusIcon('warning'),
        color: getMessageColor('warning'),
        priority: 'low',
      };
    }

    return null;
  }

  /**
   * エラー予測システム
   */
  private predictErrors(input: string): FeedbackResponse | null {
    const trimmedInput = input.trim();

    // 長すぎる入力の警告
    if (trimmedInput.length > 200) {
      return {
        type: 'warning',
        message: 'Very long input may cause processing delays',
        icon: getStatusIcon('warning'),
        color: getMessageColor('warning'),
        priority: 'medium',
      };
    }

    // 危険な操作の警告
    if (
      trimmedInput.includes('delete') ||
      trimmedInput.includes('remove') ||
      trimmedInput.includes('rm ')
    ) {
      return {
        type: 'warning',
        message: 'This command may delete files. Proceed with caution.',
        icon: getStatusIcon('warning'),
        color: getMessageColor('error'),
        priority: 'high',
      };
    }

    // APIキーらしき文字列の検出
    if (/sk-[a-zA-Z0-9]{48}|API[_-]?KEY|SECRET[_-]?KEY/i.test(trimmedInput)) {
      return {
        type: 'warning',
        message: 'Detected potential API key or secret. Never share sensitive credentials!',
        icon: getStatusIcon('warning'),
        color: getMessageColor('error'),
        priority: 'critical',
      };
    }

    return null;
  }

  /**
   * パフォーマンス分析と提案
   */
  private analyzePerformance(input: string): FeedbackResponse | null {
    // 同じコマンドの繰り返し検出
    const recentCommands = this.context.inputHistory.slice(-5);
    const commandCount = recentCommands.filter((cmd) => cmd === input).length;

    if (commandCount >= 3) {
      return {
        type: 'tip',
        message: "You've used this command several times. Consider creating an alias or macro.",
        icon: getStatusIcon('tip'),
        color: getMessageColor('info'),
        priority: 'low',
        actionable: {
          text: 'Learn about /alias command',
        },
      };
    }

    return null;
  }

  /**
   * セキュリティチェック
   */
  private checkSecurity(input: string): FeedbackResponse | null {
    // パスワードらしき文字列の検出
    if (/password|passwd|pwd/i.test(input) && input.length > 20) {
      return {
        type: 'warning',
        message: 'Avoid including passwords in commands. Use environment variables instead.',
        icon: getStatusIcon('warning'),
        color: getMessageColor('error'),
        priority: 'high',
      };
    }

    return null;
  }

  /**
   * 時間帯に基づく挨拶とアドバイス
   */
  getTimeBasedFeedback(): FeedbackResponse | null {
    const hour = new Date().getHours();

    if (hour >= 22 || hour <= 5) {
      return {
        type: 'encouragement',
        message: 'Working late? Remember to take breaks! 🌙',
        icon: getStatusIcon('info'),
        color: getMessageColor('info'),
        priority: 'low',
      };
    }

    if (hour >= 6 && hour <= 9 && this.context.commandCount === 1) {
      return {
        type: 'encouragement',
        message: 'Good morning! Ready to build something amazing today? 🌅',
        icon: getStatusIcon('success'),
        color: getMessageColor('success'),
        priority: 'low',
      };
    }

    return null;
  }

  /**
   * 疲労度検出と励まし
   */
  getFatigueBasedFeedback(): FeedbackResponse | null {
    const recentErrors = this.context.errorHistory.filter(
      (error) => new Date().getTime() - error.timestamp.getTime() < 30 * 60 * 1000, // 30分以内
    ).length;

    if (recentErrors >= 3) {
      return {
        type: 'encouragement',
        message: 'Take a short break! Fresh perspective often leads to breakthroughs 💪',
        icon: getStatusIcon('encouragement'),
        color: getMessageColor('warning'),
        priority: 'medium',
      };
    }

    return null;
  }

  /**
   * 成功時の祝福メッセージ
   */
  getCelebrationFeedback(_command: string): FeedbackResponse | null {
    const celebrations = [
      'Excellent work! 🎉',
      'Perfect execution! ✨',
      "You're on fire! 🔥",
      'Great job! 👏',
      'Smooth! 🚀',
    ];

    return {
      type: 'encouragement',
      message: celebrations[Math.floor(Math.random() * celebrations.length)] || 'Great job!',
      icon: getStatusIcon('success'),
      color: getMessageColor('success'),
      priority: 'low',
    };
  }

  /**
   * コンテキスト更新
   */
  updateContext(updates: Partial<UserContext>): void {
    this.context = { ...this.context, ...updates };
    this.context.lastActivity = new Date();
  }

  /**
   * 入力履歴に追加
   */
  addToHistory(input: string): void {
    this.context.inputHistory.push(input);
    this.context.commandCount++;

    // 履歴は最新20件まで保持
    if (this.context.inputHistory.length > 20) {
      this.context.inputHistory.shift();
    }
  }

  /**
   * エラーイベント記録
   */
  recordError(command: string, error: string): void {
    this.context.errorHistory.push({
      command,
      error,
      timestamp: new Date(),
      resolved: false,
    });
  }

  /**
   * 成功イベント記録
   */
  recordSuccess(command: string, description: string, duration: number): void {
    this.context.successHistory.push({
      command,
      description,
      timestamp: new Date(),
      duration,
    });
  }

  // Helper methods
  private getTimeOfDay(): 'morning' | 'afternoon' | 'evening' | 'night' {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 22) return 'evening';
    return 'night';
  }

  private shouldSuggestSlashCommand(input: string): boolean {
    const keywords = ['create', 'generate', 'make', 'build', 'test', 'review', 'fix'];
    return keywords.some((keyword) => input.includes(keyword));
  }

  private getSuggestedSlashCommand(input: string): string | null {
    if (input.includes('test')) return 'test';
    if (input.includes('review')) return 'review';
    if (input.includes('image') || input.includes('picture')) return 'image';
    if (input.includes('video')) return 'video';
    if (input.includes('code') || input.includes('create') || input.includes('generate'))
      return 'code';
    if (input.includes('fix') || input.includes('bug')) return 'bug';
    if (input.includes('commit')) return 'commit';
    return null;
  }
}
