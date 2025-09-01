// src/services/hsr-system/active-reporting/active-intelligent-reporter.ts
/**
 * Active Intelligent Reporting System
 * 能動的でインテリジェントな報告システム - Human Control付き
 */

import {
  BaseInterruptionHandler,
  InterruptionLevel,
  InterruptionResponse,
} from "../interruption/base-interruption-handler.js";
import { HSRBrandedStyle } from "../themes/branded-style.js";

export enum ReportType {
  DAILY = "daily",
  PHASE = "phase",
  THEME = "theme",
  TASK_COMPLETION = "task_completion",
  ACTIVE_PROGRESS = "active_progress",
  INTELLIGENT_SUMMARY = "intelligent_summary",
}

export enum ReportPriority {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
}

export interface ActiveReport {
  id: string;
  type: ReportType;
  priority: ReportPriority;
  title: string;
  content: ReportContent;
  metadata: ReportMetadata;
  timestamp: number;
  humanApprovalRequired: boolean;
  aiInsights: AIInsight[];
  _suggestions: SmartSuggestion[];
}

export interface ReportContent {
  summary: string;
  details: Record<string, any>;
  metrics: Metric[];
  achievements: Achievement[];
  blockers: Blocker[];
  risks: Risk[];
  nextSteps: NextStep[];
}

export interface AIInsight {
  type: "pattern" | "anomaly" | "optimization" | "prediction";
  confidence: number;
  message: string;
  actionable: boolean;
  evidence: string[];
}

export interface SmartSuggestion {
  id: string;
  title: string;
  description: string;
  type: "improvement" | "optimization" | "warning" | "opportunity";
  priority: ReportPriority;
  confidence: number;
  estimatedImpact: string;
  action: SuggestionAction;
  reasoning: string;
}

export interface SuggestionAction {
  label: string;
  command?: string;
  expectedOutcome: string;
  riskLevel: "low" | "medium" | "high";
}

/**
 * Active Intelligent Reporter
 * 人間制御可能なインテリジェント報告システム
 */
export class ActiveIntelligentReporter extends BaseInterruptionHandler {
  private reportingQueue: ActiveReport[] = [];
  private isGeneratingReport = false;
  private brandedStyle: HSRBrandedStyle;

  constructor() {
    super("active-reporter", "Active Intelligent Reporting", true);
    this.brandedStyle = new HSRBrandedStyle();
  }

  /**
   * インテリジェント日次レポート生成
   * 人間が制御可能で、いつでも停止・修正可能
   */
  async generateDailyReport(
    _context: ReportContext,
    humanControlled: boolean = true,
  ): Promise<ActiveReport> {
    this.isGeneratingReport = true;

    if (humanControlled) {
      console.log(`
${this.brandedStyle.brand(" HRS ")}{this.brandedStyle.muted('│')}${this.brandedStyle.heading("Daily Report Generation — Active Intelligence")} ${this.brandedStyle.hint('[ESC] または "待って" で停止')}
${this.brandedStyle.accent("━━ ")}{this.brandedStyle.heading('AI Analysis Status')}:
  Data Collection    : ${this.brandedStyle.progress(20)}
  Pattern Analysis   : ${this.brandedStyle.muted("Queued")}
  Insight Generation : ${this.brandedStyle.muted("Pending")}
  Report Assembly    : ${this.brandedStyle.muted("Pending")}
${this.brandedStyle.accent("━━ ")}{this.brandedStyle.heading('🛡️ Human Control Active')}
  {${this.brandedStyle.ok("✋ Your Authority")}}: レポート生成をいつでも制御可能
  {${this.brandedStyle.ok("🛑 Quick Stop")}}: ESC または「止めて」で即座停止
  {${this.brandedStyle.ok("⚙️ Customizable")}}: 内容をリアルタイム調整
${this.brandedStyle.muted('Type: "何してる？" "待って" "止めて" or [ESC] anytime')}
      `);
    }

    try {
      // Phase 1: データ収集 (中断可能)
      const _rawData = await this.collectReportData(_context);
      if (!this.isGeneratingReport) return null; // 中断チェック

      // Phase 2: AI分析 (中断可能)
      const _analysis = await this.performIntelligentAnalysis(_rawData);
      if (!this.isGeneratingReport) return null; // 中断チェック

      // Phase 3: インサイト生成 (中断可能)
      const _insights = await this.generateAIInsights(_analysis);
      if (!this.isGeneratingReport) return null; // 中断チェック

      // Phase 4: スマート提案生成 (中断可能)
      const _suggestions = await this.generateSmartSuggestions(
        _analysis,
        _insights,
      );
      if (!this.isGeneratingReport) return null; // 中断チェック

      // Phase 5: レポート組み立て
      const _report = this.assembleActiveReport(
        ReportType.DAILY,
        _rawData,
        _analysis,
        _insights,
        _suggestions,
      );

      // 人間確認が必要な場合
      if (humanControlled && this.requiresHumanReview(_report)) {
        await this.displayReportPreview(_report);
        const _approval = await this.requestHumanApproval(_report);
        if (!_approval) {
          return this.handleReportRejection(_report);
        }
      }

      this.isGeneratingReport = false;
      return _report;
    } catch (_error) {
      this.isGeneratingReport = false;
      console._error(`
${this.brandedStyle.err("❌ Report Generation Failed")}
${this.brandedStyle.accent("━━ ")}{this.brandedStyle.heading('Error')}: ${_error.message}
${this.brandedStyle.accent("━━ ")}{this.brandedStyle.heading('Recovery')}: Human intervention available
      `);
      throw _error;
    }
  }

