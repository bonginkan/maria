/**
 * Precise Cost Calculator - Handles complex pricing models and quota management
 * Supports tiered pricing, free quotas, usage tracking, and provider-specific pricing
 */

import { EventEmitter } from 'events';

export type PricingType = 'linear' | 'tiered' | 'usage-based' | 'subscription' | 'composite';

export interface PricingTier {
  from: number;
  to?: number; // undefined means no upper limit
  pricePerUnit: number;
  description?: string;
}

export interface FreeQuota {
  tokensPerMonth: number;
  requestsPerMonth?: number;
  resetDay: number; // Day of month (1-28)
  resetHour?: number; // Hour of day (0-23)
}

export interface ProviderCostModel {
  providerId: string;
  modelId: string;
  pricingType: PricingType;
  
  // Base pricing (for linear/simple models)
  inputTokenPrice?: number; // per million tokens
  outputTokenPrice?: number; // per million tokens
  basePrice?: number; // fixed cost per request
  
  // Tiered pricing
  inputTiers?: PricingTier[];
  outputTiers?: PricingTier[];
  
  // Free quotas
  freeQuota?: FreeQuota;
  
  // Usage-based multipliers
  qualityMultiplier?: number; // Higher quality = higher cost
  latencyMultiplier?: number; // Faster = higher cost
  
  // Subscription/composite models
  subscriptionFeatures?: {
    includedTokens: number;
    overageRate: number;
    billingPeriod: 'monthly' | 'yearly';
  };
  
  // Metadata
  currency: string;
  lastUpdated: Date;
  effectiveFrom: Date;
  effectiveUntil?: Date;
}

export interface UsageState {
  inputTokens: number;
  outputTokens: number;
  requests: number;
  monthStart: Date;
  totalSpent: number;
}

export interface CostEstimate {
  inputTokensCost: number;
  outputTokensCost: number;
  fixedCost: number;
  qualityPremium: number;
  latencyPremium: number;
  totalCostUsd: number;
  confidence: number; // 0-1, confidence in estimate accuracy
}

export interface ActualCost extends CostEstimate {
  freeQuotaApplied: {
    inputTokens: number;
    outputTokens: number;
    totalSavedUsd: number;
  };
  tierBreakdown: {
    tier: number;
    tokensUsed: number;
    cost: number;
  }[];
}

export interface QuotaStatus {
  remainingInputTokens: number;
  remainingOutputTokens: number;
  remainingRequests: number;
  quotaResetDate: Date;
  percentageUsed: number;
  willExceedQuota: boolean;
}

export interface CostPrediction {
  estimatedCost: CostEstimate;
  actualCost?: ActualCost;
  quotaStatus: QuotaStatus;
  quotaImpact: {
    costWithoutQuota: number;
    costWithQuota: number;
    savings: number;
  };
  recommendations: {
    action: 'proceed' | 'warn_quota' | 'suggest_alternative' | 'block_overage';
    reason: string;
    alternativeModel?: string;
    costComparison?: number;
  };
}

export class PreciseCostCalculator extends EventEmitter {
  private readonly costModels = new Map<string, ProviderCostModel>();
  private readonly usageCache = new Map<string, UsageState>();
  private readonly exchangeRates = new Map<string, number>();
  
  constructor(
    private readonly options: {
      defaultCurrency: string;
      cacheExpirationMs: number;
      enableUsageTracking: boolean;
      enableCostPrediction: boolean;
    } = {
      defaultCurrency: 'USD',
      cacheExpirationMs: 300000, // 5 minutes
      enableUsageTracking: true,
      enableCostPrediction: true
    }
  ) {
    super();
    
    // Initialize with default USD exchange rate
    this.exchangeRates.set('USD', 1.0);
    
    // Start periodic cleanup
    setInterval(() => this.cleanupCache(), this.options.cacheExpirationMs);
  }

  /**
   * Register a cost model for a provider/model combination
   */
  registerCostModel(costModel: ProviderCostModel): void {
    const key = `${costModel.providerId}:${costModel.modelId}`;
    this.costModels.set(key, { ...costModel });
    
    this.emit('costModelRegistered', {
      providerId: costModel.providerId,
      modelId: costModel.modelId,
      pricingType: costModel.pricingType
    });
  }

