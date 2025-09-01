/**
 * Tests for streaming optimization components
 */

import { describe, it, expect, beforeEach, vi as _vi } from "vitest";
import {
  StreamingRenderer,
  UIPort,
  CompletionChunk,
} from "../../../services/code-quality/StreamingRenderer";
import { BackpressureController } from "../../../services/code-quality/BackpressureController";
import { MetricsDashboard } from "../../../services/code-quality/MetricsDashboard";

// Mock UI implementation
class MockUI implements UIPort {
  chunks: string[] = [];
  codeBlockStarted = false;
  codeBlockEnded = false;

  writeChunk(chunk: string): void {
    this.chunks.push(chunk);
  }

  startCodeBlock(_language?: string): void {
    this.codeBlockStarted = true;
  }

  endCodeBlock(): void {
    this.codeBlockEnded = true;
  }

  clear(): void {
    this.chunks = [];
  }
}

// Mock stream generator
async function* createMockStream(
  chunks: string[],
  delayMs = 10,
): AsyncIterable<CompletionChunk> {
  for (const content of chunks) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    yield {
      choices: [
        {
          delta: { content },
          finish_reason: undefined,
        },
      ],
    };
  }

  // Final chunk with finish reason
  yield {
    choices: [
      {
        finish_reason: "stop",
      },
    ],
  };
}

describe("StreamingRenderer", () => {
  let renderer: StreamingRenderer;
  let mockUI: MockUI;

  beforeEach(() => {
    mockUI = new MockUI();
    renderer = new StreamingRenderer(mockUI);
  });

  it("should render stream chunks with throttling", async () => {
    const chunks = ["Hello", " ", "World", "!"];
    const stream = createMockStream(chunks, 5);

    const result = await renderer.renderStream(stream);

    expect(result.content).toBe("Hello World!");
    expect(mockUI.chunks.length).toBeGreaterThan(0);
    expect(mockUI.chunks.join("")).toContain("Hello");
  });

  it("should measure first token time", async () => {
    const chunks = ["First", " token", " test"];
    const stream = createMockStream(chunks, 50);

    const result = await renderer.renderStream(stream);

    expect(result.metrics.firstTokenMs).toBeGreaterThan(0);
    expect(result.metrics.firstTokenMs).toBeLessThan(100);
    expect(result.metrics.totalTokens).toBeGreaterThan(0);
  });

  it("should detect and handle code blocks", async () => {
    const chunks = [
      "Here is code:\n```javascript\n",
      'console.log("test");',
      "\n```",
    ];
    const stream = createMockStream(chunks);

    await renderer.renderStream(stream);

    expect(mockUI.codeBlockStarted).toBe(true);
    expect(mockUI.codeBlockEnded).toBe(true);
  });

  it("should handle abort signal", async () => {
    const controller = new AbortController();
    const chunks = ["Start", " middle", " end"];
    const stream = createMockStream(chunks, 100);

    // Abort after 150ms (should get first chunk only)
    setTimeout(() => controller.abort(), 150);

    const result = await renderer.renderStream(stream, controller.signal);

    expect(result.content).not.toContain("end");
  });

  it("should calculate throughput correctly", async () => {
    const chunks = Array(10).fill("token ");
    const stream = createMockStream(chunks, 10);

    const result = await renderer.renderStream(stream);

    expect(result.metrics.throughputTokensPerSec).toBeGreaterThan(0);
    expect(result.metrics.chunksReceived).toBe(10);
  });
});

describe("BackpressureController", () => {
  let controller: BackpressureController;
  let processedChunks: string[];

  beforeEach(() => {
    processedChunks = [];
    controller = new BackpressureController(
      async (chunk: string) => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        processedChunks.push(chunk);
      },
      { maxQueueSize: 10, processBatchSize: 2 },
    );
  });

  it("should process chunks in batches", async () => {
    const chunks = ["a", "b", "c", "d"];

    for (const chunk of chunks) {
      await controller.handle(chunk);
    }

    // Wait for processing
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(processedChunks.join("")).toContain("ab");
  });

  it("should apply backpressure when queue is full", async () => {
    // Create a controller with small queue for testing
    const testController = new BackpressureController(
      async (chunk: string) => {
        // Slow processor to trigger backpressure
        await new Promise((resolve) => setTimeout(resolve, 10));
        processedChunks.push(chunk);
      },
      { maxQueueSize: 3, processBatchSize: 1 },
    );

    // Fill queue beyond capacity with priority chunks (they wait)
    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push(testController.handle(`chunk${i}`, { priority: true }));
    }

    // Allow some processing time
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Check metrics
    const metrics = testController.getMetrics();
    expect(metrics.backpressureEvents).toBeGreaterThan(0);

    // Clean up
    await testController.flush();
    await Promise.all(promises);
  });

  it("should drop non-priority chunks when full", async () => {
    // Fill queue to capacity
    for (let i = 0; i < 10; i++) {
      await controller.handle(`priority${i}`, { priority: true });
    }

    // Non-priority chunk should be dropped
    await controller.handle("dropped", { priority: false });

    const metrics = controller.getMetrics();
    expect(metrics.droppedChunks).toBeGreaterThan(0);
  });

  it("should flush all remaining chunks", async () => {
    // Create a fresh controller for this test
    const flushController = new BackpressureController(
      async (chunk: string) => {
        processedChunks.push(chunk);
      },
      { maxQueueSize: 10, processBatchSize: 2 },
    );

    const chunks = ["flush1", "flush2", "flush3"];

    // Add chunks
    for (const chunk of chunks) {
      await flushController.handle(chunk);
    }

    // Clear processed chunks before flush
    processedChunks = [];

    // Flush should process all immediately
    await flushController.flush();

    // All chunks should be processed
    expect(processedChunks.length).toBe(3);
    expect(processedChunks).toContain("flush1");
    expect(processedChunks).toContain("flush2");
    expect(processedChunks).toContain("flush3");
  });
});

