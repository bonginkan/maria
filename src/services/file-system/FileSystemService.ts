import fs from "fs";
import path from "path";
import { promisify } from "util";
import { spawn } from "child_process";
import chalk from "chalk";

const _fsAsync = {
  readFile: promisify(fs.readFile),
  writeFile: promisify(fs.writeFile),
  unlink: promisify(fs.unlink),
  mkdir: promisify(fs.mkdir),
  rmdir: promisify(fs.rmdir),
  readdir: promisify(fs.readdir),
  stat: promisify(fs.stat),
  copyFile: promisify(fs.copyFile),
  rename: promisify(fs.rename),
  access: promisify(fs.access),
  realpath: promisify(fs.realpath),
  symlink: promisify(fs.symlink),
  readlink: promisify(fs.readlink),
  lstat: promisify(fs.lstat),
  chmod: promisify(fs.chmod),
  chown: promisify(fs.chown),
};

export interface FileStats {
  _name: string;
  _path: string;
  isFile: boolean;
  isDirectory: boolean;
  isSymlink: boolean;
  size: number;
  created: Date;
  modified: Date;
  permissions: string;
  owner?: string;
}

export interface FileOperationOptions {
  recursive?: boolean;
  force?: boolean;
  preserveTimestamps?: boolean;
  backup?: boolean;
  dryRun?: boolean;
  followSymlinks?: boolean;
}

export interface SearchOptions {
  _pattern?: string;
  type?: "file" | "directory" | "both";
  maxDepth?: number;
  caseSensitive?: boolean;
  includeHidden?: boolean;
  regex?: boolean;
}

export class FileSystemService {
  private static instance: FileSystemService;
  private operationLog: Array<{
    operation: string;
    _path: string;
    timestamp: Date;
    success: boolean;
  }> = [];

  public static getInstance(): FileSystemService {
    if (!FileSystemService.instance) {
      FileSystemService.instance = new FileSystemService();
    }
    return FileSystemService.instance;
  }

  private constructor() {
    // Constructor implementation
  }

  // Basic File Operations
  async readFile(
    _filePath: string,
    encoding: BufferEncoding = "utf8",
  ): Promise<string | Buffer> {
    try {
      const _resolvedPath = path.resolve(_filePath);
      const _content = await _fsAsync.readFile(_resolvedPath, encoding);
      this.logOperation("read", _resolvedPath, true);
      return _content;
    } catch (_error) {
      this.logOperation("read", _filePath, false);
      throw new Error(`Failed to read file ${_filePath}: ${_error.message}`);
    }
  }

  async writeFile(
    _filePath: string,
    _content: string | Buffer,
    options: FileOperationOptions = {},
  ): Promise<void> {
    try {
      const _resolvedPath = path.resolve(_filePath);

      if (options.backup && (await this.exists(_resolvedPath))) {
        await this.createBackup(_resolvedPath);
      }

      if (options.dryRun) {
        console.log(chalk.yellow(`[DRY RUN] Would write to: ${_resolvedPath}`));
        return;
      }

      await this.ensureDirectoryExists(path.dirname(_resolvedPath));
      await _fsAsync.writeFile(_resolvedPath, _content);

      this.logOperation("write", _resolvedPath, true);
    } catch (_error) {
      this.logOperation("write", _filePath, false);
      throw new Error(`Failed to write file ${_filePath}: ${_error.message}`);
    }
  }

  async deleteFile(
    _filePath: string,
    options: FileOperationOptions = {},
  ): Promise<void> {
    try {
      const _resolvedPath = path.resolve(_filePath);

      if (!(await this.exists(_resolvedPath))) {
        throw new Error(`File does not exist: ${_resolvedPath}`);
      }

      if (options.backup) {
        await this.createBackup(_resolvedPath);
      }

      if (options.dryRun) {
        console.log(chalk.yellow(`[DRY RUN] Would delete: ${_resolvedPath}`));
        return;
      }

      await _fsAsync.unlink(_resolvedPath);
      this.logOperation("delete", _resolvedPath, true);
    } catch (_error) {
      this.logOperation("delete", _filePath, false);
      throw new Error(`Failed to delete file ${_filePath}: ${_error.message}`);
    }
  }

