/**
 * MARIA Memory System - System 1 Memory Implementation
 * 
 * Fast, intuitive memory patterns for immediate responses
 * Handles programming concepts, code patterns, and user preferences
 */

import type {
  System1Memory,
  KnowledgeNode,
  ConceptGraph,
  ConceptEdge,
  ConceptCluster,
  InteractionHistory,
  SessionRecord,
  CommandHistory,
  UsagePattern,
  PatternLibrary,
  CodePattern,
  AntiPattern,
  BestPractice,
  CodeTemplate,
  UserPreferenceSet,
  System1Config,
  MemoryEvent,
  NodeMetadata
} from './types/memory-interfaces';

export class System1MemoryManager implements System1Memory {
  private knowledgeNodes: Map<string, KnowledgeNode> = new Map();
  private conceptGraph: ConceptGraph;
  private interactionHistory: InteractionHistory;
  private patternLibrary: PatternLibrary;
  private userPreferences: UserPreferenceSet;
  private config: System1Config;
  private cache: Map<string, unknown> = new Map();
  private lastAccessTimes: Map<string, Date> = new Map();

  constructor(config: System1Config) {
    this.config = config;
    this.conceptGraph = {
      nodes: new Map(),
      edges: new Map(),
      clusters: []
    };
    this.interactionHistory = {
      sessions: [],
      commands: [],
      patterns: []
    };
    this.patternLibrary = {
      codePatterns: [],
      antiPatterns: [],
      bestPractices: [],
      templates: []
    };
    this.userPreferences = this.initializeDefaultPreferences();
  }

  get programmingConcepts(): KnowledgeNode[] {
    return Array.from(this.knowledgeNodes.values())
      .filter(node => ['function', 'class', 'module', 'concept'].includes(node.type))
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
    type: KnowledgeNode['type'],
    name: string,
    content: string,
    embedding: number[],
    metadata: Partial<NodeMetadata> = {}
  ): Promise<KnowledgeNode> {
    const node: KnowledgeNode = {
      id: this.generateNodeId(type, name),
      type,
      name,
      content,
      embedding,
      confidence: 0.8,
      lastAccessed: new Date(),
      accessCount: 1,
      metadata: {
        complexity: 'medium',
        quality: 0.8,
        relevance: 0.8,
        ...metadata
      }
    };

    this.knowledgeNodes.set(node.id, node);
    this.conceptGraph.nodes.set(node.id, node);
    
    // Trigger cache cleanup if needed
    if (this.knowledgeNodes.size > this.config.maxKnowledgeNodes) {
      await this.cleanupLeastUsedNodes();
    }

    return node;
  }

  async getKnowledgeNode(id: string): Promise<KnowledgeNode | null> {
    const node = this.knowledgeNodes.get(id);
    if (node) {
      // Update access patterns for System 1 fast retrieval
      node.lastAccessed = new Date();
      node.accessCount++;
      this.lastAccessTimes.set(id, new Date());
      
      // Apply access decay
      this.applyAccessDecay(node);
    }
    return node || null;
  }

  async searchKnowledgeNodes(
    query: string,
    queryEmbedding: number[],
    limit: number = 10
  ): Promise<KnowledgeNode[]> {
    const cacheKey = `search:${query}:${limit}`;
    const cached = this.cache.get(cacheKey) as KnowledgeNode[];
    if (cached) {
      return cached;
    }

    const results = Array.from(this.knowledgeNodes.values())
      .map(node => ({
        node,
        similarity: this.calculateCosineSimilarity(queryEmbedding, node.embedding)
      }))
      .filter(({ similarity }) => similarity > 0.5)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
      .map(({ node }) => node);

    // Cache results for fast subsequent access
    this.cache.set(cacheKey, results);
    return results;
  }

  async updateKnowledgeNode(id: string, updates: Partial<KnowledgeNode>): Promise<boolean> {
    const node = this.knowledgeNodes.get(id);
    if (!node) return false;

    Object.assign(node, updates);
    node.lastAccessed = new Date();
    this.conceptGraph.nodes.set(id, node);
    
    // Invalidate related cache entries
    this.invalidateCache(`node:${id}`);
    
    return true;
  }

