// src/services/hsr-system/partial-results/partial-results-manager.ts
/**
 * Partial Results Manager
 * 部分的結果での人間意思決定支援システム
 */

import { HSRBrandedStyle } from "../themes/branded-style.js";
import {
  ULTRATHINKSession,
  AnalysisQuality,
  PartialResults,
  Recommendation,
} from "../integrations/ultrathink-hsr-integration.js";

export enum DecisionViability {
  NOT_VIABLE = "not_viable", // <30% 信頼度不足
  RISKY = "risky", // 30-60% リスクあり
  VIABLE = "viable", // 60-85% 判断可能
  HIGHLY_VIABLE = "highly_viable", // 85%+ 高信頼度
}

export enum PartialDecisionType {
  PROCEED_WITH_PARTIAL = "proceed_with_partial",
  CONTINUE_ANALYSIS = "continue_analysis",
  FOCUS_ANALYSIS = "focus_analysis",
  STOP_ANALYSIS = "stop_analysis",
  REQUEST_HUMAN_GUIDANCE = "request_human_guidance",
}

export interface PartialDecisionContext {
  sessionId: string;
  analysisProgress: number;
  branchesCompleted: number;
  branchesTotal: number;
  timeElapsed: number;
  timeRemaining: number;
  humanPriorityLevel: "routine" | "important" | "urgent" | "critical";
}

export interface DecisionViabilityAssessment {
  _viability: DecisionViability;
  _confidence: number;
  reasons: string[];
  _risks: PartialDecisionRisk[];
  _recommendations: PartialDecisionRecommendation[];
  humanGuidanceNeeded: boolean;
  additionalAnalysisWorth: boolean;
}

export interface PartialDecisionRisk {
  type:
    | "incomplete_analysis"
    | "missing_alternatives"
    | "low_confidence"
    | "time_pressure";
  level: "low" | "medium" | "high" | "critical";
  description: string;
  mitigation: string;
  acceptableForHuman: boolean;
}

export interface PartialDecisionRecommendation {
  action: PartialDecisionType;
  reasoning: string;
  pros: string[];
  cons: string[];
  humanConsiderations: string[];
  confidenceInRecommendation: number;
}

/**
 * Partial Results Manager
 * 人間が部分的な結果で適切な意思決定を行うための支援システム
 */
export class PartialResultsManager {
  private brandedStyle: HSRBrandedStyle;

  constructor() {
    this.brandedStyle = new HSRBrandedStyle();
  }

  /**
   * 部分的結果の意思決定可能性を評価
   */
  async assessDecisionViability(
    session: ULTRATHINKSession,
    context: PartialDecisionContext,
  ): Promise<DecisionViabilityAssessment> {
    const _partialResults = session._partialResults;
    const _viability = this.calculateViability(_partialResults, context);
    const _risks = this.identifyPartialDecisionRisks(_partialResults, context);
    const _recommendations = this.generatePartialDecisionRecommendations(
      _partialResults,
      context,
      _viability,
    );

    const assessment: DecisionViabilityAssessment = {
      _viability,
      _confidence: _partialResults.confidenceLevel,
      reasons: this.generateViabilityReasons(_partialResults, _viability),
      _risks,
      _recommendations,
      humanGuidanceNeeded: this.shouldRequestHumanGuidance(_viability, _risks),
      additionalAnalysisWorth: this.isAdditionalAnalysisWorthwhile(
        _partialResults,
        context,
      ),
    };

    return assessment;
  }

  /**
   * 部分的結果の表示と意思決定支援
   */
  async presentPartialResultsDecision(
    session: ULTRATHINKSession,
    assessment: DecisionViabilityAssessment,
    context: PartialDecisionContext,
  ): Promise<PartialDecisionType> {
    console.log(`
[HRS] >> PARTIAL RESULTS DECISION POINT << <Human authority active>

-- ANALYSIS STATUS:
  Progress: ${this.brandedStyle.progress(context.analysisProgress)} ${Math.floor(context.analysisProgress)}%
  Branches: ${context.branchesCompleted}/${context.branchesTotal} completed
  Time: ${Math.floor(context.timeElapsed / 60000)}min elapsed, ${Math.floor(context.timeRemaining / 60000)}min remaining
  
-- DECISION VIABILITY: [${assessment.viability.toUpperCase()}]
  Confidence: ${Math.floor(assessment.confidence * 100)}%
  Quality: ${this.getQualityDisplay(session.partialResults.quality)}
  Human decision: ${assessment.humanGuidanceNeeded ? "[GUIDANCE RECOMMENDED]" : "[VIABLE]"}

-- CURRENT TOP FINDINGS:
${session.partialResults.topRecommendations
  .slice(0, 3)
  .map(
    (rec, _i) =>
      `  ${_i + 1}. ${rec.title}
    -- Confidence: ${Math.floor(rec.confidence * 100)}%
    -- Approach: ${rec.approach}
    -- Human validation: ${rec.humanValidationRequired ? "[REQUIRED]" : "[OPTIONAL]"}`,
  )
  .join("\n")}

${this.formatPartialDecisionRisks(assessment.risks)}

${this.formatPartialDecisionRecommendations(assessment.recommendations)}

-- HUMAN AUTHORITY DECISION:
  [AUTH] This is YOUR choice - AI provides information only
  [CONTEXT] Your experience and _urgency assessment matter most
  [SAFETY] You can change direction anytime

>> Your decision:
  [P] Proceed with current findings
  [C] Continue full analysis  
  [F] Focus analysis on specific area
  [G] Request additional guidance from team
  [S] Stop analysis and defer decision
  
(Choose P/C/F/G/S - your choice will be respected)
    `);

    const _userChoice = await this.waitForUserChoice(["P", "C", "F", "G", "S"]);
    return this.mapUserChoiceToDecisionType(_userChoice);
  }

