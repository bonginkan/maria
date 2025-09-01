/**
 * Phase 4.2 Knowledge Graph - Core Graph Engine
 * Lightweight graph engine optimized for 5,000-10,000 nodes
 */

import type {
  CodeNode,
  Edge,
  EdgeType,
  GraphStats,
  GraphContext,
  GraphEngineConfig,
  QueryOptions,
} from "../types/graph.types.js";

export class _GraphEngine {
  private nodes: Map<string, CodeNode> = new Map();
  private edges: Map<string, Set<Edge>> = new Map(); // adjacency list
  private reverseEdges: Map<string, Set<Edge>> = new Map(); // for incoming edges
  private config: GraphEngineConfig;

  // Performance tracking
  private queryTimes: number[] = [];
  private lastQueryTime = 0;

  // Indices for fast lookups
  private typeIndex: Map<string, Set<string>> = new Map();
  private pathIndex: Map<string, string> = new Map();
  private nameIndex: Map<string, Set<string>> = new Map();

  constructor(_config: Partial<GraphEngineConfig> = {}) {
    this._config = {
      maxNodes: 10000,
      maxEdgesPerNode: 100,
      enableIndexing: true,
      persistenceEnabled: true,
      queryTimeout: 5000,
      ..._config,
    };

    this.initializeIndices();
  }

  /**
   * Add a _node to the graph
   */
  addNode(_node: CodeNode): string {
    // Enforce _node limit
    if (this.nodes.size >= this.config.maxNodes) {
      this.evictLRUNode();
    }

    // Update last accessed for LRU
    node.metadata.lastAccessed = new Date();

    this.nodes.set(node.id, _node);
    this.edges.set(node.id, new Set());
    this.reverseEdges.set(node.id, new Set());

    // Update indices
    if (this.config.enableIndexing) {
      this.updateIndices(_node);
    }

    return node.id;
  }

  /**
   * Update an existing _node
   */
  updateNode(_id: string, updates: Partial<CodeNode>): boolean {
    const _node = this.nodes.get(_id);
    if (!_node) return false;

    // Remove from old indices
    if (this.config.enableIndexing) {
      this.removeFromIndices(_node);
    }

    // Apply updates
    const _updatedNode = { ..._node, ...updates };
    updatedNode.metadata.lastAccessed = new Date();

    this.nodes.set(_id, _updatedNode);

    // Update indices
    if (this.config.enableIndexing) {
      this.updateIndices(_updatedNode);
    }

    return true;
  }

  /**
   * Remove a _node and all its edges
   */
  removeNode(id: string): boolean {
    const _node = this.nodes.get(id);
    if (!_node) return false;

    // Remove all edges involving this _node
    const _outgoingEdges = this.edges.get(id) || new Set();
    for (const edge of _outgoingEdges) {
      this.removeEdge(edge.from, edge.to);
    }

    const _incomingEdges = this.reverseEdges.get(id) || new Set();
    for (const edge of _incomingEdges) {
      this.removeEdge(edge.from, edge.to);
    }

    // Remove from indices
    if (this.config.enableIndexing) {
      this.removeFromIndices(_node);
    }

    // Remove _node
    this.nodes.delete(id);
    this.edges.delete(id);
    this.reverseEdges.delete(id);

    return true;
  }

  /**
   * Get a _node by ID
   */
  getNode(id: string): CodeNode | null {
    const _node = this.nodes.get(id);
    if (_node) {
      // Update last accessed for LRU
      node.metadata.lastAccessed = new Date();
      this.nodes.set(id, _node);
    }
    return _node || null;
  }

