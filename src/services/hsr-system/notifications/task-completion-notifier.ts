// src/services/hsr-system/notifications/_task-completion-notifier.ts
/**
 * Task-based Completion Notification System
 * タスク単位の詳細完了通知システム(人間制御優先)
 */

import {
  BaseInterruptionHandler,
  InterruptionResponse,
  InterruptionLevel,
} from "../interruption/base-interruption-handler.js";
import { HSRBrandedStyle } from "../themes/branded-style.js";

export enum NotificationType {
  TASK_COMPLETION = "task_completion",
  PHASE_MILESTONE = "phase_milestone",
  CRITICAL_UPDATE = "critical_update",
  HUMAN_ATTENTION_REQUIRED = "human_attention_required",
  AI_ANALYSIS_COMPLETE = "ai_analysis_complete",
}

export enum NotificationChannel {
  TERMINAL = "terminal",
  SLACK = "slack",
  EMAIL = "email",
  FILE_SYSTEM = "file_system",
  WEBHOOK = "webhook",
}

export interface TaskCompletionNotification {
  id: string;
  type: NotificationType;
  title: string;
  _task: TaskDetails;
  _summary: CompletionSummary;
  achievements: Achievement[];
  _aiInsights: AIInsight[];
  _nextSteps: NextStep[];
  humanDecisionRequired: boolean;
  timestamp: number;
  priority: "low" | "medium" | "high" | "critical";
  channels: NotificationChannel[];
}

export interface TaskDetails {
  id: string;
  title: string;
  description: string;
  phase: string;
  startTime: number;
  endTime: number;
  duration: number;
  complexity: "simple" | "moderate" | "complex" | "expert";
  humanEffort: number; // _hours
  aiAssistanceLevel: number; // 0-100%
}

export interface CompletionSummary {
  componentsImplemented: number;
  featuresCompleted: number;
  testsAdded: number;
  testsPassing: number;
  codeQualityScore: number;
  performanceImpact: string;
  filesModified: string[];
  linesOfCode: { added: number; modified: number; deleted: number };
}

export interface Achievement {
  title: string;
  description: string;
  category:
    | "implementation"
    | "quality"
    | "performance"
    | "learning"
    | "innovation";
  impact: "low" | "medium" | "high";
  measurable: boolean;
  evidence?: string[];
}

export interface AIInsight {
  category: "pattern" | "efficiency" | "quality" | "risk" | "optimization";
  confidence: number;
  message: string;
  actionable: boolean;
  humanVerificationRequired: boolean;
  suggestedActions: string[];
}

export interface NextStep {
  id: string;
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
  estimatedDuration: string;
  dependencies: string[];
  humanApprovalRequired: boolean;
  suggestedApproach: string;
}

/**
 * Task Completion Notifier
 * タスク完了時の包括的通知システム
 */
export class TaskCompletionNotifier extends BaseInterruptionHandler {
  private brandedStyle: HSRBrandedStyle;
  private notificationQueue: TaskCompletionNotification[] = [];
  private isProcessingNotifications = false;

  constructor() {
    super("_task-notifier", "Task Completion Notifier", true);
    this.brandedStyle = new HSRBrandedStyle();
  }

  /**
   * タスク完了通知の生成と表示
   */
  async notifyTaskCompletion(
    _task: TaskDetails,
    _summary: CompletionSummary,
    achievements: Achievement[],
    humanControlled: boolean = true,
  ): Promise<TaskCompletionNotification> {
    // AI分析の実行(人間制御下で)
    const _aiInsights = await this.generateAIInsights(
      _task,
      _summary,
      achievements,
    );
    const _nextSteps = await this.generateNextSteps(
      _task,
      _summary,
      achievements,
    );

    const notification: TaskCompletionNotification = {
      id: this.generateNotificationId(),
      type: NotificationType.TASK_COMPLETION,
      title: `${task.title} 完了`,
      _task,
      _summary,
      achievements,
      _aiInsights,
      _nextSteps,
      humanDecisionRequired: humanControlled,
      timestamp: Date.now(),
      priority: this.calculatePriority(_task, _summary, achievements),
      channels: [NotificationChannel.TERMINAL], // デフォルトはターミナル
    };

    // ブランド化された完了通知を表示
    await this.displayBrandedCompletionNotification(notification);

    if (humanControlled) {
      await this.handleHumanInteraction(notification);
    }

    return notification;
  }

