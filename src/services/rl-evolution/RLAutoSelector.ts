/**
 * RL Auto-Selection System - Phase 10 v2.0
 * Intelligent algorithm switching based on performance metrics and environment analysis
 */

import { EventEmitter } from "node:events";
import { MacProM3Optimizer } from "./MacProM3Optimizer";
import { LocalLLMBenchmark } from "./LocalLLMBenchmark";

export interface RLAlgorithm {
  name: string;
  type: "PPO" | "A2C" | "DQN" | "TD3" | "SAC" | "DDPG" | "TRPO";
  description: string;
  strengths: string[];
  weaknesses: string[];
  computeRequirements: {
    cpu: "low" | "medium" | "high";
    memory: "low" | "medium" | "high";
    gpu: "none" | "optional" | "required";
  };
  hyperparameters: Record<string, any>;
  expectedPerformance: {
    convergenceSpeed: number; // 1-10 scale
    sampleEfficiency: number; // 1-10 scale
    stability: number; // 1-10 scale
    scalability: number; // 1-10 scale
  };
}

export interface EnvironmentProfile {
  type: "continuous" | "discrete" | "mixed";
  observationSpace: {
    dimensions: number;
    type: "box" | "discrete" | "multi_discrete";
    complexity: "simple" | "medium" | "complex";
  };
  actionSpace: {
    dimensions: number;
    type: "box" | "discrete" | "multi_discrete";
    bounded: boolean;
  };
  rewards: {
    sparse: boolean;
    delayed: boolean;
    noisy: boolean;
    scale: "small" | "medium" | "large";
  };
  dynamics: {
    stochastic: boolean;
    nonStationary: boolean;
    multiAgent: boolean;
  };
}

export interface PerformanceMetrics {
  algorithm: string;
  environment: string;
  episodes: number;
  avgReward: number;
  convergenceRate: number; // episodes to convergence
  sampleEfficiency: number; // reward per sample
  stability: number; // variance in performance
  computeTime: number; // ms per episode
  memoryUsage: number; // MB
  gpuUtilization: number; // %
  success: boolean;
  timestamp: Date;
}

export interface SelectionCriteria {
  priorityWeights: {
    convergenceSpeed: number;
    sampleEfficiency: number;
    stability: number;
    computeEfficiency: number;
    memoryEfficiency: number;
  };
  constraints: {
    maxComputeTime: number; // ms
    maxMemoryUsage: number; // MB
    requiresGPU: boolean;
    minStability: number; // 0-1
  };
  environment: EnvironmentProfile;
}

export interface SelectionResult {
  selectedAlgorithm: RLAlgorithm;
  score: number;
  reasoning: string[];
  alternatives: Array<{
    algorithm: RLAlgorithm;
    score: number;
    reason: string;
  }>;
  confidence: number; // 0-1
  recommendations: string[];
}

export class RLAutoSelector extends EventEmitter {
  private algorithms: Map<string, RLAlgorithm> = new Map();
  private performanceHistory: PerformanceMetrics[] = [];
  private optimizer: MacProM3Optimizer;
  private benchmark: LocalLLMBenchmark;
  private learningEnabled: boolean = true;

  constructor(optimizer?: MacProM3Optimizer, benchmark?: LocalLLMBenchmark) {
    super();

    this.optimizer = optimizer || new MacProM3Optimizer();
    this.benchmark =
      benchmark ||
      new LocalLLMBenchmark({
        baseUrl: "http://localhost:1234",
        timeout: 30000,
      });

    this.initializeAlgorithms();
    this.setupEventHandlers();
  }

