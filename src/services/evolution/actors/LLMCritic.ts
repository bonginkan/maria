/**
 * LLMCritic - Comprehensive 128B Model for Proposal Review
 *
 * Optimized for GPT-OSS 128B model via LM Studio
 * Focus: Quality, safety, thorough analysis, detailed justification
 * Target: >90% correlation with expert human reviews
 */

import { BaseService } from "../../internal-mode/core/BaseService";
import { LMStudioProvider } from "../../../providers/lmstudio-provider";
import { ConfigManager } from "../../../config/config-manager";
import { Proposal } from "./LLMProposer";

export interface ReviewContext {
  proposal: Proposal;
  systemContext: {
    metrics: {
      nDCG: number;
      MRR: number;
      p95Latency: number;
      searchQuality: number;
      cacheHitRate: number;
      failureRate: number;
    };
    currentParams: any;
    recentHistory: Array<{
      timestamp: string;
      change: string;
      outcome: "success" | "failure" | "rollback";
      impact: any;
    }>;
    environment: "development" | "production" | "testing";
    constraints: {
      maxRisk: number;
      allowedFiles: string[];
      maintenanceWindow?: boolean;
    };
  };
  policyContext: {
    safetyRules: string[];
    qualityStandards: string[];
    architecturalPrinciples: string[];
    complianceRequirements: string[];
  };
}

export interface ReviewScore {
  safety: number; // 0-1: How safe is this change?
  consistency: number; // 0-1: Aligns with architecture/patterns?
  feasibility: number; // 0-1: Can this actually be implemented?
  expectedImpact: number; // 0-1: Likelihood of achieving expected results
  testability: number; // 0-1: How well can this be tested?
  maintainability: number; // 0-1: Long-term maintenance implications
  overall: number; // 0-1: Composite score
}

export interface Review {
  proposalId: string;
  reviewId: string;
  timestamp: string;

  // Core assessment
  score: ReviewScore;
  recommendation: "approve" | "approve_with_conditions" | "revise" | "reject";
  confidence: number; // 0-1: How confident is the critic in this review?

  // Detailed analysis
  rationale: string[]; // Primary reasons for the recommendation
  strengths: string[]; // What's good about this proposal
  concerns: string[]; // What could go wrong

  // Evidence and citations
  evidence: Array<{
    type: "file" | "metric" | "documentation" | "precedent";
    reference: string;
    relevance: string;
    impact: "supports" | "contradicts" | "neutral";
  }>;

  // Specific recommendations
  conditions?: string[]; // Required conditions for approval
  modifications: Array<{
    aspect: string;
    current: any;
    suggested: any;
    reason: string;
    priority: "must" | "should" | "could";
  }>;

  // Risk analysis
  risks: Array<{
    category:
      | "performance"
      | "quality"
      | "reliability"
      | "security"
      | "maintainability";
    description: string;
    probability: number; // 0-1
    severity: number; // 0-1
    mitigation: string;
  }>;

  // Implementation guidance
  implementationNotes: string[];
  testingRecommendations: string[];
  monitoringRequirements: string[];
  rollbackTriggers: string[];

  // Metadata
  metadata: {
    modelUsed: string;
    reviewTime: number; // milliseconds
    temperature: number;
    contextTokens: number;
    reviewTokens: number;
    citedSources: number;
  };
}

export interface ReviewOptions {
  depth: "quick" | "standard" | "thorough";
  focusAreas?: Array<"safety" | "quality" | "performance" | "compliance">;
  includeEvidence?: boolean;
  timeLimit?: number; // Max review time in ms
  temperature?: number; // LLM temperature override
  requireCitations?: boolean;
}

export class LLMCritic extends BaseService {
  id = "llmcritic";
  version = "1.0.0";

  private provider: LMStudioProvider;
  private configManager: ConfigManager;
  private model: string = "gpt-oss-128b"; // Quality model for reviews

  // Performance targets for 128B model
  private readonly performanceTargets = {
    maxReviewTime: 3500, // 3.5s target (quality over speed)
    maxTokensPerReview: 2048, // More detailed analysis
    minConfidenceThreshold: 0.8, // High confidence required
  };

