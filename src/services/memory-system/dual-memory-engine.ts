/**
 * MARIA Memory System - Dual Memory Engine
 *
 * Core integration logic for System 1 (fast, intuitive) and System 2 (deliberate, analytical) memory
 * Orchestrates memory operations, layer selection, and cross-system optimization
 */

import { System1MemoryManager } from './system1-memory';
import { System2MemoryManager } from './system2-memory';
import type {
  MemoryEvent,
  System1Config,
  System2Config,
  CoordinatorConfig,
  PerformanceConfig,
  KnowledgeNode,
  ReasoningTrace,
  CodePattern,
  UserPreferenceSet,
  QualityMetrics,
  Enhancement,
} from './types/memory-interfaces';

export interface DualMemoryEngineConfig {
  system1: System1Config;
  system2: System2Config;
  coordinator: CoordinatorConfig;
  performance: PerformanceConfig;
}

export interface MemoryQuery {
  type: 'knowledge' | 'pattern' | 'reasoning' | 'quality' | 'preference';
  query: string;
  context?: Record<string, unknown>;
  urgency?: 'low' | 'medium' | 'high' | 'critical';
  embedding?: number[];
  limit?: number;
}

export interface MemoryResponse<T = unknown> {
  data: T;
  source: 'system1' | 'system2' | 'both';
  confidence: number;
  latency: number;
  cached: boolean;
  suggestions?: Enhancement[];
}

export interface MemoryOperationMetrics {
  totalOperations: number;
  system1Operations: number;
  system2Operations: number;
  averageLatency: number;
  cacheHitRate: number;
  errorRate: number;
  lastReset: Date;
}

export class DualMemoryEngine {
  private system1: System1MemoryManager;
  private system2: System2MemoryManager;
  private config: DualMemoryEngineConfig;
  private operationMetrics: MemoryOperationMetrics;
  private eventQueue: MemoryEvent[] = [];
  private processingLock = false;
  private performanceCache = new Map<string, { result: unknown; timestamp: Date; hits: number }>();

  constructor(config: DualMemoryEngineConfig) {
    if (!config) {
      throw new Error('DualMemoryEngine: config parameter is required');
    }

    if (!config.system1) {
      throw new Error('DualMemoryEngine: config.system1 is required');
    }

    if (!config.system2) {
      throw new Error('DualMemoryEngine: config.system2 is required');
    }

    this.config = config;
    this.system1 = new System1MemoryManager(config.system1);
    this.system2 = new System2MemoryManager(config.system2);
    this.operationMetrics = this.initializeMetrics();

    // Start background processing
    this.startBackgroundProcessing();
  }

  // ========== Core Memory Operations ==========

  async query<T = unknown>(memoryQuery: MemoryQuery): Promise<MemoryResponse<T>> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey(memoryQuery);

    // Check performance cache first
    const cached = this.performanceCache.get(cacheKey);
    if (cached && this.isCacheValid(cached)) {
      cached.hits++;
      this.operationMetrics.totalOperations++;
      return {
        data: cached.result as T,
        source: 'both',
        confidence: 0.9,
        latency: Date.now() - startTime,
        cached: true,
      };
    }