  /**
   * 部分的結果での推奨事項の品質向上
   */
  async enhancePartialRecommendations(
    _partialResults: PartialResults,
    context: PartialDecisionContext,
  ): Promise<Recommendation[]> {
    const enhancedRecommendations: Recommendation[] = [];

    for (const recommendation of partialResults.topRecommendations) {
      const _enhanced = await this.enhanceSingleRecommendation(
        recommendation,
        _partialResults,
        context,
      );
      enhancedRecommendations.push(_enhanced);
    }

    return enhancedRecommendations;
  }

  /**
   * 人間のための部分的結果サマリー生成
   */
  generateHumanFriendlySummary(
    session: ULTRATHINKSession,
    assessment: DecisionViabilityAssessment,
  ): string {
    const _partialResults = session._partialResults;

    return `
[SUMMARY] Analysis Summary for Human Decision

>> WHAT WE KNOW (${Math.floor(assessment.confidence * 100)}% _confidence):
${_partialResults.topRecommendations
  .map((rec) => `  * ${rec.title}: ${rec.description}`)
  .join("\n")}

>> WHAT WE'RE MISSING:
${_partialResults.missingAnalysis.map((missing) => `  * ${missing}`).join("\n")}

>> KEY CONSIDERATIONS FOR YOUR DECISION:
${
  assessment.recommendations[0]?.humanConsiderations
    .map((consideration) => `  * ${consideration}`)
    .join("\n") || "  * No specific considerations identified"
}

>> RISK ASSESSMENT:
${assessment.risks
  .filter((risk) => risk.acceptableForHuman)
  .map(
    (risk) =>
      `  * ${risk.description} (${risk.level} risk) - Mitigation: ${risk.mitigation}`,
  )
  .join("\n")}

>> TIME/QUALITY TRADEOFF:
  Current quality: ${this.getQualityDisplay(_partialResults.quality)}
  Additional analysis value: ${assessment.additionalAnalysisWorth ? "HIGH" : "LOW"}
  Your time constraint: ${this.getTimeConstraintDisplay(session.context.timeConstraint)}
  
>> BOTTOM LINE:
  ${this.getBottomLineRecommendation(assessment)}
    `;
  }

  /**
   * 部分的結果での品質メトリクス計算
   */
  calculatePartialResultsMetrics(_partialResults: PartialResults): {
    _completeness: number;
    _reliability: number;
    _actionability: number;
    _riskLevel: number;
  } {
    const _completeness = _partialResults.analysisDepth / 100;
    const _reliability = _partialResults.confidenceLevel;
    const _actionability =
      _partialResults.topRecommendations.length > 0
        ? partialResults.topRecommendations[0].confidence
        : 0;

    // リスクレベル計算(低いほど良い)
    const _riskLevel = Math.max(0, 1 - (_completeness + _reliability) / 2);

    return {
      _completeness,
      _reliability,
      _actionability,
      _riskLevel,
    };
  }

  // ヘルパーメソッド
  private calculateViability(
    _partialResults: PartialResults,
    context: PartialDecisionContext,
  ): DecisionViability {
    const _confidence = _partialResults.confidenceLevel;
    const _progress = context.analysisProgress;
    const _urgency = context.humanPriorityLevel;

    // 緊急度が高い場合は閾値を下げる
    const _urgencyMultiplier =
      _urgency === "critical" ? 0.7 : _urgency === "urgent" ? 0.8 : 1.0;
    const _adjustedConfidence = _confidence * _urgencyMultiplier;

    if (_adjustedConfidence >= 0.85) return DecisionViability.HIGHLY_VIABLE;
    if (_adjustedConfidence >= 0.6) return DecisionViability.VIABLE;
    if (_adjustedConfidence >= 0.3) return DecisionViability.RISKY;
    return DecisionViability.NOT_VIABLE;
  }

