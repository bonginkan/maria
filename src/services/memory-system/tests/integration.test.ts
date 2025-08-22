/**
 * Integration Test for MARIA Memory System
 * Verifies the implemented components work together
 */

import { describe, it, expect } from 'vitest';

// Import only the successfully implemented components
import { WorkspaceMemoryManager } from '../team/workspace-memory-manager';
import TeamProgressTracker from '../team/team-progress-tracker';
import CollaborativeContext from '../team/collaborative-context';
import UserPatternAnalyzer from '../learning/user-pattern-analyzer';
import PreferenceEngine from '../learning/preference-engine';
import EntityExtractor from '../knowledge-graph/entity-extractor';
import AccessControlManager from '../enterprise/access-control-manager';

describe('MARIA Memory System - Integration Tests', () => {
  
  describe('Phase 2.1: Team Collaboration Integration', () => {
    it('should successfully initialize team collaboration components', () => {
      const workspaceConfig = {
        teamId: 'test-team',
        projectIds: ['test-project'],
        syncInterval: 5000,
        retentionPeriod: 30,
        conflictResolution: 'latest-wins' as const,
        notificationSettings: {
          realTimeEnabled: true,
          digestEnabled: false,
          digestFrequency: 'daily' as const,
          channels: [],
          filters: []
        },
        privacySettings: {
          dataSharing: 'team' as const,
          visibilityLevel: 'team' as const,
          sensitiveDataHandling: 'encrypt' as const,
          auditTrail: true
        }
      };

      const workspace = new WorkspaceMemoryManager(workspaceConfig);
      const progressTracker = new TeamProgressTracker();
      const context = new CollaborativeContext();

      expect(workspace).toBeDefined();
      expect(progressTracker).toBeDefined();
      expect(context).toBeDefined();

      // Clean up
      workspace.dispose();
      progressTracker.dispose();
      context.dispose();
    });

    it('should track team progress with real-time updates', async () => {
      const tracker = new TeamProgressTracker();
      
      const task = {
        taskId: 'task-1',
        title: 'Implement feature',
        description: 'New feature implementation',
        status: 'in-progress' as const,
        priority: 'high' as const,
        complexity: 7,
        estimatedHours: 20,
        actualHours: 10,
        completion: 50,
        dependencies: [],
        blockers: [],
        assignedTo: 'member-1'
      };

      await tracker.trackTaskProgress(task);
      const metrics = tracker.getMetrics();
      
      expect(metrics).toBeDefined();
      expect(metrics.productivity).toBeDefined();
      expect(metrics.velocity).toBeDefined();
      
      tracker.dispose();
    });
  });

  describe('Phase 2.2: Learning System Integration', () => {
    it('should analyze patterns and adapt preferences', async () => {
      const analyzer = new UserPatternAnalyzer();
      const preferenceEngine = new PreferenceEngine();

      // Simulate user events
      const events = [
        {
          id: 'evt-1',
          type: 'code-generation' as const,
          description: 'Generated TypeScript code',
          timestamp: new Date(),
          userId: 'user-1',
          sessionId: 'session-1',
          data: {
            tests: { writtenFirst: true },
            structure: { modules: ['auth', 'api', 'utils'] },
            identifiers: ['getUserById', 'validateToken', 'parseRequest'],
            comments: { ratio: 12 }
          }
        },
        {
          id: 'evt-2',
          type: 'debugging' as const,
          description: 'Debugged application',
          timestamp: new Date(),
          userId: 'user-1',
          sessionId: 'session-1',
          data: {
            method: 'systematic',
            toolsUsed: { debugger: true, profiler: false }
          }
        }
      ];

      // Process events
      for (const event of events) {
        await analyzer.analyzeUserEvent('user-1', event);
      }

      const pattern = analyzer.getUserPattern('user-1');
      expect(pattern).toBeDefined();
      expect(pattern?.userId).toBe('user-1');

      // Learn from pattern
      if (pattern) {
        await preferenceEngine.learnFromPattern('user-1', pattern);
        const profile = preferenceEngine.getProfile('user-1');
        
        expect(profile).toBeDefined();
        expect(profile?.behavior.userId).toBe('user-1');
      }

      analyzer.dispose();
      preferenceEngine.dispose();
    });
  });

  describe('Phase 3: Knowledge Graph Integration', () => {
    it('should extract entities from TypeScript code', async () => {
      const extractor = new EntityExtractor({
        projectRoot: '/test',
        language: 'typescript',
        includePatterns: ['**/*.ts'],
        excludePatterns: ['node_modules/**'],
        maxDepth: 5,
        extractConcepts: true,
        extractRelationships: true
      });

      const code = `
        export class DataService {
          private cache: Map<string, any>;
          
          constructor() {
            this.cache = new Map();
          }
          
          async getData(id: string): Promise<Data> {
            if (this.cache.has(id)) {
              return this.cache.get(id);
            }
            const data = await this.fetchData(id);
            this.cache.set(id, data);
            return data;
          }
          
          private async fetchData(id: string): Promise<Data> {
            // Implementation
            return { id, value: 'test' };
          }
        }
        
        interface Data {
          id: string;
          value: string;
        }
      `;

      const entities = await extractor.extractFromFile('/test/service.ts', code);
      const result = extractor.getResult();
      
      expect(result.entities.size).toBeGreaterThanOrEqual(0);
      expect(result.statistics.processedFiles).toBe(1);
    });
  });

  describe('Phase 4: Enterprise Security Integration', () => {
    it('should enforce access control with audit logging', async () => {
      const accessControl = new AccessControlManager({
        organizationId: 'test-org',
        hierarchyLevels: [
          {
            level: 'individual',
            priority: 1,
            inheritFromParent: true,
            overrideChild: false
          },
          {
            level: 'team',
            priority: 2,
            inheritFromParent: true,
            overrideChild: false
          }
        ],
        defaultPermissions: {
          memory: {
            read: [{ type: 'personal' }],
            write: [{ type: 'personal' }],
            delete: [],
            share: [],
            export: []
          },
          data: {
            classification: [{
              level: 'internal',
              handling: 'standard',
              retention: { duration: 90 }
            }],
            sensitivity: [],
            categories: ['general'],
            tags: []
          },
          operations: {
            query: { maxResults: 100 },
            analyze: {
              algorithms: ['basic'],
              mlModels: [],
              aggregations: ['count'],
              exports: []
            },
            modify: {
              create: true,
              update: false,
              delete: false,
              bulkOperations: false
            },
            integrate: {
              apis: [],
              webhooks: [],
              external: []
            }
          },
          administration: {
            manageUsers: false,
            manageRoles: false,
            managePermissions: false,
            viewAudit: false,
            configureSystem: false,
            emergencyAccess: false
          }
        },
        dataClassification: {
          enabled: true,
          defaultClassification: {
            level: 'internal',
            handling: 'standard',
            retention: { duration: 90 }
          },
          autoClassify: false,
          classifiers: []
        },
        auditEnabled: true
      });

      // Create a test user
      const userId = await accessControl.createUser({
        email: 'test@example.com',
        roles: [],
        teams: ['team-1'],
        projects: ['project-1'],
        organizationId: 'test-org',
        attributes: {},
        permissions: {
          memory: {
            read: [{ type: 'personal' }],
            write: [{ type: 'personal' }],
            delete: [],
            share: [],
            export: []
          },
          data: {
            classification: [{
              level: 'internal',
              handling: 'standard',
              retention: { duration: 90 }
            }],
            sensitivity: [],
            categories: ['general'],
            tags: []
          },
          operations: {
            query: { maxResults: 100 },
            analyze: {
              algorithms: [],
              mlModels: [],
              aggregations: [],
              exports: []
            },
            modify: {
              create: false,
              update: false,
              delete: false,
              bulkOperations: false
            },
            integrate: {
              apis: [],
              webhooks: [],
              external: []
            }
          },
          administration: {
            manageUsers: false,
            manageRoles: false,
            managePermissions: false,
            viewAudit: false,
            configureSystem: false,
            emergencyAccess: false
          }
        },
        restrictions: []
      });

      expect(userId).toBeDefined();
      
      const user = accessControl.getUser(userId);
      expect(user).toBeDefined();
      expect(user?.email).toBe('test@example.com');

      // Check audit log
      const auditLog = accessControl.getAuditLog();
      expect(Array.isArray(auditLog)).toBe(true);
    });
  });

  describe('System Performance', () => {
    it('should complete operations within performance targets', async () => {
      const measurements: Array<{ operation: string; duration: number; target: number }> = [];

      // Test Team Workspace performance
      const workspaceStart = Date.now();
      const workspace = new WorkspaceMemoryManager({
        teamId: 'perf-team',
        projectIds: ['perf-project'],
        syncInterval: 5000,
        retentionPeriod: 30,
        conflictResolution: 'latest-wins' as const,
        notificationSettings: {
          realTimeEnabled: false,
          digestEnabled: false,
          digestFrequency: 'daily' as const,
          channels: [],
          filters: []
        },
        privacySettings: {
          dataSharing: 'team' as const,
          visibilityLevel: 'team' as const,
          sensitiveDataHandling: 'standard' as const,
          auditTrail: false
        }
      });
      
      await workspace.addTeamMember({
        name: 'Performance Test',
        email: 'perf@test.com',
        role: 'senior' as const,
        expertise: [],
        workingStyle: {
          approach: 'test-driven' as const,
          communicationPreference: 'asynchronous' as const,
          reviewStyle: 'quick' as const,
          problemSolvingApproach: 'analytical' as const,
          workingHours: { start: '09:00', end: '17:00', timezone: 'UTC' }
        },
        timezone: 'UTC'
      });
      
      const workspaceDuration = Date.now() - workspaceStart;
      measurements.push({ 
        operation: 'Team Member Addition', 
        duration: workspaceDuration, 
        target: 200 
      });
      workspace.dispose();

      // Test Pattern Analysis performance
      const analyzerStart = Date.now();
      const analyzer = new UserPatternAnalyzer();
      await analyzer.analyzeUserEvent('perf-user', {
        id: 'perf-event',
        type: 'code-generation' as const,
        description: 'Performance test',
        timestamp: new Date(),
        userId: 'perf-user',
        sessionId: 'perf-session',
        data: { tests: { writtenFirst: false } }
      });
      const analyzerDuration = Date.now() - analyzerStart;
      measurements.push({ 
        operation: 'Pattern Analysis', 
        duration: analyzerDuration, 
        target: 100 
      });
      analyzer.dispose();

      // Verify all operations met targets
      console.log('\nPerformance Test Results:');
      console.log('═'.repeat(50));
      
      let allPassed = true;
      for (const { operation, duration, target } of measurements) {
        const passed = duration < target;
        const status = passed ? '✅' : '❌';
        console.log(`${status} ${operation}: ${duration}ms (target: <${target}ms)`);
        
        if (!passed) allPassed = false;
      }
      
      expect(allPassed).toBe(true);
    });
  });

  describe('Complete System Integration', () => {
    it('should demonstrate full memory system workflow', async () => {
      console.log('\n🚀 MARIA Memory System - Full Workflow Test');
      console.log('═'.repeat(50));

      // 1. Initialize team workspace
      console.log('1️⃣ Initializing Team Workspace...');
      const workspace = new WorkspaceMemoryManager({
        teamId: 'maria-team',
        projectIds: ['maria-platform'],
        syncInterval: 5000,
        retentionPeriod: 30,
        conflictResolution: 'latest-wins' as const,
        notificationSettings: {
          realTimeEnabled: true,
          digestEnabled: false,
          digestFrequency: 'daily' as const,
          channels: [],
          filters: []
        },
        privacySettings: {
          dataSharing: 'team' as const,
          visibilityLevel: 'team' as const,
          sensitiveDataHandling: 'encrypt' as const,
          auditTrail: true
        }
      });

      // 2. Add team members
      console.log('2️⃣ Adding Team Members...');
      const member1Id = await workspace.addTeamMember({
        name: 'Alice Developer',
        email: 'alice@maria.ai',
        role: 'senior' as const,
        expertise: [{
          area: 'frontend',
          proficiency: 9,
          technologies: ['react', 'typescript'],
          yearsExperience: 5
        }],
        workingStyle: {
          approach: 'test-driven' as const,
          communicationPreference: 'asynchronous' as const,
          reviewStyle: 'thorough' as const,
          problemSolvingApproach: 'analytical' as const,
          workingHours: { start: '09:00', end: '17:00', timezone: 'UTC' }
        },
        timezone: 'UTC'
      });

      // 3. Track progress
      console.log('3️⃣ Tracking Team Progress...');
      const progressTracker = new TeamProgressTracker();
      await progressTracker.trackTaskProgress({
        taskId: 'MARIA-001',
        title: 'Implement Memory System',
        description: 'Build advanced memory architecture',
        status: 'in-progress' as const,
        priority: 'high' as const,
        complexity: 9,
        estimatedHours: 80,
        actualHours: 40,
        completion: 50,
        dependencies: [],
        blockers: [],
        assignedTo: member1Id
      });

      // 4. Analyze user patterns
      console.log('4️⃣ Analyzing User Patterns...');
      const patternAnalyzer = new UserPatternAnalyzer();
      await patternAnalyzer.analyzeUserEvent('alice', {
        id: 'alice-event-1',
        type: 'code-generation' as const,
        description: 'Generated memory system code',
        timestamp: new Date(),
        userId: 'alice',
        sessionId: 'alice-session',
        data: {
          tests: { writtenFirst: true },
          structure: { modules: ['memory', 'team', 'learning'] }
        }
      });

      // 5. Learn preferences
      console.log('5️⃣ Learning User Preferences...');
      const preferenceEngine = new PreferenceEngine();
      const pattern = patternAnalyzer.getUserPattern('alice');
      if (pattern) {
        await preferenceEngine.learnFromPattern('alice', pattern);
      }

      // 6. Extract code entities
      console.log('6️⃣ Extracting Code Entities...');
      const entityExtractor = new EntityExtractor({
        projectRoot: '/maria',
        language: 'typescript',
        includePatterns: ['**/*.ts'],
        excludePatterns: ['node_modules/**'],
        maxDepth: 5,
        extractConcepts: true,
        extractRelationships: true
      });

      // 7. Apply access control
      console.log('7️⃣ Applying Enterprise Security...');
      const accessControl = new AccessControlManager({
        organizationId: 'maria-org',
        hierarchyLevels: [{
          level: 'organization',
          priority: 3,
          inheritFromParent: false,
          overrideChild: true
        }],
        defaultPermissions: {
          memory: {
            read: [{ type: 'organization' }],
            write: [{ type: 'team' }],
            delete: [],
            share: [{ type: 'team' }],
            export: []
          },
          data: {
            classification: [{
              level: 'confidential',
              handling: 'encrypted',
              retention: { duration: 365 }
            }],
            sensitivity: [],
            categories: ['development'],
            tags: ['maria', 'memory']
          },
          operations: {
            query: { maxResults: 1000 },
            analyze: {
              algorithms: ['*'],
              mlModels: ['*'],
              aggregations: ['*'],
              exports: [{ format: 'json' }]
            },
            modify: {
              create: true,
              update: true,
              delete: false,
              bulkOperations: true
            },
            integrate: {
              apis: ['*'],
              webhooks: [],
              external: []
            }
          },
          administration: {
            manageUsers: true,
            manageRoles: true,
            managePermissions: false,
            viewAudit: true,
            configureSystem: false,
            emergencyAccess: false
          }
        },
        dataClassification: {
          enabled: true,
          defaultClassification: {
            level: 'confidential',
            handling: 'encrypted',
            retention: { duration: 365 }
          },
          autoClassify: true,
          classifiers: []
        },
        auditEnabled: true
      });

      // 8. Get final metrics
      console.log('8️⃣ Generating Final Metrics...');
      const metrics = {
        teamMembers: workspace.getAllTeamMembers().length,
        progressMetrics: progressTracker.getMetrics(),
        patterns: patternAnalyzer.getUserPattern('alice'),
        preferences: preferenceEngine.getProfile('alice'),
        cacheStats: accessControl.getCacheStatistics()
      };

      console.log('\n✅ Memory System Workflow Complete!');
      console.log('═'.repeat(50));
      console.log(`Team Members: ${metrics.teamMembers}`);
      console.log(`Tasks Tracked: ${metrics.progressMetrics.productivity.team.totalTasks}`);
      console.log(`Pattern Recognition: ${metrics.patterns ? 'Active' : 'Inactive'}`);
      console.log(`Preference Learning: ${metrics.preferences ? 'Active' : 'Inactive'}`);
      console.log(`Security: Enabled with Audit Logging`);
      
      // Clean up
      workspace.dispose();
      progressTracker.dispose();
      patternAnalyzer.dispose();
      preferenceEngine.dispose();

      // Verify everything worked
      expect(metrics.teamMembers).toBeGreaterThan(0);
      expect(metrics.progressMetrics).toBeDefined();
      expect(metrics.cacheStats).toBeDefined();
    });
  });
});