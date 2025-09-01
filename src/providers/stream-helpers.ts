/**
 * SSE Stream Helper with Triple-Guard Protection
 * Prevents infinite loops from stream handling issues
 */

export interface SSEReaderOptions {
  response: Response;
  onData: (chunk: string) => void;
  signal?: AbortSignal;
  inactivityMs?: number;
  doneToken?: string;
}

/**
 * Read SSE stream with triple-guard protection:
 * 1. AbortSignal - External cancellation
 * 2. Inactivity timeout - Dead stream detection
 * 3. [DONE] token - Explicit end marker
 */
export async function readSSEStream(opts: SSEReaderOptions): Promise<void> {
  const {
    response,
    onData,
    signal,
    inactivityMs = 3000,
    doneToken = "[DONE]",
  } = opts;

  if (!response.ok || !response.body) {
    throw new Error(`Bad response: ${response.status} ${response.statusText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");

  // Track last activity for inactivity detection
  let lastActivity = Date.now();

  // Inactivity monitor
  const inactivityTimer = setInterval(() => {
    // Check abort signal
    if (signal?.aborted) {
      try {
        reader.cancel();
      } catch {}
      clearInterval(inactivityTimer);
      return;
    }

    // Check inactivity
    if (Date.now() - lastActivity > inactivityMs) {
      console.warn(`[SSE] Stream inactive for ${inactivityMs}ms, cancelling`);
      try {
        reader.cancel();
      } catch {}
      clearInterval(inactivityTimer);
      return;
    }
  }, 500);

  try {
    let buffer = "";

    for (;;) {
      // Check abort before read
      if (signal?.aborted) {
        break;
      }

      const { done, value } = await reader.read();
      if (done) {
        break; // EOF reached
      }

      // Update activity timestamp
      lastActivity = Date.now();

      // Decode chunk
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; // Keep incomplete line in buffer

      for (const line of lines) {
        const trimmed = line.trim();

        // Skip empty lines
        if (!trimmed) continue;

        // Parse SSE format
        if (trimmed.startsWith("data: ")) {
          const payload = trimmed.slice(6);

          // Check for done token
          if (payload === doneToken) {
            return; // Explicit stream end
          }

          // Skip empty data
          if (!payload || payload === " ") continue;

          // Process data
          try {
            onData(payload);
          } catch (e) {
            console.error("[SSE] Data handler error:", e);
            // Continue processing stream
          }
        }
        // Handle other SSE fields if needed (event:, id:, retry:)
      }
    }
  } finally {
    clearInterval(inactivityTimer);
    try {
      reader.releaseLock();
    } catch {}
  }
}

/**
 * Parse JSON from SSE payload safely
 */
export function parseSSEJson<T = any>(payload: string): T | null {
  try {
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

/**
 * Extract content from OpenAI-style SSE chunk
 */
export function extractOpenAIContent(payload: string): string | null {
  const parsed = parseSSEJson<{
    choices?: Array<{
      delta?: { content?: string };
      text?: string;
    }>;
  }>(payload);

  if (!parsed?.choices?.[0]) return null;

  const choice = parsed.choices[0];
  return choice.delta?.content || choice.text || null;
}

/**
 * Extract content from Ollama-style response
 */
export function extractOllamaContent(payload: string): string | null {
  const parsed = parseSSEJson<{
    response?: string;
    done?: boolean;
  }>(payload);

  return parsed?.response || null;
}
