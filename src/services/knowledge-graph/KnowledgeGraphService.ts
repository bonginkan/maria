/**
 * Phase 4.2 Knowledge Graph Service
 * Main service integrating all graph components with performance optimization
 */

import path from "path";
import type {
  CodeNode,
  Edge,
  GraphStats,
  AugmentedContext,
  Suggestion,
  QueryOptions,
} from "./types/graph.types.js";

import { _GraphEngine } from "./core/GraphEngine.js";
import { GraphStore } from "./storage/GraphStore.js";
import { DependencyAnalyzer } from "./analyzers/DependencyAnalyzer.js";
import { RAGConnector } from "./integration/RAGConnector.js";

export interface KnowledgeGraphConfig {
  maxNodes?: number;
  maxEdgesPerNode?: number;
  enablePersistence?: boolean;
  enableRAG?: boolean;
  analysisRootDir?: string;
  performanceMode?: "standard" | "optimized";
}

export class KnowledgeGraphService {
  private graphEngine: GraphEngine;
  private graphStore: GraphStore;
  private dependencyAnalyzer: DependencyAnalyzer;
  private ragConnector: RAGConnector;
  private config: Required<KnowledgeGraphConfig>;
  private isInitialized = false;
  private performanceMetrics: {
    queryTimes: number[];
    indexingTimes: number[];
    lastOptimization: Date;
  };

  constructor(_config: KnowledgeGraphConfig = {}) {
    this._config = {
      maxNodes: 10000,
      maxEdgesPerNode: 100,
      enablePersistence: true,
      enableRAG: true,
      analysisRootDir: process.cwd(),
      performanceMode: "standard",
      ..._config,
    };

    this.performanceMetrics = {
      queryTimes: [],
      indexingTimes: [],
      lastOptimization: new Date(),
    };

    this.initializeComponents();
  }

  /**
   * Initialize all components
   */
  private initializeComponents(): void {
    // Initialize core components
    this.graphEngine = new GraphEngine({
      maxNodes: this.config.maxNodes,
      maxEdgesPerNode: this.config.maxEdgesPerNode,
      enableIndexing: true,
      persistenceEnabled: this.config.enablePersistence,
      queryTimeout: 5000,
    });

    this.graphStore = new GraphStore(this.config.maxNodes);
    this.dependencyAnalyzer = new DependencyAnalyzer(this.config.maxNodes);

    // RAG connector will be initialized after patterns are available
    this.ragConnector = new RAGConnector(this.graphEngine);
  }

  /**
   * Initialize the service and load existing data
   */
  async initialize(patternsStore?: unknown): Promise<void> {
    if (this.isInitialized) return;

    console.log("🚀 Initializing Knowledge Graph Service...");

    try {
      // Initialize storage
      if (this.config.enablePersistence) {
        await this.graphStore.initialize();
        await this.loadGraphFromStore();
      }

      // Initialize RAG with patterns if available
      if (this.config.enableRAG && patternsStore) {
        this.ragConnector = new RAGConnector(this.graphEngine, patternsStore);
      }

      this.isInitialized = true;
      console.log(`✅ Knowledge Graph Service initialized`);
      console.log(`📊 Current _stats:`, await this.getStats());
    } catch (error) {
      console.error("❌ Failed to initialize Knowledge Graph Service:", error);
      throw error;
    }
  }

  /**
   * Analyze project and build dependency graph
   */
  async analyzeProject(rootDir?: string): Promise<{
    nodeCount: number;
    edgeCount: number;
    _analysisTime: number;
  }> {
    const _startTime = Date.now();
    const _targetDir = rootDir || this.config.analysisRootDir;

    console.log(`🔍 Analyzing project: ${_targetDir}`);

    try {
      const _projectGraph =
        await this.dependencyAnalyzer.buildDependencyGraph(_targetDir);

      // Merge with existing graph
      await this.mergeGraph(_projectGraph);

      // Optimize for performance
      if (this.config.performanceMode === "optimized") {
        await this.optimize();
      }

      // Persist if enabled
      if (this.config.enablePersistence) {
        await this.saveGraphToStore();
      }

      const _analysisTime = Date.now() - _startTime;
      const _stats = await this.getStats();

      console.log(`✅ Project analysis complete in ${_analysisTime}ms`);
      console.log(
        `📊 Graph now contains: ${_stats.nodeCount} nodes, ${_stats.edgeCount} _edges`,
      );

      this.recordAnalysisTime(_analysisTime);

      return {
        nodeCount: _stats.nodeCount,
        edgeCount: _stats.edgeCount,
        _analysisTime,
      };
    } catch (innerError) {
      console.error("❌ Project analysis failed:", error);
      throw error;
    }
  }