    try {
      // Determine optimal memory system(s) to use
      const strategy = await this.selectMemoryStrategy(memoryQuery);
      const result = await this.executeMemoryOperation<T>(memoryQuery, strategy);

      // Cache successful results
      if (result.confidence > 0.7) {
        this.performanceCache.set(cacheKey, {
          result: result.data,
          timestamp: new Date(),
          hits: 1,
        });
      }

      // Update metrics
      this.updateOperationMetrics(strategy, Date.now() - startTime, true);

      return result;
    } catch (error) {
      this.updateOperationMetrics('both', Date.now() - startTime, false);
      throw new Error(
        `Memory query failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async store(event: MemoryEvent): Promise<void> {
    // Add to event queue for processing
    this.eventQueue.push(event);

    // Immediate processing for critical events
    if (event.metadata.priority === 'critical') {
      await this.processEvent(event);
    }
  }

  async learn(
    input: string,
    output: string,
    context: Record<string, unknown>,
    success: boolean,
  ): Promise<void> {
    const learningEvent: MemoryEvent = {
      id: `learn:${Date.now()}`,
      type: 'learning_update',
      timestamp: new Date(),
      userId: (context['userId'] as string) || 'anonymous',
      sessionId: (context['sessionId'] as string) || 'default',
      data: { input, output, context, success },
      metadata: {
        confidence: success ? 0.9 : 0.3,
        source: 'user_input',
        priority: 'medium',
        tags: ['learning', 'adaptation'],
      },
    };

    await this.store(learningEvent);
  }

  // ========== Specialized Query Methods ==========

  async findKnowledge(
    query: string,
    embedding?: number[],
    limit: number = 10,
  ): Promise<MemoryResponse<KnowledgeNode[]>> {
    return this.query<KnowledgeNode[]>({
      type: 'knowledge',
      query,
      embedding,
      limit,
      urgency: 'medium',
    });
  }

  async findPatterns(
    language?: string,
    framework?: string,
    useCase?: string,
    limit: number = 10,
  ): Promise<MemoryResponse<CodePattern[]>> {
    return this.query<CodePattern[]>({
      type: 'pattern',
      query: `${language || ''} ${framework || ''} ${useCase || ''}`.trim(),
      context: { language, framework, useCase },
      limit,
      urgency: 'low',
    });
  }

  async getReasoning(
    domain?: string,
    complexity?: string,
    minQuality?: number,
  ): Promise<MemoryResponse<ReasoningTrace[]>> {
    return this.query<ReasoningTrace[]>({
      type: 'reasoning',
      query: `${domain || ''} ${complexity || ''}`.trim(),
      context: { domain, complexity, minQuality },
      urgency: 'low',
    });
  }

  async getQualityInsights(): Promise<MemoryResponse<QualityMetrics>> {
    return this.query<QualityMetrics>({
      type: 'quality',
      query: 'current quality metrics',
      urgency: 'low',
    });
  }

  async getUserPreferences(): Promise<MemoryResponse<UserPreferenceSet>> {
    return this.query<UserPreferenceSet>({
      type: 'preference',
      query: 'user preferences',
      urgency: 'high',
    });
  }

  async recall(options: { query: string; type: string; limit?: number }): Promise<unknown[]> {
    try {
      const result = await this.query({
        type: options.type as 'knowledge' | 'pattern' | 'reasoning' | 'quality' | 'preference',
        query: options.query,
        limit: options.limit || 10,
      });

      return Array.isArray(result.data) ? result.data : [result.data];
    } catch (error) {
      console.warn('Memory recall failed:', error);
      return [];
    }
  }

  async clearMemory(): Promise<void> {
    try {
      // Clear all internal caches and data
      this.performanceCache.clear();
      this.eventQueue.length = 0;

      // Reset metrics
      this.resetMetrics();

      console.log('Memory cleared successfully');
    } catch (error) {
      console.error('Failed to clear memory:', error);
      throw error;
    }
  }

  // ========== Memory Strategy Selection ==========

  private async selectMemoryStrategy(query: MemoryQuery): Promise<'system1' | 'system2' | 'both'> {
    const factors = {
      urgency: this.getUrgencyScore(query.urgency),
      complexity: this.assessQueryComplexity(query),
      type: this.getTypePreference(query.type),
      cacheStatus: this.getCacheStatus(query),
    };

    const system1Score = this.calculateSystem1Score(factors);
    const system2Score = this.calculateSystem2Score(factors);

    // Decision logic based on configuration
    switch (this.config.coordinator.conflictResolutionStrategy) {
      case 'system1_priority':
        return system1Score > 0.6 ? 'system1' : 'both';

      case 'system2_priority':
        return system2Score > 0.6 ? 'system2' : 'both';

      case 'balanced':
      default:
        if (Math.abs(system1Score - system2Score) < 0.2) {
          return 'both';
        }
        return system1Score > system2Score ? 'system1' : 'system2';
    }
  }

  private getUrgencyScore(urgency?: string): number {
    switch (urgency) {
      case 'critical':
        return 1.0;
      case 'high':
        return 0.8;
      case 'medium':
        return 0.5;
      case 'low':
        return 0.2;
      default:
        return 0.5;
    }
  }

  private assessQueryComplexity(query: MemoryQuery): number {
    let complexity = 0.3; // Base complexity

    // Query length factor
    if (query.query.length > 100) complexity += 0.2;
    if (query.query.length > 200) complexity += 0.2;

    // Context complexity
    if (query.context && Object.keys(query.context).length > 3) complexity += 0.2;

    // Type complexity
    switch (query.type) {
      case 'reasoning':
        complexity += 0.4;
        break;
      case 'quality':
        complexity += 0.3;
        break;
      case 'pattern':
        complexity += 0.2;
        break;
      case 'knowledge':
        complexity += 0.1;
        break;
      case 'preference':
        complexity += 0.0;
        break;
    }

    return Math.min(1.0, complexity);
  }

  private getTypePreference(type: string): { system1: number; system2: number } {
    switch (type) {
      case 'knowledge':
        return { system1: 0.8, system2: 0.3 };
      case 'pattern':
        return { system1: 0.9, system2: 0.2 };
      case 'preference':
        return { system1: 0.9, system2: 0.1 };
      case 'reasoning':
        return { system1: 0.2, system2: 0.9 };
      case 'quality':
        return { system1: 0.3, system2: 0.8 };
      default:
        return { system1: 0.5, system2: 0.5 };
    }
  }

  private getCacheStatus(query: MemoryQuery): number {
    const cacheKey = this.generateCacheKey(query);
    const cached = this.performanceCache.get(cacheKey);
    return cached ? 0.8 : 0.2;
  }

  private calculateSystem1Score(factors: RoutingFactors): number {
    const urgencyWeight = factors.urgency * 0.4;
    const complexityPenalty = (1 - factors.complexity) * 0.3;
    const typePreference = factors.type.system1 * 0.2;
    const cacheBonus = factors.cacheStatus * 0.1;

    return urgencyWeight + complexityPenalty + typePreference + cacheBonus;
  }

  private calculateSystem2Score(factors: RoutingFactors): number {
    const complexityBonus = factors.complexity * 0.4;
    const urgencyPenalty = (1 - factors.urgency) * 0.2;
    const typePreference = factors.type.system2 * 0.3;
    const qualityBonus = 0.1; // Always slight preference for quality

    return complexityBonus + urgencyPenalty + typePreference + qualityBonus;
  }

  // ========== Memory Operation Execution ==========

  private async executeMemoryOperation<T>(
    query: MemoryQuery,
    strategy: 'system1' | 'system2' | 'both',
  ): Promise<MemoryResponse<T>> {
    switch (strategy) {
      case 'system1':
        return this.executeSystem1Operation(query);

      case 'system2':
        return this.executeSystem2Operation(query);

      case 'both':
        return this.executeCombinedOperation(query);

      default:
        throw new Error(`Unknown strategy: ${strategy}`);
    }
  }

  private async executeSystem1Operation<T>(query: MemoryQuery): Promise<MemoryResponse<T>> {
    const startTime = Date.now();
    let result: T;

    switch (query.type) {
      case 'knowledge':
        result = (await this.system1.searchKnowledgeNodes(
          query.query,
          query.embedding || [],
          query.limit,
        )) as T;
        break;

      case 'pattern': {
        const { language, framework, useCase } = query.context || {};
        result = (await this.system1.findCodePatterns(
          language as string,
          framework as string,
          useCase as string,
          query.limit,
        )) as T;
        break;
      }

      case 'preference':
        result = (await this.system1.getUserPreference('learningStyle')) as T;
        break;

      default:
        throw new Error(`System 1 cannot handle query type: ${query.type}`);
    }

    return {
      data: result,
      source: 'system1',
      confidence: 0.8,
      latency: Date.now() - startTime,
      cached: false,
    };
  }

  private async executeSystem2Operation<T>(query: MemoryQuery): Promise<MemoryResponse<T>> {
    const startTime = Date.now();
    let result: T;

    switch (query.type) {
      case 'reasoning': {
        const { domain, complexity, minQuality } = query.context || {};
        result = (await this.system2.searchReasoningTraces(
          {
            domain: domain as string,
            complexity: complexity as string,
            minQuality: minQuality as number,
          },
          query.limit,
        )) as T;
        break;
      }

      case 'quality':
        result = this.system2.qualityEvaluation as T;
        break;

      default:
        throw new Error(`System 2 cannot handle query type: ${query.type}`);
    }

    return {
      data: result,
      source: 'system2',
      confidence: 0.9,
      latency: Date.now() - startTime,
      cached: false,
    };
  }

  private async executeCombinedOperation<T>(query: MemoryQuery): Promise<MemoryResponse<T>> {
    const startTime = Date.now();

    try {
      // Execute both systems in parallel
      const [system1Result, system2Result] = await Promise.allSettled([
        this.executeSystem1Operation<T>(query).catch(() => null),
        this.executeSystem2Operation<T>(query).catch(() => null),
      ]);

      // Combine results intelligently
      const combinedResult = this.combineResults(query, system1Result, system2Result);

      return {
        data: combinedResult.data,
        source: 'both',
        confidence: combinedResult.confidence,
        latency: Date.now() - startTime,
        cached: false,
        suggestions: combinedResult.suggestions,
      };
    } catch (error) {
      // Fallback to the most appropriate single system
      const fallbackStrategy =
        query.type === 'reasoning' || query.type === 'quality' ? 'system2' : 'system1';
      return this.executeMemoryOperation(query, fallbackStrategy);
    }
  }

  private combineResults<T>(
    query: MemoryQuery,
    system1Result: PromiseSettledResult<MemoryResponse<T> | null>,
    system2Result: PromiseSettledResult<MemoryResponse<T> | null>,
  ): { data: T; confidence: number; suggestions?: Enhancement[] } {
    const s1Data = system1Result.status === 'fulfilled' ? system1Result.value?.data : null;
    const s2Data = system2Result.status === 'fulfilled' ? system2Result.value?.data : null;

    // Priority-based combination
    if (s2Data && s1Data) {
      // Both available - use System 2 for complex queries, System 1 for simple ones
      const useSystem2 = this.assessQueryComplexity(query) > 0.6;
      return {
        data: useSystem2 ? s2Data : s1Data,
        confidence: 0.95,
        suggestions: this.generateCombinedSuggestions(s1Data, s2Data),
      };
    }

    if (s1Data) {
      return { data: s1Data, confidence: 0.8 };
    }

    if (s2Data) {
      return { data: s2Data, confidence: 0.85 };
    }

    // No results available
    throw new Error('No memory systems could provide results');
  }

  private generateCombinedSuggestions<T>(_s1Data: T, _s2Data: T): Enhancement[] {
    // Generate suggestions based on the combination of results
    return [
      {
        id: `suggestion:${Date.now()}`,
        type: 'performance',
        description: 'Consider using cached results for similar queries',
        impact: {
          benefitScore: 6,
          effortScore: 3,
          riskScore: 1,
          affectedUsers: 1,
          affectedComponents: ['memory-system'],
        },
        implementation: {
          phases: [],
          timeline: 2,
          resources: [],
          dependencies: [],
          risks: [],
        },
        priority: 5,
        status: 'proposed',
      },
    ];
  }

  // ========== Event Processing ==========

  private async processEvent(event: MemoryEvent): Promise<void> {
    try {
      // Route event to appropriate memory systems
      const routingStrategy = this.determineEventRouting(event);

      await Promise.all([
        routingStrategy.system1 ? this.system1.processMemoryEvent(event) : Promise.resolve(),
        routingStrategy.system2 ? this.system2.processMemoryEvent(event) : Promise.resolve(),
      ]);

      // Cross-system learning and adaptation
      await this.adaptFromEvent(event);
    } catch (error) {
      console.error(`Error processing memory event ${event.id}:`, error);
    }
  }

  private determineEventRouting(event: MemoryEvent): { system1: boolean; system2: boolean } {
    switch (event.type) {
      case 'code_generation':
      case 'pattern_recognition':
        return { system1: true, system2: false };

      case 'bug_fix':
      case 'quality_improvement':
        return { system1: false, system2: true };

      case 'learning_update':
      case 'mode_change':
        return { system1: true, system2: true };

      default:
        return { system1: true, system2: false };
    }
  }

  private async adaptFromEvent(event: MemoryEvent): Promise<void> {
    // Cross-system learning based on events
    if (event.type === 'learning_update') {
      const data = event.data as { success?: boolean; input?: string; output?: string };

      if (data.success === false) {
        // Generate improvement suggestion
        await this.system2.proposeEnhancement({
          type: 'usability',
          description: `Improve handling of: ${data.input}`,
          impact: {
            benefitScore: 5,
            effortScore: 3,
            riskScore: 2,
            affectedUsers: 1,
            affectedComponents: ['ai-interaction'],
          },
          implementation: {
            phases: [],
            timeline: 3,
            resources: [],
            dependencies: [],
            risks: [],
          },
          priority: 4,
        });
      }
    }
  }

  // ========== Background Processing ==========

  private startBackgroundProcessing(): void {
    // Process event queue regularly
    setInterval(() => {
      this.processEventQueue();
    }, this.config.coordinator.syncInterval);

    // Clean up cache periodically
    setInterval(
      () => {
        this.cleanupCache();
      },
      5 * 60 * 1000,
    ); // Every 5 minutes

    // Memory optimization
    setInterval(
      () => {
        this.optimizeMemory();
      },
      15 * 60 * 1000,
    ); // Every 15 minutes
  }

  private async processEventQueue(): Promise<void> {
    if (this.processingLock || this.eventQueue.length === 0) {
      return;
    }

    this.processingLock = true;

    try {
      // Process events in batches
      const batchSize = this.config.performance.batchSize;
      const batch = this.eventQueue.splice(0, batchSize);

      await Promise.all(batch.map((event) => this.processEvent(event)));
    } finally {
      this.processingLock = false;
    }
  }

  private cleanupCache(): void {
    const now = new Date();
    const maxAge = 30 * 60 * 1000; // 30 minutes

    for (const [key, cached] of this.performanceCache.entries()) {
      const age = now.getTime() - cached.timestamp.getTime();

      if (age > maxAge || cached.hits < 2) {
        this.performanceCache.delete(key);
      }
    }
  }

  private async optimizeMemory(): Promise<void> {
    try {
      // System 1 optimization
      await this.system1.compressMemory();

      // Cache optimization
      if (this.performanceCache.size > 1000) {
        const entries = Array.from(this.performanceCache.entries());
        const sortedByUsage = entries.sort((a, b) => b[1].hits - a[1].hits);

        // Keep top 500 most used entries
        this.performanceCache.clear();
        sortedByUsage.slice(0, 500).forEach(([key, value]) => {
          this.performanceCache.set(key, value);
        });
      }
    } catch (error) {
      console.error('Memory optimization failed:', error);
    }
  }

  // ========== Utility Methods ==========

  private generateCacheKey(query: MemoryQuery): string {
    const contextStr = query.context ? JSON.stringify(query.context) : '';
    const embeddingStr = query.embedding ? query.embedding.slice(0, 5).join(',') : '';

    return `${query.type}:${query.query}:${contextStr}:${embeddingStr}:${query.limit || 10}`;
  }

  private isCacheValid(cached: { timestamp: Date; hits: number }): boolean {
    const age = Date.now() - cached.timestamp.getTime();
    const maxAge = 10 * 60 * 1000; // 10 minutes

    return age < maxAge;
  }

  private updateOperationMetrics(
    strategy: 'system1' | 'system2' | 'both',
    latency: number,
    success: boolean,
  ): void {
    this.operationMetrics.totalOperations++;
    this.operationMetrics.averageLatency = (this.operationMetrics.averageLatency + latency) / 2;

    if (strategy === 'system1' || strategy === 'both') {
      this.operationMetrics.system1Operations++;
    }

    if (strategy === 'system2' || strategy === 'both') {
      this.operationMetrics.system2Operations++;
    }

    if (!success) {
      this.operationMetrics.errorRate =
        (this.operationMetrics.errorRate + 1) / this.operationMetrics.totalOperations;
    }
  }

  private initializeMetrics(): MemoryOperationMetrics {
    return {
      totalOperations: 0,
      system1Operations: 0,
      system2Operations: 0,
      averageLatency: 0,
      cacheHitRate: 0,
      errorRate: 0,
      lastReset: new Date(),
    };
  }

  // ========== Public API for Monitoring ==========

  getMetrics(): MemoryOperationMetrics {
    // Calculate cache hit rate
    const totalCacheAccess = Array.from(this.performanceCache.values()).reduce(
      (sum, cached) => sum + cached.hits,
      0,
    );

    this.operationMetrics.cacheHitRate =
      this.operationMetrics.totalOperations > 0
        ? totalCacheAccess / this.operationMetrics.totalOperations
        : 0;

    return { ...this.operationMetrics };
  }

  resetMetrics(): void {
    this.operationMetrics = this.initializeMetrics();
  }

  getCacheSize(): number {
    return this.performanceCache.size;
  }

  getQueueSize(): number {
    return this.eventQueue.length;
  }

  // ========== Initialization ==========

  async initialize(): Promise<void> {
    try {
      // Perform initialization logic
      this.resetMetrics();

      // Clear any existing cache
      this.performanceCache.clear();

      console.log('DualMemoryEngine initialized successfully');
    } catch (error) {
      console.error('Failed to initialize DualMemoryEngine:', error);
      throw error;
    }
  }

  // ========== Configuration Management ==========

  updateConfig(newConfig: Partial<DualMemoryEngineConfig>): void {
    Object.assign(this.config, newConfig);
  }

  getConfig(): DualMemoryEngineConfig {
    return { ...this.config };
  }

  async getStatistics(): Promise<{
    system1: {
      totalNodes: number;
      patterns: number;
      preferences: number;
      cacheHitRate: number;
    };
    system2: {
      reasoningTraces: number;
      decisionTrees: number;
      activeSessions: number;
      memoryUsage: number;
    };
  }> {
    try {
      const metrics = this.getMetrics();

      // Get system1 stats - using safe property access
      const system1Stats = {
        totalNodes: 0, // Will be populated when system1 interface is stable
        patterns: 0, // Will be populated when system1 interface is stable
        preferences: 0, // Will be populated when system1 interface is stable
        cacheHitRate: metrics.cacheHitRate || 0,
      };

      // Get system2 stats - using safe property access
      const system2Stats = {
        reasoningTraces: 0, // Will be populated when system2 interface is stable
        decisionTrees: 0, // Will be populated when system2 interface is stable
        activeSessions: 0, // Will be populated when system2 interface is stable
        memoryUsage: 0, // Will be populated when system2 interface is stable
      };

      return {
        system1: system1Stats,
        system2: system2Stats,
      };
    } catch (error) {
      // Return default stats if there's an error
      return {
        system1: {
          totalNodes: 0,
          patterns: 0,
          preferences: 0,
          cacheHitRate: 0,
        },
        system2: {
          reasoningTraces: 0,
          decisionTrees: 0,
          activeSessions: 0,
          memoryUsage: 0,
        },
      };
    }
  }
}

// Supporting interfaces
interface RoutingFactors {
  urgency: number;
  complexity: number;
  type: {
    system1: number;
    system2: number;
  };
  cacheStatus: number;
}
