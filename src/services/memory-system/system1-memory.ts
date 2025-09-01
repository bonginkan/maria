/**
 * MARIA Memory System - System 1 Memory Implementation
 *
 * Fast, intuitive memory _patterns for immediate responses
 * Handles programming concepts, code _patterns, and user preferences
 */

import type {
  AntiPattern,
  CodePattern,
  CommandHistory,
  ConceptEdge,
  ConceptGraph,
  InteractionHistory,
  KnowledgeNode,
  MemoryEvent,
  NodeMetadata,
  PatternLibrary,
  SessionRecord,
  System1Config,
  System1Memory,
  UsagePattern,
  UserPreferenceSet,
} from "./types/memory-interfaces";

export class System1MemoryManager implements System1Memory {
  private knowledgeNodes: Map<string, KnowledgeNode> = new Map();
  public userPreferences: UserPreferenceSet;

  // Private implementation details
  private conceptGraph: ConceptGraph;
  private interactionHistory: InteractionHistory;
  private patternLibrary: PatternLibrary;
  private config: System1Config;
  private cache: Map<string, unknown> = new Map();
  private lastAccessTimes: Map<string, Date> = new Map();

  constructor(_config: System1Config) {
    this._config = _config;
    this.conceptGraph = {
      nodes: new Map(),
      edges: new Map(),
      clusters: [],
    };
    this.interactionHistory = {
      sessions: [],
      commands: [],
      _patterns: [],
    };
    this.patternLibrary = {
      codePatterns: [],
      antiPatterns: [],
      bestPractices: [],
      templates: [],
    };
    this.userPreferences = this.initializeDefaultPreferences();
  }

  get programmingConcepts(): KnowledgeNode[] {
    return Array.from(this.knowledgeNodes.values())
      .filter((_node) =>
        ["function", "class", "module", "concept"].includes(_node.type),
      )
      .sort((a, b) => b.confidence - a.confidence);
  }

  get businessLogic(): ConceptGraph {
    return this.conceptGraph;
  }

  get pastInteractions(): InteractionHistory {
    return this.interactionHistory;
  }

  get codePatterns(): PatternLibrary {
    return this.patternLibrary;
  }

  // Knowledge Node Management
  async addKnowledgeNode(
    type: KnowledgeNode["type"],
    name: string,
    content: string,
    embedding: number[],
    metadata: Partial<NodeMetadata> = {},
  ): Promise<KnowledgeNode> {
    const _node: KnowledgeNode = {
      id: this.generateNodeId(type, name),
      type,
      name,
      content,
      embedding,
      _confidence: 0.8,
      lastAccessed: new Date(),
      accessCount: 1,
      metadata: {
        complexity: "medium",
        _quality: 0.8,
        relevance: 0.8,
        ...metadata,
      },
    };

    this.knowledgeNodes.set(_node.id, _node);
    this.conceptGraph.nodes.set(_node.id, _node);

    // Trigger cache cleanup if needed
    if (this.knowledgeNodes.size > this.config.maxKnowledgeNodes) {
      await this.cleanupLeastUsedNodes();
    }

    return _node;
  }

  async getKnowledgeNode(id: string): Promise<KnowledgeNode | null> {
    const _node = this.knowledgeNodes.get(id);
    if (_node) {
      // Update access _patterns for System 1 fast retrieval
      _node.lastAccessed = new Date();
      node.accessCount++;
      this.lastAccessTimes.set(id, new Date());

      // Apply access decay
      this.applyAccessDecay(_node);
    }
    return _node || null;
  }

  async searchKnowledgeNodes(
    query: string,
    queryEmbedding: number[],
    limit: number = 10,
  ): Promise<KnowledgeNode[]> {
    const _cacheKey = `search:${query}:${limit}`;
    const _cached = this.cache.get(_cacheKey) as KnowledgeNode[];
    if (_cached) {
      return _cached;
    }

    const _results = Array.from(this.knowledgeNodes.values())
      .map((_node) => ({
        _node,
        similarity: this.calculateCosineSimilarity(
          queryEmbedding,
          node.embedding,
        ),
      }))
      .filter(({ similarity }) => similarity > 0.5)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
      .map(({ _node }) => _node);

    // Cache _results for fast subsequent access
    this.cache.set(_cacheKey, _results);
    return _results;
  }

  async updateKnowledgeNode(
    _id: string,
    updates: Partial<KnowledgeNode>,
  ): Promise<boolean> {
    const _node = this.knowledgeNodes.get(_id);
    if (!_node) {
      return false;
    }

    Object.assign(_node, updates);
    node.lastAccessed = new Date();
    this.conceptGraph.nodes.set(_id, _node);

    // Invalidate _related cache entries
    this.invalidateCache(`_node:${_id}`);

    return true;
  }

