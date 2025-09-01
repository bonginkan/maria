/**
 * Learning-to-Rank Command
 * Provides access to the Phase 5 Learning-to-Rank system with 44-dimension features
 */

import { BaseCommand } from "../../base-command";
import {
  CommandArgs,
  CommandContext,
  CommandResult,
  CommandExample,
} from "../../types";
import { logger } from "../../../utils/logger";

// Import L2R components (would be actual imports in production)
interface L2RFeature {
  name: string;
  category:
    | "lexical"
    | "semantic"
    | "structural"
    | "user"
    | "temporal"
    | "quality";
  importance: number;
  description: string;
  dataType: "numeric" | "boolean" | "categorical";
}

interface L2RTrainingConfig {
  interactionCount?: number;
  model?: "lightgbm" | "xgboost" | "ranknet" | "lambdamart";
  features?: string[];
  validationSplit?: number;
  learningRate?: number;
  maxIterations?: number;
  earlyStoppingRounds?: number;
}

interface L2RTrainingResult {
  modelId: string;
  status: "training" | "completed" | "failed";
  startTime: number;
  duration?: number;
  metrics: {
    nDCG_at_5: number;
    nDCG_at_10: number;
    MRR: number;
    MAP: number;
    trainLoss: number;
    validationLoss: number;
  };
  featureCount: number;
  trainingExamples: number;
  validationExamples: number;
  bestIteration?: number;
}

interface L2RPrediction {
  query: string;
  predictions: Array<{
    documentId: string;
    title: string;
    relevanceScore: number;
    features: Record<string, number>;
    explanation: string;
  }>;
  modelId: string;
  predictionTime: number;
}

interface L2RSystemStatus {
  models: {
    active: L2RTrainingResult[];
    training: L2RTrainingResult[];
    completed: L2RTrainingResult[];
  };
  features: {
    total: number;
    enabled: number;
    categories: Record<string, number>;
  };
  performance: {
    avgPredictionTime: number;
    requestsPerSecond: number;
    memoryUsage: number;
  };
  dataCollection: {
    clicksCollected: number;
    ratingsCollected: number;
    impressionsCollected: number;
    lastUpdate: number;
  };
}

export class L2RCommand extends BaseCommand {
  name = "l2r";
  category = "learning" as const;
  description =
    "🧠 Learning-to-Rank operations with 44-dimension feature system";
  override aliases = ["ltr", "rank", "learn"];
  override usage = "[train|predict|status|features|explain] [options]";

  override examples: CommandExample[] = [
    {
      input: "/l2r train --interactions 1000",
      description: "Train L2R model with 1000 user interactions",
      output: "Started training with LightGBM on 44 features",
    },
    {
      input: '/l2r predict "API documentation security"',
      description: "Predict relevance scores for query",
      output: "Ranked results with relevance scores and feature explanations",
    },
    {
      input: "/l2r status",
      description: "Show L2R system status and model performance",
      output: "Training status, active models, and performance metrics",
    },
    {
      input: "/l2r features --top 10 --category semantic",
      description: "Show top 10 semantic features by importance",
      output: "Feature importance ranking with descriptions",
    },
  ];

  override permissions = {
    requiresAuth: false,
    role: undefined,
  };

  override rateLimit = {
    requests: 20,
    window: "1m",
  };

