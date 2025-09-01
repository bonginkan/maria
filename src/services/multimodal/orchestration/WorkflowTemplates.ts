/**
 * Workflow Templates for Multimodal Intelligence Operations
 * 
 * Provides pre-built workflow templates for common multimodal processing patterns:
 * - Multi-step analysis workflows
 * - Content generation pipelines  
 * - Quality assurance flows
 * - Cross-modal synthesis operations
 * 
 * @fileoverview Built-in workflow templates for common multimodal patterns
 * @version 3.6.0
 * @since 2024
 */

import { WorkflowDefinition, WorkflowStep, RetryPolicy, CompensationHandler, CacheConfig } from './WorkflowEngine.js';
import { ModalityType } from '../core/types.js';
import { CompensationAction } from "./CompensationManager.js";

// Template configuration interfaces
export interface TemplateConfig {
  name?: string;
  version?: string;
  globalTimeout?: number;
  maxParallelism?: number;
  enableCircuitBreaker?: boolean;
  enableTracing?: boolean;
  customSteps?: Partial<WorkflowStep>[];
}

export interface MultiStepAnalysisConfig extends TemplateConfig {
  modalityTypes: ModalityType[];
  analysisDepth?: 'shallow' | 'medium' | 'deep';
  enableCrossModalCorrelation?: boolean;
  confidenceThreshold?: number;
}

export interface ContentGenerationConfig extends TemplateConfig {
  inputModality: ModalityType;
  outputModalities: ModalityType[];
  qualityGates?: boolean;
  iterativeRefinement?: boolean;
  maxIterations?: number;
}

export interface QualityAssuranceConfig extends TemplateConfig {
  checkTypes: Array<'syntax' | 'semantic' | 'consistency' | 'safety' | 'performance'>;
  strictMode?: boolean;
  autoFix?: boolean;
  reportFormat?: 'detailed' | 'summary' | 'compact';
}

export interface CrossModalSynthesisConfig extends TemplateConfig {
  sourceModalities: ModalityType[];
  targetModality: ModalityType;
  synthesisStrategy?: 'merge' | 'transform' | 'enhance' | 'correlate';
  preserveSourceContext?: boolean;
}

// Default policies for different template types
const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  backoffMultiplier: 2,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  retryableErrors: ['timeout', 'network', 'temporary']
};

const AGGRESSIVE_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 5,
  backoffMultiplier: 1.5,
  initialDelayMs: 500,
  maxDelayMs: 15000,
  retryableErrors: ['timeout', 'network', 'temporary', 'rate_limit']
};

const DEFAULT_COMPENSATION: CompensationHandler = {
  type: 'rollback',
  timeout: 30000
};

const DEFAULT_CACHE_CONFIG: CacheConfig = {
  enabled: true,
  ttlMs: 300000, // 5 minutes
  scope: 'step'
};

