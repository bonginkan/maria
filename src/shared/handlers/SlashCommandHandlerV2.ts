/**
 * SlashCommandHandler - Canonical Entry Point
 * 
 * This is the SINGLE SOURCE OF TRUTH for all SlashCommandHandler references.
 * Eliminates import path inconsistencies and CJS/ESM conflicts by providing
 * a centralized facade with comprehensive export compatibility.
 * 
 * Why this approach:
 * - ✅ Both Import Styles: Supports `import Handler from '...'` and `import { SlashCommandHandler } from '...'`
 * - ✅ Single Source: All references point to one facade, preventing path drift
 * - ✅ Type Safety: Re-exports types to maintain TypeScript integrity  
 * - ✅ Future-Proof: Easy to swap implementation without breaking consumers
 */

// Re-export the actual implementation
export { SlashCommandHandler } from './SlashCommandHandler';

// Re-export all related types for type safety
export type { 
  SlashCommandV2, 
  HandlerDependencies, 
  CommandResultV2 
} from './SlashCommandHandler';

// Default export for maximum compatibility (CJS/ESM)
import { SlashCommandHandler as Handler } from './SlashCommandHandler';
export default Handler;

// Legacy compatibility re-exports (backward compatibility)
export { SlashCommandHandler } from './SlashCommandHandler';

/**
 * Usage Examples:
 * 
 * // ESM named import (preferred)
 * import { SlashCommandHandler } from "./SlashCommandHandler";
 * 
 * // ESM default import
 * import Handler from "./SlashCommandHandler";
 * 
 * // CJS require
 * const { SlashCommandHandler } = require("./SlashCommandHandler");
 * 
 * // Type-only imports
 * import type { HandlerDependencies } from "./SlashCommandHandler";
 */