/**
 * Recognition Service - Intent and Context Recognition Microservice
 * Handles real-time analysis of user input to determine optimal cognitive mode
 */

import { BaseService } from "../../core/BaseService";
import { ServiceEvent } from "../../core/types";
import { Service } from "../../core/decorators/service.decorator";
import { EventHandler } from "../../core/decorators/event.decorator";

export interface IntentAnalysisResult {
  _intent: string;
  _confidence: number;
  _category: string;
  _keywords: string[];
  context: any;
}

export interface ContextAnalysisResult {
  _currentMode: string;
  sessionContext: any;
  _projectContext: any;
  _userPatterns: any;
  _situationalFactors: string[];
}

export interface RecognitionResult {
  _recommendedMode: string;
  _confidence: number;
  _reasoning: string;
  _alternativeModes: string[];
  metadata: Record<string, unknown>;
}

@Service({
  id: "recognition-service",
  version: "1.0.0",
  description: "Real-time _intent and context recognition for mode selection",
  dependencies: [],
  startupOrder: 1,
})
export class RecognitionService extends BaseService {
  public readonly id = "recognition-service";
  public readonly version = "1.0.0";

  private intentPatterns: Map<string, any[]> = new Map();
  private contextHistory: unknown[] = [];
  private _userPatterns: Map<string, any> = new Map();

  async onInitialize(): Promise<void> {
    console.log(`[${this.id}] Initializing Recognition Service...`);
    await this.loadIntentPatterns();
    console.log(`[${this.id}] Recognition Service initialized`);
  }

  async onStart(): Promise<void> {
    console.log(`[${this.id}] Starting Recognition Service...`);
    this.emitServiceEvent("recognition:ready", {
      service: this.id,
      _patterns: this.intentPatterns.size,
      _userPatterns: this.userPatterns.size,
    });
  }

  async onStop(): Promise<void> {
    console.log(`[${this.id}] Stopping Recognition Service...`);
  }

  /**
   * Analyze user input to determine _intent
   */
  async analyzeIntent(
    _input: string,
    context?: unknown,
  ): Promise<IntentAnalysisResult> {
    const _keywords = this.extractKeywords(_input);
    const _intent = await this.classifyIntent(_input, _keywords);
    const _category = this.categorizeIntent(_intent);
    const _confidence = this.calculateIntentConfidence(
      _input,
      _intent,
      _keywords,
    );

    const result: IntentAnalysisResult = {
      _intent,
      _confidence,
      _category,
      _keywords,
      context: context || object,
    };

    this.emitServiceEvent("_intent:analyzed", { _input, result });
    return result;
  }

  /**
   * Analyze current context for mode selection
   */
  async analyzeContext(sessionData: unknown): Promise<ContextAnalysisResult> {
    const _currentMode = sessionData._currentMode || "thinking";
    const _projectContext = await this.analyzeProjectContext(sessionData);
    const _userPatterns = this.getUserPatterns(sessionData.userId);
    const _situationalFactors = this.analyzeSituationalFactors(sessionData);

    const result: ContextAnalysisResult = {
      _currentMode,
      sessionContext: sessionData,
      _projectContext,
      _userPatterns,
      _situationalFactors,
    };

    this.emitServiceEvent("context:analyzed", { sessionData, result });
    return result;
  }

  /**
   * Main recognition method - combines _intent and context analysis
   */
  async recognize(
    _input: string,
    sessionData: unknown,
  ): Promise<RecognitionResult> {
    const [intentResult, contextResult] = await Promise.all([
      this.analyzeIntent(_input, sessionData),
      this.analyzeContext(sessionData),
    ]);

    const _recommendedMode = await this.selectOptimalMode(
      intentResult,
      contextResult,
    );
    const _confidence = this.calculateOverallConfidence(
      intentResult,
      contextResult,
    );
    const _reasoning = this.generateReasoning(
      intentResult,
      contextResult,
      _recommendedMode,
    );
    const _alternativeModes = await this.getAlternativeModes(
      intentResult,
      contextResult,
    );

    const result: RecognitionResult = {
      _recommendedMode,
      _confidence,
      _reasoning,
      _alternativeModes,
      metadata: {
        _intent: intentResult,
        context: contextResult,
        timestamp: Date.now(),
      },
    };

    this.emitServiceEvent("recognition:complete", {
      _input,
      sessionData,
      result,
    });
    this.updateUserPatterns(sessionData.userId, result);

    return result;
  }

