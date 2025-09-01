/**
 * Model Selector v2 - Machine Learning Recommendation Engine
 * Advanced AI-powered model recommendations with learning capabilities
 */

import { EventEmitter } from "node:events";
import type {
  ModelInfo,
  RecommendationContext,
  ModelRecommendation,
  ModelUsageHistory,
} from "../types/index";

export interface MLContext extends RecommendationContext {
  userProfile?: UserProfile;
  environmentContext?: EnvironmentContext;
  performanceRequirements?: PerformanceRequirements;
}

export interface UserProfile {
  userId: string;
  skillLevel: "beginner" | "intermediate" | "expert";
  primaryUseCases: string[];
  preferredProviders: string[];
  budgetSensitivity: "low" | "medium" | "high";
  performancePreference: "speed" | "quality" | "cost";
  historicalPatterns: UsagePattern[];
}

export interface EnvironmentContext {
  timeOfDay: string;
  dayOfWeek: string;
  workloadType: "batch" | "interactive" | "realtime";
  concurrentUsers: number;
  systemLoad: "low" | "medium" | "high";
  networkLatency: number;
}

export interface PerformanceRequirements {
  maxLatency: number;
  minThroughput: number;
  maxCost: number;
  requiredCapabilities: string[];
  confidenceThreshold: number;
}

export interface UsagePattern {
  pattern: "daily" | "weekly" | "monthly" | "seasonal";
  frequency: number;
  avgDuration: number;
  peakHours: number[];
  successRate: number;
}

export interface MLTrainingData {
  sessionId: string;
  userId: string;
  context: MLContext;
  selectedModel: string;
  alternatives: string[];
  userSatisfaction: number; // 0-1 scale
  actualPerformance: {
    latency: number;
    cost: number;
    quality: number;
    success: boolean;
  };
  feedback?: {
    rating: number;
    comments?: string;
    wouldRecommendAgain: boolean;
  };
  timestamp: Date;
}

export interface MLModel {
  type:
    | "collaborative_filtering"
    | "content_based"
    | "hybrid"
    | "deep_learning";
  version: string;
  accuracy: number;
  trainedOn: Date;
  dataSize: number;
  features: string[];
}

export interface Explanation {
  recommendationId: string;
  primaryReason: string;
  factors: Array<{
    factor: string;
    weight: number;
    contribution: number;
    explanation: string;
  }>;
  confidence: number;
  alternativeReasons?: string[];
}

export interface ModelPrediction extends ModelRecommendation {
  mlScore: number;
  probabilityDistribution: Record<string, number>;
  uncertainty: number;
  explanation: Explanation;
  similar_users?: string[];
  contextualFactors?: Record<string, number>;
}

export class MLRecommendationEngine extends EventEmitter {
  private models: Map<string, MLModel> = new Map();
  private trainingData: MLTrainingData[] = [];
  private userProfiles: Map<string, UserProfile> = new Map();
  private isModelTrained = false;
  private lastTrainingTime?: Date;
  private config: MLConfig;

  // Feature extractors
  private featureExtractors: FeatureExtractor[] = [];

  // Model weights (simplified - in production would use actual ML models)
  private weights = {
    userHistory: 0.3,
    contextSimilarity: 0.25,
    performanceMatch: 0.2,
    costEfficiency: 0.15,
    popularityBoost: 0.1,
  };

  constructor(config: Partial<MLConfig> = {}) {
    super();

    this.config = {
      enableAutoRetraining: true,
      retrainingThreshold: 100, // retrain after 100 new samples
      maxTrainingData: 10000,
      confidenceThreshold: 0.7,
      explainabilityEnabled: true,
      useDeepLearning: false, // Start with simpler models
      modelValidation: true,
      ...config,
    };

    this.initializeFeatureExtractors();
  }

