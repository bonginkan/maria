/**
 * Unified Intent Analyzer - Facade for intent analysis functionality
 * Consolidates intent-classifier and IntentRecognizer into a single interface
 */

import { IntentClassifier } from "./intent-classifier";
import { IntentRecognizer } from "./IntentRecognizer";
import {
  IIntentClassifier,
  ClassificationResult,
  ClassificationContext,
} from "../ports/IIntentClassifier";

export interface AnalysisResult {
  intent: string;
  confidence: number;
  language: string;
  entities: Record<string, any>;
  alternatives: Array<{ intent: string; confidence: number }>;
  metadata: {
    classifierUsed: "classifier" | "recognizer" | "both";
    processingTime: number;
    contextUsed: boolean;
  };
}

/**
 * Unified Intent Analyzer that combines multiple intent analysis strategies
 */
export class IntentAnalyzer implements IIntentClassifier {
  private classifier: IntentClassifier;
  private recognizer: IntentRecognizer;
  private confidenceThreshold: number = 0.7;

  constructor() {
    this.classifier = new IntentClassifier();
    this.recognizer = new IntentRecognizer();
  }

  /**
   * Analyze intent using both classifier and recognizer for best results
   */
  async analyze(
    _text: string,
    context?: ClassificationContext,
  ): Promise<AnalysisResult> {
    const _startTime = Date.now();

    // Run both analyzers in parallel
    const [classifierResult, recognizerResult] = await Promise.all([
      this.runClassifier(_text, context),
      this.runRecognizer(_text, context),
    ]);

    // Merge results with weighted confidence
    const _mergedResult = this.mergeResults(classifierResult, recognizerResult);

    // Add metadata
    mergedResult.metadata = {
      classifierUsed: this.determineClassifierUsed(
        classifierResult,
        recognizerResult,
      ),
      processingTime: Date.now() - _startTime,
      contextUsed: context !== undefined,
    };

    return _mergedResult;
  }

  /**
   * IIntentClassifier implementation
   */
  async classify(
    _text: string,
    context?: ClassificationContext,
  ): Promise<ClassificationResult> {
    const _result = await this.analyze(_text, context);

    return {
      intent: _result.intent,
      confidence: _result.confidence,
      alternativeIntents: _result.alternatives,
      entities: _result.entities,
    };
  }

  async train(
    _examples: Array<{
      text: string;
      intent: string;
      entities?: Record<string, any>;
    }>,
  ): Promise<void> {
    // Delegate training to both underlying analyzers
    await Promise.all([
      this.classifier.train(_examples),
      this.recognizer.train(_examples),
    ]);
  }

  getConfidenceThreshold(): number {
    return this.confidenceThreshold;
  }

  setConfidenceThreshold(threshold: number): void {
    this.confidenceThreshold = threshold;
  }

  /**
   * Private helper methods
   */
  private async runClassifier(
    _text: string,
    _context?: ClassificationContext,
  ): Promise<Partial<AnalysisResult>> {
    try {
      const _result = await this.classifier.classify(_text);
      return {
        intent: _result.intent,
        confidence: _result.confidence,
        entities: _result.entities || object,
        alternatives: _result.alternatives || [],
      };
    } catch (error) {
      // Return low confidence _result on error
      return {
        intent: "unknown",
        confidence: 0,
        entities: Record<string, any>,
        alternatives: [],
      };
    }
  }

  private async runRecognizer(
    _text: string,
    context?: ClassificationContext,
  ): Promise<Partial<AnalysisResult>> {
    try {
      const _result = await this.recognizer.recognize(
        _text,
        context?.sessionData,
      );
      return {
        intent: _result.intent,
        confidence: _result.confidence,
        language: _result.language || "unknown",
        entities: _result.parameters || object,
        alternatives: [],
      };
    } catch (innerError) {
      // Return low confidence _result on error
      return {
        intent: "unknown",
        confidence: 0,
        language: "unknown",
        entities: Record<string, any>,
        alternatives: [],
      };
    }
  }

  private mergeResults(
    classifierResult: Partial<AnalysisResult>,
    recognizerResult: Partial<AnalysisResult>,
  ): AnalysisResult {
    // Weight classifier higher for intent, recognizer higher for entities
    const _classifierWeight = 0.6;
    const _recognizerWeight = 0.4;

    // Calculate weighted confidence
    const _weightedConfidence =
      (classifierResult.confidence || 0) * _classifierWeight +
      (recognizerResult.confidence || 0) * _recognizerWeight;

    // Choose intent based on highest individual confidence
    let primaryIntent: string;
    let alternatives: Array<{ intent: string; confidence: number }> = [];

    if (
      (classifierResult.confidence || 0) > (recognizerResult.confidence || 0)
    ) {
      primaryIntent = classifierResult.intent || "unknown";
      if (recognizerResult.intent && recognizerResult.intent !== "unknown") {
        alternatives.push({
          intent: recognizerResult.intent,
          confidence: recognizerResult.confidence || 0,
        });
      }
    } else {
      primaryIntent = recognizerResult.intent || "unknown";
      if (classifierResult.intent && classifierResult.intent !== "unknown") {
        alternatives.push({
          intent: classifierResult.intent,
          confidence: classifierResult.confidence || 0,
        });
      }
    }

    // Merge alternatives
    if (classifierResult.alternatives) {
      alternatives = alternatives.concat(classifierResult.alternatives);
    }

    // Merge entities from both sources
    const _mergedEntities = {
      ...classifierResult.entities,
      ...recognizerResult.entities,
    };

    return {
      intent: primaryIntent,
      confidence: _weightedConfidence,
      language: recognizerResult.language || "unknown",
      entities: _mergedEntities,
      alternatives: alternatives.slice(0, 3), // Top 3 alternatives
      metadata: Record<string, any> as any, // Will be filled by caller
    };
  }

  private determineClassifierUsed(
    classifierResult: Partial<AnalysisResult>,
    recognizerResult: Partial<AnalysisResult>,
  ): "classifier" | "recognizer" | "both" {
    const _classifierValid = (classifierResult.confidence || 0) > 0;
    const _recognizerValid = (recognizerResult.confidence || 0) > 0;

    if (_classifierValid && _recognizerValid) return "both";
    if (_classifierValid) return "classifier";
    if (_recognizerValid) return "recognizer";
    return "both"; // Default to both even if neither worked
  }
}

// Export singleton instance for backward compatibility
export const _intentAnalyzer = new IntentAnalyzer();

// Backward compatibility exports
export { IntentClassifier } from "./intent-classifier";
export { IntentRecognizer } from "./IntentRecognizer";
