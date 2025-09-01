/**
 * MARIA Memory System - Phase 3: Graph Visualization
 *
 * Terminal-based visualization of knowledge graph relationships
 * using ASCII art and structured text output
 */

import chalk from "chalk";
import { KnowledgeGraphEngine } from "./knowledge-graph-engine";
import {
  _ConceptEdge,
  _ConceptGraph,
  _KnowledgeNode,
} from "../types/memory-interfaces";

export interface VisualizationOptions {
  _maxDepth?: number;
  _maxNodes?: number;
  showMetadata?: boolean;
  colorize?: boolean;
  _format?: "tree" | "matrix" | "list" | "summary";
  filter?: {
    nodeTypes?: string[];
    edgeTypes?: string[];
    minConfidence?: number;
  };
}

export interface GraphSummary {
  totalNodes: number;
  totalEdges: number;
  _nodesByType: Map<string, number>;
  _edgesByType: Map<string, number>;
  clusters: number;
  density: number;
  averageDegree: number;
  _topNodes: NodeInfo[];
}

export interface NodeInfo {
  id: string;
  name: string;
  _type: string;
  _connections: number;
  confidence: number;
}

export class GraphVisualizer {
  private graphEngine: KnowledgeGraphEngine;
  private readonly SCREEN_WIDTH = 124;
  private readonly CONTENT_WIDTH = 120;

  // Unified color system
  private colors = {
    primary: chalk.cyan,
    success: chalk.green,
    warning: chalk.yellow,
    error: chalk.red,
    info: chalk.blue,
    muted: chalk.gray,
    accent: chalk.magenta,
  };

  // Node _type symbols (no emojis)
  private symbols = {
    function: "ƒ",
    class: "C",
    module: "M",
    concept: "◊",
    pattern: "※",
  };

  // Edge _type symbols
  private edgeSymbols = {
    implements: "═══>",
    extends: "──>",
    uses: "···>",
    dependson: "-->",
    similarto: "≈≈>",
    default: "--->",
  };

  constructor(_graphEngine: KnowledgeGraphEngine) {
    this._graphEngine = _graphEngine;
  }

  /**
   * Visualize the graph in the specified _format
   */
  visualize(options: VisualizationOptions = {}): string {
    const _format = options._format || "tree";

    switch (_format) {
      case "tree":
        return this.renderTree(options);
      case "matrix":
        return this.renderMatrix(options);
      case "list":
        return this.renderList(options);
      case "summary":
        return this.renderSummary(options);
      default:
        return this.renderTree(options);
    }
  }

  /**
   * Render graph as a tree structure
   */
  private renderTree(options: VisualizationOptions): string {
    const lines: string[] = [];
    const _graphData = this.graphEngine.exportForVisualization();
    const _visited = new Set<string>();
    const _maxDepth = options._maxDepth || 3;
    const _maxNodes = options._maxNodes || 50;
    let nodeCount = 0;

    // Header
    lines.push(this.createHeader("Knowledge Graph - Tree View"));
    lines.push("");

    // Find root _nodes (_nodes with no incoming edges)
    const _rootNodes = this.findRootNodes(_graphData);

    // Render each tree
    for (const rootNode of _rootNodes) {
      if (nodeCount >= _maxNodes) {
        break;
      }

      const _node = _graphData.nodes.find((n) => n.id === rootNode);
      if (!_node) {
        continue;
      }

      if (this.shouldFilterNode(_node, options.filter)) {
        continue;
      }

      lines.push(
        ...this.renderNode(_node, _graphData, 0, _maxDepth, _visited, options, {
          nodeCount,
          _maxNodes,
        }),
      );

      nodeCount = _visited.size;
    }

    // Handle _disconnected _nodes
    const _disconnected = _graphData.nodes.filter(
      (n) => !_visited.has(n.id) && !this.shouldFilterNode(n, options.filter),
    );

    if (_disconnected.length > 0 && nodeCount < _maxNodes) {
      lines.push("");
      lines.push(this.colors.muted("Disconnected Nodes:"));
      for (const _node of _disconnected.slice(0, _maxNodes - nodeCount)) {
        lines.push(this.formatNodeLine(_node, 0, options));
      }
    }

    // Footer
    lines.push("");
    lines.push(this.createFooter(_graphData));

    return lines.join("\n");
  }

