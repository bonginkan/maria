/**
 * Model Selector v2 - Predictive Analytics Engine
 * Advanced forecasting, anomaly detection, and capacity planning
 */

import { EventEmitter } from "node:events";

export interface TimeWindow {
  start: Date;
  end: Date;
  granularity: "minute" | "hour" | "day" | "week" | "month";
}

export interface TimeSeries {
  timestamps: Date[];
  values: number[];
  metric: string;
  modelId?: string;
  userId?: string;
}

export interface UsageForecast {
  metric: string;
  timeWindow: TimeWindow;
  predictions: Array<{
    timestamp: Date;
    predicted: number;
    confidence: number;
    lower_bound: number;
    upper_bound: number;
  }>;
  model: {
    type: string;
    accuracy: number;
    mape: number; // Mean Absolute Percentage Error
  };
  trends: {
    overall: "increasing" | "decreasing" | "stable";
    seasonal: boolean;
    changePoints: Date[];
  };
  metadata: {
    dataPoints: number;
    trainingPeriod: TimeWindow;
    lastUpdated: Date;
  };
}

export interface CostScenario {
  name: string;
  description: string;
  timeframe: TimeWindow;
  assumptions: {
    usageGrowthRate: number; // Monthly growth rate
    modelMix: Record<string, number>; // Model usage distribution
    pricingChanges?: Array<{
      modelId: string;
      currentPrice: number;
      newPrice: number;
      effectiveDate: Date;
    }>;
  };
  variables: {
    marketFactors: number; // Market demand impact
    seasonalityFactor: number;
    competitorResponse: number;
  };
}

export interface CostForecast {
  scenario: CostScenario;
  totalCost: number;
  breakdown: {
    byModel: Record<string, number>;
    byTimeframe: Array<{
      period: string;
      cost: number;
      usage: number;
    }>;
    byCategory: Record<string, number>;
  };
  projections: Array<{
    date: Date;
    cost: number;
    usage: number;
    confidence: number;
  }>;
  insights: {
    costDrivers: Array<{ factor: string; impact: number; description: string }>;
    optimizationOpportunities: Array<{
      opportunity: string;
      potential_savings: number;
    }>;
    risks: Array<{ risk: string; impact: number; mitigation: string }>;
  };
  recommendations: string[];
}

export interface Anomaly {
  id: string;
  timestamp: Date;
  metric: string;
  actualValue: number;
  expectedValue: number;
  deviation: number;
  severity: "low" | "medium" | "high" | "critical";
  type: "spike" | "drop" | "trend_change" | "pattern_break" | "outlier";
  confidence: number;
  context: {
    modelId?: string;
    userId?: string;
    relatedAnomalies?: string[];
  };
  explanation: string;
  suggestedActions: string[];
}

export interface CapacityPlan {
  timeframe: TimeWindow;
  currentCapacity: Record<string, number>;
  projectedDemand: Array<{
    date: Date;
    demand: Record<string, number>;
    confidence: number;
  }>;
  recommendations: Array<{
    action:
      | "scale_up"
      | "scale_down"
      | "add_model"
      | "remove_model"
      | "redistribute";
    target: string;
    timeline: string;
    justification: string;
    cost_impact: number;
  }>;
  constraints: {
    budget: number;
    technical: string[];
    business: string[];
  };
  scenarios: Array<{
    name: string;
    probability: number;
    impact: Record<string, number>;
    response_plan: string[];
  }>;
}

export interface PredictiveConfig {
  forecasting: {
    models: ("linear_regression" | "arima" | "prophet" | "lstm")[];
    lookAheadPeriods: number;
    confidenceLevel: number;
    updateFrequency: number; // minutes
  };
  anomalyDetection: {
    algorithms: ("statistical" | "isolation_forest" | "lstm" | "dbscan")[];
    sensitivityLevel: number; // 0-1, higher = more sensitive
    minAnomalyDuration: number; // minutes
    correlationAnalysis: boolean;
  };
  capacityPlanning: {
    planningHorizon: number; // days
    safetyBuffer: number; // percentage
    costOptimization: boolean;
    autoScaling: boolean;
  };
}

export interface PredictionMetrics {
  forecasts: {
    total: number;
    accuracy: number;
    mape: number;
    lastUpdate: Date;
  };
  anomalies: {
    detected: number;
    falsePositives: number;
    truePositives: number;
    precision: number;
    recall: number;
  };
  capacity: {
    utilizationRate: number;
    overProvisioningCost: number;
    underProvisioningRisk: number;
    optimizationScore: number;
  };
}

export class PredictiveAnalytics extends EventEmitter {
  private config: PredictiveConfig;
  private timeSeries: Map<string, TimeSeries> = new Map();
  private forecastCache: Map<string, UsageForecast> = new Map();
  private anomalyHistory: Anomaly[] = [];
  private capacityPlans: Map<string, CapacityPlan> = new Map();