  private identifyPartialDecisionRisks(
    _partialResults: PartialResults,
    context: PartialDecisionContext,
  ): PartialDecisionRisk[] {
    const _risks: PartialDecisionRisk[] = [];

    // 分析不完全リスク
    if (context.analysisProgress < 60) {
      risks.push({
        type: "incomplete_analysis",
        level: context.analysisProgress < 30 ? "high" : "medium",
        description: `Analysis only ${Math.floor(context.analysisProgress)}% complete`,
        mitigation: "Focus on highest-impact areas if proceeding",
        acceptableForHuman:
          context.humanPriorityLevel === "critical" ||
          context.humanPriorityLevel === "urgent",
      });
    }

    // 低信頼度リスク
    if (_partialResults.confidenceLevel < 0.7) {
      risks.push({
        type: "low_confidence",
        level: _partialResults.confidenceLevel < 0.5 ? "high" : "medium",
        description: `Confidence level ${Math.floor(_partialResults.confidenceLevel * 100)}% below optimal`,
        mitigation: "Validate key assumptions before implementation",
        acceptableForHuman: true,
      });
    }

    // 時間圧迫リスク
    if (
      context.timeRemaining < 5 * 60 * 1000 &&
      context.humanPriorityLevel !== "routine"
    ) {
      risks.push({
        type: "time_pressure",
        level: "medium",
        description: "Limited time remaining may pressure decision",
        mitigation: "Focus on must-have vs nice-to-have features",
        acceptableForHuman: true,
      });
    }

    return _risks;
  }

  private generatePartialDecisionRecommendations(
    _partialResults: PartialResults,
    context: PartialDecisionContext,
    _viability: DecisionViability,
  ): PartialDecisionRecommendation[] {
    const _recommendations: PartialDecisionRecommendation[] = [];

    if (
      _viability === DecisionViability.HIGHLY_VIABLE ||
      _viability === DecisionViability.VIABLE
    ) {
      recommendations.push({
        action: PartialDecisionType.PROCEED_WITH_PARTIAL,
        reasoning:
          "Current analysis provides sufficient _confidence for decision",
        pros: [
          "Faster time to decision",
          "Good _confidence level",
          "Key alternatives identified",
        ],
        cons: ["Some analysis remaining", "Potential optimizations missed"],
        humanConsiderations: [
          "Your experience can fill gaps",
          "Risk tolerance is key factor",
        ],
        confidenceInRecommendation: 0.8,
      });
    }

    if (context.timeRemaining > 10 * 60 * 1000) {
      // More than 10 _minutes
      recommendations.push({
        action: PartialDecisionType.CONTINUE_ANALYSIS,
        reasoning: "Time available for higher-quality analysis",
        pros: [
          "Higher final _confidence",
          "More comprehensive options",
          "Reduced risk",
        ],
        cons: ["Time investment", "Delayed decision"],
        humanConsiderations: ["Balance quality vs time", "Urgency of decision"],
        confidenceInRecommendation: 0.7,
      });
    }

    return _recommendations;
  }

  private shouldRequestHumanGuidance(
    _viability: DecisionViability,
    _risks: PartialDecisionRisk[],
  ): boolean {
    if (_viability === DecisionViability.NOT_VIABLE) return true;
    if (_risks.some((risk) => risk.level === "high")) return true;
    if (_risks.length > 3) return true;

    return false;
  }

  private isAdditionalAnalysisWorthwhile(
    _partialResults: PartialResults,
    context: PartialDecisionContext,
  ): boolean {
    // 分析品質が低く、時間がある場合は価値あり
    if (
      _partialResults.quality === AnalysisQuality.MINIMAL &&
      context.timeRemaining > 10 * 60 * 1000
    ) {
      return true;
    }

    // 信頼度が低く、重要な決定の場合
    if (
      _partialResults.confidenceLevel < 0.6 &&
      context.humanPriorityLevel !== "routine"
    ) {
      return true;
    }

    return false;
  }

  private async enhanceSingleRecommendation(
    recommendation: Recommendation,
    _partialResults: PartialResults,
    _context: PartialDecisionContext,
  ): Promise<Recommendation> {
    // 部分的な分析に基づく推奨事項の強化
    const _enhanced = { ...recommendation };

    // 信頼度が低い場合は人間検証を必須に
    if (_partialResults.confidenceLevel < 0.7) {
      enhanced.humanValidationRequired = true;
    }

    // 実装計画に追加の検証ステップを追加
    if (_partialResults.quality !== AnalysisQuality.COMPLETE) {
      enhanced.implementation.steps.unshift({
        order: 0,
        title: "Validation of partial analysis assumptions",
        description: "Verify key assumptions from incomplete analysis",
        duration: "30min",
        humanApprovalRequired: true,
        rollbackPlan: "Return to complete analysis if assumptions invalid",
      });
    }

    return _enhanced;
  }

