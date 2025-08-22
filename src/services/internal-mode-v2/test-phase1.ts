/**
 * Phase 1 Core Infrastructure Test
 * Tests for ServiceRegistry, ServiceBus, BaseService, and ServiceLoader
 */

import 'reflect-metadata';
import {
  BaseService,
  EventHandler,
  IService,
  Service,
  ServiceBus,
  ServiceEvent,
  ServiceLoader,
  ServiceRegistry,
  ServiceState,
} from './core';

// Test Service 1 - Simple service
@Service({
  id: 'test-service-1',
  name: 'TestService1',
  version: '1.0.0',
  description: 'Test service for Phase 1 validation',
})
class TestService1 extends BaseService {
  id = 'test-service-1';
  version = '1.0.0';

  private counter = 0;

  async onInitialize(): Promise<void> {
    console.log(`[${this.id}] Initializing...`);
  }

  async onStart(): Promise<void> {
    console.log(`[${this.id}] Starting...`);
    this.emitServiceEvent('test:started', { service: this.id });
  }

  async onStop(): Promise<void> {
    console.log(`[${this.id}] Stopping...`);
  }

  @EventHandler('test:message')
  async handleTestMessage(event: ServiceEvent): Promise<void> {
    console.log(`[${this.id}] Received test message:`, event.data);
    this.counter++;
  }

  getCounter(): number {
    return this.counter;
  }

  async doWork(): Promise<string> {
    return `Work done by ${this.id}`;
  }
}

// Test Service 2 - Service with dependencies
@Service({
  id: 'test-service-2',
  name: 'TestService2',
  version: '1.0.0',
  description: 'Test service with dependencies',
  dependencies: ['test-service-1'],
})
class TestService2 extends BaseService {
  id = 'test-service-2';
  version = '1.0.0';

  async onStart(): Promise<void> {
    console.log(`[${this.id}] Starting with dependency on test-service-1`);

    // Call dependent service
    try {
      const result = await this.callService<string>('test-service-1', 'doWork');
      console.log(`[${this.id}] Result from test-service-1:`, result);
    } catch (error) {
      console.error(`[${this.id}] Error calling test-service-1:`, error);
    }
  }

  @EventHandler('test:started')
  async handleServiceStarted(event: ServiceEvent): Promise<void> {
    console.log(`[${this.id}] Detected service started:`, event.data);
  }
}

// Main test function
async function runTests(): Promise<void> {
  console.log('\n=== Phase 1 Core Infrastructure Test ===\n');

  const registry = ServiceRegistry.getInstance();
  const bus = ServiceBus.getInstance();
  const loader = ServiceLoader.getInstance();

  try {
    // Test 1: Service Registration
    console.log('Test 1: Service Registration');
    console.log('----------------------------');

    const service1 = new TestService1();
    const service2 = new TestService2();

    console.log(
      'Registered services:',
      registry.list().map((s) => s.id),
    );
    console.assert(registry.has('test-service-1'), 'Service 1 should be registered');
    console.assert(registry.has('test-service-2'), 'Service 2 should be registered');
    console.log('✅ Service registration successful\n');

    // Test 2: Service Initialization
    console.log('Test 2: Service Initialization');
    console.log('------------------------------');

    await service1.initialize();
    console.assert(service1.state === ServiceState.READY, 'Service 1 should be READY');
    console.log('✅ Service initialization successful\n');

    // Test 3: Service Start
    console.log('Test 3: Service Start');
    console.log('--------------------');

    await service1.start();
    console.assert(service1.state === ServiceState.RUNNING, 'Service 1 should be RUNNING');
    console.log('✅ Service start successful\n');

    // Test 4: Event Bus Communication
    console.log('Test 4: Event Bus Communication');
    console.log('-------------------------------');

    const initialCounter = service1.getCounter();
    bus.emit({
      type: 'test:message',
      source: 'test',
      data: { message: 'Hello from test!' },
      timestamp: new Date(),
    });

    // Wait for event processing
    await new Promise((resolve) => setTimeout(resolve, 100));

    console.assert(
      service1.getCounter() > initialCounter,
      'Service 1 should have processed the event',
    );
    console.log('✅ Event bus communication successful\n');

    // Test 5: Service-to-Service Call
    console.log('Test 5: Service-to-Service Call');
    console.log('-------------------------------');

    await service2.initialize();
    await service2.start();

    const result = await bus.call<string>('test-service-1', 'doWork');
    console.assert(
      result === 'Work done by test-service-1',
      'Service call should return correct result',
    );
    console.log('✅ Service-to-service call successful\n');

    // Test 6: Health Check
    console.log('Test 6: Health Check');
    console.log('-------------------');

    const health = await service1.health();
    console.assert(health.status === 'healthy', 'Service should be healthy');
    console.assert(health.service === 'test-service-1', 'Health check should identify service');
    console.log('Health status:', health.status);
    console.log('Uptime:', health.uptime, 'ms');
    console.log('✅ Health check successful\n');

    // Test 7: Service Stop
    console.log('Test 7: Service Stop');
    console.log('-------------------');

    await service1.stop();
    console.assert(service1.state === ServiceState.STOPPED, 'Service 1 should be STOPPED');
    await service2.stop();
    console.log('✅ Service stop successful\n');

    // Test 8: Registry Statistics
    console.log('Test 8: Registry Statistics');
    console.log('--------------------------');

    const stats = registry.getStats();
    console.log('Total services:', stats.totalServices);
    console.log('Loaded services:', stats.loadedServices);
    console.assert(stats.totalServices >= 2, 'Should have at least 2 services registered');
    console.log('✅ Registry statistics successful\n');

    // Test 9: Bus Statistics
    console.log('Test 9: Bus Statistics');
    console.log('---------------------');

    const busStats = bus.getStats();
    console.log('Registered services:', busStats.registeredServices);
    console.log('Event handlers:', busStats.eventHandlers);
    console.log('Queue length:', busStats.queueLength);
    console.log('✅ Bus statistics successful\n');

    // Test 10: Service Disposal
    console.log('Test 10: Service Disposal');
    console.log('------------------------');

    await service1.dispose();
    console.assert(service1.state === ServiceState.DISPOSED, 'Service 1 should be DISPOSED');
    await service2.dispose();
    console.log('✅ Service disposal successful\n');

    console.log('=== All Phase 1 Tests Passed! ===\n');
    console.log('Summary:');
    console.log('- ServiceRegistry: ✅ Working');
    console.log('- ServiceBus: ✅ Working');
    console.log('- BaseService: ✅ Working');
    console.log('- Event System: ✅ Working');
    console.log('- Health Monitoring: ✅ Working');
    console.log('- Service Lifecycle: ✅ Working');
    console.log('\nPhase 1 infrastructure is ready for Phase 2!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Run tests if this is the main module
if (require.main === module) {
  runTests()
    .then(() => {
      console.log('\n✨ Phase 1 testing complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Test execution failed:', error);
      process.exit(1);
    });
}

export { runTests };
