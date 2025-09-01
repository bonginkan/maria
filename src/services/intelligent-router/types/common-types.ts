/**
 * Common Types for Intelligent Router
 * Circular dependency resolution
 */

export interface CommandIntent {
  command: string;
  confidence: number;
  _parameters: Record<string, unknown>;
  originalInput: string;
  _language: string;
  alternatives?: Array<{ command: string; confidence: number }>;
}

export interface RouterConfig {
  confidenceThreshold?: number;
  enableLearning?: boolean;
  supportedLanguages?: string[];
  enableConfirmation?: boolean;
  maxAlternatives?: number;
}

export interface RouterMetrics {
  totalRequests: number;
  successfulRoutes: number;
  failedRoutes: number;
  averageConfidence: number;
  languageDistribution: Record<string, number>;
}

export interface UserPattern {
  input: string;
  command: string;
  confidence: number;
  timestamp: Date;
  success: boolean;
}

export interface IntentRecognitionResult {
  intent: CommandIntent | null;
  confidence: number;
  alternatives?: CommandIntent[];
}
