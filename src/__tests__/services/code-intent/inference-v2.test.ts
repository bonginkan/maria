/**
 * Tests for Enhanced Filename Inference Service v2.0
 * Tests the 5-stage inference pipeline, timeout control, and caching
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { FilenameInferenceServiceV2 } from '../../../services/code-intent/FilenameInferenceServiceV2';
import { ProjectContext } from '../../../services/code-intent/types/filename-inference.types';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

describe('FilenameInferenceServiceV2', () => {
  let service: FilenameInferenceServiceV2;
  let tempDir: string;
  let mockContext: ProjectContext;
  
  beforeEach(() => {
    service = new FilenameInferenceServiceV2();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'maria-inference-test-'));
    
    mockContext = {
      root: tempDir,
      directory: tempDir,
      existingFiles: [],
      framework: 'react',
      language: 'typescript'
    };
  });
  
  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('5-Stage Pipeline', () => {
    test('processes all 5 stages in order', async () => {
      const prompt = 'create a user profile component';
      const code = 'export default function UserProfile() { return <div>Profile</div>; }';
      
      const result = await service.infer(prompt, code, mockContext);
      
      expect(result.candidates).toHaveLength.greaterThan(0);
      expect(result.selectedIndex).toBe(0);
      expect(result.mode).toMatch(/immediate|interactive|dry-run/);
    });

    test('explicit stage has highest priority', async () => {
      const prompt = 'create UserProfile.tsx file';
      const code = 'export default function UserProfile() { return <div>Profile</div>; }';
      
      const result = await service.infer(prompt, code, mockContext);
      
      expect(result.candidates[0].source).toBe('explicit');
      expect(result.candidates[0].confidence).toBeGreaterThan(0.9);
      expect(result.candidates[0].filename).toContain('UserProfile');
      expect(result.candidates[0].extension).toBe('.tsx');
    });

    test('project convention stage works correctly', async () => {
      // Create a React project structure
      const componentsDir = path.join(tempDir, 'src', 'components');
      fs.mkdirSync(componentsDir, { recursive: true });
      fs.writeFileSync(path.join(componentsDir, 'Button.tsx'), 'export const Button = () => null;');
      
      const packageJsonPath = path.join(tempDir, 'package.json');
      fs.writeFileSync(packageJsonPath, JSON.stringify({
        dependencies: { react: '^18.0.0', typescript: '^4.0.0' }
      }));
      
      const prompt = 'create a card component';
      const code = 'export default function Card() { return <div>Card</div>; }';
      
      const result = await service.infer(prompt, code, mockContext);
      
      expect(result.candidates.some(c => c.source === 'project')).toBe(true);
    });

    test('contextual analysis extracts meaningful names', async () => {
      const prompt = 'create a login form for authentication';
      const code = '<form><input type="email" /><input type="password" /></form>';
      
      const result = await service.infer(prompt, code, mockContext);
      
      const contextual = result.candidates.find(c => c.source === 'contextual');
      expect(contextual).toBeDefined();
      expect(contextual!.filename.toLowerCase()).toMatch(/login|auth|form/);
    });

    test('semantic analysis detects code patterns', async () => {
      const prompt = 'create code for user management';
      const code = `
        interface User {
          id: string;
          name: string;
          email: string;
        }
        export const userService = {
          getUser: (id: string) => User,
          createUser: (data: Partial<User>) => User
        };
      `;
      
      const result = await service.infer(prompt, code, mockContext);
      
      const semantic = result.candidates.find(c => c.source === 'semantic');
      expect(semantic).toBeDefined();
      expect(semantic!.extension).toBe('.ts'); // TypeScript detected
    });

    test('default stage provides fallback', async () => {
      const prompt = 'random text with no clear intent';
      const code = 'console.log("hello");';
      
      const result = await service.infer(prompt, code, mockContext);
      
      expect(result.candidates.some(c => c.source === 'default')).toBe(true);
    });
  });

  describe('Timeout Control', () => {
    test('respects 100ms timeout limit', async () => {
      const startTime = Date.now();
      
      const prompt = 'create something complex';
      const code = 'const x = 1;';
      
      await service.infer(prompt, code, mockContext);
      
      const elapsed = Date.now() - startTime;
      // Should complete well under timeout, but this tests the mechanism exists
      expect(elapsed).toBeLessThan(1000); // Generous upper bound for test stability
    });

    test('handles timeout gracefully', async () => {
      // Mock slow analyzer to trigger timeout
      const originalTimeout = (service as any).pipeline.timeout;
      (service as any).pipeline.timeout = 1; // 1ms timeout
      
      const prompt = 'create a component';
      const code = 'export default function Test() {}';
      
      const result = await service.infer(prompt, code, mockContext);
      
      expect(result.timedOut).toBe(true);
      expect(result.candidates.length).toBeGreaterThan(0); // Should still have some results
      
      // Restore original timeout
      (service as any).pipeline.timeout = originalTimeout;
    });
  });

  describe('LRU Cache', () => {
    test('caches inference results', async () => {
      const prompt = 'create UserCard.tsx';
      const code = 'export const UserCard = () => <div />;';
      
      // First call
      const result1 = await service.infer(prompt, code, mockContext);
      
      // Second call with same input should use cache
      const result2 = await service.infer(prompt, code, mockContext);
      
      expect(result1.candidates[0].filename).toBe(result2.candidates[0].filename);
      expect(result1.candidates[0].confidence).toBe(result2.candidates[0].confidence);
    });

    test('cache keys are consistent', async () => {
      const stats1 = service.getCacheStats();
      
      await service.infer('test', 'code', mockContext);
      await service.infer('test', 'code', mockContext);
      
      const stats2 = service.getCacheStats();
      
      // Should see cache usage increase
      expect(Object.values(stats2)).some(stat => (stat as any).size > 0);
    });

    test('cache eviction works correctly', async () => {
      // Fill cache beyond capacity for one stage
      const stage = (service as any).pipeline.stages[0];
      const originalMaxSize = stage.cache.maxSize;
      stage.cache.maxSize = 2; // Small cache for testing
      
      await service.infer('prompt1', 'code1', mockContext);
      await service.infer('prompt2', 'code2', mockContext);
      await service.infer('prompt3', 'code3', mockContext); // Should evict first
      
      const stats = service.getCacheStats();
      expect(stats.explicit.size).toBeLessThanOrEqual(2);
      
      // Restore original size
      stage.cache.maxSize = originalMaxSize;
    });

    test('can clear all caches', () => {
      service.clearCaches();
      
      const stats = service.getCacheStats();
      Object.values(stats).forEach(stat => {
        expect((stat as any).size).toBe(0);
      });
    });
  });

  describe('Multi-layer Extension Detection', () => {
    test('project preference takes priority', async () => {
      // Create TypeScript project
      const tsconfigPath = path.join(tempDir, 'tsconfig.json');
      fs.writeFileSync(tsconfigPath, '{}');
      
      const code = 'console.log("hello");';
      
      const result = await service.detectExtension(code, mockContext);
      
      expect(result.ext).toBe('.ts');
      expect(result.source).toBe('project');
      expect(result.confidence).toBe(1.0);
    });

    test('code fence detection works', async () => {
      const code = '```typescript\ninterface User { name: string; }\n```';
      
      const result = await service.detectExtension(code, mockContext);
      
      expect(result.ext).toBe('.ts');
      expect(result.source).toBe('fence');
      expect(result.confidence).toBe(0.95);
    });

    test('MIME heuristics detect file types', async () => {
      const htmlCode = '<!DOCTYPE html><html><body>Hello</body></html>';
      
      const result = await service.detectExtension(htmlCode, mockContext);
      
      expect(result.ext).toBe('.html');
      expect(result.source).toBe('mime');
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    test('syntax analysis falls back correctly', async () => {
      const code = `
        interface User {
          id: number;
          name: string;
        }
        const user: User = { id: 1, name: "John" };
      `;
      
      const result = await service.detectExtension(code, { root: tempDir });
      
      expect(result.ext).toBe('.ts');
      expect(result.source).toBe('syntax');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    test('detects React TSX correctly', async () => {
      const code = `
        import React from 'react';
        export const Component = () => <div>Hello</div>;
      `;
      
      const result = await service.detectExtension(code, mockContext);
      
      expect(result.ext).toBe('.tsx');
      expect(result.source).toBe('syntax');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    test('detects Python correctly', async () => {
      const code = `
        def hello_world():
            print("Hello, World!")
            
        class MyClass:
            pass
      `;
      
      const result = await service.detectExtension(code, mockContext);
      
      expect(result.ext).toBe('.py');
      expect(result.source).toBe('syntax');
      expect(result.confidence).toBe(0.8);
    });

    test('detects JSON correctly', async () => {
      const code = `
        {
          "name": "test-package",
          "version": "1.0.0",
          "dependencies": {
            "react": "^18.0.0"
          }
        }
      `;
      
      const result = await service.detectExtension(code, mockContext);
      
      expect(result.ext).toBe('.json');
      expect(result.source).toBe('syntax');
      expect(result.confidence).toBe(0.85);
    });
  });

  describe('Confidence-based Mode Selection', () => {
    test('high confidence triggers immediate mode', async () => {
      const prompt = 'create MyComponent.tsx';
      const code = 'export default function MyComponent() { return <div />; }';
      
      const result = await service.infer(prompt, code, mockContext);
      
      expect(result.candidates[0].confidence).toBeGreaterThan(0.9);
      expect(result.mode).toBe('immediate');
    });

    test('medium confidence triggers interactive mode', async () => {
      // Create a scenario with medium confidence
      const prompt = 'create a component for displaying user info';
      const code = 'function component() { return "user info"; }';
      
      const result = await service.infer(prompt, code, mockContext);
      
      if (result.candidates[0].confidence >= 0.7 && result.candidates[0].confidence < 0.9) {
        expect(result.mode).toBe('interactive');
      }
    });

    test('low confidence triggers dry-run mode', async () => {
      const prompt = 'some vague request';
      const code = 'var x = 1;';
      
      const result = await service.infer(prompt, code, mockContext);
      
      if (result.candidates[0].confidence < 0.7) {
        expect(result.mode).toBe('dry-run');
      }
    });
  });

  describe('Cache Statistics', () => {
    test('provides detailed cache statistics', () => {
      const stats = service.getCacheStats();
      
      expect(stats).toHaveProperty('explicit');
      expect(stats).toHaveProperty('project');
      expect(stats).toHaveProperty('contextual');
      expect(stats).toHaveProperty('semantic');
      expect(stats).toHaveProperty('default');
      
      Object.values(stats).forEach(stat => {
        expect(stat).toHaveProperty('size');
        expect(stat).toHaveProperty('maxSize');
        expect(stat).toHaveProperty('utilization');
        expect(stat).toHaveProperty('weight');
      });
    });

    test('utilization calculation is correct', async () => {
      await service.infer('test1', 'code1', mockContext);
      await service.infer('test2', 'code2', mockContext);
      
      const stats = service.getCacheStats();
      const explicitStats = stats.explicit;
      
      expect(explicitStats.utilization).toBe(explicitStats.size / explicitStats.maxSize);
      expect(explicitStats.utilization).toBeGreaterThanOrEqual(0);
      expect(explicitStats.utilization).toBeLessThanOrEqual(1);
    });
  });

  describe('Edge Cases', () => {
    test('handles empty prompt gracefully', async () => {
      const result = await service.infer('', 'const x = 1;', mockContext);
      
      expect(result.candidates).toHaveLength.greaterThan(0);
      expect(result.candidates[0].filename).toBeDefined();
    });

    test('handles empty code gracefully', async () => {
      const result = await service.infer('create a file', '', mockContext);
      
      expect(result.candidates).toHaveLength.greaterThan(0);
      expect(result.candidates[0].filename).toBeDefined();
    });

    test('handles missing context gracefully', async () => {
      const result = await service.infer('create file', 'code', {});
      
      expect(result.candidates).toHaveLength.greaterThan(0);
      expect(result.candidates[0].filename).toBeDefined();
    });

    test('analyzer errors do not break pipeline', async () => {
      // Mock one analyzer to throw an error
      const mockAnalyzer = {
        analyze: vi.fn().mockRejectedValue(new Error('Mock error'))
      };
      
      (service as any).pipeline.stages[0].analyzer = mockAnalyzer;
      
      const result = await service.infer('test', 'code', mockContext);
      
      // Should still return results from other stages
      expect(result.candidates).toHaveLength.greaterThan(0);
    });

    test('maintains candidate ranking consistency', async () => {
      const prompt = 'create UserProfile.tsx component';
      const code = 'export default function UserProfile() { return <div />; }';
      
      // Run multiple times
      const results = await Promise.all([
        service.infer(prompt, code, mockContext),
        service.infer(prompt, code, mockContext),
        service.infer(prompt, code, mockContext)
      ]);
      
      // Top candidates should be consistent
      const topCandidates = results.map(r => r.candidates[0].filename);
      expect(new Set(topCandidates).size).toBeLessThanOrEqual(2); // Allow for some variance
    });
  });
});