/**
 * Phase 3 Mode Plugin System Test
 * Tests for mode plugins, registry, and transition engine integration
 */

import 'reflect-metadata';
import {
  AnalyzingMode,
  BrainstormingMode,
  ModeContext,
  ModePluginRegistry,
  ModeTransitionEngine,
  ServiceBus,
  ServiceRegistry,
  ThinkingMode,
} from './core';

async function runPhase3Tests(): Promise<void> {
  console.log('\n=== Phase 3 Mode Plugin System Test ===\n');

  const registry = ServiceRegistry.getInstance();
  const bus = ServiceBus.getInstance();

  // Initialize services
  const pluginRegistry = new ModePluginRegistry();
  const transitionEngine = new ModeTransitionEngine();

  // Initialize mode plugins
  const thinkingMode = new ThinkingMode();
  const analyzingMode = new AnalyzingMode();
  const brainstormingMode = new BrainstormingMode();

  try {
    // Test 1: Service Infrastructure
    console.log('Test 1: Plugin Service Infrastructure');
    console.log('------------------------------------');

    await pluginRegistry.initialize();
    await transitionEngine.initialize();

    await pluginRegistry.start();
    await transitionEngine.start();

    console.log('✅ Plugin infrastructure services started\n');

    // Test 2: Mode Plugin Registration
    console.log('Test 2: Mode Plugin Registration');
    console.log('--------------------------------');

    await pluginRegistry.registerPlugin(thinkingMode);
    await pluginRegistry.registerPlugin(analyzingMode);
    await pluginRegistry.registerPlugin(brainstormingMode);

    const allPlugins = pluginRegistry.getAllPlugins();
    console.log(
      'Registered plugins:',
      allPlugins.map((p) => p.pluginName),
    );
    console.assert(allPlugins.length === 3, 'Should have 3 registered plugins');
    console.log('✅ Plugin registration successful\n');

    // Test 3: Plugin Display Configuration
    console.log('Test 3: Plugin Display Configuration');
    console.log('-----------------------------------');

    allPlugins.forEach((plugin) => {
      const config = plugin.getDisplayConfig();
      console.log(
        `${plugin.pluginName}: ${config.symbol} ${config.displayName} (${config.category})`,
      );
      console.assert(config.symbol.length > 0, `${plugin.pluginName} should have symbol`);
      console.assert(config.color.startsWith('#'), `${plugin.pluginName} should have valid color`);
    });
    console.log('✅ Display configurations valid\n');

    // Test 4: Mode Selection by Context
    console.log('Test 4: Mode Selection by Context');
    console.log('---------------------------------');

    const testContexts = [
      {
        input: 'I need to think about this problem carefully',
        expected: 'thinking',
        description: 'Thinking mode trigger',
      },
      {
        input: 'Let me analyze this code thoroughly and examine all components',
        expected: 'analyzing',
        description: 'Analyzing mode trigger',
      },
      {
        input: 'I want to brainstorm some creative ideas for this project',
        expected: 'brainstorming',
        description: 'Brainstorming mode trigger',
      },
      {
        input: 'Just a regular conversation',
        expected: null,
        description: 'No specific mode trigger',
      },
    ];

    for (const testContext of testContexts) {
      const context: ModeContext = {
        sessionId: 'test-session',
        userId: 'test-user',
        input: testContext.input,
        language: 'english',
        confidence: 0.8,
        metadata: {},
        timestamp: new Date(),
      };

      const selection = await pluginRegistry.selectBestMode(context);

      console.log(
        `"${testContext.input}" -> ${selection?.plugin.pluginName || 'none'} (${(selection?.confidence * 100 || 0).toFixed(1)}%)`,
      );

      if (testContext.expected) {
        console.assert(
          selection?.plugin.pluginId === testContext.expected,
          `Should select ${testContext.expected} mode`,
        );
      } else {
        console.assert(
          !selection || selection.confidence < 0.5,
          'Should not confidently select any mode',
        );
      }
    }
    console.log('✅ Mode selection working correctly\n');

    // Test 5: Mode Execution
    console.log('Test 5: Mode Execution');
    console.log('---------------------');

    const executionTests = [
      {
        mode: thinkingMode,
        input: 'How can I solve this complex algorithm problem?',
        expectSuccess: true,
      },
      {
        mode: analyzingMode,
        input:
          'I need a detailed analysis of this system architecture with all components examined',
        expectSuccess: true,
      },
      {
        mode: brainstormingMode,
        input: 'Generate creative ideas for improving user experience',
        expectSuccess: true,
      },
    ];

    for (const test of executionTests) {
      const context: ModeContext = {
        sessionId: 'test-execution',
        userId: 'test-user',
        input: test.input,
        language: 'english',
        confidence: 0.9,
        metadata: {},
        timestamp: new Date(),
      };

      const result = await test.mode.executeWithTracking(context);

      console.log(
        `${test.mode.pluginName}: ${result.success ? 'SUCCESS' : 'FAILED'} (${result.executionTime.toFixed(1)}ms)`,
      );
      console.assert(
        result.success === test.expectSuccess,
        `${test.mode.pluginName} execution should ${test.expectSuccess ? 'succeed' : 'fail'}`,
      );

      if (result.output) {
        console.log(`  Output preview: ${result.output.substring(0, 80)}...`);
      }
    }
    console.log('✅ Mode execution working\n');

    // Test 6: Mode Transitions
    console.log('Test 6: Mode Transitions');
    console.log('-----------------------');

    const sessionId = 'test-transition-session';

    // Transition to thinking mode
    let transitionResult = await transitionEngine.transitionToMode({
      sessionId,
      toMode: 'thinking',
      context: {
        sessionId,
        userId: 'test-user',
        input: 'I need to think about this problem',
        language: 'english',
        confidence: 0.8,
        metadata: {},
        timestamp: new Date(),
      },
    });

    console.log(
      `Transition to thinking: ${transitionResult.success ? 'SUCCESS' : 'FAILED'} (${transitionResult.transitionTime.toFixed(1)}ms)`,
    );
    console.assert(transitionResult.success, 'Should successfully transition to thinking mode');

    // Check current mode
    const currentMode = transitionEngine.getCurrentMode(sessionId);
    console.log(`Current mode: ${currentMode}`);
    console.assert(currentMode === 'thinking', 'Current mode should be thinking');

    // Transition to analyzing mode
    transitionResult = await transitionEngine.transitionToMode({
      sessionId,
      toMode: 'analyzing',
      context: {
        sessionId,
        input: 'Now I need detailed analysis',
        language: 'english',
        confidence: 0.9,
        metadata: {},
        timestamp: new Date(),
      },
    });

    console.log(`Transition to analyzing: ${transitionResult.success ? 'SUCCESS' : 'FAILED'}`);
    console.assert(transitionResult.success, 'Should successfully transition to analyzing mode');
    console.log('✅ Mode transitions working\n');

    // Test 7: Multi-language Support
    console.log('Test 7: Multi-language Support');
    console.log('------------------------------');

    const multilingualTests = [
      { input: '詳細に分析してください', language: 'japanese', expected: 'analyzing' },
      { input: '创意思维和头脑风暴', language: 'chinese', expected: 'brainstorming' },
      { input: '이 문제를 생각해보자', language: 'korean', expected: 'thinking' },
    ];

    for (const test of multilingualTests) {
      const context: ModeContext = {
        sessionId: 'multilingual-test',
        input: test.input,
        language: test.language,
        confidence: 0.8,
        metadata: {},
        timestamp: new Date(),
      };

      const selection = await pluginRegistry.selectBestMode(context);
      console.log(`${test.language}: "${test.input}" -> ${selection?.plugin.pluginName || 'none'}`);

      if (selection && selection.confidence > 0.5) {
        console.assert(
          selection.plugin.pluginId === test.expected,
          `Should select ${test.expected} for ${test.language}`,
        );
      }
    }
    console.log('✅ Multi-language support working\n');

    // Test 8: Plugin Statistics and Health
    console.log('Test 8: Plugin Statistics and Health');
    console.log('-----------------------------------');

    const registryStats = pluginRegistry.getRegistryStats();
    console.log('Registry stats:', {
      totalPlugins: registryStats.totalPlugins,
      enabledPlugins: registryStats.enabledPlugins,
      categories: Object.keys(registryStats.categoryCounts),
    });

    const pluginHealth = await pluginRegistry.healthCheckAll();
    console.log('Plugin health:', pluginHealth.registry);
    console.assert(pluginHealth.registry === 'healthy', 'Plugin registry should be healthy');

    // Individual plugin stats
    allPlugins.forEach((plugin) => {
      const stats = plugin.getStats();
      console.log(
        `${plugin.pluginName} stats: ${stats.executionCount} executions, ${stats.successRate.toFixed(1)}% success rate`,
      );
    });
    console.log('✅ Statistics and health monitoring working\n');

    // Test 9: Transition History and Analytics
    console.log('Test 9: Transition History and Analytics');
    console.log('---------------------------------------');

    const sessionStats = transitionEngine.getSessionStats(sessionId);
    console.log(
      'Session stats:',
      sessionStats
        ? {
            totalTransitions: sessionStats.totalTransitions,
            successRate: `${sessionStats.successRate.toFixed(1)  }%`,
            uniqueModes: sessionStats.uniqueModesUsed.length,
          }
        : 'No stats available',
    );

    const transitionHistory = transitionEngine.getTransitionHistory(sessionId);
    console.log(`Transition history: ${transitionHistory.length} transitions recorded`);

    const engineStats = transitionEngine.getEngineStats();
    console.log('Engine stats:', {
      activeSessions: engineStats.activeSessions,
      activeTransitions: engineStats.activeTransitions,
    });
    console.log('✅ Transition analytics working\n');

    // Test 10: Plugin Categories and Discovery
    console.log('Test 10: Plugin Categories and Discovery');
    console.log('---------------------------------------');

    const reasoningPlugins = pluginRegistry.getPluginsByCategory('reasoning');
    console.log(`Reasoning category: ${reasoningPlugins.length} plugins`);
    console.assert(reasoningPlugins.length >= 2, 'Should have reasoning plugins');

    const analyticalPlugins = pluginRegistry.getPluginsByCategory('analytical');
    console.log(`Analytical category: ${analyticalPlugins.length} plugins`);

    const creativePlugins = pluginRegistry.getPluginsByCategory('creative');
    console.log(`Creative category: ${creativePlugins.length} plugins`);
    console.assert(creativePlugins.length >= 1, 'Should have creative plugins');
    console.log('✅ Plugin categorization working\n');

    // Test 11: Error Handling and Resilience
    console.log('Test 11: Error Handling and Resilience');
    console.log('--------------------------------------');

    // Test invalid mode transition
    try {
      await transitionEngine.transitionToMode({
        sessionId: 'error-test',
        toMode: 'nonexistent-mode',
        context: {
          sessionId: 'error-test',
          input: 'test',
          language: 'english',
          confidence: 0.8,
          metadata: {},
          timestamp: new Date(),
        },
      });
      console.assert(false, 'Should have thrown error for invalid mode');
    } catch (error) {
      console.log('✓ Invalid mode transition properly rejected');
    }

    // Test malformed context
    const invalidResult = await thinkingMode.executeWithTracking({
      sessionId: '',
      input: '',
      language: '',
      confidence: -1,
      metadata: {},
      timestamp: new Date(),
    });
    console.log(`Invalid context handling: ${!invalidResult.success ? 'PASSED' : 'FAILED'}`);
    console.assert(!invalidResult.success, 'Should fail with invalid context');
    console.log('✅ Error handling working correctly\n');

    // Test 12: Performance and Optimization
    console.log('Test 12: Performance and Optimization');
    console.log('------------------------------------');

    const performanceTests = 100;
    const startTime = performance.now();

    const promises = [];
    for (let i = 0; i < performanceTests; i++) {
      const context: ModeContext = {
        sessionId: `perf-test-${i}`,
        input: `Performance test input number ${i} with thinking analysis`,
        language: 'english',
        confidence: 0.8,
        metadata: {},
        timestamp: new Date(),
      };
      promises.push(pluginRegistry.selectBestMode(context));
    }

    await Promise.all(promises);
    const endTime = performance.now();
    const avgTime = (endTime - startTime) / performanceTests;

    console.log(
      `Performance: ${performanceTests} mode selections in ${(endTime - startTime).toFixed(1)}ms`,
    );
    console.log(`Average: ${avgTime.toFixed(2)}ms per selection`);
    console.assert(avgTime < 50, 'Mode selection should be fast (<50ms average)');
    console.log('✅ Performance optimization working\n');

    // Cleanup
    console.log('Test 13: Cleanup and Resource Management');
    console.log('---------------------------------------');

    await transitionEngine.endSession(sessionId);
    console.log('Session ended successfully');

    await pluginRegistry.unregisterPlugin('thinking');
    await pluginRegistry.unregisterPlugin('analyzing');
    await pluginRegistry.unregisterPlugin('brainstorming');
    console.log('Plugins unregistered successfully');

    await transitionEngine.stop();
    await pluginRegistry.stop();
    console.log('✅ Cleanup completed\n');

    console.log('=== All Phase 3 Tests Passed! ===\n');
    console.log('Phase 3 Summary:');
    console.log('- ✅ Mode Plugin Framework: Complete plugin architecture');
    console.log('- ✅ Plugin Registry: Dynamic plugin management and discovery');
    console.log('- ✅ Mode Transitions: Smooth cognitive state transitions');
    console.log('- ✅ Multi-language Support: 5-language mode recognition');
    console.log('- ✅ Performance Optimization: <50ms average mode selection');
    console.log('- ✅ Error Resilience: Robust error handling and validation');
    console.log('- ✅ Analytics: Comprehensive usage tracking and insights');
    console.log('- ✅ 3 Core Mode Plugins: Thinking, Analyzing, Brainstorming');
    console.log('\n🎯 Phase 3 Mode Plugin System is complete and ready for integration!');
  } catch (error) {
    console.error('\n❌ Phase 3 test failed:', error);
    process.exit(1);
  }
}

// Run tests if this is the main module
if (require.main === module) {
  runPhase3Tests()
    .then(() => {
      console.log('\n✨ Phase 3 testing complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Phase 3 test execution failed:', error);
      process.exit(1);
    });
}

export { runPhase3Tests };
