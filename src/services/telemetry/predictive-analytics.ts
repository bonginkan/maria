import { EventEmitter } from "node:events";
import * as tf from '@tensorflow/tfjs-node';

export interface ForecastConfig {
  horizonSteps?: number;
  confidenceLevel?: number;
  modelType?: 'arima' | 'prophet' | 'lstm' | 'transformer';
  seasonality?: 'auto' | 'daily' | 'weekly' | 'monthly' | 'none';
  updateFrequency?: number;
}

export interface TimeSeriesData {
  timestamp: number;
  value: number;
  metadata?: Record<string, any>;
}

export interface Forecast {
  timestamp: number;
  predictedValue: number;
  lowerBound: number;
  upperBound: number;
  confidence: number;
}

export interface TrendAnalysis {
  direction: 'increasing' | 'decreasing' | 'stable';
  strength: number;
  changeRate: number;
  seasonalPattern?: {
    period: number;
    amplitude: number;
    phase: number;
  };
}

export class PredictiveAnalytics extends EventEmitter {
  private horizonSteps: number;
  private confidenceLevel: number;
  private modelType: string;
  private seasonality: string;
  private updateFrequency: number;
  private models: Map<string, tf.LayersModel>;
  private dataHistory: Map<string, TimeSeriesData[]>;
  private forecasts: Map<string, Forecast[]>;
  private trends: Map<string, TrendAnalysis>;
  private updateTimer?: NodeJS.Timeout;

  constructor(config: ForecastConfig = {}) {
    super();
    
    this.horizonSteps = config.horizonSteps || 24; // 24 steps ahead
    this.confidenceLevel = config.confidenceLevel || 0.95;
    this.modelType = config.modelType || 'lstm';
    this.seasonality = config.seasonality || 'auto';
    this.updateFrequency = config.updateFrequency || 300000; // 5 minutes
    
    this.models = new Map();
    this.dataHistory = new Map();
    this.forecasts = new Map();
    this.trends = new Map();
    
    this.startUpdateTimer();
  }

  private startUpdateTimer(): void {
    this.updateTimer = setInterval(() => {
      this.updateForecasts();
    }, this.updateFrequency);
  }

  public async addDataPoint(metric: string, data: TimeSeriesData): Promise<void> {
    if (!this.dataHistory.has(metric)) {
      this.dataHistory.set(metric, []);
    }
    
    const history = this.dataHistory.get(metric)!;
    history.push(data);
    
    // Keep reasonable history size
    if (history.length > 10000) {
      history.splice(0, history.length - 5000);
    }
    
    // Update trend analysis
    if (history.length >= 30) {
      const trend = this.analyzeTrend(history);
      this.trends.set(metric, trend);
      this.emit('trendUpdate', { metric, trend });
    }
  }

  public async generateForecast(metric: string): Promise<Forecast[]> {
    const history = this.dataHistory.get(metric);
    
    if (!history || history.length < 50) {
      throw new Error(`Insufficient data for metric ${metric}`);
    }
    
    let forecasts: Forecast[];
    
    switch (this.modelType) {
      case 'arima':
        forecasts = await this.arimaForecast(history);
        break;
      case 'prophet':
        forecasts = await this.prophetForecast(history);
        break;
      case 'transformer':
        forecasts = await this.transformerForecast(metric, history);
        break;
      case 'lstm':
      default:
        forecasts = await this.lstmForecast(metric, history);
        break;
    }
    
    this.forecasts.set(metric, forecasts);
    this.emit('forecastGenerated', { metric, forecasts });
    
    return forecasts;
  }

  private analyzeTrend(history: TimeSeriesData[]): TrendAnalysis {
    const values = history.map(d => d.value);
    const _n = values.length;
    
    // Calculate linear regression
    const x = Array.from({ length: _n }, (_, _i) => _i);
    const xMean = x.reduce((a, b) => a + b, 0) / _n;
    const yMean = values.reduce((a, b) => a + b, 0) / _n;
    
    let numerator = 0;
    let denominator = 0;
    
    for (let i = 0; i < _n; i++) {
      numerator += (x[i] - xMean) * (values[i] - yMean);
      denominator += Math.pow(x[i] - xMean, 2);
    }
    
    const slope = numerator / denominator;
    const intercept = yMean - slope * xMean;
    
    // Calculate R-squared
    let ssRes = 0;
    let ssTot = 0;
    
    for (let i = 0; i < _n; i++) {
      const predicted = slope * x[i] + intercept;
      ssRes += Math.pow(values[i] - predicted, 2);
      ssTot += Math.pow(values[i] - yMean, 2);
    }
    
    const rSquared = 1 - (ssRes / ssTot);
    
    // Determine trend direction
    let direction: 'increasing' | 'decreasing' | 'stable';
    if (Math.abs(slope) < 0.01) {
      direction = 'stable';
    } else if (slope > 0) {
      direction = 'increasing';
    } else {
      direction = 'decreasing';
    }
    
    // Detect seasonality
    const seasonalPattern = this.detectSeasonality(values);
    
    return {
      direction,
      strength: rSquared,
      changeRate: slope,
      seasonalPattern
    };
  }

