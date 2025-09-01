/**
 * Filename Inference Telemetry Integration
 * Tracks performance and usage metrics for the intelligent filename inference system
 */

import { TelemetryCollector, SystemEvent } from '../../base/TelemetryCollector';

// Optional telemetry integration - gracefully handle missing dependencies
let telemetryIntegration: any = null;
try {
  const { getTelemetryIntegration } = require('../../telemetry/telemetry-integration');
  telemetryIntegration = getTelemetryIntegration();
} catch (error) {
  console.warn('Optional telemetry integration not available:', error.message);
}
import { FilenameCandidate, InferenceResult, SaveOperation, SaveResult } from '../types/filename-inference.types';

export enum FilenameInferenceEvent {
  // Inference events
  INFERENCE_START = "filename.inference.start",
  INFERENCE_END = "filename.inference.end",
  INFERENCE_TIMEOUT = "filename.inference.timeout",
  INFERENCE_CACHE_HIT = "filename.inference.cache.hit",
  INFERENCE_CACHE_MISS = "filename.inference.cache.miss",
  
  // Stage events
  EXPLICIT_ANALYZER_START = "filename.analyzer.explicit.start",
  EXPLICIT_ANALYZER_END = "filename.analyzer.explicit.end",
  CONTEXTUAL_ANALYZER_START = "filename.analyzer.contextual.start",
  CONTEXTUAL_ANALYZER_END = "filename.analyzer.contextual.end",
  SEMANTIC_ANALYZER_START = "filename.analyzer.semantic.start",
  SEMANTIC_ANALYZER_END = "filename.analyzer.semantic.end",
  PROJECT_ANALYZER_START = "filename.analyzer.project.start",
  PROJECT_ANALYZER_END = "filename.analyzer.project.end",
  EXTENSION_ANALYZER_START = "filename.analyzer.extension.start",
  EXTENSION_ANALYZER_END = "filename.analyzer.extension.end",
  
  // UX events
  SAVE_MODE_DECIDED = "filename.ux.mode.decided",
  INTERACTIVE_SELECTION_START = "filename.ux.selection.start",
  INTERACTIVE_SELECTION_END = "filename.ux.selection.end",
  DRY_RUN_EXECUTED = "filename.ux.dryrun.executed",
  UNDO_EXECUTED = "filename.ux.undo.executed",
  
  // Save events
  SAVE_OPERATION_START = "filename.save.start",
  SAVE_OPERATION_END = "filename.save.end",
  SAVE_OPERATION_SUCCESS = "filename.save.success",
  SAVE_OPERATION_FAILED = "filename.save.failed",
  
  // Security events
  SECURITY_VIOLATION = "filename.security.violation",
  PATH_TRAVERSAL_BLOCKED = "filename.security.path_traversal_blocked",
  PLAN_VIOLATION_BLOCKED = "filename.security.plan_violation_blocked",
  PERMISSION_DENIED = "filename.security.permission_denied",
  
  // Performance events
  HIGH_CONFIDENCE_INFERENCE = "filename.performance.high_confidence",
  LOW_CONFIDENCE_INFERENCE = "filename.performance.low_confidence",
  ANALYZER_SLOW = "filename.performance.analyzer_slow"
}

export interface FilenameInferenceMetrics {
  // Performance metrics
  totalInferences: number;
  averageInferenceTime: number;
  cacheHitRate: number;
  timeoutRate: number;
  
  // Quality metrics
  highConfidenceRate: number; // >= 0.9
  mediumConfidenceRate: number; // 0.7-0.9
  lowConfidenceRate: number; // < 0.7
  
  // UX metrics
  immediateMode: number;
  interactiveMode: number;
  dryRunMode: number;
  userCancellations: number;
  undoOperations: number;
  
  // Security metrics
  securityViolations: number;
  pathTraversalAttempts: number;
  planViolations: number;
  permissionDenials: number;
  
  // Success metrics
  successfulSaves: number;
  failedSaves: number;
  saveSuccessRate: number;
}

export class FilenameInferenceTelemetry {
  private telemetry = TelemetryCollector.getInstance();
  private integration = telemetryIntegration;
  
  /**
   * Start timing an inference operation
   */
  startInference(prompt: string, context?: any): () => void {
    return this.telemetry.startTimer(
      FilenameInferenceEvent.INFERENCE_START,
      {
        _comp: 'system',
        operation: 'filename_inference',
        prompt_length: prompt.length.toString(),
        has_context: context ? 'true' : 'false'
      }
    );
  }
  
