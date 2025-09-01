/**
 * Path Security Validator
 * Ensures all file paths are safe and within project boundaries
 */

import * as path from 'node:path';
import * as fs from 'node:fs';
import { SecurityError } from '../types/filename-inference.types';

export class PathSecurityValidator {
  private readonly projectRoot: string;
  private readonly winReserved = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
  
  constructor(projectRoot: string) {
    this.projectRoot = path.resolve(projectRoot);
  }
  
  /**
   * Validates and normalizes a file path, ensuring it's safe to use
   */
  validateAndNormalize(userPath: string): string {
    // 0. Handle empty or undefined input
    if (!userPath) {
      throw new SecurityError('Path cannot be empty');
    }
    
    // 1. First detect obvious Unix path traversal attempts with ../ 
    if (userPath.includes('../')) {
      throw new SecurityError(`Path traversal detected`);
    }
    
    // 2. Sanitize dangerous characters
    const sanitized = this.sanitizePath(userPath);
    
    // 3. Resolve to absolute path within project root
    const absolute = path.resolve(this.projectRoot, sanitized);
    
    // 4. Get canonical path (resolves symlinks)
    let canonical: string;
    try {
      // For existing paths, get real path
      if (fs.existsSync(absolute)) {
        canonical = fs.realpathSync.native(absolute);
      } else {
        // For new files, check if parent exists
        const parentDir = path.dirname(absolute);
        if (fs.existsSync(parentDir)) {
          const realParent = fs.realpathSync.native(parentDir);
          canonical = path.join(realParent, path.basename(absolute));
        } else {
          // Parent doesn't exist yet, use the normalized absolute path
          // This is safe because we'll check if it's within root next
          canonical = path.normalize(absolute);
        }
      }
    } catch (error) {
      // If there's any error with real path resolution, use normalized path
      canonical = path.normalize(absolute);
    }
    
    // 5. Ensure path is within project root
    if (!this.isWithinRoot(canonical)) {
      throw new SecurityError(`Path traversal detected`);
    }
    
    // 6. OS-specific validations
    this.validateOSSpecific(canonical);
    
    // 7. Check path length limits after resolution
    if (process.platform === 'win32' && canonical.length > 260) {
      throw new SecurityError(`Path too long for Windows: ${canonical.length} characters`);
    } else if (canonical.length > 4096) {
      throw new SecurityError(`Path too long: ${canonical.length} characters`);
    }
    
    return canonical;
  }
  
  /**
   * Sanitizes a path by removing dangerous characters
   */
  private sanitizePath(filepath: string): string {
    // Remove null bytes and control characters
    let cleaned = filepath.replace(/[\x00-\x1F]/g, '_');
    
    // Remove dangerous path traversal patterns
    cleaned = cleaned.replace(/\.\.[\/\\]/g, '');
    cleaned = cleaned.replace(/^\.\.$/g, '_');
    
    // Handle absolute paths - convert to relative
    if (cleaned.startsWith('/')) {
      // Unix absolute path - take everything after leading slash
      cleaned = cleaned.substring(1);
    } else if (cleaned.match(/^[A-Za-z]:/)) {
      // Windows absolute path - take everything after the drive letter
      cleaned = cleaned.substring(3).replace(/^\\/g, '');
    }
    
    // Replace dangerous characters for filenames
    const parts = cleaned.split(/[\/\\]/);
    const sanitizedParts = parts.map(part => part.replace(/[<>:"|?*]/g, '_'));
    
    return sanitizedParts.filter(p => p).join(path.sep);
  }
  
  /**
   * Checks if a path is within the project root
   */
  private isWithinRoot(filepath: string): boolean {
    // Normalize paths for comparison
    const normalizedRoot = path.resolve(this.projectRoot);
    const normalizedPath = path.resolve(filepath);
    
    // Check if the normalized path starts with the normalized root
    const relative = path.relative(normalizedRoot, normalizedPath);
    
    // Path is within root if:
    // 1. It doesn't start with ..
    // 2. It's not an absolute path outside the root
    return !relative.startsWith('..') && !path.isAbsolute(relative);
  }
  
  /**
   * Performs OS-specific path validations
   */
  private validateOSSpecific(filepath: string): void {
    const basename = path.basename(filepath, path.extname(filepath));
    
    // Windows reserved names
    if (process.platform === 'win32') {
      if (this.winReserved.includes(basename.toUpperCase())) {
        throw new SecurityError(`Reserved filename on Windows: ${basename}`);
      }
    }
    
    // macOS unicode normalization warning
    if (process.platform === 'darwin') {
      const fullBasename = path.basename(filepath);
      const nfc = fullBasename.normalize('NFC');
      const nfd = fullBasename.normalize('NFD');
      if (nfc !== nfd) {
        console.warn(`Unicode normalization may cause issues: ${fullBasename}`);
      }
    }
  }
  
  /**
   * Validates a filename without path components
   */
  validateFilename(filename: string): boolean {
    // Check for empty or whitespace-only
    if (!filename || !filename.trim()) {
      return false;
    }
    
    // Check for path traversal attempts
    if (filename.includes('../') || filename.includes('..\\')) {
      return false;
    }
    
    // Check for absolute paths
    if (filename.startsWith('/') || filename.match(/^[A-Za-z]:/)) {
      return false;
    }
    
    // Check for dangerous characters
    if (/[<>:"|?*\x00-\x1F]/.test(filename)) {
      return false;
    }
    
    // Check for Windows reserved names
    const nameWithoutExt = path.basename(filename, path.extname(filename));
    if (process.platform === 'win32' && this.winReserved.includes(nameWithoutExt.toUpperCase())) {
      return false;
    }
    
    return true;
  }
}