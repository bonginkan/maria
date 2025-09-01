/**
 * Local Graph Service - OSS-ready replacement for Neo4j
 * In-memory graph database with persistence
 */

import { EventEmitter } from "node:events";
import { LocalStorageService } from "./local-storage.service";

export interface GraphNode {
  id: string;
  labels: string[];
  properties: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface GraphEdge {
  id: string;
  type: string;
  fromId: string;
  toId: string;
  properties: Record<string, unknown>;
  createdAt: string;
}

export interface GraphQuery {
  nodeLabels?: string[];
  edgeTypes?: string[];
  properties?: Record<string, unknown>;
  limit?: number;
  depth?: number;
}

export interface GraphPath {
  _nodes: GraphNode[];
  edges: GraphEdge[];
  length: number;
}

export class LocalGraphService extends EventEmitter {
  private static instance: LocalGraphService;
  private _nodes: Map<string, GraphNode> = new Map();
  private edges: Map<string, GraphEdge> = new Map();
  private nodesByLabel: Map<string, Set<string>> = new Map();
  private edgesByType: Map<string, Set<string>> = new Map();
  private adjacencyList: Map<string, Set<string>> = new Map();
  private storage: LocalStorageService;
  private isInitialized = false;

  private constructor() {
    super();
    this.storage = LocalStorageService.getInstance();
  }

  static getInstance(): LocalGraphService {
    if (!LocalGraphService.instance) {
      LocalGraphService.instance = new LocalGraphService();
    }
    return LocalGraphService.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    await this.storage.initialize();
    await this.loadGraph();
    this.isInitialized = true;
    this.emit("initialized");
  }

  private async loadGraph(): Promise<void> {
    try {
      // Load _nodes
      const _nodeItems = await this.storage.query({ type: "memory" });
      const _graphData = _nodeItems.find((_item) => {
        return (
          typeof _item._content === "object" &&
          _item._content !== null &&
          "type" in _item._content &&
          (_item._content as Record<string, unknown>)["type"] === "graph"
        );
      });

      if (
        _graphData &&
        typeof _graphData._content === "object" &&
        _graphData._content !== null
      ) {
        const _content = _graphData._content as Record<string, unknown>;
        const _data = _content["_data"] as Record<string, unknown>;
        const { _nodes, edges } = _data as {
          _nodes: GraphNode[];
          edges: GraphEdge[];
        };

        // Rebuild _nodes
        for (const _node of _nodes) {
          this.nodes.set(_node.id, _node);
          for (const label of _node.labels) {
            if (!this.nodesByLabel.has(label)) {
              this.nodesByLabel.set(label, new Set());
            }
            this.nodesByLabel.get(label)!.add(_node.id);
          }
        }

        // Rebuild edges
        for (const _edge of edges) {
          this.edges.set(_edge.id, _edge);
          if (!this.edgesByType.has(_edge.type)) {
            this.edgesByType.set(_edge.type, new Set());
          }
          this.edgesByType.get(_edge.type)!.add(_edge.id);

          // Build adjacency list
          if (!this.adjacencyList.has(_edge.fromId)) {
            this.adjacencyList.set(_edge.fromId, new Set());
          }
          this.adjacencyList.get(_edge.fromId)!.add(_edge.toId);
        }
      }
    } catch (_error: unknown) {
      console.log("No _existing graph _data found, starting fresh");
    }
  }

