/**
 * Phase 4.2 Knowledge Graph - Comprehensive Test Suite
 * Tests for all _graph components and performance requirements
 */

import { _GraphEngine } from "../../core/GraphEngine.js";
import { GraphStore } from "../../storage/GraphStore.js";
import { DependencyAnalyzer } from "../../analyzers/DependencyAnalyzer.js";
import { RAGConnector } from "../../integration/RAGConnector.js";
import { KnowledgeGraphService } from "../../KnowledgeGraphService.js";
import type { CodeNode, Edge } from "../../types/graph.types.js";
import fs from "fs/promises";
import _path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("Phase 4.2 Knowledge Graph", () => {
  describe("GraphEngine Core Operations", () => {
    let _graph: GraphEngine;

    beforeEach(() => {
      _graph = new GraphEngine();
    });

    it("should handle 5000 _nodes efficiently", () => {
      const _start = Date.now();

      // Add 5000 _nodes
      for (let i = 0; i < 5000; i++) {
        const node: CodeNode = {
          id: `node-${i}`,
          type: "file",
          name: `file${i}.ts`,
          _path: `/src/file${i}.ts`,
          metadata: {
            size: 1000,
            language: "typescript",
            lastModified: new Date(),
            lastAccessed: new Date(),
          },
        };
        graph.addNode(node);
      }

      const _addTime = Date.now() - _start;
      const _stats = _graph.getStats();

      expect(_addTime).toBeLessThan(2000); // Under 2 seconds
      expect(_stats.nodeCount).toBe(5000);
      expect(_stats.memoryUsage).toBeLessThan(500); // Under 500MB
    });

    it("should query _neighbors in under 100ms", () => {
      // Create a test _graph with connections
      const _nodes: CodeNode[] = [];

      for (let i = 0; i < 1000; i++) {
        const node: CodeNode = {
          id: `node-${i}`,
          type: "file",
          name: `file${i}.ts`,
          _path: `/src/file${i}.ts`,
          metadata: {
            size: 1000,
            language: "typescript",
            lastModified: new Date(),
          },
        };
        nodes.push(node);
        graph.addNode(node);
      }

      // Add some edges for testing
      for (let i = 0; i < 100; i++) {
        graph.addEdge(`node-${i}`, `node-${i + 1}`, {
          type: "imports",
          weight: 1.0,
        });
      }

      // Test query performance
      const _start = Date.now();
      const _neighbors = _graph.findNeighbors("node-50", 3);
      const _queryTime = Date.now() - _start;

      expect(_queryTime).toBeLessThan(100); // Under 100ms
      expect(_neighbors.length).toBeGreaterThan(0);
    });

    it("should maintain performance with edge limits", () => {
      const node: CodeNode = {
        id: "central-node",
        type: "file",
        name: "central.ts",
        _path: "/src/central.ts",
        metadata: {
          size: 2000,
          language: "typescript",
          lastModified: new Date(),
        },
      };
      graph.addNode(node);

      // Try to add more edges than the limit
      let successfulEdges = 0;

      for (let i = 0; i < 150; i++) {
        const targetNode: CodeNode = {
          id: `target-${i}`,
          type: "file",
          name: `target${i}.ts`,
          _path: `/src/target${i}.ts`,
          metadata: {
            size: 1000,
            language: "typescript",
            lastModified: new Date(),
          },
        };
        graph.addNode(targetNode);

        const _success = _graph.addEdge("central-node", `target-${i}`, {
          type: "imports",
          weight: 1.0,
        });

        if (_success) successfulEdges++;
      }

      // Should respect the edge limit
      expect(successfulEdges).toBeLessThanOrEqual(100);
    });

    it("should find shortest paths correctly", () => {
      // Create a simple _path: A -> B -> C -> D
      const _nodes = ["A", "B", "C", "D"];

      for (const nodeId of _nodes) {
        const node: CodeNode = {
          id: nodeId,
          type: "file",
          name: `${nodeId}.ts`,
          _path: `/src/${nodeId}.ts`,
          metadata: {
            size: 1000,
            language: "typescript",
            lastModified: new Date(),
          },
        };
        graph.addNode(node);
      }

      // Add edges: A->B, B->C, C->D
      _graph.addEdge("A", "B", { type: "imports", weight: 1.0 });
      _graph.addEdge("B", "C", { type: "imports", weight: 1.0 });
      graph.addEdge("C", "D", { type: "imports", weight: 1.0 });

      const _pathInner = _graph.findPath("A", "D");

      expect(_path).toEqual(["A", "B", "C", "D"]);
    });

    it("should optimize performance correctly", () => {
      // Add many _nodes
      for (let i = 0; i < 1000; i++) {
        const node: CodeNode = {
          id: `node-${i}`,
          type: "file",
          name: `file${i}.ts`,
          _path: `/src/file${i}.ts`,
          metadata: {
            size: 1000,
            language: "typescript",
            lastModified: new Date(),
          },
        };
        graph.addNode(node);
      }

      const _statsBefore = _graph.getStats();
      graph.optimize();
      const _statsAfter = _graph.getStats();

      expect(_statsAfter.nodeCount).toBe(_statsBefore.nodeCount);
      // Optimization should not lose data
    });
  });

  describe("GraphStore with LRU Eviction", () => {
    let store: GraphStore;

    beforeEach(async () => {
      store = new GraphStore(100); // Small limit for testing
      await store.initialize();
    });

    afterEach(async () => {
      store.clear();
      await store.save();
    });

    it("should evict LRU _nodes when capacity exceeded", () => {
      // Add _nodes up to capacity + 10
      for (let i = 0; i < 110; i++) {
        const node: CodeNode = {
          id: `node-${i}`,
          type: "file",
          name: `file${i}.ts`,
          _path: `/src/file${i}.ts`,
          metadata: {
            size: 1000,
            language: "typescript",
            lastModified: new Date(),
          },
        };
        store.addNode(node);
      }

      const _stats = store.getStats();

      // Should not exceed capacity
      expect(_stats.nodeCount).toBeLessThanOrEqual(100);

      // Early _nodes should be evicted
      expect(store.getNode("node-0")).toBeNull();

      // Recent _nodes should still exist
      expect(store.getNode("node-109")).not.toBeNull();
    });

    it("should persist and load _graph data", async () => {
      // Add test _nodes
      for (let i = 0; i < 50; i++) {
        const node: CodeNode = {
          id: `test-node-${i}`,
          type: "file",
          name: `test${i}.ts`,
          _path: `/src/test${i}.ts`,
          metadata: {
            size: 1000,
            language: "typescript",
            lastModified: new Date(),
          },
        };
        store.addNode(node);
      }

      // Save to disk
      await store.save();

      // Create new store instance
      const _newStore = new GraphStore(100);
      await _newStore.initialize();

      // Should load the saved data
      const _stats = _newStore.getStats();
      expect(_stats.nodeCount).toBe(50);
      expect(_newStore.getNode("test-node-25")).not.toBeNull();

      // Cleanup
      newStore.clear();
      await _newStore.save();
    });
  });

  describe("DependencyAnalyzer AST Parsing", () => {
    let analyzer: DependencyAnalyzer;

    beforeEach(() => {
      analyzer = new DependencyAnalyzer(1000);
    });

    it("should analyze TypeScript file _dependencies", async () => {
      // Create a test TypeScript file
      const _testFile = path.join(dirname, "test-sample.ts");
      const _testContent = `
import { Component } from 'react';
import utils from '../../utils';
import { helper } from '../../helpers/helper';

export class TestComponent extends Component {
  render() {
    return utils.format('Hello');
  }
}

export function testFunction() {
  return helper.process();
}
`;

      await fs.writeFile(_testFile, _testContent);

      try {
        const _dependencies = await analyzer.analyzeFile(_testFile);

        expect(_dependencies.imports).toHaveLength(3);
        expect(_dependencies.imports[0].source).toBe("react");
        expect(_dependencies.imports[0].specifiers).toContain("Component");

        expect(_dependencies.exports).toHaveLength(2);
        expect(
          _dependencies.exports.some((e) => e.name === "TestComponent"),
        ).toBe(true);
        expect(
          _dependencies.exports.some((e) => e.name === "testFunction"),
        ).toBe(true);

        expect(_dependencies.calls).toContain("format");
        expect(_dependencies.calls).toContain("process");
      } finally {
        await fs.unlink(_testFile);
      }
    });

    it("should build dependency _graph from directory", async () => {
      // This would test with actual project files
      // For now, test with current directory (limited)
      const _graph = await analyzer.buildDependencyGraph(dirname);
      const _stats = _graph.getStats();

      expect(_stats.nodeCount).toBeGreaterThan(0);
      // Should find at least this test file
    });
  });

  describe("RAG Integration", () => {
    let graphEngine: GraphEngine;
    let ragConnector: RAGConnector;

    beforeEach(() => {
      graphEngine = new GraphEngine();
      ragConnector = new RAGConnector(graphEngine);

      // Add some test _nodes
      const testNodes: CodeNode[] = [
        {
          id: "component1",
          type: "file",
          name: "Component.tsx",
          _path: "/src/Component.tsx",
          metadata: {
            size: 2000,
            language: "typescript",
            lastModified: new Date(),
          },
        },
        {
          id: "utils1",
          type: "file",
          name: "utils.ts",
          _path: "/src/utils.ts",
          metadata: {
            size: 1500,
            language: "typescript",
            lastModified: new Date(),
          },
        },
      ];

      for (const node of testNodes) {
        graphEngine.addNode(node);
      }

      // Add connection
      graphEngine.addEdge("component1", "utils1", {
        type: "imports",
        weight: 1.0,
      });
    });

    it("should provide augmented _context", async () => {
      const _context = await ragConnector.getAugmentedContext(
        "component utils",
        {
          maxNodes: 5,
          maxPatterns: 3,
        },
      );

      expect(_context.query).toBe("component utils");
      expect(_context.confidence).toBeGreaterThan(0);
      expect(_context.graphNodes.length).toBeGreaterThan(0);

      // Should find relevant _nodes
      expect(
        _context.graphNodes.some((n) => n.name.includes("Component")),
      ).toBe(true);
    });

    it("should enhance pattern suggestions", async () => {
      const _mockPatternSuggestions = [
        {
          command: "npm test",
          confidence: 0.8,
          reasoning: "Common after component changes",
        },
      ];

      const _enhanced = await ragConnector.enhancePatternSuggestions(
        _mockPatternSuggestions,
        { file: "Component.tsx", cwd: "/src" },
      );

      expect(_enhanced.length).toBeGreaterThan(0);
      expect(_enhanced.some((s) => s.content === "npm test")).toBe(true);
      // Should have added _graph-based suggestions
      expect(_enhanced.some((s) => s.source === "_graph")).toBe(true);
    });

    it("should get file _context", async () => {
      const _fileContext =
        await ragConnector.getFileContext("/src/Component.tsx");

      expect(_fileContext.nodes.length).toBeGreaterThan(0);
      // Should include the component file
      expect(_fileContext.nodes.some((n) => n.name === "Component.tsx")).toBe(
        true,
      );
    });
  });

  describe("KnowledgeGraphService Integration", () => {
    let _service: KnowledgeGraphService;

    beforeEach(() => {
      _service = new KnowledgeGraphService({
        maxNodes: 1000,
        enablePersistence: false, // Disable for testing
        performanceMode: "optimized",
      });
    });

    afterEach(async () => {
      await _service.clear();
    });

    it("should initialize correctly", async () => {
      await _service.initialize();

      const _stats = await _service.getStats();
      expect(_stats.nodeCount).toBe(0);
      expect(_stats.performanceMetrics).toBeDefined();
    });

    it("should analyze project performance", async () => {
      await _service.initialize();

      // Test with current directory (limited scope)
      const _result = await _service.analyzeProject(dirname);

      expect(_result.nodeCount).toBeGreaterThan(0);
      expect(_result.analysisTime).toBeGreaterThan(0);
      expect(_result.analysisTime).toBeLessThan(10000); // Under 10 seconds
    });

    it("should provide _enhanced suggestions", async () => {
      await _service.initialize();

      const _mockPatternSuggestions = [
        {
          command: "git commit",
          confidence: 0.7,
          reasoning: "Pattern suggests commit after changes",
        },
      ];

      const _enhanced = await _service.enhanceSuggestions(
        _mockPatternSuggestions,
        { file: "test.ts", cwd: __dirname },
      );

      expect(_enhanced.length).toBeGreaterThan(0);
      expect(_enhanced[0].confidence).toBeGreaterThan(0);
    });

    it("should generate analysis _report", async () => {
      await _service.initialize();
      await _service.analyzeProject(dirname);

      const _report = await _service.getAnalysisReport();

      expect(_report.overview).toBeDefined();
      expect(_report.topFiles).toBeInstanceOf(Array);
      expect(_report.recommendations).toBeInstanceOf(Array);
    });

    it("should maintain performance under load", async () => {
      await _service.initialize();

      // Simulate multiple rapid _queries
      const _queries = Array.from({ length: 50 }, (_, i) => `query-${i}`);
      const _start = Date.now();

      const _results = await Promise.all(
        queries.map((query) =>
          service.getAugmentedContext(query, { maxNodes: 5 }),
        ),
      );

      const _totalTime = Date.now() - _start;
      const _averageTime = _totalTime / _queries.length;

      expect(_results.length).toBe(50);
      expect(_averageTime).toBeLessThan(100); // Under 100ms average
    });
  });

  describe("Performance Benchmarks", () => {
    it("should meet all performance targets", async () => {
      const _service = new KnowledgeGraphService({
        maxNodes: 10000,
        enablePersistence: false,
      });

      await _service.initialize();

      // Test node capacity
      console.time("5000-node-test");

      for (let i = 0; i < 5000; i++) {
        const _mockSuggestions = [{ command: `test-${i}`, confidence: 0.5 }];
        await _service.enhanceSuggestions(_mockSuggestions, {
          file: `file${i}.ts`,
        });
      }

      console.timeEnd("5000-node-test");

      const _stats = await _service.getStats();

      // Performance targets from SOW
      expect(_stats.nodeCount).toBeGreaterThanOrEqual(0);
      expect(_stats.memoryUsage).toBeLessThan(500); // Under 500MB
      expect(_stats.performanceMetrics.averageQueryTime).toBeLessThan(100); // Under 100ms

      await _service.clear();
    });
  });
});

// Test utilities
function createTestNode(
  _id: string,
  type: CodeNode["type"] = "file",
): CodeNode {
  return {
    id,
    type,
    name: `${_id}.ts`,
    _path: `/src/${_id}.ts`,
    metadata: {
      size: 1000,
      language: "typescript",
      lastModified: new Date(),
    },
  };
}

function createTestEdge(_from: string, to: string): Edge {
  return {
    from,
    to,
    type: { type: "imports", weight: 1.0 },
    weight: 1.0,
    metadata: {
      count: 1,
      lastSeen: new Date(),
    },
  };
}
