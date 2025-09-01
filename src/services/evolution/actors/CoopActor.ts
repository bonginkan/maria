/**
 * CoopActor - Cooperative Evolution Orchestrator
 *
 * Orchestrates the 20B Proposer + 128B Critic cooperative system
 * Manages the complete evolution pipeline: Propose → Review → Gate → Execute
 * Integrates with PR automation and CI/CD for complete automation
 */

import { BaseService } from "../../internal-mode/core/BaseService";
import {
  LLMProposer,
  Proposal,
  ProposalContext,
  ProposalGenerationOptions,
} from "./LLMProposer";
import { LLMCritic, Review, ReviewContext, ReviewOptions } from "./LLMCritic";
import { ConfigManager } from "../../../config/config-manager";
import { ApprovalManager } from "../ApprovalManager";
import { RewardCalculator } from "../RewardCalculator";

export interface EvolutionContext {
  // System state
  metrics: {
    nDCG: number;
    MRR: number;
    p95Latency: number;
    searchQuality: number;
    cacheHitRate: number;
    failureRate: number;
    trends: {
      nDCG: Array<{ timestamp: string; value: number }>;
      MRR: Array<{ timestamp: string; value: number }>;
      latency: Array<{ timestamp: string; value: number }>;
    };
  };

  // Configuration state
  currentParams: {
    search: {
      rrf: { bm25: number; vector: number; kg: number };
      topK: number;
      kg: { alpha: number; beta: number; gamma: number };
      reranker: { enabled: boolean; batch: number };
    };
    reward: {
      weights: {
        quality: number;
        performance: number;
        ux: number;
        safety: number;
        multilingual: number;
        human_feedback: number;
      };
    };
  };

  // Environment context
  environment: "development" | "production" | "testing";
  maintenanceWindow: boolean;
  resourceConstraints: {
    maxCPU: number;
    maxMemory: number;
    maxDiskIO: number;
  };

  // History and trends
  recentHistory: Array<{
    timestamp: string;
    proposalId: string;
    changes: any;
    outcome: "success" | "failure" | "rollback";
    impact: any;
    duration: number;
  }>;

  // Risk and safety context
  constraints: {
    maxRiskScore: number;
    allowedFiles: string[];
    blockedOperations: string[];
    requiresApproval: boolean;
  };
}

export interface CycleOptions {
  dryRun?: boolean; // Don't execute, just plan
  maxProposals?: number; // Limit proposal count
  riskTolerance?: number; // 0-1 risk acceptance
  focusArea?: "quality" | "performance" | "reliability" | "all";
  timeLimit?: number; // Max cycle time in ms
  requireHumanApproval?: boolean; // Force human approval
  skipPRCreation?: boolean; // Don't create PRs, just plan
}

export interface CycleResult {
  cycleId: string;
  timestamp: string;
  status: "completed" | "partial" | "failed" | "dry_run";

  // Proposal phase results
  proposals: Proposal[];
  proposalMetrics: {
    generated: number;
    generationTime: number;
    averageQuality: number;
  };

  // Review phase results
  reviews: Review[];
  reviewMetrics: {
    reviewed: number;
    reviewTime: number;
    averageConfidence: number;
    recommendations: {
      approve: number;
      approve_with_conditions: number;
      revise: number;
      reject: number;
    };
  };

  // Gate decision
  gateDecision: {
    approved: boolean;
    score: number;
    threshold: number;
    factors: {
      criticScore: number;
      rewardScore: number;
      riskScore: number;
      constraintScore: number;
    };
    reasoning: string[];
  };

  // Execution results (if not dry run)
  execution?: {
    prId?: string;
    prUrl?: string;
    ciStatus?: "pending" | "running" | "success" | "failure";
    deploymentStatus?: "pending" | "deployed" | "failed" | "rolled_back";
    actualImpact?: any;
  };

  // Performance metrics
  performance: {
    totalTime: number;
    proposalTime: number;
    reviewTime: number;
    gateTime: number;
    executionTime?: number;
  };

  // Learning data for future cycles
  learningData: {
    proposalAccuracy: number; // How accurate were impact predictions?
    reviewAccuracy: number; // How accurate was the review?
    actualVsPredicted: any; // Comparison of actual vs predicted impact
  };
}

export interface PRCreationResult {
  prId: string;
  prUrl: string;
  branch: string;
  title: string;
  description: string;
  labels: string[];
  reviewers: string[];
  status: "created" | "failed";
  error?: string;
}

