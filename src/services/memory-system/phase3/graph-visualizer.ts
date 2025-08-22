/**
 * MARIA Memory System - Phase 3: Graph Visualization
 *
 * Terminal-based visualization of knowledge graph relationships
 * using ASCII art and structured text output
 */

import chalk from 'chalk';
import { KnowledgeGraphEngine } from './knowledge-graph-engine';
import { ConceptGraph, KnowledgeNode, ConceptEdge } from '../types/memory-interfaces';

export interface VisualizationOptions {
  maxDepth?: number;
  maxNodes?: number;
  showMetadata?: boolean;
  colorize?: boolean;
  format?: 'tree' | 'matrix' | 'list' | 'summary';
  filter?: {
    nodeTypes?: string[];
    edgeTypes?: string[];
    minConfidence?: number;
  };
}

export interface GraphSummary {
  totalNodes: number;
  totalEdges: number;
  nodesByType: Map<string, number>;
  edgesByType: Map<string, number>;
  clusters: number;
  density: number;
  averageDegree: number;
  topNodes: NodeInfo[];
}

export interface NodeInfo {
  id: string;
  name: string;
  type: string;
  connections: number;
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

  // Node type symbols (no emojis)
  private symbols = {
    function: 'ƒ',
    class: 'C',
    module: 'M',
    concept: '◊',
    pattern: '※',
  };

  // Edge type symbols
  private edgeSymbols = {
    implements: '═══>',
    extends: '──>',
    uses: '···>',
    depends_on: '-->',
    similar_to: '≈≈>',
    default: '--->',
  };

  constructor(graphEngine: KnowledgeGraphEngine) {
    this.graphEngine = graphEngine;
  }