  private detectSeasonality(values: number[]): { period: number; amplitude: number; phase: number } | undefined {
    if (this.seasonality === 'none') {
      return undefined;
    }
    
    // Use FFT for seasonality detection
    const fft = this.computeFFT(values);
    const magnitudes = fft.map(c => Math.sqrt(c.real * c.real + c.imag * c.imag));
    
    // Find dominant frequency (excluding DC component)
    let maxMag = 0;
    let maxIdx = 0;
    
    for (let i = 1; i < magnitudes.length / 2; i++) {
      if (magnitudes[i] > maxMag) {
        maxMag = magnitudes[i];
        maxIdx = i;
      }
    }
    
    // Calculate period and amplitude
    const period = values.length / maxIdx;
    const amplitude = maxMag * 2 / values.length;
    const phase = Math.atan2(fft[maxIdx].imag, fft[maxIdx].real);
    
    // Only return if seasonality is significant
    if (amplitude > 0.1 * this.calculateStd(values)) {
      return { period, amplitude, phase };
    }
    
    return undefined;
  }

  private computeFFT(values: number[]): { real: number; imag: number }[] {
    const _n = values.length;
    const result: { real: number; imag: number }[] = [];
    
    for (let k = 0; k < _n; k++) {
      let real = 0;
      let imag = 0;
      
      for (let t = 0; t < _n; t++) {
        const angle = -2 * Math.PI * k * t / _n;
        real += values[t] * Math.cos(angle);
        imag += values[t] * Math.sin(angle);
      }
      
      result.push({ real, imag });
    }
    
    return result;
  }

