/**
 * Cross-Session Learning Engine
 * 
 * Enables continuous learning across multiple sessions, preserving and building
 * upon knowledge gained from previous interactions.
 */

import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import { DualMemoryEngine } from '../dual-memory-engine';
import type {
  MemoryEvent,
  UserPreferenceSet,
  CodePattern,
  KnowledgeNode,
  ReasoningTrace,
} from '../types/memory-interfaces';

export interface SessionData {
  id: string;
  userId: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  interactions: Interaction[];
  learnings: Learning[];
  preferences: UserPreferenceSet;
  context: SessionContext;
}

export interface Interaction {
  timestamp: Date;
  type: 'command' | 'query' | 'feedback' | 'correction';
  input: string;
  output: string;
  success: boolean;
  metadata?: any;
}

export interface Learning {
  id: string;
  type: 'pattern' | 'preference' | 'correction' | 'optimization';
  content: any;
  confidence: number;
  frequency: number;
  lastApplied: Date;
  outcomes: Outcome[];
}

export interface Outcome {
  timestamp: Date;
  success: boolean;
  feedback?: string;
  improvement?: number;
}

export interface SessionContext {
  project?: string;
  language?: string;
  framework?: string;
  goals?: string[];
  expertise?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
}

export interface LearningMetrics {
  totalSessions: number;
  totalInteractions: number;
  successRate: number;
  improvementRate: number;
  patternCount: number;
  preferenceStability: number;
}

export interface PersonalizationProfile {
  userId: string;
  preferences: UserPreferenceSet;
  patterns: BehaviorPattern[];
  expertise: ExpertiseProfile;
  optimizations: OptimizationRule[];
}

export interface BehaviorPattern {
  id: string;
  pattern: string;
  frequency: number;
  context: string[];
  confidence: number;
  examples: string[];
}

export interface ExpertiseProfile {
  languages: Map<string, number>; // language -> proficiency (0-1)
  frameworks: Map<string, number>;
  domains: Map<string, number>;
  skills: Map<string, number>;
}

export interface OptimizationRule {
  id: string;
  condition: string;
  action: string;
  priority: number;
  successRate: number;
  appliedCount: number;
}

export class CrossSessionLearningEngine extends EventEmitter {
  private sessions: Map<string, SessionData> = new Map();
  private learnings: Map<string, Learning[]> = new Map();
  private profiles: Map<string, PersonalizationProfile> = new Map();
  private memoryEngine: DualMemoryEngine;
  private persistencePath: string;
  private autosaveInterval: NodeJS.Timeout | null = null;

  constructor(
    memoryEngine: DualMemoryEngine,
    private config: {
      persistencePath?: string;
      autosaveInterval?: number;
      maxSessionHistory?: number;
      learningThreshold?: number;
      adaptationRate?: number;
    } = {}
  ) {
    super();
    this.memoryEngine = memoryEngine;
    this.persistencePath = config.persistencePath || '.maria/learning';
    
    this.initialize();
  }

  private async initialize(): Promise<void> {
    // Load persisted data
    await this.loadPersistedData();
    
    // Start autosave
    if (this.config.autosaveInterval) {
      this.autosaveInterval = setInterval(() => {
        this.persistData().catch(error => {
          console.error('Autosave failed:', error);
        });
      }, this.config.autosaveInterval);
    }
  }

  /**
   * Start a new learning session
   */
  async startSession(userId: string, context?: SessionContext): Promise<SessionData> {
    const session: SessionData = {
      id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      startTime: new Date(),
      interactions: [],
      learnings: [],
      preferences: await this.getUserPreferences(userId),
      context: context || {},
    };

    this.sessions.set(session.id, session);
    
    // Load user's profile
    await this.loadUserProfile(userId);
    
    this.emit('session:started', session);
    
    return session;
  }

  /**
   * End a learning session
   */
  async endSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    session.endTime = new Date();
    session.duration = session.endTime.getTime() - session.startTime.getTime();

    // Extract learnings from session
    await this.extractLearnings(session);
    
    // Update user profile
    await this.updateUserProfile(session);
    
    // Persist to memory engine
    await this.persistToMemory(session);
    
    // Clean up old sessions
    await this.cleanupOldSessions(session.userId);
    
