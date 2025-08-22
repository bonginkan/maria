/**
 * Personalized AI Behavior System
 *
 * Adapts AI responses and behavior based on individual user preferences,
 * patterns, and learning history.
 */

import { EventEmitter } from 'events';
import { DualMemoryEngine } from '../dual-memory-engine';
import { CrossSessionLearningEngine, PersonalizationProfile } from './cross-session-learning';
import type { UserPreferenceSet, MemoryQuery, MemoryResponse } from '../types/memory-interfaces';

export interface AIBehaviorConfig {
  adaptationSpeed: 'slow' | 'moderate' | 'fast';
  personalizationLevel: 'minimal' | 'moderate' | 'full';
  feedbackSensitivity: number; // 0-1
  contextAwareness: 'low' | 'medium' | 'high';
  proactivityLevel: number; // 0-1
}

export interface PersonalizedResponse {
  content: string;
  style: ResponseStyle;
  confidence: number;
  reasoning?: string;
  suggestions?: string[];
  adaptations?: Adaptation[];
}

export interface ResponseStyle {
  verbosity: 'concise' | 'normal' | 'detailed';
  technicality: 'simple' | 'moderate' | 'technical';
  formality: 'casual' | 'professional' | 'formal';
  examples: boolean;
  explanations: boolean;
  emojis: boolean;
}

export interface Adaptation {
  type: 'style' | 'content' | 'approach' | 'timing';
  reason: string;
  confidence: number;
  applied: boolean;
}

export interface BehaviorMetrics {
  adaptationCount: number;
  userSatisfaction: number;
  responseAccuracy: number;
  personalizationScore: number;
  learningProgress: number;
}

export interface UserContext {
  currentTask?: string;
  recentCommands?: string[];
  activeProject?: string;
  timeOfDay?: string;
  sessionDuration?: number;
  frustrationLevel?: number;
  expertiseLevel?: string;
}

export interface FeedbackData {
  responseId: string;
  rating?: number; // 1-5
  helpful?: boolean;
  accurate?: boolean;
  tooVerbose?: boolean;
  tooTechnical?: boolean;
  suggestion?: string;
}

export class PersonalizedAIBehavior extends EventEmitter {
  private memoryEngine: DualMemoryEngine;
  private learningEngine: CrossSessionLearningEngine;
  private userProfiles: Map<string, PersonalizationProfile> = new Map();
  private responseHistory: Map<string, PersonalizedResponse[]> = new Map();
  private behaviorMetrics: Map<string, BehaviorMetrics> = new Map();
  private adaptationRules: Map<string, AdaptationRule[]> = new Map();

  constructor(
    memoryEngine: DualMemoryEngine,
    learningEngine: CrossSessionLearningEngine,
    private config: AIBehaviorConfig = {
      adaptationSpeed: 'moderate',
      personalizationLevel: 'moderate',
      feedbackSensitivity: 0.7,
      contextAwareness: 'medium',
      proactivityLevel: 0.5,
    },
  ) {
    super();
    this.memoryEngine = memoryEngine;
    this.learningEngine = learningEngine;

    this.initialize();
  }

  private initialize(): void {
    // Listen to learning engine events
    this.learningEngine.on('session:started', (session) => {
      this.initializeUserBehavior(session.userId);
    });

    this.learningEngine.on('interaction:recorded', ({ session, interaction }) => {
      this.adaptFromInteraction(session.userId, interaction);
    });
  }

  /**
   * Generate personalized response
   */
  async generatePersonalizedResponse(
    userId: string,
    input: string,
    context: UserContext,
    baseResponse: string,
  ): Promise<PersonalizedResponse> {
    // Get user profile
    const profile = await this.getUserProfile(userId);

    // Determine response style
    const style = this.determineResponseStyle(profile, context);

    // Apply adaptations
    const adaptations = await this.determineAdaptations(userId, input, context, profile);

    // Transform response
    const personalizedContent = await this.transformResponse(
      baseResponse,
      style,
      adaptations,
      profile,
    );

    // Generate suggestions
    const suggestions = await this.generateProactiveSuggestions(userId, input, context, profile);

    const response: PersonalizedResponse = {
      content: personalizedContent,
      style,
      confidence: this.calculateConfidence(adaptations),
      reasoning: this.explainAdaptations(adaptations),
      suggestions,
      adaptations,
    };

    // Store response
    this.storeResponse(userId, response);

    // Update metrics
    this.updateMetrics(userId, response);

    this.emit('response:generated', { userId, response });

    return response;
  }

