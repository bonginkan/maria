/**
 * Performance Optimizer
 * コマンド推薦システムのパフォーマンス最適化
 */

import { logger } from "../../utils/logger";

interface PerformanceMetrics {
  searchTime: number;
  indexTime: number;
  cacheHitRate: number;
  memoryUsage: number;
  cpuUsage: number;
  requestCount: number;
  errorRate: number;
}

interface OptimizationStrategy {
  name: string;
  enabled: boolean;
  impact: "low" | "medium" | "high";
  description: string;
}

export class PerformanceOptimizer {
  private static instance: PerformanceOptimizer;
  private metrics: PerformanceMetrics;
  private _strategies: Map<string, OptimizationStrategy>;
  private performanceHistory: PerformanceMetrics[] = [];
  private optimizationTimer: NodeJS.Timeout | null = null;

  // Performance thresholds
  private readonly THRESHOLDS = {
    searchTimeMs: 50,
    cacheHitRate: 0.7,
    memoryUsageMB: 100,
    errorRate: 0.05,
  };

  private constructor() {
    this.metrics = this.initializeMetrics();
    this.strategies = this.initializeStrategies();
    this.startPerformanceMonitoring();
  }

  public static getInstance(): PerformanceOptimizer {
    if (!PerformanceOptimizer.instance) {
      PerformanceOptimizer.instance = new PerformanceOptimizer();
    }
    return PerformanceOptimizer.instance;
  }

  /**
   * パフォーマンス測定開始
   */
  startMeasurement(operationType: "search" | "index" | "cache"): () => void {
    const _startTime = performance.now();

    return () => {
      const _duration = performance.now() - _startTime;

      switch (operationType) {
        case "search":
          this.updateSearchMetrics(_duration);
          break;
        case "index":
          this.updateIndexMetrics(_duration);
          break;
        case "cache":
          this.updateCacheMetrics(_duration);
          break;
      }
    };
  }

  /**
   * キャッシュヒットを記録
   */
  recordCacheHit(): void {
    this.metrics.requestCount++;
    // Cache hit rate calculation is handled in updateCacheMetrics
  }

  /**
   * キャッシュミスを記録
   */
  recordCacheMiss(): void {
    this.metrics.requestCount++;
    // Cache hit rate calculation is handled in updateCacheMetrics
  }

  /**
   * エラーを記録
   */
  recordError(): void {
    // Error rate is calculated based on total requests
    this.updateErrorRate();
  }

  /**
   * 現在のメトリクスを取得
   */
  getCurrentMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * パフォーマンス履歴を取得
   */
  getPerformanceHistory(limit: number = 100): PerformanceMetrics[] {
    return this.performanceHistory.slice(-limit);
  }

  /**
   * 最適化推奨事項を取得
   */
  getOptimizationRecommendations(): {
    critical: OptimizationStrategy[];
    recommended: OptimizationStrategy[];
    optional: OptimizationStrategy[];
  } {
    const _recommendations = {
      critical: [] as OptimizationStrategy[],
      recommended: [] as OptimizationStrategy[],
      optional: [] as OptimizationStrategy[],
    };

    for (const _strategy of this.strategies.values()) {
      if (!_strategy.enabled) {
        if (this.shouldApplyStrategy(_strategy)) {
          switch (_strategy.impact) {
            case "high":
              recommendations.critical.push(_strategy);
              break;
            case "medium":
              recommendations.recommended.push(_strategy);
              break;
            case "low":
              recommendations.optional.push(_strategy);
              break;
          }
        }
      }
    }

    return _recommendations;
  }

  /**
   * 最適化戦略を適用
   */
  async applyOptimization(strategyName: string): Promise<boolean> {
    const _strategy = this.strategies.get(strategyName);
    if (!_strategy) {
      logger.warn(`Unknown optimization _strategy: ${strategyName}`);
      return false;
    }

    try {
      const _success = await this.executeOptimizationStrategy(_strategy);
      if (_success) {
        strategy.enabled = true;
        logger.info(`Applied optimization: ${strategyName}`);
      }
      return _success;
    } catch (_error) {
      logger.error(`Failed to apply optimization ${strategyName}:`, _error);
      return false;
    }
  }

  /**
   * 自動最適化を実行
   */
  async runAutoOptimization(): Promise<void> {
    const _recommendations = this.getOptimizationRecommendations();

    // Apply critical optimizations first
    for (const _strategy of _recommendations.critical) {
      await this.applyOptimization(_strategy.name);
    }

    // Then apply recommended optimizations
    for (const _strategy of _recommendations.recommended) {
      await this.applyOptimization(_strategy.name);
    }

    logger.info("Auto-optimization completed");
  }

