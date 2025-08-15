/**
 * Local Storage Service - OSS-ready replacement for external storage
 * Replaces Firebase, GCP Storage, and other cloud dependencies
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { EventEmitter } from 'events';

export interface StorageItem {
  id: string;
  type: 'chat' | 'paper' | 'slide' | 'project' | 'config' | 'memory';
  content: unknown;
  metadata: {
    created: string;
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
  limit?: number;
  offset?: number;
  orderBy?: 'created' | 'updated';
  order?: 'asc' | 'desc';
}

export class LocalStorageService extends EventEmitter {
  private static instance: LocalStorageService;
  private readonly basePath: string;
  private readonly indexPath: string;
  private index: Map<string, StorageItem> = new Map();
  private isInitialized = false;

  private constructor() {
    super();
    const homeDir = process.env['HOME'] || process.env['USERPROFILE'] || '';
    this.basePath = path.join(homeDir, '.maria', 'storage');
    this.indexPath = path.join(this.basePath, 'index.json');
  }

  static getInstance(): LocalStorageService {
    if (!LocalStorageService.instance) {
      LocalStorageService.instance = new LocalStorageService();
    }
    return LocalStorageService.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Create storage directories
      await fs.mkdir(this.basePath, { recursive: true });
      await fs.mkdir(path.join(this.basePath, 'chat'), { recursive: true });
      await fs.mkdir(path.join(this.basePath, 'papers'), { recursive: true });
      await fs.mkdir(path.join(this.basePath, 'slides'), { recursive: true });
      await fs.mkdir(path.join(this.basePath, 'projects'), { recursive: true });
      await fs.mkdir(path.join(this.basePath, 'config'), { recursive: true });
      await fs.mkdir(path.join(this.basePath, 'memory'), { recursive: true });
      await fs.mkdir(path.join(this.basePath, 'backups'), { recursive: true });

      // Load index
      await this.loadIndex();
      this.isInitialized = true;
      this.emit('initialized');
    } catch (error: unknown) {
      console.error('Failed to initialize local storage:', error);
      throw error;
    }
  }

  private async loadIndex(): Promise<void> {
    try {
      const indexData = await fs.readFile(this.indexPath, 'utf-8');
      const items = JSON.parse(indexData) as unknown as StorageItem[];
      this.index = new Map(items.map((item) => [item.id, item]));
    } catch (error: unknown) {
      // Index doesn't exist yet, start fresh
      this.index = new Map();
    }
  }

  private async saveIndex(): Promise<void> {
    const items = Array.from(this.index.values());
    await fs.writeFile(this.indexPath, JSON.stringify(items, null, 2), 'utf-8');
  }

  private generateId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  private calculateChecksum(content: unknown): string {
    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify(content));
    return hash.digest('hex');
  }

  private getItemPath(item: StorageItem): string {
    return path.join(this.basePath, item.type, `${item.id}.json`);
  }

  // CRUD Operations
  async create(
    type: StorageItem['type'],
    content: unknown,
    metadata?: Partial<StorageItem['metadata']>,
  ): Promise<StorageItem> {
    await this.initialize();

    const item: StorageItem = {
      id: this.generateId(),
      type,
      content,
      metadata: {
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        version: 1,
        ...metadata,
      },
      checksum: this.calculateChecksum(content),
    };

    // Save to disk
    const itemPath = this.getItemPath(item);
    await fs.writeFile(itemPath, JSON.stringify(item, null, 2), 'utf-8');

    // Update index
    this.index.set(item.id, item);
    await this.saveIndex();

    this.emit('item-created', item);
    return item;
  }

  async read(id: string): Promise<StorageItem | null> {
    await this.initialize();

    const item = this.index.get(id);
    if (!item) return null;

    // Load fresh from disk
    try {
      const itemPath = this.getItemPath(item);
      const data = await fs.readFile(itemPath, 'utf-8');
      return JSON.parse(data) as unknown as StorageItem;
    } catch (error: unknown) {
      console.error(`Failed to read item ${id}:`, error);
      return null;
    }
  }

  async update(
    id: string,
    content: unknown,
    metadata?: Partial<StorageItem['metadata']>,
  ): Promise<StorageItem | null> {
    await this.initialize();

    const existing = await this.read(id);
    if (!existing) return null;

    // Create backup before updating
    await this.createBackup(existing);

    const updated: StorageItem = {
      ...existing,
      content,
      metadata: {
        ...existing.metadata,
        ...metadata,
        updated: new Date().toISOString(),
        version: existing.metadata.version + 1,
      },
      checksum: this.calculateChecksum(content),
    };

    // Save to disk
    const itemPath = this.getItemPath(updated);
    await fs.writeFile(itemPath, JSON.stringify(updated, null, 2), 'utf-8');

    // Update index
    this.index.set(id, updated);
    await this.saveIndex();

    this.emit('item-updated', updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    await this.initialize();

    const item = this.index.get(id);
    if (!item) return false;

    // Create backup before deleting
    await this.createBackup(item);

    // Delete from disk
    const itemPath = this.getItemPath(item);
    try {
      await fs.unlink(itemPath);
    } catch (error: unknown) {
      console.error(`Failed to delete file for ${id}:`, error);
    }

    // Remove from index
    this.index.delete(id);
    await this.saveIndex();

    this.emit('item-deleted', item);
    return true;
  }

  // Query operations
  async query(query: StorageQuery): Promise<StorageItem[]> {
    await this.initialize();

    let results = Array.from(this.index.values());

    // Filter by type
    if (query.type) {
      results = results.filter((item) => item.type === query.type);
    }

    // Filter by tags
    if (query.tags && query.tags.length > 0) {
      results = results.filter((item) =>
        query.tags!.some((tag) => item.metadata.tags?.includes(tag)),
      );
    }

    // Filter by userId
    if (query.userId) {
      results = results.filter((item) => item.metadata.userId === query.userId);
    }

    // Sort
    const orderBy = query.orderBy || 'updated';
    const order = query.order || 'desc';
    results.sort((a, b) => {
      const aVal = a.metadata[orderBy];
      const bVal = b.metadata[orderBy];
      const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return order === 'asc' ? comparison : -comparison;
    });

    // Pagination
    const offset = query.offset || 0;
    const limit = query.limit || 100;
    results = results.slice(offset, offset + limit);

    return results;
  }

  // Backup operations
  private async createBackup(item: StorageItem): Promise<void> {
    const backupPath = path.join(this.basePath, 'backups', `${item.id}_${Date.now()}.json`);
    await fs.writeFile(backupPath, JSON.stringify(item, null, 2), 'utf-8');
  }

  async restoreFromBackup(itemId: string, timestamp: number): Promise<boolean> {
    const backupPath = path.join(this.basePath, 'backups', `${itemId}_${timestamp}.json`);

    try {
      const data = await fs.readFile(backupPath, 'utf-8');
      const item = JSON.parse(data) as unknown as StorageItem;

      // Restore to main storage
      const itemPath = this.getItemPath(item);
      await fs.writeFile(itemPath, JSON.stringify(item, null, 2), 'utf-8');

      // Update index
      this.index.set(item.id, item);
      await this.saveIndex();

      return true;
    } catch (error: unknown) {
      console.error('Failed to restore from backup:', error);
      return false;
    }
  }

  // Batch operations
  async batchCreate(
    items: Array<{
      type: StorageItem['type'];
      content: unknown;
      metadata?: Partial<StorageItem['metadata']>;
    }>,
  ): Promise<StorageItem[]> {
    const results: StorageItem[] = [];
    for (const item of items) {
      const created = await this.create(item.type, item.content, item.metadata);
      results.push(created);
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
    const items = Array.from(this.index.values());
    return JSON.stringify(items, null, 2);
  }

  async importData(jsonData: string): Promise<number> {
    await this.initialize();

    try {
      const items = JSON.parse(jsonData) as unknown as StorageItem[];
      let importedCount = 0;

      for (const item of items) {
        const itemPath = this.getItemPath(item);
        await fs.writeFile(itemPath, JSON.stringify(item, null, 2), 'utf-8');
        this.index.set(item.id, item);
        importedCount++;
      }

      await this.saveIndex();
      return importedCount;
    } catch (error: unknown) {
      console.error('Failed to import data:', error);
      throw error;
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
    for (const item of this.index.values()) {
      byType[item.type] = (byType[item.type] || 0) + 1;
    }

    // Calculate storage size
    let totalSize = 0;
    for (const item of this.index.values()) {
      const itemPath = this.getItemPath(item);
      try {
        const stats = await fs.stat(itemPath);
        totalSize += stats.size;
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
    const backupDir = path.join(this.basePath, 'backups');
    const files = await fs.readdir(backupDir);
    const cutoffTime = Date.now() - daysToKeep * 24 * 60 * 60 * 1000;
    let deletedCount = 0;

    for (const file of files) {
      const filePath = path.join(backupDir, file);
      const stats = await fs.stat(filePath);

      if (stats.mtimeMs < cutoffTime) {
        await fs.unlink(filePath);
        deletedCount++;
      }
    }

    return deletedCount;
  }
}

export const localStorage = LocalStorageService.getInstance();