  // Concept Graph Management
  async addConceptEdge(
    sourceId: string,
    targetId: string,
    type: ConceptEdge["type"],
    weight: number = 1.0,
    _confidence: number = 0.8,
  ): Promise<ConceptEdge> {
    const edge: ConceptEdge = {
      id: `${sourceId}-${type}-${targetId}`,
      sourceId,
      targetId,
      type,
      weight,
      _confidence,
    };

    this.conceptGraph.edges.set(edge.id, edge);
    return edge;
  }

  async getRelatedConcepts(
    _nodeId: string,
    maxDepth: number = 2,
  ): Promise<KnowledgeNode[]> {
    const _cacheKey = `_related:${_nodeId}:${maxDepth}`;
    const _cached = this.cache.get(_cacheKey) as KnowledgeNode[];
    if (_cached) {
      return _cached;
    }

    const _related = new Set<string>();
    const _visited = new Set<string>();
    const queue: { id: string; depth: number }[] = [{ id: _nodeId, depth: 0 }];

    while (queue.length > 0) {
      const { id, depth } = queue.shift()!;

      if (_visited.has(id) || depth >= maxDepth) {
        continue;
      }
      visited.add(id);

      // Find all edges from this _node
      for (const edge of this.conceptGraph.edges.values()) {
        if (edge.sourceId === id && !_visited.has(edge.targetId)) {
          related.add(edge.targetId);
          queue.push({ id: edge.targetId, depth: depth + 1 });
        }
        if (edge.targetId === id && !_visited.has(edge.sourceId)) {
          related.add(edge.sourceId);
          queue.push({ id: edge.sourceId, depth: depth + 1 });
        }
      }
    }

    const _results = Array.from(_related)
      .map((id) => this.knowledgeNodes.get(id))
      .filter((_node): _node is KnowledgeNode => _node !== undefined);

    this.cache.set(_cacheKey, _results);
    return _results;
  }

  // Pattern Management
  async addCodePattern(
    _pattern: Omit<CodePattern, "id">,
  ): Promise<CodePattern> {
    const codePattern: CodePattern = {
      id: this.generatePatternId(_pattern.name),
      ..._pattern,
    };

    this.patternLibrary.codePatterns.push(codePattern);
    return codePattern;
  }

  async findCodePatterns(
    language?: string,
    framework?: string,
    useCase?: string,
    limit: number = 10,
  ): Promise<CodePattern[]> {
    const _cacheKey = `_patterns:${language}:${framework}:${useCase}:${limit}`;
    const _cached = this.cache.get(_cacheKey) as CodePattern[];
    if (_cached) {
      return _cached;
    }

    let _patterns = this.patternLibrary.codePatterns;

    if (language) {
      _patterns = _patterns.filter((p) => p.language === language);
    }
    if (framework) {
      _patterns = _patterns.filter((p) => p.framework === framework);
    }
    if (useCase) {
      _patterns = _patterns.filter((p) =>
        p.useCase.toLowerCase().includes(useCase.toLowerCase()),
      );
    }

    const _results = _patterns
      .sort((a, b) => {
        // Prioritize by complexity (beginner first) and performance
        const _complexityWeight = { beginner: 3, intermediate: 2, advanced: 1 };
        return (
          (_complexityWeight[a.complexity] || 0) -
          (_complexityWeight[b.complexity] || 0)
        );
      })
      .slice(0, limit);

    this.cache.set(_cacheKey, _results);
    return _results;
  }

  async addAntiPattern(
    _antiPattern: Omit<AntiPattern, "id">,
  ): Promise<AntiPattern> {
    const _pattern: AntiPattern = {
      id: this.generatePatternId(_antiPattern.name),
      ..._antiPattern,
    };

    this.patternLibrary.antiPatterns.push(_pattern);
    return _pattern;
  }

  async detectAntiPatterns(code: string): Promise<AntiPattern[]> {
    const detected: AntiPattern[] = [];

    for (const antiPattern of this.patternLibrary.antiPatterns) {
      for (const rule of antiPattern.detectionRules) {
        try {
          const _regex = new RegExp(rule.pattern, "gi");
          if (_regex.test(code)) {
            detected.push(antiPattern);
            break; // One detection per anti-_pattern
          }
        } catch (_error) {
          console.warn(`Invalid _regex _pattern: ${rule.pattern}`, _error);
        }
      }
    }

    return detected.sort((a, b) => {
      const _severityWeight = { critical: 4, high: 3, medium: 2, low: 1 };
      return (
        (_severityWeight[b.severity] || 0) - (_severityWeight[a.severity] || 0)
      );
    });
  }

