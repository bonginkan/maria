import { EventEmitter } from "node:events";
import * as tf from "@tensorflow/tfjs-node";

export interface AnomalyConfig {
  windowSize?: number;
  threshold?: number;
  minDataPoints?: number;
  modelType?: "isolation-forest" | "autoencoder" | "lstm";
  updateInterval?: number;
}

export interface MetricPoint {
  timestamp: number;
  value: number;
  metadata?: Record<string, any>;
}

export interface AnomalyResult {
  isAnomaly: boolean;
  score: number;
  expectedRange: [number, number];
  actualValue: number;
  timestamp: number;
  metric: string;
  severity: "low" | "medium" | "high" | "critical";
}

export class AnomalyDetector extends EventEmitter {
  private windowSize: number;
  private threshold: number;
  private minDataPoints: number;
  private modelType: string;
  private models: Map<string, tf.LayersModel>;
  private dataBuffers: Map<string, MetricPoint[]>;
  private statistics: Map<
    string,
    { mean: number; std: number; min: number; max: number }
  >;
  private updateInterval: number;
  private updateTimer?: NodeJS.Timeout;

  constructor(config: AnomalyConfig = {}) {
    super();

    this.windowSize = config.windowSize || 100;
    this.threshold = config.threshold || 3; // Z-score threshold
    this.minDataPoints = config.minDataPoints || 30;
    this.modelType = config.modelType || "autoencoder";
    this.updateInterval = config.updateInterval || 60000; // 1 minute

    this.models = new Map();
    this.dataBuffers = new Map();
    this.statistics = new Map();

    this.startUpdateTimer();
  }

  private startUpdateTimer(): void {
    this.updateTimer = setInterval(() => {
      this.updateModels();
    }, this.updateInterval);
  }

  public async addDataPoint(
    metric: string,
    point: MetricPoint,
  ): Promise<AnomalyResult | null> {
    // Initialize buffer if needed
    if (!this.dataBuffers.has(metric)) {
      this.dataBuffers.set(metric, []);
    }

    const buffer = this.dataBuffers.get(metric)!;
    buffer.push(point);

    // Keep buffer size manageable
    if (buffer.length > this.windowSize * 2) {
      buffer.splice(0, buffer.length - this.windowSize);
    }

    // Check if we have enough data
    if (buffer.length < this.minDataPoints) {
      return null;
    }

    // Detect anomaly
    const result = await this.detectAnomaly(metric, point);

    if (result.isAnomaly) {
      this.emit("anomaly", result);
    }

    return result;
  }

  private async detectAnomaly(
    metric: string,
    point: MetricPoint,
  ): Promise<AnomalyResult> {
    const buffer = this.dataBuffers.get(metric)!;

    // Calculate statistics
    const stats = this.calculateStatistics(buffer);
    this.statistics.set(metric, stats);

    // Perform detection based on model type
    let anomalyScore: number;

    switch (this.modelType) {
      case "isolation-forest":
        anomalyScore = await this.isolationForestDetection(buffer, point);
        break;
      case "lstm":
        anomalyScore = await this.lstmDetection(metric, buffer, point);
        break;
      case "autoencoder":
      default:
        anomalyScore = await this.autoencoderDetection(metric, buffer, point);
        break;
    }

    // Z-score based detection as fallback
    const zScore = Math.abs((point.value - stats.mean) / stats.std);
    const combinedScore = Math.max(anomalyScore, zScore);

    // Determine if it's an anomaly
    const isAnomaly = combinedScore > this.threshold;

    // Calculate expected range
    const expectedRange: [number, number] = [
      stats.mean - this.threshold * stats.std,
      stats.mean + this.threshold * stats.std,
    ];

    // Determine severity
    let severity: "low" | "medium" | "high" | "critical";
    if (combinedScore > this.threshold * 3) {
      severity = "critical";
    } else if (combinedScore > this.threshold * 2) {
      severity = "high";
    } else if (combinedScore > this.threshold * 1.5) {
      severity = "medium";
    } else {
      severity = "low";
    }

    return {
      isAnomaly,
      score: combinedScore,
      expectedRange,
      actualValue: point.value,
      timestamp: point.timestamp,
      metric,
      severity,
    };
  }

