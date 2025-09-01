/**
 * Phase 4 End-to-End Integration Tests
 * Tests the complete /code command with filename inference integration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EnhancedCodeCommand } from '../../../../slash-commands/categories/code/code.command.enhanced';
import { FilenameUXOrchestrator, filenameInferenceTelemetry } from '../../../../services/code-intent/index';
import { CommandContext } from '../../../../slash-commands/shared';
import { CommandArgs } from '../../../../slash-commands/types';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('Phase 4 E2E Integration Tests', () => {
  let command: EnhancedCodeCommand;
  let tempDir: string;
  let originalCwd: string;

  beforeEach(() => {
    // Create temporary directory for testing
    tempDir = fs.mkdirSync(path.join(os.tmpdir(), 'maria-code-test-'), { recursive: true });
    originalCwd = process.cwd();
    process.chdir(tempDir);

    // Initialize command
    command = new EnhancedCodeCommand();

    // Clear telemetry
    filenameInferenceTelemetry['telemetry'].clear();
  });

  afterEach(() => {
    // Cleanup
    process.chdir(originalCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('High Confidence Immediate Save', () => {
    it('should save file immediately with explicit filename', async () => {
      const args: CommandArgs = {
        raw: ['create', 'index.html', 'for', 'login', 'page'],
        positional: ['create', 'index.html', 'for', 'login', 'page'],
        named: {}
      };

      const context: CommandContext = {
        userId: 'test-user',
        sessionId: 'test-session',
        timestamp: Date.now(),
        platform: 'cli'
      };

      const result = await command.execute(args, context);

      // Check command success
      expect(result.success).toBe(true);
      expect(result.message).toContain('index.html');

      // Verify file was created
      const expectedPath = path.join(tempDir, 'index.html');
      expect(fs.existsSync(expectedPath)).toBe(true);

      // Verify file content
      const content = fs.readFileSync(expectedPath, 'utf-8');
      expect(content).toContain('<!DOCTYPE html>');
      expect(content).toContain('login');

      // Verify telemetry was recorded
      const metrics = await filenameInferenceTelemetry.generateMetrics(60000);
      expect(metrics.totalInferences).toBe(1);
      expect(metrics.highConfidenceRate).toBe(1);
      expect(metrics.immediateMode).toBe(1);
      expect(metrics.successfulSaves).toBe(1);
    });

    it('should generate React component with appropriate naming', async () => {
      const args: CommandArgs = {
        raw: ['React', 'component', 'for', 'user', 'profile'],
        positional: ['React', 'component', 'for', 'user', 'profile'],
        named: {}
      };

      const context: CommandContext = {
        userId: 'test-user',
        sessionId: 'test-session',
        timestamp: Date.now(),
        platform: 'cli'
      };

      const result = await command.execute(args, context);

      expect(result.success).toBe(true);

      // Should create a .tsx or .jsx file
      const files = fs.readdirSync(tempDir);
      const componentFile = files.find(f => f.endsWith('.tsx') || f.endsWith('.jsx'));
      expect(componentFile).toBeDefined();

      if (componentFile) {
        const content = fs.readFileSync(path.join(tempDir, componentFile), 'utf-8');
        expect(content).toContain('import React');
        expect(content).toContain('export default');
      }
    });
  });

  describe('Medium Confidence Interactive Mode', () => {
    it('should handle ambiguous requests with interactive fallback in CI', async () => {
      // Mock CI environment
      const originalCI = process.env.CI;
      process.env.CI = 'true';

      const args: CommandArgs = {
        raw: ['create', 'a', 'service', 'for', 'data', 'processing'],
        positional: ['create', 'a', 'service', 'for', 'data', 'processing'],
        named: {}
      };

      const context: CommandContext = {
        userId: 'test-user',
        sessionId: 'test-session',
        timestamp: Date.now(),
        platform: 'cli'
      };

      const result = await command.execute(args, context);

      // In CI, should still succeed by auto-selecting best candidate
      expect(result.success).toBe(true);

      // Should create a service file
      const files = fs.readdirSync(tempDir);
      const serviceFile = files.find(f => f.includes('service') || f.includes('data'));
      expect(serviceFile).toBeDefined();

      // Restore environment
      if (originalCI) {
        process.env.CI = originalCI;
      } else {
        delete process.env.CI;
      }
    });
  });

  describe('Low Confidence Dry-Run Mode', () => {
    it('should show suggestions without creating files for vague requests', async () => {
      const args: CommandArgs = {
        raw: ['something', 'useful'],
        positional: ['something', 'useful'],
        named: {}
      };

      const context: CommandContext = {
        userId: 'test-user',
        sessionId: 'test-session',
        timestamp: Date.now(),
        platform: 'cli'
      };

      const result = await command.execute(args, context);

      // Should succeed but not create files
      expect(result.success).toBe(true);
      expect(result.message).toContain('Dry Run');

      // No files should be created
      const files = fs.readdirSync(tempDir);
      expect(files).toHaveLength(0);

      // Verify telemetry
      const metrics = await filenameInferenceTelemetry.generateMetrics(60000);
      expect(metrics.dryRunMode).toBe(1);
      expect(metrics.successfulSaves).toBe(0);
    });

    it('should provide detailed analysis in dry-run mode', async () => {
      const args: CommandArgs = {
        raw: ['--dry-run', 'create', 'user', 'authentication', 'system'],
        positional: ['create', 'user', 'authentication', 'system'],
        named: { 'dry-run': true }
      };

      const context: CommandContext = {
        userId: 'test-user',
        sessionId: 'test-session',
        timestamp: Date.now(),
        platform: 'cli'
      };

      const result = await command.execute(args, context);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Preview');
      expect(result.message).toContain('auth');

      // Verify dry-run telemetry
      const events = filenameInferenceTelemetry['telemetry'].exportEvents({
        startTime: Date.now() - 10000
      });
      const dryRunEvents = events.filter(e => e.event.includes('dryrun'));
      expect(dryRunEvents.length).toBeGreaterThan(0);
    });
  });

  describe('Security and Plan Enforcement', () => {
    it('should block dangerous file extensions', async () => {
      const args: CommandArgs = {
        raw: ['malicious.exe', 'script'],
        positional: ['malicious.exe', 'script'],
        named: {}
      };

      const context: CommandContext = {
        userId: 'test-user',
        sessionId: 'test-session',
        timestamp: Date.now(),
        platform: 'cli'
      };

      const result = await command.execute(args, context);

      // Should fail due to security restrictions
      expect(result.success).toBe(false);
      expect(result.message).toContain('security') || expect(result.message).toContain('not allowed');

      // No dangerous file should be created
      expect(fs.existsSync(path.join(tempDir, 'malicious.exe'))).toBe(false);

      // Verify security violation telemetry
      const metrics = await filenameInferenceTelemetry.generateMetrics(60000);
      expect(metrics.securityViolations).toBeGreaterThan(0);
    });

    it('should prevent path traversal attacks', async () => {
      const args: CommandArgs = {
        raw: ['../../../etc/passwd', 'content'],
        positional: ['../../../etc/passwd', 'content'],
        named: {}
      };

      const context: CommandContext = {
        userId: 'test-user',
        sessionId: 'test-session',
        timestamp: Date.now(),
        platform: 'cli'
      };

      const result = await command.execute(args, context);

      // Should fail due to path traversal protection
      expect(result.success).toBe(false);

      // Verify security telemetry
      const metrics = await filenameInferenceTelemetry.generateMetrics(60000);
      expect(metrics.pathTraversalAttempts).toBeGreaterThan(0);
    });
  });

  describe('Command Options', () => {
    it('should respect --verbose option', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const args: CommandArgs = {
        raw: ['--verbose', 'create', 'test.js'],
        positional: ['create', 'test.js'],
        named: { verbose: true }
      };

      const context: CommandContext = {
        userId: 'test-user',
        sessionId: 'test-session',
        timestamp: Date.now(),
        platform: 'cli'
      };

      await command.execute(args, context);

      // Should have verbose output
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('🚀'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Generating code'));

      consoleSpy.mockRestore();
    });

    it('should handle --force option for overwriting files', async () => {
      // Create initial file
      const testFile = path.join(tempDir, 'existing.js');
      fs.writeFileSync(testFile, 'console.log("original");');

      const args: CommandArgs = {
        raw: ['--force', 'existing.js', 'updated', 'function'],
        positional: ['existing.js', 'updated', 'function'],
        named: { force: true }
      };

      const context: CommandContext = {
        userId: 'test-user',
        sessionId: 'test-session',
        timestamp: Date.now(),
        platform: 'cli'
      };

      const result = await command.execute(args, context);

      expect(result.success).toBe(true);

      // File should be overwritten
      const content = fs.readFileSync(testFile, 'utf-8');
      expect(content).not.toContain('original');
    });

    it('should support custom directory with --directory option', async () => {
      const customDir = path.join(tempDir, 'custom');
      fs.mkdirSync(customDir);

      const args: CommandArgs = {
        raw: ['--directory', customDir, 'create', 'module.js'],
        positional: ['create', 'module.js'],
        named: { directory: customDir }
      };

      const context: CommandContext = {
        userId: 'test-user',
        sessionId: 'test-session',
        timestamp: Date.now(),
        platform: 'cli'
      };

      const result = await command.execute(args, context);

      expect(result.success).toBe(true);

      // File should be created in custom directory
      const files = fs.readdirSync(customDir);
      expect(files.some(f => f.includes('module'))).toBe(true);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should provide helpful suggestions for permission errors', async () => {
      // Mock permission error by making directory read-only
      const readOnlyDir = path.join(tempDir, 'readonly');
      fs.mkdirSync(readOnlyDir);
      fs.chmodSync(readOnlyDir, 0o444); // Read-only

      const args: CommandArgs = {
        raw: ['--directory', readOnlyDir, 'create', 'test.js'],
        positional: ['create', 'test.js'],
        named: { directory: readOnlyDir }
      };

      const context: CommandContext = {
        userId: 'test-user',
        sessionId: 'test-session',
        timestamp: Date.now(),
        platform: 'cli'
      };

      const result = await command.execute(args, context);

      // Should fail gracefully with helpful error message
      expect(result.success).toBe(false);
      expect(result.message).toContain('permission') || expect(result.message).toContain('access');

      // Verify permission error telemetry
      const metrics = await filenameInferenceTelemetry.generateMetrics(60000);
      expect(metrics.permissionDenials).toBeGreaterThan(0);

      // Cleanup
      fs.chmodSync(readOnlyDir, 0o755);
    });

    it('should handle corrupted project contexts gracefully', async () => {
      // Create corrupted package.json
      const corruptedPackageJson = path.join(tempDir, 'package.json');
      fs.writeFileSync(corruptedPackageJson, '{ invalid json }');

      const args: CommandArgs = {
        raw: ['create', 'component.tsx'],
        positional: ['create', 'component.tsx'],
        named: {}
      };

      const context: CommandContext = {
        userId: 'test-user',
        sessionId: 'test-session',
        timestamp: Date.now(),
        platform: 'cli'
      };

      const result = await command.execute(args, context);

      // Should still succeed with fallback behavior
      expect(result.success).toBe(true);

      // File should still be created
      const files = fs.readdirSync(tempDir);
      const componentFile = files.find(f => f.endsWith('.tsx'));
      expect(componentFile).toBeDefined();
    });
  });

  describe('Telemetry Integration', () => {
    it('should record comprehensive telemetry data', async () => {
      const args: CommandArgs = {
        raw: ['--verbose', 'create', 'analytics.js', 'tracking', 'system'],
        positional: ['create', 'analytics.js', 'tracking', 'system'],
        named: { verbose: true }
      };

      const context: CommandContext = {
        userId: 'test-user',
        sessionId: 'test-session',
        timestamp: Date.now(),
        platform: 'cli'
      };

      await command.execute(args, context);

      // Generate comprehensive metrics
      const metrics = await filenameInferenceTelemetry.generateMetrics(60000);

      // Verify all key metrics are recorded
      expect(metrics.totalInferences).toBeGreaterThan(0);
      expect(metrics.averageInferenceTime).toBeGreaterThan(0);
      expect(metrics.successfulSaves).toBeGreaterThan(0);
      expect(metrics.saveSuccessRate).toBeGreaterThan(0);

      // Verify telemetry events were recorded
      const events = filenameInferenceTelemetry['telemetry'].exportEvents({
        startTime: Date.now() - 10000
      });

      expect(events.length).toBeGreaterThan(0);

      // Check for key event types
      const eventTypes = events.map(e => e.event);
      expect(eventTypes.some(t => t.includes('inference'))).toBe(true);
      expect(eventTypes.some(t => t.includes('save'))).toBe(true);
    });

    it('should integrate with external telemetry systems', async () => {
      const mockTelemetryData: any[] = [];
      
      // Mock the integration telemetry recording
      const originalRecord = filenameInferenceTelemetry.recordIntegrationTelemetry;
      filenameInferenceTelemetry.recordIntegrationTelemetry = async (data: any) => {
        mockTelemetryData.push(data);
        return originalRecord.call(filenameInferenceTelemetry, data);
      };

      const args: CommandArgs = {
        raw: ['create', 'service.ts'],
        positional: ['create', 'service.ts'],
        named: {}
      };

      const context: CommandContext = {
        userId: 'test-user',
        sessionId: 'test-session',
        timestamp: Date.now(),
        platform: 'cli'
      };

      await command.execute(args, context);

      // Verify integration telemetry was called
      expect(mockTelemetryData.length).toBeGreaterThan(0);
      
      const telemetryRecord = mockTelemetryData[0];
      expect(telemetryRecord.command).toBe('code');
      expect(telemetryRecord.operation).toBe('orchestrate');
      expect(telemetryRecord.processingTime).toBeGreaterThan(0);

      // Restore original method
      filenameInferenceTelemetry.recordIntegrationTelemetry = originalRecord;
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle multiple concurrent requests', async () => {
      const promises = [];
      const requestCount = 5;

      for (let i = 0; i < requestCount; i++) {
        const args: CommandArgs = {
          raw: ['create', `test${i}.js`, 'function'],
          positional: ['create', `test${i}.js`, 'function'],
          named: {}
        };

        const context: CommandContext = {
          userId: `test-user-${i}`,
          sessionId: `test-session-${i}`,
          timestamp: Date.now(),
          platform: 'cli'
        };

        promises.push(command.execute(args, context));
      }

      const results = await Promise.all(promises);

      // All requests should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // All files should be created
      const files = fs.readdirSync(tempDir);
      expect(files.length).toBe(requestCount);

      // Verify telemetry recorded all operations
      const metrics = await filenameInferenceTelemetry.generateMetrics(60000);
      expect(metrics.totalInferences).toBe(requestCount);
      expect(metrics.successfulSaves).toBe(requestCount);
    });

    it('should maintain performance under load', async () => {
      const startTime = Date.now();
      const requestCount = 10;
      const maxAllowedTime = 5000; // 5 seconds for 10 requests

      const promises = Array.from({ length: requestCount }, (_, i) => {
        const args: CommandArgs = {
          raw: ['create', `perf${i}.js`, 'utility', 'function'],
          positional: ['create', `perf${i}.js`, 'utility', 'function'],
          named: {}
        };

        const context: CommandContext = {
          userId: `perf-user-${i}`,
          sessionId: `perf-session-${i}`,
          timestamp: Date.now(),
          platform: 'cli'
        };

        return command.execute(args, context);
      });

      await Promise.all(promises);
      const totalTime = Date.now() - startTime;

      expect(totalTime).toBeLessThan(maxAllowedTime);

      // Verify performance metrics
      const metrics = await filenameInferenceTelemetry.generateMetrics(60000);
      expect(metrics.averageInferenceTime).toBeLessThan(1000); // Less than 1 second per inference
    });
  });
});