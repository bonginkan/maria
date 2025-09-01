/**
 * LLMProposer - Fast 20B Model for Evolution Proposals
 *
 * Optimized for GPT-OSS 20B model via LM Studio
 * Focus: Speed, creativity, diverse proposal generation
 * Target: <1.2s proposal generation (512 tokens)
 */

import { BaseService } from "../../internal-mode/core/BaseService";
import { LMStudioProvider } from "../../../providers/lmstudio-provider";
import { ConfigManager } from "../../../config/config-manager";

export interface ProposalContext {
  metrics: {
    nDCG: number;
    MRR: number;
    p95Latency: number;
    searchQuality: number;
    cacheHitRate: number;
    failureRate: number;
  };
  lastParams: {
    search?: {
      rrf?: { bm25: number; vector: number; kg: number };
      topK?: number;
      kg?: { alpha: number; beta: number; gamma: number };
      reranker?: { enabled: boolean; batch: number };
    };
    reward?: {
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
  recentFailures?: Array<{
    timestamp: string;
    error: string;
    context: string;
    impact: "low" | "medium" | "high";
  }>;
  trend: "improving" | "degrading" | "stable";
  environment: "development" | "production" | "testing";
}

export interface Proposal {
  id: string;
  type: "parameter" | "reward" | "patch";
  summary: string;
  description: string;
  priority: "low" | "medium" | "high" | "critical";
  expectedImpact: {
    nDCG: number; // Expected change in nDCG@10
    MRR: number; // Expected change in MRR
    latency: number; // Expected latency impact (ms)
    risk: number; // Risk score 0-1
  };
  changes: {
    search?: {
      rrf?: { bm25: number; vector: number; kg: number };
      topK?: number;
      kg?: { alpha: number; beta: number; gamma: number };
      reranker?: { enabled: boolean; batch: number };
    };
    reward?: {
      weights: {
        quality?: number;
        performance?: number;
        ux?: number;
        safety?: number;
        multilingual?: number;
        human_feedback?: number;
      };
    };
    patch?: {
      format: "unified-diff" | "json-patch";
      diff: string;
      files: string[];
      linesChanged: number;
    };
  };
  rationale: string[];
  dependencies: string[];
  rollbackPlan: string;
  testingStrategy: string;
  metadata: {
    modelUsed: string;
    generationTime: number;
    temperature: number;
    contextTokens: number;
    proposalTokens: number;
  };
}

export interface ProposalGenerationOptions {
  count?: number; // Number of proposals to generate
  diversity?: number; // 0-1, higher = more diverse proposals
  riskTolerance?: number; // 0-1, higher = more aggressive proposals
  focusArea?: "quality" | "performance" | "reliability" | "all";
  timeLimit?: number; // Max generation time in ms
  temperature?: number; // LLM temperature override
}

export class LLMProposer extends BaseService {
  id = "llmproposer";
  version = "1.0.0";

  private provider: LMStudioProvider;
  private configManager: ConfigManager;
  private model: string = "gpt-oss-20b"; // Fast model for proposals

  // Benchmarked performance targets
  private readonly performanceTargets = {
    maxGenerationTime: 1200, // 1.2s target
    maxTokensPerProposal: 512, // Token limit for speed
    minProposalQuality: 0.7, // Quality threshold
  };

  constructor(provider?: LMStudioProvider) {
    super();
    this.provider = provider || new LMStudioProvider();
    this.configManager = new ConfigManager();
  }

  async initialize(): Promise<void> {
    await this.provider.initialize();

    // Load model preference from config
    const config = await this.configManager.getConfig();
    this.model = config.llm?.proposer?.model || "gpt-oss-20b";

    console.log(`LLMProposer initialized with model: ${this.model}`);
  }

  /**
   * Generate evolution proposals based on current system context
   */
  async generateProposals(
    context: ProposalContext,
    options: ProposalGenerationOptions = {},
  ): Promise<Proposal[]> {
    const startTime = performance.now();

    const {
      count = 3,
      diversity = 0.7,
      riskTolerance = 0.5,
      focusArea = "all",
      timeLimit = this.performanceTargets.maxGenerationTime,
      temperature = 0.7,
    } = options;

    try {
      console.log(`Generating ${count} proposals with ${focusArea} focus...`);

      const proposals: Proposal[] = [];

      // Generate proposals in parallel for speed
      const proposalPromises = Array.from({ length: count }, (_, i) =>
        this.generateSingleProposal(
          context,
          {
            index: i,
            diversity,
            riskTolerance,
            focusArea,
            temperature: temperature + diversity * (Math.random() - 0.5) * 0.3, // Add diversity
          },
          timeLimit,
        ),
      );

      const results = await Promise.allSettled(proposalPromises);

      for (const result of results) {
        if (result.status === "fulfilled" && result.value) {
          proposals.push(result.value);
        } else if (result.status === "rejected") {
          console.warn("Proposal generation failed:", result.reason);
        }
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      console.log(
        `Generated ${proposals.length}/${count} proposals in ${totalTime.toFixed(0)}ms`,
      );

      if (totalTime > timeLimit) {
        console.warn(
          `Generation exceeded time limit: ${totalTime}ms > ${timeLimit}ms`,
        );
      }

      // Sort by expected impact and priority
      return this.rankProposals(proposals, context);
    } catch (error) {
      console.error("Error generating proposals:", error);
      throw new Error(
        `Proposal generation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Generate a single proposal with specific parameters
   */
  private async generateSingleProposal(
    context: ProposalContext,
    options: {
      index: number;
      diversity: number;
      riskTolerance: number;
      focusArea: string;
      temperature: number;
    },
    timeLimit: number,
  ): Promise<Proposal> {
    const startTime = performance.now();

    const prompt = this.buildProposalPrompt(context, options);

    try {
      const response = await this.provider.chat(
        [
          {
            role: "system",
            content: this.getSystemPrompt(options.focusArea),
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        this.model,
        {
          temperature: options.temperature,
          maxTokens: this.performanceTargets.maxTokensPerProposal,
          topP: 0.9,
        },
      );

      const endTime = performance.now();
      const generationTime = endTime - startTime;

      const proposal = this.parseProposalResponse(response, {
        modelUsed: this.model,
        generationTime,
        temperature: options.temperature,
        contextTokens: this.estimateTokens(prompt),
        proposalTokens: this.estimateTokens(response),
      });

      // Validate proposal quality
      if (!this.validateProposal(proposal, context)) {
        throw new Error("Generated proposal failed validation");
      }

      return proposal;
    } catch (error) {
      console.error(`Failed to generate proposal ${options.index}:`, error);
      throw error;
    }
  }

  /**
   * Build the proposal generation prompt
   */
  private buildProposalPrompt(context: ProposalContext, options: any): string {
    const { metrics, lastParams, recentFailures, trend, environment } = context;

    return `# MARIA Evolution Proposal Generation

## Current System State
**Metrics:**
- nDCG@10: ${metrics.nDCG.toFixed(3)}
- MRR: ${metrics.MRR.toFixed(3)}  
- P95 Latency: ${metrics.p95Latency}ms
- Search Quality: ${(metrics.searchQuality * 100).toFixed(1)}%
- Cache Hit Rate: ${(metrics.cacheHitRate * 100).toFixed(1)}%
- Failure Rate: ${(metrics.failureRate * 100).toFixed(2)}%

**Trend:** ${trend.toUpperCase()}
**Environment:** ${environment}

**Current Parameters:**
${JSON.stringify(lastParams, null, 2)}

**Recent Issues:**
${recentFailures?.map((f) => `- ${f.impact.toUpperCase()}: ${f.error} (${f.context})`).join("\n") || "None"}

## Generation Parameters
- Focus Area: ${options.focusArea}
- Risk Tolerance: ${options.riskTolerance}/1.0
- Diversity Level: ${options.diversity}/1.0

## Task
Generate a single, actionable evolution proposal to improve system performance.

**Requirements:**
1. **Type**: Choose from: parameter, reward, patch
2. **Impact Analysis**: Provide specific numeric estimates
3. **Risk Assessment**: Evaluate potential negative impacts
4. **Implementation**: Clear, actionable changes
5. **Rollback Plan**: How to safely revert if needed

**Focus Areas:**
- Quality: Improve nDCG@10, MRR, relevance
- Performance: Reduce latency, improve throughput  
- Reliability: Reduce failures, improve stability
- Efficiency: Better resource utilization, caching

Return **ONLY** valid JSON in this exact format:
\`\`\`json
{
  "type": "parameter|reward|patch",
  "summary": "Brief description (max 80 chars)",
  "description": "Detailed explanation of the proposal",
  "priority": "low|medium|high|critical",
  "expectedImpact": {
    "nDCG": 0.025,
    "MRR": 0.018,
    "latency": -15,
    "risk": 0.2
  },
  "changes": {
    // Actual changes based on type
  },
  "rationale": [
    "Reason 1",
    "Reason 2"  
  ],
  "dependencies": [],
  "rollbackPlan": "How to safely revert changes",
  "testingStrategy": "How to validate the proposal"
}
\`\`\``;
  }

  /**
   * Get system prompt based on focus area
   */
  private getSystemPrompt(focusArea: string): string {
    const basePrompt = `You are MARIA's Evolution Proposer, specialized in generating fast, actionable system improvement proposals.

**Your Role:**
- Generate creative, data-driven optimization proposals
- Focus on measurable improvements with clear success criteria
- Balance innovation with safety and reliability
- Provide detailed implementation guidance

**Constraints:**
- Only propose changes to whitelisted systems (search, rewards, configs)
- Never modify authentication, security, or core infrastructure  
- Always include rollback plans and risk assessments
- Stay within architectural boundaries and patterns`;

    const focusPrompts = {
      quality: `**QUALITY FOCUS:** Prioritize improvements to search relevance, accuracy, and user satisfaction. Target nDCG@10 and MRR improvements.`,
      performance: `**PERFORMANCE FOCUS:** Prioritize latency reduction, throughput improvements, and resource optimization. Target P95 latency and cache efficiency.`,
      reliability: `**RELIABILITY FOCUS:** Prioritize error reduction, fault tolerance, and system stability. Target failure rate and recovery time.`,
      all: `**BALANCED FOCUS:** Consider all aspects - quality, performance, and reliability. Optimize for overall system improvement.`,
    };

    return `${basePrompt}\n\n${focusPrompts[focusArea] || focusPrompts.all}

**Output Format:** Return ONLY valid JSON. No explanations, no markdown, just the JSON object.`;
  }

  /**
   * Parse and validate the proposal response from LLM
   */
  private parseProposalResponse(response: string, metadata: any): Proposal {
    try {
      // Extract JSON from response (handle markdown code blocks)
      let jsonStr = response.trim();
      if (jsonStr.includes("```json")) {
        const matches = jsonStr.match(/```json\n([\s\S]*?)\n```/);
        if (matches && matches[1]) {
          jsonStr = matches[1];
        }
      } else if (jsonStr.includes("```")) {
        const matches = jsonStr.match(/```\n([\s\S]*?)\n```/);
        if (matches && matches[1]) {
          jsonStr = matches[1];
        }
      }

      const parsed = JSON.parse(jsonStr);

      // Generate unique ID
      const id = `prop-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      return {
        id,
        type: parsed.type,
        summary: parsed.summary,
        description: parsed.description,
        priority: parsed.priority,
        expectedImpact: parsed.expectedImpact,
        changes: parsed.changes,
        rationale: parsed.rationale || [],
        dependencies: parsed.dependencies || [],
        rollbackPlan: parsed.rollbackPlan,
        testingStrategy: parsed.testingStrategy,
        metadata,
      };
    } catch (error) {
      console.error("Failed to parse proposal response:", error);
      console.error("Response:", response);

      // Create fallback proposal
      return this.createFallbackProposal(response, metadata);
    }
  }

  /**
   * Create a fallback proposal when parsing fails
   */
  private createFallbackProposal(response: string, metadata: any): Proposal {
    return {
      id: `fallback-${Date.now()}`,
      type: "parameter",
      summary: "Fallback proposal - parsing failed",
      description: `Generated proposal could not be parsed. Raw response: ${response.substring(0, 200)}...`,
      priority: "low",
      expectedImpact: {
        nDCG: 0,
        MRR: 0,
        latency: 0,
        risk: 0.9, // High risk due to parsing failure
      },
      changes: {},
      rationale: ["Proposal parsing failed", "Generated as fallback"],
      dependencies: [],
      rollbackPlan: "No changes to rollback",
      testingStrategy: "Manual review required",
      metadata,
    };
  }

  /**
   * Validate proposal structure and content
   */
  private validateProposal(
    proposal: Proposal,
    context: ProposalContext,
  ): boolean {
    // Required fields validation
    if (!proposal.type || !proposal.summary || !proposal.description) {
      console.warn("Proposal missing required fields");
      return false;
    }

    // Type validation
    if (!["parameter", "reward", "patch"].includes(proposal.type)) {
      console.warn("Invalid proposal type:", proposal.type);
      return false;
    }

    // Impact validation
    if (
      !proposal.expectedImpact ||
      typeof proposal.expectedImpact.risk !== "number"
    ) {
      console.warn("Invalid expected impact structure");
      return false;
    }

    // Risk validation
    if (
      proposal.expectedImpact.risk > 0.8 &&
      proposal.priority === "critical"
    ) {
      console.warn("High-risk critical proposal flagged for review");
      // Don't reject, but flag for human review
    }

    // Changes validation based on type
    if (
      proposal.type === "parameter" &&
      !proposal.changes.search &&
      !proposal.changes.reward
    ) {
      console.warn("Parameter proposal missing search or reward changes");
      return false;
    }

    return true;
  }

  /**
   * Rank proposals by expected impact and priority
   */
  private rankProposals(
    proposals: Proposal[],
    context: ProposalContext,
  ): Proposal[] {
    return proposals.sort((a, b) => {
      // Calculate composite score
      const scoreA = this.calculateProposalScore(a, context);
      const scoreB = this.calculateProposalScore(b, context);

      return scoreB - scoreA; // Descending order
    });
  }

  /**
   * Calculate a composite score for proposal ranking
   */
  private calculateProposalScore(
    proposal: Proposal,
    context: ProposalContext,
  ): number {
    const impact = proposal.expectedImpact;
    const priorityWeight =
      { low: 1, medium: 2, high: 3, critical: 4 }[proposal.priority] || 1;

    // Weight factors based on current system needs
    let impactScore = 0;

    // Quality improvements (nDCG, MRR)
    impactScore += (impact.nDCG || 0) * 10 + (impact.MRR || 0) * 8;

    // Performance improvements (latency reduction)
    if (impact.latency && impact.latency < 0) {
      impactScore += Math.abs(impact.latency) * 0.1;
    }

    // Risk penalty
    impactScore -= (impact.risk || 0) * 5;

    // Trend bonus - if system is degrading, prioritize stability
    if (context.trend === "degrading") {
      if (proposal.type === "parameter" && impact.risk < 0.3) {
        impactScore *= 1.2; // Bonus for low-risk parameter changes
      }
    } else if (context.trend === "improving") {
      if (impact.nDCG > 0.02 || impact.MRR > 0.015) {
        impactScore *= 1.3; // Bonus for quality improvements when improving
      }
    }

    return impactScore * priorityWeight;
  }

  /**
   * Estimate token count (rough approximation)
   */
  private estimateTokens(text: string): number {
    // Rough approximation: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }

  /**
   * Quick proposal generation for testing/development
   */
  async quickProposal(
    context: Partial<ProposalContext>,
    type?: "parameter" | "reward" | "patch",
  ): Promise<Proposal> {
    const fullContext: ProposalContext = {
      metrics: {
        nDCG: 0.78,
        MRR: 0.86,
        p95Latency: 187,
        searchQuality: 0.82,
        cacheHitRate: 0.72,
        failureRate: 0.03,
        ...context.metrics,
      },
      lastParams: context.lastParams || {},
      trend: context.trend || "stable",
      environment: context.environment || "development",
    };

    const proposals = await this.generateProposals(fullContext, {
      count: 1,
      focusArea: type
        ? type === "parameter"
          ? "performance"
          : "quality"
        : "all",
    });

    return proposals[0];
  }

  /**
   * Get current model and performance statistics
   */
  getStats(): {
    model: string;
    performanceTargets: typeof this.performanceTargets;
    isHealthy: boolean;
  } {
    return {
      model: this.model,
      performanceTargets: this.performanceTargets,
      isHealthy: true, // TODO: Implement health check
    };
  }
}
