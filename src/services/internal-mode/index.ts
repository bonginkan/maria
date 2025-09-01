/**
 * Internal Mode v2 - Modern mode management system
 *
 * This is the new recommended API for mode management with:
 * - Single source of truth: config/modes.ts
 * - Display isolation: DisplayService handles all UI
 * - Type safety: Full TypeScript support
 *
 * @example
 * ```typescript
 * import { getModeService, ModeId } from './services/internal-mode';
 *
 * const modeService = getModeService();
 * await modeService.switchMode('creative');
 * ```
 */

// Core exports
export {
  ModeService,
  getModeService,
  resetModeService,
} from "./services/ModeService";
export { DisplayService } from "./services/display";

// Types
export type { ModeId, ModeSpec } from "./config/modes";

// V1 compatibility aliases (temporary)
export type { ModeSpec as Mode } from "./config/modes";
export type { ModeId as LegacyModeType } from "./config/modes";

// Configuration
export { MODES, MODE_ALIASES } from "./config/modes";

// Version
export const INTERNAL_MODE_V2_VERSION = "2.0.0";
