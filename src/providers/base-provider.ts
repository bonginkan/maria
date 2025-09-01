/**
 * Unified Base Provider v2.0
 * Abstract base class for all AI providers with legacy compatibility
 */

import type {
  IUnifiedAIProvider,
  ProviderId,
  ProviderRequest,
  ProviderStream,
  ProviderResponse,
  ProviderHealth,
} from "./config";

export abstract class UnifiedBaseProvider implements IUnifiedAIProvider {
  abstract id: ProviderId;
  abstract name: string;

  protected apiKey?: string;
  protected apiBase?: string;
  protected initialized: boolean = false;
  protected availableModels: string[] = [];

  constructor(config: { apiKey?: string; apiBase?: string } = {}) {
    this.apiKey = config.apiKey;
    this.apiBase = config.apiBase;
  }

  // Abstract methods that must be implemented by providers
  abstract isAvailable(): Promise<boolean>;
  abstract complete(
    prompt: string,
    req: ProviderRequest,
  ): Promise<ProviderResponse>;
  abstract stream(
    prompt: string,
    req: ProviderRequest,
  ): Promise<ProviderStream>;
  abstract getModels(): Promise<string[]>;

  // Default health check implementation
  async health(): Promise<ProviderHealth> {
    const startTime = Date.now();
    try {
      const isHealthy = await this.isAvailable();
      const latencyMs = Date.now() - startTime;

      return {
        ok: isHealthy,
        latencyMs,
        timestamp: Date.now(),
      };
    } catch (error) {
      return {
        ok: false,
        latencyMs: Date.now() - startTime,
        reason: error instanceof Error ? error.message : "Unknown error",
        timestamp: Date.now(),
      };
    }
  }

  // Helper method for HTTP requests
  protected async makeRequest(
    url: string,
    options: Record<string, unknown>,
  ): Promise<unknown> {
    const fetch = (await import("node-fetch")).default;
    const timeoutMs = (options.timeout as number) || 30000;

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(options.headers as Record<string, string>),
        },
        body: JSON.stringify(options.body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `${this.name} API error: ${response.status} ${errorText}`,
        );
      }

      return response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  // Helper method for streaming requests
  protected async makeStreamRequest(
    url: string,
    options: Record<string, unknown>,
  ): Promise<AsyncGenerator<string>> {
    const fetch = (await import("node-fetch")).default;
    const timeoutMs = (options.timeout as number) || 30000;

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(options.headers as Record<string, string>),
        },
        body: JSON.stringify(options.body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `${this.name} API error: ${response.status} ${errorText}`,
        );
      }

      return this.parseStreamResponse(response);
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  // Default stream parsing - override in subclasses for provider-specific logic
  private async *parseStreamResponse(
    response: unknown,
  ): AsyncGenerator<string> {
    const typedResponse = response as {
      body?: { getReader(): ReadableStreamDefaultReader<Uint8Array> };
    };

    const reader = typedResponse.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n").filter((line) => line.trim());

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") return;

            try {
              const parsed = JSON.parse(data) as Record<string, unknown>;
              const content = this.extractStreamContent(parsed);
              if (content) yield content;
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  // Override in subclasses for provider-specific content extraction
  protected extractStreamContent(data: Record<string, unknown>): string | null {
    const choices = data.choices as Array<{ delta?: { content?: string } }>;
    return choices?.[0]?.delta?.content || null;
  }

  // Retry logic for API calls
  protected async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        // Don't retry on certain errors
        if (this.isNonRetryableError(error)) {
          throw error;
        }

        // Exponential backoff
        if (attempt < maxRetries - 1) {
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError!;
  }

  // Check if error should not be retried
  protected isNonRetryableError(error: unknown): boolean {
    const message = (error as Error)?.message?.toLowerCase() || "";
    return (
      message.includes("invalid api key") ||
      message.includes("unauthorized") ||
      message.includes("forbidden") ||
      message.includes("not found")
    );
  }
}
