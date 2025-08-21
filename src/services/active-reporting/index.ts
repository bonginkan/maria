/**
 * Active Reporting System - Main Export
 * Systematic Horenso (Report-Contact-Consult) Implementation
 */

// Core Services
export { ActiveReportingService } from './ActiveReportingService';
export { IntentAnalyzer } from './IntentAnalyzer';
export { SOWGenerator } from './SOWGenerator';
export { TaskDecomposer } from './TaskDecomposer';
export { ProgressTracker } from './ProgressTracker';
export { TaskVisualizer } from './TaskVisualizer';
export { ProactiveReporter } from './ProactiveReporter';

// Types
export * from './types';

// Re-export for convenience
import { ActiveReportingService } from './ActiveReportingService';

/**
 * Create and configure the Active Reporting System
 */
export function createActiveReportingSystem(): ActiveReportingService {
  return new ActiveReportingService();
}

/**
 * Default export for easy importing
 */
export default ActiveReportingService;
