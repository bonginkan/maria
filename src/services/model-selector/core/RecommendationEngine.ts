/**
 * Model Selector v2 - Recommendation Engine
 * Rule-based MVP implementation for intelligent model selection
 */

import { EventEmitter } from "node:events";
import type {
  ModelInfo,
  RecommendationContext,
  ModelRecommendation,
  ModelUsageHistory,
  RecommendationConfig,
} from "../types/index";

export class RecommendationEngine extends EventEmitter {
  private config: RecommendationConfig;
  private historyCache: Map<string, ModelUsageHistory[]> = new Map();

  constructor(config: Partial<RecommendationConfig> = {}) {
    super();

    this.config = {
      historyWeight: config.historyWeight ?? 0.3,
      latencyWeight: config.latencyWeight ?? 0.4,
      costWeight: config.costWeight ?? 0.3,
      qualityWeight: config.qualityWeight ?? 0.0, // Future enhancement
    };
  }

  /**
   * Generate model recommendations based on context
   */
  async recommendModels(
    context: RecommendationContext,
  ): Promise<ModelRecommendation[]> {
    const startTime = performance.now();

    try {
      // Validate input
      if (!context.candidates || context.candidates.length === 0) {
        return [];
      }

      // Calculate scores for each candidate
      const scoredModels = await this.scoreModels(context);

      // Sort by score (descending) and take top 3
      const recommendations = scoredModels
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map((scored, index) => this.createRecommendation(scored, index + 1));

      const duration = performance.now() - startTime;

      this.emit("recommendations_generated", {
        context: this.sanitizeContext(context),
        recommendations: recommendations.length,
        duration,
        topScore: recommendations[0]?.confidence || 0,
      });

      return recommendations;
    } catch (error) {
      const duration = performance.now() - startTime;

      this.emit("recommendation_error", {
        error: error.message,
        context: this.sanitizeContext(context),
        duration,
      });

      // Fallback: return models sorted by latency
      return this.fallbackRecommendations(context.candidates);
    }
  }

  /**
   * Score all candidate models based on context
   */
  private async scoreModels(
    context: RecommendationContext,
  ): Promise<ScoredModel[]> {
    const promises = context.candidates.map(async (model) => {
      const score = await this.calculateModelScore(model, context);
      return { model, score };
    });

    return Promise.all(promises);
  }

  /**
   * Calculate score for a single model
   */
  private async calculateModelScore(
    model: ModelInfo,
    context: RecommendationContext,
  ): Promise<number> {
    const historyScore = this.calculateHistoryScore(model, context);
    const latencyScore = this.calculateLatencyScore(model, context);
    const costScore = this.calculateCostScore(model, context);
    const availabilityScore = this.calculateAvailabilityScore(model);
    const taskScore = this.calculateTaskScore(model, context);

    const totalScore =
      historyScore * this.config.historyWeight +
      latencyScore * this.config.latencyWeight +
      costScore * this.config.costWeight +
      availabilityScore * 0.1 + // Always factor in availability
      taskScore * 0.1; // Always factor in task suitability

    return Math.max(0, Math.min(1, totalScore)); // Normalize to 0-1
  }

  /**
   * Score based on historical usage and success rate
   */
  private calculateHistoryScore(
    model: ModelInfo,
    context: RecommendationContext,
  ): number {
    if (!context.history || context.history.length === 0) {
      return 0.5; // Neutral score for new models
    }

    const modelHistory = context.history.filter((h) => h.modelId === model.id);
    if (modelHistory.length === 0) {
      // Check provider history as fallback
      const providerHistory = context.history.filter((h) =>
        h.modelId.startsWith(model.provider + ":"),
      );

      if (providerHistory.length === 0) {
        return 0.5; // Neutral score
      }

      // Use provider success rate with lower weight
      const providerSuccessRate =
        providerHistory.filter((h) => h.success).length /
        providerHistory.length;
      return providerSuccessRate * 0.7; // Provider bias factor
    }

    // Calculate success rate for this specific model
    const successRate =
      modelHistory.filter((h) => h.success).length / modelHistory.length;

    // Boost score for recent successful usage
    const recentUsage = modelHistory
      .filter(
        (h) => Date.now() - h.timestamp.getTime() < 7 * 24 * 60 * 60 * 1000,
      ) // Last 7 days
      .filter((h) => h.success);

    const recencyBoost = Math.min(0.2, recentUsage.length * 0.05);

    return Math.min(1, successRate + recencyBoost);
  }

  /**
   * Score based on latency requirements
   */
  private calculateLatencyScore(
    model: ModelInfo,
    context: RecommendationContext,
  ): number {
    const latency = model.latencyMs;
    const requirement = context.latencyRequirement || "medium";

    // Define latency thresholds (ms)
    const thresholds = {
      low: 200, // Very fast response needed
      medium: 500, // Normal response time
      high: 1000, // Can tolerate higher latency
    };

    const threshold = thresholds[requirement];

    if (latency <= threshold) {
      // Perfect score if under threshold
      return 1.0;
    } else {
      // Gradual penalty for exceeding threshold
      const penalty = Math.min(1, (latency - threshold) / threshold);
      return Math.max(0, 1 - penalty);
    }
  }

  /**
   * Score based on cost requirements
   */
  private calculateCostScore(
    model: ModelInfo,
    context: RecommendationContext,
  ): number {
    const averageCost = (model.price.input + model.price.output) / 2;
    const budget = context.budget || "medium";

    // Define budget thresholds (per 1M tokens)
    const thresholds = {
      low: 5, // Budget-conscious
      medium: 15, // Standard pricing
      high: 50, // Premium models acceptable
    };

    const threshold = thresholds[budget];

    if (averageCost <= threshold) {
      // Perfect score if within budget
      return 1.0;
    } else {
      // Gradual penalty for exceeding budget
      const penalty = Math.min(1, (averageCost - threshold) / threshold);
      return Math.max(0, 1 - penalty);
    }
  }

