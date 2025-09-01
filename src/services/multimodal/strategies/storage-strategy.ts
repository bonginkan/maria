import { EventEmitter } from "node:events";
import { promises as fs } from "fs";
import { join } from "path";

export interface StorageRecord {
  id: string;
  operation: string;
  provider: string;
  modelId: string;
  input: unknown;
  output: unknown;
  metadata: {
    timestamp: Date;
    executionTime: number;
    success: boolean;
    confidenceScore?: number;
    version: string;
  };
}

export interface StorageQuery {
  operation?: string;
  provider?: string;
  modelId?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  success?: boolean;
  limit?: number;
  offset?: number;
}

export interface StorageMetrics {
  totalRecords: number;
  storageSize: number; // bytes
  avgExecutionTime: number;
  successRate: number;
  topOperations: Array<{ operation: string; count: number }>;
  topProviders: Array<{ provider: string; count: number }>;
}

export interface MigrationTask {
  version: string;
  description: string;
  execute: (context: StorageContext) => Promise<void>;
}

export interface StorageContext {
  basePath: string;
  currentVersion: string;
  targetVersion: string;
}

export interface StorageStrategyOptions {
  basePath: string;
  maxRecordsPerFile: number;
  retentionDays: number;
  compressionEnabled: boolean;
  backupEnabled: boolean;
  migrationEnabled: boolean;
}

export class StorageStrategy extends EventEmitter {
  private readonly _options: StorageStrategyOptions;
  private readonly _currentVersion = "1.0.0";
  private readonly _migrations: Map<string, MigrationTask[]> = new Map();
  private _initialized = false;

  constructor(options: Partial<StorageStrategyOptions> = {}) {
    super();

    this._options = {
      basePath: join(process.cwd(), ".maria", "multimodal-storage"),
      maxRecordsPerFile: 1000,
      retentionDays: 30,
      compressionEnabled: true,
      backupEnabled: true,
      migrationEnabled: true,
      ...options,
    };

    this._setupMigrations();
  }

  async initialize(): Promise<void> {
    if (this._initialized) return;

    try {
      // Ensure directory structure exists
      await this._ensureDirectoryStructure();

      // Run migrations if enabled
      if (this._options.migrationEnabled) {
        await this._runMigrations();
      }

      // Start cleanup scheduler
      this._scheduleCleanup();

      this._initialized = true;
      this.emit("initialized", { basePath: this._options.basePath });
    } catch (error) {
      this.emit("initialization_error", error);
      throw error;
    }
  }

  async store(record: Omit<StorageRecord, "id">): Promise<string> {
    if (!this._initialized) {
      await this.initialize();
    }

    const fullRecord: StorageRecord = {
      ...record,
      id: this._generateId(),
      metadata: {
        ...record.metadata,
        version: this._currentVersion,
      },
    };

    try {
      const filePath = await this._getStorageFile(fullRecord);
      await this._appendToFile(filePath, fullRecord);

      this.emit("record_stored", {
        id: fullRecord.id,
        operation: fullRecord.operation,
      });
      return fullRecord.id;
    } catch (error) {
      this.emit("storage_error", { record: fullRecord, error });
      throw error;
    }
  }

  async query(query: StorageQuery): Promise<StorageRecord[]> {
    if (!this._initialized) {
      await this.initialize();
    }

    try {
      const files = await this._getRelevantFiles(query);
      const records: StorageRecord[] = [];

      for (const file of files) {
        const fileRecords = await this._readRecordsFromFile(file);
        const filteredRecords = this._filterRecords(fileRecords, query);
        records.push(...filteredRecords);
      }

      // Apply limit and offset
      const offset = query.offset || 0;
      const limit = query.limit || records.length;
      const result = records.slice(offset, offset + limit);

      this.emit("query_executed", { query, resultCount: result.length });
      return result;
    } catch (error) {
      this.emit("query_error", { query, error });
      throw error;
    }
  }