  /**
   * Calculate precise cost with quota management
   */
  async calculatePreciseCost(
    providerId: string,
    modelId: string,
    inputTokens: number,
    outputTokens: number,
    currentUsage: UsageState,
    qualityFactor = 1.0,
    latencyFactor = 1.0
  ): Promise<CostPrediction> {
    const key = `${providerId}:${modelId}`;
    const costModel = this.costModels.get(key);
    
    if (!costModel) {
      throw new Error(`Cost model not found for ${providerId}:${modelId}`);
    }

    // Calculate quota status first
    const quotaStatus = this.calculateQuotaStatus(costModel, currentUsage, inputTokens, outputTokens);
    
    // Calculate cost without quota
    const costWithoutQuota = await this.calculateRawCost(
      costModel,
      inputTokens,
      outputTokens,
      qualityFactor,
      latencyFactor,
      { inputTokens: 0, outputTokens: 0, requests: 0, monthStart: new Date(), totalSpent: 0 }
    );
    
    // Calculate cost with quota applied
    const costWithQuota = await this.calculateRawCost(
      costModel,
      inputTokens,
      outputTokens,
      qualityFactor,
      latencyFactor,
      currentUsage
    );

    // Generate recommendations
    const recommendations = this.generateCostRecommendations(
      costModel,
      quotaStatus,
      costWithQuota,
      inputTokens,
      outputTokens
    );

    const quotaImpact = {
      costWithoutQuota: costWithoutQuota.totalCostUsd,
      costWithQuota: costWithQuota.totalCostUsd,
      savings: costWithoutQuota.totalCostUsd - costWithQuota.totalCostUsd
    };

    this.emit('costCalculated', {
      providerId,
      modelId,
      estimatedCost: costWithQuota.totalCostUsd,
      quotaSavings: quotaImpact.savings,
      quotaStatus
    });

    return {
      estimatedCost: costWithQuota,
      quotaStatus,
      quotaImpact,
      recommendations
    };
  }

  /**
   * Record actual usage and cost
   */
  async recordActualCost(
    providerId: string,
    modelId: string,
    actualInputTokens: number,
    actualOutputTokens: number,
    actualCostUsd: number,
    userId?: string
  ): Promise<ActualCost> {
    const key = `${providerId}:${modelId}`;
    const costModel = this.costModels.get(key);
    
    if (!costModel) {
      throw new Error(`Cost model not found for ${providerId}:${modelId}`);
    }

    if (this.options.enableUsageTracking && userId) {
      await this.updateUsageTracking(userId, actualInputTokens, actualOutputTokens, actualCostUsd);
    }

    // Calculate detailed actual cost breakdown
    const actualCost = await this.calculateActualCostBreakdown(
      costModel,
      actualInputTokens,
      actualOutputTokens,
      actualCostUsd
    );

    this.emit('actualCostRecorded', {
      providerId,
      modelId,
      userId,
      actualCost: actualCostUsd,
      actualTokens: { input: actualInputTokens, output: actualOutputTokens }
    });

    return actualCost;
  }

  /**
   * Get quota status for a user/model combination
   */
  getQuotaStatus(
    providerId: string,
    modelId: string,
    currentUsage: UsageState
  ): QuotaStatus {
    const key = `${providerId}:${modelId}`;
    const costModel = this.costModels.get(key);
    
    if (!costModel || !costModel.freeQuota) {
      return {
        remainingInputTokens: Infinity,
        remainingOutputTokens: Infinity,
        remainingRequests: Infinity,
        quotaResetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        percentageUsed: 0,
        willExceedQuota: false
      };
    }

    return this.calculateQuotaStatus(costModel, currentUsage, 0, 0);
  }