  // 44-dimension feature set from Phase 5 implementation
  private readonly L2R_FEATURES: L2RFeature[] = [
    // Lexical Features (12)
    {
      name: "bm25_score",
      category: "lexical",
      importance: 0.89,
      description: "BM25 relevance score",
      dataType: "numeric",
    },
    {
      name: "tf_idf_score",
      category: "lexical",
      importance: 0.76,
      description: "TF-IDF similarity score",
      dataType: "numeric",
    },
    {
      name: "exact_match_count",
      category: "lexical",
      importance: 0.82,
      description: "Number of exact query term matches",
      dataType: "numeric",
    },
    {
      name: "phrase_match_count",
      category: "lexical",
      importance: 0.71,
      description: "Number of phrase matches",
      dataType: "numeric",
    },
    {
      name: "term_coverage",
      category: "lexical",
      importance: 0.68,
      description: "Percentage of query terms covered",
      dataType: "numeric",
    },
    {
      name: "query_length_ratio",
      category: "lexical",
      importance: 0.45,
      description: "Query to document length ratio",
      dataType: "numeric",
    },
    {
      name: "edit_distance",
      category: "lexical",
      importance: 0.52,
      description: "Minimum edit distance to query terms",
      dataType: "numeric",
    },
    {
      name: "stemmed_matches",
      category: "lexical",
      importance: 0.61,
      description: "Matches after stemming",
      dataType: "numeric",
    },
    {
      name: "synonym_matches",
      category: "lexical",
      importance: 0.58,
      description: "Synonym-based matches",
      dataType: "numeric",
    },
    {
      name: "acronym_matches",
      category: "lexical",
      importance: 0.49,
      description: "Acronym expansion matches",
      dataType: "numeric",
    },
    {
      name: "fuzzy_matches",
      category: "lexical",
      importance: 0.43,
      description: "Fuzzy string matches",
      dataType: "numeric",
    },
    {
      name: "n_gram_overlap",
      category: "lexical",
      importance: 0.55,
      description: "N-gram overlap score",
      dataType: "numeric",
    },

    // Semantic Features (8)
    {
      name: "vector_similarity",
      category: "semantic",
      importance: 0.91,
      description: "Vector embedding similarity",
      dataType: "numeric",
    },
    {
      name: "semantic_coherence",
      category: "semantic",
      importance: 0.78,
      description: "Semantic coherence score",
      dataType: "numeric",
    },
    {
      name: "topic_alignment",
      category: "semantic",
      importance: 0.73,
      description: "Topic model alignment",
      dataType: "numeric",
    },
    {
      name: "concept_overlap",
      category: "semantic",
      importance: 0.67,
      description: "Named entity/concept overlap",
      dataType: "numeric",
    },
    {
      name: "intent_match",
      category: "semantic",
      importance: 0.84,
      description: "Query intent classification match",
      dataType: "numeric",
    },
    {
      name: "context_similarity",
      category: "semantic",
      importance: 0.69,
      description: "Contextual similarity score",
      dataType: "numeric",
    },
    {
      name: "knowledge_graph_path",
      category: "semantic",
      importance: 0.72,
      description: "KG shortest path distance",
      dataType: "numeric",
    },
    {
      name: "embedding_distance",
      category: "semantic",
      importance: 0.88,
      description: "Cosine distance in embedding space",
      dataType: "numeric",
    },

    // Structural Features (6)
    {
      name: "document_length",
      category: "structural",
      importance: 0.39,
      description: "Document length in tokens",
      dataType: "numeric",
    },
    {
      name: "title_match_score",
      category: "structural",
      importance: 0.86,
      description: "Title relevance score",
      dataType: "numeric",
    },
    {
      name: "heading_match_score",
      category: "structural",
      importance: 0.74,
      description: "Heading relevance score",
      dataType: "numeric",
    },
    {
      name: "metadata_match_score",
      category: "structural",
      importance: 0.51,
      description: "Metadata relevance score",
      dataType: "numeric",
    },
    {
      name: "document_type",
      category: "structural",
      importance: 0.42,
      description: "Document type category",
      dataType: "categorical",
    },
    {
      name: "content_density",
      category: "structural",
      importance: 0.35,
      description: "Content to markup ratio",
      dataType: "numeric",
    },

    // User Features (8)
    {
      name: "click_through_rate",
      category: "user",
      importance: 0.93,
      description: "Historical CTR for this document",
      dataType: "numeric",
    },
    {
      name: "dwell_time_avg",
      category: "user",
      importance: 0.87,
      description: "Average user dwell time",
      dataType: "numeric",
    },
    {
      name: "bounce_rate",
      category: "user",
      importance: 0.64,
      description: "Document bounce rate",
      dataType: "numeric",
    },
    {
      name: "user_rating_avg",
      category: "user",
      importance: 0.81,
      description: "Average user rating",
      dataType: "numeric",
    },
    {
      name: "bookmark_frequency",
      category: "user",
      importance: 0.75,
      description: "How often bookmarked",
      dataType: "numeric",
    },
    {
      name: "share_frequency",
      category: "user",
      importance: 0.68,
      description: "Social sharing frequency",
      dataType: "numeric",
    },
    {
      name: "download_frequency",
      category: "user",
      importance: 0.59,
      description: "Download frequency",
      dataType: "numeric",
    },
    {
      name: "user_expertise_match",
      category: "user",
      importance: 0.72,
      description: "Match to user expertise level",
      dataType: "numeric",
    },

    // Temporal Features (5)
    {
      name: "document_freshness",
      category: "temporal",
      importance: 0.56,
      description: "Document recency score",
      dataType: "numeric",
    },
    {
      name: "last_update_recency",
      category: "temporal",
      importance: 0.48,
      description: "Time since last update",
      dataType: "numeric",
    },
    {
      name: "seasonal_relevance",
      category: "temporal",
      importance: 0.33,
      description: "Seasonal relevance score",
      dataType: "numeric",
    },
    {
      name: "trending_score",
      category: "temporal",
      importance: 0.62,
      description: "Current trending score",
      dataType: "numeric",
    },
    {
      name: "access_pattern_score",
      category: "temporal",
      importance: 0.41,
      description: "Time-based access pattern score",
      dataType: "numeric",
    },

    // Quality Features (5)
    {
      name: "content_quality_score",
      category: "quality",
      importance: 0.79,
      description: "AI-assessed content quality",
      dataType: "numeric",
    },
    {
      name: "readability_score",
      category: "quality",
      importance: 0.53,
      description: "Readability assessment",
      dataType: "numeric",
    },
    {
      name: "authority_score",
      category: "quality",
      importance: 0.77,
      description: "Author/source authority",
      dataType: "numeric",
    },
    {
      name: "completeness_score",
      category: "quality",
      importance: 0.66,
      description: "Content completeness assessment",
      dataType: "numeric",
    },
    {
      name: "accuracy_score",
      category: "quality",
      importance: 0.83,
      description: "Fact-checking accuracy score",
      dataType: "numeric",
    },
  ];

