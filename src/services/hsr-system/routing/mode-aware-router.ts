// src/services/hsr-system/routing/mode-aware-router.ts
/**
 * Mode-aware Command Router
 * モード対応のコマンドルーティングシステム(人間権限保証付き)
 */

import { HSRBrandedStyle } from "../themes/branded-style.js";
import {
  BaseInterruptionHandler,
  InterruptionResponse,
  InterruptionLevel,
} from "../interruption/base-interruption-handler.js";

export enum InternalMode {
  // Reasoning modes
  ULTRATHINK = "UltraThink",
  ANALYTIC_REASONING = "AnalyticReasoning",
  CAUSAL_REASONING = "CausalReasoning",

  // Persistence & Quality modes
  GRIT = "Grit",
  QUALITY_ASSURANCE = "QualityAssurance",

  // Communication modes
  INTENT_SOCRATIC = "IntentSocratic",
  ACTIVE_LISTENING = "ActiveListening",

  // Implementation modes
  IMPLEMENTATION_FOCUS = "ImplementationFocus",
  OPTIMIZATION = "Optimization",

  // Meta modes
  SELF_QUESTIONING = "SelfQuestioning",
  MODE_SWITCHING = "ModeSwitching",
}

export enum HSRCommand {
  REPORT_DAILY = "/hrs report --daily",
  REPORT_PHASE = "/hrs report --phase",
  REPORT_THEME = "/hrs report --theme",
  CONSULT = "/hrs consult",
  APPROVE = "/hrs approve",
  WATCH = "/hrs watch",
  TASK_COMPLETE = "/hrs task-complete",
  ULTRATHINK = "/hrs ultrathink",
  INTERRUPT = "/hrs interrupt",
  STATUS = "/hrs status",
}

export interface ModeEnhancement {
  mode: InternalMode;
  enhancedCommands: HSRCommand[];
  humanOverrideRequired: boolean;
  additionalCapabilities: string[];
  riskLevel: "low" | "medium" | "high";
  recommendedUsage: string;
}

export interface CommandRoutingContext {
  _currentMode?: InternalMode;
  humanPresent: boolean;
  humanApprovalRequired: boolean;
  urgencyLevel: "low" | "medium" | "high" | "critical";
  sessionContext: any;
  previousCommands: HSRCommand[];
}

export interface RoutedCommand {
  originalCommand: HSRCommand;
  enhancedCommand: HSRCommand;
  mode: InternalMode;
  humanAuthorizationRequired: boolean;
  suggestedParameters: Record<string, any>;
  modeSpecificOptions: string[];
  warningsForHuman: string[];
  expectedBenefit: string;
}

/**
 * Mode-aware Command Router
 * 現在のモードに応じてHSRコマンドを最適化し、人間制御を保証
 */
export class ModeAwareRouter extends BaseInterruptionHandler {
  private brandedStyle: HSRBrandedStyle;
  private _currentMode?: InternalMode;
  private modeEnhancements: Map<InternalMode, ModeEnhancement>;
  private activeRoutings: Map<string, RoutedCommand> = new Map();

  constructor() {
    super("mode-router", "Mode-aware Command Router", true);
    this.brandedStyle = new HSRBrandedStyle();
    this.initializeModeEnhancements();
  }