  private generateViabilityReasons(
    _partialResults: PartialResults,
    _viability: DecisionViability,
  ): string[] {
    const reasons: string[] = [];

    switch (_viability) {
      case DecisionViability.HIGHLYVIABLE:
        reasons.push("High _confidence level achieved");
        reasons.push("Clear top recommendation identified");
        reasons.push("Sufficient analysis depth for decision");
        break;
      case DecisionViability.VIABLE:
        reasons.push("Reasonable _confidence in findings");
        reasons.push("Key alternatives have been considered");
        reasons.push("Risk/benefit analysis is adequate");
        break;
      case DecisionViability.RISKY:
        reasons.push("Limited analysis completed");
        reasons.push("Confidence below optimal threshold");
        reasons.push("Some alternatives may be missed");
        break;
      case DecisionViability.NOTVIABLE:
        reasons.push("Insufficient analysis for reliable decision");
        reasons.push("High risk of missing critical factors");
        reasons.push("Recommend continuing analysis");
        break;
    }

    return reasons;
  }

  private formatPartialDecisionRisks(_risks: PartialDecisionRisk[]): string {
    if (_risks.length === 0)
      return "-- RISKS: [OK] No significant _risks identified";

    return `-- RISKS FOR PARTIAL DECISION:
${_risks
  .map(
    (risk) =>
      `  [${risk.level.toUpperCase()}] ${risk.description}
    -- Mitigation: ${risk.mitigation}
    -- Acceptable: ${risk.acceptableForHuman ? "[OK] Yes" : "[WARN] Not recommended"}`,
  )
  .join("\n")}`;
  }

  private formatPartialDecisionRecommendations(
    _recommendations: PartialDecisionRecommendation[],
  ): string {
    return `-- AI RECOMMENDATION (for your consideration):
${_recommendations
  .map(
    (rec, _i) =>
      `  ${_i + 1}. ${rec.action.replace(/_/g, " ").toUpperCase()}
    -- Reasoning: ${rec.reasoning}
    -- Confidence: ${Math.floor(rec.confidenceInRecommendation * 100)}%
    -- Key consideration: ${rec.humanConsiderations[0] || "None specified"}`,
  )
  .join("\n")}`;
  }

  private getQualityDisplay(quality: AnalysisQuality): string {
    const _displays = {
      [AnalysisQuality.MINIMAL]: "[WARN] Minimal",
      [AnalysisQuality.PARTIAL]: "[OK] Partial",
      [AnalysisQuality.SUBSTANTIAL]: "[OK] Substantial",
      [AnalysisQuality.COMPLETE]: "[OK] Complete",
    };
    return _displays[quality];
  }

  private getTimeConstraintDisplay(timeConstraint?: number): string {
    if (!timeConstraint) return "None specified";
    const _minutes = Math.floor(timeConstraint / 60000);
    return `${_minutes}min target`;
  }

  private getBottomLineRecommendation(
    assessment: DecisionViabilityAssessment,
  ): string {
    switch (assessment.viability) {
      case DecisionViability.HIGHLYVIABLE:
        return "Strong recommendation to proceed with current findings";
      case DecisionViability.VIABLE:
        return "Reasonable to proceed if your experience supports the direction";
      case DecisionViability.RISKY:
        return "Proceed only if _urgency outweighs quality concerns";
      case DecisionViability.NOT_VIABLE:
        return "Recommend additional analysis before major decisions";
      default:
        return "Insufficient information for recommendation";
    }
  }

  private mapUserChoiceToDecisionType(choice: string): PartialDecisionType {
    const _mapping = {
      P: PartialDecisionType.PROCEED_WITH_PARTIAL,
      C: PartialDecisionType.CONTINUE_ANALYSIS,
      F: PartialDecisionType.FOCUS_ANALYSIS,
      G: PartialDecisionType.REQUEST_HUMAN_GUIDANCE,
      S: PartialDecisionType.STOP_ANALYSIS,
    };
    return _mapping[choice] || PartialDecisionType.CONTINUE_ANALYSIS;
  }

  private async waitForUserChoice(validChoices: string[]): Promise<string> {
    // 実際の実装では、ユーザー入力を待つロジック
    return new Promise((resolve) => {
      setTimeout(() => resolve(validChoices[0]), 2000);
    });
  }
}