  async execute(
    args: CommandArgs,
    context: CommandContext,
  ): Promise<CommandResult> {
    try {
      const { options, parsed } = args;
      const positional = (parsed["positional"] as string[]) || [];

      const subcommand = positional[0] || "status";

      switch (subcommand.toLowerCase()) {
        case "train":
          return await this.trainL2RModel(options, context);
        case "predict":
          return await this.predictRelevance(
            positional.slice(1).join(" "),
            options,
          );
        case "status":
          return await this.getL2RStatus(options);
        case "features":
          return await this.getFeatureImportance(options);
        case "explain":
          return await this.explainPrediction(
            positional.slice(1).join(" "),
            options,
          );
        default:
          return this.error(
            `Unknown subcommand: ${subcommand}`,
            "INVALID_SUBCOMMAND",
            "Available subcommands: train, predict, status, features, explain",
          );
      }
    } catch (error) {
      logger.error("L2R command failed:", error);
      return this.error(
        "Learning-to-Rank operation failed",
        "L2R_ERROR",
        error instanceof Error ? error.message : "Unknown error occurred",
      );
    }
  }

  /**
   * Train L2R model
   */
  private async trainL2RModel(
    options: Record<string, any>,
    context: CommandContext,
  ): Promise<CommandResult> {
    const config = this.parseTrainingConfig(options);

    // Validate configuration
    const validation = await this.validateTrainingConfig(config);
    if (!validation.success) {
      return this.error(
        validation.error || "Invalid training configuration",
        "CONFIG_ERROR",
      );
    }

    logger.info("Starting L2R model training", {
      config,
      user: context.user?.id,
    });

    const trainingResult = await this.executeTraining(config);
    const formattedOutput = this.formatTrainingStart(trainingResult, config);

    return this.success(formattedOutput, {
      modelId: trainingResult.modelId,
      status: trainingResult.status,
      featureCount: trainingResult.featureCount,
      type: "l2r-training-started",
    });
  }