  private initializeAlgorithms(): void {
    // PPO - Proximal Policy Optimization
    this.algorithms.set("PPO", {
      name: "Proximal Policy Optimization",
      type: "PPO",
      description: "State-of-the-art policy gradient method with clipping",
      strengths: [
        "Stable training",
        "Good sample efficiency",
        "Works with continuous and discrete actions",
      ],
      weaknesses: ["Can be slow to converge", "Sensitive to hyperparameters"],
      computeRequirements: { cpu: "medium", memory: "medium", gpu: "optional" },
      hyperparameters: {
        learningRate: 3e-4,
        batchSize: 256,
        nSteps: 2048,
        nEpochs: 10,
        clipRange: 0.2,
        entropyCoef: 0.01,
        valueCoef: 0.5,
        maxGradNorm: 0.5,
      },
      expectedPerformance: {
        convergenceSpeed: 7,
        sampleEfficiency: 8,
        stability: 9,
        scalability: 8,
      },
    });

    // A2C - Advantage Actor-Critic
    this.algorithms.set("A2C", {
      name: "Advantage Actor-Critic",
      type: "A2C",
      description: "Synchronous version of A3C with advantage function",
      strengths: [
        "Fast training",
        "Simple implementation",
        "Good for continuous control",
      ],
      weaknesses: ["Less stable than PPO", "Sensitive to hyperparameters"],
      computeRequirements: { cpu: "low", memory: "low", gpu: "optional" },
      hyperparameters: {
        learningRate: 7e-4,
        nSteps: 5,
        gamma: 0.99,
        entropyCoef: 0.01,
        valueCoef: 0.25,
        maxGradNorm: 0.5,
      },
      expectedPerformance: {
        convergenceSpeed: 6,
        sampleEfficiency: 6,
        stability: 6,
        scalability: 7,
      },
    });

    // DQN - Deep Q-Network
    this.algorithms.set("DQN", {
      name: "Deep Q-Network",
      type: "DQN",
      description: "Deep reinforcement learning for discrete action spaces",
      strengths: [
        "Proven in discrete domains",
        "Experience replay",
        "Target network stabilization",
      ],
      weaknesses: [
        "Only discrete actions",
        "Can be unstable",
        "Sample inefficient",
      ],
      computeRequirements: { cpu: "medium", memory: "high", gpu: "required" },
      hyperparameters: {
        learningRate: 1e-4,
        bufferSize: 100000,
        batchSize: 32,
        targetUpdateInterval: 1000,
        exploration: 0.1,
        gamma: 0.99,
      },
      expectedPerformance: {
        convergenceSpeed: 5,
        sampleEfficiency: 5,
        stability: 6,
        scalability: 6,
      },
    });

    // TD3 - Twin Delayed Deep Deterministic Policy Gradient
    this.algorithms.set("TD3", {
      name: "Twin Delayed DDPG",
      type: "TD3",
      description:
        "Improved DDPG with delayed policy updates and target policy smoothing",
      strengths: [
        "Excellent for continuous control",
        "More stable than DDPG",
        "Good sample efficiency",
      ],
      weaknesses: [
        "Complex hyperparameter tuning",
        "Requires experience replay",
      ],
      computeRequirements: { cpu: "medium", memory: "high", gpu: "required" },
      hyperparameters: {
        learningRate: 3e-4,
        bufferSize: 1000000,
        batchSize: 256,
        policyDelay: 2,
        targetNoise: 0.2,
        noiseClip: 0.5,
        gamma: 0.99,
        tau: 0.005,
      },
      expectedPerformance: {
        convergenceSpeed: 8,
        sampleEfficiency: 8,
        stability: 8,
        scalability: 7,
      },
    });

    // SAC - Soft Actor-Critic
    this.algorithms.set("SAC", {
      name: "Soft Actor-Critic",
      type: "SAC",
      description: "Maximum entropy RL algorithm for continuous control",
      strengths: [
        "Very sample efficient",
        "Stable training",
        "Automatic entropy tuning",
      ],
      weaknesses: ["Complex implementation", "High memory requirements"],
      computeRequirements: { cpu: "high", memory: "high", gpu: "required" },
      hyperparameters: {
        learningRate: 3e-4,
        bufferSize: 1000000,
        batchSize: 256,
        tau: 0.005,
        gamma: 0.99,
        alpha: 0.2,
        targetEntropy: "auto",
      },
      expectedPerformance: {
        convergenceSpeed: 9,
        sampleEfficiency: 9,
        stability: 9,
        scalability: 7,
      },
    });

    // DDPG - Deep Deterministic Policy Gradient
    this.algorithms.set("DDPG", {
      name: "Deep Deterministic Policy Gradient",
      type: "DDPG",
      description: "Actor-critic method for continuous control",
      strengths: ["Good for continuous control", "Off-policy learning"],
      weaknesses: [
        "Can be unstable",
        "Sensitive to hyperparameters",
        "Superseded by TD3/SAC",
      ],
      computeRequirements: { cpu: "medium", memory: "medium", gpu: "optional" },
      hyperparameters: {
        learningRate: 1e-4,
        bufferSize: 100000,
        batchSize: 128,
        tau: 0.001,
        gamma: 0.99,
        noise: 0.1,
      },
      expectedPerformance: {
        convergenceSpeed: 6,
        sampleEfficiency: 6,
        stability: 5,
        scalability: 6,
      },
    });

    // TRPO - Trust Region Policy Optimization
    this.algorithms.set("TRPO", {
      name: "Trust Region Policy Optimization",
      type: "TRPO",
      description: "Policy optimization with trust region constraint",
      strengths: [
        "Monotonic improvement",
        "Stable training",
        "Theoretical guarantees",
      ],
      weaknesses: [
        "Computationally expensive",
        "Slow convergence",
        "Complex implementation",
      ],
      computeRequirements: { cpu: "high", memory: "medium", gpu: "optional" },
      hyperparameters: {
        maxKl: 0.01,
        damping: 0.1,
        gamma: 0.995,
        lam: 0.98,
        cg_iters: 10,
        cg_damping: 0.001,
      },
      expectedPerformance: {
        convergenceSpeed: 4,
        sampleEfficiency: 7,
        stability: 9,
        scalability: 5,
      },
    });
  }

