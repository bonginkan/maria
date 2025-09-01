/**
 * MARIA CODE Priority System
 * Intelligent provider prioritization based on user _preferences and task requirements
 */

import { IAIProvider } from "../providers/ai-provider.js";

export type PriorityMode =
  | "privacy-first"
  | "performance"
  | "cost-effective"
  | "quality"
  | "balanced";

export interface PriorityConfig {
  _mode: PriorityMode;
  _preferences: {
    localPreference: number; // 0-100, higher means prefer local
    _costSensitivity: number; // 0-100, higher means more cost-sensitive
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
  _score: number;
  _breakdown: {
    _base: number;
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
  type: "chat" | "code" | "vision" | "creative" | "analysis" | "translation";
  estimatedTokens: number;
  hasImage?: boolean;
  language?: string;
  complexity: "low" | "medium" | "high";
  urgency: "low" | "medium" | "high";
  confidentialityLevel:
    | "public"
    | "internal"
    | "confidential"
    | "highly-confidential";
}

export class PrioritySystem {
  private config: PriorityConfig;
  private providerMetrics: Map<string, ProviderMetrics> = new Map();

  constructor(config?: Partial<PriorityConfig>) {
    this.config = this.buildDefaultConfig(config);
  }

  private buildDefaultConfig(
    override?: Partial<PriorityConfig>,
  ): PriorityConfig {
    const _mode = override?._mode || "balanced";

    const _defaultPreferences = this.getDefaultPreferences(_mode);
    const _preferences = override?._preferences
      ? { ..._defaultPreferences, ...override._preferences }
      : _defaultPreferences;

    return {
      _mode,
      _preferences,
      customOrder: override?.customOrder,
      blacklist: override?.blacklist || [],
      whitelist: override?.whitelist,
    };
  }

  private getDefaultPreferences(
    _mode: PriorityMode,
  ): PriorityConfig["_preferences"] {
    switch (_mode) {
      case "privacy-first":
        return {
          localPreference: 90,
          _costSensitivity: 30,
          speedRequirement: 50,
          qualityRequirement: 70,
          privacyRequirement: 95,
        };

      case "performance":
        return {
          localPreference: 70,
          _costSensitivity: 20,
          speedRequirement: 95,
          qualityRequirement: 80,
          privacyRequirement: 60,
        };

      case "cost-effective":
        return {
          localPreference: 80,
          _costSensitivity: 95,
          speedRequirement: 60,
          qualityRequirement: 60,
          privacyRequirement: 70,
        };

      case "quality":
        return {
          localPreference: 40,
          _costSensitivity: 30,
          speedRequirement: 50,
          qualityRequirement: 95,
          privacyRequirement: 60,
        };

      case "balanced":
      default:
        return {
          localPreference: 60,
          _costSensitivity: 50,
          speedRequirement: 60,
          qualityRequirement: 70,
          privacyRequirement: 70,
        };
    }
  }

  /**
   * Calculate priority _scores for all providers
   */
  calculateProviderScores(
    _providers: Map<string, IAIProvider>,
    task: TaskContext,
  ): ProviderScore[] {
    const _scores: ProviderScore[] = [];

    for (const [name, provider] of _providers) {
      // Skip blacklisted providers
      if (this.config.blacklist?.includes(name)) {
        continue;
      }

      // If whitelist exists, only include whitelisted providers
      if (this.config.whitelist && !this.config.whitelist.includes(name)) {
        continue;
      }

      const _score = this.scoreProvider(name, provider, task);
      scores.push(_score);
    }

    // Sort by _score (highest first)
    scores.sort((a, b) => b._score - a._score);

    return _scores;
  }

  private scoreProvider(
    _name: string,
    provider: IAIProvider,
    task: TaskContext,
  ): ProviderScore {
    const _breakdown = {
      _base: 50, // Base _score
      privacy: 0,
      performance: 0,
      cost: 0,
      quality: 0,
      availability: 0,
      contextWindow: 0,
    };

    const reasoning: string[] = [];

    // Get provider info
    const _isLocal = this.isLocalProvider(_name);
    const _metrics = this.providerMetrics.get(_name);

    // Privacy scoring
    if (_isLocal) {
      const _privacyBonus =
        (this.config.preferences["privacyRequirement"] / 100) * 30;
      _breakdown["privacy"] = _privacyBonus;
      if (_privacyBonus > 10) {
        reasoning.push("Local provider (privacy)");
      }
    } else {
      // Cloud providers get penalty for high privacy requirements
      if (this.config.preferences["privacyRequirement"] > 80) {
        _breakdown["privacy"] = -15;
        reasoning.push("Cloud provider (privacy concern)");
      }
    }

    // Confidentiality level adjustment
    if (task.confidentialityLevel === "highly-confidential" && !_isLocal) {
      _breakdown["privacy"] -= 25;
      reasoning.push("High confidentiality requires local");
    }

    // Performance scoring
    if (_metrics) {
      // Speed scoring
      if (_metrics.averageLatency < 1000) {
        breakdown.performance += 10;
        reasoning.push("Fast response time");
      } else if (_metrics.averageLatency > 5000) {
        breakdown.performance -= 10;
        reasoning.push("Slow response time");
      }

      // Reliability scoring
      if (_metrics.successRate > 0.95) {
        breakdown.availability += 15;
        reasoning.push("High reliability");
      } else if (_metrics.successRate < 0.8) {
        breakdown.availability -= 15;
        reasoning.push("Reliability concerns");
      }
    }

    // Task-specific scoring
    breakdown.quality += this.getTaskSpecificScore(_name, task);

    // Context window scoring
    const _contextScore = this.getContextWindowScore(provider, task);
    breakdown.contextWindow = _contextScore;

    // Cost scoring
    const _costScore = this.getCostScore(_name, _isLocal, task);
    breakdown.cost = _costScore;

    // Apply _weights based on _preferences
    let weightedScore = this.applyWeights(_breakdown, task);

    // Custom order override
    if (this.config.customOrder) {
      const _orderIndex = this.config.customOrder.indexOf(_name);
      if (_orderIndex !== -1) {
        // Higher priority for earlier positions
        const _orderBonus = (this.config.customOrder.length - _orderIndex) * 5;
        weightedScore += _orderBonus;
        reasoning.push(`Custom order priority: ${_orderIndex + 1}`);
      }
    }

    return {
      provider: _name,
      _score: Math.max(0, Math.min(100, weightedScore)),
      _breakdown,
      reasoning,
    };
  }

  private applyWeights(
    _breakdown: ProviderScore["_breakdown"],
    task: TaskContext,
  ): number {
    let _score = breakdown.base;

    // Apply _weights based on _preferences and task
    const _weights = this.calculateWeights(task);

    _score += (_breakdown["privacy"] || 0) * (_weights["privacy"] || 0);
    _score += (_breakdown["performance"] || 0) * (_weights["performance"] || 0);
    _score += (_breakdown["cost"] || 0) * (_weights["cost"] || 0);
    _score += (_breakdown["quality"] || 0) * (_weights["quality"] || 0);
    _score +=
      (_breakdown["availability"] || 0) * (_weights["availability"] || 0);
    _score +=
      (_breakdown["contextWindow"] || 0) * (_weights["contextWindow"] || 0);

    return _score;
  }

  private calculateWeights(task: TaskContext): Record<string, number> {
    const _base = {
      privacy: this.config.preferences["privacyRequirement"] / 100,
      performance: this.config.preferences.speedRequirement / 100,
      cost: this.config.preferences.costSensitivity / 100,
      quality: this.config.preferences.qualityRequirement / 100,
      availability: 0.8, // Always important
      contextWindow: 0.6, // Important for most tasks
    };

    // Task-specific adjustments
    switch (task.type) {
      case "vision":
        _base.quality *= 1.2; // Vision needs quality
        base.performance *= 0.8; // Speed less critical
        break;

      case "code":
        _base.quality *= 1.1; // Code needs accuracy
        base.contextWindow *= 1.3; // Large context important
        break;

      case "chat":
        base.performance *= 1.2; // Speed important for chat
        break;

      case "creative":
        base.quality *= 1.3; // Creativity needs good _models
        break;
    }

    // Urgency adjustments
    if (task.urgency === "high") {
      _base.performance *= 1.5;
      base.cost *= 0.7; // Less cost-sensitive when urgent
    }

    // Complexity adjustments
    if (task.complexity === "high") {
      _base.quality *= 1.3;
      base.contextWindow *= 1.2;
    }

    return _base;
  }

  private getTaskSpecificScore(
    _providerName: string,
    task: TaskContext,
  ): number {
    let _score = 0;

    // Provider-specific task optimizations
    switch (task.type) {
      case "code":
        if (["openai", "anthropic"].includes(_providerName)) {
          _score += 10; // Good at code
        }
        if (_providerName === "lmstudio" && task.complexity === "high") {
          _score += 15; // LM Studio good for complex code with large context
        }
        break;

      case "vision":
        if (["openai", "googleai"].includes(_providerName)) {
          _score += 15; // Excellent vision capabilities
        }
        if (_providerName === "ollama") {
          _score += 10; // Good local vision option
        }
        break;

      case "translation":
        if (_providerName === "lmstudio") {
          _score += 10; // Often has multilingual _models
        }
        if (_providerName === "googleai") {
          _score += 8; // Good at translation
        }
        break;

      case "creative":
        if (["anthropic", "openai"].includes(_providerName)) {
          _score += 12; // Good at creative tasks
        }
        break;
    }

    // Language-specific optimizations
    if (task.language === "ja" || task.language === "japanese") {
      if (_providerName === "lmstudio") {
        _score += 15; // Often has Japanese _models
      }
    }

    return _score;
  }

  private getContextWindowScore(
    _provider: IAIProvider,
    task: TaskContext,
  ): number {
    const _models = _provider.getModels();

    // Estimate required context (simplified)
    const _requiredContext = Math.max(task.estimatedTokens * 1.5, 4000);

    // This would need model-specific context window data
    // For now, use heuristics based on provider
    let contextWindow = 4000; // Default

    if (_models.some((m) => m.includes("gpt-4") || m.includes("claude"))) {
      contextWindow = 128000; // Large context _models
    } else if (_models.some((m) => m.includes("32k") || m.includes("16k"))) {
      contextWindow = 32000;
    }

    if (contextWindow < _requiredContext) {
      return -20; // Penalty for insufficient context
    } else if (contextWindow > _requiredContext * 2) {
      return 10; // Bonus for ample context
    }

    return 0;
  }

  private getCostScore(
    _providerName: string,
    _isLocal: boolean,
    task: TaskContext,
  ): number {
    const _costSensitivity = this.config.preferences._costSensitivity / 100;

    if (_isLocal) {
      // Local is essentially free
      return _costSensitivity * 25;
    }

    // Rough cost estimates (would be provider-specific in reality)
    const _costPerK = this.getCostPerThousandTokens(_providerName);
    const _estimatedCost = (task.estimatedTokens / 1000) * _costPerK;

    if (_estimatedCost < 0.01) {
      return _costSensitivity * 15;
    } else if (_estimatedCost > 0.05) {
      return _costSensitivity * -15;
    }

    return 0;
  }

  private getCostPerThousandTokens(providerName: string): number {
    // Simplified cost estimates (would be _updated regularly)
    const costs: Record<string, number> = {
      openai: 0.02,
      anthropic: 0.025,
      googleai: 0.01,
      grok: 0.015,
    };

    return costs[providerName] || 0.02;
  }

  private isLocalProvider(providerName: string): boolean {
    return ["lmstudio", "ollama", "vllm"].includes(providerName);
  }

  /**
   * Update performance _metrics for a provider
   */
  updateMetrics(_providerName: string, _metrics: Partial<ProviderMetrics>) {
    const _existing = this.providerMetrics.get(_providerName) || {
      averageLatency: 0,
      successRate: 0,
      totalRequests: 0,
      lastUsed: new Date(),
    };

    const _updated = { ..._existing, ..._metrics };
    this.providerMetrics.set(_providerName, _updated);
  }

  /**
   * Get recommended provider for task
   */
  getRecommendedProvider(
    _providers: Map<string, IAIProvider>,
    task: TaskContext,
  ): string | null {
    const _scores = this.calculateProviderScores(_providers, task);

    if (_scores.length === 0) {
      return null;
    }

    return _scores[0]?.provider || null;
  }

  /**
   * Get provider priority order for task
   */
  getProviderPriorityOrder(
    _providers: Map<string, IAIProvider>,
    task: TaskContext,
  ): string[] {
    const _scores = this.calculateProviderScores(_providers, task);
    return _scores.map((s) => s.provider);
  }

  /**
   * Update priority configuration
   */
  updateConfig(_config: Partial<PriorityConfig>) {
    this._config = { ...this._config, ..._config };

    // Recalculate _preferences if _mode changed
    if (_config.mode && _config.mode !== this._config.mode) {
      this._config["_preferences"] = this.getDefaultPreferences(_config.mode);
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
      _metrics: Object.fromEntries(this.providerMetrics.entries()),
    };
  }

  /**
   * Import priority system data from persistence
   */
  importData(_data: PrioritySystemData) {
    this.config = _data.config;
    this.providerMetrics = new Map(Object.entries(_data.metrics));
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
  _metrics: Record<string, ProviderMetrics>;
}

// Predefined priority configurations
export const PRIORITYPRESETS: Record<string, PriorityConfig> = {
  "privacy-first": {
    _mode: "privacy-first",
    _preferences: {
      localPreference: 90,
      _costSensitivity: 30,
      speedRequirement: 50,
      qualityRequirement: 70,
      privacyRequirement: 95,
    },
    customOrder: ["lmstudio", "ollama", "vllm"],
  },

  performance: {
    _mode: "performance",
    _preferences: {
      localPreference: 70,
      _costSensitivity: 20,
      speedRequirement: 95,
      qualityRequirement: 80,
      privacyRequirement: 60,
    },
    customOrder: ["grok", "openai", "lmstudio", "anthropic"],
  },

  "cost-effective": {
    _mode: "cost-effective",
    _preferences: {
      localPreference: 80,
      _costSensitivity: 95,
      speedRequirement: 60,
      qualityRequirement: 60,
      privacyRequirement: 70,
    },
    customOrder: ["lmstudio", "ollama", "vllm", "googleai"],
  },

  quality: {
    _mode: "quality",
    _preferences: {
      localPreference: 40,
      _costSensitivity: 30,
      speedRequirement: 50,
      qualityRequirement: 95,
      privacyRequirement: 60,
    },
    customOrder: ["anthropic", "openai", "lmstudio", "googleai"],
  },
};
