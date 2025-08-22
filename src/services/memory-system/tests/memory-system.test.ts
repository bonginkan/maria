/**
 * Comprehensive Test Suite for MARIA Memory System
 * Tests all 4 phases of the memory implementation
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// Phase 1: Core Memory Architecture
import { DualMemoryEngine } from '../dual-memory-engine';
import { System1Memory, System1MemoryManager } from '../system1-memory';
import { System2Memory, System2MemoryManager } from '../system2-memory';
import { MemoryCoordinator } from '../memory-coordinator';

// Phase 2.1: Team Collaboration
import { WorkspaceMemoryManager } from '../team/workspace-memory-manager';
import TeamProgressTracker from '../team/team-progress-tracker';
import CollaborativeContext from '../team/collaborative-context';

// Phase 2.2: Cross-Session Learning
import UserPatternAnalyzer from '../learning/user-pattern-analyzer';
import PreferenceEngine from '../learning/preference-engine';

// Phase 3: Knowledge Graph
import EntityExtractor from '../knowledge-graph/entity-extractor';

// Phase 4: Enterprise Features
import AccessControlManager from '../enterprise/access-control-manager';

describe('MARIA Memory System - Comprehensive Tests', () => {
  
  // ========== Phase 1: Core Memory Architecture Tests ==========
  
  describe('Phase 1: Core Memory Architecture', () => {
    let dualMemory: DualMemoryEngine;
    let system1: System1MemoryManager;
    let system2: System2MemoryManager;
    let coordinator: MemoryCoordinator;

    beforeEach(() => {
      const config = {
        system1: {
          maxKnowledgeNodes: 1000,
          embeddingDimension: 768,
          cacheSize: 100,
          compressionThreshold: 0.8,
          accessDecayRate: 0.1
        },
        system2: {
          maxReasoningTraces: 500,
          qualityThreshold: 0.7,
          reflectionFrequency: 24,
          enhancementEvaluationInterval: 24
        },
        coordinator: {
          syncInterval: 5000,
          conflictResolutionStrategy: 'balanced' as const,
          learningRate: 0.01,
          adaptationThreshold: 0.8
        },
        performance: {
          lazyLoadingEnabled: true,
          cacheStrategy: 'lru' as const,
          batchSize: 50,
          timeout: 5000,
          memoryLimit: 256
        }
      };
      dualMemory = new DualMemoryEngine(config);
      system1 = new System1MemoryManager(config.system1);
      system2 = new System2MemoryManager(config.system2);
      coordinator = new MemoryCoordinator(system1, system2, dualMemory, config.coordinator);
    });

    it('should initialize dual memory engine', () => {
      expect(dualMemory).toBeDefined();
      expect(dualMemory.getState()).toBeDefined();
    });

    it('should store and retrieve patterns in System 1 memory', async () => {
      const pattern = {
        id: 'test-pattern-1',
        type: 'code-generation' as const,
        pattern: 'async function pattern',
        frequency: 10,
        confidence: 0.9,
        lastUsed: new Date(),
        context: {}
      };

      await system1.storePattern(pattern);
      const retrieved = await system1.getPattern('test-pattern-1');
      
      expect(retrieved).toBeDefined();
      expect(retrieved?.pattern).toBe('async function pattern');
    });

    it('should store reasoning traces in System 2 memory', async () => {
      const trace = {
        id: 'trace-1',
        reasoning: 'Multi-step reasoning process',
        steps: [
          { step: 1, action: 'analyze', result: 'success' },
          { step: 2, action: 'evaluate', result: 'optimal' }
        ],
        quality: { score: 0.85, confidence: 0.9 },
        timestamp: new Date()
      };

      await system2.storeReasoningTrace(trace);
      const retrieved = await system2.getReasoningTrace('trace-1');
      
      expect(retrieved).toBeDefined();
      expect(retrieved?.quality.score).toBe(0.85);
    });

    it('should coordinate between System 1 and System 2', async () => {
      const event = {
        id: 'event-1',
        type: 'code-generation' as const,
        description: 'Generate async function',
        timestamp: new Date(),
        userId: 'user-1',
        sessionId: 'session-1',
        data: { language: 'typescript' }
      };

      const result = await coordinator.processMemoryEvent(event);
      
      expect(result).toBeDefined();
      expect(result.processed).toBe(true);
    });

    it('should achieve performance targets (<100ms)', async () => {
      const startTime = Date.now();
      
      const pattern = {
        id: 'perf-test',
        type: 'code-generation' as const,
        pattern: 'test pattern',
        frequency: 1,
        confidence: 0.5,
        lastUsed: new Date(),
        context: {}
      };

      await system1.storePattern(pattern);
      await system1.getPattern('perf-test');
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(100);
    });
  });

  // ========== Phase 2.1: Team Collaboration Tests ==========

  describe('Phase 2.1: Team Collaboration', () => {
    let workspaceManager: WorkspaceMemoryManager;
    let progressTracker: TeamProgressTracker;
    let collaborativeContext: CollaborativeContext;

    beforeEach(() => {
      const config = {
        teamId: 'team-1',
        projectIds: ['project-1'],
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

      workspaceManager = new WorkspaceMemoryManager(config);
      progressTracker = new TeamProgressTracker();
      collaborativeContext = new CollaborativeContext();
    });

    afterEach(() => {
      workspaceManager.dispose();
      progressTracker.dispose();
      collaborativeContext.dispose();
    });

    it('should manage team members', async () => {
      const member = {
        name: 'John Doe',
        email: 'john@example.com',
        role: 'senior' as const,
        expertise: [{
          area: 'backend',
          proficiency: 8,
          technologies: ['node.js', 'typescript'],
          yearsExperience: 5
        }],
        workingStyle: {
          approach: 'test-driven' as const,
          communicationPreference: 'asynchronous' as const,
          reviewStyle: 'thorough' as const,
          problemSolvingApproach: 'analytical' as const,
          workingHours: {
            start: '09:00',
            end: '17:00',
            timezone: 'UTC'
          }
        },
        timezone: 'UTC'
      };

      const memberId = await workspaceManager.addTeamMember(member);
      expect(memberId).toBeDefined();

      const retrieved = workspaceManager.getTeamMember(memberId);
      expect(retrieved?.name).toBe('John Doe');
    });

    it('should track task progress', async () => {
      const task = {
        taskId: 'task-1',
        title: 'Implement memory system',
        description: 'Build dual-layer memory',
        status: 'in-progress' as const,
        priority: 'high' as const,
        complexity: 8,
        estimatedHours: 40,
        actualHours: 20,
        completion: 50,
        dependencies: [],
        blockers: [],
        assignedTo: 'member-1'
      };

      await progressTracker.trackTaskProgress(task);
      const metrics = progressTracker.getMetrics();
      
      expect(metrics).toBeDefined();
      expect(metrics.productivity).toBeDefined();
    });

    it('should manage collaborative context', async () => {
      const projectContext = {
        projectId: 'project-1',
        name: 'MARIA Platform',
        description: 'AI Development Platform',
        architecture: {
          type: 'microservices' as const,
          technologies: {
            frontend: ['react'],
            backend: ['node.js'],
            database: ['postgresql'],
            infrastructure: ['kubernetes'],
            testing: ['vitest']
          },
          designPatterns: ['mvc', 'repository'],
          codingStandards: [],
          deploymentStrategy: {
            type: 'continuous' as const,
            environments: [],
            pipeline: [],
            rollbackStrategy: 'automatic'
          }
        }
      };

      await collaborativeContext.updateProjectContext('project-1', projectContext);
      const retrieved = collaborativeContext.getProjectContext('project-1');
      
      expect(retrieved?.name).toBe('MARIA Platform');
    });

    it('should synchronize in real-time (<200ms)', async () => {
      const startTime = Date.now();
      
      const member = {
        name: 'Test User',
        email: 'test@example.com',
        role: 'junior' as const,
        expertise: [],
        workingStyle: {
          approach: 'iterative' as const,
          communicationPreference: 'synchronous' as const,
          reviewStyle: 'quick' as const,
          problemSolvingApproach: 'intuitive' as const,
          workingHours: {
            start: '09:00',
            end: '17:00',
            timezone: 'UTC'
          }
        },
        timezone: 'UTC'
      };

      await workspaceManager.addTeamMember(member);
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(200);
    });
  });

  // ========== Phase 2.2: Cross-Session Learning Tests ==========

  describe('Phase 2.2: Cross-Session Learning', () => {
    let patternAnalyzer: UserPatternAnalyzer;
    let preferenceEngine: PreferenceEngine;

    beforeEach(() => {
      patternAnalyzer = new UserPatternAnalyzer();
      preferenceEngine = new PreferenceEngine();
    });

    afterEach(() => {
      patternAnalyzer.dispose();
      preferenceEngine.dispose();
    });

    it('should analyze user patterns', async () => {
      const event = {
        id: 'event-1',
        type: 'code-generation' as const,
        description: 'User generated code',
        timestamp: new Date(),
        userId: 'user-1',
        sessionId: 'session-1',
        data: {
          tests: { writtenFirst: true },
          structure: { modules: ['module1', 'module2'] },
          identifiers: ['camelCase', 'descriptiveName'],
          comments: { ratio: 10 }
        }
      };

      await patternAnalyzer.analyzeUserEvent('user-1', event);
      const pattern = patternAnalyzer.getUserPattern('user-1');
      
      expect(pattern).toBeDefined();
      expect(pattern?.developmentStyle).toBeDefined();
    });

    it('should learn preferences from patterns', async () => {
      const pattern = {
        userId: 'user-1',
        developmentStyle: {
          approach: 'test-driven' as const,
          codeOrganization: 'modular' as const,
          refactoringFrequency: 'continuous' as const,
          debuggingStyle: 'systematic' as const,
          testingPhilosophy: 'comprehensive' as const,
          documentationLevel: 'extensive' as const,
          confidence: 0.8
        },
        problemSolvingApproach: {
          strategy: 'top-down' as const,
          researchDepth: 'thorough' as const,
          planningLevel: 'detailed' as const,
          experimentationRate: 0.7,
          reusePreference: 'high' as const,
          abstractionLevel: 'high' as const,
          parallelTasks: 3
        },
        codeQualityPreferences: {
          namingConventions: {
            caseStyle: 'camelCase' as const,
            verbosity: 'descriptive' as const,
            prefixUsage: false,
            hungarianNotation: false,
            consistency: 0.9
          },
          commentingStyle: {
            frequency: 'moderate' as const,
            type: 'explanatory' as const,
            location: 'mixed' as const,
            language: 'technical' as const,
            codeToCommentRatio: 10
          },
          errorHandling: {
            strategy: 'defensive' as const,
            exceptionUsage: 'conservative' as const,
            validationLevel: 'standard' as const,
            loggingVerbosity: 'errors-only' as const,
            recoveryApproach: 'retry' as const
          },
          performanceConsideration: 'balanced' as const,
          securityAwareness: 'standard' as const,
          codeReviewExpectation: 'thorough' as const,
          refactoringThreshold: 10,
          testCoverageTarget: 80
        },
        communicationStyle: {
          responseLength: 'concise' as const,
          explanationDepth: 'high-level' as const,
          questioningStyle: 'specific' as const,
          feedbackPreference: 'continuous' as const,
          collaborationLevel: 'periodic-sync' as const,
          technicalLevel: 'expert' as const,
          preferredChannels: []
        },
        workingPatterns: {
          sessionDuration: {
            averageDuration: 120,
            distribution: 'consistent' as const,
            sessionsPerDay: 3,
            deepWorkRatio: 0.7
          },
          focusTime: {
            averageFocusDuration: 45,
            distractionResistance: 'high' as const,
            contextSwitchCost: 5,
            preferredEnvironment: 'quiet' as const
          },
          breakFrequency: {
            averageInterval: 90,
            breakDuration: 10,
            breakType: 'complete-disconnect' as const,
            consistency: 0.8
          },
          taskSwitching: {
            frequency: 'occasional' as const,
            switchTrigger: 'completion' as const,
            parallelTasks: 2,
            contextRetention: 'excellent' as const
          },
          productivityPeaks: [],
          preferredHours: {
            timezone: 'UTC',
            workingHours: { start: '09:00', end: '17:00' },
            preferredDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
            flexibilityLevel: 'flexible' as const
          }
        },
        learningProfile: {
          learningStyle: {
            primary: 'reading' as const,
            secondary: ['hands-on'],
            examplePreference: 'few-examples' as const,
            conceptualDepth: 'thorough' as const,
            practiceRatio: 0.6
          },
          knowledgeAcquisition: {
            speed: 'fast' as const,
            breadthVsDepth: 'balanced' as const,
            curiosityLevel: 'high' as const,
            experimentationRate: 0.8,
            documentationReliance: 'moderate' as const
          },
          skillProgression: {
            growthRate: 0.7,
            plateauHandling: 'persistent' as const,
            challengePreference: 'stretch' as const,
            masteryApproach: 'continuous' as const
          },
          retentionPattern: {
            shortTermRetention: 'excellent' as const,
            longTermRetention: 'good' as const,
            refreshFrequency: 30,
            noteTaking: 'key-points' as const
          },
          preferredResources: []
        },
        toolPreferences: {
          ide: {
            preferred: ['vscode'],
            featureUsage: {
              autoComplete: 0.9,
              refactoring: 0.7,
              debugging: 0.8,
              navigation: 0.85,
              snippets: 0.6
            },
            customization: 'heavy' as const,
            keyboardShortcuts: 'extensive' as const
          },
          versionControl: {
            commitFrequency: 'feature-complete' as const,
            commitSize: 'atomic' as const,
            branchingStrategy: 'feature-branch' as const,
            messageStyle: 'conventional' as const,
            collaborationStyle: 'pull-request' as const
          },
          debugging: {
            primaryMethod: 'debugger' as const,
            toolUsage: {
              breakpoints: 0.8,
              watches: 0.6,
              profiler: 0.4,
              memoryAnalyzer: 0.3
            },
            systematicness: 'methodical' as const
          },
          testing: {
            testWriting: 'before' as const,
            testTypes: {
              unit: 0.9,
              integration: 0.7,
              e2e: 0.5,
              performance: 0.3
            },
            mockingUsage: 'extensive' as const,
            assertionStyle: 'detailed' as const
          },
          deployment: {
            frequency: 'continuous' as const,
            automation: 'full' as const,
            monitoring: 'comprehensive' as const,
            rollbackStrategy: 'immediate' as const
          },
          aiAssistance: {
            usageLevel: 'heavy' as const,
            trustLevel: 0.8,
            verificationBehavior: 'trust-but-verify' as const,
            interactionStyle: 'conversational' as const,
            scopePreference: 'full-solution' as const
          }
        }
      };

      await preferenceEngine.learnFromPattern('user-1', pattern);
      const profile = preferenceEngine.getProfile('user-1');
      
      expect(profile).toBeDefined();
      expect(profile?.behavior.responseStyle).toBeDefined();
    });

    it('should adapt to user feedback', async () => {
      const feedback = {
        type: 'negative' as const,
        aspect: 'response length',
        details: 'Response was too long and verbose'
      };

      await preferenceEngine.processFeedback('user-1', feedback);
      const profile = preferenceEngine.getProfile('user-1');
      
      expect(profile).toBeDefined();
      // Feedback should be recorded
      expect(profile?.history.feedbackHistory.length).toBeGreaterThan(0);
    });
  });

  // ========== Phase 3: Knowledge Graph Tests ==========

  describe('Phase 3: Knowledge Graph', () => {
    let entityExtractor: EntityExtractor;

    beforeEach(() => {
      const context = {
        projectRoot: '/test/project',
        language: 'typescript' as const,
        includePatterns: ['**/*.ts'],
        excludePatterns: ['node_modules/**'],
        maxDepth: 10,
        extractConcepts: true,
        extractRelationships: true
      };

      entityExtractor = new EntityExtractor(context);
    });

    it('should extract TypeScript entities', async () => {
      const fileContent = `
        export class UserService {
          private repository: UserRepository;
          
          async getUser(id: string): Promise<User> {
            return await this.repository.findById(id);
          }
        }
        
        export interface User {
          id: string;
          name: string;
          email: string;
        }
        
        export type UserId = string;
      `;

      const entities = await entityExtractor.extractFromFile(
        '/test/user-service.ts',
        fileContent
      );
      
      expect(entities.length).toBeGreaterThan(0);
      
      const classEntity = entities.find(e => e.type === 'class');
      expect(classEntity?.name).toBe('UserService');
      
      const interfaceEntity = entities.find(e => e.type === 'interface');
      expect(interfaceEntity?.name).toBe('User');
      
      const typeEntity = entities.find(e => e.type === 'type');
      expect(typeEntity?.name).toBe('UserId');
    });

    it('should extract Python entities', async () => {
      const fileContent = `
        class DataProcessor:
            def __init__(self):
                self.data = []
            
            async def process(self, input_data):
                return self._transform(input_data)
            
            def _transform(self, data):
                return data.upper()
      `;

      const entities = await entityExtractor.extractFromFile(
        '/test/processor.py',
        fileContent
      );
      
      expect(entities.length).toBeGreaterThan(0);
      
      const classEntity = entities.find(e => e.type === 'class');
      expect(classEntity?.name).toBe('DataProcessor');
      
      const functions = entities.filter(e => e.type === 'function');
      expect(functions.length).toBeGreaterThan(0);
    });

    it('should calculate complexity metrics', async () => {
      const fileContent = `
        export function complexFunction(x: number): number {
          if (x > 10) {
            for (let i = 0; i < x; i++) {
              if (i % 2 === 0) {
                console.log(i);
              } else {
                console.error(i);
              }
            }
            return x * 2;
          } else if (x > 5) {
            return x + 10;
          } else {
            return x;
          }
        }
      `;

      const entities = await entityExtractor.extractFromFile(
        '/test/complex.ts',
        fileContent
      );
      
      const functionEntity = entities.find(e => e.type === 'function');
      expect(functionEntity?.complexity).toBeDefined();
      expect(functionEntity?.complexity?.cyclomaticComplexity).toBeGreaterThan(1);
    });
  });

  // ========== Phase 4: Enterprise Features Tests ==========

  describe('Phase 4: Enterprise Features', () => {
    let accessControl: AccessControlManager;

    beforeEach(() => {
      const config = {
        organizationId: 'org-1',
        hierarchyLevels: [
          {
            level: 'individual' as const,
            priority: 1,
            inheritFromParent: true,
            overrideChild: false
          },
          {
            level: 'team' as const,
            priority: 2,
            inheritFromParent: true,
            overrideChild: false
          },
          {
            level: 'organization' as const,
            priority: 4,
            inheritFromParent: false,
            overrideChild: true
          }
        ],
        defaultPermissions: {
          memory: {
            read: [{ type: 'personal' as const }],
            write: [{ type: 'personal' as const }],
            delete: [],
            share: [],
            export: []
          },
          data: {
            classification: [{
              level: 'internal' as const,
              handling: 'standard' as const,
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
              aggregations: ['count'],
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
        dataClassification: {
          enabled: true,
          defaultClassification: {
            level: 'internal' as const,
            handling: 'standard' as const,
            retention: { duration: 90 }
          },
          autoClassify: true,
          classifiers: []
        },
        auditEnabled: true
      };

      accessControl = new AccessControlManager(config);
    });

    it('should create and manage users', async () => {
      const userData = {
        email: 'admin@example.com',
        roles: [],
        teams: ['team-1'],
        projects: ['project-1'],
        organizationId: 'org-1',
        attributes: {
          department: 'Engineering',
          jobTitle: 'Senior Developer',
          clearanceLevel: 'confidential' as const
        },
        permissions: {
          memory: {
            read: [{ type: 'team' as const }],
            write: [{ type: 'personal' as const }],
            delete: [],
            share: [],
            export: []
          },
          data: {
            classification: [],
            sensitivity: [],
            categories: [],
            tags: []
          },
          operations: {
            query: {},
            analyze: { algorithms: [], mlModels: [], aggregations: [], exports: [] },
            modify: {
              create: true,
              update: true,
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
      };

      const userId = await accessControl.createUser(userData);
      expect(userId).toBeDefined();

      const user = accessControl.getUser(userId);
      expect(user?.email).toBe('admin@example.com');
    });

    it('should check access permissions', async () => {
      // Create a user first
      const userData = {
        email: 'user@example.com',
        roles: [],
        teams: [],
        projects: [],
        organizationId: 'org-1',
        attributes: {
          clearanceLevel: 'internal' as const
        },
        permissions: {
          memory: {
            read: [{ type: 'personal' as const }],
            write: [],
            delete: [],
            share: [],
            export: []
          },
          data: {
            classification: [{
              level: 'internal' as const,
              handling: 'standard' as const,
              retention: { duration: 30 }
            }],
            sensitivity: [],
            categories: [],
            tags: []
          },
          operations: {
            query: { maxResults: 10 },
            analyze: { algorithms: [], mlModels: [], aggregations: [], exports: [] },
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
      };

      const userId = await accessControl.createUser(userData);

      const request = {
        id: 'request-1',
        userId,
        resource: {
          type: 'memory' as const,
          id: 'memory-1',
          classification: {
            level: 'public' as const,
            handling: 'standard' as const,
            retention: { duration: 30 }
          }
        },
        operation: 'read',
        context: {
          ip: '192.168.1.1',
          sessionId: 'session-1',
          mfaVerified: false
        },
        timestamp: new Date()
      };

      const decision = await accessControl.checkAccess(request);
      
      expect(decision).toBeDefined();
      expect(decision.granted).toBe(true);
      expect(decision.audit).toBeDefined();
    });

    it('should enforce data classification', async () => {
      const userData = {
        email: 'limited@example.com',
        roles: [],
        teams: [],
        projects: [],
        organizationId: 'org-1',
        attributes: {
          clearanceLevel: 'internal' as const
        },
        permissions: {
          memory: {
            read: [{ type: 'personal' as const }],
            write: [],
            delete: [],
            share: [],
            export: []
          },
          data: {
            classification: [{
              level: 'internal' as const,
              handling: 'standard' as const,
              retention: { duration: 90 }
            }],
            sensitivity: [],
            categories: [],
            tags: []
          },
          operations: {
            query: {},
            analyze: { algorithms: [], mlModels: [], aggregations: [], exports: [] },
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
      };

      const userId = await accessControl.createUser(userData);

      // Try to access secret data (should be denied)
      const request = {
        id: 'request-2',
        userId,
        resource: {
          type: 'memory' as const,
          id: 'secret-memory',
          classification: {
            level: 'secret' as const,
            handling: 'encrypted' as const,
            retention: { duration: 365 }
          }
        },
        operation: 'read',
        context: {
          ip: '192.168.1.1',
          sessionId: 'session-2'
        },
        timestamp: new Date()
      };

      const decision = await accessControl.checkAccess(request);
      
      expect(decision.granted).toBe(false);
      expect(decision.reason).toContain('Insufficient clearance');
    });

    it('should maintain audit logs', () => {
      const logs = accessControl.getAuditLog();
      expect(logs).toBeDefined();
      expect(Array.isArray(logs)).toBe(true);
    });
  });

  // ========== Integration Tests ==========

  describe('System Integration Tests', () => {
    it('should integrate memory with team collaboration', async () => {
      // Create memory coordinator with proper config
      const config = {
        system1: {
          maxKnowledgeNodes: 1000,
          embeddingDimension: 768,
          cacheSize: 100,
          compressionThreshold: 0.8,
          accessDecayRate: 0.1
        },
        system2: {
          maxReasoningTraces: 500,
          qualityThreshold: 0.7,
          reflectionFrequency: 24,
          enhancementEvaluationInterval: 24
        },
        coordinator: {
          syncInterval: 5000,
          conflictResolutionStrategy: 'balanced' as const,
          learningRate: 0.01,
          adaptationThreshold: 0.8
        },
        performance: {
          lazyLoadingEnabled: true,
          cacheStrategy: 'lru' as const,
          batchSize: 50,
          timeout: 5000,
          memoryLimit: 256
        }
      };
      const dualMemoryEngine = new DualMemoryEngine(config);
      const system1Manager = new System1MemoryManager(config.system1);
      const system2Manager = new System2MemoryManager(config.system2);
      const coordinator = new MemoryCoordinator(system1Manager, system2Manager, dualMemoryEngine, config.coordinator);
      
      // Create team workspace
      const workspaceConfig = {
        teamId: 'integration-team',
        projectIds: ['integration-project'],
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
      
      // Process an event through the memory system
      const event = {
        id: 'integration-event',
        type: 'code-generation' as const,
        description: 'Team member generated code',
        timestamp: new Date(),
        userId: 'team-member-1',
        sessionId: 'session-1',
        data: {
          teamId: 'integration-team',
          projectId: 'integration-project'
        }
      };
      
      const result = await coordinator.processMemoryEvent(event);
      expect(result.processed).toBe(true);
      
      workspace.dispose();
    });

    it('should integrate learning with preferences', async () => {
      const analyzer = new UserPatternAnalyzer();
      const engine = new PreferenceEngine();
      
      // Analyze multiple events
      for (let i = 0; i < 5; i++) {
        const event = {
          id: `learning-event-${i}`,
          type: 'code-generation' as const,
          description: 'User activity',
          timestamp: new Date(),
          userId: 'learning-user',
          sessionId: 'session-1',
          data: {
            tests: { writtenFirst: true },
            comments: { ratio: 8 }
          }
        };
        
        await analyzer.analyzeUserEvent('learning-user', event);
      }
      
      // Get analyzed pattern
      const pattern = analyzer.getUserPattern('learning-user');
      expect(pattern).toBeDefined();
      
      // Learn preferences from pattern
      if (pattern) {
        await engine.learnFromPattern('learning-user', pattern);
        const behavior = engine.getBehavior('learning-user');
        
        expect(behavior).toBeDefined();
        expect(behavior?.responseStyle).toBeDefined();
      }
      
      analyzer.dispose();
      engine.dispose();
    });

    it('should enforce security on memory access', async () => {
      // Create access control
      const accessConfig = {
        organizationId: 'secure-org',
        hierarchyLevels: [{
          level: 'individual' as const,
          priority: 1,
          inheritFromParent: true,
          overrideChild: false
        }],
        defaultPermissions: {
          memory: {
            read: [],
            write: [],
            delete: [],
            share: [],
            export: []
          },
          data: {
            classification: [],
            sensitivity: [],
            categories: [],
            tags: []
          },
          operations: {
            query: {},
            analyze: { algorithms: [], mlModels: [], aggregations: [], exports: [] },
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
        dataClassification: {
          enabled: true,
          defaultClassification: {
            level: 'confidential' as const,
            handling: 'encrypted' as const,
            retention: { duration: 180 }
          },
          autoClassify: true,
          classifiers: []
        },
        auditEnabled: true
      };
      
      const accessControl = new AccessControlManager(accessConfig);
      
      // Create memory coordinator with proper config
      const memoryConfig = {
        system1: {
          maxKnowledgeNodes: 1000,
          embeddingDimension: 768,
          cacheSize: 100,
          compressionThreshold: 0.8,
          accessDecayRate: 0.1
        },
        system2: {
          maxReasoningTraces: 500,
          qualityThreshold: 0.7,
          reflectionFrequency: 24,
          enhancementEvaluationInterval: 24
        },
        coordinator: {
          syncInterval: 5000,
          conflictResolutionStrategy: 'balanced' as const,
          learningRate: 0.01,
          adaptationThreshold: 0.8
        },
        performance: {
          lazyLoadingEnabled: true,
          cacheStrategy: 'lru' as const,
          batchSize: 50,
          timeout: 5000,
          memoryLimit: 256
        }
      };
      const dualMemoryEngine = new DualMemoryEngine(memoryConfig);
      const system1Manager = new System1MemoryManager(memoryConfig.system1);
      const system2Manager = new System2MemoryManager(memoryConfig.system2);
      const coordinator = new MemoryCoordinator(system1Manager, system2Manager, dualMemoryEngine, memoryConfig.coordinator);
      
      // Create restricted user
      const userData = {
        email: 'restricted@example.com',
        roles: [],
        teams: [],
        projects: [],
        organizationId: 'secure-org',
        attributes: {},
        permissions: {
          memory: {
            read: [],
            write: [],
            delete: [],
            share: [],
            export: []
          },
          data: {
            classification: [],
            sensitivity: [],
            categories: [],
            tags: []
          },
          operations: {
            query: {},
            analyze: { algorithms: [], mlModels: [], aggregations: [], exports: [] },
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
      };
      
      const userId = await accessControl.createUser(userData);
      
      // Try to access memory (should be denied)
      const request = {
        id: 'secure-request',
        userId,
        resource: {
          type: 'memory' as const,
          id: 'protected-memory'
        },
        operation: 'read',
        context: {
          ip: '10.0.0.1',
          sessionId: 'secure-session'
        },
        timestamp: new Date()
      };
      
      const decision = await accessControl.checkAccess(request);
      expect(decision.granted).toBe(false);
    });
  });

  // ========== Performance Tests ==========

  describe('Performance Tests', () => {
    it('should meet overall performance targets', async () => {
      const operations: Array<{ name: string; operation: () => Promise<void>; maxTime: number }> = [
        {
          name: 'System 1 Memory Store',
          operation: async () => {
            const config = {
              maxKnowledgeNodes: 1000,
              embeddingDimension: 768,
              cacheSize: 100,
              compressionThreshold: 0.8,
              accessDecayRate: 0.1
            };
            const memory = new System1MemoryManager(config);
            await memory.storePattern({
              id: 'perf-1',
              type: 'code-generation',
              pattern: 'test',
              frequency: 1,
              confidence: 0.5,
              lastUsed: new Date(),
              context: {}
            });
          },
          maxTime: 50
        },
        {
          name: 'Team Member Addition',
          operation: async () => {
            const workspace = new WorkspaceMemoryManager({
              teamId: 'perf-team',
              projectIds: [],
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
              name: 'Perf Test',
              email: 'perf@test.com',
              role: 'junior' as const,
              expertise: [],
              workingStyle: {
                approach: 'iterative' as const,
                communicationPreference: 'asynchronous' as const,
                reviewStyle: 'quick' as const,
                problemSolvingApproach: 'intuitive' as const,
                workingHours: {
                  start: '09:00',
                  end: '17:00',
                  timezone: 'UTC'
                }
              },
              timezone: 'UTC'
            });
            
            workspace.dispose();
          },
          maxTime: 200
        }
      ];

      for (const { name, operation, maxTime } of operations) {
        const startTime = Date.now();
        await operation();
        const duration = Date.now() - startTime;
        
        expect(duration).toBeLessThan(maxTime);
        console.log(`${name}: ${duration}ms (target: <${maxTime}ms)`);
      }
    });
  });
});