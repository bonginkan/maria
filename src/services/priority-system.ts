/**
 * MARIA CODE Priority System
 * Intelligent provider prioritization based on user preferences and task requirements
 */

import { IAIProvider } from '../providers/ai-provider.js';

export type PriorityMode =
  | 'privacy-first'
  | 'performance'
  | 'cost-effective'
  | 'quality'
  | 'balanced';

export interface PriorityConfig {
  mode: PriorityMode;
  preferences: {
    localPreference: number; // 0-100, higher means prefer local
    costSensitivity: number; // 0-100, higher means more cost-sensitive
    speedRequirement: number; // 0-100, higher means speed is critical
    qualityRequirement: number; // 0-100, higher means quality is critical
    privacyRequirement: number; // 0-100, higher means privacy is critical
  };
  customOrder?: string[]; // Custom provider order
  blacklist?: string[]; // Providers to never use
  whitelist?: string[]; // Only use these providers
}

export interface ProviderScore {
  provider: string;
  score: number;
  breakdown: {
    base: number;
    privacy: number;
    performance: number;
    cost: number;
    quality: number;
    availability: number;
    contextWindow: number;
  };
  reasoning: string[];
}

export interface TaskContext {
  type: 'chat' | 'code' | 'vision' | 'creative' | 'analysis' | 'translation';
  estimatedTokens: number;
  hasImage?: boolean;
  language?: string;
  complexity: 'low' | 'medium' | 'high';
  urgency: 'low' | 'medium' | 'high';
  confidentialityLevel: 'public' | 'internal' | 'confidential' | 'highly-confidential';
}

export class PrioritySystem {
  private config: PriorityConfig;
  private providerMetrics: Map<string, ProviderMetrics> = new Map();

  constructor(config?: Partial<PriorityConfig>) {
    this.config = this.buildDefaultConfig(config);
  }

  private buildDefaultConfig(override?: Partial<PriorityConfig>): PriorityConfig {
    const mode = override?.mode || 'balanced';

    const defaultPreferences = this.getDefaultPreferences(mode);
    const preferences = override?.preferences
      ? { ...defaultPreferences, ...override.preferences }
      : defaultPreferences;

    return {
      mode,
      preferences,
      customOrder: override?.customOrder,
      blacklist: override?.blacklist || [],
      whitelist: override?.whitelist,
    };
  }

  private getDefaultPreferences(mode: PriorityMode): PriorityConfig['preferences'] {
    switch (mode) {
      case 'privacy-first':
        return {
          localPreference: 90,
          costSensitivity: 30,
          speedRequirement: 50,
          qualityRequirement: 70,
          privacyRequirement: 95,
        };

      case 'performance':
        return {
          localPreference: 70,
          costSensitivity: 20,
          speedRequirement: 95,
          qualityRequirement: 80,
          privacyRequirement: 60,
        };

      case 'cost-effective':
        return {
          localPreference: 80,
          costSensitivity: 95,
          speedRequirement: 60,
          qualityRequirement: 60,
          privacyRequirement: 70,
        };

      case 'quality':
        return {
          localPreference: 40,
          costSensitivity: 30,
          speedRequirement: 50,
          qualityRequirement: 95,
          privacyRequirement: 60,
        };

      case 'balanced':
      default:
        return {
          localPreference: 60,
          costSensitivity: 50,
          speedRequirement: 60,
          qualityRequirement: 70,
          privacyRequirement: 70,
        };
    }
  }

  /**
   * Calculate priority scores for all providers
   */
  calculateProviderScores(providers: Map<string, IAIProvider>, task: TaskContext): ProviderScore[] {
    const scores: ProviderScore[] = [];

    for (const [name, provider] of providers) {
      // Skip blacklisted providers
      if (this.config.blacklist?.includes(name)) {
        continue;
      }

      // If whitelist exists, only include whitelisted providers
      if (this.config.whitelist && !this.config.whitelist.includes(name)) {
        continue;
      }

      const score = this.scoreProvider(name, provider, task);
      scores.push(score);
    }

    // Sort by score (highest first)
    scores.sort((a, b) => b.score - a.score);

    return scores;
  }