  /**
   * ブランド化されたタスク完了通知の表示
   */
  private async displayBrandedCompletionNotification(
    notification: TaskCompletionNotification,
  ): Promise<void> {
    const _task = notification._task;
    const _summary = notification._summary;

    console.log(`
⏺ ${this.brandedStyle.brand(" Task Complete! ")}{this.brandedStyle.heading(task.title)}

📊 ${this.brandedStyle.heading("実装サマリ")}:
  • Phase: ${this.brandedStyle.ok(_task.phase)}
  • Duration: ${this.formatDuration(_task.duration)} 
  • Complexity: ${this.getComplexityDisplay(_task.complexity)}
  • Human Effort: ${this.brandedStyle.ok(_task.humanEffort + "h")}
  • AI Assistance: ${this.brandedStyle.ok(_task.aiAssistanceLevel + "%")}
  
🎯 ${this.brandedStyle.heading("成果指標")}:
  • Components: ${this.brandedStyle.ok(_summary.componentsImplemented.toString())}
  • Features: ${this.brandedStyle.ok(_summary.featuresCompleted.toString())}
  • Tests: ${this.brandedStyle.ok(_summary.testsAdded + " added")}, ${_summary.testsPassing}/${_summary.testsAdded + _summary.testsPassing} passing
  • Code Quality: ${this.getQualityDisplay(_summary.codeQualityScore)}
  • Performance: ${_summary.performanceImpact}

🏆 ${this.brandedStyle.heading("主要成果")}:
${notification.achievements
  .map(
    (achievement) =>
      `  ${this.getAchievementIcon(achievement.category)} ${this.brandedStyle.heading(achievement.title)}
    ${this.brandedStyle.muted("└")} ${achievement.description}
    ${this.brandedStyle.muted("└")} Impact: ${this.getImpactDisplay(achievement.impact)}`,
  )
  .join("\n")}

${notification.aiInsights.length > 0 ? this.formatAIInsights(notification.aiInsights) : ""}

${notification.humanDecisionRequired ? this.formatHumanDecisionSection(notification) : ""}

${this.formatNextStepsSection(notification.nextSteps)}
    `);
  }

  /**
   * AI洞察の生成
   */
  private async generateAIInsights(
    _task: TaskDetails,
    _summary: CompletionSummary,
    _achievements: Achievement[],
  ): Promise<AIInsight[]> {
    const insights: AIInsight[] = [];

    // パターン分析
    if (_summary.codeQualityScore > 90) {
      insights.push({
        category: "quality",
        confidence: 0.92,
        message: `高品質コード実装パターンを検出。このアプローチを他のタスクにも適用可能`,
        actionable: true,
        humanVerificationRequired: false,
        suggestedActions: [
          "パターンをドキュメント化",
          "チームにベストプラクティス共有",
        ],
      });
    }

    // 効率性分析
    const _expectedDuration = this.estimateExpectedDuration(_task.complexity);
    if (_task.duration < _expectedDuration * 0.8) {
      insights.push({
        category: "efficiency",
        confidence: 0.87,
        message: `予想より${Math.floor((1 - _task.duration / _expectedDuration) * 100)}%効率的に完了。学習効果が顕著`,
        actionable: true,
        humanVerificationRequired: false,
        suggestedActions: ["効率化手法を文書化", "プロセス改善に反映"],
      });
    }

    // リスク分析
    if (
      _summary.testsPassing / (_summary.testsAdded + _summary.testsPassing) <
      0.95
    ) {
      insights.push({
        category: "risk",
        confidence: 0.95,
        message: `テスト成功率が95%未満。潜在的なリグレッション懸念`,
        actionable: true,
        humanVerificationRequired: true,
        suggestedActions: [
          "失敗テストの詳細分析",
          "コードレビューの実施",
          "QA環境での追加テスト",
        ],
      });
    }

    return insights;
  }

