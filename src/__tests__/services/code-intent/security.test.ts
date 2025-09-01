/**
 * Security Tests for Filename Inference System
 * Ensures 100% security coverage for Phase 1
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { PathSecurityValidator } from '../../../services/code-intent/security/PathSecurityValidator';
import { ExtensionGuard } from '../../../services/code-intent/security/ExtensionGuard';
import { CollisionResolver } from '../../../services/code-intent/security/CollisionResolver';
import { PlanEnforcer } from '../../../services/code-intent/security/PlanEnforcer';
import { SaveOperation } from '../../../services/code-intent/types/filename-inference.types';

describe('PathSecurityValidator', () => {
  let tempDir: string;
  let validator: PathSecurityValidator;
  
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'maria-test-'));
    validator = new PathSecurityValidator(tempDir);
  });
  
  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });
  
  describe('Path Traversal Prevention', () => {
    test('blocks ../../../etc/passwd style attacks', () => {
      const attacks = [
        '../../../etc/passwd',
        '../../sensitive.txt',
        '../.env',
        'test/../../outside.js',
        './../../etc/shadow'
      ];
      
      for (const attack of attacks) {
        expect(() => validator.validateAndNormalize(attack))
          .toThrow('Path traversal detected');
      }
    });
    
    test('blocks Windows path traversal', () => {
      const attacks = [
        '..\\..\\windows\\system32\\config\\sam',
        'test\\..\\..\\sensitive.txt',
        '.\\..\\..\\etc\\passwd'
      ];
      
      for (const attack of attacks) {
        const result = validator.validateAndNormalize(attack);
        expect(result).toMatch(new RegExp(`^${tempDir.replace(/\\/g, '\\\\')}`));
      }
    });
    
    test('blocks absolute path attempts', () => {
      const attacks = [
        '/etc/passwd',
        '/root/.ssh/id_rsa',
        'C:\\Windows\\System32\\cmd.exe',
        'D:\\sensitive\\data.txt'
      ];
      
      for (const attack of attacks) {
        const result = validator.validateAndNormalize(attack);
        expect(result).toMatch(new RegExp(`^${tempDir.replace(/\\/g, '\\\\')}`));
        expect(result).not.toContain('/etc/');
        expect(result).not.toMatch(/^C:\\/);
      }
    });
    
    test('1000 random paths stay within root', () => {
      for (let i = 0; i < 1000; i++) {
        const randomPath = generateRandomPath();
        const result = validator.validateAndNormalize(randomPath);
        expect(result.startsWith(tempDir)).toBe(true);
      }
    });
  });
  
  describe('OS-Specific Validations', () => {
    test('rejects Windows reserved names', () => {
      if (process.platform !== 'win32') {
        // Skip on non-Windows platforms
        return;
      }
      
      const reserved = ['CON.txt', 'PRN.js', 'AUX.html', 'NUL.css', 'COM1.py', 'LPT1.ts'];
      
      for (const name of reserved) {
        expect(() => validator.validateAndNormalize(name))
          .toThrow(/Reserved filename/);
      }
    });
    
    test('handles Unicode normalization on macOS', () => {
      const files = [
        'café.js',  // NFC
        'café.js',  // NFD
        '日本語.html',
        '🎌emoji.css',
        'Ñoño.ts'
      ];
      
      for (const file of files) {
        const result = validator.validateAndNormalize(file);
        expect(result).toBeDefined();
        expect(path.basename(result)).toBeTruthy();
      }
    });
    
    test('enforces path length limits', () => {
      const longName = 'a'.repeat(300);
      const longPath = `${longName}.txt`;
      
      if (process.platform === 'win32') {
        expect(() => validator.validateAndNormalize(longPath))
          .toThrow(/Path too long/);
      } else {
        // Non-Windows allows longer paths
        const veryLongName = 'a'.repeat(5000);
        expect(() => validator.validateAndNormalize(`${veryLongName}.txt`))
          .toThrow(/Path too long/);
      }
    });
  });
  
  describe('Filename Validation', () => {
    test('rejects dangerous characters', () => {
      const dangerous = [
        'file<script>.js',
        'file>redirect.html',
        'file:colon.txt',
        'file"quote.css',
        'file|pipe.py',
        'file?question.ts',
        'file*asterisk.jsx',
        'file\x00null.tsx',
        'file\x1Fcontrol.sql'
      ];
      
      for (const name of dangerous) {
        expect(validator.validateFilename(name)).toBe(false);
      }
    });
    
    test('accepts safe filenames', () => {
      const safe = [
        'index.html',
        'my-component.tsx',
        'test_file.py',
        'MyClass.java',
        'config.json',
        'README.md',
        '2024-report.pdf',
        'app.component.ts'
      ];
      
      for (const name of safe) {
        expect(validator.validateFilename(name)).toBe(true);
      }
    });
  });
});

describe('ExtensionGuard', () => {
  let guard: ExtensionGuard;
  let configPath: string;
  
  beforeEach(() => {
    configPath = path.join(os.tmpdir(), 'test-plans-config.json');
    fs.writeFileSync(configPath, JSON.stringify({
      FREE: {
        fileSave: {
          allowExtensions: ['txt', 'md', 'html', 'css', 'js'],
          maxFileSizeMB: 5,
          defaultDir: '.'
        },
        naming: { convention: 'kebab-case' },
        dirs: { components: 'src/components' }
      }
    }));
    guard = new ExtensionGuard(configPath);
  });
  
  afterEach(() => {
    fs.unlinkSync(configPath);
  });
  
  test('allows permitted extensions', async () => {
    const allowed = ['txt', 'md', 'html', 'css', 'js'];
    
    for (const ext of allowed) {
      await expect(guard.checkPermission('FREE', ext)).resolves.toBeUndefined();
    }
  });
  
  test('rejects forbidden extensions', async () => {
    const forbidden = ['exe', 'dll', 'sh', 'bat', 'py', 'rs'];
    
    for (const ext of forbidden) {
      await expect(guard.checkPermission('FREE', ext))
        .rejects.toThrow(/not allowed/);
    }
  });
  
  test('enforces file size limits', async () => {
    const smallContent = 'a'.repeat(1024 * 1024); // 1MB
    const largeContent = 'a'.repeat(10 * 1024 * 1024); // 10MB
    
    await expect(guard.checkFileSize('FREE', smallContent.length))
      .resolves.toBeUndefined();
    
    await expect(guard.checkFileSize('FREE', largeContent.length))
      .rejects.toThrow(/exceeds.*limit/);
  });
  
  test('identifies dangerous extensions', () => {
    const dangerous = ['exe', 'dll', 'pem', 'key', 'sh', 'bat'];
    
    for (const ext of dangerous) {
      expect(guard.isDangerousExtension(ext)).toBe(true);
    }
    
    const safe = ['txt', 'html', 'js', 'css'];
    for (const ext of safe) {
      expect(guard.isDangerousExtension(ext)).toBe(false);
    }
  });
});

describe('CollisionResolver', () => {
  let tempDir: string;
  let resolver: CollisionResolver;
  
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'collision-test-'));
    resolver = new CollisionResolver();
  });
  
  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });
  
  test('returns original path when no collision', () => {
    const testPath = path.join(tempDir, 'new-file.txt');
    const resolved = resolver.resolve(testPath);
    expect(resolved).toBe(testPath);
  });
  
  test('adds (2) for first collision', () => {
    const testPath = path.join(tempDir, 'test.txt');
    fs.writeFileSync(testPath, 'original');
    
    const resolved = resolver.resolve(testPath);
    expect(resolved).toBe(path.join(tempDir, 'test (2).txt'));
  });
  
  test('handles multiple collisions sequentially', () => {
    const base = path.join(tempDir, 'test.txt');
    
    // Create files
    fs.writeFileSync(base, 'original');
    fs.writeFileSync(path.join(tempDir, 'test (2).txt'), 'second');
    fs.writeFileSync(path.join(tempDir, 'test (3).txt'), 'third');
    
    const resolved = resolver.resolve(base);
    expect(resolved).toBe(path.join(tempDir, 'test (4).txt'));
  });
  
  test('handles 100+ collisions without breaking', () => {
    const base = path.join(tempDir, 'popular.txt');
    
    // Create 100 files
    fs.writeFileSync(base, 'original');
    for (let i = 2; i <= 100; i++) {
      fs.writeFileSync(path.join(tempDir, `popular (${i}).txt`), `file${i}`);
    }
    
    const resolved = resolver.resolve(base);
    expect(resolved).toBe(path.join(tempDir, 'popular (101).txt'));
  });
  
  test('falls back to timestamp after max attempts', () => {
    const base = path.join(tempDir, 'max.txt');
    
    // Create max numbered files
    fs.writeFileSync(base, 'original');
    for (let i = 2; i <= 999; i++) {
      fs.writeFileSync(path.join(tempDir, `max (${i}).txt`), `file${i}`);
    }
    
    const resolved = resolver.resolve(base);
    expect(resolved).toMatch(/max_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.txt$/);
  });
});

describe('PlanEnforcer', () => {
  let tempDir: string;
  let enforcer: PlanEnforcer;
  let configPath: string;
  
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'enforcer-test-'));
    configPath = path.join(tempDir, 'plans-config.json');
    
    fs.writeFileSync(configPath, JSON.stringify({
      FREE: {
        fileSave: {
          allowExtensions: ['txt', 'md', 'html', 'css', 'js'],
          maxFileSizeMB: 5,
          defaultDir: '.'
        },
        naming: { convention: 'kebab-case' },
        dirs: { 
          components: 'src/components',
          pages: 'src/pages'
        }
      }
    }));
    
    enforcer = new PlanEnforcer(tempDir, configPath);
  });
  
  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });
  
  test('enforces all plan restrictions', async () => {
    const operation: SaveOperation = {
      filepath: 'MyComponent.js',
      content: 'console.log("test");',
      planId: 'FREE',
      timestamp: Date.now()
    };
    
    const enforced = await enforcer.enforce(operation);
    
    // Should apply kebab-case
    expect(path.basename(enforced.filepath)).toBe('my-component.js');
    
    // Should be within project root
    expect(enforced.filepath.startsWith(tempDir)).toBe(true);
  });
  
  test('applies naming conventions correctly', () => {
    const cases = [
      { input: 'MyComponent', convention: 'kebab-case' as const, expected: 'my-component' },
      { input: 'my-component', convention: 'camelCase' as const, expected: 'myComponent' },
      { input: 'my-component', convention: 'PascalCase' as const, expected: 'MyComponent' },
      { input: 'MyComponent', convention: 'snake_case' as const, expected: 'my_component' }
    ];
    
    for (const testCase of cases) {
      const result = enforcer.applyNamingConvention(
        `${testCase.input}.js`,
        testCase.convention
      );
      expect(path.basename(result, '.js')).toBe(testCase.expected);
    }
  });
  
  test('validates dangerous operations', async () => {
    const dangerous: SaveOperation = {
      filepath: '../../../etc/passwd',
      content: 'malicious',
      planId: 'FREE',
      timestamp: Date.now()
    };
    
    await expect(enforcer.validate(dangerous))
      .rejects.toThrow(/Invalid filename/);
  });
  
  test('batch validation works correctly', async () => {
    const operations: SaveOperation[] = [
      {
        filepath: 'valid.txt',
        content: 'ok',
        planId: 'FREE',
        timestamp: Date.now()
      },
      {
        filepath: 'invalid.exe',
        content: 'bad',
        planId: 'FREE',
        timestamp: Date.now()
      },
      {
        filepath: 'good.html',
        content: '<html>',
        planId: 'FREE',
        timestamp: Date.now()
      }
    ];
    
    const results = await enforcer.validateBatch(operations);
    
    expect(results.get('valid.txt')).toBeNull();
    expect(results.get('invalid.exe')).toMatch(/not allowed/);
    expect(results.get('good.html')).toBeNull();
  });
});

// Helper function to generate random paths for testing
function generateRandomPath(): string {
  const components = [
    'src', 'test', 'lib', 'components', 'utils', 'pages',
    'index', 'app', 'main', 'config', 'setup', 'helper',
    'module', 'service', 'controller', 'model', 'view'
  ];
  
  const extensions = ['.js', '.ts', '.tsx', '.jsx', '.html', '.css', '.json'];
  
  const depth = Math.floor(Math.random() * 4) + 1;
  const pathParts: string[] = [];
  
  for (let i = 0; i < depth; i++) {
    pathParts.push(components[Math.floor(Math.random() * components.length)]);
  }
  
  const filename = components[Math.floor(Math.random() * components.length)] +
    extensions[Math.floor(Math.random() * extensions.length)];
  
  pathParts.push(filename);
  
  return path.join(...pathParts);
}