  // Model state
  private forecastModels: Map<string, any> = new Map();
  private anomalyDetectors: Map<string, any> = new Map();
  private lastModelUpdate?: Date;

  // Performance tracking
  private predictionAccuracy: Map<string, number[]> = new Map();
  private anomalyFeedback: Map<
    string,
    { isAnomaly: boolean; feedback: string }
  > = new Map();

  constructor(config: Partial<PredictiveConfig> = {}) {
    super();

    this.config = {
      forecasting: {
        models: ["linear_regression", "arima"],
        lookAheadPeriods: 168, // 1 week in hours
        confidenceLevel: 0.95,
        updateFrequency: 60, // 1 hour
      },
      anomalyDetection: {
        algorithms: ["statistical", "isolation_forest"],
        sensitivityLevel: 0.7,
        minAnomalyDuration: 5,
        correlationAnalysis: true,
      },
      capacityPlanning: {
        planningHorizon: 30, // 30 days
        safetyBuffer: 0.2, // 20% buffer
        costOptimization: true,
        autoScaling: true,
      },
      ...config,
    };

    this.startPredictionUpdates();
  }

  /**
   * Predict usage for specified timeframe
   */
  async predictUsage(timeframe: TimeWindow): Promise<UsageForecast> {
    const cacheKey = this.generateCacheKey("usage", timeframe);
    const cached = this.forecastCache.get(cacheKey);

    if (cached && this.isForecastValid(cached)) {
      return cached;
    }

    try {
      const forecast = await this.generateUsageForecast(timeframe);
      this.forecastCache.set(cacheKey, forecast);

      this.emit("usage_forecast_generated", {
        timeframe,
        accuracy: forecast.model.accuracy,
        dataPoints: forecast.metadata.dataPoints,
      });

      return forecast;
    } catch (error) {
      this.emit("forecast_error", {
        error: error instanceof Error ? error.message : "Unknown error",
        timeframe,
      });
      throw error;
    }
  }

  /**
   * Detect anomalies in time series data
   */
  async detectAnomalies(metrics: TimeSeries): Promise<Anomaly[]> {
    const startTime = performance.now();

    try {
      // Store time series for future analysis
      this.timeSeries.set(`${metrics.metric}_${Date.now()}`, metrics);

      const anomalies: Anomaly[] = [];

      // Apply multiple detection algorithms
      for (const algorithm of this.config.anomalyDetection.algorithms) {
        const detected = await this.runAnomalyDetection(metrics, algorithm);
        anomalies.push(...detected);
      }

      // Remove duplicates and apply correlation analysis
      const uniqueAnomalies = this.deduplicateAnomalies(anomalies);

      if (this.config.anomalyDetection.correlationAnalysis) {
        await this.correlateAnomalies(uniqueAnomalies);
      }

      // Store anomalies
      this.anomalyHistory.push(...uniqueAnomalies);

      // Keep anomaly history limited
      if (this.anomalyHistory.length > 1000) {
        this.anomalyHistory = this.anomalyHistory.slice(-1000);
      }

      const duration = performance.now() - startTime;

      this.emit("anomalies_detected", {
        metric: metrics.metric,
        anomaliesFound: uniqueAnomalies.length,
        duration,
        algorithms: this.config.anomalyDetection.algorithms,
      });

      return uniqueAnomalies;
    } catch (error) {
      this.emit("anomaly_detection_error", {
        error: error instanceof Error ? error.message : "Unknown error",
        metric: metrics.metric,
      });
      throw error;
    }
  }

  /**
   * Generate cost forecast based on scenario
   */
  async forecastCosts(scenario: CostScenario): Promise<CostForecast> {
    const startTime = performance.now();

    try {
      const forecast = await this.generateCostForecast(scenario);

      const duration = performance.now() - startTime;

      this.emit("cost_forecast_generated", {
        scenario: scenario.name,
        totalCost: forecast.totalCost,
        duration,
        recommendations: forecast.recommendations.length,
      });

      return forecast;
    } catch (error) {
      this.emit("cost_forecast_error", {
        error: error instanceof Error ? error.message : "Unknown error",
        scenario: scenario.name,
      });
      throw error;
    }
  }