  private setupEventHandlers(): void {
    // Monitor system performance for algorithm switching
    this.optimizer.on("optimization:complete", (result) => {
      this.emit("system:optimized", result);
      this.adaptAlgorithmRecommendations(result);
    });

    // Learn from performance metrics
    this.on("performance:recorded", (metrics: PerformanceMetrics) => {
      if (this.learningEnabled) {
        this.updateAlgorithmExpectations(metrics);
      }
    });
  }

  /**
   * Select the best RL algorithm for given criteria
   */
  async selectAlgorithm(criteria: SelectionCriteria): Promise<SelectionResult> {
    this.emit("selection:start", criteria);

    try {
      const scores = await this.scoreAlgorithms(criteria);
      const sorted = scores.sort((a, b) => b.score - a.score);

      const best = sorted[0];
      const alternatives = sorted.slice(1, 4).map((s) => ({
        algorithm: s.algorithm,
        score: s.score,
        reason: this.getAlternativeReason(s.algorithm, criteria),
      }));

      const result: SelectionResult = {
        selectedAlgorithm: best.algorithm,
        score: best.score,
        reasoning: best.reasoning,
        alternatives,
        confidence: this.calculateConfidence(scores),
        recommendations: await this.generateRecommendations(
          best.algorithm,
          criteria,
        ),
      };

      this.emit("selection:complete", result);
      return result;
    } catch (error: any) {
      this.emit("selection:error", error.message);
      throw error;
    }
  }

  private async scoreAlgorithms(criteria: SelectionCriteria): Promise<
    Array<{
      algorithm: RLAlgorithm;
      score: number;
      reasoning: string[];
    }>
  > {
    const results: Array<{
      algorithm: RLAlgorithm;
      score: number;
      reasoning: string[];
    }> = [];

    for (const [name, algorithm] of this.algorithms) {
      const score = await this.calculateAlgorithmScore(algorithm, criteria);
      const reasoning = this.generateScoreReasoning(algorithm, criteria, score);

      results.push({ algorithm, score, reasoning });
    }

    return results;
  }

