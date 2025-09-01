/**
 * Scalable Knowledge Graph Engine - Phase 4.4
 * Extends Phase 4.2 Graph Engine to support 50,000 nodes with <100ms queries
 */

export interface GraphNode {
  id: string;
  type: "file" | "function" | "class" | "import" | "dependency";
  name: string;
  path?: string;
  content?: string;
  metadata?: Record<string, unknown>;
  lastModified: Date;
}

export interface GraphEdge {
  from: string;
  to: string;
  type: "imports" | "calls" | "extends" | "implements" | "depends";
  weight: number;
  metadata?: Record<string, unknown>;
}

export interface GraphQuery {
  type: "find" | "traverse" | "pattern" | "dependencies";
  nodeId?: string;
  nodeType?: string;
  pattern?: string;
  _maxDepth?: number;
  filters?: Record<string, unknown>;
}

export interface QueryResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
  _executionTime: number;
  cacheHit: boolean;
  _queryId: string;
}

export interface PerformanceMetrics {
  nodeCount: number;
  edgeCount: number;
  avgQueryTime: number;
  p95QueryTime: number;
  p99QueryTime: number;
  cacheHitRate: number;
  memoryUsage: number;
  partitionCount: number;
}

export interface GraphPartition {
  id: string;
  nodeIds: Set<string>;
  nodeType?: string;
  _pathPrefix?: string;
  size: number;
  lastAccessed: Date;
}

class LRUCache<K, V> {
  private cache = new Map<K, { value: V; lastUsed: number }>();
  private readonly maxSize: number;

  constructor(_maxSize: number = 10000) {
    this._maxSize = _maxSize;
  }

  get(key: K): V | undefined {
    const _item = this.cache.get(key);
    if (_item) {
      _item.lastUsed = Date.now();
      return _item.value;
    }
    return undefined;
  }