  /**
   * Determine response style based on user profile and context
   */
  private determineResponseStyle(
    profile: PersonalizationProfile,
    context: UserContext,
  ): ResponseStyle {
    const style: ResponseStyle = {
      verbosity: 'normal',
      technicality: 'moderate',
      formality: 'professional',
      examples: true,
      explanations: true,
      emojis: false,
    };

    // Adjust based on preferences
    if (profile.preferences.outputFormat === 'concise') {
      style.verbosity = 'concise';
      style.explanations = false;
    } else if (profile.preferences.outputFormat === 'detailed') {
      style.verbosity = 'detailed';
      style.explanations = true;
    }

    // Adjust based on expertise
    const expertiseLevel = this.calculateExpertiseLevel(profile);
    if (expertiseLevel > 0.7) {
      style.technicality = 'technical';
      style.examples = false;
    } else if (expertiseLevel < 0.3) {
      style.technicality = 'simple';
      style.examples = true;
    }

    // Adjust based on context
    if (context.frustrationLevel && context.frustrationLevel > 0.7) {
      style.verbosity = 'concise';
      style.explanations = false;
    }

    if (
      context.timeOfDay === 'late' ||
      (context.sessionDuration && context.sessionDuration > 3600000)
    ) {
      style.verbosity = 'concise';
    }

    // Check for emoji preference
    if (profile.preferences.preferredModels?.includes('friendly')) {
      style.emojis = true;
    }

    return style;
  }

  /**
   * Determine adaptations to apply
   */
  private async determineAdaptations(
    userId: string,
    input: string,
    context: UserContext,
    profile: PersonalizationProfile,
  ): Promise<Adaptation[]> {
    const adaptations: Adaptation[] = [];

    // Style adaptations based on patterns
    const styleAdaptation = this.determineStyleAdaptation(profile, context);
    if (styleAdaptation) {
      adaptations.push(styleAdaptation);
    }

    // Content adaptations based on expertise
    const contentAdaptation = this.determineContentAdaptation(profile, input);
    if (contentAdaptation) {
      adaptations.push(contentAdaptation);
    }

    // Approach adaptations based on learning
    const approachAdaptation = await this.determineApproachAdaptation(userId, input, context);
    if (approachAdaptation) {
      adaptations.push(approachAdaptation);
    }

    // Timing adaptations based on context
    const timingAdaptation = this.determineTimingAdaptation(context);
    if (timingAdaptation) {
      adaptations.push(timingAdaptation);
    }

    // Apply adaptation rules
    const rules = this.adaptationRules.get(userId) || [];
    for (const rule of rules) {
      if (rule.condition(input, context, profile)) {
        adaptations.push({
          type: rule.type,
          reason: rule.reason,
          confidence: rule.confidence,
          applied: true,
        });
      }
    }

    return adaptations;
  }

  /**
   * Transform response based on style and adaptations
   */
  private async transformResponse(
    baseResponse: string,
    style: ResponseStyle,
    adaptations: Adaptation[],
    profile: PersonalizationProfile,
  ): Promise<string> {
    let transformed = baseResponse;

    // Apply verbosity transformation
    if (style.verbosity === 'concise') {
      transformed = this.makeConcise(transformed);
    } else if (style.verbosity === 'detailed') {
      transformed = await this.makeDetailed(transformed, profile);
    }

    // Apply technicality transformation
    if (style.technicality === 'simple') {
      transformed = this.simplifyTechnical(transformed);
    } else if (style.technicality === 'technical') {
      transformed = this.makeTechnical(transformed);
    }

    // Apply formality transformation
    if (style.formality === 'casual') {
      transformed = this.makeCasual(transformed);
    } else if (style.formality === 'formal') {
      transformed = this.makeFormal(transformed);
    }

    // Add examples if needed
    if (style.examples && !transformed.includes('example')) {
      transformed = await this.addExamples(transformed, profile);
    }

    // Add explanations if needed
    if (style.explanations && adaptations.some((a) => a.type === 'content')) {
      transformed = this.addExplanations(transformed);
    }

    // Add emojis if preferred
    if (style.emojis) {
      transformed = this.addEmojis(transformed);
    }

    return transformed;
  }