  /**
   * Compare costs across multiple models
   */
  async compareCosts(
    requests: Array<{
      providerId: string;
      modelId: string;
      inputTokens: number;
      outputTokens: number;
    }>,
    currentUsage: UsageState,
    qualityFactor = 1.0,
    latencyFactor = 1.0
  ): Promise<Array<CostPrediction & { providerId: string; modelId: string; rank: number }>> {
    const comparisons = await Promise.all(
      requests.map(async (req, index) => {
        try {
          const prediction = await this.calculatePreciseCost(
            req.providerId,
            req.modelId,
            req.inputTokens,
            req.outputTokens,
            currentUsage,
            qualityFactor,
            latencyFactor
          );
          
          return {
            ...prediction,
            providerId: req.providerId,
            modelId: req.modelId,
            rank: 0 // Will be set after sorting
          };
        } catch (error) {
          // Return expensive fallback for failed calculations
          return {
            estimatedCost: {
              inputTokensCost: 999,
              outputTokensCost: 999,
              fixedCost: 0,
              qualityPremium: 0,
              latencyPremium: 0,
              totalCostUsd: 999,
              confidence: 0
            },
            quotaStatus: {
              remainingInputTokens: 0,
              remainingOutputTokens: 0,
              remainingRequests: 0,
              quotaResetDate: new Date(),
              percentageUsed: 100,
              willExceedQuota: true
            },
            quotaImpact: {
              costWithoutQuota: 999,
              costWithQuota: 999,
              savings: 0
            },
            recommendations: {
              action: 'block_overage' as const,
              reason: `Cost calculation failed: ${error.message}`,
            },
            providerId: req.providerId,
            modelId: req.modelId,
            rank: 999
          };
        }
      })
    );

    // Sort by total cost (considering quota savings)
    comparisons.sort((a, b) => a.estimatedCost.totalCostUsd - b.estimatedCost.totalCostUsd);
    
    // Assign ranks
    comparisons.forEach((comparison, index) => {
      comparison.rank = index + 1;
    });

    return comparisons;
  }

  /**
   * Update exchange rates for multi-currency support
   */
  updateExchangeRate(currency: string, rateToUSD: number): void {
    this.exchangeRates.set(currency.toUpperCase(), rateToUSD);
    this.emit('exchangeRateUpdated', { currency, rateToUSD });
  }

  /**
   * Private methods
   */

  private async calculateRawCost(
    costModel: ProviderCostModel,
    inputTokens: number,
    outputTokens: number,
    qualityFactor: number,
    latencyFactor: number,
    currentUsage: UsageState
  ): Promise<CostEstimate> {
    let inputCost = 0;
    let outputCost = 0;
    let fixedCost = costModel.basePrice || 0;

    // Apply free quota first
    let billableInputTokens = inputTokens;
    let billableOutputTokens = outputTokens;

    if (costModel.freeQuota) {
      const freeInputRemaining = Math.max(0, costModel.freeQuota.tokensPerMonth - currentUsage.inputTokens);
      const freeOutputRemaining = Math.max(0, costModel.freeQuota.tokensPerMonth - currentUsage.outputTokens);
      
      billableInputTokens = Math.max(0, inputTokens - freeInputRemaining);
      billableOutputTokens = Math.max(0, outputTokens - freeOutputRemaining);
    }

    // Calculate costs based on pricing type
    switch (costModel.pricingType) {
      case 'linear':
        inputCost = this.calculateLinearCost(billableInputTokens, costModel.inputTokenPrice || 0);
        outputCost = this.calculateLinearCost(billableOutputTokens, costModel.outputTokenPrice || 0);
        break;

      case 'tiered':
        inputCost = this.calculateTieredCost(billableInputTokens, costModel.inputTiers || []);
        outputCost = this.calculateTieredCost(billableOutputTokens, costModel.outputTiers || []);
        break;

      case 'usage-based':
        const baseCost = this.calculateLinearCost(billableInputTokens + billableOutputTokens, costModel.inputTokenPrice || 0);
        inputCost = baseCost * 0.4; // Rough split
        outputCost = baseCost * 0.6;
        break;

      case 'subscription':
        if (costModel.subscriptionFeatures) {
          const totalTokens = billableInputTokens + billableOutputTokens;
          const overage = Math.max(0, totalTokens - costModel.subscriptionFeatures.includedTokens);
          inputCost = overage * costModel.subscriptionFeatures.overageRate * 0.4;
          outputCost = overage * costModel.subscriptionFeatures.overageRate * 0.6;
        }
        break;

      case 'composite':
        // Combination of fixed + variable
        inputCost = this.calculateLinearCost(billableInputTokens, costModel.inputTokenPrice || 0);
        outputCost = this.calculateLinearCost(billableOutputTokens, costModel.outputTokenPrice || 0);
        break;
    }

    // Apply quality and latency premiums
    const qualityPremium = (qualityFactor - 1) * (inputCost + outputCost) * (costModel.qualityMultiplier || 0);
    const latencyPremium = (latencyFactor - 1) * (inputCost + outputCost) * (costModel.latencyMultiplier || 0);

    const totalCostUsd = inputCost + outputCost + fixedCost + qualityPremium + latencyPremium;
    
    // Convert from model currency to USD if needed
    const exchangeRate = this.exchangeRates.get(costModel.currency) || 1.0;
    const convertedTotalCost = totalCostUsd / exchangeRate;

    return {
      inputTokensCost: inputCost / exchangeRate,
      outputTokensCost: outputCost / exchangeRate,
      fixedCost: fixedCost / exchangeRate,
      qualityPremium: qualityPremium / exchangeRate,
      latencyPremium: latencyPremium / exchangeRate,
      totalCostUsd: convertedTotalCost,
      confidence: this.calculateCostConfidence(costModel)
    };
  }

