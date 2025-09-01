/**
 * MemoryAdapter
 * Wraps the existing DualMemoryEngine to conform to MemoryPort interface
 */

import type {
  MemoryPort,
  MemoryContent,
  MemoryQuery,
  MemoryResult,
} from "../types/context";
import type { DualMemoryEngine } from "../../services/memory-system/dual-engine";

export class MemoryAdapter implements MemoryPort {
  constructor(private engine: DualMemoryEngine) {}

  /**
   * Store content in memory
   */
  async store(
    content: MemoryContent,
    opts?: { signal?: AbortSignal },
  ): Promise<string> {
    // Check for abort signal
    if (opts?.signal?.aborted) {
      throw new Error("AbortError");
    }

    try {
      // Map to DualMemoryEngine format
      const node = {
        id: content.id || this.generateId(),
        type: content.type || "general",
        data: content.data,
        metadata: {
          ...content.metadata,
          timestamp: new Date().toISOString(),
        },
      };

      // Store in appropriate system based on type
      if (content.type === "quick" || content.type === "reactive") {
        await this.engine.system1.store(node);
      } else {
        await this.engine.system2.store(node);
      }

      // Check again after async operation
      if (opts?.signal?.aborted) {
        throw new Error("AbortError");
      }

      return node.id;
    } catch (error: any) {
      if (error.message === "AbortError") throw error;
      throw new Error(
        `Failed to store memory: ${error.message || "Unknown error"}`,
      );
    }
  }

  /**
   * Query memory for relevant content
   */
  async query(
    query: MemoryQuery,
    opts?: { signal?: AbortSignal },
  ): Promise<MemoryResult[]> {
    // Check for abort signal
    if (opts?.signal?.aborted) {
      throw new Error("AbortError");
    }

    try {
      const results: MemoryResult[] = [];

      // Query both systems if not specified
      const systems = query.system ? [query.system] : ["system1", "system2"];

      for (const system of systems) {
        if (opts?.signal?.aborted) {
          throw new Error("AbortError");
        }

        const engine =
          system === "system1" ? this.engine.system1 : this.engine.system2;
        const nodes = await engine.query({
          text: query.text,
          limit: query.limit || 10,
          threshold: query.minRelevance || 0.5,
        });

        // Map to MemoryResult format
        for (const node of nodes) {
          results.push({
            id: node.id,
            content: {
              id: node.id,
              type: node.type,
              data: node.data,
              metadata: node.metadata,
            },
            relevance: node.score || 0.5,
            system: system as "system1" | "system2",
          });
        }
      }

      // Sort by relevance and apply limit
      results.sort((a, b) => b.relevance - a.relevance);
      if (query.limit) {
        return results.slice(0, query.limit);
      }

      return results;
    } catch (error: any) {
      if (error.message === "AbortError") throw error;
      console.error("MemoryAdapter.query error:", error);
      return [];
    }
  }

  /**
   * Clear memory contents
   */
  async clear(opts?: {
    signal?: AbortSignal;
    system?: "system1" | "system2";
  }): Promise<void> {
    // Check for abort signal
    if (opts?.signal?.aborted) {
      throw new Error("AbortError");
    }

    try {
      if (opts?.system) {
        const engine =
          opts.system === "system1" ? this.engine.system1 : this.engine.system2;
        await engine.clear?.();
      } else {
        // Clear both systems
        await Promise.all([
          this.engine.system1.clear?.(),
          this.engine.system2.clear?.(),
        ]);
      }

      // Check again after async operation
      if (opts?.signal?.aborted) {
        throw new Error("AbortError");
      }
    } catch (error: any) {
      if (error.message === "AbortError") throw error;
      throw new Error(
        `Failed to clear memory: ${error.message || "Unknown error"}`,
      );
    }
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return `mem-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get memory statistics (extension for convenience)
   */
  async getStats(): Promise<{
    system1: { count: number; size: number };
    system2: { count: number; size: number };
    total: { count: number; size: number };
  }> {
    try {
      const s1Stats = (await this.engine.system1.getStats?.()) || {
        count: 0,
        size: 0,
      };
      const s2Stats = (await this.engine.system2.getStats?.()) || {
        count: 0,
        size: 0,
      };

      return {
        system1: s1Stats,
        system2: s2Stats,
        total: {
          count: s1Stats.count + s2Stats.count,
          size: s1Stats.size + s2Stats.size,
        },
      };
    } catch {
      return {
        system1: { count: 0, size: 0 },
        system2: { count: 0, size: 0 },
        total: { count: 0, size: 0 },
      };
    }
  }
}
