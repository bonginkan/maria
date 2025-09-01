/**
 * Enhanced Safety Validation Pipeline
 * Comprehensive safety checks to prevent policy regressions
 */

import { EventEmitter } from "node:events";
import {
  Policy,
  Episode,
  _ValidationResult,
  SafetyCheck,
  _RLConfig,
} from "./types";
import { ExperienceReplayBuffer } from "./ExperienceReplayBuffer";

export interface SafetyConfig {
  enabled: boolean;
  strictMode: boolean;
  thresholds: SafetyThresholds;
  checks: SafetyCheckConfig[];
  rollbackPolicy: RollbackPolicy;
  monitoringConfig: MonitoringConfig;
}

export interface SafetyThresholds {
  maxRegressionRate: number; // Max allowed regression rate (default: 0.05)
  minTestPassRate: number; // Min test pass rate (default: 0.90)
  minSuccessRate: number; // Min overall success rate (default: 0.80)
  maxErrorRate: number; // Max _error rate (default: 0.10)
  minUserSatisfaction: number; // Min user satisfaction (default: 0.70)
  performanceDegradation: number; // Max performance _degradation (default: 0.20)
  memoryIncreaseLimit: number; // Max memory increase (default: 0.30)
  maxSecurityIssues: number; // Max security issues (default: 0)
}

export interface SafetyCheckConfig {
  id: string;
  name: string;
  enabled: boolean;
  weight: number;
  critical: boolean; // If true, failure blocks deployment
  timeout: number; // Check timeout in ms
  retries: number; // Number of retries on failure
}

export interface RollbackPolicy {
  autoRollback: boolean;
  rollbackThreshold: number; // Score below which to rollback
  gracePeriod: number; // Wait time before rollback (ms)
  preserveVersions: number; // Number of versions to keep
}

export interface MonitoringConfig {
  enabled: boolean;
  alertThresholds: {
    _criticalFailures: number;
    warningThresholds: number;
  };
  notificationChannels: string[];
}

export interface SafetyReport {
  timestamp: Date;
  policyVersion: number;
  overallScore: number; // 0-100 safety score
  _passed: boolean;
  _recommendation: "deploy" | "review" | "rollback" | "block";
  checks: SafetyCheckResult[];
  _riskAssessment: RiskAssessment;
  mitigations: string[];
}

export interface SafetyCheckResult extends SafetyCheck {
  executionTime: number;
  retryCount: number;
  details?: Record<string, any>;
}

export interface RiskAssessment {
  level: "low" | "medium" | "high" | "critical";
  score: number; // 0-100 risk score
  factors: RiskFactor[];
  _mitigation: string;
}

export interface RiskFactor {
  factor: string;
  impact: "low" | "medium" | "high" | "critical";
  likelihood: number; // 0-1
  description: string;
}

export class SafetyValidator extends EventEmitter {
  private config: SafetyConfig;
  private baselinePolicy: Policy | null = null;
  private validationHistory: SafetyReport[] = [];
  private activeMonitors: Map<string, any> = new Map();

  constructor(_config: Partial<SafetyConfig> = {}) {
    super();

    this._config = {
      enabled: true,
      strictMode: false,
      thresholds: {
        maxRegressionRate: 0.05,
        minTestPassRate: 0.9,
        minSuccessRate: 0.8,
        maxErrorRate: 0.1,
        minUserSatisfaction: 0.7,
        performanceDegradation: 0.2,
        memoryIncreaseLimit: 0.3,
        maxSecurityIssues: 0,
      },
      checks: this.getDefaultSafetyChecks(),
      rollbackPolicy: {
        autoRollback: true,
        rollbackThreshold: 0.6,
        gracePeriod: 60000, // 1 minute
        preserveVersions: 5,
      },
      monitoringConfig: {
        enabled: true,
        alertThresholds: {
          _criticalFailures: 3,
          warningThresholds: 5,
        },
        notificationChannels: ["console", "file"],
      },
      ..._config,
    };
  }