  /**
   * Predict relevance scores
   */
  private async predictRelevance(
    query: string,
    options: Record<string, any>,
  ): Promise<CommandResult> {
    if (!query || query.trim().length === 0) {
      return this.error(
        "Query is required for prediction",
        "MISSING_QUERY",
        'Usage: /l2r predict "your search query"',
      );
    }

    const prediction = await this.generatePredictions(query, options);
    const formattedOutput = this.formatPredictions(prediction, options);

    return this.success(formattedOutput, {
      query: prediction.query,
      resultCount: prediction.predictions.length,
      modelId: prediction.modelId,
      predictionTime: prediction.predictionTime,
      type: "l2r-predictions",
    });
  }

  /**
   * Get L2R system status
   */
  private async getL2RStatus(
    options: Record<string, any>,
  ): Promise<CommandResult> {
    const status = await this.fetchL2RStatus();
    const formattedOutput = this.formatL2RStatus(status, options);

    return this.success(formattedOutput, {
      activeModels: status.models.active.length,
      totalFeatures: status.features.total,
      avgPredictionTime: status.performance.avgPredictionTime,
      type: "l2r-status",
    });
  }

  /**
   * Get feature importance
   */
  private async getFeatureImportance(
    options: Record<string, any>,
  ): Promise<CommandResult> {
    const topK = parseInt((options["top"] as string) || "20", 10);
    const category = options["category"] as string;

    const features = this.getFilteredFeatures(category, topK);
    const formattedOutput = this.formatFeatureImportance(features, options);

    return this.success(formattedOutput, {
      featureCount: features.length,
      category: category || "all",
      topK,
      type: "l2r-features",
    });
  }

  /**
   * Explain prediction
   */
  private async explainPrediction(
    query: string,
    options: Record<string, any>,
  ): Promise<CommandResult> {
    if (!query) {
      return this.error(
        "Query is required for explanation",
        "MISSING_QUERY",
        'Usage: /l2r explain "your search query"',
      );
    }

    const explanation = await this.generateExplanation(query, options);
    const formattedOutput = this.formatExplanation(explanation);

    return this.success(formattedOutput, {
      query,
      type: "l2r-explanation",
    });
  }

  /**
   * Parse training configuration
   */
  private parseTrainingConfig(options: Record<string, any>): L2RTrainingConfig {
    return {
      interactionCount: parseInt(options["interactions"] || "1000", 10),
      model: (options["model"] || "lightgbm") as
        | "lightgbm"
        | "xgboost"
        | "ranknet"
        | "lambdamart",
      features: options["features"]
        ? (options["features"] as string).split(",")
        : undefined,
      validationSplit: parseFloat(options["validation-split"] || "0.2"),
      learningRate: parseFloat(options["learning-rate"] || "0.1"),
      maxIterations: parseInt(options["max-iterations"] || "1000", 10),
      earlyStoppingRounds: parseInt(options["early-stopping"] || "50", 10),
    };
  }

  /**
   * Validate training configuration
   */
  private async validateTrainingConfig(
    config: L2RTrainingConfig,
  ): Promise<{ success: boolean; error?: string }> {
    if (
      config.interactionCount &&
      (config.interactionCount < 100 || config.interactionCount > 100000)
    ) {
      return {
        success: false,
        error: "Interaction count must be between 100 and 100,000",
      };
    }

    if (
      config.validationSplit &&
      (config.validationSplit < 0.1 || config.validationSplit > 0.5)
    ) {
      return {
        success: false,
        error: "Validation split must be between 0.1 and 0.5",
      };
    }

    if (
      config.learningRate &&
      (config.learningRate < 0.001 || config.learningRate > 1.0)
    ) {
      return {
        success: false,
        error: "Learning rate must be between 0.001 and 1.0",
      };
    }

    const validModels = ["lightgbm", "xgboost", "ranknet", "lambdamart"];
    if (config.model && !validModels.includes(config.model)) {
      return {
        success: false,
        error: `Invalid model. Valid options: ${validModels.join(", ")}`,
      };
    }

    return { success: true };
  }

