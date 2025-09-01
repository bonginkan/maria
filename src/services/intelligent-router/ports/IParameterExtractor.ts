/**
 * Port interface for Parameter Extraction
 */

export interface IParameterExtractor {
  extract(_text: string, intent: string): ExtractedParameters;
  validate(parameters: ExtractedParameters): ValidationResult;
}

export interface ExtractedParameters {
  required: Record<string, any>;
  optional: Record<string, any>;
  flags: string[];
  raw: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions?: string[];
}