  // Concept Graph Management
  async addConceptEdge(
    sourceId: string,
    targetId: string,
    type: ConceptEdge['type'],
    weight: number = 1.0,
    confidence: number = 0.8
  ): Promise<ConceptEdge> {
    const edge: ConceptEdge = {
      id: `${sourceId}-${type}-${targetId}`,
      sourceId,
      targetId,
      type,
      weight,
      confidence
    };

    this.conceptGraph.edges.set(edge.id, edge);
    return edge;
  }

  async getRelatedConcepts(nodeId: string, maxDepth: number = 2): Promise<KnowledgeNode[]> {
    const cacheKey = `related:${nodeId}:${maxDepth}`;
    const cached = this.cache.get(cacheKey) as KnowledgeNode[];
    if (cached) {
      return cached;
    }

    const related = new Set<string>();
    const visited = new Set<string>();
    const queue: { id: string; depth: number }[] = [{ id: nodeId, depth: 0 }];

    while (queue.length > 0) {
      const { id, depth } = queue.shift()!;
      
      if (visited.has(id) || depth >= maxDepth) continue;
      visited.add(id);

      // Find all edges from this node
      for (const edge of this.conceptGraph.edges.values()) {
        if (edge.sourceId === id && !visited.has(edge.targetId)) {
          related.add(edge.targetId);
          queue.push({ id: edge.targetId, depth: depth + 1 });
        }
        if (edge.targetId === id && !visited.has(edge.sourceId)) {
          related.add(edge.sourceId);
          queue.push({ id: edge.sourceId, depth: depth + 1 });
        }
      }
    }

    const results = Array.from(related)
      .map(id => this.knowledgeNodes.get(id))
      .filter((node): node is KnowledgeNode => node !== undefined);

    this.cache.set(cacheKey, results);
    return results;
  }

  // Pattern Management
  async addCodePattern(pattern: Omit<CodePattern, 'id'>): Promise<CodePattern> {
    const codePattern: CodePattern = {
      id: this.generatePatternId(pattern.name),
      ...pattern
    };

    this.patternLibrary.codePatterns.push(codePattern);
    return codePattern;
  }

  async findCodePatterns(
    language?: string,
    framework?: string,
    useCase?: string,
    limit: number = 10
  ): Promise<CodePattern[]> {
    const cacheKey = `patterns:${language}:${framework}:${useCase}:${limit}`;
    const cached = this.cache.get(cacheKey) as CodePattern[];
    if (cached) {
      return cached;
    }

    let patterns = this.patternLibrary.codePatterns;

    if (language) {
      patterns = patterns.filter(p => p.language === language);
    }
    if (framework) {
      patterns = patterns.filter(p => p.framework === framework);
    }
    if (useCase) {
      patterns = patterns.filter(p => 
        p.useCase.toLowerCase().includes(useCase.toLowerCase())
      );
    }

    const results = patterns
      .sort((a, b) => {
        // Prioritize by complexity (beginner first) and performance
        const complexityWeight = { beginner: 3, intermediate: 2, advanced: 1 };
        return (complexityWeight[a.complexity] || 0) - (complexityWeight[b.complexity] || 0);
      })
      .slice(0, limit);

    this.cache.set(cacheKey, results);
    return results;
  }

  async addAntiPattern(antiPattern: Omit<AntiPattern, 'id'>): Promise<AntiPattern> {
    const pattern: AntiPattern = {
      id: this.generatePatternId(antiPattern.name),
      ...antiPattern
    };

    this.patternLibrary.antiPatterns.push(pattern);
    return pattern;
  }

  async detectAntiPatterns(code: string): Promise<AntiPattern[]> {
    const detected: AntiPattern[] = [];

    for (const antiPattern of this.patternLibrary.antiPatterns) {
      for (const rule of antiPattern.detectionRules) {
        try {
          const regex = new RegExp(rule.pattern, 'gi');
          if (regex.test(code)) {
            detected.push(antiPattern);
            break; // One detection per anti-pattern
          }
        } catch (error) {
          console.warn(`Invalid regex pattern: ${rule.pattern}`, error);
        }
      }
    }

    return detected.sort((a, b) => {
      const severityWeight = { critical: 4, high: 3, medium: 2, low: 1 };
      return (severityWeight[b.severity] || 0) - (severityWeight[a.severity] || 0);
    });
  }

