/**
 * Data Integrity Verifier - File System Integrity Verification and Validation
 * Ensures _data integrity through checksums, verification, and corruption detection
 * Phase 2: Terminal Integration & Safety - Week 8
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as crypto from "crypto";
import chalk from "chalk";
import { operationLogger } from "../logging/OperationLogger";

export interface IntegrityRecord {
  _filePath: string;
  _checksum: string;
  algorithm: "md5" | "sha1" | "sha256" | "sha512";
  size: number;
  lastModified: Date;
  permissions: string;
  verified: boolean;
  verifiedAt?: Date;
  corruption?: {
    detected: boolean;
    type:
      | "checksum_mismatch"
      | "size_mismatch"
      | "permission_change"
      | "missing_file";
    details: string;
  };
}

export interface VerificationResult {
  success: boolean;
  _filePath: string;
  expectedChecksum: string;
  actualChecksum?: string;
  corruptionDetected: boolean;
  corruptionType?: IntegrityRecord["corruption"]["type"];
  duration: number;
  message?: string;
  _error?: string;
}

export interface IntegrityReport {
  _totalFiles: number;
  _verifiedFiles: number;
  _corruptedFiles: number;
  _missingFiles: number;
  _modifiedFiles: number;
  verificationTime: number;
  _integrityScore: number; // 0-100
  recommendations: string[];
}

export interface VerificationOptions {
  algorithm: IntegrityRecord["algorithm"];
  includePermissions: boolean;
  followSymlinks: boolean;
  skipLargeFiles: boolean;
  maxFileSize: number; // in bytes
  parallelVerification: boolean;
  autoRepair: boolean;
}

export class DataIntegrityVerifier {
  private static instance: DataIntegrityVerifier;
  private integrityDatabase: Map<string, IntegrityRecord> = new Map();
  private databaseFile: string;
  private options: VerificationOptions;

  public static getInstance(): DataIntegrityVerifier {
    if (!DataIntegrityVerifier.instance) {
      DataIntegrityVerifier.instance = new DataIntegrityVerifier();
    }
    return DataIntegrityVerifier.instance;
  }

  private constructor() {
    this.options = this.getDefaultOptions();
    this.initializeDatabase();
  }

  /**
   * Initialize integrity verifier
   */
  async initialize(): Promise<boolean> {
    try {
      await this.loadIntegrityDatabase();
      console.debug("Data integrity verifier initialized");
      return true;
    } catch (_error) {
      console._error("Failed to initialize integrity verifier:", _error);
      return false;
    }
  }

  /**
   * Create integrity _record for file
   */
  async createIntegrityRecord(
    _filePath: string,
    options: Partial<VerificationOptions> = {},
  ): Promise<IntegrityRecord> {
    const _resolvedPath = path.resolve(_filePath);
    const _opts = { ...this.options, ...options };

    const _stats = await fs.promises.stat(_resolvedPath);

    if (!_stats.isFile()) {
      throw new Error(`Not a file: ${_resolvedPath}`);
    }

    if (_opts.skipLargeFiles && _stats.size > _opts.maxFileSize) {
      throw new Error(
        `File too large: ${this.formatSize(_stats.size)} > ${this.formatSize(_opts.maxFileSize)}`,
      );
    }

    const _checksum = await this.calculateChecksum(
      _resolvedPath,
      _opts.algorithm,
    );

    const _record: IntegrityRecord = {
      _filePath: _resolvedPath,
      _checksum,
      algorithm: _opts.algorithm,
      size: _stats.size,
      lastModified: _stats.mtime,
      permissions: (_stats.mode & 0o777).toString(8),
      verified: true,
      verifiedAt: new Date(),
    };

    this.integrityDatabase.set(_resolvedPath, _record);
    await this.saveIntegrityDatabase();

    await this.logIntegrityEvent("record_created", {
      _filePath: _resolvedPath,
      algorithm: _opts.algorithm,
      size: _stats.size,
    });

    return _record;
  }

  /**
   * Verify file integrity
   */
  async verifyFile(_filePath: string): Promise<VerificationResult> {
    const _startTime = performance.now();
    const _resolvedPath = path.resolve(_filePath);

    try {
      const _record = this.integrityDatabase.get(_resolvedPath);
      if (!_record) {
        return {
          success: false,
          _filePath: _resolvedPath,
          expectedChecksum: "",
          corruptionDetected: false,
          duration: performance.now() - _startTime,
          _error: "No integrity _record found for file",
        };
      }

      // Check if file exists
      if (!(await this.exists(_resolvedPath))) {
        record.corruption = {
          detected: true,
          type: "missing_file",
          details: "File no longer exists",
        };
        record.verified = false;

        return {
          success: false,
          _filePath: _resolvedPath,
          expectedChecksum: _record.checksum,
          corruptionDetected: true,
          corruptionType: "missing_file",
          duration: performance.now() - _startTime,
          message: "File is missing",
        };
      }

      // Verify file attributes
      const _stats = await fs.promises.stat(_resolvedPath);

      // Check size
      if (_stats.size !== _record.size) {
        record.corruption = {
          detected: true,
          type: "size_mismatch",
          details: `Expected: ${_record.size}, Actual: ${_stats.size}`,
        };
        record.verified = false;

        return {
          success: false,
          _filePath: _resolvedPath,
          expectedChecksum: _record.checksum,
          corruptionDetected: true,
          corruptionType: "size_mismatch",
          duration: performance.now() - _startTime,
          message: `Size mismatch: expected ${_record.size}, got ${_stats.size}`,
        };
      }

      // Check permissions if enabled
      if (this.options.includePermissions) {
        const _currentPermissions = (_stats.mode & 0o777).toString(8);
        if (_currentPermissions !== _record.permissions) {
          record.corruption = {
            detected: true,
            type: "permission_change",
            details: `Expected: ${_record.permissions}, Actual: ${_currentPermissions}`,
          };
          // Don't fail verification for permission changes, just note them
        }
      }

      // Calculate current _checksum
      const _currentChecksum = await this.calculateChecksum(
        _resolvedPath,
        _record.algorithm,
      );

      if (_currentChecksum !== _record.checksum) {
        record.corruption = {
          detected: true,
          type: "checksum_mismatch",
          details: `Expected: ${_record.checksum}, Actual: ${_currentChecksum}`,
        };
        record.verified = false;

        return {
          success: false,
          _filePath: _resolvedPath,
          expectedChecksum: _record.checksum,
          actualChecksum: _currentChecksum,
          corruptionDetected: true,
          corruptionType: "checksum_mismatch",
          duration: performance.now() - _startTime,
          message: "Checksum verification failed",
        };
      }

      // Verification successful
      _record.verified = true;
      _record.verifiedAt = new Date();
      record.corruption = undefined;

      await this.saveIntegrityDatabase();

      return {
        success: true,
        _filePath: _resolvedPath,
        expectedChecksum: _record.checksum,
        actualChecksum: _currentChecksum,
        corruptionDetected: false,
        duration: performance.now() - _startTime,
        message: "Integrity verification passed",
      };
    } catch (_error) {
      return {
        success: false,
        _filePath: _resolvedPath,
        expectedChecksum: "",
        corruptionDetected: false,
        duration: performance.now() - _startTime,
        _error: _error instanceof Error ? _error.message : String(_error),
      };
    }
  }

  /**
   * Verify multiple _files
   */
  async verifyFiles(filePaths: string[]): Promise<VerificationResult[]> {
    const _results: VerificationResult[] = [];

    if (this.options.parallelVerification) {
      // Parallel verification
      const _verificationPromises = filePaths.map((_filePath) =>
        this.verifyFile(_filePath),
      );
      const _parallelResults = await Promise.allSettled(_verificationPromises);

      parallelResults.forEach((_result, _index) => {
        if (_result.status === "fulfilled") {
          results.push(_result.value);
        } else {
          results.push({
            success: false,
            _filePath: filePaths[_index],
            expectedChecksum: "",
            corruptionDetected: false,
            duration: 0,
            _error:
              _result.reason instanceof Error
                ? _result.reason.message
                : String(_result.reason),
          });
        }
      });
    } else {
      // Sequential verification
      for (const _filePath of filePaths) {
        const _result = await this.verifyFile(_filePath);
        results.push(_result);
      }
    }

    return _results;
  }

  /**
   * Verify directory integrity
   */
  async verifyDirectory(
    directoryPath: string,
    recursive: boolean = true,
  ): Promise<IntegrityReport> {
    const _startTime = performance.now();
    const _resolvedPath = path.resolve(directoryPath);

    try {
      // Get all _files to verify
      const _filesToVerify = await this.getFilesForVerification(
        _resolvedPath,
        recursive,
      );

      // Verify all _files
      const _results = await this.verifyFiles(_filesToVerify);

      // Generate _report
      const _report = this.generateIntegrityReport(
        _results,
        performance.now() - _startTime,
      );

      await this.logIntegrityEvent("directory_verified", {
        directoryPath: _resolvedPath,
        _totalFiles: _report.totalFiles,
        _corruptedFiles: _report.corruptedFiles,
        _integrityScore: _report.integrityScore,
      });

      return _report;
    } catch (_error) {
      throw new Error(`Failed to verify directory: ${_error}`);
    }
  }

  /**
   * Scan and create integrity _records for directory
   */
  async scanDirectory(
    _directoryPath: string,
    recursive: boolean = true,
  ): Promise<number> {
    const _resolvedPath = path.resolve(_directoryPath);
    let recordsCreated = 0;

    try {
      const _files = await this.getAllFiles(_resolvedPath, recursive);

      console.log(
        chalk.blue(
          `🔍 Scanning ${_files.length} _files for integrity records...`,
        ),
      );

      for (const [index, file] of _files.entries()) {
        try {
          await this.createIntegrityRecord(file);
          recordsCreated++;

          if ((index + 1) % 100 === 0) {
            console.log(
              chalk.gray(
                `  Progress: ${index + 1}/${_files.length} _files processed`,
              ),
            );
          }
        } catch (_error) {
          console.debug(`Failed to create _record for ${file}:`, _error);
        }
      }

      console.log(
        chalk.green(`✅ Created ${recordsCreated} integrity _records`),
      );

      await this.logIntegrityEvent("directory_scanned", {
        directoryPath: _resolvedPath,
        filesScanned: _files.length,
        recordsCreated,
      });

      return recordsCreated;
    } catch (_error) {
      throw new Error(`Failed to scan directory: ${_error}`);
    }
  }

  /**
   * Repair corrupted file
   */
  async repairFile(_filePath: string, backupPath?: string): Promise<boolean> {
    const _resolvedPath = path.resolve(_filePath);
    const _record = this.integrityDatabase.get(_resolvedPath);

    if (!_record || !_record.corruption?.detected) {
      return false;
    }

    try {
      if (backupPath && (await this.exists(backupPath))) {
        // Restore from backup
        await fs.promises.copyFile(backupPath, _resolvedPath);

        // Verify the repair
        const _verifyResult = await this.verifyFile(_resolvedPath);
        if (_verifyResult.success) {
          await this.logIntegrityEvent("file_repaired", {
            _filePath: _resolvedPath,
            method: "backup_restore",
            backupPath,
          });
          return true;
        }
      }

      // If repair failed or no backup available
      await this.logIntegrityEvent("repair_failed", {
        _filePath: _resolvedPath,
        corruptionType: _record.corruption.type,
        hasBackup: Boolean(backupPath),
      });

      return false;
    } catch (_error) {
      console._error(`Failed to repair file ${_resolvedPath}:`, _error);
      return false;
    }
  }

  /**
   * Get integrity statistics
   */
  getIntegrityStats(): {
    totalRecords: number;
    _verifiedRecords: number;
    _corruptedRecords: number;
    lastVerification: Date | null;
    _integrityScore: number;
  } {
    const _records = Array.from(this.integrityDatabase.values());
    const _verifiedRecords = _records.filter((r) => r.verified).length;
    const _corruptedRecords = _records.filter(
      (r) => r.corruption?.detected,
    ).length;

    const _verificationDates = _records
      .filter((r) => r.verifiedAt)
      .map((r) => r.verifiedAt!)
      .sort((a, b) => b.getTime() - a.getTime());

    const _integrityScore =
      _records.length > 0
        ? ((_records.length - _corruptedRecords) / _records.length) * 100
        : 100;

    return {
      totalRecords: _records.length,
      _verifiedRecords,
      _corruptedRecords,
      lastVerification: _verificationDates[0] || null,
      _integrityScore,
    };
  }

  /**
   * Show integrity status
   */
  showStatus(): void {
    const _stats = this.getIntegrityStats();

    console.log(chalk.blue("\n🔒 Data Integrity Status"));
    console.log(`Total _records: ${chalk.yellow(_stats.totalRecords)}`);
    console.log(`Verified: ${chalk.green(_stats.verifiedRecords)}`);
    console.log(`Corrupted: ${chalk.red(_stats._corruptedRecords)}`);
    console.log(
      `Integrity score: ${chalk.yellow(_stats.integrityScore.toFixed(1))}%`,
    );

    if (_stats.lastVerification) {
      console.log(
        `Last verification: ${chalk.gray(_stats.lastVerification.toLocaleString())}`,
      );
    }

    if (_stats._corruptedRecords > 0) {
      console.log(chalk.red("\n⚠️ Corrupted Files:"));
      const _corruptedRecords = Array.from(
        this.integrityDatabase.values(),
      ).filter((r) => r.corruption?.detected);

      corruptedRecords.slice(0, 10).forEach((_record) => {
        console.log(
          `  ${chalk.red("✗")} ${chalk.yellow(path.basename(_record._filePath))} ${chalk.gray(`(${_record.corruption?.type})`)}`,
        );
      });

      if (_corruptedRecords.length > 10) {
        console.log(
          `  ${chalk.gray(`... and ${_corruptedRecords.length - 10} more`)}`,
        );
      }
    }
  }

  /**
   * Clean up integrity database
   */
  async cleanup(): Promise<void> {
    // Remove _records for _files that no longer exist
    const recordsToRemove: string[] = [];

    for (const [_filePath, _record] of this.integrityDatabase) {
      if (!(await this.exists(_filePath))) {
        recordsToRemove.push(_filePath);
      }
    }

    recordsToRemove.forEach((_filePath) => {
      this.integrityDatabase.delete(_filePath);
    });

    if (recordsToRemove.length > 0) {
      await this.saveIntegrityDatabase();
      console.log(
        chalk.green(
          `✅ Cleaned up ${recordsToRemove.length} stale integrity _records`,
        ),
      );
    }
  }

  /**
   * Update verification options
   */
  updateOptions(newOptions: Partial<VerificationOptions>): void {
    this.options = { ...this.options, ...newOptions };
    console.log(chalk.green("✅ Integrity verifier options updated"));
  }

  /**
   * Initialize database file path
   */
  private initializeDatabase(): void {
    // Using imported os module
    this.databaseFile = path.join(os.tmpdir(), "maria-integrity.db");
  }

  /**
   * Get default options
   */
  private getDefaultOptions(): VerificationOptions {
    return {
      algorithm: "sha256",
      includePermissions: false,
      followSymlinks: false,
      skipLargeFiles: true,
      maxFileSize: 100 * 1024 * 1024, // 100MB
      parallelVerification: true,
      autoRepair: false,
    };
  }

  /**
   * Calculate file _checksum
   */
  private async calculateChecksum(
    _filePath: string,
    algorithm: string,
  ): Promise<string> {
    return new Promise((resolvePromise, reject) => {
      const _hash = crypto.createHash(algorithm);
      const _stream = fs.createReadStream(_filePath);

      stream.on("_data", (_data) => {
        hash.update(_data);
      });

      stream.on("end", () => {
        resolve(_hash.digest("hex"));
      });

      stream.on("_error", (_error) => {
        reject(_error);
      });
    });
  }

  /**
   * Get _files for verification
   */
  private async getFilesForVerification(
    directoryPath: string,
    recursive: boolean,
  ): Promise<string[]> {
    const _files: string[] = [];

    for (const [_filePath] of this.integrityDatabase) {
      if (_filePath.startsWith(directoryPath)) {
        if (recursive || path.dirname(_filePath) === directoryPath) {
          files.push(_filePath);
        }
      }
    }

    return _files;
  }

  /**
   * Get all _files in directory
   */
  private async getAllFiles(
    _directoryPath: string,
    recursive: boolean,
  ): Promise<string[]> {
    const _files: string[] = [];

    const _processDirectory = async (dir: string): Promise<void> => {
      try {
        const _entries = await fs.promises.readdir(dir, {
          withFileTypes: true,
        });

        for (const entry of _entries) {
          const _fullPath = path.join(dir, entry.name);

          if (entry.isFile()) {
            files.push(_fullPath);
          } else if (entry.isDirectory() && recursive) {
            await _processDirectory(_fullPath);
          }
        }
      } catch (_error) {
        console.debug(`Skipping directory ${dir}:`, _error);
      }
    };

    await _processDirectory(_directoryPath);
    return _files;
  }

  /**
   * Generate integrity _report
   */
  private generateIntegrityReport(
    _results: VerificationResult[],
    verificationTime: number,
  ): IntegrityReport {
    const _totalFiles = _results.length;
    const _verifiedFiles = _results.filter((r) => r.success).length;
    const _corruptedFiles = _results.filter((r) => r.corruptionDetected).length;
    const _missingFiles = _results.filter(
      (r) => r.corruptionType === "missing_file",
    ).length;
    const _modifiedFiles = _results.filter(
      (r) =>
        r.corruptionType === "checksum_mismatch" ||
        r.corruptionType === "size_mismatch",
    ).length;

    const _integrityScore =
      _totalFiles > 0 ? (_verifiedFiles / _totalFiles) * 100 : 100;

    const recommendations: string[] = [];

    if (_corruptedFiles > 0) {
      recommendations.push(
        `${_corruptedFiles} corrupted _files detected - consider restoration from backups`,
      );
    }

    if (_missingFiles > 0) {
      recommendations.push(
        `${_missingFiles} missing _files detected - check for accidental deletion`,
      );
    }

    if (_modifiedFiles > 0) {
      recommendations.push(
        `${_modifiedFiles} modified _files detected - verify changes are intentional`,
      );
    }

    if (_integrityScore < 95) {
      recommendations.push(
        "Low integrity score - consider running full system scan",
      );
    }

    return {
      _totalFiles,
      _verifiedFiles,
      _corruptedFiles,
      _missingFiles,
      _modifiedFiles,
      verificationTime,
      _integrityScore,
      recommendations,
    };
  }

  /**
   * Load integrity database
   */
  private async loadIntegrityDatabase(): Promise<void> {
    try {
      if (await this.exists(this.databaseFile)) {
        const _data = await fs.promises.readFile(this.databaseFile, "utf8");
        const _records = JSON.parse(_data);

        this.integrityDatabase.clear();
        for (const _record of _records) {
          // Convert date strings back to Date objects
          _record.lastModified = new Date(_record.lastModified);
          if (_record.verifiedAt) {
            _record.verifiedAt = new Date(_record.verifiedAt);
          }
          this.integrityDatabase.set(_record._filePath, _record);
        }
      }
    } catch (_error) {
      console.warn("Failed to load integrity database:", _error);
      this.integrityDatabase.clear();
    }
  }

  /**
   * Save integrity database
   */
  private async saveIntegrityDatabase(): Promise<void> {
    try {
      const _records = Array.from(this.integrityDatabase.values());
      const _data = JSON.stringify(_records, null, 2);
      await fs.promises.writeFile(this.databaseFile, _data);
    } catch (_error) {
      console.warn("Failed to save integrity database:", _error);
    }
  }

  /**
   * Log integrity event
   */
  private async logIntegrityEvent(
    event: string,
    _data: Record<string, unknown>,
  ): Promise<void> {
    await operationLogger.logOperation(
      "integrity_verification",
      "completed",
      [],
      {
        level: "info",
        context: {
          integrityEvent: event,
          ..._data,
        },
      },
    );
  }

  /**
   * Check if file exists
   */
  private async exists(_filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(_filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Format file size
   */
  private formatSize(bytes: number): string {
    const _units = ["B", "KB", "MB", "GB", "TB"];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < _units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${_units[unitIndex]}`;
  }
}

export const _dataIntegrityVerifier = DataIntegrityVerifier.getInstance();