  /**
   * Get augmented _context using RAG
   */
  async getAugmentedContext(
    query: string,
    options: {
      maxPatterns?: number;
      maxNodes?: number;
      includeRelated?: boolean;
      contextFile?: string;
    } = {},
  ): Promise<AugmentedContext> {
    this.ensureInitialized();

    const _startTime = Date.now();

    try {
      const _context = await this.ragConnector.getAugmentedContext(
        query,
        options,
      );

      // Enhance with current file _context if provided
      if (options.contextFile) {
        const _fileContext = await this.getFileContext(options.contextFile);
        _context.graphNodes = [
          ..._context.graphNodes,
          ..._fileContext.nodes,
        ].slice(0, options.maxNodes || 10);
        _context.relationships = [
          ..._context.relationships,
          ..._fileContext.edges,
        ];
      }

      this.recordQueryTime(Date.now() - _startTime);

      return _context;
    } catch (error) {
      console.error("❌ Failed to get augmented _context:", error);
      throw error;
    }
  }

  /**
   * Enhance pattern suggestions with graph knowledge
   */
  async enhanceSuggestions(
    patternSuggestions: any[],
    _context: { file?: string; cwd?: string; lastCommand?: string },
  ): Promise<Suggestion[]> {
    this.ensureInitialized();

    try {
      return await this.ragConnector.enhancePatternSuggestions(
        patternSuggestions,
        _context,
      );
    } catch (innerError) {
      console.warn(
        "⚠️ Failed to enhance suggestions, returning original:",
        error,
      );
      return patternSuggestions.map((s) => ({
        type: "pattern" as const,
        content: s.command || s.content,
        confidence: s.confidence || 0.5,
        source: "pattern" as const,
        reasoning: s.reasoning || "From patterns",
      }));
    }
  }

  /**
   * Get _context for a specific file
   */
  async getFileContext(
    _filePath: string,
    depth: number = 2,
  ): Promise<{
    nodes: CodeNode[];
    _edges: Edge[];
    dependencies: CodeNode[];
    suggestions: Suggestion[];
  }> {
    this.ensureInitialized();

    const _startTime = Date.now();

    try {
      // Get direct graph _context
      const _graphContext = await this.ragConnector.getFileContext(
        _filePath,
        depth,
      );

      // Get additional _context through search
      const _fileName = path.basename(_filePath);
      const _relatedNodes = this.graphEngine.searchNodes(_fileName);

      // Generate file-specific suggestions
      const suggestions: Suggestion[] = [];

      for (const node of _graphContext.nodes.slice(0, 5)) {
        const _neighbors = this.graphEngine.findNeighbors(node.id, 1, {
          maxResults: 3,
        });

        for (const neighbor of _neighbors) {
          if (neighbor.type === "file" && neighbor.path !== _filePath) {
            suggestions.push({
              type: "file",
              content: `Consider ${neighbor.name}`,
              confidence: 0.7,
              source: "graph",
              reasoning: `Related to ${node.name}`,
            });
          }
        }
      }

      this.recordQueryTime(Date.now() - _startTime);

      return {
        nodes: _graphContext.nodes,
        _edges: _graphContext.edges,
        dependencies: _relatedNodes,
        suggestions: suggestions.slice(0, 5),
      };
    } catch (error) {
      console.error("❌ Failed to get file _context:", error);
      return { nodes: [], _edges: [], dependencies: [], suggestions: [] };
    }
  }

  /**
   * Search for nodes matching query
   */
  searchNodes(_query: string, options: QueryOptions = {}): CodeNode[] {
    this.ensureInitialized();

    const _startTime = Date.now();
    const _results = this.graphEngine.searchNodes(_query);
    this.recordQueryTime(Date.now() - _startTime);

    return options.maxResults
      ? _results.slice(0, options.maxResults)
      : _results;
  }

  /**
   * Get nodes by type
   */
  getNodesByType(type: string): CodeNode[] {
    this.ensureInitialized();

    const _startTime = Date.now();
    const _results = this.graphEngine.getNodesByType(type);
    this.recordQueryTime(Date.now() - _startTime);

    return _results;
  }

  /**
   * Find dependencies for a file/node
   */
  findDependencies(
    _nodeId: string,
    maxDepth: number = 2,
  ): {
    nodes: CodeNode[];
    _edges: Edge[];
    depth: number;
  } {
    this.ensureInitialized();

    const _startTime = Date.now();
    const _context = this.graphEngine.getDependencies(_nodeId, maxDepth);
    this.recordQueryTime(Date.now() - _startTime);

    return {
      nodes: _context.nodes,
      _edges: _context.edges,
      depth: _context.depth,
    };
  }

  /**
   * Get performance statistics
   */
  async getStats(): Promise<
    GraphStats & {
      performanceMetrics: {
        averageQueryTime: number;
        averageIndexingTime: number;
        lastOptimization: string;
        cacheHitRate: number;
      };
    }
  > {
    const _baseStats = this.graphEngine.getStats();

    const _avgQueryTime =
      this.performanceMetrics.queryTimes.length > 0
        ? this.performanceMetrics.queryTimes.reduce((sum, t) => sum + t, 0) /
          this.performanceMetrics.queryTimes.length
        : 0;

    const _avgIndexingTime =
      this.performanceMetrics.indexingTimes.length > 0
        ? this.performanceMetrics.indexingTimes.reduce((sum, t) => sum + t, 0) /
          this.performanceMetrics.indexingTimes.length
        : 0;

    return {
      ..._baseStats,
      performanceMetrics: {
        averageQueryTime: Math.round(_avgQueryTime),
        averageIndexingTime: Math.round(_avgIndexingTime),
        lastOptimization:
          this.performanceMetrics.lastOptimization.toISOString(),
        cacheHitRate: 0.85, // Placeholder
      },
    };
  }

