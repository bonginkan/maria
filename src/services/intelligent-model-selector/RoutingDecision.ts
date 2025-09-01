/**
 * Routing Decision Engine with complete reason tracking and scoring
 * Orchestrates policy evaluation, model selection, and decision logging
 */

import { EventEmitter } from 'events';
import type { ProcessedTaskInput } from './types/TaskInput.js';
import type { CompleteRoutingLog } from './types/DecisionLog.js';
import type { ModelSelectionCandidate } from './ModelPoolManager.js';
import type { PolicyEvaluationResult } from './PolicyEngine.js';

export interface RoutingDecisionResult {
  /** Final selected model */
  selectedModel: {
    id: string;
    providerId: string;
    confidence: number;
    estimatedCostUsd: number;
    estimatedTTFBMs: number;
  };
  
  /** Complete reasoning chain */
  reasoning: {
    policyMatch: PolicyEvaluationResult;
    candidateEvaluation: ModelSelectionCandidate[];
    selectionCriteria: SelectionCriteria;
    decisionFactors: DecisionFactor[];
  };
  
  /** Fallback chain prepared */
  fallbackChain: string[];
  
  /** Generation parameters for reproducibility */
  generationParams: {
    temperature: number;
    topP: number;
    seed?: number;
    maxTokens: number;
    stop?: string[];
  };
  
  /** Performance breakdown for TTFB monitoring */
  performanceBreakdown: {
    policyEvaluationMs: number;
    modelSelectionMs: number;
    totalDecisionMs: number;
  };
  
  /** Decision metadata */
  metadata: {
    decisionTimestamp: string;
    confidenceScore: number;
    riskScore: number;
    abTestInfo?: any;
    emergencyMode?: boolean;
  };
}

export interface SelectionCriteria {
  weights: {
    health: number;
    latency: number;
    cost: number;
    quality: number;
    capability: number;
  };
  constraints: {
    maxCostUsd: number;
    maxLatencyMs: number;
    minQualityScore: number;
    requiredCapabilities: string[];
  };
  preferences: {
    costTier: 'low' | 'mid' | 'high';
    qualityPreference: 'fast' | 'balanced' | 'quality';
    riskTolerance: 'conservative' | 'moderate' | 'aggressive';
  };
}

export interface DecisionFactor {
  factor: string;
  impact: 'positive' | 'negative' | 'neutral';
  weight: number;
  description: string;
  numericValue?: number;
}

export class RoutingDecisionEngine extends EventEmitter {
  constructor(
    private readonly policyEngine: any, // PolicyEngine
    private readonly poolManager: any,  // ModelPoolManager
    private readonly piiRedactor: any,  // CompletePIIRedactor
    private readonly options: {
      defaultWeights: SelectionCriteria['weights'];
      randomSeedRange: [number, number];
      confidenceThreshold: number;
    } = {
      defaultWeights: {
        health: 0.35,
        latency: 0.25,
        cost: 0.20,
        quality: 0.15,
        capability: 0.05
      },
      randomSeedRange: [1000, 9999],
      confidenceThreshold: 0.7
    }
  ) {
    super();
  }

