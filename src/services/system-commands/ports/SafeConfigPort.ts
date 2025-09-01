/**
 * SafeConfigPort - Transaction-based Safe Configuration Management
 *
 * Implements SOW Phase 3.3 v2.1 DRY-RUN safety mechanism:
 * - Physical write prevention
 * - Transaction pattern for rollback safety
 * - Monotonic time tracking
 * - Deep isolation from actual storage
 */

import {
  ConfigPort,
  LayeredConfig,
  ConfigTemplate,
  ConfigHistoryEntry,
  SetOptions,
  TemplateOptions,
  ValidationResult,
} from "./ConfigPort";
import { logger } from "../../../utils/logger";
import crypto from "crypto";

export interface DryRunTransaction {
  readonly id: string;
  readonly startTime: number;
  readonly monotonicStart: number;
  log(operation: ConfigOperation): void;
  getResult(): DryRunResult;
  rollback(): void;
  commit(): DryRunResult;
}

export interface ConfigOperation {
  op: "set" | "delete" | "template" | "migrate" | "rollback";
  key?: string;
  value?: any;
  oldValue?: any;
  layer?: string;
  metadata?: Record<string, any>;
  timestamp: number;
  monotonicMs: number;
}

export interface DryRunResult {
  readonly transactionId: string;
  readonly operations: ReadonlyArray<ConfigOperation>;
  readonly wouldChange: boolean;
  readonly duration: number;
  readonly operationCount: number;
  readonly affectedKeys: ReadonlyArray<string>;
  readonly riskLevel: "low" | "medium" | "high" | "critical";
  readonly warnings: ReadonlyArray<string>;
}

/**
 * Transaction implementation with complete isolation
 */
class DryRunTransactionImpl implements DryRunTransaction {
  readonly id: string;
  readonly startTime: number;
  readonly monotonicStart: number;

  private operations: ConfigOperation[] = [];
  private committed = false;
  private rolledBack = false;

  constructor() {
    this.id = crypto.randomUUID();
    this.startTime = Date.now();
    this.monotonicStart = performance.now();
  }

  log(operation: ConfigOperation): void {
    if (this.committed || this.rolledBack) {
      throw new Error("Cannot log operations on completed transaction");
    }

    // Deep clone to prevent external mutation
    const safeOperation: ConfigOperation = {
      ...structuredClone(operation),
      timestamp: Date.now(),
      monotonicMs: performance.now() - this.monotonicStart,
    };

    this.operations.push(Object.freeze(safeOperation));

    logger.debug(
      `DRY-RUN [${this.id}]: ${operation.op} ${operation.key || "multiple"}`,
      {
        transactionId: this.id,
        operation: operation.op,
        key: operation.key,
        hasValue: operation.value !== undefined,
      },
    );
  }

  getResult(): DryRunResult {
    const affectedKeys = [
      ...new Set(this.operations.map((op) => op.key).filter(Boolean)),
    ];
    const riskLevel = this.assessRiskLevel();
    const warnings = this.generateWarnings();

    return Object.freeze({
      transactionId: this.id,
      operations: Object.freeze([...this.operations]),
      wouldChange: this.operations.length > 0,
      duration: performance.now() - this.monotonicStart,
      operationCount: this.operations.length,
      affectedKeys: Object.freeze(affectedKeys),
      riskLevel,
      warnings: Object.freeze(warnings),
    });
  }

  commit(): DryRunResult {
    if (this.committed || this.rolledBack) {
      throw new Error("Transaction already completed");
    }

    this.committed = true;
    const result = this.getResult();

    logger.info(`DRY-RUN transaction committed: ${this.id}`, {
      transactionId: this.id,
      operationCount: this.operations.length,
      duration: result.duration,
      riskLevel: result.riskLevel,
    });

    return result;
  }

  rollback(): void {
    if (this.committed || this.rolledBack) {
      throw new Error("Transaction already completed");
    }

    this.rolledBack = true;
    logger.info(`DRY-RUN transaction rolled back: ${this.id}`, {
      transactionId: this.id,
      operationCount: this.operations.length,
    });
  }