  /**
   * Generate capacity planning recommendations
   */
  async planCapacity(constraints: {
    budget: number;
    timeframe: TimeWindow;
  }): Promise<CapacityPlan> {
    const startTime = performance.now();

    try {
      const plan = await this.generateCapacityPlan(constraints);

      this.capacityPlans.set(plan.timeframe.start.toISOString(), plan);

      const duration = performance.now() - startTime;

      this.emit("capacity_plan_generated", {
        timeframe: constraints.timeframe,
        recommendations: plan.recommendations.length,
        budget: constraints.budget,
        duration,
      });

      return plan;
    } catch (error) {
      this.emit("capacity_planning_error", {
        error: error instanceof Error ? error.message : "Unknown error",
        constraints,
      });
      throw error;
    }
  }

  /**
   * Update historical data for predictions
   */
  async updateHistoricalData(data: TimeSeries[]): Promise<{
    seriesUpdated: number;
    forecastsInvalidated: number;
  }> {
    let seriesUpdated = 0;
    let forecastsInvalidated = 0;

    for (const series of data) {
      const key = `${series.metric}_${series.modelId || "global"}`;

      // Update or add time series
      if (this.timeSeries.has(key)) {
        const existing = this.timeSeries.get(key)!;
        const combined = this.combineTimeSeries(existing, series);
        this.timeSeries.set(key, combined);
      } else {
        this.timeSeries.set(key, series);
      }

      seriesUpdated++;

      // Invalidate related forecasts
      const invalidated = this.invalidateForecasts(series.metric);
      forecastsInvalidated += invalidated;
    }

    // Retrain models if significant data update
    if (seriesUpdated > 5) {
      await this.retrainModels();
    }

    this.emit("historical_data_updated", {
      seriesUpdated,
      forecastsInvalidated,
      totalSeries: this.timeSeries.size,
    });

    return { seriesUpdated, forecastsInvalidated };
  }

  /**
   * Get prediction performance metrics
   */
  getPredictionMetrics(): PredictionMetrics {
    const forecasts = Array.from(this.forecastCache.values());
    const totalForecasts = forecasts.length;
    const avgAccuracy =
      totalForecasts > 0
        ? forecasts.reduce((sum, f) => sum + f.model.accuracy, 0) /
          totalForecasts
        : 0;
    const avgMAPE =
      totalForecasts > 0
        ? forecasts.reduce((sum, f) => sum + f.model.mape, 0) / totalForecasts
        : 0;

    // Calculate anomaly detection metrics
    const anomaliesWithFeedback = this.anomalyHistory.filter((a) =>
      this.anomalyFeedback.has(a.id),
    );

    const truePositives = anomaliesWithFeedback.filter(
      (a) => this.anomalyFeedback.get(a.id)?.isAnomaly === true,
    ).length;

    const falsePositives = anomaliesWithFeedback.filter(
      (a) => this.anomalyFeedback.get(a.id)?.isAnomaly === false,
    ).length;

    const precision =
      anomaliesWithFeedback.length > 0
        ? truePositives / anomaliesWithFeedback.length
        : 0;

    const recall = truePositives / Math.max(1, truePositives + falsePositives);

    return {
      forecasts: {
        total: totalForecasts,
        accuracy: avgAccuracy,
        mape: avgMAPE,
        lastUpdate: this.lastModelUpdate || new Date(),
      },
      anomalies: {
        detected: this.anomalyHistory.length,
        falsePositives,
        truePositives,
        precision,
        recall,
      },
      capacity: {
        utilizationRate: this.calculateUtilizationRate(),
        overProvisioningCost: this.calculateOverProvisioningCost(),
        underProvisioningRisk: this.calculateUnderProvisioningRisk(),
        optimizationScore: this.calculateOptimizationScore(),
      },
    };
  }

  /**
   * Provide feedback on anomaly detection
   */
  async provideAnomalyFeedback(
    anomalyId: string,
    feedback: { isAnomaly: boolean; comments?: string },
  ): Promise<void> {
    this.anomalyFeedback.set(anomalyId, {
      isAnomaly: feedback.isAnomaly,
      feedback: feedback.comments || "",
    });

    // Update anomaly detection models based on feedback
    await this.incorporateFeedback(anomalyId, feedback);

    this.emit("anomaly_feedback_received", {
      anomalyId,
      isAnomaly: feedback.isAnomaly,
      totalFeedback: this.anomalyFeedback.size,
    });
  }

  // Private methods

  private async generateUsageForecast(
    timeframe: TimeWindow,
  ): Promise<UsageForecast> {
    // Get relevant time series data
    const relevantSeries = this.getRelevantTimeSeries("usage", timeframe);

    if (relevantSeries.length === 0) {
      throw new Error("Insufficient historical data for forecasting");
    }

    // Apply forecasting models
    const predictions: Array<{
      timestamp: Date;
      predicted: number;
      confidence: number;
      lower_bound: number;
      upper_bound: number;
    }> = [];
    const periods = this.generatePeriods(timeframe);

    for (const period of periods) {
      const predicted = this.predictSinglePoint(relevantSeries, period);
      predictions.push(predicted);
    }

    // Analyze trends
    const trends = this.analyzeTrends(relevantSeries, predictions);

    return {
      metric: "usage",
      timeWindow: timeframe,
      predictions,
      model: {
        type: "ensemble",
        accuracy: 0.85, // Would calculate from historical performance
        mape: 15.2,
      },
      trends,
      metadata: {
        dataPoints: relevantSeries.reduce((sum, s) => sum + s.values.length, 0),
        trainingPeriod: {
          start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
          end: new Date(),
          granularity: timeframe.granularity,
        },
        lastUpdated: new Date(),
      },
    };
  }