export class CoopActor extends BaseService {
  id = "coop-actor";
  version = "1.0.0";

  private proposer: LLMProposer;
  private critic: LLMCritic;
  private approvalManager: ApprovalManager;
  private rewardCalculator: RewardCalculator;
  private configManager: ConfigManager;

  // Performance monitoring
  private cycleHistory: CycleResult[] = [];
  private readonly maxHistorySize = 100;

  // Default thresholds and settings
  private readonly defaultSettings = {
    gateThreshold: 0.75, // Minimum score for approval
    maxRiskScore: 0.6, // Maximum acceptable risk
    defaultProposalCount: 3, // Number of proposals to generate
    maxCycleTime: 30000, // 30 second timeout
    minConfidence: 0.8, // Minimum critic confidence
  };

  constructor(
    proposer?: LLMProposer,
    critic?: LLMCritic,
    approvalManager?: ApprovalManager,
    rewardCalculator?: RewardCalculator,
  ) {
    super();
    this.proposer = proposer || new LLMProposer();
    this.critic = critic || new LLMCritic();
    this.approvalManager = approvalManager || new ApprovalManager();
    this.rewardCalculator = rewardCalculator || new RewardCalculator();
    this.configManager = new ConfigManager();
  }

  async initialize(): Promise<void> {
    console.log("Initializing CoopActor orchestration system...");

    await Promise.all([
      this.proposer.initialize(),
      this.critic.initialize(),
      this.approvalManager.initialize(),
      this.rewardCalculator.initialize(),
    ]);

    console.log("CoopActor initialization complete");
  }

