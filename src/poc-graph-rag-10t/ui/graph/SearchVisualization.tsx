/**
 * SearchVisualization.tsx
 * Interactive search result visualization with hybrid scoring display
 * Shows BM25/Vector/KG contributions and allows real-time weight adjustment
 */

import React, { useState, useEffect, useCallback, _useMemo } from "react";
import * as d3 from "d3";
import { GraphCanvas } from "./GraphCanvas";
import { GraphData, _Node, Edge, ViewMode } from "./types";
import "./SearchVisualization.css";

interface SearchVisualizationProps {
  query: string;
  searchResults: SearchResult[];
  onSearch?: (query: string) => void;
  onNodeSelect?: (node: Node) => void;
  onWeightChange?: (weights: SearchWeights) => void;
  initialWeights?: SearchWeights;
}

interface SearchResult {
  id: string;
  type: "Document" | "Paragraph" | "Topic";
  title: string;
  content?: string;
  score: number;
  scores: {
    bm25: number;
    vector: number;
    kg: number;
  };
  _path: string;
  source: "sharepoint" | "box" | "database";
  metadata?: Record<string, any>;
  highlights?: string[];
}

interface SearchWeights {
  alpha: number; // KG mention weight
  beta: number; // Jaccard similarity weight
  gamma: number; // PageRank weight
}

