/**
 * ValidationMiddleware - Input validation and sanitization
 * - Validates command arguments
 * - Sanitizes user input
 * - Enforces command constraints
 */

import type {
  Middleware,
  CommandArgs,
  CommandContext,
} from "../router/CommandRouter";
import type { _NormalizedResult } from "../adapters/ResultAdapter";

export interface ValidationRule {
  type: "string" | "number" | "boolean" | "array" | "object" | "any";
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: RegExp;
  enum?: unknown[];
  custom?: (
    value: unknown,
    args: CommandArgs,
    context: CommandContext,
  ) => boolean | string;
}

export interface CommandValidation {
  minArgs?: number;
  maxArgs?: number;
  exactArgs?: number;
  argRules?: ValidationRule[];
  contextRequirements?: {
    requireUser?: boolean;
    requireSession?: boolean;
    requirePermissions?: string[];
  };
}

export class ValidationMiddleware implements Middleware {
  private validations = new Map<string, CommandValidation>();
  private globalValidation?: CommandValidation;

  /**
   * Register validation rules for a command
   */
  register(command: string, validation: CommandValidation): void {
    this.validations.set(command, validation);
  }

  /**
   * Set global validation rules (apply to all commands)
   */
  setGlobal(validation: CommandValidation): void {
    this.globalValidation = validation;
  }

  async before(
    command: string,
    args: CommandArgs,
    context: CommandContext,
  ): Promise<CommandContext> {
    // Get validation rules
    const validation = this.validations.get(command);
    const rules = validation || this.globalValidation;

    if (!rules) {
      return context; // No validation rules
    }

    // Validate argument count
    const argCountError = this.validateArgCount(args, rules);
    if (argCountError) {
      throw new ValidationError(argCountError);
    }

    // Validate individual arguments
    if (rules.argRules) {
      const argError = this.validateArgs(args, rules.argRules, context);
      if (argError) {
        throw new ValidationError(argError);
      }
    }

    // Validate context requirements
    if (rules.contextRequirements) {
      const contextError = this.validateContext(
        context,
        rules.contextRequirements,
      );
      if (contextError) {
        throw new ValidationError(contextError);
      }
    }

    // Return context as-is (args are not part of context)
    // Note: Args sanitization happens in the router itself
    return context;
  }

  private validateArgCount(
    args: CommandArgs,
    rules: CommandValidation,
  ): string | null {
    const count = args.length;

    if (rules.exactArgs !== undefined && count !== rules.exactArgs) {
      return `Expected exactly ${rules.exactArgs} argument(s), got ${count}`;
    }

    if (rules.minArgs !== undefined && count < rules.minArgs) {
      return `Expected at least ${rules.minArgs} argument(s), got ${count}`;
    }

    if (rules.maxArgs !== undefined && count > rules.maxArgs) {
      return `Expected at most ${rules.maxArgs} argument(s), got ${count}`;
    }

    return null;
  }

  private validateArgs(
    args: CommandArgs,
    rules: ValidationRule[],
    context: CommandContext,
  ): string | null {
    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];
      const value = args[i];

      // Check required
      if (
        rule.required &&
        (value === undefined || value === null || value === "")
      ) {
        return `Argument ${i + 1} is required`;
      }

      // Skip validation if not required and not provided
      if (!value && !rule.required) continue;

      // Type validation
      const typeError = this.validateType(value, rule.type, i + 1);
      if (typeError) return typeError;

      // Additional validations
      if (rule.type === "string" && typeof value === "string") {
        if (rule.min !== undefined && value.length < rule.min) {
          return `Argument ${i + 1} must be at least ${rule.min} characters`;
        }
        if (rule.max !== undefined && value.length > rule.max) {
          return `Argument ${i + 1} must be at most ${rule.max} characters`;
        }
        if (rule.pattern && !rule.pattern.test(value)) {
          return `Argument ${i + 1} does not match required pattern`;
        }
      }

      if (rule.type === "number" && typeof value === "string") {
        const num = parseFloat(value);
        if (!isNaN(num)) {
          if (rule.min !== undefined && num < rule.min) {
            return `Argument ${i + 1} must be at least ${rule.min}`;
          }
          if (rule.max !== undefined && num > rule.max) {
            return `Argument ${i + 1} must be at most ${rule.max}`;
          }
        }
      }

      // Enum validation
      if (rule.enum && !rule.enum.includes(value)) {
        return `Argument ${i + 1} must be one of: ${rule.enum.join(", ")}`;
      }