  /**
   * Execute training (mock implementation)
   */
  private async executeTraining(
    config: L2RTrainingConfig,
  ): Promise<L2RTrainingResult> {
    await new Promise((resolve) => setTimeout(resolve, 800));

    return {
      modelId: `l2r_${Math.random().toString(36).substr(2, 9)}`,
      status: "training",
      startTime: Date.now(),
      metrics: {
        nDCG_at_5: 0.0,
        nDCG_at_10: 0.0,
        MRR: 0.0,
        MAP: 0.0,
        trainLoss: 0.0,
        validationLoss: 0.0,
      },
      featureCount: config.features ? config.features.length : 44,
      trainingExamples: Math.floor((config.interactionCount || 1000) * 0.8),
      validationExamples: Math.floor((config.interactionCount || 1000) * 0.2),
    };
  }

  /**
   * Generate predictions (mock implementation)
   */
  private async generatePredictions(
    query: string,
    _options: Record<string, any>,
  ): Promise<L2RPrediction> {
    const startTime = Date.now();

    // Simulate prediction time
    await new Promise((resolve) =>
      setTimeout(resolve, 150 + Math.random() * 100),
    );

    const predictions = [
      {
        documentId: "doc_001",
        title: "API Security Best Practices Guide",
        relevanceScore: 0.92,
        features: {
          bm25_score: 0.85,
          vector_similarity: 0.89,
          click_through_rate: 0.15,
          title_match_score: 0.95,
          content_quality_score: 0.88,
        },
        explanation:
          "High relevance due to strong semantic match and excellent user engagement",
      },
      {
        documentId: "doc_002",
        title: "Database Security Implementation",
        relevanceScore: 0.78,
        features: {
          bm25_score: 0.72,
          vector_similarity: 0.74,
          click_through_rate: 0.08,
          title_match_score: 0.68,
          content_quality_score: 0.82,
        },
        explanation:
          "Moderate relevance with good semantic similarity but lower user engagement",
      },
      {
        documentId: "doc_003",
        title: "Security Compliance Framework",
        relevanceScore: 0.65,
        features: {
          bm25_score: 0.58,
          vector_similarity: 0.71,
          click_through_rate: 0.12,
          title_match_score: 0.52,
          content_quality_score: 0.79,
        },
        explanation:
          "Related content with moderate semantic match and average user behavior",
      },
    ];

    return {
      query,
      predictions,
      modelId: "l2r_production_v2_3",
      predictionTime: Date.now() - startTime,
    };
  }

  /**
   * Fetch L2R system status
   */
  private async fetchL2RStatus(): Promise<L2RSystemStatus> {
    return {
      models: {
        active: [
          {
            modelId: "l2r_production_v2_3",
            status: "completed",
            startTime: Date.now() - 3600000,
            duration: 1847,
            metrics: {
              nDCG_at_5: 0.782,
              nDCG_at_10: 0.739,
              MRR: 0.801,
              MAP: 0.723,
              trainLoss: 0.245,
              validationLoss: 0.289,
            },
            featureCount: 44,
            trainingExamples: 8000,
            validationExamples: 2000,
            bestIteration: 847,
          },
        ],
        training: [
          {
            modelId: "l2r_experimental_v3_0",
            status: "training",
            startTime: Date.now() - 600000,
            metrics: {
              nDCG_at_5: 0.721,
              nDCG_at_10: 0.689,
              MRR: 0.754,
              MAP: 0.692,
              trainLoss: 0.312,
              validationLoss: 0.345,
            },
            featureCount: 44,
            trainingExamples: 12000,
            validationExamples: 3000,
          },
        ],
        completed: [],
      },
      features: {
        total: 44,
        enabled: 42,
        categories: {
          lexical: 12,
          semantic: 8,
          structural: 6,
          user: 8,
          temporal: 5,
          quality: 5,
        },
      },
      performance: {
        avgPredictionTime: 187.5,
        requestsPerSecond: 45.2,
        memoryUsage: 2.1,
      },
      dataCollection: {
        clicksCollected: 15432,
        ratingsCollected: 2847,
        impressionsCollected: 89341,
        lastUpdate: Date.now() - 300000,
      },
    };
  }