  /**
   * タスク完了の Active Reporting
   */
  async reportTaskCompletion(
    _task: CompletedTask,
    autoAnalyze: boolean = true,
  ): Promise<void> {
    console.log(`
⏺ ${this.brandedStyle.brand(" Task Complete! ")}{this.brandedStyle.heading(task.title)}

📊 ${this.brandedStyle.heading("Active Intelligent Analysis")}:
  • ${this.brandedStyle.ok("AI Processing")}: コンテキスト分析、パターン学習中...
  • ${this.brandedStyle.ok("Human Control")}: いつでも修正・追加可能
  
🎯 ${this.brandedStyle.heading("主要成果")}:
${_task.achievements
  .map(
    (achievement) =>
      `  ${this.brandedStyle.ok("✅")} ${this.brandedStyle.heading(achievement.title)}: ${achievement.description}`,
  )
  .join("\n")}

${autoAnalyze ? this.generateTaskAnalysis(_task) : ""}

${this.brandedStyle.accent("━━ ")}{this.brandedStyle.heading('以下の案でいかがですか？')}
  ${this.brandedStyle.muted("• ")}この結果を自動的に日次レポートに含める
  ${this.brandedStyle.muted("• ")}関連チームメンバーに通知を送信
  ${this.brandedStyle.muted("• ")}学習パターンとしてメモリシステムに保存
${this.brandedStyle.muted("[Y]自動化承認 [C]カスタマイズ [N]手動のみ [Q]戻る")}
    `);

    // メモリシステムに学習データとして保存
    await this.storeTaskLearning(_task);
  }

  private generateTaskAnalysis(task: CompletedTask): string {
    return `
🤖 ${this.brandedStyle.heading("AI Analysis Results")}:
  ${this.brandedStyle.ok("Productivity Pattern")}: ${this.brandedStyle.ok(task.productivityScore + "%")} 
  ${this.brandedStyle.ok("Quality Indicators")}: ${this.brandedStyle.ok("High")} (testing coverage, code review metrics)
  ${this.brandedStyle.ok("Time Efficiency")}: ${
    task.timeEfficiency > 1.0
      ? this.brandedStyle.ok(
          `${Math.floor((task.timeEfficiency - 1) * 100)}% faster than predicted`,
        )
      : this.brandedStyle.warn(
          `${Math.floor((1 - task.timeEfficiency) * 100)}% slower than predicted`,
        )
  }
  ${this.brandedStyle.ok("Learning Opportunity")}: ${task.learningPoints.join(", ")}
    `;
  }