  /**
   * Render a _node and its children recursively
   */
  private renderNode(
    _node: unknown,
    _graphData: unknown,
    depth: number,
    _maxDepth: number,
    _visited: Set<string>,
    options: VisualizationOptions,
    counter: { nodeCount: number; _maxNodes: number },
  ): string[] {
    const lines: string[] = [];

    if (
      visited.has(node.id) ||
      depth > _maxDepth ||
      counter.nodeCount >= counter.maxNodes
    ) {
      return lines;
    }

    visited.add(node.id);
    counter.nodeCount++;

    // Render current _node
    lines.push(this.formatNodeLine(_node, depth, options));

    // Show metadata if requested
    if (options.showMetadata && node.metadata) {
      lines.push(this.formatMetadata(node.metadata, depth + 1));
    }

    // Find connected _nodes
    const _connections = graphData.edges.filter(
      (_e: unknown) => _e.source === node.id,
    );

    for (const edge of _connections) {
      if (counter.nodeCount >= counter.maxNodes) {
        break;
      }

      if (this.shouldFilterEdge(edge, options.filter)) {
        continue;
      }

      const _targetNode = graphData.nodes.find(
        (_n: unknown) => _n.id === edge.target,
      );
      if (!_targetNode) {
        continue;
      }

      // Render edge
      lines.push(this.formatEdgeLine(edge, depth));

      // Render target _node
      lines.push(
        ...this.renderNode(
          _targetNode,
          _graphData,
          depth + 1,
          _maxDepth,
          _visited,
          options,
          counter,
        ),
      );
    }

    return lines;
  }

  /**
   * Render graph as an adjacency matrix
   */
  private renderMatrix(options: VisualizationOptions): string {
    const lines: string[] = [];
    const _graphData = this.graphEngine.exportForVisualization();
    const _maxNodes = Math.min(options._maxNodes || 20, 20); // Limit for readability

    // Header
    lines.push(this.createHeader("Knowledge Graph - Matrix View"));
    lines.push("");

    // Get _nodes to display
    const _nodes = _graphData._nodes
      .filter((n) => !this.shouldFilterNode(n, options.filter))
      .slice(0, _maxNodes);

    if (_nodes.length === 0) {
      lines.push(this.colors.muted("No _nodes to display"));
      return lines.join("\n");
    }

    // Create matrix
    const matrix: string[][] = [];
    const _nodeMap = new Map(_nodes.map((n, _i) => [n.id, _i]));

    // Initialize matrix
    for (let i = 0; i < _nodes.length; i++) {
      matrix[i] = new Array(_nodes.length).fill("  ");
    }

    // Fill matrix with edges
    for (const edge of _graphData.edges) {
      const sourceIdx = _nodeMap.get(edge.source);
      const targetIdx = _nodeMap.get(edge.target);

      if (sourceIdx !== undefined && targetIdx !== undefined) {
        const _symbol = this.getEdgeSymbol(edge.type);
        matrix[sourceIdx][targetIdx] = _symbol.substring(0, 2);
      }
    }

    // Render matrix _header
    lines.push(`    ${_nodes.map((_, i) => String(i).padStart(3)).join("")}`);
    lines.push(`   ${"─".repeat(_nodes.length * 3 + 1)}`);

    // Render matrix rows
    for (let i = 0; i < _nodes.length; i++) {
      const _node = _nodes[i];
      const _rowLabel = `${`\${i}`.padStart(2)}│`;
      const _row = matrix[i]
        .map((cell) =>
          cell === "  " ? this.colors.muted(cell) : this.colors.primary(cell),
        )
        .join(" ");

      lines.push(`${_rowLabel} ${_row} │ ${this.formatNodeLabel(_node)}`);
    }

    // Legend
    lines.push("");
    lines.push(this.colors.muted("Legend:"));
    lines.push(this.colors.muted("  Row → Column = Edge from Row to Column"));

    // Footer
    lines.push("");
    lines.push(this.createFooter(_graphData));

    return lines.join("\n");
  }