  /**
   * Get filtered features
   */
  private getFilteredFeatures(category?: string, topK?: number): L2RFeature[] {
    let features = [...this.L2R_FEATURES];

    if (category) {
      features = features.filter((f) => f.category === category);
    }

    features.sort((a, b) => b.importance - a.importance);

    if (topK) {
      features = features.slice(0, topK);
    }

    return features;
  }

  /**
   * Generate explanation
   */
  private async generateExplanation(
    query: string,
    options: Record<string, any>,
  ): Promise<any> {
    const prediction = await this.generatePredictions(query, options);

    return {
      query,
      topResult: prediction.predictions[0],
      featureBreakdown: {
        mostImportant: [
          "vector_similarity",
          "title_match_score",
          "click_through_rate",
        ],
        contributingFactors: {
          semantic: 0.35,
          lexical: 0.28,
          user: 0.22,
          structural: 0.15,
        },
        decisionPath: [
          "High semantic similarity (0.89) strongly indicates relevance",
          "Excellent title match (0.95) reinforces topical alignment",
          "Strong user engagement (CTR: 0.15) validates practical value",
          "High content quality (0.88) ensures reliable information",
        ],
      },
      modelInfo: {
        modelType: "LightGBM",
        featureCount: 44,
        version: "v2.3",
        accuracy: 0.782,
      },
    };
  }

  // Formatting methods...

  /**
   * Format training start message
   */
  private formatTrainingStart(
    result: L2RTrainingResult,
    config: L2RTrainingConfig,
  ): string {
    const lines: string[] = [];

    lines.push("");
    lines.push("🧠 L2R MODEL TRAINING STARTED");
    lines.push("═".repeat(45));
    lines.push("");
    lines.push(`Model ID: ${result.modelId}`);
    lines.push(`Algorithm: ${config.model?.toUpperCase() || "LightGBM"}`);
    lines.push(`Features: ${result.featureCount} dimensions`);
    lines.push(
      `Training Examples: ${result.trainingExamples.toLocaleString()}`,
    );
    lines.push(
      `Validation Examples: ${result.validationExamples.toLocaleString()}`,
    );
    lines.push(`Status: ${result.status.toUpperCase()}`);
    lines.push("");
    lines.push("⚙️ **Training Configuration:**");
    lines.push(`  Learning Rate: ${config.learningRate}`);
    lines.push(`  Max Iterations: ${config.maxIterations}`);
    lines.push(`  Early Stopping: ${config.earlyStoppingRounds} rounds`);
    lines.push(
      `  Validation Split: ${(config.validationSplit! * 100).toFixed(0)}%`,
    );
    lines.push("");
    lines.push("📊 **Feature Categories:**");
    lines.push("  • Lexical (12): BM25, TF-IDF, exact matches");
    lines.push("  • Semantic (8): Vector similarity, topic alignment");
    lines.push("  • User (8): CTR, dwell time, ratings");
    lines.push("  • Quality (5): Content quality, authority");
    lines.push("");
    lines.push("💡 Use `/l2r status` to monitor training progress");

    return lines.join("\n");
  }

  /**
   * Format predictions
   */
  private formatPredictions(
    prediction: L2RPrediction,
    options: Record<string, any>,
  ): string {
    const lines: string[] = [];
    const verbose = options["verbose"] || false;

    lines.push("");
    lines.push("🎯 L2R RELEVANCE PREDICTIONS");
    lines.push("═".repeat(50));
    lines.push("");
    lines.push(`Query: "${prediction.query}"`);
    lines.push(`Model: ${prediction.modelId}`);
    lines.push(`Prediction Time: ${prediction.predictionTime}ms`);
    lines.push(`Results: ${prediction.predictions.length}`);
    lines.push("");

    for (let i = 0; i < prediction.predictions.length; i++) {
      const pred = prediction.predictions[i];
      lines.push(
        `**${i + 1}. ${pred.title}** (Score: ${pred.relevanceScore.toFixed(3)})`,
      );
      lines.push(`   ${pred.explanation}`);

      if (verbose) {
        lines.push(`   Key Features:`);
        lines.push(`     BM25: ${pred.features.bm25_score.toFixed(3)}`);
        lines.push(
          `     Vector: ${pred.features.vector_similarity.toFixed(3)}`,
        );
        lines.push(`     CTR: ${pred.features.click_through_rate.toFixed(3)}`);
        lines.push(
          `     Title Match: ${pred.features.title_match_score.toFixed(3)}`,
        );
      }

      lines.push("");
    }

    return lines.join("\n");
  }