  private calculateStatistics(data: MetricPoint[]): {
    mean: number;
    std: number;
    min: number;
    max: number;
  } {
    const values = data.map((p) => p.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance =
      values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    const std = Math.sqrt(variance);
    const min = Math.min(...values);
    const max = Math.max(...values);

    return { mean, std, min, max };
  }

  private async isolationForestDetection(
    buffer: MetricPoint[],
    point: MetricPoint,
  ): Promise<number> {
    // Simplified isolation forest implementation
    const values = buffer.map((p) => p.value);
    const trees: number[][] = [];
    const numTrees = 100;
    const sampleSize = Math.min(256, buffer.length);

    // Build isolation trees
    for (let i = 0; i < numTrees; i++) {
      const sample = this.randomSample(values, sampleSize);
      const tree = this.buildIsolationTree(sample);
      trees.push(tree);
    }

    // Calculate anomaly score
    const pathLength =
      trees.reduce((sum, tree) => {
        return sum + this.getPathLength(tree, point.value);
      }, 0) / numTrees;

    const c = this.averagePathLength(sampleSize);
    const anomalyScore = Math.pow(2, -pathLength / c);

    return anomalyScore * 10; // Scale to match z-score range
  }

  private buildIsolationTree(
    data: number[],
    depth: number = 0,
    maxDepth: number = 10,
  ): number[] {
    if (data.length <= 1 || depth >= maxDepth) {
      return [depth];
    }

    const min = Math.min(...data);
    const max = Math.max(...data);
    const split = min + Math.random() * (max - min);

    const left = data.filter((v) => v < split);
    const right = data.filter((v) => v >= split);

    return [
      split,
      ...this.buildIsolationTree(left, depth + 1, maxDepth),
      ...this.buildIsolationTree(right, depth + 1, maxDepth),
    ];
  }

  private getPathLength(tree: number[], value: number): number {
    let depth = 0;
    let idx = 0;

    while (idx < tree.length) {
      if (tree[idx] === depth) {
        return depth;
      }

      if (value < tree[idx]) {
        idx = idx * 2 + 1;
      } else {
        idx = idx * 2 + 2;
      }
      depth++;
    }

    return depth;
  }

  private averagePathLength(n: number): number {
    if (n <= 1) return 0;
    if (n === 2) return 1;
    return 2 * (Math.log(n - 1) + 0.5772156649) - (2 * (n - 1)) / n;
  }

  private randomSample<T>(array: T[], size: number): T[] {
    const sample: T[] = [];
    const indices = new Set<number>();

    while (sample.length < size && sample.length < array.length) {
      const idx = Math.floor(Math.random() * array.length);
      if (!indices.has(idx)) {
        indices.add(idx);
        sample.push(array[idx]);
      }
    }

    return sample;
  }

  private async autoencoderDetection(
    metric: string,
    buffer: MetricPoint[],
    point: MetricPoint,
  ): Promise<number> {
    // Get or create model
    let model = this.models.get(metric);

    if (!model) {
      model = await this.createAutoencoderModel(buffer);
      this.models.set(metric, model);
    }

    // Prepare input
    const stats = this.statistics.get(metric)!;
    const normalizedValue = (point.value - stats.mean) / stats.std;
    const input = tf.tensor2d([[normalizedValue]]);

    // Get reconstruction
    const reconstruction = model.predict(input) as tf.Tensor;
    const reconstructedValue = await reconstruction.data();

    // Calculate reconstruction error
    const error = Math.abs(normalizedValue - reconstructedValue[0]);

    // Cleanup
    input.dispose();
    reconstruction.dispose();

    return error;
  }

  private async createAutoencoderModel(
    buffer: MetricPoint[],
  ): Promise<tf.LayersModel> {
    const inputDim = 1;
    const encodingDim = 3;

    // Encoder
    const encoder = tf.sequential({
      layers: [
        tf.layers.dense({
          inputShape: [inputDim],
          units: encodingDim,
          activation: "relu",
        }),
      ],
    });

    // Decoder
    const decoder = tf.sequential({
      layers: [
        tf.layers.dense({
          inputShape: [encodingDim],
          units: inputDim,
          activation: "linear",
        }),
      ],
    });

    // Full autoencoder
    const autoencoder = tf.sequential({
      layers: [encoder, decoder],
    });

    // Compile model
    autoencoder.compile({
      optimizer: "adam",
      loss: "meanSquaredError",
    });

    // Prepare training data
    const stats = this.calculateStatistics(buffer);
    const values = buffer.map((p) => (p.value - stats.mean) / stats.std);
    const xs = tf.tensor2d(values, [values.length, 1]);

    // Train model
    await autoencoder.fit(xs, xs, {
      epochs: 50,
      batchSize: 32,
      validationSplit: 0.2,
      verbose: 0,
    });

    // Cleanup
    xs.dispose();

    return autoencoder;
  }

  private async lstmDetection(
    metric: string,
    buffer: MetricPoint[],
    point: MetricPoint,
  ): Promise<number> {
    // Get or create LSTM model
    let model = this.models.get(metric);

    if (!model) {
      model = await this.createLSTMModel(buffer);
      this.models.set(metric, model);
    }

    // Prepare sequence
    const sequenceLength = 10;
    const recentData = buffer.slice(-sequenceLength);
    const stats = this.statistics.get(metric)!;

    // Normalize sequence
    const sequence = recentData.map((p) => (p.value - stats.mean) / stats.std);

    // Pad if necessary
    while (sequence.length < sequenceLength) {
      sequence.unshift(0);
    }

    // Predict next value
    const input = tf.tensor3d([sequence.map((v) => [v])]);
    const prediction = model.predict(input) as tf.Tensor;
    const predictedValue = await prediction.data();

    // Calculate prediction error
    const normalizedActual = (point.value - stats.mean) / stats.std;
    const error = Math.abs(normalizedActual - predictedValue[0]);

    // Cleanup
    input.dispose();
    prediction.dispose();

    return error * 3; // Scale to match z-score range
  }

  private async createLSTMModel(
    buffer: MetricPoint[],
  ): Promise<tf.LayersModel> {
    const sequenceLength = 10;
    const features = 1;

    const model = tf.sequential({
      layers: [
        tf.layers.lstm({
          inputShape: [sequenceLength, features],
          units: 50,
          returnSequences: true,
        }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.lstm({
          units: 50,
          returnSequences: false,
        }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({
          units: 1,
        }),
      ],
    });

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: "meanSquaredError",
    });

    // Prepare training data
    const stats = this.calculateStatistics(buffer);
    const normalizedValues = buffer.map(
      (p) => (p.value - stats.mean) / stats.std,
    );

    const sequences: number[][][] = [];
    const targets: number[] = [];

    for (let i = sequenceLength; i < normalizedValues.length; i++) {
      const sequence = normalizedValues.slice(i - sequenceLength, i);
      sequences.push(sequence.map((v) => [v]));
      targets.push(normalizedValues[i]);
    }

    if (sequences.length > 0) {
      const xs = tf.tensor3d(sequences);
      const ys = tf.tensor2d(targets, [targets.length, 1]);

      await model.fit(xs, ys, {
        epochs: 30,
        batchSize: 32,
        validationSplit: 0.2,
        verbose: 0,
      });

      xs.dispose();
      ys.dispose();
    }

    return model;
  }

  private async updateModels(): Promise<void> {
    for (const [metric, buffer] of this.dataBuffers.entries()) {
      if (buffer.length >= this.minDataPoints) {
        try {
          const model = await this.createAutoencoderModel(buffer);
          this.models.set(metric, model);
          this.emit("modelUpdated", { metric, timestamp: Date.now() });
        } catch (error) {
          this.emit("error", { metric, error });
        }
      }
    }
  }

  public getAnomalyHistory(metric: string, limit: number = 100): MetricPoint[] {
    const buffer = this.dataBuffers.get(metric);
    return buffer ? buffer.slice(-limit) : [];
  }

  public getStatistics(
    metric: string,
  ): { mean: number; std: number; min: number; max: number } | undefined {
    return this.statistics.get(metric);
  }

  public async evaluateMetrics(): Promise<Map<string, AnomalyResult[]>> {
    const results = new Map<string, AnomalyResult[]>();

    for (const [metric, buffer] of this.dataBuffers.entries()) {
      const metricResults: AnomalyResult[] = [];

      for (const point of buffer.slice(-10)) {
        const result = await this.detectAnomaly(metric, point);
        if (result.isAnomaly) {
          metricResults.push(result);
        }
      }

      if (metricResults.length > 0) {
        results.set(metric, metricResults);
      }
    }

    return results;
  }

  public dispose(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
    }

    for (const model of this.models.values()) {
      model.dispose();
    }

    this.models.clear();
    this.dataBuffers.clear();
    this.statistics.clear();
  }
}

// Singleton instance
let detectorInstance: AnomalyDetector | null = null;

export function getAnomalyDetector(config?: AnomalyConfig): AnomalyDetector {
  if (!detectorInstance) {
    detectorInstance = new AnomalyDetector(config);
  }
  return detectorInstance;
}