// Template implementations
export class MultiStepAnalysisTemplate {
  static create(config: MultiStepAnalysisConfig): WorkflowDefinition {
    const steps: WorkflowStep[] = [];
    const workflowId = `multi-step-analysis-${Date.now()}`;

    // Step 1: Input validation and preprocessing
    steps.push({
      id: 'input-validation',
      name: 'Input Validation',
      type: 'validate',
      dependencies: [],
      retryPolicy: DEFAULT_RETRY_POLICY,
      compensationHandler: DEFAULT_COMPENSATION,
      timeout: 10000,
      metadata: {
        validationRules: ['format', 'size', 'modality_type'],
        required: true
      }
    });

    // Step 2: Modality-specific preprocessing for each input type
    config.modalityTypes.forEach((modality, index) => {
      steps.push({
        id: `preprocess-${modality}`,
        name: `Preprocess ${modality.toUpperCase()}`,
        type: 'process',
        modalityType: modality,
        dependencies: ['input-validation'],
        retryPolicy: DEFAULT_RETRY_POLICY,
        compensationHandler: DEFAULT_COMPENSATION,
        timeout: 30000,
        cache: DEFAULT_CACHE_CONFIG,
        metadata: {
          modality,
          preprocessingLevel: config.analysisDepth || 'medium'
        }
      });
    });

    // Step 3: Individual modality analysis
    const analysisSteps = config.modalityTypes.map((modality) => `analyze-${modality}`);
    config.modalityTypes.forEach((modality, index) => {
      steps.push({
        id: `analyze-${modality}`,
        name: `Analyze ${modality.toUpperCase()}`,
        type: 'process',
        modalityType: modality,
        dependencies: [`preprocess-${modality}`],
        retryPolicy: AGGRESSIVE_RETRY_POLICY, // Analysis is critical
        compensationHandler: DEFAULT_COMPENSATION,
        timeout: 60000,
        cache: DEFAULT_CACHE_CONFIG,
        metadata: {
          modality,
          analysisDepth: config.analysisDepth || 'medium',
          confidenceThreshold: config.confidenceThreshold || 0.7
        }
      });
    });

    // Step 4: Cross-modal correlation (if enabled)
    if (config.enableCrossModalCorrelation && config.modalityTypes.length > 1) {
      steps.push({
        id: 'cross-modal-correlation',
        name: 'Cross-Modal Correlation Analysis',
        type: 'aggregate',
        dependencies: analysisSteps,
        retryPolicy: DEFAULT_RETRY_POLICY,
        compensationHandler: DEFAULT_COMPENSATION,
        timeout: 45000,
        cache: DEFAULT_CACHE_CONFIG,
        metadata: {
          correlationTypes: ['semantic', 'temporal', 'spatial'],
          modalityTypes: config.modalityTypes,
          confidenceThreshold: config.confidenceThreshold || 0.7
        }
      });
    }

    // Step 5: Results aggregation and final analysis
    const finalDependencies = config.enableCrossModalCorrelation && config.modalityTypes.length > 1
      ? ['cross-modal-correlation']
      : analysisSteps;

    steps.push({
      id: 'final-aggregation',
      name: 'Final Results Aggregation',
      type: 'aggregate',
      dependencies: finalDependencies,
      retryPolicy: DEFAULT_RETRY_POLICY,
      compensationHandler: DEFAULT_COMPENSATION,
      timeout: 30000,
      metadata: {
        aggregationStrategy: 'weighted_average',
        outputFormat: 'structured',
        includeConfidenceScores: true
      }
    });

    // Add custom steps if provided
    if (config.customSteps) {
      config.customSteps.forEach((customStep, index) => {
        steps.push({
          id: `custom-step-${index}`,
          name: customStep.name || `Custom Step ${index + 1}`,
          type: customStep.type || 'process',
          dependencies: customStep.dependencies || ['final-aggregation'],
          retryPolicy: customStep.retryPolicy || DEFAULT_RETRY_POLICY,
          compensationHandler: customStep.compensationHandler || DEFAULT_COMPENSATION,
          timeout: customStep.timeout || 30000,
          cache: customStep.cache,
          metadata: customStep.metadata,
          ...customStep
        } as WorkflowStep);
      });
    }

    return {
      id: workflowId,
      name: config.name || `Multi-Step Analysis (${config.modalityTypes.join(', ')})`,
      version: config.version || '1.0.0',
      steps,
      globalTimeout: config.globalTimeout || 300000, // 5 minutes
      maxParallelism: config.maxParallelism || 3,
      circuitBreaker: config.enableCircuitBreaker ? {
        enabled: true,
        errorThreshold: 15, // 15% error rate
        volumeThreshold: 10,
        sleepWindowMs: 30000,
        bucketSizeMs: 60000
      } : undefined,
      tracing: config.enableTracing ? {
        enabled: true,
        serviceName: 'multimodal-analysis',
        samplingRate: 0.1,
        propagateContext: true
      } : undefined
    };
  }
}