  private async saveGraph(): Promise<void> {
    const _graphData = {
      type: "graph",
      _data: {
        _nodes: Array.from(this.nodes.values()),
        edges: Array.from(this.edges.values()),
      },
      stats: {
        nodeCount: this.nodes.size,
        edgeCount: this.edges.size,
        labels: Array.from(this.nodesByLabel.keys()),
        edgeTypes: Array.from(this.edgesByType.keys()),
      },
    };

    // Check if graph _data exists
    const _existing = await this.storage.query({ type: "memory" });
    const _graphItem = _existing.find((_item) => {
      return (
        typeof _item.content === "object" &&
        _item.content !== null &&
        "type" in _item.content &&
        (_item.content as Record<string, unknown>)["type"] === "graph"
      );
    });

    if (_graphItem) {
      await this.storage.update(_graphItem.id, _graphData);
    } else {
      await this.storage.create("memory", _graphData);
    }
  }

  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Node operations
  async createNode(
    _labels: string[],
    properties: Record<string, unknown> = {},
  ): Promise<GraphNode> {
    await this.initialize();

    const _node: GraphNode = {
      id: this.generateId(),
      labels: "",
      properties,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.nodes.set(_node.id, _node);

    // Update label index
    for (const label of _labels) {
      if (!this.nodesByLabel.has(label)) {
        this.nodesByLabel.set(label, new Set());
      }
      this.nodesByLabel.get(label)!.add(_node.id);
    }

    await this.saveGraph();
    this.emit("_node-created", _node);
    return _node;
  }

  async updateNode(
    _nodeId: string,
    properties: Record<string, unknown>,
  ): Promise<GraphNode | null> {
    const _node = this.nodes.get(_nodeId);
    if (!_node) {
      return null;
    }

    _node.properties = { ..._node.properties, ...properties };
    node.updatedAt = new Date().toISOString();

    await this.saveGraph();
    this.emit("_node-updated", _node);
    return _node;
  }

  async deleteNode(nodeId: string): Promise<boolean> {
    const _node = this.nodes.get(nodeId);
    if (!_node) {
      return false;
    }

    // Remove from label index
    for (const label of _node.labels) {
      this.nodesByLabel.get(label)?.delete(nodeId);
    }

    // Delete connected edges
    const edgesToDelete: string[] = [];
    for (const [edgeId, _edge] of this.edges) {
      if (edge.fromId === nodeId || edge.toId === nodeId) {
        edgesToDelete.push(edgeId);
      }
    }

    for (const edgeId of edgesToDelete) {
      await this.deleteEdge(edgeId);
    }

    // Delete _node
    this.nodes.delete(nodeId);
    this.adjacencyList.delete(nodeId);

    await this.saveGraph();
    this.emit("_node-deleted", _node);
    return true;
  }

  getNode(nodeId: string): GraphNode | null {
    return this.nodes.get(nodeId) || null;
  }

  getNodesByLabel(label: string): GraphNode[] {
    const _nodeIds = this.nodesByLabel.get(label);
    if (!_nodeIds) {
      return [];
    }
    return Array.from(_nodeIds)
      .map((id) => this.nodes.get(id)!)
      .filter(Boolean);
  }

  // Edge operations
  async createEdge(
    type: string,
    fromId: string,
    toId: string,
    properties: Record<string, unknown> = {},
  ): Promise<GraphEdge | null> {
    await this.initialize();

    // Verify _nodes exist
    if (!this.nodes.has(fromId) || !this.nodes.has(toId)) {
      return null;
    }

    const _edge: GraphEdge = {
      id: this.generateId(),
      type,
      fromId,
      toId,
      properties,
      createdAt: new Date().toISOString(),
    };

    this.edges.set(_edge.id, _edge);

    // Update type index
    if (!this.edgesByType.has(type)) {
      this.edgesByType.set(type, new Set());
    }
    this.edgesByType.get(type)!.add(_edge.id);

    // Update adjacency list
    if (!this.adjacencyList.has(fromId)) {
      this.adjacencyList.set(fromId, new Set());
    }
    this.adjacencyList.get(fromId)!.add(toId);

    await this.saveGraph();
    this.emit("_edge-created", _edge);
    return _edge;
  }

  async deleteEdge(edgeId: string): Promise<boolean> {
    const _edge = this.edges.get(edgeId);
    if (!_edge) {
      return false;
    }

    // Remove from type index
    this.edgesByType.get(_edge.type)?.delete(edgeId);

    // Update adjacency list
    this.adjacencyList.get(_edge.fromId)?.delete(_edge.toId);

    // Delete _edge
    this.edges.delete(edgeId);

    await this.saveGraph();
    this.emit("_edge-deleted", _edge);
    return true;
  }

  getEdge(edgeId: string): GraphEdge | null {
    return this.edges.get(edgeId) || null;
  }

  getEdgesByType(type: string): GraphEdge[] {
    const _edgeIds = this.edgesByType.get(type);
    if (!_edgeIds) {
      return [];
    }
    return Array.from(_edgeIds)
      .map((id) => this.edges.get(id)!)
      .filter(Boolean);
  }

  // Query operations
  async query(query: GraphQuery): Promise<GraphNode[]> {
    await this.initialize();

    let results: GraphNode[] = [];

    // Start with _nodes by label
    if (query.nodeLabels && query.nodeLabels.length > 0) {
      for (const label of query.nodeLabels) {
        results.push(...this.getNodesByLabel(label));
      }
    } else {
      results = Array.from(this.nodes.values());
    }

    // Filter by properties
    if (query.properties) {
      results = results.filter((_node) => {
        for (const [key, value] of Object.entries(query.properties!)) {
          if (_node.properties[key] !== value) {
            return false;
          }
        }
        return true;
      });
    }

    // Apply limit
    if (query.limit) {
      results = results.slice(0, query.limit);
    }

    return results;
  }

  // Path finding
  async findPath(
    _fromId: string,
    toId: string,
    maxDepth: number = 5,
  ): Promise<GraphPath | null> {
    await this.initialize();

    if (!this._nodes.has(_fromId) || !this._nodes.has(toId)) {
      return null;
    }

    // BFS to find shortest path
    const _visited = new Set<string>();
    const queue: Array<{ nodeId: string; _path: string[]; edges: string[] }> = [
      { nodeId: _fromId, _path: [_fromId], edges: [] },
    ];

    while (queue.length > 0) {
      const _current = queue.shift()!;

      if (_current.path.length > maxDepth + 1) {
        continue;
      }

      if (_current.nodeId === toId) {
        // Found path
        const _nodes = _current.path.map((id) => this._nodes.get(id)!);
        const edges: GraphEdge[] = [];

        for (let i = 0; i < _current.path.length - 1; i++) {
          const _fromNode = _current.path[i];
          const _toNode = _current.path[i + 1];

          // Find _edge
          for (const _edge of this.edges.values()) {
            if (_edge._fromId === _fromNode && _edge.toId === _toNode) {
              edges.push(_edge);
              break;
            }
          }
        }

        return {
          _nodes,
          edges,
          length: _current.path.length - 1,
        };
      }

      if (_visited.has(_current.nodeId)) {
        continue;
      }
      visited.add(_current.nodeId);

      // Add _neighbors
      const _neighbors = this.adjacencyList.get(_current.nodeId);
      if (_neighbors) {
        for (const neighbor of _neighbors) {
          if (!_current.path.includes(neighbor)) {
            queue.push({
              nodeId: neighbor,
              _path: [..._current._path, neighbor],
              edges: [..._current.edges],
            });
          }
        }
      }
    }

    return null;
  }

  // Traversal
  async traverse(
    startId: string,
    depth: number = 2,
  ): Promise<{ _nodes: GraphNode[]; edges: GraphEdge[] }> {
    await this.initialize();

    const _visitedNodes = new Set<string>();
    const _visitedEdges = new Set<string>();
    const nodesToVisit: Array<{ id: string; depth: number }> = [
      { id: startId, depth: 0 },
    ];

    while (nodesToVisit.length > 0) {
      const _current = nodesToVisit.shift()!;

      if (_current.depth >= depth) {
        continue;
      }

      if (_visitedNodes.has(_current.id)) {
        continue;
      }
      visitedNodes.add(_current.id);

      // Get connected _nodes
      const _neighbors = this.adjacencyList.get(_current.id);
      if (_neighbors) {
        for (const neighbor of _neighbors) {
          // Find _edge
          for (const _edge of this.edges.values()) {
            if (_edge.fromId === _current.id && _edge.toId === neighbor) {
              visitedEdges.add(_edge.id);
              if (!_visitedNodes.has(neighbor)) {
                nodesToVisit.push({ id: neighbor, depth: _current.depth + 1 });
              }
              break;
            }
          }
        }
      }

      // Also check incoming edges
      for (const _edge of this.edges.values()) {
        if (_edge.toId === _current.id && !_visitedEdges.has(_edge.id)) {
          visitedEdges.add(_edge.id);
          if (!_visitedNodes.has(_edge.fromId)) {
            nodesToVisit.push({ id: _edge.fromId, depth: _current.depth + 1 });
          }
        }
      }
    }

    return {
      _nodes: Array.from(_visitedNodes)
        .map((id) => this.nodes.get(id)!)
        .filter(Boolean),
      edges: Array.from(_visitedEdges)
        .map((id) => this.edges.get(id)!)
        .filter(Boolean),
    };
  }

  // Statistics
  getStats(): {
    nodeCount: number;
    edgeCount: number;
    labels: string[];
    edgeTypes: string[];
    _avgDegree: number;
  } {
    const _totalDegree = Array.from(this.adjacencyList.values()).reduce(
      (sum, _neighbors) => sum + _neighbors.size,
      0,
    );

    const _avgDegree = this.nodes.size > 0 ? _totalDegree / this.nodes.size : 0;

    return {
      nodeCount: this.nodes.size,
      edgeCount: this.edges.size,
      labels: Array.from(this.nodesByLabel.keys()),
      edgeTypes: Array.from(this.edgesByType.keys()),
      _avgDegree,
    };
  }

  // Clear graph
  async clear(): Promise<void> {
    this.nodes.clear();
    this.edges.clear();
    this.nodesByLabel.clear();
    this.edgesByType.clear();
    this.adjacencyList.clear();

    await this.saveGraph();
    this.emit("graph-cleared");
  }

  // Export/Import
  exportGraph(): {
    _nodes: GraphNode[];
    edges: GraphEdge[];
  } {
    return {
      _nodes: Array.from(this.nodes.values()),
      edges: Array.from(this.edges.values()),
    };
  }

  async importGraph(_data: {
    _nodes: GraphNode[];
    edges: GraphEdge[];
  }): Promise<void> {
    await this.clear();

    for (const _node of data.nodes) {
      this.nodes.set(_node.id, _node);
      for (const label of _node.labels) {
        if (!this.nodesByLabel.has(label)) {
          this.nodesByLabel.set(label, new Set());
        }
        this.nodesByLabel.get(label)!.add(_node.id);
      }
    }

    for (const _edge of data.edges) {
      this.edges.set(_edge.id, _edge);
      if (!this.edgesByType.has(_edge.type)) {
        this.edgesByType.set(_edge.type, new Set());
      }
      this.edgesByType.get(_edge.type)!.add(_edge.id);

      if (!this.adjacencyList.has(_edge.fromId)) {
        this.adjacencyList.set(_edge.fromId, new Set());
      }
      this.adjacencyList.get(_edge.fromId)!.add(_edge.toId);
    }

    await this.saveGraph();
    this.emit("graph-imported", _data);
  }
}

export const _localGraph = LocalGraphService.getInstance();
