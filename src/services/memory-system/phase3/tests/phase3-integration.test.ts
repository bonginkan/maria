/**
 * MARIA Memory System - Phase 3 Integration Tests
 * 
 * Comprehensive tests for Knowledge Graph and Event-Driven Architecture
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { KnowledgeGraphEngine } from '../knowledge-graph-engine';
import { EventDrivenMemorySystem } from '../event-driven-memory';
import { GraphVisualizer } from '../graph-visualizer';
import { DualMemoryEngine } from '../../dual-memory-engine';
import { MemoryEvent, MemoryEventType } from '../../types/memory-interfaces';

describe('Phase 3: Knowledge Graph and Event-Driven System', () => {
  let graphEngine: KnowledgeGraphEngine;
  let eventSystem: EventDrivenMemorySystem;
  let visualizer: GraphVisualizer;
  let memoryEngine: DualMemoryEngine;

  beforeEach(() => {
    // Initialize components
    graphEngine = new KnowledgeGraphEngine();
    memoryEngine = new DualMemoryEngine();
    eventSystem = new EventDrivenMemorySystem(memoryEngine, graphEngine);
    visualizer = new GraphVisualizer(graphEngine);
  });

  afterEach(() => {
    eventSystem.stop();
  });

  describe('Knowledge Graph Engine', () => {
    it('should extract entities from code', async () => {
      const code = `
        class UserService extends BaseService {
          async getUser(id: string): Promise<User> {
            const user = await this.db.findOne(id);
            return user;
          }
          
          async updateUser(id: string, data: Partial<User>): Promise<void> {
            await this.db.update(id, data);
          }
        }
        
        function validateUser(user: User): boolean {
          return user.email && user.name;
        }
      `;

      const result = await graphEngine.extractEntities(code);

      expect(result.entities).toHaveLength(4); // UserService, getUser, updateUser, validateUser
      expect(result.entities.some(e => e.text === 'UserService' && e.type === 'code_class')).toBe(true);
      expect(result.entities.some(e => e.text === 'getUser' && e.type === 'code_function')).toBe(true);
      expect(result.entities.some(e => e.text === 'updateUser' && e.type === 'code_function')).toBe(true);
      expect(result.entities.some(e => e.text === 'validateUser' && e.type === 'code_function')).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should detect relationships between entities', async () => {
      const code = `
        class Animal {}
        class Dog extends Animal {}
        class Cat extends Animal {}
      `;

      const result = await graphEngine.extractEntities(code);

      expect(result.relationships.some(r => 
        r.type === 'extends' && 
        result.entities.find(e => e.id === r.sourceEntityId)?.text === 'Dog' &&
        result.entities.find(e => e.id === r.targetEntityId)?.text === 'Animal'
      )).toBe(true);

      expect(result.relationships.some(r => 
        r.type === 'extends' && 
        result.entities.find(e => e.id === r.sourceEntityId)?.text === 'Cat' &&
        result.entities.find(e => e.id === r.targetEntityId)?.text === 'Animal'
      )).toBe(true);
    });

    it('should add entities to graph and update statistics', async () => {
      const extraction = {
        entities: [
          {
            id: 'entity_1',
            text: 'TestFunction',
            type: 'code_function' as const,
            position: { start: 0, end: 10 },
            attributes: new Map(),
            embedding: new Array(384).fill(0.5)
          }
        ],
        relationships: [],
        confidence: 0.8
      };

      await graphEngine.addToGraph(extraction);
      const stats = graphEngine.getStatistics();

      expect(stats.totalNodes).toBe(1);
      expect(stats.totalEdges).toBe(0);
      expect(stats.nodeTypes['function']).toBe(1);
    });

    it('should perform semantic search', async () => {
      // Add some test data
      const code1 = 'function calculateTax(amount: number): number { return amount * 0.1; }';
      const code2 = 'function computeTaxAmount(value: number): number { return value * 0.1; }';
      const code3 = 'class UserProfile { name: string; email: string; }';

      await graphEngine.addToGraph(await graphEngine.extractEntities(code1));
      await graphEngine.addToGraph(await graphEngine.extractEntities(code2));
      await graphEngine.addToGraph(await graphEngine.extractEntities(code3));

      // Search for tax-related functions
      const results = await graphEngine.search({
        query: 'tax calculation',
        topK: 3,
        minSimilarity: 0.3
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].node.name).toMatch(/tax|Tax/i);
    });

    it('should find shortest path between nodes', async () => {
      // Create a simple graph
      const extraction = await graphEngine.extractEntities(`
        class A {}
        class B extends A {}
        class C extends B {}
      `);

      await graphEngine.addToGraph(extraction);

      const nodeA = extraction.entities.find(e => e.text === 'A');
      const nodeC = extraction.entities.find(e => e.text === 'C');

      if (nodeA && nodeC) {
        const path = graphEngine.findPath(nodeA.id, nodeC.id);
        expect(path).toBeTruthy();
        expect(path?.length).toBeGreaterThanOrEqual(2);
      }
    });
  });

  describe('Event-Driven Memory System', () => {
    it('should process events and update memory', async () => {
      const event: MemoryEvent = {
        id: 'event_1',
        type: 'code_generation',
        timestamp: new Date(),
        userId: 'user123',
        sessionId: 'session123',
        data: 'function add(a: number, b: number): number { return a + b; }',
        metadata: {
          confidence: 0.9,
          source: 'user_input',
          priority: 'high',
          tags: ['math', 'function']
        }
      };

      await eventSystem.submitEvent(event);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 1500));

      const stats = eventSystem.getStatistics();
      expect(stats.totalEvents).toBe(1);
      expect(stats.eventsByType.get('code_generation')).toBe(1);
    });

    it('should handle event priorities correctly', async () => {
      const criticalEvent: MemoryEvent = {
        id: 'critical_1',
        type: 'bug_fix',
        timestamp: new Date(),
        userId: 'user123',
        sessionId: 'session123',
        data: { bug: 'critical error', fix: 'applied patch' },
        metadata: {
          confidence: 0.95,
          source: 'ai_generated',
          priority: 'critical',
          tags: ['bug', 'critical']
        }
      };

      const lowEvent: MemoryEvent = {
        id: 'low_1',
        type: 'team_interaction',
        timestamp: new Date(),
        userId: 'user123',
        sessionId: 'session123',
        data: 'team message',
        metadata: {
          confidence: 0.6,
          source: 'user_input',
          priority: 'low',
          tags: ['team']
        }
      };

      await eventSystem.submitEvent(lowEvent);
      await eventSystem.submitEvent(criticalEvent);

      // Critical events should be processed immediately
      await new Promise(resolve => setTimeout(resolve, 100));

      const stats = eventSystem.getStatistics();
      expect(stats.totalEvents).toBe(2);
    });

    it('should create event streams with filtering', async () => {
      const stream = eventSystem.createEventStream({
        filter: event => event.type === 'code_generation',
        bufferSize: 2
      });

      const receivedBatches: MemoryEvent[][] = [];
      stream.on('batch', batch => receivedBatches.push(batch));

      // Submit events
      for (let i = 0; i < 4; i++) {
        await eventSystem.submitEvent({
          id: `event_${i}`,
          type: i % 2 === 0 ? 'code_generation' : 'bug_fix',
          timestamp: new Date(),
          userId: 'user123',
          sessionId: 'session123',
          data: `data_${i}`,
          metadata: {
            confidence: 0.8,
            source: 'user_input',
            priority: 'medium',
            tags: []
          }
        });
      }

      // Wait for batch processing
      await new Promise(resolve => setTimeout(resolve, 100));
      stream.flush();

      expect(receivedBatches.length).toBe(1);
      expect(receivedBatches[0].length).toBe(2);
      expect(receivedBatches[0].every(e => e.type === 'code_generation')).toBe(true);
    });

    it('should detect patterns in event sequences', async () => {
      const sessionId = 'pattern_session';
      
      // Submit similar events in quick succession
      for (let i = 0; i < 4; i++) {
        await eventSystem.submitEvent({
          id: `pattern_${i}`,
          type: 'bug_fix',
          timestamp: new Date(),
          userId: 'user123',
          sessionId,
          data: `bug fix ${i}`,
          metadata: {
            confidence: 0.8,
            source: 'user_input',
            priority: 'medium',
            tags: ['bug']
          }
        });
      }

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Pattern detection should trigger learning
      const stats = eventSystem.getStatistics();
      expect(stats.totalEvents).toBe(4);
    });
  });

  describe('Graph Visualizer', () => {
    beforeEach(async () => {
      // Add test data to graph
      const code = `
        class Component {
          render(): void {}
        }
        
        class Button extends Component {
          onClick(): void {}
        }
        
        class Input extends Component {
          onChange(): void {}
        }
        
        function createButton(): Button {
          return new Button();
        }
      `;

      const extraction = await graphEngine.extractEntities(code);
      await graphEngine.addToGraph(extraction);
    });

    it('should generate tree visualization', () => {
      const visualization = visualizer.visualize({
        format: 'tree',
        maxDepth: 2,
        colorize: false
      });

      expect(visualization).toContain('Knowledge Graph - Tree View');
      expect(visualization).toContain('Component');
      expect(visualization).toContain('Button');
      expect(visualization).toContain('Input');
    });

    it('should generate matrix visualization', () => {
      const visualization = visualizer.visualize({
        format: 'matrix',
        maxNodes: 10
      });

      expect(visualization).toContain('Knowledge Graph - Matrix View');
      expect(visualization).toContain('│');
      expect(visualization).toContain('─');
    });

    it('should generate list visualization', () => {
      const visualization = visualizer.visualize({
        format: 'list',
        showMetadata: true
      });

      expect(visualization).toContain('Knowledge Graph - List View');
      expect(visualization).toContain('CLASS');
      expect(visualization).toContain('FUNCTION');
      expect(visualization).toContain('connections');
    });

    it('should generate summary visualization', () => {
      const visualization = visualizer.visualize({
        format: 'summary'
      });

      expect(visualization).toContain('Knowledge Graph - Summary');
      expect(visualization).toContain('OVERVIEW');
      expect(visualization).toContain('Total Nodes:');
      expect(visualization).toContain('NODE DISTRIBUTION');
      expect(visualization).toContain('EDGE DISTRIBUTION');
    });

    it('should apply filters correctly', () => {
      const visualization = visualizer.visualize({
        format: 'list',
        filter: {
          nodeTypes: ['class'],
          minConfidence: 0.5
        }
      });

      expect(visualization).toContain('CLASS');
      expect(visualization).not.toContain('FUNCTION');
    });
  });

  describe('Integration: Event Processing with Graph Updates', () => {
    it('should update graph when processing code generation events', async () => {
      const initialStats = graphEngine.getStatistics();
      
      const codeEvent: MemoryEvent = {
        id: 'code_event_1',
        type: 'code_generation',
        timestamp: new Date(),
        userId: 'user123',
        sessionId: 'session123',
        data: `
          class DataProcessor {
            async process(data: any[]): Promise<void> {
              for (const item of data) {
                await this.processItem(item);
              }
            }
            
            private async processItem(item: any): Promise<void> {
              // Process item
            }
          }
        `,
        metadata: {
          confidence: 0.85,
          source: 'ai_generated',
          priority: 'medium',
          tags: ['async', 'data-processing']
        }
      };

      await eventSystem.submitEvent(codeEvent);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      const finalStats = graphEngine.getStatistics();
      expect(finalStats.totalNodes).toBeGreaterThan(initialStats.totalNodes);
      expect(finalStats.nodeTypes['class']).toBeGreaterThanOrEqual(1);
      expect(finalStats.nodeTypes['function']).toBeGreaterThanOrEqual(2);
    });

    it('should handle concurrent events correctly', async () => {
      const events: MemoryEvent[] = [];
      
      for (let i = 0; i < 10; i++) {
        events.push({
          id: `concurrent_${i}`,
          type: i % 2 === 0 ? 'code_generation' : 'bug_fix',
          timestamp: new Date(),
          userId: 'user123',
          sessionId: 'session123',
          data: `data_${i}`,
          metadata: {
            confidence: Math.random(),
            source: 'user_input',
            priority: i < 5 ? 'high' : 'low',
            tags: [`tag_${i}`]
          }
        });
      }

      // Submit all events concurrently
      await Promise.all(events.map(e => eventSystem.submitEvent(e)));

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 3000));

      const stats = eventSystem.getStatistics();
      expect(stats.totalEvents).toBe(10);
      expect(stats.successRate).toBeGreaterThan(0.8);
    });

    it('should generate comprehensive visualization after processing', async () => {
      // Add various types of code
      const codeSnippets = [
        'class UserManager { getUser(id: string): User {} }',
        'interface User { id: string; name: string; }',
        'function validateEmail(email: string): boolean { return true; }',
        'const API_KEY = "secret123";',
        'export default class App extends Component {}'
      ];

      for (const code of codeSnippets) {
        await eventSystem.submitEvent({
          id: `viz_${Date.now()}`,
          type: 'code_generation',
          timestamp: new Date(),
          userId: 'user123',
          sessionId: 'session123',
          data: code,
          metadata: {
            confidence: 0.8,
            source: 'user_input',
            priority: 'medium',
            tags: []
          }
        });
      }

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Generate all visualization formats
      const treeViz = visualizer.visualize({ format: 'tree' });
      const summaryViz = visualizer.visualize({ format: 'summary' });

      expect(treeViz).toBeTruthy();
      expect(summaryViz).toContain('Total Nodes:');
      expect(summaryViz).toContain('Graph Density:');
    });
  });
});

describe('Phase 3: Performance Tests', () => {
  let graphEngine: KnowledgeGraphEngine;
  let eventSystem: EventDrivenMemorySystem;
  let memoryEngine: DualMemoryEngine;

  beforeEach(() => {
    graphEngine = new KnowledgeGraphEngine();
    memoryEngine = new DualMemoryEngine();
    eventSystem = new EventDrivenMemorySystem(memoryEngine, graphEngine, {
      batchSize: 20,
      processingInterval: 500
    });
  });

  afterEach(() => {
    eventSystem.stop();
  });

  it('should handle large-scale entity extraction efficiently', async () => {
    const startTime = Date.now();
    
    // Generate large code sample
    const largeCo
de = Array(100).fill(0).map((_, i) => `
      class Service${i} {
        method1(): void {}
        method2(): void {}
        method3(): void {}
      }
    `).join('\n');

    const result = await graphEngine.extractEntities(largeCode);
    const extractionTime = Date.now() - startTime;

    expect(result.entities.length).toBeGreaterThan(300);
    expect(extractionTime).toBeLessThan(5000); // Should complete within 5 seconds
  });

  it('should process high-volume events efficiently', async () => {
    const eventCount = 100;
    const startTime = Date.now();

    // Submit many events
    const promises = [];
    for (let i = 0; i < eventCount; i++) {
      promises.push(eventSystem.submitEvent({
        id: `perf_${i}`,
        type: 'code_generation',
        timestamp: new Date(),
        userId: 'user123',
        sessionId: 'session123',
        data: `function test${i}() { return ${i}; }`,
        metadata: {
          confidence: 0.8,
          source: 'user_input',
          priority: 'medium',
          tags: []
        }
      }));
    }

    await Promise.all(promises);

    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 10000));

    const processingTime = Date.now() - startTime;
    const stats = eventSystem.getStatistics();

    expect(stats.totalEvents).toBe(eventCount);
    expect(processingTime).toBeLessThan(15000); // Should complete within 15 seconds
    expect(stats.averageProcessingTime).toBeLessThan(1000); // Avg processing < 1 second
  });
});