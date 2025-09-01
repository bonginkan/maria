// src/services/hsr-system/types/interruption-types.ts
/**
 * Interruption System Types for HSR
 * HSRシステム割り込み処理タイプ定義
 */

export enum InterruptionType {
  EMERGENCY_STOP = "EMERGENCY_STOP",
  PAUSE = "PAUSE",
  RESUME = "RESUME",
  RESET = "RESET",
  STATUS_CHECK = "STATUS_CHECK",
  EXPLAIN = "EXPLAIN",
}

export enum InterruptionPriority {
  CRITICAL = "CRITICAL",
  HIGH = "HIGH",
  MEDIUM = "MEDIUM",
  LOW = "LOW",
}

export interface InterruptionAction {
  type: InterruptionType;
  reason: string;
  timestamp?: Date;
  priority: InterruptionPriority;
  sourceInput?: string;
  confidence?: number;
  requiresConfirmation?: boolean;
}

export interface InterruptionResponse {
  acknowledged: boolean;
  timestamp: Date;
  action: InterruptionType;
  resumeCapable: boolean;
  message?: string;
  partialResults?: any;
}

export interface InterruptionHandler {
  processInterruption(
    action: InterruptionAction,
  ): Promise<InterruptionResponse>;
  createInterruption(
    _type: InterruptionType,
    reason: string,
  ): Promise<InterruptionAction>;
}
