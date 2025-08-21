/**
 * Trash Manager - Safe File Deletion with Trash/Recycle Bin Support
 * Provides cross-platform trash functionality for safe file operations
 * Phase 2: Terminal Integration & Safety - Week 7
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawn } from 'child_process';
import chalk from 'chalk';
import { terminalDetector } from '../terminal-integration/TerminalDetector';

export interface TrashItem {
  id: string;
  originalPath: string;
  trashedPath: string;
  trashedAt: Date;
  size: number;
  type: 'file' | 'directory';
  metadata: {
    permissions: string;
    owner: string;
    group: string;
  };
}

export interface TrashOperationResult {
  success: boolean;
  trashId?: string;
  message?: string;
  error?: string;
}

export interface RestoreResult {
  success: boolean;
  restoredPath?: string;
  message?: string;
  error?: string;
}

export interface TrashCapabilities {
  platform: 'darwin' | 'linux' | 'win32';
  nativeSupport: boolean;
  trashCommand?: string;
  restoreSupport: boolean;
  permanentDeleteSupport: boolean;
}

export class TrashManager {
  private static instance: TrashManager;
  private trashDirectory: string;
  private metadataFile: string;
  private capabilities: TrashCapabilities | null = null;
  private trashItems: Map<string, TrashItem> = new Map();

  public static getInstance(): TrashManager {
    if (!TrashManager.instance) {
      TrashManager.instance = new TrashManager();
    }
    return TrashManager.instance;
  }

  private constructor() {
    this.initializeTrashDirectory();
  }

  /**
   * Initialize trash manager and detect capabilities
   */
  async initialize(): Promise<boolean> {
    try {
      this.capabilities = await this.detectTrashCapabilities();
      await this.loadTrashMetadata();

      console.debug(
        'Trash manager initialized with native support:',
        this.capabilities.nativeSupport,
      );
      return true;
    } catch (error) {
      console.error('Failed to initialize trash manager:', error);
      return false;
    }
  }

  /**
   * Move file or directory to trash
   */
  async moveToTrash(filePath: string): Promise<TrashOperationResult> {
    if (!this.capabilities) {
      await this.initialize();
    }

    try {
      const resolvedPath = path.resolve(filePath);

      // Check if file exists
      if (!(await this.exists(resolvedPath))) {
        return {
          success: false,
          error: `File does not exist: ${resolvedPath}`,
        };
      }

      // Try native trash first if available
      if (this.capabilities?.nativeSupport) {
        const nativeResult = await this.moveToNativeTrash(resolvedPath);
        if (nativeResult.success) {
          return nativeResult;
        }

        // Fall back to custom trash if native fails
        console.warn('Native trash failed, falling back to custom implementation');
      }

      // Use custom trash implementation
      return await this.moveToCustomTrash(resolvedPath);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Restore file from trash
   */
  async restoreFromTrash(trashId: string): Promise<RestoreResult> {
    try {
      const trashItem = this.trashItems.get(trashId);
      if (!trashItem) {
        return {
          success: false,
          error: `Trash item not found: ${trashId}`,
        };
      }

      // Check if original location is available
      const originalExists = await this.exists(trashItem.originalPath);
      let restorePath = trashItem.originalPath;

      if (originalExists) {
        // Find alternative path
        restorePath = await this.findAlternativePath(trashItem.originalPath);
      }

      // Move from trash back to original location
      await fs.promises.rename(trashItem.trashedPath, restorePath);

      // Restore permissions if possible
      try {
        await fs.promises.chmod(restorePath, parseInt(trashItem.metadata.permissions, 8));
      } catch {
        // Ignore permission restoration errors
      }

      // Remove from trash metadata
      this.trashItems.delete(trashId);
      await this.saveTrashMetadata();

      return {
        success: true,
        restoredPath: restorePath,
        message: `Restored to: ${restorePath}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Permanently delete from trash
   */
  async permanentDelete(trashId: string): Promise<TrashOperationResult> {
    try {
      const trashItem = this.trashItems.get(trashId);
      if (!trashItem) {
        return {
          success: false,
          error: `Trash item not found: ${trashId}`,
        };
      }

      // Permanently delete the file/directory
      if (trashItem.type === 'directory') {
        await fs.promises.rm(trashItem.trashedPath, { recursive: true, force: true });
      } else {
        await fs.promises.unlink(trashItem.trashedPath);
      }

      // Remove from trash metadata
      this.trashItems.delete(trashId);
      await this.saveTrashMetadata();

      return {
        success: true,
        message: `Permanently deleted: ${path.basename(trashItem.originalPath)}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * List items in trash
   */
  getTrashItems(): TrashItem[] {
    return Array.from(this.trashItems.values()).sort(
      (a, b) => b.trashedAt.getTime() - a.trashedAt.getTime(),
    );
  }

  /**
   * Empty entire trash
   */
  async emptyTrash(): Promise<TrashOperationResult> {
    try {
      const items = Array.from(this.trashItems.keys());
      let successCount = 0;
      let errorCount = 0;

      for (const trashId of items) {
        const result = await this.permanentDelete(trashId);
        if (result.success) {
          successCount++;
        } else {
          errorCount++;
        }
      }

      return {
        success: errorCount === 0,
        message: `Emptied trash: ${successCount} items deleted${errorCount > 0 ? `, ${errorCount} errors` : ''}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get trash statistics
   */
  getTrashStats(): {
    itemCount: number;
    totalSize: number;
    oldestItem?: Date;
    newestItem?: Date;
  } {
    const items = this.getTrashItems();

    if (items.length === 0) {
      return { itemCount: 0, totalSize: 0 };
    }

    const totalSize = items.reduce((sum, item) => sum + item.size, 0);
    const dates = items.map((item) => item.trashedAt);

    return {
      itemCount: items.length,
      totalSize,
      oldestItem: new Date(Math.min(...dates.map((d) => d.getTime()))),
      newestItem: new Date(Math.max(...dates.map((d) => d.getTime()))),
    };
  }

  /**
   * Clean old trash items (older than specified days)
   */
  async cleanOldTrashItems(olderThanDays: number = 30): Promise<TrashOperationResult> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const oldItems = Array.from(this.trashItems.entries()).filter(
        ([_, item]) => item.trashedAt < cutoffDate,
      );

      let successCount = 0;
      let errorCount = 0;

      for (const [trashId, _] of oldItems) {
        const result = await this.permanentDelete(trashId);
        if (result.success) {
          successCount++;
        } else {
          errorCount++;
        }
      }

      return {
        success: errorCount === 0,
        message: `Cleaned ${successCount} old items from trash${errorCount > 0 ? `, ${errorCount} errors` : ''}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get trash capabilities
   */
  getCapabilities(): TrashCapabilities | null {
    return this.capabilities;
  }

  /**
   * Initialize trash directory
   */
  private initializeTrashDirectory(): void {
    const homeDir = os.homedir();

    if (process.platform === 'darwin') {
      // macOS: Use ~/.Trash
      this.trashDirectory = path.join(homeDir, '.Trash', 'maria-trash');
    } else if (process.platform === 'linux') {
      // Linux: Follow XDG spec
      const xdgDataHome = process.env.XDG_DATA_HOME || path.join(homeDir, '.local', 'share');
      this.trashDirectory = path.join(xdgDataHome, 'Trash', 'maria');
    } else {
      // Windows and others: Use AppData
      const appData = process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming');
      this.trashDirectory = path.join(appData, 'MARIA', 'Trash');
    }

    this.metadataFile = path.join(this.trashDirectory, 'metadata.json');

    // Create trash directory if it doesn't exist
    try {
      fs.mkdirSync(this.trashDirectory, { recursive: true });
    } catch (error) {
      console.warn('Failed to create trash directory:', error);
    }
  }

  /**
   * Detect trash capabilities for the current platform
   */
  private async detectTrashCapabilities(): Promise<TrashCapabilities> {
    const platform = process.platform as 'darwin' | 'linux' | 'win32';
    const capabilities: TrashCapabilities = {
      platform,
      nativeSupport: false,
      restoreSupport: true, // Custom implementation always supports restore
      permanentDeleteSupport: true,
    };

    switch (platform) {
      case 'darwin':
        // macOS: Check for osascript for Trash support
        capabilities.nativeSupport = await this.hasCommand('osascript');
        capabilities.trashCommand = 'osascript';
        break;

      case 'linux':
        // Linux: Check for trash-cli or gio
        if (await this.hasCommand('trash')) {
          capabilities.nativeSupport = true;
          capabilities.trashCommand = 'trash';
        } else if (await this.hasCommand('gio')) {
          capabilities.nativeSupport = true;
          capabilities.trashCommand = 'gio';
        }
        break;

      case 'win32':
        // Windows: Use custom implementation (Recycle Bin access is complex)
        capabilities.nativeSupport = false;
        break;
    }

    return capabilities;
  }

  /**
   * Move to native trash using platform-specific commands
   */
  private async moveToNativeTrash(filePath: string): Promise<TrashOperationResult> {
    try {
      switch (this.capabilities?.platform) {
        case 'darwin':
          return await this.moveToMacTrash(filePath);
        case 'linux':
          return await this.moveToLinuxTrash(filePath);
        default:
          return { success: false, error: 'Native trash not supported on this platform' };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Move to macOS Trash using osascript
   */
  private async moveToMacTrash(filePath: string): Promise<TrashOperationResult> {
    const command = 'osascript';
    const args = ['-e', `tell application "Finder" to move POSIX file "${filePath}" to trash`];

    const result = await this.executeCommand(command, args);

    if (result.success) {
      return {
        success: true,
        message: `Moved to Trash: ${path.basename(filePath)}`,
      };
    } else {
      return {
        success: false,
        error: result.error || 'Failed to move to macOS Trash',
      };
    }
  }

  /**
   * Move to Linux trash using trash-cli or gio
   */
  private async moveToLinuxTrash(filePath: string): Promise<TrashOperationResult> {
    let command: string;
    let args: string[];

    if (this.capabilities?.trashCommand === 'trash') {
      command = 'trash';
      args = [filePath];
    } else if (this.capabilities?.trashCommand === 'gio') {
      command = 'gio';
      args = ['trash', filePath];
    } else {
      return { success: false, error: 'No suitable trash command found' };
    }

    const result = await this.executeCommand(command, args);

    if (result.success) {
      return {
        success: true,
        message: `Moved to Trash: ${path.basename(filePath)}`,
      };
    } else {
      return {
        success: false,
        error: result.error || 'Failed to move to Linux trash',
      };
    }
  }

  /**
   * Move to custom trash implementation
   */
  private async moveToCustomTrash(filePath: string): Promise<TrashOperationResult> {
    try {
      const stats = await fs.promises.stat(filePath);
      const fileName = path.basename(filePath);
      const trashId = this.generateTrashId();
      const trashedPath = path.join(this.trashDirectory, `${trashId}_${fileName}`);

      // Move file to trash directory
      await fs.promises.rename(filePath, trashedPath);

      // Create trash metadata
      const trashItem: TrashItem = {
        id: trashId,
        originalPath: filePath,
        trashedPath,
        trashedAt: new Date(),
        size: stats.isDirectory() ? await this.calculateDirectorySize(trashedPath) : stats.size,
        type: stats.isDirectory() ? 'directory' : 'file',
        metadata: {
          permissions: (stats.mode & 0o777).toString(8),
          owner: 'unknown', // Could be enhanced to get actual owner
          group: 'unknown',
        },
      };

      // Store in memory and save to disk
      this.trashItems.set(trashId, trashItem);
      await this.saveTrashMetadata();

      return {
        success: true,
        trashId,
        message: `Moved to trash: ${fileName}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Load trash metadata from disk
   */
  private async loadTrashMetadata(): Promise<void> {
    try {
      if (await this.exists(this.metadataFile)) {
        const data = await fs.promises.readFile(this.metadataFile, 'utf8');
        const items = JSON.parse(data);

        this.trashItems.clear();
        for (const item of items) {
          // Convert trashedAt back to Date object
          item.trashedAt = new Date(item.trashedAt);
          this.trashItems.set(item.id, item);
        }
      }
    } catch (error) {
      console.warn('Failed to load trash metadata:', error);
      this.trashItems.clear();
    }
  }

  /**
   * Save trash metadata to disk
   */
  private async saveTrashMetadata(): Promise<void> {
    try {
      const items = Array.from(this.trashItems.values());
      const data = JSON.stringify(items, null, 2);
      await fs.promises.writeFile(this.metadataFile, data);
    } catch (error) {
      console.warn('Failed to save trash metadata:', error);
    }
  }

  /**
   * Generate unique trash ID
   */
  private generateTrashId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Find alternative path if original is occupied
   */
  private async findAlternativePath(originalPath: string): Promise<string> {
    const dir = path.dirname(originalPath);
    const ext = path.extname(originalPath);
    const name = path.basename(originalPath, ext);

    let counter = 1;
    let alternativePath: string;

    do {
      alternativePath = path.join(dir, `${name} (restored ${counter})${ext}`);
      counter++;
    } while (await this.exists(alternativePath));

    return alternativePath;
  }

  /**
   * Calculate directory size recursively
   */
  private async calculateDirectorySize(dirPath: string): Promise<number> {
    let totalSize = 0;

    try {
      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          totalSize += await this.calculateDirectorySize(fullPath);
        } else {
          try {
            const stats = await fs.promises.stat(fullPath);
            totalSize += stats.size;
          } catch {
            // Skip files we can't stat
          }
        }
      }
    } catch {
      // Skip directories we can't read
    }

    return totalSize;
  }

  /**
   * Check if command exists
   */
  private async hasCommand(command: string): Promise<boolean> {
    try {
      const result = await this.executeCommand('which', [command], { timeout: 1000 });
      return result.success;
    } catch {
      return false;
    }
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
   * Execute command with timeout
   */
  private executeCommand(
    command: string,
    args: string[],
    options: { timeout?: number } = {},
  ): Promise<{ success: boolean; output?: string; error?: string }> {
    return new Promise((resolve) => {
      const proc = spawn(command, args, { stdio: 'pipe' });
      let output = '';
      let error = '';

      const timeout = options.timeout || 10000;
      const timer = setTimeout(() => {
        proc.kill();
        resolve({ success: false, error: 'Command timeout' });
      }, timeout);

      proc.stdout?.on('data', (data) => {
        output += data.toString();
      });

      proc.stderr?.on('data', (data) => {
        error += data.toString();
      });

      proc.on('close', (code) => {
        clearTimeout(timer);
        resolve({
          success: code === 0,
          output: output.trim(),
          error: error.trim() || undefined,
        });
      });

      proc.on('error', (err) => {
        clearTimeout(timer);
        resolve({
          success: false,
          error: err.message,
        });
      });
    });
  }
}

export const trashManager = TrashManager.getInstance();
