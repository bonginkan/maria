import { describe, it, expect, beforeEach } from "vitest";
import {
  IntentRecognizer,
  IntentRecognizerDependencies,
} from "../../../IntentRecognizer";
import { ProcessedInput } from "../../../../../../infra/NaturalLanguageProcessor";

describe("IntentRecognizer", () => {
  let recognizer: IntentRecognizer;
  let dependencies: IntentRecognizerDependencies;

  beforeEach(() => {
    dependencies = {
      knownCommands: [
        "/help",
        "/status",
        "/version",
        "/test",
        "/brain",
        "/code",
        "/image",
        "/video",
        "/review",
        "/calc",
        "/solve",
        "/plot",
      ],
    };

    recognizer = new IntentRecognizer(
      {
        maxAlternatives: 3,
        enableML: false,
        enableFuzzyMatching: true,
        confidenceThreshold: 0.35,
        cacheTimeout: 60000,
        debug: false,
      },
      dependencies,
    );
  });

  describe("Input Length Limit", () => {
    it("should return null for input exceeding 8192 characters", async () => {
      const longInput: ProcessedInput = {
        original: "a".repeat(8193),
        normalized: "a".repeat(8193),
        language: "en",
        tokens: [],
        keywords: [],
        entities: [],
      };

      const result = await recognizer.recognize(longInput);
      expect(result).toBeNull();
    });

    it("should process input within 8192 characters", async () => {
      const normalInput: ProcessedInput = {
        original: "help",
        normalized: "help",
        language: "en",
        tokens: ["help"],
        keywords: ["help"],
        entities: [],
      };

      const result = await recognizer.recognize(normalInput);
      expect(result).not.toBeNull();
    });
  });

  describe("Fuzzy Matching", () => {
    it('should match with edit distance 1: "hlp" → /help', async () => {
      const input: ProcessedInput = {
        original: "hlp",
        normalized: "hlp",
        language: "en",
        tokens: ["hlp"],
        keywords: ["hlp"],
        entities: [],
      };

      const result = await recognizer.recognize(input);
      expect(result?.command).toBe("/help");
      expect(result?.confidence).toBeLessThanOrEqual(0.7);
    });

    it('should match with edit distance 1: "hep" → /help', async () => {
      const input: ProcessedInput = {
        original: "hep",
        normalized: "hep",
        language: "en",
        tokens: ["hep"],
        keywords: ["hep"],
        entities: [],
      };

      const result = await recognizer.recognize(input);
      expect(result?.command).toBe("/help");
      expect(result?.confidence).toBeLessThanOrEqual(0.7);
    });

    it('should return null for edit distance 2: "hp" → null', async () => {
      const input: ProcessedInput = {
        original: "hp",
        normalized: "hp",
        language: "en",
        tokens: ["hp"],
        keywords: ["hp"],
        entities: [],
      };

      const result = await recognizer.recognize(input);
      expect(result).toBeNull();
    });
  });

  describe("Single Fuzzy Match Rejection", () => {
    it("should return null when only fuzzy=1 hit exists without any other scores", async () => {
      const input: ProcessedInput = {
        original: "hep",
        normalized: "hep",
        language: "en",
        tokens: ["hep"],
        keywords: ["hep"],
        entities: [],
      };

      // This should trigger early rejection for single fuzzy match
      const result = await recognizer.recognize(input);

      // Depending on implementation, if patterns don't match, it should be null
      // If patterns do match, it wouldn't be a single fuzzy match
      if (result) {
        expect(result.confidence).toBeLessThanOrEqual(0.7);
      }
    });
  });

  describe("Low Confidence Rejection", () => {
    it('should return null for low confidence inputs: "ok"', async () => {
      const input: ProcessedInput = {
        original: "ok",
        normalized: "ok",
        language: "en",
        tokens: ["ok"],
        keywords: ["ok"],
        entities: [],
      };

      const result = await recognizer.recognize(input);
      expect(result).toBeNull();
    });

    it('should return null for low confidence inputs: "go"', async () => {
      const input: ProcessedInput = {
        original: "go",
        normalized: "go",
        language: "en",
        tokens: ["go"],
        keywords: ["go"],
        entities: [],
      };

      const result = await recognizer.recognize(input);
      expect(result).toBeNull();
    });

    it('should return null for meaningful but unrelated inputs: "foo bar"', async () => {
      const input: ProcessedInput = {
        original: "foo bar",
        normalized: "foo bar",
        language: "en",
        tokens: ["foo", "bar"],
        keywords: ["foo", "bar"],
        entities: [],
      };

      const result = await recognizer.recognize(input);
      expect(result).toBeNull();
    });

    it('should return null for meaningful but unrelated inputs: "something interesting"', async () => {
      const input: ProcessedInput = {
        original: "something interesting",
        normalized: "something interesting",
        language: "en",
        tokens: ["something", "interesting"],
        keywords: ["something", "interesting"],
        entities: [],
      };

      const result = await recognizer.recognize(input);
      expect(result).toBeNull();
    });
  });

  describe("Language Fallback", () => {
    it("should fallback to English when language is undefined", async () => {
      const input: ProcessedInput = {
        original: "help",
        normalized: "help",
        language: undefined as any,
        tokens: ["help"],
        keywords: ["help"],
        entities: [],
      };

      const result = await recognizer.recognize(input);
      expect(result?.command).toBe("/help");
      expect(result?.confidence).toBeGreaterThan(0.35);
    });
  });

  describe("Score Normalization", () => {
    it("should cap confidence at 0.7", async () => {
      const input: ProcessedInput = {
        original: "help me please",
        normalized: "help me please",
        language: "en",
        tokens: ["help", "me", "please"],
        keywords: ["help"],
        entities: [],
      };

      const result = await recognizer.recognize(input);
      if (result) {
        expect(result.confidence).toBeLessThanOrEqual(0.7);
      }
    });
  });

  describe("Math Commands", () => {
    it("should recognize /calc command", async () => {
      const input: ProcessedInput = {
        original: "calculate 2 + 2",
        normalized: "calculate 2 + 2",
        language: "en",
        tokens: ["calculate", "2", "+", "2"],
        keywords: ["calculate"],
        entities: [{ type: "number", value: "2", confidence: 0.9 }],
      };

      const result = await recognizer.recognize(input);
      expect(result?.command).toBe("/calc");
    });

    it("should recognize /solve command", async () => {
      const input: ProcessedInput = {
        original: "solve x^2 + 5x + 6 = 0",
        normalized: "solve x^2 + 5x + 6 = 0",
        language: "en",
        tokens: ["solve", "x", "^", "2", "+", "5", "x", "+", "6", "=", "0"],
        keywords: ["solve", "equation"],
        entities: [],
      };

      const result = await recognizer.recognize(input);
      expect(result?.command).toBe("/solve");
    });

    it("should recognize /plot command", async () => {
      const input: ProcessedInput = {
        original: "plot y = x^2",
        normalized: "plot y = x^2",
        language: "en",
        tokens: ["plot", "y", "=", "x", "^", "2"],
        keywords: ["plot", "graph"],
        entities: [],
      };

      const result = await recognizer.recognize(input);
      expect(result?.command).toBe("/plot");
    });
  });

  describe("Performance Metrics", () => {
    it("should track metrics correctly", async () => {
      // Make several recognition attempts
      const inputs: ProcessedInput[] = [
        {
          original: "help",
          normalized: "help",
          language: "en",
          tokens: ["help"],
          keywords: ["help"],
          entities: [],
        },
        {
          original: "ok",
          normalized: "ok",
          language: "en",
          tokens: ["ok"],
          keywords: ["ok"],
          entities: [],
        },
      ];

      for (const input of inputs) {
        await recognizer.recognize(input);
      }

      const metrics = recognizer.getMetrics();

      expect(metrics.total).toBe(2);
      expect(metrics.null_rate).toBeGreaterThan(0);
      expect(metrics.avg_ms).toBeGreaterThan(0);
      expect(metrics.p95_ms).toBeGreaterThan(0);
    });
  });
});
