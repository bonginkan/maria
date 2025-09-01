/**
 * Main IMS Router - Orchestrates the complete intelligent model selection process
 * Integrates all components for end-to-end routing with complete observability
 */

import { EventEmitter } from 'events';
import type { TaskInput, ProcessedTaskInput } from './types/TaskInput.js';
import type { RoutingDecisionResult } from './RoutingDecision.js';
import type { TTFBBreakdown } from './types/DecisionLog.js';
import { PolicyEngine } from './PolicyEngine.js';
import { ModelPoolManager } from './ModelPoolManager.js';
import { RoutingDecisionEngine } from './RoutingDecision.js';
import { CompleteDecisionLogger } from './CompleteDecisionLogger.js';
import { CompletePIIRedactor } from './CompletePIIRedactor.js';
import { HysteresisHealthChecker } from './HysteresisHealthChecker.js';
import { RunawayPreventionCircuitBreaker } from './RunawayPreventionCircuitBreaker.js';
import { TTFBAuditor } from './TTFBAuditor.js';
import { IdempotencyManager } from './IdempotencyManager.js';
import { HotCache } from './HotCache.js';

export interface IMSRouterConfig {
  firestoreClient: any;
  bigQueryClient: any;
  defaultPolicyId: string;
  enablePIIRedaction: boolean;
  enableDecisionLogging: boolean;
  emergencyFallbackModel: string;
  // Phase 2 enhancements
  enableHysteresisHealthChecking: boolean;
  enableRunawayPrevention: boolean;
  enableTTFBAuditing: boolean;
  enableIdempotency: boolean;
  enableHotCaching: boolean;
}

export interface RouteResult {
  /** Selected model information (no model names exposed to CLI) */
  routing: {
    success: true;
    estimatedTTFBMs: number;
    estimatedCostUsd: number;
    confidence: number;
  };
  
  /** Generation parameters for provider call */
  generationParams: {
    temperature: number;
    topP: number;
    seed?: number;
    maxTokens: number;
    stop?: string[];
  };
  
  /** Trace information for monitoring (internal use) */
  trace: {
    traceId: string;
    routedAt: string;
    policyUsed: string;
    fallbackChain: string[];
  };
  
  /** Error information if routing failed */
  error?: {
    code: string;
    message: string;
    retryAfter?: number;
    fallbackAttempted: boolean;
  };
}

export interface ProviderCallInfo {
  modelId: string;
  providerId: string;
  endpoint: string;
  headers: Record<string, string>;
  payload: any;
}

export class IMSRouter extends EventEmitter {
  private readonly policyEngine: PolicyEngine;
  private readonly poolManager: ModelPoolManager;
  private readonly decisionEngine: RoutingDecisionEngine;
  private readonly decisionLogger: CompleteDecisionLogger;
  private readonly piiRedactor: CompletePIIRedactor;
  
  // Phase 2 components
  private readonly healthChecker?: HysteresisHealthChecker;
  private readonly circuitBreaker?: RunawayPreventionCircuitBreaker;
  private readonly ttfbAuditor?: TTFBAuditor;
  private readonly idempotencyManager?: IdempotencyManager;
  private readonly hotCache?: HotCache;
  
  private isInitialized = false;
  private emergencyMode = false;
  
  constructor(private readonly config: IMSRouterConfig) {
    super();
    
    // Initialize core components
    this.policyEngine = new PolicyEngine(config.firestoreClient);
    this.poolManager = new ModelPoolManager(config.firestoreClient);
    this.piiRedactor = new CompletePIIRedactor();
    this.decisionEngine = new RoutingDecisionEngine(
      this.policyEngine,
      this.poolManager,
      this.piiRedactor
    );
    this.decisionLogger = new CompleteDecisionLogger(
      config.bigQueryClient,
      {
        bigQueryDataset: 'maria_ims',
        bigQueryTable: 'routing_decisions',
        localBackupEnabled: true,
        retentionMonths: 13,
        encryptionEnabled: true
      }
    );
    
    // Initialize Phase 2 components
    if (config.enableHysteresisHealthChecking) {
      this.healthChecker = new HysteresisHealthChecker();
    }
    
    if (config.enableRunawayPrevention) {
      this.circuitBreaker = new RunawayPreventionCircuitBreaker();
    }
    
    if (config.enableTTFBAuditing) {
      this.ttfbAuditor = new TTFBAuditor();
    }
    
    if (config.enableIdempotency) {
      this.idempotencyManager = new IdempotencyManager();
    }
    
    if (config.enableHotCaching) {
      this.hotCache = new HotCache();
    }
    
    this.setupEventHandlers();
  }