  private async runAnomalyDetection(
    metrics: TimeSeries,
    algorithm: string,
  ): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = [];

    switch (algorithm) {
      case "statistical":
        return this.statisticalAnomalyDetection(metrics);

      case "isolation_forest":
        return this.isolationForestAnomalyDetection(metrics);

      case "lstm":
        return this.lstmAnomalyDetection(metrics);

      case "dbscan":
        return this.dbscanAnomalyDetection(metrics);

      default:
        return this.statisticalAnomalyDetection(metrics);
    }
  }

  private statisticalAnomalyDetection(metrics: TimeSeries): Anomaly[] {
    const anomalies: Anomaly[] = [];
    const values = metrics.values;

    if (values.length < 10) return anomalies; // Need minimum data

    // Calculate statistical thresholds
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance =
      values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      values.length;
    const stdDev = Math.sqrt(variance);
    const threshold = 2 * stdDev; // 2-sigma threshold

    for (let i = 0; i < values.length; i++) {
      const value = values[i];
      const deviation = Math.abs(value - mean);

      if (deviation > threshold) {
        const severity =
          deviation > 3 * stdDev
            ? "critical"
            : deviation > 2.5 * stdDev
              ? "high"
              : deviation > 2 * stdDev
                ? "medium"
                : "low";

        const anomaly: Anomaly = {
          id: `stat_${Date.now()}_${i}`,
          timestamp: metrics.timestamps[i],
          metric: metrics.metric,
          actualValue: value,
          expectedValue: mean,
          deviation,
          severity,
          type: value > mean + threshold ? "spike" : "drop",
          confidence: Math.min(0.99, deviation / threshold),
          context: {
            modelId: metrics.modelId,
            userId: metrics.userId,
          },
          explanation: `Statistical anomaly: value ${value.toFixed(2)} deviates ${deviation.toFixed(2)} from mean ${mean.toFixed(2)} (${(deviation / stdDev).toFixed(1)}σ)`,
          suggestedActions: this.generateAnomalyActions(value, mean, severity),
        };

        anomalies.push(anomaly);
      }
    }

    return anomalies;
  }

  private isolationForestAnomalyDetection(metrics: TimeSeries): Anomaly[] {
    // Simplified isolation forest implementation
    const anomalies: Anomaly[] = [];
    const values = metrics.values;

    if (values.length < 20) return anomalies;

    // Create feature matrix (value, moving average, trend)
    const features = values.map((value, i) => {
      const windowSize = Math.min(5, i + 1);
      const window = values.slice(Math.max(0, i - windowSize + 1), i + 1);
      const movingAvg = window.reduce((sum, v) => sum + v, 0) / window.length;
      const trend = i > 0 ? value - values[i - 1] : 0;

      return [value, movingAvg, trend];
    });

    // Simple isolation scoring (simplified)
    for (let i = 0; i < features.length; i++) {
      const isolationScore = this.calculateIsolationScore(
        features[i],
        features,
      );

      if (isolationScore > 0.7) {
        // Threshold for anomaly
        const anomaly: Anomaly = {
          id: `iso_${Date.now()}_${i}`,
          timestamp: metrics.timestamps[i],
          metric: metrics.metric,
          actualValue: values[i],
          expectedValue: features[i][1], // Moving average as expected
          deviation: Math.abs(values[i] - features[i][1]),
          severity:
            isolationScore > 0.9
              ? "critical"
              : isolationScore > 0.8
                ? "high"
                : "medium",
          type: "outlier",
          confidence: isolationScore,
          context: {
            modelId: metrics.modelId,
            userId: metrics.userId,
          },
          explanation: `Isolation forest detected outlier with isolation score ${isolationScore.toFixed(3)}`,
          suggestedActions: [
            "Investigate root cause",
            "Check for data quality issues",
          ],
        };

        anomalies.push(anomaly);
      }
    }

    return anomalies;
  }

  private lstmAnomalyDetection(metrics: TimeSeries): Anomaly[] {
    // Placeholder for LSTM-based anomaly detection
    // In production, would use actual LSTM model
    return this.statisticalAnomalyDetection(metrics);
  }

  private dbscanAnomalyDetection(metrics: TimeSeries): Anomaly[] {
    // Placeholder for DBSCAN clustering-based anomaly detection
    // In production, would implement actual DBSCAN algorithm
    return this.statisticalAnomalyDetection(metrics);
  }

  private async generateCostForecast(
    scenario: CostScenario,
  ): Promise<CostForecast> {
    const projections: Array<{
      date: Date;
      cost: number;
      usage: number;
      confidence: number;
    }> = [];

    // Generate projections for each period
    const periods = this.generatePeriods(scenario.timeframe);
    let totalCost = 0;

    for (const period of periods) {
      const usage = this.projectUsage(period, scenario);
      const cost = this.calculateCostForUsage(usage, scenario);
      const confidence = this.calculateProjectionConfidence(period, scenario);

      projections.push({
        date: period,
        cost,
        usage,
        confidence,
      });

      totalCost += cost;
    }

    // Generate breakdown
    const breakdown = {
      byModel: this.calculateCostByModel(projections, scenario),
      byTimeframe: this.calculateCostByTimeframe(projections),
      byCategory: this.calculateCostByCategory(projections),
    };

    // Generate insights
    const insights = {
      costDrivers: this.identifyCostDrivers(scenario, projections),
      optimizationOpportunities: this.identifyOptimizationOpportunities(
        scenario,
        projections,
      ),
      risks: this.identifyRisks(scenario, projections),
    };

    return {
      scenario,
      totalCost,
      breakdown,
      projections,
      insights,
      recommendations: this.generateCostRecommendations(insights, scenario),
    };
  }

  private async generateCapacityPlan(constraints: {
    budget: number;
    timeframe: TimeWindow;
  }): Promise<CapacityPlan> {
    // Get current capacity
    const currentCapacity = this.getCurrentCapacity();

    // Project demand
    const projectedDemand = await this.projectDemand(constraints.timeframe);

    // Generate recommendations
    const recommendations = this.generateCapacityRecommendations(
      currentCapacity,
      projectedDemand,
      constraints.budget,
    );

    // Generate scenarios
    const scenarios = this.generateCapacityScenarios(projectedDemand);

    return {
      timeframe: constraints.timeframe,
      currentCapacity,
      projectedDemand,
      recommendations,
      constraints: {
        budget: constraints.budget,
        technical: ["Model availability", "API rate limits"],
        business: ["Service level agreements", "Budget approval cycles"],
      },
      scenarios,
    };
  }

  // Helper methods

  private generateCacheKey(type: string, timeframe: TimeWindow): string {
    return `${type}_${timeframe.start.getTime()}_${timeframe.end.getTime()}_${timeframe.granularity}`;
  }

  private isForecastValid(forecast: UsageForecast): boolean {
    const maxAge = 60 * 60 * 1000; // 1 hour
    return Date.now() - forecast.metadata.lastUpdated.getTime() < maxAge;
  }

  private getRelevantTimeSeries(
    metric: string,
    timeframe: TimeWindow,
  ): TimeSeries[] {
    return Array.from(this.timeSeries.values()).filter(
      (ts) =>
        ts.metric === metric &&
        ts.timestamps[0] >=
          new Date(timeframe.start.getTime() - 7 * 24 * 60 * 60 * 1000), // Include past week
    );
  }

  private generatePeriods(timeframe: TimeWindow): Date[] {
    const periods: Date[] = [];
    const start = new Date(timeframe.start);
    const end = new Date(timeframe.end);

    let current = new Date(start);
    const increment = this.getGranularityIncrement(timeframe.granularity);

    while (current <= end) {
      periods.push(new Date(current));
      current = new Date(current.getTime() + increment);
    }

    return periods;
  }

  private getGranularityIncrement(granularity: string): number {
    switch (granularity) {
      case "minute":
        return 60 * 1000;
      case "hour":
        return 60 * 60 * 1000;
      case "day":
        return 24 * 60 * 60 * 1000;
      case "week":
        return 7 * 24 * 60 * 60 * 1000;
      case "month":
        return 30 * 24 * 60 * 60 * 1000;
      default:
        return 60 * 60 * 1000;
    }
  }

  private predictSinglePoint(
    series: TimeSeries[],
    timestamp: Date,
  ): {
    timestamp: Date;
    predicted: number;
    confidence: number;
    lower_bound: number;
    upper_bound: number;
  } {
    // Simplified prediction - in production would use actual ML models
    const recentValues = series.flatMap((s) => s.values.slice(-10)); // Last 10 values
    const mean =
      recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    const variance =
      recentValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      recentValues.length;
    const stdDev = Math.sqrt(variance);

    // Add some trend and seasonality (simplified)
    const trend = this.calculateSimpleTrend(recentValues);
    const seasonal = this.calculateSeasonalFactor(timestamp);

    const predicted = mean + trend + seasonal;
    const confidence = Math.max(0.5, Math.min(0.95, 1 - stdDev / mean));

    return {
      timestamp,
      predicted,
      confidence,
      lower_bound: predicted - 1.96 * stdDev,
      upper_bound: predicted + 1.96 * stdDev,
    };
  }

  private analyzeTrends(
    series: TimeSeries[],
    predictions: Array<{
      timestamp: Date;
      predicted: number;
      confidence: number;
      lower_bound: number;
      upper_bound: number;
    }>,
  ): {
    overall: "increasing" | "decreasing" | "stable";
    seasonal: boolean;
    changePoints: Date[];
  } {
    // Simple trend analysis
    const values = predictions.map((p) => p.predicted);
    const slope = this.calculateSlope(values);

    let overall: "increasing" | "decreasing" | "stable" = "stable";
    if (slope > 0.05) overall = "increasing";
    else if (slope < -0.05) overall = "decreasing";

    // Check for seasonality (simplified)
    const seasonal = this.hasSeasonality(series);

    // Detect change points (simplified)
    const changePoints = this.detectChangePoints(predictions);

    return { overall, seasonal, changePoints };
  }

  private calculateSimpleTrend(values: number[]): number {
    if (values.length < 2) return 0;
    return (values[values.length - 1] - values[0]) / values.length;
  }

  private calculateSeasonalFactor(timestamp: Date): number {
    // Simple seasonal factor based on hour of day
    const hour = timestamp.getHours();
    return Math.sin((hour / 24) * 2 * Math.PI) * 0.1;
  }

  private calculateSlope(values: number[]): number {
    if (values.length < 2) return 0;

    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = values.reduce((sum, val, i) => sum + val * i, 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;

    return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  }

  private hasSeasonality(series: TimeSeries[]): boolean {
    // Simplified seasonality detection
    return series.some((s) => s.values.length > 24); // If we have more than 24 hours of data
  }

  private detectChangePoints(
    predictions: Array<{ timestamp: Date; predicted: number }>,
  ): Date[] {
    // Simplified change point detection
    const changePoints: Date[] = [];

    for (let i = 1; i < predictions.length - 1; i++) {
      const prev = predictions[i - 1].predicted;
      const curr = predictions[i].predicted;
      const next = predictions[i + 1].predicted;

      // Check for significant change in direction
      const change1 = curr - prev;
      const change2 = next - curr;

      if (
        Math.sign(change1) !== Math.sign(change2) &&
        Math.abs(change1 + change2) > 0.1
      ) {
        changePoints.push(predictions[i].timestamp);
      }
    }

    return changePoints;
  }

  // More helper methods (simplified implementations)

  private deduplicateAnomalies(anomalies: Anomaly[]): Anomaly[] {
    // Remove anomalies that are too close in time
    const deduplicated: Anomaly[] = [];
    const minTimeDiff = 5 * 60 * 1000; // 5 minutes

    for (const anomaly of anomalies.sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
    )) {
      const isDuplicate = deduplicated.some(
        (existing) =>
          Math.abs(anomaly.timestamp.getTime() - existing.timestamp.getTime()) <
            minTimeDiff && anomaly.metric === existing.metric,
      );

      if (!isDuplicate) {
        deduplicated.push(anomaly);
      }
    }

    return deduplicated;
  }

  private async correlateAnomalies(anomalies: Anomaly[]): Promise<void> {
    // Simple correlation analysis
    for (let i = 0; i < anomalies.length; i++) {
      for (let j = i + 1; j < anomalies.length; j++) {
        const timeDiff = Math.abs(
          anomalies[i].timestamp.getTime() - anomalies[j].timestamp.getTime(),
        );

        if (timeDiff < 10 * 60 * 1000) {
          // Within 10 minutes
          if (!anomalies[i].context.relatedAnomalies) {
            anomalies[i].context.relatedAnomalies = [];
          }
          anomalies[i].context.relatedAnomalies!.push(anomalies[j].id);
        }
      }
    }
  }

  private generateAnomalyActions(
    value: number,
    expected: number,
    severity: string,
  ): string[] {
    const actions: string[] = [];

    if (severity === "critical") {
      actions.push("Immediate investigation required");
      actions.push("Check system health");
      actions.push("Consider scaling resources");
    } else if (severity === "high") {
      actions.push("Monitor closely for next hour");
      actions.push("Review recent changes");
    } else {
      actions.push("Log for trend analysis");
      actions.push("Review during next maintenance window");
    }

    return actions;
  }

  private calculateIsolationScore(
    point: number[],
    dataset: number[][],
  ): number {
    // Simplified isolation score calculation
    let score = 0;

    for (const otherPoint of dataset) {
      const distance = Math.sqrt(
        point.reduce(
          (sum, val, i) => sum + Math.pow(val - otherPoint[i], 2),
          0,
        ),
      );

      if (distance < 1.0) {
        // Points within distance 1 are neighbors
        score += 1;
      }
    }

    // Normalize score - lower scores indicate more isolated (anomalous) points
    return 1 - score / dataset.length;
  }

  private combineTimeSeries(
    existing: TimeSeries,
    newData: TimeSeries,
  ): TimeSeries {
    // Simple combination - in production would handle overlaps and conflicts
    return {
      timestamps: [...existing.timestamps, ...newData.timestamps],
      values: [...existing.values, ...newData.values],
      metric: existing.metric,
      modelId: existing.modelId,
      userId: existing.userId,
    };
  }

  private invalidateForecasts(metric: string): number {
    let count = 0;

    for (const [key, forecast] of this.forecastCache.entries()) {
      if (forecast.metric === metric) {
        this.forecastCache.delete(key);
        count++;
      }
    }

    return count;
  }

  private async retrainModels(): Promise<void> {
    // Placeholder for model retraining
    this.lastModelUpdate = new Date();

    this.emit("models_retrained", {
      timestamp: new Date(),
      dataSize: this.timeSeries.size,
    });
  }

  private calculateUtilizationRate(): number {
    // Mock calculation
    return 0.75;
  }

  private calculateOverProvisioningCost(): number {
    // Mock calculation
    return 1250.0;
  }

  private calculateUnderProvisioningRisk(): number {
    // Mock calculation
    return 0.15;
  }

  private calculateOptimizationScore(): number {
    // Mock calculation based on various factors
    const utilization = this.calculateUtilizationRate();
    const overCost = this.calculateOverProvisioningCost();
    const underRisk = this.calculateUnderProvisioningRisk();

    return utilization * 0.5 - (overCost / 10000) * 0.3 - underRisk * 0.2;
  }

  private async incorporateFeedback(
    anomalyId: string,
    feedback: { isAnomaly: boolean; comments?: string },
  ): Promise<void> {
    // Update model parameters based on feedback
    // This is a placeholder - in production would update actual ML models
    const anomaly = this.anomalyHistory.find((a) => a.id === anomalyId);
    if (!anomaly) return;

    if (feedback.isAnomaly) {
      // Positive feedback - model correctly identified anomaly
      this.config.anomalyDetection.sensitivityLevel = Math.min(
        1.0,
        this.config.anomalyDetection.sensitivityLevel + 0.01,
      );
    } else {
      // Negative feedback - false positive
      this.config.anomalyDetection.sensitivityLevel = Math.max(
        0.1,
        this.config.anomalyDetection.sensitivityLevel - 0.02,
      );
    }
  }

  // Placeholder implementations for cost forecasting

  private projectUsage(period: Date, scenario: CostScenario): number {
    // Mock usage projection
    return 1000 * (1 + scenario.assumptions.usageGrowthRate);
  }

  private calculateCostForUsage(usage: number, scenario: CostScenario): number {
    // Mock cost calculation
    return usage * 0.001; // $0.001 per unit
  }

  private calculateProjectionConfidence(
    period: Date,
    scenario: CostScenario,
  ): number {
    // Mock confidence calculation
    return 0.8;
  }

  private calculateCostByModel(
    projections: any[],
    scenario: CostScenario,
  ): Record<string, number> {
    return {
      "claude-3-sonnet": 500.0,
      "gpt-4": 750.0,
      "gemini-pro": 400.0,
    };
  }

  private calculateCostByTimeframe(
    projections: any[],
  ): Array<{ period: string; cost: number; usage: number }> {
    return [
      { period: "Q1", cost: 1200.0, usage: 120000 },
      { period: "Q2", cost: 1350.0, usage: 135000 },
      { period: "Q3", cost: 1500.0, usage: 150000 },
      { period: "Q4", cost: 1650.0, usage: 165000 },
    ];
  }

  private calculateCostByCategory(projections: any[]): Record<string, number> {
    return {
      text_generation: 2000.0,
      code_assistance: 1500.0,
      analysis: 1000.0,
      other: 500.0,
    };
  }

  private identifyCostDrivers(
    scenario: CostScenario,
    projections: any[],
  ): Array<{ factor: string; impact: number; description: string }> {
    return [
      {
        factor: "Usage Growth",
        impact: 0.6,
        description: "Projected 15% monthly growth in model usage",
      },
      {
        factor: "Model Mix",
        impact: 0.3,
        description: "Shift towards premium models increasing average cost",
      },
      {
        factor: "Peak Hours",
        impact: 0.1,
        description: "Higher usage during business hours",
      },
    ];
  }

  private identifyOptimizationOpportunities(
    scenario: CostScenario,
    projections: any[],
  ): Array<{ opportunity: string; potential_savings: number }> {
    return [
      {
        opportunity: "Load balancing optimization",
        potential_savings: 250.0,
      },
      {
        opportunity: "Caching improvements",
        potential_savings: 180.0,
      },
      {
        opportunity: "Model selection optimization",
        potential_savings: 320.0,
      },
    ];
  }

  private identifyRisks(
    scenario: CostScenario,
    projections: any[],
  ): Array<{ risk: string; impact: number; mitigation: string }> {
    return [
      {
        risk: "Unexpected usage spikes",
        impact: 500.0,
        mitigation: "Implement usage monitoring and alerts",
      },
      {
        risk: "Model price increases",
        impact: 300.0,
        mitigation: "Diversify model portfolio and negotiate contracts",
      },
    ];
  }

  private generateCostRecommendations(
    insights: any,
    scenario: CostScenario,
  ): string[] {
    return [
      "Implement usage-based scaling to handle growth efficiently",
      "Optimize model selection algorithm to favor cost-effective options",
      "Set up cost monitoring and alerting thresholds",
      "Consider volume discounts or reserved capacity for high-usage models",
    ];
  }

  // Placeholder implementations for capacity planning

  private getCurrentCapacity(): Record<string, number> {
    return {
      "claude-3-sonnet": 1000,
      "gpt-4": 800,
      "gemini-pro": 1200,
    };
  }

  private async projectDemand(
    timeframe: TimeWindow,
  ): Promise<
    Array<{ date: Date; demand: Record<string, number>; confidence: number }>
  > {
    const projections: Array<{
      date: Date;
      demand: Record<string, number>;
      confidence: number;
    }> = [];
    const periods = this.generatePeriods(timeframe);

    for (const period of periods) {
      projections.push({
        date: period,
        demand: {
          "claude-3-sonnet": 800 + Math.random() * 400,
          "gpt-4": 600 + Math.random() * 300,
          "gemini-pro": 900 + Math.random() * 500,
        },
        confidence: 0.8,
      });
    }

    return projections;
  }

  private generateCapacityRecommendations(
    currentCapacity: Record<string, number>,
    projectedDemand: Array<{
      date: Date;
      demand: Record<string, number>;
      confidence: number;
    }>,
    budget: number,
  ): Array<{
    action: string;
    target: string;
    timeline: string;
    justification: string;
    cost_impact: number;
  }> {
    return [
      {
        action: "scale_up",
        target: "claude-3-sonnet",
        timeline: "Next 2 weeks",
        justification: "Projected demand exceeds current capacity by 20%",
        cost_impact: 500.0,
      },
      {
        action: "add_model",
        target: "claude-3-haiku",
        timeline: "Next month",
        justification: "Cost-effective alternative for high-volume tasks",
        cost_impact: -200.0,
      },
    ];
  }

  private generateCapacityScenarios(
    projectedDemand: any[],
  ): Array<{
    name: string;
    probability: number;
    impact: Record<string, number>;
    response_plan: string[];
  }> {
    return [
      {
        name: "High Growth Scenario",
        probability: 0.3,
        impact: { capacity_needed: 1.5, cost_increase: 750.0 },
        response_plan: [
          "Accelerate capacity expansion",
          "Implement load balancing",
          "Consider additional model providers",
        ],
      },
      {
        name: "Base Case",
        probability: 0.5,
        impact: { capacity_needed: 1.2, cost_increase: 400.0 },
        response_plan: [
          "Proceed with planned capacity increases",
          "Monitor usage trends closely",
        ],
      },
      {
        name: "Low Demand",
        probability: 0.2,
        impact: { capacity_needed: 0.9, cost_increase: -100.0 },
        response_plan: [
          "Scale down excess capacity",
          "Optimize resource allocation",
        ],
      },
    ];
  }

  private startPredictionUpdates(): void {
    // Start periodic updates
    setInterval(
      () => {
        this.emit("prediction_cycle", {
          timestamp: new Date(),
          activeSeries: this.timeSeries.size,
          cachedForecasts: this.forecastCache.size,
        });
      },
      this.config.forecasting.updateFrequency * 60 * 1000,
    );
  }

  /**
   * Stop all prediction processes
   */
  stop(): void {
    this.emit("predictive_analytics_stopped", {
      timestamp: new Date(),
      forecasts: this.forecastCache.size,
      anomalies: this.anomalyHistory.length,
      capacityPlans: this.capacityPlans.size,
    });
  }
}

export default PredictiveAnalytics;