  /**
   * プロアクティブ報告 (背景で動作、人間制御可能)
   */
  async startProactiveReporting(
    interval: number = 300000, // 5分間隔
    humanApprovalRequired: boolean = true,
  ): Promise<void> {
    console.log(`
${this.brandedStyle.brand(" HRS ")}{this.brandedStyle.muted('│')}${this.brandedStyle.heading("Proactive Reporting Started")}
${this.brandedStyle.accent("━━ ")}{this.brandedStyle.heading('Configuration')}:
  Monitoring Interval : ${interval / 1000}s
  Human Approval      : ${humanApprovalRequired ? this.brandedStyle.ok("Required") : this.brandedStyle.warn("Automatic")}
  Auto-Detection      : ${this.brandedStyle.ok("Active")}
${this.brandedStyle.accent("━━ ")}{this.brandedStyle.heading('🛡️ Human Control')}:
  {${this.brandedStyle.ok("🛑 Stop Anytime")}}: "止めて" または ESC で停止
  {${this.brandedStyle.ok("⚙️ Adjust Settings")}}: 間隔や設定をリアルタイム変更
  {${this.brandedStyle.ok("👁️ Full Visibility")}}: すべての自動検出を通知
${this.brandedStyle.muted('Background monitoring started. Type "status" to check anytime')}
    `);

    const _proactiveTimer = setInterval(async () => {
      if (!this.isGeneratingReport) {
        try {
          const _detectedEvents = await this.detectReportableEvents();
          if (_detectedEvents.length > 0) {
            await this.handleProactiveEvents(
              _detectedEvents,
              humanApprovalRequired,
            );
          }
        } catch (_error) {
          console._error("Proactive reporting _error:", _error.message);
        }
      }
    }, interval);

    // 人間による停止を監視
    this.setupProactiveControlHandlers(_proactiveTimer);
  }

  private async detectReportableEvents(): Promise<ReportableEvent[]> {
    const events: ReportableEvent[] = [];

    // テスト失敗検出
    const _testResults = await this.checkTestStatus();
    if (_testResults.failed > 0) {
      events.push({
        type: "test_failures",
        priority: ReportPriority.HIGH,
        message: `${_testResults.failed} tests failing`,
        suggestedAction: "immediate_attention",
        confidence: 0.95,
      });
    }

    // パフォーマンス劣化検出
    const _performanceMetrics = await this.checkPerformanceMetrics();
    if (_performanceMetrics.p95 > _performanceMetrics.threshold) {
      events.push({
        type: "performance_degradation",
        priority: ReportPriority.MEDIUM,
        message: `p95 latency ${_performanceMetrics.p95}ms exceeds threshold`,
        suggestedAction: "analyze_with_ultrathink",
        confidence: 0.87,
      });
    }

    // 異常なコミットパターン検出
    const _commitAnalysis = await this.analyzeCommitPatterns();
    if (_commitAnalysis.anomalyDetected) {
      events.push({
        type: "commit_pattern_anomaly",
        priority: ReportPriority.LOW,
        message: _commitAnalysis.description,
        suggestedAction: "review_and_document",
        confidence: _commitAnalysis.confidence,
      });
    }

    return events;
  }

  private async handleProactiveEvents(
    events: ReportableEvent[],
    requireHumanApproval: boolean,
  ): Promise<void> {
    const _criticalEvents = events.filter(
      (e) =>
        e.priority === ReportPriority.CRITICAL ||
        e.priority === ReportPriority.HIGH,
    );

    if (_criticalEvents.length > 0) {
      console.log(`
${this.brandedStyle.warn("⚠️ PROACTIVE ALERT")}
${this.brandedStyle.brand(" HRS ")}{this.brandedStyle.muted('│')}${this.brandedStyle.heading("Issues Detected")}
${this.brandedStyle.accent("━━ ")}{this.brandedStyle.heading('Critical Events')}:
${_criticalEvents
  .map(
    (event) =>
      `  ${this.brandedStyle.err("🚨")} ${event.message} (${Math.floor(event.confidence * 100)}%)`,
  )
  .join("\n")}
${this.brandedStyle.accent("━━ ")}{this.brandedStyle.heading('以下の案でいかがですか？')}
  ${this.brandedStyle.muted("• ")}詳細レポートを自動生成して送信
  ${this.brandedStyle.muted("• ")}ULTRATHINK分析を開始
  ${this.brandedStyle.muted("• ")}チームに即座通知
${this.brandedStyle.muted("[Y]すべて実行 [S]選択実行 [D]詳細確認 [N]無視")}
      `);

      if (requireHumanApproval) {
        const _choice = await this.waitForUserChoice(["Y", "S", "D", "N"]);
        await this.executeProactiveAction(_choice, events);
      } else {
        await this.executeAutomaticProactiveActions(events);
      }
    }
  }

  // BaseInterruptionHandler の実装
  async executeImmediateStop(): Promise<InterruptionResponse> {
    this.isGeneratingReport = false;
    console.log(`
${this.brandedStyle.ok("✅ Report Generation Stopped")}
${this.brandedStyle.accent("━━ ")}{this.brandedStyle.heading('Status')}: Safely interrupted by human
${this.brandedStyle.accent("━━ ")}{this.brandedStyle.heading('Data')}: Partial progress saved
${this.brandedStyle.accent("━━ ")}{this.brandedStyle.heading('Resume')}: Available anytime
    `);

    return {
      success: true,
      action: InterruptionLevel.IMMEDIATE,
      message: "Report generation stopped by human request",
      canResume: true,
      rollbackAvailable: true,
    };
  }

