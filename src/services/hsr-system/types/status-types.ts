// src/services/hsr-system/types/status-types.ts
/**
 * Status Display Types for HSR System
 * HSRシステムステータス表示タイプ定義
 */

export interface AnalysisMetrics {
  startTime: Date;
  currentPhaseStart: Date;
  totalBranches: number;
  completedBranches: number;
  averageBranchTime: number; // ms
  estimatedTotal: number; // ms
  confidence: number; // 0-1
  viabilityScore: number; // 0-1
}

export interface HumanInteractionMetrics {
  interruptionCount: number;
  totalPauseTime: number; // ms
  lastInteractionTime: Date | null;
  controlResponseTime: number; // ms (ESC response)
  naturalLanguageCommands: string[];
}

export interface StatusDisplayConfig {
  mode: "COMPACT" | "DETAILED" | "MINIMAL";
  colors: boolean;
  animations: boolean;
  updateFrequency: number; // ms
  showMetrics: boolean;
  showHistory: boolean;
  maxHistoryLines: number;
}

export interface AnalysisPhaseInfo {
  id: string;
  name: string;
  description: string;
  weight: number; // contribution to overall progress
  status: "PENDING" | "ACTIVE" | "COMPLETED" | "SKIPPED";
  startTime?: Date;
  endTime?: Date;
  subPhases?: AnalysisPhaseInfo[];
}

export interface BranchAnalysisResult {
  branchId: string;
  name: string;
  confidence: number;
  viability: number;
  reasoning: string;
  partialResult: any;
  humanReviewRequired: boolean;
  completionTime: Date;
}

export interface StatusSnapshot {
  timestamp: Date;
  sessionId: string;
  mode: string;
  phase: AnalysisPhaseInfo;
  progress: number;
  metrics: AnalysisMetrics;
  humanMetrics: HumanInteractionMetrics;
  partialResults: BranchAnalysisResult[];
  isInterruptible: boolean;
  nextAction: string;
}

export type StatusUpdateType =
  | "PROGRESS_UPDATE"
  | "PHASE_CHANGE"
  | "PARTIAL_RESULT"
  | "HUMAN_INTERACTION"
  | "INTERRUPTION"
  | "COMPLETION"
  | "ERROR";

export interface StatusUpdate {
  type: StatusUpdateType;
  timestamp: Date;
  data: any;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}
