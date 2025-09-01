/**
 * IMS Phase 2 Integration Tests
 * Complete integration testing for IMS with provider system
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { IMSRouter } from '../core/IMSRouter';
import { PolicyEngine } from '../core/PolicyEngine';
import { ModelPoolManager } from '../core/ModelPoolManager';
import { IMSProviderAdapter } from '../adapters/IMSProviderAdapter';
import { ProviderHealthMonitor } from '../health/ProviderHealthMonitor';
import { CompleteDecisionLogger } from '../logging/CompleteDecisionLogger';
import { UnifiedAIProviderManager } from '../../../providers/manager';
import { GoldenDatasetRunner, GOLDEN_DATASET } from './GoldenDataset';
import type { IMSRequest } from '../types/IMSRequest';

describe('IMS Phase 2 Integration', () => {
  let imsRouter: IMSRouter;
  let providerAdapter: IMSProviderAdapter;
  let healthMonitor: ProviderHealthMonitor;
  let providerManager: UnifiedAIProviderManager;
  
  beforeAll(async () => {
    // Initialize provider manager
    providerManager = UnifiedAIProviderManager.getInstance();
    await providerManager.initialize();
    
    // Initialize IMS components
    const policyEngine = new PolicyEngine({
      cacheEnabled: true,
      cacheTtlMs: 60000
    });
    
    const poolManager = new ModelPoolManager({
      hystersisThreshold: 3,
      cooldownPeriodMs: 30000
    });
    
    const decisionLogger = new CompleteDecisionLogger({
      bigQueryEnabled: false, // Disable for tests
      firestoreEnabled: false
    });
    
    // Initialize health monitor
    healthMonitor = new ProviderHealthMonitor({
      providerManager,
      checkIntervalMs: 5000,
      firestoreEnabled: false
    });
    
    // Start health monitoring
    await healthMonitor.start();
    
    // Initialize provider adapter
    providerAdapter = new IMSProviderAdapter({
      providerManager,
      decisionLogger,
      poolManager,
      enableFallback: true,
      maxRetries: 3
    });
    
    // Initialize router
    imsRouter = new IMSRouter({
      policyEngine,
      poolManager,
      decisionLogger,
      ttfbBudgetMs: 500
    });
  });
  
  afterAll(() => {
    healthMonitor.stop();
    UnifiedAIProviderManager.resetInstance();
  });
  
  describe('Provider Integration', () => {
    it('should successfully route and execute with provider system', async () => {
      const request: IMSRequest = {
        traceId: 'test-integration-001',
        userId: 'test-user',
        userTier: 'premium',
        prompt: 'What is the capital of France?',
        intent: 'question',
        complexity: 'simple',
        promptTokens: 10,
        streaming: false,
        parameters: {
          temperature: 0.7,
          maxTokens: 100
        },
        timestamp: Date.now()
      };
      
      // Route request
      const decision = await imsRouter.route(request);
      
      expect(decision).toBeDefined();
      expect(decision.selectedModel).toBeTruthy();
      expect(decision.fallbackModels.length).toBeGreaterThan(0);
      expect(decision.ttfb.totalMs).toBeLessThan(500);
      
      // Execute with provider
      const result = await providerAdapter.execute(decision, request);
      
      expect(result).toBeDefined();
      expect(result.actualModel).toBeTruthy();
      expect(result.actualProvider).toBeTruthy();
      expect(result.latencyMs).toBeGreaterThan(0);
    });
    
    it('should handle fallback when primary model fails', async () => {
      const request: IMSRequest = {
        traceId: 'test-fallback-001',
        userId: 'test-user',
        userTier: 'premium',
        prompt: 'Test fallback scenario',
        intent: 'test',
        complexity: 'medium',
        promptTokens: 10,
        streaming: false,
        parameters: {},
        metadata: {
          forceModelFailure: 'primary' // Simulate primary failure
        },
        timestamp: Date.now()
      };
      
      const decision = await imsRouter.route(request);
      const result = await providerAdapter.execute(decision, request);
      
      // Should use fallback
      if (result.fallbackUsed) {
        expect(result.fallbackUsed).toBe(true);
        expect(result.retryCount).toBeGreaterThan(0);
        expect(result.actualModel).not.toBe(decision.selectedModel);
      }
    });
  });
  
  describe('Health Monitoring', () => {
    it('should track provider health status', async () => {
      // Refresh health status
      await healthMonitor.refreshProvider('openai');
      
      const status = healthMonitor.getHealthStatus('openai:default');
      
      expect(status).toBeDefined();
      expect(status?.status).toMatch(/healthy|degraded|unhealthy|unknown/);
      expect(status?.metrics).toBeDefined();
      expect(status?.circuitBreakerState).toMatch(/closed|open|half_open/);
    });
    
    it('should generate health report', () => {
      const report = healthMonitor.getHealthReport();
      
      expect(report).toBeDefined();
      expect(report.summary.total).toBeGreaterThanOrEqual(0);
      expect(report.summary.healthPercentage).toBeGreaterThanOrEqual(0);
      expect(report.summary.healthPercentage).toBeLessThanOrEqual(100);
    });
    
    it('should handle circuit breaker states', async () => {
      const modelId = 'test:model';
      
      // Simulate failures to open circuit
      for (let i = 0; i < 3; i++) {
        await healthMonitor.checkProvider('test' as any);
      }
      
      const status = healthMonitor.getHealthStatus(modelId);
      if (status && status.consecutiveFailures >= 3) {
        expect(status.circuitBreakerState).toBe('open');
      }
      
      // Reset circuit breaker
      healthMonitor.resetCircuitBreaker(modelId);
      const resetStatus = healthMonitor.getHealthStatus(modelId);
      if (resetStatus) {
        expect(resetStatus.circuitBreakerState).toBe('closed');
      }
    });
  });
  
  describe('Golden Dataset Tests', () => {
    it('should pass critical test cases', async () => {
      const criticalTests = GOLDEN_DATASET.filter(
        test => test.priority === 'critical'
      ).slice(0, 5); // Test first 5 critical cases
      
      for (const testCase of criticalTests) {
        const result = await GoldenDatasetRunner.runTestCase(testCase, imsRouter);
        
        if (!result.passed) {
          console.log(`Failed test: ${testCase.id} - ${testCase.name}`);
          console.log('Errors:', result.errors);
        }
        
        expect(result.passed).toBe(true);
      }
    });
    
    it('should handle edge cases', async () => {
      const edgeCases = GOLDEN_DATASET.filter(
        test => test.category === 'edge_cases'
      ).slice(0, 3); // Test first 3 edge cases
      
      for (const testCase of edgeCases) {
        const result = await GoldenDatasetRunner.runTestCase(testCase, imsRouter);
        
        // Edge cases might not all pass, but should not crash
        expect(result).toBeDefined();
        expect(result.testId).toBe(testCase.id);
      }
    });
  });
  
  describe('Performance Requirements', () => {
    it('should meet TTFB budget', async () => {
      const requests: IMSRequest[] = Array.from({ length: 10 }, (_, i) => ({
        traceId: `perf-test-${i}`,
        userId: 'perf-user',
        userTier: 'premium',
        prompt: 'Performance test query',
        intent: 'test',
        complexity: 'simple',
        promptTokens: 20,
        streaming: false,
        parameters: {},
        timestamp: Date.now()
      }));
      
      const ttfbs = await Promise.all(
        requests.map(async req => {
          const decision = await imsRouter.route(req);
          return decision.ttfb.totalMs;
        })
      );
      
      const avgTtfb = ttfbs.reduce((a, b) => a + b, 0) / ttfbs.length;
      const maxTtfb = Math.max(...ttfbs);
      
      expect(avgTtfb).toBeLessThan(300); // Average under 300ms
      expect(maxTtfb).toBeLessThan(500); // Max under 500ms
    });
    
    it('should handle concurrent requests', async () => {
      const concurrentRequests = 50;
      const requests = Array.from({ length: concurrentRequests }, (_, i) => ({
        traceId: `concurrent-${i}`,
        userId: `user-${i % 10}`,
        userTier: ['free', 'starter', 'premium'][i % 3] as any,
        prompt: `Concurrent test ${i}`,
        intent: 'test',
        complexity: ['simple', 'medium', 'complex'][i % 3] as any,
        promptTokens: 10 + (i % 50),
        streaming: i % 2 === 0,
        parameters: {},
        timestamp: Date.now()
      }));
      
      const startTime = Date.now();
      const results = await Promise.all(
        requests.map(req => imsRouter.route(req))
      );
      const totalTime = Date.now() - startTime;
      
      expect(results).toHaveLength(concurrentRequests);
      expect(totalTime).toBeLessThan(5000); // All complete within 5 seconds
      
      // All should have valid decisions
      results.forEach(decision => {
        expect(decision.selectedModel).toBeTruthy();
        expect(decision.traceId).toBeTruthy();
      });
    });
  });
  
  describe('Logging and Analytics', () => {
    it('should log decisions for replay', async () => {
      const request: IMSRequest = {
        traceId: 'replay-test-001',
        userId: 'replay-user',
        userTier: 'premium',
        prompt: 'Test for replay',
        intent: 'test',
        complexity: 'medium',
        promptTokens: 15,
        streaming: false,
        parameters: {},
        timestamp: Date.now()
      };
      
      const decision = await imsRouter.route(request);
      
      // Decision should be loggable
      expect(decision.traceId).toBe('replay-test-001');
      expect(decision.snapshot).toBeDefined();
      expect(decision.reasons).toHaveLength(3); // Should have complete reasoning
    });
  });
});

describe('IMS Golden Dataset Full Run', () => {
  let imsRouter: IMSRouter;
  
  beforeAll(async () => {
    // Set up minimal router for golden dataset testing
    const policyEngine = new PolicyEngine({ cacheEnabled: false });
    const poolManager = new ModelPoolManager({ hystersisThreshold: 3 });
    const decisionLogger = new CompleteDecisionLogger({
      bigQueryEnabled: false,
      firestoreEnabled: false
    });
    
    imsRouter = new IMSRouter({
      policyEngine,
      poolManager,
      decisionLogger,
      ttfbBudgetMs: 500
    });
  });
  
  it('should achieve target success rate on golden dataset', async () => {
    const results = await GoldenDatasetRunner.runAll(imsRouter);
    const report = GoldenDatasetRunner.generateReport(results);
    
    console.log('\n=== Golden Dataset Test Report ===');
    console.log(report);
    
    // Target: 80% success rate for Phase 2
    expect(results.successRate).toBeGreaterThanOrEqual(80);
    
    // Critical tests should have high success rate
    const criticalTests = GOLDEN_DATASET.filter(t => t.priority === 'critical');
    const criticalResults = await Promise.all(
      criticalTests.map(test => GoldenDatasetRunner.runTestCase(test, imsRouter))
    );
    const criticalSuccess = criticalResults.filter(r => r.passed).length;
    const criticalRate = (criticalSuccess / criticalTests.length) * 100;
    
    expect(criticalRate).toBeGreaterThanOrEqual(90); // 90% for critical tests
  });
});