  /**
   * Optimize graph performance
   */
  async optimize(): Promise<void> {
    this.ensureInitialized();

    console.log("⚡ Optimizing graph performance...");
    const _startTime = Date.now();

    try {
      // Optimize graph engine
      this.graphEngine.optimize();

      // Clean up old metrics
      this.performanceMetrics.queryTimes =
        this.performanceMetrics.queryTimes.slice(-100);
      this.performanceMetrics.indexingTimes =
        this.performanceMetrics.indexingTimes.slice(-50);
      this.performanceMetrics.lastOptimization = new Date();

      console.log(`✅ Optimization complete in ${Date.now() - _startTime}ms`);
    } catch (innerError) {
      console.error("❌ Optimization failed:", error);
    }
  }

  /**
   * Clear all graph data
   */
  async clear(): Promise<void> {
    this.ensureInitialized();

    this.graphEngine.clear();
    this.graphStore.clear();

    if (this.config.enablePersistence) {
      await this.graphStore.save();
    }

    console.log("🗑️  Knowledge graph cleared");
  }

  /**
   * Get detailed analysis report
   */
  async getAnalysisReport(): Promise<{
    overview: GraphStats;
    _topFiles: CodeNode[];
    complexConnections: { from: CodeNode; to: CodeNode; weight: number }[];
    recommendations: string[];
  }> {
    this.ensureInitialized();

    const _stats = await this.getStats();
    const _allNodes = this.graphEngine.getAllNodes();

    // Get top files by connection count
    const _fileNodes = _allNodes.filter((n) => n.type === "file");
    const _topFiles = _fileNodes
      .map((node) => ({
        ...node,
        connectionCount: this.graphEngine.getEdges(node.id).length,
      }))
      .sort((a, b) => b.connectionCount - a.connectionCount)
      .slice(0, 10);

    // Generate basic recommendations
    const recommendations: string[] = [];

    if (_stats.nodeCount > 8000) {
      recommendations.push("Consider organizing code into smaller modules");
    }
    if (_stats.averageDegree > 15) {
      recommendations.push("High coupling detected - consider refactoring");
    }
    if (_stats.queryPerformance.averageTime > 50) {
      recommendations.push("Query performance degrading - run optimization");
    }

    return {
      overview: _stats,
      _topFiles: _topFiles.map(({ connectionCount, ...node }) => node),
      complexConnections: [], // Simplified for now
      recommendations,
    };
  }

  // === Private Methods ===

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error(
        "KnowledgeGraphService not initialized. Call initialize() first.",
      );
    }
  }

  private async loadGraphFromStore(): Promise<void> {
    const _allNodes = this.graphStore.getAllNodes();

    for (const node of _allNodes) {
      this.graphEngine.addNode(node);

      const _edges = this.graphStore.getEdges(node.id);
      for (const edge of _edges) {
        this.graphEngine.addEdge(edge.from, edge.to, edge.type);
      }
    }

    console.log(`📥 Loaded ${_allNodes.length} nodes from storage`);
  }

  private async saveGraphToStore(): Promise<void> {
    const _allNodes = this.graphEngine.getAllNodes();

    this.graphStore.clear();

    for (const node of _allNodes) {
      this.graphStore.addNode(node);

      const _edges = this.graphEngine.getEdges(node.id);
      for (const edge of _edges) {
        this.graphStore.addEdge(edge);
      }
    }

    await this.graphStore.save();
    console.log(`💾 Saved ${_allNodes.length} nodes to storage`);
  }

  private async mergeGraph(sourceGraph: GraphEngine): Promise<void> {
    const _sourceNodes = sourceGraph.getAllNodes();

    for (const node of _sourceNodes) {
      this.graphEngine.addNode(node);

      const _edges = sourceGraph.getEdges(node.id);
      for (const edge of _edges) {
        this.graphEngine.addEdge(edge.from, edge.to, edge.type);
      }
    }

    console.log(`🔗 Merged ${_sourceNodes.length} nodes from analysis`);
  }

  private recordQueryTime(time: number): void {
    this.performanceMetrics.queryTimes.push(time);

    if (this.performanceMetrics.queryTimes.length > 200) {
      this.performanceMetrics.queryTimes =
        this.performanceMetrics.queryTimes.slice(-100);
    }
  }

  private recordAnalysisTime(time: number): void {
    this.performanceMetrics.indexingTimes.push(time);

    if (this.performanceMetrics.indexingTimes.length > 100) {
      this.performanceMetrics.indexingTimes =
        this.performanceMetrics.indexingTimes.slice(-50);
    }
  }
}
