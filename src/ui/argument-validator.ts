export interface ValidationRule {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: RegExp;
  custom?: (value: unknown) => boolean;
}

export interface ValidationSchema {
  [key: string]: ValidationRule;
}

export class ArgumentValidator {
  static validate(
    args: Record<string, unknown>,
    schema: ValidationSchema,
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const [key, rule] of Object.entries(schema)) {
      const value = args[key];

      // Check required
      if (rule.required && (value === undefined || value === null)) {
        errors.push(`${key} is required`);
        continue;
      }

      if (value === undefined || value === null) {
        continue;
      }

      // Type validation
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      if (actualType !== rule.type) {
        errors.push(`${key} must be of type ${rule.type}, got ${actualType}`);
        continue;
      }

      // String validation
      if (rule.type === 'string' && typeof value === 'string') {
        if (rule.min !== undefined && value.length < rule.min) {
          errors.push(`${key} must be at least ${rule.min} characters`);
        }
        if (rule.max !== undefined && value.length > rule.max) {
          errors.push(`${key} must be at most ${rule.max} characters`);
        }
        if (rule.pattern && !rule.pattern.test(value)) {
          errors.push(`${key} does not match required pattern`);
        }
      }

      // Number validation
      if (rule.type === 'number' && typeof value === 'number') {
        if (rule.min !== undefined && value < rule.min) {
          errors.push(`${key} must be at least ${rule.min}`);
        }
        if (rule.max !== undefined && value > rule.max) {
          errors.push(`${key} must be at most ${rule.max}`);
        }
      }

      // Custom validation
      if (rule.custom && !rule.custom(value)) {
        errors.push(`${key} failed custom validation`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