  /**
   * Visualize the graph in the specified format
   */
  visualize(options: VisualizationOptions = {}): string {
    const format = options.format || 'tree';

    switch (format) {
      case 'tree':
        return this.renderTree(options);
      case 'matrix':
        return this.renderMatrix(options);
      case 'list':
        return this.renderList(options);
      case 'summary':
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
    const graphData = this.graphEngine.exportForVisualization();
    const visited = new Set<string>();
    const maxDepth = options.maxDepth || 3;
    const maxNodes = options.maxNodes || 50;
    let nodeCount = 0;

    // Header
    lines.push(this.createHeader('Knowledge Graph - Tree View'));
    lines.push('');

    // Find root nodes (nodes with no incoming edges)
    const rootNodes = this.findRootNodes(graphData);

    // Render each tree
    for (const rootNode of rootNodes) {
      if (nodeCount >= maxNodes) break;

      const node = graphData.nodes.find((n) => n.id === rootNode);
      if (!node) continue;

      if (this.shouldFilterNode(node, options.filter)) continue;

      lines.push(
        ...this.renderNode(node, graphData, 0, maxDepth, visited, options, { nodeCount, maxNodes }),
      );

      nodeCount = visited.size;
    }

    // Handle disconnected nodes
    const disconnected = graphData.nodes.filter(
      (n) => !visited.has(n.id) && !this.shouldFilterNode(n, options.filter),
    );

    if (disconnected.length > 0 && nodeCount < maxNodes) {
      lines.push('');
      lines.push(this.colors.muted('Disconnected Nodes:'));
      for (const node of disconnected.slice(0, maxNodes - nodeCount)) {
        lines.push(this.formatNodeLine(node, 0, options));
      }
    }

    // Footer
    lines.push('');
    lines.push(this.createFooter(graphData));

    return lines.join('\n');
  }

  /**
   * Render a node and its children recursively
   */
  private renderNode(
    node: unknown,
    graphData: unknown,
    depth: number,
    maxDepth: number,
    visited: Set<string>,
    options: VisualizationOptions,
    counter: { nodeCount: number; maxNodes: number },
  ): string[] {
    const lines: string[] = [];

    if (visited.has(node.id) || depth > maxDepth || counter.nodeCount >= counter.maxNodes) {
      return lines;
    }

    visited.add(node.id);
    counter.nodeCount++;

    // Render current node
    lines.push(this.formatNodeLine(node, depth, options));

    // Show metadata if requested
    if (options.showMetadata && node.metadata) {
      lines.push(this.formatMetadata(node.metadata, depth + 1));
    }

    // Find connected nodes
    const connections = graphData.edges.filter((e: unknown) => e.source === node.id);

    for (const edge of connections) {
      if (counter.nodeCount >= counter.maxNodes) break;

      if (this.shouldFilterEdge(edge, options.filter)) continue;

      const targetNode = graphData.nodes.find((n: unknown) => n.id === edge.target);
      if (!targetNode) continue;

      // Render edge
      lines.push(this.formatEdgeLine(edge, depth));

      // Render target node
      lines.push(
        ...this.renderNode(targetNode, graphData, depth + 1, maxDepth, visited, options, counter),
      );
    }

    return lines;
  }

  /**
   * Render graph as an adjacency matrix
   */
  private renderMatrix(options: VisualizationOptions): string {
    const lines: string[] = [];
    const graphData = this.graphEngine.exportForVisualization();
    const maxNodes = Math.min(options.maxNodes || 20, 20); // Limit for readability

    // Header
    lines.push(this.createHeader('Knowledge Graph - Matrix View'));
    lines.push('');

    // Get nodes to display
    const nodes = graphData.nodes
      .filter((n) => !this.shouldFilterNode(n, options.filter))
      .slice(0, maxNodes);

    if (nodes.length === 0) {
      lines.push(this.colors.muted('No nodes to display'));
      return lines.join('\n');
    }

    // Create matrix
    const matrix: string[][] = [];
    const nodeMap = new Map(nodes.map((n, i) => [n.id, i]));

    // Initialize matrix
    for (let i = 0; i < nodes.length; i++) {
      matrix[i] = new Array(nodes.length).fill('  ');
    }

    // Fill matrix with edges
    for (const edge of graphData.edges) {
      const sourceIdx = nodeMap.get(edge.source);
      const targetIdx = nodeMap.get(edge.target);

      if (sourceIdx !== undefined && targetIdx !== undefined) {
        const symbol = this.getEdgeSymbol(edge.type);
        matrix[sourceIdx][targetIdx] = symbol.substring(0, 2);
      }
    }

    // Render matrix header
    lines.push('    ' + nodes.map((_, i) => String(i).padStart(3)).join(''));
    lines.push('   ' + '─'.repeat(nodes.length * 3 + 1));

    // Render matrix rows
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const rowLabel = `${i}`.padStart(2) + '│';
      const row = matrix[i]
        .map((cell) => (cell === '  ' ? this.colors.muted(cell) : this.colors.primary(cell)))
        .join(' ');

      lines.push(`${rowLabel} ${row} │ ${this.formatNodeLabel(node)}`);
    }

    // Legend
    lines.push('');
    lines.push(this.colors.muted('Legend:'));
    lines.push(this.colors.muted('  Row → Column = Edge from Row to Column'));

    // Footer
    lines.push('');
    lines.push(this.createFooter(graphData));

    return lines.join('\n');
  }

  /**
   * Render graph as a structured list
   */
  private renderList(options: VisualizationOptions): string {
    const lines: string[] = [];
    const graphData = this.graphEngine.exportForVisualization();
    const maxNodes = options.maxNodes || 100;

    // Header
    lines.push(this.createHeader('Knowledge Graph - List View'));
    lines.push('');

    // Group nodes by type
    const nodesByType = new Map<string, any[]>();
    for (const node of graphData.nodes) {
      if (this.shouldFilterNode(node, options.filter)) continue;

      const type = node.type || 'unknown';
      if (!nodesByType.has(type)) {
        nodesByType.set(type, []);
      }
      nodesByType.get(type)!.push(node);
    }

    // Render each type group
    let totalNodes = 0;
    for (const [type, nodes] of nodesByType) {
      if (totalNodes >= maxNodes) break;

      const symbol = this.symbols[type as keyof typeof this.symbols] || '•';
      lines.push(this.colors.primary(`${symbol} ${type.toUpperCase()} (${nodes.length})`));
      lines.push('─'.repeat(40));

      for (const node of nodes.slice(0, maxNodes - totalNodes)) {
        const connections = graphData.edges.filter(
          (e: unknown) => e.source === node.id || e.target === node.id,
        ).length;

        lines.push(
          `  ${this.colors.accent(node.label)} ` +
            this.colors.muted(`[${connections} connections]`),
        );

        if (options.showMetadata) {
          lines.push(this.colors.muted(`    Confidence: ${(node.confidence || 0).toFixed(2)}`));
        }

        totalNodes++;
      }

      lines.push('');
    }

    // Edge summary
    const edgesByType = new Map<string, number>();
    for (const edge of graphData.edges) {
      const type = edge.type || 'unknown';
      edgesByType.set(type, (edgesByType.get(type) || 0) + 1);
    }

    lines.push(this.colors.primary('RELATIONSHIPS'));
    lines.push('─'.repeat(40));
    for (const [type, count] of edgesByType) {
      const symbol =
        this.edgeSymbols[type as keyof typeof this.edgeSymbols] || this.edgeSymbols.default;
      lines.push(`  ${symbol} ${type}: ${count}`);
    }

    // Footer
    lines.push('');
    lines.push(this.createFooter(graphData));

    return lines.join('\n');
  }

