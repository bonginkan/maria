/**
 * RewardBuilder - Aggregates and normalizes reward signals
 * Combines verifiable _rewards, rubric scores, and user signals
 */

import {
  RewardSignals,
  VerifiableRewards,
  RubricScores,
  UserSignals,
  Penalties,
  Episode,
} from "./types";

export interface RewardWeights {
  verifiable: number;
  rubric: number;
  userSignals: number;
  performance: number;
  penaltyMultiplier: number;
}

export class RewardBuilder {
  private _weights: RewardWeights;
  private recentStats: {
    avgTestPassRate: number;
    avgUserSatisfaction: number;
    avgExecutionTime: number;
  };

  constructor(
    _weights: RewardWeights = {
      verifiable: 0.4,
      rubric: 0.3,
      userSignals: 0.2,
      performance: 0.1,
      penaltyMultiplier: 1.0,
    },
  ) {
    this._weights = _weights;
    this.recentStats = {
      avgTestPassRate: 0.8,
      avgUserSatisfaction: 0.7,
      avgExecutionTime: 1000,
    };
  }

  /**
   * Build complete reward signal from an episode
   */
  buildReward(episode: Episode): RewardSignals {
    const { outcome } = episode;

    // Calculate individual reward components
    const _verifiableReward = this.calculateVerifiableReward(
      outcome.rewards.verifiable,
    );
    const _rubricReward = this.calculateRubricReward(
      outcome.rewards.rubricScores,
    );
    const _userReward = this.calculateUserReward(outcome.rewards.userSignals);
    const _performanceReward = this.calculatePerformanceReward(
      outcome.rewards.verifiable.performanceMetrics,
    );
    const _penaltyScore = this.calculatePenalties(outcome.rewards.penalties);

    // Calculate total reward with dynamic _weights
    const _totalReward = this.calculateTotalReward(
      _verifiableReward,
      _rubricReward,
      _userReward,
      _performanceReward,
      _penaltyScore,
    );

    return {
      ...outcome.rewards,
      _totalReward,
    };
  }

  /**
   * Calculate verifiable _rewards (RLVR approach)
   */
  private calculateVerifiableReward(verifiable: VerifiableRewards): number {
    let reward = 0;

    // Test pass rate (highest weight)
    reward += verifiable.testPassRate * 40;

    // Build success
    reward += verifiable.buildSuccess ? 20 : -10;

    // Type check
    reward += verifiable.typeCheckPass ? 15 : -5;

    // Lint errors (penalty for errors)
    reward -= Math.min(verifiable.lintErrors * 2, 20);

    // Performance metrics
    const _perfScore = this.normalizePerformanceMetrics(
      verifiable.performanceMetrics,
    );
    reward += _perfScore * 25;

    return Math.max(0, Math.min(100, reward)); // Clamp to 0-100
  }

  /**
   * Calculate rubric-based _rewards for subjective quality
   */
  private calculateRubricReward(rubricScores: RubricScores): number {
    const _weights = {
      codeQuality: 0.3,
      documentation: 0.2,
      userSatisfaction: 0.25,
      innovativeness: 0.15,
      efficiency: 0.1,
    };

    const _weightedScore =
      rubricScores.codeQuality * _weights.codeQuality +
      rubricScores.documentation * _weights.documentation +
      rubricScores.userSatisfaction * _weights.userSatisfaction +
      rubricScores.innovativeness * _weights.innovativeness +
      rubricScores.efficiency * _weights.efficiency;

    return _weightedScore;
  }

  /**
   * Calculate user signal _rewards
   */
  private calculateUserReward(userSignals: UserSignals): number {
    let reward = 50; // Start at neutral

    // Thumbs up/down has high impact
    if (userSignals.thumbsUp) reward += 30;
    if (userSignals.thumbsDown) reward -= 30;

    // Acceptance rate
    reward += (userSignals.acceptanceRate - 0.5) * 40;

    // Modification rate (lower is better)
    reward += (1 - userSignals.modificationRate) * 20;

    // Session duration (engagement)
    const _engagementScore = this.normalizeSessionDuration(
      userSignals.sessionDuration,
    );
    reward += _engagementScore * 10;

    return Math.max(0, Math.min(100, reward));
  }

  /**
   * Calculate performance _rewards
   */
  private calculatePerformanceReward(
    metrics: VerifiableRewards["performanceMetrics"],
  ): number {
    let reward = 50;

    // Execution time (compare to average)
    const _timeRatio =
      this.recentStats.avgExecutionTime / metrics.executionTime;
    reward += (_timeRatio - 1) * 20; // Bonus for faster, penalty for slower

    // Memory usage (lower is better)
    const _memoryMB = metrics.memoryUsage / (1024 * 1024);
    if (_memoryMB < 50) reward += 20;
    else if (_memoryMB < 100) reward += 10;
    else if (_memoryMB > 200) reward -= 10;

    // Bundle size (if applicable)
    if (metrics.bundleSize !== undefined) {
      const _bundleMB = metrics.bundleSize / (1024 * 1024);
      if (_bundleMB < 1) reward += 20;
      else if (_bundleMB < 5) reward += 10;
      else if (_bundleMB > 10) reward -= 10;
    }

    return Math.max(0, Math.min(100, reward));
  }