  /**
   * Execute a complete evolution cycle
   */
  async executeCycle(
    context: EvolutionContext,
    options: CycleOptions = {},
  ): Promise<CycleResult> {
    const cycleId = `cycle-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = performance.now();

    console.log(`Starting evolution cycle ${cycleId}...`);

    try {
      const {
        dryRun = false,
        maxProposals = this.defaultSettings.defaultProposalCount,
        riskTolerance = 0.5,
        focusArea = "all",
        timeLimit = this.defaultSettings.maxCycleTime,
        requireHumanApproval = false,
        skipPRCreation = false,
      } = options;

      // Phase 1: Proposal Generation
      const proposalStartTime = performance.now();
      console.log("Phase 1: Generating proposals...");

      const proposals = await this.generateProposals(context, {
        count: maxProposals,
        riskTolerance,
        focusArea,
        timeLimit: Math.floor(timeLimit * 0.3), // 30% of total time
      });

      const proposalEndTime = performance.now();
      const proposalTime = proposalEndTime - proposalStartTime;

      console.log(
        `Generated ${proposals.length} proposals in ${proposalTime.toFixed(0)}ms`,
      );

      // Phase 2: Proposal Review
      const reviewStartTime = performance.now();
      console.log("Phase 2: Reviewing proposals...");

      const reviews = await this.reviewProposals(proposals, context, {
        depth: "standard",
        timeLimit: Math.floor(timeLimit * 0.4), // 40% of total time
      });

      const reviewEndTime = performance.now();
      const reviewTime = reviewEndTime - reviewStartTime;

      console.log(
        `Reviewed ${reviews.length} proposals in ${reviewTime.toFixed(0)}ms`,
      );

      // Phase 3: Gate Decision
      const gateStartTime = performance.now();
      console.log("Phase 3: Gate evaluation...");

      const gateDecision = await this.evaluateGate(
        proposals,
        reviews,
        context,
        {
          requireHumanApproval,
        },
      );

      const gateEndTime = performance.now();
      const gateTime = gateEndTime - gateStartTime;

      console.log(
        `Gate decision: ${gateDecision.approved ? "APPROVED" : "REJECTED"} (${gateTime.toFixed(0)}ms)`,
      );

      // Phase 4: Execution (if approved and not dry run)
      let execution;
      let executionTime = 0;

      if (gateDecision.approved && !dryRun && !skipPRCreation) {
        const executionStartTime = performance.now();
        console.log("Phase 4: Executing approved proposals...");

        execution = await this.executeApprovedProposals(
          proposals,
          reviews,
          context,
        );

        const executionEndTime = performance.now();
        executionTime = executionEndTime - executionStartTime;

        console.log(`Execution completed in ${executionTime.toFixed(0)}ms`);
      } else if (dryRun) {
        console.log("Phase 4: Skipped (dry run mode)");
      } else if (!gateDecision.approved) {
        console.log("Phase 4: Skipped (gate rejected)");
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Build result
      const result: CycleResult = {
        cycleId,
        timestamp: new Date().toISOString(),
        status: dryRun
          ? "dry_run"
          : gateDecision.approved
            ? "completed"
            : "partial",

        proposals,
        proposalMetrics: {
          generated: proposals.length,
          generationTime: proposalTime,
          averageQuality:
            proposals.reduce((sum, p) => sum + (1 - p.expectedImpact.risk), 0) /
            proposals.length,
        },

        reviews,
        reviewMetrics: {
          reviewed: reviews.length,
          reviewTime: reviewTime,
          averageConfidence:
            reviews.reduce((sum, r) => sum + r.confidence, 0) / reviews.length,
          recommendations: this.countRecommendations(reviews),
        },

        gateDecision,
        execution,

        performance: {
          totalTime,
          proposalTime,
          reviewTime,
          gateTime,
          executionTime: executionTime > 0 ? executionTime : undefined,
        },

        learningData: {
          proposalAccuracy: 0.8, // Placeholder - would be calculated from historical data
          reviewAccuracy: 0.9, // Placeholder - would be calculated from outcomes
          actualVsPredicted: {}, // Would be populated with actual results
        },
      };

      // Store in history
      this.addToHistory(result);

      console.log(
        `Evolution cycle ${cycleId} completed in ${totalTime.toFixed(0)}ms - Status: ${result.status}`,
      );

      return result;
    } catch (error) {
      console.error(`Evolution cycle ${cycleId} failed:`, error);

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Return failure result
      return {
        cycleId,
        timestamp: new Date().toISOString(),
        status: "failed",
        proposals: [],
        proposalMetrics: { generated: 0, generationTime: 0, averageQuality: 0 },
        reviews: [],
        reviewMetrics: {
          reviewed: 0,
          reviewTime: 0,
          averageConfidence: 0,
          recommendations: {
            approve: 0,
            approve_with_conditions: 0,
            revise: 0,
            reject: 0,
          },
        },
        gateDecision: {
          approved: false,
          score: 0,
          threshold: this.defaultSettings.gateThreshold,
          factors: {
            criticScore: 0,
            rewardScore: 0,
            riskScore: 1,
            constraintScore: 0,
          },
          reasoning: [
            `Cycle failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          ],
        },
        performance: { totalTime, proposalTime: 0, reviewTime: 0, gateTime: 0 },
        learningData: {
          proposalAccuracy: 0,
          reviewAccuracy: 0,
          actualVsPredicted: {},
        },
      };
    }
  }

  /**
   * Generate proposals using the LLMProposer
   */
  private async generateProposals(
    context: EvolutionContext,
    options: ProposalGenerationOptions,
  ): Promise<Proposal[]> {
    const proposalContext: ProposalContext = {
      metrics: context.metrics,
      lastParams: context.currentParams,
      recentFailures: context.recentHistory
        .filter((h) => h.outcome === "failure")
        .map((h) => ({
          timestamp: h.timestamp,
          error: "Previous evolution failed",
          context: h.proposalId,
          impact: h.impact?.severity || "medium",
        }))
        .slice(-5), // Last 5 failures
      trend: this.calculateTrend(context.metrics.trends),
      environment: context.environment,
    };

    return await this.proposer.generateProposals(proposalContext, options);
  }

  /**
   * Review proposals using the LLMCritic
   */
  private async reviewProposals(
    proposals: Proposal[],
    context: EvolutionContext,
    options: { depth: "quick" | "standard" | "thorough"; timeLimit: number },
  ): Promise<Review[]> {
    const reviewPromises = proposals.map(async (proposal) => {
      const reviewContext: ReviewContext = {
        proposal,
        systemContext: {
          metrics: context.metrics,
          currentParams: context.currentParams,
          recentHistory: context.recentHistory,
          environment: context.environment,
          constraints: context.constraints,
        },
        policyContext: {
          safetyRules: [
            "Never modify authentication or security systems",
            "All changes must be reversible",
            "Preserve backward compatibility",
          ],
          qualityStandards: [
            "Maintain nDCG@10 > 0.75",
            "P95 latency < 200ms",
            "Error rate < 1%",
          ],
          architecturalPrinciples: [
            "Minimal API, Maximum Power",
            "Service Pattern with Dependency Injection",
            "Zero hardcoding architecture",
          ],
          complianceRequirements: [],
        },
      };

      return await this.critic.reviewProposal(reviewContext, {
        depth: options.depth,
        timeLimit: Math.floor(options.timeLimit / proposals.length),
      });
    });

    return await Promise.all(reviewPromises);
  }

  /**
   * Evaluate gate decision based on proposals, reviews, and context
   */
  private async evaluateGate(
    proposals: Proposal[],
    reviews: Review[],
    context: EvolutionContext,
    options: { requireHumanApproval: boolean },
  ): Promise<CycleResult["gateDecision"]> {
    // Calculate individual scores
    const criticScore = this.calculateCriticScore(reviews);
    const rewardScore = await this.calculateRewardScore(proposals, context);
    const riskScore = this.calculateRiskScore(proposals, reviews);
    const constraintScore = this.calculateConstraintScore(proposals, context);

    // Composite score with weights
    const weights = {
      critic: 0.35, // 35% - Quality of proposals and reviews
      reward: 0.25, // 25% - Expected system improvement
      risk: 0.25, // 25% - Risk assessment
      constraint: 0.15, // 15% - Constraint compliance
    };

    const compositeScore =
      criticScore * weights.critic +
      rewardScore * weights.reward +
      (1 - riskScore) * weights.risk + // Invert risk - lower risk = higher score
      constraintScore * weights.constraint;

    const threshold =
      context.environment === "production"
        ? this.defaultSettings.gateThreshold + 0.1 // Higher threshold for production
        : this.defaultSettings.gateThreshold;

    const approved =
      compositeScore >= threshold &&
      riskScore <= this.defaultSettings.maxRiskScore &&
      !options.requireHumanApproval &&
      reviews.some(
        (r) =>
          r.recommendation === "approve" ||
          r.recommendation === "approve_with_conditions",
      );

    return {
      approved,
      score: compositeScore,
      threshold,
      factors: {
        criticScore,
        rewardScore,
        riskScore,
        constraintScore,
      },
      reasoning: this.buildGateReasoning(
        approved,
        compositeScore,
        threshold,
        {
          criticScore,
          rewardScore,
          riskScore,
          constraintScore,
        },
        reviews,
      ),
    };
  }

  /**
   * Execute approved proposals by creating PRs
   */
  private async executeApprovedProposals(
    proposals: Proposal[],
    reviews: Review[],
    context: EvolutionContext,
  ): Promise<CycleResult["execution"]> {
    // Find approved proposals
    const approvedProposals = proposals.filter((_, index) => {
      const review = reviews[index];
      return (
        review.recommendation === "approve" ||
        review.recommendation === "approve_with_conditions"
      );
    });

    if (approvedProposals.length === 0) {
      return {
        prId: "none",
        prUrl: "",
        ciStatus: "success",
        deploymentStatus: "pending",
      };
    }

    // For now, implement the highest-scoring proposal
    const bestProposal = approvedProposals.sort((a, b) => {
      const scoreA = 1 - a.expectedImpact.risk;
      const scoreB = 1 - b.expectedImpact.risk;
      return scoreB - scoreA;
    })[0];

    const bestReview = reviews[proposals.indexOf(bestProposal)];

    // Create PR (placeholder implementation)
    const prResult = await this.createPR(bestProposal, bestReview, context);

    return {
      prId: prResult.prId,
      prUrl: prResult.prUrl,
      ciStatus: "pending",
      deploymentStatus: "pending",
    };
  }

  /**
   * Create a pull request for the approved proposal
   */
  private async createPR(
    proposal: Proposal,
    review: Review,
    context: EvolutionContext,
  ): Promise<PRCreationResult> {
    // This would integrate with actual Git/PR systems
    // For now, return a mock result

    const prId = `pr-${Date.now()}`;
    const branch = `evolve/${proposal.id}`;

    return {
      prId,
      prUrl: `https://github.com/your-org/maria/pull/${prId}`,
      branch,
      title: `Evolve: ${proposal.summary}`,
      description: `## Automated Evolution Proposal

${proposal.description}

### Critic Review
**Recommendation:** ${review.recommendation}
**Confidence:** ${(review.confidence * 100).toFixed(1)}%
**Overall Score:** ${(review.score.overall * 100).toFixed(1)}%

### Expected Impact
- nDCG@10: ${proposal.expectedImpact.nDCG > 0 ? "+" : ""}${proposal.expectedImpact.nDCG.toFixed(3)}
- MRR: ${proposal.expectedImpact.MRR > 0 ? "+" : ""}${proposal.expectedImpact.MRR.toFixed(3)}
- Latency: ${proposal.expectedImpact.latency}ms
- Risk: ${(proposal.expectedImpact.risk * 100).toFixed(1)}%

### Changes
\`\`\`json
${JSON.stringify(proposal.changes, null, 2)}
\`\`\`

---
🤖 Generated by MARIA CoopActor Evolution System`,
      labels: [
        "evolve",
        "automated",
        `risk-${proposal.expectedImpact.risk > 0.5 ? "high" : proposal.expectedImpact.risk > 0.3 ? "medium" : "low"}`,
      ],
      reviewers: ["evolution-team"],
      status: "created",
    };
  }

  // Helper methods for scoring and calculations

  private calculateCriticScore(reviews: Review[]): number {
    if (reviews.length === 0) return 0;

    const averageOverall =
      reviews.reduce((sum, r) => sum + r.score.overall, 0) / reviews.length;
    const averageConfidence =
      reviews.reduce((sum, r) => sum + r.confidence, 0) / reviews.length;

    return averageOverall * 0.7 + averageConfidence * 0.3;
  }

  private async calculateRewardScore(
    proposals: Proposal[],
    context: EvolutionContext,
  ): Promise<number> {
    // Calculate expected reward improvement
    let totalExpectedImprovement = 0;

    for (const proposal of proposals) {
      const nDCGImprovement = Math.max(0, proposal.expectedImpact.nDCG);
      const MRRImprovement = Math.max(0, proposal.expectedImpact.MRR);
      const latencyImprovement = Math.max(
        0,
        -proposal.expectedImpact.latency / 100,
      ); // Normalize latency

      totalExpectedImprovement +=
        (nDCGImprovement + MRRImprovement + latencyImprovement) / 3;
    }

    return Math.min(1, totalExpectedImprovement / proposals.length);
  }

  private calculateRiskScore(proposals: Proposal[], reviews: Review[]): number {
    const proposalRisk =
      proposals.reduce((sum, p) => sum + p.expectedImpact.risk, 0) /
      proposals.length;
    const reviewRisk =
      reviews.reduce((sum, r) => sum + (1 - r.score.safety), 0) /
      reviews.length;

    return proposalRisk * 0.6 + reviewRisk * 0.4;
  }

  private calculateConstraintScore(
    proposals: Proposal[],
    context: EvolutionContext,
  ): number {
    let violationCount = 0;
    let totalChecks = 0;

    for (const proposal of proposals) {
      // Check file constraints
      if (proposal.changes.patch?.files) {
        for (const file of proposal.changes.patch.files) {
          totalChecks++;
          if (
            !context.constraints.allowedFiles.some((allowed) =>
              file.includes(allowed),
            )
          ) {
            violationCount++;
          }
        }
      }

      // Check operation constraints
      totalChecks++;
      if (
        context.constraints.blockedOperations.some((blocked) =>
          proposal.description.toLowerCase().includes(blocked.toLowerCase()),
        )
      ) {
        violationCount++;
      }
    }

    return totalChecks === 0 ? 1 : 1 - violationCount / totalChecks;
  }

  private buildGateReasoning(
    approved: boolean,
    score: number,
    threshold: number,
    factors: any,
    reviews: Review[],
  ): string[] {
    const reasoning = [];

    if (approved) {
      reasoning.push(
        `✅ Composite score ${score.toFixed(3)} exceeds threshold ${threshold.toFixed(3)}`,
      );
      reasoning.push(
        `✅ Risk score ${factors.riskScore.toFixed(3)} within acceptable limits`,
      );
      reasoning.push(`✅ At least one proposal approved by critic`);
    } else {
      if (score < threshold) {
        reasoning.push(
          `❌ Composite score ${score.toFixed(3)} below threshold ${threshold.toFixed(3)}`,
        );
      }
      if (factors.riskScore > this.defaultSettings.maxRiskScore) {
        reasoning.push(
          `❌ Risk score ${factors.riskScore.toFixed(3)} exceeds limit ${this.defaultSettings.maxRiskScore}`,
        );
      }
      if (
        !reviews.some(
          (r) =>
            r.recommendation === "approve" ||
            r.recommendation === "approve_with_conditions",
        )
      ) {
        reasoning.push(`❌ No proposals received critic approval`);
      }
    }

    reasoning.push(
      `📊 Critic: ${factors.criticScore.toFixed(3)}, Reward: ${factors.rewardScore.toFixed(3)}, Risk: ${factors.riskScore.toFixed(3)}, Constraints: ${factors.constraintScore.toFixed(3)}`,
    );

    return reasoning;
  }

  private calculateTrend(trends: any): "improving" | "degrading" | "stable" {
    // Simple trend calculation based on recent metrics
    const recentnDCG = trends.nDCG?.slice(-5) || [];
    if (recentnDCG.length < 2) return "stable";

    const first = recentnDCG[0].value;
    const last = recentnDCG[recentnDCG.length - 1].value;
    const change = (last - first) / first;

    if (change > 0.02) return "improving";
    if (change < -0.02) return "degrading";
    return "stable";
  }

  private countRecommendations(
    reviews: Review[],
  ): CycleResult["reviewMetrics"]["recommendations"] {
    return reviews.reduce(
      (counts, review) => {
        counts[review.recommendation]++;
        return counts;
      },
      {
        approve: 0,
        approve_with_conditions: 0,
        revise: 0,
        reject: 0,
      },
    );
  }

  private addToHistory(result: CycleResult): void {
    this.cycleHistory.push(result);

    // Keep only the most recent cycles
    if (this.cycleHistory.length > this.maxHistorySize) {
      this.cycleHistory = this.cycleHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Get performance statistics and history
   */
  getStats(): {
    cycleHistory: CycleResult[];
    performance: {
      averageCycleTime: number;
      successRate: number;
      averageProposalQuality: number;
      averageReviewConfidence: number;
    };
    settings: typeof this.defaultSettings;
  } {
    const completedCycles = this.cycleHistory.filter(
      (c) => c.status === "completed",
    );

    return {
      cycleHistory: this.cycleHistory.slice(-10), // Last 10 cycles
      performance: {
        averageCycleTime:
          completedCycles.length > 0
            ? completedCycles.reduce(
                (sum, c) => sum + c.performance.totalTime,
                0,
              ) / completedCycles.length
            : 0,
        successRate:
          this.cycleHistory.length > 0
            ? completedCycles.length / this.cycleHistory.length
            : 0,
        averageProposalQuality:
          completedCycles.length > 0
            ? completedCycles.reduce(
                (sum, c) => sum + c.proposalMetrics.averageQuality,
                0,
              ) / completedCycles.length
            : 0,
        averageReviewConfidence:
          completedCycles.length > 0
            ? completedCycles.reduce(
                (sum, c) => sum + c.reviewMetrics.averageConfidence,
                0,
              ) / completedCycles.length
            : 0,
      },
      settings: this.defaultSettings,
    };
  }

  /**
   * Quick evolution cycle for testing/development
   */
  async quickCycle(context: Partial<EvolutionContext>): Promise<CycleResult> {
    const fullContext: EvolutionContext = {
      metrics: {
        nDCG: 0.78,
        MRR: 0.86,
        p95Latency: 187,
        searchQuality: 0.82,
        cacheHitRate: 0.72,
        failureRate: 0.03,
        trends: { nDCG: [], MRR: [], latency: [] },
        ...context.metrics,
      },
      currentParams: {
        search: {
          rrf: { bm25: 0.4, vector: 0.4, kg: 0.2 },
          topK: 100,
          kg: { alpha: 0.3, beta: 0.3, gamma: 0.2 },
          reranker: { enabled: true, batch: 32 },
        },
        reward: {
          weights: {
            quality: 0.3,
            performance: 0.25,
            ux: 0.2,
            safety: 0.15,
            multilingual: 0.05,
            human_feedback: 0.05,
          },
        },
        ...context.currentParams,
      },
      environment: context.environment || "development",
      maintenanceWindow: context.maintenanceWindow || false,
      resourceConstraints: {
        maxCPU: 80,
        maxMemory: 16384,
        maxDiskIO: 1000,
        ...context.resourceConstraints,
      },
      recentHistory: context.recentHistory || [],
      constraints: {
        maxRiskScore: 0.6,
        allowedFiles: ["src/services/search/", "src/config/", "rewards.json"],
        blockedOperations: ["auth", "security", "database"],
        requiresApproval: false,
        ...context.constraints,
      },
    };

    return await this.executeCycle(fullContext, {
      dryRun: true,
      maxProposals: 2,
    });
  }
}
