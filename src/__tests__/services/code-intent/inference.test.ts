/**
 * Inference Tests for Filename Inference System
 * Tests the 5-stage pipeline, timeout control, and caching
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { FilenameInferenceService } from '../../../services/code-intent/FilenameInferenceService';
import { ExplicitAnalyzer } from '../../../services/code-intent/analyzers/ExplicitAnalyzer';
import { ContextualAnalyzer } from '../../../services/code-intent/analyzers/ContextualAnalyzer';
import { SemanticAnalyzer } from '../../../services/code-intent/analyzers/SemanticAnalyzer';
import { ExtensionDetector } from '../../../services/code-intent/analyzers/ExtensionDetector';
import { LRUCache } from '../../../services/code-intent/cache/LRUCache';
import { ProjectContext } from '../../../services/code-intent/types/filename-inference.types';

describe('FilenameInferenceService', () => {
  let service: FilenameInferenceService;
  let context: ProjectContext;

  beforeEach(() => {
    service = new FilenameInferenceService();
    context = {
      root: '/test/project',
      planId: 'FREE'
    };
  });

  describe('Explicit filename detection', () => {
    test('detects explicitly specified filenames', async () => {
      const result = await service.inferFilename(
        'create index.html file',
        '<!DOCTYPE html><html></html>',
        context
      );

      expect(result.candidates[0].filename).toBe('index.html');
      expect(result.candidates[0].confidence).toBeGreaterThan(0.9);
      expect(result.mode).toBe('immediate');
    });

    test('detects Japanese explicit specifications', async () => {
      const result = await service.inferFilename(
        'tetris.htmlで作って',
        '<!DOCTYPE html>',
        context
      );

      expect(result.candidates[0].filename).toBe('tetris.html');
      expect(result.candidates[0].source).toBe('explicit');
    });

    test('detects quoted filenames with high confidence', async () => {
      const result = await service.inferFilename(
        'save as "config.json"',
        '{"name": "test"}',
        context
      );

      expect(result.candidates[0].filename).toBe('config.json');
      expect(result.candidates[0].confidence).toBeGreaterThan(0.95);
    });
  });

  describe('Contextual inference', () => {
    test('infers filename from context keywords', async () => {
      const result = await service.inferFilename(
        'create a login page',
        '<form></form>',
        context
      );

      expect(result.candidates[0].filename).toMatch(/login/i);
      expect(result.candidates[0].extension).toMatch(/\.html|\.tsx/);
    });

    test('infers game files correctly', async () => {
      const result = await service.inferFilename(
        'テトリスゲームを作成',
        '<canvas></canvas>',
        context
      );

      expect(result.candidates[0].filename).toMatch(/tetris/i);
    });
  });

  describe('Semantic analysis', () => {
    test('infers React component names', async () => {
      const code = `
        export default function Button() {
          return <button>Click me</button>;
        }
      `;

      const result = await service.inferFilename(
        'create a component',
        code,
        context
      );

      expect(result.candidates[0].filename).toMatch(/Button/);
      expect(result.candidates[0].extension).toBe('.tsx');
    });

    test('infers Python script names', async () => {
      const code = `
        def main():
            print("Hello World")
        
        if __name__ == "__main__":
            main()
      `;

      const result = await service.inferFilename(
        'create a script',
        code,
        context
      );

      expect(result.candidates[0].extension).toBe('.py');
    });
  });

  describe('Timeout control', () => {
    test('respects 100ms timeout limit', async () => {
      // Mock a slow analyzer
      const slowAnalyzer = {
        analyze: async () => {
          await new Promise(resolve => setTimeout(resolve, 200));
          return null;
        }
      };

      // Replace one analyzer with slow one
      (service as any).stages[3].analyzer = slowAnalyzer;

      const startTime = Date.now();
      await service.inferFilename('test', 'code', context);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(150); // Should timeout before 150ms
    });

    test('completes quickly for cached results', async () => {
      // First call - will be cached
      await service.inferFilename('test prompt', 'test code', context);

      // Second call - should be from cache
      const startTime = Date.now();
      const result = await service.inferFilename('test prompt', 'test code', context);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(5); // Cache hit should be instant
      expect(result).toBeDefined();
    });
  });

  describe('Save mode determination', () => {
    test('returns immediate mode for high confidence', async () => {
      const result = await service.inferFilename(
        'save as "exact-name.js"',
        'console.log("test")',
        context
      );

      expect(result.mode).toBe('immediate');
    });

    test('returns interactive mode for medium confidence', async () => {
      const result = await service.inferFilename(
        'create some kind of utility',
        'function helper() {}',
        context
      );

      // Confidence will be medium
      if (result.candidates[0].confidence < 0.9 && result.candidates[0].confidence >= 0.7) {
        expect(result.mode).toBe('interactive');
      }
    });

    test('returns dry-run mode for low confidence', async () => {
      const result = await service.inferFilename(
        'something vague',
        'var x = 1;',
        context
      );

      if (result.candidates[0].confidence < 0.7) {
        expect(result.mode).toBe('dry-run');
      }
    });
  });
});

describe('ExplicitAnalyzer', () => {
  let analyzer: ExplicitAnalyzer;
  let context: ProjectContext;

  beforeEach(() => {
    analyzer = new ExplicitAnalyzer();
    context = { root: '/test' };
  });

  test('extracts filenames from various patterns', async () => {
    const patterns = [
      { prompt: 'create index.html', expected: 'index.html' },
      { prompt: 'save as config.json', expected: 'config.json' },
      { prompt: 'name it app.js', expected: 'app.js' },
      { prompt: 'main.pyというファイル', expected: 'main.py' },
      { prompt: 'style.cssで', expected: 'style.css' }
    ];

    for (const { prompt, expected } of patterns) {
      const result = await analyzer.analyze(prompt, '', context);
      expect(result?.filename).toBe(expected);
    }
  });

  test('returns null for prompts without explicit filenames', async () => {
    const result = await analyzer.analyze('create a webpage', '', context);
    expect(result).toBeNull();
  });
});

describe('ExtensionDetector', () => {
  let detector: ExtensionDetector;

  beforeEach(() => {
    detector = new ExtensionDetector();
  });

  test('detects HTML from DOCTYPE', async () => {
    const result = await detector.detect('<!DOCTYPE html>', { root: '.' });
    expect(result.ext).toBe('.html');
    expect(result.confidence).toBeGreaterThan(0.9);
  });

  test('detects TypeScript from type annotations', async () => {
    const code = 'interface User { name: string; age: number; }';
    const result = await detector.detect(code, { root: '.' });
    expect(result.ext).toBe('.ts');
  });

  test('detects React TSX from JSX + TypeScript', async () => {
    const code = `
      import React from 'react';
      const Component: React.FC = () => <div />;
    `;
    const result = await detector.detect(code, { root: '.' });
    expect(result.ext).toBe('.tsx');
  });

  test('detects Python from imports and def', async () => {
    const code = `
      import numpy as np
      def calculate():
          pass
    `;
    const result = await detector.detect(code, { root: '.' });
    expect(result.ext).toBe('.py');
  });

  test('validates extensions correctly', () => {
    expect(detector.isValidExtension('.js')).toBe(true);
    expect(detector.isValidExtension('.html')).toBe(true);
    expect(detector.isValidExtension('.xyz')).toBe(false);
    expect(detector.isValidExtension('.exe')).toBe(false);
  });
});

describe('LRUCache', () => {
  let cache: LRUCache<string, any>;

  beforeEach(() => {
    cache = new LRUCache(3); // Small cache for testing
  });

  test('stores and retrieves values', () => {
    cache.set('key1', 'value1');
    expect(cache.get('key1')).toBe('value1');
  });

  test('evicts least recently used items', () => {
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    cache.set('key3', 'value3');
    
    // Access key1 to make it more recent
    cache.get('key1');
    
    // Add key4, should evict key2 (LRU)
    cache.set('key4', 'value4');
    
    expect(cache.has('key1')).toBe(true);
    expect(cache.has('key2')).toBe(false); // Evicted
    expect(cache.has('key3')).toBe(true);
    expect(cache.has('key4')).toBe(true);
  });

  test('updates access order on get', () => {
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    cache.set('key3', 'value3');
    
    // Access key1 multiple times
    cache.get('key1');
    cache.get('key1');
    
    // Add key4, should evict key2 (less recently used than key1)
    cache.set('key4', 'value4');
    
    expect(cache.has('key1')).toBe(true);
    expect(cache.has('key2')).toBe(false);
  });

  test('provides accurate statistics', () => {
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    
    const stats = cache.getStats();
    expect(stats.size).toBe(2);
    expect(stats.maxSize).toBe(3);
    expect(stats.utilization).toBeCloseTo(0.67, 1);
  });
});

describe('ContextualAnalyzer', () => {
  let analyzer: ContextualAnalyzer;
  let context: ProjectContext;

  beforeEach(() => {
    analyzer = new ContextualAnalyzer();
    context = { root: '/test' };
  });

  test('suggests appropriate filenames for common patterns', async () => {
    const tests = [
      { prompt: 'create a login form', expected: /login/ },
      { prompt: 'build a dashboard', expected: /dashboard/ },
      { prompt: 'make an API endpoint', expected: /api/ },
      { prompt: 'テトリスゲーム', expected: /tetris/ }
    ];

    for (const { prompt, expected } of tests) {
      const result = await analyzer.analyze(prompt, '', context);
      expect(result?.filename).toMatch(expected);
    }
  });

  test('suggests appropriate directories', async () => {
    const componentResult = await analyzer.analyze('create a button component', '', context);
    expect(componentResult?.directory).toMatch(/components/);

    const apiResult = await analyzer.analyze('create an API route', '', context);
    expect(apiResult?.directory).toMatch(/api/);
  });
});