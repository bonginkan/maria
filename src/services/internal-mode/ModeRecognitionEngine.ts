/**
 * Mode Recognition Engine - Real-time Mode Detection
 *
 * Advanced recognition engine that analyzes user input, context, and situation
 * to determine the optimal internal mode. Integrates with Intelligent Router Service.
 */

import { EventEmitter } from 'events';
import {
  ModeDefinition,
  ModeContext,
  ModeRecognitionResult,
  ModeConfig,
  ModeTriggerType,
  DEFAULT_TRIGGER_WEIGHTS,
} from './types';
import { ModeDefinitionRegistry } from './ModeDefinitionRegistry';
import { getIntelligentRouter } from '../intelligent-router/IntelligentRouterService';
import {
  NaturalLanguageProcessor,
  ProcessedInput,
} from '../intelligent-router/NaturalLanguageProcessor';

interface ModeScore {
  mode: ModeDefinition;
  totalScore: number;
  scores: {
    intent: number;
    context: number;
    situation: number;
    pattern: number;
  };
  triggeredBy: ModeTriggerType[];
  confidence: number;
  reasoning: string[];
}

export class ModeRecognitionEngine extends EventEmitter {
  private modeRegistry: ModeDefinitionRegistry;
  private config: ModeConfig;
  private nlpProcessor: NaturalLanguageProcessor;
  private initialized: boolean = false;

  // Recognition cache to improve performance
  private recognitionCache: Map<string, { result: ModeRecognitionResult; timestamp: number }> =
    new Map();
  private cacheTimeout: number = 30000; // 30 seconds

  constructor(modeRegistry: ModeDefinitionRegistry, config: ModeConfig) {
    super();
    this.modeRegistry = modeRegistry;
    this.config = config;
    this.nlpProcessor = new NaturalLanguageProcessor();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.nlpProcessor.initialize();
    this.initialized = true;
  }