  private scoreProvider(name: string, provider: IAIProvider, task: TaskContext): ProviderScore {
    const breakdown = {
      base: 50, // Base score
      privacy: 0,
      performance: 0,
      cost: 0,
      quality: 0,
      availability: 0,
      contextWindow: 0,
    };

    const reasoning: string[] = [];

    // Get provider info
    const isLocal = this.isLocalProvider(name);
    const metrics = this.providerMetrics.get(name);

    // Privacy scoring
    if (isLocal) {
      const privacyBonus = (this.config.preferences['privacyRequirement'] / 100) * 30;
      breakdown['privacy'] = privacyBonus;
      if (privacyBonus > 10) {reasoning.push('Local provider (privacy)');}
    } else {
      // Cloud providers get penalty for high privacy requirements
      if (this.config.preferences['privacyRequirement'] > 80) {
        breakdown['privacy'] = -15;
        reasoning.push('Cloud provider (privacy concern)');
      }
    }

    // Confidentiality level adjustment
    if (task.confidentialityLevel === 'highly-confidential' && !isLocal) {
      breakdown['privacy'] -= 25;
      reasoning.push('High confidentiality requires local');
    }

    // Performance scoring
    if (metrics) {
      // Speed scoring
      if (metrics.averageLatency < 1000) {
        breakdown.performance += 10;
        reasoning.push('Fast response time');
      } else if (metrics.averageLatency > 5000) {
        breakdown.performance -= 10;
        reasoning.push('Slow response time');
      }

      // Reliability scoring
      if (metrics.successRate > 0.95) {
        breakdown.availability += 15;
        reasoning.push('High reliability');
      } else if (metrics.successRate < 0.8) {
        breakdown.availability -= 15;
        reasoning.push('Reliability concerns');
      }
    }

    // Task-specific scoring
    breakdown.quality += this.getTaskSpecificScore(name, task);

    // Context window scoring
    const contextScore = this.getContextWindowScore(provider, task);
    breakdown.contextWindow = contextScore;

    // Cost scoring
    const costScore = this.getCostScore(name, isLocal, task);
    breakdown.cost = costScore;

    // Apply weights based on preferences
    let weightedScore = this.applyWeights(breakdown, task);

    // Custom order override
    if (this.config.customOrder) {
      const orderIndex = this.config.customOrder.indexOf(name);
      if (orderIndex !== -1) {
        // Higher priority for earlier positions
        const orderBonus = (this.config.customOrder.length - orderIndex) * 5;
        weightedScore += orderBonus;
        reasoning.push(`Custom order priority: ${orderIndex + 1}`);
      }
    }

    return {
      provider: name,
      score: Math.max(0, Math.min(100, weightedScore)),
      breakdown,
      reasoning,
    };
  }

  private applyWeights(breakdown: ProviderScore['breakdown'], task: TaskContext): number {
    let score = breakdown.base;

    // Apply weights based on preferences and task
    const weights = this.calculateWeights(task);

    score += (breakdown['privacy'] || 0) * (weights['privacy'] || 0);
    score += (breakdown['performance'] || 0) * (weights['performance'] || 0);
    score += (breakdown['cost'] || 0) * (weights['cost'] || 0);
    score += (breakdown['quality'] || 0) * (weights['quality'] || 0);
    score += (breakdown['availability'] || 0) * (weights['availability'] || 0);
    score += (breakdown['contextWindow'] || 0) * (weights['contextWindow'] || 0);

    return score;
  }

  private calculateWeights(task: TaskContext): Record<string, number> {
    const base = {
      privacy: this.config.preferences['privacyRequirement'] / 100,
      performance: this.config.preferences.speedRequirement / 100,
      cost: this.config.preferences.costSensitivity / 100,
      quality: this.config.preferences.qualityRequirement / 100,
      availability: 0.8, // Always important
      contextWindow: 0.6, // Important for most tasks
    };

    // Task-specific adjustments
    switch (task.type) {
      case 'vision':
        base.quality *= 1.2; // Vision needs quality
        base.performance *= 0.8; // Speed less critical
        break;

      case 'code':
        base.quality *= 1.1; // Code needs accuracy
        base.contextWindow *= 1.3; // Large context important
        break;

      case 'chat':
        base.performance *= 1.2; // Speed important for chat
        break;

      case 'creative':
        base.quality *= 1.3; // Creativity needs good models
        break;
    }

    // Urgency adjustments
    if (task.urgency === 'high') {
      base.performance *= 1.5;
      base.cost *= 0.7; // Less cost-sensitive when urgent
    }

    // Complexity adjustments
    if (task.complexity === 'high') {
      base.quality *= 1.3;
      base.contextWindow *= 1.2;
    }

    return base;
  }

  private getTaskSpecificScore(providerName: string, task: TaskContext): number {
    let score = 0;

    // Provider-specific task optimizations
    switch (task.type) {
      case 'code':
        if (['openai', 'anthropic'].includes(providerName)) {
          score += 10; // Good at code
        }
        if (providerName === 'lmstudio' && task.complexity === 'high') {
          score += 15; // LM Studio good for complex code with large context
        }
        break;

      case 'vision':
        if (['openai', 'googleai'].includes(providerName)) {
          score += 15; // Excellent vision capabilities
        }
        if (providerName === 'ollama') {
          score += 10; // Good local vision option
        }
        break;

      case 'translation':
        if (providerName === 'lmstudio') {
          score += 10; // Often has multilingual models
        }
        if (providerName === 'googleai') {
          score += 8; // Good at translation
        }
        break;

      case 'creative':
        if (['anthropic', 'openai'].includes(providerName)) {
          score += 12; // Good at creative tasks
        }
        break;
    }

    // Language-specific optimizations
    if (task.language === 'ja' || task.language === 'japanese') {
      if (providerName === 'lmstudio') {
        score += 15; // Often has Japanese models
      }
    }

    return score;
  }

