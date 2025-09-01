/**
 * Local LLM Availability Checkers
 * Real-time checks for Ollama, LM Studio, and vLLM servers
 */

import fetch from "node-fetch";
import { logger } from "../utils/logger";

// Cache results for 30 seconds to avoid excessive checks
const CACHE_DURATION = 30000;
const availabilityCache = new Map<
  string,
  { available: boolean; timestamp: number }
>();

/**
 * Check if Ollama is running and available
 */
export async function isOllamaUp(): Promise<boolean> {
  const cacheKey = "ollama";
  const cached = availabilityCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.available;
  }

  try {
    const response = await fetch("http://localhost:11434/api/tags", {
      method: "GET",
      timeout: 2000,
    });

    const available = response.ok;
    availabilityCache.set(cacheKey, { available, timestamp: Date.now() });

    if (available) {
      logger.debug("Ollama server is available");
    }

    return available;
  } catch (error) {
    logger.debug("Ollama server is not available:", error.message);
    availabilityCache.set(cacheKey, {
      available: false,
      timestamp: Date.now(),
    });
    return false;
  }
}

/**
 * Check if LM Studio is running and available
 */
export async function isLMStudioUp(): Promise<boolean> {
  const cacheKey = "lmstudio";
  const cached = availabilityCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.available;
  }

  try {
    const response = await fetch("http://localhost:1234/v1/models", {
      method: "GET",
      timeout: 2000,
    });

    const available = response.ok;
    availabilityCache.set(cacheKey, { available, timestamp: Date.now() });

    if (available) {
      logger.debug("LM Studio server is available");
    }

    return available;
  } catch (error) {
    logger.debug("LM Studio server is not available:", error.message);
    availabilityCache.set(cacheKey, {
      available: false,
      timestamp: Date.now(),
    });
    return false;
  }
}

/**
 * Check if vLLM is running and available
 */
export async function isVLLMUp(): Promise<boolean> {
  const cacheKey = "vllm";
  const cached = availabilityCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.available;
  }

  try {
    const response = await fetch("http://localhost:8000/v1/models", {
      method: "GET",
      timeout: 2000,
    });

    const available = response.ok;
    availabilityCache.set(cacheKey, { available, timestamp: Date.now() });

    if (available) {
      logger.debug("vLLM server is available");
    }

    return available;
  } catch (error) {
    logger.debug("vLLM server is not available:", error.message);
    availabilityCache.set(cacheKey, {
      available: false,
      timestamp: Date.now(),
    });
    return false;
  }
}

/**
 * Check all local LLM servers concurrently
 */
export async function checkLocalLLMAvailability(): Promise<{
  ollama: boolean;
  lmstudio: boolean;
  vllm: boolean;
}> {
  const [ollama, lmstudio, vllm] = await Promise.all([
    isOllamaUp(),
    isLMStudioUp(),
    isVLLMUp(),
  ]);

  return { ollama, lmstudio, vllm };
}

/**
 * Get available local models based on running servers
 */
export async function getAvailableLocalModels(): Promise<string[]> {
  const availability = await checkLocalLLMAvailability();
  const models: string[] = [];

  if (availability.ollama) {
    models.push(
      "qwen2.5-vl",
      "llama3-8b",
      "mistral-7b",
      "llama3", // Shortcut
      "mistral", // Shortcut
    );
  }

  if (availability.lmstudio) {
    models.push(
      "llama-70b-local",
      "mixtral-local",
      "qwen-local",
      "gpt-oss-20b-local",
      "gpt-oss-120b-local",
    );
  }

  if (availability.vllm) {
    models.push(
      "vllm-llama-70b",
      "vllm-mistral-7b",
      "vllm-qwen-14b",
      "vllm", // Default
    );
  }

  return models;
}

/**
 * Clear the availability cache (useful for force refresh)
 */
export function clearAvailabilityCache(): void {
  availabilityCache.clear();
  logger.debug("Local LLM availability cache cleared");
}

/**
 * Get human-readable status of local LLM servers
 */
export async function getLocalLLMStatus(): Promise<string> {
  const availability = await checkLocalLLMAvailability();
  const statusLines: string[] = ["Local LLM Server Status:"];

  statusLines.push(
    `  Ollama:    ${availability.ollama ? "🟢 Running" : "🔴 Offline"}`,
  );
  statusLines.push(
    `  LM Studio: ${availability.lmstudio ? "🟢 Running" : "🔴 Offline"}`,
  );
  statusLines.push(
    `  vLLM:      ${availability.vllm ? "🟢 Running" : "🔴 Offline"}`,
  );

  const availableCount = Object.values(availability).filter((v) => v).length;
  if (availableCount === 0) {
    statusLines.push(
      "\n⚠️  No local LLM servers detected. Start Ollama, LM Studio, or vLLM to use local models.",
    );
  } else {
    statusLines.push(
      `\n✅ ${availableCount} local server${availableCount > 1 ? "s" : ""} available`,
    );
  }

  return statusLines.join("\n");
}
