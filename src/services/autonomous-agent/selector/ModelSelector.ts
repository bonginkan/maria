/**
 * ModelSelector - Server-side AI model selection
 * Chooses optimal model based on task requirements
 */

import { TaskType } from '../ai/contracts';

/**
 * Input for model selection
 */
export interface SelectorInput {
  task: TaskType;                      // Type of task to perform
  contextTokens: number;                // Estimated context size in tokens
  latencyBudget: number;                // Maximum allowed latency in ms
  allowVision: boolean;                 // Whether vision capability is needed
}

/**
 * Output from model selection
 */
export interface SelectorOutput {
  routedModel: {
    vendor: "google" | "openai" | "anthropic";
    family: string;
    name: string;
    reason: string;                    // Why this model was chosen
  };
  maxTokens: number;                   // Token limit for this model
  temperature: number;                 // Temperature setting
  topP?: number;                       // Top-p sampling parameter
}

/**
 * Model capabilities and constraints
 */
interface ModelProfile {
  vendor: "google" | "openai" | "anthropic";
  family: string;
  name: string;
  capabilities: {
    vision: boolean;
    codeGeneration: boolean;
    reasoning: boolean;
    streaming: boolean;
  };
  limits: {
    contextWindow: number;
    maxOutput: number;
    rateLimit: number;                // Requests per minute
  };
  performance: {
    latencyMs: number;                // Average latency
    reliability: number;               // Success rate (0-1)
  };
  cost: {
    inputPer1k: number;               // Cost per 1k input tokens
    outputPer1k: number;              // Cost per 1k output tokens
  };
}

export class ModelSelector {
  private models: Map<string, ModelProfile> = new Map();
  
  constructor() {
    this.initializeModels();
  }
  
  /**
   * Choose optimal model for the task
   */
  choose(input: SelectorInput): SelectorOutput {
    // Vision tasks require specific models
    if (input.allowVision) {
      return this.selectVisionModel(input);
    }
    
    // Long context tasks need models with large windows
    if (input.contextTokens > 8000) {
      return this.selectLongContextModel(input);
    }
    
    // Fast tasks with low latency requirements
    if (input.latencyBudget < 1000) {
      return this.selectFastModel(input);
    }
    
    // Code-specific tasks
    if (input.task === "scaffold" || input.task === "refactor") {
      return this.selectCodeModel(input);
    }
    
    // Default balanced model
    return this.selectDefaultModel(input);
  }
  
  /**
   * Select model with vision capabilities
   */
  private selectVisionModel(input: SelectorInput): SelectorOutput {
    return {
      routedModel: {
        vendor: "google",
        family: "gemini",
        name: "gemini-2.0-flash-exp",
        reason: "vision_capability_with_code_understanding"
      },
      maxTokens: 8192,
      temperature: 0,
      topP: 0.95
    };
  }
  
  /**
   * Select model for long context
   */
  private selectLongContextModel(input: SelectorInput): SelectorOutput {
    // Prefer Gemini 1.5 Pro for very long contexts
    if (input.contextTokens > 32000) {
      return {
        routedModel: {
          vendor: "google",
          family: "gemini",
          name: "gemini-1.5-pro",
          reason: "long_context_window_128k"
        },
        maxTokens: 32768,
        temperature: 0.1,
        topP: 0.95
      };
    }
    
    // Use Flash for medium-long contexts
    return {
      routedModel: {
        vendor: "google",
        family: "gemini",
        name: "gemini-2.0-flash-exp",
        reason: "balanced_long_context"
      },
      maxTokens: 16384,
      temperature: 0.1,
      topP: 0.95
    };
  }
  
  /**
   * Select fast model for low latency
   */
  private selectFastModel(input: SelectorInput): SelectorOutput {
    return {
      routedModel: {
        vendor: "google",
        family: "gemini",
        name: "gemini-2.0-flash-exp",
        reason: "low_latency_fast_response"
      },
      maxTokens: 4096,
      temperature: 0,
      topP: 0.9
    };
  }
  
