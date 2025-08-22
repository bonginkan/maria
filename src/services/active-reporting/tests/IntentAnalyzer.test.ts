/**
 * Intent Analyzer Tests
 * Test suite for natural language intent recognition
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { IntentAnalyzer } from '../IntentAnalyzer';

describe('IntentAnalyzer', () => {
  let analyzer: IntentAnalyzer;

  beforeEach(() => {
    analyzer = new IntentAnalyzer();
  });

  describe('Intent Classification', () => {
    it('should classify feature development requests', async () => {
      const requests = [
        'Create a new user dashboard',
        'Add payment processing functionality',
        'Build a search feature with filters',
        'Implement real-time notifications'
      ];

      for (const request of requests) {
        const analysis = await analyzer.analyze(request);
        expect(analysis.primaryIntent).toBe('feature_development');
        expect(analysis.confidence).toBeGreaterThan(0.7);
      }
    });

    it('should classify bug fix requests', async () => {
      const requests = [
        'Fix the login button not working',
        'Resolve memory leak in data processing',
        'Debug the API timeout issue',
        'Patch security vulnerability in auth module'
      ];

      for (const request of requests) {
        const analysis = await analyzer.analyze(request);
        expect(analysis.primaryIntent).toBe('bug_fix');
        expect(analysis.urgency).toBeGreaterThan(0.6);
      }
    });

    it('should classify refactoring requests', async () => {
      const requests = [
        'Refactor the user service to use async/await',
        'Clean up the legacy code in authentication',
        'Modernize the build system to use Vite',
        'Restructure the component hierarchy'
      ];

      for (const request of requests) {
        const analysis = await analyzer.analyze(request);
        expect(analysis.primaryIntent).toBe('refactoring');
      }
    });

    it('should classify testing requests', async () => {
      const requests = [
        'Write unit tests for the payment module',
        'Add integration tests for the API',
        'Create end-to-end tests for checkout flow',
        'Set up test coverage reporting'
      ];

      for (const request of requests) {
        const analysis = await analyzer.analyze(request);
        expect(['testing', 'feature_development']).toContain(analysis.primaryIntent);
      }
    });

    it('should classify documentation requests', async () => {
      const requests = [
        'Update API documentation',
        'Write user guide for new features',
        'Create developer onboarding docs',
        'Document the deployment process'
      ];

      for (const request of requests) {
        const analysis = await analyzer.analyze(request);
        expect(['documentation', 'maintenance']).toContain(analysis.primaryIntent);
      }
    });
  });

  describe('Complexity Assessment', () => {
    it('should assess low complexity for simple tasks', async () => {
      const requests = [
        'Change button color to blue',
        'Fix typo in error message',
        'Update copyright year',
        'Add loading spinner'
      ];

      for (const request of requests) {
        const analysis = await analyzer.analyze(request);
        expect(analysis.complexity).toBeLessThan(0.4);
      }
    });

    it('should assess medium complexity for moderate tasks', async () => {
      const requests = [
        'Add user authentication',
        'Implement data validation',
        'Create responsive design',
        'Add file upload feature'
      ];

      for (const request of requests) {
        const analysis = await analyzer.analyze(request);
        expect(analysis.complexity).toBeGreaterThan(0.3);
        expect(analysis.complexity).toBeLessThan(0.7);
      }
    });

    it('should assess high complexity for complex tasks', async () => {
      const requests = [
        'Build microservices architecture',
        'Implement real-time collaboration',
        'Create machine learning pipeline',
        'Design distributed caching system'
      ];

      for (const request of requests) {
        const analysis = await analyzer.analyze(request);
        expect(analysis.complexity).toBeGreaterThan(0.6);
      }
    });
  });

  describe('Keyword Extraction', () => {
    it('should extract relevant technical keywords', async () => {
      const analysis = await analyzer.analyze(
        'Create a React component with TypeScript and Redux state management'
      );

      expect(analysis.keywords).toContain('react');
      expect(analysis.keywords).toContain('typescript');
      expect(analysis.keywords).toContain('redux');
      expect(analysis.keywords).toContain('component');
    });

    it('should extract action keywords', async () => {
      const analysis = await analyzer.analyze(
        'Fix, update, and optimize the database queries'
      );

      expect(analysis.keywords).toContain('fix');
      expect(analysis.keywords).toContain('update');
      expect(analysis.keywords).toContain('optimize');
      expect(analysis.keywords).toContain('database');
    });

    it('should normalize keywords consistently', async () => {
      const analysis1 = await analyzer.analyze('Create user Authentication');
      const analysis2 = await analyzer.analyze('create USER authentication');

      expect(analysis1.keywords).toEqual(analysis2.keywords);
    });
  });

  describe('Time Estimation', () => {
    it('should provide reasonable time estimates based on complexity', async () => {
      const simpleTask = await analyzer.analyze('Change button text');
      const complexTask = await analyzer.analyze('Build distributed microservices architecture');

      expect(simpleTask.estimatedEffort).toBeLessThan(complexTask.estimatedEffort);
      expect(simpleTask.estimatedEffort).toBeGreaterThan(0);
      expect(complexTask.estimatedEffort).toBeGreaterThan(0);
    });

    it('should factor in keyword complexity for estimation', async () => {
      const basicTask = await analyzer.analyze('Add a button');
      const advancedTask = await analyzer.analyze('Implement machine learning algorithm with neural networks');

      expect(advancedTask.estimatedEffort).toBeGreaterThan(basicTask.estimatedEffort * 5);
    });
  });

  describe('Urgency Detection', () => {
    it('should detect high urgency from urgent keywords', async () => {
      const urgentRequests = [
        'URGENT: Fix critical security vulnerability',
        'Emergency: Database is down',
        'Critical bug causing data loss',
        'Hotfix needed for production issue'
      ];

      for (const request of urgentRequests) {
        const analysis = await analyzer.analyze(request);
        expect(analysis.urgency).toBeGreaterThan(0.7);
      }
    });

    it('should detect low urgency for routine tasks', async () => {
      const routineRequests = [
        'Update documentation when you have time',
        'Consider adding this feature in future',
        'Nice to have: improve user experience',
        'Enhancement for next release'
      ];

      for (const request of routineRequests) {
        const analysis = await analyzer.analyze(request);
        expect(analysis.urgency).toBeLessThan(0.5);
      }
    });
  });

  describe('Dependency Detection', () => {
    it('should identify explicit dependencies', async () => {
      const analysis = await analyzer.analyze(
        'Create user interface after implementing the backend API and database schema'
      );

      expect(analysis.dependencies).toContain('backend');
      expect(analysis.dependencies).toContain('api');
      expect(analysis.dependencies).toContain('database');
    });

    it('should detect implicit dependencies', async () => {
      const analysis = await analyzer.analyze(
        'Add authentication to the dashboard'
      );

      expect(analysis.dependencies.some(dep => dep.includes('auth') || dep.includes('login'))).toBe(true);
    });
  });

  describe('Secondary Intent Detection', () => {
    it('should identify multiple intents in complex requests', async () => {
      const analysis = await analyzer.analyze(
        'Create user registration feature and write comprehensive tests for it'
      );

      expect(analysis.primaryIntent).toBe('feature_development');
      expect(analysis.secondaryIntents).toContain('testing');
    });

    it('should detect documentation alongside development', async () => {
      const analysis = await analyzer.analyze(
        'Implement payment processing and document the API endpoints'
      );

      expect(analysis.primaryIntent).toBe('feature_development');
      expect(analysis.secondaryIntents).toContain('documentation');
    });
  });

  describe('Context Understanding', () => {
    it('should maintain context across related requests', async () => {
      // Simulate conversation context
      const context = {
        previousRequests: ['Create user model', 'Add user authentication'],
        currentProject: 'user_management',
        activeFeatures: ['auth', 'profiles']
      };

      const analysis = await analyzer.analyze(
        'Add password reset functionality',
        context
      );

      expect(analysis.context).toBeDefined();
      expect(analysis.confidence).toBeGreaterThan(0.8); // Higher confidence with context
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty or minimal input', async () => {
      const emptyAnalysis = await analyzer.analyze('');
      const minimalAnalysis = await analyzer.analyze('fix');

      expect(emptyAnalysis.confidence).toBeLessThan(0.3);
      expect(minimalAnalysis.confidence).toBeLessThan(0.6);
    });

    it('should handle very long requests', async () => {
      const longRequest = 'Create a comprehensive user management system with authentication, authorization, profile management, settings, preferences, notifications, activity logging, security features, two-factor authentication, password policies, account recovery, user roles, permissions, admin dashboard, user analytics, reporting, and integration with external services'.repeat(3);

      const analysis = await analyzer.analyze(longRequest);
      expect(analysis).toBeDefined();
      expect(analysis.keywords.length).toBeGreaterThan(10);
    });

    it('should handle non-English requests gracefully', async () => {
      const japaneseRequest = 'ユーザー認証機能を追加してください';
      const analysis = await analyzer.analyze(japaneseRequest);

      expect(analysis).toBeDefined();
      expect(analysis.confidence).toBeGreaterThan(0); // Should still provide some analysis
    });
  });

  describe('Performance', () => {
    it('should analyze requests quickly', async () => {
      const start = Date.now();
      
      await analyzer.analyze('Create a complex e-commerce platform with user management, product catalog, shopping cart, payment processing, order management, and admin dashboard');
      
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle multiple concurrent analyses', async () => {
      const requests = [
        'Fix login bug',
        'Add search feature',
        'Update documentation',
        'Refactor API code',
        'Create unit tests'
      ];

      const start = Date.now();
      
      const analyses = await Promise.all(
        requests.map(request => analyzer.analyze(request))
      );
      
      const duration = Date.now() - start;
      
      expect(analyses).toHaveLength(5);
      expect(analyses.every(a => a.confidence > 0)).toBe(true);
      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
    });
  });
});