  private calculateLinearCost(tokens: number, pricePerMillionTokens: number): number {
    return (tokens / 1000000) * pricePerMillionTokens;
  }

  private calculateTieredCost(tokens: number, tiers: PricingTier[]): number {
    if (tiers.length === 0) return 0;

    let remainingTokens = tokens;
    let totalCost = 0;

    for (const tier of tiers.sort((a, b) => a.from - b.from)) {
      if (remainingTokens <= 0) break;

      const tierStart = tier.from;
      const tierEnd = tier.to || Infinity;
      const tierSize = tierEnd - tierStart;
      
      if (tokens >= tierStart) {
        const tokensInThisTier = Math.min(remainingTokens, tierSize);
        totalCost += this.calculateLinearCost(tokensInThisTier, tier.pricePerUnit);
        remainingTokens -= tokensInThisTier;
      }
    }

    return totalCost;
  }

  private calculateQuotaStatus(
    costModel: ProviderCostModel,
    currentUsage: UsageState,
    addInputTokens: number,
    addOutputTokens: number
  ): QuotaStatus {
    if (!costModel.freeQuota) {
      return {
        remainingInputTokens: Infinity,
        remainingOutputTokens: Infinity,
        remainingRequests: Infinity,
        quotaResetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        percentageUsed: 0,
        willExceedQuota: false
      };
    }

    const quota = costModel.freeQuota;
    const remainingInput = Math.max(0, quota.tokensPerMonth - currentUsage.inputTokens);
    const remainingOutput = Math.max(0, quota.tokensPerMonth - currentUsage.outputTokens);
    
    // Calculate next reset date
    const now = new Date();
    const resetDate = new Date(now.getFullYear(), now.getMonth(), quota.resetDay);
    if (resetDate < now) {
      resetDate.setMonth(resetDate.getMonth() + 1);
    }
    if (quota.resetHour) {
      resetDate.setHours(quota.resetHour, 0, 0, 0);
    }

    const totalUsed = currentUsage.inputTokens + currentUsage.outputTokens;
    const totalQuota = quota.tokensPerMonth * 2; // Input + output quota
    const percentageUsed = Math.min(100, (totalUsed / totalQuota) * 100);
    
    const willExceedQuota = (currentUsage.inputTokens + addInputTokens > quota.tokensPerMonth) ||
                           (currentUsage.outputTokens + addOutputTokens > quota.tokensPerMonth);

    return {
      remainingInputTokens: remainingInput,
      remainingOutputTokens: remainingOutput,
      remainingRequests: quota.requestsPerMonth ? Math.max(0, quota.requestsPerMonth - currentUsage.requests) : Infinity,
      quotaResetDate: resetDate,
      percentageUsed,
      willExceedQuota
    };
  }

