/**
 * MARIA Memory System - Dual Memory Engine
 *
 * Core integration logic for System 1 (fast, intuitive) and System 2 (deliberate, analytical) memory
 * Orchestrates memory operations, layer selection, and cross-system optimization
 */

import { System1MemoryManager } from "./system1-memory";
import { System2MemoryManager } from "./system2-memory";
import type {
  CodePattern,
  CoordinatorConfig,
  Enhancement,
  KnowledgeNode,
  MemoryEvent,
  PerformanceConfig,
  QualityMetrics,
  ReasoningTrace,
  System1Config,
  System2Config,
  UserPreferenceSet,
} from "./types/memory-interfaces";

export interface DualMemoryEngineConfig {
  system1: System1Config;
  system2: System2Config;
  coordinator: CoordinatorConfig;
  performance: PerformanceConfig;
}

export interface MemoryQuery {
  type: "knowledge" | "pattern" | "reasoning" | "quality" | "preference";
  query: string;
  context?: Record<string, unknown>;
  urgency?: "low" | "medium" | "high" | "critical";
  embedding?: number[];
  limit?: number;
}

export interface MemoryResponse<T = unknown> {
  _data: T;
  source: "system1" | "system2" | "both";
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
  private performanceCache = new Map<
    string,
    { _result: unknown; timestamp: Date; hits: number }
  >();

  constructor(_config: DualMemoryEngineConfig) {
    if (!_config) {
      throw new Error("DualMemoryEngine: config parameter is required");
    }

    if (!_config.system1) {
      throw new Error("DualMemoryEngine: config.system1 is required");
    }

    if (!_config.system2) {
      throw new Error("DualMemoryEngine: config.system2 is required");
    }

    this.config = _config;
    this.system1 = new System1MemoryManager(_config.system1);
    this.system2 = new System2MemoryManager(_config.system2);
    this.operationMetrics = this.initializeMetrics();

    // Start background processing
    this.startBackgroundProcessing();
  }

  // ========== Core Memory Operations ==========

  async query<T = unknown>(
    memoryQuery: MemoryQuery,
  ): Promise<MemoryResponse<T>> {
    const _startTime = Date.now();
    const cacheKey = this.generateCacheKey(memoryQuery);

    // Check performance cache first
    const cached = this.performanceCache.get(cacheKey);
    if (cached && this.isCacheValid(cached)) {
      cached.hits++;
      this.operationMetrics.totalOperations++;
      return {
        _data: cached._result as T,
        source: "both",
        confidence: 0.9,
        latency: Date.now() - _startTime,
        cached: true,
      };
    }

    try {
      // Determine optimal memory system(s) to use
      const _strategy = await this.selectMemoryStrategy(memoryQuery);
      const _result = await this.executeMemoryOperation<T>(
        memoryQuery,
        _strategy,
      );

      // Cache successful results
      if (_result.confidence > 0.7) {
        this.performanceCache.set(cacheKey, {
          _result: _result._data,
          timestamp: new Date(),
          hits: 1,
        });
      }

      // Update _metrics
      this.updateOperationMetrics(_strategy, Date.now() - _startTime, true);

      return _result;
    } catch (_error) {
      this.updateOperationMetrics("both", Date.now() - _startTime, false);
      throw new Error(
        `Memory query failed: ${_error instanceof Error ? _error.message : "Unknown _error"}`,
      );
    }
  }

  async store(event: MemoryEvent): Promise<void> {
    // Add to event queue for processing
    this.eventQueue.push(event);

    // Immediate processing for critical events
    if (event.metadata.priority === "critical") {
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
      type: "learning_update",
      timestamp: new Date(),
      userId: (context["userId"] as string) || "anonymous",
      sessionId: (context["sessionId"] as string) || "default",
      _data: { input, output, context, success },
      metadata: {
        confidence: success ? 0.9 : 0.3,
        source: "user_input",
        priority: "medium",
        tags: ["learning", "adaptation"],
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
      type: "knowledge",
      query,
      embedding,
      limit,
      urgency: "medium",
    });
  }

