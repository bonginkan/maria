import { EventEmitter } from "node:events";
import { safeAverage, safeStandardDeviation } from "../utils/math.js";

export interface ConfidenceScore {
  value: number; // 0-1 range
  factors: {
    historical: number;
    contextual: number;
    technical: number;
    temporal: number;
  };
  metadata: {
    sampleSize: number;
    variance: number;
    lastUpdate: Date;
  };
}

export interface ConfidenceThresholds {
  high: number; // >= 0.8
  medium: number; // >= 0.6
  low: number; // >= 0.3
  reject: number; // < 0.3
}

export interface ConfidenceContext {
  operation: string;
  provider: string;
  modelId: string;
  inputComplexity: number;
  historicalSuccess: number[];
  systemLoad: number;
  timestamp: Date;
}

export type ConfidenceLevel = "high" | "medium" | "low" | "reject";

export interface ConfidenceStrategyOptions {
  thresholds: ConfidenceThresholds;
  adaptationRate: number;
  windowSize: number;
  decayFactor: number;
  minSampleSize: number;
}

export class ConfidenceStrategy extends EventEmitter {
  private readonly _options: ConfidenceStrategyOptions;
  private readonly _historyWindow = new Map<string, number[]>();
  private readonly _contextWeights = {
    historical: 0.4,
    contextual: 0.3,
    technical: 0.2,
    temporal: 0.1,
  };

  constructor(options: Partial<ConfidenceStrategyOptions> = {}) {
    super();

    this._options = {
      thresholds: {
        high: 0.8,
        medium: 0.6,
        low: 0.3,
        reject: 0.0,
      },
      adaptationRate: 0.1,
      windowSize: 100,
      decayFactor: 0.95,
      minSampleSize: 5,
      ...options,
    };
  }

  calculateConfidence(context: ConfidenceContext): ConfidenceScore {
    const key = this._getContextKey(context);
    const history = this._historyWindow.get(key) || [];

    const factors = {
      historical: this._calculateHistoricalFactor(history),
      contextual: this._calculateContextualFactor(context),
      technical: this._calculateTechnicalFactor(context),
      temporal: this._calculateTemporalFactor(context),
    };

    const value = Object.entries(factors).reduce((sum, [key, factor]) => {
      return (
        sum +
        factor * this._contextWeights[key as keyof typeof this._contextWeights]
      );
    }, 0);

    const score: ConfidenceScore = {
      value: Math.max(0, Math.min(1, value)),
      factors,
      metadata: {
        sampleSize: history.length,
        variance: this._calculateVariance(history),
        lastUpdate: new Date(),
      },
    };

    this.emit("confidence_calculated", { context, score });
    return score;
  }

  getConfidenceLevel(score: ConfidenceScore): ConfidenceLevel {
    const { value } = score;
    const { thresholds } = this._options;

    if (value >= thresholds.high) return "high";
    if (value >= thresholds.medium) return "medium";
    if (value >= thresholds.low) return "low";
    return "reject";
  }

  updateHistory(
    context: ConfidenceContext,
    success: boolean,
    executionTime: number,
  ): void {
    const key = this._getContextKey(context);
    const history = this._historyWindow.get(key) || [];

    // Score based on success and performance
    const performanceScore = Math.max(0, 1 - executionTime / 10000); // 10s baseline
    const outcomeScore = success ? 1 : 0;
    const combinedScore = outcomeScore * 0.7 + performanceScore * 0.3;

    history.push(combinedScore);

    // Maintain window size
    if (history.length > this._options.windowSize) {
      history.shift();
    }

    // Apply decay to older entries
    for (let i = 0; i < history.length - 1; i++) {
      history[i] *= this._options.decayFactor;
    }

    this._historyWindow.set(key, history);

    // Adapt thresholds if needed
    this._adaptThresholds(key, history);

    this.emit("history_updated", {
      context,
      success,
      executionTime,
      historySize: history.length,
    });
  }

  shouldExecute(score: ConfidenceScore): { execute: boolean; reason: string } {
    const level = this.getConfidenceLevel(score);

    switch (level) {
      case "high":
        return { execute: true, reason: "High confidence score" };
      case "medium":
        return {
          execute: score.metadata.sampleSize >= this._options.minSampleSize,
          reason:
            score.metadata.sampleSize >= this._options.minSampleSize
              ? "Medium confidence with sufficient samples"
              : "Medium confidence but insufficient historical data",
        };
      case "low":
        return {
          execute:
            score.metadata.variance < 0.2 && score.metadata.sampleSize > 0,
          reason:
            score.metadata.variance < 0.2 && score.metadata.sampleSize > 0
              ? "Low confidence but stable performance"
              : "Low confidence with high variance or no samples",
        };
      case "reject":
      default:
        return {
          execute: false,
          reason: "Confidence below rejection threshold",
        };
    }
  }

