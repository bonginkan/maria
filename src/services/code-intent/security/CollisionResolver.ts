/**
 * Collision Resolver
 * Handles filename conflicts with intelligent naming strategies
 */

import * as path from 'node:path';
import * as fs from 'node:fs';

export class CollisionResolver {
  private readonly maxAttempts = 999;
  
  /**
   * Resolves filename collisions using sequential numbering
   */
  resolve(targetPath: string): string {
    // If file doesn't exist, no collision
    if (!fs.existsSync(targetPath)) {
      return targetPath;
    }
    
    const dir = path.dirname(targetPath);
    const ext = path.extname(targetPath);
    const base = path.basename(targetPath, ext);
    
    // Try numbered versions (2) through (999)
    for (let i = 2; i <= this.maxAttempts; i++) {
      const candidate = path.join(dir, `${base} (${i})${ext}`);
      if (!fs.existsSync(candidate)) {
        return candidate;
      }
    }
    
    // Fallback to timestamp if all numbered versions exist
    return this.generateTimestampedPath(dir, base, ext);
  }
  
  /**
   * Resolves collision with a custom pattern
   */
  resolveWithPattern(targetPath: string, pattern: 'number' | 'timestamp' | 'hash'): string {
    if (!fs.existsSync(targetPath)) {
      return targetPath;
    }
    
    const dir = path.dirname(targetPath);
    const ext = path.extname(targetPath);
    const base = path.basename(targetPath, ext);
    
    switch (pattern) {
      case 'number':
        return this.resolve(targetPath);
      case 'timestamp':
        return this.generateTimestampedPath(dir, base, ext);
      case 'hash':
        return this.generateHashedPath(dir, base, ext);
      default:
        return this.resolve(targetPath);
    }
  }
  
  /**
   * Generates a timestamped filename
   */
  private generateTimestampedPath(dir: string, base: string, ext: string): string {
    const timestamp = new Date().toISOString()
      .replace(/[:.]/g, '-')
      .replace('T', '_')
      .slice(0, -5); // Remove milliseconds and Z
    
    const timestampedPath = path.join(dir, `${base}_${timestamp}${ext}`);
    
    // Check if even the timestamped version exists
    if (fs.existsSync(timestampedPath)) {
      // Add milliseconds for uniqueness
      const ms = Date.now() % 1000;
      return path.join(dir, `${base}_${timestamp}_${ms}${ext}`);
    }
    
    return timestampedPath;
  }
  
  /**
   * Generates a hashed filename using a short hash
   */
  private generateHashedPath(dir: string, base: string, ext: string): string {
    const hash = this.generateShortHash();
    return path.join(dir, `${base}_${hash}${ext}`);
  }
  
  /**
   * Generates a short hash for filename uniqueness
   */
  private generateShortHash(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let hash = '';
    for (let i = 0; i < 6; i++) {
      hash += chars[Math.floor(Math.random() * chars.length)];
    }
    return hash;
  }
  
  /**
   * Checks if a path would cause a collision
   */
  wouldCollide(targetPath: string): boolean {
    return fs.existsSync(targetPath);
  }
  
  /**
   * Gets all existing variations of a base filename
   */
  getExistingVariations(targetPath: string): string[] {
    const dir = path.dirname(targetPath);
    const ext = path.extname(targetPath);
    const base = path.basename(targetPath, ext);
    const variations: string[] = [];
    
    // Check base file
    if (fs.existsSync(targetPath)) {
      variations.push(targetPath);
    }
    
    // Check numbered variations
    for (let i = 2; i <= this.maxAttempts; i++) {
      const candidate = path.join(dir, `${base} (${i})${ext}`);
      if (fs.existsSync(candidate)) {
        variations.push(candidate);
      } else {
        // Stop checking once we find a gap
        break;
      }
    }
    
    return variations;
  }
  
  /**
   * Suggests the next available filename
   */
  suggestNext(targetPath: string): string {
    return this.resolve(targetPath);
  }
  
  /**
   * Cleans up old collision files based on age
   */
  cleanupOldCollisions(basePath: string, maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): number {
    const variations = this.getExistingVariations(basePath);
    const now = Date.now();
    let cleaned = 0;
    
    for (const file of variations) {
      try {
        const stats = fs.statSync(file);
        const age = now - stats.mtimeMs;
        
        if (age > maxAgeMs) {
          fs.unlinkSync(file);
          cleaned++;
        }
      } catch (error) {
        // Ignore errors for individual files
        console.warn(`Failed to clean up ${file}: ${error}`);
      }
    }
    
    return cleaned;
  }
}