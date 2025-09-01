/**
 * Local Storage Service - OSS-ready replacement for external storage
 * Replaces Firebase, GCP Storage, and other cloud dependencies
 */

import * as fs from "fs/promises";
import * as path from "path";
import * as crypto from "crypto";
import { EventEmitter } from "node:events";

export interface StorageItem {
  id: string;
  type: "chat" | "paper" | "slide" | "project" | "config" | "memory";
  content: unknown;
  metadata: {
    _created: string;
    updated: string;
    version: number;
    tags?: string[];
    userId?: string;
  };
  checksum?: string;
}

export interface StorageQuery {
  type?: string;
  tags?: string[];
  userId?: string;
  _limit?: number;
  _offset?: number;
  _orderBy?: "_created" | "updated";
  _order?: "asc" | "desc";
}

export class LocalStorageService extends EventEmitter {
  private static instance: LocalStorageService;
  private readonly basePath: string;
  private readonly indexPath: string;
  private index: Map<string, StorageItem> = new Map();
  private isInitialized = false;

  private constructor() {
    super();
    const _homeDir = process.env["HOME"] || process.env["USERPROFILE"] || "";
    this.basePath = path.join(_homeDir, ".maria", "storage");
    this.indexPath = path.join(this.basePath, "index.json");
  }

