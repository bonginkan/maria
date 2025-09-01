/**
 * Interactive Services Barrel Export
 *
 * Provides stable import paths for interactive CLI components.
 * Use this barrel for all external imports to avoid direct file dependencies.
 *
 * @example
 * ```typescript
 * import { EnhancedCLIInput, InteractiveUIRenderer } from '@bonginkan/maria/services/interactive';
 * ```
 */

// Main CLI Input (canonical implementation)
export * from "./EnhancedCLIInput"; // Final canonical implementation

// Core UI and interaction services
export * from "./InteractiveUIRenderer";
export * from "./KeyboardNavigationHandler";
export * from "./SlashCompletionService";

// Utility services
export * from "./CommandFrequencyTracker";
export * from "./CommandSearchEngine";
export * from "./InteractiveHelpService";

// Shared types and interfaces
export * from "./types";

// Re-exports for backward compatibility (will be removed in next minor release)
// V2 is now a compatibility layer pointing to the main implementation