  // Knowledge base for citations and evidence
  private readonly knowledgeBase = {
    files: [
      "src/services/search/rrf/RRFusion.ts",
      "src/services/evolution/EvolutionEngine.ts",
      "src/services/memory-system/dual-memory-engine.ts",
      "docs/ARCHITECTURE.md",
      "docs/LINT_TYPECHECK_RESOLUTION_GUIDE.md",
      "CLAUDE.md",
    ],
    principles: [
      "Minimal API, Maximum Power",
      "Service Pattern with Dependency Injection",
      "No deep imports - use public API only",
      "TypeScript strict mode (temporarily disabled)",
      "Zero hardcoding architecture",
    ],
    safetyRules: [
      "Never modify authentication or security systems",
      "All changes must be reversible",
      "No changes to core infrastructure",
      "Validate all parameter ranges",
      "Preserve backward compatibility",
    ],
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
    this.model = config.llm?.critic?.model || "gpt-oss-128b";

    console.log(`LLMCritic initialized with model: ${this.model}`);
  }

  /**
   * Review a single proposal with comprehensive analysis
   */
  async reviewProposal(
    context: ReviewContext,
    options: ReviewOptions = {},
  ): Promise<Review> {
    const startTime = performance.now();

    const {
      depth = "standard",
      focusAreas = ["safety", "quality", "performance"],
      includeEvidence = true,
      timeLimit = this.performanceTargets.maxReviewTime,
      temperature = 0.2, // Lower temperature for consistent analysis
      requireCitations = true,
    } = options;

    try {
      console.log(
        `Reviewing proposal ${context.proposal.id} with ${depth} depth...`,
      );

      const prompt = this.buildReviewPrompt(context, {
        depth,
        focusAreas,
        requireCitations,
      });

      const response = await this.provider.chat(
        [
          {
            role: "system",
            content: this.getSystemPrompt(depth, focusAreas),
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        this.model,
        {
          temperature,
          maxTokens: this.performanceTargets.maxTokensPerReview,
          topP: 0.95,
        },
      );

      const endTime = performance.now();
      const reviewTime = endTime - startTime;

      const review = this.parseReviewResponse(response, {
        proposalId: context.proposal.id,
        modelUsed: this.model,
        reviewTime,
        temperature,
        contextTokens: this.estimateTokens(prompt),
        reviewTokens: this.estimateTokens(response),
        citedSources: this.countCitations(response),
      });

      // Validate review quality
      if (!this.validateReview(review, context)) {
        throw new Error("Generated review failed validation");
      }

      // Add evidence if requested
      if (includeEvidence) {
        review.evidence = await this.gatherEvidence(context.proposal, review);
      }

      console.log(
        `Review completed in ${reviewTime.toFixed(0)}ms - ${review.recommendation} (${(review.score.overall * 100).toFixed(0)}%)`,
      );

      return review;
    } catch (error) {
      console.error("Error reviewing proposal:", error);
      throw new Error(
        `Proposal review failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Review multiple proposals and provide comparative analysis
   */
  async reviewProposals(
    contexts: ReviewContext[],
    options: ReviewOptions = {},
  ): Promise<{
    reviews: Review[];
    comparison: {
      recommended: string[]; // Proposal IDs in order of recommendation
      concerns: string[]; // Common concerns across proposals
      risks: string[]; // Shared risk factors
      synergies: Array<{
        // Proposals that work well together
        proposalIds: string[];
        benefit: string;
      }>;
    };
  }> {
    console.log(`Reviewing ${contexts.length} proposals...`);

    // Review each proposal individually
    const reviewPromises = contexts.map((context) =>
      this.reviewProposal(context, options),
    );

    const reviews = await Promise.all(reviewPromises);

    // Generate comparative analysis
    const comparison = this.generateComparison(reviews);

    return { reviews, comparison };
  }

  /**
   * Build comprehensive review prompt
   */
  private buildReviewPrompt(context: ReviewContext, options: any): string {
    const { proposal, systemContext, policyContext } = context;

    return `# MARIA Evolution Proposal Review

## Proposal Under Review
**ID:** ${proposal.id}
**Type:** ${proposal.type}
**Priority:** ${proposal.priority}
**Summary:** ${proposal.summary}

**Proposal Details:**
${JSON.stringify(proposal, null, 2)}

## System Context
**Current Metrics:**
- nDCG@10: ${systemContext.metrics.nDCG.toFixed(3)}
- MRR: ${systemContext.metrics.MRR.toFixed(3)}
- P95 Latency: ${systemContext.metrics.p95Latency}ms
- Search Quality: ${(systemContext.metrics.searchQuality * 100).toFixed(1)}%
- Cache Hit Rate: ${(systemContext.metrics.cacheHitRate * 100).toFixed(1)}%
- Failure Rate: ${(systemContext.metrics.failureRate * 100).toFixed(2)}%

**Environment:** ${systemContext.environment}
**Max Risk Allowed:** ${systemContext.constraints.maxRisk}

**Recent History:**
${systemContext.recentHistory.map((h) => `- ${h.timestamp}: ${h.change} → ${h.outcome}`).join("\n")}

## Policy Context
**Safety Rules:**
${policyContext.safetyRules.map((rule) => `- ${rule}`).join("\n")}

**Quality Standards:**
${policyContext.qualityStandards.map((std) => `- ${std}`).join("\n")}

**Architectural Principles:**
${policyContext.architecturalPrinciples.map((principle) => `- ${principle}`).join("\n")}

## Review Requirements
**Depth:** ${options.depth}
**Focus Areas:** ${options.focusAreas.join(", ")}
**Citations Required:** ${options.requireCitations ? "Yes" : "No"}

## Knowledge Base References
**Key Files:**
${this.knowledgeBase.files.map((file) => `- ${file}`).join("\n")}

**Architecture Principles:**
${this.knowledgeBase.principles.map((principle) => `- ${principle}`).join("\n")}

## Task
Provide a comprehensive review of this proposal. Analyze:

1. **Safety**: Risk of breaking systems, data corruption, security implications
2. **Consistency**: Alignment with architectural patterns and existing code
3. **Feasibility**: Practical implementation challenges and requirements  
4. **Impact**: Likelihood of achieving expected results
5. **Testability**: How thoroughly can this change be validated
6. **Maintainability**: Long-term implications for code maintenance

**Return ONLY valid JSON in this exact format:**
\`\`\`json
{
  "score": {
    "safety": 0.0-1.0,
    "consistency": 0.0-1.0,
    "feasibility": 0.0-1.0,
    "expectedImpact": 0.0-1.0,
    "testability": 0.0-1.0,
    "maintainability": 0.0-1.0,
    "overall": 0.0-1.0
  },
  "recommendation": "approve|approve_with_conditions|revise|reject",
  "confidence": 0.0-1.0,
  "rationale": [
    "Primary reason 1",
    "Primary reason 2"
  ],
  "strengths": [
    "What's good about this proposal"
  ],
  "concerns": [
    "What could go wrong"
  ],
  "conditions": [
    "Required condition 1 (if approve_with_conditions)"
  ],
  "modifications": [
    {
      "aspect": "parameter name",
      "current": "current value",
      "suggested": "suggested value", 
      "reason": "why this change is needed",
      "priority": "must|should|could"
    }
  ],
  "risks": [
    {
      "category": "performance|quality|reliability|security|maintainability",
      "description": "risk description",
      "probability": 0.0-1.0,
      "severity": 0.0-1.0,
      "mitigation": "how to mitigate this risk"
    }
  ],
  "implementationNotes": [
    "Implementation guidance"
  ],
  "testingRecommendations": [
    "How to test this change"
  ],
  "monitoringRequirements": [
    "What to monitor after deployment"
  ],
  "rollbackTriggers": [
    "When to rollback this change"
  ]
}
\`\`\``;
  }

  /**
   * Get system prompt for the critic
   */
  private getSystemPrompt(depth: string, focusAreas: string[]): string {
    return `You are MARIA's Senior Evolution Critic, an expert system reviewer with deep knowledge of:

**Technical Expertise:**
- Search system architecture (RRF, embeddings, reranking)
- Reinforcement learning and reward systems
- TypeScript/Node.js enterprise patterns
- Database optimization and caching strategies
- Performance monitoring and observability

**Review Philosophy:**
- Safety first: Prevent system degradation at all costs
- Evidence-based: All conclusions must be supported by data or citations
- Architectural integrity: Maintain consistency with established patterns
- Risk-aware: Identify and quantify potential failure modes
- Practical: Focus on implementable, measurable improvements

**Review Standards:**
- ${depth === "thorough" ? "THOROUGH: Comprehensive analysis with extensive evidence" : depth === "quick" ? "QUICK: Focus on critical issues only" : "STANDARD: Balanced review with key evidence"}
- Focus on: ${focusAreas.join(", ")}
- Always provide specific, actionable feedback
- Cite relevant files, metrics, or documentation when available

**Critical Assessment Areas:**
1. **Safety**: Can this change break existing functionality?
2. **Architecture**: Does this follow MARIA's patterns and principles?
3. **Performance**: What are the resource and latency implications?
4. **Quality**: Will this achieve the claimed improvements?
5. **Risk**: What could go wrong and how likely is it?

**Your mission:** Provide thorough, honest, constructive criticism that helps MARIA evolve safely and effectively.

**Output:** Return ONLY the requested JSON format. No explanations, no markdown, just the structured review object.`;
  }

  /**
   * Parse the review response from the LLM
   */
  private parseReviewResponse(response: string, metadata: any): Review {
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

      // Generate unique review ID
      const reviewId = `review-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      return {
        proposalId: metadata.proposalId,
        reviewId,
        timestamp: new Date().toISOString(),
        score: parsed.score,
        recommendation: parsed.recommendation,
        confidence: parsed.confidence,
        rationale: parsed.rationale || [],
        strengths: parsed.strengths || [],
        concerns: parsed.concerns || [],
        evidence: [], // Will be populated separately
        conditions: parsed.conditions || [],
        modifications: parsed.modifications || [],
        risks: parsed.risks || [],
        implementationNotes: parsed.implementationNotes || [],
        testingRecommendations: parsed.testingRecommendations || [],
        monitoringRequirements: parsed.monitoringRequirements || [],
        rollbackTriggers: parsed.rollbackTriggers || [],
        metadata,
      };
    } catch (error) {
      console.error("Failed to parse review response:", error);
      console.error("Response:", response);

      return this.createFallbackReview(response, metadata);
    }
  }

  /**
   * Create fallback review when parsing fails
   */
  private createFallbackReview(response: string, metadata: any): Review {
    return {
      proposalId: metadata.proposalId,
      reviewId: `fallback-${Date.now()}`,
      timestamp: new Date().toISOString(),
      score: {
        safety: 0.1,
        consistency: 0.1,
        feasibility: 0.1,
        expectedImpact: 0.1,
        testability: 0.1,
        maintainability: 0.1,
        overall: 0.1,
      },
      recommendation: "reject",
      confidence: 0.2,
      rationale: ["Review parsing failed", "Automatic rejection for safety"],
      strengths: [],
      concerns: [
        "Unable to parse review response",
        "Potential LLM output format issue",
      ],
      evidence: [],
      conditions: [],
      modifications: [],
      risks: [
        {
          category: "reliability",
          description: "Review system failure - manual review required",
          probability: 1.0,
          severity: 0.8,
          mitigation: "Manual expert review before any implementation",
        },
      ],
      implementationNotes: ["Do not implement without manual review"],
      testingRecommendations: ["Requires human expert evaluation"],
      monitoringRequirements: ["Monitor review system health"],
      rollbackTriggers: ["Any system degradation"],
      metadata,
    };
  }

  /**
   * Validate the generated review
   */
  private validateReview(review: Review, context: ReviewContext): boolean {
    // Required fields validation
    if (!review.score || !review.recommendation || !review.rationale?.length) {
      console.warn("Review missing required fields");
      return false;
    }

    // Score validation
    const scores = Object.values(review.score);
    if (
      scores.some(
        (score) => typeof score !== "number" || score < 0 || score > 1,
      )
    ) {
      console.warn("Invalid review scores");
      return false;
    }

    // Recommendation validation
    const validRecommendations = [
      "approve",
      "approve_with_conditions",
      "revise",
      "reject",
    ];
    if (!validRecommendations.includes(review.recommendation)) {
      console.warn("Invalid recommendation:", review.recommendation);
      return false;
    }

    // Confidence validation
    if (
      typeof review.confidence !== "number" ||
      review.confidence < 0 ||
      review.confidence > 1
    ) {
      console.warn("Invalid confidence score");
      return false;
    }

    // Consistency checks
    if (
      review.recommendation === "approve_with_conditions" &&
      !review.conditions?.length
    ) {
      console.warn("Conditional approval missing conditions");
      return false;
    }

    if (review.score.overall < 0.3 && review.recommendation === "approve") {
      console.warn(
        "Low overall score with approve recommendation - inconsistent",
      );
      return false;
    }

    return true;
  }

  /**
   * Gather evidence for the review
   */
  private async gatherEvidence(
    proposal: Proposal,
    review: Review,
  ): Promise<
    Array<{
      type: "file" | "metric" | "documentation" | "precedent";
      reference: string;
      relevance: string;
      impact: "supports" | "contradicts" | "neutral";
    }>
  > {
    const evidence = [];

    // File references based on proposal type
    if (proposal.type === "parameter") {
      evidence.push({
        type: "file" as const,
        reference: "src/services/search/rrf/RRFusion.ts",
        relevance: "Contains RRF parameter implementation",
        impact: "supports" as const,
      });
    }

    // Documentation references
    evidence.push({
      type: "documentation" as const,
      reference: "CLAUDE.md",
      relevance: "Project guidelines and architectural patterns",
      impact: "supports" as const,
    });

    // Add metric references if impact claimed
    if (proposal.expectedImpact.nDCG > 0.01) {
      evidence.push({
        type: "metric" as const,
        reference: "nDCG@10 baseline measurement",
        relevance: "Validates expected quality improvement",
        impact: "supports" as const,
      });
    }

    return evidence;
  }

  /**
   * Generate comparative analysis of multiple reviews
   */
  private generateComparison(reviews: Review[]): any {
    // Sort by overall score and confidence
    const recommended = reviews
      .filter(
        (r) =>
          r.recommendation === "approve" ||
          r.recommendation === "approve_with_conditions",
      )
      .sort(
        (a, b) =>
          b.score.overall * b.confidence - a.score.overall * a.confidence,
      )
      .map((r) => r.proposalId);

    // Find common concerns
    const allConcerns = reviews.flatMap((r) => r.concerns);
    const concernCounts = allConcerns.reduce(
      (acc, concern) => {
        acc[concern] = (acc[concern] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const commonConcerns = Object.entries(concernCounts)
      .filter(([_, count]) => count > 1)
      .map(([concern]) => concern);

    // Find shared risks
    const allRisks = reviews.flatMap((r) =>
      r.risks.map((risk) => risk.description),
    );
    const riskCounts = allRisks.reduce(
      (acc, risk) => {
        acc[risk] = (acc[risk] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const sharedRisks = Object.entries(riskCounts)
      .filter(([_, count]) => count > 1)
      .map(([risk]) => risk);

    return {
      recommended,
      concerns: commonConcerns,
      risks: sharedRisks,
      synergies: [], // TODO: Implement synergy detection
    };
  }

  /**
   * Count citations in response
   */
  private countCitations(response: string): number {
    // Count file references, documentation mentions, etc.
    const patterns = [
      /src\/[a-zA-Z0-9\/\-\.]+\.ts/g,
      /docs\/[a-zA-Z0-9\/\-\.]+\.md/g,
      /CLAUDE\.md/g,
      /README\.md/g,
    ];

    let count = 0;
    for (const pattern of patterns) {
      const matches = response.match(pattern);
      count += matches ? matches.length : 0;
    }

    return count;
  }

  /**
   * Estimate token count (rough approximation)
   */
  private estimateTokens(text: string): number {
    // Rough approximation: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }

  /**
   * Quick review for testing/development
   */
  async quickReview(proposal: Proposal): Promise<Review> {
    const context: ReviewContext = {
      proposal,
      systemContext: {
        metrics: {
          nDCG: 0.78,
          MRR: 0.86,
          p95Latency: 187,
          searchQuality: 0.82,
          cacheHitRate: 0.72,
          failureRate: 0.03,
        },
        currentParams: {},
        recentHistory: [],
        environment: "development",
        constraints: {
          maxRisk: 0.5,
          allowedFiles: this.knowledgeBase.files,
        },
      },
      policyContext: {
        safetyRules: this.knowledgeBase.safetyRules,
        qualityStandards: ["Maintain nDCG@10 > 0.75", "P95 latency < 200ms"],
        architecturalPrinciples: this.knowledgeBase.principles,
        complianceRequirements: [],
      },
    };

    return this.reviewProposal(context, { depth: "quick" });
  }

  /**
   * Get current model and performance statistics
   */
  getStats(): {
    model: string;
    performanceTargets: typeof this.performanceTargets;
    knowledgeBaseSize: number;
    isHealthy: boolean;
  } {
    return {
      model: this.model,
      performanceTargets: this.performanceTargets,
      knowledgeBaseSize:
        this.knowledgeBase.files.length + this.knowledgeBase.principles.length,
      isHealthy: true, // TODO: Implement health check
    };
  }
}
