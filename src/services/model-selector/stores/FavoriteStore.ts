/**
 * FavoriteStore - Persistent storage for favorite models
 */

import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

export class FavoriteStore {
  private file: string;
  private favorites = new Set<string>();
  private loaded = false;

  constructor(filename = "favorites-models.json") {
    const dir = path.join(os.homedir(), ".maria");
    this.file = path.join(dir, filename);
  }

  /**
   * Load favorites from disk
   */
  async load(): Promise<void> {
    if (this.loaded) return;

    try {
      const data = await fs.readFile(this.file, "utf8");
      const favoriteList = JSON.parse(data) as string[];
      this.favorites = new Set(favoriteList || []);
    } catch (error) {
      // First run or corrupted file - start with empty favorites
      this.favorites = new Set();
    }

    this.loaded = true;
  }

  /**
   * Save favorites to disk
   */
  async save(): Promise<void> {
    try {
      const dir = path.dirname(this.file);
      await fs.mkdir(dir, { recursive: true });

      const favoriteList = Array.from(this.favorites);
      await fs.writeFile(this.file, JSON.stringify(favoriteList, null, 2));
    } catch (error) {
      // Silent fail - don't break UI for storage issues
      console.warn("Failed to save favorites:", error);
    }
  }

  /**
   * Check if a model is favorited
   */
  has(modelId: string): boolean {
    return this.favorites.has(modelId);
  }

  /**
   * Add a model to favorites
   */
  async add(modelId: string): Promise<void> {
    this.favorites.add(modelId);
    await this.save();
  }

  /**
   * Remove a model from favorites
   */
  async remove(modelId: string): Promise<void> {
    this.favorites.delete(modelId);
    await this.save();
  }

  /**
   * Toggle favorite status
   */
  async toggle(modelId: string): Promise<boolean> {
    const wasFavorite = this.favorites.has(modelId);

    if (wasFavorite) {
      await this.remove(modelId);
    } else {
      await this.add(modelId);
    }

    return !wasFavorite; // Return new state
  }

  /**
   * Get all favorite model IDs
   */
  list(): string[] {
    return Array.from(this.favorites);
  }

  /**
   * Get count of favorites
   */
  count(): number {
    return this.favorites.size;
  }

  /**
   * Clear all favorites
   */
  async clear(): Promise<void> {
    this.favorites.clear();
    await this.save();
  }
}
