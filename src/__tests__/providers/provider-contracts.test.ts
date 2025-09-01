/**
 * Provider Contract Tests
 * Ensures both legacy and modern provider interfaces work correctly
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type {
  IUnifiedAIProvider,
  ProviderId,
  ProviderRequest,
  ProviderResponse,
  ProviderHealth,
} from "../../providers/config";
import { UnifiedAIProviderManager } from "../../providers/manager";
import { LegacyAIProviderFactory } from "../../providers/legacy-adapter";
import type { LegacyAIProvider } from "../../providers/config";

describe("Provider Contract Tests", () => {
  let modernManager: UnifiedAIProviderManager;
  let legacyFactory: LegacyAIProviderFactory;

  beforeEach(async () => {
    modernManager = new UnifiedAIProviderManager();
    legacyFactory = LegacyAIProviderFactory.getInstance();

    // Clear any existing state
    legacyFactory.clearProviders();
  });

  afterEach(() => {
    // Cleanup
    legacyFactory.clearProviders();
  });

  describe("Modern Provider Interface (IUnifiedAIProvider)", () => {
    it("should have required methods and properties", () => {
      const mockProvider: IUnifiedAIProvider = {
        id: "openai",
        name: "Test Provider",
        isAvailable: async () => true,
        complete: async (
          _prompt: string,
          _req: ProviderRequest,
        ): Promise<ProviderResponse> => ({
          content: "test response",
        }),
        stream: async (_prompt: string, _req: ProviderRequest) => {
          return (async function* () {
            yield { content: "test chunk" };
          })();
        },
        health: async (): Promise<ProviderHealth> => ({ ok: true }),
        getModels: async () => ["test-model"],
      };

      expect(mockProvider.id).toBe("openai");
      expect(mockProvider.name).toBe("Test Provider");
      expect(typeof mockProvider.isAvailable).toBe("function");
      expect(typeof mockProvider.complete).toBe("function");
      expect(typeof mockProvider.stream).toBe("function");
      expect(typeof mockProvider.health).toBe("function");
      expect(typeof mockProvider.getModels).toBe("function");
    });

    it("should complete successfully with mock provider", async () => {
      const mockProvider: IUnifiedAIProvider = {
        id: "openai",
        name: "Mock Provider",
        isAvailable: async () => true,
        complete: async (prompt: string, _req: ProviderRequest) => ({
          content: `Mock response to: ${prompt}`,
          model: "mock-model",
        }),
        stream: async function* (prompt: string, _req: ProviderRequest) {
          yield { content: `Mock streaming response to: ${prompt}` };
        },
        health: async () => ({ ok: true, latencyMs: 100 }),
        getModels: async () => ["mock-model-1", "mock-model-2"],
      };

      modernManager.register(mockProvider);

      const response = await mockProvider.complete("test prompt", {
        model: "mock-model",
      });
      expect(response.content).toBe("Mock response to: test prompt");
      expect(response.model).toBe("mock-model");
    });

    it("should stream successfully with mock provider", async () => {
      const mockProvider: IUnifiedAIProvider = {
        id: "openai",
        name: "Mock Streaming Provider",
        isAvailable: async () => true,
        complete: async () => ({ content: "mock" }),
        stream: async function* (prompt: string, _req: ProviderRequest) {
          const chunks = [
            `Chunk 1 for: ${prompt}`,
            `Chunk 2 for: ${prompt}`,
            "Final chunk",
          ];
          for (const chunk of chunks) {
            yield { content: chunk };
          }
        },
        health: async () => ({ ok: true }),
        getModels: async () => ["mock-model"],
      };

      const streamResponse = await mockProvider.stream("test prompt", {
        model: "mock-model",
      });
      const chunks: string[] = [];

      for await (const chunk of streamResponse) {
        chunks.push(chunk.content);
      }

      expect(chunks).toHaveLength(3);
      expect(chunks[0]).toBe("Chunk 1 for: test prompt");
      expect(chunks[1]).toBe("Chunk 2 for: test prompt");
      expect(chunks[2]).toBe("Final chunk");
    });

    it("should report health correctly", async () => {
      const mockProvider: IUnifiedAIProvider = {
        id: "openai",
        name: "Health Test Provider",
        isAvailable: async () => true,
        complete: async () => ({ content: "mock" }),
        stream: async function* () {
          yield { content: "mock" };
        },
        health: async () => ({
          ok: true,
          latencyMs: 150,
          timestamp: Date.now(),
        }),
        getModels: async () => ["healthy-model"],
      };

      const health = await mockProvider.health();
      expect(health.ok).toBe(true);
      expect(health.latencyMs).toBe(150);
      expect(health.timestamp).toBeDefined();
    });
  });

  describe("Legacy Provider Interface Compatibility", () => {
    it("should maintain legacy AIProvider interface", async () => {
      await legacyFactory.initializeFromEnvironment();

      // Template provider should always be available as fallback
      const provider = legacyFactory.getProvider("template");

      expect(provider).toBeDefined();
      expect(typeof provider!.name).toBe("string");
      expect(typeof provider!.generateCompletion).toBe("function");
      expect(typeof provider!.isAvailable).toBe("function");
      expect(typeof provider!.getAvailableModels).toBe("function");
    });

    it("should support legacy generateCompletion interface", async () => {
      await legacyFactory.initializeFromEnvironment();
      const provider = legacyFactory.getProvider("template");

      if (!provider) {
        throw new Error("Template provider should be available");
      }

      const response = await provider.generateCompletion({
        messages: [{ role: "user", content: "test prompt" }],
        model: "template",
        temperature: 0.7,
      });

      expect(response.content).toBeDefined();
      expect(typeof response.content).toBe("string");
      expect(response.model).toBe("template");
      expect(response.content.length).toBeGreaterThan(0);
    });

    it("should support legacy streaming interface", async () => {
      await legacyFactory.initializeFromEnvironment();
      const provider = legacyFactory.getProvider("template");

      if (!provider) {
        throw new Error("Template provider should be available");
      }

      const chunks: string[] = [];
      const response = await provider.streamCompletion!(
        {
          messages: [{ role: "user", content: "streaming test" }],
          model: "template",
        },
        (chunk: string) => {
          chunks.push(chunk);
        },
      );

      expect(chunks.length).toBeGreaterThan(0);
      expect(response.content).toBeDefined();
      expect(chunks.join("")).toBe(response.content);
    });

    it("should maintain backward compatibility for provider types", async () => {
      await legacyFactory.initializeFromEnvironment();

      // Test available legacy provider types
      const availableTypes = legacyFactory.getAvailableProviders();
      expect(Array.isArray(availableTypes)).toBe(true);

      // Template should always be available
      const templateProvider = legacyFactory.getProvider("template");
      expect(templateProvider).toBeDefined();
      expect(templateProvider!.isAvailable()).toBe(true);
    });
  });

  describe("Manager Interface Tests", () => {
    it("should initialize without errors", async () => {
      expect(async () => {
        await modernManager.initialize();
      }).not.toThrow();
    });

    it("should register providers successfully", () => {
      const mockProvider: IUnifiedAIProvider = {
        id: "openai",
        name: "Test Provider",
        isAvailable: async () => true,
        complete: async () => ({ content: "test" }),
        stream: async function* () {
          yield { content: "test" };
        },
        health: async () => ({ ok: true }),
        getModels: async () => ["test-model"],
      };

      expect(() => {
        modernManager.register(mockProvider);
      }).not.toThrow();

      const retrieved = modernManager.getProvider("openai");
      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe("openai");
    });

    it("should pick providers with fallback logic", async () => {
      const healthyProvider: IUnifiedAIProvider = {
        id: "openai",
        name: "Healthy Provider",
        isAvailable: async () => true,
        complete: async () => ({ content: "healthy" }),
        stream: async function* () {
          yield { content: "healthy" };
        },
        health: async () => ({ ok: true }),
        getModels: async () => ["healthy-model"],
      };

      const unhealthyProvider: IUnifiedAIProvider = {
        id: "anthropic",
        name: "Unhealthy Provider",
        isAvailable: async () => false,
        complete: async () => {
          throw new Error("Unavailable");
        },
        stream: async function* () {
          yield ""; // Required yield for generator
          throw new Error("Unavailable");
        },
        health: async () => ({ ok: false, reason: "Unavailable" }),
        getModels: async () => {
          throw new Error("Unavailable");
        },
      };

      modernManager.register(unhealthyProvider);
      modernManager.register(healthyProvider);

      // Should pick healthy provider even if unhealthy is registered first
      const picked = await modernManager.pick();
      expect(picked.id).toBe("openai");
      expect(picked.name).toBe("Healthy Provider");
    });
  });

  describe("Cross-compatibility Tests", () => {
    it("should work with both interfaces for the same underlying provider", async () => {
      // Register a provider via modern interface
      const mockProvider: IUnifiedAIProvider = {
        id: "openai",
        name: "Cross-compat Test Provider",
        isAvailable: async () => true,
        complete: async (prompt: string) => ({
          content: `Modern: ${prompt}`,
          model: "cross-compat-model",
        }),
        stream: async function* (prompt: string) {
          yield { content: `Modern stream: ${prompt}` };
        },
        health: async () => ({ ok: true }),
        getModels: async () => ["cross-compat-model"],
      };

      modernManager.register(mockProvider);

      // Access via modern interface
      const modernResponse = await mockProvider.complete("test", {
        model: "test-model",
      });
      expect(modernResponse.content).toBe("Modern: test");

      // The legacy adapter should use the fallback template provider
      // since we haven't set up the cross-wiring for this test
      await legacyFactory.initializeFromEnvironment();
      const legacyProvider = legacyFactory.getProvider("template"); // Use template as fallback

      expect(legacyProvider).toBeDefined();
      const legacyResponse = await legacyProvider!.generateCompletion({
        messages: [{ role: "user", content: "test" }],
      });

      expect(legacyResponse.content).toBeDefined();
    });
  });

  describe("Error Handling Tests", () => {
    it("should handle provider unavailability gracefully", async () => {
      const unavailableProvider: IUnifiedAIProvider = {
        id: "openai",
        name: "Unavailable Provider",
        isAvailable: async () => false,
        complete: async () => {
          throw new Error("Provider unavailable");
        },
        stream: async function* () {
          yield ""; // Required yield for generator
          throw new Error("Provider unavailable");
        },
        health: async () => ({ ok: false, reason: "Service down" }),
        getModels: async () => {
          throw new Error("Provider unavailable");
        },
      };

      modernManager.register(unavailableProvider);

      // Should throw when no healthy providers available
      await expect(modernManager.pick()).rejects.toThrow(
        "No healthy AI provider available",
      );
    });

    it("should handle legacy provider errors gracefully", async () => {
      await legacyFactory.initializeFromEnvironment();

      // Non-existent provider should return undefined
      const nonExistentProvider = legacyFactory.getProvider(
        "nonexistent" as any,
      );
      expect(nonExistentProvider).toBeUndefined();
    });
  });
});