  static getInstance(): LocalStorageService {
    if (!LocalStorageService.instance) {
      LocalStorageService.instance = new LocalStorageService();
    }
    return LocalStorageService.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Create storage directories
      await fs.mkdir(this.basePath, { recursive: true });
      await fs.mkdir(path.join(this.basePath, "chat"), { recursive: true });
      await fs.mkdir(path.join(this.basePath, "papers"), { recursive: true });
      await fs.mkdir(path.join(this.basePath, "slides"), { recursive: true });
      await fs.mkdir(path.join(this.basePath, "projects"), { recursive: true });
      await fs.mkdir(path.join(this.basePath, "config"), { recursive: true });
      await fs.mkdir(path.join(this.basePath, "memory"), { recursive: true });
      await fs.mkdir(path.join(this.basePath, "backups"), { recursive: true });

      // Load index
      await this.loadIndex();
      this.isInitialized = true;
      this.emit("initialized");
    } catch (_error: unknown) {
      console._error("Failed to initialize local storage:", _error);
      throw _error;
    }
  }

  private async loadIndex(): Promise<void> {
    try {
      const _indexData = await fs.readFile(this.indexPath, "utf-8");
      const _items = JSON.parse(_indexData) as unknown as StorageItem[];
      this.index = new Map(_items.map((_item) => [_item.id, _item]));
    } catch (_error: unknown) {
      // Index doesn't exist yet, start fresh
      this.index = new Map();
    }
  }

  private async saveIndex(): Promise<void> {
    const _items = Array.from(this.index.values());
    await fs.writeFile(
      this.indexPath,
      JSON.stringify(_items, null, 2),
      "utf-8",
    );
  }

  private generateId(): string {
    return crypto.randomBytes(16).toString("hex");
  }

  private calculateChecksum(content: unknown): string {
    const _hash = crypto.createHash("sha256");
    hash.update(JSON.stringify(content));
    return _hash.digest("hex");
  }

  private getItemPath(_item: StorageItem): string {
    return path.join(this.basePath, _item.type, `${_item.id}.json`);
  }

  // CRUD Operations
  async create(
    type: StorageItem["type"],
    content: unknown,
    metadata?: Partial<StorageItem["metadata"]>,
  ): Promise<StorageItem> {
    await this.initialize();

    const _item: StorageItem = {
      id: this.generateId(),
      type,
      content,
      metadata: {
        _created: new Date().toISOString(),
        updated: new Date().toISOString(),
        version: 1,
        ...metadata,
      },
      checksum: this.calculateChecksum(content),
    };

    // Save to disk
    const _itemPath = this.getItemPath(_item);
    await fs.writeFile(_itemPath, JSON.stringify(_item, null, 2), "utf-8");

    // Update index
    this.index.set(_item.id, _item);
    await this.saveIndex();

    this.emit("_item-_created", _item);
    return _item;
  }

  async read(id: string): Promise<StorageItem | null> {
    await this.initialize();

    const _item = this.index.get(id);
    if (!_item) {
      return null;
    }

    // Load fresh from disk
    try {
      const _itemPath = this.getItemPath(_item);
      const _data = await fs.readFile(_itemPath, "utf-8");
      return JSON.parse(_data) as unknown as StorageItem;
    } catch (_error: unknown) {
      console._error(`Failed to read _item ${id}:`, _error);
      return null;
    }
  }

  async update(
    id: string,
    content: unknown,
    metadata?: Partial<StorageItem["metadata"]>,
  ): Promise<StorageItem | null> {
    await this.initialize();

    const _existing = await this.read(id);
    if (!_existing) {
      return null;
    }

    // Create backup before updating
    await this.createBackup(_existing);

    const updated: StorageItem = {
      ..._existing,
      content,
      metadata: {
        ..._existing.metadata,
        ...metadata,
        updated: new Date().toISOString(),
        version: _existing.metadata.version + 1,
      },
      checksum: this.calculateChecksum(content),
    };

    // Save to disk
    const _itemPath = this.getItemPath(updated);
    await fs.writeFile(_itemPath, JSON.stringify(updated, null, 2), "utf-8");

    // Update index
    this.index.set(id, updated);
    await this.saveIndex();

    this.emit("_item-updated", updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    await this.initialize();

    const _item = this.index.get(id);
    if (!_item) {
      return false;
    }

    // Create backup before deleting
    await this.createBackup(_item);

    // Delete from disk
    const _itemPath = this.getItemPath(_item);
    try {
      await fs.unlink(_itemPath);
    } catch (_error: unknown) {
      console._error(`Failed to delete file for ${id}:`, _error);
    }

    // Remove from index
    this.index.delete(id);
    await this.saveIndex();

    this.emit("_item-deleted", _item);
    return true;
  }

  // Query operations
  async query(query: StorageQuery): Promise<StorageItem[]> {
    await this.initialize();

    let results = Array.from(this.index.values());

    // Filter by type
    if (query.type) {
      results = results.filter((_item) => _item.type === query.type);
    }

    // Filter by tags
    if (query.tags && query.tags.length > 0) {
      results = results.filter((_item) =>
        query.tags!.some((tag) => _item.metadata.tags?.includes(tag)),
      );
    }

    // Filter by userId
    if (query.userId) {
      results = results.filter(
        (_item) => _item.metadata.userId === query.userId,
      );
    }

    // Sort
    const _orderBy = query._orderBy || "updated";
    const _order = query._order || "desc";
    results.sort((a, b) => {
      const _aVal = a.metadata[_orderBy];
      const _bVal = b.metadata[_orderBy];
      const _comparison = _aVal < _bVal ? -1 : _aVal > _bVal ? 1 : 0;
      return _order === "asc" ? _comparison : -_comparison;
    });

    // Pagination
    const _offset = query._offset || 0;
    const _limit = query._limit || 100;
    results = results.slice(_offset, _offset + _limit);

    return results;
  }

  // Backup operations
  private async createBackup(_item: StorageItem): Promise<void> {
    const _backupPath = path.join(
      this.basePath,
      "backups",
      `${_item.id}_${Date.now()}.json`,
    );
    await fs.writeFile(_backupPath, JSON.stringify(_item, null, 2), "utf-8");
  }

  async restoreFromBackup(
    _itemId: string,
    timestamp: number,
  ): Promise<boolean> {
    const _backupPath = path.join(
      this.basePath,
      "backups",
      `${_itemId}_${timestamp}.json`,
    );

    try {
      const _data = await fs.readFile(_backupPath, "utf-8");
      const _item = JSON.parse(_data) as unknown as StorageItem;

      // Restore to main storage
      const _itemPath = this.getItemPath(_item);
      await fs.writeFile(_itemPath, JSON.stringify(_item, null, 2), "utf-8");

      // Update index
      this.index.set(_item.id, _item);
      await this.saveIndex();

      return true;
    } catch (_error: unknown) {
      console._error("Failed to restore from backup:", _error);
      return false;
    }
  }

  // Batch operations
  async batchCreate(
    _items: Array<{
      type: StorageItem["type"];
      content: unknown;
      metadata?: Partial<StorageItem["metadata"]>;
    }>,
  ): Promise<StorageItem[]> {
    const results: StorageItem[] = [];
    for (const _item of _items) {
      const _created = await this.create(
        _item.type,
        _item.content,
        _item.metadata,
      );
      results.push(_created);
    }
    return results;
  }

  async batchDelete(ids: string[]): Promise<number> {
    let deletedCount = 0;
    for (const id of ids) {
      if (await this.delete(id)) {
        deletedCount++;
      }
    }
    return deletedCount;
  }

  // Export/Import
  async exportAll(): Promise<string> {
    await this.initialize();
    const _items = Array.from(this.index.values());
    return JSON.stringify(_items, null, 2);
  }

  async importData(jsonData: string): Promise<number> {
    await this.initialize();

    try {
      const _items = JSON.parse(jsonData) as unknown as StorageItem[];
      let importedCount = 0;

      for (const _item of _items) {
        const _itemPath = this.getItemPath(_item);
        await fs.writeFile(_itemPath, JSON.stringify(_item, null, 2), "utf-8");
        this.index.set(_item.id, _item);
        importedCount++;
      }

      await this.saveIndex();
      return importedCount;
    } catch (_error: unknown) {
      console._error("Failed to import _data:", _error);
      throw _error;
    }
  }

  // Statistics
  async getStats(): Promise<{
    totalItems: number;
    byType: Record<string, number>;
    storageSize: number;
  }> {
    await this.initialize();

    const byType: Record<string, number> = {};
    for (const _item of this.index.values()) {
      byType[_item.type] = (byType[_item.type] || 0) + 1;
    }

    // Calculate storage size
    let totalSize = 0;
    for (const _item of this.index.values()) {
      const _itemPath = this.getItemPath(_item);
      try {
        const _stats = await fs.stat(_itemPath);
        totalSize += _stats.size;
      } catch {
        // File might not exist
      }
    }

    return {
      totalItems: this.index.size,
      byType,
      storageSize: totalSize,
    };
  }

  // Cleanup old backups
  async cleanupBackups(daysToKeep: number = 30): Promise<number> {
    const _backupDir = path.join(this.basePath, "backups");
    const _files = await fs.readdir(_backupDir);
    const _cutoffTime = Date.now() - daysToKeep * 24 * 60 * 60 * 1000;
    let deletedCount = 0;

    for (const file of _files) {
      const _filePath = path.join(_backupDir, file);
      const _stats = await fs.stat(_filePath);

      if (_stats.mtimeMs < _cutoffTime) {
        await fs.unlink(_filePath);
        deletedCount++;
      }
    }

    return deletedCount;
  }
}

export const _localStorage = LocalStorageService.getInstance();