  /**
   * Validate policy safety before deployment
   */
  async validatePolicy(
    newPolicy: Policy,
    testEpisodes: Episode[],
    experienceBuffer?: ExperienceReplayBuffer,
  ): Promise<SafetyReport> {
    if (!this.config.enabled) {
      return this.createBypassReport(newPolicy);
    }

    this.emit("validation:started", {
      policyVersion: newPolicy.version,
      checks: this.config.checks.length,
    });

    const _startTime = Date.now();
    const checkResults: SafetyCheckResult[] = [];
    let overallScore = 0;
    let _criticalFailures = 0;

    // Run all safety checks
    for (const checkConfig of this.config.checks.filter((c) => c.enabled)) {
      this.emit("check:started", { checkId: checkConfig.id });

      try {
        const _result = await this.runSafetyCheck(
          checkConfig,
          newPolicy,
          testEpisodes,
          experienceBuffer,
        );

        checkResults.push(_result);

        if (_result.passed) {
          overallScore += checkConfig.weight;
        } else if (checkConfig.critical) {
          _criticalFailures++;
        }

        this.emit("check:completed", {
          checkId: checkConfig.id,
          _passed: _result.passed,
          score: _result.score,
        });
      } catch (_error) {
        const errorResult: SafetyCheckResult = {
          name: checkConfig.name,
          _passed: false,
          score: 0,
          threshold: 0,
          message: `Check failed: ${_error instanceof Error ? _error.message : "Unknown _error"}`,
          executionTime: Date.now() - _startTime,
          retryCount: checkConfig.retries,
        };

        checkResults.push(errorResult);

        if (checkConfig.critical) {
          _criticalFailures++;
        }

        this.emit("check:_error", {
          checkId: checkConfig.id,
          _error: _error instanceof Error ? _error.message : "Unknown _error",
        });
      }
    }

    // Normalize overall score
    const _totalWeight = this.config.checks
      .filter((c) => c.enabled)
      .reduce((sum, c) => sum + c.weight, 0);

    overallScore = _totalWeight > 0 ? (overallScore / _totalWeight) * 100 : 0;

    // Assess risk
    const _riskAssessment = this.assessRisk(
      newPolicy,
      testEpisodes,
      checkResults,
    );

    // Generate _recommendation
    const _recommendation = this.generateRecommendation(
      overallScore,
      _criticalFailures,
      _riskAssessment,
    );

    // Create report
    const report: SafetyReport = {
      timestamp: new Date(),
      policyVersion: newPolicy.version,
      overallScore,
      _passed:
        _criticalFailures === 0 &&
        overallScore >= this.config.rollbackPolicy.rollbackThreshold,
      _recommendation,
      checks: checkResults,
      _riskAssessment,
      mitigations: this.generateMitigations(checkResults, _riskAssessment),
    };

    // Store in history
    this.validationHistory.push(report);

    // Keep only recent history
    if (this.validationHistory.length > 50) {
      this.validationHistory = this.validationHistory.slice(-50);
    }

    this.emit("validation:completed", {
      policyVersion: newPolicy.version,
      overallScore,
      _passed: report.passed,
      _recommendation,
      duration: Date.now() - _startTime,
    });

    return report;
  }

