/**
 * Validation Engine
 *
 * Core validation orchestrator for data quality, schema, and integrity checks
 */

import { EventEmitter } from "node:events";
import {
  ValidationConfig,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  QualityRule,
  QualityResult,
  QualityIssue,
} from "../types/porter-types";
import { SchemaValidator } from "./SchemaValidator";
import { IntegrityValidator } from "./IntegrityValidator";
import { QualityValidator } from "./QualityValidator";

export interface ValidationContext {
  requestId: string;
  userId: string;
  correlationId: string;
  timestamp: number;
  metadata: Record<string, any>;
}

export interface ValidationSummary {
  overall: ValidationResult;
  schema?: ValidationResult;
  integrity?: ValidationResult;
  quality?: QualityResult;
  context: ValidationContext;
  executionTime: number;
  validatedRecords: number;
}

export class ValidationEngine extends EventEmitter {
  private readonly config: ValidationConfig;
  private readonly schemaValidator: SchemaValidator;
  private readonly integrityValidator: IntegrityValidator;
  private readonly qualityValidator: QualityValidator;

  constructor(config: ValidationConfig) {
    super();
    this.config = config;
    this.schemaValidator = new SchemaValidator(config.schema);
    this.integrityValidator = new IntegrityValidator(config.integrity);
    this.qualityValidator = new QualityValidator(config.quality);

    // Forward events from sub-validators
    this.setupEventForwarding();
  }

  /**
   * Comprehensive validation of data
   */
  async validate(
    data: any,
    context: ValidationContext,
    options: {
      skipSchema?: boolean;
      skipIntegrity?: boolean;
      skipQuality?: boolean;
      failFast?: boolean;
      maxErrors?: number;
    } = {},
  ): Promise<ValidationSummary> {
    const startTime = Date.now();

    try {
      const summary: ValidationSummary = {
        overall: { valid: true, errors: [], warnings: [] },
        context,
        executionTime: 0,
        validatedRecords: Array.isArray(data) ? data.length : 1,
      };

      this.emit("validation_started", {
        context,
        dataType: Array.isArray(data) ? "array" : typeof data,
        recordCount: summary.validatedRecords,
      });

      // Schema Validation
      if (!options.skipSchema && this.config.schema.enabled) {
        try {
          summary.schema = await this.schemaValidator.validate(data, context);
          this.mergeResults(summary.overall, summary.schema);

          this.emit("schema_validation_complete", {
            context,
            result: summary.schema,
          });

          if (options.failFast && !summary.schema.valid) {
            summary.executionTime = Date.now() - startTime;
            return summary;
          }
        } catch (error) {
          summary.overall.errors.push({
            path: "schema",
            message: `Schema validation failed: ${error.message}`,
            value: "[Error in schema validation]",
          });
        }
      }

      // Integrity Validation
      if (!options.skipIntegrity && this.config.integrity.enabled) {
        try {
          summary.integrity = await this.integrityValidator.validate(
            data,
            context,
          );
          this.mergeResults(summary.overall, summary.integrity);

          this.emit("integrity_validation_complete", {
            context,
            result: summary.integrity,
          });

          if (options.failFast && !summary.integrity.valid) {
            summary.executionTime = Date.now() - startTime;
            return summary;
          }
        } catch (error) {
          summary.overall.errors.push({
            path: "integrity",
            message: `Integrity validation failed: ${error.message}`,
            value: "[Error in integrity validation]",
          });
        }
      }

      // Quality Validation
      if (!options.skipQuality && this.config.quality.enabled) {
        try {
          summary.quality = await this.qualityValidator.validate(data, context);

          // Convert quality issues to warnings
          if (summary.quality.issues.length > 0) {
            const qualityWarnings: ValidationWarning[] =
              summary.quality.issues.map((issue) => ({
                path: issue.field,
                message: `Quality issue: ${issue.type} - ${issue.count} occurrences (${issue.percentage.toFixed(2)}%)`,
                value: issue.examples[0],
                suggestion: this.getQualitySuggestion(issue),
              }));

            summary.overall.warnings.push(...qualityWarnings);
          }

          this.emit("quality_validation_complete", {
            context,
            result: summary.quality,
          });
        } catch (error) {
          summary.overall.warnings.push({
            path: "quality",
            message: `Quality validation encountered issues: ${error.message}`,
            suggestion: "Review data quality configuration",
          });
        }
      }

      // Apply error limits
      if (
        options.maxErrors &&
        summary.overall.errors.length > options.maxErrors
      ) {
        const truncatedErrors = summary.overall.errors.slice(
          0,
          options.maxErrors,
        );
        summary.overall.errors = truncatedErrors;
        summary.overall.warnings.push({
          path: "validation",
          message: `Error limit reached. Showing first ${options.maxErrors} errors only.`,
          suggestion: "Fix critical errors and re-run validation",
        });
      }

      summary.overall.valid = summary.overall.errors.length === 0;
      summary.executionTime = Date.now() - startTime;

      this.emit("validation_complete", {
        context,
        summary,
        success: summary.overall.valid,
      });

      return summary;
    } catch (error) {
      const executionTime = Date.now() - startTime;

      this.emit("validation_error", {
        context,
        error: error.message,
        executionTime,
      });

      throw new Error(`Validation engine failed: ${error.message}`);
    }
  }