  private async calculateAlgorithmScore(
    algorithm: RLAlgorithm,
    criteria: SelectionCriteria,
  ): Promise<number> {
    let score = 0;
    const weights = criteria.priorityWeights;

    // Performance scoring (60% of total score)
    const performanceScore =
      (weights.convergenceSpeed *
        (algorithm.expectedPerformance.convergenceSpeed / 10) +
        weights.sampleEfficiency *
          (algorithm.expectedPerformance.sampleEfficiency / 10) +
        weights.stability * (algorithm.expectedPerformance.stability / 10)) /
      (weights.convergenceSpeed + weights.sampleEfficiency + weights.stability);

    score += performanceScore * 0.6;

    // Environment compatibility (25% of total score)
    const envScore = await this.calculateEnvironmentCompatibility(
      algorithm,
      criteria.environment,
    );
    score += envScore * 0.25;

    // Resource efficiency (15% of total score)
    const resourceScore = this.calculateResourceEfficiency(algorithm, criteria);
    score += resourceScore * 0.15;

    // Apply constraint penalties
    score *= this.applyConstraintPenalties(algorithm, criteria.constraints);

    // Historical performance boost
    const historyBoost = this.getHistoricalPerformanceBoost(algorithm.name);
    score *= 1 + historyBoost;

    return Math.max(0, Math.min(1, score));
  }

  private async calculateEnvironmentCompatibility(
    algorithm: RLAlgorithm,
    environment: EnvironmentProfile,
  ): Promise<number> {
    let compatibility = 0.5; // Base compatibility

    // Action space compatibility
    if (environment.actionSpace.type === "discrete") {
      if (["DQN"].includes(algorithm.type)) {
        compatibility += 0.3;
      } else if (["PPO", "A2C", "TRPO"].includes(algorithm.type)) {
        compatibility += 0.2;
      }
    } else if (environment.actionSpace.type === "box") {
      if (["TD3", "SAC", "DDPG"].includes(algorithm.type)) {
        compatibility += 0.3;
      } else if (["PPO", "A2C", "TRPO"].includes(algorithm.type)) {
        compatibility += 0.2;
      }
    }

    // Observation complexity
    if (environment.observationSpace.complexity === "complex") {
      if (["SAC", "TD3", "PPO"].includes(algorithm.type)) {
        compatibility += 0.1;
      }
    } else if (environment.observationSpace.complexity === "simple") {
      if (["DQN", "A2C"].includes(algorithm.type)) {
        compatibility += 0.1;
      }
    }

    // Reward characteristics
    if (environment.rewards.sparse) {
      if (["SAC", "TD3"].includes(algorithm.type)) {
        compatibility += 0.1;
      } else if (["DQN"].includes(algorithm.type)) {
        compatibility -= 0.1;
      }
    }

    return Math.max(0, Math.min(1, compatibility));
  }

  private calculateResourceEfficiency(
    algorithm: RLAlgorithm,
    criteria: SelectionCriteria,
  ): number {
    let efficiency = 0.5;

    // CPU efficiency
    const cpuWeight = criteria.priorityWeights.computeEfficiency;
    if (algorithm.computeRequirements.cpu === "low") {
      efficiency += cpuWeight * 0.3;
    } else if (algorithm.computeRequirements.cpu === "high") {
      efficiency -= cpuWeight * 0.1;
    }

    // Memory efficiency
    const memoryWeight = criteria.priorityWeights.memoryEfficiency;
    if (algorithm.computeRequirements.memory === "low") {
      efficiency += memoryWeight * 0.3;
    } else if (algorithm.computeRequirements.memory === "high") {
      efficiency -= memoryWeight * 0.1;
    }

    // GPU availability consideration
    if (
      algorithm.computeRequirements.gpu === "required" &&
      !criteria.constraints.requiresGPU
    ) {
      efficiency -= 0.2;
    } else if (
      algorithm.computeRequirements.gpu === "none" &&
      criteria.constraints.requiresGPU
    ) {
      efficiency += 0.1;
    }

    return Math.max(0, Math.min(1, efficiency));
  }