  /**
   * Run individual safety check
   */
  private async runSafetyCheck(
    checkConfig: SafetyCheckConfig,
    policy: Policy,
    episodes: Episode[],
    experienceBuffer?: ExperienceReplayBuffer,
  ): Promise<SafetyCheckResult> {
    const _startTime = Date.now();
    let retryCount = 0;

    const _timeoutPromise = new Promise<never>((_resolve, reject) => {
      setTimeout(
        () => reject(new Error(`Check ${checkConfig.id} timed out`)),
        checkConfig.timeout,
      );
    });

    while (retryCount <= checkConfig.retries) {
      try {
        const _checkPromise = this.executeCheck(
          checkConfig,
          policy,
          episodes,
          experienceBuffer,
        );
        const _result = await Promise.race([_checkPromise, _timeoutPromise]);

        return {
          ..._result,
          executionTime: Date.now() - _startTime,
          retryCount,
        };
      } catch (_error) {
        retryCount++;
        if (retryCount > checkConfig.retries) {
          throw _error;
        }

        // Brief delay before retry
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    throw new Error(
      `Check ${checkConfig.id} failed after ${checkConfig.retries} retries`,
    );
  }

  /**
   * Execute specific safety check
   */
  private async executeCheck(
    checkConfig: SafetyCheckConfig,
    policy: Policy,
    episodes: Episode[],
    experienceBuffer?: ExperienceReplayBuffer,
  ): Promise<SafetyCheck> {
    switch (checkConfig.id) {
      case "regression_check":
        return this.checkRegression(policy, episodes);

      case "performance_check":
        return this.checkPerformance(policy, episodes);

      case "error_rate_check":
        return this.checkErrorRate(episodes);

      case "user_satisfaction_check":
        return this.checkUserSatisfaction(episodes);

      case "security_check":
        return this.checkSecurity(policy, episodes);

      case "memory_check":
        return this.checkMemoryUsage(policy, episodes);

      case "consistency_check":
        return this.checkConsistency(policy, episodes);

      case "stability_check":
        return this.checkStability(policy, episodes, experienceBuffer);

      case "edge_case_check":
        return this.checkEdgeCases(policy, episodes);

      default:
        throw new Error(`Unknown safety check: ${checkConfig.id}`);
    }
  }

  /**
   * Check for performance regressions
   */
  private checkRegression(_policy: Policy, _episodes: Episode[]): SafetyCheck {
    if (!this.baselinePolicy) {
      return {
        name: "Regression Check",
        _passed: true,
        score: 100,
        message: "No baseline policy for comparison",
      };
    }

    const _currentPerformance = _policy.performance.avgReward;
    const _baselinePerformance = this.baselinePolicy.performance.avgReward;

    const _regressionRate =
      (_baselinePerformance - _currentPerformance) / _baselinePerformance;
    const _passed = _regressionRate <= this.config.thresholds.maxRegressionRate;

    return {
      name: "Regression Check",
      _passed,
      score: _passed ? 100 : Math.max(0, 100 - _regressionRate * 100),
      threshold: this.config.thresholds.maxRegressionRate,
      message: `Regression rate: ${(_regressionRate * 100).toFixed(2)}% (threshold: ${(this.config.thresholds.maxRegressionRate * 100).toFixed(2)}%)`,
    };
  }

  /**
   * Check performance metrics
   */
  private checkPerformance(_policy: Policy, episodes: Episode[]): SafetyCheck {
    const _avgExecutionTime =
      episodes.reduce(
        (sum, ep) =>
          sum + ep.outcome.rewards.verifiable.performanceMetrics.executionTime,
        0,
      ) / episodes.length;

    // Compare to baseline if available
    let performanceScore = 100;
    let message = `Average execution time: ${_avgExecutionTime.toFixed(0)}ms`;

    if (this.baselinePolicy && episodes.length > 0) {
      // Simplified baseline comparison
      const _expectedTime = 1000; // 1 second baseline
      const _degradation = Math.max(
        0,
        (_avgExecutionTime - _expectedTime) / _expectedTime,
      );
      const _passed =
        _degradation <= this.config.thresholds.performanceDegradation;

      performanceScore = _passed ? 100 : Math.max(0, 100 - _degradation * 100);
      message = `Performance _degradation: ${(_degradation * 100).toFixed(1)}% (threshold: ${(this.config.thresholds.performanceDegradation * 100).toFixed(1)}%)`;

      return {
        name: "Performance Check",
        _passed,
        score: performanceScore,
        threshold: this.config.thresholds.performanceDegradation,
        message,
      };
    }

    return {
      name: "Performance Check",
      _passed: true,
      score: performanceScore,
      message,
    };
  }

  /**
   * Check _error rates
   */
  private checkErrorRate(episodes: Episode[]): SafetyCheck {
    const _errorEpisodes = episodes.filter(
      (ep) => ep.outcome.errors.length > 0,
    ).length;
    const _errorRate =
      episodes.length > 0 ? _errorEpisodes / episodes.length : 0;
    const _passed = _errorRate <= this.config.thresholds.maxErrorRate;

    return {
      name: "Error Rate Check",
      _passed,
      score: _passed ? 100 : Math.max(0, 100 - _errorRate * 100),
      threshold: this.config.thresholds.maxErrorRate,
      message: `Error rate: ${(_errorRate * 100).toFixed(1)}% (threshold: ${(this.config.thresholds.maxErrorRate * 100).toFixed(1)}%)`,
    };
  }

  /**
   * Check user satisfaction
   */
  private checkUserSatisfaction(episodes: Episode[]): SafetyCheck {
    const _satisfactionScores = episodes
      .filter((ep) => ep.outcome.rewards.rubricScores.userSatisfaction > 0)
      .map((ep) => ep.outcome.rewards.rubricScores.userSatisfaction);

    if (_satisfactionScores.length === 0) {
      return {
        name: "User Satisfaction Check",
        _passed: true,
        score: 50,
        message: "No user satisfaction data available",
      };
    }

    const _avgSatisfaction =
      _satisfactionScores.reduce((sum, score) => sum + score, 0) /
      satisfactionScores.length /
      100; // Normalize to 0-1

    const _passed =
      _avgSatisfaction >= this.config.thresholds.minUserSatisfaction;

    return {
      name: "User Satisfaction Check",
      _passed,
      score: _avgSatisfaction * 100,
      threshold: this.config.thresholds.minUserSatisfaction,
      message: `User satisfaction: ${(_avgSatisfaction * 100).toFixed(1)}% (threshold: ${(this.config.thresholds.minUserSatisfaction * 100).toFixed(1)}%)`,
    };
  }

  /**
   * Check for security issues
   */
  private checkSecurity(_policy: Policy, episodes: Episode[]): SafetyCheck {
    const _securityIssues = episodes.reduce(
      (sum, ep) => sum + ep.outcome.rewards.penalties._securityIssues,
      0,
    );

    const _passed = _securityIssues <= this.config.thresholds.maxSecurityIssues;

    return {
      name: "Security Check",
      _passed,
      score: _passed ? 100 : Math.max(0, 100 - _securityIssues * 10),
      threshold: this.config.thresholds.maxSecurityIssues,
      message: `Security issues: ${_securityIssues} (threshold: ${this.config.thresholds.maxSecurityIssues})`,
    };
  }

  /**
   * Check memory usage
   */
  private checkMemoryUsage(_policy: Policy, episodes: Episode[]): SafetyCheck {
    const _avgMemoryUsage =
      episodes.reduce(
        (sum, ep) =>
          sum + ep.outcome.rewards.verifiable.performanceMetrics.memoryUsage,
        0,
      ) / episodes.length;

    // Simple memory check - in practice would compare to baseline
    const _memoryMB = _avgMemoryUsage / (1024 * 1024);
    const _passed = _memoryMB < 200; // 200MB threshold

    return {
      name: "Memory Check",
      _passed,
      score: _passed ? 100 : Math.max(0, 100 - ((_memoryMB - 200) / 200) * 100),
      message: `Average memory usage: ${_memoryMB.toFixed(1)}MB`,
    };
  }

  /**
   * Check policy consistency
   */
  private checkConsistency(_policy: Policy, episodes: Episode[]): SafetyCheck {
    // Check for consistent behavior across similar inputs
    const _consistencyScore = this.calculateConsistencyScore(episodes);
    const _passed = _consistencyScore >= 0.8;

    return {
      name: "Consistency Check",
      _passed,
      score: _consistencyScore * 100,
      threshold: 0.8,
      message: `Consistency score: ${(_consistencyScore * 100).toFixed(1)}%`,
    };
  }

  /**
   * Check policy _stability
   */
  private checkStability(
    _policy: Policy,
    episodes: Episode[],
    _experienceBuffer?: ExperienceReplayBuffer,
  ): SafetyCheck {
    // Check for stable outputs over time
    const _recentEpisodes = episodes.slice(-20); // Last 20 episodes
    const _olderEpisodes = episodes.slice(0, -20);

    if (_olderEpisodes.length === 0) {
      return {
        name: "Stability Check",
        _passed: true,
        score: 90,
        message: "Insufficient historical data for _stability check",
      };
    }

    const _recentAvgReward = this.calculateAverageReward(_recentEpisodes);
    const _olderAvgReward = this.calculateAverageReward(_olderEpisodes);

    const _stability =
      1 -
      Math.abs(_recentAvgReward - _olderAvgReward) /
        Math.max(_recentAvgReward, _olderAvgReward);
    const _passed = _stability >= 0.9;

    return {
      name: "Stability Check",
      _passed,
      score: _stability * 100,
      threshold: 0.9,
      message: `Stability score: ${(_stability * 100).toFixed(1)}%`,
    };
  }

  /**
   * Check edge case handling
   */
  private checkEdgeCases(_policy: Policy, episodes: Episode[]): SafetyCheck {
    // Identify edge case episodes (unusual inputs or conditions)
    const _edgeCases = episodes.filter((ep) => this.isEdgeCase(ep));

    if (_edgeCases.length === 0) {
      return {
        name: "Edge Case Check",
        _passed: true,
        score: 80,
        message: "No edge cases in test data",
      };
    }

    const _edgeCaseSuccessRate =
      _edgeCases.filter((ep) => (ep.outcome.rewards.totalReward || 0) > 60)
        .length / _edgeCases.length;

    const _passed = _edgeCaseSuccessRate >= 0.7;

    return {
      name: "Edge Case Check",
      _passed,
      score: _edgeCaseSuccessRate * 100,
      threshold: 0.7,
      message: `Edge case success rate: ${(_edgeCaseSuccessRate * 100).toFixed(1)}% (${_edgeCases.length} edge cases)`,
    };
  }

  /**
   * Assess overall risk
   */
  private assessRisk(
    _policy: Policy,
    _episodes: Episode[],
    checkResults: SafetyCheckResult[],
  ): RiskAssessment {
    const riskFactors: RiskFactor[] = [];
    let riskScore = 0;

    // Check for critical failures
    const _criticalFailures = checkResults.filter(
      (r) => !r.passed && r.threshold !== undefined,
    );
    if (_criticalFailures.length > 0) {
      riskFactors.push({
        factor: "Critical Safety Checks Failed",
        impact: "high",
        likelihood: 1.0,
        description: `${_criticalFailures.length} critical checks failed`,
      });
      riskScore += 30;
    }

    // Check regression severity
    const _regressionCheck = checkResults.find(
      (r) => r.name === "Regression Check",
    );
    if (
      _regressionCheck &&
      !_regressionCheck.passed &&
      _regressionCheck.score !== undefined
    ) {
      riskFactors.push({
        factor: "Performance Regression Detected",
        impact: _regressionCheck.score < 50 ? "high" : "medium",
        likelihood: 0.8,
        description: `Performance regression of ${(100 - _regressionCheck.score).toFixed(1)}%`,
      });
      riskScore += _regressionCheck.score < 50 ? 25 : 15;
    }

    // Check _error rates
    const _errorRateCheck = checkResults.find(
      (r) => r.name === "Error Rate Check",
    );
    if (_errorRateCheck && !_errorRateCheck.passed) {
      riskFactors.push({
        factor: "High Error Rate",
        impact: "medium",
        likelihood: 0.7,
        description: "Error rate exceeds acceptable threshold",
      });
      riskScore += 20;
    }

    // Determine risk level
    let level: RiskAssessment["level"];
    if (riskScore >= 50) level = "critical";
    else if (riskScore >= 30) level = "high";
    else if (riskScore >= 15) level = "medium";
    else level = "low";

    const _mitigation = this.generateRiskMitigation(level, riskFactors);

    return {
      level,
      score: riskScore,
      factors: riskFactors,
      _mitigation,
    };
  }

  /**
   * Generate deployment _recommendation
   */
  private generateRecommendation(
    overallScore: number,
    _criticalFailures: number,
    _riskAssessment: RiskAssessment,
  ): SafetyReport["_recommendation"] {
    if (_criticalFailures > 0 || _riskAssessment.level === "critical") {
      return "block";
    }

    if (overallScore < this.config.rollbackPolicy.rollbackThreshold) {
      return "rollback";
    }

    if (_riskAssessment.level === "high" || overallScore < 80) {
      return "review";
    }

    return "deploy";
  }

  /**
   * Generate mitigations
   */
  private generateMitigations(
    checkResults: SafetyCheckResult[],
    _riskAssessment: RiskAssessment,
  ): string[] {
    const mitigations: string[] = [];

    const _failedChecks = checkResults.filter((r) => !r.passed);
    for (const check of _failedChecks) {
      switch (check.name) {
        case "Regression Check":
          mitigations.push(
            "Consider additional training with focus on historical success patterns",
          );
          break;
        case "Performance Check":
          mitigations.push(
            "Optimize execution paths and reduce computational complexity",
          );
          break;
        case "Error Rate Check":
          mitigations.push(
            "Implement better _error handling and validation logic",
          );
          break;
        case "User Satisfaction Check":
          mitigations.push(
            "Focus on improving response quality and user experience",
          );
          break;
        case "Security Check":
          mitigations.push(
            "Review and fix security vulnerabilities before deployment",
          );
          break;
      }
    }

    if (
      _riskAssessment.level === "high" ||
      _riskAssessment.level === "critical"
    ) {
      mitigations.push(
        "Deploy with increased monitoring and quick rollback capability",
      );
      mitigations.push("Consider A/B testing with limited user exposure");
    }

    return mitigations.slice(0, 5); // Limit to top 5 mitigations
  }

  /**
   * Generate risk _mitigation strategy
   */
  private generateRiskMitigation(
    _level: RiskAssessment["level"],
    _factors: RiskFactor[],
  ): string {
    switch (_level) {
      case "critical":
        return "Block deployment immediately. Address all critical issues before retry.";
      case "high":
        return "Manual review required. Consider staged rollout with monitoring.";
      case "medium":
        return "Deploy with enhanced monitoring and quick rollback capability.";
      case "low":
      default:
        return "Proceed with standard monitoring and alerting.";
    }
  }

  /**
   * Helper methods
   */
  private calculateConsistencyScore(episodes: Episode[]): number {
    // Simplified consistency calculation
    if (episodes.length < 2) return 1.0;

    const _rewards = episodes.map((ep) => ep.outcome._rewards.totalReward || 0);
    const _mean = _rewards.reduce((sum, r) => sum + r, 0) / _rewards.length;
    const _variance =
      _rewards.reduce((sum, r) => sum + Math.pow(r - _mean, 2), 0) /
      _rewards.length;
    const _stdDev = Math.sqrt(_variance);

    // Lower standard deviation = higher consistency
    return Math.max(0, 1 - _stdDev / 100);
  }

  private calculateAverageReward(episodes: Episode[]): number {
    if (episodes.length === 0) return 0;
    return (
      episodes.reduce(
        (sum, ep) => sum + (ep.outcome.rewards.totalReward || 0),
        0,
      ) / episodes.length
    );
  }

  private isEdgeCase(episode: Episode): boolean {
    // Simple edge case detection
    const _query = episode.context.userQuery.toLowerCase();
    const _hasErrors = episode.outcome.errors.length > 0;
    const _lowReward = (episode.outcome.rewards.totalReward || 0) < 30;
    const _unusualLength = _query.length > 500 || _query.length < 5;

    return _hasErrors || _lowReward || _unusualLength;
  }

  private createBypassReport(policy: Policy): SafetyReport {
    return {
      timestamp: new Date(),
      policyVersion: policy.version,
      overallScore: 100,
      _passed: true,
      _recommendation: "deploy",
      checks: [],
      _riskAssessment: {
        level: "low",
        score: 0,
        factors: [],
        _mitigation: "Safety validation disabled",
      },
      mitigations: [],
    };
  }

  private getDefaultSafetyChecks(): SafetyCheckConfig[] {
    return [
      {
        id: "regression_check",
        name: "Regression Check",
        enabled: true,
        weight: 0.25,
        critical: true,
        timeout: 30000,
        retries: 2,
      },
      {
        id: "performance_check",
        name: "Performance Check",
        enabled: true,
        weight: 0.2,
        critical: false,
        timeout: 15000,
        retries: 1,
      },
      {
        id: "error_rate_check",
        name: "Error Rate Check",
        enabled: true,
        weight: 0.15,
        critical: true,
        timeout: 10000,
        retries: 1,
      },
      {
        id: "user_satisfaction_check",
        name: "User Satisfaction Check",
        enabled: true,
        weight: 0.15,
        critical: false,
        timeout: 10000,
        retries: 1,
      },
      {
        id: "security_check",
        name: "Security Check",
        enabled: true,
        weight: 0.1,
        critical: true,
        timeout: 20000,
        retries: 2,
      },
      {
        id: "memory_check",
        name: "Memory Check",
        enabled: true,
        weight: 0.05,
        critical: false,
        timeout: 5000,
        retries: 1,
      },
      {
        id: "consistency_check",
        name: "Consistency Check",
        enabled: true,
        weight: 0.05,
        critical: false,
        timeout: 15000,
        retries: 1,
      },
      {
        id: "stability_check",
        name: "Stability Check",
        enabled: true,
        weight: 0.03,
        critical: false,
        timeout: 10000,
        retries: 1,
      },
      {
        id: "edge_case_check",
        name: "Edge Case Check",
        enabled: true,
        weight: 0.02,
        critical: false,
        timeout: 10000,
        retries: 1,
      },
    ];
  }

  /**
   * Set baseline policy for comparison
   */
  setBaselinePolicy(policy: Policy): void {
    this.baselinePolicy = { ...policy };
    this.emit("baseline:set", { version: policy.version });
  }

  /**
   * Get validation history
   */
  getValidationHistory(): SafetyReport[] {
    return [...this.validationHistory];
  }

  /**
   * Update safety configuration
   */
  updateConfig(config: Partial<SafetyConfig>): void {
    this.config = { ...this.config, ...config };
    this.emit("config:updated", this.config);
  }
}
