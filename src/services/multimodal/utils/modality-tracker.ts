/**
 * Hybrid modality tracker using WeakMap for memory safety and Map for searchability
 */

import type { ModalityType, ProcessedOutput } from "../core/types";

export interface TrackerMetrics {
  weakMapInfo: string;
  timedMapSize: number;
  expiredCount: number;
  hitRate: number;
}

/**
 * Tracks modality types for processed outputs
 * Uses WeakMap to prevent memory leaks and timed Map for ID-based lookups
 */
export class ModalityTracker {
  // WeakMap for memory-safe storage (outputs can be GC'd)
  private weakMap = new WeakMap<ProcessedOutput, ModalityType>();

  // Map with TTL for ID-based lookups
  private timedMap = new Map<
    string,
    {
      modality: ModalityType;
      expires: number;
      accessCount: number;
    }
  >();

  // Configuration
  private readonly ttlMs: number;
  private readonly maxSize: number;
  private cleanupInterval: NodeJS.Timeout | null = null;

  // Metrics
  private totalHits = 0;
  private totalMisses = 0;
  private totalExpired = 0;

  constructor(
    options: {
      ttlMs?: number;
      maxSize?: number;
      autoCleanup?: boolean;
    } = {},
  ) {
    this.ttlMs = options.ttlMs ?? 5 * 60 * 1000; // 5 minutes default
    this.maxSize = options.maxSize ?? 10000; // 10k entries max

    if (options.autoCleanup !== false) {
      this.startAutoCleanup();
    }
  }

  /**
   * Store a modality for an output
   */
  set(output: ProcessedOutput, modality: ModalityType): void {
    // Store in WeakMap
    this.weakMap.set(output, modality);

    // Store in timed Map
    this.timedMap.set(output.id, {
      modality,
      expires: Date.now() + this.ttlMs,
      accessCount: 0,
    });

    // Enforce size limit
    if (this.timedMap.size > this.maxSize) {
      this.evictOldest();
    }
  }

  /**
   * Get modality by output object (uses WeakMap)
   */
  getByOutput(output: ProcessedOutput): ModalityType | undefined {
    const modality = this.weakMap.get(output);
    if (modality) {
      this.totalHits++;
      // Update access count in timed map if exists
      const entry = this.timedMap.get(output.id);
      if (entry) {
        entry.accessCount++;
      }
    } else {
      this.totalMisses++;
    }
    return modality;
  }

  /**
   * Get modality by output ID (uses timed Map)
   */
  getById(outputId: string): ModalityType | undefined {
    const entry = this.timedMap.get(outputId);

    if (!entry) {
      this.totalMisses++;
      return undefined;
    }

    // Check expiry
    if (entry.expires <= Date.now()) {
      this.timedMap.delete(outputId);
      this.totalExpired++;
      this.totalMisses++;
      return undefined;
    }

    // Update access count and return
    entry.accessCount++;
    this.totalHits++;
    return entry.modality;
  }

  /**
   * Check if an output ID exists and is not expired
   */
  has(outputId: string): boolean {
    const entry = this.timedMap.get(outputId);
    if (!entry) return false;

    if (entry.expires <= Date.now()) {
      this.timedMap.delete(outputId);
      this.totalExpired++;
      return false;
    }

    return true;
  }

  /**
   * Remove expired entries
   */
  cleanExpired(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [id, entry] of this.timedMap) {
      if (entry.expires <= now) {
        this.timedMap.delete(id);
        cleaned++;
      }
    }

    this.totalExpired += cleaned;
    return cleaned;
  }

  /**
   * Evict least recently used entries
   */
  private evictOldest(): void {
    // Sort by access count and expiry
    const entries = Array.from(this.timedMap.entries()).sort((a, b) => {
      // First by access count
      if (a[1].accessCount !== b[1].accessCount) {
        return a[1].accessCount - b[1].accessCount;
      }
      // Then by expiry time
      return a[1].expires - b[1].expires;
    });

    // Remove 10% of oldest entries
    const toRemove = Math.ceil(entries.length * 0.1);
    for (let i = 0; i < toRemove && i < entries.length; i++) {
      this.timedMap.delete(entries[i][0]);
    }
  }

  /**
   * Start automatic cleanup interval
   */
  private startAutoCleanup(): void {
    if (this.cleanupInterval) return;

    // Clean every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanExpired();
    }, 60 * 1000);

    // Ensure interval doesn't prevent process exit
    if (typeof this.cleanupInterval.unref === "function") {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Stop automatic cleanup
   */
  stopAutoCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.timedMap.clear();
    // WeakMap will be GC'd automatically
    this.totalHits = 0;
    this.totalMisses = 0;
    this.totalExpired = 0;
  }

  /**
   * Get tracker metrics
   */
  getMetrics(): TrackerMetrics {
    const totalAccess = this.totalHits + this.totalMisses;
    return {
      weakMapInfo: "WeakMap (size not available)",
      timedMapSize: this.timedMap.size,
      expiredCount: this.totalExpired,
      hitRate: totalAccess > 0 ? this.totalHits / totalAccess : 0,
    };
  }

  /**
   * Get detailed statistics
   */
  getDetailedStats(): {
    metrics: TrackerMetrics;
    topAccessed: Array<{
      id: string;
      modality: ModalityType;
      accessCount: number;
    }>;
    expiringNext: Array<{ id: string; expiresIn: number }>;
  } {
    const now = Date.now();

    // Get top 10 most accessed
    const topAccessed = Array.from(this.timedMap.entries())
      .sort((a, b) => b[1].accessCount - a[1].accessCount)
      .slice(0, 10)
      .map(([id, entry]) => ({
        id,
        modality: entry.modality,
        accessCount: entry.accessCount,
      }));

    // Get 10 expiring next
    const expiringNext = Array.from(this.timedMap.entries())
      .filter(([_, entry]) => entry.expires > now)
      .sort((a, b) => a[1].expires - b[1].expires)
      .slice(0, 10)
      .map(([id, entry]) => ({
        id,
        expiresIn: entry.expires - now,
      }));

    return {
      metrics: this.getMetrics(),
      topAccessed,
      expiringNext,
    };
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.stopAutoCleanup();
    this.clear();
  }
}