  /**
   * Record inference completion
   */
  recordInferenceComplete(result: InferenceResult, durationMs: number): void {
    const bestCandidate = result.candidates[0];
    const confidence = bestCandidate?.confidence || 0;
    
    this.telemetry.emit({
      event: FilenameInferenceEvent.INFERENCE_END,
      dur: durationMs,
      tags: {
        _comp: 'system',
        operation: 'filename_inference',
        confidence_level: this.getConfidenceLevel(confidence),
        candidate_count: result.candidates.length.toString(),
        timeout: result.timedOut ? 'true' : 'false'
      },
      meta: {
        confidence: confidence,
        candidateCount: result.candidates.length,
        sources: result.candidates.map(c => c.source),
        timedOut: result.timedOut
      }
    });
    
    // Record high-level metrics
    this.recordConfidenceMetrics(confidence);
    if (result.timedOut) {
      this.recordTimeout();
    }
  }
  
  /**
   * Record cache hit
   */
  recordCacheHit(cacheKey: string): void {
    this.telemetry.emit({
      event: FilenameInferenceEvent.INFERENCE_CACHE_HIT,
      tags: {
        _comp: 'system',
        operation: 'cache',
        cache_key: cacheKey.substring(0, 16) // First 16 chars of hash
      }
    });
  }
  
  /**
   * Record cache miss
   */
  recordCacheMiss(cacheKey: string): void {
    this.telemetry.emit({
      event: FilenameInferenceEvent.INFERENCE_CACHE_MISS,
      tags: {
        _comp: 'system',
        operation: 'cache',
        cache_key: cacheKey.substring(0, 16)
      }
    });
  }
  
  /**
   * Start timing an analyzer
   */
  startAnalyzer(analyzer: string): () => void {
    const event = `filename.analyzer.${analyzer.toLowerCase()}.start` as FilenameInferenceEvent;
    
    return this.telemetry.startTimer(event, {
      _comp: 'system',
      operation: 'analyzer',
      analyzer: analyzer
    });
  }
  
  /**
   * Record analyzer completion
   */
  recordAnalyzerComplete(analyzer: string, candidates: FilenameCandidate[], durationMs: number): void {
    const event = `filename.analyzer.${analyzer.toLowerCase()}.end` as FilenameInferenceEvent;
    const bestConfidence = candidates.length > 0 ? candidates[0].confidence : 0;
    
    this.telemetry.emit({
      event,
      dur: durationMs,
      tags: {
        _comp: 'system',
        operation: 'analyzer',
        analyzer: analyzer,
        confidence_level: this.getConfidenceLevel(bestConfidence),
        candidate_count: candidates.length.toString()
      },
      meta: {
        candidates: candidates.length,
        bestConfidence: bestConfidence,
        candidateNames: candidates.slice(0, 3).map(c => c.filename) // Top 3
      }
    });
    
    // Record slow analyzer performance
    if (durationMs > 50) { // > 50ms is considered slow
      this.telemetry.emit({
        event: FilenameInferenceEvent.ANALYZER_SLOW,
        dur: durationMs,
        tags: {
          _comp: 'system',
          operation: 'performance',
          analyzer: analyzer,
          duration_bucket: this.getDurationBucket(durationMs)
        }
      });
    }
  }
  
  /**
   * Record save mode decision
   */
  recordSaveModeDecision(confidence: number, mode: 'immediate' | 'interactive' | 'dry-run', reason: string): void {
    this.telemetry.emit({
      event: FilenameInferenceEvent.SAVE_MODE_DECIDED,
      tags: {
        _comp: 'system',
        operation: 'ux',
        mode: mode,
        confidence_level: this.getConfidenceLevel(confidence),
        reason: reason
      },
      meta: {
        confidence: confidence,
        mode: mode,
        reason: reason
      }
    });
  }
  
  /**
   * Record interactive selection
   */
  recordInteractiveSelection(candidates: FilenameCandidate[], selectedIndex: number, durationMs: number): void {
    this.telemetry.emit({
      event: FilenameInferenceEvent.INTERACTIVE_SELECTION_END,
      dur: durationMs,
      tags: {
        _comp: 'system',
        operation: 'ux',
        selection_type: selectedIndex === -1 ? 'custom' : 'candidate',
        candidate_count: candidates.length.toString()
      },
      meta: {
        candidateCount: candidates.length,
        selectedIndex: selectedIndex,
        selectedFilename: selectedIndex >= 0 ? candidates[selectedIndex]?.filename : 'custom'
      }
    });
  }
  
