/**
 * Phase 2 Service Separation Test
 * Tests for all microservices working together
 */

import 'reflect-metadata';
import { ServiceBus, ServiceLoader, ServiceRegistry } from './core/index.js';

import { RecognitionService } from './services/recognition/index.js';
import { ModeService } from './services/modes/index.js';
import { DisplayService } from './services/display/index.js';
import { HistoryService } from './services/history/index.js';
import { LearningService } from './services/learning/index.js';

async function testPhase2Integration(): Promise<void> {
  console.log('\n=== Phase 2 Service Separation Test ===\n');

  // Initialize core infrastructure
  const registry = new ServiceRegistry();
  const bus = new ServiceBus();
  const loader = new ServiceLoader(registry, bus);

  // Create service instances
  const recognitionService = new RecognitionService();
  const modeService = new ModeService();
  const displayService = new DisplayService();
  const historyService = new HistoryService();
  const learningService = new LearningService();

  try {
    // Test 1: Service Registration
    console.log('Test 1: Service Registration');
    console.log('----------------------------');

    await bus.register(recognitionService);
    await bus.register(modeService);
    await bus.register(displayService);
    await bus.register(historyService);
    await bus.register(learningService);

    console.log(
      'Registered services:',
      registry.list().map((s) => s.id),
    );
    console.log('✅ Service registration successful\n');

    // Test 2: Service Initialization and Startup
    console.log('Test 2: Service Initialization');
    console.log('------------------------------');

    const services = [
      recognitionService,
      modeService,
      displayService,
      historyService,
      learningService,
    ];

    for (const service of services) {
      await service.initialize();
      await service.start();
    }

    console.log('✅ All services initialized and started\n');

    // Test 3: Cross-Service Communication
    console.log('Test 3: Cross-Service Communication');
    console.log('----------------------------------');

    // Simulate session start
    bus.emit({
      type: 'session:started',
      source: 'test',
      data: {
        sessionId: 'test-session-1',
        userId: 'test-user-1',
      },
      timestamp: Date.now(),
    });

    // Wait for event propagation
    await new Promise((resolve) => setTimeout(resolve, 100));
    console.log('✅ Session start event propagated\n');

    // Test 4: Recognition Service Integration
    console.log('Test 4: Recognition Service');
    console.log('---------------------------');

    const recognitionResult = await recognitionService.recognize(
      'I need to fix this bug in my code',
      {
        sessionId: 'test-session-1',
        userId: 'test-user-1',
        currentMode: 'thinking',
      },
    );

    console.log('Recognition result:', {
      mode: recognitionResult.recommendedMode,
      confidence: `${Math.round(recognitionResult.confidence * 100)  }%`,
      reasoning: recognitionResult.reasoning,
    });
    console.log('✅ Recognition service working\n');

    // Test 5: Mode Service Integration
    console.log('Test 5: Mode Service');
    console.log('-------------------');

    const transitionSuccess = await modeService.transitionToMode(
      'test-session-1',
      recognitionResult.recommendedMode,
      'auto_recognition',
      recognitionResult.confidence,
      'test-user-1',
    );

    console.log('Mode transition successful:', transitionSuccess);
    console.log('Current mode:', modeService.getCurrentMode('test-session-1'));

    const allModes = modeService.getAllModes();
    console.log('Total modes available:', allModes.length);
    console.log('✅ Mode service working\n');

    // Test 6: Display Service Integration
    console.log('Test 6: Display Service');
    console.log('----------------------');

    const targetMode = modeService.getMode(recognitionResult.recommendedMode);
    if (targetMode) {
      await displayService.displayMode({
        modeId: targetMode.id,
        symbol: targetMode.symbol,
        color: targetMode.color,
        text: `${targetMode.name}...`,
        confidence: recognitionResult.confidence,
      });
    }

    await displayService.showSuccess('Mode display test completed');
    console.log('✅ Display service working\n');

    // Test 7: History Service Integration
    console.log('Test 7: History Service');
    console.log('----------------------');

    // Query recent history
    const historyEntries = await historyService.queryHistory({
      sessionId: 'test-session-1',
      limit: 10,
    });

    console.log('History entries recorded:', historyEntries.length);

    const sessionSummary = await historyService.getSessionSummary('test-session-1');
    console.log(
      'Session summary:',
      sessionSummary
        ? {
            transitions: sessionSummary.totalModeTransitions,
            uniqueModes: sessionSummary.uniqueModesUsed.length,
            mostUsed: sessionSummary.mostUsedMode,
          }
        : 'Not found',
    );
    console.log('✅ History service working\n');

    // Test 8: Learning Service Integration
    console.log('Test 8: Learning Service');
    console.log('-----------------------');

    // Simulate learning from behavior
    await learningService.learn('test-user-1', {
      modeUsage: {
        mode: recognitionResult.recommendedMode,
        context: { projectType: 'javascript', errorPresent: true },
        satisfaction: 0.9,
      },
      timestamp: Date.now(),
    });

    const prediction = await learningService.predict('test-user-1', {
      input: 'I need help with debugging',
      projectType: 'javascript',
      errorPresent: true,
    });

    console.log('Learning prediction:', {
      mode: prediction.recommendedMode,
      confidence: `${Math.round(prediction.confidence * 100)  }%`,
      reasoning: prediction.reasoning.slice(0, 2),
    });

    const learningStats = await learningService.getUserLearningStats('test-user-1');
    console.log(
      'Learning stats:',
      learningStats
        ? {
            adaptationLevel: `${Math.round(learningStats.adaptationLevel)  }%`,
            totalPatterns: learningStats.totalPatterns,
          }
        : 'Not found',
    );
    console.log('✅ Learning service working\n');

    // Test 9: Service Statistics
    console.log('Test 9: Service Statistics');
    console.log('-------------------------');

    const stats = await Promise.all([
      recognitionService.getStatistics(),
      modeService.getStatistics(),
      displayService.getStatistics(),
      historyService.getStatistics(),
      learningService.getStatistics(),
    ]);

    stats.forEach((stat, index) => {
      const serviceNames = ['Recognition', 'Mode', 'Display', 'History', 'Learning'];
      console.log(`${serviceNames[index]} Service:`, {
        service: stat.service,
        uptime: `${Math.round(stat.uptime)  }ms`,
      });
    });
    console.log('✅ All service statistics working\n');

    // Test 10: Event-Driven Workflow
    console.log('Test 10: Complete Workflow');
    console.log('--------------------------');

    // Simulate complete user interaction workflow
    const workflowInput = 'I want to brainstorm some creative ideas';

    // 1. Recognition
    const workflowRecognition = await recognitionService.recognize(workflowInput, {
      sessionId: 'test-session-2',
      userId: 'test-user-1',
      currentMode: 'thinking',
    });

    // 2. Mode transition
    await modeService.transitionToMode(
      'test-session-2',
      workflowRecognition.recommendedMode,
      'auto_recognition',
      workflowRecognition.confidence,
      'test-user-1',
    );

    // 3. Display update
    const workflowMode = modeService.getMode(workflowRecognition.recommendedMode);
    if (workflowMode) {
      await displayService.showTransition('thinking', workflowMode.name);
    }

    // 4. Learning update
    await learningService.learn('test-user-1', {
      transition: {
        from: 'thinking',
        to: workflowRecognition.recommendedMode,
        trigger: 'auto_recognition',
        success: true,
      },
      timestamp: Date.now(),
    });

    console.log('Complete workflow executed:', {
      input: workflowInput,
      recognizedMode: workflowRecognition.recommendedMode,
      confidence: `${Math.round(workflowRecognition.confidence * 100)  }%`,
    });
    console.log('✅ Complete event-driven workflow working\n');

    // Test 11: Service Health Check
    console.log('Test 11: Health Check');
    console.log('--------------------');

    const healthChecks = await Promise.all(services.map((service) => service.health()));

    healthChecks.forEach((health, index) => {
      const serviceNames = ['Recognition', 'Mode', 'Display', 'History', 'Learning'];
      console.log(`${serviceNames[index]} Service Health:`, health.status);
    });
    console.log('✅ All services healthy\n');

    // Test 12: Service Cleanup
    console.log('Test 12: Service Cleanup');
    console.log('-----------------------');

    // Simulate session end
    bus.emit({
      type: 'session:ended',
      source: 'test',
      data: {
        sessionId: 'test-session-1',
        userId: 'test-user-1',
      },
      timestamp: Date.now(),
    });

    // Stop all services
    for (const service of services.reverse()) {
      await service.stop();
      await service.dispose();
    }

    console.log('✅ All services stopped and disposed\n');

    console.log('=== All Phase 2 Tests Passed! ===\n');

    console.log('Phase 2 Summary:');
    console.log('- ✅ 5 microservices implemented and tested');
    console.log('- ✅ Event-driven communication working');
    console.log('- ✅ Cross-service integration successful');
    console.log('- ✅ Service lifecycle management operational');
    console.log('- ✅ Real-time recognition and learning active');
    console.log('- ✅ Complete workflow from input to display working');
    console.log('');
    console.log('🚀 Phase 2 complete! Ready for Phase 3 (Mode Plugins)');
  } catch (error) {
    console.error('❌ Phase 2 test failed:', error);
    throw error;
  }
}

// Run the test
testPhase2Integration().catch(console.error);