export class ContentGenerationTemplate {
  static create(config: ContentGenerationConfig): WorkflowDefinition {
    const steps: WorkflowStep[] = [];
    const workflowId = `content-generation-${Date.now()}`;

    // Step 1: Input analysis and requirement extraction
    steps.push({
      id: 'input-analysis',
      name: 'Input Analysis & Requirements',
      type: 'process',
      modalityType: config.inputModality,
      dependencies: [],
      retryPolicy: DEFAULT_RETRY_POLICY,
      compensationHandler: DEFAULT_COMPENSATION,
      timeout: 30000,
      cache: DEFAULT_CACHE_CONFIG,
      metadata: {
        analysisType: 'requirement_extraction',
        inputModality: config.inputModality,
        targetModalities: config.outputModalities
      }
    });

    // Step 2: Content planning
    steps.push({
      id: 'content-planning',
      name: 'Content Generation Planning',
      type: 'transform',
      dependencies: ['input-analysis'],
      retryPolicy: DEFAULT_RETRY_POLICY,
      compensationHandler: DEFAULT_COMPENSATION,
      timeout: 20000,
      metadata: {
        planningStrategy: 'multi_stage',
        outputModalities: config.outputModalities,
        qualityTargets: config.qualityGates ? ['accuracy', 'coherence', 'relevance'] : []
      }
    });

    // Step 3: Generate content for each output modality
    config.outputModalities.forEach((modality, index) => {
      steps.push({
        id: `generate-${modality}`,
        name: `Generate ${modality.toUpperCase()} Content`,
        type: 'process',
        modalityType: modality,
        dependencies: ['content-planning'],
        retryPolicy: AGGRESSIVE_RETRY_POLICY,
        compensationHandler: DEFAULT_COMPENSATION,
        timeout: 90000,
        cache: DEFAULT_CACHE_CONFIG,
        metadata: {
          modality,
          generationMode: 'creative',
          baseContent: config.inputModality,
          iterativeRefinement: config.iterativeRefinement || false
        }
      });
    });

    // Step 4: Quality gates (if enabled)
    if (config.qualityGates) {
      const generationSteps = config.outputModalities.map(m => `generate-${m}`);
      
      steps.push({
        id: 'quality-validation',
        name: 'Content Quality Validation',
        type: 'validate',
        dependencies: generationSteps,
        retryPolicy: DEFAULT_RETRY_POLICY,
        compensationHandler: {
          type: 'compensate',
          handler: undefined, // Would trigger regeneration
          timeout: 60000
        },
        timeout: 45000,
        metadata: {
          validationCriteria: ['accuracy', 'coherence', 'style_consistency'],
          qualityThreshold: 0.8,
          autoRegenerate: true
        }
      });
    }

    return {
      id: workflowId,
      name: config.name || `Content Generation (${config.inputModality} → ${config.outputModalities.join(', ')})`,
      version: config.version || '1.0.0',
      steps,
      globalTimeout: config.globalTimeout || 600000, // 10 minutes
      maxParallelism: config.maxParallelism || Math.min(config.outputModalities.length, 4),
      circuitBreaker: config.enableCircuitBreaker ? {
        enabled: true,
        errorThreshold: 20, // 20% error rate (generation can be unpredictable)
        volumeThreshold: 5,
        sleepWindowMs: 60000,
        bucketSizeMs: 120000
      } : undefined,
      tracing: config.enableTracing ? {
        enabled: true,
        serviceName: 'content-generation',
        samplingRate: 0.2,
        propagateContext: true
      } : undefined
    };
  }
}

// Built-in template registry
export const BUILTIN_TEMPLATES = {
  'multi-step-analysis': MultiStepAnalysisTemplate,
  'content-generation-pipeline': ContentGenerationTemplate,
} as const;

// Template factory function
export function createWorkflowFromTemplate(
  templateName: keyof typeof BUILTIN_TEMPLATES,
  config: TemplateConfig
): WorkflowDefinition {
  const template = BUILTIN_TEMPLATES[templateName];
  if (!template) {
    throw new Error(`Unknown workflow template: ${templateName}`);
  }

  return (template as any).create(config);
}

// Template utilities
export class WorkflowTemplateUtils {
  static listAvailableTemplates(): Array<{
    name: string;
    description: string;
    configType: string;
  }> {
    return [
      {
        name: 'multi-step-analysis',
        description: 'Multi-modal analysis with cross-correlation support',
        configType: 'MultiStepAnalysisConfig'
      },
      {
        name: 'content-generation-pipeline',
        description: 'Content generation with quality gates and refinement',
        configType: 'ContentGenerationConfig'
      }
    ];
  }