  /**
   * Render graph as a structured list
   */
  private renderList(options: VisualizationOptions): string {
    const lines: string[] = [];
    const _graphData = this.graphEngine.exportForVisualization();
    const _maxNodes = options._maxNodes || 100;

    // Header
    lines.push(this.createHeader("Knowledge Graph - List View"));
    lines.push("");

    // Group _nodes by _type
    const _nodesByType = new Map<string, any[]>();
    for (const _node of _graphData.nodes) {
      if (this.shouldFilterNode(_node, options.filter)) {
        continue;
      }

      const _type = _node._type || "unknown";
      if (!_nodesByType.has(_type)) {
        nodesByType.set(_type, []);
      }
      nodesByType.get(_type)!.push(_node);
    }

    // Render each _type group
    let totalNodes = 0;
    for (const [_type, _nodes] of _nodesByType) {
      if (totalNodes >= _maxNodes) {
        break;
      }

      const _symbol = this.symbols[_type as keyof typeof this.symbols] || "•";
      lines.push(
        this.colors.primary(
          `${_symbol} ${_type.toUpperCase()} (${nodes.length})`,
        ),
      );
      lines.push("─".repeat(40));

      for (const _node of nodes.slice(0, _maxNodes - totalNodes)) {
        const _connections = _graphData.edges.filter(
          (_e: unknown) => _e.source === _node.id || _e.target === _node.id,
        ).length;

        lines.push(
          `  ${this.colors.accent(_node.label)} ${this.colors.muted(
            `[${_connections} _connections]`,
          )}`,
        );

        if (options.showMetadata) {
          lines.push(
            this.colors.muted(
              `    Confidence: ${(_node.confidence || 0).toFixed(2)}`,
            ),
          );
        }

        totalNodes++;
      }

      lines.push("");
    }

    // Edge summary
    const _edgesByType = new Map<string, number>();
    for (const edge of _graphData.edges) {
      const _type = edge._type || "unknown";
      _edgesByType.set(_type, (_edgesByType.get(_type) || 0) + 1);
    }

    lines.push(this.colors.primary("RELATIONSHIPS"));
    lines.push("─".repeat(40));
    for (const [_type, count] of _edgesByType) {
      const _symbol =
        this.edgeSymbols[_type as keyof typeof this.edgeSymbols] ||
        this.edgeSymbols.default;
      lines.push(`  ${_symbol} ${_type}: ${count}`);
    }

    // Footer
    lines.push("");
    lines.push(this.createFooter(_graphData));

    return lines.join("\n");
  }