  /**
   * Format L2R status
   */
  private formatL2RStatus(
    status: L2RSystemStatus,
    _options: Record<string, any>,
  ): string {
    const lines: string[] = [];

    lines.push("");
    lines.push("🧠 L2R SYSTEM STATUS");
    lines.push("═".repeat(40));
    lines.push("");

    // Active models
    lines.push(`🚀 **Active Models (${status.models.active.length}):**`);
    for (const model of status.models.active) {
      lines.push(`  • ${model.modelId}`);
      lines.push(`    nDCG@5: ${model.metrics.nDCG_at_5.toFixed(3)}`);
      lines.push(`    Features: ${model.featureCount}`);
      lines.push(
        `    Training Examples: ${model.trainingExamples.toLocaleString()}`,
      );
    }
    lines.push("");

    // Training models
    if (status.models.training.length > 0) {
      lines.push(`⚡ **Training Models (${status.models.training.length}):**`);
      for (const model of status.models.training) {
        const elapsed = Math.round((Date.now() - model.startTime) / 60000);
        lines.push(`  • ${model.modelId} - ${elapsed}m elapsed`);
        lines.push(`    Current nDCG@5: ${model.metrics.nDCG_at_5.toFixed(3)}`);
        lines.push(`    Training Loss: ${model.metrics.trainLoss.toFixed(3)}`);
      }
      lines.push("");
    }

    // Features
    lines.push("🎯 **Feature System:**");
    lines.push(
      `  Total Features: ${status.features.total} (${status.features.enabled} enabled)`,
    );
    lines.push("  Categories:");
    for (const [category, count] of Object.entries(
      status.features.categories,
    )) {
      lines.push(`    ${category}: ${count}`);
    }
    lines.push("");

    // Performance
    lines.push("⚡ **Performance Metrics:**");
    lines.push(
      `  Avg Prediction Time: ${status.performance.avgPredictionTime.toFixed(1)}ms`,
    );
    lines.push(
      `  Requests/Second: ${status.performance.requestsPerSecond.toFixed(1)}`,
    );
    lines.push(
      `  Memory Usage: ${status.performance.memoryUsage.toFixed(1)}GB`,
    );
    lines.push("");

    // Data collection
    lines.push("📊 **Data Collection:**");
    lines.push(
      `  Clicks: ${status.dataCollection.clicksCollected.toLocaleString()}`,
    );
    lines.push(
      `  Ratings: ${status.dataCollection.ratingsCollected.toLocaleString()}`,
    );
    lines.push(
      `  Impressions: ${status.dataCollection.impressionsCollected.toLocaleString()}`,
    );
    const lastUpdateMin = Math.round(
      (Date.now() - status.dataCollection.lastUpdate) / 60000,
    );
    lines.push(`  Last Update: ${lastUpdateMin}m ago`);

    return lines.join("\n");
  }

