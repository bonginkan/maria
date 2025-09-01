/**
 * Cross-Session Learning Engine
 *
 * Enables continuous learning across multiple sessions, preserving and building
 * upon knowledge gained from previous interactions.
 */

import { EventEmitter } from "node:events";
import * as fs from "fs/promises";
import * as path from "path";
import { DualMemoryEngine } from "../dual-memory-engine";
import type {
  _CodePattern,
  _KnowledgeNode,
  _MemoryEvent,
  _ReasoningTrace,
  UserPreferenceSet,
} from "../types/memory-interfaces";

export interface SessionData {
  id: string;
  _userId: string;
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
  type: "_command" | "query" | "feedback" | "correction";
  _input: string;
  output: string;
  success: boolean;
  metadata?: any;
}

export interface Learning {
  id: string;
  type: "pattern" | "preference" | "correction" | "optimization";
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
  expertise?: "beginner" | "intermediate" | "advanced" | "expert";
}

export interface LearningMetrics {
  totalSessions: number;
  _totalInteractions: number;
  _successRate: number;
  improvementRate: number;
  patternCount: number;
  preferenceStability: number;
}

export interface PersonalizationProfile {
  _userId: string;
  preferences: UserPreferenceSet;
  _patterns: BehaviorPattern[];
  expertise: ExpertiseProfile;
  _optimizations: OptimizationRule[];
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
  _successRate: number;
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
    } = {},
  ) {
    super();
    this.memoryEngine = memoryEngine;
    this.persistencePath = config.persistencePath || ".maria/learning";

    this.initialize();
  }

  private async initialize(): Promise<void> {
    // Load persisted _data
    await this.loadPersistedData();

    // Start autosave
    if (this.config.autosaveInterval) {
      this.autosaveInterval = setInterval(() => {
        this.persistData().catch((_error) => {
          console.error("Autosave failed:", _error);
        });
      }, this.config.autosaveInterval);
    }
  }

  /**
   * Start a new learning _session
   */
  async startSession(
    _userId: string,
    context?: SessionContext,
  ): Promise<SessionData> {
    const _session: SessionData = {
      id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      _userId,
      startTime: new Date(),
      interactions: [],
      learnings: [],
      preferences: await this.getUserPreferences(_userId),
      context: context || object,
    };

    this.sessions.set(_session.id, _session);

    // Load user's _profile
    await this.loadUserProfile(_userId);

    this.emit("_session:started", _session);

    return _session;
  }

  /**
   * End a learning _session
   */
  async endSession(sessionId: string): Promise<void> {
    const _session = this.sessions.get(sessionId);
    if (!_session) {
      throw new Error("Session not found");
    }

    _session.endTime = new Date();
    _session.duration =
      _session.endTime.getTime() - _session.startTime.getTime();

    // Extract learnings from _session
    await this.extractLearnings(_session);

    // Update user _profile
    await this.updateUserProfile(_session);

    // Persist to memory engine
    await this.persistToMemory(_session);

    // Clean up old sessions
    await this.cleanupOldSessions(_session.userId);

    this.emit("_session:ended", _session);
  }

  /**
   * Record an interaction
   */
  async recordInteraction(
    _sessionId: string,
    interaction: Interaction,
  ): Promise<void> {
    const _session = this.sessions.get(_sessionId);
    if (!_session) {
      throw new Error("Session not found");
    }

    session.interactions.push(interaction);

    // Real-time learning from interaction
    await this.learnFromInteraction(_session, interaction);

    // Update _patterns
    await this.updatePatterns(_session.userId, interaction);

    this.emit("interaction:recorded", { _session, interaction });
  }

  /**
   * Learn from an interaction
   */
  private async learnFromInteraction(
    _session: SessionData,
    interaction: Interaction,
  ): Promise<void> {
    // Analyze interaction for _patterns
    const _patterns = this.analyzeInteraction(interaction);

    for (const pattern of _patterns) {
      // Check if pattern exists
      const _existingLearning = this.findLearning(_session.userId, pattern);

      if (_existingLearning) {
        // Update existing learning
        _existingLearning.frequency++;
        _existingLearning.lastApplied = new Date();
        existingLearning.confidence = Math.min(
          1,
          existingLearning.confidence + this.config.adaptationRate || 0.1,
        );

        // Record outcome
        existingLearning.outcomes.push({
          timestamp: new Date(),
          success: interaction.success,
          improvement: this.calculateImprovement(_existingLearning),
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
          outcomes: [
            {
              timestamp: new Date(),
              success: interaction.success,
            },
          ],
        };

        session.learnings.push(learning);
        this.addLearning(_session.userId, learning);
      }
    }
  }

  /**
   * Analyze interaction for _patterns
   */
  private analyzeInteraction(interaction: Interaction): any[] {
    const _patterns: any[] = [];

    // Command _patterns
    if (interaction.type === "_command") {
      patterns.push({
        type: "pattern",
        content: {
          _command: interaction.input,
          context: interaction.metadata?.context,
          success: interaction.success,
        },
      });
    }

    // Correction _patterns
    if (interaction.type === "correction") {
      patterns.push({
        type: "correction",
        content: {
          original: interaction.metadata?.original,
          corrected: interaction.input,
          reason: interaction.metadata?.reason,
        },
      });
    }

    // Preference _patterns
    if (interaction.metadata?.preference) {
      patterns.push({
        type: "preference",
        content: interaction.metadata.preference,
      });
    }

    return _patterns;
  }

  /**
   * Update behavior _patterns
   */
  private async updatePatterns(
    _userId: string,
    interaction: Interaction,
  ): Promise<void> {
    const _profile = this.profiles.get(_userId);
    if (!_profile) {
      return;
    }

    // Extract behavior pattern
    const _behaviorPattern = this.extractBehaviorPattern(interaction);
    if (!_behaviorPattern) {
      return;
    }

    // Find or create pattern
    const _existingPattern = _profile.patterns.find(
      (p) => p.pattern === _behaviorPattern.pattern,
    );

    if (_existingPattern) {
      _existingPattern.frequency++;
      _existingPattern.confidence = Math.min(
        1,
        _existingPattern.confidence + 0.05,
      );
      existingPattern.examples.push(interaction.input);

      // Keep only recent examples
      if (_existingPattern.examples.length > 10) {
        _existingPattern.examples = _existingPattern.examples.slice(-10);
      }
    } else {
      profile.patterns.push({
        id: `pattern_${Date.now()}`,
        pattern: _behaviorPattern.pattern,
        frequency: 1,
        context: [interaction.metadata?.context || "general"],
        confidence: 0.5,
        examples: [interaction.input],
      });
    }
  }

  /**
   * Extract behavior pattern from interaction
   */
  private extractBehaviorPattern(interaction: Interaction): unknown {
    // Simple pattern extraction - in production, use NLP
    const _input = interaction._input.toLowerCase();

    // Command _patterns
    if (_input.startsWith("/")) {
      const _command = _input.split(" ")[0];
      return {
        pattern: `_command:${_command}`,
        type: "_command",
      };
    }

    // Question _patterns
    if (_input.includes("?")) {
      return {
        pattern: "question",
        type: "query",
      };
    }

    // Code request _patterns
    if (
      _input.includes("generate") ||
      _input.includes("create") ||
      _input.includes("write")
    ) {
      return {
        pattern: "code_generation",
        type: "generation",
      };
    }

    return null;
  }

  /**
   * Extract learnings from _session
   */
  private async extractLearnings(_session: SessionData): Promise<void> {
    // Analyze _session interactions for learnings
    const _learningCandidates = this.analyzeSessionForLearnings(_session);

    for (const candidate of _learningCandidates) {
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
   * Analyze _session for learnings
   */
  private analyzeSessionForLearnings(_session: SessionData): any[] {
    const candidates: any[] = [];

    // Analyze success _patterns
    const _successfulInteractions = _session.interactions.filter(
      (i) => i.success,
    );
    const _successRate =
      _successfulInteractions.length / _session.interactions.length;

    if (_successRate > 0.8) {
      candidates.push({
        type: "optimization",
        content: {
          context: _session.context,
          _successRate,
          _patterns: this.extractSuccessPatterns(_successfulInteractions),
        },
        confidence: _successRate,
        frequency: _successfulInteractions.length,
      });
    }

    // Analyze repeated actions
    const _actionFrequency = new Map<string, number>();
    session.interactions.forEach((i) => {
      const _key = `${i.type}:${i.input.substring(0, 50)}`;
      _actionFrequency.set(_key, (_actionFrequency.get(_key) || 0) + 1);
    });

    for (const [action, frequency] of _actionFrequency.entries()) {
      if (frequency >= 3) {
        candidates.push({
          type: "pattern",
          content: { action, frequency },
          confidence: frequency / _session.interactions.length,
          frequency,
        });
      }
    }

    return candidates;
  }

  /**
   * Extract success _patterns
   */
  private extractSuccessPatterns(interactions: Interaction[]): any[] {
    // Group by type and analyze
    const _patterns: any[] = [];
    const _typeGroups = new Map<string, Interaction[]>();

    interactions.forEach((i) => {
      const _group = _typeGroups.get(i.type) || [];
      group.push(i);
      typeGroups.set(i.type, _group);
    });

    for (const [type, _group] of _typeGroups.entries()) {
      if (group.length >= 2) {
        patterns.push({
          type,
          count: group.length,
          examples: group.slice(0, 3).map((i) => i.input),
        });
      }
    }

    return _patterns;
  }

  /**
   * Update user _profile
   */
  private async updateUserProfile(_session: SessionData): Promise<void> {
    let _profile = this.profiles.get(session.userId);

    if (!_profile) {
      _profile = {
        _userId: session.userId,
        preferences: session.preferences,
        _patterns: [],
        expertise: {
          languages: new Map(),
          frameworks: new Map(),
          domains: new Map(),
          skills: new Map(),
        },
        _optimizations: [],
      };
      this.profiles.set(session.userId, _profile);
    }

    // Update preferences
    _profile.preferences = { ..._profile.preferences, ...session.preferences };

    // Update expertise based on _session context
    if (session.context.language) {
      const _current =
        _profile.expertise.languages.get(session.context.language) || 0;
      profile.expertise.languages.set(
        session.context.language,
        Math.min(1, _current + 0.05),
      );
    }

    if (session.context.framework) {
      const _current =
        _profile.expertise.frameworks.get(session.context.framework) || 0;
      profile.expertise.frameworks.set(
        session.context.framework,
        Math.min(1, _current + 0.05),
      );
    }

    // Generate optimization rules
    const _optimizations = this.generateOptimizationRules(_session);
    profile._optimizations.push(..._optimizations);
  }

  /**
   * Generate optimization rules
   */
  private generateOptimizationRules(_session: SessionData): OptimizationRule[] {
    const rules: OptimizationRule[] = [];

    // Analyze successful _patterns
    const _successfulPatterns = _session.interactions
      .filter((i) => i.success)
      .map((i) => this.extractBehaviorPattern(i))
      .filter((p) => p !== null);

    // Create rules for frequent successful _patterns
    const _patternFrequency = new Map<string, number>();
    successfulPatterns.forEach((p) => {
      _patternFrequency.set(
        p.pattern,
        (_patternFrequency.get(p.pattern) || 0) + 1,
      );
    });

    for (const [pattern, frequency] of _patternFrequency.entries()) {
      if (frequency >= 2) {
        rules.push({
          id: `rule_${Date.now()}`,
          condition: `pattern === '${pattern}'`,
          action: "apply_optimized_response",
          priority: frequency,
          _successRate: 1.0,
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
    _learning: Learning,
    _userId: string,
  ): Promise<void> {
    const _embedding = await this.generateEmbedding(
      JSON.stringify(_learning.content),
    );

    await this.memoryEngine
      .getSystem1()
      .addKnowledgeNode(
        "_learning",
        _learning.id,
        JSON.stringify(_learning),
        _embedding,
        {
          _userId,
          type: _learning.type,
          confidence: _learning.confidence,
          timestamp: new Date().toISOString(),
        },
      );
  }

  /**
   * Persist to memory engine
   */
  private async persistToMemory(_session: SessionData): Promise<void> {
    // Store _session _summary
    const _summary = {
      sessionId: _session.id,
      _userId: _session.userId,
      duration: _session.duration,
      interactionCount: _session.interactions.length,
      _successRate:
        _session.interactions.filter((i) => i.success).length /
        _session.interactions.length,
      learnings: _session.learnings.length,
      context: _session.context,
    };

    const _embedding = await this.generateEmbedding(JSON.stringify(_summary));

    await this.memoryEngine
      .getSystem1()
      .addKnowledgeNode(
        "_session",
        _session.id,
        JSON.stringify(_summary),
        _embedding,
        {
          _userId: _session.userId,
          timestamp: _session.endTime?.toISOString(),
        },
      );
  }

  /**
   * Get personalized suggestions
   */
  async getPersonalizedSuggestions(
    _userId: string,
    _context: unknown,
  ): Promise<string[]> {
    const _profile = this.profiles.get(_userId);
    if (!_profile) {
      return [];
    }

    const suggestions: string[] = [];

    // Based on _patterns
    const _relevantPatterns = _profile.patterns
      .filter((p) => p.confidence > 0.7)
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 5);

    for (const pattern of _relevantPatterns) {
      suggestions.push(`Based on your pattern: ${pattern.pattern}`);
    }

    // Based on expertise
    const _topLanguage = Array.from(
      _profile.expertise.languages.entries(),
    ).sort((a, b) => b[1] - a[1])[0];

    if (_topLanguage) {
      suggestions.push(`Optimized for ${_topLanguage[0]}`);
    }

    // Based on _optimizations
    const _applicableRules = _profile.optimizations
      .filter((r) => r.successRate > 0.8)
      .slice(0, 3);

    for (const rule of _applicableRules) {
      suggestions.push(`Optimization available: ${rule.action}`);
    }

    return suggestions;
  }

  /**
   * Get learning metrics
   */
  getLearningMetrics(_userId: string): LearningMetrics {
    const _userSessions = Array.from(this.sessions.values()).filter(
      (s) => s.userId === _userId,
    );

    const _userLearnings = this.learnings.get(_userId) || [];
    const _profile = this.profiles.get(_userId);

    const _totalInteractions = _userSessions.reduce(
      (sum, s) => sum + s.interactions.length,
      0,
    );

    const _successfulInteractions = _userSessions.reduce(
      (sum, s) => sum + s.interactions.filter((i) => i.success).length,
      0,
    );

    return {
      totalSessions: _userSessions.length,
      _totalInteractions,
      _successRate:
        _totalInteractions > 0
          ? _successfulInteractions / _totalInteractions
          : 0,
      improvementRate: this.calculateImprovementRate(_userLearnings),
      patternCount: _profile?.patterns.length || 0,
      preferenceStability: this.calculatePreferenceStability(_userId),
    };
  }

  /**
   * Calculate improvement rate
   */
  private calculateImprovementRate(learnings: Learning[]): number {
    if (learnings.length === 0) {
      return 0;
    }

    const _improvements = learnings
      .flatMap((l) => l.outcomes)
      .map((o) => o.improvement || 0)
      .filter((i) => i > 0);

    if (_improvements.length === 0) {
      return 0;
    }

    return _improvements.reduce((a, b) => a + b, 0) / _improvements.length;
  }

  /**
   * Calculate improvement for a learning
   */
  private calculateImprovement(learning: Learning): number {
    const _recentOutcomes = learning.outcomes.slice(-5);
    if (_recentOutcomes.length < 2) {
      return 0;
    }

    const _recentSuccess =
      _recentOutcomes.filter((o) => o.success).length / _recentOutcomes.length;
    const _overallSuccess =
      learning.outcomes.filter((o) => o.success).length /
      learning.outcomes.length;

    return _recentSuccess - _overallSuccess;
  }

  /**
   * Calculate preference stability
   */
  private calculatePreferenceStability(_userId: string): number {
    const _userSessions = Array.from(this.sessions.values())
      .filter((s) => s.userId === _userId)
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

    if (_userSessions.length < 2) {
      return 1;
    }

    // Compare preferences across sessions
    let stability = 0;
    for (let i = 1; i < _userSessions.length; i++) {
      const _prev = _userSessions[i - 1].preferences;
      const _curr = _userSessions[i].preferences;

      // Simple comparison - in production, use more sophisticated metrics
      const _similarity = this.comparePreferences(_prev, _curr);
      stability += _similarity;
    }

    return stability / (_userSessions.length - 1);
  }

  /**
   * Compare preferences
   */
  private comparePreferences(
    _prev: UserPreferenceSet,
    _curr: UserPreferenceSet,
  ): number {
    let matches = 0;
    let total = 0;

    // Compare each preference field
    for (const _key in _prev) {
      total++;
      if (
        JSON.stringify(_prev[_key as keyof UserPreferenceSet]) ===
        JSON.stringify(_curr[_key as keyof UserPreferenceSet])
      ) {
        matches++;
      }
    }

    return total > 0 ? matches / total : 0;
  }

  /**
   * Helper functions
   */
  private async getUserPreferences(
    _userId: string,
  ): Promise<UserPreferenceSet> {
    const _profile = this.profiles.get(_userId);
    return (
      _profile?.preferences || {
        codeStyle: "functional",
        outputFormat: "detailed",
        learningEnabled: true,
      }
    );
  }

  private async loadUserProfile(_userId: string): Promise<void> {
    // Load from persistence
    try {
      const _profilePath = path.join(this.persistencePath, `${_userId}.json`);
      const _data = await fs.readFile(_profilePath, "utf-8");
      const _profile = JSON.parse(_data);

      // Restore Maps
      _profile.expertise.languages = new Map(_profile.expertise.languages);
      _profile.expertise.frameworks = new Map(_profile.expertise.frameworks);
      _profile.expertise.domains = new Map(_profile.expertise.domains);
      _profile.expertise.skills = new Map(_profile.expertise.skills);

      this.profiles.set(_userId, _profile);
    } catch (_error) {
      // Profile doesn't exist yet
    }
  }

  private findLearning(
    _userId: string,
    pattern: unknown,
  ): Learning | undefined {
    const _userLearnings = this.learnings.get(_userId) || [];
    return _userLearnings.find(
      (l) =>
        l.type === pattern.type &&
        JSON.stringify(l.content) === JSON.stringify(pattern.content),
    );
  }

  private addLearning(_userId: string, learning: Learning): void {
    const _userLearnings = this.learnings.get(_userId) || [];
    userLearnings.push(learning);
    this.learnings.set(_userId, _userLearnings);
  }

  private async cleanupOldSessions(_userId: string): Promise<void> {
    const _maxSessions = this.config.maxSessionHistory || 100;
    const _userSessions = Array.from(this.sessions.values())
      .filter((s) => s.userId === _userId)
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime());

    if (_userSessions.length > _maxSessions) {
      const _toRemove = _userSessions.slice(_maxSessions);
      for (const _session of _toRemove) {
        this.sessions.delete(_session.id);
      }
    }
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    // Simplified _embedding - in production, use proper _embedding model
    const _hash = text
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return Array(100)
      .fill(0)
      .map((_, i) => Math.sin(_hash + i) * 0.5 + 0.5);
  }

  private async loadPersistedData(): Promise<void> {
    try {
      await fs.mkdir(this.persistencePath, { recursive: true });

      // Load profiles
      const _files = await fs.readdir(this.persistencePath);
      for (const file of _files) {
        if (file.endsWith(".json")) {
          const _userId = file.replace(".json", "");
          await this.loadUserProfile(_userId);
        }
      }
    } catch (_error) {
      console._error("Failed to load persisted _data:", _error);
    }
  }

  private async persistData(): Promise<void> {
    try {
      await fs.mkdir(this.persistencePath, { recursive: true });

      // Save profiles
      for (const [_userId, _profile] of this.profiles.entries()) {
        const _profilePath = path.join(this.persistencePath, `${_userId}.json`);

        // Convert Maps to arrays for JSON serialization
        const _serializable = {
          ...profile,
          expertise: {
            languages: Array.from(profile.expertise.languages.entries()),
            frameworks: Array.from(profile.expertise.frameworks.entries()),
            domains: Array.from(profile.expertise.domains.entries()),
            skills: Array.from(profile.expertise.skills.entries()),
          },
        };

        await fs.writeFile(
          _profilePath,
          JSON.stringify(_serializable, null, 2),
        );
      }
    } catch (_error) {
      console._error("Failed to persist _data:", _error);
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