  /**
   * Render graph summary
   */
  private renderSummary(options: VisualizationOptions): string {
    const lines: string[] = [];
    const stats = this.graphEngine.getStatistics();
    const graphData = this.graphEngine.exportForVisualization();

    // Header
    lines.push(this.createHeader('Knowledge Graph - Summary'));
    lines.push('');

    // Overview
    lines.push(this.colors.primary('OVERVIEW'));
    lines.push('─'.repeat(40));
    lines.push(`Total Nodes:    ${this.colors.accent(stats.totalNodes.toString())}`);
    lines.push(`Total Edges:    ${this.colors.accent(stats.totalEdges.toString())}`);
    lines.push(`Total Clusters: ${this.colors.accent(stats.totalClusters.toString())}`);
    lines.push(`Graph Density:  ${this.colors.accent((stats.density * 100).toFixed(2) + '%')}`);
    lines.push(`Avg Degree:     ${this.colors.accent(stats.averageDegree.toFixed(2))}`);
    lines.push('');

    // Node distribution
    lines.push(this.colors.primary('NODE DISTRIBUTION'));
    lines.push('─'.repeat(40));
    for (const [type, count] of Object.entries(stats.nodeTypes)) {
      const symbol = this.symbols[type as keyof typeof this.symbols] || '•';
      const percentage = (((count as number) / stats.totalNodes) * 100).toFixed(1);
      const bar = this.createBar(count as number, stats.totalNodes, 30);
      lines.push(`${symbol} ${type.padEnd(12)} ${bar} ${count} (${percentage}%)`);
    }
    lines.push('');

    // Edge distribution
    lines.push(this.colors.primary('EDGE DISTRIBUTION'));
    lines.push('─'.repeat(40));
    for (const [type, count] of Object.entries(stats.edgeTypes)) {
      const symbol =
        this.edgeSymbols[type as keyof typeof this.edgeSymbols] || this.edgeSymbols.default;
      const percentage = (((count as number) / stats.totalEdges) * 100).toFixed(1);
      const bar = this.createBar(count as number, stats.totalEdges, 30);
      lines.push(`${symbol} ${type.padEnd(12)} ${bar} ${count} (${percentage}%)`);
    }
    lines.push('');

    // Top connected nodes
    const nodeConnections = new Map<string, number>();
    for (const edge of graphData.edges) {
      nodeConnections.set(edge.source, (nodeConnections.get(edge.source) || 0) + 1);
      nodeConnections.set(edge.target, (nodeConnections.get(edge.target) || 0) + 1);
    }

    const topNodes = Array.from(nodeConnections.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, connections]) => {
        const node = graphData.nodes.find((n: unknown) => n.id === id);
        return node ? { ...node, connections } : null;
      })
      .filter(Boolean);

    if (topNodes.length > 0) {
      lines.push(this.colors.primary('TOP CONNECTED NODES'));
      lines.push('─'.repeat(40));
      for (const node of topNodes) {
        const symbol = this.symbols[node.type as keyof typeof this.symbols] || '•';
        lines.push(
          `${symbol} ${node.label.padEnd(20)} ` +
            `${this.colors.accent(node.connections + ' connections')}`,
        );
      }
      lines.push('');
    }

    // Clusters
    if (graphData.clusters && graphData.clusters.length > 0) {
      lines.push(this.colors.primary('CLUSTERS'));
      lines.push('─'.repeat(40));
      for (const cluster of graphData.clusters.slice(0, 5)) {
        lines.push(
          `${this.colors.accent(cluster.name)} ` +
            `${this.colors.muted(`(${cluster.nodeIds.length} nodes, coherence: ${cluster.coherence.toFixed(2)})`)}`,
        );
      }
    }

    // Footer
    lines.push('');
    lines.push(this.createFooter(graphData));

    return lines.join('\n');
  }

  // Helper methods

  private createHeader(title: string): string {
    const padding = Math.floor((this.CONTENT_WIDTH - title.length - 2) / 2);
    const header = '═'.repeat(padding) + ` ${title} ` + '═'.repeat(padding);
    return this.colors.primary(header.substring(0, this.CONTENT_WIDTH));
  }

  private createFooter(graphData: unknown): string {
    const timestamp = new Date().toISOString();
    const footer = `Generated: ${timestamp} | Nodes: ${graphData.nodes.length} | Edges: ${graphData.edges.length}`;
    return this.colors.muted('─'.repeat(this.CONTENT_WIDTH) + '\n' + footer);
  }

  private createBar(value: number, max: number, width: number): string {
    const percentage = value / max;
    const filled = Math.round(percentage * width);
    const empty = width - filled;

    return this.colors.primary('█'.repeat(filled)) + this.colors.muted('░'.repeat(empty));
  }

  private formatNodeLine(node: unknown, depth: number, options: VisualizationOptions): string {
    const indent = '  '.repeat(depth);
    const symbol = this.symbols[node.type as keyof typeof this.symbols] || '•';
    const label = node.label || node.name || node.id;

    let line = `${indent}${symbol} `;

    if (options.colorize !== false) {
      line += this.getNodeColor(node.type)(label);
    } else {
      line += label;
    }

    if (node.confidence !== undefined) {
      line += this.colors.muted(` [${(node.confidence * 100).toFixed(0)}%]`);
    }

    return line;
  }

  private formatNodeLabel(node: unknown): string {
    const symbol = this.symbols[node.type as keyof typeof this.symbols] || '•';
    const label = (node.label || node.name || node.id).substring(0, 15).padEnd(15);
    return `${symbol} ${label}`;
  }

  private formatEdgeLine(edge: unknown, depth: number): string {
    const indent = '  '.repeat(depth);
    const symbol =
      this.edgeSymbols[edge.type as keyof typeof this.edgeSymbols] || this.edgeSymbols.default;

    return this.colors.muted(`${indent}  ${symbol} ${edge.type}`);
  }

  private formatMetadata(metadata: unknown, depth: number): string {
    const indent = '  '.repeat(depth);
    const items = Object.entries(metadata)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');

    return this.colors.muted(`${indent}(${items})`);
  }

  private getNodeColor(type: string): (text: string) => string {
    const colorMap: Record<string, (text: string) => string> = {
      function: this.colors.success,
      class: this.colors.info,
      module: this.colors.warning,
      concept: this.colors.accent,
      pattern: this.colors.primary,
    };

    return colorMap[type] || this.colors.muted;
  }

  private getEdgeSymbol(type: string): string {
    return this.edgeSymbols[type as keyof typeof this.edgeSymbols] || this.edgeSymbols.default;
  }

  private findRootNodes(graphData: unknown): string[] {
    const hasIncoming = new Set<string>();

    for (const edge of graphData.edges) {
      hasIncoming.add(edge.target);
    }

    return graphData.nodes.filter((n: unknown) => !hasIncoming.has(n.id)).map((n: unknown) => n.id);
  }

  private shouldFilterNode(node: unknown, filter?: unknown): boolean {
    if (!filter) return false;

    if (filter.nodeTypes && !filter.nodeTypes.includes(node.type)) {
      return true;
    }

    if (filter.minConfidence && node.confidence < filter.minConfidence) {
      return true;
    }

    return false;
  }

  private shouldFilterEdge(edge: unknown, filter?: unknown): boolean {
    if (!filter) return false;

    if (filter.edgeTypes && !filter.edgeTypes.includes(edge.type)) {
      return true;
    }

    return false;
  }
}