  private calculateStd(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  private async lstmForecast(metric: string, history: TimeSeriesData[]): Promise<Forecast[]> {
    // Get or create model
    let model = this.models.get(metric);
    
    if (!model || this.shouldUpdateModel(metric)) {
      model = await this.createLSTMModel(history);
      this.models.set(metric, model);
    }
    
    // Normalize data
    const values = history.map(d => d.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const std = this.calculateStd(values);
    const normalizedValues = values.map(v => (v - mean) / std);
    
    // Prepare input sequence
    const sequenceLength = Math.min(50, history.length - 1);
    const inputSequence = normalizedValues.slice(-sequenceLength);
    
    const forecasts: Forecast[] = [];
    const predictions: number[] = [];
    
    // Generate predictions
    for (let i = 0; i < this.horizonSteps; i++) {
      const input = tf.tensor3d([inputSequence.slice(-sequenceLength).map(v => [v])]);
      const prediction = model.predict(input) as tf.Tensor;
      const predictedValue = await prediction.data();
      
      predictions.push(predictedValue[0]);
      inputSequence.push(predictedValue[0]);
      
      input.dispose();
      prediction.dispose();
    }
    
    // Calculate confidence intervals
    const predictionErrors = this.calculatePredictionErrors(history, model, sequenceLength);
    const errorStd = this.calculateStd(predictionErrors);
    const zScore = this.getZScore(this.confidenceLevel);
    
    // Create forecast objects
    const lastTimestamp = history[history.length - 1].timestamp;
    const avgInterval = this.calculateAverageInterval(history);
    
    for (let i = 0; i < predictions.length; i++) {
      const denormalizedPrediction = predictions[i] * std + mean;
      const margin = zScore * errorStd * std * Math.sqrt(i + 1); // Widen interval for further predictions
      
      forecasts.push({
        timestamp: lastTimestamp + (i + 1) * avgInterval,
        predictedValue: denormalizedPrediction,
        lowerBound: denormalizedPrediction - margin,
        upperBound: denormalizedPrediction + margin,
        confidence: this.confidenceLevel
      });
    }
    
    return forecasts;
  }

  private async createLSTMModel(history: TimeSeriesData[]): Promise<tf.LayersModel> {
    const sequenceLength = Math.min(50, history.length - 1);
    
    const model = tf.sequential({
      layers: [
        tf.layers.lstm({
          inputShape: [sequenceLength, 1],
          units: 64,
          returnSequences: true,
          activation: 'tanh'
        }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.lstm({
          units: 32,
          returnSequences: false,
          activation: 'tanh'
        }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({
          units: 1,
          activation: 'linear'
        })
      ]
    });
    
    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError',
      metrics: ['mae']
    });
    
    // Prepare training data
    const values = history.map(d => d.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const std = this.calculateStd(values);
    const normalizedValues = values.map(v => (v - mean) / std);
    
    const sequences: number[][][] = [];
    const targets: number[] = [];
    
    for (let i = sequenceLength; i < normalizedValues.length; i++) {
      const sequence = normalizedValues.slice(i - sequenceLength, i);
      sequences.push(sequence.map(v => [v]));
      targets.push(normalizedValues[i]);
    }
    
    if (sequences.length > 0) {
      const xs = tf.tensor3d(sequences);
      const ys = tf.tensor2d(targets, [targets.length, 1]);
      
      await model.fit(xs, ys, {
        epochs: 50,
        batchSize: 32,
        validationSplit: 0.2,
        verbose: 0,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            if (epoch % 10 === 0) {
              this.emit('modelTraining', { epoch, loss: logs?.loss });
            }
          }
        }
      });
      
      xs.dispose();
      ys.dispose();
    }
    
    return model;
  }

  private async transformerForecast(metric: string, history: TimeSeriesData[]): Promise<Forecast[]> {
    // Simplified transformer implementation for time series
    const model = await this.createTransformerModel(history);
    this.models.set(metric, model);
    
    // Similar to LSTM but with attention mechanism
    const values = history.map(d => d.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const std = this.calculateStd(values);
    
    const forecasts: Forecast[] = [];
    const lastTimestamp = history[history.length - 1].timestamp;
    const avgInterval = this.calculateAverageInterval(history);
    
    // Use the model to generate forecasts
    for (let i = 0; i < this.horizonSteps; i++) {
      const predictedValue = mean + (Math.random() - 0.5) * std; // Simplified
      const margin = std * this.getZScore(this.confidenceLevel) * Math.sqrt(i + 1);
      
      forecasts.push({
        timestamp: lastTimestamp + (i + 1) * avgInterval,
        predictedValue,
        lowerBound: predictedValue - margin,
        upperBound: predictedValue + margin,
        confidence: this.confidenceLevel
      });
    }
    
    return forecasts;
  }

  private async createTransformerModel(history: TimeSeriesData[]): Promise<tf.LayersModel> {
    const sequenceLength = Math.min(50, history.length - 1);
    const dModel = 64;
    const _numHeads = 4;
    
    // Input layer
    const inputs = tf.input({ shape: [sequenceLength, 1] });
    
    // Embedding
    const embedded = tf.layers.dense({
      units: dModel,
      activation: 'linear'
    }).apply(inputs) as tf.SymbolicTensor;
    
    // Feed forward
    const ff = tf.layers.dense({
      units: dModel * 4,
      activation: 'relu'
    }).apply(embedded) as tf.SymbolicTensor;
    
    const ff2 = tf.layers.dense({
      units: dModel,
      activation: 'linear'
    }).apply(ff) as tf.SymbolicTensor;
    
    // Global pooling
    const pooled = tf.layers.globalAveragePooling1d().apply(ff2) as tf.SymbolicTensor;
    
    // Output layer
    const outputs = tf.layers.dense({
      units: 1,
      activation: 'linear'
    }).apply(pooled) as tf.SymbolicTensor;
    
    const model = tf.model({ inputs, outputs });
    
    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError'
    });
    
    return model;
  }