  /**
   * Validate single record
   */
  async validateRecord(
    record: any,
    recordIndex: number,
    context: ValidationContext,
  ): Promise<ValidationResult> {
    try {
      const recordContext = {
        ...context,
        metadata: {
          ...context.metadata,
          recordIndex,
          recordId: record.id || `record_${recordIndex}`,
        },
      };

      const result = await this.validate(record, recordContext, {
        failFast: false,
      });

      return result.overall;
    } catch (error) {
      return {
        valid: false,
        errors: [
          {
            path: `record[${recordIndex}]`,
            message: `Record validation failed: ${error.message}`,
            value: record,
          },
        ],
        warnings: [],
      };
    }
  }

  /**
   * Batch validation for large datasets
   */
  async *validateBatch(
    data: any[],
    context: ValidationContext,
    batchSize: number = 100,
  ): AsyncIterable<{
    batchIndex: number;
    records: ValidationResult[];
    summary: {
      validRecords: number;
      invalidRecords: number;
      totalWarnings: number;
    };
  }> {
    if (!Array.isArray(data)) {
      throw new Error("Batch validation requires array input");
    }

    const totalBatches = Math.ceil(data.length / batchSize);

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const start = batchIndex * batchSize;
      const end = Math.min(start + batchSize, data.length);
      const batch = data.slice(start, end);

      const records: ValidationResult[] = [];
      let validRecords = 0;
      let invalidRecords = 0;
      let totalWarnings = 0;

      for (let i = 0; i < batch.length; i++) {
        const recordIndex = start + i;
        const result = await this.validateRecord(
          batch[i],
          recordIndex,
          context,
        );

        records.push(result);

        if (result.valid) {
          validRecords++;
        } else {
          invalidRecords++;
        }

        totalWarnings += result.warnings.length;
      }

      const batchResult = {
        batchIndex,
        records,
        summary: {
          validRecords,
          invalidRecords,
          totalWarnings,
        },
      };

      this.emit("batch_validated", {
        context,
        batchIndex,
        batchSize: batch.length,
        totalBatches,
        summary: batchResult.summary,
      });

      yield batchResult;
    }
  }

  /**
   * Create validation context
   */
  createContext(
    requestId: string,
    userId: string,
    correlationId?: string,
    metadata: Record<string, any> = {},
  ): ValidationContext {
    return {
      requestId,
      userId,
      correlationId:
        correlationId ||
        `val_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      metadata,
    };
  }

  /**
   * Update validation configuration
   */
  updateConfig(newConfig: Partial<ValidationConfig>): void {
    Object.assign(this.config, newConfig);

    // Update sub-validators
    if (newConfig.schema) {
      this.schemaValidator.updateConfig(newConfig.schema);
    }
    if (newConfig.integrity) {
      this.integrityValidator.updateConfig(newConfig.integrity);
    }
    if (newConfig.quality) {
      this.qualityValidator.updateConfig(newConfig.quality);
    }

    this.emit("config_updated", {
      timestamp: Date.now(),
      config: this.config,
    });
  }

  /**
   * Get validation statistics
   */
  getStats(): {
    totalValidations: number;
    successRate: number;
    averageExecutionTime: number;
    commonErrors: Array<{ error: string; count: number }>;
    qualityScores: {
      average: number;
      recent: number[];
    };
  } {
    // This would be implemented with internal metrics collection
    return {
      totalValidations: 0,
      successRate: 0,
      averageExecutionTime: 0,
      commonErrors: [],
      qualityScores: {
        average: 0,
        recent: [],
      },
    };
  }

  /**
   * Test validation engine
   */
  async test(testData?: any): Promise<{
    success: boolean;
    error?: string;
    results?: ValidationSummary;
  }> {
    try {
      const context = this.createContext("test", "system", "validation-test");

      const data = testData || {
        testField: "test value",
        timestamp: Date.now(),
        metadata: { test: true },
      };

      const results = await this.validate(data, context);

      return {
        success: true,
        results,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get validation engine health status
   */
  getHealthStatus(): {
    status: "healthy" | "degraded" | "unhealthy";
    details: any;
  } {
    const schemaHealth = this.schemaValidator.getHealthStatus();
    const integrityHealth = this.integrityValidator.getHealthStatus();
    const qualityHealth = this.qualityValidator.getHealthStatus();

    const unhealthyComponents = [
      schemaHealth,
      integrityHealth,
      qualityHealth,
    ].filter((health) => health.status === "unhealthy").length;

    const degradedComponents = [
      schemaHealth,
      integrityHealth,
      qualityHealth,
    ].filter((health) => health.status === "degraded").length;

    let status: "healthy" | "degraded" | "unhealthy" = "healthy";

    if (unhealthyComponents > 0) {
      status = "unhealthy";
    } else if (degradedComponents > 1) {
      status = "unhealthy";
    } else if (degradedComponents > 0) {
      status = "degraded";
    }

    return {
      status,
      details: {
        config: this.config,
        components: {
          schema: schemaHealth,
          integrity: integrityHealth,
          quality: qualityHealth,
        },
        stats: this.getStats(),
      },
    };
  }

  /**
   * Setup event forwarding from sub-validators
   */
  private setupEventForwarding(): void {
    // Forward schema validator events
    this.schemaValidator.on("error", (event) => {
      this.emit("schema_error", event);
    });

    // Forward integrity validator events
    this.integrityValidator.on("error", (event) => {
      this.emit("integrity_error", event);
    });

    // Forward quality validator events
    this.qualityValidator.on("error", (event) => {
      this.emit("quality_error", event);
    });
  }

  /**
   * Merge validation results
   */
  private mergeResults(
    target: ValidationResult,
    source: ValidationResult,
  ): void {
    target.errors.push(...source.errors);
    target.warnings.push(...source.warnings);
    target.valid = target.valid && source.valid;
  }

  /**
   * Get quality suggestion based on issue type
   */
  private getQualitySuggestion(issue: QualityIssue): string {
    switch (issue.type) {
      case "completeness":
        return "Consider providing default values or making field optional";
      case "uniqueness":
        return "Review data source for duplicate entries";
      case "validity":
        return "Validate data format and constraints at source";
      case "consistency":
        return "Standardize data formats and values across records";
      default:
        return "Review data quality rules and requirements";
    }
  }
}
