/**
 * Path Resolution Utility
 * Handles path resolution for project assets and files
 */

import * as path from "path";
import { DEFAULT_PATHS } from "../config/defaults";

export class PathResolver {
  private static projectRoot: string;

  /**
   * Get the project root directory
   */
  static getProjectRoot(): string {
    if (!this.projectRoot) {
      // __dirname から project root を見つける
      // TypeScriptの場合、__dirnameはdist/utils/になるので、2つ上のディレクトリがproject root
      this.projectRoot = path.resolve(dirname, "../..");
    }
    return this.projectRoot;
  }

  /**
   * Resolve relative path to absolute path from project root
   */
  static resolveAssetPath(relativePath: string): string {
    return path.resolve(this.getProjectRoot(), relativePath);
  }

  /**
   * Get avatar file path
   */
  static getAvatarPath(): string {
    return this.resolveAssetPath(DEFAULT_PATHS.avatar);
  }

  /**
   * Check if a file exists at the given relative path
   */
  static async fileExists(relativePath: string): Promise<boolean> {
    try {
      const fs = await import("fs/promises");
      const _fullPath = this.resolveAssetPath(relativePath);
      await fs.access(_fullPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get fallback path if primary path doesn't exist
   */
  static async getPathWithFallback(
    primaryPath: string,
    fallbackPath: string,
  ): Promise<string> {
    const _primaryExists = await this.fileExists(primaryPath);
    if (_primaryExists) {
      return this.resolveAssetPath(primaryPath);
    }
    return this.resolveAssetPath(fallbackPath);
  }
}
