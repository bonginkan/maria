/**
 * MARIA v3.6.0 - ML Anomaly Detection Engine
 * Statistical anomaly detection with pattern recognition
 * Sub-millisecond performance for real-time monitoring
 */

import { EventEmitter } from "node:events";
import { performance } from "perf_hooks";

// Type definitions
interface MetricPoint {
  timestamp: number;
  value: number;
  metadata?: Record<string, any>;
}

interface TimeSeriesData {
  metric: string;
  points: MetricPoint[];
  window: number; // seconds
}

interface AnomalyResult {
  timestamp: number;
  metric: string;
  value: number;
  anomalyScore: number;
  severity: "low" | "medium" | "high" | "critical";
  confidence: number;
  reason: string;
  context: Record<string, any>;
}

interface StatisticalFeatures {
  mean: number;
  median: number;
  stdDev: number;
  variance: number;
  skewness: number;
  kurtosis: number;
  min: number;
  max: number;
  q1: number;
  q3: number;
  iqr: number;
}

interface PatternProfile {
  dailyPattern: number[];
  weeklyPattern: number[];
  seasonalTrend: number[];
  cyclicComponents: { frequency: number; amplitude: number; phase: number }[];
}

interface DetectionModel {
  name: string;
  type: "statistical" | "ml" | "hybrid";
  parameters: Record<string, any>;
  trained: boolean;
  accuracy: number;
  lastUpdate: number;
}

interface AnomalyDetectionConfig {
  sensitivity: number; // 0-1, higher = more sensitive
  windowSize: number; // seconds
  minDataPoints: number;
  maxMemoryPoints: number;
  models: DetectionModel[];
  thresholds: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
}

// Fast statistical computations
class StatisticalUtils {
  // Optimized mean calculation
  static mean(values: number[]): number {
    if (values.length === 0) return 0;
    let sum = 0;
    for (let i = 0; i < values.length; i++) {
      sum += values[i];
    }
    return sum / values.length;
  }

  // Optimized standard deviation
  static standardDeviation(values: number[], mean?: number): number {
    if (values.length < 2) return 0;

    const m = mean ?? this.mean(values);
    let squaredDifferences = 0;

    for (let i = 0; i < values.length; i++) {
      const diff = values[i] - m;
      squaredDifferences += diff * diff;
    }

    return Math.sqrt(squaredDifferences / (values.length - 1));
  }

  // Median calculation with partial sorting
  static median(values: number[]): number {
    if (values.length === 0) return 0;

    const sorted = values.slice().sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);

    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  // Interquartile range
  static iqr(values: number[]): { q1: number; q3: number; iqr: number } {
    if (values.length < 4) return { q1: 0, q3: 0, iqr: 0 };

    const sorted = values.slice().sort((a, b) => a - b);
    const n = sorted.length;

    const q1Index = Math.floor(n * 0.25);
    const q3Index = Math.floor(n * 0.75);

    const q1 = sorted[q1Index];
    const q3 = sorted[q3Index];

    return { q1, q3, iqr: q3 - q1 };
  }

  // Z-score calculation
  static zScore(value: number, mean: number, stdDev: number): number {
    return stdDev === 0 ? 0 : (value - mean) / stdDev;
  }

  // Modified Z-score (using median absolute deviation)
  static modifiedZScore(values: number[], value: number): number {
    const median = this.median(values);
    const absoluteDeviations = values.map((v) => Math.abs(v - median));
    const mad = this.median(absoluteDeviations);

    return mad === 0 ? 0 : (0.6745 * (value - median)) / mad;
  }

  // Exponential moving average
  static ema(values: number[], alpha: number): number[] {
    if (values.length === 0) return [];

    const result = [values[0]];
    for (let i = 1; i < values.length; i++) {
      result[i] = alpha * values[i] + (1 - alpha) * result[i - 1];
    }
    return result;
  }
}

// Pattern analysis utilities
class PatternAnalyzer {
  // Detect seasonal patterns using FFT-like approach
  static detectSeasonality(
    values: number[],
    timestamps: number[],
  ): PatternProfile {
    const dailyPattern = this.extractDailyPattern(values, timestamps);
    const weeklyPattern = this.extractWeeklyPattern(values, timestamps);
    const cyclicComponents = this.extractCyclicComponents(values);

    return {
      dailyPattern,
      weeklyPattern,
      seasonalTrend: this.extractTrend(values),
      cyclicComponents,
    };
  }