  /**
   * Record dry run execution
   */
  recordDryRun(analysisResults: any): void {
    this.telemetry.emit({
      event: FilenameInferenceEvent.DRY_RUN_EXECUTED,
      tags: {
        _comp: 'system',
        operation: 'ux',
        conflicts: analysisResults.conflicts > 0 ? 'true' : 'false',
        warnings: analysisResults.warnings > 0 ? 'true' : 'false'
      },
      meta: {
        conflicts: analysisResults.conflicts,
        warnings: analysisResults.warnings,
        recommendations: analysisResults.recommendations
      }
    });
  }
  
  /**
   * Record undo operation
   */
  recordUndo(operation: string, success: boolean): void {
    this.telemetry.emit({
      event: FilenameInferenceEvent.UNDO_EXECUTED,
      tags: {
        _comp: 'system',
        operation: 'ux',
        undo_type: operation,
        success: success ? 'true' : 'false'
      },
      meta: {
        operation: operation,
        success: success
      }
    });
  }
  
  /**
   * Record save operation
   */
  recordSave(operation: SaveOperation, result: SaveResult, durationMs: number): void {
    const success = result.success;
    
    this.telemetry.emit({
      event: success ? FilenameInferenceEvent.SAVE_OPERATION_SUCCESS : FilenameInferenceEvent.SAVE_OPERATION_FAILED,
      dur: durationMs,
      tags: {
        _comp: 'system',
        operation: 'save',
        save_type: operation.type,
        success: success ? 'true' : 'false',
        file_extension: this.getFileExtension(operation.filename)
      },
      meta: {
        filename: operation.filename,
        path: operation.path,
        fileSize: operation.content.length,
        error: result.error
      },
      _error: result.error ? {
        message: result.error,
        code: (result as any).errorCode
      } : undefined
    });
  }
  
  /**
   * Record security violations
   */
  recordSecurityViolation(type: 'path_traversal' | 'plan_violation' | 'permission_denied', details: any): void {
    let event: FilenameInferenceEvent;
    
    switch (type) {
      case 'path_traversal':
        event = FilenameInferenceEvent.PATH_TRAVERSAL_BLOCKED;
        break;
      case 'plan_violation':
        event = FilenameInferenceEvent.PLAN_VIOLATION_BLOCKED;
        break;
      case 'permission_denied':
        event = FilenameInferenceEvent.PERMISSION_DENIED;
        break;
    }
    
    this.telemetry.emit({
      event,
      tags: {
        _comp: 'system',
        operation: 'security',
        violation_type: type,
        severity: 'high'
      },
      meta: details,
      _error: {
        message: `Security violation: ${type}`,
        code: type.toUpperCase()
      }
    });
    
    // Also record in telemetry integration for alerting (if available)
    if (this.integration) {
      this.integration.recordTelemetry({
        metric: 'security_violation',
        type: type,
        severity: 'high',
        timestamp: Date.now(),
        details: details
      });
    }
  }
  
