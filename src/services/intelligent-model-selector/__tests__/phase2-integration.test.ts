/**
 * Phase 2 Integration Tests - API Integration + SSE Adaptive Control
 * Tests the complete Phase 2 IMS implementation with all components working together
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IMSRouter } from '../IMSRouter.js';
import { IMSAPIEndpoints } from '../api/IMSAPIEndpoints.js';
import { AdaptiveSSEController } from '../api/AdaptiveSSEController.js';
import { UnifiedProviderInterface } from '../providers/UnifiedProviderInterface.js';
import { AdminAPI } from '../AdminAPI.js';
import { HysteresisHealthChecker } from '../HysteresisHealthChecker.js';
import { RunawayPreventionCircuitBreaker } from '../RunawayPreventionCircuitBreaker.js';
import { TTFBAuditor } from '../TTFBAuditor.js';
import { IdempotencyManager } from '../IdempotencyManager.js';
import { HotCache } from '../HotCache.js';
import type { TaskInput } from '../types/TaskInput.js';
import type { IMSConfig } from '../types/IMSConfig.js';

describe('Phase 2 IMS Integration Tests', () => {
  let imsRouter: IMSRouter;
  let apiEndpoints: IMSAPIEndpoints;
  let sseController: AdaptiveSSEController;
  let providerInterface: UnifiedProviderInterface;
  let adminAPI: AdminAPI;
  let healthChecker: HysteresisHealthChecker;
  let circuitBreaker: RunawayPreventionCircuitBreaker;
  let ttfbAuditor: TTFBAuditor;
  let idempotencyManager: IdempotencyManager;
  let hotCache: HotCache<any>;

  const mockConfig: IMSConfig = {
    defaultPolicyId: 'test-policy',
    enableDecisionLogging: true,
    enablePIIRedaction: false,
    emergencyFallbackModel: 'gpt-4o-mini',
    ttfbBudgetMs: 500
  };

  beforeEach(async () => {
    // Initialize Phase 1 components
    healthChecker = new HysteresisHealthChecker({
      hysteresis: {
        healthyThreshold: 0.8,
        unhealthyThreshold: 0.3,
        minStayDurationMs: 30000
      },
      monitoring: {
        enabled: true,
        intervalMs: 5000,
        alertThresholds: {
          degradedThreshold: 0.6,
          criticalThreshold: 0.3
        }
      }
    });

    circuitBreaker = new RunawayPreventionCircuitBreaker({
      circuitBreaker: {
        enabled: true,
        failureThreshold: 5,
        recoveryTimeoutMs: 60000,
        halfOpenMaxCalls: 3
      },
      antiOscillation: {
        enabled: true,
        cooldownPeriodMs: 30000,
        maxFlipsPerPeriod: 3
      },
      runawayPrevention: {
        enabled: true,
        maxAttempts: 3,
        attemptWindowMs: 300000,
        exponentialBackoff: true
      }
    });

    ttfbAuditor = new TTFBAuditor({
      enabled: true,
      budgets: {
        auth: 40,
        cache: 20,
        rules: 10,
        select: 10,
        flush: 120,
        total: 500
      },
      monitoring: {
        enabled: true,
        alertThresholds: {
          warningThreshold: 0.8,
          criticalThreshold: 1.2
        },
        windowSizeMinutes: 15
      }
    });

    idempotencyManager = new IdempotencyManager({
      enabled: true,
      maxAge: 3600000, // 1 hour
      maxEntries: 10000
    });

    hotCache = new HotCache({
      maxSize: 1000,
      defaultTtlMs: 300000, // 5 minutes
      refreshThreshold: 0.2,
      evictionStrategy: 'lru'
    });

    // Initialize Phase 2 components
    providerInterface = new UnifiedProviderInterface({
      healthChecker,
      circuitBreaker
    });

    sseController = new AdaptiveSSEController();

    // Initialize IMS Router with all Phase 2 components
    imsRouter = new IMSRouter(
      mockConfig,
      {
        policyEngine: {} as any,
        poolManager: {} as any,
        decisionLogger: {} as any,
        decisionEngine: {} as any,
        piiRedactor: {} as any,
      },
      {
        hysteresisHealthChecker: healthChecker,
        circuitBreaker,
        ttfbAuditor,
        idempotencyManager,
        hotCache,
        preciseCalculator: {} as any
      }
    );

    // Initialize API endpoints
    apiEndpoints = new IMSAPIEndpoints({
      router: imsRouter,
      sseController,
      providerInterface,
      adminAPI: {} as any
    }, {
      enableSSE: true,
      enableMetrics: true,
      enableCaching: true,
      enableRateLimit: true
    });

    // Initialize AdminAPI
    adminAPI = new AdminAPI({
      enableRBAC: true,
      enableAuditLogging: true,
      sessionTimeoutMs: 1800000,
      rateLimitWindowMs: 60000,
      rateLimitMaxRequests: 100
    }, {
      imRouter: imsRouter,
      decisionLogger: {} as any,
      ttfbAuditor,
      healthChecker,
      circuitBreaker
    });

    await imsRouter.initialize();
  });

  afterEach(async () => {
    await imsRouter.cleanup();
    sseController.cleanup();
    providerInterface.cleanup();
    adminAPI.cleanup();
  });

  describe('Complete System Integration', () => {
    it('should process request through complete Phase 2 pipeline', async () => {
      const taskInput: TaskInput = {
        traceId: 'test-trace-001',
        idempotencyKey: 'test-idem-001',
        task: {
          kind: 'chat',
          latencyBudgetMs: 400,
          costTier: 'balanced'
        },
        content: { text: 'Generate a simple greeting message' },
        hints: {
          priority: 'balanced',
          latencyBudgetMs: 400,
          costTier: 'balanced'
        },
        session: {
          userId: 'test-user',
          plan: 'pro',
          currentUsage: {
            inputTokens: 1000,
            outputTokens: 500,
            monthStart: new Date()
          },
          requestedAt: new Date()
        }
      };

      // Mock decision engine to return a valid decision
      const mockDecisionEngine = {
        makeRoutingDecision: vi.fn().mockResolvedValue({
          selectedModel: {
            id: 'gpt-4o',
            providerId: 'openai',
            confidence: 0.9,
            constraints: {}
          },
          costPrediction: {
            estimatedCostUsd: 0.002,
            budgetImpact: 'low'
          },
          fallbackChain: [],
          performanceBreakdown: {
            modelSelectionMs: 5
          }
        })
      };

      (imsRouter as any).decisionEngine = mockDecisionEngine;

      const result = await imsRouter.route(taskInput);

      expect(result).toBeDefined();
      expect(result.modelId).toBe('gpt-4o');
      expect(result.trace.traceId).toBe('test-trace-001');
      expect(mockDecisionEngine.makeRoutingDecision).toHaveBeenCalledOnce();
    });

    it('should handle idempotency correctly', async () => {
      const taskInput: TaskInput = {
        traceId: 'test-trace-002',
        idempotencyKey: 'test-idem-duplicate',
        task: {
          kind: 'chat',
          latencyBudgetMs: 400,
          costTier: 'balanced'
        },
        content: { text: 'Test duplicate request' },
        hints: {
          priority: 'balanced',
          latencyBudgetMs: 400,
          costTier: 'balanced'
        },
        session: {
          userId: 'test-user',
          plan: 'pro',
          currentUsage: {
            inputTokens: 1000,
            outputTokens: 500,
            monthStart: new Date()
          },
          requestedAt: new Date()
        }
      };

      // Register duplicate request
      const duplicateCheck = idempotencyManager.registerRequest(
        taskInput.idempotencyKey,
        taskInput.traceId,
        taskInput.content
      );

      expect(duplicateCheck.isDuplicate).toBe(false); // First request

      // Register same request again
      const secondDuplicateCheck = idempotencyManager.registerRequest(
        taskInput.idempotencyKey,
        'different-trace-id',
        taskInput.content
      );

      expect(secondDuplicateCheck.isDuplicate).toBe(true);
      expect(secondDuplicateCheck.duplicateInfo?.originalTraceId).toBe(taskInput.traceId);
    });

    it('should record TTFB measurements correctly', async () => {
      const measurement = {
        traceId: 'test-ttfb-001',
        timestamp: Date.now(),
        taskType: 'chat',
        modelId: 'gpt-4o',
        providerName: 'openai',
        totalTTFBMs: 350,
        breakdown: {
          authMs: 25,
          cacheMs: 15,
          rulesMs: 8,
          selectMs: 7,
          flushMs: 95,
          totalMs: 350,
          budgetCompliance: {
            auth: true,
            cache: true,
            rules: true,
            select: true,
            flush: true,
            total: true
          }
        },
        budgetCompliance: {
          auth: true,
          cache: true,
          rules: true,
          select: true,
          flush: true,
          total: true
        },
        sessionContext: {
          userId: 'test-user',
          plan: 'pro'
        },
        networkContext: {
          region: 'us-central1'
        }
      };

      ttfbAuditor.recordMeasurement(measurement);

      const analytics = ttfbAuditor.getAnalytics(300000); // 5 minutes
      expect(analytics.totalMeasurements).toBe(1);
      expect(analytics.averageTTFBMs).toBe(350);
      expect(analytics.budgetCompliance.overallRate).toBe(1.0); // 100% compliant
    });

    it('should trigger circuit breaker on repeated failures', async () => {
      const modelKey = 'openai:gpt-4o';
      
      // Record multiple failures to trigger circuit breaker
      for (let i = 0; i < 6; i++) {
        circuitBreaker.recordFailure(modelKey, 'Connection timeout', `trace-${i}`);
      }

      const circuitState = circuitBreaker.getCircuitState(modelKey);
      expect(circuitState.status).toBe('open');
      expect(circuitState.failureCount).toBeGreaterThanOrEqual(5);
    });

    it('should handle hot cache correctly', async () => {
      const cacheKey = 'policy:test-policy';
      const cacheValue = { rules: ['rule1', 'rule2'], version: '1.0' };

      // Set cache value
      hotCache.set(cacheKey, cacheValue, { ttlMs: 60000 });

      // Retrieve cache value
      const cached = hotCache.get(cacheKey);
      expect(cached).toBeDefined();
      expect(cached?.value.rules).toEqual(['rule1', 'rule2']);
      expect(cached?.metadata.hits).toBe(1);
    });

    it('should maintain health status with hysteresis', async () => {
      // Record healthy metrics
      for (let i = 0; i < 10; i++) {
        healthChecker.recordMetric('openai', { value: 0.9 }, 'gpt-4o');
      }

      let assessment = healthChecker.getHealthAssessment('openai');
      expect(assessment?.healthState.status).toBe('healthy');

      // Record degraded metrics (but should stay healthy due to hysteresis)
      for (let i = 0; i < 5; i++) {
        healthChecker.recordMetric('openai', { value: 0.4 }, 'gpt-4o');
      }

      assessment = healthChecker.getHealthAssessment('openai');
      // Should still be healthy due to hysteresis
      expect(assessment?.healthState.status).toBe('healthy');
    });
  });

  describe('Phase 2 API Integration', () => {
    it('should handle SSE streaming with quality control', async () => {
      const mockRequest = {
        taskInput: {
          traceId: 'sse-test-001',
          task: { kind: 'chat' }
        },
        routingResult: {
          modelId: 'gpt-4o',
          providerId: 'openai'
        },
        streamingOptions: {
          quality: 'balanced' as const
        }
      };

      const mockResponse = {
        write: vi.fn(),
        end: vi.fn(),
        on: vi.fn()
      } as any;

      const ssePromise = sseController.streamWithQualityControl(
        {} as any, // Mock provider
        mockRequest,
        mockResponse,
        'balanced'
      );

      // Should not throw and should call response methods
      await expect(ssePromise).resolves.toBeUndefined();
      expect(mockResponse.write).toHaveBeenCalled();
    });

    it('should provide streaming statistics', () => {
      const stats = sseController.getStreamingStatistics();
      
      expect(stats).toBeDefined();
      expect(typeof stats.activeStreams).toBe('number');
      expect(typeof stats.totalProcessed).toBe('number');
      expect(typeof stats.averageQuality).toBe('number');
      expect(typeof stats.backpressureRate).toBe('number');
      expect(typeof stats.qualityAdaptations).toBe('number');
    });
  });

  describe('Phase 2 AdminAPI Integration', () => {
    it('should require proper RBAC for admin operations', async () => {
      const mockRequest = {
        user: {
          userId: 'test-user',
          roles: ['ims.viewer'], // Not admin
          permissions: []
        },
        body: {
          mode: 'emergency-model-only',
          durationMs: 300000,
          reason: 'Test emergency activation'
        }
      };

      // Should throw permission error
      await expect(
        adminAPI.activateKillSwitch(mockRequest)
      ).rejects.toThrow('Insufficient permissions');
    });

    it('should allow system health viewing with viewer role', async () => {
      const mockRequest = {
        user: {
          userId: 'test-user',
          roles: ['ims.viewer'],
          permissions: []
        }
      };

      // Mock health dependencies
      (imsRouter as any).getHealthStatus = vi.fn().mockResolvedValue({
        status: 'healthy',
        components: {},
        metrics: {}
      });

      const mockCircuitBreakerSummary = {
        openCircuits: 0,
        totalCircuits: 5,
        globalCircuitOpen: false
      };
      
      const mockTTFBSummary = {
        recentAverage: 250,
        budgetComplianceRate: 0.95,
        status: 'healthy'
      };

      circuitBreaker.getCircuitBreakerSummary = vi.fn().mockReturnValue(mockCircuitBreakerSummary);
      ttfbAuditor.getRealTimeSummary = vi.fn().mockReturnValue(mockTTFBSummary);

      const healthStatus = await adminAPI.getSystemHealth(mockRequest);

      expect(healthStatus).toBeDefined();
      expect(healthStatus.overall).toBe('healthy');
      expect(healthStatus.performance.recentAverage).toBe(250);
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should fallback gracefully when components fail', async () => {
      // Simulate component failure
      const faultyTaskInput: TaskInput = {
        traceId: 'fault-test-001',
        idempotencyKey: 'fault-test-001',
        task: {
          kind: 'chat',
          latencyBudgetMs: 400,
          costTier: 'balanced'
        },
        content: { text: 'Test fault tolerance' },
        hints: {
          priority: 'balanced',
          latencyBudgetMs: 400,
          costTier: 'balanced'
        },
        session: {
          userId: 'test-user',
          plan: 'pro',
          currentUsage: {
            inputTokens: 1000,
            outputTokens: 500,
            monthStart: new Date()
          },
          requestedAt: new Date()
        }
      };

      // Mock decision engine to throw error
      const mockDecisionEngine = {
        makeRoutingDecision: vi.fn().mockRejectedValue(new Error('Service unavailable'))
      };

      (imsRouter as any).decisionEngine = mockDecisionEngine;
      (imsRouter as any).shouldActivateEmergencyMode = vi.fn().mockReturnValue(true);
      (imsRouter as any).handleEmergencyFallback = vi.fn().mockResolvedValue({
        modelId: 'gpt-4o-mini',
        providerId: 'emergency',
        trace: { traceId: 'fault-test-001' }
      });

      const result = await imsRouter.route(faultyTaskInput);

      expect(result).toBeDefined();
      expect(result.modelId).toBe('gpt-4o-mini');
      expect(result.providerId).toBe('emergency');
    });
  });
});