  /**
   * Select model optimized for code generation
   */
  private selectCodeModel(input: SelectorInput): SelectorOutput {
    // For complex code generation, use stronger model
    if (input.task === "scaffold") {
      return {
        routedModel: {
          vendor: "google",
          family: "gemini",
          name: "gemini-1.5-pro",
          reason: "complex_code_generation"
        },
        maxTokens: 8192,
        temperature: 0.2,
        topP: 0.95
      };
    }
    
    // For refactoring, use balanced model
    return {
      routedModel: {
        vendor: "google",
        family: "gemini",
        name: "gemini-2.0-flash-exp",
        reason: "code_refactoring_optimization"
      },
      maxTokens: 8192,
      temperature: 0.1,
      topP: 0.95
    };
  }
  
  /**
   * Select default balanced model
   */
  private selectDefaultModel(input: SelectorInput): SelectorOutput {
    return {
      routedModel: {
        vendor: "google",
        family: "gemini",
        name: "gemini-2.0-flash-exp",
        reason: "balanced_default_selection"
      },
      maxTokens: 8192,
      temperature: 0.1,
      topP: 0.95
    };
  }
  
  /**
   * Initialize available models
   */
  private initializeModels(): void {
    // Gemini 2.0 Flash (Experimental)
    this.models.set("gemini-2.0-flash-exp", {
      vendor: "google",
      family: "gemini",
      name: "gemini-2.0-flash-exp",
      capabilities: {
        vision: true,
        codeGeneration: true,
        reasoning: true,
        streaming: true
      },
      limits: {
        contextWindow: 1048576,  // 1M tokens
        maxOutput: 8192,
        rateLimit: 60
      },
      performance: {
        latencyMs: 800,
        reliability: 0.98
      },
      cost: {
        inputPer1k: 0.0,  // Free during experimental
        outputPer1k: 0.0
      }
    });
    
    // Gemini 1.5 Pro
    this.models.set("gemini-1.5-pro", {
      vendor: "google",
      family: "gemini",
      name: "gemini-1.5-pro",
      capabilities: {
        vision: true,
        codeGeneration: true,
        reasoning: true,
        streaming: true
      },
      limits: {
        contextWindow: 2097152,  // 2M tokens
        maxOutput: 8192,
        rateLimit: 60
      },
      performance: {
        latencyMs: 1500,
        reliability: 0.99
      },
      cost: {
        inputPer1k: 0.00125,
        outputPer1k: 0.005
      }
    });
    
    // Gemini 1.5 Flash
    this.models.set("gemini-1.5-flash", {
      vendor: "google",
      family: "gemini",
      name: "gemini-1.5-flash",
      capabilities: {
        vision: true,
        codeGeneration: true,
        reasoning: true,
        streaming: true
      },
      limits: {
        contextWindow: 1048576,  // 1M tokens
        maxOutput: 8192,
        rateLimit: 60
      },
      performance: {
        latencyMs: 500,
        reliability: 0.97
      },
      cost: {
        inputPer1k: 0.000075,
        outputPer1k: 0.0003
      }
    });
  }
  
  /**
   * Get model profile by name
   */
  getModelProfile(modelName: string): ModelProfile | undefined {
    return this.models.get(modelName);
  }
  
  /**
   * Estimate token usage for a task
   */
  estimateTokens(input: string, projectContext?: any): number {
    // Simple estimation: ~1.3 tokens per word, plus context
    const words = input.split(/\s+/).length;
    const baseTokens = Math.ceil(words * 1.3);
    
    // Add context overhead if provided
    const contextOverhead = projectContext ? 2000 : 0;
    
    return baseTokens + contextOverhead;
  }
  
  /**
   * Check if model is available and within rate limits
   */
  async checkAvailability(modelName: string): Promise<boolean> {
    const profile = this.models.get(modelName);
    if (!profile) return false;
    
    // TODO: Implement actual rate limit checking
    // For now, assume all models are available
    return true;
  }
  
  /**
   * Get cost estimate for a model usage
   */
  estimateCost(
    modelName: string,
    inputTokens: number,
    outputTokens: number
  ): { total: number; breakdown: { input: number; output: number } } {
    const profile = this.models.get(modelName);
    if (!profile) {
      return { total: 0, breakdown: { input: 0, output: 0 } };
    }
    
    const inputCost = (inputTokens / 1000) * profile.cost.inputPer1k;
    const outputCost = (outputTokens / 1000) * profile.cost.outputPer1k;
    
    return {
      total: inputCost + outputCost,
      breakdown: {
        input: inputCost,
        output: outputCost
      }
    };
  }
}