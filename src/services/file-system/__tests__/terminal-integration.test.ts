/**
 * Terminal Integration Tests
 * Tests for Phase 2 file system integration components
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { terminalDetector } from '../terminal-integration/TerminalDetector';
import { terminalManager } from '../terminal-integration/TerminalManager';
import { permissionManager } from '../security/PermissionManager';
import { operationConfirmation } from '../security/OperationConfirmation';

describe('Terminal Integration - Phase 2', () => {
  describe('TerminalDetector', () => {
    it('should detect terminal capabilities', async () => {
      const { capabilities, environment } = await terminalDetector.detectEnvironment();
      
      expect(capabilities).toBeDefined();
      expect(capabilities.terminalType).toMatch(/vscode|cursor|iterm2|terminal|gnome-terminal|konsole|unknown/);
      expect(capabilities.colorSupport).toMatch(/16|256|truecolor|none/);
      expect(capabilities.platform).toMatch(/darwin|linux|win32/);
      
      expect(environment).toBeDefined();
      expect(environment.homeDirectory).toBeTruthy();
      expect(environment.currentWorkingDirectory).toBeTruthy();
      expect(Array.isArray(environment.pathVariable)).toBe(true);
    });

    it('should cache capabilities for performance', async () => {
      // Clear any existing cache first
      await terminalDetector.refreshCapabilities();
      
      const start1 = Date.now();
      await terminalDetector.detectEnvironment();
      const time1 = Date.now() - start1;

      const start2 = Date.now();
      await terminalDetector.detectEnvironment();
      const time2 = Date.now() - start2;

      // Second call should be faster due to caching (or at least not slower)
      expect(time2).toBeLessThanOrEqual(time1 + 1); // Allow for 1ms tolerance
    });
  });

  describe('TerminalManager', () => {
    it('should initialize successfully', async () => {
      const initialized = await terminalManager.initialize();
      expect(initialized).toBe(true);
      expect(terminalManager.isReady()).toBe(true);
    });

    it('should provide terminal capabilities', async () => {
      await terminalManager.initialize();
      const capabilities = terminalManager.getCapabilities();
      expect(capabilities).toBeDefined();
    });

    it('should detect AI features for Cursor', async () => {
      await terminalManager.initialize();
      const aiFeatures = terminalManager.getAIFeatures();
      expect(aiFeatures).toBeDefined();
      expect(typeof aiFeatures.available).toBe('boolean');
    });
  });

  describe('PermissionManager', () => {
    it('should check file permissions', async () => {
      // Test with current directory (should be readable)
      const permissions = await permissionManager.checkPermissions('.', 'read');
      
      expect(permissions).toBeDefined();
      expect(permissions.readable).toBe(true);
      expect(permissions.mode).toMatch(/^\d{3}$/);
    });

    it('should validate operations against security policy', () => {
      const validation = permissionManager.validateOperation('read', './package.json');
      expect(validation.allowed).toBe(true);
      expect(validation.needsConfirmation).toBe(false);
      
      const systemValidation = permissionManager.validateOperation('delete', '/etc/passwd');
      expect(systemValidation.needsElevation).toBe(true);
    });

    it('should detect current user info', async () => {
      const userInfo = await permissionManager.getCurrentUser();
      expect(userInfo).toBeDefined();
      expect(userInfo.username).toBeTruthy();
    });

    it('should cache permissions for performance', async () => {
      const start1 = Date.now();
      await permissionManager.checkPermissions('./package.json', 'read');
      const time1 = Date.now() - start1;

      const start2 = Date.now();
      await permissionManager.checkPermissions('./package.json', 'read');
      const time2 = Date.now() - start2;

      // Second call should be faster due to caching
      expect(time2).toBeLessThanOrEqual(time1);
    });
  });

  describe('OperationConfirmation', () => {
    it('should generate operation preview', async () => {
      // Mock the confirmation to avoid interactive prompts in tests
      const originalMethod = operationConfirmation['generateOperationPreview'];
      
      const preview = await originalMethod.call(operationConfirmation, 'read', ['./package.json']);
      
      expect(preview).toBeDefined();
      expect(preview.operation).toBe('read');
      expect(preview.totalItems).toBe(1);
      expect(preview.affectedFiles).toContain('./package.json');
    });

    it('should assess file risks correctly', async () => {
      const risks = await operationConfirmation['assessFileRisks']('./package.json', 'delete');
      
      expect(Array.isArray(risks)).toBe(true);
      // package.json should be considered important and have medium risk
      const hasImportantFileRisk = risks.some(risk => 
        risk.level === 'medium' && risk.message.includes('Important user file')
      );
      expect(hasImportantFileRisk).toBe(true);
    });

    it('should identify system files correctly', async () => {
      const isSystem1 = operationConfirmation['isSystemFile']('/etc/passwd');
      expect(isSystem1).toBe(true);
      
      const isSystem2 = operationConfirmation['isSystemFile']('./package.json');
      expect(isSystem2).toBe(false);
    });

    it('should handle skip patterns', () => {
      operationConfirmation.addSkipPattern('**/test/**');
      const patterns = operationConfirmation.getSkipPatterns();
      expect(patterns).toContain('**/test/**');
      
      operationConfirmation.removeSkipPattern('**/test/**');
      const patternsAfter = operationConfirmation.getSkipPatterns();
      expect(patternsAfter).not.toContain('**/test/**');
    });
  });

  describe('Integration Tests', () => {
    it('should integrate terminal manager with permission manager', async () => {
      await terminalManager.initialize();
      const capabilities = terminalManager.getCapabilities();
      
      if (capabilities) {
        const permissions = await permissionManager.checkPermissions('.', 'read');
        expect(permissions).toBeDefined();
        
        // Terminal should be able to provide notifications
        const notificationSent = await terminalManager.showNotification('Test message');
        expect(typeof notificationSent).toBe('boolean');
      }
    });

    it('should handle file operations with proper security checks', async () => {
      await terminalManager.initialize();
      
      // Test opening a file (should work without elevation)
      const fileOpened = await terminalManager.openFile('./package.json');
      expect(typeof fileOpened).toBe('boolean');
    });
  });
});

describe('Performance Tests', () => {
  it('should complete terminal detection within reasonable time', async () => {
    const start = Date.now();
    await terminalDetector.refreshCapabilities();
    const time = Date.now() - start;
    
    // Should complete within 5 seconds
    expect(time).toBeLessThan(5000);
  });

  it('should handle permission checks efficiently', async () => {
    const start = Date.now();
    
    // Check permissions for multiple files
    const promises = [
      permissionManager.checkPermissions('.', 'read'),
      permissionManager.checkPermissions('./package.json', 'read'),
      permissionManager.checkPermissions('./src', 'read'),
    ];
    
    await Promise.all(promises);
    const time = Date.now() - start;
    
    // Should complete within 1 second
    expect(time).toBeLessThan(1000);
  });
});