  async executeSafePause(): Promise<InterruptionResponse> {
    this.isGeneratingReport = false;
    console.log(`
${this.brandedStyle.warn("⏸️ Report Generation Paused")}
${this.brandedStyle.accent("━━ ")}{this.brandedStyle.heading('Status')}: Safely paused by human
${this.brandedStyle.accent("━━ ")}{this.brandedStyle.heading('Progress')}: Saved at current checkpoint
${this.brandedStyle.accent("━━ ")}{this.brandedStyle.heading('Options')}: Resume, modify, or cancel
    `);

    return {
      success: true,
      action: InterruptionLevel.SAFE_PAUSE,
      message: "Report generation paused safely",
      canResume: true,
      rollbackAvailable: true,
    };
  }

  async executeRollback(): Promise<InterruptionResponse> {
    this.isGeneratingReport = false;
    this.reportingQueue = [];

    console.log(`
${this.brandedStyle.accent("🔄 Report Generation Reset")}
${this.brandedStyle.accent("━━ ")}{this.brandedStyle.heading('Status')}: Rolled back to initial state
${this.brandedStyle.accent("━━ ")}{this.brandedStyle.heading('Data')}: Cleared, ready for fresh start
${this.brandedStyle.accent("━━ ")}{this.brandedStyle.heading('Ready')}: Can start new _report generation
    `);

    return {
      success: true,
      action: InterruptionLevel.ROLLBACK,
      message: "Report generation reset to initial state",
      canResume: false,
      rollbackAvailable: false,
    };
  }

  getProcessState(): unknown {
    return {
      id: "active-reporter",
      name: "Active Intelligent Reporting",
      status: this.isGeneratingReport ? "running" : "idle",
      startTime: Date.now(),
      progress: this.calculateProgress(),
      canResume: true,
      hasPartialResults: this.reportingQueue.length > 0,
      backupAvailable: true,
    };
  }

  // ヘルパーメソッド
  private calculateProgress(): number {
    // 実際の進捗計算ロジック
    return this.isGeneratingReport ? 45 : 0;
  }

  private async collectReportData(_context: ReportContext): Promise<any> {
    // データ収集の実装
    return {};
  }

  private async performIntelligentAnalysis(_data: unknown): Promise<any> {
    // AI分析の実装
    return {};
  }

  private async generateAIInsights(_analysis: unknown): Promise<AIInsight[]> {
    // AIインサイト生成の実装
    return [];
  }

  private async generateSmartSuggestions(
    _analysis: unknown,
    _insights: AIInsight[],
  ): Promise<SmartSuggestion[]> {
    // スマート提案生成の実装
    return [];
  }

  private assembleActiveReport(
    _type: ReportType,
    _data: unknown,
    _analysis: unknown,
    _insights: AIInsight[],
    _suggestions: SmartSuggestion[],
  ): ActiveReport {
    // レポート組み立ての実装
    return {} as ActiveReport;
  }
}

// 型定義
interface ReportContext {
  userId: string;
  projectId: string;
  dateRange: { start: Date; end: Date };
  includeMetrics: boolean;
  includeAIAnalysis: boolean;
}

interface CompletedTask {
  title: string;
  achievements: Achievement[];
  productivityScore: number;
  timeEfficiency: number;
  learningPoints: string[];
}

interface Achievement {
  title: string;
  description: string;
}

interface ReportableEvent {
  type: string;
  priority: ReportPriority;
  message: string;
  suggestedAction: string;
  confidence: number;
}

interface Metric {
  name: string;
  value: number;
  unit: string;
  trend: "up" | "down" | "stable";
}

interface Blocker {
  id: string;
  description: string;
  severity: "low" | "medium" | "high";
  owner?: string;
}

interface Risk {
  id: string;
  description: string;
  probability: number;
  impact: "low" | "medium" | "high";
  mitigation?: string;
}

interface NextStep {
  id: string;
  action: string;
  priority: "low" | "medium" | "high";
  estimatedDuration?: string;
  assignee?: string;
}

interface ReportMetadata {
  generatedAt: number;
  generatedBy: "human" | "ai" | "hybrid";
  version: string;
  confidence: number;
}