  /**
   * Format feature importance
   */
  private formatFeatureImportance(
    features: L2RFeature[],
    options: Record<string, any>,
  ): string {
    const lines: string[] = [];
    const verbose = options["verbose"] || false;

    lines.push("");
    lines.push("🎯 L2R FEATURE IMPORTANCE");
    lines.push("═".repeat(50));
    lines.push("");
    lines.push(`Showing top ${features.length} features`);
    if (options["category"]) {
      lines.push(`Category: ${options["category"].toUpperCase()}`);
    }
    lines.push("");

    for (let i = 0; i < features.length; i++) {
      const feature = features[i];
      const bar = "█".repeat(Math.round(feature.importance * 20));
      const categoryIcon = this.getCategoryIcon(feature.category);

      lines.push(`**${i + 1}. ${feature.name}** ${categoryIcon}`);
      lines.push(`   Importance: ${feature.importance.toFixed(3)} ${bar}`);
      if (verbose) {
        lines.push(`   Description: ${feature.description}`);
        lines.push(`   Category: ${feature.category}`);
        lines.push(`   Type: ${feature.dataType}`);
      }
      lines.push("");
    }

    lines.push("📈 **Category Breakdown:**");
    const categoryCount = features.reduce(
      (acc, f) => {
        acc[f.category] = (acc[f.category] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    for (const [category, count] of Object.entries(categoryCount)) {
      const icon = this.getCategoryIcon(category);
      lines.push(`  ${icon} ${category}: ${count} features`);
    }

    return lines.join("\n");
  }

  /**
   * Format explanation
   */
  private formatExplanation(explanation: any): string {
    const lines: string[] = [];

    lines.push("");
    lines.push("🔍 L2R PREDICTION EXPLANATION");
    lines.push("═".repeat(50));
    lines.push("");
    lines.push(`Query: "${explanation.query}"`);
    lines.push(`Top Result: ${explanation.topResult.title}`);
    lines.push(
      `Relevance Score: ${explanation.topResult.relevanceScore.toFixed(3)}`,
    );
    lines.push("");

    lines.push("🎯 **Decision Factors:**");
    for (const [category, weight] of Object.entries(
      explanation.featureBreakdown.contributingFactors,
    )) {
      const percentage = ((weight as number) * 100).toFixed(0);
      lines.push(`  ${category}: ${percentage}% contribution`);
    }
    lines.push("");

    lines.push("🧠 **Decision Path:**");
    for (let i = 0; i < explanation.featureBreakdown.decisionPath.length; i++) {
      lines.push(`  ${i + 1}. ${explanation.featureBreakdown.decisionPath[i]}`);
    }
    lines.push("");

    lines.push("🤖 **Model Information:**");
    lines.push(`  Algorithm: ${explanation.modelInfo.modelType}`);
    lines.push(`  Features: ${explanation.modelInfo.featureCount}`);
    lines.push(`  Version: ${explanation.modelInfo.version}`);
    lines.push(`  Accuracy: ${explanation.modelInfo.accuracy.toFixed(3)}`);

    return lines.join("\n");
  }

  /**
   * Get category icon
   */
  private getCategoryIcon(category: string): string {
    const icons: Record<string, string> = {
      lexical: "📝",
      semantic: "🧠",
      structural: "🏗️",
      user: "👤",
      temporal: "⏰",
      quality: "⭐",
    };
    return icons[category] || "📊";
  }

  /**
   * Command validation
   */
  override async validate(
    args: CommandArgs,
  ): Promise<{ success: boolean; error?: string }> {
    const { parsed, options } = args;
    const positional = (parsed["positional"] as string[]) || [];
    const subcommand = positional[0];

    if (
      subcommand &&
      !["train", "predict", "status", "features", "explain"].includes(
        subcommand.toLowerCase(),
      )
    ) {
      return {
        success: false,
        error:
          "Invalid subcommand. Available: train, predict, status, features, explain",
      };
    }

    // Validate numerical options
    const numericOptions = [
      "interactions",
      "top",
      "validation-split",
      "learning-rate",
      "max-iterations",
      "early-stopping",
    ];
    for (const opt of numericOptions) {
      if (options[opt] && isNaN(Number(options[opt]))) {
        return {
          success: false,
          error: `${opt} must be a number`,
        };
      }
    }

    return { success: true };
  }
}

// Command metadata for manifest generation
export const meta = {
  name: 'l2r',
  category: 'learning',
  description: '🎯 Learning-to-Rank system with 44-dimension features and model training *GPU needed - Local LLM only (Pro+ members only)',
  aliases: ['rank', 'learn', 'train'],
  usage: '[features|train|status|tune] [--model <type>] [--features <list>] [--config <path>]',
  examples: [
    '/l2r features',
    '/l2r train --model lightgbm',
    '/l2r status --model-id abc123',
    '/l2r tune --interactions 1000'
  ],
  deps: [],
  status: 'stable' as const
};

// Export both as default and named export for flexibility
export default L2RCommand;
