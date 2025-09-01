/**
 * Trash Manager - Safe File Deletion with Trash/Recycle Bin Support
 * Provides cross-_platform trash functionality for safe file operations
 * Phase 2: Terminal Integration & Safety - Week 7
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { spawn } from "child_process";
import _chalk from "chalk";
import { _terminalDetector } from "../terminal-integration/TerminalDetector";

export interface TrashItem {
  id: string;
  originalPath: string;
  _trashedPath: string;
  trashedAt: Date;
  size: number;
  type: "file" | "directory";
  metadata: {
    permissions: string;
    owner: string;
    group: string;
  };
}

export interface TrashOperationResult {
  success: boolean;
  _trashId?: string;
  message?: string;
  _error?: string;
}

export interface RestoreResult {
  success: boolean;
  restoredPath?: string;
  message?: string;
  _error?: string;
}

export interface TrashCapabilities {
  _platform: "darwin" | "linux" | "win32";
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
        "Trash manager initialized with native support:",
        this.capabilities.nativeSupport,
      );
      return true;
    } catch (_error) {
      console._error("Failed to initialize trash manager:", _error);
      return false;
    }
  }

  /**
   * Move file or directory to trash
   */
  async moveToTrash(_filePath: string): Promise<TrashOperationResult> {
    if (!this.capabilities) {
      await this.initialize();
    }

    try {
      const _resolvedPath = path.resolve(_filePath);

      // Check if file exists
      if (!(await this.exists(_resolvedPath))) {
        return {
          success: false,
          _error: `File does not exist: ${_resolvedPath}`,
        };
      }

      // Try native trash first if available
      if (this.capabilities?.nativeSupport) {
        const _nativeResult = await this.moveToNativeTrash(_resolvedPath);
        if (_nativeResult.success) {
          return _nativeResult;
        }

        // Fall back to custom trash if native fails
        console.warn(
          "Native trash failed, falling back to custom implementation",
        );
      }

      // Use custom trash implementation
      return await this.moveToCustomTrash(_resolvedPath);
    } catch (_error) {
      return {
        success: false,
        _error: _error instanceof Error ? _error.message : String(_error),
      };
    }
  }

  /**
   * Restore file from trash
   */
  async restoreFromTrash(_trashId: string): Promise<RestoreResult> {
    try {
      const _trashItem = this.trashItems.get(_trashId);
      if (!_trashItem) {
        return {
          success: false,
          _error: `Trash _item not found: ${_trashId}`,
        };
      }

      // Check if original location is available
      const _originalExists = await this.exists(_trashItem.originalPath);
      let restorePath = _trashItem.originalPath;

      if (_originalExists) {
        // Find alternative path
        restorePath = await this.findAlternativePath(_trashItem.originalPath);
      }

      // Move from trash back to original location
      await fs.promises.rename(_trashItem.trashedPath, restorePath);

      // Restore permissions if possible
      try {
        await fs.promises.chmod(
          restorePath,
          parseInt(_trashItem.metadata.permissions, 8),
        );
      } catch {
        // Ignore permission restoration errors
      }

      // Remove from trash metadata
      this.trashItems.delete(_trashId);
      await this.saveTrashMetadata();

      return {
        success: true,
        restoredPath: restorePath,
        message: `Restored to: ${restorePath}`,
      };
    } catch (_error) {
      return {
        success: false,
        _error: _error instanceof Error ? _error.message : String(_error),
      };
    }
  }

  /**
   * Permanently delete from trash
   */
  async permanentDelete(_trashId: string): Promise<TrashOperationResult> {
    try {
      const _trashItem = this.trashItems.get(_trashId);
      if (!_trashItem) {
        return {
          success: false,
          _error: `Trash _item not found: ${_trashId}`,
        };
      }

      // Permanently delete the file/directory
      if (_trashItem.type === "directory") {
        await fs.promises.rm(_trashItem.trashedPath, {
          recursive: true,
          force: true,
        });
      } else {
        await fs.promises.unlink(_trashItem.trashedPath);
      }

      // Remove from trash metadata
      this.trashItems.delete(_trashId);
      await this.saveTrashMetadata();

      return {
        success: true,
        message: `Permanently deleted: ${path.basename(_trashItem.originalPath)}`,
      };
    } catch (_error) {
      return {
        success: false,
        _error: _error instanceof Error ? _error.message : String(_error),
      };
    }
  }

  /**
   * List _items in trash
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
      const _items = Array.from(this.trashItems.keys());
      let successCount = 0;
      let errorCount = 0;

      for (const _trashId of _items) {
        const _result = await this.permanentDelete(_trashId);
        if (_result.success) {
          successCount++;
        } else {
          errorCount++;
        }
      }

      return {
        success: errorCount === 0,
        message: `Emptied trash: ${successCount} _items deleted${errorCount > 0 ? `, ${errorCount} errors` : ""}`,
      };
    } catch (_error) {
      return {
        success: false,
        _error: _error instanceof Error ? _error.message : String(_error),
      };
    }
  }

  /**
   * Get trash statistics
   */
  getTrashStats(): {
    itemCount: number;
    _totalSize: number;
    oldestItem?: Date;
    newestItem?: Date;
  } {
    const _items = this.getTrashItems();

    if (_items.length === 0) {
      return { itemCount: 0, _totalSize: 0 };
    }

    const _totalSize = _items.reduce((sum, _item) => sum + _item.size, 0);
    const _dates = _items.map((_item) => _item.trashedAt);

    return {
      itemCount: _items.length,
      _totalSize,
      oldestItem: new Date(Math.min(..._dates.map((d) => d.getTime()))),
      newestItem: new Date(Math.max(..._dates.map((d) => d.getTime()))),
    };
  }

  /**
   * Clean old trash _items (older than specified days)
   */
  async cleanOldTrashItems(
    olderThanDays: number = 30,
  ): Promise<TrashOperationResult> {
    try {
      const _cutoffDate = new Date();
      _cutoffDate.setDate(_cutoffDate.getDate() - olderThanDays);

      const _oldItems = Array.from(this.trashItems.entries()).filter(
        ([_, _item]) => _item.trashedAt < _cutoffDate,
      );

      let successCount = 0;
      let errorCount = 0;

      for (const [_trashId, _] of _oldItems) {
        const _result = await this.permanentDelete(_trashId);
        if (_result.success) {
          successCount++;
        } else {
          errorCount++;
        }
      }

      return {
        success: errorCount === 0,
        message: `Cleaned ${successCount} old _items from trash${errorCount > 0 ? `, ${errorCount} errors` : ""}`,
      };
    } catch (_error) {
      return {
        success: false,
        _error: _error instanceof Error ? _error.message : String(_error),
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
    const _homeDir = os.homedir();

    if (process.platform === "darwin") {
      // macOS: Use ~/.Trash
      this.trashDirectory = path.join(_homeDir, ".Trash", "maria-trash");
    } else if (process.platform === "linux") {
      // Linux: Follow XDG spec
      const _xdgDataHome =
        process.env.XDG_DATA_HOME || path.join(_homeDir, ".local", "share");
      this.trashDirectory = path.join(_xdgDataHome, "Trash", "maria");
    } else {
      // Windows and others: Use AppData
      const _appData =
        process.env.APPDATA || path.join(_homeDir, "AppData", "Roaming");
      this.trashDirectory = path.join(_appData, "MARIA", "Trash");
    }

    this.metadataFile = path.join(this.trashDirectory, "metadata.json");

    // Create trash directory if it doesn't exist
    try {
      fs.mkdirSync(this.trashDirectory, { recursive: true });
    } catch (_error) {
      console.warn("Failed to create trash directory:", _error);
    }
  }

  /**
   * Detect trash capabilities for the current _platform
   */
  private async detectTrashCapabilities(): Promise<TrashCapabilities> {
    const _platform = process._platform as "darwin" | "linux" | "win32";
    const capabilities: TrashCapabilities = {
      _platform,
      nativeSupport: false,
      restoreSupport: true, // Custom implementation always supports restore
      permanentDeleteSupport: true,
    };

    switch (_platform) {
      case "darwin":
        // macOS: Check for osascript for Trash support
        capabilities.nativeSupport = await this.hasCommand("osascript");
        capabilities.trashCommand = "osascript";
        break;

      case "linux":
        // Linux: Check for trash-cli or gio
        if (await this.hasCommand("trash")) {
          capabilities.nativeSupport = true;
          capabilities.trashCommand = "trash";
        } else if (await this.hasCommand("gio")) {
          capabilities.nativeSupport = true;
          capabilities.trashCommand = "gio";
        }
        break;

      case "win32":
        // Windows: Use custom implementation (Recycle Bin access is complex)
        capabilities.nativeSupport = false;
        break;
    }

    return capabilities;
  }

  /**
   * Move to native trash using _platform-specific commands
   */
  private async moveToNativeTrash(
    _filePath: string,
  ): Promise<TrashOperationResult> {
    try {
      switch (this.capabilities?.platform) {
        case "darwin":
          return await this.moveToMacTrash(_filePath);
        case "linux":
          return await this.moveToLinuxTrash(_filePath);
        default:
          return {
            success: false,
            _error: "Native trash not supported on this _platform",
          };
      }
    } catch (_error) {
      return {
        success: false,
        _error: _error instanceof Error ? _error.message : String(_error),
      };
    }
  }

  /**
   * Move to macOS Trash using osascript
   */
  private async moveToMacTrash(
    _filePath: string,
  ): Promise<TrashOperationResult> {
    const _command = "osascript";
    const _args = [
      "-e",
      `tell application "Finder" to move POSIX file "${_filePath}" to trash`,
    ];

    const _result = await this.executeCommand(_command, _args);

    if (_result.success) {
      return {
        success: true,
        message: `Moved to Trash: ${path.basename(_filePath)}`,
      };
    } else {
      return {
        success: false,
        _error: _result.error || "Failed to move to macOS Trash",
      };
    }
  }

  /**
   * Move to Linux trash using trash-cli or gio
   */
  private async moveToLinuxTrash(
    _filePath: string,
  ): Promise<TrashOperationResult> {
    let _command: string;
    let _args: string[];

    if (this.capabilities?.trashCommand === "trash") {
      _command = "trash";
      _args = [_filePath];
    } else if (this.capabilities?.trashCommand === "gio") {
      _command = "gio";
      _args = ["trash", _filePath];
    } else {
      return { success: false, _error: "No suitable trash _command found" };
    }

    const _result = await this.executeCommand(_command, _args);

    if (_result.success) {
      return {
        success: true,
        message: `Moved to Trash: ${path.basename(_filePath)}`,
      };
    } else {
      return {
        success: false,
        _error: _result.error || "Failed to move to Linux trash",
      };
    }
  }

  /**
   * Move to custom trash implementation
   */
  private async moveToCustomTrash(
    _filePath: string,
  ): Promise<TrashOperationResult> {
    try {
      const _stats = await fs.promises.stat(_filePath);
      const _fileName = path.basename(_filePath);
      const _trashId = this.generateTrashId();
      const _trashedPath = path.join(
        this.trashDirectory,
        `${_trashId}_${_fileName}`,
      );

      // Move file to trash directory
      await fs.promises.rename(_filePath, _trashedPath);

      // Create trash metadata
      const _trashItem: TrashItem = {
        id: _trashId,
        originalPath: _filePath,
        _trashedPath,
        trashedAt: new Date(),
        size: _stats.isDirectory()
          ? await this.calculateDirectorySize(_trashedPath)
          : _stats.size,
        type: _stats.isDirectory() ? "directory" : "file",
        metadata: {
          permissions: (_stats.mode & 0o777).toString(8),
          owner: "unknown", // Could be enhanced to get actual owner
          group: "unknown",
        },
      };

      // Store in memory and save to disk
      this.trashItems.set(_trashId, _trashItem);
      await this.saveTrashMetadata();

      return {
        success: true,
        _trashId,
        message: `Moved to trash: ${_fileName}`,
      };
    } catch (_error) {
      return {
        success: false,
        _error: _error instanceof Error ? _error.message : String(_error),
      };
    }
  }

  /**
   * Load trash metadata from disk
   */
  private async loadTrashMetadata(): Promise<void> {
    try {
      if (await this.exists(this.metadataFile)) {
        const _data = await fs.promises.readFile(this.metadataFile, "utf8");
        const _items = JSON.parse(_data);

        this.trashItems.clear();
        for (const _item of _items) {
          // Convert trashedAt back to Date object
          _item.trashedAt = new Date(_item.trashedAt);
          this.trashItems.set(_item.id, _item);
        }
      }
    } catch (_error) {
      console.warn("Failed to load trash metadata:", _error);
      this.trashItems.clear();
    }
  }

  /**
   * Save trash metadata to disk
   */
  private async saveTrashMetadata(): Promise<void> {
    try {
      const _items = Array.from(this.trashItems.values());
      const _data = JSON.stringify(_items, null, 2);
      await fs.promises.writeFile(this.metadataFile, _data);
    } catch (_error) {
      console.warn("Failed to save trash metadata:", _error);
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
    const _dir = path.dirname(originalPath);
    const _ext = path.extname(originalPath);
    const _name = path.basename(originalPath, _ext);

    let counter = 1;
    let alternativePath: string;

    do {
      alternativePath = path.join(
        _dir,
        `${_name} (restored ${counter})${_ext}`,
      );
      counter++;
    } while (await this.exists(alternativePath));

    return alternativePath;
  }

  /**
   * Calculate directory size recursively
   */
  private async calculateDirectorySize(dirPath: string): Promise<number> {
    let _totalSize = 0;

    try {
      const _entries = await fs.promises.readdir(dirPath, {
        withFileTypes: true,
      });

      for (const entry of _entries) {
        const _fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          _totalSize += await this.calculateDirectorySize(_fullPath);
        } else {
          try {
            const _stats = await fs.promises.stat(_fullPath);
            _totalSize += _stats.size;
          } catch {
            // Skip files we can't stat
          }
        }
      }
    } catch {
      // Skip directories we can't read
    }

    return _totalSize;
  }

  /**
   * Check if _command exists
   */
  private async hasCommand(_command: string): Promise<boolean> {
    try {
      const _result = await this.executeCommand("which", [_command], {
        _timeout: 1000,
      });
      return _result.success;
    } catch {
      return false;
    }
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
   * Execute _command with _timeout
   */
  private executeCommand(
    _command: string,
    _args: string[],
    options: { _timeout?: number } = {},
  ): Promise<{ success: boolean; output?: string; _error?: string }> {
    return new Promise((resolve) => {
      const _proc = spawn(_command, _args, { stdio: "pipe" });
      let output = "";
      let _error = "";

      const _timeout = options._timeout || 10000;
      const _timer = setTimeout(() => {
        proc.kill();
        resolve({ success: false, _error: "Command _timeout" });
      }, _timeout);

      proc.stdout?.on("_data", (_data) => {
        output += _data.toString();
      });

      proc.stderr?.on("_data", (_data) => {
        _error += _data.toString();
      });

      proc.on("close", (code) => {
        clearTimeout(_timer);
        resolve({
          success: code === 0,
          output: output.trim(),
          _error: _error.trim() || undefined,
        });
      });

      proc.on("_error", (err) => {
        clearTimeout(_timer);
        resolve({
          success: false,
          _error: err.message,
        });
      });
    });
  }
}

export const _trashManager = TrashManager.getInstance();
