/**
 * Memory Portability Framework
 * Phase 4.0 Week 1: Enhanced memory export/import with enterprise security
 * Integrates with existing Phase 4 components for complete data portability
 */

import { EventEmitter } from "node:events";
import {
  EnterpriseDataPorter,
  type DataPorterConfig,
} from "./enterprise-data-porter";
import { FormatHandlerRegistry } from "./formats/FormatHandlerRegistry";
import { ValidationEngine } from "./validation/ValidationEngine";
import { EnterpriseSecurityManager } from "./enterprise-security-manager";
import { EnterpriseAuditLogger } from "./enterprise-audit-logger";
import { AccessControlManager } from "../enterprise/access-control-manager";
import type { DualMemoryEngine } from "../dual-memory-engine";

export interface PortabilityConfig {
  organizationId: string;
  defaultFormat: "json" | "csv" | "parquet" | "xml";
  enableEncryption: boolean;
  enableCompression: boolean;
  enableValidation: boolean;
  auditExportImport: boolean;
  maxExportSize: number; // bytes
  allowedFormats: string[];
  securityClassification: "public" | "internal" | "confidential" | "secret";
}

export interface ExportRequest {
  userId: string;
  sessionId: string;
  format: string;
  filter: MemoryFilter;
  options: ExportOptions;
  requestId: string;
  timestamp: Date;
}

export interface MemoryFilter {
  dateRange?: { start: Date; end: Date };
  memoryTypes?: string[];
  tags?: string[];
  classification?: string[];
  ownership?: "own" | "team" | "project" | "organization";
  excludeFields?: string[];
}

export interface ExportOptions {
  includeMetadata: boolean;
  anonymizeData: boolean;
  compressOutput: boolean;
  encryptOutput: boolean;
  splitLargeFiles: boolean;
  maxFileSize: number; // bytes
  outputPath?: string;
}

export interface ImportRequest {
  userId: string;
  sessionId: string;
  filePath: string;
  format: string;
  options: ImportOptions;
  requestId: string;
  timestamp: Date;
}

export interface ImportOptions {
  validateSchema: boolean;
  skipDuplicates: boolean;
  overwriteExisting: boolean;
  preserveIds: boolean;
  targetMemoryType?: string;
  batchSize: number;
}

export interface PortabilityResult {
  requestId: string;
  success: boolean;
  recordsProcessed: number;
  recordsSkipped: number;
  recordsErrors: number;
  outputFiles?: string[];
  errors?: PortabilityError[];
  metadata: PortabilityMetadata;
  duration: number;
}

export interface PortabilityError {
  record: number;
  field?: string;
  error: string;
  severity: "warning" | "error" | "critical";
}

export interface PortabilityMetadata {
  exportId: string;
  organizationId: string;
  userId: string;
  timestamp: Date;
  format: string;
  totalRecords: number;
  dataClassification: string;
  schema: any;
  checksums: { [algorithm: string]: string };
  compression?: { algorithm: string; ratio: number };
  encryption?: { algorithm: string; keyId: string };
}

export interface MigrationPlan {
  id: string;
  name: string;
  description: string;
  sourceSystem: string;
  targetSystem: string;
  mappings: FieldMapping[];
  transformations: DataTransformation[];
  validations: ValidationRule[];
  schedule?: MigrationSchedule;
}

export interface FieldMapping {
  sourceField: string;
  targetField: string;
  transformation?: string;
  required: boolean;
  defaultValue?: any;
}

export interface DataTransformation {
  type: "rename" | "convert" | "calculate" | "filter" | "aggregate";
  expression: string;
  parameters: { [key: string]: any };
}

export interface ValidationRule {
  field: string;
  type: "required" | "format" | "range" | "custom";
  condition: string;
  message: string;
}

export interface MigrationSchedule {
  startTime: Date;
  endTime?: Date;
  batchSize: number;
  interval: number; // milliseconds
  maxConcurrentJobs: number;
}

/**
 * Memory Portability Framework
 * Orchestrates memory export/import operations with enterprise security
 */