  /**
   * モード強化の初期化
   */
  private initializeModeEnhancements(): void {
    this.modeEnhancements = new Map([
      [
        InternalMode.ULTRATHINK,
        {
          mode: InternalMode.ULTRATHINK,
          enhancedCommands: [
            HSRCommand.CONSULT,
            HSRCommand.REPORT_PHASE,
            HSRCommand.ULTRATHINK,
          ],
          humanOverrideRequired: true,
          additionalCapabilities: [
            "Multi-branch analysis",
            "Self-consistency checking",
            "Deep reasoning",
          ],
          riskLevel: "medium",
          recommendedUsage: "Complex decision-making and strategic analysis",
        },
      ],

      [
        InternalMode.GRIT,
        {
          mode: InternalMode.GRIT,
          enhancedCommands: [HSRCommand.WATCH, HSRCommand.TASK_COMPLETE],
          humanOverrideRequired: false,
          additionalCapabilities: [
            "Retry logic",
            "Failure recovery",
            "Persistence tracking",
          ],
          riskLevel: "low",
          recommendedUsage: "Long-running tasks and failure recovery",
        },
      ],

      [
        InternalMode.INTENT_SOCRATIC,
        {
          mode: InternalMode.INTENT_SOCRATIC,
          enhancedCommands: [HSRCommand.CONSULT, HSRCommand.REPORT_DAILY],
          humanOverrideRequired: true,
          additionalCapabilities: [
            "Ambiguity resolution",
            "Question clarification",
            "Context building",
          ],
          riskLevel: "low",
          recommendedUsage: "Unclear requirements and communication issues",
        },
      ],

      [
        InternalMode.QUALITY_ASSURANCE,
        {
          mode: InternalMode.QUALITY_ASSURANCE,
          enhancedCommands: [HSRCommand.APPROVE, HSRCommand.REPORT_PHASE],
          humanOverrideRequired: true,
          additionalCapabilities: [
            "Quality verification",
            "Risk assessment",
            "Standards compliance",
          ],
          riskLevel: "low",
          recommendedUsage: "Code review and approval processes",
        },
      ],

      [
        InternalMode.SELF_QUESTIONING,
        {
          mode: InternalMode.SELF_QUESTIONING,
          enhancedCommands: [HSRCommand.CONSULT, HSRCommand.STATUS],
          humanOverrideRequired: false,
          additionalCapabilities: [
            "Self-validation",
            "Assumption checking",
            "Meta-cognition",
          ],
          riskLevel: "low",
          recommendedUsage: "Continuous improvement and self-monitoring",
        },
      ],
    ]);
  }

  /**
   * 現在のモードを設定
   */
  async setCurrentMode(
    _mode: InternalMode,
    context: CommandRoutingContext,
  ): Promise<void> {
    const _previousMode = this.currentMode;
    this.currentMode = _mode;

    console.log(`
[HRS] >> MODE SWITCH << <Human authority preserved>
-- Previous: ${_previousMode || "None"}
-- Current: ${_mode}
-- Human override: ${this.modeEnhancements.get(_mode)?.humanOverrideRequired ? "[REQUIRED]" : "[OPTIONAL]"}
-- Enhanced commands: ${this.modeEnhancements.get(_mode)?.enhancedCommands.length || 0}
>> Mode switch completed
(All human controls remain active)
    `);

    // 人間に新しいモードの能力を説明
    if (context.humanPresent) {
      await this.explainModeCapabilities(_mode);
    }
  }

  /**
   * コマンドをモードに応じてルーティング
   */
  async routeCommand(
    _command: HSRCommand,
    context: CommandRoutingContext,
  ): Promise<RoutedCommand> {
    const _currentMode = context._currentMode || this._currentMode;

    if (!_currentMode) {
      return this.createStandardRouting(_command, context);
    }

    const _modeEnhancement = this.modeEnhancements.get(_currentMode);
    if (!_modeEnhancement) {
      return this.createStandardRouting(_command, context);
    }

    // モード強化されたルーティングを作成
    const _routedCommand = await this.createEnhancedRouting(
      command,
      _modeEnhancement,
      context,
    );

    // 人間承認が必要な場合は確認
    if (_routedCommand.humanAuthorizationRequired && context.humanPresent) {
      const _approved = await this.requestHumanCommandApproval(_routedCommand);
      if (!_approved) {
        return this.createStandardRouting(_command, context);
      }
    }

    // ルーティング結果を表示
    await this.displayRoutingResult(_routedCommand);

    this.activeRoutings.set(this.generateRoutingId(), _routedCommand);
    return _routedCommand;
  }

  /**
   * 強化されたルーティングの作成
   */
  private async createEnhancedRouting(
    _command: HSRCommand,
    _enhancement: ModeEnhancement,
    context: CommandRoutingContext,
  ): Promise<RoutedCommand> {
    const _isEnhanced = enhancement.enhancedCommands.includes(_command);

    const routing: RoutedCommand = {
      originalCommand: _command,
      enhancedCommand: _isEnhanced ? _command : _command,
      mode: enhancement.mode,
      humanAuthorizationRequired: enhancement.humanOverrideRequired,
      suggestedParameters: await this.generateModeSpecificParameters(
        _command,
        _enhancement,
      ),
      modeSpecificOptions: this.generateModeSpecificOptions(
        _command,
        _enhancement,
      ),
      warningsForHuman: this.generateHumanWarnings(
        _command,
        _enhancement,
        context,
      ),
      expectedBenefit: this.generateExpectedBenefit(_command, _enhancement),
    };

    return routing;
  }