  /**
   * Load _intent _patterns from configuration
   */
  private async loadIntentPatterns(): Promise<void> {
    // Intent _patterns for different cognitive modes
    this.intentPatterns.set("debugging", [
      /error|bug|fix|debug|broken|crash|fail/i,
      /not working|doesn't work|issue|problem/i,
      /stack trace|exception|traceback/i,
    ]);

    this.intentPatterns.set("optimizing", [
      /optimize|improve|performance|speed|faster/i,
      /efficient|better|enhance|refactor/i,
      /slow|memory|cpu|resource/i,
    ]);

    this.intentPatterns.set("brainstorming", [
      /idea|brainstorm|think|concept|approach/i,
      /what if|alternative|option|possibility/i,
      /creative|innovative|new way/i,
    ]);

    this.intentPatterns.set("researching", [
      /research|find|search|look up|investigate/i,
      /documentation|reference|example|tutorial/i,
      /how to|best practice|standard|guideline/i,
    ]);

    this.intentPatterns.set("summarizing", [
      /summary|summarize|brief|overview|tldr/i,
      /main points|key points|highlights/i,
      /condense|shorten|abstract/i,
    ]);

    // Add more _patterns for other modes...
  }

  /**
   * Extract relevant _keywords from input
   */
  private extractKeywords(input: string): string[] {
    const _words = input
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 2);