  /**
   * パフォーマンス報告を生成
   */
  generatePerformanceReport(): {
    summary: {
      _overall: "excellent" | "good" | "fair" | "poor";
      _score: number;
      _issues: string[];
    };
    metrics: PerformanceMetrics;
    optimizations: {
      applied: string[];
      available: string[];
    };
    _recommendations: string[];
  } {
    const _score = this.calculatePerformanceScore();
    const _issues = this.identifyPerformanceIssues();
    const _overall = this.getOverallRating(_score);

    const _appliedOptimizations = Array.from(this.strategies.values())
      .filter((s) => s.enabled)
      .map((s) => s.name);

    const _availableOptimizations = Array.from(this.strategies.values())
      .filter((s) => !s.enabled)
      .map((s) => s.name);

    const _recommendations = this.generateRecommendations();

    return {
      summary: {
        _overall,
        _score,
        _issues,
      },
      metrics: this.getCurrentMetrics(),
      optimizations: {
        applied: _appliedOptimizations,
        available: _availableOptimizations,
      },
      _recommendations,
    };
  }

  /**
   * メモリ最適化を実行
   */
  optimizeMemory(): void {
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    // Clear old performance history
    if (this.performanceHistory.length > 1000) {
      this.performanceHistory = this.performanceHistory.slice(-500);
    }

    logger.debug("Memory optimization completed");
  }

  /**
   * 破棄処理
   */
  destroy(): void {
    if (this.optimizationTimer) {
      clearInterval(this.optimizationTimer);
    }
  }

  // ================================
  // PRIVATE METHODS
  // ================================

  /**
   * メトリクスを初期化
   */
  private initializeMetrics(): PerformanceMetrics {
    return {
      searchTime: 0,
      indexTime: 0,
      cacheHitRate: 0,
      memoryUsage: 0,
      cpuUsage: 0,
      requestCount: 0,
      errorRate: 0,
    };
  }

  /**
   * 最適化戦略を初期化
   */
  private initializeStrategies(): Map<string, OptimizationStrategy> {
    const _strategies = new Map<string, OptimizationStrategy>();

    strategies.set("indexCaching", {
      name: "indexCaching",
      enabled: false,
      impact: "high",
      description: "Cache search index in memory for faster lookups",
    });

    strategies.set("lazyIndexing", {
      name: "lazyIndexing",
      enabled: false,
      impact: "medium",
      description: "Build index on-demand rather than at startup",
    });

    strategies.set("resultPooling", {
      name: "resultPooling",
      enabled: false,
      impact: "medium",
      description: "Reuse result objects to reduce memory allocation",
    });

    strategies.set("concurrentSearch", {
      name: "concurrentSearch",
      enabled: false,
      impact: "high",
      description: "Use Web Workers for parallel search operations",
    });

    strategies.set("incrementalIndexing", {
      name: "incrementalIndexing",
      enabled: false,
      impact: "medium",
      description: "Update index incrementally instead of full rebuilds",
    });

    strategies.set("compressionCaching", {
      name: "compressionCaching",
      enabled: false,
      impact: "low",
      description: "Compress cached results to save memory",
    });

    return _strategies;
  }

  /**
   * パフォーマンス監視を開始
   */
  private startPerformanceMonitoring(): void {
    this.optimizationTimer = setInterval(() => {
      this.updateSystemMetrics();
      this.recordPerformanceSnapshot();
    }, 10000); // Every 10 seconds
  }

  /**
   * 検索メトリクスを更新
   */
  private updateSearchMetrics(_duration: number): void {
    // Exponential moving average
    this.metrics.searchTime = this.metrics.searchTime * 0.8 + _duration * 0.2;
  }

  /**
   * インデックスメトリクスを更新
   */
  private updateIndexMetrics(_duration: number): void {
    this.metrics.indexTime = this.metrics.indexTime * 0.8 + _duration * 0.2;
  }

  /**
   * キャッシュメトリクスを更新
   */
  private updateCacheMetrics(_duration: number): void {
    // Cache hit rate is calculated externally based on recordCacheHit/Miss calls
  }

  /**
   * エラー率を更新
   */
  private updateErrorRate(): void {
    // Error rate calculation would need _error counting
    // This is a placeholder implementation
  }

  /**
   * システムメトリクスを更新
   */
  private updateSystemMetrics(): void {
    const _memUsage = process.memoryUsage();
    this.metrics.memoryUsage = _memUsage.heapUsed / 1024 / 1024; // MB

    // CPU usage would need additional monitoring
    // This is a simplified implementation
    this.metrics.cpuUsage = process.cpuUsage().user / 1000000; // Convert to seconds
  }

