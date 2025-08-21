import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { spawn } from 'child_process';
import chalk from 'chalk';

const fsAsync = {
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
  name: string;
  path: string;
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
  pattern?: string;
  type?: 'file' | 'directory' | 'both';
  maxDepth?: number;
  caseSensitive?: boolean;
  includeHidden?: boolean;
  regex?: boolean;
}

export class FileSystemService {
  private static instance: FileSystemService;
  private operationLog: Array<{
    operation: string;
    path: string;
    timestamp: Date;
    success: boolean;
  }> = [];

  public static getInstance(): FileSystemService {
    if (!FileSystemService.instance) {
      FileSystemService.instance = new FileSystemService();
    }
    return FileSystemService.instance;
  }

  private constructor() {}

  // Basic File Operations
  async readFile(filePath: string, encoding: BufferEncoding = 'utf8'): Promise<string | Buffer> {
    try {
      const resolvedPath = path.resolve(filePath);
      const content = await fsAsync.readFile(resolvedPath, encoding);
      this.logOperation('read', resolvedPath, true);
      return content;
    } catch (error) {
      this.logOperation('read', filePath, false);
      throw new Error(`Failed to read file ${filePath}: ${error.message}`);
    }
  }

  async writeFile(
    filePath: string,
    content: string | Buffer,
    options: FileOperationOptions = {},
  ): Promise<void> {
    try {
      const resolvedPath = path.resolve(filePath);

      if (options.backup && (await this.exists(resolvedPath))) {
        await this.createBackup(resolvedPath);
      }

      if (options.dryRun) {
        console.log(chalk.yellow(`[DRY RUN] Would write to: ${resolvedPath}`));
        return;
      }

      await this.ensureDirectoryExists(path.dirname(resolvedPath));
      await fsAsync.writeFile(resolvedPath, content);

      this.logOperation('write', resolvedPath, true);
    } catch (error) {
      this.logOperation('write', filePath, false);
      throw new Error(`Failed to write file ${filePath}: ${error.message}`);
    }
  }

  async deleteFile(filePath: string, options: FileOperationOptions = {}): Promise<void> {
    try {
      const resolvedPath = path.resolve(filePath);

      if (!(await this.exists(resolvedPath))) {
        throw new Error(`File does not exist: ${resolvedPath}`);
      }

      if (options.backup) {
        await this.createBackup(resolvedPath);
      }

      if (options.dryRun) {
        console.log(chalk.yellow(`[DRY RUN] Would delete: ${resolvedPath}`));
        return;
      }

      await fsAsync.unlink(resolvedPath);
      this.logOperation('delete', resolvedPath, true);
    } catch (error) {
      this.logOperation('delete', filePath, false);
      throw new Error(`Failed to delete file ${filePath}: ${error.message}`);
    }
  }

  // Directory Operations
  async createDirectory(dirPath: string, options: FileOperationOptions = {}): Promise<void> {
    try {
      const resolvedPath = path.resolve(dirPath);

      if (options.dryRun) {
        console.log(chalk.yellow(`[DRY RUN] Would create directory: ${resolvedPath}`));
        return;
      }

      await fsAsync.mkdir(resolvedPath, { recursive: options.recursive ?? true });
      this.logOperation('mkdir', resolvedPath, true);
    } catch (error) {
      this.logOperation('mkdir', dirPath, false);
      throw new Error(`Failed to create directory ${dirPath}: ${error.message}`);
    }
  }

  async deleteDirectory(dirPath: string, options: FileOperationOptions = {}): Promise<void> {
    try {
      const resolvedPath = path.resolve(dirPath);

      if (!(await this.exists(resolvedPath))) {
        throw new Error(`Directory does not exist: ${resolvedPath}`);
      }

      if (options.dryRun) {
        console.log(chalk.yellow(`[DRY RUN] Would delete directory: ${resolvedPath}`));
        return;
      }

      if (options.recursive) {
        await this.deleteDirectoryRecursive(resolvedPath);
      } else {
        await fsAsync.rmdir(resolvedPath);
      }

      this.logOperation('rmdir', resolvedPath, true);
    } catch (error) {
      this.logOperation('rmdir', dirPath, false);
      throw new Error(`Failed to delete directory ${dirPath}: ${error.message}`);
    }
  }