  /**
   * Make routing decision with complete tracking
   */
  async makeRoutingDecision(
    task: ProcessedTaskInput,
    policyId = 'default',
    previousAttempts: string[] = []
  ): Promise<RoutingDecisionResult> {
    const startTime = Date.now();
    const decisionId = this.generateDecisionId();
    
    this.emit('decisionStarted', { decisionId, task: task.task.kind, traceId: task.traceId });

    try {
      // Step 1: Evaluate policy
      const policyStartTime = Date.now();
      const policyMatch = await this.policyEngine.evaluatePolicy(task, policyId);
      const policyEvaluationMs = Date.now() - policyStartTime;

      // Step 2: Select model pool and get candidates
      const modelSelectionStartTime = Date.now();
      const poolId = policyMatch.finalConfig.usePool || 'default';
      
      const selectionCriteria = this.buildSelectionCriteria(policyMatch, task);
      const candidates = await this.poolManager.selectModelsFromPool(
        poolId,
        this.buildPoolRequirements(selectionCriteria, task),
        previousAttempts
      );
      
      if (candidates.length === 0 || !candidates.some(c => c.available)) {
        throw new Error('No available models found for request');
      }

      // Step 3: Apply advanced selection logic
      const selectedCandidate = await this.selectOptimalModel(candidates, selectionCriteria, task);
      const modelSelectionMs = Date.now() - modelSelectionStartTime;

      // Step 4: Build fallback chain
      const fallbackChain = this.buildFallbackChain(candidates, selectedCandidate.model.id);

      // Step 5: Generate reproducible parameters
      const generationParams = this.generateReproducibleParams(
        policyMatch.finalConfig,
        selectedCandidate.model,
        task
      );

      // Step 6: Calculate decision factors and confidence
      const decisionFactors = this.analyzeDecisionFactors(
        selectedCandidate,
        candidates,
        selectionCriteria
      );
      
      const confidenceScore = this.calculateConfidenceScore(
        selectedCandidate,
        candidates,
        decisionFactors
      );
      
      const riskScore = this.calculateRiskScore(selectedCandidate, task, policyMatch);

      const totalDecisionMs = Date.now() - startTime;

      const result: RoutingDecisionResult = {
        selectedModel: {
          id: selectedCandidate.model.id,
          providerId: selectedCandidate.model.providerId,
          confidence: confidenceScore,
          estimatedCostUsd: this.estimateRequestCost(selectedCandidate.model, task),
          estimatedTTFBMs: selectedCandidate.model.performance.estimatedTTFBMs
        },
        reasoning: {
          policyMatch,
          candidateEvaluation: candidates,
          selectionCriteria,
          decisionFactors
        },
        fallbackChain,
        generationParams,
        performanceBreakdown: {
          policyEvaluationMs,
          modelSelectionMs,
          totalDecisionMs
        },
        metadata: {
          decisionTimestamp: new Date().toISOString(),
          confidenceScore,
          riskScore,
          abTestInfo: policyMatch.abTestAssignment,
          emergencyMode: policyMatch.finalConfig.emergencyMode
        }
      };

      this.emit('decisionCompleted', {
        decisionId,
        selectedModelId: result.selectedModel.id,
        confidence: confidenceScore,
        totalTimeMs: totalDecisionMs,
        candidatesEvaluated: candidates.length
      });

      return result;
    } catch (error) {
      this.emit('decisionFailed', { decisionId, error, task: task.task.kind });
      throw error;
    }
  }

  /**
   * Reproduce a previous decision using snapshots
   */
  async reproduceDecision(
    task: ProcessedTaskInput,
    policySnapshot: any,
    poolSnapshot: any,
    healthSnapshot: any
  ): Promise<RoutingDecisionResult> {
    try {
      // Use policy engine's reproduction method
      const policyMatch = await this.policyEngine.reproduceEvaluation(task, policySnapshot);
      
      // Simulate pool manager behavior with snapshot data
      const candidates = this.simulateModelSelection(poolSnapshot, healthSnapshot, task);
      
      const selectionCriteria = this.buildSelectionCriteria(policyMatch, task);
      const selectedCandidate = await this.selectOptimalModel(candidates, selectionCriteria, task);
      
      const fallbackChain = this.buildFallbackChain(candidates, selectedCandidate.model.id);
      const generationParams = this.generateReproducibleParams(
        policyMatch.finalConfig,
        selectedCandidate.model,
        task
      );
      
      const decisionFactors = this.analyzeDecisionFactors(
        selectedCandidate,
        candidates,
        selectionCriteria
      );
      
      return {
        selectedModel: {
          id: selectedCandidate.model.id,
          providerId: selectedCandidate.model.providerId,
          confidence: this.calculateConfidenceScore(selectedCandidate, candidates, decisionFactors),
          estimatedCostUsd: this.estimateRequestCost(selectedCandidate.model, task),
          estimatedTTFBMs: selectedCandidate.model.performance.estimatedTTFBMs
        },
        reasoning: {
          policyMatch,
          candidateEvaluation: candidates,
          selectionCriteria,
          decisionFactors
        },
        fallbackChain,
        generationParams,
        performanceBreakdown: {
          policyEvaluationMs: 0, // Reproduction
          modelSelectionMs: 0,   // Reproduction
          totalDecisionMs: 0     // Reproduction
        },
        metadata: {
          decisionTimestamp: new Date().toISOString(),
          confidenceScore: this.calculateConfidenceScore(selectedCandidate, candidates, decisionFactors),
          riskScore: this.calculateRiskScore(selectedCandidate, task, policyMatch),
          abTestInfo: policyMatch.abTestAssignment
        }
      };
    } catch (error) {
      this.emit('reproductionFailed', { error });
      throw error;
    }
  }

