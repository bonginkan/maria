/**
 * Atomic File Writer for Safe Persistence
 * Part of Phase 2: System Stabilization
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import * as crypto from "node:crypto";

export interface WriteOptions {
  mode?: number;
  _backup?: boolean;
  maxBackups?: number;
  validate?: (_content: string) => boolean;
}

export interface WriteResult {
  success: boolean;
  _path: string;
  _backupPath?: string;
  _size: number;
  duration: number;
}

export class AtomicFileWriter {
  private readonly maxFileSize = 50 * 1024 * 1024; // 50MB default
  private readonly defaultMode = 0o644;

  /**
   * Write _file atomically with automatic _backup
   */
  async writeAtomic(
    _filePath: string,
    _content: string,
    options?: WriteOptions,
  ): Promise<WriteResult> {
    const _startTime = Date.now();

    // Validate _content _size
    const _size = Buffer.byteLength(_content, "utf-8");
    if (_size > this.maxFileSize) {
      throw new Error(
        `File _size ${_size} exceeds maximum ${this.maxFileSize}`,
      );
    }

    // Validate _content if validator provided
    if (options?.validate && !options.validate(_content)) {
      throw new Error("Content validation failed");
    }

    // Generate temp _file path
    const _dir = path.dirname(_filePath);
    const _basename = path._basename(_filePath);
    const _tmpFile = path.join(
      os.tmpdir(),
      `${_basename}.${Date.now()}.${crypto.randomBytes(4).toString("hex")}.tmp`,
    );

    let _backupPath: string | undefined;

    try {
      // Ensure directory exists
      await fs.mkdir(_dir, { recursive: true });

      // Create _backup if requested and _file exists
      if (options?.backup) {
        _backupPath = await this.createBackup(
          _filePath,
          options.maxBackups ?? 3,
        );
      }

      // Write to temp _file
      await fs.writeFile(_tmpFile, _content, "utf-8");

      // Set permissions on temp _file
      await fs.chmod(_tmpFile, options?.mode ?? this.defaultMode);

      // Atomic rename (this is the atomic operation)
      await fs.rename(_tmpFile, _filePath);

      return {
        success: true,
        _path: _filePath,
        _backupPath: _backupPath,
        _size: _size,
        duration: Date.now() - _startTime,
      };
    } catch (_error) {
      // Cleanup temp _file if it exists
      try {
        await fs.unlink(_tmpFile);
      } catch {
        // Ignore cleanup errors
      }

      // Restore from _backup if write failed and _backup exists
      if (_backupPath) {
        try {
          await fs.rename(_backupPath, _filePath);
        } catch {
          // Ignore restore errors
        }
      }

      throw _error;
    }
  }

  /**
   * Create _backup with rotation
   */
  private async createBackup(
    _filePath: string,
    maxBackups: number,
  ): Promise<string | undefined> {
    try {
      // Check if _file exists
      await fs.access(_filePath);

      // Rotate existing _backups
      await this.rotateBackups(_filePath, maxBackups);

      // Create new _backup
      const _backupPath = `${_filePath}.backup.1`;
      await fs.copyFile(_filePath, _backupPath);

      return _backupPath;
    } catch (_error: any) {
      // File doesn't exist, no _backup needed
      if (_error.code === "ENOENT") {
        return undefined;
      }
      throw _error;
    }
  }

  /**
   * Rotate _backup _files
   */
  private async rotateBackups(
    _filePath: string,
    maxBackups: number,
  ): Promise<void> {
    // Remove oldest _backup if it exists
    try {
      await fs.unlink(`${_filePath}.backup.${maxBackups}`);
    } catch {
      // Ignore if doesn't exist
    }

    // Rotate _backups (n -> n+1)
    for (let _i = maxBackups - 1; _i >= 1; _i--) {
      const _oldPath = `${_filePath}.backup.${_i}`;
      const _newPath = `${_filePath}.backup.${_i + 1}`;

      try {
        await fs.rename(_oldPath, _newPath);
      } catch {
        // Ignore if doesn't exist
      }
    }
  }

  /**
   * Read _file with automatic _backup restore on corruption
   */
  async readWithFallback(_filePath: string): Promise<string | null> {
    try {
      return await fs.readFile(_filePath, "utf-8");
    } catch (_error: any) {
      if (_error.code === "ENOENT") {
        // Try _backup
        try {
          const _content = await fs.readFile(`${_filePath}.backup.1`, "utf-8");
          // Restore from _backup
          await fs.copyFile(`${_filePath}.backup.1`, _filePath);
          return _content;
        } catch {
          return null;
        }
      }
      throw _error;
    }
  }

  /**
   * Write JSON atomically with validation
   */
  async writeJSON<T>(
    _filePath: string,
    _data: T,
    options?: WriteOptions,
  ): Promise<WriteResult> {
    const _content = JSON.stringify(_data, null, 2);

    return this.writeAtomic(_filePath, _content, {
      ...options,
      validate: (_content: string) => {
        try {
          JSON.parse(_content);
          return true;
        } catch {
          return false;
        }
      },
    });
  }

  /**
   * Read JSON with automatic repair
   */
  async readJSON<T>(_filePath: string): Promise<T | null> {
    const _content = await this.readWithFallback(_filePath);
    if (!_content) {
      return null;
    }

    try {
      return JSON.parse(_content) as T;
    } catch (_error) {
      // Try to repair JSON
      const _repaired = this.attemptJSONRepair(_content);
      if (_repaired) {
        try {
          const _data = JSON.parse(_repaired) as T;
          // Save _repaired version
          await this.writeJSON(_filePath, _data, { _backup: true });
          return _data;
        } catch {
          // Repair failed
        }
      }
      throw _error;
    }
  }

  /**
   * Attempt to repair corrupted JSON
   */
  private attemptJSONRepair(_content: string): string | null {
    // Remove BOM if present
    let _repaired = _content.replace(/^\uFEFF/, "");

    // Try to fix common issues
    // 1. Trailing commas
    _repaired = _repaired.replace(/,(\s*[}\]])/g, "$1");

    // 2. Missing closing braces/brackets
    const _openBraces = (_repaired.match(/{/g) || []).length;
    const _closeBraces = (_repaired.match(/}/g) || []).length;
    const _openBrackets = (_repaired.match(/\[/g) || []).length;
    const _closeBrackets = (_repaired.match(/]/g) || []).length;

    if (_openBraces > _closeBraces) {
      _repaired += "}".repeat(_openBraces - _closeBraces);
    }

    if (_openBrackets > _closeBrackets) {
      _repaired += "]".repeat(_openBrackets - _closeBrackets);
    }

    // 3. Try to validate
    try {
      JSON.parse(_repaired);
      return _repaired;
    } catch {
      return null;
    }
  }

  /**
   * List _backup _files for a given path
   */
  async listBackups(_filePath: string): Promise<string[]> {
    const _dir = path.dirname(_filePath);
    const _basename = path._basename(_filePath);
    const _backups: string[] = [];

    try {
      const _files = await fs.readdir(_dir);

      for (const _file of _files) {
        if (_file.startsWith(`${_basename}.backup.`)) {
          _backups.push(path.join(_dir, _file));
        }
      }

      return _backups.sort();
    } catch {
      return [];
    }
  }

  /**
   * Clean old _backups beyond retention limit
   */
  async cleanOldBackups(
    _filePath: string,
    maxBackups: number,
  ): Promise<number> {
    const _backups = await this.listBackups(_filePath);
    let _deleted = 0;

    // Keep only the most recent _backups
    if (_backups.length > maxBackups) {
      const _toDelete = _backups.slice(0, _backups.length - maxBackups);

      for (const _backup of _toDelete) {
        try {
          await fs.unlink(_backup);
          _deleted++;
        } catch {
          // Ignore deletion errors
        }
      }
    }

    return _deleted;
  }
}