  private applyConstraintPenalties(
    algorithm: RLAlgorithm,
    constraints: SelectionCriteria["constraints"],
  ): number {
    let penalty = 1.0;

    // GPU constraint
    if (
      algorithm.computeRequirements.gpu === "required" &&
      !constraints.requiresGPU
    ) {
      penalty *= 0.3; // Heavy penalty for GPU requirement mismatch
    }

    // Stability constraint
    const stabilityScore = algorithm.expectedPerformance.stability / 10;
    if (stabilityScore < constraints.minStability) {
      penalty *= 0.5;
    }

    // Estimate compute time penalty (simplified)
    if (
      algorithm.computeRequirements.cpu === "high" &&
      constraints.maxComputeTime < 1000
    ) {
      penalty *= 0.7;
    }

    // Estimate memory penalty (simplified)
    if (
      algorithm.computeRequirements.memory === "high" &&
      constraints.maxMemoryUsage < 4096
    ) {
      penalty *= 0.8;
    }

    return penalty;
  }

  private getHistoricalPerformanceBoost(algorithmName: string): number {
    const recentMetrics = this.performanceHistory
      .filter((m) => m.algorithm === algorithmName)
      .slice(-10); // Last 10 runs

    if (recentMetrics.length < 3) return 0; // Need at least 3 data points

    const avgSuccess =
      recentMetrics.filter((m) => m.success).length / recentMetrics.length;
    const avgReward =
      recentMetrics.reduce((sum, m) => sum + m.avgReward, 0) /
      recentMetrics.length;

    // Simple boost based on recent performance
    return Math.min(0.2, (avgSuccess - 0.5) * 0.4 + (avgReward > 0 ? 0.1 : 0));
  }

  private generateScoreReasoning(
    algorithm: RLAlgorithm,
    criteria: SelectionCriteria,
    score: number,
  ): string[] {
    const reasoning: string[] = [];

    reasoning.push(`Algorithm: ${algorithm.name} (${algorithm.type})`);
    reasoning.push(`Overall Score: ${(score * 100).toFixed(1)}%`);

    // Strengths
    const topStrengths = algorithm.strengths.slice(0, 2);
    reasoning.push(`Key Strengths: ${topStrengths.join(", ")}`);

    // Environment match
    if (
      criteria.environment.actionSpace.type === "discrete" &&
      ["DQN", "PPO"].includes(algorithm.type)
    ) {
      reasoning.push("✅ Excellent match for discrete action space");
    } else if (
      criteria.environment.actionSpace.type === "box" &&
      ["TD3", "SAC", "DDPG"].includes(algorithm.type)
    ) {
      reasoning.push("✅ Excellent match for continuous action space");
    }

    // Resource considerations
    if (algorithm.computeRequirements.gpu === "required") {
      reasoning.push("⚠️ Requires GPU acceleration for optimal performance");
    } else if (algorithm.computeRequirements.cpu === "low") {
      reasoning.push(
        "✅ Low CPU requirements - efficient for resource-constrained environments",
      );
    }

    // Performance expectations
    const perf = algorithm.expectedPerformance;
    if (perf.sampleEfficiency >= 8) {
      reasoning.push("✅ High sample efficiency - learns quickly from data");
    }
    if (perf.stability >= 8) {
      reasoning.push("✅ High stability - reliable convergence");
    }

    return reasoning;
  }

