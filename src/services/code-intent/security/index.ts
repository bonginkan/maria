/**
 * Security Module Exports
 * Central export point for all security components
 */

export { PathSecurityValidator } from './PathSecurityValidator';
export { ExtensionGuard } from './ExtensionGuard';
export { CollisionResolver } from './CollisionResolver';
export { PlanEnforcer } from './PlanEnforcer';

// Re-export types for convenience
export type {
  SaveOperation,
  SaveResult,
  PlanFileSaveConfig,
  NamingConvention,
  SecurityError,
  PlanViolationError,
  PermissionError,
  UserCancelledError
} from '../types/filename-inference.types';