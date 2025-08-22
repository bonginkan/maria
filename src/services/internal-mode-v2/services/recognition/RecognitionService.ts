/**
 * Recognition Service - Intent and Context Recognition Microservice
 * Handles real-time analysis of user input to determine optimal cognitive mode
 */

import { BaseService } from '../../core/BaseService.js';
import { ServiceEvent } from '../../core/types.js';
import { Service } from '../../core/decorators/service.decorator.js';
import { EventHandler } from '../../core/decorators/event.decorator.js';

export interface IntentAnalysisResult {
  intent: string;
  confidence: number;
  category: string;
  keywords: string[];
  context: any;
}

export interface ContextAnalysisResult {
  currentMode: string;
  sessionContext: any;
  projectContext: any;
  userPatterns: any;
  situationalFactors: string[];
}

export interface RecognitionResult {
  recommendedMode: string;
  confidence: number;
  reasoning: string;
  alternativeModes: string[];
  metadata: Record<string, unknown>;
}

@Service({
  id: 'recognition-service',
  version: '1.0.0',
  description: 'Real-time intent and context recognition for mode selection',
  dependencies: [],
  startupOrder: 1,
})
export class RecognitionService extends BaseService {
  public readonly id = 'recognition-service';
  public readonly version = '1.0.0';

  private intentPatterns: Map<string, any[]> = new Map();
  private contextHistory: unknown[] = [];
  private userPatterns: Map<string, any> = new Map();

  async onInitialize(): Promise<void> {
    console.log(`[${this.id}] Initializing Recognition Service...`);
    await this.loadIntentPatterns();
    console.log(`[${this.id}] Recognition Service initialized`);
  }

  async onStart(): Promise<void> {
    console.log(`[${this.id}] Starting Recognition Service...`);
    this.emitServiceEvent('recognition:ready', {
      service: this.id,
      patterns: this.intentPatterns.size,
      userPatterns: this.userPatterns.size,
    });
  }

  async onStop(): Promise<void> {
    console.log(`[${this.id}] Stopping Recognition Service...`);
  }

  /**
   * Analyze user input to determine intent
   */
  async analyzeIntent(input: string, context?: unknown): Promise<IntentAnalysisResult> {
    const keywords = this.extractKeywords(input);
    const intent = await this.classifyIntent(input, keywords);
    const category = this.categorizeIntent(intent);
    const confidence = this.calculateIntentConfidence(input, intent, keywords);

    const result: IntentAnalysisResult = {
      intent,
      confidence,
      category,
      keywords,
      context: context || {},
    };

    this.emitServiceEvent('intent:analyzed', { input, result });
    return result;
  }

  /**
   * Analyze current context for mode selection
   */
  async analyzeContext(sessionData: unknown): Promise<ContextAnalysisResult> {
    const currentMode = sessionData.currentMode || 'thinking';
    const projectContext = await this.analyzeProjectContext(sessionData);
    const userPatterns = this.getUserPatterns(sessionData.userId);
    const situationalFactors = this.analyzeSituationalFactors(sessionData);

    const result: ContextAnalysisResult = {
      currentMode,
      sessionContext: sessionData,
      projectContext,
      userPatterns,
      situationalFactors,
    };

    this.emitServiceEvent('context:analyzed', { sessionData, result });
    return result;
  }

  /**
   * Main recognition method - combines intent and context analysis
   */
  async recognize(input: string, sessionData: unknown): Promise<RecognitionResult> {
    const [intentResult, contextResult] = await Promise.all([
      this.analyzeIntent(input, sessionData),
      this.analyzeContext(sessionData),
    ]);

    const recommendedMode = await this.selectOptimalMode(intentResult, contextResult);
    const confidence = this.calculateOverallConfidence(intentResult, contextResult);
    const reasoning = this.generateReasoning(intentResult, contextResult, recommendedMode);
    const alternativeModes = await this.getAlternativeModes(intentResult, contextResult);

    const result: RecognitionResult = {
      recommendedMode,
      confidence,
      reasoning,
      alternativeModes,
      metadata: {
        intent: intentResult,
        context: contextResult,
        timestamp: Date.now(),
      },
    };

    this.emitServiceEvent('recognition:complete', { input, sessionData, result });
    this.updateUserPatterns(sessionData.userId, result);

    return result;
  }