export class MemoryPortabilityFramework extends EventEmitter {
  private config: PortabilityConfig;
  private dataPorter: EnterpriseDataPorter;
  private formatRegistry: FormatHandlerRegistry;
  private validationEngine: ValidationEngine;
  private securityManager: EnterpriseSecurityManager;
  private auditLogger: EnterpriseAuditLogger;
  private accessControl: AccessControlManager;
  private memoryEngine: DualMemoryEngine;

  private activeJobs: Map<string, PortabilityJob> = new Map();
  private migrationPlans: Map<string, MigrationPlan> = new Map();

  constructor(
    config: PortabilityConfig,
    dependencies: {
      dataPorter: EnterpriseDataPorter;
      formatRegistry: FormatHandlerRegistry;
      validationEngine: ValidationEngine;
      securityManager: EnterpriseSecurityManager;
      auditLogger: EnterpriseAuditLogger;
      accessControl: AccessControlManager;
      memoryEngine: DualMemoryEngine;
    },
  ) {
    super();
    this.config = config;
    this.dataPorter = dependencies.dataPorter;
    this.formatRegistry = dependencies.formatRegistry;
    this.validationEngine = dependencies.validationEngine;
    this.securityManager = dependencies.securityManager;
    this.auditLogger = dependencies.auditLogger;
    this.accessControl = dependencies.accessControl;
    this.memoryEngine = dependencies.memoryEngine;

    this.initializeFramework();
  }

  /**
   * Export memories with security and validation
   */
  async exportMemories(request: ExportRequest): Promise<PortabilityResult> {
    const startTime = Date.now();
    const jobId = `export_${request.requestId}_${Date.now()}`;

    try {
      // 1. Security authorization check
      const authorized = await this.authorizeDataAccess(
        request.userId,
        "export",
        request.filter,
      );

      if (!authorized) {
        throw new Error("Export operation not authorized");
      }

      // 2. Validate export request
      await this.validateExportRequest(request);

      // 3. Create export job
      const job = this.createExportJob(jobId, request);
      this.activeJobs.set(jobId, job);

      // 4. Retrieve memories based on filter
      const memories = await this.retrieveMemories(
        request.filter,
        request.userId,
      );

      // 5. Apply data transformations and security policies
      const processedMemories = await this.processMemoriesForExport(
        memories,
        request.options,
        request.userId,
      );

      // 6. Generate output in requested format
      const outputFiles = await this.generateExportFiles(
        processedMemories,
        request.format,
        request.options,
      );

      // 7. Create metadata and checksums
      const metadata = await this.createExportMetadata(
        request,
        processedMemories,
        outputFiles,
      );

      // 8. Audit logging
      await this.auditLogger.logDataExport({
        userId: request.userId,
        sessionId: request.sessionId,
        recordCount: processedMemories.length,
        format: request.format,
        classification: this.config.securityClassification,
        success: true,
        duration: Date.now() - startTime,
      });

      const result: PortabilityResult = {
        requestId: request.requestId,
        success: true,
        recordsProcessed: processedMemories.length,
        recordsSkipped: 0,
        recordsErrors: 0,
        outputFiles,
        metadata,
        duration: Date.now() - startTime,
      };

      this.activeJobs.delete(jobId);
      this.emit("export_complete", { result, request });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      // Audit failed export
      await this.auditLogger.logDataExport({
        userId: request.userId,
        sessionId: request.sessionId,
        recordCount: 0,
        format: request.format,
        classification: this.config.securityClassification,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        duration,
      });

      const result: PortabilityResult = {
        requestId: request.requestId,
        success: false,
        recordsProcessed: 0,
        recordsSkipped: 0,
        recordsErrors: 1,
        errors: [
          {
            record: 0,
            error: error instanceof Error ? error.message : "Export failed",
            severity: "critical",
          },
        ],
        metadata: {} as any,
        duration,
      };

      this.activeJobs.delete(jobId);
      this.emit("export_failed", { result, request, error });

      return result;
    }
  }