  // Directory Operations
  async createDirectory(
    _dirPath: string,
    options: FileOperationOptions = {},
  ): Promise<void> {
    try {
      const _resolvedPath = path.resolve(_dirPath);

      if (options.dryRun) {
        console.log(
          chalk.yellow(`[DRY RUN] Would create directory: ${_resolvedPath}`),
        );
        return;
      }

      await _fsAsync.mkdir(_resolvedPath, {
        recursive: options.recursive ?? true,
      });
      this.logOperation("mkdir", _resolvedPath, true);
    } catch (_error) {
      this.logOperation("mkdir", _dirPath, false);
      throw new Error(
        `Failed to create directory ${_dirPath}: ${_error.message}`,
      );
    }
  }

  async deleteDirectory(
    _dirPath: string,
    options: FileOperationOptions = {},
  ): Promise<void> {
    try {
      const _resolvedPath = path.resolve(_dirPath);

      if (!(await this.exists(_resolvedPath))) {
        throw new Error(`Directory does not exist: ${_resolvedPath}`);
      }

      if (options.dryRun) {
        console.log(
          chalk.yellow(`[DRY RUN] Would delete directory: ${_resolvedPath}`),
        );
        return;
      }

      if (options.recursive) {
        await this.deleteDirectoryRecursive(_resolvedPath);
      } else {
        await _fsAsync.rmdir(_resolvedPath);
      }

      this.logOperation("rmdir", _resolvedPath, true);
    } catch (_error) {
      this.logOperation("rmdir", _dirPath, false);
      throw new Error(
        `Failed to delete directory ${_dirPath}: ${_error.message}`,
      );
    }
  }

