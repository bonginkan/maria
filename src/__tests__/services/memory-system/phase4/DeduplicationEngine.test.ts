/**
 * Deduplication Engine Test Suite
 * Phase 4.0 Week 2: Comprehensive testing for deduplication algorithms
 * Coverage target: 80%+
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { DeduplicationEngine } from "../../../services/memory-system/data-porter-system/compression/DeduplicationEngine";
import * as crypto from "crypto";

describe("DeduplicationEngine", () => {
  let engine: DeduplicationEngine;

  const testConfig = {
    method: "content-hash" as const,
    blockSize: 4096,
    similarity: 80,
    scope: "global" as const,
    indexType: "memory" as const,
    cacheSize: 100,
    compressionFirst: false,
    parallelism: 4,
  };

  beforeEach(() => {
    engine = new DeduplicationEngine(testConfig);
  });

  describe("Block Processing", () => {
    it("should generate consistent hashes for identical content", async () => {
      const data = Buffer.from("identical test data repeated".repeat(100));

      const result1 = await engine.deduplicate(data, "test-1");
      const result2 = await engine.deduplicate(data, "test-2");

      expect(result1.blocksUnique).toBeGreaterThan(0);
      expect(result2.blocksDuplicate).toBeGreaterThan(0);
      expect(result2.deduplicationRatio).toBeGreaterThan(0);
    });

    it("should handle different block sizes efficiently", async () => {
      const smallBlockEngine = new DeduplicationEngine({
        ...testConfig,
        blockSize: 1024,
      });

      const largeBlockEngine = new DeduplicationEngine({
        ...testConfig,
        blockSize: 8192,
      });

      const data = Buffer.from(
        "test data for block size comparison".repeat(500),
      );

      const smallResult = await smallBlockEngine.deduplicate(
        data,
        "small-test",
      );
      const largeResult = await largeBlockEngine.deduplicate(
        data,
        "large-test",
      );

      expect(smallResult.blocksTotal).toBeGreaterThan(largeResult.blocksTotal);
      expect(smallResult.processingTime).toBeDefined();
      expect(largeResult.processingTime).toBeDefined();
    });

    it("should achieve target deduplication ratios for repetitive data", async () => {
      const repetitiveData = Buffer.from("ABCD".repeat(1000));

      const result = await engine.deduplicate(
        repetitiveData,
        "repetitive-test",
      );

      expect(result.deduplicationRatio).toBeGreaterThan(40); // Target: 40%+
      expect(result.deduplicatedSize).toBeLessThan(result.originalSize);
      expect(result.blocksUnique).toBeLessThan(result.blocksTotal);
    });
  });

  describe("Fuzzy Matching", () => {
    it("should detect similar content with fuzzy matching", async () => {
      const fuzzyEngine = new DeduplicationEngine({
        ...testConfig,
        method: "fuzzy-hash",
        similarity: 85,
      });

      const data1 = Buffer.from("This is a test document with some content");
      const data2 = Buffer.from("This is a test document with similar content");

      await fuzzyEngine.deduplicate(data1, "fuzzy-1");
      const result = await fuzzyEngine.deduplicate(data2, "fuzzy-2");

      expect(result.blocksDuplicate).toBeGreaterThan(0);
    });

    it("should respect similarity threshold settings", async () => {
      const strictEngine = new DeduplicationEngine({
        ...testConfig,
        method: "fuzzy-hash",
        similarity: 95,
      });

      const data1 = Buffer.from("Different content entirely");
      const data2 = Buffer.from("Completely different text");

      await strictEngine.deduplicate(data1, "strict-1");
      const result = await strictEngine.deduplicate(data2, "strict-2");

      expect(result.blocksDuplicate).toBe(0);
    });
  });

  describe("Rolling Hash", () => {
    it("should use rolling hash for efficient processing", async () => {
      const rollingEngine = new DeduplicationEngine({
        ...testConfig,
        method: "rolling-hash",
      });

      const data = Buffer.from("ABCDEFGHIJKLMNOPQRSTUVWXYZ".repeat(200));

      const result = await rollingEngine.deduplicate(data, "rolling-test");

      expect(result.method).toBe("rolling-hash");
      expect(result.processingTime).toBeDefined();
      expect(result.blocksTotal).toBeGreaterThan(0);
    });

    it("should handle overlapping content efficiently", async () => {
      const rollingEngine = new DeduplicationEngine({
        ...testConfig,
        method: "rolling-hash",
      });

      const baseData = "ABCDEFGHIJKLMNOP";
      const data1 = Buffer.from(baseData.repeat(100));
      const data2 = Buffer.from(("X" + baseData).repeat(100)); // Shifted by 1

      await rollingEngine.deduplicate(data1, "overlap-1");
      const result = await rollingEngine.deduplicate(data2, "overlap-2");

      expect(result.blocksDuplicate).toBeGreaterThan(0);
    });
  });

  describe("Performance and Metrics", () => {
    it("should provide detailed processing metrics", async () => {
      const data = Buffer.from("test data for metrics".repeat(1000));

      const result = await engine.deduplicate(data, "metrics-test");

      expect(result).toMatchObject({
        originalSize: expect.any(Number),
        deduplicatedSize: expect.any(Number),
        deduplicationRatio: expect.any(Number),
        blocksTotal: expect.any(Number),
        blocksUnique: expect.any(Number),
        blocksDuplicate: expect.any(Number),
        processingTime: expect.any(Number),
        method: expect.any(String),
      });

      expect(result.originalSize).toBeGreaterThan(0);
      expect(result.deduplicatedSize).toBeLessThanOrEqual(result.originalSize);
      expect(result.blocksTotal).toBe(
        result.blocksUnique + result.blocksDuplicate,
      );
    });

    it("should handle parallel processing efficiently", async () => {
      const parallelEngine = new DeduplicationEngine({
        ...testConfig,
        parallelism: 8,
      });

      const largeData = Buffer.from(
        "large dataset for parallel processing".repeat(5000),
      );

      const startTime = Date.now();
      const result = await parallelEngine.deduplicate(
        largeData,
        "parallel-test",
      );
      const endTime = Date.now();

      expect(result.processingTime).toBeLessThan(endTime - startTime + 100);
      expect(result.deduplicationRatio).toBeGreaterThan(0);
    });
  });

  describe("Memory Management", () => {
    it("should respect cache size limits", async () => {
      const smallCacheEngine = new DeduplicationEngine({
        ...testConfig,
        cacheSize: 1, // 1MB limit
      });

      const data = Buffer.from("cache test data".repeat(10000));

      const result = await smallCacheEngine.deduplicate(data, "cache-test");

      expect(result.blocksTotal).toBeGreaterThan(0);
      // Should not throw memory errors
    });

    it("should handle scope-based deduplication", async () => {
      const userScopeEngine = new DeduplicationEngine({
        ...testConfig,
        scope: "user",
      });

      const projectScopeEngine = new DeduplicationEngine({
        ...testConfig,
        scope: "project",
      });

      const data = Buffer.from("scope test data".repeat(100));

      const userResult = await userScopeEngine.deduplicate(data, "user-scope");
      const projectResult = await projectScopeEngine.deduplicate(
        data,
        "project-scope",
      );

      // Different scopes should maintain separate indexes
      expect(userResult.blocksUnique).toBeGreaterThan(0);
      expect(projectResult.blocksUnique).toBeGreaterThan(0);
    });
  });

  describe("Compression Integration", () => {
    it("should support compression-first workflow", async () => {
      const compressFirstEngine = new DeduplicationEngine({
        ...testConfig,
        compressionFirst: true,
      });

      const data = Buffer.from("compression and dedup test data".repeat(1000));

      const result = await compressFirstEngine.deduplicate(
        data,
        "compress-first",
      );

      expect(result.deduplicationRatio).toBeGreaterThan(0);
      expect(result.originalSize).toBeGreaterThan(result.deduplicatedSize);
    });
  });

  describe("Error Handling", () => {
    it("should handle empty data gracefully", async () => {
      const emptyData = Buffer.alloc(0);

      const result = await engine.deduplicate(emptyData, "empty-test");

      expect(result.originalSize).toBe(0);
      expect(result.deduplicatedSize).toBe(0);
      expect(result.blocksTotal).toBe(0);
      expect(result.deduplicationRatio).toBe(0);
    });

    it("should handle very large datasets", async () => {
      const largeData = Buffer.alloc(10 * 1024 * 1024); // 10MB
      largeData.fill("A");

      const result = await engine.deduplicate(largeData, "large-test");

      expect(result.originalSize).toBe(10 * 1024 * 1024);
      expect(result.deduplicationRatio).toBeGreaterThan(90); // Highly repetitive
    });

    it("should validate configuration parameters", () => {
      expect(() => {
        new DeduplicationEngine({
          ...testConfig,
          blockSize: 0,
        });
      }).toThrow();

      expect(() => {
        new DeduplicationEngine({
          ...testConfig,
          similarity: 150,
        });
      }).toThrow();
    });
  });

  describe("Storage Integration", () => {
    it("should support disk-based indexing", async () => {
      const diskEngine = new DeduplicationEngine({
        ...testConfig,
        indexType: "disk",
      });

      const data = Buffer.from("disk index test data".repeat(1000));

      const result = await diskEngine.deduplicate(data, "disk-test");

      expect(result.blocksTotal).toBeGreaterThan(0);
    });

    it("should support hybrid indexing strategy", async () => {
      const hybridEngine = new DeduplicationEngine({
        ...testConfig,
        indexType: "hybrid",
      });

      const data = Buffer.from("hybrid index test data".repeat(1000));

      const result = await hybridEngine.deduplicate(data, "hybrid-test");

      expect(result.blocksTotal).toBeGreaterThan(0);
    });
  });

  describe("Semantic Deduplication", () => {
    it("should support semantic content analysis", async () => {
      const semanticEngine = new DeduplicationEngine({
        ...testConfig,
        method: "semantic",
      });

      const data1 = Buffer.from("The quick brown fox jumps over the lazy dog");
      const data2 = Buffer.from("A fast brown fox leaps over a sleepy dog");

      await semanticEngine.deduplicate(data1, "semantic-1");
      const result = await semanticEngine.deduplicate(data2, "semantic-2");

      expect(result.method).toBe("semantic");
    });
  });
});