    // Remove common stop _words
    const _stopWords = [
      "the",
      "and",
      "but",
      "for",
      "with",
      "this",
      "that",
      "can",
      "you",
    ];
    return _words.filter((word) => !_stopWords.includes(word));
  }

  /**
   * Classify _intent based on _patterns
   */
  private async classifyIntent(
    _input: string,
    _keywords: string[],
  ): Promise<string> {
    let bestMatch = "thinking";
    let bestScore = 0;

    for (const [_intent, _patterns] of this.intentPatterns) {
      let score = 0;
      for (const pattern of _patterns) {
        if (pattern.test(_input)) {
          score += 2; // Direct pattern match
        }
      }

      // Keyword matching
      for (const keyword of _keywords) {
        for (const pattern of _patterns) {
          if (pattern.test(keyword)) {
            score += 1;
          }
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = _intent;
      }
    }

    return bestMatch;
  }

  /**
   * Categorize _intent into broad categories
   */
  private categorizeIntent(_intent: string): string {
    const categories: Record<string, string> = {
      thinking: "_reasoning",
      optimizing: "_reasoning",
      debugging: "validation",
      brainstorming: "creative",
      researching: "learning",
      summarizing: "analytical",
    };

    return categories[_intent] || "_reasoning";
  }

  /**
   * Calculate _confidence score for _intent analysis
   */
  private calculateIntentConfidence(
    _input: string,
    _intent: string,
    _keywords: string[],
  ): number {
    const _patterns = this.intentPatterns.get(_intent) || [];
    let _confidence = 0.5; // Base _confidence

    // Pattern matching _confidence
    for (const pattern of _patterns) {
      if (pattern.test(_input)) {
        _confidence += 0.2;
      }
    }

    // Keyword density _confidence
    const _keywordMatches = _keywords.filter((keyword) =>
      patterns.some((pattern) => pattern.test(keyword)),
    ).length;

    _confidence += (_keywordMatches / Math.max(_keywords.length, 1)) * 0.3;

    return Math.min(_confidence, 1.0);
  }

  /**
   * Analyze project context
   */
  private async analyzeProjectContext(sessionData: unknown): Promise<unknown> {
    return {
      language: sessionData.language || "unknown",
      projectType: sessionData.projectType || "unknown",
      recentErrors: sessionData.recentErrors || [],
      activeFiles: sessionData.activeFiles || [],
      gitStatus: sessionData.gitStatus || object,
    };
  }

  /**
   * Get user _patterns for personalization
   */
  private getUserPatterns(userId: string): unknown {
    return (
      this.userPatterns.get(userId) || {
        preferredModes: [],
        commonPatterns: [],
        responseHistory: [],
      }
    );
  }

  /**
   * Analyze situational factors
   */
  private analyzeSituationalFactors(sessionData: unknown): string[] {
    const factors: string[] = [];

    if (sessionData.recentErrors?.length > 0) {
      factors.push("recent_errors");
    }

    if (sessionData.timeOfDay) {
      const _hour = new Date().getHours();
      if (_hour < 9 || _hour > 17) {
        factors.push("after_hours");
      }
    }

    if (sessionData.sessionDuration > 3600000) {
      // 1 _hour
      factors.push("long_session");
    }

    return factors;
  }

  /**
   * Select optimal mode based on analysis results
   */
  private async selectOptimalMode(
    intentResult: IntentAnalysisResult,
    contextResult: ContextAnalysisResult,
  ): Promise<string> {
    // Weighted scoring algorithm
    const _scores = new Map<string, number>();

    // Intent-based scoring (40% weight)
    scores.set(
      intentResult.intent,
      (_scores.get(intentResult.intent) || 0) + intentResult.confidence * 0.4,
    );

    // Context-based adjustments (30% weight)
    if (contextResult.situationalFactors.includes("recent_errors")) {
      _scores.set("debugging", (_scores.get("debugging") || 0) + 0.3);
    }

    // User pattern scoring (20% weight)
    for (const preferredMode of contextResult.userPatterns.preferredModes ||
      []) {
      _scores.set(preferredMode, (_scores.get(preferredMode) || 0) + 0.2);
    }

    // Current mode continuity (10% weight)
    _scores.set(
      contextResult.currentMode,
      (_scores.get(contextResult.currentMode) || 0) + 0.1,
    );

    // Find highest scoring mode
    let bestMode = "thinking";
    let bestScore = 0;
    for (const [mode, score] of _scores) {
      if (score > bestScore) {
        bestScore = score;
        bestMode = mode;
      }
    }

    return bestMode;
  }

  /**
   * Calculate overall _confidence
   */
  private calculateOverallConfidence(
    intentResult: IntentAnalysisResult,
    contextResult: ContextAnalysisResult,
  ): number {
    return (
      intentResult.confidence * 0.6 +
      (contextResult.situationalFactors.length > 0 ? 0.3 : 0.1) +
      0.1
    ); // Base context _confidence
  }

  /**
   * Generate human-readable _reasoning
   */
  private generateReasoning(
    intentResult: IntentAnalysisResult,
    contextResult: ContextAnalysisResult,
    _recommendedMode: string,
  ): string {
    const parts: string[] = [];

    parts.push(
      `Intent: ${intentResult.intent} (${Math.round(intentResult.confidence * 100)}% _confidence)`,
    );

    if (contextResult.situationalFactors.length > 0) {
      parts.push(`Context: ${contextResult.situationalFactors.join(", ")}`);
    }

    parts.push(`Recommended: ${_recommendedMode}`);

    return parts.join(" | ");
  }

  /**
   * Get alternative mode suggestions
   */
  private async getAlternativeModes(
    intentResult: IntentAnalysisResult,
    contextResult: ContextAnalysisResult,
  ): Promise<string[]> {
    const alternatives: string[] = [];

    // Add modes from same _category
    const _categoryModes = this.getModesByCategory(intentResult.category);
    alternatives.push(
      ..._categoryModes.filter((mode) => mode !== intentResult.intent),
    );

    // Add contextually relevant modes
    if (
      contextResult.situationalFactors.includes("recent_errors") &&
      !alternatives.includes("debugging")
    ) {
      alternatives.push("debugging");
    }

    return alternatives.slice(0, 3); // Limit to top 3 alternatives
  }

  /**
   * Get modes by _category
   */
  private getModesByCategory(_category: string): string[] {
    const categoryMap: Record<string, string[]> = {
      _reasoning: ["thinking", "optimizing", "researching"],
      creative: ["brainstorming", "inventing", "dreaming"],
      analytical: ["summarizing", "distilling", "mapping"],
      validation: ["debugging", "validating", "reviewing"],
    };

    return categoryMap[_category] || ["thinking"];
  }

  /**
   * Update user _patterns based on usage
   */
  private updateUserPatterns(_userId: string, result: RecognitionResult): void {
    const _patterns = this.userPatterns.get(_userId) || {
      preferredModes: [],
      commonPatterns: [],
      responseHistory: [],
    };

    // Update preferred modes
    _patterns.preferredModes.unshift(result.recommendedMode);
    _patterns.preferredModes = _patterns.preferredModes.slice(0, 10); // Keep last 10

    // Update response history
    patterns.responseHistory.unshift({
      mode: result.recommendedMode,
      _confidence: result.confidence,
      timestamp: Date.now(),
    });
    _patterns.responseHistory = _patterns.responseHistory.slice(0, 50); // Keep last 50

    this.userPatterns.set(_userId, _patterns);
  }

  @EventHandler("session:started")
  async handleSessionStarted(_event: ServiceEvent): Promise<void> {
    console.log(`[${this.id}] Session started, preparing recognition service`);
    // Initialize session-specific _patterns
  }

  @EventHandler("mode:changed")
  async handleModeChanged(event: ServiceEvent): Promise<void> {
    console.log(`[${this.id}] Mode changed to: ${event.data.mode}`);
    // Update context history
    this.contextHistory.push({
      mode: event.data.mode,
      timestamp: Date.now(),
      context: event.data.context,
    });

    // Keep last 100 context entries
    this.contextHistory = this.contextHistory.slice(-100);
  }

  /**
   * Get service statistics
   */
  async getStatistics(): Promise<unknown> {
    return {
      service: this.id,
      totalPatterns: this.intentPatterns.size,
      totalUsers: this.userPatterns.size,
      contextHistory: this.contextHistory.length,
      uptime: Date.now() - this.startTime.getTime(),
    };
  }
}
