/**
 * Unified command result type for consistent command handling
 * Enforces requiresInput=false to prevent re-dispatch loops
 */
export type CommandEndReason = "success" | "timeout" | "error" | "cancel";

export type CommandResult = {
  ok: boolean;
  message: string;
  data?: unknown;
  component?: string;
  /** Always false to prevent re-dispatch loops */
  requiresInput: false; // Not optional - always false
  endReason: CommandEndReason;
  errorCode?: string; // E_PROVIDER_AUTH | E_RATE_LIMIT など
};

/**
 * エラーコード標準化
 */
export const ERROR_CODES = {
  PROVIDER_AUTH: "E_PROVIDER_AUTH",
  RATE_LIMIT: "E_RATE_LIMIT",
  STREAM_BROKEN: "E_STREAM_BROKEN",
  TIMEOUT: "E_TIMEOUT",
  BUSY: "E_BUSY",
  INVALID_INPUT: "E_INVALID_INPUT",
  INTERNAL: "E_INTERNAL",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/**
 * ルーターメトリクス型
 */
export interface RouterMetrics {
  command: string;
  latencyMs: number;
  endReason: string;
  ok: boolean;
  errorCode?: string;
}

/**
 * Normalizes any command handler result to CommandResult
 * Ensures requiresInput is always false for re-dispatch prevention
 */
export function toCommandResult(anyResult: any): CommandResult {
  if (!anyResult) {
    return {
      ok: false,
      message: "Unknown error",
      requiresInput: false as const, // Force literal false type
      endReason: "error",
      errorCode: ERROR_CODES.INTERNAL,
    };
  }

  const ok = !!(anyResult?.ok ?? anyResult?.success ?? anyResult?._success);
  const message = String(anyResult?.message ?? anyResult?._message ?? "");
  const data = anyResult?.data ?? anyResult?._data;
  const component = anyResult?.component;
  const errorCode = anyResult?.errorCode;

  const endReason: CommandEndReason =
    anyResult?.endReason ??
    (anyResult?.timeout ? "timeout" : ok ? "success" : "error");

  // Force requiresInput to false - this is critical for preventing re-dispatch
  return {
    ok,
    message,
    data,
    component,
    endReason,
    errorCode,
    requiresInput: false as const, // Always false, enforced by type
  };
}