  private calculateConfidence(scores: Array<{ score: number }>): number {
    if (scores.length < 2) return 0.5;

    const sorted = scores.map((s) => s.score).sort((a, b) => b - a);
    const best = sorted[0];
    const second = sorted[1];

    // Confidence based on margin between best and second-best
    const margin = best - second;
    return Math.min(0.95, 0.5 + margin * 2);
  }

  private getAlternativeReason(
    algorithm: RLAlgorithm,
    criteria: SelectionCriteria,
  ): string {
    const reasons = [];

    if (algorithm.expectedPerformance.convergenceSpeed >= 8) {
      reasons.push("fast convergence");
    }
    if (algorithm.expectedPerformance.sampleEfficiency >= 8) {
      reasons.push("sample efficient");
    }
    if (algorithm.expectedPerformance.stability >= 8) {
      reasons.push("stable training");
    }
    if (algorithm.computeRequirements.cpu === "low") {
      reasons.push("low compute requirements");
    }

    return reasons.length > 0
      ? `Good for: ${reasons.join(", ")}`
      : "Alternative option";
  }

  private async generateRecommendations(
    algorithm: RLAlgorithm,
    criteria: SelectionCriteria,
  ): Promise<string[]> {
    const recommendations: string[] = [];

    // Hyperparameter recommendations
    recommendations.push(
      `Use recommended hyperparameters: ${Object.keys(algorithm.hyperparameters).slice(0, 3).join(", ")}`,
    );

    // Hardware recommendations
    if (algorithm.computeRequirements.gpu === "required") {
      recommendations.push("Enable GPU acceleration for optimal performance");
    } else if (algorithm.computeRequirements.gpu === "optional") {
      recommendations.push("Consider GPU acceleration for faster training");
    }

    // Environment-specific recommendations
    if (criteria.environment.rewards.sparse) {
      recommendations.push("Use experience replay to handle sparse rewards");
    }
    if (criteria.environment.dynamics.stochastic) {
      recommendations.push(
        "Increase exploration to handle stochastic dynamics",
      );
    }

    // Mac Pro M3 specific recommendations
    try {
      await this.optimizer.validateAndOptimize();
      recommendations.push(
        "Mac Pro M3 Max optimizations available - use Metal acceleration",
      );
      recommendations.push(
        `Configure batch size for unified memory: ${algorithm.hyperparameters.batchSize || 256}`,
      );
    } catch (error) {
      // Mac Pro M3 not available
    }

    return recommendations;
  }

  /**
   * Record performance metrics for learning
   */
  recordPerformance(metrics: PerformanceMetrics): void {
    this.performanceHistory.push(metrics);
    this.emit("performance:recorded", metrics);

    // Keep only last 1000 entries
    if (this.performanceHistory.length > 1000) {
      this.performanceHistory.shift();
    }
  }

  /**
   * Update algorithm expectations based on actual performance
   */
  private updateAlgorithmExpectations(metrics: PerformanceMetrics): void {
    const algorithm = this.algorithms.get(metrics.algorithm);
    if (!algorithm) return;

    // Learning rate for updates
    const alpha = 0.1;

    // Update convergence speed expectation
    const actualConvergenceSpeed = Math.max(
      1,
      Math.min(
        10,
        10 - metrics.convergenceRate / 1000, // Convert episodes to 1-10 scale
      ),
    );
    algorithm.expectedPerformance.convergenceSpeed =
      (1 - alpha) * algorithm.expectedPerformance.convergenceSpeed +
      alpha * actualConvergenceSpeed;

    // Update sample efficiency expectation
    const actualSampleEfficiency = Math.max(
      1,
      Math.min(10, metrics.sampleEfficiency * 2),
    );
    algorithm.expectedPerformance.sampleEfficiency =
      (1 - alpha) * algorithm.expectedPerformance.sampleEfficiency +
      alpha * actualSampleEfficiency;

    // Update stability expectation
    const actualStability = Math.max(1, Math.min(10, 10 - metrics.stability));
    algorithm.expectedPerformance.stability =
      (1 - alpha) * algorithm.expectedPerformance.stability +
      alpha * actualStability;

    this.emit("learning:updated", {
      algorithm: metrics.algorithm,
      expectations: algorithm.expectedPerformance,
    });
  }