  private assessRiskLevel(): "low" | "medium" | "high" | "critical" {
    const deleteOps = this.operations.filter((op) => op.op === "delete").length;
    const migrateOps = this.operations.filter(
      (op) => op.op === "migrate",
    ).length;
    const totalOps = this.operations.length;

    if (migrateOps > 0 || deleteOps > 5) return "critical";
    if (deleteOps > 0 || totalOps > 10) return "high";
    if (totalOps > 3) return "medium";
    return "low";
  }

  private generateWarnings(): string[] {
    const warnings: string[] = [];

    const deleteOps = this.operations.filter((op) => op.op === "delete");
    if (deleteOps.length > 0) {
      warnings.push(`${deleteOps.length} configuration(s) will be deleted`);
    }

    const templateOps = this.operations.filter((op) => op.op === "template");
    if (templateOps.length > 0) {
      warnings.push(
        `${templateOps.length} template(s) will override existing values`,
      );
    }

    const migrateOps = this.operations.filter((op) => op.op === "migrate");
    if (migrateOps.length > 0) {
      warnings.push("Configuration migration may break existing functionality");
    }

    return warnings;
  }
}

/**
 * Safe Configuration Port with physical write prevention
 */
export class SafeConfigPort implements ConfigPort {
  private activeTransaction?: DryRunTransaction;
  private readonly physicalWrites = new Set<string>();

  constructor(
    private readonly actualPort: ConfigPort,
    private readonly writeProtection = true,
  ) {}

  /**
   * Begin a DRY-RUN transaction - ALL operations will be logged only
   */
  beginDryRun(): DryRunTransaction {
    if (this.activeTransaction) {
      throw new Error("DRY-RUN transaction already in progress");
    }

    this.activeTransaction = new DryRunTransactionImpl();
    logger.info(`DRY-RUN transaction started: ${this.activeTransaction.id}`);

    return this.activeTransaction;
  }

  /**
   * Commit current DRY-RUN transaction and return results
   */
  commitDryRun(): DryRunResult {
    if (!this.activeTransaction) {
      throw new Error("No DRY-RUN transaction in progress");
    }

    const result = this.activeTransaction.commit();
    this.activeTransaction = undefined;

    return result;
  }

  /**
   * Rollback current DRY-RUN transaction
   */
  rollbackDryRun(): void {
    if (!this.activeTransaction) {
      throw new Error("No DRY-RUN transaction in progress");
    }

    this.activeTransaction.rollback();
    this.activeTransaction = undefined;
  }

  /**
   * Check if currently in DRY-RUN mode
   */
  isDryRun(): boolean {
    return this.activeTransaction !== undefined;
  }

  // ConfigPort Implementation with Transaction Support

  async set(key: string, value: any, options?: SetOptions): Promise<void> {
    if (this.activeTransaction) {
      // DRY-RUN mode: log only, no physical write
      const currentValue = await this.actualPort
        .get(key)
        .catch(() => undefined);

      this.activeTransaction.log({
        op: "set",
        key,
        value,
        oldValue: currentValue,
        layer: options?.layer || "user",
      });

      logger.debug(`DRY-RUN: Would set ${key} = ${JSON.stringify(value)}`);
      return;
    }

    // Normal mode: perform actual write with protection
    if (this.writeProtection) {
      await this.checkWritePermission(key, "set");
    }

    await this.actualPort.set(key, value, options);
    this.physicalWrites.add(`set:${key}`);
  }

  async delete(key: string): Promise<boolean> {
    if (this.activeTransaction) {
      // DRY-RUN mode: log only
      const currentValue = await this.actualPort
        .get(key)
        .catch(() => undefined);

      this.activeTransaction.log({
        op: "delete",
        key,
        oldValue: currentValue,
      });

      logger.debug(`DRY-RUN: Would delete ${key}`);
      return true; // Assume success in dry-run
    }

    // Normal mode: perform actual deletion with protection
    if (this.writeProtection) {
      await this.checkWritePermission(key, "delete");
    }

    const result = await this.actualPort.delete(key);
    if (result) {
      this.physicalWrites.add(`delete:${key}`);
    }

    return result;
  }