  /**
   * Validate decision quality
   */
  async validateDecision(decision: RoutingDecisionResult): Promise<{
    valid: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check confidence threshold
    if (decision.metadata.confidenceScore < this.options.confidenceThreshold) {
      issues.push(`Low confidence score: ${decision.metadata.confidenceScore.toFixed(2)}`);
      recommendations.push('Consider adding more model candidates or adjusting selection criteria');
    }

    // Check risk score
    if (decision.metadata.riskScore > 0.7) {
      issues.push(`High risk score: ${decision.metadata.riskScore.toFixed(2)}`);
      recommendations.push('Review model health and fallback chain');
    }

    // Check fallback chain
    if (decision.fallbackChain.length < 2) {
      issues.push('Insufficient fallback options');
      recommendations.push('Ensure at least 2-3 fallback models are available');
    }

    // Check performance estimates
    if (decision.selectedModel.estimatedTTFBMs > 2000) {
      issues.push(`High estimated TTFB: ${decision.selectedModel.estimatedTTFBMs}ms`);
      recommendations.push('Consider faster models or optimize routing logic');
    }

    return {
      valid: issues.length === 0,
      issues,
      recommendations
    };
  }

  /**
   * Private methods
   */

  private buildSelectionCriteria(
    policyMatch: PolicyEvaluationResult,
    task: ProcessedTaskInput
  ): SelectionCriteria {
    const config = policyMatch.finalConfig;
    
    // Adjust weights based on policy preferences
    const weights = { ...this.options.defaultWeights };
    
    if (config.qualityPreference === 'fast') {
      weights.latency = 0.4;
      weights.health = 0.3;
      weights.quality = 0.1;
      weights.cost = 0.15;
      weights.capability = 0.05;
    } else if (config.qualityPreference === 'quality') {
      weights.quality = 0.4;
      weights.capability = 0.2;
      weights.health = 0.2;
      weights.latency = 0.1;
      weights.cost = 0.1;
    }

    // Build constraints
    const constraints = {
      maxCostUsd: this.calculateMaxCost(config.costTier, task),
      maxLatencyMs: config.latencyBudgetMs || 2000,
      minQualityScore: 0.6,
      requiredCapabilities: config.requireCapabilities || []
    };

    // Determine preferences
    const preferences = {
      costTier: config.costTier as 'low' | 'mid' | 'high',
      qualityPreference: config.qualityPreference as 'fast' | 'balanced' | 'quality',
      riskTolerance: task.session.plan === 'enterprise' ? 'conservative' : 'moderate' as const
    };

    return { weights, constraints, preferences };
  }

  private buildPoolRequirements(criteria: SelectionCriteria, task: ProcessedTaskInput) {
    return {
      modality: task.task.modality,
      maxCost: criteria.constraints.maxCostUsd,
      maxLatencyMs: criteria.constraints.maxLatencyMs,
      minQualityScore: criteria.constraints.minQualityScore,
      requiredCapabilities: criteria.constraints.requiredCapabilities
    };
  }

  private async selectOptimalModel(
    candidates: ModelSelectionCandidate[],
    criteria: SelectionCriteria,
    task: ProcessedTaskInput
  ): Promise<ModelSelectionCandidate> {
    // Filter to available models only
    const availableCandidates = candidates.filter(c => c.available);
    
    if (availableCandidates.length === 0) {
      throw new Error('No available models after filtering');
    }

    // Calculate composite scores
    const scoredCandidates = availableCandidates.map(candidate => {
      const compositeScore = this.calculateCompositeScore(candidate, criteria);
      return { ...candidate, compositeScore };
    });

    // Sort by composite score (descending)
    scoredCandidates.sort((a, b) => (b as any).compositeScore - (a as any).compositeScore);

    // Apply tie-breaking logic
    const topScore = (scoredCandidates[0] as any).compositeScore;
    const topCandidates = scoredCandidates.filter(c => 
      Math.abs((c as any).compositeScore - topScore) < 0.01
    );

    if (topCandidates.length === 1) {
      return topCandidates[0];
    }

    // Tie-breaking: prefer models with better health
    return topCandidates.reduce((best, current) => 
      current.healthScore > best.healthScore ? current : best
    );
  }

  private calculateCompositeScore(
    candidate: ModelSelectionCandidate,
    criteria: SelectionCriteria
  ): number {
    const weights = criteria.weights;
    
    // Normalize individual scores
    const healthScore = candidate.healthScore;
    const latencyScore = Math.max(0, 1 - (candidate.model.performance.estimatedTTFBMs / criteria.constraints.maxLatencyMs));
    const costScore = this.calculateCostScore(candidate.model, criteria.constraints.maxCostUsd);
    const qualityScore = candidate.model.performance.qualityScore;
    const capabilityScore = this.calculateCapabilityScore(candidate.model, criteria.constraints.requiredCapabilities);

    return (
      weights.health * healthScore +
      weights.latency * latencyScore +
      weights.cost * costScore +
      weights.quality * qualityScore +
      weights.capability * capabilityScore
    );
  }