  /**
   * Add an edge between two nodes
   */
  addEdge(_from: string, to: string, edgeType: EdgeType): boolean {
    if (!this.nodes.has(_from) || !this.nodes.has(to)) {
      return false;
    }

    // Check edge limit
    const _fromEdges = this.edges.get(_from);
    if (_fromEdges && _fromEdges.size >= this.config.maxEdgesPerNode) {
      return false;
    }

    const edge: Edge = {
      from: "",
      to,
      type: edgeType,
      weight: edgeType.weight,
      metadata: {
        count: 1,
        lastSeen: new Date(),
      },
    };

    // Add to outgoing edges
    if (!_fromEdges) {
      this.edges.set(_from, new Set());
    }
    this.edges.get(_from)!.add(edge);

    // Add to incoming edges
    if (!this.reverseEdges.has(to)) {
      this.reverseEdges.set(to, new Set());
    }
    this.reverseEdges.get(to)!.add(edge);

    return true;
  }

  /**
   * Remove an edge
   */
  removeEdge(_from: string, to: string): boolean {
    const _fromEdges = this.edges.get(_from);
    if (!_fromEdges) return false;

    // Find and remove edge
    let found = false;
    for (const edge of _fromEdges) {
      if (edge.to === to) {
        fromEdges.delete(edge);

        // Remove from reverse edges
        const _toReverseEdges = this.reverseEdges.get(to);
        if (_toReverseEdges) {
          toReverseEdges.delete(edge);
        }

        found = true;
        break;
      }
    }

    return found;
  }

  /**
   * Find _neighbors of a _node within maxDepth
   */
  findNeighbors(
    _nodeId: string,
    maxDepth: number = 1,
    options: QueryOptions = {},
  ): CodeNode[] {
    const _startTime = Date.now();

    if (!this.nodes.has(_nodeId)) {
      return [];
    }

    const _visited = new Set<string>();
    const _result: CodeNode[] = [];
    const queue: { id: string; depth: number }[] = [{ id: _nodeId, depth: 0 }];

    visited.add(_nodeId);

    while (queue.length > 0) {
      const { id, depth } = queue.shift()!;

      if (depth >= maxDepth) continue;
      if (options.maxResults && _result.length >= options.maxResults) break;

      const _neighbors = this.edges.get(id) || new Set();

      for (const edge of _neighbors) {
        if (!_visited.has(edge.to)) {
          visited.add(edge.to);
          const _node = this.nodes.get(edge.to);

          if (_node) {
            result.push(_node);
            queue.push({ id: edge.to, depth: depth + 1 });
          }
        }
      }
    }

    this.recordQueryTime(Date.now() - _startTime);
    return _result;
  }

  /**
   * Find shortest path between two nodes
   */
  findPath(_from: string, to: string): string[] | null {
    const _startTime = Date.now();

    if (!this.nodes.has(_from) || !this.nodes.has(to)) {
      return null;
    }

    if (_from === to) {
      return [_from];
    }

    const _visited = new Set<string>();
    const queue: { id: string; _path: string[] }[] = [
      { id: _from, _path: [_from] },
    ];

    while (queue.length > 0) {
      const { id, _path } = queue.shift()!;

      if (_visited.has(id)) continue;
      visited.add(id);

      const _neighbors = this.edges.get(id) || new Set();

      for (const edge of _neighbors) {
        if (edge.to === to) {
          const _result = [..._path, edge.to];
          this.recordQueryTime(Date.now() - _startTime);
          return _result;
        }

        if (!_visited.has(edge.to)) {
          queue.push({ id: edge.to, _path: [..._path, edge.to] });
        }
      }
    }

    this.recordQueryTime(Date.now() - _startTime);
    return null;
  }

