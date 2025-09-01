/**
 * QuickPersistence Service
 * Lightweight JSONL-based memory persistence for Phase 0
 */

import * as fs from "fs";
import * as fsp from "fs/promises";
import * as os from "os";
import * as path from "path";
import { createHash } from "crypto";

export type Importance = "low" | "normal" | "high";

export interface StoredMemory {
  id: string;
  userId: string;
  content: string;
  tags: string[];
  importance: Importance;
  createdAt: string; // ISO
  lastAccessAt?: string;
  accessCount?: number;
  contentHash: string; // SHA256
}

export interface RecallQuery {
  q: string;
  limit?: number;
  tags?: string[];
  userId: string;
}

const DIR = path.join(os.homedir(), ".maria", "memory");
const FILE = path.join(DIR, "memories.jsonl");

export class QuickPersistence {
  static async init(): Promise<void> {
    await fsp.mkdir(DIR, { recursive: true });
    if (!fs.existsSync(FILE)) {
      await fsp.writeFile(FILE, "");
    }
  }

  static hash(text: string): string {
    return createHash("sha256").update(text).digest("hex");
  }

  static async save(
    mem: Omit<StoredMemory, "id" | "contentHash" | "createdAt" | "accessCount">,
  ): Promise<StoredMemory> {
    await this.init();

    // Check for duplicates via content hash
    const contentHash = this.hash(mem.content);
    const existing = await this.findByHash(contentHash, mem.userId);

    if (existing) {
      // Update access count and return existing
      existing.accessCount = (existing.accessCount ?? 0) + 1;
      existing.lastAccessAt = new Date().toISOString();
      await this.updateMemory(existing);
      return existing;
    }

    const record: StoredMemory = {
      ...mem,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      contentHash,
      createdAt: new Date().toISOString(),
      accessCount: 0,
    };

    await fsp.appendFile(FILE, JSON.stringify(record) + "\n", "utf8");
    return record;
  }

