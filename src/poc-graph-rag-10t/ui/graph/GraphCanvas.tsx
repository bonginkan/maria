/**
 * GraphCanvas.tsx
 * Core D3.js/WebGL graph visualization component for Graph RAG 10T
 * Supports 9 visualization modes with progressive rendering for 100k+ nodes
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { GraphData, Node, Edge, ViewMode, GraphRenderer } from './types';
import { ForceSimulation } from './layouts/ForceSimulation';
import { WebGLRenderer } from './renderers/WebGLRenderer';
import { ProgressiveLoader } from './utils/ProgressiveLoader';

interface GraphCanvasProps {
  data: GraphData;
  viewMode: ViewMode;
  width?: number;
  height?: number;
  onNodeClick?: (node: Node) => void;
  onNodeHover?: (node: Node | null) => void;
  onEdgeClick?: (edge: Edge) => void;
  onSelectionChange?: (selectedNodes: Node[]) => void;
  config?: GraphConfig;
}

interface GraphConfig {
  enableWebGL?: boolean;
  progressiveThreshold?: number;
  animationDuration?: number;
  layout?: 'force' | 'hierarchical' | 'circular' | 'community';
  clustering?: boolean;
  physics?: {
    gravity?: number;
    charge?: number;
    linkDistance?: number;
    friction?: number;
  };
}

export const GraphCanvas: React.FC<GraphCanvasProps> = ({
  data,
  viewMode,
  width = window.innerWidth * 0.7,
  height = window.innerHeight * 0.8,
  onNodeClick,
  onNodeHover,
  _onEdgeClick,
  onSelectionChange,
  config = {}
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [renderer, setRenderer] = useState<GraphRenderer | null>(null);
  const [_selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set());
  const [hoveredNode, setHoveredNode] = useState<Node | null>(null);
  const [zoom, setZoom] = useState({ k: 1, x: 0, y: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [metrics, setMetrics] = useState({
    nodes: 0,
    edges: 0,
    fps: 60,
    renderTime: 0
  });

  // Determine rendering engine based on data size
  const shouldUseWebGL = useCallback(() => {
    const threshold = config.progressiveThreshold || 5000;
    return config.enableWebGL !== false && data.nodes.length > threshold;
  }, [data, config]);

  // Initialize renderer
  useEffect(() => {
    if (!svgRef.current && !canvasRef.current) return;

    const useWebGL = shouldUseWebGL();
    const container = useWebGL ? canvasRef.current! : svgRef.current!;

    const newRenderer = useWebGL
      ? new WebGLRenderer(container as HTMLCanvasElement, {
          width,
          height,
          pixelRatio: window.devicePixelRatio
        })
      : new D3Renderer(container as SVGSVGElement, { width, height });

    setRenderer(newRenderer);

    return () => {
      newRenderer.destroy();
    };
  }, [width, height, shouldUseWebGL]);

  // Render graph with progressive loading for large datasets
  useEffect(() => {
    if (!renderer || !data) return;

    const renderGraph = async () => {
      setIsLoading(true);
      const startTime = performance.now();

      try {
        // Progressive loading for large graphs
        if (data.nodes.length > 10000) {
          const loader = new ProgressiveLoader(data, {
            chunkSize: 1000,
            delay: 16 // ~60fps
          });

          await loader.load((chunk, progress) => {
            renderer.renderPartial(chunk, progress);
            setMetrics(prev => ({
              ...prev,
              nodes: chunk.nodes.length,
              edges: chunk.edges.length
            }));
          });
        } else {
          // Direct rendering for smaller graphs
          renderer.render(data);
          setMetrics({
            nodes: data.nodes.length,
            edges: data.edges.length,
            fps: 60,
            renderTime: performance.now() - startTime
          });
        }

        // Apply layout algorithm
        applyLayout(data);

      } catch (error) {
        console.error('Graph rendering failed:', error);
      } finally {
        setIsLoading(false);
        const renderTime = performance.now() - startTime;
        setMetrics(prev => ({ ...prev, renderTime }));
      }
    };

    renderGraph();
  }, [renderer, data, viewMode]);

  // Apply layout algorithm based on view mode and config
  const applyLayout = useCallback((graphData: GraphData) => {
    if (!renderer) return;

    const layoutConfig = {
      ...config.physics,
      width,
      height,
      viewMode
    };

    switch (config.layout || getDefaultLayout(viewMode)) {
      case 'force': {
        const simulation = new ForceSimulation(graphData, layoutConfig);
        simulation.on('tick', () => {
          renderer.updatePositions(simulation.nodes());
        });
        simulation.start();
        break;
      }

      case 'hierarchical': {
        // NOTE: d3.hierarchy expects a tree-like structure.
        // If your GraphData is not hierarchical, this block should be adapted.
        const hierarchy: any = d3.hierarchy(graphData as any)
          .sum(d => d.value || 1)
          .sort((a, b) => (b.value || 0) - (a.value || 0));
      
        const treeLayout = d3.tree()
          .size([width, height])
          .separation((a, b) => a.parent === b.parent ? 1 : 2);
      
        treeLayout(hierarchy);
        renderer.updatePositions(hierarchy.descendants());
        break;
      }

      case 'circular': {
        const radius = Math.min(width, height) / 2 - 50;
        const angleStep = (2 * Math.PI) / graphData.nodes.length;
      
        graphData.nodes.forEach((node, i) => {
          node.x = width / 2 + radius * Math.cos(i * angleStep);
          node.y = height / 2 + radius * Math.sin(i * angleStep);
        });
      
        renderer.updatePositions(graphData.nodes);
        break;
      }

      case 'community': {
        const communities = detectCommunities(graphData);
        layoutCommunities(communities, { width, height });
        renderer.updatePositions(graphData.nodes);
        break;
      }
    }
  }, [renderer, config.layout, config.physics, width, height, viewMode]);

  // Handle zoom and pan
  const handleZoom = useCallback(() => {
    if (!renderer) return;

    const zoomBehavior = d3.zoom()
      .scaleExtent([0.1, 10])
      .on('zoom', (event) => {
        const { transform } = event;
        setZoom({ k: transform.k, x: transform.x, y: transform.y });
        renderer.setTransform(transform);
      });

    d3.select(renderer.container)
      .call(zoomBehavior as any);
  }, [renderer]);

  useEffect(() => {
    handleZoom();
  }, [handleZoom]);

  // Handle node interactions
  const _handleNodeInteraction = useCallback((event: string, node: Node) => {
    switch (event) {
      case 'click':
        if (onNodeClick) onNodeClick(node);
        
        // Toggle selection
        setSelectedNodes(prev => {
          const newSelection = new Set(prev);
          if (newSelection.has(node.id)) {
            newSelection.delete(node.id);
          } else {
            newSelection.add(node.id);
          }
          
          if (onSelectionChange) {
            const selectedNodesList = data.nodes.filter(n => 
              newSelection.has(n.id)
            );
            onSelectionChange(selectedNodesList);
          }
          
          return newSelection;
        });
        break;

      case 'hover':
        setHoveredNode(node);
        if (onNodeHover) onNodeHover(node);
        
        // Highlight connected nodes and edges
        if (renderer) {
          const connectedNodes = getConnectedNodes(node, data);
          renderer.highlight(connectedNodes);
        }
        break;

      case 'mouseout':
        setHoveredNode(null);
        if (onNodeHover) onNodeHover(null);
        if (renderer) renderer.clearHighlight();
        break;

      case 'dblclick':
        // Expand node neighbors
        expandNode(node);
        break;
    }
  }, [data, onNodeClick, onNodeHover, onSelectionChange, renderer]);

  // Expand node to show more connections
  const expandNode = useCallback((node: Node) => {
    // Fetch additional nodes if needed (e.g., from server)
    // For now, just animate existing connections
    if (!renderer) return;

    const neighbors = getNeighbors(node, data);
    renderer.focusOnNodes([node, ...neighbors], {
      duration: 500,
      padding: 50
    });
  }, [data, renderer]);

  // Component placeholders (would be separate files in production)
  const SearchOverlay: React.FC<any> = ({ _data, _metrics }) => <div />;
  const ProvenanceOverlay: React.FC<any> = ({ _paths }) => <div />;
  const CommunityOverlay: React.FC<any> = ({ _communities }) => <div />;
  const TimelineControls: React.FC<any> = ({ _onTimeChange }) => <div />;
  const KGBoostTuner: React.FC<any> = ({ _onWeightChange }) => <div />;
  const NodeTooltip: React.FC<any> = ({ _node, _x, _y }) => <div />;
  const GraphControls: React.FC<any> = (_props) => <div />;
  const GraphLegend: React.FC<any> = ({ _viewMode }) => <div />;

  // Handler functions
  const handleTimeChange = (_time: Date) => {
    // Implementation pending
  };
  const handleWeightChange = (_weights: any) => {
    // Implementation pending
  };
  const handleZoomLevel = (_factor: number) => {
    // Implementation pending
  };
  const handleZoomReset = () => {
    // Implementation pending
  };

  // Export functions
  const exportImage = useCallback(async (format: 'png' | 'svg' | 'pdf') => {
    if (!renderer) return null;
    return renderer.exportImage(format);
  }, [renderer]);

  const _exportData = useCallback((format: 'json' | 'graphml' | 'gexf') => {
    return exportGraphData(data, format);
  }, [data]);

  // View mode specific rendering
  const renderViewModeOverlay = () => {
    switch (viewMode) {
      case ViewMode.SEARCH:
        return <SearchOverlay data={data} metrics={metrics} />;
      
      case ViewMode.PROVENANCE:
        return <ProvenanceOverlay paths={getProvenancePaths(data)} />;
      
      case ViewMode.COMMUNITY:
        return <CommunityOverlay communities={detectCommunities(data)} />;
      
      case ViewMode.TIMELINE:
        return <TimelineControls onTimeChange={handleTimeChange} />;
      
      case ViewMode.TUNER:
        return <KGBoostTuner onWeightChange={handleWeightChange} />;
      
      default:
        return null;
    }
  };

  return (
    <div className="graph-canvas-container" style={{ position: 'relative', width, height }}>
      {/* Main rendering surface */}
      {shouldUseWebGL() ? (
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          style={{ display: 'block' }}
        />
      ) : (
        <svg
          ref={svgRef}
          width={width}
          height={height}
          style={{ display: 'block' }}
        />
      )}

      {/* View mode overlay */}
      {renderViewModeOverlay()}

      {/* Loading indicator */}
      {isLoading && (
        <div className="loading-overlay">
          <div className="spinner" />
          <div>Loading {metrics.nodes} nodes...</div>
        </div>
      )}

      {/* Performance metrics */}
      <div className="metrics-panel">
        <div>Nodes: {metrics.nodes}</div>
        <div>Edges: {metrics.edges}</div>
        <div>FPS: {metrics.fps}</div>
        <div>Render: {metrics.renderTime.toFixed(0)}ms</div>
      </div>

      {/* Hover tooltip */}
      {hoveredNode && (
        <NodeTooltip
          node={hoveredNode}
          x={hoveredNode.x! * zoom.k + zoom.x}
          y={hoveredNode.y! * zoom.k + zoom.y}
        />
      )}

      {/* Controls */}
      <GraphControls
        onZoomIn={() => handleZoomLevel(1.2)}
        onZoomOut={() => handleZoomLevel(0.8)}
        onReset={() => handleZoomReset()}
        onExport={exportImage}
        onLayoutChange={(_layout) => applyLayout(data)}
      />

      {/* Legend */}
      <GraphLegend viewMode={viewMode} />
    </div>
  );
};