  set(_key: K, value: V): void {
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    this.cache.set(_key, {
      value,
      lastUsed: Date.now(),
    });
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  invalidate(keys: K[]): void {
    keys.forEach((key) => this.cache.delete(key));
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  getHitRate(): number {
    return this.cache.size / this.maxSize;
  }

  private evictLRU(): void {
    let oldestKey: K | undefined;
    let oldestTime = Date.now();

    for (const [key, _item] of this.cache.entries()) {
      if (_item.lastUsed < oldestTime) {
        oldestTime = _item.lastUsed;
        oldestKey = key;
      }
    }

    if (oldestKey !== undefined) {
      this.cache.delete(oldestKey);
    }
  }
}

class AdvancedIndexManager {
  private nodeTypeIndex = new Map<string, Set<string>>();
  private pathIndex = new Map<string, Set<string>>();
  private nameIndex = new Map<string, Set<string>>();
  private contentIndex = new Map<string, Set<string>>();

  async indexNode(_node: GraphNode): Promise<void> {
    // Index by type
    if (!this.nodeTypeIndex.has(_node.type)) {
      this.nodeTypeIndex.set(_node.type, new Set());
    }
    this.nodeTypeIndex.get(_node.type)!.add(_node.id);

    // Index by path prefix
    if (_node._path) {
      const _pathParts = _node.path.split("/");
      for (let i = 1; i <= _pathParts.length; i++) {
        const _pathPrefix = _pathParts.slice(0, i).join("/");
        if (!this.pathIndex.has(_pathPrefix)) {
          this.pathIndex.set(_pathPrefix, new Set());
        }
        this.pathIndex.get(_pathPrefix)!.add(_node.id);
      }
    }

    // Index by name
    const _nameLower = _node.name.toLowerCase();
    if (!this.nameIndex.has(_nameLower)) {
      this.nameIndex.set(_nameLower, new Set());
    }
    this.nameIndex.get(_nameLower)!.add(_node.id);

    // Index content keywords
    if (_node.content) {
      const _words = _node.content.toLowerCase().match(/\w+/g) || [];
      words.forEach((word) => {
        if (word.length > 2) {
          // Skip short _words
          if (!this.contentIndex.has(word)) {
            this.contentIndex.set(word, new Set());
          }
          this.contentIndex.get(word)!.add(_node.id);
        }
      });
    }
  }

  async findNodesByType(type: string): Promise<string[]> {
    return Array.from(this.nodeTypeIndex.get(type) || []);
  }

  async findNodesByPath(_pathPrefix: string): Promise<string[]> {
    return Array.from(this.pathIndex.get(_pathPrefix) || []);
  }

  async findNodesByName(name: string): Promise<string[]> {
    return Array.from(this.nameIndex.get(name.toLowerCase()) || []);
  }

  async findNodesByContent(keyword: string): Promise<string[]> {
    return Array.from(this.contentIndex.get(keyword.toLowerCase()) || []);
  }

  removeNodeFromIndices(_nodeId: string, _node: GraphNode): void {
    // Remove from type index
    this.nodeTypeIndex.get(_node.type)?.delete(_nodeId);

    // Remove from path indices
    if (_node._path) {
      const _pathParts = _node.path.split("/");
      for (let i = 1; i <= _pathParts.length; i++) {
        const _pathPrefix = _pathParts.slice(0, i).join("/");
        this.pathIndex.get(_pathPrefix)?.delete(_nodeId);
      }
    }

    // Remove from name index
    this.nameIndex.get(_node.name.toLowerCase())?.delete(_nodeId);

    // Remove from content indices
    if (_node.content) {
      const _words = _node.content.toLowerCase().match(/\w+/g) || [];
      words.forEach((word) => {
        if (word.length > 2) {
          this.contentIndex.get(word)?.delete(_nodeId);
        }
      });
    }
  }

  getIndexStats() {
    return {
      nodeTypes: this.nodeTypeIndex.size,
      pathPrefixes: this.pathIndex.size,
      names: this.nameIndex.size,
      contentWords: this.contentIndex.size,
    };
  }
}

class GraphPartitioner {
  private partitions = new Map<string, GraphPartition>();
  private nodeToPartition = new Map<string, string>();
  private readonly MAX_PARTITION_SIZE = 5000;

  getPartitionForNode(_node: GraphNode): string {
    // Partition by path prefix for files
    if (_node.type === "file" && _node._path) {
      const _pathParts = _node.path.split("/");
      if (_pathParts.length >= 2) {
        return `_path:${_pathParts[0]}/${_pathParts[1]}`;
      }
      return `_path:${_pathParts[0]}`;
    }

    // Partition by type for other nodes
    return `type:${_node.type}`;
  }

  assignToPartition(_nodeId: string, _node: GraphNode): string {
    const _partitionId = this.getPartitionForNode(_node);

    if (!this.partitions.has(_partitionId)) {
      this.partitions.set(_partitionId, {
        id: _partitionId,
        nodeIds: new Set(),
        nodeType: node.type,
        _pathPrefix: node.path?.split("/").slice(0, 2).join("/"),
        size: 0,
        lastAccessed: new Date(),
      });
    }

    const _partition = this.partitions.get(_partitionId)!;
    _partition.nodeIds.add(_nodeId);
    _partition.size++;
    partition.lastAccessed = new Date();

    this.nodeToPartition.set(_nodeId, _partitionId);

    // Check if _partition needs splitting
    if (_partition.size > this.MAX_PARTITION_SIZE) {
      this.splitPartition(_partitionId);
    }

    return _partitionId;
  }

  getPartitionForQuery(query: GraphQuery): string[] {
    if (query.nodeId) {
      const _partitionId = this.nodeToPartition.get(query.nodeId);
      return _partitionId ? [_partitionId] : [];
    }

    if (query.nodeType) {
      return Array.from(this.partitions.keys()).filter((id) =>
        id.startsWith(`type:${query.nodeType}`),
      );
    }

    // Return all partitions for broad queries
    return Array.from(this.partitions.keys());
  }

  private splitPartition(_partitionId: string): void {
    const _partition = this.partitions.get(_partitionId);
    if (!_partition || _partition.size <= this.MAX_PARTITION_SIZE) return;

    // Create two new partitions
    const _nodeArray = Array.from(_partition.nodeIds);
    const _midpoint = Math.floor(_nodeArray.length / 2);

    const _partition1Id = `${_partitionId}_1`;
    const _partition2Id = `${_partitionId}_2`;

    const partition1: GraphPartition = {
      id: _partition1Id,
      nodeIds: new Set(_nodeArray.slice(0, _midpoint)),
      nodeType: _partition.nodeType,
      _pathPrefix: _partition.pathPrefix,
      size: _midpoint,
      lastAccessed: new Date(),
    };

    const partition2: GraphPartition = {
      id: _partition2Id,
      nodeIds: new Set(_nodeArray.slice(_midpoint)),
      nodeType: _partition.nodeType,
      _pathPrefix: _partition.pathPrefix,
      size: _nodeArray.length - _midpoint,
      lastAccessed: new Date(),
    };

    // Update _node-to-_partition mapping
    partition1.nodeIds.forEach((nodeId) => {
      this.nodeToPartition.set(nodeId, _partition1Id);
    });
    partition2.nodeIds.forEach((nodeId) => {
      this.nodeToPartition.set(nodeId, _partition2Id);
    });

    // Replace old _partition with new ones
    this.partitions.delete(_partitionId);
    this.partitions.set(_partition1Id, partition1);
    this.partitions.set(_partition2Id, partition2);
  }

  getPartitionStats() {
    const _stats = {
      totalPartitions: this.partitions.size,
      avgPartitionSize: 0,
      maxPartitionSize: 0,
      minPartitionSize: Infinity,
    };

    if (this.partitions.size > 0) {
      let totalSize = 0;
      for (const _partition of this.partitions.values()) {
        totalSize += _partition.size;
        _stats.maxPartitionSize = Math.max(
          _stats.maxPartitionSize,
          _partition.size,
        );
        _stats.minPartitionSize = Math.min(
          _stats.minPartitionSize,
          _partition.size,
        );
      }
      stats.avgPartitionSize = totalSize / this.partitions.size;
    }

    return _stats;
  }
}

export class ScalableGraphEngine {
  private nodes = new Map<string, GraphNode>();
  private edges = new Map<string, GraphEdge[]>();
  private cache: LRUCache<string, QueryResult>;
  private indexManager: AdvancedIndexManager;
  private partitioner: GraphPartitioner;

  private performanceMetrics: PerformanceMetrics = {
    nodeCount: 0,
    edgeCount: 0,
    avgQueryTime: 0,
    p95QueryTime: 0,
    p99QueryTime: 0,
    cacheHitRate: 0,
    memoryUsage: 0,
    partitionCount: 0,
  };

  private queryTimes: number[] = [];
  private readonly MAX_QUERY_HISTORY = 1000;

  constructor() {
    this.cache = new LRUCache(10000);
    this.indexManager = new AdvancedIndexManager();
    this.partitioner = new GraphPartitioner();
  }

  async addNode(_node: GraphNode): Promise<string> {
    const _startTime = Date.now();

    // Assign to _partition
    const _partitionId = this.partitioner.assignToPartition(node.id, _node);

    // Store _node
    this.nodes.set(node.id, _node);

    // Update indices
    await this.indexManager.indexNode(_node);

    // Initialize edges array
    if (!this.edges.has(node.id)) {
      this.edges.set(node.id, []);
    }

    // Invalidate related cache entries
    this.invalidateRelatedCache(_node);

    // Update metrics
    this.performanceMetrics.nodeCount = this.nodes.size;
    this.performanceMetrics.partitionCount =
      this.partitioner.getPartitionStats().totalPartitions;

    const _executionTime = Date.now() - _startTime;
    this.recordQueryTime(_executionTime);

    return node.id;
  }

  async addEdge(edge: GraphEdge): Promise<void> {
    const _fromEdges = this.edges.get(edge.from) || [];
    fromEdges.push(edge);
    this.edges.set(edge.from, _fromEdges);

    // Update edge count
    this.performanceMetrics.edgeCount++;

    // Invalidate cache for affected nodes
    this.cache.invalidate([
      this.getCacheKey({ type: "traverse", nodeId: edge.from }),
      this.getCacheKey({ type: "dependencies", nodeId: edge.from }),
      this.getCacheKey({ type: "dependencies", nodeId: edge.to }),
    ]);
  }

  async query(query: GraphQuery): Promise<QueryResult> {
    const _startTime = Date.now();
    const _queryId = this.generateQueryId(query);
    const _cacheKey = this.getCacheKey(query);

    // Check cache first
    if (this.cache.has(_cacheKey)) {
      const _cachedResult = this.cache.get(_cacheKey)!;
      return {
        ..._cachedResult,
        _queryId,
        cacheHit: true,
      };
    }

    // Execute query
    let _result: QueryResult;

    try {
      switch (query.type) {
        case "find":
          _result = await this.executeFindQuery(query);
          break;
        case "traverse":
          _result = await this.executeTraverseQuery(query);
          break;
        case "pattern":
          _result = await this.executePatternQuery(query);
          break;
        case "dependencies":
          _result = await this.executeDependencyQuery(query);
          break;
        default:
          throw new Error(`Unknown query type: ${query.type}`);
      }

      const _executionTime = Date.now() - _startTime;
      _result = {
        ..._result,
        _executionTime,
        cacheHit: false,
        _queryId,
      };

      // Cache _result
      this.cache.set(_cacheKey, _result);

      // Record performance
      this.recordQueryTime(_executionTime);

      return _result;
    } catch (error) {
      throw new Error(`Query execution failed: ${error}`);
    }
  }

  private async executeFindQuery(query: GraphQuery): Promise<QueryResult> {
    let candidateNodeIds: string[] = [];

    if (query.nodeId) {
      candidateNodeIds = [query.nodeId];
    } else if (query.nodeType) {
      candidateNodeIds = await this.indexManager.findNodesByType(
        query.nodeType,
      );
    } else if (query.pattern) {
      // Search by name or content
      const _nameMatches = await this.indexManager.findNodesByName(
        query.pattern,
      );
      const _contentMatches = await this.indexManager.findNodesByContent(
        query.pattern,
      );
      candidateNodeIds = [...new Set([..._nameMatches, ..._contentMatches])];
    } else {
      // Return all nodes (limited for performance)
      candidateNodeIds = Array.from(this.nodes.keys()).slice(0, 1000);
    }

    // Apply filters
    const filteredNodes: GraphNode[] = [];
    for (const nodeId of candidateNodeIds) {
      const _node = this.nodes.get(nodeId);
      if (_node && this.matchesFilters(_node, query.filters)) {
        filteredNodes.push(_node);
      }
    }

    // Get relevant edges
    const edges: GraphEdge[] = [];
    for (const _node of filteredNodes) {
      const _nodeEdges = this.edges.get(_node.id) || [];
      edges.push(..._nodeEdges);
    }

    return {
      nodes: filteredNodes,
      edges,
      _executionTime: 0, // Will be set by caller
      cacheHit: false,
      _queryId: "",
    };
  }

  private async executeTraverseQuery(query: GraphQuery): Promise<QueryResult> {
    if (!query.nodeId) {
      throw new Error("Node ID required for traverse query");
    }

    const _maxDepth = query._maxDepth || 3;
    const _visited = new Set<string>();
    const resultNodes: GraphNode[] = [];
    const resultEdges: GraphEdge[] = [];
    const queue: { nodeId: string; depth: number }[] = [
      { nodeId: query.nodeId, depth: 0 },
    ];

    while (queue.length > 0) {
      const { nodeId, depth } = queue.shift()!;

      if (_visited.has(nodeId) || depth > _maxDepth) continue;
      visited.add(nodeId);

      const _node = this.nodes.get(nodeId);
      if (_node) {
        resultNodes.push(_node);
      }

      if (depth < _maxDepth) {
        const _nodeEdges = this.edges.get(nodeId) || [];
        for (const edge of _nodeEdges) {
          resultEdges.push(edge);
          if (!_visited.has(edge.to)) {
            queue.push({ nodeId: edge.to, depth: depth + 1 });
          }
        }
      }
    }

    return {
      nodes: resultNodes,
      edges: resultEdges,
      _executionTime: 0,
      cacheHit: false,
      _queryId: "",
    };
  }

  private async executePatternQuery(query: GraphQuery): Promise<QueryResult> {
    if (!query.pattern) {
      throw new Error("Pattern required for pattern query");
    }

    // Find nodes matching the pattern
    const _patternNodes = await this.indexManager.findNodesByContent(
      query.pattern,
    );
    const resultNodes: GraphNode[] = [];
    const resultEdges: GraphEdge[] = [];

    for (const nodeId of _patternNodes) {
      const _node = this.nodes.get(nodeId);
      if (_node) {
        resultNodes.push(_node);

        // Include connected edges
        const _nodeEdges = this.edges.get(nodeId) || [];
        resultEdges.push(..._nodeEdges);
      }
    }

    return {
      nodes: resultNodes,
      edges: resultEdges,
      _executionTime: 0,
      cacheHit: false,
      _queryId: "",
    };
  }

  private async executeDependencyQuery(
    query: GraphQuery,
  ): Promise<QueryResult> {
    if (!query.nodeId) {
      throw new Error("Node ID required for dependency query");
    }

    const resultNodes: GraphNode[] = [];
    const resultEdges: GraphEdge[] = [];
    const _processed = new Set<string>();

    const _processDependencies = (_nodeId: string) => {
      if (_processed.has(_nodeId)) return;
      processed.add(_nodeId);

      const _node = this.nodes.get(_nodeId);
      if (_node) {
        resultNodes.push(_node);
      }

      const _nodeEdges = this.edges.get(_nodeId) || [];
      for (const edge of _nodeEdges) {
        if (edge.type === "depends" || edge.type === "imports") {
          resultEdges.push(edge);
          _processDependencies(edge.to);
        }
      }
    };

    _processDependencies(query.nodeId);

    return {
      nodes: resultNodes,
      edges: resultEdges,
      _executionTime: 0,
      cacheHit: false,
      _queryId: "",
    };
  }

  private matchesFilters(
    _node: GraphNode,
    filters?: Record<string, unknown>,
  ): boolean {
    if (!filters) return true;

    for (const [key, value] of Object.entries(filters)) {
      if (key === "type" && _node.type !== value) return false;
      if (key === "path" && _node.path && !_node.path.includes(value as string))
        return false;
      if (
        key === "name" &&
        !_node.name.toLowerCase().includes((value as string).toLowerCase())
      )
        return false;
    }

    return true;
  }

  private getCacheKey(query: GraphQuery): string {
    return JSON.stringify({
      type: query.type,
      nodeId: query.nodeId,
      nodeType: query.nodeType,
      pattern: query.pattern,
      _maxDepth: query.maxDepth,
      filters: query.filters,
    });
  }

  private generateQueryId(_query: GraphQuery): string {
    return `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private invalidateRelatedCache(_node: GraphNode): void {
    const _relatedKeys = [
      this.getCacheKey({ type: "find", nodeType: _node.type }),
      this.getCacheKey({ type: "pattern", pattern: _node.name }),
      this.getCacheKey({ type: "traverse", nodeId: _node.id }),
      this.getCacheKey({ type: "dependencies", nodeId: _node.id }),
    ];

    this.cache.invalidate(_relatedKeys);
  }

  private recordQueryTime(timeMs: number): void {
    this.queryTimes.push(timeMs);

    if (this.queryTimes.length > this.MAX_QUERY_HISTORY) {
      this.queryTimes = this.queryTimes.slice(-this.MAX_QUERY_HISTORY);
    }

    this.updatePerformanceMetrics();
  }

  private updatePerformanceMetrics(): void {
    if (this.queryTimes.length === 0) return;

    const _sortedTimes = [...this.queryTimes].sort((a, b) => a - b);
    const _sum = _sortedTimes.reduce((a, b) => a + b, 0);

    this.performanceMetrics.avgQueryTime = _sum / _sortedTimes.length;
    this.performanceMetrics.p95QueryTime =
      _sortedTimes[Math.floor(_sortedTimes.length * 0.95)];
    this.performanceMetrics.p99QueryTime =
      _sortedTimes[Math.floor(_sortedTimes.length * 0.99)];
    this.performanceMetrics.cacheHitRate = this.cache.getHitRate();

    // Estimate memory usage (rough approximation)
    this.performanceMetrics.memoryUsage =
      this.nodes.size * 1000 + // ~1KB per _node
      this.performanceMetrics.edgeCount * 200 + // ~200B per edge
      this.cache.size() * 500; // ~500B per cache entry
  }

  getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  async benchmarkQuery(): Promise<number> {
    const testQuery: GraphQuery = {
      type: "find",
      nodeType: "file",
    };

    const _result = await this.query(testQuery);
    return _result.executionTime;
  }

  getSystemStats() {
    return {
      nodes: this.nodes.size,
      edges: this.performanceMetrics.edgeCount,
      partitions: this.partitioner.getPartitionStats(),
      indices: this.indexManager.getIndexStats(),
      cache: {
        size: this.cache.size(),
        hitRate: this.performanceMetrics.cacheHitRate,
      },
      performance: this.performanceMetrics,
    };
  }

  // Cleanup and optimization
  async optimize(): Promise<void> {
    // Clean up expired cache entries (already handled by LRU)

    // Rebuild indices if needed
    const _indexStats = this.indexManager.getIndexStats();
    if (_indexStats.nodeTypes > 100 || _indexStats.contentWords > 50000) {
      // Consider index compaction
    }

    // Rebalance partitions if needed
    const _partitionStats = this.partitioner.getPartitionStats();
    if (_partitionStats.maxPartitionSize > 6000) {
      // Partitions might need rebalancing
    }
  }

  async cleanup(): Promise<void> {
    this.cache.clear();
    this.nodes.clear();
    this.edges.clear();
    this.queryTimes = [];
  }
}