export const SearchVisualization: React.FC<SearchVisualizationProps> = ({
  query,
  searchResults,
  onSearch,
  onNodeSelect,
  onWeightChange,
  initialWeights = { alpha: 0.2, beta: 0.4, gamma: 0.1 },
}) => {
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [weights, setWeights] = useState<SearchWeights>(initialWeights);
  const [filterSources, setFilterSources] = useState({
    bm25: true,
    vector: true,
    kg: true,
  });
  const [hoveredResult, setHoveredResult] = useState<SearchResult | null>(null);
  const [_expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [viewStats, setViewStats] = useState({
    totalNodes: 0,
    totalEdges: 0,
    avgScore: 0,
    scoreDistribution: [] as number[],
  });

  // Convert search results to graph data
  const buildGraphData = useCallback(
    (results: SearchResult[]): GraphData => {
      const nodes: Node[] = [];
      const edges: Edge[] = [];
      const nodeMap = new Map<string, Node>();

      // Add query node at center
      const queryNode: Node = {
        id: "query",
        type: "Query",
        label: query,
        x: 400,
        y: 300,
        size: 20,
        color: "#F44336",
        fixed: true,
      };
      nodes.push(queryNode);
      nodeMap.set("query", queryNode);

      // Process search results
      results.forEach((result, index) => {
        // Calculate position based on score and source
        const angle = (index / results.length) * 2 * Math.PI;
        const distance = 150 + (1 - result.score) * 200;

        // Create result node
        const node: Node = {
          id: result.id,
          type: result.type,
          label: result.title,
          x: 400 + distance * Math.cos(angle),
          y: 300 + distance * Math.sin(angle),
          size: 5 + result.score * 15,
          color: getSourceColor(result),
          data: result,
        };

        nodes.push(node);
        nodeMap.set(result.id, node);

        // Create edge from query to result
        edges.push({
          id: `query-${result.id}`,
          source: queryNode,
          target: node,
          weight: result.score,
          color: getScoreColor(result.score),
          width: 1 + result.score * 3,
        });

        // Add document nodes for paragraphs
        if (result.type === "Paragraph" && result.metadata?.documentId) {
          const docId = result.metadata.documentId;

          if (!nodeMap.has(docId)) {
            const docNode: Node = {
              id: docId,
              type: "Document",
              label: result.metadata.documentTitle || docId,
              size: 8,
              color: "#4CAF50",
            };
            nodes.push(docNode);
            nodeMap.set(docId, docNode);
          }

          edges.push({
            id: `${result.id}-${docId}`,
            source: node,
            target: nodeMap.get(docId)!,
            weight: 0.5,
            color: "#999",
            style: "dashed",
          });
        }

        // Add topic connections
        if (result.metadata?.topics) {
          result.metadata.topics.forEach((topic: string) => {
            const topicId = `topic-${topic}`;

            if (!nodeMap.has(topicId)) {
              const topicNode: Node = {
                id: topicId,
                type: "Topic",
                label: topic,
                size: 6,
                color: "#FF9800",
              };
              nodes.push(topicNode);
              nodeMap.set(topicId, topicNode);
            }

            edges.push({
              id: `${result.id}-${topicId}`,
              source: node,
              target: nodeMap.get(topicId)!,
              weight: 0.3,
              color: "#FFC107",
              style: "dotted",
            });
          });
        }
      });

      // Calculate statistics
      const scores = results.map((r) => r.score);
      setViewStats({
        totalNodes: nodes.length,
        totalEdges: edges.length,
        avgScore: scores.reduce((a, b) => a + b, 0) / scores.length,
        scoreDistribution: calculateDistribution(scores),
      });

      return { nodes, edges };
    },
    [query],
  );

  // Update graph when results change
  useEffect(() => {
    if (searchResults && searchResults.length > 0) {
      const data = buildGraphData(searchResults);
      setGraphData(data);
    }
  }, [searchResults, buildGraphData]);

  // Handle weight changes
  const handleWeightChange = useCallback(
    (newWeights: SearchWeights) => {
      setWeights(newWeights);

      // Recalculate scores with new weights
      const updatedResults = searchResults.map((result) => ({
        ...result,
        score: calculateHybridScore(result, newWeights),
      }));

      // Sort by new scores
      updatedResults.sort((a, b) => b.score - a.score);

      // Update graph
      const data = buildGraphData(updatedResults);
      setGraphData(data);

      if (onWeightChange) {
        onWeightChange(newWeights);
      }
    },
    [searchResults, buildGraphData, onWeightChange],
  );

  // Calculate hybrid score with custom weights
  const calculateHybridScore = (
    result: SearchResult,
    w: SearchWeights,
  ): number => {
    const { bm25, vector, kg } = result.scores;

    // Apply filters
    let score = 0;
    if (filterSources.bm25) score += bm25 * 0.4;
    if (filterSources.vector) score += vector * 0.35;
    if (filterSources.kg) score += kg * 0.25;

    // Apply KG boost weights
    if (result.metadata?.kgFeatures) {
      const features = result.metadata.kgFeatures;
      score += w.alpha * Math.log2(1 + features.mentionCount || 0);
      score += w.beta * (features.jaccardSimilarity || 0);
      score += w.gamma * (features.pagerank || 0);
    }

    return Math.min(1, score);
  };

  // Handle node selection
  const handleNodeClick = useCallback(
    (node: Node) => {
      setSelectedNode(node);

      if (node.type === "Query") {
        // Re-run search if query node clicked
        if (onSearch) onSearch(query);
      } else {
        if (onNodeSelect) onNodeSelect(node);

        // Expand/collapse node connections
        setExpandedNodes((prev) => {
          const newSet = new Set(prev);
          if (newSet.has(node.id)) {
            newSet.delete(node.id);
          } else {
            newSet.add(node.id);
          }
          return newSet;
        });
      }
    },
    [query, onSearch, onNodeSelect],
  );

  // Render search controls
  const renderSearchControls = () => (
    <div className="search-controls">
      <div className="search-bar">
        <input
          type="text"
          value={query}
          onChange={(_e) => {
            /* Handle query change */
          }}
          placeholder="Enter search query..."
        />
        <button onClick={() => onSearch?.(query)}>Search</button>
      </div>

      <div className="source-filters">
        <label>
          <input
            type="checkbox"
            checked={filterSources.bm25}
            onChange={(e) =>
              setFilterSources((prev) => ({ ...prev, bm25: e.target.checked }))
            }
          />
          BM25
        </label>
        <label>
          <input
            type="checkbox"
            checked={filterSources.vector}
            onChange={(e) =>
              setFilterSources((prev) => ({
                ...prev,
                vector: e.target.checked,
              }))
            }
          />
          Vector
        </label>
        <label>
          <input
            type="checkbox"
            checked={filterSources.kg}
            onChange={(e) =>
              setFilterSources((prev) => ({ ...prev, kg: e.target.checked }))
            }
          />
          KG
        </label>
      </div>
    </div>
  );

  // Render weight tuner
  const renderWeightTuner = () => (
    <div className="weight-tuner">
      <h3>KG Boost Weights</h3>

      <div className="weight-slider">
        <label>
          α (Mentions): {weights.alpha.toFixed(2)}
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={weights.alpha}
            onChange={(e) =>
              handleWeightChange({
                ...weights,
                alpha: parseFloat(e.target.value),
              })
            }
          />
        </label>
      </div>

      <div className="weight-slider">
        <label>
          β (Jaccard): {weights.beta.toFixed(2)}
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={weights.beta}
            onChange={(e) =>
              handleWeightChange({
                ...weights,
                beta: parseFloat(e.target.value),
              })
            }
          />
        </label>
      </div>

      <div className="weight-slider">
        <label>
          γ (PageRank): {weights.gamma.toFixed(2)}
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={weights.gamma}
            onChange={(e) =>
              handleWeightChange({
                ...weights,
                gamma: parseFloat(e.target.value),
              })
            }
          />
        </label>
      </div>
    </div>
  );

  // Render result list
  const renderResultList = () => (
    <div className="result-list">
      <h3>Search Results</h3>
      {searchResults.map((result, index) => (
        <div
          key={result.id}
          className={`result-_item ${selectedNode?.id === result.id ? "selected" : ""}`}
          onClick={() => handleNodeClick({ id: result.id } as Node)}
          onMouseEnter={() => setHoveredResult(result)}
          onMouseLeave={() => setHoveredResult(null)}
        >
          <div className="result-rank">#{index + 1}</div>
          <div className="result-content">
            <div className="result-title">{result.title}</div>
            <div className="result-path">{result.path}</div>
            <div className="result-scores">
              <ScoreBar
                label="BM25"
                value={result.scores.bm25}
                color="#4CAF50"
              />
              <ScoreBar
                label="Vector"
                value={result.scores.vector}
                color="#2196F3"
              />
              <ScoreBar label="KG" value={result.scores.kg} color="#FF9800" />
            </div>
            {result.highlights && (
              <div className="result-highlights">
                {result.highlights.map((highlight, i) => (
                  <span key={i} className="highlight">
                    {highlight}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="result-score">{result.score.toFixed(3)}</div>
        </div>
      ))}
    </div>
  );

  // Render statistics panel
  const renderStats = () => (
    <div className="stats-panel">
      <div className="stat">
        <label>Nodes:</label>
        <value>{viewStats.totalNodes}</value>
      </div>
      <div className="stat">
        <label>Edges:</label>
        <value>{viewStats.totalEdges}</value>
      </div>
      <div className="stat">
        <label>Avg Score:</label>
        <value>{viewStats.avgScore.toFixed(3)}</value>
      </div>
      <div className="score-distribution">
        <ScoreDistribution data={viewStats.scoreDistribution} />
      </div>
    </div>
  );

  // Render detail panel for selected node
  const renderDetailPanel = () => {
    if (!selectedNode || !selectedNode.data) return null;

    const result = selectedNode.data as SearchResult;

    return (
      <div className="detail-panel">
        <h3>{result.title}</h3>
        <div className="detail-path">{result.path}</div>

        <div className="detail-scores">
          <h4>Score Breakdown</h4>
          <div className="score-details">
            <div>BM25: {result.scores.bm25.toFixed(3)}</div>
            <div>Vector: {result.scores.vector.toFixed(3)}</div>
            <div>KG: {result.scores.kg.toFixed(3)}</div>
            <div className="total-score">Total: {result.score.toFixed(3)}</div>
          </div>
        </div>

        {result.metadata?.kgFeatures && (
          <div className="kg-features">
            <h4>KG Features</h4>
            <div>Mentions: {result.metadata.kgFeatures.mentionCount}</div>
            <div>
              Jaccard:{" "}
              {result.metadata.kgFeatures.jaccardSimilarity?.toFixed(3)}
            </div>
            <div>
              PageRank: {result.metadata.kgFeatures.pagerank?.toFixed(4)}
            </div>
          </div>
        )}

        {result.content && (
          <div className="detail-content">
            <h4>Content</h4>
            <p>{result.content.substring(0, 500)}...</p>
          </div>
        )}

        <div className="detail-actions">
          <button onClick={() => window.open(result._path, "_blank")}>
            View Source
          </button>
          <button
            onClick={() => navigator.clipboard.writeText(result.content || "")}
          >
            Copy
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="search-visualization">
      <div className="search-header">
        {renderSearchControls()}
        {renderStats()}
      </div>

      <div className="search-body">
        <div className="left-panel">
          {renderWeightTuner()}
          {renderResultList()}
        </div>

        <div className="graph-panel">
          {graphData && (
            <GraphCanvas
              data={graphData}
              viewMode={ViewMode.SEARCH}
              onNodeClick={handleNodeClick}
              onNodeHover={(node) => {
                if (node?.data) {
                  setHoveredResult(node.data as SearchResult);
                } else {
                  setHoveredResult(null);
                }
              }}
              config={{
                layout: "force",
                physics: {
                  gravity: 0.05,
                  charge: -300,
                  linkDistance: 100,
                },
              }}
            />
          )}
        </div>

        <div className="right-panel">{renderDetailPanel()}</div>
      </div>

      {/* Hover tooltip */}
      {hoveredResult && <ResultTooltip result={hoveredResult} />}
    </div>
  );
};

// Helper components
const ScoreBar: React.FC<{ label: string; value: number; color: string }> = ({
  label,
  value,
  color,
}) => (
  <div className="score-bar">
    <span className="score-label">{label}</span>
    <div className="score-bar-bg">
      <div
        className="score-bar-fill"
        style={{ width: `${value * 100}%`, backgroundColor: color }}
      />
    </div>
    <span className="score-value">{value.toFixed(2)}</span>
  </div>
);

const ScoreDistribution: React.FC<{ data: number[] }> = ({ data }) => {
  // Mini bar chart using D3
  React.useEffect(() => {
    if (!data || data.length === 0) return;

    const svg = d3.select(".score-distribution svg");
    svg.selectAll("*").remove();

    const width = 150;
    const height = 40;
    const barWidth = width / data.length;

    const yScale = d3
      .scaleLinear()
      .domain([0, Math.max(...data)])
      .range([height, 0]);

    svg
      .selectAll("rect")
      .data(data)
      .enter()
      .append("rect")
      .attr("x", (_d, i) => i * barWidth)
      .attr("y", (d) => yScale(d))
      .attr("width", barWidth - 1)
      .attr("height", (d) => height - yScale(d))
      .attr("fill", "#2196F3");
  }, [data]);

  return <svg width="150" height="40" />;
};

const ResultTooltip: React.FC<{ result: SearchResult }> = ({ result }) => (
  <div className="result-tooltip">
    <div className="tooltip-title">{result.title}</div>
    <div className="tooltip-scores">
      BM25: {result.scores.bm25.toFixed(2)} | Vector:{" "}
      {result.scores.vector.toFixed(2)} | KG: {result.scores.kg.toFixed(2)}
    </div>
    <div className="tooltip-source">{result.source}</div>
  </div>
);

// Helper functions
function getSourceColor(result: SearchResult): string {
  // Color based on highest scoring source
  const { bm25, vector, kg } = result.scores;

  if (bm25 >= vector && bm25 >= kg) {
    return "#4CAF50"; // Green for BM25
  } else if (vector >= bm25 && vector >= kg) {
    return "#2196F3"; // Blue for Vector
  } else {
    return "#FF9800"; // Orange for KG
  }
}

function getScoreColor(score: number): string {
  // Gradient from red to green based on score
  const hue = score * 120; // 0 (red) to 120 (green)
  return `hsl(${hue}, 70%, 50%)`;
}

function calculateDistribution(scores: number[]): number[] {
  // Create histogram bins
  const bins = 10;
  const distribution = new Array(bins).fill(0);

  scores.forEach((score) => {
    const bin = Math.min(Math.floor(score * bins), bins - 1);
    distribution[bin]++;
  });

  return distribution;
}

export default SearchVisualization;