  private calculateCostScore(model: any, maxCostUsd: number): number {
    const estimatedCost = model.cost.inputTokensPPM * 0.001; // Rough estimate
    return Math.max(0, 1 - (estimatedCost / maxCostUsd));
  }

  private calculateCapabilityScore(model: any, requiredCapabilities: string[]): number {
    if (requiredCapabilities.length === 0) return 1.0;
    
    const capabilities = model.capabilities;
    let matchedCapabilities = 0;
    
    for (const capability of requiredCapabilities) {
      switch (capability) {
        case 'function_calling':
          if (capabilities.functionCalling) matchedCapabilities++;
          break;
        case 'vision':
          if (capabilities.vision) matchedCapabilities++;
          break;
        case 'streaming':
          if (capabilities.streaming) matchedCapabilities++;
          break;
        // Add more capability checks as needed
      }
    }
    
    return matchedCapabilities / requiredCapabilities.length;
  }

  private buildFallbackChain(candidates: ModelSelectionCandidate[], selectedModelId: string): string[] {
    return candidates
      .filter(c => c.available && c.model.id !== selectedModelId)
      .sort((a, b) => b.selectionScore - a.selectionScore)
      .slice(0, 3) // Maximum 3 fallbacks
      .map(c => c.model.id);
  }

  private generateReproducibleParams(config: any, model: any, task: ProcessedTaskInput) {
    // Generate deterministic seed based on task characteristics
    const seedInput = `${task.traceId}-${model.id}-${JSON.stringify(task.task)}`;
    const seed = this.deterministicSeed(seedInput);
    
    return {
      temperature: config.generationParams?.temperature || model.defaultParams.temperature,
      topP: config.generationParams?.topP || model.defaultParams.topP,
      seed: seed,
      maxTokens: config.generationParams?.maxTokens || Math.min(model.capabilities.maxOutputTokens, 4096),
      stop: config.generationParams?.stop || model.defaultParams.stop
    };
  }

  private deterministicSeed(input: string): number {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    // Ensure seed is within range
    const [min, max] = this.options.randomSeedRange;
    return Math.abs(hash % (max - min)) + min;
  }

  private analyzeDecisionFactors(
    selected: ModelSelectionCandidate,
    allCandidates: ModelSelectionCandidate[],
    criteria: SelectionCriteria
  ): DecisionFactor[] {
    const factors: DecisionFactor[] = [];
    
    // Health factor
    factors.push({
      factor: 'model_health',
      impact: selected.healthScore > 0.8 ? 'positive' : selected.healthScore > 0.5 ? 'neutral' : 'negative',
      weight: criteria.weights.health,
      description: `Model health score: ${(selected.healthScore * 100).toFixed(1)}%`,
      numericValue: selected.healthScore
    });
    
    // Latency factor
    const latencyScore = 1 - (selected.model.performance.estimatedTTFBMs / criteria.constraints.maxLatencyMs);
    factors.push({
      factor: 'estimated_latency',
      impact: latencyScore > 0.8 ? 'positive' : latencyScore > 0.5 ? 'neutral' : 'negative',
      weight: criteria.weights.latency,
      description: `Estimated TTFB: ${selected.model.performance.estimatedTTFBMs}ms`,
      numericValue: selected.model.performance.estimatedTTFBMs
    });
    
    // Cost factor
    const costScore = this.calculateCostScore(selected.model, criteria.constraints.maxCostUsd);
    factors.push({
      factor: 'cost_efficiency',
      impact: costScore > 0.8 ? 'positive' : costScore > 0.5 ? 'neutral' : 'negative',
      weight: criteria.weights.cost,
      description: `Cost efficiency score: ${(costScore * 100).toFixed(1)}%`,
      numericValue: costScore
    });
    
    // Circuit breaker factor
    factors.push({
      factor: 'circuit_breaker_state',
      impact: selected.circuitState.status === 'closed' ? 'positive' : 
              selected.circuitState.status === 'half_open' ? 'neutral' : 'negative',
      weight: 0.1,
      description: `Circuit breaker: ${selected.circuitState.status}`,
      numericValue: selected.circuitState.status === 'closed' ? 1 : 
                    selected.circuitState.status === 'half_open' ? 0.5 : 0
    });
    
    return factors;
  }