  /**
   * 次ステップの生成
   */
  private async generateNextSteps(
    _task: TaskDetails,
    _summary: CompletionSummary,
    achievements: Achievement[],
  ): Promise<NextStep[]> {
    const _nextSteps: NextStep[] = [];

    // 自動推奨される次のステップ
    nextSteps.push({
      id: "deploy-to-qa",
      title: "QA環境へのデプロイ",
      description: `${_summary.featuresCompleted}個の新機能をQA環境で検証`,
      priority: "high",
      estimatedDuration: "30分",
      dependencies: ["テスト成功確認"],
      humanApprovalRequired: true,
      suggestedApproach: "gradual rollout with monitoring",
    });

    if (_summary.codeQualityScore > 85) {
      nextSteps.push({
        id: "code-review",
        title: "コードレビューのスケジュール",
        description: "高品質な実装をチームで共有し、学習機会を作る",
        priority: "medium",
        estimatedDuration: "1時間",
        dependencies: [],
        humanApprovalRequired: false,
        suggestedApproach: "focus on architecture decisions and best practices",
      });
    }

    if (achievements.some((a) => a.category === "performance")) {
      nextSteps.push({
        id: "performance-monitoring",
        title: "パフォーマンス監視の設定",
        description: "パフォーマンス改善の効果を継続的に監視",
        priority: "medium",
        estimatedDuration: "45分",
        dependencies: ["QA環境デプロイ完了"],
        humanApprovalRequired: false,
        suggestedApproach: "set up alerts for key metrics",
      });
    }

    return _nextSteps;
  }

  /**
   * 人間とのインタラクション処理
   */
  private async handleHumanInteraction(
    notification: TaskCompletionNotification,
  ): Promise<void> {
    console.log(`
${this.brandedStyle.accent("━━ ")}{this.brandedStyle.heading('🛡️ Human Decision Required')}
  {${this.brandedStyle.ok("👤 Your Authority")}}: AI分析は参考情報です
  {${this.brandedStyle.ok("🤔 Your Judgment")}}: あなたの経験と判断が最も重要
  {${this.brandedStyle.ok("⏰ No Rush")}}: 必要な時間をかけて検討してください

💡 ${this.brandedStyle.heading("以下の案でいかがですか？")}
  ${this.brandedStyle.muted("• ")}AI推奨の次ステップを承認して実行
  ${this.brandedStyle.muted("• ")}一部のステップのみ承認(選択実行)
  ${this.brandedStyle.muted("• ")}独自の次ステップを追加・修正
  ${this.brandedStyle.muted("• ")}この完了を関連チームに通知
  ${this.brandedStyle.muted("• ")}学習データとしてメモリに保存

${this.brandedStyle.muted("[A]すべて承認 [S]選択実行 [M]修正 [N]通知 [L]学習保存 [Q]後で決定")}
    `);

    const _choice = await this.waitForUserChoice([
      "A",
      "S",
      "M",
      "N",
      "L",
      "Q",
    ]);
    await this.executeHumanChoice(_choice, notification);
  }

  /**
   * 人間の選択を実行
   */
  private async executeHumanChoice(
    _choice: string,
    notification: TaskCompletionNotification,
  ): Promise<void> {
    switch (_choice) {
      case "A": // すべて承認
        console.log(`
${this.brandedStyle.ok("✅ All Steps Approved")}
${this.brandedStyle.accent("━━ ")}{this.brandedStyle.heading('Executing')}: ${notification.nextSteps.length} next steps
${this.brandedStyle.accent("━━ ")}{this.brandedStyle.heading('Human Decision')}: Full approval granted
        `);
        await this.executeAllNextSteps(notification.nextSteps);
        break;

      case "S": // 選択実行
        await this.showSelectiveExecutionUI(notification.nextSteps);
        break;

      case "M": // 修正
        await this.showModificationUI(notification);
        break;

      case "N": // 通知
        await this.sendTeamNotification(notification);
        break;

      case "L": // 学習保存
        await this.saveToLearningMemory(notification);
        break;

      case "Q": // 後で決定
        console.log(`
${this.brandedStyle.warn("⏳ Decision Deferred")}
${this.brandedStyle.accent("━━ ")}{this.brandedStyle.heading('Status')}: Saved for later review
${this.brandedStyle.accent("━━ ")}{this.brandedStyle.heading('Access')}: Use "/hrs review pending" to revisit
        `);
        break;
    }
  }