  static validateTemplateConfig(
    templateName: keyof typeof BUILTIN_TEMPLATES,
    config: TemplateConfig
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Basic validation
    if (!templateName || !BUILTIN_TEMPLATES[templateName]) {
      errors.push(`Invalid template name: ${templateName}`);
    }

    if (!config) {
      errors.push('Configuration is required');
      return { valid: false, errors };
    }

    // Template-specific validation
    switch (templateName) {
      case 'multi-step-analysis':
        const analysisConfig = config as MultiStepAnalysisConfig;
        if (!analysisConfig.modalityTypes || analysisConfig.modalityTypes.length === 0) {
          errors.push('modalityTypes is required and must not be empty');
        }
        break;

      case 'content-generation-pipeline':
        const generationConfig = config as ContentGenerationConfig;
        if (!generationConfig.inputModality) {
          errors.push('inputModality is required');
        }
        if (!generationConfig.outputModalities || generationConfig.outputModalities.length === 0) {
          errors.push('outputModalities is required and must not be empty');
        }
        break;
    }

    return { valid: errors.length === 0, errors };
  }

  static getTemplateConfigExample(templateName: keyof typeof BUILTIN_TEMPLATES): TemplateConfig {
    switch (templateName) {
      case 'multi-step-analysis':
        return {
          modalityTypes: ['text', 'image'],
          analysisDepth: 'deep',
          enableCrossModalCorrelation: true,
          confidenceThreshold: 0.8,
          enableTracing: true
        } as MultiStepAnalysisConfig;

      case 'content-generation-pipeline':
        return {
          inputModality: 'text',
          outputModalities: ['image', 'audio'],
          qualityGates: true,
          iterativeRefinement: true,
          maxIterations: 3,
          enableCircuitBreaker: true
        } as ContentGenerationConfig;

      default:
        return {};
    }
  }
}

/**
 * Legacy Template factory for backward compatibility
 * @deprecated Use the new BUILTIN_TEMPLATES and createWorkflowFromTemplate instead
 */
export class WorkflowTemplates {
  /**
   * @deprecated Use MultiStepAnalysisTemplate.create() instead
   */
  static createParallelAnalysis(config: {
    name: string;
    modalities: string[];
    aggregationStrategy?: "merge" | "vote" | "weighted";
    weights?: Record<string, number>;
  }): WorkflowDefinition {
    // Convert to new template format
    return MultiStepAnalysisTemplate.create({
      name: config.name,
      modalityTypes: config.modalities as ModalityType[],
      enableCrossModalCorrelation: true,
      enableTracing: true
    } as MultiStepAnalysisConfig);
  }

  /**
   * @deprecated Use ContentGenerationTemplate.create() instead
   */
  static createSequentialPipeline(config: {
    name: string;
    steps: Array<{ id: string; name: string; modalityType: string; }>;
    enableCache?: boolean;
  }): WorkflowDefinition {
    // Basic conversion to content generation template
    return ContentGenerationTemplate.create({
      name: config.name,
      inputModality: 'text' as ModalityType,
      outputModalities: ['text'] as ModalityType[],
      qualityGates: true,
      enableCircuitBreaker: !!config.enableCache
    } as ContentGenerationConfig);
  }

  /**
   * Create compensation actions for a workflow (legacy compatibility)
   */
  static createCompensationActions(workflow: WorkflowDefinition): CompensationAction[] {
    return workflow.steps
      .filter((step) => step.compensationHandler)
      .map((step) => ({
        id: `compensate_${step.id}`,
        stepId: step.id,
        type: step.compensationHandler!.type as any,
        handler:
          step.compensationHandler!.handler ||
          (async () => {
            console.log(`Default compensation for ${step.id}`);
          }),
        timeout: step.compensationHandler!.timeout,
        retryPolicy: {
          maxAttempts: 2,
          delayMs: 1000,
        },
      }));
  }
}