  private calculateConfidenceScore(
    selected: ModelSelectionCandidate,
    candidates: ModelSelectionCandidate[],
    factors: DecisionFactor[]
  ): number {
    // Base confidence from selection score
    const baseConfidence = selected.selectionScore;
    
    // Adjust for number of available alternatives
    const availableAlternatives = candidates.filter(c => c.available).length;
    const alternativesBonus = Math.min(0.1, availableAlternatives * 0.02);
    
    // Adjust for circuit breaker state
    const circuitBreakerPenalty = selected.circuitState.status === 'open' ? 0.3 : 
                                  selected.circuitState.status === 'half_open' ? 0.1 : 0;
    
    // Adjust for health score
    const healthBonus = selected.healthScore > 0.8 ? 0.1 : 0;
    
    return Math.max(0, Math.min(1, 
      baseConfidence + alternativesBonus - circuitBreakerPenalty + healthBonus
    ));
  }

  private calculateRiskScore(
    selected: ModelSelectionCandidate,
    task: ProcessedTaskInput,
    policyMatch: PolicyEvaluationResult
  ): number {
    let riskScore = 0;
    
    // Health-based risk
    riskScore += (1 - selected.healthScore) * 0.4;
    
    // Circuit breaker risk
    if (selected.circuitState.status === 'open') {
      riskScore += 0.3;
    } else if (selected.circuitState.status === 'half_open') {
      riskScore += 0.1;
    }
    
    // Failure rate risk
    if (selected.circuitState.totalRequests > 0) {
      const failureRate = selected.circuitState.totalFailures / selected.circuitState.totalRequests;
      riskScore += failureRate * 0.2;
    }
    
    // Emergency mode risk
    if (policyMatch.finalConfig.emergencyMode) {
      riskScore += 0.2;
    }
    
    // Cost risk (overbudget)
    const estimatedCost = this.estimateRequestCost(selected.model, task);
    const maxCost = this.calculateMaxCost(policyMatch.finalConfig.costTier, task);
    if (estimatedCost > maxCost) {
      riskScore += Math.min(0.1, (estimatedCost - maxCost) / maxCost);
    }
    
    return Math.min(1, riskScore);
  }

  private calculateMaxCost(costTier: string, task: ProcessedTaskInput): number {
    const baseCosts = { low: 0.001, mid: 0.01, high: 0.1 };
    const base = baseCosts[costTier as keyof typeof baseCosts] || baseCosts.mid;
    
    // Adjust for task complexity
    const tokenMultiplier = Math.max(1, task.task.tokensIn / 1000);
    return base * tokenMultiplier;
  }

  private estimateRequestCost(model: any, task: ProcessedTaskInput): number {
    const inputCost = (task.task.tokensIn / 1000000) * model.cost.inputTokensPPM;
    const estimatedOutputTokens = Math.min(model.capabilities.maxOutputTokens, 2000);
    const outputCost = (estimatedOutputTokens / 1000000) * model.cost.outputTokensPPM;
    
    return inputCost + outputCost + (model.cost.fixedCostPerRequest || 0);
  }

  private simulateModelSelection(poolSnapshot: any, healthSnapshot: any, task: ProcessedTaskInput): ModelSelectionCandidate[] {
    const candidates: ModelSelectionCandidate[] = [];
    
    for (const model of poolSnapshot.models) {
      const providerId = model.providerId;
      const healthInfo = healthSnapshot[providerId];
      
      const candidate: ModelSelectionCandidate = {
        model,
        healthScore: healthInfo?.healthScore || 0.5,
        circuitState: {
          status: 'closed',
          failureCount: 0,
          consecutiveSuccesses: 0,
          lastFailureTime: 0,
          enteredStateAt: Date.now(),
          minStayDurationMs: 0,
          totalRequests: 0,
          totalFailures: 0
        },
        selectionScore: this.calculateCompositeScore({ model, healthScore: healthInfo?.healthScore || 0.5 } as any, {
          weights: this.options.defaultWeights,
          constraints: {
            maxCostUsd: 0.1,
            maxLatencyMs: 2000,
            minQualityScore: 0.5,
            requiredCapabilities: []
          },
          preferences: {
            costTier: 'mid',
            qualityPreference: 'balanced',
            riskTolerance: 'moderate'
          }
        }),
        reasons: [`Reproduced from snapshot`],
        available: true
      };
      
      candidates.push(candidate);
    }
    
    return candidates.sort((a, b) => b.selectionScore - a.selectionScore);
  }

  private generateDecisionId(): string {
    return `decision_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}