  /**
   * Load intent patterns from configuration
   */
  private async loadIntentPatterns(): Promise<void> {
    // Intent patterns for different cognitive modes
    this.intentPatterns.set('debugging', [
      /error|bug|fix|debug|broken|crash|fail/i,
      /not working|doesn't work|issue|problem/i,
      /stack trace|exception|traceback/i,
    ]);

    this.intentPatterns.set('optimizing', [
      /optimize|improve|performance|speed|faster/i,
      /efficient|better|enhance|refactor/i,
      /slow|memory|cpu|resource/i,
    ]);

    this.intentPatterns.set('brainstorming', [
      /idea|brainstorm|think|concept|approach/i,
      /what if|alternative|option|possibility/i,
      /creative|innovative|new way/i,
    ]);

    this.intentPatterns.set('researching', [
      /research|find|search|look up|investigate/i,
      /documentation|reference|example|tutorial/i,
      /how to|best practice|standard|guideline/i,
    ]);

    this.intentPatterns.set('summarizing', [
      /summary|summarize|brief|overview|tldr/i,
      /main points|key points|highlights/i,
      /condense|shorten|abstract/i,
    ]);

    // Add more patterns for other modes...
  }

  /**
   * Extract relevant keywords from input
   */
  private extractKeywords(input: string): string[] {
    const words = input
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 2);