  private static extractDailyPattern(
    values: number[],
    timestamps: number[],
  ): number[] {
    const hourlyBuckets = new Array(24).fill(0).map(() => [] as number[]);

    for (let i = 0; i < values.length; i++) {
      const hour = new Date(timestamps[i]).getHours();
      hourlyBuckets[hour].push(values[i]);
    }

    return hourlyBuckets.map((bucket) =>
      bucket.length > 0 ? StatisticalUtils.mean(bucket) : 0,
    );
  }

  private static extractWeeklyPattern(
    values: number[],
    timestamps: number[],
  ): number[] {
    const dailyBuckets = new Array(7).fill(0).map(() => [] as number[]);

    for (let i = 0; i < values.length; i++) {
      const day = new Date(timestamps[i]).getDay();
      dailyBuckets[day].push(values[i]);
    }

    return dailyBuckets.map((bucket) =>
      bucket.length > 0 ? StatisticalUtils.mean(bucket) : 0,
    );
  }

  private static extractTrend(values: number[]): number[] {
    // Simple linear trend extraction
    const n = values.length;
    if (n < 2) return values;

    let sumX = 0,
      sumY = 0,
      sumXY = 0,
      sumX2 = 0;

    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += values[i];
      sumXY += i * values[i];
      sumX2 += i * i;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return values.map((_, i) => intercept + slope * i);
  }

  private static extractCyclicComponents(
    values: number[],
  ): { frequency: number; amplitude: number; phase: number }[] {
    // Simplified frequency domain analysis
    const components: {
      frequency: number;
      amplitude: number;
      phase: number;
    }[] = [];
    const n = values.length;

    if (n < 8) return components;

    // Check for common frequencies (daily, weekly, etc.)
    const testFrequencies = [1 / 24, 1 / 168, 1 / 720]; // hourly, daily, weekly cycles

    for (const freq of testFrequencies) {
      let realSum = 0,
        imagSum = 0;

      for (let i = 0; i < n; i++) {
        const angle = 2 * Math.PI * freq * i;
        realSum += values[i] * Math.cos(angle);
        imagSum += values[i] * Math.sin(angle);
      }

      const amplitude = Math.sqrt(realSum * realSum + imagSum * imagSum) / n;
      const phase = Math.atan2(imagSum, realSum);

      if (amplitude > 0.1) {
        // Threshold for significance
        components.push({ frequency: freq, amplitude, phase });
      }
    }

    return components.sort((a, b) => b.amplitude - a.amplitude);
  }
}

// Main anomaly detection engine
export class AnomalyDetectionEngine extends EventEmitter {
  private config: AnomalyDetectionConfig;
  private timeSeriesData: Map<string, TimeSeriesData> = new Map();
  private patterns: Map<string, PatternProfile> = new Map();
  private models: Map<string, DetectionModel> = new Map();
  private recentAnomalies: Map<string, AnomalyResult[]> = new Map();
  private performance: { detectionTime: number; throughput: number } = {
    detectionTime: 0,
    throughput: 0,
  };

  constructor(config?: Partial<AnomalyDetectionConfig>) {
    super();

    this.config = {
      sensitivity: 0.7,
      windowSize: 3600, // 1 hour
      minDataPoints: 10,
      maxMemoryPoints: 1000,
      models: [],
      thresholds: {
        low: 0.3,
        medium: 0.5,
        high: 0.7,
        critical: 0.9,
      },
      ...config,
    };

    this.initializeModels();
    console.log("🧠 AnomalyDetectionEngine initialized with ML capabilities");
  }