  async getMetrics(): Promise<StorageMetrics> {
    if (!this._initialized) {
      await this.initialize();
    }

    try {
      const allRecords = await this.query({});
      const totalRecords = allRecords.length;

      // Calculate storage size
      const storageSize = await this._calculateStorageSize();

      // Calculate average execution time
      const executionTimes = allRecords.map((r) => r.metadata.executionTime);
      const avgExecutionTime =
        executionTimes.reduce((sum, time) => sum + time, 0) /
          executionTimes.length || 0;

      // Calculate success rate
      const successfulRecords = allRecords.filter((r) => r.metadata.success);
      const successRate =
        totalRecords > 0 ? successfulRecords.length / totalRecords : 0;

      // Get top operations
      const operationCounts = new Map<string, number>();
      allRecords.forEach((record) => {
        const count = operationCounts.get(record.operation) || 0;
        operationCounts.set(record.operation, count + 1);
      });

      const topOperations = Array.from(operationCounts.entries())
        .map(([operation, count]) => ({ operation, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Get top providers
      const providerCounts = new Map<string, number>();
      allRecords.forEach((record) => {
        const count = providerCounts.get(record.provider) || 0;
        providerCounts.set(record.provider, count + 1);
      });

      const topProviders = Array.from(providerCounts.entries())
        .map(([provider, count]) => ({ provider, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      const metrics: StorageMetrics = {
        totalRecords,
        storageSize,
        avgExecutionTime,
        successRate,
        topOperations,
        topProviders,
      };

      this.emit("metrics_calculated", metrics);
      return metrics;
    } catch (error) {
      this.emit("metrics_error", error);
      throw error;
    }
  }

  async cleanup(): Promise<{ deletedRecords: number; freedSpace: number }> {
    if (!this._initialized) {
      await this.initialize();
    }

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this._options.retentionDays);

      const allRecords = await this.query({});
      const recordsToDelete = allRecords.filter(
        (record) => record.metadata.timestamp < cutoffDate,
      );

      let deletedRecords = 0;
      let freedSpace = 0;

      for (const record of recordsToDelete) {
        const recordSize = JSON.stringify(record).length;
        // Implementation would remove record from file
        deletedRecords++;
        freedSpace += recordSize;
      }

      this.emit("cleanup_completed", { deletedRecords, freedSpace });
      return { deletedRecords, freedSpace };
    } catch (error) {
      this.emit("cleanup_error", error);
      throw error;
    }
  }

  async backup(): Promise<string> {
    if (!this._initialized) {
      await this.initialize();
    }

    if (!this._options.backupEnabled) {
      throw new Error("Backup is disabled in storage configuration");
    }

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const backupPath = join(
        this._options.basePath,
        "backups",
        `backup-${timestamp}`,
      );

      // Create backup directory
      await fs.mkdir(backupPath, { recursive: true });

      // Copy all data files
      const dataPath = join(this._options.basePath, "data");
      const files = await fs.readdir(dataPath, { withFileTypes: true });

      for (const file of files) {
        if (file.isFile() && file.name.endsWith(".json")) {
          const sourcePath = join(dataPath, file.name);
          const targetPath = join(backupPath, file.name);
          await fs.copyFile(sourcePath, targetPath);
        }
      }

      this.emit("backup_created", { backupPath });
      return backupPath;
    } catch (error) {
      this.emit("backup_error", error);
      throw error;
    }
  }

  private async _ensureDirectoryStructure(): Promise<void> {
    const directories = [
      this._options.basePath,
      join(this._options.basePath, "data"),
      join(this._options.basePath, "backups"),
      join(this._options.basePath, "migrations"),
    ];

    for (const dir of directories) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  private async _runMigrations(): Promise<void> {
    const context: StorageContext = {
      basePath: this._options.basePath,
      currentVersion: await this._getCurrentVersion(),
      targetVersion: this._currentVersion,
    };

    if (context.currentVersion === context.targetVersion) {
      return; // No migration needed
    }

    const migrations = this._migrations.get(context.targetVersion) || [];

    for (const migration of migrations) {
      try {
        await migration.execute(context);
        this.emit("migration_completed", {
          version: migration.version,
          description: migration.description,
        });
      } catch (error) {
        this.emit("migration_error", {
          migration: migration.version,
          error,
        });
        throw error;
      }
    }

    // Update version file
    await this._updateVersion(context.targetVersion);
  }

  private async _getCurrentVersion(): Promise<string> {
    try {
      const versionFile = join(this._options.basePath, "version.json");
      const content = await fs.readFile(versionFile, "utf8");
      const version = JSON.parse(content);
      return version.current || "0.0.0";
    } catch {
      return "0.0.0"; // Default for new installations
    }
  }

  private async _updateVersion(version: string): Promise<void> {
    const versionFile = join(this._options.basePath, "version.json");
    const versionData = {
      current: version,
      updated: new Date().toISOString(),
    };
    await fs.writeFile(versionFile, JSON.stringify(versionData, null, 2));
  }

  private _setupMigrations(): void {
    // Migration from 0.0.0 to 1.0.0
    this._migrations.set("1.0.0", [
      {
        version: "1.0.0",
        description: "Initial storage structure setup",
        execute: async (context: StorageContext) => {
          // Initial setup - already handled in initialize
        },
      },
    ]);
  }

  private async _getStorageFile(record: StorageRecord): Promise<string> {
    const dateStr = record.metadata.timestamp.toISOString().split("T")[0];
    const fileName = `${dateStr}-${record.operation}.json`;
    return join(this._options.basePath, "data", fileName);
  }

  private async _appendToFile(
    filePath: string,
    record: StorageRecord,
  ): Promise<void> {
    const recordLine = JSON.stringify(record) + "\n";
    await fs.appendFile(filePath, recordLine, "utf8");
  }

  private async _getRelevantFiles(query: StorageQuery): Promise<string[]> {
    const dataPath = join(this._options.basePath, "data");

    try {
      const files = await fs.readdir(dataPath);
      return files
        .filter((file) => file.endsWith(".json"))
        .map((file) => join(dataPath, file))
        .filter((file) => this._isFileRelevant(file, query));
    } catch {
      return [];
    }
  }

  private _isFileRelevant(filePath: string, query: StorageQuery): boolean {
    const fileName = filePath.split("/").pop() || "";

    // Filter by operation if specified
    if (query.operation && !fileName.includes(query.operation)) {
      return false;
    }

    // Filter by date range if specified
    if (query.dateRange) {
      const dateMatch = fileName.match(/^(\d{4}-\d{2}-\d{2})/);
      if (dateMatch) {
        const fileDate = new Date(dateMatch[1]);
        if (
          fileDate < query.dateRange.start ||
          fileDate > query.dateRange.end
        ) {
          return false;
        }
      }
    }

    return true;
  }

  private async _readRecordsFromFile(
    filePath: string,
  ): Promise<StorageRecord[]> {
    try {
      const content = await fs.readFile(filePath, "utf8");
      const lines = content
        .trim()
        .split("\n")
        .filter((line) => line.trim());
      return lines.map((line) => JSON.parse(line));
    } catch {
      return [];
    }
  }

  private _filterRecords(
    records: StorageRecord[],
    query: StorageQuery,
  ): StorageRecord[] {
    return records.filter((record) => {
      if (query.provider && record.provider !== query.provider) return false;
      if (query.modelId && record.modelId !== query.modelId) return false;
      if (
        query.success !== undefined &&
        record.metadata.success !== query.success
      )
        return false;

      if (query.dateRange) {
        const timestamp = record.metadata.timestamp;
        if (
          timestamp < query.dateRange.start ||
          timestamp > query.dateRange.end
        ) {
          return false;
        }
      }

      return true;
    });
  }

  private async _calculateStorageSize(): Promise<number> {
    const dataPath = join(this._options.basePath, "data");

    try {
      const files = await fs.readdir(dataPath);
      let totalSize = 0;

      for (const file of files) {
        const filePath = join(dataPath, file);
        const stats = await fs.stat(filePath);
        totalSize += stats.size;
      }

      return totalSize;
    } catch {
      return 0;
    }
  }

  private _generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private _scheduleCleanup(): void {
    // Run cleanup every 24 hours
    setInterval(
      () => {
        this.cleanup().catch((error) => {
          this.emit("scheduled_cleanup_error", error);
        });
      },
      24 * 60 * 60 * 1000,
    );
  }
}