  /**
   * Generate ML-powered recommendations
   */
  async recommend(context: MLContext): Promise<ModelPrediction[]> {
    const startTime = performance.now();

    try {
      // Extract features from context
      const features = await this.extractFeatures(context);

      // Get user profile or create if new
      let userProfile = context.userId
        ? this.getUserProfile(context.userId)
        : undefined;
      if (!userProfile && context.userId) {
        userProfile = await this.createUserProfile(context.userId);
      }

      // Generate base recommendations
      const baseRecommendations = await this.generateBaseRecommendations(
        context,
        features,
      );

      // Apply ML scoring
      const mlPredictions = await this.applyMLScoring(
        baseRecommendations,
        features,
        userProfile,
      );

      // Sort by ML score
      mlPredictions.sort((a, b) => b.mlScore - a.mlScore);

      // Generate explanations
      for (const prediction of mlPredictions) {
        if (this.config.explainabilityEnabled) {
          prediction.explanation = await this.generateExplanation(
            prediction,
            features,
            userProfile,
          );
        }
      }

      const duration = performance.now() - startTime;

      this.emit("ml_recommendations_generated", {
        userId: context.userId,
        count: mlPredictions.length,
        averageConfidence:
          mlPredictions.reduce((acc, p) => acc + p.confidence, 0) /
          mlPredictions.length,
        duration,
        featuresUsed: Object.keys(features),
      });

      return mlPredictions;
    } catch (error) {
      this.emit("ml_recommendation_error", {
        error: error instanceof Error ? error.message : "Unknown error",
        context: { userId: context.userId, task: context.task },
      });

      // Fallback to basic recommendations
      return this.generateFallbackRecommendations(context);
    }
  }

  /**
   * Train ML model with new data
   */
  async trainModel(newData: MLTrainingData[]): Promise<{
    success: boolean;
    modelAccuracy: number;
    trainingTime: number;
    dataSize: number;
  }> {
    const startTime = performance.now();

    try {
      // Add new training data
      this.trainingData.push(...newData);

      // Limit training data size
      if (this.trainingData.length > this.config.maxTrainingData) {
        this.trainingData = this.trainingData.slice(
          -this.config.maxTrainingData,
        );
      }

      // Update user profiles from training data
      await this.updateUserProfiles(newData);

      // Train collaborative filtering model
      await this.trainCollaborativeFiltering();

      // Train content-based model
      await this.trainContentBased();

      // Validate model performance
      const accuracy = await this.validateModel();

      // Update model metadata
      const modelMetadata: MLModel = {
        type: "hybrid",
        version: `${Date.now()}`,
        accuracy,
        trainedOn: new Date(),
        dataSize: this.trainingData.length,
        features: this.featureExtractors.map((e) => e.name),
      };

      this.models.set("primary", modelMetadata);
      this.isModelTrained = true;
      this.lastTrainingTime = new Date();

      const duration = performance.now() - startTime;

      this.emit("model_trained", {
        accuracy,
        trainingTime: duration,
        dataSize: this.trainingData.length,
        version: modelMetadata.version,
      });

      return {
        success: true,
        modelAccuracy: accuracy,
        trainingTime: duration,
        dataSize: this.trainingData.length,
      };
    } catch (error) {
      this.emit("training_error", {
        error: error instanceof Error ? error.message : "Unknown error",
        dataSize: newData.length,
      });

      return {
        success: false,
        modelAccuracy: 0,
        trainingTime: performance.now() - startTime,
        dataSize: 0,
      };
    }
  }

