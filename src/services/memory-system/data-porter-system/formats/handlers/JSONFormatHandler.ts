/**
 * JSON Format Handler
 *
 * Handles JSON serialization/deserialization with streaming support
 */

import { EventEmitter } from "node:events";
import {
  IFormatHandler,
  SupportedFormat,
  ValidationResult,
  ValidationError,
  ValidationWarning,
} from "../../types/porter-types";

export class JSONFormatHandler extends EventEmitter implements IFormatHandler {
  readonly format: SupportedFormat = "json";
  readonly supportedOperations: ("read" | "write" | "stream")[] = [
    "read",
    "write",
    "stream",
  ];

  private readonly maxDepth = 100;
  private readonly maxStringLength = 1000000; // 1MB
  private readonly maxArrayLength = 100000;

  /**
   * Validate JSON data structure
   */
  async validate(data: any, schema?: any): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      // Basic JSON validation
      if (data === undefined) {
        errors.push({
          path: "root",
          message: "Data is undefined",
          value: data,
        });
        return { valid: false, errors, warnings };
      }

      // Check for circular references
      if (this.hasCircularReferences(data)) {
        errors.push({
          path: "root",
          message: "Circular references detected",
          value: "[Circular]",
        });
        return { valid: false, errors, warnings };
      }

      // Check depth
      const depth = this.calculateDepth(data);
      if (depth > this.maxDepth) {
        errors.push({
          path: "root",
          message: `Object depth exceeds maximum (${this.maxDepth})`,
          value: depth,
          constraint: `maxDepth: ${this.maxDepth}`,
        });
      }

      // Check for very large strings
      this.checkStringLengths(data, "", errors, warnings);

      // Check for very large arrays
      this.checkArraySizes(data, "", errors, warnings);

      // Schema validation if provided
      if (schema) {
        const schemaErrors = this.validateAgainstSchema(data, schema);
        errors.push(...schemaErrors);
      }

      // Test serialization
      try {
        JSON.stringify(data);
      } catch (error) {
        errors.push({
          path: "root",
          message: `JSON serialization failed: ${error.message}`,
          value: "[Complex Object]",
        });
      }

      this.emit("validation_complete", {
        format: this.format,
        valid: errors.length === 0,
        errorCount: errors.length,
        warningCount: warnings.length,
      });