  // BaseInterruptionHandler実装
  async executeImmediateStop(): Promise<InterruptionResponse> {
    this.isProcessingNotifications = false;

    console.log(`
${this.brandedStyle.ok("✅ Notification Processing Stopped")}
${this.brandedStyle.accent("━━ ")}{this.brandedStyle.heading('Status')}: Safely interrupted by human
${this.brandedStyle.accent("━━ ")}{this.brandedStyle.heading('Queue')}: ${this.notificationQueue.length} notifications pending
${this.brandedStyle.accent("━━ ")}{this.brandedStyle.heading('Resume')}: Available anytime
    `);

    return {
      success: true,
      action: InterruptionLevel.IMMEDIATE,
      message: "Notification processing stopped",
      canResume: true,
      rollbackAvailable: true,
    };
  }

  async executeSafePause(): Promise<InterruptionResponse> {
    this.isProcessingNotifications = false;

    console.log(`
${this.brandedStyle.warn("⏸️ Notification Processing Paused")}
${this.brandedStyle.accent("━━ ")}{this.brandedStyle.heading('Status')}: Current notification completed safely
${this.brandedStyle.accent("━━ ")}{this.brandedStyle.heading('Queue')}: Preserved for resume
    `);

    return {
      success: true,
      action: InterruptionLevel.SAFE_PAUSE,
      message: "Notification processing paused safely",
      canResume: true,
      rollbackAvailable: true,
    };
  }

  async executeRollback(): Promise<InterruptionResponse> {
    this.notificationQueue = [];
    this.isProcessingNotifications = false;

    console.log(`
${this.brandedStyle.accent("🔄 Notification System Reset")}
${this.brandedStyle.accent("━━ ")}{this.brandedStyle.heading('Queue')}: Cleared
${this.brandedStyle.accent("━━ ")}{this.brandedStyle.heading('State')}: Reset to initial
    `);

    return {
      success: true,
      action: InterruptionLevel.ROLLBACK,
      message: "Notification system reset",
      canResume: false,
      rollbackAvailable: false,
    };
  }

  getProcessState(): unknown {
    return {
      id: "_task-notifier",
      name: "Task Completion Notifier",
      status: this.isProcessingNotifications ? "processing" : "idle",
      startTime: Date.now(),
      progress: 0,
      canResume: true,
      hasPartialResults: this.notificationQueue.length > 0,
      backupAvailable: true,
      queueSize: this.notificationQueue.length,
    };
  }

  // ヘルパーメソッド
  private generateNotificationId(): string {
    return (
      "notif_" + Date.now().toString(36) + Math.random().toString(36).substr(2)
    );
  }

  private formatDuration(milliseconds: number): string {
    const _minutes = Math.floor(milliseconds / 60000);
    const _hours = Math.floor(_minutes / 60);

    if (_hours > 0) {
      return `${_hours}h ${_minutes % 60}m`;
    }
    return `${_minutes}m`;
  }

  private getComplexityDisplay(complexity: string): string {
    const _colors = {
      simple: this.brandedStyle.ok,
      moderate: this.brandedStyle.warn,
      complex: this.brandedStyle.err,
      expert: this.brandedStyle.err,
    };
    return _colors[complexity](complexity);
  }

  private getQualityDisplay(score: number): string {
    if (score >= 90) return this.brandedStyle.ok(score + "% (Excellent)");
    if (score >= 80) return this.brandedStyle.ok(score + "% (Good)");
    if (score >= 70) return this.brandedStyle.warn(score + "% (Fair)");
    return this.brandedStyle.err(score + "% (Needs Improvement)");
  }

  private getAchievementIcon(category: string): string {
    const _icons = {
      implementation: "🔧",
      quality: "✨",
      performance: "⚡",
      learning: "📚",
      innovation: "💡",
    };
    return _icons[category] || "✅";
  }

