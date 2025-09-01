/**
 * Phase 4 E2E Integration Tests
 * Tests the complete /code command with filename inference integration
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

// Import the actual services for testing
import { FilenameUXOrchestrator } from '../../../../services/code-intent/FilenameUXOrchestrator';
import { ProjectContext } from '../../../../services/code-intent/types/filename-inference.types';

describe('Phase 4: /code Integration E2E Tests', () => {
  let tempDir: string;
  let uxOrchestrator: FilenameUXOrchestrator;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'maria-code-e2e-'));
    
    // Create mock project structure
    fs.mkdirSync(path.join(tempDir, 'src'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, 'src', 'components'), { recursive: true });
    fs.writeFileSync(
      path.join(tempDir, 'package.json'),
      JSON.stringify({
        name: 'test-project',
        dependencies: {
          react: '^18.0.0',
          typescript: '^4.0.0'
        }
      })
    );
    
    // Initialize UX orchestrator with temp directory (avoid process.chdir in workers)
    uxOrchestrator = new FilenameUXOrchestrator(tempDir);
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Complete /code Integration Workflow', () => {
    test('handles React component generation with automatic filename', async () => {
      const prompt = 'create a UserCard React component';
      const generatedCode = `
import React from 'react';

interface UserCardProps {
  name: string;
  email: string;
}

export default function UserCard({ name, email }: UserCardProps) {
  return (
    <div className="user-card">
      <h3>{name}</h3>
      <p>{email}</p>
    </div>
  );
}
`;

      const projectContext: ProjectContext = {
        root: tempDir,
        directory: path.join(tempDir, 'src', 'components'),
        existingFiles: [],
        planId: 'FREE',
        framework: 'react',
        language: 'typescript'
      };

      const planConfig = {
        fileSave: {
          allowExtensions: ['tsx', 'ts', 'js', 'jsx'],
          maxFileSizeMB: 1,
          defaultDir: 'src'
        },
        naming: {
          convention: 'PascalCase'
        }
      };

      const uxOptions = {
        saveMode: { dryRun: false, force: false, interactive: false },
        selection: { showConfidence: true, allowCustom: true, allowCancel: true },
        verbose: false
      };

      const result = await uxOrchestrator.orchestrate(
        prompt,
        generatedCode,
        projectContext,
        planConfig,
        uxOptions
      );

      expect(result.success).toBe(true);
      expect(result.path).toMatch(/UserCard\.tsx$/);
      expect(fs.existsSync(result.path!)).toBe(true);
      
      const savedContent = fs.readFileSync(result.path!, 'utf-8');
      expect(savedContent).toContain('UserCard');
      expect(savedContent).toContain('interface UserCardProps');
    });

    test('handles dry-run mode correctly', async () => {
      const prompt = 'create a utility function';
      const generatedCode = `
export function formatDate(date: Date): string {
  return date.toLocaleDateString();
}
`;

      const projectContext: ProjectContext = {
        root: tempDir,
        directory: path.join(tempDir, 'src'),
        existingFiles: [],
        planId: 'FREE'
      };

      const planConfig = {
        fileSave: {
          allowExtensions: ['ts', 'js'],
          maxFileSizeMB: 0.1,
          defaultDir: 'src'
        }
      };

      const uxOptions = {
        saveMode: { dryRun: true, force: false, interactive: false },
        selection: { showConfidence: true },
        dryRun: { showConflicts: true, showPlanCompliance: true },
        verbose: true
      };

      const result = await uxOrchestrator.orchestrate(
        prompt,
        generatedCode,
        projectContext,
        planConfig,
        uxOptions
      );

      expect(result.success).toBe(true);
      expect(result.mode).toBe('dry-run');
      expect(result.suggested).toBeDefined();
      expect(result.suggested!.length).toBeGreaterThan(0);
      expect(result.suggested![0].filename).toMatch(/\.ts$/);
      
      // Ensure no file was actually created
      expect(result.path).toBeUndefined();
    });

    test('handles error recovery gracefully', async () => {
      const prompt = 'create a component with invalid path';
      const generatedCode = 'export default function Component() { return <div />; }';

      const projectContext: ProjectContext = {
        root: tempDir,
        directory: '/invalid/path/that/does/not/exist',
        existingFiles: [],
        planId: 'FREE'
      };

      const planConfig = {
        fileSave: {
          allowExtensions: ['tsx'],
          maxFileSizeMB: 1,
          defaultDir: 'src'
        }
      };

      const uxOptions = {
        saveMode: { dryRun: false, force: false, interactive: false },
        verbose: true
      };

      const result = await uxOrchestrator.orchestrate(
        prompt,
        generatedCode,
        projectContext,
        planConfig,
        uxOptions
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Permission denied');
    });

    test('integrates with plan restrictions correctly', async () => {
      const prompt = 'create a Python script';
      const generatedCode = 'print("Hello, World!")';

      const projectContext: ProjectContext = {
        root: tempDir,
        directory: tempDir,
        existingFiles: [],
        planId: 'FREE'
      };

      // Restrictive plan that doesn't allow .py files
      const planConfig = {
        fileSave: {
          allowExtensions: ['js', 'ts', 'html', 'css'],
          maxFileSizeMB: 0.1,
          defaultDir: '.'
        }
      };

      const uxOptions = {
        saveMode: { dryRun: false, force: false, interactive: false },
        verbose: true
      };

      const result = await uxOrchestrator.orchestrate(
        prompt,
        generatedCode,
        projectContext,
        planConfig,
        uxOptions
      );

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/not allowed/i);
    });

    test('handles interactive mode selection', async () => {
      const prompt = 'create some code';
      const generatedCode = 'console.log("Hello");';

      const projectContext: ProjectContext = {
        root: tempDir,
        directory: tempDir,
        existingFiles: [],
        planId: 'FREE'
      };

      const planConfig = {
        fileSave: {
          allowExtensions: ['js', 'ts'],
          maxFileSizeMB: 1,
          defaultDir: '.'
        }
      };

      const uxOptions = {
        saveMode: { dryRun: false, force: false, interactive: true },
        selection: { showConfidence: true, allowCustom: true, allowCancel: true },
        verbose: true
      };

      // Mock user input to select first option
      vi.spyOn(process.stdin, 'read').mockReturnValue('1\n');
      
      const result = await uxOrchestrator.orchestrate(
        prompt,
        generatedCode,
        projectContext,
        planConfig,
        uxOptions
      );

      expect(result.success).toBe(true);
      expect(result.selectionTime).toBeDefined();
    });

    test('integrates telemetry tracking correctly', async () => {
      const prompt = 'create a simple function';
      const generatedCode = 'function test() { return true; }';

      const projectContext: ProjectContext = {
        root: tempDir,
        directory: tempDir,
        existingFiles: [],
        planId: 'FREE'
      };

      const planConfig = {
        fileSave: {
          allowExtensions: ['js'],
          maxFileSizeMB: 1,
          defaultDir: '.'
        }
      };

      const uxOptions = {
        saveMode: { dryRun: false, force: false, interactive: false },
        verbose: false
      };

      const result = await uxOrchestrator.orchestrate(
        prompt,
        generatedCode,
        projectContext,
        planConfig,
        uxOptions
      );

      expect(result.success).toBe(true);
      expect(result.telemetry).toBeDefined();
      expect(result.telemetry?.inferenceLatency).toBeGreaterThan(0);
      expect(result.telemetry?.stageLatencies).toBeDefined();
    });

    test('handles undo functionality integration', async () => {
      const prompt = 'create a test file';
      const generatedCode = 'const test = true;';

      const projectContext: ProjectContext = {
        root: tempDir,
        directory: tempDir,
        existingFiles: [],
        planId: 'FREE'
      };

      const planConfig = {
        fileSave: {
          allowExtensions: ['js'],
          maxFileSizeMB: 1,
          defaultDir: '.'
        }
      };

      const uxOptions = {
        saveMode: { dryRun: false, force: false, interactive: false },
        skipBackup: false,
        verbose: false
      };

      // Create the file first
      const result = await uxOrchestrator.orchestrate(
        prompt,
        generatedCode,
        projectContext,
        planConfig,
        uxOptions
      );

      expect(result.success).toBe(true);
      expect(result.undoId).toBeDefined();
      expect(fs.existsSync(result.path!)).toBe(true);

      // Now test undo
      const undoResult = await uxOrchestrator.undo();
      expect(undoResult.success).toBe(true);
      expect(fs.existsSync(result.path!)).toBe(false);
    });
  });

  describe('Real-world Scenarios', () => {
    test('handles complex React component with TypeScript', async () => {
      const prompt = 'create a LoginForm component with validation';
      const generatedCode = `
import React, { useState } from 'react';

interface LoginFormProps {
  onSubmit: (email: string, password: string) => Promise<void>;
}

interface FormState {
  email: string;
  password: string;
  errors: Record<string, string>;
}

export default function LoginForm({ onSubmit }: LoginFormProps) {
  const [state, setState] = useState<FormState>({
    email: '',
    password: '',
    errors: {}
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      await onSubmit(state.email, state.password);
    }
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!state.email.includes('@')) {
      errors.email = 'Invalid email';
    }
    
    if (state.password.length < 8) {
      errors.password = 'Password too short';
    }
    
    setState(prev => ({ ...prev, errors }));
    return Object.keys(errors).length === 0;
  };

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <input 
          type="email" 
          value={state.email}
          onChange={e => setState(prev => ({ ...prev, email: e.target.value }))}
          placeholder="Email"
        />
        {state.errors.email && <span>{state.errors.email}</span>}
      </div>
      <div>
        <input 
          type="password" 
          value={state.password}
          onChange={e => setState(prev => ({ ...prev, password: e.target.value }))}
          placeholder="Password"
        />
        {state.errors.password && <span>{state.errors.password}</span>}
      </div>
      <button type="submit">Login</button>
    </form>
  );
}
`;

      const projectContext: ProjectContext = {
        root: tempDir,
        directory: path.join(tempDir, 'src', 'components'),
        existingFiles: ['UserCard.tsx'],
        planId: 'FREE',
        framework: 'react',
        language: 'typescript'
      };

      const planConfig = {
        fileSave: {
          allowExtensions: ['tsx', 'ts'],
          maxFileSizeMB: 2,
          defaultDir: 'src'
        },
        naming: {
          convention: 'PascalCase'
        }
      };

      const uxOptions = {
        saveMode: { dryRun: false, force: false, interactive: false },
        verbose: true
      };

      const result = await uxOrchestrator.orchestrate(
        prompt,
        generatedCode,
        projectContext,
        planConfig,
        uxOptions
      );

      expect(result.success).toBe(true);
      expect(result.path).toMatch(/LoginForm\.tsx$/);
      expect(result.confidence).toBeGreaterThan(0.8);
      
      const savedContent = fs.readFileSync(result.path!, 'utf-8');
      expect(savedContent).toContain('LoginForm');
      expect(savedContent).toContain('interface LoginFormProps');
    });

    test('handles utility functions with proper naming', async () => {
      const prompt = 'create date formatting utilities';
      const generatedCode = `
export function formatDate(date: Date, format: 'short' | 'long' = 'short'): string {
  if (format === 'long') {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
  return date.toLocaleDateString('en-US');
}

export function parseDate(dateString: string): Date | null {
  const parsed = new Date(dateString);
  return isNaN(parsed.getTime()) ? null : parsed;
}

export function isValidDate(date: any): date is Date {
  return date instanceof Date && !isNaN(date.getTime());
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}
`;

      const projectContext: ProjectContext = {
        root: tempDir,
        directory: path.join(tempDir, 'src', 'utils'),
        existingFiles: [],
        planId: 'FREE',
        language: 'typescript'
      };

      // Create utils directory
      fs.mkdirSync(path.join(tempDir, 'src', 'utils'), { recursive: true });

      const planConfig = {
        fileSave: {
          allowExtensions: ['ts', 'js'],
          maxFileSizeMB: 1,
          defaultDir: 'src'
        },
        naming: {
          convention: 'kebab-case'
        }
      };

      const uxOptions = {
        saveMode: { dryRun: false, force: false, interactive: false },
        verbose: false
      };

      const result = await uxOrchestrator.orchestrate(
        prompt,
        generatedCode,
        projectContext,
        planConfig,
        uxOptions
      );

      expect(result.success).toBe(true);
      expect(result.path).toMatch(/date.*util.*\.ts$/);
      
      const savedContent = fs.readFileSync(result.path!, 'utf-8');
      expect(savedContent).toContain('formatDate');
      expect(savedContent).toContain('parseDate');
    });
  });

  describe('Error Handling Integration', () => {
    test('provides comprehensive error information', async () => {
      const prompt = 'create code with restricted extension';
      const generatedCode = '#!/bin/bash\necho "Hello"';

      const projectContext: ProjectContext = {
        root: tempDir,
        directory: tempDir,
        existingFiles: [],
        planId: 'FREE'
      };

      const planConfig = {
        fileSave: {
          allowExtensions: ['js', 'ts'],
          maxFileSizeMB: 0.1,
          defaultDir: '.'
        }
      };

      const uxOptions = {
        saveMode: { dryRun: false, force: false, interactive: false },
        verbose: true
      };

      const result = await uxOrchestrator.orchestrate(
        prompt,
        generatedCode,
        projectContext,
        planConfig,
        uxOptions
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.suggested).toBeDefined();
      
      // Error should suggest alternatives
      const errorMsg = result.error!.toLowerCase();
      expect(errorMsg).toMatch(/not allowed|restricted|plan/);
    });
  });
});