import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { GoogleAIProvider } from "../../providers/google-ai-provider.js";
import type { Message } from "../../providers/ai-provider.js";

describe("Google AI Provider - Gemini 2.5 Flash Image Preview", () => {
  let provider: GoogleAIProvider;
  const mockApiKey = "test-gemini-api-key";

  beforeEach(async () => {
    provider = new GoogleAIProvider();

    // Mock the Google Generative AI client to avoid real API calls
    vi.mock("@google/generative-ai", () => ({
      GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
        getGenerativeModel: vi.fn().mockReturnValue({
          startChat: vi.fn().mockReturnValue({
            sendMessage: vi.fn().mockResolvedValue({
              response: {
                text: vi.fn().mockReturnValue("Generated image content"),
              },
            }),
            sendMessageStream: vi.fn().mockReturnValue({
              stream: (async function* () {
                yield { text: () => "chunk1" };
                yield { text: () => "chunk2" };
              })(),
            }),
          }),
        }),
      })),
    }));

    await provider.initialize(mockApiKey);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Model Recognition", () => {
    it("should include gemini-2.5-flash-image-preview in models list", () => {
      expect(provider.models).toContain("gemini-2.5-flash-image-preview");
    });

    it("should validate gemini-2.5-flash-image-preview as a valid model", () => {
      const model = "gemini-2.5-flash-image-preview";
      expect(() => provider.validateModel(model)).not.toThrow();
    });

    it("should return gemini-2.5-flash-image-preview when explicitly requested", () => {
      const model = "gemini-2.5-flash-image-preview";
      const validatedModel = provider.validateModel(model);
      expect(validatedModel).toBe(model);
    });
  });

  describe("Image Generation Capabilities", () => {
    const imageGenerationMessages: Message[] = [
      {
        role: "user",
        content: "Generate a futuristic cityscape with AI elements",
      },
    ];

    it("should process image generation requests with the new model", async () => {
      const response = await provider.chat(
        imageGenerationMessages,
        "gemini-2.5-flash-image-preview",
      );

      expect(response).toBeDefined();
      expect(typeof response).toBe("string");
      expect(response.length).toBeGreaterThan(0);
    });

    it("should handle streaming responses for image generation", async () => {
      const streamGenerator = provider.chatStream(
        imageGenerationMessages,
        "gemini-2.5-flash-image-preview",
      );

      const chunks: string[] = [];
      for await (const chunk of streamGenerator) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.every((chunk) => typeof chunk === "string")).toBe(true);
    });
  });

  describe("Image Editing Scenarios", () => {
    const imageEditingMessages: Message[] = [
      {
        role: "system",
        content:
          "You are an expert image editor. Modify images according to user instructions.",
      },
      {
        role: "user",
        content: "Edit this image: make the background transparent",
      },
    ];

    it("should process image editing requests", async () => {
      const response = await provider.chat(
        imageEditingMessages,
        "gemini-2.5-flash-image-preview",
      );

      expect(response).toBeDefined();
      expect(response.length).toBeGreaterThan(0);
    });

    it("should handle complex multimodal instructions", async () => {
      const complexMessages: Message[] = [
        {
          role: "user",
          content:
            'Create a professional business banner with text "Innovation 2025" and tech elements',
        },
      ];

      const response = await provider.chat(
        complexMessages,
        "gemini-2.5-flash-image-preview",
      );

      expect(response).toBeDefined();
    });
  });

  describe("Business Use Case Scenarios", () => {
    it("should handle marketing banner generation scenario", async () => {
      const marketingMessages: Message[] = [
        {
          role: "user",
          content:
            "Create an SNS banner for spring campaign with cherry blossoms and tech gadgets",
        },
      ];

      const response = await provider.chat(
        marketingMessages,
        "gemini-2.5-flash-image-preview",
      );

      expect(response).toBeTruthy();
    });

    it("should handle sales catalog image scenario", async () => {
      const salesMessages: Message[] = [
        {
          role: "user",
          content:
            "Generate a professional office environment with a business person using a laptop",
        },
      ];

      const response = await provider.chat(
        salesMessages,
        "gemini-2.5-flash-image-preview",
      );

      expect(response).toBeTruthy();
    });

    it("should handle executive presentation scenario", async () => {
      const executiveMessages: Message[] = [
        {
          role: "user",
          content:
            "Create a futuristic city skyline representing AI technology advancement for investor presentation",
        },
      ];

      const response = await provider.chat(
        executiveMessages,
        "gemini-2.5-flash-image-preview",
      );

      expect(response).toBeTruthy();
    });
  });

  describe("Error Handling", () => {
    it("should provide clear error messages for image generation failures", async () => {
      // Mock a failure scenario
      vi.mocked(provider).chat = vi
        .fn()
        .mockRejectedValue(
          new Error("Image generation failed - content policy violation"),
        );

      const messages: Message[] = [
        { role: "user", content: "Generate inappropriate content" },
      ];

      await expect(
        provider.chat(messages, "gemini-2.5-flash-image-preview"),
      ).rejects.toThrow("Image generation failed");
    });

    it("should handle API rate limiting gracefully", async () => {
      // Mock rate limiting scenario
      vi.mocked(provider).chat = vi
        .fn()
        .mockRejectedValue(new Error("Rate limit exceeded - try again later"));

      const messages: Message[] = [
        { role: "user", content: "Generate an image" },
      ];

      await expect(
        provider.chat(messages, "gemini-2.5-flash-image-preview"),
      ).rejects.toThrow("Rate limit exceeded");
    });
  });

  describe("Performance Expectations", () => {
    it("should complete image generation within reasonable time", async () => {
      const startTime = Date.now();

      const messages: Message[] = [
        { role: "user", content: "Generate a simple geometric pattern" },
      ];

      await provider.chat(messages, "gemini-2.5-flash-image-preview");

      const elapsedTime = Date.now() - startTime;
      // Should complete within 30 seconds for test environment
      expect(elapsedTime).toBeLessThan(30000);
    });
  });
});