describe("MetricsDashboard", () => {
  let dashboard: MetricsDashboard;

  beforeEach(() => {
    dashboard = new MetricsDashboard({
      updateIntervalMs: 100,
      showSparklines: true,
      colorOutput: false, // Disable colors for testing
    });
  });

  it("should record and calculate metrics", () => {
    // Record some metrics
    dashboard.recordGeneration({
      type: "template_hit",
      prompt: "test",
      duration: 10,
      tokenCount: 100,
    });

    dashboard.recordGeneration({
      type: "cache_hit",
      prompt: "test2",
      duration: 50,
      tokenCount: 200,
    });

    dashboard.recordGeneration({
      type: "generated",
      prompt: "test3",
      model: "gpt-4o-mini",
      duration: 1000,
      tokenCount: 500,
      firstTokenMs: 200,
      throughputTokensPerSec: 50,
    });

    const snapshot = dashboard.getSnapshot();

    expect(snapshot.volume.totalRequests).toBe(3);
    expect(snapshot.hitRates.template).toBeGreaterThan(0);
    expect(snapshot.hitRates.cache).toBeGreaterThan(0);
    expect(snapshot.hitRates.generated).toBeGreaterThan(0);
  });

  it("should calculate latency percentiles", () => {
    // Record latency metrics
    for (let i = 1; i <= 100; i++) {
      dashboard.record({
        type: "latency",
        value: i * 10, // 10ms to 1000ms
        timestamp: Date.now(),
      });
    }

    const snapshot = dashboard.getSnapshot();

    expect(snapshot.latency.p50).toBeCloseTo(500, -2);
    expect(snapshot.latency.p95).toBeCloseTo(950, -2);
    expect(snapshot.latency.p99).toBeCloseTo(990, -2);
  });

  it("should track streaming metrics", () => {
    dashboard.record({
      type: "first_token",
      value: 150,
      timestamp: Date.now(),
    });

    dashboard.record({
      type: "throughput",
      value: 75,
      timestamp: Date.now(),
    });

    const snapshot = dashboard.getSnapshot();

    expect(snapshot.streaming.firstTokenMs).toBe(150);
    expect(snapshot.streaming.throughputTokensPerSec).toBe(75);
  });

  it("should clear metrics", () => {
    dashboard.recordGeneration({
      type: "generated",
      prompt: "test",
      duration: 100,
      tokenCount: 50,
    });

    expect(dashboard.getSnapshot().volume.totalRequests).toBe(1);

    dashboard.clear();

    expect(dashboard.getSnapshot().volume.totalRequests).toBe(0);
  });
});

describe("Integration: Streaming Performance", () => {
  it("should achieve <500ms first token time", async () => {
    const mockUI = new MockUI();
    const renderer = new StreamingRenderer(mockUI);

    // Simulate fast first token
    const chunks = ["First", ...Array(20).fill(" token")];
    const stream = createMockStream(chunks, 20);

    const startTime = Date.now();
    const result = await renderer.renderStream(stream);

    expect(result.metrics.firstTokenMs).toBeLessThan(500);
    expect(Date.now() - startTime).toBeLessThan(1000);
  });

  it("should handle backpressure gracefully with large streams", async () => {
    const processedChunks: string[] = [];
    const controller = new BackpressureController(
      async (chunk: string) => {
        processedChunks.push(chunk);
      },
      { maxQueueSize: 50, processBatchSize: 10 },
    );

    // Generate large stream
    const chunks = Array(200).fill("chunk");

    for (const chunk of chunks) {
      await controller.handle(chunk);
    }

    await controller.flush();

    const metrics = controller.getMetrics();
    expect(metrics.maxQueueSize).toBeLessThanOrEqual(50);
    expect(processedChunks.length).toBeGreaterThan(0);
  });
});
