/**
 * Provider Hub - manages AI providers with smart routing and fallback
 */

import {
  AIProvider,
  GenerateOptions,
  GenerateResult,
  IntentLike,
} from "./types";

export class ProviderHub {
  private providers = new Map<string, AIProvider>();
  private currentModelId?: string;
  private fallbackChain: string[] = [];

  register(provider: AIProvider): this {
    this.providers.set(provider.id, provider);
    return this;
  }

  setCurrentModel(modelId: string): void {
    this.currentModelId = modelId;
  }

  setFallbackChain(chain: string[]): void {
    this.fallbackChain = chain;
  }

  listAvailableModelIds(): string[] {
    return Array.from(this.providers.values())
      .filter((p) => p.available())
      .map((p) => p.modelId);
  }

  getByModelId(modelId: string): AIProvider | undefined {
    return Array.from(this.providers.values()).find(
      (p) => p.modelId === modelId,
    );
  }

  getFirstAvailableProvider(): AIProvider | undefined {
    return Array.from(this.providers.values()).find((p) => p.available());
  }

  getPreferred(
    intent?: IntentLike,
    opts?: { signal?: AbortSignal },
  ): AIProvider | undefined {
    // 1) If current model is set and available, use it
    if (this.currentModelId) {
      const current = this.getByModelId(this.currentModelId);
      if (current?.available()) {
        return current;
      }
    }

    // 2) Smart routing based on intent
    if (intent) {
      const text = (intent.text || "").toLowerCase();
      const lang = (intent.language || "").toLowerCase();

      // HTML/Frontend tasks prefer Gemini
      if (/html|canvas|frontend|tetris|web|css/.test(text) || lang === "html") {
        const gemini = Array.from(this.providers.values()).find(
          (p) => p.vendor === "google" && p.available(),
        );
        if (gemini) return gemini;
      }

      // Python/Data science prefers OpenAI
      if (
        /python|data|analysis|jupyter|pandas|numpy/.test(text) ||
        lang === "python"
      ) {
        const openai = Array.from(this.providers.values()).find(
          (p) => p.vendor === "openai" && p.available(),
        );
        if (openai) return openai;
      }

      // Complex reasoning prefers Anthropic
      if (/refactor|architecture|design|review/.test(text)) {
        const anthropic = Array.from(this.providers.values()).find(
          (p) => p.vendor === "anthropic" && p.available(),
        );
        if (anthropic) return anthropic;
      }
    }

    // 3) Return first available provider
    return this.getFirstAvailableProvider();
  }

  async generateWithPreferred(
    prompt: string,
    intent?: IntentLike,
    opts?: GenerateOptions,
  ): Promise<GenerateResult> {
    const provider = this.getPreferred(intent, { signal: opts?.signal });
    if (!provider) {
      throw new Error("No available provider");
    }

    try {
      const result = await provider.generate(prompt, opts);
      return {
        ...result,
        modelId: provider.modelId,
        providerId: provider.id,
      };
    } catch (error) {
      console.warn(`Provider ${provider.id} failed:`, error);
      throw error;
    }
  }

  async generateWithFallback(
    prompt: string,
    opts?: GenerateOptions,
  ): Promise<GenerateResult> {
    const errors: string[] = [];

    // Try current model first
    if (this.currentModelId) {
      const provider = this.getByModelId(this.currentModelId);
      if (provider?.available()) {
        try {
          return await provider.generate(prompt, opts);
        } catch (e) {
          const msg = `Primary provider ${provider.id} failed: ${e}`;
          console.warn(msg);
          errors.push(msg);
        }
      }
    }

    // Try fallback chain
    for (const modelId of this.fallbackChain) {
      const provider = this.getByModelId(modelId);
      if (provider?.available()) {
        try {
          const result = await provider.generate(prompt, opts);
          return {
            ...result,
            modelId: provider.modelId,
            providerId: provider.id,
          };
        } catch (e) {
          const msg = `Fallback provider ${modelId} failed: ${e}`;
          console.warn(msg);
          errors.push(msg);
        }
      }
    }

    // Last resort: template provider
    const template = this.providers.get("template:static");
    if (template) {
      try {
        return await template.generate(prompt, opts);
      } catch (e) {
        errors.push(`Template provider failed: ${e}`);
      }
    }

    throw new Error(`All providers failed:\n${errors.join("\n")}`);
  }
}
