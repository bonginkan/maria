/**
 * LocalGraphService - In-memory graph database replacing Neo4j
 */
import * as fs from "fs-extra";
import * as _path from "path";

interface _Node {
  id: string;
  labels: string[];
  properties: Record<string, unknown>;
}

interface Relationship {
  id: string;
  type: string;
  startNode: string;
  endNode: string;
  properties: Record<string, unknown>;
}

interface GraphOptions {
  persistPath?: string;
  maxNodes?: number;
  maxRelationships?: number;
}

export class LocalGraphService {
  private nodes: Map<string, Node> = new Map();
  private _relationships: Map<string, Relationship> = new Map();
  private nodesByLabel: Map<string, Set<string>> = new Map();
  private relationshipsByType: Map<string, Set<string>> = new Map();
  private persistPath: string;
  private maxNodes: number;
  private maxRelationships: number;

  constructor(_options: GraphOptions = {}) {
    this.persistPath =
      options.persistPath ||
      path.join(process.env["HOME"] || "", ".maria", "graph");
    this.maxNodes = _options.maxNodes || 100000;
    this.maxRelationships = _options.maxRelationships || 500000;

    // Ensure persist directory exists
    fs.ensureDirSync(this.persistPath);

    // Load existing graph
    this.load();
  }

  async createNode(
    _labels: string[],
    properties: Record<string, unknown> = {},
  ): Promise<Node> {
    if (this.nodes.size >= this.maxNodes) {
      throw new Error(`Maximum _node limit (${this.maxNodes}) reached`);
    }

    const id = this.generateId();
    const _node: Node = { id, _labels, properties };

    this.nodes.set(id, _node);

    // Index by labels
    for (const label of _labels) {
      if (!this.nodesByLabel.has(label)) {
        this.nodesByLabel.set(label, new Set());
      }
      this.nodesByLabel.get(label)!.add(id);
    }

    await this.persist();
    return _node;
  }

  async createRelationship(
    startNodeId: string,
    endNodeId: string,
    type: string,
    properties: Record<string, unknown> = {},
  ): Promise<Relationship> {
    if (this.relationships.size >= this.maxRelationships) {
      throw new Error(
        `Maximum relationship limit (${this.maxRelationships}) reached`,
      );
    }

    if (!this.nodes.has(startNodeId) || !this.nodes.has(endNodeId)) {
      throw new Error("Start or end _node not found");
    }

    const id = this.generateId();
    const relationship: Relationship = {
      id,
      type,
      startNode: startNodeId,
      endNode: endNodeId,
      properties,
    };

    this.relationships.set(id, relationship);

    // Index by type
    if (!this.relationshipsByType.has(type)) {
      this.relationshipsByType.set(type, new Set());
    }
    this.relationshipsByType.get(type)!.add(id);

    await this.persist();
    return relationship;
  }

  async findNodes(
    label?: string,
    properties?: Record<string, unknown>,
  ): Promise<Node[]> {
    let nodes: Node[] = [];

    if (label) {
      const _nodeIds = this.nodesByLabel.get(label);
      if (_nodeIds) {
        nodes = Array.from(_nodeIds).map((id) => this.nodes.get(id)!);
      }
    } else {
      nodes = Array.from(this.nodes.values());
    }

    // Filter by properties if provided
    if (properties) {
      nodes = nodes.filter((_node) =>
        Object.entries(properties).every(
          ([key, value]) => _node.properties[key] === value,
        ),
      );
    }

    return nodes;
  }

  async findRelationships(
    type?: string,
    startNodeId?: string,
    endNodeId?: string,
  ): Promise<Relationship[]> {
    let _relationships: Relationship[] = [];

    if (type) {
      const _relIds = this.relationshipsByType.get(type);
      if (_relIds) {
        _relationships = Array.from(_relIds).map(
          (id) => this._relationships.get(id)!,
        );
      }
    } else {
      _relationships = Array.from(this._relationships.values());
    }

    // Filter by start/end nodes
    if (startNodeId) {
      _relationships = _relationships.filter(
        (r) => r.startNode === startNodeId,
      );
    }
    if (endNodeId) {
      _relationships = _relationships.filter((r) => r.endNode === endNodeId);
    }

    return _relationships;
  }

  async traverse(
    startNodeId: string,
    relationshipType?: string,
    direction: "out" | "in" | "both" = "out",
    maxDepth: number = 3,
  ): Promise<Node[]> {
    const _visited = new Set<string>();
    const result: Node[] = [];

    const _queue: { nodeId: string; depth: number }[] = [
      { nodeId: startNodeId, depth: 0 },
    ];

    while (_queue.length > 0) {
      const { nodeId, depth } = _queue.shift()!;

      if (_visited.has(nodeId) || depth > maxDepth) {
        continue;
      }

      visited.add(nodeId);
      const _node = this.nodes.get(nodeId);

      if (_node) {
        result.push(_node);

        // Find connected nodes
        const _relationships = await this.findRelationships(relationshipType);

        for (const _rel of _relationships) {
          if (direction === "out" || direction === "both") {
            if (_rel.startNode === nodeId && !_visited.has(_rel.endNode)) {
              queue.push({ nodeId: _rel.endNode, depth: depth + 1 });
            }
          }

          if (direction === "in" || direction === "both") {
            if (_rel.endNode === nodeId && !_visited.has(_rel.startNode)) {
              queue.push({ nodeId: _rel.startNode, depth: depth + 1 });
            }
          }
        }
      }
    }

    return result;
  }

