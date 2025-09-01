/**
 * Metadata Manager for Help System
 * Handles loading, caching, and validation of help metadata
 */

import * as fs from "fs/promises";
import * as path from "path";
import { spawn } from "child_process";
import {
  CommandMeta,
  MetadataContainer,
  validateHelpMetadata,
  ValidationResult,
} from "./metadata-validator";

export class MetadataManager {
  private cache?: MetadataContainer;
  private cacheTime?: number;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly STALE_WARNING_MS = 7 * 86400000; // 7 days
  private readonly metaPath: string;

  constructor(metaPath?: string) {
    this.metaPath =
      metaPath ?? path.resolve("src/slash-commands/help/command-meta.json");
  }

  async load(): Promise<MetadataContainer> {
    // Memory cache hit
    if (
      this.cache &&
      this.cacheTime &&
      Date.now() - this.cacheTime < this.CACHE_TTL
    ) {
      return this.cache;
    }

    try {
      // Load from disk
      const meta = await this.loadFromDisk();

      // Validate
      const validation = validateHelpMetadata(meta, {
        expectedSchemaVersion: 1,
      });
      if (!validation.ok) {
        console.error("[help] Metadata validation failed:", validation.errors);
        throw new Error("Invalid metadata structure");
      }

      // Show warnings
      if (validation.warnings.length > 0) {
        for (const warning of validation.warnings) {
          console.warn(`[help] Warning: ${warning}`);
        }
      }

      // Staleness check
      const age = Date.now() - new Date(meta.generatedAt).getTime();
      if (age > this.STALE_WARNING_MS) {
        console.warn(
          "[help] Metadata stale (7d+), consider running: npx tsx scripts/generate-help-meta.ts",
        );
        this.triggerBackgroundRegeneration();
      }

      // Cache
      this.cache = meta;
      this.cacheTime = Date.now();
      return meta;
    } catch (error) {
      console.error("[help] Failed to load metadata:", error);
      throw new Error(
        `Metadata loading failed: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  private async loadFromDisk(): Promise<MetadataContainer> {
    const text = await fs.readFile(this.metaPath, "utf8");
    const data = JSON.parse(text);

    // Handle both direct command array and container format
    if (Array.isArray(data)) {
      return {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        generatorVersion: "legacy",
        commands: data,
        stats: {
          totalCommands: data.length,
          totalCategories: new Set(data.map((c) => c.category)).size,
          lastUpdated: new Date().toISOString(),
        },
      };
    }

    return data as MetadataContainer;
  }

  hasStaleCache(): boolean {
    return !!this.cache;
  }

  getStaleCache(): MetadataContainer | undefined {
    return this.cache;
  }

  private triggerBackgroundRegeneration(): void {
    // Fire and forget background regeneration
    try {
      const child = spawn("npx", ["tsx", "scripts/generate-help-meta.ts"], {
        detached: true,
        stdio: "ignore",
      });
      child.unref();
      console.log("[help] Background metadata regeneration triggered");
    } catch (error) {
      console.warn("[help] Failed to trigger background regeneration:", error);
    }
  }

  /**
   * Build compact JSON for non-TTY output
   */
  buildCompactJson(metas: CommandMeta[]): any {
    const byCat = new Map<string, CommandMeta[]>();
    for (const m of metas) {
      if (m.level === "hidden") continue; // 非TTYでは既定で hidden 除外
      const arr = byCat.get(m.category) || [];
      arr.push(m);
      byCat.set(m.category, arr);
    }

    const categories: any[] = [];
    for (const [cat, arr] of byCat) {
      const primaries = arr
        .filter((x) => x.level === "primary" && !x.parent)
        .sort(
          (a, b) =>
            (a.rank ?? 1e9) - (b.rank ?? 1e9) || a.name.localeCompare(b.name),
        );

      const top = primaries.slice(0, 3).map((p) => ({
        name: p.name,
        title: p.title,
      }));
      const more = Math.max(0, primaries.length - top.length);

      categories.push({
        category: cat,
        total: arr.length,
        top,
        more,
      });
    }

    categories.sort((a, b) => a.category.localeCompare(b.category));

    return {
      mode: "compact-json",
      timestamp: new Date().toISOString(),
      categories,
    };
  }
}
