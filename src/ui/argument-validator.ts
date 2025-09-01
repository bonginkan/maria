export interface ValidationRule {
  type: "string" | "number" | "boolean" | "array" | "object";
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: RegExp;
  custom?: (_value: unknown) => boolean;
}

export interface ValidationSchema {
  [key: string]: ValidationRule;
}

export class ArgumentValidator {
  static validate(
    _args: Record<string, unknown>,
    schema: ValidationSchema,
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const [key, rule] of Object.entries(schema)) {
      const _value = _args[key];

      // Check required
      if (rule.required && (_value === undefined || _value === null)) {
        errors.push(`${key} is required`);
        continue;
      }

      if (_value === undefined || _value === null) {
        continue;
      }

      // Type validation
      const _actualType = Array.isArray(_value) ? "array" : typeof _value;
      if (_actualType !== rule.type) {
        errors.push(`${key} must be of type ${rule.type}, got ${_actualType}`);
        continue;
      }

      // String validation
      if (rule.type === "string" && typeof _value === "string") {
        if (rule.min !== undefined && _value.length < rule.min) {
          errors.push(`${key} must be at least ${rule.min} characters`);
        }
        if (rule.max !== undefined && _value.length > rule.max) {
          errors.push(`${key} must be at most ${rule.max} characters`);
        }
        if (rule.pattern && !rule.pattern.test(_value)) {
          errors.push(`${key} does not match required pattern`);
        }
      }

      // Number validation
      if (rule.type === "number" && typeof _value === "number") {
        if (rule.min !== undefined && _value < rule.min) {
          errors.push(`${key} must be at least ${rule.min}`);
        }
        if (rule.max !== undefined && _value > rule.max) {
          errors.push(`${key} must be at most ${rule.max}`);
        }
      }

      // Custom validation
      if (rule.custom && !rule.custom(_value)) {
        errors.push(`${key} failed custom validation`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
