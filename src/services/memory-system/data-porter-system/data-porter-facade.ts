/**
 * MARIA Memory System - Phase 4: DataPorter Facade
 *
 * Backward compatibility layer for legacy DataPorter functionality
 * while maintaining access to new enterprise data porter features
 */

import { EventEmitter } from "node:events";
import {
  EnterpriseDataPorter,
  DataPorterConfig,
  ExportRequest,
  ImportRequest,
  PorterResult,
  SupportedFormat,
  DataSource,
  DataDestination,
} from "./enterprise-data-porter";

/**
 * Legacy DataPorter interface for backward compatibility
 */
export interface LegacyDataPorterOptions {
  format?: string;
  encryption?: boolean;
  compression?: boolean;
  validation?: boolean;
  streaming?: boolean;
  batchSize?: number;
  timeout?: number;
}

export interface LegacyExportOptions extends LegacyDataPorterOptions {
  includeMetadata?: boolean;
  includeSchema?: boolean;
  filters?: LegacyDataFilter[];
}

export interface LegacyImportOptions extends LegacyDataPorterOptions {
  mode?: "create" | "update" | "upsert" | "merge";
  skipErrors?: boolean;
  dryRun?: boolean;
  mapping?: LegacyFieldMapping[];
}

export interface LegacyDataFilter {
  field: string;
  operator: string;
  value: any;
}

export interface LegacyFieldMapping {
  from: string;
  to: string;
  transform?: string;
}

export interface LegacyExportResult {
  success: boolean;
  recordCount: number;
  outputPath?: string;
  errors?: string[];
  duration: number;
  size?: number;
}

export interface LegacyImportResult {
  success: boolean;
  totalRecords: number;
  processedRecords: number;
  failedRecords: number;
  errors?: string[];
  duration: number;
}

/**
 * DataPorter Facade - Backward compatibility wrapper
 *
 * Provides legacy API while delegating to EnterpriseDataPorter
 */
export class DataPorterFacade extends EventEmitter {
  private enterpriseDataPorter: EnterpriseDataPorter;
  private requestIdCounter: number = 0;

  constructor(options: LegacyDataPorterOptions = {}) {
    super();

    // Convert legacy options to enterprise config
    const enterpriseConfig = this.convertLegacyOptionsToConfig(options);
    this.enterpriseDataPorter = new EnterpriseDataPorter(enterpriseConfig);

    // Forward enterprise events to legacy events
    this.setupEventForwarding();
  }

  /**
   * Legacy export method
   */
  async exportData(
    source: string | object,
    destination: string,
    options: LegacyExportOptions = {},
  ): Promise<LegacyExportResult> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();

