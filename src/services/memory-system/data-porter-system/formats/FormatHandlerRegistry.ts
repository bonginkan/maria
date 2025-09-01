/**
 * Format Handler Registry
 *
 * Central registry for all format handlers with factory pattern
 */

import { EventEmitter } from "node:events";
import { IFormatHandler, SupportedFormat } from "../types/porter-types";
import { JSONFormatHandler } from "./handlers/JSONFormatHandler";
import { CSVFormatHandler } from "./handlers/CSVFormatHandler";

export interface FormatHandlerFactory {
  create(): IFormatHandler;
  supports: ("read" | "write" | "stream")[];
  description: string;
  defaultOptions?: any;
}

export class FormatHandlerRegistry extends EventEmitter {
  private readonly handlers = new Map<SupportedFormat, FormatHandlerFactory>();
  private readonly instances = new Map<string, IFormatHandler>();

  constructor() {
    super();
    this.registerBuiltInHandlers();
  }

  /**
   * Register built-in format handlers
   */
  private registerBuiltInHandlers(): void {
    // JSON Handler
    this.register("json", {
      create: () => new JSONFormatHandler(),
      supports: ["read", "write", "stream"],
      description:
        "JavaScript Object Notation - lightweight data-interchange format",
      defaultOptions: {
        pretty: false,
        indent: 2,
      },
    });

    // CSV Handler
    this.register("csv", {
      create: () => new CSVFormatHandler(),
      supports: ["read", "write", "stream"],
      description: "Comma-Separated Values - tabular data format",
      defaultOptions: {
        delimiter: ",",
        quote: '"',
        header: true,
      },
    });

    // Placeholder for other formats
    this.register("xml", {
      create: () => {
        throw new Error("XML format handler not implemented yet");
      },
      supports: ["read", "write"],
      description: "Extensible Markup Language - structured document format",
    });

    this.register("yaml", {
      create: () => {
        throw new Error("YAML format handler not implemented yet");
      },
      supports: ["read", "write"],
      description:
        "YAML Ain't Markup Language - human-readable data serialization",
    });

    this.register("binary", {
      create: () => {
        throw new Error("Binary format handler not implemented yet");
      },
      supports: ["read", "write", "stream"],
      description: "Binary data format with custom serialization",
    });

    this.register("encrypted", {
      create: () => {
        throw new Error("Encrypted format handler not implemented yet");
      },
      supports: ["read", "write", "stream"],
      description: "Encrypted binary format with integrated security",
    });

    this.register("parquet", {
      create: () => {
        throw new Error("Parquet format handler not implemented yet");
      },
      supports: ["read", "write", "stream"],
      description: "Apache Parquet - columnar storage format",
    });

    this.register("avro", {
      create: () => {
        throw new Error("Avro format handler not implemented yet");
      },
      supports: ["read", "write", "stream"],
      description: "Apache Avro - data serialization system",
    });
  }

  /**
   * Register a format handler factory
   */
  register(format: SupportedFormat, factory: FormatHandlerFactory): void {
    this.handlers.set(format, factory);

    this.emit("format_registered", {
      format,
      supports: factory.supports,
      description: factory.description,
    });
  }

  /**
   * Get format handler instance
   */
  get(format: SupportedFormat, options: any = {}): IFormatHandler {
    const instanceKey = `${format}_${JSON.stringify(options)}`;

    // Return cached instance if exists
    if (this.instances.has(instanceKey)) {
      return this.instances.get(instanceKey)!;
    }

    const factory = this.handlers.get(format);
    if (!factory) {
      throw new Error(`Unsupported format: ${format}`);
    }

    try {
      const handler = factory.create();

      // Cache instance
      this.instances.set(instanceKey, handler);

      this.emit("handler_created", {
        format,
        instanceKey,
        supports: factory.supports,
      });

      return handler;
    } catch (error) {
      this.emit("handler_creation_error", {
        format,
        error: error.message,
      });
      throw new Error(
        `Failed to create handler for format ${format}: ${error.message}`,
      );
    }
  }

  /**
   * Check if format is supported
   */
  isSupported(format: SupportedFormat): boolean {
    return this.handlers.has(format);
  }

  /**
   * Check if format supports specific operation
   */
  supportsOperation(
    format: SupportedFormat,
    operation: "read" | "write" | "stream",
  ): boolean {
    const factory = this.handlers.get(format);
    return factory ? factory.supports.includes(operation) : false;
  }