  async applyTemplate(
    templateId: string,
    options?: TemplateOptions,
  ): Promise<void> {
    if (this.activeTransaction) {
      // DRY-RUN mode: log template application
      this.activeTransaction.log({
        op: "template",
        key: templateId,
        value: options?.variables,
        metadata: {
          overwrite: options?.overwrite,
          variables: options?.variables,
        },
      });

      logger.debug(`DRY-RUN: Would apply template ${templateId}`);
      return;
    }

    // Normal mode: apply template with protection
    if (this.writeProtection) {
      await this.checkWritePermission(templateId, "template");
    }

    await this.actualPort.applyTemplate(templateId, options);
    this.physicalWrites.add(`template:${templateId}`);
  }

  async migrate(
    fromVersion: string,
    toVersion: string,
    dryRun = false,
  ): Promise<any> {
    if (this.activeTransaction || dryRun) {
      // DRY-RUN mode: log migration
      if (this.activeTransaction) {
        this.activeTransaction.log({
          op: "migrate",
          metadata: { fromVersion, toVersion },
        });
      }

      logger.debug(
        `DRY-RUN: Would migrate from ${fromVersion} to ${toVersion}`,
      );

      // Return dry-run result
      return {
        ok: true,
        changes: [`Migration from ${fromVersion} to ${toVersion}`],
        dryRun: true,
      };
    }

    // Normal mode: perform actual migration with protection
    if (this.writeProtection) {
      await this.checkWritePermission("*", "migrate");
    }

    const result = await this.actualPort.migrate(fromVersion, toVersion, false);
    this.physicalWrites.add(`migrate:${fromVersion}-${toVersion}`);

    return result;
  }

  async rollback(entryId: string): Promise<void> {
    if (this.activeTransaction) {
      // DRY-RUN mode: log rollback
      this.activeTransaction.log({
        op: "rollback",
        key: entryId,
      });

      logger.debug(`DRY-RUN: Would rollback to ${entryId}`);
      return;
    }

    // Normal mode: perform actual rollback with protection
    if (this.writeProtection) {
      await this.checkWritePermission(entryId, "rollback");
    }

    await this.actualPort.rollback(entryId);
    this.physicalWrites.add(`rollback:${entryId}`);
  }

  // Read-only operations (pass through directly)
  async get(key: string): Promise<any> {
    return await this.actualPort.get(key);
  }

  async getLayered(key: string): Promise<LayeredConfig | undefined> {
    return await this.actualPort.getLayered(key);
  }

  async list(prefix?: string): Promise<Record<string, any>> {
    return await this.actualPort.list(prefix);
  }

  async listTemplates(): Promise<ConfigTemplate[]> {
    return await this.actualPort.listTemplates();
  }

  async getHistory(
    key?: string,
    limit?: number,
  ): Promise<ConfigHistoryEntry[]> {
    return await this.actualPort.getHistory(key, limit);
  }

  async validate(config: Record<string, any>): Promise<ValidationResult> {
    return await this.actualPort.validate(config);
  }

  // Write protection mechanism
  private async checkWritePermission(
    key: string,
    operation: string,
  ): Promise<void> {
    // Implement write protection logic
    const protectedKeys = ["system.version", "system.id"];

    if (protectedKeys.includes(key)) {
      throw new Error(`Cannot ${operation} protected configuration: ${key}`);
    }

    // Check for concurrent writes
    const writeKey = `${operation}:${key}`;
    if (this.physicalWrites.has(writeKey)) {
      logger.warn(`Duplicate write attempt detected: ${writeKey}`);
    }
  }

  /**
   * Get statistics about physical writes (for monitoring)
   */
  getWriteStats(): WriteStats {
    return {
      totalWrites: this.physicalWrites.size,
      writes: Array.from(this.physicalWrites),
      isDryRun: this.isDryRun(),
      activeTransactionId: this.activeTransaction?.id,
    };
  }

  /**
   * Reset write tracking (for testing)
   */
  resetWriteTracking(): void {
    this.physicalWrites.clear();
  }
}

export interface WriteStats {
  totalWrites: number;
  writes: string[];
  isDryRun: boolean;
  activeTransactionId?: string;
}

// Export factory function for easy integration
export function createSafeConfigPort(
  actualPort: ConfigPort,
  writeProtection = true,
): SafeConfigPort {
  return new SafeConfigPort(actualPort, writeProtection);
}