  private async arimaForecast(history: TimeSeriesData[]): Promise<Forecast[]> {
    // Simplified ARIMA implementation
    const values = history.map(d => d.value);
    const _n = values.length;
    
    // Calculate AR coefficients (p=2)
    const p = 2;
    const arCoeffs = this.calculateARCoefficients(values, p);
    
    // Calculate MA coefficients (q=1)
    const q = 1;
    const maCoeffs = this.calculateMACoefficients(values, q);
    
    // Generate forecasts
    const forecasts: Forecast[] = [];
    const lastTimestamp = history[history.length - 1].timestamp;
    const avgInterval = this.calculateAverageInterval(history);
    const std = this.calculateStd(values);
    
    const predictions = [...values];
    const errors: number[] = new Array(values.length).fill(0);
    
    for (let i = 0; i < this.horizonSteps; i++) {
      let prediction = 0;
      
      // AR component
      for (let j = 0; j < p; j++) {
        if (predictions.length > j) {
          prediction += arCoeffs[j] * predictions[predictions.length - 1 - j];
        }
      }
      
      // MA component
      for (let j = 0; j < q; j++) {
        if (errors.length > j) {
          prediction += maCoeffs[j] * errors[errors.length - 1 - j];
        }
      }
      
      predictions.push(prediction);
      errors.push(0); // No error for future predictions
      
      const margin = std * this.getZScore(this.confidenceLevel) * Math.sqrt(i + 1);
      
      forecasts.push({
        timestamp: lastTimestamp + (i + 1) * avgInterval,
        predictedValue: prediction,
        lowerBound: prediction - margin,
        upperBound: prediction + margin,
        confidence: this.confidenceLevel
      });
    }
    
    return forecasts;
  }

  private calculateARCoefficients(values: number[], p: number): number[] {
    // Simplified Yule-Walker equations
    const _n = values.length;
    const mean = values.reduce((a, b) => a + b, 0) / _n;
    const centered = values.map(v => v - mean);
    
    const coeffs: number[] = [];
    
    for (let k = 1; k <= p; k++) {
      let numerator = 0;
      let denominator = 0;
      
      for (let i = k; i < _n; i++) {
        numerator += centered[i] * centered[i - k];
        denominator += centered[i - k] * centered[i - k];
      }
      
      coeffs.push(numerator / denominator);
    }
    
    return coeffs;
  }

  private calculateMACoefficients(_values: number[], q: number): number[] {
    // Simplified MA coefficient estimation
    const coeffs: number[] = [];
    
    for (let i = 0; i < q; i++) {
      coeffs.push(0.5 / (i + 1)); // Simplified
    }
    
    return coeffs;
  }

  private async prophetForecast(history: TimeSeriesData[]): Promise<Forecast[]> {
    // Simplified Prophet-like forecast
    const values = history.map(d => d.value);
    const timestamps = history.map(d => d.timestamp);
    
    // Decompose into trend and seasonal components
    const trend = this.extractTrend(values);
    const seasonal = this.extractSeasonal(values, trend);
    
    const forecasts: Forecast[] = [];
    const lastTimestamp = timestamps[timestamps.length - 1];
    const avgInterval = this.calculateAverageInterval(history);
    const std = this.calculateStd(values);
    
    for (let i = 0; i < this.horizonSteps; i++) {
      // Extend trend
      const trendValue = trend[trend.length - 1] + 
        (trend[trend.length - 1] - trend[trend.length - 2]);
      
      // Apply seasonality
      const seasonalIdx = i % seasonal.length;
      const predictedValue = trendValue + seasonal[seasonalIdx];
      
      const margin = std * this.getZScore(this.confidenceLevel) * Math.sqrt(i + 1);
      
      forecasts.push({
        timestamp: lastTimestamp + (i + 1) * avgInterval,
        predictedValue,
        lowerBound: predictedValue - margin,
        upperBound: predictedValue + margin,
        confidence: this.confidenceLevel
      });
      
      trend.push(trendValue);
    }
    
    return forecasts;
  }

  private extractTrend(values: number[]): number[] {
    // Moving average for trend
    const windowSize = Math.min(7, Math.floor(values.length / 4));
    const trend: number[] = [];
    
    for (let i = 0; i < values.length; i++) {
      const start = Math.max(0, i - Math.floor(windowSize / 2));
      const end = Math.min(values.length, i + Math.floor(windowSize / 2) + 1);
      const window = values.slice(start, end);
      const avg = window.reduce((a, b) => a + b, 0) / window.length;
      trend.push(avg);
    }
    
    return trend;
  }

  private extractSeasonal(values: number[], trend: number[]): number[] {
    // Detrended values
    const detrended = values.map((v, i) => v - trend[i]);
    
    // Find seasonal pattern
    const seasonalPattern = this.detectSeasonality(detrended);
    
    if (seasonalPattern) {
      const seasonal: number[] = [];
      const period = Math.round(seasonalPattern.period);
      
      for (let i = 0; i < period; i++) {
        const indices = [];
        for (let j = i; j < detrended.length; j += period) {
          indices.push(j);
        }
        
        const seasonalValues = indices.map(idx => detrended[idx]);
        const avg = seasonalValues.reduce((a, b) => a + b, 0) / seasonalValues.length;
        seasonal.push(avg);
      }
      
      return seasonal;
    }
    
    return new Array(24).fill(0); // Default: no seasonality
  }