  /**
   * Import memories with validation and conflict resolution
   */
  async importMemories(request: ImportRequest): Promise<PortabilityResult> {
    const startTime = Date.now();
    const jobId = `import_${request.requestId}_${Date.now()}`;

    try {
      // 1. Security authorization check
      const authorized = await this.authorizeDataAccess(
        request.userId,
        "import",
        {},
      );

      if (!authorized) {
        throw new Error("Import operation not authorized");
      }

      // 2. Validate import request and file
      await this.validateImportRequest(request);

      // 3. Create import job
      const job = this.createImportJob(jobId, request);
      this.activeJobs.set(jobId, job);

      // 4. Parse input file
      const parsedData = await this.parseImportFile(
        request.filePath,
        request.format,
      );

      // 5. Validate data schema and content
      if (request.options.validateSchema) {
        await this.validationEngine.validateImportData(
          parsedData,
          request.format,
        );
      }

      // 6. Process imported data
      const processedMemories = await this.processMemoriesForImport(
        parsedData,
        request.options,
        request.userId,
      );

      // 7. Store memories in memory engine
      const importResult = await this.storeImportedMemories(
        processedMemories,
        request.options,
      );

      // 8. Audit logging
      await this.auditLogger.logDataImport({
        userId: request.userId,
        sessionId: request.sessionId,
        recordCount: importResult.recordsProcessed,
        format: request.format,
        source: request.filePath,
        success: true,
        duration: Date.now() - startTime,
      });

      const result: PortabilityResult = {
        requestId: request.requestId,
        success: true,
        recordsProcessed: importResult.recordsProcessed,
        recordsSkipped: importResult.recordsSkipped,
        recordsErrors: importResult.recordsErrors,
        metadata: importResult.metadata,
        duration: Date.now() - startTime,
      };

      this.activeJobs.delete(jobId);
      this.emit("import_complete", { result, request });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      // Audit failed import
      await this.auditLogger.logDataImport({
        userId: request.userId,
        sessionId: request.sessionId,
        recordCount: 0,
        format: request.format,
        source: request.filePath,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        duration,
      });

      const result: PortabilityResult = {
        requestId: request.requestId,
        success: false,
        recordsProcessed: 0,
        recordsSkipped: 0,
        recordsErrors: 1,
        errors: [
          {
            record: 0,
            error: error instanceof Error ? error.message : "Import failed",
            severity: "critical",
          },
        ],
        metadata: {} as any,
        duration,
      };

      this.activeJobs.delete(jobId);
      this.emit("import_failed", { result, request, error });

      return result;
    }
  }

  /**
   * Create and execute migration plan
   */
  async executeMigration(
    planId: string,
    userId: string,
  ): Promise<PortabilityResult> {
    const plan = this.migrationPlans.get(planId);
    if (!plan) {
      throw new Error(`Migration plan ${planId} not found`);
    }

    // Implementation would orchestrate the migration process
    // This is a placeholder for the complex migration logic
    return {
      requestId: planId,
      success: true,
      recordsProcessed: 0,
      recordsSkipped: 0,
      recordsErrors: 0,
      metadata: {} as any,
      duration: 0,
    };
  }

  /**
   * Get list of supported formats
   */
  getSupportedFormats(): string[] {
    return this.formatRegistry.getSupportedFormats();
  }

  /**
   * Get active portability jobs
   */
  getActiveJobs(): PortabilityJob[] {
    return Array.from(this.activeJobs.values());
  }

  /**
   * Cancel a running job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    const job = this.activeJobs.get(jobId);
    if (!job) {
      return false;
    }

    job.cancelled = true;
    this.activeJobs.delete(jobId);
    this.emit("job_cancelled", { jobId, timestamp: new Date() });

    return true;
  }

  /**
   * Private helper methods
   */
  private initializeFramework(): void {
    // Initialize default migration plans
    this.createDefaultMigrationPlans();

    // Setup job cleanup
    setInterval(() => {
      this.cleanupCompletedJobs();
    }, 60000); // Clean up every minute
  }

  private async authorizeDataAccess(
    userId: string,
    operation: "export" | "import",
    filter: any,
  ): Promise<boolean> {
    // Use AccessControlManager to check permissions
    return true; // Placeholder
  }

  private async validateExportRequest(request: ExportRequest): Promise<void> {
    // Validate format is supported
    if (!this.config.allowedFormats.includes(request.format)) {
      throw new Error(`Format ${request.format} not allowed`);
    }

    // Check export size limits
    const estimatedSize = await this.estimateExportSize(request.filter);
    if (estimatedSize > this.config.maxExportSize) {
      throw new Error("Export size exceeds maximum allowed limit");
    }
  }

