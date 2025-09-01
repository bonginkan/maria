/**
 * PromptCache - LRU cache for generated code with automatic expiration
 * Provides instant responses for repeated prompts
 */

import { createHash } from "crypto";

export interface CacheEntry {
  prompt: string;
  code: string;
  timestamp: number;
  hits: number;
  hash: string;
}

export interface CacheOptions {
  maxSize?: number; // Maximum number of entries
  ttlMs?: number; // Time to live in milliseconds
  maxMemoryMB?: number; // Maximum memory usage in MB
}

/**
 * LRU cache for prompt-to-code mappings
 */
export class PromptCache {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly maxSize: number;
  private readonly ttlMs: number;
  private readonly maxMemoryMB: number;
  private currentMemoryMB = 0;
  private hits = 0;
  private misses = 0;

  constructor(options: CacheOptions = {}) {
    this.maxSize = options.maxSize || 100;
    this.ttlMs = options.ttlMs || 15 * 60 * 1000; // 15 minutes default
    this.maxMemoryMB = options.maxMemoryMB || 50;
  }

  /**
   * Get cached code for a prompt
   */
  get(prompt: string): string | null {
    const hash = this.hashPrompt(prompt);
    const entry = this.cache.get(hash);

    if (!entry) {
      this.misses++;
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(hash);
      this.misses++;
      return null;
    }

    // Move to end (LRU)
    this.cache.delete(hash);
    this.cache.set(hash, entry);

    // Update hit count
    entry.hits++;
    this.hits++;

    return entry.code;
  }

  /**
   * Cache generated code for a prompt
   */
  set(prompt: string, code: string): void {
    const hash = this.hashPrompt(prompt);

    // Calculate memory usage (rough estimate)
    const entrySize = (prompt.length + code.length) * 2; // UTF-16 chars
    const entryMB = entrySize / (1024 * 1024);

    // Check memory limit
    if (this.currentMemoryMB + entryMB > this.maxMemoryMB) {
      this.evictLRU();
    }

    // Check size limit
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    // Add/update entry
    const entry: CacheEntry = {
      prompt,
      code,
      timestamp: Date.now(),
      hits: 0,
      hash,
    };

    // If updating, remove old memory calculation
    if (this.cache.has(hash)) {
      const oldEntry = this.cache.get(hash)!;
      const oldSize = (oldEntry.prompt.length + oldEntry.code.length) * 2;
      this.currentMemoryMB -= oldSize / (1024 * 1024);
    }

    this.cache.set(hash, entry);
    this.currentMemoryMB += entryMB;
  }

  /**
   * Check if a prompt is cached
   */
  has(prompt: string): boolean {
    const hash = this.hashPrompt(prompt);
    const entry = this.cache.get(hash);

    if (!entry) return false;

    // Check expiration
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(hash);
      return false;
    }

    return true;
  }

  /**
   * Clear the entire cache
   */
  clear(): void {
    this.cache.clear();
    this.currentMemoryMB = 0;
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Remove expired entries
   */
  prune(): number {
    const now = Date.now();
    let removed = 0;

    for (const [hash, entry] of this.cache) {
      if (now - entry.timestamp > this.ttlMs) {
        const entrySize = (entry.prompt.length + entry.code.length) * 2;
        this.currentMemoryMB -= entrySize / (1024 * 1024);
        this.cache.delete(hash);
        removed++;
      }
    }

    return removed;
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    const firstKey = this.cache.keys().next().value;
    if (firstKey) {
      const entry = this.cache.get(firstKey)!;
      const entrySize = (entry.prompt.length + entry.code.length) * 2;
      this.currentMemoryMB -= entrySize / (1024 * 1024);
      this.cache.delete(firstKey);
    }
  }

  /**
   * Hash a prompt for consistent cache keys
   */
  private hashPrompt(prompt: string): string {
    // Normalize prompt: lowercase, trim, remove extra spaces
    const normalized = prompt.toLowerCase().trim().replace(/\s+/g, " ");

    return createHash("sha256")
      .update(normalized)
      .digest("hex")
      .substring(0, 16); // Use first 16 chars for shorter keys
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    hits: number;
    misses: number;
    hitRate: number;
    memoryMB: number;
    oldestEntryAge: number;
    mostUsedPrompts: Array<{ prompt: string; hits: number }>;
  } {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? this.hits / total : 0;

    let oldestAge = 0;
    const now = Date.now();
    const prompts: Array<{ prompt: string; hits: number }> = [];

    for (const entry of this.cache.values()) {
      const age = now - entry.timestamp;
      if (age > oldestAge) {
        oldestAge = age;
      }
      prompts.push({ prompt: entry.prompt, hits: entry.hits });
    }

    // Sort by hits and get top 5
    prompts.sort((a, b) => b.hits - a.hits);
    const mostUsedPrompts = prompts.slice(0, 5);

    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate,
      memoryMB: this.currentMemoryMB,
      oldestEntryAge: oldestAge,
      mostUsedPrompts,
    };
  }

  /**
   * Export cache to JSON for persistence
   */
  toJSON(): string {
    const entries = Array.from(this.cache.values());
    return JSON.stringify(
      {
        entries,
        stats: this.getStats(),
        timestamp: Date.now(),
      },
      null,
      2,
    );
  }

  /**
   * Import cache from JSON
   */
  fromJSON(json: string): void {
    try {
      const data = JSON.parse(json);
      this.clear();

      if (data.entries && Array.isArray(data.entries)) {
        for (const entry of data.entries) {
          // Only import non-expired entries
          if (Date.now() - entry.timestamp < this.ttlMs) {
            this.cache.set(entry.hash, entry);
            const entrySize = (entry.prompt.length + entry.code.length) * 2;
            this.currentMemoryMB += entrySize / (1024 * 1024);
          }
        }
      }
    } catch (error) {
      console.error("Failed to import cache:", error);
    }
  }

  /**
   * Warm up cache with common prompts
   */
  warmUp(entries: Array<{ prompt: string; code: string }>): void {
    for (const { prompt, code } of entries) {
      this.set(prompt, code);
    }
  }
}

/**
 * Create singleton instance
 */
export const promptCache = new PromptCache();
