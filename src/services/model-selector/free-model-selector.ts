/**
 * FREE Plan Model Selector and Validator
 * Ensures only whitelisted models are used during FREE launch period
 */

import * as fs from 'fs';
import * as path from 'path';

export interface PlanConfig {
  id: string;
  name: string;
  status: 'active' | 'waitlist' | 'disabled';
  models: string[];
  imageModels: string[];
  videoModels: string[];
  limits: {
    image?: any;
    video?: any;
    code?: any;
    rateLimit?: any;
  };
  buckets: {
    req: number;
    tokens: number;
    code: number;
    image: number;
    video: number;
  };
}

export class FreeModelSelector {
  private planConfig: PlanConfig;
  
  constructor(planId: string = 'free') {
    this.planConfig = this.loadPlanConfig(planId);
  }
  
  /**
   * Load plan configuration from JSON file
   */
  private loadPlanConfig(planId: string): PlanConfig {
    const configPath = path.join(
      process.cwd(),
      'src/config/plans',
      `${planId}-plan.json`
    );
    
    if (!fs.existsSync(configPath)) {
      // Fallback to embedded config
      return this.getDefaultFreeConfig();
    }
    
    const configData = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(configData);
  }
  
  /**
   * Get default FREE configuration
   */
  private getDefaultFreeConfig(): PlanConfig {
    return {
      id: 'free',
      name: 'Free',
      status: 'active',
      models: [
        'google:gemini-2.5-flash',
        'google:gemini-2.0-flash'
      ],
      imageModels: [
        'google:imagen-4-fast',
        'google:gemini-2.5-image'
      ],
      videoModels: [
        'google:veo-3-fast',
        'google:veo-2.0-generate-001'
      ],
      limits: {
        image: {
          maxSize: '1024x1024',
          maxCountPerCall: 1
        },
        video: {
          maxDurationSec: 8,
          maxCountPerCall: 1
        },
        code: {
          maxTokensPerRequest: 8000,
          maxOutputTokens: 2048
        },
        rateLimit: {
          requestsPerSecond: 0.33
        }
      },
      buckets: {
        req: 100,
        tokens: 150000,
        code: 20,
        image: 25,
        video: 5
      }
    };
  }
  
  /**
   * Pick allowed model based on plan whitelist
   */
  pickAllowedModel(
    modelType: 'text' | 'image' | 'video',
    requestedModel?: string,
    fallbackList?: string[]
  ): string {
    let allowedModels: string[];
    
    switch (modelType) {
      case 'text':
        allowedModels = this.planConfig.models;
        break;
      case 'image':
        allowedModels = this.planConfig.imageModels;
        break;
      case 'video':
        allowedModels = this.planConfig.videoModels;
        break;
      default:
        allowedModels = this.planConfig.models;
    }
    
    // If requested model is in whitelist, use it
    if (requestedModel && allowedModels.includes(requestedModel)) {
      return requestedModel;
    }
    
    // Try fallback list
    if (fallbackList) {
      for (const fallback of fallbackList) {
        if (allowedModels.includes(fallback)) {
          return fallback;
        }
      }
    }
    
    // Return first allowed model as final fallback
    if (allowedModels.length > 0) {
      return allowedModels[0];
    }
    
    throw new Error(`No allowed models for type: ${modelType}`);
  }
  
  /**
   * Validate if model is allowed for plan
   */
  isModelAllowed(modelType: 'text' | 'image' | 'video', modelId: string): boolean {
    let allowedModels: string[];
    
    switch (modelType) {
      case 'text':
        allowedModels = this.planConfig.models;
        break;
      case 'image':
        allowedModels = this.planConfig.imageModels;
        break;
      case 'video':
        allowedModels = this.planConfig.videoModels;
        break;
      default:
        return false;
    }
    
    return allowedModels.includes(modelId);
  }
  
  /**
   * Get model display name with proper formatting
   */
  getModelDisplayName(modelId: string): string {
    // Remove provider prefix
    const modelName = modelId.replace(/^[^:]+:/, '');
    
    // Format common models
    const displayNames: Record<string, string> = {
      'gemini-2.5-flash': 'Gemini 2.5 Flash',
      'gemini-2.0-flash': 'Gemini 2.0 Flash',
      'gemini-2.5-pro': 'Gemini 2.5 Pro',
      'imagen-4-fast': 'Imagen 4 Fast',
      'imagen-4.0-fast-generate-001': 'Imagen 4 Fast',
      'gemini-2.5-image': 'Gemini 2.5 Image',
      'veo-3-fast': 'Veo 3 Fast',
      'veo-2.0-generate-001': 'Veo 2.0',
      'veo-3-standard': 'Veo 3 Standard'
    };
    
    return displayNames[modelName] || modelName;
  }
  