  /**
   * Generate metrics summary
   */
  async generateMetrics(windowMs: number = 300000): Promise<FilenameInferenceMetrics> {
    const events = this.telemetry.exportEvents({
      startTime: Date.now() - windowMs,
      event: /^filename\./
    });
    
    const metrics: FilenameInferenceMetrics = {
      totalInferences: 0,
      averageInferenceTime: 0,
      cacheHitRate: 0,
      timeoutRate: 0,
      highConfidenceRate: 0,
      mediumConfidenceRate: 0,
      lowConfidenceRate: 0,
      immediateMode: 0,
      interactiveMode: 0,
      dryRunMode: 0,
      userCancellations: 0,
      undoOperations: 0,
      securityViolations: 0,
      pathTraversalAttempts: 0,
      planViolations: 0,
      permissionDenials: 0,
      successfulSaves: 0,
      failedSaves: 0,
      saveSuccessRate: 0
    };
    
    // Calculate metrics from events
    const inferences = events.filter(e => e.event === FilenameInferenceEvent.INFERENCE_END);
    metrics.totalInferences = inferences.length;
    
    if (inferences.length > 0) {
      const durations = inferences.map(e => e.dur || 0);
      metrics.averageInferenceTime = durations.reduce((a, b) => a + b, 0) / durations.length;
      
      const timeouts = inferences.filter(e => e.meta?.timedOut).length;
      metrics.timeoutRate = timeouts / inferences.length;
      
      // Confidence rates
      const highConf = inferences.filter(e => e.tags.confidence_level === 'high').length;
      const medConf = inferences.filter(e => e.tags.confidence_level === 'medium').length;
      const lowConf = inferences.filter(e => e.tags.confidence_level === 'low').length;
      
      metrics.highConfidenceRate = highConf / inferences.length;
      metrics.mediumConfidenceRate = medConf / inferences.length;
      metrics.lowConfidenceRate = lowConf / inferences.length;
    }
    
    // Cache metrics
    const cacheHits = events.filter(e => e.event === FilenameInferenceEvent.INFERENCE_CACHE_HIT).length;
    const cacheMisses = events.filter(e => e.event === FilenameInferenceEvent.INFERENCE_CACHE_MISS).length;
    const totalCacheEvents = cacheHits + cacheMisses;
    if (totalCacheEvents > 0) {
      metrics.cacheHitRate = cacheHits / totalCacheEvents;
    }
    
    // UX metrics
    const modeEvents = events.filter(e => e.event === FilenameInferenceEvent.SAVE_MODE_DECIDED);
    metrics.immediateMode = modeEvents.filter(e => e.tags.mode === 'immediate').length;
    metrics.interactiveMode = modeEvents.filter(e => e.tags.mode === 'interactive').length;
    metrics.dryRunMode = modeEvents.filter(e => e.tags.mode === 'dry-run').length;
    
    metrics.undoOperations = events.filter(e => e.event === FilenameInferenceEvent.UNDO_EXECUTED).length;
    
    // Security metrics
    metrics.securityViolations = events.filter(e => e.event === FilenameInferenceEvent.SECURITY_VIOLATION).length;
    metrics.pathTraversalAttempts = events.filter(e => e.event === FilenameInferenceEvent.PATH_TRAVERSAL_BLOCKED).length;
    metrics.planViolations = events.filter(e => e.event === FilenameInferenceEvent.PLAN_VIOLATION_BLOCKED).length;
    metrics.permissionDenials = events.filter(e => e.event === FilenameInferenceEvent.PERMISSION_DENIED).length;
    
    // Save metrics
    metrics.successfulSaves = events.filter(e => e.event === FilenameInferenceEvent.SAVE_OPERATION_SUCCESS).length;
    metrics.failedSaves = events.filter(e => e.event === FilenameInferenceEvent.SAVE_OPERATION_FAILED).length;
    const totalSaves = metrics.successfulSaves + metrics.failedSaves;
    if (totalSaves > 0) {
      metrics.saveSuccessRate = metrics.successfulSaves / totalSaves;
    }
    
    return metrics;
  }
  
  /**
   * Record integration telemetry for external systems
   */
  async recordIntegrationTelemetry(data: any): Promise<void> {
    if (this.integration) {
      await this.integration.recordTelemetry({
        ...data,
        component: 'filename_inference',
        timestamp: Date.now()
      });
    } else {
      // Fallback to basic telemetry
      this.telemetry.emit({
        event: 'filename.integration.telemetry',
        tags: {
          _comp: 'system',
          operation: 'integration',
          component: 'filename_inference'
        },
        meta: data
      });
    }
  }
  
  // Helper methods
  
  private getConfidenceLevel(confidence: number): string {
    if (confidence >= 0.9) return 'high';
    if (confidence >= 0.7) return 'medium';
    return 'low';
  }
  
  private getDurationBucket(durationMs: number): string {
    if (durationMs < 10) return '0-10ms';
    if (durationMs < 50) return '10-50ms';
    if (durationMs < 100) return '50-100ms';
    if (durationMs < 200) return '100-200ms';
    return '200ms+';
  }
  
  private getFileExtension(filename: string): string {
    const ext = filename.split('.').pop();
    return ext ? ext.toLowerCase() : 'none';
  }
  
  private recordConfidenceMetrics(confidence: number): void {
    if (confidence >= 0.9) {
      this.telemetry.emit({
        event: FilenameInferenceEvent.HIGH_CONFIDENCE_INFERENCE,
        tags: {
          _comp: 'system',
          operation: 'performance',
          confidence_level: 'high'
        },
        meta: { confidence }
      });
    } else if (confidence < 0.7) {
      this.telemetry.emit({
        event: FilenameInferenceEvent.LOW_CONFIDENCE_INFERENCE,
        tags: {
          _comp: 'system',
          operation: 'performance',
          confidence_level: 'low'
        },
        meta: { confidence }
      });
    }
  }
  
  private recordTimeout(): void {
    this.telemetry.emit({
      event: FilenameInferenceEvent.INFERENCE_TIMEOUT,
      tags: {
        _comp: 'system',
        operation: 'performance',
        issue: 'timeout'
      }
    });
  }
}

// Export singleton instance
export const filenameInferenceTelemetry = new FilenameInferenceTelemetry();