  getStrategyStats(): {
    totalContexts: number;
    avgSampleSize: number;
    thresholds: ConfidenceThresholds;
    topPerformers: Array<{
      context: string;
      avgScore: number;
      samples: number;
    }>;
  } {
    const contexts = Array.from(this._historyWindow.entries());
    const totalContexts = contexts.length;

    // PR3: Safe average for sample size calculation
    const sampleSizes = contexts.map(([, history]) => history.length);
    const avgSampleSize = safeAverage(sampleSizes);

    const topPerformers = contexts
      .map(([context, history]) => ({
        context,
        avgScore: safeAverage(history), // PR3: Safe average for performance score
        samples: history.length,
      }))
      .sort((a, b) => b.avgScore - a.avgScore)
      .slice(0, 10);

    return {
      totalContexts,
      avgSampleSize,
      thresholds: { ...this._options.thresholds },
      topPerformers,
    };
  }

  private _getContextKey(context: ConfidenceContext): string {
    return `${context.operation}:${context.provider}:${context.modelId}`;
  }

  private _calculateHistoricalFactor(history: number[]): number {
    if (history.length === 0) {
      return 0.5; // Neutral score for no data
    }

    if (history.length < this._options.minSampleSize) {
      // Gradually increase from neutral as we get more samples
      const neutralBonus = (history.length / this._options.minSampleSize) * 0.1;
      const avg = safeAverage(history); // PR3: Safe average calculation
      return Math.max(0, Math.min(1, avg + neutralBonus));
    }

    const recentHistory = history.slice(-20); // Focus on recent performance
    const avg = safeAverage(recentHistory); // PR3: Safe average calculation

    return Math.max(0, Math.min(1, avg));
  }

  private _calculateContextualFactor(context: ConfidenceContext): number {
    let score = 0.5; // Base score

    // Adjust based on input complexity
    if (context.inputComplexity > 0.8) {
      score -= 0.2; // High complexity reduces confidence
    } else if (context.inputComplexity < 0.3) {
      score += 0.1; // Low complexity increases confidence
    }

    // Adjust based on system load
    if (context.systemLoad > 0.8) {
      score -= 0.15; // High load reduces confidence
    } else if (context.systemLoad < 0.3) {
      score += 0.05; // Low load increases confidence
    }

    return Math.max(0, Math.min(1, score));
  }

  private _calculateTechnicalFactor(context: ConfidenceContext): number {
    let score = 0.5; // Base technical confidence

    // Known high-performance providers get boost
    const providerBoosts: Record<string, number> = {
      openai: 0.1,
      anthropic: 0.1,
      google: 0.05,
    };

    score += providerBoosts[context.provider] || 0;

    // Model-specific adjustments could be added here
    return Math.max(0, Math.min(1, score));
  }

  private _calculateTemporalFactor(context: ConfidenceContext): number {
    const now = new Date();
    const age = now.getTime() - context.timestamp.getTime();
    const hoursOld = age / (1000 * 60 * 60);

    // Fresher contexts get slight boost
    if (hoursOld < 1) return 0.6;
    if (hoursOld < 6) return 0.55;
    return 0.5;
  }

  private _calculateVariance(history: number[]): number {
    if (history.length < 2) return 0;

    // PR3: Use safe average for variance calculation
    const mean = safeAverage(history);
    const squaredDiffs = history.map((val) => Math.pow(val - mean, 2));
    return safeAverage(squaredDiffs); // PR3: Safe variance calculation
  }

  private _adaptThresholds(contextKey: string, history: number[]): void {
    if (history.length < this._options.windowSize * 0.8) return; // Need sufficient data

    // PR3: Safe average for threshold adaptation
    const recentAvg = safeAverage(history.slice(-20));
    const overallAvg = safeAverage(history);

    // If recent performance significantly differs, consider threshold adaptation
    const performanceDrift = Math.abs(recentAvg - overallAvg);

    if (performanceDrift > 0.2) {
      this.emit("threshold_adaptation_suggested", {
        contextKey,
        recentAvg,
        overallAvg,
        drift: performanceDrift,
      });
    }
  }
}
