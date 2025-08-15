/**
 * File Operations
 * Handles file system operations for auto-improve
 */

import * as fs from 'fs/promises';
import { Stats } from 'fs';
import * as path from 'path';

export interface FileChange {
  path: string;
  original: string;
  modified: string;
  diff?: string;
}

export interface FileBackup {
  id: string;
  timestamp: Date;
  files: Map<string, string>;
}

class FileOperations {
  private backups: Map<string, FileBackup> = new Map();

  async readFile(filePath: string): Promise<string> {
    return await fs.readFile(filePath, 'utf-8');
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    await fs.writeFile(filePath, content, 'utf-8');
  }

  async createBackup(files: string[]): Promise<string> {
    const backupId = `backup-${Date.now()}`;
    const fileContents = new Map<string, string>();

    for (const file of files) {
      try {
        const content = await this.readFile(file);
        fileContents.set(file, content);
      } catch (error: unknown) {
        console.error(`Failed to backup ${file}:`, error);
      }
    }

    this.backups.set(backupId, {
      id: backupId,
      timestamp: new Date(),
      files: fileContents,
    });

    return backupId;
  }

  async restoreBackup(backupId: string): Promise<void> {
    const backup = this.backups.get(backupId);
    if (!backup) {
      throw new Error(`Backup ${backupId} not found`);
    }

    for (const [filePath, content] of backup.files) {
      await this.writeFile(filePath, content);
    }
  }

  async applyChanges(changes: FileChange[]): Promise<void> {
    for (const change of changes) {
      await this.writeFile(change.path, change.modified);
    }
  }

  async getFileStats(filePath: string): Promise<Stats> {
    return await fs.stat(filePath);
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async ensureDir(dirPath: string): Promise<void> {
    await fs.mkdir(dirPath, { recursive: true });
  }

  async listFiles(dirPath: string, pattern?: RegExp): Promise<string[]> {
    const files = await fs.readdir(dirPath, { withFileTypes: true });
    const filePaths = files
      .filter((dirent) => dirent.isFile())
      .map((dirent) => path.join(dirPath, dirent.name));

    if (pattern) {
      return filePaths.filter((file) => pattern.test(file));
    }

    return filePaths;
  }
}

export const fileOperations = new FileOperations();