  private getContextWindowScore(provider: IAIProvider, task: TaskContext): number {
    const models = provider.getModels();

    // Estimate required context (simplified)
    const requiredContext = Math.max(task.estimatedTokens * 1.5, 4000);

    // This would need model-specific context window data
    // For now, use heuristics based on provider
    let contextWindow = 4000; // Default

    if (models.some((m) => m.includes('gpt-4') || m.includes('claude'))) {
      contextWindow = 128000; // Large context models
    } else if (models.some((m) => m.includes('32k') || m.includes('16k'))) {
      contextWindow = 32000;
    }

    if (contextWindow < requiredContext) {
      return -20; // Penalty for insufficient context
    } else if (contextWindow > requiredContext * 2) {
      return 10; // Bonus for ample context
    }

    return 0;
  }

  private getCostScore(providerName: string, isLocal: boolean, task: TaskContext): number {
    const costSensitivity = this.config.preferences.costSensitivity / 100;

    if (isLocal) {
      // Local is essentially free
      return costSensitivity * 25;
    }

    // Rough cost estimates (would be provider-specific in reality)
    const costPerK = this.getCostPerThousandTokens(providerName);
    const estimatedCost = (task.estimatedTokens / 1000) * costPerK;

    if (estimatedCost < 0.01) {
      return costSensitivity * 15;
    } else if (estimatedCost > 0.05) {
      return costSensitivity * -15;
    }

    return 0;
  }

  private getCostPerThousandTokens(providerName: string): number {
    // Simplified cost estimates (would be updated regularly)
    const costs: Record<string, number> = {
      openai: 0.02,
      anthropic: 0.025,
      googleai: 0.01,
      grok: 0.015,
    };

    return costs[providerName] || 0.02;
  }

  private isLocalProvider(providerName: string): boolean {
    return ['lmstudio', 'ollama', 'vllm'].includes(providerName);
  }

  /**
   * Update performance metrics for a provider
   */
  updateMetrics(providerName: string, metrics: Partial<ProviderMetrics>) {
    const existing = this.providerMetrics.get(providerName) || {
      averageLatency: 0,
      successRate: 0,
      totalRequests: 0,
      lastUsed: new Date(),
    };

    const updated = { ...existing, ...metrics };
    this.providerMetrics.set(providerName, updated);
  }

  /**
   * Get recommended provider for task
   */
  getRecommendedProvider(providers: Map<string, IAIProvider>, task: TaskContext): string | null {
    const scores = this.calculateProviderScores(providers, task);

    if (scores.length === 0) {
      return null;
    }

    return scores[0]?.provider || null;
  }

  /**
   * Get provider priority order for task
   */
  getProviderPriorityOrder(providers: Map<string, IAIProvider>, task: TaskContext): string[] {
    const scores = this.calculateProviderScores(providers, task);
    return scores.map((s) => s.provider);
  }

  /**
   * Update priority configuration
   */
  updateConfig(config: Partial<PriorityConfig>) {
    this.config = { ...this.config, ...config };

    // Recalculate preferences if mode changed
    if (config.mode && config.mode !== this.config.mode) {
      this.config['preferences'] = this.getDefaultPreferences(config.mode);
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): PriorityConfig {
    return { ...this.config };
  }

  /**
   * Export priority system data for persistence
   */
  exportData(): PrioritySystemData {
    return {
      config: this.config,
      metrics: Object.fromEntries(this.providerMetrics.entries()),
    };
  }

  /**
   * Import priority system data from persistence
   */
  importData(data: PrioritySystemData) {
    this.config = data.config;
    this.providerMetrics = new Map(Object.entries(data.metrics));
  }
}

interface ProviderMetrics {
  averageLatency: number;
  successRate: number;
  totalRequests: number;
  lastUsed: Date;
}

interface PrioritySystemData {
  config: PriorityConfig;
  metrics: Record<string, ProviderMetrics>;
}

// Predefined priority configurations
export const PRIORITY_PRESETS: Record<string, PriorityConfig> = {
  'privacy-first': {
    mode: 'privacy-first',
    preferences: {
      localPreference: 90,
      costSensitivity: 30,
      speedRequirement: 50,
      qualityRequirement: 70,
      privacyRequirement: 95,
    },
    customOrder: ['lmstudio', 'ollama', 'vllm'],
  },

  performance: {
    mode: 'performance',
    preferences: {
      localPreference: 70,
      costSensitivity: 20,
      speedRequirement: 95,
      qualityRequirement: 80,
      privacyRequirement: 60,
    },
    customOrder: ['grok', 'openai', 'lmstudio', 'anthropic'],
  },

  'cost-effective': {
    mode: 'cost-effective',
    preferences: {
      localPreference: 80,
      costSensitivity: 95,
      speedRequirement: 60,
      qualityRequirement: 60,
      privacyRequirement: 70,
    },
    customOrder: ['lmstudio', 'ollama', 'vllm', 'googleai'],
  },

  quality: {
    mode: 'quality',
    preferences: {
      localPreference: 40,
      costSensitivity: 30,
      speedRequirement: 50,
      qualityRequirement: 95,
      privacyRequirement: 60,
    },
    customOrder: ['anthropic', 'openai', 'lmstudio', 'googleai'],
  },
};