// D3 SVG Renderer for smaller graphs
class D3Renderer implements GraphRenderer {
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private g: d3.Selection<SVGGElement, unknown, null, undefined>;
  private nodes: d3.Selection<SVGCircleElement, Node, SVGGElement, unknown>;
  private edges: d3.Selection<SVGLineElement, Edge, SVGGElement, unknown>;
  
  constructor(public container: SVGSVGElement, _config: any) {
    this.svg = d3.select(container);
    this.g = this.svg.append('g').attr('class', 'graph-content');
    
    // Add arrow markers for directed edges
    this.svg.append('defs').selectAll('marker')
      .data(['arrow'])
      .enter().append('marker')
      .attr('id', _d => _d)
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 15)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#999');
  }

  render(data: GraphData) {
    // Render edges
    this.edges = this.g.selectAll('.edge')
      .data(data.edges)
      .enter().append('line')
      .attr('class', 'edge')
      .attr('stroke', d => d.color || '#999')
      .attr('stroke-width', d => d.width || 1)
      .attr('marker-end', d => d.directed ? 'url(#arrow)' : null);

    // Render nodes
    this.nodes = this.g.selectAll('.node')
      .data(data.nodes)
      .enter().append('circle')
      .attr('class', d => `node node-${d.type}`)
      .attr('r', d => d.size || 5)
      .attr('fill', d => d.color || getNodeColor(d.type))
      .attr('stroke', '#fff')
      .attr('stroke-width', 2);

    // Add labels
    this.g.selectAll('.label')
      .data(data.nodes)
      .enter().append('text')
      .attr('class', 'label')
      .text(d => d.label)
      .attr('font-size', 10)
      .attr('text-anchor', 'middle');
  }

  updatePositions(_nodes: any[]) {
    this.nodes
      .attr('cx', d => d.x!)
      .attr('cy', d => d.y!);

    this.edges
      .attr('x1', d => d.source.x!)
      .attr('y1', d => d.source.y!)
      .attr('x2', d => d.target.x!)
      .attr('y2', d => d.target.y!);

    this.g.selectAll('.label')
      .attr('x', d => d.x!)
      .attr('y', d => d.y! - 10);
  }

  setTransform(transform: any) {
    this.g.attr('transform', transform);
  }

  highlight(nodes: Node[]) {
    const nodeIds = new Set(nodes.map(n => n.id));
    
    this.nodes
      .attr('opacity', d => nodeIds.has(d.id) ? 1 : 0.3);
    
    this.edges
      .attr('opacity', d => 
        nodeIds.has(d.source.id) && nodeIds.has(d.target.id) ? 1 : 0.1
      );
  }

  clearHighlight() {
    this.nodes.attr('opacity', 1);
    this.edges.attr('opacity', 1);
  }

  destroy() {
    this.svg.selectAll('*').remove();
  }

  async exportImage(_format: string): Promise<Blob> {
    // Implementation for SVG export
    const svgData = new XMLSerializer().serializeToString(this.container);
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    return blob;
  }
}