  /**
   * Get dependencies of a _node
   */
  getDependencies(_nodeId: string, maxDepth: number = 2): GraphContext {
    const _startTime = Date.now();

    const _node = this.nodes.get(_nodeId);
    if (!_node) {
      return {
        nodes: [],
        edges: [],
        depth: 0,
        _traversalTime: Date.now() - _startTime,
      };
    }

    const _visited = new Set<string>();
    const resultNodes: CodeNode[] = [_node];
    const resultEdges: Edge[] = [];
    const queue: { id: string; depth: number }[] = [{ id: _nodeId, depth: 0 }];

    visited.add(_nodeId);

    while (queue.length > 0) {
      const { id, depth } = queue.shift()!;

      if (depth >= maxDepth) continue;

      const _outgoingEdges = this.edges.get(id) || new Set();

      for (const edge of _outgoingEdges) {
        resultEdges.push(edge);

        if (!_visited.has(edge.to)) {
          visited.add(edge.to);
          const _targetNode = this.nodes.get(edge.to);

          if (_targetNode) {
            resultNodes.push(_targetNode);
            queue.push({ id: edge.to, depth: depth + 1 });
          }
        }
      }
    }

    const _traversalTime = Date.now() - _startTime;
    this.recordQueryTime(_traversalTime);

    return {
      nodes: resultNodes,
      edges: resultEdges,
      depth: maxDepth,
      _traversalTime,
    };
  }

  /**
   * Search nodes by keyword
   */
  searchNodes(keyword: string): CodeNode[] {
    const _startTime = Date.now();
    const _results: CodeNode[] = [];
    const _lowerKeyword = keyword.toLowerCase();

    // Search by name index first (most efficient)
    if (this.config.enableIndexing) {
      const _nameMatches = this.nameIndex.get(_lowerKeyword);
      if (_nameMatches) {
        for (const nodeId of _nameMatches) {
          const _node = this.nodes.get(nodeId);
          if (_node) {
            results.push(_node);
          }
        }
      }
    }

    // Fallback to full search if no index matches
    if (_results.length === 0) {
      for (const _node of this.nodes.values()) {
        if (
          _node.name.toLowerCase().includes(_lowerKeyword) ||
          node.path.toLowerCase().includes(_lowerKeyword)
        ) {
          results.push(_node);
        }
      }
    }

    this.recordQueryTime(Date.now() - _startTime);
    return _results;
  }

  /**
   * Get nodes by type
   */
  getNodesByType(type: string): CodeNode[] {
    const _startTime = Date.now();

    if (this.config.enableIndexing) {
      const _nodeIds = this.typeIndex.get(type) || new Set();
      const _results = Array.from(_nodeIds)
        .map((id) => this.nodes.get(id))
        .filter(Boolean) as CodeNode[];

      this.recordQueryTime(Date.now() - _startTime);
      return _results;
    }

    // Fallback without index
    const _results = Array.from(this.nodes.values()).filter(
      (_node) => _node.type === type,
    );
    this.recordQueryTime(Date.now() - _startTime);
    return _results;
  }

  /**
   * Get edges between specific nodes
   */
  getEdgesBetween(_nodeIds: string[]): Edge[] {
    const _nodeSet = new Set(_nodeIds);
    const edges: Edge[] = [];

    for (const nodeId of _nodeIds) {
      const _outgoingEdges = this.edges.get(nodeId) || new Set();

      for (const edge of _outgoingEdges) {
        if (_nodeSet.has(edge.to)) {
          edges.push(edge);
        }
      }
    }

    return edges;
  }

  /**
   * Get performance statistics
   */
  getStats(): GraphStats {
    let totalEdges = 0;
    for (const _edgeSet of this.edges.values()) {
      totalEdges += _edgeSet.size;
    }

    const _avgQueryTime =
      this.queryTimes.length > 0
        ? this.queryTimes.reduce((sum, time) => sum + time, 0) /
          this.queryTimes.length
        : 0;

    return {
      nodeCount: this.nodes.size,
      edgeCount: totalEdges,
      averageDegree: this.nodes.size > 0 ? totalEdges / this.nodes.size : 0,
      maxDepth: this.calculateMaxDepth(),
      memoryUsage: this.estimateMemoryUsage(),
      _indexSize: this.calculateIndexSize(),
      queryPerformance: {
        averageTime: _avgQueryTime,
        lastQueryTime: this.lastQueryTime,
      },
    };
  }

