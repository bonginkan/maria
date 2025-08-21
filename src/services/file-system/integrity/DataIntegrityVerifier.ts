/**
 * Data Integrity Verifier - File System Integrity Verification and Validation
 * Ensures data integrity through checksums, verification, and corruption detection
 * Phase 2: Terminal Integration & Safety - Week 8
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import chalk from 'chalk';
import { operationLogger } from '../logging/OperationLogger';

export interface IntegrityRecord {
  filePath: string;
  checksum: string;
  algorithm: 'md5' | 'sha1' | 'sha256' | 'sha512';
  size: number;
  lastModified: Date;
  permissions: string;
  verified: boolean;
  verifiedAt?: Date;
  corruption?: {
    detected: boolean;
    type: 'checksum_mismatch' | 'size_mismatch' | 'permission_change' | 'missing_file';
    details: string;
  };
}

export interface VerificationResult {
  success: boolean;
  filePath: string;
  expectedChecksum: string;
  actualChecksum?: string;
  corruptionDetected: boolean;
  corruptionType?: IntegrityRecord['corruption']['type'];
  duration: number;
  message?: string;
  error?: string;
}

export interface IntegrityReport {
  totalFiles: number;
  verifiedFiles: number;
  corruptedFiles: number;
  missingFiles: number;
  modifiedFiles: number;
  verificationTime: number;
  integrityScore: number; // 0-100
  recommendations: string[];
}

export interface VerificationOptions {
  algorithm: IntegrityRecord['algorithm'];
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
      console.debug('Data integrity verifier initialized');
      return true;
    } catch (error) {
      console.error('Failed to initialize integrity verifier:', error);
      return false;
    }
  }

  /**
   * Create integrity record for file
   */
  async createIntegrityRecord(
    filePath: string,
    options: Partial<VerificationOptions> = {},
  ): Promise<IntegrityRecord> {
    const resolvedPath = path.resolve(filePath);
    const opts = { ...this.options, ...options };

    const stats = await fs.promises.stat(resolvedPath);

    if (!stats.isFile()) {
      throw new Error(`Not a file: ${resolvedPath}`);
    }

    if (opts.skipLargeFiles && stats.size > opts.maxFileSize) {
      throw new Error(
        `File too large: ${this.formatSize(stats.size)} > ${this.formatSize(opts.maxFileSize)}`,
      );
    }

    const checksum = await this.calculateChecksum(resolvedPath, opts.algorithm);

    const record: IntegrityRecord = {
      filePath: resolvedPath,
      checksum,
      algorithm: opts.algorithm,
      size: stats.size,
      lastModified: stats.mtime,
      permissions: (stats.mode & 0o777).toString(8),
      verified: true,
      verifiedAt: new Date(),
    };

    this.integrityDatabase.set(resolvedPath, record);
    await this.saveIntegrityDatabase();

    await this.logIntegrityEvent('record_created', {
      filePath: resolvedPath,
      algorithm: opts.algorithm,
      size: stats.size,
    });

    return record;
  }

  /**
   * Verify file integrity
   */
  async verifyFile(filePath: string): Promise<VerificationResult> {
    const startTime = performance.now();
    const resolvedPath = path.resolve(filePath);

    try {
      const record = this.integrityDatabase.get(resolvedPath);
      if (!record) {
        return {
          success: false,
          filePath: resolvedPath,
          expectedChecksum: '',
          corruptionDetected: false,
          duration: performance.now() - startTime,
          error: 'No integrity record found for file',
        };
      }

      // Check if file exists
      if (!(await this.exists(resolvedPath))) {
        record.corruption = {
          detected: true,
          type: 'missing_file',
          details: 'File no longer exists',
        };
        record.verified = false;

        return {
          success: false,
          filePath: resolvedPath,
          expectedChecksum: record.checksum,
          corruptionDetected: true,
          corruptionType: 'missing_file',
          duration: performance.now() - startTime,
          message: 'File is missing',
        };
      }

      // Verify file attributes
      const stats = await fs.promises.stat(resolvedPath);

      // Check size
      if (stats.size !== record.size) {
        record.corruption = {
          detected: true,
          type: 'size_mismatch',
          details: `Expected: ${record.size}, Actual: ${stats.size}`,
        };
        record.verified = false;

        return {
          success: false,
          filePath: resolvedPath,
          expectedChecksum: record.checksum,
          corruptionDetected: true,
          corruptionType: 'size_mismatch',
          duration: performance.now() - startTime,
          message: `Size mismatch: expected ${record.size}, got ${stats.size}`,
        };
      }

      // Check permissions if enabled
      if (this.options.includePermissions) {
        const currentPermissions = (stats.mode & 0o777).toString(8);
        if (currentPermissions !== record.permissions) {
          record.corruption = {
            detected: true,
            type: 'permission_change',
            details: `Expected: ${record.permissions}, Actual: ${currentPermissions}`,
          };
          // Don't fail verification for permission changes, just note them
        }
      }

      // Calculate current checksum
      const currentChecksum = await this.calculateChecksum(resolvedPath, record.algorithm);

      if (currentChecksum !== record.checksum) {
        record.corruption = {
          detected: true,
          type: 'checksum_mismatch',
          details: `Expected: ${record.checksum}, Actual: ${currentChecksum}`,
        };
        record.verified = false;

        return {
          success: false,
          filePath: resolvedPath,
          expectedChecksum: record.checksum,
          actualChecksum: currentChecksum,
          corruptionDetected: true,
          corruptionType: 'checksum_mismatch',
          duration: performance.now() - startTime,
          message: 'Checksum verification failed',
        };
      }

      // Verification successful
      record.verified = true;
      record.verifiedAt = new Date();
      record.corruption = undefined;

      await this.saveIntegrityDatabase();

      return {
        success: true,
        filePath: resolvedPath,
        expectedChecksum: record.checksum,
        actualChecksum: currentChecksum,
        corruptionDetected: false,
        duration: performance.now() - startTime,
        message: 'Integrity verification passed',
      };
    } catch (error) {
      return {
        success: false,
        filePath: resolvedPath,
        expectedChecksum: '',
        corruptionDetected: false,
        duration: performance.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Verify multiple files
   */
  async verifyFiles(filePaths: string[]): Promise<VerificationResult[]> {
    const results: VerificationResult[] = [];

    if (this.options.parallelVerification) {
      // Parallel verification
      const verificationPromises = filePaths.map((filePath) => this.verifyFile(filePath));
      const parallelResults = await Promise.allSettled(verificationPromises);

      parallelResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            success: false,
            filePath: filePaths[index],
            expectedChecksum: '',
            corruptionDetected: false,
            duration: 0,
            error: result.reason instanceof Error ? result.reason.message : String(result.reason),
          });
        }
      });
    } else {
      // Sequential verification
      for (const filePath of filePaths) {
        const result = await this.verifyFile(filePath);
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Verify directory integrity
   */
  async verifyDirectory(
    directoryPath: string,
    recursive: boolean = true,
  ): Promise<IntegrityReport> {
    const startTime = performance.now();
    const resolvedPath = path.resolve(directoryPath);

    try {
      // Get all files to verify
      const filesToVerify = await this.getFilesForVerification(resolvedPath, recursive);

      // Verify all files
      const results = await this.verifyFiles(filesToVerify);

      // Generate report
      const report = this.generateIntegrityReport(results, performance.now() - startTime);

      await this.logIntegrityEvent('directory_verified', {
        directoryPath: resolvedPath,
        totalFiles: report.totalFiles,
        corruptedFiles: report.corruptedFiles,
        integrityScore: report.integrityScore,
      });

      return report;
    } catch (error) {
      throw new Error(`Failed to verify directory: ${error}`);
    }
  }

  /**
   * Scan and create integrity records for directory
   */
  async scanDirectory(directoryPath: string, recursive: boolean = true): Promise<number> {
    const resolvedPath = path.resolve(directoryPath);
    let recordsCreated = 0;

    try {
      const files = await this.getAllFiles(resolvedPath, recursive);

      console.log(chalk.blue(`🔍 Scanning ${files.length} files for integrity records...`));

      for (const [index, file] of files.entries()) {
        try {
          await this.createIntegrityRecord(file);
          recordsCreated++;

          if ((index + 1) % 100 === 0) {
            console.log(chalk.gray(`  Progress: ${index + 1}/${files.length} files processed`));
          }
        } catch (error) {
          console.debug(`Failed to create record for ${file}:`, error);
        }
      }

      console.log(chalk.green(`✅ Created ${recordsCreated} integrity records`));

      await this.logIntegrityEvent('directory_scanned', {
        directoryPath: resolvedPath,
        filesScanned: files.length,
        recordsCreated,
      });

      return recordsCreated;
    } catch (error) {
      throw new Error(`Failed to scan directory: ${error}`);
    }
  }

  /**
   * Repair corrupted file
   */
  async repairFile(filePath: string, backupPath?: string): Promise<boolean> {
    const resolvedPath = path.resolve(filePath);
    const record = this.integrityDatabase.get(resolvedPath);

    if (!record || !record.corruption?.detected) {
      return false;
    }

    try {
      if (backupPath && (await this.exists(backupPath))) {
        // Restore from backup
        await fs.promises.copyFile(backupPath, resolvedPath);

        // Verify the repair
        const verifyResult = await this.verifyFile(resolvedPath);
        if (verifyResult.success) {
          await this.logIntegrityEvent('file_repaired', {
            filePath: resolvedPath,
            method: 'backup_restore',
            backupPath,
          });
          return true;
        }
      }

      // If repair failed or no backup available
      await this.logIntegrityEvent('repair_failed', {
        filePath: resolvedPath,
        corruptionType: record.corruption.type,
        hasBackup: Boolean(backupPath),
      });

      return false;
    } catch (error) {
      console.error(`Failed to repair file ${resolvedPath}:`, error);
      return false;
    }
  }

  /**
   * Get integrity statistics
   */
  getIntegrityStats(): {
    totalRecords: number;
    verifiedRecords: number;
    corruptedRecords: number;
    lastVerification: Date | null;
    integrityScore: number;
  } {
    const records = Array.from(this.integrityDatabase.values());
    const verifiedRecords = records.filter((r) => r.verified).length;
    const corruptedRecords = records.filter((r) => r.corruption?.detected).length;

    const verificationDates = records
      .filter((r) => r.verifiedAt)
      .map((r) => r.verifiedAt!)
      .sort((a, b) => b.getTime() - a.getTime());

    const integrityScore =
      records.length > 0 ? ((records.length - corruptedRecords) / records.length) * 100 : 100;

    return {
      totalRecords: records.length,
      verifiedRecords,
      corruptedRecords,
      lastVerification: verificationDates[0] || null,
      integrityScore,
    };
  }

  /**
   * Show integrity status
   */
  showStatus(): void {
    const stats = this.getIntegrityStats();

    console.log(chalk.blue('\n🔒 Data Integrity Status'));
    console.log(`Total records: ${chalk.yellow(stats.totalRecords)}`);
    console.log(`Verified: ${chalk.green(stats.verifiedRecords)}`);
    console.log(`Corrupted: ${chalk.red(stats.corruptedRecords)}`);
    console.log(`Integrity score: ${chalk.yellow(stats.integrityScore.toFixed(1))}%`);

    if (stats.lastVerification) {
      console.log(`Last verification: ${chalk.gray(stats.lastVerification.toLocaleString())}`);
    }

    if (stats.corruptedRecords > 0) {
      console.log(chalk.red('\n⚠️ Corrupted Files:'));
      const corruptedRecords = Array.from(this.integrityDatabase.values()).filter(
        (r) => r.corruption?.detected,
      );

      corruptedRecords.slice(0, 10).forEach((record) => {
        console.log(
          `  ${chalk.red('✗')} ${chalk.yellow(path.basename(record.filePath))} ${chalk.gray(`(${record.corruption?.type})`)}`,
        );
      });

      if (corruptedRecords.length > 10) {
        console.log(`  ${chalk.gray(`... and ${corruptedRecords.length - 10} more`)}`);
      }
    }
  }

  /**
   * Clean up integrity database
   */
  async cleanup(): Promise<void> {
    // Remove records for files that no longer exist
    const recordsToRemove: string[] = [];

    for (const [filePath, record] of this.integrityDatabase) {
      if (!(await this.exists(filePath))) {
        recordsToRemove.push(filePath);
      }
    }

    recordsToRemove.forEach((filePath) => {
      this.integrityDatabase.delete(filePath);
    });

    if (recordsToRemove.length > 0) {
      await this.saveIntegrityDatabase();
      console.log(chalk.green(`✅ Cleaned up ${recordsToRemove.length} stale integrity records`));
    }
  }

  /**
   * Update verification options
   */
  updateOptions(newOptions: Partial<VerificationOptions>): void {
    this.options = { ...this.options, ...newOptions };
    console.log(chalk.green('✅ Integrity verifier options updated'));
  }

  /**
   * Initialize database file path
   */
  private initializeDatabase(): void {
    // Using imported os module
    this.databaseFile = path.join(os.tmpdir(), 'maria-integrity.db');
  }

  /**
   * Get default options
   */
  private getDefaultOptions(): VerificationOptions {
    return {
      algorithm: 'sha256',
      includePermissions: false,
      followSymlinks: false,
      skipLargeFiles: true,
      maxFileSize: 100 * 1024 * 1024, // 100MB
      parallelVerification: true,
      autoRepair: false,
    };
  }

  /**
   * Calculate file checksum
   */
  private async calculateChecksum(filePath: string, algorithm: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash(algorithm);
      const stream = fs.createReadStream(filePath);

      stream.on('data', (data) => {
        hash.update(data);
      });

      stream.on('end', () => {
        resolve(hash.digest('hex'));
      });

      stream.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Get files for verification
   */
  private async getFilesForVerification(
    directoryPath: string,
    recursive: boolean,
  ): Promise<string[]> {
    const files: string[] = [];

    for (const [filePath] of this.integrityDatabase) {
      if (filePath.startsWith(directoryPath)) {
        if (recursive || path.dirname(filePath) === directoryPath) {
          files.push(filePath);
        }
      }
    }

    return files;
  }

  /**
   * Get all files in directory
   */
  private async getAllFiles(directoryPath: string, recursive: boolean): Promise<string[]> {
    const files: string[] = [];

    const processDirectory = async (dir: string): Promise<void> => {
      try {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isFile()) {
            files.push(fullPath);
          } else if (entry.isDirectory() && recursive) {
            await processDirectory(fullPath);
          }
        }
      } catch (error) {
        console.debug(`Skipping directory ${dir}:`, error);
      }
    };

    await processDirectory(directoryPath);
    return files;
  }

  /**
   * Generate integrity report
   */
  private generateIntegrityReport(
    results: VerificationResult[],
    verificationTime: number,
  ): IntegrityReport {
    const totalFiles = results.length;
    const verifiedFiles = results.filter((r) => r.success).length;
    const corruptedFiles = results.filter((r) => r.corruptionDetected).length;
    const missingFiles = results.filter((r) => r.corruptionType === 'missing_file').length;
    const modifiedFiles = results.filter(
      (r) => r.corruptionType === 'checksum_mismatch' || r.corruptionType === 'size_mismatch',
    ).length;

    const integrityScore = totalFiles > 0 ? (verifiedFiles / totalFiles) * 100 : 100;

    const recommendations: string[] = [];

    if (corruptedFiles > 0) {
      recommendations.push(
        `${corruptedFiles} corrupted files detected - consider restoration from backups`,
      );
    }

    if (missingFiles > 0) {
      recommendations.push(
        `${missingFiles} missing files detected - check for accidental deletion`,
      );
    }

    if (modifiedFiles > 0) {
      recommendations.push(
        `${modifiedFiles} modified files detected - verify changes are intentional`,
      );
    }

    if (integrityScore < 95) {
      recommendations.push('Low integrity score - consider running full system scan');
    }

    return {
      totalFiles,
      verifiedFiles,
      corruptedFiles,
      missingFiles,
      modifiedFiles,
      verificationTime,
      integrityScore,
      recommendations,
    };
  }

  /**
   * Load integrity database
   */
  private async loadIntegrityDatabase(): Promise<void> {
    try {
      if (await this.exists(this.databaseFile)) {
        const data = await fs.promises.readFile(this.databaseFile, 'utf8');
        const records = JSON.parse(data);

        this.integrityDatabase.clear();
        for (const record of records) {
          // Convert date strings back to Date objects
          record.lastModified = new Date(record.lastModified);
          if (record.verifiedAt) {
            record.verifiedAt = new Date(record.verifiedAt);
          }
          this.integrityDatabase.set(record.filePath, record);
        }
      }
    } catch (error) {
      console.warn('Failed to load integrity database:', error);
      this.integrityDatabase.clear();
    }
  }

  /**
   * Save integrity database
   */
  private async saveIntegrityDatabase(): Promise<void> {
    try {
      const records = Array.from(this.integrityDatabase.values());
      const data = JSON.stringify(records, null, 2);
      await fs.promises.writeFile(this.databaseFile, data);
    } catch (error) {
      console.warn('Failed to save integrity database:', error);
    }
  }

  /**
   * Log integrity event
   */
  private async logIntegrityEvent(event: string, data: Record<string, unknown>): Promise<void> {
    await operationLogger.logOperation('integrity_verification', 'completed', [], {
      level: 'info',
      context: {
        integrityEvent: event,
        ...data,
      },
    });
  }

  /**
   * Check if file exists
   */
  private async exists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Format file size
   */
  private formatSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }
}

export const dataIntegrityVerifier = DataIntegrityVerifier.getInstance();