    try {
      // Convert legacy parameters to enterprise format
      const exportRequest = this.convertToExportRequest(
        requestId,
        source,
        destination,
        options,
      );

      // Execute export using enterprise data porter
      const result = await this.enterpriseDataPorter.exportData(exportRequest);

      // Convert enterprise result to legacy format
      return this.convertToLegacyExportResult(result, startTime);
    } catch (error) {
      return {
        success: false,
        recordCount: 0,
        errors: [error.message],
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Legacy import method
   */
  async importData(
    source: string,
    destination: string | object,
    options: LegacyImportOptions = {},
  ): Promise<LegacyImportResult> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();

    try {
      // Convert legacy parameters to enterprise format
      const importRequest = this.convertToImportRequest(
        requestId,
        source,
        destination,
        options,
      );

      // Execute import using enterprise data porter
      const result = await this.enterpriseDataPorter.importData(importRequest);

      // Convert enterprise result to legacy format
      return this.convertToLegacyImportResult(result, startTime);
    } catch (error) {
      return {
        success: false,
        totalRecords: 0,
        processedRecords: 0,
        failedRecords: 0,
        errors: [error.message],
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Legacy status check method
   */
  getJobStatus(jobId: string): any {
    return this.enterpriseDataPorter.getJobStatus(jobId);
  }

  /**
   * Legacy cancel method
   */
  async cancelJob(jobId: string): Promise<boolean> {
    return this.enterpriseDataPorter.cancelJob(jobId);
  }

  /**
   * Get access to enterprise data porter for advanced features
   */
  getEnterpriseDataPorter(): EnterpriseDataPorter {
    return this.enterpriseDataPorter;
  }

  // Private conversion methods

  private convertLegacyOptionsToConfig(
    options: LegacyDataPorterOptions,
  ): DataPorterConfig {
    return {
      formats: this.getSupportedFormats(options.format),
      encryption: {
        enabled: options.encryption || false,
        algorithm: "AES-256-GCM",
        keyDerivation: {
          method: "PBKDF2",
          iterations: 100000,
          saltSize: 32,
          keySize: 32,
        },
        compression: {
          enabled: options.compression || false,
          algorithm: "gzip",
          level: 6,
        },
      },
      validation: {
        schema: {
          enabled: options.validation || false,
          strict: false,
          schemas: [],
          autoDetect: true,
        },
        integrity: {
          enabled: true,
          algorithms: ["sha256"],
          signatureValidation: false,
        },
        quality: {
          enabled: options.validation || false,
          rules: [],
          thresholds: {
            completeness: 0.95,
            uniqueness: 0.98,
            validity: 0.9,
            consistency: 0.92,
          },
        },
      },
      compliance: {
        gdpr: {
          enabled: false,
          rightToErasure: false,
          dataPortability: false,
          consentTracking: false,
          lawfulBasisValidation: false,
        },
        hipaa: {
          enabled: false,
          phiidentification: false,
          minimumNecessary: false,
          auditLogging: false,
          accessControls: false,
        },
        sox: {
          enabled: false,
          financialDataProtection: false,
          auditTrail: false,
          accessLogging: false,
          dataRetention: false,
        },
        custom: [],
      },
      storage: {
        local: {
          enabled: true,
          basePath: "./data",
          compression: options.compression || false,
          encryption: options.encryption || false,
          retention: 30,
        },
        cloud: {
          enabled: false,
          providers: [],
          encryption: false,
          versioning: false,
          retention: 90,
        },
        backup: {
          enabled: false,
          schedule: "0 0 * * 0",
          retention: 365,
          crossRegion: false,
          versioning: false,
        },
      },
      performance: {
        streaming: {
          enabled: options.streaming || false,
          chunkSize: 1024 * 1024, // 1MB
          bufferSize: 10,
          timeout: options.timeout || 30,
        },
        parallel: {
          enabled: true,
          workerCount: 4,
          queueSize: 100,
          batchSize: options.batchSize || 1000,
        },
        memory: {
          maxMemoryUsage: 512 * 1024 * 1024, // 512MB
          spillToDisk: true,
          tempDirectory: "./temp",
        },
        network: {
          timeout: options.timeout || 30,
          retries: 3,
          backoff: {
            initial: 1,
            max: 30,
            multiplier: 2,
          },
        },
      },
    };
  }

  private getSupportedFormats(format?: string): SupportedFormat[] {
    const defaultFormats: SupportedFormat[] = ["json", "csv", "xml", "yaml"];

    if (format) {
      const normalizedFormat = format.toLowerCase() as SupportedFormat;
      if (
        [
          "json",
          "csv",
          "xml",
          "yaml",
          "binary",
          "parquet",
          "avro",
          "encrypted",
        ].includes(normalizedFormat)
      ) {
        return [normalizedFormat];
      }
    }

    return defaultFormats;
  }

  private convertToExportRequest(
    requestId: string,
    source: string | object,
    destination: string,
    options: LegacyExportOptions,
  ): ExportRequest {
    return {
      id: requestId,
      source: this.convertToDataSource(source),
      destination: this.convertToDataDestination(destination),
      format: (options.format as SupportedFormat) || "json",
      options: {
        encryption: options.encryption || false,
        compression: options.compression || false,
        validation: options.validation || false,
        streaming: options.streaming || false,
        parallel: true,
        includeMetadata: options.includeMetadata || false,
        includeSchema: options.includeSchema || false,
      },
      filters: options.filters
        ? this.convertLegacyFilters(options.filters)
        : [],
    };
  }

  private convertToImportRequest(
    requestId: string,
    source: string,
    destination: string | object,
    options: LegacyImportOptions,
  ): ImportRequest {
    return {
      id: requestId,
      source: this.convertToDataSource(source),
      destination: this.convertToDataDestination(destination),
      format: (options.format as SupportedFormat) || "json",
      options: {
        mode: options.mode || "create",
        skipErrors: options.skipErrors || false,
        validateSchema: options.validation || false,
        validateData: options.validation || false,
        dryRun: options.dryRun || false,
        batchSize: options.batchSize || 1000,
      },
      mapping: options.mapping
        ? this.convertLegacyMappings(options.mapping)
        : [],
    };
  }

  private convertToDataSource(source: string | object): DataSource {
    if (typeof source === "string") {
      // Determine source type based on string format
      if (source.startsWith("http://") || source.startsWith("https://")) {
        return {
          type: "api",
          location: source,
        };
      } else if (source.includes("://")) {
        // Database connection string
        return {
          type: "memory_system",
          location: source,
        };
      } else {
        // File path
        return {
          type: "memory_system",
          location: source,
        };
      }
    } else {
      // Object configuration
      return {
        type: "memory_system",
        location: "memory",
        query: {
          filter: JSON.stringify(source),
        },
      };
    }
  }

  private convertToDataDestination(
    destination: string | object,
  ): DataDestination {
    if (typeof destination === "string") {
      if (
        destination.startsWith("http://") ||
        destination.startsWith("https://")
      ) {
        return {
          type: "api",
          location: destination,
        };
      } else if (destination.startsWith("s3://")) {
        return {
          type: "storage",
          location: destination,
        };
      } else {
        return {
          type: "file",
          location: destination,
        };
      }
    } else {
      return {
        type: "stream",
        location: "output",
        options: {
          overwrite: true,
          append: false,
          createPath: true,
        },
      };
    }
  }

  private convertLegacyFilters(filters: LegacyDataFilter[]): any[] {
    return filters.map((filter) => ({
      field: filter.field,
      operator: this.normalizeOperator(filter.operator),
      value: filter.value,
    }));
  }

  private normalizeOperator(operator: string): string {
    const operatorMap: Record<string, string> = {
      "=": "eq",
      "==": "eq",
      "!=": "neq",
      "<>": "neq",
      ">": "gt",
      "<": "lt",
      ">=": "gte",
      "<=": "lte",
      in: "in",
      contains: "contains",
      like: "contains",
      matches: "matches",
    };

    return operatorMap[operator] || operator;
  }

  private convertLegacyMappings(mappings: LegacyFieldMapping[]): any[] {
    return mappings.map((mapping) => ({
      source: mapping.from,
      destination: mapping.to,
      transformation: mapping.transform
        ? {
            type: "custom",
            function: mapping.transform,
          }
        : undefined,
      required: true,
    }));
  }

  private convertToLegacyExportResult(
    result: PorterResult,
    startTime: number,
  ): LegacyExportResult {
    return {
      success: result.success,
      recordCount: result.records.processed,
      errors: result.errors?.map((error) => error.message) || [],
      duration: Date.now() - startTime,
      size: result.performance.diskIO,
    };
  }

  private convertToLegacyImportResult(
    result: PorterResult,
    startTime: number,
  ): LegacyImportResult {
    return {
      success: result.success,
      totalRecords: result.records.total,
      processedRecords: result.records.processed,
      failedRecords: result.records.failed,
      errors: result.errors?.map((error) => error.message) || [],
      duration: Date.now() - startTime,
    };
  }

  private setupEventForwarding(): void {
    // Forward enterprise events to legacy events
    this.enterpriseDataPorter.on("exportStarted", (request) => {
      this.emit("exportStarted", {
        id: request.id,
        source: request.source.location,
        destination: request.destination.location,
        format: request.format,
      });
    });

    this.enterpriseDataPorter.on("exportCompleted", (request, result) => {
      this.emit("exportCompleted", {
        id: request.id,
        success: result.success,
        recordCount: result.records.processed,
      });
    });

    this.enterpriseDataPorter.on("exportFailed", (request, error) => {
      this.emit("exportFailed", {
        id: request.id,
        error: error.message,
      });
    });

    this.enterpriseDataPorter.on("importStarted", (request) => {
      this.emit("importStarted", {
        id: request.id,
        source: request.source.location,
        destination: request.destination.location,
        format: request.format,
      });
    });

    this.enterpriseDataPorter.on("importCompleted", (request, result) => {
      this.emit("importCompleted", {
        id: request.id,
        success: result.success,
        recordCount: result.records.processed,
      });
    });

    this.enterpriseDataPorter.on("importFailed", (request, error) => {
      this.emit("importFailed", {
        id: request.id,
        error: error.message,
      });
    });
  }

  private generateRequestId(): string {
    return `legacy_${++this.requestIdCounter}_${Date.now()}`;
  }
}

/**
 * Legacy factory function for backward compatibility
 */
export function createDataPorter(
  options: LegacyDataPorterOptions = {},
): DataPorterFacade {
  return new DataPorterFacade(options);
}

/**
 * Legacy static methods for one-off operations
 */
export class DataPorterUtils {
  /**
   * Quick export utility
   */
  static async quickExport(
    source: any,
    destination: string,
    format: string = "json",
    options: LegacyExportOptions = {},
  ): Promise<LegacyExportResult> {
    const porter = new DataPorterFacade({ format, ...options });
    return porter.exportData(source, destination, options);
  }

  /**
   * Quick import utility
   */
  static async quickImport(
    source: string,
    destination: any,
    format: string = "json",
    options: LegacyImportOptions = {},
  ): Promise<LegacyImportResult> {
    const porter = new DataPorterFacade({ format, ...options });
    return porter.importData(source, destination, options);
  }

  /**
   * Format validation utility
   */
  static validateFormat(format: string): boolean {
    const supportedFormats = [
      "json",
      "csv",
      "xml",
      "yaml",
      "binary",
      "parquet",
      "avro",
      "encrypted",
    ];
    return supportedFormats.includes(format.toLowerCase());
  }

  /**
   * Size estimation utility
   */
  static estimateSize(data: any, format: string = "json"): number {
    let serialized: string;

    switch (format.toLowerCase()) {
      case "json":
        serialized = JSON.stringify(data);
        break;
      case "csv":
        // Rough CSV estimation
        if (Array.isArray(data) && data.length > 0) {
          const headers = Object.keys(data[0]).join(",");
          const avgRowLength =
            data
              .slice(0, Math.min(10, data.length))
              .map((row) => Object.values(row).join(",").length)
              .reduce((sum, len) => sum + len, 0) / Math.min(10, data.length);
          serialized =
            headers + "\n" + "x".repeat(Math.floor(avgRowLength * data.length));
        } else {
          serialized = JSON.stringify(data);
        }
        break;
      default:
        serialized = JSON.stringify(data);
    }

    return Buffer.byteLength(serialized, "utf8");
  }

  /**
   * Performance profiler
   */
  static createProfiler() {
    const startTime = Date.now();
    const startMemory = process.memoryUsage();

    return {
      stop: () => {
        const endTime = Date.now();
        const endMemory = process.memoryUsage();

        return {
          duration: endTime - startTime,
          memoryDelta: {
            heapUsed: endMemory.heapUsed - startMemory.heapUsed,
            heapTotal: endMemory.heapTotal - startMemory.heapTotal,
            rss: endMemory.rss - startMemory.rss,
          },
        };
      },
    };
  }
}

export default DataPorterFacade;