    // Remove common stop words
    const stopWords = ['the', 'and', 'but', 'for', 'with', 'this', 'that', 'can', 'you'];
    return words.filter((word) => !stopWords.includes(word));
  }

  /**
   * Classify intent based on patterns
   */
  private async classifyIntent(input: string, keywords: string[]): Promise<string> {
    let bestMatch = 'thinking';
    let bestScore = 0;

    for (const [intent, patterns] of this.intentPatterns) {
      let score = 0;
      for (const pattern of patterns) {
        if (pattern.test(input)) {
          score += 2; // Direct pattern match
        }
      }

      // Keyword matching
      for (const keyword of keywords) {
        for (const pattern of patterns) {
          if (pattern.test(keyword)) {
            score += 1;
          }
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = intent;
      }
    }

    return bestMatch;
  }

  /**
   * Categorize intent into broad categories
   */
  private categorizeIntent(intent: string): string {
    const categories: Record<string, string> = {
      thinking: 'reasoning',
      optimizing: 'reasoning',
      debugging: 'validation',
      brainstorming: 'creative',
      researching: 'learning',
      summarizing: 'analytical',
    };

    return categories[intent] || 'reasoning';
  }

  /**
   * Calculate confidence score for intent analysis
   */
  private calculateIntentConfidence(input: string, intent: string, keywords: string[]): number {
    const patterns = this.intentPatterns.get(intent) || [];
    let confidence = 0.5; // Base confidence

    // Pattern matching confidence
    for (const pattern of patterns) {
      if (pattern.test(input)) {
        confidence += 0.2;
      }
    }

    // Keyword density confidence
    const keywordMatches = keywords.filter((keyword) =>
      patterns.some((pattern) => pattern.test(keyword)),
    ).length;

    confidence += (keywordMatches / Math.max(keywords.length, 1)) * 0.3;

    return Math.min(confidence, 1.0);
  }

  /**
   * Analyze project context
   */
  private async analyzeProjectContext(sessionData: unknown): Promise<unknown> {
    return {
      language: sessionData.language || 'unknown',
      projectType: sessionData.projectType || 'unknown',
      recentErrors: sessionData.recentErrors || [],
      activeFiles: sessionData.activeFiles || [],
      gitStatus: sessionData.gitStatus || {},
    };
  }

  /**
   * Get user patterns for personalization
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
      factors.push('recent_errors');
    }

    if (sessionData.timeOfDay) {
      const hour = new Date().getHours();
      if (hour < 9 || hour > 17) {
        factors.push('after_hours');
      }
    }

    if (sessionData.sessionDuration > 3600000) {
      // 1 hour
      factors.push('long_session');
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
    const scores = new Map<string, number>();

    // Intent-based scoring (40% weight)
    scores.set(
      intentResult.intent,
      (scores.get(intentResult.intent) || 0) + intentResult.confidence * 0.4,
    );

    // Context-based adjustments (30% weight)
    if (contextResult.situationalFactors.includes('recent_errors')) {
      scores.set('debugging', (scores.get('debugging') || 0) + 0.3);
    }

    // User pattern scoring (20% weight)
    for (const preferredMode of contextResult.userPatterns.preferredModes || []) {
      scores.set(preferredMode, (scores.get(preferredMode) || 0) + 0.2);
    }

    // Current mode continuity (10% weight)
    scores.set(contextResult.currentMode, (scores.get(contextResult.currentMode) || 0) + 0.1);

    // Find highest scoring mode
    let bestMode = 'thinking';
    let bestScore = 0;
    for (const [mode, score] of scores) {
      if (score > bestScore) {
        bestScore = score;
        bestMode = mode;
      }
    }

    return bestMode;
  }

  /**
   * Calculate overall confidence
   */
  private calculateOverallConfidence(
    intentResult: IntentAnalysisResult,
    contextResult: ContextAnalysisResult,
  ): number {
    return (
      intentResult.confidence * 0.6 +
      (contextResult.situationalFactors.length > 0 ? 0.3 : 0.1) +
      0.1
    ); // Base context confidence
  }

  /**
   * Generate human-readable reasoning
   */
  private generateReasoning(
    intentResult: IntentAnalysisResult,
    contextResult: ContextAnalysisResult,
    recommendedMode: string,
  ): string {
    const parts: string[] = [];

    parts.push(
      `Intent: ${intentResult.intent} (${Math.round(intentResult.confidence * 100)}% confidence)`,
    );

    if (contextResult.situationalFactors.length > 0) {
      parts.push(`Context: ${contextResult.situationalFactors.join(', ')}`);
    }

    parts.push(`Recommended: ${recommendedMode}`);

    return parts.join(' | ');
  }

  /**
   * Get alternative mode suggestions
   */
  private async getAlternativeModes(
    intentResult: IntentAnalysisResult,
    contextResult: ContextAnalysisResult,
  ): Promise<string[]> {
    const alternatives: string[] = [];

    // Add modes from same category
    const categoryModes = this.getModesByCategory(intentResult.category);
    alternatives.push(...categoryModes.filter((mode) => mode !== intentResult.intent));

    // Add contextually relevant modes
    if (
      contextResult.situationalFactors.includes('recent_errors') &&
      !alternatives.includes('debugging')
    ) {
      alternatives.push('debugging');
    }

    return alternatives.slice(0, 3); // Limit to top 3 alternatives
  }

  /**
   * Get modes by category
   */
  private getModesByCategory(category: string): string[] {
    const categoryMap: Record<string, string[]> = {
      reasoning: ['thinking', 'optimizing', 'researching'],
      creative: ['brainstorming', 'inventing', 'dreaming'],
      analytical: ['summarizing', 'distilling', 'mapping'],
      validation: ['debugging', 'validating', 'reviewing'],
    };

    return categoryMap[category] || ['thinking'];
  }

  /**
   * Update user patterns based on usage
   */
  private updateUserPatterns(userId: string, result: RecognitionResult): void {
    const patterns = this.userPatterns.get(userId) || {
      preferredModes: [],
      commonPatterns: [],
      responseHistory: [],
    };

    // Update preferred modes
    patterns.preferredModes.unshift(result.recommendedMode);
    patterns.preferredModes = patterns.preferredModes.slice(0, 10); // Keep last 10

    // Update response history
    patterns.responseHistory.unshift({
      mode: result.recommendedMode,
      confidence: result.confidence,
      timestamp: Date.now(),
    });
    patterns.responseHistory = patterns.responseHistory.slice(0, 50); // Keep last 50

    this.userPatterns.set(userId, patterns);
  }

  @EventHandler('session:started')
  async handleSessionStarted(event: ServiceEvent): Promise<void> {
    console.log(`[${this.id}] Session started, preparing recognition service`);
    // Initialize session-specific patterns
  }

  @EventHandler('mode:changed')
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