  private initializeModels(): void {
    // Statistical model
    this.models.set("statistical", {
      name: "Statistical Outlier Detection",
      type: "statistical",
      parameters: {
        zScoreThreshold: 3.0,
        modifiedZThreshold: 3.5,
        iqrMultiplier: 1.5,
      },
      trained: true,
      accuracy: 0.85,
      lastUpdate: Date.now(),
    });

    // Pattern-based model
    this.models.set("pattern", {
      name: "Pattern Deviation Detection",
      type: "ml",
      parameters: {
        deviationThreshold: 2.0,
        patternConfidence: 0.8,
      },
      trained: false,
      accuracy: 0.0,
      lastUpdate: 0,
    });

    // Hybrid ensemble model
    this.models.set("ensemble", {
      name: "Ensemble Anomaly Detection",
      type: "hybrid",
      parameters: {
        weights: { statistical: 0.4, pattern: 0.6 },
        consensusThreshold: 0.6,
      },
      trained: false,
      accuracy: 0.0,
      lastUpdate: 0,
    });
  }

  // Add new metric data point
  public addMetricPoint(
    metric: string,
    value: number,
    timestamp?: number,
    metadata?: Record<string, any>,
  ): void {
    const ts = timestamp || Date.now();
    const point: MetricPoint = { timestamp: ts, value, metadata };

    if (!this.timeSeriesData.has(metric)) {
      this.timeSeriesData.set(metric, {
        metric,
        points: [],
        window: this.config.windowSize,
      });
    }

    const timeSeries = this.timeSeriesData.get(metric)!;
    timeSeries.points.push(point);

    // Maintain memory limits
    if (timeSeries.points.length > this.config.maxMemoryPoints) {
      timeSeries.points = timeSeries.points.slice(-this.config.maxMemoryPoints);
    }

    // Remove old data outside window
    const cutoff = ts - this.config.windowSize * 1000;
    timeSeries.points = timeSeries.points.filter((p) => p.timestamp >= cutoff);

    // Trigger real-time anomaly detection
    this.detectAnomalies(metric).then((anomalies) => {
      if (anomalies.length > 0) {
        this.emit("anomaly", anomalies);
      }
    });
  }

  // Real-time anomaly detection
  public async detectAnomalies(metric: string): Promise<AnomalyResult[]> {
    const startTime = performance.now();

    const timeSeries = this.timeSeriesData.get(metric);
    if (!timeSeries || timeSeries.points.length < this.config.minDataPoints) {
      return [];
    }

    const values = timeSeries.points.map((p) => p.value);
    const timestamps = timeSeries.points.map((p) => p.timestamp);
    const latestPoint = timeSeries.points[timeSeries.points.length - 1];

    // Run multiple detection models in parallel
    const detectionPromises = [
      this.runStatisticalDetection(values, latestPoint),
      this.runPatternDetection(metric, values, timestamps, latestPoint),
      this.runEnsembleDetection(metric, values, timestamps, latestPoint),
    ];

    const results = await Promise.all(detectionPromises);
    const anomalies = results.filter(
      (result) => result !== null,
    ) as AnomalyResult[];

    // Update performance metrics
    const detectionTime = performance.now() - startTime;
    this.performance.detectionTime = detectionTime;
    this.performance.throughput = values.length / (detectionTime / 1000);

    // Cache recent anomalies
    if (anomalies.length > 0) {
      if (!this.recentAnomalies.has(metric)) {
        this.recentAnomalies.set(metric, []);
      }
      this.recentAnomalies.get(metric)!.push(...anomalies);

      // Keep only recent anomalies (last hour)
      const recent = this.recentAnomalies.get(metric)!;
      const cutoff = Date.now() - 3600000; // 1 hour
      this.recentAnomalies.set(
        metric,
        recent.filter((a) => a.timestamp >= cutoff),
      );
    }

    return anomalies;
  }