  /**
   * Optimize graph performance
   */
  optimize(): void {
    if (this.config.enableIndexing) {
      this.rebuildIndices();
    }

    // Clean up old query times
    if (this.queryTimes.length > 1000) {
      this.queryTimes = this.queryTimes.slice(-100);
    }
  }

  /**
   * Get all nodes (for debugging/testing)
   */
  getAllNodes(): CodeNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Get all edges for a _node
   */
  getEdges(nodeId: string): Edge[] {
    const _edgeSet = this.edges.get(nodeId);
    return _edgeSet ? Array.from(_edgeSet) : [];
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.nodes.clear();
    this.edges.clear();
    this.reverseEdges.clear();
    this.queryTimes = [];
    this.lastQueryTime = 0;
    this.initializeIndices();
  }

  // === Private Methods ===

  private initializeIndices(): void {
    this.typeIndex.clear();
    this.pathIndex.clear();
    this.nameIndex.clear();
  }

  private updateIndices(_node: CodeNode): void {
    // Type index
    if (!this.typeIndex.has(_node.type)) {
      this.typeIndex.set(_node.type, new Set());
    }
    this.typeIndex.get(_node.type)!.add(_node.id);

    // Path index
    this.pathIndex.set(_node._path, _node.id);

    // Name index
    const _lowerName = _node.name.toLowerCase();
    if (!this.nameIndex.has(_lowerName)) {
      this.nameIndex.set(_lowerName, new Set());
    }
    this.nameIndex.get(_lowerName)!.add(_node.id);
  }

  private removeFromIndices(_node: CodeNode): void {
    // Type index
    const _typeSet = this.typeIndex.get(_node.type);
    if (_typeSet) {
      typeSet.delete(_node.id);
      if (_typeSet.size === 0) {
        this.typeIndex.delete(_node.type);
      }
    }

    // Path index
    this.pathIndex.delete(_node._path);

    // Name index
    const _lowerName = _node.name.toLowerCase();
    const _nameSet = this.nameIndex.get(_lowerName);
    if (_nameSet) {
      nameSet.delete(_node.id);
      if (_nameSet.size === 0) {
        this.nameIndex.delete(_lowerName);
      }
    }
  }

  private rebuildIndices(): void {
    this.initializeIndices();
    for (const _node of this.nodes.values()) {
      this.updateIndices(_node);
    }
  }

  private evictLRUNode(): void {
    let oldestNode: CodeNode | null = null;
    let oldestTime = Date.now();

    for (const _node of this.nodes.values()) {
      const _lastAccessed = _node.metadata._lastAccessed?.getTime() || 0;
      if (_lastAccessed < oldestTime) {
        oldestTime = _lastAccessed;
        oldestNode = _node;
      }
    }

    if (oldestNode) {
      this.removeNode(oldestNode.id);
    }
  }

  private recordQueryTime(time: number): void {
    this.lastQueryTime = time;
    this.queryTimes.push(time);

    // Keep only last 100 query times
    if (this.queryTimes.length > 100) {
      this.queryTimes.shift();
    }
  }

  private calculateMaxDepth(): number {
    // Simple approximation - would need full graph traversal for exact value
    return Math.min(10, Math.floor(Math.log(this.nodes.size + 1)));
  }

  private estimateMemoryUsage(): number {
    // Rough estimation in MB (avoid calling getStats() to prevent recursion)
    const _nodeSize = this.nodes.size * 1000; // ~1KB per _node

    // Calculate edge count directly
    let edgeCount = 0;
    for (const _edgeSet of this.edges.values()) {
      edgeCount += _edgeSet.size;
    }
    const _edgeSize = edgeCount * 200; // ~200 bytes per edge

    const _indexSize = this.calculateIndexSize();

    return Math.round((_nodeSize + _edgeSize + _indexSize) / (1024 * 1024));
  }

  private calculateIndexSize(): number {
    let size = 0;
    size += this.typeIndex.size * 100;
    size += this.pathIndex.size * 100;
    size += this.nameIndex.size * 100;
    return size;
  }
}