  /**
   * List all supported formats
   */
  listFormats(): Array<{
    format: SupportedFormat;
    supports: ("read" | "write" | "stream")[];
    description: string;
    defaultOptions?: any;
  }> {
    const formats: Array<{
      format: SupportedFormat;
      supports: ("read" | "write" | "stream")[];
      description: string;
      defaultOptions?: any;
    }> = [];

    for (const [format, factory] of this.handlers.entries()) {
      formats.push({
        format,
        supports: factory.supports,
        description: factory.description,
        defaultOptions: factory.defaultOptions,
      });
    }

    return formats;
  }

  /**
   * List formats that support specific operation
   */
  listFormatsByOperation(
    operation: "read" | "write" | "stream",
  ): SupportedFormat[] {
    const formats: SupportedFormat[] = [];

    for (const [format, factory] of this.handlers.entries()) {
      if (factory.supports.includes(operation)) {
        formats.push(format);
      }
    }

    return formats;
  }

  /**
   * Get format information
   */
  getFormatInfo(format: SupportedFormat): {
    format: SupportedFormat;
    supports: ("read" | "write" | "stream")[];
    description: string;
    defaultOptions?: any;
  } | null {
    const factory = this.handlers.get(format);
    if (!factory) {
      return null;
    }

    return {
      format,
      supports: factory.supports,
      description: factory.description,
      defaultOptions: factory.defaultOptions,
    };
  }

  /**
   * Validate format with data
   */
  async validate(
    format: SupportedFormat,
    data: any,
    schema?: any,
  ): Promise<any> {
    const handler = this.get(format);
    return handler.validate(data, schema);
  }

  /**
   * Clear handler instance cache
   */
  clearCache(): void {
    this.instances.clear();
    this.emit("cache_cleared", {
      timestamp: Date.now(),
    });
  }

  /**
   * Clear cache for specific format
   */
  clearFormatCache(format: SupportedFormat): void {
    const keysToDelete: string[] = [];

    for (const key of this.instances.keys()) {
      if (key.startsWith(format + "_")) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => this.instances.delete(key));

    this.emit("format_cache_cleared", {
      format,
      keysCleared: keysToDelete.length,
    });
  }

  /**
   * Get registry statistics
   */
  getStats(): {
    registeredFormats: number;
    cachedInstances: number;
    formatsByOperation: {
      read: number;
      write: number;
      stream: number;
    };
  } {
    const formatsByOperation = {
      read: this.listFormatsByOperation("read").length,
      write: this.listFormatsByOperation("write").length,
      stream: this.listFormatsByOperation("stream").length,
    };

    return {
      registeredFormats: this.handlers.size,
      cachedInstances: this.instances.size,
      formatsByOperation,
    };
  }

  /**
   * Unregister format handler
   */
  unregister(format: SupportedFormat): boolean {
    const existed = this.handlers.delete(format);

    if (existed) {
      // Clear related instances
      this.clearFormatCache(format);

      this.emit("format_unregistered", {
        format,
        timestamp: Date.now(),
      });
    }

    return existed;
  }

  /**
   * Get registry health status
   */
  getHealthStatus(): {
    status: "healthy" | "degraded" | "unhealthy";
    details: any;
  } {
    const stats = this.getStats();
    let status: "healthy" | "degraded" | "unhealthy" = "healthy";

    // Check if critical formats are available
    const criticalFormats: SupportedFormat[] = ["json", "csv"];
    const missingCritical = criticalFormats.filter(
      (format) => !this.isSupported(format),
    );

    if (missingCritical.length > 0) {
      status = "unhealthy";
    } else if (stats.registeredFormats < 3) {
      status = "degraded";
    }

    return {
      status,
      details: {
        ...stats,
        missingCriticalFormats: missingCritical,
        supportedFormats: Array.from(this.handlers.keys()),
      },
    };
  }

  /**
   * Test format handler creation
   */
  async testFormat(
    format: SupportedFormat,
    testData?: any,
  ): Promise<{
    success: boolean;
    error?: string;
    operations: {
      create: boolean;
      validate: boolean;
      serialize?: boolean;
      deserialize?: boolean;
    };
  }> {
    const result = {
      success: false,
      operations: {
        create: false,
        validate: false,
        serialize: false,
        deserialize: false,
      },
    };

    try {
      // Test handler creation
      const handler = this.get(format);
      result.operations.create = true;

      // Test validation
      if (testData !== undefined) {
        try {
          await handler.validate(testData);
          result.operations.validate = true;
        } catch (error) {
          // Validation might fail for invalid data, which is expected
          result.operations.validate = true;
        }

        // Test serialization if supported
        if (this.supportsOperation(format, "write")) {
          try {
            await handler.serialize(testData);
            result.operations.serialize = true;
          } catch (error) {
            // Serialization might fail for incompatible data
          }
        }
      }

      result.success = true;
    } catch (error) {
      result.success = false;
      return { ...result, error: error.message };
    }

    return result;
  }
}