      // Custom validation
      if (rule.custom) {
        const result = rule.custom(value, args, context);
        if (typeof result === "string") {
          return result;
        }
        if (!result) {
          return `Argument ${i + 1} failed custom validation`;
        }
      }
    }

    return null;
  }

  private validateType(
    value: unknown,
    type: ValidationRule["type"],
    position: number,
  ): string | null {
    switch (type) {
      case "string":
        if (typeof value !== "string") {
          return `Argument ${position} must be a string`;
        }
        break;
      case "number":
        if (typeof value === "string") {
          const num = parseFloat(value);
          if (isNaN(num)) {
            return `Argument ${position} must be a number`;
          }
        } else if (typeof value !== "number") {
          return `Argument ${position} must be a number`;
        }
        break;
      case "boolean":
        if (typeof value === "string") {
          if (
            !["true", "false", "1", "0", "yes", "no"].includes(
              value.toLowerCase(),
            )
          ) {
            return `Argument ${position} must be a boolean`;
          }
        } else if (typeof value !== "boolean") {
          return `Argument ${position} must be a boolean`;
        }
        break;
      case "array":
        try {
          if (typeof value === "string") {
            JSON.parse(value);
          } else if (!Array.isArray(value)) {
            return `Argument ${position} must be an array`;
          }
        } catch {
          return `Argument ${position} must be a valid JSON array`;
        }
        break;
      case "object":
        try {
          if (typeof value === "string") {
            JSON.parse(value);
          } else if (typeof value !== "object" || value === null) {
            return `Argument ${position} must be an object`;
          }
        } catch {
          return `Argument ${position} must be a valid JSON object`;
        }
        break;
      case "any":
        // No validation needed
        break;
    }

    return null;
  }

  private validateContext(
    context: CommandContext,
    requirements: NonNullable<CommandValidation["contextRequirements"]>,
  ): string | null {
    // Check user requirement
    if (requirements.requireUser) {
      const contextData =
        typeof context === "object" && "user" in context ? context : null;
      if (!contextData?.user) {
        return "This command requires user authentication";
      }
    }

    // Check session requirement
    if (requirements.requireSession) {
      const contextData =
        typeof context === "object" && "sessionId" in context ? context : null;
      if (!contextData?.sessionId) {
        return "This command requires an active session";
      }
    }

    // Check permissions
    if (
      requirements.requirePermissions &&
      requirements.requirePermissions.length > 0
    ) {
      const contextData =
        typeof context === "object" && "user" in context ? context : null;
      const userPermissions = (contextData?.user as any)?.permissions as
        | string[]
        | undefined;

      if (!userPermissions) {
        return "This command requires specific permissions";
      }

      const missingPermissions = requirements.requirePermissions.filter(
        (perm) => !userPermissions.includes(perm),
      );

      if (missingPermissions.length > 0) {
        return `Missing required permissions: ${missingPermissions.join(", ")}`;
      }
    }

    return null;
  }

  private sanitizeArgs(args: CommandArgs): CommandArgs {
    return args.map((arg) => {
      if (typeof arg !== "string") return arg;

      // Remove control characters
      let sanitized = arg.replace(/[\u0000-\u001F\x7F]/g, "");

      // Trim whitespace
      sanitized = sanitized.trim();

      // Prevent command injection
      sanitized = sanitized.replace(/^[\/\\]/, "");

      // Limit length to prevent DoS
      const MAX_ARG_LENGTH = 10000;
      if (sanitized.length > MAX_ARG_LENGTH) {
        sanitized = sanitized.substring(0, MAX_ARG_LENGTH);
      }

      return sanitized;
    });
  }

  /**
   * Create validation rules from a schema-like object
   */
  static fromSchema(schema: {
    [command: string]: {
      args?: Array<{
        name: string;
        type: ValidationRule["type"];
        required?: boolean;
        description?: string;
        [key: string]: unknown;
      }>;
      minArgs?: number;
      maxArgs?: number;
      requireUser?: boolean;
      requireSession?: boolean;
      requirePermissions?: string[];
    };
  }): ValidationMiddleware {
    const middleware = new ValidationMiddleware();

    for (const [command, config] of Object.entries(schema)) {
      const validation: CommandValidation = {
        minArgs: config.minArgs,
        maxArgs: config.maxArgs,
      };

      if (config.args) {
        validation.argRules = config.args.map((arg) => ({
          type: arg.type,
          required: arg.required,
        }));
      }

      if (
        config.requireUser ||
        config.requireSession ||
        config.requirePermissions
      ) {
        validation.contextRequirements = {
          requireUser: config.requireUser,
          requireSession: config.requireSession,
          requirePermissions: config.requirePermissions,
        };
      }

      middleware.register(command, validation);
    }

    return middleware;
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}