  /**
   * Generate proactive suggestions
   */
  private async generateProactiveSuggestions(
    userId: string,
    input: string,
    context: UserContext,
    profile: PersonalizationProfile,
  ): Promise<string[]> {
    const suggestions: string[] = [];

    if (this.config.proactivityLevel === 0) {
      return suggestions;
    }

    // Get personalized suggestions from learning engine
    const learningSuggestions = await this.learningEngine.getPersonalizedSuggestions(
      userId,
      context,
    );
    suggestions.push(...learningSuggestions.slice(0, 2));

    // Pattern-based suggestions
    const patternSuggestions = this.getPatternBasedSuggestions(profile, input);
    suggestions.push(...patternSuggestions);

    // Context-based suggestions
    if (context.currentTask) {
      const taskSuggestions = await this.getTaskSuggestions(context.currentTask);
      suggestions.push(...taskSuggestions);
    }

    // Expertise-based suggestions
    const expertiseSuggestions = this.getExpertiseSuggestions(profile);
    suggestions.push(...expertiseSuggestions);

    // Limit suggestions based on proactivity level
    const maxSuggestions = Math.ceil(this.config.proactivityLevel * 5);
    return suggestions.slice(0, maxSuggestions);
  }

  /**
   * Process user feedback
   */
  async processFeedback(userId: string, feedback: FeedbackData): Promise<void> {
    // Update user profile based on feedback
    const profile = await this.getUserProfile(userId);

    // Adjust preferences
    if (feedback.tooVerbose) {
      profile.preferences.outputFormat = 'concise';
    } else if (feedback.tooVerbose === false && feedback.rating && feedback.rating < 3) {
      profile.preferences.outputFormat = 'detailed';
    }

    // Create adaptation rules based on feedback
    if (feedback.suggestion) {
      this.createAdaptationRule(userId, feedback);
    }

    // Update metrics
    const metrics = this.behaviorMetrics.get(userId) || this.createDefaultMetrics();

    if (feedback.rating) {
      const alpha = this.config.feedbackSensitivity;
      metrics.userSatisfaction =
        alpha * (feedback.rating / 5) + (1 - alpha) * metrics.userSatisfaction;
    }

    if (feedback.accurate !== undefined) {
      metrics.responseAccuracy = 0.9 * metrics.responseAccuracy + 0.1 * (feedback.accurate ? 1 : 0);
    }

    this.behaviorMetrics.set(userId, metrics);

    // Store feedback in memory
    await this.storeFeedback(userId, feedback);

    this.emit('feedback:processed', { userId, feedback });
  }

  /**
   * Adapt from interaction
   */
  private async adaptFromInteraction(userId: string, interaction: unknown): Promise<void> {
    const adaptationSpeed = this.getAdaptationSpeed();

    // Quick adaptation for corrections
    if (interaction.type === 'correction') {
      await this.quickAdapt(userId, interaction);
    }

    // Gradual adaptation for patterns
    const profile = await this.getUserProfile(userId);
    const patterns = profile.patterns.filter((p) => p.confidence > 0.6);

    for (const pattern of patterns) {
      if (this.matchesPattern(interaction, pattern)) {
        // Strengthen pattern
        pattern.confidence = Math.min(1, pattern.confidence + adaptationSpeed);
        pattern.frequency++;
      }
    }

    // Update metrics
    const metrics = this.behaviorMetrics.get(userId) || this.createDefaultMetrics();
    metrics.adaptationCount++;
    metrics.learningProgress = this.calculateLearningProgress(userId);
    this.behaviorMetrics.set(userId, metrics);
  }