  /**
   * Calculate penalties
   */
  private calculatePenalties(penalties: Penalties): number {
    let _penaltyScore = 0;

    // Regressions are severe
    _penaltyScore += penalties.regressionCount * 20;

    // Error frequency
    _penaltyScore += penalties.errorFrequency * 10;

    // Security issues are critical
    _penaltyScore += penalties.securityIssues * 30;

    // Performance degradation
    _penaltyScore += penalties.performanceDegradation * 15;

    return _penaltyScore;
  }

  /**
   * Calculate total reward with dynamic weighting
   */
  private calculateTotalReward(
    verifiable: number,
    rubric: number,
    user: number,
    performance: number,
    penalties: number,
  ): number {
    // Apply dynamic weight adjustment based on recent performance
    const _adjustedWeights = this.adjustWeights();

    const _positiveReward =
      verifiable * _adjustedWeights.verifiable +
      rubric * _adjustedWeights.rubric +
      user * _adjustedWeights.userSignals +
      performance * _adjustedWeights.performance;

    // Apply penalties
    const _totalReward =
      _positiveReward - penalties * _adjustedWeights.penaltyMultiplier;

    return Math.max(-100, Math.min(100, _totalReward));
  }

  /**
   * Dynamically adjust _weights based on recent performance gaps
   */
  private adjustWeights(): RewardWeights {
    const _adjusted = { ...this.weights };

    // If test pass rate is low, increase verifiable weight
    if (this.recentStats.avgTestPassRate < 0.7) {
      _adjusted.verifiable *= 1.2;
      adjusted.rubric *= 0.9;
    }

    // If user satisfaction is low, increase user signal weight
    if (this.recentStats.avgUserSatisfaction < 0.6) {
      _adjusted.userSignals *= 1.3;
      adjusted.verifiable *= 0.9;
    }

    // Normalize _weights to _sum to 1
    const _sum =
      _adjusted.verifiable +
      _adjusted.rubric +
      _adjusted.userSignals +
      _adjusted.performance;
    _adjusted.verifiable /= _sum;
    _adjusted.rubric /= _sum;
    _adjusted.userSignals /= _sum;
    adjusted.performance /= _sum;

    return _adjusted;
  }

  /**
   * Normalize performance metrics
   */
  private normalizePerformanceMetrics(
    metrics: VerifiableRewards["performanceMetrics"],
  ): number {
    // Simple normalization for now
    const _timeScore = Math.max(0, 1 - metrics.executionTime / 5000); // 5s baseline
    const _memoryScore = Math.max(
      0,
      1 - metrics.memoryUsage / (100 * 1024 * 1024),
    ); // 100MB baseline

    return (_timeScore + _memoryScore) / 2;
  }

  /**
   * Normalize session duration to 0-1 scale
   */
  private normalizeSessionDuration(duration: number): number {
    // Optimal session is around 5-30 minutes
    const _optimalMin = 5 * 60 * 1000;
    const _optimalMax = 30 * 60 * 1000;

    if (duration < _optimalMin) {
      return duration / _optimalMin;
    } else if (duration <= _optimalMax) {
      return 1.0;
    } else {
      // Diminishing returns after 30 minutes
      return Math.max(0.5, 1 - (duration - _optimalMax) / _optimalMax);
    }
  }

  /**
   * Update recent statistics for dynamic weighting
   */
  updateRecentStats(episodes: Episode[]): void {
    if (episodes.length === 0) return;

    let totalTestPass = 0;
    let totalSatisfaction = 0;
    let totalTime = 0;
    let count = 0;

    for (const episode of episodes) {
      const _rewards = episode.outcome._rewards;
      totalTestPass += _rewards.verifiable.testPassRate;
      totalSatisfaction += _rewards.rubricScores.userSatisfaction / 100;
      totalTime += _rewards.verifiable.performanceMetrics.executionTime;
      count++;
    }

    this.recentStats = {
      avgTestPassRate: totalTestPass / count,
      avgUserSatisfaction: totalSatisfaction / count,
      avgExecutionTime: totalTime / count,
    };
  }

  /**
   * Get current _weights
   */
  getWeights(): RewardWeights {
    return { ...this.weights };
  }

  /**
   * Set custom _weights
   */
  setWeights(_weights: Partial<RewardWeights>): void {
    this._weights = { ...this._weights, ..._weights };
  }
}
