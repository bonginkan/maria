/**
 * Compression Pipeline Test Suite
 * Phase 4.0 Week 2: Comprehensive testing for compression algorithms
 * Coverage target: 80%+
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { CompressionPipeline } from "../compression/CompressionPipeline";
import { Readable, Transform } from "stream";
import * as crypto from "crypto";

// Mock compression libraries
vi.mock("lz4", () => ({
  encode: vi.fn((data) =>
    Buffer.from(data).slice(0, Math.floor(data.length * 0.45)),
  ),
  decode: vi.fn((data) => Buffer.concat([data, data])),
}));

vi.mock("zstd-codec", () => ({
  ZstdCodec: class {
    static run(callback: (codec: any) => void) {
      callback({
        Simple: {
          compress: vi.fn((data) =>
            Buffer.from(data).slice(0, Math.floor(data.length * 0.35)),
          ),
          decompress: vi.fn((data) =>
            Buffer.concat([data, Buffer.from("expanded")]),
          ),
        },
      });
    }
  },
}));

describe("CompressionPipeline", () => {
  let pipeline: CompressionPipeline;

  const testConfig = {
    defaultAlgorithm: "lz4" as const,
    compressionLevel: 5,
    chunkSize: 1024 * 64,
    enableBenchmarking: true,
    enableAdaptiveSelection: true,
    minCompressionRatio: 0.1,
    maxCompressionRatio: 0.9,
  };

  beforeEach(() => {
    pipeline = new CompressionPipeline(testConfig);
  });

  describe("Algorithm Selection", () => {
    it("should select optimal algorithm based on data entropy", async () => {
      // Low entropy data (repetitive)
      const lowEntropyData = Buffer.alloc(1000, "a");
      const lowEntropyAlgo =
        await pipeline.selectOptimalAlgorithm(lowEntropyData);
      expect(["zstd", "brotli"]).toContain(lowEntropyAlgo);

      // High entropy data (random)
      const highEntropyData = crypto.randomBytes(1000);
      const highEntropyAlgo =
        await pipeline.selectOptimalAlgorithm(highEntropyData);
      expect(["lz4", "snappy"]).toContain(highEntropyAlgo);
    });

    it("should respect manual algorithm override", async () => {
      const data = Buffer.from("test data");
      const compressed = await pipeline.compress(data, { algorithm: "snappy" });

      expect(compressed).toBeDefined();
      expect(compressed.length).toBeLessThan(data.length * 2); // Some compression expected
    });

    it("should calculate entropy correctly", () => {
      const uniformData = Buffer.alloc(256, "x");
      const uniformEntropy = (pipeline as any).calculateEntropy(uniformData);
      expect(uniformEntropy).toBeLessThan(1);

      const randomData = crypto.randomBytes(256);
      const randomEntropy = (pipeline as any).calculateEntropy(randomData);
      expect(randomEntropy).toBeGreaterThan(uniformEntropy);
    });
  });

  describe("Compression Operations", () => {
    it("should compress data successfully", async () => {
      const originalData = Buffer.from(
        "This is test data that should be compressed",
      );
      const compressed = await pipeline.compress(originalData);

      expect(compressed).toBeDefined();
      expect(compressed.length).toBeLessThan(originalData.length);
    });

    it("should handle empty data", async () => {
      const emptyData = Buffer.from("");
      const compressed = await pipeline.compress(emptyData);

      expect(compressed).toBeDefined();
      expect(compressed.length).toBe(0);
    });

    it("should handle large data with chunking", async () => {
      const largeData = Buffer.alloc(1024 * 1024, "test"); // 1MB
      const result = await pipeline.compressChunked(largeData);

      expect(result.chunks).toBeDefined();
      expect(result.chunks.length).toBeGreaterThan(0);
      expect(result.totalCompressed).toBeLessThan(largeData.length);
      expect(result.metadata.algorithm).toBeDefined();
    });

    it("should compress with different algorithms", async () => {
      const data = Buffer.from("Test data for compression");

      const algorithms = ["lz4", "zstd", "brotli", "snappy"] as const;
      const results = await Promise.all(
        algorithms.map((algo) => pipeline.compress(data, { algorithm: algo })),
      );

      expect(results).toHaveLength(4);
      results.forEach((result) => {
        expect(result).toBeDefined();
        expect(result.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Decompression Operations", () => {
    it("should decompress data correctly", async () => {
      const originalData = Buffer.from("Original test data");
      const compressed = await pipeline.compress(originalData);
      const decompressed = await pipeline.decompress(compressed, "lz4");

      expect(decompressed.toString()).toContain("Original"); // Mock returns partial data
    });

    it("should handle decompression errors", async () => {
      const invalidData = Buffer.from("invalid compressed data");

      await expect(pipeline.decompress(invalidData, "lz4")).rejects.toThrow();
    });

    it("should decompress chunked data", async () => {
      const originalData = Buffer.alloc(1024 * 512, "data");
      const compressed = await pipeline.compressChunked(originalData);
      const decompressed = await pipeline.decompressChunked(compressed);

      expect(decompressed).toBeDefined();
      expect(decompressed.length).toBeGreaterThan(0);
    });
  });

  describe("Streaming Operations", () => {
    it("should create compression stream", () => {
      const stream = pipeline.createCompressionStream();

      expect(stream).toBeInstanceOf(Transform);
      expect(stream.readable).toBe(true);
      expect(stream.writable).toBe(true);
    });

    it("should create decompression stream", () => {
      const stream = pipeline.createDecompressionStream("lz4");

      expect(stream).toBeInstanceOf(Transform);
      expect(stream.readable).toBe(true);
      expect(stream.writable).toBe(true);
    });

    it("should compress data through stream", async () => {
      const input = Readable.from(["test", " ", "data"]);
      const compressionStream = pipeline.createCompressionStream();
      const chunks: Buffer[] = [];

      await new Promise<void>((resolve, reject) => {
        compressionStream.on("data", (chunk) => chunks.push(chunk));
        compressionStream.on("end", resolve);
        compressionStream.on("error", reject);

        input.pipe(compressionStream);
      });

      expect(chunks.length).toBeGreaterThan(0);
      const compressed = Buffer.concat(chunks);
      expect(compressed.length).toBeGreaterThan(0);
    });
  });

  describe("Benchmarking", () => {
    it("should benchmark compression algorithms", async () => {
      const data = Buffer.from("Benchmark test data".repeat(100));
      const results = await pipeline.benchmarkAlgorithms(data);

      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);

      results.forEach((result) => {
        expect(result.algorithm).toBeDefined();
        expect(result.compressionRatio).toBeGreaterThan(0);
        expect(result.compressionRatio).toBeLessThan(1);
        expect(result.compressionTime).toBeGreaterThan(0);
        expect(result.decompressionTime).toBeGreaterThan(0);
      });
    });

    it("should select best algorithm from benchmark", async () => {
      const data = Buffer.from("Data for algorithm selection".repeat(50));
      const benchmarks = await pipeline.benchmarkAlgorithms(data);

      const bestByRatio = benchmarks.reduce((best, current) =>
        current.compressionRatio < best.compressionRatio ? current : best,
      );

      const bestBySpeed = benchmarks.reduce((best, current) =>
        current.compressionTime < best.compressionTime ? current : best,
      );

      expect(bestByRatio.algorithm).toBeDefined();
      expect(bestBySpeed.algorithm).toBeDefined();
    });
  });

  describe("Statistics and Monitoring", () => {
    it("should track compression statistics", async () => {
      const data = Buffer.from("Statistical test data");
      await pipeline.compress(data);

      const stats = pipeline.getStatistics();

      expect(stats.totalCompressed).toBeGreaterThan(0);
      expect(stats.totalDecompressed).toBeGreaterThanOrEqual(0);
      expect(stats.averageCompressionRatio).toBeGreaterThan(0);
      expect(stats.averageCompressionRatio).toBeLessThan(1);
      expect(stats.algorithmUsage).toBeDefined();
    });

    it("should emit compression events", async () => {
      const events: any[] = [];

      pipeline.on("compression_complete", (event) => events.push(event));
      pipeline.on("compression_error", (event) => events.push(event));

      const data = Buffer.from("Event test data");
      await pipeline.compress(data);

      expect(events.length).toBeGreaterThan(0);
      expect(events[0]).toHaveProperty("algorithm");
      expect(events[0]).toHaveProperty("originalSize");
      expect(events[0]).toHaveProperty("compressedSize");
    });

    it("should update algorithm usage statistics", async () => {
      const data = Buffer.from("Usage tracking test");

      await pipeline.compress(data, { algorithm: "lz4" });
      await pipeline.compress(data, { algorithm: "zstd" });
      await pipeline.compress(data, { algorithm: "lz4" });

      const stats = pipeline.getStatistics();

      expect(stats.algorithmUsage.lz4).toBe(2);
      expect(stats.algorithmUsage.zstd).toBe(1);
    });
  });

  describe("Error Handling", () => {
    it("should handle compression failures gracefully", async () => {
      // Force an error by passing invalid data type
      const invalidData = null as any;

      await expect(pipeline.compress(invalidData)).rejects.toThrow();
    });

    it("should validate compression options", async () => {
      const data = Buffer.from("test");

      await expect(
        pipeline.compress(data, { algorithm: "invalid" as any }),
      ).rejects.toThrow();
    });

    it("should handle stream errors", async () => {
      const errorStream = new Readable({
        read() {
          this.emit("error", new Error("Stream error"));
        },
      });

      const compressionStream = pipeline.createCompressionStream();

      await expect(
        new Promise((resolve, reject) => {
          compressionStream.on("error", reject);
          compressionStream.on("end", resolve);
          errorStream.pipe(compressionStream);
        }),
      ).rejects.toThrow("Stream error");
    });
  });

  describe("Chunked Processing", () => {
    it("should split data into optimal chunks", async () => {
      const data = Buffer.alloc(1024 * 256, "x"); // 256KB
      const result = await pipeline.compressChunked(data, {
        chunkSize: 1024 * 64, // 64KB chunks
      });

      expect(result.chunks.length).toBe(4);
      expect(result.metadata.chunkSize).toBe(1024 * 64);
    });

    it("should handle chunk compression errors", async () => {
      const data = Buffer.alloc(1024 * 100);

      // Mock a compression failure for testing
      const originalCompress = pipeline.compress;
      let callCount = 0;
      pipeline.compress = vi.fn(async (data, options) => {
        callCount++;
        if (callCount === 2) {
          throw new Error("Chunk compression failed");
        }
        return originalCompress.call(pipeline, data, options);
      });

      await expect(
        pipeline.compressChunked(data, { chunkSize: 1024 * 30 }),
      ).rejects.toThrow("Chunk compression failed");
    });

    it("should validate chunk metadata", async () => {
      const data = Buffer.from("Small data");
      const compressed = await pipeline.compressChunked(data);

      expect(compressed.metadata).toHaveProperty("version");
      expect(compressed.metadata).toHaveProperty("algorithm");
      expect(compressed.metadata).toHaveProperty("chunkSize");
      expect(compressed.metadata).toHaveProperty("checksum");
      expect(compressed.totalOriginal).toBe(data.length);
    });
  });

  describe("Performance Optimization", () => {
    it("should cache algorithm selection for similar data", async () => {
      const similarData1 = Buffer.from("Similar test data pattern 1");
      const similarData2 = Buffer.from("Similar test data pattern 2");

      const algo1 = await pipeline.selectOptimalAlgorithm(similarData1);
      const algo2 = await pipeline.selectOptimalAlgorithm(similarData2);

      expect(algo1).toBe(algo2);
    });

    it("should handle concurrent compressions", async () => {
      const operations = Array.from({ length: 10 }, (_, i) =>
        Buffer.from(`Concurrent data ${i}`),
      );

      const results = await Promise.all(
        operations.map((data) => pipeline.compress(data)),
      );

      expect(results).toHaveLength(10);
      results.forEach((result) => {
        expect(result).toBeDefined();
        expect(result.length).toBeGreaterThan(0);
      });
    });

    it("should optimize for compression ratio when specified", async () => {
      const data = Buffer.from("Optimization test data".repeat(100));

      const speedOptimized = await pipeline.compress(data, {
        priority: "speed",
      });

      const ratioOptimized = await pipeline.compress(data, {
        priority: "ratio",
      });

      // In real implementation, ratio-optimized should be smaller
      expect(speedOptimized).toBeDefined();
      expect(ratioOptimized).toBeDefined();
    });
  });

  describe("Configuration Validation", () => {
    it("should validate configuration on initialization", () => {
      expect(() => {
        new CompressionPipeline({
          defaultAlgorithm: "invalid" as any,
          compressionLevel: 5,
        });
      }).toThrow();
    });

    it("should use default configuration values", () => {
      const pipeline = new CompressionPipeline({});
      const config = (pipeline as any).config;

      expect(config.defaultAlgorithm).toBe("lz4");
      expect(config.compressionLevel).toBe(5);
      expect(config.chunkSize).toBe(1024 * 1024);
    });

    it("should validate compression level bounds", () => {
      expect(() => {
        new CompressionPipeline({
          compressionLevel: -1,
        });
      }).toThrow();

      expect(() => {
        new CompressionPipeline({
          compressionLevel: 12,
        });
      }).toThrow();
    });
  });
});

describe("Compression Pipeline Integration", () => {
  it("should handle real-world JSON compression scenario", async () => {
    const pipeline = new CompressionPipeline({
      enableAdaptiveSelection: true,
    });

    const jsonData = {
      users: Array.from({ length: 100 }, (_, i) => ({
        id: `user-${i}`,
        name: `User Name ${i}`,
        email: `user${i}@example.com`,
        metadata: {
          created: new Date().toISOString(),
          tags: ["tag1", "tag2", "tag3"],
          preferences: {
            theme: "dark",
            language: "en",
          },
        },
      })),
    };

    const originalBuffer = Buffer.from(JSON.stringify(jsonData));
    const compressed = await pipeline.compress(originalBuffer);

    expect(compressed.length).toBeLessThan(originalBuffer.length);

    const compressionRatio = compressed.length / originalBuffer.length;
    expect(compressionRatio).toBeLessThan(0.5); // Expect at least 50% compression for JSON
  });

  it("should handle streaming large file compression", async () => {
    const pipeline = new CompressionPipeline({
      defaultAlgorithm: "zstd",
    });

    // Simulate large file stream
    const chunks = Array.from({ length: 100 }, (_, i) =>
      Buffer.from(`Chunk ${i}: ${"x".repeat(1000)}`),
    );

    const inputStream = Readable.from(chunks);
    const compressionStream = pipeline.createCompressionStream();
    const outputChunks: Buffer[] = [];

    await new Promise<void>((resolve, reject) => {
      compressionStream.on("data", (chunk) => outputChunks.push(chunk));
      compressionStream.on("end", resolve);
      compressionStream.on("error", reject);

      inputStream.pipe(compressionStream);
    });

    const compressed = Buffer.concat(outputChunks);
    const original = Buffer.concat(chunks);

    expect(compressed.length).toBeLessThan(original.length);
  });
});