  // Interaction History Management
  async recordSession(session: SessionRecord): Promise<void> {
    this.interactionHistory.sessions.push(session);
    
    // Update command frequencies
    for (const command of session.commands) {
      await this.updateCommandHistory(command);
    }

    // Detect new usage patterns
    await this.detectUsagePatterns();

    // Limit history size
    if (this.interactionHistory.sessions.length > 1000) {
      this.interactionHistory.sessions = this.interactionHistory.sessions.slice(-500);
    }
  }

  async updateCommandHistory(command: string): Promise<void> {
    let commandHist = this.interactionHistory.commands.find(c => c.command === command);
    
    if (!commandHist) {
      commandHist = {
        command,
        frequency: 0,
        lastUsed: new Date(),
        successRate: 1.0,
        averageExecutionTime: 0,
        userSatisfaction: 0.8
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
  async updateUserPreferences(updates: Partial<UserPreferenceSet>): Promise<void> {
    Object.assign(this.userPreferences, updates);
    this.invalidateCache('preferences');
  }

  async getUserPreference<K extends keyof UserPreferenceSet>(
    key: K
  ): Promise<UserPreferenceSet[K]> {
    return this.userPreferences[key];
  }

  // Memory Event Processing
  async processMemoryEvent(event: MemoryEvent): Promise<void> {
    switch (event.type) {
      case 'code_generation':
        await this.processCodeGenerationEvent(event);
        break;
      case 'pattern_recognition':
        await this.processPatternRecognitionEvent(event);
        break;
      case 'learning_update':
        await this.processLearningUpdateEvent(event);
        break;
      default:
        // Store for potential System 2 processing
        break;
    }

    // Update access patterns
    this.lastAccessTimes.set(event.id, new Date());
  }

  // Performance Optimization
  async cleanupLeastUsedNodes(): Promise<void> {
    const nodeEntries = Array.from(this.knowledgeNodes.entries());
    const sortedByUsage = nodeEntries.sort((a, b) => {
      const aScore = this.calculateUsageScore(a[1]);
      const bScore = this.calculateUsageScore(b[1]);
      return aScore - bScore;
    });

    // Remove least used 10%
    const removeCount = Math.floor(this.config.maxKnowledgeNodes * 0.1);
    for (let i = 0; i < removeCount; i++) {
      const [nodeId] = sortedByUsage[i];
      this.knowledgeNodes.delete(nodeId);
      this.conceptGraph.nodes.delete(nodeId);
      this.invalidateCache(`node:${nodeId}`);
    }
  }

  async compressMemory(): Promise<void> {
    // Compress old interaction history
    const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days
    this.interactionHistory.sessions = this.interactionHistory.sessions
      .filter(session => session.startTime > cutoffDate);

    // Merge similar patterns
    await this.mergeimilarPatterns();
    
    // Clear old cache entries
    this.cache.clear();
  }

  // Private Helper Methods
  private generateNodeId(type: string, name: string): string {
    return `${type}:${name}:${Date.now()}`;
  }

  private generatePatternId(name: string): string {
    return `pattern:${name}:${Date.now()}`;
  }

  private calculateCosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private applyAccessDecay(node: KnowledgeNode): void {
    const daysSinceAccess = (Date.now() - node.lastAccessed.getTime()) / (1000 * 60 * 60 * 24);
    const decayFactor = Math.exp(-this.config.accessDecayRate * daysSinceAccess);
    node.confidence *= decayFactor;
    
    // Minimum confidence threshold
    node.confidence = Math.max(node.confidence, 0.1);
  }

  private calculateUsageScore(node: KnowledgeNode): number {
    const recency = (Date.now() - node.lastAccessed.getTime()) / (1000 * 60 * 60 * 24);
    const frequency = Math.log(node.accessCount + 1);
    const confidence = node.confidence;
    const quality = node.metadata.quality;
    
    return (frequency + confidence + quality) / (1 + recency * 0.1);
  }

  private invalidateCache(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  private async detectUsagePatterns(): Promise<void> {
    // Analyze recent sessions for patterns
    const recentSessions = this.interactionHistory.sessions
      .slice(-20); // Last 20 sessions

    // Detect temporal patterns
    const hourlyUsage = new Map<number, number>();
    for (const session of recentSessions) {
      const hour = session.startTime.getHours();
      hourlyUsage.set(hour, (hourlyUsage.get(hour) || 0) + 1);
    }

    // Detect command sequences
    const sequences = new Map<string, number>();
    for (const session of recentSessions) {
      for (let i = 0; i < session.commands.length - 1; i++) {
        const sequence = `${session.commands[i]} -> ${session.commands[i + 1]}`;
        sequences.set(sequence, (sequences.get(sequence) || 0) + 1);
      }
    }

    // Store significant patterns
    for (const [sequence, frequency] of sequences.entries()) {
      if (frequency >= 3) { // Threshold for pattern significance
        const pattern: UsagePattern = {
          id: `seq:${sequence}:${Date.now()}`,
          type: 'sequential',
          pattern: sequence,
          frequency,
          confidence: Math.min(frequency / 10, 1.0),
          conditions: []
        };
        
        this.interactionHistory.patterns.push(pattern);
      }
    }
  }

  private async processCodeGenerationEvent(event: MemoryEvent): Promise<void> {
    // Extract code patterns from generation events
    const data = event.data as { code?: string; language?: string; context?: string };
    
    if (data.code && data.language) {
      // Simple pattern extraction (in production, use AST analysis)
      const patterns = this.extractCodePatterns(data.code, data.language);
      
      for (const pattern of patterns) {
        await this.addCodePattern(pattern);
      }
    }
  }

  private async processPatternRecognitionEvent(event: MemoryEvent): Promise<void> {
    // Update pattern confidence based on recognition success
    const data = event.data as { patternId?: string; success?: boolean };
    
    if (data.patternId) {
      const pattern = this.patternLibrary.codePatterns.find(p => p.id === data.patternId);
      if (pattern && data.success !== undefined) {
        // Adjust pattern effectiveness based on usage success
        const adjustment = data.success ? 0.1 : -0.05;
        // Update pattern performance metrics
      }
    }
  }

  private async processLearningUpdateEvent(event: MemoryEvent): Promise<void> {
    // Update user preferences based on learning events
    const data = event.data as { 
      preference?: string; 
      value?: unknown; 
      confidence?: number 
    };
    
    if (data.preference && data.value !== undefined) {
      // Update user preferences with new learning
      await this.adaptUserPreferences(data.preference, data.value, data.confidence || 0.8);
    }
  }

  private extractCodePatterns(code: string, language: string): Omit<CodePattern, 'id'>[] {
    // Simplified pattern extraction
    const patterns: Omit<CodePattern, 'id'>[] = [];
    
    // Function pattern detection
    const functionRegex = /function\s+(\w+)\s*\([^)]*\)\s*{[^}]+}/g;
    let match;
    
    while ((match = functionRegex.exec(code)) !== null) {
      patterns.push({
        name: `Function: ${match[1]}`,
        description: `Function pattern extracted from code`,
        code: match[0],
        language,
        useCase: 'Function definition',
        complexity: 'intermediate',
        performance: {
          timeComplexity: 'O(1)',
          spaceComplexity: 'O(1)'
        },
        examples: []
      });
    }
    
    return patterns;
  }

  private async adaptUserPreferences(
    preference: string, 
    value: unknown, 
    confidence: number
  ): Promise<void> {
    // Adapt user preferences based on observed behavior
    // This would integrate with the learning engine
    console.log(`Adapting preference ${preference} to ${value} (confidence: ${confidence})`);
  }

  private async mergeimilarPatterns(): Promise<void> {
    // Merge patterns with high similarity to reduce redundancy
    const patterns = this.patternLibrary.codePatterns;
    const merged: CodePattern[] = [];
    const processed = new Set<string>();
    
    for (let i = 0; i < patterns.length; i++) {
      if (processed.has(patterns[i].id)) continue;
      
      const similar = patterns.slice(i + 1).filter(p => 
        !processed.has(p.id) && 
        p.language === patterns[i].language &&
        this.calculatePatternSimilarity(patterns[i], p) > 0.8
      );
      
      if (similar.length > 0) {
        // Merge similar patterns
        const mergedPattern = this.mergePatterns(patterns[i], similar);
        merged.push(mergedPattern);
        
        processed.add(patterns[i].id);
        similar.forEach(p => processed.add(p.id));
      } else {
        merged.push(patterns[i]);
        processed.add(patterns[i].id);
      }
    }
    
    this.patternLibrary.codePatterns = merged;
  }

  private calculatePatternSimilarity(a: CodePattern, b: CodePattern): number {
    // Simple similarity calculation based on name and use case
    const namesSimilar = a.name.toLowerCase().includes(b.name.toLowerCase()) ||
                        b.name.toLowerCase().includes(a.name.toLowerCase());
    const useCasesSimilar = a.useCase.toLowerCase() === b.useCase.toLowerCase();
    
    return (namesSimilar ? 0.5 : 0) + (useCasesSimilar ? 0.5 : 0);
  }

  private mergePatterns(primary: CodePattern, similar: CodePattern[]): CodePattern {
    // Merge multiple similar patterns into one
    return {
      ...primary,
      description: `${primary.description} (merged from ${similar.length + 1} patterns)`,
      examples: [
        ...primary.examples,
        ...similar.flatMap(p => p.examples)
      ]
    };
  }

  private initializeDefaultPreferences(): UserPreferenceSet {
    return {
      developmentStyle: {
        approach: 'iterative',
        preferredLanguages: [
          { language: 'typescript', proficiency: 'intermediate', frequency: 0.8, preference: 4 },
          { language: 'javascript', proficiency: 'intermediate', frequency: 0.6, preference: 3 }
        ],
        architecturalPatterns: [
          { name: 'MVC', familiarity: 0.7, preference: 3, usageFrequency: 0.5 }
        ],
        problemSolvingStyle: 'systematic',
        workPace: 'moderate'
      },
      communicationPreferences: {
        verbosity: 'moderate',
        explanationDepth: 'intermediate',
        codeCommentStyle: 'inline',
        feedbackStyle: 'constructive'
      },
      toolPreferences: {
        ide: ['vscode', 'webstorm'],
        frameworks: [
          { name: 'react', category: 'frontend', proficiency: 0.7, preference: 4 },
          { name: 'express', category: 'backend', proficiency: 0.6, preference: 3 }
        ],
        libraries: [
          { name: 'lodash', category: 'utility', proficiency: 0.8, preference: 4 }
        ],
        buildTools: ['webpack', 'vite'],
        testingTools: ['jest', 'vitest']
      },
      learningStyle: {
        preferredMethods: [
          { type: 'hands_on', effectiveness: 0.9, preference: 5 },
          { type: 'visual', effectiveness: 0.7, preference: 4 }
        ],
        pace: 'moderate',
        complexity: 'simple_to_complex',
        feedback: 'immediate'
      },
      qualityStandards: {
        codeQuality: [
          { metric: 'maintainability', threshold: 80, priority: 'high' },
          { metric: 'readability', threshold: 75, priority: 'high' }
        ],
        testCoverage: 80,
        documentation: {
          required: true,
          style: 'standard',
          formats: ['markdown', 'jsdoc']
        },
        performance: {
          responseTime: 200,
          throughput: 1000,
          memoryUsage: 512,
          cpuUsage: 70
        },
        security: {
          requirements: [
            { type: 'authentication', description: 'Secure auth required', severity: 'high', mandatory: true }
          ],
          compliance: [
            { name: 'OWASP', version: '2021', requirements: ['Top 10 coverage'] }
          ],
          scanningEnabled: true
        }
      }
    };
  }
}