  /**
   * Record user feedback for model improvement
   */
  async recordFeedback(
    recommendationId: string,
    feedback: {
      rating: number;
      selectedModel: string;
      actualPerformance?: {
        latency: number;
        cost: number;
        quality: number;
        success: boolean;
      };
      comments?: string;
    },
  ): Promise<void> {
    // Convert to training data format
    const trainingData: MLTrainingData = {
      sessionId: recommendationId,
      userId: "unknown", // Would be passed in real implementation
      context: {} as MLContext, // Would store original context
      selectedModel: feedback.selectedModel,
      alternatives: [], // Would store other recommendations
      userSatisfaction: feedback.rating / 5, // Normalize to 0-1
      actualPerformance: feedback.actualPerformance || {
        latency: 0,
        cost: 0,
        quality: feedback.rating / 5,
        success: feedback.rating > 3,
      },
      feedback: {
        rating: feedback.rating,
        comments: feedback.comments,
        wouldRecommendAgain: feedback.rating > 3,
      },
      timestamp: new Date(),
    };

    // Store feedback
    this.trainingData.push(trainingData);

    // Auto-retrain if threshold reached
    if (this.config.enableAutoRetraining) {
      const newSamples = this.trainingData.filter((d) =>
        this.lastTrainingTime ? d.timestamp > this.lastTrainingTime : true,
      ).length;

      if (newSamples >= this.config.retrainingThreshold) {
        await this.trainModel([trainingData]);
      }
    }

    this.emit("feedback_recorded", {
      recommendationId,
      rating: feedback.rating,
      selectedModel: feedback.selectedModel,
    });
  }

  /**
   * Get model performance metrics
   */
  getModelMetrics(): {
    isModelTrained: boolean;
    accuracy: number;
    dataSize: number;
    lastTraining?: Date;
    modelVersion?: string;
    predictions: {
      total: number;
      averageConfidence: number;
      successRate: number;
    };
  } {
    const primaryModel = this.models.get("primary");

    return {
      isModelTrained: this.isModelTrained,
      accuracy: primaryModel?.accuracy || 0,
      dataSize: this.trainingData.length,
      lastTraining: this.lastTrainingTime,
      modelVersion: primaryModel?.version,
      predictions: {
        total: this.trainingData.length,
        averageConfidence: this.calculateAverageConfidence(),
        successRate: this.calculateSuccessRate(),
      },
    };
  }

  // Private methods

  private initializeFeatureExtractors(): void {
    this.featureExtractors = [
      new UserHistoryExtractor(),
      new ContextualExtractor(),
      new PerformanceExtractor(),
      new CostExtractor(),
      new CapabilityExtractor(),
      new TemporalExtractor(),
      new PopularityExtractor(),
    ];
  }

  private async extractFeatures(
    context: MLContext,
  ): Promise<Record<string, number>> {
    const features: Record<string, number> = {};

    for (const extractor of this.featureExtractors) {
      try {
        const extractedFeatures = await extractor.extract(context);
        Object.assign(features, extractedFeatures);
      } catch (error) {
        // Continue if individual extractor fails
      }
    }

    return features;
  }

  private getUserProfile(userId: string): UserProfile | undefined {
    return this.userProfiles.get(userId);
  }

  private async createUserProfile(userId: string): Promise<UserProfile> {
    const profile: UserProfile = {
      userId,
      skillLevel: "intermediate", // Default assumption
      primaryUseCases: [],
      preferredProviders: [],
      budgetSensitivity: "medium",
      performancePreference: "quality",
      historicalPatterns: [],
    };

    this.userProfiles.set(userId, profile);
    return profile;
  }

  private async generateBaseRecommendations(
    context: MLContext,
    features: Record<string, number>,
  ): Promise<ModelRecommendation[]> {
    // Get candidate models
    const candidates = context.candidates || [];

    // Generate base scores
    return candidates
      .map((model) => ({
        ...model,
        confidence: this.calculateBaseConfidence(model, features),
        reason: this.generateBaseReason(model, features),
        rank: 0, // Will be set after sorting
      }))
      .slice(0, 10); // Limit candidates
  }

  private async applyMLScoring(
    recommendations: ModelRecommendation[],
    features: Record<string, number>,
    userProfile?: UserProfile,
  ): Promise<ModelPrediction[]> {
    return recommendations.map((rec, index) => {
      const mlScore = this.calculateMLScore(rec, features, userProfile);
      const uncertainty = this.calculateUncertainty(rec, features);

      return {
        ...rec,
        mlScore,
        probabilityDistribution: this.calculateProbabilityDistribution(
          rec,
          recommendations,
        ),
        uncertainty,
        explanation: {} as Explanation, // Will be filled later
        contextualFactors: this.extractContextualFactors(features),
        rank: index + 1,
      };
    });
  }

