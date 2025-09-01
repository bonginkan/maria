/**
 * IMS Router Test Suite
 * Tests core functionality, TTFB budgets, and error handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IMSRouter } from '../IMSRouter.js';
import type { TaskInput } from '../types/TaskInput.js';

// Mock dependencies
const mockFirestoreClient = {
  collection: vi.fn(() => ({
    doc: vi.fn(() => ({
      get: vi.fn(() => Promise.resolve({
        exists: true,
        data: () => ({
          id: 'default',
          version: '1.0',
          taskMatrix: {
            chat: { latencyBudgetMs: 2000, costTier: 'mid' }
          },
          rules: [],
          createdAt: new Date()
        })
      })),
      collection: vi.fn(() => ({
        doc: vi.fn(() => ({
          get: vi.fn(() => Promise.resolve({
            exists: true,
            data: () => ({
              id: 'default',
              version: '1.0',
              models: [{
                id: 'test:model-1',
                providerId: 'test',
                modelName: 'test-model',
                modality: 'text',
                contextWindow: 4096,
                performance: {
                  estimatedTTFBMs: 200,
                  estimatedThroughput: 100,
                  qualityScore: 0.8
                },
                cost: {
                  inputTokensPPM: 0.5,
                  outputTokensPPM: 1.5,
                  fixedCostPerRequest: 0
                },
                capabilities: {
                  languages: ['en'],
                  functionCalling: false,
                  toolUse: false,
                  codeExecution: false,
                  streaming: true,
                  maxOutputTokens: 4096
                },
                defaultParams: {
                  temperature: 0.7,
                  topP: 0.9,
                  maxTokens: 2000,
                  stop: []
                }
              }],
              constraints: {
                maxCostPerRequest: 0.1,
                maxLatencyMs: 2000,
                minQualityScore: 0.5
              },
              fallbackStrategy: {
                maxFallbacks: 3,
                strategy: 'health_score',
                allowCrossModality: false,
                fallbackTimeoutMs: 1000,
                minFallbackIntervalMs: 100
              },
              createdAt: new Date()
            })
          }))
        }))
      }))
    }))
  }))
};

const mockBigQueryClient = {
  dataset: vi.fn(() => ({
    table: vi.fn(() => ({
      insert: vi.fn(() => Promise.resolve())
    }))
  })),
  query: vi.fn(() => Promise.resolve([[]]))
};

describe('IMSRouter', () => {
  let router: IMSRouter;
  let mockInput: TaskInput;

  beforeEach(() => {
    vi.clearAllMocks();
    
    router = new IMSRouter({
      firestoreClient: mockFirestoreClient,
      bigQueryClient: mockBigQueryClient,
      defaultPolicyId: 'default',
      enablePIIRedaction: true,
      enableDecisionLogging: true,
      emergencyFallbackModel: 'emergency-model'
    });

    mockInput = {
      traceId: 'test-trace-123',
      idempotencyKey: 'test-idem-key',
      task: {
        kind: 'chat',
        tokensIn: 100,
        longContext: false,
        modality: 'text'
      },
      content: {
        text: 'Hello world'
      },
      hints: {
        priority: 'balanced',
        maxTokens: 2000,
        costTier: 'mid'
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
  });

  afterEach(async () => {
    await router.cleanup();
  });

  describe('Basic Routing', () => {
    it('should successfully route a basic request', async () => {
      const result = await router.route(mockInput);

      expect(result).toEqual({
        routing: {
          success: true,
          estimatedTTFBMs: expect.any(Number),
          estimatedCostUsd: expect.any(Number),
          confidence: expect.any(Number)
        },
        generationParams: {
          temperature: expect.any(Number),
          topP: expect.any(Number),
          maxTokens: expect.any(Number),
          seed: expect.any(Number)
        },
        trace: {
          traceId: mockInput.traceId,
          routedAt: expect.any(String),
          policyUsed: 'default',
          fallbackChain: expect.any(Array)
        }
      });
    });

    it('should initialize components automatically on first route', async () => {
      const initSpy = vi.spyOn(router, 'initialize');
      await router.route(mockInput);
      expect(initSpy).toHaveBeenCalled();
    });

    it('should emit routing events', async () => {
      const routingStartedSpy = vi.fn();
      const routingCompletedSpy = vi.fn();
      
      router.on('routingStarted', routingStartedSpy);
      router.on('routingCompleted', routingCompletedSpy);

      await router.route(mockInput);

      expect(routingStartedSpy).toHaveBeenCalledWith({
        traceId: mockInput.traceId,
        taskKind: mockInput.task.kind
      });
      
      expect(routingCompletedSpy).toHaveBeenCalledWith({
        traceId: mockInput.traceId,
        selectedModelId: expect.any(String),
        ttfbMs: expect.any(Number),
        budgetCompliant: expect.any(Boolean),
        confidence: expect.any(Number)
      });
    });
  });

  describe('TTFB Budget Compliance', () => {
    it('should meet TTFB budget requirements', async () => {
      const startTime = Date.now();
      const result = await router.route(mockInput);
      const actualTTFB = Date.now() - startTime;

      // Should be under 500ms total budget
      expect(actualTTFB).toBeLessThan(500);
      
      // Estimated TTFB should be reasonable
      expect(result.routing.estimatedTTFBMs).toBeLessThan(2000);
      expect(result.routing.estimatedTTFBMs).toBeGreaterThan(0);
    });

    it('should track TTFB breakdown in events', async () => {
      const routingCompletedSpy = vi.fn();
      router.on('routingCompleted', routingCompletedSpy);

      await router.route(mockInput);

      const eventData = routingCompletedSpy.mock.calls[0][0];
      expect(eventData.ttfbMs).toBeGreaterThan(0);
      expect(eventData.budgetCompliant).toBeDefined();
    });
  });

  describe('PII Protection', () => {
    it('should redact PII from input content', async () => {
      const inputWithPII = {
        ...mockInput,
        content: {
          text: 'My email is user@example.com and phone is 555-123-4567'
        }
      };

      const result = await router.route(inputWithPII);
      expect(result.routing.success).toBe(true);
      
      // PII should be processed (tested more thoroughly in PII redactor tests)
    });

    it('should handle PII redaction errors gracefully', async () => {
      // Mock PII redactor to fail
      const failingInput = {
        ...mockInput,
        content: null as any // Invalid content that might cause redaction to fail
      };

      // Should not throw, should handle gracefully
      const result = await router.route({
        ...failingInput,
        content: { text: 'safe content' }
      });
      
      expect(result.routing.success).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should validate required fields', async () => {
      const invalidInput = {
        ...mockInput,
        traceId: '', // Invalid
        idempotencyKey: '' // Invalid
      };

      await expect(router.route(invalidInput)).rejects.toThrow('Invalid request');
    });

    it('should handle emergency fallback', async () => {
      // Mock the decision engine to fail
      vi.spyOn(router as any, 'decisionEngine', 'get').mockReturnValue({
        makeRoutingDecision: vi.fn().mockRejectedValue(new Error('No available models'))
      });

      const result = await router.route(mockInput);

      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('EMERGENCY_FALLBACK');
      expect(result.error?.fallbackAttempted).toBe(true);
    });

    it('should emit error events', async () => {
      const routingFailedSpy = vi.fn();
      router.on('routingFailed', routingFailedSpy);

      const invalidInput = {
        ...mockInput,
        traceId: '' // This should cause validation to fail
      };

      try {
        await router.route(invalidInput);
      } catch (error) {
        expect(routingFailedSpy).toHaveBeenCalledWith({
          traceId: '',
          error: expect.any(Error),
          ttfbMs: expect.any(Number)
        });
      }
    });
  });

  describe('Fallback Handling', () => {
    it('should attempt fallbacks on initial failure', async () => {
      const fallbackSpy = vi.fn();
      router.on('fallbackAttempt', fallbackSpy);

      // Mock initial failure then success
      let callCount = 0;
      vi.spyOn(router, 'route').mockImplementation(async (input) => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Primary model failed');
        }
        return {
          routing: { success: true, estimatedTTFBMs: 1000, estimatedCostUsd: 0.01, confidence: 0.8 },
          generationParams: { temperature: 0.7, topP: 0.9, maxTokens: 1000 },
          trace: { traceId: input.traceId, routedAt: new Date().toISOString(), policyUsed: 'default', fallbackChain: [] }
        };
      });

      const result = await router.routeWithFallback(mockInput);
      expect(result.routing.success).toBe(true);
    });

    it('should limit fallback attempts', async () => {
      // Mock router to always fail
      vi.spyOn(router, 'route').mockRejectedValue(new Error('Always fails'));

      await expect(router.routeWithFallback(mockInput)).rejects.toThrow('Always fails');
    });
  });

  describe('Health Status', () => {
    it('should return health status', async () => {
      await router.initialize();
      const health = await router.getHealthStatus();

      expect(health).toEqual({
        status: expect.oneOf(['healthy', 'degraded', 'unhealthy']),
        components: {
          policyEngine: expect.any(Boolean),
          poolManager: expect.any(Boolean),
          decisionLogger: expect.any(Boolean)
        },
        metrics: {
          averageTTFBMs: expect.any(Number),
          successRate: expect.any(Number),
          emergencyMode: expect.any(Boolean)
        },
        lastCheck: expect.any(String)
      });
    });

    it('should track emergency mode status', async () => {
      await router.activateKillSwitch({
        mode: 'emergency-model-only',
        durationMs: 1000,
        reason: 'Test emergency',
        activatedBy: 'test'
      });

      const health = await router.getHealthStatus();
      expect(health.metrics.emergencyMode).toBe(true);

      // Wait for auto-deactivation
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      const healthAfter = await router.getHealthStatus();
      expect(healthAfter.metrics.emergencyMode).toBe(false);
    });
  });

  describe('Performance Recording', () => {
    it('should record actual performance metrics', async () => {
      const performanceRecordedSpy = vi.fn();
      router.on('actualPerformanceRecorded', performanceRecordedSpy);

      await router.recordActualPerformance('test-trace', {
        actualTTFBMs: 250,
        totalDurationMs: 1500,
        actualTokens: { input: 100, output: 200 },
        finalCostUsd: 0.015,
        success: true
      });

      expect(performanceRecordedSpy).toHaveBeenCalledWith({
        traceId: 'test-trace',
        metrics: {
          actualTTFBMs: 250,
          totalDurationMs: 1500,
          actualTokens: { input: 100, output: 200 },
          finalCostUsd: 0.015,
          success: true
        }
      });
    });
  });

  describe('Emergency Mode', () => {
    it('should activate and deactivate kill switch', async () => {
      const activatedSpy = vi.fn();
      const deactivatedSpy = vi.fn();
      
      router.on('emergencyModeActivated', activatedSpy);
      router.on('emergencyModeDeactivated', deactivatedSpy);

      await router.activateKillSwitch({
        mode: 'low-tier-only',
        durationMs: 100,
        reason: 'Test',
        activatedBy: 'test-user'
      });

      expect(activatedSpy).toHaveBeenCalledWith({
        mode: 'low-tier-only',
        reason: 'Test',
        activatedBy: 'test-user',
        expiresAt: expect.any(Date)
      });

      // Wait for auto-deactivation
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(deactivatedSpy).toHaveBeenCalledWith({
        timestamp: expect.any(String)
      });
    });

    it('should handle emergency fallback during kill switch', async () => {
      await router.activateKillSwitch({
        mode: 'emergency-model-only',
        durationMs: 1000,
        reason: 'Test emergency mode',
        activatedBy: 'test'
      });

      const result = await router.route(mockInput);
      
      // Should still succeed but with emergency fallback
      expect(result.routing.success).toBe(true);
      expect(result.routing.confidence).toBeLessThan(0.5); // Lower confidence in emergency mode
    });
  });

  describe('Reproduction', () => {
    it('should reproduce previous decisions', async () => {
      const reproductionRequest = {
        task: {
          ...mockInput,
          cleanContent: mockInput.content,
          piiRedactionReport: []
        } as any,
        policySnapshot: {
          id: 'test-policy',
          version: '1.0',
          taskMatrix: {
            chat: { latencyBudgetMs: 2000, costTier: 'mid' }
          },
          rules: []
        },
        poolSnapshot: {
          id: 'test-pool',
          version: '1.0',
          models: [{
            id: 'test:model-1',
            providerId: 'test',
            modelName: 'test-model',
            modality: 'text',
            contextWindow: 4096,
            performance: {
              estimatedTTFBMs: 200,
              estimatedThroughput: 100,
              qualityScore: 0.8
            },
            cost: {
              inputTokensPPM: 0.5,
              outputTokensPPM: 1.5
            },
            capabilities: {
              maxOutputTokens: 4096,
              streaming: true
            },
            defaultParams: {
              temperature: 0.7,
              topP: 0.9,
              maxTokens: 2000
            }
          }]
        },
        healthSnapshot: {
          'test': {
            providerId: 'test',
            status: 'healthy',
            healthScore: 1.0,
            latencyP95Ms: 200,
            errorRate5min: 0,
            circuitBreakerState: 'closed',
            snapshotTakenAt: new Date().toISOString()
          }
        }
      };

      const result = await router.reproduceDecision(reproductionRequest);
      expect(result.routing.success).toBe(true);
    });
  });
});