  static async recall(q: RecallQuery): Promise<StoredMemory[]> {
    await this.init();
    const raw = await fsp.readFile(FILE, "utf8");
    const rows = raw.trim()
      ? raw
          .trim()
          .split("\n")
          .map((l) => JSON.parse(l) as StoredMemory)
      : [];
    const needle = q.q.toLowerCase();

    let res = rows.filter(
      (r) =>
        r.userId === q.userId &&
        (r.content.toLowerCase().includes(needle) ||
          r.tags.some((t) => t.toLowerCase().includes(needle))),
    );

    if (q.tags?.length) {
      const tset = new Set(q.tags.map((t) => t.toLowerCase()));
      res = res.filter((r) => r.tags.some((t) => tset.has(t.toLowerCase())));
    }

    // Sort by importance and recency
    res.sort((a, b) => {
      // Importance first
      const impOrder = { high: 3, normal: 2, low: 1 };
      const aImp = impOrder[a.importance];
      const bImp = impOrder[b.importance];
      if (aImp !== bImp) return bImp - aImp;

      // Then by recency
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    if (q.limit) res = res.slice(0, q.limit);

    // Update access counts
    res.forEach((r) => {
      r.accessCount = (r.accessCount ?? 0) + 1;
      r.lastAccessAt = new Date().toISOString();
    });

    return res;
  }

  static async forget(
    pattern: string,
    userId: string,
    options?: { olderThan?: number },
  ): Promise<number> {
    await this.init();
    const raw = await fsp.readFile(FILE, "utf8");
    const rows = raw.trim()
      ? raw
          .trim()
          .split("\n")
          .map((l) => JSON.parse(l) as StoredMemory)
      : [];
    const keep: StoredMemory[] = [];
    const re = new RegExp(pattern, "i");

    let removed = 0;
    const cutoffDate = options?.olderThan
      ? new Date(Date.now() - options.olderThan * 24 * 60 * 60 * 1000)
      : null;

    for (const r of rows) {
      if (r.userId !== userId) {
        keep.push(r);
        continue;
      }

      // Check if matches pattern
      const matchesPattern =
        re.test(r.content) || r.tags.some((t) => re.test(t));

      // Check if older than cutoff
      const olderThanCutoff = cutoffDate
        ? new Date(r.createdAt) < cutoffDate
        : true;

      if (matchesPattern && olderThanCutoff) {
        removed++;
      } else {
        keep.push(r);
      }
    }

    // Rewrite file
    await fsp.writeFile(
      FILE,
      keep.map((o) => JSON.stringify(o)).join("\n") + (keep.length ? "\n" : ""),
    );
    return removed;
  }

  static async status(userId: string): Promise<{
    total: number;
    sizeKB: number;
    high: number;
    normal: number;
    low: number;
    tagsTop5: Array<[string, number]>;
    oldestMemory?: StoredMemory;
    newestMemory?: StoredMemory;
  }> {
    await this.init();
    const raw = await fsp.readFile(FILE, "utf8");
    const rows = raw.trim()
      ? raw
          .trim()
          .split("\n")
          .map((l) => JSON.parse(l) as StoredMemory)
      : [];
    const mine = rows.filter((r) => r.userId === userId);
    const bytes = Buffer.byteLength(mine.map(JSON.stringify).join("\n"));

    // Count by importance
    const byImportance = {
      high: mine.filter((r) => r.importance === "high").length,
      normal: mine.filter((r) => r.importance === "normal").length,
      low: mine.filter((r) => r.importance === "low").length,
    };

    // Top tags
    const tagCounts = mine
      .flatMap((m) => m.tags)
      .reduce(
        (acc, t) => {
          acc[t] = (acc[t] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

    const tagsTop5 = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5) as Array<[string, number]>;

    // Find oldest and newest
    const sorted = [...mine].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

    return {
      total: mine.length,
      sizeKB: Math.round(bytes / 102.4) / 10,
      ...byImportance,
      tagsTop5,
      oldestMemory: sorted[0],
      newestMemory: sorted[sorted.length - 1],
    };
  }

  static async export(
    userId: string,
    format: "json" | "jsonl" = "json",
  ): Promise<string> {
    await this.init();
    const raw = await fsp.readFile(FILE, "utf8");
    const rows = raw.trim()
      ? raw
          .trim()
          .split("\n")
          .map((l) => JSON.parse(l) as StoredMemory)
      : [];
    const mine = rows.filter((r) => r.userId === userId);

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `maria-memory-export-${timestamp}.${format}`;
    const exportDir = path.join(os.homedir(), ".maria", "exports");
    const exportPath = path.join(exportDir, filename);

    await fsp.mkdir(exportDir, { recursive: true });

    if (format === "jsonl") {
      await fsp.writeFile(
        exportPath,
        mine.map((m) => JSON.stringify(m)).join("\n"),
      );
    } else {
      await fsp.writeFile(
        exportPath,
        JSON.stringify(
          {
            exportDate: new Date().toISOString(),
            userId,
            count: mine.length,
            memories: mine,
          },
          null,
          2,
        ),
      );
    }

    return exportPath;
  }

  static async import(filepath: string, userId: string): Promise<number> {
    const content = await fsp.readFile(filepath, "utf8");
    let memories: StoredMemory[] = [];

    // Detect format
    if (filepath.endsWith(".jsonl")) {
      memories = content
        .trim()
        .split("\n")
        .map((l) => JSON.parse(l) as StoredMemory);
    } else {
      const data = JSON.parse(content);
      memories = data.memories || data;
    }

    let imported = 0;
    for (const mem of memories) {
      // Re-assign to current user and regenerate IDs
      await this.save({
        userId,
        content: mem.content,
        tags: mem.tags,
        importance: mem.importance,
        lastAccessAt: mem.lastAccessAt,
      });
      imported++;
    }

    return imported;
  }

  // Helper methods
  private static async findByHash(
    hash: string,
    userId: string,
  ): Promise<StoredMemory | null> {
    const raw = await fsp.readFile(FILE, "utf8");
    const rows = raw.trim()
      ? raw
          .trim()
          .split("\n")
          .map((l) => JSON.parse(l) as StoredMemory)
      : [];
    return (
      rows.find((r) => r.userId === userId && r.contentHash === hash) || null
    );
  }

  private static async updateMemory(memory: StoredMemory): Promise<void> {
    const raw = await fsp.readFile(FILE, "utf8");
    const rows = raw.trim()
      ? raw
          .trim()
          .split("\n")
          .map((l) => JSON.parse(l) as StoredMemory)
      : [];

    const index = rows.findIndex((r) => r.id === memory.id);
    if (index >= 0) {
      rows[index] = memory;
      await fsp.writeFile(
        FILE,
        rows.map((o) => JSON.stringify(o)).join("\n") + "\n",
      );
    }
  }

  static async clearAll(userId: string): Promise<void> {
    await this.init();
    const raw = await fsp.readFile(FILE, "utf8");
    const rows = raw.trim()
      ? raw
          .trim()
          .split("\n")
          .map((l) => JSON.parse(l) as StoredMemory)
      : [];
    const keep = rows.filter((r) => r.userId !== userId);
    await fsp.writeFile(
      FILE,
      keep.map((o) => JSON.stringify(o)).join("\n") + (keep.length ? "\n" : ""),
    );
  }
}