// Helper functions
function getNodeColor(type: string): string {
  const colors: Record<string, string> = {
    Document: '#4CAF50',
    Paragraph: '#2196F3',
    Topic: '#FF9800',
    Person: '#9C27B0',
    Organization: '#00BCD4',
    Query: '#F44336'
  };
  return colors[type] || '#757575';
}

function getDefaultLayout(viewMode: ViewMode): string {
  const layouts: Record<ViewMode, string> = {
    [ViewMode.SEARCH]: 'force',
    [ViewMode.PROVENANCE]: 'hierarchical',
    [ViewMode.DRILLDOWN]: 'force',
    [ViewMode.COMMUNITY]: 'community',
    [ViewMode.TIMELINE]: 'force',
    [ViewMode.TUNER]: 'force',
    [ViewMode.EXPLAIN]: 'hierarchical',
    [ViewMode.DASHBOARD]: 'circular',
    [ViewMode.ASCII]: 'force'
  };
  return layouts[viewMode] || 'force';
}

function getConnectedNodes(node: Node, data: GraphData): Node[] {
  const connected: Node[] = [];
  const nodeMap = new Map(data.nodes.map(n => [n.id, n]));
  
  data.edges.forEach(edge => {
    if (edge.source.id === node.id && nodeMap.has(edge.target.id)) {
      connected.push(nodeMap.get(edge.target.id)!);
    } else if (edge.target.id === node.id && nodeMap.has(edge.source.id)) {
      connected.push(nodeMap.get(edge.source.id)!);
    }
  });
  
  return connected;
}