    this.emit('session:ended', session);
  }

  /**
   * Record an interaction
   */
  async recordInteraction(
    sessionId: string,
    interaction: Interaction
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    session.interactions.push(interaction);
    
    // Real-time learning from interaction
    await this.learnFromInteraction(session, interaction);
    
    // Update patterns
    await this.updatePatterns(session.userId, interaction);
    
    this.emit('interaction:recorded', { session, interaction });
  }

  /**
   * Learn from an interaction
   */
  private async learnFromInteraction(
    session: SessionData,
    interaction: Interaction
  ): Promise<void> {
    // Analyze interaction for patterns
    const patterns = this.analyzeInteraction(interaction);
    
    for (const pattern of patterns) {
      // Check if pattern exists
      const existingLearning = this.findLearning(session.userId, pattern);
      
      if (existingLearning) {
        // Update existing learning
        existingLearning.frequency++;
        existingLearning.lastApplied = new Date();
        existingLearning.confidence = Math.min(
          1,
          existingLearning.confidence + this.config.adaptationRate || 0.1
        );
        
        // Record outcome
        existingLearning.outcomes.push({
          timestamp: new Date(),
          success: interaction.success,
          improvement: this.calculateImprovement(existingLearning),
        });
      } else {
        // Create new learning
        const learning: Learning = {
          id: `learning_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: pattern.type,
          content: pattern.content,
          confidence: 0.5,
          frequency: 1,
          lastApplied: new Date(),
          outcomes: [{
            timestamp: new Date(),
            success: interaction.success,
          }],
        };
        
        session.learnings.push(learning);
        this.addLearning(session.userId, learning);
      }
    }
  }

  /**
   * Analyze interaction for patterns
   */
  private analyzeInteraction(interaction: Interaction): any[] {
    const patterns: any[] = [];
    
    // Command patterns
    if (interaction.type === 'command') {
      patterns.push({
        type: 'pattern',
        content: {
          command: interaction.input,
          context: interaction.metadata?.context,
          success: interaction.success,
        },
      });
    }
    
    // Correction patterns
    if (interaction.type === 'correction') {
      patterns.push({
        type: 'correction',
        content: {
          original: interaction.metadata?.original,
          corrected: interaction.input,
          reason: interaction.metadata?.reason,
        },
      });
    }
    
    // Preference patterns
    if (interaction.metadata?.preference) {
      patterns.push({
        type: 'preference',
        content: interaction.metadata.preference,
      });
    }
    
    return patterns;
  }

  /**
   * Update behavior patterns
   */
  private async updatePatterns(userId: string, interaction: Interaction): Promise<void> {
    const profile = this.profiles.get(userId);
    if (!profile) return;
    
    // Extract behavior pattern
    const behaviorPattern = this.extractBehaviorPattern(interaction);
    if (!behaviorPattern) return;
    
    // Find or create pattern
    const existingPattern = profile.patterns.find(p => 
      p.pattern === behaviorPattern.pattern
    );
    
    if (existingPattern) {
      existingPattern.frequency++;
      existingPattern.confidence = Math.min(
        1,
        existingPattern.confidence + 0.05
      );
      existingPattern.examples.push(interaction.input);
      
      // Keep only recent examples
      if (existingPattern.examples.length > 10) {
        existingPattern.examples = existingPattern.examples.slice(-10);
      }
    } else {
      profile.patterns.push({
        id: `pattern_${Date.now()}`,
        pattern: behaviorPattern.pattern,
        frequency: 1,
        context: [interaction.metadata?.context || 'general'],
        confidence: 0.5,
        examples: [interaction.input],
      });
    }
  }

  /**
   * Extract behavior pattern from interaction
   */
  private extractBehaviorPattern(interaction: Interaction): any {
    // Simple pattern extraction - in production, use NLP
    const input = interaction.input.toLowerCase();
    
    // Command patterns
    if (input.startsWith('/')) {
      const command = input.split(' ')[0];
      return {
        pattern: `command:${command}`,
        type: 'command',
      };
    }
    
    // Question patterns
    if (input.includes('?')) {
      return {
        pattern: 'question',
        type: 'query',
      };
    }
    
    // Code request patterns
    if (input.includes('generate') || input.includes('create') || input.includes('write')) {
      return {
        pattern: 'code_generation',
        type: 'generation',
      };
    }
    
    return null;
  }

  /**
   * Extract learnings from session
   */
  private async extractLearnings(session: SessionData): Promise<void> {
    // Analyze session interactions for learnings
    const learningCandidates = this.analyzeSessionForLearnings(session);
    
    for (const candidate of learningCandidates) {
      if (candidate.confidence >= (this.config.learningThreshold || 0.7)) {
        // Store as learning
        const learning: Learning = {
          id: `learning_${Date.now()}`,
          type: candidate.type,
          content: candidate.content,
          confidence: candidate.confidence,
          frequency: candidate.frequency,
          lastApplied: new Date(),
          outcomes: [],
        };
        
        this.addLearning(session.userId, learning);
        
        // Store in memory engine
        await this.storeInMemoryEngine(learning, session.userId);
      }
    }
  }

  /**
   * Analyze session for learnings
   */
  private analyzeSessionForLearnings(session: SessionData): any[] {
    const candidates: any[] = [];
    
    // Analyze success patterns
    const successfulInteractions = session.interactions.filter(i => i.success);
    const successRate = successfulInteractions.length / session.interactions.length;
    
    if (successRate > 0.8) {
      candidates.push({
        type: 'optimization',
        content: {
          context: session.context,
          successRate,
          patterns: this.extractSuccessPatterns(successfulInteractions),
        },
        confidence: successRate,
        frequency: successfulInteractions.length,
      });
    }
    
    // Analyze repeated actions
    const actionFrequency = new Map<string, number>();
    session.interactions.forEach(i => {
      const key = `${i.type}:${i.input.substring(0, 50)}`;
      actionFrequency.set(key, (actionFrequency.get(key) || 0) + 1);
    });
    
    for (const [action, frequency] of actionFrequency.entries()) {
      if (frequency >= 3) {
        candidates.push({
          type: 'pattern',
          content: { action, frequency },
          confidence: frequency / session.interactions.length,
          frequency,
        });
      }
    }
    
    return candidates;
  }

  /**
   * Extract success patterns
   */
  private extractSuccessPatterns(interactions: Interaction[]): any[] {
    // Group by type and analyze
    const patterns: any[] = [];
    const typeGroups = new Map<string, Interaction[]>();
    
    interactions.forEach(i => {
      const group = typeGroups.get(i.type) || [];
      group.push(i);
      typeGroups.set(i.type, group);
    });
    
    for (const [type, group] of typeGroups.entries()) {
      if (group.length >= 2) {
        patterns.push({
          type,
          count: group.length,
          examples: group.slice(0, 3).map(i => i.input),
        });
      }
    }
    
    return patterns;
  }

  /**
   * Update user profile
   */
  private async updateUserProfile(session: SessionData): Promise<void> {
    let profile = this.profiles.get(session.userId);
    
    if (!profile) {
      profile = {
        userId: session.userId,
        preferences: session.preferences,
        patterns: [],
        expertise: {
          languages: new Map(),
          frameworks: new Map(),
          domains: new Map(),
          skills: new Map(),
        },
        optimizations: [],
      };
      this.profiles.set(session.userId, profile);
    }
    
    // Update preferences
    profile.preferences = { ...profile.preferences, ...session.preferences };
    
    // Update expertise based on session context
    if (session.context.language) {
      const current = profile.expertise.languages.get(session.context.language) || 0;
      profile.expertise.languages.set(
        session.context.language,
        Math.min(1, current + 0.05)
      );
    }
    
    if (session.context.framework) {
      const current = profile.expertise.frameworks.get(session.context.framework) || 0;
      profile.expertise.frameworks.set(
        session.context.framework,
        Math.min(1, current + 0.05)
      );
    }
    
    // Generate optimization rules
    const optimizations = this.generateOptimizationRules(session);
    profile.optimizations.push(...optimizations);
  }

  /**
   * Generate optimization rules
   */
  private generateOptimizationRules(session: SessionData): OptimizationRule[] {
    const rules: OptimizationRule[] = [];
    
    // Analyze successful patterns
    const successfulPatterns = session.interactions
      .filter(i => i.success)
      .map(i => this.extractBehaviorPattern(i))
      .filter(p => p !== null);
    
    // Create rules for frequent successful patterns
    const patternFrequency = new Map<string, number>();
    successfulPatterns.forEach(p => {
      patternFrequency.set(p.pattern, (patternFrequency.get(p.pattern) || 0) + 1);
    });
    
    for (const [pattern, frequency] of patternFrequency.entries()) {
      if (frequency >= 2) {
        rules.push({
          id: `rule_${Date.now()}`,
          condition: `pattern === '${pattern}'`,
          action: 'apply_optimized_response',
          priority: frequency,
          successRate: 1.0,
          appliedCount: 0,
        });
      }
    }
    
    return rules;
  }

  /**
   * Store learning in memory engine
   */
  private async storeInMemoryEngine(
    learning: Learning,
    userId: string
  ): Promise<void> {
    const embedding = await this.generateEmbedding(JSON.stringify(learning.content));
    
    await this.memoryEngine.getSystem1().addKnowledgeNode(
      'learning',
      learning.id,
      JSON.stringify(learning),
      embedding,
      {
        userId,
        type: learning.type,
        confidence: learning.confidence,
        timestamp: new Date().toISOString(),
      }
    );
  }

  /**
   * Persist to memory engine
   */
  private async persistToMemory(session: SessionData): Promise<void> {
    // Store session summary
    const summary = {
      sessionId: session.id,
      userId: session.userId,
      duration: session.duration,
      interactionCount: session.interactions.length,
      successRate: session.interactions.filter(i => i.success).length / session.interactions.length,
      learnings: session.learnings.length,
      context: session.context,
    };
    
    const embedding = await this.generateEmbedding(JSON.stringify(summary));
    
    await this.memoryEngine.getSystem1().addKnowledgeNode(
      'session',
      session.id,
      JSON.stringify(summary),
      embedding,
      {
        userId: session.userId,
        timestamp: session.endTime?.toISOString(),
      }
    );
  }

  /**
   * Get personalized suggestions
   */
  async getPersonalizedSuggestions(
    userId: string,
    context: any
  ): Promise<string[]> {
    const profile = this.profiles.get(userId);
    if (!profile) return [];
    
    const suggestions: string[] = [];
    
    // Based on patterns
    const relevantPatterns = profile.patterns
      .filter(p => p.confidence > 0.7)
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 5);
    
    for (const pattern of relevantPatterns) {
      suggestions.push(`Based on your pattern: ${pattern.pattern}`);
    }
    
    // Based on expertise
    const topLanguage = Array.from(profile.expertise.languages.entries())
      .sort((a, b) => b[1] - a[1])[0];
    
    if (topLanguage) {
      suggestions.push(`Optimized for ${topLanguage[0]}`);
    }
    
    // Based on optimizations
    const applicableRules = profile.optimizations
      .filter(r => r.successRate > 0.8)
      .slice(0, 3);
    
    for (const rule of applicableRules) {
      suggestions.push(`Optimization available: ${rule.action}`);
    }
    
    return suggestions;
  }

  /**
   * Get learning metrics
   */
  getLearningMetrics(userId: string): LearningMetrics {
    const userSessions = Array.from(this.sessions.values())
      .filter(s => s.userId === userId);
    
    const userLearnings = this.learnings.get(userId) || [];
    const profile = this.profiles.get(userId);
    
    const totalInteractions = userSessions.reduce(
      (sum, s) => sum + s.interactions.length,
      0
    );
    
    const successfulInteractions = userSessions.reduce(
      (sum, s) => sum + s.interactions.filter(i => i.success).length,
      0
    );
    
    return {
      totalSessions: userSessions.length,
      totalInteractions,
      successRate: totalInteractions > 0 ? successfulInteractions / totalInteractions : 0,
      improvementRate: this.calculateImprovementRate(userLearnings),
      patternCount: profile?.patterns.length || 0,
      preferenceStability: this.calculatePreferenceStability(userId),
    };
  }

  /**
   * Calculate improvement rate
   */
  private calculateImprovementRate(learnings: Learning[]): number {
    if (learnings.length === 0) return 0;
    
    const improvements = learnings
      .flatMap(l => l.outcomes)
      .map(o => o.improvement || 0)
      .filter(i => i > 0);
    
    if (improvements.length === 0) return 0;
    
    return improvements.reduce((a, b) => a + b, 0) / improvements.length;
  }

  /**
   * Calculate improvement for a learning
   */
  private calculateImprovement(learning: Learning): number {
    const recentOutcomes = learning.outcomes.slice(-5);
    if (recentOutcomes.length < 2) return 0;
    
    const recentSuccess = recentOutcomes.filter(o => o.success).length / recentOutcomes.length;
    const overallSuccess = learning.outcomes.filter(o => o.success).length / learning.outcomes.length;
    
    return recentSuccess - overallSuccess;
  }

  /**
   * Calculate preference stability
   */
  private calculatePreferenceStability(userId: string): number {
    const userSessions = Array.from(this.sessions.values())
      .filter(s => s.userId === userId)
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
    
    if (userSessions.length < 2) return 1;
    
    // Compare preferences across sessions
    let stability = 0;
    for (let i = 1; i < userSessions.length; i++) {
      const prev = userSessions[i - 1].preferences;
      const curr = userSessions[i].preferences;
      
      // Simple comparison - in production, use more sophisticated metrics
      const similarity = this.comparePreferences(prev, curr);
      stability += similarity;
    }
    
    return stability / (userSessions.length - 1);
  }

  /**
   * Compare preferences
   */
  private comparePreferences(
    prev: UserPreferenceSet,
    curr: UserPreferenceSet
  ): number {
    let matches = 0;
    let total = 0;
    
    // Compare each preference field
    for (const key in prev) {
      total++;
      if (JSON.stringify(prev[key as keyof UserPreferenceSet]) === 
          JSON.stringify(curr[key as keyof UserPreferenceSet])) {
        matches++;
      }
    }
    
    return total > 0 ? matches / total : 0;
  }

  /**
   * Helper functions
   */
  private async getUserPreferences(userId: string): Promise<UserPreferenceSet> {
    const profile = this.profiles.get(userId);
    return profile?.preferences || {
      codeStyle: 'functional',
      outputFormat: 'detailed',
      learningEnabled: true,
    };
  }

  private async loadUserProfile(userId: string): Promise<void> {
    // Load from persistence
    try {
      const profilePath = path.join(this.persistencePath, `${userId}.json`);
      const data = await fs.readFile(profilePath, 'utf-8');
      const profile = JSON.parse(data);
      
      // Restore Maps
      profile.expertise.languages = new Map(profile.expertise.languages);
      profile.expertise.frameworks = new Map(profile.expertise.frameworks);
      profile.expertise.domains = new Map(profile.expertise.domains);
      profile.expertise.skills = new Map(profile.expertise.skills);
      
      this.profiles.set(userId, profile);
    } catch (error) {
      // Profile doesn't exist yet
    }
  }

  private findLearning(userId: string, pattern: any): Learning | undefined {
    const userLearnings = this.learnings.get(userId) || [];
    return userLearnings.find(l => 
      l.type === pattern.type && 
      JSON.stringify(l.content) === JSON.stringify(pattern.content)
    );
  }

  private addLearning(userId: string, learning: Learning): void {
    const userLearnings = this.learnings.get(userId) || [];
    userLearnings.push(learning);
    this.learnings.set(userId, userLearnings);
  }

  private async cleanupOldSessions(userId: string): Promise<void> {
    const maxSessions = this.config.maxSessionHistory || 100;
    const userSessions = Array.from(this.sessions.values())
      .filter(s => s.userId === userId)
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
    
    if (userSessions.length > maxSessions) {
      const toRemove = userSessions.slice(maxSessions);
      for (const session of toRemove) {
        this.sessions.delete(session.id);
      }
    }
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    // Simplified embedding - in production, use proper embedding model
    const hash = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return Array(100).fill(0).map((_, i) => Math.sin(hash + i) * 0.5 + 0.5);
  }

  private async loadPersistedData(): Promise<void> {
    try {
      await fs.mkdir(this.persistencePath, { recursive: true });
      
      // Load profiles
      const files = await fs.readdir(this.persistencePath);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const userId = file.replace('.json', '');
          await this.loadUserProfile(userId);
        }
      }
    } catch (error) {
      console.error('Failed to load persisted data:', error);
    }
  }

  private async persistData(): Promise<void> {
    try {
      await fs.mkdir(this.persistencePath, { recursive: true });
      
      // Save profiles
      for (const [userId, profile] of this.profiles.entries()) {
        const profilePath = path.join(this.persistencePath, `${userId}.json`);
        
        // Convert Maps to arrays for JSON serialization
        const serializable = {
          ...profile,
          expertise: {
            languages: Array.from(profile.expertise.languages.entries()),
            frameworks: Array.from(profile.expertise.frameworks.entries()),
            domains: Array.from(profile.expertise.domains.entries()),
            skills: Array.from(profile.expertise.skills.entries()),
          },
        };
        
        await fs.writeFile(profilePath, JSON.stringify(serializable, null, 2));
      }
    } catch (error) {
      console.error('Failed to persist data:', error);
    }
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.autosaveInterval) {
      clearInterval(this.autosaveInterval);
    }
    this.persistData();
  }
}