  /**
   * Helper functions for response transformation
   */
  private makeConcise(text: string): string {
    // Remove redundant phrases
    const concise = text
      .replace(/In other words,?/gi, '')
      .replace(/To put it simply,?/gi, '')
      .replace(/What this means is/gi, '')
      .replace(/It's worth noting that/gi, '')
      .replace(/\. Additionally,/gi, '.')
      .replace(/\. Furthermore,/gi, '.');

    // Shorten sentences
    const sentences = concise.split('. ');
    const shortened = sentences.map((s) => {
      if (s.length > 100) {
        // Take first clause
        return s.split(',')[0] + '.';
      }
      return s;
    });

    return shortened.join('. ');
  }

  private async makeDetailed(text: string, profile: PersonalizationProfile): Promise<string> {
    // Add context and explanations
    let detailed = text;

    // Add background information
    detailed = `Context: Based on your ${this.getExpertiseDescription(profile)} expertise.\n\n${detailed}`;

    // Add step-by-step breakdown if applicable
    if (text.includes('Step') || text.includes('First')) {
      detailed += '\n\nDetailed breakdown available if needed.';
    }

    return detailed;
  }

  private simplifyTechnical(text: string): string {
    const replacements: Record<string, string> = {
      asynchronous: 'non-blocking',
      polymorphism: 'multiple forms',
      abstraction: 'hiding complexity',
      encapsulation: 'data hiding',
      instantiate: 'create',
      concatenate: 'join',
      iterate: 'loop through',
      parameter: 'input',
      repository: 'storage',
      dependency: 'requirement',
    };

    let simplified = text;
    for (const [technical, simple] of Object.entries(replacements)) {
      const regex = new RegExp(`\\b${technical}\\b`, 'gi');
      simplified = simplified.replace(regex, simple);
    }

    return simplified;
  }

  private makeTechnical(text: string): string {
    // Opposite of simplify - use more technical terms
    const replacements: Record<string, string> = {
      create: 'instantiate',
      join: 'concatenate',
      loop: 'iterate',
      input: 'parameter',
      storage: 'repository',
      requirement: 'dependency',
      function: 'method',
      variable: 'identifier',
    };

    let technical = text;
    for (const [simple, tech] of Object.entries(replacements)) {
      const regex = new RegExp(`\\b${simple}\\b`, 'gi');
      technical = technical.replace(regex, tech);
    }

    return technical;
  }

  private makeCasual(text: string): string {
    return text
      .replace(/Therefore,?/gi, 'So')
      .replace(/However,?/gi, 'But')
      .replace(/Furthermore,?/gi, 'Also')
      .replace(/It is/g, "It's")
      .replace(/You are/g, "You're")
      .replace(/We will/g, "We'll");
  }

  private makeFormal(text: string): string {
    return text
      .replace(/So,?/g, 'Therefore,')
      .replace(/But,?/g, 'However,')
      .replace(/Also,?/g, 'Furthermore,')
      .replace(/It's/g, 'It is')
      .replace(/You're/g, 'You are')
      .replace(/We'll/g, 'We will');
  }

  private async addExamples(text: string, profile: PersonalizationProfile): Promise<string> {
    // Query memory for relevant examples
    const examples = await this.memoryEngine.query({
      type: 'pattern',
      query: 'code examples',
      context: { language: Array.from(profile.expertise.languages.keys())[0] },
      urgency: 'low',
      limit: 2,
    });

    if (examples.data && examples.data.length > 0) {
      return `${text}\n\nExample:\n${examples.data[0].content}`;
    }

    return text;
  }

  private addExplanations(text: string): string {
    // Add explanatory phrases
    const sentences = text.split('. ');
    const explained = sentences.map((s, i) => {
      if (i > 0 && i % 3 === 0 && !s.includes('because') && !s.includes('since')) {
        return `${s} (this helps ensure correctness)`;
      }
      return s;
    });

    return explained.join('. ');
  }

  private addEmojis(text: string): string {
    const emojiMap: Record<string, string> = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️',
      tip: '💡',
      good: '👍',
      great: '🎉',
      fixed: '🔧',
      complete: '✨',
    };

    let withEmojis = text;
    for (const [word, emoji] of Object.entries(emojiMap)) {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      withEmojis = withEmojis.replace(regex, `${word} ${emoji}`);
    }

    return withEmojis;
  }

  /**
   * Helper functions
   */
  private async getUserProfile(userId: string): Promise<PersonalizationProfile> {
    let profile = this.userProfiles.get(userId);

    if (!profile) {
      // Create default profile
      profile = {
        userId,
        preferences: {
          codeStyle: 'functional',
          outputFormat: 'normal',
          learningEnabled: true,
        },
        patterns: [],
        expertise: {
          languages: new Map(),
          frameworks: new Map(),
          domains: new Map(),
          skills: new Map(),
        },
        optimizations: [],
      };
      this.userProfiles.set(userId, profile);
    }

    return profile;
  }

  private initializeUserBehavior(userId: string): void {
    if (!this.behaviorMetrics.has(userId)) {
      this.behaviorMetrics.set(userId, this.createDefaultMetrics());
    }

    if (!this.responseHistory.has(userId)) {
      this.responseHistory.set(userId, []);
    }

    if (!this.adaptationRules.has(userId)) {
      this.adaptationRules.set(userId, []);
    }
  }

  private createDefaultMetrics(): BehaviorMetrics {
    return {
      adaptationCount: 0,
      userSatisfaction: 0.7,
      responseAccuracy: 0.8,
      personalizationScore: 0.5,
      learningProgress: 0,
    };
  }

  private calculateExpertiseLevel(profile: PersonalizationProfile): number {
    const languageExpertise = Array.from(profile.expertise.languages.values());
    const frameworkExpertise = Array.from(profile.expertise.frameworks.values());

    const allExpertise = [...languageExpertise, ...frameworkExpertise];

    if (allExpertise.length === 0) return 0.5;

    return allExpertise.reduce((a, b) => a + b, 0) / allExpertise.length;
  }

  private calculateConfidence(adaptations: Adaptation[]): number {
    if (adaptations.length === 0) return 0.8;

    const avgConfidence =
      adaptations.reduce((sum, a) => sum + a.confidence, 0) / adaptations.length;
    return Math.min(1, avgConfidence);
  }

  private explainAdaptations(adaptations: Adaptation[]): string {
    if (adaptations.length === 0) return '';

    const explanations = adaptations
      .filter((a) => a.applied)
      .map((a) => `${a.type}: ${a.reason}`)
      .join('; ');

    return `Adaptations applied: ${explanations}`;
  }

  private determineStyleAdaptation(
    profile: PersonalizationProfile,
    context: UserContext,
  ): Adaptation | null {
    // Check if style needs adaptation
    if (context.frustrationLevel && context.frustrationLevel > 0.5) {
      return {
        type: 'style',
        reason: 'User seems frustrated, using concise style',
        confidence: 0.8,
        applied: true,
      };
    }

    return null;
  }

  private determineContentAdaptation(
    profile: PersonalizationProfile,
    input: string,
  ): Adaptation | null {
    const expertise = this.calculateExpertiseLevel(profile);

    if (expertise < 0.3 && this.isComplexQuery(input)) {
      return {
        type: 'content',
        reason: 'Simplifying content for beginner level',
        confidence: 0.7,
        applied: true,
      };
    }

    if (expertise > 0.7 && this.isSimpleQuery(input)) {
      return {
        type: 'content',
        reason: 'Providing advanced content for expert level',
        confidence: 0.8,
        applied: true,
      };
    }

    return null;
  }

  private async determineApproachAdaptation(
    userId: string,
    input: string,
    context: UserContext,
  ): Promise<Adaptation | null> {
    // Check if approach needs changing based on patterns
    const metrics = this.behaviorMetrics.get(userId);

    if (metrics && metrics.userSatisfaction < 0.5) {
      return {
        type: 'approach',
        reason: 'Adjusting approach based on user satisfaction',
        confidence: 0.6,
        applied: true,
      };
    }

    return null;
  }

  private determineTimingAdaptation(context: UserContext): Adaptation | null {
    if (context.sessionDuration && context.sessionDuration > 7200000) {
      // 2 hours
      return {
        type: 'timing',
        reason: 'Long session detected, providing quicker responses',
        confidence: 0.9,
        applied: true,
      };
    }

    return null;
  }

  private getAdaptationSpeed(): number {
    switch (this.config.adaptationSpeed) {
      case 'slow':
        return 0.05;
      case 'moderate':
        return 0.1;
      case 'fast':
        return 0.2;
      default:
        return 0.1;
    }
  }

  private isComplexQuery(input: string): boolean {
    const complexKeywords = [
      'implement',
      'architecture',
      'optimize',
      'algorithm',
      'design pattern',
    ];
    return complexKeywords.some((keyword) => input.toLowerCase().includes(keyword));
  }

  private isSimpleQuery(input: string): boolean {
    const simpleKeywords = ['what is', 'how to', 'define', 'explain', 'show me'];
    return simpleKeywords.some((keyword) => input.toLowerCase().includes(keyword));
  }

  private getExpertiseDescription(profile: PersonalizationProfile): string {
    const expertise = this.calculateExpertiseLevel(profile);

    if (expertise < 0.3) return 'beginner';
    if (expertise < 0.5) return 'intermediate';
    if (expertise < 0.7) return 'advanced';
    return 'expert';
  }

  private storeResponse(userId: string, response: PersonalizedResponse): void {
    const history = this.responseHistory.get(userId) || [];
    history.push(response);

    // Keep only recent responses
    if (history.length > 100) {
      history.shift();
    }

    this.responseHistory.set(userId, history);
  }

  private updateMetrics(userId: string, response: PersonalizedResponse): void {
    const metrics = this.behaviorMetrics.get(userId) || this.createDefaultMetrics();

    metrics.personalizationScore = (response.adaptations?.length || 0) / 5; // Normalize to 0-1

    this.behaviorMetrics.set(userId, metrics);
  }

  private createAdaptationRule(userId: string, feedback: FeedbackData): void {
    const rules = this.adaptationRules.get(userId) || [];

    const rule: AdaptationRule = {
      id: `rule_${Date.now()}`,
      type: feedback.tooVerbose ? 'style' : 'content',
      condition: (input, context, profile) => {
        // Simple condition based on feedback
        return true; // In production, implement proper conditions
      },
      action: feedback.suggestion || 'adjust_response',
      reason: `Based on user feedback: ${feedback.suggestion}`,
      confidence: 0.7,
      priority: 1,
    };

    rules.push(rule);
    this.adaptationRules.set(userId, rules);
  }

  private async storeFeedback(userId: string, feedback: FeedbackData): Promise<void> {
    const embedding = await this.generateEmbedding(JSON.stringify(feedback));

    await this.memoryEngine
      .getSystem1()
      .addKnowledgeNode('feedback', feedback.responseId, JSON.stringify(feedback), embedding, {
        userId,
        timestamp: new Date().toISOString(),
        rating: feedback.rating,
      });
  }

  private matchesPattern(interaction: unknown, pattern: unknown): boolean {
    // Simple pattern matching - in production, use more sophisticated matching
    return (
      interaction.input.includes(pattern.pattern) ||
      pattern.examples.some((ex: string) => interaction.input.includes(ex))
    );
  }

  private async quickAdapt(userId: string, interaction: unknown): Promise<void> {
    const profile = await this.getUserProfile(userId);

    // Immediate adaptation for corrections
    if (interaction.metadata?.correction) {
      // Create high-priority adaptation rule
      const rule: AdaptationRule = {
        id: `correction_${Date.now()}`,
        type: 'content',
        condition: (input) => input.includes(interaction.metadata.original),
        action: 'apply_correction',
        reason: `User corrected: ${interaction.metadata.reason}`,
        confidence: 0.9,
        priority: 10,
      };

      const rules = this.adaptationRules.get(userId) || [];
      rules.unshift(rule); // Add to beginning for high priority
      this.adaptationRules.set(userId, rules);
    }
  }

  private calculateLearningProgress(userId: string): number {
    const metrics = this.learningEngine.getLearningMetrics(userId);
    const behaviorMetrics = this.behaviorMetrics.get(userId);

    if (!behaviorMetrics) return 0;

    // Combine various factors
    const factors = [
      metrics.successRate,
      metrics.improvementRate,
      behaviorMetrics.userSatisfaction,
      behaviorMetrics.responseAccuracy,
      metrics.preferenceStability,
    ];

    return factors.reduce((a, b) => a + b, 0) / factors.length;
  }

  private getPatternBasedSuggestions(profile: PersonalizationProfile, input: string): string[] {
    const suggestions: string[] = [];

    // Find relevant patterns
    const relevantPatterns = profile.patterns
      .filter((p) => p.confidence > 0.7)
      .filter((p) => this.isRelevantPattern(p, input))
      .slice(0, 2);

    for (const pattern of relevantPatterns) {
      suggestions.push(`Based on your pattern: ${pattern.pattern}`);
    }

    return suggestions;
  }

  private isRelevantPattern(pattern: unknown, input: string): boolean {
    // Check if pattern is relevant to current input
    return (
      pattern.context.some((ctx: string) => input.includes(ctx)) ||
      pattern.examples.some((ex: string) => this.similarityScore(ex, input) > 0.5)
    );
  }

  private similarityScore(str1: string, str2: string): number {
    // Simple similarity score - in production, use proper NLP
    const words1 = new Set(str1.toLowerCase().split(' '));
    const words2 = new Set(str2.toLowerCase().split(' '));

    const intersection = new Set([...words1].filter((x) => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  private async getTaskSuggestions(task: string): Promise<string[]> {
    // Query memory for task-related suggestions
    const response = await this.memoryEngine.query({
      type: 'knowledge',
      query: `suggestions for ${task}`,
      urgency: 'low',
      limit: 2,
    });

    if (response.data && Array.isArray(response.data)) {
      return response.data.map((d: unknown) => d.suggestion || d.content).filter(Boolean);
    }

    return [];
  }

  private getExpertiseSuggestions(profile: PersonalizationProfile): string[] {
    const suggestions: string[] = [];

    // Get top expertise areas
    const topLanguage = Array.from(profile.expertise.languages.entries()).sort(
      (a, b) => b[1] - a[1],
    )[0];

    if (topLanguage && topLanguage[1] > 0.7) {
      suggestions.push(`Advanced ${topLanguage[0]} techniques available`);
    }

    const topFramework = Array.from(profile.expertise.frameworks.entries()).sort(
      (a, b) => b[1] - a[1],
    )[0];

    if (topFramework && topFramework[1] > 0.7) {
      suggestions.push(`${topFramework[0]} best practices applied`);
    }

    return suggestions;
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    // Simplified embedding - in production, use proper embedding model
    const hash = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return Array(100)
      .fill(0)
      .map((_, i) => Math.sin(hash + i) * 0.5 + 0.5);
  }

  /**
   * Get behavior metrics for a user
   */
  getBehaviorMetrics(userId: string): BehaviorMetrics | undefined {
    return this.behaviorMetrics.get(userId);
  }

  /**
   * Export user behavior data
   */
  exportUserBehavior(userId: string): unknown {
    return {
      profile: this.userProfiles.get(userId),
      metrics: this.behaviorMetrics.get(userId),
      responseHistory: this.responseHistory.get(userId),
      adaptationRules: this.adaptationRules.get(userId),
    };
  }
}

interface AdaptationRule {
  id: string;
  type: 'style' | 'content' | 'approach' | 'timing';
  condition: (input: string, context: UserContext, profile: PersonalizationProfile) => boolean;
  action: string;
  reason: string;
  confidence: number;
  priority: number;
}