function getNeighbors(node: Node, data: GraphData): Node[] {
  return getConnectedNodes(node, data);
}

function detectCommunities(data: GraphData): Map<string, Node[]> {
  // Simple community detection based on node properties
  const communities = new Map<string, Node[]>();
  
  data.nodes.forEach(node => {
    const community = node.community || 'default';
    if (!communities.has(community)) {
      communities.set(community, []);
    }
    communities.get(community)!.push(node);
  });
  
  return communities;
}

function layoutCommunities(communities: Map<string, Node[]>, bounds: { width: number; height: number }) {
  const numCommunities = communities.size;
  const cols = Math.ceil(Math.sqrt(numCommunities));
  const rows = Math.ceil(numCommunities / cols);
  const cellWidth = bounds.width / cols;
  const cellHeight = bounds.height / rows;
  
  let index = 0;
  communities.forEach((nodes, _communityId) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const centerX = (col + 0.5) * cellWidth;
    const centerY = (row + 0.5) * cellHeight;
    
    // Layout nodes within community
    const radius = Math.min(cellWidth, cellHeight) * 0.3;
    const angleStep = (2 * Math.PI) / nodes.length;
    
    nodes.forEach((node, i) => {
      node.x = centerX + radius * Math.cos(i * angleStep);
      node.y = centerY + radius * Math.sin(i * angleStep);
    });
    
    index++;
  });
}