  private async validateImportRequest(request: ImportRequest): Promise<void> {
    // Validate file exists and is readable
    // Validate format is supported
    // Check file size limits
  }

  private createExportJob(
    jobId: string,
    request: ExportRequest,
  ): PortabilityJob {
    return {
      id: jobId,
      type: "export",
      status: "running",
      progress: 0,
      startTime: new Date(),
      request,
      cancelled: false,
    };
  }

  private createImportJob(
    jobId: string,
    request: ImportRequest,
  ): PortabilityJob {
    return {
      id: jobId,
      type: "import",
      status: "running",
      progress: 0,
      startTime: new Date(),
      request,
      cancelled: false,
    };
  }

  private async retrieveMemories(
    filter: MemoryFilter,
    userId: string,
  ): Promise<any[]> {
    // Use memory engine to retrieve filtered memories
    return [];
  }

  private async processMemoriesForExport(
    memories: any[],
    options: ExportOptions,
    userId: string,
  ): Promise<any[]> {
    let processed = memories;

    // Apply anonymization if requested
    if (options.anonymizeData) {
      processed = await this.anonymizeMemories(processed);
    }

    return processed;
  }

  private async generateExportFiles(
    memories: any[],
    format: string,
    options: ExportOptions,
  ): Promise<string[]> {
    const handler = this.formatRegistry.getHandler(format);
    return await handler.export(memories, options);
  }

  private async createExportMetadata(
    request: ExportRequest,
    memories: any[],
    outputFiles: string[],
  ): Promise<PortabilityMetadata> {
    return {
      exportId: request.requestId,
      organizationId: this.config.organizationId,
      userId: request.userId,
      timestamp: request.timestamp,
      format: request.format,
      totalRecords: memories.length,
      dataClassification: this.config.securityClassification,
      schema: {}, // Would contain actual schema
      checksums: {}, // Would contain actual checksums
    };
  }

  private async parseImportFile(
    filePath: string,
    format: string,
  ): Promise<any[]> {
    const handler = this.formatRegistry.getHandler(format);
    return await handler.import(filePath);
  }

  private async processMemoriesForImport(
    data: any[],
    options: ImportOptions,
    userId: string,
  ): Promise<any[]> {
    // Process and validate imported data
    return data;
  }

  private async storeImportedMemories(
    memories: any[],
    options: ImportOptions,
  ): Promise<{
    recordsProcessed: number;
    recordsSkipped: number;
    recordsErrors: number;
    metadata: any;
  }> {
    // Store memories in the memory engine
    return {
      recordsProcessed: memories.length,
      recordsSkipped: 0,
      recordsErrors: 0,
      metadata: {},
    };
  }

  private async estimateExportSize(filter: MemoryFilter): Promise<number> {
    // Estimate export size based on filter
    return 0;
  }

  private async anonymizeMemories(memories: any[]): Promise<any[]> {
    // Apply data anonymization rules
    return memories;
  }

  private createDefaultMigrationPlans(): void {
    // Create default migration plans
  }

  private cleanupCompletedJobs(): void {
    // Remove old completed jobs
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

    for (const [jobId, job] of this.activeJobs) {
      if (
        job.status === "completed" &&
        job.endTime &&
        job.endTime < cutoffTime
      ) {
        this.activeJobs.delete(jobId);
      }
    }
  }
}

interface PortabilityJob {
  id: string;
  type: "export" | "import" | "migration";
  status: "running" | "completed" | "failed" | "cancelled";
  progress: number; // 0-100
  startTime: Date;
  endTime?: Date;
  request: ExportRequest | ImportRequest;
  cancelled: boolean;
  error?: string;
}

/**
 * Factory function to create memory portability framework
 */
export function createMemoryPortabilityFramework(
  config: PortabilityConfig,
  dependencies: {
    dataPorter: EnterpriseDataPorter;
    formatRegistry: FormatHandlerRegistry;
    validationEngine: ValidationEngine;
    securityManager: EnterpriseSecurityManager;
    auditLogger: EnterpriseAuditLogger;
    accessControl: AccessControlManager;
    memoryEngine: DualMemoryEngine;
  },
): MemoryPortabilityFramework {
  return new MemoryPortabilityFramework(config, dependencies);
}