  /**
   * Render graph summary
   */
  private renderSummary(_options: VisualizationOptions): string {
    const lines: string[] = [];
    const _stats = this.graphEngine.getStatistics();
    const _graphData = this.graphEngine.exportForVisualization();

    // Header
    lines.push(this.createHeader("Knowledge Graph - Summary"));
    lines.push("");

    // Overview
    lines.push(this.colors.primary("OVERVIEW"));
    lines.push("─".repeat(40));
    lines.push(
      `Total Nodes:    ${this.colors.accent(_stats.totalNodes.toString())}`,
    );
    lines.push(
      `Total Edges:    ${this.colors.accent(_stats.totalEdges.toString())}`,
    );
    lines.push(
      `Total Clusters: ${this.colors.accent(_stats.totalClusters.toString())}`,
    );
    lines.push(
      `Graph Density:  ${this.colors.accent(`${(_stats.density * 100).toFixed(2)}%`)}`,
    );
    lines.push(
      `Avg Degree:     ${this.colors.accent(_stats.averageDegree.toFixed(2))}`,
    );
    lines.push("");

    // Node distribution
    lines.push(this.colors.primary("NODE DISTRIBUTION"));
    lines.push("─".repeat(40));
    for (const [_type, count] of Object.entries(_stats.nodeTypes)) {
      const _symbol = this.symbols[_type as keyof typeof this.symbols] || "•";
      const _percentage = (
        ((count as number) / _stats.totalNodes) *
        100
      ).toFixed(1);
      const _bar = this.createBar(count as number, _stats.totalNodes, 30);
      lines.push(
        `${_symbol} ${type.padEnd(12)} ${_bar} ${count} (${_percentage}%)`,
      );
    }
    lines.push("");

    // Edge distribution
    lines.push(this.colors.primary("EDGE DISTRIBUTION"));
    lines.push("─".repeat(40));
    for (const [_type, count] of Object.entries(_stats.edgeTypes)) {
      const _symbol =
        this.edgeSymbols[_type as keyof typeof this.edgeSymbols] ||
        this.edgeSymbols.default;
      const _percentage = (
        ((count as number) / _stats.totalEdges) *
        100
      ).toFixed(1);
      const _bar = this.createBar(count as number, _stats.totalEdges, 30);
      lines.push(
        `${_symbol} ${type.padEnd(12)} ${_bar} ${count} (${_percentage}%)`,
      );
    }
    lines.push("");

    // Top connected _nodes
    const _nodeConnections = new Map<string, number>();
    for (const edge of _graphData.edges) {
      _nodeConnections.set(
        edge.source,
        (_nodeConnections.get(edge.source) || 0) + 1,
      );
      _nodeConnections.set(
        edge.target,
        (_nodeConnections.get(edge.target) || 0) + 1,
      );
    }

    const _topNodes = Array.from(_nodeConnections.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, _connections]) => {
        const _node = _graphData.nodes.find((_n: unknown) => _n.id === id);
        return _node ? { ..._node, _connections } : null;
      })
      .filter(Boolean);

    if (_topNodes.length > 0) {
      lines.push(this.colors.primary("TOP CONNECTED NODES"));
      lines.push("─".repeat(40));
      for (const _node of _topNodes) {
        const _symbol =
          this.symbols[_node.type as keyof typeof this.symbols] || "•";
        lines.push(
          `${_symbol} ${_node.label.padEnd(20)} ` +
            `${this.colors.accent(`${_node.connections} _connections`)}`,
        );
      }
      lines.push("");
    }

    // Clusters
    if (_graphData.clusters && _graphData.clusters.length > 0) {
      lines.push(this.colors.primary("CLUSTERS"));
      lines.push("─".repeat(40));
      for (const cluster of _graphData.clusters.slice(0, 5)) {
        lines.push(
          `${this.colors.accent(cluster.name)} ` +
            `${this.colors.muted(`(${cluster.nodeIds.length} _nodes, coherence: ${cluster.coherence.toFixed(2)})`)}`,
        );
      }
    }

    // Footer
    lines.push("");
    lines.push(this.createFooter(_graphData));

    return lines.join("\n");
  }

  // Helper methods

  private createHeader(title: string): string {
    const _padding = Math.floor((this.CONTENT_WIDTH - title.length - 2) / 2);
    const _header = `${"═".repeat(_padding)} ${title} ${"═".repeat(_padding)}`;
    return this.colors.primary(_header.substring(0, this.CONTENT_WIDTH));
  }

  private createFooter(_graphData: unknown): string {
    const _timestamp = new Date().toISOString();
    const _footer = `Generated: ${_timestamp} | Nodes: ${_graphData.nodes.length} | Edges: ${_graphData.edges.length}`;
    return this.colors.muted(`${"─".repeat(this.CONTENT_WIDTH)}\n${_footer}`);
  }

  private createBar(_value: number, max: number, width: number): string {
    const _percentage = _value / max;
    const _filled = Math.round(_percentage * width);
    const _empty = width - _filled;

    return (
      this.colors.primary("█".repeat(_filled)) +
      this.colors.muted("░".repeat(_empty))
    );
  }

  private formatNodeLine(
    _node: unknown,
    depth: number,
    options: VisualizationOptions,
  ): string {
    const _indent = "  ".repeat(depth);
    const _symbol =
      this.symbols[_node.type as keyof typeof this.symbols] || "•";
    const _label = _node._label || _node.name || _node.id;

    const _line = `${_indent}${_symbol} `;

    if (options.colorize !== false) {
      _line += this.getNodeColor(_node.type)(_label);
    } else {
      _line += _label;
    }

    if (_node.confidence !== undefined) {
      _line += this.colors.muted(` [${(_node.confidence * 100).toFixed(0)}%]`);
    }

    return _line;
  }

  private formatNodeLabel(_node: unknown): string {
    const _symbol =
      this.symbols[_node.type as keyof typeof this.symbols] || "•";
    const _label = (_node._label || _node.name || _node.id)
      .substring(0, 15)
      .padEnd(15);
    return `${_symbol} ${_label}`;
  }

  private formatEdgeLine(_edge: unknown, depth: number): string {
    const _indent = "  ".repeat(depth);
    const _symbol =
      this.edgeSymbols[_edge.type as keyof typeof this.edgeSymbols] ||
      this.edgeSymbols.default;

    return this.colors.muted(`${_indent}  ${_symbol} ${_edge.type}`);
  }

  private formatMetadata(_metadata: unknown, depth: number): string {
    const _indent = "  ".repeat(depth);
    const _items = Object.entries(_metadata)
      .map(([key, value]) => `${key}: ${value}`)
      .join(", ");

    return this.colors.muted(`${_indent}(${_items})`);
  }

  private getNodeColor(_type: string): (_text: string) => string {
    const colorMap: Record<string, (_text: string) => string> = {
      function: this.colors.success,
      class: this.colors.info,
      module: this.colors.warning,
      concept: this.colors.accent,
      pattern: this.colors.primary,
    };

    return colorMap[_type] || this.colors.muted;
  }

  private getEdgeSymbol(_type: string): string {
    return (
      this.edgeSymbols[_type as keyof typeof this.edgeSymbols] ||
      this.edgeSymbols.default
    );
  }

  private findRootNodes(_graphData: unknown): string[] {
    const _hasIncoming = new Set<string>();

    for (const edge of _graphData.edges) {
      hasIncoming.add(edge.target);
    }

    return _graphData.nodes
      .filter((_n: unknown) => !_hasIncoming.has(_n.id))
      .map((_n: unknown) => _n.id);
  }

  private shouldFilterNode(_node: unknown, filter?: unknown): boolean {
    if (!filter) {
      return false;
    }

    if (filter.nodeTypes && !filter.nodeTypes.includes(_node.type)) {
      return true;
    }

    if (filter.minConfidence && _node.confidence < filter.minConfidence) {
      return true;
    }

    return false;
  }

  private shouldFilterEdge(_edge: unknown, filter?: unknown): boolean {
    if (!filter) {
      return false;
    }

    if (filter.edgeTypes && !filter.edgeTypes.includes(_edge.type)) {
      return true;
    }

    return false;
  }
}