function getProvenancePaths(_data: GraphData): any[] {
  // Extract provenance paths from graph data
  // This would typically trace from query to documents
  return [];
}

function exportGraphData(data: GraphData, format: string): string {
  switch (format) {
    case 'json':
      return JSON.stringify(data, null, 2);
    
    case 'graphml':
      // Convert to GraphML format
      return convertToGraphML(data);
    
    case 'gexf':
      // Convert to GEXF format
      return convertToGEXF(data);
    
    default:
      return JSON.stringify(data);
  }
}

// Export format converters (simplified)
function convertToGraphML(data: GraphData): string {
  const nodes = data.nodes.map(n => '<node id="' + n.id + '" />').join('\n');
  const edges = data.edges.map(e => '<edge source="' + e.source.id + '" target="' + e.target.id + '" />').join('\n');
  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<graphml xmlns="http://graphml.graphdrawing.org/xmlns">\n' +
    '  <graph id="G" edgedefault="undirected">\n' +
    '    ' + nodes + '\n' +
    '    ' + edges + '\n' +
    '  </graph>\n' +
    '</graphml>';
}

function convertToGEXF(data: GraphData): string {
  const nodes = data.nodes.map(n => '<node id="' + n.id + '" label="' + n.label + '" />').join('\n');
  const edges = data.edges.map((e, i) => '<edge id="' + i + '" source="' + e.source.id + '" target="' + e.target.id + '" />').join('\n');
  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<gexf xmlns="http://www.gexf.net/1.2draft" version="1.2">\n' +
    '  <graph mode="static" defaultedgetype="directed">\n' +
    '    <nodes>\n' +
    '      ' + nodes + '\n' +
    '    </nodes>\n' +
    '    <edges>\n' +
    '      ' + edges + '\n' +
    '    </edges>\n' +
    '  </graph>\n' +
    '</gexf>';
}

export default GraphCanvas;