  /**
   * Get API model ID from display name
   */
  getApiModelId(modelType: 'text' | 'image' | 'video', displayName?: string): string {
    // Map display names to API IDs
    const apiIds: Record<string, string> = {
      // Text models
      'Gemini 2.5 Flash': 'gemini-2.5-flash',
      'Gemini 2.0 Flash': 'gemini-2.0-flash',
      
      // Image models
      'Imagen 4 Fast': 'imagen-4.0-fast-generate-001',
      'Gemini 2.5 Image': 'gemini-2.5-image',
      
      // Video models
      'Veo 3 Fast': 'veo-3-fast',
      'Veo 2.0': 'veo-2.0-generate-001'
    };
    
    if (displayName && apiIds[displayName]) {
      return apiIds[displayName];
    }
    
    // Return default for type
    return this.pickAllowedModel(modelType);
  }
  
  /**
   * Validate limits for request
   */
  validateLimits(type: 'image' | 'video' | 'code', request: any): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    const limits = this.planConfig.limits[type];
    
    if (!limits) {
      return { valid: true, errors: [] };
    }
    
    switch (type) {
      case 'image':
        if (request.width > limits.maxWidth) {
          errors.push(`Width ${request.width} exceeds limit ${limits.maxWidth}`);
        }
        if (request.height > limits.maxHeight) {
          errors.push(`Height ${request.height} exceeds limit ${limits.maxHeight}`);
        }
        if (request.count > limits.maxCountPerCall) {
          errors.push(`Count ${request.count} exceeds limit ${limits.maxCountPerCall}`);
        }
        break;
        
      case 'video':
        if (request.duration > limits.maxDurationSec) {
          errors.push(`Duration ${request.duration}s exceeds limit ${limits.maxDurationSec}s`);
        }
        if (request.duration < limits.minDurationSec) {
          errors.push(`Duration ${request.duration}s below minimum ${limits.minDurationSec}s`);
        }
        if (request.count > limits.maxCountPerCall) {
          errors.push(`Count ${request.count} exceeds limit ${limits.maxCountPerCall}`);
        }
        if (limits.aspectWhitelist && !limits.aspectWhitelist.includes(request.aspect)) {
          errors.push(`Aspect ratio ${request.aspect} not allowed. Use: ${limits.aspectWhitelist.join(', ')}`);
        }
        break;
        
      case 'code':
        if (request.tokens > limits.maxTokensPerRequest) {
          errors.push(`Token count ${request.tokens} exceeds limit ${limits.maxTokensPerRequest}`);
        }
        break;
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Get consumption for request
   */
  getConsumption(type: 'text' | 'image' | 'video', request: any): {
    bucketType: string;
    amount: number;
  } {
    const costRules = this.planConfig['costRules'] || {};
    
    switch (type) {
      case 'text':
        // Check for long context multiplier
        if (request.tokens > (costRules.longContextTokens?.threshold || 8000)) {
          return {
            bucketType: 'req',
            amount: costRules.longContextTokens?.multiplier || 2
          };
        }
        return { bucketType: 'req', amount: 1 };
        
      case 'image':
        return {
          bucketType: 'image',
          amount: (costRules.imageGen?.multiplier || 1) * (request.count || 1)
        };
        
      case 'video':
        return {
          bucketType: 'video',
          amount: (costRules.videoGen?.multiplier || 1) * (request.count || 1)
        };
        
      default:
        return { bucketType: 'req', amount: 1 };
    }
  }
  
  /**
   * Get plan configuration
   */
  getPlanConfig(): PlanConfig {
    return this.planConfig;
  }
  
  /**
   * Check if plan is active
   */
  isPlanActive(): boolean {
    return this.planConfig.status === 'active';
  }
  
  /**
   * Get waitlist URL for locked plans
   */
  getWaitlistUrl(): string | null {
    if (this.planConfig.status === 'waitlist') {
      return this.planConfig['waitlistUrl'] || 'https://forms.gle/maria-waitlist';
    }
    return null;
  }
}