      return {
        valid: errors.length === 0,
        errors,
        warnings,
      };
    } catch (error) {
      errors.push({
        path: "root",
        message: `Validation error: ${error.message}`,
        value: data,
      });

      return { valid: false, errors, warnings };
    }
  }

  /**
   * Serialize data to JSON
   */
  async serialize(data: any, options: any = {}): Promise<string> {
    try {
      const {
        pretty = false,
        indent = 2,
        replacer = null,
        maxLength = this.maxStringLength,
      } = options;

      let result: string;

      if (pretty) {
        result = JSON.stringify(data, replacer, indent);
      } else {
        result = JSON.stringify(data, replacer);
      }

      if (result.length > maxLength) {
        throw new Error(
          `Serialized JSON exceeds maximum length (${maxLength})`,
        );
      }

      this.emit("serialization_complete", {
        format: this.format,
        size: result.length,
        pretty,
      });

      return result;
    } catch (error) {
      this.emit("serialization_error", {
        format: this.format,
        error: error.message,
      });
      throw new Error(`JSON serialization failed: ${error.message}`);
    }
  }

  /**
   * Deserialize JSON string to data
   */
  async deserialize(data: string, options: any = {}): Promise<any> {
    try {
      const { reviver = null, maxLength = this.maxStringLength } = options;

      if (typeof data !== "string") {
        throw new Error("Input must be a string");
      }

      if (data.length > maxLength) {
        throw new Error(`Input JSON exceeds maximum length (${maxLength})`);
      }

      const result = JSON.parse(data, reviver);

      this.emit("deserialization_complete", {
        format: this.format,
        inputSize: data.length,
        outputType: typeof result,
      });

      return result;
    } catch (error) {
      this.emit("deserialization_error", {
        format: this.format,
        error: error.message,
        inputLength: typeof data === "string" ? data.length : 0,
      });
      throw new Error(`JSON deserialization failed: ${error.message}`);
    }
  }

  /**
   * Stream serialize data to JSON
   */
  async *streamSerialize(
    data: AsyncIterable<any>,
    options: any = {},
  ): AsyncIterable<Buffer> {
    const { pretty = false, indent = 2, arrayWrapper = true } = options;

    try {
      // Start array if wrapping
      if (arrayWrapper) {
        yield Buffer.from("[", "utf8");
      }

      let isFirst = true;

      for await (const item of data) {
        // Add comma separator for array items
        if (arrayWrapper && !isFirst) {
          yield Buffer.from(",", "utf8");
        }

        // Add newline for pretty printing
        if (pretty && arrayWrapper) {
          yield Buffer.from("\n" + " ".repeat(indent), "utf8");
        }

        // Serialize item
        const serialized = await this.serialize(item, {
          ...options,
          pretty: false,
        });
        yield Buffer.from(serialized, "utf8");

        isFirst = false;

        this.emit("stream_item_serialized", {
          format: this.format,
          itemSize: serialized.length,
        });
      }

      // Close array if wrapping
      if (arrayWrapper) {
        if (pretty) {
          yield Buffer.from("\n]", "utf8");
        } else {
          yield Buffer.from("]", "utf8");
        }
      }

      this.emit("stream_serialization_complete", {
        format: this.format,
      });
    } catch (error) {
      this.emit("stream_serialization_error", {
        format: this.format,
        error: error.message,
      });
      throw new Error(`JSON stream serialization failed: ${error.message}`);
    }
  }

  /**
   * Stream deserialize JSON to data
   */
  async *streamDeserialize(
    data: AsyncIterable<Buffer>,
    options: any = {},
  ): AsyncIterable<any> {
    const {
      arrayWrapper = true,
      maxItemSize = 1000000, // 1MB per item
    } = options;

    try {
      let buffer = "";
      let inArray = false;
      let braceCount = 0;
      let bracketCount = 0;
      let inString = false;
      let escaped = false;
      let currentObject = "";

      for await (const chunk of data) {
        buffer += chunk.toString("utf8");

        let i = 0;
        while (i < buffer.length) {
          const char = buffer[i];

          if (escaped) {
            escaped = false;
            currentObject += char;
            i++;
            continue;
          }

          if (char === "\\" && inString) {
            escaped = true;
            currentObject += char;
            i++;
            continue;
          }

          if (char === '"') {
            inString = !inString;
          }

          if (!inString) {
            if (char === "[" && arrayWrapper && !inArray) {
              inArray = true;
              i++;
              continue;
            }

            if (
              char === "]" &&
              arrayWrapper &&
              inArray &&
              bracketCount === 0 &&
              braceCount === 0
            ) {
              // End of array, finish processing
              if (currentObject.trim()) {
                const item = await this.deserialize(
                  currentObject.trim(),
                  options,
                );
                yield item;
                this.emit("stream_item_deserialized", {
                  format: this.format,
                  itemSize: currentObject.length,
                });
              }
              break;
            }

            if (char === "{") {
              braceCount++;
            } else if (char === "}") {
              braceCount--;
            } else if (char === "[") {
              bracketCount++;
            } else if (char === "]") {
              bracketCount--;
            }

            if (
              char === "," &&
              bracketCount === 0 &&
              braceCount === 0 &&
              inArray
            ) {
              // Complete object found
              if (currentObject.trim()) {
                if (currentObject.length > maxItemSize) {
                  throw new Error(`Item size exceeds maximum (${maxItemSize})`);
                }

                const item = await this.deserialize(
                  currentObject.trim(),
                  options,
                );
                yield item;

                this.emit("stream_item_deserialized", {
                  format: this.format,
                  itemSize: currentObject.length,
                });
              }
              currentObject = "";
              i++;
              continue;
            }
          }

          currentObject += char;
          i++;
        }

        // Keep unprocessed part of buffer
        buffer = currentObject;
        currentObject = "";
      }

      // Process remaining buffer
      if (buffer.trim()) {
        const item = await this.deserialize(buffer.trim(), options);
        yield item;
        this.emit("stream_item_deserialized", {
          format: this.format,
          itemSize: buffer.length,
        });
      }

      this.emit("stream_deserialization_complete", {
        format: this.format,
      });
    } catch (error) {
      this.emit("stream_deserialization_error", {
        format: this.format,
        error: error.message,
      });
      throw new Error(`JSON stream deserialization failed: ${error.message}`);
    }
  }

  /**
   * Check for circular references
   */
  private hasCircularReferences(obj: any, seen = new WeakSet()): boolean {
    if (obj && typeof obj === "object") {
      if (seen.has(obj)) {
        return true;
      }
      seen.add(obj);

      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          if (this.hasCircularReferences(obj[key], seen)) {
            return true;
          }
        }
      }
      seen.delete(obj);
    }
    return false;
  }

  /**
   * Calculate object depth
   */
  private calculateDepth(obj: any, currentDepth = 0): number {
    if (currentDepth > this.maxDepth) {
      return currentDepth;
    }

    if (obj && typeof obj === "object") {
      let maxChildDepth = currentDepth;
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          const childDepth = this.calculateDepth(obj[key], currentDepth + 1);
          maxChildDepth = Math.max(maxChildDepth, childDepth);
        }
      }
      return maxChildDepth;
    }
    return currentDepth;
  }

  /**
   * Check string lengths recursively
   */
  private checkStringLengths(
    obj: any,
    path: string,
    errors: ValidationError[],
    warnings: ValidationWarning[],
  ): void {
    if (typeof obj === "string") {
      if (obj.length > this.maxStringLength) {
        errors.push({
          path,
          message: `String length exceeds maximum (${this.maxStringLength})`,
          value: `[String of length ${obj.length}]`,
          constraint: `maxStringLength: ${this.maxStringLength}`,
        });
      } else if (obj.length > this.maxStringLength * 0.8) {
        warnings.push({
          path,
          message: `String length is approaching maximum`,
          value: `[String of length ${obj.length}]`,
          suggestion: "Consider breaking into smaller chunks",
        });
      }
    } else if (obj && typeof obj === "object") {
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          this.checkStringLengths(
            obj[key],
            path ? `${path}.${key}` : key,
            errors,
            warnings,
          );
        }
      }
    }
  }

  /**
   * Check array sizes recursively
   */
  private checkArraySizes(
    obj: any,
    path: string,
    errors: ValidationError[],
    warnings: ValidationWarning[],
  ): void {
    if (Array.isArray(obj)) {
      if (obj.length > this.maxArrayLength) {
        errors.push({
          path,
          message: `Array length exceeds maximum (${this.maxArrayLength})`,
          value: `[Array of length ${obj.length}]`,
          constraint: `maxArrayLength: ${this.maxArrayLength}`,
        });
      } else if (obj.length > this.maxArrayLength * 0.8) {
        warnings.push({
          path,
          message: `Array length is approaching maximum`,
          value: `[Array of length ${obj.length}]`,
          suggestion: "Consider paginating or splitting the array",
        });
      }

      obj.forEach((item, index) => {
        this.checkArraySizes(item, `${path}[${index}]`, errors, warnings);
      });
    } else if (obj && typeof obj === "object") {
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          this.checkArraySizes(
            obj[key],
            path ? `${path}.${key}` : key,
            errors,
            warnings,
          );
        }
      }
    }
  }

  /**
   * Validate against JSON schema (basic implementation)
   */
  private validateAgainstSchema(data: any, schema: any): ValidationError[] {
    const errors: ValidationError[] = [];

    // Basic type checking
    if (schema.type && typeof data !== schema.type) {
      errors.push({
        path: "root",
        message: `Type mismatch. Expected: ${schema.type}, got: ${typeof data}`,
        value: data,
        constraint: `type: ${schema.type}`,
      });
    }

    // Required properties
    if (
      schema.required &&
      Array.isArray(schema.required) &&
      typeof data === "object"
    ) {
      for (const required of schema.required) {
        if (!(required in data)) {
          errors.push({
            path: required,
            message: `Missing required property: ${required}`,
            constraint: "required",
          });
        }
      }
    }

    return errors;
  }

  /**
   * Get format-specific health status
   */
  getHealthStatus(): {
    status: "healthy" | "degraded" | "unhealthy";
    details: any;
  } {
    return {
      status: "healthy",
      details: {
        format: this.format,
        supportedOperations: this.supportedOperations,
        limits: {
          maxDepth: this.maxDepth,
          maxStringLength: this.maxStringLength,
          maxArrayLength: this.maxArrayLength,
        },
      },
    };
  }
}
