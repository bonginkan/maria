/**
 * Contract Guard for Multimodal Intelligence
 * Provides defensive programming and type safety for external contracts
 */

export interface MultimodalResult {
  id: string;
  inputs?: unknown[];
  modalities?: unknown[];
  analysis?: unknown;
  correlations?: unknown[];
  synthesizedOutput?: unknown;
  confidence?: number;
  timestamp: number | Date;
}

export interface ProcessingErrorPayload {
  inputId: string;
  error?: string;
  _error?: string; // Legacy field support
  modality: string;
  reason?: string;
  timestamp?: number | Date;
}

/**
 * Normalizes processing error payload to ensure consistent contract
 */
export function normalizeProcessingError(payload: ProcessingErrorPayload): {
  inputId: string;
  error: string;
  modality: string;
  reason: string;
  timestamp: number;
} {
  return {
    inputId: payload.inputId || "unknown",
    error: payload.error ?? payload._error ?? "Unknown error",
    modality: payload.modality || "unknown",
    reason: payload.reason || "unknown",
    timestamp:
      typeof payload.timestamp === "number"
        ? payload.timestamp
        : payload.timestamp instanceof Date
          ? payload.timestamp.getTime()
          : Date.now(),
  };
}

/**
 * Guards multimodal result to ensure timestamp is number(ms)
 */
export function guardMultimodalResult<T extends MultimodalResult>(
  result: T,
): T {
  const guarded = { ...result };

  // Ensure timestamp is number(ms)
  if (typeof guarded.timestamp !== "number") {
    if (guarded.timestamp instanceof Date) {
      guarded.timestamp = guarded.timestamp.getTime();
    } else {
      guarded.timestamp = Date.now();
    }
  }

  // Ensure required fields exist
  if (!guarded.id) {
    guarded.id = `guard-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
  }

  // Ensure confidence is valid number
  if (
    typeof guarded.confidence !== "number" ||
    !Number.isFinite(guarded.confidence)
  ) {
    guarded.confidence = 0;
  }

  return guarded;
}

/**
 * Validates that event payload matches expected contract
 */
export function validateEventPayload(
  eventName: string,
  payload: unknown,
): boolean {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const obj = payload as Record<string, unknown>;

  switch (eventName) {
    case "processingError":
    case "processingError.v1":
      return (
        typeof obj.inputId === "string" &&
        (typeof obj.error === "string" || typeof obj._error === "string") &&
        typeof obj.modality === "string"
      );

    case "queueStateChanged":
    case "queueStateChanged.v1":
      return typeof obj.size === "number" && typeof obj.inFlight === "number";

    case "processingCompleted":
    case "processingCompleted.v1":
      return (
        typeof obj.inputId === "string" && typeof obj.confidence === "number"
      );

    default:
      // Unknown event - assume valid
      return true;
  }
}

/**
 * Safe event emitter that validates and normalizes payloads
 */
export class SafeEventEmitter {
  private readonly emitter: any;

  constructor(emitter: any) {
    this.emitter = emitter;
  }

  emit(eventName: string, payload: unknown): boolean {
    try {
      // Validate payload structure
      if (!validateEventPayload(eventName, payload)) {
        console.warn(`Invalid payload for event ${eventName}:`, payload);
        return false;
      }

      // Normalize specific event types
      let normalizedPayload = payload;

      if (
        eventName === "processingError" ||
        eventName === "processingError.v1"
      ) {
        normalizedPayload = normalizeProcessingError(
          payload as ProcessingErrorPayload,
        );
      }

      return this.emitter.emit(eventName, normalizedPayload);
    } catch (error) {
      console.error(`Error emitting event ${eventName}:`, error);
      return false;
    }
  }

  on(eventName: string, listener: (...args: any[]) => void): this {
    this.emitter.on(eventName, listener);
    return this;
  }

  off(eventName: string, listener: (...args: any[]) => void): this {
    this.emitter.off(eventName, listener);
    return this;
  }

  removeAllListeners(eventName?: string): this {
    this.emitter.removeAllListeners(eventName);
    return this;
  }
}