  // Statistical anomaly detection
  private async runStatisticalDetection(
    values: number[],
    latestPoint: MetricPoint,
  ): Promise<AnomalyResult | null> {
    const model = this.models.get("statistical")!;

    if (values.length < 3) return null;

    const recent = values.slice(-30); // Last 30 points for baseline
    const features = this.calculateStatisticalFeatures(recent);

    let anomalyScore = 0;
    let reason = "";

    // Z-score test
    const zScore = Math.abs(
      StatisticalUtils.zScore(
        latestPoint.value,
        features.mean,
        features.stdDev,
      ),
    );
    if (zScore > model.parameters.zScoreThreshold) {
      anomalyScore = Math.max(anomalyScore, Math.min(zScore / 5, 1));
      reason += `Z-score: ${zScore.toFixed(2)} (>${model.parameters.zScoreThreshold}); `;
    }

    // Modified Z-score test
    const modZScore = Math.abs(
      StatisticalUtils.modifiedZScore(recent, latestPoint.value),
    );
    if (modZScore > model.parameters.modifiedZThreshold) {
      anomalyScore = Math.max(anomalyScore, Math.min(modZScore / 6, 1));
      reason += `Mod-Z: ${modZScore.toFixed(2)} (>${model.parameters.modifiedZThreshold}); `;
    }

    // IQR test
    const iqrInfo = StatisticalUtils.iqr(recent);
    const iqrLower = iqrInfo.q1 - model.parameters.iqrMultiplier * iqrInfo.iqr;
    const iqrUpper = iqrInfo.q3 + model.parameters.iqrMultiplier * iqrInfo.iqr;

    if (latestPoint.value < iqrLower || latestPoint.value > iqrUpper) {
      const iqrScore = Math.min(
        Math.abs(
          latestPoint.value -
            (latestPoint.value < iqrLower ? iqrLower : iqrUpper),
        ) / iqrInfo.iqr,
        1,
      );
      anomalyScore = Math.max(anomalyScore, iqrScore);
      reason += `IQR outlier (${iqrLower.toFixed(2)}-${iqrUpper.toFixed(2)}); `;
    }

    if (anomalyScore > this.config.thresholds.low) {
      return {
        timestamp: latestPoint.timestamp,
        metric: "unknown", // Will be set by caller
        value: latestPoint.value,
        anomalyScore,
        severity: this.getSeverity(anomalyScore),
        confidence: model.accuracy,
        reason: reason.trim(),
        context: {
          model: "statistical",
          features,
          zScore,
          modZScore,
          iqrInfo,
        },
      };
    }

    return null;
  }

  // Pattern-based anomaly detection
  private async runPatternDetection(
    metric: string,
    values: number[],
    timestamps: number[],
    latestPoint: MetricPoint,
  ): Promise<AnomalyResult | null> {
    const model = this.models.get("pattern")!;

    if (values.length < 20) return null;

    // Update or create pattern profile
    if (
      !this.patterns.has(metric) ||
      Date.now() - model.lastUpdate > 86400000
    ) {
      // Update daily
      const pattern = PatternAnalyzer.detectSeasonality(values, timestamps);
      this.patterns.set(metric, pattern);
      model.trained = true;
      model.lastUpdate = Date.now();
    }

    const pattern = this.patterns.get(metric);
    if (!pattern) return null;

    // Calculate expected value based on patterns
    const now = new Date(latestPoint.timestamp);
    const hour = now.getHours();
    const dayOfWeek = now.getDay();

    const expectedFromDaily = pattern.dailyPattern[hour] || 0;
    const expectedFromWeekly = pattern.weeklyPattern[dayOfWeek] || 0;

    // Weighted expected value
    const expectedValue = expectedFromDaily * 0.6 + expectedFromWeekly * 0.4;
    const deviation = Math.abs(latestPoint.value - expectedValue);
    const relativeDeviation =
      expectedValue !== 0 ? deviation / Math.abs(expectedValue) : deviation;

    const anomalyScore = Math.min(
      relativeDeviation / model.parameters.deviationThreshold,
      1,
    );

    if (anomalyScore > this.config.thresholds.low) {
      return {
        timestamp: latestPoint.timestamp,
        metric,
        value: latestPoint.value,
        anomalyScore,
        severity: this.getSeverity(anomalyScore),
        confidence: model.parameters.patternConfidence,
        reason: `Pattern deviation: expected ${expectedValue.toFixed(2)}, got ${latestPoint.value}`,
        context: {
          model: "pattern",
          expectedValue,
          deviation,
          relativeDeviation,
          hour,
          dayOfWeek,
        },
      };
    }

    return null;
  }