  // Interaction History Management
  async recordSession(session: SessionRecord): Promise<void> {
    this.interactionHistory.sessions.push(session);

    // Update command frequencies
    for (const command of session.commands) {
      await this.updateCommandHistory(command);
    }

    // Detect new usage _patterns
    await this.detectUsagePatterns();

    // Limit history size
    if (this.interactionHistory.sessions.length > 1000) {
      this.interactionHistory.sessions =
        this.interactionHistory.sessions.slice(-500);
    }
  }

  async updateCommandHistory(command: string): Promise<void> {
    let commandHist = this.interactionHistory.commands.find(
      (c) => c.command === command,
    );

    if (!commandHist) {
      commandHist = {
        command,
        _frequency: 0,
        lastUsed: new Date(),
        successRate: 1.0,
        averageExecutionTime: 0,
        userSatisfaction: 0.8,
      };
      this.interactionHistory.commands.push(commandHist);
    }

    commandHist.frequency++;
    commandHist.lastUsed = new Date();
  }

  async getFrequentCommands(limit: number = 10): Promise<CommandHistory[]> {
    return this.interactionHistory.commands
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, limit);
  }

  async getRecentCommands(limit: number = 10): Promise<CommandHistory[]> {
    return this.interactionHistory.commands
      .sort((a, b) => b.lastUsed.getTime() - a.lastUsed.getTime())
      .slice(0, limit);
  }

  // User Preferences Management
  async updateUserPreferences(
    updates: Partial<UserPreferenceSet>,
  ): Promise<void> {
    Object.assign(this.userPreferences, updates);
    this.invalidateCache("preferences");
  }

  async getUserPreference<K extends keyof UserPreferenceSet>(
    key: K,
  ): Promise<UserPreferenceSet[K]> {
    return this.userPreferences[key];
  }

  // Memory Event Processing
  async processMemoryEvent(event: MemoryEvent): Promise<void> {
    switch (event.type) {
      case "code_generation":
        await this.processCodeGenerationEvent(event);
        break;
      case "pattern_recognition":
        await this.processPatternRecognitionEvent(event);
        break;
      case "learning_update":
        await this.processLearningUpdateEvent(event);
        break;
      default:
        // Store for potential System 2 processing
        break;
    }

    // Update access _patterns
    this.lastAccessTimes.set(event.id, new Date());
  }

  // Performance Optimization
  async cleanupLeastUsedNodes(): Promise<void> {
    const _nodeEntries = Array.from(this.knowledgeNodes.entries());
    const _sortedByUsage = _nodeEntries.sort((a, b) => {
      const _aScore = this.calculateUsageScore(a[1]);
      const _bScore = this.calculateUsageScore(b[1]);
      return _aScore - _bScore;
    });

    // Remove least used 10%
    const _removeCount = Math.floor(this.config.maxKnowledgeNodes * 0.1);
    for (let i = 0; i < _removeCount && i < _sortedByUsage.length; i++) {
      const _entry = _sortedByUsage[i];
      if (_entry) {
        const [nodeId] = _entry;
        this.knowledgeNodes.delete(nodeId);
        this.conceptGraph.nodes.delete(nodeId);
        this.invalidateCache(`_node:${nodeId}`);
      }
    }
  }

  async compressMemory(): Promise<void> {
    // Compress old interaction history
    const _cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days
    this.interactionHistory.sessions = this.interactionHistory.sessions.filter(
      (session) => session.startTime > _cutoffDate,
    );

    // Merge _similar _patterns
    await this.mergeimilarPatterns();

    // Clear old cache entries
    this.cache.clear();
  }

  // Private Helper Methods
  private generateNodeId(_type: string, name: string): string {
    return `${_type}:${name}:${Date.now()}`;
  }

  private generatePatternId(name: string): string {
    return `_pattern:${name}:${Date.now()}`;
  }

  private calculateCosineSimilarity(_a: number[], b: number[]): number {
    if (_a.length !== b.length) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < _a.length && i < b.length; i++) {
      const _aVal = _a[i] ?? 0;
      const _bVal = b[i] ?? 0;
      dotProduct += _aVal * _bVal;
      normA += _aVal * _aVal;
      normB += _bVal * _bVal;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private applyAccessDecay(_node: KnowledgeNode): void {
    const _daysSinceAccess =
      (Date.now() - _node.lastAccessed.getTime()) / (1000 * 60 * 60 * 24);
    const _decayFactor = Math.exp(
      -this.config.accessDecayRate * _daysSinceAccess,
    );
    _node.confidence *= _decayFactor;

    // Minimum _confidence threshold
    _node.confidence = Math.max(_node.confidence, 0.1);
  }

  private calculateUsageScore(_node: KnowledgeNode): number {
    const _recency =
      (Date.now() - _node.lastAccessed.getTime()) / (1000 * 60 * 60 * 24);
    const _frequency = Math.log(_node.accessCount + 1);
    const _confidence = _node._confidence;
    const _quality = _node.metadata._quality;

    return (_frequency + _confidence + _quality) / (1 + _recency * 0.1);
  }

  private invalidateCache(_pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(_pattern)) {
        this.cache.delete(key);
      }
    }
  }

  private async detectUsagePatterns(): Promise<void> {
    // Analyze recent sessions for _patterns
    const _recentSessions = this.interactionHistory.sessions.slice(-20); // Last 20 sessions

    // Detect temporal _patterns
    const _hourlyUsage = new Map<number, number>();
    for (const session of _recentSessions) {
      const _hour = session.startTime.getHours();
      _hourlyUsage.set(_hour, (_hourlyUsage.get(_hour) || 0) + 1);
    }

    // Detect command _sequences
    const _sequences = new Map<string, number>();
    for (const session of _recentSessions) {
      for (let i = 0; i < session.commands.length - 1; i++) {
        const _sequence = `${session.commands[i]} -> ${session.commands[i + 1]}`;
        _sequences.set(_sequence, (_sequences.get(_sequence) || 0) + 1);
      }
    }

    // Store significant _patterns
    for (const [_sequence, _frequency] of _sequences.entries()) {
      if (_frequency >= 3) {
        // Threshold for _pattern significance
        const _pattern: UsagePattern = {
          id: `seq:${_sequence}:${Date.now()}`,
          type: "sequential",
          _pattern: _sequence,
          _frequency,
          _confidence: Math.min(_frequency / 10, 1.0),
          conditions: [],
        };

        this.interactionHistory.patterns.push(_pattern);
      }
    }
  }

  private async processCodeGenerationEvent(event: MemoryEvent): Promise<void> {
    // Extract code _patterns from generation events
    const _data = event._data as {
      code?: string;
      language?: string;
      context?: string;
    };

    if (_data.code && _data.language) {
      // Simple _pattern extraction (in production, use AST analysis)
      const _patterns = this.extractCodePatterns(_data.code, _data.language);

      for (const _pattern of _patterns) {
        await this.addCodePattern(_pattern);
      }
    }
  }

  private async processPatternRecognitionEvent(
    event: MemoryEvent,
  ): Promise<void> {
    // Update _pattern _confidence based on recognition success
    const _data = event._data as { patternId?: string; success?: boolean };

    if (_data.patternId) {
      const _pattern = this.patternLibrary.codePatterns.find(
        (p) => p.id === _data.patternId,
      );
      if (_pattern && _data.success !== undefined) {
        // Adjust _pattern effectiveness based on usage success
        const _adjustment = _data.success ? 0.1 : -0.05;
        // Update _pattern performance metrics
        console.log(`Pattern ${_data.patternId} _adjustment: ${_adjustment}`);
      }
    }
  }

  private async processLearningUpdateEvent(event: MemoryEvent): Promise<void> {
    // Update user preferences based on learning events
    const _data = event._data as {
      preference?: string;
      value?: unknown;
      _confidence?: number;
    };

    if (_data.preference && _data.value !== undefined) {
      // Update user preferences with new learning
      await this.adaptUserPreferences(
        _data.preference,
        _data.value,
        _data.confidence || 0.8,
      );
    }
  }

  private extractCodePatterns(
    _code: string,
    language: string,
  ): Omit<CodePattern, "id">[] {
    // Simplified _pattern extraction
    const _patterns: Omit<CodePattern, "id">[] = [];

    // Function _pattern detection
    const _functionRegex = /function\s+(\w+)\s*\([^)]*\)\s*{[^}]+}/g;
    let match;

    while ((match = _functionRegex.exec(_code)) !== null) {
      patterns.push({
        name: `Function: ${match[1]}`,
        description: `Function _pattern extracted from _code`,
        code: match[0],
        language,
        useCase: "Function definition",
        complexity: "intermediate",
        performance: {
          timeComplexity: "O(1)",
          spaceComplexity: "O(1)",
        },
        examples: [],
      });
    }

    return _patterns;
  }

  private async adaptUserPreferences(
    preference: string,
    value: unknown,
    _confidence: number,
  ): Promise<void> {
    // Adapt user preferences based on observed behavior
    // This would integrate with the learning engine
    console.log(
      `Adapting preference ${preference} to ${value} (_confidence: ${_confidence})`,
    );
  }

  private async mergeimilarPatterns(): Promise<void> {
    // Merge _patterns with high similarity to reduce redundancy
    const _patterns = this.patternLibrary.codePatterns;
    const merged: CodePattern[] = [];
    const _processed = new Set<string>();

    for (let i = 0; i < _patterns.length; i++) {
      const _currentPattern = _patterns[i];
      if (!_currentPattern || _processed.has(_currentPattern.id)) {
        continue;
      }

      const _similar = _patterns
        .slice(i + 1)
        .filter(
          (p) =>
            p &&
            !_processed.has(p.id) &&
            p.language === _currentPattern.language &&
            this.calculatePatternSimilarity(_currentPattern, p) > 0.8,
        );

      if (_similar.length > 0) {
        // Merge _similar _patterns
        const _mergedPattern = this.mergePatterns(_currentPattern, _similar);
        merged.push(_mergedPattern);

        processed.add(_currentPattern.id);
        similar.forEach((p) => _processed.add(p.id));
      } else {
        merged.push(_currentPattern);
        processed.add(_currentPattern.id);
      }
    }

    this.patternLibrary.codePatterns = merged;
  }

  private calculatePatternSimilarity(_a: CodePattern, b: CodePattern): number {
    // Simple similarity calculation based on name and use case
    const _namesSimilar =
      a.name.toLowerCase().includes(b.name.toLowerCase()) ||
      b.name.toLowerCase().includes(_a.name.toLowerCase());
    const _useCasesSimilar =
      _a.useCase.toLowerCase() === b.useCase.toLowerCase();

    return (_namesSimilar ? 0.5 : 0) + (_useCasesSimilar ? 0.5 : 0);
  }

  private mergePatterns(
    _primary: CodePattern,
    _similar: CodePattern[],
  ): CodePattern {
    // Merge multiple _similar _patterns into one
    return {
      ..._primary,
      description: `${_primary.description} (merged from ${_similar.length + 1} _patterns)`,
      examples: [..._primary.examples, ..._similar.flatMap((p) => p.examples)],
    };
  }

  private initializeDefaultPreferences(): UserPreferenceSet {
    return {
      developmentStyle: {
        approach: "iterative",
        preferredLanguages: [
          {
            language: "typescript",
            proficiency: "intermediate",
            _frequency: 0.8,
            preference: 4,
          },
          {
            language: "javascript",
            proficiency: "intermediate",
            _frequency: 0.6,
            preference: 3,
          },
        ],
        architecturalPatterns: [
          { name: "MVC", familiarity: 0.7, preference: 3, usageFrequency: 0.5 },
        ],
        problemSolvingStyle: "systematic",
        workPace: "moderate",
      },
      communicationPreferences: {
        verbosity: "moderate",
        explanationDepth: "intermediate",
        codeCommentStyle: "inline",
        feedbackStyle: "constructive",
      },
      toolPreferences: {
        ide: ["vscode", "webstorm"],
        frameworks: [
          {
            name: "react",
            category: "frontend",
            proficiency: 0.7,
            preference: 4,
          },
          {
            name: "express",
            category: "backend",
            proficiency: 0.6,
            preference: 3,
          },
        ],
        libraries: [
          {
            name: "lodash",
            category: "utility",
            proficiency: 0.8,
            preference: 4,
          },
        ],
        buildTools: ["webpack", "vite"],
        testingTools: ["jest", "vitest"],
      },
      learningStyle: {
        preferredMethods: [
          { type: "hands_on", effectiveness: 0.9, preference: 5 },
          { type: "visual", effectiveness: 0.7, preference: 4 },
        ],
        pace: "moderate",
        complexity: "simple_to_complex",
        feedback: "immediate",
      },
      qualityStandards: {
        codeQuality: [
          { metric: "maintainability", threshold: 80, priority: "high" },
          { metric: "readability", threshold: 75, priority: "high" },
        ],
        testCoverage: 80,
        documentation: {
          required: true,
          style: "standard",
          formats: ["markdown", "jsdoc"],
        },
        performance: {
          responseTime: 200,
          throughput: 1000,
          memoryUsage: 512,
          cpuUsage: 70,
        },
        security: {
          requirements: [
            {
              type: "authentication",
              description: "Secure auth required",
              severity: "high",
              mandatory: true,
            },
          ],
          compliance: [
            {
              name: "OWASP",
              version: "2021",
              requirements: ["Top 10 coverage"],
            },
          ],
          scanningEnabled: true,
        },
      },
    };
  }
}