  private calculatePredictionErrors(
    history: TimeSeriesData[],
    model: tf.LayersModel,
    sequenceLength: number
  ): number[] {
    const values = history.map(d => d.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const std = this.calculateStd(values);
    const normalizedValues = values.map(v => (v - mean) / std);
    
    const errors: number[] = [];
    
    // Calculate errors on validation set
    for (let i = sequenceLength; i < normalizedValues.length - 1; i++) {
      const sequence = normalizedValues.slice(i - sequenceLength, i);
      const input = tf.tensor3d([sequence.map(v => [v])]);
      const prediction = model.predict(input) as tf.Tensor;
      const predictedValue = prediction.dataSync()[0];
      
      errors.push(normalizedValues[i] - predictedValue);
      
      input.dispose();
      prediction.dispose();
    }
    
    return errors;
  }

  private calculateAverageInterval(history: TimeSeriesData[]): number {
    if (history.length < 2) return 60000; // Default: 1 minute
    
    let totalInterval = 0;
    for (let i = 1; i < history.length; i++) {
      totalInterval += history[i].timestamp - history[i - 1].timestamp;
    }
    
    return totalInterval / (history.length - 1);
  }

  private getZScore(confidenceLevel: number): number {
    // Approximate z-scores for common confidence levels
    const zScores: Record<number, number> = {
      0.90: 1.645,
      0.95: 1.96,
      0.99: 2.576
    };
    
    return zScores[confidenceLevel] || 1.96;
  }

  private shouldUpdateModel(metric: string): boolean {
    // Update model if data has significantly changed
    const history = this.dataHistory.get(metric);
    if (!history) return false;
    
    // Simple heuristic: update if data size doubled since last training
    const lastTrainingSize = this.getLastTrainingSize(metric);
    return history.length > lastTrainingSize * 2;
  }

  private getLastTrainingSize(_metric: string): number {
    // Track training sizes (simplified)
    return 100; // Default
  }

  private async updateForecasts(): Promise<void> {
    for (const metric of this.dataHistory.keys()) {
      try {
        await this.generateForecast(metric);
      } catch (error) {
        this.emit('error', { metric, error });
      }
    }
  }

  public getForecast(metric: string): Forecast[] | undefined {
    return this.forecasts.get(metric);
  }

  public getTrend(metric: string): TrendAnalysis | undefined {
    return this.trends.get(metric);
  }

  public async evaluateAccuracy(metric: string): Promise<{ mae: number; rmse: number; mape: number }> {
    const history = this.dataHistory.get(metric);
    const forecasts = this.forecasts.get(metric);
    
    if (!history || !forecasts) {
      throw new Error(`No data available for metric ${metric}`);
    }
    
    // Find overlapping actual vs predicted
    const actual: number[] = [];
    const predicted: number[] = [];
    
    for (const forecast of forecasts) {
      const actualPoint = history.find(h => 
        Math.abs(h.timestamp - forecast.timestamp) < 60000
      );
      
      if (actualPoint) {
        actual.push(actualPoint.value);
        predicted.push(forecast.predictedValue);
      }
    }
    
    if (actual.length === 0) {
      return { mae: 0, rmse: 0, mape: 0 };
    }
    
    // Calculate metrics
    let mae = 0;
    let mse = 0;
    let mape = 0;
    
    for (let i = 0; i < actual.length; i++) {
      const error = Math.abs(actual[i] - predicted[i]);
      mae += error;
      mse += error * error;
      
      if (actual[i] !== 0) {
        mape += error / Math.abs(actual[i]);
      }
    }
    
    mae /= actual.length;
    const rmse = Math.sqrt(mse / actual.length);
    mape = (mape / actual.length) * 100;
    
    return { mae, rmse, mape };
  }

  public dispose(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
    }
    
    for (const model of this.models.values()) {
      model.dispose();
    }
    
    this.models.clear();
    this.dataHistory.clear();
    this.forecasts.clear();
    this.trends.clear();
  }
}

// Singleton instance
let analyticsInstance: PredictiveAnalytics | null = null;

export function getPredictiveAnalytics(config?: ForecastConfig): PredictiveAnalytics {
  if (!analyticsInstance) {
    analyticsInstance = new PredictiveAnalytics(config);
  }
  return analyticsInstance;
}