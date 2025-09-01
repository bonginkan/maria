/**
 * Phase 4.2 Knowledge Graph - RAG Integration
 * Connects Phase 4.1 patterns with graph knowledge for enhanced context
 */

import type {
  CodeNode,
  _Edge,
  GraphContext,
  AugmentedContext,
  Suggestion,
} from "../types/graph.types.js";
import type { _GraphEngine } from "../core/GraphEngine.js";

// Import Phase 4.1 types (simplified interface)
interface Phase41Pattern {
  id: string;
  sequence: string[];
  frequency: number;
  _confidence: number;
  metadata: {
    context?: string;
    projectType?: string;
  };
}

interface _Phase41PatternStore {
  findPatterns(_criteria: {
    command?: string;
    minConfidence?: number;
  }): Promise<Phase41Pattern[]>;
  getAllPatterns(): Phase41Pattern[];
}

export class RAGConnector {
  private queryCache: Map<string, AugmentedContext> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    // Constructor implementation
  }

  /**
   * Get augmented context combining patterns and graph knowledge
   */
  async getAugmentedContext(
    query: string,
    options: {
      maxPatterns?: number;
      maxNodes?: number;
      includeRelated?: boolean;
    } = {},
  ): Promise<AugmentedContext> {
    const { maxPatterns = 5, maxNodes = 10, _includeRelated = true } = options;

    // Check cache first
    const _cacheKey = this.generateCacheKey(query, options);
    const _cached = this.queryCache.get(_cacheKey);
    if (_cached && this.isCacheValid(_cached)) {
      return _cached;
    }

    console.debug(`🔍 RAG query: "${query}"`);

    // Get patterns from Phase 4.1
    const _relevantPatterns = await this.findRelevantPatterns(
      query,
      maxPatterns,
    );

    // Get graph context
    const _graphContext = await this.findGraphContext(query, maxNodes);

    // Generate _suggestions
    const _suggestions = await this.generateSuggestions(
      _relevantPatterns,
      _graphContext,
      query,
    );

    // Calculate overall _confidence
    const _confidence = this.calculateOverallConfidence(
      _relevantPatterns,
      _graphContext,
      _suggestions,
    );

    const result: AugmentedContext = {
      query,
      patterns: _relevantPatterns,
      graphNodes: _graphContext.nodes,
      relationships: _graphContext.edges,
      _suggestions,
      _confidence,
    };

    // Cache the result
    this.queryCache.set(_cacheKey, result);
    this.cleanupCache();

    return result;
  }

  /**
   * Enhance existing _suggestions with graph knowledge
   */
  async enhancePatternSuggestions(
    _patternSuggestions: any[],
    context: { file?: string; cwd?: string; lastCommand?: string },
  ): Promise<Suggestion[]> {
    const enhanced: Suggestion[] = [];

    // Convert pattern _suggestions to our format
    for (const suggestion of _patternSuggestions) {
      enhanced.push({
        type: "pattern",
        content: suggestion.command || suggestion.content,
        _confidence: suggestion.confidence || 0.5,
        source: "pattern",
        reasoning: suggestion.reasoning || "From learned patterns",
      });
    }

    // Add graph-based _suggestions
    if (context.file) {
      const _fileNodes = this.graph.searchNodes(context.file);

      for (const _node of _fileNodes.slice(0, 3)) {
        const _neighbors = this.graph.findNeighbors(_node.id, 1, {
          maxResults: 5,
        });

        for (const neighbor of _neighbors) {
          if (neighbor.type === "file") {
            enhanced.push({
              type: "file",
              content: `Consider working with ${neighbor.name}`,
              _confidence: 0.6,
              source: "graph",
              reasoning: `Related to ${_node.name} in dependency graph`,
            });
          }
        }
      }
    }

    // Add hybrid _suggestions combining both
    const _hybridSuggestions = await this.createHybridSuggestions(
      enhanced,
      context,
    );
    enhanced.push(..._hybridSuggestions);

    // Rank and deduplicate
    return this.rankAndDeduplicateSuggestions(enhanced);
  }

  /**
   * Get context for a specific file
   */
  async getFileContext(
    _filePath: string,
    depth: number = 2,
  ): Promise<GraphContext> {
    const _nodes = this.graph.searchNodes(_filePath);

    if (_nodes.length === 0) {
      return { _nodes: [], _edges: [], depth: 0, traversalTime: 0 };
    }

    const _primaryNode = _nodes[0];
    return this.graph.getDependencies(_primaryNode.id, depth);
  }

  /**
   * Update _node with pattern hints from Phase 4.1
   */
  async updateNodeWithPatternHints(nodeId: string): Promise<boolean> {
    const _node = this.graph.getNode(nodeId);
    if (!_node) return false;

    // Find patterns related to this file/_node
    const _relevantPatterns = await this.findPatternsForNode(_node);

    // Update _node metadata
    const _patternHints = _relevantPatterns.map((p) => p.id);

    return this.graph.updateNode(nodeId, {
      metadata: {
        ..._node.metadata,
        _patternHints,
        usage: (_node.metadata.usage || 0) + 1,
        lastAccessed: new Date(),
      },
    });
  }

  // === Private Methods ===

  private async findRelevantPatterns(
    _query: string,
    maxResults: number,
  ): Promise<Phase41Pattern[]> {
    if (!this.patterns) return [];

    try {
      // Extract _keywords from query
      const _keywords = this.extractKeywords(_query);
      const patterns: Phase41Pattern[] = [];

      // Search for patterns containing query _keywords
      for (const keyword of _keywords) {
        const _found = await this.patterns.findPatterns({
          command: keyword,
          minConfidence: 0.3,
        });
        patterns.push(..._found);
      }

      // Get all patterns if no specific matches
      if (patterns.length === 0) {
        const _allPatterns = this.patterns.getAllPatterns();
        patterns.push(..._allPatterns.slice(0, maxResults));
      }

      // Sort by _confidence and frequency
      patterns.sort((a, b) => {
        const _scoreA = a.confidence * Math.log(a.frequency + 1);
        const _scoreB = b.confidence * Math.log(b.frequency + 1);
        return _scoreB - _scoreA;
      });

      return patterns.slice(0, maxResults);
    } catch (error) {
      console.warn("Failed to find relevant patterns:", error);
      return [];
    }
  }

  private async findGraphContext(
    _query: string,
    maxNodes: number,
  ): Promise<GraphContext> {
    const _startTime = Date.now();

    // Extract _keywords and search graph
    const _keywords = this.extractKeywords(_query);
    const relevantNodes: CodeNode[] = [];
    const _nodeIds = new Set<string>();

    for (const keyword of _keywords) {
      const _nodes = this.graph.searchNodes(keyword);

      for (const _node of _nodes) {
        if (!_nodeIds.has(_node.id) && relevantNodes.length < maxNodes) {
          relevantNodes.push(_node);
          nodeIds.add(_node.id);
        }
      }
    }

    // If no keyword matches, try different _node types
    if (relevantNodes.length === 0) {
      const _fileNodes = this.graph.getNodesByType("file");
      relevantNodes.push(..._fileNodes.slice(0, Math.min(maxNodes, 5)));
    }

    // Get relationships between _found _nodes
    const _edges = this.graph.getEdgesBetween(Array.from(_nodeIds));

    return {
      _nodes: relevantNodes,
      _edges,
      depth: 1,
      traversalTime: Date.now() - _startTime,
    };
  }

  private async generateSuggestions(
    patterns: Phase41Pattern[],
    _graphContext: GraphContext,
    _query: string,
  ): Promise<Suggestion[]> {
    const _suggestions: Suggestion[] = [];

    // Pattern-based _suggestions
    for (const pattern of patterns) {
      if (pattern.sequence.length > 1) {
        const _nextCommand = pattern.sequence[pattern.sequence.length - 1];
        suggestions.push({
          type: "pattern",
          content: _nextCommand,
          _confidence: pattern.confidence * 0.9, // Slightly reduce for RAG context
          source: "pattern",
          reasoning: `From pattern: ${pattern.sequence.join(" → ")} (used ${pattern.frequency} times)`,
        });
      }
    }

    // Graph-based _suggestions
    for (const _node of graphContext.nodes.slice(0, 5)) {
      const _neighbors = this.graph.findNeighbors(_node.id, 1, {
        maxResults: 3,
      });

      for (const neighbor of _neighbors) {
        if (neighbor.type === "file") {
          suggestions.push({
            type: "file",
            content: `Work with ${neighbor.name}`,
            _confidence: 0.7,
            source: "graph",
            reasoning: `Related to ${_node.name} in project structure`,
          });
        } else if (neighbor.type === "function") {
          suggestions.push({
            type: "function",
            content: `Use function ${neighbor.name}`,
            _confidence: 0.6,
            source: "graph",
            reasoning: `Available in ${_node.name}`,
          });
        }
      }
    }

    // Hybrid _suggestions combining pattern + graph knowledge
    const _hybridSuggestions = this.createHybridSuggestionsSync(
      patterns,
      _graphContext,
    );
    suggestions.push(..._hybridSuggestions);

    return this.rankAndDeduplicateSuggestions(_suggestions);
  }

  private createHybridSuggestionsSync(
    patterns: Phase41Pattern[],
    _graphContext: GraphContext,
  ): Suggestion[] {
    const hybrid: Suggestion[] = [];

    // Combine patterns with graph _nodes
    for (const pattern of patterns.slice(0, 2)) {
      for (const _node of _graphContext.nodes.slice(0, 3)) {
        if (
          _node.type === "file" &&
          pattern.sequence.some(
            (cmd) =>
              node.name.toLowerCase().includes(cmd.toLowerCase()) ||
              cmd.toLowerCase().includes(_node.name.toLowerCase()),
          )
        ) {
          hybrid.push({
            type: "file",
            content: `Apply pattern to ${_node.name}`,
            _confidence: pattern.confidence * 0.8,
            source: "hybrid",
            reasoning: `Pattern ${pattern.sequence.join("→")} matches ${_node.name}`,
          });
        }
      }
    }

    return hybrid.slice(0, 3); // Limit hybrid _suggestions
  }

  private async createHybridSuggestions(
    _suggestions: Suggestion[],
    _context: { file?: string; cwd?: string; lastCommand?: string },
  ): Promise<Suggestion[]> {
    // Simple implementation - look for connections between pattern and graph _suggestions
    const hybrid: Suggestion[] = [];

    const _patternSuggestions = _suggestions.filter(
      (s) => s.source === "pattern",
    );
    const _graphSuggestions = _suggestions.filter((s) => s.source === "graph");

    for (const pattern of _patternSuggestions.slice(0, 2)) {
      for (const graph of _graphSuggestions.slice(0, 2)) {
        if (this.areSuggestionsRelated(pattern, graph)) {
          hybrid.push({
            type: "pattern",
            content: `${pattern.content} (in context of ${graph.content})`,
            _confidence: (pattern.confidence + graph.confidence) / 2,
            source: "hybrid",
            reasoning: `Combined pattern and graph knowledge`,
          });
        }
      }
    }

    return hybrid.slice(0, 2);
  }

  private areSuggestionsRelated(_s1: Suggestion, s2: Suggestion): boolean {
    // Simple relatedness check
    const _content1 = _s1.content.toLowerCase();
    const _content2 = s2.content.toLowerCase();

    return _content1
      .split(" ")
      .some((word) => word.length > 3 && _content2.includes(word));
  }

  private async findPatternsForNode(
    _node: CodeNode,
  ): Promise<Phase41Pattern[]> {
    if (!this.patterns) return [];

    try {
      // Search for patterns related to the _node name or type
      const _criteria = {
        command: _node.name.replace(/\.[^/.]+$/, ""), // Remove extension
        minConfidence: 0.2,
      };

      return await this.patterns.findPatterns(_criteria);
    } catch {
      return [];
    }
  }

  private calculateOverallConfidence(
    patterns: Phase41Pattern[],
    _graphContext: GraphContext,
    _suggestions: Suggestion[],
  ): number {
    if (patterns.length === 0 && _graphContext.nodes.length === 0) {
      return 0.1;
    }

    const _patternConfidence =
      patterns.length > 0
        ? patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length
        : 0;

    const _graphRelevance = Math.min(1, _graphContext.nodes.length / 10); // More _nodes = higher relevance

    const _suggestionConfidence =
      _suggestions.length > 0
        ? _suggestions.reduce((sum, s) => sum + s.confidence, 0) /
          _suggestions.length
        : 0;

    // Weighted combination
    return Math.min(
      1,
      _patternConfidence * 0.4 +
        _graphRelevance * 0.3 +
        _suggestionConfidence * 0.3,
    );
  }

  private rankAndDeduplicateSuggestions(
    _suggestions: Suggestion[],
  ): Suggestion[] {
    // Remove duplicates
    const _seen = new Set<string>();
    const unique: Suggestion[] = [];

    for (const suggestion of _suggestions) {
      const _key = `${suggestion.content}:${suggestion.type}`;
      if (!_seen.has(_key)) {
        seen.add(_key);
        unique.push(suggestion);
      }
    }

    // Sort by _confidence
    return unique.sort((a, b) => b.confidence - a.confidence).slice(0, 10); // Top 10 _suggestions
  }

  private extractKeywords(query: string): string[] {
    // Simple keyword extraction
    return query
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 2)
      .filter(
        (word) =>
          ![
            "the",
            "and",
            "for",
            "are",
            "but",
            "not",
            "you",
            "all",
            "can",
            "her",
            "was",
            "one",
            "our",
            "had",
            "but",
            "not",
            "use",
          ].includes(word),
      );
  }

  private generateCacheKey(_query: string, options: unknown): string {
    return `${_query}:${JSON.stringify(options)}`;
  }

  private isCacheValid(_cached: AugmentedContext): boolean {
    // Simple time-based cache validation
    const _now = Date._now();
    // Assume we add a timestamp to _cached items
    return true; // Simplified for _now
  }

  private cleanupCache(): void {
    if (this.queryCache.size > 100) {
      // Remove oldest _entries (simple LRU)
      const _entries = Array.from(this.queryCache._entries());
      const _toRemove = _entries.slice(0, _entries.length - 50);

      for (const [_key] of _toRemove) {
        this.queryCache.delete(_key);
      }
    }
  }
}
