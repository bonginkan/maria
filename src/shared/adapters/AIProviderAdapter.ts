/**
 * AIProviderAdapter
 * Wraps the existing AIProviderManager to conform to ProviderPort interface
 */

import type { ProviderPort, ModelInfo } from "../types/context";
import type { AIProviderManager } from "../../providers/manager";

export class AIProviderAdapter implements ProviderPort {
  constructor(private manager: AIProviderManager) {}

  /**
   * Get list of available models
   */
  async list(opts?: { signal?: AbortSignal }): Promise<ModelInfo[]> {
    // Check for abort signal
    if (opts?.signal?.aborted) {
      throw new Error("AbortError");
    }

    try {
      const models = await this.manager.getAvailableModels();

      // Check again after async operation
      if (opts?.signal?.aborted) {
        throw new Error("AbortError");
      }

      return (models || []).map((m) => ({
        id: m.id || m.model || "unknown",
        provider: m.provider || m.source || "unknown",
        available: m.available !== false,
      }));
    } catch (error: any) {
      if (error.message === "AbortError") throw error;
      console.error("AIProviderAdapter.list error:", error);
      return [];
    }
  }

  /**
   * Switch to a different model
   */
  async switch(id: string, opts?: { signal?: AbortSignal }): Promise<void> {
    // Check for abort signal
    if (opts?.signal?.aborted) {
      throw new Error("AbortError");
    }

    try {
      await this.manager.switchModel(id);

      // Check again after async operation
      if (opts?.signal?.aborted) {
        throw new Error("AbortError");
      }
    } catch (error: any) {
      if (error.message === "AbortError") throw error;
      throw new Error(
        `Failed to switch model: ${error.message || "Unknown error"}`,
      );
    }
  }

  /**
   * Get current model (extension for convenience)
   */
  async getCurrentModel(): Promise<string | null> {
    try {
      const current = this.manager.getCurrentModel?.();
      return current || null;
    } catch {
      return null;
    }
  }

  /**
   * Check if a model is available
   */
  async isAvailable(id: string): Promise<boolean> {
    try {
      const models = await this.list();
      return models.some((m) => m.id === id && m.available);
    } catch {
      return false;
    }
  }
}