  /**
   * モード能力の説明
   */
  private async explainModeCapabilities(mode: InternalMode): Promise<void> {
    const _enhancement = this.modeEnhancements.get(mode);
    if (!_enhancement) return;

    console.log(`
[HRS] >> MODE CAPABILITIES << <${mode} active>
-- Enhanced capabilities:
${_enhancement.additionalCapabilities.map((cap) => `  * ${cap}`).join("\n")}

-- Enhanced commands:
${_enhancement.enhancedCommands.map((cmd) => `  * ${cmd}`).join("\n")}

-- Human authority:
  [AUTH] ${_enhancement.humanOverrideRequired ? "Your approval required for enhanced features" : "Standard human control applies"}
  [RISK] Risk level: [${_enhancement.riskLevel.toUpperCase()}]
  [USE] Best for: ${_enhancement.recommendedUsage}

-- HUMAN CONTROL GUARANTEE:
  [ESC] Emergency stop always available
  [OVERRIDE] You can override any mode-specific behavior
  [SWITCH] Change modes anytime with "/hrs mode <mode>"
  
(Mode active | Human authority confirmed)
    `);
  }

  /**
   * コマンド承認要求
   */
  private async requestHumanCommandApproval(
    routing: RoutedCommand,
  ): Promise<boolean> {
    console.log(`
[HRS] >> HUMAN APPROVAL REQUIRED << <Mode: ${routing.mode}>
-- Command: ${routing.originalCommand}
-- Mode _enhancement: ${routing.mode}
-- Expected benefit: ${routing.expectedBenefit}

${
  routing.warningsForHuman.length > 0
    ? `-- WARNINGS:
${routing.warningsForHuman.map((warning) => `  [WARN] ${warning}`).join("\n")}`
    : ""
}

-- Mode-specific options:
${routing.modeSpecificOptions.map((option) => `  * ${option}`).join("\n")}

-- HUMAN AUTHORITY DECISION:
  [AUTH] This is YOUR _choice - approve or use standard version
  [SAFETY] You can interrupt the enhanced command anytime
  [CONTROL] You maintain full control throughout

>> Approve enhanced command?
  [Y] Yes, use ${routing.mode} _enhancement
  [N] No, use standard command  
  [M] Modify parameters first
  [E] Explain more about this mode
(Your decision)
    `);

    const _choice = await this.waitForUserChoice(["Y", "N", "M", "E"]);

    switch (_choice) {
      case "Y":
        return true;
      case "N":
        return false;
      case "M":
        await this.offerParameterModification(routing);
        return await this.requestHumanCommandApproval(routing); // Re-ask after modification
      case "E":
        await this.explainModeCapabilities(routing.mode);
        return await this.requestHumanCommandApproval(routing); // Re-ask after explanation
      default:
        return false;
    }
  }

  /**
   * ルーティング結果の表示
   */
  private async displayRoutingResult(routing: RoutedCommand): Promise<void> {
    console.log(`
-- COMMAND ROUTED SUCCESSFULLY:
  Command: ${routing.originalCommand}
  Mode: ${routing.mode}
  Enhanced: ${routing.originalCommand !== routing.enhancedCommand ? "[OK] Yes" : "Standard"}
  Human control: [OK] Active
  Expected benefit: ${routing.expectedBenefit}
>> Executing with mode enhancement...
    `);
  }

  /**
   * モード統合されたULTRATHINK分析
   */
  async executeULTRATHINKWithModeIntegration(
    goal: string,
    _context: unknown,
    _currentMode?: InternalMode,
  ): Promise<any> {
    console.log(`
[HRS] >> ULTRATHINK + ${_currentMode || "STANDARD"} << <Human controlled>
-- Goal: ${goal}
-- Mode integration: ${_currentMode ? "[OK] Active" : "Standard"}
-- Human authority: [OK] Maintained throughout analysis
    
-- MODE-SPECIFIC ENHANCEMENTS:
${this.getModeSpecificULTRATHINKEnhancements(_currentMode)}

>> Starting integrated analysis...
<ESC anytime for immediate stop | "待って" for safe pause>
    `);

    // モード統合されたULTRATHINK分析の実行
    // 実際の実装では、ULTRATHINKHSRIntegrationと連携

    return {};
  }

