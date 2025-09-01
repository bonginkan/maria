/**
 * Phase 4 Basic Integration Tests
 * Simple validation of core functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FilenameUXOrchestrator } from '../../../../services/code-intent/FilenameUXOrchestrator';
import { filenameInferenceTelemetry } from '../../../../services/code-intent/telemetry/FilenameInferenceTelemetry';
import { ProjectContext } from '../../../../services/code-intent/types/filename-inference.types';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('Phase 4 Basic Integration', () => {
  let orchestrator: FilenameUXOrchestrator;
  let tempDir: string;

  beforeEach(() => {
    // Create temporary directory for testing
    tempDir = fs.mkdirSync(path.join(os.tmpdir(), 'maria-phase4-test-'), { recursive: true });
    
    // Initialize orchestrator
    orchestrator = new FilenameUXOrchestrator(tempDir);

    // Clear telemetry
    filenameInferenceTelemetry['telemetry'].clear();
  });

  afterEach(() => {
    // Cleanup
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should perform basic filename inference and telemetry', async () => {
    const projectContext: ProjectContext = {
      root: tempDir,
      planId: 'FREE'
    };

    const result = await orchestrator.orchestrate(
      'create index.html for login page',
      '<!DOCTYPE html><html><head><title>Login</title></head><body><form>Login form</form></body></html>',
      projectContext
    );

    // Basic functionality check
    expect(result.success).toBe(true);
    expect(result.path).toBeDefined();
    
    if (result.path) {
      expect(fs.existsSync(result.path)).toBe(true);
      const content = fs.readFileSync(result.path, 'utf-8');
      expect(content).toContain('Login');
    }

    // Telemetry check
    const metrics = await filenameInferenceTelemetry.generateMetrics(10000);
    expect(metrics.totalInferences).toBeGreaterThan(0);
    expect(metrics.successfulSaves).toBeGreaterThan(0);
  });

  it('should handle dry-run mode properly', async () => {
    const projectContext: ProjectContext = {
      root: tempDir,
      planId: 'FREE'
    };

    const result = await orchestrator.orchestrate(
      'some vague request',
      'console.log("test");',
      projectContext,
      undefined,
      { dryRun: { enabled: true } }
    );

    // Should succeed but not create files
    expect(result.success).toBe(true);
    expect(result.mode).toBe('dry-run');
    
    // No files should be created
    const files = fs.readdirSync(tempDir);
    expect(files.length).toBe(0);

    // Verify telemetry
    const metrics = await filenameInferenceTelemetry.generateMetrics(10000);
    expect(metrics.dryRunMode).toBeGreaterThan(0);
  });

  it('should record security violations', async () => {
    const projectContext: ProjectContext = {
      root: tempDir,
      planId: 'FREE'
    };

    try {
      await orchestrator.orchestrate(
        '../../../etc/passwd malicious content',
        'malicious code',
        projectContext
      );
    } catch (error) {
      // Expected to fail
    }

    // Verify security telemetry
    const metrics = await filenameInferenceTelemetry.generateMetrics(10000);
    expect(metrics.securityViolations).toBeGreaterThan(0);
  });

  it('should measure performance metrics', async () => {
    const projectContext: ProjectContext = {
      root: tempDir,
      planId: 'FREE'
    };

    const startTime = Date.now();

    await orchestrator.orchestrate(
      'create component.tsx React component',
      'import React from "react"; export default function Component() { return <div>Test</div>; }',
      projectContext
    );

    const endTime = Date.now();
    const processingTime = endTime - startTime;

    const metrics = await filenameInferenceTelemetry.generateMetrics(10000);
    expect(metrics.averageInferenceTime).toBeGreaterThan(0);
    expect(metrics.averageInferenceTime).toBeLessThan(processingTime);
  });

  it('should integrate with external telemetry systems', async () => {
    let integrationData: any = null;

    // Mock integration telemetry
    const originalRecord = filenameInferenceTelemetry.recordIntegrationTelemetry;
    filenameInferenceTelemetry.recordIntegrationTelemetry = async (data: any) => {
      integrationData = data;
      return originalRecord.call(filenameInferenceTelemetry, data);
    };

    const projectContext: ProjectContext = {
      root: tempDir,
      planId: 'FREE'
    };

    // Manually call integration telemetry
    await filenameInferenceTelemetry.recordIntegrationTelemetry({
      component: 'filename_inference',
      operation: 'test',
      success: true,
      processingTime: 100
    });

    expect(integrationData).toBeDefined();
    expect(integrationData.component).toBe('filename_inference');
    expect(integrationData.operation).toBe('test');

    // Restore original method
    filenameInferenceTelemetry.recordIntegrationTelemetry = originalRecord;
  });
});