  // Ensemble anomaly detection
  private async runEnsembleDetection(
    metric: string,
    values: number[],
    timestamps: number[],
    latestPoint: MetricPoint,
  ): Promise<AnomalyResult | null> {
    const model = this.models.get("ensemble")!;

    // Get results from individual models
    const [statResult, patternResult] = await Promise.all([
      this.runStatisticalDetection(values, latestPoint),
      this.runPatternDetection(metric, values, timestamps, latestPoint),
    ]);

    const results = [statResult, patternResult].filter(
      (r) => r !== null,
    ) as AnomalyResult[];

    if (results.length === 0) return null;

    // Weighted ensemble scoring
    let ensembleScore = 0;
    let confidence = 0;
    let reason = "Ensemble: ";

    const weights = model.parameters.weights;

    results.forEach((result) => {
      const weight = weights[result.context.model] || 0.5;
      ensembleScore += result.anomalyScore * weight;
      confidence += result.confidence * weight;
      reason += `${result.context.model}(${result.anomalyScore.toFixed(2)}) `;
    });

    // Consensus check
    const consensus = results.length / 2; // Number of models that detected anomaly
    if (consensus < model.parameters.consensusThreshold) {
      ensembleScore *= consensus; // Reduce score if low consensus
    }

    if (ensembleScore > this.config.thresholds.low) {
      return {
        timestamp: latestPoint.timestamp,
        metric,
        value: latestPoint.value,
        anomalyScore: ensembleScore,
        severity: this.getSeverity(ensembleScore),
        confidence: confidence / results.length,
        reason: reason.trim(),
        context: {
          model: "ensemble",
          individualResults: results,
          consensus,
          weights,
        },
      };
    }

    return null;
  }

  // Calculate comprehensive statistical features
  private calculateStatisticalFeatures(values: number[]): StatisticalFeatures {
    const mean = StatisticalUtils.mean(values);
    const median = StatisticalUtils.median(values);
    const stdDev = StatisticalUtils.standardDeviation(values, mean);
    const variance = stdDev * stdDev;

    const iqrInfo = StatisticalUtils.iqr(values);
    const sorted = values.slice().sort((a, b) => a - b);

    // Skewness and kurtosis calculations
    let skewness = 0;
    let kurtosis = 0;

    if (stdDev > 0) {
      for (const value of values) {
        const normalized = (value - mean) / stdDev;
        skewness += normalized ** 3;
        kurtosis += normalized ** 4;
      }
      skewness /= values.length;
      kurtosis = kurtosis / values.length - 3; // Excess kurtosis
    }

    return {
      mean,
      median,
      stdDev,
      variance,
      skewness,
      kurtosis,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      q1: iqrInfo.q1,
      q3: iqrInfo.q3,
      iqr: iqrInfo.iqr,
    };
  }

  // Determine severity based on anomaly score
  private getSeverity(score: number): "low" | "medium" | "high" | "critical" {
    if (score >= this.config.thresholds.critical) return "critical";
    if (score >= this.config.thresholds.high) return "high";
    if (score >= this.config.thresholds.medium) return "medium";
    return "low";
  }

  // Get recent anomalies for a metric
  public getRecentAnomalies(metric: string, limit = 50): AnomalyResult[] {
    return this.recentAnomalies.get(metric)?.slice(-limit) || [];
  }

  // Get performance metrics
  public getPerformanceMetrics(): {
    detectionTime: number;
    throughput: number;
    memoryUsage: number;
  } {
    const memoryUsage = Array.from(this.timeSeriesData.values()).reduce(
      (sum, ts) => sum + ts.points.length,
      0,
    );

    return {
      ...this.performance,
      memoryUsage,
    };
  }

  // Update configuration
  public updateConfig(newConfig: Partial<AnomalyDetectionConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log("🔧 AnomalyDetectionEngine configuration updated");
  }

  // Clean up old data
  public cleanup(): void {
    const now = Date.now();
    const cutoff = now - this.config.windowSize * 1000 * 2; // 2x window size

    for (const [metric, timeSeries] of this.timeSeriesData) {
      const oldLength = timeSeries.points.length;
      timeSeries.points = timeSeries.points.filter(
        (p) => p.timestamp >= cutoff,
      );

      if (timeSeries.points.length === 0) {
        this.timeSeriesData.delete(metric);
        this.patterns.delete(metric);
        this.recentAnomalies.delete(metric);
      }
    }

    console.log("🧹 AnomalyDetectionEngine cleanup completed");
  }
}