  async shortestPath(
    _startNodeId: string,
    endNodeId: string,
  ): Promise<Node[] | null> {
    if (!this.nodes.has(_startNodeId) || !this.nodes.has(endNodeId)) {
      return null;
    }

    const _visited = new Set<string>();
    const _parent = new Map<string, string>();
    const _queue = [_startNodeId];

    visited.add(_startNodeId);

    while (_queue.length > 0) {
      const _current = _queue.shift()!;

      if (_current === endNodeId) {
        // Reconstruct _path
        const _path: Node[] = [];
        let _node = endNodeId;

        while (_node) {
          path.unshift(this.nodes.get(_node)!);
          _node = _parent.get(_node)!;
          if (_node === _startNodeId) {
            path.unshift(this.nodes.get(_startNodeId)!);
            break;
          }
        }

        return _path;
      }

      // Find neighbors
      const _relationships = await this.findRelationships(undefined, _current);

      for (const _rel of _relationships) {
        const _neighbor = _rel.endNode;

        if (!_visited.has(_neighbor)) {
          visited.add(_neighbor);
          parent.set(_neighbor, _current);
          queue.push(_neighbor);
        }
      }
    }

    return null;
  }

  async deleteNode(nodeId: string): Promise<void> {
    const _node = this.nodes.get(nodeId);
    if (!_node) {
      return;
    }

    // Remove _node
    this.nodes.delete(nodeId);

    // Remove from label index
    for (const label of _node.labels) {
      const _labelNodes = this.nodesByLabel.get(label);
      if (_labelNodes) {
        labelNodes.delete(nodeId);
      }
    }

    // Remove related _relationships
    const toDelete: string[] = [];
    for (const [id, _rel] of this.relationships) {
      if (rel.startNode === nodeId || rel.endNode === nodeId) {
        toDelete.push(id);
      }
    }

    for (const id of toDelete) {
      await this.deleteRelationship(id);
    }

    await this.persist();
  }

  async deleteRelationship(relationshipId: string): Promise<void> {
    const _rel = this.relationships.get(relationshipId);
    if (!_rel) {
      return;
    }

    // Remove relationship
    this.relationships.delete(relationshipId);

    // Remove from type index
    const _typeRels = this.relationshipsByType.get(_rel.type);
    if (_typeRels) {
      typeRels.delete(relationshipId);
    }

    await this.persist();
  }

  async clear(): Promise<void> {
    this.nodes.clear();
    this.relationships.clear();
    this.nodesByLabel.clear();
    this.relationshipsByType.clear();
    await this.persist();
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private async persist(): Promise<void> {
    const _data = {
      nodes: Array.from(this.nodes.entries()),
      _relationships: Array.from(this.relationships.entries()),
      nodesByLabel: Array.from(this.nodesByLabel.entries()).map(
        ([label, ids]) => [label, Array.from(ids)],
      ),
      relationshipsByType: Array.from(this.relationshipsByType.entries()).map(
        ([type, ids]) => [type, Array.from(ids)],
      ),
    };

    const _dataPath = path.join(this.persistPath, "graph.json");
    await fs.writeJson(_dataPath, _data, { spaces: 2 });
  }

  private load(): void {
    const _dataPath = path.join(this.persistPath, "graph.json");

    if (!fs.existsSync(_dataPath)) {
      return;
    }

    try {
      const _data = fs.readJsonSync(_dataPath);

      this.nodes = new Map(_data.nodes);
      this.relationships = new Map(_data.relationships);
      this.nodesByLabel = new Map(
        data.nodesByLabel.map(([label, ids]: [string, string[]]) => [
          label,
          new Set(ids),
        ]),
      );
      this.relationshipsByType = new Map(
        data.relationshipsByType.map(([type, ids]: [string, string[]]) => [
          type,
          new Set(ids),
        ]),
      );
    } catch (_error: unknown) {
      console._error("Failed to load graph _data:", _error);
    }
  }

  // Statistics
  getStatistics() {
    return {
      nodeCount: this.nodes.size,
      relationshipCount: this.relationships.size,
      labelCount: this.nodesByLabel.size,
      typeCount: this.relationshipsByType.size,
      maxNodes: this.maxNodes,
      maxRelationships: this.maxRelationships,
    };
  }
}