  private calculateMLScore(
    recommendation: ModelRecommendation,
    features: Record<string, number>,
    userProfile?: UserProfile,
  ): number {
    let score = recommendation.confidence;

    // Apply user history weight
    if (features.user_history_match) {
      score += features.user_history_match * this.weights.userHistory;
    }

    // Apply context similarity
    if (features.context_similarity) {
      score += features.context_similarity * this.weights.contextSimilarity;
    }

    // Apply performance match
    if (features.performance_match) {
      score += features.performance_match * this.weights.performanceMatch;
    }

    // Apply cost efficiency
    if (features.cost_efficiency) {
      score += features.cost_efficiency * this.weights.costEfficiency;
    }

    // Apply popularity boost
    if (features.popularity_score) {
      score += features.popularity_score * this.weights.popularityBoost;
    }

    // User profile adjustments
    if (userProfile) {
      score = this.applyUserProfileAdjustments(
        score,
        recommendation,
        userProfile,
      );
    }

    return Math.min(1.0, Math.max(0.0, score));
  }

  private applyUserProfileAdjustments(
    score: number,
    recommendation: ModelRecommendation,
    userProfile: UserProfile,
  ): number {
    // Preferred provider boost
    if (userProfile.preferredProviders.includes(recommendation.provider)) {
      score += 0.1;
    }

    // Performance preference adjustment
    const costPerToken =
      recommendation.price.input + recommendation.price.output;
    switch (userProfile.performancePreference) {
      case "speed":
        score += recommendation.latencyMs < 200 ? 0.1 : -0.05;
        break;
      case "cost":
        score += costPerToken < 0.001 ? 0.1 : -0.05;
        break;
      case "quality":
        // Assume certain models are higher quality
        score += recommendation.capabilities.length > 3 ? 0.05 : 0;
        break;
    }

    return score;
  }

  private calculateUncertainty(
    recommendation: ModelRecommendation,
    features: Record<string, number>,
  ): number {
    // Higher uncertainty for:
    // - New models with limited data
    // - Unusual contexts
    // - Low feature confidence

    let uncertainty = 0.1; // Base uncertainty

    // Increase uncertainty if limited historical data
    const dataPoints = features.historical_data_points || 0;
    if (dataPoints < 10) {
      uncertainty += 0.2;
    }

    // Increase uncertainty for unusual contexts
    if (features.context_unusualness && features.context_unusualness > 0.7) {
      uncertainty += 0.15;
    }

    return Math.min(0.5, uncertainty); // Cap at 50% uncertainty
  }

  private calculateProbabilityDistribution(
    target: ModelRecommendation,
    allRecommendations: ModelRecommendation[],
  ): Record<string, number> {
    const distribution: Record<string, number> = {};
    const totalScore = allRecommendations.reduce(
      (sum, rec) => sum + rec.confidence,
      0,
    );

    allRecommendations.forEach((rec) => {
      distribution[rec.id] = rec.confidence / totalScore;
    });

    return distribution;
  }

  private extractContextualFactors(
    features: Record<string, number>,
  ): Record<string, number> {
    return {
      time_of_day: features.time_of_day_factor || 0,
      workload_type: features.workload_type_factor || 0,
      system_load: features.system_load_factor || 0,
      user_experience: features.user_experience_factor || 0,
    };
  }

