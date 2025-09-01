/**
 * Adapter exports
 * Provides type-safe wrappers for external dependencies
 */

export { AIProviderAdapter } from "./AIProviderAdapter";
export { MemoryAdapter } from "./MemoryAdapter";
export { ChatContextAdapter } from "./ChatContextAdapter";
export { CliUiAdapter } from "./CliUiAdapter";

// Factory functions for creating adapters with proper types
import type { AIProviderManager } from "../../providers/manager";
import type { DualMemoryEngine } from "../../services/memory-system/dual-engine";
import type {
  ProviderPort,
  MemoryPort,
  ContextPort,
  UiPort,
} from "../types/context";
import { AIProviderAdapter } from "./AIProviderAdapter";
import { MemoryAdapter } from "./MemoryAdapter";
import { ChatContextAdapter } from "./ChatContextAdapter";
import { CliUiAdapter } from "./CliUiAdapter";

/**
 * Create a provider adapter
 */
export function createProviderAdapter(
  manager: AIProviderManager,
): ProviderPort {
  return new AIProviderAdapter(manager);
}

/**
 * Create a memory adapter
 */
export function createMemoryAdapter(engine: DualMemoryEngine): MemoryPort {
  return new MemoryAdapter(engine);
}

/**
 * Create a context adapter
 */
export function createContextAdapter(
  context: any,
  options?: { maxMessages?: number; maxTokens?: number },
): ContextPort {
  return new ChatContextAdapter(context, options);
}

/**
 * Create a UI adapter
 */
export function createUiAdapter(ui: any): UiPort {
  return new CliUiAdapter(ui);
}