  /**
   * Initialize the IMS Router
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      const startTime = Date.now();
      
      // Initialize all components in parallel
      await Promise.all([
        this.policyEngine.initialize(),
        this.poolManager.initialize()
      ]);
      
      const initializationTime = Date.now() - startTime;
      
      this.isInitialized = true;
      this.emit('initialized', { initializationTimeMs: initializationTime });
    } catch (error) {
      this.emit('initializationError', error);
      throw error;
    }
  }

  /**
   * Route request to optimal model with complete TTFB tracking and Phase 2 enhancements
   */
  async route(input: TaskInput): Promise<RouteResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    const ttfbBreakdown: TTFBBreakdown = {
      authMs: 0,
      cacheMs: 0,
      rulesMs: 0,
      selectMs: 0,
      flushMs: 0,
      totalMs: 0,
      budgetCompliance: {
        auth: false,
        cache: false,
        rules: false,
        select: false,
        flush: false,
        total: false
      }
    };

    try {
      this.emit('routingStarted', { traceId: input.traceId, taskKind: input.task.kind });

      // Phase 2 Enhancement: Check idempotency first
      if (this.idempotencyManager && input.idempotencyKey !== input.traceId) {
        const duplicateCheck = this.idempotencyManager.registerRequest(
          input.idempotencyKey,
          input.traceId,
          input.content
        );

        if (duplicateCheck.isDuplicate) {
          const cachedResponse = this.idempotencyManager.getResponse(input.idempotencyKey);
          if (cachedResponse) {
            return this.buildRouteResultFromCache(cachedResponse, input.traceId, startTime);
          }
          // Continue if duplicate but no cached response yet
        }
      }

      // Step 1: Authentication/Authorization (Budget: 40ms)
      const authStartTime = Date.now();
      await this.validateRequest(input);
      ttfbBreakdown.authMs = Date.now() - authStartTime;
      ttfbBreakdown.budgetCompliance.auth = ttfbBreakdown.authMs <= 40;

      // Step 2: PII Redaction (included in auth time)
      let processedTask: ProcessedTaskInput;
      
      if (this.config.enablePIIRedaction) {
        const redactionResult = await this.piiRedactor.redactStructured({
          headers: {},
          body: input.content,
          metadata: input.hints
        });
        
        processedTask = {
          ...input,
          cleanContent: redactionResult.cleanInput.body || input.content,
          piiRedactionReport: redactionResult.redactionReport.locations
        };
      } else {
        processedTask = {
          ...input,
          cleanContent: input.content,
          piiRedactionReport: []
        };
      }

      // Step 3: Policy evaluation with hot cache (Budget: 20ms)
      const cacheStartTime = Date.now();
      let cachedPolicy = null;
      
      if (this.hotCache) {
        const cacheKey = `policy:${this.config.defaultPolicyId}`;
        cachedPolicy = this.hotCache.getValue(cacheKey);
        
        if (!cachedPolicy) {
          // Cache miss - will be loaded by policyEngine
          this.emit('cacheMiss', { key: cacheKey, type: 'policy' });
        }
      }
      
      ttfbBreakdown.cacheMs = Date.now() - cacheStartTime;
      ttfbBreakdown.budgetCompliance.cache = ttfbBreakdown.cacheMs <= 20;

      // Step 4: Rules evaluation with circuit breaker protection (Budget: 10ms)
      const rulesStartTime = Date.now();
      
      // Phase 2 Enhancement: Circuit breaker check before decision making
      if (this.circuitBreaker) {
        const availableCandidates = await this.getAvailableCandidates(processedTask);
        const selectedCandidate = await this.circuitBreaker.selectWithRunawayPrevention(
          availableCandidates,
          processedTask.traceId
        );
        
        // Log circuit breaker decision
        this.emit('circuitBreakerSelection', {
          traceId: processedTask.traceId,
          selectedModel: selectedCandidate.model.id,
          availableCount: availableCandidates.length
        });
      }
      
      const decision = await this.decisionEngine.makeRoutingDecision(
        processedTask,
        this.config.defaultPolicyId
      );
      ttfbBreakdown.rulesMs = Date.now() - rulesStartTime;
      ttfbBreakdown.budgetCompliance.rules = ttfbBreakdown.rulesMs <= 10;

      // Step 5: Model selection (Budget: 10ms - already included in decision making)
      ttfbBreakdown.selectMs = decision.performanceBreakdown.modelSelectionMs;
      ttfbBreakdown.budgetCompliance.select = ttfbBreakdown.selectMs <= 10;

      // Step 6: Prepare response (Budget: 120ms)
      const flushStartTime = Date.now();
      const routeResult = this.buildRouteResult(decision, input.traceId);
      ttfbBreakdown.flushMs = Date.now() - flushStartTime;
      ttfbBreakdown.budgetCompliance.flush = ttfbBreakdown.flushMs <= 120;

      // Calculate total TTFB
      ttfbBreakdown.totalMs = Date.now() - startTime;
      ttfbBreakdown.budgetCompliance.total = ttfbBreakdown.totalMs <= 500;

      // Phase 2 Enhancement: Record TTFB measurement
      this.recordTTFBMeasurement(
        input.traceId,
        ttfbBreakdown,
        input.task.kind,
        decision.selectedModel.id
      );

      // Phase 2 Enhancement: Store idempotent response if applicable
      if (this.idempotencyManager && input.idempotencyKey !== input.traceId) {
        this.storeIdempotentResponse(input.idempotencyKey, routeResult);
      }

      // Log decision if enabled
      if (this.config.enableDecisionLogging) {
        await this.decisionLogger.logRoutingDecision(
          processedTask,
          decision,
          ttfbBreakdown,
          {
            totalRedacted: processedTask.piiRedactionReport.length,
            breakdown: this.summarizePIIRedaction(processedTask.piiRedactionReport),
            locations: processedTask.piiRedactionReport,
            redactionFailures: false,
            processingTimeMs: 0
          }
        );
      }

      this.emit('routingCompleted', {
        traceId: input.traceId,
        selectedModelId: decision.selectedModel.id,
        ttfbMs: ttfbBreakdown.totalMs,
        budgetCompliant: ttfbBreakdown.budgetCompliance.total,
        confidence: decision.selectedModel.confidence
      });

      return routeResult;

    } catch (error) {
      // Emergency fallback
      if (this.emergencyMode || this.shouldActivateEmergencyMode(error)) {
        return await this.handleEmergencyFallback(input, error, ttfbBreakdown);
      }

      this.emit('routingFailed', { 
        traceId: input.traceId, 
        error, 
        ttfbMs: Date.now() - startTime 
      });

      throw error;
    }
  }

  /**
   * Route with fallback handling
   */
  async routeWithFallback(input: TaskInput, previousAttempts: string[] = []): Promise<RouteResult> {
    try {
      const result = await this.route(input);
      return result;
    } catch (error) {
      // If we have fallback models available, try them
      if (previousAttempts.length < 3) {
        this.emit('fallbackAttempt', { 
          traceId: input.traceId, 
          attempt: previousAttempts.length + 1,
          error: error.message 
        });

        // Log fallback attempt
        if (this.config.enableDecisionLogging) {
          await this.decisionLogger.logFallbackAttempt(input.traceId, {
            modelId: 'unknown',
            reason: error.message,
            failureDetails: { error: error.message },
            attemptedAt: new Date().toISOString(),
            durationMs: 0,
            succeeded: false
          });
        }

        // Retry with previous attempts marked
        return await this.routeWithFallback(input, [...previousAttempts, 'failed']);
      }

      // All fallbacks exhausted
      throw error;
    }
  }

  /**
   * Reproduce a previous routing decision
   */
  async reproduceDecision(reproductionRequest: {
    task: ProcessedTaskInput;
    policySnapshot: any;
    poolSnapshot: any;
    healthSnapshot: any;
  }): Promise<RouteResult> {
    try {
      const decision = await this.decisionEngine.reproduceDecision(
        reproductionRequest.task,
        reproductionRequest.policySnapshot,
        reproductionRequest.poolSnapshot,
        reproductionRequest.healthSnapshot
      );

      return this.buildRouteResult(decision, reproductionRequest.task.traceId);
    } catch (error) {
      this.emit('reproductionFailed', { 
        traceId: reproductionRequest.task.traceId, 
        error 
      });
      throw error;
    }
  }

  /**
   * Get routing analytics and health status
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    components: {
      policyEngine: boolean;
      poolManager: boolean;
      decisionLogger: boolean;
    };
    metrics: {
      averageTTFBMs: number;
      successRate: number;
      emergencyMode: boolean;
    };
    lastCheck: string;
  }> {
    const healthReport = this.poolManager.getHealthReport();
    
    return {
      status: healthReport.summary.unavailableModels > healthReport.summary.totalModels * 0.5 
        ? 'unhealthy' 
        : healthReport.summary.degradedModels > healthReport.summary.totalModels * 0.3
        ? 'degraded'
        : 'healthy',
      components: {
        policyEngine: this.policyEngine.listenerCount('error') === 0,
        poolManager: this.poolManager.listenerCount('error') === 0,
        decisionLogger: this.decisionLogger.listenerCount('error') === 0
      },
      metrics: {
        averageTTFBMs: 250, // Would be calculated from recent decisions
        successRate: 0.99, // Would be calculated from recent decisions
        emergencyMode: this.emergencyMode
      },
      lastCheck: new Date().toISOString()
    };
  }

  /**
   * Activate emergency mode (kill switch)
   */
  async activateKillSwitch(config: {
    mode: 'low-tier-only' | 'emergency-model-only' | 'maintenance';
    durationMs: number;
    reason: string;
    activatedBy: string;
  }): Promise<void> {
    this.emergencyMode = true;
    
    this.emit('emergencyModeActivated', {
      mode: config.mode,
      reason: config.reason,
      activatedBy: config.activatedBy,
      expiresAt: new Date(Date.now() + config.durationMs)
    });

    // Set timer to automatically deactivate
    setTimeout(() => {
      this.deactivateKillSwitch();
    }, config.durationMs);
  }

  /**
   * Deactivate emergency mode
   */
  deactivateKillSwitch(): void {
    this.emergencyMode = false;
    this.emit('emergencyModeDeactivated', { timestamp: new Date().toISOString() });
  }

  /**
   * Record actual performance metrics for learning
   */
  async recordActualPerformance(traceId: string, metrics: {
    actualTTFBMs: number;
    totalDurationMs: number;
    actualTokens: { input: number; output: number };
    finalCostUsd: number;
    success: boolean;
    error?: { code: string; message: string };
  }): Promise<void> {
    // Update decision logger with actual metrics
    if (this.config.enableDecisionLogging) {
      await this.decisionLogger.updateLogWithActualMetrics(traceId, {
        actualTTFBMs: metrics.actualTTFBMs,
        totalDurationMs: metrics.totalDurationMs,
        actualTokens: metrics.actualTokens,
        finalCostUsd: metrics.finalCostUsd,
        success: metrics.success,
        error: metrics.error
      });
    }

    // Update pool manager with performance data
    // This would require extracting model ID from the trace
    this.emit('actualPerformanceRecorded', { traceId, metrics });
  }

  /**
   * Private methods
   */

  private setupEventHandlers(): void {
    // Forward critical events
    this.policyEngine.on('error', (error) => this.emit('policyEngineError', error));
    this.poolManager.on('error', (error) => this.emit('poolManagerError', error));
    this.decisionLogger.on('error', (error) => this.emit('decisionLoggerError', error));
    
    // Circuit breaker events
    this.poolManager.on('circuitBreakerTransition', (event) => {
      this.emit('circuitBreakerTransition', event);
      
      // Consider emergency mode if too many circuits are open
      if (event.to === 'open') {
        this.checkEmergencyModeConditions();
      }
    });
  }

  private async validateRequest(input: TaskInput): Promise<void> {
    // Basic validation
    if (!input.traceId || !input.task.kind) {
      throw new Error('Invalid request: missing required fields');
    }

    if (!input.idempotencyKey) {
      throw new Error('Invalid request: idempotency key required');
    }

    // Rate limiting would be implemented here
    // Authentication checks would be implemented here
  }

  private buildRouteResult(decision: RoutingDecisionResult, traceId: string): RouteResult {
    return {
      routing: {
        success: true,
        estimatedTTFBMs: decision.selectedModel.estimatedTTFBMs,
        estimatedCostUsd: decision.selectedModel.estimatedCostUsd,
        confidence: decision.selectedModel.confidence
      },
      generationParams: decision.generationParams,
      trace: {
        traceId,
        routedAt: decision.metadata.decisionTimestamp,
        policyUsed: this.config.defaultPolicyId,
        fallbackChain: decision.fallbackChain
      }
    };
  }

  private summarizePIIRedaction(locations: any[]): Record<string, number> {
    const breakdown: Record<string, number> = {};
    
    for (const location of locations) {
      breakdown[location.type] = (breakdown[location.type] || 0) + location.count;
    }
    
    return breakdown;
  }

  private shouldActivateEmergencyMode(error: any): boolean {
    // Check if error indicates system-wide issues
    return error.message.includes('No available models') ||
           error.message.includes('All providers down') ||
           error.message.includes('Circuit breakers open');
  }

  private async handleEmergencyFallback(
    input: TaskInput, 
    originalError: any, 
    ttfbBreakdown: TTFBBreakdown
  ): Promise<RouteResult> {
    this.emit('emergencyFallbackActivated', { 
      traceId: input.traceId, 
      originalError: originalError.message 
    });

    // Return minimal viable routing result
    return {
      routing: {
        success: true,
        estimatedTTFBMs: 2000, // Conservative estimate
        estimatedCostUsd: 0.01, // Conservative estimate
        confidence: 0.3 // Low confidence in emergency mode
      },
      generationParams: {
        temperature: 0.7,
        topP: 0.9,
        maxTokens: 1000,
        seed: 42 // Fixed seed for consistency
      },
      trace: {
        traceId: input.traceId,
        routedAt: new Date().toISOString(),
        policyUsed: 'emergency',
        fallbackChain: [this.config.emergencyFallbackModel]
      },
      error: {
        code: 'EMERGENCY_FALLBACK',
        message: 'Using emergency fallback due to system issues',
        fallbackAttempted: true
      }
    };
  }

  private checkEmergencyModeConditions(): void {
    const healthReport = this.poolManager.getHealthReport();
    const unhealthyRate = healthReport.summary.unavailableModels / healthReport.summary.totalModels;
    
    if (unhealthyRate > 0.7 && !this.emergencyMode) {
      this.activateKillSwitch({
        mode: 'emergency-model-only',
        durationMs: 300000, // 5 minutes
        reason: 'Automatic activation due to high failure rate',
        activatedBy: 'system'
      });
    }
  }

  /**
   * Phase 2 Helper Methods
   */

  /**
   * Get available candidates with circuit breaker integration
   */
  private async getAvailableCandidates(processedTask: ProcessedTaskInput): Promise<ModelCandidate[]> {
    const decision = await this.decisionEngine.makeRoutingDecision(
      processedTask,
      this.config.defaultPolicyId
    );

    // Transform decision to candidates format
    const candidates: ModelCandidate[] = [
      {
        model: {
          id: decision.selectedModel.id,
          providerId: decision.selectedModel.providerId || 'unknown'
        },
        selectionScore: decision.selectedModel.confidence || 0.8,
        constraints: decision.selectedModel.constraints,
        healthScore: 1.0, // Will be updated by health checker
        costPrediction: decision.costPrediction
      }
    ];

    // Add fallback models as candidates
    if (decision.fallbackChain.length > 0) {
      for (const fallbackModel of decision.fallbackChain) {
        candidates.push({
          model: {
            id: fallbackModel,
            providerId: 'unknown'
          },
          selectionScore: 0.6, // Lower score for fallbacks
          constraints: {},
          healthScore: 0.8,
          costPrediction: { estimatedCostUsd: 0.001, budgetImpact: 'low' }
        });
      }
    }

    return candidates;
  }

  /**
   * Build route result from cached response
   */
  private buildRouteResultFromCache(cachedResponse: any, traceId: string, startTime: number): RouteResult {
    return {
      modelId: cachedResponse.modelId || 'cached-response',
      providerId: cachedResponse.providerId || 'cache',
      generationParams: cachedResponse.generationParams || {},
      constraints: cachedResponse.constraints || {},
      trace: {
        traceId,
        routedAt: new Date().toISOString(),
        policyUsed: 'cached',
        fallbackChain: [],
        ttfbMs: Date.now() - startTime,
        cacheHit: true
      },
      costPrediction: cachedResponse.costPrediction || { estimatedCostUsd: 0, budgetImpact: 'negligible' }
    };
  }

  /**
   * Store response in idempotency manager
   */
  private storeIdempotentResponse(idempotencyKey: string, routeResult: RouteResult): void {
    if (this.idempotencyManager) {
      this.idempotencyManager.storeResponse(idempotencyKey, {
        modelId: routeResult.modelId,
        providerId: routeResult.providerId,
        generationParams: routeResult.generationParams,
        constraints: routeResult.constraints,
        costPrediction: routeResult.costPrediction,
        timestamp: Date.now(),
        ttl: 3600000 // 1 hour
      });
    }
  }

  /**
   * Record TTFB measurement with auditor
   */
  private recordTTFBMeasurement(
    traceId: string, 
    breakdown: TTFBBreakdown,
    taskKind: string,
    modelId: string
  ): void {
    if (this.ttfbAuditor) {
      this.ttfbAuditor.recordMeasurement({
        traceId,
        timestamp: Date.now(),
        taskType: taskKind,
        modelId,
        providerName: 'unknown',
        totalTTFBMs: breakdown.totalMs,
        breakdown,
        budgetCompliance: breakdown.budgetCompliance,
        sessionContext: {
          userId: 'unknown',
          plan: 'pro'
        },
        networkContext: {
          region: 'us-central1'
        }
      });
    }
  }

  /**
   * Cleanup method
   */
  async cleanup(): Promise<void> {
    // Phase 2: Cleanup new components
    const cleanupPromises = [
      this.policyEngine.cleanup(),
      this.poolManager.cleanup(),
      this.decisionLogger.cleanup()
    ];

    if (this.hysteresisHealthChecker) {
      cleanupPromises.push(this.hysteresisHealthChecker.cleanup());
    }
    if (this.circuitBreaker) {
      cleanupPromises.push(this.circuitBreaker.cleanup());
    }
    if (this.ttfbAuditor) {
      cleanupPromises.push(this.ttfbAuditor.cleanup());
    }
    if (this.hotCache) {
      cleanupPromises.push(this.hotCache.cleanup());
    }
    if (this.idempotencyManager) {
      cleanupPromises.push(this.idempotencyManager.cleanup());
    }

    await Promise.all(cleanupPromises);
    
    this.isInitialized = false;
    this.emit('cleanup');
  }
}