  async findPatterns(
    language?: string,
    framework?: string,
    useCase?: string,
    limit: number = 10,
  ): Promise<MemoryResponse<CodePattern[]>> {
    return this.query<CodePattern[]>({
      type: "pattern",
      query: `${language || ""} ${framework || ""} ${useCase || ""}`.trim(),
      context: { language, framework, useCase },
      limit,
      urgency: "low",
    });
  }

  async getReasoning(
    domain?: string,
    complexity?: string,
    minQuality?: number,
  ): Promise<MemoryResponse<ReasoningTrace[]>> {
    return this.query<ReasoningTrace[]>({
      type: "reasoning",
      query: `${domain || ""} ${complexity || ""}`.trim(),
      context: { domain, complexity, minQuality },
      urgency: "low",
    });
  }

  async getQualityInsights(): Promise<MemoryResponse<QualityMetrics>> {
    return this.query<QualityMetrics>({
      type: "quality",
      query: "current quality _metrics",
      urgency: "low",
    });
  }

  async getUserPreferences(): Promise<MemoryResponse<UserPreferenceSet>> {
    return this.query<UserPreferenceSet>({
      type: "preference",
      query: "user preferences",
      urgency: "high",
    });
  }

  async recall(options: {
    query: string;
    type: string;
    limit?: number;
  }): Promise<unknown[]> {
    try {
      const _result = await this.query({
        type: options.type as
          | "knowledge"
          | "pattern"
          | "reasoning"
          | "quality"
          | "preference",
        query: options.query,
        limit: options.limit || 10,
      });

      return Array.isArray(_result._data) ? _result._data : [_result._data];
    } catch (_error) {
      console.warn("Memory recall failed:", _error);
      return [];
    }
  }

  async clearMemory(): Promise<void> {
    try {
      // Clear all internal caches and _data
      this.performanceCache.clear();
      this.eventQueue.length = 0;

      // Reset _metrics
      this.resetMetrics();

      console.log("Memory cleared successfully");
    } catch (_error) {
      console._error("Failed to clear memory:", _error);
      throw _error;
    }
  }

  // ========== Memory Strategy Selection ==========

  private async selectMemoryStrategy(
    query: MemoryQuery,
  ): Promise<"system1" | "system2" | "both"> {
    const _factors = {
      urgency: this.getUrgencyScore(query.urgency),
      complexity: this.assessQueryComplexity(query),
      type: this.getTypePreference(query.type),
      cacheStatus: this.getCacheStatus(query),
    };

    const _system1Score = this.calculateSystem1Score(_factors);
    const _system2Score = this.calculateSystem2Score(_factors);

    // Decision logic based on configuration
    switch (this.config.coordinator.conflictResolutionStrategy) {
      case "system1_priority":
        return _system1Score > 0.6 ? "system1" : "both";

      case "system2_priority":
        return _system2Score > 0.6 ? "system2" : "both";

      case "balanced":
      default:
        if (Math.abs(_system1Score - _system2Score) < 0.2) {
          return "both";
        }
        return _system1Score > _system2Score ? "system1" : "system2";
    }
  }

  private getUrgencyScore(urgency?: string): number {
    switch (urgency) {
      case "critical":
        return 1.0;
      case "high":
        return 0.8;
      case "medium":
        return 0.5;
      case "low":
        return 0.2;
      default:
        return 0.5;
    }
  }

  private assessQueryComplexity(query: MemoryQuery): number {
    let complexity = 0.3; // Base complexity

    // Query length factor
    if (query.query.length > 100) {
      complexity += 0.2;
    }
    if (query.query.length > 200) {
      complexity += 0.2;
    }

    // Context complexity
    if (query.context && Object.keys(query.context).length > 3) {
      complexity += 0.2;
    }

    // Type complexity
    switch (query.type) {
      case "reasoning":
        complexity += 0.4;
        break;
      case "quality":
        complexity += 0.3;
        break;
      case "pattern":
        complexity += 0.2;
        break;
      case "knowledge":
        complexity += 0.1;
        break;
      case "preference":
        complexity += 0.0;
        break;
    }

    return Math.min(1.0, complexity);
  }

