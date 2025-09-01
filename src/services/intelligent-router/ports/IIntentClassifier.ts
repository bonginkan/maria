/**
 * Port interface for Intent Classification
 */

export interface IIntentClassifier {
  classify(
    _text: string,
    context?: ClassificationContext,
  ): Promise<ClassificationResult>;
  train(examples: TrainingExample[]): Promise<void>;
  getConfidenceThreshold(): number;
}

export interface ClassificationContext {
  previousIntents?: string[];
  userProfile?: Record<string, any>;
  sessionData?: Record<string, any>;
}

export interface ClassificationResult {
  intent: string;
  confidence: number;
  alternativeIntents?: Array<{ intent: string; confidence: number }>;
  entities?: Record<string, any>;
}

export interface TrainingExample {
  text: string;
  intent: string;
  entities?: Record<string, any>;
}