  /**
   * Adapt algorithm recommendations based on system optimization
   */
  private adaptAlgorithmRecommendations(optimizationResult: any): void {
    // Boost GPU-capable algorithms if Metal acceleration is available
    if (optimizationResult.systemState?.gpuUsage?.metalUtilization > 0) {
      ["TD3", "SAC", "DQN"].forEach((algoType) => {
        const algorithm = Array.from(this.algorithms.values()).find(
          (a) => a.type === algoType,
        );
        if (algorithm) {
          algorithm.expectedPerformance.scalability = Math.min(
            10,
            algorithm.expectedPerformance.scalability + 1,
          );
        }
      });
    }

    // Adjust for memory optimizations
    if (optimizationResult.improvements?.memoryUtilization > 10) {
      ["SAC", "TD3"].forEach((algoType) => {
        const algorithm = Array.from(this.algorithms.values()).find(
          (a) => a.type === algoType,
        );
        if (algorithm && algorithm.computeRequirements.memory === "high") {
          algorithm.expectedPerformance.scalability = Math.min(
            10,
            algorithm.expectedPerformance.scalability + 0.5,
          );
        }
      });
    }
  }

  /**
   * Get available algorithms with their current expectations
   */
  getAlgorithms(): RLAlgorithm[] {
    return Array.from(this.algorithms.values());
  }

  /**
   * Get performance history for analysis
   */
  getPerformanceHistory(): PerformanceMetrics[] {
    return [...this.performanceHistory];
  }

  /**
   * Enable or disable learning from performance data
   */
  setLearningEnabled(enabled: boolean): void {
    this.learningEnabled = enabled;
    this.emit("learning:toggled", enabled);
  }

  /**
   * Export system state for analysis
   */
  async exportSelectionReport(): Promise<string> {
    const algorithms = this.getAlgorithms();
    const history = this.getPerformanceHistory();

    return `# RL Auto-Selection System Report

## Available Algorithms
${algorithms
  .map(
    (alg) => `
### ${alg.name} (${alg.type})
- **Description**: ${alg.description}
- **Convergence Speed**: ${alg.expectedPerformance.convergenceSpeed}/10
- **Sample Efficiency**: ${alg.expectedPerformance.sampleEfficiency}/10
- **Stability**: ${alg.expectedPerformance.stability}/10
- **Scalability**: ${alg.expectedPerformance.scalability}/10
- **Compute Requirements**: CPU ${alg.computeRequirements.cpu}, Memory ${alg.computeRequirements.memory}, GPU ${alg.computeRequirements.gpu}
- **Strengths**: ${alg.strengths.join(", ")}
`,
  )
  .join("\n")}

## Performance History
- **Total Experiments**: ${history.length}
- **Successful Runs**: ${history.filter((h) => h.success).length}
- **Average Reward**: ${history.length > 0 ? (history.reduce((sum, h) => sum + h.avgReward, 0) / history.length).toFixed(2) : "N/A"}

## Algorithm Usage
${Array.from(new Set(history.map((h) => h.algorithm)))
  .map((alg) => {
    const algHistory = history.filter((h) => h.algorithm === alg);
    return `- **${alg}**: ${algHistory.length} runs (${((algHistory.filter((h) => h.success).length / algHistory.length) * 100).toFixed(1)}% success rate)`;
  })
  .join("\n")}

## System Status
- **Learning Enabled**: ${this.learningEnabled}
- **Mac Pro M3 Optimizer**: ${this.optimizer ? "Available" : "Not Available"}
- **LLM Benchmark**: ${this.benchmark ? "Available" : "Not Available"}

*Generated: ${new Date().toISOString()}*
`;
  }
}
