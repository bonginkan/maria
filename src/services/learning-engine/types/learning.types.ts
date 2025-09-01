/**
 * Phase 4.1 Learning Engine - Type Definitions
 * Foundational types for pattern recognition and learning
 */

export interface UserAction {
  command: string;
  args?: string[];
  timestamp: Date;
  context: {
    cwd: string;
    fileType?: string;
    previousCommand?: string;
    projectType?: string;
  };
}

export interface Pattern {
  id: string;
  type: "command_sequence" | "file_pattern" | "workflow" | "context_switch";
  sequence: string[];
  frequency: number;
  confidence: number; // 0-1 scale with time decay
  lastSeen: Date;
  successRate: number;
  metadata: {
    context?: string;
    projectType?: string;
    userHash?: string; // Anonymized user identifier
  };
}

export interface SimpleContext {
  lastCommand?: string;
  cwd: string;
  recentCommands?: string[];
  fileContext?: string;
}

export interface Suggestion {
  command: string;
  confidence: number;
  source: "pattern" | "fallback" | "context";
  reasoning?: string;
}

export interface LearningStats {
  totalPatterns: number;
  averageConfidence: number;
  suggestionsGenerated: number;
  patternHitRate: number;
}

export interface LearningEngineConfig {
  minFrequency: number;
  maxPatterns: number;
  timeDecayFactor: number;
  confidenceThreshold: number;
}

export interface PatternMatchResult {
  pattern: Pattern;
  matchScore: number;
  contextScore: number;
}
