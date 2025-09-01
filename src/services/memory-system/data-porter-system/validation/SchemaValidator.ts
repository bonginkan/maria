/**
 * Schema Validator
 *
 * Validates data against predefined schemas with auto-detection capabilities
 */

import { EventEmitter } from "node:events";
import {
  SchemaValidation,
  SchemaDefinition,
  ValidationResult,
  ValidationError,
  ValidationWarning,
} from "../types/porter-types";

export interface ValidationContext {
  requestId: string;
  userId: string;
  correlationId: string;
  timestamp: number;
  metadata: Record<string, any>;
}

export interface SchemaMatchResult {
  schema: SchemaDefinition;
  confidence: number;
  reasons: string[];
}

export class SchemaValidator extends EventEmitter {
  private config: SchemaValidation;
  private readonly builtInSchemas = new Map<string, SchemaDefinition>();

  constructor(config: SchemaValidation) {
    super();
    this.config = config;
    this.initializeBuiltInSchemas();
  }

  /**
   * Initialize built-in schema definitions
   */
  private initializeBuiltInSchemas(): void {
    // User record schema
    this.builtInSchemas.set("user", {
      name: "User Record",
      version: "1.0.0",
      format: "json",
      required: false,
      definition: {
        type: "object",
        properties: {
          id: { type: "string", pattern: "^[a-zA-Z0-9-_]+$" },
          email: { type: "string", format: "email" },
          name: { type: "string", minLength: 1, maxLength: 100 },
          age: { type: "number", minimum: 0, maximum: 150 },
          createdAt: { type: "string", format: "date-time" },
          active: { type: "boolean" },
        },
        required: ["id", "email", "name"],
      },
    });

    // Memory system record schema
    this.builtInSchemas.set("memory", {
      name: "Memory Record",
      version: "1.0.0",
      format: "json",
      required: false,
      definition: {
        type: "object",
        properties: {
          id: { type: "string" },
          userId: { type: "string" },
          content: { type: "string", minLength: 1 },
          metadata: { type: "object" },
          tags: { type: "array", items: { type: "string" } },
          timestamp: { type: "number" },
          classification: {
            type: "object",
            properties: {
              level: {
                type: "string",
                enum: [
                  "public",
                  "internal",
                  "confidential",
                  "restricted",
                  "secret",
                ],
              },
              handling: {
                type: "string",
                enum: ["standard", "encrypted", "masked", "redacted"],
              },
            },
          },
        },
        required: ["id", "userId", "content", "timestamp"],
      },
    });

    // Audit log schema
    this.builtInSchemas.set("audit", {
      name: "Audit Log",
      version: "1.0.0",
      format: "json",
      required: false,
      definition: {
        type: "object",
        properties: {
          id: { type: "string" },
          userId: { type: "string" },
          action: { type: "string" },
          resource: { type: "string" },
          timestamp: { type: "number" },
          ip: { type: "string", format: "ipv4" },
          userAgent: { type: "string" },
          success: { type: "boolean" },
          details: { type: "object" },
        },
        required: ["id", "userId", "action", "resource", "timestamp"],
      },
    });

    // CSV tabular data schema
    this.builtInSchemas.set("tabular", {
      name: "Tabular Data",
      version: "1.0.0",
      format: "csv",
      required: false,
      definition: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: { type: "string" },
        },
        minItems: 1,
      },
    });
  }

  /**
   * Validate data against schemas
   */
  async validate(
    data: any,
    context: ValidationContext,
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      if (!this.config.enabled) {
        return { valid: true, errors, warnings };
      }

      const schemasToValidate: SchemaDefinition[] = [];

      // Auto-detect schema if enabled
      if (this.config.autoDetect) {
        const detectedSchemas = await this.detectSchemas(data);
        schemasToValidate.push(
          ...detectedSchemas.map((result) => result.schema),
        );

        if (detectedSchemas.length === 0) {
          warnings.push({
            path: "root",
            message: "No matching schemas detected",
            suggestion: "Consider defining a custom schema for this data type",
          });
        } else {
          this.emit("schema_detected", {
            context,
            schemas: detectedSchemas,
          });
        }
      }

      // Add configured schemas
      const configuredSchemas = this.config.schemas.filter(
        (schema) => !schema.required || this.config.strict,
      );
      schemasToValidate.push(...configuredSchemas);

      // Add required schemas
      const requiredSchemas = this.config.schemas.filter(
        (schema) => schema.required,
      );
      schemasToValidate.push(...requiredSchemas);

      // Validate against each schema
      for (const schema of schemasToValidate) {
        try {
          const result = await this.validateAgainstSchema(
            data,
            schema,
            context,
          );

          if (!result.valid) {
            if (schema.required) {
              // Required schema failures are errors
              errors.push(...result.errors);
            } else if (this.config.strict) {
              // In strict mode, all failures are errors
              errors.push(...result.errors);
            } else {
              // Optional schema failures are warnings
              const schemaWarnings: ValidationWarning[] = result.errors.map(
                (error) => ({
                  path: error.path,
                  message: `Schema '${schema.name}': ${error.message}`,
                  value: error.value,
                  suggestion: `Consider conforming to ${schema.name} schema`,
                }),
              );
              warnings.push(...schemaWarnings);
            }
          }

          warnings.push(...result.warnings);

          this.emit("schema_validated", {
            context,
            schema: schema.name,
            valid: result.valid,
            errorCount: result.errors.length,
            warningCount: result.warnings.length,
          });
        } catch (error) {
          const errorMessage = `Schema validation failed for '${schema.name}': ${error.message}`;

          if (schema.required) {
            errors.push({
              path: "schema",
              message: errorMessage,
              value: schema.name,
            });
          } else {
            warnings.push({
              path: "schema",
              message: errorMessage,
              suggestion: "Review schema definition",
            });
          }
        }
      }

      const result: ValidationResult = {
        valid: errors.length === 0,
        errors,
        warnings,
      };

      this.emit("validation_complete", {
        context,
        result,
        schemasValidated: schemasToValidate.length,
      });

      return result;
    } catch (error) {
      this.emit("validation_error", {
        context,
        error: error.message,
      });

      throw new Error(`Schema validation failed: ${error.message}`);
    }
  }

  /**
   * Detect possible schemas for data
   */
  async detectSchemas(data: any): Promise<SchemaMatchResult[]> {
    const matches: SchemaMatchResult[] = [];

    // Check all available schemas
    const allSchemas = [
      ...Array.from(this.builtInSchemas.values()),
      ...this.config.schemas,
    ];

    for (const schema of allSchemas) {
      try {
        const confidence = await this.calculateSchemaConfidence(data, schema);

        if (confidence > 0.5) {
          // 50% confidence threshold
          matches.push({
            schema,
            confidence,
            reasons: this.getMatchReasons(data, schema),
          });
        }
      } catch (error) {
        // Skip schemas that can't be evaluated
      }
    }

    // Sort by confidence (highest first)
    matches.sort((a, b) => b.confidence - a.confidence);

    return matches.slice(0, 3); // Return top 3 matches
  }

  /**
   * Calculate confidence score for schema match
   */
  private async calculateSchemaConfidence(
    data: any,
    schema: SchemaDefinition,
  ): Promise<number> {
    try {
      const result = await this.validateAgainstSchema(data, schema, {
        requestId: "confidence-check",
        userId: "system",
        correlationId: "schema-detection",
        timestamp: Date.now(),
        metadata: {},
      });

      if (result.valid) {
        return 1.0; // Perfect match
      }

      // Calculate partial confidence based on errors
      const totalChecks = this.countSchemaChecks(schema.definition);
      const failedChecks = result.errors.length;
      const passedChecks = totalChecks - failedChecks;

      return Math.max(0, passedChecks / totalChecks);
    } catch (error) {
      return 0; // No confidence if validation fails completely
    }
  }

  /**
   * Get reasons for schema match
   */
  private getMatchReasons(data: any, schema: SchemaDefinition): string[] {
    const reasons: string[] = [];

    if (schema.definition.type && typeof data === schema.definition.type) {
      reasons.push(`Data type matches (${schema.definition.type})`);
    }

    if (
      schema.definition.properties &&
      typeof data === "object" &&
      data !== null
    ) {
      const dataKeys = Object.keys(data);
      const schemaKeys = Object.keys(schema.definition.properties);
      const commonKeys = dataKeys.filter((key) => schemaKeys.includes(key));

      if (commonKeys.length > 0) {
        reasons.push(`${commonKeys.length} matching properties`);
      }

      if (schema.definition.required) {
        const hasAllRequired = schema.definition.required.every((key: string) =>
          dataKeys.includes(key),
        );
        if (hasAllRequired) {
          reasons.push("All required properties present");
        }
      }
    }

    if (Array.isArray(data) && schema.definition.type === "array") {
      reasons.push("Array structure matches");

      if (data.length > 0 && schema.definition.items) {
        reasons.push("Array items conform to schema");
      }
    }

    return reasons;
  }

  /**
   * Count total number of schema checks
   */
  private countSchemaChecks(definition: any): number {
    let count = 1; // Base type check

    if (definition.properties) {
      count += Object.keys(definition.properties).length;
    }

    if (definition.required) {
      count += definition.required.length;
    }

    if (definition.items && Array.isArray(definition.items)) {
      count += definition.items.length;
    }

    return count;
  }

  /**
   * Validate data against specific schema
   */
  private async validateAgainstSchema(
    data: any,
    schema: SchemaDefinition,
    context: ValidationContext,
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      const definition = schema.definition;

      // Type validation
      if (definition.type) {
        const actualType = Array.isArray(data) ? "array" : typeof data;
        if (actualType !== definition.type) {
          errors.push({
            path: "root",
            message: `Type mismatch. Expected: ${definition.type}, got: ${actualType}`,
            value: actualType,
            constraint: `type: ${definition.type}`,
          });
          return { valid: false, errors, warnings };
        }
      }

      // Object validation
      if (
        definition.type === "object" &&
        typeof data === "object" &&
        data !== null
      ) {
        await this.validateObject(data, definition, "", errors, warnings);
      }

      // Array validation
      if (definition.type === "array" && Array.isArray(data)) {
        await this.validateArray(data, definition, "", errors, warnings);
      }

      // String validation
      if (definition.type === "string" && typeof data === "string") {
        this.validateString(data, definition, "root", errors, warnings);
      }

      // Number validation
      if (definition.type === "number" && typeof data === "number") {
        this.validateNumber(data, definition, "root", errors, warnings);
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
      };
    } catch (error) {
      errors.push({
        path: "schema",
        message: `Schema validation error: ${error.message}`,
        value: schema.name,
      });

      return { valid: false, errors, warnings };
    }
  }

  /**
   * Validate object against schema
   */
  private async validateObject(
    obj: any,
    definition: any,
    path: string,
    errors: ValidationError[],
    warnings: ValidationWarning[],
  ): Promise<void> {
    // Required properties
    if (definition.required && Array.isArray(definition.required)) {
      for (const required of definition.required) {
        if (!(required in obj)) {
          errors.push({
            path: path ? `${path}.${required}` : required,
            message: `Missing required property: ${required}`,
            constraint: "required",
          });
        }
      }
    }

    // Property validation
    if (definition.properties) {
      for (const [key, propSchema] of Object.entries(definition.properties)) {
        const propPath = path ? `${path}.${key}` : key;
        const propValue = obj[key];

        if (propValue !== undefined) {
          await this.validatePropertyValue(
            propValue,
            propSchema as any,
            propPath,
            errors,
            warnings,
          );
        }
      }
    }

    // Additional properties
    if (definition.additionalProperties === false && definition.properties) {
      const allowedKeys = Object.keys(definition.properties);
      const extraKeys = Object.keys(obj).filter(
        (key) => !allowedKeys.includes(key),
      );

      if (extraKeys.length > 0) {
        warnings.push({
          path: path || "root",
          message: `Additional properties found: ${extraKeys.join(", ")}`,
          suggestion: "Remove extra properties or update schema to allow them",
        });
      }
    }
  }

  /**
   * Validate array against schema
   */
  private async validateArray(
    arr: any[],
    definition: any,
    path: string,
    errors: ValidationError[],
    warnings: ValidationWarning[],
  ): Promise<void> {
    // Length validation
    if (definition.minItems !== undefined && arr.length < definition.minItems) {
      errors.push({
        path,
        message: `Array too short. Expected at least ${definition.minItems} items, got ${arr.length}`,
        value: arr.length,
        constraint: `minItems: ${definition.minItems}`,
      });
    }

    if (definition.maxItems !== undefined && arr.length > definition.maxItems) {
      errors.push({
        path,
        message: `Array too long. Expected at most ${definition.maxItems} items, got ${arr.length}`,
        value: arr.length,
        constraint: `maxItems: ${definition.maxItems}`,
      });
    }

    // Item validation
    if (definition.items) {
      for (let i = 0; i < arr.length; i++) {
        const itemPath = `${path}[${i}]`;
        await this.validatePropertyValue(
          arr[i],
          definition.items,
          itemPath,
          errors,
          warnings,
        );
      }
    }
  }

  /**
   * Validate string against schema
   */
  private validateString(
    str: string,
    definition: any,
    path: string,
    errors: ValidationError[],
    warnings: ValidationWarning[],
  ): void {
    // Length validation
    if (
      definition.minLength !== undefined &&
      str.length < definition.minLength
    ) {
      errors.push({
        path,
        message: `String too short. Expected at least ${definition.minLength} characters, got ${str.length}`,
        value: str.length,
        constraint: `minLength: ${definition.minLength}`,
      });
    }

    if (
      definition.maxLength !== undefined &&
      str.length > definition.maxLength
    ) {
      errors.push({
        path,
        message: `String too long. Expected at most ${definition.maxLength} characters, got ${str.length}`,
        value: str.length,
        constraint: `maxLength: ${definition.maxLength}`,
      });
    }

    // Pattern validation
    if (definition.pattern) {
      const regex = new RegExp(definition.pattern);
      if (!regex.test(str)) {
        errors.push({
          path,
          message: `String does not match pattern: ${definition.pattern}`,
          value: str,
          constraint: `pattern: ${definition.pattern}`,
        });
      }
    }

    // Format validation
    if (definition.format) {
      const isValid = this.validateFormat(str, definition.format);
      if (!isValid) {
        errors.push({
          path,
          message: `String does not match format: ${definition.format}`,
          value: str,
          constraint: `format: ${definition.format}`,
        });
      }
    }

    // Enum validation
    if (definition.enum && Array.isArray(definition.enum)) {
      if (!definition.enum.includes(str)) {
        errors.push({
          path,
          message: `Value not in allowed enum: ${definition.enum.join(", ")}`,
          value: str,
          constraint: `enum: [${definition.enum.join(", ")}]`,
        });
      }
    }
  }

  /**
   * Validate number against schema
   */
  private validateNumber(
    num: number,
    definition: any,
    path: string,
    errors: ValidationError[],
    warnings: ValidationWarning[],
  ): void {
    // Range validation
    if (definition.minimum !== undefined && num < definition.minimum) {
      errors.push({
        path,
        message: `Number too small. Expected at least ${definition.minimum}, got ${num}`,
        value: num,
        constraint: `minimum: ${definition.minimum}`,
      });
    }

    if (definition.maximum !== undefined && num > definition.maximum) {
      errors.push({
        path,
        message: `Number too large. Expected at most ${definition.maximum}, got ${num}`,
        value: num,
        constraint: `maximum: ${definition.maximum}`,
      });
    }

    // Multiple validation
    if (
      definition.multipleOf !== undefined &&
      num % definition.multipleOf !== 0
    ) {
      errors.push({
        path,
        message: `Number is not a multiple of ${definition.multipleOf}`,
        value: num,
        constraint: `multipleOf: ${definition.multipleOf}`,
      });
    }
  }

  /**
   * Validate property value recursively
   */
  private async validatePropertyValue(
    value: any,
    schema: any,
    path: string,
    errors: ValidationError[],
    warnings: ValidationWarning[],
  ): Promise<void> {
    if (schema.type) {
      const actualType = Array.isArray(value) ? "array" : typeof value;
      if (actualType !== schema.type) {
        errors.push({
          path,
          message: `Type mismatch. Expected: ${schema.type}, got: ${actualType}`,
          value: actualType,
          constraint: `type: ${schema.type}`,
        });
        return;
      }
    }

    if (
      schema.type === "object" &&
      typeof value === "object" &&
      value !== null
    ) {
      await this.validateObject(value, schema, path, errors, warnings);
    } else if (schema.type === "array" && Array.isArray(value)) {
      await this.validateArray(value, schema, path, errors, warnings);
    } else if (schema.type === "string" && typeof value === "string") {
      this.validateString(value, schema, path, errors, warnings);
    } else if (schema.type === "number" && typeof value === "number") {
      this.validateNumber(value, schema, path, errors, warnings);
    }
  }

  /**
   * Validate string format
   */
  private validateFormat(value: string, format: string): boolean {
    switch (format) {
      case "email":
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      case "date-time":
        return !isNaN(Date.parse(value));
      case "date":
        return /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(value));
      case "time":
        return /^\d{2}:\d{2}:\d{2}$/.test(value);
      case "ipv4":
        return /^(\d{1,3}\.){3}\d{1,3}$/.test(value);
      case "ipv6":
        return /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/.test(value);
      case "uri":
        try {
          new URL(value);
          return true;
        } catch {
          return false;
        }
      case "uuid":
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          value,
        );
      default:
        return true; // Unknown formats pass
    }
  }

  /**
   * Update schema validator configuration
   */
  updateConfig(newConfig: Partial<SchemaValidation>): void {
    Object.assign(this.config, newConfig);

    this.emit("config_updated", {
      timestamp: Date.now(),
      config: this.config,
    });
  }

  /**
   * Get schema validator health status
   */
  getHealthStatus(): {
    status: "healthy" | "degraded" | "unhealthy";
    details: any;
  } {
    return {
      status: "healthy",
      details: {
        enabled: this.config.enabled,
        strict: this.config.strict,
        autoDetect: this.config.autoDetect,
        configuredSchemas: this.config.schemas.length,
        builtInSchemas: this.builtInSchemas.size,
      },
    };
  }
}