  async listDirectory(
    _dirPath: string,
    options: SearchOptions = {},
  ): Promise<FileStats[]> {
    try {
      const _resolvedPath = path.resolve(_dirPath);
      const _entries = await _fsAsync.readdir(_resolvedPath);
      const results: FileStats[] = [];

      for (const entry of _entries) {
        if (!options.includeHidden && entry.startsWith(".")) {
          continue;
        }

        const _entryPath = path.join(_resolvedPath, entry);
        const _stats = await this.getFileStats(_entryPath);

        if (options.type) {
          if (options.type === "file" && !_stats.isFile) {
            continue;
          }
          if (options.type === "directory" && !_stats.isDirectory) {
            continue;
          }
        }

        if (options.pattern) {
          const _match = options.caseSensitive
            ? _stats.name.includes(options.pattern)
            : _stats.name.toLowerCase().includes(options.pattern.toLowerCase());
          if (!_match) {
            continue;
          }
        }

        results.push(_stats);
      }

      this.logOperation("readdir", _resolvedPath, true);
      return results.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) {
          return -1;
        }
        if (!a.isDirectory && b.isDirectory) {
          return 1;
        }
        return a.name.localeCompare(b.name);
      });
    } catch (_error) {
      this.logOperation("readdir", _dirPath, false);
      throw new Error(
        `Failed to list directory ${_dirPath}: ${_error.message}`,
      );
    }
  }

  // Advanced Operations
  async copyFile(
    sourcePath: string,
    destPath: string,
    options: FileOperationOptions = {},
  ): Promise<void> {
    try {
      const _resolvedSource = path.resolve(sourcePath);
      const _resolvedDest = path.resolve(destPath);

      if (!(await this.exists(_resolvedSource))) {
        throw new Error(`Source file does not exist: ${_resolvedSource}`);
      }

      if (options.dryRun) {
        console.log(
          chalk.yellow(
            `[DRY RUN] Would copy: ${_resolvedSource} → ${_resolvedDest}`,
          ),
        );
        return;
      }

      await this.ensureDirectoryExists(path.dirname(_resolvedDest));

      if ((await this.exists(_resolvedDest)) && !options.force) {
        throw new Error(`Destination file already exists: ${_resolvedDest}`);
      }

      await _fsAsync.copyFile(_resolvedSource, _resolvedDest);

      if (options.preserveTimestamps) {
        const _sourceStats = await _fsAsync.stat(_resolvedSource);
        await fs.promises.utimes(
          _resolvedDest,
          _sourceStats.atime,
          _sourceStats.mtime,
        );
      }

      this.logOperation("copy", `${_resolvedSource} → ${_resolvedDest}`, true);
    } catch (_error) {
      this.logOperation("copy", `${sourcePath} → ${destPath}`, false);
      throw new Error(`Failed to copy file: ${_error.message}`);
    }
  }

  async moveFile(
    sourcePath: string,
    destPath: string,
    options: FileOperationOptions = {},
  ): Promise<void> {
    try {
      const _resolvedSource = path.resolve(sourcePath);
      const _resolvedDest = path.resolve(destPath);

      if (!(await this.exists(_resolvedSource))) {
        throw new Error(`Source file does not exist: ${_resolvedSource}`);
      }

      if (options.dryRun) {
        console.log(
          chalk.yellow(
            `[DRY RUN] Would move: ${_resolvedSource} → ${_resolvedDest}`,
          ),
        );
        return;
      }

      await this.ensureDirectoryExists(path.dirname(_resolvedDest));

      if ((await this.exists(_resolvedDest)) && !options.force) {
        throw new Error(`Destination file already exists: ${_resolvedDest}`);
      }

      await _fsAsync.rename(_resolvedSource, _resolvedDest);
      this.logOperation("move", `${_resolvedSource} → ${_resolvedDest}`, true);
    } catch (_error) {
      this.logOperation("move", `${sourcePath} → ${destPath}`, false);
      throw new Error(`Failed to move file: ${_error.message}`);
    }
  }

  async renameFile(
    oldPath: string,
    newPath: string,
    options: FileOperationOptions = {},
  ): Promise<void> {
    return this.moveFile(oldPath, newPath, options);
  }

  // Search and Navigation
  async findFiles(
    _searchPath: string,
    options: SearchOptions = {},
  ): Promise<FileStats[]> {
    try {
      const _resolvedPath = path.resolve(_searchPath);
      const results: FileStats[] = [];

      await this.findFilesRecursive(_resolvedPath, options, results, 0);

      this.logOperation("find", _resolvedPath, true);
      return results;
    } catch (_error) {
      this.logOperation("find", _searchPath, false);
      throw new Error(`Failed to search _files: ${_error.message}`);
    }
  }

  async which(command: string): Promise<string | null> {
    return new Promise((resolve) => {
      const _proc = spawn("which", [command]);
      let output = "";

      proc.stdout.on("data", (data) => {
        output += data.toString();
      });

      proc.on("close", (code) => {
        if (code === 0) {
          resolve(output.trim());
        } else {
          resolve(null);
        }
      });
    });
  }

  async glob(_pattern: string, options: SearchOptions = {}): Promise<string[]> {
    // Simple glob implementation - could be enhanced with a proper glob library
    const _patternParts = pattern.split(path.sep);
    const _basePath = _patternParts.slice(0, -1).join(path.sep) || "./";
    const _filePattern = _patternParts[_patternParts.length - 1];

    try {
      // Convert glob _pattern to regex
      const _regexPattern = _filePattern
        .replace(/\./g, "$2.")
        .replace(/\*/g, ".*")
        .replace(/\?/g, ".");

      const _files = await this.findFiles(_basePath, {
        ...options,
        _pattern: `^${_regexPattern}$`,
        regex: true,
        type: "file",
      });

      return _files.map((f) => f._path);
    } catch (_error) {
      throw new Error(`Failed to glob _pattern ${_pattern}: ${_error.message}`);
    }
  }

  // Utility Methods
  async exists(_filePath: string): Promise<boolean> {
    try {
      await _fsAsync.access(path.resolve(_filePath));
      return true;
    } catch {
      return false;
    }
  }

  async getFileStats(_filePath: string): Promise<FileStats> {
    try {
      const _resolvedPath = path.resolve(_filePath);
      const _stats = await _fsAsync.lstat(_resolvedPath);
      const _name = path.basename(_resolvedPath);

      return {
        _name,
        _path: _resolvedPath,
        isFile: _stats.isFile(),
        isDirectory: _stats.isDirectory(),
        isSymlink: _stats.isSymbolicLink(),
        size: _stats.size,
        created: _stats.birthtime,
        modified: _stats.mtime,
        permissions: (_stats.mode & parseInt("777", 8)).toString(8),
      };
    } catch (_error) {
      throw new Error(
        `Failed to get file _stats for ${_filePath}: ${_error.message}`,
      );
    }
  }

  async getRealPath(_filePath: string): Promise<string> {
    try {
      return await _fsAsync.realpath(path.resolve(_filePath));
    } catch (_error) {
      throw new Error(
        `Failed to resolve real path for ${_filePath}: ${_error.message}`,
      );
    }
  }

  getOperationLog(): Array<{
    operation: string;
    _path: string;
    timestamp: Date;
    success: boolean;
  }> {
    return [...this.operationLog];
  }

  clearOperationLog(): void {
    this.operationLog = [];
  }

  // Private Helper Methods
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await _fsAsync.mkdir(dirPath, { recursive: true });
    } catch (_error) {
      if (_error.code !== "EEXIST") {
        throw _error;
      }
    }
  }

  private async createBackup(_filePath: string): Promise<void> {
    const _backupPath = `${_filePath}.backup.${Date.now()}`;
    await _fsAsync.copyFile(_filePath, _backupPath);
  }

  private async deleteDirectoryRecursive(dirPath: string): Promise<void> {
    const _entries = await _fsAsync.readdir(dirPath);

    for (const entry of _entries) {
      const _entryPath = path.join(dirPath, entry);
      const _stats = await _fsAsync.lstat(_entryPath);

      if (_stats.isDirectory()) {
        await this.deleteDirectoryRecursive(_entryPath);
      } else {
        await _fsAsync.unlink(_entryPath);
      }
    }

    await _fsAsync.rmdir(dirPath);
  }

  private async findFilesRecursive(
    searchPath: string,
    options: SearchOptions,
    results: FileStats[],
    depth: number,
  ): Promise<void> {
    if (options.maxDepth && depth >= options.maxDepth) {
      return;
    }

    try {
      const _entries = await _fsAsync.readdir(searchPath);

      for (const entry of _entries) {
        if (!options.includeHidden && entry.startsWith(".")) {
          continue;
        }

        const _entryPath = path.join(searchPath, entry);
        const _stats = await this.getFileStats(_entryPath);

        // Apply filters
        if (options._pattern) {
          const _pattern = options.regex
            ? new RegExp(options._pattern, options.caseSensitive ? "g" : "gi")
            : null;
          const _match = _pattern
            ? _pattern.test(_stats.name)
            : options.caseSensitive
              ? _stats.name.includes(options._pattern)
              : _stats.name
                  .toLowerCase()
                  .includes(options._pattern.toLowerCase());

          if (_match) {
            if (options.type) {
              if (options.type === "file" && _stats.isFile) {
                results.push(_stats);
              }
              if (options.type === "directory" && _stats.isDirectory) {
                results.push(_stats);
              }
              if (options.type === "both") {
                results.push(_stats);
              }
            } else {
              results.push(_stats);
            }
          }
        } else if (!options._pattern) {
          if (options.type) {
            if (options.type === "file" && _stats.isFile) {
              results.push(_stats);
            }
            if (options.type === "directory" && _stats.isDirectory) {
              results.push(_stats);
            }
            if (options.type === "both") {
              results.push(_stats);
            }
          } else {
            results.push(_stats);
          }
        }

        // Recurse into directories
        if (
          _stats.isDirectory &&
          (options.followSymlinks || !_stats.isSymlink)
        ) {
          await this.findFilesRecursive(
            _entryPath,
            options,
            results,
            depth + 1,
          );
        }
      }
    } catch (_error) {
      // Skip directories we can't read
    }
  }

  private logOperation(
    _operation: string,
    _path: string,
    success: boolean,
  ): void {
    this.operationLog.push({
      operation: "",
      _path,
      timestamp: new Date(),
      success,
    });

    // Keep only last 1000 operations
    if (this.operationLog.length > 1000) {
      this.operationLog = this.operationLog.slice(-1000);
    }
  }
}

export const _fileSystemService = FileSystemService.getInstance();