  async listDirectory(dirPath: string, options: SearchOptions = {}): Promise<FileStats[]> {
    try {
      const resolvedPath = path.resolve(dirPath);
      const entries = await fsAsync.readdir(resolvedPath);
      const results: FileStats[] = [];

      for (const entry of entries) {
        if (!options.includeHidden && entry.startsWith('.')) {
          continue;
        }

        const entryPath = path.join(resolvedPath, entry);
        const stats = await this.getFileStats(entryPath);

        if (options.type) {
          if (options.type === 'file' && !stats.isFile) continue;
          if (options.type === 'directory' && !stats.isDirectory) continue;
        }

        if (options.pattern) {
          const match = options.caseSensitive
            ? stats.name.includes(options.pattern)
            : stats.name.toLowerCase().includes(options.pattern.toLowerCase());
          if (!match) continue;
        }

        results.push(stats);
      }

      this.logOperation('readdir', resolvedPath, true);
      return results.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });
    } catch (error) {
      this.logOperation('readdir', dirPath, false);
      throw new Error(`Failed to list directory ${dirPath}: ${error.message}`);
    }
  }

  // Advanced Operations
  async copyFile(
    sourcePath: string,
    destPath: string,
    options: FileOperationOptions = {},
  ): Promise<void> {
    try {
      const resolvedSource = path.resolve(sourcePath);
      const resolvedDest = path.resolve(destPath);

      if (!(await this.exists(resolvedSource))) {
        throw new Error(`Source file does not exist: ${resolvedSource}`);
      }

      if (options.dryRun) {
        console.log(chalk.yellow(`[DRY RUN] Would copy: ${resolvedSource} → ${resolvedDest}`));
        return;
      }

      await this.ensureDirectoryExists(path.dirname(resolvedDest));

      if ((await this.exists(resolvedDest)) && !options.force) {
        throw new Error(`Destination file already exists: ${resolvedDest}`);
      }

      await fsAsync.copyFile(resolvedSource, resolvedDest);

      if (options.preserveTimestamps) {
        const sourceStats = await fsAsync.stat(resolvedSource);
        await fs.promises.utimes(resolvedDest, sourceStats.atime, sourceStats.mtime);
      }

      this.logOperation('copy', `${resolvedSource} → ${resolvedDest}`, true);
    } catch (error) {
      this.logOperation('copy', `${sourcePath} → ${destPath}`, false);
      throw new Error(`Failed to copy file: ${error.message}`);
    }
  }

  async moveFile(
    sourcePath: string,
    destPath: string,
    options: FileOperationOptions = {},
  ): Promise<void> {
    try {
      const resolvedSource = path.resolve(sourcePath);
      const resolvedDest = path.resolve(destPath);

      if (!(await this.exists(resolvedSource))) {
        throw new Error(`Source file does not exist: ${resolvedSource}`);
      }

      if (options.dryRun) {
        console.log(chalk.yellow(`[DRY RUN] Would move: ${resolvedSource} → ${resolvedDest}`));
        return;
      }

      await this.ensureDirectoryExists(path.dirname(resolvedDest));

      if ((await this.exists(resolvedDest)) && !options.force) {
        throw new Error(`Destination file already exists: ${resolvedDest}`);
      }

      await fsAsync.rename(resolvedSource, resolvedDest);
      this.logOperation('move', `${resolvedSource} → ${resolvedDest}`, true);
    } catch (error) {
      this.logOperation('move', `${sourcePath} → ${destPath}`, false);
      throw new Error(`Failed to move file: ${error.message}`);
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
  async findFiles(searchPath: string, options: SearchOptions = {}): Promise<FileStats[]> {
    try {
      const resolvedPath = path.resolve(searchPath);
      const results: FileStats[] = [];

      await this.findFilesRecursive(resolvedPath, options, results, 0);

      this.logOperation('find', resolvedPath, true);
      return results;
    } catch (error) {
      this.logOperation('find', searchPath, false);
      throw new Error(`Failed to search files: ${error.message}`);
    }
  }

  async which(command: string): Promise<string | null> {
    return new Promise((resolve) => {
      const proc = spawn('which', [command]);
      let output = '';

      proc.stdout.on('data', (data) => {
        output += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve(output.trim());
        } else {
          resolve(null);
        }
      });
    });
  }

  async glob(pattern: string, options: SearchOptions = {}): Promise<string[]> {
    // Simple glob implementation - could be enhanced with a proper glob library
    const patternParts = pattern.split(path.sep);
    const basePath = patternParts.slice(0, -1).join(path.sep) || './';
    const filePattern = patternParts[patternParts.length - 1];

    try {
      // Convert glob pattern to regex
      const regexPattern = filePattern
        .replace(/\./g, '\\.')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.');

      const files = await this.findFiles(basePath, {
        ...options,
        pattern: `^${regexPattern}$`,
        regex: true,
        type: 'file',
      });

      return files.map((f) => f.path);
    } catch (error) {
      throw new Error(`Failed to glob pattern ${pattern}: ${error.message}`);
    }
  }

  // Utility Methods
  async exists(filePath: string): Promise<boolean> {
    try {
      await fsAsync.access(path.resolve(filePath));
      return true;
    } catch {
      return false;
    }
  }

  async getFileStats(filePath: string): Promise<FileStats> {
    try {
      const resolvedPath = path.resolve(filePath);
      const stats = await fsAsync.lstat(resolvedPath);
      const name = path.basename(resolvedPath);

      return {
        name,
        path: resolvedPath,
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory(),
        isSymlink: stats.isSymbolicLink(),
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        permissions: (stats.mode & parseInt('777', 8)).toString(8),
      };
    } catch (error) {
      throw new Error(`Failed to get file stats for ${filePath}: ${error.message}`);
    }
  }

  async getRealPath(filePath: string): Promise<string> {
    try {
      return await fsAsync.realpath(path.resolve(filePath));
    } catch (error) {
      throw new Error(`Failed to resolve real path for ${filePath}: ${error.message}`);
    }
  }

  getOperationLog(): Array<{ operation: string; path: string; timestamp: Date; success: boolean }> {
    return [...this.operationLog];
  }

  clearOperationLog(): void {
    this.operationLog = [];
  }

  // Private Helper Methods
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fsAsync.mkdir(dirPath, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }

  private async createBackup(filePath: string): Promise<void> {
    const backupPath = `${filePath}.backup.${Date.now()}`;
    await fsAsync.copyFile(filePath, backupPath);
  }

  private async deleteDirectoryRecursive(dirPath: string): Promise<void> {
    const entries = await fsAsync.readdir(dirPath);

    for (const entry of entries) {
      const entryPath = path.join(dirPath, entry);
      const stats = await fsAsync.lstat(entryPath);

      if (stats.isDirectory()) {
        await this.deleteDirectoryRecursive(entryPath);
      } else {
        await fsAsync.unlink(entryPath);
      }
    }

    await fsAsync.rmdir(dirPath);
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
      const entries = await fsAsync.readdir(searchPath);

      for (const entry of entries) {
        if (!options.includeHidden && entry.startsWith('.')) {
          continue;
        }

        const entryPath = path.join(searchPath, entry);
        const stats = await this.getFileStats(entryPath);

        // Apply filters
        if (options.pattern) {
          const pattern = options.regex
            ? new RegExp(options.pattern, options.caseSensitive ? 'g' : 'gi')
            : null;
          const match = pattern
            ? pattern.test(stats.name)
            : options.caseSensitive
              ? stats.name.includes(options.pattern)
              : stats.name.toLowerCase().includes(options.pattern.toLowerCase());

          if (match) {
            if (options.type) {
              if (options.type === 'file' && stats.isFile) results.push(stats);
              if (options.type === 'directory' && stats.isDirectory) results.push(stats);
              if (options.type === 'both') results.push(stats);
            } else {
              results.push(stats);
            }
          }
        } else if (!options.pattern) {
          if (options.type) {
            if (options.type === 'file' && stats.isFile) results.push(stats);
            if (options.type === 'directory' && stats.isDirectory) results.push(stats);
            if (options.type === 'both') results.push(stats);
          } else {
            results.push(stats);
          }
        }

        // Recurse into directories
        if (stats.isDirectory && (options.followSymlinks || !stats.isSymlink)) {
          await this.findFilesRecursive(entryPath, options, results, depth + 1);
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }
  }

  private logOperation(operation: string, path: string, success: boolean): void {
    this.operationLog.push({
      operation,
      path,
      timestamp: new Date(),
      success,
    });

    // Keep only last 1000 operations
    if (this.operationLog.length > 1000) {
      this.operationLog = this.operationLog.slice(-1000);
    }
  }
}

export const fileSystemService = FileSystemService.getInstance();