  /**
   * Score based on model availability
   */
  private calculateAvailabilityScore(model: ModelInfo): number {
    switch (model.availability) {
      case "healthy":
        return 1.0;
      case "degraded":
        return 0.6;
      case "unavailable":
        return 0.0;
      default:
        return 0.5;
    }
  }

  /**
   * Score based on task suitability
   */
  private calculateTaskScore(
    model: ModelInfo,
    context: RecommendationContext,
  ): number {
    if (!context.task) return 0.8; // Neutral score for unknown tasks

    const task = context.task.toLowerCase();
    const capabilities = model.capabilities.map((c) => c.toLowerCase());

    // Task-capability mapping
    const taskRequirements: Record<string, string[]> = {
      codegen: ["function_call", "code_execution"],
      code_generation: ["function_call", "code_execution"],
      analysis: ["text", "file_analysis"],
      data_analysis: ["text", "file_analysis"],
      translation: ["text"],
      image_analysis: ["image", "text"],
      audio_processing: ["audio", "text"],
      web_search: ["web_search", "text"],
      general: ["text"],
    };

    const requiredCapabilities = taskRequirements[task] || ["text"];
    const matchCount = requiredCapabilities.filter((req) =>
      capabilities.includes(req),
    ).length;

    return matchCount / requiredCapabilities.length;
  }

  /**
   * Create recommendation object from scored model
   */
  private createRecommendation(
    scored: ScoredModel,
    rank: number,
  ): ModelRecommendation {
    const reason = this.generateRecommendationReason(scored);

    return {
      ...scored.model,
      confidence: scored.score,
      reason,
      rank,
    };
  }

  /**
   * Generate human-readable reason for recommendation
   */
  private generateRecommendationReason(scored: ScoredModel): string {
    const { model, score } = scored;
    const reasons: string[] = [];

    if (model.availability === "healthy") {
      reasons.push("reliable availability");
    }

    if (model.latencyMs < 300) {
      reasons.push("fast response time");
    }

    const avgCost = (model.price.input + model.price.output) / 2;
    if (avgCost < 10) {
      reasons.push("cost-effective");
    }

    if (score > 0.8) {
      reasons.push("high historical success rate");
    }

    if (reasons.length === 0) {
      reasons.push("balanced performance characteristics");
    }

    return `Recommended for ${reasons.join(", ")}`;
  }

  /**
   * Fallback recommendations when scoring fails
   */
  private fallbackRecommendations(
    candidates: ModelInfo[],
  ): ModelRecommendation[] {
    return candidates
      .filter((model) => model.availability === "healthy")
      .sort((a, b) => a.latencyMs - b.latencyMs)
      .slice(0, 3)
      .map((model, index) => ({
        ...model,
        confidence: 0.5, // Neutral confidence
        reason: "Fallback recommendation based on availability and latency",
        rank: index + 1,
      }));
  }

  /**
   * Update historical data for learning
   */
  updateHistory(
    context: RecommendationContext,
    success: boolean,
    executionTime: number,
  ): void {
    if (!context.userId) return;

    const historyEntry: ModelUsageHistory = {
      modelId: "", // Would be filled by caller
      success,
      task: context.task || "unknown",
      timestamp: new Date(),
      latency: executionTime,
    };

    // Cache history for this user
    const userHistory = this.historyCache.get(context.userId) || [];
    userHistory.push(historyEntry);

    // Keep only last 100 entries per user
    if (userHistory.length > 100) {
      userHistory.shift();
    }

    this.historyCache.set(context.userId, userHistory);

    this.emit("history_updated", {
      userId: context.userId,
      success,
      task: context.task,
      executionTime,
    });
  }

  /**
   * Get recommendation statistics
   */
  getStats(): {
    totalRecommendations: number;
    averageScore: number;
    cacheSize: number;
    config: RecommendationConfig;
  } {
    // This would be enhanced with actual metrics tracking
    return {
      totalRecommendations: 0, // TODO: implement counter
      averageScore: 0, // TODO: implement score tracking
      cacheSize: this.historyCache.size,
      config: { ...this.config },
    };
  }

  /**
   * Clear history cache
   */
  clearHistory(userId?: string): void {
    if (userId) {
      this.historyCache.delete(userId);
    } else {
      this.historyCache.clear();
    }

    this.emit("history_cleared", { userId });
  }

  /**
   * Update recommendation weights
   */
  updateConfig(config: Partial<RecommendationConfig>): void {
    this.config = { ...this.config, ...config };

    // Normalize weights to sum to 1.0
    const totalWeight =
      this.config.historyWeight +
      this.config.latencyWeight +
      this.config.costWeight;
    if (totalWeight > 0) {
      this.config.historyWeight /= totalWeight;
      this.config.latencyWeight /= totalWeight;
      this.config.costWeight /= totalWeight;
    }

    this.emit("config_updated", { config: this.config });
  }

  // Helper method to sanitize context for logging
  private sanitizeContext(
    context: RecommendationContext,
  ): Partial<RecommendationContext> {
    return {
      task: context.task,
      budget: context.budget,
      latencyRequirement: context.latencyRequirement,
      candidateCount: context.candidates?.length || 0,
    };
  }
}

interface ScoredModel {
  model: ModelInfo;
  score: number;
}