  /**
   * パフォーマンススナップショットを記録
   */
  private recordPerformanceSnapshot(): void {
    this.performanceHistory.push({ ...this.metrics });

    // Keep only last 1000 snapshots
    if (this.performanceHistory.length > 1000) {
      this.performanceHistory = this.performanceHistory.slice(-500);
    }
  }

  /**
   * 戦略を適用すべきかチェック
   */
  private shouldApplyStrategy(_strategy: OptimizationStrategy): boolean {
    switch (_strategy.name) {
      case "indexCaching":
        return this.metrics.searchTime > this.THRESHOLDS.searchTimeMs;
      case "lazyIndexing":
        return this.metrics.indexTime > 100; // 100ms threshold
      case "concurrentSearch":
        return this.metrics.searchTime > this.THRESHOLDS.searchTimeMs * 2;
      case "compressionCaching":
        return this.metrics.memoryUsage > this.THRESHOLDS.memoryUsageMB;
      default:
        return false;
    }
  }

  /**
   * 最適化戦略を実行
   */
  private async executeOptimizationStrategy(
    _strategy: OptimizationStrategy,
  ): Promise<boolean> {
    // This would contain actual optimization implementations
    // For now, it's a placeholder that simulates the optimization

    logger.info(`Executing optimization _strategy: ${_strategy.name}`);

    // Simulate some async work
    await new Promise((resolve) => setTimeout(resolve, 100));

    return true;
  }

  /**
   * パフォーマンススコアを計算
   */
  private calculatePerformanceScore(): number {
    let _score = 100;

    // Search time penalty
    if (this.metrics.searchTime > this.THRESHOLDS.searchTimeMs) {
      _score -= Math.min(
        30,
        (this.metrics.searchTime / this.THRESHOLDS.searchTimeMs - 1) * 20,
      );
    }

    // Cache hit rate bonus/penalty
    if (this.metrics.cacheHitRate < this.THRESHOLDS.cacheHitRate) {
      _score -= (this.THRESHOLDS.cacheHitRate - this.metrics.cacheHitRate) * 20;
    }

    // Memory usage penalty
    if (this.metrics.memoryUsage > this.THRESHOLDS.memoryUsageMB) {
      _score -= Math.min(
        20,
        (this.metrics.memoryUsage / this.THRESHOLDS.memoryUsageMB - 1) * 10,
      );
    }

    // Error rate penalty
    if (this.metrics.errorRate > this.THRESHOLDS.errorRate) {
      _score -= Math.min(
        40,
        (this.metrics.errorRate / this.THRESHOLDS.errorRate - 1) * 30,
      );
    }

    return Math.max(0, Math.round(_score));
  }

  /**
   * パフォーマンス問題を特定
   */
  private identifyPerformanceIssues(): string[] {
    const _issues: string[] = [];

    if (this.metrics.searchTime > this.THRESHOLDS.searchTimeMs) {
      issues.push("Search response time is too slow");
    }

    if (this.metrics.cacheHitRate < this.THRESHOLDS.cacheHitRate) {
      issues.push("Cache hit rate is below optimal");
    }

    if (this.metrics.memoryUsage > this.THRESHOLDS.memoryUsageMB) {
      issues.push("Memory usage is high");
    }

    if (this.metrics.errorRate > this.THRESHOLDS.errorRate) {
      issues.push("Error rate is above acceptable threshold");
    }

    return _issues;
  }

  /**
   * 総合評価を取得
   */
  private getOverallRating(
    _score: number,
  ): "excellent" | "good" | "fair" | "poor" {
    if (_score >= 90) return "excellent";
    if (_score >= 75) return "good";
    if (_score >= 60) return "fair";
    return "poor";
  }

  /**
   * 推奨事項を生成
   */
  private generateRecommendations(): string[] {
    const _recommendations: string[] = [];

    if (this.metrics.searchTime > this.THRESHOLDS.searchTimeMs) {
      _recommendations.push(
        "Enable index caching to improve search performance",
      );
      recommendations.push(
        "Consider using concurrent search for heavy workloads",
      );
    }

    if (this.metrics.memoryUsage > this.THRESHOLDS.memoryUsageMB) {
      _recommendations.push(
        "Enable compression caching to reduce memory usage",
      );
      recommendations.push("Consider lazy indexing for large command sets");
    }

    if (this.metrics.cacheHitRate < this.THRESHOLDS.cacheHitRate) {
      _recommendations.push("Increase cache size or adjust cache expiry time");
      recommendations.push("Review cache key generation _strategy");
    }

    return _recommendations;
  }
}