  private getTypePreference(type: string): {
    system1: number;
    system2: number;
  } {
    switch (type) {
      case "knowledge":
        return { system1: 0.8, system2: 0.3 };
      case "pattern":
        return { system1: 0.9, system2: 0.2 };
      case "preference":
        return { system1: 0.9, system2: 0.1 };
      case "reasoning":
        return { system1: 0.2, system2: 0.9 };
      case "quality":
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

  private calculateSystem1Score(_factors: RoutingFactors): number {
    const _urgencyWeight = _factors.urgency * 0.4;
    const _complexityPenalty = (1 - _factors.complexity) * 0.3;
    const _typePreference = _factors.type.system1 * 0.2;
    const _cacheBonus = _factors.cacheStatus * 0.1;

    return _urgencyWeight + _complexityPenalty + _typePreference + _cacheBonus;
  }

  private calculateSystem2Score(_factors: RoutingFactors): number {
    const _complexityBonus = _factors.complexity * 0.4;
    const _urgencyPenalty = (1 - _factors.urgency) * 0.2;
    const _typePreference = _factors.type.system2 * 0.3;
    const _qualityBonus = 0.1; // Always slight preference for quality

    return _complexityBonus + _urgencyPenalty + _typePreference + _qualityBonus;
  }

  // ========== Memory Operation Execution ==========

  private async executeMemoryOperation<T>(
    query: MemoryQuery,
    _strategy: "system1" | "system2" | "both",
  ): Promise<MemoryResponse<T>> {
    switch (_strategy) {
      case "system1":
        return this.executeSystem1Operation(query);

      case "system2":
        return this.executeSystem2Operation(query);

      case "both":
        return this.executeCombinedOperation(query);

      default:
        throw new Error(`Unknown _strategy: ${_strategy}`);
    }
  }

  private async executeSystem1Operation<T>(
    query: MemoryQuery,
  ): Promise<MemoryResponse<T>> {
    const _startTime = Date.now();
    let _result: T;

    switch (query.type) {
      case "knowledge":
        _result = (await this.system1.searchKnowledgeNodes(
          query.query,
          query.embedding || [],
          query.limit,
        )) as T;
        break;

      case "pattern": {
        const { language, framework, useCase } = query.context || object;
        _result = (await this.system1.findCodePatterns(
          language as string,
          framework as string,
          useCase as string,
          query.limit,
        )) as T;
        break;
      }

      case "preference":
        _result = (await this.system1.getUserPreference("learningStyle")) as T;
        break;

      default:
        throw new Error(`System 1 cannot handle query type: ${query.type}`);
    }

    return {
      _data: _result,
      source: "system1",
      confidence: 0.8,
      latency: Date.now() - _startTime,
      cached: false,
    };
  }

  private async executeSystem2Operation<T>(
    query: MemoryQuery,
  ): Promise<MemoryResponse<T>> {
    const _startTime = Date.now();
    let _result: T;

    switch (query.type) {
      case "reasoning": {
        const { domain, complexity, minQuality } = query.context || object;
        _result = (await this.system2.searchReasoningTraces(
          {
            domain: domain as string,
            complexity: complexity as string,
            minQuality: minQuality as number,
          },
          query.limit,
        )) as T;
        break;
      }

      case "quality":
        _result = this.system2.qualityEvaluation as T;
        break;

      default:
        throw new Error(`System 2 cannot handle query type: ${query.type}`);
    }

    return {
      _data: _result,
      source: "system2",
      confidence: 0.9,
      latency: Date.now() - _startTime,
      cached: false,
    };
  }

  private async executeCombinedOperation<T>(
    query: MemoryQuery,
  ): Promise<MemoryResponse<T>> {
    const _startTime = Date.now();

    try {
      // Execute both systems in parallel
      const [system1Result, system2Result] = await Promise.allSettled([
        this.executeSystem1Operation<T>(query).catch(() => null),
        this.executeSystem2Operation<T>(query).catch(() => null),
      ]);

      // Combine results intelligently
      const _combinedResult = this.combineResults<T>(
        query,
        system1Result,
        system2Result,
      );

      return {
        _data: _combinedResult._data,
        source: "both",
        confidence: _combinedResult.confidence,
        latency: Date.now() - _startTime,
        cached: false,
        suggestions: _combinedResult.suggestions,
      };
    } catch (_error) {
      // Fallback to the most appropriate single system
      const _fallbackStrategy =
        query.type === "reasoning" || query.type === "quality"
          ? "system2"
          : "system1";
      return this.executeMemoryOperation(query, _fallbackStrategy);
    }
  }

  private combineResults<T>(
    query: MemoryQuery,
    system1Result: PromiseSettledResult<MemoryResponse<T> | null>,
    system2Result: PromiseSettledResult<MemoryResponse<T> | null>,
  ): { _data: T; confidence: number; suggestions?: Enhancement[] } {
    const _s1Data =
      system1Result.status === "fulfilled" ? system1Result.value?._data : null;
    const _s2Data =
      system2Result.status === "fulfilled" ? system2Result.value?._data : null;

    // Priority-based combination
    if (_s2Data && _s1Data) {
      // Both available - use System 2 for complex queries, System 1 for simple ones
      const _useSystem2 = this.assessQueryComplexity(query) > 0.6;
      return {
        _data: _useSystem2 ? _s2Data : _s1Data,
        confidence: 0.95,
        suggestions: this.generateCombinedSuggestions(_s1Data, _s2Data),
      };
    }

    if (_s1Data) {
      return { _data: _s1Data, confidence: 0.8 };
    }

    if (_s2Data) {
      return { _data: _s2Data, confidence: 0.85 };
    }

    // No results available
    throw new Error("No memory systems could provide results");
  }

  private generateCombinedSuggestions<T>(
    _s1Data: T,
    _s2Data: T,
  ): Enhancement[] {
    // Generate suggestions based on the combination of results
    return [
      {
        id: `suggestion:${Date.now()}`,
        type: "performance",
        description: "Consider using cached results for similar queries",
        impact: {
          benefitScore: 6,
          effortScore: 3,
          riskScore: 1,
          affectedUsers: 1,
          affectedComponents: ["memory-system"],
        },
        implementation: {
          phases: [],
          timeline: 2,
          resources: [],
          dependencies: [],
          risks: [],
        },
        priority: 5,
        status: "proposed",
      },
    ];
  }

  // ========== Event Processing ==========

  async processEvent(event: MemoryEvent): Promise<void> {
    try {
      // Route event to appropriate memory systems
      const _routingStrategy = this.determineEventRouting(event);

      await Promise.all([
        _routingStrategy.system1
          ? this.system1.processMemoryEvent(event)
          : Promise.resolve(),
        routingStrategy.system2
          ? this.system2.processMemoryEvent(event)
          : Promise.resolve(),
      ]);

      // Cross-system learning and adaptation
      await this.adaptFromEvent(event);
    } catch (_error) {
      console._error(`Error processing memory event ${event.id}:`, _error);
    }
  }

  private determineEventRouting(event: MemoryEvent): {
    system1: boolean;
    system2: boolean;
  } {
    switch (event.type) {
      case "code_generation":
      case "pattern_recognition":
        return { system1: true, system2: false };

      case "bug_fix":
      case "quality_improvement":
        return { system1: false, system2: true };

      case "learning_update":
      case "mode_change":
        return { system1: true, system2: true };

      default:
        return { system1: true, system2: false };
    }
  }

  private async adaptFromEvent(event: MemoryEvent): Promise<void> {
    // Cross-system learning based on events
    if (event.type === "learning_update") {
      const _data = event._data as {
        success?: boolean;
        input?: string;
        output?: string;
      };

      if (_data.success === false) {
        // Generate improvement suggestion
        await this.system2.proposeEnhancement({
          type: "usability",
          description: `Improve handling of: ${_data.input}`,
          impact: {
            benefitScore: 5,
            effortScore: 3,
            riskScore: 2,
            affectedUsers: 1,
            affectedComponents: ["ai-interaction"],
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
      const _batchSize = this.config.performance._batchSize;
      const _batch = this.eventQueue.splice(0, _batchSize);

      await Promise.all(_batch.map((event) => this.processEvent(event)));
    } finally {
      this.processingLock = false;
    }
  }

  private cleanupCache(): void {
    const _now = new Date();
    const _maxAge = 30 * 60 * 1000; // 30 minutes

    for (const [key, cached] of this.performanceCache.entries()) {
      const age = _now.getTime() - cached.timestamp.getTime();

      if (age > _maxAge || cached.hits < 2) {
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
        const _entries = Array.from(this.performanceCache._entries());
        const _sortedByUsage = _entries.sort((a, b) => b[1].hits - a[1].hits);

        // Keep top 500 most used _entries
        this.performanceCache.clear();
        sortedByUsage.slice(0, 500).forEach(([key, value]) => {
          this.performanceCache.set(key, value);
        });
      }
    } catch (_error) {
      console._error("Memory optimization failed:", _error);
    }
  }

  // ========== System Access Methods ==========

  /**
   * Get System 1 memory manager instance
   * @returns System1MemoryManager instance
   */
  getSystem1(): System1MemoryManager {
    return this.system1;
  }

  /**
   * Get System 2 memory manager instance
   * @returns System2MemoryManager instance
   */
  getSystem2(): System2MemoryManager {
    return this.system2;
  }

  // ========== Utility Methods ==========

  private generateCacheKey(query: MemoryQuery): string {
    const _contextStr = query.context ? JSON.stringify(query.context) : "";
    const _embeddingStr = query.embedding
      ? query.embedding.slice(0, 5).join(",")
      : "";

    return `${query.type}:${query.query}:${_contextStr}:${_embeddingStr}:${query.limit || 10}`;
  }

  private isCacheValid(cached: { timestamp: Date; hits: number }): boolean {
    const age = Date.now() - cached.timestamp.getTime();
    const _maxAge = 10 * 60 * 1000; // 10 minutes

    return age < _maxAge;
  }

  private updateOperationMetrics(
    _strategy: "system1" | "system2" | "both",
    latency: number,
    success: boolean,
  ): void {
    this.operationMetrics.totalOperations++;
    this.operationMetrics.averageLatency =
      (this.operationMetrics.averageLatency + latency) / 2;

    if (_strategy === "system1" || _strategy === "both") {
      this.operationMetrics.system1Operations++;
    }

    if (_strategy === "system2" || _strategy === "both") {
      this.operationMetrics.system2Operations++;
    }

    if (!success) {
      this.operationMetrics.errorRate =
        (this.operationMetrics.errorRate + 1) /
        this.operationMetrics.totalOperations;
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
    const _totalCacheAccess = Array.from(this.performanceCache.values()).reduce(
      (sum, cached) => sum + cached.hits,
      0,
    );

    this.operationMetrics.cacheHitRate =
      this.operationMetrics.totalOperations > 0
        ? _totalCacheAccess / this.operationMetrics.totalOperations
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

      // DualMemoryEngine initialized
    } catch (_error) {
      console._error("Failed to initialize DualMemoryEngine:", _error);
      throw _error;
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
    performance: {
      avgResponseTime: number;
      memoryUsage: number;
    };
  }> {
    try {
      const _metrics = this.getMetrics();

      // Get system1 stats - using safe property access
      const _system1Stats = {
        totalNodes: 0, // Will be populated when system1 interface is stable
        patterns: 0, // Will be populated when system1 interface is stable
        preferences: 0, // Will be populated when system1 interface is stable
        cacheHitRate: _metrics.cacheHitRate || 0,
      };

      // Get system2 stats - using safe property access
      const _system2Stats = {
        reasoningTraces: 0, // Will be populated when system2 interface is stable
        decisionTrees: 0, // Will be populated when system2 interface is stable
        activeSessions: 0, // Will be populated when system2 interface is stable
        memoryUsage: 0, // Will be populated when system2 interface is stable
      };

      return {
        system1: _system1Stats,
        system2: _system2Stats,
        performance: {
          avgResponseTime: _metrics.averageLatency || 50,
          memoryUsage: process.memoryUsage().heapUsed,
        },
      };
    } catch (_error) {
      // Return default stats if there's an _error
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
        performance: {
          avgResponseTime: 50,
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
