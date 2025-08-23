/**
<<<<<<< HEAD
 * MARIA - Intelligent CLI Assistant
 * Entry point for the library
=======
 * MARIA - AI-Powered Development Platform
 * OSS Distribution Entry Point
 * @version 1.0.7
>>>>>>> 73f1a492c8b30ad4210f6a8d16116a915db9e914
 */

// CLI entry point
export { createCLI } from './cli';

<<<<<<< HEAD
// Memory System Exports
export { DualMemoryEngine } from './services/memory-system/dual-memory-engine';
export { MemoryCoordinator } from './services/memory-system/memory-coordinator';
export { System1MemoryManager as System1Memory } from './services/memory-system/system1-memory';
export { System2MemoryManager as System2Memory } from './services/memory-system/system2-memory';

// Internal Mode System Exports
export {
  InternalModeService,
  getInternalModeService,
} from './services/internal-mode/InternalModeService';
export { MemoryAwareModeService } from './services/internal-mode/MemoryAwareModeService';

// Memory System Types
export type {
  MemoryEvent,
  UserPreferenceSet,
  ReasoningTrace,
  QualityMetrics,
} from './services/memory-system/types/memory-interfaces';

export type { MemoryResponse } from './services/memory-system/dual-memory-engine';

export type {
  ModeDefinition,
  ModeContext,
  ModeRecognitionResult,
  ModeConfig,
} from './services/internal-mode/types';

// Version
export const VERSION = '1.1.0';
=======
// Version
export const VERSION = '1.0.7';
>>>>>>> 73f1a492c8b30ad4210f6a8d16116a915db9e914