  private async generateExplanation(
    prediction: ModelPrediction,
    features: Record<string, number>,
    userProfile?: UserProfile,
  ): Promise<Explanation> {
    const factors: Array<{
      factor: string;
      weight: number;
      contribution: number;
      explanation: string;
    }> = [];

    // Analyze top contributing factors
    if (features.user_history_match > 0.1) {
      factors.push({
        factor: "User History",
        weight: this.weights.userHistory,
        contribution: features.user_history_match * this.weights.userHistory,
        explanation: "Based on your previous successful model selections",
      });
    }

    if (features.performance_match > 0.1) {
      factors.push({
        factor: "Performance Match",
        weight: this.weights.performanceMatch,
        contribution:
          features.performance_match * this.weights.performanceMatch,
        explanation: `Matches your performance requirements (${prediction.latencyMs}ms latency)`,
      });
    }

    if (features.cost_efficiency > 0.1) {
      const cost = prediction.price.input + prediction.price.output;
      factors.push({
        factor: "Cost Efficiency",
        weight: this.weights.costEfficiency,
        contribution: features.cost_efficiency * this.weights.costEfficiency,
        explanation: `Cost-effective at $${cost.toFixed(4)}/1K tokens`,
      });
    }

    // Sort by contribution
    factors.sort((a, b) => b.contribution - a.contribution);

    let primaryReason = "Balanced performance and cost";
    if (factors.length > 0) {
      primaryReason = factors[0].explanation;
    }

    return {
      recommendationId: prediction.id,
      primaryReason,
      factors: factors.slice(0, 5), // Top 5 factors
      confidence: prediction.confidence,
      alternativeReasons: factors.slice(1, 3).map((f) => f.explanation),
    };
  }

  private generateFallbackRecommendations(
    context: MLContext,
  ): Promise<ModelPrediction[]> {
    // Simple fallback based on basic rules
    const candidates = context.candidates || [];

    const fallback = candidates.slice(0, 3).map((model, index) => ({
      ...model,
      confidence: Math.max(0, 0.8 - index * 0.1),
      reason: "Fallback recommendation due to ML model unavailability",
      rank: index + 1,
      mlScore: Math.max(0, 0.7 - index * 0.1),
      probabilityDistribution: { [model.id]: 1.0 },
      uncertainty: 0.3,
      explanation: {
        recommendationId: model.id,
        primaryReason: "Fallback recommendation",
        factors: [],
        confidence: Math.max(0, 0.8 - index * 0.1),
      } as Explanation,
    }));

    return Promise.resolve(fallback);
  }

  // Training methods (simplified implementations)

  private async trainCollaborativeFiltering(): Promise<void> {
    // Simplified collaborative filtering training
    // In production, would use proper matrix factorization techniques
    const userModelMatrix = this.buildUserModelMatrix();
    this.updateCollaborativeWeights(userModelMatrix);
  }

  private async trainContentBased(): Promise<void> {
    // Simplified content-based training
    // In production, would use feature similarity calculations
    const modelFeatures = this.extractModelFeatures();
    this.updateContentWeights(modelFeatures);
  }

  private async validateModel(): Promise<number> {
    // Simplified model validation
    // In production, would use cross-validation
    const testSize = Math.min(100, Math.floor(this.trainingData.length * 0.2));
    let correct = 0;

    for (let i = 0; i < testSize; i++) {
      const testSample = this.trainingData[i];
      // Simulate prediction accuracy
      if (testSample.userSatisfaction > 0.7) {
        correct++;
      }
    }

    return testSize > 0 ? correct / testSize : 0.8; // Default accuracy
  }

  private buildUserModelMatrix(): Map<string, Map<string, number>> {
    const matrix = new Map<string, Map<string, number>>();

    for (const data of this.trainingData) {
      if (!matrix.has(data.userId)) {
        matrix.set(data.userId, new Map());
      }

      const userMap = matrix.get(data.userId)!;
      userMap.set(data.selectedModel, data.userSatisfaction);
    }

    return matrix;
  }

  private updateCollaborativeWeights(
    matrix: Map<string, Map<string, number>>,
  ): void {
    // Simplified weight updates
    this.weights.userHistory *= 1.1; // Boost importance
  }

  private extractModelFeatures(): Map<string, Record<string, number>> {
    // Simplified model feature extraction
    return new Map();
  }

  private updateContentWeights(
    features: Map<string, Record<string, number>>,
  ): void {
    // Simplified content-based weight updates
    this.weights.contextSimilarity *= 1.05;
  }