  private generateCostRecommendations(
    costModel: ProviderCostModel,
    quotaStatus: QuotaStatus,
    estimatedCost: CostEstimate,
    inputTokens: number,
    outputTokens: number
  ): CostPrediction['recommendations'] {
    // High-cost threshold check
    if (estimatedCost.totalCostUsd > 1.0) {
      return {
        action: 'warn_quota',
        reason: `High estimated cost: $${estimatedCost.totalCostUsd.toFixed(4)}`,
        costComparison: estimatedCost.totalCostUsd
      };
    }

    // Quota exhaustion check
    if (quotaStatus.willExceedQuota) {
      return {
        action: 'warn_quota',
        reason: 'This request will exceed your free quota',
        costComparison: estimatedCost.totalCostUsd
      };
    }

    // Quota near exhaustion (>90%)
    if (quotaStatus.percentageUsed > 90) {
      return {
        action: 'warn_quota',
        reason: `Free quota ${quotaStatus.percentageUsed.toFixed(1)}% used`,
        costComparison: estimatedCost.totalCostUsd
      };
    }

    // Low confidence in cost estimate
    if (estimatedCost.confidence < 0.7) {
      return {
        action: 'proceed',
        reason: `Cost estimate has low confidence (${(estimatedCost.confidence * 100).toFixed(1)}%)`,
        costComparison: estimatedCost.totalCostUsd
      };
    }

    return {
      action: 'proceed',
      reason: 'Cost estimate is within acceptable limits',
      costComparison: estimatedCost.totalCostUsd
    };
  }

  private calculateCostConfidence(costModel: ProviderCostModel): number {
    let confidence = 1.0;

    // Reduce confidence for older models
    const age = Date.now() - costModel.lastUpdated.getTime();
    const daysSinceUpdate = age / (24 * 60 * 60 * 1000);
    if (daysSinceUpdate > 30) {
      confidence *= 0.8; // 20% reduction for old models
    }

    // Reduce confidence for complex pricing models
    if (costModel.pricingType === 'composite' || costModel.pricingType === 'usage-based') {
      confidence *= 0.9;
    }

    // Reduce confidence if using non-USD currency without recent exchange rate
    if (costModel.currency !== 'USD' && !this.exchangeRates.has(costModel.currency)) {
      confidence *= 0.7;
    }

    return Math.max(0.1, confidence); // Minimum 10% confidence
  }

  private async calculateActualCostBreakdown(
    costModel: ProviderCostModel,
    actualInputTokens: number,
    actualOutputTokens: number,
    actualCostUsd: number
  ): Promise<ActualCost> {
    // This would typically reconcile the actual cost against the estimated cost
    // For now, we'll create a basic breakdown
    
    const inputRatio = actualInputTokens / (actualInputTokens + actualOutputTokens) || 0.4;
    const outputRatio = 1 - inputRatio;

    return {
      inputTokensCost: actualCostUsd * inputRatio,
      outputTokensCost: actualCostUsd * outputRatio,
      fixedCost: 0,
      qualityPremium: 0,
      latencyPremium: 0,
      totalCostUsd: actualCostUsd,
      confidence: 1.0, // Actual cost has full confidence
      freeQuotaApplied: {
        inputTokens: 0, // Would be calculated based on quota usage
        outputTokens: 0,
        totalSavedUsd: 0
      },
      tierBreakdown: [] // Would be populated for tiered pricing
    };
  }

  private async updateUsageTracking(
    userId: string,
    inputTokens: number,
    outputTokens: number,
    cost: number
  ): Promise<void> {
    const existing = this.usageCache.get(userId) || {
      inputTokens: 0,
      outputTokens: 0,
      requests: 0,
      monthStart: new Date(),
      totalSpent: 0
    };

    existing.inputTokens += inputTokens;
    existing.outputTokens += outputTokens;
    existing.requests += 1;
    existing.totalSpent += cost;

    this.usageCache.set(userId, existing);
  }

  private cleanupCache(): void {
    // Remove old usage entries (older than 2 months)
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

    for (const [userId, usage] of this.usageCache.entries()) {
      if (usage.monthStart < twoMonthsAgo) {
        this.usageCache.delete(userId);
      }
    }

    this.emit('cacheCleanup', { 
      remainingEntries: this.usageCache.size,
      timestamp: new Date()
    });
  }

  /**
   * Cleanup method
   */
  cleanup(): void {
    this.costModels.clear();
    this.usageCache.clear();
    this.emit('cleanup');
  }
}