  private getImpactDisplay(impact: string): string {
    const _colors = {
      low: this.brandedStyle.muted,
      medium: this.brandedStyle.warn,
      high: this.brandedStyle.ok,
    };
    return _colors[impact](impact);
  }

  private formatAIInsights(insights: AIInsight[]): string {
    return `
🤖 ${this.brandedStyle.heading("AI Analysis")} ${this.brandedStyle.muted("(参考情報)")}:
${insights
  .map(
    (insight) =>
      `  ${this.getCategoryIcon(insight.category)} ${this.brandedStyle.heading(insight.category.toUpperCase())} (${Math.floor(insight.confidence * 100)}%): ${insight.message}
    ${
      insight.humanVerificationRequired
        ? this.brandedStyle.warn("└ 人間確認必要")
        : this.brandedStyle.ok("└ 信頼度高")
    }
    ${
      insight.actionable
        ? `${this.brandedStyle.muted("└ Actions")}: ${insight.suggestedActions.join(", ")}`
        : ""
    }`,
  )
  .join("\n")}
    `;
  }

  private getCategoryIcon(category: string): string {
    const _icons = {
      pattern: "🔍",
      efficiency: "⚡",
      quality: "✨",
      risk: "⚠️",
      optimization: "🎯",
    };
    return _icons[category] || "🤖";
  }

  private formatHumanDecisionSection(
    _notification: TaskCompletionNotification,
  ): string {
    return `
${this.brandedStyle.accent("━━ ")}{this.brandedStyle.heading('🛡️ Human Authority Active')}
  {${this.brandedStyle.ok("👤 Final Decision")}}: すべての次ステップはあなたの承認が必要
  {${this.brandedStyle.ok("🔍 AI Support")}}: AI分析は意思決定の参考情報
  {${this.brandedStyle.ok("⚖️ Your Choice")}}: 承認、修正、却下はあなたの判断
    `;
  }

  private formatNextStepsSection(_nextSteps: NextStep[]): string {
    return `
💡 ${this.brandedStyle.heading("推奨次ステップ")} ${this.brandedStyle.muted("(人間承認待ち)")}:
${_nextSteps
  .map(
    (step, _i) =>
      `  ${_i + 1}. ${this.brandedStyle.heading(step.title)} (${this.getPriorityColor(step.priority)(step.priority)})
    ${this.brandedStyle.muted("└")} ${step.description}
    ${this.brandedStyle.muted("└")} Duration: ${step.estimatedDuration}
    ${
      step.humanApprovalRequired
        ? this.brandedStyle.warn("└ Requires human approval")
        : this.brandedStyle.ok("└ Can auto-execute")
    }`,
  )
  .join("\n")}
    `;
  }

  private getPriorityColor(_priority: string) {
    const _colors = {
      low: this.brandedStyle.muted,
      medium: this.brandedStyle.warn,
      high: this.brandedStyle.ok,
      critical: this.brandedStyle.err,
    };
    return _colors[_priority] || this.brandedStyle.muted;
  }

  private calculatePriority(
    _task: TaskDetails,
    _summary: CompletionSummary,
    achievements: Achievement[],
  ): "low" | "medium" | "high" | "critical" {
    if (
      _summary.testsPassing / (_summary.testsAdded + _summary.testsPassing) <
      0.9
    ) {
      return "critical";
    }

    if (achievements.some((a) => a.impact === "high")) {
      return "high";
    }

    if (_task.complexity === "complex" || _task.complexity === "expert") {
      return "medium";
    }

    return "low";
  }

  private estimateExpectedDuration(complexity: string): number {
    const _baseTimes = {
      simple: 2 * 60 * 60 * 1000, // 2時間
      moderate: 6 * 60 * 60 * 1000, // 6時間
      complex: 12 * 60 * 60 * 1000, // 12時間
      expert: 24 * 60 * 60 * 1000, // 24時間
    };
    return _baseTimes[complexity] || _baseTimes["moderate"];
  }

  private async waitForUserChoice(validChoices: string[]): Promise<string> {
    // 実際の実装では、ユーザー入力を待つロジック
    return new Promise((resolve) => {
      setTimeout(() => resolve(validChoices[0]), 1000);
    });
  }
}