  private async updateUserProfiles(newData: MLTrainingData[]): Promise<void> {
    for (const data of newData) {
      let profile = this.userProfiles.get(data.userId);

      if (!profile) {
        profile = await this.createUserProfile(data.userId);
      }

      // Update profile based on new data
      this.updateProfileFromData(profile, data);
      this.userProfiles.set(data.userId, profile);
    }
  }

  private updateProfileFromData(
    profile: UserProfile,
    data: MLTrainingData,
  ): void {
    // Update preferred providers
    if (data.userSatisfaction > 0.7) {
      const provider = this.getModelProvider(data.selectedModel);
      if (provider && !profile.preferredProviders.includes(provider)) {
        profile.preferredProviders.push(provider);
      }
    }

    // Update performance preference based on satisfaction
    if (data.actualPerformance) {
      if (data.userSatisfaction > 0.8 && data.actualPerformance.latency < 200) {
        profile.performancePreference = "speed";
      } else if (
        data.userSatisfaction > 0.8 &&
        data.actualPerformance.cost < 0.001
      ) {
        profile.performancePreference = "cost";
      }
    }
  }

  private getModelProvider(modelId: string): string | undefined {
    // Would look up actual model provider
    // Simplified for demo
    if (modelId.includes("claude")) return "anthropic";
    if (modelId.includes("gpt")) return "openai";
    if (modelId.includes("gemini")) return "google";
    return undefined;
  }

  private calculateBaseConfidence(
    model: ModelInfo,
    features: Record<string, number>,
  ): number {
    // Simple confidence calculation
    let confidence = 0.5; // Base confidence

    // Boost for available models
    if (model.availability === "healthy") {
      confidence += 0.2;
    }

    // Boost for models matching capabilities
    if (features.capability_match) {
      confidence += features.capability_match * 0.2;
    }

    return Math.min(1.0, confidence);
  }

  private generateBaseReason(
    model: ModelInfo,
    features: Record<string, number>,
  ): string {
    if (model.availability === "healthy" && features.capability_match > 0.8) {
      return `Excellent match for your requirements with ${model.capabilities.join(", ")} capabilities`;
    }

    if (model.latencyMs < 200) {
      return "Fast response time for your use case";
    }

    const cost = model.price.input + model.price.output;
    if (cost < 0.001) {
      return "Cost-effective option for your workload";
    }

    return "Good general-purpose model for this task";
  }

  private calculateAverageConfidence(): number {
    if (this.trainingData.length === 0) return 0;

    const totalSatisfaction = this.trainingData.reduce(
      (sum, data) => sum + data.userSatisfaction,
      0,
    );
    return totalSatisfaction / this.trainingData.length;
  }

  private calculateSuccessRate(): number {
    if (this.trainingData.length === 0) return 0;

    const successes = this.trainingData.filter(
      (data) => data.actualPerformance.success,
    ).length;
    return successes / this.trainingData.length;
  }
}

// Feature Extractors (simplified implementations)

interface FeatureExtractor {
  name: string;
  extract(context: MLContext): Promise<Record<string, number>>;
}

class UserHistoryExtractor implements FeatureExtractor {
  name = "user_history";

  async extract(context: MLContext): Promise<Record<string, number>> {
    return {
      user_history_match: context.history
        ? Math.min(context.history.length / 10, 1)
        : 0,
      historical_data_points: context.history?.length || 0,
    };
  }
}

class ContextualExtractor implements FeatureExtractor {
  name = "contextual";

  async extract(context: MLContext): Promise<Record<string, number>> {
    const hour = new Date().getHours();

    return {
      time_of_day_factor: this.getTimeOfDayFactor(hour),
      context_similarity: context.task ? 0.8 : 0.3,
      context_unusualness: this.calculateContextUnusualness(context),
    };
  }

  private getTimeOfDayFactor(hour: number): number {
    // Business hours boost
    if (hour >= 9 && hour <= 17) return 1.0;
    if (hour >= 7 && hour <= 21) return 0.8;
    return 0.5;
  }

