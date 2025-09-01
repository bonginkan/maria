/**
 * Shared types for Interactive CLI Input System
 *
 * This file contains common interfaces and types used across
 * the interactive input components, extracted from versioned
 * implementations to prevent circular dependencies.
 *
 * @since v3.6.0 - Extracted during interactive directory cleanup
 */

import type { ClipboardAnalysis } from "../clipboard/ClipboardAnalyzer";
import type { DetectionResult } from "../error-analyzer/ErrorPatternDetector";
import type { ProposedAction } from "../bridges/ErrorToCommandBridge";
import type { CommandMapping } from "../intelligent-router/NaturalLanguageCommandMapper";

// Core processing result interface
export interface ProcessingResult {
  // Command determination
  command?: string;
  parameters?: string[];
  confidence: number;
  requiresConfirmation: boolean;

  // Analysis results
  clipboardAnalysis?: ClipboardAnalysis;
  errorAnalysis?: DetectionResult;
  commandMapping?: CommandMapping;
  proposedActions?: ProposedAction[];

  // Execution suggestions
  suggestedExecution: "auto" | "confirm" | "manual";
  explanation: string;
  alternatives?: Array<{
    command: string;
    parameters?: string[];
    confidence: number;
  }>;
}

// Enhanced CLI configuration interface
export interface EnhancedCLIConfig {
  // Analysis settings
  enableClipboardAnalysis: boolean;
  enableErrorDetection: boolean;
  enableNaturalLanguageMapping: boolean;

  // Confidence thresholds
  autoExecuteThreshold: number;
  confirmationThreshold: number;
  minimumConfidenceThreshold: number;

  // Performance settings
  debounceMs: number;
  maxProcessingTime: number;
  enableRealTimeAnalysis: boolean;

  // Security settings
  enableSecretDetection: boolean;
  enableContentValidation: boolean;

  // User preferences
  preferredLanguage: "en" | "ja" | "zh" | "ko";
  verboseOutput: boolean;
  enableLearning: boolean;
}

// Input options for basic CLI input
export interface InputOptions {
  prompt?: string;
  enableAutocomplete?: boolean;
  enableVimMode?: boolean;
  maxSuggestions?: number;
}

// Input result interface
export interface InputResult {
  text: string;
  cancelled: boolean;
  command?: string;
  args?: string[];
}

// Token type for input parsing
export type InputToken = {
  text: string;
  kind: "word" | "symbol" | "space";
};

// UI Port interface for stable API contract
export interface UIPort {
  writeChunk(data: string): void;
  startCodeBlock(language?: string): void;
  endCodeBlock(): void;
  flush(): void;
  updateStatus?(message: string): void;
  showProgress?(current: number, total: number): void;
}