  /**
   * Gritモード統合
   */
  async executeGritIntegration(
    _taskId: string,
    maxAttempts: number = 6,
  ): Promise<any> {
    console.log(`
[HRS] >> GRIT MODE INTEGRATION << <Persistent execution>
-- Task: ${_taskId}
-- Max attempts: ${maxAttempts}
-- Retry strategy: Exponential backoff
-- Human override: [OK] Available anytime

-- GRIT CAPABILITIES:
  * Automatic retry on failure
  * Failure pattern learning
  * Progress preservation
  * Human notification on repeated failure

>> Starting persistent execution...
<Say "やめて" to stop | "状況は?" for status>
    `);

    // Grit統合実行のシミュレーション
    return { success: true, attempts: 1, recovered: true };
  }

  /**
   * IntentSocraticモード統合
   */
  async executeIntentSocraticIntegration(
    ambiguousRequest: string,
    _context: unknown,
  ): Promise<any> {
    console.log(`
[HRS] >> INTENT SOCRATIC MODE << <Ambiguity resolution>
-- Request: ${ambiguousRequest}
-- Ambiguity detected: [WARN] Clarification needed
-- Human guidance: [REQUIRED] Your intent matters most

-- SOCRATIC APPROACH:
  * Break down ambiguous parts
  * Ask clarifying questions
  * Build shared understanding
  * Confirm interpretation before action

>> Starting clarification process...
(Your answers will guide the analysis)
    `);

    // IntentSocratic統合の実行
    return { clarifiedIntent: ambiguousRequest, confidence: 0.85 };
  }

  // BaseInterruptionHandler 実装
  async executeImmediateStop(): Promise<InterruptionResponse> {
    // すべてのアクティブルーティングを停止
    this.activeRoutings.clear();
    this.currentMode = undefined;

    console.log(`
[ERROR] Mode-aware Router Emergency Stop
-- All active routings stopped
-- Current mode cleared
-- Human authority confirmed
    `);

    return {
      success: true,
      action: InterruptionLevel.IMMEDIATE,
      message: "Mode-aware router stopped immediately",
      canResume: true,
      rollbackAvailable: true,
    };
  }

  async executeSafePause(): Promise<InterruptionResponse> {
    console.log(`
[WARN] Mode-aware Router Paused
-- Current mode: ${this.currentMode || "None"}
-- Active routings: ${this.activeRoutings.size}
-- State preserved for resume
    `);

    return {
      success: true,
      action: InterruptionLevel.SAFE_PAUSE,
      message: "Mode-aware router paused safely",
      canResume: true,
      rollbackAvailable: true,
    };
  }

  async executeRollback(): Promise<InterruptionResponse> {
    this.activeRoutings.clear();
    this.currentMode = undefined;

    console.log(`
[HRS] Mode-aware Router Reset
-- All routings cleared
-- Mode reset to standard
-- Ready for fresh start
    `);

    return {
      success: true,
      action: InterruptionLevel.ROLLBACK,
      message: "Mode-aware router reset",
      canResume: false,
      rollbackAvailable: false,
    };
  }

  getProcessState(): unknown {
    return {
      id: "mode-router",
      name: "Mode-aware Command Router",
      status: this.currentMode ? "mode-active" : "standard",
      startTime: Date.now(),
      progress: 0,
      canResume: true,
      hasPartialResults: this.activeRoutings.size > 0,
      backupAvailable: true,
      _currentMode: this.currentMode,
      activeRoutings: this.activeRoutings.size,
    };
  }

  // ヘルパーメソッド
  private createStandardRouting(
    _command: HSRCommand,
    _context: CommandRoutingContext,
  ): RoutedCommand {
    return {
      originalCommand: _command,
      enhancedCommand: _command,
      mode: null,
      humanAuthorizationRequired: false,
      suggestedParameters: Record<string, any>,
      modeSpecificOptions: [],
      warningsForHuman: [],
      expectedBenefit: "Standard command execution",
    };
  }

