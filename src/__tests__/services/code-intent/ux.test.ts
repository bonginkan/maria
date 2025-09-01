/**
 * UX Tests for Filename Inference System
 * Tests save modes, interactive UI, dry-run, and undo functionality
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

import { SaveModeDecider, SaveModeOptions, EnvironmentContext } from '../../../services/code-intent/modes/SaveModeDecider';
import { FilenameSelector, SelectionOptions, SelectionResult } from '../../../services/code-intent/ui/FilenameSelector';
import { DryRunMode, DryRunOptions } from '../../../services/code-intent/modes/DryRunMode';
import { UndoManager } from '../../../services/code-intent/modes/UndoManager';
import { FilenameCandidate, SaveOperation, PlanFileSaveConfig } from '../../../services/code-intent/types/filename-inference.types';

describe('SaveModeDecider', () => {
  let decider: SaveModeDecider;

  beforeEach(() => {
    decider = new SaveModeDecider();
  });

  describe('Confidence-based decisions', () => {
    test('returns immediate mode for high confidence (0.9+)', () => {
      const mode = decider.decide(0.95, {}, {
        isCi: false,
        isTty: true,
        isTest: false,
        verboseMode: false
      });
      
      expect(mode).toBe('immediate');
    });

    test('returns interactive mode for medium confidence (0.7-0.9)', () => {
      const mode = decider.decide(0.8, {}, {
        isCi: false,
        isTty: true,
        isTest: false,
        verboseMode: false
      });
      
      expect(mode).toBe('interactive');
    });

    test('returns dry-run mode for low confidence (<0.7)', () => {
      const mode = decider.decide(0.6, {}, {
        isCi: false,
        isTty: true,
        isTest: false,
        verboseMode: false
      });
      
      expect(mode).toBe('dry-run');
    });
  });

  describe('Option overrides', () => {
    test('forces dry-run when --dry-run option is set', () => {
      const mode = decider.decide(0.95, { dryRun: true }, {
        isCi: false,
        isTty: true,
        isTest: false,
        verboseMode: false
      });
      
      expect(mode).toBe('dry-run');
    });

    test('forces immediate when --force option is set', () => {
      const mode = decider.decide(0.3, { force: true }, {
        isCi: false,
        isTty: true,
        isTest: false,
        verboseMode: false
      });
      
      expect(mode).toBe('immediate');
    });

    test('uses preview mode as dry-run', () => {
      const mode = decider.decide(0.95, { preview: true }, {
        isCi: false,
        isTty: true,
        isTest: false,
        verboseMode: false
      });
      
      expect(mode).toBe('dry-run');
    });
  });

  describe('Environment handling', () => {
    test('handles CI environment correctly', () => {
      // CI without acceptFirst but low confidence should be dry-run
      const mode1 = decider.decide(0.6, {}, {
        isCi: true,
        isTty: false,
        isTest: false,
        verboseMode: false
      });
      expect(mode1).toBe('dry-run');

      // CI with acceptFirst should be immediate for good confidence
      const mode2 = decider.decide(0.8, { acceptFirst: true }, {
        isCi: true,
        isTty: false,
        isTest: false,
        verboseMode: false
      });
      expect(mode2).toBe('immediate');
    });

    test('handles non-TTY environments', () => {
      const mode = decider.decide(0.8, {}, {
        isCi: false,
        isTty: false,
        isTest: false,
        verboseMode: false
      });
      
      expect(mode).toBe('immediate'); // Non-interactive, good confidence
    });

    test('handles test environment', () => {
      const mode = decider.decide(0.6, {}, {
        isCi: false,
        isTty: true,
        isTest: true,
        verboseMode: false
      });
      
      expect(mode).toBe('dry-run'); // Test env, low confidence
    });
  });

  describe('Decision explanations', () => {
    test('provides clear explanations for decisions', () => {
      const explanation = decider.explainDecision('immediate', 0.95, {}, {
        isCi: false,
        isTty: true,
        isTest: false,
        verboseMode: false
      });
      
      expect(explanation).toContain('high confidence');
      expect(explanation).toContain('95%');
    });

    test('explains CI decisions', () => {
      const explanation = decider.explainDecision('dry-run', 0.8, {}, {
        isCi: true,
        isTty: false,
        isTest: false,
        verboseMode: false
      });
      
      expect(explanation).toContain('CI environment');
    });
  });

  describe('Threshold customization', () => {
    test('allows updating thresholds', () => {
      decider.updateThresholds({ immediate: 0.8, interactive: 0.6 });
      
      const mode = decider.decide(0.85, {}, {
        isCi: false,
        isTty: true,
        isTest: false,
        verboseMode: false
      });
      
      expect(mode).toBe('immediate'); // With new threshold
    });

    test('gets current thresholds', () => {
      const thresholds = decider.getThresholds();
      
      expect(thresholds).toHaveProperty('immediate');
      expect(thresholds).toHaveProperty('interactive');
      expect(thresholds).toHaveProperty('dryRun');
    });
  });
});

describe('FilenameSelector', () => {
  let selector: FilenameSelector;
  let candidates: FilenameCandidate[];

  beforeEach(() => {
    selector = new FilenameSelector();
    candidates = [
      {
        path: '/test/index.html',
        filename: 'index.html',
        extension: '.html',
        directory: '/test',
        confidence: 0.95,
        reasoning: 'User specified explicitly',
        source: 'explicit'
      },
      {
        path: '/test/main.html',
        filename: 'main.html',
        extension: '.html',
        directory: '/test',
        confidence: 0.8,
        reasoning: 'Inferred from context',
        source: 'contextual'
      },
      {
        path: '/test/page.html',
        filename: 'page.html',
        extension: '.html',
        directory: '/test',
        confidence: 0.6,
        reasoning: 'Generated from code analysis',
        source: 'semantic'
      }
    ];
  });

  test('validates filenames correctly', () => {
    expect(FilenameSelector.validateFilename('index.html')).toEqual({ valid: true });
    expect(FilenameSelector.validateFilename('test.js')).toEqual({ valid: true });
    expect(FilenameSelector.validateFilename('')).toEqual({ 
      valid: false, 
      error: 'Filename cannot be empty' 
    });
    expect(FilenameSelector.validateFilename('no-extension')).toEqual({ 
      valid: false, 
      error: 'Filename must have a valid extension' 
    });
    expect(FilenameSelector.validateFilename('path/file.js')).toEqual({ 
      valid: false, 
      error: 'Filename cannot contain path separators' 
    });
  });

  test('selects first candidate for non-interactive mode', () => {
    const result = selector.selectFirstCandidate(candidates);
    
    expect(result.selectedPath).toBe('/test/index.html');
    expect(result.isCustom).toBe(false);
    expect(result.cancelled).toBe(false);
  });

  test('handles empty candidates list', () => {
    const result = selector.selectFirstCandidate([]);
    
    expect(result.selectedPath).toBe('default.txt');
    expect(result.isCustom).toBe(false);
  });

  test('formats selection results correctly', () => {
    const result: SelectionResult = {
      selectedPath: '/test/index.html',
      isCustom: false,
      cancelled: false,
      selectionTime: 150
    };

    // Should not throw when displaying
    expect(() => selector.displaySelectionSummary(result)).not.toThrow();
  });
});

describe('DryRunMode', () => {
  let dryRun: DryRunMode;
  let tempDir: string;
  let candidates: FilenameCandidate[];

  beforeEach(() => {
    dryRun = new DryRunMode();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'maria-dry-run-test-'));
    candidates = [
      {
        path: path.join(tempDir, 'test.html'),
        filename: 'test.html',
        extension: '.html',
        directory: tempDir,
        confidence: 0.9,
        reasoning: 'Test file',
        source: 'explicit'
      }
    ];
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('analyzes file creation without conflicts', async () => {
    const results = await dryRun.performDryRun(
      candidates,
      '<html></html>',
      undefined,
      {}
    );

    expect(results).toHaveLength(1);
    expect(results[0].wouldCreate).toBe(true);
    expect(results[0].conflictsWith).toBeUndefined();
    expect(results[0].permissions).toBe('ok');
  });

  test('detects file conflicts', async () => {
    const existingFile = candidates[0].path;
    fs.writeFileSync(existingFile, 'existing content');

    const results = await dryRun.performDryRun(
      candidates,
      '<html></html>',
      undefined,
      {}
    );

    expect(results[0].conflictsWith).toBeDefined();
    expect(results[0].conflictsWith).toContain('Existing file');
  });

  test('checks plan compliance', async () => {
    const planConfig: PlanFileSaveConfig = {
      fileSave: {
        allowExtensions: ['txt', 'md'], // HTML not allowed
        maxFileSizeMB: 1,
        defaultDir: '.'
      },
      naming: {
        convention: 'kebab-case'
      },
      dirs: {}
    };

    const results = await dryRun.performDryRun(
      candidates,
      '<html></html>',
      planConfig,
      {}
    );

    expect(results[0].planCompliance).toBe('forbidden');
  });

  test('checks file size limits', async () => {
    const planConfig: PlanFileSaveConfig = {
      fileSave: {
        allowExtensions: ['html'],
        maxFileSizeMB: 0.001, // Very small limit
        defaultDir: '.'
      },
      naming: {
        convention: 'kebab-case'
      },
      dirs: {}
    };

    const largeContent = 'x'.repeat(10000); // 10KB content
    const results = await dryRun.performDryRun(
      candidates,
      largeContent,
      planConfig,
      {}
    );

    expect(results[0].planCompliance).toBe('forbidden');
  });

  test('creates meaningful summaries', async () => {
    const results = await dryRun.performDryRun(
      candidates,
      '<html></html>',
      undefined,
      {}
    );

    const summary = dryRun.createSummary(results);
    
    expect(summary.totalFiles).toBe(1);
    expect(summary.readyToCreate).toBe(1);
    expect(summary.conflicts).toBe(0);
  });

  test('converts to save result format', async () => {
    const results = await dryRun.performDryRun(
      candidates,
      '<html></html>',
      undefined,
      {}
    );

    const saveResult = dryRun.toDryRunSaveResult(results);
    
    expect(saveResult.success).toBe(true);
    expect(saveResult.dryRun).toBe(true);
    expect(saveResult.suggested).toHaveLength(1);
  });
});

describe('UndoManager', () => {
  let undoManager: UndoManager;
  let tempDir: string;

  beforeEach(() => {
    undoManager = new UndoManager();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'maria-undo-test-'));
  });

  afterEach(async () => {
    await undoManager.clearHistory();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('records file creation operations', async () => {
    const filePath = path.join(tempDir, 'test.txt');
    const operation: SaveOperation = {
      type: 'create',
      filename: 'test.txt',
      filepath: filePath,
      path: filePath,
      content: 'test content',
      planId: 'FREE',
      timestamp: Date.now()
    };

    const operationId = await undoManager.recordOperation(operation, 'create');
    
    expect(operationId).toBeDefined();
    expect(undoManager.canUndo()).toBe(true);
    
    const operations = undoManager.getUndoableOperations();
    expect(operations).toHaveLength(1);
    expect(operations[0].id).toBe(operationId);
  });

  test('creates backups for overwrite operations', async () => {
    const filePath = path.join(tempDir, 'existing.txt');
    fs.writeFileSync(filePath, 'original content');

    const operation: SaveOperation = {
      type: 'overwrite',
      filename: 'existing.txt',
      filepath: filePath,
      path: filePath,
      content: 'new content',
      planId: 'FREE',
      timestamp: Date.now()
    };

    const operationId = await undoManager.recordOperation(operation);
    
    const operations = undoManager.getUndoableOperations();
    expect(operations[0].type).toBe('overwrite');
    expect(operations[0].backupPath).toBeDefined();
    expect(operations[0].originalContent).toBe('original content');
  });

  test('undoes file creation', async () => {
    const filePath = path.join(tempDir, 'test.txt');
    const operation: SaveOperation = {
      type: 'create',
      filename: 'test.txt', 
      filepath: filePath,
      path: filePath,  // Ensure both are set
      content: 'test content',
      planId: 'FREE',
      timestamp: Date.now()
    };

    // Simulate file creation
    fs.writeFileSync(filePath, operation.content);
    await undoManager.recordOperation(operation, 'create');

    // Undo the operation
    const result = await undoManager.undo();
    
    expect(result.success).toBe(true);
    
    // Debug output
    if (fs.existsSync(filePath)) {
      console.log(`File still exists at: ${filePath}`);
      console.log(`Undo result:`, result);
      const ops = undoManager.getUndoableOperations();
      console.log(`Operations before undo:`, ops.length);
    }
    
    expect(fs.existsSync(filePath)).toBe(false);
    expect(undoManager.canUndo()).toBe(false);
  });

  test('undoes file overwrite', async () => {
    const filePath = path.join(tempDir, 'existing.txt');
    const originalContent = 'original content';
    const newContent = 'new content';
    
    // Create original file
    fs.writeFileSync(filePath, originalContent);
    
    const operation: SaveOperation = {
      type: 'overwrite',
      filename: 'existing.txt',
      filepath: filePath,
      path: filePath,
      content: newContent,
      planId: 'FREE',
      timestamp: Date.now()
    };

    // Record overwrite operation
    await undoManager.recordOperation(operation);
    
    // Simulate overwrite
    fs.writeFileSync(filePath, newContent);

    // Undo the operation
    const result = await undoManager.undo();
    
    expect(result.success).toBe(true);
    expect(fs.readFileSync(filePath, 'utf-8')).toBe(originalContent);
  });

  test('handles undo with no operations', async () => {
    const result = await undoManager.undo();
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('No operations to undo');
  });

  test('manages operation history limits', async () => {
    // Create more operations than the limit
    for (let i = 0; i < 15; i++) {
      const filePath = path.join(tempDir, `test${i}.txt`);
      const operation: SaveOperation = {
        type: 'create',
        filename: `test${i}.txt`,
        filepath: filePath,
        path: filePath,
        content: `content ${i}`,
        planId: 'FREE',
        timestamp: Date.now()
      };
      await undoManager.recordOperation(operation);
    }

    const operations = undoManager.getUndoableOperations();
    expect(operations.length).toBeLessThanOrEqual(10); // Should respect limit
  });

  test('provides operation statistics', () => {
    const stats = undoManager.getStats();
    
    expect(stats).toHaveProperty('operationCount');
    expect(stats).toHaveProperty('backupCount');
    expect(stats).toHaveProperty('backupSizeEstimate');
  });

  test('formats operations for display', async () => {
    const filePath = path.join(tempDir, 'test.txt');
    const operation: SaveOperation = {
      type: 'create',
      filename: 'test.txt',
      filepath: filePath,
      path: filePath,
      content: 'test content',
      planId: 'FREE',
      timestamp: Date.now()
    };

    await undoManager.recordOperation(operation, 'create');
    const lastOp = undoManager.getLastOperation();
    
    if (lastOp) {
      const formatted = undoManager.formatOperation(lastOp);
      expect(formatted).toContain('Created');
      expect(formatted).toContain('test.txt');
    }
  });

  test('clears history completely', async () => {
    const filePath = path.join(tempDir, 'test.txt');
    const operation: SaveOperation = {
      type: 'create',
      filename: 'test.txt',
      filepath: filePath,
      path: filePath,
      content: 'test content',
      planId: 'FREE',
      timestamp: Date.now()
    };

    await undoManager.recordOperation(operation);
    expect(undoManager.canUndo()).toBe(true);

    await undoManager.clearHistory();
    expect(undoManager.canUndo()).toBe(false);
    expect(undoManager.getUndoableOperations()).toHaveLength(0);
  });
});