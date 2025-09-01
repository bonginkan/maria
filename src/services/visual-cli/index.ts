/**
 * Visual CLI Module Exports
 */

// Core components
export { InputRenderer } from "./InputRenderer";
export { FileDropHandler } from "./FileDropHandler";
export type { DroppedFile } from "./FileDropHandler";
export { OCRProcessor } from "./OCRProcessor";
export type { OCRResult, OCRWord } from "./OCRProcessor";
export { ReferenceManager } from "./ReferenceManager";
export type {
  Reference,
  ReferenceMetadata,
} from "./ReferenceManager";
export { ResponseRenderer } from "./ResponseRenderer";
export type { ProgressStep } from "./ResponseRenderer";

// Main interface
export { EnhancedCLIInterface } from "./EnhancedCLIInterface";
export type {
  EnhancedCLIConfig,
  CLISession,
} from "./EnhancedCLIInterface";

// Type definitions
export interface VisualCLIOptions {
  enableEnhancedInterface: boolean;
  inputBoxWidth: number;
  enableFileDrops: boolean;
  enableOCR: boolean;
  enableImageAnalysis: boolean;
  autoResize: boolean;
  showProgressReports: boolean;
}

// Default configuration
export const DEFAULTVISUAL_CLI_CONFIG: VisualCLIOptions = {
  enableEnhancedInterface: true,
  inputBoxWidth: 120,
  enableFileDrops: true,
  enableOCR: true,
  enableImageAnalysis: true,
  autoResize: true,
  showProgressReports: true,
};

// Factory function
export function createEnhancedCLI(
  _maria: unknown,
  options: Partial<VisualCLIOptions> = {},
) {
  const _config = { ...DEFAULT_VISUAL_CLI_CONFIG, ...options };

  return new EnhancedCLIInterface(_maria, {
    inputBox: {
      width: _config.inputBoxWidth,
    },
    enableFileDrops: _config.enableFileDrops,
    enableOCR: _config.enableOCR,
    enableImageAnalysis: _config.enableImageAnalysis,
    autoResize: _config.autoResize,
    showProgressReports: _config.showProgressReports,
  });
}