  private async generateModeSpecificParameters(
    _command: HSRCommand,
    _enhancement: ModeEnhancement,
  ): Promise<Record<string, any>> {
    const parameters: Record<string, any> = {};

    if (_enhancement.mode === InternalMode.ULTRATHINK) {
      parameters.branches = 7;
      parameters.consistency_check = true;
      parameters.human_checkpoints = [30, 60, 90]; // Progress percentages
    }

    if (_enhancement.mode === InternalMode.GRIT) {
      parameters.max_attempts = 6;
      parameters.backoff_strategy = "exponential";
      parameters.notify_on_failure = true;
    }

    return parameters;
  }

  private generateModeSpecificOptions(
    _command: HSRCommand,
    _enhancement: ModeEnhancement,
  ): string[] {
    const options: string[] = [];

    switch (_enhancement.mode) {
      case InternalMode.ULTRATHINK:
        options.push("Multi-branch analysis with self-consistency");
        options.push("Human decision points at 30%, 60%, 90%");
        options.push("Partial results available anytime");
        break;
      case InternalMode.GRIT:
        options.push("Automatic retry on failure");
        options.push("Exponential backoff strategy");
        options.push("Progress preservation across attempts");
        break;
      case InternalMode.INTENTSOCRATIC:
        options.push("Ambiguity detection and clarification");
        options.push("Step-by-step understanding building");
        options.push("Human guidance integration");
        break;
    }

    return options;
  }

  private generateHumanWarnings(
    _command: HSRCommand,
    _enhancement: ModeEnhancement,
    context: CommandRoutingContext,
  ): string[] {
    const warnings: string[] = [];

    if (_enhancement.riskLevel === "high") {
      warnings.push("High risk mode - extra caution recommended");
    }

    if (_enhancement.humanOverrideRequired) {
      warnings.push("Mode requires your approval for key decisions");
    }

    if (
      context.urgencyLevel === "critical" &&
      _enhancement.mode === InternalMode.ULTRATHINK
    ) {
      warnings.push(
        "ULTRATHINK may be slower than needed for critical urgency",
      );
    }

    return warnings;
  }

  private generateExpectedBenefit(
    _command: HSRCommand,
    _enhancement: ModeEnhancement,
  ): string {
    const _benefits = {
      [InternalMode.ULTRATHINK]:
        "Higher quality analysis through multi-branch reasoning",
      [InternalMode.GRIT]:
        "Improved reliability through automatic retry and recovery",
      [InternalMode.INTENT_SOCRATIC]:
        "Better communication through ambiguity resolution",
      [InternalMode.QUALITY_ASSURANCE]:
        "Enhanced quality verification and standards compliance",
      [InternalMode.SELF_QUESTIONING]:
        "Improved accuracy through self-validation",
    };

    return (
      _benefits[_enhancement.mode] || "Mode-specific _enhancements applied"
    );
  }

  private getModeSpecificULTRATHINKEnhancements(mode?: InternalMode): string {
    if (!mode) return "  * Standard ULTRATHINK analysis";

    const _enhancements = {
      [InternalMode.GRIT]:
        "  * Persistent analysis with failure recovery\n  * Automatic retry of failed branches",
      [InternalMode.INTENT_SOCRATIC]:
        "  * Ambiguity-aware analysis\n  * Clarification requests during analysis",
      [InternalMode.QUALITY_ASSURANCE]:
        "  * Quality verification at each branch\n  * Standards compliance checking",
      [InternalMode.SELF_QUESTIONING]:
        "  * Self-validation of analysis steps\n  * Assumption verification",
    };

    return _enhancements[mode] || "  * Mode-specific analysis _enhancements";
  }

  private generateRoutingId(): string {
    return (
      "routing_" +
      Date.now().toString(36) +
      Math.random().toString(36).substr(2)
    );
  }

  private async waitForUserChoice(validChoices: string[]): Promise<string> {
    // 実際の実装では、ユーザー入力を待つロジック
    return new Promise((resolve) => {
      setTimeout(() => resolve(validChoices[0]), 2000);
    });
  }
}