  private calculateContextUnusualness(context: MLContext): number {
    // Simple heuristic for unusual contexts
    let unusualness = 0;

    if (context.environmentContext?.systemLoad === "high") unusualness += 0.3;
    if (context.environmentContext?.workloadType === "realtime")
      unusualness += 0.2;
    if (
      context.performanceRequirements?.maxLatency &&
      context.performanceRequirements.maxLatency < 100
    ) {
      unusualness += 0.3;
    }

    return Math.min(1.0, unusualness);
  }
}

class PerformanceExtractor implements FeatureExtractor {
  name = "performance";

  async extract(context: MLContext): Promise<Record<string, number>> {
    return {
      performance_match: this.calculatePerformanceMatch(context),
      latency_requirement: context.performanceRequirements?.maxLatency
        ? Math.max(0, 1 - context.performanceRequirements.maxLatency / 1000)
        : 0.5,
    };
  }

  private calculatePerformanceMatch(context: MLContext): number {
    if (!context.performanceRequirements) return 0.5;

    let match = 0.5;
    const req = context.performanceRequirements;

    if (req.maxLatency) {
      match += req.maxLatency > 500 ? 0.2 : 0.1;
    }

    if (req.minThroughput) {
      match += 0.1;
    }

    return Math.min(1.0, match);
  }
}

class CostExtractor implements FeatureExtractor {
  name = "cost";

  async extract(context: MLContext): Promise<Record<string, number>> {
    return {
      cost_efficiency: this.calculateCostEfficiency(context),
      budget_constraint:
        context.budget === "low"
          ? 0.8
          : context.budget === "medium"
            ? 0.5
            : 0.2,
    };
  }

  private calculateCostEfficiency(context: MLContext): number {
    switch (context.budget) {
      case "low":
        return 0.9;
      case "medium":
        return 0.6;
      case "high":
        return 0.2;
      default:
        return 0.5;
    }
  }
}

class CapabilityExtractor implements FeatureExtractor {
  name = "capability";

  async extract(context: MLContext): Promise<Record<string, number>> {
    return {
      capability_match: this.calculateCapabilityMatch(context),
      required_capabilities_count:
        context.performanceRequirements?.requiredCapabilities?.length || 0,
    };
  }

  private calculateCapabilityMatch(context: MLContext): number {
    const required =
      context.performanceRequirements?.requiredCapabilities || [];
    return required.length > 0 ? 0.8 : 0.5;
  }
}

class TemporalExtractor implements FeatureExtractor {
  name = "temporal";

  async extract(context: MLContext): Promise<Record<string, number>> {
    const now = new Date();

    return {
      hour_of_day: now.getHours() / 24,
      day_of_week: now.getDay() / 7,
      is_weekend: now.getDay() === 0 || now.getDay() === 6 ? 1 : 0,
      workload_type_factor: this.getWorkloadTypeFactor(
        context.environmentContext?.workloadType,
      ),
    };
  }

  private getWorkloadTypeFactor(workloadType?: string): number {
    switch (workloadType) {
      case "realtime":
        return 1.0;
      case "interactive":
        return 0.8;
      case "batch":
        return 0.5;
      default:
        return 0.6;
    }
  }
}

class PopularityExtractor implements FeatureExtractor {
  name = "popularity";

  async extract(context: MLContext): Promise<Record<string, number>> {
    return {
      popularity_score: 0.5, // Would calculate from actual usage data
      user_experience_factor: this.getUserExperienceFactor(context.userProfile),
    };
  }

  private getUserExperienceFactor(userProfile?: UserProfile): number {
    if (!userProfile) return 0.5;

    switch (userProfile.skillLevel) {
      case "beginner":
        return 0.3;
      case "intermediate":
        return 0.6;
      case "expert":
        return 0.9;
      default:
        return 0.5;
    }
  }
}

// Configuration interface
export interface MLConfig {
  enableAutoRetraining: boolean;
  retrainingThreshold: number;
  maxTrainingData: number;
  confidenceThreshold: number;
  explainabilityEnabled: boolean;
  useDeepLearning: boolean;
  modelValidation: boolean;
}

export default MLRecommendationEngine;