  /**
   * Main recognition method - analyzes context and returns best mode match
   */
  async recognizeMode(context: ModeContext): Promise<ModeRecognitionResult | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    const startTime = Date.now();

    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(context);
      const cached = this.recognitionCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.result;
      }

      // Process natural language input
      const processedInput = await this.nlpProcessor.process(context.userInput, context.language);

      // Score all modes
      const modeScores = await this.scoreAllModes(context, processedInput);

      // Find the best match
      const bestMatch = this.findBestMatch(modeScores);

      if (!bestMatch) {
        return null;
      }

      // Create recognition result
      const result: ModeRecognitionResult = {
        mode: bestMatch.mode,
        confidence: bestMatch.confidence,
        reasoning: this.generateReasoning(bestMatch, context),
        alternatives: modeScores
          .filter((score) => score.mode.id !== bestMatch.mode.id)
          .sort((a, b) => b.totalScore - a.totalScore)
          .slice(0, 3)
          .map((score) => ({
            mode: score.mode,
            confidence: score.confidence,
          })),
        triggers: bestMatch.triggeredBy.map((type) => ({
          type,
          score: bestMatch.scores[type] || 0,
          details: this.getTriggerDetails(type, bestMatch, context),
        })),
      };

      // Cache the result
      this.recognitionCache.set(cacheKey, {
        result,
        timestamp: Date.now(),
      });

      // Clean old cache entries
      this.cleanCache();

      // Emit completion event
      this.emit('recognition:completed', result);

      const processingTime = Date.now() - startTime;
      if (processingTime > this.config.recognitionTimeout) {
        console.warn(
          `Mode recognition took ${processingTime}ms (target: ${this.config.recognitionTimeout}ms)`,
        );
      }

      return result;
    } catch (error) {
      this.emit('error', error);
      console.error('Mode recognition error:', error);
      return null;
    }
  }

  /**
   * Update engine based on user feedback
   */
  async updateFromFeedback(
    userInput: string,
    correctModeId: string,
    wasCorrect: boolean,
  ): Promise<void> {
    // In a full implementation, this would update ML models or weights
    // For now, we'll just log the feedback for future improvements
    console.log(
      `Mode feedback: Input="${userInput}", Correct="${correctModeId}", Success=${wasCorrect}`,
    );
  }

  /**
   * Update configuration
   */
  updateConfig(config: ModeConfig): void {
    this.config = config;
  }

  // Private methods

  private async scoreAllModes(
    context: ModeContext,
    processedInput: ProcessedInput,
  ): Promise<ModeScore[]> {
    const allModes = this.modeRegistry.getAllModes();
    const scores: ModeScore[] = [];

    for (const mode of allModes) {
      const score = await this.scoreMode(mode, context, processedInput);
      if (score.totalScore > 0) {
        scores.push(score);
      }
    }

    return scores.sort((a, b) => b.totalScore - a.totalScore);
  }

  private async scoreMode(
    mode: ModeDefinition,
    context: ModeContext,
    processedInput: ProcessedInput,
  ): Promise<ModeScore> {
    const scores = {
      intent: 0,
      context: 0,
      situation: 0,
      pattern: 0,
    };

    const triggeredBy: ModeTriggerType[] = [];
    const reasoning: string[] = [];

    // Evaluate each trigger
    for (const trigger of mode.triggers) {
      let triggerScore = 0;

      switch (trigger.type) {
        case 'intent':
          triggerScore = await this.scoreIntentTrigger(trigger, processedInput, context);
          break;
        case 'context':
          triggerScore = await this.scoreContextTrigger(trigger, context);
          break;
        case 'situation':
          triggerScore = await this.scoreSituationTrigger(trigger, context);
          break;
        case 'pattern':
          triggerScore = await this.scorePatternTrigger(trigger, context);
          break;
      }

      if (triggerScore > 0) {
        scores[trigger.type] = Math.max(scores[trigger.type], triggerScore * trigger.weight);
        if (triggerScore >= trigger.confidence) {
          triggeredBy.push(trigger.type);
          reasoning.push(`${trigger.type} trigger activated (score: ${triggerScore.toFixed(2)})`);
        }
      }
    }

    // Calculate total weighted score
    const totalScore =
      scores.intent * DEFAULT_TRIGGER_WEIGHTS.intent +
      scores.context * DEFAULT_TRIGGER_WEIGHTS.context +
      scores.situation * DEFAULT_TRIGGER_WEIGHTS.situation +
      scores.pattern * DEFAULT_TRIGGER_WEIGHTS.pattern;

    // Convert to confidence (0-1)
    const confidence = Math.min(totalScore, 1.0);

    return {
      mode,
      totalScore,
      scores,
      triggeredBy,
      confidence,
      reasoning,
    };
  }

  private async scoreIntentTrigger(
    trigger: ModeTrigger,
    processedInput: ProcessedInput,
    context: ModeContext,
  ): Promise<number> {
    let score = 0;

    for (const condition of trigger.conditions) {
      let conditionScore = 0;

      switch (condition.field) {
        case 'keywords':
          conditionScore = this.scoreKeywordCondition(condition, processedInput);
          break;
        case 'entities':
          conditionScore = this.scoreEntityCondition(condition, processedInput);
          break;
        case 'intent':
          conditionScore = await this.scoreIntentCondition(condition, context);
          break;
      }

      score += conditionScore * condition.weight;
    }

    return Math.min(score, 1.0);
  }

  private async scoreContextTrigger(trigger: ModeTrigger, context: ModeContext): Promise<number> {
    let score = 0;

    for (const condition of trigger.conditions) {
      let conditionScore = 0;

      switch (condition.field) {
        case 'currentMode':
          conditionScore = this.scoreCurrentModeCondition(condition, context);
          break;
        case 'previousModes':
          conditionScore = this.scorePreviousModeCondition(condition, context);
          break;
        case 'commandHistory':
          conditionScore = this.scoreCommandHistoryCondition(condition, context);
          break;
        case 'defaultMode':
          conditionScore = condition.value === 'true' ? 0.5 : 0; // Low score for default
          break;
      }

      score += conditionScore * condition.weight;
    }

    return Math.min(score, 1.0);
  }

  private async scoreSituationTrigger(trigger: ModeTrigger, context: ModeContext): Promise<number> {
    let score = 0;

    for (const condition of trigger.conditions) {
      let conditionScore = 0;

      switch (condition.field) {
        case 'errorState':
          conditionScore = this.scoreErrorStateCondition(condition, context);
          break;
        case 'projectContext':
          conditionScore = this.scoreProjectContextCondition(condition, context);
          break;
        case 'timeOfDay':
          conditionScore = this.scoreTimeCondition(condition, context);
          break;
      }

      score += conditionScore * condition.weight;
    }

    return Math.min(score, 1.0);
  }

  private async scorePatternTrigger(trigger: ModeTrigger, context: ModeContext): Promise<number> {
    // Pattern scoring based on user usage history
    let score = 0;

    for (const pattern of context.userPatterns) {
      if (pattern.sequence.length > 0) {
        const _lastMode = pattern.sequence[pattern.sequence.length - 1];
        const recentUsage = (Date.now() - pattern.lastUsed.getTime()) / (1000 * 60 * 60); // hours

        // Score based on frequency and recency
        const frequencyScore = Math.min(pattern.frequency / 10, 0.5);
        const recencyScore = Math.max(0, 0.5 - recentUsage / 168); // Week falloff
        const successScore = pattern.success * 0.5;

        score = Math.max(score, frequencyScore + recencyScore + successScore);
      }
    }

    return Math.min(score, 1.0);
  }

  private scoreKeywordCondition(
    condition: TriggerCondition,
    processedInput: ProcessedInput,
  ): number {
    const keywords = Array.isArray(condition.value) ? condition.value : [condition.value];
    let matches = 0;

    for (const keyword of keywords) {
      if (
        processedInput.keywords.includes(keyword.toLowerCase()) ||
        processedInput.tokens.includes(keyword.toLowerCase())
      ) {
        matches++;
      }
    }

    return keywords.length > 0 ? matches / keywords.length : 0;
  }

  private scoreEntityCondition(
    condition: TriggerCondition,
    processedInput: ProcessedInput,
  ): number {
    const entities = Array.isArray(condition.value) ? condition.value : [condition.value];
    let matches = 0;

    for (const entityType of entities) {
      if (processedInput.entities.some((e) => e.type === entityType)) {
        matches++;
      }
    }

    return entities.length > 0 ? matches / entities.length : 0;
  }

  private async scoreIntentCondition(
    condition: TriggerCondition,
    context: ModeContext,
  ): Promise<number> {
    // Use Intelligent Router to get intent
    try {
      const router = getIntelligentRouter();
      const intent = await router.route(context.userInput);

      if (intent && intent.command) {
        return condition.value === intent.command ? 1.0 : 0;
      }
    } catch (error) {
      // Fallback to simple matching
    }

    return 0;
  }

  private scoreCurrentModeCondition(condition: TriggerCondition, context: ModeContext): number {
    if (!context.currentMode) return 0;
    return condition.value === context.currentMode.id ? 1.0 : 0;
  }

  private scorePreviousModeCondition(condition: TriggerCondition, context: ModeContext): number {
    const targetModes = Array.isArray(condition.value) ? condition.value : [condition.value];
    const recentModeIds = context.previousModes.slice(0, 3).map((m) => m.mode.id);

    return targetModes.some((mode: string) => recentModeIds.includes(mode)) ? 0.8 : 0;
  }

  private scoreCommandHistoryCondition(condition: TriggerCondition, context: ModeContext): number {
    const targetCommands = Array.isArray(condition.value) ? condition.value : [condition.value];
    const recentCommands = context.commandHistory.slice(-5);

    return targetCommands.some((cmd: string) => recentCommands.includes(cmd)) ? 0.7 : 0;
  }

  private scoreErrorStateCondition(condition: TriggerCondition, context: ModeContext): number {
    const hasError = !!context.errorState;
    return condition.value === 'true' ? (hasError ? 1.0 : 0) : hasError ? 0 : 1.0;
  }

  private scoreProjectContextCondition(condition: TriggerCondition, context: ModeContext): number {
    if (!context.projectContext) return 0;

    switch (condition.field) {
      case 'type':
        return condition.value === context.projectContext.type ? 0.8 : 0;
      case 'hasErrors':
        return condition.value === context.projectContext.hasErrors.toString() ? 0.9 : 0;
      case 'hasTests':
        return condition.value === context.projectContext.hasTests.toString() ? 0.6 : 0;
      default:
        return 0;
    }
  }

  private scoreTimeCondition(condition: TriggerCondition, context: ModeContext): number {
    const hour = context.timestamp.getHours();
    const timeRange = condition.value; // e.g., "morning", "afternoon", "evening"

    switch (timeRange) {
      case 'morning':
        return hour >= 6 && hour < 12 ? 0.3 : 0;
      case 'afternoon':
        return hour >= 12 && hour < 18 ? 0.3 : 0;
      case 'evening':
        return hour >= 18 || hour < 6 ? 0.3 : 0;
      default:
        return 0;
    }
  }

  private findBestMatch(modeScores: ModeScore[]): ModeScore | null {
    if (modeScores.length === 0) return null;

    const bestScore = modeScores[0];

    // Only return if confidence exceeds threshold
    if (bestScore.confidence >= this.config.confidenceThreshold) {
      return bestScore;
    }

    return null;
  }

  private generateReasoning(modeScore: ModeScore, _context: ModeContext): string {
    const reasons: string[] = [];

    if (modeScore.scores.intent > 0.5) {
      reasons.push(`Strong intent match (${(modeScore.scores.intent * 100).toFixed(0)}%)`);
    }

    if (modeScore.scores.context > 0.5) {
      reasons.push(`Context alignment (${(modeScore.scores.context * 100).toFixed(0)}%)`);
    }

    if (modeScore.scores.situation > 0.5) {
      reasons.push(`Situational factors (${(modeScore.scores.situation * 100).toFixed(0)}%)`);
    }

    if (modeScore.scores.pattern > 0.3) {
      reasons.push(`User pattern match (${(modeScore.scores.pattern * 100).toFixed(0)}%)`);
    }

    return reasons.length > 0 ? reasons.join('; ') : 'General context analysis';
  }

  private getTriggerDetails(
    type: ModeTriggerType,
    modeScore: ModeScore,
    context: ModeContext,
  ): string {
    switch (type) {
      case 'intent':
        return `User input analysis: "${context.userInput.slice(0, 50)}..."`;
      case 'context':
        return `Current context: ${context.currentMode?.name || 'none'} → ${modeScore.mode.name}`;
      case 'situation':
        return `Project state: ${context.projectContext?.type || 'unknown'}, errors: ${!!context.errorState}`;
      case 'pattern':
        return `Usage patterns: ${context.userPatterns.length} patterns analyzed`;
      default:
        return 'General analysis';
    }
  }

  private generateCacheKey(context: ModeContext): string {
    const keyParts = [
      context.userInput.toLowerCase().trim(),
      context.language,
      context.currentMode?.id || 'none',
      context.errorState ? 'error' : 'normal',
    ];

    return keyParts.join('|');
  }

  private cleanCache(): void {
    const now = Date.now();
    for (const [key, cached] of this.recognitionCache.entries()) {
      if (now - cached.timestamp > this.cacheTimeout) {
        this.recognitionCache.delete(key);
      }
    }
  }
}
