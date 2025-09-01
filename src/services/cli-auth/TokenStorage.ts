/**
 * Secure Token Storage
 * Handles secure storage of authentication tokens with OS keychain fallback
 */

import { AuthTokens } from './types';
import os from 'os';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import crypto from 'crypto';

// Try to import optional dependencies
let keytar: any = null;
try {
  keytar = require('keytar');
} catch {
  // keytar not available, use file fallback
}

export class TokenStorage {
  private readonly SERVICE_NAME = 'maria-cli';
  private readonly ACCOUNT_NAME = 'default';
  private readonly CONFIG_DIR = path.join(os.homedir(), '.maria');
  private readonly TOKEN_FILE = path.join(this.CONFIG_DIR, 'auth-tokens.json');
  
  /**
   * Save tokens securely
   */
  async save(tokens: AuthTokens): Promise<void> {
    const tokenData = JSON.stringify(tokens);
    
    // Try keychain first
    if (keytar) {
      try {
        await keytar.setPassword(this.SERVICE_NAME, this.ACCOUNT_NAME, tokenData);
        return;
      } catch (error) {
        console.warn('Keychain storage failed, falling back to encrypted file');
      }
    }
    
    // Fallback to encrypted file
    await this.saveToFile(tokens);
  }

  /**
   * Load tokens securely
   */
  async load(): Promise<AuthTokens | null> {
    // Try keychain first
    if (keytar) {
      try {
        const tokenData = await keytar.getPassword(this.SERVICE_NAME, this.ACCOUNT_NAME);
        if (tokenData) {
          return JSON.parse(tokenData);
        }
      } catch (error) {
        console.warn('Keychain access failed, trying encrypted file');
      }
    }
    
    // Fallback to encrypted file
    return await this.loadFromFile();
  }

  /**
   * Clear all stored tokens
   */
  async clear(): Promise<void> {
    // Clear from keychain
    if (keytar) {
      try {
        await keytar.deletePassword(this.SERVICE_NAME, this.ACCOUNT_NAME);
      } catch {
        // Ignore keychain errors during cleanup
      }
    }
    
    // Clear from file
    try {
      await fs.unlink(this.TOKEN_FILE);
    } catch {
      // Ignore file deletion errors
    }
  }

  /**
   * Save tokens to encrypted file
   */
  private async saveToFile(tokens: AuthTokens): Promise<void> {
    // Ensure config directory exists
    await fs.mkdir(this.CONFIG_DIR, { recursive: true });
    
    // Use modern crypto API with proper IV handling
    const key = await this.getEncryptionKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    
    const tokenData = JSON.stringify(tokens);
    let encrypted = cipher.update(tokenData, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    const fileData = {
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      data: encrypted,
      version: 2 // Version for migration support
    };
    
    // Write with restrictive permissions (0600 = read/write for owner only)
    await fs.writeFile(this.TOKEN_FILE, JSON.stringify(fileData, null, 2), { mode: 0o600 });
  }

  /**
   * Load tokens from encrypted file
   */
  private async loadFromFile(): Promise<AuthTokens | null> {
    try {
      if (!existsSync(this.TOKEN_FILE)) {
        return null;
      }
      
      const fileContent = await fs.readFile(this.TOKEN_FILE, 'utf8');
      const fileData = JSON.parse(fileContent);
      
      // Handle different encryption versions
      if (fileData.version === 2) {
        return await this.decryptV2(fileData);
      } else {
        // Legacy format, attempt migration
        return await this.decryptLegacy(fileData);
      }
    } catch (error) {
      console.warn('Failed to load tokens from file:', error);
      return null;
    }
  }

  /**
   * Decrypt tokens using v2 format (AES-256-GCM)
   */
  private async decryptV2(fileData: any): Promise<AuthTokens | null> {
    try {
      const key = await this.getEncryptionKey();
      const iv = Buffer.from(fileData.iv, 'hex');
      const authTag = Buffer.from(fileData.authTag, 'hex');
      
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(fileData.data, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return JSON.parse(decrypted);
    } catch {
      return null;
    }
  }

  /**
   * Decrypt tokens using legacy format (for migration)
   */
  private async decryptLegacy(fileData: any): Promise<AuthTokens | null> {
    try {
      const key = await this.getEncryptionKey();
      const keyBuffer = Buffer.from(key.slice(0, 32));
      const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, Buffer.alloc(16, 0));
      
      let decrypted = decipher.update(fileData.data, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      const tokens = JSON.parse(decrypted);
      
      // Migrate to new format
      await this.saveToFile(tokens);
      
      return tokens;
    } catch {
      return null;
    }
  }

  /**
   * Get encryption key for file storage
   */
  private async getEncryptionKey(): Promise<Buffer> {
    // Use machine-specific identifier for encryption key
    const machineId = `maria-cli:${os.hostname()}:${os.platform()}:${os.arch()}:${os.userInfo().username}`;
    return crypto.createHash('sha256').update(machineId).digest().slice(0, 32);
  }

  /**
   * Check if secure storage is available
   */
  static isKeychainAvailable(): boolean {
    return keytar !== null;
  }
}