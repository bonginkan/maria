/**
 * UsageStore - Tracks model usage history for intelligent sorting
 */

import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { UsageRecord } from "../types";

export class UsageStore {
  private file: string;
  private records = new Map<string, UsageRecord>();
  private loaded = false;
  private readonly maxRecords = 1000; // Prevent unlimited growth

  constructor(filename = "usage-models.json") {
    const dir = path.join(os.homedir(), ".maria");
    this.file = path.join(dir, filename);
  }

  /**
   * Load usage records from disk
   */
  async load(): Promise<void> {
    if (this.loaded) return;

    try {
      const data = await fs.readFile(this.file, "utf8");
      const recordList = JSON.parse(data) as UsageRecord[];

      this.records = new Map(
        recordList.map((record) => [record.modelId, record]),
      );
    } catch (error) {
      // First run or corrupted file - start with empty records
      this.records = new Map();
    }

    this.loaded = true;
  }

  /**
   * Save usage records to disk
   */
  async save(): Promise<void> {
    try {
      const dir = path.dirname(this.file);
      await fs.mkdir(dir, { recursive: true });

      // Sort by last used and keep only top records to prevent unlimited growth
      const recordList = Array.from(this.records.values())
        .sort((a, b) => b.lastUsedAt - a.lastUsedAt)
        .slice(0, this.maxRecords);

      await fs.writeFile(this.file, JSON.stringify(recordList, null, 2));
    } catch (error) {
      // Silent fail - don't break UI for storage issues
      console.warn("Failed to save usage records:", error);
    }
  }

  /**
   * Record usage of a model
   */
  async record(modelId: string): Promise<void> {
    const now = Date.now();
    const existing = this.records.get(modelId);

    if (existing) {
      existing.count++;
      existing.lastUsedAt = now;
    } else {
      this.records.set(modelId, {
        modelId,
        count: 1,
        lastUsedAt: now,
        firstUsedAt: now,
      });
    }

    // Save asynchronously to avoid blocking
    this.save().catch(() => {
      // Silent fail - usage tracking shouldn't break the UI
    });
  }

  /**
   * Get usage record for a model
   */
  get(modelId: string): UsageRecord | undefined {
    return this.records.get(modelId);
  }

  /**
   * Calculate recency score for sorting
   * Higher score = more recent/frequent usage
   */
  getRecentScore(modelId: string): number {
    const record = this.records.get(modelId);
    if (!record) return 0;

    const ageInSeconds = Math.max(1, (Date.now() - record.lastUsedAt) / 1000);
    const recencyScore = 1000000 / ageInSeconds; // Recent usage gets higher score
    const frequencyScore = Math.min(1000, record.count * 10); // Cap frequency bonus

    return recencyScore + frequencyScore;
  }

  /**
   * Get most recently used models
   */
  getMostRecent(limit = 10): UsageRecord[] {
    return Array.from(this.records.values())
      .sort((a, b) => b.lastUsedAt - a.lastUsedAt)
      .slice(0, limit);
  }

  /**
   * Get most frequently used models
   */
  getMostFrequent(limit = 10): UsageRecord[] {
    return Array.from(this.records.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Get usage statistics
   */
  getStats(): { totalModels: number; totalUsage: number; avgUsage: number } {
    const records = Array.from(this.records.values());
    const totalUsage = records.reduce((sum, record) => sum + record.count, 0);

    return {
      totalModels: records.length,
      totalUsage,
      avgUsage: records.length > 0 ? totalUsage / records.length : 0,
    };
  }

  /**
   * Format last used time for display
   */
  formatLastUsed(modelId: string): string {
    const record = this.records.get(modelId);
    if (!record) return "Never";

    const now = Date.now();
    const diff = now - record.lastUsedAt;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    if (seconds > 5) return `${seconds}s ago`;
    return "Just now";
  }

  /**
   * Clear all usage records
   */
  async clear(): Promise<void> {
    this.records.clear();
    await this.save();
  }
}
